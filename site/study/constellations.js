// Présentation « Constellations » de l'espace Study : un ciel de nuit dessiné à partir des vrais cours.
// Une matière = une région du ciel, avec son nom. Un cours = une constellation : ses chapitres sont des étoiles reliées
// dans l'ordre du cours (le seul lien réel qu'on connaît). Aucune ligne entre des cours différents.
// Placement stable : les matières occupent des emplacements fixes dans l'ordre de leur premier cours ; dans une matière,
// chaque cours part d'un point fixe ; chaque étoile ne dépend que de son rang dans le cours et de l'identifiant du cours.
// Ajouter un chapitre ajoute une étoile au bout, rien d'autre ne bouge. Aucun hasard à l'affichage.
// Le ciel est le fond d'écran de la personne : aucune étoile décorative ni colline n'est ajoutée (elles concurrençaient
// les étoiles d'un fond déjà étoilé). Les étoiles de contenu sont de vrais boutons de 44 px (clavier, lecteurs
// d'écran), leur nom posé à côté, une auréole les distingue du fond.
// Caméra : cliquer une étoile s'en approche et la pose à côté du panneau ; cliquer une matière ou un cours cadre son
// groupe. ctx.apercu : dessin seul pour le widget, sans caméra, sans geste, sans bouton actif.
// Contrat : window.etudeVues.constellations(ctx) rend { update, reveal, leave } (voir etude.js).
window.etudeVues.constellations = function constellationsVue(ctx) {
  const NS = 'http://www.w3.org/2000/svg';
  const SX = 560, SY = 440, STEP = 64, ZMIN = .3, ZMAX = 2.2, FAR = .55, REACH = 190, NEAR = 1.2;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const off = new AbortController(), signal = off.signal;
  const { stage } = ctx, mini = !!ctx.apercu;
  const world = el('div', 'cst-world');
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'cst-svg');
  svg.setAttribute('aria-hidden', 'true');
  const labels = el('div', 'cst-labels');
  world.append(svg, labels);
  const controls = el('div', 'arbre-zoom');
  controls.setAttribute('role', 'group');
  controls.ariaLabel = 'Zoom du ciel';
  const fitBtn = button('etude-tool', '', () => fit(true));
  fitBtn.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.500 6V2.500H6M10 2.500h3.500V6M13.500 10v3.500H10M6 13.500H2.500V10"/></svg>';
  fitBtn.append(el('span', '', 'Vue d’ensemble'));
  fitBtn.ariaLabel = 'Voir tout le ciel';
  const minus = button('etude-tool', '−', () => zoomBy(1 / 1.25));
  minus.ariaLabel = 'Dézoomer';
  const plus = button('etude-tool', '+', () => zoomBy(1.25));
  plus.ariaLabel = 'Zoomer';
  const level = el('span', 'arbre-level');
  controls.append(minus, level, plus, fitBtn);
  stage.replaceChildren(...(mini ? [world] : [world, controls]));

  let view = !mini && ctx.view() ? { ...ctx.view() } : null, bounds = { x: 0, y: 0, w: 1, h: 1 }, spots = new Map(), groups = new Map();

  // --- Placement -----------------------------------------------------------------------------------------------
  const hash = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0; };
  const rnd = (seed, k) => (hash(`${seed}:${k}`) % 1000) / 1000;
  // La place fixe d'une matière : deux par rangée (le ciel garde la forme de la place libre à côté du panneau),
  // les rangées décalées d'un tiers de place, un léger écart propre à son nom.
  function slot(i, key) {
    const row = Math.floor(i / 2), col = i % 2;
    return [col * SX + (row % 2) * SX / 3 + (rnd(key, 'x') - .5) * 100, row * SY + (rnd(key, 'y') - .5) * 80];
  }
  // Peu de chapitres : la constellation s'étale (comme un vrai ciel), au lieu de tenir dans un petit amas.
  // Calculé une fois par dessin, depuis le contenu seulement : la disposition reste stable.
  let spread = 1;
  // Le départ d'un cours dans sa matière : le premier au centre, les suivants sur une spirale régulière.
  function anchor(center, k, key) {
    if (!k) return [center[0] - 90, center[1] + 10];
    const a = k * 2.4 + rnd(key, 'a') * .6, r = (190 + 70 * Math.sqrt(k - 1)) * spread;
    return [center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r * .75];
  }
  // Les étoiles d'un cours : une marche régulière qui tourne doucement et revient vers son départ si elle s'éloigne.
  function walk(start, n, key) {
    const pts = [start];
    let a = rnd(key, 'dir') * Math.PI * 2;
    for (let j = 1; j < n; j++) {
      const [px, py] = pts[j - 1];
      a += (rnd(key, j) - .5) * 1.5;
      const dx = px - start[0], dy = py - start[1];
      if (Math.hypot(dx, dy) > REACH * spread) a = Math.atan2(-dy, -dx) + (rnd(key, `b${j}`) - .5) * .8;
      const len = (STEP + rnd(key, `l${j}`) * 26) * spread;
      pts.push([px + Math.cos(a) * len, py + Math.sin(a) * len * .8]);
    }
    return pts;
  }
  // Les noms ne se chevauchent pas : à droite de l'étoile si c'est libre, sinon à gauche, dessus ou dessous.
  const taken = [];
  const hits = r => taken.some(t => r.x < t.x + t.w && t.x < r.x + r.w && r.y < t.y + t.h && t.y < r.y + r.h);
  function place(x, y, w, h = 24) {
    const tries = [['d', x + 16, y - h / 2], ['g', x - 16 - w, y - h / 2], ['h', x - w / 2, y - 16 - h], ['b', x - w / 2, y + 16]];
    for (const [side, rx, ry] of tries) { const r = { x: rx, y: ry, w, h }; if (!hits(r)) { taken.push(r); return side; } }
    return null; // aucun côté libre : le nom ne s'affiche qu'au survol, au focus ou une fois l'étoile choisie
  }
  // Largeur estimée d'un nom, plafonnée comme dans etude.css (.cst-txt et .cst-cours : 240 px, .cst-matiere : 300 px).
  const widthOf = (text, size) => Math.min(text.length * size * .5 + 24, size > 20 ? 304 : 264);

  // --- Dessin --------------------------------------------------------------------------------------------------
  function render() {
    const had = labels.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    const subjects = ctx.subjects(), sel = ctx.selected();
    const total = subjects.reduce((n, s) => n + s.courses.reduce((m, c) => m + (ctx.folded(c.id) ? 1 : c.chapters.length), 0), 0);
    spread = total > 14 ? 1 : subjects.length === 1 ? 2.2 : 1.35;
    const lines = [], stars = [], nodes = [];
    spots = new Map();
    groups = new Map();
    taken.length = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const grow = (x, y, pad = 60) => { minX = Math.min(minX, x - pad); maxX = Math.max(maxX, x + pad); minY = Math.min(minY, y - pad); maxY = Math.max(maxY, y + pad); };

    subjects.forEach((s, i) => {
      const center = slot(i, s.key), fold = ctx.folded(s.id), first = nodes.length;
      const merged = s.courses.length === 1 && cahierFold(s.courses[0].title) === s.key;
      const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      const mark = (x, y) => { box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x); box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y); grow(x, y); };
      if (fold) {
        // Matière repliée : une seule étoile, son nom et le nombre de cours.
        stars.push({ x: center[0], y: center[1], big: true });
        mark(center[0], center[1]);
      } else s.courses.forEach((c, k) => {
        const start = anchor(center, k, c.id), cFold = ctx.folded(c.id);
        if (cFold) {
          stars.push({ x: start[0], y: start[1], big: true });
          mark(...start);
          if (!merged) nodes.push({ kind: 'cours', key: c.id, text: c.title, small: plural(c.chapters.length, 'chapitre'), fold: true, x: start[0], y: start[1], w: widthOf(c.title, 15), h: 40 });
          spots.set(c.id, start);
          return;
        }
        const pts = walk(start, c.chapters.length, c.id);
        if (pts.length > 1) lines.push(`M${pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}`);
        if (!merged) nodes.push({ kind: 'cours', key: c.id, text: c.title, small: '', fold: false, x: start[0], y: start[1], w: widthOf(c.title, 15), h: 24 });
        spots.set(c.id, start);
        c.chapters.forEach((ch, j) => {
          const [x, y] = pts[j], on = sel?.course === c.id && sel.chapter === ch.id;
          stars.push({ x, y, on });
          mark(x, y);
          const key = `${c.id}/${ch.id}`, due = ctx.due(c.id, ch.id);
          nodes.push({ kind: 'chapitre', key, text: ch.title, x, y, on, due, linked: ctx.linked(c.id, ch.id), course: c.id, chapter: ch.id, w: widthOf(ch.title, 19) + (due ? 92 : 0) });
          spots.set(key, [x, y]);
        });
      });
      // Le nom de la matière, sous ses étoiles et vers la droite, comme une légende de carte du ciel : jamais sur une étoile.
      const nx = Number.isFinite(box.x0) ? Math.max(box.x0, box.x1 - widthOf(s.name, 30) * .55) : center[0], ny = Number.isFinite(box.y1) ? box.y1 + 70 : center[1] + 70;
      // Dans l'ordre de lecture (et du clavier) : la matière, puis ses cours et ses chapitres.
      nodes.splice(first, 0, { kind: 'matiere', key: s.id, text: s.name, x: nx, y: ny, w: widthOf(s.name, 30), fold, small: fold ? plural(s.courses.length, 'cours') : '' });
      for (const c of s.courses) { const pts = c.chapters.map(ch => spots.get(`${c.id}/${ch.id}`)).filter(Boolean).concat(spots.get(c.id) ? [spots.get(c.id)] : []); if (pts.length) { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); groups.set(c.id, { x: Math.min(...xs) - 60, y: Math.min(...ys) - 80, w: Math.max(...xs) - Math.min(...xs) + 320, h: Math.max(...ys) - Math.min(...ys) + 140 }); } }
      groups.set(s.id, Number.isFinite(box.x0) ? { x: Math.min(box.x0, nx) - 30, y: box.y0 - 60, w: Math.max(box.x1 + 220, nx + widthOf(s.name, 30)) - Math.min(box.x0, nx) + 50, h: ny + 40 - (box.y0 - 60) } : null);
      grow(nx, ny, 40);
      grow(nx + widthOf(s.name, 30), ny, 40);
    });
    if (!Number.isFinite(minX)) { minX = minY = 0; maxX = maxY = 1; }
    bounds = { x: minX - 40, y: minY - 40, w: maxX - minX + 240, h: maxY - minY + 100 }; // les noms débordent à droite des étoiles

    svg.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`);
    Object.assign(svg.style, { left: `${bounds.x}px`, top: `${bounds.y}px`, width: `${bounds.w}px`, height: `${bounds.h}px` });
    // Une étoile de contenu : un cœur clair, un halo discret et quatre rayons fins (ce qui la distingue des étoiles du fond),
    // un anneau quand elle est choisie.
    svg.innerHTML = `<path class="cst-line" d="${lines.join('')}"/>`
      + stars.map(p => {
        const x = p.x.toFixed(1), y = p.y.toFixed(1), r = p.big ? 11 : 9;
        return `<circle class="cst-halo" cx="${x}" cy="${y}" r="${p.big ? 18 : 15}"/><circle class="cst-glow" cx="${x}" cy="${y}" r="${p.big ? 7.5 : 6}"/>`
          + `<path class="cst-spike" d="M${(p.x - r).toFixed(1)} ${y}H${(p.x + r).toFixed(1)}M${x} ${(p.y - r).toFixed(1)}V${(p.y + r).toFixed(1)}"/>`
          + `<circle class="cst-star${p.big ? ' big' : ''}" cx="${x}" cy="${y}" r="${p.big ? 4 : 3.4}"/>${p.on ? `<circle class="cst-ring" cx="${x}" cy="${y}" r="15"/>` : ''}`;
      }).join('');

    // Les matières et les cours d'abord (ils réservent leur place), puis les chapitres autour de leurs étoiles.
    // Réservé d'abord : les noms de matières et les étoiles. Puis les noms de cours, puis ceux des chapitres, chacun du côté libre.
    for (const nd of nodes) if (nd.kind === 'matiere') taken.push({ x: nd.x, y: nd.y - 22, w: nd.w, h: 44 });
    for (const p of stars) taken.push({ x: p.x - 14, y: p.y - 14, w: 28, h: 28 });
    for (const nd of nodes) {
      if (nd.kind !== 'cours') continue;
      // Un nom de cours se pose au-dessus de sa première étoile, sinon dessous, à gauche ou à droite : jamais sur un trait.
      const tries = [[nd.x - nd.w / 2, nd.y - 22 - nd.h], [nd.x - nd.w / 2, nd.y + 22], [nd.x - 22 - nd.w, nd.y - nd.h / 2], [nd.x + 22, nd.y - nd.h / 2]];
      const [rx, ry] = tries.find(([x, y]) => !hits({ x, y, w: nd.w, h: nd.h })) ?? tries[0];
      taken.push({ x: rx, y: ry, w: nd.w, h: nd.h });
      Object.assign(nd, { x: rx, y: ry, tl: true });
    }
    labels.replaceChildren(...nodes.map(nd => {
      if (nd.kind === 'chapitre') {
        const side = place(nd.x, nd.y, nd.w, 32);
        // Choisir une étoile ouvre le panneau, qui peut la recouvrir (en bas sur téléphone) : on la ramène en vue si besoin.
        const b = button(`cst-chap cst-${side ?? 'd'}${side ? '' : ' cst-quiet'}`, '', () => { ctx.select(nd.course, nd.chapter); aim(nd.key); });
        const txt = el('span', 'cst-txt');
        txt.append(el('span', 'cst-name', nd.text));
        if (nd.due) txt.append(el('span', 'cst-due', `${nd.due} à revoir`));
        b.append(el('span', 'cst-hit'), txt);
        b.dataset.key = nd.key;
        b.title = nd.text;
        b.ariaLabel = `${nd.text}${nd.due ? `, ${nd.due} à revoir` : nd.linked ? `, ${plural(nd.linked, 'paquet')}` : ''}`;
        if (nd.on) b.setAttribute('aria-current', 'true');
        if (mini) b.tabIndex = -1;
        Object.assign(b.style, { left: `${nd.x}px`, top: `${nd.y}px` });
        return [b];
      }
      // Matière ou cours : le nom cadre son groupe (et le déplie s'il est replié) ; un petit bouton à côté replie.
      const b = button(`cst-label cst-${nd.kind}${nd.tl ? ' tl' : ''}`, '', () => focusGroup(nd.key, nd.fold));
      b.append(el('span', '', nd.text));
      if (nd.small) b.append(el('small', '', nd.small));
      b.dataset.key = nd.key;
      b.title = nd.text;
      b.ariaLabel = nd.fold ? `${nd.text}, ${nd.small}, déplier et cadrer` : `${nd.text}, cadrer`;
      Object.assign(b.style, { left: `${nd.x}px`, top: `${nd.y}px` });
      if (mini) { b.tabIndex = -1; return [b]; }
      const fold = button('cst-plier', '', () => ctx.toggleFold(nd.key));
      fold.dataset.key = `${nd.key}:plier`;
      fold.setAttribute('aria-expanded', !nd.fold);
      fold.ariaLabel = fold.title = `${nd.fold ? 'Déplier' : 'Replier'} ${nd.text}`;
      Object.assign(fold.style, { left: `${nd.x}px`, top: `${nd.y}px` });
      return [b, fold];
    }).flat());
    if (had) labels.querySelector(`[data-key="${CSS.escape(had)}"]`)?.focus({ preventScroll: true });
  }

  // --- Vue : déplacer, zoomer, cadrer --------------------------------------------------------------------------
  // shortcut: même caméra que l'Arbre (arbre.js), copiée ; la mettre en commun si une 3e présentation en a besoin.
  const clampK = k => Math.max(ZMIN, Math.min(ZMAX, k));
  function apply(animate = false, save = true) {
    world.classList.toggle('gliding', animate && !reduced());
    world.style.transform = `translate(${view.x.toFixed(1)}px,${view.y.toFixed(1)}px) scale(${view.k.toFixed(4)})`;
    // De loin, les noms des chapitres ne se lisent plus : on les masque, les étoiles, les cours et les matières restent.
    stage.dataset.lod = view.k < FAR ? 'loin' : '';
    stage.style.setProperty('--cst-k', view.k.toFixed(4)); // la cible d'une étoile garde 44 px à l'écran, quel que soit le zoom
    if (mini) return;
    level.textContent = `${Math.round(view.k * 100)} %`;
    minus.disabled = view.k <= ZMIN + .001;
    plus.disabled = view.k >= ZMAX - .001;
    if (save) ctx.setView({ ...view });
  }
  // La place libre : mesurée par l'espace (panneau, dock, barre, pastille du menu) ; dans l'aperçu, tout le cadre.
  function room() {
    const r = ctx.room?.() ?? { x: 0, y: 0, w: stage.clientWidth, h: stage.clientHeight };
    return { W: r.w, H: r.h, top: r.y, left: r.x, pad: r.w < 500 ? 16 : 40 };
  }
  function frame(b, animate, floor = ZMIN, cap = 1.4) {
    const { W, H, top, left, pad } = room();
    if (W <= 0 || H <= 0 || !stage.clientWidth) return;
    const k = Math.max(floor, clampK(Math.min((W - pad * 2) / b.w, (H - pad * 2) / b.h, cap)));
    view = { k, x: left + W / 2 - (b.x + b.w / 2) * k, y: top + H / 2 - (b.y + b.h / 2) * k };
    apply(animate);
  }
  const fit = (animate = false, floor = ZMIN) => frame(bounds, animate, mini ? .05 : floor, mini ? 1 : 1.4);
  // S'approcher d'une étoile et la poser au milieu de la place libre ; la choisir encore ne zoome pas plus.
  function aim(key, animate = true) {
    const p = spots.get(key);
    if (!p || !view) return;
    const { W, H, top, left } = room(), k = Math.max(view.k, NEAR);
    view = { k, x: left + W / 2 - p[0] * k, y: top + H / 2 - p[1] * k };
    apply(animate);
  }
  // À l'ouverture : tout le ciel s'il se lit ; sinon (téléphone, beaucoup de cours) la première matière, lisible.
  function opening() {
    if (mini) return fit(false);
    const { W, H, pad } = room();
    const need = Math.min((W - pad * 2) / bounds.w, (H - pad * 2) / bounds.h);
    const first = groups.get(ctx.subjects()[0]?.id);
    if (need < FAR && first) frame(first, false, FAR); else fit(false, FAR);
  }
  function focusGroup(id, folded) {
    if (folded) ctx.toggleFold(id);
    const b = groups.get(id);
    if (b) frame(b, true, FAR);
    ctx.say(`Cadré sur ${ctx.subjects().find(s => s.id === id)?.name ?? 'la matière'}.`);
  }
  function zoomBy(f, cx, cy, animate = true) {
    const r = room();
    cx ??= r.left + r.W / 2;
    cy ??= r.top + r.H / 2;
    const k = clampK(view.k * f);
    view = { k, x: cx - (cx - view.x) * (k / view.k), y: cy - (cy - view.y) * (k / view.k) };
    apply(animate);
  }
  // Amène une étoile dans la partie visible (hors du panneau du chapitre), seulement si elle n'y est pas.
  function show(key, animate = true) {
    const p = spots.get(key);
    if (!p || !view) return;
    const { W, H, top, left } = room(), m = Math.min(100, W / 5);
    const sx = p[0] * view.k + view.x, sy = p[1] * view.k + view.y;
    if (sx >= left + m && sx <= left + W - m && sy >= top + m && sy <= top + H - m) return;
    view.x += left + W / 2 - sx;
    view.y += top + H / 2 - sy;
    apply(animate);
  }

  if (!mini) {
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
    // Le focus au clavier sur une étoile hors champ : on déplace la vue au lieu de laisser le navigateur faire défiler.
    stage.addEventListener('scroll', () => { stage.scrollTop = stage.scrollLeft = 0; }, { signal });
    labels.addEventListener('focusin', e => { if (e.target.matches(':focus-visible')) show(e.target.dataset.key); }, { signal });
  }
  let lastSize = '';
  const resized = new ResizeObserver(() => {
    const size = `${stage.clientWidth}x${stage.clientHeight}`;
    if (size === lastSize) return;
    lastSize = size;
    if (mini || !view) return opening();
    const sel = ctx.selected();
    if (sel) show(`${sel.course}/${sel.chapter}`, false);
  });
  resized.observe(stage);

  render();
  if (view) { view.k = clampK(view.k); apply(false, false); } else opening();
  return {
    update: render,
    reveal() { const s = ctx.selected(); if (s) aim(`${s.course}/${s.chapter}`); },
    leave() { off.abort(); resized.disconnect(); world.remove(); controls.remove(); delete stage.dataset.lod; stage.style.removeProperty('--cst-k'); stage.classList.remove('grabbing'); },
  };
};
