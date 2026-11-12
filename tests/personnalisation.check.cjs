// Vérifie la personnalisation du dashboard (verre, accent, déplacement, tailles) dans un vrai Chromium, Supabase simulé.
// Lancement : NODE_PATH=<dossier node_modules contenant playwright> node tests/personnalisation.check.cjs [dossier-captures]
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
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
const preflight = route => route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });

const ALL_IDS = ['vol', 'taches', 'heure', 'minuteur', 'semaine', 'notes', 'habitudes', 'respiration', 'ambiance', 'compte', 'raccourcis', 'playlist', 'pause', 'lecture', 'inspiration'];
const today = new Date().toLocaleDateString('sv');
const inDays = n => new Date(Date.now() + n * 864e5).toLocaleDateString('sv');
// Des contenus réalistes et parfois longs : c'est là que les débordements se voient.
const CONTENT = {
  minuteur: { length: 25, day: today, minutes: 180, log: { [today]: 180, [inDays(-1)]: 240, [inDays(-2)]: 95 } },
  taches: { items: [{ id: 'a', text: 'Relire le chapitre 4 de droit des contrats avant vendredi', done: false }, { id: 'b', text: 'Envoyer le dossier', done: true }, { id: 'c', text: 'Préparer les fiches', done: false }, { id: 'd', text: 'Appeler la scolarité', done: false }] },
  notes: { text: 'Idées pour le week-end\n— finir le plan du mémoire\n— rappeler Sam' },
  habitudes: { items: [{ id: 'h', name: 'Lire vingt minutes', days: [today] }, { id: 'i', name: 'Marcher', days: [] }, { id: 'j', name: 'Une habitude au nom vraiment très long pour voir', days: [today] }] },
  compte: { items: [{ id: 'c1', title: 'Partiel de droit civil et procédure', date: inDays(12) }, { id: 'c2', title: 'Vacances', date: inDays(40) }] },
  raccourcis: { items: [{ id: 'l1', label: 'Cours en ligne', url: 'https://moodle.exemple.fr/mon-cours' }, { id: 'l2', label: 'Bibliothèque universitaire', url: 'https://bibliotheque.exemple.fr' }] },
  playlist: { provider: 'spotify', kind: 'playlist', id: '37i9dQZF1DX4sWSpwq3LiO', title: 'Piano calme pour étudier longtemps' },
  lecture: { book: { title: 'Le Comte de Monte-Cristo', author: 'Alexandre Dumas', pages: 1200, page: 320 }, quotes: [{ id: 'q', text: 'Attendre et espérer.', book: 'Le Comte de Monte-Cristo' }], finished: [] },
};
const everything = (extra = {}) => ({ ecran: { wallpaper: 'blanc', widgets: ALL_IDS, done: true, ...extra }, ...CONTENT });

