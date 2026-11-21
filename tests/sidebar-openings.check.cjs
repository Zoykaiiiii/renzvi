// NODE_PATH=~/pw/node_modules [VIDEO=/tmp/videos] node tests/sidebar-openings.check.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');

(async () => {
  const server = await start();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
  const errors = [];
  const startDashboard = async (name, options = {}) => {
    const { rows } = server.bac('plein', name);
    Object.assign(rows.ecran, {
      widgets: ['notes', 'minuteur', 'heure', 'vol', 'cartes', 'ambiance'],
      favoris: ['notes', 'heure', 'vol', 'ambiance'],
      where: { notes: 'study', minuteur: 'study', heure: 'study', vol: 'study', cartes: 'study', ambiance: 'chill' },
      vues: { v: 1, places: { pages: {
        study: { n: 4, t: ['Lecture', 'Cartes', 'Libre', 'Focus'], d: {
          notes: { p: 0, c: 0, r: 0, w: 6, h: 3 },
          minuteur: { p: 0, c: 6, r: 3, w: 6, h: 3 },
          heure: { p: 0, c: 0, r: 4, w: 6, h: 2 },
          cartes: { p: 1, c: 0, r: 0, w: 6, h: 3 },
          vol: { p: 3, c: 6, r: 0, w: 6, h: 3 },
        } },
        chill: { n: 2, t: ['Repos', 'Sons'], d: { ambiance: { p: 1, c: 0, r: 0, w: 6, h: 3 } } },
      } } },
    });
    const context = await browser.newContext(options);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${server.url}/dashboard.html?profil=plein&bac=${name}&pages=1`);
    await page.locator('#board[data-vue=pages]').waitFor();
    await page.locator('#dashboard-entrance').waitFor({ state: 'detached' });
    return { page, context };
  };
  const card = (page, id) => page.locator(`#board > [data-widget=${id}]`);
  const favorite = (page, name) => page.locator('#favs-list').getByRole('button', { name });
  const activePage = page => page.locator('.pg-dot[aria-current=page]').getAttribute('aria-label');
  const found = (page, id) => page.waitForFunction(id => {
    const box = document.querySelector(`#board > [data-widget=${id}]`);
    return box.classList.contains('is-found') && document.activeElement === box;
  }, id, { polling: 'raf' });
  const motion = (page, id) => page.waitForFunction(id => {
    const box = document.querySelector(`#board > [data-widget=${id}]`);
    const slide = box.getAnimations().find(a => a.effect.getTiming().duration === 230);
    return slide && slide.effect.getKeyframes()[0].translate;
  }, id, { polling: 'raf' }).then(handle => handle.jsonValue());

  try {
    const viewport = { width: 1280, height: 800 };
    const { page, context } = await startDashboard('sidebar', { viewport });
    const notes = favorite(page, /^Notes/), flight = favorite(page, /^Vol de focus/);
    const initial = await card(page, 'notes').boundingBox();
    await notes.focus();
    await page.keyboard.press('Enter');
    await found(page, 'notes');
    assert.deepEqual(await card(page, 'notes').boundingBox(), initial);
    assert.equal(await page.evaluate(() => scrollY), 0);

    const wall = page.locator('#wall i.on');
    const wallpaper = await wall.elementHandle();
    const movingRight = motion(page, 'vol');
    await flight.click();
    assert.ok(parseFloat(await movingRight) > 0, 'the distant page enters from the right');
    assert.match(await activePage(page), /Focus/);
    await found(page, 'vol');
    assert.ok(await wall.evaluate((node, before) => node === before, wallpaper));
    const movingLeft = motion(page, 'notes');
    await notes.click();
    assert.ok(parseFloat(await movingLeft) < 0, 'the return page enters from the left');
    await found(page, 'notes');
    assert.match(await activePage(page), /Lecture/);

    await favorite(page, /^Ambiance sonore/).click();
    await found(page, 'ambiance');
    assert.equal(await page.locator('#bar-mode').textContent(), 'Chill');
    assert.match(await activePage(page), /Sons/);
    await notes.click();
    await found(page, 'notes');
    await flight.click();
    await motion(page, 'vol');
    await notes.click();
    await found(page, 'notes');
    assert.equal(await card(page, 'vol').evaluate(box => box.classList.contains('is-found')), false);
    assert.match(await activePage(page), /Lecture/);

    const catalog = page.locator('#add-dialog');
    await page.locator('#open-add').click();
    assert.ok(await catalog.evaluate(panel => panel.getAnimations().some(a => a.animationName === 'sidebar-panel-in')));
    await page.waitForFunction(() => document.querySelector('#add-dialog').getAnimations().length === 0);
    const header = await catalog.locator('.cat-head').boundingBox();
    await catalog.locator('#catalog [data-widget=notes]').click();
    assert.ok(await catalog.locator('.stage').evaluate(stage => stage.getAnimations().length === 1));
    const steadyHeader = await catalog.locator('.cat-head').boundingBox();
    await catalog.locator('#catalog [data-widget=vol]').click();
    assert.deepEqual(await catalog.locator('.cat-head').boundingBox(), steadyHeader);
    assert.deepEqual([header.width, header.height], [steadyHeader.width, steadyHeader.height]);
    assert.equal(await catalog.evaluate(panel => panel.getAnimations().length), 0);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'open-add');
    await context.close();

    for (const reducedMotion of ['no-preference', 'reduce']) {
      const { page: phone, context: touch } = await startDashboard(reducedMotion === 'reduce' ? 'reduced' : 'touch', {
        viewport: { width: 390, height: 640 }, hasTouch: true, isMobile: true, reducedMotion,
      });
      await phone.locator('#bar-toggle').tap();
      await favorite(phone, /^Heure/).tap();
      await found(phone, 'heure');
      assert.ok(await phone.evaluate(() => scrollY > 0));
      const bounds = await card(phone, 'heure').evaluate(box => ({
        top: box.getBoundingClientRect().top,
        bottom: box.getBoundingClientRect().bottom,
        controls: document.querySelector('.pg-dots').getBoundingClientRect().top,
        header: document.getElementById('bar').getBoundingClientRect().bottom,
      }));
      assert.ok(bounds.top >= bounds.header && bounds.bottom <= bounds.controls, `the card clears the mobile controls: ${JSON.stringify(bounds)}`);
      assert.equal(await card(phone, 'heure').evaluate(box => getComputedStyle(box, '::after').animationName), reducedMotion === 'reduce' ? 'none' : 'favorite-ring');
      await phone.locator('#bar-toggle').tap();
      await favorite(phone, /^Vol de focus/).tap();
      await found(phone, 'vol');
      assert.match(await activePage(phone), /Focus/);
      await phone.locator('#bar-toggle').tap();
      await phone.locator('#open-add').tap();
      const mobileCatalog = phone.locator('#add-dialog');
      assert.equal(await mobileCatalog.evaluate(panel => panel.getAnimations().length > 0), reducedMotion !== 'reduce');
      await mobileCatalog.locator('#catalog [data-widget=notes]').tap();
      assert.equal(await mobileCatalog.locator('#cat-view').evaluate(view => view.getAnimations().length > 0), reducedMotion !== 'reduce');
      const back = mobileCatalog.getByRole('button', { name: 'Retour au catalogue' });
      assert.ok(await back.evaluate(button => button === document.activeElement));
      await back.tap();
      assert.ok(await mobileCatalog.locator('#catalog [data-widget=notes]').evaluate(button => button === document.activeElement));
      await touch.close();
    }
    assert.deepEqual(errors, []);

    if (process.env.VIDEO) {
      const recording = await startDashboard('recording', { viewport, recordVideo: { dir: process.env.VIDEO, size: viewport } });
      await recording.page.locator('#bar-toggle').click();
      const shortcut = favorite(recording.page, /^Vol de focus/);
      await shortcut.hover();
      await recording.page.waitForTimeout(500);
      await shortcut.click();
      await found(recording.page, 'vol');
      await recording.page.screenshot();
      await recording.page.waitForTimeout(1600);
      const video = recording.page.video();
      await recording.context.close();
      await video.saveAs(path.join(process.env.VIDEO, 'renzvi-favori-changement-page.webm'));
    }
    console.log('sidebar-openings OK');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
