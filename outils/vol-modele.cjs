// Rebuild the cabin in metres from the cruise reference, including its passenger camera.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('../prototype/node_modules/sharp');
const dir = path.join(__dirname, '../site/assets/vol');
const width = 900,
  height = 506.25,
  focal = 780;
const doc = {
  asset: { version: '2.0', generator: 'Renzvi' },
  scene: 0,
  scenes: [{ nodes: [] }],
  nodes: [],
  meshes: [],
  materials: [],
  textures: [],
  images: [],
  buffers: [],
  bufferViews: [],
  accessors: []
};
const chunks = [];
let offset = 0;
function view(data, target) {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const pad = (4 - (bytes.length % 4)) % 4;
  const id = doc.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target }) - 1;
  chunks.push(bytes, Buffer.alloc(pad));
  offset += bytes.length + pad;
  return id;
}
function accessor(data, type, size, bounds = {}) {
  const arr = type === 'SCALAR' ? new Uint16Array(data) : new Float32Array(data);
  return (
    doc.accessors.push({
      bufferView: view(arr, type === 'SCALAR' ? 34963 : 34962),
      componentType: type === 'SCALAR' ? 5123 : 5126,
      count: data.length / size,
      type,
      ...bounds
    }) - 1
  );
}
function mesh(name, rings, material, capEnds = false) {
  const vertices = rings.flat(),
    positions = [],
    indices = [];
  for (let row = 1; row < rings.length; row++) {
    const n = rings[row].length;
    for (let i = 0; i < n; i++) {
      const a = (row - 1) * n + i,
        b = (row - 1) * n + ((i + 1) % n);
      indices.push(a, b, b + n, a, b + n, a + n);
    }
  }
  if (capEnds) {
    for (const row of [0, rings.length - 1]) {
      const ring = rings[row],
        first = row * ring.length;
      const center = ring[0].map((_, k) => ring.reduce((sum, v) => sum + v[k], 0) / ring.length);
      const end = vertices.push(center) - 1;
      for (let i = 0; i < ring.length; i++) {
        const a = first + i,
          b = first + ((i + 1) % ring.length);
        indices.push(end, row === 0 ? b : a, row === 0 ? a : b);
      }
    }
  }
  const normals = vertices.map(() => [0, 0, 0]);
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3),
      p = vertices[a],
      q = vertices[b],
      r = vertices[c];
    const u = q.slice(0, 3).map((v, k) => v - p[k]),
      v = r.slice(0, 3).map((s, k) => s - p[k]);
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const j of [a, b, c])
      cross.forEach((x, k) => {
        normals[j][k] += x;
      });
  }
  for (const v of vertices) positions.push(...v.slice(0, 3));
  const axes = [0, 1, 2].map((k) => vertices.map((v) => v[k]));
  const attributes = {
    POSITION: accessor(positions, 'VEC3', 3, {
      min: axes.map((a) => Math.min(...a)),
      max: axes.map((a) => Math.max(...a))
    }),
    NORMAL: accessor(
      normals.flatMap((n) => n.map((x) => x / (Math.hypot(...n) || 1))),
      'VEC3',
      3
    ),
    TEXCOORD_0: accessor(
      vertices.flatMap((v) => v.slice(3)),
      'VEC2',
      2
    )
  };
  const id =
    doc.meshes.push({ name, primitives: [{ attributes, indices: accessor(indices, 'SCALAR', 1), material }] }) -
    1;
  doc.scenes[0].nodes.push(doc.nodes.push({ name, mesh: id }) - 1);
}
function point(x, y, d, wing = false) {
  return [
    ((x - width / 2) * d) / focal,
    ((height / 2 - y) * d) / focal,
    -d,
    wing ? ((x * 1672) / width - 682) / 565 : x / width,
    wing ? ((y * 941) / height - 90) / 721 : y / height
  ];
}
function cabin() {
  // Cubic sections follow the inner lip of the moulding, including the flat upper shade.
  const contour = [],
    curves = [
      [464, 53, 418, 57, 377, 104, 375, 158],
      [375, 158, 373, 194, 376, 287, 377, 313],
      [377, 313, 379, 382, 417, 425, 480, 426],
      [480, 426, 506, 428, 535, 427, 560, 426],
      [560, 426, 620, 425, 660, 381, 664, 310],
      [664, 310, 667, 266, 667, 207, 665, 165],
      [665, 165, 663, 110, 635, 68, 586, 53],
      [586, 53, 545, 54, 504, 55, 464, 53]
    ];
  for (const p of curves)
    for (let i = 0; i < 10; i++) {
      const t = i / 10,
        a = 1 - t;
      contour.push(
        [0, 1].map(
          (k) => a * a * a * p[k] + 3 * a * a * t * p[k + 2] + 3 * a * t * t * p[k + 4] + t * t * t * p[k + 6]
        )
      );
    }
  const cx = 520,
    cy = 240;
  const rings = [
    [1, 0.83],
    [1.015, 0.824],
    [1.045, 0.804],
    [1.09, 0.773],
    [1.14, 0.752],
    [1.18, 0.754],
    [1.205, 0.766],
    [1.26, 0.776],
    [1.39, 0.742],
    [1.51, 0.718]
  ].map(([scale, d]) => contour.map(([x, y]) => point(cx + (x - cx) * scale, cy + (y - cy) * scale, d)));
  // Extend the wall past the camera edges so head movement never exposes its boundary.
  rings.push(
    contour.map(([x, y]) => {
      const dx = x - cx,
        dy = y - cy,
        t = Math.min((dx < 0 ? -70 - cx : 970 - cx) / dx, (dy < 0 ? -70 - cy : 580 - cy) / dy);
      return point(cx + dx * t, cy + dy * t, 0.7 - (0.06 * Math.abs(dy * t)) / 320);
    })
  );
  mesh('Paroi et cadre moulé', rings, 0);
}
function wing() {
  // Span stations from the root to the upturned winglet; each is a closed airfoil.
  const stations = [
    [806, 382, 721, 506, 3.8, 6],
    [678, 345, 614, 412, 5.5, 4],
    [581, 321, 554, 349, 8.3, 2.2],
    [538, 314, 516, 318, 13, 0.8],
    [508, 276, 498, 273, 16.4, 0.35],
    [502, 274, 498, 273, 16.6, 0.1]
  ];
  const rings = stations.map(([ax, ay, bx, by, d, h]) =>
    Array.from({ length: 32 }, (_, i) => {
      const theta = (2 * Math.PI * i) / 32,
        chord = (1 - Math.cos(theta)) * 0.5;
      return point(
        ax + (bx - ax) * chord,
        ay + (by - ay) * chord - Math.sin(theta) * h * (1 - 0.45 * chord),
        d + 0.11 * chord,
        true
      );
    })
  );
  mesh('Aile et winglet', rings, 1, true);
  const fairing = [
    [583, 365, 7.1, 6, 4],
    [564, 369, 7.4, 7, 5],
    [537, 370, 7.9, 5, 3],
    [531, 369, 8.1, 0.3, 0.3]
  ];
  mesh(
    'Carénage du volet',
    fairing.map(([x, y, d, w, h]) =>
      Array.from({ length: 16 }, (_, i) => {
        const a = (i * Math.PI) / 8;
        return point(x + Math.cos(a) * w, y + Math.sin(a) * h, d + Math.cos(a) * 0.1, true);
      })
    ),
    1,
    true
  );
}
(async () => {
  for (const [file, name, back, roughness] of [
    ['cabine', 'Paroi mate', '#24201d', 0.88],
    ['aile', 'Aluminium peint', '#8a8589', 0.42]
  ]) {
    const image = await sharp(path.join(dir, file + '.webp'))
      .flatten({ background: back })
      .jpeg({ quality: 92 })
      .toBuffer();
    const index = doc.images.push({ bufferView: view(image), mimeType: 'image/jpeg' }) - 1;
    doc.textures.push({ source: index, sampler: 0 });
    doc.materials.push({
      name,
      doubleSided: true,
      pbrMetallicRoughness: {
        baseColorTexture: { index },
        metallicFactor: index * 0.44,
        roughnessFactor: roughness
      }
    });
  }
  doc.samplers = [{ wrapS: 33071, wrapT: 33071, magFilter: 9729, minFilter: 9987 }];
  cabin();
  wing();
  doc.cameras = [
    {
      type: 'perspective',
      perspective: {
        aspectRatio: width / height,
        yfov: 2 * Math.atan(height / (2 * focal)),
        znear: 0.05,
        zfar: 60
      }
    }
  ];
  doc.scenes[0].nodes.push(doc.nodes.push({ name: 'Vue passager', camera: 0 }) - 1);
  doc.buffers.push({ byteLength: offset });
  const json = Buffer.from(JSON.stringify(doc)),
    pad = (4 - (json.length % 4)) % 4,
    bin = Buffer.concat(chunks);
  const header = Buffer.alloc(20),
    bh = Buffer.alloc(8);
  header.write('glTF');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + pad + bin.length, 8);
  header.writeUInt32LE(json.length + pad, 12);
  header.write('JSON', 16);
  bh.writeUInt32LE(bin.length);
  bh.write('BIN\0', 4);
  await fs.writeFile(
    path.join(dir, 'cabine.glb'),
    Buffer.concat([header, json, Buffer.alloc(pad, 32), bh, bin])
  );
  const alpha = await sharp(path.join(dir, 'cabine.webp'))
    .extract({ left: 682, top: 90, width: 565, height: 721 })
    .extractChannel('alpha')
    .negate()
    .raw()
    .toBuffer();
  await sharp({ create: { width: 565, height: 721, channels: 3, background: '#fff' } })
    .joinChannel(alpha, { raw: { width: 565, height: 721, channels: 1 } })
    .webp({ lossless: true })
    .toFile(path.join(dir, 'vitre.webp'));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
