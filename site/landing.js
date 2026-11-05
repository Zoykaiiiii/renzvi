// Démonstrations de la landing Renzvi. Rien n'est envoyé ni enregistré : ce sont des aperçus avec des données d'exemple.
// Sans script, la page reste lisible (titres, textes, offres, questions) ; seuls les aperçus animés manquent.
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const two = n => String(n).padStart(2, '0');
  // Fonds fournis par Damien (sources et licences à confirmer avant mise en ligne). Une seule taille : les originaux font environ 736 px de large.
  const IMG = { prairie: 'landing/prairie', nuages: 'landing/nuages', nuit: 'landing/nuit', chat: 'landing/chat', trou: 'landing/trou' };

  // ---------- Les widgets, dessinés comme dans le dashboard ----------
  const days = on => `<span class="days">${[...on].map(c => `<i class="${c === '1' ? 'on' : ''}"></i>`).join('')}</span>`;
  const bars = [3, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 3, 1, 2, 1, 3];
  const barcode = `<svg viewBox="0 0 52 30" aria-hidden="true">${bars.reduce((a, w, i) => { a.s += `<rect x="${a.x}" y="0" width="${w}" height="30" fill="#17191c"/>`; a.x += w + (i % 3 === 0 ? 2 : 1.4); return a; }, { s: '', x: 0 }).s}</svg>`;
  const W = {
    vol: { name: 'Vol de focus', html: () => `<div class="w-t">Vol de focus<small>Aujourd'hui : 1 vol · 25 min</small></div>
      <div class="ticket"><div class="ticket-main"><div class="w-sub">Carte d'embarquement</div><div class="ticket-route">PAR → LYS</div>
      <div class="ticket-f"><span>Passager<b>Léa</b></span><span>Durée<b>25 min</b></span><span>Vol<b>RZ 125</b></span></div></div>
      <div class="ticket-stub">${barcode}<span>RZ 125</span></div></div>
      <div class="w-row"><span class="w-btn">Déchirer et décoller</span></div>` },
    taches: { name: 'Tâches', html: () => `<div class="w-t">Tâches<small>1 sur 3</small></div>
      <ul class="tasks"><li><label><input type="checkbox" checked tabindex="-1"><span>Relire le chapitre 4</span></label></li>
      <li><label><input type="checkbox" tabindex="-1"><span>Fiche : contrats</span></label></li>
      <li><label><input type="checkbox" tabindex="-1"><span>Appeler mamie</span></label></li></ul>` },
    minuteur: { name: 'Minuteur focus', html: () => `<div class="w-t">Minuteur focus<small>Aujourd'hui : 50 min</small></div>
      <div class="w-seg"><span>15 min</span><span class="on">25 min</span><span>50 min</span></div>
      <div class="w-big" data-timer>18:42</div><div class="w-bar"><i data-timer-bar style="--p:.25"></i></div>
      <div class="w-row"><span class="w-btn">Pause</span><span class="w-btn light">Remettre</span></div>` },
    heure: { name: 'Heure', html: () => `<div class="w-t">Heure</div><div class="w-big" data-clock>--:--</div><div class="w-sub" data-date></div>` },
    notes: { name: 'Notes', html: () => `<div class="w-t">Notes</div><p class="note-text">Exposé jeudi : relire l'intro.
Rendre le livre à la BU.
Acheter du café.</p>` },
    habitudes: { name: 'Habitudes', html: () => `<div class="w-t">Habitudes<small>Cette semaine</small></div>
      <div class="habits"><div class="habit"><span>Lire 20 pages</span>${days('1101110')}</div>
      <div class="habit"><span>Boire de l'eau</span>${days('1111011')}</div><div class="habit"><span>Marcher</span>${days('0110100')}</div></div>` },
    compte: { name: 'Compte à rebours', html: () => `<div class="w-t">Compte à rebours</div>
      <div class="events"><div class="event"><span>Partiel de droit</span><b>J-12</b></div><div class="event"><span>Vacances</span><b>J-47</b></div></div>` },
    raccourcis: { name: 'Mes raccourcis', html: () => `<div class="w-t">Mes raccourcis</div>
      <div class="links"><span style="--c:#242424">Espace de cours</span><span style="--c:#d9cdbd">Drive du groupe</span><span style="--c:#9c8f7d">Dictionnaire</span><span style="--c:#615d59">Agenda</span></div>` },
    ambiance: { name: 'Ambiance sonore', html: () => `<div class="w-t">Ambiance sonore<small>En cours</small></div>
      <div class="mix"><div><span>Pluie</span><span class="slider"><i style="--v:62%"></i></span></div><div><span>Feu de bois</span><span class="slider"><i style="--v:34%"></i></span></div>
      <div><span>Vent</span><span class="slider"><i style="--v:0%"></i></span></div><div><span>Bruit blanc</span><span class="slider"><i style="--v:12%"></i></span></div></div>` },
    playlist: { name: 'Playlist', html: () => `<div class="w-t">Playlist</div>
      <div class="track play"><span class="cover" style="background-image:url(${IMG.nuit}-160.webp)"></span><span><b>Pluie douce et piano</b><span class="w-sub">Playlist · Spotify</span>
      <span class="eq"><i></i><i></i><i></i><i></i></span></span></div>` },
    respiration: { name: 'Respiration guidée', html: () => `<div class="w-t">Respiration guidée</div>
      <div class="w-seg"><span>1 min</span><span class="on">3 min</span><span>5 min</span></div><div class="breath"><i></i></div><div class="breath-l">Inspire… expire</div>` },
    pause: { name: 'Pause détente', html: () => `<div class="w-t">Pause détente</div><div class="w-big" style="font-size:22px">Regarder au loin</div>
      <p class="w-sub" style="margin-top:6px">Pose les yeux sur quelque chose de lointain, par la fenêtre si possible.</p><div class="w-row"><span class="w-btn">Commencer · 20 s</span></div>` },
    lecture: { name: 'Suivi de lecture', html: () => `<div class="w-t">Suivi de lecture<small>53 %</small></div>
      <div class="book"><span class="book-c">L'Étranger</span><span><b>L'Étranger</b><span class="w-sub">Albert Camus · page 84 sur 159</span></span></div>
      <div class="w-bar"><i style="--p:.53"></i></div>` },
    inspiration: { name: "Tableau d'inspiration", html: () => `<div class="w-t">Tableau d'inspiration<small>3 / 6</small></div>
      <div class="pins"><figure><span style="background-image:url(${IMG.prairie}-160.webp)"></span><figcaption>Le calme</figcaption></figure>
      <figure><span style="background-image:url(${IMG.chat}-160.webp)"></span><figcaption>Mon chat</figcaption></figure>
      <figure><span style="background-image:url(${IMG.nuages}-160.webp)"></span><figcaption>Le ciel</figcaption></figure></div>` },
    // Aperçus du futur : jamais proposés comme disponibles.
    cahier: { name: 'Cahier de cours', cls: 'w-cahier', html: () => `<div class="w-t">Cahier de cours<span class="tag tag-soon">Aperçu du concept</span></div>
      <div class="cahier"><div class="cahier-toc"><span>1. Formation</span><span class="on">2. Consentement</span><span>3. Exécution</span><span>4. Responsabilité</span></div>
      <div class="cahier-page"><h4>Le consentement</h4><p>Le contrat suppose l'accord des volontés. Le consentement doit exister et être <mark>libre et éclairé</mark>&nbsp;: l'erreur, le dol et la violence le vicient.</p></div></div>` },
    flash: { name: 'Flashcards', html: () => `<div class="w-t">Flashcards<span class="tag tag-soon">Bientôt</span></div>
      <p class="note-text" style="font-weight:500">Quels sont les vices du consentement&nbsp;?</p><div class="w-row"><span class="w-btn light">Retourner</span></div>` },
  };
  const make = id => {
    const el = document.createElement('div');
    el.className = 'w' + (W[id].cls ? ' ' + W[id].cls : '');
    el.dataset.key = id;
    el.innerHTML = W[id].html();
    return el;
  };

  // ---------- Placer des widgets en animant la place que les autres leur font (technique FLIP) ----------
  function compose(grid, ids, { stagger = 0 } = {}) {
    const still = reduced();
    const current = new Map($$(':scope > .w:not(.is-leaving)', grid).map(el => [el.dataset.key, el]));
    const first = new Map([...current].map(([k, el]) => [k, el.getBoundingClientRect()]));
    // Ceux qui partent : figés à leur place, ils s'effacent pendant que les autres glissent.
    for (const [k, el] of current) {
      if (ids.includes(k)) continue;
      if (still) { el.remove(); continue; }
      const { offsetLeft: l, offsetTop: t, offsetWidth: w, offsetHeight: h } = el;
      Object.assign(el.style, { left: l + 'px', top: t + 'px', width: w + 'px', height: h + 'px' });
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 280);
    }
    let n = 0;
    const els = ids.map(id => {
      let el = current.get(id);
      if (!el) {
        el = make(id);
        if (!still) { el.classList.add('is-new'); el.style.animationDelay = (n++ * stagger) + 'ms'; el.addEventListener('animationend', () => { el.classList.remove('is-new'); el.style.animationDelay = ''; }, { once: true }); }
      }
      return el;
    });
    const leaving = $$(':scope > .is-leaving', grid);
    grid.replaceChildren(...els, ...leaving);
    fill(grid);
    if (still) return;
    for (const [k, el] of current) {
      if (!ids.includes(k)) continue;
      const a = first.get(k), b = el.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2,.75,.25,1)' });
    }
  }

  // ---------- Détails vivants : horloge réelle, minuteur qui tourne ----------
  let timerLeft = 18 * 60 + 42;
  function fill(root = document) {
    const d = new Date();
    $$('[data-clock]', root).forEach(e => { e.textContent = `${two(d.getHours())}:${two(d.getMinutes())}`; });
    $$('[data-date]', root).forEach(e => { const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); e.textContent = s[0].toUpperCase() + s.slice(1); });
    $$('[data-timer]', root).forEach(e => { e.textContent = `${two(Math.floor(timerLeft / 60))}:${two(timerLeft % 60)}`; });
    $$('[data-timer-bar]', root).forEach(e => e.style.setProperty('--p', (1 - timerLeft / 1500).toFixed(3)));
  }
  setInterval(() => { if (!reduced()) timerLeft = timerLeft > 0 ? timerLeft - 1 : 1500; fill(); }, 1000);

  // Les petites animations (respiration, égaliseur) ne tournent que quand l'aperçu est à l'écran.
  const live = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('live', e.isIntersecting)), { rootMargin: '80px' });

  // ---------- Fonds : fondu entre deux calques, les widgets restent lisibles ----------
  function setWall(stage, key, size) {
    const walls = $$('.wall', stage);
    const shown = walls.find(w => w.style.opacity !== '0') || walls[0];
    if (shown.dataset.w === key) return;
    const next = walls.find(w => w !== shown);
    next.dataset.w = key;
    next.style.backgroundImage = key === 'blanc' ? 'none' : `url(${IMG[key]}.webp)`;
    // Le nouveau fond apparaît en fondu et se recentre doucement, l'ancien s'efface : jamais de coupure nette.
    if (!reduced()) { next.style.transition = 'none'; next.style.transform = 'scale(1.06)'; void next.offsetWidth; next.style.transition = ''; }
    next.style.transform = '';
    next.style.opacity = '1';
    shown.style.opacity = '0';
  }

  // ---------- A. Premier écran : le dashboard se compose sous tes yeux ----------
  const hero = $('#heroStage');
  if (hero) {
    const grid = $('#heroGrid'), sheet = $('#heroSheet'), ptr = $('#heroPointer'), replay = $('#heroReplay'), app = $('.app', hero);
    const START = ['vol', 'taches', 'minuteur', 'heure', 'notes', 'habitudes'];
    const END = ['vol', 'ambiance', 'taches', 'minuteur', 'heure', 'notes', 'habitudes'];
    const big = () => innerWidth > 640 ? 1400 : 720;
    let run = 0;
    const at = (el, dx = .5, dy = .5) => { const a = app.getBoundingClientRect(), b = el.getBoundingClientRect(); return [b.left - a.left + b.width * dx, b.top - a.top + b.height * dy]; };
    const move = ([x, y]) => { ptr.style.transform = `translate(${x}px,${y}px)`; };
    const tap = async () => { ptr.classList.remove('tap'); void ptr.offsetWidth; ptr.classList.add('tap'); await sleep(260); };
    async function play() {
      const id = ++run;
      const alive = () => id === run;
      replay.hidden = true;
      setWall(hero, 'prairie', big());
      sheet.classList.remove('open');
      grid.replaceChildren();
      compose(grid, START, { stagger: 95 });
      if (reduced()) { compose(grid, END); replay.hidden = true; return; }
      await sleep(1700); if (!alive()) return;
      const add = $('[data-chip=ajout]', hero), fond = $('[data-chip=fond]', hero);
      ptr.style.transition = 'none'; move([app.clientWidth * .55, app.clientHeight * .9]); void ptr.offsetWidth; ptr.style.transition = '';
      ptr.style.opacity = '1';
      move(at(add, .6, .6)); await sleep(950); if (!alive()) return;
      add.classList.add('press'); await tap(); add.classList.remove('press');
      sheet.style.top = Math.round(at(add, 0, 1)[1] + 8) + 'px'; // la feuille s'ouvre juste sous le bouton
      sheet.classList.add('open'); await sleep(450); if (!alive()) return;
      const item = $('[data-hl]', sheet);
      move(at(item, .4, .55)); await sleep(900); if (!alive()) return;
      item.classList.add('hl'); await tap();
      await sleep(180); sheet.classList.remove('open'); item.classList.remove('hl');
      await sleep(200); if (!alive()) return;
      compose(grid, END);
      await sleep(1700); if (!alive()) return;
      move(at(fond, .5, .6)); await sleep(950); if (!alive()) return;
      fond.classList.add('press'); await tap(); fond.classList.remove('press');
      setWall(hero, 'nuit', big());
      await sleep(700); ptr.style.opacity = '0';
      replay.hidden = false;
    }
    replay.addEventListener('click', play);
    // « Revoir la démo », en bas de page : on remonte et l'animation recommence.
    $$('[data-replay]').forEach(a => a.addEventListener('click', () => setTimeout(play, reduced() ? 0 : 500)));
    // Démarre quand le dashboard est visible (tout de suite sur ordinateur, au défilement sur téléphone).
    const start = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { start.disconnect(); play(); } }, { threshold: .35 });
    compose(grid, START); // contenu présent même si l'animation ne part jamais
    start.observe(hero);
    live.observe(hero);
  }

  // ---------- C. Composer son espace ----------
  const cGrid = $('#composeGrid');
  if (cGrid) {
    const stage = $('#composeStage');
    const CHOICES = ['vol', 'taches', 'minuteur', 'notes', 'heure', 'habitudes', 'playlist', 'ambiance'];
    const FONDS = [['prairie', 'Prairie'], ['nuages', 'Nuages'], ['nuit', 'Nuit étoilée'], ['chat', 'Chat'], ['trou', 'Trou noir'], ['blanc', 'Blanc']];
    let picked = ['taches', 'minuteur', 'heure', 'notes'];
    let fond = 'prairie';
    const chips = $('#chips'), sw = $('#swatches');
    const draw = () => {
      $('#composeEmpty')?.remove();
      compose(cGrid, picked);
      if (!picked.length) cGrid.insertAdjacentHTML('beforeend', '<p id="composeEmpty" class="w-empty">Ton espace est vide. Ajoute un widget.</p>');
      const n = picked.length;
      $('#pickCount').textContent = `${n} sur l'écran`;
      $('#composeState').textContent = `${n} widget${n > 1 ? 's' : ''} · fond ${FONDS.find(f => f[0] === fond)[1]}`;
      $$('button', chips).forEach(b => b.setAttribute('aria-pressed', picked.includes(b.dataset.id)));
    };
    for (const id of CHOICES) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.id = id; b.textContent = W[id].name;
      b.addEventListener('click', () => {
        // Le nouveau widget arrive en premier : on le voit rejoindre l'espace et les autres se décaler.
        picked = picked.includes(id) ? picked.filter(x => x !== id) : [id, ...picked];
        draw();
      });
      chips.append(b);
    }
    for (const [key, label] of FONDS) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'swatch'; b.setAttribute('aria-pressed', key === fond);
      b.innerHTML = `<span style="${key === 'blanc' ? 'background:#f4f4f5' : `background-image:url(${IMG[key]}-160.webp)`}"></span>${label}`;
      b.addEventListener('click', () => { fond = key; setWall(stage, key, 720); $$('button', sw).forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); });
      sw.append(b);
    }
    draw();
    live.observe(stage);
  }

  // ---------- D. Study et Chill ----------
  const mGrid = $('#modeGrid');
  if (mGrid) {
    const stage = $('#modeStage');
    const MODES = {
      study: { wall: 'chat', ids: ['vol', 'minuteur', 'taches', 'compte', 'notes', 'raccourcis', 'heure', 'habitudes'], cap: 'Study : tes outils de travail et de révision.',
        label: 'Composition Study : Vol de focus, Minuteur focus, Tâches, Compte à rebours, Notes, Mes raccourcis, Heure et Habitudes, sur un fond de chat derrière un mur blanc.' },
      chill: { wall: 'nuages', ids: ['heure', 'ambiance', 'playlist', 'respiration', 'lecture', 'inspiration', 'notes', 'pause'], cap: 'Chill : ambiance, lecture, inspiration.',
        label: "Composition Chill : Heure, Ambiance sonore, Playlist, Respiration guidée, Suivi de lecture, Tableau d'inspiration, Notes et Pause détente, sur un fond de nuages peints." },
      cahier: { wall: 'prairie', ids: ['cahier', 'minuteur', 'flash', 'taches', 'notes'], cap: 'Study avec cahier : un aperçu du concept, pas encore développé.',
        label: 'Aperçu du concept : un grand cahier de cours au centre, entouré des widgets Minuteur focus, Flashcards, Tâches et Notes.' },
    };
    const set = key => {
      const m = MODES[key];
      $$('#modeSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === key));
      setWall(stage, m.wall, innerWidth > 640 ? 1400 : 720);
      compose(mGrid, m.ids, { stagger: 60 });
      $('#modeCaption').textContent = m.cap;
      stage.setAttribute('aria-label', m.label);
    };
    $$('#modeSeg button').forEach(b => b.addEventListener('click', () => set(b.dataset.mode)));
    set('study');
    live.observe(stage);
  }

  // ---------- E. Le catalogue des widgets disponibles ----------
  const list = $('#libList');
  if (list) {
    const GROUPS = [
      ['Pour travailler', ['vol', 'minuteur', 'taches', 'compte', 'notes', 'raccourcis']],
      ['Pour souffler', ['ambiance', 'playlist', 'respiration', 'pause', 'lecture', 'inspiration']],
      ['Au quotidien', ['heure', 'habitudes']],
    ];
    const DESC = {
      vol: "Une séance de concentration présentée comme un vol : tu choisis la durée, tu déchires ton ticket et le compte à rebours passe en plein écran. Si tu quittes l'écran, le vol est annulé.",
      minuteur: 'Des sessions de focus de 15, 25 ou 50 minutes, et ton total du jour.',
      taches: 'Ta liste de choses à faire, à cocher au fil de la journée.',
      compte: "Un examen, des vacances, un événement : le nombre de jours qu'il reste.",
      notes: 'Une idée, une liste, un numéro, toujours sous la main.',
      raccourcis: 'Tes liens favoris : cours, documents, outils.',
      ambiance: "Pluie, vent, feu de bois, cabine d'avion et bruit blanc, à mélanger son par son.",
      playlist: 'Ta playlist Spotify ou YouTube, avec sa pochette, à portée de main.',
      respiration: "Un cercle qui t'accompagne pour respirer doucement, 1, 3 ou 5 minutes.",
      pause: "Une courte pause guidée : regarder au loin, relâcher les épaules, s'étirer, marcher.",
      lecture: 'Ton livre en cours, ta progression et les citations que tu veux garder.',
      inspiration: 'Quelques photos à toi, avec une légende, pour un espace qui te ressemble.',
      heure: "L'heure et la date du jour, en grand.",
      habitudes: 'Ce que tu veux tenir, jour après jour.',
    };
    const box = $('#libWidget'), desc = $('#libDesc');
    const show = (id, anim = true) => {
      $$('button', list).forEach(b => b.setAttribute('aria-pressed', b.dataset.id === id));
      const el = make(id);
      if (anim && !reduced()) el.classList.add('swap');
      box.replaceChildren(el);
      fill(box);
      desc.innerHTML = `<span><span class="tag tag-demo">Disponible</span></span><h3 class="h3">${W[id].name}</h3><p>${DESC[id]}</p>`;
      if (anim && !reduced()) desc.classList.remove('swap'), void desc.offsetWidth, desc.classList.add('swap');
    };
    for (const [title, ids] of GROUPS) {
      const g = document.createElement('div');
      g.className = 'lib-group';
      g.innerHTML = `<h3>${title}</h3><div role="group" aria-label="${title}"></div>`;
      for (const id of ids) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'pick'; b.dataset.id = id; b.textContent = W[id].name;
        b.addEventListener('click', () => show(id));
        $('div', g).append(b);
      }
      list.append(g);
    }
    show('vol', false);
    live.observe($('#libStage'));
  }

  // L'aperçu du cahier de cours, dans « Bientôt ».
  const vGrid = $('#visionGrid');
  if (vGrid) { compose(vGrid, ['cahier', 'minuteur', 'flash']); }

  // ---------- F. Offres : le sélecteur met vraiment les prix à jour ----------
  const PRICES = {
    mois: { pro: ['7,90 €', 'TTC par mois', 'ou 76 € TTC par an'], ia: ['15,90 €', 'TTC par mois', 'ou 153 € TTC par an'] },
    an: { pro: ['76 €', 'TTC par an', 'Facturé 76 € par an, soit environ 6,33 € par mois.'], ia: ['153 €', 'TTC par an', 'Facturé 153 € par an, soit 12,75 € par mois.'] },
  };
  const bill = $('#billing');
  if (bill) {
    const set = async period => {
      $$('button', bill).forEach(b => b.setAttribute('aria-pressed', b.dataset.bill === period));
      const els = $$('[data-price]');
      if (!reduced()) { els.forEach(e => e.classList.add('flip')); await sleep(180); }
      for (const e of els) {
        const [p, unit, sub] = PRICES[period][e.dataset.price];
        $('b', e).textContent = p.replace(' ', ' ');
        $('span', e).textContent = unit;
        $(`[data-sub=${e.dataset.price}]`).textContent = sub.replace(/ €/g, ' €');
        e.classList.remove('flip');
      }
    };
    $$('button', bill).forEach(b => b.addEventListener('click', () => set(b.dataset.bill)));
  }

  // ---------- Sélecteurs : un repère glisse sous l'option choisie (durée, Study / Chill, mensuel / annuel) ----------
  for (const group of $$('#modeSeg, #billing, #lkDurations')) {
    let ink = $('.seg-ink', group);
    if (!ink) { ink = document.createElement('span'); ink.className = 'seg-ink'; ink.setAttribute('aria-hidden', 'true'); group.prepend(ink); }
    group.classList.add('has-ink');
    const place = instant => {
      const b = $('[aria-pressed=true]', group);
      if (!b || !b.offsetWidth) return;
      if (instant) ink.style.transition = 'none';
      ink.style.width = b.offsetWidth + 'px';
      ink.style.height = b.offsetHeight + 'px';
      ink.style.top = '0';
      ink.style.transform = `translate(${b.offsetLeft}px,${b.offsetTop}px)`;
      if (instant) { void ink.offsetWidth; ink.style.transition = ''; }
    };
    new MutationObserver(() => place(false)).observe(group, { attributes: true, subtree: true, attributeFilter: ['aria-pressed', 'hidden'] });
    addEventListener('resize', () => place(true));
    if (document.fonts) document.fonts.ready.then(() => place(true));
    place(true);
  }

  // ---------- Navigation, menu, entrées au défilement ----------
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 4);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const menu = $('#menu');
  menu?.addEventListener('click', e => { if (e.target.closest('a')) try { menu.hidePopover(); } catch { /* déjà fermé */ } });

  const items = $$('.reveal, .close-art');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const sec = e.target.closest('section') || document.body;
      const peers = $$('.reveal:not(.in)', sec);
      e.target.style.transitionDelay = Math.min(peers.indexOf(e.target), 4) * 80 + 'ms';
      e.target.classList.add('in');
      io.unobserve(e.target);
    }), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(el => io.observe(el));
    // Filet de sécurité : si un bloc n'a pas été révélé (impression, capture, navigateur capricieux), on l'affiche.
    addEventListener('beforeprint', () => items.forEach(el => el.classList.add('in')));
  } else items.forEach(el => el.classList.add('in'));
})();
