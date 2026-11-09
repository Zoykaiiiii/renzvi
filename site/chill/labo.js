// Labo Chill : accès de test au chantier Chill, chargé seulement avec ?chill=1 (bouton « Labo Chill » du dashboard).
// Liste les 15 fonctions, ajoute un widget à la page (vraie sauvegarde), ou l'ouvre dans un bac à sable :
// tailles Petit / Moyen / Grand, données vides / exemple / copie du compte, chargement lent, erreurs de chargement,
// d'enregistrement et de stockage. Dans le bac à sable, rien n'est écrit sur le compte : les enregistrements sont simulés.
// Ce n'est pas un contrôle d'accès : les données restent protégées par la base.
// Utilise el, button, WIDGETS, CHILL_LABO (dashboard.html) et chill.js.

const LABO_FONCTIONS = [
  ['ambiance', 'Ambiance sonore', 'existante', 'Moteur partagé, préréglages et arrêt progressif branchés dessus'],
  ['playlist', 'Playlist', 'existante', 'Inchangée'],
  ['respiration', 'Respiration', 'existante', 'Séance partagée avec « J’ai cinq minutes »'],
  ['pause', 'Pause détente', 'existante', 'Pauses partagées avec « J’ai cinq minutes »'],
  ['lecture', 'Suivi de lecture', 'existante', 'Inchangé'],
  ['inspiration', "Tableau d'inspiration", 'existante', 'Reçoit les créations de l’atelier et du coloriage'],
  ['jardin', 'Mon petit jardin', 'labo', ''],
  ['dessin', 'Atelier de dessin', 'labo', 'Enregistrement : migration Chill à passer'],
  ['coloriage', 'Coloriage', 'labo', ''],
  ['puzzle', 'Puzzle photo', 'labo', ''],
  ['tangram', 'Tangram', 'labo', ''],
  ['fenetre', "Fenêtre d'ambiance", 'labo', ''],
  ['ambiances', 'Mes ambiances', 'labo', ''],
  ['ambiances', 'Arrêt audio progressif', 'capacité', 'Dans « Mes ambiances » ; moteur dans chill.js'],
  ['cinq', "J'ai cinq minutes", 'labo', ''],
];
const LABO_LARGEUR = { s: 262, m: 356, l: 740 };

// Des données d'exemple réalistes pour voir chaque widget « rempli ».
function laboExemple(id) {
  const H = 3600000, now = Date.now();
  return {
    ambiance: { vol: { pluie: 35, vent: 0, feu: 40, cabine: 0, blanc: 0 }, master: 80 },
    playlist: { provider: 'spotify', kind: 'playlist', id: '37i9dQZF1DX4sWSpwq3LiO', title: 'Piano calme' },
    lecture: { book: { title: 'Le Petit Prince', author: 'Antoine de Saint-Exupéry', pages: 96, page: 40 }, quotes: [{ id: 'q1', text: "On ne voit bien qu'avec le cœur.", book: 'Le Petit Prince' }], finished: ['Bonjour tristesse'] },
    inspiration: { items: [{ slot: 1, caption: 'Montagne' }, { slot: 2, caption: '' }] },
    jardin: { plots: [{ s: 'tournesol', t: now - 80 * H, w: 0, lw: null }, { s: 'lavande', t: now - 30 * H, w: 1, lw: now - 2 * H }, null, { s: 'tulipe', t: now - 50 * H, w: 0, lw: null }, { s: 'fougere', t: now - 10 * H, w: 0, lw: null }, { s: 'tulipe', t: now, w: 0, lw: null }], decor: ['pot', null, 'galets'], blooms: 1 },
    dessin: { items: [{ slot: 1, at: now - 864e5 }], current: 1 },
    coloriage: { pic: 'maison', fills: { maison: { z0: '#3b6fb6', z1: '#f0c93a', z2: '#4f9a52', z5: '#d6453d' } } },
    puzzle: { n: 3, tiles: [1, 2, 3, 4, 5, 6, 7, 0, 8], img: 'demo', moves: 4 },
    tangram: { model: 'triangle' },
    fenetre: { scene: 'feu', intensity: 3 },
    ambiances: { items: [
      { id: 'a1', name: 'Soirée pluie', wall: 'loch', sound: { vol: { pluie: 45, feu: 20 }, master: 70 }, scene: { scene: 'pluie', intensity: 2 } },
      { id: 'a2', name: 'Ancien réglage', wall: 'disparu', sound: { vol: { orage: 50, vent: 30 }, master: 60 }, scene: null },
    ] },
  }[id];
}

