// Widget « Dictée » (labo ?labo=1, site/dash/dictee.js + VoicePill construit dans site/dash/voice-pill.js), dans un vrai
// Chromium, sur le serveur de démo. Un navigateur de test n'entend rien : la reconnaissance vocale est remplacée par
// une fausse, pilotée par le test (mêmes événements que la Web Speech API : onresult, onerror, onend).
// Dicter, ajouter à la note, annuler en glissant, clavier, erreur de micro, navigateur sans dictée, rechargement, téléphone.
// Lancement : NODE_PATH=~/pw/node_modules node tests/dictee.check.cjs   (SHOTS=dossier pour garder les captures)
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');

// La fausse reconnaissance : window.__sr est la dernière créée ; __dire(finals, provisoire) simule ce qu'elle entend.
const FAUX = () => {
  window.__starts = 0;
  class FauxSR {
    constructor() { window.__sr = this; }
    start() { window.__starts++; this.on = true; }
    stop() { this.on = false; setTimeout(() => this.onend?.(), 30); }
    abort() { this.on = false; this.aborted = true; setTimeout(() => this.onend?.(), 10); }
  }
  window.SpeechRecognition = undefined;
  window.webkitSpeechRecognition = FauxSR;
  window.__dire = (finals = [], provisoire = '') => {
    const results = [...finals.map(t => Object.assign([{ transcript: t }], { isFinal: true })), ...(provisoire ? [Object.assign([{ transcript: provisoire }], { isFinal: false })] : [])];
    window.__sr.onresult?.({ resultIndex: 0, results });
  };
};
const SANS = () => { window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; };

