// Menu latéral du dashboard, dans un vrai Chromium, sur le serveur de démo (Supabase simulé en mémoire).
// Ouverture et repli par le bouton, tiroir sur téléphone, « Changer de mode », favoris, Personnaliser d'un seul tenant,
// compte et verrou, enregistrement en panne, mouvement réduit.
// Lancement : NODE_PATH=~/pw/node_modules node tests/menu-lateral.check.cjs   (SHOTS=dossier pour garder les captures)
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');
const { custom, closeCustom, dispose, openMe, acctSection, goMode, modeNow, showMenu } = require('./menu.cjs');

(async () => {
  const srv = await start();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
  const errors = [];
  const shot = (page, name) => process.env.SHOTS && page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
  const open = async (viewport, bac, opts = {}) => {
    const context = await browser.newContext({ viewport, hasTouch: !!opts.touch, isMobile: !!opts.touch, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    if (!opts.touch) await page.mouse.move(720, 500);
    await page.goto(`${srv.url}/dashboard.html?profil=plein&bac=${bac}`);
    await page.waitForSelector('#board .widget:not([hidden])');
    return { page, context, db: srv.bac('plein', bac) };
  };
  const saved = page => page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
  const until = async (test, what) => { for (let i = 0; i < 60; i++) { if (test()) return; await new Promise(r => setTimeout(r, 100)); } assert.fail(what); };
  const settle = page => page.waitForFunction(() => !document.getAnimations().some(a => a.playState === 'running'));
  const toggle = page => page.locator('#bar-toggle');

  // 1. Grand écran : le pointeur ne change pas l'état du rail. Le mode ouvre la roue.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'survol');
    const nav = page.getByRole('navigation', { name: 'Menu de ton écran' });
    const shown = () => page.evaluate(() => document.body.classList.contains('drawer-open'));
    assert.equal(await shown(), false, 'au départ, le rail fermé');
    assert.equal(await toggle(page).getAttribute('aria-expanded'), 'false');
    assert.equal(await toggle(page).getAttribute('aria-label'), 'Afficher le menu');
    const rail = await page.locator('#bar').boundingBox();
    assert.ok(rail.width <= 64, `un rail étroit (${rail.width})`);
    assert.ok(rail.height < 800 && Math.abs(rail.y + rail.height / 2 - 450) <= 2, `compact et centré (${rail.y}, ${rail.height})`);
    assert.equal(await page.getByRole('button', { name: 'Ajouter un widget' }).isVisible(), true, 'icônes visibles');
    assert.ok((await page.locator('#open-add > span').evaluate(n => n.getBoundingClientRect().width)) <= 1, 'libellés cachés à l’œil, gardés pour les lecteurs d’écran');
    const mode = page.locator('#bar-mode');
    assert.equal(await mode.textContent(), 'Study');
    assert.equal(await mode.evaluate(n => !n.closest('#bar')), true, 'le mode est hors du menu');
    const mb = await mode.boundingBox();
    assert.ok(mb.x < 40 && mb.y < 40, `en haut à gauche (${mb.x}, ${mb.y})`);
    assert.equal(await page.evaluate(() => !!document.elementFromPoint(120, 600)?.closest('#bar')), false, 'rien d’invisible ne bloque les clics');
    const boxes = () => page.locator('#board .widget:not([hidden])').evaluateAll(w => w.map(x => { const r = x.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round).join(','); }));
    const before = await boxes();
    await shot(page, 'menu-rail');
    assert.equal(await page.locator('body [title], svg title, [role=tooltip]').count(), 0);
    const logo = page.getByRole('link', { name: 'Renzvi, accueil' });
    await logo.focus();
    assert.equal(await logo.evaluate(el => el === document.activeElement), true);
    await logo.blur();
    await page.mouse.move(0, 450, { steps: 16 });
    await page.waitForTimeout(400);
    assert.equal(await shown(), false, 'le bord gauche ne déclenche rien');
    await toggle(page).hover();
    await page.waitForTimeout(400);
    assert.equal(await toggle(page).getAttribute('aria-expanded'), 'false', 'le survol du rail ne l’ouvre pas');
    // Clic : ouvert par-dessus l'écran, avec les libellés.
    await toggle(page).click();
    await settle(page);
    assert.equal(await shown(), true, 'le clic ouvre');
    assert.equal(await toggle(page).getAttribute('aria-expanded'), 'true');
    assert.equal(await toggle(page).getAttribute('aria-label'), 'Masquer le menu');
    assert.deepEqual(await nav.getByRole('button').evaluateAll(b => b.filter(x => x.offsetParent).map(x => x.id || x.className)), ['open-add', 'open-modes', 'favs-edit', 'open-custom', 'me']);
    assert.equal(await page.getByRole('button', { name: 'Réglages', exact: true }).count(), 0, 'plus de bouton Réglages séparé');
    assert.equal(await page.locator('#bar').getByText('Chill', { exact: true }).count(), 0, 'les modes ne sont plus listés');
    assert.equal(await modeNow(page), 'Study');
    assert.deepEqual(await boxes(), before, 'aucun widget ne bouge');
    assert.ok((await page.locator('#bar').boundingBox()).width >= 240, 'ouvert avec les libellés');
    assert.equal(await mode.isVisible(), false, 'le mode en gras se cache pendant que le menu est ouvert');
    await shot(page, 'menu-ouvert');
    await page.mouse.move(720, 500, { steps: 12 });
    await page.waitForTimeout(400);
    assert.equal(await shown(), true, 'le rail reste ouvert quand la souris le quitte');
    await toggle(page).click();
    assert.equal(await shown(), false, 'fermé tout de suite');
    assert.equal(await toggle(page).getAttribute('aria-expanded'), 'false');
    await page.waitForTimeout(400);
    assert.equal(await shown(), false, 'reste fermé sous la souris');
    // Le menu du compte s'ouvre aussi depuis le rail fermé ; Échap rend le focus.
    await page.click('#me');
    await page.waitForSelector('#menu:popover-open');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#menu:popover-open', { state: 'detached' }).catch(() => {});
    assert.equal(await page.evaluate(() => document.activeElement.id), 'me', 'Échap rend le focus à « Mon compte »');
    // Le mode ouvre la roue des modes.
    await mode.click();
    await page.waitForSelector('dialog.mode-wheel[open]');
    await page.keyboard.press('Escape');
    await context.close();
  }

  // 1 bis. Clavier : ouvrir, parcourir, fermer ; le focus revient au bouton.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'clavier');
    const shown = () => page.evaluate(() => document.body.classList.contains('drawer-open'));
    await toggle(page).focus();
    await page.keyboard.press('Enter');
    assert.equal(await shown(), true, 'Entrée ouvre');
    assert.equal(await toggle(page).getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'open-add', 'Tab entre dans le menu');
    await page.keyboard.press('Escape');
    assert.equal(await shown(), true, 'Échap laisse le menu ouvert');
    await page.mouse.click(1200, 80);
    assert.equal(await shown(), true, 'un clic à côté laisse le menu ouvert');
    await toggle(page).press('Space');
    assert.equal(await shown(), false, 'Espace replie');
    await toggle(page).press('Space');
    assert.equal(await shown(), true, 'Espace ouvre');
    await toggle(page).press('Enter');
    assert.equal(await shown(), false, 'Entrée replie');
    // L'ancien choix « ouvert » gardé sur l'appareil ne laisse plus le menu ouvert en permanence.
    await page.evaluate(() => localStorage.setItem('renzvi:menu', 'ouvert'));
    await page.reload();
    await page.waitForSelector('#board .widget:not([hidden])');
    assert.equal(await shown(), false, 'pastille au rechargement');
    await context.close();
  }

  // 1 ter. Un geste en cours garde la priorité : glisser un widget jusqu'au bord gauche n'ouvre pas le menu.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'geste');
    await dispose(page);
    await toggle(page).click();
    await page.mouse.move(720, 500);
    await page.waitForFunction(() => !document.body.classList.contains('drawer-open'));
    const grip = page.locator('[data-widget=minuteur] .grip');
    const g = await grip.boundingBox();
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(300, 300, { steps: 8 });
    await page.mouse.move(4, 300, { steps: 12 });
    await page.mouse.move(30, 60, { steps: 6 });
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => document.body.classList.contains('dragging')), true, 'le glisser continue');
    assert.equal(await page.evaluate(() => document.body.classList.contains('drawer-open')), false, 'pas de menu pendant le glisser');
    await page.mouse.up();
    assert.equal(await page.evaluate(() => document.body.classList.contains('dragging')), false, 'le glisser se termine normalement');
    await page.click('#custom-done');
    await context.close();
  }

  // 2. Changer de mode : bouton du menu, mode affiché à côté, rien n'est relancé.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'modes');
    await page.locator('[data-widget=minuteur]').getByRole('button', { name: 'Démarrer' }).click();
    await goMode(page, 'Chill');
    assert.equal(await modeNow(page), 'Chill');
    assert.match(await page.locator('#open-modes').getAttribute('aria-label'), /Mode actuel : Chill/);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('audio')].some(a => !a.paused)), false, 'aucun son ne démarre');
    await goMode(page, 'Study');
    assert.equal(await page.locator('[data-widget=minuteur]').getByRole('button', { name: 'Pause' }).count(), 1, 'le minuteur continue');
    // « Ajouter un widget » ouvre le catalogue habituel.
    await showMenu(page);
    await page.click('#open-add');
    assert.ok(await page.isVisible('#add-dialog #cat-search'));
    await page.keyboard.press('Escape');
    assert.equal(await toggle(page).getAttribute('aria-expanded'), 'true', 'le catalogue laisse le menu ouvert');
    await context.close();
  }

  // 3. Favoris : ajout, ordre, aller au widget (autre mode, replié), retrait, widget retiré, rechargement.
  {
    const { page, context, db } = await open({ width: 1440, height: 900 }, 'favoris');
    assert.match(await page.textContent('#favs-empty'), /widgets préférés/);
    await showMenu(page);
    assert.equal(await page.isVisible('#favs-empty'), true, 'état vide court');
    await page.click('#favs-edit');
    const dlg = page.locator('#page-dialog');
    await dlg.getByRole('button', { name: 'Ajouter Notes aux favoris' }).click();
    await dlg.getByRole('button', { name: 'Ajouter Ambiance sonore aux favoris' }).click();
    await dlg.getByRole('button', { name: 'Ajouter Minuteur focus aux favoris' }).click();
    assert.equal(await page.evaluate(() => document.activeElement?.ariaLabel), 'Retirer Minuteur focus des favoris', 'le focus suit l’élément ajouté');
    await dlg.getByRole('button', { name: 'Monter Minuteur focus' }).click();
    assert.equal(await page.evaluate(() => document.activeElement?.ariaLabel), 'Monter Minuteur focus');
    await dlg.getByRole('button', { name: 'Retirer Notes des favoris' }).click();
    await shot(page, 'favoris-gerer');
    await dlg.getByRole('button', { name: 'Terminé' }).click();
    const favs = () => page.locator('#favs-list .fav-name').allTextContents();
    assert.deepEqual(await favs(), ['Minuteur focus', 'Ambiance sonore']);
    assert.equal(await page.isVisible('#favs-empty'), false);
    await saved(page);
    assert.deepEqual(db.rows.ecran.favoris, ['minuteur', 'ambiance']);
    assert.equal(db.rows.ecran.widgets.filter(id => id === 'ambiance').length, 1, 'aucune copie de widget');
    // Aller au widget d'un autre mode : on y va, il a le focus, rien n'est remonté.
    const count = await page.locator('#board .widget').count();
    await showMenu(page);
    await page.locator('#favs-list').getByRole('button', { name: /Ambiance sonore/ }).click();
    assert.equal(await modeNow(page), 'Chill');
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.widget), 'ambiance');
    assert.equal(await page.locator('#board .widget').count(), count);
    // Replié : un favori le déplie.
    await goMode(page, 'Study');
    await page.getByRole('button', { name: 'Replier Minuteur focus' }).click();
    await showMenu(page);
    await page.locator('#favs-list').getByRole('button', { name: /Minuteur focus/ }).click();
    assert.equal(await page.locator('[data-widget=minuteur]').getAttribute('data-collapsed'), null, 'déplié');
    await shot(page, 'favoris');
    // Retiré de l'écran : le favori disparaît aussi.
    await showMenu(page);
    await page.click('#open-add');
    await page.locator('#catalog [data-widget=ambiance]').click();
    await page.getByRole('button', { name: 'Retirer : Ambiance sonore', exact: true }).click();
    await page.keyboard.press('Escape');
    assert.deepEqual(await favs(), ['Minuteur focus']);
    await saved(page);
    assert.deepEqual(db.rows.ecran.favoris, ['minuteur']);
    // Référence abîmée ou inconnue en base : ignorée sans erreur.
    db.rows.ecran = { ...db.rows.ecran, favoris: ['minuteur', 'inconnu', 42, 'minuteur', 'pause'] };
    await page.reload();
    await page.waitForSelector('#board .widget:not([hidden])');
    assert.deepEqual(await favs(), ['Minuteur focus', 'Pause détente']);
    await context.close();
  }

  // 4. Personnaliser : un seul panneau, quatre groupes, retour au même endroit ; Annuler garde tout.
  {
    const { page, context, db } = await open({ width: 1440, height: 900 }, 'perso');
    await custom(page);
    assert.equal(await page.textContent('#settings-title'), 'Personnaliser');
    assert.deepEqual(await page.locator('#settings .set-group > h3').allTextContents(), ["Fond d'écran", 'Apparence', 'Typographie', 'Disposition', 'Espace actuel']);
    assert.equal(await page.getByRole('button', { name: 'Ouvrir les réglages' }).count(), 0, 'plus de détour');
    assert.equal(await page.locator('#wall-slot [aria-pressed=true]').getAttribute('data-wall'), 'brume', 'le fond actuel est marqué');
    assert.equal(await page.textContent('#page-current'), 'Study');
    await page.waitForTimeout(400);
    await shot(page, 'personnaliser');
    await page.locator('#wall-slot [data-wall=dune]').click();
    await page.getByRole('button', { name: 'Sombre' }).click();
    await saved(page);
    assert.equal(db.rows.ecran.pages.find(p => p.id === 'study').wall, 'dune');
    assert.equal(db.rows.ecran.look.theme, 'dark');
    // Réinitialiser : la conséquence est dite, Annuler ne touche à rien.
    await page.click('#layout-reset');
    assert.match(await page.textContent('#page-dialog'), /ne changent pas/);
    await page.locator('#page-dialog').getByRole('button', { name: 'Annuler' }).click();
    assert.equal(await page.locator('#settings').evaluate(n => n.open), true, 'on reste dans Personnaliser');
    await closeCustom(page);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'open-custom', 'Personnaliser refermé : retour au bouton qui l\'a ouvert (visible dans le rail)');
    // Disposer depuis le panneau, puis Terminer : retour au même endroit.
    await custom(page);
    await page.click('#layout-edit');
    assert.equal(await page.isVisible('#custom'), true);
    assert.equal(await page.locator('.grip').first().isVisible(), true);
    await page.click('#custom-done');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'open-custom', 'Terminer : retour à Personnaliser');
    await context.close();
  }

  // 5. Compte : informations, parrainage, verrou de l'appareil, déconnexion ; l'apparence n'y est plus.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'compte');
    await openMe(page);
    const menu = page.locator('#menu');
    await acctSection(page, 'Parrainage');
    await page.waitForSelector('#ref-row:not([hidden])');
    for (const text of ['Abonnement', 'Parrainage', 'Verrouillage de l’écran', 'Se déconnecter']) assert.ok(await menu.getByText(text, { exact: true }).first().isVisible(), text);
    assert.equal(await menu.getByText('Thème, couleurs et polices').count(), 0);
    assert.equal(await page.textContent('#plan-nom'), 'Gratuit', 'sans abonnement : Gratuit');
    const r = await menu.boundingBox();
    assert.ok(r.x >= 0 && r.y >= 0 && r.y + r.height <= 900, 'le menu tient dans l’écran');
    await shot(page, 'compte');
    await page.keyboard.press('Escape');
    await context.close();
  }
  // 5 bis. Plan payant : le nom, le prix TTC et l'échéance, tels que la base les donne.
  {
    srv.bac('plein', 'comptepro').abonnement = { plan: 'pro', statut: 'annule', fin: '2099-12-15T12:00:00Z' };
    const { page, context } = await open({ width: 1440, height: 900 }, 'comptepro');
    await openMe(page);
    await page.waitForFunction(() => document.getElementById('plan-nom').textContent === 'Pro');
    assert.equal((await page.textContent('#plan-info')).replace(/\s/g, ' '), "9,99 € TTC par mois · résilié, actif jusqu'au 15 décembre 2099.");
    await shot(page, 'compte-pro');
    await context.close();
  }

  // 6. Téléphone : le même bouton ouvre et replie le tiroir.
  {
    const { page, context } = await open({ width: 390, height: 844 }, 'tel', { touch: true });
    const bar = await page.locator('#bar').boundingBox();
    assert.ok(bar.width < 200 && bar.height <= 64, 'pas de colonne réservée');
    assert.equal(await toggle(page).getAttribute('aria-expanded'), 'false');
    assert.ok((await page.locator('.hello').boundingBox()).x < 40, 'l’écran prend toute la largeur');
    await shot(page, 'telephone');
    await toggle(page).tap();
    await settle(page);
    assert.equal(await toggle(page).getAttribute('aria-expanded'), 'true');
    assert.equal(await page.evaluate(() => document.getElementById('app').inert), false);
    const drawer = await page.locator('#bar').boundingBox();
    assert.ok(drawer.width <= 340 && drawer.height >= 800, 'un tiroir sur la hauteur');
    for (const id of ['#open-add', '#open-modes', '#open-custom', '#me']) assert.ok((await page.locator(id).boundingBox()).height >= 44, `${id} : 44 px`);
    await shot(page, 'telephone-tiroir');
    await page.touchscreen.tap(370, 400);
    assert.equal(await toggle(page).getAttribute('aria-expanded'), 'true', 'un toucher à côté laisse le tiroir ouvert');
    await toggle(page).tap();
    assert.equal(await toggle(page).getAttribute('aria-expanded'), 'false', 'le même bouton replie le tiroir');
    assert.equal(await toggle(page).getAttribute('aria-label'), 'Afficher le menu');
    // Le choix « replié » du grand écran ne s'applique pas ici, et le tiroir repart fermé.
    await page.evaluate(() => localStorage.setItem('renzvi:menu', 'ouvert'));
    await page.reload();
    await page.waitForSelector('#board .widget:not([hidden])');
    assert.equal(await page.locator('#bar-nav').isVisible(), false);
    // Personnaliser depuis le tiroir laisse le tiroir ouvert.
    await custom(page);
    assert.equal(await toggle(page).getAttribute('aria-expanded'), 'true');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await context.close();
  }

  // 7. Panne d'enregistrement : jamais de faux « Enregistré » ; ça repart tout seul.
  {
    const { page, context, db } = await open({ width: 1440, height: 900 }, 'panne');
    db.panne = true;
    await showMenu(page);
    await page.click('#favs-edit');
    await page.locator('#page-dialog').getByRole('button', { name: 'Ajouter Notes aux favoris' }).click();
    await page.locator('#page-dialog').getByRole('button', { name: 'Terminé' }).click();
    await page.waitForFunction(() => /Nouvel essai/.test(document.getElementById('saved').textContent));
    assert.equal(await page.locator('#saved').evaluate(n => n.classList.contains('bad')), true);
    await custom(page);
    assert.match(await page.textContent('#set-saved'), /Nouvel essai/, 'le panneau dit la même chose');
    db.panne = false;
    await until(() => db.rows.ecran?.favoris?.includes('notes'), 'enregistré après la panne');
    await page.waitForFunction(() => document.getElementById('set-saved').textContent === 'Enregistré');
    await context.close();
  }

  // 8. Mouvement réduit : ouvrir et fermer ne lancent aucune animation.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'reduit', { reduced: true });
    const moving = () => page.evaluate(() => document.getAnimations().filter(a => a.effect?.target?.closest?.('#bar')).map(a => a.effect.target.className));
    await toggle(page).hover();
    assert.deepEqual(await moving(), []);
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('bar')).transitionDuration), '0s');
    await toggle(page).click();
    assert.deepEqual(await moving(), []);
    await context.close();
  }

  assert.deepEqual(errors, [], 'aucune erreur de page');
  await browser.close();
  srv.close?.();
  console.log('menu-lateral OK');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
