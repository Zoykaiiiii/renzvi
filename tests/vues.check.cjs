// Présentations (labo ?vues=1), dans un vrai Chromium, sur le serveur de démo (Supabase simulé en mémoire).
// Vérifie : choix par page, un seul exemplaire de chaque widget, minuteur et lecteur conservés, glisser à la souris et au clavier,
// sauvegarde puis rechargement, retour à la grille, ouverture/fermeture interrompue, mouvement réduit, téléphone, panne de chargement.
// Lancement : NODE_PATH=~/pw/node_modules node tests/vues.check.cjs   (VIDEO=dossier pour filmer le parcours principal)
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');

(async () => {
  const srv = await start();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
  const errors = [];
  let n = 0;
  const open = async ({ viewport = { width: 1440, height: 900 }, labo = '1', reducedMotion = 'no-preference', video, bac = `v${++n}` } = {}) => {
    const context = await browser.newContext({ viewport, reducedMotion, ...(video && { recordVideo: { dir: video, size: viewport } }) });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    // Le lecteur Spotify ne doit jamais partir sur le réseau pendant les tests.
    await page.route(/spotify\.com|scdn\.co|youtube/, r => r.abort());
    // Compte les glissements de widgets, même ceux déjà terminés quand le test regarde.
    await page.addInitScript(() => {
      window.glissements = 0;
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (...a) { if (this.matches('.widget')) window.glissements++; return animate.apply(this, a); };
    });
    await page.goto(`${srv.url}/dashboard.html?profil=vues&bac=${bac}&vues=${labo}`);
    await page.waitForSelector('#board .widget:not([hidden])');
    return { page, context, db: srv.bac('vues', bac) };
  };
  const saved = page => page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
  const settle = page => page.waitForFunction(() => !document.getAnimations().some(a => a.playState === 'running'));
  const pick = (page, name) => page.getByRole('group', { name: 'Présentation' }).getByRole('button', { name, exact: true });
  const pos = (page, id) => page.locator(`#board [data-widget=${id}]`).evaluate(b => { const r = b.getBoundingClientRect(), a = b.parentElement.getBoundingClientRect(); return { x: Math.round(r.left - a.left), y: Math.round(r.top - a.top) }; });
  const timer = page => page.locator('#board [data-widget=minuteur] [role=timer]').textContent();

  // 1. Parcours principal sur ordinateur.
  {
    const { page, context, db } = await open({ video: process.env.VIDEO });
    assert.equal(await page.getAttribute('#board', 'data-vue'), null, 'la grille par défaut');
    assert.equal(await pick(page, 'Grille').getAttribute('aria-pressed'), 'true');
    // Un minuteur lancé et un lecteur chargé avant de changer de présentation.
    await page.locator('#board [data-widget=minuteur]').getByRole('button', { name: 'Démarrer' }).click();
    await page.locator('#board [data-widget=playlist]').getByRole('button', { name: 'Charger le lecteur' }).click();
    await page.locator('#board [data-widget=playlist] iframe').evaluate(f => { f.dataset.marque = 'meme-lecteur'; });
    await page.locator('#board [data-widget=taches] input').first().fill('Réviser le chapitre 5');
    await page.locator('#board [data-widget=taches] input').first().press('Enter');
    await saved(page);
    const tachesAvant = db.rows.taches.items.length;
    const grille = await pos(page, 'taches');

    await pick(page, 'Tableau libre').click();
    await page.waitForSelector('#board[data-vue=libre]');
    assert.ok(await page.evaluate(() => window.glissements > 0), 'les widgets glissent vers leur place');
    await settle(page);
    const p1 = await pos(page, 'taches');
    assert.ok(Math.abs(p1.x - grille.x) <= 4 && Math.abs(p1.y - grille.y) <= 4, 'au premier passage, chaque widget garde la place qu\'il avait dans la grille (à la grille de 8 px près)');
    for (const id of ['heure', 'taches', 'minuteur', 'playlist', 'cahier']) assert.equal(await page.locator(`[data-widget=${id}]`).count(), 1, `${id} : un seul exemplaire`);
    assert.equal(await page.locator('#board [data-widget=playlist] iframe').getAttribute('data-marque'), 'meme-lecteur', 'le lecteur n\'est ni recréé ni rechargé');
    assert.equal(await page.getByRole('button', { name: 'Pause' }).count(), 1, 'le minuteur tourne toujours');
    const t1 = await timer(page);
    assert.notEqual(t1, '25:00', 'le minuteur n\'est pas remis à zéro');
    await saved(page);
    assert.equal(db.rows.taches.items.length, tachesAvant, 'aucune tâche copiée ni perdue');
    assert.equal(db.rows.ecran.vues.page.study, 'libre', 'le choix est enregistré pour la page Study');
    assert.ok(db.rows.ecran.vues.places.libre.study.taches, 'les places sont enregistrées');

    // Glisser par l'en-tête, à la souris.
    const head = page.locator('#board [data-widget=taches] .head h2');
    const box = await head.boundingBox();
    await page.mouse.move(box.x + 10, box.y + 5);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 80, { steps: 8 });
    await page.mouse.move(box.x + 210, box.y + 125, { steps: 8 });
    await page.mouse.up();
    await saved(page);
    const apres = await pos(page, 'taches');
    assert.ok(Math.abs(apres.x - p1.x - 200) <= 8 && Math.abs(apres.y - p1.y - 120) <= 8, `posé où on l'a lâché (${JSON.stringify(apres)})`);
    assert.equal(db.rows.ecran.vues.places.libre.study.taches.x, apres.x);
    // Un clic dans un champ du widget reste un clic, pas un glisser.
    await page.locator('#board [data-widget=taches] input').first().click();
    assert.deepEqual(await pos(page, 'taches'), apres);

    // Au clavier : la poignée et les flèches.
    const grip = page.getByRole('button', { name: 'Déplacer Heure sur le tableau, avec les flèches' });
    const h0 = await pos(page, 'heure');
    await grip.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Shift+ArrowRight');
    assert.deepEqual(await pos(page, 'heure'), { x: h0.x + 64, y: h0.y + 32 }, 'les flèches déplacent par pas de 16 px, Maj par 64');
    assert.match(await page.textContent('#custom-live'), /Heure : \d+ pixels/);

    // La page Chill reste en grille : le choix est par page, pas global.
    await page.locator('#page-tabs').getByRole('button', { name: 'Chill' }).click();
    assert.equal(await page.getAttribute('#board', 'data-vue'), null, 'Chill en grille');
    assert.equal(await pick(page, 'Grille').getAttribute('aria-pressed'), 'true');
    await page.locator('#page-tabs').getByRole('button', { name: 'Study' }).click();
    assert.equal(await page.getAttribute('#board', 'data-vue'), 'libre', 'Study retrouve son tableau');

    // Ouvrir puis fermer pendant l'animation : l'état final est propre.
    await page.locator('#board [data-widget=taches] .zoom').click({ force: true });
    await page.keyboard.press('Escape');
    await settle(page);
    assert.equal(await page.locator('.widget.zoomed, .widget.settling').count(), 0, 'rien ne reste ouvert ni au-dessus');
    assert.equal(await page.isVisible('.veil'), false);
    assert.deepEqual(await pos(page, 'taches'), apres, 'refermé à sa place');
    // Ouvrir normalement : le même widget passe au premier plan.
    await page.locator('#board [data-widget=taches] .zoom').click({ force: true });
    await settle(page);
    assert.equal(await page.locator('#board [data-widget=taches].zoomed').count(), 1);
    await page.keyboard.press('Escape');
    await settle(page);

    // Rechargement : la présentation et les places reviennent, sans animation d'entrée.
    await page.reload();
    await page.waitForSelector('#board[data-vue=libre]');
    assert.equal(await page.evaluate(() => window.glissements), 0, 'pas de longue introduction au chargement');
    assert.deepEqual(await pos(page, 'taches'), apres, 'place gardée après rechargement');
    assert.equal(db.rows.taches.items.length, tachesAvant);

    // Retour à la grille : les boîtes retrouvent leur place, sans reste de la présentation.
    await pick(page, 'Grille').click();
    await settle(page);
    assert.equal(await page.getAttribute('#board', 'data-vue'), null);
    assert.equal(await page.locator('#board .widget[style*="--x"], .vue-grip').count(), 0, 'plus aucune trace du tableau');
    assert.deepEqual(await pos(page, 'taches'), grille, 'chaque widget revient à sa place dans la grille');
    await saved(page);
    assert.equal(db.rows.ecran.vues.page.study, undefined, 'grille enregistrée');
    assert.ok(db.rows.ecran.vues.places.libre.study.taches, 'les places du tableau sont gardées pour la prochaine fois');
    await context.close();
  }

  // 2. Hors labo : pas de sélecteur, la grille, et les dispositions enregistrées ne sont pas effacées.
  {
    const { page, context, db } = await open({ bac: 'hors', labo: '1' });
    await pick(page, 'Tableau libre').click();
    await saved(page);
    await page.goto(`${srv.url}/dashboard.html?profil=vues&bac=hors&vues=0`);
    await page.waitForSelector('#board .widget:not([hidden])');
    assert.equal(await page.locator('#vue-pick').count(), 0, 'pas de sélecteur hors labo');
    assert.equal(await page.getAttribute('#board', 'data-vue'), null, 'la grille publique');
    await page.locator('#board [data-widget=taches] input').first().fill('Une tâche hors labo');
    await page.locator('#board [data-widget=taches] input').first().press('Enter');
    await page.locator('#open-custom').click();
    await page.getByRole('group', { name: 'Taille de Tâches' }).getByRole('button', { name: 'Grand' }).click();
    await saved(page);
    assert.equal(db.rows.ecran.vues.page.study, 'libre', 'le choix du labo survit à un enregistrement public');
    await context.close();
  }

  // 3. Mouvement réduit : tout se met en place sans trajet.
  {
    const { page, context } = await open({ reducedMotion: 'reduce' });
    await pick(page, 'Tableau libre').click();
    await page.waitForSelector('#board[data-vue=libre]');
    assert.equal(await page.evaluate(() => window.glissements), 0, 'aucun glissement');
    await page.locator('#board [data-widget=taches] .zoom').click({ force: true });
    assert.equal(await page.evaluate(() => window.glissements), 0, 'ouverture sans animation');
    await page.keyboard.press('Escape');
    await context.close();
  }

  // 4. Téléphone : le tableau se lit de haut en bas, sans défilement de côté ni poignée.
  {
    const { page, context, db } = await open({ viewport: { width: 390, height: 844 }, bac: 'tel' });
    await pick(page, 'Tableau libre').click();
    await page.waitForSelector('#board[data-vue=libre-liste]');
    assert.ok(await page.isVisible('.vue-note'), 'explication sur téléphone');
    assert.equal(await page.locator('.vue-grip:visible').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'pas de défilement horizontal');
    const lefts = await page.locator('#board .widget:not([hidden])').evaluateAll(bs => [...new Set(bs.map(b => Math.round(b.getBoundingClientRect().left)))]);
    assert.equal(lefts.length, 1, 'une seule colonne');
    await saved(page);
    assert.equal(db.rows.ecran.vues.page.study, 'libre');
    await pick(page, 'Grille').click();
    assert.equal(await page.locator('.vue-note').count(), 0, 'explication retirée');
    await context.close();
  }

  // 5. Panne : la présentation ne se charge pas, la grille reste utilisable.
  {
    const { page, context } = await open({ bac: 'panne' });
    await page.route('**/vues/libre.js', r => r.abort());
    await pick(page, 'Tableau libre').click();
    await page.waitForFunction(() => /n'a pas pu se charger/.test(document.getElementById('page-note').textContent));
    assert.equal(await page.getAttribute('#board', 'data-vue'), null, 'grille toujours là');
    await page.locator('#board [data-widget=taches] input').first().fill('Toujours utilisable');
    await page.locator('#board [data-widget=taches] input').first().press('Enter');
    assert.match(await page.textContent('#board [data-widget=taches]'), /Toujours utilisable/);
    await context.close();
  }

  await browser.close();
  await srv.close();
  assert.deepEqual(errors, [], 'aucune erreur dans la page');
  console.log('vues : OK');
})().catch(e => { console.error(e); process.exit(1); });
