// Chill C3 : Atelier de dessin et Coloriage. Un même moteur de création :
// palette, historique borné (annuler / rétablir), export PNG, envoi au tableau d'inspiration, vue agrandie.
// Dessin : image de 1600 x 1200 px quelle que soit la taille du widget, donc nette et jamais déformée au redimensionnement.
// Enregistré en PNG dans le stockage privé « dessins » (12 au plus), quelques secondes après le dernier trait.
// Coloriage : des dessins SVG en zones, créés pour ce prototype ; seules les couleurs choisies sont enregistrées.
// Utilise el, button (dashboard.html) et chillAgrandir, chillJpeg, chillVersInspiration, chillTelecharger (chill.js).

const ATELIER = {
  W: 1600, H: 1200,
  HISTORY: 40, // au-delà, les plus anciens traits sont fixés dans l'image : la mémoire reste bornée
  MAX_POINTS: 3000,
  SAVE_DELAY: 2500,
  MAX_DRAWINGS: 12,
  MAX_BYTES: 1572864,
  COLORS: ['#1f201d', '#55565c', '#ffffff', '#d6453d', '#e8892c', '#f0c93a', '#4f9a52', '#2f8f87', '#3b6fb6', '#7a55a8', '#c9658f', '#8a5a3b'],
  SIZES: [['Fin', 6], ['Moyen', 14], ['Épais', 30], ['Très épais', 60]],
};
const atelierColor = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

// Historique borné, partagé par le dessin et le coloriage. onDrop reçoit les actions trop anciennes.
function atelierHistory(limit, onDrop) {
  let done = [], undone = [];
  return {
    push(op) { done.push(op); undone = []; while (done.length > limit) onDrop?.(done.shift()); },
    undo() { const op = done.pop(); if (op) undone.push(op); return op; },
    redo() { const op = undone.pop(); if (op) done.push(op); return op; },
    ops: () => done,
    canUndo: () => done.length > 0,
    canRedo: () => undone.length > 0,
    reset() { done = []; undone = []; },
  };
}

// Palette : couleurs, plus un choix libre.
function atelierPalette(initial, onPick) {
  const box = el('div', 'atelier-colors');
  box.setAttribute('role', 'group');
  box.ariaLabel = 'Couleur';
  let current = initial;
  const mark = () => { for (const b of box.querySelectorAll('button')) b.setAttribute('aria-pressed', b.dataset.c === current); };
  for (const c of ATELIER.COLORS) {
    const b = button('atelier-swatch', '', () => { current = c; mark(); onPick(c); });
    b.dataset.c = c;
    b.style.setProperty('--c', c);
    b.ariaLabel = `Couleur ${c}`;
    box.append(b);
  }
  const free = Object.assign(el('input', 'atelier-free'), { type: 'color', value: initial });
  free.ariaLabel = 'Autre couleur';
  free.oninput = () => { current = free.value; mark(); onPick(free.value); };
  box.append(free);
  mark();
  return { box, get: () => current };
}

// Deux temps pour une action qui ferait perdre quelque chose.
function atelierConfirm(label, sure, action, needed = () => true) {
  let timer = null;
  const b = button('ghost', label, () => {
    if (!needed()) return action();
    if (!timer) { b.textContent = sure; timer = setTimeout(() => { timer = null; b.textContent = label; }, 3000); return; }
    clearTimeout(timer);
    timer = null;
    b.textContent = label;
    action();
  });
  return b;
}

// Export et tableau d'inspiration, à partir d'une image (canvas).
function atelierShare(note, getCanvas, name, caption) {
  const exp = button('ghost', 'Exporter en PNG', async () => {
    const c = await getCanvas();
    c.toBlob(blob => blob ? chillTelecharger(blob, `${name}.png`) : null, 'image/png');
  });
  const insp = button('ghost', "Ajouter à l'inspiration", async () => {
    insp.disabled = true;
    note.textContent = 'Envoi…';
    try {
      const blob = await chillJpeg(await getCanvas());
      const r = blob ? await chillVersInspiration(blob, caption) : { ok: false, why: 'format' };
      note.textContent = r.ok ? "Ajouté à ton tableau d'inspiration." : CHILL_INSP_ERREUR[r.why] ?? CHILL_INSP_ERREUR.envoi;
    } catch (e) { console.error(e); note.textContent = CHILL_INSP_ERREUR.envoi; }
    insp.disabled = false;
  });
  return [exp, insp];
}

