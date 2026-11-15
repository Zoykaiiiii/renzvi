// Chat du dashboard (labo ?labo=1) : îlot React construit depuis prototype/chat (site/dash/chat-ia.js), sur le serveur de démo.
// Personnage, ouverture/fermeture, brouillon et conversation gardés, message honnête « pas encore branché », défilement,
// clavier, coexistence (Disposer, vue agrandie, verrou, roue des modes, minuteur, points de Pages), téléphone et clavier virtuel.
// Lancement : NODE_PATH=~/pw/node_modules node tests/chat.check.cjs   (SHOTS=dossier pour garder les captures)
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');
const { dispose } = require('./menu.cjs');

(async () => {
  const srv = await start();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
  const errors = [];
  const shot = (page, name) => process.env.SHOTS && page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
  const open = async (viewport, bac, opts = {}) => {
    const context = await browser.newContext({ viewport, hasTouch: !!opts.touch, isMobile: !!opts.touch, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    if (!opts.touch) await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.goto(`${srv.url}/dashboard.html?profil=plein&bac=${bac}&labo=${opts.labo ?? 1}${opts.query ?? ''}`);
    await page.waitForSelector('#board .widget:not([hidden])');
    if (opts.labo !== 0) await page.waitForSelector('#renzvi-chat .chat-ia-launch');
    return { page, context };
  };
  const launch = page => page.locator('.chat-ia-launch');
  const panel = page => page.locator('#renzvi-chat-panel');
  const field = page => panel(page).locator('textarea');
  const isOpen = page => panel(page).isVisible();
  const box = async loc => loc.boundingBox();
  const inside = (a, w, h) => a.x >= 0 && a.y >= 0 && a.x + a.width <= w && a.y + a.height <= h;
  const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

  // 0. Hors labo : rien n'est chargé.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'hors', { labo: 0 });
    await page.waitForTimeout(500);
    assert.equal(await page.locator('#renzvi-chat').count(), 0, 'pas de chat hors labo');
    assert.equal(await page.locator('script[src="dash/chat-ia.js"]').count(), 0, 'le script n’est pas chargé');
    await context.close();
  }

  // 1. Ordinateur : le personnage, l'ouverture au-dessus de lui, le dashboard toujours utilisable à côté.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'bureau');
    const b = await box(launch(page));
    assert.equal(await launch(page).getAttribute('aria-label'), 'Ouvrir le chat');
    assert.equal(await launch(page).getAttribute('aria-expanded'), 'false');
    assert.ok(inside(b, 1440, 900) && b.x + b.width > 1400 && b.y + b.height > 860, `en bas à droite (${b.x},${b.y})`);
    assert.ok(b.width >= 44 && b.height >= 44, 'cible de 44 px au moins');
    assert.equal(await launch(page).locator('svg').count(), 1, 'le personnage est dessiné');
    await shot(page, 'bureau-ferme');
    const widgets = () => page.locator('#board .widget:not([hidden])').evaluateAll(w => w.map(x => { const r = x.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round).join(','); }));
    const before = await widgets();
    await launch(page).click();
    assert.equal(await isOpen(page), true);
    assert.equal(await launch(page).getAttribute('aria-expanded'), 'true');
    assert.equal(await launch(page).getAttribute('aria-label'), 'Fermer le chat');
    await page.waitForFunction(() => document.activeElement?.matches('#renzvi-chat-panel textarea'), null, { timeout: 2000 }).catch(() => assert.fail('le focus va dans la saisie'));
    await page.waitForFunction(() => !document.getElementById('renzvi-chat-panel').getAnimations().length); // fin de l'animation d'ouverture
    const p = await box(panel(page));
    assert.ok(p.width >= 380 && p.width <= 420, `largeur ${p.width}`);
    assert.ok(p.y >= 0 && p.y + p.height <= b.y, 'au-dessus du personnage, dans l’écran');
    assert.deepEqual(await widgets(), before, 'aucun widget ne bouge');
    assert.match(await panel(page).textContent(), /Pas encore branché/, 'l’état du branchement est dit');
    await shot(page, 'bureau-ouvert');
    // Le dashboard reste utilisable à côté : le minuteur démarre, le chat reste ouvert.
    await page.locator('[data-widget=minuteur]').getByRole('button', { name: 'Démarrer' }).click();
    assert.equal(await isOpen(page), true, 'le chat reste ouvert');
    // Envoyer : le message reste, une note honnête, aucune réponse inventée.
    await field(page).click();
    await page.keyboard.type('Explique-moi la mitose.');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('En deux phrases.');
    assert.equal(await field(page).inputValue(), 'Explique-moi la mitose.\nEn deux phrases.', 'Maj + Entrée va à la ligne');
    await page.keyboard.press('Enter');
    const items = panel(page).locator('ol > li');
    await items.nth(1).waitFor();
    assert.equal(await items.count(), 2);
    assert.equal(await items.nth(0).textContent(), 'Explique-moi la mitose.\nEn deux phrases.');
    assert.match(await items.nth(1).textContent(), /pas encore branché/);
    assert.equal(await field(page).inputValue(), '', 'la saisie est vidée');
    // Brouillon et conversation gardés à la fermeture (Échap), focus rendu au personnage.
    await page.keyboard.type('Brouillon en cours');
    await page.keyboard.press('Escape');
    assert.equal(await isOpen(page), false, 'Échap ferme');
    assert.equal(await launch(page).evaluate(n => n === document.activeElement), true, 'focus rendu au personnage');
    await page.keyboard.press('Enter');
    assert.equal(await isOpen(page), true, 'Entrée sur le personnage rouvre');
    await page.waitForFunction(() => document.activeElement?.matches('#renzvi-chat-panel textarea'));
    assert.equal(await field(page).inputValue(), 'Brouillon en cours', 'brouillon gardé');
    assert.equal(await items.count(), 2, 'conversation gardée');
    await shot(page, 'bureau-conversation');
    // Bouton « Réduire le chat ».
    await panel(page).getByRole('button', { name: 'Réduire le chat' }).click();
    assert.equal(await isOpen(page), false);
    assert.equal(await launch(page).evaluate(n => n === document.activeElement), true);
    // Rien d'autre n'a bougé : mode, minuteur.
    assert.equal(await page.locator('[data-widget=minuteur]').getByRole('button', { name: 'Pause' }).count(), 1, 'le minuteur tourne toujours');
    assert.match(await page.textContent('#mode-now'), /Study/);
    await context.close();
  }

  // 2. Défilement : le fil défile à l'intérieur du panneau, la page ne bouge pas, et on n'est pas ramené en bas en lisant.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'defile');
    await launch(page).click();
    for (let i = 1; i <= 14; i++) { await field(page).fill(`Message ${i}`); await page.keyboard.press('Enter'); }
    const log = panel(page).locator('[role=log]');
    await page.waitForFunction(() => [...document.querySelectorAll('#renzvi-chat-panel ol > li')].some(li => li.textContent === 'Message 14'));
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
    const m = await log.evaluate(n => ({ top: n.scrollTop, max: n.scrollHeight - n.clientHeight }));
    assert.ok(m.max > 100, 'le fil déborde et défile');
    assert.ok(m.max - m.top < 4, `son propre envoi ramène en bas (${JSON.stringify(m)})`);
    const y0 = await page.evaluate(() => scrollY);
    const lb = await box(log);
    await page.mouse.move(lb.x + lb.width / 2, lb.y + 60);
    await page.mouse.wheel(0, -2000);
    await page.waitForFunction(() => document.querySelector('#renzvi-chat-panel [role=log]').scrollTop === 0, null, { timeout: 3000 }).catch(() => assert.fail('remonté dans le fil'));
    assert.equal(await page.evaluate(() => scrollY), y0, 'la page ne défile pas');
    // Fermer puis rouvrir pendant la lecture : on reste où on était.
    await panel(page).getByRole('button', { name: 'Réduire le chat' }).click();
    assert.equal(await isOpen(page), false);
    await launch(page).click();
    await page.waitForTimeout(100);
    assert.equal(await log.evaluate(n => n.scrollTop), 0, 'la lecture n’est pas interrompue');
    await context.close();
  }

  // 3. Coexistence : appui long sur le chat (pas de roue des modes), Disposer, vue agrandie, verrou.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'ensemble');
    await launch(page).click();
    const pb = await box(panel(page).locator('[role=log]'));
    await page.mouse.move(pb.x + 40, pb.y + 80);
    await page.mouse.down();
    await page.waitForTimeout(800);
    await page.mouse.up();
    assert.equal(await page.locator('dialog.mode-wheel[open]').count(), 0, 'pas de roue des modes depuis le chat');
    await dispose(page);
    assert.equal(await page.locator('#renzvi-chat').isVisible(), false, 'caché pendant Disposer');
    await page.click('#custom-done');
    assert.equal(await isOpen(page), true, 'revient ouvert après Disposer');
    await page.getByRole('button', { name: 'Agrandir Minuteur focus' }).click();
    assert.equal(await page.locator('#renzvi-chat').isVisible(), false, 'caché pendant la vue agrandie');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.documentElement.classList.contains('zoom-lock'));
    await page.evaluate(() => document.body.classList.add('locked'));
    assert.equal(await page.locator('#renzvi-chat').isVisible(), false, 'jamais par-dessus le verrou');
    await page.evaluate(() => document.body.classList.remove('locked'));
    assert.equal(await field(page).inputValue(), '', 'rien n’a été tapé à notre insu');
    await context.close();
  }

  // 4. Présentation Pages : le personnage ne cache pas les points de pagination.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'pages', { query: '&vues=1' });
    await page.locator('#vue-pick').getByRole('button', { name: 'Pages' }).click();
    await page.waitForSelector('.board[data-vue=pages]');
    const dots = page.locator('.pg-dots');
    if (await dots.isVisible()) assert.equal(overlap(await box(dots), await box(launch(page))), false, 'points de pagination dégagés');
    await shot(page, 'pages');
    await context.close();
  }

  // 5. Téléphone : une feuille sur toute la largeur, la saisie reste visible quand le clavier réduit l'écran.
  {
    const { page, context } = await open({ width: 390, height: 844 }, 'tel', { touch: true });
    const b = await box(launch(page));
    assert.ok(inside(b, 390, 844), 'personnage dans l’écran');
    await shot(page, 'telephone-ferme');
    await launch(page).tap();
    assert.equal(await isOpen(page), true);
    await page.waitForFunction(() => !document.getElementById('renzvi-chat-panel').getAnimations().length); // fin de l'animation d'ouverture
    const p = await box(panel(page));
    assert.ok(p.x <= 1 && p.width >= 388, `toute la largeur (${JSON.stringify(p)})`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'pas de défilement de côté');
    assert.equal(await launch(page).isVisible(), false, 'le personnage s’efface sous la feuille');
    await field(page).fill('Une question au téléphone');
    await shot(page, 'telephone-ouvert');
    // Clavier virtuel : la partie visible passe à 450 px de haut.
    await page.setViewportSize({ width: 390, height: 450 });
    await page.waitForTimeout(300);
    const f = await box(field(page));
    assert.ok(f.y + f.height <= 450, `saisie visible au-dessus du clavier (${Math.round(f.y + f.height)})`);
    await shot(page, 'telephone-clavier');
    await page.setViewportSize({ width: 390, height: 844 });
    await panel(page).getByRole('button', { name: 'Réduire le chat' }).tap();
    assert.equal(await isOpen(page), false);
    assert.equal(await launch(page).isVisible(), true);
    await launch(page).tap();
    assert.equal(await field(page).inputValue(), 'Une question au téléphone', 'brouillon gardé');
    await context.close();
  }

  // 6. Mouvement réduit : pas d'animation à l'ouverture.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'reduit', { reduced: true });
    await launch(page).click();
    assert.equal(await panel(page).evaluate(n => getComputedStyle(n).transitionDuration.split(',').every(d => d.trim() === '0s')), true);
    await context.close();
  }

  assert.deepEqual(errors, [], 'aucune erreur de page');
  await browser.close();
  srv.close?.();
  console.log('chat OK');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
