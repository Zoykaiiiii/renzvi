// Nutrition N1 à N3 : « Qu'est-ce qu'on mange ? ». Un tirage de recette (Surprends-moi), une recherche
// à partir de ce qu'on a (Avec mon frigo) et une recherche par nom ou ingrédient (Chercher), sur nutrition/recettes.json.
// Catalogue : « Livre de cuisine » de Wikibooks, CC BY-SA 4.0, importé par outils/recettes_wikibooks.py.
// Chaque fiche cite sa page source et la licence (obligation de la licence).
// Aucune IA, aucun appel payant. Le frigo, les favoris et les derniers tirages restent dans l'état privé du widget.
// Les ingrédients sont reconnus par leur nom : un filtre ne garantit ni l'absence d'allergène ni l'absence de traces.
// Utilise el, button (dashboard.html) et chillAgrandir (chill.js).

const REPAS = {
  MAX_FRIGO: 150, MAX_FAV: 100, MAX_RECENT: 20,
  // Jamais supposés disponibles sans la case « J'ai toujours… » (cochée par la personne).
  BASE: ['sel', 'poivre', 'huile', "huile d'olive", 'huile de tournesol', "huile d'arachide", 'eau'],
  TYPES: [['', 'Tous les plats'], ['plat', 'Plat'], ['entree', 'Entrée, soupe, salade'], ['dessert', 'Dessert'], ['accompagnement', 'Accompagnement, sauce']],
  REGIMES: [[0, 'Tout'], [1, 'Végétarien'], [2, 'Végétalien']],
};