function atelierDrawStroke(g, op) {
  const p = op.pts;
  g.save();
  g.lineCap = g.lineJoin = 'round';
  g.strokeStyle = g.fillStyle = op.eraser ? '#ffffff' : op.color;
  for (const mirror of op.sym ? [false, true] : [false]) {
    const X = i => mirror ? ATELIER.W - p[i] : p[i];
    if (p.length <= 3) { g.beginPath(); g.arc(X(0), p[1], p[2] / 2, 0, Math.PI * 2); g.fill(); continue; }
    for (let i = 3; i < p.length; i += 3) {
      g.lineWidth = p[i + 2];
      g.beginPath();
      g.moveTo(X(i - 3), p[i - 2]);
      g.lineTo(X(i), p[i + 1]);
      g.stroke();
    }
  }
  g.restore();
}

// Une surface de dessin réutilisable (atelier, « J'ai cinq minutes »). Ne sait rien du stockage.
function atelierSurface({ onChange } = {}) {
  const { W, H } = ATELIER;
  const paper = Object.assign(el('canvas', 'atelier-paper'), { width: W, height: H });
  paper.setAttribute('role', 'img');
  paper.ariaLabel = 'Zone de dessin';
  const g = paper.getContext('2d');
  const base = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const bg = base.getContext('2d');
  const blank = c => { c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); };
  blank(bg);
  let baseUsed = false;
  const history = atelierHistory(ATELIER.HISTORY, op => { apply(bg, op); baseUsed = true; });
  const tool = { color: ATELIER.COLORS[0], size: ATELIER.SIZES[1][1], eraser: false, sym: false };
  let stroke = null, locked = false;
  function apply(c, op) { if (op.type === 'clear') blank(c); else atelierDrawStroke(c, op); }
  function render() {
    g.drawImage(base, 0, 0);
    for (const op of history.ops()) apply(g, op);
  }
  render();
  const point = e => {
    const r = paper.getBoundingClientRect();
    const k = e.pointerType === 'pen' && e.pressure > 0 ? .4 + e.pressure * 1.2 : 1;
    return [Math.round((e.clientX - r.left) * W / r.width * 10) / 10, Math.round((e.clientY - r.top) * H / r.height * 10) / 10, Math.round(tool.size * k * 10) / 10];
  };
  paper.onpointerdown = e => {
    if (locked || e.button > 0 || stroke) return;
    e.preventDefault();
    paper.setPointerCapture(e.pointerId);
    stroke = { type: 'stroke', color: tool.color, eraser: tool.eraser, sym: tool.sym, pts: point(e), id: e.pointerId };
    atelierDrawStroke(g, stroke);
  };
  paper.onpointermove = e => {
    if (!stroke || e.pointerId !== stroke.id) return;
    for (const ev of e.getCoalescedEvents?.() ?? [e]) {
      if (stroke.pts.length >= ATELIER.MAX_POINTS * 3) break;
      const p = point(ev), q = stroke.pts;
      atelierDrawStroke(g, { ...stroke, pts: [q[q.length - 3], q[q.length - 2], q[q.length - 1], ...p] });
      q.push(...p);
    }
  };
  const end = e => {
    if (!stroke || e.pointerId !== stroke.id) return;
    const op = { type: 'stroke', color: stroke.color, eraser: stroke.eraser, sym: stroke.sym, pts: stroke.pts };
    stroke = null;
    history.push(op);
    onChange?.();
  };
  paper.onpointerup = end;
  paper.onpointercancel = end;
  return {
    paper, tool,
    has: () => baseUsed || history.ops().length > 0,
    undo() { if (history.undo()) { render(); onChange?.(); } },
    redo() { if (history.redo()) { render(); onChange?.(); } },
    canUndo: history.canUndo, canRedo: history.canRedo,
    clear() { history.push({ type: 'clear' }); render(); onChange?.(); },
    // Repart d'une image (dessin enregistré) ou d'une feuille blanche.
    load(image) { blank(bg); if (image) bg.drawImage(image, 0, 0, W, H); baseUsed = !!image; history.reset(); render(); },
    lock(on) { locked = on; paper.classList.toggle('locked', on); },
  };
}

