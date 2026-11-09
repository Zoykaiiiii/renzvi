// Vérifie le widget Flashcards (Study S2) et la création de cartes depuis le Cahier, dans un vrai Chromium, avec Supabase
// simulé (tables study_cards, study_reviews, study_courses et stockage « cours »). Le simulateur reproduit les deux
// déclencheurs de la base : version qui monte quand le contenu change, dernière réponse recopiée sur la carte.
// La séparation entre comptes (RLS) se vérifie sur la vraie base, pas ici.
// Lancement : NODE_PATH=<dossier node_modules contenant playwright> node tests/cartes.check.cjs [dossier-captures]
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', 'site');
const SHOTS = process.argv[2];
const SUPABASE = 'https://xjkmztfsyyccveaeyzov.supabase.co';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const JWT = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u1', exp: 4102444800, role: 'authenticated' })}.sig`;
const USER = { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'lea@exemple.fr', app_metadata: {}, user_metadata: { full_name: 'Léa Martin' }, created_at: '2026-11-03T00:00:00Z' };
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg' };

const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
const CORS = { 'access-control-allow-origin': '*' };
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
const preflight = route => route.fulfill({ status: 204, headers: { ...CORS, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
const idOf = req => new URL(req.url()).searchParams.get('id')?.replace(/^eq\./, '');

const PAGE = '# La membrane\nElle entoure la cellule. La mitochondrie produit l’énergie de la cellule. Elle a deux membranes.\n\n# Le noyau\nIl contient l’ADN, rangé en chromosomes.';
const COURSE = { id: '11111111-1111-4111-8111-111111111111', subject: 'Biologie', title: 'La cellule', kind: 'texte', file_name: 'cellule.txt', file_size: PAGE.length, page_count: 1, text_chars: PAGE.length,
  chapters: [{ id: 'a', title: 'La membrane', page: 0, offset: 0 }, { id: 'b', title: 'Le noyau', page: 0, offset: PAGE.indexOf('# Le noyau') }] };

// Comme la fonction study_answer de la base : rien n'est écrit si la carte a changé ou si un autre onglet a répondu.
function studyAnswer(db, a) {
  const card = db.cards.find(c => c.id === a.p_card && c.version === a.p_version && (c.last_reviewed_at ?? null) === (a.p_prev ?? null));
  if (!card) return null;
  const stamp = new Date(Date.parse(a.p_fsrs.last_review) + db.reviews.length).toISOString();
  Object.assign(card, { fsrs: a.p_fsrs, due: a.p_due, last_rating: a.p_rating, last_reviewed_at: stamp });
  db.reviews.push({ card_id: card.id, card_version: card.version, rating: a.p_rating, reviewed_at: stamp });
  return stamp;
}

// supabase-js envoie un Blob en formulaire multipart : on garde seulement le fichier, comme le ferait le stockage.
function filePart(body, type) {
  const boundary = /boundary=(.+)$/.exec(type ?? '')?.[1];
  if (!boundary) return body;
  for (const part of body.toString('latin1').split(`--${boundary}`)) {
    const head = part.indexOf('\r\n\r\n');
    if (head < 0 || /name="cacheControl"/.test(part.slice(0, head))) continue;
    return Buffer.from(part.slice(head + 4, part.lastIndexOf('\r\n')), 'latin1');
  }
  return body;
}

async function openBoard(browser, base, db, options = { viewport: { width: 1440, height: 900 } }) {
  const { time, labo, waitFor = '[data-widget=cartes]', ...settings } = options;
  const context = await browser.newContext(settings);
  await context.addInitScript(session => localStorage.setItem('sb-xjkmztfsyyccveaeyzov-auth-token', session), JSON.stringify({ access_token: JWT, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER }));
  await context.route(`${SUPABASE}/rest/v1/widget_state*`, route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    if (req.method() === 'GET') return json(route, 200, Object.entries(db.rows).map(([widget, data]) => ({ widget, data })));
    for (const row of req.postDataJSON()) db.rows[row.widget] = row.data;
    return route.fulfill({ status: 201, headers: CORS });
  });
  await context.route(`${SUPABASE}/rest/v1/rpc/*`, route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    if (!req.url().endsWith('/study_answer')) return json(route, 200, []);
    if (db.failAnswer) return json(route, 500, { message: 'panne' });
    return json(route, 200, studyAnswer(db, req.postDataJSON()));
  });
  await context.route(`${SUPABASE}/rest/v1/study_courses*`, route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    if (req.method() === 'GET') return json(route, 200, db.courses);
    if (req.method() === 'DELETE') { db.courses = db.courses.filter(c => c.id !== idOf(req)); for (const c of db.cards) if (c.course_id === idOf(req)) c.course_id = null; return route.fulfill({ status: 204, headers: CORS }); }
    if (db.failCourses) return json(route, 500, { message: 'panne' });
    if (req.method() === 'POST') { db.courses.push(...[req.postDataJSON()].flat()); return route.fulfill({ status: 201, headers: CORS }); }
    return route.fulfill({ status: 204, headers: CORS });
  });
  await context.route(`${SUPABASE}/rest/v1/study_cards*`, route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    if (db.failCards) return json(route, 500, { message: 'panne' });
    if (req.method() === 'GET') {
      db.cardReads++;
      const q = new URL(req.url()).searchParams;
      const from = Number(q.get('offset') ?? 0), limit = Number(q.get('limit') ?? 1000);
      return json(route, 200, db.cards.slice(from, from + Math.min(limit, 1000)));
    }
    if (req.method() === 'POST') {
      for (const row of [req.postDataJSON()].flat()) {
        db.cards.push({ back: '', holes: [], course_id: null, fsrs: null, due: null, src_page: null, src_offset: null, src_length: null, ...row, id: randomUUID(), version: 1, last_rating: null, last_reviewed_at: null, created_at: new Date(Date.now() + db.cards.length).toISOString() });
      }
      return route.fulfill({ status: 201, headers: CORS });
    }
    const card = db.cards.find(c => c.id === idOf(req));
    if (req.method() === 'PATCH') {
      const next = { ...card, ...req.postDataJSON() };
      if (['kind', 'front', 'back', 'holes'].some(k => JSON.stringify(next[k]) !== JSON.stringify(card[k]))) Object.assign(next, { version: card.version + 1, last_rating: null, last_reviewed_at: null, fsrs: null, due: null });
      Object.assign(card, next);
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (req.method() === 'DELETE') { db.cards = db.cards.filter(c => c !== card); db.reviews = db.reviews.filter(r => r.card_id !== card.id); return route.fulfill({ status: 204, headers: CORS }); }
  });
  await context.route(`${SUPABASE}/rest/v1/study_reviews*`, route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    if (req.method() === 'GET') return json(route, 200, db.reviews.slice(0, 1));
    const r = { ...req.postDataJSON(), reviewed_at: new Date().toISOString() };
    db.reviews.push(r);
    const card = db.cards.find(c => c.id === r.card_id && c.version === r.card_version);
    if (card) Object.assign(card, { last_rating: r.rating, last_reviewed_at: r.reviewed_at });
    return route.fulfill({ status: 201, headers: CORS });
  });
  // L'IA (S5) : la fonction serveur et ses tables en lecture, simulées. La vraie logique est testée par tests/ia.check.sh.
  await context.route(`${SUPABASE}/functions/v1/ia`, route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    const b = req.postDataJSON();
    db.iaCalls = (db.iaCalls ?? 0) + 1;
    if (db.iaRefus) return json(route, 409, db.iaRefus);
    const phrases = b.texte.split(/(?<=[.!?])\s+|\n+/).map(x => x.trim()).filter(x => x.length >= 20);
    const src = x => ({ citation: x, debut: b.texte.indexOf(x), longueur: x.length });
    const resultat = b.type === 'cartes' ? { cartes: [...phrases.map((x, i) => ({ question: `Question ${i + 1} ?`, reponse: x, source: src(x) })), { question: 'Sans source ?', reponse: 'Inventée', source: null }] }
      : b.type === 'resume' ? { points: phrases.map(x => ({ texte: x, source: src(x) })) }
      : b.type === 'quiz' ? { questions: phrases.map((x, i) => ({ question: `Vrai ou faux (${i + 1}) ?`, choix: [x, 'Autre chose', 'Rien', 'Je ne sais pas'], bonne: 0, explication: 'Cité dans le cours.', source: src(x) })) }
      : { explication: `En clair : ${b.consigne}`, dans_le_cours: true, exemple_exterieur: 'Comme une centrale électrique.', source: null };
    db.ia = (db.ia ?? 10) - 1;
    (db.iaJobs ??= []).push({ id: b.travail, type: b.type, cle: b.cle ?? null, etat: 'reussi', resultat, created_at: new Date().toISOString() });
    return json(route, 200, { ok: true, travail: b.travail, credits: 1, solde: db.ia, resultat });
  });
  await context.route(`${SUPABASE}/rest/v1/ia_prix*`, route => route.request().method() === 'OPTIONS' ? preflight(route) : json(route, 200, [
    { type: 'cartes', caracteres_par_credit: 4000, credits_min: 1, credits_max: 10, caracteres_max: db.iaMax ?? 40000 }, { type: 'resume', caracteres_par_credit: 4000, credits_min: 1, credits_max: 10, caracteres_max: db.iaMax ?? 40000 }, { type: 'expliquer', caracteres_par_credit: 2000, credits_min: 1, credits_max: 1, caracteres_max: 2000 }, { type: 'quiz', caracteres_par_credit: 4000, credits_min: 1, credits_max: 10, caracteres_max: db.iaMax ?? 40000 }]));
  await context.route(`${SUPABASE}/rest/v1/ia_portefeuilles*`, route => route.request().method() === 'OPTIONS' ? preflight(route) : db.ia == null ? route.fulfill({ status: 406, headers: CORS, contentType: 'application/json', body: '{}' }) : json(route, 200, { solde: db.ia }));
  await context.route(`${SUPABASE}/rest/v1/ia_travaux*`, route => {
    if (route.request().method() === 'OPTIONS') return preflight(route);
    const q = new URL(route.request().url()).searchParams;
    const eq = k => q.get(k)?.replace(/^eq\./, '');
    return json(route, 200, (db.iaJobs ?? []).filter(j => j.type === eq('type') && j.cle === eq('cle')).slice(-1));
  });
  // Quiz (S6) : questions et réponses, avec les déclencheurs de version et de dernière réponse.
  await context.route(`${SUPABASE}/rest/v1/study_questions*`, route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    db.questions ??= [];
    if (req.method() === 'GET') {
      const q = new URL(req.url()).searchParams;
      const from = Number(q.get('offset') ?? 0);
      return json(route, 200, db.questions.slice(from, from + 1000));
    }
    if (req.method() === 'POST') {
      for (const row of [req.postDataJSON()].flat()) db.questions.push({ explication: '', course_id: null, src_page: null, src_offset: null, src_length: null, signalee: false, derniere_reussie: null, derniere_at: null, ...row, id: randomUUID(), version: 1, created_at: new Date(Date.now() + db.questions.length).toISOString() });
      return route.fulfill({ status: 201, headers: CORS });
    }
    const item = db.questions.find(x => x.id === idOf(req));
    if (req.method() === 'PATCH') {
      const next = { ...item, ...req.postDataJSON() };
      if (['question', 'choix', 'bonnes'].some(k => JSON.stringify(next[k]) !== JSON.stringify(item[k]))) Object.assign(next, { version: item.version + 1, derniere_reussie: null, derniere_at: null, signalee: false });
      Object.assign(item, next);
      return route.fulfill({ status: 204, headers: CORS });
    }
    db.questions = db.questions.filter(x => x !== item);
    return route.fulfill({ status: 204, headers: CORS });
  });
  await context.route(`${SUPABASE}/rest/v1/study_quiz_answers*`, route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    const a = req.postDataJSON();
    (db.answers ??= []).push(a);
    const item = (db.questions ?? []).find(x => x.id === a.question_id && x.version === a.question_version);
    if (item) Object.assign(item, { derniere_reussie: a.reussie, derniere_at: new Date().toISOString() });
    return route.fulfill({ status: 201, headers: CORS });
  });
  // Schémas (S7) : la table, les réponses, et les images dans le stockage.
  await context.route(`${SUPABASE}/rest/v1/study_schemas*`, route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    db.schemas ??= [];
    if (req.method() === 'GET') return json(route, 200, db.schemas);
    if (req.method() === 'POST') { db.schemas.push(...[req.postDataJSON()].flat().map(r => ({ course_id: null, src_page: null, ...r }))); return route.fulfill({ status: 201, headers: CORS }); }
    const item = db.schemas.find(x => x.id === idOf(req));
    if (req.method() === 'PATCH') { Object.assign(item, req.postDataJSON()); return route.fulfill({ status: 204, headers: CORS }); }
    db.schemas = db.schemas.filter(x => x !== item);
    return route.fulfill({ status: 204, headers: CORS });
  });
  await context.route(`${SUPABASE}/rest/v1/study_schema_answers*`, route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    db.schemaAnswers ??= [];
    if (req.method() === 'GET') return json(route, 200, [...db.schemaAnswers].reverse());
    for (const a of [req.postDataJSON()].flat()) db.schemaAnswers.push({ ...a, created_at: new Date().toISOString() });
    return route.fulfill({ status: 201, headers: CORS });
  });
  await context.route(`${SUPABASE}/storage/v1/object/**`, route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    const key = decodeURIComponent(new URL(req.url()).pathname.replace(/^\/storage\/v1\/object\/(authenticated\/)?/, ''));
    if (req.method() === 'POST' || req.method() === 'PUT') { db.files[key] = filePart(req.postDataBuffer(), req.headers()['content-type']); db.uploads = (db.uploads ?? 0) + 1; return json(route, 200, { Key: key }); }
    if (req.method() === 'DELETE') { for (const name of req.postDataJSON().prefixes) { delete db.files[`schemas/${name}`]; delete db.files[`cours/${name}`]; } return json(route, 200, []); }
    return db.files[key] ? route.fulfill({ status: 200, headers: CORS, body: db.files[key] }) : json(route, 404, { message: 'absent' });
  });
  const page = await context.newPage();
  // Une date simulée : seule l'heure est figée, les minuteries continuent de tourner.
  if (time) await page.clock.setFixedTime(time);
  db.hosts ??= new Set();
  page.on('request', r => db.hosts.add(new URL(r.url()).host));
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${base}/dashboard.html${labo ? '?labo=1' : ''}`);
  await page.waitForSelector(waitFor);
  return { context, page, errors };
}

const fresh = (widgets = ['cahier', 'cartes', 'notes']) => ({
  rows: { ecran: { wallpaper: 'blanc', widgets, done: true } }, courses: [structuredClone(COURSE)], cards: [], reviews: [], cardReads: 0,
  files: { [`cours/u1/${COURSE.id}/texte.json`]: Buffer.from(JSON.stringify({ v: 1, pages: [PAGE] })) },
});
const cartes = page => page.locator('[data-widget=cartes]');
const cahier = page => page.locator('[data-widget=cahier]');
const viewText = page => cartes(page).locator('.cartes-view').innerText();
// Sélectionne un mot du cours comme le ferait la souris.
const select = (page, word) => page.evaluate(w => {
  const block = [...document.querySelectorAll('.cahier-block')].find(b => b.textContent.includes(w));
  const at = block.textContent.indexOf(w);
  const r = document.createRange();
  r.setStart(block.firstChild, at);
  r.setEnd(block.firstChild, at + w.length);
  getSelection().removeAllRanges();
  getSelection().addRange(r);
}, word);

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false }); };
  try {
    // 1. Les règles : crochets, CSV, doublons.
    {
      const { page, context, errors } = await openBoard(browser, base, fresh());
      const r = await page.evaluate(() => {
        const holes = cartesHoles('La [mitochondrie] produit l’[énergie].');
        const back = cartesBrackets(holes.front, holes.holes);
        const bad = ['Sans crochet', 'Un [ouvert', 'Fermé] seul', 'Vide [ ] ici', '[a [b]]'].map(t => { try { cartesHoles(t); return 'accepté'; } catch (e) { return e.user ? 'refusé' : e.message; } });
        const csv = cartesFromCsv('﻿Question;Réponse\n"Capitale de l’Italie ?";Rome\n"Une ""citation"" ?";"Ligne 1\nLigne 2"\n;sans question\nsans réponse;\n\nÉlève;élève\nélève ;ÉLÈVE\nCapitale de l’Italie ?;Rome\n<b>gras</b>;<img src=x onerror=alert(1)>', [{ front: 'Déjà', back: 'là' }]);
        const comma = cartesFromCsv('a,b\nc,"d, e"');
        const tab = cartesFromCsv('un\tdeux');
        const dupe = cartesFromCsv('Déjà;là', [{ front: 'déjà', back: 'LÀ' }]);
        return { holes, back, bad, csv, comma: comma.cards.map(c => [c.front, c.back]), tab: tab.cards.map(c => [c.front, c.back]), dupe: dupe.duplicates };
      });
      assert.deepStrictEqual(r.holes, { front: 'La mitochondrie produit l’énergie.', holes: [[3, 15], [26, 33]] });
      assert.strictEqual(r.back, 'La [mitochondrie] produit l’[énergie].', 'les crochets se retrouvent pour corriger la carte');
      assert.deepStrictEqual(r.bad, ['refusé', 'refusé', 'refusé', 'refusé', 'refusé']);
      assert.deepStrictEqual(r.csv.cards.map(c => [c.front, c.back]), [['Capitale de l’Italie ?', 'Rome'], ['Une "citation" ?', 'Ligne 1\nLigne 2'], ['Élève', 'élève'], ['<b>gras</b>', '<img src=x onerror=alert(1)>']]);
      assert.deepStrictEqual(r.csv.invalid, [{ line: 5, reason: 'question vide' }, { line: 6, reason: 'réponse vide' }], 'numéros de ligne du fichier, saut de ligne entre guillemets compris');
      assert.strictEqual(r.csv.duplicates, 2, 'doublons sans accents ni majuscules, dans le fichier');
      assert.deepStrictEqual(r.comma, [['a', 'b'], ['c', 'd, e']]);
      assert.deepStrictEqual(r.tab, [['un', 'deux']]);
      assert.strictEqual(r.dupe, 1, 'doublon avec le paquet existant');
      assert.deepStrictEqual(errors, []);
      await context.close();
      console.log('ok crochets, CSV, doublons');
    }

    // 2. Créer dix cartes à la main, réviser au clavier, corriger, supprimer, recharger.
    const db = fresh();
    {
      const { page, context, errors } = await openBoard(browser, base, db);
      const w = cartes(page);
      await page.waitForFunction(() => /Crée ta première carte/.test(document.querySelector('[data-widget=cartes] .cartes-view').innerText));
      await shot(page, 'cartes-vide');
      await w.getByRole('button', { name: 'Nouvelle carte' }).click();
      await w.getByRole('button', { name: 'Créer la carte' }).click();
      assert.match(await viewText(page), /Indique le paquet/);
      await w.getByLabel('Paquet', { exact: true }).fill('Capitales');
      for (let i = 1; i <= 9; i++) {
        if (i > 1) { await w.getByRole('button', { name: 'Nouvelle carte' }).click(); assert.strictEqual(await w.getByLabel('Paquet', { exact: true }).inputValue(), 'Capitales', 'le paquet est repris'); }
        await w.getByLabel('Question').fill(`Capitale n°${i} ?`);
        await w.getByLabel('Réponse').fill(`Ville ${i}`);
        await w.getByRole('button', { name: 'Créer la carte' }).click();
        await page.waitForFunction(n => document.querySelector('[data-widget=cartes] .cahier-pick')?.selectedOptions[0]?.textContent.includes(`(${n})`), i);
      }
      await w.getByRole('button', { name: 'Nouvelle carte' }).click();
      await w.getByRole('button', { name: 'Texte à trous' }).click();
      await w.getByLabel('Texte à trous').fill('Paris est la capitale de la [France.');
      await w.getByRole('button', { name: 'Créer la carte' }).click();
      assert.match(await viewText(page), /n’est pas fermé/);
      await w.getByLabel('Texte à trous').fill('Paris est la capitale de la [France].');
      await w.getByRole('button', { name: 'Créer la carte' }).click();
      await page.waitForFunction(() => document.querySelector('[data-widget=cartes] .cahier-pick').selectedOptions[0].textContent.includes('(10)'));
      assert.strictEqual(db.cards.length, 10);
      assert.deepStrictEqual(db.cards[9].holes, [[28, 34]]);
      assert.strictEqual(db.cards[9].front, 'Paris est la capitale de la France.');

      // Révision : Espace révèle, 1 et 2 répondent.
      assert.match(await w.locator('.meta').innerText(), /^1 \/ 10$/);
      assert.match(await viewText(page), /Capitale n°1 \?/);
      assert.ok(!/Ville 1/.test(await viewText(page)), 'la réponse est cachée');
      await w.locator('.cartes-card').click();
      await page.keyboard.press('Space');
      assert.match(await viewText(page), /Ville 1/);
      await shot(page, 'cartes-reponse');
      await page.keyboard.press('2');
      await page.keyboard.press('Space');
      await page.keyboard.press('1');
      for (let i = 3; i <= 9; i++) { await w.getByRole('button', { name: 'Voir la réponse' }).click(); await w.getByRole('button', { name: 'Je savais' }).click(); }
      assert.match(await viewText(page), /·····/, 'texte à trous : mot caché');
      assert.ok(!/France/.test(await viewText(page)));
      await shot(page, 'cartes-trou');
      await w.getByRole('button', { name: 'Voir la réponse' }).click();
      assert.match(await viewText(page), /France/);
      await w.getByRole('button', { name: 'À revoir' }).click();
      assert.match(await viewText(page), /Paquet terminé[\s\S]*8 cartes sues, 2 à revoir/);
      await page.waitForTimeout(300);
      assert.strictEqual(db.reviews.length, 10);
      assert.deepStrictEqual(db.reviews.slice(0, 2).map(r => r.rating), [3, 1]);
      assert.ok(db.reviews.every(r => r.card_version === 1));
      assert.strictEqual(db.cards[1].last_rating, 1);
      await w.getByRole('button', { name: 'Recommencer' }).click();
      assert.match(await viewText(page), /Capitale n°2 \?/, 'les cartes à revoir passent en premier');

      // Corriger une carte : nouvelle version, l'ancienne réponse ne compte plus pour elle.
      await w.getByRole('button', { name: 'Gérer' }).click();
      assert.strictEqual(await w.locator('.cartes-list li').count(), 10);
      await w.getByRole('button', { name: 'Modifier la carte Capitale n°2 ?' }).click();
      assert.match(await viewText(page), /anciennes réponses ne comptent plus/);
      await w.getByLabel('Réponse').fill('Ville deux');
      await w.getByRole('button', { name: 'Enregistrer' }).click();
      await page.waitForFunction(() => /Carte enregistrée/.test(document.querySelector('[data-widget=cartes] .cahier-note').textContent));
      const edited = db.cards.find(c => c.front === 'Capitale n°2 ?');
      assert.deepStrictEqual([edited.back, edited.version, edited.last_rating], ['Ville deux', 2, null]);
      assert.strictEqual(db.reviews.filter(r => r.card_id === edited.id && r.card_version === 1).length, 1, 'ancienne réponse gardée, liée à la version 1');
      await page.waitForFunction(() => /Ville deux/.test(document.querySelector('.cartes-list')?.innerText));

      // Supprimer en deux appuis.
      await w.getByRole('button', { name: 'Supprimer la carte Capitale n°9 ?' }).click();
      assert.strictEqual(db.cards.length, 10, 'le premier appui ne supprime rien');
      await w.getByRole('button', { name: 'Supprimer la carte Capitale n°9 ?' }).click();
      await page.waitForFunction(() => document.querySelectorAll('.cartes-list li').length === 9);
      assert.strictEqual(db.cards.length, 9);
      assert.deepStrictEqual(errors, []);
      await context.close();
      console.log('ok dix cartes, révision au clavier, correction versionnée, suppression');
    }

    // 3. Import CSV : aperçu, doublons, lignes refusées, HTML inerte, puis rechargement.
    {
      const { page, context, errors } = await openBoard(browser, base, db);
      const w = cartes(page);
      await page.waitForSelector('[data-widget=cartes] .cartes-card');
      assert.match(await viewText(page), /Paris est la capitale de la ·····/, 'la carte « à revoir » revient en premier au rechargement');
      await w.getByRole('button', { name: 'Importer' }).click();
      await w.getByLabel('Paquet', { exact: true }).fill('Vocabulaire');
      const csv = 'question;réponse\n"Élève ; écolier";"Personne qui suit\nun enseignement"\n"Le mot ""ça""";Cela\n;sans question\nCela;\nhouse;maison\nHOUSE;Maison\n<script>window.pirate=1</script>;<img src=x onerror="window.pirate=2">\n';
      await w.locator('input[type=file]').setInputFiles({ name: 'vocabulaire.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
      await w.getByRole('button', { name: 'Vérifier' }).click();
      await page.waitForSelector('.cartes-preview .cartes-sum');
      const preview = await w.locator('.cartes-preview').innerText();
      assert.match(preview, /4 cartes prêtes à importer dans « Vocabulaire »/);
      assert.match(preview, /1 doublon écarté/);
      assert.match(preview, /2 lignes ignorées : ligne 5, question vide ; ligne 6, réponse vide/);
      await shot(page, 'cartes-import');
      await w.getByRole('button', { name: 'Importer 4 cartes' }).click();
      await page.waitForFunction(() => /4 cartes importées/.test(document.querySelector('[data-widget=cartes] .cahier-note').textContent));
      assert.strictEqual(db.cards.filter(c => c.deck === 'Vocabulaire').length, 4);
      assert.strictEqual(db.cards.find(c => c.front === 'Élève ; écolier').back, 'Personne qui suit\nun enseignement');
      assert.strictEqual(await w.locator('.cahier-pick').inputValue(), 'Vocabulaire', 'le paquet importé est ouvert');
      // Réimporter le même fichier : tout est en double.
      await w.getByRole('button', { name: 'Importer' }).click();
      await w.locator('input[type=file]').setInputFiles({ name: 'vocabulaire.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
      await w.getByRole('button', { name: 'Vérifier' }).click();
      await page.waitForSelector('.cartes-preview .cartes-sum');
      assert.match(await w.locator('.cartes-preview').innerText(), /Aucune carte à importer[\s\S]*5 doublons écartés/);
      await w.getByRole('button', { name: 'Annuler' }).click();
      await page.waitForTimeout(700);
      assert.strictEqual(db.rows.cartes.deck, 'Vocabulaire');
      assert.deepStrictEqual(errors, []);
      await context.close();
    }
    {
      const { page, context, errors } = await openBoard(browser, base, db);
      const w = cartes(page);
      await page.waitForFunction(() => document.querySelector('[data-widget=cartes] .cahier-pick')?.value === 'Vocabulaire');
      assert.strictEqual(await w.locator('.meta').innerText(), '1 / 4', 'le paquet choisi est repris au rechargement');
      await w.getByRole('button', { name: 'Gérer' }).click();
      assert.match(await w.locator('.cartes-list').innerText(), /<script>window\.pirate=1<\/script>/);
      assert.strictEqual(await page.evaluate(() => window.pirate), undefined, 'le HTML du CSV reste du texte');
      assert.strictEqual(await w.locator('.cartes-list script, .cartes-list img').count(), 0);
      assert.deepStrictEqual(errors, []);
      await context.close();
      console.log('ok import CSV, aperçu, doublons, HTML inerte, reprise du paquet');
    }

    // 4. Depuis le Cahier : sélection → carte, puis « Revoir dans le cours » surligne le passage, même sur une autre page.
    {
      const db3 = fresh();
      db3.rows.ecran = { wallpaper: 'blanc', widgets: ['cahier', 'cartes'], done: true, pages: [{ id: 'p1', name: 'Cours' }, { id: 'p2', name: 'Révisions' }], where: { cahier: 'p1', cartes: 'p1' } };
      const { page, context, errors } = await openBoard(browser, base, db3);
      const c = cahier(page);
      await page.waitForFunction(() => document.querySelector('[data-widget=cahier] .cahier-title')?.textContent === 'La membrane');
      assert.ok(await c.locator('.cahier-cardbar').isHidden(), 'rien à proposer sans sélection');
      await select(page, 'mitochondrie');
      await c.getByRole('button', { name: 'Masquer ces mots' }).waitFor();
      await shot(page, 'cahier-selection');
      await c.getByRole('button', { name: 'Masquer ces mots' }).click();
      assert.strictEqual(await c.getByLabel('Texte à trous').inputValue(), 'La [mitochondrie] produit l’énergie de la cellule.', 'la phrase autour de la sélection');
      assert.strictEqual(await c.getByLabel('Paquet', { exact: true }).inputValue(), 'La cellule');
      await shot(page, 'cahier-carte');
      await c.getByRole('button', { name: 'Créer la carte' }).click();
      await page.waitForFunction(() => /Carte créée/.test(document.querySelector('[data-widget=cahier] .cahier-note').textContent));
      const trou = db3.cards[0];
      assert.deepStrictEqual([trou.kind, trou.course_id, trou.src_page, trou.src_offset, trou.src_length], ['trou', COURSE.id, 0, PAGE.indexOf('mitochondrie'), 12]);
      await page.waitForFunction(() => /·····/.test(document.querySelector('[data-widget=cartes] .cartes-view').innerText), null, { timeout: 5000 });

      await c.locator('.cahier-nav select').selectOption({ label: 'Le noyau' });
      await select(page, 'Il contient l’ADN, rangé en chromosomes.');
      await c.getByRole('button', { name: 'Créer une carte' }).click();
      assert.strictEqual(await c.getByLabel('Réponse').inputValue(), 'Il contient l’ADN, rangé en chromosomes.');
      await c.getByRole('button', { name: 'Créer la carte' }).click();
      assert.match(await c.locator('.cartes-form').innerText(), /Écris la question/);
      assert.ok(await c.getByLabel('Question').evaluate(e => e === document.activeElement), 'le curseur va dans la question');
      await c.getByLabel('Question').fill('Que contient le noyau ?');
      await c.getByRole('button', { name: 'Créer la carte' }).click();
      await page.waitForFunction(() => /Carte créée/.test(document.querySelector('[data-widget=cahier] .cahier-note').textContent));
      assert.strictEqual(db3.cards.length, 2);

      // On met le Cahier sur une autre page, puis on revoit le passage de la première carte depuis les flashcards.
      db3.rows.ecran.where.cahier = 'p2';
      await context.close();
      const again = await openBoard(browser, base, db3);
      const p2 = again.page, w = cartes(p2);
      await p2.waitForFunction(() => /·····/.test(document.querySelector('[data-widget=cartes] .cartes-view').innerText));
      assert.ok(await cahier(p2).isHidden(), 'le Cahier est sur l’autre page');
      await w.getByRole('button', { name: 'Voir la réponse' }).click();
      await w.getByRole('button', { name: 'Revoir dans le cours' }).click();
      await p2.waitForFunction(() => window.CSS.highlights.get('cahier')?.size === 1);
      const lit = await p2.evaluate(() => [...CSS.highlights.get('cahier')][0].toString());
      assert.strictEqual(lit, 'mitochondrie', 'le passage source est surligné');
      assert.ok(await cahier(p2).isVisible(), 'on passe sur la page du Cahier');
      assert.strictEqual(await cahier(p2).locator('.cahier-title').innerText(), 'La membrane');
      await shot(p2, 'cartes-revoir');

      // Le cours supprimé, la carte reste et le dit.
      db3.courses = [];
      for (const card of db3.cards) card.course_id = null;
      await again.context.close();
      const third = await openBoard(browser, base, db3);
      await third.page.waitForFunction(() => /·····/.test(document.querySelector('[data-widget=cartes] .cartes-view').innerText));
      await cartes(third.page).getByRole('button', { name: 'Voir la réponse' }).click();
      assert.strictEqual(await cartes(third.page).getByRole('button', { name: 'Revoir dans le cours' }).count(), 0, 'pas de lien vers un cours supprimé');
      assert.deepStrictEqual([...errors, ...again.errors, ...third.errors], []);
      await third.context.close();
      console.log('ok carte depuis une sélection, revoir le passage sur une autre page, cours supprimé');
    }

    // 5. Panne au chargement et à la création.
    {
      const db4 = fresh();
      db4.failCards = true;
      const { page, context, errors } = await openBoard(browser, base, db4);
      const w = cartes(page);
      await page.waitForFunction(() => /n'ont pas pu se charger/.test(document.querySelector('[data-widget=cartes] .cartes-view').innerText));
      db4.failCards = false;
      await w.getByRole('button', { name: 'Réessayer' }).click();
      await page.waitForFunction(() => /Crée ta première carte/.test(document.querySelector('[data-widget=cartes] .cartes-view').innerText));
      await w.getByRole('button', { name: 'Nouvelle carte' }).click();
      await w.getByLabel('Paquet', { exact: true }).fill('Test');
      await w.getByLabel('Question').fill('Q');
      await w.getByLabel('Réponse').fill('R');
      db4.failCards = true;
      await w.getByRole('button', { name: 'Créer la carte' }).click();
      await page.waitForFunction(() => /pas été créée/.test(document.querySelector('[data-widget=cartes] .cartes-form').innerText));
      assert.strictEqual(await w.getByLabel('Question').inputValue(), 'Q', 'rien de ce qui est tapé ne se perd');
      assert.deepStrictEqual(errors, []);
      await context.close();
      console.log('ok pannes');
    }

    // 7. Révisions du jour (S3) : plusieurs jours simulés, limite de nouvelles cartes, double clic, deux onglets,
    // carte modifiée ou supprimée, panne, fuseaux horaires. Aucune requête vers un fournisseur d'IA.
    {
      const PARIS = { viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Paris', locale: 'fr-FR' };
      const day1 = new Date('2026-11-10T09:00:00+01:00');
      const dbr = fresh(['revisions', 'cartes']);
      for (let i = 1; i <= 25; i++) dbr.cards.push({ id: randomUUID(), deck: i <= 22 ? 'Vocabulaire' : 'Dates', kind: 'qa', front: `Mot ${i}`, back: `Sens ${i}`, holes: [], course_id: null, src_page: null, src_offset: null, src_length: null, fsrs: null, due: null, version: 1, last_rating: null, last_reviewed_at: null, created_at: new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString() });
      const rev = page => page.locator('[data-widget=revisions]');
      const revText = page => rev(page).locator('.cartes-view').innerText();
      const reviewsOf = id => dbr.reviews.filter(r => r.card_id === id).length;

      // Jour 1 : 25 nouvelles cartes, 20 au plus aujourd'hui.
      let { page, context, errors } = await openBoard(browser, base, dbr, { ...PARIS, time: day1 });
      let w = rev(page);
      await page.waitForSelector('[data-widget=revisions] .cartes-card');
      assert.strictEqual(await w.locator('.meta').innerText(), "20 aujourd'hui", '20 nouvelles cartes par jour au plus');
      assert.match(await revText(page), /Nouvelle carte[\s\S]*Mot 1/);
      await w.locator('.cartes-card').click();
      await page.keyboard.press('Space');
      const labels = await w.locator('.revisions-rate').allInnerTexts();
      assert.deepStrictEqual(labels.map(l => l.split('\n')[0]), ['À revoir', 'Difficile', 'Bien', 'Facile']);
      assert.deepStrictEqual(labels.slice(0, 3).map(l => l.split('\n')[1]), ['1 min', '6 min', '10 min'], 'les délais viennent de FSRS');
      assert.match(labels[3], /\d+ j$/);
      await shot(page, 'revisions-reponse');
      await page.keyboard.press('1');
      await page.waitForFunction(() => /Mot 2/.test(document.querySelector('[data-widget=revisions] .cartes-view').innerText));
      await w.getByRole('button', { name: 'Voir la réponse' }).click();
      await w.getByRole('button', { name: /^Difficile/ }).click();
      await page.waitForFunction(() => /Mot 3/.test(document.querySelector('[data-widget=revisions] .cartes-view').innerText));
      // Un double clic ne compte qu'une réponse.
      await w.getByRole('button', { name: 'Voir la réponse' }).click();
      const third = dbr.cards[2].id;
      await w.getByRole('button', { name: /^Facile/ }).dblclick();
      await page.waitForFunction(() => /Mot 4/.test(document.querySelector('[data-widget=revisions] .cartes-view').innerText));
      await page.waitForTimeout(300);
      assert.strictEqual(reviewsOf(third), 1, 'double clic : une seule réponse');
      for (let i = 4; i <= 20; i++) {
        await w.getByRole('button', { name: 'Voir la réponse' }).click();
        await w.getByRole('button', { name: /^Facile/ }).click();
        await page.waitForFunction(n => !document.querySelector('[data-widget=revisions] .cartes-view').innerText.includes(`Mot ${n}\n`) || false, i);
      }
      // Les deux cartes ratées reviennent en fin de séance.
      await page.waitForFunction(() => /Mot 1\b/.test(document.querySelector('[data-widget=revisions] .cartes-view').innerText));
      await w.getByRole('button', { name: 'Voir la réponse' }).click();
      await w.getByRole('button', { name: /^Facile/ }).click();
      await page.waitForFunction(() => /Mot 2\b/.test(document.querySelector('[data-widget=revisions] .cartes-view').innerText));
      await w.getByRole('button', { name: 'Voir la réponse' }).click();
      await w.getByRole('button', { name: /^Facile/ }).click();
      await page.waitForFunction(() => /Séance terminée/.test(document.querySelector('[data-widget=revisions] .cartes-view').innerText));
      const done = await revText(page);
      assert.match(done, /22 réponses : 1 à revoir, 1 difficile, 0 bien, 20 facile/);
      assert.match(done, /Rien de prévu demain|Demain : \d+ carte/);
      assert.match(done, /Tes difficultés de la séance[\s\S]*Mot 1 — Sens 1[\s\S]*Mot 2 — Sens 2/);
      assert.match(done, /Apprendre 5 nouvelles cartes/);
      await shot(page, 'revisions-fin');
      assert.strictEqual(dbr.reviews.length, 22);
      assert.ok(dbr.cards.slice(0, 20).every(c => c.fsrs && new Date(c.due) > day1), 'chaque carte vue a une échéance');
      assert.strictEqual(dbr.cards[0].fsrs.lapses, 0);
      assert.deepStrictEqual(errors, []);
      await context.close();

      // Rechargement le même jour : la progression est gardée, rien n'est redemandé.
      ({ page, context, errors } = await openBoard(browser, base, dbr, { ...PARIS, time: new Date(day1.getTime() + 3600e3) }));
      w = rev(page);
      await page.waitForFunction(() => /Rien à revoir aujourd'hui/.test(document.querySelector('[data-widget=revisions] .cartes-view').innerText));
      await w.getByRole('button', { name: 'Apprendre 5 nouvelles cartes' }).click();
      assert.strictEqual(await w.locator('.meta').innerText(), "5 aujourd'hui");
      // Le choix du paquet : « Dates » n'a que ses 3 cartes.
      await w.locator('.cahier-pick').selectOption('Dates');
      assert.match(await w.locator('.cahier-pick').inputValue(), /Dates/);
      await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
      assert.strictEqual(dbr.rows.revisions.deck, 'Dates', 'le paquet choisi est gardé');
      assert.deepStrictEqual(errors, []);
      await context.close();

      // Plusieurs jours plus tard, la veille au soir de la dernière échéance + 3 jours : tout est dû, en retard d'abord.
      const last = Math.max(...dbr.cards.filter(c => c.due).map(c => Date.parse(c.due)));
      const later = new Date(last + 3 * 864e5);
      ({ page, context, errors } = await openBoard(browser, base, dbr, { ...PARIS, time: later }));
      w = rev(page);
      await page.waitForSelector('[data-widget=revisions] .cartes-card');
      await page.waitForFunction(() => document.querySelector('[data-widget=revisions] .cahier-pick').value === 'Dates');
      await w.locator('.cahier-pick').selectOption('');
      assert.strictEqual(await w.locator('.meta').innerText(), "25 aujourd'hui", '20 cartes dues et les 5 nouvelles restantes');
      assert.match(await revText(page), /En retard depuis le/);
      await shot(page, 'revisions-retard');
      const first = dbr.cards.slice(0, 20).sort((a, b) => Date.parse(a.due) - Date.parse(b.due))[0];
      assert.match(await revText(page), new RegExp(`${first.front}\\b`), 'la plus en retard en premier');
      const before = first.fsrs.stability;
      await w.getByRole('button', { name: 'Voir la réponse' }).click();
      await w.getByRole('button', { name: /^Bien/ }).click();
      await page.waitForFunction(() => /24 aujourd'hui/.test(document.querySelector('[data-widget=revisions] .meta').textContent));
      assert.ok(first.fsrs.stability > before, 'une carte sue à temps tient plus longtemps');
      assert.ok(Date.parse(first.due) > later.getTime() + 864e5, 'et revient plus tard');

      // Deux onglets : la même carte répondue dans le premier n'est pas comptée une deuxième fois dans le second.
      const tab2 = await context.newPage();
      await tab2.clock.setFixedTime(later);
      await tab2.goto(`${base}/dashboard.html`);
      await tab2.waitForSelector('[data-widget=revisions] .cartes-card');
      await rev(tab2).locator('.cahier-pick').selectOption('');
      const shown = await revText(page);
      const target = dbr.cards.find(c => new RegExp(`${c.front}\\b`).test(shown) && c.front !== first.front);
      await w.getByRole('button', { name: 'Voir la réponse' }).click();
      await w.getByRole('button', { name: /^Bien/ }).click();
      await page.waitForFunction(() => /23 aujourd'hui/.test(document.querySelector('[data-widget=revisions] .meta').textContent));
      assert.match(await rev(tab2).locator('.cartes-view').innerText(), new RegExp(`${target.front}\\b`), 'le second onglet montre encore l’ancienne carte');
      const counted = reviewsOf(target.id);
      await rev(tab2).getByRole('button', { name: 'Voir la réponse' }).click();
      await rev(tab2).getByRole('button', { name: /^Facile/ }).click();
      await tab2.waitForFunction(() => /changé ailleurs/.test(document.querySelector('[data-widget=revisions] .cahier-note').textContent));
      assert.strictEqual(reviewsOf(target.id), counted, 'la réponse du second onglet n’est pas comptée en plus');
      await tab2.waitForFunction(() => /23 aujourd'hui/.test(document.querySelector('[data-widget=revisions] .meta').textContent));
      await tab2.close();

      // Panne : la carte reste, rien n'avance.
      dbr.failAnswer = true;
      const stuck = await revText(page);
      await w.getByRole('button', { name: 'Voir la réponse' }).click();
      await w.getByRole('button', { name: /^Bien/ }).click();
      await page.waitForFunction(() => /n'a pas été enregistrée/.test(document.querySelector('[data-widget=revisions] .cahier-note').textContent));
      assert.strictEqual(await w.locator('.meta').innerText(), "23 aujourd'hui");
      assert.strictEqual(stuck.split('\n').find(l => /^Mot/.test(l)), (await revText(page)).split('\n').find(l => /^Mot/.test(l)));
      dbr.failAnswer = false;

      // Carte supprimée ailleurs pendant la séance : la réponse est refusée et la file rechargée.
      const victim = dbr.cards.find(c => new RegExp(`${c.front}\\b`).test(stuck));
      dbr.cards = dbr.cards.filter(c => c !== victim);
      await w.getByRole('button', { name: /^Bien/ }).click();
      await page.waitForFunction(() => /22 aujourd'hui/.test(document.querySelector('[data-widget=revisions] .meta').textContent));
      assert.deepStrictEqual(errors, []);
      await context.close();

      // Carte modifiée : elle redevient nouvelle (sa planification valait pour l'ancienne version).
      const edited = dbr.cards.find(c => c.fsrs && c !== victim);
      Object.assign(edited, { deck: 'Modifiée', back: 'Nouveau sens', version: edited.version + 1, fsrs: null, due: null, last_rating: null, last_reviewed_at: null });
      ({ page, context, errors } = await openBoard(browser, base, dbr, { ...PARIS, time: later }));
      w = rev(page);
      await page.waitForSelector('[data-widget=revisions] .cartes-card');
      await w.locator('.cahier-pick').selectOption('Modifiée');
      assert.match(await revText(page), /Nouvelle carte/, 'une carte modifiée repart de zéro');
      await w.getByRole('button', { name: 'Voir la réponse' }).click();
      assert.match(await revText(page), /Nouveau sens/);
      assert.deepStrictEqual(errors, []);
      await context.close();

      // Fuseaux : une échéance à 00 h 30 à Paris n'est pas « aujourd'hui » à 23 h 30, mais l'est déjà à Auckland.
      const instant = new Date('2026-11-10T22:30:00Z');
      const card = [{ id: 'x', fsrs: { first: '2026-11-01' }, due: '2026-11-10T23:30:00Z', created_at: '2026-11-01' }];
      const inZone = async zone => {
        const b = await openBoard(browser, base, fresh(['revisions', 'cartes']), { timezoneId: zone, time: instant });
        const n = await b.page.evaluate(c => revisionsQueue(c).ids.length, card);
        assert.deepStrictEqual(b.errors, []);
        await b.context.close();
        return n;
      };
      assert.strictEqual(await inZone('Europe/Paris'), 0, 'Paris : due demain');
      assert.strictEqual(await inZone('Pacific/Auckland'), 1, 'Auckland : due aujourd’hui');

      const ai = [...dbr.hosts].filter(h => /openai|anthropic|fal\.|gemini|generativelanguage|mistral|cohere|huggingface/i.test(h));
      assert.deepStrictEqual(ai, [], 'aucune requête vers un fournisseur d’IA');
      console.log('ok révisions : jours simulés, limite, double clic, deux onglets, panne, suppression, fuseaux, sans IA');
    }

    // 8. IA depuis le Cahier (S5) : coût annoncé, aperçu des cartes, sources, résultat gardé, résumé, explication, refus.
    {
      const dbi = fresh(['cahier', 'cartes']);
      const { page, context, errors } = await openBoard(browser, base, dbi);
      const c = cahier(page);
      await page.waitForFunction(() => document.querySelector('[data-widget=cahier] .cahier-title')?.textContent === 'La membrane');
      await c.getByRole('button', { name: 'IA : cartes et résumé du chapitre' }).click();
      await c.getByRole('button', { name: 'Générer des cartes · 1 crédit' }).waitFor();
      assert.match(await c.locator('.ia-panel').innerText(), /crédits de découverte à la première utilisation/);
      await shot(page, 'ia-panneau');
      await c.getByRole('button', { name: 'Générer des cartes · 1 crédit' }).dblclick();
      await c.getByRole('button', { name: 'Ajouter les cartes cochées' }).waitFor();
      assert.strictEqual(dbi.iaCalls, 1, 'double clic : une seule génération');
      assert.match(await c.locator('.ia-panel').innerText(), /1 crédit utilisé, il t'en reste 9/);
      const boxes = c.locator('.ia-list input[type=checkbox]');
      const checked = await boxes.evaluateAll(b => b.map(x => x.checked));
      assert.deepStrictEqual([checked.at(-1), checked.slice(0, -1).every(Boolean)], [false, true], 'la carte sans source est décochée');
      const proposed = checked.length - 1;
      await shot(page, 'ia-cartes');
      await c.getByRole('button', { name: 'Ajouter les cartes cochées' }).click();
      await page.waitForFunction(n => new RegExp(`${n} cartes ajoutées au paquet « La cellule »`).test(document.querySelector('.ia-panel').innerText), proposed);
      assert.strictEqual(dbi.cards.length, proposed);
      const made = dbi.cards.find(x => x.back.startsWith('Elle entoure'));
      assert.deepStrictEqual([made.course_id, made.src_page, PAGE.slice(made.src_offset, made.src_offset + made.src_length)], [COURSE.id, 0, made.back], 'la carte garde son passage source');
      await page.waitForFunction(() => /Question 1 \?/.test(document.querySelector('[data-widget=cartes] .cartes-view').innerText));
      // Le résultat est gardé : le revoir est gratuit, régénérer est un choix.
      await c.getByRole('button', { name: 'Fermer' }).click();
      await c.getByRole('button', { name: 'IA : cartes et résumé du chapitre' }).click();
      await c.getByRole('button', { name: 'Générer des cartes : revoir le résultat (gratuit)' }).click();
      assert.match(await c.locator('.ia-out').innerText(), /Cartes déjà générées/);
      assert.ok(await c.getByRole('button', { name: 'Régénérer · 1 crédit' }).isVisible());
      assert.strictEqual(dbi.iaCalls, 1, 'revoir ne rappelle pas l’IA');
      // Résumé et « Voir dans le cours ».
      await c.getByRole('button', { name: 'Résumer · 1 crédit' }).click();
      await c.locator('.ia-list .link').first().waitFor();
      await c.locator('.ia-list .link').first().click();
      assert.strictEqual(await page.evaluate(() => [...CSS.highlights.get('cahier')][0].toString()), 'Elle entoure la cellule.');
      // Refus du serveur : message clair, rien d'ajouté.
      dbi.iaRefus = { ok: false, raison: 'solde_insuffisant', credits: 3, solde: 0 };
      await c.getByRole('button', { name: 'Régénérer · 1 crédit' }).first().click();
      await page.waitForFunction(() => /Il te faut 3 crédits, tu en as 0/.test(document.querySelector('.ia-panel').innerText));
      dbi.iaRefus = null;
      await c.getByRole('button', { name: 'Fermer' }).click();
      // Expliquer une sélection.
      await select(page, 'mitochondrie');
      await c.getByRole('button', { name: 'Expliquer (IA)' }).click();
      assert.match(await c.locator('.ia-panel').innerText(), /« mitochondrie »/);
      await c.getByRole('button', { name: 'Expliquer · 1 crédit' }).click();
      await page.waitForFunction(() => /D'après ton cours[\s\S]*En clair : mitochondrie[\s\S]*Exemple qui ne vient pas de ton cours/.test(document.querySelector('.ia-panel').innerText));
      await shot(page, 'ia-expliquer');
      // Chapitre trop long : bouton désactivé, pas de troncature silencieuse.
      assert.deepStrictEqual(errors, []);
      await context.close();
      dbi.iaMax = 50;
      const long = await openBoard(browser, base, dbi);
      await long.page.waitForFunction(() => document.querySelector('[data-widget=cahier] .cahier-title')?.textContent === 'La membrane');
      await cahier(long.page).getByRole('button', { name: 'IA : cartes et résumé du chapitre' }).click();
      await long.page.waitForFunction(() => /trop long pour l'IA/.test(document.querySelector('.ia-panel').innerText));
      assert.ok(await cahier(long.page).getByRole('button', { name: /^Régénérer · / }).first().isDisabled(), 'pas de troncature silencieuse');
      assert.deepStrictEqual(long.errors, []);
      await long.context.close();
      console.log('ok IA dans le Cahier : coût, aperçu, sources, résultat gardé, résumé, explication, refus, trop long');
    }

    // 9. Quiz (S6), widget caché sauf ?labo=1 : création, import, séance mélangée, erreurs, signalement, correction, IA.
    {
      const dbq = fresh(['cahier', 'cartes', 'quiz']);
      // Sans ?labo=1, le quiz n'apparaît nulle part, même s'il est dans la configuration enregistrée.
      const pub = await openBoard(browser, base, dbq);
      await pub.page.waitForSelector('[data-widget=cahier]');
      assert.strictEqual(await pub.page.locator('[data-widget=quiz]').count(), 0, 'caché sur le site public');
      await pub.page.click('#open-add');
      assert.ok(!(await pub.page.locator('#catalog').innerText()).includes('Quiz'), 'absent du catalogue public');
      assert.deepStrictEqual(pub.errors, []);
      await pub.context.close();
      assert.deepStrictEqual(dbq.rows.ecran.widgets, ['cahier', 'cartes', 'quiz'], 'la configuration enregistrée n’est pas abîmée');

      const { page, context, errors } = await openBoard(browser, base, dbq, { viewport: { width: 1440, height: 900 }, labo: true });
      const w = page.locator('[data-widget=quiz]');
      const qText = () => w.locator('.cartes-view').innerText();
      await page.waitForFunction(() => /Écris une question/.test(document.querySelector('[data-widget=quiz] .cartes-view')?.innerText ?? ''));
      await w.getByRole('button', { name: 'Nouvelle question' }).click();
      await w.getByLabel('Paquet', { exact: true }).fill('Biologie');
      await w.getByLabel('Question', { exact: true }).fill('Quels organites ont deux membranes ?');
      for (const [i, v] of ['Mitochondrie', 'Noyau', 'Ribosome', 'Mitochondrie'].entries()) await w.getByLabel(`Choix ${i + 1}`, { exact: true }).fill(v);
      await w.getByRole('button', { name: 'Créer la question' }).click();
      assert.match(await qText(), /Deux choix sont identiques/);
      await w.getByLabel('Choix 4', { exact: true }).fill('Chloroplaste');
      await w.getByRole('button', { name: 'Créer la question' }).click();
      assert.match(await qText(), /Coche au moins une bonne réponse/);
      for (const n of [1, 2, 4]) await w.getByLabel(`Choix ${n} : bonne réponse`).check();
      await w.getByLabel('Explication (facultative)').fill('Mitochondrie, noyau et chloroplaste ont une double membrane.');
      await w.getByRole('button', { name: 'Créer la question' }).click();
      await page.waitForFunction(() => /Question créée/.test(document.querySelector('[data-widget=quiz] .cahier-note').textContent));
      assert.deepStrictEqual(dbq.questions[0].bonnes, [0, 1, 3]);

      // Import CSV : 3 bonnes lignes, 1 sans mauvaise réponse, 1 doublon.
      await w.getByRole('button', { name: 'Importer' }).click();
      await w.getByLabel('Paquet', { exact: true }).fill('Biologie');
      await w.getByLabel('Lignes à importer').fill('question;bonne;mauvaise;mauvaise\nOù est l’ADN ?;Le noyau;La membrane;Le ribosome\n"Énergie ; qui la produit ?";La mitochondrie;Le noyau\nUne seule réponse ?;Oui\nQui a des chloroplastes ?;Les plantes;Les animaux\nOù est l’ADN ?;Le noyau;Ailleurs');
      await w.getByRole('button', { name: 'Vérifier' }).click();
      assert.match(await w.locator('.cartes-preview').innerText(), /3 questions prêtes[\s\S]*1 doublon[\s\S]*ligne 4, il faut au moins deux choix/);
      await w.getByRole('button', { name: 'Importer 3 questions' }).click();
      await page.waitForFunction(() => /3 questions importées/.test(document.querySelector('[data-widget=quiz] .cahier-note').textContent));
      assert.strictEqual(dbq.questions.length, 4);

      // Séance de 5 : les choix sont mélangés, la correction suit le libellé, pas la position.
      await page.waitForFunction(() => /4 questions prêtes/.test(document.querySelector('[data-widget=quiz] .cartes-view').innerText));
      await w.getByRole('button', { name: '5 questions' }).click();
      await w.getByRole('button', { name: 'Commencer' }).click();
      const seen = [];
      let wrong = null;
      for (let i = 0; i < 4; i++) {
        const text = await qText();
        const q = dbq.questions.find(x => text.includes(x.question));
        seen.push(await w.locator('.quiz-choice').allInnerTexts().then(t => t.map(x => x.replace(/^\d\s*/, ''))));
        const goodLabels = q.bonnes.map(b => q.choix[b]);
        // On rate exprès la question « Où est l’ADN ? ».
        const pickLabels = q.question === 'Où est l’ADN ?' ? ['La membrane'] : goodLabels;
        for (const label of pickLabels) await w.locator('.quiz-choice', { hasText: label }).click();
        await w.getByRole('button', { name: 'Valider' }).click();
        if (q.question === 'Où est l’ADN ?') { wrong = q; assert.match(await qText(), /Pas tout à fait[\s\S]*Le noyau[\s\S]*Bonne réponse/); await shot(page, 'quiz-erreur'); }
        else assert.match(await qText(), /^[\s\S]*Bonne réponse/);
        if (q.question.startsWith('Quels organites')) assert.match(await qText(), /double membrane/, 'explication affichée après réponse');
        await w.getByRole('button', { name: /Question suivante|Voir le bilan/ }).click();
      }
      assert.match(await qText(), /3 bonnes réponses sur 4[\s\S]*À revoir[\s\S]*Où est l’ADN \? — Le noyau/);
      await shot(page, 'quiz-bilan');
      await page.waitForTimeout(200);
      assert.strictEqual(dbq.answers.length, 4);
      assert.strictEqual(dbq.questions.find(x => x === wrong).derniere_reussie, false);
      assert.ok(seen.every(list => list.length >= 2));

      // Refaire mes erreurs, puis signaler la question et la corriger : nouvelle version, signalement levé.
      await w.getByRole('button', { name: 'Refaire mes erreurs (1)' }).click();
      assert.match(await qText(), /Où est l’ADN \?/);
      await w.locator('.quiz-choice', { hasText: 'Le noyau' }).click();
      await page.keyboard.press('Enter');
      assert.match(await qText(), /Bonne réponse/);
      await w.getByRole('button', { name: 'Signaler une erreur dans cette question' }).click();
      await page.waitForFunction(() => /Signalée/.test(document.querySelector('[data-widget=quiz] .cartes-view').innerText));
      assert.strictEqual(wrong.signalee, true);
      await w.getByRole('button', { name: 'Gérer', exact: true }).click();
      assert.match(await w.locator('.cartes-list li').first().innerText(), /⚠ Signalée · Où est l’ADN/, 'les questions signalées en tête');
      await w.getByRole('button', { name: 'Modifier la question Où est l’ADN ?' }).click();
      await w.getByLabel('Question', { exact: true }).fill('Où se trouve l’ADN chez les eucaryotes ?');
      await w.getByRole('button', { name: 'Enregistrer' }).click();
      await page.waitForFunction(() => /Question enregistrée/.test(document.querySelector('[data-widget=quiz] .cahier-note').textContent));
      assert.deepStrictEqual([wrong.version, wrong.signalee, wrong.derniere_reussie], [2, false, null]);
      assert.ok(dbq.answers.some(a => a.question_id === wrong.id && a.question_version === 1), 'les anciennes réponses restent, liées à la version 1');

      // Générer un quiz depuis le Cahier (IA simulée) : les questions rejoignent le widget Quiz.
      const c = cahier(page);
      await c.getByRole('button', { name: 'IA : cartes et résumé du chapitre' }).click();
      await c.getByRole('button', { name: 'Générer un quiz · 1 crédit' }).click();
      await c.getByRole('button', { name: 'Ajouter les questions cochées' }).click();
      await page.waitForFunction(() => /ajoutées? au quiz « La cellule »/.test(document.querySelector('.ia-panel').innerText));
      const fromIa = dbq.questions.filter(q => q.deck === 'La cellule');
      assert.ok(fromIa.length >= 2 && fromIa.every(q => q.course_id === COURSE.id && PAGE.slice(q.src_offset, q.src_offset + q.src_length) === q.choix[0]), 'questions reliées à leur passage');
      await page.waitForFunction(() => /La cellule/.test(document.querySelector('[data-widget=quiz] .cahier-pick').innerText));
      assert.deepStrictEqual(errors, []);
      await context.close();
      console.log('ok quiz : caché sans labo, création, import, séance mélangée, erreurs, signalement, correction, IA');
    }

    // 10. Schémas (S7) : image, zones à la souris et au clavier, tirage, caches opaques, erreurs, image remplacée, page de PDF.
    {
      const shotPage = await browser.newPage({ viewport: { width: 800, height: 500 } });
      await shotPage.setContent('<body style="margin:0;background:#fff"><svg width="800" height="500"><circle cx="400" cy="250" r="160" fill="#cde"/><text x="40" y="60" font-size="28">Noyau</text><text x="600" y="80" font-size="28">Membrane</text><text x="40" y="460" font-size="28">Mitochondrie</text><text x="600" y="460" font-size="28">Ribosome</text></svg>');
      const png = await shotPage.screenshot();
      await shotPage.setContent('<p style="font:20px serif">Schéma de la cellule, page 1.</p><svg width="400" height="300"><rect width="400" height="300" fill="#eee"/></svg>');
      const pdf = await shotPage.pdf({ format: 'A4' });
      await shotPage.close();
      const dbs = fresh(['cahier', 'cartes', 'schemas']);
      const PDF = { ...structuredClone(COURSE), id: '22222222-2222-4222-8222-222222222222', title: 'Cellule PDF', kind: 'pdf', chapters: [{ id: 'p', title: 'Tout', page: 0, offset: 0 }] };
      dbs.courses.push(PDF);
      dbs.files[`cours/u1/${PDF.id}/texte.json`] = Buffer.from(JSON.stringify({ v: 1, pages: ['Schéma de la cellule, page 1. La mitochondrie et le noyau.'] }));
      dbs.files[`cours/u1/${PDF.id}/original.pdf`] = pdf;
      const { page, context, errors } = await openBoard(browser, base, dbs, { viewport: { width: 1440, height: 900 }, labo: true });
      const w = page.locator('[data-widget=schemas]');
      const sText = () => w.locator('.cartes-view').innerText();
      await page.waitForFunction(() => /Ajoute une image de schéma/.test(document.querySelector('[data-widget=schemas] .cartes-view')?.innerText ?? ''));
      await w.getByRole('button', { name: 'Nouveau schéma' }).click();
      await w.getByLabel('Titre').fill('La cellule animale');
      await w.getByLabel('Paquet', { exact: true }).fill('Biologie');
      await w.locator('input[type=file]').setInputFiles({ name: 'cellule.png', mimeType: 'image/png', buffer: png });
      await w.getByRole('button', { name: 'Créer le schéma' }).click();
      await page.waitForFunction(() => /encadre maintenant ses légendes/.test(document.querySelector('[data-widget=schemas] .cahier-note').textContent));
      const s = dbs.schemas[0];
      assert.deepStrictEqual([s.largeur, s.hauteur], [800, 500], 'proportions de l’image gardées');
      const stored = dbs.files[`schemas/u1/${s.id}.jpg`];
      assert.ok(stored && stored[0] === 0xff && stored[1] === 0xd8, 'image réenregistrée en JPEG');

      // Trois zones à la souris, sur les légendes.
      await w.locator('.schema-img').evaluate(i => i.complete || new Promise(r => { i.onload = r; }));
      const layer = w.locator('.schema-layer');
      const drag = async (x1, y1, x2, y2) => {
        const b = await layer.boundingBox();
        await page.mouse.move(b.x + x1 * b.width, b.y + y1 * b.height);
        await page.mouse.down();
        await page.mouse.move(b.x + x2 * b.width, b.y + y2 * b.height, { steps: 4 });
        await page.mouse.up();
      };
      await drag(.04, .06, .2, .15);
      await w.getByLabel('Réponse de la zone 1').fill('Noyau');
      await drag(.74, .1, .95, .2);
      await w.getByLabel('Réponse de la zone 2').fill('Membrane');
      await drag(.04, .86, .3, .96);
      await drag(.5, .5, .505, .505);
      assert.strictEqual(await w.locator('.schema-zone').count(), 3, 'un clic sans glisser ne crée pas de zone');
      // Une quatrième au clavier : ajoutée au centre, déplacée aux flèches, agrandie avec Maj.
      await w.getByRole('button', { name: 'Ajouter une zone' }).click();
      const z4 = w.locator('.schema-zone').nth(3);
      for (let i = 0; i < 20; i++) await z4.press('ArrowRight');
      for (let i = 0; i < 4; i++) await z4.press('Shift+ArrowDown');
      await w.getByLabel('Réponse de la zone 4').fill('Ribosome');
      await shot(page, 'schemas-zones');
      await w.getByRole('button', { name: 'Enregistrer les zones' }).click();
      await page.waitForFunction(() => /4 zones enregistrées/.test(document.querySelector('[data-widget=schemas] .cahier-note').textContent));
      const zones = dbs.schemas[0].zones;
      assert.strictEqual(zones.length, 4);
      assert.ok(Math.abs(zones[0].x - .04) < .01 && Math.abs(zones[0].w - .16) < .01, 'coordonnées de 0 à 1');
      assert.ok(Math.abs(zones[3].x - .6) < .001 && Math.abs(zones[3].h - .14) < .001, 'flèches : 1 % par appui');

      // Interroge-moi : un cache opaque, rien de révélé avant l'action, et le tirage couvre toutes les zones.
      await w.getByRole('button', { name: 'Interroge-moi' }).click();
      assert.strictEqual(await w.locator('.schema-mask').count(), 1);
      const bg = await w.locator('.schema-mask').evaluate(m => getComputedStyle(m).backgroundColor);
      assert.ok(!/rgba\(.*, 0(\.\d+)?\)|transparent/.test(bg), `cache opaque (${bg})`);
      assert.ok(!/Noyau|Membrane|Ribosome/.test(await sText()), 'aucune réponse avant « Révéler »');
      await shot(page, 'schemas-roulette');
      const masked = new Set();
      let before = null;
      for (let i = 0; i < 14; i++) {
        const box = await w.locator('.schema-mask').first().evaluate(m => m.style.left + m.style.top);
        assert.notStrictEqual(box, before, 'pas deux fois de suite la même zone');
        before = box;
        masked.add(box);
        await w.getByRole('button', { name: 'Révéler' }).click();
        await w.getByRole('button', { name: i === 0 ? 'À revoir' : 'Trouvé' }).click();
      }
      assert.strictEqual(masked.size, 4, 'le tirage passe par toutes les zones');
      await w.getByRole('button', { name: '3 zones' }).click();
      assert.strictEqual(await w.locator('.schema-mask').count(), 3);
      const spots = await w.locator('.schema-mask').evaluateAll(ms => ms.map(m => m.style.left + m.style.top));
      assert.strictEqual(new Set(spots).size, 3, 'trois zones différentes');
      await w.getByRole('button', { name: 'Révéler' }).click();
      assert.strictEqual(await w.locator('.schema-answers li').count(), 3);
      await w.getByRole('button', { name: 'À revoir' }).click();
      await page.waitForTimeout(200);
      assert.strictEqual(dbs.schemaAnswers.length, 14 + 3);
      assert.deepStrictEqual(errors, []);
      await context.close();

      // Rechargement : les zones et les erreurs restent ; on revoit seulement les erreurs.
      const again = await openBoard(browser, base, dbs, { viewport: { width: 1440, height: 900 }, labo: true });
      const w2 = again.page.locator('[data-widget=schemas]');
      await again.page.waitForFunction(() => /Revoir mes erreurs \(\d\)/.test(document.querySelector('[data-widget=schemas] .cartes-view')?.innerText ?? ''));
      const missed = Number((await w2.getByRole('button', { name: /Revoir mes erreurs/ }).innerText()).match(/\d+/)[0]);
      assert.ok(missed >= 1 && missed <= 3);
      await w2.getByRole('button', { name: /Revoir mes erreurs/ }).click();
      for (let i = 0; i < missed; i++) {
        await w2.getByRole('button', { name: 'Révéler' }).click();
        await w2.getByRole('button', { name: 'Trouvé' }).click();
      }
      await again.page.waitForFunction(() => /Plus aucune erreur/.test(document.querySelector('[data-widget=schemas] .cartes-view').innerText));

      // Remplacer l'image : il faut revérifier les zones avant de s'interroger.
      await w2.getByRole('button', { name: 'Retour au schéma' }).click();
      await w2.getByRole('button', { name: 'Modifier les zones' }).click();
      await w2.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'v2.png', mimeType: 'image/png', buffer: png });
      await again.page.waitForFunction(() => /vérifie tes zones/.test(document.querySelector('[data-widget=schemas] .cahier-note').textContent));
      assert.deepStrictEqual([dbs.schemas[0].image_version, dbs.schemas[0].zones_a_verifier], [2, true]);
      await w2.getByRole('button', { name: 'Terminer' }).click();
      assert.match(await w2.locator('.cartes-view').innerText(), /L'image a changé/);
      assert.ok(await w2.getByRole('button', { name: 'Interroge-moi' }).isDisabled());
      await w2.getByRole('button', { name: 'Modifier les zones' }).click();
      await w2.getByRole('button', { name: 'Enregistrer les zones' }).click();
      await again.page.waitForFunction(() => /4 zones enregistrées/.test(document.querySelector('[data-widget=schemas] .cahier-note').textContent));
      assert.ok(await w2.getByRole('button', { name: 'Interroge-moi' }).isEnabled());
      assert.strictEqual(dbs.schemas[0].zones_a_verifier, false);

      // Depuis le Cahier : une page du PDF devient un schéma.
      const c = cahier(again.page);
      await c.locator('.cahier-bar select').selectOption({ label: 'Cellule PDF' });
      await c.getByRole('button', { name: 'Faire un schéma de cette page' }).click();
      await again.page.waitForFunction(() => /Page 1 du cours/.test(document.querySelector('[data-widget=schemas] .cartes-view').innerText), null, { timeout: 20000 });
      assert.strictEqual(await w2.getByLabel('Titre').inputValue(), 'Cellule PDF · page 1');
      await w2.getByRole('button', { name: 'Créer le schéma' }).click();
      await again.page.waitForFunction(() => /encadre maintenant/.test(document.querySelector('[data-widget=schemas] .cahier-note').textContent));
      const fromPdf = dbs.schemas[1];
      assert.deepStrictEqual([fromPdf.course_id, fromPdf.src_page], [PDF.id, 0]);
      assert.ok(fromPdf.largeur > fromPdf.hauteur === false, 'page A4 en portrait');
      assert.deepStrictEqual(again.errors, []);
      await again.context.close();
      // Téléphone : l'image et ses caches restent dans le widget, sans débordement.
      const phone = await openBoard(browser, base, dbs, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, labo: true });
      const wp = phone.page.locator('[data-widget=schemas]');
      await wp.locator('.cahier-pick').selectOption({ index: 0 });
      await wp.getByRole('button', { name: 'Interroge-moi' }).click();
      await wp.locator('.schema-mask').first().waitFor();
      assert.strictEqual(await phone.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'pas de débordement à 390 px');
      const fits = await wp.evaluate(b => { const o = b.getBoundingClientRect(), st = b.querySelector('.schema-stage').getBoundingClientRect(); return st.left >= o.left - 1 && st.right <= o.right + 1 && [...b.querySelectorAll('.schema-mask')].every(m => { const r = m.getBoundingClientRect(); return r.left >= st.left - 1 && r.right <= st.right + 1 && r.bottom <= st.bottom + 1; }); });
      assert.ok(fits, 'caches dans l’image sur téléphone');
      await wp.scrollIntoViewIfNeeded();
      await shot(phone.page, 'schemas-390');
      assert.deepStrictEqual(phone.errors, []);
      await phone.context.close();
      console.log('ok schémas : zones souris et clavier, tirage complet sans répétition, caches opaques, erreurs, image remplacée, page de PDF');
    }

    // 11. Guide Study (S8) : sur une page déjà remplie, étapes cochées par de vraies actions, import raté non validé.
    {
      const dbg = { ...fresh(['guide', 'notes']), courses: [] };
      dbg.rows.notes = { text: 'Mes notes à garder' };
      const { page, context, errors } = await openBoard(browser, base, dbg, { viewport: { width: 1440, height: 900 }, labo: true, waitFor: '[data-widget=guide]' });
      const g = page.locator('[data-widget=guide]');
      const gText = () => g.locator('.guide').innerText();
      await page.waitForFunction(() => /Étape 1 \/ 4/.test(document.querySelector('[data-widget=guide] .meta')?.textContent ?? ''));
      await shot(page, 'guide-debut');
      await g.getByRole('button', { name: 'Ajouter Cahier, Flashcards, Révisions du jour à cette page' }).click();
      await page.waitForSelector('[data-widget=cahier]');
      await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
      assert.deepStrictEqual(dbg.rows.ecran.widgets, ['guide', 'notes', 'cahier', 'cartes', 'revisions'], 'ajoutés à la fin, rien de retiré');
      assert.match(await page.locator('[data-widget=notes] textarea').inputValue(), /Mes notes à garder/);

      // Un import qui échoue ne coche pas l'étape.
      dbg.failCourses = true;
      await g.getByRole('button', { name: "Essayer avec un cours d'exemple" }).click();
      const c = cahier(page);
      assert.strictEqual(await c.getByLabel('Matière').inputValue(), 'Exemple', 'cours d’exemple clairement nommé');
      await c.getByRole('button', { name: 'Importer', exact: true }).click();
      await page.waitForFunction(() => /enregistrement n'a pas abouti/.test(document.querySelector('.cahier-import').innerText));
      assert.match(await g.locator('.meta').innerText(), /Étape 1 \/ 4/);
      dbg.failCourses = false;
      await c.getByRole('button', { name: 'Importer', exact: true }).click();
      await page.waitForFunction(() => /Étape 2 \/ 4/.test(document.querySelector('[data-widget=guide] .meta').textContent));
      assert.strictEqual(dbg.courses[0].title, "Cours d'exemple : la cellule");
      await g.getByRole('button', { name: 'Mes chapitres sont bons' }).click();
      assert.match(await g.locator('.meta').innerText(), /Étape 3 \/ 4/);
      assert.match(await gText(), /Gratuit[\s\S]*Avec crédits[\s\S]*Le coût est affiché avant de lancer/, 'gratuit et payant distingués avant l’action');
      // Une carte depuis une sélection du cours d'exemple.
      await select(page, 'membrane plasmique');
      await c.getByRole('button', { name: 'Créer une carte' }).click();
      await c.getByLabel('Question').fill('Qu’entoure la membrane plasmique ?');
      await c.getByRole('button', { name: 'Créer la carte' }).click();
      await page.waitForFunction(() => /Étape 4 \/ 4/.test(document.querySelector('[data-widget=guide] .meta').textContent));
      const r = page.locator('[data-widget=revisions]');
      await r.getByRole('button', { name: 'Voir la réponse' }).click();
      await r.getByRole('button', { name: /^Bien/ }).click();
      await page.waitForFunction(() => /Terminé/.test(document.querySelector('[data-widget=guide] .meta').textContent));
      assert.match(await gText(), /Tout est prêt/);
      await shot(page, 'guide-fin');
      await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
      assert.strictEqual(dbg.rows.guide.chapitres, true);
      assert.deepStrictEqual(errors, []);
      await context.close();

      // Rechargement : la progression vient des données ; masquer puis rejouer.
      const again = await openBoard(browser, base, dbg, { viewport: { width: 1440, height: 900 }, labo: true });
      const g2 = again.page.locator('[data-widget=guide]');
      await again.page.waitForFunction(() => /Terminé/.test(document.querySelector('[data-widget=guide] .meta')?.textContent ?? ''));
      await g2.getByRole('button', { name: 'Masquer le guide' }).click();
      assert.match(await g2.innerText(), /Guide masqué/);
      await g2.getByRole('button', { name: 'Rejouer le guide' }).click();
      assert.match(await g2.locator('.meta').innerText(), /Étape 2 \/ 4/, 'rejouer repart des vraies données');
      assert.deepStrictEqual(again.errors, []);
      await again.context.close();
      console.log('ok guide : widgets ajoutés sans rien retirer, étapes cochées par de vraies actions, import raté, rejouer');
    }

    // 6. Trois tailles et quatre largeurs : rien ne déborde.
    for (const size of ['s', 'm', 'l']) {
      const dbs = structuredClone(db);
      dbs.rows.ecran = { ...dbs.rows.ecran, sizes: { cartes: size } };
      const { page, context, errors } = await openBoard(browser, base, dbs);
      const w = cartes(page);
      await page.waitForSelector('[data-widget=cartes] .cartes-card');
      await w.getByRole('button', { name: 'Voir la réponse' }).click();
      const inside = await w.evaluate(b => [...b.querySelectorAll('select,input,button,p')].filter(x => x.offsetParent).every(x => { const r = x.getBoundingClientRect(), o = b.getBoundingClientRect(); return r.left >= o.left - 1 && r.right <= o.right + 1; }));
      assert.ok(inside, `contenu hors du widget en taille ${size}`);
      await w.scrollIntoViewIfNeeded();
      await shot(page, `cartes-taille-${size}`);
      assert.deepStrictEqual(errors, []);
      await context.close();
    }
    const dbw = structuredClone(db);
    dbw.rows.ecran.widgets = ['revisions', ...dbw.rows.ecran.widgets];
    for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1440, 900]]) {
      const { page, context, errors } = await openBoard(browser, base, dbw, { viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
      const r = page.locator('[data-widget=revisions]');
      await page.waitForSelector('[data-widget=revisions] .cartes-card');
      await r.getByRole('button', { name: 'Voir la réponse' }).click();
      const fits = await r.evaluate(b => [...b.querySelectorAll('button')].filter(x => x.offsetParent).every(x => { const q = x.getBoundingClientRect(), o = b.getBoundingClientRect(); return q.left >= o.left - 1 && q.right <= o.right + 1 && x.scrollWidth <= x.clientWidth + 1; }));
      assert.ok(fits, `boutons de révision hors du widget à ${width}px`);
      await r.scrollIntoViewIfNeeded();
      await shot(page, `revisions-${width}`);
      const w = cartes(page);
      await page.waitForSelector('[data-widget=cartes] .cartes-card');
      await w.getByRole('button', { name: 'Voir la réponse' }).click();
      assert.strictEqual(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `débordement à ${width}px`);
      const inside = await w.evaluate(b => [...b.querySelectorAll('select,input,button')].filter(x => x.offsetParent).every(x => { const r = x.getBoundingClientRect(), o = b.getBoundingClientRect(); return r.left >= o.left - 1 && r.right <= o.right + 1; }));
      assert.ok(inside, `contrôles hors du widget à ${width}px`);
      await w.scrollIntoViewIfNeeded();
      await shot(page, `cartes-${width}`);
      assert.deepStrictEqual(errors, []);
      await context.close();
    }
    console.log('ok trois tailles, 320, 390, 768 et 1440 px');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
