// 1.98 (SPEC §98) · La recepción del Gran Hotel en 3D, con Supabase simulado: se entra desde la fachada; cada cosa se toca
// y acerca la vista; el ascensor se abre y su botonera está en la cabina; «Plano» es el vestíbulo isométrico; sin WebGL,
// el plano directamente. Capturas en qa-report/recepcion3d/bloque4/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };

async function shot(page, info, name) {
  const dir = join('qa-report', 'recepcion3d', 'bloque4');
  mkdirSync(dir, { recursive: true });
  await page.mouse.move(0, 0);
  await page.screenshot({ path: join(dir, `${info.project.name}-${name}.png`) });
}

async function alHotel(page) {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
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
  const at = await page.evaluate(() => {
    const v = window.__granHotel;
    const z = v.zones.find((x) => x.id === 'vestibulo');
    const r = v.canvas.getBoundingClientRect();
    return { x: r.left + z.center.x * r.width, y: r.top + z.center.y * r.height };
  });
  await page.mouse.click(at.x, at.y);
  return hotel;
}

const settled = (page) => page.waitForFunction(() => window.__recepcion3d.settled());

test('la recepción en 3D a cada tamaño: entrar, el conserje y la cabina del ascensor', async ({ page }, info) => {
  test.skip(!/360x800|390x844|430x932|1440x900/.test(info.project.name), '360, 390 (Chromium y WebKit), 430 y escritorio');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const hotel = await alHotel(page);
  const rcp = hotel.locator('section.rcp');
  await expect(rcp).toHaveAttribute('data-ready', 'true');
  await page.waitForFunction(() => window.__recepcion3d?.renders() > 0);
  await page.waitForTimeout(300);
  // Sin desplazamiento lateral, y la barra entera a la vista
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const vh = page.viewportSize().height;
  const bar = await rcp.locator('.rcp-bar').boundingBox();
  expect(bar.y + bar.height).toBeLessThanOrEqual(vh + 1);
  await shot(page, info, '1-entrada');

  await rcp.getByRole('button', { name: /Encargos de la semana/ }).click();
  await settled(page);
  await expect(rcp.locator('.gh-task')).toHaveCount(5);
  await shot(page, info, '2-conserje');
  await rcp.getByRole('button', { name: 'Volver' }).click();
  await settled(page);

  await rcp.locator('.rcp-bar').getByRole('button', { name: 'Ascensor' }).click();
  await settled(page);
  const botones = rcp.locator('.rcp-cabina .gh-lift__btn');
  await expect(botones).toHaveCount(9);
  // Los nueve botones caben en la pantalla, y «Salir del ascensor» también
  for (let k = 0; k < 9; k += 1) {
    const b = await botones.nth(k).boundingBox();
    expect(b.y >= 0 && b.y + b.height <= vh + 1).toBe(true);
  }
  await expect(rcp.getByRole('button', { name: 'Salir del ascensor' })).toBeInViewport();
  await shot(page, info, '3-cabina');
  await page.keyboard.press('Escape');
  await settled(page);
  await expect(rcp.locator('.rcp-cabina')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('desde la cabina, la «S» lleva al casino del sótano', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'solo 390 px');
  const hotel = await alHotel(page);
  const rcp = hotel.locator('section.rcp');
  await expect(rcp).toHaveAttribute('data-ready', 'true');
  await rcp.locator('.rcp-bar').getByRole('button', { name: 'Ascensor' }).click();
  await settled(page);
  await rcp.locator('.rcp-cabina').getByRole('button', { name: /casino/ }).click();
  await expect(hotel.getByRole('region', { name: 'El casino del sótano' })).toBeVisible();
});

test('sin WebGL, el vestíbulo se abre en el plano isométrico', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'solo 390 px');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
      return /webgl/.test(kind) ? null : get.call(this, kind, ...rest);
    };
  });
  const hotel = await alHotel(page);
  const lobby = hotel.getByRole('region', { name: 'El vestíbulo' });
  await expect(lobby.locator('.gh-lobby__art')).toBeVisible();
  await expect(lobby.getByRole('button', { name: 'Entrar en la recepción' })).toHaveCount(0);
  await expect(hotel.locator('section.rcp')).toHaveCount(0);
  await shot(page, info, '4-sin-webgl');
  expect(errors).toEqual([]);
});
