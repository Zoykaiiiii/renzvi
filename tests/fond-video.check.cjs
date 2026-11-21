// Fond d'écran en vidéo (site/dashboard.html, Personnaliser → Fond → « Ta vidéo »), dans un vrai Chromium, sur le serveur
// de démo (Supabase simulé). Gratuit : le cadenas ouvre les plans, rien n'est envoyé. Pro : une vraie vidéo WebM (fabriquée
// par le navigateur) part dans « fonds-video », tourne en boucle sans son derrière les widgets, revient au rechargement,
// reste figée si on a réduit les animations, et le fichier est supprimé quand plus aucun mode ne l'utilise.
// Refus : mauvais type, trop lourde, illisible (rien n'est envoyé).
// Lancement : NODE_PATH=~/pw/node_modules node tests/fond-video.check.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');
const { custom, closeCustom } = require('./menu.cjs');

(async () => {
  const srv = await start();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  const open = async (bac, plan, opts = {}) => {
    if (plan) srv.bac('plein', bac).abonnement = { plan, statut: 'actif', fin: null };
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${srv.url}/dashboard.html?profil=plein&bac=${bac}${opts.videoXL ? '&videoXL' : ''}`);
    await page.waitForSelector('#board .widget:not([hidden])');
    if (plan) await page.waitForFunction(() => document.getElementById('plan-nom').textContent !== 'Gratuit');
    return { page, context };
  };
  const files = bac => srv.bac('plein', bac).files;
  const ecran = bac => srv.bac('plein', bac).rows.ecran;
  const usesVideo = bac => { const e = ecran(bac); return [e.wallpaper, ...(e.pages ?? []).map(p => p.wall)].includes('video'); };
  const tile = page => page.locator('#wall-slot .tile[data-wall=video]');
  const note = page => page.locator('#wall-slot .pick-note');
  const choose = async (page, file) => {
    const chooser = page.waitForEvent('filechooser');
    await tile(page).click();
    await (await chooser).setFiles(file);
  };

  // Une vraie vidéo WebM de deux secondes, enregistrée depuis un canevas qui change de couleur.
  const maker = await (await browser.newContext()).newPage();
  const webm = Buffer.from(await maker.evaluate(async () => {
    const c = Object.assign(document.createElement('canvas'), { width: 160, height: 90 });
    const g = c.getContext('2d');
    const rec = new MediaRecorder(c.captureStream(20), { mimeType: 'video/webm' });
    const parts = [];
    rec.ondataavailable = e => parts.push(e.data);
    let i = 0;
    const tick = setInterval(() => { g.fillStyle = `hsl(${i++ * 12},60%,45%)`; g.fillRect(0, 0, 160, 90); }, 50);
    rec.start();
    await new Promise(r => setTimeout(r, 2000));
    rec.stop();
    await new Promise(r => { rec.onstop = r; });
    clearInterval(tick);
    return [...new Uint8Array(await new Blob(parts).arrayBuffer())];
  }));
  assert.ok(webm.length > 1000, 'la vidéo de test existe');
  const video = { name: 'boucle.webm', mimeType: 'video/webm', buffer: webm };

  try {
    // 1. Gratuit : la tuile ouvre les plans, aucun fichier envoyé.
    {
      const { page, context } = await open('gratuit');
      await custom(page);
      const hint = page.locator('#wall-video-hint');
      assert.ok(await hint.isVisible());
      assert.match(await hint.textContent(), /MP4, WebM ou MOV, 20 Mo maximum/);
      assert.equal(await tile(page).getAttribute('aria-describedby'), 'wall-video-hint');
      assert.equal(await tile(page).getAttribute('title'), null);
      await tile(page).click();
      await page.waitForSelector('#paywall[open]');
      assert.match(await page.textContent('#pw-why'), /^Ton fond d’écran en vidéo fait partie de Pro/);
      assert.equal(files('gratuit').size, 0);
      await context.close();
    }

    // 2. Pro : refus avant tout envoi (type, poids, fichier illisible).
    {
      const { page, context } = await open('refus', 'pro');
      await custom(page);
      await choose(page, { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('bonjour') });
      await assert.doesNotReject(note(page).getByText('Choisis une vidéo MP4, WebM ou MOV.').waitFor());
      await choose(page, { name: 'lourde.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(20 * 1048576 + 1) });
      await note(page).getByText(/trop lourde \(20 Mo maximum\)/).waitFor();
      await choose(page, { name: 'cassee.webm', mimeType: 'video/webm', buffer: Buffer.from('pas une vidéo') });
      await note(page).getByText(/ne sait pas lire cette vidéo/).waitFor({ timeout: 20000 });
      assert.equal(files('refus').size, 0, 'rien n’est envoyé');
      assert.equal(await tile(page).locator('span').textContent(), 'Ta vidéo');
      assert.equal(await tile(page).isDisabled(), false);
      await context.close();
    }

    // 3. Pro : envoi, boucle sans son derrière les widgets, aperçu dans la tuile, zoom du fond désactivé.
    {
      const { page, context } = await open('pro', 'pro');
      await custom(page);
      await choose(page, video);
      await page.waitForFunction(() => { const v = document.querySelector('#wall i.on video'); return v && !v.paused && v.currentTime > 0; }, null, { timeout: 15000 });
      const v = await page.locator('#wall i.on video').evaluate(v => ({ muted: v.muted, loop: v.loop, inline: v.playsInline, w: v.getBoundingClientRect().width, h: v.getBoundingClientRect().height }));
      assert.deepEqual(v, { muted: true, loop: true, inline: true, w: 1440, h: 900 }, 'plein écran, en boucle, sans son');
      assert.equal(await page.evaluate(() => document.body.classList.contains('has-wall')), true, 'le verre passe en mode photo');
      const stored = files('pro').get('fonds-video/demo-plein-pro/fond');
      assert.ok(stored, 'fichier rangé dans fonds-video/<compte>/fond');
      assert.equal(stored.type, 'video/webm', 'le bucket vérifie ce type');
      assert.ok(stored.data.equals(webm), 'envoyée telle quelle');
      await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
      assert.equal(usesVideo('pro'), true, 'le choix est enregistré');
      assert.equal(await tile(page).getAttribute('aria-pressed'), 'true');
      assert.equal(await tile(page).locator('video').count(), 1, 'aperçu dans la tuile');
      assert.equal(await page.locator('#wall-slot .islider').evaluate(n => n.classList.contains('off')), true, 'zoom du fond désactivé');
      if (process.env.SHOTS) { await closeCustom(page); await page.screenshot({ path: `${process.env.SHOTS}/fond-video.png` }); await custom(page); }

      // Onglet caché : la vidéo s'arrête ; revenu : elle repart.
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
      assert.equal(await page.locator('#wall i.on video').evaluate(v => v.paused), true, 'pause onglet caché');
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForFunction(() => !document.querySelector('#wall i.on video').paused);

      // Rechargement : la vidéo revient depuis le stockage.
      await page.reload();
      await page.waitForFunction(() => { const v = document.querySelector('#wall i.on video'); return v && !v.paused && v.src.startsWith('blob:'); }, null, { timeout: 15000 });

      // Retour à un fond photo : plus aucun mode ne l'utilise, le fichier est supprimé.
      await custom(page);
      await page.locator('#wall-slot .tile[data-wall=lac]').click();
      await page.waitForFunction(() => !document.querySelector('#wall video'), null, { timeout: 3000 });
      await new Promise(r => setTimeout(r, 300));
      assert.equal(files('pro').has('fonds-video/demo-plein-pro/fond'), false, 'fichier supprimé');
      assert.equal(await tile(page).locator('video').count(), 0);
      await context.close();
    }

    // 4. Animations réduites : la vidéo reste sur sa première image.
    {
      srv.bac('plein', 'calme').abonnement = { plan: 'pro', statut: 'actif', fin: null };
      const { page, context } = await open('calme', 'pro', { reduced: true });
      await custom(page);
      await choose(page, video);
      await page.waitForSelector('#wall i.on video');
      await page.waitForTimeout(800);
      assert.equal(await page.locator('#wall i.on video').evaluate(v => v.paused), true, 'figée');
      await context.close();
    }

    // Compte autorisé : relit son ancien fond, puis envoie sa nouvelle vidéo dans le bucket privé XL.
    {
      const old = 'fonds-video/demo-plein-xl/fond';
      files('xl').set(old, { type: 'video/webm', data: webm });
      ecran('xl').pages = [{ id: 'study', name: 'Study', wall: 'video' }];
      const { page, context } = await open('xl', 'pro', { videoXL: true });
      await page.waitForSelector('#wall i.on video');
      await custom(page);
      assert.match(await page.locator('#wall-video-hint').textContent(), /300 Mo maximum/);
      await choose(page, video);
      await page.waitForFunction(() => !document.querySelector('#wall-slot .tile[data-wall=video]').disabled);
      assert.ok(files('xl').get('fonds-video-xl/demo-plein-xl/fond')?.data.equals(webm));
      assert.equal(files('xl').has(old), false);
      await context.close();
    }

    assert.deepEqual(errors, []);
    console.log('fond-video : tous les parcours passent');
  } finally {
    await browser.close();
    await srv.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
