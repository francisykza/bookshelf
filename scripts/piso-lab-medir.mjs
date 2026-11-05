// Piloto «Del portal al sillón»: mide la versión compilada del laboratorio con un perfil de Playwright propio y datos
// sintéticos. Compara el rincón vigente (/) con el piloto (/?piloto=piso): primera carga, bytes, tiempo hasta registrar y
// fluidez del giro. También hace diez entradas y salidas contando contextos WebGL (en producción no hay doble montaje de
// StrictMode). Es EMULACIÓN: Chromium móvil a 390 × 844, CPU ×4, y WebGL por software; no sustituye a un móvil físico.
// Uso, con `npm run build` hecho: node scripts/piso-lab-medir.mjs [salida.json]
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { gzipSync } from 'node:zlib';

const PORT = 5198;
const BASE = `http://localhost:${PORT}`;
const OUT = process.argv[2] ?? 'qa-report/piso-lab/medidas.json';
const CPU = 4;

function syntheticBooks(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `syn-${i}`,
    title: i === 0 ? 'Libro en curso' : `Libro de prueba ${i}`,
    author: `Autora ${i % 97}`,
    status: i === 0 ? 'reading' : i % 3 ? 'read' : 'want',
    pageCount: 120 + ((i * 37) % 600),
    currentPage: i === 0 ? 40 : 0,
    cover: '',
    addedAt: new Date(Date.UTC(2024, 0, 1) + i * 3600000).toISOString(),
    finishedAt: i !== 0 && i % 3 ? new Date(Date.UTC(2024, 0, 1) + i * 86400000).toISOString() : null,
    quotes: [],
  }));
}

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

async function newPage(browser, books, init) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES', serviceWorkers: 'block' });
  const external = [];
  await context.route(/^https:\/\//, (route) => {
    external.push(route.request().url());
    return route.abort();
  });
  await context.addInitScript(
    ([state]) => {
      if (sessionStorage.getItem('seeded')) return;
      localStorage.clear();
      localStorage.setItem('bookshelf_onboarding_done', 'true');
      localStorage.setItem('bookshelf:signs-hint-done', 'true');
      if (state) localStorage.setItem('bookshelf:v1', state);
      sessionStorage.setItem('seeded', '1');
    },
    [books ? JSON.stringify({ version: 6, books, settings: { sound: false, viewMode: 'cover', owner: 'Prueba' } }) : null],
  );
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  // Lo pedido, medido sobre dist/ tal como lo serviría Vercel (gzip); el servidor local no comprime
  const urls = new Set();
  page.on('request', (r) => {
    if (r.url().startsWith(BASE)) urls.add(new URL(r.url()).pathname);
  });
  const bytes = () => {
    let raw = 0;
    let gz = 0;
    const list = [];
    for (const u of urls) {
      const file = `dist${u === '/' ? '/index.html' : decodeURIComponent(u)}`;
      if (!existsSync(file)) continue;
      const body = readFileSync(file);
      raw += body.length;
      gz += /.(js|css|html|json|svg)$/.test(file) ? gzipSync(body).length : body.length;
      list.push(u);
    }
    return { kbSinComprimir: Math.round(raw / 1024), kbGzip: Math.round(gz / 1024), peticiones: list.length, three: list.some((u) => /interior3d/.test(u)) };
  };
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  return { context, page, external, bytes };
}

const paints = (page) => page.evaluate(() => Object.fromEntries(performance.getEntriesByType('paint').map((e) => [e.name, Math.round(e.startTime)])));

async function vigente(browser, books) {
  const { context, page, external, bytes } = await newPage(browser, books);
  const t0 = Date.now();
  await page.goto(`${BASE}/`);
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0, null, { timeout: 60000 });
  const r = { cargaHastaEscenaMs: Date.now() - t0, pintado: await paints(page) };
  await page.waitForTimeout(1500);
  r.ruta = bytes();
  const reg = page.getByRole('button', { name: /registrar/i }).first();
  const t1 = Date.now();
  await reg.click();
  await page.getByRole('dialog').last().waitFor();
  r.registrarDesdeEscenaMs = Date.now() - t1;
  r.externas = external.filter((u) => /supabase/.test(u));
  await context.close();
  return r;
}

async function piloto(browser, books) {
  const { context, page, external, bytes } = await newPage(browser, books);
  const t0 = Date.now();
  await page.goto(`${BASE}/?piloto=piso`);
  const door = page.getByRole('button', { name: /^Entrar en tu piso/ });
  await door.waitFor({ timeout: 60000 });
  const r = { cargaHastaPortalMs: Date.now() - t0, pintado: await paints(page) };
  await page.waitForTimeout(1500);
  r.portal = bytes();
  const t1 = Date.now();
  await door.click();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().windows.length > 0, null, { timeout: 60000 });
  r.entrarEnPisoMs = Date.now() - t1;
  await page.waitForTimeout(500);
  r.trasEntrar = bytes();
  const reg = page.getByRole('button', { name: /^Registrar lectura/ });
  const t2 = Date.now();
  await reg.click();
  await page.getByRole('dialog').last().waitFor();
  r.registrarDesdeSillonMs = Date.now() - t2;
  r.portalHastaRegistroMs = r.entrarEnPisoMs + r.registrarDesdeSillonMs;
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  r.giro = await page.evaluate(() => window.__pisoLab().measureYaw(5000));
  r.giroMemoria = (await page.evaluate(() => window.__pisoLab().debug())).memory;
  r.externas = external.filter((u) => /supabase/.test(u));
  r.gpu = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'desconocida';
  });
  await context.close();
  return r;
}

async function diezVueltas(browser) {
  const { context, page } = await newPage(browser, null, () => {
    window.__contexts = 0;
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
      const had = this.__hadGl;
      const ctx = get.call(this, kind, ...rest);
      if (/webgl/.test(kind) && ctx && !had) {
        this.__hadGl = true;
        window.__contexts += 1;
      }
      return ctx;
    };
  });
  await page.goto(`${BASE}/?piloto=piso`);
  const mine = page.getByRole('button', { name: /^Entrar en tu piso/ });
  const other = page.getByRole('button', { name: /^Llamar y entrar/ });
  await mine.waitFor({ timeout: 60000 });
  const memory = [];
  for (let i = 0; i < 10; i += 1) {
    await (i % 2 ? other : mine).click();
    await page.waitForFunction(() => window.__pisoLab?.()?.debug().windows.length > 0, null, { timeout: 60000 });
    memory.push((await page.evaluate(() => window.__pisoLab().debug())).memory);
    await page.getByRole('button', { name: 'Al portal' }).click();
    await mine.waitFor();
  }
  await page.waitForTimeout(300);
  const r = { entradas: 10, contextosCreados: await page.evaluate(() => window.__contexts), lienzosInteriorVivos: await page.locator('.plab-canvas').count(), memoriaPiso1: [memory[0], memory[8]], memoriaPiso2: [memory[1], memory[9]] };
  await context.close();
  return r;
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { shell: true, stdio: 'ignore' });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  await waitServer();
  const result = { aviso: `Emulación: Chromium móvil 390x844, CPU x${CPU}, WebGL por software. No es un dispositivo físico.`, ejemplo: {}, grande: {} };
  result.ejemplo.vigente = await vigente(browser, null);
  result.ejemplo.piloto = await piloto(browser, null);
  const big = syntheticBooks(1200);
  result.grande.vigente = await vigente(browser, big);
  result.grande.piloto = await piloto(browser, big);
  result.diezVueltas = await diezVueltas(browser);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
  spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true, stdio: 'ignore' });
}
