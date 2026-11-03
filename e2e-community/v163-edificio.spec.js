// 1.63 (SPEC §63) · «El edificio del puerto» en la app, con Supabase simulado: la tablet del Salón pregunta entre la
// comunidad y el edificio; el servidor te da puerta; tu piso se decora y se guarda solo; el de un vecino se mira (los
// sellos se quitaron en la 1.78). Quien bloquea o no participa no aparece. La autorización real está en
// src/features/edificio/__tests__/edificio.rls.test.js (Postgres con la migración).
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NEIGHBOURS } from '../src/features/edificio/demo.js';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222' };
const CARLA = { id: '33333333-3333-4333-8333-333333333333' };
const DANI = { id: '44444444-4444-4444-8444-444444444444' };
const ELENA = { id: '88888888-8888-4888-8888-888888888888' };

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

function seed() {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push(
    { user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true },
    { user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'lector-farol', community_enabled: true },
    { user_id: CARLA.id, alias: 'Carla', avatar_id: 'gato-lector', community_enabled: true },
    // Dani bloquea a Ana y Elena no participa en la comunidad: ninguno de los dos aparece
    { user_id: DANI.id, alias: 'Dani Bruma', avatar_id: 'lector-farol', community_enabled: true },
    { user_id: ELENA.id, alias: 'Elena Bruma', avatar_id: 'gato-lector', community_enabled: false },
  );
  mock.db.blocks.push({ blocker: DANI.id, blocked: ANA.id });
  mock.db.edificio_vecinos.push(
    { user_id: BRUNO.id, edificio: 'edificio-1', puerta: '1A' },
    { user_id: ELENA.id, edificio: 'edificio-1', puerta: '1B' },
    { user_id: DANI.id, edificio: 'edificio-1', puerta: '2A' },
    { user_id: CARLA.id, edificio: 'edificio-1', puerta: '3B' },
  );
  mock.db.pisos.push({ user_id: BRUNO.id, layout: NEIGHBOURS.find((n) => n.id === '2a').room() }, { user_id: DANI.id, layout: NEIGHBOURS.find((n) => n.id === '1b').room() });
  mock.db.piso_sellos.push({ de: BRUNO.id, para: ANA.id, sello: 'acogedor' });
  return mock;
}

async function toSalon(page, mock) {
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.waitForFunction(() => document.querySelector('[data-panel="SOCIAL_ROOM"] .scene-base')?.naturalWidth > 0);
}

