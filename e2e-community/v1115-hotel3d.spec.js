// 1.115 (SPEC §115, «Exteriores en 3D», bloque 3) · El Gran Hotel en 3D en la app, con Supabase simulado: desde el
// portal se anda hasta la limusina y se baja junto a la marquesina, mirando la torre, hasta la plaza (sin el viaje 2D);
// las plantas se tocan en la torre y la cartela dice cuál es, con su filete de latón; el Directorio da lo mismo; una
// planta abierta se entra andando hasta la puerta y, al salir, se vuelve a la plaza. Capturas y vídeo en
// qa-report/hotel3d-app/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const DIR = join('qa-report', 'hotel3d-app');

async function toHotel(page, { reduced = false } = {}) {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  await mock.attach(page, ANA);
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    localStorage.setItem('bookshelf:vestibulo-vista', 'plano');
  });
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await expect(portal.locator('.ed-facade')).not.toHaveClass(/is-arriving/, { timeout: 15000 });
  await portal.getByRole('button', { name: 'Coger la limusina al Gran Hotel' }).click({ timeout: 15000 });
  const hotel = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' });
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible({ timeout: 15000 });
  return hotel;
}

const zoneAt = (page, id) =>
  page.evaluate((zid) => {
    const v = window.__granHotel;
    const z = v.zones.find((x) => x.id === zid);
    const r = v.canvas.getBoundingClientRect();
    return { x: r.left + z.center.x * r.width, y: r.top + z.center.y * r.height };
  }, id);

