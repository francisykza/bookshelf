// «Tu mes en libros»: ¿las portadas ya estaban guardadas y se ve la balda vacía? Build de producción, service worker real, perfil propio que
// sobrevive al cierre del navegador y datos sintéticos. Cuenta, fotograma a fotograma, cuántos tienen alguna portada sin pintar.
// Uso: MEDIR_MES=salida.json npx playwright test -c playwright.community.config.js e2e-community/medir-mes.spec.js --project=chromium-390x844 --workers=1 (sirve qa-report/dist-medir/, compilado con las variables del servidor simulado)
import { chromium, test } from '@playwright/test';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import sharp from 'sharp';
import { createMockSupabase } from './mockSupabase';

process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';
const OUT = process.env.MEDIR_MES;
const DIST = 'qa-report/dist-medir';
const PORT = 5199;
const LATENCIA = 120; // ms por portada: en local llegarían al instante y el problema no se vería
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const servidor = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join(DIST, path === '/' ? 'index.html' : path);
  if (!existsSync(file) || !extname(file)) file = join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': TIPOS[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(file));
});

test('medir las portadas al cambiar de mes', async () => {
  test.skip(!OUT, 'solo a mano, con MEDIR_MES');
  test.setTimeout(280000);
await new Promise((ok) => servidor.listen(PORT, ok));

const portada = await sharp({ create: { width: 180, height: 270, channels: 3, background: { r: 138, g: 90, b: 60 }, noise: { type: 'gaussian', mean: 128, sigma: 26 } } }).jpeg({ quality: 82 }).toBuffer();
const ahora = new Date();
const mes = (by) => {
  const d = new Date(ahora.getFullYear(), ahora.getMonth() + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const libro = (id, m, i) => ({ id, title: `Libro sintético ${id}`, author: 'Autoría de prueba', status: 'read', pageCount: 300, currentPage: 300, cover: `https://covers.openlibrary.org/b/id/${id}-M.jpg`, addedAt: `${m}-01T10:00:00.000Z`, finishedAt: `${m}-${String((i % 27) + 1).padStart(2, '0')}T10:00:00.000Z`, quotes: [] });
const books = [
  ...Array.from({ length: 12 }, (_, i) => libro(1000 + i, mes(-1), i)),
  ...Array.from({ length: 9 }, (_, i) => libro(2000 + i, mes(-2), i)),
];
const biblio = { version: 8, books, settings: { sound: false, sfx: false, onboardingDone: true }, progress: { readingLog: [], pomodoros: [], claimed: {} } };
const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const SALA = { v: 1, pared: 'yeso', suelo: 'tablas', items: [{ uid: 3, id: 'estanteria', x: 2, y: 0, rot: 0, tono: 0 }, { uid: 4, id: 'escritorio', x: 0, y: 3, rot: 3, tono: 0 }] };

const dir = mkdtempSync(join(tmpdir(), 'bookshelf-mes-'));
let contador = { peticiones: 0, bytes: 0 };

async function abrir() {
  const context = await chromium.launchPersistentContext(dir, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'es-ES', timezoneId: 'Europe/Madrid', serviceWorkers: 'allow' });
  await context.route(/covers\.openlibrary\.org/, async (route) => {
    contador.peticiones += 1;
    contador.bytes += portada.length;
    await new Promise((ok) => setTimeout(ok, LATENCIA));
    return route.fulfill({ status: 200, body: portada, headers: { 'content-type': 'image/jpeg', 'access-control-allow-origin': '*' } });
  });
  const page = context.pages()[0] ?? (await context.newPage());
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Prueba', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout: SALA });
  mock.db.libraries.push({ user_id: ANA.id, data: biblio, updated_at: new Date().toISOString(), version: 5 });
  // Ritmo de un móvil corriente: en un ordenador rápido el hueco apenas dura un fotograma
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await page.addInitScript((datos) => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!localStorage.getItem('bookshelf:v1')) localStorage.setItem('bookshelf:v1', JSON.stringify(datos));
    window.__fotos = [];
    const mirar = () => {
      const raiz = document.querySelector('.mb');
      const baldas = raiz?.querySelector('.mb__baldas');
      if (baldas) {
        const portadas = [...baldas.querySelectorAll('.mb__portada')];
        const sin = portadas.filter((p) => {
          const img = p.querySelector('img');
          return !img || !img.complete || !img.naturalWidth;
        }).length;
        window.__fotos.push({ t: performance.now(), mes: raiz.querySelector('.mb__mes b')?.textContent, total: portadas.length, sin });
      }
      requestAnimationFrame(mirar);
    };
    requestAnimationFrame(mirar);
  }, biblio);
  await mock.attach(page, ANA);
  return { context, page };
}
async function alCalendario(page) {
  await page.goto(`http://localhost:${PORT}/?inicio=habitacion`);
  await page.locator('.plab-stage[data-ready]').waitFor({ timeout: 40000 });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('button', { name: 'Calendario' }).first().click().catch(() => {});
  await page.waitForTimeout(300);
  if (!(await page.locator('.port-cal').isVisible())) {
    await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
    await page.getByRole('heading', { name: 'Mi escritorio' }).waitFor({ timeout: 12000 });
    await page.getByRole('button', { name: 'Calendario' }).click();
  }
  await page.locator('.port-cal').waitFor();
}
const sw = (page) =>
  page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const canal = new MessageChannel();
    const r = new Promise((ok) => {
      canal.port1.onmessage = (e) => ok(e.data);
      setTimeout(() => ok(null), 1500);
    });
    reg.active.postMessage({ tipo: 'portadas-metricas' }, [canal.port2]);
    const d = await r;
    return d && { aciertos: d.aciertos, fallos: d.fallos, descargas: d.descargas, bytesRed: d.bytesRed, entradas: d.entradas };
  });
