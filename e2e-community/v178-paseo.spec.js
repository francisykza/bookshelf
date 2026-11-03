// 1.78 · Tu personaje va andando (encargo de Francisco del 3-11-2026, «que el personaje se vea físicamente yendo a los
// sitios»), con Supabase simulado: al tocar la tienda o la limusina, sale del portal, cruza el muelle y entra; luego,
// lo de siempre; si te acompaña un legendario, va detrás. Tocar otra vez mientras anda lo salta. Con movimiento reducido, directo.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PRENDAS } from '../src/features/edificio/actor.js';
import { starterRoom } from '../src/features/edificio/demo.js';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const ESTRELLAS = { piel: 2, pelo: 'rizos', colorPelo: 0, jersey: 14, pantalon: 8, gafas: false, complemento: 'capa' };

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

async function toPortal(page, { companero = null } = {}) {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.personajes = true;
  mock.db.misticos = Boolean(companero);
  mock.db.diarias = { [ANA.id]: { prendas: [...PRENDAS], dias: {} } };
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  const layout = starterRoom();
  mock.db.pisos.push({ user_id: ANA.id, layout, personaje: ESTRELLAS, ...(companero ? { companero } : {}) });
  const inv = {};
  for (const i of layout.items) inv[i.id] = (inv[i.id] ?? 0) + 1;
  if (companero) inv[companero] = 1;
  mock.db.piso_cuentas = { [ANA.id]: { inicio_elegido: true, tickets: 30, sin_raro: 0 } };
  mock.db.piso_inventario = { [ANA.id]: inv };
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await expect(panel.locator('.ed-facade')).not.toHaveClass(/is-arriving/, { timeout: 15000 });
  return panel;
}

const walkerBox = (panel) => panel.locator('.ed-walker').evaluate((el) => el.getBoundingClientRect().left);

test('a la tienda y a la limusina, tu personaje va andando desde el portal', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|1440x900)$/.test(info.project.name), '360, 390 y escritorio en Chromium');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  let panel = await toPortal(page);

  // A la tienda: sale del portal y anda hacia la derecha
  await panel.getByRole('button', { name: 'Entrar en la tienda del bajo' }).click();
  await expect(panel.locator('.ed-walker')).toHaveCount(1);
  await page.waitForTimeout(450);
  const x0 = await walkerBox(panel);
  await shot(page, info, 'v178-paseo-tienda');
  await page.waitForTimeout(400);
  expect(await walkerBox(panel)).toBeGreaterThan(x0);
  // Aún no ha entrado: la tienda se abre al llegar
  await expect(page.getByRole('dialog', { name: 'La tienda del bajo' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'La tienda del bajo' })).toBeVisible({ timeout: 8000 });
  await page.getByRole('dialog', { name: 'La tienda del bajo' }).getByRole('button', { name: /^Atrás|^Volver|^Salir/ }).first().click();

  // A la limusina: baja hacia el coche y sube; luego, el viaje
  panel = page.getByRole('dialog', { name: 'El edificio del puerto' });
  const limo = panel.getByRole('button', { name: 'Coger la limusina al Gran Hotel' });
  await expect(limo).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(700);
  await limo.click();
  await expect(panel.locator('.ed-walker')).toHaveCount(1);
  await page.waitForTimeout(500);
  await shot(page, info, 'v178-paseo-limusina');
  await expect(page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' })).toBeVisible({ timeout: 8000 });
  expect(errors).toEqual([]);
});

test('el legendario que te acompaña va detrás de ti hasta la limusina', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|1440x900)$/.test(info.project.name), '360, 390 y escritorio en Chromium');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const panel = await toPortal(page, { companero: 'dragoncillo' });
  await panel.getByRole('button', { name: 'Coger la limusina al Gran Hotel' }).click();
  await expect(panel.locator('.ed-walker')).toHaveCount(2);
  await expect(panel.locator('.ed-walker--pal canvas')).toHaveCount(1);
  await page.waitForTimeout(700);
  await shot(page, info, 'v178-paseo-companero');
  // Se mueve: dos momentos dan dibujos distintos
  const pic = () => panel.locator('.ed-walker--pal canvas').evaluate((c) => c.toDataURL());
  const a = await pic();
  await page.waitForTimeout(250);
  expect(await pic()).not.toBe(a);
  await expect(page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' })).toBeVisible({ timeout: 8000 });
  expect(errors).toEqual([]);
});

test('tocar otra vez mientras anda lo salta', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), '390 en Chromium');
  const panel = await toPortal(page);
  const limo = panel.getByRole('button', { name: 'Coger la limusina al Gran Hotel' });
  await limo.click();
  await expect(panel.locator('.ed-walker')).toHaveCount(1);
  await limo.click();
  await expect(page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' })).toBeVisible({ timeout: 1500 });
});

test('con movimiento reducido, directo a la tienda, sin paseo', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), '390 en Chromium');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const panel = await toPortal(page);
  await panel.getByRole('button', { name: 'Entrar en la tienda del bajo' }).click();
  await expect(page.getByRole('dialog', { name: 'La tienda del bajo' })).toBeVisible({ timeout: 3000 });
  await expect(page.locator('.ed-walker')).toHaveCount(0);
});
