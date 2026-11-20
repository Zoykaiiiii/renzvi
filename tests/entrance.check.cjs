// NODE_PATH=~/pw/node_modules [ARTIFACTS=/tmp/entrance] [WEBKIT=1] node tests/entrance.check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium, webkit } = require('playwright');
const { start } = require('./demo.cjs');

(async () => {
  const server = await start();
  const engine = process.env.WEBKIT ? webkit : chromium;
  const browser = await engine.launch();
  const artifacts = process.env.ARTIFACTS;
  if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
  const url = (profile, bac = '') => `${server.url}/dashboard.html?profil=${profile}&bac=${bac}&pages=1`;
  const selector = '#dashboard-entrance';
  try {
    for (const width of [320, 390, 1440]) {
      const mobile = width < 728;
      const context = await browser.newContext({
        viewport: { width, height: mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile,
      });
      const page = await context.newPage();
      await page.addInitScript(s => {
        const animate = Element.prototype.animate;
        window.entranceAnimations = [];
        Element.prototype.animate = function (...args) {
          const animation = animate.apply(this, args);
          if (this.closest(s)) {
            animation.pause();
            window.entranceAnimations.push(animation);
          }
          return animation;
        };
      }, selector);
      await page.goto(url(width === 1440 ? 'simple' : 'plein'), { waitUntil: 'commit' });
      await page.waitForFunction(() => window.entranceAnimations?.length === 6);
      const seek = ms => page.evaluate(([s, t]) => {
        const layer = document.querySelector(s);
        for (const animation of window.entranceAnimations) {
          animation.pause();
          animation.currentTime = t;
        }
        const [first, ...still] = layer.querySelectorAll('use');
        const lockup = layer.firstElementChild.getBoundingClientRect();
        const style = node => getComputedStyle(node);
        return {
          white: style(layer).backgroundColor, edge: parseFloat(style(layer).maskPosition),
          word: +style(layer.querySelector('span')).opacity,
          first: +style(first).opacity, still: still.map(square => +style(square).opacity),
          moving: first.getBoundingClientRect().toJSON(),
          width: lockup.width, center: (lockup.left + lockup.right) / 2,
        };
      }, [selector, ms]);
      const start = await seek(0);
      assert.equal(start.white, 'rgb(255, 255, 255)');
      assert.equal(start.edge, 100);
      assert.equal(start.word, 0);
      assert.equal(start.first, 0);
      assert.deepEqual(start.still, [0, 0, 0]);
      const vacant = await seek(495);
      assert.equal(vacant.word, 1);
      assert.equal(vacant.first, 0);
      assert.deepEqual(vacant.still, [.22, .22, .22]);
      const arrival = await seek(545);
      assert.ok(arrival.moving.left >= 0 && arrival.first === 1, JSON.stringify(arrival));
      const apex = await seek(955);
      assert.ok(apex.moving.top < arrival.moving.top);
      const landed = await seek(1390);
      const rebound = await seek(1480);
      assert.ok(rebound.moving.top < landed.moving.top);
      const logo = await seek(1950);
      assert.deepEqual(landed.moving, logo.moving);
      assert.ok(Math.abs(logo.center - width / 2) < .05);
      assert.ok(mobile ? logo.width >= 190 && logo.width <= 245 : logo.width >= 260 && logo.width <= 320, JSON.stringify(logo));
      if (artifacts) await page.screenshot({ path: `${artifacts}/renzvi-logo-${width}.png` });
      assert.equal(logo.edge, 100);
      const early = await seek(2550);
      const middle = await seek(2700);
      const late = await seek(2850);
      assert.ok(early.edge < 100 && early.edge > middle.edge);
      assert.ok(middle.edge > late.edge && late.edge > 0);
      if (artifacts && width === 390) {
        await seek(2700);
        await page.screenshot({ path: `${artifacts}/renzvi-balayage.png` });
      }
      await context.close();
    }

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
      ...(artifacts && !process.env.WEBKIT && { recordVideo: { dir: artifacts, size: { width: 390, height: 844 } } }),
    });
    const db = server.bac('plein', 'intro');
    db.rows.ecran.widgets = ['minuteur', 'taches'];
    db.rows.ecran.vues = { v: 1, places: { pages: { study: { n: 2, d: {
      minuteur: { p: 0, c: 0, r: 0, w: 6, h: 3 }, taches: { p: 1, c: 0, r: 0, w: 6, h: 3 },
    } } } } };
    const page = await context.newPage();
    await page.addInitScript(s => {
      new MutationObserver(() => {
        if (document.querySelector(s)) window.introIn ??= performance.now();
        else if (window.introIn) window.introOut ??= performance.now();
      }).observe(document, { childList: true, subtree: true });
    }, selector);
    await page.goto(url('plein', 'intro'), { waitUntil: 'commit' });
    await page.waitForFunction(() => window.introOut);
    const duration = await page.evaluate(() => window.introOut - window.introIn);
    assert.ok(duration >= 2880 && duration <= 3200, `durée ${duration} ms`);
    await page.locator('[data-widget=minuteur] .primary').filter({ hasText: 'Démarrer' }).tap();
    await page.getByRole('button', { name: 'Pause', exact: true }).waitFor();
    if (!process.env.WEBKIT) {
      const cdp = await context.newCDPSession(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      const y = await page.evaluate(() => {
        for (let y = innerHeight - 100; y >= 110; y--) {
          if (document.elementFromPoint(335, y)?.matches('#board')) return y;
        }
      });
      assert.ok(y);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 335, y }] });
      for (let x = 315; x >= 35; x -= 20) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
        await page.waitForTimeout(20);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForFunction(() => document.querySelectorAll('.pg-dot')[1]?.getAttribute('aria-current') === 'page');
    } else {
      await page.locator('.pg-dot').nth(1).tap();
    }
    await page.locator('[data-widget=taches]:not([hidden])').waitFor();
    assert.equal(await page.locator(selector).count(), 0);
    await context.close();
    if (page.video()) {
      const raw = await page.video().path();
      fs.renameSync(raw, `${artifacts}/renzvi-entrance.webm`);
    }

    const reduced = await browser.newPage({ reducedMotion: 'reduce' });
    await reduced.goto(url('simple'));
    assert.equal(await reduced.locator(selector).count(), 0);
    await reduced.locator('[data-widget=minuteur] .primary').filter({ hasText: 'Démarrer' }).click();
    await reduced.close();

    const background = await browser.newPage();
    await background.goto(url('simple'), { waitUntil: 'commit' });
    await background.locator(selector).waitFor();
    // WebKit/Chromium headless ne passent pas toujours l’onglet en arrière-plan avec bringToFront.
    await background.evaluate(async s => {
      const animations = document.querySelector(s).getAnimations({ subtree: true });
      for (const a of animations) { a.pause(); a.currentTime = 850; }
      const now = Date.now();
      Date.now = () => now + 3100;
      document.dispatchEvent(new Event('visibilitychange'));
    }, selector);
    assert.equal(await background.locator(selector).count(), 0);
    await background.close();
    console.log(`Entrée, 320/390/1440 px, ${Math.round(duration)} ms, interaction, mouvement réduit et retour au premier plan OK`);
  } finally {
    await browser.close();
    await server.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
