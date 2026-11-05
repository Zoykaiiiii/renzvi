// Vol de focus : la scène avion de la landing. C'est une DÉMONSTRATION : pas de plein écran, pas de verrou d'écran,
// aucun son, aucune séance lancée, rien d'enregistré. Le défilement n'est jamais bloqué : la scène reste fixée le temps
// que la section défile, et tout ce qui bouge dépend de la position de défilement (on remonte, tout revient en arrière).
// Le ticket, la déchirure et le ciel du hublot sont repris de dashboard.html (boardingPass, tearAnimation,
// SKY / LANDSCAPE_SHADER / startWindowView) avec les mêmes règles (ROUTES, numéro RZ 100 + durée).
// Si on les change dans le dashboard, les reporter ici.
(() => {
  'use strict';
  const sec = document.getElementById('vol');
  if (!sec) return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const has3d = !!(window.CSS && CSS.supports('transform-style', 'preserve-3d') && CSS.supports('perspective', '1px') && Element.prototype.animate);
  const clamp = (v, a = 0, b = 1) => Math.min(Math.max(v, a), b);
  const ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  const el = (tag, cls = '', text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const mobile = () => innerWidth <= 640;

  // ---------- Les règles du vol, reprises du dashboard ----------
  const MAX_FLIGHT = 180;
  const ROUTES = [
    { upTo: 20, code: 'NTE', city: 'Nantes' }, { upTo: 30, code: 'LYS', city: 'Lyon' },
    { upTo: 50, code: 'GVA', city: 'Genève' }, { upTo: 75, code: 'FCO', city: 'Rome' },
    { upTo: 105, code: 'LIS', city: 'Lisbonne' }, { upTo: 150, code: 'ATH', city: 'Athènes' },
    { upTo: MAX_FLIGHT, code: 'IST', city: 'Istanbul' },
  ];
  const durationLabel = minutes => minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${String(minutes % 60).padStart(2, '0')}` : ''}`;
  const clockLabel = ms => {
    const total = Math.ceil(ms / 1000);
    const parts = [Math.floor(total / 60) % 60, total % 60].map(n => String(n).padStart(2, '0'));
    return (total >= 3600 ? [Math.floor(total / 3600), ...parts] : parts).join(':');
  };
  // Données de démonstration : le prénom d'exemple de la landing, jamais celui d'un vrai compte.
  const ticketFor = minutes => ({ minutes, route: ROUTES.find(r => minutes <= r.upTo), number: `RZ ${100 + minutes}`, passenger: 'Léa' });

  function boardingPass(ticket) {
    const pass = el('div', 'boarding');
    const main = el('div', 'bmain');
    const fields = el('dl', 'bfields');
    for (const [label, value] of [['Passager', ticket.passenger], ['Durée', durationLabel(ticket.minutes)], ['Vol', ticket.number]]) {
      const field = el('div');
      field.append(el('dt', '', label), el('dd', '', value));
      fields.append(field);
    }
    main.append(el('p', 'blabel', "Carte d'embarquement"), el('p', 'broute', `PAR → ${ticket.route.code}`), el('p', 'bcity', `Paris → ${ticket.route.city}`), fields);
    const stub = el('div', 'bstub');
    let x = 0, seed = ticket.minutes * 7 + 3, bars = '';
    while (x < 64) {
      seed = (seed * 31 + 11) % 97;
      const width = 1 + seed % 3;
      bars += `<rect x="${x}" width="${width}" height="24"/>`;
      x += width + 1 + (seed >> 2) % 2;
    }
    stub.innerHTML = `<svg viewBox="0 0 64 24" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;
    stub.append(el('p', '', ticket.number));
    pass.append(main, stub);
    return pass;
  }

  // ---------- Le ciel du hublot (repris de startWindowView) ----------
  const SKY = [
    { zenith: [.30, .50, .74], horizon: [.82, .87, .92], lit: [.98, .98, .98], shade: [.56, .65, .76] },
    { zenith: [.34, .48, .68], horizon: [.93, .85, .76], lit: [.99, .95, .89], shade: [.57, .60, .68] },
    { zenith: [.34, .38, .56], horizon: [.99, .71, .47], lit: [1, .83, .71], shade: [.50, .42, .52] },
  ];
  const skyAt = progress => {
    const p = clamp(progress) * (SKY.length - 1), i = Math.min(Math.floor(p), SKY.length - 2), f = p - i;
    return Object.fromEntries(Object.keys(SKY[0]).map(k => [k, SKY[i][k].map((v, c) => v + (SKY[i + 1][k][c] - v) * f)]));
  };
  // Le ciel de la landing : une mer de nuages vue en perspective. Bruit « à gradients » (sans grille visible), tourné à
  // chaque niveau de détail et déformé par lui-même pour des masses douces et jamais identiques ; les petits détails
  // s'effacent avec la distance (pas de marches à l'horizon) et une brume donne la profondeur. Plus léger que le
  // ciel du dashboard, qui lance un rayon pas à pas.
  const LANDSCAPE_SHADER = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 size; uniform float t, day, quality; uniform vec3 zenith, horizon, lit, shade;
float hash(vec2 p){ vec3 q = fract(p.xyx * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec2 hash2(vec2 p){ vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy) * 2. - 1.; }
float gnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.);
  float a = dot(hash2(i), f), b = dot(hash2(i + vec2(1., 0.)), f - vec2(1., 0.));
  float c = dot(hash2(i + vec2(0., 1.)), f - vec2(0., 1.)), d = dot(hash2(i + vec2(1., 1.)), f - vec2(1., 1.));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
const mat2 R = mat2(.8, -.6, .6, .8);
float fbm(vec2 p, float detail){
  float v = 0., a = .5;
  for (int i = 0; i < 5; i++) {
    float w = clamp(detail * 5. - float(i), 0., 1.);
    if (w <= 0.) break;                                 // les niveaux de détail inutiles ne sont pas calculés
    v += a * gnoise(p) * w;
    p = R * p * 2.03 + 17.1;
    a *= .5;
  }
  return v;
}
// La hauteur des nuages : de grosses masses arrondies (pas de plis en arête), un peu de bourgeons fins.
float tops(vec2 p, float detail){
  return .36 + fbm(p * .9, detail) * .62;
}
void main(){
  vec2 uv = gl_FragCoord.xy / size;
  float aspect = size.x / size.y, line = .56, x = (uv.x - .5) * aspect;
  vec2 sun2d = vec2(-.12, mix(.80, .655, day));
  float toSun = length(vec2(x, uv.y) - sun2d);
  vec3 sky = mix(horizon, zenith, smoothstep(0., .42, uv.y - line));
  sky = mix(sky, lit, clamp(exp(-toSun * 7.) * .55 + exp(-toSun * 40.), 0., 1.));
  // De fins voiles d'altitude au-dessus de l'horizon.
  float above = uv.y - line;
  if (above > 0.) {
    float k = 1. / (above + .12);
    float c = fbm(vec2(x * k * .45 + t * .006, k * 1.6), .55 * quality);
    sky = mix(sky, lit, smoothstep(.04, .4, c) * smoothstep(0., .07, above) * (1. - smoothstep(.2, .42, above)) * .28);
  }
  vec3 color = sky;
  if (uv.y < line + .02) {
    vec3 ray = normalize(vec3(x * 1.1, (uv.y - line) * 1.25 - .012, 1.));
    vec3 from = vec3(t * .035, 1., 0.);
    float slope = max(-ray.y, .012), dist = .3 / slope;
    float stepBy = .05 / slope, hit = 0.;
    float steps = 7. + 6. * quality;
    dist += stepBy * .45 * hash(gl_FragCoord.xy * .97);     // départ un peu décalé : pas de bandes régulières
    float before = dist, gapBefore = 1.;
    for (int i = 0; i < 16; i++) {
      if (float(i) >= steps) break;
      vec3 p = from + ray * dist;
      float detail = clamp(1.6 - dist * .11, .25, 1.) * quality;
      float gap = p.y - tops(p.xz * 1.5, detail * .5);        // recherche : relief simplifié (2 à 3 niveaux)
      if (gap < 0.) {
        hit = 1.;
        float after = dist;
        dist = mix(before, after, gapBefore / (gapBefore - gap));
        // deux affinages : le contour tombe au bon endroit, sans grain
        for (int j = 0; j < 2; j++) {
          vec3 m = from + ray * dist;
          if (m.y - tops(m.xz * 1.5, detail) < 0.) after = dist; else before = dist;
          dist = (before + after) * .5;
        }
        break;
      }
      before = dist; gapBefore = gap;
      dist += stepBy * (1. + float(i) * .08);              // des pas un peu plus longs au loin
    }
    vec2 q = (from + ray * dist).xz * 1.5;
    float detail = clamp(1.6 - dist * .11, .25, 1.) * quality;
    float height = tops(q, detail);
    // Le côté tourné vers le soleil est clair, les creux entre deux masses tombent dans une ombre douce.
    float towards = clamp((height - tops(q + vec2(-.12, .09), detail)) * 5.5 + .52, 0., 1.);
    float tall = smoothstep(.22, .62, height);
    vec3 cloud = mix(shade, lit, clamp(towards * .64 + tall * .62, 0., 1.));
    cloud = mix(cloud, lit, exp(-length(vec2(x, uv.y - line) - vec2(sun2d.x, -.03)) * 4.) * .28 * day);
    float haze = 1. - exp(-dist * dist * .0095);
    color = mix(mix(shade, cloud, hit), horizon, clamp(haze, 0., .92));
    color = mix(color, sky, smoothstep(line - .004, line + .014, uv.y));
  }
  color += (hash(gl_FragCoord.xy + fract(t) * 91.) - .5) * .016;
  gl_FragColor = vec4(color, 1.);
}`;
  // Renvoie { render(now, day, travel), stop } ou null si le navigateur ne sait pas dessiner : le hublot garde alors son ciel de secours.
  function makeSky(holder, zoomOf = () => 1) {
    const canvas = el('canvas');
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
    if (!gl) return null;
    const compile = (type, source) => { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); return s; };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, LANDSCAPE_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const corner = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
    const uniform = Object.fromEntries(['size', 't', 'day', 'quality', ...Object.keys(SKY[0])].map(name => [name, gl.getUniformLocation(program, name)]));
    let quality = mobile() ? .8 : 1; // téléphone : un niveau de détail en moins
    // Les nuages sont flous : une image basse définition suffit. Plus petite et moins fréquente sur téléphone.
    // Dessiné à la taille où il est vraiment affiché (la caméra l'agrandit contre la vitre), avec un plafond : le ciel
    // reste doux sans faire travailler le téléphone pour rien.
    const MAX_WIDTH = mobile() ? 380 : 620;
    let interval = RM ? 60000 : 1000 / (mobile() ? 15 : 20), scale = 1, last = -Infinity, late = 0;
    const fit = () => {
      const width = Math.min(holder.clientWidth * Math.min(devicePixelRatio, 2) * zoomOf(), MAX_WIDTH) * scale;
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(width * holder.clientHeight / (holder.clientWidth || 1)));
      gl.viewport(0, 0, canvas.width, canvas.height);
      last = -Infinity;
    };
    const watcher = new ResizeObserver(fit);
    holder.append(canvas);
    watcher.observe(holder);
    fit();
    const seed = Math.random() * 100;
    return {
      fit,
      render(now, day, travel, force) {
        if (!force && now - last < interval) return;
        // Téléphone trop lent : on baisse la définition, puis on ralentit plutôt que de le faire chauffer.
        late = last > 0 && now - last > interval * 2.5 ? late + 1 : Math.max(0, late - 1);
        // Appareil trop lent : d'abord moins d'images par seconde, puis moins de détails, puis un dessin un peu plus
        // petit ; en dernier recours un ciel presque immobile. Jamais de grosse perte de définition qui ferait du grain.
        if (late > 20) {
          late = 0;
          if (interval < 1000 / 12) interval = 1000 / 12;
          else if (quality > .6) quality = .6;
          else if (scale > .8) { scale = .8; fit(); }
          else interval = 250;
        }
        last = now;
        const sky = skyAt(day);
        gl.uniform2f(uniform.size, canvas.width, canvas.height);
        gl.uniform1f(uniform.t, seed + (RM ? 0 : now / 1000) + travel);
        gl.uniform1f(uniform.day, clamp(day));
        gl.uniform1f(uniform.quality, quality);
        for (const name of Object.keys(sky)) gl.uniform3fv(uniform[name], sky[name]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      stop() { watcher.disconnect(); gl.getExtension('WEBGL_lose_context')?.loseContext(); canvas.remove(); },
    };
  }

  // ---------- Les éléments ----------
  const stage = $('#plStage'), cabin = $('#plCabin'), far = $('#plFar'), wing = $('#plWing'), seat = $('#plSeat');
  const copy = $('#plCopy'), box = $('#lkTicket'), hud = $('#plHud'), clock = $('#lkClock'), deck = $('#plDeck');
  const routeEl = $('#lkRoute'), etaEl = $('#lkEta'), bar = $('.pl-bar', sec), veil = $('.pl-veil', sec);
  const go = $('#lkGo'), replay = $('#lkReplay'), quit = $('#lkQuit'), durs = $('#lkDurations'), note = $('#lkNote');
  const nav = $('#nav');
  const darkSections = $$('[data-dark]');
  const NOTE = note.textContent;

  let minutes = 25, state = 'seat', run = 0, timer = null, endAt = 0;
  let a = 0, tw = null;              // a : 0 = assis, 1 = contre le hublot
  let p = 0, pS = 0, last = 0;       // p : avancement du défilement dans la scène ; pS : la même valeur, lissée
  let looping = false, near = false, sky = null, glowAt = -1;
  let G = {};                        // géométrie de la scène (en px)
  let arrive = 1;                    // 0 → 1 : le ticket arrive pendant que la scène entre

  const pass = () => box.querySelector('.boarding');
  const renderTicket = () => { box.replaceChildren(boardingPass(ticketFor(minutes))); applyTicket(true); };
  if (!RM) sec.classList.add('pl-live');
  go.hidden = false;
  durs.hidden = false;
  renderTicket();

  // Où est le hublot, assis puis contre la vitre.
  function measure() {
    const W = stage.clientWidth, H = stage.clientHeight, m = mobile();
    const wx = W * (m ? .62 : .70), wy = H * (m ? .50 : .48), wh = H * (m ? .34 : .52);
    // Contre la vitre : le hublot se centre dans l'espace laissé entre la barre du haut et les commandes du vol.
    const top = 64 + 12, bottom = H - (m ? 172 : 104), tx = W * .5, ty = (top + bottom) / 2;
    const th = Math.min(H * (m ? .62 : .74), bottom - top, W * (m ? 1.05 : .6) / .72);
    G = { W, H, wx, wy, wh, tx, ty, th, S: th / wh, m };
    stage.style.setProperty('--wx', wx + 'px');
    stage.style.setProperty('--wy', wy + 'px');
    stage.style.setProperty('--wh', wh + 'px');
    stage.style.setProperty('--wt', (th * .72) + 'px');
    hud.style.height = (ty * 2) + 'px';
    stage.style.setProperty('--bar-h', bar.offsetHeight + 'px');
  }

  // ---------- Le ticket arrive en perspective, au rythme du défilement ----------
  function applyTicket(force) {
    const b = pass();
    if (!b || (state !== 'seat' && !force)) return;
    if (RM || !has3d) { b.style.transform = ''; b.style.opacity = ''; return; }
    const t = 1 - (1 - arrive) ** 3;
    b.style.transform = `translateY(${(1 - t) * 70}px) rotateX(${7 + 31 * (1 - t)}deg) rotateY(${-11 - 15 * (1 - t)}deg) rotateZ(${-2 * (1 - t)}deg) scale(${.74 + .26 * t})`;
    b.style.opacity = String(clamp(t * 1.4));
  }

  // ---------- La caméra et les plans ----------
  function frame(now) {
    const dt = Math.min(now - (last || now), 64);
    last = now;
    const vh = innerHeight, r = sec.getBoundingClientRect();
    // Avancement : 0 quand la scène se fixe en haut, 1 quand elle repart.
    const span = Math.max(r.height - stage.offsetHeight, 1);
    p = RM ? .5 : clamp(-r.top / span);
    pS += (p - pS) * (1 - Math.exp(-dt / 160)); // lissé : un changement brusque de sens ne fait pas sauter l'image
    if (Math.abs(p - pS) < .0004) pS = p;
    // La page passe au noir en approchant, puis revient au blanc cassé en sortant.
    // Le voile ne couvre que la fin de la section précédente, presque sortie de l'écran ; en sortant, il s'efface
    // dès que la suite apparaît, pour qu'aucun titre ne reste assombri.
    const enter = clamp((vh * .55 - r.top) / (vh * .35));
    const exit = clamp((vh * 1.15 - r.bottom) / (vh * .25));
    if (!RM) {
      const v = enter * (1 - exit);
      veil.style.opacity = v.toFixed(3);
      veil.style.visibility = v > .001 ? 'visible' : 'hidden'; // transparent = absent : il ne recouvre rien
      stage.style.opacity = (1 - exit).toFixed(3);
      const nextArrive = clamp((vh * .8 - r.top) / (vh * .8));
      if (Math.abs(nextArrive - arrive) > .001) { arrive = nextArrive; applyTicket(); }
    }
    // Rapprochement du hublot (après la déchirure).
    if (tw) {
      const k = clamp((now - tw.start) / tw.dur);
      a = tw.from + (tw.to - tw.from) * k;
      if (k >= 1) { const done = tw.done; tw = null; done(); }
    }
    if (RM) pS = p; // mouvement réduit : aucune caméra qui glisse
    const e = ease(a), d = pS - .5, s = 1 + (G.S - 1) * e, amp = RM ? 0 : G.m ? .6 : 1;
    // Caméra : un léger glissement latéral, une respiration verticale et une inclinaison d'un degré au plus.
    const driftX = -d * G.W * .045 * amp, driftY = -Math.sin(pS * Math.PI) * G.H * .014 * amp, rot = d * 1.4 * amp * (1 - .45 * e);
    cabin.style.transform = `translate(${(G.tx - G.wx) * e + driftX}px,${(G.ty - G.wy) * e + driftY}px) scale(${s}) rotate(${rot}deg)`;
    // Plans : le ciel (loin) bouge peu, l'aile un peu plus, le siège de devant (près) beaucoup plus.
    far.style.translate = `${-driftX * .55 / s}px ${-driftY * .4 / s}px`;
    wing.style.translate = `${-driftX * .3 / s}px ${d * 10}px`;
    wing.style.rotate = `${d * 3}deg`;
    seat.style.translate = `${driftX * 1.6 - G.W * .3 * e}px ${Math.abs(d) * G.H * .06 + G.H * .35 * e}px`;
    seat.style.opacity = String(1 - e);
    // La lumière évolue doucement : du plein jour vers la fin d'après-midi au fil de la scène.
    const day = .12 + .62 * pS;
    if (Math.abs(day - glowAt) > .01) {
      glowAt = day;
      const [rr, gg, bb] = skyAt(day).horizon;
      stage.style.setProperty('--glow', `rgb(${Math.round(rr * 255)} ${Math.round(gg * 255)} ${Math.round(bb * 255)})`);
    }
    sky?.render(now, day, pS * 16); // les nuages défilent avec le défilement, et reviennent quand on remonte
    // La barre du haut prend la couleur des chapitres sombres.
    if (nav) {
      const line = nav.offsetHeight / 2;
      const overPlane = r.top <= line && r.bottom > line && exit < .5;
      const overOther = darkSections.some(x => x !== sec && (b => b.top <= line && b.bottom > line)(x.getBoundingClientRect()));
      nav.classList.toggle('on-dark', overPlane || overOther);
      nav.classList.toggle('on-night', overPlane);
    }
  }
  function loop(now) {
    frame(now);
    if (near || tw) requestAnimationFrame(loop); else looping = false;
  }
  const wake = () => { if (!looping) { looping = true; last = 0; requestAnimationFrame(loop); } };
  // Hors de l'écran : plus aucun rendu.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => es.forEach(x => { near = x.isIntersecting; if (near) { if (!sky) sky = makeSky(far, zoomNow); wake(); } }), { rootMargin: '25% 0px' }).observe(sec);
  } else { near = true; sky = makeSky(far, zoomNow); wake(); }
  // La barre du haut doit aussi changer au-dessus de la conclusion sombre, même loin de la scène.
  addEventListener('scroll', () => { if (!near && nav) { const line = nav.offsetHeight / 2; nav.classList.toggle('on-dark', darkSections.some(x => (b => b.top <= line && b.bottom > line)(x.getBoundingClientRect()))); nav.classList.remove('on-night'); } }, { passive: true });
  addEventListener('resize', () => { measure(); wake(); });
  measure();
  frame(performance.now());

  function zoomNow() { return 1 + ((G.S || 1) - 1) * ease(a); }
  const approach = (to, dur) => new Promise(done => {
    if (RM || dur === 0) { a = to; frame(performance.now()); sky?.fit(); done(); return; }
    // À la fin du rapprochement, on fait redessiner la cabine à sa nouvelle taille pour qu'elle reste nette.
    tw = { from: a, to, start: performance.now(), dur, done: () => { cabin.style.willChange = 'auto'; requestAnimationFrame(() => { cabin.style.willChange = ''; }); sky?.fit(); done(); } };
    wake();
  });

  // ---------- La déchirure (reprise de tearAnimation) : deux copies du ticket découpées le long de la même ligne ----------
  async function tear(id) {
    const b = pass();
    const alive = () => id === run;
    if (RM || !has3d || !b) { box.classList.add('is-gone'); return; }
    const u = G.W / 1000;
    const wrap = el('div', 'lk-piece-wrap');
    wrap.style.left = b.offsetLeft + 'px';
    wrap.style.top = b.offsetTop + 'px';
    wrap.style.transform = b.style.transform;
    wrap.style.transformOrigin = getComputedStyle(b).transformOrigin;
    const jag = [];
    for (let y = 0; y <= 100; y += 4) jag.push(`${72 + (y % 8 ? 0.7 : -0.7) * (0.5 + Math.random())}% ${y}%`);
    const piece = polygon => {
      const p = el('div', 'lk-piece');
      const paper = boardingPass(ticketFor(minutes));
      paper.style.clipPath = `polygon(${polygon})`;
      p.append(paper);
      return p;
    };
    const main = piece(['0 0', ...jag, '0 100%'].join(','));
    const stub = piece(['100% 0', ...jag, '100% 100%'].join(','));
    main.style.transformOrigin = stub.style.transformOrigin = '72% 50%';
    wrap.append(main, stub);
    box.style.position = 'relative';
    box.append(wrap);
    b.style.visibility = 'hidden';
    const play = (node, frames, options) => node.animate(frames, { fill: 'forwards', ...options }).finished.catch(() => {});
    // Le papier se tend, résiste et vibre avant de céder.
    await Promise.all([
      play(main, [{ transform: 'none' }, { transform: 'translateX(-2px) rotateZ(-.5deg)' }, { transform: 'translateX(-3px) rotateZ(.2deg)' }, { transform: 'translateX(-7px) rotateZ(-1.2deg) rotateY(-5deg)' }], { duration: 480, easing: 'ease-in' }),
      play(stub, [{ transform: 'none' }, { transform: 'translateX(2px) rotateZ(.6deg)' }, { transform: 'translateX(3px) rotateZ(-.2deg)' }, { transform: 'translateX(9px) rotateZ(1.6deg) rotateY(7deg)' }], { duration: 480, easing: 'ease-in' }),
    ]);
    if (!alive()) return;
    const rect = wrap.getBoundingClientRect();
    const shards = Array.from({ length: G.m ? 10 : 18 }, () => {
      const s = el('i', 'lk-shard');
      s.style.left = '72%';
      s.style.top = `${Math.random() * 100}%`;
      wrap.append(s);
      const dx = (Math.random() - .5) * rect.width * .7, dy = G.H * (.12 + Math.random() * .4), dz = (Math.random() - .3) * 500 * u;
      return play(s, [
        { transform: 'none', opacity: 1 },
        { transform: `translate3d(${dx}px,${dy}px,${dz}px) rotate3d(${Math.random()},${Math.random()},${Math.random()},${200 + Math.random() * 400}deg)`, opacity: 0 },
      ], { duration: 800 + Math.random() * 500, easing: 'cubic-bezier(.3,.1,.7,1)' });
    });
    // Le talon tombe, le billet file vers toi.
    await Promise.all([
      play(stub, [{ transform: 'translateX(9px) rotateZ(1.6deg) rotateY(7deg)', opacity: 1 }, { transform: `translate3d(${170 * u}px,${G.H * .6}px,${-320 * u}px) rotateX(-75deg) rotateY(48deg) rotateZ(32deg)`, opacity: 0 }], { duration: 1150, easing: 'cubic-bezier(.45,.05,.8,.5)' }),
      play(main, [{ transform: 'translateX(-7px) rotateZ(-1.2deg) rotateY(-5deg)', opacity: 1 }, { opacity: 1, offset: .55 }, { transform: `translate3d(${-50 * u}px,${-G.H * .25}px,${700 * u}px) rotateX(-24deg) rotateY(10deg)`, opacity: 0 }], { duration: 1150, easing: 'cubic-bezier(.5,0,.8,.4)' }),
      ...shards,
    ]);
    wrap.remove();
    box.classList.add('is-gone');
  }

  // ---------- Le vol de démonstration : le compte à rebours tourne, rien n'est enregistré ----------
  function startClock() {
    const t = ticketFor(minutes);
    endAt = Date.now() + minutes * 60000;
    routeEl.textContent = `Paris → ${t.route.city}`;
    etaEl.textContent = `Arrivée prévue à ${new Date(endAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    const tick = () => { const left = endAt - Date.now(); clock.textContent = clockLabel(Math.max(0, left)); if (left <= 0) clearInterval(timer); };
    tick();
    clearInterval(timer);
    timer = setInterval(tick, 250);
  }

  const setDurations = enabled => $$('button', durs).forEach(b => { b.disabled = !enabled; });
  function backToSeat() {
    clearInterval(timer);
    state = 'seat';
    sec.classList.remove('is-flying');
    hud.hidden = true;
    deck.hidden = true;
    box.classList.remove('is-gone');
    box.querySelector('.lk-piece-wrap')?.remove();
    renderTicket();
    copy.classList.remove('is-away');
  }
  async function takeOff(fromReplay) {
    const id = ++run;
    go.setAttribute('aria-disabled', 'true');
    setDurations(false);
    note.textContent = 'Décollage…';
    if (fromReplay) {
      hud.classList.add('is-off');
      await approach(0, 900);
      if (id !== run) return;
      backToSeat();
      await new Promise(r => setTimeout(r, RM ? 0 : 400));
      if (id !== run) return;
    }
    state = 'tearing';
    await tear(id);
    if (id !== run) return;
    state = 'flight';
    sec.classList.add('is-flying');
    copy.classList.add('is-away');
    startClock();
    hud.hidden = false;
    hud.classList.add('is-off');
    deck.hidden = false;
    // On se lève à moitié de son siège et on s'approche de la vitre ; l'heure apparaît quand on y est.
    const closer = approach(1, 1900);
    setTimeout(() => { if (id === run) hud.classList.remove('is-off'); }, RM ? 0 : 1300);
    if (RM) hud.classList.remove('is-off');
    await closer;
    if (id !== run) return;
    const hadFocus = [go, replay].includes(document.activeElement) || document.activeElement === document.body;
    go.hidden = true;
    go.removeAttribute('aria-disabled');
    replay.hidden = false;
    quit.hidden = false;
    if (hadFocus) quit.focus({ preventScroll: true });
    const t = ticketFor(minutes);
    note.textContent = `Démonstration : vol vers ${t.route.city}, ${durationLabel(minutes)}. Continue de défiler, le point de vue évolue. Rien n'est enregistré.`;
  }
  go.addEventListener('click', () => { if (state === 'seat' && !go.hasAttribute('aria-disabled')) takeOff(false); });
  replay.addEventListener('click', () => { if (state === 'flight') takeOff(true); });
  quit.addEventListener('click', async () => {
    const id = ++run;
    hud.classList.add('is-off');
    replay.hidden = true;
    quit.hidden = true;
    go.hidden = false;
    go.removeAttribute('aria-disabled');
    go.focus({ preventScroll: true });
    note.textContent = NOTE;
    backToSeat();
    setDurations(true);
    await approach(0, 1100);
    if (id !== run) return;
  });
  $$('button', durs).forEach(b => b.addEventListener('click', () => {
    if (state !== 'seat' || b.disabled) return;
    minutes = Number(b.dataset.min);
    $$('button', durs).forEach(x => x.setAttribute('aria-pressed', x === b));
    renderTicket();
    if (!RM && has3d) pass().animate([{ transform: `${pass().style.transform} rotateX(-70deg)`, opacity: 0 }, { transform: pass().style.transform, opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,.8,.3,1)' });
  }));
})();
