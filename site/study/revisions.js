// Study S3 : le widget Révisions du jour. Il montre les cartes dont l'échéance tombe aujourd'hui (jusqu'à minuit, heure
// de l'appareil), puis jusqu'à 20 nouvelles cartes par jour. Chaque réponse (À revoir, Difficile, Bien, Facile) passe
// par FSRS (cartesPlan, cartes.js) qui fixe la prochaine échéance ; la base l'enregistre avec study_answer.
// Rien n'est inventé : la fin de séance compte les réponses données, pas un niveau de maîtrise.
// Utilise el, button, plural, listOf et dayKey (dashboard.html), et les fonctions cartes* de cartes.js.
const REVISIONS = { newPerDay: 20, more: 10 };
const REVISIONS_LABELS = [[RATING.again, 'À revoir'], [RATING.hard, 'Difficile'], [RATING.good, 'Bien'], [RATING.easy, 'Facile']];

// Minuit prochain, à l'heure de l'appareil : une carte due avant fait partie des révisions du jour.
const revisionsDayEnd = (now = new Date()) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
const revisionsDue = (card, end) => !!card.fsrs && !!card.due && new Date(card.due) < end;

// La file du jour : les cartes dues (les plus en retard d'abord), puis les nouvelles dans la limite du jour.
function revisionsQueue(cards, now = new Date(), extra = 0) {
  const end = revisionsDayEnd(now), today = dayKey(now);
  const due = cards.filter(c => revisionsDue(c, end)).sort((a, b) => new Date(a.due) - new Date(b.due));
  const seenToday = cards.filter(c => c.fsrs?.first === today).length;
  const fresh = cards.filter(c => !c.fsrs).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const room = Math.max(0, REVISIONS.newPerDay + extra - seenToday);
  return { ids: [...due, ...fresh.slice(0, room)].map(c => c.id), due: due.length, fresh: Math.min(room, fresh.length), waiting: Math.max(0, fresh.length - room) };
}
// Combien de cartes tomberont demain, pour finir une séance sur un chiffre observé.
function revisionsTomorrow(cards, now = new Date()) {
  const start = revisionsDayEnd(now), end = revisionsDayEnd(start);
  return cards.filter(c => c.fsrs && c.due && new Date(c.due) >= start && new Date(c.due) < end).length;
}

