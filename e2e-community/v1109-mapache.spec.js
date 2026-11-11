// 1.109 · El mapache crupier, la casilla más rara de la ruleta, en 3D (decisión de Francisco: «modelo 3D de verdad»): si es
// tu compañero, te sigue por el casino del sótano, a tu lado y un poco por delante; al pararte, se vuelve hacia ti y hace
// malabares. Con Supabase simulado. Capturas en qa-report/casino/; vídeo con CASINO_VIDEO=1.
import { expect, test } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './almacenHelpers';

const DIR = join('qa-report', 'casino');
const TAMAÑOS = /chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/;
async function shot(page, info, name) {
  mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: join(DIR, `${name}-${info.project.name}.png`) });
}
const settled = (page) => page.waitForFunction(() => window.__casino3d?.settled());

async function alCasino(page, { companero = 'mapache-crupier', reduced = true } = {}) {
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.casino = { fichas: 30, semana: 30, ruleta: { sale: 0 } };
  mock.db.sala_personajes = [{ user_id: ANA.id, personaje: null, companero }];
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
/** Andar hasta un sitio de la sala sin ponerse a jugar (desde la 1.110 y la 1.111, tocar las chisteras o la vitrina te pone delante). */
async function ir(page, casino, id) {
  await page.evaluate((x) => window.__casino3d.go(x), id);
  await settled(page);
  // El mapache sale al trote un fotograma después de que llegues: se espera a que llegue él también
  await page.waitForTimeout(250);
  await page.waitForFunction(() => !window.__casino3d.mapache()?.moving);
}

test('el mapache crupier en 3D: te sigue por el casino y se ve a tu lado', async ({ page }, info) => {
  test.skip(!TAMAÑOS.test(info.project.name), '360, 390 y 430 (y WebKit a 390) y escritorio');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const { casino } = await alCasino(page);
  await page.waitForFunction(() => window.__casino3d.mapache());
  await settled(page);
  // En el rellano, a tu lado y a la vista
  await page.waitForFunction(() => window.__casino3d.mapache()?.front);
  let m;
  await page.waitForTimeout(300);
  await shot(page, info, '13-mapache-rellano');
  // Bajas a la sala: te ha seguido y sigue a la vista
  await ir(page, casino, 'vitrina');
  m = await page.evaluate(() => window.__casino3d.mapache());
  const yo = await page.evaluate(() => window.__casino3d.pose());
  expect(Math.hypot(m.x - yo.x, m.y - yo.y)).toBeLessThan(3.4);
  expect(m.z).toBeLessThan(0.1);
  expect(m.front).toBe(true);
  await page.waitForTimeout(300);
  await shot(page, info, '14-mapache-sala');
  // Pegado a la mesa de las chisteras no hay hueco a la vista: se queda a tu lado, fuera de cuadro (nunca medio cortado)
  await ir(page, casino, 'chisteras');
  m = await page.evaluate(() => window.__casino3d.mapache());
  const cerca = await page.evaluate(() => window.__casino3d.pose());
  expect(Math.hypot(m.x - cerca.x, m.y - cerca.y)).toBeLessThan(1.6);
  expect(errors).toEqual([]);
});

test('sin el mapache de compañero, no aparece', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'Chromium a 390');
  await alCasino(page, { companero: 'conejo-chistera' });
  await settled(page);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__casino3d.mapache())).toBeNull();
});

