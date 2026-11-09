// Chill : services partagés par les widgets de détente.
// - ChillSon : le seul moteur audio de Renzvi (sons synthétisés), avec l'arrêt progressif.
// - chillRespiration / chillPause : les séances guidées, réutilisées par « J'ai cinq minutes ».
// - chillLazy : charge un module Chill seulement quand son widget s'affiche (état chargement / erreur).
// - chillAgrandir : vue agrandie dans une fenêtre, chillVersInspiration : envoie une création au tableau.
// Utilise el, button, clockLabel, SOUNDS, BREATH_*, BREAKS (dashboard.html), lus au moment de l'appel.

// Fondu de l'arrêt progressif : le volume vaut 1 jusqu'au début du fondu, puis descend en ligne droite jusqu'à 0.
function chillSleepGain(now, end, fade) {
  if (!end) return 1;
  if (now >= end) return 0;
  return Math.min(1, Math.max(0, (end - now) / fade));
}

const ChillSon = (() => {
  const SCALE = { pluie: .55, vent: .9, feu: .8, cabine: 1.1, blanc: .3 };
  const SLEEP_KEY = 'renzvi:sommeil';
  const clamp = v => (Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : 0);
  let volumes = {}, level = 100, ctx = null, nodes = null, playing = false;
  let sleep = null, sleepTimer = null;
  const listeners = new Set();
  const emit = why => { for (const f of listeners) try { f(why); } catch (e) { console.error(e); } };
  try { const s = JSON.parse(localStorage.getItem(SLEEP_KEY)); if (Number.isFinite(s?.end) && Number.isFinite(s?.fade)) sleep = s; } catch {}

  const noiseBuffer = kind => {
    const rate = ctx.sampleRate, N = rate * 6, fade = Math.floor(rate * .05), raw = new Float32Array(N + fade);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, brown = 0;
    for (let i = 0; i < raw.length; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') raw[i] = w;
      else if (kind === 'pink') {
        b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852;
        b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898;
        raw[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926;
      } else { brown = (brown + .02 * w) / 1.02; raw[i] = brown * 3.5; }
    }
    const buffer = ctx.createBuffer(1, N, rate), out = buffer.getChannelData(0);
    out.set(raw.subarray(0, N));
    // Fondu enchaîné entre la fin et le début : la boucle ne fait pas de « clic ».
    for (let i = 0; i < fade; i++) { const a = (i / fade) * Math.PI / 2; out[i] = raw[i] * Math.sin(a) + raw[N + i] * Math.cos(a); }
    return buffer;
  };
  const masterGain = () => (level / 100) ** 2 * .5;
  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = masterGain();
    // Le fondu de l'arrêt progressif a son propre réglage : changer le volume général pendant le fondu ne le perturbe pas.
    const fade = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    master.connect(fade);
    fade.connect(limiter);
    limiter.connect(ctx.destination);
    const noise = { white: noiseBuffer('white'), pink: noiseBuffer('pink'), brown: noiseBuffer('brown') };
    const source = kind => { const n = ctx.createBufferSource(); n.buffer = noise[kind]; n.loop = true; n.start(0, Math.random() * 5); return n; };
    const filter = (type, frequency, q = 1) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = frequency; f.Q.value = q; return f; };
    const chain = (...list) => list.reduce((a, b) => { a.connect(b); return b; });
    const timers = [], gains = {};
    for (const { id } of SOUNDS) { const g = ctx.createGain(); g.gain.value = 0; g.connect(master); gains[id] = g; }
    chain(source('white'), filter('highpass', 700), filter('lowpass', 9000), gains.pluie);
    // Le vent : un bruit rose dont la bande de fréquence monte et descend très lentement.
    const wind = filter('bandpass', 450, .6), sway = ctx.createOscillator(), depth = ctx.createGain();
    sway.frequency.value = .09; depth.gain.value = 260; sway.connect(depth); depth.connect(wind.frequency); sway.start();
    chain(source('pink'), wind, gains.vent);
    chain(source('brown'), filter('lowpass', 650), gains.cabine);
    chain(source('white'), filter('lowpass', 12000), gains.blanc);
    // Le feu : un grondement grave, et de petits craquements espacés au hasard.
    chain(source('brown'), filter('lowpass', 240), gains.feu);
    const c = ctx;
    const crackle = () => {
      if (c.state === 'closed') return;
      if (c.state === 'running' && volumes.feu > 0) {
        const burst = c.createBufferSource(), band = filter('bandpass', 1800 + Math.random() * 2600, 1.4), env = c.createGain(), t = c.currentTime;
        burst.buffer = noise.white;
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(.25 + Math.random() * .5, t + .004);
        env.gain.exponentialRampToValueAtTime(.001, t + .03 + Math.random() * .07);
        chain(burst, band, env, gains.feu);
        burst.start(t, Math.random() * 5, .12);
      }
      timers[0] = setTimeout(crackle, 90 + Math.random() * 650);
    };
    crackle();
    nodes = { master, fade, gains, timers };
    for (const { id } of SOUNDS) apply(id);
  }
  const apply = id => nodes?.gains[id] && nodes.gains[id].gain.setTargetAtTime((volumes[id] / 100) ** 2 * SCALE[id], ctx.currentTime, .05);

  // L'arrêt progressif : une seule minuterie, l'heure de fin enregistrée fait foi (page suspendue, rechargée…).
  function saveSleep() { try { sleep ? localStorage.setItem(SLEEP_KEY, JSON.stringify(sleep)) : localStorage.removeItem(SLEEP_KEY); } catch {} }
  function schedule() {
    clearTimeout(sleepTimer);
    sleepTimer = null;
    if (!sleep) return;
    const now = Date.now(), left = sleep.end - now;
    if (left <= 0) {
      const wasPlaying = playing;
      sleep = null;
      saveSleep();
      if (wasPlaying) stop('sommeil'); else emit('sommeil');
      return;
    }
    const fadeStart = sleep.end - sleep.fade;
    if (ctx && playing && nodes) {
      const g = nodes.fade.gain, t = ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(chillSleepGain(now, sleep.end, sleep.fade), t);
      if (now >= fadeStart) g.linearRampToValueAtTime(0, t + left / 1000);
    }
    // Un réveil au début du fondu, puis à la fin. Plafonné à une minute pour se recaler si l'horloge a sauté.
    sleepTimer = setTimeout(schedule, Math.max(50, Math.min(now < fadeStart ? fadeStart - now : left, 60000)));
  }
  function resetFade() {
    if (!nodes) return;
    const g = nodes.fade.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(1, ctx.currentTime);
  }
  globalThis.addEventListener?.('visibilitychange', () => { if (!document.hidden) schedule(); });
  schedule();

  function stop(why = 'stop') {
    if (nodes) nodes.timers.forEach(clearTimeout);
    ctx?.close().catch(() => {});
    ctx = nodes = null;
    playing = false;
    emit(why);
  }

  return {
    sounds: () => SOUNDS.map(s => ({ ...s })),
    // Réglages enregistrés par le widget Ambiance : la pluie à volume doux si rien n'a jamais été réglé.
    load(data) {
      volumes = Object.fromEntries(SOUNDS.map(snd => [snd.id, snd.id === 'pluie' && !data?.vol ? 35 : clamp(data?.vol?.[snd.id])]));
      level = Number.isFinite(data?.master) ? clamp(data.master) : 100;
      if (nodes) { nodes.master.gain.setTargetAtTime(masterGain(), ctx.currentTime, .05); SOUNDS.forEach(s => apply(s.id)); }
      emit('load');
    },
    settings: () => ({ vol: { ...volumes }, master: level }),
    volume: id => volumes[id] ?? 0,
    master: () => level,
    playing: () => playing,
    active: () => !!ctx,
    setVolume(id, v) { if (!(id in volumes)) return; volumes[id] = clamp(v); apply(id); emit('volume'); },
    setMaster(v) { level = clamp(v); nodes?.master.gain.setTargetAtTime(masterGain(), ctx.currentTime, .05); emit('volume'); },
    // Applique un mélange complet (préréglage) ; renvoie les sons qui n'existent plus.
    setMix(mix) {
      const missing = Object.keys(mix?.vol ?? {}).filter(id => !SOUNDS.some(s => s.id === id));
      volumes = Object.fromEntries(SOUNDS.map(s => [s.id, clamp(mix?.vol?.[s.id])]));
      if (Number.isFinite(mix?.master)) level = clamp(mix.master);
      if (nodes) { nodes.master.gain.setTargetAtTime(masterGain(), ctx.currentTime, .05); SOUNDS.forEach(s => apply(s.id)); }
      emit('mix');
      return missing;
    },
    // Toujours après un geste de l'utilisateur : le navigateur refuse le son sinon, et Renzvi ne lance jamais rien seul.
    async play() {
      if (level === 0) return 'master';
      if (!SOUNDS.some(s => volumes[s.id] > 0)) return 'silence';
      if (!ctx) build();
      await ctx.resume();
      playing = true;
      schedule();
      emit('play');
      return null;
    },
    async pause() {
      if (ctx) await ctx.suspend();
      playing = false;
      emit('pause');
    },
    // Libère vraiment le son : contexte audio fermé, craquements arrêtés. Le prochain lancement repart à neuf.
    stop,
    sleepStart(ms, fade = Math.min(60000, ms / 2)) {
      sleep = { end: Date.now() + ms, fade: Math.max(1000, Math.min(fade, ms)) };
      saveSleep();
      resetFade();
      schedule();
      emit('sommeil');
    },
    sleepCancel() {
      sleep = null;
      saveSleep();
      clearTimeout(sleepTimer);
      resetFade();
      emit('sommeil');
    },
    sleepEnd: () => sleep?.end ?? null,
    subscribe(f) { listeners.add(f); return () => listeners.delete(f); },
  };
})();

