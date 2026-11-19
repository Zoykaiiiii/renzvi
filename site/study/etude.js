// Mon espace Study (labo ?labo=1, prévu pour le Pro) : le socle commun des présentations des cours (Arbre, puis
// Constellations, Archipel, Carnet, Bibliothèque). Trois choses séparées :
//   - le contenu : cours et chapitres (study_courses), cartes (study_cards), notes de chapitre (study_notes) ;
//   - les associations chapitre ↔ paquet (study_links) : des références, aucune carte n'est copiée ;
//   - les préférences de présentation (vue, branches repliées, zoom, chapitre choisi) : gardées sur l'appareil.
// Lire, réviser et ouvrir un paquet réutilisent les widgets existants (cahierWidget, revisionsWidget, cartesWidget),
// ouverts dans une feuille par-dessus l'espace : au retour, on retrouve le même chapitre, la même vue, le même focus.
// Contrat d'une présentation : window.etudeVues[id](ctx) rend { update(), reveal(), leave() }. ctx : voir vueCtx.
// Utilise el, button, plural, listOf (dashboard.html), cahierFold, cahierChapterAt (cahier.js), cartesLoad,
// cartesValidHoles (cartes.js), revisionsQueue (revisions.js), chillScript et ChillSon (chill.js).
window.etudeVues ??= {};
const ETUDE = { prefs: 'renzvi:etude', dense: 24, note: 8000, excerpt: 170, results: 12 };