(async () => {
  const srv = await start();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
  const errors = [];
  const shot = (page, name) => process.env.SHOTS && page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
  const open = async (viewport, bac, { labo = 1, init = FAUX, touch = false } = {}) => {
    const db = srv.bac('simple', bac);
    db.rows.ecran.widgets = ['dictee', 'notes'];
    const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    await context.addInitScript(init);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    if (!touch) await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.goto(`${srv.url}/dashboard.html?profil=simple&bac=${bac}&labo=${labo}`);
    await page.waitForSelector('#board .widget:not([hidden])');
    return { page, context, db };
  };
  const pill = page => page.locator('[data-widget=dictee] .voice-pill');
  const area = page => page.locator('[data-widget=dictee] .dictee-text');
  const status = page => page.locator('[data-widget=dictee] .dictee-status');

  // 0. Hors labo : pas de widget Dictée.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'horslabo', { labo: 0 });
    assert.equal(await page.locator('[data-widget=dictee]').count(), 0, 'caché hors labo');
    await context.close();
  }

  // 1. Dicter : le texte provisoire s'affiche à part, puis rejoint la note à la fin, enregistrée.
  {
    const { page, context, db } = await open({ width: 1440, height: 900 }, 'dicter');
    await pill(page).waitFor();
    assert.equal(await pill(page).getAttribute('aria-label'), 'Dicter');
    assert.equal(await pill(page).getAttribute('aria-pressed'), 'false');
    assert.ok((await pill(page).boundingBox()).width >= 44, 'cible de 44 px');
    assert.match(await page.locator('[data-widget=dictee] .dictee-privacy').textContent(), /navigateur/);
    await shot(page, 'dictee-repos');
    await pill(page).click(); // un appui court : l'écoute reste ouverte
    assert.equal(await pill(page).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => window.__starts), 1);
    assert.equal(await page.evaluate(() => window.__sr.lang), 'fr-FR');
    await page.evaluate(() => window.__dire([], 'bonjour tout'));
    assert.equal(await page.locator('.dictee-live').textContent(), 'bonjour tout', 'provisoire visible');
    assert.equal(await area(page).inputValue(), '', 'pas encore dans la note');
    await page.evaluate(() => window.__dire(['bonjour tout le monde'], 'je'));
    await page.waitForTimeout(400);
    await shot(page, 'dictee-ecoute');
    await pill(page).click(); // un second appui termine
    await page.waitForFunction(() => document.querySelector('[data-widget=dictee] .dictee-text').value === 'Bonjour tout le monde');
    assert.equal(await pill(page).getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('.dictee-live').textContent(), '');
    assert.match(await status(page).textContent(), /4 mots ajoutés/);
    await page.waitForFunction(() => true);
    await page.waitForTimeout(900);
    assert.equal(db.rows.dictee?.text, 'Bonjour tout le monde', 'enregistré sur le compte');
    // Une seconde dictée s'ajoute à la suite.
    await pill(page).click();
    await page.evaluate(() => window.__dire(['et bonne journée']));
    await pill(page).click();
    await page.waitForFunction(() => document.querySelector('[data-widget=dictee] .dictee-text').value === 'Bonjour tout le monde et bonne journée');
    await shot(page, 'dictee-texte');
    // 2. Annuler en glissant vers la gauche pendant l'appui : rien n'est ajouté.
    const b = await pill(page).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.evaluate(() => window.__dire(['à ne pas garder']));
    await page.mouse.move(b.x + b.width / 2 - 120, b.y + b.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__sr.aborted), true, 'la reconnaissance est abandonnée');
    assert.equal(await area(page).inputValue(), 'Bonjour tout le monde et bonne journée', 'annuler n’ajoute rien');
    assert.match(await status(page).textContent(), /annulée/);
    // 3. Clavier : Espace lance, Échap termine et garde le texte.
    await pill(page).focus();
    await page.keyboard.press('Space');
    assert.equal(await pill(page).getAttribute('aria-pressed'), 'true');
    await page.evaluate(() => window.__dire(['au clavier']));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('[data-widget=dictee] .dictee-text').value.endsWith('au clavier'));
    // 4. Micro refusé : un message clair, le bouton s'arrête.
    await pill(page).click();
    await page.evaluate(() => { window.__sr.onerror({ error: 'not-allowed' }); window.__sr.onend(); });
    await page.waitForFunction(() => document.querySelector('[data-widget=dictee] .voice-pill').getAttribute('aria-pressed') === 'false');
    assert.match(await status(page).textContent(), /micro est refusé/);
    // 5. La reconnaissance s'arrête seule (silence) : le bouton suit, les mots entendus sont gardés.
    await pill(page).click();
    await page.evaluate(() => { window.__dire(['fin naturelle']); window.__sr.onend(); });
    await page.waitForFunction(() => document.querySelector('[data-widget=dictee] .voice-pill').getAttribute('aria-pressed') === 'false');
    assert.ok((await area(page).inputValue()).endsWith('fin naturelle'));
    // 6. Écrire à la main reste possible, et tout revient après rechargement.
    await area(page).fill('Texte corrigé à la main.');
    await page.waitForTimeout(900);
    await page.reload();
    await page.waitForSelector('[data-widget=dictee] .voice-pill');
    assert.equal(await area(page).inputValue(), 'Texte corrigé à la main.');
    await context.close();
  }

  // 7. Navigateur sans dictée : le bouton est inactif et le widget le dit.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'sans', { init: SANS });
    await pill(page).waitFor();
    assert.equal(await pill(page).isDisabled(), true);
    assert.match(await status(page).textContent(), /pas disponible dans ce navigateur/);
    assert.equal(await area(page).isEditable(), true, 'la note reste utilisable');
    await shot(page, 'dictee-sans');
    await context.close();
  }

  // 8. Téléphone : le bouton tient dans l'écran, rien ne déborde.
  {
    const { page, context } = await open({ width: 390, height: 844 }, 'tel', { touch: true });
    await pill(page).waitFor();
    const b = await pill(page).boundingBox();
    assert.ok(b.x >= 0 && b.x + b.width <= 390, 'bouton dans l’écran');
    await pill(page).tap();
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'pas de défilement de côté pendant l’écoute');
    await shot(page, 'dictee-telephone');
    await context.close();
  }

  assert.deepEqual(errors, [], 'aucune erreur de page');
  await browser.close();
  srv.close?.();
  console.log('dictee OK');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
