// Chill C2 : Mon petit jardin. Un petit jeu calme : on plante, on arrose, on regarde pousser.
// Règles : la croissance se calcule à partir du temps écoulé (aucune minuterie qui tourne), elle est plafonnée,
// rien ne meurt ni ne fane pendant une absence, pas de série ni de monnaie. L'arrosage ajoute un peu de croissance,
// au plus une fois toutes les 6 heures par plante : cliquer mille fois ne sert à rien.
// Logique pure (jardinClean, jardinGrowth…) séparée du rendu (jardinWidget) : le design pourra changer sans y toucher.
// Illustrations provisoires en SVG, dessinées pour ce prototype.

const JARDIN = {
  PLOTS: 6,
  DECOR_SLOTS: 3,
  HOUR: 3600000,
  MAX: 72, // heures de croissance pour fleurir : 3 jours sans rien faire, moins si on arrose
  WATER_BONUS: 6, // un arrosage = 6 heures de croissance offertes
  WATER_EVERY: 6, // heures entre deux arrosages d'une même plante
  STAGES: [0, 6, 24, 48, 72],
  STAGE_NAMES: ['Graine', 'Pousse', 'Jeune plante', 'Boutons', 'En fleur'],
  SPECIES: [
    { id: 'tournesol', name: 'Tournesol', petal: '#e8b62c', heart: '#6b4a1f' },
    { id: 'lavande', name: 'Lavande', petal: '#8f7cc8', heart: '#6a58a8' },
    { id: 'tulipe', name: 'Tulipe', petal: '#de5f57', heart: '#b8423c' },
    { id: 'fougere', name: 'Fougère', petal: null, heart: null, last: 'Déployée' },
  ],
  // Débloqués doucement par les fleurs cueillies, sans rien à acheter.
  DECOR: [
    { id: 'pot', name: 'Pot en terre', need: 0 },
    { id: 'galets', name: 'Galets', need: 0 },
    { id: 'lanterne', name: 'Lanterne', need: 1 },
    { id: 'arrosoir', name: 'Arrosoir', need: 2 },
    { id: 'banc', name: 'Petit banc', need: 3 },
    { id: 'nichoir', name: 'Nichoir', need: 5 },
  ],
};

// Données lues de la base ou du navigateur : on ne garde que ce qui est valide. Une date dans le futur est ramenée à maintenant.
function jardinClean(data, now) {
  const time = t => Number.isFinite(t) && t > 0 ? Math.min(t, now) : null;
  const plots = Array.from({ length: JARDIN.PLOTS }, (_, i) => {
    const p = Array.isArray(data?.plots) ? data.plots[i] : null;
    const t = time(p?.t);
    if (!p || !JARDIN.SPECIES.some(s => s.id === p.s) || t === null) return null;
    const lw = time(p.lw);
    return { s: p.s, t, w: Number.isInteger(p.w) && p.w >= 0 ? Math.min(p.w, 100) : 0, lw: lw !== null && lw >= t ? lw : null };
  });
  const decor = Array.from({ length: JARDIN.DECOR_SLOTS }, (_, i) => {
    const d = Array.isArray(data?.decor) ? data.decor[i] : null;
    return JARDIN.DECOR.some(x => x.id === d) ? d : null;
  });
  const blooms = Number.isInteger(data?.blooms) && data.blooms >= 0 ? Math.min(data.blooms, 9999) : 0;
  return { v: 1, plots, decor, blooms };
}

// Heures de croissance : le temps passé depuis la plantation, plus les arrosages, plafonné.
function jardinGrowth(p, now) {
  if (!p) return 0;
  const hours = Math.max(0, now - p.t) / JARDIN.HOUR;
  return Math.min(JARDIN.MAX, hours + p.w * JARDIN.WATER_BONUS);
}
function jardinStage(p, now) {
  const g = jardinGrowth(p, now);
  let stage = 0;
  JARDIN.STAGES.forEach((min, i) => { if (g >= min) stage = i; });
  return stage;
}
// Millisecondes avant de pouvoir arroser à nouveau (0 : possible maintenant).
function jardinWaitWater(p, now) {
  if (!p || jardinStage(p, now) === JARDIN.STAGES.length - 1) return Infinity;
  return p.lw === null ? 0 : Math.max(0, p.lw + JARDIN.WATER_EVERY * JARDIN.HOUR - now);
}
function jardinWater(p, now) {
  return jardinWaitWater(p, now) === 0 ? { ...p, w: p.w + 1, lw: now } : null;
}
const jardinUnlocked = blooms => JARDIN.DECOR.filter(d => blooms >= d.need);

// --- Rendu (navigateur seulement) ---

