// Copie le site statique (dashboard, login, légal…) dans public/ pour qu'il reste servi aux mêmes adresses.
// L'ancienne landing (index.html et ses scripts) n'est pas copiée : la page d'accueil est celle de Next.
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
const testUrl = process.env.RENZVI_WHOP_TEST_SUPABASE_URL;
const testKey = process.env.RENZVI_WHOP_TEST_SUPABASE_PUBLISHABLE_KEY;
if (testUrl || testKey) {
  const url = new URL(testUrl ?? '');
  if (process.env.VERCEL_ENV === 'production' || process.env.VERCEL_TARGET_ENV === 'production' ||
      !testKey || !/^sb_publishable_[\w-]+$/.test(testKey) || url.hostname.includes('xjkmztfsyyccveaeyzov') ||
      url.href !== url.origin + '/' || (url.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(url.hostname))) {
    throw new Error('Whop Sandbox requires a separate test Supabase project and a publishable key');
  }
}
const skip = new Set(['index.html', 'landing.js', 'lockin.js', 'vercel.json']);
rmSync('public', { recursive: true, force: true });
cpSync('../site', 'public', { recursive: true, filter: (src) => !skip.has(src.replace(/^\.\.\/site\/?/, '')) });
if (testUrl) {
  for (const file of ['public/login.html', 'public/dashboard.html']) {
    const html = readFileSync(file, 'utf8')
      .replace(/const SUPABASE_URL = '[^']+';/, `const SUPABASE_URL = ${JSON.stringify(new URL(testUrl).origin)};`)
      .replace(/const SUPABASE_KEY = '[^']+';/, `const SUPABASE_KEY = ${JSON.stringify(testKey)};`)
      .replace('const WHOP_TEST = false;', 'const WHOP_TEST = true;');
    writeFileSync(file, html);
  }
}
