// Quotidien : le socle partagé par Aujourd'hui, Agenda, Liste de courses, Mes dépenses et Mes abonnements.
// - Dates « murales » AAAA-MM-JJ et heures HH:MM : un rendez-vous à 14:00 reste à 14:00, changement d'heure ou pas.
//   Aucun calcul en millisecondes sur des dates locales : les jours s'additionnent en UTC, à midi, donc jamais de jour
//   sauté ou doublé au passage à l'heure d'été ou d'hiver. Le fuseau est celui de l'appareil (comme tout le dashboard).
// - Montants en centimes entiers (jamais de nombre à virgule), une devise par montant, jamais d'addition entre devises.
// - Récurrences (Pro) : jour, semaine, mois, an ; exceptions par date ; « ce rendez-vous », « les suivants », « toute la série ».
// Les fonctions pures sont exportées pour tests/quotidien.test.cjs. L'interface (fenêtres, confirmation) utilise el et button
// (dashboard.html), lus au moment de l'appel.

const Q = (() => {
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
  const utc = key => { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
  const key = date => date.toISOString().slice(0, 10);
  const valide = k => {
    if (typeof k !== 'string' || !ISO.test(k)) return false;
    const [y, m, d] = k.split('-').map(Number);
    if (y < 2000 || y > 2100) return false;
    const t = utc(k);
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  };
  const heureValide = h => typeof h === 'string' && HEURE.test(h);
  const minutes = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
  const plus = (k, n) => { const t = utc(k); t.setUTCDate(t.getUTCDate() + n); return key(t); };
  const ecart = (a, b) => Math.round((utc(b) - utc(a)) / 864e5); // b - a, en jours
  const jourSemaine = k => (utc(k).getUTCDay() + 6) % 7; // lundi = 0
  const lundi = k => plus(k, -jourSemaine(k));
  const dernierJour = (y, m) => new Date(Date.UTC(y, m, 0, 12)).getUTCDate(); // m de 1 à 12
  // Le même jour, n mois plus tard. 'saute' : null si ce jour n'existe pas (31 février) ; 'borne' : le dernier jour du mois.
  function plusMois(k, n, ancre, mode = 'borne') {
    const [y, m] = k.split('-').map(Number);
    const total = (y * 12 + (m - 1)) + n, yy = Math.floor(total / 12), mm = total % 12 + 1;
    const fin = dernierJour(yy, mm), jour = ancre ?? Number(k.slice(8));
    if (jour > fin && mode === 'saute') return null;
    return `${yy}-${String(mm).padStart(2, '0')}-${String(Math.min(jour, fin)).padStart(2, '0')}`;
  }
  const aujourdhui = () => new Date().toLocaleDateString('sv');
  const maintenant = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  // Libellés en français, calculés en UTC pour que la date affichée soit exactement la clé.
  const fmt = (k, o) => utc(k).toLocaleDateString('fr-FR', { timeZone: 'UTC', ...o });
  const majuscule = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  function jourLabel(k, ref = aujourdhui()) {
    const n = ecart(ref, k);
    if (n === 0) return "Aujourd'hui";
    if (n === 1) return 'Demain';
    if (n === -1) return 'Hier';
    const memeAnnee = k.slice(0, 4) === ref.slice(0, 4);
    return majuscule(fmt(k, { weekday: 'short', day: 'numeric', month: 'short', ...(memeAnnee ? {} : { year: 'numeric' }) }));
  }
  const dateLongue = k => majuscule(fmt(k, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  const dateCourte = k => fmt(k, { day: 'numeric', month: 'short' });
  const moisLabel = k => majuscule(fmt(k, { month: 'long', year: 'numeric' }));

  // ---------- Argent ----------
  const DEVISES = { EUR: 'Euro', USD: 'Dollar américain', GBP: 'Livre sterling', CHF: 'Franc suisse', CAD: 'Dollar canadien' };
  const DEVISE = 'EUR'; // la devise du compte : Renzvi vend en euros, en France
  const MAX_CENTIMES = 100000000; // 1 000 000,00
  // « 12,5 », « 12.50 », « 1 234,56 », « 12 € » → 1250, 1250, 123456, 1200. Tout le reste → null. Aucun calcul flottant.
  function centimes(texte) {
    if (typeof texte !== 'string') return null;
    const s = texte.replace(/[\s  €$£]|EUR|CHF/gi, '');
    const m = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(s);
    if (!m) return null;
    const c = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
    return c > 0 && c <= MAX_CENTIMES ? c : null;
  }
  const montantValide = c => Number.isInteger(c) && c > 0 && c <= MAX_CENTIMES;
  const argent = (c, devise = DEVISE) => (c / 100).toLocaleString('fr-FR', { style: 'currency', currency: devise });
  const saisie = c => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, useGrouping: false });
  // Totaux par devise : { EUR: 1234, USD: 500 }. Jamais d'addition entre devises.
  function totaux(lignes) {
    const t = {};
    for (const l of lignes) if (montantValide(l.cents) && DEVISES[l.devise]) t[l.devise] = (t[l.devise] ?? 0) + l.cents;
    return t;
  }
  // « 120,00 € » ; avec d'autres devises : « 120,00 € et 15,00 $US », jamais additionnés.
  const totauxTexte = (t, vide = argent(0)) => {
    const parts = Object.entries(t).sort(([a], [b]) => (a === DEVISE ? -1 : b === DEVISE ? 1 : a.localeCompare(b))).map(([d, c]) => argent(c, d));
    return parts.length ? parts.join(' et ') : vide;
  };

  // ---------- Agenda ----------
  const FREQS = { jour: 'Tous les jours', semaine: 'Toutes les semaines', mois: 'Tous les mois', an: 'Tous les ans' };
  // Un rendez-vous : { id, t, d (début), f (fin, ≥ d), all (journée entière), h1, h2, lieu, notes, r: { freq, fin }, ex: [dates] }.
  // Une heure de fin avant l'heure de début, le même jour : il finit le lendemain (soirée, nuit de garde).
  function nettoyerEvenement(e) {
    if (!e || typeof e.id !== 'string' || typeof e.t !== 'string' || !e.t.trim() || !valide(e.d)) return null;
    const out = { id: e.id, t: e.t.trim().slice(0, 80), d: e.d, f: valide(e.f) && e.f >= e.d ? e.f : e.d, all: !!e.all };
    if (!out.all) {
      out.h1 = heureValide(e.h1) ? e.h1 : '09:00';
      out.h2 = heureValide(e.h2) ? e.h2 : out.h1;
      if (out.f === out.d && minutes(out.h2) < minutes(out.h1)) out.f = plus(out.d, 1);
    }
    if (ecart(out.d, out.f) > 60) out.f = plus(out.d, 60);
    if (typeof e.lieu === 'string' && e.lieu.trim()) out.lieu = e.lieu.trim().slice(0, 80);
    if (typeof e.notes === 'string' && e.notes.trim()) out.notes = e.notes.trim().slice(0, 500);
    if (e.r && FREQS[e.r.freq]) {
      out.r = { freq: e.r.freq };
      if (valide(e.r.fin) && e.r.fin >= e.d) out.r.fin = e.r.fin;
      out.ex = Array.isArray(e.ex) ? [...new Set(e.ex.filter(valide))].sort().slice(-200) : [];
    }
    if (typeof e.de === 'string') out.de = e.de; // copie modifiée d'une occurrence (« ce rendez-vous seulement »)
    return out;
  }
  // Les débuts de la série entre deux dates (incluses), sans les exceptions. Mois : un 31 saute les mois sans 31 ;
  // an : un 29 février ne revient que les années bissextiles. Borné pour ne jamais boucler sans fin.
  function debuts(e, de, a) {
    if (!e.r) return e.d <= a && e.d >= de ? [e.d] : [];
    const out = [], fin = e.r.fin && e.r.fin < a ? e.r.fin : a, ex = new Set(e.ex ?? []);
    if (e.d > fin) return out;
    const pas = { jour: 1, semaine: 7 }[e.r.freq];
    if (pas) {
      let k = e.d;
      if (de > e.d) k = plus(e.d, Math.floor(ecart(e.d, de) / pas) * pas);
      for (let i = 0; k <= fin && i < 1000; i++, k = plus(k, pas)) if (k >= de && k >= e.d && !ex.has(k)) out.push(k);
      return out;
    }
    const mois = e.r.freq === 'mois' ? 1 : 12, ancre = Number(e.d.slice(8));
    const [y0, m0] = e.d.split('-').map(Number), [y1, m1] = de.split('-').map(Number);
    let n = Math.max(0, Math.floor(((y1 - y0) * 12 + (m1 - m0)) / mois) - 1);
    for (let i = 0; i < 1000; i++, n++) {
      const k = plusMois(e.d, n * mois, ancre, 'saute');
      if (k === null) continue;
      if (k > fin) break;
      if (k >= de && !ex.has(k)) out.push(k);
    }
    return out;
  }
  // Les occurrences qui touchent la période [de, a] : une réunion qui commence la veille au soir compte aussi.
  function occurrences(evenements, de, a) {
    const out = [];
    for (const e of evenements) {
      const duree = ecart(e.d, e.f);
      for (const debut of debuts(e, plus(de, -duree), a)) {
        const fin = plus(debut, duree);
        if (fin >= de) out.push({ e, debut, fin, cle: `${e.id}@${debut}` });
      }
    }
    return out.sort((x, y) => x.debut.localeCompare(y.debut) || (x.e.all === y.e.all ? (x.e.h1 ?? '').localeCompare(y.e.h1 ?? '') : x.e.all ? -1 : 1) || x.e.t.localeCompare(y.e.t));
  }
  // Ce qu'affiche une occurrence pour un jour donné : « Toute la journée », « 14:00 – 15:30 », « jusqu'à 02:00 », « dès 23:00 ».
  function horaire(o, jour) {
    if (o.e.all) return o.debut === o.fin ? 'Toute la journée' : jour === o.debut ? `Jusqu'au ${dateCourte(o.fin)}` : 'Toute la journée';
    if (o.debut === o.fin) return o.e.h1 === o.e.h2 ? o.e.h1.replace(':', ' h ') : `${o.e.h1.replace(':', ' h ')} – ${o.e.h2.replace(':', ' h ')}`;
    if (jour === o.debut) return `Dès ${o.e.h1.replace(':', ' h ')}`;
    if (jour === o.fin) return `Jusqu'à ${o.e.h2.replace(':', ' h ')}`;
    return 'Toute la journée';
  }
  // Modifier une série à partir d'une date : l'ancienne s'arrête la veille, une nouvelle reprend ce jour-là.
  function couperSerie(e, jour, nouvelId) {
    const avant = { ...e, r: { ...e.r, fin: plus(jour, -1) }, ex: (e.ex ?? []).filter(x => x < jour) };
    const apres = { ...e, id: nouvelId, d: jour, f: plus(jour, ecart(e.d, e.f)), ex: (e.ex ?? []).filter(x => x >= jour) };
    if (e.r.fin) apres.r = { ...e.r }; else apres.r = { freq: e.r.freq };
    return { avant: avant.r.fin < avant.d ? null : avant, apres };
  }

  // ---------- Abonnements ----------
  const PERIODES = { semaine: 'Chaque semaine', mois: 'Chaque mois', trimestre: 'Chaque trimestre', an: 'Chaque année' };
  // L'échéance suivante après « k », même jour du mois (le 31 → dernier jour des mois courts, puis retour au 31).
  function echeanceSuivante(k, periode, ancre) {
    if (periode === 'semaine') return plus(k, 7);
    return plusMois(k, { mois: 1, trimestre: 3, an: 12 }[periode], ancre, 'borne');
  }
  // Paiements prévus entre deux dates (incluses), à partir de la prochaine échéance enregistrée.
  function echeances(abo, de, a) {
    const out = [];
    if (!abo.actif || !valide(abo.next)) return out;
    const ancre = abo.ancre ?? Number(abo.next.slice(8));
    for (let k = abo.next, i = 0; k <= a && i < 600; k = echeanceSuivante(k, abo.periode, ancre), i++) if (k >= de) out.push(k);
    return out;
  }
  // Équivalent mensuel : une estimation pour comparer, pas des paiements. Arrondi au centime le plus proche.
  const PAR_MOIS = { semaine: [52, 12], mois: [1, 1], trimestre: [1, 3], an: [1, 12] };
  const equivalentMensuel = abo => { const [x, y] = PAR_MOIS[abo.periode]; return Math.round(abo.cents * x / y); };
  function prevision(abos, de, a) {
    const lignes = [];
    for (const abo of abos) for (const date of echeances(abo, de, a)) lignes.push({ abo, date, cents: abo.cents, devise: abo.devise });
    return lignes.sort((x, y) => x.date.localeCompare(y.date) || x.abo.nom.localeCompare(y.abo.nom));
  }

  // ---------- Courses ----------
  const UNITES = ['', 'g', 'kg', 'ml', 'cl', 'L', 'pièce', 'paquet', 'boîte', 'bouteille', 'pot', 'sachet'];
  // « 2 kg pommes » → { n: 'pommes', q: 2, u: 'kg' } ; « 6 œufs » → { n: 'œufs', q: 6, u: '' } ; « lait » → { n: 'lait' }.
  function article(texte) {
    const s = String(texte ?? '').trim().replace(/\s+/g, ' ');
    const m = /^(\d{1,4}(?:[.,]\d{1,2})?)\s*(g|kg|ml|cl|l|L|pièces?|paquets?|boîtes?|bouteilles?|pots?|sachets?)?\.?\s+(?:de |d')?(.+)$/i.exec(s);
    if (!m) return { n: s.slice(0, 60) };
    const q = Number(m[1].replace(',', '.'));
    if (!(q > 0 && q <= 9999)) return { n: s.slice(0, 60) };
    const brut = (m[2] ?? '').toLowerCase().replace(/s$/, '');
    const u = brut === 'l' ? 'L' : UNITES.includes(brut) ? brut : '';
    return { n: m[3].trim().slice(0, 60), q, u };
  }
  const MESURES = ['g', 'kg', 'ml', 'cl', 'L'];
  const quantite = it => !it.q ? '' : `${String(it.q).replace('.', ',')}${it.u ? ` ${it.q > 1 && !MESURES.includes(it.u) ? `${it.u}s` : it.u}` : ''}`;

  return {
    valide, heureValide, minutes, plus, ecart, jourSemaine, lundi, plusMois, aujourdhui, maintenant,
    jourLabel, dateLongue, dateCourte, moisLabel, majuscule, fmt,
    DEVISES, DEVISE, MAX_CENTIMES, centimes, montantValide, argent, saisie, totaux, totauxTexte,
    FREQS, nettoyerEvenement, debuts, occurrences, horaire, couperSerie,
    PERIODES, echeanceSuivante, echeances, equivalentMensuel, prevision,
    UNITES, article, quantite,
  };
})();

// ---------- Interface partagée (navigateur seulement) ----------
// Réservé à Pro : le plan est lu par le dashboard (debloque) ; renvoie true et ouvre les plans si le compte est en Gratuit.
const qPro = () => typeof debloque === 'function' && debloque();
const qVerrou = raison => window.renzviVerrou ? window.renzviVerrou(raison) : !qPro();
// Aller à un autre widget (il est peut-être sur un autre mode ou une autre page) ; s'il n'est pas sur l'écran, le proposer.
function qOuvrir(id) {
  const detail = { id };
  document.dispatchEvent(new CustomEvent('renzvi:ouvrir', { detail }));
  return !!detail.ok;
}
function qAjouterWidget(id) {
  const detail = { ids: [id] };
  document.dispatchEvent(new CustomEvent('renzvi:ajouter', { detail }));
  return (detail.added ?? []).includes(id);
}
// Une fiche (formulaire) dans une fenêtre : Échap ou « Annuler » ferme sans rien enregistrer.
function qFiche(titre, contenu, { onClose } = {}) {
  const dialog = el('dialog', 'glass q-fiche');
  const head = el('div', 'q-fiche-head');
  const h = el('h2', '', titre);
  h.id = `q-fiche-${Math.random().toString(36).slice(2, 8)}`;
  dialog.setAttribute('aria-labelledby', h.id);
  const fermer = button('x', '×', () => dialog.close());
  fermer.ariaLabel = 'Fermer';
  head.append(h, fermer);
  dialog.append(head, contenu);
  // Ouverture et sortie animées (chill/chill.js) ; la fenêtre n'est retirée qu'une fois la sortie finie.
  let fini = false;
  const finir = () => { if (fini) return; fini = true; dialog.remove(); onClose?.(); };
  // Clic sur le voile : ferme, comme Échap.
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  document.body.append(dialog);
  dialog.showModal();
  chillAnimer(dialog, null, finir);
  contenu.querySelector('input:not([type=hidden]),select,textarea')?.focus();
  return dialog;
}
// Confirmation d'une action qui efface : renvoie une promesse (true = confirmé).
function qConfirmer(titre, texte, ok = 'Supprimer') {
  return new Promise(resolve => {
    let reponse = false;
    const box = el('div', 'q-form');
    box.append(el('p', 'q-texte', texte));
    const actions = el('div', 'q-actions');
    const non = button('ghost', 'Annuler', () => d.close());
    const oui = button('primary q-danger', ok, () => { reponse = true; d.close(); });
    actions.append(non, oui);
    box.append(actions);
    const d = qFiche(titre, box, { onClose: () => resolve(reponse) });
    non.focus();
  });
}
// Un champ avec son libellé visible.
function qChamp(label, input, aide) {
  const date = input.type === 'date' && window.renzviDateInput;
  const wrap = el(date ? 'div' : 'label', 'q-champ');
  const caption = el(date ? 'label' : 'span', 'q-label', label);
  if (date) {
    input.id ||= `q-date-${crypto.randomUUID()}`;
    caption.htmlFor = input.id;
  }
  wrap.append(caption, date ? date(input, label) : input);
  if (aide) {
    const p = el('span', 'q-aide', aide);
    p.id = `q-aide-${Math.random().toString(36).slice(2, 8)}`;
    input.setAttribute('aria-describedby', p.id);
    wrap.append(p);
  }
  return wrap;
}
const qInput = (type, props = {}) => Object.assign(el('input'), { type, autocomplete: 'off', ...props });
function qSelect(options, value, props = {}) {
  const s = Object.assign(el('select'), props);
  for (const [v, t] of options) s.append(Object.assign(el('option', '', t), { value: v }));
  s.value = value;
  return s;
}
// Pastille « Pro » sur une action réservée.
function qProChip() {
  const chip = el('span', 'q-pro');
  chip.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="5.5" width="8" height="5.5" rx="1.2"/><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5"/></svg>Pro';
  return chip;
}
// Écoute les changements faits ailleurs (un autre widget) sur un widget enregistré : renvoie de quoi arrêter d'écouter.
function qEcouter(id, moi, fn) {
  const h = e => { if (e.detail?.widget === id && e.detail.from !== moi) fn(); };
  document.addEventListener('renzvi:donnees', h);
  return () => document.removeEventListener('renzvi:donnees', h);
}
function qEcouterPlan(fn) {
  document.addEventListener('renzvi:plan', fn);
  return () => document.removeEventListener('renzvi:plan', fn);
}

if (typeof module !== 'undefined') module.exports = { Q };
