// Barre du document, défilement natif et accès à Zvi. NODE_PATH=~/pw/node_modules node tests/scrollbar.check.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');

(async () => {
  const server = await start();
  const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
  try {
    const { ecran } = server.bac('plein', 'scrollbar').rows;
    ecran.look = { theme: 'dark' };
    const page = await browser.newPage({ viewport: { width: 1440, height: 650 }, reducedMotion: 'reduce' });
    const url = `${server.url}/dashboard.html?profil=plein&bac=scrollbar&labo=1`;
    await page.goto(`${url}&pages=1`);
    await page.waitForSelector('#wall i.on');
    const board = page.locator('#board[data-vue=pages]');
    await board.waitFor();
    const zvi = page.getByRole('button', { name: 'Ouvrir Zvi' });
    await zvi.waitFor();
    await page.evaluate(() => document.fonts.ready);

    const { gutter, range, root, inner } = await board.evaluate(el => ({
      gutter: innerWidth - document.documentElement.clientWidth,
      range: document.scrollingElement.scrollHeight - innerHeight,
      root: document.scrollingElement === document.documentElement,
      inner: getComputedStyle(el.querySelector('.widget > .body'), '::-webkit-scrollbar').width,
    }));
    assert.ok(root && range > 100, 'le document défile');
    assert.equal(gutter, 0, 'aucune gouttière au bord droit');
    assert.equal(inner, '10px', 'la barre du widget garde sa largeur');
    const grid = () => board.evaluate(el => [el.getBoundingClientRect().x, el.clientWidth]);
    const alignment = await grid();
    const scrollWith = async (target, input) => {
      await target.evaluate(() => {
        window.testScrollEnded = false;
        document.addEventListener('scrollend', () => { window.testScrollEnded = true; }, { once: true });
      });
      await input();
      await target.waitForFunction(() => window.testScrollEnded);
      return target.evaluate(() => scrollY);
    };
    await page.mouse.click(1380, 150);
    await page.mouse.move(1439, 150);
    assert.ok(await scrollWith(page, () => page.mouse.wheel(0, 140)) > 0, 'la molette défile jusque sur le bord droit');
    assert.equal(await page.evaluate(() => innerWidth - document.documentElement.clientWidth), 0);
    assert.equal(await scrollWith(page, () => page.keyboard.press('Home')), 0, 'le clavier revient en haut');

    assert.deepEqual(await grid(), alignment);
    const button = await zvi.boundingBox();
    assert.ok(button.width >= 44 && button.height >= 44 && button.x + button.width <= 1440);
    await zvi.click();
    await page.locator('#renzvi-chat-panel').waitFor();

    await page.emulateMedia({ forcedColors: 'active' });
    assert.equal(await page.evaluate(() => innerWidth - document.documentElement.clientWidth), 0);
    await page.close();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 650 }, isMobile: true, hasTouch: true });
    await mobile.goto(url);
    await mobile.waitForSelector('#board .widget:not([hidden])');
    const cdp = await mobile.context().newCDPSession(mobile);
    const touchScroll = await scrollWith(mobile, async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 380, y: 500 }] });
      for (const y of [470, 410, 340, 260]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 380, y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    });
    assert.ok(touchScroll > 0, 'le geste tactile défile');
    await mobile.getByRole('button', { name: 'Ouvrir Zvi' }).tap();
    await mobile.locator('#renzvi-chat-panel').waitFor();
    console.log('barre du document masquée : molette, clavier, tactile, couleurs forcées et Zvi vérifiés');
  } finally {
    await browser.close();
    await server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
