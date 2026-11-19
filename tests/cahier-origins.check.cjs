// Chromium, avec le banc Study et les mêmes cours, fond d'écran et réglages aux trois ouvertures.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { server, makeDb, card, openBoard, openSpace, shot } = require('./etude-harness.cjs');

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch();
  try {
    const db = makeDb('un');
    const id = db.courses[0].id;
    const chapter = 'Le noyau';
    const passage = db.courses[0].chapters[1].offset + '# Le noyau\n'.length;
    db.cards.push({ ...card('Noyau', 'Que contient le noyau ?'), course_id: id, src_page: 0, src_offset: passage, src_length: 'Ce passage'.length });
    db.links.push({ id: 'lien', course_id: id, chapter_id: 'c1', deck: 'Noyau' });
    Object.assign(db.rows.ecran, {
      wallpaper: 'brume', look: { fini: 'poli', theme: 'dark' },
      widgets: ['cahier', 'etude', 'minuteur'],
      pages: [{ id: 'p1', name: 'Mon écran' }, { id: 'p2', name: 'Study' }],
      where: { cahier: 'p2', etude: 'p2' },
    });
    db.rows.cahier = { course: id, at: { [id]: { chapter: 'c1', y: 0 } } };
    const { page, errors } = await openBoard(browser, `http://127.0.0.1:${server.address().port}`, db, { reducedMotion: 'reduce' });
    await page.evaluate(() => localStorage.setItem('renzvi:page', 'p2'));
    await page.reload();
    const reader = page.locator('.cahier-open');
    const dashboard = page.locator('[data-widget=cahier] .cahier-livre-open');
    const margin = reader.locator('.carnet-margin');
    const panel = page.locator('.etude-panel');
    const toolbar = reader.locator('.carnet-bar');
    const look = reader.locator('.carnet-look');
    const openDashboard = () => dashboard.click();
    const back = label => reader.getByRole('button', { name: label, exact: true }).click();
    const ready = () => page.waitForFunction(title => document.querySelector('.cahier-open .cahier-title')?.textContent === title &&
      document.querySelector('.cahier-open .carnet-add:not([hidden])'), chapter);
    const surface = async name => {
      await reader.getByRole('button', { name: 'Personnaliser' }).click();
      await look.getByRole('button', { name, exact: true }).click();
      await page.keyboard.press('Escape');
    };
    const snapshot = async name => {
      await ready();
      await page.mouse.move(0, 0);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await reader.count(), 1);
      const styles = await reader.evaluate(n => {
        const parts = [n, ...n.querySelectorAll('.cahier-text,.carnet-margin,.carnet-top,.carnet-subbar,.carnet-foot')];
        return parts.map(p => {
          const {x, y, width, height} = p.getBoundingClientRect(), css = getComputedStyle(p);
          return { x, y, width, height, background: css.backgroundColor, blur: css.backdropFilter, padding: css.padding, font: css.font };
        });
      });
      await shot(page, name);
      return styles;
    };
    const selectPassage = () => reader.locator('.cahier-block').first().evaluate(block => {
      const range = document.createRange(), selection = getSelection();
      range.setStart(block.firstChild, 0);
      range.setEnd(block.firstChild, 'Ce passage'.length);
      selection.removeAllRanges();
      selection.addRange(range);
    });
    const saveNote = async text => {
      const draft = reader.locator('.carnet-draft');
      await draft.locator('textarea').fill(text);
      await draft.getByRole('button', { name: 'Enregistrer la note' }).click();
      await margin.getByText(text, { exact: true }).waitFor();
    };

    await openDashboard();
    await reader.getByRole('button', { name: 'Personnaliser' }).click();
    await look.getByRole('slider', { name: /Opacité/ }).fill('62');
    await look.getByRole('slider', { name: /Flou/ }).fill('12');
    await look.getByRole('button', { name: /^Police et texte/ }).click();
    await look.getByRole('slider').fill('21');
    await page.keyboard.press('Escape');
    const verre = await snapshot('cahier-verre-tableau');
    assert.equal(verre[0].background, 'rgba(32, 27, 23, 0.62)');
    assert.equal(verre[1].background, 'rgba(0, 0, 0, 0)');
    await surface('Papier');
    const papier = await snapshot('cahier-papier-tableau');
    await surface('Sombre');
    const sombre = await snapshot('cahier-sombre-tableau');
    await surface('Verre');
    await reader.getByRole('button', { name: 'Chapitre précédent' }).click();
    await back('Retour au tableau');
    assert.equal(await dashboard.evaluate(n => document.activeElement === n), true);
    assert.equal(await page.locator('#mode-now').textContent(), 'Mode : Study');
    assert.equal(await page.evaluate(() => localStorage.getItem('renzvi:page')), 'p2');
    await openSpace(page);

    for (const [name, token, nodeClass, worldClass, label] of [
      ['Constellations', 'constellation', 'cst-chap', 'cst-world', 'Retour à la constellation'],
      ['Arbre', 'arbre', 'arbre-chapitre', 'arbre-world', 'Retour à l’arbre'],
    ]) {
      await page.locator('.etude-tabs').getByRole('button', { name, exact: true }).click();
      const node = page.locator(`.etude-stage .${nodeClass}[data-key="${id}/c1"]`);
      await node.dispatchEvent('click');
      const world = page.locator(`.etude-stage .${worldClass}`);
      const camera = await world.evaluate(n => n.style.transform);
      await panel.locator('[data-key=lire]').click();
      assert.deepEqual(await snapshot(`cahier-verre-${token}`), verre);
      await surface('Papier');
      assert.deepEqual(await snapshot(`cahier-papier-${token}`), papier);
      await surface('Sombre');
      assert.deepEqual(await snapshot(`cahier-sombre-${token}`), sombre);
      await surface('Verre');
      if (token === 'constellation') {
        await selectPassage();
        await toolbar.getByRole('button', { name: 'Surligner', exact: true }).click();
        await page.waitForFunction(() => CSS.highlights.has('carnet-jaune'));
        await margin.getByRole('button', { name: 'Ajouter une note' }).first().click();
        await saveNote('Note de la constellation');
        await reader.getByRole('button', { name: 'Personnaliser' }).click();
        await look.getByRole('slider', { name: /Opacité/ }).fill('63');
        await page.keyboard.press('Escape');
        await back(label);
      } else {
        await reader.getByRole('button', { name: label }).waitFor();
        await page.keyboard.press('Escape');
      }
      await reader.waitFor({ state: 'detached' });
      assert.equal(await node.getAttribute('aria-current'), 'true');
      assert.equal(await panel.locator('h3').textContent(), chapter);
      assert.equal(await world.evaluate(n => n.style.transform), camera);
      if (token === 'constellation') {
        await page.getByRole('button', { name: 'Retour au tableau', exact: true }).click();
        await openDashboard();
        await ready();
        assert.equal(await reader.evaluate(n => getComputedStyle(n).backgroundColor), 'rgba(32, 27, 23, 0.63)');
        await page.waitForFunction(() => [...(CSS.highlights.get('carnet-jaune') ?? [])].some(r => r.toString() === 'Ce passage'));
        await margin.getByText('Note de la constellation', { exact: true }).waitFor();
        await margin.getByRole('button', { name: 'Modifier la note' }).click();
        await saveNote('Note modifiée depuis le tableau');
        await selectPassage();
        await toolbar.getByRole('button', { name: 'Souligner', exact: true }).click();
        await page.waitForFunction(() => CSS.highlights.has('carnet-souligne'));
        assert.equal(db.marks.length, 1);
        assert.equal(db.marks[0].note, 'Note modifiée depuis le tableau');
        assert.equal(db.marks[0].souligne, true);
        await surface('Verre');
        await reader.getByRole('button', { name: 'Personnaliser' }).click();
        await look.getByRole('slider', { name: /Opacité/ }).fill('62');
        await page.keyboard.press('Escape');
        await back('Retour au tableau');
        await openSpace(page);
        assert.equal(await node.getAttribute('aria-current'), 'true');
      }
    }
    await panel.getByRole('tab', { name: 'Réviser' }).click();
    await panel.getByRole('button', { name: 'Réviser le paquet Noyau' }).first().click();
    await page.getByRole('button', { name: 'Voir la réponse' }).click();
    await page.getByRole('button', { name: 'Revoir dans le cours' }).click();
    await ready();
    await page.waitForFunction(() => [...(CSS.highlights.get('cahier') ?? [])].some(r => r.toString() === 'Ce passage'));
    await back('Retour à l’arbre');
    await page.getByRole('button', { name: 'Voir la réponse' }).or(page.getByRole('button', { name: 'Revoir dans le cours' })).waitFor();
    assert.deepEqual(errors, []);
    console.log('ok Cahier partagé, surfaces, annotations, préférences et retour Study');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
