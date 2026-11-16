// Polices personnelles (Personnaliser → Typographie → Mes polices) : lire, vérifier et charger un fichier de police.
// Le dashboard garde l'interface, le stockage et l'enregistrement ; ce fichier ne touche ni au réseau ni à l'écran.
(function () {
  const FORMATS = { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' };
  const MAX_BYTES = 3 * 1024 * 1024, MAX_FONTS = 10, MAX_NAME = 40;
  // Fallback système commun : l'écran reste lisible pendant le chargement ou si la police échoue.
  const SYSTEM = '-apple-system,BlinkMacSystemFont,"Hanken Grotesk",ui-sans-serif,system-ui,sans-serif';

  const tag = (v, o) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  const family = id => `rz-${id}`;
  const fail = text => Object.assign(new Error(text), { lisible: true });
  const size = bytes => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;

  // Le contenu décide du format, pas le nom : un .otf peut contenir du TrueType, un .ttf renommé n'est pas une police.
  function sniff(buffer) {
    if (buffer.byteLength < 12) return null;
    const sig = tag(new DataView(buffer), 0);
    return { wOF2: 'woff2', wOFF: 'woff', OTTO: 'otf', '\0\x01\0\0': 'ttf', true: 'ttf', ttcf: 'ttc' }[sig] ?? null;
  }

  // Tables utiles seulement (noms, graisse, italique, axes). WOFF2 est compressé en Brotli, que le navigateur ne sait pas
  // décompresser ici : ses détails restent inconnus et l'interface le dit au lieu de les inventer.
  const WANTED = ['name', 'OS/2', 'head', 'fvar'];
  async function tables(buffer, format) {
    const v = new DataView(buffer), out = {};
    if (format === 'ttf' || format === 'otf') {
      for (let i = 0, n = v.getUint16(4); i < n; i++) {
        const o = 12 + i * 16, t = tag(v, o);
        if (WANTED.includes(t)) out[t] = new DataView(buffer, v.getUint32(o + 8), v.getUint32(o + 12));
      }
    } else if (format === 'woff') {
      for (let i = 0, n = v.getUint16(12); i < n; i++) {
        const o = 44 + i * 20, t = tag(v, o);
        if (!WANTED.includes(t)) continue;
        const comp = v.getUint32(o + 8), orig = v.getUint32(o + 12);
        let bytes = new Uint8Array(buffer, v.getUint32(o + 4), comp);
        if (comp < orig) bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
        out[t] = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      }
    }
    return out;
  }

  function names(d) {
    const count = d.getUint16(2), base = d.getUint16(4), found = {};
    for (let i = 0; i < count; i++) {
      const o = 6 + i * 12, platform = d.getUint16(o), lang = d.getUint16(o + 4), id = d.getUint16(o + 6), len = d.getUint16(o + 8), off = d.getUint16(o + 10);
      if (![1, 2, 16, 17].includes(id)) continue;
      const score = platform === 3 ? (lang === 0x409 ? 3 : 2) : platform === 0 ? 2 : platform === 1 && lang === 0 ? 1 : 0;
      if (!score || (found[id]?.score ?? 0) >= score) continue;
      const bytes = new Uint8Array(d.buffer, d.byteOffset + base + off, len);
      const text = platform === 1 ? String.fromCharCode(...bytes) : new TextDecoder('utf-16be').decode(bytes);
      found[id] = { score, text: text.replace(/[\u0000-\u001f]/g, '').trim() };
    }
    return Object.fromEntries(Object.entries(found).map(([k, v]) => [k, v.text]));
  }

  async function readMeta(buffer, format) {
    const t = await tables(buffer, format);
    if (!t.name && !t['OS/2'] && !t.fvar) return null;
    const meta = { nom: '', poids: null, italique: null, variable: false, axes: [] };
    if (t.fvar) {
      const f = t.fvar, start = f.getUint16(4), count = f.getUint16(8), step = f.getUint16(10);
      for (let i = 0; i < count; i++) {
        const o = start + i * step;
        meta.axes.push({ tag: tag(f, o), min: f.getInt32(o + 4) / 65536, max: f.getInt32(o + 12) / 65536 });
      }
      meta.variable = meta.axes.length > 0;
    }
    const wght = meta.axes.find(a => a.tag === 'wght');
    if (wght) meta.poids = [Math.max(1, Math.round(wght.min)), Math.min(1000, Math.round(wght.max))];
    else if (t['OS/2']?.byteLength >= 6) {
      let w = t['OS/2'].getUint16(4);
      if (w > 0 && w < 10) w *= 100; // vieilles polices notées de 1 à 9
      if (w >= 1 && w <= 1000) meta.poids = [w, w];
    }
    if (t['OS/2']?.byteLength >= 64) meta.italique = (t['OS/2'].getUint16(62) & 1) === 1;
    else if (t.head?.byteLength >= 46) meta.italique = (t.head.getUint16(44) & 2) === 2;
    if (t.name) {
      const n = names(t.name), fam = n[16] || n[1] || '', sub = n[17] || n[2] || '';
      // « Inter Bold » et « Inter » restent distincts dans la liste ; une police variable garde son seul nom de famille.
      meta.nom = fam && sub && !meta.variable && !/^(regular|normal|book|roman|standard)$/i.test(sub) ? `${fam} ${sub}` : fam;
    }
    return meta;
  }

  async function digest(buffer) {
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
    return [...hash.slice(0, 8)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const fromFileName = name => name.replace(/\.[^.]*$/, '').replace(/[-_]+/g, ' ').trim();
  const cleanName = text => text.replace(/[\u0000-\u001f]/g, '').trim().slice(0, MAX_NAME);

  // Vérifie le fichier sans rien envoyer. Rejette avec un message en français lisible tel quel.
  async function inspect(file) {
    const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();
    if (!FORMATS[ext]) throw fail(ext === 'ttc' ? 'Les collections de polices (.ttc) ne sont pas prises en charge. Choisis le fichier d’un seul style.' : 'Format non pris en charge. Choisis un fichier WOFF2, WOFF, TTF ou OTF.');
    if (file.size > MAX_BYTES) throw fail(`Fichier trop lourd (${size(file.size)}). 3 Mo au maximum.`);
    const buffer = await file.arrayBuffer();
    const format = sniff(buffer);
    if (format === 'ttc') throw fail('Les collections de polices (.ttc) ne sont pas prises en charge. Choisis le fichier d’un seul style.');
    if (!format) throw fail('Ce fichier n’est pas une police lisible, même si son nom le laisse croire.');
    const meta = await readMeta(buffer, format).catch(() => null);
    return {
      font: {
        id: await digest(buffer), format, nom: cleanName(meta?.nom || fromFileName(file.name)) || 'Ma police',
        poids: meta?.poids ?? null, italique: meta?.italique ?? null, variable: meta?.variable ?? false,
        ital: !!meta?.axes.some(a => a.tag === 'ital' || a.tag === 'slnt'),
      },
      buffer, octets: file.size, lu: !!meta,
    };
  }

  // Le navigateur décode vraiment le fichier : c'est la seule preuve qu'il pourra l'afficher.
  async function load(font, buffer) {
    const desc = { display: 'swap' };
    if (font.poids) desc.weight = font.poids[0] === font.poids[1] ? String(font.poids[0]) : `${font.poids[0]} ${font.poids[1]}`;
    if (font.italique) desc.style = 'italic';
    const face = new FontFace(family(font.id), buffer, desc);
    try { await face.load(); } catch { throw fail('Le navigateur n’a pas pu lire cette police. Le fichier est peut-être abîmé.'); }
    document.fonts.add(face);
    return face;
  }

  // Caractères présents : mesurés avec deux polices de secours très différentes. Si la largeur ne change pas, c'est la
  // police importée qui dessine le caractère ; sinon le navigateur l'a remplacé.
  function coverage(font) {
    const ctx = document.createElement('canvas').getContext('2d');
    const width = (ch, fallback) => { ctx.font = `40px "${family(font.id)}",${fallback}`; return ctx.measureText(ch).width; };
    const has = ch => Math.abs(width(ch, 'monospace') - width(ch, 'serif')) < 0.01;
    const letters = [...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter(has).length;
    return { lettres: letters >= 48, manque: [...'éèêëàâçîïôùûüÿœæÉÈÀÇŒ0123456789€«»’'].filter(ch => !has(ch)) };
  }

  // Graisse des titres : 600 si la police l'a vraiment, sinon sa propre graisse plutôt qu'un gras imité.
  const titleWeight = font => !font.poids ? 600 : font.poids[0] <= 600 && font.poids[1] >= 600 ? 600 : font.poids[0] === font.poids[1] ? font.poids[0] : Math.min(font.poids[1], 700);

  // Ce que l'interface peut affirmer, et seulement ça.
  function facts(font, cover) {
    const out = [];
    if (!font.poids) out.push(font.format === 'woff2' ? 'Graisses : non lisibles dans un fichier WOFF2. S’il manque le gras, le navigateur l’imite.' : 'Graisses : non indiquées dans le fichier. S’il manque le gras, le navigateur l’imite.');
    else if (font.poids[0] !== font.poids[1]) out.push(`Police variable : graisses de ${font.poids[0]} à ${font.poids[1]}.`);
    else out.push(`Une seule graisse (${font.poids[0]}). Les autres, dont le gras, sont imitées par le navigateur.`);
    if (font.ital) out.push('Italique inclus (axe variable).');
    else if (font.italique === true) out.push('Ce fichier est en italique : tout le texte le sera.');
    else if (font.italique === false) out.push('Pas d’italique dans ce fichier : il est imité.');
    if (cover?.manque.length) out.push(`Caractères absents, affichés en police système : ${cover.manque.join(' ')}`);
    return out;
  }

  window.renzviPolices = { FORMATS, MAX_BYTES, MAX_FONTS, MAX_NAME, SYSTEM, family, size, inspect, load, coverage, titleWeight, facts, cleanName };
})();
