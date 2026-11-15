// Vue agrandie des widgets et taille gardée après « Terminer », dans un vrai Chromium, sur le serveur de démo (Supabase simulé).
// A. Redimensionner un widget, « Terminer » : la taille vue en disposant est celle qui reste, et après rechargement.
// B. L'agrandir : il prend toute la place de l'appli, son contenu s'adapte, puis il retrouve exactement sa place.
// G. Un minuteur lancé continue à travers l'agrandissement, sans second minuteur.
// Plus : téléphone, widget replié, Échap, focus rendu, menu inactif, position de défilement gardée.
// Lancement : NODE_PATH=~/pw/node_modules node tests/agrandi.check.cjs   (SHOTS=dossier pour garder les captures)
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');
const { dispose } = require('./menu.cjs');

(async () => {
  const srv = await start();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
  const errors = [];
  const shot = (page, name) => process.env.SHOTS && page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
  const open = async (viewport, profil, bac, opts = {}) => {
    const context = await browser.newContext({ viewport, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${srv.url}/dashboard.html?profil=${profil}&bac=${bac}`);
    await page.waitForSelector('#board .widget:not([hidden])');
    return { page, context, db: srv.bac(profil, bac) };
  };
  const saved = page => page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré');
  const rect = loc => loc.evaluate(b => { const r = b.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; });
  // Les animations d'ouverture et de fermeture terminées (les animations sans fin du contenu ne comptent pas).
  const still = loc => loc.evaluate(b => Promise.all(b.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))));
  const zoomIn = async (page, id) => {
    const box = page.locator(`.widget[data-widget=${id}]`);
    await box.locator('.zoom').focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector(`.widget[data-widget=${id}].zoomed`);
    await still(box);
    return box;
  };

  // A et B, sur ordinateur.
  {
    const { page, context, db } = await open({ width: 1440, height: 900 }, 'simple', 'a');
    const notes = page.locator('.widget[data-widget=notes]');
    await dispose(page);
    // Barre d'édition affichée : la taille du widget n'a pas bougé (elle se pose par-dessus le contenu).
    const sizes = () => page.$$eval('#board .widget:not([hidden])', bs => bs.map(b => `${b.dataset.widget}:${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`).join(' '));
    await page.keyboard.press('Escape').catch(() => {});
    const handle = notes.locator('.resize-handle');
    await notes.evaluate(n => { n.scrollIntoView({ block: 'start' }); scrollBy(0, -90); });
    const nb = await notes.boundingBox(), hb = await handle.boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(nb.x + nb.width * 1.6, nb.y + 420, { steps: 8 });
    await page.mouse.up();
    await saved(page);
    const during = await sizes(), editRect = await rect(notes);
    await shot(page, 'a-disposer');
    await page.locator('#custom-done').click();
    await page.waitForSelector('#custom', { state: 'hidden' });
    assert.equal(await sizes(), during, 'après « Terminer », chaque widget garde la taille vue en disposant');
    const { spans, heights } = db.rows.ecran;
    assert.ok(spans.notes > 4 && heights.notes >= 400, `taille enregistrée (${spans.notes} colonnes, ${heights.notes} px)`);
    await page.reload();
    await page.waitForSelector('#board .widget:not([hidden])');
    const placed = await rect(notes);
    assert.deepEqual([placed.w, placed.h], [editRect.w, editRect.h], 'même taille après rechargement');

    // B. Agrandir : toute la place de l'appli (16 px de marge), pas le plein écran du navigateur.
    await notes.evaluate(n => n.scrollIntoView({ block: 'center' }));
    const scrollY = await page.evaluate(() => scrollY);
    const before = await rect(notes);
    await zoomIn(page, 'notes');
    assert.equal(await page.evaluate(() => !!document.fullscreenElement), false, 'pas de plein écran du navigateur');
    assert.deepEqual(await rect(notes), { x: 16, y: 16, w: 1408, h: 868 }, 'la vue agrandie occupe l\'appli');
    const area = await notes.locator('.notes').evaluate(t => ({ h: t.getBoundingClientRect().height, font: parseFloat(getComputedStyle(t).fontSize) }));
    assert.ok(area.h > 600 && area.font >= 17, `l'éditeur prend la place (${area.h} px, ${area.font} px)`);
    assert.ok(await page.getByRole('button', { name: 'Retour au tableau' }).evaluate(b => b === document.activeElement), 'le focus va sur « Retour au tableau »');
    assert.equal(await page.locator('#bar').evaluate(b => b.inert), true, 'le menu est inactif');
    assert.equal(await page.locator('.widget[data-widget=taches]').evaluate(b => b.inert), true, 'les autres widgets sont inactifs');
    await shot(page, 'b-notes-agrandi');
    // Le texte tapé dans la vue agrandie est le même que dans le widget.
    await notes.locator('.notes').press('End');
    await notes.locator('.notes').type(' — écrit en grand');
    await page.getByRole('button', { name: 'Retour au tableau' }).click();
    await page.waitForFunction(() => !document.querySelector('.widget.zoomed'));
    await still(notes);
    assert.deepEqual(await rect(notes), before, 'retour exact à la place et à la taille du tableau');
    assert.equal(await page.evaluate(() => scrollY), scrollY, 'l\'écran est resté au même endroit');
    assert.ok(await notes.locator('.zoom').evaluate(b => b === document.activeElement), 'le focus revient sur le bouton d\'agrandissement');
    assert.match(await notes.locator('.notes').inputValue(), /écrit en grand$/);
    assert.equal(db.rows.ecran.spans.notes, spans.notes, 'agrandir ne touche pas aux colonnes enregistrées');
    assert.equal(db.rows.ecran.heights.notes, heights.notes, 'ni à la hauteur');

    // Heure : composée au centre, en grand.
    const heure = await zoomIn(page, 'heure');
    const clock = await heure.locator('.time').evaluate(t => { const r = t.getBoundingClientRect(); return { size: parseFloat(getComputedStyle(t).fontSize), cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; });
    assert.ok(clock.size > 200, `l'heure est grande (${clock.size} px)`);
    assert.ok(Math.abs(clock.cx - 720) < 4 && Math.abs(clock.cy - 450) < 80, `l'heure est au centre (${Math.round(clock.cx)}, ${Math.round(clock.cy)})`);
    await shot(page, 'b-heure-agrandie');
    // Échap ferme.
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.widget.zoomed'));
    assert.equal(await page.locator('#bar').evaluate(b => b.inert), false);
    await context.close();
  }

  // G. Le minuteur lancé continue à travers l'agrandissement ; un widget replié s'ouvre en entier.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'simple', 'g');
    const t = page.locator('.widget[data-widget=minuteur]');
    await t.getByRole('button', { name: 'Démarrer' }).click();
    assert.equal(await page.evaluate(() => typeof window.renzviMinuteurLive), 'function', 'un moteur de minuteur');
    await page.evaluate(() => { window.firstEngine = window.renzviMinuteurLive; });
    await zoomIn(page, 'minuteur');
    const dial = await t.locator('.timer-dial').evaluate(d => d.getBoundingClientRect().width);
    assert.ok(dial >= 400, `le cadran est grand (${dial} px)`);
    await page.waitForTimeout(1300);
    assert.equal(await page.evaluate(() => window.renzviMinuteurLive()?.state), 'run', 'le minuteur tourne toujours');
    await shot(page, 'g-minuteur-agrandi');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.widget.zoomed'));
    const ms = await page.evaluate(() => window.renzviMinuteurLive().ms);
    assert.ok(ms < 25 * 60000 - 1000 && ms > 24 * 60000, `même session, le temps a continué (${ms} ms)`);
    assert.equal(await t.locator('.comet-dial').count(), 1, 'un seul cadran');
    assert.ok(await page.evaluate(() => window.renzviMinuteurLive === window.firstEngine), 'le même moteur, rien n\'a été relancé');
    // Replié au tableau, ouvert en entier dans la vue agrandie, replié à nouveau au retour.
    await page.locator('.widget[data-widget=taches] .fold').click();
    await zoomIn(page, 'taches');
    assert.equal(await page.locator('.widget[data-widget=taches] .body').isVisible(), true, 'le contenu d\'un widget replié est visible en grand');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.widget.zoomed'));
    assert.equal(await page.locator('.widget[data-widget=taches] .body').isVisible(), false, 'il reste replié au tableau');
    await context.close();
  }

  // Téléphone : toute la page, bord à bord, contenu lisible, sans débordement.
  {
    const { page, context } = await open({ width: 390, height: 844 }, 'simple', 'm', { reduced: true });
    const box = await zoomIn(page, 'taches');
    assert.deepEqual(await rect(box), { x: 0, y: 0, w: 390, h: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    assert.equal(await page.getByRole('button', { name: 'Retour au tableau' }).isVisible(), true);
    await shot(page, 'm-taches-agrandi');
    await page.getByRole('button', { name: 'Retour au tableau' }).click();
    await page.waitForFunction(() => !document.querySelector('.widget.zoomed'));
    await context.close();
  }

  assert.deepEqual(errors, []);
  console.log('agrandi : tous les parcours passent');
  await browser.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
