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
  let draft = null, barCtx = null, back = null, keepTop = null, sheet = null, menuOpen = false, selTimer = 0, gone = false;
  let rev = null; // { state, decks } de l'onglet Révisions
  const wide = matchMedia('(min-width:1100px)'), roomy = matchMedia('(min-width:760px)');
  let sideOn = roomy.matches, marginOn = wide.matches;

  // --- Cadre -----------------------------------------------------------------------------------------------------
  const icon = d => `<svg viewBox="0 0 16 16" aria-hidden="true">${d}</svg>`;
  const top = el('header', 'carnet-top');
  const sideBtn = button('carnet-icon', '', () => { sideOn = !sideOn; layout(); });
  sideBtn.innerHTML = icon('<path d="M2.500 4h11M2.500 8h11M2.500 12h7"/>');
  const name = el('p', 'carnet-name');
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
  const status = el('span', 'carnet-status');
  status.setAttribute('role', 'status');
  const signetBtn = button('carnet-icon carnet-signet', '', toggleSignet);
  signetBtn.innerHTML = icon('<path d="M4.500 2.500h7v11L8 10.800 4.500 13.500z"/>');
  const marginBtn = button('carnet-icon', '', () => { marginOn = !marginOn; layout(); if (marginOn) margin.querySelector('button, textarea')?.focus(); });
  marginBtn.innerHTML = icon('<path d="M3 3.500h10v7H8.500L6 12.800V10.500H3z"/>');
  const menuBtn = button('ghost carnet-menu-btn', 'Gérer', () => setMenu(!menuOpen));
  menuBtn.setAttribute('aria-haspopup', 'true');
  const menu = el('div', 'carnet-menu');
  menu.hidden = true;
  const closeBtn = button('ghost carnet-retour', api.retour ?? 'Réduire', () => api.close());
  closeBtn.ariaLabel = api.retour ?? 'Réduire : retour au tableau';
  // --- Apparence du carnet : Papier, Verre (le fond d'écran se devine derrière), Sombre ; police, taille, interligne.
  // Gardée sur cet appareil (localStorage), limitée au carnet : le tableau, le logo et le reste de l'appli ne changent pas.
  // Tout s'applique tout de suite (aperçu en direct) ; « Réinitialiser » revient au réglage de départ (Verre).
  const LOOK_KEY = 'renzvi:carnet-look';
  const LOOK0 = { surface: 'verre', opacite: 74, flou: 24, police: 'editoriale', taille: 18, interligne: 1.7 };
  const SURFACES = [['papier', 'Papier'], ['verre', 'Verre'], ['sombre', 'Sombre']];
  const POLICES = [['editoriale', 'Éditoriale'], ['sans', 'Sans empattement']];
  const INTERLIGNES = [[1.55, 'Serré'], [1.7, 'Normal'], [1.9, 'Aéré']];
  const clampN = (v, a, b, d) => Number.isFinite(+v) ? Math.min(b, Math.max(a, +v)) : d;
  let look = { ...LOOK0 };
  try {
    const l = JSON.parse(localStorage.getItem(LOOK_KEY) || 'null');
    if (l) look = {
      surface: SURFACES.some(([k]) => k === l.surface) ? l.surface : LOOK0.surface,
      opacite: clampN(l.opacite, 40, 96, LOOK0.opacite), flou: clampN(l.flou, 0, 40, LOOK0.flou),
      police: POLICES.some(([k]) => k === l.police) ? l.police : LOOK0.police,
      taille: clampN(l.taille, 15, 24, LOOK0.taille), interligne: INTERLIGNES.some(([v]) => v === l.interligne) ? l.interligne : LOOK0.interligne,
    };
  } catch {}
  function applyLook(keep = true) {
    box.dataset.surface = look.surface;
    box.dataset.police = look.police;
    box.style.setProperty('--cn-alpha', String(look.opacite / 100));
    box.style.setProperty('--cn-blur', `${look.flou}px`);
    box.style.setProperty('--cn-size', `${look.taille}px`);
    box.style.setProperty('--cn-lh', String(look.interligne));
    if (keep) try { localStorage.setItem(LOOK_KEY, JSON.stringify(look)); } catch {}
  }
  const lookBtn = button('ghost carnet-look-btn', 'Personnaliser', () => setLook(lookPanel.hidden));
  lookBtn.setAttribute('aria-haspopup', 'dialog');
  lookBtn.setAttribute('aria-expanded', 'false');
  const lookPanel = el('div', 'carnet-look');
  lookPanel.hidden = true;
  lookPanel.setAttribute('role', 'dialog');
  lookPanel.ariaLabel = 'Apparence du cahier';
  function setLook(on) {
    lookPanel.hidden = !on;
    lookBtn.setAttribute('aria-expanded', on);
    if (on) { drawLook(); lookPanel.querySelector('[aria-pressed=true]')?.focus(); }
  }
  function choix(label, list, value, onPick, cls = '') {
    const g = el('div', `carnet-look-row ${cls}`);
    g.setAttribute('role', 'group');
    g.ariaLabel = label;
    for (const [v, t] of list) {
      const b = button(`carnet-look-opt carnet-look-${v}`, '', () => { onPick(v); applyLook(); drawLook(); g.querySelector(`[data-v="${v}"]`)?.focus(); });
      b.dataset.v = String(v);
      if (cls === 'carnet-look-surfaces') b.append(el('i', ''));
      b.append(el('span', '', t));
      b.setAttribute('aria-pressed', String(v === value));
      g.append(b);
    }
    return g;
  }
  function curseur(label, min, max, value, unit, onInput) {
    const wrap = el('label', 'carnet-look-range');
    const top = el('span', 'carnet-look-label');
    const val = el('span', 'carnet-look-val', `${value}${unit}`);
    top.append(label, val);
    const input = Object.assign(el('input'), { type: 'range', min, max, value });
    input.oninput = () => { onInput(+input.value); val.textContent = `${input.value}${unit}`; applyLook(); };
    wrap.append(top, input);
    return wrap;
  }
  function drawLook() {
    const parts = [el('h3', '', 'Apparence du cahier'), choix('Surface', SURFACES, look.surface, v => { look.surface = v; }, 'carnet-look-surfaces')];
    if (look.surface === 'verre') parts.push(curseur('Opacité', 40, 96, look.opacite, ' %', v => { look.opacite = v; }), curseur('Flou', 0, 40, look.flou, ' px', v => { look.flou = v; }));
    parts.push(
      el('p', 'carnet-look-label', 'Police du cours'), choix('Police du cours', POLICES, look.police, v => { look.police = v; }),
      curseur('Taille du texte', 15, 24, look.taille, ' px', v => { look.taille = v; }),
      el('p', 'carnet-look-label', 'Interligne'), choix('Interligne', INTERLIGNES, look.interligne, v => { look.interligne = v; }),
      button('link carnet-look-reset', 'Réinitialiser', () => { look = { ...LOOK0 }; applyLook(); drawLook(); }),
    );
    lookPanel.replaceChildren(...parts);
  }
  applyLook(false);
  const acts = el('div', 'carnet-acts');
  acts.append(status, lookBtn, lookPanel, signetBtn, marginBtn, menuBtn, menu, closeBtn);
  top.append(sideBtn, name, tabs, find, acts);

  const side = el('nav', 'carnet-side');
  side.ariaLabel = 'Cours et chapitres';
  const coursePick = Object.assign(el('select', 'cahier-pick carnet-course'), { ariaLabel: 'Cours' });
  coursePick.onchange = () => { back = null; api.openCourse(coursePick.value); };
  const resume = button('link carnet-resume', '', () => { const b = back; back = null; if (b) api.reveal({ page: b.page, offset: b.pos, length: 0 }); });
  const chapters = el('ol', 'carnet-chapters');
  side.append(coursePick, resume, chapters);

  const margin = el('aside', 'carnet-margin');
  margin.ariaLabel = 'Notes et signets';
  const pane = el('div', 'carnet-pane');
  pane.hidden = true;
  const bar = el('div', 'carnet-bar');
  bar.setAttribute('role', 'toolbar');
  bar.ariaLabel = 'Annoter le passage';
  bar.hidden = true;
  // Un appui sur la barre ne doit pas effacer la sélection du texte.
  bar.addEventListener('pointerdown', e => { if (e.target.closest('button')) e.preventDefault(); });
  const layer = el('div', 'carnet-layer');
  const parts = [top, side, margin, pane, bar, layer];
  for (const n of parts) n.hidden = true;
  view.before(top, side);
  view.after(pane, bar, margin, layer);

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
    sideBtn.ariaLabel = sideBtn.title = sideOn ? 'Masquer les chapitres' : 'Afficher les chapitres';
    marginBtn.setAttribute('aria-expanded', marginOn);
    const n = marks.filter(m => m.kind === 'passage' && here(m)).length;
    marginBtn.ariaLabel = marginBtn.title = `${marginOn ? 'Masquer' : 'Afficher'} les notes et signets${n ? ` (${n} sur ce chapitre)` : ''}`;
    marginBtn.dataset.n = n || '';
  }
  function setMenu(on) {
    menuOpen = on;
    menu.hidden = !on;
    menuBtn.setAttribute('aria-expanded', on);
    if (!on) return;
    // Les actions de gestion sont celles du widget compact : mêmes boutons, mêmes confirmations.
    menu.replaceChildren(...api.tools().filter(t => !t.hidden).map(t => {
      const b = button(t.classList.contains('cahier-danger') ? 'cahier-danger' : '', t.textContent, () => { setMenu(false); t.click(); });
      return b;
    }));
    menu.querySelector('button')?.focus();
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
    const hl = button('carnet-tool', 'Surligner', () => style(ctx, 'surligne'));
    hl.setAttribute('aria-pressed', !!m?.surligne);
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
    const ul = button('carnet-tool', 'Souligner', () => style(ctx, 'souligne'));
    ul.setAttribute('aria-pressed', !!m?.souligne);
    const noteBtn = button('carnet-tool', m?.note ? 'Modifier la note' : 'Ajouter une note', () => { startNote(ctx.sel, m); hideBar(); });
    const items = [hl, dots, ul, noteBtn];
    const text = ctx.sel?.text ?? m?.quote ?? '';
    items.push(button('carnet-tool', 'Copier', async () => {
      try { await navigator.clipboard.writeText(text); tell('Copié'); } catch { tell('La copie est bloquée par le navigateur : utilise Ctrl + C.', true); }
      hideBar();
    }));
    if (ctx.sel) {
      // Les actions d'étude du widget compact restent à portée : carte, texte à trous, explication.
      const more = button('carnet-tool', 'Plus', () => { extra.hidden = !extra.hidden; more.setAttribute('aria-expanded', !extra.hidden); place(rect); });
      more.setAttribute('aria-expanded', 'false');
      const extra = el('div', 'carnet-extra');
      extra.hidden = true;
      extra.append(button('carnet-tool', 'Créer une carte', () => { hideBar(); api.makeCard('qa'); }), button('carnet-tool', 'Masquer ces mots', () => { hideBar(); api.makeCard('trou'); }), button('carnet-tool', 'Expliquer (IA)', () => { hideBar(); api.explain(); }));
      items.push(more, extra);
    } else {
      items.push(button('carnet-tool cahier-danger', 'Supprimer', async () => { await remove(m); hideBar(); }));
    }
    bar.replaceChildren(...items);
    bar.hidden = false;
    place(rect);
  }
  // Au-dessus du passage à la souris ; dessous au doigt, où le navigateur affiche déjà ses poignées et son menu au-dessus.
  function place(rect) {
    const w = bar.offsetWidth, h = bar.offsetHeight, touch = matchMedia('(pointer:coarse)').matches;
    const above = rect.top - h - 10, below = rect.bottom + 10;
    const y = (!touch && above > 8) || below + h > innerHeight - 8 ? Math.max(8, above) : below;
    bar.style.left = `${Math.round(Math.max(8, Math.min(innerWidth - w - 8, rect.left + rect.width / 2 - w / 2)))}px`;
    bar.style.top = `${Math.round(y)}px`;
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
    if (menuOpen && !menu.contains(e.target) && e.target !== menuBtn) setMenu(false);
    if (!lookPanel.hidden && !lookPanel.contains(e.target) && e.target !== lookBtn) setLook(false);
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
  async function saveDraft() {
    const d = draft, text = d.text.trim().slice(0, CARNET.note);
    if (!text && !d.mark) { tell('Écris ta note avant de l’enregistrer.', true); return; }
    let ok;
    if (d.mark) {
      const after = { ...d.mark, note: text || null };
      ok = !after.note && !after.surligne && !after.souligne ? await remove(d.mark) : await patch(d.mark, { note: text || null });
    } else ok = !!await insert({ ...fromSel(d.sel), note: text });
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
    if (withChapter) li.append(el('p', 'carnet-where', api.course()?.chapters[chapterOf(m)]?.title ?? ''));
    const q = el('blockquote', 'carnet-quote', m.quote);
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

  function drawMargin() {
    const c = api.course();
    const hadKey = margin.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    const items = [];
    const head = el('div', 'carnet-mhead');
    const hide = button('carnet-icon carnet-mclose', '', () => { marginOn = false; layout(); marginBtn.focus(); });
    hide.innerHTML = icon('<path d="M4 4l8 8M12 4l-8 8"/>');
    hide.ariaLabel = hide.title = 'Masquer les notes et signets';
    head.append(el('h3', '', 'Sur ce chapitre'), hide);
    items.push(head);
    if (draft) {
      const f = el('form', 'carnet-draft');
      const quote = draft.mark?.quote ?? draft.sel.text;
      const area = Object.assign(el('textarea', ''), { maxLength: CARNET.note, value: draft.text, placeholder: 'Ta note sur ce passage', ariaLabel: 'Note sur le passage cité' });
      area.dataset.key = 'brouillon';
      area.oninput = () => { draft.text = area.value; };
      const save = Object.assign(el('button', 'primary', 'Enregistrer la note'), { type: 'submit' });
      const cancel = button('ghost', 'Annuler', () => { draft = null; drawMargin(); });
      const row = el('div', 'carnet-draftacts');
      row.append(save, cancel);
      f.append(el('blockquote', 'carnet-quote', quote), area, row);
      f.onsubmit = e => { e.preventDefault(); saveDraft(); };
      items.push(f);
    }
    if (marksState === 'loading') items.push(el('p', 'carnet-hint', 'Chargement de tes annotations…'));
    else if (marksState === 'error') {
      items.push(el('p', 'carnet-hint bad', 'Tes annotations n’ont pas pu se charger. Le cours reste lisible.'), button('ghost', 'Réessayer', () => c && loadMarks(c)));
    } else {
      const mine = marks.filter(m => m.kind === 'passage' && here(m));
      if (mine.length) { const ul = el('ul', 'carnet-marks'); ul.append(...mine.map(m => markItem(m))); items.push(ul); }
      else if (!draft) items.push(el('p', 'carnet-hint', 'Sélectionne un passage du cours pour le surligner, le souligner ou y attacher une note.'));
      const signets = marks.filter(m => m.kind === 'signet');
      items.push(el('h3', '', 'Signets'));
      if (signets.length) { const ul = el('ul', 'carnet-marks carnet-signets'); ul.append(...signets.map(m => markItem(m))); items.push(ul); }
      else items.push(el('p', 'carnet-hint', 'Aucun signet. Le bouton en forme de marque-page, en haut, garde l’endroit où tu lis.'));
    }
    margin.replaceChildren(...items);
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
    for (const n of [top, side, view, pane, margin]) n.inert = true;
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
    for (const n of [top, side, view, pane, margin]) n.inert = false;
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
    name.textContent = c ? `${c.subject} · ${c.title}` : '';
    name.title = name.textContent;
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
      const b = button('carnet-chapter', '', () => { back = null; if (tab !== 'cours') { tab = 'cours'; keepTop = null; } if (!roomy.matches) sideOn = false; api.openChapter(i); layout(); });
      b.append(el('span', '', ch.title));
      if (n) { const k = el('small', '', String(n)); k.title = plural(n, 'annotation'); b.append(k); b.ariaLabel = `${ch.title}, ${plural(n, 'annotation')}`; }
      b.dataset.i = i;
      if (i === api.chapter()) b.setAttribute('aria-current', 'true');
      li.append(b);
      return li;
    }));
    if (had != null) chapters.querySelector(`[data-i="${had}"]`)?.focus();
    if (c && marksFor !== c.id) loadMarks(c);
    if (tab === 'notes') drawNotes();
    if (tab === 'revisions' && rev && rev.state !== 'loading') drawRev();
    drawSignet();
    layout();
  }

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; drawSignet(); if (barCtx) hideBar(); });
  };
  const onResize = () => { if (open) { hideBar(); drawSignet(); } };
  addEventListener('resize', onResize);
  // Passer un seuil de largeur remet les panneaux à leur état par défaut pour cette taille.
  const onWide = () => { marginOn = wide.matches; layout(); }, onRoomy = () => { sideOn = roomy.matches; layout(); };
  wide.addEventListener('change', onWide);
  roomy.addEventListener('change', onRoomy);

  return {
    isOpen: () => open,
    // Le Cahier vient de redessiner son lecteur.
    drawn(r) {
      if (!open) return;
      r.addEventListener('scroll', onScroll, { passive: true });
      if (document.activeElement !== find) find.value = '';
      paint();
      drawMargin();
      drawSignet();
    },
    sync,
    open(on) {
      const r = reader(), keep = r && carnetTop(r);
      open = on;
      for (const n of parts) n.hidden = !on;
      if (on) { tab = 'cours'; sideOn = roomy.matches; marginOn = wide.matches; bar.hidden = true; pane.hidden = true; }
      else { closeSheet(false); setMenu(false); setLook(false); hideBar(); view.hidden = false; back = null; }
      layout();
      if (on) sync();
      paint();
      // La mise en page a changé : on retrouve le même endroit du texte, pas le même nombre de pixels.
      const r2 = reader();
      if (r2 && keep) carnetScroll(r2, keep.page, keep.pos);
      if (on) closeBtn.focus({ preventScroll: true });
    },
    // Échap : ferme d'abord ce qui est ouvert par-dessus (menu, barre, révision, panneaux flottants).
    escape() {
      if (!lookPanel.hidden) { setLook(false); lookBtn.focus(); return true; }
      if (menuOpen) { setMenu(false); menuBtn.focus(); return true; }
      if (sheet) { closeSheet(); return true; }
      if (!bar.hidden) { hideBar(); return true; }
      if (marginOn && !wide.matches) { marginOn = false; layout(); marginBtn.focus(); return true; }
      if (sideOn && !roomy.matches) { sideOn = false; layout(); sideBtn.focus(); return true; }
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
      roomy.removeEventListener('change', onRoomy);
      view.removeEventListener('click', onClick);
    },
  };
};
