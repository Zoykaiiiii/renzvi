// Présentation « Pages » (labo ?vues=1, site/vues/pages.js), dans un vrai Chromium, sur le serveur de démo (Supabase simulé).
// Pages horizontales qui tiennent dans l'écran, points de pagination (souris, clavier), appui long sur un widget → édition,
// appui long sur le fond → roue des modes (jamais les deux), déplacer et redimensionner sur les cases sans chevauchement,
// place refusée, clavier, Échap, rechargement, minuteur qui continue d'une page à l'autre, vue agrandie, téléphone,
// panne d'enregistrement.
// Lancement : NODE_PATH=~/pw/node_modules node tests/pages.check.cjs   (SHOTS=dossier pour garder les captures)
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');

(async () => {
  const srv = await start();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
  const errors = [];
  const shot = (page, name) => process.env.SHOTS && page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
  const open = async (viewport, bac, opts = {}) => {
    const context = await browser.newContext({ viewport, reducedMotion: opts.reduced === false ? 'no-preference' : 'reduce', hasTouch: !!opts.touch });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${srv.url}/dashboard.html?profil=plein&bac=${bac}&vues=1`);
    await page.waitForSelector('#board .widget:not([hidden])');
    return { page, context };
  };
  const dbOf = bac => srv.bac('plein', bac);
  const choosePages = async page => {
    await page.locator('#vue-pick').getByRole('button', { name: 'Pages' }).click();
    await page.waitForSelector('.board[data-vue=pages]');
    await settle(page);
  };
  const settle = page => page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))));
  const saved = page => page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
  const until = async (test, what) => { for (let i = 0; i < 80; i++) { if (test()) return; await new Promise(r => setTimeout(r, 100)); } assert.fail(what); };
  const places = bac => dbOf(bac).rows.ecran.vues.places.pages.study;
  const W = id => `.widget[data-widget=${id}]`;
  const editing = page => page.evaluate(() => document.body.classList.contains('pages-editing'));
  const wheelOpen = page => page.evaluate(() => !!document.querySelector('dialog.mode-wheel[open]'));
  const grid = page => page.evaluate(() => {
    const b = document.getElementById('board'), r = b.getBoundingClientRect();
    return { left: r.left, top: r.top, bottom: r.bottom, W: b.clientWidth, cw: parseFloat(b.style.getPropertyValue('--pg-cw')), ch: parseFloat(b.style.getPropertyValue('--pg-ch')), gap: parseFloat(getComputedStyle(b).columnGap), sl: b.scrollLeft };
  });
  const noOverlap = d => {
    const list = Object.entries(d);
    for (const [a, p] of list) {
      assert.ok(p.c >= 0 && p.r >= 0 && p.c + p.w <= 12 && p.r + p.h <= 6, `${a} reste dans sa page`);
      for (const [b, q] of list) if (a < b && p.p === q.p) assert.ok(p.c + p.w <= q.c || q.c + q.w <= p.c || p.r + p.h <= q.r || q.r + q.h <= p.r, `${a} et ${b} ne se chevauchent pas`);
    }
  };
  // Glisser un widget (déjà en édition) pour poser son coin haut-gauche sur une case de la page affichée.
  async function dragTo(page, id, c, r, { drop = true } = {}) {
    const g = await grid(page), box = await page.locator(W(id)).boundingBox();
    const sx = box.x + box.width / 2, sy = box.y + 60;
    const tx = g.left + c * (g.cw + g.gap), ty = g.top + r * (g.ch + g.gap);
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx + (tx - box.x) / 2, sy + (ty - box.y) / 2, { steps: 4 });
    await page.mouse.move(sx + tx - box.x, sy + ty - box.y, { steps: 4 });
    if (drop) await page.mouse.up();
  }
  async function longPress(page, x, y, ms = 750) {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(ms);
  }

  // 1. Choisir « Pages » : chaque widget sur une page, sans chevauchement, la page tient dans l'écran.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'p1');
    await choosePages(page);
    await saved(page);
    const d = places('p1').d;
    assert.equal(Object.keys(d).length, 9, 'les 9 widgets de Study sont placés');
    noOverlap(d);
    // 4 widgets au plus par page (Damien, 17 nov.) : les 9 widgets de Study tiennent sur 3 pages.
    assert.equal(places('p1').n, 3, 'trois pages');
    assert.equal(await page.locator('.pg-dot').count(), 3);
    for (let p = 0; p < 3; p++) assert.ok(Object.values(d).filter(q => q.p === p).length <= 4, `page ${p + 1} : 4 widgets au plus`);
    const g = await grid(page);
    assert.ok(g.bottom <= 900 - 40, `la page tient dans l'écran avec ses points (${g.bottom})`);
    const dots = await page.locator('.pg-dots').boundingBox();
    assert.ok(dots.y + dots.height <= 900, 'les points sont visibles');
    for (const [id, q] of Object.entries(d)) {
      const b = await page.locator(W(id)).evaluate(e => ({ x: e.offsetLeft, y: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight }));
      assert.ok(Math.abs(b.x - (q.p * 12 + q.c) * (g.cw + g.gap)) < 2 && Math.abs(b.w - (q.w * (g.cw + g.gap) - g.gap)) < 2, `${id} occupe ses colonnes`);
      assert.ok(Math.abs(b.y - q.r * (g.ch + g.gap)) < 2 && Math.abs(b.h - (q.h * (g.ch + g.gap) - g.gap)) < 2, `${id} occupe ses rangées`);
    }
    await shot(page, 'pages-1');

    // Points : souris, puis clavier.
    await page.getByRole('button', { name: 'Aller à la page 2' }).click();
    await page.waitForFunction(() => Math.abs(document.getElementById('board').scrollLeft - document.getElementById('board').clientWidth) < 2);
    assert.equal(await page.getByRole('button', { name: 'Aller à la page 2' }).getAttribute('aria-current'), 'page');
    await shot(page, 'pages-2');
    await page.getByRole('button', { name: 'Aller à la page 2' }).press('ArrowLeft');
    await page.waitForFunction(() => document.getElementById('board').scrollLeft < 2);
    assert.ok(await page.getByRole('button', { name: 'Aller à la page 1' }).evaluate(b => b === document.activeElement && b.getAttribute('aria-current') === 'page'));
    // La molette verticale ne change pas de page.
    await page.mouse.move(800, 500);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(300);
    assert.equal((await grid(page)).sl, 0, 'la molette verticale ne tourne pas les pages');

    // I. Appui long sur le fond (une case vide de la dernière page) : la roue des modes, pas l'édition.
    // La dernière page, qui a forcément une case libre (4 widgets au plus par page, et plus grands).
    const last = places('p1').n - 1;
    await page.getByRole('button', { name: `Aller à la page ${last + 1}` }).click();
    await page.waitForFunction(n => Math.abs(document.getElementById('board').scrollLeft - n * document.getElementById('board').clientWidth) < 2, last);
    const g2 = await grid(page);
    const used = Object.values(places('p1').d).filter(q => q.p === last);
    const [fc, fr] = [...Array(72).keys()].map(i => [i % 12, Math.floor(i / 12)]).find(([c, r]) => !used.some(q => c >= q.c && c < q.c + q.w && r >= q.r && r < q.r + q.h));
    await longPress(page, g2.left + (fc + 0.5) * (g2.cw + g2.gap), g2.top + (fr + 0.5) * (g2.ch + g2.gap));
    await page.mouse.up();
    assert.equal(await wheelOpen(page), true, 'la roue s\'ouvre sur le fond');
    assert.equal(await editing(page), false, 'pas d\'édition depuis le fond');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog.mode-wheel[open]'));
    // Retour à la page du widget Tâches pour la suite.
    const pt = places('p1').d.taches.p;
    await page.getByRole('button', { name: `Aller à la page ${pt + 1}` }).click();
    await page.waitForFunction(n => Math.abs(document.getElementById('board').scrollLeft - n * document.getElementById('board').clientWidth) < 2, pt);

    // Appui trop court ou qui bouge sur un widget : rien.
    const head = await page.locator(`${W('taches')} .head h2`).boundingBox();
    await longPress(page, head.x + 4, head.y + 4, 250);
    await page.mouse.up();
    assert.equal(await editing(page), false, 'appui court : rien');
    // Un bouton du widget garde son clic, même tenu longtemps.
    const add = await page.locator(W('taches')).getByRole('button', { name: 'Ajouter' }).boundingBox();
    await longPress(page, add.x + 5, add.y + 5);
    await page.mouse.up();
    assert.equal(await editing(page), false, 'un bouton ne lance pas l\'édition');

    // C. Appui long sur un widget : édition, et la roue ne s'ouvre pas.
    await longPress(page, head.x + 4, head.y + 4);
    assert.equal(await editing(page), true, 'appui long sur un widget : édition');
    await page.mouse.up();
    assert.equal(await wheelOpen(page), false, 'jamais les deux gestes');
    assert.equal(await page.getByRole('button', { name: 'Terminer' }).isVisible(), true);
    assert.ok(await page.locator('.pg-cell').count() > 0, 'les cases apparaissent');
    await shot(page, 'pages-3-edition');

    // Déplacer « Compte à rebours » sur une case libre de sa page (la 3e : Notes et lui occupent le haut).
    const before = { ...places('p1').d.compte };
    await page.getByRole('button', { name: `Aller à la page ${before.p + 1}` }).click();
    await page.waitForFunction(n => Math.abs(document.getElementById('board').scrollLeft - n * document.getElementById('board').clientWidth) < 2, before.p);
    await dragTo(page, 'compte', 6, 3);
    await saved(page);
    assert.deepEqual(places('p1').d.compte, { ...before, c: 6, r: 3 }, 'posé sur la case visée');
    noOverlap(places('p1').d);

    // Place occupée : signalée pendant le geste, refusée au lâcher, rien d'enregistré.
    const saves = dbOf('p1').saves;
    await dragTo(page, 'compte', 0, 0, { drop: false });
    assert.equal(await page.locator('.pg-drop.bad').isVisible(), true, 'la place occupée est signalée');
    await shot(page, 'pages-4-refus');
    await page.mouse.up();
    await page.waitForTimeout(400);
    assert.deepEqual(places('p1').d.compte, { ...before, c: 6, r: 3 }, 'rien n\'a bougé');
    assert.equal(dbOf('p1').saves, saves, 'rien n\'a été enregistré');

    // Redimensionner à la poignée : la taille suit les cases ; vers un voisin, c'est refusé.
    const grip = await page.locator(`${W('compte')} .pg-size`).boundingBox();
    const g3 = await grid(page);
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 - (g3.ch + g3.gap), { steps: 5 });
    await page.mouse.up();
    await saved(page);
    assert.equal(places('p1').d.compte.h, before.h - 1, 'une rangée de moins');
    const grip2 = await page.locator(`${W('compte')} .pg-size`).boundingBox();
    await page.mouse.move(grip2.x + 10, grip2.y + 10);
    await page.mouse.down();
    await page.mouse.move(grip2.x + 10, grip2.y - 3 * (g3.ch + g3.gap), { steps: 5 });
    await page.mouse.up();
    assert.equal(places('p1').d.compte.h, before.h - 1, 'jamais sous la taille minimale');
    const w0 = (await page.locator(W('compte')).boundingBox()).width;
    await page.mouse.move(grip2.x + 10, grip2.y + 10);
    await page.mouse.down();
    await page.mouse.move(grip2.x + 10 + 2 * (g3.cw + g3.gap), grip2.y + 10, { steps: 5 });
    await page.mouse.up();
    await saved(page);
    assert.equal(places('p1').d.compte.w, before.w, 'contre le bord de la page, la largeur s\'arrête');
    assert.ok(Math.abs((await page.locator(W('compte')).boundingBox()).width - w0) < 2);
    noOverlap(places('p1').d);

    // Clavier : flèches pour changer de case, Maj + flèches pour la taille ; une place prise est annoncée.
    const move = page.getByRole('button', { name: /^Déplacer Compte à rebours/ });
    await move.focus();
    await page.keyboard.press('ArrowLeft');
    await saved(page);
    assert.equal(places('p1').d.compte.c, 5);
    await page.keyboard.press('Shift+ArrowDown');
    await saved(page);
    assert.equal(places('p1').d.compte.h, before.h);
    await page.keyboard.press('ArrowUp');
    assert.match(await page.locator('#custom-live').textContent(), /Place occupée/);
    assert.equal(places('p1').d.compte.r, 3);

    // Échap termine l'édition ; la disposition reste après rechargement, chaque widget une seule fois.
    await page.keyboard.press('Escape');
    assert.equal(await editing(page), false);
    const kept = structuredClone(places('p1'));
    await page.reload();
    await page.waitForSelector('.board[data-vue=pages]');
    await settle(page);
    assert.deepEqual(places('p1'), kept, 'rien ne change au rechargement');
    assert.equal(await page.locator(W('compte')).count(), 1, 'une seule fois');
    const g4 = await grid(page);
    const cb = await page.locator(W('compte')).evaluate(e => e.offsetLeft);
    assert.ok(Math.abs(cb - (places('p1').d.compte.p * 12 + places('p1').d.compte.c) * (g4.cw + g4.gap)) < 2, 'à sa place après rechargement');
    await context.close();
  }

  // G. Un minuteur lancé continue d'une page à l'autre et à travers la vue agrandie ; « Disposer les widgets » et Terminer.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'p2');
    await choosePages(page);
    await page.locator(W('minuteur')).getByRole('button', { name: 'Démarrer' }).click();
    await page.evaluate(() => { window.firstEngine = window.renzviMinuteurLive; });
    await page.getByRole('button', { name: 'Aller à la page 2' }).click();
    await page.waitForFunction(() => document.getElementById('board').scrollLeft > 100);
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Aller à la page 1' }).click();
    await page.waitForFunction(() => document.getElementById('board').scrollLeft < 2);
    assert.equal(await page.evaluate(() => window.renzviMinuteurLive()?.state), 'run');
    const where = await page.locator(W('minuteur')).evaluate(e => [e.offsetLeft, e.offsetTop, e.offsetWidth, e.offsetHeight]);
    await page.locator(`${W('minuteur')} .zoom`).focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector(`${W('minuteur')}.zoomed`);
    await settle(page);
    const z = await page.locator(W('minuteur')).boundingBox();
    assert.ok(z.width > 1300 && z.height > 800, 'agrandi sur toute l\'appli, même dans les pages');
    assert.equal(await page.locator('.pg-dots').evaluate(d => d.inert), true, 'les points sont inactifs derrière');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.widget.zoomed'));
    assert.deepEqual(await page.locator(W('minuteur')).evaluate(e => [e.offsetLeft, e.offsetTop, e.offsetWidth, e.offsetHeight]), where, 'retour à sa case');
    assert.ok(await page.evaluate(() => window.renzviMinuteurLive === window.firstEngine && window.renzviMinuteurLive().state === 'run'), 'même minuteur, toujours en marche');
    // « Disposer les widgets » (Personnaliser) ouvre la même édition.
    await page.evaluate(() => document.getElementById('open-custom').click());
    await page.locator('#layout-edit').click();
    assert.equal(await editing(page), true, '« Disposer les widgets » ouvre l\'édition des pages');
    assert.equal(await page.locator('#custom').isVisible(), false, 'pas l\'ancienne barre');
    await page.getByRole('button', { name: 'Terminer' }).click();
    assert.equal(await editing(page), false);
    // Panne d'enregistrement : la nouvelle place reste affichée, l'état le dit, rien n'est perdu au retour du réseau.
    dbOf('p2').panne = true;
    await page.locator('#layout-edit').evaluate(b => b.click());
    await page.getByRole('button', { name: /^Déplacer Compte à rebours/ }).focus();
    await page.getByRole('button', { name: `Aller à la page ${places('p2').d.compte.p + 1}` }).click().catch(() => {});
    // Compte à rebours touche le bord droit (widgets plus larges) : il descend d'une rangée.
    await page.getByRole('button', { name: /^Déplacer Compte à rebours/ }).press('ArrowDown');
    await page.waitForFunction(() => /Pas encore enregistré/.test(document.getElementById('saved').textContent));
    dbOf('p2').panne = false;
    await saved(page);
    assert.equal(places('p2').d.compte.r, 1, 'enregistré au retour');
    await context.close();
  }

  // Téléphone : chaque page garde ses widgets (un par rangée, toute la largeur), points, pas d'édition, rien ne déborde.
  {
    const { page, context } = await open({ width: 390, height: 844 }, 'p3');
    await choosePages(page).catch(async () => {
      // Sur téléphone, le choix de présentation est dans l'en-tête aussi.
      throw new Error('sélecteur de présentation introuvable sur téléphone');
    });
    const g = await grid(page);
    const w = await page.locator(W('cahier')).boundingBox();
    assert.ok(Math.abs(w.width - (g.W - g.gap)) < 3, 'toute la largeur');
    await until(() => dbOf('p3').rows.ecran?.vues?.places?.pages?.study, 'places enregistrées');
    // Les mêmes pages que sur l'ordinateur (les points représentent les pages du mode), widgets empilés dans chacune.
    assert.equal(await page.locator('.pg-dot').count(), places('p3').n, 'mêmes pages que sur l’ordinateur');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, 'rien ne déborde');
    const head = await page.locator(`${W('cahier')} .head h2`).boundingBox();
    await longPress(page, head.x + 4, head.y + 4);
    await page.mouse.up();
    assert.equal(await editing(page), false, 'pas d\'édition sur téléphone pour l\'instant');
    await shot(page, 'pages-telephone');
    await context.close();
  }

  assert.deepEqual(errors, []);
  console.log('pages : tous les parcours passent');
  await browser.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
