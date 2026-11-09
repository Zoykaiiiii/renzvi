// Chill C5 : Mes ambiances enregistrées et arrêt audio progressif.
// Une ambiance = un fond d'écran (même système que le sélecteur de fond), un mélange du moteur sonore, une scène de la
// fenêtre d'ambiance. L'appliquer ne touche jamais aux widgets ni à leur ordre. Rien ne s'applique sans un clic.
// L'arrêt progressif ne concerne que les sons de Renzvi : Spotify et YouTube ne sont pas pilotables d'ici.
// Utilise el, button, clockLabel, SOUNDS (dashboard.html) et ChillSon (chill.js).

const AMBIANCES = { MAX: 10, NAME: 40, SLEEP: [5, 15, 30, 60] };

// Données enregistrées nettoyées. Un fond ou un son inconnu est gardé tel quel : il sera signalé à l'application.
function ambiancesClean(data) {
  const id = v => typeof v === 'string' && /^[\w-]{1,40}$/.test(v);
  const vol = v => Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : 0;
  const items = [];
  for (const it of Array.isArray(data?.items) ? data.items : []) {
    if (!id(it?.id) || typeof it.name !== 'string' || !it.name.trim() || items.some(x => x.id === it.id)) continue;
    const sound = it.sound && typeof it.sound.vol === 'object' && it.sound.vol
      ? { vol: Object.fromEntries(Object.entries(it.sound.vol).filter(([k]) => id(k)).slice(0, 12).map(([k, v]) => [k, vol(v)])), master: vol(it.sound.master) } : null;
    const scene = it.scene && id(it.scene.scene) ? { scene: it.scene.scene, intensity: [1, 2, 3].includes(it.scene.intensity) ? it.scene.intensity : 2 } : null;
    items.push({ id: it.id, name: it.name.trim().slice(0, AMBIANCES.NAME), wall: id(it.wall) ? it.wall : null, sound, scene });
    if (items.length >= AMBIANCES.MAX) break;
  }
  return { items };
}

const ambiancesFond = set => { const detail = set ? { set } : {}; document.dispatchEvent(new CustomEvent('renzvi:fond', { detail })); return detail; };
const ambiancesScene = set => { const detail = set ? { set } : {}; document.dispatchEvent(new CustomEvent('renzvi:fenetre', { detail })); return detail; };

// La minuterie d'arrêt progressif : un seul compte à rebours (celui du moteur), affiché ici.
function ambiancesSommeil() {
  const box = el('div', 'ambiances-sleep');
  const choices = el('div', 'choices');
  choices.setAttribute('role', 'group');
  choices.ariaLabel = "Arrêter le son dans";
  const left = el('p', 'zone');
  left.setAttribute('role', 'status');
  const cancel = button('ghost', "Annuler l'arrêt", () => ChillSon.sleepCancel());
  const minutes = [...AMBIANCES.SLEEP, ...(typeof CHILL_LABO !== 'undefined' && CHILL_LABO ? [1 / 3] : [])];
  for (const m of minutes) choices.append(button('', m < 1 ? '20 s (labo)' : `${m} min`, () => ChillSon.sleepStart(m * 60000, m < 1 ? 10000 : Math.min(60000, m * 60000 / 2))));
  box.append(el('p', 'book-title', 'Arrêt progressif'), choices, left, cancel,
    el('p', 'zone small', "Le son de Renzvi baisse doucement pendant la dernière minute, puis s'arrête. Spotify et YouTube ne sont pas concernés. Si l'appareil met la page en veille, l'arrêt se fait au réveil."));
  let ticker = null;
  function draw() {
    const end = ChillSon.sleepEnd();
    cancel.hidden = !end;
    if (end) {
      left.textContent = `Arrêt dans ${clockLabel(Math.max(0, end - Date.now()))}${ChillSon.playing() ? '' : ' (le son est en pause)'}`;
      ticker ??= setInterval(draw, 1000);
    } else {
      left.textContent = 'Aucun arrêt programmé.';
      clearInterval(ticker);
      ticker = null;
    }
  }
  const off = ChillSon.subscribe(draw);
  draw();
  return { box, cleanup: () => { off(); clearInterval(ticker); } };
}

