// Rend le clip « Dashboard sombre » : 240 images (0–239) de film.html, puis MP4 H.264 et affiche WebP.
// Lancement (depuis la racine du repo) :
//   NODE_PATH=~/pw/node_modules node video/dashboard-sombre/render.cjs [premiere derniere]
// Besoin : Playwright (Chromium) et imageio-ffmpeg (pip install --user imageio-ffmpeg) pour ffmpeg avec libx264.
// Sortie : site/landing/ (recopié dans prototype/public/ au build) : renzvi-dashboard-sombre.mp4 et renzvi-dashboard-sombre-poster.webp
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');

const DIR = __dirname, OUT = path.join(DIR, '..', '..', 'site', 'landing');
const N = 240, FPS = 30, POSTER = 225;
const [from = 0, to = N - 1] = process.argv.slice(2).map(Number);
const FRAMES = fs.mkdtempSync(path.join(os.tmpdir(), 'renzvi-film-'));
const ffmpeg = execFileSync('python3', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
  const page = await browser.newPage({ viewport: { width: 1560, height: 1080 } });
  await page.goto(`file://${path.join(DIR, 'film.html')}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth));
  for (let f = from; f <= to; f++) {
    await page.evaluate(f => window.render(f), f);
    await page.screenshot({ path: path.join(FRAMES, `f${String(f).padStart(3, '0')}.png`) });
  }
  await browser.close();
  if (from !== 0 || to !== N - 1) return console.log(`images ${from}–${to} dans ${FRAMES}`);
  fs.mkdirSync(OUT, { recursive: true });
  const mp4 = path.join(OUT, 'renzvi-dashboard-sombre.mp4');
  execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', path.join(FRAMES, 'f%03d.png'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an', '-movflags', '+faststart', mp4]);
  execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-i', path.join(FRAMES, `f${POSTER}.png`), '-c:v', 'libwebp', '-quality', '82', path.join(OUT, 'renzvi-dashboard-sombre-poster.webp')]);
  console.log(`OK : ${mp4} (${N} images, ${FPS} i/s), images dans ${FRAMES}`);
})().catch(e => { console.error(e); process.exit(1); });
