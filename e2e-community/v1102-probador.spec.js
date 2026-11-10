// 1.102 (SPEC §102) · El probador del Almacén del Puerto, con Supabase simulado: el espejo y las cabinas junto al paso de
// las habitaciones, ponerse delante del espejo, cambiarse solo la ropa que ya se tiene (se ve en el reflejo), «Listo»
// lo guarda y «Volver» lo deja como estaba. Capturas en qa-report/almacen/.
import { expect, test } from '@playwright/test';
import { ANA, alAlmacen, mockAlmacen, shot } from './almacenHelpers';

const settled = (page) => page.waitForFunction(() => window.__almacen3d.settled());
const COMO_VA = { piel: 2, pelo: 'melena', colorPelo: 1, jersey: 0, pantalon: 0, gafas: false, complemento: 'ninguno' };

/** El almacén con tu piso, tu personaje y algo de ropa ganada (misiones, casino y estiba). */
function conArmario(prendas = ['jersey:12', 'complemento:capa', 'jersey:15', 'pantalon:10']) {
  const mock = mockAlmacen();
  mock.db.personajes = true;
  mock.db.pisos.push({ user_id: ANA.id, layout: { v: 1, pared: 0, suelo: 'tablas', items: [] }, personaje: { ...COMO_VA } });
  mock.db.diarias = { [ANA.id]: { prendas, dias: {} } };
  return mock;
}
const personajeDe = (mock) => mock.db.pisos.find((p) => p.user_id === ANA.id).personaje;

async function alEspejo(page, alm) {
  await page.evaluate(() => window.__almacen3d.place(21.1, 4.2, Math.PI));
  await page.waitForTimeout(300);
  await alm.locator('.alm-tag--sitio', { hasText: 'Probador' }).click();
  await expect(alm.locator('.alm-card--probador .alm-percha').first()).toBeVisible({ timeout: 15000 });
  await settled(page);
  await page.waitForTimeout(300);
}

test('el probador: el espejo y las cabinas, delante del espejo y cambiarse', async ({ page }, info) => {
  test.skip(!/360x800|390x844|430x932|1440x900/.test(info.project.name), '360, 390, 430 y escritorio');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const mock = conArmario();
  const { alm } = await alAlmacen(page, mock);
  // Desde el paso, mirando a la entrada de las habitaciones: el espejo y las cabinas
  await page.evaluate(() => window.__almacen3d.place(19.0, 4.2, Math.PI / 2 + 0.5));
  await page.waitForTimeout(300);
  await shot(page, info, '40-probador');
  await alEspejo(page, alm);
  await shot(page, info, '41-espejo');
  const card = alm.locator('.alm-card--probador');
  await card.getByRole('tab', { name: 'Jersey' }).click();
  await card.locator('[data-prenda="jersey:12"]').click();
  await page.waitForTimeout(300);
  await shot(page, info, '42-jersey-coral');
  await card.getByRole('tab', { name: 'Extras' }).click();
  await card.locator('[data-prenda="complemento:capa"]').click();
  await card.getByRole('tab', { name: 'Gafas' }).click();
  await card.getByRole('button', { name: /Con gafas/ }).click();
  await page.waitForTimeout(300);
  await shot(page, info, '43-capa-y-gafas');
  await card.getByRole('button', { name: 'Listo, me lo quedo' }).click();
  await expect(card).toHaveCount(0);
  await expect(alm.getByText(/Listo: así vas/)).toBeVisible();
  expect(personajeDe(mock)).toMatchObject({ jersey: 12, complemento: 'capa', gafas: true, pantalon: 0, piel: 2 });
  await settled(page);
  expect(errors).toEqual([]);
});

