// Carte du compte (site/dashboard.html, #menu) dans un vrai Chromium, sur le serveur de démo (Supabase simulé, compte de test
// « Léa Martin », lea@exemple.fr) : identité, sections repliées, lumière SpotlightCard (site/dash/spotlight.js) posée puis
// retirée, toucher à côté qui ferme sans actionner le dessous (souris et doigt), clavier, mouvement réduit.
// Lancement : NODE_PATH=~/pw/node_modules node tests/compte.check.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');
const { openMe, acctSection } = require('./menu.cjs');

(async () => {
  const srv = await start();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
  const errors = [];
  const open = async (viewport, bac, opts = {}) => {
    const context = await browser.newContext({ viewport, hasTouch: !!opts.touch, isMobile: !!opts.touch, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    if (!opts.touch) await page.mouse.move(720, 500);
    await page.goto(`${srv.url}/dashboard.html?profil=plein&bac=${bac}`);
    await page.waitForSelector('#board .widget:not([hidden])');
    return { page, context };
  };
  const isOpen = page => page.locator('#menu').evaluate(n => n.matches(':popover-open'));
  // Un écouteur de la page, comme ceux des widgets : il ne doit rien recevoir du toucher qui ferme la carte.
  const spy = page => page.evaluate(() => { window.__hits = 0; document.addEventListener('click', () => { window.__hits++; }); });

  // Le bord visible du rail sert d'ancre, y compris pendant sa transition de largeur.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'ancre');
    const account = page.locator('#menu');
    const done = () => page.waitForFunction(() => !document.getAnimations().some(
      a => a.playState === 'running' && ['bar', 'menu'].includes(a.effect?.target?.id)
    ));
    const gap = () => account.evaluate(n => n.getBoundingClientRect().left - document.querySelector('#bar').getBoundingClientRect().right);
    await page.locator('#me').click();
    await done();
    assert.ok(Math.abs(await gap() - 12) <= 1, 'rail replié : 12 px');

    // Le survol automatique est désactivé. On reproduit les états de sa transition CSS en gardant la carte ouverte.
    for (const expanded of [true, false]) {
      const transition = await page.locator('#bar').evaluateHandle((bar, expanded) => {
        document.body.classList.toggle('bar-peek', expanded);
        const width = bar.getAnimations().find(a => a.transitionProperty === 'width');
        width.pause();
        return width;
      }, expanded);
      await transition.evaluate(a => { a.currentTime = a.effect.getTiming().duration / 3; });
      await page.waitForFunction(() => {
        const rail = document.querySelector('#bar').getBoundingClientRect();
        const card = document.querySelector('#menu').getBoundingClientRect();
        return rail.width > 61 && rail.width < 243 && Math.abs(card.left - rail.right - 12) <= 1;
      });
      const bar = await page.locator('#bar').boundingBox();
      const button = await page.locator('#me').boundingBox();
      const y = button.y + button.height / 2;
      await page.mouse.move(bar.x + bar.width + 6, y, { steps: 6 });
      assert.ok(await isOpen(page), 'la carte reste ouverte dans l’espace entre le rail et la carte');
      const card = await account.boundingBox();
      await page.mouse.move(card.x + 24, y, { steps: 6 });
      assert.ok(await account.evaluate(n => n.matches(':hover')), 'la souris entre dans la carte');
      assert.ok(await isOpen(page));
      await transition.evaluate(a => a.play());
      await transition.dispose();
      await done();
      assert.ok(Math.abs(await gap() - 12) <= 1);
      await page.locator('#me').hover();
    }
    await page.keyboard.press('Escape');
    await openMe(page);
    await done();
    assert.ok(Math.abs(await gap() - 12) <= 1, 'menu déplié au clic : 12 px');
    await acctSection(page, 'Verrouillage');
    for (const viewport of [{ width: 1200, height: 380 }, { width: 1200, height: 240 }, { width: 390, height: 380 }]) {
      await page.setViewportSize(viewport);
      await done();
      assert.ok(await isOpen(page), 'la carte reste ouverte au redimensionnement');
      await page.locator('#logout').click({ trial: true });
      const logout = await page.locator('#logout').boundingBox();
      assert.ok(logout.y >= 12 && logout.y + logout.height <= viewport.height - 12);
    }
    await context.close();
  }

  // 1. Identité et premier écran : nom, adresse, initiales, plan ; tout est replié.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'carte');
    await openMe(page);
    await page.waitForSelector('#menu:popover-open');
    assert.equal(await page.textContent('#acct-name'), 'Léa Martin');
    assert.equal(await page.textContent('#who'), 'lea@exemple.fr');
    assert.equal(await page.textContent('#acct-av'), 'LM', 'initiales, sans photo');
    assert.equal(await page.textContent('#plan-nom'), 'Gratuit');
    assert.equal(await page.locator('#menu details[open]').count(), 0, 'réglages repliés au départ');
    await page.waitForFunction(() => document.getElementById('ref-count').textContent === '0 filleul');
    assert.equal(await page.textContent('#lock-state'), 'Désactivé');
    for (const name of ['Abonnement', 'Parrainage', 'Installer l\'app', 'Verrouillage de l’écran', 'Revoir les premiers pas', 'Se déconnecter'])
      assert.ok(await page.locator('#menu').locator('summary, button').filter({ hasText: name }).first().isVisible(), name);

    // Une section à la fois ; rouverte, la carte repart repliée.
    await acctSection(page, 'Parrainage');
    assert.ok(await page.isVisible('#ref-link'));
    await acctSection(page, 'Verrouillage');
    assert.equal(await page.locator('#menu details.acct-row[open]').count(), 1, 'une seule section ouverte');
    assert.ok(await page.getByRole('button', { name: 'Choisir un code' }).isVisible());
    assert.equal(await page.isVisible('.lock-more p'), false, 'les limites sont à un clic');
    await page.locator('.lock-more summary').click();
    assert.match(await page.locator('.lock-more p').textContent(), /il suffit de te reconnecter/);
    const r = await page.locator('#menu').boundingBox();
    assert.ok(r.y >= 0 && r.y + r.height <= 900, 'déplié, la carte tient dans l’écran');
    assert.ok(await page.locator('#logout').isVisible(), 'la déconnexion reste à portée');

    // Lumière : posée à l'ouverture, derrière le contenu, sans prendre les clics ; elle suit la souris.
    const light = page.locator('#menu > .spotlight-card__light');
    assert.equal(await light.count(), 1);
    assert.deepEqual(await page.locator('#menu > [class^=spotlight-card__]').evaluateAll(n => n.map(x => getComputedStyle(x).pointerEvents)), ['none', 'none', 'none', 'none']);
    await page.mouse.move(r.x + r.width / 2, r.y + 60, { steps: 6 });
    await page.waitForFunction(() => +document.querySelector('#menu > .spotlight-card__light').style.opacity > 0);
    assert.equal(await page.evaluate(() => { const b = document.getElementById('acct-name').getBoundingClientRect(); return document.elementFromPoint(b.left + 4, b.top + 4)?.id; }), 'acct-name', 'le texte reste au-dessus');

    // Clic à côté : la carte se ferme, le dashboard dessous ne reçoit rien ; le clic suivant passe.
    await spy(page);
    await page.mouse.click(1100, 450);
    await page.waitForFunction(() => !document.getElementById('menu').matches(':popover-open'));
    assert.equal(await page.evaluate(() => window.__hits), 0, 'le clic qui ferme n’actionne rien');
    await page.mouse.click(1100, 450);
    assert.equal(await page.evaluate(() => window.__hits), 1, 'le clic suivant passe normalement');
    await page.waitForTimeout(500);
    assert.equal(await page.locator('#menu [class^=spotlight-card__]').count(), 0, 'lumière retirée après fermeture');
    await openMe(page);
    await page.waitForSelector('#menu:popover-open');
    assert.equal(await page.locator('#menu details[open]').count(), 0, 'rouverte : repliée');

    // Clavier : Entrée déplie, Échap ferme et rend le focus à « Mon compte ».
    await page.locator('#menu .acct-row > summary', { hasText: 'Abonnement' }).focus();
    await page.keyboard.press('Enter');
    assert.ok(await page.isVisible('#plan-info'));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('menu').matches(':popover-open'));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'me');
    await context.close();
  }

  // 2. Téléphone : la carte tient dans l'écran au-dessus du tiroir ; toucher à côté ferme sans actionner le dessous.
  {
    const { page, context } = await open({ width: 390, height: 844 }, 'tel', { touch: true });
    await openMe(page);
    await page.waitForSelector('#menu:popover-open');
    await acctSection(page, 'Verrouillage');
    const r = await page.locator('#menu').boundingBox();
    assert.ok(r.x >= 12 && r.x + r.width <= 378 && r.y >= 0 && r.y + r.height <= 844 - 12, 'dans l’écran, avec ses marges');
    assert.ok(await page.locator('#logout').isVisible());
    await spy(page);
    await page.touchscreen.tap(195, 60);
    await page.waitForFunction(() => !document.getElementById('menu').matches(':popover-open'));
    assert.equal(await page.evaluate(() => window.__hits), 0, 'le toucher qui ferme n’actionne rien');
    assert.ok(await page.locator('#open-custom').isVisible(), 'le tiroir reste ouvert : un seul niveau se ferme');
    await context.close();
  }

  // 3. Mouvement réduit : la carte s'ouvre et se ferme sans erreur, la lumière ne flotte pas.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'reduit', { reduced: true });
    await openMe(page);
    await page.waitForSelector('#menu:popover-open');
    const r = await page.locator('#menu').boundingBox();
    await page.mouse.move(r.x + 40, r.y + 40);
    await page.waitForFunction(() => +document.querySelector('#menu > .spotlight-card__light').style.opacity > 0);
    await page.keyboard.press('Escape');
    assert.equal(await isOpen(page), false);
    await context.close();
  }

  assert.deepEqual(errors, []);
  await browser.close();
  console.log('compte : tous les parcours passent');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
