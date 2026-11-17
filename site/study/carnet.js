// Carnet : la vue agrandie du Cahier (cahier.js). Même widget, même cours, même lecteur : ce fichier ajoute autour de lui
// une barre (onglets Cours / Mes notes / Révisions, recherche, signet, menu), la liste des chapitres à gauche, et à droite
// les annotations du chapitre et les signets. Rien n'est recréé : fermer rend le widget compact tel qu'il était.
// Annotations (table study_annotations) : surligner, souligner, noter un passage. Elles ne modifient jamais le fichier
// importé : elles visent le texte extrait par page + position + longueur et gardent le texte cité. Si ce texte ne se
// retrouve plus là (ni une seule fois ailleurs dans la page), l'annotation est dite « introuvable », jamais déplacée au hasard.
// Elles sont peintes avec l'API CSS Highlight : le texte du cours reste un seul nœud, la sélection et la copie du
// navigateur ne changent pas. Sans cette API (vieux navigateurs), les annotations restent listées dans la marge.
// Utilise el, button, plural, listOf (dashboard.html), cahierChapterAt, cahierFold (cahier.js), cartesLoad (cartes.js),
// revisionsQueue, revisionsWidget (revisions.js).
const CARNET = { quote: 2000, note: 4000, signet: 80, colors: [['jaune', 'jaune'], ['vert', 'vert'], ['bleu', 'bleu'], ['rose', 'rose']] };

// Le passage du lecteur en (page, position, longueur) → un Range dans son bloc de texte ; null s'il n'est pas affiché.
function carnetRange(reader, page, pos, length) {
  for (const b of reader.querySelectorAll('.cahier-block')) {
    const start = +b.dataset.start, node = b.firstChild;
    if (+b.dataset.page !== page || !node || pos < start || pos > start + node.length) continue;
    const r = document.createRange();
    r.setStart(node, pos - start);
    r.setEnd(node, Math.min(node.length, pos - start + length));
    return r;
  }
  return null;
}
// La position dans le texte sous un point de l'écran.
function carnetCaret(x, y) {
  let node, off;
  if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); node = p?.offsetNode; off = p?.offset; }
  else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); node = r?.startContainer; off = r?.startOffset; }
  const block = node?.nodeType === 3 ? node.parentElement?.closest('.cahier-block') : null;
  return block ? { page: +block.dataset.page, pos: +block.dataset.start + off } : null;
}
// Le premier endroit du texte visible en haut du lecteur : ce qu'on garde pour un signet ou pour retrouver sa place
// quand la mise en page change (agrandir, réduire, tourner l'écran).
function carnetTop(reader) {
  const top = reader.getBoundingClientRect().top;
  for (const b of reader.querySelectorAll('.cahier-block')) {
    const r = b.getBoundingClientRect();
    if (r.bottom <= top + 4 || !b.firstChild) continue;
    if (r.top >= top) return { page: +b.dataset.page, pos: +b.dataset.start };
    return carnetCaret(r.left + 2, top + 6) ?? { page: +b.dataset.page, pos: +b.dataset.start };
  }
  return null;
}
function carnetScroll(reader, page, pos) {
  const r = carnetRange(reader, page, pos, 1);
  if (r) reader.scrollTop += r.getBoundingClientRect().top - reader.getBoundingClientRect().top - 2; // 2 px : carnetTop relit la même ligne
  return !!r;
}

