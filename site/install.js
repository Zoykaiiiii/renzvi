// Guide pour installer Renzvi sur l'écran d'accueil. Les dessins sont des démonstrations : ils ne lisent rien de ton appareil.
// Aucune mise en cache, aucun mode hors connexion (voir sw.js).
(() => {
  'use strict';
  const IN_APP = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Bytedance/i; // même liste que la page de connexion
  const ua = navigator.userAgent;
  const IOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const ANDROID = /Android/.test(ua);
  const isInstalled = () => navigator.standalone === true || ['standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay'].some(m => matchMedia(`(display-mode: ${m})`).matches);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Dans quel navigateur est-on ? Tout ce qui n'est pas listé tombe sur le cas le plus prudent.
  function where() {
    if (IN_APP.test(ua) || (ANDROID && /; wv\)/.test(ua))) return IOS ? 'inapp-ios' : 'inapp-android';
    if (IOS) {
      if (/CriOS/.test(ua)) return 'ios-chrome';
      return /FxiOS|EdgiOS|OPiOS|GSA\//.test(ua) || !/Safari\//.test(ua) ? 'ios-other' : 'ios-safari';
    }
    if (ANDROID) return /SamsungBrowser/.test(ua) ? 'android-samsung' : /Firefox\//.test(ua) ? 'android-firefox' : 'android-chrome';
    if (/Firefox\//.test(ua)) return 'desktop-other';
    if (/Chrome\/|Edg\//.test(ua)) return 'desktop-chromium';
    return /Safari\//.test(ua) && /Macintosh/.test(ua) ? 'desktop-safari' : 'desktop-other';
  }

  // ---------- Dessins ----------
  const path = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  const dots = (vertical) => `<svg viewBox="0 0 24 24" aria-hidden="true">${[5, 12, 19].map(n => `<circle class="f" cx="${vertical ? 12 : n}" cy="${vertical ? n : 12}" r="1.7"/>`).join('')}</svg>`;
  const I = {
    share: path('M12 15V4M8.5 7.500 12 4l3.500 3.500M7.500 10H6.200A1.200 1.200 0 0 0 5 11.200v8.600A1.200 1.200 0 0 0 6.200 21h11.600a1.200 1.200 0 0 0 1.200-1.200v-8.600A1.200 1.200 0 0 0 17.800 10h-1.300'),
    back: path('M15 5l-7 7 7 7'), fwd: path('M9 5l7 7-7 7'),
    book: path('M4 6c3-1.500 5-1.500 8 0 3-1.500 5-1.500 8 0v13c-3-1.500-5-1.500-8 0-3-1.500-5-1.500-8 0zM12 6v13'),
    tabs: path('M8 8V5h11v11h-3M5 8h11v11H5z'), home: path('M4 11l8-7 8 7M6 10v10h12V10'),
    menu: path('M4 7h16M4 12h16M4 17h16'), x: path('M6 6l12 12M18 6 6 18'),
    lock: path('M7.500 11V8a4.500 4.500 0 0 1 9 0v3M6 11h12v9H6z'),
    inst: path('M4 5h16v10H4zM12 8v5M9.500 11l2.500 2.500 2.500-2.500M8 19h8'),
    vdots: dots(true), hdots: dots(false),
  };
  const logo = c => `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="9" height="9" rx="3" fill="${c}"/><rect x="13" y="2" width="9" height="9" rx="3" fill="${c}" opacity=".22"/><rect x="2" y="13" width="9" height="9" rx="3" fill="${c}" opacity=".22"/><rect x="13" y="13" width="9" height="9" rx="3" fill="${c}" opacity=".22"/></svg>`;
  const appIcon = cls => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" fill="#17191c"/><g transform="translate(3.960 3.960) scale(.67)" fill="#fff"><rect x="2" y="2" width="9" height="9" rx="3"/><rect x="13" y="2" width="9" height="9" rx="3" opacity=".45"/><rect x="2" y="13" width="9" height="9" rx="3" opacity=".45"/><rect x="13" y="13" width="9" height="9" rx="3" opacity=".45"/></g></svg>`;
  const PHONE_PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.500" width="12" height="19" rx="3"/><path d="M12 9v6M9 12h6"/></svg>';

  const T = on => (on ? ' data-target' : '');
  const ic = (name, on) => `<span class="s-ic"${T(on)}>${I[name]}</span>`;
  const url = `<div class="s-url">${I.lock}<span>renzvi</span></div>`;
  const status = '<div class="s-status"><span>9:41</span><i class="s-bat"></i></div>';
  const page = `<div class="s-page"><div class="s-logo">${logo('#17191c')}</div><i class="sk a"></i><i class="sk b"></i><i class="sk c"></i></div>`;
  const pageCta = on => `<div class="s-page"><div class="s-logo">${logo('#17191c')}</div><i class="sk a"></i><i class="sk b"></i><span class="s-cta"${T(on)}>Installer l'app</span></div>`;
  const after = html => `<div class="after">${html}</div>`;
  const afterPage = html => `<div class="after" style="display:flex;flex-direction:column;background:#fff">${html}</div>`;
  const dim = '<div class="s-dim"></div>';

  // Navigateurs de téléphone
  const iosSafari = on => status + page + url + `<div class="s-tools">${ic('back')}${ic('fwd')}${ic('share', on)}${ic('book')}${ic('tabs')}</div>`;
  const iosChrome = on => status + `<div class="s-top">${url}${ic('share', on)}</div>` + page;
  const topBar = on => status + `<div class="s-top">${url}${ic('vdots', on)}</div>` + page;
  const samsung = on => status + page + `<div class="s-tools">${ic('back')}${ic('fwd')}${ic('home')}${ic('book')}${ic('tabs')}${ic('menu', on)}</div>`;
  const inApp = on => status + `<div class="s-top"><span class="s-ic">${I.x}</span><b>Renzvi</b><span class="s-sp"></span>${ic('hdots', on)}</div>` + page;

  // Feuilles et menus
  const row = (label, on, extra = '') => `<div class="s-row"${T(on)}><span>${label}</span>${extra}</div>`;
  const sheet = (on, slide) => `<div class="s-sheet${slide ? ' slide' : ''}"><div class="s-shead">${appIcon('s-appicon')}<div><b>Renzvi</b><small>Options</small></div><span class="s-ic sm">${I.x}</span></div><div class="s-list">${row('Copier')}${row('Ajouter aux favoris')}${row('Sur l\'écran d\'accueil', on, '<i></i>')}${row('Rechercher dans la page')}</div></div>`;
  const addSheet = (on, slide) => `<div class="s-add${slide ? ' slide' : ''}"><div class="s-addbar"><span>Annuler</span><b>Sur l'écran d'accueil</b><span${T(on)}>Ajouter</span></div><div class="s-group"><div class="s-name">${appIcon('s-appicon')}<b>Renzvi</b></div><div class="s-switch"><span>Ouvrir comme app web</span><i></i></div></div></div>`;
  const menu = (items, on, { up = false, from = 'scale(.85)' } = {}) => `<div class="s-menu slide${up ? ' up' : ''}" style="--from:${from};transform-origin:${up ? 'bottom' : 'top'} right">${items.map((t, i) => `<div class="s-mi"${T(i === on)}>${t}</div>`).join('')}</div>`;
  const menuStatic = (items, on, opts = {}) => menu(items, on, opts).replace(' slide', '');
  const dialog = (title, text, ok, on) => `<div class="s-center"><div class="s-dlg">${appIcon('s-appicon')}<b>${title}</b><p>${text}</p><div class="s-btns"><span class="s-btn">Annuler</span><span class="s-btn fill"${T(on)}>${ok}</span></div></div></div>`;
  const home = (extra = '') => `<div class="s-home">${['#d9b8a8', '#b8cfd9', '#cfd9b8', '#d4b8d9', '#e3d3a4', '#b8c0d9', '#d9c4b8', '#b8d9c8'].map(c => `<i class="s-app" style="--c:${c}"></i>`).join('')}<span class="s-app me">${appIcon('')}</span>${extra}<div class="s-dock"></div></div>`;

  // Fenêtre d'ordinateur
  const winBar = on => `<div class="w-bar"><span class="w-dots"><b></b><b></b><b></b></span><div class="w-url">${I.lock}<span>renzvi</span><span class="w-ins"${T(on)}>${I.inst}</span></div></div>`;
  const winPage = `<div class="w-page"><div class="s-logo">${logo('#17191c')}</div><i class="sk a"></i><i class="sk b"></i><i class="sk c"></i></div>`;
  const winPop = on => `<div class="w-pop slide" style="--from:translateY(-.8em)">${appIcon('s-appicon')}<b>Installer Renzvi ?</b><p>L'app s'ouvrira dans sa propre fenêtre.</p><div class="s-btns"><span class="s-btn">Annuler</span><span class="s-btn fill"${T(on)}>Installer</span></div></div>`;
  const appWin = `<div class="w-appwin slide" style="--from:scale(.94)"><div class="w-bar">${appIcon('s-appicon')}<span>Renzvi</span></div><div class="w-page">${`<div class="s-logo">${logo('#17191c')}</div>`}<i class="sk a"></i><i class="sk b"></i></div></div>`;
  const macBar = on => `<div class="w-menubar"><b>Safari</b><span${T(on)}>Fichier</span><span>Édition</span><span>Présentation</span></div>`;

  const step = (text, note, alt, base, aft, opts = {}) => ({ text, note, alt: `Démonstration : ${alt}`, base, after: aft, dev: 'phone', ...opts });
  const win = (text, note, alt, base, aft) => step(text, note, alt, base, aft, { dev: 'win' });

  const iosEnd = on => step('Touche « Ajouter » : l\'icône Renzvi apparaît sur ton écran d\'accueil.', 'Si tu vois « Ouvrir comme app web », laisse-le activé.', 'un doigt touche Ajouter, puis l\'icône Renzvi apparaît sur l\'écran d\'accueil.', iosSafari(false) + dim + addSheet(true), after(home()), { final: true });
  const androidEnd = (title, text, ok, note, base = topBar(false)) => step(`Confirme avec « ${ok} » : l'icône Renzvi apparaît sur ton écran d'accueil.`, note, 'un doigt touche le bouton de confirmation, puis l\'icône Renzvi apparaît sur l\'écran d\'accueil.', base + dim + dialog(title, text, ok, true), after(home()), { final: true });

  const FLOWS = {
    'ios-safari': () => [
      step('Touche le bouton Partager (le carré avec une flèche vers le haut), dans la barre du bas de Safari.', 'Tu ne le vois pas ? Touche « ⋯ » puis « Partager ».', 'un doigt touche le bouton Partager dans la barre du bas de Safari.', iosSafari(true), after(dim + sheet(false, true))),
      step('Dans la liste, touche « Sur l\'écran d\'accueil ».', 'Il n\'y est pas ? Fais défiler jusqu\'en bas, touche « Modifier les actions » et ajoute-le.', 'un doigt touche « Sur l\'écran d\'accueil » dans la liste de partage.', iosSafari(false) + dim + sheet(true), after(addSheet(false, true))),
      iosEnd(),
    ],
    'ios-chrome': () => [
      step('Touche le bouton Partager, à droite de la barre d\'adresse de Chrome.', 'Tu ne le vois pas ? Touche « ⋯ » puis « Partager ».', 'un doigt touche le bouton Partager à droite de la barre d\'adresse de Chrome.', iosChrome(true), after(dim + sheet(false, true))),
      step('Choisis « Sur l\'écran d\'accueil » (ou « Ajouter à l\'écran d\'accueil »).', 'Il n\'y est pas ? Fais défiler la liste vers le bas.', 'un doigt touche l\'option d\'ajout à l\'écran d\'accueil dans la liste de partage.', iosChrome(false) + dim + sheet(true), after(addSheet(false, true))),
      { ...iosEnd(), base: iosChrome(false) + dim + addSheet(true) },
    ],
    'ios-other': () => [
      step('Renzvi s\'installe depuis Safari. Ouvre l\'app Safari sur ton iPhone.', 'Copie d\'abord le lien avec le bouton ci-dessous.', 'un doigt touche l\'icône Safari sur l\'écran d\'accueil, et Safari s\'ouvre.', home().replace('class="s-app me"', 'class="s-app me" style="visibility:hidden"').replace('<i class="s-app" style="--c:#b8cfd9"></i>', `<i class="s-app" style="--c:#b8cfd9"${T(true)}></i>`), afterPage(iosSafari(false))),
      step('Colle l\'adresse de Renzvi dans la barre de Safari, puis rouvre ce guide.', 'Le guide te montrera alors les gestes pour Safari.', 'un doigt touche la barre d\'adresse de Safari pour y coller le lien.', status + page + `<div class="s-url"${T(true)}>${I.lock}<span>renzvi</span></div>` + `<div class="s-tools">${ic('back')}${ic('fwd')}${ic('share')}${ic('book')}${ic('tabs')}</div>`, ''),
    ],
    'inapp-ios': () => inAppSteps(),
    'inapp-android': () => inAppSteps(),
    'android-chrome': () => [
      step('Touche les trois points « ⋮ », en haut à droite de ton navigateur.', '', 'un doigt touche le bouton des trois points en haut à droite.', topBar(true), after(menu(['Nouvel onglet', 'Historique', 'Téléchargements', 'Installer l\'application', 'Paramètres'], -1))),
      step('Touche « Installer l\'application » (ou « Ajouter à l\'écran d\'accueil »).', 'Le libellé change selon la version de ton navigateur.', 'un doigt touche l\'option Installer l\'application dans le menu.', topBar(false) + menuStatic(['Nouvel onglet', 'Historique', 'Téléchargements', 'Installer l\'application', 'Paramètres'], 3), afterPage(topBar(false) + dim + dialog('Installer l\'application ?', 'Renzvi', 'Installer', false))),
      androidEnd('Installer l\'application ?', 'Renzvi', 'Installer', 'Un autre bouton « Ajouter » peut apparaître : touche-le aussi.'),
    ],
    'android-firefox': () => [
      step('Touche les trois points « ⋮ » de Firefox.', '', 'un doigt touche le bouton des trois points de Firefox.', topBar(true), after(menu(['Nouvel onglet', 'Favoris', 'Installer', 'Paramètres'], -1))),
      step('Touche « Installer ».', '', 'un doigt touche l\'option Installer dans le menu de Firefox.', topBar(false) + menuStatic(['Nouvel onglet', 'Favoris', 'Installer', 'Paramètres'], 2), afterPage(topBar(false) + dim + dialog('Ajouter à l\'écran d\'accueil ?', 'Renzvi', 'Ajouter', false))),
      androidEnd('Ajouter à l\'écran d\'accueil ?', 'Renzvi', 'Ajouter', ''),
    ],
    'android-samsung': () => {
      const main = ['Téléchargements', 'Historique', 'Ajouter la page à', 'Paramètres'], sub = ['Favoris', 'Écran d\'accueil', 'Pages enregistrées'];
      return [
        step('Touche le bouton menu « ≡ », en bas à droite de Samsung Internet.', '', 'un doigt touche le bouton menu en bas à droite.', samsung(true), after(menu(main, -1, { up: true }))),
        step('Touche « Ajouter la page à ».', '', 'un doigt touche Ajouter la page à dans le menu.', samsung(false) + menuStatic(main, 2, { up: true }), afterPage(samsung(false) + menu(sub, -1, { up: true }))),
        step('Touche « Écran d\'accueil » : l\'icône Renzvi apparaît sur ton écran d\'accueil.', 'Selon ton téléphone, une confirmation peut apparaître : touche « Ajouter ».', 'un doigt touche Écran d\'accueil, puis l\'icône Renzvi apparaît.', samsung(false) + menuStatic(sub, 1, { up: true }), after(home()), { final: true }),
      ];
    },
    'native-android': () => [
      step('Touche « Installer Renzvi », juste en dessous.', 'Ton navigateur te demandera de confirmer.', 'un doigt touche un bouton Installer, et le navigateur ouvre une fenêtre de confirmation.', status + pageCta(true), after(dim + dialog('Installer l\'application ?', 'Renzvi', 'Installer', false))),
      androidEnd('Installer l\'application ?', 'Renzvi', 'Installer', 'L\'icône Renzvi ouvre l\'app dans sa propre fenêtre.', status + pageCta(false)),
    ],
    'native-desktop': () => [
      win('Clique sur « Installer Renzvi », juste en dessous.', 'Ton navigateur te demandera de confirmer.', 'un pointeur clique sur l\'icône d\'installation de la barre d\'adresse, et une fenêtre de confirmation s\'ouvre.', winBar(true) + winPage, after(winPop(false))),
      win('Confirme avec « Installer » : Renzvi s\'ouvre dans sa propre fenêtre, avec son icône.', '', 'un pointeur clique sur Installer, puis Renzvi s\'ouvre dans sa propre fenêtre.', winBar(false) + winPage + winPop(true).replace(' slide', ''), '<div class="after" style="background:#dfe3ea">' + appWin + '</div>'),
    ],
    'desktop-chromium': () => [
      win('Cherche l\'icône d\'installation à droite de la barre d\'adresse, et clique dessus.', 'Elle n\'apparaît que quand ton navigateur juge l\'installation possible. Sinon, installe Renzvi depuis ton téléphone.', 'l\'icône d\'installation, à droite de la barre d\'adresse du navigateur.', winBar(true) + winPage, ''),
    ],
    'desktop-safari': () => [
      win('Dans la barre de menus, ouvre « Fichier ».', 'Il faut Safari 17 ou plus récent.', 'un pointeur clique sur le menu Fichier de Safari.', macBar(true) + winBar(false) + winPage, after(`<div class="w-drop slide" style="--from:translateY(-.6em)">${['Nouvelle fenêtre', 'Nouvel onglet', 'Ajouter au Dock…', 'Fermer'].map(t => `<div class="s-mi">${t}</div>`).join('')}</div>`)),
      win('Choisis « Ajouter au Dock… », puis confirme avec « Ajouter ».', '', 'un pointeur clique sur Ajouter au Dock, puis l\'icône Renzvi apparaît dans le Dock.', macBar(false) + winBar(false) + winPage + `<div class="w-drop">${['Nouvelle fenêtre', 'Nouvel onglet', 'Ajouter au Dock…', 'Fermer'].map((t, i) => `<div class="s-mi"${T(i === 2)}>${t}</div>`).join('')}</div>`, afterPage(macBar(false) + winBar(false) + winPage + `<div class="w-dock"><i></i><i></i><span class="s-app me">${appIcon('')}</span></div>`), { final: true }),
    ],
    'desktop-other': () => [
      win('Ton navigateur ne permet pas d\'installer Renzvi sur l\'ordinateur.', 'Ouvre cette page dans Chrome, Edge ou Safari, ou ajoute Renzvi depuis ton téléphone.', 'une fenêtre de navigateur, sans option d\'installation.', winBar(false) + winPage, ''),
    ],
  };
  function inAppSteps() {
    const items = ['Copier le lien', 'Ouvrir dans le navigateur', 'Partager'];
    return [
      step('Touche les trois points « ⋯ » de la fenêtre (en haut ou en bas à droite, selon l\'app).', 'Renzvi ne s\'installe pas depuis TikTok ou Instagram.', 'un doigt touche le bouton des trois points dans le navigateur intégré d\'une app.', inApp(true), after(menu(items, -1))),
      step('Choisis « Ouvrir dans le navigateur » (ou « Ouvrir dans Safari » / « Ouvrir dans Chrome »).', 'Une fois dans le navigateur, rouvre ce guide pour finir l\'installation.', 'un doigt touche Ouvrir dans le navigateur dans le menu.', inApp(false) + menuStatic(items, 1), ''),
    ];
  }

  // ---------- Fenêtre ----------
  let deferred = null, dlg, steps = [], at = 0, key = '', opener = null;
  const $ = (sel, root = dlg) => root.querySelector(sel);

  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'ins';
    dlg.setAttribute('aria-labelledby', 'ins-title');
    dlg.innerHTML = `
      <div class="ins-head"><h2 id="ins-title">Renzvi sur ton écran d'accueil</h2><button class="ins-x" type="button" data-close aria-label="Fermer le guide"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
      <div class="ins-body">
        <div class="ins-stage"><span class="ins-demo">Démonstration</span><div id="ins-dev"></div><button class="ins-t" id="ins-replay" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.500-5.800M4 4v4.500h4.500"/></svg>Revoir l'animation</button></div>
        <div class="ins-copy"><p class="ins-text" id="ins-text" aria-live="polite"></p><p class="ins-note" id="ins-note"></p><p class="ins-status" id="ins-status" role="status"></p></div>
        <div class="ins-actions">
          <button class="ins-b fill" id="ins-native" type="button" hidden>Installer Renzvi</button>
          <button class="ins-b" id="ins-copy" type="button" hidden>Copier le lien</button>
        </div>
      </div>
      <div class="ins-foot"><button class="ins-b" id="ins-prev" type="button">Précédent</button><span class="ins-count" id="ins-count"></span><button class="ins-b fill" id="ins-next" type="button">Suivant</button></div>`;
    document.body.append(dlg);
    dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
    dlg.addEventListener('close', () => { opener?.focus?.(); opener = null; });
    dlg.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' && at < steps.length - 1) go(1);
      if (e.key === 'ArrowLeft' && at > 0) go(-1);
    });
    $('#ins-prev').onclick = () => go(-1);
    $('#ins-next').onclick = () => (at === steps.length - 1 ? dlg.close() : go(1));
    $('#ins-replay').onclick = play;
    $('#ins-copy').onclick = copyLink;
    $('#ins-native').onclick = installNative;
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => dlg.open && render());
  }

  const flowKey = () => {
    const w = where();
    if (deferred && ['android-chrome', 'android-samsung'].includes(w)) return 'native-android';
    if (deferred && w === 'desktop-chromium') return 'native-desktop';
    return w;
  };

  function render() {
    const s = steps[at], stage = $('#ins-dev');
    dlg.classList.toggle('ins-static', reduced());
    stage.innerHTML = `<div class="ins-dev ${s.dev}${s.final ? ' final' : ''}" role="img" aria-label="${s.alt}"><div class="ins-frame"><div class="ins-screen">${s.base}${s.after || ''}<i class="hit"></i><i class="ptr"></i></div></div></div>`;
    $('#ins-text').textContent = s.text;
    $('#ins-note').textContent = s.note;
    $('#ins-count').textContent = `${at + 1} / ${steps.length}`;
    $('#ins-prev').disabled = at === 0;
    $('#ins-next').textContent = at === steps.length - 1 ? 'Terminé' : 'Suivant';
    $('#ins-native').hidden = !key.startsWith('native');
    $('#ins-copy').hidden = !/^(inapp|ios-other)/.test(key);
    $('#ins-replay').hidden = reduced();
    requestAnimationFrame(() => { place(); play(); });
  }

  // Le pointeur et le cadre se calent sur la cible mesurée dans le dessin : tout est en pourcentages, donc ça suit les redimensionnements.
  function place() {
    const scr = $('.ins-screen'), target = scr && $('[data-target]', scr);
    if (!scr) return;
    if (!target) { $('.ptr', scr)?.remove(); $('.hit', scr)?.remove(); return; }
    const a = scr.getBoundingClientRect(), b = target.getBoundingClientRect(), pc = (v, n) => `${(v / n * 100).toFixed(2)}%`;
    Object.assign($('.ptr', scr).style, { left: pc(b.left + b.width / 2 - a.left, a.width), top: pc(b.top + b.height / 2 - a.top, a.height) });
    Object.assign($('.hit', scr).style, { left: pc(b.left - a.left, a.width), top: pc(b.top - a.top, a.height), width: pc(b.width, a.width), height: pc(b.height, a.height) });
  }

  function play() {
    const dev = $('.ins-dev');
    if (!dev) return;
    dev.classList.remove('go');
    if (reduced()) return;
    void dev.offsetWidth;
    dev.classList.add('go');
  }

  function go(delta) { at += delta; render(); }

  function open(from) {
    if (!dlg) build();
    opener = from;
    key = flowKey();
    steps = FLOWS[key]();
    at = 0;
    $('#ins-status').textContent = '';
    render();
    if (!dlg.open) dlg.showModal();
    $('#ins-next').focus();
  }

  async function copyLink() {
    const link = new URL('./', location.href).href;
    try { await navigator.clipboard.writeText(link); $('#ins-status').textContent = 'Lien copié.'; }
    catch { $('#ins-status').textContent = 'Impossible de copier : recopie l\'adresse de la page dans la barre de ton navigateur.'; }
  }

  async function installNative() {
    const ask = deferred;
    if (!ask) return;
    deferred = null; // l'événement ne sert qu'une fois
    ask.prompt();
    const { outcome } = await ask.userChoice;
    if (outcome === 'accepted') { $('#ins-status').textContent = 'Installation en cours…'; return; }
    // Refus : pas de bouton mort, on montre le parcours manuel.
    key = flowKey();
    steps = FLOWS[key]();
    at = 0;
    render();
    $('#ins-status').textContent = 'Pas de souci. Tu pourras installer Renzvi quand tu veux : voici le parcours à la main.';
  }

  function hideButtons() {
    document.querySelectorAll('[data-install]').forEach(b => { (b.closest('[data-install-row]') || b).hidden = true; });
  }

  addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); // on propose notre propre bouton, au bon moment
    deferred = e;
    if (dlg?.open) { key = flowKey(); steps = FLOWS[key](); at = 0; render(); }
  });
  addEventListener('appinstalled', () => {
    deferred = null;
    hideButtons();
    if (dlg?.open) { $('#ins-native').hidden = true; $('#ins-status').textContent = 'Renzvi est installée. Cherche son icône sur ton écran d\'accueil.'; }
  });

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-install]');
    if (!b) return;
    try { document.getElementById('menu')?.hidePopover(); } catch { /* le menu n'était pas ouvert */ }
    open(b);
  });
  const ready = () => {
    document.querySelectorAll('[data-install]').forEach(b => { b.insertAdjacentHTML('afterbegin', PHONE_PLUS); });
    if (isInstalled()) hideButtons();
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', ready) : ready();

  // Sans cet enregistrement, certains navigateurs ne proposent pas l'installation. Le fichier ne met rien en cache.
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {});
})();
