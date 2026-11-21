// This renderer reads the single seat model built by outils/vol-modele.cjs.
const modelVertex = `#version 300 es
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
layout(location=2) in vec2 uv;
uniform vec2 lens, eye;
uniform float seconds, metal;
out vec3 projectedUV;
out vec3 surface, towardEye;
void main() {
  vec3 p = position;
  float span = smoothstep(3.8, 16.6, -p.z);
  p.y += metal * span * span * (.050*sin(seconds*.70)+.022*sin(seconds*1.43));
  p.xy -= eye;
  gl_Position = vec4(p.xy*lens, -1.002*p.z-.1001, -p.z);
  projectedUV=vec3(uv,1.)*(-position.z); surface=normal; towardEye=-p;
}`;
const modelFragment = `#version 300 es
precision highp float;
uniform sampler2D albedo;
uniform float warmth, dusk, metal;
in vec3 projectedUV;
in vec3 surface, towardEye;
out vec4 color;
void main() {
  vec3 ink=texture(albedo,projectedUV.xy/projectedUV.z).rgb;
  vec3 normal=faceforward(normalize(surface),-normalize(towardEye),normalize(surface));
  vec3 light=normalize(vec3(-.78,.31,.52));
  float diffuse=max(0.,dot(normal,light));
  float wing=step(.1,metal);
  // The rim catches cabin light even after the metal wing loses the sun.
  vec3 daylight=mix(vec3(.71,.81,.98),vec3(1.03,.97,.89),warmth);
  vec3 rim=mix(vec3(.97,.84,.73),vec3(1.02,.98,.93),warmth);
  vec3 tint=mix(rim,daylight,wing);
  float luminance=dot(ink,vec3(.22,.69,.09));
  ink=mix(vec3(luminance),ink,.51+.49*warmth);
  float exposure=mix(.79+.21*warmth-.16*dusk,.73+.27*warmth-.37*dusk,wing);
  vec3 highlight=mix(vec3(.38,.32,.28),vec3(.99,.65,.36),warmth);
  float gloss=pow(max(0.,dot(normal,normalize(light+normalize(towardEye)))),24.);
  color=vec4(ink*tint*(.92+.12*diffuse)*exposure+highlight*gloss*(.015+.10*metal),1.);
}`;
const quadVertex = `#version 300 es
out vec2 uv;
void main() {
  vec2 corner=vec2((gl_VertexID<<1)&2,gl_VertexID&2);
  uv=corner;
  gl_Position=vec4(corner*2.-1.,0.,1.);
}`;
const cloudFragment = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 uv;
uniform sampler3D field;
uniform float seconds;
out vec4 color;
float noise3(vec3 p) { return texture(field,p/64.).r; }
float density(vec3 p) {
  vec3 q=p*vec3(.52,.79,.52);
  float structure=.56*noise3(q)+.27*noise3(q*2.04+7.3)+.12*noise3(q*4.17-11.)+.05*noise3(q*8.31);
  return smoothstep(.40,.65,structure-(p.y-.4)*.14) * smoothstep(-1.9,-.7,p.y);
}
float shadowMass(vec3 p) {
  vec3 q=p*vec3(.52,.79,.52);
  float body=.68*noise3(q)+.32*noise3(q*2.04+7.3);
  return smoothstep(.40,.65,body-(p.y-.4)*.14);
}
void main() {
  vec2 pane=vec2(uv.x,1.-uv.y);
  float down=(pane.y-.45)*.91;
  vec3 ray=normalize(vec3((pane.x-.50)*.69,-down,-1.));
  float start=1.1/max(.001,-ray.y), stop=min(54.,5.9/max(.001,-ray.y));
  if (down<=0. || start>=stop) { color=vec4(0.); return; }
  float stepLength=(stop-start)/32.;
  vec3 origin=vec3(seconds*.20,3.65,seconds*.047);
  vec3 sun=normalize(vec3(-.82,.53,-.20));
  vec3 scattered=vec3(0.);
  float transmission=1.;
  // Stagger adjacent rays so their sampling planes never form horizontal bands.
  float jitter=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
  for(int i=0;i<32;i++) {
    vec3 p=origin+ray*(start+(float(i)+jitter)*stepLength);
    float water=density(p);
    if(water>.012) {
      float opacity=1.-exp(-water*stepLength*1.9);
      float direct=exp(-2.4*shadowMass(p+.62*sun)-1.1*shadowMass(p+1.53*sun));
      vec3 light=mix(vec3(.30,.29,.41),vec3(1.,.72,.52),direct);
      light *= .86+.14*smoothstep(-1.,1.8,p.y);
      scattered+=transmission*opacity*light;
      transmission*=1.-opacity;
      if(transmission<.025) break;
    }
  }
  float depthMix=.26*smoothstep(.045,.27,down);
  color=vec4(scattered*depthMix,(1.-transmission)*depthMix);
}`;
const displayFragment = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D clouds, horizon, runway, coast;
uniform float seconds, climb, dusk, lift, descent;
out vec4 color;
void main() {
  vec2 pane=vec2(uv.x,1.-uv.y);
  // A passing bank of haze reveals the next landscape without exposing two horizons.
  float front=.25+.50*pane.y+.06*sin(pane.x*5.+pane.y*3.);
  vec3 view;
  if(climb<front) {
    vec2 ground=(pane-.5)*mix(.78,.96,lift)+.5;
    ground.y-=.14*lift;
    // Integral of a gradual acceleration, in real seconds, keeps lights and reflections together.
    ground.x+=seconds*(.012+.031*lift);
    view=texture(runway,ground).rgb;
  } else if(dusk<front) {
    float depth=smoothstep(.43,.94,pane.y);
    vec2 drift=vec2((.012+.065*depth)*sin(seconds*.019),0.);
    vec3 farDeck=texture(horizon,pane+drift).rgb;
    vec4 vapor=texture(clouds,uv);
    view=vapor.rgb+(1.-vapor.a)*farDeck;
  } else {
    vec2 ground=(pane-.5)/mix(1.02,1.30,descent)+.5;
    ground.x+=.045*sin(seconds*.012);
    view=texture(coast,clamp(ground,0.,1.)).rgb*vec3(.82,.88,.96);
    view=mix(vec3(.16,.21,.30),view,.78+.22*descent);
  }
  float mist=1.-smoothstep(.0,.22,min(abs(climb-front),abs(dusk-front)));
  vec3 haze=mix(vec3(.57,.60,.67),vec3(.29,.34,.44),dusk);
  color=vec4(mix(view,haze*(1.06-.14*pane.y),mist),1.);
}`;