function revisionsWidget({ body, meta, data, save, sb }) {
  const box = body.closest('.widget');
  let cards = [], state = 'loading', deck = typeof data?.deck === 'string' ? data.deck : '';
  let queue = [], revealed = false, busy = false, gone = false, extra = 0, day = dayKey(new Date());
  let tally = { 1: 0, 2: 0, 3: 0, 4: 0 }, hard = [];

  const bar = el('div', 'cahier-bar');
  const pick = Object.assign(el('select', 'cahier-pick'), { ariaLabel: 'Paquet à réviser' });
  bar.append(pick);
  const view = el('div', 'cartes-view');
  const note = el('p', 'zone cahier-note');
  note.setAttribute('role', 'status');
  body.append(bar, view, note);
  const say = (text, bad = false) => { note.textContent = text; note.classList.toggle('msg', bad); };
  const inDeck = () => cards.filter(c => !deck || c.deck === deck);
  const resetSession = () => { tally = { 1: 0, 2: 0, 3: 0, 4: 0 }; hard = []; };
  const rebuild = () => { queue = revisionsQueue(inDeck(), new Date(), extra).ids; revealed = false; };

  async function load() {
    state = 'loading';
    draw();
    try { cards = await cartesLoad(sb); } catch { if (!gone) { state = 'error'; draw(); } return; }
    if (gone) return;
    for (const c of cards) c.holes = cartesValidHoles(c.front, c.holes);
    if (deck && !cards.some(c => c.deck === deck)) deck = '';
    state = 'ready';
    rebuild();
    draw();
  }

  function draw() {
    const ready = state === 'ready';
    bar.hidden = !ready || !cards.length;
    const names = [...new Set(cards.map(c => c.deck))].sort((a, b) => a.localeCompare(b, 'fr'));
    const count = list => revisionsQueue(list).ids.length;
    pick.replaceChildren(Object.assign(el('option', '', `Tous les paquets (${count(cards)})`), { value: '' }),
      ...names.map(d => Object.assign(el('option', '', `${d} (${count(cards.filter(c => c.deck === d))})`), { value: d, selected: d === deck })));
    meta.textContent = '';
    if (state === 'loading') return view.replaceChildren(el('p', 'empty', 'Chargement de tes révisions…'));
    if (state === 'error') return view.replaceChildren(el('p', 'msg', "Tes révisions n'ont pas pu se charger."), button('ghost', 'Réessayer', load));
    if (!cards.length) return view.replaceChildren(el('p', 'empty cartes-start', 'Crée des cartes dans le widget Flashcards ou depuis le Cahier : celles à revoir arrivent ici chaque jour.'));
    const card = cards.find(c => c.id === queue[0]);
    if (!card) return drawDone();
    meta.textContent = `${queue.length} aujourd'hui`;
    const face = cartesFace(card, revealed);
    if (!card.fsrs) face.prepend(el('p', 'revisions-new', 'Nouvelle carte'));
    else if (new Date(card.due) < new Date(new Date().setHours(0, 0, 0, 0))) face.prepend(el('p', 'revisions-new', `En retard depuis le ${new Date(card.due).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`));
    const actions = el('div', 'cahier-actions cartes-rate');
    if (!revealed) {
      const show = button('primary', 'Voir la réponse', () => { revealed = true; draw(); view.querySelector('.cartes-rate button')?.focus(); });
      show.setAttribute('aria-keyshortcuts', 'Space');
      actions.append(show);
    } else {
      // Chaque bouton dit quand la carte reviendra : c'est le calcul FSRS, pas une promesse de réussite.
      const now = new Date();
      for (const [rating, label] of REVISIONS_LABELS) {
        const b = button(rating === RATING.good ? 'primary revisions-rate' : 'ghost revisions-rate', '', () => rate(card, rating));
        b.append(el('span', '', label), el('small', '', cartesDelay(cartesPlan(card, rating, now).due, now)));
        b.setAttribute('aria-keyshortcuts', String(rating));
        b.disabled = busy;
        actions.append(b);
      }
    }
    const items = [face, actions];
    if (revealed) { const s = cartesSourceLink(card, say); if (s) items.push(s); }
    view.replaceChildren(...items);
  }

  function drawDone() {
    const done = el('div', 'cartes-done');
    const total = tally[1] + tally[2] + tally[3] + tally[4];
    const left = revisionsQueue(inDeck(), new Date(), extra);
    done.append(el('p', 'cartes-face', total ? 'Séance terminée.' : "Rien à revoir aujourd'hui."));
    if (total) done.append(el('p', 'zone', `${plural(total, 'réponse')} : ${REVISIONS_LABELS.map(([r, l]) => `${tally[r]} ${l.toLowerCase()}`).join(', ')}.`));
    const tomorrow = revisionsTomorrow(inDeck());
    done.append(el('p', 'zone', tomorrow ? `Demain : ${plural(tomorrow, 'carte')} prévue${tomorrow > 1 ? 's' : ''}.` : 'Rien de prévu demain pour l’instant.'));
    if (left.waiting) done.append(button('ghost', `Apprendre ${Math.min(REVISIONS.more, left.waiting)} nouvelles cartes`, () => { extra += REVISIONS.more; rebuild(); draw(); }));
    if (hard.length) {
      done.append(el('p', 'cartes-sum', 'Tes difficultés de la séance'));
      const list = el('ul', 'rows cartes-list');
      list.ariaLabel = 'Cartes difficiles de la séance';
      for (const id of hard) {
        const c = cards.find(x => x.id === id);
        if (!c) continue;
        const li = el('li', 'row');
        li.append(el('span', 'grow cartes-line', c.kind === 'trou' ? cartesBrackets(c.front, c.holes) : `${c.front} — ${c.back}`));
        const link = cartesSourceLink(c, say);
        if (link) li.append(link);
        list.append(li);
      }
      done.append(list);
    }
    view.replaceChildren(done);
  }

  // On attend la base avant de passer à la suite : l'échéance enregistrée compte plus que la vitesse.
  async function rate(card, rating) {
    if (busy) return; // un double clic ne compte qu'une fois
    busy = true;
    view.querySelectorAll('.revisions-rate').forEach(b => { b.disabled = true; });
    const result = await cartesAnswer(sb, card, rating);
    busy = false;
    if (gone) return;
    if (result === 'error') { say("Ta réponse n'a pas été enregistrée. Vérifie ta connexion et réessaie.", true); draw(); return; }
    if (result === 'stale') { say('Cette carte a changé ailleurs (autre onglet ou modification) : les révisions sont rechargées.', true); load(); return; }
    say('');
    tally[rating]++;
    if (rating <= RATING.hard && !hard.includes(card.id)) hard.push(card.id);
    queue.shift();
    // Une carte ratée revient plus tard dans la séance si son échéance tombe aujourd'hui.
    if (new Date(card.due) < revisionsDayEnd()) queue.push(card.id);
    revealed = false;
    draw();
    view.querySelector('.cartes-rate button')?.focus();
  }

  pick.onchange = () => { deck = pick.value; save({ deck }); extra = 0; resetSession(); rebuild(); say(''); draw(); };
  const onKey = e => {
    if (state !== 'ready' || busy || e.target.closest('input,textarea,select') || e.ctrlKey || e.metaKey || e.altKey) return;
    const card = cards.find(c => c.id === queue[0]);
    if (!card) return;
    if (!revealed && (e.key === ' ' || e.key === 'Enter') && !e.target.closest('button,a')) { e.preventDefault(); revealed = true; draw(); view.querySelector('.cartes-rate button')?.focus(); }
    else if (revealed && /^[1-4]$/.test(e.key)) { e.preventDefault(); rate(card, Number(e.key)); }
  };
  // Une réponse donnée dans Flashcards déplace aussi l'échéance ici. Après minuit, la file du nouveau jour se reconstruit.
  const onAnswer = e => {
    const c = cards.find(x => x.id === e.detail.id && x.version === e.detail.version);
    if (!c) return;
    Object.assign(c, e.detail.fields);
    if (c.id !== queue[0] && !revisionsDue(c, revisionsDayEnd())) queue = queue.filter(id => id !== c.id);
    if (!busy) draw();
  };
  const onWake = () => {
    if (document.hidden || state !== 'ready' || dayKey(new Date()) === day) return;
    day = dayKey(new Date());
    extra = 0;
    resetSession();
    rebuild();
    draw();
  };
  const clock = setInterval(onWake, 60000);
  box.addEventListener('keydown', onKey);
  document.addEventListener('renzvi:cartes', load);
  document.addEventListener('renzvi:reponse', onAnswer);
  document.addEventListener('visibilitychange', onWake);
  load();
  return () => {
    gone = true;
    clearInterval(clock);
    box.removeEventListener('keydown', onKey);
    document.removeEventListener('renzvi:cartes', load);
    document.removeEventListener('renzvi:reponse', onAnswer);
    document.removeEventListener('visibilitychange', onWake);
  };
}
