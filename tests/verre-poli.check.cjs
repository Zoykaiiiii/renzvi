// Chromium, Supabase simulé. SHOTS enregistre les captures, FOND_ESPACE et FOND_VIDEO sont facultatifs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');
const { custom, closeCustom } = require('./menu.cjs');

(async () => {
  const server = await start();
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const widgets = ['semaine', 'vol', 'playlist', 'minuteur', 'notes', 'cahier'];
  const errors = [];
  const open = async (name, viewport, { theme, wall, motion = 'reduce' }) => {
    const db = server.bac('plein', name);
    db.rows.ecran = {
      ...db.rows.ecran, widgets, where: Object.fromEntries(widgets.map(id => [id, 'study'])),
      look: { theme, titre: 'gloock', texte: 'inter' }, pages: [{ id: 'study', name: 'Study', wall }],
    };
    db.rows.vol = { length: 90 };
    db.rows.playlist = { provider: 'spotify', kind: 'playlist', id: '37i9dQZF1DXcBWIGoYBM5M', title: 'Concentration', thumb: 'https://i.scdn.co/image/renzvi-test' };
    if (wall === 'perso') db.files.set(`fonds/demo-plein-${name}/fond.jpg`, {
      type: 'image/jpeg', data: fs.readFileSync(process.env.FOND_ESPACE || path.join(__dirname, '../video/dashboard-sombre/fond.jpg')),
    });
    if (wall === 'video') db.files.set(`fonds-video/demo-plein-${name}/fond`, {
      type: 'video/webm', data: fs.readFileSync(process.env.FOND_VIDEO),
    });
    const page = await browser.newPage({ viewport, reducedMotion: motion, hasTouch: viewport.width < 500, isMobile: viewport.width < 500 });
    page.on('pageerror', error => errors.push(error.message));
    await page.route(db.rows.playlist.thumb, route => route.fulfill({ path: path.join(__dirname, '../site/landing/santorin.webp'), contentType: 'image/webp' }));
    await page.goto(`${server.url}/dashboard.html?profil=plein&bac=${name}`);
    await page.locator('#wall .on').waitFor({ state: 'attached' });
    await page.locator('[data-widget=vol] .broute').waitFor();
    await page.waitForFunction(() => document.querySelector('img.pl-cover')?.naturalWidth > 0);
    await page.evaluate(() => document.fonts.ready);
    return { page, db };
  };
  const shot = (page, name) => process.env.SHOTS && page.screenshot({ path: path.join(process.env.SHOTS, name + '.png') });
  const finish = (page, name) => page.getByRole('button', { name, exact: true });
  const style = (page, selector) => page.locator(selector).evaluate(el => {
    const c = getComputedStyle(el);
    return { color: c.backgroundColor, blur: c.backdropFilter, shadow: c.boxShadow, opacity: c.opacity, filter: c.filter };
  });
  const boxes = page => page.locator('#board .widget').evaluateAll(nodes => nodes.map(el => {
    const { x, y, width, height } = el.getBoundingClientRect();
    return [el.dataset.widget, x + scrollX, y + scrollY, width, height];
  }));
  const slide = (page, id, value) => page.locator(id).evaluate((input, value) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  const vol = '[data-widget=vol]';

  try {
    const { page, db } = await open('verreespace', { width: 1440, height: 900 }, { theme: 'dark', wall: 'perso' });
    const before = await style(page, vol);
    const positions = await boxes(page);
    const savedLayout = structuredClone(db.rows.ecran);
    const cover = await style(page, 'img.pl-cover');
    await shot(page, 'verre-avant');

    await custom(page);
    assert.match(await page.locator('#fini-poli').evaluate(el => getComputedStyle(el).backgroundImage), /blob:/);
    await finish(page, 'Verre poli').click();
    assert.equal(await finish(page, 'Verre poli').getAttribute('aria-pressed'), 'true');
    const after = await style(page, vol);
    assert.equal(after.color, 'rgba(20, 22, 27, 0.72)');
    assert.equal(after.blur, 'blur(12px) saturate(1.12)');
    assert.notEqual(after.shadow, before.shadow);
    assert.deepEqual(await style(page, '.hello'), after);
    assert.equal((await style(page, vol + ' .boarding')).blur, 'none');
    assert.equal((await style(page, vol + ' .broute')).opacity, '1');
    assert.equal(await page.locator(vol + ' .broute').textContent(), 'PAR → LIS');
    assert.deepEqual(await style(page, 'img.pl-cover'), cover);
    await page.locator('#set-verre').evaluate(el => el.scrollIntoView({ block: 'start' }));
    await shot(page, 'verre-reglages');
    await closeCustom(page);
    assert.deepEqual(await boxes(page), positions);
    await page.waitForFunction(() => document.querySelector('#saved').textContent === 'Enregistré');
    await shot(page, 'verre-apres');

    const notes = page.locator('textarea.notes');
    await page.keyboard.press('Tab');
    await notes.focus();
    assert.equal(await notes.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');

    const timer = page.locator('[data-widget=minuteur]');
    await timer.getByRole('button', { name: 'Démarrer' }).click();
    await timer.getByRole('button', { name: 'Pause' }).waitFor();
    const timerNode = await timer.elementHandle();
    const runningPositions = await boxes(page);
    await custom(page);
    await finish(page, 'Classique').click();
    assert.deepEqual(await style(page, vol), before);
    await finish(page, 'Verre poli').click();
    await slide(page, '#look-opacite', 88);
    await slide(page, '#look-flou', 7);
    assert.equal((await style(page, vol)).color, 'rgba(20, 22, 27, 0.88)');
    assert.equal((await style(page, vol)).blur, 'blur(7px) saturate(1.12)');
    await closeCustom(page);
    assert.ok(await timerNode.evaluate(node => node === document.querySelector('[data-widget=minuteur]')));
    await timer.getByRole('button', { name: 'Pause' }).waitFor();
    assert.deepEqual(await boxes(page), runningPositions);
    await page.waitForFunction(() => document.querySelector('#saved').textContent === 'Enregistré');
    assert.deepEqual(db.rows.ecran.where, savedLayout.where);
    assert.deepEqual(db.rows.ecran.widgets, savedLayout.widgets);
    assert.equal(db.rows.ecran.look.titre, 'gloock');
    assert.equal(db.rows.ecran.look.texte, 'inter');

    await page.reload();
    await page.locator('[data-widget=vol] .broute').waitFor();
    assert.equal((await style(page, vol)).color, 'rgba(20, 22, 27, 0.88)');
    await custom(page);
    assert.equal(await page.locator('#look-flou').inputValue(), '7');
    await finish(page, 'Rétablir les valeurs par défaut').click();
    assert.deepEqual(await style(page, vol), after);
    await finish(page, 'Clair').click();
    assert.equal((await style(page, vol)).color, 'rgba(250, 251, 253, 0.78)');
    await finish(page, 'Sombre').click();
    assert.deepEqual(await style(page, vol), after);
    await closeCustom(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
    assert.ok(await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches));
    assert.equal((await style(page, vol)).color, 'rgba(20, 22, 27, 0.96)');
    assert.equal((await style(page, vol)).blur, 'none');
    await page.close();

    for (const [name, theme, wall, width, color] of [
      ['verreclair', 'light', 'dune', 1440, 'rgba(250, 251, 253, 0.78)'],
      ['verremobile', 'dark', 'foret', 390, 'rgba(20, 22, 27, 0.72)'],
    ]) {
      const { page } = await open(name, { width, height: 900 }, { theme, wall });
      await custom(page);
      await finish(page, 'Verre poli').click();
      await closeCustom(page);
      assert.equal((await style(page, vol)).color, color);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await shot(page, name);
      await page.close();
    }

    if (process.env.FOND_VIDEO) {
      const { page } = await open('verreanime', { width: 1440, height: 900 }, { theme: 'dark', wall: 'video', motion: 'no-preference' });
      await custom(page);
      await finish(page, 'Verre poli').click();
      await page.waitForFunction(() => ['#wall video', '#fini-poli video'].every(selector => document.querySelector(selector)?.currentTime > 0));
      assert.equal((await style(page, vol)).blur, 'blur(12px) saturate(1.12)');
      await closeCustom(page);
      assert.equal(await page.locator('#fini-poli video').count(), 0);
      await page.close();
    }
    assert.deepEqual(errors, []);
    console.log('verre poli : rendu, aperçu, réglages, sauvegarde et session de focus vérifiés');
  } finally {
    await browser.close();
    await server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
