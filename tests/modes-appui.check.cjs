// Souris et doigt : garder le mode 3 secondes supprime seulement ce mode et réaffecte ses widgets.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');

(async () => {
  const server = await start();
  const browser = await chromium.launch();
  try {
    for (const touch of [false, true]) {
      const bac = touch ? 'appuidoigt' : 'appuisouris';
      const page = await browser.newPage({
        viewport: touch ? { width: 390, height: 844 } : { width: 1440, height: 900 },
        hasTouch: touch, isMobile: touch,
        reducedMotion: touch ? 'reduce' : 'no-preference',
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${server.url}/dashboard.html?profil=plein&bac=${bac}`);
      await page.waitForSelector('#board .widget:not([hidden])');
      const db = server.bac('plein', bac);
      const before = structuredClone(db.rows.ecran);
      const wheel = page.locator('dialog.mode-wheel');
      const open = () => page.locator('#bar-mode').click();
      const option = name => wheel.getByRole('option').filter({ has: page.locator('.mw-name').getByText(name, { exact: true }) });
      const point = async name => {
        const row = option(name).locator('.mw-item');
        await row.waitFor();
        await row.click({ trial: true });
        const r = await row.boundingBox();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      };
      const holding = wheel.locator('.is-holding');
      const mode = touch ? 'Study' : 'Chill';
      const kept = touch ? 'Chill' : 'Study';
      const key = kept.toLowerCase();
      await open();

      if (!touch) {
        await option('Chill').locator('.mw-item').click();
        await page.waitForFunction(() => document.getElementById('bar-mode').textContent === 'Chill');
        await open();
        await option('Study').locator('.mw-item').click();
        await page.waitForFunction(() => document.getElementById('bar-mode').textContent === 'Study');
        await open();

        const p = await point(mode);
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
        await holding.waitFor();
        const cross = holding.locator('.mw-hold-mark');
        assert.ok(await cross.isVisible());
        assert.equal(await cross.evaluate(el => getComputedStyle(el).color), 'rgb(255, 255, 255)');
        await page.waitForFunction(() => {
          const row = document.querySelector('.is-holding .mw-item');
          if (!row) return false;
          const style = getComputedStyle(row, '::after');
          const remaining = parseFloat(style.clipPath.split(' ')[1]);
          return style.animationDuration === '3s' && style.inset === '0px' && remaining > 10 && remaining < 83;
        });
        if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/mode-appui.png` });
        await page.mouse.up();
        await holding.waitFor({ state: 'detached' });
        assert.ok(await wheel.isVisible(), 'relâcher le maintien laisse la roue ouverte');
        assert.equal(db.rows.ecran.pages.length, 2);

        const q = await point(mode);
        await page.mouse.move(q.x, q.y);
        await page.mouse.down();
        await holding.waitFor();
        await page.mouse.move(q.x, q.y - 55, { steps: 4 });
        await holding.waitFor({ state: 'detached' });
        await page.mouse.up();
        assert.ok(await wheel.isVisible(), 'glisser conserve la roue ouverte');
      }

      const p = await point(mode);
      const cdp = touch && await page.context().newCDPSession(page);
      const saved = page.waitForResponse(response =>
        response.ok() && response.url().includes('/rest/v1/widget_state') &&
        response.request().method() === 'POST' &&
        response.request().postDataJSON().some(row => row.widget === 'ecran' && row.data.pages.length === 1));
      if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
      else {
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
      }
      await holding.waitFor();
      assert.equal(db.rows.ecran.pages.length, 2, 'rien ne disparaît au début de l’appui');
      await wheel.waitFor({ state: 'hidden', timeout: 8000 });
      if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      else await page.mouse.up();
      assert.equal(db.rows.ecran.pages.length, 2, 'le maintien attend la confirmation');
      await page.getByRole('button', { name: 'Supprimer le mode', exact: true }).click();
      await page.waitForFunction(name => document.getElementById('bar-mode').textContent === name, kept);
      await saved;
      assert.deepEqual(db.rows.ecran.pages.map(p => p.id), [key]);
      assert.deepEqual(db.rows.ecran.widgets, before.widgets);
      assert.ok(before.widgets.every(id => db.rows.ecran.where[id] === key));

      if (touch) {
        await open();
        const q = await point(kept);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [q] });
        await page.waitForTimeout(3100);
        assert.equal(await holding.count(), 0);
        assert.ok(await wheel.isVisible(), 'le dernier mode ne peut pas être supprimé');
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        assert.deepEqual(db.rows.ecran.pages.map(p => p.id), [key]);
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('modes : appui long, progression et annulation, souris et doigt OK');
  } finally {
    await browser.close();
    await server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
