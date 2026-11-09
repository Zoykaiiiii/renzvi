// Study S2 : les flashcards. Deux types : question/réponse, et texte à trous (les mots à masquer sont écrits entre
// crochets, puis gardés comme positions dans la phrase). Une carte créée depuis le Cahier garde la référence du passage
// (cours, page, position, longueur) pour « Revoir dans le cours », sans recopier le cours. Les cartes sont dans la table
// study_cards, chaque réponse dans study_reviews (pour la répétition espacée de S3). Le texte d'une carte est toujours
// affiché avec textContent : le HTML d'un CSV importé reste du texte.
// S3 : chaque réponse passe par la répétition espacée FSRS (ts-fsrs, vendor/ts-fsrs-5.4.2, global FSRS) et fixe la
// prochaine échéance de la carte. Le calcul est local, sans IA ; study_answer l'enregistre avec la réponse.
// Utilise el, button, plural, listOf et dayKey, définis par dashboard.html ; cahierFold vient de cahier.js.
const CARTES = { front: 1000, back: 2000, deck: 60, cards: 3000, batch: 500, holes: 20, csvBytes: 1048576, page: 1000 };
const CARTES_FIELDS = 'id,deck,kind,front,back,holes,course_id,src_page,src_offset,src_length,version,last_rating,last_reviewed_at,created_at,fsrs,due';
const RATING = { again: 1, hard: 2, good: 3, easy: 4 };
let cartesScheduler = null;

