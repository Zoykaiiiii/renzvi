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
  await context.addInitScript(session => (localStorage.setItem('sb-xjkmztfsyyccveaeyzov-auth-token', session), localStorage.setItem('renzvi:vue-defaut', 'grille')), JSON.stringify({ access_token: JWT, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER }));
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
    if (!req.url().endsWith('/renzvi_plan')) return json(route, 200, []);
    return Promise.resolve(db.planGate).then(() => json(route, 200, db.plan ?? 'pro'));
  });
  await context.route(`${SUPABASE}/rest/v1/study_courses*`, route => {
    const req = route.request();
    const params = new URL(req.url()).searchParams;
    const id = params.get('id')?.replace(/^eq\./, '');
    if (req.method() === 'OPTIONS') return preflight(route);
    if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: {
      ...CORS, 'access-control-expose-headers': 'content-range', 'content-range': `*/${db.courses.length}`,
    } });
    if (req.method() === 'GET') {
      const from = Number(params.get('offset') ?? 0);
      return json(route, 200, db.courses.slice(from, from + Number(params.get('limit') ?? 1000)));
    }
    if (db.failRows) return json(route, 500, db.failRows === true ? { message: 'panne' } : db.failRows);
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

async function openImport(page) {
  const w = cahier(page);
  if (await w.evaluate(n => n.classList.contains('cahier-open')) && !await w.locator('.carnet-menu').isVisible()) {
    await w.getByRole('button', { name: 'Chapitres', exact: true }).click();
  }
  await w.getByRole('button', { name: 'Importer un cours', exact: true }).click();
  return w.getByRole('dialog', { name: 'Importer un cours' });
}

