// 1.101 (SPEC §101) · Las habitaciones del Almacén del Puerto, con Supabase simulado: el paso desde el cruce del fondo, la
// habitación de superhéroes «Capa y Antifaz» con su rincón especial, las dos habitaciones normales, el directorio con la
// colección, la ficha de un mueble nuevo y su compra. Capturas en qa-report/almacen/.
import { expect, test } from '@playwright/test';
import { alAlmacen, mockAlmacen, shot } from './almacenHelpers';

const ANA = '11111111-1111-4111-8111-111111111111';
const settled = (page) => page.waitForFunction(() => window.__almacen3d.settled());
const VISTAS = [
  ['30-paso', 15.5, 4.2, Math.PI / 2],
  ['31-pasillo4', 23.5, 4.6, 0.12],
  ['32-heroes', 23.5, 10.2, Math.PI / 2],
  ['33-rincon', 23.5, 12.0, Math.PI / 2 - 0.5],
  ['34-estudio', 23.5, 7.8, -Math.PI / 2],
  ['35-salita', 23.5, 12.6, -Math.PI / 2],
  ['36-desde-el-fondo', 23.5, 14.6, Math.PI],
];

test('las habitaciones: el paso, Capa y Antifaz, su rincón y las dos de alrededor', async ({ page }, info) => {
  test.skip(!/360x800|390x844|430x932|1440x900/.test(info.project.name), '360, 390, 430 y escritorio');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const mock = mockAlmacen();
  await alAlmacen(page, mock);
  for (const [name, x, y, yaw] of VISTAS) {
    await page.evaluate(([x, y, yaw]) => window.__almacen3d.place(x, y, yaw), [x, y, yaw]);
    await page.waitForTimeout(250);
    await shot(page, info, name);
  }
  expect(errors).toEqual([]);
});

test('la colección de superhéroes: en el directorio, su ficha (va andando al pasillo 4) y se compra', async ({ page }, info) => {
  test.skip(!/^(chromium-390x844|webkit-390x844)$/.test(info.project.name), 'a 390, Chromium y WebKit');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const mock = mockAlmacen({ tickets: 100 });
  const { alm } = await alAlmacen(page, mock);
  await alm.locator('.alm-bar').getByRole('button', { name: 'Directorio' }).click();
  const seccion = alm.locator('section.alm-dir__seccion', { hasText: 'Capa y Antifaz' });
  await expect(seccion).toBeVisible();
  for (const nombre of ['Sillón de la capa', 'Expositor de cómics', 'Foco de la señal', 'Maniquí con capa', 'Lámina de viñetas', 'Neón del rayo']) await expect(seccion.getByText(nombre, { exact: true })).toBeVisible();
  // Las habitaciones normales no son una sección: sus muebles ya tienen la suya
  await expect(alm.getByText('Habitaciones montadas')).toHaveCount(0);
  await seccion.scrollIntoViewIfNeeded();
  await shot(page, info, '37-directorio-heroes');
  await seccion.locator('.alm-dir__item').filter({ has: page.getByText('Sillón de la capa', { exact: true }) }).click();
  await expect(alm.locator('.alm-card--ficha h4')).toHaveText('Sillón de la capa', { timeout: 20000 });
  await expect(alm.locator('.alm-card--ficha')).toContainText('Pasillo 4');
  await settled(page);
  // Ha ido andando por el paso hasta el pasillo 4
  const pos = await page.evaluate(() => window.__almacen3d.pose?.() ?? null);
  if (pos) expect(pos.x).toBeGreaterThan(18);
  await shot(page, info, '38-ficha-sillon-capa');
  await alm.getByRole('button', { name: 'Añadir al carrito' }).click();
  await expect(alm.getByRole('button', { name: 'Carrito: 1 artículo' })).toBeVisible();
  await alm.locator('.alm-card__back').click();
  await alm.getByRole('button', { name: /^Carrito: / }).click();
  await alm.locator('.alm-card--carrito').getByRole('button', { name: 'Ir a caja' }).click();
  const pagar = alm.getByRole('button', { name: /Confirmar compra/ });
  await expect(pagar).toBeEnabled();
  await expect(pagar).toContainText('80 tickets');
  await pagar.click();
  await expect(alm.locator('.alm-caja')).toContainText('Ya lo tienes todo en tu inventario');
  expect(mock.db.piso_cuentas[ANA].tickets).toBe(20);
  expect(mock.db.piso_inventario[ANA]['sillon-capa']).toBe(1);
  expect(errors).toEqual([]);
});