function atelierTools(surface, refresh) {
  const tools = el('div', 'atelier-tools');
  const palette = atelierPalette(surface.tool.color, c => { surface.tool.color = c; surface.tool.eraser = false; markTool(); });
  const sizes = el('div', 'choices');
  sizes.setAttribute('role', 'group');
  sizes.ariaLabel = 'Taille du pinceau';
  for (const [name, px] of ATELIER.SIZES) {
    const b = button('', name, () => { surface.tool.size = px; for (const c of sizes.children) c.setAttribute('aria-pressed', c === b); });
    b.setAttribute('aria-pressed', px === surface.tool.size);
    sizes.append(b);
  }
  const mode = el('div', 'choices');
  mode.setAttribute('role', 'group');
  mode.ariaLabel = 'Outil';
  const brush = button('', 'Pinceau', () => { surface.tool.eraser = false; markTool(); });
  const eraser = button('', 'Gomme', () => { surface.tool.eraser = true; markTool(); });
  mode.append(brush, eraser);
  const sym = button('ghost', 'Symétrie', () => { surface.tool.sym = !surface.tool.sym; sym.setAttribute('aria-pressed', surface.tool.sym); });
  sym.setAttribute('aria-pressed', false);
  const undo = button('ghost', 'Annuler', () => surface.undo());
  const redo = button('ghost', 'Rétablir', () => surface.redo());
  function markTool() { brush.setAttribute('aria-pressed', !surface.tool.eraser); eraser.setAttribute('aria-pressed', surface.tool.eraser); }
  markTool();
  const row = el('div', 'atelier-row');
  row.append(mode, sym, undo, redo);
  tools.append(palette.box, sizes, row);
  const sync = () => { undo.disabled = !surface.canUndo(); redo.disabled = !surface.canRedo(); refresh?.(); };
  // Ctrl+Z / Ctrl+Maj+Z / Ctrl+Y quand le focus est dans l'atelier.
  const keys = e => {
    if (!(e.ctrlKey || e.metaKey) || e.target.closest('input,textarea,select')) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); surface.undo(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); surface.redo(); }
  };
  return { tools, sync, keys };
}

