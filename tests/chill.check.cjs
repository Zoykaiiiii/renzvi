// Vérifie le chantier Chill (labo) dans un vrai Chromium, Supabase simulé : masquage public, accès au labo,
// jardin, dessin, coloriage, puzzle, tangram, fenêtre, ambiances et arrêt progressif, « J'ai cinq minutes », tailles.
// Lancement : NODE_PATH=<dossier node_modules contenant playwright> node tests/chill.check.cjs [dossier-captures]
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const G = require('../site/chill/jeux.js');

const ROOT = path.join(__dirname, '..', 'site');
const SHOTS = process.argv[2];
const SUPABASE = 'https://xjkmztfsyyccveaeyzov.supabase.co';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const JWT = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u1', exp: 4102444800, role: 'authenticated' })}.sig`;
const USER = { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'lea@exemple.fr', app_metadata: {}, user_metadata: { full_name: 'Léa Martin' }, created_at: '2026-11-03T00:00:00Z' };
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const NEW = ['jardin', 'dessin', 'coloriage', 'puzzle', 'tangram', 'fenetre', 'ambiances', 'cinq'];
const TITLES = ['Mon petit jardin', 'Atelier de dessin', 'Coloriage', 'Puzzle photo', 'Tangram', "Fenêtre d'ambiance", 'Mes ambiances', "J'ai cinq minutes"];

