// 1.150, bloque 2 · La guía del café en sus menús y botones (Francisco, 26-11-2026: «que en la cafetería también tenga una
// especie de guía como Libo en los menús y botones»), con Supabase simulado. Con la vista previa la da Olmo; sin ella, Pilar.
// Se abre sola la primera vez (después de Libo), señala cada botón con un hueco en el velo, se repasa tocando el retrato y
// cada menú tiene su capítulo la primera vez que se abre. Capturas en qa-report/v1150/; con GUIA_VIDEO=1, el vídeo.
import { expect, test } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { generoDe } from '../src/features/edificio/cafe/cafeClientes';
import { CAPITULOS_CAFE, textoDe } from '../src/features/edificio/cafe/cafeGuia';
import { dayKey } from '../src/domain/dates';
import { alEdificio } from './entrada';

const DIR = join('qa-report', 'v1150');
const tam = (info) => info.project.name.replace(/^chromium-/, '');
const libro = (id, title, extra = {}) => ({
  id,
  title,
  author: `Autoría ${id}`,
  status: 'read',
  pageCount: 320,
  currentPage: 320,
  cover: '',
  categories: [],
  publishedDate: '2012',
  addedAt: '2026-10-01T10:00:00.000Z',
  finishedAt: '2026-10-20T10:00:00.000Z',
  quotes: [],
  ...extra,
});
const LIBROS = [
  libro('f', 'El dragón del muelle', { categories: ['Fantasy'], pageCount: 540 }),
  libro('m', 'Crimen en la lonja', { categories: ['Mystery'], pageCount: 280 }),
  libro('a', 'Cartas de amor al puerto', { categories: ['Romance'], pageCount: 190 }),
];
const BALDA = { bienvenida: true, libros: LIBROS.map((b) => ({ clave: b.id, titulo: b.title, genero: generoDe(b), caja: 0, balda: 1 })) };
const paso = (cap, id) => CAPITULOS_CAFE[cap].find((p) => p.id === id);

async function alCafe(page, { previa = true, reduced = true } = {}) {
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 120, sin_raro: 3 } },
    piso_inventario: { [ANA.id]: { sillon: 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.libraries.push({ user_id: ANA.id, data: { books: LIBROS }, updated_at: new Date().toISOString(), version: 5 });
  if (!reduced) await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript((books) => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!localStorage.getItem('bookshelf:v1')) localStorage.setItem('bookshelf:v1', JSON.stringify({ books, progress: { readingLog: [], pomodoros: [], claimed: {} } }));
  }, LIBROS);
  await mock.attach(page, ANA);
  // El simulador da la guía por vista (para no tapar las demás pruebas): aquí, la primera vez de verdad
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('guia-limpia')) {
      localStorage.removeItem('bookshelf:guia-cafe');
      sessionStorage.setItem('guia-limpia', '1');
    }
  });
  await simularCafe(
    page,
    { inaugurado: true, nombre: 'Taza y Lomo', granos: 0, plano: structuredClone(PLANO_INICIAL), inventario: cuenta(PLANO_INICIAL), libros: BALDA },
    { clientes: { hoy: dayKey(), semillas: [2100, 1000, 8919], quienes: [3], frases: [10], vendidos: [], ...(previa ? { jornada: '3000-01-01' } : {}) } },
  );
  await page.goto('/');
  await alEdificio(page);
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' }).click({ timeout: 15000 });
  const cafe = page.getByRole('dialog', { name: 'El café-librería del bajo' });
  await expect(cafe.locator('.cf3[data-ready="true"]')).toBeVisible({ timeout: 20000 });
  return cafe;
}

const tarjeta = (cafe) => cafe.locator('.cf3-guia__tarjeta');
// 1.156: el retrato de la tarjeta es una pose de la hoja de Olmo (saluda al empezar y celebra al final)
const poseGuia = (cafe) => tarjeta(cafe).locator('img.cf3-px--pose');
const esperaPaso = async (cafe, id) => {
  const page = cafe.page();
  await expect(tarjeta(cafe)).toHaveAttribute('data-paso', id, { timeout: 15000 });
  // Colocada junto a su botón (la primera medida la deja oculta)
  await expect(tarjeta(cafe)).not.toHaveCSS('visibility', 'hidden');
  // La tarjeta y el hueco se deslizan hasta su botón (220 ms)
  await page.waitForTimeout(450);
};

