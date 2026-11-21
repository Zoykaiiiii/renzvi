// Aujourd'hui : la journée en un coup d'œil, lue dans les widgets de la personne (aucune copie des données).
// Tâches (échéance du jour, en retard), habitudes du jour, rendez-vous de l'Agenda, échéances proches (tâches, Compte à
// rebours, renouvellements de Mes abonnements). Cocher ici modifie la tâche ou l'habitude d'origine (savePeer).
// Rien n'est inventé : pas de suggestion, pas de statistique de motivation, aucune tâche déplacée toute seule.
// Gratuit : la vue du jour, cocher, ouvrir. Pro : choisir et ordonner les sections, préparer demain.
// Préférences dans widget_state, ligne « aujourdhui » : { sections: [id…], masquees: [id…] }.

const AUJ_SECTIONS = { retard: 'En retard', taches: 'Tâches du jour', agenda: 'Rendez-vous', habitudes: 'Habitudes', echeances: 'Bientôt' };
const AUJ_SOURCES = ['taches', 'habitudes', 'agenda', 'compte', 'abos'];

function aujourdhuiWidget({ body, meta, data, save, peer, savePeer, apercu }) {
  const ordre = () => {
    const s = Array.isArray(data?.sections) ? data.sections.filter(x => AUJ_SECTIONS[x]) : [];
    return [...new Set([...s, ...Object.keys(AUJ_SECTIONS)])];
  };
  let prefs = { sections: ordre(), masquees: Array.isArray(data?.masquees) ? data.masquees.filter(x => AUJ_SECTIONS[x]) : [] };
  let quand = 'auj';
  const cocheesIci = new Set(); // cochées dans cette visite : elles restent visibles, barrées, pour pouvoir les décocher

  const haut = el('div', 'q-bar q-bar-small');
  const choix = el('div', 'choices');
  choix.setAttribute('role', 'group');
  choix.ariaLabel = 'Jour affiché';
  const bAuj = button('', "Aujourd'hui", () => { quand = 'auj'; dessiner(); });
  const bDem = button('', 'Demain', () => { if (qVerrou('Préparer demain')) return; quand = 'dem'; dessiner(); });
  choix.append(bAuj, bDem);
  const organiser = button('ghost q-small-btn', 'Organiser', () => reglages());
  haut.append(choix, organiser);
  const contenu = el('div', 'q-auj');
  const vide = el('div', 'empty q-empty');
  body.append(haut, vide, contenu);

  const items = id => Array.isArray(peer(id)?.items) ? peer(id).items : [];

  function cocherTache(t, fait) {
    if (fait) cocheesIci.add(t.id);
    savePeer('taches', { ...(peer('taches') ?? {}), items: items('taches').map(x => x.id === t.id ? { ...x, done: fait } : x) });
    dessiner();
  }
  function cocherHabitude(h, jour, fait) {
    const jours = Array.isArray(h.days) ? h.days : [];
    savePeer('habitudes', { ...(peer('habitudes') ?? {}), items: items('habitudes').map(x => x.id === h.id ? { ...x, days: fait ? [...new Set([...jours, jour])] : jours.filter(d => d !== jour) } : x) });
    dessiner();
  }

  function ouvrir(id, zoom = false) {
    if (apercu) return true;
    const detail = { id, zoom };
    document.dispatchEvent(new CustomEvent('renzvi:ouvrir', { detail }));
    return zoom ? detail.opened : detail.ok;
  }
  // Le lien « Ouvrir » d'une section ; si le widget n'est pas sur l'écran, on propose de l'ajouter ici (rien n'est fait sans clic).
  function lienOuvrir(id, nom) {
    const b = button('q-link', 'Ouvrir', () => {
      if (ouvrir(id)) return;
      const p = el('p', 'q-aide');
      p.append(`${nom} n'est pas sur ton écran. `);
      p.append(button('q-link', 'L’ajouter sur cette page', () => { qAjouterWidget(id); p.remove(); }));
      b.closest('.q-sec').append(p);
      b.remove();
    });
    b.ariaLabel = `Ouvrir ${nom}`;
    return b;
  }

  function section(id, lignes, source, nom) {
    const sec = el('section', `q-sec q-sec-${id}`);
    const h = el('div', 'q-sec-head');
    const titre = el('h3', 'q-h3', id === 'echeances' ? (quand === 'auj' ? 'Dans les 7 jours' : 'Après demain') : id === 'taches' && quand === 'dem' ? 'Tâches de demain' : AUJ_SECTIONS[id]);
    h.append(titre, el('span', 'q-count', String(lignes.length)));
    if (source) h.append(lienOuvrir(source, nom));
    const ul = el('ul', 'q-list');
    ul.append(...lignes);
    sec.append(h, ul);
    return sec;
  }

  function ligneTache(t, jour, retard) {
    const li = el('li', `q-item q-check-row${t.done ? ' done' : ''}`);
    const lab = el('label');
    const c = qInput('checkbox', { checked: !!t.done, disabled: !!apercu });
    c.onchange = () => cocherTache(t, c.checked);
    const quoi = el('span', 'q-what');
    quoi.append(el('span', 'q-titre', t.text));
    if (retard) quoi.append(el('span', 'q-sous q-late', `Prévue ${Q.jourLabel(t.due, jour).toLowerCase()} · ${Q.ecart(t.due, jour) > 1 ? `${Q.ecart(t.due, jour)} jours de retard` : '1 jour de retard'}`));
    lab.append(c, quoi);
    li.append(lab);
    return li;
  }

  function dessiner() {
    const today = Q.aujourdhui(), jour = quand === 'auj' ? today : Q.plus(today, 1);
    const pro = qPro();
    if (quand === 'dem' && !pro) quand = 'auj';
    bAuj.setAttribute('aria-pressed', quand === 'auj');
    bDem.setAttribute('aria-pressed', quand === 'dem');
    if (!pro) { bDem.replaceChildren('Demain ', qProChip()); organiser.replaceChildren('Organiser ', qProChip()); }
    else { bDem.textContent = 'Demain'; organiser.textContent = 'Organiser'; }
    meta.textContent = Q.majuscule(Q.fmt(jour, { weekday: 'long', day: 'numeric', month: 'long' }));

    const taches = items('taches').filter(t => t && typeof t.text === 'string');
    const avecDate = taches.filter(t => Q.valide(t.due));
    const blocs = {};
    // En retard : seulement aujourd'hui (demain, ce serait une supposition sur ce qui sera fait d'ici là).
    if (quand === 'auj') {
      const retard = avecDate.filter(t => t.due < today && (!t.done || cocheesIci.has(t.id))).sort((a, b) => a.due.localeCompare(b.due));
      if (retard.length) blocs.retard = section('retard', retard.map(t => ligneTache(t, today, true)), 'taches', 'Tâches');
    }
    const duJour = avecDate.filter(t => t.due === jour && (!t.done || cocheesIci.has(t.id) || quand === 'auj'));
    if (duJour.length) blocs.taches = section('taches', duJour.map(t => ligneTache(t, jour, false)), 'taches', 'Tâches');

    const evts = (Array.isArray(peer('agenda')?.events) ? peer('agenda').events : []).map(Q.nettoyerEvenement).filter(Boolean);
    const rdv = Q.occurrences(evts, jour, jour);
    if (rdv.length) blocs.agenda = section('agenda', rdv.map(o => {
      const li = el('li', 'q-item');
      const b = button('q-item-btn', '', () => voirRdv(o, jour));
      const quoi = el('span', 'q-what');
      quoi.append(el('span', 'q-titre', o.e.t));
      if (o.e.lieu) quoi.append(el('span', 'q-sous', o.e.lieu));
      b.append(el('span', 'q-when', Q.horaire(o, jour)), quoi);
      b.ariaLabel = `${o.e.t}, ${Q.horaire(o, jour)}${o.e.lieu ? `, ${o.e.lieu}` : ''}. Ouvrir`;
      li.append(b);
      return li;
    }), 'agenda', 'Agenda');

    const habitudes = items('habitudes').filter(h => h && typeof h.name === 'string');
    if (habitudes.length) blocs.habitudes = section('habitudes', habitudes.map(h => {
      const fait = Array.isArray(h.days) && h.days.includes(jour);
      const li = el('li', `q-item q-check-row${fait ? ' done' : ''}`);
      if (quand === 'dem') { li.append(el('span', 'q-titre q-pad', h.name)); return li; }
      const lab = el('label');
      const c = qInput('checkbox', { checked: fait, disabled: !!apercu });
      c.onchange = () => cocherHabitude(h, jour, c.checked);
      lab.append(c, el('span', 'q-titre', h.name));
      li.append(lab);
      return li;
    }), 'habitudes', 'Habitudes');

    // Bientôt : 7 jours après le jour affiché. Tâches datées, comptes à rebours, renouvellements prévus (jamais « payés »).
    const de = Q.plus(jour, 1), a = Q.plus(jour, 7), bientot = [];
    for (const t of avecDate) if (!t.done && t.due >= de && t.due <= a) bientot.push({ date: t.due, quoi: t.text, type: 'Tâche', src: 'taches' });
    for (const c of items('compte')) if (c && Q.valide(c.date) && c.date >= de && c.date <= a && typeof c.title === 'string') bientot.push({ date: c.date, quoi: c.title, type: 'Compte à rebours', src: 'compte' });
    for (const ab of items('abos')) if (ab && ab.actif && typeof ab.nom === 'string') for (const d of Q.echeances(ab, de, a)) bientot.push({ date: d, quoi: ab.nom, type: `Renouvellement prévu · ${Q.argent(ab.cents, ab.devise)}`, src: 'abos' });
    bientot.sort((x, y) => x.date.localeCompare(y.date) || x.quoi.localeCompare(y.quoi));
    if (bientot.length) blocs.echeances = section('echeances', bientot.map(x => {
      const li = el('li', 'q-item');
      const b = button('q-item-btn', '', () => ouvrir(x.src));
      const quoi = el('span', 'q-what');
      quoi.append(el('span', 'q-titre', x.quoi), el('span', 'q-sous', x.type));
      b.append(el('span', 'q-when', Q.jourLabel(x.date, today)), quoi);
      b.ariaLabel = `${x.quoi}, ${Q.jourLabel(x.date, today)}, ${x.type}`;
      li.append(b);
      return li;
    }));

    const visibles = prefs.sections.filter(id => !(pro && prefs.masquees.includes(id)) && blocs[id]);
    // Gratuit : l'ordre de départ, toutes les sections. Les réglages Pro restent gardés et reviennent avec Pro.
    const ordreAffiche = pro ? visibles : Object.keys(AUJ_SECTIONS).filter(id => blocs[id]);
    contenu.replaceChildren(...ordreAffiche.map(id => blocs[id]));
    vide.hidden = ordreAffiche.length > 0;
    vide.replaceChildren(el('p', '', quand === 'auj' ? "Rien de prévu aujourd'hui." : 'Rien de prévu demain.'));
    if (!apercu && !taches.some(t => t.due) && quand === 'auj') vide.append(el('p', 'q-aide', 'Les tâches avec une échéance, tes rendez-vous et tes habitudes apparaîtront ici.'));
  }

  async function voirRdv(o, jour) {
    if (apercu) return;
    // L'Agenda ouvre lui-même le rendez-vous (modifiable). Sinon : une fiche en lecture.
    const opened = ouvrir('agenda', true);
    if (opened) {
      if (!await opened) return;
      const detail = { cle: o.cle };
      document.dispatchEvent(new CustomEvent('renzvi:agenda', { detail }));
      if (detail.ok) return;
    }
    const box = el('div', 'q-form');
    box.append(el('p', 'q-texte', `${Q.dateLongue(jour)} · ${Q.horaire(o, jour)}`));
    if (o.e.lieu) box.append(el('p', 'q-texte', o.e.lieu));
    if (o.e.notes) box.append(el('p', 'q-texte q-notes', o.e.notes));
    box.append(el('p', 'q-aide', 'Ajoute le widget Agenda pour modifier ce rendez-vous.'));
    const actions = el('div', 'q-actions');
    actions.append(button('ghost', 'Ajouter l’Agenda ici', () => { qAjouterWidget('agenda'); d.close(); }), button('primary', 'Fermer', () => d.close()));
    box.append(actions);
    const d = qFiche(o.e.t, box);
  }

  // Pro : choisir et ordonner les sections.
  function reglages() {
    if (apercu || qVerrou('Organiser Aujourd’hui')) return;
    const box = el('div', 'q-form');
    const ul = el('ul', 'q-ordre');
    let sections = [...prefs.sections], masquees = new Set(prefs.masquees);
    const draw = focusId => {
      ul.replaceChildren(...sections.map((id, i) => {
        const li = el('li', 'q-ordre-row');
        const lab = el('label', 'q-check');
        const c = qInput('checkbox', { checked: !masquees.has(id) });
        c.onchange = () => { if (c.checked) masquees.delete(id); else masquees.add(id); };
        lab.append(c, el('span', '', AUJ_SECTIONS[id]));
        const up = button('ghost q-icon', '↑', () => { [sections[i - 1], sections[i]] = [sections[i], sections[i - 1]]; draw(`${id}-up`); });
        const down = button('ghost q-icon', '↓', () => { [sections[i + 1], sections[i]] = [sections[i], sections[i + 1]]; draw(`${id}-down`); });
        up.ariaLabel = `Monter ${AUJ_SECTIONS[id]}`; down.ariaLabel = `Descendre ${AUJ_SECTIONS[id]}`;
        up.dataset.k = `${id}-up`; down.dataset.k = `${id}-down`;
        up.disabled = i === 0; down.disabled = i === sections.length - 1;
        li.append(lab, up, down);
        return li;
      }));
      if (focusId) (ul.querySelector(`[data-k="${focusId}"]:not(:disabled)`) ?? ul.querySelector(`[data-k^="${focusId.split('-')[0]}"]:not(:disabled)`))?.focus();
    };
    draw();
    const actions = el('div', 'q-actions');
    actions.append(button('ghost', 'Annuler', () => d.close()), button('primary', 'Enregistrer', () => {
      prefs = { sections, masquees: [...masquees] };
      data = prefs;
      save(prefs);
      dessiner();
      d.close();
    }));
    box.append(el('p', 'q-aide', 'Les sections vides ne s’affichent pas.'), ul, actions);
    const d = qFiche('Organiser Aujourd’hui', box);
  }

  dessiner();
  if (apercu) return null;
  const stops = AUJ_SOURCES.map(id => qEcouter(id, 'aujourdhui', dessiner));
  const stopPlan = qEcouterPlan(dessiner);
  const minute = setInterval(() => { if (!document.hidden) dessiner(); }, 60000);
  return () => { for (const s of stops) s(); stopPlan(); clearInterval(minute); };
}
