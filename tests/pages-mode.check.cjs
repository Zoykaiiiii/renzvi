// Pages de mise en page à l'intérieur d'un mode (disposition de tout le monde : ?pages=1 sur la démo), dans un vrai
// Chromium, Supabase simulé. Dans l'ordre du brief du 16 nov. :
//   1. créer une 2e page, naviguer par les points, y ajouter un widget, recharger et retrouver les pages ;
//   2. glisser dans une page, vers une page existante, créer une page par le bord, annuler, Terminer et recharger.
// Vérifie aussi : jamais de changement de mode, aucun widget perdu ni en double, le minuteur qui tourne reste le même,
// le menu latéral et la roue ne s'ouvrent pas pendant un glisser, renommer et supprimer une page, « Déplacer vers une
// page », clavier, téléphone (balayage, mêmes pages). VIDEO=dossier enregistre la vidéo de la création de page et du
// passage d'un widget d'une page à l'autre ; SHOTS=dossier garde les captures.
// Lancement : NODE_PATH=~/pw/node_modules node tests/pages-mode.check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');
const { custom, closeCustom, modeNow, goMode } = require('./menu.cjs');

(async () => {
  const srv = await start();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
  const errors = [];
  const shot = (page, name) => process.env.SHOTS && page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
  const open = async (bac, viewport = { width: 1440, height: 900 }, opts = {}) => {
    const context = await browser.newContext({ viewport, reducedMotion: opts.motion ? 'no-preference' : 'reduce', hasTouch: !!opts.touch, isMobile: !!opts.touch, ...(opts.video && { recordVideo: { dir: opts.video, size: viewport } }) });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${srv.url}/dashboard.html?profil=plein&bac=${bac}&pages=1`);
    await page.waitForSelector('.board[data-vue=pages] .widget:not([hidden])');
    return { page, context };
  };
  const db = bac => srv.bac('plein', bac).rows;
  const places = bac => db(bac).ecran?.vues?.places?.pages?.study;
  const until = async (test, what) => { for (let i = 0; i < 80; i++) { if (test()) return; await new Promise(r => setTimeout(r, 100)); } assert.fail(what); };
  const saved = page => page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
  const dots = page => page.locator('.pg-dot');
  const current = page => page.evaluate(() => [...document.querySelectorAll('.pg-dot')].findIndex(d => d.getAttribute('aria-current') === 'page'));
  const settle = page => page.evaluate(() => new Promise(r => setTimeout(r, 450)));
  const W = id => `.widget[data-widget=${id}]`;
  const grid = page => page.evaluate(() => {
    const b = document.getElementById('board'), r = b.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, cw: parseFloat(b.style.getPropertyValue('--pg-cw')), ch: parseFloat(b.style.getPropertyValue('--pg-ch')), gap: parseFloat(getComputedStyle(b).columnGap) };
  });
  // Aucun widget en double sur l'écran, aucun contenu perdu.
  const once = async page => {
    const ids = await page.locator('#board .widget').evaluateAll(n => n.map(w => w.dataset.widget));
    assert.equal(new Set(ids).size, ids.length, `un seul exemplaire de chaque widget (${ids.join(', ')})`);
    return ids;
  };
  // Prend un widget (déjà en édition) par son en-tête.
  async function hold(page, id) {
    const title = page.locator(`${W(id)} > .head > h2`);
    await title.click({ trial: true });
    const box = await page.locator(W(id)).boundingBox();
    const head = await title.boundingBox();
    const x = head.x + 4, y = head.y + head.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 10, y + 6, { steps: 3 });
    assert.equal(await page.locator(`${W(id)}.lifted`).count(), 1, 'le geste commence sur l’en-tête');
    return { x, y, box };
  }
  const toCell = async (page, from, c, r) => {
    const g = await grid(page);
    await page.mouse.move(from.x + g.left + c * (g.cw + g.gap) - from.box.x, from.y + g.top + r * (g.ch + g.gap) - from.box.y, { steps: 6 });
  };

  try {
    // ===== 1. Pages : créer, naviguer, ajouter un widget, recharger =====
    const { page, context } = await open('a');
    await saved(page);
    const before = structuredClone(places('a'));
    const startN = before.n;
    const rowsBefore = Object.keys(db('a')).sort();
    assert.equal(await modeNow(page), 'Study');
    assert.equal(await dots(page).count(), startN, 'un point par page du mode');
    const clock = () => page.locator(`${W('minuteur')} [role=timer]`).textContent();

    // « + » ajoute une page vide et l'affiche.
    await page.getByRole('button', { name: 'Ajouter une page' }).click();
    await until(() => places('a').n === startN + 1, 'page ajoutée enregistrée');
    assert.equal(await dots(page).count(), startN + 1);
    assert.equal(await current(page), startN, 'la nouvelle page est affichée');
    const empty = page.locator('.pg-empty');
    await empty.waitFor();
    assert.match(await empty.textContent(), new RegExp(`Page ${startN + 1} est vide`));
    await shot(page, '1-page-vide');
    // Points : aller-retour.
    await dots(page).first().click();
    await settle(page);
    assert.equal(await current(page), 0);
    await dots(page).nth(startN).click();
    await settle(page);
    assert.equal(await current(page), startN);
    // Clavier : flèches depuis les points.
    await dots(page).nth(startN).focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await current(page), startN - 1);
    await page.keyboard.press('ArrowRight');
    assert.equal(await current(page), startN);
    // Ajouter un widget sur cette page, depuis son état vide.
    await empty.getByRole('button', { name: 'Ajouter un widget' }).click();
    await page.locator('#catalog .cat-item').filter({ has: page.locator('b', { hasText: /^Habitudes$/ }) }).click();
    assert.match(await page.textContent('#cat-view'), new RegExp(`Sera ajouté sur « Page ${startN + 1} »`));
    await page.getByRole('button', { name: 'Ajouter : Habitudes', exact: true }).click();
    await page.click('#add-dialog .primary:has-text("Terminer")');
    await until(() => places('a').d.habitudes?.p === startN, 'Habitudes sur la nouvelle page');
    assert.equal(await page.locator('.pg-empty').count(), 0, 'la page n’est plus vide');
    assert.equal(await modeNow(page), 'Study', 'toujours le même mode');
    await saved(page);
    // Rechargement : les pages, la place du widget et la dernière page vue reviennent.
    await page.reload();
    await page.waitForSelector('.board[data-vue=pages] .widget:not([hidden])');
    assert.equal(await dots(page).count(), startN + 1);
    assert.equal(await current(page), startN, 'dernière page vue retrouvée');
    assert.ok(await page.locator(W('habitudes')).isVisible());
    for (const [id, q] of Object.entries(before.d)) assert.deepEqual(places('a').d[id], q, `${id} n’a pas bougé`);
    await shot(page, '2-page-2-avec-widget');

    // Le minuteur tourne pendant toute la suite : c'est le même widget, jamais recréé, quelle que soit la page.
    await page.locator(`${W('minuteur')} .primary`, { hasText: 'Démarrer' }).click();
    await page.evaluate(() => { window.__minuteur = document.querySelector('.widget[data-widget=minuteur]'); });
    const t0 = await clock();
    await dots(page).nth(startN).click();
    await settle(page);

    // ===== Gestion : renommer, supprimer (avec confirmation), modes intacts =====
    await custom(page);
    assert.match(await page.textContent('#lp-now'), new RegExp(`Page ${startN + 1} · ${startN + 1} sur ${startN + 1}`));
    await page.click('#lp-rename');
    await page.fill('#page-slot input', 'Révisions du soir');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await until(() => places('a').t?.[startN] === 'Révisions du soir', 'nom enregistré');
    assert.equal(await page.locator('.pg-name').textContent(), 'Révisions du soir');
    assert.equal(db('a').ecran.pages.length, 2, 'les modes ne changent pas');
    await closeCustom(page);

    // ===== 2. Déplacer : dans la page, vers une page existante, par le bord vers une nouvelle page, annuler =====
    await custom(page);
    await page.click('#layout-edit');
    await page.waitForFunction(() => document.body.classList.contains('pages-editing'));
    // Dans la page : Habitudes va de la case (0,0) à (6,2).
    let h = await hold(page, 'habitudes');
    await toCell(page, h, 6, 2);
    assert.ok(await page.locator('.pg-drop:not([hidden]):not(.bad)').isVisible(), 'aperçu de la place visée');
    await page.mouse.up();
    await until(() => places('a').d.habitudes.c === 6 && places('a').d.habitudes.r === 2, 'déplacé dans la page');
    // Pendant un glisser contre le bord gauche de l'écran : ni menu latéral, ni roue des modes.
    h = await hold(page, 'habitudes');
    await page.mouse.move(4, h.y, { steps: 6 });
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => document.body.classList.contains('bar-peek')), false, 'le menu latéral ne s’ouvre pas');
    assert.equal(await page.evaluate(() => !!document.querySelector('dialog.mode-wheel[open]')), false, 'la roue ne s’ouvre pas');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await settle(page);
    assert.equal(await current(page), startN, 'annulé : on revient à la page de départ');
    assert.deepEqual(places('a').d.habitudes, { p: startN, c: 6, r: 2, w: places('a').d.habitudes.w, h: places('a').d.habitudes.h });

    // Bord droit au-delà de la dernière page : une page provisoire ; annuler ne laisse rien.
    h = await hold(page, 'habitudes');
    const g = await grid(page);
    await page.mouse.move(g.right - 10, h.y);
    await page.waitForFunction(() => document.querySelector('.pg-edge-right.on span')?.textContent === 'Nouvelle page');
    await page.waitForFunction(n => document.querySelectorAll('.pg-dot').length === n, startN + 2);
    assert.equal(await page.locator('.pg-dot.temp').count(), 1, 'page provisoire marquée');
    assert.ok(await page.locator(`${W('habitudes')}.lifted`).isVisible(), 'le widget reste dans la main');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await page.waitForFunction(n => document.querySelectorAll('.pg-dot').length === n, startN + 1);
    assert.equal(places('a').n, startN + 1, 'aucune page orpheline');
    assert.equal(places('a').d.habitudes.p, startN);

    // Bord droit, puis poser : la page provisoire devient une vraie page.
    h = await hold(page, 'habitudes');
    await page.mouse.move(g.right - 10, h.y);
    await page.waitForFunction(n => document.querySelectorAll('.pg-dot').length === n, startN + 2);
    await settle(page);
    await toCell(page, h, 0, 0);
    await page.mouse.up();
    await until(() => places('a').n === startN + 2 && places('a').d.habitudes.p === startN + 1, 'nouvelle page gardée');
    assert.equal(await page.locator('.pg-dot.temp').count(), 0);
    // Vers une page existante : bord gauche, la page d'avant.
    h = await hold(page, 'habitudes');
    await page.mouse.move(g.left + 8, h.y);
    await page.waitForFunction(() => document.querySelector('.pg-edge-left.on span')?.textContent === 'Révisions du soir');
    await page.waitForFunction(n => [...document.querySelectorAll('.pg-dot')].findIndex(d => d.getAttribute('aria-current') === 'page') === n, startN);
    await settle(page);
    await toCell(page, h, 2, 1);
    await page.mouse.up();
    await until(() => places('a').d.habitudes.p === startN && places('a').d.habitudes.c === 2 && places('a').d.habitudes.r === 1, 'posé sur la page existante');
    assert.equal(await page.evaluate(() => String(getSelection())), '', 'aucun texte sélectionné en passant de page');
    assert.equal(places('a').n, startN + 2, 'la page devenue vide reste (créée exprès)');
    // Sans glisser : « Déplacer vers une page ».
    const pick = page.locator(`${W('habitudes')} .pg-to select`);
    assert.equal(await pick.getAttribute('aria-label'), 'Déplacer Habitudes vers une page');
    assert.deepEqual(await pick.locator('option').allTextContents(), [...Array.from({ length: startN }, (_, i) => `Page ${i + 1}`), 'Révisions du soir', `Page ${startN + 2}`, 'Nouvelle page']);
    await pick.selectOption(String(startN + 1));
    await until(() => places('a').d.habitudes.p === startN + 1, 'déplacé par la liste');
    assert.match(await page.textContent('#custom-live'), new RegExp(`Habitudes est maintenant sur Page ${startN + 2}`));
    await shot(page, '3-edition');
    // Terminer, puis recharger : tout est là, une seule fois.
    await page.getByRole('button', { name: 'Terminer', exact: true }).click();
    assert.equal(await page.evaluate(() => document.body.classList.contains('pages-editing')), false);
    await saved(page);
    const final = structuredClone(places('a'));
    assert.equal(await modeNow(page), 'Study', 'aucun changement de mode');
    assert.equal(await page.evaluate(() => window.__minuteur.isConnected && window.__minuteur === document.querySelector('.widget[data-widget=minuteur]')), true, 'minuteur jamais recréé');
    assert.notEqual(await clock(), t0, 'le minuteur tourne toujours');
    await once(page);
    await page.reload();
    await page.waitForSelector('.board[data-vue=pages] .widget:not([hidden])');
    assert.deepEqual(places('a'), final, 'rien ne change au rechargement');
    assert.equal(await dots(page).count(), startN + 2);
    await once(page);
    assert.deepEqual(Object.keys(db('a')).sort(), [...new Set([...rowsBefore, 'habitudes'])].sort(), 'aucune donnée de widget en double ni perdue');
    assert.equal(await page.locator(`${W('minuteur')} [role=timer]`).count(), 1);

    // Supprimer une page avec un widget : confirmation, le widget passe sur la page d'avant, son contenu reste.
    const habitudes = structuredClone(db('a').habitudes);
    await dots(page).nth(startN + 1).click();
    await custom(page);
    await page.click('#lp-delete');
    assert.match(await page.textContent('#page-slot'), /1 widget et leur contenu passeront sur « Révisions du soir »\. .*Rien n’est perdu\./);
    await page.locator('#page-dialog').getByRole('button', { name: 'Supprimer la page', exact: true }).click();
    await until(() => places('a').n === startN + 1 && places('a').d.habitudes.p === startN, 'page supprimée, widget gardé');
    assert.deepEqual(db('a').habitudes, habitudes, 'contenu intact');
    await closeCustom(page);
    await context.close();

    // ===== Changer de mode : la roue change de mode, les pages restent celles de chaque mode =====
    {
      const { page: p, context: c } = await open('b');
      await p.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
      const nStudy = places('b').n + 1;
      await p.getByRole('button', { name: 'Ajouter une page' }).click();
      await until(() => places('b').n === nStudy, 'page ajoutée');
      await goMode(p, 'Chill');
      await p.waitForFunction(() => /Chill/.test(document.getElementById('mode-now').textContent));
      await p.waitForSelector('.board[data-vue=pages] .widget:not([hidden])');
      await until(() => db('b').ecran.vues.places.pages.chill, 'pages de Chill enregistrées');
      const chillN = db('b').ecran.vues.places.pages.chill?.n ?? 1;
      assert.equal(await dots(p).count(), chillN, 'les points du mode Chill seulement');
      assert.equal(places('b').n, nStudy, 'les pages de Study sont gardées');
      await c.close();
    }

    // ===== Téléphone : mêmes pages, balayage, rien ne déborde =====
    {
      const { page: p, context: c } = await open('a', { width: 390, height: 844 }, { touch: true });
      assert.equal(await dots(p).count(), startN + 1, 'mêmes pages que sur l’ordinateur');
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, 'rien ne déborde');
      await dots(p).first().click();
      await settle(p);
      const cdp = await c.newCDPSession(p);
      // Le balayage part de l'en-tête d'un widget visible (une zone sans geste à elle).
      const head = await p.evaluate(() => { const h = [...document.querySelectorAll('.board .widget:not([hidden]) .head h2')].map(n => n.getBoundingClientRect()).find(r => r.left >= 0 && r.right <= innerWidth && r.top > 0 && r.bottom < innerHeight); return h && { x: h.left, y: h.top }; });
      assert.ok(head, 'un en-tête de widget visible');
      // Un vrai doigt (événements tactiles) qui glisse de droite à gauche.
      const y = Math.round(head.y + 8), touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await touch('touchStart', 330);
      for (let x = 310; x >= 70; x -= 20) { await touch('touchMove', x); await p.waitForTimeout(16); }
      await touch('touchEnd', 70);
      await settle(p);
      assert.equal(await current(p), 1, 'un balayage passe à la page suivante');
      await shot(p, '4-telephone');
      await c.close();
    }

    // ===== Vidéo : créer une page, y emmener un widget par le bord =====
    if (process.env.VIDEO) {
      fs.mkdirSync(process.env.VIDEO, { recursive: true });
      const { page: p, context: c } = await open('video', { width: 1280, height: 800 }, { motion: true, video: process.env.VIDEO });
      await p.waitForTimeout(800);
      await p.getByRole('button', { name: 'Ajouter une page' }).click();
      await p.waitForTimeout(1200);
      await dots(p).first().click();
      // Un défilement en cours annule l'appui long (c'est un balayage) : on attend que la page soit posée.
      await p.waitForFunction(() => document.getElementById('board').scrollLeft === 0);
      await p.waitForTimeout(600);
      // Appui long sur l'en-tête du minuteur : l'édition s'ouvre et le widget suit la souris sans relâcher.
      const head = await p.locator(`${W('minuteur')} .head h2`).boundingBox();
      const hv = { x: head.x + 30, y: head.y + 8 };
      await p.mouse.move(hv.x, hv.y);
      await p.mouse.down();
      await p.waitForTimeout(800);
      const gv = await grid(p);
      for (let x = hv.x; x < gv.right - 10; x += 30) await p.mouse.move(x, hv.y, { steps: 2 });
      // Tenu contre le bord jusqu'à la dernière page (la nouvelle), une page à chaque instant.
      const last = await dots(p).count() - 1;
      for (let i = 0; i < 12 && await current(p) < last; i++) {
        await p.mouse.move(gv.right - 10, hv.y + (i % 2 ? 3 : -3));
        await p.waitForTimeout(750);
      }
      await p.waitForTimeout(500);
      for (let x = gv.right - 10; x > gv.left + 200; x -= 30) await p.mouse.move(x, hv.y + 120, { steps: 2 });
      await p.waitForTimeout(400);
      await p.mouse.up();
      await until(() => db('video').ecran?.vues?.places?.pages?.study?.d.minuteur?.p === last, 'vidéo : le minuteur est sur la nouvelle page').catch(async e => { console.log('DBG', last, await current(p), await dots(p).count(), JSON.stringify(db('video').ecran?.vues?.places?.pages?.study?.d.minuteur), await p.textContent('#custom-live')); throw e; });
      await p.waitForTimeout(900);
      await p.getByRole('button', { name: 'Terminer', exact: true }).click();
      await p.waitForTimeout(800);
      await dots(p).first().click();
      await p.waitForTimeout(900);
      await dots(p).nth(last).click();
      await p.waitForTimeout(1200);
      const video = p.video();
      await c.close();
      console.log('vidéo :', await video.path());
    }

    assert.deepEqual(errors, []);
    console.log('pages-mode : tous les parcours passent');
  } finally {
    await browser.close();
    await srv.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
