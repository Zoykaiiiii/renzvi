// Mes dépenses : un suivi saisi à la main. Table « depenses » (supabase/migrations/20261116000100_quotidien.sql),
// montants en centimes entiers, devise du compte : l'euro. Une autre devise reste à part, jamais additionnée ni convertie.
// Budgets (Pro) dans widget_state, ligne « depenses » : { budgets: { catégorie: centimes } } (en euros).
// Gratuit : saisir, modifier, supprimer, le total du mois, toutes les dépenses mois par mois.
// Pro : budgets par catégorie, comparaison avec le mois d'avant, répartition par catégorie.
// Pas de connexion bancaire, pas de conseil, pas de classement automatique. Les totaux sont recalculés depuis les lignes.

const DEPENSES_CATS = ['Courses', 'Restaurant', 'Transport', 'Logement', 'Factures', 'Abonnements', 'Loisirs', 'Santé', 'Shopping', 'Études', 'Cadeaux', 'Autre'];
const DEPENSES_COLS = 'id,montant_centimes,devise,jour,categorie,libelle,abonnement_id,echeance,created_at';

function depensesWidget({ body, meta, data, save, sb, peer, apercu }) {
  let budgets = Object.fromEntries(Object.entries(data?.budgets ?? {}).filter(([c, v]) => DEPENSES_CATS.includes(c) && Q.montantValide(v)));
  let mois = Q.aujourdhui().slice(0, 7) + '-01';
  let lignes = [], etat = 'charge', tour = 0;
  const dernier = m => Q.plus(Q.plusMois(m, 1), -1);
  const ligneDe = r => ({ id: r.id, cents: r.montant_centimes, devise: r.devise, jour: r.jour, cat: r.categorie, txt: r.libelle ?? '', abo: r.abonnement_id, ech: r.echeance, cree: r.created_at ?? '' });

  // ---------- Saisie rapide ----------
  const form = el('form', 'q-saisie');
  const montant = qInput('text', { inputMode: 'decimal', placeholder: '0,00', maxLength: 12, className: 'q-montant' });
  montant.ariaLabel = 'Montant en euros';
  const libelle = qInput('text', { placeholder: 'Quoi ? (facultatif)', maxLength: 80 });
  libelle.ariaLabel = 'Description';
  const cat = qSelect(DEPENSES_CATS.map(c => [c, c]), 'Courses');
  cat.ariaLabel = 'Catégorie';
  const jour = qInput('date', { value: Q.aujourdhui(), min: '2000-01-01', max: '2100-12-31' });
  jour.ariaLabel = 'Date';
  const ok = Object.assign(el('button', 'primary', 'Ajouter'), { type: 'submit' });
  const euro = el('span', 'q-devise', '€');
  euro.setAttribute('aria-hidden', 'true');
  const l1 = el('div', 'q-saisie-l1'), l2 = el('div', 'q-saisie-l2');
  const montantBox = el('div', 'q-montant-box');
  montantBox.append(montant, euro);
  l1.append(montantBox, libelle);
  l2.append(cat, window.renzviDateInput?.(jour) ?? jour, ok);
  const msg = el('p', 'note');
  msg.hidden = true;
  msg.setAttribute('role', 'status');
  form.append(l1, l2, msg);

  // ---------- Le mois ----------
  const tete = el('div', 'q-mois');
  const prec = button('ghost q-icon', '‹', () => { mois = Q.plusMois(mois, -1); charger(); });
  const suiv = button('ghost q-icon', '›', () => { mois = Q.plusMois(mois, 1); charger(); });
  prec.ariaLabel = 'Mois précédent';
  suiv.ariaLabel = 'Mois suivant';
  const moisNom = el('h3', 'q-h3');
  moisNom.setAttribute('aria-live', 'polite');
  tete.append(prec, moisNom, suiv);
  const total = el('p', 'q-total');
  const autres = el('p', 'q-aide');
  const comparer = el('p', 'q-aide q-compare');
  const etatBox = el('div', 'q-etat');
  const liste = el('ul', 'q-list q-depenses');
  const plus = button('q-link', '', () => { tout = !tout; dessiner(); });
  let tout = false;
  // Agrandi : répartition et budgets.
  const analyse = el('section', 'q-big q-analyse');
  body.append(form, tete, total, autres, comparer, etatBox, liste, plus, analyse);

  // ---------- Chargement : le mois affiché et celui d'avant (pour comparer) ----------
  async function charger() {
    const t = ++tour;
    etat = 'charge';
    dessiner();
    if (apercu) { lignes = (data?.exemple ?? []).map(ligneDe); etat = 'ok'; return dessiner(); }
    const { data: rows, error } = await sb.from('depenses').select(DEPENSES_COLS)
      .gte('jour', Q.plusMois(mois, -1)).lte('jour', dernier(mois))
      .order('jour', { ascending: false }).order('created_at', { ascending: false }).limit(2000);
    if (t !== tour) return;
    if (error) { etat = 'erreur'; return dessiner(); }
    lignes = rows.map(ligneDe);
    etat = 'ok';
    dessiner();
  }

  function dessiner() {
    const auj = Q.aujourdhui(), duMois = lignes.filter(l => l.jour >= mois && l.jour <= dernier(mois));
    const courant = mois === auj.slice(0, 7) + '-01';
    moisNom.textContent = Q.moisLabel(mois);
    suiv.disabled = mois >= auj.slice(0, 7) + '-01';
    etatBox.replaceChildren();
    liste.hidden = plus.hidden = total.hidden = autres.hidden = comparer.hidden = analyse.hidden = false;
    if (etat !== 'ok') {
      liste.hidden = plus.hidden = total.hidden = autres.hidden = comparer.hidden = analyse.hidden = true;
      if (etat === 'charge') etatBox.append(el('p', 'q-aide', 'Chargement…'));
      else {
        const b = el('div', 'empty q-empty');
        b.append(el('p', 'msg', 'Tes dépenses n’ont pas pu se charger. Vérifie ta connexion.'), button('ghost', 'Réessayer', charger));
        etatBox.append(b);
      }
      meta.textContent = '';
      return;
    }
    const t = Q.totaux(duMois), eur = t[Q.DEVISE] ?? 0;
    meta.textContent = courant ? `${Q.argent(eur)} ce mois` : '';
    total.textContent = Q.argent(eur);
    total.ariaLabel = `Total de ${Q.moisLabel(mois)} en euros : ${Q.argent(eur)}`;
    const hors = Object.entries(t).filter(([d]) => d !== Q.DEVISE);
    autres.textContent = hors.length ? `Plus ${hors.map(([d, c]) => Q.argent(c, d)).join(' et ')}, en autre devise : non convertis, non additionnés.` : `${duMois.length} dépense${duMois.length > 1 ? 's' : ''} en ${Q.fmt(mois, { month: 'long' })}.`;
    // Pro : comparer au mois d'avant, au même jour (le mois en cours n'est pas fini) et en entier.
    const avant = Q.plusMois(mois, -1);
    const jourMax = courant ? Number(auj.slice(8)) : 31;
    const mPrec = lignes.filter(l => l.jour >= avant && l.jour < mois && l.devise === Q.DEVISE);
    const memeJour = mPrec.filter(l => Number(l.jour.slice(8)) <= jourMax).reduce((s, l) => s + l.cents, 0);
    const entier = mPrec.reduce((s, l) => s + l.cents, 0);
    comparer.replaceChildren();
    if (qPro()) {
      if (mPrec.length) {
        const diff = eur - (courant ? memeJour : entier);
        const base = courant ? `${Q.fmt(avant, { month: 'long' })} au ${jourMax}` : Q.fmt(avant, { month: 'long' });
        comparer.append(`${Q.majuscule(base)} : ${Q.argent(courant ? memeJour : entier)}, soit ${diff === 0 ? 'autant' : `${Q.argent(Math.abs(diff))} de ${diff > 0 ? 'plus' : 'moins'} ce mois-ci`}.`);
        if (courant) comparer.append(` ${Q.majuscule(Q.fmt(avant, { month: 'long' }))} en entier : ${Q.argent(entier)}.`);
      } else comparer.append(`Rien d'enregistré en ${Q.fmt(avant, { month: 'long' })} pour comparer.`);
    } else comparer.hidden = true;

    if (!duMois.length) {
      const b = el('div', 'empty q-empty');
      b.append(el('p', '', courant ? 'Aucune dépense ce mois-ci.' : `Aucune dépense en ${Q.fmt(mois, { month: 'long', year: 'numeric' })}.`));
      etatBox.append(b);
    }
    const montres = tout ? duMois : duMois.slice(0, 8);
    liste.replaceChildren(...montres.map(l => {
      const li = el('li', 'q-item');
      const b = button('q-item-btn', '', () => fiche(l));
      const quoi = el('span', 'q-what');
      quoi.append(el('span', 'q-titre', l.txt || l.cat), el('span', 'q-sous', `${l.txt ? `${l.cat} · ` : ''}${Q.jourLabel(l.jour, auj)}${l.abo ? ' · abonnement' : ''}`));
      b.append(quoi, el('span', 'q-num', Q.argent(l.cents, l.devise)));
      b.ariaLabel = `${l.txt || l.cat}, ${Q.argent(l.cents, l.devise)}, ${Q.dateLongue(l.jour)}. Modifier`;
      li.append(b);
      return li;
    }));
    plus.hidden = duMois.length <= 8;
    plus.textContent = tout ? 'Afficher moins' : `Afficher les ${duMois.length} dépenses du mois`;
    dessinerAnalyse(duMois);
  }

  // ---------- Pro : répartition et budgets (vue agrandie) ----------
  function dessinerAnalyse(duMois) {
    const h = el('h3', 'q-h3', 'Par catégorie');
    const outils = el('div', 'q-bar');
    const bud = button('ghost q-small-btn', 'Budgets', () => fBudgets());
    if (!qPro()) { h.append(' ', qProChip()); bud.append(' ', qProChip()); }
    outils.append(h, bud);
    if (!qPro()) {
      const p = el('p', 'q-aide', 'Avec Pro : la répartition par catégorie, un budget par catégorie et la comparaison avec le mois d’avant.');
      const voir = button('ghost', 'Voir Pro', () => qVerrou('Les budgets et la répartition'));
      return analyse.replaceChildren(outils, p, voir);
    }
    const eur = duMois.filter(l => l.devise === Q.DEVISE);
    const somme = eur.reduce((s, l) => s + l.cents, 0);
    const parCat = DEPENSES_CATS.map(c => ({ c, cents: eur.filter(l => l.cat === c).reduce((s, l) => s + l.cents, 0), budget: budgets[c] }))
      .filter(x => x.cents || x.budget).sort((a, b) => b.cents - a.cents);
    const max = Math.max(1, ...parCat.map(x => Math.max(x.cents, x.budget ?? 0)));
    const ul = el('ul', 'q-cats');
    for (const x of parCat) {
      const li = el('li', 'q-cat');
      const haut = el('div', 'q-cat-l');
      const part = somme ? Math.round(x.cents * 100 / somme) : 0;
      haut.append(el('span', 'q-titre', x.c), el('span', 'q-num', `${Q.argent(x.cents)}${x.budget ? ` sur ${Q.argent(x.budget)}` : ''}`));
      const barre = el('div', 'q-jauge');
      const plein = el('i');
      plein.style.width = `${x.cents / max * 100}%`;
      if (x.budget && x.cents > x.budget) plein.className = 'over';
      barre.append(plein);
      if (x.budget) { const repere = el('b'); repere.style.left = `${x.budget / max * 100}%`; barre.append(repere); }
      barre.setAttribute('aria-hidden', 'true');
      const sous = el('p', `q-sous${x.budget && x.cents > x.budget ? ' q-late' : ''}`,
        x.budget ? (x.cents > x.budget ? `Budget dépassé de ${Q.argent(x.cents - x.budget)}` : `Reste ${Q.argent(x.budget - x.cents)} sur le budget`) + ` · ${part} % du mois` : `${part} % du mois`);
      li.append(haut, barre, sous);
      ul.append(li);
    }
    const expl = el('p', 'q-aide', 'Calculé sur les dépenses en euros de ce mois. Les pourcentages sont arrondis.');
    analyse.replaceChildren(outils, parCat.length ? ul : el('p', 'q-aide', 'Rien à répartir ce mois-ci.'), expl);
  }

  function fBudgets() {
    if (apercu || qVerrou('Les budgets par catégorie')) return;
    const f = el('form', 'q-form');
    const champs = DEPENSES_CATS.map(c => {
      const i = qInput('text', { inputMode: 'decimal', placeholder: 'Aucun', value: budgets[c] ? Q.saisie(budgets[c]) : '', maxLength: 12 });
      return [c, i];
    });
    const grille = el('div', 'q-budgets');
    for (const [c, i] of champs) grille.append(qChamp(c, i));
    const err = el('p', 'note');
    err.hidden = true;
    const actions = el('div', 'q-actions');
    actions.append(button('ghost', 'Annuler', () => d.close()), Object.assign(el('button', 'primary', 'Enregistrer'), { type: 'submit' }));
    f.append(el('p', 'q-aide', 'Un montant par mois, en euros. Laisse vide pour ne pas suivre une catégorie.'), grille, err, actions);
    f.onsubmit = e => {
      e.preventDefault();
      const neufs = {};
      for (const [c, i] of champs) {
        if (!i.value.trim()) continue;
        const v = Q.centimes(i.value);
        if (v === null) { err.textContent = `${c} : montant non valide (ex. : 150 ou 150,50).`; err.hidden = false; return i.focus(); }
        neufs[c] = v;
      }
      budgets = neufs;
      save({ budgets });
      dessiner();
      d.close();
    };
    const d = qFiche('Budgets du mois', f);
  }

  // ---------- Enregistrer : un identifiant choisi avant l'envoi, donc un nouvel essai ne crée pas de doublon ----------
  let brouillon = null;
  form.onsubmit = async e => {
    e.preventDefault();
    if (apercu) return;
    const cents = Q.centimes(montant.value);
    msg.hidden = false;
    msg.classList.remove('ok');
    if (cents === null) { msg.textContent = 'Montant : un nombre positif, deux décimales au plus (ex. : 12,50).'; return montant.focus(); }
    if (!Q.valide(jour.value)) { msg.textContent = 'Choisis une date.'; return jour.focus(); }
    const row = { montant_centimes: cents, devise: Q.DEVISE, jour: jour.value, categorie: cat.value, libelle: libelle.value.trim().slice(0, 80) };
    const cle = JSON.stringify(row);
    if (brouillon?.cle !== cle) brouillon = { cle, id: crypto.randomUUID() };
    ok.disabled = true;
    msg.textContent = 'Enregistrement…';
    const { error } = await sb.from('depenses').insert({ id: brouillon.id, ...row });
    ok.disabled = false;
    // 23505 : cette dépense est déjà en base (le premier envoi était passé malgré la coupure) : rien à refaire.
    if (error && error.code !== '23505') {
      msg.textContent = error.code === 'P0001' ? 'Tu as atteint 20 000 dépenses : supprimes-en d’anciennes pour continuer.' : 'Pas enregistrée : vérifie ta connexion, puis réessaie. Ta saisie est gardée.';
      return;
    }
    brouillon = null;
    msg.textContent = `${Q.argent(cents)} ajoutés.`;
    msg.classList.add('ok');
    montant.value = libelle.value = '';
    if (jour.value.slice(0, 7) !== mois.slice(0, 7)) mois = jour.value.slice(0, 7) + '-01';
    signaler();
    await charger();
    montant.focus();
  };

  function fiche(l) {
    if (apercu) return;
    const f = el('form', 'q-form');
    const m = qInput('text', { inputMode: 'decimal', value: Q.saisie(l.cents), maxLength: 12 });
    const dv = qSelect(Object.entries(Q.DEVISES).map(([k, v]) => [k, `${v} (${k})`]), l.devise);
    const tx = qInput('text', { value: l.txt, maxLength: 80, placeholder: 'Facultatif' });
    const c = qSelect(DEPENSES_CATS.map(x => [x, x]), DEPENSES_CATS.includes(l.cat) ? l.cat : 'Autre');
    const j = qInput('date', { value: l.jour, min: '2000-01-01', max: '2100-12-31' });
    const err = el('p', 'note');
    err.hidden = true;
    err.setAttribute('role', 'alert');
    const r1 = el('div', 'q-row2');
    r1.append(qChamp('Montant', m), qChamp('Devise', dv));
    const actions = el('div', 'q-actions');
    const enr = Object.assign(el('button', 'primary', 'Enregistrer'), { type: 'submit' });
    actions.append(button('ghost q-left q-danger-text', 'Supprimer', async () => {
      if (!await qConfirmer('Supprimer la dépense', `Supprimer ${Q.argent(l.cents, l.devise)}${l.txt ? ` (${l.txt})` : ''} du ${Q.dateLongue(l.jour)} ? Les totaux seront recalculés.`)) return;
      const { error } = await sb.from('depenses').delete().eq('id', l.id);
      if (error) { err.textContent = 'Pas supprimée : vérifie ta connexion, puis réessaie.'; err.hidden = false; return; }
      d.close(); signaler(); charger();
    }), button('ghost', 'Annuler', () => d.close()), enr);
    f.append(r1, qChamp('Description', tx), qChamp('Catégorie', c), qChamp('Date', j));
    if (l.abo) f.append(el('p', 'q-aide', `Paiement d’un abonnement (échéance du ${Q.dateLongue(l.ech)}).`));
    f.append(err, actions);
    f.onsubmit = async e => {
      e.preventDefault();
      const cents = Q.centimes(m.value);
      err.hidden = false;
      if (cents === null) return void (err.textContent = 'Montant : un nombre positif, deux décimales au plus.');
      if (!Q.valide(j.value)) return void (err.textContent = 'Choisis une date.');
      enr.disabled = true;
      const { error } = await sb.from('depenses').update({ montant_centimes: cents, devise: dv.value, libelle: tx.value.trim().slice(0, 80), categorie: c.value, jour: j.value, updated_at: new Date().toISOString() }).eq('id', l.id);
      enr.disabled = false;
      if (error) return void (err.textContent = 'Pas enregistrée : vérifie ta connexion, puis réessaie. Tes changements sont gardés ici.');
      d.close(); signaler(); charger();
    };
    const d = qFiche('Modifier la dépense', f);
  }

  const signaler = () => document.dispatchEvent(new CustomEvent('renzvi:depenses', { detail: { from: 'depenses' } }));
  charger();
  if (apercu) return null;
  const recharger = e => { if (e.detail?.from !== 'depenses') charger(); };
  document.addEventListener('renzvi:depenses', recharger);
  const stopPlan = qEcouterPlan(dessiner);
  const stop = qEcouter('depenses', 'depenses', () => { budgets = { ...(peer('depenses')?.budgets ?? {}) }; dessiner(); });
  return () => { tour++; document.removeEventListener('renzvi:depenses', recharger); stopPlan(); stop(); };
}
