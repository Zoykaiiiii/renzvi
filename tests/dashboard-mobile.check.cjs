// Layout of the actual dashboard with a saved chapter, focus history, and short placements.
// NODE_PATH=~/pw/node_modules SHOTS=/mnt/data node tests/dashboard-mobile.check.cjs
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const { start } = require('./demo.cjs');

const engine = process.env.WEBKIT ? webkit : chromium;
const screens = [
  { width: 320, height: 568, locale: 'es' },
  { width: 390, height: 844, locale: 'fr' },
  { width: 390, height: 844, locale: 'en' },
  { width: 1440, height: 900, locale: 'fr' },
];
const excerpt = 'La membrane plasmique sépare la cellule de son environnement et régule les échanges avec le milieu extérieur.';
const chapter = 'La membrane plasmique';
const pages = ['Les cellules', 'Le noyau', chapter, 'Le cytoplasme'].map((title, i) => `${title}\n\n${i === 2 ? excerpt : 'Introduction au chapitre.'}`);
const chapters = pages.map((text, i) => ({ id: `ch${i}`, title: text.split('\n')[0], page: i, offset: 0 }));

async function fits(card, selectors) {
  const layout = await card.evaluate((node, selectors) => {
    const cardRect = node.getBoundingClientRect();
    const body = node.querySelector('.body');
    return {
      overflow: [body.scrollWidth - body.clientWidth, body.scrollHeight - body.clientHeight],
      clipped: selectors.filter(selector => [...node.querySelectorAll(selector)].some(el => {
        const r = el.getBoundingClientRect();
        return !r.width || !r.height || r.left < cardRect.left - 1 || r.right > cardRect.right + 1
          || r.top < cardRect.top - 1 || r.bottom > cardRect.bottom + 1;
      })),
    };
  }, selectors);
  assert.ok(layout.overflow.every(px => px <= 1), JSON.stringify(layout));
  assert.deepEqual(layout.clipped, []);
}

