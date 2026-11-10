// 2.ª ampliación del Almacén del Puerto (encargo de Francisco del 10-11-2026), bloque 4, con Supabase simulado: la sala de
// habitaciones, más grande, con cuatro habitaciones cerradas con su persiana hasta que lleguen muebles; y los muebles de la
// habitación especial (Capa y Antifaz) al doble y sin rebajas: ni la oferta (aunque llegara) ni el albarán. Capturas en
// qa-report/almacen/.
import { expect, test } from '@playwright/test';
import { ANA, alAlmacen, mockAlmacen, shot } from './almacenHelpers';

const settled = (page) => page.waitForFunction(() => window.__almacen3d.settled());
const madrid = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
const VISTAS = [
  ['80-pasillo4-largo', 23.5, 4.6, 0.02],
  ['81-placita', 23.5, 14.2, 0.0],
  ['82-ala-nueva', 23.5, 18.9, 0.35],
  ['83-desde-el-fondo', 23.5, 23.8, Math.PI],
];

/** Con el albarán de hoy ya sellado (3 de 3, −10 %) y una oferta que, si llegara, tocaría al sillón de la capa. */
function conAlbaran(tickets = 200) {
  const mock = mockAlmacen({ tickets, ofertas: [{ id: 'sillon-capa', pct: 50, tipo: 'semana' }, { id: 'mesa', pct: 20, tipo: 'dia' }] });
  mock.db.almacen.dias = { [`${ANA.id}:${madrid()}`]: { modo: 'rapido', empezado: Date.now() - 120000, marcas: [true, true, true], usado: false } };
  return mock;
}
async function alCarrito(page, alm, nombre) {
  await alm.locator('.alm-bar').getByRole('button', { name: 'Directorio' }).click();
  await alm.locator('.alm-dir__item').filter({ has: page.getByText(nombre, { exact: true }) }).first().click();
  await expect(alm.locator('.alm-card--ficha h4')).toHaveText(nombre, { timeout: 30000 });
  await settled(page);
}

test('la sala de habitaciones, más grande: cuatro cerradas con su persiana y su letrero', async ({ page }, info) => {
  test.skip(!/360x800|390x844|430x932|1440x900/.test(info.project.name), '360, 390, 430 y escritorio');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const { alm } = await alAlmacen(page, mockAlmacen());
  for (const [name, x, y, yaw] of VISTAS) {
    await page.evaluate(([x, y, yaw]) => window.__almacen3d.place(x, y, yaw), [x, y, yaw]);
    await page.waitForTimeout(300);
    if (name === '83-desde-el-fondo') await expect(alm.locator('.alm-cartel:not([data-off="true"])', { hasText: 'Próximamente' }).first()).toBeVisible();
    await shot(page, info, name);
  }
  // Se puede andar hasta el fondo del pasillo 4, pero no meterse en una cerrada
  const p = await page.evaluate(() => window.__almacen3d.pose?.() ?? null);
  if (p) expect(p.y).toBeGreaterThan(23);
  expect(errors).toEqual([]);
});

