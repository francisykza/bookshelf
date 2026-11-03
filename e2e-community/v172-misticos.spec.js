// Místicos, bloque 2 (docs/qa/misticos.md), con Supabase simulado: en tu piso, el místico que tienes sale en su
// pestaña de la balda y se coloca sobre su peana; en el armario, la fila «Te acompaña» con tus legendarios (y nada
// si no tienes ninguno); el compañero se guarda y el vecino lo ve detrás de tu personaje. La autorización real está en
// src/features/edificio/__tests__/misticos.rls.test.js.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_AVATAR } from '../src/features/edificio/actor.js';
import { starterRoom } from '../src/features/edificio/demo.js';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222', email: 'bruno@ejemplo.test' };

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

function seed({ misticos = true } = {}) {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.personajes = true;
  mock.db.misticos = misticos;
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true }, { user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'lector-farol', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' }, { user_id: BRUNO.id, edificio: 'edificio-1', puerta: '1A' });
  mock.db.pisos.push({ user_id: ANA.id, layout: starterRoom(), personaje: DEFAULT_AVATAR }, { user_id: BRUNO.id, layout: starterRoom(), personaje: { ...DEFAULT_AVATAR, pelo: 'rizos' } });
  const inv = {};
  for (const i of starterRoom().items) inv[i.id] = (inv[i.id] ?? 0) + 1;
  if (misticos) Object.assign(inv, { 'farol-azul': 1, dragoncillo: 1 });
  mock.db.piso_cuentas = { [ANA.id]: { inicio_elegido: true, tickets: 30, sin_raro: 0 }, [BRUNO.id]: { inicio_elegido: true, tickets: 30, sin_raro: 0 } };
  mock.db.piso_inventario = { [ANA.id]: inv, [BRUNO.id]: { ...inv } };
  return mock;
}

async function toPortal(page, mock, user) {
  await mock.attach(page, user);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  return page.getByRole('dialog', { name: 'El edificio del puerto' });
}

/** Toca a tu personaje (abre su armario en la balda). */
async function tapActor(page) {
  const at = await page.locator('canvas.ep-canvas').evaluate((c) => {
    const [x, y] = c.dataset.actorAt.split(',').map(Number);
    const r = c.getBoundingClientRect();
    return { x: r.left + (x / c.width) * r.width, y: r.top + (y / c.height) * r.height };
  });
  await page.mouse.click(at.x, at.y);
}

test('en tu piso: colocar un místico y elegir quién te acompaña (se guarda)', async ({ page }, info) => {
  test.skip(!/390x844|1440x900/.test(info.project.name), '390 (Chromium y WebKit) y escritorio');
  const mock = seed();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const panel = await toPortal(page, mock, ANA);
  await panel.getByRole('button', { name: /^Entrar en tu piso/ }).click({ timeout: 15000 });
  const mine = page.getByRole('dialog', { name: 'Tu piso' });
  await expect(mine.locator('canvas.ep-canvas')).toBeVisible();
  await mine.getByRole('button', { name: 'Decorar' }).click();

  // La pestaña «Místicos» de la balda trae el farol (el dragón no: acompaña, no se coloca)
  await mine.getByRole('button', { name: 'Místicos' }).click();
  await expect(mine.locator('.ep-item[data-id="dragoncillo"]')).toHaveCount(0);
  await mine.locator('.ep-item[data-id="farol-azul"]').click();
  await expect.poll(() => mock.db.pisos.find((p) => p.user_id === ANA.id).layout.items.some((i) => i.id === 'farol-azul'), { timeout: 10000 }).toBe(true);

  // El armario (1.77): la pestaña «Compañía» con «Sin compañía» y el dragón; se guarda con «Listo»
  await tapActor(page);
  await mine.getByRole('tab', { name: 'Compañía' }).click();
  const pal = mine.getByRole('group', { name: 'Compañía' });
  await expect(pal.getByRole('button')).toHaveText(['Sin compañía', 'Dragoncillo de escamas rojas']);
  await pal.getByRole('button', { name: 'Dragoncillo de escamas rojas' }).click();
  await expect(pal.getByRole('button', { name: 'Dragoncillo de escamas rojas' })).toHaveAttribute('aria-pressed', 'true');
  await mine.getByRole('button', { name: 'Listo' }).click();
  await expect.poll(() => mock.db.pisos.find((p) => p.user_id === ANA.id).companero).toBe('dragoncillo');
  await shot(page, info, 'v172-misticos-armario');
  expect(errors).toEqual([]);
});

test('de visita: el piso del vecino con su compañero detrás', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390 (Chromium y WebKit)');
  const mock = seed();
  mock.db.pisos.find((p) => p.user_id === ANA.id).companero = 'dragoncillo';
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const panel = await toPortal(page, mock, BRUNO);
  await panel.getByRole('button', { name: 'Llamar y entrar en el piso de Ana lectora, 2.º B' }).click({ timeout: 15000 });
  const ana = page.getByRole('dialog', { name: 'Piso de Ana lectora' });
  await expect(ana.locator('canvas.ep-canvas')).toBeVisible();
  await page.waitForTimeout(1200);
  await shot(page, info, 'v172-misticos-visita');
  expect(errors).toEqual([]);
});

test('sin ningún místico: ni pestaña en la balda ni compañeros en el armario', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390 (Chromium y WebKit)');
  const mock = seed({ misticos: false });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const panel = await toPortal(page, mock, ANA);
  await panel.getByRole('button', { name: /^Entrar en tu piso/ }).click({ timeout: 15000 });
  const mine = page.getByRole('dialog', { name: 'Tu piso' });
  await expect(mine.locator('canvas.ep-canvas')).toBeVisible();
  await expect(mine.getByRole('button', { name: 'Místicos' })).toBeHidden();
  await tapActor(page);
  await mine.getByRole('tab', { name: 'Aspecto' }).click();
  await expect(mine.getByRole('group', { name: 'Piel' })).toBeVisible();
  await mine.getByRole('tab', { name: 'Compañía' }).click();
  await expect(mine.getByRole('group', { name: 'Compañía' }).getByRole('button')).toHaveText(['Sin compañía']);
  expect(errors).toEqual([]);
});
