// Menus déroulants du dashboard. Chaque <select> simple reçoit, juste après lui, un bouton (rôle combobox) et une liste
// (rôle listbox) aux couleurs du thème, au lieu de la fenêtre blanche du navigateur. Modèle WAI-ARIA « select-only combobox » :
// le focus reste sur le bouton, l'option active est annoncée par aria-activedescendant.
// Le <select> natif reste la source de vérité : valeur, événements change/input, libellés, enregistrement et tests restent
// les mêmes. Il est seulement masqué à l'écran et aux lecteurs d'écran. Sans ce script, le menu natif fonctionne comme avant.
// Rien à faire à la création d'un menu : un observateur repère chaque <select> ajouté à la page.
(() => {
  if (!('MutationObserver' in window)) return;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const VALUE = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  const INDEX = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
  const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const CHEVRON = '<svg class="dd-chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>';
  const CHECK = '<svg class="dd-check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>';
  const GAP = 6, EDGE = 8, MAX_H = 320;
  const all = new WeakMap();
  let uid = 0, current = null;

  // Le texte du <label> sans celui du menu qu'il contient (« Page », pas « Page Mon écran page2 »).
  function labelOf(sel) {
    if (sel.ariaLabel) return sel.ariaLabel;
    const l = sel.labels?.[0];
    if (!l) return '';
    const c = l.cloneNode(true);
    c.querySelectorAll('select,.dd-trigger').forEach(n => n.remove());
    return c.textContent.replace(/\s+/g, ' ').trim();
  }

  function enhance(sel) {
    const id = `dd${++uid}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dd-trigger'; // stylé par les règles du menu : `.ma-classe + .dd-trigger`
    btn.setAttribute('role', 'combobox');
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', `${id}-list`);
    btn.innerHTML = `<span class="dd-value"></span>${CHEVRON}`;
    const value = btn.firstChild;
    const list = document.createElement('div');
    list.id = `${id}-list`;
    list.className = 'dd-list';
    list.setAttribute('role', 'listbox');
    list.tabIndex = -1;
    // Couche du dessus : la liste passe au-dessus des widgets et des dialogues sans être coupée par leurs bords.
    if ('popover' in list) list.popover = 'manual';

    let items = [], active = -1, buf = '', bufTimer = 0, host = null;
    const inst = { btn, close };
    const isOpen = () => current === inst;

    function sync() {
      const o = sel.options[sel.selectedIndex];
      value.textContent = o ? o.label : '';
      btn.title = o && o.label.length > 28 ? o.label : '';
      btn.disabled = sel.disabled;
      btn.hidden = sel.hidden;
      const name = labelOf(sel);
      if (name) { btn.setAttribute('aria-label', name); list.setAttribute('aria-label', name); }
      if (isOpen()) { if (sel.disabled || !sel.options.length) close(false); else { render(); setActive(Math.min(active, items.length - 1), false); place(); } }
    }

    function render() {
      items = [];
      list.replaceChildren();
      const add = (o, parent, groupOff) => {
        if (o.hidden) return;
        const d = document.createElement('div');
        d.className = 'dd-opt';
        d.id = `${id}-o${items.length}`;
        d.setAttribute('role', 'option');
        d.setAttribute('aria-selected', String(o.selected));
        const off = o.disabled || groupOff;
        if (off) d.setAttribute('aria-disabled', 'true');
        d.innerHTML = CHECK;
        const t = document.createElement('span');
        t.className = 'dd-text';
        t.textContent = o.label;
        d.append(t);
        d.dataset.i = items.length;
        items.push({ o, d, off });
        parent.append(d);
      };
      for (const c of sel.children) {
        if (c.tagName === 'OPTGROUP') {
          const g = document.createElement('div'), h = document.createElement('div');
          g.setAttribute('role', 'group');
          h.className = 'dd-group';
          h.id = `${id}-g${list.children.length}`;
          h.textContent = c.label;
          g.setAttribute('aria-labelledby', h.id);
          g.append(h);
          for (const o of c.children) if (o.tagName === 'OPTION') add(o, g, c.disabled);
          list.append(g);
        } else if (c.tagName === 'OPTION') add(c, list, false);
      }
    }

    function setActive(i, kbd) {
      items[active]?.d.classList.remove('is-active');
      active = i;
      list.classList.toggle('is-kbd', kbd);
      const it = items[i];
      if (!it) { btn.removeAttribute('aria-activedescendant'); return; }
      it.d.classList.add('is-active');
      btn.setAttribute('aria-activedescendant', it.d.id);
      if (kbd) it.d.scrollIntoView({ block: 'nearest' });
    }
    // Option suivante non désactivée dans un sens, ou l'actuelle s'il n'y en a pas.
    function step(from, dir, n = 1) {
      let i = from, found = from;
      while (n > 0) {
        i += dir;
        if (i < 0 || i >= items.length) break;
        if (!items[i].off) { found = i; n--; }
      }
      return found;
    }
    const first = () => step(-1, 1), last = () => step(items.length, -1);

    function place() {
      const r = btn.getBoundingClientRect();
      if (!btn.isConnected || !r.width || r.bottom < 0 || r.top > innerHeight) return close(false);
      list.style.minWidth = `${Math.min(r.width, innerWidth - 2 * EDGE)}px`;
      list.style.maxHeight = '';
      const below = innerHeight - r.bottom - GAP - EDGE, above = r.top - GAP - EDGE;
      const want = Math.min(list.scrollHeight + 2, MAX_H);
      const up = below < want && above > below;
      list.style.maxHeight = `${Math.max(Math.min(MAX_H, up ? above : below), 96)}px`;
      const w = list.offsetWidth, h = list.offsetHeight;
      list.style.left = `${Math.max(EDGE, Math.min(r.left, innerWidth - EDGE - w))}px`;
      list.style.top = `${up ? Math.max(EDGE, r.top - GAP - h) : r.bottom + GAP}px`;
      list.dataset.side = up ? 'top' : 'bottom';
    }

    function open(at, kbd) {
      if (isOpen() || sel.disabled || !sel.options.length) return;
      current?.close(false);
      current = inst;
      render();
      // Dans un dialogue modal, le reste de la page est inerte ; dans un menu (popover), un clic hors de lui le fermerait.
      host = sel.closest('dialog,[popover]') || document.body;
      host.append(list);
      try { list.showPopover?.(); } catch {}
      btn.setAttribute('aria-expanded', 'true');
      place();
      const chosen = items.findIndex(x => x.o.selected && !x.off);
      const i = at ?? (chosen >= 0 ? chosen : first());
      setActive(i, kbd);
      // L'option choisie est visible, au milieu de la liste, à chaque ouverture.
      if (items[i]) list.scrollTop = items[i].d.offsetTop - (list.clientHeight - items[i].d.offsetHeight) / 2;
      if (!reduced()) list.animate([{ opacity: 0, transform: `translateY(${list.dataset.side === 'top' ? 4 : -4}px) scale(.98)` }, { opacity: 1, transform: 'none' }], { duration: 140, easing: 'cubic-bezier(.2,.8,.2,1)' });
      document.addEventListener('pointerdown', outside, true);
      addEventListener('scroll', onScroll, true);
      addEventListener('resize', place);
      host.addEventListener('close', closeQuiet);
    }
    function close(refocus = true) {
      if (!isOpen()) return;
      current = null;
      try { list.hidePopover?.(); } catch {}
      list.remove();
      btn.setAttribute('aria-expanded', 'false');
      btn.removeAttribute('aria-activedescendant');
      document.removeEventListener('pointerdown', outside, true);
      removeEventListener('scroll', onScroll, true);
      removeEventListener('resize', place);
      host?.removeEventListener('close', closeQuiet);
      if (refocus && btn.isConnected && document.activeElement !== btn) btn.focus({ preventScroll: true });
    }
    const closeQuiet = () => close(false);
    const outside = e => { if (!btn.contains(e.target) && !list.contains(e.target)) close(false); };
    const onScroll = e => { if (e.target !== list) place(); };

    function choose(i, refocus = true) {
      const it = items[i];
      if (!it || it.off) return;
      const changed = !it.o.selected;
      close(refocus);
      if (!changed) return;
      INDEX.set.call(sel, [...sel.options].indexOf(it.o));
      sync();
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Saisie au clavier : « m » va à la prochaine option en M, « mon » à « Mon écran » ; « mmm » fait défiler les M.
    function typeahead(ch) {
      clearTimeout(bufTimer);
      buf += fold(ch);
      bufTimer = setTimeout(() => { buf = ''; }, 600);
      const same = [...buf].every(c => c === buf[0]), q = same ? buf[0] : buf;
      const n = items.length, start = same || buf.length === 1 ? active + 1 : Math.max(active, 0);
      for (let k = 0; k < n; k++) {
        const i = (start + k) % n;
        if (!items[i].off && fold(items[i].o.label).startsWith(q)) return setActive(i, true);
      }
    }

    btn.addEventListener('click', () => (isOpen() ? close() : open(null, false)));
    btn.addEventListener('blur', () => close(false));
    btn.addEventListener('keyup', e => { if (e.key === ' ') e.preventDefault(); });
    btn.addEventListener('keydown', e => {
      const k = e.key, char = k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (!isOpen()) {
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(k) || k === 'Home' || k === 'End') {
          e.preventDefault();
          open(null, true);
          if (k === 'Home') setActive(first(), true);
          if (k === 'End') setActive(last(), true);
        } else if (char) { e.preventDefault(); open(null, true); typeahead(k); }
        return;
      }
      const moves = { ArrowDown: () => step(active, 1), ArrowUp: () => step(active, -1), Home: first, End: last, PageDown: () => step(active, 1, 10), PageUp: () => step(active, -1, 10) };
      if (k === 'ArrowUp' && e.altKey) { e.preventDefault(); choose(active); }
      else if (moves[k]) { e.preventDefault(); setActive(moves[k](), true); }
      else if (k === 'Enter' || (k === ' ' && !buf)) { e.preventDefault(); choose(active); }
      else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } // ne ferme pas aussi le dialogue autour
      else if (k === 'Tab') choose(active, false);
      else if (char) { e.preventDefault(); typeahead(k); }
    });
    // Le focus reste sur le bouton pendant un clic dans la liste.
    list.addEventListener('pointerdown', e => e.preventDefault());
    list.addEventListener('pointermove', e => {
      const d = e.target.closest('.dd-opt');
      if (e.pointerType === 'mouse' && d && !items[d.dataset.i].off && Number(d.dataset.i) !== active) setActive(Number(d.dataset.i), false);
    });
    list.addEventListener('click', e => { const d = e.target.closest('.dd-opt'); if (d) choose(Number(d.dataset.i)); });

    // Un clic sur le <label for> ou un sel.focus() du code arrive sur le bouton.
    sel.addEventListener('focus', () => btn.focus());
    sel.addEventListener('change', sync);
    sel.addEventListener('input', sync);
    // Les widgets écrivent sel.value = … sans événement : le bouton suit quand même.
    Object.defineProperty(sel, 'value', { configurable: true, get() { return VALUE.get.call(this); }, set(v) { VALUE.set.call(this, v); sync(); } });
    Object.defineProperty(sel, 'selectedIndex', { configurable: true, get() { return INDEX.get.call(this); }, set(v) { INDEX.set.call(this, v); sync(); } });
    new MutationObserver(sync).observe(sel, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'label', 'aria-label'] });

    sel.classList.add('dd-native');
    sel.setAttribute('aria-hidden', 'true');
    sel.tabIndex = -1;
    sel.after(btn);
    all.set(sel, inst);
    sync();
  }

  function ensure(sel) {
    if (sel.multiple || sel.size > 1 || sel.hasAttribute('data-native')) return;
    const inst = all.get(sel);
    if (!inst) return enhance(sel);
    if (sel.nextElementSibling !== inst.btn) sel.after(inst.btn); // le menu a été déplacé : son bouton le suit
  }
  const scan = n => { if (n.nodeType !== 1) return; if (n.tagName === 'SELECT') ensure(n); else n.querySelectorAll('select').forEach(ensure); };
  new MutationObserver(records => {
    for (const r of records) {
      r.addedNodes.forEach(scan);
      r.removedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        for (const s of n.tagName === 'SELECT' ? [n] : n.querySelectorAll('select')) {
          const inst = all.get(s);
          if (inst && !s.isConnected) { inst.close(false); inst.btn.remove(); }
        }
      });
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.querySelectorAll('select').forEach(ensure);
})();
