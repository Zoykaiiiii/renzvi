// Présentation « Tableau libre » (labo ?vues=1) : les widgets de la page posés où l'on veut, comme des feuilles sur une table.
// Contrat commun des présentations (voir applyVue dans dashboard.html) : window.vueXxx(ctx) rend { relayout, leave }.
// Une présentation ne crée, ne copie et ne relance aucun widget. Elle ne déplace pas non plus les boîtes dans la page
// (un lecteur de musique se rechargerait) : elle change seulement leur place, par des variables CSS retirées en partant.
window.vueLibre = function vueLibre(ctx) {
  const { board } = ctx;
  const WIDTH = { s: 264, m: 356, l: 560 };
  const GAP = 16, SNAP = 8, STEP = 16, NARROW = 728;
  const DOTS = '<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="4.5" cy="2.5" r="1.5"/><circle cx="9.5" cy="2.5" r="1.5"/><circle cx="4.5" cy="7" r="1.5"/><circle cx="9.5" cy="7" r="1.5"/><circle cx="4.5" cy="11.5" r="1.5"/><circle cx="9.5" cy="11.5" r="1.5"/></svg>';
  const off = new AbortController(), signal = off.signal;
  const grips = new Map(), touched = new Set();
  let places = structuredClone(ctx.places());
  let note = null;

  const narrow = () => innerWidth < NARROW;
  const snap = v => Math.round(v / SNAP) * SNAP;
  const widthOf = box => WIDTH[box.dataset.size] ?? WIDTH.m;
  const fit = (p, box) => ({ ...p, x: Math.max(0, Math.min(p.x, board.clientWidth - widthOf(box))), y: Math.max(0, p.y) });
  const topZ = () => Math.max(0, ...Object.values(places).map(p => p.z ?? 0));
  const bottomOf = ids => Math.max(0, ...ids.filter(id => places[id]).map(id => places[id].y + ctx.box(id).offsetHeight));

  function grip(id, box) {
    if (grips.get(id)?.parentElement?.closest('.widget') === box) return;
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'vue-grip', innerHTML: DOTS });
    b.ariaLabel = `Déplacer ${ctx.title(id)} sur le tableau, avec les flèches`;
    b.addEventListener('keydown', e => {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d || narrow()) return;
      e.preventDefault();
      const step = e.shiftKey ? STEP * 4 : STEP;
      place(id, fit({ ...places[id], x: places[id].x + d[0] * step, y: places[id].y + d[1] * step, z: topZ() + 1 }, box));
      ctx.say(`${ctx.title(id)} : ${Math.round(places[id].x)} pixels du bord gauche, ${Math.round(places[id].y)} du haut.`);
    }, { signal });
    box.querySelector('.head').prepend(b);
    grips.set(id, b);
  }

  function place(id, p, keep = true) {
    places[id] = { x: snap(p.x), y: snap(p.y), z: p.z ?? 1 };
    // Les étages restent de petits nombres, même après des centaines de clics.
    if (places[id].z > 500) Object.keys(places).sort((a, b) => places[a].z - places[b].z).forEach((k, i) => { places[k] = { ...places[k], z: i + 1 }; });
    paint();
    if (keep) ctx.save(places);
  }

  // Un widget sans place prend celle qu'il avait dans la grille (rien ne saute), sinon la première ligne libre en bas.
  function seed(ids) {
    let changed = false;
    for (const id of ids) {
      if (places[id]) continue;
      const was = ctx.from.get(id);
      places[id] = was?.w ? { x: snap(was.x), y: snap(was.y), z: 1 } : { x: 0, y: snap(bottomOf(ids) + (Object.keys(places).length ? GAP : 0)), z: 1 };
      changed = true;
    }
    return changed;
  }

  function paint() {
    const ids = ctx.ids();
    if (narrow()) {
      board.dataset.vue = 'libre-liste';
      // Sur téléphone, le tableau se lit de haut en bas, dans l'ordre de ses rangées.
      [...ids].sort((a, b) => (places[a]?.y ?? 0) - (places[b]?.y ?? 0) || (places[a]?.x ?? 0) - (places[b]?.x ?? 0))
        .forEach((id, i) => { ctx.box(id).style.order = i; touched.add(id); });
      board.style.removeProperty('--vue-h');
      if (!note) {
        note = Object.assign(document.createElement('p'), { className: 'vue-note', textContent: 'Sur téléphone, le tableau libre se lit de haut en bas. Pour déplacer tes widgets, ouvre-le sur un écran plus large.' });
        board.before(note);
      }
      return;
    }
    note?.remove();
    note = null;
    board.dataset.vue = 'libre';
    for (const id of ids) {
      const box = ctx.box(id), p = fit(places[id], box);
      box.style.order = '';
      box.style.setProperty('--x', `${p.x}px`);
      box.style.setProperty('--y', `${p.y}px`);
      box.style.setProperty('--w', `${widthOf(box)}px`);
      box.style.setProperty('--z', p.z ?? 1);
      touched.add(id);
      grip(id, box);
    }
    board.style.setProperty('--vue-h', ids.length ? `${Math.max(320, bottomOf(ids) + GAP)}px` : '0px');
  }

  // Glisser par la poignée ou par l'en-tête du widget. Les boutons et champs de l'en-tête gardent leur clic.
  function drag(e) {
    const box = e.target.closest('.widget');
    if (!box || box.parentElement !== board || e.button !== 0 || narrow() || box.classList.contains('zoomed')) return;
    const handle = e.target.closest('.vue-grip, .head');
    if (!handle || (!e.target.closest('.vue-grip') && e.target.closest('button, a, input, select, textarea, label, [contenteditable]'))) return;
    e.preventDefault();
    const id = box.dataset.widget, start = places[id];
    const x0 = e.clientX, y0 = e.clientY;
    let lifted = false, to = start;
    handle.setPointerCapture(e.pointerId);
    const move = m => {
      const dx = m.clientX - x0, dy = m.clientY - y0;
      if (!lifted && Math.hypot(dx, dy) < 4) return;
      if (!lifted) {
        lifted = true;
        box.classList.add('lifted');
        document.body.classList.add('dragging');
        box.style.setProperty('--z', topZ() + 1);
      }
      to = fit({ ...start, x: start.x + dx, y: start.y + dy }, box);
      box.style.transform = `translate(${to.x - start.x}px,${to.y - start.y}px)`;
    };
    const end = keep => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', cancel);
      if (!lifted) return;
      box.classList.remove('lifted');
      document.body.classList.remove('dragging');
      box.style.transform = '';
      if (keep) {
        place(id, { ...to, z: topZ() + 1 });
        ctx.say(`${ctx.title(id)} est posé.`);
      } else paint();
    };
    const up = () => end(true), cancel = () => end(false);
    handle.addEventListener('pointermove', move, { signal });
    handle.addEventListener('pointerup', up, { signal });
    handle.addEventListener('pointercancel', cancel, { signal });
  }
  board.addEventListener('pointerdown', drag, { signal });
  // Toucher un widget le passe devant les autres, comme une fenêtre.
  board.addEventListener('pointerdown', e => {
    const id = e.target.closest('.widget')?.dataset.widget;
    if (!id || !places[id] || narrow() || (places[id].z ?? 0) === topZ()) return;
    place(id, { ...places[id], z: topZ() + 1 });
  }, { signal, capture: true });

  // Le contenu d'un widget grandit (une tâche ajoutée) : le tableau s'allonge. Une taille changée : la largeur suit.
  const sizes = new ResizeObserver(() => { if (!narrow()) board.style.setProperty('--vue-h', `${Math.max(320, bottomOf(ctx.ids()) + GAP)}px`); });
  const attrs = new MutationObserver(() => relayout());
  attrs.observe(board, { subtree: true, attributes: true, attributeFilter: ['data-size'] });
  addEventListener('resize', () => paint(), { signal });

  function relayout() {
    const ids = ctx.ids();
    const changed = seed(ids);
    paint();
    for (const id of ids) sizes.observe(ctx.box(id));
    if (changed) ctx.save(places);
  }

  function leave() {
    off.abort();
    sizes.disconnect();
    attrs.disconnect();
    for (const b of grips.values()) b.remove();
    for (const id of touched) {
      const box = ctx.box(id);
      if (!box) continue;
      for (const v of ['--x', '--y', '--w', '--z']) box.style.removeProperty(v);
      box.style.order = '';
      box.style.transform = '';
      box.classList.remove('lifted');
    }
    document.body.classList.remove('dragging');
    note?.remove();
    board.removeAttribute('data-vue');
    board.style.removeProperty('--vue-h');
  }

  relayout();
  return { relayout, leave };
};
