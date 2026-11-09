// Portadas al cambiar de filtro en la Biblioteca: Todos → Leyendo → Pendientes → Abandonados → Leídos → Todos, midiendo cada
// fotograma y las solicitudes de imagen en un servidor local con caché normal. Datos sintéticos.
import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { deflateSync } from 'node:zlib';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const SALA = { v: 1, pared: 'yeso', suelo: 'tablas', items: [{ uid: 1, id: 'sillon', tono: 1, x: 4, y: 6, rot: 2 }, { uid: 2, id: 'escritorio', x: 0, y: 3, rot: 3, tono: 0 }] };
const PUERTO = 5197;
const ESTADOS = ['reading', 'want', 'abandoned', 'read'];
const pedidas = new Map();

/** Una portada PNG de un solo color: como las reales, una imagen de mapa de bits. */
function png(w, h, [r, g, b]) {
  const tabla = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const x of buf) c = tabla[(c ^ x) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const trozo = (tipo, datos) => {
    const nombre = Buffer.from(tipo);
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(datos.length);
    const suma = Buffer.alloc(4);
    suma.writeUInt32BE(crc(Buffer.concat([nombre, datos])));
    return Buffer.concat([largo, nombre, datos, suma]);
  };
  const cab = Buffer.alloc(13);
  cab.writeUInt32BE(w, 0);
  cab.writeUInt32BE(h, 4);
  cab.set([8, 2, 0, 0, 0], 8);
  const fila = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3).map((_, i) => [r, g, b][i % 3])]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo('IHDR', cab), trozo('IDAT', deflateSync(Buffer.concat(Array(h).fill(fila)))), trozo('IEND', Buffer.alloc(0))]);
}
let servidor;

test.beforeAll(async () => {
  servidor = createServer((req, res) => {
    pedidas.set(req.url, (pedidas.get(req.url) ?? 0) + 1);
    if (req.url.includes('rota')) {
      res.writeHead(404);
      res.end();
      return;
    }
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
      const n = Number(req.url.match(/\d+/)?.[0] ?? 0);
      res.end(png(180, 270, [60 + ((n * 37) % 180), 60 + ((n * 91) % 180), 60 + ((n * 53) % 180)]));
    }, 180);
  });
  await new Promise((ok) => servidor.listen(PUERTO, ok));
});
test.afterAll(() => new Promise((ok) => servidor.close(ok)));

const libros = Array.from({ length: 40 }, (_, i) => ({
  id: `b${i}`,
  title: `Libro ${i}`,
  author: 'Autoría de prueba',
  status: ESTADOS[i % 4],
  pageCount: 300,
  currentPage: i % 4 === 0 ? 40 : 0,
  cover: `http://localhost:${PUERTO}/${i === 7 ? 'rota' : 'c'}/${i}.png`,
  addedAt: `2026-10-${String((i % 27) + 1).padStart(2, '0')}T10:00:00.000Z`,
  quotes: [],
}));
const DATOS = { version: 8, books: libros, settings: { sound: false, sfx: false, onboardingDone: true }, progress: { readingLog: [], pomodoros: [], claimed: {} } };

/** En cada fotograma, las portadas a la vista que no enseñan imagen, separando las de libros sin imagen real. */
const medir = () => {
  window.__huecos = [];
  window.__midiendo = true;
  const paso = () => {
    if (!window.__midiendo) return;
    const alto = innerHeight;
    const aLaVista = (n) => {
      const r = n.getBoundingClientRect();
      return r.width > 0 && r.bottom > 0 && r.top < alto;
    };
    const titulos = (sel) => [...document.querySelectorAll(sel)].filter(aLaVista).length;
    const sinPintar = [...document.querySelectorAll('img.cover-img')].filter((n) => aLaVista(n) && (!n.complete || !n.naturalWidth)).length;
    const huecos = [...document.querySelectorAll('.plab-row__cover')].filter(aLaVista);
    const sinTapa = huecos.filter((n) => !n.querySelector('img.cover-img, .gen-cover')).length;
    window.__huecos.push({ huecos: huecos.length, sinTapa, espera: titulos('.cover-img--wait'), tipografica: [...document.querySelectorAll('.gen-cover')].filter((n) => aLaVista(n) && !n.textContent.includes('Libro 7')).length, sinPintar });
    requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
};

test('las portadas ya mostradas no vuelven a placeholders y no se piden otra vez', async ({ browser }) => {
  test.setTimeout(120000);
  const context = await browser.newContext({ baseURL: 'http://localhost:5196', locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'e1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout: SALA });
  mock.db.libraries.push({ user_id: ANA.id, data: DATOS, updated_at: new Date().toISOString(), version: 5 });
  await page.addInitScript((d) => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!localStorage.getItem('bookshelf:v1')) localStorage.setItem('bookshelf:v1', JSON.stringify(d));
  }, DATOS);
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('button', { name: 'Mi biblioteca', exact: true }).click();
  await expect(page.locator('.plab-library')).toBeVisible();
  const filtro = (id) => page.locator(`.plab-filter[data-filtro="${id}"]`);
  await expect(filtro('all')).toBeVisible({ timeout: 30000 });

  // Primera pasada: cada filtro carga lo suyo una vez
  const orden = ['reading', 'want', 'abandoned', 'read', 'all'];
  for (const id of orden) {
    await filtro(id).click();
    await page.waitForTimeout(1200);
  }
  const antes = new Map(pedidas);

  // Segunda pasada: todo ya se ha mostrado; no debería verse ni pedirse nada de nuevo
  await page.evaluate(medir);
  const porFiltro = {};
  for (const id of orden) {
    await page.evaluate(() => {
      window.__huecos.length = 0;
    });
    await filtro(id).click();
    await page.waitForTimeout(900);
    const huecos = await page.evaluate(() => window.__huecos);
    porFiltro[id] = { fotogramas: huecos.length, conEspera: huecos.filter((h) => h.espera).length, conTipografica: huecos.filter((h) => h.tipografica).length, sinPintar: huecos.filter((h) => h.sinPintar).length, sinTapa: huecos.filter((h) => h.sinTapa).length, huecos: Math.max(...huecos.map((h) => h.huecos)) };
  }
  const repetidas = [...pedidas].filter(([url, n]) => url.includes('/c/') && n > (antes.get(url) ?? 0)).map(([url]) => url);
  console.log('RESULTADO', JSON.stringify(porFiltro));
  console.log('PEDIDAS_REPETIDAS', repetidas.length, 'DISTINTAS', pedidas.size, 'ROTA', pedidas.get('/rota/7.png') ?? 0);
  await filtro('read').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'qa-report/portadas-filtros.png' });
  // Imágenes reales, decodificadas y con el tamaño de la cara del libro
  const pintados = await page.evaluate(() => [...document.querySelectorAll('img.cover-img')].filter((c) => c.complete && c.naturalWidth > 10 && c.getBoundingClientRect().height > 100).length);
  expect(pintados).toBeGreaterThan(5);
  for (const v of Object.values(porFiltro)) expect(v.conEspera + v.conTipografica + v.sinPintar + v.sinTapa).toBe(0);
  expect(repetidas).toEqual([]);
  // La que de verdad falta conserva su cubierta tipográfica y no se reintenta
  expect(await page.locator('.gen-cover', { hasText: 'Libro 7' }).count()).toBeGreaterThan(0);
  expect(pedidas.get('/rota/7.png')).toBe(1);
  await context.close();
});
