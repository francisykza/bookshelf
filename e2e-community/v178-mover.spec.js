// 1.78 · Más difícil mover un mueble sin querer (encargo de Francisco del 3-11-2026), con Supabase simulado: en tu piso,
// decorando, un deslizamiento rápido sobre un mueble no lo mueve; hay que tocarlo antes, o mantenerlo pulsado un
// momento, y entonces arrastrarlo (1.81: ya elegido, se arrastra sin esperar). Tocar un hueco con un mueble elegido lo suelta, ya no lo lleva allí.
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

async function openMyFlat(page, mock) {
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await panel.getByRole('button', { name: /^Entrar en tu piso/ }).click({ timeout: 15000 });
  return page.getByRole('dialog', { name: 'Tu piso' });
}

const items = (page) => page.evaluate(() => window.__edificioPiso.room.items.map((i) => ({ uid: i.uid, x: i.x, y: i.y })));
const pointOf = (page, uid) => page.evaluate((u) => window.__edificioPiso.screenOfItem(u), uid);
// Una celda libre del suelo, lejos de los muebles
const freeFloor = (page) =>
  page.evaluate(() => {
    const piso = window.__edificioPiso;
    for (const [x, y] of [[1, 7], [7, 7], [1, 1], [7, 1], [4, 7], [1, 4]]) if (!piso.room.items.some((i) => i.x - 1 <= x && x < i.x + 3 && i.y - 1 <= y && y < i.y + 3)) return { cell: [x, y], at: piso.screenOf(x + 0.5, y + 0.5, 0) };
    return { cell: [4, 8], at: piso.screenOf(4.5, 8.5, 0) };
  });

test('decorando: deslizar no mueve, mantener pulsado sí, y tocar un hueco suelta', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|1440x900)$/.test(info.project.name), '360, 390 y escritorio en Chromium');
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const mine = await openMyFlat(page, mock);
  await expect(mine.locator('canvas.ep-canvas')).toBeVisible();
  await mine.getByRole('button', { name: 'Decorar' }).click();
  await expect(mine.getByRole('button', { name: 'Terminar' })).toBeVisible();
  await page.waitForFunction(() => window.__edificioPiso?.room?.items?.some((i) => i.id === 'sillon'));
  const before = await items(page);
  const uid = await page.evaluate(() => window.__edificioPiso.room.items.find((i) => i.id === 'sillon').uid);
  const status = mine.locator('.ep-status');
  const { at: to } = await freeFloor(page);

  // Un deslizamiento rápido por encima del sillón: no se mueve nada
  let from = await pointOf(page, uid);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
  expect(await items(page)).toEqual(before);
  await expect(status).toContainText('tócalo y luego arrástralo');

  // El toque lo dejó elegido, con sus herramientas; tocar un hueco lo suelta (ya no lo lleva allí)
  await expect(mine.locator('.ep-tools')).toBeVisible();
  await page.mouse.click(to.x, to.y);
  await expect(status).toContainText('Toca un mueble para elegirlo');
  expect(await items(page)).toEqual(before);
  await expect(mine.locator('.ep-tools')).toBeHidden();

  // Mantenerlo pulsado lo levanta; entonces, arrastrarlo lo mueve
  from = await pointOf(page, uid);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.waitForTimeout(450);
  await expect(status).toContainText('en la mano');
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await shot(page, info, 'v178-mover-en-la-mano');
  await page.mouse.up();
  await expect(status).toContainText('en su sitio nuevo');
  const moved = (await items(page)).find((i) => i.uid === uid);
  const was = before.find((i) => i.uid === uid);
  expect([moved.x, moved.y]).not.toEqual([was.x, was.y]);

  // Ya elegido, se arrastra sin esperar
  from = await pointOf(page, uid);
  const { at: back } = await freeFloor(page);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(back.x, back.y, { steps: 6 });
  await page.mouse.up();
  await expect(status).toContainText('en su sitio nuevo');
  const again = (await items(page)).find((i) => i.uid === uid);
  expect([again.x, again.y]).not.toEqual([moved.x, moved.y]);
  expect(errors).toEqual([]);
});
