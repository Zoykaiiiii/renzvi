// Chill C5 : « J'ai cinq minutes ». Un parcours court qui réutilise les moteurs existants, sans les copier :
// respiration (chillRespiration), pause guidée (chillPause, contenu BREAKS), dessin libre (atelierSurface),
// contemplation (fenetreScene). On voit ce qui va se passer et la durée avant de commencer ; on peut tout arrêter ;
// la fin est calme et on peut continuer. Pas de score, pas de diagnostic.
// Utilise el, button, clockLabel, BREAKS (dashboard.html) et chill.js ; charge atelier.js / fenetre.js à la demande.

const CINQ = [
  { id: 'respiration', name: 'Respirer', minutes: 3, text: 'Un cercle grandit et rétrécit : inspire 4 secondes, expire 6 secondes, pendant 3 minutes. Ce n’est pas un soin médical.' },
  { id: 'pause', name: 'Une pause guidée', text: 'Une courte pause pour le corps, avec un décompte.' },
  { id: 'dessin', name: 'Dessiner librement', minutes: 5, text: 'Une feuille blanche pendant 5 minutes. Rien n’est enregistré : tu pourras exporter ton dessin à la fin.' },
  { id: 'contempler', name: 'Contempler', minutes: 5, text: 'Une scène calme pendant 5 minutes, sans son. Tu peux lancer l’ambiance sonore toi-même si tu veux.' },
];
// Suggestion au hasard, jamais deux fois de suite la même activité.
function cinqPick(ids, last, rand = Math.random) {
  const pool = ids.length > 1 ? ids.filter(id => id !== last) : ids;
  return pool[Math.floor(rand() * pool.length)];
}

