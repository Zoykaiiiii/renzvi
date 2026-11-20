// NODE_PATH=~/pw/node_modules [VIDEO=/tmp/videos] node tests/pages-touch.check.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, webkit } = require('playwright');
const { start } = require('./demo.cjs');

(async () => {
  const server = await start();
  const browser = await (process.env.WEBKIT ? webkit : chromium).launch();
  try {
    const viewport = { width: 390, height: 844 };
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true,
      ...(process.env.VIDEO && { recordVideo: { dir: process.env.VIDEO, size: viewport } }) });
    const page = await context.newPage();
    const db = server.bac('plein', 'doigt');
    const placements = () => db.rows.ecran.vues.places.pages.study.d;
    const slot = (p, r) => ({ p, r, c: 0, w: 6, h: 3 });
    db.rows.ecran.widgets = ['notes', 'semaine', 'taches', 'playlist'];
    db.rows.ecran.where.playlist = 'study';
    db.rows.vol = { log: { [new Date().toLocaleDateString('sv')]: 360 } };
    db.rows.minuteur = { log: {} };
    db.rows.playlist = { provider: 'spotify', kind: 'playlist', id: '37i9dQZF1DXcBWIGoYBM5M', title: 'Lecture calme' };
    db.rows.ecran.vues = { v: 1, places: { pages: { study: { n: 2, d: {
      notes: slot(0, 0), semaine: slot(0, 3), taches: slot(1, 0), playlist: slot(1, 3),
    } } } } };
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // WebKit Linux expose tap mais pas de séquence tactile maintenue dans Playwright.
    const cdp = !process.env.WEBKIT && await context.newCDPSession(page);
    const touch = async (type, points = []) => {
      if (cdp) return cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
      if (points.length) await page.mouse.move(points[0].x, points[0].y);
      if (type === 'touchStart') await page.mouse.down();
      if (type === 'touchCancel') await page.keyboard.press('Escape');
      if (!points.length) await page.mouse.up();
    };
    await page.addInitScript(() => {
      window.screenWrites = 0;
      document.addEventListener('renzvi:donnees', e => { if (e.detail.widget === 'ecran') window.screenWrites++; });
    });
    await page.goto(server.url + '/dashboard.html?profil=plein&bac=doigt&pages=1');
    const card = id => page.locator('#board > [data-widget=' + id + ']');
    const ready = () => page.locator('#board[data-vue=pages]').waitFor();
    await ready();
    async function holdText(target) {
      await target.scrollIntoViewIfNeeded();
      const point = await target.evaluate(n => {
        const range = document.createRange();
        range.selectNodeContents(n);
        const r = range.getClientRects()[0];
        return { x: r.left + 4, y: r.top + r.height / 2 };
      });
      await touch('touchStart', [point]);
      await page.waitForTimeout(850);
      assert.equal(await page.evaluate(() => String(getSelection())), '');
      await touch('touchEnd');
      assert.equal(await page.evaluate(() => String(getSelection())), '');
      assert.equal(await page.locator('.lifted').count(), 0);
    }
    async function hold(id) {
      const title = card(id).locator('.head h2');
      await title.evaluate(n => n.scrollIntoView({ block: 'center', behavior: 'instant' }));
      const r = await title.boundingBox();
      const point = { x: r.x + 10, y: r.y + r.height / 2 };
      const box = await card(id).boundingBox();
      await touch('touchStart', [point]);
      await page.waitForSelector('.widget.lifted', { timeout: 2000 });
      return { dx: point.x - box.x, dy: point.y - box.y };
    }
    async function cross(id, dest, cancel = false) {
      const writes = await page.evaluate(() => window.screenWrites);
      const offset = await hold(id);
      assert.ok(await page.evaluate(() => scrollY > 0), 'déplacement après défilement vertical');
      const edge = dest ? 354 : 36;
      await touch('touchMove', [{ x: edge, y: 320 }]);
      await page.waitForFunction(p => document.querySelectorAll('.pg-dot')[p].ariaCurrent === 'page', dest);
      await touch('touchMove', [{ x: edge + 1, y: 321 }]);
      await page.waitForTimeout(750);
      assert.equal(await page.locator('.pg-dot').count(), 2, 'une seule page par entrée dans le bord');
      await touch('touchMove', [{ x: 160, y: 410 }]);
      const r = await card(id).boundingBox();
      assert.ok(Math.abs(r.x + offset.dx - 160) < 2 && Math.abs(r.y + offset.dy - 410) < 2, JSON.stringify({ r, offset }));
      assert.ok(await page.locator('.pg-drop:not(.bad)').isVisible());
      assert.equal(await page.evaluate(() => String(getSelection())), '');
      const row = await page.locator('.pg-drop').evaluate(n => n.style.gridRowStart);
      await touch(cancel ? 'touchCancel' : 'touchEnd');
      if (!cancel) assert.equal(await card(id).evaluate(n => n.style.gridRowStart), row);
      await page.locator('.pg-bar button').tap();
      assert.equal(await page.evaluate(() => window.screenWrites) - writes, cancel ? 0 : 1);
      await page.waitForTimeout(900);
    }
    for (const selector of ['.week-total', '.week-day', '.pl-info', '.pg-dot i', '.bar-btn span', '[data-widget=taches] .head h2']) {
      assert.equal(await page.locator(selector).first().evaluate(n => getComputedStyle(n).webkitUserSelect), 'none');
    }
    const selection = await card('semaine').evaluate(widget => {
      const sample = document.createElement('div');
      sample.innerHTML = '<span>Libellé</span><div contenteditable="true"><b>Texte</b></div>';
      widget.append(sample);
      const styles = [sample.firstChild, sample.querySelector('b')].map(n => getComputedStyle(n).webkitUserSelect);
      sample.remove();
      return styles;
    });
    assert.deepEqual(selection, ['none', 'text']);
    const total = card('semaine').locator('.week-total');
    assert.equal(await total.textContent(), '6 h');
    await holdText(total);
    await cross('semaine', 1, true);
    assert.deepEqual(placements().semaine, slot(0, 3));
    if (cdp) {
      const total = card('semaine').locator('.week-total');
      await total.evaluate(n => n.scrollIntoView({ block: 'center', behavior: 'instant' }));
      const rect = await total.boundingBox(), before = await page.evaluate(() => scrollY);
      const x = rect.x + 12, y = rect.y + 8;
      await touch('touchStart', [{ x, y }]);
      for (let dy = 15; dy <= 120; dy += 15) await touch('touchMove', [{ x, y: y + dy }]);
      await touch('touchEnd');
      await page.waitForFunction(start => scrollY < start - 10, before);
      await page.waitForTimeout(400);
    }
    await cross('semaine', 1);
    assert.equal(placements().semaine.p, 1);
    await page.reload();
    await ready();
    assert.equal(await card('semaine').count(), 1);
    await holdText(card('playlist').locator('.pl-info').last());
    await cross('playlist', 0);
    assert.equal(placements().playlist.p, 0);
    assert.equal(db.rows.ecran.where.playlist, 'study');
    const scale = await page.evaluate(() => visualViewport.scale);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    const blank = await page.evaluate(() => {
      for (let y = 100; y < innerHeight - 80; y += 4) for (let x = 16; x < innerWidth - 16; x += 8) {
        if (document.elementFromPoint(x, y)?.id === 'board') return { x, y };
      }
    });
    assert.ok(blank);
    await touch('touchStart', [blank]);
    const wheel = page.locator('dialog.mode-wheel[open]');
    await wheel.waitFor();
    await page.waitForTimeout(900);
    await touch('touchEnd');
    await holdText(wheel.getByText('Study', { exact: true }));
    assert.ok(await wheel.isVisible());
    const option = await wheel.locator('.is-current .mw-item').boundingBox();
    const x = option.x + 20, y = option.y + option.height / 2;
    await touch('touchStart', [{ x, y }]);
    await touch('touchMove', [{ x, y: y - 55 }]);
    await touch('touchEnd');
    assert.ok(await wheel.isVisible(), 'le balayage fait défiler la roue');
    await wheel.getByText('Chill', { exact: true }).tap();
    await page.waitForFunction(() => document.querySelector('#bar-mode').textContent === 'Chill');
    await page.locator('#bar-mode').tap();
    await wheel.getByText('Study', { exact: true }).tap();
    await page.waitForFunction(() => document.querySelector('#bar-mode').textContent === 'Study');
    await page.locator('#bar-mode').tap();
    const current = wheel.locator('.is-current .mw-item');
    await current.tap({ trial: true });
    const r = await current.boundingBox();
    await page.touchscreen.tap(r.x + 16, r.y + r.height / 2);
    await page.touchscreen.tap(r.x + 16, r.y + r.height / 2);
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => visualViewport.scale), scale);
    assert.equal(await page.evaluate(() => String(getSelection())), '');
    assert.deepEqual(errors, []);
    await context.close();
    if (process.env.VIDEO) await page.video().saveAs(path.join(process.env.VIDEO, 'pages-touch.webm'));
    console.log('Focus et Playlist, bords, annulation, aperçu, rechargement OK');
  } finally {
    await browser.close();
    await server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
