// Aides communes aux suites : le menu latéral du dashboard (site/dashboard.html).
// Personnaliser ouvre le panneau ; « Disposer les widgets » y passe ; un mode se change par la roue, au clavier.
// Sur tablette et téléphone, le menu est un tiroir : chaque aide l'ouvre d'abord si besoin.
// Sur ordinateur avec une souris, le menu s'ouvre au survol de la pastille ; ailleurs, d'un toucher sur le bouton.
const showMenu = async page => {
  if (await page.locator('#open-custom').isVisible()) return;
  const hover = await page.evaluate(() => matchMedia('(min-width:1024px) and (hover:hover) and (pointer:fine)').matches);
  if (hover) await page.locator('#bar-toggle').hover(); else await page.locator('#bar-toggle').click();
  await page.locator('#open-custom').waitFor();
};
const custom = async page => { await showMenu(page); await page.locator('#open-custom').click(); await page.waitForSelector('#settings[open]'); };
const closeCustom = async page => { await page.click('#settings-close'); await page.waitForSelector('#settings', { state: 'hidden' }); };
const dispose = async page => { await custom(page); await page.click('#layout-edit'); await page.waitForSelector('#settings', { state: 'hidden' }); };
const openMe = async page => { await showMenu(page); await page.locator('#me').click(); };
// Carte du compte : les réglages sont repliés ; on déplie la section voulue (Abonnement, Parrainage, Verrouillage…).
const acctSection = async (page, name) => {
  const s = page.locator('#menu .acct-row > summary', { hasText: name });
  if (!await s.evaluate(n => n.parentElement.open)) await s.click();
};
const wheelShut = page => page.waitForFunction(() => !document.querySelector('dialog.mode-wheel[open]'));
const openWheel = async page => { await showMenu(page); await page.click('#open-modes'); await page.waitForSelector('dialog.mode-wheel[open] .option-wheel'); };
const modeNames = async page => {
  await openWheel(page);
  const names = await page.locator('dialog.mode-wheel .mw-item:not(.mw-create) .mw-name').allTextContents();
  await page.keyboard.press('Escape');
  await wheelShut(page);
  return names;
};
// Comme quelqu'un qui fait tourner la roue : flèches jusqu'au mode, puis Entrée.
const goMode = async (page, name) => {
  await openWheel(page);
  const items = page.locator('dialog.mode-wheel .option-wheel__item');
  const names = await items.locator('.mw-name').allTextContents();
  const from = await items.evaluateAll(n => n.findIndex(x => x.getAttribute('aria-selected') === 'true'));
  const to = names.indexOf(name);
  if (to < 0) throw new Error(`mode introuvable : ${name} (${names.join(', ')})`);
  for (let i = 0; i < Math.abs(to - from); i++) await page.keyboard.press(to > from ? 'ArrowDown' : 'ArrowUp');
  await page.keyboard.press('Enter');
  await wheelShut(page);
};
const modeNow = async page => (await page.textContent('#mode-now')).replace(/^Mode : /, '');
// En mode Disposer, l'ordre, la taille et la page d'un widget sont dans son panneau « Options », ouvert à la demande.
const options = async (page, title) => {
  const b = page.getByRole('button', { name: `Options de ${title} : ordre, taille, page` });
  if (await b.getAttribute('aria-expanded') !== 'true') await b.click();
};
module.exports = { showMenu, custom, closeCustom, dispose, openMe, acctSection, openWheel, modeNames, goMode, modeNow, wheelShut, options };
