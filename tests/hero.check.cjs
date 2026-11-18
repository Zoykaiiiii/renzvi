// Vérifie le héros de la landing (prototype/, composant components/ui/hero-10.tsx ; même héros que lp-v1/) dans un vrai Chromium :
// titre sur deux lignes, appel « Créer mon espace » vers l'inscription, trois cadres dans l'ordre (centre devant),
// haut des trois cadres visible à l'arrivée sur un portable, pas de défilement de côté, dimensions réservées, mouvement réduit.
// Lancement : cd prototype (ou lp-v1) && npm run build && npx next start -p 3100, puis
//   NODE_PATH=~/pw/node_modules node tests/hero.check.cjs [dossier-captures]   (URL=… pour une autre adresse)
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const URL = process.env.URL || 'http://localhost:3100/';
const SHOTS = process.argv[2];

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [w, h, name, reduced] of [[1440, 900, 'bureau'], [1366, 768, 'portable'], [768, 1024, 'tablette'], [390, 844, 'telephone'], [320, 640, 'petit'], [1366, 768, 'reduit', true]]) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
    await page.goto(URL);
    const hero = page.locator('section#top');
    const h1 = hero.locator('h1');
    assert.equal(await h1.innerText(), 'Tes outils,\nau même endroit');
    // Dimensions réservées dès le premier rendu, avant toute animation.
    const sizes0 = await hero.locator('[data-hero-slot]').evaluateAll(n => n.map(x => [x.offsetWidth, x.offsetHeight]));
    await page.waitForTimeout(1600); // fin des entrées
    const sizes1 = await hero.locator('[data-hero-slot]').evaluateAll(n => n.map(x => [x.offsetWidth, x.offsetHeight]));
    assert.deepEqual(sizes1, sizes0, `${name} : cadres de taille stable`);
    // Vraiment visible une fois l'entrée finie : opacité cumulée des parents (le JavaScript a bien tourné).
    const seen = loc => loc.evaluate(n => { let o = 1; for (; n; n = n.parentElement) o *= +getComputedStyle(n).opacity; return o; });
    assert.ok(await seen(h1) > 0.99, `${name} : titre visible`);
    assert.ok(await seen(hero.locator('[data-hero-slot="1"]')) > 0.99, `${name} : cadres visibles`);
    const lines = await h1.evaluate(n => Math.round(n.getBoundingClientRect().height / parseFloat(getComputedStyle(n).lineHeight)));
    assert.equal(lines, 2, `${name} : titre sur deux lignes (${lines})`);
    const cta = hero.getByRole('link', { name: 'Créer mon espace' });
    assert.equal(await cta.getAttribute('href'), '/login.html');
    const c = await cta.boundingBox();
    assert.ok(c.y + c.height <= h, `${name} : appel visible à l'arrivée`);
    const t = await h1.boundingBox();
    assert.ok(c.y > t.y + t.height, `${name} : appel sous le titre`);
    // Trois cadres : gauche, centre (devant), droite ; tous sous l'appel, centre au-dessus des deux autres.
    const frames = await hero.locator('[data-hero-slot]').evaluateAll(n => n.map(x => { const r = x.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, z: +getComputedStyle(x).zIndex }; }));
    assert.equal(frames.length, 3);
    assert.ok(frames[0].x < frames[1].x && frames[1].x < frames[2].x, `${name} : ordre gauche, centre, droite`);
    assert.ok(frames[1].z > frames[0].z && frames[1].z > frames[2].z, `${name} : centre devant`);
    assert.ok(frames[0].x + frames[0].w > frames[1].x && frames[2].x < frames[1].x + frames[1].w, `${name} : les cadres se chevauchent`);
    for (const f of frames) assert.ok(f.y > c.y + c.height, `${name} : cadres sous l'appel`);
    for (const f of frames) assert.ok(f.x >= 0 && f.x + f.w <= w, `${name} : cadre dans l'écran (${Math.round(f.x)}, ${Math.round(f.w)})`);
    if (name === 'portable' || name === 'bureau') for (const f of frames) assert.ok(f.y + 40 <= h, `${name} : haut des trois cadres visible à l'arrivée`);
    // Cadres : une image chargée chacun (aucune cassée), avec un texte de remplacement, sans texte par-dessus.
    const imgs = hero.locator('[data-hero-slot] img');
    assert.equal(await imgs.count(), 3, `${name} : trois images`);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-hero-slot] img')].every(i => i.complete && i.naturalWidth > 0), null, { timeout: 5000 }).catch(() => assert.fail(`${name} : une image du héros ne charge pas`));
    for (const alt of await imgs.evaluateAll(n => n.map(i => i.alt))) assert.ok(alt.length > 20, `${name} : texte de remplacement`);
    assert.equal((await hero.locator('[data-hero-slot]').allTextContents()).join(''), '');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} : pas de défilement de côté`);
    assert.equal(await page.locator('#outils h2').count(), 1, 'la section suivante est là');
    // L'aimant de l'ancien héros : la souris qui s'approche (sans toucher) attire le bouton ; pas en mouvement réduit.
    if (name === 'bureau' || name === 'reduit') {
      const before = await cta.boundingBox();
      await page.mouse.move(before.x + before.width + 40, before.y + before.height / 2, { steps: 6 });
      await page.waitForTimeout(500);
      const after = await cta.boundingBox();
      const moved = after.x - before.x;
      if (name === 'bureau') assert.ok(moved > 2, `bureau : l'aimant attire le bouton (${moved.toFixed(1)} px)`);
      else assert.ok(Math.abs(moved) < 0.5, `mouvement réduit : le bouton ne bouge pas (${moved.toFixed(1)} px)`);
      await page.mouse.move(5, 5);
      await page.waitForTimeout(500);
    }
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/hero-${name}.png` });
    await context.close();
  }
  assert.deepEqual(errors, [], 'aucune erreur de page');
  await browser.close();
  console.log('héros OK');
})().catch(e => { console.error(e); process.exit(1); });