test('vídeo: el mapache te sigue y hace malabares', async ({ browser }, info) => {
  test.skip(!process.env.CASINO_VIDEO || !/^(chromium|webkit)-390x844$/.test(info.project.name), 'solo con CASINO_VIDEO=1');
  test.setTimeout(120000);
  const bruto = join(DIR, 'bruto');
  mkdirSync(bruto, { recursive: true });
  const context = await browser.newContext({ ...info.project.use, recordVideo: { dir: bruto, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const { casino } = await alCasino(page, { reduced: false });
  const pausa = (ms) => page.waitForTimeout(ms);
  await page.waitForFunction(() => window.__casino3d.mapache());
  await pausa(3500);
  for (const n of ['chisteras', 'vitrina', 'caja']) {
    await ir(page, casino, n);
    await pausa(3000);
  }
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join(DIR, `mapache-${info.project.name}.webm`));
});

// ── En el piso en primera persona: se queda contigo en el suelo, delante del sillón y a la vista; quien te visita lo ve ──
const BEA = { id: '22222222-2222-4222-8222-222222222222', email: 'bea@ejemplo.test' };
const PISO = [
  { uid: 1, id: 'sillon', x: 4, y: 6, rot: 2, tono: 1 },
  { uid: 2, id: 'mesa-baja', x: 4, y: 4, rot: 0, tono: 0 },
  { uid: 3, id: 'estanteria', x: 2, y: 0, rot: 0, tono: 0 },
];
function alPiso(companeros) {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true }, { user_id: BEA.id, alias: 'Bea', avatar_id: 'lector-farol', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' }, { user_id: BEA.id, edificio: 'edificio-1', puerta: '1A' });
  for (const u of [ANA, BEA]) mock.db.pisos.push({ user_id: u.id, layout: { v: 1, pared: 'salvia', suelo: 'tablas', items: JSON.parse(JSON.stringify(PISO)) } });
  mock.db.sala_personajes = companeros;
  return mock;
}
const enPiso = (page) => page.evaluate(() => window.__pisoLab().mapache());

test('en tu piso en 3D: el mapache se queda contigo, a la vista y haciendo malabares', async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844|430x932|1440x900)$|^webkit-390x844$/.test(info.project.name), 'tamaños');
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const mock = alPiso([{ user_id: ANA.id, personaje: null, companero: 'mapache-crupier' }]);
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await expect.poll(() => enPiso(page).then((m) => m?.visible && m.front), { timeout: 10000 }).toBe(true);
  // Se anima (malabares) mientras se ve
  const antes = (await enPiso(page)).steps;
  await expect.poll(() => enPiso(page).then((m) => m.steps), { timeout: 5000 }).toBeGreaterThan(antes + 3);
  await page.waitForTimeout(300);
  await shot(page, info, '15-mapache-piso');
  expect(errors).toEqual([]);
});

test('en tu piso en 3D, con movimiento reducido: quieto, sin malabares', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'Chromium a 390');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const mock = alPiso([{ user_id: ANA.id, personaje: null, companero: 'mapache-crupier' }]);
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await expect.poll(() => enPiso(page).then((m) => m?.visible), { timeout: 10000 }).toBe(true);
  await page.waitForTimeout(800);
  const m = await enPiso(page);
  expect(m.running).toBe(false);
  expect(m.steps).toBe(0);
});

test('de visita: el mapache de Bea está en su piso; en el tuyo, sin él, no hay ninguno', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'Chromium a 390');
  test.setTimeout(90000);
  const mock = alPiso([{ user_id: BEA.id, personaje: null, companero: 'mapache-crupier' }]);
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1200);
  expect(await enPiso(page)).toBeNull();
  await page.getByRole('button', { name: 'Al edificio' }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Llamar y entrar en el piso de Bea, 1.º A' }).click();
  await expect(page.locator('.ep-canvas')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Entrar en 3D' }).click();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await expect.poll(() => enPiso(page).then((m) => m?.visible && m.front), { timeout: 10000 }).toBe(true);
  await page.waitForTimeout(300);
  await shot(page, info, '16-mapache-visita');
});

test('vídeo: el mapache en tu piso en 3D, haciendo malabares', async ({ browser }, info) => {
  test.skip(!process.env.CASINO_VIDEO || !/^(chromium|webkit)-390x844$/.test(info.project.name), 'solo con CASINO_VIDEO=1');
  test.setTimeout(120000);
  const bruto = join(DIR, 'bruto');
  mkdirSync(bruto, { recursive: true });
  const context = await browser.newContext({ ...info.project.use, recordVideo: { dir: bruto, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const mock = alPiso([{ user_id: ANA.id, personaje: null, companero: 'mapache-crupier' }]);
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await expect.poll(() => enPiso(page).then((m) => m?.visible), { timeout: 10000 }).toBe(true);
  await page.waitForTimeout(6000);
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join(DIR, `mapache-piso-${info.project.name}.webm`));
});
