// Tests de la logique pure du chantier Chill (sans navigateur) : jardin, taquin, tangram, arrêt progressif, coloriage.
// Lancement : node tests/chill.test.cjs
const assert = require('node:assert');
const path = require('node:path');
const site = f => path.join(__dirname, '..', 'site', 'chill', f);
const J = require(site('jardin.js'));
const G = require(site('jeux.js'));
const { chillSleepGain } = require(site('chill.js'));
const A = require(site('atelier.js'));

let count = 0;
const test = (name, fn) => { fn(); count++; console.log(`ok - ${name}`); };
const H = J.JARDIN.HOUR, T0 = Date.UTC(2026, 10, 9, 12);

// --- Jardin ---
test('jardin : une plante pousse avec le temps et plafonne', () => {
  const p = { s: 'tulipe', t: T0, w: 0, lw: null };
  assert.equal(J.jardinStage(p, T0), 0);
  assert.equal(J.jardinStage(p, T0 + 6 * H), 1);
  assert.equal(J.jardinStage(p, T0 + 24 * H), 2);
  assert.equal(J.jardinStage(p, T0 + 48 * H), 3);
  assert.equal(J.jardinStage(p, T0 + 72 * H), 4);
  assert.equal(J.jardinGrowth(p, T0 + 1000 * H), J.JARDIN.MAX, 'croissance plafonnée');
});
test('jardin : une longue absence ne fait ni mourir ni régresser', () => {
  const p = { s: 'lavande', t: T0, w: 0, lw: null };
  const stages = [0, 10, 100, 1000, 10000].map(d => J.jardinStage(p, T0 + d * 24 * H));
  assert.deepEqual(stages, [0, 4, 4, 4, 4]);
  const clean = J.jardinClean({ plots: [p], blooms: 2 }, T0 + 365 * 24 * H);
  assert.deepEqual(clean.plots[0], p, 'la plante est toujours là après un an');
});
test("jardin : l'arrosage est limité à une fois toutes les 6 h", () => {
  let p = { s: 'tournesol', t: T0, w: 0, lw: null };
  p = J.jardinWater(p, T0);
  assert.equal(p.w, 1);
  for (let i = 0; i < 1000; i++) assert.equal(J.jardinWater(p, T0 + i), null, 'cliquer mille fois ne sert à rien');
  assert.ok(J.jardinWaitWater(p, T0 + H) > 0);
  assert.equal(J.jardinWaitWater(p, T0 + 6 * H), 0);
  assert.equal(J.jardinWater(p, T0 + 6 * H).w, 2);
  assert.equal(J.jardinGrowth({ ...p, w: 1 }, T0), 6, 'un arrosage = 6 h de croissance');
});
test("jardin : une plante en fleur ne s'arrose plus", () => {
  const p = { s: 'tulipe', t: T0, w: 0, lw: null };
  assert.equal(J.jardinWaitWater(p, T0 + 80 * H), Infinity);
  assert.equal(J.jardinWater(p, T0 + 80 * H), null);
});
test('jardin : données abîmées ou futures nettoyées', () => {
  const now = T0;
  const c = J.jardinClean({ plots: [{ s: 'cactus', t: now }, { s: 'tulipe', t: now + 10 * H, w: -3, lw: now + 99 * H }, 'x', null, { s: 'lavande', t: 'hier' }], decor: ['banc', 'trone', null, 'pot'], blooms: -4 }, now);
  assert.equal(c.plots.length, 6);
  assert.equal(c.plots[0], null, 'espèce inconnue retirée');
  assert.deepEqual(c.plots[1], { s: 'tulipe', t: now, w: 0, lw: now }, 'dates futures ramenées à maintenant');
  assert.equal(c.plots[4], null);
  assert.deepEqual(c.decor, ['banc', null, null], 'décor inconnu retiré, 3 places');
  assert.equal(c.blooms, 0);
  assert.deepEqual(J.jardinClean(null, now).plots, [null, null, null, null, null, null]);
});
test('jardin : décorations débloquées doucement', () => {
  assert.deepEqual(J.jardinUnlocked(0).map(d => d.id), ['pot', 'galets']);
  assert.deepEqual(J.jardinUnlocked(3).map(d => d.id), ['pot', 'galets', 'lanterne', 'arrosoir', 'banc']);
  assert.equal(J.jardinUnlocked(99).length, J.JARDIN.DECOR.length);
});