// Même normalisation que l'import (outils/recettes_wikibooks.py, fonction cle), sans les accents pour comparer.
function repasCle(nom) {
  let s = String(nom ?? '').toLowerCase().replace(/’/g, "'").trim().replace(/^[\s.,:;*]+|[\s.,:;*]+$/g, '');
  s = s.replace(/^(?:(?:de la|des|du|de|la|le|les|un|une)\s+|de l'|d'|l')/, '').replace(/\s*\(.*$/, '').replace(/\s+/g, ' ').trim();
  s = s.split(' ').map(m => m.length > 3 && /[sx]$/.test(m) && !/(ss|us|is|as|os|ix)$/.test(m) ? m.slice(0, -1) : m).join(' ');
  return repasSans(s);
}
// Sans accents ni ligatures : « oeuf » tapé au clavier retrouve « œuf ».
function repasSans(s) { return s.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

function repasClean(data) {
  const ids = (v, n) => Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string' && x.length <= 120))].slice(0, n) : [];
  const f = data?.f ?? {};
  return {
    tab: ['roulette', 'frigo', 'chercher', 'favoris'].includes(data?.tab) ? data.tab : 'roulette',
    f: { ty: REPAS.TYPES.some(t => t[0] === f.ty) ? f.ty : '', veg: [0, 1, 2].includes(f.veg) ? f.veg : 0, o: typeof f.o === 'string' ? f.o.slice(0, 40) : '' },
    frigo: ids(data?.frigo, REPAS.MAX_FRIGO).map(x => x.slice(0, 40)),
    base: data?.base === true,
    fav: ids(data?.fav, REPAS.MAX_FAV),
    recent: ids(data?.recent, REPAS.MAX_RECENT),
  };
}

// Les recettes qui respectent les filtres, avant tout tirage ou classement.
function repasFiltrer(recettes, f) {
  return recettes.filter(r => (!f.ty || r.ty === f.ty) && (!f.veg || (r.veg ?? 0) >= f.veg) && (!f.o || (r.o ?? []).includes(f.o)));
}

// Tirage au hasard, en évitant les derniers tirés tant qu'il reste d'autres choix. null si rien ne correspond.
function repasTirer(pool, recent, rand = Math.random) {
  if (!pool.length) return null;
  for (let n = recent.length; n >= 0; n--) {
    const avoid = new Set(recent.slice(0, n));
    const fresh = pool.filter(r => !avoid.has(r.id));
    if (fresh.length) return fresh[Math.floor(rand() * fresh.length)];
  }
  return pool[0];
}

// Ingrédients requis d'une recette, en clés comparables : les lignes facultatives ne comptent pas.
function repasRequis(r) {
  const out = new Set();
  for (const i of r.ing) if (i.k && !i.f) for (const k of i.k) out.add(repasSans(k));
  return out;
}

// Classement « Avec mon frigo » : d'abord ce qu'on peut faire avec tout, puis ce qui manque d'un, puis de deux.
// Une recette doit utiliser au moins un ingrédient que tu as (sinon ce n'est pas une proposition « avec ton frigo »).
function repasFrigo(recettes, frigo, base, maxManque = 2) {
  const have = new Set(frigo.map(repasCle));
  const staples = new Set(REPAS.BASE.map(repasCle));
  const res = [];
  for (const r of recettes) {
    const req = repasRequis(r);
    let used = 0;
    const manque = [];
    for (const k of req) {
      if (have.has(k)) used++;
      else if (!(base && staples.has(k))) manque.push(k);
    }
    if (used && manque.length <= maxManque) res.push({ r, used, manque });
  }
  return res.sort((a, b) => a.manque.length - b.manque.length || b.used - a.used || a.r.t.localeCompare(b.r.t, 'fr'));
}

// Recherche par mots : chaque mot doit se trouver dans le nom du plat ou dans un ingrédient requis ou facultatif.
// Les plats dont le nom contient tous les mots passent devant.
function repasChercher(recettes, q) {
  const mots = repasSans(String(q ?? '')).split(/[\s,;'’-]+/).filter(m => m.length >= 2).map(repasCle).filter(Boolean).slice(0, 6);
  if (!mots.length) return [];
  const res = [];
  for (const r of recettes) {
    const titre = repasSans(r.t);
    const ings = r.ing.flatMap(i => i.k ?? []).map(repasSans);
    let dansTitre = 0;
    const ok = mots.every(m => titre.includes(m) ? ++dansTitre : ings.some(k => k.includes(m)));
    if (ok) res.push({ r, dansTitre });
  }
  return res.sort((a, b) => b.dansTitre - a.dansTitre || a.r.t.localeCompare(b.r.t, 'fr')).map(x => x.r);
}

const repasSource = r => `https://fr.wikibooks.org/w/index.php?oldid=${encodeURIComponent(r.rev)}`;
const repasPage = r => `https://fr.wikibooks.org/wiki/${encodeURIComponent(`Livre de cuisine/${r.t}`.replace(/ /g, '_'))}`;
const REPAS_TYPE_NOM = Object.fromEntries(REPAS.TYPES.filter(t => t[0]));

let repasCatalogue = null;
function repasCharger() {
  repasCatalogue ??= fetch('nutrition/recettes.json').then(r => {
    if (!r.ok) throw new Error(`catalogue ${r.status}`);
    return r.json();
  }).then(d => {
    const recettes = Array.isArray(d?.recettes) ? d.recettes : [];
    const byId = new Map(recettes.map(r => [r.id, r]));
    // Les noms d'ingrédients proposés à la saisie : ceux qui servent dans au moins deux recettes.
    const freq = new Map();
    for (const r of recettes) for (const i of r.ing) for (const k of i.k ?? []) freq.set(k, (freq.get(k) ?? 0) + 1);
    const noms = [...freq].filter(([, n]) => n >= 2).map(([k]) => k).sort((a, b) => a.localeCompare(b, 'fr'));
    const origines = new Map();
    for (const r of recettes) for (const o of r.o ?? []) origines.set(o, (origines.get(o) ?? 0) + 1);
    return { recettes, byId, noms, origines: [...origines].filter(([, n]) => n >= 3).map(([o]) => o).sort((a, b) => a.localeCompare(b, 'fr')) };
  }).catch(e => { repasCatalogue = null; throw e; });
  return repasCatalogue;
}
function repasStyle() {
  if (document.querySelector('link[data-repas]')) return;
  const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'nutrition/repas.css' });
  link.setAttribute('data-repas', '');
  document.head.append(link);
}

function repasWidget({ body, meta, data, save }) {
  repasStyle();
  let state = repasClean(data), cat = null, gone = false, spin = null, tirage = null, q = '';
  const persist = () => save(state);
  const root = el('div', 'repas');
  const live = el('p', 'sr');
  live.setAttribute('aria-live', 'polite');
  body.append(root, live);
  const reduit = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function load() {
    root.replaceChildren(el('p', 'empty', 'Chargement des recettes…'));
    repasCharger().then(c => { if (!gone) { cat = c; draw(); } }).catch(() => {
      if (gone) return;
      const box = el('div', 'empty');
      box.append(el('p', 'msg', "Les recettes n'ont pas pu se charger. Vérifie ta connexion."), button('ghost', 'Réessayer', load));
      root.replaceChildren(box);
    });
  }

  function select(label, options, value, onChange) {
    const wrap = el('label', 'repas-field');
    const s = el('select');
    for (const [v, t] of options) s.append(Object.assign(el('option', '', t), { value: String(v), selected: String(v) === String(value) }));
    s.onchange = () => onChange(s.value);
    wrap.append(el('span', '', label), s);
    return wrap;
  }
  function filtres() {
    const box = el('div', 'repas-filtres');
    box.append(
      select('Type', REPAS.TYPES, state.f.ty, v => { state.f.ty = v; tirage = null; persist(); draw(); }),
      select('Régime', REPAS.REGIMES, state.f.veg, v => { state.f.veg = Number(v); tirage = null; persist(); draw(); }),
      select('Cuisine', [['', 'Toutes'], ...cat.origines.map(o => [o, o[0].toUpperCase() + o.slice(1)])], state.f.o, v => { state.f.o = v; tirage = null; persist(); draw(); }),
    );
    return box;
  }
  function tabs() {
    const box = el('div', 'choices repas-tabs');
    box.setAttribute('role', 'group');
    box.ariaLabel = 'Choisir comment trouver une recette';
    for (const [id, name] of [['roulette', 'Surprends-moi'], ['frigo', 'Avec mon frigo'], ['chercher', 'Chercher'], ['favoris', `Gardées${state.fav.length ? ` (${state.fav.length})` : ''}`]]) {
      const b = button('', name, () => { state.tab = id; persist(); draw(); root.querySelector('.repas-tabs [aria-pressed=true]')?.focus(); });
      b.setAttribute('aria-pressed', String(state.tab === id));
      box.append(b);
    }
    return box;
  }
  function draw() {
    stopSpin();
    const pool = repasFiltrer(cat.recettes, state.f);
    meta.textContent = state.tab === 'favoris' ? '' : `${pool.length} recettes`;
    const view = { roulette, frigo, chercher }[state.tab]?.(pool) ?? favoris();
    root.replaceChildren(tabs(), ...(state.tab === 'favoris' ? [] : [filtres()]), view, credit());
  }
  const credit = () => {
    const p = el('p', 'repas-credit');
    p.append('Recettes du ', Object.assign(el('a', '', 'Livre de cuisine de Wikibooks'), { href: 'https://fr.wikibooks.org/wiki/Livre_de_cuisine', target: '_blank', rel: 'noopener' }), ', licence ',
      Object.assign(el('a', '', 'CC BY-SA 4.0'), { href: 'https://creativecommons.org/licenses/by-sa/4.0/deed.fr', target: '_blank', rel: 'noopener' }), '.');
    return p;
  };

  // --- Surprends-moi ---
  function stopSpin() { if (spin) { clearTimeout(spin); spin = null; } }
  function roulette(pool) {
    const box = el('div', 'repas-roulette');
    const reel = el('div', 'repas-reel');
    const go = button('primary', tirage ? 'Relancer' : 'Surprends-moi', () => lancer(pool, reel, go, actions));
    const actions = el('div', 'atelier-row');
    if (!pool.length) {
      go.disabled = true;
      reel.append(el('p', 'zone', 'Aucune recette ne correspond à ces filtres. Élargis un filtre pour tirer au sort.'));
    } else if (tirage) montrer(tirage, reel, actions);
    else reel.append(el('p', 'zone', 'Choisis tes filtres, puis laisse Renzvi tirer une recette au hasard.'));
    box.append(reel, go, actions);
    return box;
  }
  function lancer(pool, reel, go, actions) {
    stopSpin();
    const choix = repasTirer(pool, state.recent);
    if (!choix) return;
    state.recent = [choix.id, ...state.recent.filter(id => id !== choix.id)].slice(0, REPAS.MAX_RECENT);
    persist();
    actions.replaceChildren();
    const fin = () => { tirage = choix; go.textContent = 'Relancer'; go.disabled = false; montrer(choix, reel, actions); live.textContent = `Tiré au sort : ${choix.t}.`; };
    if (reduit() || pool.length < 2) return fin();
    // Défilement qui ralentit, puis révélation : la recette est déjà choisie, l'animation ne change rien au tirage.
    go.disabled = true;
    const line = el('p', 'repas-defile');
    line.setAttribute('aria-hidden', 'true');
    reel.replaceChildren(line);
    let step = 0;
    const tick = () => {
      if (gone) return;
      if (step >= 14) { spin = null; return fin(); }
      line.textContent = pool[Math.floor(Math.random() * pool.length)].t;
      spin = setTimeout(tick, 50 + step * step * 2.2);
      step++;
    };
    tick();
  }
  function montrer(r, reel, actions) {
    reel.replaceChildren(el('p', 'book-title', r.t), el('p', 'zone', resume(r)));
    actions.replaceChildren(button('ghost', 'Voir la recette', () => fiche(r)), garder(r));
  }
  const resume = r => [REPAS_TYPE_NOM[r.ty], r.veg === 2 ? 'végétalien' : r.veg === 1 ? 'végétarien' : '', r.o?.length ? `cuisine ${r.o.join(', ')}` : '', r.p ? `pour ${r.p}` : '']
    .filter(Boolean).join(' · ') || `${r.ing.filter(i => i.x).length} ingrédients`;
  function garder(r) {
    const b = button('ghost', '', () => {
      const on = state.fav.includes(r.id);
      if (!on && state.fav.length >= REPAS.MAX_FAV) { live.textContent = `Tu as déjà gardé ${REPAS.MAX_FAV} recettes. Retires-en une d'abord.`; return; }
      state.fav = on ? state.fav.filter(id => id !== r.id) : [r.id, ...state.fav];
      persist();
      sync();
      live.textContent = on ? 'Recette retirée de tes recettes gardées.' : 'Recette gardée.';
      root.querySelector('.repas-tabs button:last-child').textContent = `Gardées${state.fav.length ? ` (${state.fav.length})` : ''}`;
    });
    const sync = () => { const on = state.fav.includes(r.id); b.textContent = on ? 'Gardée' : 'Garder'; b.setAttribute('aria-pressed', String(on)); };
    sync();
    return b;
  }

  // --- Avec mon frigo ---
  function frigo(pool) {
    const box = el('div', 'repas-frigo');
    const form = el('form', 'add');
    const listId = `repas-noms-${Math.random().toString(36).slice(2, 8)}`;
    const input = Object.assign(el('input'), { type: 'text', placeholder: 'Un ingrédient que tu as', maxLength: 40, autocomplete: 'off' });
    input.ariaLabel = 'Ajouter un ingrédient que tu as';
    input.setAttribute('list', listId);
    const dl = el('datalist');
    dl.id = listId;
    dl.append(...cat.noms.map(n => Object.assign(el('option'), { value: n })));
    form.append(input, Object.assign(el('button', 'ghost', 'Ajouter'), { type: 'submit' }), dl);
    const note = el('p', 'note');
    note.hidden = true;
    form.onsubmit = e => {
      e.preventDefault();
      const v = input.value.trim().toLowerCase().slice(0, 40);
      if (!v) return;
      if (state.frigo.length >= REPAS.MAX_FRIGO) { note.textContent = `Ton frigo est plein (${REPAS.MAX_FRIGO} ingrédients).`; note.hidden = false; return; }
      if (!state.frigo.some(x => repasCle(x) === repasCle(v))) state.frigo = [...state.frigo, v];
      persist();
      draw();
      root.querySelector('.repas-frigo input[type=text]')?.focus();
    };
    const chips = el('ul', 'repas-chips');
    chips.ariaLabel = 'Ce que tu as';
    for (const item of state.frigo) {
      const li = el('li');
      const x = button('x', '×', () => { state.frigo = state.frigo.filter(v => v !== item); persist(); draw(); root.querySelector('.repas-frigo input[type=text]')?.focus(); });
      x.ariaLabel = `Retirer ${item}`;
      li.append(el('span', '', item), x);
      chips.append(li);
    }
    const baseLab = el('label', 'repas-base');
    const baseBox = Object.assign(el('input'), { type: 'checkbox', checked: state.base });
    baseBox.onchange = () => { state.base = baseBox.checked; persist(); draw(); root.querySelector('.repas-base input')?.focus(); };
    baseLab.append(baseBox, el('span', '', "J'ai toujours du sel, du poivre, de l'huile et de l'eau"));
    box.append(form, note, ...(state.frigo.length ? [chips] : []), baseLab);
    if (!state.frigo.length) {
      box.append(el('p', 'zone', 'Ajoute ce que tu as dans ton frigo et tes placards : Renzvi te montre ce que tu peux cuisiner.'));
      return box;
    }
    const res = repasFrigo(pool, state.frigo, state.base);
    if (!res.length) {
      box.append(el('p', 'zone', 'Aucune recette ne se fait avec ça, même en ajoutant deux ingrédients. Ajoute d’autres ingrédients ou élargis les filtres.'));
      return box;
    }
    for (const n of [0, 1, 2]) {
      const group = res.filter(x => x.manque.length === n);
      if (!group.length) continue;
      box.append(el('p', 'repas-groupe', n === 0 ? 'Tu as tout' : n === 1 ? 'Il manque un ingrédient' : 'Il manque deux ingrédients'));
      box.append(...lignes(group, x => x.r, x => n ? `Manque : ${x.manque.map(k => nomAffiche(x.r, k)).join(', ')}` : resume(x.r), 5));
    }
    box.append(el('p', 'repas-avert', 'Les ingrédients sont reconnus par leur nom. Vérifie toujours la liste complète, surtout en cas d’allergie.'));
    return box;
  }
  // Liste de recettes affichée par paquets, avec « Voir … de plus ».
  function lignes(items, recetteDe, sousTitre, premier) {
    const ul = el('ul', 'rows repas-liste');
    let shown = 0;
    const more = button('link', '', () => addRows(10));
    const addRows = k => {
      for (const x of items.slice(shown, shown + k)) {
        const li = el('li', 'row');
        const r = recetteDe(x);
        const open = button('repas-ouvrir', '', () => fiche(r));
        open.append(el('span', 'repas-titre', r.t), el('span', 'zone', sousTitre(x)));
        li.append(open);
        ul.append(li);
      }
      shown = Math.min(items.length, shown + k);
      more.hidden = shown >= items.length;
      more.textContent = `Voir ${Math.min(10, items.length - shown)} de plus`;
    };
    addRows(premier);
    return [ul, more];
  }

  // --- Chercher ---
  function chercher(pool) {
    const box = el('div', 'repas-chercher');
    const input = Object.assign(el('input'), { type: 'search', placeholder: 'Un plat ou un ingrédient (ex. : curry, courgette)', maxLength: 60, autocomplete: 'off', value: q });
    input.ariaLabel = 'Chercher une recette par nom ou ingrédient';
    const res = el('div');
    const montre = () => {
      q = input.value.slice(0, 60);
      if (!q.trim()) { res.replaceChildren(el('p', 'zone', `Cherche parmi ${pool.length} recettes, par nom de plat ou par ingrédient.`)); return; }
      const found = repasChercher(pool, q);
      live.textContent = `${found.length} recette${found.length > 1 ? 's' : ''} trouvée${found.length > 1 ? 's' : ''}.`;
      res.replaceChildren(...(found.length ? lignes(found, r => r, resume, 10)
        : [el('p', 'zone', 'Aucune recette ne correspond. Essaie un autre mot ou élargis les filtres.')]));
    };
    let t = null;
    input.oninput = () => { clearTimeout(t); t = setTimeout(montre, 150); };
    box.append(input, res);
    montre();
    return box;
  }

  // La clé comparée est sans accents : on retrouve le nom tel qu'écrit dans la recette.
  const nomAffiche = (r, key) => r.ing.flatMap(i => i.k ?? []).find(k => repasSans(k) === key) ?? key;

  // --- Gardées ---
  function favoris() {
    const box = el('div', 'repas-favoris');
    const list = state.fav.map(id => cat.byId.get(id)).filter(Boolean);
    if (!list.length) {
      box.append(el('p', 'zone', 'Les recettes que tu gardes apparaissent ici.'));
      return box;
    }
    const ul = el('ul', 'rows repas-liste');
    for (const r of list) {
      const li = el('li', 'row');
      const open = button('repas-ouvrir', '', () => fiche(r));
      open.append(el('span', 'repas-titre', r.t), el('span', 'zone', resume(r)));
      const x = button('x', '×', () => { state.fav = state.fav.filter(id => id !== r.id); persist(); draw(); root.querySelector('.repas-tabs button:last-child')?.focus(); });
      x.ariaLabel = `Retirer ${r.t} des recettes gardées`;
      li.append(open, x);
      ul.append(li);
    }
    box.append(ul);
    return box;
  }

  // --- Fiche recette, dans une grande fenêtre ---
  function fiche(r) {
    const have = new Set(state.frigo.map(repasCle));
    const staples = new Set(REPAS.BASE.map(repasCle));
    const doc = el('article', 'repas-fiche');
    doc.append(el('p', 'zone', resume(r)));
    const actions = el('div', 'atelier-row');
    actions.append(garder(r));
    doc.append(actions, el('h3', '', 'Ingrédients'));
    const ul = el('ul', 'repas-ing');
    for (const i of r.ing) {
      if (i.g) { ul.append(el('li', 'repas-sous', i.g)); continue; }
      const keys = (i.k ?? []).map(repasSans);
      const ok = state.frigo.length && keys.length && keys.every(k => have.has(k) || (state.base && staples.has(k)));
      const li = el('li', ok ? 'repas-ok' : '', i.x);
      if (ok) li.append(el('span', 'sr', ' (tu en as)'));
      ul.append(li);
    }
    doc.append(ul, el('h3', '', 'Préparation'));
    const ol = el('ol', 'repas-etapes');
    for (const e of r.et) ol.append(typeof e === 'string' ? el('li', '', e) : el('li', 'repas-sous', e.g));
    const src = el('p', 'repas-credit');
    src.append('Recette « ', Object.assign(el('a', '', r.t), { href: repasPage(r), target: '_blank', rel: 'noopener' }), ' », Livre de cuisine de Wikibooks, par ses ',
      Object.assign(el('a', '', 'contributeurs'), { href: `${repasPage(r)}?action=history`, target: '_blank', rel: 'noopener' }), '. ',
      Object.assign(el('a', '', 'Version utilisée'), { href: repasSource(r), target: '_blank', rel: 'noopener' }), ', mise en forme par Renzvi. Licence ',
      Object.assign(el('a', '', 'CC BY-SA 4.0'), { href: 'https://creativecommons.org/licenses/by-sa/4.0/deed.fr', target: '_blank', rel: 'noopener' }), '.');
    doc.append(ol, el('p', 'repas-avert', 'Allergènes et valeurs nutritionnelles : non renseignés par la source. Vérifie chaque ingrédient en cas d’allergie.'), src);
    // Garder ou retirer depuis la fiche : la liste « Gardées » est redessinée à la fermeture.
    chillAgrandir(r.t, doc, () => { if (!gone && state.tab === 'favoris') draw(); });
  }

  load();
  return () => { gone = true; stopSpin(); };
}

if (typeof module !== 'undefined') module.exports = { REPAS, repasCle, repasClean, repasFiltrer, repasTirer, repasFrigo, repasRequis, repasChercher };
