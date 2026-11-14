// Curseurs et compteur, dans un vrai Chromium, sur le serveur de démo (Supabase simulé en mémoire).
// Vérifie : zoom du fond (glisser, crans, clavier, enregistrement, rechargement, fond blanc), compteur de minutes du vol
// (+/−, maintenir, clavier, bornes), remplissage des curseurs. Lancement : NODE_PATH=~/pw/node_modules node tests/curseurs.check.cjs
// SHOTS=dossier pour garder les captures.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');

(async () => {
  const srv = await start();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
  const errors = [];
  const shot = (page, name) => process.env.SHOTS && page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
  const open = async (viewport, bac) => {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${srv.url}/dashboard.html?profil=plein&bac=${bac}`);
    await page.waitForSelector('#board .widget:not([hidden])');
    return { page, context, db: srv.bac('plein', bac) };
  };
  const saved = page => page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
  const wallSize = page => page.locator('#wall i.on').last().evaluate(l => l.style.backgroundSize);

  // 1. Zoom du fond, sur ordinateur.
  {
    const { page, context, db } = await open({ width: 1440, height: 900 }, 'zoom');
    await page.locator('#open-custom').click();
    const slider = page.getByRole('slider', { name: 'Zoom du fond' });
    assert.equal(await slider.getAttribute('aria-valuenow'), '100', '100 % par défaut');
    assert.equal(await wallSize(page), '', 'la photo couvre l\'écran comme avant');
    await shot(page, 'zoom-100');
    // Glisser vers la gauche : la valeur suit pendant le geste, puis se pose sur un cran.
    const track = await page.locator('.islider').boundingBox();
    await page.mouse.move(track.x + track.width - 14, track.y + 20);
    await page.mouse.down();
    await page.mouse.move(track.x + track.width * .35, track.y + 20, { steps: 12 });
    const during = Number(await slider.getAttribute('aria-valuenow'));
    assert.ok(during < 100 && during > 40, `la valeur suit le doigt (${during})`);
    await page.mouse.up();
    const after = Number(await slider.getAttribute('aria-valuenow'));
    assert.ok([40, 45, 55, 60, 65, 75, 80, 85, 95, 100].includes(after), `posé sur un cran (${after})`);
    await page.waitForFunction(() => document.querySelector('#wall i.on:last-child')?.classList.contains('recul'));
    assert.match(await wallSize(page), /^\d+px \d+px$/, 'la photo est dessinée plus petite');
    await saved(page);
    assert.equal(db.rows.ecran.look.fond, after, 'enregistré');
    await page.waitForTimeout(500);
    await shot(page, 'zoom-reduit');
    // Clavier : flèches de cran en cran, Fin pour revenir à 100 %.
    await slider.focus();
    await page.keyboard.press('ArrowLeft');
    assert.ok(Number(await slider.getAttribute('aria-valuenow')) < after);
    await page.keyboard.press('Home');
    assert.equal(await slider.getAttribute('aria-valuenow'), '40');
    await saved(page);
    // Rechargement : le zoom revient.
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#wall i.on:last-child')?.classList.contains('recul'));
    assert.equal(db.rows.ecran.look.fond, 40);
    // Sur le fond blanc, le curseur ne sert à rien : il est désactivé.
    await page.locator('#open-custom').click();
    await page.locator('#wall-slot .tile[data-wall=blanc]').click();
    assert.equal(await page.getByRole('slider', { name: 'Zoom du fond' }).isDisabled(), true);
    await page.keyboard.press('Escape');
    await context.close();
  }

  // 2. Compteur du vol de focus.
  {
    const { page, context, db } = await open({ width: 1440, height: 900 }, 'vol');
    const dial = page.getByRole('spinbutton', { name: 'Durée du vol, en minutes' });
    assert.equal(await dial.getAttribute('aria-valuenow'), '25');
    assert.deepEqual(await dial.locator('.dial-d').allTextContents(), ['0', '2', '5']);
    await page.getByRole('button', { name: 'Ajouter 5 minutes' }).click();
    await page.waitForTimeout(300);
    await page.waitForTimeout(900);
    assert.deepEqual(await dial.locator('.dial-d').allTextContents(), ['0', '3', '0'], 'les chiffres ont roulé');
    assert.equal(await page.locator('.vol-time output').textContent(), '30 min');
    // Maintenir + fait défiler.
    const plus = await page.getByRole('button', { name: 'Ajouter 5 minutes' }).boundingBox();
    await page.mouse.move(plus.x + plus.width / 2, plus.y + plus.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1300);
    await page.mouse.up();
    const held = Number(await dial.getAttribute('aria-valuenow'));
    assert.ok(held >= 50, `maintenu : défile (${held})`);
    await saved(page);
    assert.equal(db.rows.vol.length, held, 'durée enregistrée en lâchant');
    await shot(page, 'vol-compteur');
    await dial.press('End');
    assert.equal(await dial.getAttribute('aria-valuenow'), '180');
    assert.equal(await page.getByRole('button', { name: 'Ajouter 5 minutes' }).isDisabled(), true, 'pas au-delà de 3 h');
    await dial.press('Home');
    assert.equal(await dial.getAttribute('aria-valuenow'), '5');
    await context.close();
  }

  // 3. Curseurs restylés : la partie remplie suit la valeur ; téléphone sans débordement.
  {
    const { page, context } = await open({ width: 390, height: 844 }, 'tel');
    await page.locator('#page-tabs').getByRole('button', { name: 'Chill' }).click();
    const r = page.locator('[data-widget=ambiance] input[type=range]').first();
    await r.focus();
    await page.keyboard.press('End');
    assert.equal(await r.evaluate(x => x.style.getPropertyValue('--p')), '100%');
    await page.keyboard.press('Home');
    assert.equal(await r.evaluate(x => x.style.getPropertyValue('--p')), '0%');
    await r.scrollIntoViewIfNeeded();
    await shot(page, 'curseurs-telephone');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('#page-tabs').getByRole('button', { name: 'Study' }).click();
    await page.locator('[data-widget=vol] .dial').scrollIntoViewIfNeeded();
    await shot(page, 'vol-telephone');
    await context.close();
  }

  await browser.close();
  await srv.close();
  assert.deepEqual(errors, [], 'aucune erreur dans la page');
  console.log('curseurs : OK');
})().catch(e => { console.error(e); process.exit(1); });
