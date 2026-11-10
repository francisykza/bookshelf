// 2.ª ampliación del Almacén del Puerto (encargo de Francisco del 10-11-2026), bloque 2, con Supabase simulado: la planta de
// ropa por zonas, el escaparate con maniquíes, la cesta y los probadores, que bajan aquí. Lo que no es tuyo se prueba, pero
// no se guarda. Capturas en qa-report/almacen/.
import { expect, test } from '@playwright/test';
import { ANA, alAlmacen, mockAlmacen, shot } from './almacenHelpers';

const BZ = -4.6;
const settled = (page) => page.waitForFunction(() => window.__almacen3d.settled());
const COMO_VA = { piel: 2, pelo: 'melena', colorPelo: 1, jersey: 0, pantalon: 0, gafas: false, complemento: 'ninguno' };

function conArmario(prendas = ['jersey:12']) {
  const mock = mockAlmacen();
  mock.db.personajes = true;
  mock.db.pisos.push({ user_id: ANA.id, layout: { v: 1, pared: 0, suelo: 'tablas', items: [] }, personaje: { ...COMO_VA } });
  mock.db.diarias = { [ANA.id]: { prendas, dias: {} } };
  return mock;
}
const personajeDe = (mock) => mock.db.pisos.find((p) => p.user_id === ANA.id).personaje;
const vista = async (page, x, y, yaw) => {
  await page.evaluate(([a, b, c, z]) => window.__almacen3d.place(a, b, c, z), [x, y, yaw, BZ]);
  await page.waitForTimeout(350);
};