// Respiration guidée. Rend les mêmes éléments que l'ancien widget ; « J'ai cinq minutes » l'utilise sans le choix de durée.
function chillRespiration({ meta, minutes = 3, choices: withChoices = true, onEnd } = {}) {
  let length = minutes, endAt = null, ticker = null, phase = '';
  const choices = el('div', 'choices');
  choices.setAttribute('role', 'group');
  choices.ariaLabel = 'Durée de la respiration';
  const circle = el('div', 'breath');
  circle.setAttribute('aria-hidden', 'true');
  const stage = el('div', 'breath-stage');
  stage.append(circle);
  const word = el('p', 'breath-word', 'Prêt ?');
  word.setAttribute('aria-hidden', 'true'); // change toutes les quelques secondes : on n'inonde pas un lecteur d'écran
  const status = el('p', 'zone');
  status.setAttribute('role', 'status');
  const hint = el('p', 'zone', `Inspire ${BREATH_IN / 1000} s, expire ${BREATH_OUT / 1000} s. Arrête quand tu veux. Ce n'est pas un soin médical.`);
  const go = button('primary', 'Commencer', () => (endAt ? finish(false) : start()));
  const ctrl = el('div', 'ctrl');
  ctrl.append(go);
  function setPhase(next) {
    phase = next;
    circle.style.setProperty('--dur', `${(next === 'in' ? BREATH_IN : BREATH_OUT) / 1000}s`);
    circle.classList.toggle('in', next === 'in');
    word.textContent = next === 'in' ? 'Inspire' : 'Expire';
  }
  function tick() {
    const left = endAt - Date.now();
    if (left <= 0) return finish(true);
    const into = (length * 60000 - left) % (BREATH_IN + BREATH_OUT);
    const next = into < BREATH_IN ? 'in' : 'out';
    if (next !== phase) setPhase(next);
    if (meta) meta.textContent = clockLabel(left);
  }
  function start() {
    endAt = Date.now() + length * 60000;
    status.textContent = '';
    for (const b of choices.children) b.disabled = true;
    go.textContent = 'Arrêter';
    setPhase('in');
    // L'heure de fin fait foi : un onglet en arrière-plan ralentit les minuteries du navigateur.
    ticker = setInterval(tick, 250);
    tick();
  }
  function finish(done) {
    clearInterval(ticker);
    endAt = null;
    phase = '';
    circle.classList.remove('in');
    word.textContent = 'Prêt ?';
    if (meta) meta.textContent = '';
    go.textContent = 'Commencer';
    for (const b of choices.children) b.disabled = false;
    status.textContent = done ? 'Séance terminée. Prends un instant avant de reprendre.' : '';
    onEnd?.(done);
  }
  for (const n of BREATH_CHOICES) {
    const b = button('', `${n} min`, () => {
      length = n;
      for (const c of choices.children) c.setAttribute('aria-pressed', c === b);
    });
    b.setAttribute('aria-pressed', n === length);
    choices.append(b);
  }
  return {
    nodes: [...(withChoices ? [choices] : []), stage, word, status, hint, ctrl],
    start: () => { if (!endAt) start(); },
    stop: () => { if (endAt) finish(false); },
    running: () => endAt !== null,
    cleanup: () => clearInterval(ticker),
  };
}

