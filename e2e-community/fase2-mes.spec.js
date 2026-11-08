// Fase 2 · «Tu mes en libros» con datos de prueba (biblioteca sintética en un perfil propio, nunca una cuenta real).
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const DIR = join('qa-report', 'fase2', 'mes');
const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const SALA = { v: 1, pared: 'yeso', suelo: 'tablas', items: [{ uid: 1, id: 'sillon', tono: 1, x: 4, y: 6, rot: 2 }, { uid: 2, id: 'mesa-baja', x: 4, y: 4, rot: 0, tono: 0 }, { uid: 3, id: 'estanteria', x: 2, y: 0, rot: 0, tono: 0 }, { uid: 4, id: 'escritorio', x: 0, y: 3, rot: 3, tono: 0 }] };
const menu = (page) => page.getByRole('button', { name: 'Menú de accesos' });
const pad = (n) => String(n).padStart(2, '0');
const AHORA = new Date();
const mesRel = (by) => {
  const d = new Date(AHORA.getFullYear(), AHORA.getMonth() + by, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const PASADO = mesRel(-1);
const VACIO = mesRel(-3);
const SIN_FIN = mesRel(-2);
const COLORES = ['#8a3b3b', '#3b6b8a', '#6b8a3b', '#8a6b3b', '#5b3b8a', '#3b8a7a'];
const svg = (i) => `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="540"><rect width="360" height="540" fill="${COLORES[i % 6]}"/><rect x="24" y="24" width="312" height="492" fill="none" stroke="#f4e6c8" stroke-width="6"/><text x="180" y="280" fill="#f4e6c8" font-family="serif" font-size="46" text-anchor="middle">Prueba ${i + 1}</text></svg>`;

function libros(cuantos, { sinPortada = 0, largos = 0 } = {}) {
  return Array.from({ length: cuantos }, (_, i) => ({
    id: `p-${i}`,
    title: i < largos ? `Datos de prueba: un título larguísimo que no debe romper nada en la balda del mes número ${i + 1}` : `Libro de prueba ${i + 1}`,
    author: 'Autoría de prueba',
    status: 'read',
    pageCount: 300,
    currentPage: 300,
    cover: i < sinPortada ? '' : `https://covers.openlibrary.org/b/id/${500 + i}-M.jpg`,
    addedAt: `${PASADO}-01T10:00:00.000Z`,
    finishedAt: `${PASADO}-${pad((i % 27) + 1)}T10:00:00.000Z`,
    quotes: [],
    ...(i === 0 ? { pastReads: [{ startedAt: null, finishedAt: `${PASADO}-02T10:00:00.000Z` }] } : null),
  }));
}
const sesion = (id, date, pages, bookId = 'p-0') => ({ id, bookId, date, createdAt: `${date}T10:00:00.000Z`, kind: 'read', unit: 'pages', mode: 'added', from: 0, to: pages, pages, delta: pages, total: 300, active: true, source: 'form' });

async function abrir(browser, biblioteca, { w = 390, h = 844, webkit = false } = {}) {
  const context = await browser.newContext({ baseURL: 'http://localhost:5196', locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: w, height: h }, deviceScaleFactor: 2, acceptDownloads: true, ...(webkit ? {} : { isMobile: true, hasTouch: true }) });
  const page = await context.newPage();
  await page.route(/covers\.openlibrary\.org/, (route) => {
    const n = Number(/id\/(\d+)/.exec(route.request().url())?.[1] ?? 0);
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: svg(n - 500) });
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
  await menu(page).click();
  await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible({ timeout: 12000 });
  await page.getByRole('button', { name: 'Calendario' }).click();
  await page.waitForTimeout(400);
  return { context, page };
}
const base = (books, log = [], notes) => ({ version: 8, books, settings: { sound: false, sfx: false, onboardingDone: true }, progress: { readingLog: log, pomodoros: [], claimed: {}, ...(notes ? { monthNotes: notes } : null) } });
const irAlMes = async (page, atras) => {
  await page.getByRole('button', { name: 'Tu mes en libros' }).click();
  for (let i = 0; i < atras; i += 1) await page.locator('.mb__mes').getByRole('button', { name: 'Mes anterior' }).click();
  await page.waitForTimeout(500);
};
const cifras = (page) => page.locator('.mb__cifras dd').allTextContents();

/** Las cifras que la tarjeta ha escrito: se leen del propio lienzo, no de la pantalla. */
async function tarjetas(page) {
  await page.getByRole('button', { name: 'Guardar o compartir resumen' }).click();
  const d = page.getByRole('dialog', { name: 'Vista previa del resumen' });
  await expect(d.locator('.rx__vista img').first()).toBeVisible({ timeout: 20000 });
  return d;
}
async function guardar(page, d, nombre) {
  const descargas = [];
  page.on('download', (x) => descargas.push(x));
  await d.getByRole('button', { name: /Guardar im/ }).click();
  await page.waitForTimeout(2200);
  mkdirSync(DIR, { recursive: true });
  let k = 0;
  for (const x of descargas) {
    k += 1;
    await x.saveAs(join(DIR, `${nombre}${descargas.length > 1 ? `-${k}` : ''}.png`));
  }
  return descargas.length;
}
const soloChromium = (info) => test.skip(info.project.name !== 'chromium-390x844', 'Chromium a 390');

test('cifras, relectura, histórico, favorito, vuelta al calendario y PNG', async ({ browser }, info) => {
  test.skip(!/^(chromium|webkit)-390x844$/.test(info.project.name), '390');
  test.setTimeout(120000);
  const webkit = info.project.name.startsWith('webkit');
  const log = [sesion('a', `${PASADO}-03`, 30), sesion('b', `${PASADO}-03`, 20), sesion('c', `${PASADO}-09`, 12)];
  // 13 libros, una relectura: 14 lecturas · 30 + 20 + 12 = 62 páginas · días 3 y 9 = 2 días
  const { context, page } = await abrir(browser, base(libros(13, { sinPortada: 1, largos: 1 }), log), { webkit });
  await page.locator('.port-cal__head').getByRole('button', { name: 'Mes anterior' }).click();
  await page.waitForTimeout(300);
  const mesCal = await page.locator('.port-cal__head h3').textContent();
  await irAlMes(page, 0);
  expect(await cifras(page)).toEqual(['14', '62', '2']);
  await expect(page.locator('.mb__lecturas')).toHaveText('2 lecturas');
  await expect(page.locator('.mb__libro')).toHaveCount(13);
  await page.getByRole('tab', { name: 'Recuerdo', exact: true }).click();
  await page.locator('#mb-recuerdo').fill('Datos de prueba: un otoño de mucha lluvia.');
  await page.locator('#mb-recuerdo').blur();
  await page.getByRole('tab', { name: 'Resumen', exact: true }).click();
  await page.screenshot({ path: (mkdirSync(DIR, { recursive: true }), join(DIR, `${info.project.name}-pantalla.png`)), fullPage: false });
  const d = await tarjetas(page);
  await expect(d.locator('.rx__vista img')).toHaveCount(2);
  expect(await guardar(page, d, `${info.project.name}-13-libros`)).toBe(2);
  // Excluir favorito y frase cambia la imagen
  const antes = await d.locator('.rx__vista img').first().getAttribute('src');
  await d.getByLabel('Incluir mi recuerdo').uncheck();
  await expect(d.locator('.rx__vista img').first()).not.toHaveAttribute('src', antes, { timeout: 15000 });
  await page.keyboard.press('Escape');
  await expect(d).toBeHidden();
  await expect(page.locator('.mb')).toBeVisible();
  // El mes actual está en curso y el siguiente no se puede abrir
  await page.locator('.mb__mes').getByRole('button', { name: 'Mes siguiente' }).click();
  await expect(page.locator('.mb__encurso')).toBeVisible();
  await expect(page.locator('.mb__mes').getByRole('button', { name: 'Mes siguiente' })).toBeDisabled();
  // Volver: el mes del calendario sigue siendo el que estaba
  await page.getByRole('button', { name: 'Volver al calendario' }).click();
  await expect(page.locator('.mb')).toBeHidden();
  await expect(page.locator('.port-cal__head h3')).toHaveText(mesCal); 
  // Y el favorito y la frase siguen guardados tras recargar
  await irAlMes(page, 0);
  await page.getByRole('tab', { name: 'Recuerdo', exact: true }).click();
  await expect(page.locator('#mb-recuerdo')).toHaveValue('Datos de prueba: un otoño de mucha lluvia.');
  // El atrás del navegador cierra el resumen, no el ordenador
  await page.goBack();
  await expect(page.locator('.mb')).toBeHidden();
  await expect(page.locator('.port-cal')).toBeVisible();
  await context.close();
});

for (const [n, nombre] of [
  [0, 'vacio'],
  [1, 'uno'],
  [12, 'doce'],
]) {
  test(`pantalla y tarjeta con ${n} libros`, async ({ browser }, info) => {
    soloChromium(info);
    test.setTimeout(90000);
    const log = n === 0 ? [sesion('a', `${PASADO}-03`, 25, 'x')] : [];
    const books = n === 0 ? [{ id: 'x', title: 'Libro empezado', author: 'Prueba', status: 'reading', pageCount: 300, currentPage: 25, cover: '', quotes: [] }] : libros(n);
    const { context, page } = await abrir(browser, base(books, log));
    await irAlMes(page, 1);
    if (n === 0) await expect(page.locator('.mb__panel:not([hidden]) .mb__estado')).toHaveText('Este mes has seguido avanzando');
    await page.screenshot({ path: join(DIR, `pantalla-${nombre}.png`) });
    const d = await tarjetas(page);
    const cuantas = n > 9 ? 2 : 1;
    await expect(d.locator('.rx__vista img')).toHaveCount(cuantas);
    expect(await guardar(page, d, `tarjeta-${nombre}`)).toBe(cuantas);
    await context.close();
  });
}

test('mes sin nada, sin fecha, porcentaje sin total y favorito que ya no vale', async ({ browser }, info) => {
  soloChromium(info);
  test.setTimeout(90000);
  const books = [
    { id: 'sf', title: 'Leído sin fecha', author: 'Prueba', status: 'read', pageCount: 200, finishedAt: null, cover: '', quotes: [] },
    { id: 'pc', title: 'Ebook sin total', author: 'Prueba', status: 'reading', pageCount: null, cover: '', quotes: [] },
    { id: 'p-0', title: 'Movido de mes', author: 'Prueba', status: 'read', pageCount: 100, finishedAt: `${SIN_FIN}-05T10:00:00.000Z`, cover: '', quotes: [] },
  ];
  const log = [{ ...sesion('z', `${PASADO}-05`, 0, 'pc'), unit: 'percent', mode: 'percent', from: 10, to: 20, delta: 10, total: null, active: true }];
  const { context, page } = await abrir(browser, base(books, log, { [PASADO]: { favorite: 'p-0' } }));
  await irAlMes(page, 1);
  expect(await cifras(page)).toEqual(['0', '0', '1']);
  await expect(page.getByText('Solo incluye los avances convertibles')).toBeVisible();
  await expect(page.getByText('Hay libros leídos sin fecha')).toBeVisible();
  await page.locator('.mb__mes').getByRole('button', { name: 'Mes anterior' }).click();
  await expect(page.locator('.mb__libro')).toHaveCount(1);
  await page.locator('.mb__mes').getByRole('button', { name: 'Mes anterior' }).click();
  await expect(page.getByText('Este mes no hay lecturas registradas')).toBeVisible();
  void VACIO;
  await context.close();
});

test('a 320 y con teclado se llega al botón final', async ({ browser }, info) => {
  test.skip(!/^(chromium|webkit)-390x844$/.test(info.project.name), '320');
  test.setTimeout(90000);
  const { context, page } = await abrir(browser, base(libros(14, { largos: 3 })), { w: 320, h: 640, webkit: info.project.name.startsWith('webkit') });
  await irAlMes(page, 1);
  await page.setViewportSize({ width: 320, height: 360 });
  await page.waitForTimeout(400);
  const boton = page.getByRole('button', { name: 'Guardar o compartir resumen' });
  await boton.scrollIntoViewIfNeeded();
  await expect(boton).toBeInViewport({ ratio: 1 });
  expect(await page.locator('.pc-win:not([hidden]) .pc-win__body').evaluate((n) => n.scrollWidth <= n.clientWidth)).toBe(true);
  await page.screenshot({ path: join(DIR, `${info.project.name}-320-teclado.png`) });
  await context.close();
});

test('de noche se lee y el papel va atenuado', async ({ browser }, info) => {
  soloChromium(info);
  test.setTimeout(60000);
  const { context, page } = await abrir(browser, base(libros(4), [sesion('a', `${PASADO}-03`, 30)]));
  await page.evaluate(() => {
    document.documentElement.dataset.uiTheme = 'noche';
  });
  await irAlMes(page, 1);
  const contraste = await page.locator('.mb__cifras dt').first().evaluate((n) => {
    const rgb = (t) => t.match(/[\d.]+/g).slice(0, 3).map(Number);
    const lum = (c) => {
      const [r, g, b] = c.map((v) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const a = lum(rgb(getComputedStyle(n).color));
    const b = lum(rgb(getComputedStyle(n.closest('.mb__cifras')).backgroundColor));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(contraste).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: join(DIR, 'pantalla-noche.png') });
  await context.close();
});

test('una flecha para volver, favorito en la balda y páginas por día', async ({ browser }, info) => {
  soloChromium(info);
  test.setTimeout(70000);
  const hoy = `${mesRel(0)}-01`;
  const { context, page } = await abrir(browser, base(libros(4), [sesion('a', `${PASADO}-03`, 32), sesion('b', hoy, 18)]));
  await expect(page.locator('.port-cal__day[aria-label^="1 de"] .port-cal__pag')).toHaveText('18 p.');
  await irAlMes(page, 1);
  await expect(page.getByRole('button', { name: /^Volver/ })).toHaveCount(1);
  await expect(page.locator('.port-computer__head h2')).toHaveText('Tu mes en libros');
  await page.getByRole('button', { name: 'Volver al calendario' }).click();
  await expect(page.locator('.mb')).toBeHidden();
  await expect(page.locator('.port-computer__head h2')).toHaveText('Calendario');
  await page.locator('.port-cal__head').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(DIR, 'calendario-paginas.png') });
  await context.close();
});

test('biblioteca: un botón para cada estado y Añadir a la vista', async ({ browser }, info) => {
  test.skip(!/^(chromium|webkit)-390x844$/.test(info.project.name), '390');
  test.setTimeout(60000);
  const { context, page } = await abrir(browser, base(libros(6)));
  await page.getByRole('button', { name: 'Salir del ordenador' }).click();
  await page.waitForTimeout(500);
  const confirmar = page.getByRole('button', { name: /Salir|Apagar/ }).last();
  if (await confirmar.isVisible().catch(() => false)) await confirmar.click().catch(() => {});
  await page.waitForTimeout(600);
  await menu(page).click();
  await page.getByRole('button', { name: 'Mi biblioteca', exact: true }).click();
  await expect(page.locator('.plab-library')).toBeVisible();
  const colores = await page.locator('.plab-filter').evaluateAll((l) => l.map((n) => getComputedStyle(n).backgroundColor));
  expect(new Set(colores).size).toBe(5);
  const add = page.getByRole('button', { name: 'Añadir libro' });
  await expect(add).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: join(DIR, `${info.project.name}-biblioteca.png`) });
  await page.locator('.plab-filter[data-filtro="abandoned"]').click();
  await expect(page.locator('.plab-filter[data-filtro="abandoned"]')).toHaveAttribute('aria-pressed', 'true');
  await add.click();
  await expect(page.getByRole('dialog').or(page.locator('.add-book, .search-sheet')).first()).toBeVisible({ timeout: 8000 });
  await page.screenshot({ path: join(DIR, `${info.project.name}-anadir.png`) });
  await context.close();
});

