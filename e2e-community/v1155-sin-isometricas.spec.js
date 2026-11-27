// 1.155, bloque 5 · Fuera las vistas isométricas (docs/qa/amigos-vecinos.md; Francisco, 26-11-2026: «borra las vistas
// isometricas»), con Supabase simulado: nunca una cuenta real. A un vecino se le visita directamente en 3D; sin 3D en el
// móvil, el vestíbulo y el casino no se dibujan, pero sus funciones siguen (sustituye a v175-vestibulo, que probaba el
// «Plano» isométrico). Capturas en qa-report/v1155/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { ANA, SALA } from './v190-apoyo';

const DIR = join('qa-report', 'v1155');
const tam = (info) => info.project.name.replace(/^chromium-/, '');
const BEA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const shot = async (page, info, nombre) => {
  mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: join(DIR, `${nombre}-${tam(info)}.png`) });
};

/** Ana y Bea, vecinas del mismo edificio y amigas. `casino`: lo del casino. */
function seed({ casino = null } = {}) {
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.profiles.push({ user_id: BEA, alias: 'Bea', avatar_id: 'lector-farol', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' }, { user_id: BEA, edificio: 'edificio-1', puerta: '1A' });
  mock.db.pisos.push({ user_id: ANA.id, layout: SALA }, { user_id: BEA, layout: SALA });
  mock.db.follows.push({ follower: ANA.id, followed: BEA, created_at: '2026-11-20T10:00:00.000Z' }, { follower: BEA, followed: ANA.id, created_at: '2026-11-20T10:00:00.000Z' });
  if (casino) mock.db.casino = casino;
  return mock;
}

/** Abre la app en tu piso y baja al portal. `sin3d`: el móvil no puede con WebGL. */
async function alPortal(page, mock, { sin3d = false } = {}) {
  await mock.attach(page, ANA);
  await page.addInitScript((sin) => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!sin) return;
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
      return /webgl/.test(kind) ? null : get.call(this, kind, ...rest);
    };
  }, sin3d);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(sin3d ? '/' : '/?inicio=habitacion');
  if (sin3d) {
    await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
    await page.locator('.panorama-nav__btn--next').click();
    await page.waitForTimeout(950);
    await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
    await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  } else {
    await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'Al edificio' }).click();
  }
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await expect(portal.locator('.ed-facade')).not.toHaveClass(/is-arriving/, { timeout: 15000 });
  return portal;
}

async function alHotel(page, portal) {
  await portal.getByRole('button', { name: 'Coger la limusina al Gran Hotel' }).click({ timeout: 15000 });
  const hotel = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' });
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible();
  return hotel;
}

test.beforeEach(({}, info) => {
  test.skip(!/^chromium-(360x800|390x844|1440x900)$/.test(info.project.name), '360, 390 y escritorio');
});

test('a un vecino se le visita directamente en 3D, sin la vista isométrica', async ({ page }, info) => {
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  const portal = await alPortal(page, seed());
  await portal.getByRole('button', { name: 'Llamar y entrar en el piso de Bea, 1.º A' }).click();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.ep-canvas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Entrar en 3D' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ver en isométrica' })).toHaveCount(0);
  // La etiqueta del piso no tapa la tarjeta de lo que está leyendo
  const caja = (sel) => page.locator(sel).evaluate((el) => el.getBoundingClientRect().toJSON());
  expect((await caja('.ed-visita3d__datos')).top).toBeGreaterThanOrEqual((await caja('.ed-inside .ed-head')).bottom);
  await page.waitForTimeout(600);
  await shot(page, info, '01-visita-3d');
  expect(errores).toEqual([]);
});

