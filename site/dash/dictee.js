// Widget « Dictée » (labo ?labo=1) : appuie sur le micro (VoicePill, React Bits, construit par prototype/scripts/build-dictee.mjs),
// parle, ton texte s'écrit dans la note. La voix devient du texte grâce à la reconnaissance vocale du navigateur
// (Web Speech API, en français) : aucun service payant, aucune clé. Sur Chrome et Edge, l'audio est envoyé aux serveurs
// de Google ou Microsoft pour être transcrit ; Firefox et certains navigateurs intégrés n'ont pas cette fonction.
// Pendant la dictée, le texte provisoire s'affiche à part ; il rejoint la note à la fin. Glisser vers la gauche annule :
// rien n'est ajouté. La note est enregistrée comme le widget Notes (widget_state, 15 000 caractères au plus).
// Utilise el, button, plural, MAX_NOTES_LENGTH (dashboard.html) et chillScript (chill.js).
window.dicteeWidget = function dicteeWidget({ body, data, save }) {
  for (const href of ['dash/voice-pill.css', 'dash/dictee.css']) {
    if (document.querySelector(`link[href="${href}"]`)) continue;
    document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href }));
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let text = typeof data?.text === 'string' ? data.text.slice(0, MAX_NOTES_LENGTH) : '';
  let gone = false, pill = null, session = null, props = null, restoring = false, listening = false;

  const area = Object.assign(el('textarea', 'notes dictee-text'), { maxLength: MAX_NOTES_LENGTH, value: text, placeholder: 'Appuie sur le micro et parle : ton texte s’écrit ici.' });
  area.ariaLabel = 'Texte dicté';
  area.oninput = () => { text = area.value; save({ text }); };
  const live = el('p', 'dictee-live');
  live.setAttribute('aria-live', 'polite');
  const row = el('div', 'dictee-row');
  const host = el('span', 'dictee-pill');
  const status = el('p', 'dictee-status');
  status.setAttribute('role', 'status');
  row.append(host); // la capsule s'ouvre vers la gauche pendant l'écoute : rien d'autre sur cette ligne
  const privacy = el('p', 'dictee-privacy', SR ? 'La transcription est faite par ton navigateur (sur Chrome et Edge, par les serveurs de Google ou Microsoft).' : '');
  body.append(area, live, row, status, privacy);
  const say = (msg, bad = false) => { status.textContent = msg; status.classList.toggle('bad', bad); };

  const ERREURS = {
    'not-allowed': 'Le micro est refusé : autorise-le dans les réglages du navigateur pour ce site.',
    'service-not-allowed': 'Le micro est refusé : autorise-le dans les réglages du navigateur pour ce site.',
    'audio-capture': 'Aucun micro trouvé sur cet appareil.',
    'network': 'La dictée a besoin d’internet : vérifie ta connexion.',
    'no-speech': 'Je n’ai rien entendu. Rapproche-toi du micro et réessaie.',
  };

  // Le texte d'une dictée rejoint la note, à la fin, séparé par une espace.
  function commit(words) {
    words = words.replace(/\s+/g, ' ').trim();
    if (!words) return;
    const before = text.replace(/\s+$/, '');
    const next = (before ? `${before} ${words}` : words.charAt(0).toUpperCase() + words.slice(1)).slice(0, MAX_NOTES_LENGTH);
    const added = next.length - (before ? before.length + 1 : 0);
    text = area.value = next;
    save({ text });
    area.scrollTop = area.scrollHeight;
    if (added < words.length) say('La note est pleine : la fin de la dictée n’a pas pu être ajoutée.', true);
    else say(`${plural(words.split(' ').length, 'mot')} ajouté${words.split(' ').length > 1 ? 's' : ''}.`);
  }
  // Arrêter le bouton depuis le widget (la reconnaissance s'est arrêtée seule, ou une erreur) : le composant n'expose
  // pas de commande ; le désactiver l'arrête proprement (raison « disabled »), et on le réactive une fois l'arrêt reçu.
  function stopPill() {
    if (!pill || !props || restoring || !listening) return; // déjà arrêté par la personne : rien à faire
    restoring = true;
    pill.update({ ...props, disabled: true });
  }

  function start() {
    const s = { finals: '', cancelled: false, failed: false, rec: new SR() };
    session = s;
    Object.assign(s.rec, { lang: 'fr-FR', continuous: true, interimResults: true });
    s.rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) s.finals += ` ${t}`; else interim += t;
      }
      if (session === s) live.textContent = `${s.finals} ${interim}`.replace(/\s+/g, ' ').trim();
    };
    s.rec.onerror = e => {
      if (e.error === 'aborted') return;
      s.failed = true;
      say(ERREURS[e.error] ?? 'La dictée s’est arrêtée sur une erreur. Réessaie.', true);
    };
    s.rec.onend = () => {
      if (!s.cancelled) commit(s.finals);
      if (session === s) {
        session = null;
        live.textContent = '';
        stopPill(); // la reconnaissance a pu s'arrêter seule (silence, erreur) : le bouton suit
      }
    };
    try { s.rec.start(); say('J’écoute… Appuie de nouveau pour terminer, glisse vers la gauche pour annuler.'); }
    catch { session = null; say('La dictée n’a pas pu démarrer. Réessaie.', true); stopPill(); }
  }
  function stop(reason) {
    if (reason === 'disabled' && restoring) { restoring = false; setTimeout(() => { if (!gone) pill.update({ ...props }); }); }
    const s = session;
    if (!s) return;
    if (reason === 'cancel' || reason === 'unmount') {
      s.cancelled = true;
      session = null;
      live.textContent = '';
      s.rec.abort();
      if (reason === 'cancel') say('Dictée annulée : rien n’a été ajouté.');
    } else {
      say('Transcription…');
      s.rec.stop(); // les derniers mots arrivent, puis onend les ajoute
    }
  }

  // Les couleurs du bouton suivent le thème : un rond plein, comme les boutons principaux.
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue('--ink').trim() || '#17191c', paper = css.getPropertyValue('--paper').trim() || '#fff';
  props = {
    accentColor: paper, iconColor: paper, background: ink, size: 44, shape: 'pill', mode: 'auto', reactive: 'simulated',
    ariaLabel: 'Dicter', disabled: !SR,
    onStart: () => { listening = true; start(); },
    onStop: ({ reason }) => { listening = false; stop(reason); },
  };
  if (!SR) say('La dictée n’est pas disponible dans ce navigateur. Essaie Chrome, Edge ou Safari.', true);
  chillScript('dash/voice-pill.js').then(() => {
    if (gone) return;
    pill = window.renzviVoicePill(host, props);
  }).catch(() => { if (!gone) say('Le micro n’a pas pu se charger. Vérifie ta connexion et recharge la page.', true); });

  return () => {
    gone = true;
    stop('unmount');
    pill?.unmount();
  };
};
