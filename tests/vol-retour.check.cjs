// Vol de focus (site/dashboard.html, startFlight) dans un vrai Chromium, sur le serveur de démo (Supabase simulé) :
// boutons lisibles en thème sombre et clair (actifs et désactivés), annulation qui revient au dashboard en douceur
// sans clic de plus, clics répétés, contexte rendu intact (mode, page, défilement, widgets, focus), rien qui traîne,
// téléphone et mouvement réduit.
// Lancement : NODE_PATH=~/pw/node_modules node tests/vol-retour.check.cjs   (SHOTS=dossier pour garder les captures)
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');
const { custom, closeCustom, modeNow } = require('./menu.cjs');

(async () => {
  const srv = await start();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
  const errors = [];
  const shot = (page, name, clip) => process.env.SHOTS && page.screenshot({ path: `${process.env.SHOTS}/${name}.png`, clip });
  const open = async (viewport, bac, opts = {}) => {
    const context = await browser.newContext({ viewport, hasTouch: !!opts.touch, isMobile: !!opts.touch, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    if (!opts.touch) await page.mouse.move(720, 500);
    await page.goto(`${srv.url}/dashboard.html?profil=plein&bac=${bac}`);
    await page.waitForSelector('#board .widget:not([hidden])');
    if (opts.dark) { await custom(page); await page.click('.theme-btn[data-value=dark]'); await closeCustom(page); }
    return { page, context };
  };
  // Contraste WCAG entre le texte d'un bouton et son fond (fond composé sur celui du vol quand il est transparent).
  const contrast = locator => locator.evaluate(b => {
    const rgb = c => c.match(/[\d.]+/g).map(Number);
    const lum = ([r, g, bl]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(bl); };
    const cs = getComputedStyle(b), base = rgb(getComputedStyle(document.getElementById('flight')).backgroundColor);
    const [r, g, bl, a = 1] = rgb(cs.backgroundColor);
    const bg = [r, g, bl].map((v, i) => v * a + base[i] * (1 - a));
    const [l1, l2] = [lum(rgb(cs.color)), lum(bg)].sort((x, y) => y - x);
    return { ratio: (l1 + .05) / (l2 + .05), opacity: Number(cs.opacity) };
  });
  const widgets = page => page.locator('#board .widget:not([hidden])').evaluateAll(n => n.map(w => w.dataset.widget));
  const takeOff = async page => {
    await page.getByRole('button', { name: 'Déchirer le billet' }).click();
    await page.locator('#flight-seats button.seat').first().click();
    await page.getByRole('button', { name: 'Décoller', exact: true }).click();
    await page.waitForSelector('#flight-run:not([hidden])');
  };
  const volWidget = page => page.locator('[data-widget=vol]');
  // Les deux clics d'annulation d'un coup (dans les 3 s de la confirmation, même si le navigateur de test est lent).
  const cancel = page => page.locator('#flight-cancel').evaluate(b => { b.click(); b.click(); });

  // 1. Boutons du vol lisibles, actifs et désactivés, dans les deux thèmes ; le billet se déchire toujours.
  for (const dark of [true, false]) {
    const { page, context } = await open({ width: 1440, height: 900 }, `btn-${dark}`, { dark, reduced: true });
    await page.getByRole('button', { name: 'Déchirer et décoller' }).click();
    const tear = page.getByRole('button', { name: 'Déchirer le billet' });
    await tear.waitFor();
    const t = await contrast(tear);
    assert.ok(t.ratio >= 7 && t.opacity === 1, `« Déchirer le billet » lisible (${t.ratio.toFixed(1)}:1, thème ${dark ? 'sombre' : 'clair'})`);
    const stay = await contrast(page.getByRole('button', { name: 'Ne pas partir' }));
    assert.ok(stay.ratio >= 7, `« Ne pas partir » lisible (${stay.ratio.toFixed(1)}:1)`);
    await shot(page, `vol-boutons-billet-${dark ? 'sombre' : 'clair'}`, { x: 520, y: 700, width: 400, height: 160 });
    await tear.click();
    const go = page.getByRole('button', { name: 'Décoller', exact: true });
    await go.waitFor();
    assert.equal(await go.isDisabled(), true, 'désactivé tant qu’aucune place n’est choisie (règle inchangée)');
    const off = await contrast(go);
    assert.ok(off.ratio >= 4.5 && off.opacity === 1, `« Décoller » désactivé reste lisible (${off.ratio.toFixed(1)}:1)`);
    await shot(page, `vol-boutons-cabine-${dark ? 'sombre' : 'clair'}`);
    await page.locator('#flight-seats button.seat').first().click();
    assert.equal(await go.isDisabled(), false);
    const on = await contrast(go);
    assert.ok(on.ratio >= 7, `« Décoller » actif lisible (${on.ratio.toFixed(1)}:1)`);
    assert.notEqual(on.ratio.toFixed(1), off.ratio.toFixed(1), 'actif et désactivé se distinguent');
    await context.close();
  }

  // 2. Annulation avec animation : accusé, fondu court, dashboard intact, un seul effet malgré les clics répétés.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'annule');
    await volWidget(page).scrollIntoViewIfNeeded();
    const before = { mode: await modeNow(page), widgets: await widgets(page), meta: await volWidget(page).locator('.meta').textContent() };
    // Le navigateur peut faire défiler la page pour atteindre le bouton avant d'envoyer le clic.
    const [scrollAtBoarding] = await Promise.all([
      page.evaluate(() => new Promise(resolve => document.addEventListener('click', () => resolve(scrollY), { capture: true, once: true }))),
      page.getByRole('button', { name: 'Déchirer et décoller' }).click()
    ]);
    await takeOff(page);
    await page.getByRole('button', { name: 'Annuler le vol' }).click();
    const sure = page.getByRole('button', { name: 'Vraiment annuler ?' });
    // Relever le fondu dans la même tâche que le clic, même avec un GPU logiciel lent.
    const fade = await sure.evaluate(b => {
      b.click();
      return document.getElementById('flight').getAnimations().map(a => a.effect.getTiming().duration);
    });
    // Clics répétés pendant le retour : aucun effet.
    await page.locator('#flight-cancel').evaluate(b => { b.click(); b.click(); });
    assert.equal(await page.textContent('#flight-end-title'), 'Vol annulé', 'l’annulation est dite tout de suite');
    assert.equal(await page.isVisible('#flight-close'), false, 'pas de bouton à toucher pour revenir');
    // La scène s'efface en reculant (pas de disparition sèche), réglée sur 250 à 450 ms. Pas de mesure en temps réel :
    // sans carte graphique, ce navigateur de test met plusieurs secondes à redessiner le dashboard givré qui réapparaît.
    assert.equal(fade.length, 1, 'la scène s’efface');
    assert.ok(fade[0] >= 250 && fade[0] <= 450, `fondu court (${fade[0]} ms)`);
    await page.waitForSelector('#flight', { state: 'hidden' });
    assert.equal(await page.locator('#app').evaluate(a => a.inert), false);
    assert.equal(await page.locator('#flight').evaluate(n => n.getAnimations().length), 0, 'aucune animation laissée sur la scène');
    assert.equal(await page.locator('#flight-window canvas').count(), 0, 'paysage arrêté');
    assert.equal(await page.locator('#flight-scene').evaluate(n => n.childElementCount), 0);
    assert.equal(await page.evaluate(() => document.fullscreenElement), null);
    assert.equal(await page.title(), 'Mon écran — Renzvi');
    assert.equal(await modeNow(page), before.mode, 'même mode');
    assert.deepEqual(await widgets(page), before.widgets, 'mêmes widgets, même ordre');
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - scrollAtBoarding) <= 1, 'même défilement');
    assert.equal(await volWidget(page).locator('.meta').textContent(), before.meta, 'rien n’est compté');
    assert.equal(await volWidget(page).locator('.vol-said').textContent(), 'Vol annulé. Il ne compte pas dans ta journée.');
    await page.waitForFunction(() => document.activeElement.textContent === 'Déchirer et décoller'); // le focus revient au bouton du vol
    await shot(page, 'vol-retour-dashboard');
    // Le vol suivant repart propre : bouton d'annulation actif, message effacé.
    await page.getByRole('button', { name: 'Déchirer et décoller' }).click();
    assert.equal(await volWidget(page).locator('.vol-said').textContent(), '');
    await takeOff(page);
    assert.equal(await page.locator('#flight-cancel').isDisabled(), false);
    assert.equal(await page.locator('#flight').evaluate(n => getComputedStyle(n).opacity), '1', 'la scène réapparaît entière');
    await cancel(page);
    await page.waitForSelector('#flight', { state: 'hidden' });
    // Renoncer avant de partir : même retour en douceur, sans message.
    await page.getByRole('button', { name: 'Déchirer et décoller' }).click();
    await page.getByRole('button', { name: 'Ne pas partir' }).click();
    await page.waitForSelector('#flight', { state: 'hidden' });
    assert.equal(await volWidget(page).locator('.vol-said').textContent(), '', 'renoncer n’est pas une annulation de vol');
    assert.equal(await page.locator('#app').evaluate(a => a.inert), false);
    await context.close();
  }

  // 3. Onglet caché au moment de l'annulation : retour immédiat, sans compter sur une animation invisible.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'cache');
    await page.getByRole('button', { name: 'Déchirer et décoller' }).click();
    await takeOff(page);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      dispatchEvent(new Event('visibilitychange')); // départ du délai de grâce
      window.__now = Date.now;
      Date.now = () => window.__now() + 60000; // l'onglet a dormi plus que le délai de grâce
      dispatchEvent(new Event('visibilitychange')); // réveil tardif, toujours caché
    });
    assert.equal(await page.isVisible('#flight'), false, 'déjà revenu, sans animation');
    assert.equal(await page.locator('#flight').evaluate(n => n.getAnimations().length), 0);
    await page.evaluate(() => { Date.now = window.__now; Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); dispatchEvent(new Event('visibilitychange')); });
    assert.match(await volWidget(page).locator('.vol-said').textContent(), /quitté plus de 10 secondes/);
    assert.equal(await page.locator('#app').evaluate(a => a.inert), false);
    await context.close();
  }

  // 4. Téléphone, puis mouvement réduit : même retour (immédiat en mouvement réduit).
  for (const opts of [{ touch: true }, { reduced: true }]) {
    const { page, context } = await open(opts.touch ? { width: 390, height: 844 } : { width: 1440, height: 900 }, opts.touch ? 'tel' : 'reduit', opts);
    await page.getByRole('button', { name: 'Déchirer et décoller' }).click();
    await takeOff(page);
    await cancel(page);
    if (opts.reduced) assert.equal(await page.isVisible('#flight'), false, 'mouvement réduit : retour immédiat');
    await page.waitForSelector('#flight', { state: 'hidden' });
    assert.equal(await page.locator('#app').evaluate(a => a.inert), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    if (opts.touch) await shot(page, 'vol-retour-telephone');
    await context.close();
  }

  // 5. Le store du hublot : glissé à la souris, au doigt et au clavier, jusqu'à fermer ; l'heure reste lisible ; gardé sur l'appareil.
  for (const touch of [false, true]) {
    const { page, context } = await open(touch ? { width: 390, height: 844 } : { width: 1440, height: 900 }, `store-${touch}`, { touch, reduced: true });
    await page.getByRole('button', { name: 'Déchirer et décoller' }).click();
    await takeOff(page);
    const shade = page.getByRole('slider', { name: 'Store du hublot' });
    assert.equal(await shade.getAttribute('aria-valuenow'), '15', 'à peine baissé au départ');
    const box = await shade.boundingBox(), view = await page.locator('#flight-view').boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height - 6;
    // Tirer la poignée vers le bas d'un tiers de la vitre (souris, ou doigt via des évènements tactiles).
    if (touch) {
      for (const [type, dy] of [['pointerdown', 0], ['pointermove', view.height / 6], ['pointermove', view.height / 3], ['pointerup', view.height / 3]])
        await shade.dispatchEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y + dy });
    } else {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + view.height / 3, { steps: 6 });
      await page.mouse.up();
    }
    const down = Number(await shade.getAttribute('aria-valuenow'));
    assert.ok(down >= 42 && down <= 54, `le store suit la main (${down} %)`);
    await shade.focus();
    await page.keyboard.press('End');
    assert.equal(await shade.getAttribute('aria-valuetext'), 'Fermé');
    const clock = await page.locator('#flight-clock').boundingBox();
    if (!touch) await shot(page, 'vol-store-ferme');
    await page.keyboard.press('ArrowUp');
    assert.equal(await shade.getAttribute('aria-valuenow'), '95');
    await page.keyboard.press('Home');
    assert.equal(await shade.getAttribute('aria-valuetext'), 'Ouvert');
    assert.deepEqual(await page.locator('#flight-clock').boundingBox(), clock, 'le store et le compteur de la paroi sont indépendants');
    await page.keyboard.press('PageDown');
    assert.equal(await page.evaluate(() => localStorage.getItem('renzvi:store')), '33', 'gardé sur l’appareil');
    await cancel(page);
    await page.waitForSelector('#flight', { state: 'hidden' });
    await page.reload();
    await page.waitForSelector('#board .widget:not([hidden])');
    await page.getByRole('button', { name: 'Déchirer et décoller' }).click();
    await takeOff(page);
    assert.equal(await page.getByRole('slider', { name: 'Store du hublot' }).getAttribute('aria-valuenow'), '33', 'retrouvé au vol suivant');
    await context.close();
  }

  assert.deepEqual(errors, []);
  await browser.close();
  console.log('vol-retour : tous les parcours passent');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
