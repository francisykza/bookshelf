// 1.66 (SPEC §66) · Inventario de muebles del edificio, con Supabase simulado: la balda solo ofrece lo que tienes y
// cuántas copias te quedan; lo agotado se ve apagado y no se saca; «Tu mudanza» deja elegir seis comunes una sola vez y
// llegan a la balda. La autorización real está en src/features/edificio/__tests__/inventario.rls.test.js.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

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
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await panel.getByRole('button', { name: /^Entrar en tu piso/ }).click({ timeout: 15000 });
  return page.getByRole('dialog', { name: 'Tu piso' });
}

test('la balda con tus copias, lo agotado apagado y «Tu mudanza» con seis comunes', async ({ page }, info) => {
  test.skip(!/320x640|390x844|1440x900/.test(info.project.name), '320, 390 (Chromium y WebKit) y escritorio');
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const mine = await openMyFlat(page, mock);
  await expect(mine.locator('.ep-shelf')).toBeVisible();

  // De inicio: los diez del piso inicial, todos ya colocados (agotados); lo que no tienes no está en la balda
  const sillon = mine.getByRole('button', { name: 'Añadir sillón (no te quedan)' });
  await expect(sillon).toBeVisible();
  await expect(sillon).toHaveClass(/is-out/);
  await expect(mine.getByRole('button', { name: /^Añadir sofá/ })).toHaveCount(0);
  await sillon.click();
  await expect(mine.locator('.ep-status')).toHaveText(/No te quedan más: sillón ya está en tu piso/);
  await expect.poll(() => mock.db.pisos.find((p) => p.user_id === ANA.id)?.layout.items.filter((i) => i.id === 'sillon').length).toBe(1);
  await shot(page, info, 'v166-balda-agotado');

  // Tu mudanza: seis comunes (dos sillas), una sola vez; el sofá es poco común desde la 1.67 y no se ofrece
  await mine.getByRole('button', { name: 'Elige tus 6 muebles' }).click();
  const start = page.getByRole('region', { name: 'Tu mudanza' });
  await expect(start).toBeVisible();
  const llevar = start.getByRole('button', { name: 'Llevármelos' });
  await expect(llevar).toBeDisabled();
  await expect(start.getByRole('button', { name: /^Sofá/ })).toHaveCount(0);
  for (const name of ['Silla', 'Silla', 'Mesa baja', 'Banco', 'Sillón', 'Sillón']) await start.getByRole('button', { name: new RegExp(`^${name}`) }).first().click();
  await expect(start.getByText('La caja está llena.')).toBeVisible();
  await shot(page, info, 'v166-mudanza');
  // Se puede quitar uno de la caja y cambiarlo
  await start.getByRole('button', { name: 'Quitar banco de la caja' }).click();
  await start.getByRole('button', { name: /^Mesa baja/ }).click();
  await llevar.click();
  await expect(start).toHaveCount(0);
  await expect(mine.getByRole('button', { name: 'Elige tus 6 muebles' })).toHaveCount(0);
  expect(mock.db.piso_inventario[ANA.id]).toMatchObject({ silla: 2, sillon: 3, 'mesa-baja': 3 });

  // Ya en la balda: dos sillones libres; al poner uno, queda uno
  await mine.locator('.ep-chip', { hasText: 'Para sentarse' }).click();
  await expect(mine.getByRole('button', { name: 'Añadir silla (te quedan 2)' })).toBeVisible();
  await mine.getByRole('button', { name: 'Añadir sillón (te quedan 2)' }).click();
  await expect(mine.getByRole('button', { name: 'Añadir sillón (te quedan 1)' })).toBeVisible();
  await expect.poll(() => mock.db.pisos.find((p) => p.user_id === ANA.id)?.layout.items.filter((i) => i.id === 'sillon').length, { timeout: 8000 }).toBe(2);
  await shot(page, info, 'v166-balda-copias');
  expect(errors).toEqual([]);
});