test('lo de la habitación especial: al doble, sin oferta y fuera del albarán', async ({ page }, info) => {
  test.skip(!/^(chromium-390x844|webkit-390x844|chromium-360x800)$/.test(info.project.name), 'a 360 y 390, Chromium y WebKit');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const mock = conAlbaran();
  const { alm } = await alAlmacen(page, mock);
  // La ficha: 80 tickets (poco común al doble), sin la oferta que mandaba el servidor
  await alCarrito(page, alm, 'Sillón de la capa');
  const ficha = alm.locator('.alm-card--ficha');
  await expect(ficha).toContainText('80 tickets');
  await expect(ficha).toContainText('De habitación especial · nunca se rebaja');
  await expect(ficha.locator('.alm-precio s')).toHaveCount(0);
  await shot(page, info, '84-ficha-especial');
  await alm.getByRole('button', { name: 'Añadir al carrito' }).click();
  await alm.locator('.alm-card__back').click();
  // Una mesa con su oferta del día (20 → 16), dos
  await alCarrito(page, alm, 'Mesa');
  await expect(ficha).toContainText('Oferta del día');
  await alm.getByRole('button', { name: 'Añadir al carrito' }).click();
  await alm.locator('.alm-card__back').click();
  await alm.getByRole('button', { name: /^Carrito: / }).click();
  await alm.getByRole('button', { name: 'Uno más de Mesa' }).click();
  await alm.locator('.alm-card--carrito').getByRole('button', { name: 'Ir a caja' }).click();
  await settled(page);
  // La caja: 80 + 2 × 16 = 112; el −10 % solo sobre las mesas (32 → −3): 109
  const caja = alm.locator('.alm-caja');
  await expect(caja.locator('.alm-ticket__especial')).toHaveText('sin rebajas');
  await expect(caja).toContainText('Lo de las habitaciones especiales no se rebaja');
  const cuenta = caja.locator('.alm-ticket--cuenta');
  await expect(cuenta).toContainText('112');
  await expect(cuenta).toContainText('−3 tickets');
  const pagar = alm.getByRole('button', { name: /Confirmar compra/ });
  await expect(pagar).toContainText('109 tickets');
  await cuenta.scrollIntoViewIfNeeded();
  await shot(page, info, '85-caja-sin-rebaja');
  await pagar.click();
  await expect(caja).toContainText('Ya lo tienes todo en tu inventario');
  expect(mock.db.piso_cuentas[ANA.id].tickets).toBe(91);
  expect(mock.db.piso_inventario[ANA.id]['sillon-capa']).toBe(1);
  expect(mock.db.piso_inventario[ANA.id].mesa).toBe(2);
  await shot(page, info, '86-pagado');
  expect(errors).toEqual([]);
});

test('vídeo: el pasillo 4 hasta las cerradas y la compra sin rebaja', async ({ browser }, info) => {
  test.skip(!process.env.ALMACEN_VIDEO || !/^chromium-390x844$/.test(info.project.name), 'solo con ALMACEN_VIDEO=1');
  test.setTimeout(240000);
  const { copyFileSync, mkdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const dir = join('qa-report', 'almacen', 'bruto');
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ ...info.project.use, recordVideo: { dir, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const mock = conAlbaran();
  const { alm } = await alAlmacen(page, mock, ANA, { reduced: false });
  const lienzo = await alm.locator('canvas').first().boundingBox();
  const pausa = (ms) => page.waitForTimeout(ms);
  const arrastrar = async (de, a) => {
    await page.mouse.move(lienzo.x + lienzo.width * de, lienzo.y + lienzo.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(lienzo.x + lienzo.width * a, lienzo.y + lienzo.height * 0.5, { steps: 30 });
    await page.mouse.up();
  };
  await pausa(900);
  // Del directorio al sillón de la capa: va andando hasta el pasillo 4
  await alCarrito(page, alm, 'Sillón de la capa');
  await pausa(1800);
  await alm.getByRole('button', { name: 'Añadir al carrito' }).click();
  await pausa(700);
  await alm.locator('.alm-card__back').click();
  await settled(page);
  await pausa(600);
  // Por el pasillo 4 hacia el fondo: las cerradas a los dos lados
  await page.evaluate(() => window.__almacen3d.go('pasillo4'));
  await settled(page);
  await pausa(1500);
  await arrastrar(0.5, 0.82);
  await pausa(1500);
  await arrastrar(0.82, 0.18);
  await pausa(1500);
  await arrastrar(0.18, 0.5);
  await pausa(900);
  // Una mesa en oferta y a la caja: el albarán no toca el sillón
  await alCarrito(page, alm, 'Mesa');
  await pausa(1200);
  await alm.getByRole('button', { name: 'Añadir al carrito' }).click();
  await alm.locator('.alm-card__back').click();
  await alm.getByRole('button', { name: /^Carrito: / }).click();
  await pausa(700);
  await alm.getByRole('button', { name: 'Uno más de Mesa' }).click();
  await pausa(700);
  await alm.locator('.alm-card--carrito').getByRole('button', { name: 'Ir a caja' }).click();
  await settled(page);
  await pausa(1200);
  await alm.locator('.alm-ticket--cuenta').scrollIntoViewIfNeeded();
  await pausa(2200);
  await alm.getByRole('button', { name: /Confirmar compra/ }).click();
  await expect(alm.locator('.alm-caja')).toContainText('Ya lo tienes todo');
  await pausa(2500);
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join('qa-report', 'almacen', `habitaciones-cerradas-${info.project.name}.webm`));
  expect(mock.db.piso_cuentas[ANA.id].tickets).toBe(91);
});
