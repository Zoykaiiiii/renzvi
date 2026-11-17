// Mon espace Study posé sur le fond d'écran (brief du 16 nov.) : aperçu réel dans le widget, scène sans fond plein,
// encre selon le fond, caméra qui cadre une branche et s'approche d'un chapitre ou d'une étoile à côté du panneau,
// retour au tableau intact, téléphone. Sur le banc Study (tests/etude-harness.cjs, base simulée, comptes de test).
// Lancement : NODE_PATH=~/pw/node_modules node tests/etude-scene.check.cjs   (SHOTS=dossier : captures et vidéo)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { server, makeDb, course, openBoard } = require('./etude-harness.cjs');

const SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page, name, opts = {}) => SHOTS ? page.screenshot({ path: `${SHOTS}/${name}.png`, ...opts }) : null;
const settle = page => page.waitForFunction(() => ![...document.querySelectorAll('.arbre-world,.cst-world,.etude-space')].some(n => n.getAnimations().length));

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
  const W = page => page.locator('[data-widget=etude]');
  const k = page => page.locator('.etude-open :is(.arbre-world,.cst-world)').evaluate(n => +n.style.transform.match(/scale\(([\d.]+)\)/)[1]);
  // Le chapitre choisi est-il dans la place libre (pas sous le panneau ni hors de l'écran) ?
  const beside = (page, sel) => page.evaluate(sel => {
    const t = document.querySelector(sel).getBoundingClientRect(), p = document.querySelector('.etude-panel').getBoundingClientRect();
    const x = t.left + 6, y = t.top + t.height / 2;
    const under = x >= p.left && x <= p.right && y >= p.top && y <= p.bottom;
    return !under && x > 0 && x < innerWidth && y > 0 && y < innerHeight;
  }, sel);

  // 1. Aperçu réel (un cours, quatre chapitres, aucun paquet), puis Constellations.
  {
    const db = makeDb('vide');
    const c = course('Biologie', 'La cellule', ['La membrane', 'Le noyau', 'Les mitochondries et l’énergie de la cellule, un titre long', 'Le noyau et l’ADN']);
    db.courses.push(c.row);
    db.files[`cours/u1/${c.row.id}/texte.json`] = JSON.stringify({ v: 1, pages: [c.text] });
    db.rows.ecran = { ...db.rows.ecran, wallpaper: 'brume', widgets: ['etude', 'minuteur', 'notes'], sizes: { etude: 'm' } };
    const { page, context } = await openBoard(browser, base, db, SHOTS ? { recordVideo: { dir: SHOTS, size: { width: 1440, height: 900 } } } : {});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message + ' ' + (e.stack ?? '').split('\n').slice(1, 4).join(' | ')));
    await page.waitForSelector('[data-widget=etude] .etude-preview .arbre-wood');
    assert.equal(await W(page).locator('.etude-preview .arbre-chapitre').count(), 4, 'les vrais chapitres');
    assert.match(await W(page).locator('.etude-sum').textContent(), /^1 cours · 4 chapitres$/, 'pas de paquet inventé');
    assert.equal(await W(page).locator('.etude-preview button:not([tabindex="-1"])').count(), 0, 'aperçu en lecture seule');
    const before = await W(page).boundingBox();
    if (SHOTS) await W(page).screenshot({ path: `${SHOTS}/1-apercu-arbre.png` });
    await W(page).getByRole('button', { name: 'Constellations', exact: true }).click();
    await page.waitForSelector('[data-widget=etude] .etude-preview .cst-star');
    if (SHOTS) await W(page).screenshot({ path: `${SHOTS}/2-apercu-constellations.png` });
    await W(page).getByRole('button', { name: 'Arbre', exact: true }).click();
    await page.waitForSelector('[data-widget=etude] .etude-preview .arbre-wood');

    // 2. Ouvrir : le fond d'écran reste, aucun fond plein, les autres widgets cachés mais gardés.
    const wall = await page.locator('#wall i').last().getAttribute('data-src');
    await W(page).getByRole('button', { name: 'Ouvrir mon espace' }).click();
    await page.waitForSelector('.etude-open .arbre-chapitre');
    await settle(page);
    assert.equal(await page.locator('#wall i').last().getAttribute('data-src'), wall, 'même fond');
    assert.equal(await W(page).evaluate(n => getComputedStyle(n).backgroundColor), 'rgba(0, 0, 0, 0)', 'pas de fond plein');
    assert.equal(await page.locator('[data-widget=notes]').evaluate(n => getComputedStyle(n).visibility), 'hidden', 'les autres widgets sont cachés');
    assert.equal(await page.locator('[data-widget=notes]').count(), 1, 'rien n’est retiré');
    assert.equal(await page.evaluate(() => document.fullscreenElement), null, 'pas de plein écran du navigateur');
    await page.waitForFunction(() => document.querySelector('[data-widget=etude]').dataset.contraste);
    assert.equal(await W(page).getAttribute('data-contraste'), 'sombre', 'encre claire sur ce fond sombre');
    await shot(page, '3-arbre-sur-le-fond');

    // 3. Un chapitre : la caméra s'en approche, il reste à côté du panneau. Le même encore : pas de zoom en plus.
    const target = '.etude-open .arbre-chapitre[data-key$="/c1"]';
    await page.locator(target).click();
    await settle(page);
    assert.equal(await page.locator('.etude-panel h3').textContent(), 'Le noyau');
    assert.ok(await beside(page, target), 'le chapitre reste visible à côté du panneau');
    const k1 = await k(page);
    assert.ok(k1 >= 1.1, `rapproché (${k1})`);
    await page.locator(target).click();
    await settle(page);
    assert.equal(await k(page), k1, 'choisir encore ne zoome pas plus');
    await shot(page, '4-chapitre-et-panneau');
    // Sélections rapides : la dernière gagne.
    for (const c of ['c0', 'c2', 'c3']) await page.locator(`.etude-open .arbre-chapitre[data-key$="/${c}"]`).click();
    await settle(page);
    assert.equal(await page.locator('.etude-panel h3').textContent(), 'Le noyau et l’ADN');
    assert.ok(await beside(page, '.etude-open .arbre-chapitre[data-key$="/c3"]'), 'la dernière sélection est cadrée');

    // 4. Lire, puis revenir : même chapitre, même cadrage.
    const view = await page.locator('.arbre-world').evaluate(n => n.style.transform);
    await page.locator('.etude-panel').getByRole('button', { name: 'Ouvrir le cahier' }).click();
    await page.waitForSelector('.etude-sheet.cahier-open .cahier-text');
    assert.match(await page.locator('.etude-sheet .cahier-text').textContent(), /noyau et l’adn/i, 'le carnet s’ouvre au chapitre choisi');
    await page.waitForFunction(() => !document.querySelector('.etude-sheet').getAnimations().length);
    await shot(page, '4b-cahier-depuis-larbre');
    await page.getByRole('button', { name: 'Retour à l’arbre' }).click();
    await page.waitForSelector('.etude-sheet', { state: 'detached' });
    assert.equal(await page.locator('.etude-panel h3').textContent(), 'Le noyau et l’ADN');
    assert.equal(await page.locator('.arbre-world').evaluate(n => n.style.transform), view, 'même cadrage au retour');

    // 5. Vue d'ensemble, puis Constellations : une étoile s'approche et ouvre le bon chapitre.
    await page.getByRole('button', { name: 'Voir tout l’arbre' }).click();
    await settle(page);
    assert.ok(await k(page) < k1, 'vue d’ensemble');
    await page.locator('.etude-tabs').getByRole('button', { name: 'Constellations' }).click();
    await page.waitForSelector('.etude-open .cst-chap');
    await settle(page);
    assert.equal(await page.locator('.cst-sky, .cst-hills').count(), 0, 'aucun ciel ajouté');
    await shot(page, '5-constellations-sur-le-fond');
    const star = '.etude-open .cst-chap[data-key$="/c1"]';
    await page.locator(`${star} .cst-hit`).click();
    await settle(page);
    assert.equal(await page.locator('.etude-panel h3').textContent(), 'Le noyau');
    assert.ok(await beside(page, `${star} .cst-hit`), 'l’étoile reste visible à côté du panneau');
    await shot(page, '6-etoile-et-panneau');

    // 6. Retour au tableau : même page, même taille de widget, focus sur le bouton d'ouverture.
    await page.getByRole('button', { name: 'Retour au tableau' }).click();
    await page.waitForSelector('.etude-space', { state: 'hidden' });
    assert.equal(await page.locator('[data-widget=notes]').evaluate(n => getComputedStyle(n).visibility), 'visible');
    const after = await W(page).boundingBox();
    assert.deepEqual([after.width, after.height].map(Math.round), [before.width, before.height].map(Math.round), 'même taille de widget');
    assert.equal(await page.evaluate(() => document.body.classList.contains('etude-scene')), false);
    assert.ok(await W(page).getByRole('button', { name: 'Ouvrir mon espace' }).evaluate(n => n === document.activeElement), 'focus rendu');
    await page.waitForSelector('[data-widget=etude] .etude-preview .cst-star');
    assert.deepEqual(errors, []);
    await context.close();
    console.log('ok aperçu, fond gardé, caméra, panneau, retour');
  }

  // 7. Fond clair (fond blanc, thème clair) : encre sombre.
  {
    const db = makeDb('un');
    db.rows.ecran = { ...db.rows.ecran, wallpaper: 'blanc' };
    const { page, context } = await openBoard(browser, base, db);
    await page.waitForSelector('[data-widget=etude] .etude-preview .arbre-wood');
    await W(page).getByRole('button', { name: 'Ouvrir mon espace' }).click();
    await page.waitForFunction(() => document.querySelector('[data-widget=etude]').dataset.contraste);
    await settle(page);
    const ink = await page.locator('.arbre-wood').evaluate(n => getComputedStyle(n).fill);
    const mode = await W(page).getAttribute('data-contraste');
    assert.deepEqual([mode, ink], ['clair', 'rgb(29, 28, 26)'], 'fond clair : encre sombre');
    await shot(page, '7-fond-clair');
    await context.close();
    console.log(`ok fond ${mode}`);
  }

  // 8. Téléphone : panneau en bas, le chapitre reste au-dessus ; compte vide : aperçu honnête et import.
  {
    const db = makeDb('plein');
    db.rows.ecran = { ...db.rows.ecran, wallpaper: 'brume' };
    const { page, context } = await openBoard(browser, base, db, { viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.waitForSelector('[data-widget=etude] .etude-preview .arbre-wood');
    await W(page).getByRole('button', { name: 'Ouvrir mon espace' }).click();
    await page.waitForSelector('.etude-open .arbre-chapitre');
    const t = '.etude-open .arbre-chapitre[data-key$="/c1"]';
    await page.locator(t).first().tap();
    await settle(page);
    assert.ok(await beside(page, t), 'au-dessus du panneau');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 390), 'pas de défilement horizontal');
    await shot(page, '8-telephone');
    await context.close();
    const v = await openBoard(browser, base, makeDb('vide'));
    await v.page.waitForSelector('.etude-preview-vide');
    assert.match(await W(v.page).innerText(), /Aucun cours pour l’instant/);
    assert.equal(await W(v.page).locator('.arbre-chapitre').count(), 0, 'aucun faux cours');
    await v.context.close();
    console.log('ok téléphone et compte vide');
  }

  await browser.close();
  server.close();
  console.log('etude-scene : tout passe');
})().catch(e => { console.error(e); process.exit(1); });
