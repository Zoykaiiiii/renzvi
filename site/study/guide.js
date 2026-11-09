// Study S8 : le widget Guide Study. Quatre étapes courtes jusqu'à la première révision : un cours, des chapitres
// vérifiés, des cartes, une séance. Chaque étape est cochée par ce qui a vraiment réussi (un cours enregistré, une carte
// créée, une réponse enregistrée), jamais par un bouton « Suivant ». Il ne remplace rien sur l'écran : il propose
// d'ajouter les widgets qui manquent. Facultatif, masquable, rejouable. Widget en préparation : caché sauf ?labo=1.
// Utilise el, button (dashboard.html).
const GUIDE_EXEMPLE = {
  subject: 'Exemple',
  title: "Cours d'exemple : la cellule",
  text: "# La membrane\nLa membrane plasmique entoure la cellule. Elle contrôle les échanges avec l'extérieur.\n\n# Le noyau\nLe noyau contient l'ADN, rangé en chromosomes. Il est entouré d'une double membrane.\n\n# La mitochondrie\nLa mitochondrie produit l'énergie de la cellule grâce à la respiration cellulaire.",
};
const GUIDE_WIDGETS = [['cahier', 'Cahier'], ['cartes', 'Flashcards'], ['revisions', 'Révisions du jour']];

function guideWidget({ body, meta, data, save, sb }) {
  let flags = { chapitres: data?.chapitres === true, masque: data?.masque === true };
  let done = { cours: false, cartes: false, seance: false }, state = 'loading', gone = false;
  const view = el('div', 'guide');
  const note = el('p', 'zone cahier-note');
  note.setAttribute('role', 'status');
  body.append(view, note);
  const say = (text, bad = false) => { note.textContent = text; note.classList.toggle('msg', bad); };
  const persist = () => save({ ...flags });
  const present = id => !!document.querySelector(`[data-widget="${id}"]`);
  const goTo = id => document.querySelector(`[data-widget="${id}"]`)?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });

  // Ce qui existe vraiment en base : une ligne suffit pour cocher l'étape.
  async function refresh() {
    const has = async table => { const { data: rows, error } = await sb.from(table).select('id').limit(1); if (error) throw error; return rows.length > 0; };
    try {
      const [cours, cartes, seance] = await Promise.all([has('study_courses'), has('study_cards'), has('study_reviews')]);
      if (gone) return;
      done = { cours, cartes, seance };
      state = 'ready';
    } catch { if (!gone) state = 'error'; }
    draw();
  }

  function step(n, title, ok, current, content) {
    const li = el('li', `guide-step${ok ? ' ok' : ''}${current ? ' now' : ''}`);
    li.append(el('span', 'guide-num', ok ? '✓' : String(n)), el('b', '', title));
    if (ok) li.append(el('span', 'guide-state', 'Fait'));
    if (current) { const box = el('div', 'guide-body'); box.append(...content); li.append(box); }
    return li;
  }

  function draw() {
    if (state === 'loading') return view.replaceChildren(el('p', 'empty', 'Chargement du guide…'));
    if (state === 'error') return view.replaceChildren(el('p', 'msg', "Le guide n'a pas pu vérifier ta progression."), button('ghost', 'Réessayer', refresh));
    if (flags.masque) {
      meta.textContent = '';
      return view.replaceChildren(el('p', 'zone', 'Guide masqué.'), button('ghost', 'Rejouer le guide', () => { flags = { chapitres: false, masque: false }; persist(); draw(); }));
    }
    const steps = [done.cours, done.cours && flags.chapitres, done.cartes, done.seance];
    const now = steps.findIndex(x => !x);
    meta.textContent = now < 0 ? 'Terminé' : `Étape ${now + 1} / 4`;
    const missing = GUIDE_WIDGETS.filter(([id]) => !present(id));
    const items = [];
    if (missing.length) {
      // On ajoute seulement ce qui manque, sur la page affichée : rien n'est retiré ni déplacé.
      const add = button('primary', `Ajouter ${missing.map(([, n]) => n).join(', ')} à cette page`, () => {
        const detail = { ids: missing.map(([id]) => id) };
        document.dispatchEvent(new CustomEvent('renzvi:ajouter', { detail }));
        say(detail.added?.length ? 'Ajouté. Ta disposition n’a pas changé, le reste de ton écran est intact.' : "Ces widgets n'ont pas pu être ajoutés.", !detail.added?.length);
        draw();
      });
      items.push(el('p', 'zone', 'Pour ta première révision, il te faut ces widgets sur ton écran.'), add);
    }
    const list = el('ol', 'guide-steps');
    list.append(
      step(1, 'Ajoute un cours', done.cours, now === 0, [
        el('p', 'zone', 'Un PDF qui contient du texte, ou ton texte collé. Tu l’importes une fois.'),
        button('primary', 'Importer mon cours', () => { if (!open({ subject: '', title: '', text: '' })) say('Ajoute d’abord le Cahier à cette page.', true); }),
        button('ghost', "Essayer avec un cours d'exemple", () => { if (!open(GUIDE_EXEMPLE)) say('Ajoute d’abord le Cahier à cette page.', true); }),
        el('p', 'zone', "Le cours d'exemple est nommé « Exemple » : supprime-le quand tu veux."),
      ]),
      step(2, 'Vérifie tes chapitres', done.cours && flags.chapitres, now === 1, [
        el('p', 'zone', 'Dans le Cahier, regarde la liste des chapitres. Si un titre est faux, corrige-le avec « Modifier les chapitres ».'),
        button('ghost', 'Voir le Cahier', () => goTo('cahier')),
        button('primary', 'Mes chapitres sont bons', () => { flags.chapitres = true; persist(); draw(); }),
      ]),
      step(3, 'Crée tes premières cartes', done.cartes, now === 2, [
        el('p', 'zone', 'Gratuit : sélectionne un passage du cours, puis « Créer une carte » ou « Masquer ces mots ». Gratuit aussi : importer un CSV dans Flashcards.'),
        el('p', 'zone', 'Avec crédits : « IA : cartes et résumé du chapitre ». Le coût est affiché avant de lancer, et revoir un résultat déjà fait est gratuit.'),
        button('ghost', 'Voir le Cahier', () => goTo('cahier')),
      ]),
      step(4, 'Fais ta première séance', done.seance, now === 3, [
        el('p', 'zone', 'Dans Révisions du jour : « Voir la réponse », puis dis si tu savais. La prochaine date de chaque carte est calculée pour toi.'),
        button('primary', 'Ouvrir Révisions du jour', () => goTo('revisions')),
      ]),
    );
    items.push(list);
    if (now < 0) items.push(el('p', 'cartes-sum', 'Tout est prêt.'), el('p', 'zone', 'Reviens chaque jour : Révisions du jour te dit quoi revoir, et rien d’autre.'));
    items.push(button('link', 'Masquer le guide', () => { flags.masque = true; persist(); draw(); }));
    view.replaceChildren(...items);
  }
  function open(prefill) {
    const detail = { ...prefill, found: false };
    document.dispatchEvent(new CustomEvent('renzvi:importer', { detail }));
    return detail.found;
  }

  // Une fois tout fait, plus besoin de revérifier à chaque réponse.
  const onChange = () => { if (!gone && !(done.cours && done.cartes && done.seance)) refresh(); };
  const events = ['renzvi:cours', 'renzvi:cartes', 'renzvi:reponse'];
  for (const ev of events) document.addEventListener(ev, onChange);
  refresh();
  return () => { gone = true; for (const ev of events) document.removeEventListener(ev, onChange); };
}
