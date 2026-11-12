// Parcours du nouveau dashboard, dans un vrai Chromium, sur le serveur de démo (Supabase simulé en mémoire).
// Vérifie : page vide -> catalogue -> aperçu -> ajout confirmé, aide des premiers pas, changement de mode sans perte,
// vue agrandie, clavier et téléphone. Lancement : NODE_PATH=~/pw/node_modules node tests/parcours.check.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');

(async () => {
  const srv = await start();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
  const errors = [];
  let n = 0;
  const open = async (profil, viewport = { width: 1440, height: 900 }) => {
    const bac = `t${++n}`;
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${srv.url}/dashboard.html?profil=${profil}&bac=${bac}`);
    await page.waitForSelector('#board .widget:not([hidden]), #board-empty:not([hidden]), #setup:not([hidden])');
    return { page, context, db: srv.bac(profil, bac), reload: () => page.reload().then(() => page.waitForSelector('#board .widget:not([hidden]), #board-empty:not([hidden])')) };
  };
  const saved = page => page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');

  // 1. Compte existant, page vide : invitation, catalogue, recherche, aperçu sans effet, ajout seulement après confirmation.
  {
    const { page, context, db, reload } = await open('vide');
    assert.ok(await page.isVisible('#board-empty svg'), 'invitation illustrée');
    assert.match(await page.textContent('#board-empty'), /Ton écran est vide/);
    assert.equal(await page.isVisible('#aide'), false, "pas d'aide avant le premier ajout");
    await page.getByRole('button', { name: 'Choisir un widget' }).click();
    assert.ok(await page.isVisible('#add-dialog'));
    assert.deepEqual(await page.locator('#catalog h3').allTextContents(), ['Study', 'Chill', 'Quotidien'], 'rangé par catégories, sans le labo');
    await page.fill('#cat-search', 'révis');
    assert.deepEqual(await page.locator('#catalog .cat-item b').allTextContents(), ['Flashcards', 'Révisions du jour'], 'recherche sans accents ni majuscules');
    await page.fill('#cat-search', 'zzz');
    assert.match(await page.textContent('#catalog'), /Aucun widget/);
    await page.fill('#cat-search', 'ambiance');
    const savesBefore = db.saves;
    await page.locator('#catalog [data-widget=ambiance]').click();
    assert.equal(await page.locator('#cat-view .stage .widget').count(), 1, "l'aperçu montre le widget");
    assert.equal(await page.locator('#cat-view .stage').evaluate(s => s.inert), true, "l'aperçu ne répond à aucun clic");
    assert.equal(await page.locator('#board .widget').count(), 0, "rien n'est ajouté au clic sur la liste");
    await page.getByRole('group', { name: 'Taille de Ambiance sonore' }).getByRole('button', { name: 'Grand' }).click();
    await page.waitForTimeout(900);
    assert.equal(db.saves, savesBefore, "l'aperçu n'enregistre rien");
    assert.deepEqual(db.rows.ecran.widgets, [], 'données inchangées avant la confirmation');
    await page.getByRole('button', { name: 'Ajouter : Ambiance sonore', exact: true }).click();
    assert.equal(await page.locator('#board [data-widget=ambiance]').getAttribute('data-size'), 'l', 'ajouté à la taille choisie');
    assert.equal(await page.locator('#cat-view .stage .widget').count(), 0, "l'aperçu est retiré après l'ajout");
    await page.locator('#add-dialog .primary').click();
    assert.equal(await page.isVisible('#add-dialog'), false);
    assert.equal(await page.isVisible('#board-empty'), false);
    // L'aide démarre aussi pour un compte existant, première étape cochée.
    assert.ok(await page.isVisible('#aide'));
    assert.deepEqual(await page.locator('#aide li').evaluateAll(l => l.map(x => x.classList.contains('fait'))), [true, false, false]);
    await page.click('#open-custom');
    await page.getByRole('group', { name: 'Taille de Ambiance sonore' }).getByRole('button', { name: 'Moyen' }).click();
    await page.locator('#wall-slot [data-wall=lac]').click();
    await page.click('#custom-done');
    assert.match(await page.textContent('#aide h2'), /terminés/);
    await saved(page);
    assert.deepEqual(db.rows.ecran.widgets, ['ambiance']);
    assert.deepEqual(db.rows.ecran.aide, { add: true, move: true, wall: true });
    await reload();
    assert.equal(await page.locator('#board [data-widget=ambiance]').getAttribute('data-size'), 'm', 'sauvegarde relue');
    assert.ok(await page.evaluate(() => document.body.classList.contains('has-wall')));
    await page.getByRole('button', { name: 'Fermer', exact: true }).click();
    assert.equal(await page.isVisible('#aide'), false);
    await saved(page);
    await reload();
    assert.equal(await page.isVisible('#aide'), false, "l'aide masquée ne revient pas");
    await page.click('#me');
    await page.getByRole('button', { name: 'Revoir les premiers pas' }).click();
    assert.ok(await page.isVisible('#aide'), 'on peut la revoir depuis le menu');
    // Retirer : la page redevient vide, avec la même invitation.
    await page.click('#open-add');
    await page.locator('#catalog [data-widget=ambiance]').click();
    await page.getByRole('button', { name: 'Retirer : Ambiance sonore', exact: true }).click();
    await page.keyboard.press('Escape');
    assert.ok(await page.isVisible('#board-empty'));
    await context.close();
  }

  // 2. Changement de mode : rien n'est perdu, le fond suit, la saisie en cours reste.
  {
    const { page, context, db, reload } = await open('plein');
    const pressed = () => page.locator('#page-tabs [aria-pressed=true]').textContent();
    const wall = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--wall'));
    assert.equal(await pressed(), 'Study');
    assert.match(await wall(), /bohinj/);
    await page.getByRole('textbox', { name: 'Nouvelle tâche' }).fill('Réviser la procédure');
    await page.getByRole('textbox', { name: 'Nouvelle tâche' }).press('Enter');
    await page.locator('[data-widget=notes] textarea').fill('note gardée');
    const thumb = () => page.locator('#page-tabs .thumb').evaluate(t => t.style.getPropertyValue('--x'));
    const before = await thumb();
    await page.getByRole('button', { name: 'Chill', exact: true }).click();
    assert.equal(await pressed(), 'Chill');
    assert.notEqual(await thumb(), before, 'la pastille a glissé');
    assert.match(await wall(), /mapourika/);
    await page.waitForFunction(() => document.querySelectorAll('#wall i').length === 1 && document.querySelector('#wall i.on'), null, { timeout: 5000 }); // l'ancien fond est retiré après le fondu
    assert.equal(await page.isVisible('[data-widget=taches]'), false);
    assert.equal(await page.locator('#board .widget:visible').count(), 6);
    assert.equal(await page.locator('#board .widget').count(), 15, 'les widgets de Study restent montés');
    await page.getByRole('button', { name: 'Study', exact: true }).click();
    assert.equal(await page.locator('[data-widget=taches] .row span').first().textContent(), 'Réviser la procédure');
    assert.equal(await page.locator('[data-widget=notes] textarea').inputValue(), 'note gardée');
    assert.match(await page.textContent('#today'), /4 tâches à faire/, 'le fait du jour suit les tâches');
    await saved(page);
    assert.equal(db.rows.taches.items[0].text, 'Réviser la procédure');
    await page.getByRole('button', { name: 'Chill', exact: true }).click();
    await reload();
    assert.equal(await pressed(), 'Chill', 'le mode affiché est retrouvé au rechargement');
    // Clavier : les modes se changent sans souris.
    await page.locator('#page-tabs button').first().focus();
    await page.keyboard.press('Enter');
    assert.equal(await pressed(), 'Study');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Study', 'le focus reste sur le mode choisi');

    // Vue agrandie : le même widget, au premier plan ; Échap la referme et rend le focus.
    await page.getByRole('button', { name: 'Agrandir Notes' }).click();
    assert.ok(await page.locator('[data-widget=notes]').evaluate(b => b.classList.contains('zoomed')));
    assert.equal(await page.locator('[data-widget=notes] textarea').inputValue(), 'note gardée', 'rien n\'est rechargé');
    assert.equal(await page.locator('[data-widget=taches]').evaluate(b => b.inert), true, 'le reste ne répond plus');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.zoomed').count(), 0);
    assert.equal(await page.locator('[data-widget=taches]').evaluate(b => b.inert), false);
    assert.equal(await page.evaluate(() => document.activeElement.ariaLabel), 'Agrandir Notes');
    await context.close();
  }

  // 3. Téléphone : modes en bas, catalogue en deux vues, pas de défilement horizontal.
  {
    const { page, context } = await open('plein', { width: 390, height: 844 });
    const noOverflow = async label => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `pas de défilement horizontal (${label})`);
    await noOverflow('écran');
    const bar = await page.locator('#page-bar').boundingBox();
    assert.ok(bar.y > 700, 'les modes sont en bas, sous le pouce');
    assert.ok((await page.locator('#page-tabs button').first().boundingBox()).height >= 44, 'cibles de 44 px');
    await page.click('#open-add');
    assert.ok(await page.isVisible('#catalog'));
    assert.equal(await page.isVisible('#cat-view'), false, "d'abord la liste");
    await page.locator('#catalog [data-widget=habitudes]').click();
    assert.equal(await page.isVisible('#catalog'), false, "puis l'aperçu");
    assert.ok(await page.isVisible('#cat-view .stage .widget'));
    await noOverflow('aperçu');
    await page.getByRole('button', { name: 'Retour au catalogue' }).click();
    assert.ok(await page.isVisible('#catalog'));
    await page.keyboard.press('Escape');
    await page.click('#open-custom');
    await noOverflow('personnaliser');
    await page.getByRole('group', { name: 'Réglage affiché' }).getByRole('button', { name: 'Couleur' }).click();
    assert.ok(await page.isVisible('#swatches'));
    assert.equal(await page.isVisible('#wall-slot'), false, 'un réglage à la fois');
    await context.close();
  }

  // 4. Premier lancement : inchangé, puis l'aide accompagne.
  {
    const { page, context, db } = await open('nouveau');
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByRole('button', { name: 'Commencer sans widget' }).click();
    assert.ok(await page.isVisible('#board-empty'));
    assert.ok(await page.isVisible('#aide'));
    assert.deepEqual(await page.locator('#aide li').evaluateAll(l => l.map(x => x.classList.contains('fait'))), [false, false, false]);
    await saved(page);
    assert.equal(db.rows.ecran.done, true);
    await context.close();
  }

  assert.deepEqual(errors, [], 'aucune erreur de page');
  await browser.close();
  await srv.close();
  console.log('parcours : OK');
})().catch(e => { console.error(e); process.exit(1); });
