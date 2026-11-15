// Vérifie « Mon espace Study » et sa présentation Arbre (labo ?labo=1) dans un vrai Chromium, avec Supabase simulé :
// study_courses, study_cards, study_reviews, study_links, study_notes, study_answer et le stockage « cours ».
// Le simulateur refuse les doublons d'association comme la contrainte d'unicité de la base.
// La séparation entre comptes (RLS) se vérifie sur la vraie base, pas ici.
// Lancement : NODE_PATH=<dossier node_modules contenant playwright> node tests/arbre.check.cjs   (captures : SHOTS=dossier)
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', 'site');
const SHOTS = process.env.SHOTS;
const SUPABASE = 'https://xjkmztfsyyccveaeyzov.supabase.co';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const JWT = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u1', exp: 4102444800, role: 'authenticated' })}.sig`;
const USER = { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'lea@exemple.fr', app_metadata: {}, user_metadata: { full_name: 'Léa Martin' }, created_at: '2026-11-03T00:00:00Z' };
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
const CORS = { 'access-control-allow-origin': '*' };
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
const preflight = route => route.fulfill({ status: 204, headers: { ...CORS, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
const eq = (req, k) => new URL(req.url()).searchParams.get(k)?.replace(/^eq\./, '');

let stamp = 0;
function course(subject, title, chapters) {
  const id = randomUUID();
  const text = chapters.map(t => `# ${t}\nCe passage présente ${t.toLowerCase()} avec assez de mots pour former un extrait lisible dans le panneau du chapitre.`).join('\n\n');
  let at = 0;
  const list = chapters.map((t, i) => { const offset = text.indexOf(`# ${t}`, at); at = offset + 1; return { id: `c${i}`, title: t, page: 0, offset }; });
  return { row: { id, subject, title, kind: 'texte', file_name: 'cours.txt', file_size: text.length, page_count: 1, text_chars: text.length, chapters: list, created_at: new Date(Date.UTC(2026, 10, 1, 0, 0, stamp++)).toISOString() }, text };
}
function card(deck, front, due) {
  const fsrs = due ? { due, stability: 2, difficulty: 5, elapsed_days: 1, scheduled_days: 1, learning_steps: 0, reps: 1, lapses: 0, state: 2, last_review: '2026-11-10T08:00:00.000Z', first: '2026-11-10' } : null;
  return { id: randomUUID(), deck, kind: 'qa', front, back: `Réponse à : ${front}`, holes: [], course_id: null, src_page: null, src_offset: null, src_length: null, version: 1, last_rating: due ? 3 : null, last_reviewed_at: due ? '2026-11-10T08:00:00.000Z' : null, created_at: new Date(Date.UTC(2026, 10, 2, 0, 0, stamp++)).toISOString(), fsrs, due: due ?? null };
}
function makeDb(kind = 'plein') {
  const db = { rows: { ecran: { wallpaper: 'blanc', done: true, widgets: ['etude', 'minuteur'] }, minuteur: { length: 25, dur: 1500 } }, courses: [], cards: [], reviews: [], links: [], notes: [], files: {} };
  const add = (s, t, ch) => { const c = course(s, t, ch); db.courses.push(c.row); db.files[`cours/u1/${c.row.id}/texte.json`] = JSON.stringify({ v: 1, pages: [c.text] }); return c.row; };
  if (kind === 'vide') return db;
  if (kind === 'un') { add('Biologie', 'La cellule', ['La membrane', 'Le noyau']); return db; }
  if (kind === 'dense') {
    const subjects = ['Droit civil', 'Biologie', 'Histoire contemporaine', 'Mathématiques'];
    for (let i = 0; i < 9; i++) add(subjects[i % 4], `Cours ${i + 1} : un titre de cours volontairement très long pour éprouver la mise en page`, Array.from({ length: 7 }, (_, j) => `Chapitre ${j + 1} — un intitulé de chapitre vraiment très long, comme dans un vrai polycopié`));
    return db;
  }
  add('Biologie', 'La cellule', ['La membrane', 'Le noyau', 'Les organites', 'Génétique']);
  add('Histoire', 'Révolution française', ['Les causes', '1789', 'La Terreur']);
  add('Mathématiques', 'Fonctions', ['Définitions', 'Dérivées', 'Limites']);
  db.cards.push(card('Biologie cellulaire', 'Que fait la mitochondrie ?', '2026-11-12T08:00:00.000Z'), card('Biologie cellulaire', 'Où est l’ADN ?', '2026-11-13T08:00:00.000Z'), card('Biologie cellulaire', 'Rôle de la membrane ?'), card('Dates', 'Prise de la Bastille ?'), card('Dates', 'Fin de la Terreur ?'));
  return db;
}

function studyAnswer(db, a) {
  const c = db.cards.find(x => x.id === a.p_card && x.version === a.p_version && (x.last_reviewed_at ?? null) === (a.p_prev ?? null));
  if (!c) return null;
  const at = new Date(Date.parse(a.p_fsrs.last_review) + db.reviews.length).toISOString();
  Object.assign(c, { fsrs: a.p_fsrs, due: a.p_due, last_rating: a.p_rating, last_reviewed_at: at });
  db.reviews.push({ card_id: c.id, rating: a.p_rating, reviewed_at: at });
  return at;
}

async function openBoard(browser, base, db, { labo = true, ...settings } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...settings });
  await context.addInitScript(session => localStorage.setItem('sb-xjkmztfsyyccveaeyzov-auth-token', session), JSON.stringify({ access_token: JWT, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER }));
  const table = (name, handler) => context.route(`${SUPABASE}/rest/v1/${name}*`, route => route.request().method() === 'OPTIONS' ? preflight(route) : handler(route, route.request()));
  await table('widget_state', (route, req) => {
    if (req.method() === 'GET') return json(route, 200, Object.entries(db.rows).map(([widget, data]) => ({ widget, data })));
    for (const row of req.postDataJSON()) db.rows[row.widget] = row.data;
    return route.fulfill({ status: 201, headers: CORS });
  });
  await table('rpc/', (route, req) => req.url().endsWith('/study_answer') ? json(route, 200, studyAnswer(db, req.postDataJSON())) : json(route, 200, []));
  await table('study_courses', (route, req) => {
    if (req.method() === 'GET') return json(route, 200, db.courses);
    if (req.method() === 'DELETE') { const id = eq(req, 'id'); db.courses = db.courses.filter(c => c.id !== id); db.links = db.links.filter(l => l.course_id !== id); return route.fulfill({ status: 204, headers: CORS }); }
    if (req.method() === 'POST') { db.courses.push(...[req.postDataJSON()].flat().map(c => ({ created_at: new Date().toISOString(), ...c }))); return route.fulfill({ status: 201, headers: CORS }); }
    return route.fulfill({ status: 204, headers: CORS });
  });
  await table('study_cards', (route, req) => {
    if (req.method() === 'GET') { const from = Number(new URL(req.url()).searchParams.get('offset') ?? 0); return json(route, 200, db.cards.slice(from, from + 1000)); }
    if (req.method() === 'POST') { for (const row of [req.postDataJSON()].flat()) db.cards.push({ ...card(row.deck, row.front), ...row }); return route.fulfill({ status: 201, headers: CORS }); }
    return route.fulfill({ status: 204, headers: CORS });
  });
  await table('study_reviews', route => json(route, 200, []));
  await table('study_links', (route, req) => {
    if (db.noLinks) return json(route, 404, { code: '42P01', message: 'relation "public.study_links" does not exist' });
    if (req.method() === 'GET') return json(route, 200, db.links);
    if (req.method() === 'DELETE') { db.links = db.links.filter(l => l.id !== eq(req, 'id')); return route.fulfill({ status: 204, headers: CORS }); }
    if (db.failLinks) return json(route, 500, { message: 'panne' });
    db.linkPosts = (db.linkPosts ?? 0) + 1;
    const added = [];
    for (const row of [req.postDataJSON()].flat()) {
      if (db.links.some(l => l.course_id === row.course_id && l.chapter_id === row.chapter_id && l.deck === row.deck)) continue;
      added.push({ id: randomUUID(), ...row });
    }
    db.links.push(...added);
    return json(route, 201, added);
  });
  await table('study_notes', (route, req) => {
    if (db.noLinks) return json(route, 404, { code: '42P01', message: 'absent' });
    const c = eq(req, 'course_id'), ch = eq(req, 'chapter_id');
    if (req.method() === 'GET') return json(route, 200, c ? db.notes.filter(n => n.course_id === c && n.chapter_id === ch) : db.notes);
    if (req.method() === 'DELETE') { db.notes = db.notes.filter(n => !(n.course_id === c && n.chapter_id === ch)); return route.fulfill({ status: 204, headers: CORS }); }
    for (const row of [req.postDataJSON()].flat()) { db.notes = db.notes.filter(n => !(n.course_id === row.course_id && n.chapter_id === row.chapter_id)); db.notes.push(row); }
    return route.fulfill({ status: 201, headers: CORS });
  });
  await context.route(`${SUPABASE}/rest/v1/ia_*`, route => route.request().method() === 'OPTIONS' ? preflight(route) : json(route, 200, []));
  await context.route(`${SUPABASE}/storage/v1/object/**`, route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    const key = decodeURIComponent(new URL(req.url()).pathname.replace(/^\/storage\/v1\/object\/(authenticated\/)?/, ''));
    if (req.method() !== 'GET') { db.files[key] = req.postDataBuffer(); return json(route, 200, { Key: key }); }
    return db.files[key] ? route.fulfill({ status: 200, headers: CORS, body: db.files[key] }) : json(route, 404, { message: 'absent' });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${base}/dashboard.html${labo ? '?labo=1' : ''}`);
  await page.waitForSelector('[data-widget=minuteur]');
  return { context, page, errors };
}

const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); } };
const openSpace = async page => {
  await page.getByRole('button', { name: 'Ouvrir mon espace' }).click();
  await page.waitForSelector('.etude-space:not([hidden])');
};
const transform = page => page.locator('.arbre-world').evaluate(n => n.style.transform);
const chapter = (page, name) => page.locator('.arbre-chapitre', { hasText: name });
const places = page => page.locator('.arbre-label').evaluateAll(all => Object.fromEntries(all.map(b => [b.dataset.key ?? 'titre', `${b.style.left} ${b.style.top}`])));

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
    assert.ok(await page.getByRole('button', { name: 'Réviser', exact: true }).isDisabled(), 'pas de révision sans paquet associé');
    console.log('ok chapitre choisi');

    // 3. Associer : annuler ne change rien, une panne s'explique, un doublon est impossible.
    await page.getByRole('button', { name: 'Associer des flashcards' }).click();
    await page.locator('.etude-picker').getByText('Biologie cellulaire').click();
    await page.locator('.etude-picker').getByRole('button', { name: 'Annuler' }).click();
    assert.strictEqual(db.links.length, 0, 'annuler ne crée rien');
    assert.strictEqual(db.linkPosts ?? 0, 0);
    await page.waitForFunction(() => document.activeElement?.dataset.key === 'associer'); // le focus revient au bouton
    await page.getByRole('button', { name: 'Associer des flashcards' }).click();
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
    await page.getByRole('button', { name: 'Associer des flashcards' }).click();
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
    await page.getByRole('button', { name: 'Réviser', exact: true }).click();
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
    await page.getByRole('button', { name: 'Notes', exact: true }).click();
    await page.locator('.etude-note').fill('La membrane est une double couche.');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.waitForFunction(() => document.querySelector('.etude-sheet .etude-status')?.textContent === 'Enregistré');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.etude-panel [data-key=notes]:text("Notes (1)")');
    assert.strictEqual(db.notes[0].body, 'La membrane est une double couche.');
    console.log('ok notes de chapitre');

    // 6. Lire : le Cahier existant, au bon chapitre ; Échap revient à l'arbre.
    await page.getByRole('button', { name: 'Lire', exact: true }).click();
    await page.waitForSelector('.etude-sheet .cahier-text');
    assert.match(await page.locator('.etude-sheet .cahier-text').textContent(), /présente la membrane/);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.dataset.key === 'lire');
    console.log('ok lecture et retour');

    // 7. Minuteur : le dock pilote le vrai minuteur, qui continue pendant la navigation.
    await page.locator('.etude-dock .etude-tool').first().click();
    assert.strictEqual(await page.evaluate(() => window.renzviMinuteurLive().state), 'run');
    await page.getByRole('button', { name: 'Réviser', exact: true }).click();
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
    await page.locator('.arbre-matiere', { hasText: 'Histoire' }).click();
    assert.strictEqual(await chapter(page, '1789').count(), 0, 'matière repliée');
    assert.strictEqual(await page.locator('.arbre-matiere', { hasText: 'Histoire' }).getAttribute('aria-expanded'), 'false');
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
    await page.getByRole('button', { name: 'Associer des flashcards' }).click();
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
