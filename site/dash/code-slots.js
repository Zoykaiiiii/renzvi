// Cases de code à chiffres. Adapté de « CodeSlots » de React Bits (https://reactbits.dev, licence MIT + Commons Clause),
// réécrit en JS natif (ni React, ni motion, ni Hugeicons) : les ressorts deviennent des transitions CSS avec un léger
// rebond, la cascade des délais, la coche un petit SVG. Même comportement : un seul champ invisible au-dessus des cases
// (clavier numérique, collage, remplissage automatique), Retour arrière, flèches, Début/Fin, état erreur qui vide les cases
// de la dernière à la première, état réussite qui les fond en une seule pastille.
// C'est un champ de saisie, pas une authentification : la vérification se fait ailleurs (lock.js).
(() => {
  const CASCADE = 20, SETTLE = 300;
  const digitsOf = raw => String(raw ?? '').replace(/\D/g, '');

  window.CodeSlots = function CodeSlots(o = {}) {
    const opt = { length: 6, label: 'Code', mask: true, onChange: null, onComplete: null, describedBy: '', ...o };
    const n = opt.length;
    let slots = Array(n).fill(''), active = 0, status = 'idle', busy = false, disabled = false, drainTimer = 0;

    const root = document.createElement('div');
    root.className = 'code-slots';
    const row = document.createElement('div');
    row.className = 'code-slots__row';
    row.dataset.status = 'idle';
    const input = Object.assign(document.createElement('input'), {
      className: 'code-slots__input', type: 'text', inputMode: 'numeric', autocomplete: 'off', pattern: '[0-9]*', maxLength: n, value: '',
    });
    input.setAttribute('aria-label', opt.label);
    input.setAttribute('autocorrect', 'off');
    input.spellcheck = false;
    const count = document.createElement('span');
    count.className = 'code-slots__sr';
    count.setAttribute('aria-live', 'polite');
    count.id = `cs-${Math.random().toString(36).slice(2, 8)}`;
    input.setAttribute('aria-describedby', [count.id, opt.describedBy].filter(Boolean).join(' '));
    row.append(input);
    const cells = Array.from({ length: n }, () => {
      const s = document.createElement('span');
      s.className = 'code-slots__slot';
      s.setAttribute('aria-hidden', 'true');
      const fill = document.createElement('span');
      fill.className = 'code-slots__fill';
      const digit = document.createElement('span');
      digit.className = 'code-slots__digit';
      s.append(fill, digit);
      row.append(s);
      return { s, fill, digit };
    });
    const wash = document.createElement('span');
    wash.className = 'code-slots__wash';
    wash.setAttribute('aria-hidden', 'true');
    wash.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12.500 10 17.500 19.500 7"/></svg>';
    const caret = document.createElement('span');
    caret.className = 'code-slots__caret';
    caret.setAttribute('aria-hidden', 'true');
    row.append(wash, caret);
    root.append(row, count);

    const firstEmpty = () => { const i = slots.indexOf(''); return i === -1 ? n - 1 : i; };
    function paint(delays = {}) {
      cells.forEach((c, i) => {
        const filled = !!slots[i];
        c.s.toggleAttribute('data-filled', filled);
        c.s.toggleAttribute('data-active', document.activeElement === input && i === active && status !== 'success');
        c.s.style.setProperty('--delay', `${delays[i] ?? 0}ms`);
        if (filled) c.digit.textContent = opt.mask ? '•' : slots[i];
      });
      caret.style.setProperty('--x', active);
      caret.toggleAttribute('data-show', document.activeElement === input && !disabled && status === 'idle' && !slots[active]);
      count.textContent = status === 'success' ? 'Code accepté' : `${slots.filter(Boolean).length} chiffres sur ${n}`;
    }
    function commit(next, delays) {
      const was = slots.every(Boolean);
      slots = next;
      paint(delays);
      opt.onChange?.(slots.join(''));
      if (!was && slots.every(Boolean)) opt.onComplete?.(slots.join(''));
    }
    function insert(raw, from = active) {
      const d = digitsOf(raw);
      if (!d) return;
      const next = [...slots], delays = {};
      let i = from;
      for (const ch of d) { if (i >= n) break; next[i] = ch; delays[i] = (i - from) * CASCADE; i++; }
      active = Math.min(i, n - 1);
      commit(next, delays);
    }
    function clearAt(i, back) {
      if (!slots[i]) { if (back) { active = i; paint(); } return; }
      const next = [...slots];
      next[i] = '';
      if (back) active = i;
      commit(next);
    }
    const locked = () => disabled || busy || status === 'success';
    input.addEventListener('keydown', e => {
      if (locked() || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (/^[0-9]$/.test(k)) { e.preventDefault(); if (status === 'error') setStatus('idle'); insert(k); }
      else if (k === 'Backspace') { e.preventDefault(); if (slots[active]) clearAt(active); else if (active > 0) clearAt(active - 1, true); }
      else if (k === 'Delete') { e.preventDefault(); clearAt(active); }
      else if (k === 'ArrowLeft') { e.preventDefault(); active = Math.max(active - 1, 0); paint(); }
      else if (k === 'ArrowRight') { e.preventDefault(); active = Math.min(active + 1, n - 1); paint(); }
      else if (k === 'Home') { e.preventDefault(); active = 0; paint(); }
      else if (k === 'End') { e.preventDefault(); active = n - 1; paint(); }
    });
    input.addEventListener('paste', e => { if (locked()) return; e.preventDefault(); insert(e.clipboardData.getData('text'), 0); });
    // Clavier de téléphone et remplissage automatique : la saisie arrive par « input ».
    input.addEventListener('input', () => {
      const d = digitsOf(input.value);
      input.value = '';
      if (locked() || !d) return;
      insert(d, d.length === 1 ? active : 0);
    });
    input.addEventListener('focus', () => paint());
    input.addEventListener('blur', () => paint());
    row.addEventListener('mousedown', e => {
      if (disabled) return;
      e.preventDefault();
      if (!busy && status !== 'success') {
        const r = row.getBoundingClientRect(), i = Math.floor(((e.clientX - r.left) / r.width) * n);
        active = Math.max(0, Math.min(i, firstEmpty()));
      }
      input.focus();
      paint();
    });

    function setStatus(s) {
      status = s;
      row.dataset.status = s;
      input.setAttribute('aria-invalid', s === 'error');
      input.readOnly = s === 'success';
      if (s === 'error') {
        // Vidage de la dernière case remplie à la première, puis remise à zéro.
        const filled = slots.map((c, i) => (c ? i : -1)).filter(i => i >= 0).reverse();
        busy = true;
        filled.forEach((i, k) => cells[i].s.style.setProperty('--delay', `${k * CASCADE}ms`));
        row.classList.add('draining');
        clearTimeout(drainTimer);
        drainTimer = setTimeout(() => {
          row.classList.remove('draining');
          busy = false;
          active = 0;
          commit(Array(n).fill(''));
        }, Math.max(0, filled.length - 1) * CASCADE + SETTLE);
      }
      paint();
    }
    paint();
    return {
      el: root,
      focus: () => input.focus(),
      clear: () => { clearTimeout(drainTimer); busy = false; row.classList.remove('draining'); active = 0; setStatus('idle'); commit(Array(n).fill('')); },
      setStatus,
      disable(b) { disabled = !!b; input.disabled = disabled; row.toggleAttribute('data-disabled', disabled); paint(); },
      destroy: () => clearTimeout(drainTimer),
    };
  };
})();
