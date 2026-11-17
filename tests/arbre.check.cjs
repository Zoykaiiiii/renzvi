// Vérifie « Mon espace Study » et sa présentation Arbre (labo ?labo=1) dans un vrai Chromium, avec Supabase simulé :
// study_courses, study_cards, study_reviews, study_links, study_notes, study_answer et le stockage « cours ».
// Le simulateur refuse les doublons d'association comme la contrainte d'unicité de la base.
// La séparation entre comptes (RLS) se vérifie sur la vraie base, pas ici.
// Lancement : NODE_PATH=<dossier node_modules contenant playwright> node tests/arbre.check.cjs   (captures : SHOTS=dossier)
const assert = require('node:assert');
const { chromium } = require('playwright');
const { server, makeDb, card, course, openBoard, shot, openSpace, transform, chapter, places } = require('./etude-harness.cjs');

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    // 1. L'arbre vient des vrais cours.
    const db = makeDb();
    let { context, page, errors } = await openBoard(browser, base, db);
    await page.waitForSelector('[data-widget=etude] .etude-sum');
    await openSpace(page);
    await page.waitForSelector('.arbre-chapitre');
    assert.strictEqual(await page.locator('.arbre-chapitre').count(), 10, 'un libellé par chapitre');
    assert.strictEqual(await page.locator('.arbre-matiere').count() + await page.locator('.arbre-big').count(), 3, 'une grosse branche par matière');
    assert.ok(await page.locator('.arbre-wood').getAttribute('d'), 'le bois est dessiné');
    assert.strictEqual(await page.locator('.etude-panel h3').textContent(), 'Choisis un chapitre');
    // Les paquets sans chapitre restent accessibles.
    assert.strictEqual(await page.locator('.etude-panel .etude-decks li').count(), 2);
    await shot(page, 'arbre-1440');
    console.log('ok arbre dessiné depuis les cours');

    // 2. Choisir un chapitre : panneau, extrait réel, actions.
    await chapter(page, 'La membrane').click();
    assert.strictEqual(await page.locator('.etude-panel h3').textContent(), 'La membrane');
    assert.strictEqual(await page.locator('.etude-crumb').first().textContent(), 'Biologie / La cellule');
    await page.waitForFunction(() => /Ce passage présente la membrane/.test(document.querySelector('.etude-panel .etude-text')?.textContent ?? ''));
    assert.doesNotMatch(await page.locator('.etude-panel .etude-text').first().textContent(), /noyau/, "l'extrait s'arrête au chapitre suivant");
    assert.strictEqual(await chapter(page, 'La membrane').getAttribute('aria-current'), 'true');
    assert.strictEqual(await page.getByRole('tab', { name: 'Lire' }).getAttribute('aria-selected'), 'true', 'onglet Lire par défaut');
    await page.getByRole('tab', { name: 'Réviser' }).click();
    assert.match(await page.locator('.etude-pbody').textContent(), /Aucun paquet associé/, 'pas de révision sans paquet associé');
    assert.strictEqual(await page.getByRole('button', { name: 'Réviser mes cartes' }).count(), 0);
    console.log('ok chapitre choisi');

    // 3. Associer : annuler ne change rien, une panne s'explique, un doublon est impossible.
    await page.getByRole('button', { name: 'Associer un paquet de flashcards' }).click();
    await page.locator('.etude-picker').getByText('Biologie cellulaire').click();
    await page.locator('.etude-picker').getByRole('button', { name: 'Annuler' }).click();
    assert.strictEqual(db.links.length, 0, 'annuler ne crée rien');
    assert.strictEqual(db.linkPosts ?? 0, 0);
    await page.waitForFunction(() => document.activeElement?.dataset.key === 'associer'); // le focus revient au bouton
    await page.getByRole('button', { name: 'Associer un paquet de flashcards' }).click();
    await page.locator('.etude-picker .etude-search').fill('cellul');
    assert.strictEqual(await page.locator('.etude-picker .etude-pick').count(), 1, 'la recherche filtre les paquets');
    await page.locator('.etude-picker').getByText('Biologie cellulaire').click();
    db.failLinks = true;
    await page.locator('.etude-picker').getByRole('button', { name: 'Associer', exact: true }).click();
    await page.waitForSelector('.etude-picker .etude-status.bad');
    assert.match(await page.locator('.etude-picker .etude-status').textContent(), /n'a pas été enregistrée/);
    assert.strictEqual(db.links.length, 0);
    db.failLinks = false;
    await page.locator('.etude-picker').getByRole('button', { name: 'Associer', exact: true }).click();
    await page.waitForSelector('.etude-panel .etude-decks li');
    assert.strictEqual(db.links.length, 1);
    assert.strictEqual(db.links[0].deck, 'Biologie cellulaire');
    assert.strictEqual(db.cards.length, 5, 'aucune carte copiée');
    assert.match(await page.locator('.etude-panel .etude-decks small').textContent(), /3 cartes · 2 à revoir/);
    await page.getByRole('button', { name: 'Associer un paquet de flashcards' }).click();
    assert.ok(await page.locator('.etude-picker .etude-pick', { hasText: 'Biologie cellulaire' }).locator('input').isDisabled(), 'déjà associé : non proposable');
    assert.match(await page.locator('.etude-picker .etude-pick', { hasText: 'Biologie cellulaire' }).textContent(), /Déjà associé/);
    await page.keyboard.press('Escape');
    await page.waitForSelector('.etude-picker', { state: 'detached' });
    assert.ok(await page.locator('.etude-space').isVisible(), 'Échap ferme le choix, pas l’espace');
    await shot(page, 'arbre-panneau');
    console.log('ok association (annulation, panne, doublon)');

    // 4. Réviser : ouvrir ne planifie rien, une réponse compte une fois, le retour rend la même vue et le focus.
    const before = await transform(page);
    const dues = JSON.stringify(db.cards.map(c => c.due));
    assert.match(await page.locator('.etude-flash').textContent(), /3 cartes · 2 à revoir/, 'total et cartes dues distingués');
    await page.getByRole('button', { name: 'Réviser mes cartes' }).click();
    await page.waitForSelector('.etude-sheet .cartes-card');
    assert.strictEqual(JSON.stringify(db.cards.map(c => c.due)), dues, 'ouvrir un paquet ne change aucune échéance');
    assert.strictEqual(db.reviews.length, 0);
    await page.getByRole('button', { name: 'Voir la réponse' }).click();
    await shot(page, 'arbre-revision');
    await page.locator('.etude-sheet .revisions-rate', { hasText: 'Bien' }).dblclick();
    await page.waitForFunction(() => !document.querySelector('.etude-sheet .revisions-rate'));
    assert.strictEqual(db.reviews.length, 1, 'une réponse, enregistrée une fois');
    await page.getByRole('button', { name: '← Retour' }).click();
    await page.waitForFunction(() => document.activeElement?.dataset.key === 'reviser');
    assert.strictEqual(await transform(page), before, 'même position et même zoom au retour');
    assert.strictEqual(await chapter(page, 'La membrane').getAttribute('aria-current'), 'true');
    assert.match(await page.locator('.etude-panel .etude-decks small').textContent(), /1 à revoir/);
    console.log('ok révision partagée et retour au même endroit');

    // 5. Notes de chapitre.
    await page.getByRole('tab', { name: 'Notes' }).click();
    assert.match(await page.locator('.etude-pbody').textContent(), /Aucune note/);
    await page.getByRole('button', { name: 'Écrire une note' }).click();
    await page.locator('.etude-note').fill('La membrane est une double couche.');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.waitForFunction(() => document.querySelector('.etude-sheet .etude-status')?.textContent === 'Enregistré');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.etude-panel [data-key=notes]:text("Modifier la note")');
    assert.strictEqual(await page.locator('.etude-notetext').textContent(), 'La membrane est une double couche.', 'la note se lit dans le panneau');
    assert.strictEqual(db.notes[0].body, 'La membrane est une double couche.');
    console.log('ok notes de chapitre');

    // 6. Ouvrir le cahier : le carnet existant s'ouvre au bon chapitre ; « Retour à l'arbre » revient à l'arbre.
    await page.getByRole('tab', { name: 'Lire' }).click();
    await page.getByRole('button', { name: 'Ouvrir le cahier' }).click();
    await page.waitForSelector('.etude-sheet.cahier-open .cahier-text');
    assert.match(await page.locator('.etude-sheet .cahier-text').textContent(), /présente la membrane/);
    await page.getByRole('button', { name: 'Retour à l’arbre' }).click();
    await page.waitForSelector('.etude-sheet', { state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.dataset.key === 'lire');
    console.log('ok lecture et retour');

    // 7. Minuteur : le dock pilote le vrai minuteur, qui continue pendant la navigation.
    await page.locator('.etude-dock .etude-tool').first().click();
    assert.strictEqual(await page.evaluate(() => window.renzviMinuteurLive().state), 'run');
    await page.getByRole('tab', { name: 'Réviser' }).click();
    await page.getByRole('button', { name: 'Réviser mes cartes' }).click();
    await page.getByRole('button', { name: '← Retour' }).click();
    await page.waitForTimeout(1200);
    const t = await page.evaluate(() => window.renzviMinuteurLive());
    assert.ok(t.state === 'run' && t.ms < 1500000 - 1000, 'le minuteur a continué, sans repartir de zéro');
    await page.waitForFunction(() => /24:5\d/.test(document.querySelector('.etude-dock .etude-tool').textContent));
    await page.locator('.etude-dock .etude-tool').first().click();
    assert.strictEqual(await page.evaluate(() => window.renzviMinuteurLive().state), 'pause');
    console.log('ok minuteur continu');

    // 8. Recharger : même chapitre, même vue.
    const view = await transform(page);
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForSelector('[data-widget=etude] .etude-sum');
    await openSpace(page);
    await page.waitForSelector('.arbre-chapitre[aria-current]');
    assert.strictEqual(await page.locator('.etude-panel h3').textContent(), 'La membrane');
    assert.strictEqual(await transform(page), view, 'la vue est gardée après rechargement');
    assert.strictEqual(await page.locator('.etude-panel .etude-decks li').count(), 1, "l'association est en base");
    console.log('ok rechargement');

    // 9. Placement stable : un chapitre ajouté ailleurs ne déplace pas les autres branches.
    const was = await places(page);
    db.courses[1].chapters.push({ id: 'c9', title: 'Le Directoire', page: 0, offset: 0 });
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('renzvi:cours')));
    await chapter(page, 'Le Directoire').waitFor();
    const now = await places(page);
    for (const [key, at] of Object.entries(was)) if (!key.startsWith(db.courses[1].id)) assert.strictEqual(now[key], at, `${key} n'a pas bougé`);
    console.log('ok placement stable');

    // 10. Clavier, repli, recherche, liste.
    await chapter(page, 'Le noyau').focus();
    await page.keyboard.press('Enter');
    assert.strictEqual(await page.locator('.etude-panel h3').textContent(), 'Le noyau');
    assert.ok(await chapter(page, 'Le noyau').evaluate(n => n === document.activeElement), 'le focus reste sur le chapitre');
    // Le nom d'une matière cadre sa branche ; le petit bouton à côté la replie.
    await page.getByRole('button', { name: 'Replier Histoire' }).click();
    assert.strictEqual(await chapter(page, '1789').count(), 0, 'matière repliée');
    assert.strictEqual(await page.getByRole('button', { name: 'Déplier Histoire' }).getAttribute('aria-expanded'), 'false');
    await page.locator('.etude-top .etude-search').fill('terreur');
    await page.locator('.etude-results button').first().click();
    assert.strictEqual(await page.locator('.etude-panel h3').textContent(), 'La Terreur');
    assert.strictEqual(await chapter(page, 'La Terreur').getAttribute('aria-current'), 'true', 'la recherche déplie et choisit');
    await page.getByRole('button', { name: 'Voir tout l’arbre' }).click();
    await page.getByRole('button', { name: 'Zoomer', exact: true }).click();
    assert.match(await page.locator('.arbre-level').textContent(), /%/);
    await page.locator('.etude-tabs').getByRole('button', { name: 'Liste' }).click();
    await page.waitForSelector('.etude-liste .etude-item[aria-current]');
    await page.locator('.etude-liste .etude-item', { hasText: 'Dérivées' }).click();
    assert.strictEqual(await page.locator('.etude-panel h3').textContent(), 'Dérivées');
    await shot(page, 'arbre-liste');
    await page.locator('.etude-tabs').getByRole('button', { name: 'Arbre' }).click();
    await page.waitForSelector('.arbre-chapitre[aria-current]');
    console.log('ok clavier, repli, recherche, liste');

    // 11. Retirer une association ne supprime pas le paquet ; supprimer un cours nettoie l'arbre.
    await chapter(page, 'La membrane').click();
    await page.getByRole('button', { name: /Retirer l'association/ }).click();
    await page.waitForFunction(() => !document.querySelector('.etude-panel .etude-decks'));
    assert.strictEqual(db.links.length, 0);
    assert.strictEqual(db.cards.filter(c => c.deck === 'Biologie cellulaire').length, 3, 'le paquet est intact');
    db.courses.shift();
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('renzvi:cours')));
    await page.waitForFunction(() => document.querySelector('.etude-panel h3')?.textContent === 'Choisis un chapitre');
    assert.strictEqual(await chapter(page, 'La membrane').count(), 0);
    await page.keyboard.press('Escape');
    await page.waitForSelector('.etude-space', { state: 'hidden' });
    assert.ok(await page.getByRole('button', { name: 'Ouvrir mon espace' }).evaluate(n => n === document.activeElement), 'fermer rend le focus');
    assert.deepStrictEqual(errors, []);
    await context.close();
    console.log('ok retrait, suppression, fermeture');

    // 12. Dense : des dizaines de chapitres, titres longs. Les cours se replient, rien ne se chevauche, rien ne rétrécit.
    ({ context, page, errors } = await openBoard(browser, base, makeDb('dense')));
    await page.waitForSelector('[data-widget=etude] .etude-sum');
    await openSpace(page);
    await page.waitForSelector('.arbre-cours');
    assert.strictEqual(await page.locator('.arbre-chapitre').count(), 0, 'au-delà de 24 chapitres, les cours arrivent repliés');
    await page.locator('.arbre-cours').first().click();
    await page.locator('.arbre-cours').nth(3).click();
    assert.strictEqual(await page.locator('.arbre-chapitre').count(), 14);
    await page.getByRole('button', { name: 'Zoomer', exact: true }).click();
    await page.getByRole('button', { name: 'Zoomer', exact: true }).click();
    await page.getByRole('button', { name: 'Zoomer', exact: true }).click();
    const overlap = await page.locator('.arbre-label').evaluateAll(all => {
      const r = all.map(n => n.getBoundingClientRect());
      for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (r[i].left < r[j].right - 1 && r[j].left < r[i].right - 1 && r[i].top < r[j].bottom - 1 && r[j].top < r[i].bottom - 1) return `${all[i].textContent} / ${all[j].textContent}`;
      return null;
    });
    assert.strictEqual(overlap, null, 'aucun libellé ne chevauche un autre');
    assert.ok(await page.locator('.arbre-chapitre').first().evaluate(n => parseFloat(getComputedStyle(n).fontSize) >= 14), 'les libellés gardent leur taille');
    await page.getByRole('button', { name: 'Voir tout l’arbre' }).click();
    await page.waitForTimeout(600);
    await shot(page, 'arbre-dense');
    assert.deepStrictEqual(errors, []);
    await context.close();
    console.log('ok arbre dense');

    // 13. Un seul cours : pas d'étage inutile. Compte vide : on propose d'importer, sans faux cours.
    ({ context, page, errors } = await openBoard(browser, base, makeDb('un')));
    await page.waitForSelector('[data-widget=etude] .etude-sum');
    await openSpace(page);
    await page.waitForSelector('.arbre-chapitre');
    assert.strictEqual(await page.locator('.arbre-matiere').count(), 0);
    assert.strictEqual(await page.locator('.arbre-titre').textContent(), 'Biologie');
    await shot(page, 'arbre-un');
    await context.close();
    ({ context, page, errors } = await openBoard(browser, base, makeDb('vide')));
    await page.waitForSelector('[data-widget=etude] .etude-sum');
    await openSpace(page);
    assert.strictEqual(await page.locator('.arbre-label').count(), 0);
    await page.getByRole('button', { name: 'Importer un premier cours' }).click();
    await page.waitForSelector('.etude-sheet .cahier-view');
    await shot(page, 'arbre-vide');
    assert.deepStrictEqual(errors, []);
    await context.close();
    console.log('ok un seul cours, compte vide');

    // 14. Base pas encore mise à jour : l'arbre s'ouvre, l'association explique pourquoi elle échoue.
    const old = makeDb();
    old.noLinks = true;
    ({ context, page, errors } = await openBoard(browser, base, old));
    await page.waitForSelector('[data-widget=etude] .etude-sum');
    await openSpace(page);
    await chapter(page, 'Le noyau').click();
    await page.getByRole('tab', { name: 'Réviser' }).click();
    await page.getByRole('button', { name: 'Associer un paquet de flashcards' }).click();
    await page.locator('.etude-picker').getByText('Dates').click();
    await page.locator('.etude-picker').getByRole('button', { name: 'Associer', exact: true }).click();
    await page.waitForSelector('.etude-picker .etude-status.bad');
    assert.match(await page.locator('.etude-picker .etude-status').textContent(), /pas encore activées/);
    await context.close();
    console.log('ok base sans migration');

    // 15. Téléphone et mouvement réduit.
    ({ context, page, errors } = await openBoard(browser, base, makeDb(), { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' }));
    await page.waitForSelector('[data-widget=etude] .etude-sum');
    await openSpace(page);
    await page.waitForSelector('.arbre-chapitre');
    await page.getByRole('button', { name: 'Zoomer', exact: true }).click();
    assert.strictEqual(await page.locator('.arbre-world').evaluate(n => getComputedStyle(n).transitionDuration), '0s', 'aucun glissement en mouvement réduit');
    await page.locator('.etude-tabs').getByRole('button', { name: 'Liste' }).click();
    await page.locator('.etude-liste .etude-item', { hasText: 'Le noyau' }).tap();
    assert.strictEqual(await page.locator('.etude-panel h3').textContent(), 'Le noyau');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'pas de défilement horizontal');
    await page.locator('.etude-tabs').getByRole('button', { name: 'Arbre' }).click();
    await page.waitForSelector('.arbre-chapitre[aria-current]');
    await shot(page, 'arbre-390');
    assert.deepStrictEqual(errors, []);
    await context.close();
    console.log('ok téléphone et mouvement réduit');

    // 16. Hors labo : le widget n'existe pas pour le public.
    ({ context, page } = await openBoard(browser, base, makeDb(), { labo: false }));
    assert.strictEqual(await page.locator('[data-widget=etude]').count(), 0);
    await context.close();
    console.log('ok caché hors labo');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