function program(gl, vertex, fragment, uniforms) {
  const id = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment]
  ]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(id, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(id);
  if (!gl.getProgramParameter(id, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(id));
  return { id, ...Object.fromEntries(uniforms.map((name) => [name, gl.getUniformLocation(id, name)])) };
}

function texture2D(gl, image, repeat = false) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);
  return texture;
}

async function loadModel(gl, signal) {
  const response = await fetch(new URL('../assets/vol/cabine.glb', import.meta.url), { signal });
  if (!response.ok) throw Error('Modèle de cabine indisponible');
  const data = await response.arrayBuffer(),
    header = new DataView(data);
  const length = header.getUint32(12, true);
  const model = JSON.parse(new TextDecoder().decode(new Uint8Array(data, 20, length)));
  function bytes(index) {
    const view = model.bufferViews[index];
    return new Uint8Array(data, 28 + length + (view.byteOffset || 0), view.byteLength);
  }
  const textures = await Promise.all(
    model.images.map(async (image) => {
      const bitmap = await createImageBitmap(new Blob([bytes(image.bufferView)], { type: image.mimeType }));
      try {
        signal.throwIfAborted();
        return texture2D(gl, bitmap);
      } finally {
        bitmap.close();
      }
    })
  );
  function bind(accessor, target) {
    const item = model.accessors[accessor];
    gl.bindBuffer(target, gl.createBuffer());
    gl.bufferData(target, bytes(item.bufferView), gl.STATIC_DRAW);
    return item;
  }
  const parts = model.meshes.map((mesh) => {
    const part = mesh.primitives[0],
      vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    for (const [i, key] of ['POSITION', 'NORMAL', 'TEXCOORD_0'].entries()) {
      const a = bind(part.attributes[key], gl.ARRAY_BUFFER);
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, key === 'TEXCOORD_0' ? 2 : 3, a.componentType, false, 0, 0);
    }
    const indices = bind(part.indices, gl.ELEMENT_ARRAY_BUFFER);
    const material = model.materials[part.material].pbrMetallicRoughness;
    return { vao, indices, texture: textures[material.baseColorTexture.index], metal: material.metallicFactor };
  });
  gl.bindVertexArray(null);
  return { parts, camera: model.cameras[0].perspective };
}
function cloudTarget(gl, width, height) {
  const texture = gl.createTexture(),
    buffer = gl.createFramebuffer();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
    throw Error('Tampon de nuages indisponible');
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { texture, buffer, width, height };
}
function noiseVolume(gl) {
  const data = new Uint8Array(64 ** 3);
  let seed = 73517;
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i] = seed >>> 24;
  }
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, texture);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, 64, 64, 64, 0, gl.RED, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}