test('la planta de ropa: zonas, escaparate y probadores', async ({ page }, info) => {
  test.skip(!/360x800|390x844|430x932|1440x900/.test(info.project.name), '360, 390, 430 y escritorio');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const { alm } = await alAlmacen(page, mockAlmacen());
  for (const [nombre, x, y, yaw] of [
    ['60-planta-desde-escaleras', 16.2, 9.4, -0.96],
    ['61-jerseis', 5, 12.6, -Math.PI / 2],
    ['62-pantalones-fiesta', 11.5, 9.2, 0],
    ['63-complementos', 8.4, 10.2, Math.PI],
    ['64-escaparate', 10.6, 21.6, 0],
    ['65-probadores', 11.0, 5.2, Math.PI],
  ]) {
    await vista(page, x, y, yaw);
    await shot(page, info, nombre);
  }
  // Abajo, la barra lleva la cesta en vez del carrito
  await expect(alm.locator('.alm-bar').getByRole('button', { name: /^Cesta/ })).toBeVisible();
  await expect(alm.locator('.alm-bar').getByRole('button', { name: /^Carrito/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('la cesta: de la zona al probador, y lo que no es tuyo solo se prueba', async ({ page }, info) => {
  test.skip(!/^(chromium-390x844|webkit-390x844|chromium-1440x900)$/.test(info.project.name), 'a 390 (Chromium y WebKit) y escritorio');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const mock = conArmario();
  const { alm } = await alAlmacen(page, mock);
  // El letrero de la zona de jerséis abre su papel
  await vista(page, 8.4, 12.6, -Math.PI / 2);
  await alm.locator('.alm-tag--sitio', { hasText: 'Jerséis' }).click();
  const zona = alm.locator('.alm-card--ropa');
  await expect(zona.locator('h4')).toHaveText('Jerséis');
  await settled(page);
  // De serie, ya es tuya; la de las misiones que tienes, también; la que no, dice cómo se gana
  await expect(zona.locator('[data-prenda="jersey:0"]')).toContainText('De serie: ya es tuya');
  await expect(zona.locator('[data-prenda="jersey:12"]')).toContainText('Ya es tuya');
  await expect(zona.locator('[data-prenda="jersey:13"]')).toContainText('Se gana con las misiones del día');
  // La de casino y estiba no cuelgan aquí: están en «Fiesta y faena»
  await expect(zona.locator('[data-prenda="jersey:16"]')).toHaveCount(0);
  await zona.locator('[data-prenda="jersey:13"]').getByRole('button', { name: 'A la cesta' }).click();
  await zona.locator('[data-prenda="jersey:12"]').getByRole('button', { name: 'A la cesta' }).click();
  await expect(alm.locator('.alm-bar').getByRole('button', { name: 'Cesta: 2 prendas' })).toBeVisible();
  expect(await page.evaluate(() => window.__almacen3d.cestaN())).toBe(2);
  await shot(page, info, '66-zona-jerseis');
  // La cesta, desde la barra (y se guarda en el dispositivo)
  await alm.locator('.alm-bar').getByRole('button', { name: /^Cesta/ }).click();
  const cesta = alm.locator('.alm-card--cesta');
  await expect(cesta.locator('.alm-prenda')).toHaveCount(2);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:almacen-cesta')))).toEqual(['jersey:13', 'jersey:12']);
  await cesta.locator('.alm-card__back').click();
  await settled(page);
  await vista(page, 8.4, 12.6, -Math.PI / 2);
  await page.waitForTimeout(400);
  await shot(page, info, '67-con-la-cesta');
  // Al probador con la cesta: la prestada se ve marcada; ponérsela no se puede guardar
  await alm.locator('.alm-bar').getByRole('button', { name: /^Cesta/ }).click();
  await alm.locator('.alm-card--cesta').getByRole('button', { name: 'Al probador' }).click();
  const prob = alm.locator('.alm-card--probador');
  await expect(prob.locator('[data-prenda="jersey:13"]')).toHaveAttribute('data-prestada', 'true', { timeout: 15000 });
  await settled(page);
  await prob.locator('[data-prenda="jersey:13"]').click();
  await expect(prob.getByRole('button', { name: 'Aún no es tuyo' })).toBeDisabled();
  await expect(prob).toContainText('Se gana con las misiones del día');
  await page.waitForTimeout(300);
  await shot(page, info, '68-probador-prestada');
  // Con la tuya, sí
  await prob.locator('[data-prenda="jersey:12"]').click();
  await prob.getByRole('button', { name: 'Listo, me lo quedo' }).click();
  await expect(alm.getByText(/Listo: así vas/)).toBeVisible();
  expect(personajeDe(mock)).toMatchObject({ jersey: 12 });
  expect(errors).toEqual([]);
});

test('vídeo: bajar, elegir en dos zonas, la cesta y el probador', async ({ browser }, info) => {
  test.skip(!process.env.ALMACEN_VIDEO || !/^(chromium|webkit)-390x844$/.test(info.project.name), 'solo con ALMACEN_VIDEO=1');
  test.setTimeout(240000);
  const { copyFileSync, mkdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const dir = join('qa-report', 'almacen', 'bruto');
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ ...info.project.use, recordVideo: { dir, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const mock = conArmario();
  const { alm } = await alAlmacen(page, mock, undefined, { reduced: false });
  const pausa = (ms) => page.waitForTimeout(ms);
  await pausa(1200);
  // Bajar por la escalera mecánica
  await alm.locator('.alm-tag--sitio', { hasText: 'Planta −1' }).click();
  await settled(page);
  await pausa(1500);
  // Pantalones: andando hasta la isla, uno a la cesta
  await alm.locator('.alm-tag--sitio', { hasText: 'Pantalones' }).click();
  const zona = alm.locator('.alm-card--ropa');
  await expect(zona.locator('h4')).toHaveText('Pantalones', { timeout: 30000 });
  await settled(page);
  await pausa(1200);
  const pantalon = await zona.locator('.alm-prenda').nth(2).getAttribute('data-prenda');
  await zona.locator('.alm-prenda').nth(2).getByRole('button', { name: 'A la cesta' }).click();
  await pausa(1000);
  await zona.locator('.alm-card__back').click();
  await settled(page);
  await pausa(1200);
  // Jerséis: uno tuyo y otro que aún no lo es
  await alm.locator('.alm-tag--sitio', { hasText: 'Jerséis' }).click();
  await expect(zona.locator('h4')).toHaveText('Jerséis', { timeout: 30000 });
  await settled(page);
  await pausa(1000);
  for (const p of ['jersey:12', 'jersey:13']) {
    await zona.locator(`[data-prenda="${p}"]`).scrollIntoViewIfNeeded();
    await zona.locator(`[data-prenda="${p}"]`).getByRole('button', { name: 'A la cesta' }).click();
    await pausa(900);
  }
  await zona.locator('.alm-card__back').click();
  await settled(page);
  await pausa(1800);
  // La cesta y, con ella, al probador
  await alm.locator('.alm-bar').getByRole('button', { name: /^Cesta/ }).click();
  await pausa(1500);
  await alm.locator('.alm-card--cesta').getByRole('button', { name: 'Al probador' }).click();
  const prob = alm.locator('.alm-card--probador');
  await expect(prob.locator('.alm-percha').first()).toBeVisible({ timeout: 30000 });
  await settled(page);
  await pausa(1500);
  await prob.locator('[data-prenda="jersey:13"]').click();
  await pausa(2200);
  await prob.locator('[data-prenda="jersey:12"]').click();
  await pausa(1200);
  await prob.getByRole('tab', { name: 'Pantalón' }).click();
  await pausa(600);
  await prob.locator(`[data-prenda="${pantalon}"]`).click();
  await pausa(1500);
  // Si ese pantalón aún no es tuyo, se vuelve al de serie para poder quedarse con el jersey
  if (await prob.getByRole('button', { name: 'Aún no es tuyo' }).count()) {
    await prob.locator('[data-prenda="pantalon:0"]').click();
    await pausa(1000);
  }
  await prob.getByRole('button', { name: 'Listo, me lo quedo' }).click();
  await expect(alm.getByText(/Listo: así vas/)).toBeVisible();
  await settled(page);
  await shot(page, info, '69-video-final');
  await pausa(3000);
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join('qa-report', 'almacen', `planta-ropa-${info.project.name}.webm`));
  expect(personajeDe(mock)).toMatchObject({ jersey: 12 });
});