test('la tablet pregunta; el portal, tu piso guardado en el servidor y la visita', async ({ page }, info) => {
  test.skip(!/390x844|1440x900/.test(info.project.name), '390 (Chromium y WebKit) y escritorio');
  const mock = seed();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await toSalon(page, mock);

  const tablet = page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' });
  await expect(tablet).toBeVisible({ timeout: 15000 });
  await tablet.click();
  await expect(page.getByRole('button', { name: 'Comunidad', exact: true })).toBeVisible();
  await shot(page, info, 'v163-tablet-pregunta');
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();

  // Portal: el servidor le da a Ana la primera puerta libre (2.º B); Dani (bloqueo) y Elena (sin comunidad) no salen
  const panel = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await expect(panel.getByRole('button', { name: 'Entrar en tu piso, 2.º B' })).toBeVisible({ timeout: 15000 });
  await expect(panel.getByRole('button', { name: 'Llamar y entrar en el piso de Bruno, 1.º A' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Llamar y entrar en el piso de Carla, 3.º B' })).toBeVisible();
  await expect(panel.getByText('Dani Bruma')).toHaveCount(0);
  await expect(panel.getByText('Elena Bruma')).toHaveCount(0);
  // 3.º A está libre; las puertas de Dani y Elena se ven como cualquier puerta libre (no se delata un bloqueo)
  await expect(panel.locator('.ed-door--free')).toHaveCount(3);
  // 1.73: el buzón de la fachada se abre al tocarlo, y al tocarlo otra vez se cierra. 1.78: los sellos ya no llegan
  // (sin la migración de vecinos, el buzón está vacío)
  const buzon = panel.getByRole('button', { name: 'Tu buzón, vacío' });
  await buzon.click();
  await expect(panel.getByRole('region', { name: 'Tu buzón' }).getByText(/^Nada por ahora/)).toBeVisible();
  await expect(panel.getByText(/te dejó «Qué acogedor»/)).toHaveCount(0);
  await buzon.click();
  await expect(panel.getByRole('region', { name: 'Tu buzón' })).toBeHidden();
  // Tu piso inicial ya está guardado y validado
  await expect.poll(() => mock.db.pisos.find((p) => p.user_id === ANA.id)?.layout.items.length).toBeGreaterThan(5);
  await expect(panel.locator('.ed-facade__art')).toBeVisible();
  // 1.65: la llegada (la vista sube desde el muelle) termina antes de la captura
  await expect(panel.locator('.ed-facade')).not.toHaveClass(/is-arriving/);
  await page.waitForTimeout(400);
  await shot(page, info, 'v163-portal');

  // Tu piso: decorar y se guarda solo
  await panel.getByRole('button', { name: 'Entrar en tu piso, 2.º B' }).click();
  const mine = page.getByRole('dialog', { name: 'Tu piso' });
  await expect(mine.getByRole('heading', { name: 'Tu piso · 2.º B' })).toBeVisible();
  // Por defecto, «dentro de la habitación», a pantalla completa y (desde la 1.78) sin decorar: la habitación manda y
  // los menús van en una fila de iconos con su nombre; «Decorar» saca la balda abajo
  await expect(mine.locator('.ed-inside .ep--inside')).toBeVisible();
  await expect(mine.locator('.ep-shelf')).toBeHidden();
  for (const name of ['Luz de tarde', 'Armario', 'Decorar']) await expect(mine.locator('.ep-menu').getByRole('button', { name })).toBeVisible();
  await mine.getByRole('button', { name: 'Decorar' }).click();
  await expect(mine.locator('.ep-shelf')).toBeVisible();
  await expect(mine.getByRole('button', { name: 'Terminar' })).toBeVisible();
  const stage = await mine.locator('.ep-stage').boundingBox();
  const shelf = await mine.locator('.ep-shelf').boundingBox();
  expect(stage.y + stage.height).toBeLessThanOrEqual(shelf.y + 1);
  expect(shelf.y + shelf.height).toBeLessThanOrEqual((page.viewportSize().height) + 1);
  await shot(page, info, 'v164-dentro');
  await mine.locator('.ep-chip', { hasText: 'Plantas' }).click();
  await mine.getByRole('button', { name: 'Añadir planta grande' }).click();
  await expect(mine.locator('.ed-saving')).toHaveText('Guardado.', { timeout: 8000 });
  expect(mock.db.pisos.find((p) => p.user_id === ANA.id).layout.items.filter((i) => i.id === 'planta-grande')).toHaveLength(2);
  // Escape suelta lo elegido sin cerrar el panel
  await mine.locator('.ep-canvas').focus();
  await page.keyboard.press('Escape');
  await expect(mine.locator('.ep-tools')).toBeHidden();
  await expect(mine).toBeVisible();
  await shot(page, info, 'v163-mi-piso');
  // Se puede pasar a la vista de ficha (y se recuerda); luego se vuelve a «dentro»
  await mine.getByRole('button', { name: 'Ver como ficha' }).click();
  await expect(mine.locator('.ed-inside')).toHaveCount(0);
  await expect(mine.locator('.ep-shelf')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('bookshelf:edificio:vista'))).toBe('ficha');
  await mine.getByRole('button', { name: 'Entrar en la habitación' }).click();
  await expect(mine.locator('.ed-inside')).toBeVisible();
  await mine.getByRole('button', { name: 'Volver al portal' }).click();
  await expect(panel.getByRole('button', { name: 'Entrar en tu piso, 2.º B' })).toBeVisible();

  // Visita a Bruno: sin la migración de vecinos, solo mirar (1.78: ya no hay sellos)
  await panel.getByRole('button', { name: 'Llamar y entrar en el piso de Bruno, 1.º A' }).click();
  const bruno = page.getByRole('dialog', { name: 'Piso de Bruno' });
  await expect(bruno.getByRole('heading', { name: 'Piso de Bruno · 1.º A' })).toBeVisible();
  await expect(bruno.getByRole('button', { name: 'Decorar' })).toHaveCount(0);
  await expect(bruno.getByRole('button', { name: 'Menuda estantería' })).toHaveCount(0);
  await expect(bruno.locator('canvas.ep-canvas')).toBeVisible();
  await shot(page, info, 'v163-visita');
  // Atrás del sistema vuelve al portal, y otra vez, al salón
  await page.goBack();
  await expect(panel.getByRole('button', { name: 'Entrar en tu piso, 2.º B' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('sin la comunidad activada, el edificio lo explica y lleva a activarla', async ({ page }, info) => {
  test.skip(!/chromium-390x844/.test(info.project.name), 'una vez');
  const mock = seed();
  mock.db.profiles.find((p) => p.user_id === ANA.id).community_enabled = false;
  await mock.attach(page, ANA);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('v163-nav')) return;
    sessionStorage.setItem('v163-nav', '1');
    history.replaceState({ bookshelf: { loc: { view: 'room', panel: { type: 'edificio' } }, depth: 0, parent: null } }, '');
  });
  await page.goto('/');
  await expect(page.getByText('El edificio es para quien tiene la comunidad activada')).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Activar la comunidad en mi perfil' })).toBeVisible();
  expect(mock.db.edificio_vecinos.some((v) => v.user_id === ANA.id)).toBe(false);
});
