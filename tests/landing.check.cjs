// Vérifie la landing du prototype (site/prototype.html) dans un vrai Chromium : argumentaire, séquence « éparpillés → réunis »,
// démonstrations existantes, scène du vol, clavier, tactile simulé, sans JavaScript et à mouvement réduit.
// Lancement : NODE_PATH=<dossier node_modules contenant playwright> node tests/landing.check.cjs [dossier-captures]
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', 'site');
const SHOTS = process.argv[2];
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
const NOTE = "Prototype de présentation : certaines fonctions illustrent l'expérience prévue et ne sont pas encore utilisables.";
const clean = t => t.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const WIDTHS = [[320, 640], [390, 844], [768, 1024], [1440, 900]];
const state = page => page.locator('#scatter').getAttribute('data-state');
const into = (page, sel) => page.evaluate(s => document.querySelector(s).scrollIntoView({ behavior: 'instant' }), sel);

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const open = async (options, url = 'prototype.html') => {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.goto(`${base}/${url}`);
    await page.waitForLoadState('networkidle');
    return { context, page, errors };
  };

  // Le premier écran répond aux quatre questions, à toutes les largeurs, sans débordement.
  for (const [width, height] of WIDTHS) {
    const { context, page, errors } = await open({ viewport: { width, height } });
    assert.equal(clean(await page.textContent('h1')), 'Tes outils, au même endroit');
    const lines = await page.locator('h1').evaluate(n => Math.round(n.getBoundingClientRect().height / parseFloat(getComputedStyle(n).lineHeight)));
    assert.ok(lines <= 2, `${width} px : titre sur ${lines} lignes`);
    assert.match(clean(await page.textContent('.hero .intro')), /tâches, notes, minuteur et musique/);
    assert.ok(await page.locator('.hero').getByRole('link', { name: 'Créer mon espace' }).isVisible());
    assert.ok(await page.locator('.hero').getByRole('link', { name: 'Voir la démo' }).isVisible());
    assert.equal(clean(await page.textContent('.proto-note')), NOTE);
    const note = await page.locator('.proto-note').boundingBox();
    assert.ok(note.y === 0 && note.height >= 30, 'la mention est le premier élément visible');
    const stage = await page.locator('#heroStage').boundingBox();
    assert.ok(stage.y < height, `${width} px : l'aperçu commence dans le premier écran (${stage.y})`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} px : pas de défilement de côté`);
    // Tous les titres de section tiennent sur deux lignes.
    const long = await page.$$eval('main h2', hs => hs.filter(h => h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight) > 2.2).map(h => h.textContent));
    assert.deepEqual(long, [], `${width} px`);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Les mots : une seule action principale, plus de badges du futur, aucune promesse interdite.
  {
    const { context, page } = await open({ viewport: { width: 1440, height: 900 } });
    const text = clean(await page.textContent('body'));
    const labels = await page.$$eval('.btn-primary', b => [...new Set(b.map(n => n.textContent.trim()))]);
    assert.deepEqual(labels, ['Créer mon espace']);
    for (const old of ['Essayer Renzvi', 'Essayer le prototype', 'Voir comment ça marche']) assert.ok(!text.includes(old), old);
    assert.equal(await page.locator('.tag-soon').count(), 0, 'plus de badge Bientôt, Idée ou Plus tard');
    assert.equal(await page.locator('.w-t .tag').count(), 0);
    for (const bad of [/déjà disponible/i, /illimité/i, /verrouill/i, /bloque ton téléphone/i, /économis/i, /remplace (toutes|tes)/i, /\d+\s*%/, /témoign/i]) assert.doesNotMatch(text, bad);
    assert.equal((text.match(/Prototype de présentation/g) || []).length, 2, 'en haut et en bas de page');
    // Offres : montants conservés, rien à acheter.
    for (const price of ['7,90 €', '76 € TTC par an', '15,90 €', '153 € TTC par an', '0 €']) assert.ok(text.includes(price), price);
    assert.match(text, /aucun paiement n'est disponible dans ce prototype/);
    assert.equal(await page.locator('.plan a[href*=whop], .plan button').count(), 0);
    await page.locator('#billing button', { hasText: 'Annuel' }).click();
    await page.waitForFunction(() => document.querySelector('[data-price=pro] b').textContent.includes('76'));
    assert.match(clean(await page.textContent('[data-sub=ia]')), /153 € par an/);
    // Le vol ne promet jamais de verrouiller le téléphone.
    assert.match(clean(await page.textContent('#questions')), /Il ne bloque ni ton téléphone ni tes applis/);
    await context.close();
  }

  // La séquence : mêmes contenus avant et après ; automatique une fois, puis à la main, au clavier et sans recharger d'image.
  {
    const { context, page, errors } = await open({ viewport: { width: 1440, height: 900 } });
    const texts = sel => page.$$eval(sel, ws => Object.fromEntries(ws.map(w => [w.dataset.k, (w.querySelector('.tasks, .note-text, .track')?.textContent ?? w.querySelector('[data-timer]').dataset.timer ?? '').replace(/\s+/g, ' ').trim()])));
    assert.deepEqual(await texts('.win'), await texts('.sc-board .w'), 'les contenus sont identiques avant et après');
    assert.equal((await page.$$('.win')).length, 4);
    assert.equal(await state(page), 'apart');
    await into(page, '#scatter');
    await page.waitForFunction(() => document.getAnimations().some(a => a.effect.target?.classList?.contains('win')), null, { timeout: 4000 });
    await page.waitForFunction(() => document.getElementById('scatter').dataset.state === 'together', null, { timeout: 5000 });
    assert.ok(await page.evaluate(() => document.getAnimations().some(a => a.effect.target?.matches?.('.sc-board .w'))), 'les widgets partent des fenêtres');
    assert.match(await page.textContent('#scatterCap'), /Réunis/);
    assert.equal(await page.isVisible('.sc-board .w[data-k=playlist]'), true);
    assert.equal(await page.isVisible('.win[data-k=taches]'), false);
    const apart = page.locator('#scatterSeg button', { hasText: 'Éparpillés' });
    await apart.focus();
    await page.keyboard.press('Enter');
    assert.equal(await state(page), 'apart');
    assert.equal(await apart.getAttribute('aria-pressed'), 'true');
    await page.waitForTimeout(3200);
    assert.equal(await state(page), 'apart', 'choisir à la main arrête le lancement automatique');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    assert.equal(await state(page), 'together');
    await page.waitForTimeout(1400);
    assert.deepEqual(await page.evaluate(() => document.getElementById('scatter').querySelector('.sc-board .w').style.transform), '');
    await page.getByRole('link', { name: 'Composer le mien' }).click();
    await page.waitForTimeout(300);
    assert.match(page.url(), /#composer$/);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Le choix du visiteur tient : choisir avant que la scène soit à l'écran annule le lancement automatique.
  {
    const { context, page } = await open({ viewport: { width: 1440, height: 900 } });
    assert.ok(await page.evaluate(() => document.getElementById('scatter').getBoundingClientRect().top > innerHeight), 'la scène est encore hors de l écran');
    await page.evaluate(() => document.querySelector('#scatterSeg [data-state=together]').click());
    assert.equal(await state(page), 'together');
    await into(page, '#scatter');
    await page.waitForTimeout(1200);
    assert.equal(await state(page), 'together', 'le lancement automatique ne passe pas après un choix');
    assert.equal(await page.isVisible('.sc-board .w[data-k=taches]'), true);
    await context.close();
  }

  // Tactile simulé, à chaque largeur de téléphone : les boutons répondent et les quatre outils sont visibles.
  for (const [width, height] of [[390, 844], [320, 640]]) {
    const { context, page } = await open({ viewport: { width, height }, hasTouch: true, isMobile: true });
    await into(page, '#scatterSeg');
    await page.locator('#scatterSeg button', { hasText: 'Réunis' }).tap();
    assert.equal(await state(page), 'together');
    await page.waitForTimeout(1300);
    for (const k of ['taches', 'minuteur', 'notes', 'playlist']) {
      const b = await page.locator(`.sc-board .w[data-k=${k}]`).boundingBox();
      const s = await page.locator('.sc-board').boundingBox();
      assert.ok(b && b.width > 40 && b.y + b.height <= s.y + s.height + 1 && b.x + b.width <= s.x + s.width + 1, `${width} px : ${k} entier`);
    }
    assert.equal(await page.$$eval('#composeGrid .w', w => w.filter(n => n.offsetWidth).length), 4, `${width} px : le compteur de Composer dit vrai`);
    await page.locator('#scatterSeg button', { hasText: 'Éparpillés' }).tap();
    assert.equal(await state(page), 'apart');
    await page.waitForTimeout(1300);
    for (const k of ['taches', 'notes', 'minuteur', 'playlist']) {
      const b = await page.locator(`.win[data-k=${k}]`).boundingBox();
      const s = await page.locator('.sc-desk').boundingBox();
      assert.ok(b.x >= s.x - 1 && b.x + b.width <= s.x + s.width + 1 && b.y + b.height <= s.y + s.height + 1, `${width} px : fenêtre ${k} dans la scène`);
    }
    await context.close();
  }

  // Mouvement réduit : avant et après visibles ensemble, aucune animation, aucun bouton inutile.
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const { context, page, errors } = await open({ viewport: { width, height }, reducedMotion: 'reduce' });
    assert.equal(await page.isVisible('.sc-desk'), true);
    assert.equal(await page.isVisible('.sc-board'), true);
    assert.equal(await page.isVisible('#scatterSeg'), false);
    assert.equal(await page.locator('.is-stage').count(), 0);
    assert.match(clean(await page.locator('.sc-before .sc-cap').textContent()), /Éparpillés/);
    assert.match(clean(await page.locator('.sc-after .sc-cap').textContent()), /Réunis/);
    await into(page, '#scatter');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.effect.target?.closest?.('#scatter')).length), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Sans JavaScript : le message reste complet, avant et après compris.
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${base}/prototype.html`);
    assert.equal(await page.isVisible('h1'), true);
    assert.equal(await page.isVisible('.proto-note'), true);
    for (const sel of ['.sc-desk', '.sc-board', '.win[data-k=playlist]', '.sc-board .w[data-k=playlist]', '#t-offres', '#t-faq']) assert.equal(await page.isVisible(sel), true, sel);
    assert.equal(await page.isVisible('#scatterSeg'), false);
    assert.match(await page.locator('.sc-desk .tasks').textContent(), /Relire le chapitre 4/);
    assert.equal(await page.isVisible('a[href="login.html"]'), true);
    await context.close();
  }

  // Les fonds choisis par Damien, et plus aucun des anciens, dans toutes les illustrations.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const loaded = [];
    page.on('request', r => { if (r.url().includes('/landing/')) loaded.push(r.url().split('/landing/')[1]); });
    await page.goto(`${base}/prototype.html`);
    await page.waitForLoadState('networkidle');
    await page.locator('#modeSeg button', { hasText: 'Chill' }).click();
    await page.locator('.pick', { hasText: "Tableau d'inspiration" }).click();
    await page.waitForFunction(() => document.querySelector('#heroStage .wall[data-w=nuages]')?.style.opacity === '1', null, { timeout: 12000 });
    await page.waitForLoadState('networkidle');
    for (const old of ['prairie', 'trou', 'nuit.webp']) assert.equal(loaded.filter(f => f.startsWith(old)).length, 0, `${old} ne doit plus être chargé`);
    for (const fresh of ['santorin.webp', 'nuages.webp', 'santorin-160.webp']) assert.ok(loaded.includes(fresh), fresh);
    assert.match(await page.locator('#heroStage').getAttribute('aria-label'), /Santorin/);
    assert.doesNotMatch(await page.content(), /prairie peinte|passe à La Nuit/);
    await context.close();
  }

  // Les démonstrations existantes marchent toujours.
  {
    const { context, page, errors } = await open({ viewport: { width: 1440, height: 1000 } });
    // Premier écran : le dashboard se compose, le widget Ambiance s'ajoute, puis le fond change.
    await page.waitForFunction(() => document.querySelector('#heroGrid [data-key=ambiance]'), null, { timeout: 9000 });
    await page.waitForFunction(() => { const w = [...document.querySelectorAll('#heroStage .wall')].find(n => n.dataset.w === 'nuages'); return w && w.style.opacity === '1'; }, null, { timeout: 8000 });
    await page.waitForSelector('#heroReplay:not([hidden])', { timeout: 3000 });
    // Composer : les outils de départ sont ceux de la séquence, ajouter et mettre en grand.
    await into(page, '#composer');
    const keys = () => page.$$eval('#composeGrid > .w:not(.is-leaving)', w => w.map(n => n.dataset.key));
    assert.deepEqual((await keys()).sort(), ['minuteur', 'notes', 'playlist', 'taches']);
    await page.locator('#chips button', { hasText: 'Heure' }).click();
    assert.equal((await keys())[0], 'heure');
    const before = (await page.locator('#composeGrid [data-key=taches]').boundingBox()).width;
    await page.locator('#placeSeg button', { hasText: 'Tâches en grand' }).click();
    await page.waitForTimeout(650);
    assert.ok((await page.locator('#composeGrid [data-key=taches]').boundingBox()).width > before * 1.5, 'les tâches prennent plus de place');
    await page.locator('#chips button', { hasText: 'Tâches' }).click();
    assert.ok(await page.locator('#placeSeg button', { hasText: 'Tâches en grand' }).isDisabled());
    assert.deepEqual(await page.$$eval('#swatches button', b => b.map(n => n.textContent.trim())), ['Santorin', 'Nuages', 'Chat', 'Blanc']);
    await page.locator('#swatches button', { hasText: 'Chat' }).click();
    await page.waitForFunction(() => /fond Chat/.test(document.getElementById('composeState').textContent));
    // Study et Chill : deux compositions différentes, le cours au centre de Study.
    await into(page, '#modes');
    assert.equal(await page.locator('#modeSeg button').count(), 2);
    assert.equal(await page.locator('#modeGrid .w').first().getAttribute('data-key'), 'cahier');
    assert.match(await page.textContent('#modeGrid'), /Flashcards/);
    await page.locator('#modeSeg button', { hasText: 'Chill' }).click();
    await page.waitForTimeout(350);
    const chill = await page.$$eval('#modeGrid > .w:not(.is-leaving)', w => w.map(n => n.dataset.key));
    assert.ok(chill.includes('playlist') && chill.includes('ambiance') && chill.includes('lecture') && chill.includes('respiration') && !chill.includes('cahier'));
    assert.match(await page.textContent('#modeCaption'), /Chill/);
    // Catalogue : quatre usages, quatorze widgets.
    assert.equal(await page.locator('.lib-group').count(), 4);
    assert.equal(await page.locator('.pick').count(), 14);
    assert.equal(new Set(await page.$$eval('.pick', b => b.map(n => n.dataset.id))).size, 14);
    await page.locator('.pick', { hasText: 'Playlist' }).click();
    assert.match(await page.textContent('#libDesc'), /Spotify ou YouTube/);
    // Questions.
    await page.locator('summary', { hasText: 'remplace mes applis' }).click();
    assert.match(await page.textContent('#questions'), /Tes applis plus complètes restent là/);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Le vol, entier : sombre, ticket, déchirure, hublot, défilement, retour au clair. Le code du vol n'a pas changé.
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const { context, page, errors } = await open({ viewport: { width, height } });
    await into(page, '#vol');
    await page.waitForTimeout(700);
    assert.equal(await page.locator('#vol').getAttribute('data-dark'), '');
    assert.match(await page.textContent('#t-vol'), /Concentre-toi sans quitter ton espace/);
    assert.equal(await page.isVisible('#lkTicket'), true);
    await page.waitForSelector('#lkGo:not([hidden])');
    await page.locator('#lkDurations button', { hasText: '50 min' }).click();
    await page.locator('#lkGo').click();
    assert.equal(await page.textContent('#lkNote'), 'Décollage…');
    await page.waitForSelector('#plHud:not([hidden])', { timeout: 9000 });
    assert.match(await page.textContent('#lkClock'), /^\d/);
    await page.waitForFunction(() => /Démonstration\s: vol vers/.test(document.getElementById('lkNote').textContent), null, { timeout: 9000 });
    await page.locator('#lkQuit').click();
    await page.waitForFunction(() => /Démonstration\s: aucune séance/.test(document.getElementById('lkNote').textContent), null, { timeout: 5000 });
    // Le fond revient au clair après la scène.
    await into(page, '#widgets');
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(246, 245, 244)');
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Navigation au clavier : tout le chemin principal est atteignable.
  {
    const { context, page } = await open({ viewport: { width: 1440, height: 900 } });
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'skip');
    const seen = new Set();
    for (let i = 0; i < 50; i++) { await page.keyboard.press('Tab'); seen.add(await page.evaluate(() => document.activeElement.textContent.trim().slice(0, 30))); }
    for (const name of ['Créer mon espace', 'Voir la démo', 'Éparpillés', 'Réunis', 'Composer le mien', 'Même place']) assert.ok(seen.has(name), name);
    await context.close();
  }

  // L'accueil actuel ne bouge pas, tant que la nouvelle version n'est pas validée.
  {
    const { context, page, errors } = await open({ viewport: { width: 1440, height: 900 } }, '');
    assert.equal(clean(await page.textContent('h1')), 'Ton espace.Pour chaque moment.');
    assert.equal(await page.locator('.proto-note').count(), 0);
    assert.equal(await page.locator('#modeSeg button').count(), 3);
    assert.ok(await page.locator('#modeGrid .w').first().getAttribute('data-key') === 'vol');
    assert.equal(await page.locator('.lib-group').count(), 3);
    assert.equal(await page.locator('.soon-list li').count(), 6);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Captures et vidéo pour valider le rendu à l'œil.
  if (SHOTS) {
    for (const [width, height] of WIDTHS) {
      const { context, page } = await open({ viewport: { width, height } });
      // On parcourt la page pour déclencher les apparitions, puis on la capture entière.
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < total; y += Math.round(height * .6)) { await page.evaluate(v => scrollTo({ top: v, behavior: 'instant' }), y); await page.waitForTimeout(120); }
      await page.evaluate(() => { scrollTo({ top: 0, behavior: 'instant' }); document.querySelectorAll('.reveal').forEach(n => n.classList.add('in')); });
      await page.waitForTimeout(3500);
      await page.screenshot({ path: path.join(SHOTS, `apres-${width}-page-entiere.png`), fullPage: true });
      await context.close();
    }
    for (const [width, height] of WIDTHS) {
      const { context, page } = await open({ viewport: { width, height } }, '');
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < total; y += Math.round(height * .6)) { await page.evaluate(v => scrollTo({ top: v, behavior: 'instant' }), y); await page.waitForTimeout(120); }
      await page.evaluate(() => { scrollTo({ top: 0, behavior: 'instant' }); document.querySelectorAll('.reveal').forEach(n => n.classList.add('in')); });
      await page.waitForTimeout(3500);
      await page.screenshot({ path: path.join(SHOTS, `avant-${width}-page-entiere.png`), fullPage: true });
      await context.close();
    }
    for (const [name, viewport] of [['sequence-ordinateur', { width: 1280, height: 800 }], ['sequence-telephone', { width: 390, height: 844 }]]) {
      const context = await browser.newContext({ viewport, recordVideo: { dir: SHOTS, size: viewport } });
      const page = await context.newPage();
      await page.goto(`${base}/prototype.html`);
      await page.waitForTimeout(500);
      await page.evaluate(() => { const s = document.querySelector('#scatterSeg'); scrollTo({ top: s.getBoundingClientRect().top + scrollY - 90, behavior: 'smooth' }); });
      await page.waitForTimeout(6500);
      await page.locator('#scatterSeg button', { hasText: 'Éparpillés' }).click();
      await page.waitForTimeout(1800);
      await page.locator('#scatterSeg button', { hasText: 'Réunis' }).click();
      await page.waitForTimeout(2000);
      const file = await page.video().path();
      await context.close();
      fs.renameSync(file, path.join(SHOTS, `${name}.webm`));
    }
    for (const [name, options] of [['mouvement-reduit-1440', { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }], ['sans-javascript-390', { viewport: { width: 390, height: 844 }, javaScriptEnabled: false }]]) {
      const context = await browser.newContext(options);
      const page = await context.newPage();
      await page.goto(`${base}/prototype.html`);
      await page.waitForTimeout(800);
      await page.locator('#reunir').screenshot({ path: path.join(SHOTS, `${name}.png`) });
      await context.close();
    }
  }

  await browser.close();
  server.close();
  console.log('landing : tous les parcours passent');
})().catch(e => { console.error(e); process.exit(1); });
