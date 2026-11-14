// Vérifie site/login.html dans un vrai navigateur, Supabase simulé : aucun email réel n'est envoyé.
// Lancement : NODE_PATH=<dossier node_modules contenant playwright> node tests/login.check.cjs [dossier-captures]
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
// Catalogue : on choisit le widget dans la liste, puis on confirme dans l'aperçu.
const catClick = async (page, name) => {
  const title = name.split(' : ')[1];
  await page.locator('#catalog .cat-item').filter({ has: page.locator('b', { hasText: new RegExp('^' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) }).click();
  await page.getByRole('button', { name, exact: true }).click();
};

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
  res.writeHead(200, { 'content-type': { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' }[path.extname(file)] || 'image/jpeg' });
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
  // Le cahier demande la liste des cours : aucun ici.
  await context.route(`${SUPABASE}/rest/v1/study_courses*`, route => route.request().method() === 'OPTIONS' ? preflight(route) : json(route, 200, []));
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
    await page.getByRole('button', { name: 'Installer Study et Chill' }).click();
    assert.equal(await page.locator('.widget:visible').count(), 9, 'Study : le cahier, les révisions, les flashcards et les 6 widgets de travail');
    assert.deepEqual(await page.locator('#page-tabs button').allTextContents(), ['Study', 'Chill']);
    assert.equal(await page.locator('#page-tabs [aria-pressed=true]').textContent(), 'Study');
    assert.equal(await page.isVisible('#setup'), false);
    await saved(page);
    assert.deepEqual(db.rows.ecran.pages, [{ id: 'study', name: 'Study' }, { id: 'chill', name: 'Chill', wall: 'lac' }]);
    assert.equal(db.rows.ecran.wallpaper, 'foret');
    assert.equal(db.rows.ecran.widgets.length, 15);
    await shot(page, 'ecran-photo');
    await page.reload();
    await page.waitForSelector('.widget');
    assert.equal(await page.isVisible('#setup'), false);
    assert.ok(await page.evaluate(() => document.body.classList.contains('has-wall')));
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Modes sur un écran existant : rien n'est perdu, chaque mode garde son fond, et l'installation ne se propose plus.
  {
    const rows = { ecran: { wallpaper: 'brume', widgets: ['taches', 'heure', 'minuteur'], done: true }, taches: { items: [{ id: 'a', text: 'Déjà là', done: false }] } };
    const { context, page, errors, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, rows);
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.widget');
    const wall = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--wall'));
    await page.click('#open-add');
    await page.getByRole('button', { name: 'Installer : Study et Chill' }).click();
    assert.deepEqual(await page.locator('#page-tabs button').allTextContents(), ['Mon écran', 'Study', 'Chill']);
    assert.equal(await page.locator('.widget:visible').count(), 9);
    assert.ok(await page.locator('[data-widget=taches]', { hasText: 'Déjà là' }).isVisible());
    assert.match(await wall(), /bohinj/);
    await page.getByRole('button', { name: 'Mon écran' }).click();
    assert.deepEqual(await page.locator('.widget:visible').evaluateAll(b => b.map(x => x.dataset.widget)), ['heure']);
    await page.getByRole('button', { name: 'Chill' }).click();
    assert.equal(await page.locator('.widget:visible').count(), 6);
    assert.match(await wall(), /mapourika/);
    assert.match(await page.textContent('#credit'), /Richard Palmer/);
    // Changer le fond de Chill ne touche pas à Study.
    await page.click('#open-custom');
    await page.locator('#wall-slot [data-wall=dune]').click();
    assert.equal(await page.locator('#wall-slot [data-wall=dune]').getAttribute('aria-pressed'), 'true');
    await page.click('#custom-done');
    await page.getByRole('button', { name: 'Study' }).click();
    assert.match(await wall(), /bohinj/);
    await page.getByRole('button', { name: 'Chill' }).click();
    assert.match(await wall(), /sossusvlei/);
    await saved(page);
    assert.equal(db.rows.ecran.wallpaper, 'brume');
    await page.reload();
    await page.waitForSelector('.widget:visible');
    assert.equal(await page.locator('#page-tabs [aria-pressed=true]').textContent(), 'Chill');
    assert.match(await wall(), /sossusvlei/);
    await page.click('#open-add');
    assert.equal(await page.getByRole('button', { name: /^Installer/ }).count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
  }
  // Tout part dans les modes : pas d'onglet vide. Trop de pages : l'installation le dit et ne fait rien.
  {
    const { context, page } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, { ecran: { wallpaper: 'blanc', widgets: ['taches'], done: true } });
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.widget');
    await page.click('#open-add');
    await page.getByRole('button', { name: 'Installer : Study et Chill' }).click();
    assert.deepEqual(await page.locator('#page-tabs button').allTextContents(), ['Study', 'Chill']);
    await context.close();
    const pages = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, name: id }));
    const crowded = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, { ecran: { wallpaper: 'blanc', widgets: ['taches'], done: true, pages } });
    await crowded.page.goto(`${base}/dashboard.html`);
    await crowded.page.waitForSelector('.widget');
    await crowded.page.click('#open-add');
    assert.ok(await crowded.page.getByRole('button', { name: 'Installer : Study et Chill' }).isDisabled());
    assert.match(await crowded.page.locator('#catalog li').first().textContent(), /supprimes-en 1 page/);
    await crowded.context.close();
  }
  // Une photo personnelle reste tant qu'une page s'en sert, et part avec la dernière page qui l'utilise.
  {
    const pages = [{ id: 'a', name: 'Une', wall: 'perso' }, { id: 'b', name: 'Deux', wall: 'perso' }, { id: 'c', name: 'Trois', wall: 'lac' }];
    const { context, page, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, { ecran: { wallpaper: 'blanc', widgets: ['taches'], done: true, pages, where: { taches: 'c' } } }, d => { d.photo = Buffer.from('x'); });
    await page.goto(`${base}/dashboard.html`);
    await page.waitForFunction(() => document.querySelectorAll('#page-tabs button').length === 3);
    await page.click('#open-custom');
    await page.locator('#wall-slot [data-wall=dune]').click();
    await page.click('#custom-done');
    assert.equal(db.removed, 0, 'la page Deux utilise encore la photo');
    await page.getByRole('button', { name: 'Deux' }).click();
    await page.click('#open-custom');
    await page.click('#page-delete');
    await page.getByRole('button', { name: 'Supprimer la page' }).last().click();
    await page.waitForFunction(() => document.querySelectorAll('#page-tabs button').length === 2);
    await page.waitForTimeout(100);
    assert.equal(db.removed, 1, 'plus aucune page ne l\'utilise');
    await context.close();
  }
  // Temps de focus : vol et minuteur réunis sur la semaine de lundi à dimanche, avec les anciennes données, et à jour en direct.
  {
    const rows = {
      ecran: { wallpaper: 'blanc', widgets: ['semaine', 'minuteur'], done: true },
      vol: { length: 25, day: '2026-11-04', minutes: 25, flights: 1 },
      minuteur: { length: 15, day: '2026-11-03', minutes: 50, log: { '2026-11-02': 30, '2026-11-01': 99, '2026-11-03': 50, '2026-10-01': 40, nimporte: 3, '2026-11-05': 'x' } },
    };
    const { context, page, errors, db } = await openDashboard(browser, base, { viewport: { width: 390, height: 844 } }, rows);
    await page.clock.install({ time: new Date('2026-11-04T10:00:00') }); // un mercredi
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('[data-widget=semaine]');
    const box = page.locator('[data-widget=semaine]');
    const labels = () => box.locator('.week li').evaluateAll(l => l.map(x => x.ariaLabel));
    assert.equal(await box.locator('.week-total').textContent(), '1 h 45');
    assert.deepEqual(await labels(), ['lundi : 30 min', 'mardi : 50 min', 'mercredi : 25 min', 'jeudi : à venir', 'vendredi : à venir', 'samedi : à venir', 'dimanche : à venir']);
    assert.equal(await box.locator('.week li.today').getAttribute('aria-label'), 'mercredi : 25 min');
    assert.equal(await box.locator('.week li').nth(0).locator('i').evaluate(i => i.style.height), '36px');
    assert.equal(await box.locator('.desc').isVisible(), false);
    await page.getByRole('button', { name: 'Démarrer' }).click();
    await page.clock.runFor(15 * 60000 + 1000);
    assert.equal(await box.locator('.week-total').textContent(), '2 h');
    assert.equal(await box.locator('.week li').nth(2).getAttribute('aria-label'), 'mercredi : 40 min');
    await page.clock.runFor(2000);
    await saved(page);
    assert.deepEqual(db.rows.minuteur.log, { '2026-11-01': 99, '2026-11-02': 30, '2026-11-03': 50, '2026-11-04': 15 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    await context.close();
    // Compte neuf : les zéros s'impriment, et une phrase dit quoi faire.
    const fresh = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, { ecran: { wallpaper: 'blanc', widgets: ['semaine'], done: true } });
    await fresh.page.clock.install({ time: new Date('2026-11-04T10:00:00') });
    await fresh.page.goto(`${base}/dashboard.html`);
    await fresh.page.waitForSelector('[data-widget=semaine]');
    assert.equal(await fresh.page.locator('.week-total').textContent(), '0 min');
    assert.ok(await fresh.page.locator('[data-widget=semaine] .desc').isVisible());
    assert.equal(await fresh.page.locator('.week li').nth(0).getAttribute('aria-label'), 'lundi : 0 min');
    await fresh.context.close();
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
    await catClick(page, 'Retirer : Tâches');
    await catClick(page, 'Retirer : Minuteur focus');
    assert.equal(await page.locator('.widget').count(), 0);
    assert.equal(await page.title(), 'Mon écran — Renzvi', 'le minuteur retiré ne continue pas');
    assert.equal(await page.isVisible('#board-empty'), true);
    await catClick(page, 'Ajouter : Habitudes');
    assert.equal(await page.locator('.habit').count(), 1, 'les habitudes enregistrées reviennent');
    await catClick(page, 'Ajouter : Tâches');
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
    await page.click('#open-custom');
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
    await page.click('#custom-done');
    await saved(page);
    assert.equal(db.rows.ecran.wallpaper, 'perso');
    await page.reload();
    await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--wall').startsWith('url(blob:'));
    await page.click('#open-custom');
    await page.locator('#wall-slot [data-wall=blanc]').click();
    await page.waitForFunction(() => !document.body.classList.contains('has-wall'));
    await page.click('#custom-done');
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
    // Le hublot : le paysage est bien dessiné (pas une image uniforme) et l'heure, en gras, est en plein milieu de l'écran.
    assert.equal(await page.locator('#flight-view canvas').count(), 1);
    const clock = await page.locator('#flight-clock').boundingBox();
    assert.ok(Math.abs(clock.x + clock.width / 2 - 720) <= 1 && Math.abs(clock.y + clock.height / 2 - 450) <= 1, 'l\'heure est au centre de l\'écran');
    assert.ok(Number(await page.locator('#flight-clock').evaluate(c => getComputedStyle(c).fontWeight)) >= 700, 'l\'heure est en gras');
    await page.waitForFunction(() => {
      const canvas = document.querySelector('#flight-view canvas');
      const copy = document.createElement('canvas');
      copy.width = copy.height = 16;
      const paint = copy.getContext('2d');
      paint.drawImage(canvas, 0, 0, 16, 16);
      const { data } = paint.getImageData(0, 0, 16, 16);
      return data.some((v, i) => i % 4 !== 3 && Math.abs(v - data[i % 4]) > 30);
    });
    await shot(page, 'vol-5-compteur');
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Vol de 3 h sur téléphone : l'heure la plus longue tient dans le hublot, et rien ne chevauche le hublot en bas.
  {
    const { context, page, errors } = await openDashboard(browser, base, { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }, { ecran: VOL_SCREEN });
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.boarding');
    await page.locator('.vol-time .dial').press('End');
    await page.getByRole('button', { name: 'Déchirer et décoller' }).click();
    await page.waitForSelector('#flight-run:not([hidden])');
    assert.match(await page.textContent('#flight-clock'), /^[23]:\d\d:\d\d$/);
    const view = await page.locator('#flight-view').boundingBox();
    const clock = await page.locator('#flight-clock').boundingBox();
    const route = await page.locator('#flight-route').boundingBox();
    assert.ok(clock.x >= view.x && clock.x + clock.width <= view.x + view.width, 'l\'heure tient dans le hublot');
    assert.ok(route.y >= view.y + view.height, 'le trajet est sous le hublot');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await shot(page, 'vol-9-long');
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Hublot : sans dessin possible, le vol marche quand même ; le paysage est libéré à la fermeture ; téléphone couché sans débordement.
  {
    const { context, page, errors } = await openDashboard(browser, base, { viewport: { width: 844, height: 390 }, reducedMotion: 'reduce' }, { ecran: VOL_SCREEN });
    await context.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
    await page.clock.install();
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.boarding');
    await page.locator('.vol-time .dial').press('Home');
    await page.getByRole('button', { name: 'Déchirer et décoller' }).click();
    await page.waitForSelector('#flight-run:not([hidden])');
    assert.equal(await page.locator('#flight-view canvas').count(), 0);
    assert.equal(await page.isVisible('.hublot-frame'), true, 'le hublot reste affiché devant le ciel de secours');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await page.clock.fastForward(5 * 60000);
    await page.waitForSelector('#flight-end:not([hidden])');
    assert.equal(await page.textContent('#flight-end-title'), 'Atterri à Nantes');
    await page.click('#flight-close');
    assert.equal(await page.isVisible('.hublot-frame'), false);
    assert.deepEqual(errors, []);
    await context.close();
  }
  {
    const { context, page, errors } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }, { ecran: VOL_SCREEN });
    await context.addInitScript(() => {
      window.locks = [];
      Object.defineProperty(navigator, 'wakeLock', { value: { request: async () => { const lock = { released: false, release: async () => {} }; window.locks.push(lock); return lock; } } });
    });
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.boarding');
    await page.getByRole('button', { name: 'Déchirer et décoller' }).click();
    await page.waitForSelector('#flight-run:not([hidden])');
    await page.waitForFunction(() => window.locks.length === 1);
    // L'écran reste allumé après un aller-retour : le navigateur a rendu le verrou, le vol le redemande.
    await page.evaluate(() => { window.locks[0].released = true; });
    await page.waitForFunction(() => window.locks.length === 2);
    await page.getByRole('button', { name: 'Annuler le vol' }).click();
    await page.getByRole('button', { name: 'Vraiment annuler ?' }).click();
    assert.equal(await page.locator('#flight-view canvas').count(), 1, 'le paysage reste derrière l\'écran de fin');
    await page.click('#flight-close');
    assert.equal(await page.locator('#flight-view canvas').count(), 0, 'le paysage est arrêté à la fermeture');
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Vol sans animation : durée choisie, destination liée, atterrissage compté, annulation en deux temps.
  {
    const { context, page, errors, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }, { ecran: VOL_SCREEN });
    await page.clock.install();
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.boarding');
    // Le compteur : Page haut ajoute 30 minutes, flèche haut 5.
    const dial = page.getByRole('spinbutton', { name: 'Durée du vol, en minutes' });
    await dial.press('PageUp');
    await dial.press('PageUp');
    await dial.press('ArrowUp');
    assert.equal(await dial.getAttribute('aria-valuenow'), '90');
    assert.equal(await page.locator('.vol-time output').textContent(), '1 h 30');
    assert.match(await page.locator('.broute').textContent(), /LIS/);
    await dial.press('Home');
    assert.equal(await page.getByRole('button', { name: 'Retirer 5 minutes' }).isDisabled(), true, 'pas sous 5 minutes');
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

  // Nouveaux widgets de détente : respiration, ambiance sonore, compte à rebours, raccourcis.
  const DETENTE = { wallpaper: 'blanc', widgets: ['respiration', 'ambiance', 'compte', 'raccourcis'], done: true };
  const section = (page, id) => page.locator(`section[aria-labelledby=title-${id}]`);
  const dayIso = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv'); };

  // Respiration guidée : le cercle suit inspire / expire, la fin est annoncée, rien n'est enregistré.
  {
    const { context, page, errors, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, { ecran: DETENTE });
    await page.clock.install();
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.breath');
    const w = section(page, 'respiration');
    assert.equal(await w.locator('.breath-word').textContent(), 'Prêt ?');
    await w.getByRole('button', { name: '1 min' }).click();
    await w.getByRole('button', { name: 'Commencer' }).click();
    await page.clock.runFor(300);
    assert.equal(await w.locator('.breath-word').textContent(), 'Inspire');
    assert.equal(await w.locator('.breath').evaluate(c => c.classList.contains('in')), true);
    assert.match(await w.locator('.meta').textContent(), /^(01:00|00:5\d)$/);
    assert.equal(await w.getByRole('button', { name: '3 min' }).isDisabled(), true, 'la durée est figée pendant la séance');
    await page.clock.runFor(4500);
    assert.equal(await w.locator('.breath-word').textContent(), 'Expire');
    assert.equal(await w.locator('.breath').evaluate(c => c.classList.contains('in')), false);
    await page.clock.runFor(6000);
    assert.equal(await w.locator('.breath-word').textContent(), 'Inspire', 'le cycle recommence');
    await w.getByRole('button', { name: 'Arrêter' }).click();
    assert.equal(await w.locator('.breath-word').textContent(), 'Prêt ?');
    assert.equal(await w.locator('.meta').textContent(), '');
    await w.getByRole('button', { name: 'Commencer' }).click();
    await page.clock.runFor(61000);
    assert.match(await w.getByRole('status').textContent(), /Séance terminée/);
    assert.equal(await w.getByRole('button', { name: 'Commencer' }).isVisible(), true);
    assert.equal(db.saves, 0, 'la respiration n\'enregistre rien');
    await shot(page, 'detente-respiration');
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Ambiance sonore : du vrai son sort (on écoute la sortie), pause, volumes enregistrés, arrêt au retrait du widget.
  {
    const { context, page, errors, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, { ecran: DETENTE });
    await context.addInitScript(() => {
      const Real = window.AudioContext, connect = AudioNode.prototype.connect;
      window.__ctxs = [];
      window.AudioContext = class extends Real { constructor(...a) { super(...a); window.__ctxs.push(this); } };
      AudioNode.prototype.connect = function (dest, ...rest) {
        if (dest instanceof AudioDestinationNode) { const c = dest.context; c.__an ??= Object.assign(c.createAnalyser(), { fftSize: 2048 }); connect.call(this, c.__an); }
        return connect.call(this, dest, ...rest);
      };
    });
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.sound');
    const w = section(page, 'ambiance');
    assert.equal(await page.evaluate(() => window.__ctxs.length), 0, 'aucun son avant le clic');
    assert.equal(await w.locator('.sound').filter({ hasText: 'Pluie' }).locator('input').inputValue(), '35', 'la pluie est proposée à volume doux');
    assert.equal(await w.locator('.sound').filter({ hasText: 'Volume général' }).locator('input').inputValue(), '100');
    assert.equal(await w.locator('.sound').count(), 6, 'le volume général et les cinq sons');
    await w.getByRole('button', { name: "Lancer l'ambiance" }).click();
    await w.getByRole('button', { name: 'Pause' }).waitFor();
    assert.equal(await page.evaluate(() => window.__ctxs[0].state), 'running');
    await page.waitForFunction(() => {
      const c = window.__ctxs[0], a = new Float32Array(c.__an?.fftSize || 1);
      c.__an?.getFloatTimeDomainData(a);
      return a.some(v => Math.abs(v) > 0.001);
    }, null, { timeout: 8000 });
    assert.equal(await w.locator('.meta').textContent(), 'En cours');
    // Le volume d'un son se règle sans couper les autres, et il est enregistré.
    await w.locator('.sound').filter({ hasText: 'Feu de bois' }).locator('input').fill('60');
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
    assert.deepEqual(db.rows.ambiance.vol, { pluie: 35, vent: 0, feu: 60, cabine: 0, blanc: 0 });
    // Le volume général baisse tout : le signal mesuré en sortie chute nettement, puis il est enregistré.
    const peak = () => page.evaluate(async () => {
      const c = window.__ctxs[0], a = new Float32Array(c.__an.fftSize); let max = 0;
      for (let i = 0; i < 12; i++) { c.__an.getFloatTimeDomainData(a); for (const v of a) max = Math.max(max, Math.abs(v)); await new Promise(r => setTimeout(r, 40)); }
      return max;
    });
    const loud = await peak();
    await w.locator('.sound').filter({ hasText: 'Volume général' }).locator('input').fill('20');
    await page.waitForTimeout(400);
    const quiet = await peak();
    assert.ok(loud > 0.005 && quiet < loud * 0.25, `le volume général baisse le son (${loud.toFixed(3)} -> ${quiet.toFixed(3)})`);
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
    assert.equal(db.rows.ambiance.master, 20);
    await w.getByRole('button', { name: 'Pause' }).click();
    await w.getByRole('button', { name: "Lancer l'ambiance" }).waitFor();
    assert.equal(await page.evaluate(() => window.__ctxs[0].state), 'suspended');
    // Tout à zéro : on le dit au lieu de lancer un silence.
    for (const input of await w.locator('.sound input').all()) await input.fill('0');
    await w.getByRole('button', { name: "Lancer l'ambiance" }).click();
    assert.match(await w.locator('.note').textContent(), /Monte le volume général/);
    assert.equal(await w.locator('.note').isVisible(), true);
    await shot(page, 'detente-ambiance');
    // Retirer le widget ferme le son.
    await page.click('#open-add');
    await catClick(page, 'Retirer : Ambiance sonore');
    await page.waitForFunction(() => window.__ctxs[0].state === 'closed');
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Compte à rebours : jours restants, ordre, validation, limite, texte inoffensif, rechargement.
  {
    const { context, page, errors, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, { ecran: DETENTE });
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.add.stack');
    const w = section(page, 'compte');
    const add = async (title, date) => { await w.getByRole('textbox', { name: "Nom de l'événement" }).fill(title); await w.getByLabel("Date de l'événement").fill(date || ''); await w.getByRole('button', { name: 'Ajouter' }).click(); };
    await add('', dayIso(3));
    assert.match(await w.locator('.note').textContent(), /Donne un nom/);
    await add('Sans date', '');
    assert.match(await w.locator('.note').textContent(), /Choisis une date/);
    assert.equal(await w.locator('.row').count(), 0);
    await add('Partiel de maths', dayIso(10));
    await add('Passé', dayIso(-3));
    await add("Aujourd'hui test", dayIso(0));
    await add('Demain test', dayIso(1));
    assert.deepEqual(await w.locator('.row .left').allTextContents(), ["Aujourd'hui", 'Demain', 'J-10', 'Passé (3 jours)'], 'les plus proches d\'abord, le passé à la fin');
    assert.equal(await w.locator('.row.past').count(), 1);
    assert.equal(await w.locator('.meta').textContent(), '3 à venir');
    await add('<img src=x onerror="window.pirate=1">', dayIso(30));
    assert.equal(await page.evaluate(() => window.pirate), undefined);
    assert.equal(await w.locator('.row .grow').filter({ hasText: '<img' }).textContent(), '<img src=x onerror="window.pirate=1">', 'le texte reste du texte');
    await add('Sixième', dayIso(40));
    assert.match(await w.locator('.note').textContent(), /5 événements/);
    assert.equal(await w.locator('.row').count(), 5);
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
    assert.equal(db.rows.compte.items.length, 5);
    await page.reload();
    await page.waitForSelector('.row');
    assert.equal(await w.locator('.row').count(), 5);
    await w.getByRole('button', { name: 'Supprimer : Passé' }).click();
    assert.equal(await w.locator('.row').count(), 4);
    await shot(page, 'detente-compte');
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Mes raccourcis : seules les adresses http(s) sont acceptées, les liens s'ouvrent à part, les données douteuses sont ignorées.
  {
    const stored = { items: [{ label: 'Piège', url: 'javascript:window.pirate=1' }, { label: 'Cours', url: 'https://cours.exemple.fr/maths' }] };
    const { context, page, errors, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, { ecran: DETENTE, raccourcis: stored });
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.add.stack');
    const w = section(page, 'raccourcis');
    assert.equal(await w.locator('.row').count(), 1, 'une adresse dangereuse déjà enregistrée n\'est pas affichée');
    const add = async (name, url) => { await w.getByRole('textbox', { name: 'Nom du raccourci' }).fill(name); await w.getByRole('textbox', { name: 'Adresse du site' }).fill(url); await w.getByRole('button', { name: 'Ajouter' }).click(); };
    for (const bad of ['javascript:alert(1)', 'ftp://exemple.fr', 'localhost', 'pas une adresse', 'data:text/html,<b>x</b>']) {
      await add('x', bad);
      assert.match(await w.locator('.note').textContent(), /adresse de site valide/, bad);
    }
    assert.equal(await w.locator('.row').count(), 1);
    await add('Docs', 'exemple.fr');
    const link = w.locator('a.grow', { hasText: 'Docs' });
    assert.equal(await link.getAttribute('href'), 'https://exemple.fr/');
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.match(await link.getAttribute('rel'), /noopener/);
    await add('', 'https://www.exemple.org/page');
    assert.equal(await w.locator('a.grow', { hasText: 'exemple.org' }).count(), 1, 'sans nom, le nom du site sert de titre');
    assert.equal(await w.locator('.meta').textContent(), '3 liens');
    assert.equal(await page.evaluate(() => window.pirate), undefined);
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
    assert.deepEqual(db.rows.raccourcis.items.map(l => l.url), ['https://cours.exemple.fr/maths', 'https://exemple.fr/', 'https://www.exemple.org/page']);
    for (let i = 0; i < 9; i++) await add('', `https://site${i}.exemple.fr`);
    await add('', 'https://trop.exemple.fr');
    assert.match(await w.locator('.note').textContent(), /12 raccourcis/);
    await shot(page, 'detente-raccourcis');
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Playlist : adresses limitées à Spotify et YouTube, titre et pochette demandés à l'ajout puis contrôlés, lecteur seulement au clic.
  {
    const SP = '37i9dQZF1DX4sWSpwq3LiO', YT = 'PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI';
    const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    const { context, page, errors, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, { ecran: { wallpaper: 'blanc', widgets: ['playlist'], done: true } });
    const seen = [], answer = { fail: false, reply: { title: 'Peaceful Piano', thumbnail_url: 'https://i.scdn.co/image/abc' } };
    await context.route(/(spotify\.com|youtube\.com|youtube-nocookie\.com|scdn\.co|ytimg\.com|evil\.test)/, route => {
      const url = route.request().url(), cors = { 'access-control-allow-origin': '*' };
      seen.push(url);
      if (/oembed/.test(url)) return answer.fail ? route.fulfill({ status: 500, headers: cors, body: '{}' }) : route.fulfill({ contentType: 'application/json', headers: cors, body: JSON.stringify(answer.reply) });
      if (/scdn\.co\/image|ytimg\.com\/vi|evil\.test/.test(url)) return route.fulfill({ contentType: 'image/png', body: PNG });
      return route.fulfill({ contentType: 'text/html', body: '<p>lecteur</p>' });
    });
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('section[aria-labelledby=title-playlist] form');
    const w = section(page, 'playlist');
    const input = w.getByRole('textbox', { name: /Lien de ta playlist/ });
    const submit = async text => { await input.fill(text); await w.getByRole('button', { name: 'Ajouter' }).click(); };
    for (const bad of ['javascript:alert(1)', 'https://evil.com/open.spotify.com/playlist/' + SP, 'https://open.spotify.com.evil.fr/playlist/' + SP,
      'https://youtube.com.evil.fr/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=trop_court', 'https://open.spotify.com/playlist/court', 'data:text/html,<b>x</b>', 'ftp://open.spotify.com/playlist/' + SP, 'n\'importe quoi', 'https://www.youtube.com/watch?list="><script>window.pirate=1</script>']) {
      await submit(bad);
      assert.equal(await w.locator('.note').isVisible(), true, `refusé : ${bad}`);
    }
    assert.deepEqual(seen, [], 'un lien refusé ne déclenche aucune requête');
    assert.equal(db.rows.playlist, undefined);
    assert.match(await w.textContent('.pl-info.small'), /adresse IP/, 'le formulaire prévient de ce qui part chez le service');

    // Spotify : titre et pochette récupérés à l'ajout, affichés ensuite, lecteur pas encore chargé.
    await submit(`https://open.spotify.com/intl-fr/playlist/${SP}?si=abc123`);
    await w.locator('img.pl-cover').waitFor();
    assert.equal(await w.locator('.pl-title').textContent(), 'Peaceful Piano');
    assert.equal(await w.locator('img.pl-cover').getAttribute('src'), 'https://i.scdn.co/image/abc');
    assert.equal(await w.locator('img.pl-cover').getAttribute('referrerpolicy'), 'no-referrer');
    assert.equal(await w.locator('iframe').count(), 0, 'le lecteur n\'est pas chargé avant le clic');
    assert.ok(seen.some(u => u.startsWith('https://open.spotify.com/oembed?') && u.includes(encodeURIComponent(`https://open.spotify.com/playlist/${SP}`))), 'titre demandé à l\'ajout');
    assert.ok(!seen.some(u => /\/embed\//.test(u)), 'aucun lecteur chargé avant le clic');
    assert.match(await w.innerText(), /à chaque ouverture de ton écran, Spotify reçoit ton adresse IP/);
    assert.match(await w.innerText(), /30 secondes/);
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
    assert.deepEqual(db.rows.playlist, { provider: 'spotify', kind: 'playlist', id: SP, title: 'Peaceful Piano', thumb: 'https://i.scdn.co/image/abc' });
    await w.getByRole('button', { name: 'Charger le lecteur' }).click();
    const frame = w.locator('iframe');
    assert.equal(await frame.getAttribute('src'), `https://open.spotify.com/embed/playlist/${SP}`);
    assert.equal(await frame.getAttribute('referrerpolicy'), 'strict-origin-when-cross-origin');
    assert.equal(await w.getByRole('link', { name: 'Ouvrir sur Spotify' }).getAttribute('href'), `https://open.spotify.com/playlist/${SP}`);
    await shot(page, 'detente-playlist');
    await w.getByRole('button', { name: 'Arrêter le lecteur' }).click();
    assert.equal(await w.locator('iframe').count(), 0);

    // YouTube : un titre piégé reste du texte ; la pochette vient bien de i.ytimg.com.
    answer.reply = { title: 'Mix <b>chill</b> <img src=x onerror="window.pirate=1">', thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' };
    await w.getByRole('button', { name: 'Changer' }).click();
    await submit(`https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=${YT}`);
    await w.locator('img.pl-cover').waitFor();
    assert.equal(await w.locator('.pl-title').textContent(), 'Mix <b>chill</b> <img src=x onerror="window.pirate=1">');
    assert.equal(await page.evaluate(() => window.pirate), undefined);
    await w.getByRole('button', { name: 'Charger le lecteur' }).click();
    assert.equal(await frame.getAttribute('src'), `https://www.youtube-nocookie.com/embed/videoseries?list=${YT}`);

    // Une pochette hébergée ailleurs est ignorée (et jamais demandée) ; le titre, lui, reste.
    seen.length = 0;
    answer.reply = { title: 'Autre', thumbnail_url: 'https://evil.test/x.png' };
    await w.getByRole('button', { name: 'Changer' }).click();
    await submit('https://youtu.be/dQw4w9WgXcQ');
    await w.locator('.pl-title', { hasText: 'Autre' }).waitFor();
    assert.equal(await w.locator('img.pl-cover').count(), 0);
    assert.ok(!seen.some(u => u.includes('evil.test')), 'aucune requête vers un serveur d\'images non prévu');
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
    assert.equal(db.rows.playlist.thumb, undefined);

    // Le service ne répond pas : le widget marche quand même, sans titre ni pochette.
    answer.fail = true;
    await w.getByRole('button', { name: 'Changer' }).click();
    await submit(`https://open.spotify.com/track/${SP}`);
    await w.locator('.pl-title', { hasText: 'Spotify · titre' }).waitFor();
    assert.equal(await w.locator('img.pl-cover').count(), 0);
    assert.match(await w.innerText(), /rien n'est chargé avant ton clic/, 'sans pochette, la promesse d\'origine reste vraie');
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
    assert.deepEqual(db.rows.playlist, { provider: 'spotify', kind: 'track', id: SP });
    await w.getByRole('button', { name: 'Charger le lecteur' }).click();
    assert.equal(await w.locator('iframe').evaluate(f => f.style.height), '152px');

    // Après rechargement : titre et pochette repris de l'enregistrement, lecteur à recharger au clic.
    answer.fail = false; answer.reply = { title: 'Peaceful Piano', thumbnail_url: 'https://i.scdn.co/image/abc' };
    await w.getByRole('button', { name: 'Changer' }).click();
    await submit(`https://open.spotify.com/playlist/${SP}`);
    await w.locator('img.pl-cover').waitFor();
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
    await page.reload();
    await w.locator('img.pl-cover').waitFor();
    assert.equal(await w.locator('.pl-title').textContent(), 'Peaceful Piano');
    assert.equal(await w.locator('iframe').count(), 0);
    // Pochette cassée : un carré neutre la remplace.
    await w.locator('img.pl-cover').evaluate(img => img.dispatchEvent(new Event('error')));
    assert.equal(await w.locator('img.pl-cover').count(), 0);
    assert.equal(await w.locator('.pl-cover').count(), 1);
    assert.equal(await page.evaluate(() => window.pirate), undefined);
    assert.deepEqual(errors, []);
    await context.close();
  }
  // Données enregistrées trafiquées : adresse d'image étrangère, schéma dangereux, titre démesuré, identifiant piégé.
  {
    const rows = {
      ecran: { wallpaper: 'blanc', widgets: ['playlist'], done: true },
      playlist: { provider: 'spotify', kind: 'playlist', id: '37i9dQZF1DX4sWSpwq3LiO', title: 'T'.repeat(500), thumb: 'https://evil.test/track.png' },
    };
    const { context, page, errors } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, rows);
    const seen = [];
    await context.route(/evil\.test|scdn\.co|spotify\.com/, route => { seen.push(route.request().url()); return route.fulfill({ contentType: 'text/html', body: '' }); });
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.pl-title');
    assert.equal(await page.locator('.pl-title').textContent().then(t => t.length), 120, 'titre plafonné');
    assert.equal(await page.locator('img.pl-cover').count(), 0);
    assert.deepEqual(seen, [], 'aucune requête vers une adresse d\'image non autorisée');
    await context.close();
    for (const thumb of ['javascript:alert(1)', 'http://i.scdn.co/image/abc', 'https://i.scdn.co.evil.test/a.png']) {
      const r = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, { ...rows, playlist: { ...rows.playlist, title: 'ok', thumb } });
      await r.page.goto(`${base}/dashboard.html`);
      await r.page.waitForSelector('.pl-title');
      assert.equal(await r.page.locator('img.pl-cover').count(), 0, thumb);
      await r.context.close();
    }
    const bad = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, { ...rows, playlist: { provider: 'youtube', kind: 'video', id: '"><script>x' } });
    await bad.page.goto(`${base}/dashboard.html`);
    await bad.page.waitForSelector('section[aria-labelledby=title-playlist] form');
    assert.equal(await bad.page.locator('iframe').count(), 0);
    assert.deepEqual([...errors, ...bad.errors], []);
    await bad.context.close();
  }

  // Pause détente : on choisit une pause, un décompte avec un cercle qui se vide, arrêt possible, rien n'est enregistré.
  {
    const { context, page, errors, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, { ecran: { wallpaper: 'blanc', widgets: ['pause'], done: true } });
    await page.clock.install();
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.break');
    const w = section(page, 'pause');
    assert.equal(await w.locator('.break').count(), 4);
    await w.getByRole('button', { name: /Regarder au loin/ }).click();
    await page.clock.runFor(300);
    assert.equal(await w.locator('.break').first().isVisible(), false, 'la liste laisse la place au décompte');
    assert.match(await w.getByRole('timer').textContent(), /^00:(20|19)$/);
    assert.match(await w.textContent('.zone'), /lointain/);
    const offset = () => w.locator('.ring .fill').evaluate(c => parseFloat(c.style.strokeDashoffset));
    const early = await offset();
    await page.clock.runFor(10000);
    assert.match(await w.getByRole('timer').textContent(), /^00:(09|10)$/);
    assert.ok(await offset() > early + 100, 'le cercle se vide avec le temps');
    await shot(page, 'detente-pause');
    await w.getByRole('button', { name: 'Arrêter la pause' }).click();
    assert.equal(await w.locator('.break').first().isVisible(), true);
    assert.equal(await w.getByRole('status').textContent(), '');
    await w.getByRole('button', { name: /S'étirer/ }).click();
    await page.clock.runFor(61000);
    assert.match(await w.getByRole('status').textContent(), /Pause terminée : s'étirer/);
    assert.equal(await w.locator('.break').first().isVisible(), true);
    assert.equal(db.saves, 0, 'la pause n\'enregistre rien');
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Suivi de lecture : un livre, sa progression, des citations, les livres terminés ; tout survit au rechargement.
  {
    const { context, page, errors, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, { ecran: { wallpaper: 'blanc', widgets: ['lecture'], done: true } });
    await page.clock.install();
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('section[aria-labelledby=title-lecture] form');
    const w = section(page, 'lecture');
    const choose = async (title, author, pages) => {
      await w.getByRole('textbox', { name: 'Titre du livre' }).fill(title);
      await w.getByRole('textbox', { name: 'Auteur' }).fill(author);
      await w.getByRole('spinbutton', { name: 'Nombre de pages' }).fill(pages);
      await w.getByRole('button', { name: 'Choisir ce livre' }).click();
    };
    await choose('', '', '');
    assert.match(await w.locator('.note').textContent(), /titre du livre/);
    for (const bad of ['0', '-5', '99999', '12.5']) {
      await choose('Un livre', '', bad);
      assert.match(await w.locator('.note').textContent(), /nombre de pages/, bad);
    }
    assert.equal(db.rows.lecture, undefined, 'rien n\'est enregistré tant que le livre est refusé');
    await choose('<b>Dune</b>', 'Frank Herbert', '400');
    assert.equal(await w.locator('.book-title').textContent(), '<b>Dune</b>', 'le titre reste du texte');
    assert.match(await w.textContent('.zone'), /Frank Herbert/);
    const page_ = w.getByRole('spinbutton', { name: 'Page actuelle' });
    await page_.fill('100');
    await page_.blur();
    assert.match(await w.innerText(), /Page 100 sur 400 · 25 %/);
    await page_.fill('9999');
    await page_.blur();
    assert.match(await w.innerText(), /Page 400 sur 400 · 100 %/, 'la page ne dépasse pas le nombre de pages');
    await page_.fill('150'); await page_.blur();
    // Citations : ajout, texte inoffensif, limite, suppression.
    const quote = w.getByRole('textbox', { name: 'Citation à garder' });
    const keep = async t => { await quote.fill(t); await w.getByRole('button', { name: 'Garder' }).click(); };
    await keep('<img src=x onerror="window.pirate=1">');
    await keep('Je ne dois pas avoir peur.');
    assert.equal(await page.evaluate(() => window.pirate), undefined);
    assert.equal(await w.locator('.row.quote').count(), 2);
    assert.match(await w.locator('.row.quote').first().innerText(), /Je ne dois pas avoir peur\. » — <b>Dune<\/b>/);
    for (let i = 0; i < 8; i++) await keep(`Citation ${i}`);
    await keep('Une de trop');
    assert.match(await w.locator('.note').textContent(), /10 citations/);
    assert.equal(await w.locator('.row.quote').count(), 10);
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
    assert.deepEqual([db.rows.lecture.book.page, db.rows.lecture.quotes.length], [150, 10]);
    await page.reload();
    await w.locator('.book-title').waitFor();
    assert.match(await w.innerText(), /Page 150 sur 400 · 38 %/);
    assert.equal(await w.locator('.row.quote').count(), 10);
    await w.getByRole('button', { name: /Supprimer la citation : Citation 0/ }).click();
    assert.equal(await w.locator('.row.quote').count(), 9);
    // Terminer le livre : il faut confirmer, puis il passe dans les livres terminés.
    await w.getByRole('button', { name: "J'ai fini ce livre" }).click();
    assert.equal(await w.locator('.book-title').isVisible(), true, 'un seul clic ne termine pas le livre');
    await w.getByRole('button', { name: 'Vraiment terminé ?' }).click();
    await w.getByRole('textbox', { name: 'Titre du livre' }).waitFor();
    assert.equal(await w.locator('.meta').textContent(), '1 livre terminé');
    assert.equal(await w.locator('.row.quote').count(), 9, 'les citations sont gardées');
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
    assert.deepEqual([db.rows.lecture.book, db.rows.lecture.finished], [null, ['<b>Dune</b>']]);
    await choose('Sans pages', '', '');
    assert.match(await w.innerText(), /Page 0/);
    assert.equal(await w.locator('.bar').isVisible(), false, 'pas de barre sans nombre de pages');
    await shot(page, 'detente-lecture');
    assert.deepEqual(errors, []);
    await context.close();
  }
  // Données enregistrées trafiquées : valeurs hors limites ou de mauvais type sont ramenées à des valeurs sûres.
  {
    const rows = { ecran: { wallpaper: 'blanc', widgets: ['lecture'], done: true }, lecture: { book: { title: 'T'.repeat(500), author: 42, pages: -3, page: 'abc' }, quotes: [{ text: 'x'.repeat(900) }, { text: 123 }, null], finished: ['ok', 5, null] } };
    const { context, page, errors } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, rows);
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.book-title');
    assert.equal(await page.locator('.book-title').textContent().then(t => t.length), 100);
    assert.match(await section(page, 'lecture').innerText(), /Page 0/);
    assert.equal(await page.locator('.row.quote').count(), 1);
    assert.equal(await page.locator('.row.quote .grow').textContent().then(t => t.length), 300 + 4);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Tableau d'inspiration : photos réduites et sans position GPS, 6 au plus, légendes, suppression, rechargement.
  {
    const original = fs.readFileSync(path.join(ROOT, 'assets/lake-mapourika-nz.jpg'));
    const payload = Buffer.from('Exif\0\0GPSLatitude=48.8566 GPSLongitude=2.3522');
    const withGps = Buffer.concat([original.subarray(0, 2), Buffer.from([0xff, 0xe1, (payload.length + 2) >> 8, (payload.length + 2) & 255]), payload, original.subarray(2)]);
    assert.ok(withGps.includes('GPSLatitude'), 'la photo de test contient bien une position');
    const WIDGET = { ecran: { wallpaper: 'blanc', widgets: ['inspiration'], done: true } };
    const { context, page, errors, db } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, WIDGET);
    const store = new Map(), uploads = [], removed = [], gets = [], fail = { upload: false };
    await context.route(/\/storage\/v1\/object\/inspiration/, route => {
      const req = route.request(), u = new URL(req.url());
      if (req.method() === 'OPTIONS') return preflight(route);
      if (req.method() === 'DELETE') { for (const pre of req.postDataJSON().prefixes) { store.delete(`/storage/v1/object/inspiration/${pre}`); removed.push(pre); } return json(route, 200, []); }
      if (req.method() === 'GET') { gets.push(u.pathname); const b = store.get(u.pathname); return b ? route.fulfill({ status: 200, contentType: 'image/jpeg', headers: { 'access-control-allow-origin': '*' }, body: b }) : json(route, 404, { message: 'absent' }); }
      if (fail.upload) return json(route, 500, { message: 'panne' });
      const raw = req.postDataBuffer(), start = raw.indexOf(Buffer.from([0xff, 0xd8, 0xff])), end = raw.lastIndexOf(Buffer.from([0xff, 0xd9]));
      store.set(u.pathname, raw.subarray(start, end + 2));
      uploads.push({ path: u.pathname, raw });
      return json(route, 200, { Key: u.pathname });
    });
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('section[aria-labelledby=title-inspiration] .empty');
    const w = section(page, 'inspiration');
    const pick = (name, buffer, mimeType = 'image/jpeg') => w.locator('input[type=file]').setInputFiles({ name, mimeType, buffer });
    assert.equal(await w.locator('.meta').textContent(), '0 / 6');
    await pick('a.jpg', withGps);
    await w.locator('.insp img').waitFor();
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].path, '/storage/v1/object/inspiration/u1/1.jpg', 'rangée dans le dossier de la personne, emplacement 1');
    assert.ok(uploads[0].raw.includes(Buffer.from([0xff, 0xd8, 0xff])), 'c\'est bien un JPEG');
    assert.equal(uploads[0].raw.includes('GPSLatitude') || uploads[0].raw.includes('Exif'), false, 'la position GPS est retirée');
    assert.ok(store.get(uploads[0].path).length <= 500 * 1024, 'sous la taille permise');
    assert.ok(store.get(uploads[0].path).length < original.length, 'la photo est réduite');
    assert.equal(await w.locator('.meta').textContent(), '1 / 6');
    const cap = w.getByRole('textbox', { name: "Légende de l'image 1" });
    await cap.fill('<img src=x onerror="window.pirate=1"> Mon bureau');
    await cap.blur();
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
    assert.deepEqual(db.rows.inspiration.items, [{ slot: 1, caption: '<img src=x onerror="window.pirate=1"> Mon bureau' }]);
    assert.equal(await page.evaluate(() => window.pirate), undefined);
    // Six au plus.
    for (let i = 2; i <= 6; i++) { await pick(`${i}.jpg`, original); await w.locator('.insp').nth(i - 1).waitFor(); }
    assert.deepEqual(uploads.map(u => u.path.split('/').pop()), ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', '6.jpg']);
    assert.equal(await w.getByRole('button', { name: 'Ajouter une photo' }).isVisible(), false, 'le bouton disparaît quand le tableau est plein');
    await pick('7.jpg', original);
    assert.match(await w.locator('.note').textContent(), /tableau est plein/);
    assert.equal(uploads.length, 6, 'une septième photo n\'est jamais envoyée');
    // Suppression : le fichier est effacé, l'emplacement libéré est réutilisé.
    await w.getByRole('button', { name: "Supprimer l'image 2" }).click();
    await page.waitForFunction(() => document.querySelectorAll('.insp').length === 5);
    assert.deepEqual(removed, ['u1/2.jpg']);
    await pick('neuf.jpg', original);
    await page.waitForFunction(() => document.querySelectorAll('.insp').length === 6);
    assert.equal(uploads.at(-1).path, '/storage/v1/object/inspiration/u1/2.jpg');
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
    assert.equal(db.rows.inspiration.items.length, 6);
    await shot(page, 'detente-inspiration');
    // Rechargement : les images sont retéléchargées depuis le stockage privé.
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('.insp img').length === 6 && [...document.querySelectorAll('.insp img')].every(i => i.src.startsWith('blob:') && i.naturalWidth > 0));
    assert.equal(await w.getByRole('textbox', { name: "Légende de l'image 1" }).inputValue(), '<img src=x onerror="window.pirate=1"> Mon bureau');
    // Échecs : envoi refusé, fichier qui n'est pas une image.
    await w.getByRole('button', { name: "Supprimer l'image 6" }).click();
    await page.waitForFunction(() => document.querySelectorAll('.insp').length === 5);
    fail.upload = true;
    await pick('x.jpg', original);
    await w.locator('.note').filter({ hasText: "L'envoi n'a pas abouti" }).waitFor();
    assert.equal(await w.locator('.insp').count(), 5, 'rien n\'est ajouté si l\'envoi échoue');
    fail.upload = false;
    await pick('notes.txt', Buffer.from('pas une image'), 'text/plain');
    assert.match(await w.locator('.note').textContent(), /fichier image/);
    await pick('faux.jpg', Buffer.from('ceci n\'est pas du jpeg'));
    await w.locator('.note').filter({ hasText: "n'a pas pu être lue" }).waitFor();
    assert.equal(await w.locator('.insp').count(), 5);
    assert.deepEqual(errors, []);
    await context.close();
  }
  // Données enregistrées trafiquées : emplacements hors limites ou doublons ignorés, légende plafonnée, aucune requête inutile.
  {
    const rows = { ecran: { wallpaper: 'blanc', widgets: ['inspiration'], done: true }, inspiration: { items: [{ slot: 9, caption: 'x' }, { slot: 0, caption: 'y' }, { slot: 1, caption: 'A'.repeat(200) }, { slot: 1, caption: 'doublon' }, { slot: '../../autre/1', caption: 'z' }, null, 'mauvais'] } };
    const { context, page, errors } = await openDashboard(browser, base, { viewport: { width: 1440, height: 900 } }, rows);
    const gets = [];
    await context.route(/\/storage\/v1\/object\/inspiration/, route => { gets.push(new URL(route.request().url()).pathname); return json(route, 404, { message: 'absent' }); });
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('.insp');
    assert.equal(await page.locator('.insp').count(), 1);
    assert.equal(await page.locator('.insp input').inputValue().then(v => v.length), 60);
    await page.waitForSelector('.insp .blank');
    assert.deepEqual(gets, ['/storage/v1/object/inspiration/u1/1.jpg'], 'seul un emplacement valide est demandé');
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Installer l'app : l'entrée du menu du compte ouvre le guide (détails dans tests/install.check.cjs).
  {
    const { context, page, errors } = await openDashboard(browser, base, { viewport: { width: 390, height: 844 } }, {});
    await page.goto(`${base}/dashboard.html`);
    await page.waitForSelector('#screen:not([hidden])');
    assert.equal(await page.locator('dialog.ins[open]').count(), 0, 'le guide ne s\'ouvre pas tout seul');
    await page.click('#me');
    await page.locator('#menu [data-install]').click();
    await page.waitForSelector('dialog.ins[open]');
    await page.waitForFunction(() => !document.querySelector('#menu').matches(':popover-open')); // le menu se referme
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog.ins[open]').count(), 0);
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
