// Study S7 : le widget Schémas. On garde une image (photo, capture, ou page d'un PDF du Cahier), on encadre une fois ses
// légendes, puis « Interroge-moi » cache au hasard une ou plusieurs zones sous un cache opaque : on cherche, on
// révèle, on répond Trouvé ou À revoir. Les zones sont en coordonnées de 0 à 1 pour suivre la taille du widget.
// Pas d'IA, pas de détection automatique. L'image est réenregistrée dans le navigateur (données GPS retirées) et reste
// privée (stockage « schemas »). Widget en préparation : caché sauf avec ?labo=1.
// Utilise el, button, plural, listOf (dashboard.html) et cartesError, CAHIER (cahier.js / cartes.js).
const SCHEMAS = { side: 2000, bytes: 1536 * 1024, zones: 40, answer: 80, titre: 120, deck: 60, min: 0.02, step: 0.01 };
const schemaClamp = v => Math.min(1, Math.max(0, v));
const schemaRound = v => Math.round(v * 10000) / 10000;

// Des zones valides : dans l'image, assez grandes, 40 au plus.
function schemaZones(list) {
  return listOf(list).filter(z => typeof z?.id === 'string' && [z.x, z.y, z.w, z.h].every(Number.isFinite)).map(z => {
    const x = schemaClamp(z.x), y = schemaClamp(z.y);
    return { id: z.id.slice(0, 40), x: schemaRound(x), y: schemaRound(y), w: schemaRound(Math.min(1 - x, Math.max(SCHEMAS.min, z.w))), h: schemaRound(Math.min(1 - y, Math.max(SCHEMAS.min, z.h))), reponse: String(z.reponse ?? '').replace(/\s+/g, ' ').trim().slice(0, SCHEMAS.answer) };
  }).filter(z => z.w >= SCHEMAS.min / 2 && z.h >= SCHEMAS.min / 2).slice(0, SCHEMAS.zones);
}

// Le tirage : n zones au hasard, en évitant celles du tirage d'avant quand il en reste assez, et en commençant par les
// zones ratées quand on revoit ses erreurs.
function schemaDraw(zones, n, previous = [], missed = null) {
  const pool = missed ? zones.filter(z => missed.has(z.id)) : zones;
  if (!pool.length) return [];
  const fresh = pool.filter(z => !previous.includes(z.id));
  const from = fresh.length >= Math.min(n, pool.length) ? fresh : pool;
  const a = [...from];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, Math.min(n, a.length));
}

// Réduit et réenregistre une image en JPEG (retire aussi ses données de position).
async function schemaShrink(source) {
  const bitmap = await createImageBitmap(source);
  let side = SCHEMAS.side;
  try {
    for (const quality of [.85, .72, .6]) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= SCHEMAS.bytes) return { blob, largeur: canvas.width, hauteur: canvas.height };
      side = Math.round(side * .8);
    }
  } finally { bitmap.close(); }
  throw cartesError("Cette image n'a pas pu être réduite sous 1,5 Mo.");
}

// Une page d'un PDF du Cahier, dessinée en image.
async function schemaPdfPage(blob, index) {
  const lib = await import(new URL(`${CAHIER.pdfjs}pdf.min.js`, location.href).href);
  lib.GlobalWorkerOptions.workerSrc = new URL(`${CAHIER.pdfjs}pdf.worker.min.js`, location.href).href;
  const task = lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false, enableXfa: false });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(index + 1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(3, SCHEMAS.side / Math.max(base.width, base.height)) });
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(viewport.width), height: Math.round(viewport.height) });
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  } finally { task.destroy(); }
}

