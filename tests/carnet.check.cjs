// Vérifie le carnet (vue agrandie du Cahier, site/study/carnet.js) dans un vrai Chromium, Supabase simulé
// (tests/etude-harness.cjs) : widget compact inchangé, mise en page, surligner / souligner / noter un passage (phrases
// répétées, plusieurs lignes), panne d'enregistrement, signets et reprise, rechargement et changement de taille,
// recherche distincte des surlignages, onglets, révision puis retour, réduire, annotation introuvable, PDF, scan,
// téléphone, clavier. La séparation entre comptes se vérifie sur une vraie base : tests/rls.check.sh.
// Lancement : NODE_PATH=<dossier node_modules contenant playwright> node tests/carnet.check.cjs   (captures : SHOTS=dossier)
const assert = require('node:assert');
const { randomUUID } = require('node:crypto');
const { chromium } = require('playwright');
const { server, makeDb, card, openBoard, shot } = require('./etude-harness.cjs');

// Un cours long, avec une phrase répétée et un passage sur plusieurs lignes.
const LONG = Array.from({ length: 40 }, (_, i) => `Paragraphe ${i + 1}. La membrane contrôle les échanges de la cellule avec son milieu, ligne après ligne.`).join('\n');
const TEXT = `# La membrane\nLa cellule est vivante. La cellule est vivante.\nLa membrane régule\nles échanges avec le milieu.\n${LONG}\n\n# Le noyau\nLe noyau contient l'ADN de la cellule.`;
function addCourse(db, { subject = 'Biologie', title = 'La cellule', kind = 'texte', pages = [TEXT], chapters, chars } = {}) {
  const id = randomUUID();
  const all = pages.join('');
  const list = chapters ?? [{ id: 'c0', title: 'La membrane', page: 0, offset: 0 }, { id: 'c1', title: 'Le noyau', page: 0, offset: pages[0].indexOf('# Le noyau') }];
  db.courses.push({ id, subject, title, kind, file_name: kind === 'pdf' ? 'cours.pdf' : 'cours.txt', file_size: all.length, page_count: pages.length, text_chars: chars ?? all.length, chapters: list, created_at: new Date(Date.UTC(2026, 10, 3, 0, 0, db.courses.length)).toISOString() });
  db.files[`cours/u1/${id}/texte.json`] = JSON.stringify({ v: 1, pages });
  return id;
}
function newDb() {
  const db = makeDb('vide');
  db.rows.ecran.widgets = ['cahier', 'minuteur'];
  db.marks = [];
  return db;
}
const cahier = page => page.locator('[data-widget=cahier]');
const grow = page => cahier(page).locator('.cahier-livre-open');
async function openCarnet(page) {
  await page.waitForSelector('[data-widget=cahier] .cahier-livre-open');
  await grow(page).click();
  await page.waitForSelector('.carnet-top:not([hidden])');
  await page.waitForFunction(() => !/Chargement/.test(document.querySelector('.carnet-margin')?.textContent ?? ''));
  // Le carnet glisse depuis la place du widget : on attend qu'il soit posé.
  await page.waitForFunction(() => !document.querySelector('[data-widget=cahier]').getAnimations().length);
}
// Sélectionne la n-ième occurrence d'un texte dans le lecteur, comme à la souris.
const select = (page, phrase, nth = 0) => page.evaluate(([phrase, nth]) => {
  for (const b of document.querySelectorAll('[data-widget=cahier] .cahier-block')) {
    let at = -1;
    for (let i = 0; i <= nth; i++) at = b.textContent.indexOf(phrase, at + 1);
    if (at < 0) continue;
    const r = document.createRange();
    r.setStart(b.firstChild, at);
    r.setEnd(b.firstChild, at + phrase.length);
    b.scrollIntoView({ block: 'nearest' });
    r.startContainer.parentElement.closest('.cahier-text').scrollTop += r.getBoundingClientRect().top - 300;
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    return true;
  }
  return false;
}, [phrase, nth]);
const passagePoints = (page, phrase) => page.locator('.cahier-block').filter({ hasText: phrase.split('\n')[0] }).first().evaluate((b, phrase) => {
  const text = b.firstChild, start = text.textContent.indexOf(phrase);
  const range = document.createRange();
  range.setStart(text, start);
  range.setEnd(text, start + 1);
  const reader = b.closest('.cahier-text');
  reader.scrollTop += range.getBoundingClientRect().top - reader.getBoundingClientRect().top - 24;
  return [start, start + phrase.length - 1].map((offset, i) => {
    range.setStart(text, offset);
    range.setEnd(text, offset + 1);
    const r = range.getBoundingClientRect();
    return [r.left + r.width * (i ? .85 : .15), r.top + r.height / 2];
  });
}, phrase);
const bar = page => page.locator('.carnet-bar');
const painted = (page, name) => page.evaluate(n => [...(CSS.highlights.get(n) ?? [])].map(r => r.toString()), name);
const topText = page => page.evaluate(() => { const r = document.querySelector('[data-widget=cahier] .cahier-text'); const t = carnetTop(r); return t ? `${t.page}:${t.pos}` : null; });
const status = page => page.locator('.carnet-status');
const saved = page => page.waitForFunction(() => document.querySelector('.carnet-status').textContent === 'Enregistré');

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    // 1. Le widget compact ne change pas ; Agrandir ouvre le carnet dans la page (pas le plein écran du navigateur).
    const db = newDb();
    db.rows.ecran.look = { fini: 'poli' };
    const course = addCourse(db);
    db.cards.push({ ...card('La cellule', 'Rôle de la membrane ?', '2026-11-12T08:00:00.000Z'), course_id: course }, { ...card('La cellule', 'Où est l’ADN ?'), course_id: course }, card('Autre paquet', 'Sans rapport'));
    let { context, page, errors } = await openBoard(browser, base, db);
    await page.waitForSelector('[data-widget=cahier] .cahier-livre-open');
    const compact = await cahier(page).boundingBox();
    assert.strictEqual(await page.locator('.carnet-top, .carnet-side, .carnet-margin').evaluateAll(a => a.filter(n => n.checkVisibility()).length), 0, 'aucun élément du carnet dans le widget compact');
    // Widget fermé : un livre ouvert (le cours à gauche, mes notes à droite), « Ouvrir le cahier » en bas.
    assert.match(await cahier(page).locator('.cahier-livre-titre').textContent(), /La cellule/);
    assert.notEqual(await cahier(page).locator('.cahier-livre-titre').evaluate(n => getComputedStyle(n).userSelect), 'none');
    assert.strictEqual(await cahier(page).locator('.cahier-livre-foot span').textContent(), 'Chapitre 1 sur 2');
    assert.strictEqual(await cahier(page).locator('.cahier-text').isVisible(), false, 'la lecture se fait dans le carnet');
    await shot(page, 'carnet-compact');
    await openCarnet(page);
    assert.strictEqual(await page.evaluate(() => document.fullscreenElement), null, 'pas de plein écran du navigateur');
    const full = await cahier(page).boundingBox();
    // Une fenêtre posée sur le tableau : presque tout l'écran, avec une marge où le fond reste visible.
    assert.ok(full.x >= 10 && full.x <= 60 && full.y >= 10 && full.width >= 1300 && full.height >= 800, `le carnet prend presque toute la page (${JSON.stringify(full)})`);
    // Par défaut : le verre fumé, le fond d'écran se devine derrière.
    assert.strictEqual(await cahier(page).evaluate(n => getComputedStyle(n).backgroundColor), 'rgba(32, 27, 23, 0.72)', 'verre par défaut');
    assert.match(await cahier(page).evaluate(n => getComputedStyle(n).backdropFilter), /blur\(24px\)/);
    await shot(page, 'carnet-verre');
    // Personnaliser : Papier, puis taille du texte ; gardé sur l'appareil, limité au carnet.
    await cahier(page).getByRole('button', { name: 'Personnaliser' }).click();
    await page.waitForSelector('.carnet-look:not([hidden])');
    await shot(page, 'carnet-personnaliser');
    await page.locator('.carnet-look').getByRole('button', { name: 'Papier' }).click();
    assert.strictEqual(await cahier(page).evaluate(n => getComputedStyle(n).backgroundColor), 'rgb(244, 239, 228)', 'papier chaud');
    assert.equal(await page.locator('.carnet-look').getByRole('slider').count(), 0, 'opacité et flou : seulement pour le verre');
    // Police et texte : un second écran du panneau ; « Aa » y mène directement.
    await page.locator('.carnet-look').getByRole('button', { name: /^Police et texte/ }).click();
    await page.locator('.carnet-look input[type=range]').fill('21');
    assert.strictEqual(await page.locator('.widget.cahier-open .cahier-text').evaluate(n => getComputedStyle(n).fontSize), '21px');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('renzvi:carnet-look')).surface), 'papier');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.topbar')).fontSize), await page.evaluate(() => getComputedStyle(document.body).fontSize), 'le reste de l’appli ne change pas');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.carnet-look', { state: 'hidden' });
    assert.deepStrictEqual(await page.getByRole('tab').allTextContents(), ['Cours', 'Mes notes', 'Révisions']);
    assert.deepStrictEqual(await page.locator('.carnet-chapter span').allTextContents(), ['La membrane', 'Le noyau']);
    assert.strictEqual(await page.locator('.carnet-chapter[aria-current]').textContent(), 'La membrane');
    assert.strictEqual(await cahier(page).locator('.cahier-title').count(), 1, 'un seul titre de chapitre');
    assert.strictEqual(await cahier(page).locator('.carnet-kicker').textContent(), 'Chapitre 01 · Biologie');
    assert.strictEqual(await page.locator('.carnet-count').textContent(), 'Chapitre 1 sur 2');
    assert.ok(await page.getByRole('button', { name: 'Chapitre suivant' }).isVisible());
    assert.strictEqual(await page.locator('.carnet-side').isVisible(), false, 'les chapitres sont dans un tiroir');
    assert.ok(await page.locator('.carnet-margin').isVisible(), 'Mes notes à droite sur grand écran');
    const col = await cahier(page).locator('.cahier-block').first().boundingBox();
    assert.ok(col.width <= 780, `colonne de lecture lisible (${col.width})`);
    assert.strictEqual(await cahier(page).locator('.cahier-block').first().evaluate(n => getComputedStyle(n).fontSize), '21px', 'la taille choisie dans Personnaliser');
    assert.deepStrictEqual(await cahier(page).locator('.cahier-block').first().evaluate(n => {
      const s = getComputedStyle(n, '::selection');
      return [s.backgroundColor, s.color];
    }), ['rgb(85, 101, 58)', 'rgb(255, 255, 255)']);
    assert.strictEqual(await cahier(page).locator('.cahier-tools').isVisible(), false, 'plus de ligne de liens de gestion');
    await shot(page, 'carnet-ouvert');
    console.log('ok compact inchangé, carnet ouvert');

    // 2. Surligner la SECONDE occurrence d'une phrase répétée : c'est bien elle qui est gardée.
    const second = TEXT.indexOf('La cellule est vivante.', TEXT.indexOf('La cellule est vivante.') + 1);
    await select(page, 'La cellule est vivante.', 1);
    await bar(page).waitFor();
    assert.deepStrictEqual(await bar(page).locator('.carnet-tool:visible').allTextContents(), ['Copier', 'Surligner', 'Souligner', 'Note', '']);
    const bb = await bar(page).boundingBox();
    assert.ok(bb.x >= 0 && bb.y >= 0 && bb.x + bb.width <= 1440 && bb.y + bb.height <= 900, 'barre dans l’écran');
    await shot(page, 'carnet-barre');
    await bar(page).getByRole('button', { name: 'Surligner', exact: true }).click();
    await saved(page);
    assert.strictEqual(db.marks.length, 1);
    assert.strictEqual(db.marks[0].pos, second, 'position de la seconde occurrence');
    assert.ok(db.marks[0].surligne && !db.marks[0].souligne && db.marks[0].quote === 'La cellule est vivante.');
    assert.deepStrictEqual(await painted(page, 'carnet-jaune'), ['La cellule est vivante.']);
    assert.strictEqual(await page.evaluate(() => { const r = [...CSS.highlights.get('carnet-jaune')][0]; return r.startOffset; }), second - TEXT.indexOf('\n') - 1, 'peint sur la seconde occurrence');
    assert.strictEqual(await bar(page).isVisible(), false);
    // Surligner et souligner exactement ce que la souris sélectionne sur plusieurs lignes.
    const passage = 'La membrane régule\nles échanges avec le milieu.';
    const [from, to] = await passagePoints(page, passage);
    assert.ok(to[1] > from[1], 'le passage s’étend sur plusieurs lignes');
    await page.mouse.move(...from);
    await page.mouse.down();
    await page.mouse.move(...to, { steps: 12 });
    await page.mouse.up();
    assert.strictEqual(await page.evaluate(() => String(getSelection())), passage);
    await bar(page).getByRole('button', { name: 'Surligner', exact: true }).click();
    await saved(page);
    assert.strictEqual(db.marks[1].quote, passage);
    assert.strictEqual(db.marks[1].pos, TEXT.indexOf(passage));
    assert.deepStrictEqual(await painted(page, 'carnet-jaune'), ['La cellule est vivante.', passage]);
    await select(page, passage);
    await bar(page).getByRole('button', { name: 'Souligner' }).click();
    await saved(page);
    assert.strictEqual(db.marks.length, 2);
    assert.ok(db.marks[1].souligne && db.marks[1].surligne);
    assert.deepStrictEqual(await painted(page, 'carnet-souligne'), [passage]);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await select(page, passage);
    await bar(page).getByRole('button', { name: 'Copier' }).click();
    assert.strictEqual(await page.evaluate(() => navigator.clipboard.readText()), passage);
    // Cliquer sur une annotation : changer sa couleur, puis la souligner aussi, puis la retirer.
    const clickMark = async name => {
      const p = await page.evaluate(n => { const b = [...CSS.highlights.get(n)][0].getClientRects()[0]; return [b.left + 8, b.top + b.height / 2]; }, name);
      await page.evaluate(() => getSelection().removeAllRanges());
      await page.mouse.click(p[0], p[1]);
      await bar(page).waitFor();
    };
    await clickMark('carnet-jaune');
    await bar(page).getByRole('button', { name: 'Plus' }).click();
    assert.ok(await bar(page).getByRole('button', { name: 'Supprimer' }).isVisible(), 'une annotation existante se règle');
    await bar(page).getByRole('button', { name: 'Surligner en vert' }).click();
    await saved(page);
    assert.strictEqual(db.marks[0].color, 'vert');
    assert.deepStrictEqual(await painted(page, 'carnet-vert'), ['La cellule est vivante.']);
    assert.deepStrictEqual(await painted(page, 'carnet-jaune'), [passage]);
    await clickMark('carnet-souligne');
    await bar(page).getByRole('button', { name: 'Plus' }).click();
    await bar(page).getByRole('button', { name: 'Supprimer' }).click();
    await page.waitForFunction(() => document.querySelector('.carnet-status').textContent === 'Annotation retirée');
    assert.strictEqual(db.marks.length, 1);
    console.log('ok surligner, souligner, modifier, retirer');

    // 3. Note liée à un passage : « Note » range le passage tout de suite, le commentaire est facultatif.
    await select(page, 'Paragraphe 3.');
    db.failMarks = true;
    await bar(page).getByRole('button', { name: 'Ajouter une note' }).click();
    await page.waitForSelector('.carnet-status.bad');
    assert.strictEqual(db.marks.length, 1, 'panne : rien n’est rangé, et ce n’est pas présenté comme une réussite');
    db.failMarks = false;
    await select(page, 'Paragraphe 3.');
    await bar(page).getByRole('button', { name: 'Ajouter une note' }).click();
    await saved(page);
    assert.strictEqual(db.marks.length, 2, 'le passage est dans « Mes notes » sans rien écrire');
    assert.deepStrictEqual(await painted(page, 'carnet-note'), ['Paragraphe 3.']);
    const draft = page.locator('.carnet-draft');
    assert.strictEqual(await draft.locator('.carnet-quote').textContent(), '« Paragraphe 3. »', 'le passage cité est montré');
    await draft.getByRole('button', { name: 'Enregistrer la note' }).click();
    assert.strictEqual(await page.locator('.carnet-draft').count(), 0, 'enregistrer sans commentaire garde le passage');
    assert.strictEqual(db.marks.length, 2);
    await page.locator('.carnet-margin .carnet-mark', { hasText: 'Paragraphe 3.' }).getByRole('button', { name: 'Ajouter une note' }).click();
    await draft.locator('textarea').fill('À revoir avant le partiel.');
    db.failMarks = true;
    await draft.getByRole('button', { name: 'Enregistrer la note' }).click();
    await page.waitForSelector('.carnet-status.bad');
    assert.match(await status(page).textContent(), /Pas enregistré/);
    assert.ok(!db.marks.some(m => m.note), 'rien n’est écrit pendant la panne');
    assert.strictEqual(await draft.locator('textarea').inputValue(), 'À revoir avant le partiel.', 'le brouillon reste');
    // Changer d'onglet puis revenir ne jette pas le brouillon.
    await page.getByRole('tab', { name: 'Révisions' }).click();
    await page.getByRole('tab', { name: 'Cours' }).click();
    assert.strictEqual(await draft.locator('textarea').inputValue(), 'À revoir avant le partiel.');
    db.failMarks = false;
    await draft.getByRole('button', { name: 'Enregistrer la note' }).click();
    await saved(page);
    assert.strictEqual(db.marks.length, 2);
    assert.strictEqual(db.marks.find(m => m.note).note, 'À revoir avant le partiel.');
    assert.strictEqual(await page.locator('.carnet-draft').count(), 0);
    assert.deepStrictEqual(await painted(page, 'carnet-note'), ['Paragraphe 3.']);
    await page.locator('.carnet-margin').getByRole('button', { name: 'Modifier la note' }).click();
    await page.locator('.carnet-draft textarea').fill('À revoir avant le partiel de janvier.');
    await page.locator('.carnet-draft').getByRole('button', { name: 'Enregistrer la note' }).click();
    await saved(page);
    assert.strictEqual(db.marks.find(m => m.note).note, 'À revoir avant le partiel de janvier.');
    assert.match(await page.locator('.carnet-margin .carnet-notetext').textContent(), /janvier/);
    await shot(page, 'carnet-note');
    console.log('ok note liée au passage, panne honnête');

    // 4. Signet : garder un endroit, le retrouver depuis un autre chapitre, reprendre où l'on était.
    await select(page, 'Paragraphe 20.');
    await page.evaluate(() => getSelection().removeAllRanges());
    const signet = page.locator('.carnet-signet');
    assert.strictEqual(await signet.getAttribute('aria-pressed'), 'false');
    await signet.click();
    await page.waitForFunction(() => document.querySelector('.carnet-signet').getAttribute('aria-pressed') === 'true');
    const sg = db.marks.find(m => m.kind === 'signet');
    assert.ok(sg && sg.length === 0 && sg.quote.length > 10, 'signet enregistré avec ses premiers mots');
    assert.strictEqual(await signet.getAttribute('aria-label'), 'Retirer le signet de cet endroit');
    const where = await topText(page);
    await page.getByRole('button', { name: 'Chapitres', exact: true }).click();
    await page.locator('.carnet-chapter', { hasText: 'Le noyau' }).click();
    await page.waitForFunction(() => document.querySelector('[data-widget=cahier] .cahier-title').textContent === 'Le noyau');
    assert.strictEqual(await signet.getAttribute('aria-pressed'), 'false', 'pas de signet ici');
    await page.locator('.carnet-signets .carnet-go').click();
    await page.waitForFunction(() => document.querySelector('[data-widget=cahier] .cahier-title').textContent === 'La membrane');
    await page.waitForFunction(() => document.querySelector('.carnet-signet').getAttribute('aria-pressed') === 'true');
    assert.strictEqual(await topText(page), where, 'le signet ramène au même endroit du texte');
    assert.match(await page.locator('.carnet-resume').textContent(), /Reprendre ma lecture · Le noyau/);
    await shot(page, 'carnet-signets');
    await page.getByRole('button', { name: 'Chapitres', exact: true }).click();
    await page.locator('.carnet-resume').click();
    await page.waitForFunction(() => document.querySelector('[data-widget=cahier] .cahier-title').textContent === 'Le noyau');
    assert.strictEqual(await page.locator('.carnet-resume').isVisible(), false);
    console.log('ok signets et reprise');

    // 5. Recherche : son repère ne se confond pas avec un surlignage gardé.
    await page.getByRole('button', { name: 'Chercher dans le cours' }).click();
    await page.locator('.carnet-find').fill('vivante');
    await page.waitForSelector('[data-widget=cahier] .cahier-results');
    await cahier(page).locator('.cahier-hit').nth(1).click();
    await page.waitForFunction(() => CSS.highlights.has('cahier'));
    assert.deepStrictEqual(await painted(page, 'cahier'), ['vivante']);
    assert.deepStrictEqual(await painted(page, 'carnet-vert'), ['La cellule est vivante.'], 'le surlignage reste à part');
    const styles = await page.evaluate(() => [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } }).filter(r => /::highlight\((cahier|carnet-vert)\)/.test(r.selectorText ?? '')).map(r => `${r.selectorText}{${r.style.backgroundColor}}`));
    assert.ok(styles.some(s => /cahier-open.*cahier.*rgb\(42, 38, 34\)/.test(s)) && styles.some(s => /carnet-vert.*rgb\(211, 226, 182\)/.test(s)), 'deux rendus distincts');
    console.log('ok recherche distincte');

    // 6. Onglets : Mes notes ramène au passage ; changer d'onglet garde la place dans le texte.
    await select(page, 'Paragraphe 30.');
    await page.evaluate(() => getSelection().removeAllRanges());
    const place = await topText(page);
    await page.getByRole('tab', { name: 'Mes notes' }).click();
    assert.strictEqual(await page.locator('.carnet-pane .carnet-h').textContent(), 'Mes notes');
    assert.strictEqual(await page.locator('.carnet-pane .carnet-mark').first().locator('.carnet-mark-h strong').textContent(), 'La membrane', 'la note dit son chapitre');
    assert.match(await page.locator('.carnet-pane').textContent(), /partiel de janvier/);
    assert.match(await page.locator('.carnet-pane').textContent(), /Passages surlignés ou soulignés/);
    await page.getByRole('tab', { name: 'Cours' }).click();
    assert.strictEqual(await topText(page), place, 'même endroit au retour sur Cours');
    await page.getByRole('tab', { name: 'Mes notes' }).click();
    await page.locator('.carnet-pane').getByRole('button', { name: /Voir le passage : Paragraphe 3\./ }).click();
    await page.waitForFunction(() => document.querySelector('.carnet-tabs [aria-selected=true]').textContent === 'Cours');
    await page.waitForFunction(() => { const r = [...(CSS.highlights.get('carnet-note') ?? [])][0]; if (!r) return false; const b = r.getBoundingClientRect(); return b.top > 0 && b.bottom < innerHeight; });
    console.log('ok onglets et retour au passage');

    // 7. Révisions : les vrais paquets du cours, l'outil de révision existant, retour au même endroit.
    await select(page, 'Paragraphe 12.');
    await page.evaluate(() => getSelection().removeAllRanges());
    const before = await topText(page);
    await page.getByRole('tab', { name: 'Révisions' }).click();
    await page.waitForSelector('.carnet-deck');
    assert.strictEqual(await page.locator('.carnet-deck').count(), 1, 'seulement les paquets liés à ce cours');
    assert.match(await page.locator('.carnet-deck').textContent(), /La cellule2 cartes · 1 à revoir · 1 nouvelle2 cartes créées depuis ce cours/);
    await shot(page, 'carnet-revisions');
    await page.getByRole('button', { name: 'Réviser le paquet La cellule' }).click();
    await page.waitForSelector('.carnet-sheet .cartes-card');
    assert.strictEqual(db.reviews.length, 0, 'ouvrir ne planifie rien');
    await page.getByRole('button', { name: 'Voir la réponse' }).click();
    await page.locator('.carnet-sheet .revisions-rate', { hasText: 'Bien' }).click();
    await page.waitForFunction(() => !document.querySelector('.carnet-sheet .revisions-rate') || document.querySelector('.carnet-sheet .cartes-card'));
    assert.strictEqual(db.reviews.length, 1, 'une réponse enregistrée une fois');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.carnet-sheet', { state: 'detached' });
    assert.ok(await page.locator('.carnet-top').isVisible(), 'Échap ferme la révision, pas le carnet');
    await page.waitForFunction(() => /rien à revoir|nouvelle/.test(document.querySelector('.carnet-deck')?.textContent ?? '') && !/1 à revoir/.test(document.querySelector('.carnet-deck').textContent));
    await page.getByRole('tab', { name: 'Cours' }).click();
    assert.strictEqual(await page.locator('[data-widget=cahier] .cahier-title').textContent(), 'La membrane');
    assert.strictEqual(await topText(page), before, 'même chapitre, même endroit après la révision');
    console.log('ok révisions et retour');

    // 8. « Gérer ce cours », dans le tiroir des chapitres : les actions du widget compact ; Échap ferme le tiroir d'abord.
    await page.getByRole('button', { name: 'Chapitres', exact: true }).click();
    assert.deepStrictEqual(await page.locator('.carnet-menu button').allTextContents(), ['Importer un cours', 'IA : cartes et résumé du chapitre', 'Modifier les chapitres', "Télécharger l'original", 'Supprimer ce cours']);
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.locator('.carnet-menu').isVisible(), false);
    assert.ok(await page.locator('.carnet-top').isVisible());
    await page.getByRole('button', { name: 'Chapitres', exact: true }).click();
    await page.locator('.carnet-menu').getByRole('button', { name: 'Modifier les chapitres' }).click();
    await page.waitForSelector('[data-widget=cahier] .cahier-edit');
    await page.getByRole('button', { name: 'Chapitres', exact: true }).click();
    await page.locator('.carnet-menu').getByRole('button', { name: 'Terminer les chapitres' }).click();
    // Note du chapitre : « Ajouter une note » sans passage choisi ; la même note que dans « Mon espace Study ».
    await page.evaluate(() => getSelection().removeAllRanges());
    await page.locator('.carnet-margin .carnet-add').click();
    await page.locator('.carnet-draft textarea').fill('Question à revoir : pourquoi si petites ?');
    await page.locator('.carnet-draft').getByRole('button', { name: 'Enregistrer la note' }).click();
    await page.waitForSelector('.carnet-chapnote');
    assert.deepStrictEqual(db.notes.map(n => [n.user_id, n.course_id, n.chapter_id, n.body]), [['u1', course, 'c0', 'Question à revoir : pourquoi si petites ?']]);
    // Chapitre suivant, en bas.
    await page.getByRole('button', { name: 'Chapitre suivant' }).click();
    await page.waitForFunction(() => document.querySelector('[data-widget=cahier] .cahier-title').textContent === 'Le noyau');
    assert.strictEqual(await page.locator('.carnet-count').textContent(), 'Chapitre 2 sur 2');
    assert.ok(await page.getByRole('button', { name: 'Chapitre précédent' }).isVisible(), 'dernier chapitre : on peut revenir');
    await page.getByRole('button', { name: 'Chapitre précédent' }).click();
    await page.waitForFunction(() => document.querySelector('[data-widget=cahier] .cahier-title').textContent === 'La membrane');
    // Clavier : flèches sur les onglets.
    await page.getByRole('tab', { name: 'Cours' }).focus();
    await page.keyboard.press('ArrowRight');
    assert.strictEqual(await page.getByRole('tab', { name: 'Mes notes' }).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('ArrowLeft');
    console.log('ok menu et clavier');

    // 9. Recharger et changer la taille de l'écran : les annotations tiennent à leur texte.
    await page.waitForTimeout(900);
    await page.reload();
    await openCarnet(page);
    await page.waitForFunction(() => CSS.highlights.has('carnet-vert'));
    assert.deepStrictEqual(await painted(page, 'carnet-vert'), ['La cellule est vivante.']);
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.waitForTimeout(300);
    assert.deepStrictEqual(await painted(page, 'carnet-vert'), ['La cellule est vivante.'], 'toujours sur le même texte après redimensionnement');
    assert.strictEqual(await page.locator('.carnet-margin').isVisible(), false, 'écran moyen : la marge est un panneau à la demande');
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('ok rechargement et redimensionnement');

    // 10. Réduire : le même widget, à sa taille et à sa place, sans rien du carnet.
    await page.getByRole('button', { name: 'Retour au tableau', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('[data-widget=cahier]').getAnimations().length);
    const again = await cahier(page).boundingBox();
    assert.deepStrictEqual([again.x, again.y, again.width, again.height].map(Math.round), [compact.x, compact.y, compact.width, compact.height].map(Math.round), 'mêmes dimensions');
    assert.strictEqual(await page.locator('.carnet-top, .carnet-side, .carnet-margin, .carnet-bar').evaluateAll(a => a.filter(n => n.checkVisibility()).length), 0);
    assert.strictEqual(await page.evaluate(() => ['carnet-vert', 'carnet-note'].some(n => CSS.highlights.has(n))), false, 'aucun surlignage dans le widget compact');
    assert.strictEqual(await page.locator('[data-widget=cahier]').count(), 1, 'un seul Cahier');
    assert.ok(await grow(page).evaluate(n => n === document.activeElement), 'le focus revient sur Agrandir');
    // Échap ferme aussi.
    await grow(page).click();
    await page.waitForSelector('.carnet-top:not([hidden])');
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.locator('.carnet-top').isVisible(), false);
    assert.deepStrictEqual(errors, []);
    await context.close();
    console.log('ok réduire');

    // 11. Annotation dont le texte a changé : dite introuvable, jamais accrochée ailleurs. Une seule autre occurrence : retrouvée.
    const db2 = newDb();
    const c2 = addCourse(db2);
    db2.marks.push(
      { id: randomUUID(), course_id: c2, kind: 'passage', page: 0, pos: 40, length: 12, quote: 'texte disparu', surligne: true, souligne: false, color: 'jaune', note: 'Ancienne note', created_at: '2026-11-10T00:00:00Z' },
      { id: randomUUID(), course_id: c2, kind: 'passage', page: 0, pos: 5, length: 18, quote: 'La membrane régule', surligne: true, souligne: false, color: 'bleu', note: null, created_at: '2026-11-10T00:00:00Z' },
      { id: randomUUID(), course_id: c2, kind: 'passage', page: 0, pos: 3, length: 23, quote: 'La cellule est vivante.', surligne: true, souligne: false, color: 'rose', note: null, created_at: '2026-11-10T00:00:00Z' });
    ({ context, page, errors } = await openBoard(browser, base, db2));
    await openCarnet(page);
    assert.match(await page.locator('.carnet-margin').textContent(), /Passage introuvable dans le cours actuel/);
    assert.deepStrictEqual(await painted(page, 'carnet-jaune'), [], 'l’annotation perdue n’est peinte nulle part');
    assert.deepStrictEqual(await painted(page, 'carnet-bleu'), ['La membrane régule'], 'une seule occurrence ailleurs : retrouvée');
    assert.deepStrictEqual(await painted(page, 'carnet-rose'), [], 'phrase répétée : on ne devine pas laquelle');
    // Annotations en panne : le cours reste lisible, c'est dit.
    db2.noMarks = true;
    await page.reload();
    await page.waitForSelector('[data-widget=cahier] .cahier-livre-open');
    await grow(page).click();
    await page.waitForSelector('.carnet-hint.bad');
    assert.match(await page.locator('.carnet-margin').textContent(), /n’ont pas pu se charger/);
    assert.ok(await cahier(page).locator('.cahier-block').first().isVisible());
    assert.deepStrictEqual(errors, []);
    await context.close();
    console.log('ok annotation introuvable, panne de chargement');

    // 12. PDF (texte extrait, deux pages) : l'annotation garde sa page. Scan sans texte : pas de fausse sélection.
    const db3 = newDb();
    addCourse(db3, { title: 'Scan', kind: 'pdf', pages: [''], chapters: [], chars: 0 });
    const pdf = addCourse(db3, { title: 'Polycopié', kind: 'pdf', pages: ['Première page du polycopié.\nElle parle de la cellule.', 'Seconde page.\nElle parle de la cellule aussi.'], chapters: [{ id: 'c0', title: 'Tout le cours', page: 0, offset: 0 }] });
    ({ context, page, errors } = await openBoard(browser, base, db3));
    await openCarnet(page);
    assert.deepStrictEqual(await cahier(page).locator('.cahier-page').allTextContents(), ['Page 1', 'Page 2']);
    await select(page, 'la cellule aussi');
    await bar(page).getByRole('button', { name: 'Surligner', exact: true }).click();
    await saved(page);
    assert.strictEqual(db3.marks[0].page, 1, 'seconde page');
    assert.strictEqual(db3.marks[0].course_id, pdf);
    await page.getByRole('button', { name: 'Chapitres', exact: true }).click();
    await page.locator('.carnet-course').selectOption({ label: 'Scan' });
    await page.waitForSelector('[data-widget=cahier] .cahier-alert');
    assert.strictEqual(await page.locator('.carnet-signet').isDisabled(), true, 'pas de signet sans texte');
    assert.strictEqual(await page.locator('.carnet-chapter').count(), 0);
    if (!await page.locator('.carnet-side').isVisible()) await page.getByRole('button', { name: 'Chapitres', exact: true }).click();
    assert.ok(await page.locator('.carnet-menu').getByRole('button', { name: "Télécharger l'original" }).isVisible(), 'l’original reste disponible');
    assert.deepStrictEqual(errors, []);
    await context.close();
    console.log('ok PDF et scan');

    // 13. Téléphone : la lecture d'abord, chapitres et notes dans des panneaux, barre utilisable, rien ne déborde.
    const db4 = newDb();
    addCourse(db4);
    ({ context, page, errors } = await openBoard(browser, base, db4, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }));
    await page.waitForSelector('[data-widget=cahier] .cahier-livre-open');
    await grow(page).tap();
    await page.waitForSelector('.carnet-top:not([hidden])');
    await page.waitForFunction(() => !document.querySelector('[data-widget=cahier]').getAnimations().length);
    assert.strictEqual(await page.locator('.carnet-side').isVisible(), false);
    assert.strictEqual(await page.locator('.carnet-margin').isVisible(), false);
    assert.ok((await cahier(page).locator('.cahier-block').first().boundingBox()).width >= 340, 'la lecture prend la largeur');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'pas de défilement de côté');
    await shot(page, 'carnet-telephone');
    await page.getByRole('button', { name: 'Chapitres', exact: true }).tap();
    assert.ok(await page.locator('.carnet-side').isVisible());
    await page.locator('.carnet-chapter', { hasText: 'Le noyau' }).tap();
    await page.waitForFunction(() => document.querySelector('[data-widget=cahier] .cahier-title').textContent === 'Le noyau');
    assert.strictEqual(await page.locator('.carnet-side').isVisible(), false, 'le panneau se referme après le choix');
    assert.notEqual(await page.locator('.cahier-block').first().evaluate(n => getComputedStyle(n).userSelect), 'none');
    await select(page, 'noyau');
    await bar(page).waitFor();
    const mb = await bar(page).boundingBox();
    assert.ok(mb.x >= 0 && mb.x + mb.width <= 390, 'barre dans l’écran');
    assert.ok((await bar(page).getByRole('button', { name: 'Ajouter une note' }).boundingBox()).height >= 44, 'cibles de 44 px');
    await bar(page).getByRole('button', { name: 'Ajouter une note' }).tap();
    await page.locator('.carnet-draft textarea').waitFor();
    assert.ok(await page.locator('.carnet-margin').isVisible(), 'la note s’ouvre dans une feuille');
    const sheetBox = await page.locator('.carnet-margin').boundingBox();
    assert.ok(sheetBox.width >= 380 && sheetBox.y > 150, 'feuille du bas, pleine largeur');
    await page.locator('.carnet-draft textarea').fill('Note au téléphone');
    await page.locator('.carnet-draft').getByRole('button', { name: 'Enregistrer la note' }).tap();
    await saved(page);
    assert.strictEqual(db4.marks[0].note, 'Note au téléphone');
    assert.strictEqual(db4.marks[0].quote, 'noyau');
    await shot(page, 'carnet-telephone-note');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepStrictEqual(errors, []);
    await context.close();
    console.log('ok téléphone');
  } finally {
    await browser.close();
    server.close();
  }
  console.log('carnet : tous les parcours passent');
})().catch(e => { console.error(e); process.exit(1); });