test('Olmo enseña los botones del café la primera vez, y se repasa tocando su retrato', async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844|1440x900)$/.test(info.project.name), '360, 390 y escritorio');
  test.setTimeout(150000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cafe = await alCafe(page);
  // Sola, después de que el café se asiente
  await esperaPaso(cafe, 'hola');
  await expect(cafe.locator('.cf3-guia')).toHaveAttribute('data-quien', 'olmo');
  await expect(tarjeta(cafe).locator('.cf3-guia__quien')).toHaveText('Olmo');
  await expect(tarjeta(cafe)).toContainText(textoDe(paso('local', 'hola'), 'olmo'));
  await expect(poseGuia(cafe)).toHaveAttribute('data-pose', 'saluda');
  await expect.poll(() => poseGuia(cafe).evaluate((img) => img.complete && img.naturalWidth)).toBe(311);
  await page.screenshot({ path: join(DIR, `10-guia-olmo-hola-${tam(info)}.png`) });
  await tarjeta(cafe).getByRole('button', { name: 'Enséñame' }).click();
  // El primer botón: su retrato, con el hueco en el velo encima
  await esperaPaso(cafe, 'retrato');
  await expect(cafe.locator('.cf3-guia__hueco')).toBeVisible();
  await expect(tarjeta(cafe)).toContainText(textoDe(paso('local', 'retrato'), 'olmo'));
  await page.screenshot({ path: join(DIR, `11-guia-olmo-retrato-${tam(info)}.png`) });
  await tarjeta(cafe).getByRole('button', { name: 'Siguiente' }).click();
  await esperaPaso(cafe, 'atender');
  await page.screenshot({ path: join(DIR, `12-guia-olmo-atender-${tam(info)}.png`) });
  // Hasta el final, con Atrás funcionando por el camino
  await tarjeta(cafe).getByRole('button', { name: 'Atrás' }).click();
  await esperaPaso(cafe, 'retrato');
  const vistos = [];
  const poses = [];
  for (let i = 0; i < 20; i += 1) {
    const id = await tarjeta(cafe).getAttribute('data-paso');
    vistos.push(id);
    poses.push(await poseGuia(cafe).getAttribute('data-pose'));
    if (id === 'fin') break;
    if (id === 'libros') await page.waitForTimeout(450);
    if (id === 'libros') await page.screenshot({ path: join(DIR, `13-guia-olmo-libros-${tam(info)}.png`) });
    await tarjeta(cafe).getByRole('button', { name: 'Siguiente' }).click();
    await expect(tarjeta(cafe)).not.toHaveAttribute('data-paso', id);
  }
  expect(vistos).toContain('decorar');
  expect(vistos.at(-1)).toBe('fin');
  expect(poses.at(-1)).toBe('celebra');
  expect(poses).toContain('camina');
  await page.screenshot({ path: join(DIR, `14-guia-olmo-fin-${tam(info)}.png`) });
  await tarjeta(cafe).getByRole('button', { name: 'Gracias, Olmo' }).click();
  await expect(cafe.locator('.cf3-guia')).toHaveCount(0);
  // Queda apuntado: no vuelve sola
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('bookshelf:guia-cafe')))).toContain('local:hola');
  await page.waitForTimeout(3000);
  await expect(cafe.locator('.cf3-guia')).toHaveCount(0);
  // El retrato la repasa, con todo lo que se ve; Escape la cierra sin cerrar el café
  await cafe.locator('[data-guia="retrato"]').click();
  await esperaPaso(cafe, 'hola');
  await page.keyboard.press('Escape');
  await expect(cafe.locator('.cf3-guia')).toHaveCount(0);
  await expect(cafe).toBeVisible();
  expect(errors).toEqual([]);
});

test('sin la suscripción, la guía la da Pilar con su retrato', async ({ page }, info) => {
  test.skip(!/^chromium-(390x844|1440x900)$/.test(info.project.name), '390 y escritorio');
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  const cafe = await alCafe(page, { previa: false });
  await esperaPaso(cafe, 'hola');
  await expect(cafe.locator('.cf3-guia')).toHaveAttribute('data-quien', 'pilar');
  await expect(tarjeta(cafe).locator('.cf3-guia__quien')).toHaveText('Pilar');
  await expect(tarjeta(cafe)).toContainText(textoDe(paso('local', 'hola'), 'pilar'));
  await page.screenshot({ path: join(DIR, `15-guia-pilar-hola-${tam(info)}.png`) });
  await tarjeta(cafe).getByRole('button', { name: 'Enséñame' }).click();
  await esperaPaso(cafe, 'retrato');
  await tarjeta(cafe).getByRole('button', { name: 'Siguiente' }).click();
  await esperaPaso(cafe, 'atender');
  await expect(tarjeta(cafe)).toContainText(textoDe(paso('local', 'atender'), 'pilar'));
  await page.screenshot({ path: join(DIR, `16-guia-pilar-atender-${tam(info)}.png`) });
  await tarjeta(cafe).getByRole('button', { name: 'Saltar' }).click();
  await expect(cafe.locator('.cf3-guia')).toHaveCount(0);
});