function ambiancesWidget({ body, meta, data, save }) {
  let state = ambiancesClean(data), editing = null;
  const persist = () => save(state);
  const root = el('div', 'ambiances');
  const note = el('p', 'zone');
  note.setAttribute('role', 'status');
  const player = el('div', 'atelier-row');
  const playState = el('span', 'zone');
  const play = button('ghost', '', async () => {
    if (ChillSon.playing()) return ChillSon.pause();
    const why = await ChillSon.play().catch(() => 'erreur');
    if (why) note.textContent = why === 'erreur' ? "Ton navigateur n'a pas pu lancer le son." : 'Aucun son dans ce mélange : applique une ambiance avec des sons, ou règle le widget Ambiance.';
  });
  player.append(play, playState);
  const list = el('ul', 'rows');
  const empty = el('p', 'empty', 'Aucune ambiance. Règle ton fond, tes sons et ta scène, puis enregistre-les ici.');
  const form = el('form', 'ambiances-form');
  const sleep = ambiancesSommeil();
  root.append(player, form, note, empty, list, sleep.box);

  const wallName = (id, choices) => choices.find(c => c.id === id)?.name ?? id;
  const soundName = id => SOUNDS.find(s => s.id === id)?.name ?? id;
  const mixText = s => { const on = Object.entries(s.vol).filter(([, v]) => v > 0); return on.length ? on.map(([k, v]) => `${soundName(k)} ${v} %`).join(', ') : 'silence'; };
  function summary(it) {
    const { choices = [] } = ambiancesFond();
    return [it.wall && `Fond ${wallName(it.wall, choices)}`, it.sound && `Sons : ${mixText(it.sound)}`, it.scene && `Scène ${FENETRE_NAMES[it.scene.scene] ?? it.scene.scene}`].filter(Boolean).join(' · ') || 'Vide';
  }
  // Ce que l'on peut enregistrer maintenant.
  function current() {
    const fond = ambiancesFond(), scene = ambiancesScene();
    return { wall: fond.current ?? null, choices: fond.choices ?? [], sound: ChillSon.settings(), scene: scene.current ?? null };
  }
  function drawForm() {
    const now = current(), it = editing && state.items.find(x => x.id === editing);
    const name = Object.assign(el('input'), { type: 'text', placeholder: "Nom de l'ambiance", maxLength: AMBIANCES.NAME, ariaLabel: "Nom de l'ambiance", autocomplete: 'off', value: it?.name ?? '' });
    const check = (label, on, disabled) => {
      const l = el('label', 'ambiances-check');
      const c = Object.assign(el('input'), { type: 'checkbox', checked: on && !disabled, disabled });
      l.append(c, el('span', '', label));
      return { l, c };
    };
    const prefix = it ? 'Remplacer par ' : '';
    const wall = check(`${prefix}le fond actuel (${now.wall ? wallName(now.wall, now.choices) : 'aucun'})`, !it, !now.wall);
    const sound = check(`${prefix}les sons actuels (${mixText(now.sound)})`, !it, false);
    const scene = check(now.scene ? `${prefix}la scène actuelle (${FENETRE_NAMES[now.scene.scene]})` : 'Scène : ajoute la fenêtre d\'ambiance à ton écran pour l\'inclure', !it, !now.scene);
    const submit = Object.assign(el('button', 'primary', it ? 'Enregistrer' : "Enregistrer l'ambiance actuelle"), { type: 'submit' });
    const parts = [name, wall.l, sound.l, scene.l, submit];
    if (it) parts.push(button('ghost', 'Annuler', () => { editing = null; drawForm(); }));
    form.replaceChildren(...parts);
    form.onsubmit = e => {
      e.preventDefault();
      const n = name.value.trim();
      if (!n) { note.textContent = "Donne un nom à l'ambiance."; return name.focus(); }
      if (!it && state.items.length >= AMBIANCES.MAX) { note.textContent = `Tu as déjà ${AMBIANCES.MAX} ambiances. Supprimes-en une pour continuer.`; return; }
      const at = current(); // les réglages au moment du clic, pas à l'affichage du formulaire
      const next = {
        id: it?.id ?? crypto.randomUUID(), name: n.slice(0, AMBIANCES.NAME),
        wall: wall.c.checked && at.wall ? at.wall : it?.wall ?? null,
        sound: sound.c.checked ? at.sound : it?.sound ?? null,
        scene: scene.c.checked && at.scene ? at.scene : it?.scene ?? null,
      };
      state = { items: it ? state.items.map(x => x.id === it.id ? next : x) : [...state.items, next] };
      editing = null;
      note.textContent = it ? `« ${next.name} » modifiée.` : `« ${next.name} » enregistrée.`;
      persist();
      draw();
    };
  }
  // Appliquer : chaque partie indépendamment ; ce qui manque est expliqué, le reste est appliqué.
  function apply(it) {
    const missing = [];
    if (it.wall) { const r = ambiancesFond(it.wall); if (!r.ok) missing.push(it.wall === 'perso' ? "ta photo de fond n'est plus disponible" : `le fond « ${it.wall} » n'existe plus`); }
    if (it.sound) {
      const gone = ChillSon.setMix(it.sound);
      if (gone.length) missing.push(`${gone.length > 1 ? 'des sons' : 'un son'} n'existe${gone.length > 1 ? 'nt' : ''} plus (${gone.join(', ')})`);
    }
    if (it.scene) { const r = ambiancesScene(it.scene); if (!r.ok) missing.push("la fenêtre d'ambiance n'est pas sur ton écran, la scène n'a pas été appliquée"); }
    const hint = it.sound && !ChillSon.playing() ? ' Le mélange est prêt : lance le son quand tu veux.' : '';
    note.textContent = `« ${it.name} » appliquée.${missing.length ? ` Mais ${missing.join(' ; ')}.` : ''}${hint}`;
  }
  function row(it) {
    const li = el('li', 'row ambiances-row');
    const text = el('div', 'grow');
    text.append(el('b', '', it.name), el('p', 'zone small', summary(it)));
    const go = button('ghost', 'Appliquer', () => apply(it));
    go.ariaLabel = `Appliquer : ${it.name}`;
    const edit = button('ghost', 'Modifier', () => { editing = it.id; drawForm(); form.querySelector('input').focus(); });
    edit.ariaLabel = `Modifier : ${it.name}`;
    let sure = null;
    const del = button('x', '×', () => {
      if (!sure) { del.textContent = '?'; del.ariaLabel = `Confirmer la suppression : ${it.name}`; sure = setTimeout(() => { sure = null; del.textContent = '×'; del.ariaLabel = `Supprimer : ${it.name}`; }, 3000); return; }
      clearTimeout(sure);
      state = { items: state.items.filter(x => x.id !== it.id) };
      if (editing === it.id) editing = null;
      note.textContent = `« ${it.name} » supprimée.`;
      persist();
      draw();
    });
    del.ariaLabel = `Supprimer : ${it.name}`;
    li.append(text, go, edit, del);
    return li;
  }
  function drawPlayer() {
    const on = ChillSon.playing();
    play.textContent = on ? 'Pause' : 'Lancer le son';
    playState.textContent = on ? 'Son en cours' : ChillSon.active() ? 'Son en pause' : 'Son arrêté';
  }
  function draw() {
    list.replaceChildren(...state.items.map(row));
    empty.hidden = state.items.length > 0;
    list.hidden = !state.items.length;
    meta.textContent = state.items.length ? `${state.items.length} / ${AMBIANCES.MAX}` : '';
    drawForm();
    drawPlayer();
  }
  const off = ChillSon.subscribe(drawPlayer);
  // La fenêtre d'ambiance arrive ou change : le formulaire se met à jour, sauf si on est en train de le remplir.
  const onScene = () => { if (!form.contains(document.activeElement) && !form.querySelector('input[type=text]')?.value) drawForm(); };
  document.addEventListener('renzvi:fenetre-maj', onScene);
  draw();
  body.append(root);
  return () => { off(); sleep.cleanup(); document.removeEventListener('renzvi:fenetre-maj', onScene); };
}
const FENETRE_NAMES = { pluie: 'Pluie', foret: 'Forêt', feu: 'Cheminée' };

if (typeof module !== 'undefined') module.exports = { ambiancesClean, AMBIANCES };
