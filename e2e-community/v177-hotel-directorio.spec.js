// 1.77 · La fachada del Gran Hotel según la maqueta de Francisco, con Supabase simulado: el hotel entero (aguja, letrero,
// marquesina y limusina) por encima de la cartela del pie; la planta elegida lleva un filete de latón con su rombo y la
// cartela dice qué es. «Directorio», en la barra, lista las plantas con su estado: elegir una ahí es lo mismo que tocarla.
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

async function toHotel(page) {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  // Con movimiento reducido el dibujo se queda quieto: así se pueden comparar los dos caminos píxel a píxel
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

// Lo que se ve del lienzo: una huella de sus píxeles y cuántos son del latón de la planta elegida
const canvasState = (page) =>
  page.evaluate(() => {
    const c = window.__granHotel.canvas;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let hash = 0;
    let brass = 0;
    for (let i = 0; i < d.length; i += 4) {
      hash = (hash * 31 + d[i] * 7 + d[i + 1] * 3 + d[i + 2]) | 0;
      if (d[i] === 240 && d[i + 1] === 195 && d[i + 2] === 90) brass += 1;
    }
    return { hash, brass };
  });

test('el hotel cabe entero sobre la cartela, y tocar una planta o elegirla en el Directorio dan lo mismo', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844)$/.test(info.project.name), '360 y 390');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const hotel = await toHotel(page);
  await expect(hotel.getByRole('button', { name: 'Al puerto' })).toBeVisible();
  const dir = hotel.getByRole('button', { name: 'Directorio' });
  await expect(dir).toBeVisible();

  // De la aguja a la limusina, todo por encima de la cartela y dentro de la pantalla
  const fit = await page.evaluate(() => {
    const v = window.__granHotel;
    const c = v.canvas.getBoundingClientRect();
    const bar = document.querySelector('.ed-bar').getBoundingClientRect();
    const plaque = document.querySelector('.gh-plaque').getBoundingClientRect();
    return { top: c.top, barBottom: bar.bottom, left: c.left, right: c.right, entry: c.top + v.entry * c.height, plaqueTop: plaque.top, plaqueBottom: plaque.bottom, vw: innerWidth, vh: innerHeight };
  });
  expect(fit.top).toBeGreaterThanOrEqual(fit.barBottom - 1);
  expect(fit.entry).toBeLessThanOrEqual(fit.plaqueTop + 1);
  expect(fit.plaqueBottom).toBeLessThanOrEqual(fit.vh + 1);
  const plaque = hotel.locator('.gh-plaque');
  await expect(plaque.getByRole('heading', { name: 'Gran Hotel del Puerto' })).toBeVisible();
  const before = await canvasState(page);
  expect(before.brass).toBe(0);

  // Tocar el café en el dibujo
  const at = await page.evaluate(() => {
    const v = window.__granHotel;
    const z = v.zones.find((x) => x.id === 'cafe');
    const r = v.canvas.getBoundingClientRect();
    return { x: r.left + z.center.x * r.width, y: r.top + z.center.y * r.height };
  });
  await page.mouse.click(at.x, at.y);
  await expect(plaque.getByRole('heading', { name: 'Café-biblioteca' })).toBeVisible();
  await expect(plaque.getByText('Próxima apertura')).toBeVisible();
  await expect(plaque.getByText('Mesas para quienes leen el mismo libro.')).toBeVisible();
  await page.mouse.move(0, 0);
  const tapped = await canvasState(page);
  expect(tapped.brass).toBeGreaterThan(40);
  await shot(page, info, 'v177-hotel-cafe');

  // Escape quita la elección (y no cierra el hotel)
  await page.keyboard.press('Escape');
  await expect(plaque.getByRole('heading', { name: 'Gran Hotel del Puerto' })).toBeVisible();
  expect((await canvasState(page)).brass).toBe(0);

  // El Directorio: las ocho plantas con su estado (1.79: con la suite de la semana; 1.80: con el casino del sótano); elegir el café da lo mismo que tocarlo
  await dir.click();
  const list = hotel.getByRole('dialog', { name: 'Directorio' });
  await expect(list.getByRole('button')).toHaveCount(10);
  await expect(list.getByRole('button', { name: /Vestíbulo/ })).toContainText('Abierto · entrar');
  await expect(list.getByRole('button', { name: /Café-biblioteca/ })).toContainText('Próxima apertura');
  await shot(page, info, 'v177-hotel-directorio');
  await list.getByRole('button', { name: /Café-biblioteca/ }).click();
  await expect(list).toHaveCount(0);
  await expect(plaque.getByRole('heading', { name: 'Café-biblioteca' })).toBeVisible();
  expect(await canvasState(page)).toEqual(tapped);

  // Escape cierra el Directorio y no el hotel; desde él, el vestíbulo se entra
  await dir.click();
  await expect(list.getByRole('button', { name: /Café-biblioteca/ })).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible();
  await dir.click();
  await list.getByRole('button', { name: /Vestíbulo/ }).click();
  await expect(hotel.getByRole('region', { name: 'El vestíbulo' })).toBeVisible();
  expect(errors).toEqual([]);
});