function dessinWidget({ body, meta, data, save, sb, user }) {
  const valid = i => Number.isInteger(i?.slot) && i.slot >= 1 && i.slot <= ATELIER.MAX_DRAWINGS;
  let items = [];
  for (const i of Array.isArray(data?.items) ? data.items : []) if (valid(i) && !items.some(x => x.slot === i.slot)) items.push({ slot: i.slot, at: Number.isFinite(i.at) ? i.at : 0 });
  let current = items.some(i => i.slot === data?.current) ? data.current : items.at(-1)?.slot ?? null;
  let dirty = false, timer = null, saving = null, gone = false, state = 'ready', dialog = null;
  const pathOf = slot => `${user.id}/${slot}.png`;
  const store = () => sb.storage.from('dessins');
  const persist = () => save({ items, current });

  const root = el('div', 'atelier');
  const status = el('p', 'zone atelier-status');
  status.setAttribute('role', 'status');
  const note = el('p', 'zone');
  note.setAttribute('aria-live', 'polite');
  const surface = atelierSurface({ onChange: () => { dirty = true; ui.sync(); later(); } });
  const ui = atelierTools(surface, () => draw());
  const stage = el('div', 'atelier-stage');
  const veil = el('div', 'atelier-veil');
  veil.hidden = true;
  stage.append(surface.paper, veil);
  const pick = el('select', 'atelier-pick');
  pick.ariaLabel = 'Mes dessins';
  pick.onchange = () => open(Number(pick.value));
  const fresh = button('ghost', 'Nouveau dessin', () => open(null));
  const clear = atelierConfirm('Effacer', 'Vraiment tout effacer ?', () => surface.clear(), () => surface.has());
  const del = atelierConfirm('Supprimer ce dessin', 'Vraiment supprimer ?', remove);
  const big = button('ghost', 'Agrandir', () => { dialog = chillAgrandir('Atelier de dessin', root, () => { dialog = null; }); });
  big.classList.add('atelier-open');
  const share = atelierShare(note, () => surface.paper, 'renzvi-dessin', 'Dessin');
  const files = el('div', 'atelier-row');
  files.append(pick, fresh, clear, del, ...share);
  root.append(ui.tools, stage, files, status, note);
  root.addEventListener('keydown', ui.keys);

  function draw() {
    const n = items.length;
    meta.textContent = n ? `${n} / ${ATELIER.MAX_DRAWINGS}` : '';
    pick.replaceChildren(...items.map((it, k) => Object.assign(el('option', '', `Dessin ${k + 1}${it.at ? ` · ${new Date(it.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : ''}`), { value: it.slot })));
    if (current === null) pick.append(Object.assign(el('option', '', 'Nouveau dessin (pas encore enregistré)'), { value: '' }));
    pick.value = current ?? '';
    pick.hidden = !n;
    del.hidden = current === null;
    fresh.disabled = n >= ATELIER.MAX_DRAWINGS && current !== null;
  }
  function setStatus(text) { status.textContent = text; }
  function later() { clearTimeout(timer); setStatus('Modifications en cours…'); timer = setTimeout(flush, ATELIER.SAVE_DELAY); }
  // Un envoi à la fois ; le dessin n'est envoyé que s'il a changé.
  async function flush() {
    clearTimeout(timer);
    if (saving) return saving;
    if (!dirty || state !== 'ready') return true;
    saving = (async () => {
      let slot = current;
      if (slot === null) {
        slot = Array.from({ length: ATELIER.MAX_DRAWINGS }, (_, k) => k + 1).find(s => !items.some(i => i.slot === s));
        if (!slot) { setStatus(`Tu as déjà ${ATELIER.MAX_DRAWINGS} dessins : supprimes-en un pour garder celui-ci.`); return false; }
      }
      dirty = false;
      setStatus('Enregistrement…');
      const blob = await new Promise(r => surface.paper.toBlob(r, 'image/png'));
      if (!blob || blob.size > ATELIER.MAX_BYTES) { dirty = true; setStatus('Ce dessin est trop lourd pour être enregistré. Exporte-le en PNG pour le garder.'); return false; }
      const { error } = await store().upload(pathOf(slot), blob, { upsert: true, contentType: 'image/png', cacheControl: '0' });
      if (error) { dirty = true; setStatus("Pas encore enregistré. Nouvel essai au prochain trait, ou touche Réessayer."); retry.hidden = false; return false; }
      retry.hidden = true;
      const at = Date.now();
      items = items.some(i => i.slot === slot) ? items.map(i => i.slot === slot ? { ...i, at } : i) : [...items, { slot, at }];
      current = slot;
      persist();
      if (!gone) { draw(); setStatus('Enregistré'); }
      return true;
    })().finally(() => { saving = null; });
    return saving;
  }
  const retry = button('ghost', 'Réessayer', () => { retry.hidden = true; flush(); });
  retry.hidden = true;
  files.append(retry);

  async function open(slot) {
    if (dirty && !(await flush())) { setStatus("Le dessin en cours n'est pas enregistré : réessaie avant d'en ouvrir un autre."); draw(); return; }
    if (slot === null && items.length >= ATELIER.MAX_DRAWINGS) { setStatus(`Tu as déjà ${ATELIER.MAX_DRAWINGS} dessins : supprimes-en un pour en commencer un autre.`); return; }
    current = slot;
    persist();
    await load();
  }
  // Tant qu'un dessin enregistré n'est pas chargé, on ne dessine pas dessus : l'enregistrer écraserait l'original.
  async function load() {
    draw();
    if (current === null) { surface.load(null); surface.lock(false); veil.hidden = true; state = 'ready'; setStatus(''); ui.sync(); return; }
    state = 'loading';
    surface.lock(true);
    veil.hidden = false;
    veil.replaceChildren(el('p', '', 'Chargement du dessin…'));
    const slot = current;
    const { data: blob, error } = await store().download(pathOf(slot));
    if (gone || slot !== current) return;
    let image = null;
    try { if (!error && blob) image = await createImageBitmap(blob); } catch {}
    if (!image) {
      state = 'error';
      veil.replaceChildren(el('p', 'msg', "Ce dessin n'a pas pu se charger."), button('ghost', 'Réessayer', load), button('ghost', 'Nouveau dessin', () => open(null)));
      return;
    }
    surface.load(image);
    image.close?.();
    state = 'ready';
    surface.lock(false);
    veil.hidden = true;
    setStatus('');
    ui.sync();
  }
  async function remove() {
    const slot = current;
    clearTimeout(timer);
    dirty = false;
    if (slot !== null) {
      const { error } = await store().remove([pathOf(slot)]);
      if (error) { setStatus("La suppression n'a pas abouti. Réessaie."); return; }
      items = items.filter(i => i.slot !== slot);
    }
    current = items.at(-1)?.slot ?? null;
    persist();
    await load();
    setStatus('Dessin supprimé.');
  }
  const hide = () => { if (document.hidden) flush(); };
  addEventListener('visibilitychange', hide);
  body.append(root, big);
  ui.sync();
  load();
  return () => { gone = true; removeEventListener('visibilitychange', hide); dialog?.close(); flush(); };
}

// --- Coloriage ---
// Chaque dessin : une liste de formes. Toutes sont des zones à colorier, sauf celles marquées « trait ».
const COLORIAGES = [
  { id: 'maison', name: 'La maison', shapes: [
    ['rect', { x: 0, y: 0, width: 400, height: 210 }], ['circle', { cx: 330, cy: 60, r: 30 }],
    ['rect', { x: 0, y: 210, width: 400, height: 90 }], ['path', { d: 'M150 300 L170 210 L190 210 L180 300Z' }],
    ['rect', { x: 90, y: 120, width: 160, height: 100 }], ['path', { d: 'M75 125 L170 55 L265 125Z' }],
    ['rect', { x: 215, y: 60, width: 22, height: 45 }], ['rect', { x: 155, y: 160, width: 32, height: 60 }],
    ['rect', { x: 105, y: 140, width: 34, height: 30 }], ['rect', { x: 203, y: 140, width: 34, height: 30 }],
    ['rect', { x: 312, y: 170, width: 14, height: 50 }], ['circle', { cx: 319, cy: 145, r: 36 }],
  ] },
  { id: 'poisson', name: 'Le poisson', shapes: [
    ['rect', { x: 0, y: 0, width: 400, height: 300 }], ['path', { d: 'M40 300 Q20 240 50 200 Q70 240 60 300Z' }],
    ['path', { d: 'M350 300 Q330 230 365 190 Q385 240 372 300Z' }], ['path', { d: 'M270 150 L350 95 L335 150 L350 205Z' }],
    ['ellipse', { cx: 190, cy: 150, rx: 100, ry: 62 }], ['path', { d: 'M160 92 Q190 50 230 95Z' }],
    ['path', { d: 'M150 93 Q140 150 150 207 L170 211 Q160 150 172 89Z' }], ['path', { d: 'M205 90 Q195 150 205 211 L225 207 Q215 150 227 93Z' }],
    ['circle', { cx: 115, cy: 135, r: 11 }], ['circle', { cx: 300, cy: 60, r: 10 }],
    ['circle', { cx: 320, cy: 30, r: 7 }], ['circle', { cx: 60, cy: 50, r: 12 }],
  ] },
  { id: 'fleur', name: 'La fleur', shapes: [
    ['rect', { x: 0, y: 0, width: 400, height: 300 }], ['path', { d: 'M150 230 L250 230 L235 295 L165 295Z' }],
    ['rect', { x: 140, y: 218, width: 120, height: 16, rx: 4 }], ['path', { d: 'M195 218 L195 140 L205 140 L205 218Z' }],
    ['path', { d: 'M200 200 Q150 190 135 160 Q180 160 200 190Z' }], ['path', { d: 'M200 185 Q250 175 265 145 Q220 145 200 175Z' }],
    ...[0, 60, 120, 180, 240, 300].map(a => ['ellipse', { cx: 200, cy: 70, rx: 18, ry: 34, transform: `rotate(${a} 200 105)` }]),
    ['circle', { cx: 200, cy: 105, r: 22 }],
  ] },
  { id: 'mandala', name: 'Le mandala', shapes: [
    ['rect', { x: 0, y: 0, width: 400, height: 300 }], ['circle', { cx: 200, cy: 150, r: 135 }], ['circle', { cx: 200, cy: 150, r: 118 }],
    ...[0, 45, 90, 135, 180, 225, 270, 315].map(a => ['ellipse', { cx: 200, cy: 62, rx: 20, ry: 40, transform: `rotate(${a} 200 150)` }]),
    ...[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map(a => ['ellipse', { cx: 200, cy: 92, rx: 12, ry: 26, transform: `rotate(${a} 200 150)` }]),
    ['circle', { cx: 200, cy: 150, r: 34 }], ['circle', { cx: 200, cy: 150, r: 14 }],
  ] },
];
const coloriageZones = pic => pic.shapes.map((_, i) => `z${i}`);
// Les couleurs enregistrées, nettoyées : dessin connu, zone connue, couleur #rrggbb.
function coloriageClean(data) {
  const fills = {};
  for (const pic of COLORIAGES) {
    const raw = data?.fills?.[pic.id], zones = coloriageZones(pic), out = {};
    if (raw && typeof raw === 'object') for (const z of zones) if (atelierColor(raw[z])) out[z] = raw[z].toLowerCase();
    if (Object.keys(out).length) fills[pic.id] = out;
  }
  return { pic: COLORIAGES.some(p => p.id === data?.pic) ? data.pic : COLORIAGES[0].id, fills };
}
function coloriageSvg(pic, fills, width) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 400 300');
  if (width) { svg.setAttribute('width', width); svg.setAttribute('height', width * .75); }
  svg.setAttribute('xmlns', NS);
  pic.shapes.forEach(([tag, attrs], i) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    n.setAttribute('fill', fills[`z${i}`] ?? '#ffffff');
    n.setAttribute('stroke', '#1f201d');
    n.setAttribute('stroke-width', '2.5');
    n.setAttribute('stroke-linejoin', 'round');
    n.dataset.z = `z${i}`;
    svg.append(n);
  });
  return svg;
}
async function coloriageCanvas(pic, fills) {
  const svg = coloriageSvg(pic, fills, 1600);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: 1600, height: 1200 });
    c.getContext('2d').drawImage(img, 0, 0, 1600, 1200);
    return c;
  } finally { URL.revokeObjectURL(url); }
}

function coloriageWidget({ body, meta, data, save }) {
  let state = coloriageClean(data), dialog = null;
  let color = ATELIER.COLORS[3];
  const history = atelierHistory(60);
  const root = el('div', 'atelier coloriage');
  const note = el('p', 'zone');
  note.setAttribute('aria-live', 'polite');
  const picks = el('div', 'choices');
  picks.setAttribute('role', 'group');
  picks.ariaLabel = 'Dessin à colorier';
  const stage = el('div', 'coloriage-stage');
  const palette = atelierPalette(color, c => { color = c; });
  const undo = button('ghost', 'Annuler', () => { const op = history.undo(); if (op) setMany(op.before); });
  const redo = button('ghost', 'Rétablir', () => { const op = history.redo(); if (op) setMany(op.after); });
  const pic = () => COLORIAGES.find(p => p.id === state.pic);
  const fills = () => state.fills[state.pic] ?? {};
  const clear = atelierConfirm('Tout effacer', 'Vraiment tout effacer ?', () => {
    const before = { ...fills() };
    history.push({ before, after: {} });
    setMany({});
  }, () => Object.keys(fills()).length > 0);
  const big = button('ghost', 'Agrandir', () => { dialog = chillAgrandir('Coloriage', root, () => { dialog = null; }); });
  big.classList.add('atelier-open');
  const share = atelierShare(note, () => coloriageCanvas(pic(), fills()), `renzvi-coloriage-${state.pic}`, pic().name);
  const row = el('div', 'atelier-row');
  row.append(undo, redo, clear, ...share);
  const tools = el('div', 'atelier-tools');
  tools.append(picks, palette.box, row);
  root.append(tools, stage, note);
  root.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo.click(); } else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo.click(); }
  });

  function setMany(next) {
    state = { ...state, fills: { ...state.fills, [state.pic]: { ...next } } };
    if (!Object.keys(next).length) delete state.fills[state.pic];
    save(state);
    draw();
  }
  function fillZone(z) {
    const before = { ...fills() };
    if (before[z] === color) return;
    const after = { ...before, [z]: color };
    history.push({ before, after });
    setMany(after);
  }
  function draw() {
    picks.replaceChildren(...COLORIAGES.map(p => {
      const b = button('', p.name.replace(/^L[ae] /, '').replace(/^./, c => c.toUpperCase()), () => { if (p.id !== state.pic) { state = { ...state, pic: p.id }; history.reset(); save(state); draw(); } });
      b.setAttribute('aria-pressed', p.id === state.pic);
      return b;
    }));
    const svg = coloriageSvg(pic(), fills());
    svg.classList.add('coloriage-svg');
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', `${pic().name} : choisis une couleur, puis touche une zone`);
    svg.querySelectorAll('[data-z]').forEach((n, i) => {
      n.setAttribute('tabindex', '0');
      n.setAttribute('role', 'button');
      n.setAttribute('aria-label', `Zone ${i + 1}`);
      n.addEventListener('click', () => fillZone(n.dataset.z));
      n.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fillZone(n.dataset.z); } });
    });
    const focused = document.activeElement?.dataset?.z;
    stage.replaceChildren(svg);
    if (focused) svg.querySelector(`[data-z="${focused}"]`)?.focus();
    undo.disabled = !history.canUndo();
    redo.disabled = !history.canRedo();
    const n = Object.keys(fills()).length;
    meta.textContent = n ? `${n} / ${pic().shapes.length} zones` : '';
  }
  draw();
  body.append(root, big);
  return () => dialog?.close();
}

if (typeof module !== 'undefined') module.exports = { atelierHistory, coloriageClean, COLORIAGES, ATELIER };