(async () => {
  const server = await start();
  const browser = await engine.launch(engine === chromium ? { args: ['--use-angle=swiftshader', '--use-gl=angle'] } : {});
  try {
    for (const { width, height, locale } of screens) {
      const mobile = width < 728;
      const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce', serviceWorkers: 'block', locale });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const bac = `mobile${width}${locale}`;
      const db = server.bac('plein', bac);
      db.abonnement = { plan: 'worker', statut: 'actif' };
      db.rows.ecran.widgets = ['cahier', 'vol', 'semaine', 'notes', 'taches'];
      const place = (p, c, r, w, h) => ({ p, c, r, w, h });
      db.rows.ecran.vues = { v: 1, places: { pages: { study: { n: 2, t: ['Study', 'Notes'], d: {
        cahier: place(0, 0, 0, 6, 3), vol: place(0, 6, 0, 6, 3), semaine: place(0, 0, 3, 6, 2),
        notes: place(1, 0, 0, 6, 3), taches: place(1, 6, 0, 6, 3),
      } } } } };
      db.rows.cahier = { course: 'bio', chapter: 'ch2' };
      db.files.set(`cours/demo-plein-${bac}/bio/texte.json`, { type: 'application/json', data: JSON.stringify({ pages }) });
      const now = new Date();
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7);
      const priorSunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 1);
      db.rows.vol = { length: 25, log: { [monday.toLocaleDateString('sv')]: 25 } };
      db.rows.minuteur = { log: { [monday.toLocaleDateString('sv')]: 45, [priorSunday.toLocaleDateString('sv')]: 35 } };
      await page.route('**/rest/v1/study_courses?*', route => route.fulfill({ json: [{
        id: 'bio', title: 'La cellule', subject: 'Biologie', kind: 'pdf', file_name: 'cellule.pdf', file_size: 123,
        page_count: pages.length, text_chars: pages.join('').length, chapters,
      }] }));
      await page.route('**/rest/v1/study_notes?*', route => route.fulfill({ json: [{ chapter_id: 'ch2', body: 'Revoir le transport passif' }] }));
      if (locale !== 'fr') await page.route('**/dashboard.html*', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: (await response.text()).replace('lang="fr"', `lang="${locale}"`) });
      });
      if (mobile && engine === chromium) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34, left: 0, right: 0 } });
      }
      await page.goto(`${server.url}/dashboard.html?profil=plein&bac=${bac}&pages=1`);
      await page.waitForSelector('#board[data-vue=pages]');
      const cahier = page.locator('[data-widget=cahier]');
      const vol = page.locator('[data-widget=vol]');
      const focus = page.locator('[data-widget=semaine]');
      await cahier.locator('.cahier-livre-titre').waitFor({ state: mobile ? 'visible' : 'attached' });
      await page.locator('.chat-ia-launch').waitFor();
      assert.match(await page.locator('meta[name=viewport]').getAttribute('content'), /viewport-fit=cover/);
      assert.equal(await page.locator('meta[name=apple-mobile-web-app-status-bar-style]').getAttribute('content'), 'black-translucent');
      const shell = await page.evaluate(() => {
        const box = selector => document.querySelector(selector).getBoundingClientRect();
        return { top: box('.topbar').top, mode: box('.bar-mode').top, padding: parseFloat(getComputedStyle(document.body).paddingTop),
          dots: innerHeight - box('.pg-dots').bottom, zvi: innerHeight - box('.chat-ia-launch').bottom,
          horizontal: document.documentElement.scrollWidth - innerWidth };
      });
      assert.equal(shell.horizontal, 0);
      if (mobile && engine === chromium) {
        assert.deepEqual([shell.top, shell.mode, shell.padding], [59, 67, 111]);
        assert.ok(shell.dots >= 44 && shell.zvi >= 50, JSON.stringify(shell));
      }

      if (mobile) {
        await fits(cahier, ['.cahier-livre-titre', '.cahier-livre-texte', '.cahier-livre-foot', '.cahier-livre-open']);
        assert.equal(await cahier.locator('.cahier-livre-titre').innerText(), chapter);
        assert.equal(await cahier.locator('.cahier-livre-texte').textContent(), excerpt);
        await cahier.locator('.cahier-livre-liste li').waitFor({ state: 'attached' });
        const noteLayout = await cahier.locator('.cahier-livre').evaluate(livre => {
          const book = livre.querySelector('.cahier-book');
          const leaf = livre.querySelector('.cahier-feuille.droite');
          return { width: livre.clientWidth, cols: getComputedStyle(book).gridTemplateColumns, display: getComputedStyle(leaf).display };
        });
        assert.equal(noteLayout.display !== 'none', width >= 390, JSON.stringify(noteLayout));
        if (width >= 390) assert.equal(await cahier.locator('.cahier-livre-liste li').innerText(), 'Revoir le transport passif');
        await fits(vol, ['.boarding', '.bstub svg', '.bfields', '.vol-time', '.vol-go']);
        await fits(focus, ['.week-total', '.week-period', '.week-bar', '.week-day']);
        await vol.scrollIntoViewIfNeeded();
        assert.ok(await page.evaluate(() => scrollY > 0 && document.querySelector('#board').scrollTop === 0));
      }
      assert.equal(await focus.locator('.week li').count(), 7);
      const columns = await focus.locator('.week-bar').evaluateAll(bars => bars.map(bar => ({
        width: bar.getBoundingClientRect().width, baseline: getComputedStyle(bar).borderBottomWidth,
      })));
      assert.ok(columns.every(col => Math.abs(col.width - columns[0].width) < 1 && col.baseline === '1px'));
      assert.equal(await focus.locator('.week-total').textContent(), '1 h 10');
      const period = focus.locator('.week-period');
      await period.selectOption('7');
      assert.equal(await focus.locator('.week-total').textContent(), '35 min');
      assert.equal(await focus.locator('.week-bar > span').last().textContent(), '35');
      assert.equal(await focus.locator('.week-day').last().textContent(), { fr: 'dim', en: 'Sun', es: 'dom' }[locale]);
      await period.selectOption('0');

      if (process.env.SHOTS && width === 390 && locale === 'fr') {
        await page.evaluate(() => document.fonts.ready);
        for (const [card, name] of [[cahier, 'cahier'], [vol, 'vol-focus'], [focus, 'temps-focus']]) {
          await card.evaluate(n => n.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
          await card.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
        }
      }

      await focus.locator('button.zoom').click();
      await focus.and(page.locator('.zoomed')).waitFor();
      await fits(focus, ['.week-bar', '.week-day', '.week-period']);
      await focus.locator('.zoom-back').click();

      if (mobile) {
        await cahier.locator('.cahier-add').click();
        const dialog = page.locator('.cahier-import-dialog');
        await dialog.waitFor();
        assert.equal(await dialog.locator('input[type=text]:visible').count(), 1);
        assert.equal(await dialog.locator('input[accept*="pdf"]').count(), 1);
        assert.ok(await dialog.locator('button[type=submit]').isVisible());
        assert.ok(await dialog.evaluate(n => n.scrollHeight <= n.clientHeight + 1));
        await dialog.locator('.cahier-actions button:not([type=submit])').click();
        assert.equal(await cahier.locator('.cahier-livre-titre').innerText(), chapter);
        await cahier.locator('.cahier-livre-open').click();
        await cahier.and(page.locator('.cahier-open')).waitFor();
        assert.equal(await cahier.locator('.cahier-title').innerText(), chapter);
        await page.keyboard.press('Escape');
        await page.locator('#bar-mode').tap();
        const wheel = page.locator('dialog.mode-wheel[open]');
        await wheel.waitFor();
        const selection = await wheel.locator('.mode-wheel__hint,.mode-wheel__title,.mw-name,.mw-now').evaluateAll(nodes => nodes.map(n => {
          const style = getComputedStyle(n);
          return [style.getPropertyValue('user-select'), style.getPropertyValue('-webkit-user-select')];
        }));
        assert.ok(selection.every(properties => properties.includes('none')), JSON.stringify(selection));
        await wheel.locator('.is-create .mw-item').tap();
        const name = page.locator('#mc-name');
        await name.waitFor();
        await name.fill('Sport');
        await name.selectText();
        assert.equal(await name.evaluate(n => n.selectionEnd - n.selectionStart), 5);
      }
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`${engine.name()} dashboard ${width}×${height} ${locale} OK`);
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
