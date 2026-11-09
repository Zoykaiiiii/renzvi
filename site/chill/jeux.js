// Chill C4 : deux petits jeux calmes, sans chronomètre, sans score ni classement.
// - Puzzle photo (taquin) : mélange par de vrais coups depuis la position résolue, donc toujours résoluble.
//   La photo personnelle reste dans ce navigateur : elle n'est jamais envoyée.
// - Tangram : 7 pièces, rotation par 45°, retournement, aimantation douce ; réussite vérifiée en comparant
//   les surfaces (pièces contre silhouette) avec une petite tolérance, pas par une règle approximative.
// Logique pure (taquin*, tangram*) séparée du rendu. Utilise el, button, WALLPAPERS (dashboard.html), chillAgrandir.

// --- Taquin ---
const taquinSolved = n => [...Array.from({ length: n * n - 1 }, (_, i) => i + 1), 0];
const taquinIsSolved = t => t.every((v, i) => v === (i === t.length - 1 ? 0 : i + 1));
function taquinSolvable(t, n) {
  if (!Array.isArray(t) || t.length !== n * n || [...t].sort((a, b) => a - b).some((v, i) => v !== i)) return false;
  const list = t.filter(v => v !== 0);
  let inv = 0;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (list[i] > list[j]) inv++;
  if (n % 2) return inv % 2 === 0;
  const blankFromBottom = n - Math.floor(t.indexOf(0) / n);
  return (inv + blankFromBottom) % 2 === 1;
}
const taquinNeighbours = (n, i) => [i - n, i + n, i % n ? i - 1 : -1, (i + 1) % n ? i + 1 : -1].filter(j => j >= 0 && j < n * n);
function taquinMove(t, n, i) {
  const blank = t.indexOf(0);
  if (!taquinNeighbours(n, blank).includes(i)) return null;
  const next = [...t];
  [next[blank], next[i]] = [next[i], next[blank]];
  return next;
}
// Flèche : la pièce située du côté opposé glisse dans la case vide (← déplace la pièce de droite vers la gauche).
function taquinMoveDir(t, n, dir) {
  const b = t.indexOf(0), r = Math.floor(b / n), c = b % n;
  const from = { ArrowLeft: c < n - 1 ? b + 1 : -1, ArrowRight: c > 0 ? b - 1 : -1, ArrowUp: r < n - 1 ? b + n : -1, ArrowDown: r > 0 ? b - n : -1 }[dir];
  return from >= 0 ? taquinMove(t, n, from) : null;
}
function taquinShuffle(n, rand = Math.random) {
  let t = taquinSolved(n), prev = -1;
  for (let k = 0; k < n * n * 30 || taquinIsSolved(t); k++) {
    const blank = t.indexOf(0);
    const options = taquinNeighbours(n, blank).filter(j => j !== prev);
    const pick = options[Math.floor(rand() * options.length)];
    t = taquinMove(t, n, pick);
    prev = blank;
  }
  return t;
}

