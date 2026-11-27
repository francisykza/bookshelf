// 1.69 (SPEC §69) · Tu personaje en el piso, con Supabase simulado: aparece en tu piso, al tocarlo se abre su armario
// en la balda, el aspecto se guarda en el servidor (o solo en el dispositivo sin la migración), al tocar un sillón va
// andando y se sienta, y al tocar el suelo se levanta y va hasta allí. La autorización real está en
// src/features/edificio/__tests__/personaje.rls.test.js.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { alEdificio } from './entrada';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

async function openMyFlat(page, mock) {
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/');
  await alEdificio(page);
  const panel = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await panel.getByRole('button', { name: /^Entrar en tu piso/ }).click({ timeout: 15000 });
  return page.getByRole('dialog', { name: 'Tu piso' });
}

/** Punto de la pantalla de un punto del dibujo del piso. */
async function artPoint(canvas, ax, ay) {
  const box = await canvas.boundingBox();
  const size = await canvas.evaluate((c) => [c.width, c.height]);
  return { x: box.x + (ax / size[0]) * box.width, y: box.y + (ay / size[1]) * box.height };
}

async function tapActor(page, canvas) {
  const [ax, ay] = (await canvas.getAttribute('data-actor-at')).split(',').map(Number);
  const p = await artPoint(canvas, ax, ay);
  await page.mouse.click(p.x, p.y);
}

test('tu personaje: armario, se guarda, anda y se sienta', async ({ page }, info) => {
  test.skip(!/320x640|390x844|1440x900/.test(info.project.name), '320, 390 (Chromium y WebKit) y escritorio');
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.personajes = true;
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const mine = await openMyFlat(page, mock);
  const canvas = mine.locator('canvas.ep-canvas');
  await expect(canvas).toHaveAttribute('data-actor', 'stand');

  // Tocarlo abre el armario (1.77: un modo propio del piso, con Ropa, Aspecto y Compañía; se guarda con «Listo»)
  await tapActor(page, canvas);
  const wardrobe = mine.locator('.ep-dress');
  await expect(wardrobe).toBeVisible();
  await expect(mine.getByRole('button', { name: 'Al piso' })).toBeVisible();
  await expect(wardrobe.getByRole('tab', { name: 'Ropa' })).toHaveAttribute('aria-selected', 'true');
  await wardrobe.getByRole('group', { name: 'Jersey' }).getByRole('button', { name: 'Ciruela' }).click();
  await wardrobe.getByRole('group', { name: 'Gafas' }).getByRole('button', { name: 'Con gafas' }).click();
  await expect(wardrobe.getByRole('group', { name: 'Gafas' }).getByRole('button', { name: 'Con gafas' })).toHaveAttribute('aria-pressed', 'true');
  await wardrobe.getByRole('tab', { name: 'Aspecto' }).click();
  await wardrobe.getByRole('group', { name: 'Pelo' }).getByRole('button', { name: 'Rizos' }).click();
  await shot(page, info, 'v169-armario');
  await wardrobe.getByRole('button', { name: 'Listo' }).click();
  await expect(wardrobe).toBeHidden();
  await expect.poll(() => mock.db.pisos.find((p) => p.user_id === ANA.id)?.personaje, { timeout: 8000 }).toMatchObject({ pelo: 'rizos', jersey: 6, gafas: true });

  // Sin decorar (desde la 1.78 se entra así), tocar el sillón lo lleva hasta él y se sienta
  const sillon = mock.db.pisos.find((p) => p.user_id === ANA.id).layout.items.find((i) => i.id === 'sillon');
  expect(sillon).toBeTruthy();
  const at = await page.evaluate((uid) => window.__edificioPiso.screenOfItem(uid), sillon.uid);
  await page.mouse.click(at.x, at.y);
  await expect(canvas).toHaveAttribute('data-actor', 'sit', { timeout: 10000 });
  await page.waitForTimeout(300);
  await shot(page, info, 'v169-sentado');

  // Tocar el suelo libre (una celda lejos de los muebles): se levanta y va hasta allí
  const floor = await page.evaluate(() => {
    const piso = window.__edificioPiso;
    for (const [x, y] of [[1, 7], [7, 7], [1, 1], [7, 1], [4, 7], [1, 4]]) if (!piso.room.items.some((i) => i.x <= x && x < i.x + 3 && i.y <= y && y < i.y + 3)) return piso.screenOf(x + 0.5, y + 0.5, 0);
    return piso.screenOf(4.5, 8.5, 0);
  });
  await page.mouse.click(floor.x, floor.y);
  await expect(canvas).toHaveAttribute('data-actor', /walk|stand/);
  await expect(canvas).toHaveAttribute('data-actor', 'stand', { timeout: 10000 });
  expect(errors).toEqual([]);
});

test('sin la migración, el personaje se queda en el dispositivo', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name) || /webkit/.test(info.project.name), 'una vez basta');
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  const mine = await openMyFlat(page, mock);
  const canvas = mine.locator('canvas.ep-canvas');
  await expect(canvas).toHaveAttribute('data-actor', 'stand');
  await tapActor(page, canvas);
  await mine.locator('.ep-dress').getByRole('tab', { name: 'Aspecto' }).click();
  await mine.locator('.ep-dress').getByRole('group', { name: 'Pelo' }).getByRole('button', { name: 'Moño' }).click();
  await mine.locator('.ep-dress').getByRole('button', { name: 'Listo' }).click();
  await expect(page.getByText('Guardado en este dispositivo.')).toBeVisible({ timeout: 8000 });
  expect(await page.evaluate((id) => JSON.parse(localStorage.getItem(`bookshelf:edificio:personaje:${id}`)).pelo, ANA.id)).toBe('mono');
});

// 1.155 (Francisco, 26-11-2026, «Quitarla igualmente»): la visita a un vecino es en 3D y en ella no sale su personaje; la prueba
// «en el piso de un vecino se ve su personaje» se retiró con la vista isométrica.