// --- Taquin ---
test('taquin : 2 000 mélanges, tous résolubles et jamais déjà résolus', () => {
  for (const n of [3, 4]) for (let k = 0; k < 1000; k++) {
    const t = G.taquinShuffle(n);
    assert.ok(G.taquinSolvable(t, n), `mélange insoluble ${t}`);
    assert.ok(!G.taquinIsSolved(t));
  }
});
test('taquin : la règle de résolubilité reconnaît les positions impossibles', () => {
  assert.ok(G.taquinSolvable(G.taquinSolved(3), 3));
  assert.ok(G.taquinSolvable(G.taquinSolved(4), 4));
  assert.ok(!G.taquinSolvable([2, 1, 3, 4, 5, 6, 7, 8, 0], 3), 'deux pièces échangées : impossible');
  assert.ok(!G.taquinSolvable([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 0], 4), 'le célèbre 14-15 : impossible');
  assert.ok(!G.taquinSolvable([1, 1, 2, 3, 4, 5, 6, 7, 0], 3), 'doublon refusé');
  assert.ok(!G.taquinSolvable('abc', 3));
});
test('taquin : déplacements à la souris et au clavier', () => {
  const s = G.taquinSolved(3);
  assert.equal(G.taquinMove(s, 3, 0), null, 'une pièce non voisine ne bouge pas');
  assert.deepEqual(G.taquinMove(s, 3, 7), [1, 2, 3, 4, 5, 6, 7, 0, 8]);
  assert.deepEqual(G.taquinMoveDir(s, 3, 'ArrowRight'), [1, 2, 3, 4, 5, 6, 7, 0, 8], '→ fait glisser la pièce de gauche');
  assert.equal(G.taquinMoveDir(s, 3, 'ArrowLeft'), null, 'rien à droite de la case vide');
  // Résoudre réellement un mélange court en rejouant les coups à l'envers.
  let t = s; const path = [];
  for (const d of ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowRight', 'ArrowUp']) { const n = G.taquinMoveDir(t, 3, d); if (n) { t = n; path.push(d); } }
  const back = { ArrowDown: 'ArrowUp', ArrowUp: 'ArrowDown', ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft' };
  for (const d of path.reverse()) t = G.taquinMoveDir(t, 3, back[d]);
  assert.ok(G.taquinIsSolved(t));
});

// --- Tangram ---
test('tangram : les 7 pièces font bien un carré de 16', () => {
  const area = pts => Math.abs(pts.reduce((s, [x, y], i) => { const [a, b] = pts[(i + 1) % pts.length]; return s + x * b - a * y; }, 0)) / 2;
  assert.equal(G.TANGRAM_PIECES.reduce((s, p) => s + area(p.pts), 0), 16);
  assert.deepEqual(G.TANGRAM_PIECES.map(p => area(p.pts)), [4, 4, 2, 1, 2, 1, 2]);
});
for (const m of G.TANGRAM_MODELS) {
  test(`tangram « ${m.name} » : la solution de référence est validée, sans chevauchement`, () => {
    const r = G.tangramCheck(m, m.ref);
    assert.ok(r.ok, JSON.stringify(r));
    assert.ok(r.covered > .995 && r.extra < .005 && r.overlap < .005, JSON.stringify(r));
  });
  test(`tangram « ${m.name} » : position de départ refusée, pièce manquante ou décalée refusée`, () => {
    assert.ok(!G.tangramCheck(m, G.tangramStart()).ok);
    const missing = m.ref.map((s, i) => i === 3 ? { x: 16, y: 8, r: 0, f: false } : s);
    assert.ok(!G.tangramCheck(m, missing).ok, 'un petit triangle hors de la silhouette');
    const shifted = m.ref.map((s, i) => i === 0 ? { ...s, x: s.x + .6 } : s);
    assert.ok(!G.tangramCheck(m, shifted).ok, 'un grand triangle décalé de 0,6');
    const square = m.ref.map((s, i) => i === 4 ? { ...s, r: (s.r + 1) % 8 } : s);
    assert.ok(!G.tangramCheck(m, square).ok, 'le carré tourné de 45°');
    assert.ok(!G.tangramCheck(m, square, .1).ok, 'même avec la grille du navigateur');
    const turned = m.ref.map((s, i) => i === 2 ? { ...s, r: (s.r + 2) % 8 } : s);
    assert.ok(!G.tangramCheck(m, turned).ok, 'le triangle moyen mal tourné');
  });
  test(`tangram « ${m.name} » : tolérance raisonnable et pièces identiques échangeables`, () => {
    const close = m.ref.map(s => ({ ...s, x: s.x + .02, y: s.y - .02 }));
    assert.ok(G.tangramCheck(m, close).ok, 'un écart de 0,02 passe');
    assert.ok(G.tangramCheck(m, close, .1).ok, 'même avec la grille du navigateur');
    // La pièce jumelle, tournée pour occuper exactement la place de l'autre.
    const twin = (i, j) => {
      const goal = G.tangramWorld(G.TANGRAM_PIECES[j], m.ref[j]).map(q => q.map(v => v.toFixed(6)).join()).sort().join(';');
      for (let r = 0; r < 8; r++) {
        const st = { ...m.ref[j], r };
        if (G.tangramWorld(G.TANGRAM_PIECES[i], st).map(q => q.map(v => (Math.abs(v) < 5e-7 ? 0 : v).toFixed(6)).join()).sort().join(';') === goal) return st;
      }
      throw new Error(`pas de rotation pour ${i} -> ${j}`);
    };
    const swapped = [twin(0, 1), twin(1, 0), m.ref[2], twin(3, 5), m.ref[4], twin(5, 3), m.ref[6]];
    assert.ok(G.tangramCheck(m, swapped).ok, 'les deux grands et les deux petits triangles sont interchangeables');
  });
}
test("tangram : l'aimantation pose exactement une pièce proche", () => {
  const m = G.TANGRAM_MODELS[0], p = G.TANGRAM_PIECES[0], ref = m.ref[0];
  const snapped = G.tangramSnap(p, { ...ref, x: ref.x + .15, y: ref.y - .1 }, m.polys.flat());
  assert.ok(Math.abs(snapped.x - ref.x) < 1e-9 && Math.abs(snapped.y - ref.y) < 1e-9);
  const far = G.tangramSnap(p, { ...ref, x: ref.x + 1.3 }, m.polys.flat());
  assert.equal(far.x, ref.x + 1.3, 'loin : pas d’aimantation');
});
test('tangram : sauvegarde nettoyée', () => {
  const c = G.tangramClean({ model: 'licorne', pieces: [{ x: 'a' }], solved: ['carre', 'carre', 'x'] });
  assert.equal(c.model, 'carre');
  assert.deepEqual(c.pieces, G.tangramStart());
  assert.deepEqual(c.solved, ['carre']);
  const ok = G.tangramClean({ model: 'triangle', pieces: G.TANGRAM_MODELS[1].ref.map(s => ({ ...s, r: s.r + 8 })) });
  assert.deepEqual(ok.pieces.map(s => s.r), G.TANGRAM_MODELS[1].ref.map(s => s.r));
});

// --- Arrêt progressif ---
test('arrêt progressif : volume 1, puis fondu linéaire, puis 0', () => {
  const end = 10 * 60000, fade = 60000;
  assert.equal(chillSleepGain(0, end, fade), 1);
  assert.equal(chillSleepGain(end - fade, end, fade), 1);
  assert.equal(chillSleepGain(end - fade / 2, end, fade), .5);
  assert.equal(chillSleepGain(end, end, fade), 0);
  assert.equal(chillSleepGain(end + 3600000, end, fade), 0, 'page réveillée après la fin : silence');
  assert.equal(chillSleepGain(5, null, fade), 1, 'sans minuterie');
});

// --- Coloriage ---
test('coloriage : seules des couleurs valides sur des zones connues sont gardées', () => {
  const c = A.coloriageClean({ pic: 'fleur', fills: { fleur: { z0: '#FF0000', z1: 'red', z99: '#00ff00', z2: '<script>' }, inconnu: { z0: '#000000' } } });
  assert.equal(c.pic, 'fleur');
  assert.deepEqual(c.fills, { fleur: { z0: '#ff0000' } });
  assert.equal(A.coloriageClean({ pic: '../x' }).pic, A.COLORIAGES[0].id);
});
test("historique de création : borné, annuler puis rétablir", () => {
  const dropped = [];
  const h = A.atelierHistory(3, op => dropped.push(op));
  for (let i = 1; i <= 5; i++) h.push(i);
  assert.deepEqual(h.ops(), [3, 4, 5]);
  assert.deepEqual(dropped, [1, 2], 'les plus anciens sont fixés, pas perdus');
  assert.equal(h.undo(), 5);
  assert.equal(h.redo(), 5);
  h.undo(); h.push(9);
  assert.ok(!h.canRedo(), 'un nouveau geste efface le « rétablir »');
});

// --- J'ai cinq minutes ---
const C = require(site('cinq.js'));
test("cinq minutes : jamais deux fois de suite la même suggestion, toujours une activité connue", () => {
  const ids = C.CINQ.map(a => a.id);
  for (const last of [...ids, null]) for (let k = 0; k < 500; k++) {
    const id = C.cinqPick(ids, last);
    assert.ok(ids.includes(id) && id !== last);
  }
  assert.equal(C.cinqPick(['seul'], 'seul'), 'seul', 'une seule activité : on la propose quand même');
});

console.log(`\n${count} tests OK`);