export function fly3D(scene, viewAt, flightSignal) {
  if (flightSignal.aborted) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let engine;
  function select() {
    engine?.abort();
    if (motion.matches || flightSignal.aborted) return;
    engine = new AbortController();
    const current = engine;
    renderSeat(scene, viewAt, current).catch(() => current.abort());
  }
  motion.addEventListener('change', select, { signal: flightSignal });
  flightSignal.addEventListener('abort', () => engine?.abort(), { once: true });
  select();
}

async function renderSeat(scene, viewAt, controller) {
  const { signal } = controller,
    stage = scene.querySelector('.hublot-well');
  const cockpit = document.getElementById('flight-run');
  const canvas = document.createElement('canvas');
  canvas.className = 'flight-model';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    premultipliedAlpha: false,
    antialias: true,
    powerPreference: 'low-power'
  });
  if (!gl) return;
  let frame = 0,
    last = -Infinity;
  signal.addEventListener(
    'abort',
    () => {
      cancelAnimationFrame(frame);
      delete scene.dataset.model;
      canvas.remove();
      if (!gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
    { once: true }
  );
  canvas.addEventListener('webglcontextlost', () => controller.abort(), { once: true, signal });
  const model = await loadModel(gl, signal);
  const outside = await Promise.all(['nuages', 'piste', 'cote'].map(async name => {
    const response = await fetch(new URL('../assets/vol/' + name + '.webp', import.meta.url), { signal });
    if (!response.ok) throw Error('Paysage indisponible');
    const bitmap = await createImageBitmap(await response.blob());
    try {
      signal.throwIfAborted();
      return texture2D(gl, bitmap, true);
    } finally {
      bitmap.close();
    }
  }));

  const shell = program(gl, modelVertex, modelFragment, [
    'lens',
    'eye',
    'seconds',
    'metal',
    'albedo',
    'warmth',
    'dusk'
  ]);
  const mist = program(gl, quadVertex, cloudFragment, ['field', 'seconds']);
  const display = program(gl, quadVertex, displayFragment, ['clouds', 'horizon', 'runway', 'coast', 'seconds', 'climb', 'dusk', 'lift', 'descent']);
  const mobile = matchMedia('(pointer:coarse)').matches;
  let cloud = cloudTarget(gl, mobile ? 128 : 168, mobile ? 164 : 214);
  const noise = noiseVolume(gl);
  gl.useProgram(display.id);
  gl.uniform1i(display.clouds, 0);
  for (const [i, name] of ['horizon', 'runway', 'coast'].entries()) {
    gl.activeTexture(gl.TEXTURE1 + i);
    gl.bindTexture(gl.TEXTURE_2D, outside[i]);
    gl.uniform1i(display[name], i + 1);
  }
  gl.activeTexture(gl.TEXTURE0);
  const lensY = 1 / Math.tan(model.camera.yfov / 2);
  let targetX = 0,
    targetY = 0,
    eyeX = 0,
    eyeY = 0;
  scene.parentElement.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      targetX = (e.clientX / innerWidth - 0.5) * 0.006;
      targetY = (0.5 - e.clientY / innerHeight) * 0.004;
    },
    { signal }
  );
  let quality = 1,
    slowFrames = 0;
  const fit = () => {
    const scale = quality * Math.min(devicePixelRatio, 1.5, 1920 / stage.clientWidth);
    canvas.width = Math.max(1, Math.round(stage.clientWidth * scale));
    canvas.height = Math.max(1, Math.round(stage.clientHeight * scale));
  };
  const size = new ResizeObserver(fit);
  size.observe(stage);
  signal.addEventListener('abort', () => size.disconnect(), { once: true });
  stage.insertBefore(canvas, stage.querySelector('.hublot-frame'));
  fit();
  let submitted, lastCloud = -Infinity;
  function draw(now) {
    frame = 0;
    if (signal.aborted || document.hidden || cockpit.hidden) return;
    frame = requestAnimationFrame(draw);
    if (now - last < 1000 / 25) return;
    // Do not queue another volume pass while the previous frame is still on the GPU.
    if (submitted) {
      if (gl.clientWaitSync(submitted, 0, 0) === gl.TIMEOUT_EXPIRED) return;
      gl.deleteSync(submitted);
      submitted = null;
    }
    const gap = now - last;
    slowFrames = gap > 130 ? slowFrames + 1 : 0;
    if (quality === 1 && slowFrames >= 8) {
      quality = 0.72;
      fit();
      gl.deleteTexture(cloud.texture);
      gl.deleteFramebuffer(cloud.buffer);
      try {
        cloud = cloudTarget(gl, Math.round(cloud.width * quality), Math.round(cloud.height * quality));
      } catch {
        controller.abort();
        return;
      }
      lastCloud = -Infinity;
    }
    last = now;
    const { seconds, climb, dusk, lift, descent, warmth } = viewAt(Date.now());
    const w = canvas.width,
      h = canvas.height;
    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);
    gl.activeTexture(gl.TEXTURE0);
    if (warmth > 0 && now - lastCloud >= 1000 / 15) {
      lastCloud = now;
      gl.bindFramebuffer(gl.FRAMEBUFFER, cloud.buffer);
      gl.viewport(0, 0, cloud.width, cloud.height);
      gl.useProgram(mist.id);
      gl.bindTexture(gl.TEXTURE_3D, noise);
      gl.uniform1i(mist.field, 0);
      gl.uniform1f(mist.seconds, seconds);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(
      Math.round((w * 682) / 1672),
      Math.round((h * 130) / 941),
      Math.ceil((w * 565) / 1672),
      Math.ceil((h * 721) / 941)
    );
    gl.useProgram(display.id);
    gl.bindTexture(gl.TEXTURE_2D, cloud.texture);
    gl.uniform1f(display.seconds, seconds);
    gl.uniform1f(display.climb, climb);
    gl.uniform1f(display.dusk, dusk);
    gl.uniform1f(display.lift, lift);
    gl.uniform1f(display.descent, descent);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.viewport(0, 0, w, h);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(shell.id);
    gl.uniform2f(shell.lens, lensY / model.camera.aspectRatio, lensY);
    eyeX += (targetX - eyeX) * 0.09;
    eyeY += (targetY - eyeY) * 0.09;
    gl.uniform2f(shell.eye, eyeX, eyeY);
    gl.uniform1f(shell.seconds, seconds);
    gl.uniform1f(shell.warmth, warmth);
    gl.uniform1f(shell.dusk, dusk);
    gl.uniform1i(shell.albedo, 0);
    for (const part of model.parts) {
      gl.uniform1f(shell.metal, part.metal);
      gl.bindTexture(gl.TEXTURE_2D, part.texture);
      gl.bindVertexArray(part.vao);
      gl.drawElements(gl.TRIANGLES, part.indices.count, part.indices.componentType, 0);
    }
    submitted = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    if (!scene.dataset.model) scene.dataset.model = '3d';
  }
  document.addEventListener(
    'visibilitychange',
    () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) {
        last = -Infinity;
        frame = requestAnimationFrame(draw);
      }
    },
    { signal }
  );
  draw(performance.now());
}
