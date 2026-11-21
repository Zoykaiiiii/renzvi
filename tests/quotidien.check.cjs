// Quotidien (labo) : Aujourd'hui, Agenda, Liste de courses, Mes dépenses, Mes abonnements, dans un vrai Chromium,
// sur le serveur de démo (Supabase simulé, données de démonstration seulement). Suit la liste de vérification du brief.
// Lancement : NODE_PATH=~/pw/node_modules node tests/quotidien.check.cjs   (SHOTS=dossier pour les captures)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');

const SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const day = n => new Date(Date.now() + n * 864e5).toLocaleDateString('sv');
const QW = ['aujourdhui', 'agenda', 'courses', 'depenses', 'abos'];
const ABO_M = '11111111-1111-4111-8111-111111111111', ABO_A = '22222222-2222-4222-8222-222222222222';

function seed(b) {
  b.rows.taches = { items: [
    { id: 't1', text: 'Relire le chapitre 4', done: false, due: day(0) },
    { id: 't2', text: 'Envoyer le dossier de stage', done: false, due: day(-2) },
    { id: 't3', text: 'Appeler la scolarité', done: false, due: day(3) },
    { id: 't4', text: 'Ranger le bureau', done: false },
  ] };
  b.rows.habitudes = { items: [{ id: 'h1', name: 'Lire vingt minutes', days: [day(-1)] }] };
  b.rows.compte = { items: [{ id: 'c1', title: 'Partiel de droit civil', date: day(5) }] };
  b.rows.agenda = { events: [{ id: 'e1', t: 'Dentiste', d: day(0), h1: '23:00', h2: '23:30', lieu: 'Cabinet du centre' }] };
  b.rows.courses = { items: [{ id: 'c1', n: 'pommes', q: 1, u: 'kg', c: 'Fruits et légumes', ok: false }] };
  b.rows.abos = { items: [
    { id: ABO_M, nom: 'Musique', cents: 1199, devise: 'EUR', periode: 'mois', next: day(-1), actif: true },
    { id: ABO_A, nom: 'Stockage', cents: 2999, devise: 'EUR', periode: 'an', next: day(20), actif: true },
  ] };
  b.depenses = [{ id: 'aaaaaaaa-0000-4000-8000-000000000001', montant_centimes: 1250, devise: 'EUR', jour: day(0), categorie: 'Courses', libelle: 'Pain', created_at: new Date().toISOString() }];
  const ids = [...QW, 'taches', 'habitudes'];
  b.rows.ecran = { ...b.rows.ecran, widgets: ids, where: Object.fromEntries(ids.map(id => [id, 'study'])), pages: [{ id: 'study', name: 'Study' }, { id: 'chill', name: 'Chill', wall: 'lac' }] };
}

