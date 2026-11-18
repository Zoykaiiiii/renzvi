// Disposition fine des widgets dans la grille de 12 colonnes : largeur en colonnes et hauteur en pixels, par poignée
// (souris, doigt, stylet) ou au clavier, et repli d'un widget. Rien ne se recrée : seuls des attributs et des variables CSS
// changent, donc un minuteur continue, un dessin garde son contenu, un lecteur ne se recharge pas.
// ctx.get(id) → { span, h, collapsed }, ctx.set(id, patch, final) (final : enregistrer), ctx.flip(change, skip),
// ctx.board(), ctx.say(texte), ctx.title(id).
// Les réglages ne s'appliquent qu'à partir de 728 px de large : sur téléphone, chaque widget prend toute la largeur.
const LAYOUT_DRAG_PX = 4;
(() => {
  const MIN_SPAN = 3, MAX_SPAN = 12, MIN_H = 140, MAX_H = 1200, SNAP = 8;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = () => matchMedia('(min-width: 728px)').matches;
  // Moyen écran (728-1039 px) : la grille garde 12 colonnes mais chaque widget y est plus large.
  const mediumSpan = s => (s <= 3 ? 4 : Math.min(12, Math.round(s * 1.5)));

  window.renzviLayout = function (ctx) {
    function apply(box, id) {
      const { span, h, collapsed } = ctx.get(id);
      if (span) {
        box.dataset.span = span;
        box.style.setProperty('--span-w', span);
        box.style.setProperty('--span-m', mediumSpan(span));
      } else { delete box.dataset.span; box.style.removeProperty('--span-w'); box.style.removeProperty('--span-m'); }
      if (h) { box.dataset.h = h; box.style.setProperty('--h', `${h}px`); } else { delete box.dataset.h; box.style.removeProperty('--h'); }
      box.toggleAttribute('data-collapsed', !!collapsed);
    }

    function decorate(w, box, head) {
      // Replier : le titre et l'état essentiel (la ligne « meta ») restent, le contenu est seulement masqué.
      const fold = document.createElement('button');
      fold.type = 'button';
      fold.className = 'fold';
      fold.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6.500 8 10.500l4-4"/></svg>';
      const markFold = () => {
        const c = !!ctx.get(w.id).collapsed;
        fold.setAttribute('aria-expanded', !c);
        fold.ariaLabel = `${c ? 'Déplier' : 'Replier'} ${w.title}`;
      };
      fold.onclick = () => {
        const c = !ctx.get(w.id).collapsed;
        const from = box.getBoundingClientRect().height;
        ctx.flip(() => { ctx.set(w.id, { collapsed: c }, true); apply(box, w.id); }, box);
        const to = box.getBoundingClientRect().height;
        if (!reduced() && Math.abs(to - from) > 1) box.animate([{ height: `${from}px`, overflow: 'hidden' }, { height: `${to}px`, overflow: 'hidden' }], { duration: 240, easing: 'cubic-bezier(.22,1,.36,1)' });
        markFold();
        ctx.say(`${w.title} ${c ? 'replié' : 'déplié'}`);
      };
      markFold();
      head.querySelector('.meta').after(fold);

      // Poignée de taille, en bas à droite, visible en mode « Disposer ».
      const grip = document.createElement('button');
      grip.type = 'button';
      grip.className = 'resize-handle';
      grip.ariaLabel = `Redimensionner ${w.title} : flèches gauche et droite pour la largeur, haut et bas pour la hauteur`;
      grip.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 7v6H7M13 13 8.500 8.500"/></svg>';
      const badge = document.createElement('span');
      badge.className = 'resize-badge';
      badge.setAttribute('aria-hidden', 'true');
      box.append(grip, badge);

      const pitch = () => {
        const board = ctx.board(), gap = parseFloat(getComputedStyle(board).columnGap) || 16;
        return { col: (board.clientWidth - gap * 11) / 12, gap };
      };
      const current = () => {
        const g = getComputedStyle(box).gridColumnEnd; // « span N »
        const span = ctx.get(w.id).span || Number(/span (\d+)/.exec(g)?.[1]) || Math.round((box.offsetWidth + pitch().gap) / (pitch().col + pitch().gap));
        return { span, h: ctx.get(w.id).h || Math.round(box.offsetHeight) };
      };
      const show = (span, h) => { badge.textContent = `${span}/12 · ${h} px`; };
      function setSize(span, h, final) {
        ctx.set(w.id, { span: clamp(span, MIN_SPAN, MAX_SPAN), h: clamp(Math.round(h / SNAP) * SNAP, MIN_H, MAX_H) }, final);
        apply(box, w.id);
      }
      grip.addEventListener('pointerdown', e => {
        if (e.button !== 0 || !e.isPrimary || !wide() || grip.onpointerup) return;
        e.preventDefault();
        e.stopPropagation();
        grip.setPointerCapture(e.pointerId);
        const start = current(), saved = { ...ctx.get(w.id) }, rect = box.getBoundingClientRect();
        let last = start, resizing = false;
        const move = m => {
          if (m.pointerId !== e.pointerId) return;
          if (!resizing) {
            if (Math.hypot(m.clientX - e.clientX, m.clientY - e.clientY) < LAYOUT_DRAG_PX) return;
            resizing = true;
            clearTimeout(grip.t);
            box.classList.add('resizing');
            document.body.classList.add('layout-resizing');
            show(start.span, start.h);
          }
          const { col, gap } = pitch();
          const span = clamp(Math.round((m.clientX - rect.left + gap) / (col + gap)), MIN_SPAN, MAX_SPAN);
          const h = clamp(Math.round((m.clientY - rect.top) / SNAP) * SNAP, MIN_H, MAX_H);
          if (span === last.span && h === last.h) return;
          last = { span, h };
          setSize(span, h, false);
          show(span, h);
        };
        const end = keep => {
          grip.removeEventListener('pointermove', move);
          grip.onpointerup = grip.onpointercancel = grip.onlostpointercapture = null;
          if (grip.hasPointerCapture(e.pointerId)) grip.releasePointerCapture(e.pointerId);
          removeEventListener('keydown', esc, true);
          if (!resizing) return;
          document.body.classList.remove('layout-resizing');
          box.classList.remove('resizing');
          if (!keep) { ctx.set(w.id, { span: saved.span ?? null, h: saved.h ?? null }, false); apply(box, w.id); ctx.say('Taille annulée'); return; }
          ctx.set(w.id, {}, true);
          ctx.say(`${w.title} : ${last.span} colonnes sur 12, ${last.h} pixels de haut`);
        };
        const esc = k => { if (k.key === 'Escape') { k.preventDefault(); k.stopPropagation(); end(false); } };
        grip.addEventListener('pointermove', move);
        grip.onpointerup = m => { if (m.pointerId === e.pointerId) end(true); };
        grip.onpointercancel = grip.onlostpointercapture = m => { if (m.pointerId === e.pointerId) end(false); };
        addEventListener('keydown', esc, true);
      });
      grip.addEventListener('keydown', e => {
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -32], ArrowDown: [0, 32] }[e.key];
        if (!d || !wide()) return;
        e.preventDefault();
        const c = current();
        setSize(c.span + d[0], c.h + d[1], true);
        const n = ctx.get(w.id);
        show(n.span, n.h);
        box.classList.add('resizing');
        clearTimeout(grip.t);
        grip.t = setTimeout(() => box.classList.remove('resizing'), 900);
        ctx.say(`${n.span} colonnes sur 12, ${n.h} pixels de haut`);
      });
      return { fold, grip, markFold };
    }
    return { apply, decorate };
  };
})();