function schemasWidget({ body, meta, data, save, user, sb }) {
  const box = body.closest('.widget');
  const store = sb.storage.from('schemas');
  const pathOf = s => `${user.id}/${s.id}.jpg`;
  let schemas = [], state = 'loading', mode = 'view', current = typeof data?.schema === 'string' ? data.schema : null;
  let gone = false, armed = null, selected = null, zonesDraft = null, quiz = null, level = [1, 2, 3].includes(data?.level) ? data.level : 1;
  let last = new Map(), pending = null;
  const urls = new Map();

  const bar = el('div', 'cahier-bar');
  const pick = Object.assign(el('select', 'cahier-pick'), { ariaLabel: 'Schéma' });
  const newBtn = button('ghost', 'Nouveau schéma', () => setMode('new'));
  const editBtn = button('ghost', 'Modifier les zones', () => setMode(mode === 'edit' ? 'view' : 'edit'));
  const quizBtn = button('primary', 'Interroge-moi', () => startQuiz(false));
  bar.append(pick, newBtn, editBtn, quizBtn);
  const view = el('div', 'cartes-view');
  const note = el('p', 'zone cahier-note');
  note.setAttribute('role', 'status');
  const removeBtn = button('link cahier-danger', 'Supprimer ce schéma', removeSchema);
  body.append(bar, view, note, removeBtn);
  const say = (text, bad = false) => { note.textContent = text; note.classList.toggle('msg', bad); };
  const schema = () => schemas.find(s => s.id === current);
  const persist = () => save({ schema: current, level });
  function setMode(m) { mode = m; selected = null; zonesDraft = m === 'edit' ? schemaZones(schema()?.zones) : null; if (m !== 'quiz') quiz = null; say(''); draw(); }

  async function load() {
    state = 'loading';
    draw();
    const [{ data: rows, error }, { data: answers }] = await Promise.all([
      sb.from('study_schemas').select('id,deck,titre,course_id,src_page,largeur,hauteur,zones,zones_a_verifier,image_version,created_at').order('created_at'),
      sb.from('study_schema_answers').select('schema_id,zone_id,reussie,created_at').order('created_at', { ascending: false }).limit(2000),
    ]);
    if (gone) return;
    if (error) { state = 'error'; draw(); return; }
    schemas = rows.map(r => ({ ...r, zones: schemaZones(r.zones) }));
    // La dernière réponse de chaque zone : sert à « Revoir mes erreurs ».
    last = new Map();
    for (const a of listOf(answers)) { const k = `${a.schema_id}:${a.zone_id}`; if (!last.has(k)) last.set(k, a.reussie); }
    state = 'ready';
    if (!schema()) current = schemas.at(-1)?.id ?? null;
    if (pending) { const p = pending; pending = null; return fromPdf(p); }
    draw();
  }

  async function image(s) {
    const key = `${s.id}:${s.image_version}`;
    if (urls.has(key)) return urls.get(key);
    const { data: blob, error } = await store.download(pathOf(s));
    if (error || !blob) throw new Error('image absente');
    const url = URL.createObjectURL(blob);
    urls.set(key, url);
    return url;
  }

  function draw() {
    const s = schema(), ready = state === 'ready';
    bar.hidden = !ready;
    pick.hidden = editBtn.hidden = quizBtn.hidden = !s || mode === 'new';
    removeBtn.hidden = !s || mode !== 'edit';
    editBtn.textContent = mode === 'edit' ? 'Terminer' : 'Modifier les zones';
    quizBtn.hidden ||= mode === 'quiz' || mode === 'edit';
    pick.replaceChildren(...schemas.map(x => Object.assign(el('option', '', `${x.titre} (${x.deck})`), { value: x.id, selected: x.id === current })));
    meta.textContent = s && mode !== 'new' ? plural(s.zones.length, 'zone') : '';
    if (state === 'loading') return view.replaceChildren(el('p', 'empty', 'Chargement de tes schémas…'));
    if (state === 'error') return view.replaceChildren(el('p', 'msg', "Tes schémas n'ont pas pu se charger."), button('ghost', 'Réessayer', load));
    if (mode === 'new') return drawNew();
    if (!s) return view.replaceChildren(el('p', 'empty cartes-start', 'Ajoute une image de schéma (photo, capture ou page de ton cours), encadre ses légendes une fois, puis laisse-toi interroger.'));
    const stage = el('div', 'schema-stage');
    // La zone de dessin a exactement les proportions de l'image : les coordonnées de 0 à 1 tombent au bon endroit.
    stage.style.aspectRatio = `${s.largeur} / ${s.hauteur}`;
    stage.style.setProperty('--r', s.largeur / s.hauteur);
    const img = Object.assign(el('img', 'schema-img'), { alt: s.titre, draggable: false });
    stage.append(img);
    image(s).then(url => { img.src = url; }, () => { if (!gone) say("L'image de ce schéma n'a pas pu se charger. Vérifie ta connexion.", true); });
    if (mode === 'edit') return drawEdit(s, stage);
    if (mode === 'quiz' && quiz) return drawQuiz(s, stage);
    const items = [stage];
    if (s.zones_a_verifier) items.unshift(el('p', 'cahier-alert', "L'image a changé : vérifie que tes zones sont toujours sur les bonnes légendes, puis enregistre-les."));
    else if (!s.zones.length) items.push(el('p', 'zone', 'Encadre au moins une légende avec « Modifier les zones » pour pouvoir t’interroger.'));
    else {
      const missed = s.zones.filter(z => last.get(`${s.id}:${z.id}`) === false).length;
      if (missed) items.push(button('ghost', `Revoir mes erreurs (${missed})`, () => startQuiz(true)));
    }
    quizBtn.disabled = !s.zones.length || s.zones_a_verifier;
    view.replaceChildren(...items);
  }

  const place = (node, z) => Object.assign(node.style, { left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.w * 100}%`, height: `${z.h * 100}%` });

  // L'éditeur : glisser sur l'image crée une zone ; une zone choisie se déplace aux flèches (Maj + flèches : taille).
  function drawEdit(s, stage) {
    const zones = zonesDraft;
    const layer = el('div', 'schema-layer');
    stage.append(layer);
    zones.forEach((z, i) => {
      const n = button('schema-zone', String(i + 1), () => { selected = z.id; draw(); stage.querySelector(`[data-zone="${z.id}"]`)?.focus(); });
      n.dataset.zone = z.id;
      n.ariaLabel = `Zone ${i + 1}${z.reponse ? ` : ${z.reponse}` : ''}`;
      n.setAttribute('aria-pressed', selected === z.id);
      place(n, z);
      n.onkeydown = e => {
        const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (k) {
          e.preventDefault();
          if (e.shiftKey) { z.w = schemaClamp(Math.max(SCHEMAS.min, z.w + k[0] * SCHEMAS.step)); z.h = schemaClamp(Math.max(SCHEMAS.min, z.h + k[1] * SCHEMAS.step)); }
          else { z.x = schemaClamp(Math.min(1 - z.w, z.x + k[0] * SCHEMAS.step)); z.y = schemaClamp(Math.min(1 - z.h, z.y + k[1] * SCHEMAS.step)); }
          place(n, z);
        } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeZone(z.id); }
      };
      layer.append(n);
    });
    // Glisser pour créer une zone (souris, doigt ou stylet).
    let start = null, ghost = null;
    const at = e => { const r = layer.getBoundingClientRect(); return { x: schemaClamp((e.clientX - r.left) / r.width), y: schemaClamp((e.clientY - r.top) / r.height) }; };
    layer.onpointerdown = e => {
      if (e.target !== layer) return;
      e.preventDefault();
      layer.setPointerCapture(e.pointerId);
      start = at(e);
      ghost = el('div', 'schema-zone ghost');
      layer.append(ghost);
    };
    layer.onpointermove = e => {
      if (!start) return;
      const p = at(e);
      place(ghost, { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) });
    };
    layer.onpointerup = layer.onpointercancel = e => {
      if (!start) return;
      const p = at(e), z = { id: crypto.randomUUID().slice(0, 8), x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y), reponse: '' };
      start = null;
      ghost?.remove();
      if (e.type === 'pointercancel' || z.w < SCHEMAS.min || z.h < SCHEMAS.min) return;
      addZone(z);
    };

    const tools = el('div', 'cahier-actions');
    const add = button('ghost', 'Ajouter une zone', () => addZone({ id: crypto.randomUUID().slice(0, 8), x: .4, y: .45, w: .2, h: .1, reponse: '' }));
    add.disabled = zones.length >= SCHEMAS.zones;
    const saveBtn = button('primary', 'Enregistrer les zones', saveZones);
    const replace = Object.assign(el('input'), { type: 'file', accept: 'image/*', hidden: true });
    replace.onchange = () => replace.files[0] && replaceImage(s, replace.files[0]);
    tools.append(add, saveBtn, button('link', "Remplacer l'image", () => replace.click()), replace);
    const items = [el('p', 'zone', 'Glisse sur l’image pour encadrer une légende. Au clavier : « Ajouter une zone », puis les flèches pour la déplacer et Maj + flèches pour la taille.'), stage, tools];
    const z = zones.find(x => x.id === selected);
    if (z) {
      const panel = el('div', 'cahier-edit');
      const answer = Object.assign(el('input', 'cahier-rename'), { type: 'text', maxLength: SCHEMAS.answer, value: z.reponse, placeholder: 'La légende cachée (facultatif)', ariaLabel: `Réponse de la zone ${zones.indexOf(z) + 1}`, autocomplete: 'off' });
      answer.oninput = () => { z.reponse = answer.value; };
      panel.append(el('p', 'cartes-sum', `Zone ${zones.indexOf(z) + 1}`), answer, button('link cahier-danger', 'Supprimer cette zone', () => removeZone(z.id)));
      items.splice(2, 0, panel);
    }
    view.replaceChildren(...items);
  }
  function addZone(z) {
    if (zonesDraft.length >= SCHEMAS.zones) { say(`${SCHEMAS.zones} zones au plus par schéma.`, true); return; }
    zonesDraft.push(z);
    selected = z.id;
    draw();
    view.querySelector(`[data-zone="${z.id}"]`)?.focus();
  }
  function removeZone(id) { zonesDraft = zonesDraft.filter(z => z.id !== id); selected = null; draw(); }
  async function saveZones() {
    const s = schema();
    const zones = schemaZones(zonesDraft);
    const { error } = await sb.from('study_schemas').update({ zones, zones_a_verifier: false, updated_at: new Date().toISOString() }).eq('id', s.id);
    if (gone) return;
    if (error) { say("Les zones n'ont pas été enregistrées. Vérifie ta connexion.", true); return; }
    Object.assign(s, { zones, zones_a_verifier: false });
    mode = 'view';
    say(`${plural(zones.length, 'zone')} enregistrée${zones.length > 1 ? 's' : ''}.`);
    draw();
  }

  async function upload(s, file, upsert) {
    const { blob, largeur, hauteur } = await schemaShrink(file);
    const { error } = await store.upload(pathOf(s), blob, { contentType: 'image/jpeg', upsert });
    if (error) throw cartesError("L'image n'a pas été enregistrée. Vérifie ta connexion.");
    return { largeur, hauteur };
  }
  async function replaceImage(s, file) {
    say('Envoi de la nouvelle image…');
    try {
      const size = await upload(s, file, true);
      const next = { ...size, image_version: s.image_version + 1, zones_a_verifier: s.zones.length > 0 };
      const { error } = await sb.from('study_schemas').update(next).eq('id', s.id);
      if (error) throw cartesError("Le schéma n'a pas été mis à jour.");
      Object.assign(s, next);
      say(s.zones_a_verifier ? "Nouvelle image enregistrée : vérifie tes zones, puis « Enregistrer les zones »." : 'Nouvelle image enregistrée.');
      draw();
    } catch (e) { say(e.user ? e.message : "Cette image n'a pas pu être lue.", true); }
  }

  function drawNew(prefill = {}) {
    const form = el('form', 'cahier-import');
    form.noValidate = true;
    const field = (label, input) => { const f = el('label', 'cahier-field', label); f.append(input); return f; };
    const titre = Object.assign(el('input'), { type: 'text', maxLength: SCHEMAS.titre, autocomplete: 'off', value: prefill.titre ?? '', placeholder: 'La cellule animale' });
    const deck = Object.assign(el('input'), { type: 'text', maxLength: SCHEMAS.deck, autocomplete: 'off', value: prefill.deck ?? schema()?.deck ?? '', placeholder: 'Biologie' });
    const file = Object.assign(el('input'), { type: 'file', accept: 'image/*', hidden: true });
    const chosen = el('p', 'cahier-chosen', prefill.blob ? `Page ${prefill.page + 1} du cours` : '');
    const row = el('div', 'cahier-filerow');
    row.append(button('ghost', 'Choisir une image', () => file.click()), chosen);
    file.onchange = () => { chosen.textContent = file.files[0]?.name ?? ''; if (file.files[0] && !titre.value) titre.value = file.files[0].name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, SCHEMAS.titre); };
    const status = el('p', 'zone');
    status.setAttribute('role', 'status');
    const submit = Object.assign(el('button', 'primary', 'Créer le schéma'), { type: 'submit' });
    const actions = el('div', 'cahier-actions');
    actions.append(submit, button('ghost', 'Annuler', () => setMode('view')));
    form.append(field('Titre', titre), field('Paquet', deck), row, el('p', 'zone', 'Une photo, une capture ou une page de ton cours. Elle reste privée.'), file, status, actions);
    form.onsubmit = async e => {
      e.preventDefault();
      const fail = t => { status.textContent = t; status.classList.add('msg'); };
      status.classList.remove('msg');
      const source = file.files[0] ?? prefill.blob;
      if (!titre.value.trim()) return fail('Donne un titre à ce schéma.');
      if (!deck.value.trim()) return fail('Indique son paquet.');
      if (!source) return fail('Choisis une image.');
      if (schemas.length >= 200) return fail('Tu as déjà 200 schémas : supprimes-en un.');
      submit.disabled = true;
      status.textContent = 'Envoi de l’image…';
      const s = { id: crypto.randomUUID(), titre: titre.value.trim().slice(0, SCHEMAS.titre), deck: deck.value.replace(/\s+/g, ' ').trim().slice(0, SCHEMAS.deck), zones: [], zones_a_verifier: false, image_version: 1, ...(prefill.course && { course_id: prefill.course, src_page: prefill.page }) };
      try {
        Object.assign(s, await upload(s, source, false));
        const { error } = await sb.from('study_schemas').insert(s);
        if (error) { await store.remove([pathOf(s)]); throw cartesError("Le schéma n'a pas été créé. Vérifie ta connexion."); }
      } catch (err) { submit.disabled = false; return fail(err.user ? err.message : "Cette image n'a pas pu être lue. Essaie une photo JPEG ou PNG."); }
      if (gone) return;
      schemas.push(s);
      current = s.id;
      persist();
      setMode('edit');
      say('Schéma créé : encadre maintenant ses légendes.');
    };
    view.replaceChildren(form);
    titre.focus({ preventScroll: true });
  }

  function startQuiz(onlyMissed) {
    const s = schema();
    if (!s?.zones.length || s.zones_a_verifier) return;
    const missed = onlyMissed ? new Set(s.zones.filter(z => last.get(`${s.id}:${z.id}`) === false).map(z => z.id)) : null;
    quiz = { missed, previous: [], round: null, shown: false, found: 0, again: 0 };
    mode = 'quiz';
    say('');
    nextRound();
  }
  function nextRound() {
    const s = schema();
    const picked = schemaDraw(s.zones, level, quiz.previous, quiz.missed && quiz.missed.size ? quiz.missed : null);
    if (quiz.missed && !quiz.missed.size) { quiz.round = null; return draw(); }
    quiz.round = picked.map(z => z.id);
    quiz.previous = quiz.round;
    quiz.shown = false;
    draw();
  }
  function drawQuiz(s, stage) {
    const layer = el('div', 'schema-layer');
    stage.append(layer);
    const items = [];
    if (!quiz.round || !quiz.round.length) {
      items.push(el('p', 'cartes-face', 'Plus aucune erreur à revoir sur ce schéma.'), button('ghost', 'Retour au schéma', () => setMode('view')));
      return view.replaceChildren(...items);
    }
    quiz.round.forEach((id, i) => {
      const z = s.zones.find(x => x.id === id);
      if (!z) return;
      // Un cache opaque : la légende dessous n'est pas visible tant qu'on n'a pas révélé.
      const m = el('div', quiz.shown ? 'schema-zone shown' : 'schema-mask', quiz.shown ? String(i + 1) : '?');
      m.ariaLabel = quiz.shown ? `Zone ${i + 1}` : `Légende cachée ${i + 1}`;
      place(m, z);
      layer.append(m);
    });
    const levels = el('div', 'cartes-kinds');
    levels.setAttribute('role', 'group');
    levels.ariaLabel = 'Difficulté';
    for (const n of [1, 2, 3]) {
      const b = button('ghost', n === 1 ? '1 zone' : `${n} zones`, () => { level = n; persist(); nextRound(); });
      b.setAttribute('aria-pressed', n === level);
      b.disabled = n > s.zones.length;
      levels.append(b);
    }
    const actions = el('div', 'cahier-actions cartes-rate');
    if (!quiz.shown) actions.append(button('primary', 'Révéler', () => { quiz.shown = true; draw(); view.querySelector('.cartes-rate .primary')?.focus(); }));
    else {
      const answers = el('ol', 'schema-answers');
      for (const id of quiz.round) { const z = s.zones.find(x => x.id === id); answers.append(el('li', '', z?.reponse || 'Regarde l’image')); }
      items.push(answers);
      actions.append(button('ghost', 'À revoir', () => rate(s, false)), button('primary', 'Trouvé', () => rate(s, true)));
    }
    meta.textContent = `${quiz.found} trouvée${quiz.found > 1 ? 's' : ''} · ${quiz.again} à revoir`;
    view.replaceChildren(levels, stage, ...items, actions, button('link', 'Arrêter', () => setMode('view')));
  }
  async function rate(s, reussie) {
    const round = quiz.round;
    quiz[reussie ? 'found' : 'again'] += round.length;
    for (const id of round) {
      last.set(`${s.id}:${id}`, reussie);
      if (reussie) quiz.missed?.delete(id);
    }
    nextRound();
    const { error } = await sb.from('study_schema_answers').insert(round.map(zone_id => ({ schema_id: s.id, zone_id, reussie })));
    if (error && !gone) say("Une réponse n'a pas été enregistrée. Vérifie ta connexion.", true);
  }

  async function removeSchema() {
    const s = schema();
    if (!s) return;
    if (armed !== s.id) {
      armed = s.id;
      removeBtn.textContent = `Supprimer « ${s.titre.slice(0, 40)} » ? Appuie encore`;
      setTimeout(() => { if (armed === s.id) { armed = null; removeBtn.textContent = 'Supprimer ce schéma'; } }, 4000);
      return;
    }
    armed = null;
    removeBtn.textContent = 'Supprimer ce schéma';
    const { error } = await sb.from('study_schemas').delete().eq('id', s.id);
    if (error) { say("La suppression n'a pas abouti.", true); return; }
    store.remove([pathOf(s)]);
    schemas = schemas.filter(x => x !== s);
    current = schemas.at(-1)?.id ?? null;
    persist();
    say(`« ${s.titre} » est supprimé.`);
    setMode('view');
  }

  // Depuis le Cahier : « Faire un schéma de cette page » sur un cours PDF.
  async function fromPdf(d) {
    mode = 'new';
    draw();
    say('Préparation de la page…');
    try {
      const { data: blob, error } = await sb.storage.from('cours').download(`${user.id}/${d.course}/original.pdf`);
      if (error || !blob) throw new Error('pdf');
      const png = await schemaPdfPage(blob, d.page);
      if (gone) return;
      say('');
      drawNew({ blob: png, titre: `${d.title} · page ${d.page + 1}`.slice(0, SCHEMAS.titre), deck: d.deck, course: d.course, page: d.page });
    } catch { if (!gone) say("Cette page n'a pas pu être préparée. Vérifie ta connexion.", true); }
  }
  const onPage = e => { e.detail.found = true; box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); if (state !== 'ready') pending = e.detail; else fromPdf(e.detail); };

  pick.onchange = () => { current = pick.value; persist(); setMode('view'); };
  document.addEventListener('renzvi:schema', onPage);
  load();
  return () => {
    gone = true;
    document.removeEventListener('renzvi:schema', onPage);
    for (const u of urls.values()) URL.revokeObjectURL(u);
  };
}
