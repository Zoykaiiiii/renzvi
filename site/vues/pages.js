// Présentation « Pages » (labo ?vues=1) : les widgets d'un mode rangés sur des pages horizontales, comme l'écran d'accueil
// d'un téléphone. Un mode (Study, Chill…) est un usage ; ses pages rangent ses widgets. Chaque page est une grille de
// 12 colonnes sur 6 rangées qui tient dans l'écran ; on passe d'une page à l'autre en balayant (défilement horizontal
// natif, aimanté, qui laisse leurs gestes aux dessins, curseurs et jeux) ou par les points du bas.
// Appui long sur un widget, ou « Disposer les widgets » : édition. On glisse un widget sur les cases, on tire son coin pour
// changer sa taille. Jamais de chevauchement : une place refusée est signalée, rien n'est déplacé d'office ni enregistré.
// Comme toute présentation (contrat : applyVue dans dashboard.html) : ne crée, ne copie, ne relance aucun widget et ne les
// déplace pas dans la page ; seules des propriétés de style changent, toutes retirées par leave().
// Places enregistrées : { n: nombre de pages, d: { id: { p, c, r, w, h } } } (page, colonne, rangée, largeur et hauteur en cases).
// Sur téléphone (< 728 px), la disposition est dérivée de celle de l'ordinateur, un widget par rangée, sans édition (lot 3).
window.vuePages = function vuePages(ctx) {
  const { board } = ctx;
  const COLS = 12, ROWS = 6, PHONE_COLS = 4, NARROW = 728, PRESS_MS = 500, MOVE_PX = 8, MIN_CELL_H = 64, DOTS_MAX = 9;
  // Taille minimale utile de chaque widget, en cases (colonnes, rangées), sur la grille de l'ordinateur.
  const MIN = { heure: [3, 1], minuteur: [4, 3], cartes: [4, 3], cahier: [4, 3], etude: [4, 2], vol: [4, 3], semaine: [4, 2], habitudes: [4, 2], ambiance: [4, 3], lecture: [4, 3], inspiration: [4, 3], respiration: [3, 3], playlist: [4, 2], quiz: [4, 3], schemas: [4, 3], repas: [4, 3] };
  // Taille de départ d'un widget qui n'a pas encore de place : celle de son préréglage dans la grille habituelle.
  const PRESET = { s: [3, 2], m: [4, 3], l: [8, 3] };
  // Jamais un départ d'appui long : un contrôle, un champ, un texte modifiable, un dessin, un lecteur, une poignée.
  const NEVER = 'button,a,input,textarea,select,label,option,summary,[contenteditable=""],[contenteditable=true],canvas,iframe,video,audio,svg,img,[role=slider],[role=listbox],[role=option],[role=button],[tabindex],.notes,.comet-dial,.pg-move,.pg-size';
  const off = new AbortController(), signal = off.signal;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = () => innerWidth < NARROW;
  const minOf = id => MIN[id] ?? [3, 2];
  const node = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls, textContent: text ?? '' });

  let state = clean(ctx.places());
  let page = 0, editing = false, press = null, gesture = null, m = null, shownN = 1;
  const touched = new Set(), snaps = [], cells = [];

  function clean(raw) {
    const d = {};
    for (const [id, q] of Object.entries(raw?.d ?? {})) if (q && [q.p, q.c, q.r, q.w, q.h].every(Number.isInteger)) d[id] = { p: q.p, c: q.c, r: q.r, w: q.w, h: q.h };
    return { n: Number.isInteger(raw?.n) && raw.n > 0 ? raw.n : 1, d };
  }
  const overlaps = (a, b) => a.p === b.p && a.c < b.c + b.w && b.c < a.c + a.w && a.r < b.r + b.h && b.r < a.r + a.h;
  const inside = q => q.p >= 0 && q.c >= 0 && q.r >= 0 && q.c + q.w <= COLS && q.r + q.h <= ROWS;
  const fits = (d, id, q) => inside(q) && Object.entries(d).every(([o, x]) => o === id || !overlaps(q, x));
  // La première place libre, page après page, rangée après rangée ; une page de plus si tout est plein.
  function firstFree(d, id, w, h) {
    for (let p = 0; p < 99; p++) for (let r = 0; r + h <= ROWS; r++) for (let c = 0; c + w <= COLS; c++) {
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
  // Les pages vides disparaissent ; la numérotation se resserre.
  function prune() {
    const used = [...new Set(Object.values(state.d).map(q => q.p))].sort((a, b) => a - b);
    const to = new Map(used.map((p, i) => [p, i]));
    const changed = used.some((p, i) => p !== i) || state.n !== Math.max(1, used.length);
    for (const q of Object.values(state.d)) q.p = to.get(q.p);
    state.n = Math.max(1, used.length);
    return changed;
  }
  // Chaque widget de la page garde sa place si elle est valide ; sinon (nouveau widget, place abîmée) la première libre.
  // Rien de ce qui est bien placé ne bouge.
  function seed() {
    const ids = ctx.ids(), d = {};
    let changed = Object.keys(state.d).some(id => !ids.includes(id));
    for (const id of ids) {
      const q = state.d[id];
      if (!q) continue;
      const [mw, mh] = minOf(id), fixed = { ...q, w: clamp(q.w, mw, COLS), h: clamp(q.h, mh, ROWS) };
      if (fits(d, id, fixed)) { d[id] = fixed; if (fixed.w !== q.w || fixed.h !== q.h) changed = true; } else changed = true;
    }
    for (const id of ids) if (!d[id]) { const [w, h] = startSize(id); d[id] = firstFree(d, id, w, h); changed = true; }
    state = { n: state.n, d };
    return prune() || changed;
  }
  const save = () => ctx.save(structuredClone(state));

  // Téléphone : les widgets dans l'ordre de l'ordinateur, chacun sur toute la largeur, page après page.
  function phoneLayout() {
    const order = ctx.ids().filter(id => state.d[id]).sort((a, b) => {
      const A = state.d[a], B = state.d[b];
      return A.p - B.p || A.r - B.r || A.c - B.c;
    });
    const d = {};
    let p = 0, r = 0;
    for (const id of order) {
      const h = clamp(state.d[id].h, 2, ROWS);
      if (r + h > ROWS) { p++; r = 0; }
      d[id] = { p, c: 0, r, w: PHONE_COLS, h };
      r += h;
    }
    return { n: p + 1, d };
  }

  function measure() {
    const gap = parseFloat(getComputedStyle(board).columnGap) || 16, cols = narrow() ? PHONE_COLS : COLS;
    const W = board.clientWidth, top = board.getBoundingClientRect().top + scrollY;
    // La page tient dans l'écran, sous l'en-tête, avec la place des points en dessous.
    const H = Math.max(ROWS * MIN_CELL_H + (ROWS - 1) * gap, innerHeight - top - 64);
    return { gap, cols, W, H, cw: (W - cols * gap) / cols, ch: (H - (ROWS - 1) * gap) / ROWS };
  }
  const area = (q, cols) => ({ col: `${q.p * cols + q.c + 1} / span ${q.w}`, row: `${q.r + 1} / span ${q.h}` });
  function paint() {
    m = measure();
    const lay = narrow() ? phoneLayout() : state;
    shownN = lay.n;
    page = clamp(page, 0, lay.n - 1);
    board.dataset.vue = 'pages';
    board.style.setProperty('--pg-cols', lay.n * m.cols);
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
    drawCells();
    drawDots();
    board.scrollLeft = page * m.W;
  }

  // ---------- Points de pagination ----------
  const dots = node('nav', 'pg-dots');
  dots.ariaLabel = 'Pages du mode';
  dots.dataset.zoomInert = '';
  board.after(dots);
  function goTo(p, focusDot = false) {
    page = clamp(p, 0, shownN - 1);
    board.scrollTo({ left: page * m.W, behavior: reduced() ? 'auto' : 'smooth' });
    markDots();
    if (focusDot) dots.querySelector('[aria-current=page]')?.focus();
  }
  function drawDots() {
    dots.hidden = shownN < 2 && !editing;
    dots.replaceChildren();
    if (shownN > DOTS_MAX) {
      // Trop de pages pour des points lisibles : précédente, « page 2 sur 12 », suivante.
      const prev = node('button', 'pg-step', '‹'), next = node('button', 'pg-step', '›'), where = node('span', 'pg-where');
      prev.type = next.type = 'button';
      prev.ariaLabel = 'Page précédente';
      next.ariaLabel = 'Page suivante';
      prev.onclick = () => goTo(page - 1);
      next.onclick = () => goTo(page + 1);
      where.setAttribute('aria-live', 'polite');
      dots.append(prev, where, next);
    } else {
      for (let p = 0; p < shownN; p++) {
        const b = node('button', 'pg-dot');
        b.type = 'button';
        b.ariaLabel = `Aller à la page ${p + 1}`;
        b.append(node('i', ''));
        b.onclick = () => goTo(p);
        dots.append(b);
      }
    }
    markDots();
  }
  function markDots() {
    const where = dots.querySelector('.pg-where');
    if (where) {
      where.textContent = `Page ${page + 1} sur ${shownN}`;
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
    if (step == null) return;
    e.preventDefault();
    goTo(page + step, true);
  }, { signal });
  // Le défilement (doigt, pavé tactile, points) dit sur quelle page on est.
  board.addEventListener('scroll', () => {
    cancelPress();
    const p = clamp(Math.round(board.scrollLeft / (m?.W || 1)), 0, shownN - 1);
    if (p !== page) { page = p; markDots(); ctx.say(`Page ${page + 1} sur ${shownN}`); }
  }, { signal, passive: true });

  // ---------- Édition ----------
  const bar = node('div', 'pg-bar');
  bar.setAttribute('role', 'region');
  bar.ariaLabel = 'Disposition des pages';
  bar.dataset.zoomInert = '';
  bar.hidden = true;
  const done = node('button', 'primary', 'Terminer');
  done.type = 'button';
  done.onclick = () => edit(false);
  bar.append(node('p', 'pg-hint', 'Glisse un widget pour le déplacer, tire son coin pour changer sa taille.'), done);
  document.body.append(bar);
  const drop = node('div', 'pg-drop');
  drop.ariaHidden = 'true';
  drop.hidden = true;

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
    box.querySelectorAll(':scope > .pg-move, :scope > .pg-size').forEach(h => h.remove());
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
    box.append(move, size);
  }
  function edit(on) {
    if (on === editing) return;
    if (on && narrow()) { ctx.say('Pour disposer tes pages, ouvre Renzvi sur un écran plus large.'); return; }
    if (!on) endGesture(false);
    editing = on;
    document.body.classList.toggle('pages-editing', on);
    bar.hidden = !on;
    for (const id of ctx.ids()) handles(id, on);
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
    prune();
    paint();
    save();
    ctx.say(`${ctx.title(id)} ${verb} : page ${q.p + 1}, colonne ${q.c + 1}, rangée ${q.r + 1}, ${q.w} colonnes sur ${q.h} rangées.`);
  }

  const unfloat = box => { for (const k of ['position', 'left', 'top', 'width', 'height', 'margin', 'zIndex', 'transform']) box.style[k] = ''; };
  function startDrag(box, pointerId, x0, y0) {
    const id = box.dataset.widget, from = { ...state.d[id] };
    if (!from.w) return;
    const start = box.getBoundingClientRect(), origin = board.getBoundingClientRect();
    let moved = false, q = from, ok = true;
    try { box.setPointerCapture(pointerId); } catch {}
    const move = e => {
      if (e.pointerId !== pointerId) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      if (!moved) {
        moved = true;
        box.classList.add('lifted');
        document.body.classList.add('dragging');
        // Le widget tenu flotte au-dessus de l'écran : la page qui défile ne le rogne pas. Ses voisins ont des places
        // fixes, rien ne bouge derrière lui ; sa taille ne change pas, son contenu non plus.
        Object.assign(box.style, { position: 'fixed', left: `${start.left}px`, top: `${start.top}px`, width: `${start.width}px`, height: `${start.height}px`, margin: '0', zIndex: '50' });
      }
      box.style.transform = `translate(${dx}px,${dy}px)`;
      // La case visée : celle où tombe le coin haut-gauche du widget, sur la page affichée.
      const c = Math.round((start.left + dx - origin.left + board.scrollLeft) / (m.cw + m.gap)) - page * COLS;
      const r = Math.round((start.top + dy - origin.top) / (m.ch + m.gap));
      const next = { p: page, c: clamp(c, 0, COLS - from.w), r: clamp(r, 0, ROWS - from.h), w: from.w, h: from.h };
      if (next.c === q.c && next.r === q.r && next.p === q.p) return;
      q = next;
      ok = fits(state.d, id, q);
      showDrop(q, ok);
    };
    const finish = keep => {
      box.removeEventListener('pointermove', move);
      box.removeEventListener('pointerup', up);
      box.removeEventListener('pointercancel', cancel);
      gesture = null;
      drop.hidden = true;
      if (!moved) return;
      const before = box.getBoundingClientRect();
      box.classList.remove('lifted');
      document.body.classList.remove('dragging');
      unfloat(box);
      const same = q.p === from.p && q.c === from.c && q.r === from.r;
      if (keep && ok && !same) commit(id, q, 'est posé');
      else if (keep && !ok) ctx.say(`Cette place est occupée : ${ctx.title(id)} reste où il était.`);
      settle(box, before);
    };
    const up = () => finish(true), cancel = () => finish(false);
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerup', up);
    box.addEventListener('pointercancel', cancel);
    gesture = { cancel };
  }

  function startResize(e, box) {
    const id = box.dataset.widget, from = { ...state.d[id] }, [mw, mh] = minOf(id);
    const origin = board.getBoundingClientRect();
    const left = origin.left - board.scrollLeft + (from.p * COLS + from.c) * (m.cw + m.gap), top = origin.top + from.r * (m.ch + m.gap);
    let last = from;
    e.preventDefault();
    e.stopPropagation();
    const grip = e.target.closest('.pg-size');
    grip.setPointerCapture(e.pointerId);
    box.classList.add('resizing');
    const move = ev => {
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
      gesture = null;
      drop.hidden = true;
      box.classList.remove('resizing');
      if (!keep) { state.d[id] = from; paint(); ctx.say('Taille annulée.'); return; }
      if (last.w !== from.w || last.h !== from.h) commit(id, last, 'change de taille');
    };
    const up = () => finish(true), cancel = () => finish(false);
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', cancel);
    gesture = { cancel };
  }
  function endGesture(keep) { gesture?.cancel(keep); }

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
    if (!fits(state.d, id, next)) return ctx.say(inside(next) ? 'Place occupée.' : 'Bord de la page.');
    const box = ctx.box(id), before = box.getBoundingClientRect();
    commit(id, next, sizing || e.shiftKey ? 'change de taille' : 'est déplacé');
    settle(box, before);
    e.target.focus();
  }

  board.addEventListener('pointerdown', e => {
    if (!editing || e.button !== 0) return;
    const box = e.target.closest('.widget');
    // Toucher le fond pendant l'édition la termine, comme sur un téléphone.
    if (!box) { if (e.target === board || e.target.classList.contains('pg-cell')) edit(false); return; }
    if (box.parentElement !== board || box.classList.contains('zoomed')) return;
    if (e.target.closest('.pg-size')) return startResize(e, box);
    e.preventDefault();
    startDrag(box, e.pointerId, e.clientX, e.clientY);
  }, { signal });
  // Pendant un glissement au doigt, la page ne défile pas.
  board.addEventListener('touchmove', e => { if (gesture) e.preventDefault(); }, { signal, passive: false });

  // ---------- Appui long : entrer en édition depuis un widget ----------
  const ring = node('div', 'lp-ring');
  document.body.append(ring);
  function surface(t, box) {
    if (!(t instanceof Element) || t.closest(NEVER)) return false;
    return t === box || t.classList.contains('head') || t.classList.contains('body') || t.classList.contains('meta') || t.matches('.head > h2');
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
    if (gesture) endGesture(false); else edit(false);
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
    const changed = seed();
    paint();
    if (editing) for (const id of ctx.ids()) handles(id, true);
    if (changed) save();
  }

  function leave() {
    widths.disconnect();
    cancelAnimationFrame(frame);
    endGesture(false);
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
    for (const n of [...snaps, ...cells, drop, dots, bar, ring]) n.remove();
    document.body.classList.remove('dragging', 'pages-editing');
    board.removeAttribute('data-vue');
    for (const v of ['--pg-cols', '--pg-cw', '--pg-ch', '--pg-h']) board.style.removeProperty(v);
    board.scrollLeft = 0;
  }

  relayout();
  return { relayout, leave, edit };
};
