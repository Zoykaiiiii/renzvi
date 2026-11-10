// Vérifie le widget « Qu'est-ce qu'on mange ? » (labo) dans un vrai Chromium, Supabase simulé :
// caché du public, tirage, recette gardée, fiche avec source et licence, frigo, panne du catalogue, mobile.
// Lancement : NODE_PATH=<dossier node_modules contenant playwright> node tests/repas.check.cjs [dossier-captures]
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
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

const requests = [];
const server = http.createServer((req, res) => {
  requests.push(req.url);
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
const preflight = route => route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });

async function openBoard(browser, base, { options = {}, rows = {}, query = '?labo=1', catalogueKo = false } = {}) {
  const context = await browser.newContext(options);
  await context.addInitScript(session => localStorage.setItem('sb-xjkmztfsyyccveaeyzov-auth-token', session), JSON.stringify({ access_token: JWT, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER }));
  const db = { rows: structuredClone(rows), catalogueKo };
  await context.route(`${SUPABASE}/rest/v1/widget_state*`, route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    if (req.method() === 'GET') return json(route, 200, Object.entries(db.rows).map(([widget, data]) => ({ widget, data })));
    for (const row of req.postDataJSON()) db.rows[row.widget] = row.data;
    return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' } });
  });
  await context.route(`${SUPABASE}/rest/v1/rpc/*`, route => route.request().method() === 'OPTIONS' ? preflight(route) : json(route, 200, []));
  await context.route(`${SUPABASE}/rest/v1/study_*`, route => route.request().method() === 'OPTIONS' ? preflight(route) : json(route, 200, []));
  await context.route(`${SUPABASE}/storage/v1/object/**`, route => route.request().method() === 'OPTIONS' ? preflight(route) : json(route, 404, { message: 'absent' }));
  await context.route('**/nutrition/recettes.json', route => db.catalogueKo ? route.fulfill({ status: 500, body: '' }) : route.continue());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/dashboard.html${query}`);
  await page.waitForSelector('#board .widget:not([hidden]), #board-empty:not([hidden]), #setup:not([hidden])');
  return { context, db, page, errors };
}
const board = ids => ({ ecran: { wallpaper: 'blanc', widgets: ids, done: true } });
const until = async (fn, what, ms = 8000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error(`délai dépassé : ${what}`); await new Promise(r => setTimeout(r, 50)); } };
const shot = (page, name, opts) => SHOTS && page.screenshot({ path: path.join(SHOTS, `repas-${name}.png`), ...opts });

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const desk = { viewport: { width: 1440, height: 1100 } };

  // 1. Public : pas de widget, rien de téléchargé, même si l'écran enregistré le cite.
  {
    requests.length = 0;
    const { page, errors, context } = await openBoard(browser, base, { options: desk, rows: board(['repas', 'notes']), query: '?labo=0' });
    assert.equal(await page.locator('#board [data-widget=repas]').count(), 0, 'widget caché du public');
    await page.click('#open-add');
    assert.ok(!(await page.textContent('#catalog')).includes("Qu'est-ce qu'on mange"), 'absent du catalogue public');
    assert.ok(!requests.some(u => /nutrition\//.test(u)), 'aucun fichier nutrition téléchargé');
    assert.deepEqual(errors, []);
    await context.close();
    console.log('ok - caché du public');
  }

  // 2. Labo : tirage, recette gardée, fiche avec source et licence.
  {
    const { page, errors, context, db } = await openBoard(browser, base, { options: desk, rows: board(['repas']) });
    const w = page.locator('#board [data-widget=repas]');
    await w.getByRole('button', { name: 'Surprends-moi' }).first().waitFor();
    await w.locator('.repas-filtres select').nth(0).selectOption('dessert');
    await w.locator('.repas-roulette .primary').click();
    await w.locator('.repas-reel .book-title').waitFor({ timeout: 5000 });
    const titre = await w.locator('.repas-reel .book-title').textContent();
    await until(() => db.rows.repas?.recent?.length === 1, 'tirage enregistré');
    assert.equal(db.rows.repas.f.ty, 'dessert', 'filtre enregistré');
    const recettes = JSON.parse(fs.readFileSync(path.join(ROOT, 'nutrition', 'recettes.json'))).recettes;
    assert.equal(recettes.find(r => r.id === db.rows.repas.recent[0]).ty, 'dessert', 'le tirage respecte le filtre');
    await w.getByRole('button', { name: 'Garder' }).click();
    await until(() => db.rows.repas?.fav?.length === 1, 'recette gardée');
    await shot(page, 'tirage', { clip: await w.boundingBox() });
    await w.getByRole('button', { name: 'Voir la recette' }).click();
    const dlg = page.locator('dialog.chill-big[open]');
    await dlg.waitFor();
    assert.equal((await dlg.locator('h2').textContent()).trim(), titre.trim());
    assert.ok(await dlg.locator('.repas-ing li').count() >= 2, 'ingrédients affichés');
    assert.ok(await dlg.locator('.repas-etapes li').count() >= 1, 'étapes affichées');
    const liens = await dlg.locator('.repas-credit a').evaluateAll(as => as.map(a => a.href));
    assert.ok(liens.some(h => h.startsWith('https://fr.wikibooks.org/w/index.php?oldid=')), 'version source citée');
    assert.ok(liens.some(h => h.includes('creativecommons.org/licenses/by-sa/4.0')), 'licence citée');
    await shot(page, 'fiche');
    await dlg.getByRole('button', { name: 'Fermer' }).click();
    await w.getByRole('button', { name: /Gardées \(1\)/ }).click();
    assert.equal(await w.locator('.repas-favoris .row').count(), 1);
    assert.deepEqual(errors, []);
    await context.close();
    console.log('ok - tirage, recette gardée, fiche sourcée');
  }

  // 3. Frigo : « oeufs » tapé au clavier retrouve « œuf », groupes par manquants, case des basiques.
  {
    const { page, errors, context, db } = await openBoard(browser, base, { options: desk, rows: board(['repas']) });
    const w = page.locator('#board [data-widget=repas]');
    await w.getByRole('button', { name: 'Avec mon frigo' }).click();
    for (const ing of ['oeufs', 'beurre', 'farine', 'sucre', 'lait']) {
      await w.locator('.repas-frigo input[type=text]').fill(ing);
      await w.locator('.repas-frigo input[type=text]').press('Enter');
    }
    await until(() => db.rows.repas?.frigo?.length === 5, 'frigo enregistré');
    assert.ok(await w.locator('.repas-groupe').count() >= 1, 'des propositions');
    const avant = await w.locator('.repas-groupe', { hasText: 'Tu as tout' }).count();
    await w.locator('.repas-base input').check();
    await until(() => db.rows.repas?.base === true, 'case basiques enregistrée');
    assert.ok(await w.locator('.repas-groupe', { hasText: 'Tu as tout' }).count() >= avant);
    const premier = w.locator('.repas-liste .repas-ouvrir').first();
    assert.ok(await premier.count(), 'au moins une recette');
    await shot(page, 'frigo', { clip: await w.boundingBox() });
    await w.getByRole('button', { name: 'Retirer lait' }).click();
    await until(() => db.rows.repas?.frigo?.length === 4, 'ingrédient retiré');
    assert.deepEqual(errors, []);
    await context.close();
    console.log('ok - frigo');
  }

  // 4. Catalogue en panne puis réessai ; mouvement réduit : résultat immédiat.
  {
    const { page, errors, context, db } = await openBoard(browser, base, { options: { ...desk, reducedMotion: 'reduce' }, rows: board(['repas']), catalogueKo: true });
    const w = page.locator('#board [data-widget=repas]');
    await w.getByText("Les recettes n'ont pas pu se charger").waitFor();
    db.catalogueKo = false;
    await w.getByRole('button', { name: 'Réessayer' }).click();
    await w.locator('.repas-roulette .primary').click();
    assert.ok(await w.locator('.repas-reel .book-title').isVisible(), 'pas d’animation : résultat tout de suite');
    assert.deepEqual(errors, []);
    await context.close();
    console.log('ok - panne du catalogue, mouvement réduit');
  }

  // 5. Téléphone : rien ne déborde, fiche lisible.
  {
    const { page, errors, context } = await openBoard(browser, base, { options: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, rows: board(['repas']) });
    const w = page.locator('#board [data-widget=repas]');
    await w.getByRole('button', { name: 'Avec mon frigo' }).click();
    await w.locator('.repas-frigo input[type=text]').fill('tomate');
    await w.locator('.repas-frigo input[type=text]').press('Enter');
    await w.locator('.repas-groupe').first().waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, 'pas de défilement horizontal');
    await shot(page, 'mobile', { fullPage: false });
    await w.locator('.repas-liste .repas-ouvrir').first().click();
    await page.locator('dialog.chill-big[open]').waitFor();
    assert.equal(await page.locator('dialog.chill-big[open]').evaluate(d => d.scrollWidth - d.clientWidth), 0, 'fiche sans débordement');
    await shot(page, 'mobile-fiche');
    assert.deepEqual(errors, []);
    await context.close();
    console.log('ok - téléphone');
  }

  await browser.close();
  server.close();
  console.log('repas : tous les parcours passent');
})().catch(e => { console.error(e); process.exit(1); });
