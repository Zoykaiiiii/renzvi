// Mes abonnements : les abonnements de la personne (musique, stockage, salle de sport…), saisis à la main.
// Données dans widget_state, ligne « abos » : { items: [{ id, nom, cents, devise, periode, next, ancre, notes, lien, actif, payes }] }.
// Trois choses distinctes, jamais mélangées à l'écran :
//   - les paiements enregistrés : de vraies dépenses, dans Mes dépenses (table depenses, liées par abonnement_id + echeance) ;
//   - les paiements prévus : les prochaines échéances, calculées depuis la date de renouvellement ;
//   - l'équivalent mensuel : une estimation pour comparer (un annuel / 12 n'est pas douze paiements).
// Une échéance arrivée n'est jamais marquée payée toute seule : la personne confirme (une dépense liée, une seule, même avec
// plusieurs clics ou un nouvel essai, grâce à l'index unique de la table) ou la passe. Le lien de gestion ouvre seulement
// le site du service : Renzvi ne résilie rien.
// Gratuit : saisir, modifier, prochaines échéances, équivalent mensuel. Pro : prévision sur une période, filtres et regroupements.

const ABOS_MAX = 60;

function abosNettoyer(d) {
  return (Array.isArray(d?.items) ? d.items : []).filter(a => a && typeof a.id === 'string' && typeof a.nom === 'string' && a.nom.trim() && Q.montantValide(a.cents) && Q.DEVISES[a.devise] && Q.PERIODES[a.periode] && Q.valide(a.next))
    .map(a => ({
      id: a.id, nom: a.nom.trim().slice(0, 40), cents: a.cents, devise: a.devise, periode: a.periode, next: a.next,
      ancre: Number.isInteger(a.ancre) && a.ancre >= 1 && a.ancre <= 31 ? a.ancre : Number(a.next.slice(8)),
      actif: a.actif !== false,
      ...(typeof a.notes === 'string' && a.notes.trim() ? { notes: a.notes.trim().slice(0, 300) } : {}),
      ...(typeof a.lien === 'string' && /^https:\/\/[^\s]+$/.test(a.lien) ? { lien: a.lien.slice(0, 300) } : {}),
      payes: Object.fromEntries(Object.entries(a.payes ?? {}).filter(([k, v]) => Q.valide(k) && ['paye', 'saute'].includes(v)).slice(-24)),
    })).slice(0, ABOS_MAX);
}

