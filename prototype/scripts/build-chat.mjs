// Construit l'îlot de chat du dashboard : site/dash/chat-ia.js (React + composant) et site/dash/chat-ia.css (Tailwind de l'îlot).
// Lancement : cd prototype && node scripts/build-chat.mjs   (à refaire après chaque changement de chat/ ou du composant).
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const out = new URL('../../site/dash/', import.meta.url).pathname;
await build({
  entryPoints: ['chat/index.tsx'], bundle: true, minify: true, format: 'iife', target: 'es2020',
  outfile: `${out}chat-ia.js`, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
  alias: { '@': '.' }, legalComments: 'none',
});
execFileSync('npx', ['@tailwindcss/cli', '-i', 'chat/chat.css', '-o', `${out}chat-ia.css`, '--minify'], { stdio: 'inherit' });

// Retire les enveloppes « @layer x { … } » de premier niveau (et les déclarations « @layer a, b; ») en gardant leur contenu.
function unlayer(css) {
  let res = '', i = 0;
  while (i < css.length) {
    const m = /@layer\s*[\w.\-]+(\s*,\s*[\w.\-]+)*\s*([;{])/y;
    m.lastIndex = i;
    const hit = css[i] === '@' && m.exec(css);
    if (!hit) { res += css[i++]; continue; }
    i = m.lastIndex;
    if (hit[2] === ';') continue;
    let depth = 1, j = i;
    while (depth && j < css.length) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
    res += unlayer(css.slice(i, j - 1));
    i = j;
  }
  return res;
}
const file = `${out}chat-ia.css`;
const flat = unlayer(readFileSync(file, 'utf8'));
if (/@layer/.test(flat)) throw new Error('@layer restant dans chat-ia.css');
writeFileSync(file, flat);
console.log('chat-ia construit');