test('sin 3D, el piso de un vecino no se dibuja y lo dice', async ({ page }, info) => {
  const portal = await alPortal(page, seed(), { sin3d: true });
  await portal.getByRole('button', { name: 'Llamar y entrar en el piso de Bea, 1.º A' }).click();
  await expect(page.locator('.ed-sin3d')).toContainText('No puede dibujar el piso de Bea', { timeout: 15000 });
  await expect(page.locator('.ep-canvas')).toHaveCount(0);
  // La etiqueta del piso, que flota arriba, no tapa el aviso
  const caja = (sel) => page.locator(sel).evaluate((el) => el.getBoundingClientRect().toJSON());
  const [cabeza, aviso] = [await caja('.ed-inside .ed-head'), await caja('.ed-sin3d')];
  expect(aviso.top).toBeGreaterThanOrEqual(cabeza.bottom);
  await shot(page, info, '02-visita-sin-3d');
});

test('sin 3D, el vestíbulo: encargos en la recepción, la botonera del ascensor y salir a la calle', async ({ page }, info) => {
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  const portal = await alPortal(page, seed(), { sin3d: true });
  const hotel = await alHotel(page, portal);
  const entrar = async () => {
    await hotel.getByRole('list', { name: 'Plantas del hotel' }).getByRole('button', { name: 'El vestíbulo' }).focus();
    await page.keyboard.press('Enter');
    const lobby = hotel.getByRole('region', { name: 'El vestíbulo' });
    await expect(lobby.locator('.ed-sin3d')).toContainText('No puede dibujar el vestíbulo', { timeout: 15000 });
    return lobby;
  };
  const lobby = await entrar();
  await expect(lobby.locator('img')).toHaveCount(0);
  await expect(lobby.getByRole('tab', { selected: true })).toHaveCount(0);
  // Los botones se leen: tinta oscura sobre el papel (sin --ep-ink, heredaban el color claro de la plaza)
  expect(await lobby.getByRole('tab', { name: 'Recepción' }).evaluate((el) => getComputedStyle(el).color)).toBe('rgb(59, 38, 24)');
  await shot(page, info, '03-vestibulo-sin-3d');
  // La recepción: los cinco encargos de la semana, en un papel que se cierra con «×»
  await lobby.getByRole('tab', { name: 'Recepción' }).click();
  await expect(lobby.locator('.gh-task')).toHaveCount(5);
  await shot(page, info, '04-vestibulo-encargos');
  await lobby.getByRole('button', { name: 'Cerrar' }).click();
  await expect(lobby.locator('.gh-desk')).toBeHidden();
  // El ascensor: una planta que aún no abre dice qué habrá; la «P» sale a la plaza
  await lobby.getByRole('tab', { name: 'Ascensor' }).click();
  const panel = lobby.getByRole('list', { name: 'Botonera del ascensor' });
  await expect(panel.getByRole('button', { name: /El vestíbulo/ })).toHaveAttribute('aria-current', 'location');
  await panel.getByRole('button', { name: /La terraza/ }).click();
  await expect(lobby.getByText('Abre pronto')).toBeVisible();
  await panel.getByRole('button', { name: /La plaza del muelle/ }).click();
  await expect(lobby).toHaveCount(0);
  // Escape cierra primero el papel y luego sale a la plaza, sin cerrar el hotel
  const otra = await entrar();
  await otra.getByRole('tab', { name: 'Guardarropa' }).click();
  await page.keyboard.press('Escape');
  await expect(otra.locator('.gh-desk')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(otra).toHaveCount(0);
  await expect(hotel).toBeVisible();
  expect(errores).toEqual([]);
});

test('sin 3D, el casino no se dibuja pero se juega igual', async ({ page }, info) => {
  const portal = await alPortal(page, seed({ casino: { fichas: 30, semana: 30 } }), { sin3d: true });
  const hotel = await alHotel(page, portal);
  await hotel.getByRole('button', { name: 'Directorio' }).click();
  await hotel.getByRole('button', { name: /Casino del sótano/ }).click();
  const casino = hotel.getByRole('region', { name: 'El casino del sótano' });
  await expect(casino.locator('.ed-sin3d')).toContainText('No puede dibujar el casino', { timeout: 15000 });
  await expect(casino.locator('.gh-casino__art')).toHaveCount(0);
  await expect(casino.getByRole('img', { name: '30 fichas' })).toBeVisible();
  await expect(casino.getByRole('group', { name: 'Cómo jugar' })).toBeVisible();
  await shot(page, info, '05-casino-sin-3d');
});
