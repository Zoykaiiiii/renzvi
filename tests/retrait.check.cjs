// Retirer un widget de la page (corbeille en mode édition, à la place de la poignée en pointillés), avec « Annuler ».
// Serveur de démo (Supabase simulé). Vérifie : seul l'emplacement part (le contenu reste en base), animation, retour à la
// même place, plusieurs retraits annulés un par un, la corbeille ne lance jamais un glisser, mouvement réduit.
// Lancement : NODE_PATH=~/pw/node_modules node tests/retrait.check.cjs   (SHOTS=dossier pour les captures)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');
const { custom } = require('./menu.cjs');

const SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const srv = await start();
  const browser = await chromium.launch();
  const errors = [];
  const until = async (fn, what) => { for (let i = 0; i < 80; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 100)); } assert.fail(what); };
  async function open(bac, motion = true) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: motion ? 'no-preference' : 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${srv.url}/dashboard.html?profil=plein&bac=${bac}&pages=1`);
    await page.waitForSelector('.board[data-vue=pages] .widget:not([hidden])');
    await custom(page);
    await page.click('#layout-edit');
    await page.waitForFunction(() => document.body.classList.contains('pages-editing'));
    return { page, context };
  }
  const rows = bac => srv.bac('plein', bac).rows;
  const place = (bac, id) => rows(bac).ecran?.vues?.places?.pages?.study?.d?.[id];

  // 1. Retirer, puis annuler : même place, contenu intact.
  {
    const { page, context } = await open('a');
    const notes = rows('a').notes;
    await until(() => place('a', 'taches'), 'places enregistrées');
    const before = { ...place('a', 'taches') };
    const trash = page.getByRole('button', { name: 'Retirer Tâches de la page' });
    assert.ok(await trash.isVisible(), 'corbeille visible en édition');
    assert.equal(await page.locator('[data-widget=taches] .pg-move').evaluate(n => getComputedStyle(n).clipPath), 'inset(50%)', 'poignée en pointillés cachée (clavier seulement)');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/retrait-edition.png` });
    await trash.click();
    assert.equal(await page.evaluate(() => document.body.classList.contains('dragging')), false, 'la corbeille ne lance pas de glisser');
    await page.waitForSelector('[data-widget=taches]', { state: 'detached' });
    await page.waitForSelector('.retrait-notice:not([hidden])');
    assert.match(await page.locator('.retrait-notice').textContent(), /Tâches retiré de la page/);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/retrait-annuler.png` });
    await until(() => !rows('a').ecran.widgets.includes('taches'), 'retrait enregistré');
    assert.deepEqual(rows('a').notes, notes, 'les autres données ne bougent pas');
    assert.ok(rows('a').taches?.items?.length, 'le contenu de Tâches reste en base');
    await page.locator('.retrait-notice').getByRole('button', { name: 'Annuler' }).click();
    await page.waitForSelector('[data-widget=taches]');
    await until(() => rows('a').ecran.widgets.includes('taches'), 'retour enregistré');
    await until(() => JSON.stringify(place('a', 'taches')) === JSON.stringify(before), 'même place');
    assert.equal(await page.locator('[data-widget=taches] .row').count(), rows('a').taches.items.length, 'mêmes tâches');
    await context.close();
    console.log('ok retirer et annuler');
  }

  // 2. Deux retraits rapides : annulés un par un, du dernier au premier. Mouvement réduit : pas d'animation.
  {
    const { page, context } = await open('b', false);
    await page.getByRole('button', { name: 'Retirer Notes de la page' }).click();
    await page.waitForSelector('[data-widget=notes]', { state: 'detached' });
    await page.getByRole('button', { name: 'Retirer Minuteur focus de la page' }).click();
    await page.waitForSelector('[data-widget=minuteur]', { state: 'detached' });
    await page.locator('.retrait-notice').getByRole('button', { name: 'Annuler' }).click();
    await page.waitForSelector('[data-widget=minuteur]');
    assert.match(await page.locator('.retrait-notice').textContent(), /1 autre retrait à annuler/);
    await page.locator('.retrait-notice').getByRole('button', { name: 'Annuler' }).click();
    await page.waitForSelector('[data-widget=notes]');
    await until(() => ['notes', 'minuteur'].every(id => rows('b').ecran.widgets.includes(id)), 'les deux reviennent');
    await context.close();
    console.log('ok plusieurs retraits');
  }

  await browser.close();
  await srv.close();
  assert.deepEqual(errors, [], 'aucune erreur de page');
  console.log('retrait : tout passe');
})().catch(e => { console.error(e); process.exit(1); });
