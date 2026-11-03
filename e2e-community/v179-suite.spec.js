// 1.79 · La suite de la semana en el ático del Gran Hotel, decorada entre todos, con Supabase simulado: se entra desde
// el Directorio (o tocando el ático, o con la «Á» del ascensor); arriba, la habitación común con su placa; debajo,
// llevar un mueble tuyo (sin perderlo), ponerlo en otro sitio, cambiarlo o retirarlo, quién ha traído qué y cuánto
// falta para la placa. Ningún piso sale de su edificio y no se vota.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const LUIS = '22222222-2222-4222-8222-222222222222';
const MARA = '33333333-3333-4333-8333-333333333333';

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

async function toHotel(page, suite) {
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.profiles.push({ user_id: LUIS, alias: 'Luis del 3.º', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.profiles.push({ user_id: MARA, alias: 'Mara', avatar_id: 'gato-lector', community_enabled: true });
  if (suite) mock.db.suite = suite;
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
  return { hotel, mock };
}

const aportesDe = (mock) => mock.db.suite.aportes.map((a) => ({ user_id: a.user_id, id: a.item.id }));

test('la suite: lo que han traído los demás, llevar un mueble tuyo, otro sitio, cambiarlo y retirarlo', async ({ page }, info) => {
  test.skip(!/chromium-(320x640|390x844|1440x900)$|webkit-390x844/.test(info.project.name), '320, 390 (Chromium y WebKit) y escritorio');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const { hotel, mock } = await toHotel(page, {
    pared: 'noche',
    suelo: 'damero',
    aportes: [
      { user_id: LUIS, item: { id: 'sofa', tono: 0, x: 1, y: 1, rot: 0 } },
      { user_id: MARA, item: { id: 'cuadro', tono: 1, pared: 'fondo', a: 3 } },
    ],
    semanas: { [ANA.id]: 1 },
  });

  await hotel.getByRole('button', { name: 'Directorio' }).click();
  const floor = hotel.getByRole('button', { name: /Suite de la semana/ });
  await expect(floor).toContainText('Abierto · entrar');
  await floor.click();
  const suite = hotel.getByRole('region', { name: 'La suite de la semana' });
  await expect(suite.locator('.gh-suite__plate')).toContainText('2 huéspedes la decoran');
  await expect(suite.locator('.gh-suite__who')).toContainText('Luis del 3.º · Sofá');
  await expect(suite.locator('.gh-suite__who')).toContainText('Mara · Cuadro');
  await expect(suite.locator('canvas').first()).toBeVisible();
  await expect(suite).toContainText('Semanas decorando: 1 de 4');
  await expect(hotel.getByRole('button', { name: 'A la calle' })).toBeVisible();
  await shot(page, info, 'v179-suite');

  // Llevar el sillón: queda en la suite, a nombre de Ana, y cuenta la semana
  const picks = suite.getByRole('list', { name: 'Tus muebles para llevar' });
  await picks.getByRole('button', { name: 'Sillón' }).click();
  await expect(suite.getByRole('status').last()).toContainText('Has llevado sillón a la suite');
  await expect(suite.locator('.gh-suite__who')).toContainText('Tú · Sillón');
  await expect(suite).toContainText('Semanas decorando: 2 de 4');
  expect(aportesDe(mock)).toContainEqual({ user_id: ANA.id, id: 'sillon' });
  const primero = mock.db.suite.aportes.find((a) => a.user_id === ANA.id).item;
  await shot(page, info, 'v179-suite-llevado');

  // Otro sitio: el mismo sillón, en otra parte
  await suite.getByRole('button', { name: 'Otro sitio' }).click();
  await expect(suite.getByRole('status').last()).toContainText('otro sitio');
  const segundo = mock.db.suite.aportes.find((a) => a.user_id === ANA.id).item;
  expect(segundo.id).toBe('sillon');
  expect([segundo.x, segundo.y, segundo.rot]).not.toEqual([primero.x, primero.y, primero.rot]);

  // Cambiarlo por otro (sigue siendo uno por persona)
  await suite.getByRole('button', { name: 'Cambiar' }).click();
  await picks.getByRole('button', { name: 'Estantería' }).click();
  await expect(suite.locator('.gh-suite__who')).toContainText('Tú · Estantería');
  expect(aportesDe(mock).filter((a) => a.user_id === ANA.id)).toEqual([{ user_id: ANA.id, id: 'estanteria' }]);

  // Retirarlo
  await suite.getByRole('button', { name: 'Retirar' }).click();
  await expect(suite.getByRole('status').last()).toContainText('de vuelta');
  expect(aportesDe(mock).map((a) => a.user_id)).toEqual([LUIS, MARA]);
  await page.keyboard.press('Escape');
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('recién vaciada, con la «Á» del ascensor, y la placa al cuarto lunes', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'una vez basta');
  const { hotel, mock } = await toHotel(page, { aportes: [], semanas: { [ANA.id]: 3 } });
  await hotel.getByRole('button', { name: 'Directorio' }).click();
  await hotel.getByRole('button', { name: /Vestíbulo/ }).click();
  await hotel.getByRole('tab', { name: 'Ascensor' }).click();
  await hotel.getByRole('button', { name: /La suite de la semana/ }).click();
  const suite = hotel.getByRole('region', { name: 'La suite de la semana' });
  await expect(suite.locator('.gh-suite__plate')).toContainText('Recién vaciada');
  await expect(suite).toContainText('Nadie todavía: estrénala tú.');
  await shot(page, info, 'v179-suite-vacia');
  await suite.getByRole('list', { name: 'Tus muebles para llevar' }).getByRole('button', { name: 'Sillón' }).click();
  await expect(suite.getByRole('status').last()).toContainText('Tienes la Placa de la suite');
  await expect(suite).toContainText('Ya tienes la Placa de la suite.');
  expect(mock.db.suite.placas).toEqual([ANA.id]);
});

test('sin la migración de la suite, la sala dice que abre pronto', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'una vez basta');
  const { hotel } = await toHotel(page, null);
  await hotel.getByRole('button', { name: 'Directorio' }).click();
  await hotel.getByRole('button', { name: /Suite de la semana/ }).click();
  await expect(hotel.getByRole('region', { name: 'La suite de la semana' })).toContainText('abre muy pronto');
});
