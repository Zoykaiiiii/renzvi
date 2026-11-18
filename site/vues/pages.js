// Présentation « Pages » (disposition par défaut depuis le 16 nov.) : les widgets d'un mode rangés sur des pages
// horizontales, comme l'écran d'accueil d'un téléphone. Un mode (Study, Chill…) est un usage ; ses pages rangent ses
// widgets. Chaque page est une grille de 12 colonnes sur 6 rangées qui tient dans l'écran ; on passe d'une page à l'autre
// en balayant (défilement horizontal natif, aimanté, qui laisse leurs gestes aux dessins, curseurs et jeux), par les points
// du bas, ou au clavier depuis les points. « + » ajoute une page vide.
// Appui long sur un widget, ou « Disposer les widgets » : édition. On glisse un widget sur les cases, on tire son coin pour
// changer sa taille ; on le tient contre le bord droit ou gauche pour l'emmener sur la page voisine (au-delà de la dernière,
// une page provisoire, gardée seulement si on y pose le widget). Jamais de chevauchement : une place refusée est signalée.
// Sans souris : la liste « Page » de chaque widget en édition le déplace vers une autre page du mode.
// Comme toute présentation (contrat : applyVue dans dashboard.html) : ne crée, ne copie, ne relance aucun widget et ne les
// déplace pas dans la page ; seules des propriétés de style changent, toutes retirées par leave().
// Places enregistrées : { n: nombre de pages, t: noms (vide = « Page N »), d: { id: { p, c, r, w, h } } }
// (page, colonne, rangée, largeur et hauteur en cases). Une page vide créée exprès reste jusqu'à ce qu'on la supprime.
// Sur téléphone (< 728 px), chaque page garde ses widgets, empilés sur toute la largeur ; la page défile en hauteur si besoin.
window.vuePages = function vuePages(ctx) {
  const { board } = ctx;
  const COLS = 12, ROWS = 6, PHONE_COLS = 4, NARROW = 728, PRESS_MS = 500, MOVE_PX = 8, MIN_CELL_H = 64, DOTS_MAX = 9;
  const EDGE_PX = 44, DWELL_MS = 650, MAX_PAGES = 12, MAX_NAME = 24;
  // 4 widgets au plus par page (Damien, 17 nov.) : des widgets plus grands, une page qui respire.
  const MAX_PER_PAGE = 4;
  // Taille minimale utile de chaque widget, en cases (colonnes, rangées), sur la grille de l'ordinateur.
  const MIN = { heure: [3, 1], minuteur: [4, 3], cartes: [4, 3], cahier: [4, 3], etude: [4, 2], vol: [4, 3], semaine: [4, 2], habitudes: [4, 2], ambiance: [4, 3], lecture: [4, 3], inspiration: [4, 3], respiration: [3, 3], playlist: [4, 2], quiz: [4, 3], schemas: [4, 3], repas: [4, 3] };
  // Taille de départ d'un widget qui n'a pas encore de place, selon son préréglage : assez grande pour que 4 widgets
  // remplissent une page (6 × 3 cases chacun en taille moyenne).
  const PRESET = { s: [4, 3], m: [6, 3], l: [12, 3] };
  // Jamais un départ d'appui long : un contrôle, un champ, un texte modifiable, un dessin, un lecteur, une poignée.
  const NEVER = 'button,a,input,textarea,select,label,option,summary,[contenteditable=""],[contenteditable=true],canvas,iframe,video,audio,svg,img,[role=slider],[role=listbox],[role=option],[role=button],[tabindex],.notes,.comet-dial,.pg-move,.pg-size,.pg-to,.pg-remove';
  const off = new AbortController(), signal = off.signal;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = () => innerWidth < NARROW;
  const minOf = id => MIN[id] ?? [3, 2];
  const node = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls, textContent: text ?? '' });
  // Dernière page vue, par mode et par appareil.
  const memoKey = `renzvi:pg:${ctx.mode ?? ''}`;
  const remember = () => { try { localStorage.setItem(memoKey, String(page)); } catch {} };

  let state = clean(ctx.places());
  let page = (() => { try { return Number(localStorage.getItem(memoKey)) || 0; } catch { return 0; } })();
  let editing = false, press = null, gesture = null, m = null, shownN = 1, temp = -1;
  const touched = new Set(), snaps = [], cells = [], empties = [];

  function clean(raw) {
    const d = {};
    for (const [id, q] of Object.entries(raw?.d ?? {})) if (q && [q.p, q.c, q.r, q.w, q.h].every(Number.isInteger) && q.p >= 0) d[id] = { p: q.p, c: q.c, r: q.r, w: q.w, h: q.h };
    const n = clamp(Number.isInteger(raw?.n) && raw.n > 0 ? raw.n : 1, 1, MAX_PAGES);
    const t = Array.from({ length: n }, (_, i) => typeof raw?.t?.[i] === 'string' ? raw.t[i].trim().slice(0, MAX_NAME) : '');
    return { n, t, d };
  }
  const name = p => state.t[p] || `Page ${p + 1}`;
  const overlaps = (a, b) => a.p === b.p && a.c < b.c + b.w && b.c < a.c + a.w && a.r < b.r + b.h && b.r < a.r + a.h;
  const inside = q => q.p >= 0 && q.c >= 0 && q.r >= 0 && q.c + q.w <= COLS && q.r + q.h <= ROWS;
  // Une place est libre si elle tient dans la page, ne chevauche rien, et si la page a encore moins de 4 autres widgets.
  const fits = (d, id, q) => inside(q) && Object.entries(d).every(([o, x]) => o === id || !overlaps(q, x))
    && Object.entries(d).filter(([o, x]) => o !== id && x.p === q.p).length < MAX_PER_PAGE;
  // La première place libre à partir d'une page, rangée après rangée ; la page suivante si celle-ci est pleine.
  function firstFree(d, id, w, h, from = 0) {
    for (let p = from; p < 99; p++) for (let r = 0; r + h <= ROWS; r++) for (let c = 0; c + w <= COLS; c++) {
      const q = { p, c, r, w, h };
      if (fits(d, id, q)) return q;
    }
    return { p: 99, c: 0, r: 0, w, h };
  }
  function startSize(id) {
    const box = ctx.box(id), [w0, h0] = PRESET[box?.dataset.size] ?? PRESET.m, [mw, mh] = minOf(id);
    // Une largeur réglée à la poignée dans la grille habituelle (sur 12 colonnes) est reprise telle quelle.
    return [clamp(Number(box?.dataset.span) || w0, mw, COLS), clamp(h0, mh, ROWS)];
  }
  // Assez de pages pour tous les widgets placés ; les noms suivent.
  function fitPages() {
    const used = Math.max(0, ...Object.values(state.d).map(q => q.p + 1));
    state.n = clamp(Math.max(state.n, used), 1, 99);
    while (state.t.length < state.n) state.t.push('');
    state.t.length = state.n;
  }
  // Chaque widget du mode garde sa place si elle est valide ; sinon (nouveau widget, place abîmée) la première libre,
  // en partant de la page affichée. Rien de ce qui est bien placé ne bouge.
  function seed() {
    const ids = ctx.ids(), d = {}, arrived = [];
    let changed = Object.keys(state.d).some(id => !ids.includes(id));
    for (const id of ids) {
      const q = state.d[id];
      if (!q) continue;
      const [mw, mh] = minOf(id), fixed = { ...q, w: clamp(q.w, mw, COLS), h: clamp(q.h, mh, ROWS) };
      if (fits(d, id, fixed)) { d[id] = fixed; if (fixed.w !== q.w || fixed.h !== q.h) changed = true; } else changed = true;
    }
    for (const id of ids) if (!d[id]) { const [w, h] = startSize(id); d[id] = firstFree(d, id, w, h, state.d[id] ? 0 : page); arrived.push(id); changed = true; }
    state = { n: state.n, t: state.t, d };
    fitPages();
    return { changed, arrived };
  }
  const save = () => { const { n, t, d } = state; ctx.save(structuredClone({ n: temp >= 0 ? n - 1 : n, t: temp >= 0 ? t.slice(0, -1) : t, d })); };

  // Téléphone : chaque page garde ses widgets, dans l'ordre de l'ordinateur, chacun sur toute la largeur.
  function phoneLayout() {
    const d = {};
    let rows = ROWS;
    for (let p = 0; p < state.n; p++) {
      const order = ctx.ids().filter(id => state.d[id]?.p === p).sort((a, b) => state.d[a].r - state.d[b].r || state.d[a].c - state.d[b].c);
      let r = 0;
      for (const id of order) {
        const h = clamp(state.d[id].h, 2, ROWS);
        d[id] = { p, c: 0, r, w: PHONE_COLS, h };
        r += h;
      }
      rows = Math.max(rows, r);
    }
    return { n: state.n, d, rows };
  }

  function measure(rows) {
    const gap = parseFloat(getComputedStyle(board).columnGap) || 16, cols = narrow() ? PHONE_COLS : COLS;
    const W = board.clientWidth, top = board.getBoundingClientRect().top + scrollY;
    // La page tient dans l'écran, sous l'en-tête, avec la place des points en dessous.
    const fit = Math.max(ROWS * MIN_CELL_H + (ROWS - 1) * gap, innerHeight - top - 64);
    const ch = (fit - (ROWS - 1) * gap) / ROWS;
    // Colonne arrondie au 1/64 de pixel supérieur, l'unité du navigateur : une page ne déborde jamais d'un fil sur la suivante.
    return { gap, cols, W, H: rows * ch + (rows - 1) * gap, cw: Math.ceil((W - cols * gap) / cols * 64) / 64, ch };
  }
  // Début réel d'une page dans la rangée, lu sur son repère. Pas « page × largeur » : le navigateur arrondit chaque
  // colonne (1/64 px), l'écart s'accumule de page en page et laissait voir un bout de la page voisine.
  const startOf = p => snaps[p]?.offsetLeft ?? p * (m?.W || 0);
  const nearest = () => {
    let best = 0;
    for (let p = 1; p < shownN; p++) if (Math.abs(startOf(p) - board.scrollLeft) < Math.abs(startOf(best) - board.scrollLeft)) best = p;
    return best;
  };
  const area = (q, cols) => ({ col: `${q.p * cols + q.c + 1} / span ${q.w}`, row: `${q.r + 1} / span ${q.h}` });
  const onPageIds = (p, lay = state) => ctx.ids().filter(id => lay.d[id]?.p === p);
  function paint() {
    const lay = narrow() ? phoneLayout() : { ...state, rows: ROWS };
    m = measure(lay.rows);
    shownN = lay.n;
    page = clamp(page, 0, lay.n - 1);
    board.dataset.vue = 'pages';
    board.style.setProperty('--pg-cols', lay.n * m.cols);
    board.style.setProperty('--pg-rows', lay.rows);
    board.style.setProperty('--pg-cw', `${m.cw}px`);
    board.style.setProperty('--pg-ch', `${m.ch}px`);
    board.style.setProperty('--pg-h', `${m.H}px`);
    for (const id of ctx.ids()) {
      const q = lay.d[id], box = ctx.box(id);
      if (!q || !box) continue;
      const a = area(q, m.cols);
      box.style.gridColumn = a.col;
      box.style.gridRow = a.row;
      touched.add(id);
    }
    // Un repère invisible par page : c'est sur lui que le défilement s'aimante.
    while (snaps.length > lay.n) snaps.pop().remove();
    while (snaps.length < lay.n) { const s = node('div', 'pg-snap'); s.ariaHidden = 'true'; board.prepend(s); snaps.push(s); }
    snaps.forEach((s, p) => { s.style.gridColumn = `${p * m.cols + 1} / span ${m.cols}`; });
    drawEmpties(lay);
    drawCells();
    drawDots();
    board.scrollLeft = startOf(page);
  }

  // Une page sans widget le dit, et propose d'en ajouter un ici. Le mode entier vide garde son propre message.
  function drawEmpties(lay) {
    for (const e of empties.splice(0)) e.remove();
    if (editing || !ctx.ids().length) return;
    for (let p = 0; p < lay.n; p++) {
      if (onPageIds(p, lay).length) continue;
      const box = node('div', 'pg-empty glass');
      box.style.gridColumn = `${p * m.cols + 1} / span ${m.cols}`;
      box.style.gridRow = `1 / span ${Math.min(lay.rows, 3)}`;
      const add = node('button', 'primary', 'Ajouter un widget');
      add.type = 'button';
      add.onclick = () => { goTo(p); ctx.addWidget?.(); };
      box.append(node('p', 'pg-empty-title', `${name(p)} est vide`), node('p', 'pg-empty-text', 'Ajoute un widget ici, ou glisses-en un depuis une autre page en disposant.'), add);
      empties.push(box);
      board.append(box);
    }
  }

  // ---------- Points de pagination ----------
  const dots = node('nav', 'pg-dots');
  dots.ariaLabel = 'Pages du mode';
  dots.dataset.zoomInert = '';
  board.after(dots);
  const label = node('span', 'pg-name');
  label.setAttribute('aria-live', 'polite');
  function goTo(p, focusDot = false) {
    page = clamp(p, 0, shownN - 1);
    board.scrollTo({ left: startOf(page), behavior: reduced() ? 'auto' : 'smooth' });
    remember();
    markDots();
    if (focusDot) dots.querySelector('[aria-current=page]')?.focus();
  }
  function drawDots() {
    dots.replaceChildren();
    const group = node('div', 'pg-group');
    if (shownN > DOTS_MAX) {
      // Trop de pages pour des points lisibles : précédente, « page 2 sur 12 », suivante.
      const prev = node('button', 'pg-step', '‹'), next = node('button', 'pg-step', '›'), where = node('span', 'pg-where');
      prev.type = next.type = 'button';
      prev.ariaLabel = 'Page précédente';
      next.ariaLabel = 'Page suivante';
      prev.onclick = () => goTo(page - 1);
      next.onclick = () => goTo(page + 1);
      where.setAttribute('aria-live', 'polite');
      group.append(prev, where, next);
    } else {
      for (let p = 0; p < shownN; p++) {
        const b = node('button', `pg-dot${p === temp ? ' temp' : ''}`);
        b.type = 'button';
        b.ariaLabel = state.t[p] ? `Aller à la page ${p + 1} : ${state.t[p]}` : `Aller à la page ${p + 1}`;
        b.append(node('i', ''));
        b.onclick = () => goTo(p);
        group.append(b);
      }
    }
    const add = node('button', 'pg-add');
    add.type = 'button';
    add.ariaLabel = 'Ajouter une page';
    add.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>';
    add.disabled = state.n >= MAX_PAGES || temp >= 0;
    add.onclick = () => addPage();
    dots.append(group, add, label);
    markDots();
  }
  function markDots() {
    label.textContent = state.t[page] ? state.t[page] : '';
    label.hidden = !state.t[page];
    const where = dots.querySelector('.pg-where');
    if (where) {
      where.textContent = `${name(page)} · ${page + 1} sur ${shownN}`;
      dots.querySelector('[aria-label="Page précédente"]').disabled = page === 0;
      dots.querySelector('[aria-label="Page suivante"]').disabled = page === shownN - 1;
      return;
    }
    dots.querySelectorAll('.pg-dot').forEach((b, p) => {
      if (p === page) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      b.tabIndex = p === page ? 0 : -1;
    });
  }
  // Au clavier : les flèches passent d'une page à l'autre depuis les points.
  dots.addEventListener('keydown', e => {
    const step = { ArrowLeft: -1, ArrowRight: 1, Home: -99, End: 99 }[e.key];
    if (step == null || !e.target.closest('.pg-group')) return;
    e.preventDefault();
    goTo(page + step, true);
  }, { signal });
  // Le défilement (doigt, pavé tactile, points) dit sur quelle page on est.
  board.addEventListener('scroll', () => {
    cancelPress();
    const p = nearest();
    if (p !== page) { page = p; remember(); markDots(); ctx.say(`${name(page)}, ${page + 1} sur ${shownN}`); }
    if (!('onscrollend' in window)) { clearTimeout(rest); rest = setTimeout(align, 160); }
  }, { signal, passive: true });
  // Au repos, la page est pile dans le cadre. L'aimantation du navigateur le fait d'habitude, mais un geste interrompu
  // (pavé tactile lancé puis lâché, défilement doux coupé par un nouveau rendu) pouvait s'arrêter entre deux pages
  // et couper les widgets des bords. scrollend quand il existe, sinon un court délai sans défilement.
  let rest = 0;
  function align() {
    clearTimeout(rest);
    if (!m || gesture || document.body.classList.contains('dragging')) return;
    page = nearest();
    markDots();
    const want = Math.min(startOf(page), board.scrollWidth - board.clientWidth);
    if (Math.abs(board.scrollLeft - want) > 1) board.scrollTo({ left: want, behavior: reduced() ? 'auto' : 'smooth' });
  }
  board.addEventListener('scrollend', align, { signal });

  // ---------- Pages : ajouter, renommer, supprimer, déplacer un widget ----------
  function addPage() {
    if (state.n >= MAX_PAGES) return ctx.say(`${MAX_PAGES} pages au maximum dans un mode.`);
    state.n++;
    state.t.push('');
    paint();
    save();
    goTo(state.n - 1);
    ctx.say(`${name(state.n - 1)} ajoutée. Elle est vide pour l'instant.`);
    return state.n - 1;
  }
  function renamePage(p, text) {
    if (p < 0 || p >= state.n) return;
    state.t[p] = String(text ?? '').trim().slice(0, MAX_NAME);
    drawDots();
    save();
  }
  // Où vont les widgets d'une page supprimée : la page d'avant (la suivante pour la première).
  const destination = p => p > 0 ? p - 1 : 1;
  function removePage(p) {
    if (state.n < 2 || p < 0 || p >= state.n) return null;
    const to = destination(p), moving = onPageIds(p), target = to > p ? to - 1 : to;
    const d = Object.fromEntries(Object.entries(state.d).filter(([id]) => !moving.includes(id)).map(([id, q]) => [id, { ...q, p: q.p > p ? q.p - 1 : q.p }]));
    state.t.splice(p, 1);
    state.n--;
    // Chaque widget garde sa taille et prend la première place libre de la page d'arrivée (ou des suivantes si elle est pleine).
    const spilled = [];
    for (const id of moving) { const q = state.d[id]; d[id] = firstFree(d, id, q.w, q.h, target); if (d[id].p !== target) spilled.push(id); }
    state.d = d;
    fitPages();
    page = target;
    paint();
    save();
    goTo(target);
    return { moved: moving.length, target, spilled: spilled.length };
  }
  function moveTo(id, p) {
    const q = state.d[id];
    if (!q) return;
    if (p >= state.n) { if (state.n >= MAX_PAGES) return ctx.say(`${MAX_PAGES} pages au maximum dans un mode.`); state.n++; state.t.push(''); p = state.n - 1; }
    if (p === q.p) return;
    const next = firstFree(Object.fromEntries(Object.entries(state.d).filter(([o]) => o !== id)), id, q.w, q.h, p);
    state.d[id] = next;
    fitPages();
    paint();
    if (editing) for (const i of ctx.ids()) handles(i, true);
    save();
    goTo(next.p);
    ctx.say(`${ctx.title(id)} est maintenant sur ${name(next.p)}${next.p !== p ? ` (${name(p)} était pleine)` : ''}.`);
    ctx.box(id)?.querySelector('.pg-to select')?.focus();
  }
  function reveal(id) {
    const q = (narrow() ? phoneLayout() : state).d[id];
    if (q) goTo(q.p);
  }
  function reset() {
    state = { n: 1, t: [''], d: {} };
    page = 0;
    relayout();
    save();
  }

  // ---------- Édition ----------
  const bar = node('div', 'pg-bar');
  bar.setAttribute('role', 'region');
  bar.ariaLabel = 'Disposition des pages';
  bar.dataset.zoomInert = '';
  bar.hidden = true;
  const done = node('button', 'primary', 'Terminer');
  done.type = 'button';
  done.onclick = () => edit(false);
  bar.append(node('p', 'pg-hint', 'Glisse un widget, tiens-le contre un bord pour changer de page, tire son coin pour sa taille.'), done);
  document.body.append(bar);
  const drop = node('div', 'pg-drop');
  drop.ariaHidden = 'true';
  drop.hidden = true;
  // Bords de l'écran pendant un glisser : on y tient le widget pour passer à la page voisine.
  const edges = ['left', 'right'].map(side => { const e = node('div', `pg-edge pg-edge-${side}`); e.ariaHidden = 'true'; e.hidden = true; e.append(node('span', '')); document.body.append(e); return e; });

  // Des cases discrètes sous les widgets, seulement pendant l'édition.
  function drawCells() {
    for (const c of cells.splice(0)) c.remove();
    if (!editing || narrow()) return;
    for (let p = 0; p < state.n; p++) for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = node('div', 'pg-cell');
      cell.ariaHidden = 'true';
      cell.style.gridColumn = `${p * COLS + c + 1}`;
      cell.style.gridRow = `${r + 1}`;
      cells.push(cell);
    }
    board.prepend(...cells);
  }
  function handles(id, on) {
    const box = ctx.box(id);
    if (!box) return;
    box.querySelectorAll(':scope > .pg-move, :scope > .pg-size, :scope > .pg-to, :scope > .pg-remove').forEach(h => h.remove());
    if (!on) return;
    const title = ctx.title(id);
    const move = node('button', 'pg-move');
    move.type = 'button';
    move.ariaLabel = `Déplacer ${title} : flèches pour changer de case, Maj et flèches pour changer sa taille`;
    move.innerHTML = '<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="4.5" cy="2.5" r="1.5"/><circle cx="9.5" cy="2.5" r="1.5"/><circle cx="4.5" cy="7" r="1.5"/><circle cx="9.5" cy="7" r="1.5"/><circle cx="4.5" cy="11.5" r="1.5"/><circle cx="9.5" cy="11.5" r="1.5"/></svg>';
    move.addEventListener('keydown', e => keyMove(e, id), { signal });
    const size = node('button', 'pg-size');
    size.type = 'button';
    size.ariaLabel = `Changer la taille de ${title} : flèches`;
    size.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 7v6H7M13 13 8.5 8.5"/></svg>';
    size.addEventListener('keydown', e => keyMove(e, id, true), { signal });
    // Déplacer vers une page : sans glisser, pour le clavier, un lecteur d'écran ou un geste difficile.
    const to = node('label', 'pg-to');
    const pick = node('select', '');
    pick.ariaLabel = `Déplacer ${title} vers une page`;
    for (let p = 0; p < state.n; p++) pick.append(Object.assign(node('option', '', name(p)), { value: String(p) }));
    if (state.n < MAX_PAGES) pick.append(Object.assign(node('option', '', 'Nouvelle page'), { value: String(state.n) }));
    pick.value = String(state.d[id]?.p ?? 0);
    pick.onchange = () => moveTo(id, Number(pick.value));
    to.append(pick);
    // Retirer de la page (demande de Damien : à la place de la poignée en pointillés, qui ne sert plus qu'au clavier).
    // Le widget quitte cette page seulement : son contenu, ses données et les autres modes ne changent pas.
    const del = node('button', 'pg-remove');
    del.type = 'button';
    del.ariaLabel = `Retirer ${title} de la page`;
    del.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path class="pg-lid" d="M2.5 4.5h11M6.5 4.5V3h3v1.5"/><path d="M4 4.5l.7 8.5h6.6l.7-8.5M6.8 7v4M9.2 7v4"/></svg>';
    del.addEventListener('click', () => ctx.remove?.(id), { signal });
    box.append(del, move, size, to);
  }
  function edit(on) {
    if (on === editing) return;
    if (on && narrow()) { ctx.say('Pour disposer tes pages, ouvre Renzvi sur un écran plus large.'); return; }
    if (!on) endGesture();
    editing = on;
    document.body.classList.toggle('pages-editing', on);
    bar.hidden = !on;
    for (const id of ctx.ids()) handles(id, on);
    drawEmpties(narrow() ? phoneLayout() : { ...state, rows: ROWS });
    drawCells();
    drawDots();
    if (on) { done.focus(); ctx.say('Disposition : glisse un widget, ou utilise ses poignées au clavier.'); }
    else ctx.say('Disposition terminée.');
  }

  // Place proposée pendant un geste : verte si elle est libre, rouge et refusée sinon.
  function showDrop(q, ok) {
    const a = area(q, COLS);
    drop.style.gridColumn = a.col;
    drop.style.gridRow = a.row;
    drop.classList.toggle('bad', !ok);
    drop.textContent = ok ? '' : 'Place occupée';
    if (!drop.isConnected) board.append(drop);
    drop.hidden = false;
  }
  // Glissement fluide vers la nouvelle place : transform seulement.
  function settle(box, before) {
    const after = box.getBoundingClientRect();
    if (reduced() || !before) return;
    box.animate([{ transform: `translate(${before.left - after.left}px,${before.top - after.top}px)` }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.22,1,.36,1)' });
  }
  function commit(id, q, verb) {
    state.d[id] = q;
    fitPages();
    paint();
    if (editing) for (const i of ctx.ids()) handles(i, true);
    save();
    ctx.say(`${ctx.title(id)} ${verb} : ${name(q.p)}, colonne ${q.c + 1}, rangée ${q.r + 1}, ${q.w} colonnes sur ${q.h} rangées.`);
  }
  // Page provisoire au-delà de la dernière : elle n'existe que le temps du glisser.
  function openTemp() {
    if (temp >= 0 || state.n >= MAX_PAGES) return false;
    temp = state.n;
    state.n++;
    state.t.push('');
    paint();
    return true;
  }
  function closeTemp(keep) {
    if (temp < 0) return;
    temp = -1;
    if (keep) return;
    state.n--;
    state.t.length = state.n;
    if (page >= state.n) page = state.n - 1;
    paint();
  }

  const unfloat = box => { for (const k of ['position', 'left', 'top', 'width', 'height', 'margin', 'zIndex', 'transform']) box.style[k] = ''; };
  function startDrag(box, pointerId, x0, y0) {
    const id = box.dataset.widget, from = { ...state.d[id] }, fromPage = page;
    if (!from.w) return;
    const start = box.getBoundingClientRect(), origin = board.getBoundingClientRect();
    let moved = false, q = from, ok = true, lastX = x0, lastY = y0, dwell = null, side = '', armX = 0;
    try { box.setPointerCapture(pointerId); } catch { return; }
    // La case visée : celle où tombe le coin haut-gauche du widget, sur la page affichée (pas sur le défilement en cours).
    const aim = () => {
      const c = Math.round((start.left + lastX - x0 - origin.left) / (m.cw + m.gap));
      const r = Math.round((start.top + lastY - y0 - origin.top) / (m.ch + m.gap));
      const next = { p: page, c: clamp(c, 0, COLS - from.w), r: clamp(r, 0, ROWS - from.h), w: from.w, h: from.h };
      if (next.c === q.c && next.r === q.r && next.p === q.p) return;
      q = next;
      ok = fits(state.d, id, q);
      showDrop(q, ok);
    };
    const stopDwell = () => { clearTimeout(dwell); dwell = null; side = ''; for (const e of edges) e.classList.remove('on'); };
    // Tenu contre un bord : après un court instant, une seule page de plus ; le widget reste dans la main.
    const watchEdge = () => {
      const right = lastX >= Math.min(innerWidth, origin.right) - EDGE_PX, left = lastX <= Math.max(0, origin.left) + EDGE_PX;
      const want = right ? 'right' : left && page > 0 ? 'left' : '';
      // Un widget qu'on ramène vers le milieu ne compte pas comme tenu contre le bord, même s'il y est encore.
      const leaving = want && want === side && (want === 'right' ? lastX < armX - 8 : lastX > armX + 8);
      if (want === side && !leaving) return;
      if (leaving) { stopDwell(); return; }
      stopDwell();
      if (!want) return;
      side = want;
      armX = lastX;
      const edge = edges[want === 'left' ? 0 : 1];
      edge.firstChild.textContent = want === 'left' ? name(page - 1) : page + 1 < state.n ? name(page + 1) : temp >= 0 || state.n >= MAX_PAGES ? 'Dernière page' : 'Nouvelle page';
      edge.classList.add('on');
      dwell = setTimeout(() => {
        dwell = null;
        if (want === 'left') goTo(page - 1);
        else if (page + 1 < state.n) goTo(page + 1);
        else if (openTemp()) goTo(state.n - 1);
        q = { ...q, p: -1 };
        aim();
        // Rester contre le bord demande un nouvel instant pour la page d'après.
        side = '';
        edge.classList.remove('on');
      }, DWELL_MS);
    };
    const move = e => {
      if (e.pointerId !== pointerId) return;
      lastX = e.clientX; lastY = e.clientY;
      const dx = lastX - x0, dy = lastY - y0;
      if (!moved && Math.hypot(dx, dy) < LAYOUT_DRAG_PX) return;
      if (!moved) {
        moved = true;
        box.classList.add('lifted');
        document.body.classList.add('dragging');
        for (const ed of edges) ed.hidden = false;
        // Le widget tenu flotte au-dessus de l'écran : la page qui défile ne le rogne pas. Ses voisins ont des places
        // fixes, rien ne bouge derrière lui ; sa taille ne change pas, son contenu non plus.
        Object.assign(box.style, { position: 'fixed', left: `${start.left}px`, top: `${start.top}px`, width: `${start.width}px`, height: `${start.height}px`, margin: '0', zIndex: '50' });
      }
      box.style.transform = `translate(${dx}px,${dy}px)`;
      watchEdge();
      aim();
    };
    const finish = keep => {
      box.removeEventListener('pointermove', move);
      box.removeEventListener('pointerup', up);
      box.removeEventListener('pointercancel', cancel);
      box.removeEventListener('lostpointercapture', lost);
      if (box.hasPointerCapture(pointerId)) box.releasePointerCapture(pointerId);
      stopDwell();
      for (const ed of edges) ed.hidden = true;
      gesture = null;
      drop.hidden = true;
      if (!moved) return;
      const before = box.getBoundingClientRect();
      box.classList.remove('lifted');
      document.body.classList.remove('dragging');
      unfloat(box);
      const same = q.p === from.p && q.c === from.c && q.r === from.r;
      const placed = keep && ok && q.p >= 0 && !same;
      // La page provisoire ne reste que si le widget y est posé.
      closeTemp(placed && q.p === temp);
      if (placed) commit(id, q, 'est posé');
      else {
        if (keep && !ok) ctx.say(`Cette place est occupée : ${ctx.title(id)} reste où il était.`);
        else if (!keep) ctx.say(`Déplacement annulé : ${ctx.title(id)} reste où il était.`);
        // Annulé ou refusé : retour à la page de départ, rien d'enregistré.
        if (page !== fromPage) goTo(fromPage);
      }
      settle(box, before);
    };
    const up = e => { if (e.pointerId === pointerId) finish(true); };
    const cancel = e => { if (!e || e.pointerId === pointerId) finish(false); };
    const lost = e => { if (e.target === box) cancel(e); };
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerup', up);
    box.addEventListener('pointercancel', cancel);
    box.addEventListener('lostpointercapture', lost);
    gesture = { cancel };
  }

  function startResize(e, box) {
    const id = box.dataset.widget, from = { ...state.d[id] }, [mw, mh] = minOf(id);
    const origin = board.getBoundingClientRect();
    const left = origin.left - board.scrollLeft + (from.p * COLS + from.c) * (m.cw + m.gap), top = origin.top + from.r * (m.ch + m.gap);
    let last = from, resizing = false;
    e.preventDefault();
    e.stopPropagation();
    const grip = e.target.closest('.pg-size');
    grip.setPointerCapture(e.pointerId);
    const move = ev => {
      if (ev.pointerId !== e.pointerId) return;
      if (!resizing) {
        if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < LAYOUT_DRAG_PX) return;
        resizing = true;
        box.classList.add('resizing');
        document.body.classList.add('layout-resizing');
      }
      const w = clamp(Math.round((ev.clientX - left + m.gap) / (m.cw + m.gap)), mw, COLS - from.c);
      const h = clamp(Math.round((ev.clientY - top + m.gap) / (m.ch + m.gap)), mh, ROWS - from.r);
      const q = { ...from, w, h };
      if (q.w === last.w && q.h === last.h) return;
      // Une taille libre s'applique tout de suite (le contenu suit) ; une taille qui toucherait un voisin est montrée, refusée.
      if (fits(state.d, id, q)) {
        last = q;
        state.d[id] = q;
        const a = area(q, COLS);
        box.style.gridColumn = a.col;
        box.style.gridRow = a.row;
        drop.hidden = true;
      } else showDrop(q, false);
    };
    const finish = keep => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', cancel);
      grip.removeEventListener('lostpointercapture', cancel);
      if (grip.hasPointerCapture(e.pointerId)) grip.releasePointerCapture(e.pointerId);
      gesture = null;
      if (!resizing) return;
      drop.hidden = true;
      box.classList.remove('resizing');
      document.body.classList.remove('layout-resizing');
      if (!keep) { state.d[id] = from; paint(); ctx.say('Taille annulée.'); return; }
      if (last.w !== from.w || last.h !== from.h) commit(id, last, 'change de taille');
    };
    const up = ev => { if (ev.pointerId === e.pointerId) finish(true); };
    const cancel = ev => { if (!ev || ev.pointerId === e.pointerId) finish(false); };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', cancel);
    grip.addEventListener('lostpointercapture', cancel);
    gesture = { cancel };
  }
  function endGesture() { gesture?.cancel(); }

  // Clavier : flèches pour changer de case, Maj et flèches (ou la poignée de taille) pour la taille.
  function keyMove(e, id, sizing = false) {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const q = state.d[id], [mw, mh] = minOf(id);
    const next = sizing || e.shiftKey
      ? { ...q, w: clamp(q.w + d[0], mw, COLS), h: clamp(q.h + d[1], mh, ROWS) }
      : { ...q, c: q.c + d[0], r: q.r + d[1] };
    if (next.c === q.c && next.r === q.r && next.w === q.w && next.h === q.h) return ctx.say('Taille minimale ou maximale atteinte.');
    if (!fits(state.d, id, next)) return ctx.say(inside(next) ? 'Place occupée.' : 'Bord de la page. Pour changer de page, utilise la liste « Page » du widget.');
    const box = ctx.box(id), before = box.getBoundingClientRect();
    commit(id, next, sizing || e.shiftKey ? 'change de taille' : 'est déplacé');
    settle(box, before);
    box.querySelector(sizing ? '.pg-size' : '.pg-move')?.focus();
  }

  board.addEventListener('pointerdown', e => {
    if (!editing || gesture || !e.isPrimary || e.button !== 0) return;
    const box = e.target.closest('.widget');
    // Toucher le fond pendant l'édition la termine, comme sur un téléphone.
    if (!box) { if (e.target === board || e.target.classList.contains('pg-cell')) edit(false); return; }
    if (box.parentElement !== board || box.classList.contains('zoomed')) return;
    if (e.target.closest('.pg-size')) return startResize(e, box);
    if (!e.target.closest('.pg-move') && !moveSurface(e.target, box)) return;
    e.preventDefault();
    startDrag(box, e.pointerId, e.clientX, e.clientY);
  }, { signal });
  // Pendant un glissement au doigt, la page ne défile pas.
  board.addEventListener('touchmove', e => { if (gesture) e.preventDefault(); }, { signal, passive: false });

  // ---------- Appui long : entrer en édition depuis un widget ----------
  const ring = node('div', 'lp-ring');
  document.body.append(ring);
  function surface(t, box) {
    if (!(t instanceof Element)) return false;
    return t === box || t.parentElement === box && t.classList.contains('body') || moveSurface(t, box);
  }
  function moveSurface(t, box) {
    return !t.closest(NEVER) && t.closest('.head')?.parentElement === box;
  }
  const blocked = () => !!document.querySelector('dialog[open], .widget.zoomed') || document.documentElement.classList.contains('zoom-lock') || document.body.classList.contains('customizing');
  function cancelPress() {
    if (!press) return;
    clearTimeout(press.timer);
    clearTimeout(press.show);
    ring.classList.remove('on');
    press = null;
  }
  board.addEventListener('pointerdown', e => {
    if (editing || press || e.button !== 0 || !e.isPrimary || narrow() || blocked()) return;
    const box = e.target.closest('.widget');
    if (!box || box.parentElement !== board || !surface(e.target, box)) return;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, box };
    press.show = setTimeout(() => {
      ring.style.left = `${press.x}px`;
      ring.style.top = `${press.y}px`;
      ring.classList.add('on');
    }, 140);
    press.timer = setTimeout(() => {
      const { box: b, id, x, y } = press;
      cancelPress();
      if (blocked()) return;
      navigator.vibrate?.(10);
      edit(true);
      // Le doigt est encore posé : le widget suit tout de suite, sans relâcher.
      startDrag(b, id, x, y);
    }, PRESS_MS);
  }, { signal });
  addEventListener('pointermove', e => { if (press && e.pointerId === press.id && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_PX) cancelPress(); }, { signal });
  addEventListener('pointerup', cancelPress, { signal });
  addEventListener('pointercancel', cancelPress, { signal });
  document.addEventListener('selectionchange', () => { if (press && String(getSelection()).length) cancelPress(); }, { signal });
  addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !editing || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    if (gesture) endGesture(); else edit(false);
  }, { signal });

  // Fenêtre tournée ou redimensionnée, menu latéral replié : les cases se recalculent, on reste sur la même page.
  let frame = 0;
  const repaint = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => { if (editing && narrow()) edit(false); paint(); });
  };
  addEventListener('resize', repaint, { signal });
  const widths = new ResizeObserver(() => { if (m && board.clientWidth !== m.W) repaint(); });
  widths.observe(board);

  function relayout() {
    const { changed, arrived } = seed();
    paint();
    if (editing) for (const id of ctx.ids()) handles(id, true);
    if (changed) save();
    // Un widget qu'on vient d'ajouter se montre, même si sa page était pleine et qu'il est allé sur la suivante.
    if (arrived.length === 1 && state.d[arrived[0]].p !== page && ctx.ids().length > 1) { reveal(arrived[0]); ctx.say(`${ctx.title(arrived[0])} est sur ${name(state.d[arrived[0]].p)}.`); }
  }

  function leave() {
    widths.disconnect();
    cancelAnimationFrame(frame);
    clearTimeout(rest);
    endGesture();
    if (editing) edit(false);
    off.abort();
    cancelPress();
    for (const id of touched) {
      const box = ctx.box(id);
      if (!box) continue;
      box.style.gridColumn = box.style.gridRow = '';
      unfloat(box);
      box.classList.remove('lifted', 'resizing');
      handles(id, false);
    }
    for (const n of [...snaps, ...cells, ...empties, ...edges, drop, dots, bar, ring]) n.remove();
    document.body.classList.remove('dragging', 'pages-editing');
    board.removeAttribute('data-vue');
    for (const v of ['--pg-cols', '--pg-rows', '--pg-cw', '--pg-ch', '--pg-h']) board.style.removeProperty(v);
    board.scrollLeft = 0;
  }

  relayout();
  // Annuler un retrait : le widget revient à sa place d'avant si elle est encore libre, sinon à la première place libre.
  function placeAgain(id, q) {
    if (q && [q.p, q.c, q.r, q.w, q.h].every(Number.isInteger) && q.p < state.n && fits(state.d, id, q)) state.d[id] = { ...q };
    relayout();
  }
  return {
    relayout, leave, edit, reveal, reset, placeAgain,
    place: id => state.d[id] ? { ...state.d[id] } : null,
    // Pour le panneau Personnaliser : les pages du mode, celle affichée, et leur gestion.
    pages: () => Array.from({ length: state.n - (temp >= 0 ? 1 : 0) }, (_, p) => ({ name: name(p), custom: !!state.t[p], count: onPageIds(p).length })),
    current: () => page,
    destination: p => destination(p),
    add: addPage, rename: renamePage, remove: removePage, goTo: p => goTo(p), max: MAX_PAGES, perPage: MAX_PER_PAGE,
  };
};
