// Study S1 : le widget Cahier. On importe un cours une fois (PDF qui contient du texte, ou texte), puis on le lit par
// chapitres et on y cherche. La liste des cours et leurs chapitres sont dans la table study_courses ; l'original, jamais
// modifié, et le texte extrait sont dans le stockage privé « cours ». Le texte d'un cours est toujours affiché avec
// textContent : il n'est jamais interprété comme du HTML ni exécuté.
// Une sélection du texte peut devenir une flashcard (cartes.js), qui garde la position du passage pour y revenir.
// Utilise el, button, plural et listOf, définis par dashboard.html.
const CAHIER = {
  pdfBytes: 20 * 1048576, textBytes: 2 * 1048576, pdfPages: 200, courses: 30, chapters: 80,
  subject: 60, title: 120, chapterTitle: 80, results: 40, positions: 30,
  pdfjs: 'vendor/pdfjs-6.4.299/',
};
const CAHIER_KEYWORD = /^(chapitre|chapter|partie|part|leçon|lecon|séance|seance|thème|theme|module|unité|unite|section)\s+([0-9]{1,3}|[ivxlc]{1,7}|premier|première|premiere)\b/i;
const CAHIER_NUMBER = /^([0-9]{1,2}|[IVXLC]{1,7})\s*[.)–—-]\s+[A-ZÀ-ÖØ-Þ]/;
const CAHIER_MARKDOWN = /^#{1,2}\s+\S/;
const cahierUserError = text => Object.assign(new Error(text), { user: true });

// Sans accents ni majuscules, mais de la même longueur que le texte : une position trouvée vaut aussi dans le texte d'origine.
function cahierFold(text) {
  const out = new Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c < '\x80') { out[i] = c.toLowerCase(); continue; }
    const f = c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    out[i] = f.length === 1 ? f : c;
  }
  return out.join('');
}

function cahierClean(text) {
  return text.replace(/\r\n?/g, '\n').replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').normalize('NFC');
}

// Remet les chapitres en ordre et en état : positions valides, sans doublon, le premier au tout début du cours.
// Avec intro, le texte placé avant le premier titre devient un chapitre « Début » s'il est assez long.
function cahierTidy(list, pages, intro = false) {
  const valid = listOf(list)
    .filter(c => Number.isInteger(c?.page) && c.page >= 0 && c.page < pages.length && Number.isInteger(c.offset) && c.offset >= 0 && c.offset <= pages[c.page].length)
    .map(c => ({
      id: typeof c.id === 'string' && c.id ? c.id.slice(0, 40) : crypto.randomUUID(),
      title: String(c.title ?? '').replace(/\s+/g, ' ').trim().slice(0, CAHIER.chapterTitle) || 'Sans titre',
      page: c.page, offset: c.offset,
    }))
    .sort((a, b) => a.page - b.page || a.offset - b.offset)
    .filter((c, i, all) => i === 0 || c.page !== all[i - 1].page || c.offset !== all[i - 1].offset)
    .slice(0, CAHIER.chapters);
  if (!valid.length) return [{ id: crypto.randomUUID(), title: 'Tout le cours', page: 0, offset: 0 }];
  const before = (pages.slice(0, valid[0].page).join('\n') + pages[valid[0].page].slice(0, valid[0].offset)).trim().length;
  if (intro && before > 300) valid.unshift({ id: crypto.randomUUID(), title: 'Début', page: 0, offset: 0 });
  else Object.assign(valid[0], { page: 0, offset: 0 });
  return valid.slice(0, CAHIER.chapters);
}

