// Study S6 : le widget Quiz. Des QCM (une ou plusieurs bonnes réponses) écrits à la main, importés en CSV ou générés
// depuis le Cahier. Les choix sont mélangés à chaque fois ; la correction est locale, sans IA. Chaque réponse est gardée
// (study_quiz_answers) avec la version de la question, et les questions ratées forment « Mes erreurs », sans rien
// recopier. Texte toujours affiché avec textContent. Widget en préparation : caché sauf avec ?labo=1.
// Utilise el, button, plural, listOf (dashboard.html) et cartesCsv, cartesKey, cartesSourceLink, cartesChanged (cartes.js).
const QUIZ = { questions: 3000, page: 1000, batch: 500, question: 600, choix: 200, explication: 1000, deck: 60, lengths: [5, 10, 20] };
const QUIZ_FIELDS = 'id,deck,question,choix,bonnes,explication,course_id,src_page,src_offset,src_length,version,signalee,derniere_reussie,derniere_at,created_at';

async function quizLoad(sb) {
  const all = [];
  for (let from = 0; from < QUIZ.questions; from += QUIZ.page) {
    const { data, error } = await sb.from('study_questions').select(QUIZ_FIELDS).order('created_at').order('id').range(from, from + QUIZ.page - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < QUIZ.page) break;
  }
  return all.filter(q => listOf(q.choix).length >= 2 && listOf(q.bonnes).length >= 1);
}
const quizShuffle = list => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// Réussie seulement si les choix cochés sont exactement les bonnes réponses.
const quizCorrect = (q, chosen) => chosen.size === q.bonnes.length && q.bonnes.every(b => chosen.has(b));

// Une question valide à partir des champs d'un formulaire ou d'une ligne de CSV ; lève une erreur lisible sinon.
function quizCheck({ question, choix, bonnes }) {
  question = String(question ?? '').trim();
  const list = choix.map(c => String(c ?? '').replace(/\s+/g, ' ').trim());
  if (!question) throw cartesError('Écris la question.');
  if (question.length > QUIZ.question) throw cartesError(`La question dépasse ${QUIZ.question} caractères.`);
  const kept = list.map((c, i) => ({ c, good: bonnes.includes(i) })).filter(x => x.c);
  if (kept.length < 2) throw cartesError('Il faut au moins deux choix.');
  if (kept.length > 6) throw cartesError('Six choix au plus.');
  if (kept.some(x => x.c.length > QUIZ.choix)) throw cartesError(`Un choix dépasse ${QUIZ.choix} caractères.`);
  if (new Set(kept.map(x => cahierFold(x.c))).size !== kept.length) throw cartesError('Deux choix sont identiques.');
  if (!kept.some(x => x.good)) throw cartesError('Coche au moins une bonne réponse.');
  return { question, choix: kept.map(x => x.c), bonnes: kept.flatMap((x, i) => x.good ? [i] : []) };
}

// CSV : question ; bonne réponse ; mauvaise ; mauvaise… (une seule bonne réponse par ligne, la deuxième colonne).
function quizFromCsv(text, existing = []) {
  const rows = cartesCsv(text);
  if (rows.length && /^question/i.test(cahierFold(rows[0].cells[0].trim()))) rows.shift();
  const seen = new Set(existing.map(q => cahierFold(q.question.replace(/\s+/g, ' ').trim())));
  const ready = [], invalid = [];
  let duplicates = 0;
  for (const { line, cells } of rows) {
    try {
      const q = quizCheck({ question: cells[0], choix: cells.slice(1, 7), bonnes: [0] });
      const key = cahierFold(q.question.replace(/\s+/g, ' '));
      if (seen.has(key)) { duplicates++; continue; }
      seen.add(key);
      ready.push(q);
    } catch (e) { invalid.push({ line, reason: e.message.replace(/\.$/, '').toLowerCase() }); }
  }
  return { ready, invalid, duplicates };
}