function chillLabo({ user, sb, stored, addHere }) {
  document.querySelector('dialog.chill-labo')?.remove();
  const dialog = el('dialog', 'glass chill-labo');
  dialog.setAttribute('aria-label', 'Labo Chill');
  const head = el('div', 'chill-big-head');
  head.append(el('h2', '', 'Labo Chill'), button('ghost', 'Fermer', () => dialog.close()));
  const intro = el('p', 'zone', "Fonctions en préparation : invisibles pour les autres utilisateurs et absentes des modes publics. Pour sortir du labo sur cet appareil, ouvre le dashboard avec ?chill=0.");
  const table = el('ol', 'labo-list');
  const live = el('p', 'zone');
  live.setAttribute('role', 'status');
  const sandbox = el('section', 'labo-sandbox');
  dialog.append(head, intro, table, live, sandbox);
  const onBoard = id => document.querySelector(`#board [data-widget="${id}"]`);

  LABO_FONCTIONS.forEach(([id, name, kind, info], i) => {
    const li = el('li', 'labo-item');
    const text = el('div', 'grow');
    text.append(el('b', '', `${i + 1}. ${name}`), el('p', 'zone small', `${{ existante: 'Existante', labo: 'Développée en labo', capacité: 'Capacité partagée' }[kind]}${info ? ` · ${info}` : ''}`));
    const add = button('ghost', '', () => {
      if (onBoard(id)) { dialog.close(); onBoard(id).scrollIntoView({ block: 'start' }); onBoard(id).querySelector('button,input,select,canvas,[tabindex]')?.focus({ preventScroll: true }); return; }
      const added = addHere([id]);
      live.textContent = added.length ? `${name} ajouté à la page affichée : ses changements sont vraiment enregistrés.` : `${name} n'a pas pu être ajouté.`;
      mark();
    });
    const mark = () => { add.textContent = onBoard(id) ? 'Voir sur la page' : 'Ajouter à la page'; };
    mark();
    li.append(text, add, button('ghost', 'Bac à sable', () => open(id, name)));
    table.append(li);
  });

  // --- Bac à sable ---
  const files = new Map();
  let current = null, cleanup = null, memory = {}, opts = { size: 'm', data: 'exemple', simu: 'normal' };
  const log = el('p', 'zone small');
  log.setAttribute('aria-live', 'polite');
  const say = text => { log.textContent = `${new Date().toLocaleTimeString('fr-FR')} · ${text}`; };
  // Un faux stockage de fichiers, en mémoire, qui peut tomber en panne à la demande.
  const store = bucket => ({
    async upload(path, blob) { if (opts.simu === 'stockage') return { error: { message: 'panne simulée' } }; files.set(`${bucket}/${path}`, blob); say(`Fichier simulé : ${bucket}/${path.replace(user.id, 'moi')} (${blob.size} octets)`); return { data: { path }, error: null }; },
    async download(path) { await new Promise(r => setTimeout(r, opts.simu === 'lent' ? 1500 : 50)); const b = files.get(`${bucket}/${path}`); return opts.simu === 'stockage' || !b ? { data: null, error: { message: 'absent' } } : { data: b, error: null }; },
    async remove(paths) { if (opts.simu === 'stockage') return { error: { message: 'panne simulée' } }; paths.forEach(p => files.delete(`${bucket}/${p}`)); say(`Fichier simulé supprimé : ${paths.join(', ').replaceAll(user.id, 'moi')}`); return { data: [], error: null }; },
  });
  const fakeSb = { storage: { from: store } };
  async function exampleFiles() {
    const paint = (w, h, fn, type) => { const c = Object.assign(document.createElement('canvas'), { width: w, height: h }); fn(c.getContext('2d')); return new Promise(r => c.toBlob(r, type, .85)); };
    files.set(`dessins/${user.id}/1.png`, await paint(1600, 1200, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 1600, 1200); g.lineWidth = 30; g.lineCap = 'round'; g.strokeStyle = '#2f8f87'; g.beginPath(); g.arc(800, 600, 300, 0, 6); g.stroke(); g.strokeStyle = '#e8892c'; g.beginPath(); g.moveTo(300, 1000); g.lineTo(1300, 200); g.stroke(); }, 'image/png'));
    for (const [slot, color] of [[1, '#7d9b7f'], [2, '#c9658f']]) files.set(`inspiration/${user.id}/${slot}.jpg`, await paint(300, 300, g => { g.fillStyle = color; g.fillRect(0, 0, 300, 300); }, 'image/jpeg'));
  }
  // Les effets sur le reste de la page (fond, tableau d'inspiration, scène) sont simulés pendant le bac à sable.
  const intercept = e => {
    if (!current || !dialog.open) return;
    if (e.type === 'renzvi:inspiration') { e.stopImmediatePropagation(); e.detail.result = Promise.resolve(opts.simu === 'stockage' ? { ok: false, why: 'envoi' } : { ok: true, slot: 1 }); say(`Envoi simulé au tableau d'inspiration (${e.detail.blob?.size ?? 0} octets, ${e.detail.blob?.type})`); }
    else if (e.detail?.set) { e.stopImmediatePropagation(); e.detail.ok = e.detail.set !== 'disparu'; e.detail.current = e.detail.set; say(`${e.type === 'renzvi:fond' ? 'Fond' : 'Scène'} simulé : ${JSON.stringify(e.detail.set)}`); }
  };
  for (const t of ['renzvi:inspiration', 'renzvi:fond', 'renzvi:fenetre']) addEventListener(t, intercept, true);

  const box = el('section', 'widget glass labo-box');
  const titleEl = el('h2', '', '');
  const meta = el('p', 'meta');
  const top = el('div', 'head');
  top.append(titleEl, meta);
  const body = el('div', 'body');
  box.append(top, body);
  const group = (label, entries, key) => {
    const g = el('div', 'choices');
    g.setAttribute('role', 'group');
    g.ariaLabel = label;
    for (const [v, name] of entries) {
      const b = button('', name, () => { opts[key] = v; for (const c of g.children) c.setAttribute('aria-pressed', c === b); mount(); });
      b.setAttribute('aria-pressed', opts[key] === v);
      g.append(b);
    }
    return g;
  };
  const controls = el('div', 'labo-controls');
  controls.append(
    el('span', 'zone', 'Taille'), group('Taille', [['s', 'Petit'], ['m', 'Moyen'], ['l', 'Grand']], 'size'),
    el('span', 'zone', 'Données'), group('Données', [['vide', 'Vides'], ['exemple', 'Exemple'], ['compte', 'Mon compte (copie)']], 'data'),
    el('span', 'zone', 'Simuler'), group('Simulation', [['normal', 'Normal'], ['lent', 'Chargement lent'], ['panne', 'Erreur de chargement'], ['enreg', "Erreur d'enregistrement"], ['stockage', 'Erreur de stockage']], 'simu'),
  );
  const reopen = button('ghost', 'Fermer et rouvrir le widget', () => mount(true));
  const shown = el('details', 'labo-json');
  const json = el('pre', '');
  shown.append(el('summary', '', 'Dernières données enregistrées (simulées)'), json);
  sandbox.append(el('h3', '', 'Bac à sable'), el('p', 'zone small', "Rien n'est écrit sur ton compte ici. Pour tester la vraie sauvegarde, utilise « Ajouter à la page »."), controls, reopen, box, log, shown);
  sandbox.hidden = true;

  async function open(id, name) {
    current = { id, name };
    memory = {};
    files.clear();
    await exampleFiles();
    sandbox.hidden = false;
    mount();
    sandbox.scrollIntoView({ block: 'start' });
  }
  function mount(keep = false) {
    cleanup?.();
    cleanup = null;
    const w = WIDGETS.find(x => x.id === current.id);
    if (!w) { body.replaceChildren(el('p', 'msg', 'Widget introuvable.')); return; }
    const source = keep && current.id in memory ? memory[current.id]
      : opts.data === 'vide' ? undefined : opts.data === 'compte' ? structuredClone(stored()[current.id]) : laboExemple(current.id);
    box.dataset.size = opts.size;
    box.dataset.widget = current.id;
    box.style.width = `${Math.min(LABO_LARGEUR[opts.size], dialog.clientWidth - 48)}px`;
    titleEl.textContent = `${w.title} (bac à sable)`;
    meta.textContent = '';
    body.replaceChildren();
    const save = data => {
      const text = JSON.stringify(data);
      if (opts.simu === 'enreg') { say("Enregistrement refusé (simulé) : le dashboard affiche « Pas encore enregistré. Nouvel essai… » et réessaie."); return; }
      memory[current.id] = JSON.parse(text);
      json.textContent = JSON.stringify(data, null, 2).slice(0, 4000);
      say(`Enregistrement simulé : ${new Blob([text]).size} octets${new Blob([text]).size > 65536 ? ' — TROP GROS pour la base (64 Ko)' : ''}`);
    };
    const simu = opts.simu === 'lent' ? { delay: 3000 } : opts.simu === 'panne' ? { fail: true } : {};
    try {
      cleanup = w.render({ body, meta, user, sb: fakeSb, data: source, save, simu, focusLogs: () => [] }) ?? null;
    } catch (e) { console.error(e); body.replaceChildren(el('p', 'msg', "Ce widget n'a pas pu se charger.")); }
    if (keep) say('Widget fermé puis rouvert avec ses dernières données enregistrées.');
  }
  dialog.addEventListener('close', () => {
    cleanup?.();
    for (const t of ['renzvi:inspiration', 'renzvi:fond', 'renzvi:fenetre']) removeEventListener(t, intercept, true);
    dialog.remove();
  });
  document.body.append(dialog);
  dialog.showModal();
}