window.cahierCarnet = function cahierCarnet(api) {
  const { box, body, view, sb } = api;
  let open = false, tab = 'cours', marks = [], marksFor = null, marksState = 'idle', lastColor = 'jaune';
  let draft = null, barCtx = null, back = null, keepTop = null, sheet = null, selTimer = 0, gone = false;
  let rev = null; // { state, decks } de l'onglet Révisions
  let chapNotes = new Map(), chapNotesFor = null; // notes de chapitre (study_notes), partagées avec « Mon espace Study »
  const wide = matchMedia('(min-width:1100px)');
  let sideOn = false, marginOn = wide.matches;

  // --- Cadre -----------------------------------------------------------------------------------------------------
  // En haut : retour, fil (matière / cours), Personnaliser, signet, fermer. Dessous : Chapitres, onglets, Aa, recherche.
  // Au milieu : le cours, et « Mes notes » à droite. En bas : chapitre n sur N, progression, chapitre suivant.
  const icon = d => `<svg viewBox="0 0 16 16" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    retour: '<path d="M13 8H3.500M7.500 4L3.500 8l4 4"/>',
    reglages: '<path d="M2.500 5h6M11.500 5h2M2.500 11h2M7.500 11h6"/><circle cx="10" cy="5" r="1.500"/><circle cx="6" cy="11" r="1.500"/>',
    signet: '<path d="M4.500 2.500h7v11L8 10.800 4.500 13.500z"/>',
    fermer: '<path d="M4 4l8 8M12 4l-8 8"/>',
    liste: '<path d="M5.500 4h8M5.500 8h8M5.500 12h8M2.500 4h.500M2.500 8h.500M2.500 12h.500"/>',
    chercher: '<circle cx="7" cy="7" r="4.300"/><path d="M10.200 10.200L13.500 13.500"/>',
    notes: '<path d="M3 3.500h10v7H8.500L6 12.800V10.500H3z"/>',
    copier: '<rect x="5.500" y="5.500" width="8" height="8" rx="1.500"/><path d="M10.500 3.500v-.500A1 1 0 0 0 9.500 2H3a1 1 0 0 0-1 1v6.500a1 1 0 0 0 1 1h.500"/>',
    surligner: '<path d="M9.500 3l3.500 3.500-5.500 5.500H4v-3.500z"/><path d="M2.500 14h11"/>',
    souligner: '<path d="M4.500 2.500v5a3.500 3.500 0 0 0 7 0v-5M3.500 14h9"/>',
    note: '<path d="M2.500 3.500h11v7.500H8l-3 2.500v-2.500H2.500z"/><path d="M5 6.500h6M5 8.800h4"/>',
    plus: '<circle cx="3.500" cy="8" r=".800"/><circle cx="8" cy="8" r=".800"/><circle cx="12.500" cy="8" r=".800"/>',
    corbeille: '<path d="M3 4.500h10M6.500 4.500V3h3v1.500M4.500 4.500l.600 9h5.800l.600-9"/>',
    ajouter: '<path d="M8 3v10M3 8h10"/>',
    suivant: '<path d="M3 8h9.500M8.500 4l4 4-4 4"/>',
    coche: '<path d="M3 8.500l3 3 7-7"/>',
    chevron: '<path d="M6 3.500L10.500 8 6 12.500"/>',
  };
  const iconBtn = (cls, d, label, onClick) => {
    const b = button(`carnet-icon ${cls}`.trim(), '', onClick);
    b.innerHTML = icon(d);
    if (label) b.ariaLabel = b.title = label;
    return b;
  };
  // Un bouton avec icône et libellé visible.
  const labelBtn = (cls, d, label, onClick) => {
    const b = button(cls, '', onClick);
    b.innerHTML = icon(d);
    b.append(el('span', '', label));
    return b;
  };
  const top = el('header', 'carnet-top');
  const closeLabel = api.retour ?? 'Retour au tableau';
  const backBtn = labelBtn('carnet-back', ICONS.retour, closeLabel, () => api.close());
  const name = el('p', 'carnet-name');
  const status = el('span', 'carnet-status');
  status.setAttribute('role', 'status');
  const signetBtn = iconBtn('carnet-signet', ICONS.signet, '', toggleSignet);
  const closeBtn = iconBtn('carnet-close', ICONS.fermer, 'Fermer le cahier', () => api.close());

  const sub = el('div', 'carnet-subbar');
  const sideBtn = labelBtn('carnet-chap-btn', ICONS.liste, 'Chapitres', () => { sideOn = !sideOn; if (sideOn) drawMenu(); layout(); if (sideOn) side.querySelector('[aria-current], button')?.focus(); });
  sideBtn.setAttribute('aria-controls', 'carnet-side');
  sideBtn.ariaLabel = 'Chapitres'; // le libellé visible disparaît sur petit écran
  const tabs = el('div', 'carnet-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.ariaLabel = 'Parties du carnet';
  const TABS = [['cours', 'Cours'], ['notes', 'Mes notes'], ['revisions', 'Révisions']];
  const tabBtns = TABS.map(([id, label]) => {
    const b = button('', label, () => setTab(id));
    b.setAttribute('role', 'tab');
    b.dataset.tab = id;
    return b;
  });
  tabs.append(...tabBtns);
  tabs.onkeydown = e => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const i = (TABS.findIndex(([id]) => id === tab) + d + TABS.length) % TABS.length;
    setTab(TABS[i][0]);
    tabBtns[i].focus();
  };
  const find = Object.assign(el('input', 'cahier-search carnet-find'), { type: 'search', placeholder: 'Chercher dans le cours', ariaLabel: 'Chercher dans le cours', autocomplete: 'off', maxLength: 80 });
  find.oninput = () => { if (tab !== 'cours') setTab('cours'); api.search(find.value); };
  find.onkeydown = e => { if (e.key === 'Escape' && !find.value) { e.stopPropagation(); setFind(false); findBtn.focus(); } };
  const findBtn = iconBtn('carnet-find-btn', ICONS.chercher, 'Chercher dans le cours', () => setFind(!findOn));
  findBtn.setAttribute('aria-expanded', 'false');
  let findOn = false;
  function setFind(on) {
    findOn = on;
    box.classList.toggle('carnet-find-on', on);
    findBtn.setAttribute('aria-expanded', on);
    if (on) find.focus();
    else if (find.value) { find.value = ''; api.search(''); }
  }
  const marginBtn = iconBtn('carnet-margin-btn', ICONS.notes, '', () => { marginOn = !marginOn; layout(); if (marginOn) margin.querySelector('button, textarea')?.focus(); });
  const aaBtn = button('carnet-icon carnet-aa', 'Aa', () => { lookView = 'texte'; setLook(lookPanel.hidden || lookView !== 'texte'); });
  aaBtn.ariaLabel = aaBtn.title = 'Police et taille du texte';
  aaBtn.setAttribute('aria-haspopup', 'dialog');
  // --- Apparence du carnet : Papier, Verre (le fond d'écran se devine derrière), Sombre ; police, taille, interligne.
  // Gardée sur cet appareil (localStorage), limitée au carnet : le tableau, le logo et le reste de l'appli ne changent pas.
  // Tout s'applique tout de suite (aperçu en direct) ; « Réinitialiser » revient au réglage de départ (Verre).
  const LOOK_KEY = 'renzvi:carnet-look';
  const LOOK0 = { surface: 'verre', opacite: 72, flou: 24, police: 'editoriale', taille: 19, interligne: 1.55, accent: 'auto', papier: 'creme' };
  // Couleur d'accent (onglet actif, boutons, signet…) : une teinte foncée pour le papier, une claire pour le verre et le sombre.
  const ACCENTS = [['auto', 'Par défaut', '#55653a', '#f1d6a3'], ['vert', 'Vert', '#2e6b4f', '#9fd6b8'], ['bleu', 'Bleu', '#2f5d8a', '#a9c7e8'], ['brique', 'Brique', '#9a3b2e', '#f0a99c'], ['prune', 'Prune', '#6a4c93', '#cdb8ec'], ['rose', 'Rose', '#9c3d6b', '#f2b3cf'],
    ['noir', 'Noir', '#1d1b18', '#121110', '#fff', '#fff'], ['blanc', 'Blanc', '#ffffff', '#ffffff', '#1d1b18', '#1d1b18']];
  // Couleur du papier (surface Papier) : le fond, puis la feuille un ton plus claire.
  const PAPIERS = [['creme', 'Crème', '#f4efe4', '#fbf8f1'], ['blanc', 'Blanc', '#f7f7f5', '#ffffff'], ['gris', 'Gris', '#eceef0', '#f6f7f8'], ['sable', 'Sable', '#ebe0cb', '#f5eddd'], ['rose', 'Rose', '#f5e8e4', '#fbf3f0'], ['vert', 'Vert d’eau', '#e6ede6', '#f2f6f1'], ['bleu', 'Bleu ciel', '#e6ecf2', '#f2f5f9']];
  const SURFACES = [['papier', 'Papier'], ['verre', 'Verre'], ['sombre', 'Sombre']];
  const POLICES = [['editoriale', 'Éditoriale'], ['sans', 'Sans empattement']];
  const INTERLIGNES = [[1.45, 'Serré'], [1.55, 'Normal'], [1.8, 'Aéré']];
  const clampN = (v, a, b, d) => Number.isFinite(+v) ? Math.min(b, Math.max(a, +v)) : d;
  let look = { ...LOOK0 }, lookView = 'main';
  try {
    const l = JSON.parse(localStorage.getItem(LOOK_KEY) || 'null');
    if (l) look = {
      surface: SURFACES.some(([k]) => k === l.surface) ? l.surface : LOOK0.surface,
      opacite: clampN(l.opacite, 40, 96, LOOK0.opacite), flou: clampN(l.flou, 0, 40, LOOK0.flou),
      police: POLICES.some(([k]) => k === l.police) ? l.police : LOOK0.police,
      taille: clampN(l.taille, 15, 24, LOOK0.taille), interligne: INTERLIGNES.some(([v]) => v === l.interligne) ? l.interligne : LOOK0.interligne,
      accent: ACCENTS.some(([k]) => k === l.accent) ? l.accent : LOOK0.accent,
      papier: PAPIERS.some(([k]) => k === l.papier) ? l.papier : LOOK0.papier,
    };
  } catch {}
  function applyLook(keep = true) {
    box.dataset.surface = look.surface;
    box.dataset.police = look.police;
    box.style.setProperty('--cn-alpha', String(look.opacite / 100));
    box.style.setProperty('--cn-blur', `${look.flou}px`);
    box.style.setProperty('--cn-size', `${look.taille}px`);
    box.style.setProperty('--cn-lh', String(look.interligne));
    const acc = ACCENTS.find(([k]) => k === look.accent), clair = look.surface === 'papier';
    if (acc && look.accent !== 'auto') { box.style.setProperty('--accent', clair ? acc[2] : acc[3]); box.style.setProperty('--on-accent', (clair ? acc[4] : acc[5]) ?? (clair ? '#fff' : '#231d16')); }
    else { box.style.removeProperty('--accent'); box.style.removeProperty('--on-accent'); }
    const pap = PAPIERS.find(([k]) => k === look.papier);
    for (const [v, i] of [['--ground', 2], ['--paper', 3], ['--field', 3], ['--cn-raise', 3]]) {
      if (clair && pap && look.papier !== 'creme') box.style.setProperty(v, pap[i]); else box.style.removeProperty(v);
    }
    if (keep) try { localStorage.setItem(LOOK_KEY, JSON.stringify(look)); } catch {}
  }
  const lookBtn = labelBtn('carnet-look-btn', ICONS.reglages, 'Personnaliser', () => { lookView = 'main'; setLook(lookPanel.hidden || lookView !== 'main'); });
  lookBtn.ariaLabel = 'Personnaliser';
  lookBtn.setAttribute('aria-haspopup', 'dialog');
  lookBtn.setAttribute('aria-expanded', 'false');
  const lookPanel = el('div', 'carnet-look');
  lookPanel.hidden = true;
  lookPanel.setAttribute('role', 'dialog');
  lookPanel.ariaLabel = 'Apparence du cahier';
  function setLook(on) {
    lookPanel.hidden = !on;
    lookBtn.setAttribute('aria-expanded', on && lookView === 'main');
    aaBtn.setAttribute('aria-expanded', on && lookView === 'texte');
    if (on) { drawLook(); lookPanel.querySelector('[aria-pressed=true], button')?.focus(); }
  }
  function choix(label, list, value, onPick, cls = '') {
    const g = el('div', `carnet-look-row ${cls}`);
    g.setAttribute('role', 'group');
    g.ariaLabel = label;
    for (const [v, t] of list) {
      const b = button(`carnet-look-opt carnet-look-${v}`, '', () => { onPick(v); applyLook(); drawLook(); lookPanel.querySelector(`[aria-label="${label}"] [data-v="${v}"]`)?.focus(); });
      b.dataset.v = String(v);
      if (cls === 'carnet-look-surfaces') { const i = el('i', ''); i.innerHTML = icon(ICONS.coche); b.append(i); }
      b.append(el('span', '', t));
      b.setAttribute('aria-pressed', String(v === value));
      g.append(b);
    }
    return g;
  }
  function curseur(label, min, max, value, unit, onInput) {
    const wrap = el('label', 'carnet-look-range');
    const val = el('span', 'carnet-look-val', `${value}${unit}`);
    const input = Object.assign(el('input'), { type: 'range', min, max, value });
    input.style.setProperty('--p', `${(value - min) / (max - min) * 100}%`); // partie remplie dès l'ouverture
    input.oninput = () => { onInput(+input.value); val.textContent = `${input.value}${unit}`; applyLook(); };
    wrap.append(el('span', 'carnet-look-label', label), val, input); // comme « Verre des widgets » : nom et valeur, puis la barre
    return wrap;
  }
  function drawLook() {
    const parts = [];
    if (lookView === 'main') {
      parts.push(el('h3', '', 'Apparence du cahier'), choix('Surface', SURFACES, look.surface, v => { look.surface = v; }, 'carnet-look-surfaces'));
      if (look.surface === 'verre') parts.push(curseur('Opacité', 40, 96, look.opacite, ' %', v => { look.opacite = v; }), curseur('Flou', 0, 40, look.flou, ' px', v => { look.flou = v; }));
      // Une rangée de pastilles (papier, accent) : choisir redessine le panneau et garde le focus sur la pastille.
      const pastilles = (cls, label, list, value, color, onPick) => {
        const g = el('div', `carnet-look-row ${cls}`);
        g.setAttribute('role', 'group');
        g.ariaLabel = label;
        for (const item of list) {
          const k = item[0];
          const b = button('carnet-look-teinte', '', () => { onPick(k); applyLook(); drawLook(); lookPanel.querySelector(`.${cls} [data-v="${k}"]`)?.focus(); });
          b.dataset.v = k;
          b.ariaLabel = item[1];
          b.title = item[1];
          b.setAttribute('aria-pressed', String(k === value));
          b.style.setProperty('--t', color(item));
          g.append(b);
        }
        return [el('p', 'carnet-look-label', label), g];
      };
      if (look.surface === 'papier') parts.push(...pastilles('carnet-look-papiers', 'Couleur du papier', PAPIERS, look.papier, p => p[2], k => { look.papier = k; }));
      const teintes = pastilles('carnet-look-accents', 'Couleur d’accent', ACCENTS, look.accent, a => (look.surface === 'papier' ? a[2] : a[3]), k => { look.accent = k; });
      parts.push(...teintes);
      const police = button('carnet-look-link', '', () => { lookView = 'texte'; drawLook(); lookPanel.querySelector('button')?.focus(); });
      police.append(el('span', '', `Police · ${POLICES.find(([k]) => k === look.police)[1]}`));
      police.insertAdjacentHTML('beforeend', icon(ICONS.chevron));
      police.ariaLabel = `Police et texte : ${POLICES.find(([k]) => k === look.police)[1]}`;
      parts.push(police);
    } else {
      const retour = button('carnet-look-back', '', () => { lookView = 'main'; drawLook(); lookPanel.querySelector('.carnet-look-link')?.focus(); });
      retour.innerHTML = icon(ICONS.retour);
      retour.append(el('span', '', 'Apparence du cahier'));
      parts.push(retour, el('h3', '', 'Police et texte'),
        choix('Police du cours', POLICES, look.police, v => { look.police = v; }),
        curseur('Taille du texte', 15, 24, look.taille, ' px', v => { look.taille = v; }),
        el('p', 'carnet-look-label', 'Interligne'), choix('Interligne', INTERLIGNES, look.interligne, v => { look.interligne = v; }));
    }
    parts.push(button('link carnet-look-reset', 'Réinitialiser', () => { look = { ...LOOK0 }; applyLook(); drawLook(); }));
    lookPanel.replaceChildren(...parts);
  }
  applyLook(false);
  const acts = el('div', 'carnet-acts');
  acts.append(status, lookBtn, signetBtn, closeBtn, lookPanel);
  top.append(backBtn, name, acts);
  const subTools = el('div', 'carnet-subtools');
  subTools.append(find, marginBtn, aaBtn, findBtn);
  sub.append(sideBtn, tabs, subTools);

  // Chapitres : un tiroir à gauche, ouvert par « Chapitres ». Les actions de gestion du cours y sont aussi.
  const side = el('nav', 'carnet-side');
  side.id = 'carnet-side';
  side.ariaLabel = 'Cours et chapitres';
  const coursePick = Object.assign(el('select', 'cahier-pick carnet-course'), { ariaLabel: 'Cours' });
  coursePick.onchange = () => { back = null; api.openCourse(coursePick.value); };
  const resume = button('link carnet-resume', '', () => { const b = back; back = null; if (b) api.reveal({ page: b.page, offset: b.pos, length: 0 }); });
  const chapters = el('ol', 'carnet-chapters');
  const menu = el('div', 'carnet-menu');
  menu.setAttribute('role', 'group');
  menu.ariaLabel = 'Gérer ce cours';
  side.append(coursePick, resume, chapters, el('h3', 'carnet-side-h', 'Gérer ce cours'), menu);

  const margin = el('aside', 'carnet-margin');
  margin.ariaLabel = 'Mes notes sur ce chapitre';
  const pane = el('div', 'carnet-pane');
  pane.hidden = true;
  // Pied : chapitre n sur N, progression dans le cours, chapitre suivant.
  const foot = el('footer', 'carnet-foot');
  const count = el('span', 'carnet-count');
  const progress = el('div', 'carnet-progress');
  progress.setAttribute('role', 'progressbar');
  progress.ariaLabel = 'Progression dans le cours';
  progress.setAttribute('aria-valuemin', '0');
  progress.setAttribute('aria-valuemax', '100');
  const fill = el('i', '');
  progress.append(fill);
  const nextBtn = button('carnet-next', '', () => { back = null; api.openChapter(api.chapter() + 1); });
  nextBtn.append(el('span', '', 'Chapitre suivant'));
  nextBtn.insertAdjacentHTML('beforeend', icon(ICONS.suivant));
  nextBtn.ariaLabel = 'Chapitre suivant';
  const prevBtn = button('carnet-next carnet-prev', '', () => { back = null; api.openChapter(api.chapter() - 1); });
  prevBtn.innerHTML = icon(ICONS.retour);
  prevBtn.append(el('span', '', 'Chapitre précédent'));
  prevBtn.ariaLabel = 'Chapitre précédent';
  foot.append(count, progress, prevBtn, nextBtn);
  const bar = el('div', 'carnet-bar');
  bar.setAttribute('role', 'toolbar');
  bar.ariaLabel = 'Annoter le passage';
  bar.hidden = true;
  // Un appui sur la barre ne doit pas effacer la sélection du texte.
  bar.addEventListener('pointerdown', e => { if (e.target.closest('button')) e.preventDefault(); });
  const layer = el('div', 'carnet-layer');
  const parts = [top, sub, side, margin, pane, foot, bar, layer];
  for (const n of parts) n.hidden = true;
  view.before(top, sub, side);
  view.after(pane, bar, margin, layer);
  body.append(foot);

  let statusTimer;
  function tell(text, bad = false) {
    status.textContent = text;
    status.classList.toggle('bad', bad);
    clearTimeout(statusTimer);
    if (text && !bad) statusTimer = setTimeout(() => { status.textContent = ''; }, 4000);
  }
  const reader = () => view.querySelector('.cahier-text');
  const chapterOf = m => { const c = api.course(); return c ? cahierChapterAt(c.chapters, m.page, m.at ?? m.pos) : 0; };
  const here = m => chapterOf(m) === api.chapter();
  const posOf = m => m.at ?? m.pos;

  function layout() {
    box.classList.toggle('carnet-side-on', open && sideOn);
    box.classList.toggle('carnet-margin-on', open && marginOn);
    sideBtn.setAttribute('aria-expanded', sideOn);
    marginBtn.setAttribute('aria-expanded', marginOn);
    const n = marks.filter(m => m.kind === 'passage' && here(m)).length;
    marginBtn.ariaLabel = marginBtn.title = `${marginOn ? 'Masquer' : 'Afficher'} mes notes${n ? ` (${n} sur ce chapitre)` : ''}`;
    marginBtn.dataset.n = n || '';
    // « Enregistré » s'affiche au pied de « Mes notes » quand la colonne est là, sinon en haut.
    placeStatus();
  }
  // Les actions de gestion sont celles du widget compact : mêmes boutons, mêmes confirmations.
  function drawMenu() {
    menu.replaceChildren(...api.tools().filter(t => !t.hidden).map(t => button(t.classList.contains('cahier-danger') ? 'cahier-danger' : '', t.textContent, () => { sideOn = false; layout(); t.click(); })));
  }
  function setTab(id) {
    if (id === tab) return;
    const r = reader();
    if (tab === 'cours' && r) keepTop = carnetTop(r);
    tab = id;
    hideBar();
    sync();
    if (id === 'cours') { const r2 = reader(); if (r2 && keepTop) carnetScroll(r2, keepTop.page, keepTop.pos); paint(); }
    if (id === 'revisions') loadRev();
  }

  // --- Annotations : chargement et repérage dans le texte ---------------------------------------------------------
  async function loadMarks(c) {
    marksFor = c.id;
    marks = [];
    marksState = 'loading';
    draft = null;
    drawMargin();
    const [q, text] = await Promise.all([
      sb.from('study_annotations').select('id,kind,page,pos,length,quote,surligne,souligne,color,note,created_at').eq('course_id', c.id).order('page').order('pos'),
      api.loadText(c).catch(() => null),
    ]);
    if (gone || marksFor !== c.id) return;
    if (q.error || !text) { marksState = 'error'; drawMargin(); return; }
    marks = listOf(q.data);
    for (const m of marks) locate(m, text.pages);
    // Notes de chapitre : un plus. Si elles ne se chargent pas, les annotations restent utilisables.
    sb.from('study_notes').select('chapter_id,body').eq('course_id', c.id).then(({ data, error }) => {
      if (gone || marksFor !== c.id || error) return;
      chapNotes = new Map(listOf(data).map(n => [n.chapter_id, n.body]));
      chapNotesFor = c.id;
      drawMargin();
    }, () => {});
    marksState = 'ready';
    refresh();
  }
  // Le texte cité est-il toujours à sa place ? Sinon, une seule autre occurrence dans la page fait foi ; sinon, introuvable.
  function locate(m, pages) {
    const page = pages[m.page] ?? '';
    delete m.at;
    m.lost = false;
    if (page.slice(m.pos, m.pos + m.quote.length) === m.quote) return;
    const first = m.quote ? page.indexOf(m.quote) : -1;
    if (first >= 0 && page.indexOf(m.quote, first + 1) < 0) m.at = first; else m.lost = true;
  }
  function refresh() {
    paint();
    drawMargin();
    drawSignet();
    layout();
    if (tab === 'notes') drawNotes();
  }

  const HL = ['carnet-jaune', 'carnet-vert', 'carnet-bleu', 'carnet-rose', 'carnet-souligne', 'carnet-note'];
  function paint() {
    if (!window.CSS?.highlights || !window.Highlight) return;
    for (const n of HL) CSS.highlights.delete(n);
    const r = reader();
    if (!open || tab !== 'cours' || !r) return;
    const groups = {};
    for (const m of marks) {
      if (m.kind !== 'passage' || m.lost) continue;
      const range = carnetRange(r, m.page, posOf(m), m.length);
      if (!range) continue;
      if (m.surligne) (groups[`carnet-${m.color}`] ??= []).push(range);
      if (m.souligne) (groups['carnet-souligne'] ??= []).push(range);
      if (!m.surligne && !m.souligne) (groups['carnet-note'] ??= []).push(range);
    }
    for (const [n, ranges] of Object.entries(groups)) CSS.highlights.set(n, new Highlight(...ranges));
  }

  // --- Écritures : jamais de succès affiché sans réponse de la base ------------------------------------------------
  const FAIL = 'Pas enregistré. Vérifie ta connexion, puis réessaie.';
  async function insert(row) {
    const c = api.course();
    if (!c || marksState !== 'ready') { tell(marksState === 'error' ? 'Les annotations ne sont pas disponibles pour le moment.' : 'Un instant, tes annotations se chargent…', marksState === 'error'); return null; }
    tell('Enregistrement…');
    const { data, error } = await sb.from('study_annotations').insert({ course_id: c.id, ...row }).select('id,kind,page,pos,length,quote,surligne,souligne,color,note,created_at').single();
    if (gone) return null;
    if (error || !data) { tell(/limite/.test(error?.message ?? '') ? 'Tu as atteint le nombre maximal d’annotations.' : FAIL, true); return null; }
    if (api.course()?.id !== c.id) return null;
    marks.push(data);
    marks.sort((a, b) => a.page - b.page || a.pos - b.pos);
    tell('Enregistré');
    refresh();
    return data;
  }
  async function patch(m, fields) {
    tell('Enregistrement…');
    const { error } = await sb.from('study_annotations').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', m.id);
    if (gone) return false;
    if (error) { tell(FAIL, true); return false; }
    Object.assign(m, fields);
    tell('Enregistré');
    refresh();
    return true;
  }
  async function remove(m) {
    tell('Suppression…');
    const { error } = await sb.from('study_annotations').delete().eq('id', m.id);
    if (gone) return false;
    if (error) { tell('Pas supprimé. Vérifie ta connexion, puis réessaie.', true); return false; }
    marks = marks.filter(x => x !== m);
    if (draft?.mark === m) draft = null;
    tell(m.kind === 'signet' ? 'Signet retiré' : 'Annotation retirée');
    refresh();
    return true;
  }
  const exact = s => marks.find(m => m.kind === 'passage' && !m.lost && m.page === s.page && posOf(m) === s.offset && m.length === s.length);
  const fromSel = s => ({ kind: 'passage', page: s.page, pos: s.offset, length: s.length, quote: s.text });
  const tooLong = s => { if (s.length <= CARNET.quote) return false; tell(`Passage trop long : ${CARNET.quote} caractères au plus.`, true); return true; };
  // Surligner et souligner sont deux gestes distincts, sur la même annotation : sans l'un ni l'autre ni note, elle disparaît.
  async function style(ctx, field, color) {
    const m = ctx.mark ?? exact(ctx.sel);
    if (color) lastColor = color;
    if (!m) {
      if (tooLong(ctx.sel)) return;
      const made = await insert({ ...fromSel(ctx.sel), [field]: true, color: lastColor });
      if (made) { getSelection()?.removeAllRanges(); hideBar(); }
      return;
    }
    const next = field === 'souligne' ? { souligne: !m.souligne } : m.surligne && (!color || m.color === color) ? { surligne: false } : { surligne: true, color: color ?? lastColor };
    const after = { ...m, ...next };
    if (!after.surligne && !after.souligne && !after.note) await remove(m); else await patch(m, next);
    getSelection()?.removeAllRanges();
    hideBar();
  }

  // --- Barre d'outils de la sélection (ou d'une annotation existante) -----------------------------------------------
  function hideBar() { bar.hidden = true; barCtx = null; }
  function showBar(ctx, rect) {
    barCtx = ctx;
    const m = ctx.mark ?? (ctx.sel && exact(ctx.sel));
    const tool = (d, label, onClick, name) => { const b = labelBtn('carnet-tool', d, label, onClick); if (name) b.ariaLabel = name; return b; };
    const text = ctx.sel?.text ?? m?.quote ?? '';
    const copy = tool(ICONS.copier, 'Copier', async () => {
      try { await navigator.clipboard.writeText(text); tell('Copié'); } catch { tell('La copie est bloquée par le navigateur : utilise Ctrl + C.', true); }
      hideBar();
    });
    const hl = tool(ICONS.surligner, 'Surligner', () => style(ctx, 'surligne'));
    hl.setAttribute('aria-pressed', !!m?.surligne);
    const ul = tool(ICONS.souligner, 'Souligner', () => style(ctx, 'souligne'));
    ul.setAttribute('aria-pressed', !!m?.souligne);
    const noteBtn = tool(ICONS.note, 'Note', () => { noteFromSel(ctx.sel, m); hideBar(); }, m?.note ? 'Modifier la note' : 'Ajouter une note');
    // Le reste à portée sans encombrer : couleur du surlignage, carte, texte à trous, explication, suppression.
    const more = iconBtn('carnet-tool carnet-more', ICONS.plus, 'Plus', () => { extra.hidden = !extra.hidden; more.setAttribute('aria-expanded', !extra.hidden); place(rect); });
    more.setAttribute('aria-expanded', 'false');
    const extra = el('div', 'carnet-extra');
    extra.hidden = true;
    const dots = el('span', 'carnet-dots');
    dots.setAttribute('role', 'group');
    dots.ariaLabel = 'Couleur du surlignage';
    for (const [id, label] of CARNET.colors) {
      const d = button('carnet-dot', '', () => style(ctx, 'surligne', id));
      d.dataset.color = id;
      d.ariaLabel = d.title = `Surligner en ${label}`;
      d.setAttribute('aria-pressed', !!m?.surligne && m.color === id);
      dots.append(d);
    }
    extra.append(dots);
    if (ctx.sel) extra.append(button('carnet-tool', 'Créer une carte', () => { hideBar(); api.makeCard('qa'); }), button('carnet-tool', 'Masquer ces mots', () => { hideBar(); api.makeCard('trou'); }), button('carnet-tool', 'Expliquer (IA)', () => { hideBar(); api.explain(); }));
    else extra.append(button('carnet-tool cahier-danger', 'Supprimer', async () => { await remove(m); hideBar(); }));
    const items = [copy, hl, ul, noteBtn, more, extra];
    bar.replaceChildren(...items);
    bar.hidden = false;
    place(rect);
  }
  // Au-dessus du passage à la souris ; dessous au doigt, où le navigateur affiche déjà ses poignées et son menu au-dessus.
  function place(rect) {
    const w = bar.offsetWidth, h = bar.offsetHeight, touch = matchMedia('(pointer:coarse)').matches;
    const above = rect.top - h - 10, below = rect.bottom + 10;
    const y = (!touch && above > 8) || below + h > innerHeight - 8 ? Math.max(8, above) : below;
    const x = Math.round(Math.max(8, Math.min(innerWidth - w - 8, rect.left + rect.width / 2 - w / 2)));
    bar.style.left = `${x}px`;
    bar.style.top = `${Math.round(y)}px`;
    // Le flou de la fenêtre (Verre) fait de la fenêtre le repère de « position: fixed » : on corrige l'écart mesuré.
    const got = bar.getBoundingClientRect();
    bar.style.left = `${x - (got.left - x)}px`;
    bar.style.top = `${Math.round(y - (got.top - y))}px`;
  }
  const onSelection = () => {
    clearTimeout(selTimer);
    selTimer = setTimeout(() => {
      if (!open || tab !== 'cours' || sheet) return;
      const s = api.selection();
      const sel = getSelection();
      if (s && sel?.rangeCount) return showBar({ sel: s }, sel.getRangeAt(0).getBoundingClientRect());
      if (barCtx?.sel && !bar.contains(document.activeElement)) hideBar();
    }, 160);
  };
  document.addEventListener('selectionchange', onSelection);
  // Un clic sur un passage déjà annoté ouvre ses réglages.
  const onClick = e => {
    if (!open || tab !== 'cours' || !e.target.closest?.('.cahier-block')) return;
    if (!getSelection()?.isCollapsed) return;
    const p = carnetCaret(e.clientX, e.clientY), r = reader();
    if (!p || !r) return hideBar();
    const hit = marks.filter(m => m.kind === 'passage' && !m.lost && m.page === p.page && p.pos >= posOf(m) && p.pos <= posOf(m) + m.length)
      .map(m => ({ m, range: carnetRange(r, m.page, posOf(m), m.length) }))
      .find(x => x.range && [...x.range.getClientRects()].some(b => e.clientX >= b.left - 2 && e.clientX <= b.right + 2 && e.clientY >= b.top - 2 && e.clientY <= b.bottom + 2));
    if (hit) showBar({ mark: hit.m }, hit.range.getBoundingClientRect()); else hideBar();
  };
  view.addEventListener('click', onClick);
  const onDown = e => {
    const t = e.target;
    if (!lookPanel.hidden && !lookPanel.contains(t) && !lookBtn.contains(t) && !aaBtn.contains(t)) setLook(false);
    if (open && sideOn && !side.contains(t) && !sideBtn.contains(t) && !t.closest?.('.dd-list')) { sideOn = false; layout(); }
    if (barCtx?.mark && !bar.contains(e.target) && !e.target.closest?.('.cahier-block')) hideBar();
  };
  document.addEventListener('pointerdown', onDown);

  // --- Notes liées à un passage ------------------------------------------------------------------------------------
  function startNote(sel, mark) {
    if (!mark && sel && tooLong(sel)) return;
    // Un brouillon en cours n'est jamais jeté par l'ouverture d'un autre : on y revient d'abord.
    if (draft?.text.trim() && draft.text !== (draft.mark?.note ?? '') && (draft.mark ?? null) !== (mark ?? null)) {
      tell('Enregistre ou annule d’abord la note en cours.', true);
    } else draft = { mark: mark ?? null, sel: mark ? null : sel, text: mark?.note ?? '' };
    marginOn = true;
    layout();
    drawMargin();
    margin.querySelector('.carnet-draft textarea')?.focus();
  }
  // « Note » sur un passage neuf : le passage entre tout de suite dans « Mes notes », le commentaire est facultatif.
  async function noteFromSel(sel, m) {
    m ??= exact(sel);
    if (m) return startNote(null, m);
    if (tooLong(sel)) return;
    if (draft?.text.trim() && draft.text !== (draft.mark?.note ?? '')) { tell('Enregistre ou annule d’abord la note en cours.', true); return; }
    const made = await insert(fromSel(sel));
    if (made) { getSelection()?.removeAllRanges(); startNote(null, made); }
  }
  // « Ajouter une note » sans passage choisi : la note du chapitre, la même que dans « Mon espace Study ».
  function startChapNote() {
    const c = api.course(), ch = c?.chapters[api.chapter()];
    if (!ch) return;
    if (draft?.text.trim() && !draft.chapitre && draft.text !== (draft.mark?.note ?? '')) { tell('Enregistre ou annule d’abord la note en cours.', true); return; }
    draft = { chapitre: true, course: c.id, chapter: ch.id, text: (chapNotesFor === c.id && chapNotes.get(ch.id)) || '' };
    marginOn = true;
    layout();
    drawMargin();
    margin.querySelector('.carnet-draft textarea')?.focus();
  }
  async function saveChapNote(d, text) {
    if (!api.user?.id) { tell(FAIL, true); return false; }
    const key = { user_id: api.user.id, course_id: d.course, chapter_id: d.chapter };
    tell('Enregistrement…');
    const { error } = text
      ? await sb.from('study_notes').upsert({ ...key, body: text, updated_at: new Date().toISOString() })
      : await sb.from('study_notes').delete().match(key);
    if (gone) return false;
    if (error) { tell(FAIL, true); return false; }
    if (chapNotesFor === d.course) text ? chapNotes.set(d.chapter, text) : chapNotes.delete(d.chapter);
    tell('Enregistré');
    return true;
  }
  async function saveDraft() {
    const d = draft, text = d.text.trim().slice(0, CARNET.note);
    if (d.chapitre) {
      if (await saveChapNote(d, text) && draft === d) { draft = null; drawMargin(); }
      return;
    }
    if (!text && !d.mark) { tell('Écris ta note avant de l’enregistrer.', true); return; }
    let ok;
    // Note vidée : le passage reste dans « Mes notes » ; on le retire avec « Supprimer ».
    if (d.mark) ok = (d.mark.note ?? '') === text || await patch(d.mark, { note: text || null });
    else ok = !!await insert({ ...fromSel(d.sel), note: text });
    // En cas de panne, le brouillon reste tel quel dans la marge.
    if (ok && draft === d) { draft = null; getSelection()?.removeAllRanges(); drawMargin(); }
  }
  function goTo(m) {
    const r = reader();
    if (r && tab === 'cours' && !back) { const t = carnetTop(r); if (t && (api.chapter() !== chapterOf(m))) back = t; }
    else if (tab !== 'cours' && keepTop && !back && api.chapter() !== chapterOf(m)) back = keepTop;
    if (tab !== 'cours') { tab = 'cours'; keepTop = null; }
    if (!wide.matches) marginOn = false;
    api.reveal({ page: m.page, offset: posOf(m), length: m.length });
  }

  function markItem(m, withChapter) {
    const li = el('li', 'carnet-mark');
    li.dataset.color = m.surligne ? m.color : '';
    if (m.kind === 'signet') {
      const c = api.course();
      const go = button('carnet-go', '', () => goTo(m));
      go.append(el('strong', '', c?.chapters[chapterOf(m)]?.title ?? 'Chapitre'), el('span', '', m.lost ? 'Endroit introuvable dans le cours actuel' : `${m.quote}…`));
      go.disabled = m.lost;
      go.ariaLabel = `Aller au signet : ${c?.chapters[chapterOf(m)]?.title ?? ''}, ${m.quote}`;
      const x = button('link', 'Retirer', () => remove(m));
      x.ariaLabel = `Retirer le signet ${m.quote}`;
      li.append(go, x);
      return li;
    }
    const h = el('p', 'carnet-mark-h');
    h.innerHTML = icon(ICONS.signet);
    h.append(el('strong', '', withChapter ? api.course()?.chapters[chapterOf(m)]?.title ?? '' : headingOf(m)));
    li.append(h);
    const q = el('blockquote', 'carnet-quote', `« ${m.quote} »`);
    if (m.souligne) q.classList.add('souligne');
    li.append(q);
    if (m.note) li.append(el('p', 'carnet-notetext', m.note));
    if (m.lost) li.append(el('p', 'carnet-lost', 'Passage introuvable dans le cours actuel : l’annotation est gardée, mais plus affichée dans le texte.'));
    const row = el('div', 'carnet-markacts');
    if (!m.lost) {
      const see = button('link', 'Voir le passage', () => goTo(m));
      see.ariaLabel = `Voir le passage : ${m.quote.slice(0, 60)}`;
      row.append(see);
    }
    const edit = button('link', m.note ? 'Modifier la note' : 'Ajouter une note', () => { if (tab !== 'cours' && !wide.matches) marginOn = true; startNote(null, m); });
    const del = button('link', 'Supprimer', () => remove(m));
    del.ariaLabel = `Supprimer l'annotation : ${m.quote.slice(0, 60)}`;
    row.append(edit, del);
    li.append(row);
    return li;
  }

  // Le sous-titre du cours sous lequel tombe un passage (sinon le titre du chapitre) : le nom de la note dans la marge.
  function headingOf(m) {
    const r = reader();
    let h = null;
    for (const b of r ? r.querySelectorAll('.cahier-block') : []) {
      const page = +b.dataset.page, start = +b.dataset.start;
      if (page > m.page || (page === m.page && start > posOf(m))) break;
      if (b.classList.contains('cahier-sous-titre')) h = b.textContent.trim();
    }
    return h ?? api.course()?.chapters[chapterOf(m)]?.title ?? 'Passage';
  }
  function placeStatus() {
    const foot = marginOn && wide.matches ? margin.querySelector('.carnet-mfoot') : null;
    if (foot) { if (status.parentNode !== foot) foot.append(status); }
    else if (status.parentNode !== acts) acts.prepend(status);
  }
  function chapItem(text) {
    const li = el('li', 'carnet-mark carnet-chapnote');
    const h = el('p', 'carnet-mark-h');
    h.innerHTML = icon(ICONS.signet);
    h.append(el('strong', '', 'Note du chapitre'));
    const row = el('div', 'carnet-markacts');
    row.append(button('link', 'Modifier', () => startChapNote()));
    li.append(h, el('p', 'carnet-notetext', text), row);
    return li;
  }
  function drawMargin() {
    const c = api.course();
    const hadKey = margin.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    const items = [];
    const head = el('div', 'carnet-mhead');
    const titles = el('div', '');
    titles.append(el('h2', 'carnet-mtitle', 'Mes notes'), el('p', 'carnet-msub', 'Liées à ce chapitre'));
    const hide = iconBtn('carnet-mclose', ICONS.fermer, 'Masquer mes notes', () => { marginOn = false; layout(); marginBtn.focus(); });
    head.append(titles, hide);
    items.push(head);
    if (draft) {
      const f = el('form', 'carnet-draft');
      const area = Object.assign(el('textarea', ''), { maxLength: CARNET.note, value: draft.text, placeholder: draft.chapitre ? 'Ta note sur ce chapitre' : 'Ta note sur ce passage', ariaLabel: draft.chapitre ? 'Note sur ce chapitre' : 'Note sur le passage cité' });
      area.dataset.key = 'brouillon';
      area.oninput = () => { draft.text = area.value; };
      const save = Object.assign(el('button', 'primary', 'Enregistrer la note'), { type: 'submit' });
      const cancel = button('ghost', 'Annuler', () => { draft = null; drawMargin(); });
      const row = el('div', 'carnet-draftacts');
      row.append(save, cancel);
      if (!draft.chapitre) f.append(el('blockquote', 'carnet-quote', `« ${draft.mark?.quote ?? draft.sel.text} »`));
      f.append(area, row);
      f.onsubmit = e => { e.preventDefault(); saveDraft(); };
      items.push(f);
    }
    const ch = c?.chapters[api.chapter()];
    const chapText = ch && chapNotesFor === c.id ? chapNotes.get(ch.id) : null;
    if (marksState === 'loading') items.push(el('p', 'carnet-hint', 'Chargement de tes notes…'));
    else if (marksState === 'error') {
      items.push(el('p', 'carnet-hint bad', 'Tes notes n’ont pas pu se charger. Le cours reste lisible.'), button('ghost', 'Réessayer', () => c && loadMarks(c)));
    } else {
      const mine = marks.filter(m => m.kind === 'passage' && here(m));
      const ul = el('ul', 'carnet-marks');
      if (chapText && !draft?.chapitre) ul.append(chapItem(chapText));
      ul.append(...mine.map(m => markItem(m)));
      if (ul.children.length) items.push(ul);
      else if (!draft) items.push(el('p', 'carnet-hint', 'Sélectionne un passage du cours pour le surligner, le souligner ou y attacher une note.'));
      const signets = marks.filter(m => m.kind === 'signet');
      if (signets.length) {
        items.push(el('h3', 'carnet-mh3', 'Signets'));
        const sl = el('ul', 'carnet-marks carnet-signets');
        sl.append(...signets.map(m => markItem(m)));
        items.push(sl);
      }
    }
    const foot = el('div', 'carnet-mfoot');
    const add = labelBtn('carnet-add', ICONS.ajouter, 'Ajouter une note', () => { const s = api.selection(); if (s) noteFromSel(s); else startChapNote(); });
    add.hidden = !!draft || marksState !== 'ready';
    foot.append(add);
    items.push(foot);
    margin.replaceChildren(...items);
    placeStatus();
    if (hadKey) margin.querySelector(`[data-key="${hadKey}"]`)?.focus();
  }

  // --- Signets : des endroits gardés exprès, à distinguer de la reprise automatique de la lecture ---------------------
  function signetHere() {
    const r = reader();
    if (!r || tab !== 'cours') return null;
    const box2 = r.getBoundingClientRect();
    return marks.find(m => {
      if (m.kind !== 'signet' || m.lost || !here(m)) return false;
      const range = carnetRange(r, m.page, posOf(m), 1);
      if (!range) return false;
      const b = range.getBoundingClientRect();
      return b.bottom > box2.top && b.top < box2.bottom;
    }) ?? null;
  }
  function drawSignet() {
    const on = signetHere(), c = api.course();
    signetBtn.disabled = !c?.text_chars || tab !== 'cours' || !reader();
    signetBtn.setAttribute('aria-pressed', !!on);
    signetBtn.ariaLabel = signetBtn.title = on ? 'Retirer le signet de cet endroit' : 'Ajouter un signet ici';
  }
  async function toggleSignet() {
    const on = signetHere(), r = reader();
    if (on) return remove(on);
    const t = r && carnetTop(r), c = api.course();
    if (!t || !c) return;
    const text = await api.loadText(c).catch(() => null);
    if (!text) return tell(FAIL, true);
    const quote = text.pages[t.page].slice(t.pos, t.pos + CARNET.signet).replace(/\s+$/, '');
    if (await insert({ kind: 'signet', page: t.page, pos: t.pos, length: 0, quote })) tell('Signet ajouté');
  }

  // --- Onglet « Mes notes » : toutes les notes du cours, avec de quoi revenir à leur passage -------------------------
  async function drawNotes() {
    const c = api.course();
    if (!c) return;
    const noted = marks.filter(m => m.kind === 'passage' && m.note), plain = marks.filter(m => m.kind === 'passage' && !m.note);
    const items = [el('h2', 'carnet-h', 'Mes notes'), el('p', 'carnet-sub', `${c.subject} — ${c.title}`)];
    if (marksState === 'loading') items.push(el('p', 'carnet-hint', 'Chargement de tes notes…'));
    else if (marksState === 'error') items.push(el('p', 'carnet-hint bad', 'Tes notes n’ont pas pu se charger.'), button('ghost', 'Réessayer', () => loadMarks(c)));
    else {
      if (noted.length) { const ul = el('ul', 'carnet-marks'); ul.append(...noted.map(m => markItem(m, true))); items.push(ul); }
      else items.push(el('p', 'carnet-hint', 'Aucune note pour ce cours. Dans l’onglet Cours, sélectionne un passage puis « Ajouter une note ».'));
      if (plain.length) {
        items.push(el('h3', 'carnet-h3', 'Passages surlignés ou soulignés'));
        const ul = el('ul', 'carnet-marks');
        ul.append(...plain.map(m => markItem(m, true)));
        items.push(ul);
      }
    }
    const chapNotes = el('div', 'carnet-chapnotes');
    items.push(chapNotes);
    pane.replaceChildren(...items);
    // Les notes de chapitre de « Mon espace Study » (study_notes) : affichées ici, modifiées là-bas.
    const { data } = await sb.from('study_notes').select('chapter_id,body').eq('course_id', c.id);
    if (gone || tab !== 'notes' || api.course() !== c || !listOf(data).length) return;
    chapNotes.append(el('h3', 'carnet-h3', 'Notes de chapitre'), ...listOf(data).map(n => {
      const d = el('div', 'carnet-mark'), i = c.chapters.findIndex(ch => ch.id === n.chapter_id);
      d.append(el('p', 'carnet-where', c.chapters[i]?.title ?? 'Chapitre retiré'), el('p', 'carnet-notetext', n.body));
      if (i >= 0) d.append(button('link', 'Ouvrir le chapitre', () => { tab = 'cours'; api.openChapter(i); }));
      return d;
    }));
  }

  // --- Onglet « Révisions » : les paquets réellement liés à ce cours, révisés avec l'outil existant -------------------
  async function loadRev() {
    const c = api.course();
    if (!c) return;
    rev = { state: 'loading', decks: [] };
    drawRev();
    try {
      const [cards, links] = await Promise.all([cartesLoad(sb), sb.from('study_links').select('chapter_id,deck').eq('course_id', c.id)]);
      if (gone || api.course() !== c) return;
      const map = new Map();
      const deck = n => map.get(n) ?? map.set(n, { name: n, born: 0, chapters: [] }).get(n);
      for (const x of cards) if (x.course_id === c.id) deck(x.deck).born++;
      for (const l of listOf(links.data)) { const ch = c.chapters.find(k => k.id === l.chapter_id); if (ch) deck(l.deck).chapters.push(ch.title); }
      rev = { state: 'ready', decks: [...map.values()].map(d => {
        const mine = cards.filter(x => x.deck === d.name), q = revisionsQueue(mine);
        return { ...d, total: mine.length, due: q.due, fresh: q.fresh };
      }).filter(d => d.total).sort((a, b) => b.due - a.due || a.name.localeCompare(b.name, 'fr')) };
    } catch { if (gone) return; rev = { state: 'error', decks: [] }; }
    if (tab === 'revisions') drawRev();
  }
  function drawRev() {
    const c = api.course();
    const items = [el('h2', 'carnet-h', 'Révisions'), el('p', 'carnet-sub', `${c.subject} — ${c.title}`)];
    if (rev.state === 'loading') items.push(el('p', 'carnet-hint', 'Chargement de tes cartes…'));
    else if (rev.state === 'error') items.push(el('p', 'carnet-hint bad', 'Tes cartes n’ont pas pu se charger.'), button('ghost', 'Réessayer', loadRev));
    else if (!rev.decks.length) items.push(el('p', 'carnet-hint', 'Aucune carte n’est liée à ce cours pour l’instant. Dans l’onglet Cours, sélectionne un passage, puis « Plus » et « Créer une carte ».'));
    else {
      const ul = el('ul', 'carnet-decks');
      for (const d of rev.decks) {
        const li = el('li', 'carnet-deck'), info = el('div', 'carnet-deckinfo');
        const from = [d.born ? `${plural(d.born, 'carte')} créée${d.born > 1 ? 's' : ''} depuis ce cours` : '', d.chapters.length ? `associé à ${d.chapters.map(t => `« ${t} »`).join(', ')}` : ''].filter(Boolean).join(' · ');
        info.append(el('strong', '', d.name), el('span', '', `${plural(d.total, 'carte')} · ${d.due ? `${d.due} à revoir` : 'rien à revoir aujourd’hui'}${d.fresh ? ` · ${plural(d.fresh, 'nouvelle')}` : ''}`), el('small', '', from));
        const go = button(d.due || d.fresh ? 'primary' : 'ghost', d.due || d.fresh ? 'Réviser' : 'S’entraîner', e => openReview(d.name, !(d.due || d.fresh), e.currentTarget));
        go.ariaLabel = `${d.due || d.fresh ? 'Réviser' : 'S’entraîner sur'} le paquet ${d.name}`;
        li.append(info, go);
        ul.append(li);
      }
      items.push(ul);
    }
    pane.replaceChildren(...items);
  }
  // La révision s'ouvre par-dessus le carnet et se referme sur lui : même cours, même chapitre, même endroit.
  function openReview(deck, libre, from) {
    const s = el('section', 'widget carnet-sheet');
    s.setAttribute('role', 'dialog');
    s.setAttribute('aria-modal', 'true');
    s.ariaLabel = `${libre ? 'S’entraîner' : 'Réviser'} · ${deck}`;
    const head = el('div', 'head carnet-sheethead');
    const backBtn = button('ghost', '← Retour au cours', () => closeSheet());
    const m = el('p', 'meta');
    head.append(backBtn, el('h2', '', s.ariaLabel), m);
    const b = el('div', 'body');
    s.append(head, b);
    for (const n of [top, sub, side, view, pane, margin, foot]) n.inert = true;
    layer.append(s);
    sheet = { node: s, from, cleanup: null };
    try { sheet.cleanup = revisionsWidget({ body: b, meta: m, sb, data: { deck, libre }, save() {} }) ?? null; }
    catch (e) { console.error(e); b.replaceChildren(el('p', 'msg', 'La révision n’a pas pu s’ouvrir.')); }
    backBtn.focus();
  }
  function closeSheet(refocus = true) {
    if (!sheet) return;
    const s = sheet;
    sheet = null;
    try { s.cleanup?.(); } catch (e) { console.error(e); }
    s.node.remove();
    for (const n of [top, sub, side, view, pane, margin, foot]) n.inert = false;
    if (tab === 'revisions') loadRev();
    if (refocus) (s.from?.isConnected ? s.from : tabBtns[2]).focus();
  }
  // « Revoir dans le cours » depuis une carte : la révision se ferme, le Cahier montre le passage.
  const onRevoir = () => { if (open && sheet) { closeSheet(false); tab = 'cours'; sync(); } };
  document.addEventListener('renzvi:revoir', onRevoir);

  // --- Synchronisation avec le Cahier --------------------------------------------------------------------------------
  function sync() {
    if (!open) return;
    const c = api.course();
    name.replaceChildren();
    if (c) name.append(el('span', '', c.subject), el('span', 'carnet-crumb-sep', '/'), el('span', '', c.title));
    name.title = c ? `${c.subject} / ${c.title}` : '';
    for (const b of tabBtns) { b.setAttribute('aria-selected', b.dataset.tab === tab); b.tabIndex = b.dataset.tab === tab ? 0 : -1; }
    view.hidden = tab !== 'cours';
    pane.hidden = tab === 'cours';
    const all = api.courses();
    coursePick.replaceChildren(...[...new Set(all.map(x => x.subject))].sort((a, b) => a.localeCompare(b, 'fr')).map(subject => {
      const g = Object.assign(el('optgroup'), { label: subject });
      g.append(...all.filter(x => x.subject === subject).map(x => Object.assign(el('option', '', x.title), { value: x.id, selected: x.id === c?.id })));
      return g;
    }));
    resume.hidden = !back || !c;
    if (back && c) resume.textContent = `Reprendre ma lecture · ${c.chapters[cahierChapterAt(c.chapters, back.page, back.pos)]?.title ?? ''}`;
    const had = chapters.contains(document.activeElement) ? document.activeElement.dataset.i : null;
    chapters.replaceChildren(...(c?.text_chars ? c.chapters : []).map((ch, i) => {
      const li = el('li'), n = marks.filter(m => m.kind === 'passage' && chapterOf(m) === i).length;
      const b = button('carnet-chapter', '', () => { back = null; if (tab !== 'cours') { tab = 'cours'; keepTop = null; } sideOn = false; api.openChapter(i); layout(); sideBtn.focus(); });
      b.append(el('span', '', ch.title));
      if (n) { const k = el('small', '', String(n)); k.title = plural(n, 'annotation'); b.append(k); b.ariaLabel = `${ch.title}, ${plural(n, 'annotation')}`; }
      b.dataset.i = i;
      if (i === api.chapter()) b.setAttribute('aria-current', 'true');
      li.append(b);
      return li;
    }));
    if (had != null) chapters.querySelector(`[data-i="${had}"]`)?.focus();
    drawMenu();
    const n = c?.text_chars ? c.chapters.length : 0, i = api.chapter();
    foot.classList.toggle('carnet-foot-off', !n);
    count.textContent = n ? `Chapitre ${i + 1} sur ${n}` : '';
    nextBtn.hidden = !n || i >= n - 1;
    prevBtn.hidden = !n || i < n - 1 || n < 2;
    drawProgress();
    if (c && marksFor !== c.id) loadMarks(c);
    if (tab === 'notes') drawNotes();
    if (tab === 'revisions' && rev && rev.state !== 'loading') drawRev();
    drawSignet();
    layout();
  }

  // « Chapitre 01 · Biologie » au-dessus du titre, seulement dans le carnet.
  function kicker(r) {
    const c = api.course(), title = r?.querySelector('.cahier-title');
    if (!title) return;
    // Le texte ne doit pas glisser sous les yeux (signet, passage retrouvé) : on compense la hauteur ajoutée.
    const y = title.getBoundingClientRect().top;
    r.querySelector('.carnet-kicker')?.remove();
    if (open && c) title.before(el('p', 'carnet-kicker', `Chapitre ${String(api.chapter() + 1).padStart(2, '0')} · ${c.subject}`));
    if (r.scrollTop > 0) r.scrollTop += title.getBoundingClientRect().top - y;
  }
  // Progression dans le cours : chapitres déjà passés + la part lue du chapitre ouvert.
  function drawProgress() {
    const c = api.course(), r = reader(), n = c?.chapters.length || 1;
    const lu = r && r.scrollHeight > r.clientHeight ? r.scrollTop / (r.scrollHeight - r.clientHeight) : 0;
    const pct = Math.round(Math.min(1, (api.chapter() + lu) / n) * 100);
    fill.style.width = `${pct}%`;
    progress.setAttribute('aria-valuenow', pct);
  }
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; drawSignet(); drawProgress(); if (barCtx) hideBar(); });
  };
  const onResize = () => { if (open) { hideBar(); drawSignet(); } };
  addEventListener('resize', onResize);
  // Passer un seuil de largeur remet les panneaux à leur état par défaut pour cette taille.
  const onWide = () => { marginOn = wide.matches; layout(); };
  wide.addEventListener('change', onWide);

  return {
    isOpen: () => open,
    // Le Cahier vient de redessiner son lecteur.
    drawn(r) {
      if (!open) return;
      r.addEventListener('scroll', onScroll, { passive: true });
      kicker(r);
      if (document.activeElement !== find) find.value = '';
      drawProgress();
      paint();
      drawMargin();
      drawSignet();
    },
    sync,
    open(on) {
      const r = reader(), keep = r && carnetTop(r), atTop = r && r.scrollTop < 4;
      open = on;
      for (const n of parts) n.hidden = !on;
      if (on) { tab = 'cours'; sideOn = false; marginOn = wide.matches; bar.hidden = true; pane.hidden = true; }
      else { closeSheet(false); setLook(false); setFind(false); hideBar(); view.hidden = false; back = null; box.classList.remove('carnet-find-on'); }
      layout();
      if (on) sync();
      paint();
      // La mise en page a changé : on retrouve le même endroit du texte, pas le même nombre de pixels.
      const r2 = reader();
      kicker(r2);
      if (r2 && atTop) r2.scrollTop = 0;
      else if (r2 && keep) carnetScroll(r2, keep.page, keep.pos);
      if (on) closeBtn.focus({ preventScroll: true });
    },
    // Échap : ferme d'abord ce qui est ouvert par-dessus (menu, barre, révision, panneaux flottants).
    escape() {
      if (!lookPanel.hidden) { const from = lookView === 'texte' ? aaBtn : lookBtn; setLook(false); from.focus(); return true; }
      if (sheet) { closeSheet(); return true; }
      if (!bar.hidden) { hideBar(); return true; }
      if (marginOn && !wide.matches) { marginOn = false; layout(); marginBtn.focus(); return true; }
      if (sideOn) { sideOn = false; layout(); sideBtn.focus(); return true; }
      if (findOn) { setFind(false); findBtn.focus(); return true; }
      return false;
    },
    destroy() {
      gone = true;
      clearTimeout(selTimer);
      clearTimeout(statusTimer);
      if (window.CSS?.highlights) for (const n of HL) CSS.highlights.delete(n);
      document.removeEventListener('selectionchange', onSelection);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('renzvi:revoir', onRevoir);
      removeEventListener('resize', onResize);
      wide.removeEventListener('change', onWide);
      view.removeEventListener('click', onClick);
    },
  };
};
