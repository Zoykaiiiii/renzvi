// Base commune des tests de l'espace Study (Arbre, Constellations) : serveur du dossier site/, fausse base Supabase
// en mémoire (cours, cartes, associations, notes, stockage), ouverture du tableau et de l'espace.
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
  await context.addInitScript(session => (localStorage.setItem('sb-xjkmztfsyyccveaeyzov-auth-token', session), localStorage.setItem('renzvi:vue-defaut', 'grille')), JSON.stringify({ access_token: JWT, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER }));
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
  // Annotations du carnet : insertion (rend la ligne), modification, suppression, panne simulée (db.failMarks).
  await table('study_annotations', (route, req) => {
    db.marks ??= [];
    if (db.noMarks) return json(route, 404, { code: '42P01', message: 'absent' });
    if (req.method() === 'GET') return json(route, 200, db.marks.filter(m => m.course_id === eq(req, 'course_id')).sort((x, y) => x.page - y.page || x.pos - y.pos));
    if (db.failMarks) return json(route, 500, { message: 'panne' });
    if (req.method() === 'POST') {
      const row = { id: randomUUID(), surligne: false, souligne: false, color: 'jaune', note: null, created_at: new Date().toISOString(), ...req.postDataJSON() };
      db.marks.push(row);
      return json(route, 201, row);
    }
    const m = db.marks.find(x => x.id === eq(req, 'id'));
    if (req.method() === 'PATCH') { if (m) Object.assign(m, req.postDataJSON()); return route.fulfill({ status: 204, headers: CORS }); }
    if (req.method() === 'DELETE') { db.marks = db.marks.filter(x => x !== m); return route.fulfill({ status: 204, headers: CORS }); }
    return route.fulfill({ status: 204, headers: CORS });
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
  if (!settings.hasTouch) await page.mouse.move(600, 400); // la souris ne démarre pas sur le bord gauche, qui ouvre le menu latéral
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


module.exports = { server, makeDb, card, course, openBoard, shot, openSpace, transform, chapter, places };