// Propose des chapitres : le sommaire du PDF s'il en a un, sinon les lignes qui ressemblent à des titres.
function cahierGuess(pages, outline = []) {
  if (outline.length >= 2) {
    // Le sommaire donne la page ; on cherche le titre dans la page pour commencer au bon endroit.
    return cahierTidy(outline.map(o => {
      const at = Number.isInteger(o.page) && pages[o.page] != null ? cahierFold(pages[o.page]).indexOf(cahierFold(String(o.title ?? '').trim())) : -1;
      return { ...o, offset: at > 0 ? at : 0 };
    }), pages, true);
  }
  const keyword = [], numbered = [], seen = new Set();
  pages.forEach((text, page) => {
    for (const m of text.matchAll(/^[ \t]*(\S[^\n]*?)[ \t]*$/gm)) {
      const line = m[1];
      if (line.length < 3 || line.length > CAHIER.chapterTitle || /[,;:]$/.test(line)) continue;
      const into = CAHIER_KEYWORD.test(line) || CAHIER_MARKDOWN.test(line) ? keyword : CAHIER_NUMBER.test(line) && !/\.$/.test(line) ? numbered : null;
      if (!into) continue;
      // Un titre répété en haut de chaque page n'est gardé qu'une fois.
      const key = cahierFold(line);
      if (seen.has(key)) continue;
      seen.add(key);
      into.push({ title: line.replace(/^#+\s*/, ''), page, offset: m.index + m[0].indexOf(line) });
    }
  });
  // « Chapitre 2 » ou « # Titre » sont sûrs ; des lignes numérotées ne comptent que si elles ressemblent à un plan.
  const found = keyword.length >= 2 ? keyword : numbered.length >= 2 && numbered.length <= 40 ? numbered : keyword;
  return cahierTidy(found, pages, true);
}

// Les morceaux de pages qui forment un chapitre, de son début jusqu'au début du suivant.
function cahierSlices(pages, from, to) {
  const out = [];
  const last = to ? to.page : pages.length - 1;
  for (let page = from.page; page <= last; page++) {
    const start = page === from.page ? from.offset : 0;
    const end = to && page === to.page ? to.offset : pages[page].length;
    if (end > start) out.push({ page, start, end });
  }
  return out;
}

function cahierChapterAt(chapters, page, offset) {
  let index = 0;
  chapters.forEach((c, i) => { if (c.page < page || (c.page === page && c.offset <= offset)) index = i; });
  return index;
}

function cahierSearch(pages, folded, query, chapters) {
  const q = cahierFold(query.trim());
  const found = [];
  if (q.length < 2) return found;
  for (let page = 0; page < pages.length && found.length < CAHIER.results; page++) {
    for (let at = folded[page].indexOf(q); at >= 0 && found.length < CAHIER.results; at = folded[page].indexOf(q, at + q.length)) {
      const from = Math.max(0, at - 40), to = Math.min(pages[page].length, at + q.length + 60);
      found.push({
        page, offset: at, length: q.length, chapter: cahierChapterAt(chapters, page, at),
        before: (from > 0 ? '…' : '') + pages[page].slice(from, at).replace(/\s+/g, ' '),
        match: pages[page].slice(at, at + q.length),
        after: pages[page].slice(at + q.length, to).replace(/\s+/g, ' ') + (to < pages[page].length ? '…' : ''),
      });
    }
  }
  return found;
}

async function cahierReadText(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = new TextDecoder('utf-8').decode(bytes);
  // Un fichier enregistré sous Windows n'est souvent pas en UTF-8 : sans ça, les accents deviennent des « � ».
  if (text.includes('�')) text = new TextDecoder('windows-1252').decode(bytes);
  return { pages: [cahierClean(text)], outline: [] };
}

async function cahierReadPdf(file, onProgress, signal) {
  const lib = await import(new URL(`${CAHIER.pdfjs}pdf.min.js`, location.href).href);
  lib.GlobalWorkerOptions.workerSrc = new URL(`${CAHIER.pdfjs}pdf.worker.min.js`, location.href).href;
  const task = lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, enableXfa: false, disableFontFace: true });
  const abort = () => task.destroy();
  signal.addEventListener('abort', abort);
  try {
    let pdf;
    try { pdf = await task.promise; } catch (e) {
      if (signal.aborted) throw e;
      if (e?.name === 'PasswordException') throw cahierUserError('Ce PDF est protégé par un mot de passe. Enlève la protection puis réessaie.');
      throw cahierUserError("Ce fichier n'a pas pu être lu comme un PDF.");
    }
    if (pdf.numPages > CAHIER.pdfPages) throw cahierUserError(`Ce PDF a ${pdf.numPages} pages, le cahier en accepte ${CAHIER.pdfPages} au plus. Coupe-le en plusieurs parties.`);
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      if (signal.aborted) throw new DOMException('Import annulé', 'AbortError');
      onProgress(n, pdf.numPages);
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      pages.push(cahierClean(content.items.map(i => (i.str ?? '') + (i.hasEOL ? '\n' : '')).join('')));
      page.cleanup();
    }
    const outline = [];
    for (const item of listOf(await pdf.getOutline().catch(() => null)).slice(0, CAHIER.chapters)) {
      try {
        const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest;
        if (!Array.isArray(dest)) continue;
        outline.push({ title: item.title, page: Number.isInteger(dest[0]) ? dest[0] : await pdf.getPageIndex(dest[0]) });
      } catch {}
    }
    return { pages, outline };
  } finally {
    signal.removeEventListener('abort', abort);
    task.destroy();
  }
}

