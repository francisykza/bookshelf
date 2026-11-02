// 1.70 (SPEC §70) · Misiones del día en tu piso, con Supabase simulado: la hoja «Hoy en tu piso» enseña las tres de
// hoy, cada una se marca al hacerla en la habitación, con las tres llega una prenda (nunca tickets) y en el armario lo
// que aún no tienes se ve apagado y no se pone. La autorización real está en
// src/features/edificio/__tests__/diarias.rls.test.js.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { missionsOf, todayKey } from '../src/features/edificio/dailyMissions.js';
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

const piso = (page) => ({
  item: (id) => page.evaluate((x) => window.__edificioPiso.room.items.find((i) => i.id === x), id),
  screenOfItem: (uid) => page.evaluate((u) => window.__edificioPiso.screenOfItem(u), uid),
  screenOf: (x, y) => page.evaluate(([a, b]) => window.__edificioPiso.screenOf(a, b, 0), [x, y]),
});

async function decorating(mine, on) {
  const btn = mine.getByRole('button', { name: on ? 'Decorar' : 'Terminar' });
  if (await btn.count()) await btn.click();
}

/** Elige un mueble desde la pestaña «En el piso». */
async function pick(mine, name) {
  await decorating(mine, true);
  await mine.locator('.ep-chip[data-cat="lista"]').click();
  await mine.locator('.ep-inroom__item', { hasText: name }).first().click();
}

async function doMission(page, mine, id) {
  const p = piso(page);
  if (id === 'sentarse') {
    await decorating(mine, false);
    const at = await p.screenOfItem((await p.item('sillon')).uid);
    await page.mouse.click(at.x, at.y);
    await expect(mine.locator('canvas.ep-canvas')).toHaveAttribute('data-actor', 'sit', { timeout: 10000 });
  } else if (id === 'tarde') {
    await mine.getByRole('button', { name: 'Luz de tarde' }).click();
  } else if (id === 'pasear') {
    await decorating(mine, false);
    for (const [x, y] of [[1.5, 7.5], [7.5, 7.5], [1.5, 7.5]]) {
      const at = await p.screenOf(x, y);
      await page.mouse.click(at.x, at.y);
      await page.waitForTimeout(200);
    }
  } else if (id === 'nuevo') {
    await decorating(mine, true);
    await mine.locator('.ep-chip[data-cat="asientos"]').click();
    await mine.getByRole('button', { name: /^Añadir silla/ }).click();
  } else if (id === 'armario') {
    await decorating(mine, true);
    // 1.77: el armario es un modo propio del piso y lo elegido se guarda con «Listo»
    await mine.locator('.ep-chip[data-cat="personaje"]').click();
    await mine.locator('.ep-dress').getByRole('tab', { name: 'Aspecto' }).click();
    await mine.locator('.ep-dress').getByRole('group', { name: 'Pelo' }).getByRole('button', { name: 'Rizos' }).click();
    await mine.locator('.ep-dress').getByRole('button', { name: 'Listo' }).click();
  } else if (id === 'color') {
    await pick(mine, 'Sillón');
    await mine.getByRole('button', { name: 'Color' }).click();
  } else if (id === 'mover') {
    await pick(mine, 'Sillón');
    const canvas = mine.locator('canvas.ep-canvas');
    await canvas.focus();
    // Una flecha hacia donde haya hueco
    for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
      const before = JSON.stringify(await p.item('sillon'));
      await page.keyboard.press(key);
      if (JSON.stringify(await p.item('sillon')) !== before) break;
    }
  }
  // Suelta lo elegido para la siguiente
  if (await mine.locator('.ep-tools:not([hidden])').count()) await mine.getByRole('button', { name: 'Listo' }).click();
}

test('misiones del día: la hoja, las tres hechas y la prenda en el armario', async ({ page }, info) => {
  test.skip(!/320x640|390x844|1440x900/.test(info.project.name), '320, 390 (Chromium y WebKit) y escritorio');
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.personajes = true;
  mock.db.diarias = {};
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const mine = await openMyFlat(page, mock);
  const today = missionsOf(todayKey());

  // La hoja de hoy: las tres misiones y la prenda que llega con ellas
  const hoy = mine.getByRole('button', { name: /^Hoy en tu piso \(0 de 3\)/ });
  await expect(hoy).toBeVisible();
  await hoy.click();
  const card = mine.getByRole('region', { name: 'Hoy en tu piso' });
  for (const m of today) await expect(card.getByText(m.texto)).toBeVisible();
  await expect(card.getByText('Bufanda')).toBeVisible();
  // En el armario, lo que se gana se ve apagado y no se pone
  await decorating(mine, true);
  await mine.locator('.ep-chip[data-cat="personaje"]').click();
  const extras = mine.locator('.ep-dress').getByRole('group', { name: 'Complemento' });
  await expect(extras.getByRole('button', { name: 'Bufanda (se gana con las misiones del día)' })).toHaveClass(/is-locked/);
  await extras.getByRole('button', { name: /^Bufanda/ }).click();
  await expect(mine.locator('.ep-status')).toHaveText('Bufanda: se gana con las misiones del día.');
  await shot(page, info, 'v170-hoja');
  await mine.getByRole('button', { name: 'Al piso' }).click();

  for (const [k, m] of today.entries()) {
    await doMission(page, mine, m.id);
    await expect(mine.getByRole('button', { name: new RegExp(`^Hoy en tu piso \\(${k + 1} de 3\\)`) })).toBeAttached({ timeout: 8000 });
  }
  // La hoja se abre sola con la prenda ganada
  await expect(card.getByText('Nueva: Bufanda')).toBeVisible();
  expect(mock.db.diarias[ANA.id].prendas).toEqual(['complemento:bufanda']);
  // Ningún ticket por las misiones del día
  expect(mock.db.piso_cuentas).toBeUndefined();
  await expect(card.locator('li.is-done')).toHaveCount(3);
  await shot(page, info, 'v170-hecho');
  await mine.getByRole('button', { name: /^Hoy en tu piso/ }).click();

  // La bufanda ya se puede poner (y se guarda); el gorro, todavía no
  await decorating(mine, true);
  await mine.locator('.ep-chip[data-cat="personaje"]').click();
  await extras.getByRole('button', { name: 'Bufanda', exact: true }).click();
  await expect(extras.getByRole('button', { name: 'Gorro de lana (se gana con las misiones del día)' })).toBeVisible();
  await mine.locator('.ep-dress').getByRole('button', { name: 'Listo' }).click();
  await expect.poll(() => mock.db.pisos.find((p) => p.user_id === ANA.id)?.personaje?.complemento, { timeout: 8000 }).toBe('bufanda');
  await shot(page, info, 'v170-bufanda');
  expect(errors).toEqual([]);
});

test('sin la migración de las misiones, ni hoja ni prendas por ganar', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name) || /webkit/.test(info.project.name), 'una vez basta');
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.personajes = true;
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  const mine = await openMyFlat(page, mock);
  await expect(mine.locator('canvas.ep-canvas')).toHaveAttribute('data-actor', 'stand');
  await expect(mine.getByRole('button', { name: /^Hoy en tu piso/ })).toBeHidden();
  await mine.locator('.ep-chip[data-cat="personaje"]').click();
  await expect(mine.locator('.ep-dress').getByRole('group', { name: 'Complemento' }).getByRole('button')).toHaveCount(1);
  await expect(mine.locator('.ep-dress').getByRole('group', { name: 'Jersey' }).getByRole('button')).toHaveCount(8);
});
