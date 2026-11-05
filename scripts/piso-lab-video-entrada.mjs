// Vídeo de la primera entrada del piloto, con caché vacía: versión compilada, perfil de Playwright nuevo, sin service
// worker y con la red real para la cubierta. Emulación a 390 × 844; no equivale a un móvil físico ni a su red.
// Uso, con `npm run build` hecho: node scripts/piso-lab-video-entrada.mjs [carpeta] [captura.png]
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';

const PORT = 5199;
const BASE = `http://localhost:${PORT}`;
const OUT = process.argv[2] ?? 'qa-report/piso-lab/entrada-cache-vacia';
const SHOT = process.argv[3];

async function waitServer() {
  for (let i = 0; i < 120; i += 1) {
    try {
      if ((await fetch(`${BASE}/`)).ok) return;
    } catch {
      // aún arrancando
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('El servidor de la versión compilada no arrancó');
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { shell: true, stdio: 'ignore' });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  await waitServer();
  mkdirSync(OUT, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES', serviceWorkers: 'block', recordVideo: { dir: OUT, size: { width: 390, height: 844 } } });
  await context.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.clearBrowserCache');
  await page.goto(`${BASE}/?piloto=piso`);
  const door = page.getByRole('button', { name: /^Entrar en tu piso/ });
  await door.waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  const t0 = Date.now();
  await door.click();
  await page.locator('.plab-canvas').waitFor({ timeout: 60000 });
  const visible = Date.now() - t0;
  const atReveal = await page.evaluate(() => window.__pisoLab?.()?.debug().book?.coverReal ?? false);
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().book?.coverReal, null, { timeout: 30000 });
  const cover = Date.now() - t0;
  await page.waitForTimeout(3000);
  if (SHOT) await page.screenshot({ path: SHOT });
  console.log(JSON.stringify({ tocarHastaVerElPisoMs: visible, cubiertaYaAlAparecer: atReveal, tocarHastaCubiertaMs: cover }));
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), `${OUT}.webm`);
} finally {
  await browser.close();
  spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true, stdio: 'ignore' });
}
