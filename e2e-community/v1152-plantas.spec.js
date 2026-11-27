// 1.152, bloque 2 · El edificio crece por plantas (Francisco, 26-11-2026: «Crece con plantas»), con Supabase simulado. El
// edificio de Bruno tiene sus 3 plantas llenas; Bruno le da una llave a Ana (el telefonillo avisa de que crecerá) y, al
// mudarse, el edificio estrena la 4.ª planta, en la calle 3D y en el telefonillo. Un edificio de 5 plantas, lleno, se ve entero
// y su llave dice que no cabe nadie más. Las reglas de verdad, en src/features/edificio/__tests__/edificioPlantas.rls.test.js.
// Capturas en qa-report/v1152/; con PLANTAS_VIDEO=1, el vídeo.
import { expect, test } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { NEIGHBOURS } from '../src/features/edificio/demo.js';
import { alEdificio } from './entrada';

const DIR = join('qa-report', 'v1152');
const CON_PISO = NEIGHBOURS.filter((n) => typeof n.room === 'function');
const tam = (info) => info.project.name.replace(/^chromium-/, '');
const shot = async (page, info, nombre) => {
  mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: join(DIR, `${nombre}-${tam(info)}.png`) });
};
const uid = (n) => {
  const h = '0123456789abcdef'[n];
  return `${h.repeat(8)}-${h.repeat(4)}-4${h.repeat(3)}-8${h.repeat(3)}-${h.repeat(12)}`;
};
const NOMBRES = ['Bruno', 'Carla', 'Dani', 'Elena', 'Fran', 'Gala', 'Hugo', 'Irene', 'Juan'];

/** El edificio de Bruno con `puertas` ocupadas por sus amigos; Ana vive sola en el suyo. */
function seed(puertas) {
  const mock = createMockSupabase({ edificio_vecinos: [], edificio_llaves: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-ana', puerta: '2B' });
  puertas.forEach((puerta, k) => {
    const id = uid(k + 2);
    mock.db.profiles.push({ user_id: id, alias: NOMBRES[k], avatar_id: k % 2 ? 'gato-lector' : 'lector-farol', community_enabled: true });
    mock.db.edificio_vecinos.push({ user_id: id, edificio: 'edificio-bruno', puerta });
    mock.db.pisos.push({ user_id: id, layout: CON_PISO[k % CON_PISO.length].room() });
  });
  mock.db.edificio_llaves.push({ codigo: 'PUERTA23', edificio: 'edificio-bruno', de: uid(2), caduca: new Date(Date.now() + 5 * 86400000).toISOString() });
  return mock;
}

async function preparar(page, mock, quien = ANA) {
  await mock.attach(page, quien);
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    localStorage.setItem('bookshelf:telefonillo', '1');
  });
}

async function alPortal(page) {
  await page.goto('/');
  await alEdificio(page);
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await expect(portal.getByRole('button', { name: /El telefonillo del portal/ })).toBeAttached({ timeout: 20000 });
  await page.waitForTimeout(900);
  return portal;
}

const SEIS = ['1A', '1B', '2A', '2B', '3A', '3B'];

async function recorrido(page, info, { capturas = true } = {}) {
  // Bruno da la llave con sus 3 plantas llenas: el telefonillo avisa de que el edificio crecerá
  const portal = await alPortal(page);
  await expect(portal.locator('.ed-window', { hasText: '4.º' })).toHaveCount(0);
  if (capturas) await shot(page, info, '01-tres-plantas-llenas');
  await portal.getByRole('button', { name: /El telefonillo del portal/ }).click();
  const tel = page.locator('.ed-tel__placa');
  await expect(tel.getByText('6 vecinos en 3 plantas · 4 puertas libres')).toBeVisible();
  await tel.getByRole('button', { name: 'Dar una llave' }).click();
  await expect(tel.locator('[data-tel="crece"]')).toContainText('estrenará la 4.ª planta');
  await page.waitForTimeout(300);
  if (capturas) await shot(page, info, '02-telefonillo-crecera');
}

test('con las 3 plantas llenas, el telefonillo avisa de que el edificio crecerá', async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844|1440x900)$/.test(info.project.name), '360, 390 y escritorio');
  const mock = seed(SEIS);
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await preparar(page, mock, { id: uid(2) });
  await recorrido(page, info);
  expect(errores).toEqual([]);
});

