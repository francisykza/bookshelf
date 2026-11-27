// 1.151, bloque 1 · Edificios de amigos y el telefonillo del portal (Francisco, 26-11-2026: «Cada edificio debería tener como
// vecinos únicamente a tus amigos»; «que fuera del edificio tengas como un telefonillo»), con Supabase simulado. Ana estrena su
// edificio sola; desde el telefonillo hace una llave y la comparte, usa la que le dio Bruno y se muda con su piso; y se va otra
// vez a un edificio propio. El enlace `#llave=` abre la misma mudanza al entrar en la app. Las reglas de verdad están en
// src/features/edificio/__tests__/edificioAmigos.rls.test.js. Capturas en qa-report/v1151/; con TEL_VIDEO=1, el vídeo.
import { expect, test } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { alEdificio } from './entrada';

const BRUNO = { id: '22222222-2222-4222-8222-222222222222' };
const CARLA = { id: '33333333-3333-4333-8333-333333333333' };
const DIR = join('qa-report', 'v1151');
const tam = (info) => info.project.name.replace(/^chromium-/, '');
const shot = async (page, info, nombre) => {
  mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: join(DIR, `${nombre}-${tam(info)}.png`) });
};

function seed() {
  const mock = createMockSupabase({ edificio_vecinos: [], edificio_llaves: [] });
  mock.db.profiles.push(
    { user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true },
    { user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'lector-farol', community_enabled: true },
    { user_id: CARLA.id, alias: 'Carla', avatar_id: 'gato-lector', community_enabled: true },
  );
  // Cada cuenta, su edificio: Ana vive sola; Bruno y Carla, juntos en el de Bruno
  mock.db.edificio_vecinos.push(
    { user_id: ANA.id, edificio: 'edificio-ana', puerta: '2B' },
    { user_id: BRUNO.id, edificio: 'edificio-bruno', puerta: '1A' },
    { user_id: CARLA.id, edificio: 'edificio-bruno', puerta: '3A' },
  );
  // La llave que Bruno le ha dado a Ana (por WhatsApp, por ejemplo)
  mock.db.edificio_llaves.push({ codigo: 'PUERTA23', edificio: 'edificio-bruno', de: BRUNO.id, caduca: new Date(Date.now() + 5 * 86400000).toISOString() });
  mock.db.siguienteLlave = 'KLMN2345';
  return mock;
}

async function preparar(page, mock) {
  await mock.attach(page, ANA);
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    // Compartir: se apunta lo que se compartiría (en el móvil abre la hoja del sistema)
    navigator.share = async (datos) => {
      window.__compartido = datos;
    };
  });
}

async function alPortal(page) {
  await page.goto('/');
  await alEdificio(page);
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await expect(portal.getByRole('button', { name: /El telefonillo del portal/ })).toBeAttached({ timeout: 20000 });
  await page.waitForTimeout(600);
  return portal;
}

const telefonillo = (page) => page.getByRole('dialog', { name: /telefonillo|llave|Irme/i });

