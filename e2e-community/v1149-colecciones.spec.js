// 1.149 · Las colecciones del ala nueva del Almacén del Puerto (encargo de Francisco del 26-11-2026), con Supabase simulado:
// las cuatro habitaciones abiertas con sus sets montados («Lumbre y Lana», «Cristal y Helecho», «Buhardilla de Octubre» y la
// colección premium «Medianoche»), la ficha de un mueble acogedor (al doble, sin rebajas) y la de uno premium (su precio en
// tickets y, sin presión, lo que costaría con la suscripción, que aún no existe). Capturas en qa-report/almacen/; con
// ALMACEN_VIDEO=1, un vídeo corto por set en qa-report/almacen/video-1149/.
import { expect, test } from '@playwright/test';
import { ANA, alAlmacen, mockAlmacen, shot } from './almacenHelpers';

const settled = (page) => page.waitForFunction(() => window.__almacen3d.settled());
const O = -Math.PI / 2;
const E = Math.PI / 2;
// [habitación, nombre de la captura, x, y, hacia dónde mira]
const SALAS = [
  ['lumbre', '90-lumbre', 24.3, 20.25, O],
  ['lumbre', '91-lumbre-cerca', 23.7, 18.95, -0.85],
  ['invernadero', '92-invernadero', 24.3, 23.55, O],
  ['invernadero', '93-invernadero-cerca', 23.7, 22.05, -0.85],
  ['octubre', '94-octubre', 22.7, 20.25, E],
  ['octubre', '95-octubre-cerca', 23.3, 21.75, 2.3],
  ['medianoche', '96-medianoche', 22.7, 23.55, E],
  ['medianoche', '97-medianoche-cerca', 23.5, 24.7, 1.95],
];
const EL_SET = { lumbre: 'Chimenea de ladrillo', invernadero: 'Banco de forja', octubre: 'Nido de lectura', medianoche: 'Chéster de terciopelo' };

async function aLaFicha(page, alm, nombre) {
  await alm.locator('.alm-bar').getByRole('button', { name: 'Directorio' }).click();
  await alm.locator('.alm-dir__item').filter({ has: page.getByText(nombre, { exact: true }) }).first().click();
  await expect(alm.locator('.alm-card--ficha h4')).toHaveText(nombre, { timeout: 30000 });
  await settled(page);
}

test('las cuatro habitaciones del ala nueva, abiertas y montadas', async ({ page }, info) => {
  test.skip(!/360x800|390x844|1440x900/.test(info.project.name), '360, 390 y escritorio');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const { alm } = await alAlmacen(page, mockAlmacen());
  for (const [, name, x, y, yaw] of SALAS) {
    await page.evaluate(([x, y, yaw]) => window.__almacen3d.place(x, y, yaw), [x, y, yaw]);
    await settled(page);
    await page.waitForTimeout(250);
    await shot(page, info, name);
  }
  await expect(alm.locator('.alm-cartel', { hasText: 'Próximamente' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('las fichas: lo acogedor, al doble y sin rebajas; lo premium, su precio y el de la suscripción, sin presión', async ({ page }, info) => {
  test.skip(!/^(chromium-390x844|chromium-360x800|chromium-1440x900)$/.test(info.project.name), '360, 390 y escritorio');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const { alm } = await alAlmacen(page, mockAlmacen({ tickets: 700 }));
  const ficha = alm.locator('.alm-card--ficha');
  await aLaFicha(page, alm, 'Chimenea de ladrillo');
  await expect(ficha).toContainText('80 Libocoins');
  await expect(ficha).toContainText('De habitación especial · nunca se rebaja');
  await shot(page, info, '98-ficha-lumbre');
  await alm.locator('.alm-card__back').click();
  await aLaFicha(page, alm, 'Chéster de terciopelo');
  await expect(ficha).toContainText('600 Libocoins');
  await expect(ficha).toContainText('Colección premium · nunca se rebaja');
  await expect(ficha.locator('.alm-ficha__socio')).toContainText('240 Libocoins');
  await expect(ficha.locator('.alm-ficha__socio')).toContainText('con la suscripción de Libotown, cuando llegue');
  await shot(page, info, '99-ficha-premium');
  // Se compra con tickets como cualquier otro mueble
  await alm.getByRole('button', { name: 'Añadir al carrito' }).click();
  await alm.locator('.alm-card__back').click();
  await alm.getByRole('button', { name: /^Carrito: / }).click();
  await alm.locator('.alm-card--carrito').getByRole('button', { name: 'Ir a caja' }).click();
  await settled(page);
  await expect(alm.getByRole('button', { name: /Confirmar compra/ })).toContainText('600 Libocoins');
  await shot(page, info, '99b-caja-premium');
  expect(errors).toEqual([]);
});

test('vídeo corto de cada set montado en su habitación', async ({ browser }, info) => {
  test.skip(!process.env.ALMACEN_VIDEO || !/^chromium-390x844$/.test(info.project.name), 'solo con ALMACEN_VIDEO=1');
  test.setTimeout(400000);
  const { copyFileSync, mkdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const bruto = join('qa-report', 'almacen', 'bruto-1149');
  const dir = join('qa-report', 'almacen', 'video-1149');
  mkdirSync(dir, { recursive: true });
  // [set, desde, hasta]: un paseo lento por delante de la habitación, mirándola, y luego su mueble estrella
  const PASEOS = {
    lumbre: [[24.4, 18.9, -1.0], [24.0, 21.7, -2.25]],
    invernadero: [[24.4, 21.9, -0.75], [24.0, 24.9, -2.1]],
    octubre: [[22.6, 18.9, 1.0], [23.0, 21.7, 2.25]],
    medianoche: [[22.6, 21.9, 0.75], [23.0, 24.9, 2.1]],
  };
  for (const [set, [de, a]] of Object.entries(PASEOS)) {
    const context = await browser.newContext({ ...info.project.use, recordVideo: { dir: bruto, size: { width: 390, height: 844 } } });
    const page = await context.newPage();
    const { alm } = await alAlmacen(page, mockAlmacen({ tickets: 700 }), ANA, { reduced: false });
    await page.evaluate(([x, y, yaw]) => window.__almacen3d.place(x, y, yaw), de);
    await settled(page);
    await page.waitForTimeout(700);
    const pasos = 150;
    for (let i = 1; i <= pasos; i += 1) {
      const t = i / pasos;
      const s = t * t * (3 - 2 * t);
      await page.evaluate(([x, y, yaw]) => window.__almacen3d.place(x, y, yaw), [de[0] + (a[0] - de[0]) * s, de[1] + (a[1] - de[1]) * s, de[2] + (a[2] - de[2]) * s]);
      await page.waitForTimeout(33);
    }
    await page.waitForTimeout(900);
    await aLaFicha(page, alm, EL_SET[set]);
    await page.waitForTimeout(2600);
    const video = page.video();
    await context.close();
    copyFileSync(await video.path(), join(dir, `1149-${set}.webm`));
  }
});
