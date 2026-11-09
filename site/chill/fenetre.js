// Chill C5 : Fenêtre d'ambiance. Une petite scène animée dessinée par le navigateur (aucune vidéo à télécharger) :
// pluie à la fenêtre, forêt, feu de cheminée. Indépendante du Vol de focus (pas de hublot, pas de cockpit).
// L'animation s'arrête quand on la met en pause, quand l'onglet est caché, quand la scène sort de l'écran ou quand
// le widget est retiré. Avec « réduire les animations », elle démarre à l'arrêt. Aucun son n'est lancé tout seul :
// « Ajouter le son assorti » passe par le moteur audio commun, seulement après un clic.
// Utilise el, button (dashboard.html) et ChillSon, chillAgrandir (chill.js).

const FENETRE_SCENES = [
  { id: 'pluie', name: 'Pluie', sound: { pluie: 45 } },
  { id: 'foret', name: 'Forêt', sound: { vent: 35 } },
  { id: 'feu', name: 'Cheminée', sound: { feu: 55 } },
];
const fenetreClean = d => ({
  scene: FENETRE_SCENES.some(s => s.id === d?.scene) ? d.scene : 'pluie',
  intensity: [1, 2, 3].includes(d?.intensity) ? d.intensity : 2,
});

// Le moteur de scène, réutilisable (widget, « J'ai cinq minutes »). Ne démarre jamais seul : play() est appelé par l'appelant.
function fenetreScene(host, initial) {
  const canvas = el('canvas', 'fenetre-canvas');
  canvas.setAttribute('role', 'img');
  host.append(canvas);
  const g = canvas.getContext('2d');
  let { scene, intensity } = fenetreClean(initial);
  let W = 0, H = 0, raf = 0, playing = false, visible = true, last = 0, t = 0, parts = [], backdrop = null, seed = 1;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const label = () => canvas.setAttribute('aria-label', `Scène : ${FENETRE_SCENES.find(s => s.id === scene).name}`);
  // Le décor fixe est dessiné une fois par taille, les particules seules bougent.
  function prepare() {
    seed = 7;
    backdrop = document.createElement('canvas');
    backdrop.width = W; backdrop.height = H;
    const b = backdrop.getContext('2d');
    const sky = (top, bottom) => { const grd = b.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, top); grd.addColorStop(1, bottom); b.fillStyle = grd; b.fillRect(0, 0, W, H); };
    if (scene === 'pluie') {
      sky('#2b3442', '#4a5568');
      for (let i = 0; i < 26; i++) { b.fillStyle = `rgba(${200 + rand() * 55},${170 + rand() * 60},${110 + rand() * 60},${.12 + rand() * .2})`; b.beginPath(); b.arc(rand() * W, H * (.45 + rand() * .5), 4 + rand() * W * .03, 0, 7); b.fill(); }
      b.strokeStyle = 'rgba(20,24,30,.85)'; b.lineWidth = Math.max(4, W * .018);
      b.strokeRect(0, 0, W, H); b.beginPath(); b.moveTo(W / 2, 0); b.lineTo(W / 2, H); b.moveTo(0, H * .45); b.lineTo(W, H * .45); b.stroke();
    } else if (scene === 'foret') {
      sky('#c9d8c5', '#7d9b7f');
      for (const [depth, color] of [[.55, '#6f8f73'], [.68, '#4f7056'], [.82, '#2f4a37']]) {
        b.fillStyle = color;
        for (let x = -20; x < W + 20; x += W * (.05 + rand() * .05)) {
          const h = H * (.25 + rand() * .25) * (depth + .2), base = H * depth + H * .2;
          b.beginPath(); b.moveTo(x, base - h); b.lineTo(x - h * .28, base); b.lineTo(x + h * .28, base); b.fill();
        }
        b.fillRect(0, H * depth + H * .2 - 1, W, H);
      }
    } else {
      sky('#1d1411', '#2b1d17');
      b.fillStyle = '#3a2a22'; b.fillRect(W * .15, H * .15, W * .7, H * .85);
      b.fillStyle = '#120c0a'; b.fillRect(W * .25, H * .35, W * .5, H * .65);
      b.fillStyle = '#5a3a26';
      b.save(); b.translate(W / 2, H * .9); b.rotate(-.12); b.fillRect(-W * .18, -H * .04, W * .36, H * .07); b.rotate(.24); b.fillRect(-W * .18, -H * .04, W * .36, H * .07); b.restore();
    }
    parts = [];
  }
  function spawn() {
    const want = { pluie: [0, 60, 140, 260], foret: [0, 14, 30, 55], feu: [0, 22, 40, 70] }[scene][intensity] * Math.max(.5, W / 600);
    while (parts.length < want) {
      if (scene === 'pluie') parts.push({ x: rand() * W, y: rand() * H, v: H * (.9 + rand() * .8), l: 8 + rand() * 14, glass: rand() < .12 });
      else if (scene === 'foret') parts.push({ x: rand() * W, y: rand() * H, v: 6 + rand() * 14, r: 1.5 + rand() * 2.5, ph: rand() * 6, leaf: rand() < .4 });
      else parts.push({ x: W * (.38 + rand() * .24), y: H * .88, v: H * (.18 + rand() * .3), life: rand(), r: W * (.015 + rand() * .03) });
    }
    parts.length = Math.min(parts.length, Math.ceil(want));
  }
  function frame(dt) {
    g.drawImage(backdrop, 0, 0);
    spawn();
    if (scene === 'pluie') {
      g.strokeStyle = 'rgba(220,230,245,.45)'; g.lineWidth = Math.max(1, W / 500);
      g.beginPath();
      for (const p of parts) {
        if (p.glass) { p.y += p.v * dt * .08; g.moveTo(p.x, p.y); g.lineTo(p.x, p.y + 3); }
        else { p.y += p.v * dt; p.x -= p.v * dt * .08; g.moveTo(p.x, p.y); g.lineTo(p.x + p.l * .08, p.y - p.l); }
        if (p.y > H + 20) { p.y = -20; p.x = rand() * W * 1.1; }
      }
      g.stroke();
    } else if (scene === 'foret') {
      for (const p of parts) {
        p.y += p.v * dt * (p.leaf ? 1 : -.25); p.x += Math.sin(t * .8 + p.ph) * dt * 10;
        if (p.y > H + 10) p.y = -10; if (p.y < -10) p.y = H + 10;
        g.fillStyle = p.leaf ? 'rgba(170,120,60,.75)' : `rgba(250,240,170,${.35 + .35 * Math.sin(t * 2 + p.ph) ** 2})`;
        g.beginPath(); p.leaf ? g.ellipse(p.x, p.y, p.r * 1.6, p.r * .8, t + p.ph, 0, 7) : g.arc(p.x, p.y, p.r, 0, 7); g.fill();
      }
    } else {
      const glow = g.createRadialGradient(W / 2, H * .85, 0, W / 2, H * .85, W * .45);
      glow.addColorStop(0, `rgba(255,150,60,${.32 + .06 * Math.sin(t * 7) + .04 * intensity})`); glow.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = glow; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      for (const p of parts) {
        p.life += dt * (.7 + intensity * .2);
        if (p.life > 1) { p.life = 0; p.x = W * (.38 + rand() * .24); }
        const y = H * .88 - p.v * p.life, r = p.r * (1 - p.life);
        g.fillStyle = `rgba(255,${120 + 100 * (1 - p.life)},40,${.5 * (1 - p.life)})`;
        g.beginPath(); g.arc(p.x + Math.sin(t * 5 + p.v) * 3, y, Math.max(.5, r), 0, 7); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    }
  }
  function loop(now) {
    raf = 0;
    if (!playing || !visible || document.hidden) return;
    raf = requestAnimationFrame(loop);
    if (now - last < 1000 / 30) return; // 30 images par seconde suffisent pour une ambiance
    const dt = last ? Math.min(.1, (now - last) / 1000) : 0;
    last = now; t += dt;
    frame(dt);
  }
  const wake = () => { if (playing && visible && !document.hidden && !raf) { last = 0; raf = requestAnimationFrame(loop); } };
  function fit() {
    const w = Math.round(Math.min(host.clientWidth || 300, 900) * Math.min(devicePixelRatio || 1, 2));
    if (!w || w === W) return;
    W = canvas.width = w; H = canvas.height = Math.round(w * .62);
    prepare();
    frame(0);
  }
  const resize = new ResizeObserver(fit);
  resize.observe(host);
  const seen = new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); });
  seen.observe(canvas);
  document.addEventListener('visibilitychange', wake);
  label();
  fit();
  return {
    canvas,
    get: () => ({ scene, intensity }),
    set(next) { ({ scene, intensity } = fenetreClean({ scene, intensity, ...next })); label(); if (W) { prepare(); frame(0); } },
    play() { playing = true; wake(); },
    pause() { playing = false; cancelAnimationFrame(raf); raf = 0; },
    playing: () => playing,
    destroy() { playing = false; cancelAnimationFrame(raf); resize.disconnect(); seen.disconnect(); document.removeEventListener('visibilitychange', wake); canvas.remove(); },
  };
}

