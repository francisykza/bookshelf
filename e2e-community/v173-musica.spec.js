// 1.73, con Supabase simulado: la melodía «Dos balcones» del edificio (instrucciones de Francisco del 2-11-2026) y el
// edificio a pantalla completa en el móvil. La música se lee del estado que `edificio/music.js` publica solo en
// desarrollo (`window.__edificioMusic`). Sin un iPhone real: el bucle sin huecos en Safari no se puede oír aquí.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_AVATAR } from '../src/features/edificio/actor.js';
import { starterRoom } from '../src/features/edificio/demo.js';
import { createMockSupabase } from './mockSupabase';

test.skip(true, 'Fase 1: Francisco retiró «Dos balcones» de la selección automática del edificio; el módulo y el archivo se conservan');

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };

function seed() {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.personajes = true;
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout: starterRoom(), personaje: DEFAULT_AVATAR });
  const inv = {};
  for (const i of starterRoom().items) inv[i.id] = (inv[i.id] ?? 0) + 1;
  mock.db.piso_cuentas = { [ANA.id]: { inicio_elegido: true, tickets: 30, sin_raro: 0 } };
  mock.db.piso_inventario = { [ANA.id]: inv };
  return mock;
}

const music = (page) => page.evaluate(() => window.__edificioMusic?.() ?? null);

async function openEdificio(page) {
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  return page.getByRole('dialog', { name: 'El edificio del puerto' });
}

test('la melodía del edificio: una sola, sigue en los pisos (más baja) y se va al salir', async ({ page, context }, info) => {
  // El WebKit de Playwright en Windows no tiene Web Audio (ni AudioContext): ahí la música no se puede probar
  test.skip(!/chromium-390x844/.test(info.project.name), 'Chromium 390 (el WebKit de Playwright en Windows no trae Web Audio)');
  const mock = seed();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 45, bottom: 30, left: 0, right: 0 } });
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);

  const panel = await openEdificio(page);
  await expect.poll(() => music(page).then((m) => m?.playing), { timeout: 10000 }).toBe(true);
  const portal = await music(page);
  expect(portal.starts).toBe(1);
  expect(portal.inside).toBe(false);
  // El bucle sin el silencio del codificador: empieza después de 0 y acaba antes del final del archivo
  expect(portal.loop[0]).toBeGreaterThanOrEqual(0);
  expect(portal.loop[1]).toBeLessThanOrEqual(portal.loop[2]);
  expect(portal.loop[1] - portal.loop[0]).toBeGreaterThan(40);

  // Pantalla completa: el panel empieza arriba del todo
  expect(await panel.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(0);
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, 'v173-portal.png') });

  // En tu piso: la misma reproducción, más bajita
  await panel.getByRole('button', { name: /^Entrar en tu piso/ }).click({ timeout: 15000 });
  await expect(page.getByRole('dialog', { name: 'Tu piso' }).locator('canvas.ep-canvas')).toBeVisible();
  const piso = await music(page);
  expect(piso.starts).toBe(1);
  expect(piso.inside).toBe(true);
  expect(piso.level).toBeLessThan(portal.level);
  await page.screenshot({ path: join(dir, 'v173-piso.png') });

  // De vuelta en la fachada, el volumen de antes
  await page.getByRole('button', { name: 'Volver al portal' }).click();
  await expect.poll(() => music(page).then((m) => m.inside)).toBe(false);
  expect((await music(page)).level).toBeCloseTo(portal.level, 5);
  expect((await music(page)).starts).toBe(1);

  // Salir: se desvanece y se detiene
  await page.getByRole('button', { name: 'Cerrar el edificio' }).click();
  await expect.poll(() => music(page).then((m) => m.playing), { timeout: 5000 }).toBe(false);

  // Entrar dos veces seguidas no superpone dos reproducciones
  await openEdificio(page);
  await expect.poll(() => music(page).then((m) => m.playing), { timeout: 10000 }).toBe(true);
  await page.getByRole('button', { name: 'Cerrar el edificio' }).click();
  await openEdificio(page);
  await page.waitForTimeout(2000);
  const twice = await music(page);
  expect(twice.playing).toBe(true);
  expect(twice.starts).toBeLessThanOrEqual(3);
  expect(errors).toEqual([]);
});

test('con el sonido de la app quitado, el edificio no suena', async ({ page }, info) => {
  test.skip(!/chromium-390x844/.test(info.project.name), 'Chromium 390');
  const mock = seed();
  await mock.attach(page, ANA);
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!localStorage.getItem('bookshelf:v1')) localStorage.setItem('bookshelf:v1', JSON.stringify({ version: 6, books: [], settings: { sound: false } }));
  });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await openEdificio(page);
  await page.waitForTimeout(2000);
  const m = await music(page);
  expect(m === null || (!m.playing && !m.wanted)).toBe(true);
});
