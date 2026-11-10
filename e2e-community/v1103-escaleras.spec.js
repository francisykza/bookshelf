// 2.ª ampliación del Almacén del Puerto (encargo de Francisco del 10-11-2026), bloque 1, con Supabase simulado: las
// escaleras mecánicas nada más entrar, el viaje de bajada y de subida y la planta de abajo; con muebles en el carrito no
// se baja sin pasar por caja. Capturas en qa-report/almacen/.
import { expect, test } from '@playwright/test';
import { alAlmacen, mockAlmacen, shot } from './almacenHelpers';

const settled = (page) => page.waitForFunction(() => window.__almacen3d.settled());
const BZ = -4.6;

test('las escaleras mecánicas: al entrar, bajando, la planta de abajo y subiendo', async ({ page }, info) => {
  test.skip(!/360x800|390x844|430x932|1440x900/.test(info.project.name), '360, 390, 430 y escritorio');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const { alm } = await alAlmacen(page, mockAlmacen());
  await page.waitForTimeout(300);
  await shot(page, info, '50-entrada');
  // Recién entrado, mirando a las escaleras
  await page.evaluate(() => window.__almacen3d.place(15.5, 23.6, Math.PI - 0.1));
  await page.waitForTimeout(300);
  await shot(page, info, '51-escaleras');
  const bajar = alm.locator('.alm-tag--sitio', { hasText: 'Planta −1' });
  await expect(bajar).toBeVisible();
  // Desde la barandilla del hueco: las escaleras y la planta de abajo
  await page.evaluate(() => window.__almacen3d.place(15.5, 9.6, 0.3));
  await page.waitForTimeout(300);
  await shot(page, info, '52-hueco');
  // A media bajada y casi abajo
  await page.evaluate(() => window.__almacen3d.enLaEscalera(17.6));
  await page.waitForTimeout(300);
  await shot(page, info, '53-bajando');
  await page.evaluate(() => window.__almacen3d.enLaEscalera(13.4));
  await page.waitForTimeout(300);
  await shot(page, info, '54-casi-abajo');
  // Bajar de verdad (sin animación en las pruebas): se llega a la planta de abajo
  await page.evaluate(() => window.__almacen3d.place(15.5, 23.6, Math.PI - 0.1));
  await page.waitForTimeout(300);
  await bajar.click();
  await settled(page);
  expect(await page.evaluate(() => window.__almacen3d.planta())).toBe(BZ);
  await expect(alm.locator('.alm-cartel', { hasText: 'Planta −1 · Moda' })).toBeVisible();
  await shot(page, info, '55-planta-abajo');
  // Mirando a las escaleras desde abajo
  await page.evaluate((z) => window.__almacen3d.place(14.0, 9.0, 0.9, z), BZ);
  await page.waitForTimeout(300);
  await shot(page, info, '56-pie-escaleras');
  const subir = alm.locator('.alm-tag--sitio', { hasText: 'Planta 0' });
  await expect(subir).toBeVisible();
  await page.evaluate(() => window.__almacen3d.enLaEscalera(14.2, true));
  await page.waitForTimeout(300);
  await shot(page, info, '57-subiendo');
  // Y subir
  await page.evaluate((z) => window.__almacen3d.place(14.0, 9.0, 0.9, z), BZ);
  await page.waitForTimeout(300);
  await subir.click();
  await settled(page);
  expect(await page.evaluate(() => window.__almacen3d.planta())).toBe(0);
  expect(errors).toEqual([]);
});

