// Cadran circulaire à comète. Adapté de « CometDial » de React Bits (https://reactbits.dev, licence MIT + Commons Clause),
// réécrit en JS natif : le dashboard n'a ni React ni la bibliothèque motion. Le ressort de motion est remplacé par un petit
// intégrateur (raideur, amortissement, vitesse de départ), le reste suit le composant : arc, perle, traînée selon la vitesse,
// élan au lâcher, clavier. Il n'a aucune horloge à lui : il affiche une valeur, la page décide de tout le reste.
(() => {
  const R = 80, DEAD = 44, K = 12, V_FULL = 4, V_FLICK = 2, TAU_FOLLOW = 0.06, TAU_V = 0.05, DECEL = 0.99, DRAG_PX = 10, STALE_MS = 80;
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const velocityOf = hist => {
    if (hist.length < 2) return 0;
    const a = hist[0], b = hist[hist.length - 1];
    return ((b[1] - a[1]) / Math.max(1, b[0] - a[0])) * 1000;
  };
  const decimalsOf = step => { const s = String(step), i = s.indexOf('.'); return i === -1 ? 0 : s.length - i - 1; };
  const pointAt = deg => { const a = (deg * Math.PI) / 180; return [100 + Math.cos(a) * R, 100 + Math.sin(a) * R]; };
  const arcPath = (a0, a1) => {
    const [x0, y0] = pointAt(a0), [x1, y1] = pointAt(a1);
    return `M ${x0.toFixed(3)} ${y0.toFixed(3)} A ${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(3)} ${y1.toFixed(3)}`;
  };
  const svg = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };

  window.CometDial = function CometDial(o = {}) {
    const opt = {
      value: 62, min: 0, max: 100, step: 1, unit: '%', label: 'Niveau', sweep: 320, thickness: 5, speed: 25,
      tapBounce: 0.2, flickBounce: 0.1, momentum: 1, cometReach: 180, cometWidth: 12, disabled: false,
      format: null, valueText: null, onChange: null, onChangeEnd: null, ...o,
    };
    let { min, max, step } = opt;
    const range = () => Math.max(1e-9, max - min);
    const gap = 360 - opt.sweep, start = 90 + gap / 2, end = start + opt.sweep;
    const k = 200 + (clamp(opt.speed, 0, 100) / 100) * 700, crit = 2 * Math.sqrt(k);
    const snap = v => (step > 0 ? clamp(Math.round((v - min) / step) * step + min, min, max) : clamp(v, min, max));
    let target = snap(opt.value);
    // La lecture affichée : un ressort vers « to », ou un suivi du doigt pendant le glisser.
    const reading = { x: target, v: 0, to: target, c: crit, on: false };
    let grip = null, unbind = null, raf = 0, last = 0, vel = 0, prev = null, shownText = '', shownAria = '', disabled = !!opt.disabled;

    const root = document.createElement('div');
    root.className = 'comet-dial';
    const ring = svg('svg', { class: 'comet-dial__ring', viewBox: '0 0 200 200', role: 'slider', 'aria-label': opt.label });
    const track = svg('path', { class: 'comet-dial__track', d: arcPath(start, end), 'stroke-width': opt.thickness });
    const lit = svg('path', { class: 'comet-dial__lit', 'stroke-width': opt.thickness });
    const tail = svg('g', { class: 'comet-dial__comet' });
    const comet = Array.from({ length: K }, () => { const p = svg('path'); p.style.opacity = '0'; tail.append(p); return p; });
    const head = svg('circle', { class: 'comet-dial__head', r: opt.thickness * 1.8 });
    ring.append(track, lit, tail, head);
    const readout = document.createElement('div');
    readout.className = 'comet-dial__readout';
    readout.setAttribute('aria-hidden', 'true');
    const figure = document.createElement('span');
    figure.className = 'comet-dial__figure';
    readout.append(figure);
    if (opt.unit) readout.append(Object.assign(document.createElement('span'), { className: 'comet-dial__unit', textContent: opt.unit }));
    root.append(ring, readout);

    const fmt = r => (opt.format ? opt.format(r) : clamp(r, min, max).toFixed(decimalsOf(step)));
    const aria = () => (opt.valueText ? opt.valueText(target) : `${target}${opt.unit}`);
    function syncAttrs() {
      ring.setAttribute('aria-valuemin', min);
      ring.setAttribute('aria-valuemax', max);
      ring.setAttribute('tabindex', disabled ? '-1' : '0');
      if (disabled) ring.setAttribute('aria-disabled', 'true'); else ring.removeAttribute('aria-disabled');
      root.toggleAttribute('data-disabled', disabled);
    }
    syncAttrs();
    // La valeur réglée est annoncée tout de suite ; seule l'aiguille prend le temps du ressort.
    const syncValue = () => { ring.setAttribute('aria-valuenow', String(target)); shownAria = aria(); ring.setAttribute('aria-valuetext', shownAria); };
    syncValue();

    const commit = (v, finished, detail) => {
      const s = snap(v);
      if (s !== target) { target = s; opt.onChange?.(s); syncValue(); }
      if (finished) opt.onChangeEnd?.(s, detail ?? { velocity: 0, bounce: opt.tapBounce });
    };
    const wake = () => { if (raf) return; last = performance.now(); prev = null; raf = requestAnimationFrame(paint); };
    const launch = (to, bounce, velocity = reading.v) => {
      if (reduced()) { reading.x = to; reading.v = 0; reading.on = false; wake(); return; }
      reading.to = to;
      reading.v = velocity;
      reading.c = crit * (1 - clamp(bounce, 0, 0.9));
      reading.on = true;
      wake();
    };

    function paint(now) {
      if (!root.isConnected) { raf = 0; return; }
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      if (grip && grip.at != null) {
        if (reduced()) reading.x = grip.at;
        else reading.x += (grip.at - reading.x) * (1 - Math.exp(-dt / TAU_FOLLOW));
      } else if (reading.on) {
        // Ressort masse 1, intégré par petits pas pour rester stable quelle que soit la cadence.
        for (let t = 0; t < dt; t += 1 / 240) {
          const h = Math.min(1 / 240, dt - t);
          reading.v += (-k * (reading.x - reading.to) - reading.c * reading.v) * h;
          reading.x += reading.v * h;
        }
        if (Math.abs(reading.x - reading.to) < range() * 1e-4 && Math.abs(reading.v) < range() * 1e-3) { reading.x = reading.to; reading.v = 0; reading.on = false; }
      }
      const r = reading.x;
      const vRaw = prev == null || dt === 0 || reduced() ? 0 : (r - prev) / dt / range();
      prev = r;
      vel += (vRaw - vel) * (1 - Math.exp(-dt / TAU_V));
      const s = clamp(Math.abs(vel) / V_FULL, 0, 1), dir = Math.sign(vel) || 1;
      const f = clamp((r - min) / range(), 0, 1), ang = start + f * opt.sweep;
      lit.setAttribute('d', f > 0.0005 ? arcPath(start, ang) : '');
      const [cx, cy] = pointAt(ang);
      head.setAttribute('cx', cx.toFixed(3));
      head.setAttribute('cy', cy.toFixed(3));
      const seg = (opt.cometReach * s) / K;
      comet.forEach((el, j) => {
        let a0 = dir > 0 ? ang - (j + 1) * seg : ang + j * seg, a1 = dir > 0 ? ang - j * seg : ang + (j + 1) * seg;
        a0 = clamp(a0, start, end); a1 = clamp(a1, start, end);
        if (seg < 0.01 || a1 - a0 < 0.01) { if (el.style.opacity !== '0') el.style.opacity = '0'; return; }
        const w = 1 - j / K;
        el.setAttribute('d', arcPath(a0, a1));
        el.setAttribute('stroke-width', (opt.thickness + opt.cometWidth * w * s).toFixed(2));
        el.style.opacity = (w * s).toFixed(3);
      });
      const text = fmt(r);
      if (text !== shownText) { shownText = text; figure.textContent = text; }
      const now2 = String(target), a = aria();
      ring.setAttribute('aria-valuenow', now2);
      if (a !== shownAria) { shownAria = a; ring.setAttribute('aria-valuetext', a); }
      const moving = !!grip || reading.on || Math.abs(vel) > 0.002;
      if (!moving) for (const el of comet) if (el.style.opacity !== '0') el.style.opacity = '0';
      raf = moving ? requestAnimationFrame(paint) : 0;
    }

    const localPoint = (cx, cy) => { const b = ring.getBoundingClientRect(); return [((cx - b.left) / b.width) * 200 - 100, ((cy - b.top) / b.height) * 200 - 100]; };
    const angleAt = (cx, cy) => {
      const [x, y] = localPoint(cx, cy);
      let rel = ((Math.atan2(y, x) * 180) / Math.PI - start + 720) % 360;
      if (rel > opt.sweep) rel = grip && grip.side ? (grip.side === 'hi' ? opt.sweep : 0) : rel < opt.sweep + gap / 2 ? opt.sweep : 0;
      else if (grip) grip.side = rel > opt.sweep / 2 ? 'hi' : 'lo';
      return min + (rel / opt.sweep) * range();
    };
    function move(e) {
      const g = grip;
      if (!g || g.id !== e.pointerId) return;
      if (!g.moved) { if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < DRAG_PX) return; g.moved = true; reading.on = false; }
      g.at = angleAt(e.clientX, e.clientY);
      g.hist.push([performance.now(), g.at]);
      if (g.hist.length > 4) g.hist.shift();
      commit(g.at, false);
      wake();
    }
    function up(e) {
      const g = grip;
      if (!g || g.id !== e.pointerId) return;
      grip = null;
      unbind?.(); unbind = null;
      root.removeAttribute('data-dragging');
      try { ring.releasePointerCapture(e.pointerId); } catch {}
      if (!g.moved) { commit(target, true); return; }
      const stale = performance.now() - g.hist[g.hist.length - 1][0] > STALE_MS;
      const v = e.type === 'pointercancel' || stale ? 0 : velocityOf(g.hist);
      const bounce = opt.tapBounce + (opt.flickBounce - opt.tapBounce) * clamp(Math.abs(v) / range() / V_FLICK, 0, 1);
      const to = snap((g.at ?? target) + (v / 1000) * (DECEL / (1 - DECEL)) * opt.momentum);
      commit(to, true, { velocity: v, bounce });
      launch(to, bounce, v);
    }
    ring.addEventListener('pointerdown', e => {
      if (disabled || grip || e.button > 0) return;
      const [x, y] = localPoint(e.clientX, e.clientY);
      if (Math.hypot(x, y) < DEAD) return; // le centre reste libre : le texte, et le défilement au doigt
      e.preventDefault();
      try { ring.setPointerCapture(e.pointerId); } catch {}
      ring.focus({ preventScroll: true });
      grip = { id: e.pointerId, at: null, hist: [], side: null, moved: false, x0: e.clientX, y0: e.clientY };
      const at = angleAt(e.clientX, e.clientY);
      grip.hist.push([performance.now(), at]);
      root.setAttribute('data-dragging', '');
      commit(at, false);
      launch(snap(at), opt.tapBounce);
      const onMove = ev => { if (ev.isTrusted) move(ev); };
      const onUp = ev => { if (ev.isTrusted) up(ev); };
      addEventListener('pointermove', onMove);
      addEventListener('pointerup', onUp);
      addEventListener('pointercancel', onUp);
      unbind = () => { removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp); };
    });
    ring.addEventListener('keydown', e => {
      if (disabled) return;
      const big = e.shiftKey ? 10 : 1;
      const to = { ArrowRight: target + step * big, ArrowUp: target + step * big, ArrowLeft: target - step * big, ArrowDown: target - step * big, PageUp: target + step * 10, PageDown: target - step * 10, Home: min, End: max }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      const s = snap(to);
      reading.on = false; reading.x = s; reading.v = 0;
      commit(s, true);
      wake();
    });

    wake();
    return {
      el: root,
      get value() { return target; },
      // Une valeur venue d'ailleurs (préréglage, champ, temps qui passe). instant : sans ressort, sans traînée.
      set(v, { instant = false, exact = false } = {}) {
        if (grip) return;
        const s = step > 0 && !exact ? snap(v) : clamp(v, min, max);
        target = s;
        syncValue();
        if (instant || reduced()) { reading.on = false; reading.x = s; reading.v = 0; prev = null; vel = 0; shownText = ''; wake(); }
        else launch(s, opt.tapBounce, 0);
      },
      // Affichage libre (temps restant), sans changer la valeur réglée.
      show(r) { if (grip) return; reading.on = false; reading.x = clamp(r, min, max); reading.v = 0; prev = null; vel = 0; shownText = ''; wake(); },
      disable(b) { disabled = !!b; if (disabled && grip) { grip = null; unbind?.(); unbind = null; root.removeAttribute('data-dragging'); } syncAttrs(); },
      refresh() { shownText = ''; syncValue(); wake(); },
      destroy() { cancelAnimationFrame(raf); raf = 0; unbind?.(); unbind = null; },
    };
  };
})();