async function importFile(page, name, buffer, mimeType) {
  const dialog = await openImport(page);
  if (mimeType !== 'application/pdf') await dialog.getByRole('button', { name: 'Coller du texte' }).click();
  await dialog.locator('input[type=file]').setInputFiles({ name, mimeType, buffer });
  await dialog.getByRole('button', { name: 'Importer', exact: true }).click();
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
    for (const width of [1440, 320]) {
      const mobile = width < 500;
      const sample = fresh();
      Object.assign(sample.rows.ecran, { sizes: { cahier: 's' }, heights: { cahier: 140 } });
      const gate = Promise.withResolvers();
      sample.planGate = gate.promise;
      const { page, context } = await openBoard(browser, base, sample, {
        viewport: { width, height: mobile ? 568 : 900 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce',
      });
      try {
        const w = cahier(page);
        const hit = w.locator('.cahier-livre-open');
        await hit.waitFor();
        assert.ok(await hit.evaluate(n => {
          const r = n.getBoundingClientRect(), body = n.closest('.body'), bounds = body.getBoundingClientRect();
          return body.scrollTop === 0 && r.top >= bounds.top && r.bottom <= bounds.bottom && r.bottom <= innerHeight;
        }), 'l’ouverture est accessible sans faire défiler le widget');
        const dialog = await openImport(page);
        const name = dialog.getByLabel('Nom du cours');
        const submit = dialog.getByRole('button', { name: 'Importer', exact: true });
        const fits = () => dialog.evaluate(d => d.scrollHeight <= d.clientHeight && d.scrollWidth <= d.clientWidth && d.scrollTop === 0 &&
          [...d.querySelectorAll('button,input[type=text]')].every(n => {
            const r = n.getBoundingClientRect();
            return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
          }));
        assert.ok(await fits(), `formulaire visible en entier à ${width}px`);
        assert.equal(await dialog.locator('textarea').count(), 0);
        assert.equal(await dialog.locator('input[type=text]').count(), 1);
        await shot(page, `cahier-import-${width}`);
        const chooser = page.waitForEvent('filechooser');
        await dialog.getByRole('button', { name: 'Choisir un PDF' }).click();
        await (await chooser).setFiles({ name: 'Mon cours.PDF', mimeType: 'application/pdf', buffer: pdf });
        assert.equal(await name.inputValue(), 'Mon cours');
        await name.fill('Mon titre personnalisé');
        const replace = page.waitForEvent('filechooser');
        await dialog.getByRole('button', { name: 'Remplacer Mon cours.PDF' }).click();
        const filename = 'Polycopié très détaillé sur les sources du droit et la responsabilité civile.pdf';
        await (await replace).setFiles({ name: filename, mimeType: 'application/pdf', buffer: pdf });
        assert.equal(await name.inputValue(), 'Mon titre personnalisé');
        assert.equal(await dialog.locator('.cahier-filerow .cahier-chosen').textContent(), filename);
        assert.ok(await fits(), 'le nom du fichier reste dans la ligne');
        await shot(page, `cahier-import-${width}-fichier`);
        await submit.click();
        const busy = dialog.getByRole('button', { name: 'Importation…', exact: true });
        assert.ok(await busy.isVisible() && await busy.isDisabled() && await fits());
        await dialog.locator('form').dispatchEvent('submit');
        gate.resolve();
        await w.locator('.cahier-title').waitFor();
        assert.match(await w.getAttribute('class'), /cahier-open/);
        assert.match(await w.locator('.carnet-name').textContent(), /Mon titre personnalisé/);
        assert.equal(sample.courses.length, 1, 'la double soumission ne crée pas de doublon');
        assert.equal(sample.courses[0].file_name, filename);
      } finally {
        gate.resolve();
        await context.close();
      }
    }
    console.log('ok import PDF sans défilement à 1440 et 320 px, remplacement et double soumission');

    for (const [locale, entry, title, choose, submit, cancel, paste] of [
      ['en-GB', 'Import a course', 'Course name', 'Choose a PDF', 'Import', 'Cancel', 'Paste text'],
      ['es', 'Importar un curso', 'Nombre del curso', 'Elegir un PDF', 'Importar', 'Cancelar', 'Pegar texto'],
    ]) {
      const { page, context } = await openBoard(browser, base, fresh());
      await page.route('**/dashboard.html*', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: (await response.text()).replace('lang="fr"', `lang="${locale}"`) });
      });
      await page.reload();
      await cahier(page).getByRole('button', { name: entry, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: entry });
      assert.ok(await dialog.getByLabel(title).isVisible());
      for (const name of [choose, submit, cancel, paste]) assert.ok(await dialog.getByRole('button', { name, exact: true }).isVisible());
      await dialog.getByRole('button', { name: cancel, exact: true }).click();
      assert.equal(await dialog.count(), 0);
      await context.close();
    }
    console.log('ok libellés FR, EN et ES');

    const db = fresh();
    {
      const { page, context, errors } = await openBoard(browser, base, db);
      const w = cahier(page);
      await page.waitForFunction(() => document.querySelector('[data-widget=cahier] .cahier-view').innerText.includes('Importe un cours'));
      assert.strictEqual(await w.getAttribute('data-size'), 'l', 'le cahier est grand par défaut');
      await shot(page, 'cahier-vide');

      const dialog = await openImport(page);
      assert.strictEqual(await dialog.locator('textarea').count(), 0);
      await w.getByRole('button', { name: 'Importer', exact: true }).click();
      assert.match(await dialog.getByLabel('Nom du cours').getAttribute('aria-invalid'), /true/);
      assert.match(await dialog.getByText('Indique le nom du cours.').innerText(), /nom du cours/);
      await w.getByLabel('Nom du cours').fill('La cellule');
      await w.getByRole('button', { name: 'Importer', exact: true }).click();
      assert.ok(await dialog.getByText('Choisis un PDF.', { exact: true }).isVisible());
      await dialog.getByRole('button', { name: 'Coller du texte' }).click();
      await w.getByLabel('Texte du cours à coller').fill('# La membrane\nElle entoure la cellule.\n\n# Le noyau\nIl contient l’ADN, présent chez l’être vivant.');
      await w.getByRole('button', { name: 'Importer', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-widget=cahier] .cahier-title')?.textContent === 'La membrane');
      assert.match(await w.locator('.cahier-note').innerText(), /2 chapitres trouvés/);
      assert.strictEqual(db.courses.length, 1);
      assert.strictEqual(db.courses[0].subject, 'Sans matière');
      assert.ok(db.files[`cours/u1/${db.courses[0].id}/original.txt`] && db.files[`cours/u1/${db.courses[0].id}/texte.json`], 'original et texte gardés');
      await w.getByRole('button', { name: 'Chapitres', exact: true }).click();
      await w.getByRole('button', { name: 'Modifier la matière' }).click();
      await w.getByLabel('Matière du cours').fill('Biologie');
      await w.locator('.cahier-subject-editor').getByRole('button', { name: 'Enregistrer' }).click();
      await w.locator('.carnet-name').getByText('Biologie').waitFor();

      await importFile(page, 'droit-civil.pdf', pdf, 'application/pdf');
      await page.waitForFunction(() => document.querySelector('[data-widget=cahier] .cahier-title')?.textContent === 'Début', null, { timeout: 30000 });
      const c = db.courses.find(x => x.kind === 'pdf');
      assert.strictEqual(c.title, 'droit-civil', 'titre tiré du nom du fichier');
      assert.strictEqual(c.subject, 'Sans matière');
      assert.ok(c.page_count >= 4, `pages : ${c.page_count}`);
      assert.deepStrictEqual(c.chapters.map(x => x.title), ['Début', 'Chapitre 1 Les sources du droit', 'Chapitre 2 Le contrat', 'Chapitre 3 La responsabilité']);
      assert.match(await state(page), /Page 1/);
      assert.ok(!/Cours de droit civil — L1[\s\S]*Chapitre 1/.test(c.chapters.map(x => x.title).join()), "l'en-tête répété n'est pas un chapitre");

      // Les cours sont rangés par matière dans le choix du cours.
      assert.deepStrictEqual(await w.locator('.cahier-bar select optgroup').evaluateAll(g => g.map(x => x.label)), ['Biologie', 'Sans matière']);
      assert.strictEqual(await w.locator('.cahier-text').isVisible(), true, 'l’import ouvre le lecteur');
      await page.waitForFunction(() => !document.querySelector('[data-widget=cahier]').getAnimations().length);
      await page.getByRole('button', { name: 'Chapitres', exact: true }).click();
      // Menu stylé (dash/select.js) : mêmes groupes et options que le <select>, l'option choisie cochée.
      const coursePick = w.getByRole('combobox', { name: 'Cours' });
      await coursePick.click();
      const lb = page.getByRole('listbox', { name: 'Cours' });
      assert.deepStrictEqual(await lb.getByRole('group').evaluateAll(g => g.map(x => x.getAttribute('aria-labelledby') && document.getElementById(x.getAttribute('aria-labelledby')).textContent)), ['Biologie', 'Sans matière']);
      assert.strictEqual(await lb.getByRole('option', { selected: true }).innerText(), await w.locator('.carnet-course').evaluate(s => s.selectedOptions[0].label));
      await page.waitForTimeout(200);
      await shot(page, 'cahier-menu-cours-ouvert');
      await page.keyboard.press('Escape');
      assert.strictEqual(await lb.count(), 0);

      await w.getByRole('button', { name: 'Chapitre suivant' }).click();
      await w.getByRole('button', { name: 'Chapitre suivant' }).click();
      assert.strictEqual(await w.locator('.cahier-title').innerText(), 'Chapitre 2 Le contrat');
      assert.strictEqual(await w.locator('.carnet-count').innerText(), 'Chapitre 3 sur 4');
      await w.getByRole('button', { name: 'Chercher dans le cours' }).click();
      await w.locator('.carnet-find').fill('hypotheque');
      await page.waitForSelector('.cahier-results li');
      assert.match(await w.locator('.cahier-results').innerText(), /Chapitre 2 Le contrat · page \d[\s\S]*hypothèque/);
      await shot(page, 'cahier-recherche');
      await w.locator('.carnet-find').fill('élève étudie');
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
      assert.match(await w.locator('.cahier-livre-foot').innerText(), /Chapitre 3 sur 4/, 'le livre montre le chapitre où l’on s’est arrêté');
      await w.locator('.cahier-livre-open').click();
      await page.waitForFunction(() => !document.querySelector('[data-widget=cahier]').getAnimations().length);
      // Le carnet rouvre sur la même ligne du texte, pas au pixel près.
      const y = await page.locator('.cahier-text').evaluate(e => e.scrollTop);
      assert.ok(Math.abs(y - 300) <= 4, `reprise à la dernière position (${y})`);

      // Corriger les chapitres (depuis « Gérer ce cours ») : renommer, couper à un endroit choisi, retirer.
      await page.getByRole('button', { name: 'Chapitres', exact: true }).click();
      await w.locator('.carnet-menu').getByRole('button', { name: 'Modifier les chapitres' }).click();
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
      await page.getByRole('button', { name: 'Chapitres', exact: true }).click();
      await w.locator('.carnet-menu').getByRole('button', { name: 'Terminer les chapitres' }).click();

      // Le carnet prend presque tout l'écran ; Échap le referme.
      const big = await w.evaluate(b => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), getComputedStyle(b).position]; });
      assert.ok(big[0] >= 1300 && big[1] >= 800 && big[2] === 'fixed', `le carnet prend presque tout l’écran (${big})`);
      await shot(page, 'cahier-agrandi');
      await page.keyboard.press('Escape');
      assert.notStrictEqual(await w.evaluate(b => getComputedStyle(b).position), 'fixed', 'Échap referme le cahier agrandi');

      // Supprimer en deux appuis (dans « Gérer ce cours »).
      const id = c.id;
      await w.locator('.cahier-livre-open').click();
      await page.waitForFunction(() => !document.querySelector('[data-widget=cahier]').getAnimations().length);
      await page.getByRole('button', { name: 'Chapitres', exact: true }).click();
      await w.locator('.carnet-menu').getByRole('button', { name: 'Supprimer ce cours' }).click();
      assert.strictEqual(db.courses.length, 2, 'le premier appui ne supprime rien');
      await page.getByRole('button', { name: 'Chapitres', exact: true }).click();
      await w.locator('.carnet-menu').getByRole('button', { name: /Appuie encore/ }).click();
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
      await w.getByRole('button', { name: 'Chapitres', exact: true }).click();
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
      assert.match(await w.locator('.cahier-import').innerText(), /Choisis un PDF\./);

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
      await w.getByRole('button', { name: 'Coller du texte' }).click();
      await w.locator('input[type=file]').setInputFiles({ name: 'cours.txt', mimeType: 'text/plain', buffer: Buffer.from('Chapitre 1 Un\nA\nChapitre 2 Deux\nB') });
      await w.getByRole('button', { name: 'Importer', exact: true }).click();
      await page.waitForFunction(() => /enregistrement n'a pas abouti/.test(document.querySelector('.cahier-import').innerText));
      assert.strictEqual(db2.courses.length, 1);
      assert.strictEqual(Object.keys(db2.files).length, 2, 'pas de fichier orphelin');
      db2.failRows = false;

      // Un fichier texte enregistré sous Windows (pas en UTF-8) garde ses accents.
      await w.getByLabel('Nom du cours').fill('');
      await w.locator('input[type=file]').setInputFiles({ name: 'windows.txt', mimeType: 'text/plain', buffer: Buffer.from('Chapitre 1 Écologie\nLes élèves étudient.\n', 'latin1') });
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

    // Quotas : le contrôle précède les fichiers. Worker importe au-delà d'une page de cours.
    for (const [plan, count, allowed] of [['gratuit', 1, false], ['pro', 10, false], ['worker', 501, true]]) {
      const quotaDb = fresh();
      quotaDb.plan = plan;
      quotaDb.courses = Array.from({ length: count }, (_, i) => ({
        id: `cours-${i}`, subject: 'Biologie', title: `Cours ${i + 1}`, kind: 'pdf',
        file_name: 'scan.pdf', file_size: 10, page_count: 1, text_chars: 0, chapters: [],
      }));
      const { page, context } = await openBoard(browser, base, quotaDb);
      const w = cahier(page);
      await w.locator('.cahier-pick option').last().waitFor({ state: 'attached' });
      assert.equal(await w.getByLabel('Cours', { exact: true }).locator('option').count(), count);
      await importFile(page, 'cours.txt', Buffer.from('Le texte du cours.'), 'text/plain');
      if (allowed) {
        await w.locator('.cahier-bar .cahier-pick option', { hasText: /^cours$/ }).waitFor({ state: 'attached' });
        assert.equal(quotaDb.courses.length, count + 1);
        assert.equal(Object.keys(quotaDb.files).length, 2);
      } else {
        await w.getByRole('status').getByText(`Limite atteinte : ${count} cours maximum`, { exact: false }).waitFor();
        assert.equal(Object.keys(quotaDb.files).length, 0);
        assert.equal(quotaDb.courses.length, count);
      }
      await context.close();
    }
    console.log('ok quotas Gratuit, Pro et Worker');

    // 4. Les quatre largeurs : rien ne déborde, le texte reste lisible.
    for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1440, 900]]) {
      const { page, context, errors } = await openBoard(browser, base, db, { viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
      const w = cahier(page);
      await page.waitForSelector('[data-widget=cahier] .cahier-livre-open');
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.strictEqual(wide, false, `débordement à ${width}px`);
      const inside = await w.evaluate(b => [...b.querySelectorAll('select,input,button')].filter(x => x.offsetParent).every(x => { const r = x.getBoundingClientRect(), o = b.getBoundingClientRect(); return r.left >= o.left - 1 && r.right <= o.right + 1; }));
      assert.ok(inside, `contrôles hors du widget à ${width}px`);
      await w.scrollIntoViewIfNeeded();
      await shot(page, `cahier-${width}`);
      await w.getByRole('button', { name: 'Ouvrir le cahier' }).click();
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