test('el Gran Hotel en 3D: bajar de la limusina, tocar las plantas, el Directorio y entrar andando', async ({ page }, info) => {
  test.skip(!/chromium-(390x844|1440x900)$|webkit-390x844/.test(info.project.name), '390 (Chromium y WebKit) y escritorio');
  test.setTimeout(90000);
  mkdirSync(DIR, { recursive: true });
  const tag = info.project.name;
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const hotel = await toHotel(page);
  // Sin viaje en 2D: la fachada es 3D y llegas andando desde la limusina
  await expect(hotel.getByRole('button', { name: /^En limusina/ })).toHaveCount(0);
  expect(await page.evaluate(() => window.__granHotel.mode)).toBe('3d');
  await expect(hotel.locator('.gh-art')).toHaveClass(/is-walking/);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(DIR, `1-bajando-de-la-limusina-${tag}.png`) });
  await expect(hotel.locator('.gh-art')).not.toHaveClass(/is-walking/, { timeout: 8000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(DIR, `2-la-plaza-${tag}.png`) });

  // Tocar el salón de baile en la torre: la cartela lo dice y lo rodea el filete de latón
  const plaque = hotel.locator('.gh-plaque');
  await expect(plaque.getByRole('heading', { name: 'Gran Hotel del Puerto' })).toBeVisible();
  await expect(hotel.locator('.gh-3d__outline polygon')).toHaveCount(0);
  const baile = await zoneAt(page, 'baile');
  await page.mouse.click(baile.x, baile.y);
  await expect(plaque.getByRole('heading', { name: 'Salón de baile' })).toBeVisible();
  await expect(plaque.getByText('Próxima apertura')).toBeVisible();
  await expect(hotel.locator('.gh-3d__outline polygon')).toHaveCount(1);
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(DIR, `3-salon-de-baile-${tag}.png`) });

  // Arrastrar gira la vista y no elige nada
  const box = await hotel.locator('canvas.hotel-canvas').boundingBox();
  const yaw0 = await page.evaluate(() => window.__granHotel.hotel().yaw());
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4, { steps: 8 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__granHotel.hotel().yaw())).not.toBe(yaw0);
  await expect(plaque.getByRole('heading', { name: 'Salón de baile' })).toBeVisible();

  // Escape quita la elección y no cierra el hotel
  await page.keyboard.press('Escape');
  await expect(plaque.getByRole('heading', { name: 'Gran Hotel del Puerto' })).toBeVisible();
  await expect(hotel.locator('.gh-3d__outline polygon')).toHaveCount(0);

  // El mirador, desde el Directorio: la vista sube hasta la corona
  await hotel.getByRole('button', { name: 'Directorio' }).click();
  await hotel
    .getByRole('dialog', { name: 'Directorio' })
    .getByRole('button', { name: /Mirador de la corona/ })
    .click();
  await expect(plaque.getByRole('heading', { name: 'Mirador de la corona' })).toBeVisible();
  await page.waitForTimeout(1000);
  const top = await zoneAt(page, 'mirador');
  expect(top.y).toBeGreaterThan(box.y);
  await page.screenshot({ path: join(DIR, `4-mirador-${tag}.png`) });
  await page.keyboard.press('Escape');

  // Con el teclado: el botón de la planta, al enfocarlo, gira la vista hasta ella; Enter la elige
  const cafe = hotel.getByRole('list', { name: 'Plantas del hotel' }).getByRole('button', { name: 'El salón de baile' });
  await cafe.focus();
  await page.keyboard.press('Enter');
  await expect(plaque.getByRole('heading', { name: 'Salón de baile' })).toBeVisible();
  await page.keyboard.press('Escape');

  // Una planta abierta: se anda hasta la puerta y se entra en el vestíbulo; al salir, otra vez en la plaza
  await page.evaluate(() => window.__granHotel.hotel().setView(0));
  await page.waitForTimeout(300);
  const lobby = await zoneAt(page, 'vestibulo');
  await page.mouse.click(lobby.x, lobby.y);
  await expect(hotel.locator('.gh-art')).toHaveClass(/is-walking/);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(DIR, `5-hacia-la-puerta-${tag}.png`) });
  const room = hotel.getByRole('region', { name: 'El vestíbulo' });
  await expect(room).toBeVisible({ timeout: 8000 });
  await hotel.getByRole('button', { name: 'A la calle' }).click();
  await expect(room).toHaveCount(0);
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible();
  expect(await page.evaluate(() => window.__granHotel.mode)).toBe('3d');
  // Al volver no se repite la llegada
  await expect(hotel.locator('.gh-art')).not.toHaveClass(/is-walking/);

  // «Al puerto»: al portal
  await hotel.getByRole('button', { name: 'Al puerto' }).click();
  await expect(page.getByRole('dialog', { name: 'El edificio del puerto' }).getByRole('button', { name: 'Coger la limusina al Gran Hotel' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('el Gran Hotel en 3D con movimiento reducido: sin llegada andando y quieto', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'una vez');
  const hotel = await toHotel(page, { reduced: true });
  await expect(hotel.getByRole('button', { name: /^En limusina/ })).toHaveCount(0);
  await expect(hotel.locator('.gh-art')).not.toHaveClass(/is-walking/);
  await page.waitForTimeout(400);
  const a = await hotel.locator('canvas.hotel-canvas').screenshot();
  await page.waitForTimeout(600);
  const b = await hotel.locator('canvas.hotel-canvas').screenshot();
  expect(a.equals(b)).toBe(true);
  // Entrar es directo
  const lobby = await zoneAt(page, 'vestibulo');
  await page.mouse.click(lobby.x, lobby.y);
  await expect(hotel.getByRole('region', { name: 'El vestíbulo' })).toBeVisible();
});

test('vídeo: del portal al Gran Hotel en 3D', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'Chromium a 390');
  test.setTimeout(90000);
  mkdirSync(DIR, { recursive: true });
  const ctx = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, recordVideo: { dir: join(DIR, 'video'), size: { width: 390, height: 844 } } });
  const p = await ctx.newPage();
  const hotel = await toHotel(p);
  await expect(hotel.locator('.gh-art')).not.toHaveClass(/is-walking/, { timeout: 8000 });
  await p.waitForTimeout(1500);
  for (const id of ['baile', 'mirador']) {
    await hotel.getByRole('button', { name: 'Directorio' }).click();
    await hotel
      .getByRole('dialog', { name: 'Directorio' })
      .getByRole('button', { name: id === 'baile' ? /Salón de baile/ : /Mirador de la corona/ })
      .click();
    await p.waitForTimeout(2200);
  }
  await p.keyboard.press('Escape');
  await p.evaluate(() => window.__granHotel.hotel().glideTo(0, 0, 900));
  await p.waitForTimeout(1300);
  const lobby = await zoneAt(p, 'vestibulo');
  await p.mouse.click(lobby.x, lobby.y);
  await expect(hotel.getByRole('region', { name: 'El vestíbulo' })).toBeVisible({ timeout: 8000 });
  await p.waitForTimeout(1500);
  const video = p.video();
  await ctx.close();
  await video.saveAs(join(DIR, 'del-portal-al-hotel-390x844.webm'));
});
