// Acabado visual v4: la muestra del paquete frente a la app, con los mismos libros y las portadas del paquete servidas solo dentro de la prueba.
// Las portadas de ejemplo no se copian al proyecto ni a ninguna biblioteca real. La ruta del paquete se indica con ACABADO_V4.
import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMockSupabase } from './mockSupabase';

const PAQUETE = process.env.ACABADO_V4;
const DIR = join('qa-report', 'acabado-v4');
mkdirSync(join(DIR, 'bruto'), { recursive: true });
const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const SALA = { v: 1, pared: 'yeso', suelo: 'tablas', items: [{ uid: 1, id: 'sillon', tono: 1, x: 4, y: 6, rot: 2 }, { uid: 2, id: 'mesa-baja', x: 4, y: 4, rot: 0, tono: 0 }, { uid: 3, id: 'estanteria', x: 2, y: 0, rot: 0, tono: 0 }, { uid: 4, id: 'escritorio', x: 0, y: 3, rot: 3, tono: 0 }] };
const pad = (n) => String(n).padStart(2, '0');
const hoy = new Date();
const d = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
const PASADO = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const LIBROS = [
  ['circe', 'Circe', 'Madeline Miller'],
  ['castle', 'Howl’s Moving Castle', 'Diana Wynne Jones'],
  ['hobbit', 'The Hobbit', 'J. R. R. Tolkien'],
  ['prince', 'The Little Prince', 'Antoine de Saint-Exupéry'],
  ['mistborn', 'Mistborn', 'Brandon Sanderson'],
  ['1984', '1984', 'George Orwell'],
  ['wind', 'The Name of the Wind', 'Patrick Rothfuss'],
];
const url = (id) => `https://covers.openlibrary.org/b/id/${id}-L.jpg`;
const terminado = ([id, title, author], i) => ({ id, title, author, status: 'read', pageCount: 400, currentPage: 400, cover: url(id), addedAt: `${PASADO}-01T10:00:00.000Z`, finishedAt: `${PASADO}-${pad(i + 2)}T10:00:00.000Z`, quotes: [] });
const sesion = (id, date, pages, bookId) => ({ id, bookId, date, createdAt: `${date}T10:00:00.000Z`, kind: 'read', unit: 'pages', mode: 'added', from: 0, to: pages, pages, delta: pages, total: 420, active: true, source: 'form' });
const LOG = [sesion('a', `${PASADO}-03`, 240, 'castle'), sesion('b', `${PASADO}-09`, 180, 'hobbit')];
const base = (books, log, notes) => ({ version: 8, books, settings: { sound: false, sfx: false, onboardingDone: true, roomExhibit: ['hobbit'] }, progress: { readingLog: log, pomodoros: [], claimed: {}, ...(notes ? { monthNotes: notes } : null) } });
const conCirce = () => {
  const books = LIBROS.map(terminado);
  books[0] = { ...books[0], status: 'reading', currentPage: 184, pageCount: 420, finishedAt: null, synopsis: 'Datos de prueba: sinopsis de la edición.' };
  return books;
};

