// Vérifie le widget Cahier (Study S1) dans un vrai Chromium, avec Supabase simulé (table study_courses et stockage « cours »).
// Les PDF de test sont fabriqués par Chromium lui-même. La séparation entre comptes (RLS) se vérifie sur la vraie base, pas ici.
// Lancement : NODE_PATH=<dossier node_modules contenant playwright> node tests/cahier.check.cjs [dossier-captures]
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
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
  const context = await browser.newContext(options);
  await context.addInitScript(session => localStorage.setItem('sb-xjkmztfsyyccveaeyzov-auth-token', session), JSON.stringify({ access_token: JWT, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER }));
  await context.route(`${SUPABASE}/rest/v1/widget_state*`, route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    if (req.method() === 'GET') return json(route, 200, Object.entries(db.rows).map(([widget, data]) => ({ widget, data })));
    for (const row of req.postDataJSON()) db.rows[row.widget] = row.data;
    return route.fulfill({ status: 201, headers: CORS });
  });
  await context.route(`${SUPABASE}/rest/v1/rpc/*`, route => route.request().method() === 'OPTIONS' ? preflight(route) : json(route, 200, []));
  await context.route(`${SUPABASE}/rest/v1/study_courses*`, route => {
    const req = route.request();
    const id = new URL(req.url()).searchParams.get('id')?.replace(/^eq\./, '');
    if (req.method() === 'OPTIONS') return preflight(route);
    if (req.method() === 'GET') return json(route, 200, db.courses);
    if (db.failRows) return json(route, 500, { message: 'panne' });
    if (req.method() === 'POST') { db.courses.push(...[req.postDataJSON()].flat()); return route.fulfill({ status: 201, headers: CORS }); }
    if (req.method() === 'PATCH') { Object.assign(db.courses.find(c => c.id === id), req.postDataJSON()); return route.fulfill({ status: 204, headers: CORS }); }
    if (req.method() === 'DELETE') { db.courses = db.courses.filter(c => c.id !== id); return route.fulfill({ status: 204, headers: CORS }); }
  });
  await context.route(`${SUPABASE}/storage/v1/object/**`, async route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    const key = decodeURIComponent(new URL(req.url()).pathname.replace(/^\/storage\/v1\/object\/(authenticated\/)?/, ''));
    if (req.method() === 'POST' || req.method() === 'PUT') {
      if (db.failUpload) return json(route, 500, { message: 'panne' });
      db.files[key] = filePart(req.postDataBuffer(), req.headers()['content-type']);
      return json(route, 200, { Key: key });
    }
    if (req.method() === 'DELETE') {
      for (const name of req.postDataJSON().prefixes) delete db.files[`cours/${name}`];
      return json(route, 200, []);
    }
    return db.files[key] ? route.fulfill({ status: 200, headers: CORS, body: db.files[key] }) : json(route, 404, { message: 'absent' });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${base}/dashboard.html`);
  await page.waitForSelector('[data-widget=cahier]');
  return { context, page, errors };
}

// Un cours de droit sur plusieurs pages, avec accents et un pied de page répété : Chromium l'imprime en vrai PDF.
async function makePdf(browser, html, extra = {}) {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>body{font:14px serif} h1{break-before:page} h1:first-of-type{break-before:auto}</style>${html}`);
  const pdf = await page.pdf({ format: 'A4', ...extra });
  await page.close();
  return pdf;
}
const para = (n, words) => Array.from({ length: n }, (_, i) => `<p>${words} ${i + 1}. L'élève étudie la responsabilité délictuelle et ses conséquences.</p>`).join('');
const COURSE_HTML = `<p>Introduction générale au droit civil, à lire avant les chapitres. ${'Le droit encadre la vie en société. '.repeat(12)}</p>
<h1>Chapitre 1 Les sources du droit</h1>${para(30, 'La loi')}
<h1>Chapitre 2 Le contrat</h1>${para(30, 'Le consentement')}<p>Le mot cherché est hypothèque.</p>
<h1>Chapitre 3 La responsabilité</h1>${para(10, 'La faute')}`;