test('con muebles en el carrito, primero se pasa por caja', async ({ page }, info) => {
  test.skip(!/^(chromium-390x844|webkit-390x844|chromium-1440x900)$/.test(info.project.name), '390 y escritorio');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('bookshelf:almacen-carrito', JSON.stringify([{ id: 'sillon', n: 1 }])));
  const { alm } = await alAlmacen(page, mockAlmacen());
  await page.evaluate(() => window.__almacen3d.place(15.5, 23.6, Math.PI - 0.1));
  await page.waitForTimeout(300);
  await alm.locator('.alm-tag--sitio', { hasText: 'Planta −1' }).click();
  await settled(page);
  const aviso = alm.locator('.alm-bloqueo');
  await expect(aviso).toContainText('pasa por caja');
  expect(await page.evaluate(() => window.__almacen3d.planta())).toBe(0);
  await shot(page, info, '58-pasa-por-caja');
  // El directorio tampoco te baja
  await aviso.getByRole('button', { name: 'Ahora no' }).click();
  await alm.locator('.alm-bar').getByRole('button', { name: 'Directorio' }).click();
  await alm.getByRole('button', { name: 'Bajar a la planta de ropa' }).click();
  await settled(page);
  await expect(aviso).toBeVisible();
  expect(await page.evaluate(() => window.__almacen3d.planta())).toBe(0);
  // «Ir a caja» lleva a la caja
  await aviso.getByRole('button', { name: 'Ir a caja' }).click();
  await expect(alm.locator('.alm-card')).toContainText('La caja');
  await expect(aviso).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('vídeo: bajar en la escalera mecánica, la planta de abajo y subir', async ({ browser }, info) => {
  test.skip(!process.env.ALMACEN_VIDEO || !/^(chromium|webkit)-390x844$/.test(info.project.name), 'solo con ALMACEN_VIDEO=1');
  test.setTimeout(180000);
  const { copyFileSync, mkdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const dir = join('qa-report', 'almacen', 'bruto');
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ ...info.project.use, recordVideo: { dir, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const { alm } = await alAlmacen(page, mockAlmacen(), undefined, { reduced: false });
  const pausa = (ms) => page.waitForTimeout(ms);
  await pausa(1500);
  // Desde la entrada: las escaleras a la derecha; se toca su cartel y se baja
  await alm.locator('.alm-tag--sitio', { hasText: 'Planta −1' }).click();
  await settled(page);
  expect(await page.evaluate(() => window.__almacen3d.planta())).toBe(BZ);
  await pausa(1500);
  // Abajo: se mira alrededor y se vuelve al pie de la escalera de subida
  await page.evaluate((z) => window.__almacen3d.place(14.0, 9.0, 0.9, z), BZ);
  await pausa(1500);
  await alm.locator('.alm-tag--sitio', { hasText: 'Planta 0' }).click();
  await settled(page);
  expect(await page.evaluate(() => window.__almacen3d.planta())).toBe(0);
  await pausa(1500);
  // Con un mueble en el carrito: al intentar bajar, el aviso de pasar por caja
  await alm.locator('.alm-bar').getByRole('button', { name: 'Directorio' }).click();
  await pausa(600);
  await alm.locator('.alm-dir__item').filter({ has: page.getByText('Ventana al mar', { exact: true }) }).first().click();
  await expect(alm.locator('.alm-card--ficha h4')).toHaveText('Ventana al mar', { timeout: 30000 });
  await settled(page);
  await pausa(800);
  await alm.locator('.alm-card--ficha').getByRole('button', { name: /Añadir al carrito/ }).click();
  await pausa(800);
  await alm.locator('.alm-card__back').click();
  await settled(page);
  await alm.locator('.alm-bar').getByRole('button', { name: 'Directorio' }).click();
  await pausa(600);
  await alm.getByRole('button', { name: 'Bajar a la planta de ropa' }).click();
  await expect(alm.locator('.alm-bloqueo')).toBeVisible({ timeout: 30000 });
  await settled(page);
  for (let i = 0; i < 6; i += 1) {
    await page.mouse.move(40 + i * 10, 300);
    await pausa(450);
  }
  await shot(page, info, '59-video-final');
  await pausa(3000);
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join('qa-report', 'almacen', `escaleras-${info.project.name}.webm`));
});