test('Ana se muda con la llave: el edificio estrena la 4.ª planta', async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844|1440x900)$/.test(info.project.name), '360, 390 y escritorio');
  const mock = seed(SEIS);
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await preparar(page, mock);
  const portal = await alPortal(page);
  await portal.getByRole('button', { name: /El telefonillo del portal/ }).click();
  const tel = page.locator('.ed-tel__placa');
  await tel.getByRole('button', { name: 'Tengo una llave' }).click();
  await tel.getByLabel('Escribe la llave que te han dado').fill('PUERTA23');
  await tel.getByRole('button', { name: 'Mirar la llave' }).click();
  await expect(tel.locator('[data-llave="vista"]')).toContainText('6 vecinos');
  await tel.getByRole('button', { name: 'Mudarme' }).click();
  await expect(page.locator('.ed-tel-hecho')).toContainText('Ya vives en el edificio de Bruno.');
  const mia = mock.db.edificio_vecinos.find((v) => v.user_id === ANA.id);
  expect(mia).toMatchObject({ edificio: 'edificio-bruno' });
  expect(mia.puerta).toMatch(/^4[AB]$/);
  // La calle, con la 4.ª planta: su placa con «Tu piso» y la de al lado, libre
  await expect(portal.getByRole('button', { name: `Entrar en tu piso, 4.º ${mia.puerta[1]}` })).toBeAttached({ timeout: 20000 });
  await expect(portal.getByRole('img', { name: `4.º ${mia.puerta[1] === 'A' ? 'B' : 'A'}: puerta libre` })).toBeAttached();
  await page.locator('.ed-tel-hecho').getByRole('button', { name: 'Entendido' }).click();
  await page.waitForTimeout(900);
  await shot(page, info, '03-cuatro-plantas');
  await portal.getByRole('button', { name: /El telefonillo del portal/ }).click();
  await expect(tel.getByText('7 vecinos en 4 plantas · 3 puertas libres')).toBeVisible();
  await expect(tel.getByRole('button', { name: `Entrar en tu piso, 4.º ${mia.puerta[1]}` })).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, info, '04-telefonillo-cuatro-plantas');
  expect(errores).toEqual([]);
});

test('un edificio de 5 plantas, lleno: se ve entero y la llave dice que no cabe nadie', async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844|1440x900)$/.test(info.project.name), '360, 390 y escritorio');
  // Ana ya vive en el de Bruno, con 10 vecinos (ella en el 5.º B)
  const mock = seed(['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A']);
  mock.db.edificio_vecinos.find((v) => v.user_id === ANA.id).edificio = 'edificio-bruno';
  mock.db.edificio_vecinos.find((v) => v.user_id === ANA.id).puerta = '5B';
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await preparar(page, mock);
  const portal = await alPortal(page);
  await expect(portal.getByRole('button', { name: 'Entrar en tu piso, 5.º B' })).toBeAttached();
  await expect(portal.getByRole('button', { name: 'Llamar y entrar en el piso de Juan, 5.º A' })).toBeAttached();
  await expect(portal.locator('.ed-door--free')).toHaveCount(0);
  // Que la vista termine de subir hasta el cartel (las placas se esconden mientras se mueve)
  await page.waitForTimeout(1500);
  await shot(page, info, '05-cinco-plantas');
  await portal.getByRole('button', { name: /El telefonillo del portal/ }).click();
  const tel = page.locator('.ed-tel__placa');
  await expect(tel.getByText('10 vecinos en 5 plantas · edificio lleno')).toBeVisible();
  await expect(tel.locator('.ed-tel__boton')).toHaveCount(10);
  await page.waitForTimeout(300);
  await shot(page, info, '06-telefonillo-cinco-plantas');
  await tel.getByRole('button', { name: 'Dar una llave' }).click();
  await expect(tel.getByText('Tu edificio está lleno: no queda ninguna puerta para dar.')).toBeVisible();
  expect(errores).toEqual([]);
});

test('vídeo de las plantas', async ({ browser }, info) => {
  test.skip(!process.env.PLANTAS_VIDEO || !/^chromium-390x844$/.test(info.project.name), 'solo con PLANTAS_VIDEO=1');
  test.setTimeout(120000);
  const dir = join(DIR, 'video');
  const bruto = join(dir, 'bruto');
  mkdirSync(bruto, { recursive: true });
  const context = await browser.newContext({ ...info.project.use, recordVideo: { dir: bruto, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const mock = seed(SEIS);
  await preparar(page, mock);
  const portal = await alPortal(page);
  await portal.getByRole('button', { name: /El telefonillo del portal/ }).click();
  const tel = page.locator('.ed-tel__placa');
  await tel.getByRole('button', { name: 'Tengo una llave' }).click();
  await tel.getByLabel('Escribe la llave que te han dado').pressSequentially('PUER TA23', { delay: 60 });
  await tel.getByRole('button', { name: 'Mirar la llave' }).click();
  await page.waitForTimeout(1200);
  await tel.getByRole('button', { name: 'Mudarme' }).click();
  await expect(page.locator('.ed-tel-hecho')).toBeVisible();
  await page.waitForTimeout(1800);
  await page.locator('.ed-tel-hecho').getByRole('button', { name: 'Entendido' }).click();
  await portal.getByRole('button', { name: /El telefonillo del portal/ }).click();
  await page.waitForTimeout(2200);
  await tel.getByRole('button', { name: 'Colgar' }).click();
  await page.waitForTimeout(1500);
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join(dir, '1152-plantas.webm'));
});
