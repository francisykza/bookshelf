// 1.109 · La ruleta de premios del casino (bloque c de docs/qa/casino-3d.md), con Supabase simulado: delante de la rueda,
// con lo que puede tocar y su probabilidad a la vista; un giro que decide el servidor y la rueda que se para en esa casilla;
// el premio, al inventario; esta semana ya no se gira otra vez; lo repetido se cambia por fichas. Capturas en
// qa-report/casino/; vídeo con CASINO_VIDEO=1.
import { expect, test } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { ANA, alAlmacen, mockAlmacen } from './almacenHelpers';

const DIR = join('qa-report', 'casino');
const TAMAÑOS = /chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/;
async function shot(page, info, name) {
  mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: join(DIR, `${name}-${info.project.name}.png`) });
}
const settled = (page) => page.waitForFunction(() => window.__casino3d?.settled());

async function alCasino(page, { datos, reduced = true }) {
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.casino = datos;
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
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
  await hotel.getByRole('button', { name: 'Directorio' }).click();
  await hotel.getByRole('button', { name: /Casino del sótano/ }).click();
  const casino = hotel.getByRole('region', { name: 'El casino del sótano' });
  await expect(casino).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
  await page.waitForFunction(() => window.__casino3d?.renders() > 0);
  return { casino, mock };
}
/** Ir a la ruleta por el plano y esperar a estar delante de la rueda. */
async function aLaRuleta(page, casino) {
  await casino.getByRole('button', { name: 'Plano' }).click();
  await casino.getByRole('navigation', { name: 'Plano de la sala' }).getByRole('button', { name: /La ruleta/ }).click();
  await page.waitForFunction(() => window.__casino3d.enRuleta() && window.__casino3d.settled());
}

test('la ruleta: lo que puede tocar a la vista, un giro, la rueda en su casilla y el premio tuyo', async ({ page }, info) => {
  test.skip(!TAMAÑOS.test(info.project.name), '360, 390 y 430 (y WebKit a 390) y escritorio');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // Saldrá la lámpara de flecos (casilla 3)
  const { casino, mock } = await alCasino(page, { datos: { fichas: 30, semana: 30, ruleta: { sale: 3 } } });
  await expect(casino.locator('.cs3-tag', { hasText: 'La ruleta' })).not.toContainText('pronto');
  await aLaRuleta(page, casino);

  // Delante de la rueda: las nueve casillas con su probabilidad, y el botón de girar
  const cartel = casino.getByRole('region', { name: 'Lo que puede tocar' });
  await expect(cartel.getByRole('listitem')).toHaveCount(9);
  await expect(cartel.getByRole('listitem').filter({ hasText: 'Mapache crupier' })).toContainText('2 %');
  await expect(cartel.getByRole('listitem').filter({ hasText: 'Mapache crupier' })).toHaveClass(/is-rara/);
  await expect(cartel.getByRole('listitem').filter({ hasText: '20 fichas' })).toContainText('28 %');
  await expect(cartel).toContainText('Si sale algo que ya tienes, te llevas 40 fichas.');
  await expect(casino.getByRole('button', { name: 'Plano' })).toHaveCount(0);
  expect(await page.evaluate(() => window.__casino3d.casillaArriba())).toBe(0);
  // El cartel no tapa la rueda: la flecha (arriba) y el cubo quedan por encima del cartel
  const caja = await cartel.boundingBox();
  const cubo = await page.evaluate(() => window.__casino3d.onScreen('ruleta'));
  expect(cubo.y).toBeLessThan(caja.y);
  await page.waitForTimeout(300);
  await shot(page, info, '09-ruleta');

  // Girar: la rueda se para en la casilla que dio el servidor y se dice lo que ha tocado
  await casino.getByRole('button', { name: 'Girar la ruleta' }).click();
  await expect(casino.locator('.cs3-tocado')).toContainText('Lámpara de flecos');
  await settled(page);
  expect(await page.evaluate(() => window.__casino3d.casillaArriba())).toBe(3);
  await expect(cartel.getByRole('listitem').filter({ hasText: 'Lámpara de flecos' })).toHaveClass(/is-tocado/);
  await expect(casino.getByRole('button', { name: 'Girar la ruleta' })).toHaveCount(0);
  await expect(casino.locator('.cs3-rul .cs3-acts')).toContainText('La ruleta vuelve a girar el lunes.');
  expect(mock.db.casino.ruleta.tienes).toEqual(['lampara-flecos']);
  await page.waitForTimeout(300);
  await shot(page, info, '10-ruleta-tocado');

  // Volver a la sala y otra vez a la ruleta: lo de esta semana, y la rueda quieta en su casilla
  await casino.getByRole('button', { name: 'Volver a la sala' }).click();
  await settled(page);
  await expect(casino.locator('.cs3-rul')).toHaveCount(0);
  await aLaRuleta(page, casino);
  await expect(casino.locator('.cs3-rul .cs3-acts')).toContainText('Esta semana te tocó: Lámpara de flecos.');
  await expect(cartel.getByRole('listitem').filter({ hasText: 'Lámpara de flecos' })).toContainText('ya es tuyo');
  expect(await page.evaluate(() => window.__casino3d.casillaArriba())).toBe(3);
  expect(errors).toEqual([]);
});

