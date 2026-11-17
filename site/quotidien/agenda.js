// Agenda : un calendrier personnel saisi à la main. Données dans widget_state, ligne « agenda » : { events, modeles }.
// Heures « murales » de l'appareil (voir quotidien/core.js) : pas de synchronisation Google/Apple, pas de rappel ni de
// notification (rien ne tourne quand l'appli est fermée, donc on n'en promet pas).
// Gratuit : rendez-vous ponctuels, vues jour et semaine, modification. Pro : répétitions et modèles.
// Utilise Q, qFiche, qConfirmer, qChamp, qInput, qSelect, qPro, qVerrou, qProChip, qEcouter (quotidien/core.js) et el, button (dashboard.html).

const AGENDA_MAX = 400, AGENDA_MAX_MODELES = 12;

function agendaWidget({ body, meta, data, save, peer, apercu }) {
  let events = [], modeles = [];
  const lire = d => {
    events = (Array.isArray(d?.events) ? d.events : []).map(Q.nettoyerEvenement).filter(Boolean).slice(0, AGENDA_MAX);
    modeles = (Array.isArray(d?.modeles) ? d.modeles : []).filter(m => m && typeof m.id === 'string' && typeof m.t === 'string').slice(0, AGENDA_MAX_MODELES);
  };
  lire(data);
  const persist = () => save({ events, modeles });
  let vue = 'semaine', ref = Q.aujourdhui();

  // ---------- Compact : les prochains rendez-vous ----------
  const petit = el('div', 'q-small');
  const ajouter = button('ghost q-add', 'Nouveau rendez-vous', () => fiche(null));
  const liste = el('ul', 'q-list');
  const vide = el('div', 'empty q-empty');
  vide.append(el('p', '', 'Aucun rendez-vous dans les deux semaines.'));
  petit.append(ajouter, vide, liste);

  // ---------- Agrandi : jour ou semaine ----------
  const grand = el('div', 'q-big');
  const barre = el('div', 'q-bar');
  const choix = el('div', 'choices');
  choix.setAttribute('role', 'group');
  choix.ariaLabel = 'Affichage';
  const bJour = button('', 'Jour', () => { vue = 'jour'; dessiner(); });
  const bSemaine = button('', 'Semaine', () => { vue = 'semaine'; dessiner(); });
  choix.append(bJour, bSemaine);
  const nav = el('div', 'q-nav');
  const prec = button('ghost q-icon', '‹', () => { ref = Q.plus(ref, vue === 'jour' ? -1 : -7); dessiner(); });
  const suiv = button('ghost q-icon', '›', () => { ref = Q.plus(ref, vue === 'jour' ? 1 : 7); dessiner(); });
  const auj = button('ghost', "Aujourd'hui", () => { ref = Q.aujourdhui(); dessiner(); });
  nav.append(prec, auj, suiv);
  const titre = el('h3', 'q-periode');
  titre.setAttribute('aria-live', 'polite');
  const nouveau = button('primary', 'Nouveau rendez-vous', () => fiche(null, vue === 'jour' ? ref : null));
  barre.append(titre, nav, choix, nouveau);
  const grille = el('div', 'q-semaine');
  const modelesBox = el('section', 'q-modeles');
  grand.append(barre, grille, modelesBox);
  body.append(petit, grand);

  function ligne(o, jour, avecJour) {
    const li = el('li', 'q-item');
    const b = button('q-item-btn', '', () => fiche(o));
    const quand = el('span', 'q-when', Q.horaire(o, jour));
    const quoi = el('span', 'q-what');
    quoi.append(el('span', 'q-titre', o.e.t));
    const sous = [avecJour ? Q.jourLabel(jour) : '', o.e.lieu ?? '', o.e.r ? Q.FREQS[o.e.r.freq] : ''].filter(Boolean).join(' · ');
    if (sous) quoi.append(el('span', 'q-sous', sous));
    b.append(quand, quoi);
    b.ariaLabel = `${o.e.t}, ${Q.jourLabel(jour)}, ${Q.horaire(o, jour)}${o.e.lieu ? `, ${o.e.lieu}` : ''}. Modifier`;
    li.append(b);
    return li;
  }

  function dessiner() {
    const today = Q.aujourdhui();
    // Compact : 14 jours, au plus 6 lignes ; un rendez-vous de plusieurs jours n'apparaît qu'une fois, à son premier jour visible.
    const occ = Q.occurrences(events, today, Q.plus(today, 13));
    const now = Q.maintenant();
    const restants = occ.filter(o => !(o.fin === today && !o.e.all && o.debut === today && Q.minutes(o.e.h2) <= now && o.e.h2 !== o.e.h1));
    meta.textContent = restants.length ? `${restants.length} à venir` : '';
    vide.hidden = restants.length > 0;
    liste.hidden = !restants.length;
    let dernierJour = null;
    liste.replaceChildren(...restants.slice(0, 6).flatMap(o => {
      const jour = o.debut < today ? today : o.debut;
      const out = [];
      if (jour !== dernierJour) { out.push(el('li', 'q-jour', Q.jourLabel(jour, today))); dernierJour = jour; }
      out.push(ligne(o, jour, false));
      return out;
    }));
    if (restants.length > 6) liste.append(el('li', 'q-plus', `Et ${restants.length - 6} autres : agrandis l'agenda pour tout voir.`));

    // Agrandi
    bJour.setAttribute('aria-pressed', vue === 'jour');
    bSemaine.setAttribute('aria-pressed', vue === 'semaine');
    const debut = vue === 'jour' ? ref : Q.lundi(ref), fin = vue === 'jour' ? ref : Q.plus(debut, 6);
    titre.textContent = vue === 'jour' ? Q.dateLongue(ref)
      : debut.slice(0, 7) === fin.slice(0, 7) ? `Semaine du ${Number(debut.slice(8))} au ${Q.fmt(fin, { day: 'numeric', month: 'long', year: 'numeric' })}`
      : `Semaine du ${Q.fmt(debut, { day: 'numeric', month: 'long' })} au ${Q.fmt(fin, { day: 'numeric', month: 'long', year: 'numeric' })}`;
    prec.ariaLabel = vue === 'jour' ? 'Jour précédent' : 'Semaine précédente';
    suiv.ariaLabel = vue === 'jour' ? 'Jour suivant' : 'Semaine suivante';
    const occP = Q.occurrences(events, debut, fin);
    grille.dataset.vue = vue;
    const jours = [];
    for (let k = debut; k <= fin; k = Q.plus(k, 1)) {
      const col = el('section', `q-col${k === today ? ' today' : ''}${Q.jourSemaine(k) > 4 ? ' we' : ''}`);
      const h = el('h4', 'q-col-head');
      h.append(el('span', 'q-dow', Q.majuscule(Q.fmt(k, { weekday: vue === 'jour' ? 'long' : 'short' }))), el('span', 'q-dnum', String(Number(k.slice(8)))));
      const ul = el('ul', 'q-list');
      const ici = occP.filter(o => o.debut <= k && o.fin >= k);
      for (const o of ici) ul.append(ligne(o, k, false));
      const plus = button('q-col-add', '', () => fiche(null, k));
      plus.ariaLabel = `Ajouter un rendez-vous le ${Q.dateLongue(k)}`;
      plus.textContent = ici.length ? '+' : 'Libre';
      col.append(h, ul, plus);
      jours.push(col);
    }
    grille.replaceChildren(...jours);
    // Modèles (Pro) : visibles même après un retour en Gratuit, rien n'est effacé.
    modelesBox.hidden = !modeles.length;
    if (modeles.length) {
      const ul = el('ul', 'q-tags');
      for (const m of modeles) {
        const li = el('li', 'q-tag');
        const x = button('x', '×', async () => {
          if (!await qConfirmer('Supprimer le modèle', `« ${m.t} » ne sera plus proposé. Les rendez-vous déjà créés ne changent pas.`)) return;
          modeles = modeles.filter(y => y !== m); persist(); dessiner();
        });
        x.ariaLabel = `Supprimer le modèle ${m.t}`;
        li.append(el('span', '', m.t), x);
        ul.append(li);
      }
      modelesBox.replaceChildren(el('h3', 'q-h3', 'Mes modèles'), ul);
    }
  }

  // ---------- La fiche d'un rendez-vous ----------
  // o : une occurrence existante (modifier) ou null (créer). jour : date proposée pour un nouveau.
  function fiche(o, jour) {
    if (apercu) return;
    const serie = o?.e.r ? o.e : null;
    const base = o ? { ...o.e, d: o.debut, f: o.fin } : { t: '', d: jour ?? Q.aujourdhui(), f: jour ?? Q.aujourdhui(), all: false, h1: prochaineHeure(), h2: null };
    if (!o) base.h2 = ajouterMinutes(base.h1, 60);
    const form = el('form', 'q-form');
    form.noValidate = true;
    const t = qInput('text', { value: base.t, maxLength: 80, required: true, placeholder: 'Dentiste, réunion, anniversaire…' });
    const all = qInput('checkbox', { checked: !!base.all });
    const d = qInput('date', { value: base.d, required: true, min: '2000-01-01', max: '2100-12-31' });
    const h1 = qInput('time', { value: base.h1 ?? '09:00', step: 300 });
    const f = qInput('date', { value: base.f, min: '2000-01-01', max: '2100-12-31' });
    const h2 = qInput('time', { value: base.h2 ?? base.h1 ?? '10:00', step: 300 });
    const lieu = qInput('text', { value: base.lieu ?? '', maxLength: 80, placeholder: 'Facultatif' });
    const notes = Object.assign(el('textarea', 'q-textarea'), { value: base.notes ?? '', maxLength: 500, rows: 3, placeholder: 'Facultatif' });
    const rep = qSelect([['', 'Ne se répète pas'], ...Object.entries(Q.FREQS)], base.r?.freq ?? '');
    const repFin = qInput('date', { value: base.r?.fin ?? '', min: base.d, max: '2100-12-31' });
    const info = el('p', 'q-aide q-info');
    info.setAttribute('aria-live', 'polite');
    const erreur = el('p', 'note');
    erreur.hidden = true;
    erreur.setAttribute('role', 'alert');

    const allLabel = el('label', 'q-check');
    allLabel.append(all, el('span', '', 'Toute la journée'));
    const ligneDebut = el('div', 'q-row2'), ligneFin = el('div', 'q-row2');
    ligneDebut.append(qChamp('Début', d), qChamp('Heure', h1));
    ligneFin.append(qChamp('Fin', f), qChamp('Heure', h2));
    const repBox = el('div', 'q-row2');
    const repChamp = qChamp('Répétition', rep);
    if (!qPro()) repChamp.querySelector('.q-label').append(' ', qProChip());
    const repFinChamp = qChamp('Jusqu’au (facultatif)', repFin);
    repBox.append(repChamp, repFinChamp);

    // Modèles (Pro) : partir d'un modèle quand on crée.
    let modeleSel = null;
    if (!o && modeles.length) {
      modeleSel = qSelect([['', 'Aucun'], ...modeles.map(m => [m.id, m.t])], '');
      const ch = qChamp('Partir d’un modèle', modeleSel);
      if (!qPro()) ch.querySelector('.q-label').append(' ', qProChip());
      modeleSel.onchange = () => {
        const m = modeles.find(x => x.id === modeleSel.value);
        if (!m) return;
        if (qVerrou('Les modèles de rendez-vous')) { modeleSel.value = ''; return; }
        t.value = m.t; all.checked = !!m.all; lieu.value = m.lieu ?? ''; notes.value = m.notes ?? '';
        if (!m.all) { h1.value = m.h1; h2.value = m.h2; }
        f.value = Q.plus(d.value, m.jours ?? 0);
        if (m.r) rep.value = m.r.freq;
        maj();
      };
      form.append(ch);
    }

    // Portée, pour un rendez-vous qui se répète : dite avant d'enregistrer ou de supprimer, jamais devinée.
    let portee = null;
    const porteeBox = el('fieldset', 'q-portee');
    if (serie) {
      porteeBox.append(el('legend', 'q-label', 'Ce rendez-vous se répète. Appliquer à :'));
      for (const [v, txt] of [['un', 'Ce rendez-vous seulement'], ['suite', 'Celui-ci et les suivants'], ['serie', 'Toute la série']]) {
        const r = qInput('radio', { name: 'portee', value: v, checked: v === 'un' });
        const lab = el('label', 'q-check');
        lab.append(r, el('span', '', txt));
        porteeBox.append(lab);
      }
      portee = () => porteeBox.querySelector('input:checked').value;
    }

    const actions = el('div', 'q-actions');
    if (o) actions.append(button('ghost q-left q-danger-text', 'Supprimer', () => supprimer()));
    if (o || modeles.length < AGENDA_MAX_MODELES) {
      const garder = button('ghost', 'Garder comme modèle', () => {
        if (qVerrou('Les modèles de rendez-vous')) return;
        const e = lireForm();
        if (!e) return;
        if (modeles.length >= AGENDA_MAX_MODELES) return montrer(`${AGENDA_MAX_MODELES} modèles au plus. Supprimes-en un dans la vue agrandie.`);
        modeles = [...modeles, { id: crypto.randomUUID(), t: e.t, all: e.all, h1: e.h1, h2: e.h2, jours: Q.ecart(e.d, e.f), lieu: e.lieu, notes: e.notes, r: e.r ? { freq: e.r.freq } : undefined }];
        persist();
        dessiner();
        info.textContent = `Modèle « ${e.t} » gardé.`;
      });
      if (!qPro()) garder.append(' ', qProChip());
      actions.append(garder);
    }
    actions.append(button('ghost', 'Annuler', () => dlg.close()), Object.assign(el('button', 'primary', o ? 'Enregistrer' : 'Ajouter'), { type: 'submit' }));

    form.append(qChamp('Titre', t), allLabel, ligneDebut, ligneFin, info, qChamp('Lieu', lieu), qChamp('Notes', notes), repBox);
    if (serie) form.append(porteeBox);
    form.append(erreur, actions);

    function maj() {
      ligneDebut.classList.toggle('q-sans-heure', all.checked);
      ligneFin.classList.toggle('q-sans-heure', all.checked);
      h1.disabled = h2.disabled = all.checked;
      repFinChamp.hidden = !rep.value;
      repFin.min = d.value;
      if (f.value < d.value) f.value = d.value;
      const e = Q.nettoyerEvenement({ id: 'x', t: 'x', d: d.value, f: f.value, all: all.checked, h1: h1.value, h2: h2.value });
      info.textContent = !e || all.checked ? '' : e.f !== f.value ? `Finit le lendemain, à ${h2.value.replace(':', ' h ')}.` : '';
    }
    let ancienDebut = d.value;
    d.onchange = () => {
      // Déplacer le début déplace la fin d'autant : la durée est gardée.
      if (Q.valide(d.value) && Q.valide(ancienDebut) && Q.valide(f.value)) f.value = Q.plus(d.value, Q.ecart(ancienDebut, f.value));
      ancienDebut = d.value;
      maj();
    };
    // Déplacer l'heure de début déplace la fin d'autant (la durée est gardée), comme pour la date.
    let ancienneHeure = h1.value;
    h1.onchange = () => {
      if (Q.heureValide(h1.value) && Q.heureValide(ancienneHeure) && Q.heureValide(h2.value) && d.value === f.value) {
        const duree = (Q.minutes(h2.value) - Q.minutes(ancienneHeure) + 1440) % 1440 || 60;
        const fin = Q.minutes(h1.value) + duree;
        h2.value = `${String(Math.floor(fin / 60) % 24).padStart(2, '0')}:${String(fin % 60).padStart(2, '0')}`;
      }
      ancienneHeure = h1.value;
      maj();
    };
    for (const x of [all, f, h2]) x.onchange = maj;
    rep.onchange = () => {
      if (rep.value && qVerrou('Les rendez-vous qui se répètent')) rep.value = '';
      maj();
    };
    maj();

    const montrer = txt => { erreur.textContent = txt; erreur.hidden = false; };
    function lireForm() {
      erreur.hidden = true;
      if (!t.value.trim()) { t.focus(); return montrer('Donne un titre au rendez-vous.'), null; }
      if (!Q.valide(d.value)) { d.focus(); return montrer('Choisis une date de début valide.'), null; }
      if (!Q.valide(f.value) || f.value < d.value) { f.focus(); return montrer('La fin doit être le même jour que le début, ou après.'), null; }
      if (!all.checked && (!Q.heureValide(h1.value) || !Q.heureValide(h2.value))) { h1.focus(); return montrer('Indique l’heure de début et de fin.'), null; }
      if (Q.ecart(d.value, f.value) > 60) { f.focus(); return montrer('Un rendez-vous dure 60 jours au plus.'), null; }
      if (rep.value && repFin.value && (!Q.valide(repFin.value) || repFin.value < d.value)) { repFin.focus(); return montrer('La fin de la répétition doit venir après le début.'), null; }
      const e = Q.nettoyerEvenement({
        id: 'x', t: t.value, d: d.value, f: f.value, all: all.checked, h1: h1.value, h2: h2.value, lieu: lieu.value, notes: notes.value,
        r: rep.value ? { freq: rep.value, fin: repFin.value || undefined } : undefined,
      });
      if (!all.checked && e.f === e.d && Q.minutes(e.h2) < Q.minutes(e.h1)) { h2.focus(); return montrer('L’heure de fin vient avant le début.'), null; }
      return e;
    }

    form.onsubmit = ev => {
      ev.preventDefault();
      const e = lireForm();
      if (!e) return;
      const sans = x => { const { id, ...rest } = x; return rest; };
      if (!o) {
        if (events.length >= AGENDA_MAX) return montrer(`Ton agenda est plein (${AGENDA_MAX} rendez-vous). Supprimes-en d'anciens pour continuer.`);
        events = [...events, { ...e, id: crypto.randomUUID() }];
      } else if (!serie || portee() === 'serie') {
        // Toute la série : un changement de date décale la série d'autant.
        const decal = serie ? Q.ecart(o.debut, e.d) : 0;
        const neuf = serie ? { ...sans(e), id: serie.id, d: Q.plus(serie.d, decal), f: Q.plus(serie.d, decal + Q.ecart(e.d, e.f)), ex: (serie.ex ?? []).map(x => Q.plus(x, decal)) } : { ...sans(e), id: o.e.id, ...(o.e.de ? { de: o.e.de } : {}) };
        if (serie && !e.r) delete neuf.ex; // la série ne se répète plus : il reste le premier rendez-vous
        events = events.map(x => x.id === o.e.id ? Q.nettoyerEvenement(neuf) : x);
      } else if (portee() === 'un') {
        // Celui-ci seulement : la série saute ce jour, une copie modifiée prend sa place.
        const { r, ...seul } = e;
        events = events.map(x => x.id === serie.id ? { ...x, ex: [...(x.ex ?? []), o.debut] } : x);
        events = [...events, Q.nettoyerEvenement({ ...seul, id: crypto.randomUUID(), de: serie.id })];
      } else {
        const { avant, apres } = Q.couperSerie(serie, o.debut, crypto.randomUUID());
        const suite = Q.nettoyerEvenement({ ...sans(e), id: apres.id, ex: apres.ex.map(x => Q.plus(x, Q.ecart(o.debut, e.d))) });
        events = [...events.filter(x => x.id !== serie.id), ...(avant ? [avant] : []), suite];
      }
      persist();
      dessiner();
      dlg.close();
    };

    async function supprimer() {
      const p = serie ? portee() : null;
      const quoi = !serie ? `« ${o.e.t} » du ${Q.dateLongue(o.debut)}` : p === 'un' ? `le rendez-vous du ${Q.dateLongue(o.debut)}` : p === 'suite' ? `ce rendez-vous et tous les suivants` : `toute la série « ${o.e.t} »`;
      if (!await qConfirmer('Supprimer', `Supprimer ${quoi} ? Rien d'autre n'est touché.`)) return;
      if (!serie || p === 'serie') events = events.filter(x => x.id !== o.e.id);
      else if (p === 'un') events = events.map(x => x.id === serie.id ? { ...x, ex: [...(x.ex ?? []), o.debut] } : x);
      else {
        const { avant } = Q.couperSerie(serie, o.debut, 'x');
        events = events.filter(x => x.id !== serie.id).concat(avant ? [avant] : []);
      }
      persist();
      dessiner();
      if (dlg.open) dlg.close();
    }
    const dlg = qFiche(o ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous', form);
  }

  const prochaineHeure = () => { const m = Math.min(23 * 60, Math.ceil((Q.maintenant() + 1) / 60) * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:00`; };
  // Après minuit, la fin passe au lendemain (23:00 + 1 h = 00:00, que nettoyerEvenement place le jour suivant).
  const ajouterMinutes = (h, n) => { const m = (Q.minutes(h) + n) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

  dessiner();
  if (apercu) return null;
  // Ouvrir un rendez-vous depuis Aujourd'hui.
  const ouvrir = e => {
    const [id, jour] = String(e.detail?.cle ?? '').split('@');
    const o = Q.occurrences(events, jour, jour).find(x => x.e.id === id);
    if (!o) return;
    ref = jour; vue = 'jour'; dessiner();
    fiche(o);
    e.detail.ok = true;
  };
  document.addEventListener('renzvi:agenda', ouvrir);
  // Le jour change pendant que l'écran reste ouvert : les « Aujourd'hui » et « Demain » se mettent à jour.
  const minute = setInterval(dessiner, 60000);
  const stop = qEcouter('agenda', 'agenda', () => { lire(peer('agenda')); dessiner(); });
  return () => { clearInterval(minute); stop(); document.removeEventListener('renzvi:agenda', ouvrir); };
}
