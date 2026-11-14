// Menus déroulants (site/dash/select.js), dans un vrai Chromium, sur le serveur de démo (Supabase simulé).
// Sélecteur de page du mode Disposer, clavier, souris, saisie, options désactivées et longues, retournement vers le haut,
// thème sombre, menu dans le dialogue Réglages, téléphone, mouvement réduit. Le menu du Cahier (groupes) : tests/cahier.check.cjs.
// Lancement : NODE_PATH=~/pw/node_modules node tests/selects.check.cjs   (SHOTS=dossier pour garder les captures)
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');

(async () => {
  const srv = await start();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
  const errors = [];
  const shot = (page, name, clip) => process.env.SHOTS && page.screenshot({ path: `${process.env.SHOTS}/${name}.png`, ...(clip && { clip }) });
  const open = async (viewport, bac, opts = {}) => {
    const context = await browser.newContext({ viewport, hasTouch: !!opts.touch, isMobile: !!opts.touch, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${srv.url}/dashboard.html?profil=plein&bac=${bac}`);
    await page.waitForSelector('#board .widget:not([hidden])');
    return { page, context };
  };
  const list = page => page.locator('.dd-list');
  const isOpen = async page => (await list(page).count()) > 0 && list(page).isVisible();
  const settle = page => page.waitForTimeout(220);
  // Zone de capture autour du bouton et de sa liste.
  const around = async (page, trigger) => {
    const a = await trigger.boundingBox(), b = await list(page).boundingBox().catch(() => null);
    const x = Math.max(0, Math.min(a.x, b?.x ?? a.x) - 24), y = Math.max(0, Math.min(a.y, b?.y ?? a.y) - 24);
    const r = Math.max(a.x + a.width, b ? b.x + b.width : 0) + 24, d = Math.max(a.y + a.height, b ? b.y + b.height : 0) + 24;
    return { x, y, width: r - x, height: d - y };
  };
  const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).map(Number); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };

  // 1. Le sélecteur de page de la capture, en mode Disposer, à la souris et au clavier.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'page');
    await page.click('#open-custom');
    const box = page.locator('#board [data-widget=taches]');
    const trigger = box.getByRole('combobox', { name: 'Page' });
    const native = box.locator('select');
    await trigger.scrollIntoViewIfNeeded();
    assert.equal(await trigger.textContent(), 'Study', 'le bouton montre la page actuelle');
    assert.equal(await native.getAttribute('aria-hidden'), 'true', 'le menu natif est caché aux lecteurs d’écran');
    assert.equal(await box.getByRole('combobox').count(), 1, 'un seul contrôle annoncé');
    await shot(page, 'page-ferme', await around(page, trigger));

    await trigger.click();
    await settle(page);
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
    assert.deepEqual(await page.getByRole('listbox', { name: 'Page' }).getByRole('option').allTextContents(), ['Study', 'Chill']);
    assert.equal(await page.getByRole('option', { name: 'Study' }).getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('.dd-opt[aria-selected=true] .dd-check').isVisible(), true, 'coche sur l’option choisie');
    const bg = await list(page).evaluate(n => getComputedStyle(n).backgroundColor);
    assert.equal(bg, 'rgba(252, 252, 253, 0.96)', 'surface en verre du thème clair, pas le panneau système');
    assert.equal(await list(page).evaluate(n => n.matches(':popover-open')), true, 'la liste est dans la couche du dessus');
    const lb = await list(page).boundingBox(), tb = await trigger.boundingBox();
    assert.ok(lb.y >= tb.y + tb.height && lb.y - (tb.y + tb.height) < 12, 'la liste s’ouvre sous le bouton');
    await page.getByRole('option', { name: 'Chill' }).hover();
    await shot(page, 'page-ouvert-survol', await around(page, trigger));
    // Clic dehors : fermé, rien ne change.
    await page.mouse.click(20, 880);
    assert.equal(await isOpen(page), false, 'clic dehors ferme');
    assert.equal(await native.inputValue(), 'study');

    // Clavier : Échap ferme sans quitter le mode Disposer, le focus revient au bouton.
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await isOpen(page), true, 'flèche bas ouvre');
    assert.equal(await page.locator('.dd-opt.is-active').textContent(), 'Study', 'l’option choisie est active à l’ouverture');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('.dd-opt.is-active').textContent(), 'Chill');
    assert.equal(await trigger.getAttribute('aria-activedescendant'), await page.locator('.dd-opt.is-active').getAttribute('id'));
    await shot(page, 'page-ouvert-clavier', await around(page, trigger));
    await page.keyboard.press('Escape');
    assert.equal(await isOpen(page), false);
    assert.equal(await trigger.evaluate(n => n === document.activeElement), true, 'focus rendu au bouton');
    assert.equal(await page.isVisible('#custom'), true, 'Échap ne ferme que la liste');
    assert.equal(await native.inputValue(), 'study', 'Échap ne choisit rien');
    // Saisie : « c » ouvre et va sur Chill ; Entrée choisit, l’événement change du widget part comme avant.
    await page.keyboard.type('c');
    assert.equal(await page.locator('.dd-opt.is-active').textContent(), 'Chill', 'saisie au clavier');
    await page.keyboard.press('Enter');
    assert.equal(await isOpen(page), false);
    assert.equal(await native.inputValue(), 'chill');
    await page.waitForFunction(() => document.querySelector('#board [data-widget=taches]').hidden);
    assert.match(await page.textContent('#page-note'), /Tâches est maintenant sur « Chill »/);
    // Retour par le menu natif (chemin des autres suites) : le bouton suit.
    await page.click('#page-tabs button:has-text("Chill")');
    await native.selectOption('study');
    assert.equal(await box.locator('.dd-trigger').textContent(), 'Study', 'le bouton suit une valeur posée par le code');
    await context.close();
  }

  // 2. Liste longue près du bas : retournement vers le haut, hauteur bornée, défilement, options longues et désactivées.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'longue');
    await page.evaluate(() => {
      const l = document.createElement('label');
      l.id = 'test-long';
      l.style.cssText = 'position:fixed;left:24px;bottom:24px;display:flex;gap:8px;align-items:center;z-index:5';
      const s = document.createElement('select');
      s.style.cssText = 'width:220px;height:36px;padding:0 12px;border:1px solid var(--edge);border-radius:999px;background:var(--field)';
      s.className = 'cahier-pick';
      for (let i = 1; i <= 30; i++) s.append(Object.assign(document.createElement('option'), { value: `p${i}`, textContent: i === 3 ? 'Paquet très long : anatomie et physiologie du système nerveux périphérique, chapitre 3' : `Paquet ${i}`, disabled: i === 2 || i === 4 }));
      l.append('Paquet', s);
      document.body.append(l);
    });
    const trigger = page.getByRole('combobox', { name: 'Paquet' });
    await trigger.waitFor();
    assert.equal(await trigger.evaluate(n => getComputedStyle(n).borderRadius), await page.evaluate(() => getComputedStyle(document.querySelector('.cahier-pick')).borderRadius), 'le bouton prend le style du menu');
    await trigger.click();
    await settle(page);
    const lb = await list(page).boundingBox(), tb = await trigger.boundingBox();
    assert.ok(lb.y + lb.height <= tb.y, 'pas de place dessous : la liste s’ouvre au-dessus');
    assert.ok(lb.height <= 322, 'hauteur bornée');
    assert.ok(await list(page).evaluate(n => n.scrollHeight > n.clientHeight), 'la liste défile');
    assert.equal(await page.getByRole('option', { name: 'Paquet 2', exact: true }).getAttribute('aria-disabled'), 'true');
    await shot(page, 'longue-ouvert-haut', await around(page, trigger));
    await page.getByRole('option', { name: 'Paquet 2', exact: true }).click({ force: true });
    assert.equal(await isOpen(page), true, 'clic sur une option désactivée : rien');
    await page.keyboard.press('ArrowDown');
    assert.match(await page.locator('.dd-opt.is-active').textContent(), /Paquet très long/, 'flèche bas saute l’option désactivée');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('.dd-opt.is-active').textContent(), 'Paquet 5', 'saute aussi la 4');
    await page.keyboard.press('End');
    assert.equal(await page.locator('.dd-opt.is-active').textContent(), 'Paquet 30');
    await page.keyboard.press('PageUp');
    assert.equal(await page.locator('.dd-opt.is-active').textContent(), 'Paquet 20');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#test-long select').inputValue(), 'p20');
    await trigger.click();
    await settle(page);
    const shown = await page.evaluate(() => { const l = document.querySelector('.dd-list').getBoundingClientRect(), o = document.querySelector('.dd-opt[aria-selected=true]').getBoundingClientRect(); return o.top >= l.top && o.bottom <= l.bottom; });
    assert.ok(shown, 'à la réouverture, l’option choisie est visible');
    await page.keyboard.press('Escape');
    // Option longue choisie : le bouton coupe le texte proprement.
    await page.locator('#test-long select').selectOption('p3');
    assert.equal(await trigger.evaluate(n => n.scrollWidth <= n.clientWidth + 1), true, 'pas de débordement du bouton');
    await shot(page, 'longue-ferme', await around(page, trigger));
    // Menu désactivé : bouton désactivé.
    await page.evaluate(() => { document.querySelector('#test-long select').disabled = true; });
    await page.waitForFunction(() => document.querySelector('#test-long .dd-trigger').disabled);
    // Défilement de la page pendant l’ouverture : la liste suit le bouton.
    await page.evaluate(() => { document.querySelector('#test-long select').disabled = false; document.querySelector('#test-long').style.cssText = 'position:absolute;left:24px;top:600px;display:flex;gap:8px;align-items:center;z-index:5'; });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await settle(page);
    const y0 = (await list(page).boundingBox()).y;
    await page.evaluate(() => scrollBy(0, 40));
    await page.waitForFunction(y => Math.abs(document.querySelector('.dd-list').getBoundingClientRect().top - (y - 40)) < 2, y0, { timeout: 3000 }).catch(() => {});
    const lAfter = await list(page).boundingBox(), tAfter = await trigger.boundingBox();
    const gap = lAfter.y < tAfter.y ? tAfter.y - (lAfter.y + lAfter.height) : lAfter.y - (tAfter.y + tAfter.height);
    assert.ok(Math.abs(gap - 6) < 2, `la liste suit le bouton au défilement (écart ${gap}, ${JSON.stringify([lAfter, tAfter])})`);
    await page.keyboard.press('Escape');
    await context.close();
  }

  // 3. Thème sombre : la liste prend la surface sombre, pas un panneau clair.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'sombre');
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await page.click('#open-custom');
    const trigger = page.locator('#board [data-widget=taches]').getByRole('combobox', { name: 'Page' });
    await trigger.scrollIntoViewIfNeeded();
    await shot(page, 'sombre-ferme', await around(page, trigger));
    await trigger.click();
    await settle(page);
    assert.ok(lum(await list(page).evaluate(n => getComputedStyle(n).backgroundColor)) < 0.2, 'surface sombre');
    assert.ok(lum(await page.locator('.dd-opt').first().evaluate(n => getComputedStyle(n).color)) > 0.8, 'texte clair');
    await page.keyboard.press('ArrowDown');
    await shot(page, 'sombre-ouvert', await around(page, trigger));
    await context.close();
  }

  // 4. Dans le dialogue Réglages : liste au-dessus du dialogue, Échap ferme la liste puis le dialogue.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'reglages');
    const typeCode = async code => { await page.keyboard.type(code, { delay: 20 }); await page.waitForTimeout(500); };
    await page.locator('#open-settings').click();
    await page.locator('.lock-set').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Choisir un code' }).click();
    await typeCode('482915');
    await typeCode('482915');
    await page.waitForFunction(() => !document.querySelector('dialog.lock-setup[open]'));
    const trigger = page.getByRole('combobox', { name: 'Verrouiller seul' });
    await trigger.scrollIntoViewIfNeeded();
    assert.equal(await trigger.textContent(), 'Jamais');
    await page.click('label[for=lock-auto]');
    assert.equal(await trigger.evaluate(n => n === document.activeElement), true, 'le libellé donne le focus au bouton');
    await trigger.click();
    await settle(page);
    assert.equal(await list(page).evaluate(n => !!n.closest('dialog.settings')), true, 'la liste reste dans le dialogue (pas inerte)');
    const top = await page.evaluate(() => { const r = document.querySelector('.dd-opt:last-child').getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.dd-opt')?.textContent; });
    assert.equal(top, 'Après 30 min sans activité', 'rien ne recouvre la liste');
    await shot(page, 'reglages-ouvert', await around(page, trigger));
    await page.getByRole('option', { name: 'Après 15 min sans activité' }).click();
    assert.equal(await page.locator('#lock-auto').inputValue(), '15');
    assert.equal(await trigger.evaluate(n => n === document.activeElement), true);
    const saved = await page.evaluate(() => Object.entries(localStorage).find(([k]) => k.startsWith('renzvi:verrou'))?.[1]);
    assert.match(saved, /"auto":15/, 'le réglage est enregistré comme avant');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog.settings').evaluate(n => n.open), true, 'Échap ferme la liste, pas le dialogue');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog.settings[open]'));
    await context.close();
  }

  // 5. Téléphone tactile : la liste tient dans l’écran, cibles de 44 px, un toucher choisit.
  {
    const { page, context } = await open({ width: 390, height: 844 }, 'tel', { touch: true });
    await page.locator('#open-custom').tap();
    const trigger = page.locator('#board [data-widget=taches]').getByRole('combobox', { name: 'Page' });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.tap();
    await settle(page);
    const lb = await list(page).boundingBox();
    assert.ok(lb.x >= 8 && lb.x + lb.width <= 382, 'dans la largeur de l’écran');
    assert.ok((await page.locator('.dd-opt').first().boundingBox()).height >= 44, 'cible tactile');
    await shot(page, 'tel-ouvert');
    await page.getByRole('option', { name: 'Chill' }).tap();
    assert.equal(await isOpen(page), false);
    assert.equal(await page.locator('#board [data-widget=taches] select').inputValue(), 'chill');
    await context.close();
  }

  // 6. Mouvement réduit : aucune animation d’ouverture.
  {
    const { page, context } = await open({ width: 1440, height: 900 }, 'reduit', { reduced: true });
    await page.click('#open-custom');
    const trigger = page.locator('#board [data-widget=taches]').getByRole('combobox', { name: 'Page' });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    assert.equal(await list(page).evaluate(n => n.getAnimations().length), 0);
    await context.close();
  }

  assert.deepEqual(errors, [], 'aucune erreur de page');
  await browser.close();
  srv.close?.();
  console.log('selects OK');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