function quizWidget({ body, meta, data, save, sb }) {
  const box = body.closest('.widget');
  let questions = [], state = 'loading', mode = 'start', deck = typeof data?.deck === 'string' ? data.deck : '', length = QUIZ.lengths.includes(data?.length) ? data.length : 10;
  let session = null, gone = false, editing = null, armed = null;

  const bar = el('div', 'cahier-bar');
  const pick = Object.assign(el('select', 'cahier-pick'), { ariaLabel: 'Paquet du quiz' });
  const newBtn = button('ghost', 'Nouvelle question', () => { editing = null; setMode('new'); });
  const importBtn = button('ghost', 'Importer', () => setMode('import'));
  const listBtn = button('ghost', 'Gérer', () => setMode(mode === 'list' ? 'start' : 'list'));
  bar.append(pick, newBtn, importBtn, listBtn);
  const view = el('div', 'cartes-view');
  const note = el('p', 'zone cahier-note');
  note.setAttribute('role', 'status');
  body.append(bar, view, note);
  const say = (text, bad = false) => { note.textContent = text; note.classList.toggle('msg', bad); };
  const setMode = m => { mode = m; say(''); draw(); };
  const decks = () => [...new Set(questions.map(q => q.deck))].sort((a, b) => a.localeCompare(b, 'fr'));
  const inDeck = () => questions.filter(q => !deck || q.deck === deck);
  const playable = () => inDeck().filter(q => !q.signalee);
  const errors = () => playable().filter(q => q.derniere_reussie === false);

  async function load() {
    state = 'loading';
    draw();
    try { questions = await quizLoad(sb); } catch { if (!gone) { state = 'error'; draw(); } return; }
    if (gone) return;
    if (deck && !questions.some(q => q.deck === deck)) deck = '';
    state = 'ready';
    if (session) session.ids = session.ids.filter(id => questions.some(q => q.id === id));
    draw();
  }

  function start(onlyErrors) {
    const pool = onlyErrors ? errors() : playable();
    const ids = quizShuffle(pool.map(q => q.id)).slice(0, onlyErrors ? pool.length : length);
    session = { ids, index: 0, chosen: new Set(), shown: false, order: null, results: [], onlyErrors };
    mode = 'play';
    say('');
    draw();
  }

  function draw() {
    const ready = state === 'ready';
    bar.hidden = !ready;
    listBtn.hidden = pick.hidden = !questions.length;
    listBtn.textContent = mode === 'list' ? 'Quiz' : 'Gérer';
    pick.replaceChildren(Object.assign(el('option', '', `Tous les paquets (${questions.length})`), { value: '' }),
      ...decks().map(d => Object.assign(el('option', '', `${d} (${questions.filter(q => q.deck === d).length})`), { value: d, selected: d === deck })));
    meta.textContent = '';
    if (state === 'loading') return view.replaceChildren(el('p', 'empty', 'Chargement de tes questions…'));
    if (state === 'error') return view.replaceChildren(el('p', 'msg', "Tes questions n'ont pas pu se charger."), button('ghost', 'Réessayer', load));
    if (mode === 'new' || mode === 'edit') return drawForm();
    if (mode === 'import') return drawImport();
    if (!questions.length) return view.replaceChildren(el('p', 'empty cartes-start', 'Écris une question, importe un CSV, ou génère un quiz depuis un chapitre du Cahier.'));
    if (mode === 'list') return drawList();
    if (mode === 'play' && session) return session.index < session.ids.length ? drawQuestion() : drawDone();
    drawStart();
  }

  function drawStart() {
    const n = playable().length, e = errors().length;
    const wrap = el('div', 'cartes-done');
    wrap.append(el('p', 'cartes-face', `${plural(n, 'question')} prête${n > 1 ? 's' : ''}`));
    const lengths = el('div', 'cartes-kinds');
    lengths.setAttribute('role', 'group');
    lengths.ariaLabel = 'Longueur de la séance';
    for (const l of QUIZ.lengths) {
      const b = button('ghost', `${l} questions`, () => { length = l; save({ deck, length }); draw(); });
      b.setAttribute('aria-pressed', l === length);
      lengths.append(b);
    }
    const go = button('primary', 'Commencer', () => start(false));
    go.disabled = !n;
    wrap.append(lengths, go);
    if (e) wrap.append(button('ghost', `Refaire mes erreurs (${e})`, () => start(true)));
    const flagged = inDeck().filter(q => q.signalee).length;
    if (flagged) wrap.append(el('p', 'zone', `${plural(flagged, 'question')} signalée${flagged > 1 ? 's' : ''} comme fausse${flagged > 1 ? 's' : ''} : corrige-les dans « Gérer ».`));
    view.replaceChildren(wrap);
  }

  function drawQuestion() {
    const q = questions.find(x => x.id === session.ids[session.index]);
    if (!q) { session.index++; return draw(); }
    // L'ordre des choix change à chaque question, mais chaque libellé garde sa position d'origine pour la correction.
    session.order ??= quizShuffle(q.choix.map((_, i) => i));
    meta.textContent = `${session.index + 1} / ${session.ids.length}`;
    const face = el('div', 'cartes-card');
    face.tabIndex = -1;
    face.append(el('p', 'cartes-deck', q.deck), el('p', 'cartes-face', q.question));
    if (q.bonnes.length > 1) face.append(el('p', 'revisions-new', 'Plusieurs réponses possibles'));
    const list = el('div', 'quiz-choices');
    list.setAttribute('role', 'group');
    list.ariaLabel = 'Choix';
    session.order.forEach((i, pos) => {
      const b = button('ghost quiz-choice', '', () => {
        if (session.shown) return;
        if (q.bonnes.length === 1) session.chosen = new Set([i]);
        else session.chosen.has(i) ? session.chosen.delete(i) : session.chosen.add(i);
        draw();
        view.querySelectorAll('.quiz-choice')[pos]?.focus();
      });
      b.append(el('span', 'quiz-key', String(pos + 1)), el('span', '', q.choix[i]));
      b.setAttribute('aria-pressed', session.chosen.has(i));
      if (session.shown) {
        const good = q.bonnes.includes(i);
        b.classList.add(good ? 'good' : session.chosen.has(i) ? 'bad' : 'off');
        b.append(el('span', 'quiz-mark', good ? 'Bonne réponse' : session.chosen.has(i) ? 'Ta réponse' : ''));
      }
      list.append(b);
    });
    const actions = el('div', 'cahier-actions cartes-rate');
    const items = [face, list, actions];
    if (!session.shown) {
      const check = button('primary', 'Valider', () => answer(q));
      check.disabled = !session.chosen.size;
      actions.append(check);
    } else {
      const ok = quizCorrect(q, session.chosen);
      face.append(el('p', ok ? 'ia-tag quiz-ok' : 'ia-tag quiz-ko', ok ? 'Bonne réponse' : 'Pas tout à fait'));
      if (q.explication) items.splice(2, 0, el('p', 'cartes-back', q.explication));
      actions.append(button('primary', session.index + 1 < session.ids.length ? 'Question suivante' : 'Voir le bilan', () => { session.index++; session.chosen = new Set(); session.shown = false; session.order = null; draw(); view.querySelector('.quiz-choice')?.focus(); }));
      const flag = button('link', 'Signaler une erreur dans cette question', async () => {
        flag.disabled = true;
        const { error } = await sb.from('study_questions').update({ signalee: true }).eq('id', q.id);
        if (error) { flag.disabled = false; say("Le signalement n'a pas été enregistré.", true); return; }
        q.signalee = true;
        flag.textContent = 'Signalée : corrige-la dans « Gérer ».';
      });
      if (q.signalee) { flag.disabled = true; flag.textContent = 'Signalée : corrige-la dans « Gérer ».'; }
      const src = cartesSourceLink(q, say);
      items.push(...(src ? [src] : []), flag);
    }
    view.replaceChildren(...items);
  }

  async function answer(q) {
    if (session.shown || !session.chosen.size) return;
    const reussie = quizCorrect(q, session.chosen);
    session.shown = true;
    session.results.push({ id: q.id, reussie });
    q.derniere_reussie = reussie;
    draw();
    view.querySelector('.cartes-rate .primary')?.focus();
    const { error } = await sb.from('study_quiz_answers').insert({ question_id: q.id, question_version: q.version, donnees: [...session.chosen].sort(), reussie });
    if (error && !gone) say("Ta réponse n'a pas été enregistrée. Vérifie ta connexion.", true);
  }

  function drawDone() {
    const good = session.results.filter(r => r.reussie).length, total = session.results.length;
    const wrap = el('div', 'cartes-done');
    wrap.append(el('p', 'cartes-face', total ? `${good} bonne${good > 1 ? 's' : ''} réponse${good > 1 ? 's' : ''} sur ${total}` : 'Aucune question dans cette séance.'));
    const missed = session.results.filter(r => !r.reussie).map(r => questions.find(q => q.id === r.id)).filter(Boolean);
    if (missed.length) {
      wrap.append(el('p', 'cartes-sum', 'À revoir'));
      const list = el('ul', 'rows cartes-list');
      list.ariaLabel = 'Questions ratées';
      for (const q of missed) {
        const li = el('li', 'row');
        li.append(el('span', 'grow cartes-line', `${q.question} — ${q.bonnes.map(b => q.choix[b]).join(' ; ')}`));
        const src = cartesSourceLink(q, say);
        if (src) li.append(src);
        list.append(li);
      }
      wrap.append(list, button('primary', `Refaire mes erreurs (${errors().length})`, () => start(true)));
    }
    wrap.append(button('ghost', 'Nouvelle séance', () => { session = null; mode = 'start'; draw(); }));
    view.replaceChildren(wrap);
  }

  function drawList() {
    const list = el('ul', 'rows cartes-list');
    list.ariaLabel = 'Questions du paquet';
    const shown = [...inDeck()].sort((a, b) => Number(b.signalee) - Number(a.signalee));
    meta.textContent = plural(shown.length, 'question');
    for (const q of shown) {
      const li = el('li', 'row');
      li.append(el('span', 'grow cartes-line', `${q.signalee ? '⚠ Signalée · ' : ''}${q.question} — ${q.bonnes.map(b => q.choix[b]).join(' ; ')}`));
      const edit = button('link', 'Modifier', () => { editing = q; setMode('edit'); });
      edit.ariaLabel = `Modifier la question ${q.question.slice(0, 40)}`;
      const remove = button('x', '×', async () => {
        if (armed !== q.id) {
          armed = q.id;
          remove.textContent = 'Supprimer ?';
          remove.classList.add('armed');
          setTimeout(() => { if (armed === q.id) { armed = null; remove.textContent = '×'; remove.classList.remove('armed'); } }, 4000);
          return;
        }
        armed = null;
        remove.disabled = true;
        const { error } = await sb.from('study_questions').delete().eq('id', q.id);
        if (error) { remove.disabled = false; say("La suppression n'a pas abouti.", true); return; }
        questions = questions.filter(x => x !== q);
        say('Question supprimée.');
        draw();
      });
      remove.ariaLabel = `Supprimer la question ${q.question.slice(0, 40)}`;
      li.append(edit, remove);
      list.append(li);
    }
    view.replaceChildren(list);
  }

  function drawForm() {
    const q = mode === 'edit' ? editing : null;
    const form = el('form', 'cartes-form');
    form.noValidate = true;
    const field = (label, input) => { const f = el('label', 'cahier-field', label); f.append(input); return f; };
    const names = Object.assign(el('datalist'), { id: 'quiz-decks' });
    names.append(...decks().map(d => Object.assign(el('option'), { value: d })));
    const deckInput = Object.assign(el('input'), { type: 'text', maxLength: QUIZ.deck, autocomplete: 'off', value: q?.deck ?? (deck || decks()[0] || ''), placeholder: 'Biologie, Histoire…' });
    deckInput.setAttribute('list', names.id);
    const text = Object.assign(el('textarea', 'cahier-paste cartes-area'), { ariaLabel: 'Question', value: q?.question ?? '', maxLength: QUIZ.question });
    const rows = el('div', 'quiz-edit');
    const choices = [];
    const addChoice = (value = '', good = false) => {
      if (choices.length >= 6) return;
      const row = el('div', 'quiz-edit-row');
      const n = choices.length + 1;
      const input = Object.assign(el('input'), { type: 'text', maxLength: QUIZ.choix, value, ariaLabel: `Choix ${n}`, autocomplete: 'off' });
      const ok = Object.assign(el('input'), { type: 'checkbox', checked: good, ariaLabel: `Choix ${n} : bonne réponse` });
      const okLabel = el('label', 'quiz-good');
      okLabel.append(ok, el('span', '', 'Bonne'));
      row.append(input, okLabel);
      rows.append(row);
      choices.push({ input, ok });
    };
    (q ? q.choix : ['', '', '', '']).forEach((c, i) => addChoice(c, q ? q.bonnes.includes(i) : false));
    const more = button('link', 'Ajouter un choix', () => { addChoice(); more.hidden = choices.length >= 6; });
    more.hidden = choices.length >= 6;
    const expl = Object.assign(el('textarea', 'cahier-paste cartes-area'), { ariaLabel: 'Explication (facultative)', value: q?.explication ?? '', maxLength: QUIZ.explication });
    const status = el('p', 'zone');
    status.setAttribute('role', 'status');
    const submit = Object.assign(el('button', 'primary', q ? 'Enregistrer' : 'Créer la question'), { type: 'submit' });
    const actions = el('div', 'cahier-actions');
    actions.append(submit, button('ghost', 'Annuler', () => setMode(q ? 'list' : 'start')));
    if (q) form.append(el('p', 'zone', 'Si tu changes la question ou ses choix, tes anciennes réponses ne comptent plus pour elle.'));
    form.append(field('Paquet', deckInput), names, field('Question', text), el('p', 'cahier-field', 'Choix (coche la ou les bonnes réponses)'), rows, more, field('Explication (facultative)', expl), status, actions);
    form.onsubmit = async e => {
      e.preventDefault();
      status.classList.add('msg');
      const name = deckInput.value.replace(/\s+/g, ' ').trim().slice(0, QUIZ.deck);
      if (!name) { status.textContent = 'Indique le paquet de cette question.'; return deckInput.focus(); }
      let row;
      try { row = quizCheck({ question: text.value, choix: choices.map(c => c.input.value), bonnes: choices.flatMap((c, i) => c.ok.checked ? [i] : []) }); } catch (err) { status.textContent = err.message; return; }
      Object.assign(row, { deck: name, explication: expl.value.trim().slice(0, QUIZ.explication), ...(q && { signalee: false }) });
      submit.disabled = true;
      const { error } = q ? await sb.from('study_questions').update(row).eq('id', q.id) : await sb.from('study_questions').insert(row);
      submit.disabled = false;
      if (error) { status.textContent = "La question n'a pas été enregistrée. Vérifie ta connexion."; return; }
      deck = name;
      save({ deck, length });
      mode = q ? 'list' : 'start';
      say(q ? 'Question enregistrée.' : 'Question créée.');
      load();
    };
    view.replaceChildren(form);
    text.focus({ preventScroll: true });
  }

  function drawImport() {
    const form = el('form', 'cahier-import');
    form.noValidate = true;
    const field = (label, input) => { const f = el('label', 'cahier-field', label); f.append(input); return f; };
    const deckInput = Object.assign(el('input'), { type: 'text', maxLength: QUIZ.deck, autocomplete: 'off', value: deck, placeholder: 'Histoire, Dates…' });
    const file = Object.assign(el('input'), { type: 'file', accept: '.csv,.txt,.tsv,text/csv,text/plain', hidden: true });
    const chosen = el('p', 'cahier-chosen');
    const fileRow = el('div', 'cahier-filerow');
    fileRow.append(button('ghost', 'Choisir un fichier', () => file.click()), chosen);
    const paste = Object.assign(el('textarea', 'cahier-paste'), { placeholder: 'Ou colle tes lignes : question;bonne réponse;mauvaise;mauvaise', ariaLabel: 'Lignes à importer' });
    const preview = el('div', 'cartes-preview');
    const status = el('p', 'zone');
    status.setAttribute('role', 'status');
    const submit = Object.assign(el('button', 'primary', 'Vérifier'), { type: 'submit' });
    const actions = el('div', 'cahier-actions');
    actions.append(submit, button('ghost', 'Annuler', () => setMode('start')));
    form.append(field('Paquet', deckInput), fileRow, el('p', 'zone', 'CSV en UTF-8 : la question, puis la bonne réponse, puis 1 à 5 mauvaises réponses. 500 questions au plus par import.'), file, paste, preview, status, actions);
    let ready = null;
    const reset = () => { ready = null; preview.replaceChildren(); submit.textContent = 'Vérifier'; };
    file.onchange = () => { chosen.textContent = file.files[0]?.name ?? ''; reset(); };
    paste.oninput = deckInput.oninput = reset;
    form.onsubmit = async e => {
      e.preventDefault();
      status.classList.remove('msg');
      const name = deckInput.value.replace(/\s+/g, ' ').trim().slice(0, QUIZ.deck);
      const fail = t => { status.textContent = t; status.classList.add('msg'); };
      if (!name) return fail('Indique le paquet où ranger ces questions.');
      if (ready) {
        submit.disabled = true;
        const { error } = await sb.from('study_questions').insert(ready.map(r => ({ ...r, deck: name })));
        submit.disabled = false;
        if (error) return fail("L'import n'a pas abouti, aucune question n'a été ajoutée.");
        deck = name;
        save({ deck, length });
        mode = 'start';
        say(`${plural(ready.length, 'question')} importée${ready.length > 1 ? 's' : ''}.`);
        return load();
      }
      const f = file.files[0];
      if (!f && !paste.value.trim()) return fail('Choisis un fichier CSV ou colle tes lignes.');
      if (f && f.size > CARTES.csvBytes) return fail('Ce fichier est trop lourd : 1 Mo au plus.');
      let txt = f ? await f.text() : paste.value;
      if (f && txt.includes('�')) txt = new TextDecoder('windows-1252').decode(await f.arrayBuffer());
      const r = quizFromCsv(txt, questions.filter(q => q.deck === name));
      if (r.ready.length > QUIZ.batch) return fail(`Ce fichier contient ${r.ready.length} questions : ${QUIZ.batch} au plus par import.`);
      if (r.ready.length > QUIZ.questions - questions.length) return fail(`Tu peux encore créer ${QUIZ.questions - questions.length} questions.`);
      const lines = [el('p', 'cartes-sum', r.ready.length ? `${plural(r.ready.length, 'question')} prête${r.ready.length > 1 ? 's' : ''} à importer.` : 'Aucune question à importer.')];
      if (r.duplicates) lines.push(el('p', 'zone', `${plural(r.duplicates, 'doublon')} écarté${r.duplicates > 1 ? 's' : ''}.`));
      if (r.invalid.length) lines.push(el('p', 'zone msg', `${plural(r.invalid.length, 'ligne')} ignorée${r.invalid.length > 1 ? 's' : ''} : ${r.invalid.slice(0, 5).map(x => `ligne ${x.line}, ${x.reason}`).join(' ; ')}.`));
      preview.replaceChildren(...lines);
      if (r.ready.length) { ready = r.ready; submit.textContent = `Importer ${plural(r.ready.length, 'question')}`; }
    };
    view.replaceChildren(form);
    deckInput.focus({ preventScroll: true });
  }

  pick.onchange = () => { deck = pick.value; save({ deck, length }); session = null; mode = mode === 'list' ? 'list' : 'start'; say(''); draw(); };
  // 1 à 6 choisissent, Entrée valide puis passe à la suite.
  const onKey = e => {
    if (mode !== 'play' || !session || e.target.closest('input,textarea,select') || e.ctrlKey || e.metaKey || e.altKey) return;
    const q = questions.find(x => x.id === session.ids[session.index]);
    if (!q) return;
    const n = Number(e.key);
    if (!session.shown && n >= 1 && n <= q.choix.length) { e.preventDefault(); view.querySelectorAll('.quiz-choice')[n - 1]?.click(); }
    // Entrée sur un choix valide la réponse (le choix se coche au clic, à l'espace ou avec son numéro).
    else if (e.key === 'Enter' && (!e.target.closest('button,a') || e.target.closest('.quiz-choice'))) { e.preventDefault(); view.querySelector('.cartes-rate .primary')?.click(); }
  };
  box.addEventListener('keydown', onKey);
  document.addEventListener('renzvi:quiz', load);
  load();
  return () => { gone = true; box.removeEventListener('keydown', onKey); document.removeEventListener('renzvi:quiz', load); };
}