function fenetreWidget({ body, meta, data, save }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = el('div', 'fenetre');
  const stage = el('div', 'fenetre-stage');
  const note = el('p', 'zone');
  note.setAttribute('role', 'status');
  const view = fenetreScene(stage, data);
  const scenes = el('div', 'choices');
  scenes.setAttribute('role', 'group');
  scenes.ariaLabel = 'Scène';
  const level = el('div', 'choices');
  level.setAttribute('role', 'group');
  level.ariaLabel = 'Intensité';
  const toggle = button('primary', '', () => { view.playing() ? view.pause() : view.play(); draw(); });
  const sound = button('ghost', 'Ajouter le son assorti', async () => {
    const s = FENETRE_SCENES.find(x => x.id === view.get().scene);
    ChillSon.setMix({ vol: s.sound, master: ChillSon.master() || 60 });
    try { const why = await ChillSon.play(); note.textContent = why ? 'Monte le volume général du widget Ambiance pour entendre le son.' : `Son « ${s.name.toLowerCase()} » lancé. Mets-le en pause depuis l'ambiance sonore ou « Mes ambiances ».`; }
    catch { note.textContent = "Ton navigateur n'a pas pu lancer le son."; }
  });
  let dialog = null;
  const big = button('ghost', 'Agrandir', () => { dialog = chillAgrandir("Fenêtre d'ambiance", stage, () => { dialog = null; }); });
  const ctrl = el('div', 'atelier-row');
  ctrl.append(toggle, big, sound);
  root.append(stage, scenes, level, ctrl, note);
  const told = () => document.dispatchEvent(new Event('renzvi:fenetre-maj'));
  const persist = () => { save(view.get()); told(); };
  function draw() {
    const { scene, intensity } = view.get();
    scenes.replaceChildren(...FENETRE_SCENES.map(s => {
      const b = button('', s.name, () => { view.set({ scene: s.id }); persist(); draw(); });
      b.setAttribute('aria-pressed', s.id === scene);
      return b;
    }));
    level.replaceChildren(...[[1, 'Douce'], [2, 'Moyenne'], [3, 'Forte']].map(([n, name]) => {
      const b = button('', name, () => { view.set({ intensity: n }); persist(); draw(); });
      b.setAttribute('aria-pressed', n === intensity);
      return b;
    }));
    toggle.textContent = view.playing() ? 'Pause' : 'Lecture';
    meta.textContent = view.playing() ? 'En cours' : '';
  }
  // « Mes ambiances » lit la scène affichée et peut en appliquer une autre.
  const onAsk = e => {
    if (e.detail?.set) { view.set(e.detail.set); persist(); draw(); e.detail.ok = true; }
    e.detail.current = view.get();
  };
  document.addEventListener('renzvi:fenetre', onAsk);
  if (reduced) note.textContent = "Ton appareil demande moins d'animations : la scène reste immobile tant que tu ne lances pas la lecture.";
  else view.play();
  draw();
  body.append(root);
  told();
  return () => { document.removeEventListener('renzvi:fenetre', onAsk); dialog?.close(); view.destroy(); told(); };
}
