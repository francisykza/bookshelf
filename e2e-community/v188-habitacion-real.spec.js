// 1.88 · La habitación de inicio es tu piso del edificio, con Supabase simulado y dos cuentas con pisos distintos: Ana
// (yeso y damero, 2.º B) y Bruno (salvia y barro, 1.º A). Entrada directa, Decorar, salida al edificio, regreso,
// recarga y cambio de cuenta; editar en una vista se ve en la otra; el piso de un vecino no se toca; mientras llega la
// sesión o el piso, un aviso y nunca un piso del piloto.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NEIGHBOURS } from '../src/features/edificio/demo.js';
import { SUPABASE, createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222', email: 'bruno@ejemplo.test' };
const LAB_KEY = 'bookshelf:lab:piso-primera-persona:plano2:lab-1A';

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

function seed() {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true }, { user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'lector-farol', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: BRUNO.id, edificio: 'edificio-1', puerta: '1A' }, { user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout: NEIGHBOURS.find((n) => n.id === '3b').room() }, { user_id: BRUNO.id, layout: NEIGHBOURS.find((n) => n.id === '1a').room() });
  mock.db.libraries.push({ user_id: BRUNO.id, data: { books: [{ id: 'b1', title: 'Biblioteca privada de Bruno' }] }, updated_at: new Date().toISOString() });
  return mock;
}

const layoutOf = (mock, user) => JSON.parse(JSON.stringify(mock.db.pisos.find((p) => p.user_id === user.id).layout));
const isoRoom = (page) => page.evaluate(() => window.__edificioPiso?.room ?? null);
const inner = (page) => page.evaluate(() => window.__pisoLab?.()?.debug() ?? null);

async function enterHome(page) {
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 20000 });
}

/** En Decorar (de la habitación o del edificio): pestaña «Paredes» y un color. */
async function paint(page, pared) {
  await page.locator('.ep-chip[data-cat="casa"]').click();
  await page.locator(`.ep-swatch[data-pared="${pared}"]`).click();
}

test.beforeEach(async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390 en Chromium y WebKit');
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});

test('tu piso en las tres vistas: entrada, Decorar, edificio, regreso y recarga; el del vecino no se toca', async ({ page }, info) => {
  const mock = seed();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await mock.attach(page, ANA);
  // El portal tarda: mientras tanto, un aviso y ningún piso
  let slow = true;
  await page.route(`${SUPABASE}/rest/v1/rpc/edificio_portal**`, async (route) => {
    if (slow) await new Promise((r) => setTimeout(r, 1500));
    return route.fallback();
  });
  const before = layoutOf(mock, ANA);
  await page.goto('/?inicio=habitacion');
  await expect(page.getByText('Abriendo tu piso…')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.plab-stage')).toHaveCount(0);
  await shot(page, info, 'v188-cargando');
  slow = false;

  // Entrada directa: el piso de Ana, tal como está guardado, sin reparaciones ni nada del piloto
  await expect(page.getByRole('heading', { name: 'Tu piso · 2.º B' })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 20000 });
  expect((await inner(page)).piso).toBe(`cuenta:${ANA.id}`);
  await expect(page.locator('.plab-repair')).toHaveCount(0);
  expect(layoutOf(mock, ANA)).toEqual(before);
  expect(await page.evaluate((k) => localStorage.getItem(k), LAB_KEY)).toBeNull();
  await shot(page, info, 'v188-ana-primera-persona');

  // Decorar: el mismo piso; un cambio se guarda en su cuenta y en nada más
  await page.getByRole('button', { name: 'Decorar' }).click();
  await expect(page.locator('.ep-canvas')).toBeVisible();
  const iso = await isoRoom(page);
  expect([iso.pared, iso.suelo, iso.items.length]).toEqual([before.pared, before.suelo, before.items.length]);
  await paint(page, 'noche');
  await expect.poll(() => layoutOf(mock, ANA).pared, { timeout: 8000 }).toBe('noche');
  await expect(page.locator('.plab-saving')).toHaveText('Guardado.');
  expect(layoutOf(mock, ANA).items).toEqual(before.items);
  expect(layoutOf(mock, BRUNO).pared).toBe('salvia');
  await shot(page, info, 'v188-ana-decorar');

  // De vuelta al sillón y al edificio: su piso ya con la pared nueva
  await page.getByRole('button', { name: 'Volver al sillón' }).click();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Al edificio' }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Entrar en tu piso, 2.º B' }).click();
  await expect(page.locator('.ep-canvas')).toBeVisible({ timeout: 15000 });
  expect((await isoRoom(page)).pared).toBe('noche');

  // Editar en el edificio se ve al volver a la habitación
  await page.getByRole('button', { name: 'Decorar' }).first().click();
  await paint(page, 'rosa');
  await expect.poll(() => layoutOf(mock, ANA).pared, { timeout: 8000 }).toBe('rosa');

  // De visita en el piso de Bruno: se mira, no se decora, y su piso no cambia
  await page.goBack();
  await portal.getByRole('button', { name: 'Llamar y entrar en el piso de Bruno, 1.º A' }).click();
  await expect(page.locator('.ep-canvas')).toBeVisible({ timeout: 15000 });
  expect((await isoRoom(page)).pared).toBe('salvia');
  await expect(page.locator('.ep-room-wrap, .ed-room').getByRole('button', { name: 'Decorar' })).toHaveCount(0);
  const bruno = layoutOf(mock, BRUNO);
  await page.goBack();
  await page.goBack();

  // Regreso a la habitación: la pared que se puso en el edificio
  await expect(page.getByRole('heading', { name: 'Tu piso · 2.º B' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Decorar' }).click();
  await expect(page.locator('.ep-canvas')).toBeVisible();
  expect((await isoRoom(page)).pared).toBe('rosa');

  // Recarga: sigue siendo el suyo, con lo último guardado (y Decorar, abierto al recargar, también)
  await page.reload();
  console.log("ESTADO", JSON.stringify(await page.evaluate(() => history.state)));
  await expect(page.locator(".ep-canvas")).toBeVisible({ timeout: 20000 });
  expect((await isoRoom(page)).pared).toBe("rosa");
  await page.getByRole("button", { name: "Volver al sillón" }).click();
  await expect(page.locator(".plab-stage[data-ready]")).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('heading', { name: 'Tu piso · 2.º B' })).toBeVisible();
  expect((await inner(page)).piso).toBe(`cuenta:${ANA.id}`);
  expect(layoutOf(mock, BRUNO)).toEqual(bruno);
  expect(await page.evaluate((k) => localStorage.getItem(k), LAB_KEY)).toBeNull();
  expect(errors).toEqual([]);
});

