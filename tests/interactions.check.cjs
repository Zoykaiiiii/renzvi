// Interactions du dashboard (dossier site/dash/), dans un vrai Chromium, sur le serveur de démo (Supabase simulé en mémoire).
// Minuteur (cadran, préréglages et champs synchronisés, temps réel, rechargement), appui long et roue des modes,
// création d'un mode, taille fine et repli des widgets, verrou de l'appareil, téléphone.
// Lancement : NODE_PATH=~/pw/node_modules node tests/interactions.check.cjs   (SHOTS=dossier pour garder les captures)
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');
const { custom, dispose, openMe, acctSection, modeNow, options, showMenu } = require('./menu.cjs');

(async () => {
  const srv = await start();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
  const errors = [];
  const shot = (page, name) => process.env.SHOTS && page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
  const open = async (viewport, bac, opts = {}) => {
    const context = await browser.newContext({ viewport, hasTouch: !!opts.touch, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    if (opts.clock) await page.clock.install();
    await page.goto(`${srv.url}/dashboard.html?profil=plein&bac=${bac}`);
    await page.waitForSelector('#board .widget:not([hidden])');
    return { page, context, db: srv.bac('plein', bac) };
  };
  const saved = page => page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
  // Attend qu'une valeur enregistrée (côté serveur simulé) devienne vraie : l'enregistrement est différé.
  const until = async (test, what) => { for (let i = 0; i < 60; i++) { if (test()) return; await new Promise(r => setTimeout(r, 100)); } assert.fail(what); };
  const timer = page => page.locator('.widget[data-widget=minuteur]');
  const wheelOpen = page => page.evaluate(() => !!document.querySelector('dialog.mode-wheel[open]'));
  // Appui sur un point libre : le bandeau « Bonjour » (pas un contrôle, pas un widget).
  async function press(page, ms, { dx = 0, target = '.hello' } = {}) {
    await page.locator(target).first().scrollIntoViewIfNeeded();
    const b = await page.locator(target).first().boundingBox();
    const x = target === '.hello' ? b.x + b.width - 60 : b.x + b.width / 2, y = b.y + b.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    if (dx) await page.mouse.move(x + dx, y, { steps: 2 });
    await page.waitForTimeout(ms);
    await page.mouse.up();
  }

  // 1. Minuteur : préréglage, cadran et champs restent d'accord, sans boucle.
  {
    const { page, context, db } = await open({ width: 1440, height: 900 }, 'minuteur');
    const t = timer(page), dial = t.getByRole('slider', { name: 'Durée de la session' });
    const mm = t.getByRole('textbox', { name: 'Minutes' }), ss = t.getByRole('textbox', { name: 'Secondes' });
    assert.equal(await dial.getAttribute('aria-valuenow'), '25');
    assert.equal(await mm.inputValue(), '25');
    await t.getByRole('button', { name: '15 min' }).click();
    assert.equal(await dial.getAttribute('aria-valuenow'), '15', 'préréglage → cadran');
    assert.equal(await mm.inputValue(), '15', 'préréglage → champs');
    await dial.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    assert.equal(await mm.inputValue(), '17', 'cadran → champs');
    assert.equal(await t.getByRole('button', { name: '15 min' }).getAttribute('aria-pressed'), 'false');
    await mm.fill('42'); await ss.fill('30'); await ss.press('Enter');
    assert.equal(await dial.getAttribute('aria-valuetext'), 'Durée 42:30', 'champs → cadran');
    assert.equal(await t.locator('.focus-time').textContent(), '42:30');
    // Saisie invalide : message en mots, la durée ne change pas.
    await ss.fill('75'); await ss.press('Enter');
    assert.match(await t.locator('.timer-note').textContent(), /secondes vont de 0 à 59/);
    assert.equal(await ss.getAttribute('aria-invalid'), 'true');
    await mm.fill('0'); await ss.fill('05'); await ss.press('Enter');
    assert.match(await t.locator('.timer-note').textContent(), /entre 0:10 et 180:00/);
    assert.equal(await t.locator('.focus-time').textContent(), '42:30');
    // Glisser sur le cadran : la valeur suit, les champs aussi.
    const box = await dial.boundingBox();
    await page.mouse.move(box.x + box.width * .15, box.y + box.height * .3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * .85, box.y + box.height * .3, { steps: 10 });
    await page.mouse.up();
    const dragged = Number(await dial.getAttribute('aria-valuenow'));
    assert.ok(dragged > 60 && dragged < 180, `glisser (${dragged})`);
    await page.waitForTimeout(600);
    assert.equal(await mm.inputValue(), String(Number(await dial.getAttribute('aria-valuenow'))));
    await t.getByRole('button', { name: '25 min' }).click();
    await shot(page, 'minuteur-cadran');
    await t.locator('.timer-dial').screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/minuteur-detail.png` : '/dev/null' }).catch(() => {});
    // Pendant une session : cadran, champs et préréglages bloqués, avec la raison écrite.
    await t.getByRole('button', { name: 'Démarrer' }).click();
    assert.equal(await mm.isDisabled(), true);
    assert.equal(await dial.getAttribute('aria-disabled'), 'true');
    assert.match(await t.locator('.timer-note').textContent(), /Remets à zéro/);
    assert.match(await t.locator('.meta').textContent(), /^En cours · 2[45]:/);
    await saved(page);
    assert.ok(Number.isFinite(db.rows.minuteur.run?.end), 'heure de fin enregistrée');
    await context.close();
  }

  // 2. Minuteur : temps réel, pause, rechargement pendant la session, fin comptée une fois.
  {
    const { page, context, db } = await open({ width: 1440, height: 900 }, 'temps', { clock: true });
    const t = timer(page);
    const before = db.rows.minuteur.minutes;
    await t.getByRole('textbox', { name: 'Minutes' }).fill('1');
    await t.getByRole('textbox', { name: 'Secondes' }).fill('30');
    await t.getByRole('textbox', { name: 'Secondes' }).press('Enter');
    await t.getByRole('button', { name: 'Démarrer' }).click();
    await page.clock.runFor(30000);
    assert.match(await t.locator('.focus-time').textContent(), /^(01:00|00:59)$/);
    await t.getByRole('button', { name: 'Pause' }).click();
    const paused = await t.locator('.focus-time').textContent();
    await page.clock.runFor(60000);
    assert.equal(await t.locator('.focus-time').textContent(), paused, 'la pause arrête le temps');
    await t.getByRole('button', { name: 'Reprendre' }).click();
    await page.clock.runFor(3000);
    await saved(page);
    // Rechargement : la session reprend là où elle en est.
    await page.reload();
    await page.waitForSelector('#board .widget:not([hidden])');
    assert.match(await t.locator('.focus-time').textContent(), /^00:5\d$/);
    assert.equal(await t.getByRole('button', { name: 'Pause' }).count(), 1);
    await page.clock.runFor(60000);
    assert.equal(await page.title(), 'Session terminée — Renzvi');
    await page.clock.runFor(3000);
    await saved(page);
    assert.equal(db.rows.minuteur.minutes, before + 2, 'arrondi à la minute, compté une fois');
    assert.equal(db.rows.minuteur.run, null);
    await page.clock.runFor(60000);
    assert.equal(db.rows.minuteur.minutes, before + 2, 'pas compté deux fois');
    await context.close();
  }

  // 3. Appui long : annulé s'il est trop court, si le doigt bouge, sur un contrôle ; ouvre la roue sinon.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'roue');
    await press(page, 250);
    assert.equal(await wheelOpen(page), false, 'trop court');
    await press(page, 750, { dx: 30 });
    assert.equal(await wheelOpen(page), false, 'le doigt a bougé');
    await showMenu(page);
    await press(page, 750, { target: '#open-add' });
    assert.equal(await wheelOpen(page), false, 'sur un bouton');
    // Un appui long sur un bouton reste un clic normal (ici, le catalogue s'ouvre) : on le referme.
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    // Dans un champ de texte : la sélection garde la main.
    await press(page, 750, { target: '.widget[data-widget=notes] .notes' });
    assert.equal(await wheelOpen(page), false, 'dans les notes');
    const before = await modeNow(page);
    await press(page, 750);
    assert.equal(await wheelOpen(page), true, 'appui long');
    assert.equal(await modeNow(page), before, 'le relâchement ne choisit rien');
    const items = page.locator('.mode-wheel [role=option]');
    assert.deepEqual(await items.allInnerTexts().then(a => a.map(x => x.replace(/\s+/g, ' ').trim())), ['S Study Actuel', 'C Chill', 'Créer un mode']);
    await page.waitForFunction(() => !document.getAnimations().some(a => a.playState === 'running'));
    await shot(page, 'roue-ouverte');
    // Le panneau reste dans l'écran.
    const r = await page.locator('.mode-wheel__panel').boundingBox();
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= 1440 && r.y + r.height <= 900);
    // Clavier : flèche puis Entrée choisit Chill ; la roue se ferme.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.querySelector('dialog.mode-wheel[open]'));
    assert.equal(await modeNow(page), 'Chill');
    // Échap ferme sans rien changer ; clic à côté aussi.
    await press(page, 750);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog.mode-wheel[open]'));
    await press(page, 750);
    await page.mouse.click(5, 5);
    await page.waitForFunction(() => !document.querySelector('dialog.mode-wheel[open]'));
    assert.equal(await modeNow(page), 'Chill');
    // Le bouton « Changer de mode » du menu fait la même chose, au clavier.
    await page.mouse.move(720, 450); // la souris quitte le bord gauche, qui ouvre le menu au survol
    await page.waitForFunction(() => !document.body.classList.contains('bar-peek'));
    await page.locator('#bar-toggle').focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Changer de mode' }).focus();
    await page.keyboard.press('Enter');
    assert.equal(await wheelOpen(page), true, 'bouton du menu');
    await page.locator('.mode-wheel [role=option]').first().click();
    await page.waitForFunction(() => !document.querySelector('dialog.mode-wheel[open]'));
    assert.equal(await modeNow(page), 'Study');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'bar-toggle', 'le focus revient au bouton de la pastille');
    // Changements de mode rapides, minuteur en cours : il continue, rien n'est remonté.
    await timer(page).getByRole('button', { name: 'Démarrer' }).click();
    for (let i = 0; i < 4; i++) {
      await showMenu(page);
      await page.getByRole('button', { name: 'Changer de mode' }).click();
      await page.locator('.mode-wheel [role=option]').nth(i % 2 ? 0 : 1).click();
    }
    await page.waitForFunction(() => !document.querySelector('dialog.mode-wheel[open]'));
    assert.equal(await page.locator('.widget[data-widget=minuteur]').count(), 1, 'un seul minuteur');
    assert.equal(await timer(page).getByRole('button', { name: 'Pause' }).count(), 1, 'toujours en cours');
    await context.close();
  }

  // 4. Créer un mode : validation, icône, couleur, enregistrement, présent partout.
  {
    const { page, context, db } = await open({ width: 1440, height: 900 }, 'creer');
    // Depuis Personnaliser > Espace actuel : la même fenêtre que dans la roue.
    await custom(page);
    await page.locator('#page-new').click();
    const dlg = page.locator('dialog.mode-create');
    await dlg.getByRole('button', { name: 'Créer le mode' }).click();
    assert.equal(await dlg.locator('.mc-err').textContent(), 'Donne un nom à ce mode.');
    await dlg.getByLabel('Nom du mode').fill('study');
    await dlg.getByRole('button', { name: 'Créer le mode' }).click();
    assert.equal(await dlg.locator('.mc-err').textContent(), 'Un mode porte déjà ce nom.');
    await dlg.getByLabel('Nom du mode').fill('Sport');
    await dlg.getByRole('radio', { name: 'Sport' }).check({ force: true });
    await dlg.getByRole('radio', { name: 'Bleu' }).check({ force: true });
    await shot(page, 'creer-mode');
    await dlg.getByRole('button', { name: 'Créer le mode' }).click();
    assert.equal(await modeNow(page), 'Sport');
    assert.equal(await page.textContent('#page-current'), 'Sport', 'le panneau suit le nouveau mode');
    assert.equal(await page.locator('#board-empty').isVisible(), true, 'mode vide, invitation à ajouter');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), '#1c5699', 'couleur du mode');
    await saved(page);
    const sport = db.rows.ecran.pages.find(p => p.name === 'Sport');
    assert.deepEqual({ icon: sport.icon, accent: sport.accent, wall: sport.wall }, { icon: 'sport', accent: 'bleu', wall: 'blanc' });
    assert.equal(Object.values(db.rows.ecran.where).includes(sport.id), false, 'aucun widget copié');
    // Rechargement : le mode est là, dans le menu et dans la roue.
    await page.reload();
    await page.waitForSelector('#board .widget:not([hidden]), #board-empty:not([hidden])');
    assert.equal(await modeNow(page), 'Sport');
    await showMenu(page);
    await page.getByRole('button', { name: 'Changer de mode' }).click();
    assert.ok((await page.locator('.mode-wheel [role=option]').allInnerTexts()).some(t => /Sport/.test(t)));
    await page.keyboard.press('Escape');
    await context.close();
  }

  // 5. Taille fine et repli : poignée (souris, clavier, Échap), préréglage, repli qui garde le minuteur, remise à zéro.
  {
    const { page, context, db } = await open({ width: 1440, height: 900 }, 'taille');
    await dispose(page);
    const notes = page.locator('.widget[data-widget=notes]');
    const handle = notes.locator('.resize-handle');
    // Le panneau « Disposer » couvre le bas de l'écran : le widget est amené en haut.
    await notes.evaluate(n => { n.scrollIntoView({ block: 'start' }); scrollBy(0, -90); });
    const nb = await notes.boundingBox(), hb = await handle.boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(nb.x + nb.width * 1.55, nb.y + 360, { steps: 8 });
    await shot(page, 'redimensionner');
    await page.mouse.up();
    await saved(page);
    const { spans, heights } = db.rows.ecran;
    assert.ok(spans.notes >= 5 && spans.notes <= 7, `colonnes (${spans.notes})`);
    assert.equal(heights.notes % 8, 0);
    assert.ok(Math.abs((await notes.boundingBox()).height - heights.notes) < 2, 'hauteur appliquée');
    // Échap pendant le geste : retour à la taille d'avant, rien d'enregistré.
    const hb2 = await handle.boundingBox();
    await page.mouse.move(hb2.x + 10, hb2.y + 10);
    await page.mouse.down();
    await page.mouse.move(hb2.x + 300, hb2.y + 200, { steps: 5 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    assert.equal(await notes.getAttribute('data-span'), String(spans.notes), 'Échap annule');
    assert.equal(await wheelOpen(page), false, 'pas de roue en mode Disposer, même après un long geste');
    // Clavier.
    await handle.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await until(() => db.rows.ecran.spans.notes === spans.notes + 1 && db.rows.ecran.heights.notes === heights.notes + 32, `taille au clavier enregistrée (attendu ${spans.notes + 1}/${heights.notes + 32}, reçu ${JSON.stringify([db.rows.ecran.spans, db.rows.ecran.heights])}, écran ${await notes.getAttribute('data-span')}/${await notes.getAttribute('data-h')}, focus ${await page.evaluate(() => document.activeElement.className)})`);
    // Un préréglage remplace la taille fine.
    await options(page, 'Notes');
    await notes.locator('.edit').getByRole('button', { name: 'Petit' }).click();
    await saved(page);
    assert.equal(db.rows.ecran.spans.notes, undefined);
    // Le contenu ne bouge pas pendant tout ça.
    assert.match(await notes.locator('.notes').inputValue(), /Idées pour le mémoire/);
    await page.locator('#custom-done').click();
    // Replier le minuteur en cours : il continue, l'état reste lisible, il revient à sa taille.
    const t = timer(page);
    await t.getByRole('button', { name: 'Démarrer' }).click();
    const h0 = (await t.boundingBox()).height;
    await t.getByRole('button', { name: 'Replier Minuteur focus' }).click();
    assert.equal(await t.locator('.body').isVisible(), false);
    assert.match(await t.locator('.meta').textContent(), /^En cours/);
    await page.waitForTimeout(300);
    await shot(page, 'replie');
    await page.waitForTimeout(1200);
    await t.getByRole('button', { name: 'Déplier Minuteur focus' }).click();
    assert.equal(await t.getByRole('button', { name: 'Pause' }).count(), 1, 'toujours en cours');
    await page.waitForFunction(() => !document.getAnimations().some(a => a.playState === 'running' && a.effect?.target?.closest?.('.widget')));
    assert.ok(Math.abs((await t.boundingBox()).height - h0) < 2, `même taille qu'avant (${h0} → ${(await t.boundingBox()).height})`);
    await t.getByRole('button', { name: 'Replier Minuteur focus' }).click();
    await saved(page);
    assert.deepEqual(db.rows.ecran.collapsed, ['minuteur']);
    await page.reload();
    await page.waitForSelector('#board .widget:not([hidden])');
    assert.equal(await timer(page).getAttribute('data-collapsed'), '', 'replié après rechargement');
    // Remise à zéro de la disposition : contenu intact.
    await custom(page);
    await page.locator('#layout-reset').click();
    assert.match(await page.textContent('#page-dialog'), /contenu des widgets ne changent pas/, 'la conséquence est dite avant');
    await page.locator('#page-dialog').getByRole('button', { name: 'Annuler' }).click();
    assert.equal(await timer(page).getAttribute('data-collapsed'), '', 'annuler ne touche à rien');
    await page.locator('#layout-reset').click();
    await page.locator('#page-dialog .primary').click();
    await saved(page);
    assert.deepEqual(db.rows.ecran.collapsed, []);
    assert.match(await page.locator('.widget[data-widget=notes] .notes').inputValue(), /Idées pour le mémoire/);
    await context.close();
  }

  // 6. Verrou de l'appareil : réglage, code trop simple refusé, verrouillage, erreurs, rechargement, code oublié.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'verrou');
    const typeCode = async code => { await page.keyboard.type(code, { delay: 20 }); await page.waitForTimeout(500); };
    // Le verrou est sous le compte, pas dans Personnaliser.
    await openMe(page);
    await acctSection(page, 'Verrouillage');
    await page.getByRole('button', { name: 'Choisir un code' }).click();
    await typeCode('123456');
    assert.match(await page.locator('#lock-setup-msg').textContent(), /trop facile/);
    await typeCode('482915');
    await typeCode('482916');
    assert.match(await page.locator('#lock-setup-msg').textContent(), /pas identiques/);
    await typeCode('482915');
    await typeCode('482915');
    await page.waitForFunction(() => !document.querySelector('dialog.lock-setup[open]'));
    const stored = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('renzvi:verrou')).map(([, v]) => v).join(''));
    assert.ok(stored.includes('"hash"') && !stored.includes('482915'), 'empreinte seulement, jamais le code');
    if (!await page.locator('#menu').evaluate(n => n.matches(':popover-open'))) await openMe(page);
    await acctSection(page, 'Verrouillage');
    await page.locator('.lock-set').screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/verrou-reglages.png` : '/dev/null' }).catch(() => {});
    await page.getByRole('button', { name: 'Verrouiller maintenant' }).click();
    assert.equal(await page.locator('.lock-screen').isVisible(), true);
    assert.equal(await page.locator('dialog[open]').count(), 0, 'les réglages se ferment');
    assert.equal(await page.evaluate(() => document.getElementById('app').inert), true, 'le dashboard est inerte');
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('code-slots__input')), true, 'le focus est dans le verrou');
    // Rien ne passe à travers : ni appui long, ni Tab hors du verrou.
    await page.mouse.move(700, 450); await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up();
    assert.equal(await wheelOpen(page), false);
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => !!document.activeElement?.closest('.lock-screen')), true, 'Tab reste dans le verrou');
    await page.locator('.lock-screen .code-slots__input').focus();
    await typeCode('000000');
    assert.match(await page.locator('#lock-msg').textContent(), /Code incorrect\. Encore 4 essais/);
    await shot(page, 'verrou-erreur');
    // Rechargement : verrouillé avant tout affichage.
    await page.reload();
    await page.waitForSelector('.lock-screen:not([hidden])');
    assert.equal(await page.evaluate(() => document.getElementById('app').inert), true);
    await shot(page, 'verrou-ecran');
    await typeCode('482915');
    await page.waitForSelector('.lock-screen', { state: 'hidden' });
    assert.equal(await page.evaluate(() => document.getElementById('app').inert), false, 'déverrouillé');
    // Trop d'essais : attente imposée.
    await page.getByRole('button', { name: 'Verrouiller maintenant' }).click({ force: true }).catch(() => {});
    await page.evaluate(() => document.querySelector('.lock-set .primary')?.click());
    if (!(await page.locator('.lock-screen').isVisible())) {
      await openMe(page);
      await acctSection(page, 'Verrouillage');
      await page.getByRole('button', { name: 'Verrouiller maintenant' }).click();
    }
    for (let i = 0; i < 5; i++) {
      await page.waitForFunction(() => !document.querySelector('.lock-screen .code-slots__input').disabled);
      await page.locator('.lock-screen .code-slots__input').focus();
      await typeCode('111111');
      await page.waitForTimeout(400);
    }
    await page.waitForFunction(() => /Trop d’essais\. Réessaie dans \d+ s/.test(document.getElementById('lock-msg').textContent));
    assert.equal(await page.locator('.lock-screen .code-slots__input').isDisabled(), true, 'saisie bloquée pendant l\'attente');
    // Code oublié : déconnexion, le verrou de l'appareil est retiré, aucun contenu touché.
    await page.getByRole('button', { name: 'Code oublié ?' }).click();
    await page.getByRole('button', { name: 'Me déconnecter' }).click();
    await page.waitForURL(/login/);
    assert.equal(await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('renzvi:verrou'))), false);
    await context.close();
  }

  // 7. Téléphone : menu en tiroir, pas de poignée de taille, roue utilisable, pas de débordement.
  {
    const { page, context } = await open({ width: 390, height: 844 }, 'tel', { touch: true });
    assert.equal(await page.locator('#bar-nav').isVisible(), false);
    await page.getByRole('button', { name: 'Afficher le menu' }).click();
    assert.equal(await page.locator('#bar-nav').isVisible(), true);
    await shot(page, 'telephone-menu');
    await showMenu(page);
    await page.getByRole('button', { name: 'Changer de mode' }).click();
    assert.equal(await wheelOpen(page), true);
    await page.waitForFunction(() => !document.getAnimations().some(a => a.playState === 'running'));
    const r = await page.locator('.mode-wheel__panel').boundingBox();
    assert.ok(r.x >= 0 && r.x + r.width <= 390, `la roue tient dans l'écran (${JSON.stringify(r)})`);
    await page.waitForFunction(() => !document.getAnimations().some(a => a.playState === 'running'));
    await shot(page, 'telephone-roue');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog.mode-wheel[open]'));
    await dispose(page);
    assert.equal(await page.locator('.resize-handle').first().isVisible(), false);
    await page.locator('#custom-done').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.evaluate(() => scrollTo(0, 0));
    await shot(page, 'telephone');
    await context.close();
  }

  // 8. Mouvement réduit : la roue s'ouvre et se ferme sans animation, le minuteur marche.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'reduit', { reduced: true });
    await press(page, 750);
    assert.equal(await wheelOpen(page), true);
    await page.keyboard.press('Escape');
    assert.equal(await wheelOpen(page), false, 'fermée tout de suite');
    await context.close();
  }

  assert.deepEqual(errors, []);
  await browser.close();
  srv.close?.();
  console.log('interactions : OK');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
