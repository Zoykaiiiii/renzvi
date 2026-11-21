// NODE_PATH=~/pw/node_modules node tests/language.check.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');
const { openMe } = require('./menu.cjs');

(async () => {
  const server = await start();
  const browser = await chromium.launch({ args: ['--disable-gpu'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
    await context.addInitScript(() => {
      window.Translator = {
        availability: async () => 'available',
        create: async ({ sourceLanguage, targetLanguage }) => {
          if (sourceLanguage !== 'fr') throw Error('unexpected source');
          return { translate: async text => `[${targetLanguage}] ${text}`, destroy() {} };
        },
      };
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const host = page.locator('[data-language-picker]');
    const select = host.locator('select');
    const choose = async language => {
      if (await host.locator('form').isHidden()) await host.locator('summary').click();
      await select.selectOption(language);
      await host.locator('button').click();
      await page.waitForFunction(value => document.documentElement.lang === value, language);
    };

    await page.goto(server.url);
    const title = page.locator('main h1').first();
    const originalTitle = await title.textContent();
    assert.equal(await select.locator('option').count(), 39);
    await choose('en');
    await title.getByText(/\[en\]/).first().waitFor({ state: 'attached' });
    await choose('ar');
    assert.equal(await page.locator('html').getAttribute('data-translating-rtl'), '');
    await choose('fr');
    assert.equal(await title.textContent(), originalTitle);
    await choose('es');

    await page.goto(`${server.url}/legal.html`);
    await page.waitForFunction(() => document.documentElement.lang === 'es');
    await page.locator('main h1').filter({ hasText: '[es]' }).waitFor();

    // Sur la connexion, la préférence suit la navigation et la traduction ne touche pas à la saisie.
    await page.goto(`${server.url}/login.html`);
    await page.waitForFunction(() => document.documentElement.lang === 'es');
    await page.locator('#email').fill('lea@example.com');
    await page.locator('label[for=email]').filter({ hasText: '[es]' }).waitFor();
    await choose('de');
    assert.equal(await page.locator('#email').inputValue(), 'lea@example.com');

    // Le catalogue est monté après le changement de langue.
    await page.goto(`${server.url}/dashboard.html?profil=plein&bac=langue`);
    await page.waitForSelector('#board .widget:not([hidden])');
    await page.waitForFunction(() => document.documentElement.lang === 'de');
    const task = page.locator('[data-widget=taches] [translate=no]').first();
    assert.equal(await task.textContent(), 'Relire le chapitre 4 de droit des contrats');
    await page.locator('#open-add').click();
    await page.locator('#catalog .cat-item').first().filter({ hasText: '[de]' }).waitFor();
    await page.keyboard.press('Escape');
    await openMe(page);
    await choose('fr');
    assert.equal(await task.textContent(), 'Relire le chapitre 4 de droit des contrats');
    assert.deepEqual(errors, []);
    await context.close();

    const fallback = await browser.newPage();
    await fallback.addInitScript(() => { Object.defineProperty(window, 'Translator', { value: undefined }); });
    await fallback.goto(server.url + '/legal.html');
    await fallback.locator('[data-language-picker] summary').click();
    assert.match(await fallback.locator('[data-language-picker] [role=status]').textContent(), /traduction de page/);
    assert.equal(await fallback.locator('html').getAttribute('lang'), 'fr');
    console.log('language : traductions, navigation, contenu saisi et navigateur sans modèle OK');
  } finally {
    await browser.close();
    await server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