async function abrir(browser, biblioteca, { grabar = false, noche = false } = {}) {
  const context = await browser.newContext({ baseURL: 'http://localhost:5196', locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true, isMobile: true, hasTouch: true, ...(grabar ? { recordVideo: { dir: join(DIR, 'bruto'), size: { width: 390, height: 844 } } } : null) });
  const page = await context.newPage();
  await page.route(/covers\.openlibrary\.org/, (route) => {
    const id = /id\/([^-]+)-/.exec(route.request().url())[1];
    return route.fulfill({ status: 200, contentType: 'image/jpeg', headers: { 'access-control-allow-origin': '*' }, body: readFileSync(join(PAQUETE, 'assets', 'covers', `${id}.jpg`)) });
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
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(800);
  if (noche) await page.evaluate(() => { document.documentElement.dataset.uiTheme = 'noche'; });
  return { context, page };
}
const menu = (page) => page.getByRole('button', { name: 'Menú de accesos' });
async function biblioteca(page) {
  await menu(page).click();
  await page.getByRole('button', { name: 'Mi biblioteca', exact: true }).click();
  await expect(page.locator('.plab-library')).toBeVisible();
  await page.waitForTimeout(900);
}
async function alMes(page) {
  await menu(page).click();
  await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible({ timeout: 12000 });
  await page.getByRole('button', { name: 'Calendario' }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Tu mes en libros' }).click();
  await page.locator('.mb__mes').getByRole('button', { name: 'Mes anterior' }).click();
  await page.waitForTimeout(900);
}
const tab = (page, name) => page.getByRole('tab', { name, exact: true });
const NOTA = { [PASADO]: { favorites: ['circe', 'castle', 'hobbit'], quote: 'Un mes de mundos a los que volvería.' } };
const uno = (info) => test.skip(info.project.name !== 'chromium-390x844' || !PAQUETE, 'Chromium a 390 y ACABADO_V4');

test('la muestra del paquete: imágenes, 320 px y tarjeta', async ({ browser }, info) => {
  uno(info);
  const context = await browser.newContext({ viewport: { width: 1290, height: 1000 } });
  const page = await context.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  const dir = pathToFileURL(join(PAQUETE, 'muestra.html')).href;
  await page.goto(dir);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  expect(await page.evaluate(() => [...document.images].filter((i) => i.offsetParent && !i.naturalWidth).map((i) => i.src))).toEqual([]);
  for (const id of ['library', 'detail', 'wrap']) await page.locator(`#${id}`).screenshot({ path: join(DIR, `muestra-${id}-dia.png`) });
  await page.locator('#theme').click();
  for (const id of ['library', 'detail', 'wrap']) await page.locator(`#${id}`).screenshot({ path: join(DIR, `muestra-${id}-noche.png`) });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.goto(`${dir}?export=1`);
  await page.setViewportSize({ width: 1080, height: 1920 });
  const tam = await page.locator('.export').evaluate((e) => ({ alto: e.clientHeight, scroll: e.scrollHeight }));
  await page.locator('.export').screenshot({ path: join(DIR, 'muestra-tarjeta.png') });
  writeFileSync(join(DIR, 'muestra-validacion.json'), JSON.stringify({ errores, tarjeta: tam }, null, 2));
  expect(errores).toEqual([]);
  await context.close();
});

for (const noche of [false, true]) {
  const m = noche ? 'noche' : 'dia';
  test(`la app con los mismos libros (${m})`, async ({ browser }, info) => {
    uno(info);
    test.setTimeout(120000);
    let s = await abrir(browser, base(conCirce(), [sesion('c', `${PASADO}-20`, 24, 'circe')]), { noche });
    await biblioteca(s.page);
    await s.page.screenshot({ path: join(DIR, `app-library-${m}.png`) });
    await s.page.locator('.lit-libro[data-book="circe"]').click();
    await expect(s.page.locator('.lit-ficha')).toBeVisible({ timeout: 8000 });
    await s.page.waitForTimeout(1000);
    await s.page.screenshot({ path: join(DIR, `app-detail-${m}.png`) });
    await s.page.locator('.lit-ficha__cuerpo').evaluate((n) => n.scrollTo(0, n.scrollHeight));
    await s.page.waitForTimeout(300);
    await s.page.screenshot({ path: join(DIR, `app-detail-final-${m}.png`) });
    await s.context.close();
    s = await abrir(browser, base(LIBROS.map(terminado), LOG, NOTA), { noche });
    await alMes(s.page);
    await s.page.screenshot({ path: join(DIR, `app-wrap-${m}.png`) });
    await s.page.locator('.pc-win:not([hidden]) .pc-win__body').evaluate((n) => n.scrollTo(0, n.scrollHeight));
    await s.page.waitForTimeout(300);
    await s.page.screenshot({ path: join(DIR, `app-wrap-final-${m}.png`) });
    await tab(s.page, 'Favoritos').click();
    await s.page.waitForTimeout(300);
    await s.page.screenshot({ path: join(DIR, `app-favoritos-${m}.png`) });
    await s.context.close();
  });
}

test('vídeo 1: biblioteca, ficha, pestañas y regreso', async ({ browser }, info) => {
  uno(info);
  test.setTimeout(150000);
  const { context, page } = await abrir(browser, base(conCirce(), [sesion('c', `${PASADO}-20`, 24, 'circe')]), { grabar: true });
  await biblioteca(page);
  await page.waitForTimeout(3200);
  for (const f of ['reading', 'want', 'read', 'abandoned', 'all']) {
    await page.locator(`.plab-filter[data-filtro="${f}"]`).click();
    await page.waitForTimeout(1500);
  }
  await page.getByRole('button', { name: 'Filtros y orden' }).click();
  await page.waitForTimeout(1500);
  await page.locator('.lit-opciones select').selectOption('author');
  await page.waitForTimeout(1600);
  await page.getByLabel('Solo los expuestos en la habitación').check();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Quitar el filtro Expuestos' }).click();
  await page.locator('.lit-opciones select').selectOption('title');
  await page.getByRole('button', { name: 'Filtros y orden' }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Ver lista' }).click();
  await page.waitForTimeout(2400);
  await page.getByRole('button', { name: 'Ver portadas' }).click();
  await page.waitForTimeout(1500);
  await page.locator('.lit-libro[data-book="circe"]').click();
  await expect(page.locator('.lit-ficha')).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(3500);
  for (const t of ['Notas y citas', 'Reseña', 'Mi lectura']) {
    await tab(page, t).click();
    await page.waitForTimeout(2400);
  }
  await page.locator('.lit-ficha__cuerpo').evaluate((n) => n.scrollTo({ top: n.scrollHeight, behavior: 'smooth' }));
  await page.waitForTimeout(2600);
  await page.locator('.lit-ficha__cuerpo').evaluate((n) => n.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(1500);
  await page.locator('.lit-ficha').getByRole('button', { name: 'Registrar lectura' }).click();
  await page.waitForTimeout(1800);
  await page.locator('.lit-ficha input[inputmode]').first().pressSequentially('12', { delay: 200 });
  await page.waitForTimeout(1200);
  await page.locator('.lit-ficha').getByRole('button', { name: 'Guardar lectura' }).click();
  await page.waitForTimeout(3200);
  await page.getByRole('button', { name: 'Más acciones' }).click();
  await page.waitForTimeout(2400);
  await page.getByRole('button', { name: 'Más acciones' }).click();
  await page.locator('.lit-ficha').getByRole('button', { name: 'Volver' }).click();
  await page.waitForTimeout(3200);
  const video = page.video();
  await context.close();
  writeFileSync(join(DIR, 'bruto', 'video1.txt'), await video.path());
});

test('vídeo 2: mes, podio, recuerdo y exportación', async ({ browser }, info) => {
  uno(info);
  test.setTimeout(150000);
  const { context, page } = await abrir(browser, base(LIBROS.map(terminado), LOG), { grabar: true });
  await alMes(page);
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: 'Elegir mis favoritos' }).click();
  await page.waitForTimeout(2200);
  for (const n of ['Howl', 'Circe', 'The Hobbit']) {
    await page.getByRole('button', { name: new RegExp(`^${n}.*, de`) }).click();
    await page.waitForTimeout(1900);
  }
  await page.getByRole('button', { name: 'Subir Circe' }).click();
  await page.waitForTimeout(2400);
  await tab(page, 'Resumen').click();
  await page.waitForTimeout(4000);
  await tab(page, 'Recuerdo').click();
  await page.waitForTimeout(1000);
  await page.locator('#mb-recuerdo').pressSequentially('Un mes de mundos a los que volvería.', { delay: 60 });
  await page.locator('#mb-recuerdo').blur();
  await page.waitForTimeout(1800);
  await tab(page, 'Resumen').click();
  await page.waitForTimeout(1800);
  const cuerpo = page.locator('.pc-win:not([hidden]) .pc-win__body');
  await cuerpo.evaluate((n) => n.scrollTo({ top: n.scrollHeight, behavior: 'smooth' }));
  await page.waitForTimeout(2800);
  await page.getByRole('button', { name: 'Guardar o compartir resumen' }).click();
  const dlg = page.getByRole('dialog', { name: 'Vista previa del resumen' });
  await expect(dlg).toHaveAttribute('data-estado', 'ready', { timeout: 20000 });
  await page.waitForTimeout(8500);
  const descargas = [];
  page.on('download', (x) => descargas.push(x));
  await dlg.getByRole('button', { name: /Guardar im/ }).click();
  await page.waitForTimeout(2800);
  expect(descargas).toHaveLength(1);
  const ruta = join(DIR, 'tarjeta-real.png');
  await descargas[0].saveAs(ruta);
  const b = readFileSync(ruta);
  expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([1080, 1920]);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1800);
  const video = page.video();
  await context.close();
  writeFileSync(join(DIR, 'bruto', 'video2.txt'), await video.path());
});
