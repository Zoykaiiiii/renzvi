// Parcours du vrai billet, avec horloge accélérée et Supabase de démonstration.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, webkit, devices } = require('playwright');
const { start } = require('./demo.cjs');

async function verifyFlight(minutes) {
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
    let frozen;
    Date.now = () => frozen ?? wall() + offset;
    window.freezeFlight = time => { frozen = time; dispatchEvent(new Event('visibilitychange')); };
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
    if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, minutes + 'min-' + name + '.png') });
  };
  const phase = name => page.locator('#flight-window[data-phase="' + name + '"]').waitFor();
  const startFlight = async () => {
    const dial = page.locator('.vol-time .dial');
    await dial.press('Home');
    for (let n = 5; n < minutes; n += 5) await dial.press('ArrowUp');
    assert.equal(await dial.getAttribute('aria-valuenow'), String(minutes));
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
    const route = 'Paris → ' + (minutes === 90 ? 'Lisbonne' : 'Nantes') + ' · place 3C';
    const session = () => page.evaluate(() => JSON.parse(sessionStorage.getItem(Object.keys(sessionStorage).find(k => k.startsWith('renzvi:vol:')))));
    const { endAt } = await session();
    const startAt = endAt - minutes * 60000;
    const takeoff = minutes === 90 ? 240 : 117;
    const approach = minutes === 90 ? 360 : 135;
    const seek = seconds => page.evaluate(time => advanceFlight(time - Date.now()), startAt + seconds * 1000);
    const model = page.locator('#flight-window[data-model="3d"] canvas');
    const checkLayers = async () => {
      if (!reduced) await model.waitFor();
      const plates = await page.locator('.flight-terrain').evaluateAll(els => els.filter(e => getComputedStyle(e).display !== 'none').length);
      assert.equal(plates, reduced ? 1 : 0, 'une seule source de paysage');
    };
    const sceneBounds = async () => Promise.all(['#flight-view', '.flight-wing', '.flight-readout'].map(sel => page.locator(sel).boundingBox()));
    const seats = await sceneBounds();
    const assertAligned = async () => {
      const current = await sceneBounds();
      seats.forEach((box, i) => {
        for (const k of (i === 2 ? ['x','y'] : Object.keys(box))) assert.ok(Math.abs(box[k] - current[i][k]) < 1, k + ' stable à un pixel près');
      });
    };
    const cancelBounds = await page.locator('#flight-cancel').boundingBox();
    const viewport = page.viewportSize();
    assert.ok(cancelBounds.x >= 0 && cancelBounds.y >= 0 && cancelBounds.y + cancelBounds.height <= viewport.height);
    const [view, , timer] = seats;
    assert.ok(mobile ? timer.y >= view.y + view.height : timer.x + timer.width < view.x);
    assert.equal(await page.locator('#flight-route').innerText(), route);
    assert.equal(await page.locator('#flight-phase').innerText(), 'Décollage');
    await checkLayers();
    await page.waitForTimeout(900);
    if (!mobile) await shot('01-decollage');
    await seek(takeoff - 5);
    await phase('takeoff');
    await seek(takeoff + 1);
    await phase('cruise');
    await seek(minutes * 30);
    await checkLayers();
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
      document.dispatchEvent(new Event('visibilitychange', { bubbles:true }));
    });
    await page.evaluate(() => advanceFlight(3500));
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange', { bubbles:true })); });
    const snapshot = await session();
    assert.equal(snapshot.leftAt, null);
    await page.reload({waitUntil:'domcontentloaded'});
    await phase('cruise');
    if (await page.locator('#flight-back').isVisible()) await page.locator('#flight-back').click();
    await page.locator('#flight-alert').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#flight-route').innerText(), route);
    assert.equal((await session()).endAt, snapshot.endAt);
    assert.equal(endAt, snapshot.endAt);
    const clock = await page.locator('#flight-clock').textContent();
    const remaining = await page.evaluate(end => (end-Date.now())/1000, endAt);
    const clockSeconds = clock.split(':').reduce((sum, value) => sum * 60 + Number(value), 0);
    assert.ok(Math.abs(clockSeconds-remaining) <= 2);
    await seek(minutes * 60 - approach - 5);
    await phase('cruise');
    await seek(minutes * 60 - approach + 1);
    await phase('approach');
    await seek(minutes * 60 - 40);
    await page.reload({waitUntil:'domcontentloaded'});
    await phase('approach');
    if (await page.locator('#flight-back').isVisible()) await page.locator('#flight-back').click();
    await page.locator('#flight-alert').waitFor({ state: 'hidden' });
    await assertAligned();
    await checkLayers();
    if (!mobile) await shot('03-approche');
    if (!reduced) {
      await model.waitFor();
      await model.evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
      await model.waitFor({state:'detached'});
      assert.equal(await page.locator('#flight-phase').innerText(), 'Approche');
      assert.equal(await page.locator('.flight-coast').evaluate(el=>getComputedStyle(el).display), 'block');
      assert.equal(await page.locator('.hublot-frame').evaluate(el=>getComputedStyle(el).opacity), '1');
    }
    await page.evaluate(time => freezeFlight(time), endAt - 1);
    assert.equal(await page.locator('#flight-clock').innerText(), '00:01');
    assert.equal(await page.locator('#flight-end').isVisible(), false);
    await page.evaluate(time => freezeFlight(time), endAt);
    assert.ok(await page.locator('#flight-end').isVisible());
    assert.equal(await page.locator('#flight-clock').textContent(), '00:00');
    await page.locator('#flight-close').click();
    await page.locator('#flight').waitFor({ state: 'hidden' });
    const db = srv.bac('plein', bac);
    assert.deepEqual([db.rows.vol.minutes, db.rows.vol.flights, Object.values(db.rows.vol.log)], [minutes, 1, [minutes]]);
    const expected = await page.evaluate(([before, minutes]) => {
      const [h, m] = before.includes(' h') ? before.split(' h') : ['0', before.replace(' min', '')];
      return durationLabel(Number(h) * 60 + Number(m) + minutes);
    }, [initial, minutes]);
    assert.equal(await weekly.innerText(), expected);
    const after = await weekly.innerText();
    await page.reload({waitUntil:'domcontentloaded'});
    assert.equal(await weekly.innerText(), after);
    await startFlight();
    await page.locator('#flight-cancel').click();
    await page.locator('#flight-cancel').click();
    await page.locator('#flight').waitFor({ state: 'hidden' });
    assert.equal(await weekly.innerText(), after);
    assert.equal(db.rows.vol.flights, 1);
    assert.equal(await page.locator('.flight-model').count(), 0);
    assert.deepEqual(errors, []);
    console.log((mobile ? 'WebKit iPhone' : 'Chromium desktop') + ' ' + minutes + ' min : trois phases, reprise, semaine et annulation OK');
  } finally {
    await browser.close();
    await srv.close();
  }
}

(async () => {
  for (const minutes of [15, 90]) await verifyFlight(minutes);
})().catch(e => { console.error(e); process.exitCode = 1; });
