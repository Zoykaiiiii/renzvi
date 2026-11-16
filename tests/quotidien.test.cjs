// Logique du Quotidien (site/quotidien/core.js) : dates, changements d'heure, récurrences, montants, prévisions, articles.
// Lancement : node tests/quotidien.test.cjs  (aucune dépendance, aucun navigateur). On le lance aussi avec TZ=Europe/Paris
// et TZ=America/New_York : les résultats ne doivent pas dépendre du fuseau.
const assert = require('node:assert/strict');
const { Q } = require('../site/quotidien/core.js');
let n = 0;
const t = (nom, fn) => { fn(); n++; };

t('jours : passage à l’heure d’hiver et d’été sans jour sauté', () => {
  assert.equal(Q.plus('2026-10-24', 1), '2026-10-25');
  assert.equal(Q.plus('2026-10-25', 1), '2026-10-26');
  assert.equal(Q.plus('2026-03-28', 2), '2026-03-30');
  assert.equal(Q.ecart('2026-03-28', '2026-03-30'), 2);
  assert.equal(Q.lundi('2026-11-16'), '2026-11-16');
  assert.equal(Q.lundi('2026-11-22'), '2026-11-16');
  assert.equal(Q.plus('2026-12-31', 1), '2027-01-01');
  assert.equal(Q.plus('2028-02-28', 1), '2028-02-29');
});
t('dates invalides refusées', () => {
  for (const k of ['2026-02-30', '2026-13-01', 'demain', '', null, '1999-12-31']) assert.equal(Q.valide(k), false, String(k));
  assert.equal(Q.valide('2028-02-29'), true);
  assert.equal(Q.heureValide('24:00'), false);
  assert.equal(Q.heureValide('23:59'), true);
});
t('mois : le 31 saute les mois courts (agenda), borne au dernier jour (abonnements)', () => {
  assert.equal(Q.plusMois('2026-01-31', 1, 31, 'saute'), null);
  assert.equal(Q.plusMois('2026-01-31', 1, 31, 'borne'), '2026-02-28');
  assert.equal(Q.plusMois('2026-01-31', 2, 31, 'borne'), '2026-03-31');
  assert.equal(Q.plusMois('2026-11-15', 2), '2027-01-15');
});
t('montants en centimes, sans virgule flottante', () => {
  assert.equal(Q.centimes('12,5'), 1250);
  assert.equal(Q.centimes('12.50 €'), 1250);
  assert.equal(Q.centimes('1 234,56'), 123456);
  assert.equal(Q.centimes('0,10'), 10);
  assert.equal(Q.centimes('0,1') + Q.centimes('0,2'), 30); // 0.1 + 0.2 = 0.30000000000000004 en flottant
  for (const s of ['0', '-5', '12,345', 'abc', '', '1000000,01', '1e3']) assert.equal(Q.centimes(s), null, s);
  assert.deepEqual(Q.totaux([{ cents: 1050, devise: 'EUR' }, { cents: 200, devise: 'USD' }, { cents: 950, devise: 'EUR' }]), { EUR: 2000, USD: 200 });
  assert.match(Q.totauxTexte({ EUR: 2000, USD: 200 }), /^20,00\s€ et 2,00\s\$US$/);
});
const ev = (o) => Q.nettoyerEvenement({ id: 'e', t: 'Rdv', ...o });
t('rendez-vous : soirée qui finit le lendemain', () => {
  const e = ev({ d: '2026-11-20', h1: '22:00', h2: '02:00' });
  assert.equal(e.f, '2026-11-21');
  const occ = Q.occurrences([e], '2026-11-21', '2026-11-21');
  assert.equal(occ.length, 1, 'visible le lendemain');
  assert.equal(Q.horaire(occ[0], '2026-11-21'), "Jusqu'à 02 h 00");
  assert.equal(Q.horaire(occ[0], '2026-11-20'), 'Dès 22 h 00');
});
t('rendez-vous : journée entière sur plusieurs jours, au passage du mois', () => {
  const e = ev({ d: '2026-11-29', f: '2026-12-02', all: true });
  assert.equal(Q.occurrences([e], '2026-12-01', '2026-12-07').length, 1);
  assert.equal(Q.occurrences([e], '2026-12-03', '2026-12-07').length, 0);
});
t('récurrence hebdomadaire : exceptions, fin, changement d’heure', () => {
  const e = ev({ d: '2026-10-19', h1: '18:00', h2: '19:00', r: { freq: 'semaine' }, ex: ['2026-11-02'] });
  const d = Q.debuts(e, '2026-10-19', '2026-11-16');
  assert.deepEqual(d, ['2026-10-19', '2026-10-26', '2026-11-09', '2026-11-16']); // 26 oct. = lendemain du passage à l'heure d'hiver
  const fin = { ...e, r: { freq: 'semaine', fin: '2026-11-09' } };
  assert.deepEqual(Q.debuts(fin, '2026-11-01', '2026-12-31'), ['2026-11-09']);
});
t('récurrence mensuelle le 31 et annuelle le 29 février', () => {
  const m = ev({ d: '2026-01-31', all: true, r: { freq: 'mois' } });
  assert.deepEqual(Q.debuts(m, '2026-01-01', '2026-06-30'), ['2026-01-31', '2026-03-31', '2026-05-31']);
  const a = ev({ d: '2028-02-29', all: true, r: { freq: 'an' } });
  assert.deepEqual(Q.debuts(a, '2028-01-01', '2033-12-31'), ['2028-02-29', '2032-02-29']);
});
t('récurrence quotidienne lointaine : pas de boucle sur des années', () => {
  const e = ev({ d: '2020-01-01', all: true, r: { freq: 'jour' } });
  assert.deepEqual(Q.debuts(e, '2026-11-16', '2026-11-18'), ['2026-11-16', '2026-11-17', '2026-11-18']);
});
t('couper une série : « ce rendez-vous et les suivants »', () => {
  const e = ev({ d: '2026-11-02', h1: '10:00', h2: '11:00', r: { freq: 'semaine' }, ex: ['2026-11-09', '2026-11-30'] });
  const { avant, apres } = Q.couperSerie(e, '2026-11-23', 'e2');
  assert.equal(avant.r.fin, '2026-11-22');
  assert.deepEqual(avant.ex, ['2026-11-09']);
  assert.equal(apres.d, '2026-11-23');
  assert.deepEqual(apres.ex, ['2026-11-30']);
  const tout = Q.occurrences([avant, apres], '2026-11-01', '2026-12-07').map(o => o.debut);
  assert.deepEqual(tout, ['2026-11-02', '2026-11-16', '2026-11-23', '2026-12-07']);
  assert.equal(Q.couperSerie(e, '2026-11-02', 'e3').avant, null, 'couper au premier = remplacer');
});
t('abonnements : échéances, équivalent mensuel, prévision', () => {
  const an = { id: 'a', nom: 'Stockage', cents: 2999, devise: 'EUR', periode: 'an', next: '2027-03-01', actif: true };
  const mois = { id: 'b', nom: 'Musique', cents: 1199, devise: 'EUR', periode: 'mois', next: '2026-11-30', actif: true, ancre: 31 };
  const usd = { id: 'c', nom: 'Outil', cents: 1000, devise: 'USD', periode: 'semaine', next: '2026-11-20', actif: true };
  const off = { ...mois, id: 'd', actif: false };
  assert.equal(Q.equivalentMensuel(an), 250); // 29,99 / 12 = 2,4991… : une estimation, pas un paiement
  assert.equal(Q.equivalentMensuel(usd), 4333);
  assert.deepEqual(Q.echeances(mois, '2026-11-01', '2027-03-31'), ['2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28', '2027-03-31']);
  const p = Q.prevision([an, mois, usd, off], '2026-11-16', '2026-12-15');
  assert.deepEqual(Q.totaux(p), { EUR: 1199, USD: 4000 }, 'l’annuel n’est pas dans ce mois, l’inactif jamais');
});
t('articles : quantité et unité lues, sinon le texte tel quel', () => {
  assert.deepEqual(Q.article('2 kg pommes'), { n: 'pommes', q: 2, u: 'kg' });
  assert.deepEqual(Q.article('6 œufs'), { n: 'œufs', q: 6, u: '' });
  assert.deepEqual(Q.article('1,5 L de lait'), { n: 'lait', q: 1.5, u: 'L' });
  assert.deepEqual(Q.article('3 paquets de pâtes'), { n: 'pâtes', q: 3, u: 'paquet' });
  assert.deepEqual(Q.article('lait'), { n: 'lait' });
  assert.deepEqual(Q.article('7up'), { n: '7up' });
  assert.equal(Q.quantite({ q: 3, u: 'paquet' }), '3 paquets');
  assert.equal(Q.quantite({ q: 1.5, u: 'L' }), '1,5 L');
});
console.log(`quotidien.test : ${n} groupes OK`);
