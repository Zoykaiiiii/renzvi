// Présentation « Arbre » de l'espace Study : un arbre dessiné à partir des vrais cours, enraciné en bas.
// Tronc → une grosse branche par matière → une branche par cours → une brindille par chapitre. Avec une seule
// matière, ses cours partent directement du tronc (pas d'étage inutile).
// Placement stable : les matières alternent gauche/droite dans l'ordre de leur premier cours, la première en haut
// et près du tronc, les suivantes plus bas et plus loin. Ajouter un chapitre allonge seulement sa branche ; ajouter
// un cours ne pousse que ce qui est plus loin du même côté. Aucun hasard : les brindilles décoratives sont tirées
// de l'identifiant du cours.
// Les libellés sont de vrais boutons posés sur le dessin (clavier, lecteurs d'écran) ; le dessin est en SVG.
// Contrat : window.etudeVues.arbre(ctx) rend { update, reveal, leave } (voir etude.js).
window.etudeVues.arbre = function arbreVue(ctx) {
  const NS = 'http://www.w3.org/2000/svg';
  const TIER = 190, COL = 232, STEP = 34, STUB = 214, GAP = 84, HEAD = 58, ZMIN = .35, ZMAX = 2, FAR = .55;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const off = new AbortController(), signal = off.signal;
  const { stage } = ctx;

  const world = el('div', 'arbre-world');
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'arbre-svg');
  svg.setAttribute('aria-hidden', 'true');
  const labels = el('div', 'arbre-labels');
  world.append(svg, labels);
  const controls = el('div', 'arbre-zoom');
  controls.setAttribute('role', 'group');
  controls.ariaLabel = 'Zoom de l’arbre';
  const fitBtn = button('etude-tool', '', () => fit(true));
  fitBtn.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.500 6V2.500H6M10 2.500h3.500V6M13.500 10v3.500H10M6 13.500H2.500V10"/></svg>';
  fitBtn.ariaLabel = 'Voir tout l’arbre';
  const minus = button('etude-tool', '−', () => zoomBy(1 / 1.25));
  minus.ariaLabel = 'Dézoomer';
  const plus = button('etude-tool', '+', () => zoomBy(1.25));
  plus.ariaLabel = 'Zoomer';
  const level = el('span', 'arbre-level');
  controls.append(fitBtn, minus, level, plus);
  stage.replaceChildren(world, controls);

  let view = ctx.view() ? { ...ctx.view() } : null, bounds = { x: 0, y: 0, w: 1, h: 1 }, spots = new Map();

  // --- Géométrie -----------------------------------------------------------------------------------------------
  const hash = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0; };
  const cubic = (p, t) => {
    const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]];
  };
  // Le point de la courbe à une abscisse (ou une hauteur) donnée : les branches partent exactement du bois.
  function tAt(p, axis, value) {
    let lo = 0, hi = 1;
    const up = p[3][axis] > p[0][axis];
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; (cubic(p, mid)[axis] < value) === up ? lo = mid : hi = mid; }
    return (lo + hi) / 2;
  }
  // Une branche qui s'affine : un contour plein le long de la courbe, large au départ, fin au bout.
  function limb(p, w0, w1, n = 16) {
    const left = [], right = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, [x, y] = cubic(p, t), [x2, y2] = cubic(p, Math.min(1, t + .01)), [x1, y1] = cubic(p, Math.max(0, t - .01));
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * t ** .8) / 2;
      left.push(`${(x - dy / len * w).toFixed(1)} ${(y + dx / len * w).toFixed(1)}`);
      right.push(`${(x + dy / len * w).toFixed(1)} ${(y - dx / len * w).toFixed(1)}`);
    }
    return `M${left.join('L')}L${right.reverse().join('L')}Z`;
  }
  // Petites brindilles nues en bout de branche, pour que l'arbre ne ressemble pas à un schéma.
  function sprigs(x, y, angle, seed, out, depth = 2, len = 30) {
    const r = k => ((seed >>> (k * 5)) & 31) / 31;
    for (let i = 0; i < 2 + (seed & 1); i++) {
      const a = angle + (r(i) - .5) * 1.5, l = len * (.6 + r(i + 2) * .7);
      const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l;
      const mx = x + Math.cos(a - .25) * l * .55, my = y + Math.sin(a - .25) * l * .55;
      out.push(`M${x.toFixed(1)} ${y.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
      if (depth > 1) sprigs(ex, ey, a + (r(i + 1) - .5), hash(`${seed}${i}`), out, depth - 1, len * .6);
    }
  }

  // --- Dessin --------------------------------------------------------------------------------------------------
  function render() {
    const had = labels.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    const subjects = ctx.subjects(), sel = ctx.selected();
    // Une seule matière : chaque cours devient une grosse branche, la matière est écrite au pied de l'arbre.
    const solo = subjects.length === 1;
    const groups = solo
      ? subjects[0].courses.map(c => ({ id: c.id, courses: [c], merged: true }))
      : subjects.map(s => ({ id: s.id, name: s.name, courses: s.courses, merged: s.courses.length === 1 && cahierFold(s.courses[0].title) === s.key }));
    const wood = [], fine = [], dots = [], nodes = [];
    spots = new Map();
    let minX = -160, maxX = 160, minY = -40;
    const cursor = { [-1]: GAP, 1: GAP };
    const tiers = Math.ceil(groups.length / 2);
    const rootY = (tiers - 1) * TIER + 250;

    groups.forEach((g, i) => {
      const side = i % 2 ? 1 : -1, y = Math.floor(i / 2) * TIER + (side > 0 ? TIER * .4 : 0);
      const gFold = !g.merged && ctx.folded(g.id);
      const cols = gFold ? [] : g.courses.map(c => ({ c, fold: ctx.folded(c.id) }));
      const x0 = cursor[side];
      let x = x0;
      for (const col of cols) { col.x = x + 26; x += col.fold ? STUB : COL; }
      const width = gFold ? STUB : x - x0;
      cursor[side] = x0 + width + 36;
      const reach = gFold ? x0 + 60 : cols.at(-1).x;
      // La grosse branche : elle quitte le tronc en montant, puis file presque à plat jusqu'à son dernier cours.
      // Elle finit en se redressant : son dernier cours la prolonge, sans coude.
      const bough = [[0, y + 96], [side * 14, y + 6], [side * reach * .72, y + 16], [side * reach, y - (gFold ? 6 : 34)]];
      wood.push(limb(bough, 16 - Math.min(5, Math.floor(i / 2) * 1.5), gFold ? 2 : 5.5, 26));
      { const mid = cubic(bough, .52); sprigs(mid[0], mid[1], -Math.PI / 2 - side * .5, hash(`${g.id}b`), fine, 2, 24); }
      const add = (kind, key, text, px, py, extra = {}) => nodes.push({ kind, key, text, x: px, y: py, side, ...extra });
      if (!g.merged) {
        const count = g.courses.length;
        // Le nom de la matière se pose sous sa branche, là où elle quitte le tronc : jamais sur un chapitre.
        add('matiere', g.id, g.name, side * (x0 + 4), cubic(bough, tAt(bough, 0, side * (x0 + 30)))[1] + 30, { fold: gFold, small: gFold ? `${count} cours` : '' });
        spots.set(g.id, [side * x0, y]);
      }
      if (gFold) {
        const seed = hash(g.id), tip = cubic(bough, 1);
        sprigs(tip[0], tip[1], side > 0 ? -.5 : Math.PI + .5, seed, fine);
        return;
      }
      for (const { c, fold, x: cx } of cols) {
        const base = cubic(bough, tAt(bough, 0, side * cx)), seed = hash(c.id), sway = ((seed % 21) - 10) * 1.4;
        const n = fold ? 0 : c.chapters.length, h = fold ? 54 : HEAD + n * STEP;
        const tipX = base[0] + side * 6 + sway, tipY = base[1] - h;
        const stem = [base, [base[0] + side * 3, base[1] - h * .35], [tipX + sway * .6, base[1] - h * .65], [tipX, tipY]];
        wood.push(limb(stem, 5.5, 1.3));
        sprigs(tipX, tipY, -Math.PI / 2 + side * .25, seed, fine, 2, fold ? 22 : 30);
        add('cours', c.id, g.merged && !solo ? g.name : c.title, tipX + side * 30, tipY - 12, { fold, small: fold ? plural(c.chapters.length, 'chapitre') : '', big: g.merged });
        spots.set(c.id, [tipX, tipY]);
        minY = Math.min(minY, tipY - 80);
        c.chapters.slice(0, n).forEach((ch, j) => {
          // Le premier chapitre est en bas, près du bois ; les suivants montent le long de la branche.
          const at = cubic(stem, tAt(stem, 1, base[1] - (HEAD - 22) - j * STEP));
          const len = 22 + (j % 2) * 12, tx = at[0] + side * len, ty = at[1] - 7;
          fine.push(`M${at[0].toFixed(1)} ${at[1].toFixed(1)}Q${(at[0] + side * len * .5).toFixed(1)} ${(at[1] - 1).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`);
          const on = sel?.course === c.id && sel.chapter === ch.id;
          dots.push({ x: tx, y: ty, on });
          add('chapitre', `${c.id}/${ch.id}`, ch.title, tx + side * 10, ty, { on, course: c.id, chapter: ch.id, due: ctx.due(c.id, ch.id), linked: ctx.linked(c.id, ch.id) });
          spots.set(`${c.id}/${ch.id}`, [tx, ty]);
        });
      }
    });
    for (const s of [-1, 1]) { const edge = cursor[s] + 40; if (s < 0) minX = Math.min(minX, -edge); else maxX = Math.max(maxX, edge); }
    // Le tronc, légèrement courbe, et deux racines qui s'évasent : l'arbre est posé, pas flottant.
    const trunkW = 30 + Math.min(14, groups.length * 2);
    wood.push(limb([[6, rootY], [-14, rootY * .62], [12, rootY * .3 + 40], [0, 70]], trunkW, 16, 30));
    for (const s of [-1, 1]) wood.push(limb([[6 + s * 3, rootY - 70], [6 + s * 8, rootY - 22], [6 + s * 22, rootY - 4], [6 + s * (34 + trunkW), rootY + 6]], trunkW * .6, 1.5));
    if (solo) nodes.push({ kind: 'titre', key: 'titre', text: subjects[0].name, x: trunkW / 2 + 18, y: rootY - 40, side: 1 });
    bounds = { x: minX, y: minY, w: maxX - minX, h: rootY + 30 - minY };

    svg.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`);
    Object.assign(svg.style, { left: `${bounds.x}px`, top: `${bounds.y}px`, width: `${bounds.w}px`, height: `${bounds.h}px` });
    svg.innerHTML = `<path class="arbre-wood" d="${wood.join('')}"/><path class="arbre-fine" d="${fine.join('')}"/>`
      + dots.map(d => `<circle class="arbre-dot${d.on ? ' on' : ''}" cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="3.6"/>${d.on ? `<circle class="arbre-ring" cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="8"/>` : ''}`).join('');

    labels.replaceChildren(...nodes.map(nd => {
      if (nd.kind === 'titre') {
        const t = el('p', 'arbre-label arbre-titre', nd.text);
        Object.assign(t.style, { left: `${nd.x}px`, top: `${nd.y}px` });
        return t;
      }
      const b = button(`arbre-label arbre-${nd.kind}${nd.big ? ' arbre-big' : ''}`, '', () => (nd.kind === 'chapitre' ? ctx.select(nd.course, nd.chapter) : ctx.toggleFold(nd.key)));
      b.append(el('span', '', nd.text));
      if (nd.small) b.append(el('small', '', nd.small));
      b.dataset.key = nd.key;
      b.dataset.side = nd.side > 0 ? 'd' : 'g';
      b.title = nd.text;
      Object.assign(b.style, { left: `${nd.x}px`, top: `${nd.y}px` });
      if (nd.kind === 'chapitre') {
        if (nd.on) b.setAttribute('aria-current', 'true');
        if (nd.due) { b.append(el('i', 'arbre-due')); b.ariaLabel = `${nd.text}, ${nd.due} à revoir`; }
      } else {
        b.setAttribute('aria-expanded', !nd.fold);
        b.ariaLabel = `${nd.text}, ${nd.fold ? 'déplier' : 'replier'}${nd.small ? `, ${nd.small}` : ''}`;
      }
      return b;
    }));
    if (had) labels.querySelector(`[data-key="${CSS.escape(had)}"]`)?.focus({ preventScroll: true });
  }

  // --- Vue : déplacer, zoomer, tout voir ------------------------------------------------------------------------
  const clampK = k => Math.max(ZMIN, Math.min(ZMAX, k));
  function apply(animate = false, save = true) {
    world.classList.toggle('gliding', animate && !reduced());
    world.style.transform = `translate(${view.x.toFixed(1)}px,${view.y.toFixed(1)}px) scale(${view.k.toFixed(4)})`;
    // De loin, les chapitres ne sont plus lisibles : on les masque au lieu de tout rétrécir. Les matières restent.
    stage.dataset.lod = view.k < FAR ? 'loin' : '';
    level.textContent = `${Math.round(view.k * 100)} %`;
    minus.disabled = view.k <= ZMIN + .001;
    plus.disabled = view.k >= ZMAX - .001;
    if (save) ctx.setView({ ...view });
  }
  // floor : à l'ouverture, on ne descend pas sous le zoom où les chapitres se lisent ; « Voir tout » montre vraiment tout.
  function fit(animate = false, floor = ZMIN) {
    const full = stage.clientWidth, tall = stage.clientHeight;
    if (!full || !tall) return;
    // La place libre : à côté du panneau du chapitre sur grand écran, au-dessus de lui sur téléphone.
    const wide = full >= 900, pad = full < 728 ? 16 : 48;
    const W = full - (wide ? 380 : 0), H = wide ? tall - 56 : tall * .54;
    const k = Math.max(floor, clampK(Math.min((W - pad * 2) / bounds.w, (H - pad * 2) / bounds.h, 1)));
    // Si tout ne tient pas au zoom minimal, on garde le tronc au milieu et le pied de l'arbre en vue.
    view = {
      k,
      x: bounds.w * k <= W - pad ? W / 2 - (bounds.x + bounds.w / 2) * k : W / 2,
      y: bounds.h * k <= H - pad ? pad + (H - pad * 2 - bounds.h * k) / 2 - bounds.y * k : H - pad - (bounds.y + bounds.h) * k,
    };
    apply(animate);
  }
  function zoomBy(f, cx = stage.clientWidth / 2, cy = stage.clientHeight / 2, animate = true) {
    const k = clampK(view.k * f);
    view = { k, x: cx - (cx - view.x) * (k / view.k), y: cy - (cy - view.y) * (k / view.k) };
    apply(animate);
  }
  // Amène un point de l'arbre dans la partie visible (hors du panneau du chapitre), seulement s'il n'y est pas.
  function show(key, animate = true) {
    const p = spots.get(key);
    if (!p) return;
    const W = stage.clientWidth, H = stage.clientHeight, wide = W >= 900;
    const box = { l: 140, r: W - (wide ? 420 : 140), t: wide ? 90 : 60, b: H - (wide ? 110 : H * .45) };
    const sx = p[0] * view.k + view.x, sy = p[1] * view.k + view.y;
    if (sx >= box.l && sx <= box.r && sy >= box.t && sy <= box.b) return;
    view.x += Math.max(box.l, Math.min(box.r, sx)) - sx;
    view.y += Math.max(box.t, Math.min(box.b, sy)) - sy;
    if (sx < box.l || sx > box.r) view.x += (box.l + box.r) / 2 - Math.max(box.l, Math.min(box.r, sx));
    apply(animate);
  }

  const pointers = new Map();
  let grab = null;
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('button, a, input') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    stage.setPointerCapture(e.pointerId);
    const pts = [...pointers.values()];
    grab = pts.length === 2
      ? { k: view.k, d: Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) || 1 }
      : { x: e.clientX - view.x, y: e.clientY - view.y };
    stage.classList.add('grabbing');
  }, { signal });
  stage.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId) || !grab) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    const pts = [...pointers.values()], r = stage.getBoundingClientRect();
    if (pts.length === 2 && grab.d) {
      const d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
      zoomBy(clampK(grab.k * d / grab.d) / view.k, (pts[0][0] + pts[1][0]) / 2 - r.left, (pts[0][1] + pts[1][1]) / 2 - r.top, false);
    } else if (pts.length === 1 && 'x' in grab) {
      view.x = e.clientX - grab.x;
      view.y = e.clientY - grab.y;
      apply(false, false);
    }
  }, { signal });
  const release = e => {
    if (!pointers.delete(e.pointerId)) return;
    const pts = [...pointers.values()];
    grab = pts.length === 1 ? { x: pts[0][0] - view.x, y: pts[0][1] - view.y } : null;
    if (!pts.length) { stage.classList.remove('grabbing'); ctx.setView({ ...view }); }
  };
  stage.addEventListener('pointerup', release, { signal });
  stage.addEventListener('pointercancel', release, { signal });
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0018)), e.clientX - r.left, e.clientY - r.top, false);
  }, { signal, passive: false });
  // Le focus au clavier sur un libellé hors champ : le navigateur ferait défiler la scène ; on déplace la vue à la place.
  stage.addEventListener('scroll', () => { stage.scrollTop = stage.scrollLeft = 0; }, { signal });
  labels.addEventListener('focusin', e => { if (e.target.matches(':focus-visible')) show(e.target.dataset.key); }, { signal });
  const resized = new ResizeObserver(() => { if (!view) fit(false, FAR); });
  resized.observe(stage);

  render();
  if (view) { view.k = clampK(view.k); apply(false, false); } else fit(false, FAR);
  return {
    update: render,
    reveal() { const s = ctx.selected(); if (s) show(`${s.course}/${s.chapter}`); },
    leave() { off.abort(); resized.disconnect(); world.remove(); controls.remove(); delete stage.dataset.lod; stage.classList.remove('grabbing'); },
  };
};