test('vídeo: de la entrada a las habitaciones, el rincón de superhéroes y la compra', async ({ browser }, info) => {
  test.skip(!process.env.ALMACEN_VIDEO || !/^(chromium|webkit)-390x844$/.test(info.project.name), 'solo con ALMACEN_VIDEO=1');
  test.setTimeout(180000);
  const { copyFileSync, mkdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const dir = join('qa-report', 'almacen', 'bruto');
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ ...info.project.use, recordVideo: { dir, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const mock = mockAlmacen({ tickets: 200 });
  const { alm } = await alAlmacen(page, mock, undefined, { reduced: false });
  const lienzo = await alm.locator('canvas').first().boundingBox();
  const pausa = (ms) => page.waitForTimeout(ms);
  const arrastrar = async (de, a) => {
    await page.mouse.move(lienzo.x + lienzo.width * de, lienzo.y + lienzo.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(lienzo.x + lienzo.width * a, lienzo.y + lienzo.height * 0.5, { steps: 30 });
    await page.mouse.up();
  };
  await pausa(1000);
  // Del directorio al sillón de la capa: va andando por el pasillo 3, el cruce del fondo y el paso hasta el pasillo 4
  await alm.locator('.alm-bar').getByRole('button', { name: 'Directorio' }).click();
  await pausa(900);
  const seccion = alm.locator('section.alm-dir__seccion', { hasText: 'Capa y Antifaz' });
  await seccion.scrollIntoViewIfNeeded();
  await pausa(1200);
  await seccion.locator('.alm-dir__item').filter({ has: page.getByText('Sillón de la capa', { exact: true }) }).click();
  await expect(alm.locator('.alm-card--ficha h4')).toHaveText('Sillón de la capa', { timeout: 30000 });
  await settled(page);
  await pausa(1200);
  await alm.locator('.alm-tono').nth(1).click();
  await pausa(900);
  await alm.locator('.alm-tono').nth(2).click();
  await pausa(900);
  await alm.locator('.alm-tono').nth(0).click();
  await pausa(600);
  await alm.locator('.alm-card__back').click();
  await settled(page);
  await pausa(700);
  // Mirar la habitación y el rincón especial, y las dos de enfrente
  await arrastrar(0.5, 0.75);
  await pausa(1200);
  await arrastrar(0.75, 0.2);
  await pausa(1200);
  await arrastrar(0.2, 0.05);
  await pausa(1200);
  await arrastrar(0.05, 0.6);
  await pausa(900);
  // El maniquí del rincón, al carrito; y el neón
  await alm.locator('.alm-bar').getByRole('button', { name: 'Directorio' }).click();
  await pausa(600);
  await seccion.locator('.alm-dir__item').filter({ has: page.getByText('Maniquí con capa', { exact: true }) }).click();
  await expect(alm.locator('.alm-card--ficha h4')).toHaveText('Maniquí con capa', { timeout: 30000 });
  await settled(page);
  await pausa(1500);
  await alm.getByRole('button', { name: 'Añadir al carrito' }).click();
  await pausa(700);
  await alm.locator('.alm-card__back').click();
  await pausa(600);
  await alm.locator('.alm-bar').getByRole('button', { name: 'Directorio' }).click();
  await pausa(500);
  await seccion.locator('.alm-dir__item').filter({ has: page.getByText('Neón del rayo', { exact: true }) }).click();
  await expect(alm.locator('.alm-card--ficha h4')).toHaveText('Neón del rayo', { timeout: 30000 });
  await settled(page);
  await pausa(1500);
  await alm.getByRole('button', { name: 'Añadir al carrito' }).click();
  await pausa(700);
  await alm.locator('.alm-card__back').click();
  await pausa(1200);
  // A la caja (vuelve andando) y pagar
  await alm.getByRole('button', { name: /^Carrito: / }).click();
  await pausa(900);
  await alm.locator('.alm-card--carrito').getByRole('button', { name: 'Ir a caja' }).click();
  await settled(page);
  await pausa(900);
  await alm.getByRole('button', { name: /Confirmar compra/ }).click();
  await expect(alm.locator('.alm-caja')).toContainText('Ya lo tienes todo');
  await pausa(2500);
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join('qa-report', 'almacen', `habitaciones-${info.project.name}.webm`));
  expect(mock.db.piso_inventario['11111111-1111-4111-8111-111111111111']['maniqui-capa']).toBe(1);
});