const requests = [];
const server = http.createServer((req, res) => {
  requests.push(req.url);
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
// supabase-js envoie un Blob en multipart : on garde seulement le fichier, comme le vrai stockage.
function filePart(req) {
  const type = req.headers()['content-type'] ?? '', buf = req.postDataBuffer(), m = /boundary=(.+)$/.exec(type);
  if (!m) return { body: buf, type };
  for (const part of buf.toString('latin1').split(`--${m[1]}`)) {
    const i = part.indexOf('\r\n\r\n'), head = part.slice(0, Math.max(i, 0)), t = /content-type:\s*([^\r\n]+)/i.exec(head);
    if (i > 0 && t) return { body: Buffer.from(part.slice(i + 4, part.lastIndexOf('\r\n')), 'latin1'), type: t[1].trim() };
  }
  return { body: buf, type };
}
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
const preflight = route => route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
// Capte le son réellement produit (même méthode que tests/login.check.cjs).
const AUDIO_SPY = () => {
  const Real = window.AudioContext, connect = AudioNode.prototype.connect;
  window.__ctxs = [];
  window.AudioContext = class extends Real { constructor(...a) { super(...a); window.__ctxs.push(this); } };
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (dest instanceof AudioDestinationNode) { const c = dest.context; c.__an ??= Object.assign(c.createAnalyser(), { fftSize: 2048 }); connect.call(this, c.__an); }
    return connect.call(this, dest, ...rest);
  };
  window.__raf = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = f => { window.__raf++; return raf(f); };
};

async function openBoard(browser, base, { options = {}, rows = {}, query = '?chill=1', clock = false } = {}) {
  const context = await browser.newContext(options);
  await context.addInitScript(session => localStorage.setItem('sb-xjkmztfsyyccveaeyzov-auth-token', session), JSON.stringify({ access_token: JWT, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER }));
  await context.addInitScript(AUDIO_SPY);
  const db = { rows: structuredClone(rows), failSave: false, saves: 0, files: new Map(), failUpload: false, failDownload: false, uploads: 0 };
  await context.route(`${SUPABASE}/rest/v1/widget_state*`, route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    if (req.method() === 'GET') return json(route, 200, Object.entries(db.rows).map(([widget, data]) => ({ widget, data })));
    db.saves++;
    if (db.failSave) return json(route, 500, { message: 'panne' });
    for (const row of req.postDataJSON()) db.rows[row.widget] = row.data;
    return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' } });
  });
  await context.route(`${SUPABASE}/rest/v1/rpc/*`, route => route.request().method() === 'OPTIONS' ? preflight(route) : json(route, 200, []));
  await context.route(`${SUPABASE}/rest/v1/study_*`, route => route.request().method() === 'OPTIONS' ? preflight(route) : json(route, 200, []));
  await context.route(`${SUPABASE}/storage/v1/object/**`, route => {
    const req = route.request(), m = req.method();
    if (m === 'OPTIONS') return preflight(route);
    const p = decodeURIComponent(new URL(req.url()).pathname.replace('/storage/v1/object/', '').replace(/^(authenticated|public)\//, ''));
    if (m === 'DELETE') { for (const name of req.postDataJSON().prefixes) db.files.delete(`${p}/${name}`); return json(route, 200, []); }
    if (m === 'GET') return !db.failDownload && db.files.has(p) ? route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': db.files.get(p).type }, body: db.files.get(p).body }) : json(route, 404, { message: 'absent' });
    db.uploads++;
    if (db.failUpload) return json(route, 500, { message: 'panne' });
    db.files.set(p, filePart(req));
    return json(route, 200, { Key: p });
  });
  await context.route(/open\.spotify\.com|i\.scdn\.co|youtube/, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>lecteur</title>' }));
  await context.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await context.newPage();
  if (clock) await page.clock.install();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message + (process.env.STACK ? e.stack : '')));
  await page.goto(`${base}/dashboard.html${query}`);
  await page.waitForSelector('#board .widget:not([hidden]), #board-empty:not([hidden]), #setup:not([hidden])');
  return { context, db, page, errors };
}
const board = (ids, extra = {}) => ({ ecran: { wallpaper: 'blanc', widgets: ids, done: true, ...extra } });
const W = (page, id) => page.locator(`#board [data-widget=${id}]`);
const saved = page => page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
const until = async (fn, what, ms = 8000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error(`délai dépassé : ${what}`); await new Promise(r => setTimeout(r, 50)); } };
const shot = (page, name, opts) => SHOTS && page.screenshot({ path: path.join(SHOTS, `chill-${name}.png`), ...opts });
// Pixel d'un canvas de dessin (coordonnées internes 1600 x 1200).
const pixel = (loc, x, y) => loc.evaluate((c, [x, y]) => [...c.getContext('2d').getImageData(x, y, 1, 1).data].slice(0, 3), [x, y]);
const hash = loc => loc.evaluate(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0; return `${c.width}x${c.height}:${h}`; });
async function stroke(page, canvas, from = [.3, .5], to = [.7, .5]) {
  await canvas.scrollIntoViewIfNeeded();
  const b = await canvas.boundingBox();
  await page.mouse.move(b.x + b.width * from[0], b.y + b.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * to[0], b.y + b.height * to[1], { steps: 12 });
  await page.mouse.up();
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const desk = { viewport: { width: 1440, height: 1200 } };
  const CHILL_FILES = /chill\/(jardin|atelier|jeux|fenetre|ambiances|cinq|labo)\.js|chill\.css/;

  // 1. Expérience publique : aucun widget Chill du labo, aucun module chargé, même si l'écran enregistré les cite.
  {
    requests.length = 0;
    const { page, errors, context } = await openBoard(browser, base, { options: desk, rows: board(['jardin', 'dessin', 'respiration', 'ambiance']), query: '' });
    assert.equal(await page.locator('#board .widget').count(), 2, 'seuls les widgets publics sont affichés');
    assert.equal(await page.locator('#chill-labo').count(), 0, 'pas de bouton Labo Chill');
    await page.click('#open-add');
    const catalog = await page.textContent('#catalog');
    for (const t of TITLES) assert.ok(!catalog.includes(t), `catalogue public sans « ${t} »`);
    assert.ok(catalog.includes('Respiration guidée') && catalog.includes('Ambiance sonore'));
    assert.ok(!requests.some(u => CHILL_FILES.test(u)), `aucun module Chill téléchargé : ${requests.filter(u => CHILL_FILES.test(u))}`);
    assert.deepEqual(errors, []);
    await context.close();
  }
  // Le labo Study (?labo=1) n'ouvre pas le labo Chill, et inversement.
  {
    const { page, errors, context } = await openBoard(browser, base, { options: desk, rows: board([]), query: '?labo=1' });
    await page.click('#open-add');
    const catalog = await page.textContent('#catalog');
    assert.ok(catalog.includes('Quiz'), 'labo Study visible');
    for (const t of TITLES) assert.ok(!catalog.includes(t), `?labo=1 ne montre pas « ${t} »`);
    assert.equal(await page.locator('#chill-labo').count(), 0);
    await page.goto(`${base}/dashboard.html?labo=0&chill=1`);
    await page.click('#open-add');
    const chill = await page.textContent('#catalog');
    for (const t of TITLES) assert.ok(chill.includes(t), `?chill=1 montre « ${t} »`);
    assert.ok(!chill.includes('Quiz'), '?chill=1 ne montre pas les widgets Study en préparation');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#chill-labo').isVisible(), true);
    await page.goto(`${base}/dashboard.html?chill=0`);
    await page.waitForSelector('#board-empty:not([hidden])');
    assert.equal(await page.locator('#chill-labo').count(), 0, '?chill=0 referme le labo sur cet appareil');
    assert.equal(await page.evaluate(() => localStorage.getItem('renzvi:chill')), '');
    assert.deepEqual(errors, []);
    await context.close();
  }
  // Premier lancement, même avec ?chill=1 : les modes proposés restent les modes publics.
  {
    const { page, errors, context, db } = await openBoard(browser, base, { options: desk, rows: {}, query: '?chill=1' });
    await page.getByRole('button', { name: 'Continuer' }).click();
    const text = await page.textContent('#setup');
    for (const t of TITLES) assert.ok(!text.includes(t), `onboarding sans « ${t} »`);
    await page.getByRole('button', { name: 'Installer Study et Chill' }).click();
    await saved(page);
    assert.ok(!db.rows.ecran.widgets.some(id => NEW.includes(id)), 'aucun widget Chill du labo installé automatiquement');
    assert.ok(db.rows.ecran.widgets.includes('respiration'));
    assert.deepEqual(errors, []);
    await context.close();
  }
  // Landing : aucune mention des nouveautés.
  for (const f of ['index.html', 'landing.js', 'login.html']) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const word of ['jardin', 'Tangram', 'tangram', 'Coloriage', 'cinq minutes', 'chill/']) assert.ok(!text.includes(word), `${f} ne cite pas « ${word} »`);
  }
  console.log('ok - expérience publique sans les nouveautés, accès volontaire au labo Chill');

  // 2. Jardin : planter, arroser une seule fois, enregistrer, reprendre après rechargement, labo d'horloge, longue absence.
  {
    const { page, errors, context, db } = await openBoard(browser, base, { options: desk, rows: board(['jardin']) });
    const w = W(page, 'jardin');
    await w.getByRole('button', { name: /Emplacement 1 : libre/ }).click();
    await w.getByRole('button', { name: 'Tulipe', exact: true }).click();
    await saved(page);
    assert.equal(db.rows.jardin.plots[0].s, 'tulipe');
    await w.getByRole('button', { name: 'Arroser' }).click();
    assert.equal(await w.getByRole('button', { name: 'Arroser' }).isDisabled(), true, 'une fois arrosée, il faut attendre');
    await w.getByRole('button', { name: 'Arroser' }).click({ force: true, trial: false }).catch(() => {});
    await saved(page);
    assert.equal(db.rows.jardin.plots[0].w, 1, 'un seul arrosage compté');
    assert.match(await w.textContent('.jardin-panel'), /Déjà arrosée/);
    await page.reload();
    await page.waitForSelector('.jardin-grid');
    assert.match(await W(page, 'jardin').getByRole('button', { name: /Emplacement 1/ }).getAttribute('aria-label'), /Tulipe, pousse/, "l'arrosage fait pousser");
    await W(page, 'jardin').getByRole('button', { name: '+1 jour' }).click();
    assert.match(await W(page, 'jardin').getByRole('button', { name: /Emplacement 1/ }).getAttribute('aria-label'), /jeune plante/, 'labo : l\'horloge avance');
    assert.deepEqual(errors, []);
    await context.close();
    // Après 40 jours d'absence : en fleur, rien n'est mort ; cueillir débloque une décoration.
    const old = Date.now() - 40 * 864e5;
    const r = await openBoard(browser, base, { options: { viewport: { width: 390, height: 900 }, hasTouch: true, isMobile: true }, rows: board(['jardin'], { sizes: { jardin: 'l' } }) });
    r.db.rows.jardin = { plots: [{ s: 'tournesol', t: old, w: 0, lw: null }, { s: 'fougere', t: old, w: 0, lw: null }], decor: [], blooms: 0 };
    await r.page.reload();
    await r.page.waitForSelector('.jardin-grid');
    const w2 = W(r.page, 'jardin');
    assert.match(await w2.getByRole('button', { name: /Emplacement 1/ }).getAttribute('aria-label'), /Tournesol, en fleur/);
    assert.match(await w2.getByRole('button', { name: /Emplacement 2/ }).getAttribute('aria-label'), /Fougère, déployée/);
    await w2.getByRole('button', { name: /Emplacement 1/ }).tap();
    await w2.getByRole('button', { name: 'Cueillir' }).tap();
    await saved(r.page);
    assert.equal(r.db.rows.jardin.blooms, 1);
    await w2.getByRole('button', { name: /Décoration 1/ }).tap();
    await w2.getByRole('button', { name: 'Lanterne' }).tap();
    await saved(r.page);
    assert.equal(r.db.rows.jardin.decor[0], 'lanterne');
    await shot(r.page, 'jardin-mobile', { fullPage: true });
    assert.deepEqual(r.errors, []);
    await r.context.close();
  }
  console.log('ok - jardin : plantation, arrosage limité, reprise, absence sans dommage, décor débloqué, tactile');

  // 3. Dessin : tracer, annuler / rétablir, enregistrement temporisé, reprise, redimensionnement, tactile, gomme, effacement, export, inspiration, pannes.
  {
    const { page, errors, context, db } = await openBoard(browser, base, { options: desk, rows: board(['dessin', 'inspiration']) });
    const w = W(page, 'dessin'), canvas = w.locator('canvas.atelier-paper');
    await page.waitForFunction(() => document.querySelector('[data-widget=dessin] .atelier-veil')?.hidden);
    assert.deepEqual(await pixel(canvas, 800, 600), [255, 255, 255]);
    await stroke(page, canvas);
    const ink = await pixel(canvas, 800, 600);
    assert.ok(ink[0] < 100, `le trait est dessiné : ${ink}`);
    assert.equal(db.uploads, 0, 'pas d\'envoi pendant le geste');
    await w.getByRole('button', { name: 'Annuler', exact: true }).click();
    assert.deepEqual(await pixel(canvas, 800, 600), [255, 255, 255], 'annuler');
    await w.getByRole('button', { name: 'Rétablir' }).click();
    assert.ok((await pixel(canvas, 800, 600))[0] < 100, 'rétablir');
    await until(() => db.files.has('dessins/u1/1.png'), 'dessin envoyé');
    await saved(page);
    assert.equal(db.uploads, 1, 'un seul envoi après plusieurs actions');
    assert.deepEqual(db.rows.dessin.items.map(i => i.slot), [1]);
    // Redimensionner ne touche pas au dessin.
    const before = await hash(canvas);
    await page.click('#open-custom');
    for (const size of ['Grand', 'Petit', 'Moyen']) {
      await page.getByRole('group', { name: 'Taille de Atelier de dessin' }).getByRole('button', { name: size, exact: true }).click();
      assert.equal(await hash(canvas), before, `dessin intact en taille ${size}`);
    }
    await page.click('#custom-done');
    // Reprise après rechargement.
    await page.reload();
    await page.waitForFunction(() => document.querySelector('[data-widget=dessin] .atelier-veil')?.hidden);
    assert.ok((await pixel(W(page, 'dessin').locator('canvas'), 800, 600))[0] < 100, 'dessin retrouvé après rechargement');
    // Gomme, effacer avec confirmation.
    const w2 = W(page, 'dessin'), c2 = w2.locator('canvas.atelier-paper');
    await w2.getByRole('button', { name: 'Gomme' }).click();
    await w2.getByRole('button', { name: 'Très épais' }).click();
    await stroke(page, c2, [.45, .5], [.55, .5]);
    assert.deepEqual(await pixel(c2, 800, 600), [255, 255, 255], 'gomme');
    await w2.getByRole('button', { name: 'Pinceau' }).click();
    await stroke(page, c2, [.2, .3], [.4, .3]);
    await w2.getByRole('button', { name: 'Effacer', exact: true }).click();
    assert.equal(await w2.getByRole('button', { name: 'Vraiment tout effacer ?' }).isVisible(), true, 'confirmation demandée');
    assert.ok((await pixel(c2, 480, 360))[0] < 100, 'rien effacé avant confirmation');
    await w2.getByRole('button', { name: 'Vraiment tout effacer ?' }).click();
    assert.deepEqual(await pixel(c2, 480, 360), [255, 255, 255]);
    // Symétrie : le trait apparaît aussi en miroir.
    await w2.getByRole('button', { name: 'Symétrie' }).click();
    await stroke(page, c2, [.1, .8], [.2, .8]);
    assert.ok((await pixel(c2, 1600 - 240, 960))[0] < 100, 'symétrie');
    // Export PNG.
    const [file] = await Promise.all([page.waitForEvent('download'), w2.getByRole('button', { name: 'Exporter en PNG' }).click()]);
    assert.equal(file.suggestedFilename(), 'renzvi-dessin.png');
    // Vers le tableau d'inspiration : même stockage privé, widget rechargé à sa place.
    await w2.getByRole('button', { name: "Ajouter à l'inspiration" }).click();
    await page.waitForFunction(() => /Ajouté/.test(document.querySelector('[data-widget=dessin]').textContent));
    await saved(page);
    assert.equal(db.files.get('inspiration/u1/1.jpg').type, 'image/jpeg');
    assert.ok(db.files.get('inspiration/u1/1.jpg').body.length <= 500 * 1024);
    assert.deepEqual(db.rows.inspiration.items, [{ slot: 1, caption: 'Dessin' }]);
    assert.equal(await W(page, 'inspiration').locator('figure').count(), 1);
    assert.deepEqual(await page.$$eval('#board > .widget', b => b.map(x => x.dataset.widget)), ['dessin', 'inspiration'], 'ordre des widgets inchangé');
    await shot(page, 'dessin', { fullPage: true });
    // Panne d'envoi : le dessin reste, on le dit, on réessaie.
    await until(() => db.uploads >= 2, 'enregistrement du dessin modifié', 10000);
    db.failUpload = true;
    await stroke(page, c2, [.3, .2], [.6, .2]);
    await page.waitForFunction(() => /Pas encore enregistré/.test(document.querySelector('[data-widget=dessin] .atelier-status').textContent), null, { timeout: 8000 });
    db.failUpload = false;
    await w2.getByRole('button', { name: 'Réessayer' }).click();
    await page.waitForFunction(() => document.querySelector('[data-widget=dessin] .atelier-status').textContent === 'Enregistré');
    // Panne de lecture : on ne peut pas dessiner par-dessus (ce qui écraserait l'original).
    db.failDownload = true;
    await page.reload();
    await page.waitForFunction(() => /n'a pas pu se charger/.test(document.querySelector('[data-widget=dessin] .atelier-veil')?.textContent ?? ''));
    assert.equal(await W(page, 'dessin').locator('canvas.locked').count(), 1);
    db.failDownload = false;
    await W(page, 'dessin').getByRole('button', { name: 'Réessayer' }).click();
    await page.waitForFunction(() => document.querySelector('[data-widget=dessin] .atelier-veil').hidden);
    // Supprimer : fichier retiré du stockage.
    await W(page, 'dessin').getByRole('button', { name: 'Supprimer ce dessin' }).click();
    await W(page, 'dessin').getByRole('button', { name: 'Vraiment supprimer ?' }).click();
    await page.waitForFunction(() => /supprimé/.test(document.querySelector('[data-widget=dessin] .atelier-status').textContent));
    await saved(page);
    assert.equal(db.files.has('dessins/u1/1.png'), false, 'fichier supprimé');
    assert.deepEqual(db.rows.dessin.items, []);
    assert.deepEqual(errors, []);
    await context.close();
  }
  // Tactile sur téléphone : dessiner ne fait pas défiler la page ; vue agrandie.
  {
    const { page, errors, context } = await openBoard(browser, base, { options: { viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true }, rows: board(['heure', 'dessin']) });
    const canvas = W(page, 'dessin').locator('canvas.atelier-paper');
    await page.waitForFunction(() => document.querySelector('[data-widget=dessin] .atelier-veil')?.hidden);
    await canvas.scrollIntoViewIfNeeded();
    const y0 = await page.evaluate(() => scrollY);
    const b = await canvas.boundingBox();
    const cdp = await context.newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await touch('touchStart', b.x + b.width * .5, b.y + b.height * .2);
    for (let i = 1; i <= 10; i++) await touch('touchMove', b.x + b.width * .5, b.y + b.height * (.2 + i * .06));
    await touch('touchEnd');
    assert.equal(await page.evaluate(() => scrollY), y0, 'la page ne défile pas pendant le dessin');
    assert.ok((await pixel(canvas, 800, 600))[0] < 100, 'trait au doigt');
    // shortcut: dans l'émulation tactile de Chromium, le premier toucher après un geste CDP brut est avalé ; on clique.
    await W(page, 'dessin').getByRole('button', { name: 'Agrandir' }).click();
    assert.equal(await page.locator('dialog.chill-big canvas.atelier-paper').isVisible(), true);
    assert.ok((await pixel(page.locator('dialog.chill-big canvas'), 800, 600))[0] < 100, 'même dessin en grand');
    await shot(page, 'dessin-agrandi-mobile');
    await page.locator('dialog.chill-big').getByRole('button', { name: 'Fermer' }).click();
    await W(page, 'dessin').locator('canvas').waitFor({ timeout: 2000 });
    assert.ok((await pixel(W(page, 'dessin').locator('canvas'), 800, 600))[0] < 100, 'le dessin revient dans le widget');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('ok - dessin : trait, annuler/rétablir, sauvegarde temporisée, reprise, tailles, gomme, symétrie, export, inspiration, pannes, tactile');

  // 4. Coloriage : remplir, annuler / rétablir, clavier, enregistrer, reprendre, exporter.
  {
    const { page, errors, context, db } = await openBoard(browser, base, { options: desk, rows: board(['coloriage']) });
    const w = W(page, 'coloriage');
    const sky = w.locator('[data-z=z0]');
    await sky.click({ position: { x: 6, y: 6 } });
    assert.equal(await sky.getAttribute('fill'), '#d6453d');
    await w.locator('.atelier-swatch').nth(8).click();
    await w.locator('[data-z=z2]').click({ position: { x: 6, y: 60 } });
    assert.equal(await w.locator('[data-z=z2]').getAttribute('fill'), '#3b6fb6');
    await w.getByRole('button', { name: 'Annuler', exact: true }).click();
    assert.equal(await w.locator('[data-z=z2]').getAttribute('fill'), '#ffffff');
    await w.getByRole('button', { name: 'Rétablir' }).click();
    assert.equal(await w.locator('[data-z=z2]').getAttribute('fill'), '#3b6fb6');
    await w.locator('[data-z=z1]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await w.locator('[data-z=z1]').getAttribute('fill'), '#3b6fb6', 'remplissage au clavier');
    await saved(page);
    assert.deepEqual(db.rows.coloriage.fills.maison, { z0: '#d6453d', z1: '#3b6fb6', z2: '#3b6fb6' });
    await page.reload();
    await page.waitForSelector('.coloriage-svg');
    assert.equal(await W(page, 'coloriage').locator('[data-z=z0]').getAttribute('fill'), '#d6453d', 'repris après rechargement');
    const [file] = await Promise.all([page.waitForEvent('download'), W(page, 'coloriage').getByRole('button', { name: 'Exporter en PNG' }).click()]);
    const png = fs.readFileSync(await file.path());
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    await W(page, 'coloriage').getByRole('button', { name: 'Mandala' }).click();
    await shot(page, 'coloriage');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('ok - coloriage');

  // 5. Puzzle : clavier, réussite, mélange résoluble, photo gardée sur l'appareil.
  {
    const { page, errors, context, db } = await openBoard(browser, base, { options: desk, rows: { ...board(['puzzle']), puzzle: { n: 3, tiles: [1, 2, 3, 4, 5, 6, 7, 0, 8], img: 'chiffres', moves: 2 } } });
    const w = W(page, 'puzzle');
    await w.locator('.taquin').focus();
    await page.keyboard.press('ArrowLeft');
    assert.match(await w.textContent('[role=status]'), /Bravo, l'image est reconstituée en 3 coups/);
    await saved(page);
    assert.deepEqual(db.rows.puzzle.tiles, [1, 2, 3, 4, 5, 6, 7, 8, 0]);
    for (let k = 0; k < 5; k++) {
      await w.getByRole('button', { name: 'Recommencer' }).click();
      await saved(page);
      assert.ok(G.taquinSolvable(db.rows.puzzle.tiles, 3) && !G.taquinIsSolved(db.rows.puzzle.tiles), 'mélange résoluble');
    }
    await w.getByRole('button', { name: 'Moyen', exact: true }).click();
    await saved(page);
    assert.equal(db.rows.puzzle.tiles.length, 16);
    assert.ok(G.taquinSolvable(db.rows.puzzle.tiles, 4));
    // Clic sur une pièce voisine de la case vide.
    const t = db.rows.puzzle.tiles, blank = t.indexOf(0), near = [blank - 1, blank + 1, blank - 4, blank + 4].find(i => i >= 0 && i < 16 && (i % 4 === blank % 4 || Math.floor(i / 4) === Math.floor(blank / 4)));
    await w.getByRole('button', { name: new RegExp(`^Pièce ${t[near]},`) }).click();
    await saved(page);
    assert.equal(db.rows.puzzle.tiles.indexOf(0), near, 'la pièce a glissé');
    // Photo personnelle : recadrée et gardée sur l'appareil, jamais envoyée.
    const photo = await page.evaluate(async () => { const c = Object.assign(document.createElement('canvas'), { width: 800, height: 500 }); const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 800, 500); return (await new Promise(r => c.toBlob(r, 'image/png'))).arrayBuffer().then(b => [...new Uint8Array(b)]); });
    await w.locator('input[type=file]').setInputFiles({ name: 'moi.png', mimeType: 'image/png', buffer: Buffer.from(photo) });
    await until(() => db.rows.puzzle.img === 'perso', 'photo choisie');
    assert.equal(db.rows.puzzle.img, 'perso');
    assert.equal(db.uploads, 0, 'aucune photo envoyée');
    assert.ok((await page.evaluate(() => localStorage.getItem('renzvi:puzzle-photo:u1'))).startsWith('data:image/jpeg'));
    await shot(page, 'puzzle');
    assert.deepEqual(errors, []);
    await context.close();
    // Sur un autre appareil, la photo n'est pas là : on le dit, le jeu continue.
    const r = await openBoard(browser, base, { options: desk, rows: { ...board(['puzzle']), puzzle: db.rows.puzzle } });
    assert.match(await W(r.page, 'puzzle').textContent('[role=status]'), /autre appareil/);
    assert.equal(await W(r.page, 'puzzle').locator('.taquin-tile').count(), 15);
    await r.context.close();
  }
  console.log('ok - puzzle');

  // 6. Tangram : glisser une pièce à la souris, déplacer au clavier, réussite validée par les surfaces.
  {
    const ref = G.TANGRAM_MODELS[0].ref;
    const start = ref.map((s, i) => i === 0 ? { x: 11.5, y: 2.2, r: 0, f: false } : i === 4 ? { ...s, x: s.x + .5 } : s);
    const { page, errors, context, db } = await openBoard(browser, base, { options: desk, rows: { ...board(['tangram'], { sizes: { tangram: 'l' } }), tangram: { model: 'carre', pieces: start } } });
    const w = W(page, 'tangram');
    const toScreen = (x, y) => page.evaluate(([x, y]) => { const s = document.querySelector('.tangram-board'), p = new DOMPoint(x, y).matrixTransform(s.getScreenCTM()); return [p.x, p.y]; }, [x, y]);
    assert.equal(await w.locator('.meta').textContent(), '');
    const [ax, ay] = await toScreen(11.5, 2.2), [bx, by] = await toScreen(ref[0].x + .12, ref[0].y - .1);
    await page.mouse.move(ax, ay);
    await page.mouse.down();
    await page.mouse.move(bx, by, { steps: 15 });
    await page.mouse.up();
    assert.equal(await w.locator('.meta').textContent(), '', 'pas encore : le carré est décalé');
    await w.locator('.t-c').focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    assert.match(await w.textContent('[role=status]'), /Silhouette « Carré » réussie/);
    await saved(page);
    assert.deepEqual(db.rows.tangram.solved, ['carre']);
    await shot(page, 'tangram');
    // Rotation au clavier et aide.
    await page.keyboard.press('r');
    assert.equal(await w.locator('.meta').textContent(), '', 'tourner le carré de 45° défait la silhouette');
    await w.getByRole('button', { name: 'Aide' }).click();
    assert.equal(await w.locator('.tangram-hint').evaluate(n => n.style.display), '');
    await w.getByRole('button', { name: 'Recommencer' }).click();
    await saved(page);
    assert.deepEqual(db.rows.tangram.pieces, G.tangramStart());
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('ok - tangram');

  // 7. Fenêtre d'ambiance : anime sans son, s'arrête en pause, au retrait, et reste immobile si l'appareil réduit les animations.
  {
    const { page, errors, context, db } = await openBoard(browser, base, { options: desk, rows: board(['fenetre']) });
    const w = W(page, 'fenetre');
    const frames = async () => { const a = await page.evaluate(() => window.__raf); await page.waitForTimeout(600); return (await page.evaluate(() => window.__raf)) - a; };
    // « Animée » : l'image change vraiment (plus fiable qu'un compte d'images sous une machine chargée).
    const moving = () => until(async () => { const a = await hash(w.locator('.fenetre-canvas')); await page.waitForTimeout(300); return a !== await hash(w.locator('.fenetre-canvas')); }, 'scène animée', 5000).then(() => true, () => false);
    await w.locator('.fenetre-canvas').waitFor();
    assert.ok(await moving(), 'la scène est animée');
    assert.equal(await page.evaluate(() => window.__ctxs.length), 0, 'aucun son lancé');
    await w.getByRole('button', { name: 'Pause' }).click();
    assert.ok(await frames() <= 1, 'pause : plus aucune image calculée');
    await w.getByRole('button', { name: 'Forêt' }).click();
    await w.getByRole('button', { name: 'Forte' }).click();
    await saved(page);
    assert.deepEqual(db.rows.fenetre, { scene: 'foret', intensity: 3 });
    await w.getByRole('button', { name: 'Lecture' }).click();
    assert.ok(await moving(), 'relancée');
    await shot(page, 'fenetre');
    await page.click('#open-add');
    await page.getByRole('button', { name: "Retirer : Fenêtre d'ambiance" }).click();
    assert.ok(await frames() <= 1, 'widget retiré : la boucle s\'arrête');
    assert.deepEqual(errors, []);
    await context.close();
    const r = await openBoard(browser, base, { options: { ...desk, reducedMotion: 'reduce' }, rows: board(['fenetre']) });
    await W(r.page, 'fenetre').locator('.fenetre-canvas').waitFor();
    assert.equal(await W(r.page, 'fenetre').getByRole('button', { name: 'Lecture' }).isVisible(), true, 'mouvement réduit : à l\'arrêt');
    const a = await r.page.evaluate(() => window.__raf); await r.page.waitForTimeout(500);
    assert.ok((await r.page.evaluate(() => window.__raf)) - a <= 1);
    await r.context.close();
  }
  console.log('ok - fenêtre d\'ambiance');

  // 8. Mes ambiances et arrêt progressif.
  {
    const rows = {
      ...board(['ambiance', 'fenetre', 'ambiances'], { wallpaper: 'lac' }),
      ambiance: { vol: { pluie: 35, vent: 0, feu: 0, cabine: 0, blanc: 0 }, master: 80 },
      ambiances: { items: [
        { id: 'a1', name: 'Soirée pluie', wall: 'loch', sound: { vol: { pluie: 45, feu: 20 }, master: 70 }, scene: { scene: 'feu', intensity: 1 } },
        { id: 'a2', name: 'Ancien réglage', wall: 'disparu', sound: { vol: { orage: 50, vent: 30 }, master: 60 }, scene: null },
      ] },
    };
    const { page, errors, context, db } = await openBoard(browser, base, { options: desk, rows });
    const w = W(page, 'ambiances'), amb = W(page, 'ambiance');
    const order = () => page.$$eval('#board > .widget', b => b.map(x => x.dataset.widget));
    const before = await order();
    await w.locator('.ambiances-check').filter({ hasText: 'la scène actuelle (Pluie)' }).waitFor();
    await w.getByRole('textbox', { name: "Nom de l'ambiance" }).fill('Mon soir');
    await w.getByRole('button', { name: "Enregistrer l'ambiance actuelle" }).click();
    await saved(page);
    const mine = db.rows.ambiances.items.find(i => i.name === 'Mon soir');
    assert.deepEqual([mine.wall, mine.sound.vol.pluie, mine.sound.master, mine.scene.scene], ['lac', 35, 80, 'pluie']);
    // Ressources disparues : le reste s'applique, on explique ce qui manque.
    await w.getByRole('button', { name: 'Appliquer : Ancien réglage' }).click();
    const said = await w.textContent('[role=status]');
    assert.match(said, /« Ancien réglage » appliquée\. Mais le fond « disparu » n'existe plus ; un son n'existe plus \(orage\)/);
    assert.equal(await amb.locator('.sound').filter({ hasText: 'Vent' }).locator('input').inputValue(), '30');
    await saved(page);
    assert.equal(db.rows.ambiance.vol.vent, 30, 'le mélange appliqué est gardé');
    assert.equal(await page.evaluate(() => window.__ctxs.length), 0, 'appliquer ne lance aucun son');
    await w.getByRole('button', { name: 'Appliquer : Soirée pluie' }).click();
    assert.doesNotMatch(await w.textContent('[role=status]'), /Mais/);
    await saved(page);
    assert.equal(db.rows.ecran.wallpaper, 'loch', 'fond appliqué');
    assert.match(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--wall')), /foggy-reflections/);
    assert.equal(await W(page, 'fenetre').getByRole('button', { name: 'Cheminée' }).getAttribute('aria-pressed'), 'true', 'scène appliquée');
    assert.deepEqual(await order(), before, 'les widgets ne bougent pas');
    // Modifier puis supprimer.
    await w.getByRole('button', { name: 'Modifier : Mon soir' }).click();
    await w.getByRole('textbox', { name: "Nom de l'ambiance" }).fill('Mon soir calme');
    await w.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await saved(page);
    assert.ok(db.rows.ambiances.items.some(i => i.name === 'Mon soir calme' && i.wall === 'lac'), 'modifiée sans changer ses réglages');
    await w.getByRole('button', { name: 'Supprimer : Ancien réglage' }).click();
    await w.getByRole('button', { name: 'Confirmer la suppression : Ancien réglage' }).click();
    await saved(page);
    assert.equal(db.rows.ambiances.items.length, 2);
    // Arrêt progressif : programmer, annuler, puis laisser finir. Le volume général change pendant le fondu.
    await w.getByRole('button', { name: 'Lancer le son' }).click();
    await page.waitForFunction(() => window.__ctxs[0]?.state === 'running');
    await w.getByRole('button', { name: '20 s (labo)' }).click();
    assert.match(await w.locator('.ambiances-sleep [role=status]').textContent(), /Arrêt dans 00:(19|20)/);
    await w.getByRole('button', { name: "Annuler l'arrêt" }).click();
    assert.equal(await w.locator('.ambiances-sleep [role=status]').textContent(), 'Aucun arrêt programmé.');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__ctxs[0].state), 'running', 'annulé : le son continue');
    await w.getByRole('button', { name: '20 s (labo)' }).click();
    await shot(page, 'ambiances', { fullPage: true });
    await page.waitForTimeout(13000);
    await amb.locator('.sound').filter({ hasText: 'Volume général' }).locator('input').fill('100');
    await page.waitForFunction(() => window.__ctxs[0].state === 'closed', null, { timeout: 15000 });
    assert.equal(await amb.getByRole('button', { name: "Lancer l'ambiance" }).isVisible(), true);
    assert.equal(await page.evaluate(() => localStorage.getItem('renzvi:sommeil')), null);
    // Relancer : son normal, sans reste du fondu.
    await amb.getByRole('button', { name: "Lancer l'ambiance" }).click();
    await page.waitForFunction(() => { const c = window.__ctxs[1], a = new Float32Array(c?.__an?.fftSize || 1); c?.__an?.getFloatTimeDomainData(a); return a.some(v => Math.abs(v) > 0.001); }, null, { timeout: 8000 });
    assert.deepEqual(errors, []);
    await context.close();
  }
  // Page suspendue puis réveillée après l'heure de fin : le son s'arrête au réveil.
  {
    const { page, errors, context } = await openBoard(browser, base, { options: desk, rows: { ...board(['ambiance', 'ambiances']), ambiance: { vol: { pluie: 40 }, master: 80 } }, clock: true });
    const w = W(page, 'ambiances');
    await w.getByRole('button', { name: 'Lancer le son' }).click();
    await page.waitForFunction(() => window.__ctxs[0]?.state === 'running');
    await w.getByRole('button', { name: '5 min', exact: true }).click();
    await page.clock.fastForward('10:00');
    await page.waitForFunction(() => window.__ctxs[0].state === 'closed');
    assert.equal(await w.locator('.ambiances-sleep [role=status]').textContent(), 'Aucun arrêt programmé.');
    // Une minuterie enregistrée survit au rechargement.
    await w.getByRole('button', { name: '15 min', exact: true }).click();
    await page.reload();
    await page.waitForSelector('.ambiances-sleep');
    assert.match(await W(page, 'ambiances').locator('.ambiances-sleep [role=status]').textContent(), /Arrêt dans 1[45]:\d\d \(le son est en pause\)/);
    assert.equal(await page.evaluate(() => window.__ctxs.length), 0, 'aucun son relancé au rechargement');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('ok - mes ambiances, ressources manquantes, arrêt progressif, annulation, reprise');

  // 9. J'ai cinq minutes.
  {
    const { page, errors, context } = await openBoard(browser, base, { options: desk, rows: board(['cinq']), clock: true });
    const w = W(page, 'cinq');
    await page.evaluate(() => localStorage.setItem('renzvi:cinq-dernier', 'respiration'));
    const seen = new Set();
    for (let k = 0; k < 12; k++) {
      // Le premier clic peut tomber pendant l'arrivée du module : on réessaie tant que le plan n'est pas affiché.
      await until(async () => { await w.getByRole('button', { name: 'Propose-moi quelque chose' }).click({ timeout: 1000 }).catch(() => {}); return (await w.locator('.book-title').count()) > 0; }, 'suggestion affichée');
      const title = await w.locator('.book-title').textContent();
      seen.add(title.split(' :')[0]);
      assert.match(await w.textContent('.cinq'), /Durée : /, 'la durée est annoncée avant');
      await w.getByRole('button', { name: 'Autre chose' }).click();
    }
    assert.ok(!seen.has('Respirer'), `pas deux fois de suite la même activité : ${[...seen]}`);
    await w.getByRole('button', { name: 'Respirer' }).click();
    await w.getByRole('button', { name: 'Commencer' }).click();
    await page.clock.runFor(300);
    assert.equal(await w.locator('.breath-word').textContent(), 'Inspire');
    await w.getByRole('button', { name: 'Arrêter' }).click();
    assert.match(await w.textContent('.cinq'), /Arrêté/);
    await w.getByRole('button', { name: 'Respirer' }).click();
    await w.getByRole('button', { name: 'Commencer' }).click();
    await page.clock.runFor(181000);
    assert.match(await w.textContent('.cinq'), /C’est fini/);
    await w.getByRole('button', { name: 'Terminer' }).click();
    await w.getByRole('button', { name: 'Une pause guidée' }).click();
    await w.getByRole('button', { name: 'Commencer' }).click();
    assert.equal(await w.getByRole('timer').first().isVisible(), true);
    await w.getByRole('button', { name: 'Arrêter' }).click();
    await w.getByRole('button', { name: 'Dessiner librement' }).click();
    await w.getByRole('button', { name: 'Commencer' }).click();
    await w.locator('canvas.atelier-paper').waitFor();
    await stroke(page, w.locator('canvas.atelier-paper'));
    await page.clock.runFor(301000);
    assert.match(await w.textContent('.cinq'), /C’est fini/);
    assert.equal(await w.getByRole('button', { name: 'Continuer 5 minutes' }).isVisible(), true);
    assert.equal(await w.getByRole('button', { name: 'Exporter en PNG' }).isVisible(), true);
    await w.getByRole('button', { name: 'Continuer 5 minutes' }).click();
    assert.match(await w.textContent('.cinq'), /Encore 0[45]:/);
    await w.getByRole('button', { name: 'Arrêter' }).click();
    await w.getByRole('button', { name: 'Contempler' }).click();
    await w.getByRole('button', { name: 'Commencer' }).click();
    await w.locator('.fenetre-canvas').waitFor();
    assert.equal(await page.evaluate(() => window.__ctxs.length), 0, 'contempler ne lance aucun son');
    await shot(page, 'cinq');
    await w.getByRole('button', { name: 'Arrêter' }).click();
    assert.equal(await w.locator('.fenetre-canvas').count(), 0, 'la scène est détruite à l\'arrêt');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log("ok - j'ai cinq minutes");

  // 10. Labo Chill : 15 fonctions, bac à sable (tailles, données, chargement, erreurs) sans écrire sur le compte.
  {
    const { page, errors, context, db } = await openBoard(browser, base, { options: desk, rows: board(['heure']) });
    await page.click('#chill-labo');
    const d = page.locator('dialog.chill-labo');
    await d.waitFor();
    assert.equal(await d.locator('.labo-item').count(), 15);
    await d.locator('.labo-item').nth(6).getByRole('button', { name: 'Bac à sable' }).click();
    const box = d.locator('.labo-box');
    await box.locator('.jardin-grid').waitFor();
    const width = () => box.evaluate(b => Math.round(b.getBoundingClientRect().width));
    assert.equal(await width(), 356);
    await d.getByRole('group', { name: 'Taille' }).getByRole('button', { name: 'Petit' }).click();
    await box.locator('.jardin-mini').waitFor();
    assert.equal(await width(), 262);
    assert.equal(await box.locator('.jardin-full').isVisible(), false, 'petit : aperçu et ouverture');
    await d.getByRole('group', { name: 'Taille' }).getByRole('button', { name: 'Grand' }).click();
    assert.equal(await width(), 740);
    await d.getByRole('group', { name: 'Données' }).getByRole('button', { name: 'Vides' }).click();
    assert.match(await box.textContent(), /attend sa première graine/);
    await d.getByRole('group', { name: 'Simulation' }).getByRole('button', { name: 'Chargement lent' }).click();
    assert.match(await box.textContent(), /Chargement…/);
    await box.locator('.jardin-grid').waitFor({ timeout: 6000 });
    await d.getByRole('group', { name: 'Simulation' }).getByRole('button', { name: 'Erreur de chargement' }).click();
    assert.match(await box.textContent(), /n'a pas pu se charger/);
    await shot(page, 'labo-erreur');
    await box.getByRole('button', { name: 'Réessayer' }).click();
    await box.locator('.jardin-grid').waitFor();
    await d.getByRole('group', { name: 'Simulation' }).getByRole('button', { name: "Erreur d'enregistrement" }).click();
    await box.getByRole('button', { name: /Emplacement 2/ }).click();
    await box.getByRole('button', { name: 'Lavande' }).click();
    assert.match(await d.locator('.labo-sandbox > p[aria-live]').textContent(), /refusé/);
    await d.getByRole('group', { name: 'Simulation' }).getByRole('button', { name: 'Normal' }).click();
    await box.getByRole('button', { name: /Emplacement 2/ }).click();
    await box.getByRole('button', { name: 'Lavande' }).click();
    assert.match(await d.locator('.labo-sandbox > p[aria-live]').textContent(), /Enregistrement simulé : \d+ octets/);
    await d.getByRole('button', { name: 'Fermer et rouvrir le widget' }).click();
    assert.match(await box.getByRole('button', { name: /Emplacement 2/ }).getAttribute('aria-label'), /Lavande/, 'rouvert avec ses données');
    await shot(page, 'labo', { fullPage: false });
    assert.equal(db.rows.jardin, undefined, 'bac à sable : rien sur le compte');
    // Dessin en panne de stockage dans le bac à sable.
    await d.locator('.labo-item').nth(7).getByRole('button', { name: 'Bac à sable' }).click();
    await d.getByRole('group', { name: 'Données' }).getByRole('button', { name: 'Exemple' }).click();
    await d.getByRole('group', { name: 'Simulation' }).getByRole('button', { name: 'Erreur de stockage' }).click();
    await d.locator('.labo-box .atelier-veil').filter({ hasText: "n'a pas pu se charger" }).waitFor();
    // Ajouter vraiment à la page.
    await d.locator('.labo-item').nth(14).getByRole('button', { name: 'Ajouter à la page' }).click();
    await saved(page);
    assert.ok(db.rows.ecran.widgets.includes('cinq'));
    await d.getByRole('button', { name: 'Fermer' }).first().click();
    assert.equal(await W(page, 'cinq').isVisible(), true);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('ok - labo Chill');

  // 11. Tailles Petit / Moyen / Grand, téléphone et ordinateur : rien ne déborde.
  for (const [width, height] of [[390, 844], [1440, 900]]) for (const size of ['s', 'm', 'l']) {
    const sizes = Object.fromEntries(NEW.map(id => [id, size]));
    const { page, errors, context } = await openBoard(browser, base, { options: { viewport: { width, height } }, rows: board(NEW, { wallpaper: 'lac', sizes }) });
    await page.waitForFunction(n => document.querySelectorAll('#board .widget .body > :not(.empty)').length >= n, NEW.length);
    await page.waitForTimeout(300);
    const problems = await page.evaluate(() => {
      const out = [];
      if (document.documentElement.scrollWidth > innerWidth) out.push(`page : ${document.documentElement.scrollWidth}`);
      for (const box of document.querySelectorAll('#board .widget')) {
        const o = box.getBoundingClientRect();
        for (const n of box.querySelectorAll('button,input,select,canvas,svg,p,h2,label')) {
          const r = n.getBoundingClientRect();
          if (!r.width || n.closest('svg') !== null && n.tagName !== 'svg') continue;
          if (r.right > o.right + .5 || r.left < o.left - .5) out.push(`${box.dataset.widget} ${n.tagName}.${n.getAttribute('class')} dépasse`);
        }
        for (const b of box.querySelectorAll('button')) if (b.offsetWidth && b.scrollWidth > b.clientWidth + 1) out.push(`${box.dataset.widget} bouton coupé : ${b.textContent}`);
      }
      return out;
    });
    assert.deepEqual(problems, [], `${width} px, taille ${size}`);
    if (size === 'm') await shot(page, `tailles-${width}`, { fullPage: true });
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('ok - tailles petit, moyen, grand à 390 et 1440 px');

  await browser.close();
  server.close();
  console.log('\nchill.check : tout est OK');
})().catch(e => { console.error(e); process.exit(1); });
