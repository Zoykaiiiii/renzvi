// Serveur de démonstration : sert site/ et simule Supabase en mémoire. Aucun compte réel, aucune requête vers la vraie base.
// Sert aux captures, à l'inspecteur du skill design (qui ouvre une simple adresse) et à tests/parcours.check.cjs.
// Le dashboard servi est celui de site/, à deux détails près, ajoutés à la volée et jamais écrits sur le disque :
//   - SUPABASE_URL pointe sur ce serveur ;
//   - une fausse session est posée avant le chargement, pour le profil choisi dans l'adresse.
// Lancement : node tests/demo.cjs [port]   puis http://127.0.0.1:<port>/dashboard.html?profil=plein
// Profils : plein (modes Study et Chill remplis), simple (une seule page), vide (compte existant, page vide),
// nouveau (premier lancement). ?bac=<nom> isole un jeu de données (un par test) ; sans lui, le profil est partagé.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'site');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const REAL_URL = "const SUPABASE_URL = 'https://xjkmztfsyyccveaeyzov.supabase.co';";

const day = n => new Date(Date.now() + n * 864e5).toLocaleDateString('sv');
// Des contenus plausibles d'étudiante, datés par rapport à aujourd'hui.
const contenu = () => ({
  minuteur: { length: 25, day: day(0), minutes: 50, log: { [day(0)]: 50, [day(-1)]: 100, [day(-2)]: 75, [day(-4)]: 25 } },
  taches: { items: [{ id: 'a', text: 'Relire le chapitre 4 de droit des contrats', done: false }, { id: 'b', text: 'Envoyer le dossier de stage', done: true }, { id: 'c', text: 'Préparer les fiches de procédure civile', done: false }, { id: 'd', text: 'Appeler la scolarité', done: false }] },
  notes: { text: 'Idées pour le mémoire\n— plan en trois parties\n— rappeler Sam pour les sources' },
  habitudes: { items: [{ id: 'h', name: 'Lire vingt minutes', days: [day(0), day(-1), day(-2)] }, { id: 'i', name: 'Marcher', days: [day(-1)] }] },
  compte: { items: [{ id: 'c1', title: 'Partiel de droit civil', date: day(12) }, { id: 'c2', title: 'Vacances de Noël', date: day(38) }] },
  raccourcis: { items: [{ id: 'l1', label: 'Cours en ligne', url: 'https://moodle.exemple.fr/mon-cours' }, { id: 'l2', label: 'Bibliothèque universitaire', url: 'https://bibliotheque.exemple.fr' }] },
  lecture: { book: { title: 'Le Comte de Monte-Cristo', author: 'Alexandre Dumas', pages: 1200, page: 320 }, quotes: [{ id: 'q', text: 'Attendre et espérer.', book: 'Le Comte de Monte-Cristo' }], finished: [] },
});
const STUDY = ['cahier', 'revisions', 'cartes', 'vol', 'minuteur', 'taches', 'semaine', 'notes', 'compte'];
const CHILL = ['respiration', 'ambiance', 'lecture', 'playlist', 'pause', 'inspiration'];
const PROFILS = {
  plein: () => ({
    ...contenu(),
    ecran: {
      wallpaper: 'blanc', done: true, accent: 'vert', sizes: {},
      pages: [{ id: 'study', name: 'Study', wall: 'brume' }, { id: 'chill', name: 'Chill', wall: 'lac' }],
      widgets: [...STUDY, ...CHILL],
      where: Object.fromEntries([...STUDY.map(id => [id, 'study']), ...CHILL.map(id => [id, 'chill'])]),
    },
  }),
  simple: () => ({ ...contenu(), ecran: { wallpaper: 'blanc', done: true, widgets: ['taches', 'minuteur', 'notes', 'heure', 'habitudes', 'compte'] } }),
  vide: () => ({ ...contenu(), ecran: { wallpaper: 'blanc', done: true, widgets: [] } }),
  nouveau: () => ({}),
};

// Posée avant tout autre script : la session que supabase-js relit dans le navigateur. Le profil voyage dans le jeton.
const SESSION = `<script>(()=>{const q=new URLSearchParams(location.search),net=v=>(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const sub='demo-'+(net(q.get('profil'))||'plein')+(net(q.get('bac'))?'-'+net(q.get('bac')):'');
const b=o=>btoa(JSON.stringify(o)).replace(/=+$/,'').replace(/\\+/g,'-').replace(/\\//g,'_');
const user={id:sub,aud:'authenticated',role:'authenticated',email:'lea@exemple.fr',app_metadata:{},user_metadata:{full_name:'Léa Martin'},created_at:'2026-11-03T00:00:00Z'};
const session=JSON.stringify({access_token:b({alg:'HS256'})+'.'+b({sub,exp:4102444800,role:'authenticated'})+'.sig',refresh_token:'r',token_type:'bearer',expires_in:3600,expires_at:4102444800,user});
for(const k of ['sb-127-auth-token','sb-localhost-auth-token'])localStorage.setItem(k,session);})()</script>`;