test('cambio de cuenta: fuera el piso de Ana; Bruno ve el suyo y su biblioteca', async ({ page }, info) => {
  const mock = seed();
  await mock.attach(page, ANA);
  await enterHome(page);
  await expect(page.getByRole('heading', { name: 'Tu piso · 2.º B' })).toBeVisible();
  const ana = layoutOf(mock, ANA);

  // Desde el ordenador del piso, «Cuenta y copias»: la habitación sigue montada debajo
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('navigation', { name: 'Accesos del piso' }).getByRole('button', { name: 'Ordenador' }).click();
  await page.locator('button[data-name="Cuenta y copias"]').click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByLabel('Correo')).toBeVisible();

  // Entra Bruno
  await mock.attach(page, BRUNO);
  const exp = Math.floor(Date.now() / 1000) + 86400;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: BRUNO.id, email: BRUNO.email, role: 'authenticated', aud: 'authenticated', exp })}.firma-de-prueba`;
  await page.route(`${SUPABASE}/auth/v1/token**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: token, refresh_token: 'refresco-de-prueba', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: { id: BRUNO.id, aud: 'authenticated', role: 'authenticated', email: BRUNO.email, app_metadata: {}, user_metadata: {} } }) }));
  await page.getByLabel('Correo').fill(BRUNO.email);
  await page.getByLabel('Contraseña').fill('clave-de-prueba');
  await page.getByRole('button', { name: 'Entrar' }).click();
  // Su biblioteca: la de su cuenta
  await page.getByRole('button', { name: 'Usar estos' }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('bookshelf:v1') ?? '')).toContain('Biblioteca privada de Bruno');
  await page.getByRole('button', { name: 'Cerrar' }).first().click();
  // Y el ordenador, que seguía abierto debajo
  await page.keyboard.press('Escape');

  // La habitación es ya la de Bruno: 1.º A, salvia; nada de Ana
  await expect(page.getByRole('heading', { name: 'Tu piso · 1.º A' })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 20000 });
  expect((await inner(page)).piso).toBe(`cuenta:${BRUNO.id}`);
  await page.getByRole('button', { name: 'Decorar' }).click();
  expect((await isoRoom(page)).pared).toBe('salvia');
  await shot(page, info, 'v188-bruno-tras-cambio');
  expect(layoutOf(mock, ANA)).toEqual(ana);
  expect(mock.db.libraries.find((l) => l.user_id === BRUNO.id).data.books[0].title).toBe('Biblioteca privada de Bruno');
});

test('sin sesión: un aviso y los caminos de siempre, nunca un piso de prueba', async ({ page }, info) => {
  const mock = seed();
  await page.route(`${SUPABASE}/**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  void mock;
  await page.goto('/?inicio=habitacion');
  await expect(page.getByText(/inicia sesión en «Tu cuenta» para entrar/)).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.plab-stage')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Abrir «Tu cuenta»' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Volver a la experiencia anterior' })).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), LAB_KEY)).toBeNull();
  await shot(page, info, 'v188-sin-sesion');
});
