// Présentation « Arbre » de l'espace Study : un arbre dessiné à partir des vrais cours, enraciné en bas, posé sur le fond
// d'écran de la personne (aucun fond plein ici).
// - Un seul cours : l'arbre est ce cours. Ses chapitres sont des branches qui partent du tronc en alternant les côtés,
//   le premier en bas, de plus en plus courtes vers la cime ; le nom de la matière est écrit au pied.
// - Plusieurs cours : tronc → une grosse branche par matière (ou par cours s'il n'y a qu'une matière) → une branche par
//   cours → une branche fine par chapitre. Les branches naissent dans le bois (jonctions sans couture).
// Placement stable : tout dépend de l'ordre des cours et de leurs identifiants, jamais du hasard. Les brindilles et les
// feuilles sont décoratives (dans le dessin, jamais cliquables) ; les libellés sont de vrais boutons posés dessus.
// Caméra : cliquer un chapitre s'en approche et le pose à côté du panneau ; cliquer un cours ou une matière cadre sa
// branche. La place libre est mesurée par l'espace (ctx.room). ctx.apercu : dessin seul, cadré dans le widget, sans
// caméra, sans geste, sans libellé cliquable.
// Contrat : window.etudeVues.arbre(ctx) rend { update, reveal, leave } (voir etude.js).
window.etudeVues.arbre = function arbreVue(ctx) {
  const NS = 'http://www.w3.org/2000/svg';
  const STEP = 34, HEAD = 58, ZMIN = .35, ZMAX = 2.2, FAR = .55, NEAR = 1.15;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const off = new AbortController(), signal = off.signal;
  const { stage } = ctx, mini = !!ctx.apercu;

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
  fitBtn.append(el('span', '', 'Vue d’ensemble'));
  fitBtn.ariaLabel = 'Voir tout l’arbre';
  const minus = button('etude-tool', '−', () => zoomBy(1 / 1.25));
  minus.ariaLabel = 'Dézoomer';
  const plus = button('etude-tool', '+', () => zoomBy(1.25));
  plus.ariaLabel = 'Zoomer';
  const level = el('span', 'arbre-level');
  controls.append(minus, level, plus, fitBtn);
  stage.replaceChildren(...(mini ? [world] : [world, controls]));

  let view = !mini && ctx.view() ? { ...ctx.view() } : null, bounds = { x: 0, y: 0, w: 1, h: 1 }, spots = new Map(), boxes = new Map();
  // L'arbre grandit avec les cours : tronc plus épais et feuillage plus dense à mesure que les chapitres s'ajoutent
  // (maturity, de 0 à 1 vers 60 chapitres). Un cours arrivé depuis la dernière visite pousse sous les yeux (fresh).
  const KNOWN = 'renzvi:arbre-connus';
  let maturity = 1, fresh = new Set(), freshTimer = 0, seen = null;

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
  const widthAt = (w0, w1, t) => w0 + (w1 - w0) * t ** .8;
  // Une branche qui s'affine : un contour plein le long de la courbe, large au départ, fin au bout.
  function limb(p, w0, w1, n = 18) {
    const left = [], right = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, [x, y] = cubic(p, t), [x2, y2] = cubic(p, Math.min(1, t + .01)), [x1, y1] = cubic(p, Math.max(0, t - .01));
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, w = widthAt(w0, w1, t) / 2;
      left.push(`${(x - dy / len * w).toFixed(1)} ${(y + dx / len * w).toFixed(1)}`);
      right.push(`${(x + dy / len * w).toFixed(1)} ${(y - dx / len * w).toFixed(1)}`);
    }
    return `M${left.join('L')}L${right.reverse().join('L')}Z`;
  }
  // Brindilles fines en bout de branche, et quelques feuilles : décor, jamais du contenu.
  function sprigs(x, y, angle, seed, out, depth = 2, len = 30, leaves = null) {
    const r = k => ((seed >>> (k * 5)) & 31) / 31;
    for (let i = 0; i < 2 + (seed & 1); i++) {
      const a = angle + (r(i) - .5) * 1.4, l = len * (.6 + r(i + 2) * .7);
      const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l;
      const mx = x + Math.cos(a - .25) * l * .55, my = y + Math.sin(a - .25) * l * .55;
      out.push(`M${x.toFixed(1)} ${y.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
      if (leaves && depth === 1 && r(i + 4) < .3 + .7 * maturity) leaves.push(leaf(ex, ey, a, (7 + r(i + 3) * 4) * (.75 + .3 * maturity)));
      if (depth > 1) sprigs(ex, ey, a + (r(i + 1) - .5), hash(`${seed}${i}`), out, depth - 1, len * .6, leaves);
    }
  }
  // Une feuille en amande, dans l'axe de sa brindille.
  function leaf(x, y, a, l) {
    const ca = Math.cos(a), sa = Math.sin(a), w = l * .38;
    const tip = [x + ca * l, y + sa * l], s1 = [x + ca * l * .5 - sa * w, y + sa * l * .5 + ca * w], s2 = [x + ca * l * .5 + sa * w, y + sa * l * .5 - ca * w];
    const f = p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    return `M${f([x, y])}Q${f(s1)} ${f(tip)}Q${f(s2)} ${f([x, y])}Z`;
  }

  // --- Dessin --------------------------------------------------------------------------------------------------
  function render() {
    const had = labels.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    const subjects = ctx.subjects(), sel = ctx.selected();
    const wood = [], fine = [], leaves = [], dots = [], nodes = [];
    spots = new Map();
    boxes = new Map();
    const grow = (key, x, y, w = 0) => {
      const b = boxes.get(key) ?? { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      b.x0 = Math.min(b.x0, x - w); b.x1 = Math.max(b.x1, x + w); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y);
      boxes.set(key, b);
    };
    const add = (kind, key, text, px, py, side, extra = {}) => nodes.push({ kind, key, text, x: px, y: py, side, ...extra });
    const solo = subjects.length === 1, only = solo && subjects[0].courses.length === 1 ? subjects[0].courses[0] : null;
    const all = subjects.flatMap(sub => sub.courses);
    maturity = Math.min(1, all.reduce((n, c) => n + c.chapters.length, 0) / 60);
    // Les cours déjà vus sur cet appareil. Première visite : rien ne pousse (tout était déjà là). Ensuite, un cours
    // jamais vu pousse une fois, qu'il arrive au chargement ou pendant que l'espace est ouvert (import depuis la feuille).
    if (!mini && all.length) try {
      if (!seen) {
        const known = JSON.parse(localStorage.getItem(KNOWN) || 'null');
        seen = new Set(Array.isArray(known) ? known : all.map(c => c.id));
      }
      const nouveaux = all.map(c => c.id).filter(id => !seen.has(id));
      if (nouveaux.length) {
        if (!reduced()) { fresh = new Set([...fresh, ...nouveaux]); clearTimeout(freshTimer); freshTimer = setTimeout(() => { fresh = new Set(); }, 2500); }
        nouveaux.forEach(id => seen.add(id));
      }
      localStorage.setItem(KNOWN, JSON.stringify(all.map(c => c.id)));
    } catch {}
    const pousses = [];

    if (only && !ctx.folded(only.id)) {
      // Un seul cours : le tronc porte directement les chapitres.
      const n = only.chapters.length, H = 300 + Math.max(0, n - 1) * 62, seed = hash(only.id);
      // Le tronc monte droit au pied puis ondule légèrement : pas de coude à la base.
      const trunk = [[26, H + 4], [24, H * .7], [36, H * .36], [-6, 0]];
      const tw = (30 + Math.min(10, n)) * (.6 + .4 * maturity);
      only.chapters.forEach((ch, j) => {
        // Le premier chapitre en bas, les suivants plus haut ; les côtés alternent, les branches raccourcissent vers la cime.
        const side = j % 2 ? 1 : -1, y = H * .74 - (n > 1 ? j * (H * .66) / (n - 1) : 0);
        const t = tAt(trunk, 1, y), at = cubic(trunk, t), L = Math.max(78, 168 - j * (90 / Math.max(1, n))) * (1 + ((seed >>> j) & 3) * .04);
        const tip = [at[0] + side * L, at[1] - L * .42];
        const br = [[at[0] - side * 4, at[1] + 8], [at[0] + side * L * .32, at[1] - 2], [at[0] + side * L * .72, at[1] - L * .12], tip];
        wood.push(limb(br, Math.max(5, widthAt(tw, 3, t) * .55), 1.4));
        sprigs(tip[0], tip[1], -Math.PI / 2 + side * .7, hash(`${only.id}${j}`), fine, 2, 26, leaves);
        const on = sel?.course === only.id && sel.chapter === ch.id, key = `${only.id}/${ch.id}`;
        dots.push({ x: tip[0], y: tip[1], on });
        add('chapitre', key, ch.title, tip[0] + side * 14, tip[1], side, { on, course: only.id, chapter: ch.id, due: ctx.due(only.id, ch.id), linked: ctx.linked(only.id, ch.id) });
        spots.set(key, tip);
        for (const k of [only.id, 'tout']) grow(k, tip[0], tip[1], mini ? 150 : 230);
      });
      wood.push(limb(trunk, tw * 1.15, 2.2, 36));
      const crown = cubic(trunk, 1);
      sprigs(crown[0], crown[1], -Math.PI / 2, seed, fine, 3, 34, leaves);
      // Le pied s'évase en deux racines qui partent de l'intérieur du tronc : pas de coupe nette.
      for (const s of [-1, 1]) wood.push(limb([[26 + s * 2, H - 120], [26 + s * 7, H - 34], [26 + s * 26, H - 4], [26 + s * (48 + tw), H + 8]], tw * .44, 1.2, 24));
      // Au pied : la matière, et dessous le cours (son nom cadre l'arbre ; le petit bouton le replie).
      nodes.push({ kind: 'titre', key: 'titre', text: subjects[0].name, x: tw + 64, y: H - 44, side: 1 });
      add('cours', only.id, only.title, tw + 66, H - 8, 1, { fold: false, small: '' });
      spots.set(only.id, crown);
      for (const k of [only.id, 'tout']) { grow(k, crown[0], crown[1] - 70, 120); grow(k, 26, H + 24, 200); }
    } else {
      // Une seule matière : chaque cours devient une grosse branche, la matière est écrite au pied de l'arbre.
      const groups = solo
        ? subjects[0].courses.map(c => ({ id: c.id, courses: [c], merged: true }))
        : subjects.map(s => ({ id: s.id, name: s.name, courses: s.courses, merged: s.courses.length === 1 && cahierFold(s.courses[0].title) === s.key }));
      // L'arbre monte : chaque matière est une branche qui part du tronc vers le haut (environ 52°), courte ; ses cours
      // s'échelonnent le long de cette branche. Les matières se superposent de chaque côté, de bas en haut.
      const COS = .62, SIN = .79, GO = 66, OPEN = 340, ROOT = 220;
      const plan = groups.map(g => {
        const gFold = !g.merged && ctx.folded(g.id);
        const cols = gFold ? [] : g.courses.map(c => ({ c, fold: ctx.folded(c.id) }));
        let d = 64;
        cols.forEach((col, k) => { col.d = d; if (k < cols.length - 1) d += col.fold ? GO : OPEN; });
        const L = gFold ? 110 : d + 24;
        // Hauteur occupée au-dessus de la branche : la plus haute tige de cours (dépliée : tous ses chapitres).
        const tall = Math.max(60, ...cols.map(col => (col.fold ? 54 : HEAD + col.c.chapters.length * STEP)));
        return { g, gFold, cols, L, tall };
      });
      const cursor = { [-1]: 0, 1: 110 };
      plan.forEach((pl, i) => {
        pl.side = i % 2 ? 1 : -1;
        pl.y = -cursor[pl.side];
        // Toute la hauteur de la branche (elle monte) plus ses tiges : deux matières d'un même côté ne se croisent jamais.
        cursor[pl.side] += pl.L * SIN + pl.tall + 56;
      });
      const top = Math.min(...plan.map(pl => pl.y - pl.L * SIN)) - 30;
      const trunkW = (30 + Math.min(14, groups.length * 2)) * (.65 + .35 * maturity);
      const trunk = [[6, ROOT], [-10, ROOT * .4], [10, top * .5], [0, Math.min(top + 120, plan.at(-1).y - 40)]];
      plan.forEach(({ g, gFold, cols, L, side, y }, i) => {
        const tb = cubic(trunk, tAt(trunk, 1, y));
        const end = [tb[0] + side * L * COS, y - L * SIN];
        // La branche naît dans le tronc (elle part de son axe) puis monte en s'écartant un peu : pas de couture.
        const bough = [[tb[0] - side * 4, y + 30], [tb[0] + side * L * .22, y - L * .12], [tb[0] + side * L * .55, y - L * .5], end];
        wood.push(limb(bough, Math.max(12, 20 - i * 1.2), gFold ? 2.4 : 4.5, 28));
        { const mid = cubic(bough, .5); sprigs(mid[0], mid[1], -Math.PI / 2 - side * .6, hash(`${g.id}b`), fine, 2, 22, leaves); }
        if (!g.merged) {
          const count = g.courses.length;
          // Le nom de la matière se pose sous sa branche, près du tronc : jamais sur un cours.
          const at = cubic(bough, .18);
          add('matiere', g.id, g.name, at[0] + side * 26, at[1] + 34, side, { fold: gFold, small: gFold ? `${count} cours` : '' });
          spots.set(g.id, at);
          grow(g.id, at[0], at[1] + 60, 40);
        }
        if (gFold) {
          sprigs(end[0], end[1], -Math.PI / 2 + side * .4, hash(g.id), fine, 2, 30, leaves);
          grow(g.id, end[0], end[1], 120);
          return;
        }
        for (const { c, fold, d } of cols) {
          const base = cubic(bough, tAt(bough, 0, tb[0] + side * d * COS)), seed = hash(c.id), sway = ((seed % 21) - 10) * 1.2;
          const n = fold ? 0 : c.chapters.length, h = fold ? 54 : HEAD + n * STEP;
          const tipX = base[0] + side * 6 + sway, tipY = base[1] - h;
          const pz = fresh.has(c.id) ? { x: base[0], y: base[1], wood: [], fine: [], leaves: [], dots: [] } : null;
          if (pz) pousses.push(pz);
          const W = pz?.wood ?? wood, F = pz?.fine ?? fine, Lv = pz?.leaves ?? leaves, D = pz?.dots ?? dots;
          const stem = [[base[0] - side * 2, base[1] + 6], [base[0] + side * 3, base[1] - h * .35], [tipX + sway * .6, base[1] - h * .65], [tipX, tipY]];
          W.push(limb(stem, 7, 1.3));
          sprigs(tipX, tipY, -Math.PI / 2 + side * .25, seed, F, 2, fold ? 22 : 30, Lv);
          add('cours', c.id, g.merged && !solo ? g.name : c.title, tipX + side * 30, tipY - 12, side, { fold, small: fold ? plural(c.chapters.length, 'chapitre') : '', big: g.merged });
          spots.set(c.id, [tipX, tipY]);
          for (const k of [c.id, g.id]) { grow(k, tipX, tipY - 40, 200); grow(k, base[0], base[1], 40); }
          c.chapters.slice(0, n).forEach((ch, j) => {
            // Le premier chapitre est en bas, près du bois ; les suivants montent le long de la branche.
            const at = cubic(stem, tAt(stem, 1, base[1] - (HEAD - 22) - j * STEP));
            const len = 26 + (j % 2) * 12, tx = at[0] + side * len, ty = at[1] - 9;
            F.push(`M${at[0].toFixed(1)} ${at[1].toFixed(1)}C${(at[0] + side * len * .35).toFixed(1)} ${(at[1] + 1).toFixed(1)} ${(at[0] + side * len * .7).toFixed(1)} ${(at[1] - 3).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`);
            const on = sel?.course === c.id && sel.chapter === ch.id;
            D.push({ x: tx, y: ty, on });
            add('chapitre', `${c.id}/${ch.id}`, ch.title, tx + side * 10, ty, side, { on, course: c.id, chapter: ch.id, due: ctx.due(c.id, ch.id), linked: ctx.linked(c.id, ch.id) });
            spots.set(`${c.id}/${ch.id}`, [tx, ty]);
            for (const k of [c.id, g.id]) grow(k, tx, ty, 200);
          });
        }
      });
      // Le tronc monte jusqu'à la dernière branche et finit en cime ; deux racines s'évasent : l'arbre est posé.
      wood.push(limb(trunk, trunkW, 6, 30));
      { const crown = cubic(trunk, 1); sprigs(crown[0], crown[1], -Math.PI / 2, hash('cime'), fine, 3, 34, leaves); grow('tout', crown[0], crown[1] - 80, 60); }
      for (const s of [-1, 1]) wood.push(limb([[6 + s * 3, ROOT - 70], [6 + s * 8, ROOT - 22], [6 + s * 22, ROOT - 4], [6 + s * (34 + trunkW), ROOT + 6]], trunkW * .6, 1.5));
      if (solo) nodes.push({ kind: 'titre', key: 'titre', text: subjects[0].name, x: trunkW / 2 + 18, y: ROOT - 40, side: 1 });
      grow('tout', 0, ROOT + 30, 160);
      for (const b of boxes.values()) { grow('tout', b.x0, b.y0); grow('tout', b.x1, b.y1); }
    }
    const t = boxes.get('tout') ?? { x0: -160, y0: -40, x1: 160, y1: 300 };
    bounds = { x: t.x0 - 20, y: t.y0 - 60, w: t.x1 - t.x0 + 40, h: t.y1 - t.y0 + 80 };

    svg.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`);
    Object.assign(svg.style, { left: `${bounds.x}px`, top: `${bounds.y}px`, width: `${bounds.w}px`, height: `${bounds.h}px` });
    const dessin = (w, f, l, d) => `<path class="arbre-wood" d="${w.join('')}"/><path class="arbre-fine" d="${f.join('')}"/><path class="arbre-leaf" d="${l.join('')}"/>`
      + d.map(p => `<circle class="arbre-dot${p.on ? ' on' : ''}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.2"/>${p.on ? `<circle class="arbre-ring" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="9"/>` : ''}`).join('');
    // Une pousse grandit depuis son point d'attache (origine en unités du dessin, comptées depuis le coin du viewBox).
    const pousse = (x, y, inner) => `<g class="arbre-pousse" style="transform-origin:${(x - bounds.x).toFixed(1)}px ${(y - bounds.y).toFixed(1)}px">${inner}</g>`;
    const neuf = only && fresh.has(only.id);
    svg.innerHTML = (neuf ? pousse(26, bounds.y + bounds.h - 40, dessin(wood, fine, leaves, dots)) : dessin(wood, fine, leaves, dots))
      + pousses.map(pz => pousse(pz.x, pz.y, dessin(pz.wood, pz.fine, pz.leaves, pz.dots))).join('');

    // Un seul cours : de la place autour de chaque branche, les noms passent sur deux lignes. Sinon, une ligne
    // (les branches sont serrées) ; le titre complet reste dans le nom accessible et le panneau.
    labels.dataset.place = only && !ctx.folded(only.id) ? 'large' : 'serre';
    labels.replaceChildren(...nodes.flatMap(nd => {
      if (nd.kind === 'titre') {
        const t = el('p', 'arbre-label arbre-titre', nd.text);
        Object.assign(t.style, { left: `${nd.x}px`, top: `${nd.y}px` });
        return [t];
      }
      const b = button(`arbre-label arbre-${nd.kind}${nd.big ? ' arbre-big' : ''}`, '', () => (nd.kind === 'chapitre' ? choose(nd) : frameGroup(nd.key, nd.fold)));
      b.append(el('span', '', nd.text));
      if (nd.small) b.append(el('small', '', nd.small));
      b.dataset.key = nd.key;
      b.dataset.side = nd.side > 0 ? 'd' : 'g';
      if (fresh.has(nd.course ?? nd.key)) b.classList.add('arbre-neuf');
      Object.assign(b.style, { left: `${nd.x}px`, top: `${nd.y}px` });
      if (mini) { b.tabIndex = -1; return [b]; }
      if (nd.kind === 'chapitre') {
        if (nd.on) b.setAttribute('aria-current', 'true');
        if (nd.due) { b.append(el('i', 'arbre-due')); b.ariaLabel = `${nd.text}, ${nd.due} à revoir`; }
        return [b];
      }
      b.ariaLabel = `${nd.text}, cadrer${nd.small ? `, ${nd.small}` : ''}`;
      // Replier ou déplier : un petit bouton à côté du nom (le nom, lui, cadre la branche).
      const fold = button('arbre-plier', '', () => ctx.toggleFold(nd.key));
      fold.dataset.key = `${nd.key}:plier`;
      fold.dataset.side = b.dataset.side;
      fold.setAttribute('aria-expanded', !nd.fold);
      fold.ariaLabel = `${nd.fold ? 'Déplier' : 'Replier'} ${nd.text}`;
      Object.assign(fold.style, { left: `${nd.x}px`, top: `${nd.y}px` });
      return [b, fold];
    }));
    if (had) labels.querySelector(`[data-key="${CSS.escape(had)}"]`)?.focus({ preventScroll: true });
  }

  // --- Caméra --------------------------------------------------------------------------------------------------
  const clampK = k => Math.max(ZMIN, Math.min(ZMAX, k));
  // La place libre : mesurée par l'espace (panneau, dock, barre, pastille du menu) ; dans l'aperçu, tout le cadre.
  function room() {
    const r = ctx.room?.();
    return r ?? { x: 0, y: 0, w: stage.clientWidth, h: stage.clientHeight };
  }
  function apply(animate = false, save = true) {
    world.classList.toggle('gliding', animate && !reduced());
    world.style.transform = `translate(${view.x.toFixed(1)}px,${view.y.toFixed(1)}px) scale(${view.k.toFixed(4)})`;
    // De loin, les chapitres ne sont plus lisibles : on les masque au lieu de tout rétrécir. Les matières restent.
    stage.dataset.lod = view.k < FAR && !mini ? 'loin' : '';
    stage.style.setProperty('--arbre-k', view.k.toFixed(4));
    if (mini) return;
    level.textContent = `${Math.round(view.k * 100)} %`;
    minus.disabled = view.k <= ZMIN + .001;
    plus.disabled = view.k >= ZMAX - .001;
    if (save) ctx.setView({ ...view });
  }
  // Cadrer un rectangle du dessin dans la place libre, sans dépasser un zoom confortable.
  function frame(b, animate, floor = ZMIN, cap = 1.5) {
    const r = room(), pad = r.w < 500 ? 16 : 40;
    if (r.w <= 0 || r.h <= 0 || !stage.clientWidth) return;
    const k = Math.max(floor, clampK(Math.min((r.w - pad * 2) / b.w, (r.h - pad * 2) / b.h, cap)));
    view = { k, x: r.x + r.w / 2 - (b.x + b.w / 2) * k, y: r.y + r.h / 2 - (b.y + b.h / 2) * k };
    apply(animate);
  }
  const fit = (animate = false, floor = ZMIN) => frame(bounds, animate, mini ? .05 : floor, mini ? 1 : 1.5);
  // S'approcher d'un point et le poser au milieu de la place libre (donc à côté du panneau, jamais dessous).
  // Choisir encore le même chapitre ne zoome pas plus : le zoom visé est fixe.
  function aim(key, animate = true) {
    const p = spots.get(key);
    if (!p || !view) return;
    const r = room(), k = Math.max(view.k, Math.min(NEAR, ZMAX));
    view = { k, x: r.x + r.w / 2 - p[0] * k, y: r.y + r.h / 2 - p[1] * k };
    apply(animate);
  }
  const boxOf = key => { const b = boxes.get(key); return b && Number.isFinite(b.x0) ? { x: b.x0 - 20, y: b.y0 - 50, w: b.x1 - b.x0 + 40, h: b.y1 - b.y0 + 90 } : null; };
  function frameGroup(key, folded) {
    if (folded) ctx.toggleFold(key);
    const b = boxOf(key);
    if (b) frame(b, true, FAR, 1.4);
  }
  function choose(nd) {
    ctx.select(nd.course, nd.chapter);
    aim(nd.key);
  }
  function zoomBy(f, cx, cy, animate = true) {
    const r = room();
    cx ??= r.x + r.w / 2;
    cy ??= r.y + r.h / 2;
    const k = clampK(view.k * f);
    view = { k, x: cx - (cx - view.x) * (k / view.k), y: cy - (cy - view.y) * (k / view.k) };
    apply(animate);
  }
  // Amène un point dans la place libre seulement s'il n'y est pas (focus clavier, panneau qui s'ouvre).
  function show(key, animate = true) {
    const p = spots.get(key);
    if (!p || !view) return;
    const r = room(), m = Math.min(80, r.w / 5);
    const sx = p[0] * view.k + view.x, sy = p[1] * view.k + view.y;
    if (sx >= r.x + m && sx <= r.x + r.w - m && sy >= r.y + m && sy <= r.y + r.h - m) return;
    aim(key, animate);
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
    // Le focus au clavier sur un libellé hors champ : le navigateur ferait défiler la scène ; on déplace la vue à la place.
    stage.addEventListener('scroll', () => { stage.scrollTop = stage.scrollLeft = 0; }, { signal });
    labels.addEventListener('focusin', e => { if (e.target.matches(':focus-visible')) show(e.target.dataset.key); }, { signal });
  }
  // Taille du cadre changée : l'aperçu se recadre toujours ; la scène garde le chapitre choisi en vue.
  let lastSize = '';
  const resized = new ResizeObserver(() => {
    const size = `${stage.clientWidth}x${stage.clientHeight}`;
    if (size === lastSize) return;
    lastSize = size;
    if (mini || !view) return fit(false, FAR);
    const s = ctx.selected();
    if (s) show(`${s.course}/${s.chapter}`, false);
  });
  resized.observe(stage);

  render();
  // Un cours vient d'arriver : on recule pour voir l'arbre entier pousser.
  if (view && !fresh.size) { view.k = clampK(view.k); apply(false, false); } else fit(false, FAR);
  return {
    update() { const n = fresh.size; render(); if (fresh.size > n) fit(true, FAR); },
    reveal() { const s = ctx.selected(); if (s) aim(`${s.course}/${s.chapter}`); },
    leave() { off.abort(); resized.disconnect(); world.remove(); controls.remove(); delete stage.dataset.lod; stage.classList.remove('grabbing'); },
  };
};
