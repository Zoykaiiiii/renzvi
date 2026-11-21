// Depuis prototype/ : node scripts/build-calendar.mjs.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';

const out = new URL('../../site/dash/', import.meta.url).pathname;
await build({
  entryPoints: ['calendar/index.tsx'],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  outfile: `${out}calendar-picker.js`,
  jsx: 'automatic',
  alias: { '@': '.' },
  legalComments: 'none',
});
execFileSync('npx', ['@tailwindcss/cli', '-i', 'calendar/calendar.css', '-o', `${out}calendar-picker.css`, '--minify'], { stdio: 'inherit' });
