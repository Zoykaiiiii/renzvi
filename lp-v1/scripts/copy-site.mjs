// Copie le site statique (dashboard, login, légal…) dans public/ pour qu'il reste servi aux mêmes adresses.
// L'ancienne landing (index.html et ses scripts) n'est pas copiée : la page d'accueil est celle de Next.
import { cpSync, rmSync } from 'node:fs';
const skip = new Set(['index.html', 'landing.js', 'lockin.js', 'vercel.json']);
rmSync('public', { recursive: true, force: true });
cpSync('../site', 'public', { recursive: true, filter: (src) => !skip.has(src.replace(/^\.\.\/site\/?/, '')) });
