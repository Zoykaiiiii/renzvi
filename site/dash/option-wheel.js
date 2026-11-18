// Roue d'options courbe. Adaptée de « OptionWheel » de React Bits (https://reactbits.dev, licence MIT + Commons Clause),
// réécrite en JS natif (pas de React dans le dashboard). Même mouvement : une boucle rAF qui rapproche la position de sa
// cible (lissage exponentiel), chaque option posée sur un arc selon sa distance au centre, flou et fondu en s'éloignant.
// Adaptations : chaque option est un vrai bouton (contenu libre : icône + nom), un clic choisit directement l'option
// (molette, glisser et flèches ne font que parcourir), Entrée choisit l'option centrée, et la liste est un listbox accessible.
(() => {
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.OptionWheel = function OptionWheel(o = {}) {
    const cfg = {
      items: [], selected: 0, side: 'left', fontSize: 1.2, spacing: 2.3, curve: 1, tilt: 6, blur: 0.5, fade: 0.2, minOpacity: 0.3,
      smoothing: 140, inset: 28, label: 'Choix', enter: 0, onChange: null, onPick: null, holdMs: 0, onHold: null, ...o,
    };
    const n = cfg.items.length;
    let pos = cfg.selected, target = cfg.selected, selected = cfg.selected, raf = 0, last = 0, wheelTimer = 0, drag = null, moved = false;
    let held = null;
    const lifetime = new AbortController();
    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const rowH = Math.max(cfg.fontSize * cfg.spacing * remPx, 1);

    const root = document.createElement('div');
    root.className = `option-wheel${cfg.side === 'right' ? ' option-wheel--right' : ''}`;
    root.setAttribute('role', 'listbox');
    root.tabIndex = 0;
    root.ariaLabel = cfg.label;
    root.style.setProperty('--ow-font-size', `${cfg.fontSize}rem`);
    root.style.setProperty('--ow-inset', `${cfg.inset}px`);
    root.style.setProperty('--ow-row', `${rowH}px`);
    if (cfg.onHold) root.style.setProperty('--ow-hold', `${cfg.holdMs}ms`);
    const els = cfg.items.map((item, i) => {
      const b = document.createElement('div');
      b.className = 'option-wheel__item';
      b.setAttribute('role', 'option');
      b.id = `ow-${Math.random().toString(36).slice(2, 8)}-${i}`;
      if (item.node) b.append(item.node); else b.textContent = item.label;
      if (item.className) b.classList.add(...item.className.split(' ').filter(Boolean));
      b.addEventListener('click', () => pick(i));
      root.append(b);
      return b;
    });

    function layout() {
      const tiltRad = (cfg.tilt * Math.PI) / 180, R = tiltRad > 0.0005 ? rowH / tiltRad : 0, mirror = cfg.side === 'right' ? -1 : 1;
      els.forEach((el, i) => {
        const d = i - pos, dist = Math.abs(d);
        let x = 0, y = d * rowH, rot = 0;
        if (R > 0) {
          const ang = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d * tiltRad));
          y = R * Math.sin(ang);
          x = -mirror * R * (1 - Math.cos(ang)) * cfg.curve;
          rot = (mirror * ang * 180) / Math.PI;
        }
        el.style.transform = `translate(${x.toFixed(2)}px, calc(${y.toFixed(2)}px - 50%)) rotate(${rot.toFixed(3)}deg)`;
        el.style.opacity = String(Math.max(cfg.minOpacity, 1 - dist * cfg.fade));
        el.style.filter = cfg.blur > 0 && dist > 0.02 ? `blur(${(dist * cfg.blur).toFixed(2)}px)` : 'none';
        el.style.setProperty('--ow-p', Math.max(0, 1 - Math.min(dist, 1)).toFixed(4));
      });
    }
    function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const k = 1 - Math.exp(-dt / (Math.max(cfg.smoothing, 1) / 1000));
      pos = reduced() ? target : pos + (target - pos) * k;
      const settled = Math.abs(target - pos) < 0.001;
      if (settled) pos = target;
      layout();
      raf = settled || !root.isConnected ? 0 : requestAnimationFrame(frame);
    }
    const loop = () => { if (raf) return; last = performance.now(); raf = requestAnimationFrame(frame); };
    function apply(v, snap) {
      v = Math.min(Math.max(v, 0), n - 1);
      if (snap) v = Math.round(v);
      target = v;
      const idx = Math.round(v);
      if (idx !== selected) {
        selected = idx;
        mark();
        cfg.onChange?.(idx, cfg.items[idx]);
      }
      loop();
    }
    function mark() {
      els.forEach((el, i) => { el.setAttribute('aria-selected', i === selected); el.classList.toggle('option-wheel__item--selected', i === selected); });
      root.setAttribute('aria-activedescendant', els[selected]?.id ?? '');
    }
    function pick(i) { apply(i, true); cfg.onPick?.(i, cfg.items[i]); }

    function cancelHold() {
      if (!held) return;
      clearTimeout(held.timer);
      held.el.classList.remove('is-holding');
      held = null;
    }
    function interruptHold() {
      if (!held) return;
      cancelHold();
      moved = true;
    }
    root.addEventListener('click', e => {
      if (moved && e.detail) e.stopImmediatePropagation();
    }, true);
    if (cfg.onHold) {
      addEventListener('blur', interruptHold, { signal: lifetime.signal });
      document.addEventListener('visibilitychange', interruptHold, { signal: lifetime.signal });
      root.addEventListener('contextmenu', e => { if (held) e.preventDefault(); });
      root.addEventListener('lostpointercapture', e => { if (e.pointerId === drag?.id) interruptHold(); });
    }
    root.addEventListener('wheel', e => {
      e.preventDefault();
      interruptHold();
      const delta = e.deltaMode === 1 ? e.deltaY * 24 : e.deltaY;
      apply(target + Math.max(-1, Math.min(1, delta / rowH)), false);
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => apply(target, true), 140);
    }, { passive: false });
    root.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !e.isPrimary) return;
      cancelHold();
      drag = { x: e.clientX, y: e.clientY, start: target, id: e.pointerId };
      moved = false;
      const el = e.target.closest('.option-wheel__item');
      const item = cfg.items[els.indexOf(el)];
      if (!cfg.onHold || !item?.hold) return;
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-holding');
      held = { el, started: performance.now(), timer: setTimeout(() => {
        moved = true;
        cfg.onHold(item);
      }, cfg.holdMs) };
    });
    root.addEventListener('pointermove', e => {
      if (e.pointerId !== drag?.id) return;
      const dy = e.clientY - drag.y;
      const startsDrag = held ? Math.hypot(e.clientX - drag.x, dy) > 10 : Math.abs(dy) > 4;
      if (!moved && startsDrag) {
        cancelHold();
        moved = true;
        root.setPointerCapture(drag.id);
        root.classList.add('option-wheel--dragging');
      }
      if (moved) apply(drag.start - dy / rowH, false);
    });
    const end = e => {
      if (e.pointerId !== drag?.id) return;
      // Un appui interrompu après avoir commencé à remplir la barre ne choisit pas le mode.
      if (held && performance.now() - held.started >= 350) moved = true;
      cancelHold();
      drag = null;
      root.classList.remove('option-wheel--dragging');
      if (moved) apply(target, true);
    };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
    root.addEventListener('keydown', e => {
      interruptHold();
      const step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key];
      if (step) { e.preventDefault(); apply(Math.round(target) + step, true); return; }
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); apply(e.key === 'Home' ? 0 : n - 1, true); return; }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(selected); }
    });

    mark();
    // Entrée : la roue part décalée de quelques crans et tourne jusqu'à l'option choisie (même lissage que le reste).
    if (cfg.enter && !reduced()) { pos = Math.min(Math.max(selected - cfg.enter, -1.5), n); layout(); loop(); } else layout();
    return { el: root, get selected() { return selected; }, select: i => apply(i, true), destroy() {
      lifetime.abort();
      cancelHold();
      cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(wheelTimer);
    } };
  };
})();