const resultados = [];
/** Una acción y lo que se ha visto después: fotogramas con huecos y cuánto han durado. */
async function paso(nombre, page, accion) {
  contador = { peticiones: 0, bytes: 0 };
  await page.evaluate(() => {
    window.__fotos.length = 0;
  });
  await accion();
  await page.waitForTimeout(1800);
  const fotos = await page.evaluate(() => window.__fotos);
  const huecos = fotos.filter((f) => f.sin > 0);
  const fila = { nombre, peticiones: contador.peticiones, bytes: contador.bytes, fotogramas: fotos.length, fotogramasConHueco: huecos.length, msConHueco: huecos.length ? Math.round(huecos.at(-1).t - huecos[0].t) : 0, maxPortadasSinPintar: huecos.reduce((m, f) => Math.max(m, f.sin), 0), sw: await sw(page) };
  resultados.push(fila);
  console.log(JSON.stringify(fila));
}
const anterior = (page) => page.locator('.mb__mes').getByRole('button', { name: 'Mes anterior' }).click();
const siguiente = (page) => page.locator('.mb__mes').getByRole('button', { name: 'Mes siguiente' }).click();
const entrar = (page) => page.getByRole('button', { name: 'Tu mes en libros' }).click();

try {
  let { context, page } = await abrir();
  await page.goto(`http://localhost:${PORT}/?inicio=habitacion`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(1500);
  await alCalendario(page);
  await page.waitForTimeout(600);
  await entrar(page);
  await page.waitForTimeout(400);
  await paso('1. Primera visita al mes anterior', page, () => anterior(page));
  await paso('2. Segundo mes, también nuevo', page, () => anterior(page));
  await paso('3. Volver a un mes ya visitado, misma sesión', page, () => siguiente(page));
  await context.close();
  ({ context, page } = await abrir());
  await alCalendario(page);
  await page.waitForTimeout(600);
  await entrar(page);
  await page.waitForTimeout(400);
  await paso('4. Cerrar el navegador, reabrir y entrar al mismo mes', page, () => anterior(page));
  await paso('5. Tras reabrir, otro mes guardado', page, () => anterior(page));
  await context.close();
} finally {
  writeFileSync(OUT, JSON.stringify(resultados, null, 2));
  servidor.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows puede tardar en soltar el perfil
  }
}
});