window.etudeWidget = function etudeWidget({ body, meta, user, sb, peer = () => null, savePeer = () => {} }) {
  if (!document.querySelector('link[data-etude]')) {
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'study/etude.css' });
    link.setAttribute('data-etude', '');
    document.head.append(link);
  }
  const box = body.closest('.widget');
  const VUES = [{ id: 'arbre', name: 'Arbre', src: 'study/arbre.js' }, { id: 'constellations', name: 'Constellations', src: 'study/constellations.js' }, { id: 'liste', name: 'Liste' }];
  const TABS = [['lire', 'Lire'], ['notes', 'Notes'], ['reviser', 'Réviser']];
  let courses = [], cards = [], links = [], noted = new Set(), decks = new Map();
  let state = 'loading', linksOk = true, gone = false, open = false, vue = null, vueId = null, query = '';
  let inerted = [], opener = null, ticker = null, saveTimer = null, apercu = null, apercuId = null, sortie = null;
  const sheets = [], texts = new Map();

  // Préférences : sur cet appareil seulement. Une valeur abîmée revient au départ, sans rien casser.
  // views : le cadrage de chaque présentation (l'Arbre et le ciel n'ont pas la même géométrie) ; tab : l'onglet du panneau.
  const prefs = { v: 1, vue: 'arbre', fold: {}, sel: null, views: {}, tab: 'lire' };
  const viewOk = v => [v?.x, v?.y, v?.k].every(Number.isFinite);
  try {
    const p = JSON.parse(localStorage.getItem(ETUDE.prefs) || 'null');
    if (p?.v === 1) {
      if (VUES.some(v => v.id === p.vue)) prefs.vue = p.vue;
      if (p.fold && typeof p.fold === 'object') for (const [k, v] of Object.entries(p.fold).slice(0, 400)) if (typeof v === 'boolean') prefs.fold[k] = v;
      if (typeof p.sel?.course === 'string' && typeof p.sel?.chapter === 'string') prefs.sel = { course: p.sel.course, chapter: p.sel.chapter };
      if (viewOk(p.view)) prefs.views.arbre = { x: p.view.x, y: p.view.y, k: p.view.k }; // ancien format : un seul cadrage, celui de l'Arbre
      for (const v of VUES) if (viewOk(p.views?.[v.id])) prefs.views[v.id] = { x: p.views[v.id].x, y: p.views[v.id].y, k: p.views[v.id].k };
      if (TABS.some(([id]) => id === p.tab)) prefs.tab = p.tab;
    }
  } catch {}
  const keep = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(ETUDE.prefs, JSON.stringify(prefs)); } catch {} }, 300);
  };

  // --- Contenu -------------------------------------------------------------------------------------------------
  async function load(quiet = false) {
    if (!quiet) { state = 'loading'; draw(); }
    const [c, k, l, n] = await Promise.all([
      sb.from('study_courses').select('id,subject,title,chapters,created_at').order('created_at').order('id'),
      cartesLoad(sb).then(data => ({ data }), error => ({ error })),
      sb.from('study_links').select('id,course_id,chapter_id,deck').order('created_at'),
      sb.from('study_notes').select('course_id,chapter_id'),
    ]);
    if (gone) return;
    if (c.error || k.error) { if (!quiet || state !== 'ready') { state = 'error'; draw(); } return; }
    courses = c.data.map(r => ({ ...r, chapters: listOf(r.chapters).filter(ch => typeof ch?.id === 'string' && typeof ch?.title === 'string') }))
      .map(r => r.chapters.length ? r : { ...r, chapters: [{ id: 'tout', title: 'Tout le cours', page: 0, offset: 0 }] });
    cards = k.data;
    for (const card of cards) card.holes = cartesValidHoles(card.front, card.holes);
    // Avant la migration study_liens, ces deux tables n'existent pas : l'espace s'ouvre quand même, sans associations.
    linksOk = !l.error;
    links = l.error ? [] : l.data;
    noted = new Set((n.error ? [] : n.data).map(x => `${x.course_id}/${x.chapter_id}`));
    decks = new Map();
    for (const name of new Set(cards.map(x => x.deck))) {
      const mine = cards.filter(x => x.deck === name), q = revisionsQueue(mine);
      decks.set(name, { name, total: mine.length, due: q.due, fresh: q.fresh });
    }
    if (prefs.sel && !chapterOf(prefs.sel)) { prefs.sel = null; keep(); }
    state = 'ready';
    draw();
  }
  const courseOf = id => courses.find(c => c.id === id);
  const chapterOf = sel => courseOf(sel?.course)?.chapters.find(ch => ch.id === sel.chapter);
  const linksOf = (course, chapter) => links.filter(l => l.course_id === course && l.chapter_id === chapter);
  const dueOf = (course, chapter) => linksOf(course, chapter).reduce((n, l) => n + (decks.get(l.deck)?.due ?? 0), 0);
  const deckLine = d => `${plural(d.total, 'carte')}${d.due ? ` · ${d.due} à revoir` : ''}${d.fresh ? ` · ${plural(d.fresh, 'nouvelle')}` : ''}`;
  // Les matières dans l'ordre de leur premier cours, les cours dans l'ordre d'import : rien ne se réarrange tout seul.
  function subjects() {
    const out = [];
    for (const c of courses) {
      const key = cahierFold(c.subject.trim());
      (out.find(s => s.key === key) ?? out[out.push({ key, id: `m:${key}`, name: c.subject.trim(), courses: [] }) - 1]).courses.push(c);
    }
    return out;
  }
  const chapterCount = () => courses.reduce((n, c) => n + c.chapters.length, 0);
  // Replié ou non : le choix de la personne d'abord ; sinon, les cours se replient seuls quand l'espace devient dense.
  const folded = id => prefs.fold[id] ?? (!id.startsWith('m:') && chapterCount() > ETUDE.dense && prefs.sel?.course !== id);
  function toggleFold(id) { prefs.fold[id] = !folded(id); keep(); vue?.update(); }

  function select(course, chapter, { reveal = false } = {}) {
    const c = courseOf(course);
    if (!c?.chapters.some(ch => ch.id === chapter)) return;
    prefs.sel = { course, chapter };
    prefs.fold[course] = false;
    prefs.fold[`m:${cahierFold(c.subject.trim())}`] = false;
    keep();
    drawPanel();
    vue?.update();
    if (reveal) vue?.reveal();
  }

  // --- Cadre ---------------------------------------------------------------------------------------------------
  // Fermé : un aperçu de la vraie présentation (l'arbre ou le ciel des vrais cours), dessiné par le même code que la scène,
  // sans caméra ni écouteurs ; puis le résumé et le bouton d'ouverture.
  const summary = el('p', 'etude-sum');
  const openBtn = button('primary', 'Ouvrir mon espace', () => setOpen(true));
  const pick = el('div', 'choices etude-pick-vue');
  pick.setAttribute('role', 'group');
  pick.ariaLabel = 'Présentation';
  const pickOf = new Map(VUES.filter(v => v.src).map(v => [v.id, button('', v.name, () => { prefs.vue = v.id; keep(); drawApercu(); })]));
  pick.append(...pickOf.values());
  const preview = el('div', 'etude-preview');
  preview.setAttribute('aria-hidden', 'true');
  preview.onclick = () => { if (state === 'ready' && courses.length) setOpen(true); };
  const foot = el('div', 'etude-foot');
  foot.append(summary, openBtn);
  const closed = el('div', 'etude-closed');
  closed.append(pick, preview, foot);

  const space = el('div', 'etude-space');
  space.hidden = true;
  space.setAttribute('role', 'region');
  space.ariaLabel = 'Mon espace Study';
  const top = el('header', 'etude-top');
  const name = el('p', 'etude-name', 'Mon espace');
  name.append(el('span', '', ' · Study'));
  const tabs = el('div', 'etude-tabs');
  tabs.setAttribute('role', 'group');
  tabs.ariaLabel = 'Présentation';
  const tabOf = new Map(VUES.map(v => [v.id, button('', v.name, () => setVue(v.id))]));
  tabs.append(...tabOf.values());
  const search = Object.assign(el('input', 'etude-search'), { type: 'search', placeholder: 'Chercher un cours, un chapitre', ariaLabel: 'Chercher un cours ou un chapitre', autocomplete: 'off', maxLength: 80 });
  const results = el('ul', 'etude-results');
  results.hidden = true;
  results.ariaLabel = 'Résultats';
  const finder = el('div', 'etude-finder');
  finder.append(search, results);
  const closeBtn = button('ghost etude-close', 'Retour au tableau', () => setOpen(false));
  top.append(name, tabs, finder, closeBtn);
  const stage = el('div', 'etude-stage');
  const panel = el('aside', 'etude-panel');
  panel.ariaLabel = 'Chapitre choisi';
  const dock = el('div', 'etude-dock');
  dock.setAttribute('role', 'group');
  dock.ariaLabel = 'Outils';
  const live = el('p', 'etude-live');
  live.setAttribute('role', 'status');
  const layer = el('div', 'etude-sheets');
  space.append(top, stage, panel, dock, live, layer);
  // Téléphone : le dock et le zoom se posent juste au-dessus du panneau, à sa hauteur réelle (court quand rien n'est choisi).
  const sheetSize = new ResizeObserver(() => space.style.setProperty('--et-sheet', `${panel.hidden ? 0 : panel.offsetHeight}px`));
  sheetSize.observe(panel);
  body.append(closed, space);
  let liveTimer;
  const say = (text, bad = false) => {
    live.textContent = text;
    live.classList.toggle('bad', bad);
    clearTimeout(liveTimer);
    if (text) liveTimer = setTimeout(() => { live.textContent = ''; }, 6000);
  };

  // Ouvert, l'espace devient une scène posée sur le fond d'écran de la page : pas de fond plein, le fond reste visible.
  // Les autres widgets sont cachés et inactifs (rien n'est retiré ni réarrangé) ; la pastille du menu reste visible.
  // Rien n'est arrêté (minuteur, sons). Pas de plein écran du navigateur.
  const calme = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setOpen(next) {
    if (next === open) return;
    if (!next && sortie) return;
    if (!next && !calme() && space.animate) {
      // Sortie : la scène se fond, puis le tableau revient tel qu'il était.
      sortie = space.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.985)' }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
      sortie.finished.catch(() => {}).finally(() => { sortie?.cancel(); sortie = null; fermer(); });
      return;
    }
    if (next) ouvrir(); else fermer();
  }
  function ouvrir() {
    open = true;
    leaveApercu();
    contraste();
    box.classList.add('etude-open');
    document.body.classList.add('etude-scene');
    document.documentElement.classList.add('zoom-lock');
    closed.hidden = true;
    space.hidden = false;
    opener = document.activeElement;
    for (let n = box; n.parentElement; n = n.parentElement) for (const s of n.parentElement.children) {
      if (s === n || s.inert || ['SCRIPT', 'STYLE', 'LINK'].includes(s.tagName) || s.id === 'wall') continue;
      s.inert = true;
      inerted.push(s);
      if (!s.matches('.topbar')) s.classList.add('etude-cache');
    }
    ticker = setInterval(drawDock, 500);
    draw();
    if (!calme() && space.animate) space.animate([{ opacity: 0, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' });
    (panel.querySelector('[aria-selected=true]') ?? panel.querySelector('button') ?? closeBtn).focus({ preventScroll: true });
  }
  function fermer() {
    open = false;
    box.classList.remove('etude-open');
    document.body.classList.remove('etude-scene');
    document.documentElement.classList.remove('zoom-lock');
    closed.hidden = false;
    space.hidden = true;
    while (sheets.length) closeSheet(false);
    for (const s of inerted) { s.inert = false; s.classList.remove('etude-cache'); }
    inerted = [];
    clearInterval(ticker);
    leaveVue();
    draw();
    (opener?.isConnected ? opener : openBtn).focus({ preventScroll: true });
  }
  // L'encre de la scène suit le fond : claire sur un fond sombre, sombre sur un fond clair. Mesurée sur une vignette du fond
  // (la photo n'est pas modifiée) ; si on ne peut pas la lire, le thème de l'appli décide.
  const lus = new Map();
  function contraste() {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'sombre' : 'clair';
    const src = [...document.querySelectorAll('#wall i')].at(-1)?.dataset.src;
    box.dataset.contraste = src ? lus.get(src) ?? theme : theme;
    if (!src || lus.has(src)) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = Object.assign(document.createElement('canvas'), { width: 24, height: 24 }), g = c.getContext('2d');
        g.drawImage(img, 0, 0, 24, 24);
        const d = g.getImageData(0, 0, 24, 24).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2];
        lus.set(src, sum / (d.length / 4) < 140 ? 'sombre' : 'clair');
      } catch { lus.set(src, theme); }
      if (open) box.dataset.contraste = lus.get(src);
    };
    img.src = src;
  }
  // La place libre de la scène, mesurée : sans la barre du haut, le panneau du chapitre, le dock, les boutons de zoom
  // ni la pastille du menu. C'est là que la caméra pose ce qu'on choisit.
  function room() {
    const s = stage.getBoundingClientRect();
    let l = 0, r = s.width, t = 0, b = s.height;
    const vis = n => n && !n.hidden && n.getClientRects().length;
    if (vis(panel)) {
      const p = panel.getBoundingClientRect();
      if (p.left - s.left > s.width * .45) r = Math.min(r, p.left - s.left - 16);
      else if (p.top - s.top > s.height * .3) b = Math.min(b, p.top - s.top - 12);
    }
    for (const n of [dock, stage.querySelector('.arbre-zoom')]) if (vis(n)) { const q = n.getBoundingClientRect(); if (q.top - s.top > s.height * .3) b = Math.min(b, q.top - s.top - 8); }
    const pill = document.querySelector('.topbar');
    if (vis(pill)) { const q = pill.getBoundingClientRect(); if (q.bottom > s.top + 40 && q.right - s.left < s.width * .2) l = Math.max(l, q.right - s.left + 8); }
    return { x: l, y: t, w: Math.max(1, r - l), h: Math.max(1, b - t) };
  }

  function leaveVue() { vue?.leave(); vue = null; vueId = null; stage.replaceChildren(); }
  async function setVue(id) {
    prefs.vue = id;
    keep();
    for (const [k, b] of tabOf) b.setAttribute('aria-pressed', k === id);
    if (vueId === id && vue) return vue.update();
    leaveVue();
    vueId = id;
    stage.dataset.vue = box.dataset.etudeVue = id;
    if (!courses.length) return drawEmpty();
    const def = VUES.find(v => v.id === id);
    try {
      if (def.src) await chillScript(def.src);
      if (gone || vueId !== id || !open) return;
      vue = (def.src ? window.etudeVues[id] : listeVue)(vueCtx());
    } catch (e) {
      console.error(e);
      if (vueId !== id) return;
      // La présentation n'a pas pu se charger : la liste garde tout accessible.
      say(`La présentation « ${def.name} » n'a pas pu se charger. Voici la liste.`, true);
      vueId = 'liste';
      stage.dataset.vue = box.dataset.etudeVue = 'liste';
      for (const [k, b] of tabOf) b.setAttribute('aria-pressed', k === 'liste');
      vue = listeVue(vueCtx());
    }
  }
  // Ce qu'une présentation reçoit : le contenu en lecture, la sélection, le repli, la vue gardée, la place libre.
  const vueCtx = () => ({
    stage, say, room,
    subjects, folded, toggleFold,
    selected: () => prefs.sel,
    select: (course, chapter) => select(course, chapter),
    due: dueOf,
    linked: (course, chapter) => linksOf(course, chapter).length,
    view: () => prefs.views[vueId] ?? null,
    setView: v => { prefs.views[vueId] = v; keep(); },
  });
  // L'aperçu du widget fermé : le même dessin, en lecture seule, cadré dans la place du widget. Aucun libellé n'est
  // cliquable, aucune caméra, aucun écouteur de geste ; il se redessine quand le contenu change.
  function leaveApercu() { apercu?.leave(); apercu = null; apercuId = null; preview.replaceChildren(); }
  async function drawApercu() {
    const id = VUES.some(v => v.id === prefs.vue && v.src) ? prefs.vue : 'arbre';
    for (const [k, b] of pickOf) b.setAttribute('aria-pressed', k === id);
    box.dataset.etudeApercu = id;
    if (open || state !== 'ready') return;
    if (!courses.length) {
      leaveApercu();
      const vide = el('div', 'etude-preview-vide');
      vide.innerHTML = '<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M60 108V58M60 76c-10-4-18-12-20-24M60 66c9-3 16-10 18-20M60 58c-2-10 0-18 6-24"/><path d="M38 108h44"/></svg>';
      // Sans cours : l'espace s'ouvre directement sur l'import d'un premier cours.
      vide.append(el('p', '', 'Aucun cours pour l’instant'), button('ghost', 'Importer un premier cours', e => { e.stopPropagation(); setOpen(true); openReader(null, null, closeBtn); }));
      preview.replaceChildren(vide);
      return;
    }
    if (apercu && apercuId === id) return apercu.update();
    leaveApercu();
    apercuId = id;
    try {
      await chillScript(VUES.find(v => v.id === id).src);
      if (gone || open || apercuId !== id) return;
      apercu = window.etudeVues[id]({ ...vueCtx(), stage: preview, apercu: true, view: () => null, setView() {}, room: null });
    } catch (e) { console.error(e); preview.replaceChildren(); apercuId = null; }
  }

  function drawEmpty() {
    const empty = el('div', 'etude-empty');
    const [h, p] = prefs.vue === 'constellations'
      ? ['Ton ciel s’allume avec tes cours', 'Importe un premier cours : chaque chapitre devient une étoile, et tes flashcards s’y rattachent.']
      : ['Ton arbre pousse avec tes cours', 'Importe un premier cours : ses chapitres deviennent des branches, et tes flashcards s’y rattachent.'];
    box.dataset.etudeVue = stage.dataset.vue = prefs.vue;
    empty.append(el('h3', '', h), el('p', '', p),
      button('primary', 'Importer un premier cours', e => openReader(null, null, e.currentTarget)));
    stage.replaceChildren(empty);
  }

  function draw() {
    meta.textContent = '';
    summary.textContent = state === 'loading' ? 'Chargement de tes cours…'
      : state === 'error' ? "Tes cours n'ont pas pu se charger."
      : !courses.length ? 'Importe un cours : ses chapitres deviennent des branches.'
      : [plural(courses.length, 'cours'), plural(chapterCount(), 'chapitre'), decks.size ? plural(decks.size, 'paquet') : ''].filter(Boolean).join(' · ');
    openBtn.hidden = state !== 'ready';
    pick.hidden = state !== 'ready' || !courses.length;
    if (!open) drawApercu();
    closed.querySelector('.etude-retry')?.remove();
    if (state === 'error') closed.append(button('ghost etude-retry', 'Réessayer', () => load()));
    if (!open) return;
    if (state !== 'ready') { leaveVue(); stage.replaceChildren(el('p', 'empty', summary.textContent)); panel.hidden = true; return; }
    finder.hidden = !courses.length;
    drawPanel();
    drawDock();
    if (!courses.length) { leaveVue(); for (const [k, b] of tabOf) b.setAttribute('aria-pressed', k === prefs.vue); return drawEmpty(); }
    if (vue && vueId === prefs.vue) vue.update(); else setVue(prefs.vue);
  }

  // --- Recherche -----------------------------------------------------------------------------------------------
  function drawResults() {
    const q = cahierFold(query.trim());
    if (q.length < 2) { results.hidden = true; return results.replaceChildren(); }
    const found = [];
    for (const s of subjects()) for (const c of s.courses) for (const ch of c.chapters) {
      if (found.length >= ETUDE.results) break;
      if ([s.name, c.title, ch.title].some(t => cahierFold(t).includes(q))) found.push({ s, c, ch });
    }
    results.hidden = false;
    if (!found.length) return results.replaceChildren(el('li', 'etude-none', `Rien trouvé pour « ${query.trim()} ».`));
    results.replaceChildren(...found.map(f => {
      const li = el('li');
      const b = button('', '', () => { query = search.value = ''; drawResults(); select(f.c.id, f.ch.id, { reveal: true }); (panel.querySelector('[aria-selected=true]') ?? panel.querySelector('button'))?.focus(); });
      b.append(el('span', '', f.ch.title), el('small', '', `${f.s.name} / ${f.c.title}`));
      li.append(b);
      return li;
    }));
  }
  search.oninput = () => { query = search.value; drawResults(); };
  search.onkeydown = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); results.querySelector('button')?.focus(); }
    if (e.key === 'Escape' && query) { e.stopPropagation(); query = search.value = ''; drawResults(); }
  };
  results.onkeydown = e => {
    const all = [...results.querySelectorAll('button')], i = all.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); all[Math.min(all.length - 1, i + 1)]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (i <= 0 ? search : all[i - 1]).focus(); }
    if (e.key === 'Escape') { e.stopPropagation(); query = search.value = ''; drawResults(); search.focus(); }
  };

  // --- Panneau du chapitre ---------------------------------------------------------------------------------------
  // L'extrait vient du texte du cours (stockage privé), chargé une fois par cours et seulement à la demande.
  function textOf(c) {
    if (!texts.has(c.id)) texts.set(c.id, sb.storage.from('cours').download(`${user.id}/${c.id}/texte.json`).then(async ({ data, error }) => {
      if (error || !data) throw new Error('texte absent');
      return listOf(JSON.parse(await data.text())?.pages).filter(p => typeof p === 'string');
    }).catch(() => { texts.delete(c.id); return null; }));
    return texts.get(c.id);
  }
  function excerptOf(pages, ch, next) {
    // L'extrait s'arrête où commence le chapitre suivant.
    const end = next && next.page === ch.page ? next.offset : Infinity;
    const raw = (pages[ch.page] ?? '').slice(ch.offset ?? 0, Math.min(end, (ch.offset ?? 0) + 600)).replace(/^[ \t]*#*[^\n]*\n/, '').replace(/\s+/g, ' ').trim();
    return raw.length > ETUDE.excerpt ? `${raw.slice(0, ETUDE.excerpt).replace(/\s+\S*$/, '')}…` : raw;
  }
  const keyed = (node, key) => { node.dataset.key = key; return node; };

  // Le panneau : fil d'Ariane, titre, où l'on en est, puis trois onglets qui montrent chacun leur contenu.
  // Lire : l'extrait et la reprise ; Notes : la note du chapitre ; Réviser : les paquets associés (cartes et cartes dues).
  const notesOf = new Map(); // texte des notes déjà lues, par chapitre
  function drawPanel() {
    panel.hidden = !courses.length;
    const sel = prefs.sel, c = courseOf(sel?.course), ch = chapterOf(sel);
    const had = document.activeElement?.closest?.('.etude-panel') ? document.activeElement.dataset.key : null;
    panel.classList.toggle('etude-panel-idle', !c || !ch);
    if (!c || !ch) {
      // Rien de choisi : les paquets qui ne sont rattachés à aucun chapitre restent à portée de main.
      const free = [...decks.values()].filter(d => !links.some(l => l.deck === d.name)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      panel.replaceChildren(el('h3', '', 'Choisis un chapitre'), el('p', 'etude-text', 'Ses actions s’affichent ici : lire, prendre des notes, réviser.'));
      if (free.length) panel.append(el('h4', '', 'Paquets sans chapitre'), deckList(free.map(d => ({ deck: d.name })), false));
      return;
    }
    const head = el('div', 'etude-phead');
    const x = keyed(button('etude-x', '', () => {
      prefs.sel = null;
      keep();
      drawPanel();
      vue?.update();
      (stage.querySelector(`[data-key="${CSS.escape(`${c.id}/${ch.id}`)}"]`) ?? panel.querySelector('button') ?? closeBtn).focus({ preventScroll: true });
    }), 'fermer');
    x.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
    x.ariaLabel = 'Fermer le chapitre';
    head.append(el('p', 'etude-crumb', `${c.subject} / ${c.title}`), x);
    const idx = c.chapters.indexOf(ch), here = peer('cahier')?.at?.[c.id]?.chapter === ch.id;
    const where = el('p', 'etude-where', `Chapitre ${idx + 1} sur ${c.chapters.length}${here ? ' · ta lecture s’est arrêtée ici' : ''}`);

    const tabbar = el('div', 'etude-ptabs');
    tabbar.setAttribute('role', 'tablist');
    tabbar.ariaLabel = `Actions pour ${ch.title}`;
    const pane = el('div', 'etude-pbody');
    pane.setAttribute('role', 'tabpanel');
    pane.id = 'etude-pane';
    const tabBtns = TABS.map(([id, label]) => {
      const t = keyed(button('', label, () => { prefs.tab = id; keep(); drawPanel(); panel.querySelector(`[data-key="tab:${id}"]`)?.focus(); }), `tab:${id}`);
      t.setAttribute('role', 'tab');
      t.id = `etude-tab-${id}`;
      t.setAttribute('aria-controls', pane.id);
      t.setAttribute('aria-selected', id === prefs.tab);
      t.tabIndex = id === prefs.tab ? 0 : -1;
      return t;
    });
    // Flèches gauche/droite d'un onglet à l'autre (modèle WAI-ARIA des onglets).
    tabbar.onkeydown = e => {
      const i = TABS.findIndex(([id]) => id === prefs.tab), d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      tabBtns[(i + d + TABS.length) % TABS.length].click();
    };
    tabbar.append(...tabBtns);
    pane.setAttribute('aria-labelledby', `etude-tab-${prefs.tab}`);

    const mine = linksOf(c.id, ch.id);
    if (prefs.tab === 'lire') {
      const quote = el('blockquote', 'etude-quote');
      quote.append(el('p', 'etude-text', 'Chargement de l’extrait…'));
      textOf(c).then(pages => {
        if (gone || prefs.sel !== sel || prefs.tab !== 'lire') return;
        const ex = pages && excerptOf(pages, ch, c.chapters[idx + 1]);
        quote.replaceChildren(el('p', 'etude-qlabel', 'Début du chapitre'), el('p', 'etude-text', ex || 'L’extrait n’est pas disponible : ouvre le chapitre pour le lire.'));
      });
      const read = keyed(button('primary', here ? 'Reprendre dans le cahier' : 'Ouvrir le cahier', e => openReader(c, ch, e.currentTarget, { carnet: true })), 'lire');
      pane.append(quote, read);
    } else if (prefs.tab === 'notes') {
      const k = `${c.id}/${ch.id}`, has = noted.has(k);
      const text = el('p', 'etude-notetext', has ? (notesOf.get(k) ?? 'Chargement de ta note…') : 'Aucune note pour ce chapitre.');
      if (has && !notesOf.has(k)) sb.from('study_notes').select('body').match({ course_id: c.id, chapter_id: ch.id }).maybeSingle().then(({ data, error }) => {
        if (gone) return;
        if (error) { text.textContent = 'Ta note n’a pas pu se charger.'; return; }
        notesOf.set(k, data?.body ?? '');
        if (prefs.sel === sel && prefs.tab === 'notes') text.textContent = notesOf.get(k) || 'Aucune note pour ce chapitre.';
      });
      pane.append(text, keyed(button(has ? 'ghost' : 'primary', has ? 'Modifier la note' : 'Écrire une note', e => openNote(c, ch, e.currentTarget)), 'notes'));
    } else {
      const known = mine.map(l => decks.get(l.deck)).filter(Boolean);
      const total = known.reduce((n, d) => n + d.total, 0), due = known.reduce((n, d) => n + d.due, 0);
      const next = mine.find(l => decks.get(l.deck)?.due) ?? mine.find(l => decks.get(l.deck)?.fresh) ?? null;
      if (mine.length) {
        const card = el('div', 'etude-flash');
        const info = el('div', 'etude-deck');
        info.append(el('strong', '', 'Flashcards du chapitre'), el('small', '', `${plural(total, 'carte')} · ${due ? `${due} à revoir` : 'rien à revoir aujourd’hui'}`));
        card.append(info);
        // La révision planifiée (elle enregistre les réponses) et l'entraînement libre (il n'enregistre rien) sont deux boutons distincts.
        if (next) card.append(keyed(button('primary', 'Réviser mes cartes', e => openReview(next.deck, e.currentTarget)), 'reviser'));
        else if (known.length) card.append(keyed(button('ghost', 'S’entraîner', e => openReview(known[0].name, e.currentTarget, true)), 'libre'));
        pane.append(card);
        if (next && known.length) {
          const free = keyed(button('link', 'S’entraîner sans changer le planning', e => openReview(next.deck, e.currentTarget, true)), 'libre');
          pane.append(free);
        }
        pane.append(el('h4', '', mine.length > 1 ? 'Paquets associés' : 'Paquet associé'), deckList(mine, true));
      } else {
        pane.append(el('p', 'etude-text', 'Aucun paquet associé à ce chapitre pour l’instant.'));
      }
      // Les cartes créées depuis ce chapitre dans le Cahier : une information réelle, pas une association.
      const born = cards.filter(x => x.course_id === c.id && c.chapters[cahierChapterAt(c.chapters, x.src_page ?? 0, x.src_offset ?? 0)]?.id === ch.id);
      if (born.length) pane.append(el('p', 'etude-text', `${plural(born.length, 'carte')} ${born.length > 1 ? 'viennent' : 'vient'} de ce chapitre (${[...new Set(born.map(x => x.deck))].join(', ')}).`));
      const add = keyed(button('ghost etude-add', '+ Associer un paquet', e => openPicker(c, ch, e.currentTarget)), 'associer');
      add.ariaLabel = 'Associer un paquet de flashcards';
      pane.append(add);
    }
    panel.replaceChildren(head, el('h3', '', ch.title), where, tabbar, pane);
    if (had) panel.querySelector(`[data-key="${CSS.escape(had)}"]`)?.focus({ preventScroll: true });
  }

  function deckList(rows, removable) {
    const list = el('ul', 'etude-decks');
    for (const row of rows) {
      const d = decks.get(row.deck), li = el('li');
      const info = el('div', 'etude-deck');
      info.append(el('strong', '', row.deck), el('small', '', d ? deckLine(d) : 'Paquet introuvable : renommé ou vidé'));
      const acts = el('div', 'etude-deckacts');
      if (d) {
        const r = keyed(button('link', d.due || d.fresh ? 'Réviser' : 'Revoir', e => openReview(row.deck, e.currentTarget)), `rev:${row.deck}`);
        r.ariaLabel = `Réviser le paquet ${row.deck}`;
        const o = keyed(button('link', 'Ouvrir', e => openDeck(row.deck, e.currentTarget)), `ouv:${row.deck}`);
        o.ariaLabel = `Ouvrir le paquet ${row.deck}`;
        acts.append(r, o);
      }
      if (removable) {
        const x = keyed(button('link', 'Retirer', () => unlink(row)), `ret:${row.deck}`);
        x.ariaLabel = `Retirer l'association avec le paquet ${row.deck}`;
        acts.append(x);
      }
      li.append(info, acts);
      list.append(li);
    }
    return list;
  }

  // Retirer une association ne touche ni au paquet ni à ses cartes.
  async function unlink(row) {
    const { error } = await sb.from('study_links').delete().eq('id', row.id);
    if (gone) return;
    if (error) return say("L'association n'a pas été retirée. Vérifie ta connexion et réessaie.", true);
    links = links.filter(l => l.id !== row.id);
    say(`Association retirée. Le paquet « ${row.deck} » et ses cartes sont intacts.`);
    drawPanel();
    vue?.update();
    panel.querySelector('[data-key=associer]')?.focus();
  }

  // --- Associer des flashcards -----------------------------------------------------------------------------------
  function openPicker(c, ch, from, preset = []) {
    const dialog = el('dialog', 'etude-picker');
    const head = el('div', 'etude-pickhead');
    head.append(el('h3', '', 'Associer un paquet'), el('p', 'etude-crumb', `${c.subject} / ${c.title} / ${ch.title}`));
    dialog.setAttribute('aria-labelledby', head.firstChild.id = `etude-pick-${crypto.randomUUID().slice(0, 8)}`);
    const find = Object.assign(el('input', 'etude-search'), { type: 'search', placeholder: 'Chercher un paquet', ariaLabel: 'Chercher un paquet', autocomplete: 'off', maxLength: 60 });
    const list = el('ul', 'etude-picklist');
    const status = el('p', 'etude-status');
    status.setAttribute('role', 'status');
    const chosen = new Set(preset.filter(n => decks.has(n)));
    const taken = new Set(linksOf(c.id, ch.id).map(l => l.deck));
    const born = new Set(cards.filter(x => x.course_id === c.id && c.chapters[cahierChapterAt(c.chapters, x.src_page ?? 0, x.src_offset ?? 0)]?.id === ch.id).map(x => x.deck));
    const ok = Object.assign(el('button', 'primary', 'Associer'), { type: 'button' });
    const cancel = button('ghost', 'Annuler', () => dialog.close());
    const create = button('ghost', 'Créer un paquet', () => {
      dialog.close('creer');
      const before = new Set(decks.keys());
      openSheet('Créer un paquet', ({ body: b, close }) => {
        const f = cartesForm({ sb, card: { deck: decks.has(ch.title) ? '' : ch.title.slice(0, 60) }, decks: [...decks.keys()], close });
        b.append(el('p', 'etude-text', `Un paquet existe dès sa première carte. Il sera proposé pour « ${ch.title} ».`), f.form);
        setTimeout(f.focus);
      }, from, () => openPicker(c, ch, from, [...chosen, ...[...decks.keys()].filter(n => !before.has(n))]));
    });
    const foot = el('div', 'etude-pickfoot');
    foot.append(create, cancel, ok);
    function drawList() {
      const q = cahierFold(find.value.trim());
      const names = [...decks.values()].filter(d => !q || cahierFold(d.name).includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      ok.disabled = !chosen.size;
      ok.textContent = chosen.size > 1 ? `Associer ${chosen.size} paquets` : 'Associer';
      if (!decks.size) return list.replaceChildren(el('li', 'etude-none', 'Tu n’as pas encore de paquet. Crée le premier avec « Créer un paquet ».'));
      if (!names.length) return list.replaceChildren(el('li', 'etude-none', `Aucun paquet pour « ${find.value.trim()} ».`));
      list.replaceChildren(...names.map(d => {
        const li = el('li'), label = el('label', 'etude-pick');
        const boxIn = Object.assign(el('input'), { type: 'checkbox', checked: taken.has(d.name) || chosen.has(d.name), disabled: taken.has(d.name) });
        boxIn.onchange = () => { boxIn.checked ? chosen.add(d.name) : chosen.delete(d.name); status.textContent = ''; drawList(); list.querySelectorAll('input')[names.indexOf(d)]?.focus(); };
        const txt = el('span', 'etude-deck');
        txt.append(el('strong', '', d.name), el('small', '', [taken.has(d.name) ? 'Déjà associé' : '', deckLine(d), born.has(d.name) ? 'contient des cartes de ce chapitre' : ''].filter(Boolean).join(' · ')));
        label.append(boxIn, txt);
        li.append(label);
        return li;
      }));
    }
    find.oninput = drawList;
    ok.onclick = async () => {
      if (!chosen.size || ok.disabled) return;
      ok.disabled = cancel.disabled = true;
      status.classList.remove('bad');
      status.textContent = 'Enregistrement…';
      // La base refuse un doublon (contrainte d'unicité) : une association déjà là compte comme réussie.
      const rows = [...chosen].filter(n => !taken.has(n)).map(deck => ({ course_id: c.id, chapter_id: ch.id, deck }));
      const { data, error } = await sb.from('study_links').upsert(rows, { onConflict: 'user_id,course_id,chapter_id,deck', ignoreDuplicates: true }).select('id,course_id,chapter_id,deck');
      cancel.disabled = false;
      if (gone) return;
      if (error) {
        ok.disabled = false;
        status.classList.add('bad');
        status.textContent = linksOk ? "L'association n'a pas été enregistrée. Vérifie ta connexion, puis appuie de nouveau sur Associer." : "Les associations ne sont pas encore activées sur ce compte (mise à jour de la base en attente). Rien n'a été modifié.";
        return;
      }
      dialog.close('ok');
      for (const row of listOf(data)) if (!links.some(l => l.id === row.id)) links.push(row);
      say(rows.length > 1 ? `${rows.length} paquets associés à « ${ch.title} ».` : `Paquet « ${rows[0].deck} » associé à « ${ch.title} ».`);
      await load(true);
    };
    dialog.append(head, find, list, status, foot);
    // Annuler, Échap ou fermer : rien n'a été écrit. Le focus revient au bouton d'où l'on est parti.
    dialog.onclose = () => {
      dialog.remove();
      if (dialog.returnValue === 'creer') return;
      drawPanel();
      (panel.querySelector('[data-key=associer]') ?? from)?.focus?.();
    };
    space.append(dialog);
    drawList();
    dialog.showModal();
    (decks.size ? find : create).focus();
  }

  // --- Feuilles : lire, réviser, ouvrir un paquet, notes -----------------------------------------------------------
  // Une feuille s'ouvre par-dessus l'espace et se referme sur lui, exactement où on l'a laissé.
  function openSheet(title, mount, from, after) {
    const sheet = el('section', 'widget etude-sheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.ariaLabel = title;
    const head = el('div', 'head etude-sheethead');
    const back = button('ghost', '← Retour', () => closeSheet());
    const m = el('p', 'meta');
    head.append(back, el('h2', '', title), m);
    const b = el('div', 'body');
    sheet.append(head, b);
    const entry = { sheet, key: from?.dataset?.key, from, after, cleanup: null };
    for (const n of [top, stage, panel, dock, ...sheets.map(s => s.sheet)]) n.inert = true;
    sheets.push(entry);
    layer.append(sheet);
    try { entry.cleanup = mount({ body: b, meta: m, close: () => closeSheet() }) ?? null; }
    catch (e) { console.error(e); b.replaceChildren(el('p', 'msg', "Cet écran n'a pas pu s'ouvrir.")); }
    back.focus({ preventScroll: true });
    return entry;
  }
  function closeSheet(refresh = true) {
    const entry = sheets.pop();
    if (!entry) return;
    try { entry.cleanup?.(); } catch (e) { console.error(e); }
    entry.sheet.remove();
    const under = sheets.at(-1);
    if (under) under.sheet.inert = false; else for (const n of [top, stage, panel, dock]) n.inert = false;
    if (!refresh) return;
    // Le contenu a pu changer dans la feuille (carte créée, chapitre renommé, cours supprimé) : on relit, sans rien déplacer.
    load(true).then(() => {
      if (gone || !open) return;
      if (entry.after) return entry.after();
      const target = (entry.key && panel.querySelector(`[data-key="${CSS.escape(entry.key)}"]`)) || (entry.from?.isConnected ? entry.from : null) || panel.querySelector('button') || closeBtn;
      target.focus({ preventScroll: true });
    });
  }

  // Lire : le Cahier existant, ouvert au chapitre. Sa position de lecture rejoint celle du widget Cahier.
  // carnet : ouvre directement le carnet (vue agrandie du Cahier) sur ce chapitre ; son bouton ramène à la présentation
  // d'où l'on vient (« Retour à la constellation » / « à l'arbre »), avec le même cadrage et le même chapitre.
  function openReader(c, ch, from, { carnet = false, passage } = {}) {
    const saved = peer('cahier') ?? {};
    const retour = carnet && c ? { label: vueId === 'constellations' ? 'Retour à la constellation' : vueId === 'arbre' ? 'Retour à l’arbre' : 'Retour à mon espace', apres: () => closeSheet() } : undefined;
    const entry = openSheet(c ? `${c.subject} / ${c.title}` : 'Importer un cours', ({ body: b, meta: m }) => cahierWidget({
      body: b, meta: m, user, sb, data: { course: c?.id ?? null, chapter: ch?.id, at: saved.at, retour, passage, importer: !c },
      save: d => savePeer('cahier', d),
    }), from);
    entry.reader = true;
    return entry;
  }
  // Réviser : les révisions du jour existantes, limitées au paquet. Ouvrir la feuille n'écrit rien ; chaque réponse
  // passe par study_answer, une seule fois, comme partout ailleurs.
  // S'entraîner (libre = true) : les mêmes cartes, retournées sans rien enregistrer ; le planning ne bouge pas.
  const openReview = (deck, from, libre = false) => openSheet(`${libre ? 'S’entraîner' : 'Réviser'} · ${deck}`, ({ body: b, meta: m }) => revisionsWidget({ body: b, meta: m, sb, data: { deck, libre }, save() {} }), from);
  const openDeck = (deck, from) => openSheet(`Paquet · ${deck}`, ({ body: b, meta: m }) => cartesWidget({ body: b, meta: m, sb, data: { deck }, save() {} }), from);

  // Notes : une note par chapitre, enregistrée à la demande et en quittant la feuille.
  function openNote(c, ch, from) {
    return openSheet(`Notes · ${ch.title}`, ({ body: b }) => {
      const area = Object.assign(el('textarea', 'etude-note'), { maxLength: ETUDE.note, placeholder: 'Tes notes sur ce chapitre', ariaLabel: `Notes sur ${ch.title}`, disabled: true });
      const status = el('p', 'etude-status', 'Chargement…');
      status.setAttribute('role', 'status');
      let saved = '', busy = null, dead = false, timer;
      const key = { user_id: user.id, course_id: c.id, chapter_id: ch.id };
      const store = () => busy ??= (async () => {
        const text = area.value.trim();
        if (text === saved) return;
        status.classList.remove('bad');
        status.textContent = 'Enregistrement…';
        const { error } = text
          ? await sb.from('study_notes').upsert({ ...key, body: text, updated_at: new Date().toISOString() })
          : await sb.from('study_notes').delete().match(key);
        if (error) { status.classList.add('bad'); status.textContent = 'Pas encore enregistré. Vérifie ta connexion, puis appuie sur Enregistrer.'; return; }
        saved = text;
        notesOf.set(`${c.id}/${ch.id}`, text);
        text ? noted.add(`${c.id}/${ch.id}`) : noted.delete(`${c.id}/${ch.id}`);
        if (!dead) status.textContent = text ? 'Enregistré' : 'Note vide : rien à garder.';
      })().finally(() => { busy = null; });
      area.oninput = () => { status.textContent = 'Modifications non enregistrées'; clearTimeout(timer); timer = setTimeout(store, 1500); };
      const acts = el('div', 'cahier-actions');
      acts.append(button('primary', 'Enregistrer', store));
      b.append(el('p', 'etude-crumb', `${c.subject} / ${c.title}`), area, status, acts);
      sb.from('study_notes').select('body').match(key).maybeSingle().then(({ data, error }) => {
        if (dead) return;
        if (error) { status.classList.add('bad'); status.textContent = linksOk ? "Tes notes n'ont pas pu se charger. Reviens en arrière et réessaie." : 'Les notes de chapitre ne sont pas encore activées sur ce compte (mise à jour de la base en attente).'; return; }
        saved = area.value = data?.body ?? '';
        area.disabled = false;
        status.textContent = '';
        area.focus();
      });
      return () => { dead = true; clearTimeout(timer); if (!area.disabled) store(); };
    }, from);
  }

  // --- Dock : minuteur et ambiance, sans rien relancer -------------------------------------------------------------
  const two = n => String(n).padStart(2, '0');
  const timerBtn = button('etude-tool', '', () => { window.renzviMinuteurLive?.().toggle(); drawDock(); });
  const timerOpen = button('etude-tool etude-more', '', () => {
    const w = document.querySelector('.widget[data-widget=minuteur]');
    if (!w || w.hidden) return say('Le minuteur est rangé dans un autre mode : change de mode pour voir tous ses réglages.');
    setOpen(false);
    w.scrollIntoView({ block: 'center' });
    (w.querySelector('.body button') ?? w).focus({ preventScroll: true });
  });
  timerOpen.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 10l4-4 4 4"/></svg>';
  timerOpen.ariaLabel = 'Ouvrir tous les réglages du minuteur';
  const sonBtn = button('etude-tool', 'Ambiance', async () => {
    if (ChillSon.playing()) return ChillSon.pause();
    const why = await ChillSon.play();
    if (why) say(why === 'master' ? 'Le volume général de l’ambiance est à zéro : remonte-le dans le widget Ambiance sonore.' : 'Aucun son n’est réglé : choisis ton mélange dans le widget Ambiance sonore.');
  });
  dock.append(timerBtn, timerOpen, sonBtn);
  function drawDock() {
    const t = window.renzviMinuteurLive?.();
    timerBtn.hidden = timerOpen.hidden = !t;
    if (t) {
      const s = Math.ceil(t.ms / 1000), label = `${two(Math.floor(s / 60))}:${two(s % 60)}`;
      if (timerBtn.dataset.state !== t.state) {
        timerBtn.dataset.state = t.state;
        timerBtn.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true" class="etude-play"><path d="${t.state === 'run' ? 'M5 3.500v9M11 3.500v9' : 'M5 3l8 5-8 5z'}"/></svg><span></span>`;
      }
      const time = timerBtn.lastChild;
      if (time.textContent !== label) time.textContent = label;
      timerBtn.ariaLabel = `${t.state === 'run' ? 'Mettre en pause' : t.state === 'pause' ? 'Reprendre' : 'Démarrer'} le minuteur, ${label}`;
    }
    const son = document.querySelector('.widget[data-widget=ambiance]');
    sonBtn.hidden = !son;
    sonBtn.setAttribute('aria-pressed', ChillSon.playing());
    sonBtn.ariaLabel = ChillSon.playing() ? 'Mettre l’ambiance sonore en pause' : 'Lancer l’ambiance sonore';
    dock.hidden = timerBtn.hidden && sonBtn.hidden;
  }
  const offSon = ChillSon.subscribe(() => { if (open) drawDock(); });

  // --- Liste : la présentation de base, entièrement au clavier, et le repli si une autre ne se charge pas -----------
  function listeVue(ctx) {
    const root = el('div', 'etude-liste');
    ctx.stage.replaceChildren(root);
    function update() {
      const had = root.contains(document.activeElement) ? document.activeElement.dataset.key : null;
      const sel = ctx.selected();
      root.replaceChildren(...ctx.subjects().map(s => {
        const sec = el('section');
        const h = keyed(button('etude-fold', s.name, () => ctx.toggleFold(s.id)), s.id);
        h.setAttribute('aria-expanded', !ctx.folded(s.id));
        const title = el('h3');
        title.append(h);
        sec.append(title);
        if (ctx.folded(s.id)) return sec;
        for (const c of s.courses) {
          const ch = keyed(button('etude-fold', c.title, () => ctx.toggleFold(c.id)), c.id);
          ch.setAttribute('aria-expanded', !ctx.folded(c.id));
          ch.append(el('small', '', plural(c.chapters.length, 'chapitre')));
          const t = el('h4');
          t.append(ch);
          sec.append(t);
          if (ctx.folded(c.id)) continue;
          const ul = el('ul');
          for (const x of c.chapters) {
            const b = keyed(button('etude-item', x.title, () => ctx.select(c.id, x.id)), `${c.id}/${x.id}`);
            const due = ctx.due(c.id, x.id), n = ctx.linked(c.id, x.id);
            if (n) b.append(el('small', '', due ? `${due} à revoir` : plural(n, 'paquet')));
            if (sel?.course === c.id && sel.chapter === x.id) b.setAttribute('aria-current', 'true');
            const li = el('li');
            li.append(b);
            ul.append(li);
          }
          sec.append(ul);
        }
        return sec;
      }));
      if (had) root.querySelector(`[data-key="${CSS.escape(had)}"]`)?.focus({ preventScroll: true });
    }
    update();
    return { update, reveal() { root.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest' }); }, leave() { root.remove(); } };
  }

  // --- Événements ------------------------------------------------------------------------------------------------
  const onKey = e => {
    if (e.key !== 'Escape' || !open || space.querySelector('dialog[open]')) return;
    // Écouté en premier (capture) : la recherche, un menu déroulant ouvert et le Cahier agrandi dans une feuille
    // gardent leur propre Échap.
    if (e.target.closest?.('.etude-finder, .dd-trigger[aria-expanded="true"]') && (query || e.target !== search)) return;
    if (sheets.at(-1)?.sheet.classList.contains('cahier-open')) return;
    e.stopPropagation();
    sheets.length ? closeSheet() : setOpen(false);
  };
  document.addEventListener('keydown', onKey, true);
  // « Revoir dans le cours » depuis une révision ouverte ici : le passage s'ouvre dans une feuille, par-dessus.
  const onRevoir = e => {
    const above = sheets.at(-1);
    if (!open || !above) return;
    if (above.reader) { e.detail.reader = above.sheet; return; }
    const c = courseOf(e.detail.course);
    if (!c) return;
    e.detail.found = true;
    const ch = c.chapters[cahierChapterAt(c.chapters, e.detail.page ?? 0, e.detail.offset ?? 0)];
    e.detail.reader = openReader(c, ch, document.activeElement, { carnet: true, passage: e.detail }).sheet;
  };
  document.addEventListener('renzvi:revoir', onRevoir, true);
  const onChange = () => { if (!sheets.length) load(true); };
  document.addEventListener('renzvi:cours', onChange);
  document.addEventListener('renzvi:cartes', onChange);
  document.addEventListener('renzvi:reponse', onChange);

  load();
  return () => {
    gone = true;
    sortie?.cancel();
    if (open) fermer();
    leaveApercu();
    sheetSize.disconnect();
    clearTimeout(saveTimer);
    clearTimeout(liveTimer);
    offSon();
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('renzvi:revoir', onRevoir, true);
    document.removeEventListener('renzvi:cours', onChange);
    document.removeEventListener('renzvi:cartes', onChange);
    document.removeEventListener('renzvi:reponse', onChange);
  };
};
