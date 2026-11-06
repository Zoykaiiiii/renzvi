// Vérifie le guide d'installation (site/install.js) et le manifeste dans un vrai Chromium. Les appareils sont SIMULÉS
// (agent utilisateur + taille d'écran) : ça ne remplace pas un essai sur un vrai téléphone.
// Lancement : NODE_PATH=<dossier node_modules contenant playwright> node tests/install.check.cjs [dossier-captures]
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', 'site');
const SHOTS = process.argv[2];
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const UA = {
  iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iosChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1',
  iosFirefox: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
  tiktok: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 musical_ly_32.0 BytedanceWebview',
  instagramAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 330.0.0.0 Android',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  deskFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  deskSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
};
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const DESKTOP = { viewport: { width: 1280, height: 800 } };

// Simule le navigateur qui propose l'installation. prompt() est compté ; la réponse de l'utilisateur est choisie par le test.
const fakeNative = () => {
  window.__asked = 0;
  // Comme un vrai navigateur : l'événement arrive une fois la page chargée.
  window.addEventListener('load', () => setTimeout(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => { window.__asked++; return Promise.resolve(); };
    e.userChoice = new Promise(resolve => { window.__choose = resolve; });
    window.dispatchEvent(e);
  }, 50));
};

async function visit(browser, options, { native = false, page: url = 'index.html', init } = {}) {
  const context = await browser.newContext(options);
  if (native) await context.addInitScript(fakeNative);
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/${url}`);
  if (native) await page.waitForFunction(() => typeof window.__choose === 'function');
  return { context, page, errors };
}

const opener = page => page.locator('[data-install]:visible').first();
const guide = page => page.locator('dialog.ins');
const stepCount = page => page.locator('#ins-count').textContent();
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const settle = page => page.waitForTimeout(SHOTS ? 4300 : 250);

// Parcourt tout un guide : titre, compteur, une seule étape visible, pointeur calé sur sa cible, retour et avance.
async function walk(page, name, expectedSteps, { finalLast = true } = {}) {
  await opener(page).click();
  await guide(page).waitFor({ state: 'visible' });
  assert.equal(await page.locator('#ins-title').textContent(), 'Renzvi sur ton écran d\'accueil');
  assert.equal(await page.locator('.ins-demo').textContent(), 'Démonstration');
  assert.equal(await page.locator('.ins-dev').count(), 1, 'une seule étape visible à la fois');
  for (let i = 0; i < expectedSteps; i++) {
    assert.equal(await stepCount(page), `${i + 1} / ${expectedSteps}`, name);
    assert.ok((await page.locator('#ins-text').textContent()).length > 15, 'phrase d\'instruction');
    assert.ok(await page.locator('.ins-dev').getAttribute('aria-label').then(t => t.startsWith('Démonstration')), 'illustration signalée comme démonstration');
    await page.waitForTimeout(100);
    if (await page.locator('.ins-screen [data-target]').count()) {
      const left = await page.locator('.ptr').evaluate(p => parseFloat(p.style.left));
      assert.ok(left > 0 && left < 100, `pointeur calé sur sa cible (${name} étape ${i + 1})`);
    }
    await settle(page);
    await shot(page, `${name}-${i + 1}`);
    if (i < expectedSteps - 1) await page.click('#ins-next');
  }
  assert.equal(await page.locator('#ins-next').textContent(), 'Terminé');
  if (expectedSteps > 1) {
    await page.click('#ins-prev');
    assert.equal(await stepCount(page), `${expectedSteps - 1} / ${expectedSteps}`);
    await page.click('#ins-next');
  } else assert.equal(await page.locator('#ins-prev').isDisabled(), true);
  await page.click('#ins-next');
  await guide(page).waitFor({ state: 'hidden' });
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  global.base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  // Manifeste et icônes : ce qui rend l'app installable.
  {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
    assert.equal(manifest.name, 'Renzvi');
    assert.equal(manifest.display, 'standalone');
    assert.ok(manifest.start_url && manifest.scope && manifest.id);
    const sizes = [];
    for (const icon of manifest.icons) {
      const png = fs.readFileSync(path.join(ROOT, icon.src));
      const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
      assert.equal(`${w}x${h}`, icon.sizes, icon.src);
      sizes.push(`${icon.purpose}:${w}`);
    }
    assert.ok(sizes.includes('any:192') && sizes.includes('any:512') && sizes.includes('maskable:512'));
    assert.equal(fs.statSync(path.join(ROOT, 'icons/apple-touch-icon.png')).size > 500, true);
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    assert.ok(!/caches\.|respondWith|cache\.add/.test(sw), 'le service worker ne met rien en cache');
    for (const file of ['index.html', 'login.html', 'dashboard.html']) {
      const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
      assert.ok(html.includes('rel="manifest"') && html.includes('apple-touch-icon'), file);
    }
    const { page, context } = await visit(browser, DESKTOP);
    const served = await page.evaluate(async () => (await fetch('manifest.webmanifest')).headers.get('content-type'));
    assert.match(served, /manifest/);
    await context.close();
  }

  // L'accueil est bien la landing, sans fichier manquant ni appel à un autre site ; l'ancienne adresse du prototype y renvoie.
  for (const options of [DESKTOP, { ...PHONE, userAgent: UA.iosSafari }]) {
    const { page, context, errors } = await visit(browser, options, { page: '' });
    const missing = [], outside = [];
    page.on('response', r => { if (r.status() >= 400) missing.push(r.url()); });
    page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1') && !r.url().startsWith('data:')) outside.push(r.url()); });
    await page.reload();
    await page.waitForLoadState('networkidle');
    assert.equal(await page.title(), 'Renzvi — tes outils, au même endroit');
    assert.ok(await page.isVisible('h1'));
    assert.equal(await page.locator('a[href="login.html"]:visible').count() > 0, true, 'on peut aller à la connexion');
    assert.deepEqual(missing, []);
    assert.deepEqual(outside, [], 'polices et images sont servies par le site');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await page.isVisible('[data-install]'), "le bouton d'installation est sur l'accueil");
    const home = page.url();
    await page.goto(home + 'prototype.html');
    await page.waitForURL(home);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Landing sur téléphone : le bouton est dans le premier écran, ne masque rien, et le guide ne s'ouvre pas tout seul.
  {
    const { page, context, errors } = await visit(browser, { ...PHONE, userAgent: UA.iosSafari });
    assert.equal(await guide(page).count(), 0, 'le guide n\'est pas ouvert à l\'arrivée');
    const b = await opener(page).boundingBox();
    assert.ok(b && b.y + b.height <= 844 && b.height >= 44, 'bouton visible dès le premier écran, assez grand');
    assert.match(await opener(page).textContent(), /Installer l'app/);
    assert.equal(await opener(page).locator('svg').count(), 1, 'icône de téléphone avec un +');
    const signin = await page.locator('.signin').boundingBox();
    const inter = !(b.x + b.width <= signin.x || signin.x + signin.width <= b.x || b.y + b.height <= signin.y || signin.y + signin.height <= b.y);
    assert.equal(inter, false, 'ne masque pas la connexion');
    assert.equal(await page.locator('a.signin').isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await shot(page, '00-landing-mobile');
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Un parcours par navigateur.
  const FLOWS = [
    ['ios-safari', { ...PHONE, userAgent: UA.iosSafari }, {}, 3],
    ['ios-chrome', { ...PHONE, userAgent: UA.iosChrome }, {}, 3],
    ['ios-firefox', { ...PHONE, userAgent: UA.iosFirefox }, {}, 2],
    ['tiktok', { ...PHONE, userAgent: UA.tiktok }, {}, 2],
    ['instagram-android', { ...PHONE, userAgent: UA.instagramAndroid }, {}, 2],
    ['android-chrome', { ...PHONE, userAgent: UA.androidChrome }, {}, 3],
    ['android-native', { ...PHONE, userAgent: UA.androidChrome }, { native: true }, 2],
    ['android-firefox', { ...PHONE, userAgent: UA.androidFirefox }, {}, 3],
    ['android-samsung', { ...PHONE, userAgent: UA.samsung }, {}, 3],
    ['desktop-native', DESKTOP, { native: true }, 2],
    ['desktop-chromium', DESKTOP, {}, 1],
    ['desktop-safari', { ...DESKTOP, userAgent: UA.deskSafari }, {}, 2],
    ['desktop-firefox', { ...DESKTOP, userAgent: UA.deskFirefox }, {}, 1],
  ];
  for (const [name, options, extra, steps] of FLOWS) {
    const { page, context, errors } = await visit(browser, options, extra);
    await walk(page, name, steps);
    assert.deepEqual(errors, [], name);
    await context.close();
  }

  // Contenu propre à chaque cas : on ne montre pas le parcours d'un autre appareil.
  const textOf = async (options, extra = {}) => {
    const { page, context } = await visit(browser, options, extra);
    await opener(page).click();
    await guide(page).waitFor();
    const all = [];
    const n = Number((await stepCount(page)).split(' / ')[1]);
    for (let i = 0; i < n; i++) { all.push(await page.locator('.ins-copy').textContent()); if (i < n - 1) await page.click('#ins-next'); }
    const result = { text: all.join(' | '), native: await page.locator('#ins-native').isVisible(), copy: await page.locator('#ins-copy').isVisible() };
    await context.close();
    return result;
  };
  {
    const ios = await textOf({ ...PHONE, userAgent: UA.iosSafari });
    assert.match(ios.text, /Partager/); assert.match(ios.text, /Sur l'écran d'accueil/); assert.match(ios.text, /Ajouter/);
    assert.equal(ios.native, false);
    const tiktok = await textOf({ ...PHONE, userAgent: UA.tiktok });
    assert.match(tiktok.text, /Ouvrir dans le navigateur/); assert.doesNotMatch(tiktok.text, /Sur l'écran d'accueil/);
    assert.equal(tiktok.copy, true, 'lien à copier pour ouvrir ailleurs');
    assert.equal(tiktok.native, false, 'pas d\'installation dans le navigateur intégré');
    const native = await textOf({ ...PHONE, userAgent: UA.androidChrome }, { native: true });
    assert.equal(native.native, true);
    const manual = await textOf({ ...PHONE, userAgent: UA.androidChrome });
    assert.equal(manual.native, false, 'pas de bouton d\'installation sans option native');
    assert.match(manual.text, /trois points/);
    const firefox = await textOf({ ...DESKTOP, userAgent: UA.deskFirefox });
    assert.doesNotMatch(firefox.text, /iPhone|Partager|écran d'accueil/); assert.match(firefox.text, /ne permet pas/);
    const chromeDesk = await textOf(DESKTOP);
    assert.doesNotMatch(chromeDesk.text, /iPhone|Partager/);
  }

  // Installation native : la demande du navigateur ne part qu'après le clic ; refus et acceptation.
  {
    const { page, context } = await visit(browser, { ...PHONE, userAgent: UA.androidChrome }, { native: true });
    assert.equal(await page.evaluate(() => window.__asked), 0, 'aucune demande avant le clic');
    await opener(page).click();
    assert.equal(await page.evaluate(() => window.__asked), 0, 'ouvrir le guide ne déclenche pas la demande');
    await page.click('#ins-native');
    assert.equal(await page.evaluate(() => window.__asked), 1);
    await page.evaluate(() => window.__choose({ outcome: 'dismissed' }));
    await page.waitForFunction(() => document.querySelector('#ins-native').hidden);
    assert.match(await page.locator('#ins-status').textContent(), /Pas de souci/);
    assert.equal(await stepCount(page), '1 / 3', 'le parcours manuel prend le relais');
    await shot(page, 'android-refus');
    await context.close();
  }
  {
    const { page, context } = await visit(browser, DESKTOP, { native: true });
    await opener(page).click();
    await page.click('#ins-native');
    await page.evaluate(() => window.__choose({ outcome: 'accepted' }));
    await page.waitForFunction(() => /en cours/.test(document.querySelector('#ins-status').textContent));
    assert.equal(await page.evaluate(() => window.__asked), 1);
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    await page.waitForFunction(() => /est installée/.test(document.querySelector('#ins-status').textContent));
    assert.equal(await page.locator('[data-install]:visible').count(), 0, 'le bouton disparaît une fois installée');
    await context.close();
  }

  // Déjà installée : aucun bouton.
  {
    const { page, context } = await visit(browser, { ...PHONE, userAgent: UA.iosSafari }, { init: () => Object.defineProperty(navigator, 'standalone', { value: true }) });
    assert.equal(await page.locator('[data-install]:visible').count(), 0);
    await context.close();
  }

  // Fermeture, clavier, focus.
  {
    const { page, context } = await visit(browser, DESKTOP);
    const b = opener(page);
    await b.focus();
    await page.keyboard.press('Enter');
    await guide(page).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement.closest('dialog.ins') !== null), true, 'le focus est dans le guide');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      // Un dialogue modal laisse parfois le focus passer à la barre du navigateur (activeElement = body) : jamais à la page derrière.
      assert.equal(await page.evaluate(() => document.activeElement === document.body || document.activeElement.closest('dialog.ins') !== null), true, 'le focus ne va jamais dans la page derrière');
    }
    await page.keyboard.press('ArrowRight');
    assert.equal(await stepCount(page), '1 / 1');
    await page.keyboard.press('Escape');
    await guide(page).waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-install')), true, 'le focus revient sur le bouton');
    await b.click();
    await page.click('[data-close]');
    await guide(page).waitFor({ state: 'hidden' });
    await b.click();
    await page.mouse.click(5, 5); // en dehors de la fenêtre
    await guide(page).waitFor({ state: 'hidden' });
    await context.close();
  }

  // Animations réduites : image fixe qui montre déjà le geste, pas de bouton « Revoir ».
  {
    const { page, context } = await visit(browser, { ...PHONE, userAgent: UA.iosSafari, reducedMotion: 'reduce' });
    await opener(page).click();
    await page.waitForTimeout(300);
    assert.equal(await guide(page).evaluate(d => d.classList.contains('ins-static')), true);
    assert.equal(await page.locator('#ins-replay').isVisible(), false);
    assert.equal(await page.locator('.ptr').evaluate(p => getComputedStyle(p).opacity), '1', 'le pointeur est visible sans animation');
    assert.equal(await page.locator('.hit').evaluate(p => getComputedStyle(p).opacity), '1', 'la cible est mise en évidence');
    assert.equal(await page.locator('.ins-dev').evaluate(d => d.classList.contains('go')), false);
    await shot(page, 'reduit-1');
    await page.click('#ins-next'); await page.click('#ins-next');
    assert.equal(await page.locator('.s-app.me').evaluate(a => getComputedStyle(a).opacity), '1', 'dernière étape : l\'icône est visible');
    await shot(page, 'reduit-3');
    await context.close();
  }

  // Animations : « Revoir l'animation » relance bien la séquence.
  {
    const { page, context } = await visit(browser, { ...PHONE, userAgent: UA.iosSafari });
    await opener(page).click();
    await page.waitForFunction(() => document.querySelector('.ins-dev')?.classList.contains('go'));
    await page.waitForTimeout(4200);
    await page.click('#ins-replay');
    assert.equal(await page.locator('.ins-dev').evaluate(d => d.classList.contains('go')), true);
    assert.equal(await page.locator('.ptr').evaluate(p => p.getAnimations().length > 0), true, 'le pointeur rejoue son animation');
    await context.close();
  }

  // 320 px : rien ne déborde, tout se touche facilement, tout reste lisible.
  for (const [label, ua, extra] of [['ios', UA.iosSafari, {}], ['android-native', UA.androidChrome, { native: true }]]) {
    const { page, context } = await visit(browser, { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: ua }, extra);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, 'landing à 320 px');
    await opener(page).click();
    await guide(page).waitFor();
    const d = await guide(page).boundingBox();
    assert.ok(d.x >= 0 && d.y >= 0 && d.x + d.width <= 320 && d.y + d.height <= 640, 'le guide tient dans l\'écran');
    for (const id of ['#ins-prev', '#ins-next', '#ins-replay', '.ins-x', ...(extra.native ? ['#ins-native'] : [])]) {
      const bb = await page.locator(id).boundingBox();
      assert.ok(bb.width >= 44 && bb.height >= 44, `${id} assez grand pour le doigt (${Math.round(bb.width)}x${Math.round(bb.height)})`);
      assert.ok(bb.x >= 0 && bb.x + bb.width <= 320 && bb.y >= 0 && bb.y + bb.height <= 640, `${id} dans l'écran`);
      // Pas seulement « dans l'écran » : le bouton ne doit pas être coupé par une zone qui défile ni caché derrière autre chose.
      const reachable = await page.locator(id).evaluate(el => { const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!hit && (hit === el || el.contains(hit)); });
      assert.ok(reachable, `${id} réellement visible et touchable`);
    }
    assert.equal(await page.evaluate(() => { const b = document.querySelector('.ins-body'); return b.scrollWidth - b.clientWidth; }), 0, 'pas de défilement horizontal');
    const font = await page.locator('#ins-text').evaluate(t => parseFloat(getComputedStyle(t).fontSize));
    assert.ok(font >= 16, 'instruction lisible');
    await page.waitForTimeout(SHOTS ? 4300 : 300);
    await shot(page, `320-${label}`);
    await context.close();
  }

  console.log('install : tous les parcours passent');
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
