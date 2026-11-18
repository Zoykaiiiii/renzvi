// Vérifie la présentation « Constellations » de l'espace Study (labo ?labo=1) dans un vrai Chromium, Supabase simulé
// (tests/etude-harness.cjs) : ciel tiré des vrais cours, étoiles de contenu distinctes du décor, panneau en onglets,
// association → révision → retour au même endroit, entraînement libre sans écriture, rechargement, placement stable,
// cadrage d'une matière, recherche, contenu dense sans chevauchement, clavier, téléphone, minuteur, mouvement réduit.
// Lancement : NODE_PATH=<dossier node_modules contenant playwright> node tests/constellations.check.cjs   (captures : SHOTS=dossier)
const assert = require('node:assert');
const { chromium } = require('playwright');
const { server, makeDb, openBoard, shot, openSpace } = require('./etude-harness.cjs');

const world = page => page.locator('.cst-world').evaluate(n => n.style.transform);
const star = (page, name) => page.locator('.cst-chap', { hasText: name });
const pick = (page, name) => star(page, name).dispatchEvent('click'); // un clic sur l'étoile, où qu'elle soit dans le ciel
const stars = page => page.locator('.cst-chap').evaluateAll(all => Object.fromEntries(all.map(b => [b.dataset.key, `${b.style.left} ${b.style.top}`])));
async function toSky(page) {
  await page.getByRole('button', { name: 'Constellations', exact: true }).click();
  await page.waitForSelector('.cst-chap');
}
// Les noms visibles ne se chevauchent pas (tolérance de 2 px pour l'arrondi).
const overlaps = page => page.locator('.cst-txt, .cst-label').evaluateAll(all => {
  const r = all.filter(n => n.checkVisibility({ visibilityProperty: true })).map(n => n.getBoundingClientRect()).filter(b => b.width && b.height);
  let n = 0;
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    const a = r[i], b = r[j];
    if (a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2) n++;
  }
  return n;
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    // 1. Le ciel vient des vrais cours : une étoile par chapitre, une constellation par cours, le décor à part.
    const db = makeDb();
    let { context, page, errors } = await openBoard(browser, base, db);
    await page.waitForSelector('[data-widget=etude] .etude-sum');
    await openSpace(page);
    await toSky(page);
    assert.strictEqual(await page.locator('.cst-chap').count(), 10, 'une étoile par chapitre');
    assert.deepStrictEqual(await page.locator('.cst-matiere span').allTextContents(), ['Biologie', 'Histoire', 'Mathématiques']);
    assert.strictEqual(await page.locator('.cst-svg .cst-line').evaluate(p => (p.getAttribute('d').match(/M/g) ?? []).length), 3, 'un trait par cours, aucun entre cours différents');
    assert.strictEqual(await page.locator('.cst-sky, .cst-hills').count(), 0, 'aucun ciel ajouté : le fond d’écran reste le ciel');
    { const w = (await page.locator('.cst-chap .cst-hit').first().boundingBox()).width; assert.ok(w >= 43.5, `cible de 44 px (${w})`); }
    assert.strictEqual(await page.locator('[data-widget=etude]').evaluate(n => getComputedStyle(n).backgroundColor), 'rgba(0, 0, 0, 0)', 'aucun fond plein : le fond d’écran reste visible');
    assert.strictEqual(await overlaps(page), 0, 'aucun nom ne chevauche un autre');
    await shot(page, 'ciel-1440');
    console.log('ok ciel dessiné depuis les cours');

    // 2. Choisir une étoile : panneau en onglets, extrait réel, fermeture visible.
    const chapter = star(page, 'La membrane');
    const wasQuiet = await chapter.evaluate(el => el.classList.contains('cst-quiet'));
    if (!wasQuiet) await chapter.evaluate(el => el.classList.add('cst-quiet'));
    await chapter.locator('.cst-hit').hover();
    assert.equal(await chapter.locator('.cst-txt').isVisible(), false);
    assert.equal(await chapter.getAttribute('title'), null);
    if (!wasQuiet) await chapter.evaluate(el => el.classList.remove('cst-quiet'));
    await pick(page, 'La membrane');
    assert.strictEqual(await page.locator('.etude-panel h3').textContent(), 'La membrane');
    assert.strictEqual(await page.locator('.etude-panel .etude-crumb').textContent(), 'Biologie / La cellule');
    assert.match(await page.locator('.etude-where').textContent(), /Chapitre 1 sur 4/);
    await page.waitForFunction(() => /présente la membrane/.test(document.querySelector('.etude-quote')?.textContent ?? ''));
    assert.strictEqual(await star(page, 'La membrane').getAttribute('aria-current'), 'true');
    assert.strictEqual(await page.locator('.cst-ring').count(), 1, 'une seule étoile entourée');
    await shot(page, 'ciel-chapitre');
    // Clavier sur les onglets : flèche droite → Notes.
    await page.getByRole('tab', { name: 'Lire' }).focus();
    await page.keyboard.press('ArrowRight');
    assert.strictEqual(await page.getByRole('tab', { name: 'Notes' }).getAttribute('aria-selected'), 'true');
    assert.match(await page.locator('.etude-pbody').textContent(), /Aucune note/);
    await page.keyboard.press('ArrowRight');
    assert.match(await page.locator('.etude-pbody').textContent(), /Aucun paquet associé/);
    console.log('ok panneau et onglets');

    // 3. Associer un paquet : annuler ne change rien ; associer référence le paquet sans copier de carte.
    await page.getByRole('button', { name: 'Associer un paquet de flashcards' }).click();
    assert.strictEqual(await page.locator('.etude-picker h3').textContent(), 'Associer un paquet');
    assert.match(await page.locator('.etude-picker .etude-crumb').textContent(), /La membrane/);
    await page.locator('.etude-picker').getByText('Biologie cellulaire').click();
    await page.locator('.etude-picker').getByRole('button', { name: 'Annuler' }).click();
    assert.strictEqual(db.links.length, 0, 'annuler ne crée rien');
    await page.getByRole('button', { name: 'Associer un paquet de flashcards' }).click();
    await page.locator('.etude-picker').getByText('Biologie cellulaire').click();
    db.failLinks = true;
    await page.locator('.etude-picker').getByRole('button', { name: 'Associer', exact: true }).click();
    await page.waitForSelector('.etude-picker .etude-status.bad');
    assert.strictEqual(db.links.length, 0, 'une panne ne passe pas pour une réussite');
    db.failLinks = false;
    await page.locator('.etude-picker').getByRole('button', { name: 'Associer', exact: true }).click();
    await page.waitForSelector('.etude-flash');
    assert.strictEqual(db.links.length, 1);
    assert.strictEqual(db.cards.length, 5, 'aucune carte copiée');
    assert.match(await page.locator('.etude-flash').textContent(), /3 cartes · 2 à revoir/, 'total et cartes dues distingués');
    await page.waitForSelector('.cst-chap .cst-due');
    assert.strictEqual(await star(page, 'La membrane').locator('.cst-due').textContent(), '2 à revoir', 'l’étoile montre les cartes dues');
    await shot(page, 'ciel-reviser');
    console.log('ok association');

    // 4. Réviser : ouvrir n'écrit rien, une réponse compte une fois, retour au même ciel, même étoile, même focus.
    const before = await world(page);
    const dues = JSON.stringify(db.cards.map(c => c.due));
    await page.getByRole('button', { name: 'Réviser mes cartes' }).click();
    await page.waitForSelector('.etude-sheet .cartes-card');
    assert.strictEqual(JSON.stringify(db.cards.map(c => c.due)), dues, 'ouvrir le paquet ne change aucune échéance');
    await page.getByRole('button', { name: 'Voir la réponse' }).click();
    await shot(page, 'ciel-revision');
    await page.locator('.etude-sheet .revisions-rate', { hasText: 'Bien' }).dblclick();
    await page.waitForFunction(() => !document.querySelector('.etude-sheet .revisions-rate'));
    assert.strictEqual(db.reviews.length, 1, 'une réponse, enregistrée une fois');
    await page.getByRole('button', { name: '← Retour' }).click();
    await page.waitForFunction(() => document.activeElement?.dataset.key === 'reviser');
    assert.strictEqual(await world(page), before, 'même position et même zoom au retour');
    assert.strictEqual(await star(page, 'La membrane').getAttribute('aria-current'), 'true');
    assert.match(await page.locator('.etude-flash').textContent(), /1 à revoir/, 'compte rafraîchi');
    assert.strictEqual(await star(page, 'La membrane').locator('.cst-due').textContent(), '1 à revoir');
    console.log('ok révision et retour au même endroit');

    // 5. S'entraîner : les cartes défilent, rien n'est enregistré, le planning ne bouge pas.
    const dues2 = JSON.stringify(db.cards.map(c => c.due));
    await page.getByRole('button', { name: 'S’entraîner sans changer le planning' }).click();
    await page.waitForSelector('.etude-sheet .cartes-card');
    assert.match(await page.locator('.etude-sheet').textContent(), /Entraînement libre : tes réponses ne sont pas enregistrées/);
    await page.getByRole('button', { name: 'Voir la réponse' }).click();
    assert.strictEqual(await page.locator('.etude-sheet .revisions-rate').count(), 0, 'pas de note en entraînement');
    for (let i = 0; i < 3; i++) await page.locator('.etude-sheet .cartes-rate button').first().click().then(() => page.locator('.etude-sheet').getByRole('button', { name: 'Voir la réponse' }).click({ timeout: 800 }).catch(() => {}));
    await page.waitForSelector('.etude-sheet .cartes-done');
    assert.strictEqual(db.reviews.length, 1, 'aucune réponse enregistrée');
    assert.strictEqual(JSON.stringify(db.cards.map(c => c.due)), dues2, 'planning inchangé');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.dataset.key === 'libre');
    console.log('ok entraînement libre');

    // 6. Minuteur : le dock pilote le vrai minuteur, qui continue pendant la navigation ; aucun son ne démarre.
    await page.locator('.etude-dock .etude-tool').first().click();
    assert.strictEqual(await page.evaluate(() => window.renzviMinuteurLive().state), 'run');
    await page.getByRole('button', { name: 'Réviser mes cartes' }).click();
    await page.getByRole('button', { name: '← Retour' }).click();
    await page.getByRole('button', { name: 'Arbre', exact: true }).click();
    await page.waitForSelector('.arbre-chapitre');
    await toSky(page);
    await page.waitForTimeout(1100);
    const t = await page.evaluate(() => window.renzviMinuteurLive());
    assert.ok(t.state === 'run' && t.ms < 1500000 - 1000, 'le minuteur a continué');
    assert.strictEqual(await page.evaluate(() => [...document.querySelectorAll('audio')].some(a => !a.paused)), false, 'aucun son lancé');
    await page.locator('.etude-dock .etude-tool').first().click();
    console.log('ok minuteur continu');

    // 7. Changer de présentation garde la sélection ; chaque présentation garde son propre cadrage ; rechargement.
    assert.strictEqual(await page.locator('.etude-panel h3').textContent(), 'La membrane');
    assert.strictEqual(await world(page), before, 'le ciel retrouve son cadrage après un passage par l’Arbre');
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForSelector('[data-widget=etude] .etude-sum');
    await openSpace(page);
    await page.waitForSelector('.cst-chap[aria-current]');
    assert.strictEqual(await world(page), before, 'même cadrage après rechargement');
    assert.strictEqual(await page.getByRole('tab', { name: 'Réviser' }).getAttribute('aria-selected'), 'true', 'même onglet');
    console.log('ok rechargement');

    // 8. Placement stable : un chapitre ajouté ne déplace aucune autre étoile.
    const was = await stars(page);
    db.courses[1].chapters.push({ id: 'c9', title: 'Le Directoire', page: 0, offset: 0 });
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('renzvi:cours')));
    await star(page, 'Le Directoire').waitFor();
    const now = await stars(page);
    for (const [key, at] of Object.entries(was)) assert.strictEqual(now[key], at, `${key} n'a pas bougé`);
    console.log('ok placement stable');

    // 9. Cadrer une matière, tout voir, chercher, fermer le chapitre.
    await page.locator('.cst-matiere', { hasText: 'Mathématiques' }).click();
    await page.waitForTimeout(600);
    const vp = page.viewportSize();
    for (const name of ['Définitions', 'Dérivées', 'Limites']) {
      const b = await star(page, name).locator('.cst-hit').boundingBox();
      assert.ok(b.x > 0 && b.x + b.width < vp.width - 380 && b.y > 50 && b.y + b.height < vp.height, `${name} visible après cadrage`);
    }
    await page.getByRole('button', { name: 'Voir tout le ciel' }).click();
    await page.locator('.etude-search').fill('terreur');
    await page.locator('.etude-results button').first().click();
    assert.strictEqual(await page.locator('.etude-panel h3').textContent(), 'La Terreur');
    await page.getByRole('button', { name: 'Fermer le chapitre' }).click();
    assert.strictEqual(await page.locator('.etude-panel h3').textContent(), 'Choisis un chapitre');
    assert.strictEqual(await page.locator('.cst-chap[aria-current]').count(), 0);
    assert.strictEqual(await page.evaluate(() => document.activeElement?.dataset.key?.endsWith('/c2')), true, 'le focus revient sur l’étoile');
    // Au clavier : Entrée sur l'étoile la choisit.
    await page.keyboard.press('Enter');
    assert.strictEqual(await page.locator('.etude-panel h3').textContent(), 'La Terreur');
    assert.deepStrictEqual(errors, []);
    await context.close();
    console.log('ok cadrage, recherche, fermeture, clavier');

    // 10. Contenu dense : cours repliés, noms sans chevauchement, un cours se déplie.
    ({ context, page, errors } = await openBoard(browser, base, makeDb('dense')));
    await page.waitForSelector('[data-widget=etude] .etude-sum');
    await openSpace(page);
    await page.getByRole('button', { name: 'Constellations', exact: true }).click();
    await page.waitForSelector('.cst-cours');
    assert.strictEqual(await page.locator('.cst-chap').count(), 0, 'au-delà de 24 chapitres, les cours se replient');
    assert.strictEqual(await page.locator('.cst-cours').count(), 9);
    assert.strictEqual(await overlaps(page), 0, 'dense : aucun chevauchement');
    await shot(page, 'ciel-dense');
    await page.locator('.cst-cours').first().click();
    await page.waitForSelector('.cst-chap');
    assert.strictEqual(await page.locator('.cst-chap').count(), 7, 'un cours déplié montre ses chapitres');
    assert.strictEqual(await overlaps(page), 0, 'déplié : aucun chevauchement');
    assert.deepStrictEqual(errors, []);
    await context.close();
    console.log('ok contenu dense');

    // 11. Compte vide : un état clair, pas un ciel vide.
    ({ context, page, errors } = await openBoard(browser, base, makeDb('vide')));
    await page.waitForSelector('[data-widget=etude] .etude-sum');
    await openSpace(page);
    await page.getByRole('button', { name: 'Constellations', exact: true }).click();
    await page.waitForFunction(() => /ciel/.test(document.querySelector('.etude-empty h3')?.textContent ?? ''));
    assert.match(await page.locator('.etude-empty h3').textContent(), /ciel/);
    await context.close();
    console.log('ok compte vide');

    // 12. Téléphone : cibles de 44 px, contrôles visibles, panneau en bas, le dock ne cache aucune étoile.
    ({ context, page, errors } = await openBoard(browser, base, makeDb(), { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }));
    await page.waitForSelector('[data-widget=etude] .etude-sum');
    await openSpace(page);
    await page.getByRole('button', { name: 'Constellations', exact: true }).tap();
    await page.waitForSelector('.cst-chap');
    await page.waitForTimeout(300);
    assert.ok(await page.getByRole('button', { name: 'Voir tout le ciel' }).isVisible(), 'contrôles visibles');
    await star(page, 'La membrane').locator('.cst-hit').tap();
    assert.strictEqual(await page.locator('.etude-panel h3').textContent(), 'La membrane');
    const dock = await page.locator('.etude-dock').boundingBox(), pane = await page.locator('.etude-panel').boundingBox();
    assert.ok(pane.y > 844 * .45, 'panneau en bas de l’écran');
    // L'étoile choisie reste visible : ni sous le dock, ni sous le panneau.
    await page.waitForTimeout(500);
    const sel = await page.locator('.cst-chap[aria-current] .cst-hit').boundingBox(), cx = sel.x + sel.width / 2, cy = sel.y + sel.height / 2;
    assert.ok(cy < pane.y, 'au-dessus du panneau');
    assert.ok(!(cx > dock.x && cx < dock.x + dock.width && cy > dock.y && cy < dock.y + dock.height), 'pas sous le dock');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'pas de défilement de côté');
    await shot(page, 'ciel-telephone');
    assert.deepStrictEqual(errors, []);
    await context.close();
    console.log('ok téléphone');

    // 13. Mouvement réduit : pas de glissé de caméra.
    ({ context, page, errors } = await openBoard(browser, base, makeDb(), { reducedMotion: 'reduce' }));
    await page.waitForSelector('[data-widget=etude] .etude-sum');
    await openSpace(page);
    await toSky(page);
    await page.getByRole('button', { name: 'Voir tout le ciel' }).click();
    assert.strictEqual(await page.locator('.cst-world').evaluate(n => getComputedStyle(n).transitionDuration), '0s');
    await context.close();
    console.log('ok mouvement réduit');
  } finally {
    await browser.close();
    server.close();
  }
  console.log('constellations : tous les parcours passent');
})().catch(e => { console.error(e); process.exit(1); });