test('el probador solo tiene la ropa que ya es tuya, y «Volver» no guarda nada', async ({ page }, info) => {
  test.skip(!/^(chromium-390x844|webkit-390x844)$/.test(info.project.name), 'a 390, Chromium y WebKit');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const mock = conArmario(['jersey:12']);
  const { alm } = await alAlmacen(page, mock);
  await alEspejo(page, alm);
  const card = alm.locator('.alm-card--probador');
  await expect(card).toContainText('Tienes 1 de');
  await expect(card).toContainText('Aquí no se vende ropa');
  // Lo de serie y lo ganado, sí; lo que no tienes (otra prenda de las misiones, la del casino y la de la estiba), no
  await expect(card.locator('[data-prenda="jersey:0"]')).toBeVisible();
  await expect(card.locator('[data-prenda="jersey:12"]')).toBeVisible();
  for (const p of ['jersey:13', 'jersey:15', 'jersey:17']) await expect(card.locator(`[data-prenda="${p}"]`)).toHaveCount(0);
  await card.getByRole('tab', { name: 'Extras' }).click();
  await expect(card.locator('[data-prenda="complemento:capa"]')).toHaveCount(0);
  await expect(card.locator('[data-prenda="complemento:bufanda"]')).toHaveCount(0);
  // Te pruebas algo y vuelves: no se guarda
  await card.getByRole('tab', { name: 'Jersey' }).click();
  await card.locator('[data-prenda="jersey:12"]').click();
  await expect(card.getByRole('button', { name: 'Como iba' })).toBeEnabled();
  await card.locator('.alm-card__back').click();
  await expect(card).toHaveCount(0);
  await settled(page);
  expect(personajeDe(mock)).toEqual(COMO_VA);
  // Al volver a entrar, vas como ibas
  await alEspejo(page, alm);
  await expect(alm.locator('.alm-card--probador [data-prenda="jersey:0"]')).toHaveAttribute('aria-pressed', 'true');
  await shot(page, info, '44-solo-lo-tuyo');
  expect(errors).toEqual([]);
});

test('vídeo: al probador desde la entrada, cambiarse delante del espejo y quedárselo', async ({ browser }, info) => {
  test.skip(!process.env.ALMACEN_VIDEO || !/^(chromium|webkit)-390x844$/.test(info.project.name), 'solo con ALMACEN_VIDEO=1');
  test.setTimeout(180000);
  const { copyFileSync, mkdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const dir = join('qa-report', 'almacen', 'bruto');
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ ...info.project.use, recordVideo: { dir, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const mock = conArmario();
  const { alm } = await alAlmacen(page, mock, undefined, { reduced: false });
  const pausa = (ms) => page.waitForTimeout(ms);
  await pausa(900);
  // Andando hasta el paso de las habitaciones (por el directorio, a un mueble de la sala) y de ahí al probador
  await alm.locator('.alm-bar').getByRole('button', { name: 'Directorio' }).click();
  await pausa(700);
  const seccion = alm.locator('section.alm-dir__seccion', { hasText: 'Capa y Antifaz' });
  await seccion.scrollIntoViewIfNeeded();
  await seccion.locator('.alm-dir__item').filter({ has: page.getByText('Neón del rayo', { exact: true }) }).click();
  await expect(alm.locator('.alm-card--ficha h4')).toHaveText('Neón del rayo', { timeout: 30000 });
  await settled(page);
  await pausa(900);
  await alm.locator('.alm-card__back').click();
  await settled(page);
  await page.evaluate(() => window.__almacen3d.place(19.0, 4.2, Math.PI / 2 + 0.5));
  await pausa(1500);
  await alm.locator('.alm-tag--sitio', { hasText: 'Probador' }).click();
  const card = alm.locator('.alm-card--probador');
  await expect(card.locator('.alm-percha').first()).toBeVisible({ timeout: 15000 });
  await settled(page);
  await pausa(1500);
  for (const p of ['jersey:3', 'jersey:12', 'jersey:15']) {
    await card.locator(`[data-prenda="${p}"]`).click();
    await pausa(1000);
  }
  await card.getByRole('tab', { name: 'Pantalón' }).click();
  await pausa(500);
  await card.locator('[data-prenda="pantalon:10"]').click();
  await pausa(1000);
  await card.getByRole('tab', { name: 'Extras' }).click();
  await pausa(500);
  await card.locator('[data-prenda="complemento:capa"]').click();
  await pausa(1000);
  await card.getByRole('button', { name: 'Como iba' }).click();
  await pausa(1000);
  await card.getByRole('tab', { name: 'Jersey' }).click();
  await card.locator('[data-prenda="jersey:12"]').click();
  await pausa(600);
  await card.getByRole('tab', { name: 'Extras' }).click();
  await card.locator('[data-prenda="complemento:capa"]').click();
  await pausa(1200);
  await card.getByRole('button', { name: 'Listo, me lo quedo' }).click();
  await expect(alm.getByText(/Listo: así vas/)).toBeVisible();
  await settled(page);
  await pausa(2500);
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join('qa-report', 'almacen', `probador-${info.project.name}.webm`));
  expect(personajeDe(mock)).toMatchObject({ jersey: 12, complemento: 'capa' });
});