async function openBoard(browser, base, options, rows, prepare) {
  const context = await browser.newContext(options);
  await context.addInitScript(session => localStorage.setItem('sb-xjkmztfsyyccveaeyzov-auth-token', session), JSON.stringify({ access_token: JWT, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER }));
  const db = { rows, failSave: false, saves: 0, photo: null };
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
  await context.route(`${SUPABASE}/storage/v1/object/**`, route => {
    if (route.request().method() === 'OPTIONS') return preflight(route);
    return db.photo ? route.fulfill({ status: 200, contentType: 'image/jpeg', headers: { 'access-control-allow-origin': '*' }, body: db.photo }) : json(route, 404, { message: 'absent' });
  });
  // Pas de vrai Spotify ni de vraie pochette dans un test.
  await context.route(/open\.spotify\.com|i\.scdn\.co/, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>lecteur</title><body>Lecteur</body>' }));
  if (prepare) prepare(db);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/dashboard.html`);
  await page.waitForSelector('#board .widget:not([hidden]), #board-empty:not([hidden])');
  return { context, db, page, errors };
}

const SMALL = ['taches', 'notes', 'heure', 'minuteur'];
const VIEWPORTS = [[320, 568], [390, 844], [768, 1024], [1440, 900]];
const order = page => page.$$eval('#board > .widget', boxes => boxes.map(b => b.dataset.widget));
const shown = page => page.$$eval('#board > .widget', async boxes => {
  await Promise.allSettled(document.getAnimations().map(a => a.finished)); // l'ordre se lit une fois les widgets arrivés
  return boxes.map(b => { const r = b.getBoundingClientRect(); return [b.dataset.widget, Math.round(r.top), r.left]; }).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(x => x[0]);
});
const center = async loc => { await loc.scrollIntoViewIfNeeded(); const b = await loc.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
const saved = (page, text) => page.waitForFunction(t => document.getElementById('saved').textContent === t, text);
const grip = (page, id) => page.locator(`[data-widget=${id}] .grip`);

async function mouseDrag(page, from, to, drop = true) {
  const [x, y] = await center(grip(page, from));
  const [tx, ty] = await center(page.locator(`[data-widget=${to}]`));
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move((x + tx) / 2, (y + ty) / 2, { steps: 6 });
  await page.mouse.move(tx, ty, { steps: 6 });
  if (drop) await page.mouse.up();
}

const luminance = rgb => { const [r, g, b] = rgb.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + .05) / (lo + .05); };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

// Le pixel le plus sombre derrière le texte d'un widget, mesuré sur une vraie capture avec le texte rendu invisible.
async function darkestGlass(page) {
  const style = await page.addStyleTag({ content: '.widget *{visibility:hidden!important}' });
  const png = await page.locator('.widget').first().screenshot();
  await style.evaluate(n => n.remove());
  return page.evaluate(async src => {
    const bitmap = await createImageBitmap(await (await fetch(src)).blob());
    const canvas = Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height });
    const g = canvas.getContext('2d');
    g.drawImage(bitmap, 0, 0);
    // On laisse de côté les 30 px du bord : le coin arrondi laisse voir la photo nue.
    const { data } = g.getImageData(30, 30, bitmap.width - 60, bitmap.height - 60);
    let best = [255, 255, 255], low = 999;
    for (let i = 0; i < data.length; i += 4) { const sum = data[i] + data[i + 1] + data[i + 2]; if (sum < low) { low = sum; best = [data[i], data[i + 1], data[i + 2]]; } }
    return best;
  }, `data:image/png;base64,${png.toString('base64')}`);
}
// Une photo personnelle fabriquée : toute noire, toute blanche, ou très détaillée.
async function photo(browser, kind) {
  const page = await browser.newPage();
  const data = await page.evaluate(k => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 1600, height: 1000 });
    const g = canvas.getContext('2d');
    g.fillStyle = k === 'noire' ? '#000' : '#fff';
    g.fillRect(0, 0, 1600, 1000);
    if (k === 'detail') for (let x = 0; x < 1600; x += 8) for (let y = 0; y < 1000; y += 8) { g.fillStyle = (x + y) % 16 ? '#000' : '#fff'; g.fillRect(x, y, 8, 8); }
    return canvas.toDataURL('image/jpeg', .95);
  }, kind);
  await page.close();
  return Buffer.from(data.split(',')[1], 'base64');
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const desk = { viewport: { width: 1440, height: 1400 } }; // assez haut pour que la cible d'un glisser soit à l'écran
  const few = extra => ({ ...everything(), ecran: { wallpaper: 'blanc', widgets: SMALL, done: true, ...extra } });

  // Ancienne configuration : mêmes largeurs qu'avant, accent inchangé, aucune commande visible.
  for (const [width, expected] of [[1440, 356], [768, 360], [390, 358]]) {
    const { page, errors, context } = await openBoard(browser, base, { viewport: { width, height: 900 } }, few());
    const box = await page.locator('[data-widget=taches]').boundingBox();
    assert.ok(Math.abs(box.width - expected) < 1, `largeur d'un widget à ${width} px : ${box.width}`);
    assert.equal(await page.locator('[data-widget=taches]').getAttribute('data-size'), 'm');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#board .primary')).backgroundColor), 'rgb(27, 110, 102)');
    assert.equal(await page.locator('.grip:visible').count(), 0, 'pas de poignée en utilisation normale');
    assert.equal(await page.isVisible('#custom'), false);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Configuration abîmée : on retombe sur les valeurs par défaut, sans rien casser.
  {
    const { page, errors, context } = await openBoard(browser, base, desk, few({ accent: 'rose', sizes: { taches: 'xl', notes: 's', inconnu: 'l', heure: null } }));
    assert.equal(await page.evaluate(() => document.documentElement.dataset.accent), 'vert');
    assert.equal(await page.locator('[data-widget=taches]').getAttribute('data-size'), 'm');
    assert.equal(await page.locator('[data-widget=notes]').getAttribute('data-size'), 's');
    assert.equal(await page.locator('[data-widget=heure]').getAttribute('data-size'), 'm');
    assert.deepEqual(errors, []);
    await context.close();
    for (const sizes of ['cassé', 3, [1, 2], null]) {
      const r = await openBoard(browser, base, desk, few({ sizes }));
      assert.equal(await r.page.locator('[data-widget=taches]').getAttribute('data-size'), 'm');
      assert.deepEqual(r.errors, []);
      await r.context.close();
    }
  }

  // Les 14 widgets, dans les 3 tailles, aux 4 largeurs, avec et sans les commandes : rien ne déborde ni n'est coupé.
  for (const [width, height] of VIEWPORTS) for (const size of ['s', 'm', 'l']) {
    const sizes = Object.fromEntries(ALL_IDS.map(id => [id, size]));
    const { page, errors, context } = await openBoard(browser, base, { viewport: { width, height } }, everything({ wallpaper: 'lac', sizes }));
    for (const editing of [false, true]) {
      if (editing) await page.click('#open-custom');
      const problems = await page.evaluate(() => {
        const out = [];
        if (document.documentElement.scrollWidth > innerWidth) out.push(`page : ${document.documentElement.scrollWidth}`);
        for (const box of document.querySelectorAll('.widget')) {
          const o = box.getBoundingClientRect();
          for (const n of box.querySelectorAll('button,a,input,textarea,h2,p,.time,.broute,.boarding,label')) {
            const r = n.getBoundingClientRect();
            if (!r.width) continue;
            if (r.right > o.right + .5 || r.left < o.left - .5) out.push(`${box.dataset.widget} ${n.tagName}.${n.className} dépasse`);
          }
          const route = box.querySelector('.broute');
          if (route && route.scrollWidth > route.parentElement.clientWidth) out.push('ticket : route coupée');
          for (const b of box.querySelectorAll('button')) if (b.offsetWidth && b.scrollWidth > b.clientWidth + 1) out.push(`${box.dataset.widget} bouton coupé : ${b.textContent}`);
        }
        return out;
      });
      assert.deepEqual(problems, [], `${width} px, taille ${size}, commandes ${editing}`);
    }
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Sur ordinateur, les tailles changent vraiment l'espace et la disposition, pas la police.
  {
    const { page, db, context } = await openBoard(browser, base, desk, few());
    await page.click('#open-custom');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'custom-done');
    const sizeBtn = name => page.getByRole('group', { name: 'Taille de Tâches' }).getByRole('button', { name, exact: true });
    const w = () => page.locator('[data-widget=taches]').evaluate(b => b.offsetWidth);
    const columns = () => page.locator('[data-widget=taches] .rows').evaluate(n => getComputedStyle(n).gridTemplateColumns.split(' ').length);
    const font = () => page.locator('[data-widget=taches] .row span').first().evaluate(n => getComputedStyle(n).fontSize);
    const baseFont = await font();
    await sizeBtn('Petit').click();
    assert.equal(await w(), 263);
    await sizeBtn('Grand').click();
    assert.equal(await w(), 728);
    assert.equal(await columns(), 2);
    assert.equal(await font(), baseFont, 'la police ne grossit pas');
    assert.equal(await sizeBtn('Grand').getAttribute('aria-pressed'), 'true');
    await saved(page, 'Enregistré');
    assert.equal(db.rows.ecran.sizes.taches, 'l');
    assert.deepEqual(db.rows.taches, CONTENT.taches, 'le contenu des widgets n\'est pas touché');
    await page.click('#custom-done');
    assert.equal(await page.isVisible('.grip'), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'open-custom');
    await context.close();
  }

  // Souris : le widget tenu et sa destination se voient, rien n'est enregistré avant le lâcher, et tout revient au rechargement.
  {
    const { page, db, errors, context } = await openBoard(browser, base, desk, few({ sizes: { notes: 'l' } }));
    await page.click('#open-custom');
    await mouseDrag(page, 'taches', 'heure', false);
    assert.equal(await page.locator('.widget.lifted').count(), 1);
    assert.equal(await page.locator('.drop-slot').count(), 1);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.widget.lifted')).zIndex), '10');
    assert.equal(db.saves, 0, 'rien n\'est enregistré tant que le widget est tenu');
    assert.deepEqual(await order(page), SMALL, 'la page ne bouge pas pendant le geste');
    await page.mouse.up();
    assert.equal(await page.locator('.drop-slot').count(), 0);
    assert.equal(await page.locator('.widget.lifted').count(), 0);
    const moved = ['notes', 'heure', 'taches', 'minuteur'];
    assert.deepEqual(await order(page), moved);
    assert.deepEqual(await shown(page), moved, 'l\'ordre de lecture suit l\'ordre affiché');
    assert.equal(await page.locator('[data-widget=taches]').evaluate(b => b.style.transform + b.style.order), '');
    await saved(page, 'Enregistré');
    assert.deepEqual(db.rows.ecran.widgets, moved);
    await page.reload();
    await page.waitForSelector('#board .widget:not([hidden])');
    assert.deepEqual(await order(page), moved);
    assert.equal(await page.locator('#board [data-widget=notes]').getAttribute('data-size'), 'l');
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Le déplacement ne part que de la poignée : notes, tâches, curseurs et sélection de texte restent normaux.
  {
    const rows = { ...everything(), ecran: { wallpaper: 'blanc', widgets: ['notes', 'taches', 'ambiance', 'heure'], done: true } };
    const { page, db, context } = await openBoard(browser, base, desk, rows);
    await page.click('#open-custom');
    const before = await order(page);
    const notes = page.locator('.notes');
    const n = await notes.boundingBox();
    const [tx, ty] = await center(page.locator('[data-widget=taches]'));
    await page.mouse.move(n.x + 2, n.y + 10); await page.mouse.down(); await page.mouse.move(n.x + 120, n.y + 10, { steps: 3 }); await page.mouse.move(tx, ty, { steps: 3 });
    assert.equal(await page.locator('.widget.lifted').count(), 0, 'glisser dans les notes sélectionne du texte');
    await page.mouse.up();
    assert.ok(await page.evaluate(() => { const n = document.querySelector('.notes'); return n.selectionEnd > n.selectionStart; }), 'le texte est sélectionné');
    await notes.fill('Texte écrit en mode Personnaliser');
    await page.locator('[data-widget=taches] input[type=checkbox]').first().check();
    assert.ok(await page.locator('[data-widget=taches] input[type=checkbox]').first().isChecked());
    const range = page.locator('[data-widget=ambiance] input[type=range]').first();
    const r = await range.boundingBox();
    await page.mouse.move(r.x + r.width - 2, r.y + r.height / 2); await page.mouse.down(); await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2, { steps: 4 });
    assert.equal(await page.locator('.widget.lifted').count(), 0, 'régler un curseur ne déplace rien');
    await page.mouse.up();
    assert.ok(Number(await range.inputValue()) < 100);
    assert.deepEqual(await order(page), before);
    await saved(page, 'Enregistré');
    assert.equal(db.rows.notes.text, 'Texte écrit en mode Personnaliser');
    await context.close();
  }

  // Au doigt, sur écran tactile simulé : par la poignée seulement, défilement automatique, geste annulé par le système.
  for (const [width, height] of [[390, 844], [320, 568]]) {
    const options = { viewport: { width, height }, hasTouch: true, isMobile: true };
    const { page, db, context } = await openBoard(browser, base, options, few());
    const cdp = await context.newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y }] });
    await page.locator('#open-custom').tap();
    assert.equal(await page.isVisible('#custom-hint'), true, 'sur téléphone, on dit que la taille s\'applique sur grand écran');
    const [hx, hy] = await center(grip(page, 'taches'));
    assert.ok((await grip(page, 'taches').boundingBox()).height >= 44, 'poignée de 44 px au doigt');
    await touch('touchStart', hx, hy);
    await touch('touchMove', hx, hy + 12);
    assert.equal(await page.locator('.widget.lifted').count(), 1);
    // Le doigt reste en bas de l'écran : la page défile toute seule jusqu'aux widgets suivants.
    const top = await page.evaluate(() => scrollY);
    await touch('touchMove', hx, height - 10);
    await page.waitForFunction(y => scrollY > y + 200 && document.querySelector('[data-widget=taches]').style.order !== '0', top);
    await touch('touchEnd');
    await saved(page, 'Enregistré');
    assert.notDeepEqual(db.rows.ecran.widgets, SMALL);
    assert.deepEqual(await order(page), db.rows.ecran.widgets);
    assert.deepEqual(await shown(page), db.rows.ecran.widgets);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    // Geste interrompu par le système : tout reprend sa place, rien n'est enregistré.
    const saves = db.saves, kept = await order(page);
    const id = kept[1];
    const [ax, ay] = await center(grip(page, id));
    await touch('touchStart', ax, ay);
    await touch('touchMove', ax, ay + 300);
    await touch('touchCancel');
    assert.equal(await page.locator('.widget.lifted').count(), 0);
    assert.deepEqual(await order(page), kept);
    assert.equal(await page.locator(`[data-widget=${id}]`).evaluate(b => b.style.transform), '');
    assert.equal(db.saves, saves);
    // Ailleurs que sur la poignée, le doigt fait défiler la page normalement.
    const [bx, by] = await center(page.locator('[data-widget=heure] h2'));
    await touch('touchStart', bx, by);
    await touch('touchMove', bx, by - 60);
    assert.equal(await page.locator('.widget.lifted').count(), 0);
    await touch('touchEnd');
    await context.close();
  }

  // Clavier : boutons Avant et Après, flèches sur la poignée, focus conservé, position annoncée.
  {
    const { page, db, context } = await openBoard(browser, base, desk, few());
    await page.click('#open-custom');
    const after = page.getByRole('button', { name: 'Déplacer Tâches après le widget suivant' });
    const before = page.getByRole('button', { name: 'Déplacer Tâches avant le widget précédent' });
    assert.ok(await before.isDisabled(), 'le premier widget ne peut pas reculer');
    await after.focus();
    await page.keyboard.press('Enter');
    assert.deepEqual(await order(page), ['notes', 'taches', 'heure', 'minuteur']);
    assert.ok(await after.evaluate(n => n === document.activeElement), 'le focus reste sur le bouton');
    assert.equal(await page.textContent('#custom-live'), 'Tâches : position 2 sur 4');
    await grip(page, 'taches').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    assert.deepEqual(await order(page), ['notes', 'heure', 'minuteur', 'taches']);
    assert.ok(await grip(page, 'taches').evaluate(n => n === document.activeElement));
    await after.isDisabled();
    await before.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    assert.deepEqual(await order(page), SMALL);
    assert.ok(await after.evaluate(n => n === document.activeElement), 'arrivé au bout, le focus passe au bouton encore utilisable');
    await saved(page, 'Enregistré');
    assert.deepEqual(db.rows.ecran.widgets, SMALL);
    await context.close();
  }

  // Rien ne se réinitialise : texte en cours, minuteur lancé, lecteur de musique chargé.
  {
    const rows = { ...everything(), ecran: { wallpaper: 'blanc', widgets: ['playlist', 'minuteur', 'notes', 'taches'], done: true } };
    const { page, context } = await openBoard(browser, base, desk, rows);
    let loads = 0;
    page.on('request', r => { if (r.url().includes('open.spotify.com/embed')) loads++; });
    await page.getByRole('button', { name: 'Charger le lecteur' }).click();
    await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument === null);
    assert.equal(loads, 1);
    await page.locator('[data-widget=minuteur]').getByRole('button', { name: 'Démarrer' }).click();
    await page.fill('.notes', 'Pas encore enregistré');
    const clock = () => page.textContent('.focus-time');
    await page.waitForFunction(() => document.querySelector('.focus-time').textContent !== '25:00');
    const running = await clock();
    await page.click('#open-custom');
    await mouseDrag(page, 'taches', 'playlist');
    assert.equal((await order(page))[0], 'taches');
    await page.getByRole('button', { name: 'Déplacer Playlist après le widget suivant' }).click();
    await mouseDrag(page, 'playlist', 'notes');
    // Vers l'arrière aussi : c'est le sens où un déplacement direct recharge le lecteur.
    await page.getByRole('button', { name: 'Déplacer Playlist avant le widget précédent' }).click();
    await mouseDrag(page, 'playlist', 'taches');
    await page.getByRole('group', { name: 'Taille de Playlist' }).getByRole('button', { name: 'Grand' }).click();
    await page.getByRole('group', { name: 'Taille de Minuteur focus' }).getByRole('button', { name: 'Petit' }).click();
    await page.getByRole('group', { name: 'Taille de Notes' }).getByRole('button', { name: 'Grand' }).click();
    assert.deepEqual(await order(page), await shown(page));
    assert.equal(loads, 1, 'le lecteur n\'a jamais été rechargé');
    assert.equal(await page.locator('iframe').count(), 1);
    assert.equal(await page.inputValue('.notes'), 'Pas encore enregistré');
    assert.equal(await page.locator('[data-widget=minuteur]').getByRole('button', { name: 'Démarrer' }).count(), 0, 'le minuteur tourne encore');
    await page.waitForFunction(t => document.querySelector('.focus-time').textContent < t, running);
    await context.close();
  }

  // Un widget retiré puis remis retrouve sa taille et revient à la fin.
  {
    const { page, db, context } = await openBoard(browser, base, desk, few({ sizes: { notes: 'l' } }));
    await page.click('#open-add');
    await catClick(page, 'Retirer : Notes');
    await catClick(page, 'Ajouter : Notes');
    await page.locator('#add-dialog .primary').click();
    assert.deepEqual(await order(page), ['taches', 'heure', 'minuteur', 'notes']);
    assert.equal(await page.locator('#board [data-widget=notes]').getAttribute('data-size'), 'l');
    await saved(page, 'Enregistré');
    assert.equal(db.rows.ecran.sizes.notes, 'l');
    await page.click('#open-custom');
    assert.ok(await page.getByRole('button', { name: 'Déplacer Notes après le widget suivant' }).isDisabled());
    assert.ok(!await page.getByRole('button', { name: 'Déplacer Minuteur focus après le widget suivant' }).isDisabled());
    await context.close();
  }

  // Accents : lisibles, appliqués aux contrôles, enregistrés ; le rouge d'erreur et le logo ne changent pas.
  {
    const rows = { ...everything(), ecran: { wallpaper: 'blanc', widgets: ['taches', 'habitudes', 'minuteur', 'ambiance'], done: true } };
    const { page, db, context } = await openBoard(browser, base, desk, rows);
    await page.click('#open-custom');
    assert.equal(await page.textContent('#accent-name'), 'Vert');
    assert.equal(await page.locator('.swatch').count(), 5);
    const logo = () => page.locator('.mark rect').first().getAttribute('fill');
    const logoFill = await logo();
    const error = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--error').trim());
    const errorColor = await error();
    for (const name of ['Encre', 'Vert', 'Bleu', 'Prune', 'Terre cuite']) {
      await page.getByRole('button', { name, exact: true }).click();
      assert.equal(await page.textContent('#accent-name'), name);
      assert.equal(await page.getByRole('button', { name, exact: true }).getAttribute('aria-pressed'), 'true');
      const seen = await page.evaluate(() => {
        const css = (s, p) => getComputedStyle(document.querySelector(s))[p];
        return { accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), primary: css('#screen .primary', 'backgroundColor'), onPrimary: css('#screen .primary', 'color'), check: css('.row input', 'accentColor'), day: css('.days button[aria-pressed=true]', 'backgroundColor'), bar: css('.bar i', 'backgroundColor'), slider: css('.sound input', 'accentColor'), choice: css('.choices button[aria-pressed=true]', 'backgroundColor') };
      });
      const resolved = await page.evaluate(() => { const n = document.createElement('i'); n.style.color = 'var(--accent)'; document.body.append(n); const c = getComputedStyle(n).color; n.remove(); return c; });
      for (const key of ['primary', 'check', 'day', 'bar', 'slider', 'choice']) assert.equal(seen[key], resolved, `${name} : ${key}`);
      const rgb = resolved.match(/\d+/g).map(Number);
      assert.ok(contrast(rgb, [255, 255, 255]) >= 4.5, `${name} : texte blanc sur l'accent`);
      assert.equal(seen.onPrimary, 'rgb(255, 255, 255)');
      assert.equal(await logo(), logoFill);
      assert.equal(await error(), errorColor);
    }
    await saved(page, 'Enregistré');
    assert.equal(db.rows.ecran.accent, 'terre');
    await page.reload();
    await page.waitForSelector('#board .widget:not([hidden])');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.accent), 'terre');
    await context.close();
  }

  // Panne d'enregistrement : jamais de fausse réussite, et ça repart tout seul.
  {
    const { page, db, context } = await openBoard(browser, base, desk, few());
    await page.click('#open-custom');
    db.failSave = true;
    await page.getByRole('group', { name: 'Taille de Notes' }).getByRole('button', { name: 'Grand' }).click();
    await saved(page, 'Pas encore enregistré. Nouvel essai…');
    assert.ok(await page.locator('#saved').evaluate(n => n.classList.contains('bad')));
    assert.ok(await page.isVisible('#custom #saved'), 'l\'état reste visible dans la barre');
    assert.equal(db.rows.ecran.sizes, undefined);
    await page.click('#custom-done');
    assert.equal(await page.textContent('#saved'), 'Pas encore enregistré. Nouvel essai…', 'Terminer ne prétend pas avoir enregistré');
    assert.ok(await page.isVisible('.hello #saved'));
    db.failSave = false;
    await saved(page, 'Enregistré');
    assert.equal(db.rows.ecran.sizes.notes, 'l');
    await context.close();
  }

  // Mouvement réduit : plus aucune animation de déplacement ; sinon, une animation courte.
  for (const [reducedMotion, expected] of [['reduce', 0], ['no-preference', 1]]) {
    const { page, context } = await openBoard(browser, base, { ...desk, reducedMotion }, few());
    await page.click('#open-custom');
    await page.getByRole('button', { name: 'Déplacer Tâches après le widget suivant' }).click();
    const moving = await page.evaluate(() => document.getAnimations().filter(a => a.effect.getKeyframes().some(k => k.transform)).map(a => a.effect.getTiming().duration));
    assert.equal(Math.min(moving.length, 1), expected);
    if (expected) assert.ok(moving.every(d => d <= 200), 'animation courte');
    await context.close();
  }

  // Verre : contraste mesuré sur les vrais pixels, pour le gris secondaire et pour tous les accents.
  const SLATE = hex('#43454b');
  const ACCENTS = ['#17191c', '#1b6e66', '#1c5699', '#6e2a55', '#96401f'].map(hex);
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    for (const wall of ['lac', 'brume', 'loch', 'foret', 'dune', 'noire', 'blanche', 'detail']) {
      const custom = ['noire', 'blanche', 'detail'].includes(wall);
      const buffer = custom ? await photo(browser, wall) : null;
      const { page, context } = await openBoard(browser, base, { viewport: { width, height } }, few({ wallpaper: custom ? 'perso' : wall }), db => { db.photo = buffer; });
      await page.waitForFunction(() => document.body.classList.contains('has-wall'));
      await page.waitForTimeout(200);
      const dark = await darkestGlass(page);
      assert.ok(contrast(SLATE, dark) >= 4.5, `${wall} à ${width} px : gris secondaire ${contrast(SLATE, dark).toFixed(2)}, fond ${dark}`);
      for (const a of ACCENTS) assert.ok(contrast(a, dark) >= 3, `${wall} à ${width} px : accent ${a} ${contrast(a, dark).toFixed(2)}, fond ${dark}`);
      if (wall === 'noire' || wall === 'detail') {
        const sharp = await page.locator('.widget h2').first().evaluate(n => getComputedStyle(n).filter + getComputedStyle(n).backdropFilter);
        assert.equal(sharp, 'nonenone', 'le texte n\'est pas flouté');
      }
      await context.close();
    }
  }
  // Navigateur sans flou : la surface de secours est prévue et assez opaque.
  {
    const { page, context } = await openBoard(browser, base, desk, few({ wallpaper: 'lac' }));
    const rule = await page.evaluate(() => [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } }).find(r => r instanceof CSSSupportsRule && r.conditionText.includes('backdrop-filter'))?.cssText);
    assert.match(rule, /--glass-wall: var\(--glass-solid\)/);
    assert.ok(Number((await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--glass-solid'))).match(/[\d.]+\)/)[0].slice(0, -1)) >= .9);
    await context.close();
  }

  // Pages : créer, ranger, renommer, retrouver au rechargement ; le premier écran reste inchangé.
  {
    const tabs = page => page.$$eval('#page-tabs button', b => b.map(n => n.textContent));
    const visible = page => page.$$eval('#board > .widget:not([hidden])', b => b.map(n => n.dataset.widget));
    const moveTo = (page, id, name) => page.locator(`#board [data-widget=${id}] select`).selectOption({ label: name });
    const { page, db, errors, context } = await openBoard(browser, base, desk, { ...few(), notes: { text: 'Mon texte précieux' } });
    assert.equal(await page.isVisible('#page-bar'), false, 'une seule page : aucune barre en utilisation normale');
    await page.click('#open-custom');
    assert.equal(await page.isVisible('#page-delete'), false, 'on ne peut pas supprimer la dernière page');
    assert.equal(await page.locator('#board [data-widget=notes] select').isVisible(), false);
    // Création : nom vide = nom proposé ; un nom piégé reste du texte.
    await page.click('#page-new');
    await page.keyboard.press('Enter');
    assert.deepEqual(await tabs(page), ['Mon écran', 'Page 2']);
    assert.deepEqual(await visible(page), [], 'la nouvelle page est vide');
    assert.match(await page.textContent('#board-empty'), /Cette page est vide/);
    assert.ok(await page.locator('#page-tabs [aria-pressed=true]').evaluate(n => n === document.activeElement));
    await page.click('#page-rename');
    await page.fill('#page-dialog input', '<b>piège</b>');
    await page.keyboard.press('Enter');
    assert.deepEqual(await tabs(page), ['Mon écran', '<b>piège</b>'], 'un nom reste du texte');
    assert.equal(await page.locator('#page-tabs b').count(), 0);
    await page.click('#page-rename');
    await page.fill('#page-dialog input', 'x'.repeat(40));
    assert.equal((await page.inputValue('#page-dialog input')).length, 24, 'nom limité à 24 caractères');
    await page.fill('#page-dialog input', 'Détente');
    await page.keyboard.press('Enter');
    assert.deepEqual(await tabs(page), ['Mon écran', 'Détente']);
    // Ranger un widget : il quitte la page affichée, et son texte le suit.
    await page.getByRole('button', { name: 'Mon écran', exact: true }).click();
    await moveTo(page, 'notes', 'Détente');
    assert.deepEqual(await visible(page), ['taches', 'heure', 'minuteur']);
    assert.match(await page.textContent('#page-note'), /Notes est maintenant sur « Détente »/);
    // Avant/Après ne comptent que les widgets de la page affichée.
    assert.ok(await page.getByRole('button', { name: 'Déplacer Tâches avant le widget précédent' }).isDisabled());
    await page.getByRole('button', { name: 'Déplacer Tâches après le widget suivant' }).click();
    assert.deepEqual(await visible(page), ['heure', 'taches', 'minuteur']);
    assert.equal(await page.textContent('#custom-live'), 'Tâches : position 2 sur 3');
    await mouseDrag(page, 'minuteur', 'heure');
    assert.deepEqual(await visible(page), ['minuteur', 'heure', 'taches']);
    await page.click('#custom-done');
    assert.equal(await page.isVisible('#page-bar'), true, 'plusieurs pages : les onglets restent');
    assert.equal(await page.isVisible('#page-new'), false, 'créer une page reste dans Personnaliser');
    await page.getByRole('button', { name: 'Détente', exact: true }).click();
    assert.deepEqual(await visible(page), ['notes']);
    assert.equal(await page.inputValue('.notes'), 'Mon texte précieux');
    await saved(page, 'Enregistré');
    assert.deepEqual(db.rows.ecran.pages.map(p => p.name), ['Mon écran', 'Détente']);
    assert.deepEqual(db.rows.notes, { text: 'Mon texte précieux' }, 'ranger un widget ne touche pas à son contenu');
    // Rechargement : mêmes pages, même rangement, et on revient sur la dernière page ouverte.
    await page.reload();
    await page.waitForSelector('#board .widget:not([hidden])');
    assert.deepEqual(await tabs(page), ['Mon écran', 'Détente']);
    assert.deepEqual(await visible(page), ['notes']);
    await page.getByRole('button', { name: 'Mon écran', exact: true }).click();
    assert.deepEqual(await visible(page), ['minuteur', 'heure', 'taches']);
    // Le catalogue dit où est un widget ; ajouté, il arrive sur la page affichée.
    await page.click('#open-add');
    assert.match(await page.locator('#catalog li', { hasText: 'Notes' }).first().textContent(), /Sur la page « Détente »/);
    await catClick(page, 'Ajouter : Habitudes');
    await page.locator('#add-dialog .primary').click();
    assert.ok((await visible(page)).includes('habitudes'));
    // Supprimer une page : confirmation, puis ses widgets et leur contenu passent sur la voisine.
    await page.getByRole('button', { name: 'Détente', exact: true }).click();
    await page.click('#open-custom');
    await page.click('#page-delete');
    assert.match(await page.textContent('#page-dialog'), /1 widget et leur contenu passeront sur « Mon écran »/);
    await page.locator('#page-dialog').getByRole('button', { name: 'Annuler' }).click();
    assert.deepEqual(await tabs(page), ['Mon écran', 'Détente'], 'annuler ne supprime rien');
    await page.click('#page-delete');
    await page.locator('#page-dialog .primary').click();
    assert.deepEqual(await tabs(page), ['Mon écran']);
    assert.ok((await visible(page)).includes('notes'));
    assert.equal(await page.inputValue('.notes'), 'Mon texte précieux');
    await saved(page, 'Enregistré');
    assert.deepEqual(db.rows.notes, { text: 'Mon texte précieux' });
    assert.deepEqual(db.rows.ecran.pages.map(p => p.name), ['Mon écran']);
    // Limite de 6 pages.
    for (let i = 0; i < 5; i++) { await page.click('#page-new'); await page.keyboard.press('Enter'); }
    assert.ok(await page.isDisabled('#page-new'));
    assert.deepEqual(errors, []);
    await context.close();
  }
  // Supprimer la première page ne perd aucun widget, y compris ceux qui n'avaient jamais été rangés.
  {
    const pages = [{ id: 'a', name: 'Une' }, { id: 'b', name: 'Deux' }, { id: 'c', name: 'Trois' }];
    const { page, context } = await openBoard(browser, base, desk, few({ pages, where: { notes: 'b', heure: 'c' } }));
    await page.click('#open-custom');
    await page.click('#page-delete');
    await page.locator('#page-dialog .primary').click();
    const count = await page.$$eval('#page-tabs button', b => b.length);
    assert.equal(count, 2);
    const all = [];
    for (const name of ['Deux', 'Trois']) {
      await page.getByRole('button', { name, exact: true }).click();
      all.push(...await page.$$eval('#board > .widget:not([hidden])', b => b.map(n => n.dataset.widget)));
    }
    assert.deepEqual(all.sort(), [...SMALL].sort());
    await context.close();
  }
  // Configurations de pages abîmées : l'écran s'ouvre, aucun widget ne disparaît.
  for (const bad of [{ pages: 'cassé', where: 3 }, { pages: [null, { id: 1, name: 'x' }, { id: 'a', name: '   ' }], where: { notes: 'inconnue' } }, { pages: [{ id: 'a', name: 'Une' }, { id: 'a', name: 'Doublon' }], where: null }, { pages: [], where: [] }]) {
    const { page, errors, context } = await openBoard(browser, base, desk, few(bad));
    assert.deepEqual((await page.$$eval('#board > .widget:not([hidden])', b => b.map(n => n.dataset.widget))).sort(), [...SMALL].sort());
    assert.deepEqual(errors, []);
    await context.close();
  }
  // Changer de page ne coupe rien : lecteur non rechargé, minuteur qui continue.
  {
    const rows = { ...everything(), ecran: { wallpaper: 'blanc', widgets: ['playlist', 'minuteur', 'notes'], done: true, pages: [{ id: 'a', name: 'Une' }, { id: 'b', name: 'Deux' }], where: { notes: 'b' } } };
    const { page, context } = await openBoard(browser, base, desk, rows);
    let loads = 0;
    page.on('request', r => { if (r.url().includes('open.spotify.com/embed')) loads++; });
    await page.getByRole('button', { name: 'Charger le lecteur' }).click();
    await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument === null);
    await page.locator('[data-widget=minuteur]').getByRole('button', { name: 'Démarrer' }).click();
    await page.waitForFunction(() => document.querySelector('.focus-time').textContent !== '25:00');
    const before = await page.textContent('.focus-time');
    await page.getByRole('button', { name: 'Deux', exact: true }).click();
    assert.equal(await page.isVisible('[data-widget=minuteur]'), false);
    await page.waitForTimeout(2200);
    await page.getByRole('button', { name: 'Une', exact: true }).click();
    assert.ok(await page.textContent('.focus-time') < before, 'le minuteur a continué sur l\'autre page');
    assert.equal(loads, 1, 'le lecteur n\'a pas été rechargé');
    await page.click('#open-custom');
    await page.locator('#board [data-widget=playlist] select').selectOption({ label: 'Deux' });
    await page.getByRole('button', { name: 'Deux', exact: true }).click();
    assert.equal(await page.locator('[data-widget=playlist] iframe').isVisible(), true);
    assert.equal(loads, 1, 'ranger le lecteur sur une autre page ne le recharge pas');
    await context.close();
  }
  // Pages sur téléphone : beaucoup de pages aux noms longs, sans débordement de l'écran.
  for (const width of [320, 390, 768]) {
    const pages = ['Mon écran', 'Révisions de droit civil', 'Détente du soir', 'Sport', 'Lectures', 'Projets'].map((name, i) => ({ id: `p${i}`, name }));
    const { page, context } = await openBoard(browser, base, { viewport: { width, height: 800 } }, everything({ wallpaper: 'lac', pages, where: { notes: 'p1', vol: 'p1' } }));
    await page.click('#open-custom');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} px : pas de défilement de côté`);
    const select = await page.locator('#board [data-widget=taches] select').boundingBox();
    const box = await page.locator('#board [data-widget=taches]').boundingBox();
    assert.ok(select.x + select.width <= box.x + box.width);
    await page.locator('#page-tabs button').last().scrollIntoViewIfNeeded();
    await page.locator('#page-tabs button').last().click();
    assert.equal(await page.locator('#page-tabs button').last().getAttribute('aria-pressed'), 'true');
    await context.close();
  }

  // Captures et courte vidéo pour valider le rendu à l'œil.
  if (SHOTS) {
    const composition = {
      wallpaper: 'lac', accent: 'vert',
      widgets: ['vol', 'taches', 'heure', 'minuteur', 'compte', 'pause', 'notes', 'ambiance', 'habitudes'],
      sizes: { vol: 'l', heure: 's', minuteur: 's', compte: 's', pause: 's' },
    };
    const PAGES = [{ id: 'cours', name: 'Cours' }, { id: 'detente', name: 'Détente' }, { id: 'sport', name: 'Sport' }];
    const PAGE_WHERE = { ambiance: 'detente', pause: 'detente', habitudes: 'detente', notes: 'sport' };
    const full = async (page, name, width) => {
      await page.setViewportSize({ width, height: await page.evaluate(() => document.documentElement.scrollHeight) });
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
    };
    for (const [name, width, extra, editing] of [
      ['1440-lac-vert', 1440, {}, false],
      ['1440-lac-vert-personnaliser', 1440, {}, true],
      ['1440-foret-terre-cuite', 1440, { wallpaper: 'foret', accent: 'terre', sizes: { notes: 'l', heure: 's', vol: 's' }, widgets: ['notes', 'heure', 'vol', 'minuteur', 'taches', 'ambiance'] }, false],
      ['1440-blanc-encre', 1440, { wallpaper: 'blanc', accent: 'encre' }, false],
      ['768-dune-prune', 768, { wallpaper: 'dune', accent: 'prune' }, false],
      ['390-brume-bleu', 390, { wallpaper: 'brume', accent: 'bleu' }, false],
      ['390-brume-bleu-personnaliser', 390, { wallpaper: 'brume', accent: 'bleu' }, true],
      ['320-loch-terre-cuite', 320, { wallpaper: 'loch', accent: 'terre' }, true],
      ['pages-1440', 1440, { pages: PAGES, where: PAGE_WHERE }, false],
      ['pages-1440-personnaliser', 1440, { pages: PAGES, where: PAGE_WHERE }, true],
      ['pages-390', 390, { wallpaper: 'brume', accent: 'bleu', pages: PAGES, where: PAGE_WHERE }, false],
      ['pages-390-personnaliser', 390, { wallpaper: 'brume', accent: 'bleu', pages: PAGES, where: PAGE_WHERE }, true],
    ]) {
      const { page, context } = await openBoard(browser, base, { viewport: { width, height: 900 } }, { ...everything(), ecran: { ...composition, done: true, ...extra } });
      if (editing) await page.click('#open-custom');
      await full(page, name, width);
      await context.close();
    }
    const video = { dir: SHOTS, size: { width: 1280, height: 800 } };
    const { page, context } = await openBoard(browser, base, { viewport: video.size, recordVideo: video }, { ...everything(), ecran: { wallpaper: 'lac', accent: 'vert', widgets: ['taches', 'heure', 'minuteur', 'notes', 'compte', 'pause'], done: true } });
    await page.waitForTimeout(600);
    await page.click('#open-custom');
    await page.waitForTimeout(600);
    await mouseDrag(page, 'taches', 'minuteur', false);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, '1280-glisser-en-cours.png') });
    await page.mouse.up();
    await page.waitForTimeout(700);
    await page.getByRole('group', { name: 'Taille de Minuteur focus' }).getByRole('button', { name: 'Grand' }).click();
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Bleu', exact: true }).click();
    await page.waitForTimeout(700);
    await page.click('#custom-done');
    await page.waitForTimeout(900);
    const file = await page.video().path();
    await context.close();
    fs.renameSync(file, path.join(SHOTS, 'deplacement-widgets.webm'));
  }

  await browser.close();
  server.close();
  console.log('personnalisation : tous les parcours passent');
})().catch(e => { console.error(e); process.exit(1); });
