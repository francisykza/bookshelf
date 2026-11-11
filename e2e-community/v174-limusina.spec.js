// 1.74 (SPEC §74) · La limusina negra al Gran Hotel, con Supabase simulado: espera delante del portal del edificio; al
// tocarla, el viaje (que se salta tocándolo) y la fachada viva del hotel, que se toca planta a planta (aún sin salas).
// Atrás vuelve al portal. Con movimiento reducido, sin viaje y con el dibujo quieto.
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

async function toPortal(page) {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({
    user_id: ANA.id,
    alias: 'Ana lectora',
    avatar_id: 'gato-lector',
    community_enabled: true,
  });
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page
    .getByRole('button', {
      name: 'Tablet: la comunidad y El edificio del puerto',
    })
    .click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await expect(panel.locator('.ed-facade')).not.toHaveClass(/is-arriving/, {
    timeout: 15000,
  });
  return panel;
}

test('la limusina del portal lleva al Gran Hotel, y Atrás vuelve', async ({ page }, info) => {
  test.skip(!/320x640|390x844|1440x900/.test(info.project.name) || /reduced/.test(info.project.name), '320, 390 (Chromium y WebKit) y escritorio');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const panel = await toPortal(page);
  const limo = panel.getByRole('button', {
    name: 'Coger la limusina al Gran Hotel',
  });
  await expect(limo).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, info, 'v174-limusina-portal');

  await limo.click();
  const hotel = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' });
  // 1.115: con el hotel en 3D no hay viaje; bajas de la limusina en la plaza y andas hasta la vista de siempre
  // (el viaje 2D queda para cuando no hay WebGL)
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible();
  await expect(hotel.getByRole('button', { name: /^En limusina hacia el Gran Hotel/ })).toHaveCount(0);
  await expect(hotel.locator('.gh-art')).not.toHaveClass(/is-walking/, { timeout: 8000 });
  await page.waitForTimeout(600);
  await shot(page, info, 'v174-hotel');

  // Sin fila de botones: la planta se toca en el dibujo (o, con el teclado, con su botón sobre el dibujo)
  await expect(hotel.getByRole('navigation')).toHaveCount(0);
  const cafe = hotel.getByRole('list', { name: 'Plantas del hotel' }).getByRole('button', { name: 'El salón de baile' });
  await cafe.focus();
  await page.keyboard.press('Enter');
  const card = hotel.getByRole('region', { name: 'El salón de baile' });
  await expect(card).toBeVisible();
  // 1.77: la cartela del pie dice la planta y «Próxima apertura»
  await expect(card.getByText('Próxima apertura')).toBeVisible();
  await page.mouse.move(0, 0);
  await shot(page, info, 'v174-hotel-planta');
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  // Tocar en el dibujo: el vestíbulo, a la altura de la marquesina (1.79: cuando el hotel se ha ajustado a la cartela pequeña)
  // 1.115: el botón de la planta, al enfocarlo, gira la vista hasta ella; se vuelve a mirar de frente
  await page.evaluate(() => window.__granHotel.hotel?.()?.setView(0));
  const canvasBox = () => page.evaluate(() => JSON.stringify(window.__granHotel.canvas.getBoundingClientRect()));
  let last = '';
  await expect.poll(async () => last === (last = await canvasBox()), { intervals: [150, 150, 150, 150] }).toBe(true);
  const at = await page.evaluate(() => {
    const v = window.__granHotel;
    const z = v.zones.find((x) => x.id === 'vestibulo');
    const r = v.canvas.getBoundingClientRect();
    return { x: r.left + z.center.x * r.width, y: r.top + z.center.y * r.height };
  });
  await page.mouse.click(at.x, at.y);
  await expect(hotel.getByRole('region', { name: 'El vestíbulo' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(hotel.getByRole('region', { name: 'El vestíbulo' })).toHaveCount(0);

  // «Al puerto» (1.77; antes «Volver en limusina»): al portal
  await hotel.getByRole('button', { name: 'Al puerto' }).click();
  await expect(page.getByRole('dialog', { name: 'El edificio del puerto' }).getByRole('button', { name: 'Coger la limusina al Gran Hotel' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('con movimiento reducido: sin viaje y el hotel quieto', async ({ page }, info) => {
  test.skip(!/chromium-390x844/.test(info.project.name) || /reduced/.test(info.project.name), 'una vez');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const panel = await toPortal(page);
  await panel.getByRole('button', { name: 'Coger la limusina al Gran Hotel' }).click();
  const hotel = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' });
  await expect(hotel.getByRole('button', { name: /^En limusina/ })).toHaveCount(0);
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible();
  const a = await hotel.locator('canvas.hotel-canvas').screenshot();
  await page.waitForTimeout(500);
  const b = await hotel.locator('canvas.hotel-canvas').screenshot();
  expect(a.equals(b)).toBe(true);
});
