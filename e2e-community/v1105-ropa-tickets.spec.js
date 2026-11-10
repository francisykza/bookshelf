// 2.ª ampliación del Almacén del Puerto (encargo de Francisco del 10-11-2026), bloque 3, con Supabase simulado: la ropa propia
// de la planta de ropa, a la venta con tickets. Se ve con su precio en su zona, se paga desde la cesta (sin rebajas, todo o
// nada y sin cobrar dos veces) y después ya es tuya en el probador. Capturas en qa-report/almacen/.
import { expect, test } from '@playwright/test';
import { ANA, alAlmacen, mockAlmacen, shot } from './almacenHelpers';

const BZ = -4.6;
const settled = (page) => page.waitForFunction(() => window.__almacen3d.settled());
const COMO_VA = { piel: 2, pelo: 'melena', colorPelo: 1, jersey: 0, pantalon: 0, gafas: false, complemento: 'ninguno' };

function conArmario({ prendas = ['jersey:12'], tickets = 100 } = {}) {
  const mock = mockAlmacen({ tickets });
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
async function aZona(page, alm, nombre, [x, y, yaw]) {
  await vista(page, x, y, yaw);
  await alm.locator('.alm-tag--sitio', { hasText: nombre }).click();
  await expect(alm.locator('.alm-card--ropa h4')).toHaveText(nombre);
  await settled(page);
}

test('la ropa de la planta: con su precio, se paga desde la cesta y ya es tuya', async ({ page }, info) => {
  test.skip(!/^(chromium-390x844|webkit-390x844|chromium-1440x900|chromium-360x800)$/.test(info.project.name), 'a 360 y 390 (Chromium y WebKit) y escritorio');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const mock = conArmario();
  const { alm } = await alAlmacen(page, mock);
  // La pared de jerséis, con la ropa nueva colgada
  await vista(page, 5, 12.6, -Math.PI / 2);
  await shot(page, info, '70-pared-jerseis');
  await aZona(page, alm, 'Jerséis', [8.4, 12.6, -Math.PI / 2]);
  const zona = alm.locator('.alm-card--ropa');
  // Lo de la planta va primero, con su precio; lo de las misiones sigue sin precio
  await expect(zona.locator('.alm-prenda').first()).toHaveAttribute('data-origen', 'tienda');
  await expect(zona.locator('[data-prenda="jersey:19"] .alm-prenda__precio')).toHaveText(/30\s*tickets/);
  await expect(zona.locator('[data-prenda="jersey:13"] .alm-prenda__precio')).toHaveCount(0);
  await expect(zona).toContainText('4 de la planta, a la venta');
  await shot(page, info, '71-zona-con-precios');
  await zona.locator('[data-prenda="jersey:19"]').getByRole('button', { name: 'A la cesta' }).click();
  await zona.locator('[data-prenda="jersey:13"]').getByRole('button', { name: 'A la cesta' }).click();
  await zona.locator('.alm-card__back').click();
  await settled(page);
  // Complementos: el gorro de pompón
  await aZona(page, alm, 'Gafas y complementos', [8.4, 10.2, Math.PI]);
  await zona.locator('[data-prenda="complemento:pompon"]').getByRole('button', { name: 'A la cesta' }).click();
  await zona.locator('.alm-card__back').click();
  await settled(page);
  // La cesta: solo se paga lo de la planta (30 + 16); lo de las misiones no
  await alm.locator('.alm-bar').getByRole('button', { name: /^Cesta/ }).click();
  const cesta = alm.locator('.alm-card--cesta');
  const pago = cesta.locator('.alm-cesta__pago');
  await expect(pago).toContainText('2 prendas de la planta');
  await expect(pago).toContainText('46 tickets');
  await expect(pago).toContainText('Sin rebajas');
  await shot(page, info, '72-cesta-pagar');
  await pago.getByRole('button', { name: 'Pagar 46 tickets' }).click();
  await expect(cesta.locator('.alm-cesta__pagado')).toContainText('Pagado: Jersey cuadros de leñador, Gorro de pompón (46 tickets)');
  await expect(cesta.locator('.alm-cesta__pago')).toHaveCount(0);
  expect(mock.db.piso_cuentas[ANA.id].tickets).toBe(54);
  expect(mock.db.diarias[ANA.id].prendas).toEqual(['jersey:12', 'jersey:19', 'complemento:pompon']);
  await expect(cesta.locator('[data-prenda="jersey:19"]')).toContainText('Ya es tuya');
  await shot(page, info, '73-pagado');
  // En el probador ya es tuya: se pone y se guarda
  await cesta.getByRole('button', { name: 'Al probador' }).click();
  const prob = alm.locator('.alm-card--probador');
  await expect(prob.locator('[data-prenda="jersey:19"]')).toBeVisible({ timeout: 15000 });
  await settled(page);
  await expect(prob.locator('[data-prenda="jersey:19"]')).not.toHaveAttribute('data-prestada', 'true');
  await prob.locator('[data-prenda="jersey:19"]').click();
  await prob.getByRole('tab', { name: 'Extras' }).click();
  await prob.locator('[data-prenda="complemento:pompon"]').click();
  await page.waitForTimeout(300);
  await shot(page, info, '74-probador-ropa-nueva');
  await prob.getByRole('button', { name: 'Listo, me lo quedo' }).click();
  await expect(alm.getByText(/Listo: así vas/)).toBeVisible();
  expect(personajeDe(mock)).toMatchObject({ jersey: 19, complemento: 'pompon' });
  expect(errors).toEqual([]);
});

test('sin tickets suficientes no se paga, y un fallo de red no cobra dos veces', async ({ page }, info) => {
  test.skip(!/^(chromium-390x844|webkit-390x844)$/.test(info.project.name), 'a 390, Chromium y WebKit');
  const mock = conArmario({ tickets: 20 });
  const { alm } = await alAlmacen(page, mock);
  await aZona(page, alm, 'Jerséis', [8.4, 12.6, -Math.PI / 2]);
  const zona = alm.locator('.alm-card--ropa');
  await zona.locator('[data-prenda="jersey:18"]').getByRole('button', { name: 'A la cesta' }).click();
  await alm.locator('.alm-bar').getByRole('button', { name: /^Cesta/ }).click();
  const pago = alm.locator('.alm-card--cesta .alm-cesta__pago');
  await expect(pago.getByRole('button', { name: 'No te llegan los tickets' })).toBeDisabled();
  await expect(pago).toContainText('tienes 20 tickets');
  // Con saldo (la cesta lo vuelve a pedir al abrirse), y la primera respuesta se pierde: el reintento usa la misma clave y no cobra otra vez
  mock.db.piso_cuentas[ANA.id].tickets = 100;
  await alm.locator('.alm-card--cesta .alm-card__back').click();
  await alm.locator('.alm-bar').getByRole('button', { name: /^Cesta/ }).click();
  // Se cobra en el servidor, pero la respuesta no llega
  mock.db.almacen.cortar = 1;
  await pago.getByRole('button', { name: 'Pagar 30 tickets' }).click();
  await expect(alm.locator('.alm-card--cesta .alm-aviso')).toContainText('no se cobrará dos veces');
  await pago.getByRole('button', { name: 'Pagar 30 tickets' }).click();
  await expect(alm.locator('.alm-cesta__pagado')).toContainText('Pagado: Jersey punto de trenzas');
  expect(mock.db.piso_cuentas[ANA.id].tickets).toBe(70);
  await shot(page, info, '75-reintento');
});

test('quien te acompaña en la planta de ropa se ve abajo, no en la nave', async ({ page }, info) => {
  test.skip(!/^chromium-390x844$/.test(info.project.name), 'a 390');
  const { alm } = await alAlmacen(page, mockAlmacen());
  const amiga = { piel: 3, pelo: 'rizos', colorPelo: 3, jersey: 19, pantalon: 13, gafas: true, complemento: 'pompon' };
  await page.evaluate((a) => window.__almacen3d.setPeers([{ uid: 'bea', avatar: a, x: 11.5, y: 13.5, z: -4.6, yaw: Math.PI }]), amiga);
  await vista(page, 11.5, 9.2, 0);
  await page.waitForTimeout(600);
  await shot(page, info, '76-amiga-abajo');
  // El pulso dice «ropa» cuando estás abajo
  expect(await page.evaluate(() => window.__almacen3d.pose().z)).toBe(BZ);
  await expect(alm.locator('.alm-bar').getByRole('button', { name: /^Cesta/ })).toBeVisible();
});

test('vídeo: bajar, elegir ropa de la planta, pagarla en la cesta y ponérsela', async ({ browser }, info) => {
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
  await alm.locator('.alm-tag--sitio', { hasText: 'Planta −1' }).click();
  await settled(page);
  await pausa(1200);
  // Pantalones: la pana mostaza
  await alm.locator('.alm-tag--sitio', { hasText: 'Pantalones' }).click();
  const zona = alm.locator('.alm-card--ropa');
  await expect(zona.locator('h4')).toHaveText('Pantalones', { timeout: 30000 });
  await settled(page);
  await pausa(1500);
  await zona.locator('[data-prenda="pantalon:11"]').getByRole('button', { name: 'A la cesta' }).click();
  await pausa(900);
  await zona.locator('.alm-card__back').click();
  await settled(page);
  await pausa(900);
  // Jerséis: el de rombos
  await alm.locator('.alm-tag--sitio', { hasText: 'Jerséis' }).click();
  await expect(zona.locator('h4')).toHaveText('Jerséis', { timeout: 30000 });
  await settled(page);
  await pausa(1500);
  await zona.locator('[data-prenda="jersey:21"]').getByRole('button', { name: 'A la cesta' }).click();
  await pausa(900);
  await zona.locator('.alm-card__back').click();
  await settled(page);
  await pausa(1500);
  // La cesta: pagar
  await alm.locator('.alm-bar').getByRole('button', { name: /^Cesta/ }).click();
  const cesta = alm.locator('.alm-card--cesta');
  await expect(cesta.locator('.alm-cesta__pago')).toContainText('52 tickets');
  await pausa(1800);
  await cesta.getByRole('button', { name: 'Pagar 52 tickets' }).click();
  await expect(cesta.locator('.alm-cesta__pagado')).toBeVisible();
  await pausa(2200);
  // Al probador: ya es tuyo
  await cesta.getByRole('button', { name: 'Al probador' }).click();
  const prob = alm.locator('.alm-card--probador');
  await expect(prob.locator('[data-prenda="jersey:21"]')).toBeVisible({ timeout: 30000 });
  await settled(page);
  await pausa(1200);
  await prob.locator('[data-prenda="jersey:21"]').click();
  await pausa(1200);
  await prob.getByRole('tab', { name: 'Pantalón' }).click();
  await pausa(500);
  await prob.locator('[data-prenda="pantalon:11"]').click();
  await pausa(1500);
  await prob.getByRole('button', { name: 'Listo, me lo quedo' }).click();
  await expect(alm.getByText(/Listo: así vas/)).toBeVisible();
  await settled(page);
  await shot(page, info, '77-video-final');
  await pausa(3000);
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join('qa-report', 'almacen', `ropa-tickets-${info.project.name}.webm`));
  expect(personajeDe(mock)).toMatchObject({ jersey: 21, pantalon: 11 });
  expect(mock.db.piso_cuentas[ANA.id].tickets).toBe(48);
});