// Pause guidée : la liste des pauses et le décompte en cercle. start(pause) lance une pause précise depuis un autre parcours.
function chillPause({ meta, list: withList = true, onEnd } = {}) {
  let ticker = null, endAt = null, chosen = null;
  const status = el('p', 'zone');
  status.setAttribute('role', 'status');
  const list = el('ul', 'rows');
  const view = el('div');
  view.hidden = true;
  const name = el('p', 'book-title');
  const how = el('p', 'zone');
  const NS = 'http://www.w3.org/2000/svg';
  const ring = document.createElementNS(NS, 'svg');
  ring.setAttribute('class', 'ring');
  ring.setAttribute('viewBox', '0 0 120 120');
  ring.setAttribute('aria-hidden', 'true');
  const track = document.createElementNS(NS, 'circle'), fill = document.createElementNS(NS, 'circle');
  for (const [c, cls] of [[track, 'track'], [fill, 'fill']]) { c.setAttribute('class', cls); c.setAttribute('cx', 60); c.setAttribute('cy', 60); c.setAttribute('r', 52); ring.append(c); }
  const time = el('div', 'ring-time');
  time.setAttribute('role', 'timer');
  const stop = button('ghost', 'Arrêter la pause', () => finish(false));
  view.append(name, how, ring, time, stop);

  function tick() {
    const left = endAt - Date.now();
    if (left <= 0) return finish(true);
    time.textContent = clockLabel(left);
    fill.style.strokeDashoffset = String(327 * (1 - left / (chosen.seconds * 1000)));
  }
  function start(b) {
    chosen = b;
    endAt = Date.now() + b.seconds * 1000;
    status.textContent = '';
    name.textContent = b.name;
    how.textContent = b.text;
    list.hidden = true;
    view.hidden = false;
    if (meta) meta.textContent = '';
    // L'heure de fin fait foi : un onglet en arrière-plan ralentit les minuteries du navigateur.
    ticker = setInterval(tick, 250);
    tick();
    stop.focus();
  }
  function finish(done) {
    clearInterval(ticker);
    endAt = null;
    view.hidden = true;
    list.hidden = !withList;
    status.textContent = done ? `Pause terminée : ${chosen.name.toLowerCase()}. Tu peux reprendre.` : '';
    if (withList) list.querySelector('button').focus();
    onEnd?.(done);
  }
  for (const b of BREAKS) {
    const li = el('li');
    const go = button('break', b.name, () => start(b));
    go.append(el('span', '', b.seconds < 60 ? `${b.seconds} s` : `${b.seconds / 60} min`));
    li.append(go);
    list.append(li);
  }
  if (!withList) list.hidden = true;
  return {
    nodes: [list, view, status],
    start: b => { if (!endAt) start(b); },
    stop: () => { if (endAt) finish(false); },
    running: () => endAt !== null,
    cleanup: () => clearInterval(ticker),
  };
}