function abosWidget({ body, meta, data, save, sb, peer, apercu }) {
  let items = abosNettoyer(data);
  const persist = () => save({ items });
  let horizon = 3, filtre = 'actifs', groupe = 'aucun';
  let payesMois = null; // paiements enregistrés ce mois-ci (Mes dépenses), chargés pour la vue agrandie
  const enCours = new Set(); // confirmations en cours : un deuxième clic ne renvoie rien

  const ajouter = button('ghost q-add', 'Nouvel abonnement', () => fiche(null));
  const aConfirmer = el('section', 'q-confirmer');
  const prochains = el('ul', 'q-list q-small');
  const vide = el('div', 'empty q-empty');
  vide.append(el('p', '', 'Aucun abonnement suivi.'));
  const estimation = el('p', 'q-aide q-estim q-small');
  const grand = el('div', 'q-big q-abos-big');
  body.append(ajouter, aConfirmer, vide, prochains, estimation, grand);

  const libPeriode = p => ({ semaine: 'semaine', mois: 'mois', trimestre: 'trimestre', an: 'an' })[p];
  function ligne(a, date, sous) {
    const li = el('li', 'q-item');
    const b = button('q-item-btn', '', () => fiche(a));
    const quoi = el('span', 'q-what');
    quoi.append(el('span', 'q-titre', a.nom), el('span', 'q-sous', sous ?? `${Q.argent(a.cents, a.devise)} / ${libPeriode(a.periode)}`));
    b.append(el('span', 'q-when', date ? Q.jourLabel(date) : '—'), quoi);
    if (date) b.append(el('span', 'q-num', Q.argent(a.cents, a.devise)));
    b.ariaLabel = `${a.nom}, ${date ? `prochain renouvellement ${Q.dateLongue(date)}, ` : ''}${Q.argent(a.cents, a.devise)} par ${libPeriode(a.periode)}. Modifier`;
    li.append(b);
    return li;
  }

  function dessiner() {
    const auj = Q.aujourdhui(), actifs = items.filter(a => a.actif);
    vide.hidden = items.length > 0;
    // Échéances arrivées, pas encore confirmées.
    const dus = actifs.filter(a => a.next <= auj).sort((x, y) => x.next.localeCompare(y.next));
    aConfirmer.hidden = !dus.length;
    aConfirmer.replaceChildren(el('h3', 'q-h3', 'Échéances arrivées'), ...dus.map(a => {
      const box = el('div', 'q-du');
      box.append(el('p', 'q-texte', `${a.nom} · ${Q.argent(a.cents, a.devise)} · prévu ${Q.jourLabel(a.next, auj).toLowerCase()}`));
      const act = el('div', 'q-actions q-actions-left');
      const oui = button('primary q-small-btn', 'Payé : l’ajouter à mes dépenses', () => confirmer(a, oui));
      const non = button('ghost q-small-btn', 'Pas payé, passer', () => passer(a));
      oui.ariaLabel = `${a.nom}, échéance du ${Q.dateLongue(a.next)} : payée, l'ajouter à mes dépenses`;
      non.ariaLabel = `${a.nom}, échéance du ${Q.dateLongue(a.next)} : pas payée, passer à la suivante sans dépense`;
      act.append(oui, non);
      box.append(act);
      return box;
    }));
    // Prochains renouvellements : 30 jours.
    const fin = Q.plus(auj, 30);
    const p = Q.prevision(actifs, Q.plus(auj, 1), fin).slice(0, 5);
    prochains.hidden = !p.length && !dus.length && !items.length;
    prochains.replaceChildren(...(p.length ? [el('li', 'q-jour', 'Dans les 30 jours'), ...p.map(x => ligne(x.abo, x.date))] : items.length ? [el('li', 'q-plus', 'Aucun renouvellement prévu dans les 30 jours.')] : []));
    const est = Q.totaux(actifs.map(a => ({ cents: Q.equivalentMensuel(a), devise: a.devise })));
    meta.textContent = actifs.length ? `≈ ${Q.totauxTexte(est)} / mois` : '';
    estimation.hidden = !actifs.length;
    estimation.textContent = actifs.length ? `Équivalent mensuel estimé : ${Q.totauxTexte(est)}. C’est une estimation pour comparer (un abonnement annuel est divisé par 12), pas des paiements.` : '';
    dessinerGrand();
  }

  // ---------- Vue agrandie : la liste entière, les paiements enregistrés, la prévision (Pro) ----------
  function dessinerGrand() {
    const pro = qPro(), auj = Q.aujourdhui();
    const bloc = [];
    const outils = el('div', 'q-bar');
    const h = el('h3', 'q-h3', 'Tous mes abonnements');
    outils.append(h);
    if (pro) {
      const f = qSelect([['actifs', 'Actifs'], ['inactifs', 'Inactifs'], ['tous', 'Tous']], filtre);
      f.ariaLabel = 'Filtrer';
      f.onchange = () => { filtre = f.value; dessinerGrand(); };
      const g = qSelect([['aucun', 'Par date'], ['periode', 'Par fréquence'], ['devise', 'Par devise']], groupe);
      g.ariaLabel = 'Regrouper';
      g.onchange = () => { groupe = g.value; dessinerGrand(); };
      outils.append(f, g);
    }
    bloc.push(outils);
    // Gratuit : actifs puis inactifs. Pro : filtre et regroupement.
    const choisis = !pro ? [...items].sort((a, b) => (b.actif - a.actif) || a.next.localeCompare(b.next))
      : items.filter(a => filtre === 'tous' || (filtre === 'actifs') === a.actif).sort((a, b) => a.next.localeCompare(b.next));
    const groupes = !pro || groupe === 'aucun' ? [[null, choisis]]
      : Object.entries(groupe === 'periode' ? Q.PERIODES : Object.fromEntries(Object.keys(Q.DEVISES).map(d => [d, Q.DEVISES[d]])))
        .map(([k, nom]) => [nom, choisis.filter(a => (groupe === 'periode' ? a.periode : a.devise) === k)]).filter(([, l]) => l.length);
    for (const [nom, liste] of groupes) {
      if (nom) {
        const t = Q.totaux(liste.filter(a => a.actif).map(a => ({ cents: Q.equivalentMensuel(a), devise: a.devise })));
        bloc.push(el('h4', 'q-h4', `${nom} · ≈ ${Q.totauxTexte(t)} / mois estimés`));
      }
      const ul = el('ul', 'q-list q-cols');
      ul.append(...liste.map(a => ligne(a, a.actif ? a.next : null, `${Q.argent(a.cents, a.devise)} / ${libPeriode(a.periode)} · ≈ ${Q.argent(Q.equivalentMensuel(a), a.devise)} / mois${a.actif ? '' : ' · inactif'}`)));
      bloc.push(ul);
    }
    if (!choisis.length) bloc.push(el('p', 'q-aide', items.length ? 'Aucun abonnement dans ce filtre.' : 'Aucun abonnement suivi.'));

    // Les trois chiffres, séparés et nommés.
    const chiffres = el('section', 'q-trois');
    const payes = el('div', 'q-chiffre');
    payes.append(el('h4', 'q-h4', 'Payé ce mois-ci'), el('p', 'q-big-num', payesMois === null ? '…' : payesMois === false ? '—' : Q.totauxTexte(payesMois)),
      el('p', 'q-sous', payesMois === false ? 'Mes dépenses n’a pas pu se charger.' : 'Paiements confirmés, enregistrés dans Mes dépenses.'));
    const prevus = el('div', 'q-chiffre');
    const finMois = Q.plus(Q.plusMois(auj.slice(0, 7) + '-01', 1), -1);
    const reste = Q.totaux(Q.prevision(items.filter(a => a.actif), auj, finMois));
    prevus.append(el('h4', 'q-h4', 'Encore prévu ce mois-ci'), el('p', 'q-big-num', Q.totauxTexte(reste)), el('p', 'q-sous', 'Renouvellements à venir d’ici la fin du mois.'));
    const estim = el('div', 'q-chiffre');
    estim.append(el('h4', 'q-h4', 'Équivalent mensuel'), el('p', 'q-big-num', `≈ ${Q.totauxTexte(Q.totaux(items.filter(a => a.actif).map(a => ({ cents: Q.equivalentMensuel(a), devise: a.devise }))))}`), el('p', 'q-sous', 'Estimation pour comparer, pas des paiements.'));
    chiffres.append(payes, prevus, estim);
    bloc.push(chiffres);

    // Prévision (Pro).
    const prev = el('section', 'q-prevision');
    const ph = el('div', 'q-bar');
    const titre = el('h3', 'q-h3', 'Prévision');
    ph.append(titre);
    if (!pro) {
      titre.append(' ', qProChip());
      prev.append(ph, el('p', 'q-aide', 'Avec Pro : tous les paiements prévus sur 1, 3, 6 ou 12 mois, date par date.'), button('ghost', 'Voir Pro', () => qVerrou('La prévision des abonnements')));
    } else {
      const hz = qSelect([['1', '1 mois'], ['3', '3 mois'], ['6', '6 mois'], ['12', '12 mois']], String(horizon));
      hz.ariaLabel = 'Période de la prévision';
      hz.onchange = () => { horizon = Number(hz.value); dessinerGrand(); };
      ph.append(hz);
      const finP = Q.plus(Q.plusMois(auj, horizon), -1);
      const lignes = Q.prevision(items.filter(a => a.actif), auj, finP);
      prev.append(ph, el('p', 'q-texte', `Paiements prévus du ${Q.dateCourte(auj)} au ${Q.fmt(finP, { day: 'numeric', month: 'short', year: 'numeric' })} : ${Q.totauxTexte(Q.totaux(lignes))}, en ${lignes.length} paiement${lignes.length > 1 ? 's' : ''}.`));
      const ul = el('ul', 'q-list q-cols');
      ul.append(...lignes.slice(0, 120).map(x => ligne(x.abo, x.date)));
      prev.append(ul, el('p', 'q-aide', 'Prévu, pas encore payé : calculé depuis la date de renouvellement de chaque abonnement actif, au prix enregistré.'));
    }
    bloc.push(prev);
    grand.replaceChildren(...bloc);
  }

  async function chargerPayes() {
    if (apercu) { payesMois = {}; return; }
    const debut = Q.aujourdhui().slice(0, 7) + '-01';
    const { data: rows, error } = await sb.from('depenses').select('montant_centimes,devise').not('abonnement_id', 'is', null).gte('jour', debut).lte('jour', Q.plus(Q.plusMois(debut, 1), -1));
    payesMois = error ? false : Q.totaux(rows.map(r => ({ cents: r.montant_centimes, devise: r.devise })));
    dessinerGrand();
  }

  // ---------- Confirmer un paiement : une dépense liée, puis l'échéance suivante ----------
  async function confirmer(a, btn) {
    if (apercu) return;
    const echeance = a.next, cle = `${a.id}@${echeance}`;
    const f = el('form', 'q-form');
    const m = qInput('text', { inputMode: 'decimal', value: Q.saisie(a.cents), maxLength: 12 });
    const j = qInput('date', { value: echeance <= Q.aujourdhui() ? echeance : Q.aujourdhui(), min: '2000-01-01', max: '2100-12-31' });
    const err = el('p', 'note');
    err.hidden = true;
    err.setAttribute('role', 'alert');
    const r = el('div', 'q-row2');
    r.append(qChamp(`Montant payé (${a.devise})`, m), qChamp('Date du paiement', j));
    const ok = Object.assign(el('button', 'primary', 'Ajouter à mes dépenses'), { type: 'submit' });
    const act = el('div', 'q-actions');
    act.append(button('ghost', 'Annuler', () => d.close()), ok);
    f.append(el('p', 'q-texte', `${a.nom}, échéance du ${Q.dateLongue(echeance)}. Une dépense « Abonnements » sera créée, une seule fois.`), r, err, act);
    f.onsubmit = async e => {
      e.preventDefault();
      if (enCours.has(cle)) return;
      const cents = Q.centimes(m.value);
      err.hidden = false;
      if (cents === null) return void (err.textContent = 'Montant : un nombre positif, deux décimales au plus.');
      if (!Q.valide(j.value)) return void (err.textContent = 'Choisis une date.');
      enCours.add(cle);
      ok.disabled = btn.disabled = true;
      err.textContent = 'Enregistrement…';
      const { error } = await sb.from('depenses').insert({ montant_centimes: cents, devise: a.devise, jour: j.value, categorie: 'Abonnements', libelle: a.nom.slice(0, 80), abonnement_id: a.id, echeance });
      enCours.delete(cle);
      ok.disabled = btn.disabled = false;
      // 23505 : cette échéance a déjà sa dépense (autre onglet, nouvel essai) : on ne la recrée pas, on avance seulement.
      if (error && error.code !== '23505') return void (err.textContent = 'Pas enregistré : vérifie ta connexion, puis réessaie. Rien n’a été ajouté.');
      avancer(a, echeance, 'paye');
      document.dispatchEvent(new CustomEvent('renzvi:depenses', { detail: { from: 'abos' } }));
      chargerPayes();
      d.close();
    };
    const d = qFiche('Confirmer le paiement', f);
  }
  function passer(a) { avancer(a, a.next, 'saute'); }
  function avancer(a, echeance, comment) {
    items = items.map(x => x.id !== a.id || x.next !== echeance ? x : { ...x, payes: { ...x.payes, [echeance]: comment }, next: Q.echeanceSuivante(echeance, x.periode, x.ancre) });
    persist();
    dessiner();
  }

  // ---------- La fiche d'un abonnement ----------
  function fiche(a) {
    if (apercu) return;
    if (!a && items.length >= ABOS_MAX) return qConfirmer('Liste pleine', `Tu suis déjà ${ABOS_MAX} abonnements. Supprimes-en un pour continuer.`, 'Compris');
    const f = el('form', 'q-form');
    const nom = qInput('text', { value: a?.nom ?? '', maxLength: 40, placeholder: 'Musique, stockage, salle de sport…' });
    const m = qInput('text', { inputMode: 'decimal', value: a ? Q.saisie(a.cents) : '', maxLength: 12, placeholder: '0,00' });
    const dv = qSelect(Object.entries(Q.DEVISES).map(([k, v]) => [k, `${v} (${k})`]), a?.devise ?? Q.DEVISE);
    const per = qSelect(Object.entries(Q.PERIODES), a?.periode ?? 'mois');
    const next = qInput('date', { value: a?.next ?? '', min: '2000-01-01', max: '2100-12-31' });
    const lien = qInput('url', { value: a?.lien ?? '', maxLength: 300, placeholder: 'https://… (facultatif)' });
    const notes = Object.assign(el('textarea', 'q-textarea'), { value: a?.notes ?? '', maxLength: 300, rows: 2, placeholder: 'Facultatif' });
    const actif = qInput('checkbox', { checked: a ? a.actif : true });
    const err = el('p', 'note');
    err.hidden = true;
    err.setAttribute('role', 'alert');
    const r1 = el('div', 'q-row2'), r2 = el('div', 'q-row2');
    r1.append(qChamp('Montant', m), qChamp('Devise', dv));
    r2.append(qChamp('Fréquence', per), qChamp('Prochain renouvellement', next));
    const act = el('label', 'q-check');
    act.append(actif, el('span', '', 'Actif (décoche s’il est résilié ou en pause : il reste dans ta liste)'));
    const actions = el('div', 'q-actions');
    if (a) actions.append(button('ghost q-left q-danger-text', 'Supprimer', async () => {
      if (!await qConfirmer('Supprimer l’abonnement', `Ne plus suivre « ${a.nom} » ? Les paiements déjà enregistrés restent dans Mes dépenses. Rien n’est résilié chez le service.`)) return;
      items = items.filter(x => x.id !== a.id); persist(); dessiner(); d.close();
    }));
    actions.append(button('ghost', 'Annuler', () => d.close()), Object.assign(el('button', 'primary', a ? 'Enregistrer' : 'Ajouter'), { type: 'submit' }));
    f.append(qChamp('Service', nom), r1, r2, act, qChamp('Lien pour le gérer', lien, 'Ouvre le site du service. Renzvi ne résilie rien à ta place.'), qChamp('Notes', notes));
    if (a?.lien) {
      const go = Object.assign(el('a', 'q-link', `Ouvrir le site de ${a.nom} ↗`), { href: a.lien, target: '_blank', rel: 'noopener noreferrer' });
      f.append(go);
    }
    f.append(err, actions);
    f.onsubmit = e => {
      e.preventDefault();
      err.hidden = false;
      const cents = Q.centimes(m.value);
      if (!nom.value.trim()) { nom.focus(); return void (err.textContent = 'Donne le nom du service.'); }
      if (cents === null) { m.focus(); return void (err.textContent = 'Montant : un nombre positif, deux décimales au plus (ex. : 9,99).'); }
      if (!Q.valide(next.value)) { next.focus(); return void (err.textContent = 'Indique la date du prochain renouvellement.'); }
      const url = lien.value.trim();
      if (url && !/^https:\/\/[^\s]+\.[^\s]+$/.test(url)) { lien.focus(); return void (err.textContent = 'Le lien doit commencer par https://'); }
      const neuf = abosNettoyer({ items: [{
        id: a?.id ?? crypto.randomUUID(), nom: nom.value, cents, devise: dv.value, periode: per.value, next: next.value,
        ancre: a && a.next === next.value ? a.ancre : Number(next.value.slice(8)), actif: actif.checked, notes: notes.value, lien: url, payes: a?.payes,
      }] })[0];
      items = a ? items.map(x => x.id === a.id ? neuf : x) : [...items, neuf];
      persist(); dessiner(); d.close();
    };
    const d = qFiche(a ? `Modifier ${a.nom}` : 'Nouvel abonnement', f);
  }

  dessiner();
  chargerPayes();
  if (apercu) return null;
  const stop = qEcouter('abos', 'abos', () => { items = abosNettoyer(peer('abos')); dessiner(); });
  const stopPlan = qEcouterPlan(dessiner);
  const recharger = e => { if (e.detail?.from !== 'abos') chargerPayes(); };
  document.addEventListener('renzvi:depenses', recharger);
  const minute = setInterval(() => { if (!document.hidden) dessiner(); }, 60000);
  return () => { stop(); stopPlan(); clearInterval(minute); document.removeEventListener('renzvi:depenses', recharger); };
}