async function recorrido(page, info, { capturas = true } = {}) {
  const portal = await alPortal(page);
  const boton = portal.getByRole('button', { name: /El telefonillo del portal/ });
  await expect(boton).toHaveClass(/is-nuevo/);
  if (capturas) await shot(page, info, '01-portal-telefonillo');
  await boton.click();

  // Sola en su edificio: su puerta, las demás libres, y la llave
  const tel = page.locator('.ed-tel__placa');
  await expect(tel).toBeVisible();
  await expect(tel.getByRole('heading', { name: 'El telefonillo' })).toBeVisible();
  await expect(tel.getByText('Por ahora vives sola o solo en tu edificio.', { exact: false })).toBeVisible();
  await expect(tel.getByRole('button', { name: 'Entrar en tu piso, 2.º B' })).toBeVisible();
  await expect(tel.getByRole('button', { name: /: libre$/ })).toHaveCount(5);
  await expect(tel.getByRole('button', { name: 'Irme del edificio' })).toHaveCount(0);
  await page.waitForTimeout(300);
  if (capturas) await shot(page, info, '02-telefonillo-inicio');

  // Dar una llave: el código, hasta cuándo abre y compartirla
  await tel.getByRole('button', { name: 'Dar una llave' }).click();
  await expect(tel.getByRole('heading', { name: 'La llave de tu edificio' })).toBeVisible();
  await tel.getByRole('button', { name: 'Hacer una llave' }).click();
  await expect(tel.locator('[data-llave="nueva"]')).toContainText('KLMN-2345');
  await expect(tel.locator('[data-llave="nueva"]')).toContainText('Abre hasta el');
  await tel.getByRole('button', { name: 'Compartir la llave' }).click();
  const compartido = await page.evaluate(() => window.__compartido);
  expect(compartido.url).toMatch(/\/#llave=KLMN2345$/);
  await expect(tel.getByText('Tus llaves sin usar')).toBeVisible();
  await page.waitForTimeout(300);
  if (capturas) await shot(page, info, '03-telefonillo-llave');
  await tel.getByRole('button', { name: 'Atrás' }).click();

  // Tengo una llave: la de Bruno, escrita a mano con espacios y en minúsculas
  await tel.getByRole('button', { name: 'Tengo una llave' }).click();
  await tel.getByLabel('Escribe la llave que te han dado').fill('puer ta23');
  await tel.getByRole('button', { name: 'Mirar la llave' }).click();
  await expect(tel.locator('[data-llave="vista"]')).toContainText('Bruno');
  await page.waitForTimeout(300);
  if (capturas) await shot(page, info, '04-telefonillo-usar');
  await tel.getByRole('button', { name: 'Mudarme' }).click();

  // Ya vive con Bruno y Carla, con su piso de siempre
  await expect(page.locator('.ed-tel-hecho')).toContainText('Ya vives en el edificio de Bruno.');
  await expect(portal.getByRole('button', { name: /El telefonillo del portal/ })).toBeAttached({ timeout: 20000 });
  await page.waitForTimeout(600);
  if (capturas) await shot(page, info, '05-mudanza-hecha');
  await page.locator('.ed-tel-hecho').getByRole('button', { name: 'Entendido' }).click();
  await portal.getByRole('button', { name: /El telefonillo del portal/ }).click();
  await expect(tel.getByRole('button', { name: 'Llamar al 1.º A: el piso de Bruno' })).toBeVisible();
  await expect(tel.getByRole('button', { name: 'Llamar al 3.º A: el piso de Carla' })).toBeVisible();
  await expect(tel.getByText('3 vecinos en 3 plantas · 7 puertas libres')).toBeVisible();
  await page.waitForTimeout(300);
  if (capturas) await shot(page, info, '06-telefonillo-vecinos');

  // Irse: a un edificio propio, con la misma puerta
  await tel.getByRole('button', { name: 'Irme del edificio' }).click();
  await expect(tel.getByRole('heading', { name: 'Irme del edificio' })).toBeVisible();
  if (capturas) await shot(page, info, '07-telefonillo-irse');
  await tel.getByRole('button', { name: 'Irme', exact: true }).click();
  await expect(page.locator('.ed-tel-hecho')).toContainText('Ya vives en tu propio edificio');
}

test('el telefonillo: dar una llave, usar la de un amigo e irse', async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844|1440x900)$/.test(info.project.name), '360, 390 y escritorio');
  const mock = seed();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await preparar(page, mock);
  await recorrido(page, info);
  // En el servidor simulado: la llave de Bruno, gastada; Ana, en su propio edificio con la puerta que tenía en el de Bruno
  expect(mock.db.edificio_llaves.find((l) => l.codigo === 'PUERTA23').usada).toBe(true);
  expect(mock.db.edificio_vecinos.find((v) => v.user_id === ANA.id)).toMatchObject({ puerta: '1B' });
  expect(mock.db.edificio_vecinos.find((v) => v.user_id === ANA.id).edificio).not.toBe('edificio-bruno');
  expect(errores).toEqual([]);
});

test('el enlace de una llave: la nota al entrar, mudarse e ir al edificio', async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844|1440x900)$/.test(info.project.name), '360, 390 y escritorio');
  const mock = seed();
  await preparar(page, mock);
  await page.goto('/#llave=PUERTA23');
  const nota = page.locator('[data-llave="enlace"]');
  await expect(nota).toBeVisible({ timeout: 20000 });
  await expect(nota).toContainText('PUER-TA23');
  await expect(nota).toContainText('Bruno');
  // El código sale de la barra de direcciones en cuanto se lee
  expect(new URL(page.url()).hash).toBe('');
  await page.waitForTimeout(400);
  await shot(page, info, '08-enlace-nota');
  await nota.getByRole('button', { name: 'Mudarme' }).click();
  const hecho = page.locator('[data-llave="hecho"]');
  await expect(hecho).toContainText('Ya vives en el edificio de Bruno.');
  expect(await page.evaluate(() => localStorage.getItem('bookshelf:llave'))).toBeNull();
  await hecho.getByRole('button', { name: 'Ir al edificio' }).click();
  const tel = page.getByRole('dialog', { name: 'El edificio del puerto' }).getByRole('button', { name: /El telefonillo del portal/ });
  await expect(tel).toBeAttached({ timeout: 20000 });
  await tel.click();
  await expect(page.locator('.ed-tel__placa').getByRole('button', { name: 'Llamar al 1.º A: el piso de Bruno' })).toBeVisible();
});

test('el enlace sin comunidad: se guarda la llave y se dice qué falta', async ({ page }, info) => {
  test.skip(!/^chromium-390x844$/.test(info.project.name), 'solo a 390');
  const mock = seed();
  mock.db.profiles.find((p) => p.user_id === ANA.id).community_enabled = false;
  await preparar(page, mock);
  await page.goto('/#llave=PUERTA23');
  const aviso = page.locator('[data-llave="aviso"]');
  await expect(aviso).toContainText('activa «Participar en la comunidad»', { timeout: 20000 });
  await expect(aviso).toContainText('La llave se queda guardada en este dispositivo.');
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('bookshelf:llave'))).codigo).toBe('PUERTA23');
  await shot(page, info, '09-enlace-sin-comunidad');
});

test('vídeo del telefonillo', async ({ browser }, info) => {
  test.skip(!process.env.TEL_VIDEO || !/^chromium-390x844$/.test(info.project.name), 'solo con TEL_VIDEO=1');
  test.setTimeout(120000);
  const dir = join(DIR, 'video');
  const bruto = join(dir, 'bruto');
  mkdirSync(bruto, { recursive: true });
  const context = await browser.newContext({ ...info.project.use, recordVideo: { dir: bruto, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const mock = seed();
  await preparar(page, mock);
  await recorrido(page, info, { capturas: false });
  await page.waitForTimeout(1200);
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join(dir, '1151-telefonillo.webm'));
});