(async () => {
  const srv = await start();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
  const errors = [];
  const until = async (fn, what, ms = 8000) => { const t = Date.now(); while (!(await fn())) { if (Date.now() - t > ms) throw new Error(`délai dépassé : ${what}`); await new Promise(r => setTimeout(r, 100)); } };
  async function open(bac, { plan = 'pro', width = 1440, height = 1000, extra = '', attendre = QW } = {}) {
    const context = await browser.newContext({ viewport: { width, height }, locale: 'fr-FR', timezoneId: 'Europe/Paris', hasTouch: width < 600 });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`${bac}: ${e.message}`));
    await page.goto(`${srv.url}/dashboard.html?profil=plein&bac=${bac}&labo=1&plan=${plan}${extra}`);
    for (const id of attendre) await page.waitForSelector(`#board [data-widget=${id}] .body > :not(.empty:only-child)`);
    if (attendre.includes('depenses')) await page.waitForSelector('#board [data-widget=depenses] .q-total:not([hidden])');
    return { page, context };
  }
  const W = (page, id) => page.locator(`#board [data-widget=${id}]`);
  // Une action peut finir après le clic (fenêtre de confirmation) : on laisse partir l'enregistrement avant d'attendre « Enregistré ».
  const saved = async page => { await page.waitForTimeout(700); await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré'); };
  const shot = async (loc, name) => { if (SHOTS) await loc.screenshot({ path: `${SHOTS}/${name}.png` }); };
  const fiche = page => page.locator('dialog.q-fiche[open]').last();
  // Une confirmation s'ouvre par-dessus une fiche (ou seule) : on attend qu'elle soit là avant de cliquer dedans.
  const confirmer = async (page, nom, avant = 0) => {
    await page.waitForFunction(n => document.querySelectorAll('dialog.q-fiche[open]').length > n, avant);
    const d = await fiche(page).elementHandle();
    await fiche(page).getByRole('button', { name: nom, exact: true }).click();
    // La confirmation se referme en glissant ; l'action part une fois cette fenêtre partie (une autre peut s'ouvrir aussitôt).
    await page.waitForFunction(n => !n.isConnected, d);
  };

  // 1. Aujourd'hui : cocher une tâche ici coche la tâche d'origine (même identifiant, pas de copie), et l'inverse.
  {
    const b = srv.bac('plein', 'auj'); seed(b);
    const { page, context } = await open('auj');
    const auj = W(page, 'aujourdhui');
    assert.match(await auj.locator('.q-sec-retard').innerText(), /Envoyer le dossier de stage[\s\S]*2 jours de retard/);
    assert.match(await auj.locator('.q-sec-taches').innerText(), /Relire le chapitre 4/);
    assert.match(await auj.locator('.q-sec-agenda').innerText(), /23 h 00 – 23 h 30[\s\S]*Dentiste/);
    assert.match(await auj.locator('.q-sec-echeances').innerText(), /Appeler la scolarité[\s\S]*Partiel de droit civil|Partiel de droit civil[\s\S]*Appeler la scolarité/);
    assert.doesNotMatch(await auj.innerText(), /Ranger le bureau/, 'une tâche sans échéance ne s’invente pas une date');
    await shot(auj, 'aujourdhui-compact');
    await auj.getByRole('checkbox', { name: 'Envoyer le dossier de stage' }).check();
    await saved(page);
    assert.equal(b.rows.taches.items.length, 4, 'aucune copie');
    assert.equal(b.rows.taches.items.find(t => t.id === 't2').done, true, 'la tâche d’origine est cochée');
    assert.equal(await W(page, 'taches').getByRole('checkbox', { name: 'Envoyer le dossier de stage' }).isChecked(), true, 'Tâches redessiné');
    assert.equal(await auj.getByRole('checkbox', { name: 'Envoyer le dossier de stage' }).isChecked(), true, 'reste visible, barrée, pour décocher');
    await W(page, 'taches').getByRole('checkbox', { name: 'Relire le chapitre 4' }).check();
    await until(() => auj.getByRole('checkbox', { name: 'Relire le chapitre 4' }).isChecked(), 'Aujourd’hui suit Tâches');
    // Habitude cochée ici = l'habitude d'origine.
    await auj.getByRole('checkbox', { name: 'Lire vingt minutes' }).check();
    await saved(page);
    assert.ok(b.rows.habitudes.items[0].days.includes(day(0)));
    assert.equal(await W(page, 'habitudes').locator('.days button.today').getAttribute('aria-pressed'), 'true');
    // Échéance d'une tâche, réglée dans Tâches, lue par Aujourd'hui.
    await W(page, 'taches').getByRole('button', { name: 'Mettre une échéance à « Ranger le bureau »' }).click();
    await fiche(page).getByRole('button', { name: 'Enregistrer' }).click();
    await until(async () => /Ranger le bureau/.test(await auj.innerText()), 'nouvelle échéance visible');
    // Demain (Pro) et Organiser (Pro).
    await auj.getByRole('button', { name: 'Demain' }).click();
    assert.equal(await auj.locator('.q-sec-retard').count(), 0, 'pas de retard supposé pour demain');
    await auj.getByRole('button', { name: "Aujourd'hui", exact: true }).click();
    await auj.getByRole('button', { name: 'Organiser' }).click();
    await fiche(page).getByRole('button', { name: 'Monter Rendez-vous' }).click();
    await fiche(page).getByRole('checkbox', { name: 'Habitudes' }).uncheck();
    await fiche(page).getByRole('button', { name: 'Enregistrer' }).click();
    await saved(page);
    assert.deepEqual(b.rows.aujourdhui.masquees, ['habitudes']);
    assert.equal(await auj.locator('.q-sec').first().getAttribute('class'), 'q-sec q-sec-retard');
    assert.equal(await auj.locator('.q-sec-habitudes').count(), 0);
    // Vue agrandie : les sections côte à côte.
    await auj.getByRole('button', { name: "Agrandir Aujourd'hui" }).click();
    await page.waitForSelector('#board [data-widget=aujourdhui].zoomed');
    await shot(auj, 'aujourdhui-agrandi');
    await page.getByRole('button', { name: 'Retour au tableau' }).click();
    // Ouvrir : va au widget.
    await auj.locator('.q-sec-agenda .q-item-btn').first().click();
    await page.waitForSelector('#board [data-widget=agenda].zoomed');
    assert.match(await fiche(page).locator('h2').textContent(), /Modifier le rendez-vous/);
    await page.keyboard.press('Escape');
    await page.waitForSelector('dialog.q-fiche', { state: 'detached' }); // la fiche se referme en glissant
    await page.keyboard.press('Escape');
    await page.waitForSelector('#board [data-widget=agenda]:not(.zoomed)');
    await context.close();
    console.log('1. Aujourd’hui : OK');
  }

  // 2. Agenda : création, nuit qui finit le lendemain, fuseau, répétition et portée des modifications.
  {
    const b = srv.bac('plein', 'agenda'); seed(b);
    const { page, context } = await open('agenda');
    const ag = W(page, 'agenda');
    await ag.getByRole('button', { name: 'Nouveau rendez-vous' }).click();
    const f = fiche(page);
    await f.getByLabel('Titre').fill('Soirée');
    await f.getByRole('button', { name: 'Choisir une date : Début' }).click();
    const calendrier = page.getByRole('dialog', { name: 'Début', exact: true });
    const lendemain = calendrier.locator(`[data-day="${day(1)}"]:not([data-outside]) button`);
    await calendrier.getByRole('grid').waitFor();
    if (!await lendemain.count()) await calendrier.getByRole('button', { name: 'Mois suivant' }).click();
    await lendemain.click();
    await calendrier.waitFor({ state: 'detached' });
    assert.equal(await f.getByLabel('Début', { exact: true }).inputValue(), day(1));
    await f.getByLabel('Heure').first().fill('22:00');
    await f.getByLabel('Heure').nth(1).fill('02:00');
    await f.getByLabel('Heure').nth(1).dispatchEvent('change');
    assert.match(await f.locator('.q-info').textContent(), /Finit le lendemain, à 02 h 00/);
    await f.getByRole('button', { name: 'Ajouter' }).click();
    await saved(page);
    const soiree = b.rows.agenda.events.find(e => e.t === 'Soirée');
    assert.deepEqual([soiree.d, soiree.f, soiree.h1, soiree.h2], [day(1), day(2), '22:00', '02:00'], 'heures murales, fin le lendemain');
    // Répétition (Pro) : toutes les semaines.
    await ag.getByRole('button', { name: 'Nouveau rendez-vous' }).click();
    await f.getByLabel('Titre').fill('Yoga');
    await f.getByLabel('Début', { exact: true }).fill(day(0));
    await f.getByLabel('Heure').first().fill('07:00');
    await f.getByLabel('Heure').first().dispatchEvent('change');
    await f.locator('select').last().selectOption('semaine');
    await f.getByRole('button', { name: 'Ajouter' }).click();
    await saved(page);
    const yoga = () => b.rows.agenda.events.filter(e => e.t.startsWith('Yoga'));
    assert.equal(yoga()[0].r.freq, 'semaine');
    // Vue agrandie : semaine, navigation.
    await ag.getByRole('button', { name: 'Agrandir Agenda' }).click();
    await page.waitForSelector('#board [data-widget=agenda].zoomed .q-semaine .q-col');
    assert.equal(await ag.locator('.q-semaine .q-col').count(), 7);
    await shot(ag, 'agenda-agrandi');
    await ag.getByRole('button', { name: 'Semaine suivante' }).click();
    assert.equal(await ag.locator('.q-semaine .q-item-btn', { hasText: 'Yoga' }).count(), 1, 'la répétition revient la semaine suivante');
    // « Ce rendez-vous seulement » : une exception + une copie.
    await ag.locator('.q-semaine .q-item-btn', { hasText: 'Yoga' }).click();
    await f.getByLabel('Titre').fill('Yoga (salle B)');
    await f.getByRole('radio', { name: 'Ce rendez-vous seulement' }).check();
    await f.getByRole('button', { name: 'Enregistrer' }).click();
    await saved(page);
    assert.deepEqual(yoga().find(e => e.r).ex, [day(7)]);
    const copie = yoga().find(e => e.t === 'Yoga (salle B)');
    assert.equal(copie.r, undefined, 'la copie ne se répète pas');
    assert.equal(copie.d, day(7));
    // « Celui-ci et les suivants » supprimés, deux semaines plus loin : la série s'arrête la veille.
    await ag.getByRole('button', { name: 'Semaine suivante' }).click();
    await ag.locator('.q-semaine .q-item-btn', { hasText: 'Yoga' }).click();
    await f.getByRole('radio', { name: 'Celui-ci et les suivants' }).check();
    await f.getByRole('button', { name: 'Supprimer' }).click();
    await confirmer(page, 'Supprimer', 1);
    await saved(page);
    const serie = yoga().find(e => e.r);
    assert.equal(serie.r.fin, day(13));
    assert.deepEqual([serie.h1, serie.h2], ['07:00', '08:00'], 'changer le début garde la durée');
    await page.keyboard.press('Escape');
    // Rechargement : tout est relu.
    await page.reload();
    await page.waitForSelector('#board [data-widget=agenda] .q-list');
    assert.match(await W(page, 'agenda').innerText(), /Soirée/);
    await context.close();
    // Gratuit : la répétition ouvre les plans ; les rendez-vous qui se répètent restent affichés (rien n'est perdu).
    const g = await open('agenda', { plan: 'gratuit' });
    assert.match(await W(g.page, 'agenda').innerText(), /Yoga/);
    await W(g.page, 'agenda').getByRole('button', { name: 'Nouveau rendez-vous' }).click();
    await fiche(g.page).locator('select').last().selectOption('jour');
    await g.page.waitForSelector('#paywall[open]');
    assert.match(await g.page.textContent('#pw-why'), /répètent/);
    await g.context.close();
    console.log('2. Agenda : OK');
  }

  // 3. Liste de courses : cocher, décocher, masquer, vider avec confirmation, listes enregistrées (Pro).
  {
    const b = srv.bac('plein', 'courses'); seed(b);
    const { page, context } = await open('courses');
    const co = W(page, 'courses');
    await co.getByLabel('Article à ajouter, avec sa quantité si tu veux').fill('2 kg farine');
    await co.locator('select.q-rayon').selectOption('Épicerie');
    await co.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await co.getByLabel('Article à ajouter, avec sa quantité si tu veux').fill('1 kg farine');
    await page.keyboard.press('Enter');
    await saved(page);
    const farines = b.rows.courses.items.filter(i => i.n === 'farine');
    assert.deepEqual(farines.map(i => [i.q, i.u, i.c]), [[2, 'kg', 'Épicerie'], [1, 'kg', 'Épicerie']], 'deux lignes, jamais fusionnées');
    await co.getByRole('checkbox', { name: /pommes/ }).check();
    await co.getByRole('checkbox', { name: /pommes/ }).uncheck();
    await co.getByRole('checkbox', { name: /pommes/ }).check();
    await saved(page);
    assert.equal(b.rows.courses.items.find(i => i.n === 'pommes').ok, true);
    await shot(co, 'courses-compact');
    await co.getByRole('button', { name: 'Masquer les achetés' }).click();
    assert.equal(await co.getByRole('checkbox', { name: /pommes/ }).count(), 0);
    await co.getByRole('button', { name: 'Afficher les achetés (1)' }).click();
    await co.getByRole('button', { name: 'Vider les achetés' }).click();
    await confirmer(page, 'Annuler');
    assert.equal(await co.getByRole('checkbox', { name: /pommes/ }).count(), 1, 'annuler ne retire rien');
    await co.getByRole('button', { name: 'Vider les achetés' }).click();
    await confirmer(page, 'Retirer');
    await saved(page);
    assert.equal(b.rows.courses.items.some(i => i.n === 'pommes'), false);
    // Garder la liste, puis repartir d'elle en remplaçant.
    await co.getByRole('button', { name: 'Agrandir Liste de courses' }).click();
    await page.waitForSelector('#board [data-widget=courses].zoomed .q-cote');
    await co.locator('.q-cote').getByLabel('Nom de la liste à garder').fill('La semaine');
    await co.locator('.q-cote').getByRole('button', { name: 'Garder ma liste' }).click();
    await saved(page);
    assert.equal(b.rows.courses.listes[0].items.length, 2);
    await shot(co, 'courses-agrandi');
    await co.locator('.q-cote').getByRole('button', { name: 'Utiliser la liste La semaine' }).click();
    await confirmer(page, 'Remplacer ma liste actuelle');
    await confirmer(page, 'Remplacer');
    await saved(page);
    assert.equal(b.rows.courses.items.length, 2);
    await co.locator('.q-cote').getByRole('button', { name: 'Utiliser la liste La semaine' }).click();
    await fiche(page).getByRole('button', { name: /^Ajouter les 2 articles/ }).click();
    await page.waitForSelector('dialog.q-fiche', { state: 'detached' }); // l'ajout part une fois la fiche sortie (animation)
    await saved(page);
    assert.equal(b.rows.courses.items.length, 4);
    await page.keyboard.press('Escape');
    await context.close();
    // Gratuit : la liste enregistrée reste, l'utiliser ouvre les plans.
    const g = await open('courses', { plan: 'gratuit' });
    await W(g.page, 'courses').getByRole('button', { name: /Mes listes/ }).click();
    assert.match(await fiche(g.page).innerText(), /restent enregistrées[\s\S]*La semaine/);
    await fiche(g.page).getByRole('button', { name: 'Utiliser la liste La semaine' }).click();
    await g.page.waitForSelector('#paywall[open]');
    assert.equal(srv.bac('plein', 'courses').rows.courses.listes.length, 1, 'rien n’est effacé en Gratuit');
    await g.context.close();
    console.log('3. Liste de courses : OK');
  }

  // 4. Mes dépenses : saisie, modification, suppression, totaux recalculés, panne d'enregistrement sans doublon.
  {
    const b = srv.bac('plein', 'dep'); seed(b);
    const { page, context } = await open('dep');
    const de = W(page, 'depenses');
    const total = () => de.locator('.q-total').textContent();
    assert.equal((await total()).replace(/\s/g, ' '), '12,50 €');
    await de.getByLabel('Montant en euros').fill('abc');
    await de.getByRole('button', { name: 'Ajouter' }).click();
    assert.match(await de.locator('.q-saisie .note').textContent(), /Montant/);
    await de.getByLabel('Montant en euros').fill('0,1');
    await de.getByLabel('Description').fill('Chewing-gum');
    await de.getByRole('button', { name: 'Ajouter' }).click();
    await until(async () => (await total()).replace(/\s/g, ' ') === '12,60 €', 'total 12,60');
    await de.getByLabel('Montant en euros').fill('0,2');
    await de.getByRole('button', { name: 'Ajouter' }).click();
    await until(async () => (await total()).replace(/\s/g, ' ') === '12,80 €', 'total 12,80 (pas 12,800000001)');
    // Panne : la saisie reste, rien n'est créé ; au nouvel essai, une seule dépense.
    b.panneDepenses = true;
    await de.getByLabel('Montant en euros').fill('7');
    await de.getByLabel('Description').fill('Cinéma');
    await de.getByRole('button', { name: 'Ajouter' }).click();
    await until(async () => /Pas enregistrée/.test(await de.locator('.q-saisie .note').textContent()), 'message de panne');
    assert.equal(await de.getByLabel('Montant en euros').inputValue(), '7', 'saisie gardée');
    b.panneDepenses = false;
    await de.getByRole('button', { name: 'Ajouter' }).click();
    await until(async () => (await total()).replace(/\s/g, ' ') === '19,80 €', 'total 19,80');
    assert.equal(b.depenses.filter(d => d.libelle === 'Cinéma').length, 1);
    // Modifier puis supprimer : les totaux suivent.
    await de.getByRole('button', { name: /^Cinéma, 7,00/ }).click();
    await fiche(page).getByLabel('Montant').fill('9,90');
    await fiche(page).getByRole('button', { name: 'Enregistrer' }).click();
    await until(async () => (await total()).replace(/\s/g, ' ') === '22,70 €', 'total après modification');
    await de.getByRole('button', { name: /^Cinéma, 9,90/ }).click();
    await fiche(page).getByRole('button', { name: 'Supprimer' }).click();
    await confirmer(page, 'Supprimer', 1);
    await until(async () => (await total()).replace(/\s/g, ' ') === '12,80 €', 'total après suppression');
    // Autre devise : à part, jamais additionnée.
    b.depenses.push({ id: 'aaaaaaaa-0000-4000-8000-000000000009', montant_centimes: 500, devise: 'USD', jour: day(0), categorie: 'Loisirs', libelle: 'Appli', created_at: new Date().toISOString() });
    await de.getByRole('button', { name: 'Mois précédent' }).click();
    await de.getByRole('button', { name: 'Mois suivant' }).click();
    await until(async () => /non convertis/.test(await de.locator('.q-total + .q-aide').textContent()), 'devise à part');
    assert.equal((await total()).replace(/\s/g, ' '), '12,80 €');
    await shot(de, 'depenses-compact');
    // Pro : budgets et répartition (vue agrandie).
    await de.getByRole('button', { name: 'Agrandir Mes dépenses' }).click();
    await de.locator('.q-analyse').getByRole('button', { name: 'Budgets' }).click();
    await fiche(page).getByLabel('Courses').fill('10');
    await fiche(page).getByRole('button', { name: 'Enregistrer' }).click();
    await saved(page);
    assert.deepEqual(b.rows.depenses.budgets, { Courses: 1000 });
    assert.match(await de.locator('.q-analyse').innerText(), /Budget dépassé de 2,80/);
    await shot(de, 'depenses-agrandi');
    await page.keyboard.press('Escape');
    await context.close();
    // Gratuit : les dépenses restent, la répartition est proposée en Pro.
    const g = await open('dep', { plan: 'gratuit' });
    assert.equal((await W(g.page, 'depenses').locator('.q-total').textContent()).replace(/\s/g, ' '), '12,80 €');
    assert.equal(await W(g.page, 'depenses').locator('.q-compare').isHidden(), true);
    await g.context.close();
    console.log('4. Mes dépenses : OK');
  }

  // 5. Mes abonnements : prévu ≠ payé, une seule dépense liée par échéance, même en recommençant.
  {
    const b = srv.bac('plein', 'abos'); seed(b);
    const { page, context } = await open('abos');
    const ab = W(page, 'abos');
    assert.match((await ab.locator('.q-estim').textContent()).replace(/\s/g, ' '), /14,49 €[\s\S]*estimation/, '11,99 + 29,99/12 = 14,49');
    assert.equal(b.depenses.length, 1, 'une échéance arrivée n’est jamais payée toute seule');
    await shot(ab, 'abos-compact');
    await ab.getByRole('button', { name: /Musique, échéance .* : payée/ }).click();
    const f = fiche(page);
    await f.getByRole('button', { name: 'Ajouter à mes dépenses' }).dblclick();
    await page.waitForSelector('dialog.q-fiche[open]', { state: 'detached' });
    await saved(page);
    const liees = () => b.depenses.filter(d => d.abonnement_id === ABO_M);
    assert.equal(liees().length, 1, 'double clic : une seule dépense');
    assert.equal(liees()[0].echeance, day(-1));
    assert.equal(liees()[0].categorie, 'Abonnements');
    const musique = b.rows.abos.items.find(a => a.id === ABO_M);
    assert.equal(musique.payes[day(-1)], 'paye');
    assert.ok(musique.next > day(0), 'échéance suivante');
    await until(async () => (await W(page, 'depenses').locator('.q-total').textContent()).replace(/\s/g, ' ') === '24,49 €', 'Mes dépenses suit');
    // Nouvel essai sur la même échéance (autre onglet, ancienne version) : la base refuse le doublon, on avance seulement.
    await page.evaluate(() => {}); // rien à faire côté page : on remet l'ancienne échéance dans les données
    b.rows.abos.items.find(a => a.id === ABO_M).next = day(-1);
    await page.reload();
    await page.waitForSelector('#board [data-widget=abos] .q-du');
    await W(page, 'abos').getByRole('button', { name: /Musique, échéance .* : payée/ }).click();
    await fiche(page).getByRole('button', { name: 'Ajouter à mes dépenses' }).click();
    await page.waitForSelector('dialog.q-fiche[open]', { state: 'detached' });
    assert.equal(liees().length, 1, 'toujours une seule dépense liée');
    // Vue agrandie : payé, prévu, estimation, séparés ; prévision (Pro).
    await W(page, 'abos').getByRole('button', { name: 'Agrandir Mes abonnements' }).click();
    const big = W(page, 'abos').locator('.q-abos-big');
    await until(async () => /Payé ce mois-ci\s*11,99/.test((await big.innerText()).replace(/\s+/g, ' ')), 'payé ce mois');
    const txt = (await big.innerText()).replace(/\s+/g, ' ');
    assert.match(txt, /Équivalent mensuel ≈ 14,49 € Estimation pour comparer, pas des paiements/);
    assert.match(txt, /Paiements prévus du .* : 65,96 €, en 4 paiements/);
    assert.match(txt, /Encore prévu ce mois-ci 0,00 €/);
    await big.locator('.q-prevision select').selectOption('12');
    assert.match((await big.innerText()).replace(/\s+/g, ' '), /Paiements prévus .* : 173,87 €, en 13 paiements/, '12 × 11,99 + 29,99');
    await shot(W(page, 'abos'), 'abos-agrandi');
    await page.keyboard.press('Escape');
    // Le lien de gestion ouvre le service, sans rien promettre.
    await W(page, 'abos').getByRole('button', { name: /^Stockage, prochain renouvellement/ }).first().click();
    await fiche(page).getByLabel('Lien pour le gérer').fill('https://exemple.fr/compte');
    assert.match(await fiche(page).innerText(), /Renzvi ne résilie rien/);
    await fiche(page).getByRole('button', { name: 'Enregistrer' }).click();
    await saved(page);
    assert.equal(b.rows.abos.items.find(a => a.id === ABO_A).lien, 'https://exemple.fr/compte');
    await context.close();
    // Gratuit : la prévision est proposée en Pro ; les abonnements restent.
    const g = await open('abos', { plan: 'gratuit' });
    await W(g.page, 'abos').getByRole('button', { name: 'Agrandir Mes abonnements' }).click();
    assert.match(await W(g.page, 'abos').locator('.q-prevision').innerText(), /Avec Pro/);
    assert.equal(await W(g.page, 'abos').locator('.q-abos-big .q-item').count(), 2);
    await g.context.close();
    console.log('5. Mes abonnements : OK');
  }

  // 6. Enregistrement en panne (widget_state) : message honnête, rien de perdu, enregistré au retour.
  {
    const b = srv.bac('plein', 'panne'); seed(b);
    const { page, context } = await open('panne');
    b.panne = true;
    await W(page, 'courses').getByLabel('Article à ajouter, avec sa quantité si tu veux').fill('café');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => /Pas encore enregistré/.test(document.getElementById('saved').textContent));
    assert.equal(b.rows.courses.items.some(i => i.n === 'café'), false);
    assert.equal(await W(page, 'courses').getByRole('checkbox', { name: /café/ }).count(), 1, 'la saisie reste à l’écran');
    b.panne = false;
    await page.waitForFunction(() => document.getElementById('saved').textContent === 'Enregistré', null, { timeout: 12000 });
    assert.equal(b.rows.courses.items.some(i => i.n === 'café'), true);
    await context.close();
    console.log('6. Panne d’enregistrement : OK');
  }

  // 7. Comptes séparés (serveur de démo : un jeu de données par compte ; la vraie séparation est testée par tests/rls.check.sql).
  {
    const a = srv.bac('plein', 'isoa'); seed(a);
    const b = srv.bac('plein', 'isob'); seed(b);
    b.depenses = []; b.rows.courses = { items: [] };
    const { page, context } = await open('isob');
    assert.equal((await W(page, 'depenses').locator('.q-total').textContent()).replace(/\s/g, ' '), '0,00 €');
    assert.match(await W(page, 'courses').innerText(), /Ta liste est vide/);
    await context.close();
    console.log('7. Comptes séparés : OK');
  }

  // 8. États : vide, chargement, erreur de chargement.
  {
    const b = srv.bac('plein', 'etats'); seed(b);
    for (const id of ['agenda', 'courses', 'abos']) delete b.rows[id];
    b.rows.taches = { items: [] }; b.rows.habitudes = { items: [] }; b.rows.compte = { items: [] }; b.depenses = [];
    const { page, context } = await open('etats');
    assert.match(await W(page, 'aujourdhui').innerText(), /Rien de prévu aujourd'hui/);
    assert.match(await W(page, 'agenda').innerText(), /Aucun rendez-vous/);
    assert.match(await W(page, 'abos').innerText(), /Aucun abonnement suivi/);
    assert.match(await W(page, 'depenses').innerText(), /Aucune dépense ce mois-ci/);
    if (SHOTS) for (const id of QW) await shot(W(page, id), `${id}-vide`);
    b.panneDepenses = true;
    await W(page, 'depenses').getByRole('button', { name: 'Mois précédent' }).click();
    await until(async () => /n’ont pas pu se charger/.test(await W(page, 'depenses').innerText()), 'erreur de chargement');
    b.panneDepenses = false;
    await W(page, 'depenses').getByRole('button', { name: 'Réessayer' }).click();
    await until(async () => /Aucune dépense en/.test(await W(page, 'depenses').innerText()), 'réessai');
    await context.close();
    console.log('8. États vides et erreurs : OK');
  }

  // 9. Téléphone et clavier : pas de défilement horizontal, fiche en bas d'écran, tout au clavier.
  {
    const b = srv.bac('plein', 'tel'); seed(b);
    const { page, context } = await open('tel', { width: 390, height: 844 });
    const large = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(large <= 390, `pas de défilement horizontal (${large})`);
    for (const id of QW) {
      const box = await W(page, id).boundingBox();
      assert.ok(box.width <= 390 && box.x >= 0, `${id} tient dans l'écran`);
    }
    if (SHOTS) for (const id of QW) await shot(W(page, id), `${id}-telephone`);
    await W(page, 'agenda').getByRole('button', { name: 'Nouveau rendez-vous' }).focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('dialog.q-fiche[open]');
    assert.equal(await page.evaluate(() => document.activeElement.closest('.q-champ')?.querySelector('.q-label')?.textContent), 'Titre', 'focus sur le premier champ');
    const r = await fiche(page).boundingBox();
    assert.ok(r.y + r.height >= 843, 'fiche posée en bas de l’écran');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/agenda-fiche-telephone.png` });
    const dateFin = fiche(page).getByRole('button', { name: 'Choisir une date : Fin' });
    await dateFin.focus();
    await page.keyboard.press('Enter');
    const calendrier = page.getByRole('dialog', { name: 'Fin', exact: true });
    await calendrier.getByRole('grid').waitFor();
    const calBox = await calendrier.boundingBox();
    assert.ok(calBox.x >= 0 && calBox.x + calBox.width <= 390, 'calendrier visible sans débordement');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/calendrier-telephone.png` });
    await page.keyboard.press('Escape');
    await calendrier.waitFor({ state: 'detached' });
    assert.equal(await dateFin.evaluate(button => button === document.activeElement), true, 'le bouton calendrier récupère le focus');
    await fiche(page).getByLabel('Titre').focus();
    await page.keyboard.type('Pharmacie');
    await page.keyboard.press('Enter');
    await page.waitForSelector('dialog.q-fiche[open]', { state: 'detached' });
    await saved(page);
    assert.ok(b.rows.agenda.events.some(e => e.t === 'Pharmacie'), 'créé au clavier');
    await W(page, 'courses').getByLabel('Article à ajouter, avec sa quantité si tu veux').focus();
    await page.keyboard.type('6 œufs');
    await page.keyboard.press('Enter');
    await saved(page);
    assert.deepEqual((({ n, q }) => ({ n, q }))(b.rows.courses.items.at(-1)), { n: 'œufs', q: 6 });
    await context.close();
    console.log('9. Téléphone et clavier : OK');
  }

  // 10. Pages et vue agrandie : l'état reste en changeant de page, en agrandissant et en revenant ; pas de doublon.
  {
    const b = srv.bac('plein', 'pages'); seed(b);
    const { page, context } = await open('pages', { extra: '&pages=1' });
    const co = W(page, 'courses');
    await co.getByLabel('Article à ajouter, avec sa quantité si tu veux').fill('beurre');
    await co.getByRole('button', { name: 'Agrandir Liste de courses' }).click();
    assert.equal(await co.getByLabel('Article à ajouter, avec sa quantité si tu veux').inputValue(), 'beurre', 'brouillon gardé en agrandissant');
    await page.getByRole('button', { name: 'Retour au tableau' }).click();
    assert.equal(await page.locator('#board [data-widget=courses]').count(), 1, 'un seul widget');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/tableau-pages.png` });
    await context.close();
    console.log('10. Pages et vue agrandie : OK');
  }

  // 11. Aperçu du catalogue : les cinq outils dans « Quotidien », avec des exemples, sans rien enregistrer.
  {
    const b = srv.bac('plein', 'cat'); seed(b);
    b.rows.ecran.widgets = ['taches'];
    const { page, context } = await open('cat', { attendre: ['taches'] });
    const saves = b.saves;
    await page.locator('#open-add').evaluate(n => n.click());
    await page.waitForSelector('#add-dialog[open]');
    for (const id of QW) {
      await page.click(`#catalog [data-widget=${id}]`);
      await page.waitForSelector('#cat-view .widget .body > :not(:only-child), #cat-view .widget .q-total');
    }
    const cat = await page.locator('#catalog').innerText();
    assert.match(cat, /Quotidien[\s\S]*Aujourd'hui[\s\S]*Agenda/);
    assert.equal(b.saves, saves, 'l’aperçu n’enregistre rien');
    await context.close();
    console.log('11. Catalogue : OK');
  }

  // 12. Recette → liste de courses : les ingrédients manquants, une ligne chacun, rien en double au deuxième clic.
  {
    const b = srv.bac('plein', 'recette'); seed(b);
    b.rows.repas = { fav: ['acras-de-morue'] };
    b.rows.ecran.widgets = [...b.rows.ecran.widgets, 'repas'];
    b.rows.ecran.where.repas = 'study';
    b.rows.courses = { items: [] };
    const { page, context } = await open('recette');
    const r = W(page, 'repas');
    // Le widget est en bas de l'écran, sous la barre fixe : clic direct sur le bouton.
    await r.getByRole('button', { name: /Gardées \(1\)/ }).evaluate(n => n.click());
    await r.locator('.repas-ouvrir').first().evaluate(n => n.click());
    const dlg = page.locator('dialog.chill-big[open]');
    await dlg.getByRole('button', { name: 'Ajouter les ingrédients à ma liste de courses' }).click();
    await until(async () => /ajoutés? à ta liste/.test(await dlg.innerText()), 'ingrédients ajoutés');
    await saved(page);
    const n = b.rows.courses.items.length;
    assert.ok(n >= 6, `ingrédients ajoutés (${n})`);
    assert.ok(b.rows.courses.items.some(i => i.n === 'morue salée' && i.q === 200 && i.u === 'g'), 'quantité lue, texte de la recette gardé');
    await dlg.getByRole('button', { name: 'Ajouter les ingrédients à ma liste de courses' }).click();
    await until(async () => /déjà sur ta liste/.test(await dlg.innerText()), 'pas de doublon');
    assert.equal(b.rows.courses.items.length, n);
    assert.equal(await W(page, 'courses').locator('.q-check-row').count(), n, 'la liste affichée suit');
    await context.close();
    console.log('12. Recette vers la liste de courses : OK');
  }

  await browser.close();
  await srv.close();
  assert.deepEqual(errors, [], 'aucune erreur de page');
  console.log('quotidien.check : tout passe');
})().catch(e => { console.error(e); process.exit(1); });
