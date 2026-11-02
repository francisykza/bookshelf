// 1.75 (SPEC §75) · El vestíbulo del Gran Hotel por dentro, con Supabase simulado: se entra tocando el vestíbulo en la
// fachada; la recepción da los encargos de la semana; el ascensor es la botonera de plantas (la «P» sale a la plaza);
// Escape y «A la calle» vuelven a la fachada.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const ANA = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'ana@ejemplo.test',
};

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

async function toHotel(page) {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({
    user_id: ANA.id,
    alias: 'Ana lectora',
    avatar_id: 'gato-lector',
    community_enabled: true,
  });
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Coger la limusina al Gran Hotel' }).click({ timeout: 15000 });
  const hotel = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' });
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible();
  return hotel;
}

async function enterLobby(page, hotel) {
  const at = await page.evaluate(() => {
    const v = window.__granHotel;
    const z = v.zones.find((x) => x.id === 'vestibulo');
    const r = v.canvas.getBoundingClientRect();
    return { x: r.left + z.center.x * r.width, y: r.top + z.center.y * r.height };
  });
  await page.mouse.click(at.x, at.y);
  const lobby = hotel.getByRole('region', { name: 'El vestíbulo' });
  await expect(lobby.locator('.gh-lobby__art')).toBeVisible();
  await page.waitForFunction(() => document.querySelector('.gh-lobby__art')?.complete);
  return lobby;
}

test('el vestíbulo: encargos en la recepción, la botonera del ascensor y salir a la calle', async ({ page }, info) => {
  test.skip(!/320x640|390x844|1440x900/.test(info.project.name) || /reduced/.test(info.project.name), '320, 390 (Chromium y WebKit) y escritorio');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const hotel = await toHotel(page);
  const lobby = await enterLobby(page, hotel);

  // La recepción, de entrada: los cinco encargos de la semana
  await expect(lobby.getByRole('tab', { name: 'Recepción' })).toHaveAttribute('aria-selected', 'true');
  await expect(lobby.locator('.gh-task')).toHaveCount(5);
  await expect(lobby.getByText(/Buenas noches/)).toBeVisible();
  await page.mouse.move(0, 0);
  await shot(page, info, 'v175-vestibulo');
  await lobby.locator('.gh-desk').scrollIntoViewIfNeeded();
  await shot(page, info, 'v175-encargos');

  // El ascensor: la botonera, con el vestíbulo encendido; una planta que aún no abre dice qué habrá
  await lobby.getByRole('tab', { name: 'Ascensor' }).click();
  const panel = lobby.getByRole('list', { name: 'Botonera del ascensor' });
  await expect(panel.getByRole('button', { name: /El vestíbulo/ })).toHaveAttribute('aria-current', 'location');
  await panel.getByRole('button', { name: /El casino del sótano/ }).click();
  await expect(lobby.getByRole('status').filter({ hasText: 'Las 21 páginas' })).toBeVisible();
  await expect(lobby.getByText('Abre pronto')).toBeVisible();
  await lobby.locator('.gh-lift').scrollIntoViewIfNeeded();
  await shot(page, info, 'v175-ascensor');

  // La «P» sale a la plaza
  await panel.getByRole('button', { name: /La plaza del muelle/ }).click();
  await expect(lobby).toHaveCount(0);
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible();

  // Con el teclado: el botón de la planta entra; Escape vuelve a la fachada, no cierra el hotel
  await hotel.getByRole('list', { name: 'Plantas del hotel' }).getByRole('button', { name: 'El vestíbulo' }).focus();
  await page.keyboard.press('Enter');
  await expect(hotel.getByRole('region', { name: 'El vestíbulo' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(hotel.getByRole('region', { name: 'El vestíbulo' })).toHaveCount(0);
  await expect(hotel).toBeVisible();

  // «A la calle» en la barra; después, «Volver en limusina» vuelve al portal
  await enterLobby(page, hotel);
  await hotel.getByRole('button', { name: 'A la calle' }).click();
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible();
  await hotel.getByRole('button', { name: 'Volver en limusina' }).click();
  await expect(page.getByRole('dialog', { name: 'El edificio del puerto' })).toBeVisible();
  expect(errors).toEqual([]);
});
