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
uniform float warmth, metal;
in vec3 projectedUV;
in vec3 surface, towardEye;
out vec4 color;
void main() {
  vec3 ink=texture(albedo,projectedUV.xy/projectedUV.z).rgb;
  vec3 normal=faceforward(normalize(surface),-normalize(towardEye),normalize(surface));
  vec3 light=normalize(vec3(-.78,.31,.52));
  float diffuse=max(0.,dot(normal,light));
  vec3 tint=mix(vec3(.69,.76,.86),vec3(1.00,.98,.96),warmth);
  float grey=dot(ink,vec3(.22,.69,.09));
  ink=mix(vec3(grey),ink,.33+.67*warmth);
  vec3 highlight=mix(vec3(.16,.23,.33),vec3(.90,.53,.28),warmth);
  float gloss=pow(max(0.,dot(normal,normalize(light+normalize(towardEye)))),24.);
  color=vec4(ink*tint*(.92+.12*diffuse)+highlight*gloss*(.015+.12*metal),1.);
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
  for(int i=0;i<32;i++) {
    vec3 p=origin+ray*(start+(float(i)+.5)*stepLength);
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
  float depthMix=.45*smoothstep(.015,.19,down);
  color=vec4(scattered*depthMix,(1.-transmission)*depthMix);
}`;
const displayFragment = `#version 300 es
precision mediump float;
in vec2 uv;
uniform sampler2D clouds, horizon;
uniform highp float seconds;
uniform float opacity;
out vec4 color;
void main() {
  highp vec2 pane=vec2(uv.x,1.-uv.y);
  vec3 sky=texture(horizon,pane).rgb;
  vec3 farDeck=texture(horizon,pane+vec2(seconds*.0025,0.)).rgb;
  vec3 nearDeck=texture(horizon,pane+vec2(seconds*.013,0.)).rgb;
  vec3 distanceColor=mix(sky,farDeck,smoothstep(.43,.50,pane.y));
  distanceColor=mix(distanceColor,nearDeck,smoothstep(.61,.80,pane.y));
  vec4 vapor=texture(clouds,uv);
  color=vec4(vapor.rgb+(1.-vapor.a)*distanceColor,opacity);
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

export function fly3D(scene, startAt, flightSignal) {
  if (flightSignal.aborted) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let engine;
  function select() {
    engine?.abort();
    if (motion.matches || flightSignal.aborted) return;
    engine = new AbortController();
    const current = engine;
    renderSeat(scene, startAt, current).catch(() => current.abort());
  }
  motion.addEventListener('change', select, { signal: flightSignal });
  flightSignal.addEventListener('abort', () => engine?.abort(), { once: true });
  select();
}

async function renderSeat(scene, startAt, controller) {
  const { signal } = controller,
    stage = scene.querySelector('.hublot-well');
  const cockpit = document.getElementById('flight-run');
  const canvas = document.createElement('canvas');
  canvas.className = 'flight-model';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', {
    alpha: true,
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
  const response = await fetch(new URL('../assets/vol/nuages.webp', import.meta.url), { signal });
  if (!response.ok) throw Error('Horizon indisponible');
  const image = await createImageBitmap(await response.blob());
  let horizon;
  try {
    signal.throwIfAborted();
    horizon = texture2D(gl, image, true);
  } finally {
    image.close();
  }

  const shell = program(gl, modelVertex, modelFragment, [
    'lens',
    'eye',
    'seconds',
    'metal',
    'albedo',
    'warmth'
  ]);
  const mist = program(gl, quadVertex, cloudFragment, ['field', 'seconds']);
  const display = program(gl, quadVertex, displayFragment, ['clouds', 'horizon', 'seconds', 'opacity']);
  const mobile = matchMedia('(pointer:coarse)').matches;
  let cloud = cloudTarget(gl, mobile ? 128 : 168, mobile ? 164 : 214);
  const noise = noiseVolume(gl);
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
    const seconds = Math.max(0, (Date.now() - startAt) / 1000);
    const cruise =
      Number(scene.style.getPropertyValue('--cruise')) *
      (1 - Number(scene.style.getPropertyValue('--approach')));
    const w = canvas.width,
      h = canvas.height;
    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);
    gl.activeTexture(gl.TEXTURE0);
    if (cruise > 0 && now - lastCloud >= 1000 / 15) {
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
    if (cruise > 0) {
      gl.viewport(
        Math.round((w * 682) / 1672),
        Math.round((h * 130) / 941),
        Math.ceil((w * 565) / 1672),
        Math.ceil((h * 721) / 941)
      );
      gl.useProgram(display.id);
      gl.bindTexture(gl.TEXTURE_2D, cloud.texture);
      gl.uniform1i(display.clouds, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, horizon);
      gl.uniform1i(display.horizon, 1);
      gl.uniform1f(display.seconds, seconds);
      gl.uniform1f(display.opacity, cruise);
      gl.activeTexture(gl.TEXTURE0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.viewport(0, 0, w, h);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(shell.id);
    gl.uniform2f(shell.lens, lensY / model.camera.aspectRatio, lensY);
    eyeX += (targetX - eyeX) * 0.09;
    eyeY += (targetY - eyeY) * 0.09;
    gl.uniform2f(shell.eye, eyeX, eyeY);
    gl.uniform1f(shell.seconds, seconds);
    gl.uniform1f(shell.warmth, cruise);
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
