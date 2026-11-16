// Mes polices (Personnaliser → Typographie) dans un vrai Chromium, sur le serveur de démo (Supabase simulé) :
// fichiers refusés, aperçu puis annulation, application, doublon, WOFF/WOFF2/OTF/italique, graisses lues dans le fichier,
// renommer, rechargement, échec d'envoi, échec de chargement, retrait de la police active, police par défaut,
// isolation entre comptes, logo intact, mises en page (téléphone, zoom 200 %, police très large).
// L'isolation réelle des fichiers est vérifiée côté base par tests/rls.check.sh.
// Lancement : NODE_PATH=~/pw/node_modules node tests/polices.check.cjs   (SHOTS=dossier pour garder les captures)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');
const { custom, closeCustom } = require('./menu.cjs');

const SYS = '/usr/share/fonts';
const file = (name, buffer, mimeType = 'application/octet-stream') => ({ name, mimeType, buffer });
const sysFont = (p, name = path.basename(p)) => file(name, fs.readFileSync(path.join(SYS, p)));
const siteFont = (p, name) => file(name, fs.readFileSync(path.join(__dirname, '..', 'site', 'fonts', p)));

// TTF → WOFF (tables compressées en zlib), pour tester ce format sans dépendance.
function toWoff(ttf) {
  const n = ttf.readUInt16BE(4), tables = [];
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16, off = ttf.readUInt32BE(o + 8), len = ttf.readUInt32BE(o + 12);
    const data = ttf.subarray(off, off + len), comp = zlib.deflateSync(data);
    tables.push({ tag: ttf.subarray(o, o + 4), sum: ttf.readUInt32BE(o + 4), data, stored: comp.length < len ? comp : data });
  }
  const pad = x => (x + 3) & ~3;
  let at = 44 + 20 * n, sfnt = 12 + 16 * n;
  const head = Buffer.alloc(at), parts = [];
  tables.forEach((t, i) => {
    const o = 44 + i * 20;
    t.tag.copy(head, o);
    head.writeUInt32BE(at, o + 4); head.writeUInt32BE(t.stored.length, o + 8); head.writeUInt32BE(t.data.length, o + 12); head.writeUInt32BE(t.sum, o + 16);
    parts.push(t.stored, Buffer.alloc(pad(t.stored.length) - t.stored.length));
    at += pad(t.stored.length); sfnt += pad(t.data.length);
  });
  head.write('wOFF', 0, 'latin1'); ttf.copy(head, 4, 0, 4);
  head.writeUInt32BE(at, 8); head.writeUInt16BE(n, 12); head.writeUInt32BE(sfnt, 16); head.writeUInt16BE(1, 20);
  return Buffer.concat([head, ...parts]);
}
// TTF + une table fvar (axe wght 100 à 900) : vérifie la lecture d'une police variable sans en avoir une sur la machine.
function withFvar(ttf) {
  const n = ttf.readUInt16BE(4), fvar = Buffer.alloc(16 + 20);
  fvar.writeUInt16BE(1, 0); fvar.writeUInt16BE(16, 4); fvar.writeUInt16BE(2, 6); fvar.writeUInt16BE(1, 8); fvar.writeUInt16BE(20, 10);
  fvar.write('wght', 16, 'latin1'); fvar.writeInt32BE(100 * 65536, 20); fvar.writeInt32BE(400 * 65536, 24); fvar.writeInt32BE(900 * 65536, 28);
  const dir = Buffer.alloc(12 + 16 * (n + 1));
  ttf.copy(dir, 0, 0, 12); dir.writeUInt16BE(n + 1, 4);
  for (let i = 0; i < n; i++) { ttf.copy(dir, 12 + i * 16, 12 + i * 16, 28 + i * 16); dir.writeUInt32BE(ttf.readUInt32BE(20 + i * 16) + 16, 20 + i * 16); }
  const o = 12 + n * 16;
  dir.write('fvar', o, 'latin1'); dir.writeUInt32BE(ttf.length + 16, o + 8); dir.writeUInt32BE(fvar.length, o + 12);
  return Buffer.concat([dir, ttf.subarray(12 + 16 * n), fvar]);
}