test('la ruleta: lo que ya tienes se cambia por fichas', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'Chromium a 390');
  const { casino, mock } = await alCasino(page, { datos: { fichas: 30, semana: 30, ruleta: { sale: 1, tienes: ['jersey:22'] } } });
  await aLaRuleta(page, casino);
  await expect(casino.getByRole('region', { name: 'Lo que puede tocar' }).getByRole('listitem').filter({ hasText: 'Esmoquin de terciopelo' })).toContainText('ya es tuyo');
  await casino.getByRole('button', { name: 'Girar la ruleta' }).click();
  await expect(casino.locator('.cs3-tocado')).toContainText('Ya lo tenías');
  await expect(casino.locator('.cs3-tocado')).toContainText('Esmoquin de terciopelo: te llevas 40 fichas');
  expect(mock.db.casino.fichas).toBe(70);
  // El marcador del panel se pone al día
  await expect(casino.getByRole('img', { name: '70 fichas' })).toBeVisible();
  await settled(page);
  await page.waitForTimeout(300);
  await shot(page, info, '11-ruleta-repetido');
});

test('el esmoquin de la ruleta, en el probador del almacén', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'Chromium a 390');
  const mock = mockAlmacen();
  mock.db.personajes = true;
  mock.db.pisos.push({ user_id: ANA.id, layout: { v: 1, pared: 0, suelo: 'tablas', items: [] }, personaje: { piel: 2, pelo: 'melena', colorPelo: 1, jersey: 0, pantalon: 1, gafas: false, complemento: 'ninguno' } });
  mock.db.diarias = { [ANA.id]: { prendas: ['jersey:22'], dias: {} } };
  const { alm } = await alAlmacen(page, mock);
  await page.evaluate(() => window.__almacen3d.place(14.3, 3.6, Math.PI, -4.6));
  await page.waitForTimeout(300);
  await alm.locator('.alm-tag--sitio', { hasText: 'Probador' }).click();
  const card = alm.locator('.alm-card--probador');
  await expect(card.locator('.alm-percha').first()).toBeVisible({ timeout: 15000 });
  await card.getByRole('tab', { name: 'Jersey' }).click();
  await card.locator('[data-prenda="jersey:22"]').click();
  await page.waitForFunction(() => window.__almacen3d.settled());
  await page.waitForTimeout(400);
  await shot(page, info, '12-esmoquin');
});

test('vídeo: la ruleta, de verdad (cinco vueltas y su frenada)', async ({ browser }, info) => {
  test.skip(!process.env.CASINO_VIDEO || !/^(chromium|webkit)-390x844$/.test(info.project.name), 'solo con CASINO_VIDEO=1');
  test.setTimeout(120000);
  const bruto = join(DIR, 'bruto');
  mkdirSync(bruto, { recursive: true });
  const context = await browser.newContext({ ...info.project.use, recordVideo: { dir: bruto, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  // Sale el mapache, la casilla más rara
  const { casino } = await alCasino(page, { datos: { fichas: 30, semana: 30, ruleta: { sale: 8 } }, reduced: false });
  const pausa = (ms) => page.waitForTimeout(ms);
  await pausa(1200);
  await aLaRuleta(page, casino);
  await pausa(2200);
  await casino.getByRole('button', { name: 'Girar la ruleta' }).click();
  await expect(casino.locator('.cs3-tocado')).toContainText('Mapache crupier', { timeout: 15000 });
  expect(await page.evaluate(() => window.__casino3d.casillaArriba())).toBe(8);
  await pausa(3000);
  await casino.getByRole('button', { name: 'Volver a la sala' }).click();
  await settled(page);
  await pausa(1200);
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join(DIR, `ruleta-${info.project.name}.webm`));
});
