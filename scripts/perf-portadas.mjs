// Fase 2 · Medición de la caché de portadas con datos sintéticos y un perfil de navegador propio (nunca una cuenta real).
// Sirve `dist/` (el service worker solo existe en producción) y responde las portadas desde una ruta local.
// Uso: node scripts/perf-portadas.mjs salida.json [ruta/a/sw.js alternativo, para medir el «antes»]
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import sharp from 'sharp';

process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';
const OUT = process.argv[2] ?? 'qa-report/fase2/cache.json';
const SW_ALT = process.argv[3];
const PORT = 5198;
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };

const servidor = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join('dist', path === '/' ? 'index.html' : path);
  if (path === '/sw.js' && SW_ALT) file = SW_ALT;
  if (!existsSync(file) || !extname(file)) file = join('dist', 'index.html');
  res.writeHead(200, { 'content-type': TIPOS[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((ok) => servidor.listen(PORT, ok));

// Con ruido, para que pese como una portada de verdad (unos 30–60 KiB) y no unos pocos bytes
const imagen = (r, g, b) => sharp({ create: { width: 180, height: 270, channels: 3, background: { r, g, b }, noise: { type: 'gaussian', mean: 128, sigma: 26 } } }).jpeg({ quality: 82 }).toBuffer();
const portada = await imagen(138, 90, 60);
const portadaNueva = await imagen(47, 107, 79);
const url = (i) => `https://covers.openlibrary.org/b/id/${100000 + i}-M.jpg`;
let cambiada = 1;
const libros = (n, cambio = false) =>
  Array.from({ length: n }, (_, i) => ({ id: `syn-${i}`, title: `Libro sintético ${i}`, author: `Autora ${i % 9}`, status: i === 0 ? 'reading' : 'read', pageCount: 300, currentPage: i === 0 ? 40 : 300, cover: cambio && i === cambiada ? 'https://covers.openlibrary.org/b/id/999999-M.jpg' : url(i), addedAt: '2026-01-01T10:00:00.000Z', finishedAt: i === 0 ? null : '2026-02-01T10:00:00.000Z', quotes: [] }));

const dir = mkdtempSync(join(tmpdir(), 'bookshelf-portadas-'));
const resultados = [];
let contador = { peticiones: 0, bytes: 0 };
let modoRed = 'ok';

async function abrir() {
  const context = await chromium.launchPersistentContext(dir, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'es-ES', serviceWorkers: 'allow' });
  await context.route(/covers\.openlibrary\.org/, (route) => {
    contador.peticiones += 1;
    if (modoRed === 'caida') return route.abort('failed');
    const b = route.request().url().includes('999999') ? portadaNueva : portada;
    contador.bytes += b.length;
    return route.fulfill({ status: 200, body: b, headers: { 'content-type': 'image/jpeg', 'access-control-allow-origin': '*' } });
  });
  return context;
}
const semilla = (cambio) => (lista) => {
  localStorage.setItem('bookshelf:v1', JSON.stringify({ version: 8, books: lista, settings: { sound: false, sfx: false, onboardingDone: true, startInRoom: false }, progress: { readingLog: [] } }));
  localStorage.setItem('bookshelf:signs-hint-done', 'true');
  void cambio;
};
const metricas = (page) =>
  page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const canal = new MessageChannel();
    const r = new Promise((ok) => {
      canal.port1.onmessage = (e) => ok(e.data);
      setTimeout(() => ok(null), 1500);
    });
    reg.active.postMessage({ tipo: 'portadas-metricas' }, [canal.port2]);
    return r;
  });