const ALL = ['cahier', 'notes', 'taches'];
const fresh = () => ({ rows: { ecran: { wallpaper: 'blanc', widgets: ALL, done: true } }, courses: [], files: {} });
const cahier = page => page.locator('[data-widget=cahier]');
const state = page => page.evaluate(() => document.querySelector('[data-widget=cahier] .cahier-view').innerText);

async function importFile(page, name, buffer, mimeType, subject = 'Droit civil') {
  const w = cahier(page);
  await w.getByRole('button', { name: 'Importer un cours' }).click();
  await w.getByLabel('Matière').fill(subject);
  await w.locator('input[type=file]').setInputFiles({ name, mimeType, buffer });
  await w.getByRole('button', { name: 'Importer', exact: true }).click();
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false }); };
  try {
    // 1. Les règles de découpage, directement dans la page.
    {
      const db = fresh();
      const { page, context, errors } = await openBoard(browser, base, db);
      const r = await page.evaluate(() => {
        const sample = 'Élève ÉTÉ ﬁn ß 😀 Ǆ';
        const fold = cahierFold(sample);
        const header = 'Partie 1 Introduction\n';
        const pages = [`${header}Bla bla.\nChapitre 1 Les bases\nTexte.`, `${header}Suite.\nChapitre 2 La suite\nFin.`];
        const guessed = cahierGuess(pages);
        const list = cahierGuess(['1. Premier point\nTexte\n2. Second point\nTexte\n3. Troisième point']);
        const md = cahierGuess(['# Titre un\nA\n## Titre deux\nB']);
        const none = cahierGuess(['Juste du texte sans titres.']);
        const intro = cahierGuess([`${'Préambule. '.repeat(40)}\nChapitre 1 Début réel\nx\nChapitre 2 Deux\ny`]);
        const outline = cahierGuess(['Avant\nLe contrat\nTexte', 'La faute\nTexte'], [{ title: 'Le contrat', page: 0 }, { title: 'La faute', page: 1 }]);
        const slices = cahierSlices(['abcdef', 'ghij', 'klm'], { page: 0, offset: 2 }, { page: 2, offset: 0 });
        const tidy = cahierTidy([{ id: 'b', title: 'B', page: 0, offset: 5 }, { id: 'a', title: '  A  ', page: 0, offset: 3 }, { id: 'z', title: 'Z', page: 9, offset: 0 }], ['0123456789']);
        const found = cahierSearch(['Un élève, deux ELEVES.'], [cahierFold('Un élève, deux ELEVES.')], 'eleve', [{ page: 0, offset: 0 }]);
        return { foldLen: [fold.length, sample.length], fold, guessed: guessed.map(c => c.title), list: list.map(c => c.title), md: md.map(c => c.title), none: none.map(c => c.title), intro: intro.map(c => c.title), outline: outline.map(c => [c.title, c.page, c.offset]), slices, tidy: tidy.map(c => [c.id, c.title, c.offset]), found: found.map(f => f.match) };
      });
      assert.deepStrictEqual(r.foldLen[0], r.foldLen[1], 'la recherche garde la longueur du texte');
      assert.ok(r.fold.startsWith('eleve ete'), r.fold);
      assert.deepStrictEqual(r.guessed, ['Partie 1 Introduction', 'Chapitre 1 Les bases', 'Chapitre 2 La suite'], 'un titre répété sur chaque page compte une fois');
      assert.deepStrictEqual(r.list, ['1. Premier point', '2. Second point', '3. Troisième point']);
      assert.deepStrictEqual(r.md, ['Titre un', 'Titre deux']);
      assert.deepStrictEqual(r.none, ['Tout le cours']);
      assert.deepStrictEqual(r.intro, ['Début', 'Chapitre 1 Début réel', 'Chapitre 2 Deux'], 'un long préambule devient un chapitre');
      assert.deepStrictEqual(r.outline, [['Le contrat', 0, 0], ['La faute', 1, 0]], 'sommaire du PDF, premier chapitre au début');
      assert.deepStrictEqual(r.slices, [{ page: 0, start: 2, end: 6 }, { page: 1, start: 0, end: 4 }]);
      assert.deepStrictEqual(r.tidy, [['a', 'A', 0], ['b', 'B', 5]], 'ordre, nettoyage, position impossible écartée');
      assert.deepStrictEqual(r.found, ['élève', 'ELEVE'], 'recherche sans accents ni majuscules');
      assert.deepStrictEqual(errors, []);
      await context.close();
      console.log('ok règles de découpage');
    }

    // 2. Premier cours en texte collé, puis un PDF de 7 pages, lecture, recherche, reprise après rechargement.
    const pdf = await makePdf(browser, COURSE_HTML, { displayHeaderFooter: true, headerTemplate: '<div style="font-size:9px;margin-left:1cm">Cours de droit civil — L1</div>', footerTemplate: '<div></div>', margin: { top: '2cm', bottom: '2cm' } });
    const db = fresh();
    {
      const { page, context, errors } = await openBoard(browser, base, db);
      const w = cahier(page);
      await page.waitForFunction(() => document.querySelector('[data-widget=cahier] .cahier-view').innerText.includes('Importe un cours'));
      assert.strictEqual(await w.getAttribute('data-size'), 'l', 'le cahier est grand par défaut');
      await shot(page, 'cahier-vide');

      await w.getByRole('button', { name: 'Importer un cours' }).click();
      await w.getByRole('button', { name: 'Importer', exact: true }).click();
      await page.waitForFunction(() => /matière/.test(document.querySelector('.cahier-import').innerText));
      await w.getByLabel('Matière').fill('Biologie');
      await w.getByRole('button', { name: 'Importer', exact: true }).click();
      assert.match(await state(page), /Choisis un fichier ou colle/);
      await w.getByLabel('Titre du cours').fill('La cellule');
      await w.getByLabel('Texte du cours à coller').fill('# La membrane\nElle entoure la cellule.\n\n# Le noyau\nIl contient l’ADN, présent chez l’être vivant.');
      await w.getByRole('button', { name: 'Importer', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-widget=cahier] .cahier-title')?.textContent === 'La membrane');
      assert.match(await w.locator('.cahier-note').innerText(), /2 chapitres trouvés/);
      assert.strictEqual(db.courses.length, 1);
      assert.ok(db.files[`cours/u1/${db.courses[0].id}/original.txt`] && db.files[`cours/u1/${db.courses[0].id}/texte.json`], 'original et texte gardés');

      await shot(page, 'cahier-import');
      await importFile(page, 'droit-civil.pdf', pdf, 'application/pdf');
      await page.waitForFunction(() => document.querySelector('[data-widget=cahier] .cahier-title')?.textContent === 'Début', null, { timeout: 30000 });
      const c = db.courses.find(x => x.kind === 'pdf');
      assert.strictEqual(c.title, 'droit civil', 'titre tiré du nom du fichier');
      assert.ok(c.page_count >= 4, `pages : ${c.page_count}`);
      assert.deepStrictEqual(c.chapters.map(x => x.title), ['Début', 'Chapitre 1 Les sources du droit', 'Chapitre 2 Le contrat', 'Chapitre 3 La responsabilité']);
      assert.match(await state(page), /Page 1/);
      assert.ok(!/Cours de droit civil — L1[\s\S]*Chapitre 1/.test(c.chapters.map(x => x.title).join()), "l'en-tête répété n'est pas un chapitre");

      // Les cours sont rangés par matière dans le choix du cours.
      assert.deepStrictEqual(await w.locator('.cahier-bar select optgroup').evaluateAll(g => g.map(x => x.label)), ['Biologie', 'Droit civil']);

      await w.getByRole('button', { name: 'Chapitre suivant' }).click();
      await w.getByRole('button', { name: 'Chapitre suivant' }).click();
      assert.strictEqual(await w.locator('.cahier-title').innerText(), 'Chapitre 2 Le contrat');
      assert.strictEqual(await w.locator('.meta').innerText(), 'Chapitre 3 / 4');
      await w.getByLabel('Chercher dans le cours').fill('hypotheque');
      await page.waitForSelector('.cahier-results li');
      assert.match(await w.locator('.cahier-results').innerText(), /Chapitre 2 Le contrat · page \d[\s\S]*hypothèque/);
      await shot(page, 'cahier-recherche');
      await w.getByLabel('Chercher dans le cours').fill('élève étudie');
      await page.waitForFunction(() => document.querySelectorAll('.cahier-results li').length >= 40);
      await w.locator('.cahier-results li button').nth(35).click();
      await page.waitForSelector('.cahier-text');
      assert.strictEqual(await w.locator('.cahier-title').innerText(), 'Chapitre 2 Le contrat', 'le 36e passage est dans le chapitre 2');
      const lit = await page.evaluate(() => { const h = CSS.highlights.get('cahier'); const r = [...h][0]; const t = document.querySelector('.cahier-text').getBoundingClientRect(); const b = r.getBoundingClientRect(); return { text: r.toString(), inside: b.top >= t.top && b.bottom <= t.bottom }; });
      assert.deepStrictEqual(lit, { text: 'élève étudie', inside: true }, 'le passage trouvé est surligné et visible');
      await shot(page, 'cahier-passage');
      await page.locator('.cahier-text').evaluate(e => { e.scrollTop = 300; e.dispatchEvent(new Event('scroll')); });
      await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré' && true, null, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1500);
      assert.strictEqual(db.rows.cahier.course, c.id);
      assert.strictEqual(db.rows.cahier.at[c.id].y, 300);
      assert.deepStrictEqual(errors, []);
      await context.close();
      console.log('ok import texte et PDF, recherche, surlignage');
    }
    {
      const { page, context, errors } = await openBoard(browser, base, db);
      const w = cahier(page);
      await page.waitForFunction(() => document.querySelector('[data-widget=cahier] .cahier-title')?.textContent === 'Chapitre 2 Le contrat');
      assert.strictEqual(await page.locator('.cahier-text').evaluate(e => e.scrollTop), 300, 'reprise à la dernière position');

      // Corriger les chapitres : renommer, couper à un endroit choisi, retirer.
      await w.getByRole('button', { name: 'Modifier les chapitres' }).click();
      await w.getByLabel('Titre du chapitre 3').fill('Le contrat');
      await w.getByLabel('Titre du chapitre 3').press('Enter');
      await page.waitForFunction(() => document.querySelector('.cahier-nav select').selectedOptions[0].textContent === 'Le contrat');
      await page.evaluate(() => {
        const block = [...document.querySelectorAll('.cahier-block')].find(b => b.textContent.includes('Le mot cherché'));
        const at = block.textContent.indexOf('Le mot cherché');
        const r = document.createRange(); r.setStart(block.firstChild, at); r.collapse(true);
        getSelection().removeAllRanges(); getSelection().addRange(r);
      });
      await w.getByRole('button', { name: 'Nouveau chapitre ici' }).click();
      await page.waitForFunction(() => document.querySelector('.cahier-title').textContent === 'Le mot cherché est hypothèque.');
      const c = db.courses.find(x => x.kind === 'pdf');
      assert.deepStrictEqual(c.chapters.map(x => x.title), ['Début', 'Chapitre 1 Les sources du droit', 'Le contrat', 'Le mot cherché est hypothèque.', 'Chapitre 3 La responsabilité']);
      await shot(page, 'cahier-chapitres');
      await w.getByRole('button', { name: /Retirer le chapitre Début/ }).click();
      await page.waitForFunction(() => document.querySelectorAll('.cahier-chapters li').length === 4);
      assert.strictEqual(db.courses.find(x => x.kind === 'pdf').chapters[0].page, 0, 'le texte du début reste lisible dans le premier chapitre');
      await w.getByRole('button', { name: 'Terminer les chapitres' }).click();

      // Agrandir puis Échap.
      await w.getByRole('button', { name: 'Agrandir' }).click();
      const big = await w.evaluate(b => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), getComputedStyle(b).position]; });
      assert.deepStrictEqual(big, [1440 - 32, 900 - 32, 'fixed']);
      await shot(page, 'cahier-agrandi');
      await page.keyboard.press('Escape');
      assert.notStrictEqual(await w.evaluate(b => getComputedStyle(b).position), 'fixed', 'Échap referme le cahier agrandi');

      // Supprimer en deux appuis.
      const id = c.id;
      await w.getByRole('button', { name: 'Supprimer ce cours' }).click();
      assert.strictEqual(db.courses.length, 2, 'le premier appui ne supprime rien');
      await w.getByRole('button', { name: /Appuie encore/ }).click();
      await page.waitForFunction(() => /est supprimé/.test(document.querySelector('.cahier-note').textContent));
      assert.deepStrictEqual(db.courses.map(x => x.title), ['La cellule']);
      await page.waitForTimeout(300);
      assert.ok(!Object.keys(db.files).some(k => k.includes(id)), 'fichiers supprimés');
      assert.strictEqual(await w.locator('.cahier-title').innerText(), 'La membrane');
      assert.deepStrictEqual(errors, []);
      await context.close();
      console.log('ok reprise, chapitres modifiés, agrandir, suppression');
    }

    // 3. Les cas difficiles : scan, PDF trop long, trop lourd, annulation, panne, accents Windows.
    {
      const db2 = fresh();
      const { page, context, errors } = await openBoard(browser, base, db2);
      const w = cahier(page);
      await page.waitForFunction(() => document.querySelector('[data-widget=cahier] .cahier-view').innerText.includes('Importe un cours'));
      const img = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#ddd"/></svg>').toString('base64');
      const scan = await makePdf(browser, `<img src="${img}" style="width:100%"><h1></h1><img src="${img}">`);
      await importFile(page, 'scan.pdf', scan, 'application/pdf');
      await page.waitForFunction(() => /pas de texte lisible/.test(document.querySelector('[data-widget=cahier] .cahier-view').innerText), null, { timeout: 15000 });
      assert.strictEqual(db2.courses[0].text_chars, 0);
      assert.ok(db2.files[`cours/u1/${db2.courses[0].id}/original.pdf`], "l'original du scan est gardé");
      assert.ok(await w.getByRole('button', { name: "Télécharger l'original" }).isVisible());
      const download = page.waitForEvent('download');
      await w.getByRole('button', { name: "Télécharger l'original" }).click();
      assert.strictEqual((await download).suggestedFilename(), 'scan.pdf');
      await shot(page, 'cahier-scan');

      const long = await makePdf(browser, Array.from({ length: 201 }, (_, i) => `<h1>Page ${i}</h1>`).join(''));
      await importFile(page, 'long.pdf', long, 'application/pdf');
      await page.waitForFunction(() => /201 pages/.test(document.querySelector('.cahier-import').innerText), null, { timeout: 20000 });

      await w.locator('input[type=file]').setInputFiles({ name: 'lourd.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(21 * 1048576) });
      await w.getByRole('button', { name: 'Importer', exact: true }).click();
      assert.match(await w.locator('.cahier-import').innerText(), /trop lourd : 20 Mo/);

      await w.locator('input[type=file]').setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('x') });
      await w.getByRole('button', { name: 'Importer', exact: true }).click();
      assert.match(await w.locator('.cahier-import').innerText(), /pas encore lu/);

      await w.locator('input[type=file]').setInputFiles({ name: 'faux.pdf', mimeType: 'application/pdf', buffer: Buffer.from('pas un pdf') });
      await w.getByRole('button', { name: 'Importer', exact: true }).click();
      await page.waitForFunction(() => /pas pu être lu comme un PDF/.test(document.querySelector('.cahier-import').innerText));

      // Annuler pendant la lecture d'un gros PDF.
      const big = await makePdf(browser, Array.from({ length: 190 }, (_, i) => `<h1>Chapitre ${i + 1} Titre</h1>${para(4, 'Texte')}`).join(''));
      await w.locator('input[type=file]').setInputFiles({ name: 'gros.pdf', mimeType: 'application/pdf', buffer: big });
      await w.getByRole('button', { name: 'Importer', exact: true }).click();
      await page.waitForFunction(() => /Lecture de la page \d+ sur/.test(document.querySelector('.cahier-import').innerText), null, { timeout: 20000 });
      await w.getByRole('button', { name: 'Annuler' }).click();
      await page.waitForFunction(() => /Import annulé/.test(document.querySelector('.cahier-import').innerText), null, { timeout: 10000 });
      assert.strictEqual(db2.courses.length, 1, "rien n'est enregistré après une annulation");

      // Panne à l'enregistrement : les fichiers envoyés sont retirés.
      db2.failRows = true;
      await w.locator('input[type=file]').setInputFiles({ name: 'cours.txt', mimeType: 'text/plain', buffer: Buffer.from('Chapitre 1 Un\nA\nChapitre 2 Deux\nB') });
      await w.getByRole('button', { name: 'Importer', exact: true }).click();
      await page.waitForFunction(() => /enregistrement n'a pas abouti/.test(document.querySelector('.cahier-import').innerText));
      assert.strictEqual(db2.courses.length, 1);
      assert.strictEqual(Object.keys(db2.files).length, 2, 'pas de fichier orphelin');
      db2.failRows = false;

      // Un fichier texte enregistré sous Windows (pas en UTF-8) garde ses accents.
      await w.locator('input[type=file]').setInputFiles({ name: 'windows.txt', mimeType: 'text/plain', buffer: Buffer.from('Chapitre 1 Écologie\nLes élèves étudient.\n', 'latin1') });
      await w.getByLabel('Titre du cours').fill('');
      await w.getByRole('button', { name: 'Importer', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-widget=cahier] .cahier-title')?.textContent === 'Chapitre 1 Écologie');
      assert.match(await state(page), /Les élèves étudient/);
      // Un texte qui contient du HTML est affiché tel quel, jamais exécuté.
      await importFile(page, 'piege.txt', Buffer.from('<img src=x onerror="window.pirate=1"><script>window.pirate=2</script>'), 'text/plain');
      await page.waitForFunction(() => /<img src=x/.test(document.querySelector('[data-widget=cahier] .cahier-view').innerText));
      assert.strictEqual(await page.evaluate(() => window.pirate), undefined);
      assert.deepStrictEqual(errors, []);
      await context.close();
      console.log('ok scan, limites, annulation, panne, accents, HTML inerte');
    }

    // 4. Les quatre largeurs : rien ne déborde, le texte reste lisible.
    for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1440, 900]]) {
      const { page, context, errors } = await openBoard(browser, base, db, { viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
      const w = cahier(page);
      await page.waitForSelector('.cahier-title');
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.strictEqual(wide, false, `débordement à ${width}px`);
      const inside = await w.evaluate(b => [...b.querySelectorAll('select,input,button')].filter(x => x.offsetParent).every(x => { const r = x.getBoundingClientRect(), o = b.getBoundingClientRect(); return r.left >= o.left - 1 && r.right <= o.right + 1; }));
      assert.ok(inside, `contrôles hors du widget à ${width}px`);
      await w.scrollIntoViewIfNeeded();
      await shot(page, `cahier-${width}`);
      await w.getByRole('button', { name: 'Agrandir' }).click();
      await shot(page, `cahier-${width}-agrandi`);
      assert.deepStrictEqual(errors, []);
      await context.close();
    }
    console.log('ok 320, 390, 768 et 1440 px');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
