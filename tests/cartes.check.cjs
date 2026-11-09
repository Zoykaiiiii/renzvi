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

async function openBoard(browser, base, db, options = { viewport: { width: 1440, height: 900 } }) {
  const { time, ...settings } = options;
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
    const r = { ...req.postDataJSON(), reviewed_at: new Date().toISOString() };
    db.reviews.push(r);
    const card = db.cards.find(c => c.id === r.card_id && c.version === r.card_version);
    if (card) Object.assign(card, { last_rating: r.rating, last_reviewed_at: r.reviewed_at });
    return route.fulfill({ status: 201, headers: CORS });
  });
  await context.route(`${SUPABASE}/storage/v1/object/**`, route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    const key = decodeURIComponent(new URL(req.url()).pathname.replace(/^\/storage\/v1\/object\/(authenticated\/)?/, ''));
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
  await page.goto(`${base}/dashboard.html`);
  await page.waitForSelector('[data-widget=cartes]');
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