// L'état FSRS de la carte (ou une carte neuve), puis le résultat de chaque réponse possible.
function cartesFsrsCard(card, now) {
  const f = card.fsrs;
  if (!f) return FSRS.createEmptyCard(now);
  return { ...f, due: new Date(f.due), last_review: f.last_review ? new Date(f.last_review) : undefined };
}
function cartesPlan(card, rating, now = new Date()) {
  cartesScheduler ??= FSRS.fsrs(FSRS.generatorParameters());
  const next = cartesScheduler.next(cartesFsrsCard(card, now), now, rating).card;
  const fsrs = {
    due: next.due.toISOString(), stability: next.stability, difficulty: next.difficulty, elapsed_days: next.elapsed_days,
    scheduled_days: next.scheduled_days, learning_steps: next.learning_steps, reps: next.reps, lapses: next.lapses, state: next.state,
    last_review: (next.last_review ?? now).toISOString(),
    // Le jour où la carte a été vue pour la première fois : sert à limiter les nouvelles cartes par jour.
    first: card.fsrs?.first ?? dayKey(now),
  };
  return { fsrs, due: fsrs.due };
}
// Le délai avant la prochaine révision, en mots courts : « 10 min », « 3 j ».
function cartesDelay(fromIso, now = new Date()) {
  const m = Math.max(1, Math.round((new Date(fromIso) - now) / 60000));
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.round(m / 60)} h`;
  const d = Math.round(m / 1440);
  if (d < 31) return `${d} j`;
  if (d < 365) return `${Math.round(d / 30)} mois`;
  return `${Math.round(d / 365)} an${d >= 730 ? 's' : ''}`;
}
// Enregistre une réponse : 'ok', 'stale' (la carte a changé ou un autre onglet a déjà répondu) ou 'error'.
async function cartesAnswer(sb, card, rating, now = new Date()) {
  const plan = cartesPlan(card, rating, now);
  const { data, error } = await sb.rpc('study_answer', { p_card: card.id, p_version: card.version, p_prev: card.last_reviewed_at ?? null, p_rating: rating, p_fsrs: plan.fsrs, p_due: plan.due });
  if (error) return 'error';
  if (!data) return 'stale';
  const fields = { fsrs: plan.fsrs, due: plan.due, last_rating: rating, last_reviewed_at: data };
  Object.assign(card, fields);
  document.dispatchEvent(new CustomEvent('renzvi:reponse', { detail: { id: card.id, version: card.version, fields } }));
  return 'ok';
}
// Lien « Revoir dans le cours » d'une carte créée depuis le Cahier.
function cartesSourceLink(card, say) {
  if (!card.course_id) return null;
  return button('link', 'Revoir dans le cours', () => {
    const detail = { course: card.course_id, page: card.src_page ?? 0, offset: card.src_offset ?? 0, length: card.src_length ?? 0, found: false };
    document.dispatchEvent(new CustomEvent('renzvi:revoir', { detail }));
    if (detail.found === 'absent') say("Le cours de cette carte n'existe plus.", true);
    else if (!detail.found) say('Ajoute le widget Cahier à ton écran pour revoir ce passage.', true);
  });
}
// La face d'une carte : question ou phrase à trous, puis la réponse une fois révélée.
function cartesFace(card, revealed) {
  const face = el('div', 'cartes-card');
  face.tabIndex = -1; // un clic sur la carte donne le focus au widget : les raccourcis clavier marchent ensuite
  face.append(el('p', 'cartes-deck', card.deck));
  face.append(card.kind === 'trou' ? cartesSentence(card, revealed) : el('p', 'cartes-face', card.front));
  if (revealed && card.kind === 'qa') face.append(el('p', 'cartes-back', card.back));
  return face;
}
const cartesError = text => Object.assign(new Error(text), { user: true });
const cartesKey = (front, back) => cahierFold(`${front}\u0000${back}`.replace(/\s+/g, ' ').trim());

// « La [mitochondrie] produit » donne la phrase sans crochets et les positions des mots masqués.
function cartesHoles(source) {
  let front = '', open = -1;
  const holes = [];
  for (const ch of source) {
    if (ch === '[') {
      if (open >= 0) throw cartesError('Un crochet est ouvert deux fois. Ferme le premier avec « ] ».');
      open = front.length;
    } else if (ch === ']') {
      if (open < 0) throw cartesError('Un crochet « ] » est fermé sans avoir été ouvert.');
      if (!front.slice(open).trim()) throw cartesError('Des crochets sont vides : mets dedans les mots à masquer.');
      holes.push([open, front.length]);
      open = -1;
    } else front += ch;
  }
  if (open >= 0) throw cartesError('Un crochet « [ » n’est pas fermé.');
  if (!holes.length) throw cartesError('Mets entre crochets au moins un mot à masquer.');
  if (holes.length > CARTES.holes) throw cartesError(`${CARTES.holes} mots masqués au plus par carte.`);
  return { front, holes };
}
const cartesValidHoles = (front, holes) => listOf(holes).filter(h => Array.isArray(h) && Number.isInteger(h[0]) && Number.isInteger(h[1]) && h[0] >= 0 && h[0] < h[1] && h[1] <= front.length).sort((a, b) => a[0] - b[0]).filter((h, i, all) => i === 0 || h[0] >= all[i - 1][1]);
function cartesBrackets(front, holes) {
  let out = '', at = 0;
  for (const [a, b] of cartesValidHoles(front, holes)) { out += `${front.slice(at, a)}[${front.slice(a, b)}]`; at = b; }
  return out + front.slice(at);
}

// La phrase d'une carte à trous, mots cachés ou révélés.
function cartesSentence(card, revealed) {
  const p = el('p', 'cartes-face');
  let at = 0;
  for (const [a, b] of cartesValidHoles(card.front, card.holes)) {
    p.append(card.front.slice(at, a));
    const hole = el('span', revealed ? 'cartes-hole open' : 'cartes-hole', revealed ? card.front.slice(a, b) : '·····');
    if (!revealed) hole.ariaLabel = 'mot masqué';
    p.append(hole);
    at = b;
  }
  p.append(card.front.slice(at));
  return p;
}

// CSV avec « ; », « , » ou tabulation (le premier trouvé sur la première ligne), guillemets doubles à la manière d'Excel.
function cartesCsv(text) {
  text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const head = text.slice(0, text.indexOf('\n') >>> 0).replace(/"[^"]*"/g, '');
  const counts = [';', '\t', ','].map(d => [d, head.split(d).length]);
  const sep = counts.reduce((best, c) => c[1] > best[1] ? c : best)[0];
  const rows = [];
  let row = [], field = '', quoted = false, line = 1, rowLine = 1;
  for (let i = 0; i <= text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else if (ch === undefined) { row.push(field); rows.push({ line: rowLine, cells: row }); }
      else { if (ch === '\n') line++; field += ch; }
    } else if (ch === '"' && !field) quoted = true;
    else if (ch === sep) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === undefined) {
      row.push(field);
      if (row.some(c => c.trim())) rows.push({ line: rowLine, cells: row });
      row = []; field = ''; line++; rowLine = line;
    } else field += ch;
  }
  return rows;
}

// Lignes prêtes à importer, lignes refusées (avec la raison) et doublons écartés.
function cartesFromCsv(text, existing = []) {
  const rows = cartesCsv(text);
  if (rows.length && /^(question|recto|front|questions)$/i.test(cahierFold(rows[0].cells[0].trim()))) rows.shift();
  const seen = new Set(existing.map(c => cartesKey(c.front, c.back)));
  const cards = [], invalid = [];
  let duplicates = 0;
  for (const { line, cells } of rows) {
    const front = (cells[0] ?? '').trim(), back = (cells[1] ?? '').trim();
    const reason = !front ? 'question vide' : !back ? 'réponse vide' : front.length > CARTES.front ? `question de plus de ${CARTES.front} caractères` : back.length > CARTES.back ? `réponse de plus de ${CARTES.back} caractères` : null;
    if (reason) { invalid.push({ line, reason }); continue; }
    const key = cartesKey(front, back);
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    cards.push({ front, back, line });
  }
  return { cards, invalid, duplicates };
}

// Toutes les cartes de la personne, par tranches : la base n'en renvoie que 1000 par demande.
async function cartesLoad(sb) {
  const all = [];
  for (let from = 0; from < CARTES.cards; from += CARTES.page) {
    const { data, error } = await sb.from('study_cards').select(CARTES_FIELDS).order('created_at').order('id').range(from, from + CARTES.page - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < CARTES.page) break;
  }
  return all;
}
const cartesChanged = () => document.dispatchEvent(new CustomEvent('renzvi:cartes'));

// Formulaire de création ou de correction d'une carte, utilisé par le widget Flashcards et par le Cahier.
// card : les champs de départ ({ id } pour corriger). close(saved) est appelé à la fin.
function cartesForm({ sb, card = {}, decks = [], close }) {
  const form = el('form', 'cartes-form');
  form.noValidate = true;
  let kind = card.kind === 'trou' ? 'trou' : 'qa';
  const field = (label, input) => { const f = el('label', 'cahier-field', label); f.append(input); return f; };
  const kinds = el('div', 'cartes-kinds');
  kinds.setAttribute('role', 'group');
  kinds.ariaLabel = 'Type de carte';
  const qaBtn = button('ghost', 'Question / réponse', () => setKind('qa'));
  const trouBtn = button('ghost', 'Texte à trous', () => setKind('trou'));
  kinds.append(qaBtn, trouBtn);
  const list = Object.assign(el('datalist'), { id: `cartes-decks-${crypto.randomUUID().slice(0, 8)}` });
  list.append(...decks.map(d => Object.assign(el('option'), { value: d })));
  const deck = Object.assign(el('input'), { type: 'text', maxLength: CARTES.deck, autocomplete: 'off', value: card.deck ?? decks[0] ?? '', placeholder: 'Biologie, Chapitre 2…' });
  deck.setAttribute('list', list.id);
  const area = (label, value, max) => Object.assign(el('textarea', 'cahier-paste cartes-area'), { ariaLabel: label, value: value ?? '', maxLength: max + 2 * CARTES.holes });
  const front = area('Question', kind === 'qa' ? card.front : '', CARTES.front);
  const back = area('Réponse', card.back, CARTES.back);
  const cloze = area('Texte à trous', kind === 'trou' ? cartesBrackets(card.front ?? '', card.holes) : '', CARTES.front);
  const frontField = field('Question', front), backField = field('Réponse', back), clozeField = field('Texte à trous', cloze);
  const clozeHint = el('p', 'zone', 'Mets entre crochets les mots à masquer : La [mitochondrie] produit l’énergie de la cellule.');
  const status = el('p', 'zone');
  status.setAttribute('role', 'status');
  const submit = Object.assign(el('button', 'primary', card.id ? 'Enregistrer' : 'Créer la carte'), { type: 'submit' });
  const cancel = button('ghost', 'Annuler', () => close(false));
  const actions = el('div', 'cahier-actions');
  actions.append(submit, cancel);
  form.append(kinds, field('Paquet', deck), list, frontField, backField, clozeField, clozeHint, status, actions);

  function setKind(k) {
    // Le texte déjà écrit passe d'un type à l'autre plutôt que d'être perdu.
    if (k === 'trou' && kind === 'qa' && !cloze.value.trim()) cloze.value = front.value.trim() || back.value.trim();
    if (k === 'qa' && kind === 'trou' && !front.value.trim() && !back.value.trim()) back.value = cloze.value.replace(/[[\]]/g, '');
    kind = k;
    qaBtn.setAttribute('aria-pressed', k === 'qa');
    trouBtn.setAttribute('aria-pressed', k === 'trou');
    frontField.hidden = backField.hidden = k !== 'qa';
    clozeField.hidden = clozeHint.hidden = k !== 'trou';
  }
  setKind(kind);

  form.onsubmit = async e => {
    e.preventDefault();
    const fail = (text, focus) => { status.textContent = text; status.classList.add('msg'); focus?.focus(); };
    status.classList.remove('msg');
    const row = { deck: deck.value.replace(/\s+/g, ' ').trim().slice(0, CARTES.deck), kind };
    if (!row.deck) return fail('Indique le paquet de cette carte.', deck);
    if (kind === 'qa') {
      Object.assign(row, { front: front.value.trim(), back: back.value.trim(), holes: [] });
      if (!row.front) return fail('Écris la question.', front);
      if (!row.back) return fail('Écris la réponse.', back);
      if (row.front.length > CARTES.front) return fail(`La question dépasse ${CARTES.front} caractères.`, front);
      if (row.back.length > CARTES.back) return fail(`La réponse dépasse ${CARTES.back} caractères.`, back);
    } else {
      try { Object.assign(row, cartesHoles(cloze.value.trim()), { back: '' }); } catch (err) { return fail(err.message, cloze); }
      if (row.front.length > CARTES.front) return fail(`Le texte dépasse ${CARTES.front} caractères.`, cloze);
    }
    if (!card.id) for (const k of ['course_id', 'src_page', 'src_offset', 'src_length']) if (card[k] != null) row[k] = card[k];
    submit.disabled = true;
    const { error } = card.id
      ? await sb.from('study_cards').update(row).eq('id', card.id)
      : await sb.from('study_cards').insert(row);
    submit.disabled = false;
    if (error) return fail(card.id ? "La carte n'a pas été enregistrée. Vérifie ta connexion et réessaie." : "La carte n'a pas été créée. Vérifie ta connexion, ou ta limite de 3000 cartes.");
    cartesChanged();
    close(true);
  };
  return { form, focus: () => (kind === 'qa' ? (front.value ? back.value ? front : back : front) : cloze).focus({ preventScroll: false }) };
}

function cartesWidget({ body, meta, data, save, sb }) {
  const box = body.closest('.widget');
  let cards = [], state = 'loading', mode = 'review', deck = typeof data?.deck === 'string' ? data.deck : '';
  let queue = [], index = 0, revealed = false, tally = { good: 0, again: 0 }, armed = null, gone = false, editing = null;

  const bar = el('div', 'cahier-bar');
  const pick = Object.assign(el('select', 'cahier-pick'), { ariaLabel: 'Paquet à réviser' });
  const newBtn = button('ghost', 'Nouvelle carte', () => { editing = null; setMode('new'); });
  const importBtn = button('ghost', 'Importer', () => setMode('import'));
  const listBtn = button('ghost', 'Gérer', () => setMode(mode === 'list' ? 'review' : 'list'));
  bar.append(pick, newBtn, importBtn, listBtn);
  const view = el('div', 'cartes-view');
  const note = el('p', 'zone cahier-note');
  note.setAttribute('role', 'status');
  body.append(bar, view, note);
  const say = (text, bad = false) => { note.textContent = text; note.classList.toggle('msg', bad); };

  const decks = () => [...new Set(cards.map(c => c.deck))].sort((a, b) => a.localeCompare(b, 'fr'));
  const inDeck = () => cards.filter(c => !deck || c.deck === deck);
  // shortcut: ordre simple en attendant la répétition espacée de S3 : à revoir, puis jamais vues, puis les autres.
  const rank = c => c.last_rating === RATING.again ? 0 : c.last_rating == null ? 1 : 2;
  function restart() {
    queue = inDeck().map(c => c.id).sort((a, b) => {
      const x = cards.find(c => c.id === a), y = cards.find(c => c.id === b);
      return rank(x) - rank(y) || (x.last_reviewed_at ?? '').localeCompare(y.last_reviewed_at ?? '');
    });
    index = 0;
    revealed = false;
    tally = { good: 0, again: 0 };
  }
  function setMode(m) { mode = m; say(''); draw(); }

  async function load() {
    state = 'loading';
    draw();
    try { cards = await cartesLoad(sb); } catch { if (!gone) { state = 'error'; draw(); } return; }
    if (gone) return;
    for (const c of cards) c.holes = cartesValidHoles(c.front, c.holes);
    state = 'ready';
    if (deck && !cards.some(c => c.deck === deck)) deck = '';
    // Une carte modifiée ou ajoutée garde la séance en cours : la nouvelle passe en fin de séance.
    const keep = queue.filter(id => cards.some(c => c.id === id && (!deck || c.deck === deck)));
    if (!keep.length) restart();
    else {
      const before = queue.slice(0, index).filter(id => keep.includes(id)).length;
      queue = [...keep, ...inDeck().map(c => c.id).filter(id => !keep.includes(id))];
      index = before;
    }
    draw();
  }

  function draw() {
    const ready = state === 'ready';
    bar.hidden = !ready;
    listBtn.hidden = pick.hidden = !cards.length;
    listBtn.textContent = mode === 'list' ? 'Réviser' : 'Gérer';
    listBtn.setAttribute('aria-pressed', mode === 'list');
    const names = decks();
    pick.replaceChildren(Object.assign(el('option', '', `Tous les paquets (${cards.length})`), { value: '' }),
      ...names.map(d => Object.assign(el('option', '', `${d} (${cards.filter(c => c.deck === d).length})`), { value: d, selected: d === deck })));
    meta.textContent = '';
    if (state === 'loading') return view.replaceChildren(el('p', 'empty', 'Chargement de tes cartes…'));
    if (state === 'error') return view.replaceChildren(el('p', 'msg', "Tes cartes n'ont pas pu se charger."), button('ghost', 'Réessayer', load));
    if (mode === 'new' || mode === 'edit') return drawForm();
    if (mode === 'import') return drawImport();
    if (!cards.length) return view.replaceChildren(el('p', 'empty cartes-start', 'Crée ta première carte, importe un CSV, ou sélectionne un passage dans le Cahier pour en faire une carte.'));
    if (mode === 'list') return drawList();
    drawReview();
  }

  function drawReview() {
    const id = queue[index], card = cards.find(c => c.id === id);
    if (!card) {
      const done = el('div', 'cartes-done');
      const total = tally.good + tally.again;
      done.append(el('p', 'cartes-face', total ? 'Paquet terminé.' : 'Ce paquet est vide.'));
      if (total) done.append(el('p', 'zone', `${plural(tally.good, 'carte')} sue${tally.good > 1 ? 's' : ''}, ${tally.again} à revoir.`));
      done.append(button('primary', 'Recommencer', () => { restart(); draw(); }));
      return view.replaceChildren(done);
    }
    meta.textContent = `${index + 1} / ${queue.length}`;
    const face = cartesFace(card, revealed);
    const actions = el('div', 'cahier-actions cartes-rate');
    if (!revealed) {
      const show = button('primary', 'Voir la réponse', () => { revealed = true; draw(); view.querySelector('.cartes-rate button')?.focus(); });
      show.setAttribute('aria-keyshortcuts', 'Space');
      actions.append(show);
    } else {
      const again = button('ghost', 'À revoir', () => rate(card, RATING.again));
      const good = button('primary', 'Je savais', () => rate(card, RATING.good));
      again.setAttribute('aria-keyshortcuts', '1');
      good.setAttribute('aria-keyshortcuts', '2');
      actions.append(again, good);
    }
    const items = [face, actions];
    if (revealed) { const s = cartesSourceLink(card, say); if (s) items.push(s); }
    view.replaceChildren(...items);
  }

  // La réponse est enregistrée sans attendre : la séance continue même si le réseau est lent. Elle compte aussi pour
  // la répétition espacée (FSRS accepte une révision en avance) ; le widget Révisions du jour propose les 4 réponses.
  async function rate(card, rating) {
    tally[rating === RATING.good ? 'good' : 'again']++;
    index++;
    revealed = false;
    draw();
    view.querySelector('.cartes-rate button')?.focus();
    const result = await cartesAnswer(sb, card, rating);
    if (gone) return;
    if (result === 'error') say("Une réponse n'a pas été enregistrée. Vérifie ta connexion.", true);
    if (result === 'stale') { say('Cette carte avait changé ailleurs (autre onglet ou modification) : elle est rechargée.', true); load(); }
  }

  function drawList() {
    const list = el('ul', 'rows cartes-list');
    list.ariaLabel = 'Cartes du paquet';
    const shown = inDeck();
    meta.textContent = plural(shown.length, 'carte');
    for (const card of shown) {
      const li = el('li', 'row');
      const text = el('span', 'grow cartes-line', card.kind === 'trou' ? cartesBrackets(card.front, card.holes) : `${card.front} — ${card.back}`);
      const edit = button('link', 'Modifier', () => { editing = card; setMode('edit'); });
      edit.ariaLabel = `Modifier la carte ${card.front.slice(0, 40)}`;
      const remove = button('x', '×', () => removeCard(card, remove));
      remove.ariaLabel = `Supprimer la carte ${card.front.slice(0, 40)}`;
      li.append(text, edit, remove);
      list.append(li);
    }
    view.replaceChildren(list);
  }

  // Deux appuis pour supprimer : le premier demande confirmation pendant quelques secondes.
  async function removeCard(card, btn) {
    if (armed !== card.id) {
      armed = card.id;
      btn.textContent = 'Supprimer ?';
      btn.classList.add('armed');
      setTimeout(() => { if (armed === card.id) { armed = null; btn.textContent = '×'; btn.classList.remove('armed'); } }, 4000);
      return;
    }
    armed = null;
    btn.disabled = true;
    const { error } = await sb.from('study_cards').delete().eq('id', card.id);
    if (gone) return;
    if (error) { btn.disabled = false; say("La suppression n'a pas abouti. Vérifie ta connexion.", true); return; }
    cards = cards.filter(c => c !== card);
    queue = queue.filter(id => id !== card.id);
    say('Carte supprimée.');
    if (!cards.length) mode = 'review';
    draw();
  }

  function drawForm() {
    const { form, focus } = cartesForm({
      sb, card: mode === 'edit' && editing ? editing : { deck: deck || undefined }, decks: decks(),
      close: saved => { const was = mode; mode = mode === 'edit' ? 'list' : 'review'; if (saved) say(was === 'edit' ? 'Carte enregistrée.' : 'Carte créée.'); draw(); },
    });
    if (mode === 'edit') form.prepend(el('p', 'zone', 'Si tu changes le contenu, tes anciennes réponses ne comptent plus pour cette carte.'));
    view.replaceChildren(form);
    focus();
  }

  function drawImport() {
    const form = el('form', 'cahier-import');
    form.noValidate = true;
    const field = (label, input) => { const f = el('label', 'cahier-field', label); f.append(input); return f; };
    const list = Object.assign(el('datalist'), { id: 'cartes-import-decks' });
    list.append(...decks().map(d => Object.assign(el('option'), { value: d })));
    const deckInput = Object.assign(el('input'), { type: 'text', maxLength: CARTES.deck, autocomplete: 'off', value: deck, placeholder: 'Vocabulaire, Dates…' });
    deckInput.setAttribute('list', list.id);
    const file = Object.assign(el('input'), { type: 'file', accept: '.csv,.txt,.tsv,text/csv,text/plain', hidden: true });
    const hint = el('p', 'zone', 'Un fichier CSV en UTF-8 avec deux colonnes : la question, puis la réponse. Séparateur « ; », « , » ou tabulation. 500 cartes au plus par import.');
    const choose = button('ghost', 'Choisir un fichier', () => file.click());
    const chosen = el('p', 'cahier-chosen');
    const paste = Object.assign(el('textarea', 'cahier-paste'), { placeholder: 'Ou colle ici tes lignes : question;réponse', ariaLabel: 'Lignes à importer' });
    const preview = el('div', 'cartes-preview');
    const status = el('p', 'zone');
    status.setAttribute('role', 'status');
    const submit = Object.assign(el('button', 'primary', 'Vérifier'), { type: 'submit' });
    const cancel = button('ghost', 'Annuler', () => setMode('review'));
    const actions = el('div', 'cahier-actions');
    actions.append(submit, cancel);
    const fileRow = el('div', 'cahier-filerow');
    fileRow.append(choose, chosen);
    form.append(field('Paquet', deckInput), list, fileRow, hint, file, paste, preview, status, actions);
    let ready = null;
    const reset = () => { ready = null; preview.replaceChildren(); submit.textContent = 'Vérifier'; };
    file.onchange = () => { chosen.textContent = file.files[0]?.name ?? ''; reset(); };
    paste.oninput = deckInput.oninput = reset;
    const fail = (text, focus) => { status.textContent = text; status.classList.add('msg'); focus?.focus(); };

    form.onsubmit = async e => {
      e.preventDefault();
      status.classList.remove('msg');
      status.textContent = '';
      const name = deckInput.value.replace(/\s+/g, ' ').trim().slice(0, CARTES.deck);
      if (!name) return fail('Indique le paquet où ranger ces cartes.', deckInput);
      if (ready) return send(name);
      const f = file.files[0];
      if (!f && !paste.value.trim()) return fail('Choisis un fichier CSV ou colle tes lignes.', choose);
      if (f && f.size > CARTES.csvBytes) return fail('Ce fichier est trop lourd : 1 Mo au plus.', choose);
      let text = f ? await f.text() : paste.value;
      if (f && text.includes('�')) text = new TextDecoder('windows-1252').decode(await f.arrayBuffer());
      const result = cartesFromCsv(text, cards.filter(c => c.deck === name && c.kind === 'qa'));
      const room = CARTES.cards - cards.length;
      const lines = [];
      if (result.cards.length > CARTES.batch) return fail(`Ce fichier contient ${result.cards.length} cartes : importe-les en plusieurs fois, ${CARTES.batch} au plus.`);
      if (result.cards.length > room) return fail(`Tu peux encore créer ${room} cartes, ce fichier en contient ${result.cards.length}.`);
      lines.push(el('p', 'cartes-sum', result.cards.length ? `${plural(result.cards.length, 'carte')} prête${result.cards.length > 1 ? 's' : ''} à importer dans « ${name} ».` : 'Aucune carte à importer.'));
      if (result.duplicates) lines.push(el('p', 'zone', `${plural(result.duplicates, 'doublon')} écarté${result.duplicates > 1 ? 's' : ''} (déjà dans ce paquet ou répété dans le fichier).`));
      if (result.invalid.length) {
        lines.push(el('p', 'zone msg', `${plural(result.invalid.length, 'ligne')} ignorée${result.invalid.length > 1 ? 's' : ''} : ` + result.invalid.slice(0, 5).map(r => `ligne ${r.line}, ${r.reason}`).join(' ; ') + (result.invalid.length > 5 ? '…' : '.')));
      }
      if (result.cards.length) {
        const sample = el('ul', 'rows cartes-sample');
        sample.ariaLabel = 'Aperçu des premières cartes';
        for (const c of result.cards.slice(0, 5)) sample.append(el('li', 'row', `${c.front} — ${c.back}`));
        lines.push(sample);
        ready = result.cards;
        submit.textContent = `Importer ${plural(result.cards.length, 'carte')}`;
      }
      preview.replaceChildren(...lines);
    };

    async function send(name) {
      submit.disabled = true;
      status.textContent = 'Import en cours…';
      const { error } = await sb.from('study_cards').insert(ready.map(c => ({ deck: name, kind: 'qa', front: c.front, back: c.back, holes: [] })));
      if (gone) return;
      submit.disabled = false;
      if (error) return fail("L'import n'a pas abouti, aucune carte n'a été ajoutée. Vérifie ta connexion et réessaie.");
      const n = ready.length;
      deck = name;
      save({ deck });
      mode = 'review';
      queue = [];
      say(`${plural(n, 'carte')} importée${n > 1 ? 's' : ''}.`);
      load();
    }
    view.replaceChildren(form);
    deckInput.focus({ preventScroll: true });
  }

  pick.onchange = () => { deck = pick.value; save({ deck }); restart(); if (mode !== 'list') mode = 'review'; say(''); draw(); };
  // Espace montre la réponse, 1 et 2 répondent, quand le widget a le focus et qu'on n'écrit pas.
  const onKey = e => {
    if (mode !== 'review' || state !== 'ready' || e.target.closest('input,textarea,select') || e.ctrlKey || e.metaKey || e.altKey) return;
    const card = cards.find(c => c.id === queue[index]);
    if (!card) return;
    if (!revealed && (e.key === ' ' || e.key === 'Enter') && !e.target.closest('button,a')) { e.preventDefault(); revealed = true; draw(); view.querySelector('.cartes-rate button')?.focus(); }
    else if (revealed && (e.key === '1' || e.key === '2')) { e.preventDefault(); rate(card, e.key === '1' ? RATING.again : RATING.good); }
  };
  // Une réponse donnée dans un autre widget met à jour la carte d'ici, sans tout recharger.
  const onAnswer = e => { const c = cards.find(x => x.id === e.detail.id && x.version === e.detail.version); if (c) Object.assign(c, e.detail.fields); };
  box.addEventListener('keydown', onKey);
  document.addEventListener('renzvi:cartes', load);
  document.addEventListener('renzvi:reponse', onAnswer);
  load();
  return () => {
    gone = true;
    box.removeEventListener('keydown', onKey);
    document.removeEventListener('renzvi:cartes', load);
    document.removeEventListener('renzvi:reponse', onAnswer);
  };
}