// Chargement à la demande des modules Chill : un module n'est téléchargé qu'à l'affichage de son widget.
const chillScripts = new Map();
function chillScript(src) {
  if (!chillScripts.has(src)) chillScripts.set(src, new Promise((resolve, reject) => {
    const s = Object.assign(document.createElement('script'), { src, async: true });
    s.onload = resolve;
    s.onerror = () => { chillScripts.delete(src); s.remove(); reject(new Error(`module introuvable : ${src}`)); };
    document.head.append(s);
  }));
  return chillScripts.get(src);
}
function chillStyle() {
  if (document.querySelector('link[data-chill]')) return;
  const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'chill/chill.css' });
  link.setAttribute('data-chill', '');
  document.head.append(link);
}
// Le rendu d'un widget dont le code est dans un module à part. ctx.simu (labo seulement) : { delay, fail }.
const chillLazy = (src, name) => ctx => {
  let cleanup = null, gone = false;
  const simu = ctx.simu ?? {};
  function load() {
    ctx.body.replaceChildren(el('p', 'empty', 'Chargement…'));
    chillStyle();
    const wait = simu.delay ? new Promise(r => setTimeout(r, simu.delay)) : null;
    Promise.all([simu.fail ? Promise.reject(new Error('panne simulée')) : chillScript(src), wait]).then(() => {
      if (gone) return;
      ctx.body.replaceChildren();
      cleanup = window[name](ctx) ?? null;
    }).catch(e => {
      if (gone) return;
      console.error(e);
      const retry = button('ghost', 'Réessayer', () => { simu.fail = false; load(); });
      const box = el('div', 'empty');
      box.append(el('p', 'msg', "Ce widget n'a pas pu se charger. Vérifie ta connexion."), retry);
      ctx.body.replaceChildren(box);
    });
  }
  load();
  return () => { gone = true; cleanup?.(); };
};

