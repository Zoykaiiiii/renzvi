// Mesure les pixels des yeux dans le canevas réellement peint pendant 20 s, chat fermé.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { start } = require('./demo.cjs');
(async () => {
  const server = await start();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle'] });
  try {
    const viewport = { width: 390, height: 640 };
    const page = await browser.newPage({ viewport,
      ...(process.env.VIDEO && { recordVideo: { dir: process.env.VIDEO, size: viewport } }) });
    await page.addInitScript(() => localStorage.setItem('renzvi:chat', JSON.stringify({ orbe: 'blanc' })));
    await page.goto(server.url + '/dashboard.html?profil=simple&bac=regard&labo=1');
    const avatar = page.locator('.chat-ia-launch');
    const box = await avatar.boundingBox();
    const samples = await avatar.locator('canvas').evaluate(canvas => new Promise(resolve => {
      const gl = canvas.getContext('webgl');
      const start = performance.now(), samples = [];
      function frame(now) {
        const w = canvas.width, h = canvas.height, pixels = new Uint8Array(4 * w * h);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let sum = 0, count = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] > 250 && pixels[i] < 80) {
            sum += (i / 4) % w;
            count++;
          }
        }
        if (count) samples.push({ t: now - start, x: sum / count / w, count });
        if (now - start < 20000) requestAnimationFrame(frame);
        else resolve(samples);
      }
      requestAnimationFrame(frame);
    }));
    const left = samples.find(s => s.x < .40), right = samples.find(s => s.x > .60);
    assert.ok(left && right && left.t < right.t, 'les pixels des yeux se déplacent à gauche puis à droite');
    const counts = samples.filter(s => Math.abs(s.x - .5) < .05).map(s => s.count);
    assert.ok(Math.min(...counts) < .6 * Math.max(...counts), 'clignement au centre');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    const look = await avatar.locator('canvas').evaluate(c => {
      const gl = c.getContext('webgl'), p = gl.getParameter(gl.CURRENT_PROGRAM);
      return [...gl.getUniform(p, gl.getUniformLocation(p, 'u_look'))];
    });
    assert.ok(look.every(value => Math.abs(value) < .4));
    assert.deepEqual(await avatar.boundingBox(), box);
    assert.equal(await avatar.getAttribute('aria-expanded'), 'false');
    await page.close();
    if (process.env.VIDEO) await page.video().saveAs(path.join(process.env.VIDEO, 'zvi-idle.webm'));
    console.log('Regard gauche/droite (ms)', Math.round(left.t), Math.round(right.t), 'et clignement OK');
  } finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