test('cada menú tiene su capítulo la primera vez: Decorar y la balda de libros', async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844)$/.test(info.project.name), '360 y 390');
  test.setTimeout(150000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cafe = await alCafe(page);
  await esperaPaso(cafe, 'hola');
  await tarjeta(cafe).getByRole('button', { name: 'Ahora no' }).click();
  await expect(cafe.locator('.cf3-guia')).toHaveCount(0);
  // Decorar: cuatro pasos, con su saludo propio no (el capítulo es corto) y la cuenta «1 de 4»
  await cafe.locator('[data-guia="decorar"]').first().click();
  await esperaPaso(cafe, 'mover');
  await expect(tarjeta(cafe)).toContainText(textoDe(paso('decorar', 'mover'), 'olmo'));
  await page.screenshot({ path: join(DIR, `17-guia-decorar-${tam(info)}.png`) });
  for (let i = 0; i < 6; i += 1) {
    const id = await tarjeta(cafe).getAttribute('data-paso');
    if (id === 'listo') break;
    await tarjeta(cafe).getByRole('button', { name: 'Siguiente' }).click();
    await expect(tarjeta(cafe)).not.toHaveAttribute('data-paso', id);
  }
  await esperaPaso(cafe, 'listo');
  await page.screenshot({ path: join(DIR, `18-guia-decorar-listo-${tam(info)}.png`) });
  await tarjeta(cafe).getByRole('button', { name: 'Gracias, Olmo' }).click();
  await expect(cafe.locator('.cf3-guia')).toHaveCount(0);
  await cafe.getByRole('button', { name: 'Cancelar' }).click();
  // La balda de libros
  await cafe.locator('.cf3-libros-btn').click();
  await esperaPaso(cafe, 'balda');
  await expect(tarjeta(cafe).getByRole('button', { name: 'Entendido' })).toBeVisible();
  await page.screenshot({ path: join(DIR, `19-guia-libros-${tam(info)}.png`) });
  await tarjeta(cafe).getByRole('button', { name: 'Entendido' }).click();
  await expect(cafe.locator('.cf3-guia')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('vídeo: la guía de Olmo de principio a fin', async ({ browser }, info) => {
  test.skip(!process.env.GUIA_VIDEO || !/^chromium-390x844$/.test(info.project.name), 'solo con GUIA_VIDEO=1');
  test.setTimeout(300000);
  const bruto = join(DIR, 'bruto');
  const dir = join(DIR, 'video');
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ ...info.project.use, recordVideo: { dir: bruto, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const cafe = await alCafe(page, { reduced: false });
  await esperaPaso(cafe, 'hola');
  await page.waitForTimeout(2200);
  await tarjeta(cafe).getByRole('button', { name: 'Enséñame' }).click();
  for (let i = 0; i < 20; i += 1) {
    const id = await tarjeta(cafe).getAttribute('data-paso');
    await page.waitForTimeout(2300);
    if (id === 'fin') break;
    await tarjeta(cafe).getByRole('button', { name: 'Siguiente' }).click();
    await expect(tarjeta(cafe)).not.toHaveAttribute('data-paso', id);
  }
  await tarjeta(cafe).getByRole('button', { name: 'Gracias, Olmo' }).click();
  await page.waitForTimeout(1200);
  // Decorar, su capítulo
  await cafe.locator('[data-guia="decorar"]').first().click();
  await esperaPaso(cafe, 'mover');
  for (let i = 0; i < 6; i += 1) {
    const id = await tarjeta(cafe).getAttribute('data-paso');
    await page.waitForTimeout(2000);
    if (id === 'listo') break;
    await tarjeta(cafe).getByRole('button', { name: 'Siguiente' }).click();
  }
  await tarjeta(cafe).getByRole('button', { name: 'Gracias, Olmo' }).click();
  await cafe.getByRole('button', { name: 'Cancelar' }).click();
  await page.waitForTimeout(1000);
  // Y el retrato, para repasar
  await cafe.locator('[data-guia="retrato"]').click();
  await esperaPaso(cafe, 'hola');
  await page.waitForTimeout(2000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join(dir, '1150-guia.webm'));
});