// Vue agrandie : le contenu passe dans une grande fenêtre, puis revient à sa place à la fermeture.
function chillAgrandir(title, content, onClose) {
  const dialog = el('dialog', 'glass chill-big');
  const head = el('div', 'chill-big-head');
  const close = button('ghost', 'Fermer', () => dialog.close());
  head.append(el('h2', '', title), close);
  const home = content.parentNode, next = content.nextSibling;
  dialog.append(head, content);
  dialog.setAttribute('aria-label', title);
  dialog.addEventListener('close', () => {
    home?.insertBefore(content, next?.parentNode === home ? next : null);
    dialog.remove();
    onClose?.();
  });
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

// Ajoute une image (JPEG) au tableau d'inspiration, par le dashboard qui gère son stockage privé.
// Renvoie { ok: true } ou { ok: false, why: 'plein' | 'format' | 'envoi' | 'indisponible' }.
function chillVersInspiration(blob, caption = '') {
  const detail = { blob, caption: String(caption).slice(0, 60) };
  document.dispatchEvent(new CustomEvent('renzvi:inspiration', { detail }));
  return detail.result ?? Promise.resolve({ ok: false, why: 'indisponible' });
}
const CHILL_INSP_ERREUR = {
  plein: "Ton tableau d'inspiration est plein (6 images). Retires-en une d'abord.",
  format: "Cette image n'a pas pu être préparée pour le tableau.",
  envoi: "L'envoi n'a pas abouti. Vérifie ta connexion et réessaie.",
  indisponible: "Le tableau d'inspiration n'est pas disponible ici.",
};

// Une image JPEG de 1000 px au plus et 500 Ko au plus, sur fond blanc : le format accepté par le tableau d'inspiration.
async function chillJpeg(source) {
  for (const [side, quality] of [[1000, .85], [1000, .7], [800, .65], [640, .6]]) {
    const scale = Math.min(1, side / Math.max(source.width, source.height));
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(source.width * scale), height: Math.round(source.height * scale) });
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(source, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', quality));
    if (blob && blob.size <= 500 * 1024) return blob;
  }
  return null;
}
// Téléchargement d'un fichier fabriqué dans le navigateur (export PNG).
function chillTelecharger(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

if (typeof module !== 'undefined') module.exports = { chillSleepGain };