(async () => {
  const srv = await start();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
  const errors = [];
  const shot = (page, name, opts = {}) => process.env.SHOTS && page.screenshot({ path: `${process.env.SHOTS}/${name}.png`, ...opts });
  // Mes polices est réservé à Pro : les comptes de ce test sont Pro, sauf le parcours « Gratuit » qui vérifie le cadenas.
  const open = async (bac, viewport = { width: 1440, height: 900 }, profil = 'simple', plan = 'pro') => {
    if (plan !== 'gratuit') srv.bac(profil, bac.toLowerCase().replace(/[^a-z0-9]/g, '')).abonnement = { plan, statut: 'actif', fin: null }; // même nettoyage que le serveur de démo
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${srv.url}/dashboard.html?profil=${profil}&bac=${bac}`);
    await page.waitForSelector('#board .widget:not([hidden])');
    if (plan !== 'gratuit') await page.waitForFunction(() => document.getElementById('plan-nom').textContent !== 'Gratuit');
    return { page, context };
  };
  const ecran = (bac, profil = 'simple') => srv.bac(profil, bac).rows.ecran;
  const files = (bac, profil = 'simple') => [...srv.bac(profil, bac).files.keys()].filter(k => k.startsWith('polices/'));
  const sans = page => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sans').trim());
  const helloFont = page => page.evaluate(() => getComputedStyle(document.getElementById('hello')).fontFamily);
  // Espaces insécables du français (« … », ? !) lus comme des espaces simples.
  const txt = async (page, sel) => (await page.textContent(sel)).replace(/\u00a0/g, ' ');
  const msg = page => txt(page, '#mp-msg');
  const pick = (page, f) => page.setInputFiles('#mp-file', f);
  const waitPreview = page => page.waitForSelector('#mp-preview:not([hidden]) .mp-sample');
  const waitSaved = (bac, test) => { const t0 = Date.now(); return (async function loop() { if (test(ecran(bac))) return; if (Date.now() - t0 > 5000) throw new Error('enregistrement attendu'); await new Promise(r => setTimeout(r, 100)); return loop(); })(); };
  const noOverflow = async (page, where) => {
    const o = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, set: (() => { const b = document.querySelector('#settings[open] .set-body'); return b ? b.scrollWidth - b.clientWidth : 0; })() }));
    assert.ok(o.doc <= 0, `${where} : la page déborde de ${o.doc} px`);
    assert.ok(o.set <= 0, `${where} : le panneau déborde de ${o.set} px`);
  };

  try {
    const dejavu = sysFont('truetype/dejavu/DejaVuSans.ttf');
    const { page } = await open('a');
    const before = await sans(page);
    const logo = await page.evaluate(() => getComputedStyle(document.querySelector('.mark')).fontFamily);
    await custom(page);
    await page.locator('#mp-import').scrollIntoViewIfNeeded();
    // Groupe Typographie : polices intégrées, Mes polices, limites et rappel des droits visibles avant de choisir.
    assert.deepEqual(await page.locator('#settings .set-group > h3').allTextContents(), ["Fond d'écran", 'Apparence', 'Typographie', 'Disposition', 'Espace actuel']);
    assert.match(await txt(page, '#mp-rules'), /WOFF2, WOFF, TTF ou OTF, 3 Mo maximum, 10 polices au plus\. Importe seulement des polices que tu as le droit d’utiliser\./);
    assert.equal(await page.getAttribute('#mp-import', 'aria-describedby'), 'mp-rules');
    assert.equal(await page.isDisabled('#mp-default'), true, 'déjà en police par défaut');
    const chooser = page.waitForEvent('filechooser');
    await page.click('#mp-import');
    assert.equal((await chooser).isMultiple(), false);
    await shot(page, '1-importer', { clip: await page.locator('#settings').boundingBox() });

    // Refus : rien n'est appliqué, rien n'est envoyé.
    for (const [f, re] of [
      [file('notes.txt', Buffer.from('bonjour')), /Format non pris en charge/],
      [file('faux.ttf', Buffer.from('ceci est un texte et pas une police du tout')), /n’est pas une police lisible/],
      [file('image.woff2', fs.readFileSync(path.join(__dirname, '..', 'site', 'icons', fs.readdirSync(path.join(__dirname, '..', 'site', 'icons')).find(n => n.endsWith('.png'))))), /n’est pas une police lisible/],
      [file('lourde.woff2', Buffer.alloc(3 * 1024 * 1024 + 1)), /trop lourd \(3,0 Mo\)\. 3 Mo au maximum/],
      [file('famille.ttc', Buffer.from('ttcf0000000000000000')), /collections/],
      [file('abimee.ttf', Buffer.concat([dejavu.buffer.subarray(0, 4000)])), /n’a pas pu lire cette police/],
    ]) {
      await pick(page, f);
      await page.waitForFunction(() => document.getElementById('mp-msg').classList.contains('bad'));
      assert.match(await msg(page), re, f.name);
      assert.equal(await page.isHidden('#mp-preview'), true, `${f.name} : pas d'aperçu`);
      assert.equal(await sans(page), before, `${f.name} : police inchangée`);
    }
    assert.deepEqual(files('a'), []);

    // Aperçu puis Annuler : l'écran change en direct, rien n'est enregistré, puis tout revient.
    await pick(page, dejavu);
    await waitPreview(page);
    assert.equal(await txt(page, '.mp-head b'), 'DejaVu Sans');
    assert.match(await txt(page, '.mp-facts'), /Une seule graisse \(400\)/);
    assert.match(await txt(page, '.mp-facts'), /Pas d’italique/);
    assert.match(await txt(page, '.mp-sample'), /Où en est l’œuvre \? Déjà 12 h 45 — « Ça avance ! »/);
    assert.match(await sans(page), /^"rz-[0-9a-f]{16}"/);
    assert.match(await helloFont(page), /^"?rz-/);
    assert.equal(await page.evaluate(() => document.activeElement.className), 'mp-head', 'le focus va sur l’aperçu');
    assert.equal(ecran('a').polices, undefined, 'rien enregistré pendant l’aperçu');
    await shot(page, '2-apercu');
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    assert.equal(await page.isHidden('#mp-preview'), true);
    assert.equal(await sans(page), before);
    assert.deepEqual(files('a'), []);
    // Fermer le panneau pendant un aperçu l'annule aussi.
    await pick(page, dejavu);
    await waitPreview(page);
    await closeCustom(page);
    assert.equal(await sans(page), before, 'fermer annule l’aperçu');
    await custom(page);

    // Appliquer : fichier privé envoyé, liste et choix enregistrés, police vraiment chargée.
    await pick(page, dejavu);
    await waitPreview(page);
    await page.getByRole('button', { name: 'Appliquer', exact: true }).click();
    await page.waitForFunction(() => /appliquée/.test(document.getElementById('mp-msg').textContent));
    await waitSaved('a', e => e?.polices?.length === 1);
    const dv = ecran('a').polices[0];
    assert.deepEqual({ ...dv, id: 'x' }, { id: 'x', slot: 1, nom: 'DejaVu Sans', format: 'ttf', poids: [400, 400], italique: false, variable: false, ital: false });
    assert.deepEqual(ecran('a').look.texte, `p-${dv.id}`);
    assert.equal(ecran('a').look.titre, 'defaut');
    assert.deepEqual(files('a'), ['polices/demo-simple-a/1']);
    assert.equal(srv.bac('simple', 'a').files.get('polices/demo-simple-a/1').type, 'font/ttf');
    assert.equal(await page.evaluate(id => [...document.fonts].some(f => f.family === `rz-${id}` && f.status === 'loaded'), dv.id), true);
    assert.equal(await txt(page, '.mp-row.on span'), 'Active · Titres et texte');
    assert.equal(await txt(page, '#texte-name'), 'DejaVu Sans');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.mark')).fontFamily), logo, 'le logo garde sa police');
    assert.equal(await page.isDisabled('#mp-default'), false);

    // Même fichier une deuxième fois : pas de doublon, on retombe sur la police existante.
    await pick(page, file('copie.ttf', dejavu.buffer));
    await waitPreview(page);
    assert.match(await msg(page), /déjà dans Mes polices, sous le nom « DejaVu Sans »/);
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    assert.equal(await page.locator('.mp-row').count(), 1);

    // OTF par la carte « + » des titres : l'aperçu vise déjà les titres, le texte garde DejaVu.
    const addTitre = page.getByRole('button', { name: 'Importer ta police pour les titres' });
    assert.equal(await page.locator('#fonts-titre .font-opt').first().getAttribute('aria-label'), 'Importer ta police pour les titres');
    await page.locator('#pager-titre [aria-label="Page 1 sur 5"]').click();
    const chooserT = page.waitForEvent('filechooser');
    await addTitre.click();
    await (await chooserT).setFiles(path.join(SYS, 'opentype/tlwg/Loma.otf'));
    await waitPreview(page);
    assert.equal(await page.locator('#mp-preview .choices [aria-pressed=true]').textContent(), 'Titres');
    assert.match(await page.evaluate(() => getComputedStyle(document.getElementById('hello')).fontFamily), /^"?rz-/);
    await page.getByRole('button', { name: 'Appliquer', exact: true }).click();
    await waitSaved('a', e => e?.polices?.length === 2);
    const loma = ecran('a').polices[1];
    assert.equal(loma.format, 'otf');
    assert.equal(ecran('a').look.titre, `p-${loma.id}`);
    assert.equal(ecran('a').look.texte, `p-${dv.id}`);
    assert.deepEqual(await page.locator('.mp-row span').allTextContents(), ['Active · Texte', 'Active · Titres']);

    // WOFF, italique, variable, WOFF2 : ce qui est affirmé vient du fichier.
    await pick(page, file('DejaVuSans-Bold.woff', toWoff(fs.readFileSync(path.join(SYS, 'truetype/dejavu/DejaVuSans-Bold.ttf')))));
    await waitPreview(page);
    assert.equal(await txt(page, '.mp-head b'), 'DejaVu Sans Bold');
    assert.match(await txt(page, '.mp-facts'), /Une seule graisse \(700\)/);
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await pick(page, sysFont('truetype/freefont/FreeSansOblique.ttf'));
    await waitPreview(page);
    assert.match(await txt(page, '.mp-facts'), /Ce fichier est en italique/);
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    const vf = await page.evaluate(async bytes => (await window.renzviPolices.inspect(new File([new Uint8Array(bytes)], 'Variable.ttf'))).font, [...withFvar(dejavu.buffer)]);
    assert.deepEqual([vf.variable, vf.poids, vf.nom], [true, [100, 900], 'DejaVu Sans']);
    assert.deepEqual(await page.evaluate(f => window.renzviPolices.facts(f, null).map(t => t.replace(/\u00a0/g, ' ')), vf), ['Police variable : graisses de 100 à 900.', 'Pas d’italique dans ce fichier : il est imité.']);
    await pick(page, siteFont('inter-latin.woff2', 'Inter.woff2'));
    await waitPreview(page);
    assert.equal(await txt(page, '.mp-head b'), 'Inter');
    assert.match(await txt(page, '.mp-facts'), /non lisibles dans un fichier WOFF2/);
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();

    // Renommer.
    await page.getByRole('button', { name: 'Renommer DejaVu Sans' }).click();
    await page.fill('#page-slot input', 'Ma police de cours');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await waitSaved('a', e => e.polices[0].nom === 'Ma police de cours');
    assert.equal(await txt(page, '#texte-name'), 'Ma police de cours');
    await closeCustom(page);
    await shot(page, '3-dashboard-police-importee');

    // Rechargement : la police revient depuis le stockage, sans adresse temporaire enregistrée.
    assert.doesNotMatch(JSON.stringify(ecran('a')), /blob:|data:/);
    await page.reload();
    await page.waitForSelector('#board .widget:not([hidden])');
    await page.waitForFunction(id => [...document.fonts].some(f => f.family === `rz-${id}` && f.status === 'loaded'), dv.id);
    assert.match(await sans(page), new RegExp(`^"rz-${dv.id}"`));
    // Seules les polices utilisées sont téléchargées (2 sur 2 ici) ; aucune police non utilisée.
    assert.equal(await page.evaluate(() => [...document.fonts].filter(f => f.family.startsWith('rz-')).length), 2);

    // Échec d'envoi : la police d'avant reste, rien n'est ajouté.
    await custom(page);
    await page.route('**/storage/v1/object/polices/**', r => r.request().method() === 'POST' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"panne"}' }) : r.continue());
    const shown = await sans(page);
    await pick(page, sysFont('truetype/liberation/LiberationSerif-Regular.ttf'));
    await waitPreview(page);
    await page.getByRole('button', { name: 'Appliquer', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('mp-msg').classList.contains('bad'));
    assert.match(await msg(page), /L’envoi de la police a échoué\. Rien n’a changé/);
    assert.equal(await sans(page), shown);
    assert.equal(ecran('a').polices.length, 2);
    await page.unroute('**/storage/v1/object/polices/**');

    // Retirer la police active du texte : retour à la police par défaut, fichier supprimé.
    await page.getByRole('button', { name: 'Retirer Ma police de cours' }).click();
    assert.match(await txt(page, '#page-slot'), /utilisée en ce moment : l’écran reviendra à la police par défaut/);
    await page.getByRole('button', { name: 'Retirer la police', exact: true }).click();
    await waitSaved('a', e => e.polices.length === 1 && e.look.texte === 'systeme');
    assert.equal(ecran('a').look.titre, `p-${loma.id}`, 'les titres gardent leur police');
    assert.deepEqual(files('a'), [`polices/demo-simple-a/${loma.slot}`]);
    assert.equal(await page.evaluate(id => [...document.fonts].some(f => f.family === `rz-${id}`), dv.id), false);

    // Police par défaut.
    await page.click('#mp-default');
    await waitSaved('a', e => e.look.titre === 'defaut' && e.look.texte === 'systeme');
    assert.equal(await sans(page), before);

    // Échec de chargement au démarrage : message, écran utilisable en police système.
    await page.locator('.mp-pick').first().click();
    await waitPreview(page);
    await page.getByRole('button', { name: 'Appliquer', exact: true }).click();
    await waitSaved('a', e => e.look.texte === `p-${loma.id}`);
    srv.bac('simple', 'a').files.delete(`polices/demo-simple-a/${loma.slot}`);
    await page.reload();
    await page.waitForSelector('#board .widget:not([hidden])');
    await page.waitForFunction(() => /n’a pas pu se charger\. Le texte reste en police système/.test(document.getElementById('saved').textContent));
    assert.match(await sans(page), /-apple-system/, 'la police système reste derrière');
    assert.equal(await page.isVisible('#board .widget'), true);
    // Ouvrir la police manquante : message, aucun changement.
    await custom(page);
    await page.locator('.mp-pick').first().click();
    await page.waitForFunction(() => document.getElementById('mp-msg').classList.contains('bad'));
    assert.match(await msg(page), /n’a pas pu se charger\. Rien n’a changé/);
    assert.equal(await page.isHidden('#mp-preview'), true);

    // Isolation : un autre compte ne voit rien de ces polices.
    const other = await open('b');
    await custom(other.page);
    assert.equal(await other.page.locator('.mp-row').count(), 0);
    assert.deepEqual(files('b'), []);
    await other.context.close();

    // Mises en page avec une police très large, sur le profil complet : bureau, téléphone, zoom 200 % (1280 px vus à 640).
    for (const [name, viewport] of [['bureau', { width: 1440, height: 900 }], ['telephone', { width: 390, height: 844 }], ['zoom-200', { width: 640, height: 450 }]]) {
      const { page: p, context } = await open(`large-${name}`, viewport, 'plein');
      await custom(p);
      await p.locator('#mp-import').scrollIntoViewIfNeeded();
      await pick(p, siteFont('climate-crisis-latin.woff2', 'Climate Crisis.woff2'));
      await waitPreview(p);
      await noOverflow(p, `${name}, aperçu`);
      if (name === 'telephone') await shot(p, '4-apercu-telephone');
      await p.getByRole('button', { name: 'Appliquer', exact: true }).click();
      await p.waitForFunction(() => /appliquée/.test(document.getElementById('mp-msg').textContent));
      await closeCustom(p);
      await p.evaluate(() => document.fonts.ready);
      await noOverflow(p, `${name}, dashboard`);
      // En-têtes de widgets : coupés proprement (points de suspension), jamais par-dessus leurs boutons.
      const clash = await p.evaluate(() => [...document.querySelectorAll('#board .widget:not([hidden]) h2')].filter(h => {
        const r = h.getBoundingClientRect(), box = h.closest('.widget').getBoundingClientRect();
        return r.right > box.right + 1 || r.width === 0;
      }).map(h => h.textContent));
      assert.deepEqual(clash, [], `${name} : en-têtes de widgets`);
      await shot(p, `5-dashboard-large-${name}`, { fullPage: name !== 'bureau' });
      await context.close();
    }

    assert.deepEqual(errors, []);
    console.log('polices : tous les parcours passent');
  } finally {
    await browser.close();
    await srv.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
