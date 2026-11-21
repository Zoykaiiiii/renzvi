// Parcours du vrai billet, avec horloge accélérée et Supabase de démonstration.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, webkit, devices } = require('playwright');
const { start } = require('./demo.cjs');

(async () => {
  const srv = await start();
  const mobile = process.env.WEBKIT === '1';
  const standalone = mobile && process.env.STANDALONE === '1';
  const reduced = mobile && process.env.MOTION !== '1';
  const browser = await (mobile ? webkit : chromium).launch(mobile ? {} : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext(mobile ? { ...devices['iPhone 13'], reducedMotion: reduced ? 'reduce' : 'no-preference' } : { viewport: { width: 1440, height: 900 } });
  if (standalone) await context.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  // Advance just the session clock. Rendering and GPU scheduling keep real browser time across reloads.
  await context.addInitScript(() => {
    const wall = Date.now.bind(Date);
    let offset = Number(sessionStorage.getItem('test-flight-offset')) || 0;
    Date.now = () => wall() + offset;
    window.advanceFlight = ms => {
      offset += ms;
      sessionStorage.setItem('test-flight-offset', String(offset));
      dispatchEvent(new Event('visibilitychange'));
    };
  });
  const page = await context.newPage();
  if (standalone) await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const bac = mobile ? 'v2phone' : 'v2desktop';
  const shot = async name => {
    if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, name + '.png') });
  };
  const phase = name => page.locator('#flight-window[data-phase="' + name + '"]').waitFor();
  const startFlight = async () => {
    await page.locator('.vol-time .dial').press('Home');
    await page.getByRole('button', { name: 'Déchirer et décoller' }).click();
    await page.getByRole('button', { name: 'Déchirer le billet' }).click();
    await page.getByRole('button', { name: 'Place 3C', exact: true }).click();
    await page.getByRole('button', { name: 'Décoller', exact: true }).click();
    await phase('takeoff');
    await page.waitForFunction(() => document.getElementById('flight-clock').textContent);
  };
  try {
    await page.goto(srv.url + '/dashboard.html?profil=plein&bac=' + bac + (standalone ? '&pages=1' : ''));
    const weekly = page.locator('.week-total');
    const initial = await weekly.innerText();
    await startFlight();
    const sceneBounds = async () => Promise.all(['#flight-view', '.flight-wing', '.flight-readout'].map(sel => page.locator(sel).boundingBox()));
    const seats = await sceneBounds();
    const assertAligned = async () => {
      const current = await sceneBounds();
      seats.forEach((box, i) => {
        for (const k of Object.keys(box)) assert.ok(Math.abs(box[k] - current[i][k]) < 1, k + ' stable à un pixel près');
      });
    };
    const cancelBounds = await page.locator('#flight-cancel').boundingBox();
    const viewport = page.viewportSize();
    assert.ok(cancelBounds.x >= 0 && cancelBounds.y >= 0 && cancelBounds.y + cancelBounds.height <= viewport.height);
    const [view, , timer] = seats;
    assert.ok(mobile ? timer.y >= view.y + view.height : timer.x + timer.width < view.x);
    assert.equal(await page.locator('#flight-route').innerText(), 'Paris → Nantes · place 3C');
    assert.equal(await page.locator('#flight-phase').innerText(), 'Décollage');
    await page.waitForTimeout(900);
    if (!mobile) await shot('01-decollage');
    await page.evaluate(() => advanceFlight(120000));
    await phase('cruise');
    const model = page.locator('#flight-window[data-model="3d"] canvas');
    if (reduced) {
      assert.equal(await model.count(), 0);
    } else {
      await model.waitFor();
      // Sample the visible cloud deck before the browser discards its WebGL back buffer.
      const cloudPixels = () => model.evaluate(canvas => new Promise(resolve => {
        const gl = canvas.getContext('webgl2'), draw = gl.drawElements;
        gl.drawElements = function(...args) {
          draw.apply(gl,args);
          gl.drawElements = draw;
          const pixels = new Uint8Array(8*8*4);
          gl.readPixels(Math.floor(canvas.width*.51), Math.floor(canvas.height*.30), 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          resolve(Array.from(pixels));
        };
      }));
      const before = await cloudPixels();
      assert.ok(before.some((v,i) => i%4 !== 3 && v > 0));
      await page.evaluate(() => advanceFlight(1500));
      assert.notDeepEqual(await cloudPixels(), before, 'les nuages passent devant le siège immobile');
    }
    await assertAligned();
    if (!mobile) await shot('02-croisiere'); else await shot(standalone ? '05-autonome' : '04-iphone');
    // Le navigateur suspend les ticks. L’heure de fin ne change pas au retour.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      dispatchEvent(new Event('visibilitychange'));
    });
    await page.evaluate(() => advanceFlight(3500));
    await page.evaluate(() => { delete document.hidden; dispatchEvent(new Event('visibilitychange')); });
    const snapshot = await page.evaluate(() => JSON.parse(sessionStorage.getItem(Object.keys(sessionStorage).find(k => k.startsWith('renzvi:vol:')))));
    assert.equal(snapshot.leftAt, null);
    await page.reload();
    await phase('cruise');
    if (await page.locator('#flight-back').isVisible()) await page.locator('#flight-back').click();
    await page.locator('#flight-alert').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#flight-route').innerText(), 'Paris → Nantes · place 3C');
    const endAt = await page.evaluate(() => JSON.parse(sessionStorage.getItem(Object.keys(sessionStorage).find(k => k.startsWith('renzvi:vol:')))).endAt);
    assert.equal(endAt, snapshot.endAt);
    const clock = await page.locator('#flight-clock').textContent();
    const remaining = await page.evaluate(end => (end-Date.now())/1000, endAt);
    const [min,sec] = clock.split(':').map(Number);
    assert.ok(Math.abs(min*60+sec-remaining) <= 2);
    await page.evaluate(end => advanceFlight(end-Date.now()-24000), endAt);
    await phase('approach');
    await assertAligned();
    if (!mobile) await shot('03-approche');
    if (!reduced) {
      await model.waitFor();
      await model.evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
      await model.waitFor({state:'detached'});
      assert.equal(await page.locator('#flight-phase').innerText(), 'Approche');
      assert.equal(await page.locator('.hublot-frame').evaluate(el=>getComputedStyle(el).opacity), '1');
    }
    await page.evaluate(() => advanceFlight(30000));
    await page.locator('#flight-close').click();
    await page.locator('#flight').waitFor({ state: 'hidden' });
    const db = srv.bac('plein', bac);
    assert.deepEqual([db.rows.vol.minutes, db.rows.vol.flights, Object.values(db.rows.vol.log)], [5, 1, [5]]);
    const expected = await page.evaluate(before => {
      const [h, m] = before.includes(' h') ? before.split(' h') : ['0', before.replace(' min', '')];
      return durationLabel(Number(h) * 60 + Number(m) + 5);
    }, initial);
    assert.equal(await weekly.innerText(), expected);
    const after = await weekly.innerText();
    await page.reload();
    assert.equal(await weekly.innerText(), after);
    await startFlight();
    await page.locator('#flight-cancel').click();
    await page.locator('#flight-cancel').click();
    await page.locator('#flight').waitFor({ state: 'hidden' });
    assert.equal(await weekly.innerText(), after);
    assert.equal(db.rows.vol.flights, 1);
    assert.equal(await page.locator('.flight-model').count(), 0);
    assert.deepEqual(errors, []);
    console.log((mobile ? 'WebKit iPhone' : 'Chromium desktop') + ' : trois phases, reprise, semaine et annulation OK');
  } finally {
    await browser.close();
    await srv.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
