// Tests de la logique pure du widget « Qu'est-ce qu'on mange ? » (sans navigateur) et du catalogue importé.
// Lancement : node tests/repas.test.cjs
const assert = require('node:assert');
const path = require('node:path');
const R = require(path.join(__dirname, '..', 'site', 'nutrition', 'repas.js'));
const cat = require(path.join(__dirname, '..', 'site', 'nutrition', 'recettes.json'));

let count = 0;
const test = (name, fn) => { fn(); count++; console.log(`ok - ${name}`); };
const rec = (id, keys, extra = {}) => ({ id, t: id, rev: 1, ing: keys.map(k => typeof k === 'string' ? { x: k, k: [k] } : k), et: ['Cuire'], ...extra });

test('clé : mêmes règles que l’import, sans accents', () => {
  assert.equal(R.repasCle('Tomates'), 'tomate');
  assert.equal(R.repasCle('des Œufs'), 'oeuf');
  assert.equal(R.repasCle('oeufs'), 'oeuf');
  assert.equal(R.repasCle('lait'), 'lait');
  assert.equal(R.repasCle('Pommes de terre'), 'pomme de terre');
  assert.equal(R.repasCle('Échalotes'), 'echalote');
  assert.equal(R.repasCle('riz'), 'riz');
});

test('filtres : type, régime (végétalien compte comme végétarien), cuisine', () => {
  const rs = [rec('a', ['riz'], { ty: 'plat', veg: 2, o: ['japonaise'] }), rec('b', ['porc'], { ty: 'plat' }), rec('c', ['sucre'], { ty: 'dessert', veg: 1 })];
  assert.deepEqual(R.repasFiltrer(rs, { ty: 'plat', veg: 0, o: '' }).map(r => r.id), ['a', 'b']);
  assert.deepEqual(R.repasFiltrer(rs, { ty: '', veg: 1, o: '' }).map(r => r.id), ['a', 'c']);
  assert.deepEqual(R.repasFiltrer(rs, { ty: '', veg: 2, o: '' }).map(r => r.id), ['a']);
  assert.deepEqual(R.repasFiltrer(rs, { ty: '', veg: 0, o: 'japonaise' }).map(r => r.id), ['a']);
});

test('tirage : évite les derniers tirés, retombe sur eux si rien d’autre, null si vide', () => {
  const pool = ['a', 'b', 'c'].map(id => rec(id, ['x']));
  for (let i = 0; i < 50; i++) assert.equal(R.repasTirer(pool, ['a', 'b'], Math.random).id, 'c');
  assert.ok(['a', 'b', 'c'].includes(R.repasTirer(pool, ['a', 'b', 'c']).id));
  assert.equal(R.repasTirer([], []), null);
  assert.equal(R.repasTirer(pool, [], () => 0.99).id, 'c');
});

test('frigo : tout / manque un / manque deux, et rien sans ingrédient commun', () => {
  const rs = [rec('omelette', ['œuf', 'beurre']), rec('quiche', ['œuf', 'farine', 'lardon']), rec('gratin', ['œuf', 'lait', 'fromage', 'pomme de terre']), rec('salade', ['laitue', 'tomate'])];
  const res = R.repasFrigo(rs, ['Oeufs', 'beurre'], false);
  assert.deepEqual(res.map(x => [x.r.id, x.manque.length]), [['omelette', 0], ['quiche', 2]]);
  assert.ok(!res.some(x => x.r.id === 'salade'), 'aucun ingrédient en commun : pas proposé');
  assert.ok(!res.some(x => x.r.id === 'gratin'), 'trois manquants : pas proposé');
});

test('frigo : sel, poivre, huile et eau ne sont supposés que si la case est cochée', () => {
  const rs = [rec('pates', ['pâte', 'sel', "huile d'olive"])];
  assert.equal(R.repasFrigo(rs, ['pâtes'], false)[0].manque.length, 2);
  assert.equal(R.repasFrigo(rs, ['pâtes'], true)[0].manque.length, 0);
});

test('frigo : un ingrédient facultatif ne manque jamais, une ligne sans clé ne compte pas', () => {
  const rs = [rec('soupe', ['carotte', { x: 'persil (facultatif)', k: ['persil'], f: 1 }, { x: '1 pincée de quelque chose', k: [] }])];
  assert.equal(R.repasFrigo(rs, ['carottes'], false)[0].manque.length, 0);
});

test('frigo : « pomme » ne vaut pas « pomme de terre »', () => {
  const rs = [rec('puree', ['pomme de terre', 'beurre'])];
  assert.deepEqual(R.repasFrigo(rs, ['pomme'], false), []);
});

test('état : nettoyé et plafonné (données abîmées ou trop longues)', () => {
  const s = R.repasClean({ tab: 'pirate', f: { ty: 'x', veg: 7, o: 3 }, frigo: Array.from({ length: 300 }, (_, i) => `i${i}`), fav: ['a', 'a', 4, 'b'], base: 'oui' });
  assert.equal(s.tab, 'roulette');
  assert.deepEqual(s.f, { ty: '', veg: 0, o: '' });
  assert.equal(s.frigo.length, R.REPAS.MAX_FRIGO);
  assert.deepEqual(s.fav, ['a', 'b']);
  assert.equal(s.base, false);
  assert.deepEqual(R.repasClean(null).frigo, []);
});

test('catalogue : source et licence, identifiants uniques, pas de boissons, fiches complètes', () => {
  assert.equal(cat.licence, 'CC BY-SA 4.0');
  const rs = cat.recettes;
  assert.ok(rs.length >= 800, `${rs.length} recettes`);
  assert.equal(new Set(rs.map(r => r.id)).size, rs.length);
  for (const r of rs) {
    assert.ok(r.t && Number.isInteger(r.rev), r.id);
    assert.ok(r.ing.filter(i => i.x).length >= 2 && r.et.some(e => typeof e === 'string'), r.id);
    assert.ok(!/^(cocktail|mojito|sangria|margarita|punch)\b/i.test(r.t), `boisson : ${r.t}`); // « Sauce cocktail » reste
  }
  const state = R.repasClean({ fav: rs.slice(0, 100).map(r => r.id), recent: rs.slice(0, 20).map(r => r.id), frigo: Array(150).fill('pomme de terre nouvelle') });
  assert.ok(JSON.stringify(state).length < 65536 / 4, 'l’état tient largement dans widget_state (64 Ko)');
});

console.log(`${count} tests ok`);