function start(port = 0) {
  const bacs = new Map(); // sub -> { rows, files, saves, panne }
  const bac = sub => {
    if (!bacs.has(sub)) {
      const profil = PROFILS[sub.split('-')[1]] ?? PROFILS.plein;
      bacs.set(sub, { rows: profil(), files: new Map(), saves: 0, panne: false });
    }
    return bacs.get(sub);
  };
  const subOf = req => {
    try { return JSON.parse(Buffer.from((req.headers.authorization ?? '').split('.')[1] ?? '', 'base64url').toString()).sub ?? 'demo-plein'; } catch { return 'demo-plein'; }
  };
  const body = req => new Promise(resolve => { const parts = []; req.on('data', c => parts.push(c)); req.on('end', () => resolve(Buffer.concat(parts))); });
  const json = (res, status, data, headers = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(data)); };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const route = url.pathname;
    try {
      if (route.startsWith('/rest/v1/')) {
        const table = route.slice(9);
        const b = bac(subOf(req));
        if (table === 'widget_state') {
          if (req.method === 'GET') return json(res, 200, Object.entries(b.rows).map(([widget, data]) => ({ widget, data })));
          b.saves++;
          if (b.panne) return json(res, 500, { message: 'panne simulée' });
          for (const row of JSON.parse(await body(req))) b.rows[row.widget] = row.data;
          return json(res, 201, []);
        }
        if (table === 'rpc/get_my_referral') return json(res, 200, [{ referral_code: 'K7M2PQ9D', referral_count: 0 }]);
        // Les tables Study et IA sont vides ici : les widgets montrent leur état de départ.
        return json(res, req.method === 'POST' ? 201 : 200, [], { 'content-range': '*/0' });
      }
      if (route.startsWith('/storage/v1/object/')) {
        const b = bac(subOf(req));
        const key = decodeURIComponent(route.slice(19));
        if (req.method === 'GET') {
          const file = b.files.get(key);
          if (!file) return json(res, 404, { statusCode: '404', error: 'not_found', message: 'Object not found' });
          res.writeHead(200, { 'content-type': file.type });
          return res.end(file.data);
        }
        if (req.method === 'DELETE') { for (const p of JSON.parse(await body(req)).prefixes ?? []) b.files.delete(`${key}/${p}`); return json(res, 200, []); }
        b.files.set(key, { type: req.headers['content-type'] ?? 'application/octet-stream', data: await body(req) });
        return json(res, 200, { Key: key });
      }
      if (route === '/auth/v1/logout') { res.writeHead(204); return res.end(); }
      if (route.startsWith('/auth/v1/')) return json(res, 200, { id: subOf(req), aud: 'authenticated', role: 'authenticated', email: 'lea@exemple.fr' });
      if (route.startsWith('/functions/v1/')) return json(res, 200, { ok: false, raison: 'ia_desactivee' });

      const file = path.join(ROOT, decodeURIComponent(route === '/' ? '/index.html' : route));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
      if (route === '/dashboard.html') {
        const html = fs.readFileSync(file, 'utf8');
        if (!html.includes(REAL_URL)) throw new Error('SUPABASE_URL introuvable dans dashboard.html : le serveur de démo doit être mis à jour');
        res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-store' });
        return res.end(html.replace(REAL_URL, 'const SUPABASE_URL = location.origin;').replace('<head>', `<head>${SESSION}`));
      }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve({
    url: `http://127.0.0.1:${server.address().port}`,
    // Pour les tests : le jeu de données d'un profil (et de son bac), tel que le serveur l'a reçu.
    bac: (profil, nom = '') => bac(`demo-${profil}${nom ? `-${nom}` : ''}`),
    close: () => new Promise(done => server.close(done)),
  })));
}

module.exports = { start, PROFILS };
if (require.main === module) start(Number(process.argv[2]) || 4173).then(s => console.log(`Démo : ${s.url}/dashboard.html?profil=plein  (profils : ${Object.keys(PROFILS).join(', ')})`));
