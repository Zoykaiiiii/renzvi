// Construit le bouton micro du widget Dictée : site/dash/voice-pill.js (React + VoicePill) et site/dash/voice-pill.css.
// Lancement : cd prototype && node scripts/build-dictee.mjs   (à refaire après chaque changement de dictee/ ou du composant).
import { build } from 'esbuild';

await build({
  entryPoints: ['dictee/index.jsx'], bundle: true, minify: true, format: 'iife', target: 'es2020',
  outfile: new URL('../../site/dash/voice-pill.js', import.meta.url).pathname,
  jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'none',
});
console.log('voice-pill construit');