// --- Tangram ---
// Les 7 pièces découpées dans un carré de 4 de côté.
const TANGRAM_PIECES = [
  { id: 'g1', name: 'Grand triangle 1', pts: [[0, 0], [4, 0], [2, 2]] },
  { id: 'g2', name: 'Grand triangle 2', pts: [[0, 0], [2, 2], [0, 4]] },
  { id: 'm', name: 'Triangle moyen', pts: [[4, 4], [2, 4], [4, 2]] },
  { id: 'p1', name: 'Petit triangle 1', pts: [[4, 0], [4, 2], [3, 1]] },
  { id: 'c', name: 'Carré', pts: [[2, 2], [3, 1], [4, 2], [3, 3]] },
  { id: 'p2', name: 'Petit triangle 2', pts: [[1, 3], [2, 2], [3, 3]] },
  { id: 'q', name: 'Parallélogramme', pts: [[0, 4], [1, 3], [3, 3], [2, 4]] },
].map(p => {
  const cx = p.pts.reduce((s, q) => s + q[0], 0) / p.pts.length, cy = p.pts.reduce((s, q) => s + q[1], 0) / p.pts.length;
  return { ...p, c: [cx, cy], local: p.pts.map(([x, y]) => [x - cx, y - cy]) };
});
const tangramRot = ([x, y], r) => { const a = r * Math.PI / 4, c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };
// Position d'une pièce : centre (x, y), rotation r (pas de 45°), retournée ou non.
const tangramWorld = (piece, st) => piece.local.map(([x, y]) => { const [a, b] = tangramRot([st.f ? -x : x, y], st.r); return [a + st.x, b + st.y]; });
// Les silhouettes : les 2 grands triangles forment un triangle, les 5 autres pièces un second triangle identique.
// Chaque modèle déplace ce second groupe ; sa solution de référence est donc juste par construction (vérifiée par tests/chill.test.cjs).
const TANGRAM_MODELS = [
  { id: 'carre', name: 'Carré', group: { r: 0, t: [0, 0] } },
  { id: 'triangle', name: 'Grand triangle', group: { r: 2, t: [4, -4] } },
  { id: 'parallelo', name: 'Parallélogramme', group: { r: 0, t: [0, -4] } },
].map(m => {
  const shift = [2, m.id === 'carre' ? 3 : 5]; // la silhouette est posée à gauche du plateau
  const ref = TANGRAM_PIECES.map(p => {
    if (p.id === 'g1' || p.id === 'g2') return { x: p.c[0] + shift[0], y: p.c[1] + shift[1], r: 0, f: false };
    const [x, y] = tangramRot(p.c, m.group.r);
    return { x: x + m.group.t[0] + shift[0], y: y + m.group.t[1] + shift[1], r: m.group.r, f: false };
  });
  return { ...m, ref, polys: TANGRAM_PIECES.map((p, i) => tangramWorld(p, ref[i])) };
});
const TANGRAM_TRAY = [[11.5, 2.2], [15.6, 2.2], [11.2, 6.3], [13.6, 5.2], [16, 6], [13.6, 7.8], [16.4, 8.7]];
const tangramStart = () => TANGRAM_TRAY.map(([x, y]) => ({ x, y, r: 0, f: false }));
function tangramInside([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// Compare les surfaces sur une grille fine : part de la silhouette couverte, débordement, chevauchements.
function tangramCheck(model, states, step = .05) {
  const user = TANGRAM_PIECES.map((p, i) => tangramWorld(p, states[i]));
  const all = model.polys.flat();
  const [x0, x1] = [Math.min(...all.map(p => p[0])) - 1, Math.max(...all.map(p => p[0])) + 1];
  const [y0, y1] = [Math.min(...all.map(p => p[1])) - 1, Math.max(...all.map(p => p[1])) + 1];
  let target = 0, covered = 0, extra = 0, overlap = 0;
  for (let x = x0 + step / 2; x < x1; x += step) for (let y = y0 + step / 2; y < y1; y += step) {
    const inT = model.polys.some(p => tangramInside([x, y], p));
    const n = user.filter(p => tangramInside([x, y], p)).length;
    if (inT) { target++; if (n) covered++; }
    else if (n) extra++;
    if (n > 1) overlap++;
  }
  const r = { covered: covered / target, extra: extra / target, overlap: overlap / target };
  // 1,5 % : un carré tourné de 45° (2 % de la silhouette en moins) doit échouer, un écart de quelques pixels passer.
  return { ...r, ok: r.covered >= .985 && r.extra <= .015 && r.overlap <= .01 };
}
// Aimantation : si un sommet de la pièce tombe tout près d'un sommet repère, on l'y pose exactement.
function tangramSnap(piece, st, anchors, radius = .3) {
  let best = null;
  for (const [x, y] of tangramWorld(piece, st)) for (const [ax, ay] of anchors) {
    const d = Math.hypot(ax - x, ay - y);
    if (d < radius && (!best || d < best.d)) best = { d, dx: ax - x, dy: ay - y };
  }
  return best ? { ...st, x: st.x + best.dx, y: st.y + best.dy } : st;
}
function tangramClean(data) {
  const model = TANGRAM_MODELS.some(m => m.id === data?.model) ? data.model : TANGRAM_MODELS[0].id;
  const ok = s => s && Number.isFinite(s.x) && Number.isFinite(s.y) && s.x > -2 && s.x < 20 && s.y > -2 && s.y < 12 && Number.isInteger(s.r);
  const pieces = Array.isArray(data?.pieces) && data.pieces.length === 7 && data.pieces.every(ok)
    ? data.pieces.map(s => ({ x: s.x, y: s.y, r: ((s.r % 8) + 8) % 8, f: s.f === true })) : tangramStart();
  const solved = (Array.isArray(data?.solved) ? data.solved : []).filter(id => TANGRAM_MODELS.some(m => m.id === id));
  return { model, pieces, solved: [...new Set(solved)] };
}

// --- Rendu (navigateur seulement) ---

function puzzleWidget({ body, meta, data, save, user }) {
  const PHOTO_KEY = `renzvi:puzzle-photo:${user?.id ?? 'local'}`;
  const DEMO = WALLPAPERS.find(w => w.id === 'lac');
  const clean = d => {
    const n = d?.n === 4 ? 4 : 3;
    const tiles = taquinSolvable(d?.tiles, n) ? d.tiles : taquinShuffle(n);
    return { n, tiles, img: ['demo', 'perso', 'chiffres'].includes(d?.img) ? d.img : 'demo', moves: Number.isInteger(d?.moves) && d.moves >= 0 ? d.moves : 0 };
  };
  let state = clean(data), photo = null, dialog = null, peek = false;
  try { photo = localStorage.getItem(PHOTO_KEY); if (photo && !photo.startsWith('data:image/jpeg;base64,')) photo = null; } catch {}
  const root = el('div', 'jeu puzzle');
  const note = el('p', 'zone');
  note.setAttribute('role', 'status');
  const grid = el('div', 'taquin');
  grid.tabIndex = 0;
  grid.setAttribute('role', 'group');
  grid.ariaLabel = 'Puzzle : flèches du clavier pour faire glisser une pièce dans la case vide';
  const preview = el('div', 'taquin-preview');
  preview.hidden = true;
  const levels = el('div', 'choices');
  levels.setAttribute('role', 'group');
  levels.ariaLabel = 'Difficulté';
  const images = el('div', 'choices');
  images.setAttribute('role', 'group');
  images.ariaLabel = 'Image';
  const file = Object.assign(el('input'), { type: 'file', accept: 'image/*', hidden: true });
  file.ariaLabel = 'Choisir ta photo';
  const look = button('ghost', "Voir l'image", () => { peek = !peek; draw(); });
  const again = button('ghost', 'Recommencer', () => { state = { ...state, tiles: taquinShuffle(state.n), moves: 0 }; save(state); note.textContent = ''; draw(); grid.focus(); });
  const big = button('ghost', 'Agrandir', () => { dialog = chillAgrandir('Puzzle photo', root, () => { dialog = null; }); });
  big.classList.add('atelier-open');
  const row = el('div', 'atelier-row');
  row.append(look, again);
  const credit = el('p', 'zone small');
  root.append(levels, images, grid, preview, row, note, credit, file);

  const source = () => state.img === 'perso' && photo ? photo : state.img === 'demo' ? `assets/${DEMO.file}` : null;
  function move(next) {
    if (!next || taquinIsSolved(state.tiles)) return;
    state = { ...state, tiles: next, moves: state.moves + 1 };
    save(state);
    note.textContent = taquinIsSolved(next) ? `Bravo, l'image est reconstituée en ${state.moves} coups.` : '';
    draw();
  }
  grid.onkeydown = e => {
    if (!e.key.startsWith('Arrow')) return;
    e.preventDefault();
    move(taquinMoveDir(state.tiles, state.n, e.key));
  };
  file.onchange = async () => {
    const chosen = file.files[0];
    file.value = '';
    if (!chosen) return;
    if (!chosen.type.startsWith('image/') || chosen.size > 30 * 1048576) { note.textContent = 'Choisis une image JPEG ou PNG de 30 Mo au plus.'; return; }
    try {
      // Recadrée en carré et réduite ici : la photo ne quitte pas l'appareil.
      const bmp = await createImageBitmap(chosen);
      const side = Math.min(bmp.width, bmp.height), c = Object.assign(document.createElement('canvas'), { width: 600, height: 600 });
      c.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 600, 600);
      bmp.close();
      photo = c.toDataURL('image/jpeg', .82);
      try { localStorage.setItem(PHOTO_KEY, photo); note.textContent = 'Ta photo reste sur cet appareil, elle n’est pas envoyée.'; }
      catch { note.textContent = 'Ta photo est utilisée pour cette visite, mais ce navigateur ne peut pas la garder.'; }
      state = { ...state, img: 'perso' };
      save(state);
      draw();
    } catch { note.textContent = "Cette image n'a pas pu être lue. Essaie une photo JPEG ou PNG."; }
  };
  function draw() {
    const { n, tiles } = state, src = source();
    levels.replaceChildren(...[[3, 'Facile'], [4, 'Moyen']].map(([k, name]) => {
      const b = button('', name, () => { if (k !== n) { state = { ...state, n: k, tiles: taquinShuffle(k), moves: 0 }; save(state); note.textContent = ''; draw(); } });
      b.setAttribute('aria-pressed', k === n);
      return b;
    }));
    images.replaceChildren(...[['demo', 'Lac'], ['perso', 'Ma photo'], ['chiffres', 'Chiffres']].map(([id, name]) => {
      const b = button('', name, () => { if (id === 'perso' && !photo) return file.click(); state = { ...state, img: id }; save(state); draw(); });
      b.setAttribute('aria-pressed', state.img === id);
      return b;
    }));
    grid.style.setProperty('--n', n);
    const done = taquinIsSolved(tiles);
    grid.classList.toggle('done', done);
    grid.replaceChildren(...tiles.map((v, i) => {
      if (!v) { const hole = el('span', 'taquin-hole'); hole.setAttribute('aria-hidden', 'true'); return hole; }
      const b = button('taquin-tile', String(v), () => move(taquinMove(tiles, n, i)));
      b.tabIndex = -1;
      b.ariaLabel = `Pièce ${v}, ligne ${Math.floor(i / n) + 1}, colonne ${i % n + 1}`;
      if (src) {
        const home = v - 1;
        b.style.backgroundImage = `url("${src}")`;
        b.style.backgroundSize = `${n * 100}% ${n * 100}%`;
        b.style.backgroundPosition = `${(home % n) / (n - 1) * 100}% ${Math.floor(home / n) / (n - 1) * 100}%`;
        b.classList.add('photo');
      }
      return b;
    }));
    preview.hidden = !peek || !src;
    if (src) preview.style.backgroundImage = `url("${src}")`;
    look.textContent = peek ? "Cacher l'image" : "Voir l'image";
    look.hidden = !src;
    if (state.img === 'perso' && !photo) note.textContent = "Ta photo est restée sur un autre appareil : choisis-la à nouveau, ou joue avec les chiffres.";
    credit.textContent = state.img === 'demo' ? `Photo : « ${DEMO.title} » par ${DEMO.by}, ${DEMO.license}.` : '';
    meta.textContent = done ? 'Réussi' : state.moves ? `${state.moves} coups` : '';
  }
  draw();
  body.append(root, big);
  return () => dialog?.close();
}

function tangramWidget({ body, meta, data, save }) {
  const NS = 'http://www.w3.org/2000/svg';
  let state = tangramClean(data), sel = 0, dialog = null, drag = null, hintTimer = null;
  const model = () => TANGRAM_MODELS.find(m => m.id === state.model);
  const root = el('div', 'jeu tangram');
  const note = el('p', 'zone');
  note.setAttribute('role', 'status');
  const models = el('div', 'choices');
  models.setAttribute('role', 'group');
  models.ariaLabel = 'Silhouette';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 -0.5 18 10.5');
  svg.setAttribute('class', 'tangram-board');
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Plateau : Tab pour choisir une pièce, flèches pour la déplacer, R pour tourner, F pour retourner');
  const target = document.createElementNS(NS, 'g');
  const hint = document.createElementNS(NS, 'polygon');
  hint.setAttribute('class', 'tangram-hint');
  const layer = document.createElementNS(NS, 'g');
  svg.append(target, layer, hint);
  const path = pts => pts.map(p => p.map(v => v.toFixed(3)).join(',')).join(' ');
  const anchors = i => [...model().polys.flat(), ...state.pieces.flatMap((s, k) => k === i ? [] : tangramWorld(TANGRAM_PIECES[k], s))];
  const polys = TANGRAM_PIECES.map((p, i) => {
    const n = document.createElementNS(NS, 'polygon');
    n.setAttribute('class', `tangram-piece t-${p.id}`);
    n.setAttribute('tabindex', '0');
    n.setAttribute('role', 'button');
    n.setAttribute('aria-label', p.name);
    n.addEventListener('focus', () => { sel = i; mark(); });
    n.addEventListener('keydown', e => keys(e, i));
    n.addEventListener('pointerdown', e => grab(e, i));
    layer.append(n);
    return n;
  });
  const rotL = button('ghost', 'Tourner ↺', () => change(sel, s => ({ ...s, r: (s.r + 7) % 8 })));
  const rotR = button('ghost', 'Tourner ↻', () => change(sel, s => ({ ...s, r: (s.r + 1) % 8 })));
  const flip = button('ghost', 'Retourner', () => change(sel, s => ({ ...s, f: !s.f })));
  const help = button('ghost', 'Aide', showHint);
  const reset = button('ghost', 'Recommencer', () => { state = { ...state, pieces: tangramStart() }; save(state); note.textContent = ''; draw(); });
  const big = button('ghost', 'Agrandir', () => { dialog = chillAgrandir('Tangram', root, () => { dialog = null; }); });
  big.classList.add('atelier-open');
  const row = el('div', 'atelier-row');
  row.append(rotL, rotR, flip, help, reset);
  root.append(models, svg, row, note);

  const toBoard = e => { const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse()); return [p.x, p.y]; };
  function grab(e, i) {
    if (e.button > 0) return;
    e.preventDefault();
    sel = i;
    polys[i].focus({ preventScroll: true });
    polys[i].setPointerCapture(e.pointerId);
    const [x, y] = toBoard(e), s = state.pieces[i];
    drag = { i, id: e.pointerId, dx: s.x - x, dy: s.y - y };
    polys[i].onpointermove = m => {
      if (!drag || m.pointerId !== drag.id) return;
      const [mx, my] = toBoard(m);
      state.pieces[i] = { ...state.pieces[i], x: Math.min(17.5, Math.max(.5, mx + drag.dx)), y: Math.min(9.5, Math.max(0, my + drag.dy)) };
      place(i);
    };
    polys[i].onpointerup = polys[i].onpointercancel = () => { polys[i].onpointermove = polys[i].onpointerup = polys[i].onpointercancel = null; drag = null; change(i, s2 => s2); };
  }
  function keys(e, i) {
    const big = e.shiftKey ? 1 : .25;
    const d = { ArrowLeft: [-big, 0], ArrowRight: [big, 0], ArrowUp: [0, -big], ArrowDown: [0, big] }[e.key];
    if (d) { e.preventDefault(); return change(i, s => ({ ...s, x: Math.min(17.5, Math.max(.5, s.x + d[0])), y: Math.min(9.5, Math.max(0, s.y + d[1])) }), .2); }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); return change(i, s => ({ ...s, r: (s.r + (e.shiftKey ? 7 : 1)) % 8 })); }
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); change(i, s => ({ ...s, f: !s.f })); }
  }
  // Toute modification passe ici : aimantation, vérification, enregistrement.
  function change(i, fn, radius = .3) {
    const before = state.pieces[i];
    state.pieces[i] = tangramSnap(TANGRAM_PIECES[i], fn(before), anchors(i), radius);
    place(i);
    const r = tangramCheck(model(), state.pieces, .1);
    if (r.ok && !state.solved.includes(state.model)) state.solved = [...state.solved, state.model];
    note.textContent = r.ok ? `Silhouette « ${model().name} » réussie.` : '';
    meta.textContent = r.ok ? 'Réussi' : '';
    save(state);
  }
  function place(i) { polys[i].setAttribute('points', path(tangramWorld(TANGRAM_PIECES[i], state.pieces[i]))); }
  function mark() { polys.forEach((p, i) => p.classList.toggle('sel', i === sel)); }
  // L'aide montre où va la pièce choisie (pour deux pièces identiques, la place encore libre).
  function showHint() {
    const p = TANGRAM_PIECES[sel], twin = { g1: 'g2', g2: 'g1', p1: 'p2', p2: 'p1' }[p.id];
    const spots = [sel, ...(twin ? [TANGRAM_PIECES.findIndex(x => x.id === twin)] : [])];
    const free = spots.find(k => !state.pieces.some((s, j) => j !== sel && Math.hypot(s.x - model().ref[k].x, s.y - model().ref[k].y) < .2)) ?? sel;
    hint.setAttribute('points', path(model().polys[free]));
    hint.style.display = '';
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { hint.style.display = 'none'; }, 3000);
    note.textContent = `Aide : la place de « ${p.name.toLowerCase()} » est en pointillés.`;
  }
  function draw() {
    models.replaceChildren(...TANGRAM_MODELS.map(m => {
      const b = button('', `${m.name}${state.solved.includes(m.id) ? ' ✓' : ''}`, () => { if (m.id !== state.model) { state = { ...state, model: m.id, pieces: tangramStart() }; save(state); note.textContent = ''; draw(); } });
      b.setAttribute('aria-pressed', m.id === state.model);
      return b;
    }));
    target.replaceChildren(...model().polys.map(p => { const n = document.createElementNS(NS, 'polygon'); n.setAttribute('points', path(p)); n.setAttribute('class', 'tangram-target'); return n; }));
    polys.forEach((_, i) => place(i));
    hint.style.display = 'none';
    mark();
    const ok = tangramCheck(model(), state.pieces, .1).ok;
    meta.textContent = ok ? 'Réussi' : '';
  }
  draw();
  body.append(root, big);
  return () => { clearTimeout(hintTimer); dialog?.close(); };
}

if (typeof module !== 'undefined') module.exports = { taquinSolved, taquinIsSolved, taquinSolvable, taquinMove, taquinMoveDir, taquinShuffle, TANGRAM_PIECES, TANGRAM_MODELS, tangramWorld, tangramCheck, tangramSnap, tangramClean, tangramStart };
