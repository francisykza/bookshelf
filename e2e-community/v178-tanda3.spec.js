// 1.78 · Tanda 3 del edificio (encargo de Francisco del 3-11-2026), con Supabase simulado: muebles nuevos de todas las
// rarezas en tu piso (con el perrito, que se mueve solo encima de su cojín, y el búho místico en su peana), el conjunto
// «Noche estrellada» con su polvo de estrellas, y la fachada con la gaviota lejana, la estrella fugaz y las luciérnagas.
// Con movimiento reducido, todo quieto.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PRENDAS } from '../src/features/edificio/actor.js';
import { starterRoom } from '../src/features/edificio/demo.js';
import { addItem } from '../src/features/edificio/room.js';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const NUEVOS = ['perrito', 'chimenea', 'piano', 'telescopio', 'perchero', 'cesto-mantas', 'tapiz', 'buho-estrellas'];
const ESTRELLAS = { piel: 2, pelo: 'rizos', colorPelo: 0, jersey: 14, pantalon: 8, gafas: false, complemento: 'capa' };

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

function seed() {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.personajes = true;
  mock.db.misticos = true;
  mock.db.diarias = { [ANA.id]: { prendas: [...PRENDAS], dias: {} } };
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  let layout = starterRoom();
  for (const id of NUEVOS) layout = addItem(layout, id, { near: { x: 4, y: 3 } }).room ?? layout;
  layout = addItem(layout, 'jarron', { near: { x: 4, y: 3 } }).room ?? layout;
  mock.db.pisos.push({ user_id: ANA.id, layout, personaje: ESTRELLAS });
  const inv = {};
  for (const i of layout.items) inv[i.id] = (inv[i.id] ?? 0) + 1;
  mock.db.piso_cuentas = { [ANA.id]: { inicio_elegido: true, tickets: 30, sin_raro: 0 } };
  mock.db.piso_inventario = { [ANA.id]: inv };
  return { mock, layout };
}

async function toPortal(page, mock) {
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  return page.getByRole('dialog', { name: 'El edificio del puerto' });
}

const frame = (page) => page.evaluate(() => document.querySelector('canvas.ep-canvas').toDataURL());

test('tu piso con la tanda nueva: el perrito se mueve solo y la capa deja polvo de estrellas', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|1440x900)$/.test(info.project.name), '360, 390 y escritorio en Chromium');
  const { mock, layout } = seed();
  for (const id of [...NUEVOS, 'jarron']) expect(layout.items.some((i) => i.id === id), id).toBe(true);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const panel = await toPortal(page, mock);
  // La fachada, con lo nuevo de su capa de vida
  await expect(panel.locator('.ed-gull--far')).toHaveCount(1, { timeout: 15000 });
  await expect(panel.locator('.ed-shoot')).toHaveCount(1);
  await expect(panel.locator('.ed-firefly')).toHaveCount(7);
  await expect(panel.locator('.ed-facade')).not.toHaveClass(/is-arriving/, { timeout: 5000 });
  await shot(page, info, 'v178-fachada');

  await panel.getByRole('button', { name: /^Entrar en tu piso/ }).click({ timeout: 15000 });
  const mine = page.getByRole('dialog', { name: 'Tu piso' });
  const canvas = mine.locator('canvas.ep-canvas');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(800);
  // Vivo: dos momentos dan dibujos distintos
  const a = await frame(page);
  await page.waitForTimeout(500);
  expect(await frame(page)).not.toBe(a);
  await shot(page, info, 'v178-piso-tanda3');
  // De tarde, las estrellas de la ropa y la lumbre se encienden
  await mine.getByRole('button', { name: 'Luz de tarde' }).click();
  await page.waitForTimeout(600);
  await shot(page, info, 'v178-piso-tanda3-tarde');
  expect(errors).toEqual([]);
});

test('con movimiento reducido, el piso con mascota, búho y capa se queda quieto', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), '390 en Chromium');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { mock } = seed();
  const panel = await toPortal(page, mock);
  await panel.getByRole('button', { name: /^Entrar en tu piso/ }).click({ timeout: 15000 });
  await expect(page.locator('canvas.ep-canvas')).toBeVisible();
  await page.waitForTimeout(500);
  const a = await frame(page);
  await page.waitForTimeout(700);
  expect(await frame(page)).toBe(a);
});