function cahierWidget({ body, meta, data, save, user, sb }) {
  const box = body.closest('.widget');
  const store = sb.storage.from('cours');
  const pathOf = (course, name) => `${user.id}/${course.id}/${name}`;
  const originalName = course => course.kind === 'pdf' ? 'original.pdf' : 'original.txt';
  let courses = [], state = 'loading', mode = 'read', chapterIndex = 0, query = '';
  let gone = false, job = null, saveTimer, searchTimer, lastPick = null, armed = null, lastSel = null, cardDraft = null;
  const texts = new Map();
  let current = typeof data?.course === 'string' ? data.course : null;
  const at = Object.fromEntries(Object.entries(data?.at ?? {})
    .filter(([, v]) => typeof v?.chapter === 'string' && Number.isFinite(v?.y)).slice(-CAHIER.positions));
  const course = () => courses.find(c => c.id === current);
  const persist = () => {
    for (const id of Object.keys(at)) if (!courses.some(c => c.id === id)) delete at[id];
    save({ course: current ?? null, at: { ...at } });
  };

  const bar = el('div', 'cahier-bar');
  const pick = Object.assign(el('select', 'cahier-pick'), { ariaLabel: 'Cours' });
  const importBtn = button('ghost', 'Importer un cours', () => { mode = 'import'; draw(); });
  const grow = button('ghost', 'Agrandir', () => expand(!box.classList.contains('cahier-open')));
  bar.append(pick, importBtn, grow);
  const nav = el('div', 'cahier-nav');
  const chapterPick = Object.assign(el('select', 'cahier-pick'), { ariaLabel: 'Chapitre' });
  const prev = button('ghost cahier-step', '‹', () => openChapter(chapterIndex - 1));
  prev.ariaLabel = 'Chapitre précédent';
  const next = button('ghost cahier-step', '›', () => openChapter(chapterIndex + 1));
  next.ariaLabel = 'Chapitre suivant';
  const search = Object.assign(el('input', 'cahier-search'), { type: 'search', placeholder: 'Chercher dans le cours', ariaLabel: 'Chercher dans le cours', autocomplete: 'off', maxLength: 80 });
  nav.append(chapterPick, prev, next, search);
  const cardBar = el('div', 'cahier-cardbar');
  cardBar.append(el('span', 'zone', 'Avec la sélection :'), button('link', 'Créer une carte', () => makeCard('qa')), button('link', 'Masquer ces mots', () => makeCard('trou')));
  cardBar.hidden = true;
  const view = el('div', 'cahier-view');
  const note = el('p', 'zone cahier-note');
  note.setAttribute('role', 'status');
  const tools = el('div', 'cahier-tools');
  const editBtn = button('link', 'Modifier les chapitres', () => { mode = mode === 'edit' ? 'read' : 'edit'; draw(); });
  const originalBtn = button('link', "Télécharger l'original", downloadOriginal);
  const removeBtn = button('link cahier-danger', 'Supprimer ce cours', removeCourse);
  tools.append(editBtn, originalBtn, removeBtn);
  body.append(bar, nav, cardBar, view, note, tools);

  const say = (text, bad = false) => { note.textContent = text; note.classList.toggle('msg', bad); };

  function expand(open) {
    box.classList.toggle('cahier-open', open);
    document.body.classList.toggle('cahier-lock', open);
    grow.textContent = open ? 'Réduire' : 'Agrandir';
    grow.setAttribute('aria-pressed', open);
  }
  const onKey = e => { if (e.key === 'Escape' && box.classList.contains('cahier-open')) { expand(false); grow.focus(); } };
  box.addEventListener('keydown', onKey);
  // Garde le dernier endroit choisi dans le texte : toucher un bouton sur téléphone peut effacer la sélection.
  // Une sélection non vide propose d'en faire une carte ; elle reste proposée tant que le texte affiché ne change pas.
  const onSelect = () => {
    const p = selectionPos();
    if (p) lastPick = p;
    const r = selectionRange();
    if (r) { lastSel = r; cardBar.hidden = mode !== 'read'; }
  };
  document.addEventListener('selectionchange', onSelect);

  async function loadCourses() {
    state = 'loading';
    draw();
    const { data: rows, error } = await sb.from('study_courses').select('id,subject,title,kind,file_name,file_size,page_count,text_chars,chapters').order('created_at');
    if (gone) return;
    if (error) { state = 'error'; draw(); return; }
    courses = rows.map(r => ({ ...r, chapters: listOf(r.chapters).length ? listOf(r.chapters) : [{ id: 'tout', title: 'Tout le cours', page: 0, offset: 0 }] }));
    state = 'ready';
    if (!course()) current = courses.at(-1)?.id ?? null;
    openCourse(current, false);
  }

  function loadText(c) {
    if (texts.has(c.id)) return texts.get(c.id);
    const promise = (async () => {
      const { data: blob, error } = await store.download(pathOf(c, 'texte.json'));
      if (error || !blob) throw new Error('texte absent');
      const pages = listOf(JSON.parse(await blob.text())?.pages).filter(p => typeof p === 'string');
      if (!pages.length) throw new Error('texte vide');
      c.chapters = cahierTidy(c.chapters, pages);
      return { pages, folded: null };
    })();
    texts.set(c.id, promise);
    promise.catch(() => texts.delete(c.id));
    return promise;
  }

  function openCourse(id, remember = true) {
    current = id;
    const c = course();
    query = search.value = '';
    chapterIndex = c ? Math.max(0, c.chapters.findIndex(ch => ch.id === at[c.id]?.chapter)) : 0;
    if (mode !== 'import') mode = 'read';
    draw();
    if (remember) persist();
  }
  function openChapter(index) {
    const c = course();
    if (!c || index < 0 || index >= c.chapters.length) return;
    chapterIndex = index;
    query = search.value = '';
    at[c.id] = { chapter: c.chapters[index].id, y: 0 };
    draw();
    persist();
  }

  function draw() {
    const c = course();
    const ready = state === 'ready';
    if (state !== 'ready' || mode === 'import' || !c) expand(false);
    bar.hidden = !ready;
    pick.hidden = grow.hidden = !courses.length || mode === 'import';
    importBtn.hidden = mode === 'import';
    nav.hidden = tools.hidden = !ready || !c || mode === 'import';
    pick.replaceChildren(...[...new Set(courses.map(x => x.subject))].sort((a, b) => a.localeCompare(b, 'fr')).map(subject => {
      const group = Object.assign(el('optgroup'), { label: subject });
      group.append(...courses.filter(x => x.subject === subject).map(x => Object.assign(el('option', '', x.title), { value: x.id, selected: x.id === current })));
      return group;
    }));
    meta.textContent = ready && courses.length ? `${courses.length} cours` : '';
    if (state === 'loading') return view.replaceChildren(el('p', 'empty', 'Chargement de tes cours…'));
    if (state === 'error') {
      const retry = button('ghost', 'Réessayer', loadCourses);
      return view.replaceChildren(el('p', 'msg', "Tes cours n'ont pas pu se charger."), retry);
    }
    if (mode === 'import') return drawImport();
    if (!c) {
      const start = el('div', 'empty cahier-start');
      start.append(el('p', '', 'Importe un cours une fois : un PDF ou ton texte. Tu le retrouves ici, rangé par chapitres.'));
      return view.replaceChildren(start);
    }
    chapterPick.replaceChildren(...c.chapters.map((ch, i) => Object.assign(el('option', '', ch.title), { value: i, selected: i === chapterIndex })));
    prev.disabled = chapterIndex === 0;
    next.disabled = chapterIndex === c.chapters.length - 1;
    editBtn.textContent = mode === 'edit' ? 'Terminer les chapitres' : 'Modifier les chapitres';
    editBtn.hidden = nav.hidden = !c.text_chars;
    prev.hidden = next.hidden = !c.text_chars || c.chapters.length < 2;
    meta.textContent = c.text_chars ? `Chapitre ${chapterIndex + 1} / ${c.chapters.length}` : '';
    if (!c.text_chars) {
      return view.replaceChildren(el('p', 'cahier-alert', "Ce PDF ne contient pas de texte lisible : c'est sans doute un scan ou des photos. Il est bien gardé, mais le cahier ne lit pas encore les scans. Tu peux télécharger l'original ci-dessous."));
    }
    view.replaceChildren(el('p', 'empty', 'Ouverture du cours…'));
    loadText(c).then(text => {
      if (gone || course() !== c || mode === 'import') return;
      if (query) drawResults(c, text); else drawReader(c, text);
    }, () => {
      if (gone || course() !== c) return;
      const retry = button('ghost', 'Réessayer', draw);
      view.replaceChildren(el('p', 'msg', "Ce cours n'a pas pu s'ouvrir. Vérifie ta connexion."), retry);
    });
  }

  function drawReader(c, text, reveal) {
    const ch = c.chapters[chapterIndex];
    if (mode !== 'card') { lastSel = null; cardBar.hidden = true; }
    const reader = el('div', 'cahier-text');
    reader.tabIndex = 0;
    reader.ariaLabel = `Texte du chapitre ${ch.title}`;
    reader.append(el('h3', 'cahier-title', ch.title));
    const parts = cahierSlices(text.pages, ch, c.chapters[chapterIndex + 1]);
    // La ligne du titre est déjà affichée en tête : on ne la répète pas dans le texte.
    const first = parts[0], line = first && text.pages[first.page].slice(first.start).match(/^[ \t]*([^\n]*)\n?/);
    if (line && cahierFold(line[1].replace(/^#+\s*/, '').replace(/\s+/g, ' ').trim()) === cahierFold(ch.title)) first.start += line[0].length;
    for (const s of parts) {
      if (c.kind === 'pdf') reader.append(el('p', 'cahier-page', `Page ${s.page + 1}`));
      const block = el('div', 'cahier-block', text.pages[s.page].slice(s.start, s.end));
      Object.assign(block.dataset, { page: s.page, start: s.start });
      reader.append(block);
    }
    if (!parts.some(s => text.pages[s.page].slice(s.start, s.end).trim())) reader.append(el('p', 'empty', 'Ce chapitre est vide.'));
    const items = [reader];
    if (mode === 'edit') items.unshift(chapterEditor(c, text));
    if (mode === 'card' && cardDraft) items.unshift(cardPanel());
    view.replaceChildren(...items);
    reader.onscroll = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        delete at[c.id];
        at[c.id] = { chapter: ch.id, y: Math.round(reader.scrollTop) };
        persist();
      }, 800);
    };
    if (reveal) return show(reader, reveal);
    if (at[c.id]?.chapter === ch.id) reader.scrollTop = at[c.id].y;
  }

  // Surligne un passage trouvé et le fait venir au tiers haut du texte.
  function show(reader, { page, offset, length }) {
    const block = [...reader.querySelectorAll('.cahier-block')].find(b => +b.dataset.page === page && +b.dataset.start <= offset && offset < +b.dataset.start + b.textContent.length);
    if (!block?.firstChild) return;
    const start = offset - block.dataset.start;
    const range = document.createRange();
    range.setStart(block.firstChild, start);
    range.setEnd(block.firstChild, Math.min(block.firstChild.length, start + length));
    if (window.CSS?.highlights && window.Highlight) CSS.highlights.set('cahier', new Highlight(range));
    else { const s = getSelection(); s.removeAllRanges(); s.addRange(range); }
    reader.scrollTop += range.getBoundingClientRect().top - reader.getBoundingClientRect().top - reader.clientHeight / 3;
  }

  function drawResults(c, text) {
    text.folded ??= text.pages.map(cahierFold);
    const found = cahierSearch(text.pages, text.folded, query, c.chapters);
    if (!found.length) return view.replaceChildren(el('p', 'empty', `Rien trouvé pour « ${query.trim()} ».`));
    const list = el('ul', 'rows cahier-results');
    list.ariaLabel = 'Résultats de la recherche';
    for (const r of found) {
      const li = el('li', 'row');
      const go = button('grow cahier-hit', '', () => {
        chapterIndex = r.chapter;
        query = search.value = '';
        at[c.id] = { chapter: c.chapters[r.chapter].id, y: 0 };
        draw();
        loadText(c).then(t => { if (course() === c && !query) drawReader(c, t, r); });
        persist();
      });
      const where = el('span', 'cahier-where', `${c.chapters[r.chapter].title}${c.kind === 'pdf' ? ` · page ${r.page + 1}` : ''}`);
      const snippet = el('span', 'cahier-snippet');
      snippet.append(r.before, el('mark', '', r.match), r.after);
      go.append(where, snippet);
      li.append(go);
      list.append(li);
    }
    view.replaceChildren(el('p', 'zone', found.length >= CAHIER.results ? `Les ${CAHIER.results} premiers passages` : plural(found.length, 'passage') + (found.length > 1 ? ' trouvés' : ' trouvé')), list);
  }

  function selectionPos() {
    const s = getSelection();
    if (!s?.rangeCount) return null;
    const r = s.getRangeAt(0);
    const node = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
    const block = node?.closest?.('.cahier-block');
    if (!block || !view.contains(block)) return null;
    const pre = document.createRange();
    pre.setStart(block, 0);
    pre.setEnd(r.startContainer, r.startOffset);
    return { page: +block.dataset.page, offset: +block.dataset.start + pre.toString().length };
  }

  // Le passage sélectionné, limité au morceau de page où il commence.
  function selectionRange() {
    const s = getSelection();
    if (!s?.rangeCount || s.isCollapsed) return null;
    const r = s.getRangeAt(0);
    const blockOf = n => (n.nodeType === 1 ? n : n.parentElement)?.closest?.('.cahier-block');
    const block = blockOf(r.startContainer);
    if (!block || !view.contains(block)) return null;
    const pre = document.createRange();
    pre.setStart(block, 0);
    pre.setEnd(r.startContainer, r.startOffset);
    const start = pre.toString().length;
    let end = block.textContent.length;
    if (blockOf(r.endContainer) === block) { pre.setEnd(r.endContainer, r.endOffset); end = pre.toString().length; }
    const text = block.textContent.slice(start, end);
    if (!text.trim()) return null;
    return { page: +block.dataset.page, offset: +block.dataset.start + start, length: end - start, text };
  }

  // Question/réponse : le passage devient la réponse. Texte à trous : sa phrase, avec la sélection entre crochets.
  async function makeCard(kind) {
    const c = course(), s = lastSel;
    if (!c || !s) { say('Sélectionne un passage du cours, puis réessaie.', true); return; }
    const page = (await loadText(c)).pages[s.page];
    const card = { kind, deck: c.title.slice(0, CARTES.deck), course_id: c.id, src_page: s.page, src_offset: s.offset, src_length: s.length };
    if (kind === 'qa') Object.assign(card, { front: '', back: s.text.trim().slice(0, CARTES.back) });
    else {
      const a = s.offset, b = s.offset + s.length;
      let from = a, to = b;
      while (from > 0 && !/[.!?\n]/.test(page[from - 1]) && a - from < 300) from--;
      while (to < page.length && !/[.!?\n]/.test(page[to]) && to - b < 300) to++;
      if (/[.!?]/.test(page[to] ?? '')) to++;
      // Les crochets servent à masquer : ceux déjà dans le cours deviennent des parenthèses.
      const plain = t => t.replace(/\[/g, '(').replace(/\]/g, ')').replace(/\s+/g, ' ');
      const before = plain(page.slice(from, a)).trimStart().slice(-400), after = plain(page.slice(b, to)).trimEnd().slice(0, 400);
      Object.assign(card, cartesHoles(`${before}[${plain(page.slice(a, b)).trim().slice(0, 190)}]${after}`));
    }
    cardDraft = card;
    mode = 'card';
    cardBar.hidden = true;
    say('');
    draw();
  }

  function cardPanel() {
    const { form, focus } = cartesForm({
      sb, card: cardDraft, decks: [cardDraft.deck],
      close: saved => { cardDraft = null; mode = 'read'; draw(); if (saved) say('Carte créée. Tu la retrouves dans le widget Flashcards.'); },
    });
    const panel = el('div', 'cahier-edit');
    panel.append(form);
    requestAnimationFrame(focus);
    return panel;
  }

  async function saveChapters(c, chapters) {
    const before = c.chapters;
    c.chapters = chapters;
    const { error } = await sb.from('study_courses').update({ chapters, updated_at: new Date().toISOString() }).eq('id', c.id);
    if (gone) return false;
    if (error) { c.chapters = before; say("Le changement n'a pas été enregistré. Vérifie ta connexion et réessaie.", true); }
    else say('');
    return !error;
  }

  function chapterEditor(c, text) {
    const panel = el('div', 'cahier-edit');
    const cut = button('ghost', 'Nouveau chapitre ici', async () => {
      const pos = selectionPos() ?? lastPick;
      if (!pos) { say('Touche ou sélectionne dans le texte l’endroit où le chapitre commence, puis réessaie.', true); return; }
      const line = text.pages[pos.page].slice(pos.offset).split('\n')[0].trim();
      const id = crypto.randomUUID();
      const chapters = cahierTidy([...c.chapters, { id, title: line || 'Nouveau chapitre', ...pos }], text.pages);
      if (chapters.length === c.chapters.length) { say('Un chapitre commence déjà à cet endroit.', true); return; }
      if (await saveChapters(c, chapters)) { lastPick = null; chapterIndex = Math.max(0, chapters.findIndex(ch => ch.id === id)); draw(); }
    });
    cut.disabled = c.chapters.length >= CAHIER.chapters;
    const list = el('ul', 'rows cahier-chapters');
    list.ariaLabel = 'Chapitres';
    c.chapters.forEach((ch, i) => {
      const li = el('li', 'row');
      const title = Object.assign(el('input', 'cahier-rename'), { type: 'text', value: ch.title, maxLength: CAHIER.chapterTitle, ariaLabel: `Titre du chapitre ${i + 1}`, autocomplete: 'off' });
      title.onchange = async () => {
        const chapters = c.chapters.map(x => x.id === ch.id ? { ...x, title: title.value } : x);
        if (await saveChapters(c, cahierTidy(chapters, text.pages))) chapterPick.options[i].textContent = c.chapters[i].title;
      };
      // Retirer un chapitre ne retire aucun texte : il rejoint le chapitre d'avant.
      const remove = button('x', '×', async () => {
        if (await saveChapters(c, cahierTidy(c.chapters.filter(x => x.id !== ch.id), text.pages))) { chapterIndex = Math.min(chapterIndex, c.chapters.length - 1); draw(); }
      });
      remove.ariaLabel = `Retirer le chapitre ${ch.title}, son texte rejoint le précédent`;
      remove.hidden = c.chapters.length < 2;
      li.append(title, remove);
      list.append(li);
    });
    panel.append(cut, list);
    return panel;
  }

  function drawImport() {
    const form = el('form', 'cahier-import');
    form.noValidate = true;
    const field = (label, input) => { const f = el('label', 'cahier-field', label); f.append(input); return f; };
    const subjects = Object.assign(el('datalist'), { id: 'cahier-subjects' });
    subjects.append(...[...new Set(courses.map(c => c.subject))].map(s => Object.assign(el('option'), { value: s })));
    const subject = Object.assign(el('input'), { type: 'text', maxLength: CAHIER.subject, autocomplete: 'off', value: course()?.subject ?? '', placeholder: 'Droit civil, Biologie…' });
    subject.setAttribute('list', subjects.id);
    const title = Object.assign(el('input'), { type: 'text', maxLength: CAHIER.title, autocomplete: 'off', placeholder: 'Chapitre 3, Les contrats…' });
    const file = Object.assign(el('input'), { type: 'file', accept: '.pdf,.txt,.md,application/pdf,text/plain,text/markdown', hidden: true });
    const hint = Object.assign(el('p', 'zone', 'PDF qui contient du texte (20 Mo et 200 pages au plus) ou fichier texte. Les scans et les photos ne sont pas encore lus.'), { id: 'cahier-hint' });
    const choose = button('ghost cahier-file', 'Choisir un fichier', () => file.click());
    choose.setAttribute('aria-describedby', hint.id);
    const chosen = el('p', 'cahier-chosen');
    const paste = Object.assign(el('textarea', 'cahier-paste'), { placeholder: 'Ou colle ici le texte de ton cours', ariaLabel: 'Texte du cours à coller', maxLength: CAHIER.textBytes / 2 });
    const progress = Object.assign(el('progress', 'cahier-progress'), { hidden: true, max: 1, value: 0 });
    progress.ariaLabel = "Progression de l'import";
    const status = el('p', 'zone');
    status.setAttribute('role', 'status');
    const submit = Object.assign(el('button', 'primary', 'Importer'), { type: 'submit' });
    const cancel = button('ghost', 'Annuler', () => {
      if (job) { job.abort(); return; }
      mode = 'read';
      say('');
      draw();
    });
    const actions = el('div', 'cahier-actions');
    actions.append(submit, cancel);
    const fileRow = el('div', 'cahier-filerow');
    fileRow.append(choose, chosen);
    form.append(field('Matière', subject), field('Titre du cours', title), fileRow, hint, file, subjects, paste, progress, status, actions);
    file.onchange = () => {
      const f = file.files[0];
      chosen.textContent = f ? f.name : '';
      if (f && !title.value.trim()) title.value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, CAHIER.title);
    };
    form.onsubmit = async e => {
      e.preventDefault();
      if (job) return;
      const f = file.files[0], pasted = paste.value.trim();
      const isPdf = !!f && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
      const fail = (text, focus) => { status.textContent = text; status.classList.add('msg'); focus?.focus(); };
      status.classList.remove('msg');
      if (!subject.value.trim()) return fail('Indique la matière de ce cours.', subject);
      if (!f && !pasted) return fail('Choisis un fichier ou colle le texte de ton cours.', choose);
      if (courses.length >= CAHIER.courses) return fail(`Tu as déjà ${CAHIER.courses} cours : supprimes-en un pour en importer un autre.`);
      if (f && !isPdf && !/^text\//.test(f.type) && !/\.(txt|md)$/i.test(f.name)) return fail('Ce type de fichier n’est pas encore lu : choisis un PDF ou un fichier texte (.txt).', choose);
      if (f && f.size > (isPdf ? CAHIER.pdfBytes : CAHIER.textBytes)) return fail(isPdf ? 'Ce PDF est trop lourd : 20 Mo au plus.' : 'Ce fichier texte est trop lourd : 2 Mo au plus.', choose);
      const original = f ?? new Blob([pasted], { type: 'text/plain' });
      if (!f && original.size > CAHIER.textBytes) return fail('Ce texte est trop long : 2 Mo au plus.', paste);
      job = new AbortController();
      const signal = job.signal;
      submit.disabled = true;
      for (const input of [subject, title, paste, choose]) input.disabled = true;
      progress.hidden = !isPdf;
      status.textContent = isPdf ? 'Ouverture du PDF…' : 'Lecture du texte…';
      try {
        const read = isPdf
          ? await cahierReadPdf(f, (n, total) => { progress.max = total; progress.value = n; status.textContent = `Lecture de la page ${n} sur ${total}…`; }, signal)
          : await cahierReadText(original);
        if (signal.aborted) throw new DOMException('Import annulé', 'AbortError');
        const chars = read.pages.reduce((n, p) => n + p.trim().length, 0);
        // Un scan n'a presque pas de texte : au mieux des numéros de page.
        const usable = isPdf ? chars >= 20 * read.pages.length : chars > 0;
        if (!isPdf && !usable) throw cahierUserError('Ce fichier est vide.');
        const c = {
          id: crypto.randomUUID(), subject: subject.value.trim().slice(0, CAHIER.subject),
          title: (title.value.trim() || (f ? f.name.replace(/\.[^.]+$/, '') : 'Mon cours')).slice(0, CAHIER.title),
          kind: isPdf ? 'pdf' : 'texte', file_name: (f?.name || 'texte-colle.txt').slice(-200), file_size: original.size,
          page_count: read.pages.length, text_chars: usable ? chars : 0,
          chapters: usable ? cahierGuess(read.pages, read.outline) : [{ id: crypto.randomUUID(), title: 'Tout le cours', page: 0, offset: 0 }],
        };
        status.textContent = 'Enregistrement sur ton compte…';
        cancel.disabled = true; // l'envoi est court : l'interrompre laisserait des fichiers sans cours
        const files = [pathOf(c, originalName(c)), pathOf(c, 'texte.json')];
        let error = (await store.upload(files[0], original, { contentType: isPdf ? 'application/pdf' : 'text/plain', upsert: false })).error;
        if (!error) error = (await store.upload(files[1], new Blob([JSON.stringify({ v: 1, pages: read.pages })], { type: 'application/json' }), { contentType: 'application/json', upsert: false })).error;
        if (!error) error = (await sb.from('study_courses').insert(c)).error;
        if (error) {
          await store.remove(files);
          throw cahierUserError("L'enregistrement n'a pas abouti. Vérifie ta connexion et réessaie.");
        }
        if (gone) return;
        courses.push(c);
        texts.set(c.id, Promise.resolve({ pages: read.pages, folded: null }));
        mode = 'read';
        openCourse(c.id);
        say(!usable ? '' : c.chapters.length > 1 ? `${c.chapters.length} chapitres trouvés. Vérifie-les avec « Modifier les chapitres ».` : 'Aucun titre de chapitre trouvé : crée tes chapitres avec « Modifier les chapitres ».');
      } catch (err) {
        if (gone) return;
        if (err?.name === 'AbortError' || signal.aborted) { status.textContent = 'Import annulé. Rien n’a été enregistré.'; status.classList.remove('msg'); }
        else { if (!err?.user) console.error(err); fail(err?.user ? err.message : "Ce fichier n'a pas pu être lu. Essaie un autre PDF ou colle le texte."); }
      } finally {
        job = null;
        if (!gone && mode === 'import') {
          submit.disabled = cancel.disabled = false;
          for (const input of [subject, title, paste, choose]) input.disabled = false;
          progress.hidden = true;
        }
      }
    };
    view.replaceChildren(form);
    subject.focus({ preventScroll: true });
  }

  async function downloadOriginal() {
    const c = course();
    if (!c) return;
    originalBtn.disabled = true;
    const { data: blob, error } = await store.download(pathOf(c, originalName(c)));
    originalBtn.disabled = false;
    if (error || !blob) { say("L'original n'a pas pu être téléchargé. Vérifie ta connexion.", true); return; }
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: c.file_name }).click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // Deux appuis pour supprimer : le premier demande confirmation pendant quelques secondes.
  async function removeCourse() {
    const c = course();
    if (!c) return;
    if (armed !== c.id) {
      armed = c.id;
      removeBtn.textContent = `Supprimer « ${c.title.slice(0, 40)} » ? Appuie encore`;
      setTimeout(() => { if (armed === c.id) { armed = null; removeBtn.textContent = 'Supprimer ce cours'; } }, 4000);
      return;
    }
    armed = null;
    removeBtn.textContent = 'Supprimer ce cours';
    removeBtn.disabled = true;
    const { error } = await sb.from('study_courses').delete().eq('id', c.id);
    removeBtn.disabled = false;
    if (gone) return;
    if (error) { say("La suppression n'a pas abouti. Vérifie ta connexion et réessaie.", true); return; }
    // shortcut: si cet appel échoue, les fichiers restent dans le stockage sans cours ; ajouter un nettoyage serveur si ça arrive.
    store.remove([pathOf(c, originalName(c)), pathOf(c, 'texte.json')]);
    courses = courses.filter(x => x !== c);
    texts.delete(c.id);
    delete at[c.id];
    say(`« ${c.title} » est supprimé.`);
    openCourse(courses.at(-1)?.id ?? null);
  }

  // « Revoir dans le cours » depuis une carte : ouvre le cours au chapitre du passage et le surligne.
  const onRevoir = e => {
    const d = e.detail;
    if (state !== 'ready') return;
    const c = courses.find(x => x.id === d.course);
    if (!c) { d.found ||= 'absent'; return; }
    d.found = true;
    if (job) return;
    mode = 'read';
    cardDraft = null;
    current = c.id;
    query = search.value = '';
    say('');
    const place = () => {
      chapterIndex = cahierChapterAt(c.chapters, d.page, d.offset);
      at[c.id] = { chapter: c.chapters[chapterIndex].id, y: 0 };
    };
    place();
    draw();
    // Les chapitres sont remis en ordre au chargement du texte : on replace le chapitre, puis on surligne.
    const live = () => !gone && course() === c && !query && mode === 'read';
    loadText(c).then(() => {
      if (!live()) return null;
      place();
      persist();
      draw();
      return loadText(c);
    }).then(t => { if (t && live()) drawReader(c, t, d); }, () => {});
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  document.addEventListener('renzvi:revoir', onRevoir);

  pick.onchange = () => { say(''); openCourse(pick.value); };
  chapterPick.onchange = () => openChapter(Number(chapterPick.value));
  search.oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      query = search.value.trim().length >= 2 ? search.value : '';
      if (window.CSS?.highlights) CSS.highlights.delete('cahier');
      const c = course();
      if (c) loadText(c).then(t => { if (course() === c) query ? drawResults(c, t) : drawReader(c, t); }, () => {});
    }, 200);
  };

  loadCourses();
  return () => {
    gone = true;
    job?.abort();
    clearTimeout(saveTimer);
    clearTimeout(searchTimer);
    expand(false);
    box.removeEventListener('keydown', onKey);
    document.removeEventListener('selectionchange', onSelect);
    document.removeEventListener('renzvi:revoir', onRevoir);
  };
}