function cinqWidget({ body, meta }) {
  const LAST = 'renzvi:cinq-dernier';
  const root = el('div', 'cinq');
  const live = el('p', 'sr');
  live.setAttribute('aria-live', 'polite');
  let stopRun = () => {}, ticker = null, gone = false;
  const lastOf = () => { try { return localStorage.getItem(LAST); } catch { return null; } };
  const remember = id => { try { localStorage.setItem(LAST, id); } catch {} };
  const pauseFor = () => BREAKS.filter(b => b.seconds <= 180)[Math.floor(Math.random() * BREAKS.filter(b => b.seconds <= 180).length)];
  body.append(root, live);

  // Le focus suit le parcours, mais pas à l'ouverture de la page : un widget ne doit pas le prendre tout seul.
  let started = false;
  function show(...nodes) { root.replaceChildren(...nodes); if (started) root.querySelector('button')?.focus({ preventScroll: true }); started = true; }
  function choose(message = '') {
    stopRun();
    meta.textContent = '';
    const list = el('div', 'cinq-list');
    for (const a of CINQ) list.append(button('ghost', a.name, () => plan(a)));
    show(el('p', 'zone', message || 'Choisis une activité, ou laisse Renzvi proposer.'),
      button('primary', 'Propose-moi quelque chose', () => { const id = cinqPick(CINQ.map(x => x.id), lastOf()); plan(CINQ.find(a => a.id === id)); }), list);
  }
  function plan(a) {
    const extra = a.id === 'pause' ? pauseFor() : null;
    const minutes = extra ? extra.seconds / 60 : a.minutes;
    const dur = minutes < 1 ? `${Math.round(minutes * 60)} secondes` : `${minutes} minutes`;
    const head = el('p', 'book-title', extra ? `${a.name} : ${extra.name.toLowerCase()}` : a.name);
    const go = el('div', 'atelier-row');
    go.append(button('primary', 'Commencer', () => run(a, extra)), button('ghost', 'Autre chose', () => choose()));
    show(head, el('p', 'zone', extra ? `${extra.text} Durée : ${dur}.` : `${a.text} Durée : ${dur}.`), go);
  }
  async function run(a, extra) {
    remember(a.id);
    const stage = el('div', 'cinq-stage');
    const stop = button('ghost', 'Arrêter', () => choose('Arrêté. Reviens quand tu veux.'));
    const clock = el('p', 'zone');
    clock.setAttribute('role', 'timer');
    show(stage, clock, stop);
    live.textContent = `${a.name} commence.`;
    if (a.id === 'respiration') {
      const s = chillRespiration({ meta: clock, minutes: a.minutes, choices: false, onEnd: done => done && end(a, extra) });
      s.nodes.at(-1).hidden = true; // le bouton propre à la séance : « Arrêter » du parcours suffit
      stage.append(...s.nodes);
      s.start();
      stopRun = () => { s.stop(); s.cleanup(); stopRun = () => {}; };
      return;
    }
    if (a.id === 'pause') {
      const s = chillPause({ meta: null, list: false, onEnd: done => done && end(a, extra) });
      s.nodes[1].querySelector('button').hidden = true;
      stage.append(...s.nodes);
      s.start(extra);
      stopRun = () => { s.stop(); s.cleanup(); stopRun = () => {}; };
      return;
    }
    // Dessin et contemplation : les modules sont chargés seulement maintenant.
    stage.append(el('p', 'empty', 'Chargement…'));
    try { await chillScript(a.id === 'dessin' ? 'chill/atelier.js' : 'chill/fenetre.js'); }
    catch { if (!gone) choose("Cette activité n'a pas pu se charger. Vérifie ta connexion."); return; }
    if (gone || !root.contains(stage)) return;
    let surface = null, scene = null;
    if (a.id === 'dessin') {
      surface = atelierSurface({ onChange: () => ui.sync() });
      const ui = atelierTools(surface);
      stage.replaceChildren(ui.tools, surface.paper);
      stage.addEventListener('keydown', ui.keys);
      ui.sync();
    } else {
      const host = el('div', 'fenetre-stage');
      stage.replaceChildren(host);
      const pick = ['pluie', 'foret', 'feu'][Math.floor(Math.random() * 3)];
      scene = fenetreScene(host, { scene: pick, intensity: 1 });
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) scene.play();
    }
    let endAt = Date.now() + a.minutes * 60000;
    const tick = () => {
      const left = endAt - Date.now();
      clock.textContent = `Encore ${clockLabel(Math.max(0, left))}`;
      if (left <= 0) { clearInterval(ticker); ticker = null; end(a, extra, { surface, scene, more: () => { endAt = Date.now() + 5 * 60000; ticker = setInterval(tick, 1000); tick(); } }); }
    };
    ticker = setInterval(tick, 1000);
    tick();
    stopRun = () => { clearInterval(ticker); ticker = null; scene?.destroy(); stopRun = () => {}; };
  }
  // Une fin calme : rien ne clignote, on peut continuer ou s'arrêter là.
  function end(a, extra, keep) {
    live.textContent = 'C’est fini.';
    const actions = el('div', 'atelier-row');
    const note = el('p', 'zone');
    note.setAttribute('aria-live', 'polite');
    if (keep?.more) {
      actions.append(button('primary', 'Continuer 5 minutes', () => { msg.remove(); actions.remove(); note.remove(); keep.more(); }));
      if (keep.surface) actions.append(...atelierShare(note, () => keep.surface.paper, 'renzvi-cinq-minutes', 'Cinq minutes'));
    } else actions.append(button('primary', 'Recommencer', () => run(a, extra)));
    actions.append(button('ghost', 'Terminer', () => choose('Tu peux reprendre tranquillement.')));
    const msg = el('p', 'book-title', 'C’est fini. Prends ton temps avant de reprendre.');
    // On garde le dessin ou la scène, le décompte et « Arrêter » : continuer reprend là où on en était.
    if (keep) { root.append(msg, actions, note); actions.querySelector('button').focus(); }
    else show(msg, actions, note);
  }
  choose();
  return () => { gone = true; stopRun(); clearInterval(ticker); };
}

if (typeof module !== 'undefined') module.exports = { cinqPick, CINQ };