function jardinPlantSvg(species, stage) {
  const sp = JARDIN.SPECIES.find(s => s.id === species);
  const soil = '<ellipse cx="30" cy="74" rx="20" ry="5" fill="var(--jardin-soil)"/>';
  if (stage === 0) return `${soil}<ellipse cx="30" cy="70" rx="7" ry="4" fill="var(--jardin-mound)"/><circle cx="30" cy="67" r="2" fill="var(--jardin-seed)"/>`;
  const h = [0, 14, 30, 42, 50][stage], top = 72 - h, green = 'var(--jardin-leaf)';
  if (sp.id === 'fougere') {
    const fronds = [0, 2, 4, 6, 8][stage];
    let out = soil;
    for (let i = 0; i < fronds; i++) {
      const side = i % 2 ? 1 : -1, len = h * (0.6 + 0.4 * (1 - i / 10)), lean = side * (8 + i * 3);
      out += `<path d="M30 72 Q${30 + lean * .4} ${72 - len * .6} ${30 + lean} ${72 - len}" stroke="${green}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
      for (let k = 1; k < 4; k++) out += `<ellipse cx="${30 + lean * k / 4}" cy="${72 - len * k / 4}" rx="3.2" ry="1.6" fill="${green}" transform="rotate(${side * 35} ${30 + lean * k / 4} ${72 - len * k / 4})"/>`;
    }
    return out;
  }
  let out = `${soil}<path d="M30 72 L30 ${top}" stroke="${green}" stroke-width="2.5" stroke-linecap="round"/>`;
  const leaves = Math.min(stage, 3);
  for (let i = 0; i < leaves; i++) {
    const y = 68 - i * (h / 4), side = i % 2 ? 1 : -1;
    out += `<ellipse cx="${30 + side * 6}" cy="${y}" rx="6" ry="2.6" fill="${green}" transform="rotate(${side * -25} ${30 + side * 6} ${y})"/>`;
  }
  if (stage === 3) return `${out}<ellipse cx="30" cy="${top - 3}" rx="3.5" ry="5" fill="${sp.heart}"/>`;
  if (stage < 4) return out;
  if (sp.id === 'tournesol') {
    for (let a = 0; a < 360; a += 30) out += `<ellipse cx="30" cy="${top - 9}" rx="2.6" ry="7" fill="${sp.petal}" transform="rotate(${a} 30 ${top})"/>`;
    return `${out}<circle cx="30" cy="${top}" r="5" fill="${sp.heart}"/>`;
  }
  if (sp.id === 'lavande') {
    for (let i = 0; i < 6; i++) out += `<ellipse cx="${30 + (i % 2 ? 2 : -2)}" cy="${top - i * 3}" rx="2.4" ry="2" fill="${i % 2 ? sp.petal : sp.heart}"/>`;
    return out;
  }
  return `${out}<path d="M23 ${top - 2} Q23 ${top - 14} 26 ${top - 12} L30 ${top - 7} L34 ${top - 12} Q37 ${top - 14} 37 ${top - 2} Q30 ${top + 5} 23 ${top - 2}Z" fill="${sp.petal}"/>`;
}
function jardinDecorSvg(id) {
  const s = {
    pot: '<path d="M18 50 L42 50 L38 74 L22 74Z" fill="var(--jardin-pot)"/><rect x="16" y="46" width="28" height="6" rx="2" fill="var(--jardin-pot-rim)"/>',
    galets: '<ellipse cx="22" cy="70" rx="9" ry="5" fill="#b9b6ae"/><ellipse cx="36" cy="71" rx="7" ry="4" fill="#cfccc4"/><ellipse cx="30" cy="65" rx="6" ry="3.5" fill="#a9a59c"/>',
    lanterne: '<rect x="29" y="30" width="2" height="44" fill="#55565c"/><rect x="23" y="34" width="14" height="16" rx="3" fill="#f3d58a" stroke="#55565c" stroke-width="2"/>',
    arrosoir: '<path d="M18 52 L38 52 L36 72 L20 72Z" fill="#7aa0b8"/><path d="M38 56 L50 46" stroke="#7aa0b8" stroke-width="3"/><path d="M22 52 Q28 40 34 52" stroke="#5f8297" stroke-width="2.5" fill="none"/>',
    banc: '<rect x="10" y="56" width="40" height="5" rx="1.5" fill="#9b6b43"/><rect x="10" y="48" width="40" height="4" rx="1.5" fill="#9b6b43"/><rect x="13" y="61" width="3" height="12" fill="#7a5233"/><rect x="44" y="61" width="3" height="12" fill="#7a5233"/>',
    nichoir: '<rect x="29" y="40" width="2" height="34" fill="#7a5233"/><path d="M20 30 L30 20 L40 30Z" fill="#96401f"/><rect x="22" y="30" width="16" height="14" fill="#c99a6b"/><circle cx="30" cy="36" r="2.6" fill="#3d2a1a"/>',
  }[id] ?? '';
  return s;
}
const jardinSvg = inner => `<svg viewBox="0 0 60 80" aria-hidden="true" focusable="false">${inner}</svg>`;
const jardinDuree = ms => { const h = Math.ceil(ms / JARDIN.HOUR); return h < 2 ? 'moins de 2 h' : `${h} h`; };

function jardinWidget({ body, meta, data, save }) {
  // Labo seulement : avancer l'horloge du jardin pour voir les étapes sans attendre des jours.
  let offset = 0;
  const now = () => Date.now() + offset;
  let state = jardinClean(data, now()), selected = null;
  const persist = () => save(state);
  const live = el('p', 'sr');
  live.setAttribute('aria-live', 'polite');

  const mini = el('div', 'jardin-mini');
  const full = el('div', 'jardin-full');
  const grid = el('div', 'jardin-grid');
  grid.setAttribute('role', 'group');
  grid.ariaLabel = 'Emplacements du jardin';
  const decorRow = el('div', 'jardin-decor');
  decorRow.setAttribute('role', 'group');
  decorRow.ariaLabel = 'Décorations';
  const panel = el('div', 'jardin-panel');
  const tools = el('div', 'ctrl');
  full.append(grid, decorRow, panel, tools);

  const speciesName = id => JARDIN.SPECIES.find(s => s.id === id).name;
  const stageName = (p, st) => st === 4 && JARDIN.SPECIES.find(s => s.id === p.s).last || JARDIN.STAGE_NAMES[st];
  const say = text => { live.textContent = text; };

  function plotLabel(i) {
    const p = state.plots[i];
    if (!p) return `Emplacement ${i + 1} : libre`;
    return `Emplacement ${i + 1} : ${speciesName(p.s)}, ${stageName(p, jardinStage(p, now())).toLowerCase()}`;
  }
  function drawGrid() {
    const t = now();
    grid.replaceChildren(...state.plots.map((p, i) => {
      const b = button('jardin-plot', '', () => { selected = { kind: 'plot', i }; draw(); });
      b.innerHTML = p ? jardinSvg(jardinPlantSvg(p.s, jardinStage(p, t))) : jardinSvg('<ellipse cx="30" cy="74" rx="20" ry="5" fill="var(--jardin-soil)"/>');
      b.ariaLabel = plotLabel(i);
      b.setAttribute('aria-pressed', selected?.kind === 'plot' && selected.i === i);
      return b;
    }));
    decorRow.replaceChildren(...state.decor.map((d, i) => {
      const b = button('jardin-spot', '', () => { selected = { kind: 'decor', i }; draw(); });
      b.innerHTML = d ? jardinSvg(jardinDecorSvg(d)) : '<span aria-hidden="true">+</span>';
      b.ariaLabel = `Décoration ${i + 1} : ${d ? JARDIN.DECOR.find(x => x.id === d).name : 'vide'}`;
      b.setAttribute('aria-pressed', selected?.kind === 'decor' && selected.i === i);
      return b;
    }));
  }
  function drawPanel() {
    const t = now();
    if (!selected) { panel.replaceChildren(el('p', 'zone', 'Touche un emplacement pour planter, ou une case de décoration.')); return; }
    if (selected.kind === 'decor') {
      const i = selected.i, have = state.decor[i];
      const unlocked = jardinUnlocked(state.blooms);
      const next = JARDIN.DECOR.find(d => d.need > state.blooms);
      const choices = el('div', 'jardin-choices');
      for (const d of unlocked) {
        const b = button('ghost', d.name, () => { state.decor = state.decor.map((x, k) => k === i ? d.id : x); persist(); say(`${d.name} posé.`); draw(); });
        b.setAttribute('aria-pressed', have === d.id);
        choices.append(b);
      }
      if (have) choices.append(button('ghost', 'Retirer', () => { state.decor = state.decor.map((x, k) => k === i ? null : x); persist(); say('Décoration retirée.'); draw(); }));
      panel.replaceChildren(el('p', 'book-title', `Décoration ${i + 1}`), choices,
        el('p', 'zone', next ? `Prochaine décoration (${next.name}) après ${next.need} fleur${next.need > 1 ? 's' : ''} cueillie${next.need > 1 ? 's' : ''}.` : 'Toutes les décorations sont débloquées.'));
      return;
    }
    const i = selected.i, p = state.plots[i];
    if (!p) {
      const choices = el('div', 'jardin-choices');
      for (const s of JARDIN.SPECIES) choices.append(button('ghost', s.name, () => {
        state.plots = state.plots.map((x, k) => k === i ? { s: s.id, t: now(), w: 0, lw: null } : x);
        persist();
        say(`${s.name} plantée.`);
        draw();
      }));
      panel.replaceChildren(el('p', 'book-title', `Emplacement ${i + 1} : que planter ?`), choices);
      return;
    }
    const st = jardinStage(p, t), g = jardinGrowth(p, t), last = JARDIN.STAGES.length - 1;
    const bar = el('div', 'bar'), fill = el('i');
    bar.append(fill);
    fill.style.transform = `scaleX(${g / JARDIN.MAX})`;
    const parts = [el('p', 'book-title', `${speciesName(p.s)} · ${stageName(p, st)}`), bar];
    if (st < last) parts.push(el('p', 'zone', `Encore environ ${jardinDuree((JARDIN.STAGES[st + 1] - g) * JARDIN.HOUR)} avant l'étape « ${stageName(p, st + 1).toLowerCase()} ». Elle pousse même si tu ne passes pas.`));
    else parts.push(el('p', 'zone', 'Elle restera comme ça tant que tu la gardes.'));
    const actions = el('div', 'ctrl');
    if (st < last) {
      const wait = jardinWaitWater(p, t);
      const water = button('primary', 'Arroser', () => {
        const next = jardinWater(state.plots[i], now());
        if (!next) return;
        state.plots = state.plots.map((x, k) => k === i ? next : x);
        persist();
        say(`${speciesName(p.s)} arrosée.`);
        draw();
      });
      water.disabled = wait > 0;
      actions.append(water);
      if (wait > 0) parts.push(el('p', 'zone', `Déjà arrosée. Encore de l'eau possible dans ${jardinDuree(wait)}.`));
    } else {
      actions.append(button('primary', p.s === 'fougere' ? 'Couper une fronde' : 'Cueillir', () => {
        state.plots = state.plots.map((x, k) => k === i ? null : x);
        state.blooms += 1;
        persist();
        const unlocked = JARDIN.DECOR.find(d => d.need === state.blooms);
        say(unlocked ? `Cueillie. Nouvelle décoration : ${unlocked.name}.` : 'Cueillie. L’emplacement est libre.');
        draw();
      }));
    }
    let sure = null;
    const remove = button('ghost', 'Retirer la plante', () => {
      if (!sure) { remove.textContent = 'Vraiment retirer ?'; sure = setTimeout(() => { sure = null; remove.textContent = 'Retirer la plante'; }, 3000); return; }
      clearTimeout(sure);
      state.plots = state.plots.map((x, k) => k === i ? null : x);
      persist();
      say('Plante retirée.');
      draw();
    });
    actions.append(remove);
    panel.replaceChildren(...parts, actions);
  }
  function drawMini() {
    const t = now(), plants = state.plots.filter(Boolean);
    const flowers = plants.filter(p => jardinStage(p, t) === 4).length;
    const row = el('div', 'jardin-mini-row');
    row.innerHTML = plants.length ? plants.slice(0, 4).map(p => jardinSvg(jardinPlantSvg(p.s, jardinStage(p, t)))).join('') : '';
    mini.replaceChildren(row, el('p', 'zone', plants.length ? `${plants.length} plante${plants.length > 1 ? 's' : ''}${flowers ? ` · ${flowers} en fleur` : ''}` : 'Ton jardin attend sa première graine.'), openBtn);
  }
  function draw() {
    state = jardinClean(state, now());
    meta.textContent = state.blooms ? `${state.blooms} fleur${state.blooms > 1 ? 's' : ''} cueillie${state.blooms > 1 ? 's' : ''}` : '';
    drawGrid();
    drawPanel();
    drawMini();
  }
  let dialog = null;
  const openBtn = button('ghost', 'Ouvrir le jardin', () => { dialog = chillAgrandir('Mon petit jardin', full, () => { dialog = null; draw(); }); });
  const big = button('ghost', 'Agrandir', () => openBtn.click());
  big.classList.add('jardin-big-btn');
  tools.append(big);
  if (typeof CHILL_LABO !== 'undefined' && CHILL_LABO) {
    const lab = el('div', 'chill-lab-tools');
    lab.append(el('span', 'zone', 'Labo, horloge :'),
      button('ghost', '+6 h', () => { offset += 6 * JARDIN.HOUR; draw(); }),
      button('ghost', '+1 jour', () => { offset += 24 * JARDIN.HOUR; draw(); }),
      button('ghost', 'Heure réelle', () => { offset = 0; draw(); }));
    full.append(lab);
  }
  // La croissance se recalcule au retour sur la page, jamais en tâche de fond.
  const onShow = () => { if (!document.hidden) draw(); };
  addEventListener('visibilitychange', onShow);
  draw();
  body.append(mini, full, live);
  return () => { removeEventListener('visibilitychange', onShow); dialog?.close(); };
}

if (typeof module !== 'undefined') module.exports = { JARDIN, jardinClean, jardinGrowth, jardinStage, jardinWaitWater, jardinWater, jardinUnlocked };
