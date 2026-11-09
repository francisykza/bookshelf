// Fase 3 · Biblioteca, ficha y resumen del mes con ranking, con datos sintéticos en perfiles de prueba.
import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const DIR = join('qa-report', 'fase3');
mkdirSync(join(DIR, 'bruto'), { recursive: true });
const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const SALA = { v: 1, pared: 'yeso', suelo: 'tablas', items: [{ uid: 1, id: 'sillon', tono: 1, x: 4, y: 6, rot: 2 }, { uid: 2, id: 'mesa-baja', x: 4, y: 4, rot: 0, tono: 0 }, { uid: 3, id: 'estanteria', x: 2, y: 0, rot: 0, tono: 0 }, { uid: 4, id: 'escritorio', x: 0, y: 3, rot: 3, tono: 0 }] };
const pad = (n) => String(n).padStart(2, '0');
const AHORA = new Date();
const mesRel = (by) => {
  const d = new Date(AHORA.getFullYear(), AHORA.getMonth() + by, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const PASADO = mesRel(-1);
const COLORES = ['#8a3b3b', '#3b6b8a', '#6b8a3b', '#8a6b3b', '#5b3b8a', '#3b8a7a'];
const svg = (i) => `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="540"><rect width="360" height="540" fill="${COLORES[i % 6]}"/><rect x="24" y="24" width="312" height="492" fill="none" stroke="#f4e6c8" stroke-width="6"/><text x="180" y="280" fill="#f4e6c8" font-family="serif" font-size="46" text-anchor="middle">Prueba ${i + 1}</text></svg>`;
const ESTADOS = ['read', 'reading', 'want', 'read', 'abandoned'];
const portada = (i) => `https://covers.openlibrary.org/b/id/${500 + i}-M.jpg`;

/** Biblioteca variada: cada libro con un estado distinto. */
const mezcla = (n) =>
  Array.from({ length: n }, (_, i) => ({ id: `m-${i}`, title: `Título de prueba ${pad(i + 1)}`, author: `Autoría ${(i % 7) + 1}`, status: ESTADOS[i % 5], pageCount: 300, currentPage: ESTADOS[i % 5] === 'read' ? 300 : 40, cover: portada(i), addedAt: `2026-01-${pad((i % 27) + 1)}T10:00:00.000Z`, finishedAt: ESTADOS[i % 5] === 'read' ? `2026-02-${pad((i % 27) + 1)}T10:00:00.000Z` : null, quotes: [] }));
/** Los terminados del mes anterior. */
const delMes = (n) =>
  Array.from({ length: n }, (_, i) => ({ id: `p-${i}`, title: `Libro de prueba ${i + 1}`, author: 'Autoría de prueba', status: 'read', pageCount: 300, currentPage: 300, cover: portada(i), addedAt: `${PASADO}-01T10:00:00.000Z`, finishedAt: `${PASADO}-${pad((i % 27) + 1)}T10:00:00.000Z`, quotes: [] }));
const sesion = (id, date, pages, bookId = 'p-0') => ({ id, bookId, date, createdAt: `${date}T10:00:00.000Z`, kind: 'read', unit: 'pages', mode: 'added', from: 0, to: pages, pages, delta: pages, total: 300, active: true, source: 'form' });
const base = (books, log = [], notes, settings = {}) => ({ version: 8, books, settings: { sound: false, sfx: false, onboardingDone: true, ...settings }, progress: { readingLog: log, pomodoros: [], claimed: {}, ...(notes ? { monthNotes: notes } : null) } });

async function abrir(browser, biblioteca, { w = 390, h = 844, webkit = false, grabar = false, rutas } = {}) {
  const context = await browser.newContext({ baseURL: 'http://localhost:5196', locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: w, height: h }, deviceScaleFactor: 2, acceptDownloads: true, ...(webkit ? {} : { isMobile: true, hasTouch: true }), ...(grabar ? { recordVideo: { dir: join(DIR, 'bruto'), size: { width: 390, height: 844 } } } : null) });
  const page = await context.newPage();
  await page.route(/covers\.openlibrary\.org/, async (route) => {
    const n = Number(/id\/(\d+)/.exec(route.request().url())?.[1] ?? 0) - 500;
    const modo = rutas?.(n);
    if (modo === 'colgada') return undefined;
    if (modo === 'rota') return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: svg(n) });
  });
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana de prueba', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout: SALA });
  mock.db.libraries.push({ user_id: ANA.id, data: biblioteca, updated_at: new Date().toISOString(), version: 5 });
  await page.addInitScript((datos) => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!localStorage.getItem('bookshelf:v1')) localStorage.setItem('bookshelf:v1', JSON.stringify(datos));
  }, biblioteca);
  await mock.attach(page, ANA);
  await entrar(page);
  return { context, page };
}
async function entrar(page) {
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(800);
}
const menu = (page) => page.getByRole('button', { name: 'Menú de accesos' });
async function biblioteca(page) {
  await menu(page).click();
  await page.getByRole('button', { name: 'Mi biblioteca', exact: true }).click();
  await expect(page.locator('.plab-library')).toBeVisible();
  await page.waitForTimeout(400);
}
async function alMes(page, yaAbierto = false) {
  if (!yaAbierto) {
    await menu(page).click();
    await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible({ timeout: 12000 });
  await page.getByRole('button', { name: 'Calendario' }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Tu mes en libros' }).click();
  await page.locator('.mb__mes').getByRole('button', { name: 'Mes anterior' }).click();
  await page.waitForTimeout(600);
}
const tab = (page, name) => page.getByRole('tab', { name, exact: true });
const lista = (page) => page.locator('.plab-library__list');
const noche = (page) => page.evaluate(() => { document.documentElement.dataset.uiTheme = 'noche'; });
const sinDesborde = (loc) => loc.evaluate((n) => n.scrollWidth <= n.clientWidth);

async function vistaPrevia(page) {
  await page.getByRole('button', { name: 'Guardar o compartir resumen' }).click();
  const d = page.getByRole('dialog', { name: 'Vista previa del resumen' });
  await expect(d).toHaveAttribute('data-estado', /ready|error/, { timeout: 25000 });
  return d;
}
/** Descarga las tarjetas y devuelve el ancho y alto real de cada PNG. */
async function descargar(page, d, nombre) {
  const descargas = [];
  page.on('download', (x) => descargas.push(x));
  await d.getByRole('button', { name: /Guardar im/ }).click();
  await page.waitForTimeout(600 + (await d.locator('.rx__vista img').count()) * 600);
  const medidas = [];
  for (const [k, x] of descargas.entries()) {
    const ruta = join(DIR, 'tarjetas', `${nombre}-${k + 1}.png`);
    mkdirSync(join(DIR, 'tarjetas'), { recursive: true });
    await x.saveAs(ruta);
    const b = readFileSync(ruta);
    medidas.push([b.readUInt32BE(16), b.readUInt32BE(20)]);
  }
  return medidas;
}
const dos = (info) => test.skip(!/^(chromium|webkit)-390x844$/.test(info.project.name), 'A 390');
const uno = (info) => test.skip(info.project.name !== 'chromium-390x844', 'Chromium a 390');

test('biblioteca: filtros, orden, vistas y regreso con posición', async ({ browser }, info) => {
  dos(info);
  test.setTimeout(120000);
  const books = mezcla(24);
  const { context, page } = await abrir(browser, base(books, [], undefined, { roomExhibit: ['m-0', 'm-3'] }), { webkit: info.project.name.startsWith('webkit') });
  await biblioteca(page);
  await expect(page.getByRole('heading', { name: 'Biblioteca' })).toBeVisible();
  await expect(page.locator('.plab-library').getByRole('button', { name: /^Volver/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Añadir libro' })).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.plab-filter')).toHaveCount(5);
  for (const f of await page.locator('.plab-filter').all()) await expect(f).toBeInViewport({ ratio: 1 });
  expect(new Set(await page.locator('.plab-filter').evaluateAll((l) => l.map((n) => getComputedStyle(n).backgroundColor))).size).toBe(5);
  const anchos = await page.locator('.lit-libro').evaluateAll((l) => l.slice(0, 3).map((n) => n.getBoundingClientRect().width));
  expect(anchos[0]).toBeGreaterThan(100);
  await page.screenshot({ path: join(DIR, `${info.project.name}-biblioteca-dia.png`) });
  // Cada filtro cuenta lo suyo
  for (const [id, cuantos] of [['reading', 5], ['want', 5], ['read', 10], ['abandoned', 4]]) {
    await page.locator(`.plab-filter[data-filtro="${id}"]`).click();
    await expect(page.locator('.plab-library__count')).toContainText(String(cuantos));
  }
  await page.locator('.plab-filter[data-filtro="all"]').click();
  // Búsqueda
  await page.locator('.plab-library__search input').fill('prueba 07');
  await expect(page.locator('.lit-libro')).toHaveCount(1, { timeout: 4000 });
  await page.locator('.plab-library__search input').fill('');
  // Orden y expuestos en el embudo
  await page.getByRole('button', { name: 'Filtros y orden' }).click();
  await page.locator('.lit-opciones select').selectOption('author');
  await expect.poll(() => page.locator('.lit-libro').first().getAttribute('aria-label')).toContain('Autoría 1');
  await page.locator('.lit-opciones select').selectOption('title');
  await page.getByLabel('Solo los expuestos en la habitación').check();
  await expect(page.locator('.lit-libro')).toHaveCount(2);
  await page.getByRole('button', { name: 'Quitar el filtro Expuestos' }).click();
  await page.getByRole('button', { name: 'Filtros y orden' }).click();
  // Lista
  await page.getByRole('button', { name: 'Ver lista' }).click();
  await expect(page.locator('.plab-row').first()).toBeVisible();
  await page.screenshot({ path: join(DIR, `${info.project.name}-biblioteca-lista.png`) });
  await page.getByRole('button', { name: 'Ver portadas' }).click();
  // Abrir ficha y volver a la misma posición, con el mismo filtro
  await page.locator('.plab-filter[data-filtro="read"]').click();
  await page.locator('.plab-filter[data-filtro="all"]').click();
  await page.waitForTimeout(200);
  await lista(page).evaluate((n) => n.scrollTo(0, 320));
  await page.waitForTimeout(400);
  // El clic automático puede mover la lista para centrar el libro: la posición que debe volver es la del momento de tocarlo
  const libro = page.locator('.lit-libro:visible').nth(4);
  await libro.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const top = await lista(page).evaluate((n) => n.scrollTop);
  expect(top).toBeGreaterThan(100);
  await libro.click();
  await expect(page.locator('.lit-ficha')).toBeVisible({ timeout: 8000 });
  await page.locator('.lit-ficha').getByRole('button', { name: 'Volver' }).click();
  await expect(page.locator('.plab-library')).toBeVisible();
  await page.waitForTimeout(500);
  expect(Math.abs((await lista(page).evaluate((n) => n.scrollTop)) - top)).toBeLessThanOrEqual(2);
  expect(await sinDesborde(page.locator('.plab-library'))).toBe(true);
  await context.close();
});

for (const [n, nombre] of [[0, 'vacia'], [1, 'uno'], [5000, 'cinco-mil']]) {
  test(`biblioteca con ${n} libros`, async ({ browser }, info) => {
    uno(info);
    test.setTimeout(150000);
    const { context, page } = await abrir(browser, base(mezcla(n)));
    await biblioteca(page);
    if (n === 0) await expect(page.locator('.plab-library__count')).toContainText('Aún no hay libros');
    if (n === 5000) {
      await page.waitForTimeout(1500);
      const montados = await page.locator('.plab-library img').count();
      expect(montados).toBeLessThanOrEqual(36);
      await lista(page).evaluate((b) => b.scrollTo(0, 3000));
      await page.waitForTimeout(500);
      expect(await page.locator('.lit-libro').count()).toBeLessThanOrEqual(36);
      await page.locator('.plab-filter[data-filtro="read"]').click();
      await page.getByRole('button', { name: 'Ver lista' }).click();
      await page.waitForTimeout(400);
      expect(await page.locator('.plab-row').count()).toBeLessThanOrEqual(40);
    }
    await page.screenshot({ path: join(DIR, `biblioteca-${nombre}.png`) });
    await context.close();
  });
}

test('biblioteca a 320, escritorio, noche y texto al 200 %', async ({ browser }, info) => {
  uno(info);
  test.setTimeout(120000);
  let s = await abrir(browser, base(mezcla(12)), { w: 320, h: 640 });
  await biblioteca(s.page);
  expect(await s.page.locator('.lit-libro').evaluateAll((l) => l.filter((n) => Math.abs(n.getBoundingClientRect().top - l[0].getBoundingClientRect().top) < 2).length)).toBe(2);
  expect(await sinDesborde(s.page.locator('.plab-library'))).toBe(true);
  await s.page.screenshot({ path: join(DIR, 'biblioteca-320.png') });
  await s.context.close();
  s = await abrir(browser, base(mezcla(30)), { w: 1440, h: 900 });
  await biblioteca(s.page);
  await s.page.screenshot({ path: join(DIR, 'biblioteca-escritorio.png') });
  await s.context.close();
  s = await abrir(browser, base(mezcla(12)));
  await noche(s.page);
  await biblioteca(s.page);
  await s.page.screenshot({ path: join(DIR, 'biblioteca-noche.png') });
  const contrastes = await s.page.locator('.plab-filter').evaluateAll((l) => {
    const rgb = (t) => t.match(/[\d.]+/g).slice(0, 3).map(Number);
    const lum = (c) => {
      const [r, g, b] = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    return l.map((n) => { const a = lum(rgb(getComputedStyle(n).color)); const b = lum(rgb(getComputedStyle(n).backgroundColor)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); });
  });
  expect(Math.min(...contrastes)).toBeGreaterThanOrEqual(4.5);
  await s.page.addStyleTag({ content: 'html{font-size:200%} .bs-literary, .bs-literary *{font-size:calc(1em * 1.0)} .bs-literary .color-tab, .bs-literary p{font-size:30px !important; line-height:1.4 !important}' });
  await s.page.waitForTimeout(300);
  for (const f of await s.page.locator('.plab-filter').all()) expect(await f.evaluate((n) => n.scrollWidth <= n.clientWidth + 1)).toBe(true);
  expect(await sinDesborde(s.page.locator('.plab-library'))).toBe(true);
  await s.page.screenshot({ path: join(DIR, 'biblioteca-texto200.png') });
  await s.context.close();
});

test('ficha: pestañas, cambios que se quedan, menú y portada ausente', async ({ browser }, info) => {
  dos(info);
  test.setTimeout(120000);
  const books = [{ ...mezcla(2)[1], id: 'f', title: 'Un título larguísimo de datos de prueba que debe caber entero sin romper la cabecera de la ficha', cover: '', pageCount: null, currentPage: 0, quotes: [] }, ...mezcla(4).slice(2)];
  const { context, page } = await abrir(browser, base(books, [sesion('h', `${PASADO}-03`, 30, 'f')]), { webkit: info.project.name.startsWith('webkit') });
  await biblioteca(page);
  await page.locator('.lit-libro[data-book="f"]').click();
  const f = page.locator('.lit-ficha');
  await expect(f).toBeVisible({ timeout: 8000 });
  expect(await sinDesborde(f.locator('.lit-ficha__cuerpo'))).toBe(true);
  await expect(f.getByText('Mi recorrido')).toBeVisible();
  await page.screenshot({ path: join(DIR, `${info.project.name}-ficha-lectura.png`) });
  for (const t of ['Notas y citas', 'Reseña', 'Mi lectura']) {
    await tab(page, t).click();
    await expect(tab(page, t)).toHaveAttribute('aria-selected', 'true');
    await page.screenshot({ path: join(DIR, `${info.project.name}-ficha-${t.split(' ')[0]}.png`) });
  }
  // Teclado no: el estado cambia y aguanta una recarga
  await f.getByLabel('Estado de lectura').selectOption('abandoned');
  await page.waitForTimeout(1200);
  await f.getByRole('button', { name: 'Más acciones' }).click();
  await expect(page.getByRole('button', { name: 'Quitar de la librería' })).toBeVisible();
  await page.getByRole('button', { name: 'Quitar de la librería' }).click();
  await expect(page.getByText('¿Sacarlo de tu librería?')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await f.getByRole('button', { name: 'Más acciones' }).click();
  await f.locator('details', { hasText: 'Sobre el libro' }).locator('summary').click();
  await expect(f.getByText('Sin sinopsis todavía.')).toBeVisible();
  // Al recargar, la ficha vuelve abierta, encima del piso y con el cambio guardado
  await entrar(page);
  await expect(page.locator('.lit-ficha').getByLabel('Estado de lectura')).toHaveValue('abandoned', { timeout: 10000 });
  await page.locator('.lit-ficha').getByRole('button', { name: 'Volver' }).click({ timeout: 8000 });
  await expect(page.locator('.lit-ficha')).toBeHidden();
  await context.close();
});

test('ranking: elegir, ordenar, quitar, recargar y resto', async ({ browser }, info) => {
  dos(info);
  test.setTimeout(150000);
  const { context, page } = await abrir(browser, base(delMes(7), [sesion('a', `${PASADO}-03`, 30)]), { webkit: info.project.name.startsWith('webkit') });
  await alMes(page);
  await expect(page.locator('.mb-podio')).toHaveCount(0);
  await expect(page.locator('.mb__libro')).toHaveCount(7);
  await page.getByRole('button', { name: 'Elegir mis favoritos' }).click();
  await expect(tab(page, 'Favoritos')).toHaveAttribute('aria-selected', 'true');
  for (const n of [5, 2, 7]) {
    await page.getByRole('button', { name: new RegExp(`^Libro de prueba ${n},`) }).click();
    await page.waitForTimeout(250);
  }
  await expect(page.locator('.mb__estadoguardar').first()).toContainText('Guardado', { timeout: 6000 });
  const orden = () => page.locator('.mb-podio li').evaluateAll((l) => l.map((n) => n.getAttribute('aria-label').split(',')[0]));
  // Subir y sin duplicados
  await page.getByRole('button', { name: 'Subir Libro de prueba 2' }).click();
  await page.waitForTimeout(250);
  // Elegir uno que ya está lo intercambia
  await page.getByRole('button', { name: /Puesto 1: Libro de prueba 2/ }).click();
  await page.getByRole('button', { name: /^Libro de prueba 7, de/ }).click();
  await page.waitForTimeout(400);
  await tab(page, 'Resumen').click();
  expect(await orden()).toEqual(['Puesto 1: Libro de prueba 7', 'Puesto 2: Libro de prueba 5', 'Puesto 3: Libro de prueba 2']);
  await expect(page.locator('.mb__libro')).toHaveCount(4);
  await page.screenshot({ path: join(DIR, `${info.project.name}-podio-3.png`) });
  // Geometría: 2 a la izquierda, 1 al centro y más alto, 3 a la derecha
  const cajas = await page.locator('.mb-podio__libro').evaluateAll((l) => l.map((n) => { const r = n.getBoundingClientRect(); return { x: r.left, b: r.bottom }; }));
  expect(cajas[1].x).toBeLessThan(cajas[0].x);
  expect(cajas[0].x).toBeLessThan(cajas[2].x);
  expect(cajas[0].b).toBeLessThan(cajas[1].b);
  expect(cajas[1].b).toBeLessThan(cajas[2].b);
  // Recuerdo y recarga: el ejemplo es solo un placeholder
  await tab(page, 'Recuerdo').click();
  await expect(page.locator('#mb-recuerdo')).toHaveValue('');
  await expect(page.getByLabel('¿Qué te llevas de este mes?')).toHaveAttribute('placeholder', /.+/);
  await page.locator('#mb-recuerdo').fill('Datos de prueba: un otoño de mucha lluvia.');
  await page.locator('#mb-recuerdo').blur();
  await expect(page.getByText('Recuerdo guardado.')).toBeVisible({ timeout: 6000 });
  // Al recargar vuelve el escritorio del ordenador, encima del piso
  await entrar(page);
  await alMes(page, true);
  expect(await orden()).toEqual(['Puesto 1: Libro de prueba 7', 'Puesto 2: Libro de prueba 5', 'Puesto 3: Libro de prueba 2']);
  await expect(page.locator('.mb__frase')).toContainText('otoño');
  await tab(page, 'Recuerdo').click();
  await expect(page.locator('#mb-recuerdo')).toHaveValue('Datos de prueba: un otoño de mucha lluvia.');
  await expect(page.getByText('Recuerdo guardado.')).toBeVisible();
  // Quitar compacta
  await tab(page, 'Favoritos').click();
  await page.getByRole('button', { name: 'Quitar Libro de prueba 7' }).click();
  await page.waitForTimeout(300);
  await tab(page, 'Resumen').click();
  expect(await orden()).toEqual(['Puesto 1: Libro de prueba 5', 'Puesto 2: Libro de prueba 2']);
  await page.screenshot({ path: join(DIR, `${info.project.name}-podio-2.png`) });
  await expect.poll(() => page.evaluate((m) => JSON.parse(localStorage.getItem('bookshelf:v1')).progress.monthNotes[m].favorites, PASADO)).toEqual(['p-4', 'p-1']);
  // Capturas a 390 px de Favoritos (con un puesto libre) y Recuerdo, de día y de noche
  await page.setViewportSize({ width: 390, height: 1180 });
  for (const tema of ['dia', 'noche']) {
    if (tema === 'noche') await noche(page);
    for (const t of ['Favoritos', 'Recuerdo']) {
      await tab(page, t).click();
      await page.waitForTimeout(250);
      await page.screenshot({ path: join(DIR, `${info.project.name}-mes-${t}-${tema}.png`) });
    }
  }
  await tab(page, 'Favoritos').click();
  await expect(page.getByText('Elige tu tercer favorito')).toBeVisible();
  const justos = await page.locator('#mb-panel-favoritos').evaluate((n) => [...n.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().height < 43.5).map((b) => b.getAttribute('aria-label')));
  expect(justos).toEqual([]);
  await context.close();
});

test('ranking: favorito antiguo, inválido, uno y error al guardar', async ({ browser }, info) => {
  uno(info);
  test.setTimeout(90000);
  const { context, page } = await abrir(browser, base(delMes(3), [], { [PASADO]: { favorite: 'p-1' } }));
  await alMes(page);
  await expect(page.locator('.mb-podio li')).toHaveCount(1);
  await expect(page.locator('.mb-podio li')).toHaveAttribute('aria-label', /Puesto 1: Libro de prueba 2/);
  await expect(page.locator('.mb__libro')).toHaveCount(2);
  await page.screenshot({ path: join(DIR, 'podio-1.png') });
  await tab(page, 'Favoritos').click();
  await page.evaluate(() => {
    const o = Storage.prototype.setItem;
    window.__o = o;
    Storage.prototype.setItem = function (k, v) {
      if (k.startsWith('bookshelf:v1')) throw new DOMException('lleno', 'QuotaExceededError');
      return o.call(this, k, v);
    };
  });
  await page.getByRole('button', { name: /^Libro de prueba 3,/ }).click();
  await expect(page.getByText('No se ha podido guardar tu ranking.')).toBeVisible({ timeout: 8000 });
  await page.screenshot({ path: join(DIR, 'ranking-error.png') });
  await page.evaluate(() => { Storage.prototype.setItem = window.__o; });
  await page.locator('.mb__estadoguardar').getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.locator('.mb__estadoguardar').first()).toContainText('Guardado', { timeout: 8000 });
  await context.close();
  const b = await abrir(browser, base(delMes(2), [], { [PASADO]: { favorites: ['ya-no-existe', 'p-1'] } }));
  await alMes(b.page);
  await expect(b.page.locator('.mb-podio li')).toHaveCount(1);
  await expect(b.page.locator('.mb-podio li')).toHaveAttribute('aria-label', /Puesto 1: Libro de prueba 2/);
  await b.page.getByRole('tab', { name: 'Favoritos' }).click();
  await expect(b.page.getByText('ya no consta como terminado')).toBeVisible();
  await b.context.close();
});

const CASOS = [
  [0, 0, false, 1],
  [1, 1, false, 1],
  [7, 3, true, 1],
  [13, 3, true, 2],
  [13, 0, true, 2],
  [30, 3, true, 4],
];
for (const [n, elegidos, frase, tarjetas] of CASOS) {
  test(`exportar: ${n} terminados, ${elegidos} en el podio`, async ({ browser }, info) => {
    uno(info);
    test.setTimeout(90000);
    const notes = { [PASADO]: { ...(elegidos ? { favorites: ['p-3', 'p-0', 'p-1'].slice(0, elegidos) } : null), ...(frase ? { quote: 'Datos de prueba: un otoño de mucha lluvia, té y páginas hasta las tantas de la madrugada.' } : null) } };
    const books = n ? delMes(n) : [{ id: 'x', title: 'Libro empezado', author: 'Prueba', status: 'reading', pageCount: 300, currentPage: 25, cover: '', quotes: [] }];
    const { context, page } = await abrir(browser, base(books, n ? [sesion('a', `${PASADO}-03`, 30)] : [sesion('a', `${PASADO}-03`, 25, 'x')], notes));
    await alMes(page);
    const d = await vistaPrevia(page);
    await expect(d).toHaveAttribute('data-estado', 'ready');
    await expect(d.locator('.rx__vista img')).toHaveCount(tarjetas);
    const medidas = await descargar(page, d, `${n}-libros-${elegidos}-podio`);
    expect(medidas).toEqual(Array(tarjetas).fill([1080, 1920]));
    await context.close();
  });
}

test('exportar: portada rota y colgada, reabrir y sustitutas', async ({ browser }, info) => {
  uno(info);
  test.setTimeout(120000);
  const { context, page } = await abrir(browser, base(delMes(8), [], { [PASADO]: { favorites: ['p-3', 'p-0'] } }), { rutas: (n) => (n === 1 ? 'rota' : n === 2 ? 'colgada' : 'ok') });
  await alMes(page);
  const t0 = Date.now();
  let d = await vistaPrevia(page);
  const primera = Date.now() - t0;
  await expect(d).toHaveAttribute('data-estado', 'ready');
  expect(primera).toBeLessThan(9000);
  await expect(d.getByText(/2 portadas no se han podido usar/)).toBeVisible();
  const etapas = JSON.parse(await d.getAttribute('data-etapas'));
  // Cerrar a mitad y reabrir: el fallo reciente no se vuelve a esperar
  await page.keyboard.press('Escape');
  await expect(d).toBeHidden();
  const t1 = Date.now();
  d = await vistaPrevia(page);
  const segunda = Date.now() - t1;
  expect(segunda).toBeLessThan(2500);
  writeFileSync(join(DIR, 'export-despues.json'), JSON.stringify({ primeraMs: primera, reabrirMs: segunda, etapas }, null, 2));
  await page.screenshot({ path: join(DIR, 'export-portadas-fallidas.png') });
  await page.keyboard.press('Escape');
  // Cerrar mientras prepara no deja nada a medias
  await page.getByRole('button', { name: 'Guardar o compartir resumen' }).click();
  await page.keyboard.press('Escape');
  d = await vistaPrevia(page);
  await expect(d).toHaveAttribute('data-estado', 'ready');
  await context.close();
});

test('exportar: con todas colgadas hay salida a los 15 s', async ({ browser }, info) => {
  uno(info);
  test.setTimeout(90000);
  const { context, page } = await abrir(browser, base(delMes(24)), { rutas: () => 'colgada' });
  await alMes(page);
  // El límite por portada (6 s) con 6 a la vez deja 4 tandas: 24 s, así que salta el límite global
  const t0 = Date.now();
  const d = await vistaPrevia(page);
  await expect(d).toHaveAttribute('data-estado', 'error');
  expect(Date.now() - t0).toBeLessThan(17000);
  await page.screenshot({ path: join(DIR, 'export-limite.png') });
  await d.getByRole('button', { name: 'Generar con portadas sustitutas' }).click();
  await expect(d).toHaveAttribute('data-estado', 'ready', { timeout: 10000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(DIR, 'export-sustitutas.png') });
  await context.close();
});

test('resumen a 320, noche y teclado', async ({ browser }, info) => {
  uno(info);
  test.setTimeout(90000);
  const notes = { [PASADO]: { favorites: ['p-0', 'p-1', 'p-2'], quote: 'Datos de prueba' } };
  let s = await abrir(browser, base(delMes(9), [], notes), { w: 320, h: 640 });
  await alMes(s.page);
  await expect(s.page.locator('.mb-podio li')).toHaveCount(3);
  expect(await sinDesborde(s.page.locator('.pc-win:not([hidden]) .pc-win__body'))).toBe(true);
  await s.page.screenshot({ path: join(DIR, 'resumen-320.png') });
  await s.context.close();
  s = await abrir(browser, base(delMes(9), [], notes));
  await noche(s.page);
  await alMes(s.page);
  await s.page.screenshot({ path: join(DIR, 'resumen-noche.png') });
  await tab(s.page, 'Favoritos').focus();
  await s.page.keyboard.press('Enter');
  await expect(tab(s.page, 'Favoritos')).toHaveAttribute('aria-selected', 'true');
  await s.page.screenshot({ path: join(DIR, 'favoritos-noche.png') });
  await s.context.close();
});
