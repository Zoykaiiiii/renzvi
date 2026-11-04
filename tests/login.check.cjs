// Vérifie site/login.html dans un vrai navigateur, Supabase simulé : aucun email réel n'est envoyé.
// Lancement : NODE_PATH=<dossier node_modules contenant playwright> node tests/login.check.cjs [dossier-captures]
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', 'site');
const SHOTS = process.argv[2];
const API = 'https://xjkmztfsyyccveaeyzov.supabase.co/auth/v1';
const TIKTOK_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 musical_ly_32.0 BytedanceWebview';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const JWT = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u1', exp: 4102444800, role: 'authenticated' })}.sig`;
const USER = { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'lea@exemple.fr', app_metadata: {}, user_metadata: {}, created_at: '2026-11-03T00:00:00Z' };

const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'image/jpeg' });
  fs.createReadStream(file).pipe(res);
});

const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

const ALL_WIDGETS = { wallpaper: 'blanc', widgets: ['taches', 'heure', 'minuteur', 'notes', 'habitudes'], done: true };
const SUPABASE = 'https://xjkmztfsyyccveaeyzov.supabase.co';
const preflight = route => route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });

// Faux Supabase : garde ce que le dashboard enregistre, et peut simuler des pannes.
async function mockDb(context, rows = { ecran: ALL_WIDGETS }) {
  const db = { rows, failLoad: false, failSave: false, saves: 0, photo: null, removed: 0, failUpload: false, failRpc: false, failClaim: false, claims: [] };
  await context.route(`${SUPABASE}/rest/v1/widget_state*`, route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    if (req.method() === 'GET') return db.failLoad ? json(route, 500, { message: 'panne' }) : json(route, 200, Object.entries(db.rows).map(([widget, data]) => ({ widget, data })));
    db.saves++;
    if (db.failSave) return json(route, 500, { message: 'panne' });
    for (const row of req.postDataJSON()) db.rows[row.widget] = row.data;
    return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' } });
  });
  await context.route(`${SUPABASE}/rest/v1/rpc/*`, route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    if (req.url().endsWith('get_my_referral')) return db.failRpc ? json(route, 500, { message: 'panne' }) : json(route, 200, [{ referral_code: 'ABCD1234', referral_count: 1 }]);
    if (db.failClaim) return json(route, 500, { message: 'panne' });
    db.claims.push(req.postDataJSON().p_code);
    return json(route, 200, true);
  });
  await context.route(`${SUPABASE}/storage/v1/object/**`, route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    if (req.method() === 'DELETE') { db.removed++; db.photo = null; return json(route, 200, []); }
    if (req.method() === 'GET') return db.photo ? route.fulfill({ status: 200, contentType: 'image/jpeg', headers: { 'access-control-allow-origin': '*' }, body: db.photo }) : json(route, 404, { message: 'absent' });
    if (db.failUpload) return json(route, 500, { message: 'panne' });
    db.photoPath = new URL(req.url()).pathname;
    db.photo = req.postDataBuffer();
    return json(route, 200, { Key: db.photoPath });
  });
  return db;
}

async function open(browser, base, options = {}, query = '') {
  const context = await browser.newContext(options);
  const db = await mockDb(context);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/login.html${query}`);
  return { page, context, errors, db };
}

// Ouvre le dashboard déjà connecté, avec des données de départ.
async function openDashboard(browser, base, options, rows, prepare) {
  const context = await browser.newContext(options);
  await context.addInitScript(session => localStorage.setItem('sb-xjkmztfsyyccveaeyzov-auth-token', session), JSON.stringify({ access_token: JWT, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: { ...USER, user_metadata: { full_name: 'Léa Martin' } } }));
  const seed = { ecran: ALL_WIDGETS, ...rows };
  if (seed.ecran === null) delete seed.ecran; // premier lancement
  const db = await mockDb(context, seed);
  if (prepare) prepare(db);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  return { context, db, page, errors };
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
  const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };

  // Parcours complet : email invalide, trop de demandes, panne réseau, envoi, mauvais code, bon code, déconnexion.
  {
    const { page, errors } = await open(browser, base, { viewport: { width: 1440, height: 900 } });
    await page.waitForFunction(() => window.supabase);
    await shot(page, 'desktop-email');

    await page.fill('#email', 'pas-une-adresse');
    await page.click('#send');
    assert.match(await page.textContent('#email-msg'), /adresse email valide/);
    assert.equal(await page.getAttribute('#email', 'aria-invalid'), 'true');

    await page.route(`${API}/otp*`, r => json(r, 429, { code: 429, error_code: 'over_email_send_rate_limit', msg: 'limit' }));
    await page.fill('#email', ' lea@exemple.fr ');
    await page.click('#send');
    await page.waitForFunction(() => /Trop de demandes/.test(document.getElementById('email-msg').textContent));
    assert.equal(await page.isVisible('#step-code'), false);

    await page.unroute(`${API}/otp*`);
    await page.route(`${API}/otp*`, r => r.abort());
    await page.click('#send');
    await page.waitForFunction(() => /Impossible de joindre/.test(document.getElementById('email-msg').textContent), null, { timeout: 30000 });

    let sent;
    await page.unroute(`${API}/otp*`);
    await page.route(`${API}/otp*`, r => { sent = r.request().postDataJSON(); return json(r, 200, {}); });
    await page.click('#send');
    await page.waitForSelector('#step-code:not([hidden])');
    assert.equal(sent.email, 'lea@exemple.fr');
    assert.equal(await page.textContent('#sent-to'), 'lea@exemple.fr');
    assert.ok(await page.isDisabled('#resend'), 'renvoi bloqué pendant le délai');
    await shot(page, 'desktop-code');

    await page.fill('#code', 'abc');
    await page.click('#verify');
    assert.match(await page.textContent('#code-msg'), /code à chiffres/);

    await page.route(`${API}/verify*`, r => json(r, 403, { code: 403, error_code: 'otp_expired', msg: 'expired' }));
    await page.fill('#code', '123456');
    await page.click('#verify');
    await page.waitForFunction(() => /faux ou a expiré/.test(document.getElementById('code-msg').textContent));

    await page.unroute(`${API}/verify*`);
    await page.route(`${API}/verify*`, r => json(r, 200, { access_token: JWT, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user: USER }));
    await page.fill('#code', '12345678'); // Supabase peut être réglé sur 6 à 10 chiffres
    await page.click('#verify');
    await page.waitForURL('**/dashboard.html');
    await page.waitForSelector('#app:not([hidden])');
    await shot(page, 'desktop-dashboard');

    // Déjà connecté : le login renvoie directement au dashboard.
    await page.goto(`${base}/login.html`);
    await page.waitForURL('**/dashboard.html');

    // Les notes survivent à un rechargement.
    await page.fill('.notes', 'Appeler le comptable <b>');
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
    await page.reload();
    await page.waitForSelector('.notes');
    assert.equal(await page.inputValue('.notes'), 'Appeler le comptable <b>');

    // Déconnexion, même réseau coupé : Supabase efface la session de l'appareil, retour au login.
    await page.click('#me');
    await page.waitForSelector('#logout', { state: 'visible' });
    assert.equal(await page.textContent('#who'), 'lea@exemple.fr');
    await page.route(`${API}/logout*`, r => r.abort());
    await page.click('#logout');
    await page.waitForURL('**/login.html');
    assert.equal(await page.evaluate(() => localStorage.getItem('sb-xjkmztfsyyccveaeyzov-auth-token')), null);

    // Plus de session : le dashboard est inaccessible.
    await page.goto(`${base}/dashboard.html`);
    await page.waitForURL('**/login.html');
    assert.deepEqual(errors, []);
  }

  // Dashboard : prénom Google, aucun débordement du grand écran au petit téléphone, Échap ferme le menu.
  const LONG = 'x'.repeat(140);
  for (const width of [1440, 768, 390, 320]) {
    const { context, page, errors } = await openDashboard(browser, base, { viewport: { width, height: 800 } }, {
      taches: { items: [{ id: 'a', text: LONG, done: false }, { id: 'b', text: 'Relire le contrat', done: true }] },
      habitudes: { items: [{ id: 'h', name: 'y'.repeat(60), days: [] }] },
    });
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.notes');
    assert.equal(await page.textContent('#hello'), 'Bonjour Léa.');
    assert.equal(await page.textContent('#me'), 'L');
    assert.match(await page.textContent('.time'), /^\d\d:\d\d$/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `débordement à ${width}`);
    await page.click('#me');
    await page.waitForSelector('#logout', { state: 'visible' });
    const menu = await page.locator('#menu').boundingBox();
    assert.ok(menu.x >= 0 && menu.x + menu.width <= width && menu.y + menu.height <= 800, `menu coupé à ${width}`);
    await page.waitForSelector('#ref-row:not([hidden])');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#logout', { state: 'hidden' });
    assert.deepEqual(errors, []);
    await context.close();
  }

  const saved = page => page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');

  // Premier lancement : rien d'autre que le choix du fond, puis les widgets de base, et ça ne revient plus.
  {
    const { context, page, errors, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, { ecran: null });
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('#setup:not([hidden])');
    assert.equal(await page.locator('h1:visible').textContent(), "Choisis ton fond d'écran");
    assert.equal(await page.locator('.widget').count(), 0);
    assert.equal(await page.isVisible('#hello'), false);
    await shot(page, 'setup-fond');
    await page.locator('[data-wall=foret]').click();
    assert.equal(await page.locator('[data-wall=foret]').getAttribute('aria-pressed'), 'true');
    assert.ok(await page.evaluate(() => document.body.classList.contains('has-wall')));
    assert.match(await page.textContent('#credit'), /Ximonic/);
    await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--wall').includes('foggy-fanal'));
    await page.getByRole('button', { name: 'Continuer' }).click();
    await shot(page, 'setup-widgets');
    await page.getByRole('button', { name: 'Mettre ces widgets' }).click();
    assert.equal(await page.locator('.widget').count(), 3);
    assert.equal(await page.isVisible('#setup'), false);
    await saved(page);
    assert.deepEqual(db.rows.ecran, { wallpaper: 'foret', widgets: ['vol', 'taches', 'notes'], done: true });
    await shot(page, 'ecran-photo');
    await page.reload();
    await page.waitForSelector('.widget');
    assert.equal(await page.isVisible('#setup'), false);
    assert.ok(await page.evaluate(() => document.body.classList.contains('has-wall')));
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Premier lancement interrompu : on le reprend, avec le fond déjà choisi. Sans widget : l'écran le dit.
  {
    const { context, page, db } = await openDashboard(browser, base, { viewport: { width: 390, height: 844 } }, { ecran: { wallpaper: 'dune', widgets: [], done: false } });
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('#setup:not([hidden])');
    assert.equal(await page.locator('[data-wall=dune]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByRole('button', { name: 'Commencer sans widget' }).click();
    assert.equal(await page.locator('.widget').count(), 0);
    assert.ok(await page.isVisible('#board-empty'));
    await saved(page);
    assert.equal(db.rows.ecran.done, true);
    await context.close();
  }

  // Ajouter et retirer : le contenu d'un widget retiré revient intact et à jour, un minuteur en cours s'arrête.
  {
    const { context, page, errors, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, {
      ecran: { wallpaper: 'blanc', widgets: ['taches', 'minuteur'], done: true },
      taches: { items: [{ id: 'a', text: 'Ancienne', done: false }] },
      habitudes: { items: [{ id: 'h', name: 'Lire', days: [] }] },
    });
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.widget');
    await page.getByRole('textbox', { name: 'Nouvelle tâche' }).fill('Toute récente');
    await page.getByRole('textbox', { name: 'Nouvelle tâche' }).press('Enter');
    await page.getByRole('button', { name: 'Démarrer' }).click();
    assert.match(await page.title(), /— Renzvi$/);
    await page.click('#open-add');
    await shot(page, 'ajouter-widget');
    await page.getByRole('button', { name: 'Retirer : Tâches' }).click();
    await page.getByRole('button', { name: 'Retirer : Minuteur focus' }).click();
    assert.equal(await page.locator('.widget').count(), 0);
    assert.equal(await page.title(), 'Mon écran — Renzvi', 'le minuteur retiré ne continue pas');
    assert.equal(await page.isVisible('#board-empty'), true);
    await page.getByRole('button', { name: 'Ajouter : Habitudes' }).click();
    assert.equal(await page.locator('.habit').count(), 1, 'les habitudes enregistrées reviennent');
    await page.getByRole('button', { name: 'Ajouter : Tâches' }).click();
    assert.equal(await page.locator('.row').count(), 2, 'y compris la tâche ajoutée juste avant');
    assert.equal(await page.locator('.row span').first().textContent(), 'Toute récente');
    assert.equal(await page.isVisible('#board-empty'), false);
    await page.keyboard.press('Escape');
    assert.equal(await page.isVisible('#add-dialog'), false);
    await saved(page);
    assert.deepEqual(db.rows.ecran.widgets, ['habitudes', 'taches']);
    assert.equal(db.rows.taches.items.length, 2);
    await page.reload();
    await page.waitForSelector('.widget');
    assert.equal(await page.locator('.widget').count(), 2);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Photo personnelle : refus clairs, panne sans effet, envoi réduit dans son dossier, rechargée au retour, supprimée si on change.
  {
    const { context, page, errors, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, {});
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.widget');
    await page.click('#open-wall');
    const input = page.locator('#wall-slot input[type=file]');
    const note = page.locator('#wall-slot .pick-note');
    await input.setInputFiles({ name: 'faux.png', mimeType: 'image/png', buffer: Buffer.from('pas une image') });
    await page.waitForFunction(() => /n'a pas pu être lue/.test(document.querySelector('#wall-slot .pick-note').textContent));
    await input.setInputFiles({ name: 'enorme.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(31 * 1048576) });
    await page.waitForFunction(() => /trop lourde/.test(document.querySelector('#wall-slot .pick-note').textContent));
    const photo = fs.readFileSync(path.join(ROOT, 'assets/lake-mapourika-nz.jpg'));
    db.failUpload = true;
    await input.setInputFiles({ name: 'moi.jpg', mimeType: 'image/jpeg', buffer: photo });
    await page.waitForFunction(() => /n'a pas abouti/.test(document.querySelector('#wall-slot .pick-note').textContent));
    assert.equal(await page.evaluate(() => document.body.classList.contains('has-wall')), false, 'échec : le fond ne change pas');
    db.failUpload = false;
    await input.setInputFiles({ name: 'moi.jpg', mimeType: 'image/jpeg', buffer: photo });
    await page.waitForFunction(() => document.body.classList.contains('has-wall'));
    assert.equal(await note.textContent(), '');
    assert.equal(db.photoPath, '/storage/v1/object/fonds/u1/fond.jpg');
    assert.equal(await page.isVisible('#credit'), false, 'pas de crédit sur sa propre photo');
    await page.getByRole('button', { name: 'Fermer' }).first().click();
    await saved(page);
    assert.equal(db.rows.ecran.wallpaper, 'perso');
    await page.reload();
    await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--wall').startsWith('url(blob:'));
    await page.click('#open-wall');
    await page.locator('#wall-slot [data-wall=blanc]').click();
    await page.waitForFunction(() => !document.body.classList.contains('has-wall'));
    await page.getByRole('button', { name: 'Fermer' }).first().click();
    await saved(page);
    assert.equal(db.removed, 1, 'la photo qui ne sert plus est supprimée');
    assert.equal(db.rows.ecran.wallpaper, 'blanc');
    // Photo introuvable au retour : c'est dit, l'écran reste utilisable.
    db.rows.ecran.wallpaper = 'perso';
    await page.reload();
    await page.waitForFunction(() => /n'a pas pu se charger/.test(document.getElementById('saved').textContent));
    assert.equal(await page.locator('.widget').count(), 5);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Menu du compte : abonnement réel, lien de parrainage copiable, panne signalée puis réessayée.
  {
    const { context, page, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, {}, d => { d.failRpc = true; });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.widget');
    await page.click('#me');
    await page.waitForFunction(() => /indisponible/.test(document.getElementById('ref-info').textContent));
    assert.equal(await page.isVisible('#ref-row'), false);
    assert.ok(await page.getByText('Gratuit', { exact: true }).isVisible());
    await page.keyboard.press('Escape');
    await page.waitForSelector('#logout', { state: 'hidden' });
    db.failRpc = false;
    await page.click('#me');
    await page.waitForSelector('#ref-row:not([hidden])');
    assert.equal(await page.inputValue('#ref-link'), `${base}/login.html?ref=ABCD1234`);
    assert.equal(await page.textContent('#ref-info'), 'Ton code : ABCD1234 · 1 filleul');
    await page.click('#ref-copy');
    await page.waitForFunction(() => document.getElementById('ref-copy').textContent === 'Copié');
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `${base}/login.html?ref=ABCD1234`);
    await shot(page, 'menu-compte');
    await context.close();
  }

  // Lien de parrainage : code gardé à travers la connexion, envoyé une fois, conservé en cas de panne, code invalide ignoré.
  {
    const { context, page, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, {}, d => { d.failClaim = true; });
    await page.goto(`${base}/login.html?ref=pasbon`);
    assert.equal(await page.evaluate(() => localStorage.getItem('renzvi:ref')), null);
    await page.goto(`${base}/login.html?ref=abcd1234`);
    await page.waitForURL('**/dashboard.html');
    await page.waitForSelector('.widget');
    assert.equal(await page.evaluate(() => localStorage.getItem('renzvi:ref')), 'ABCD1234', 'gardé tant que le serveur n\'a pas répondu');
    db.failClaim = false;
    await page.reload();
    await page.waitForFunction(() => localStorage.getItem('renzvi:ref') === null);
    assert.deepEqual(db.claims, ['ABCD1234']);
    await context.close();
  }

  const VOL_SCREEN = { wallpaper: 'blanc', widgets: ['vol'], done: true };
  const hide = (page, hidden) => page.evaluate(h => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    window.dispatchEvent(new Event('visibilitychange'));
  }, hidden);

  // Vol : vraie animation et vrai plein écran, puis compteur.
  {
    const { context, page, errors } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, { ecran: VOL_SCREEN });
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.boarding');
    assert.match(await page.locator('.broute').textContent(), /PAR → LYS/);
    assert.equal(await page.locator('.vol-time output').textContent(), '25 min');
    await shot(page, 'vol-0-widget');
    await page.getByRole('button', { name: 'Déchirer et décoller' }).click();
    await page.waitForSelector('.scene-ticket');
    assert.ok(await page.evaluate(() => document.fullscreenElement?.id === 'flight'), 'plein écran demandé');
    assert.equal(await page.locator('.piece').count(), 2, 'le ticket est bien en deux morceaux');
    if (SHOTS) {
      for (const [ms, name] of [[500, 'vol-1-arrivee'], [650, 'vol-2-tension'], [450, 'vol-3-dechirure'], [300, 'vol-4-envol']]) {
        await page.waitForTimeout(ms);
        await shot(page, name);
      }
    }
    await page.waitForSelector('#flight-run:not([hidden])', { timeout: 6000 });
    assert.equal(await page.locator('.scene-ticket').count(), 0);
    assert.match(await page.textContent('#flight-clock'), /^2[45]:\d\d$/);
    assert.match(await page.textContent('#flight-eta'), /^Arrivée à \d\d:\d\d$/);
    await shot(page, 'vol-5-compteur');
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Vol sans animation : durée choisie, destination liée, atterrissage compté, annulation en deux temps.
  {
    const { context, page, errors, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }, { ecran: VOL_SCREEN });
    await page.clock.install();
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.boarding');
    const range = page.locator('.vol-time input');
    await range.evaluate(r => { r.value = 90; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
    assert.equal(await page.locator('.vol-time output').textContent(), '1 h 30');
    assert.match(await page.locator('.broute').textContent(), /LIS/);
    await range.evaluate(r => { r.value = 5; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
    const go = page.getByRole('button', { name: 'Déchirer et décoller' });
    await go.click();
    await page.waitForSelector('#flight-run:not([hidden])');
    assert.equal(await page.textContent('#flight-clock'), '05:00');
    assert.match(await page.title(), /05:00 — Nantes/);
    assert.ok(await page.locator('#app').evaluate(a => a.inert), 'le dashboard est inaccessible pendant le vol');
    await page.clock.runFor(60000);
    assert.equal(await page.textContent('#flight-clock'), '04:00');
    await page.getByRole('button', { name: 'Annuler le vol' }).click();
    await page.clock.runFor(3100);
    assert.equal(await page.textContent('#flight-cancel'), 'Annuler le vol', 'un clic isolé n\'annule pas');
    assert.equal(await page.isVisible('#flight-end'), false);
    await page.clock.runFor(4 * 60000);
    await page.waitForSelector('#flight-end:not([hidden])');
    assert.equal(await page.textContent('#flight-end-title'), 'Atterri à Nantes');
    await shot(page, 'vol-6-atterri');
    await page.click('#flight-close');
    assert.equal(await page.isVisible('#flight'), false);
    assert.ok(await page.evaluate(() => !document.fullscreenElement));
    assert.equal(await page.locator('#app').evaluate(a => a.inert), false);
    assert.equal(await page.title(), 'Mon écran — Renzvi');
    assert.equal(await page.locator('section[aria-labelledby=title-vol] .meta').textContent(), "Aujourd'hui : 1 vol · 5 min");
    await page.clock.runFor(2000);
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
    assert.deepEqual([db.rows.vol.minutes, db.rows.vol.flights, db.rows.vol.length], [5, 1, 5]);

    // Annulation volontaire : deux clics, rien n'est compté.
    await go.click();
    await page.waitForSelector('#flight-run:not([hidden])');
    await page.getByRole('button', { name: 'Annuler le vol' }).click();
    await page.getByRole('button', { name: 'Vraiment annuler ?' }).click();
    assert.equal(await page.textContent('#flight-end-title'), 'Vol annulé');
    await page.click('#flight-close');
    assert.equal(await page.locator('section[aria-labelledby=title-vol] .meta').textContent(), "Aujourd'hui : 1 vol · 5 min");
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Quitter le vol : sortie du plein écran rattrapable, annulation au bout de 10 s, onglet caché pareil même s'il se réveille tard.
  {
    const { context, page, errors, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }, { ecran: VOL_SCREEN });
    await page.clock.install();
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.boarding');
    const go = page.getByRole('button', { name: 'Déchirer et décoller' });
    await go.click();
    await page.waitForSelector('#flight-run:not([hidden])');

    await page.evaluate(() => document.exitFullscreen());
    await page.waitForSelector('#flight-alert:not([hidden])');
    assert.equal(await page.textContent('#flight-alert-title'), 'Tu as quitté le plein écran');
    await shot(page, 'vol-7-alerte');
    await page.click('#flight-back');
    await page.waitForFunction(() => document.fullscreenElement?.id === 'flight');
    await page.waitForSelector('#flight-alert', { state: 'hidden' });
    assert.equal(await page.isVisible('#flight-run'), true, 'le vol continue');

    await page.evaluate(() => document.exitFullscreen());
    await page.waitForSelector('#flight-alert:not([hidden])');
    await page.clock.runFor(10500);
    await page.waitForSelector('#flight-end:not([hidden])');
    assert.equal(await page.textContent('#flight-end-title'), 'Vol annulé');
    assert.equal(db.rows.vol?.flights ?? 0, 0);
    await page.click('#flight-close');

    await go.click();
    await page.waitForSelector('#flight-run:not([hidden])');
    await hide(page, true);
    await page.clock.setSystemTime(Date.now() + 60000); // l'onglet dort : aucune minuterie ne tourne
    await hide(page, false);
    await page.waitForSelector('#flight-end:not([hidden])');
    assert.equal(await page.textContent('#flight-end-title'), 'Vol annulé');
    assert.deepEqual(errors, []);
    await context.close();
  }

  // iPhone : pas de plein écran possible pour une page web. Le vol couvre l'écran et quitter l'appli l'annule toujours.
  {
    const { context, page, errors } = await openDashboard(browser, base, { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }, { ecran: VOL_SCREEN });
    await context.addInitScript(() => { delete Element.prototype.requestFullscreen; });
    await page.clock.install();
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.boarding');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await page.getByRole('button', { name: 'Déchirer et décoller' }).click();
    await page.waitForSelector('#flight-run:not([hidden])');
    const cover = await page.locator('#flight').boundingBox();
    assert.deepEqual([cover.x, cover.y, cover.width, cover.height], [0, 0, 390, 844]);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await shot(page, 'vol-8-mobile');
    await hide(page, true);
    await page.waitForSelector('#flight-alert:not([hidden])');
    assert.equal(await page.isVisible('#flight-back'), false);
    await hide(page, false);
    await page.waitForSelector('#flight-alert', { state: 'hidden' });
    assert.equal(await page.isVisible('#flight-run'), true);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Tâches : ajouter, cocher, effacer. Un texte malveillant reste du simple texte, et tout survit au rechargement.
  {
    const { context, page, errors, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, {});
    await page.goto(`${base}/dashboard.html`);
    const task = page.getByRole('textbox', { name: 'Nouvelle tâche' });
    await task.fill('   ');
    await task.press('Enter');
    assert.equal(await page.locator('.row').count(), 0, 'pas de tâche vide');
    await task.fill('<img src=x onerror="window.pirate=1">');
    await task.press('Enter');
    await task.fill('Relire le contrat');
    await task.press('Enter');
    assert.equal(await task.inputValue(), '');
    assert.equal(await page.locator('.row').count(), 2);
    assert.equal(await page.evaluate(() => window.pirate), undefined);
    assert.equal(await page.locator('.row span').last().textContent(), '<img src=x onerror="window.pirate=1">');
    const meta = page.locator('section[aria-labelledby=title-taches] .meta');
    assert.equal(await meta.textContent(), '2 à faire');
    await page.locator('.row input').first().check();
    assert.equal(await meta.textContent(), '1 à faire');
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
    assert.equal(db.rows.taches.items[0].done, true);
    await page.reload();
    await page.waitForSelector('.row');
    assert.equal(await page.locator('.row.done').count(), 1);
    await page.getByRole('button', { name: 'Effacer les terminées' }).click();
    await page.getByRole('button', { name: /Supprimer : <img/ }).click();
    assert.equal(await page.locator('.row').count(), 0);
    assert.ok(await page.getByText('Rien à faire pour').isVisible());
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
    assert.deepEqual(db.rows.taches.items, []);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Habitudes : cocher aujourd'hui, compteur juste, conservé après rechargement.
  {
    const { context, page, errors, db } = await openDashboard(browser, base, { viewport: { width: 390, height: 844 } }, {});
    await page.goto(`${base}/dashboard.html`);
    const habit = page.getByRole('textbox', { name: 'Nouvelle habitude' });
    await habit.fill('Lire 20 min');
    await habit.press('Enter');
    await habit.fill('Marcher');
    await habit.press('Enter');
    const meta = page.locator('section[aria-labelledby=title-habitudes] .meta');
    assert.equal(await meta.textContent(), "0 sur 2 aujourd'hui");
    assert.equal(await page.locator('.habit').first().locator('.days button').count(), 7);
    const today = page.locator('.habit').first().locator('.today');
    assert.ok((await today.boundingBox()).height >= 44, 'assez grand pour le doigt');
    await today.click();
    assert.equal(await today.getAttribute('aria-pressed'), 'true');
    assert.equal(await meta.textContent(), "1 sur 2 aujourd'hui");
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
    await page.reload();
    await page.waitForSelector('.habit');
    assert.equal(await page.locator('.habit').first().locator('.today').getAttribute('aria-pressed'), 'true');
    await page.locator('.habit').first().locator('.today').click();
    assert.equal(await meta.textContent(), "0 sur 2 aujourd'hui");
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
    assert.deepEqual(db.rows.habitudes.items[0].days, []);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Minuteur : pause et reprise exactes, durée bloquée en cours de session, minutes comptées seulement à la fin.
  {
    const { context, page, errors, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, {});
    await page.clock.install();
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.notes');
    const meta = page.locator('section[aria-labelledby=title-minuteur] .meta');
    const time = page.locator('.focus-time');
    assert.equal(await time.textContent(), '25:00');
    assert.equal(await meta.textContent(), "Aujourd'hui : 0 min");
    await page.getByRole('button', { name: '15 min' }).click();
    assert.equal(await time.textContent(), '15:00');
    await page.getByRole('button', { name: 'Démarrer' }).click();
    assert.ok(await page.getByRole('button', { name: '25 min' }).isDisabled());
    await page.clock.runFor(60000);
    assert.equal(await time.textContent(), '14:00');
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.clock.runFor(600000);
    assert.equal(await time.textContent(), '14:00', 'la pause arrête le temps');
    await page.getByRole('button', { name: 'Reprendre' }).click();
    await page.clock.runFor(60000);
    assert.equal(await time.textContent(), '13:00');
    await page.getByRole('button', { name: 'Remettre' }).click();
    assert.equal(await time.textContent(), '15:00');
    assert.equal(await meta.textContent(), "Aujourd'hui : 0 min", 'une session abandonnée ne compte pas');
    await page.getByRole('button', { name: 'Démarrer' }).click();
    await page.clock.runFor(15 * 60000 + 1000);
    assert.equal(await meta.textContent(), "Aujourd'hui : 15 min");
    assert.equal(await time.textContent(), '15:00');
    assert.equal(await page.title(), 'Session terminée — Renzvi');
    await page.clock.runFor(2000);
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
    assert.equal(db.rows.minuteur.minutes, 15);
    assert.equal(db.rows.minuteur.length, 15);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Panne au chargement : aucun widget, donc rien ne peut écraser les données ; Réessayer les ramène.
  {
    const { context, page, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, { notes: { text: 'précieux' } }, d => { d.failLoad = true; });
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('#load-error:not([hidden])');
    assert.equal(await page.locator('.widget').count(), 0);
    assert.equal(db.saves, 0);
    db.failLoad = false;
    await page.click('#retry');
    await page.waitForSelector('.notes');
    assert.equal(await page.inputValue('.notes'), 'précieux');
    await context.close();
  }

  // Panne à l'enregistrement : c'est signalé, la déconnexion prévient, le nouvel essai sauve la donnée.
  {
    const { context, page, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, {});
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.notes');
    db.failSave = true;
    await page.fill('.notes', 'à ne pas perdre');
    await page.waitForFunction(() => document.getElementById('saved').classList.contains('bad'));
    await page.click('#me');
    await page.click('#logout');
    await page.waitForFunction(() => /pas enregistrés/.test(document.getElementById('logout-msg').textContent));
    assert.ok(page.url().endsWith('dashboard.html'), 'la déconnexion attend que tout soit enregistré');
    db.failSave = false;
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré', null, { timeout: 8000 });
    assert.equal(db.rows.notes.text, 'à ne pas perdre');
    await context.close();
  }

  // Données abîmées en base : l'écran s'ouvre quand même, et un clic sur Ajouter fonctionne.
  {
    const { context, page, errors } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, { taches: { items: 'cassé' }, habitudes: { items: 3 }, minuteur: { length: 999, minutes: 'x' }, notes: { text: 12 } });
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.notes');
    assert.equal(await page.locator('.widget').count(), 5);
    assert.equal(await page.locator('.focus-time').textContent(), '25:00');
    assert.equal(await page.inputValue('.notes'), '');
    const task = page.getByRole('textbox', { name: 'Nouvelle tâche' });
    await task.fill('Une tâche');
    await task.press('Enter');
    assert.equal(await page.locator('.row').count(), 1);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Notes écrites avant le passage à Supabase : elles sont reprises, pas perdues.
  {
    const { context, page, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, {});
    await context.addInitScript(() => { if (!sessionStorage.getItem('seed')) { sessionStorage.setItem('seed', '1'); localStorage.setItem('renzvi:notes:u1', 'ancienne note'); } });
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.notes');
    assert.equal(await page.inputValue('.notes'), 'ancienne note');
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
    assert.equal(db.rows.notes.text, 'ancienne note');
    await page.reload();
    await page.waitForSelector('.notes');
    assert.equal(await page.evaluate(() => localStorage.getItem('renzvi:notes:u1')), null);
    await context.close();
  }

  // Dashboard : bibliothèque Supabase indisponible, on le dit au lieu d'afficher un écran vide.
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.route('https://cdn.jsdelivr.net/**', r => r.abort());
    await page.goto(`${base}/dashboard.html`);
    assert.match(await page.textContent('#blocked'), /Recharge la page/);
    assert.equal(await page.isVisible('#app'), false);
    await context.close();
  }

  // Google : on part vers Supabase avec le bon retour et une protection PKCE.
  {
    const { page, errors } = await open(browser, base, { viewport: { width: 390, height: 844 } });
    await shot(page, 'mobile-email');
    let target;
    await page.route(`${API}/authorize*`, r => { target = new URL(r.request().url()); return r.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }); });
    await page.click('#google');
    await page.waitForURL(`${API}/authorize*`);
    assert.equal(target.searchParams.get('provider'), 'google');
    assert.equal(target.searchParams.get('redirect_to'), `${base}/login.html`);
    assert.ok(target.searchParams.get('code_challenge'), 'PKCE présent');
    assert.deepEqual(errors, []);
  }

  // Navigateur TikTok : Google masqué, message visible, code email toujours disponible.
  {
    const { page } = await open(browser, base, { viewport: { width: 390, height: 844 }, userAgent: TIKTOK_UA });
    assert.equal(await page.isVisible('#google'), false);
    assert.equal(await page.isVisible('#inapp'), true);
    assert.doesNotMatch(await page.textContent('#intro'), /Google/);
    assert.equal(await page.isVisible('#email'), true);
    await shot(page, 'mobile-tiktok');
  }

  // Retour de Google en erreur : message lisible.
  {
    const { page } = await open(browser, base, {}, '?error=access_denied');
    assert.match(await page.textContent('#email-msg'), /Google n'a pas abouti/);
  }

  // Bibliothèque Supabase indisponible : on le dit, les boutons sont bloqués.
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.route('https://cdn.jsdelivr.net/**', r => r.abort());
    await page.goto(`${base}/login.html`);
    assert.match(await page.textContent('#email-msg'), /Recharge la page/);
    assert.ok(await page.isDisabled('#send'));
  }

  await browser.close();
  server.close();
  console.log('login : tous les parcours passent');
})().catch(e => { console.error(e); process.exit(1); });
