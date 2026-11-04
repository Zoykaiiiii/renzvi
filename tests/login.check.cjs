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

async function open(browser, base, options = {}, query = '') {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/login.html${query}`);
  return { page, context, errors };
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
    await page.waitForSelector('#step-done:not([hidden])');
    assert.equal(await page.textContent('#account'), 'lea@exemple.fr');
    await shot(page, 'desktop-done');

    await page.reload();
    await page.waitForSelector('#step-done:not([hidden])');

    await page.route(`${API}/logout*`, r => r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }));
    await page.click('#logout');
    await page.waitForSelector('#step-email:not([hidden])');
    assert.deepEqual(errors, []);
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