/** Abre la biblioteca y espera a que todas las portadas a la vista estén pintadas. */
async function hastaPortadas(page) {
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/?inicio=anterior`, { waitUntil: 'domcontentloaded' });
  return t0;
}
async function biblioteca(page) {
  const boton = page.getByRole('button', { name: /biblioteca/i }).first();
  await boton.waitFor({ timeout: 30000 });
  await boton.click();
  await page.waitForFunction(() => document.querySelectorAll('img.cover-img').length >= 4 && [...document.querySelectorAll('img.cover-img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 30000 });
}
async function paso(nombre, fn) {
  contador = { peticiones: 0, bytes: 0 };
  const extra = await fn();
  resultados.push({ nombre, ...contador, ...extra });
  console.log(JSON.stringify(resultados.at(-1)));
}
const N = 1000;

await paso('1. Primera apertura, caché fría (instala el service worker)', async () => {
  const c = await abrir();
  const page = c.pages()[0] ?? (await c.newPage());
  await page.addInitScript(semilla(), libros(N));
  await page.goto(`http://localhost:${PORT}/?inicio=anterior`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(1200);
  // Con el service worker ya al mando, la apertura que cuenta como fría
  contador = { peticiones: 0, bytes: 0 };
  const t0 = await hastaPortadas(page);
  await biblioteca(page);
  const ms = Date.now() - t0;
  await page.waitForTimeout(2200);
  const m = await metricas(page);
  const primera = /(\d+)-M/.exec(m?.claves?.[0] ?? '');
  if (primera) cambiada = Number(primera[1]) - 100000;
  await c.close();
  return { ms, sw: m && { ...m, claves: undefined } };
});
await paso('2. Cerrar el navegador y reabrir con lo guardado', async () => {
  const c = await abrir();
  const page = c.pages()[0] ?? (await c.newPage());
  const t0 = await hastaPortadas(page);
  await biblioteca(page);
  const ms = Date.now() - t0;
  await page.waitForTimeout(2200);
  const m = await metricas(page);
  await c.close();
  return { ms, sw: m && { ...m, claves: undefined } };
});
await paso('3. Navegar fuera y volver, y cambiar día/noche', async () => {
  const c = await abrir();
  const page = c.pages()[0] ?? (await c.newPage());
  await hastaPortadas(page);
  await biblioteca(page);
  await page.waitForTimeout(800);
  contador = { peticiones: 0, bytes: 0 };
  await page.goBack();
  await page.waitForTimeout(800);
  await biblioteca(page);
  await page.evaluate(() => (document.documentElement.dataset.uiTheme = 'noche'));
  await page.waitForTimeout(600);
  const m = await metricas(page);
  await c.close();
  return { sw: m && { ...m, claves: undefined } };
});
await paso('4. Cambiar una portada: solo ese recurso', async () => {
  const c = await abrir();
  const page = c.pages()[0] ?? (await c.newPage());
  await page.addInitScript((lista) => {
    const s = JSON.parse(localStorage.getItem('bookshelf:v1'));
    s.books = lista;
    localStorage.setItem('bookshelf:v1', JSON.stringify(s));
  }, libros(N, true));
  await hastaPortadas(page);
  await biblioteca(page);
  await page.waitForTimeout(1500);
  const m = await metricas(page);
  const nueva = m?.claves?.includes('ol/b/id/999999-M.jpg');
  const vieja = m?.claves?.includes(`ol/b/id/${100000 + cambiada}-M.jpg`);
  await c.close();
  return { portadaNuevaGuardada: nueva, anteriorSigue: vieja };
});
await paso('5a. Sin red, con caché', async () => {
  modoRed = 'caida';
  const c = await abrir();
  const page = c.pages()[0] ?? (await c.newPage());
  const fallos = [];
  page.on('pageerror', (e) => fallos.push(String(e)));
  await hastaPortadas(page);
  await biblioteca(page);
  await page.waitForTimeout(800);
  await c.close();
  modoRed = 'ok';
  return { erroresDePagina: fallos.length };
});
await paso('5b. Caché expulsada (se borra entera) y sin red: la biblioteca sigue', async () => {
  modoRed = 'caida';
  const c = await abrir();
  const page = c.pages()[0] ?? (await c.newPage());
  const fallos = [];
  page.on('pageerror', (e) => fallos.push(String(e)));
  await page.goto(`http://localhost:${PORT}/?inicio=anterior`);
  await page.evaluate(async () => {
    await caches.delete('bookshelf-portadas-v1');
    await new Promise((ok) => {
      const r = indexedDB.deleteDatabase('bookshelf-portadas');
      r.onsuccess = r.onerror = r.onblocked = ok;
    });
  });
  await page.reload();
  await page.getByRole('button', { name: /biblioteca/i }).first().click({ timeout: 30000 });
  await page.waitForTimeout(7500);
  const generadas = await page.locator('.gen-cover').count();
  await c.close();
  modoRed = 'ok';
  return { erroresDePagina: fallos.length, cubiertasDeRespaldo: generadas };
});
await paso('5c. Tras la expulsión, con red: se rehace', async () => {
  const c = await abrir();
  const page = c.pages()[0] ?? (await c.newPage());
  await page.goto(`http://localhost:${PORT}/?inicio=anterior`);
  await page.waitForTimeout(800);
  const t0 = await hastaPortadas(page);
  await biblioteca(page);
  const ms = Date.now() - t0;
  await page.waitForTimeout(2200);
  const m = await metricas(page);
  await c.close();
  return { ms, sw: m && { ...m, claves: undefined } };
});
await paso('5d. Cuota llena al guardar: la biblioteca sigue', async () => {
  const c = await abrir();
  const page = c.pages()[0] ?? (await c.newPage());
  const fallos = [];
  page.on('pageerror', (e) => fallos.push(String(e)));
  await page.goto(`http://localhost:${PORT}/?inicio=anterior`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(600);
  const sw = c.serviceWorkers()[0];
  if (!sw) return { omitido: 'sin acceso al service worker' };
  await sw.evaluate(async () => {
    await caches.delete('bookshelf-portadas-v1');
    Cache.prototype.put = () => Promise.reject(new DOMException('lleno', 'QuotaExceededError'));
  });
  contador = { peticiones: 0, bytes: 0 };
  await page.evaluate(() => Promise.all(Array.from({ length: 8 }, (_, i) => fetch(`https://covers.openlibrary.org/b/id/${200000 + i}-M.jpg`, { mode: 'cors' }).then((r) => r.ok))));
  await page.waitForTimeout(800);
  const m = await metricas(page);
  await c.close();
  return { erroresDePagina: fallos.length, sw: m && { ...m, claves: undefined } };
});
await paso('6. Presupuesto: 320 portadas distintas', async () => {
  const c = await abrir();
  const page = c.pages()[0] ?? (await c.newPage());
  await page.goto(`http://localhost:${PORT}/?inicio=anterior`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(500);
  contador = { peticiones: 0, bytes: 0 };
  // Dos veces la misma tanda a la vez: las peticiones repetidas se agrupan
  await page.evaluate(async () => {
    const pide = (i) => fetch(`https://covers.openlibrary.org/b/id/${300000 + i}-M.jpg`, { mode: 'cors' }).then((r) => r.ok);
    for (let t = 0; t < 32; t += 1) await Promise.all(Array.from({ length: 10 }, (_, i) => t * 10 + i).flatMap((n) => [pide(n), pide(n)]));
  });
  await page.waitForTimeout(1500);
  const m = await metricas(page);
  await c.close();
  return { sw: m && { ...m, claves: undefined } };
});
writeFileSync(OUT, JSON.stringify(resultados, null, 1));
await new Promise((ok) => servidor.close(ok));
rmSync(dir, { recursive: true, force: true });
