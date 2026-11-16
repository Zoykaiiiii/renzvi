// Paywall et cadenas (site/dashboard.html, #paywall ; PixelCard : site/dash/pixelcard.js) dans un vrai Chromium,
// sur le serveur de démo (Supabase simulé). Gratuit : badge du plan → les trois plans ; widgets payants avec cadenas dans
// le catalogue → « Débloquer avec Pro » ; Mes polices → les plans. Pro : plus de cadenas, « Ton plan actuel ».
// Lancement : NODE_PATH=~/pw/node_modules node tests/paywall.check.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');
const { openMe, showMenu, custom } = require('./menu.cjs');

(async () => {
  const srv = await start();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
  const errors = [];
  const open = async (bac, plan) => {
    if (plan) srv.bac('plein', bac).abonnement = { plan, statut: 'actif', fin: null };
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${srv.url}/dashboard.html?profil=plein&bac=${bac}`);
    await page.waitForSelector('#board .widget:not([hidden])');
    if (plan) await page.waitForFunction(() => document.getElementById('plan-nom').textContent !== 'Gratuit');
    return { page, context };
  };
  const catalog = async page => { await showMenu(page); await page.click('#open-add'); await page.waitForSelector('#add-dialog[open]'); };
  const cards = page => page.locator('#pw-plans .pw-card');

  // 1. Gratuit : le badge « Gratuit » ouvre les trois plans, prix TTC, PixelCard posée, rien n'est débité.
  {
    const { page, context } = await open('gratuit');
    await openMe(page);
    await page.waitForSelector('#menu:popover-open');
    await page.click('#plan-nom');
    await page.waitForSelector('#paywall[open]');
    assert.equal(await page.locator('#menu').evaluate(n => n.matches(':popover-open')), false, 'la carte du compte se ferme');
    assert.deepEqual(await cards(page).locator('h3').allTextContents(), ['Gratuit', 'Pro', 'Worker']);
    const prix = (await cards(page).locator('.pw-prix').allTextContents()).map(t => t.replace(/\s/g, ' '));
    assert.deepEqual(prix, ['0 €pour toujours', '9,99 €TTC / mois', '17,99 €TTC / mois']);
    assert.equal(await cards(page).nth(0).locator('.pw-now').textContent(), 'Ton plan actuel');
    assert.equal(await cards(page).locator('canvas.pixel-card-canvas').count(), 3, 'une PixelCard par plan');
    await page.getByRole('button', { name: 'Choisir Pro' }).click();
    assert.match(await page.textContent('#pw-note'), /rien n'est débité/);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#pw-plans canvas')); // PixelCard retirée à la fermeture

    // 2. Catalogue : Quiz et les widgets Chill sont visibles, avec un cadenas ; l'aperçu propose « Débloquer avec Pro ».
    await catalog(page);
    for (const id of ['quiz', 'jardin', 'dictee']) assert.ok(await page.locator(`#catalog [data-widget=${id}] .cat-lock`).isVisible(), `${id} : cadenas`);
    assert.equal(await page.locator('#catalog [data-widget=minuteur] .cat-lock').count(), 0, 'minuteur : libre');
    await page.click('#catalog [data-widget=quiz]');
    assert.equal(await page.locator('#cat-view').getByRole('button', { name: /^Ajouter/ }).count(), 0, 'pas d’ajout en Gratuit');
    await page.locator('#cat-view').getByRole('button', { name: 'Débloquer avec Pro' }).click();
    await page.waitForSelector('#paywall[open]');
    assert.match(await page.textContent('#pw-why'), /^Quiz fait partie de Pro/);
    await page.keyboard.press('Escape');

    // 3. Mes polices : importer ouvre les plans, pas le sélecteur de fichier.
    await custom(page);
    await page.locator('#mp-import').scrollIntoViewIfNeeded();
    await page.click('#mp-import');
    await page.waitForSelector('#paywall[open]');
    assert.match(await page.textContent('#pw-why'), /^Tes propres polices fait partie de Pro/);
    await context.close();
  }

  // 4. Pro : aucun cadenas, Quiz s'ajoute, la carte Pro dit « Ton plan actuel ».
  {
    const { page, context } = await open('pro', 'pro');
    await catalog(page);
    assert.equal(await page.locator('#catalog .cat-lock').count(), 0, 'aucun cadenas en Pro');
    await page.click('#catalog [data-widget=quiz]');
    await page.locator('#cat-view').getByRole('button', { name: 'Ajouter : Quiz' }).click();
    await page.waitForSelector('#board [data-widget=quiz]');
    await page.keyboard.press('Escape');
    await openMe(page);
    await page.click('#plan-nom');
    await page.waitForSelector('#paywall[open]');
    assert.equal(await cards(page).nth(1).locator('.pw-now').textContent(), 'Ton plan actuel');
    assert.equal(await cards(page).nth(0).getByRole('button').count(), 0, 'pas de bouton sur Gratuit');
    await context.close();
  }

  assert.deepEqual(errors, [], 'aucune erreur JavaScript');
  await browser.close();
  srv.close();
  console.log('paywall : tous les parcours passent');
})().catch(e => { console.error(e); process.exit(1); });
