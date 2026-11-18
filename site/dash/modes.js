// Modes : la roue (OptionWheel, option-wheel.js) ouverte par un appui long ou par le bouton « Changer de mode » du menu,
// et la création d'un mode (partagée avec Personnaliser). Un mode est une page de l'écran : ce fichier ne garde aucune donnée, il passe par ctx :
//   ctx.pages() → [{ id, name, icon?, accent? }], ctx.current() → id, ctx.show(id), ctx.remove(id), ctx.canCreate() → bool,
//   ctx.create({ name, icon, accent, wall }) → page, ctx.accents() → [{ id, name, hex }], ctx.wallName() → nom du fond,
//   ctx.blocked() → vrai si un autre geste ou le verrou a la main, ctx.say(texte, annonceSeule?).
(() => {
  const PRESS_MS = 550, MOVE_PX = 10;
  // Icônes 16×16 au trait, dans le style de la barre.
  const ICONS = {
    livre: ['Livre', '<path d="M2.5 3.5c2-.8 3.8-.6 5.5.6 1.7-1.2 3.5-1.4 5.5-.6v9c-2-.8-3.8-.6-5.5.6-1.7-1.2-3.5-1.4-5.5-.6zM8 4.1v9"/>'],
    feuille: ['Feuille', '<path d="M3 13c0-6 4-9.500 10-10-.5 6-4 10-10 10zM3 13l5.500-5.500"/>'],
    cafe: ['Café', '<path d="M3 6h8v4a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM11 7h1a2 2 0 0 1 0 4h-1M5.500 2.500v1.500M8.500 2.500v1.500"/>'],
    sport: ['Sport', '<path d="M2 6.500v3M4 5v6M12 5v6M14 6.500v3M4 8h8"/>'],
    pinceau: ['Création', '<path d="M13.500 2.500 7 9M7 9l-1.500-.500L3 11c-.500.800-.500 2.500 2 2.500 1.500 0 2.500-1 2.500-2.500z"/>'],
    avion: ['Voyage', '<path d="M2 9.500 14 4l-3 9-2.500-3.500zM8.500 9.500 14 4"/>'],
    maison: ['Maison', '<path d="M2.500 7.500 8 3l5.500 4.500M4 6.500v6.500h8V6.500M6.500 13v-3.500h3V13"/>'],
    musique: ['Musique', '<path d="M6 12V3.500l7-1.500v8.500M6 12a2 2 0 1 1-2-2 2 2 0 0 1 2 2zM13 10.500a2 2 0 1 1-2-2 2 2 0 0 1 2 2z"/>'],
    coeur: ['Bien-être', '<path d="M8 13.500S2.500 10 2.500 6.300A2.800 2.800 0 0 1 8 5a2.800 2.800 0 0 1 5.500 1.300C13.500 10 8 13.500 8 13.500z"/>'],
    etoile: ['Étoile', '<path d="m8 2 1.800 3.800 4.200.500-3.100 2.900.800 4.200L8 11.300l-3.700 2.100.800-4.200L2 6.300l4.200-.500z"/>'],
  };
  const PLUS = '<path d="M8 3v10M3 8h10"/>';
  const svg = body => `<svg viewBox="0 0 16 16" aria-hidden="true">${body}</svg>`;
  const iconOf = page => ICONS[page.icon]?.[1] ?? null;
  const letter = page => [...page.name.trim()][0]?.toUpperCase() ?? '·';
  const node = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls ?? '', textContent: text ?? '' });
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Une cible sûre pour l'appui long : le fond de l'écran, ou le fond d'un widget (son cadre, son en-tête, le vide de son corps).
  // Jamais un contrôle, un champ, un texte modifiable, un dessin, un lecteur, une poignée ni le contenu d'un widget.
  const NEVER = 'button,a,input,textarea,select,label,option,summary,[contenteditable=""],[contenteditable=true],canvas,iframe,video,audio,svg,img,[role=slider],[role=listbox],[role=option],[role=button],[tabindex],.edit,.grip,.resize-handle,.custom,dialog,[popover],.topbar,.option-wheel,.notes,.comet-dial,.drop-slot,#renzvi-chat,.cahier-open';
  function safeTarget(t) {
    if (!(t instanceof Element) || t.closest(NEVER)) return false;
    if (!t.closest('#app') && t !== document.body && t !== document.documentElement && t.id !== 'wall' && !t.closest('#wall')) return false;
    const box = t.closest('.widget');
    if (!box) return true;
    // Tableau libre (labo) : l'en-tête d'un widget sert à le déplacer. Pages (labo) : l'appui long sur un widget l'édite.
    if (box.closest('[data-vue^=libre], [data-vue=pages]')) return false;
    return t === box || t.classList.contains('head') || t.classList.contains('body') || t.classList.contains('meta') || t.matches('.head > h2');
  }

  window.renzviModes = function (ctx) {
    let press = null, wheel = null, lastFocus = null;

    // ---------- Appui long ----------
    const ring = node('div', 'lp-ring');
    ring.setAttribute('aria-hidden', 'true');
    document.body.append(ring);
    function cancelPress() {
      if (!press) return;
      clearTimeout(press.timer);
      clearTimeout(press.show);
      ring.classList.remove('on');
      removeEventListener('pointermove', onMove, true);
      removeEventListener('pointerup', cancelPress, true);
      removeEventListener('pointercancel', cancelPress, true);
      removeEventListener('scroll', cancelPress, true);
      removeEventListener('blur', cancelPress);
      document.removeEventListener('selectionchange', onSelect);
      press = null;
    }
    const onMove = e => { if (press && e.pointerId === press.id && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_PX) cancelPress(); };
    const onSelect = () => { if (press && String(getSelection()).length) cancelPress(); };
    function onDown(e) {
      if (press || wheel || e.button !== 0 || !e.isPrimary || ctx.blocked() || !safeTarget(e.target)) return;
      if (String(getSelection()).length) return;
      press = { id: e.pointerId, x: e.clientX, y: e.clientY };
      press.show = setTimeout(() => {
        ring.style.left = `${press.x}px`;
        ring.style.top = `${press.y}px`;
        ring.classList.add('on');
      }, 140);
      press.timer = setTimeout(() => {
        const { x, y } = press;
        cancelPress();
        if (ctx.blocked()) return;
        // Le relâchement qui suit ne doit rien cliquer : ni dessous, ni dans la roue.
        const eat = ev => { ev.preventDefault(); ev.stopPropagation(); };
        addEventListener('click', eat, { capture: true, once: true });
        setTimeout(() => removeEventListener('click', eat, { capture: true }), 600);
        addEventListener('contextmenu', eat, { capture: true, once: true });
        setTimeout(() => removeEventListener('contextmenu', eat, { capture: true }), 600);
        open(x, y, document.activeElement);
      }, PRESS_MS);
      addEventListener('pointermove', onMove, true);
      addEventListener('pointerup', cancelPress, true);
      addEventListener('pointercancel', cancelPress, true);
      addEventListener('scroll', cancelPress, true);
      addEventListener('blur', cancelPress);
      document.addEventListener('selectionchange', onSelect);
    }
    document.addEventListener('pointerdown', onDown);

    // ---------- La roue ----------
    const dlg = node('dialog', 'mode-wheel');
    dlg.setAttribute('aria-labelledby', 'mode-wheel-title');
    const panel = node('div', 'mode-wheel__panel');
    const title = node('h2', 'mode-wheel__title', 'Changer de mode');
    title.id = 'mode-wheel-title';
    const hint = node('p', 'mode-wheel__hint');
    hint.id = 'mode-wheel-hint';
    const slot = node('div', 'mode-wheel__slot');
    panel.append(title, slot, hint);
    dlg.append(panel);
    document.body.append(dlg);
    // Un clic hors de la roue (le fond flouté) ferme.
    dlg.addEventListener('click', e => { if (!e.target.closest('.option-wheel__item')) close(); });
    dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });

    function itemNode(page, current) {
      const row = node('span', 'mw-item');
      const ic = node('span', 'mw-icon');
      const body = iconOf(page);
      if (body) ic.innerHTML = svg(body); else ic.textContent = letter(page);
      if (page.accent) ic.style.setProperty('--mw-c', page.accent);
      row.append(ic, node('span', 'mw-name', page.name));
      if (current) row.append(node('span', 'mw-now', 'Actuel'));
      return row;
    }
    function open(x, y, back) {
      if (wheel) return;
      lastFocus = back instanceof HTMLElement && back !== document.body ? back : null;
      const pages = ctx.pages(), cur = ctx.current(), canCreate = ctx.canCreate();
      const canRemove = pages.length > 1;
      hint.textContent = canRemove ? 'Choisis un mode ou maintiens-le 3 s pour le supprimer.' : 'Fais défiler, puis choisis.';
      const items = pages.map(p => ({ id: p.id, node: itemNode(p, p.id === cur), className: p.id === cur ? 'is-current' : '', hold: canRemove }));
      const create = node('span', 'mw-item mw-create');
      const ci = node('span', 'mw-icon');
      ci.innerHTML = svg(PLUS);
      create.append(ci, node('span', 'mw-name', canCreate ? 'Créer un mode' : 'Créer un mode (6 au maximum)'));
      items.push({ id: '+', node: create, className: canCreate ? 'is-create' : 'is-create is-off' });
      wheel = window.OptionWheel({
        items, fontSize: 1.6, spacing: 2.2, enter: 1.6, smoothing: 220, selected: Math.max(0, pages.findIndex(p => p.id === cur)), label: 'Modes',
        holdMs: 3000,
        onHold: item => { if (wheel) close(() => { ctx.remove(item.id); lastFocus?.focus(); }); },
        onPick: (i, item) => choose(item, wheel.el.children[i]),
      });
      wheel.el.setAttribute('aria-describedby', hint.id);
      slot.replaceChildren(wheel.el);
      // Ordre d'apparition : le mode actuel d'abord, puis ses voisins.
      const sel = wheel.selected;
      [...wheel.el.children].forEach((el, i) => el.querySelector('.mw-item')?.style.setProperty('--i', Math.abs(i - sel)));
      dlg.dataset.state = 'open';
      dlg.showModal();
      // Plein écran, roue au centre, sur un fond flouté.
      wheel.el.focus();
    }
    function close(after) {
      if (!wheel) return;
      const w = wheel;
      wheel = null;
      dlg.dataset.state = 'closing';
      const done = () => {
        w.destroy();
        if (dlg.open) dlg.close();
        dlg.dataset.state = '';
        if (after) after(); else lastFocus?.isConnected && lastFocus.focus();
      };
      if (reduced()) done(); else setTimeout(done, 160);
    }
    function choose(item, el) {
      if (item.id === '+') {
        if (!ctx.canCreate()) return;
        close(() => openCreate());
        return;
      }
      el?.classList.add('is-picked');
      const id = item.id;
      close(() => {
        if (id !== ctx.current()) {
          ctx.show(id);
          const page = ctx.pages().find(p => p.id === id);
          ctx.say(`Mode « ${page?.name ?? ''} »`, true);
        }
        lastFocus?.isConnected && lastFocus.focus();
      });
    }

    // ---------- Créer un mode ----------
    const cdlg = node('dialog', 'glass mode-create');
    cdlg.setAttribute('aria-labelledby', 'mode-create-title');
    document.body.append(cdlg);
    function openCreate() {
      if (!ctx.canCreate()) { ctx.say('Six modes au maximum. Supprime-en un pour en créer un autre.'); return; }
      const back = document.activeElement;
      const form = node('form', 'mc-form');
      form.noValidate = true;
      const h = node('h2', '', 'Créer un mode');
      h.id = 'mode-create-title';
      // Nom
      const nameRow = node('div', 'mc-field');
      const nameLabel = node('label', '', 'Nom du mode');
      nameLabel.htmlFor = 'mc-name';
      const name = Object.assign(node('input'), { id: 'mc-name', type: 'text', maxLength: 24, autocomplete: 'off', placeholder: 'Par exemple : Sport' });
      const nameErr = node('p', 'mc-err');
      nameErr.id = 'mc-name-err';
      nameErr.setAttribute('aria-live', 'polite');
      name.setAttribute('aria-describedby', 'mc-name-err');
      name.oninput = () => { nameErr.textContent = ''; name.removeAttribute('aria-invalid'); };
      nameRow.append(nameLabel, name, nameErr);
      // Icône
      const icons = node('fieldset', 'mc-icons');
      icons.append(node('legend', '', 'Icône'));
      const iconRow = node('div', 'mc-grid');
      Object.entries(ICONS).forEach(([id, [label, body]], i) => {
        const l = node('label', 'mc-icon');
        const r = Object.assign(node('input'), { type: 'radio', name: 'mc-icon', value: id, checked: i === 0 });
        r.ariaLabel = label;
        const s = node('span');
        s.innerHTML = svg(body);
        l.append(r, s);
        l.title = label;
        iconRow.append(l);
      });
      icons.append(iconRow);
      // Accent
      const acc = node('fieldset', 'mc-accents');
      acc.append(node('legend', '', 'Couleur du mode'));
      const accRow = node('div', 'mc-grid');
      const keep = node('label', 'mc-chip');
      keep.append(Object.assign(node('input'), { type: 'radio', name: 'mc-acc', value: '', checked: true }), node('span', '', 'Celle de l’écran'));
      accRow.append(keep);
      for (const a of ctx.accents()) {
        const l = node('label', 'mc-swatch');
        const r = Object.assign(node('input'), { type: 'radio', name: 'mc-acc', value: a.id });
        r.ariaLabel = a.name;
        const s = node('span');
        s.style.setProperty('--c', a.hex);
        l.append(r, s);
        l.title = a.name;
        accRow.append(l);
      }
      acc.append(accRow);
      // Départ
      const from = node('fieldset', 'mc-from');
      from.append(node('legend', '', 'Pour commencer'));
      const fromRow = node('div', 'mc-stack');
      const opt = (value, text, checked) => {
        const l = node('label', 'mc-chip');
        l.append(Object.assign(node('input'), { type: 'radio', name: 'mc-from', value, checked }), node('span', '', text));
        return l;
      };
      fromRow.append(opt('vide', 'Un mode vide, fond blanc', true), opt('fond', `Le même fond que maintenant (${ctx.wallName()})`, false));
      from.append(fromRow, node('p', 'mc-help', 'Chaque widget existe une seule fois, avec son contenu : il vit dans un mode à la fois. Le nouveau mode démarre donc sans widget, et rien n’est copié ni dupliqué. Tu y ajoutes ensuite les widgets que tu veux.'));
      const actions = node('div', 'actions');
      const cancel = Object.assign(node('button', 'ghost', 'Annuler'), { type: 'button', onclick: () => cdlg.close() });
      actions.append(cancel, Object.assign(node('button', 'primary', 'Créer le mode'), { type: 'submit' }));
      form.append(h, nameRow, icons, acc, from, actions);
      form.onsubmit = e => {
        e.preventDefault();
        const value = name.value.trim().replace(/\s+/g, ' ');
        const taken = ctx.pages().some(p => p.name.toLocaleLowerCase('fr') === value.toLocaleLowerCase('fr'));
        const err = !value ? 'Donne un nom à ce mode.' : taken ? 'Un mode porte déjà ce nom.' : '';
        nameErr.textContent = err;
        name.setAttribute('aria-invalid', !!err);
        if (err) { name.focus(); return; }
        const data = new FormData(form);
        const page = ctx.create({ name: value, icon: data.get('mc-icon'), accent: data.get('mc-acc') || null, sameWall: data.get('mc-from') === 'fond' });
        cdlg.close();
        if (page) { ctx.show(page.id); ctx.say(`Mode « ${page.name} » créé. Ajoute-lui des widgets.`); ctx.afterCreate?.(); }
      };
      cdlg.replaceChildren(form);
      cdlg.onclose = () => { if (back?.isConnected && !cdlg.dataset.done) back.focus(); };
      cdlg.showModal();
      name.focus();
    }

    return {
      open: (x, y, back) => open(x, y, back),
      close: () => { cancelPress(); close(); if (cdlg.open) cdlg.close(); },
      openCreate,
      iconSvg: page => (iconOf(page) ? svg(iconOf(page)) : null),
      icons: Object.keys(ICONS),
      isOpen: () => !!wheel || cdlg.open,
    };
  };
  window.renzviModes.icons = Object.keys(ICONS);
})();
