// 1.77 · El armario de tu piso según la maqueta de Francisco, con Supabase simulado: un modo propio del piso, con la
// barra «← Al piso» y «Armario», tu piso de verdad encuadrado en tu personaje (con un sillón delante) y quien te
// acompaña a su lado; abajo, Ropa, Aspecto y Compañía. Lo que se toca se ve al momento, pero solo se guarda con
// «Listo»; volver antes deja lo de antes.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_AVATAR } from '../src/features/edificio/actor.js';
import { starterRoom } from '../src/features/edificio/demo.js';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const DRAGON = 'Dragoncillo de escamas rojas';
const ZORRO = 'Zorro de bruma y ceniza';

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

function seed() {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.personajes = true;
  mock.db.misticos = true;
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  // El sillón, delante del sitio del personaje: la escena tiene que verse con su profundidad
  const layout = starterRoom();
  Object.assign(
    layout.items.find((i) => i.id === 'sillon'),
    { x: 3, y: 7 },
  );
  mock.db.pisos.push({ user_id: ANA.id, layout, personaje: DEFAULT_AVATAR, companero: 'dragoncillo' });
  const inv = {};
  for (const i of layout.items) inv[i.id] = (inv[i.id] ?? 0) + 1;
  Object.assign(inv, { dragoncillo: 1, 'zorro-bruma': 1 });
  mock.db.piso_cuentas = { [ANA.id]: { inicio_elegido: true, tickets: 30, sin_raro: 0 } };
  mock.db.piso_inventario = { [ANA.id]: inv };
  return mock;
}

async function toPortal(page, mock) {
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  return page.getByRole('dialog', { name: 'El edificio del puerto' });
}

async function openWardrobe(page) {
  const panel = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await panel.getByRole('button', { name: /^Entrar en tu piso/ }).click({ timeout: 15000 });
  const mine = page.getByRole('dialog', { name: 'Tu piso' });
  const canvas = mine.locator('canvas.ep-canvas');
  await expect(canvas).toHaveAttribute('data-actor', 'stand');
  const at = await canvas.evaluate((c) => {
    const [x, y] = c.dataset.actorAt.split(',').map(Number);
    const r = c.getBoundingClientRect();
    return { x: r.left + (x / c.width) * r.width, y: r.top + (y / c.height) * r.height };
  });
  await page.mouse.click(at.x, at.y);
  await expect(mine.locator('.ep-dress')).toBeVisible();
  return mine;
}

// Píxeles rojos de escama junto al personaje (en el trozo del lienzo que se ve): el dragón está a su lado
const dragonPixels = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('canvas.ep-canvas');
    const stage = c.parentElement.getBoundingClientRect();
    const r = c.getBoundingClientRect();
    const k = r.width / c.width;
    const x0 = Math.max(0, Math.floor((stage.left - r.left) / k));
    const y0 = Math.max(0, Math.floor((stage.top - r.top) / k));
    const x1 = Math.min(c.width, Math.ceil((stage.right - r.left) / k));
    const y1 = Math.min(c.height, Math.ceil((stage.bottom - r.top) / k));
    const d = c.getContext('2d').getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 120 && d[i + 1] < 70 && d[i + 2] < 80 && d[i] - d[i + 2] > 70) n += 1;
    return n;
  });

test('Compañía: el dragón marcado se ve junto a tu personaje; volver deja lo de antes y «Listo» guarda', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), '390 en Chromium');
  const mock = seed();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await toPortal(page, mock);
  const mine = await openWardrobe(page);

  // La barra compacta y las tres pestañas
  await expect(mine.getByRole('button', { name: 'Al piso' })).toBeVisible();
  await expect(mine.locator('.ed-bar__title')).toHaveText('Armario');
  await expect(mine.getByRole('tab')).toHaveText(['Ropa', 'Aspecto', 'Compañía']);
  await mine.getByRole('tab', { name: 'Compañía' }).click();
  const cards = mine.getByRole('group', { name: 'Compañía' });
  await expect(cards.getByRole('button')).toHaveText(['Sin compañía', DRAGON, ZORRO]);
  await expect(cards.getByRole('button', { name: DRAGON })).toHaveAttribute('aria-pressed', 'true');
  await expect(cards.locator('.ep-pal[aria-pressed="true"] .ep-pal__check')).toBeVisible();
  await page.waitForTimeout(900);
  const withDragon = await dragonPixels(page);
  expect(withDragon).toBeGreaterThan(60);
  await shot(page, info, 'v177-armario-compania');

  // Dragón → zorro → «Sin compañía»: se ve al momento, sin guardar nada
  await cards.getByRole('button', { name: ZORRO }).click();
  await expect(cards.getByRole('button', { name: ZORRO })).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(300);
  expect(await dragonPixels(page)).toBeLessThan(withDragon / 3);
  await shot(page, info, 'v177-armario-zorro');
  await cards.getByRole('button', { name: 'Sin compañía' }).click();
  await expect(cards.getByRole('button', { name: 'Sin compañía' })).toHaveAttribute('aria-pressed', 'true');
  // Ropa: también se prueba sin guardar
  await mine.getByRole('tab', { name: 'Ropa' }).click();
  await mine.getByRole('group', { name: 'Jersey' }).getByRole('button', { name: 'Ciruela' }).click();
  expect(await page.evaluate(() => window.__edificioPiso.avatar.jersey)).toBe(6);

  // «← Al piso»: todo como estaba (el dragón, el jersey de antes) y nada guardado
  await mine.getByRole('button', { name: 'Al piso' }).click();
  await expect(mine.locator('.ep-dress')).toBeHidden();
  await expect(mine.getByRole('button', { name: 'Volver al portal' })).toBeVisible();
  expect(await page.evaluate(() => window.__edificioPiso.avatar)).toEqual(DEFAULT_AVATAR);
  expect(mock.db.pisos.find((p) => p.user_id === ANA.id).companero).toBe('dragoncillo');
  expect(mock.db.pisos.find((p) => p.user_id === ANA.id).personaje).toEqual(DEFAULT_AVATAR);

  // Escape también cierra el armario sin guardar (y no el piso)
  const at = await page.locator('canvas.ep-canvas').evaluate((c) => {
    const [x, y] = c.dataset.actorAt.split(',').map(Number);
    const r = c.getBoundingClientRect();
    return { x: r.left + (x / c.width) * r.width, y: r.top + (y / c.height) * r.height };
  });
  await page.mouse.click(at.x, at.y);
  await mine.getByRole('tab', { name: 'Compañía' }).click();
  await expect(cards.getByRole('button', { name: DRAGON })).toHaveAttribute('aria-pressed', 'true');
  await cards.getByRole('button', { name: ZORRO }).click();
  await page.keyboard.press('Escape');
  await expect(mine.locator('.ep-dress')).toBeHidden();
  await expect(mine).toBeVisible();

  // Con el zorro y «Listo»: se guarda y vuelve al piso; al volver a entrar, el zorro sigue contigo
  await page.mouse.click(at.x, at.y);
  await mine.getByRole('tab', { name: 'Compañía' }).click();
  await cards.getByRole('button', { name: ZORRO }).click();
  await mine.getByRole('button', { name: 'Listo' }).click();
  await expect(mine.locator('.ep-dress')).toBeHidden();
  await expect.poll(() => mock.db.pisos.find((p) => p.user_id === ANA.id).companero, { timeout: 8000 }).toBe('zorro-bruma');
  await mine.getByRole('button', { name: 'Volver al portal' }).click();
  await openWardrobe(page);
  await page.getByRole('tab', { name: 'Compañía' }).click();
  await expect(page.getByRole('group', { name: 'Compañía' }).getByRole('button', { name: ZORRO })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('a 360 px, con movimiento reducido: tarjetas legibles, «Listo» a mano y el dragón quieto a tu lado', async ({ page }, info) => {
  test.skip(!/chromium-360x800$/.test(info.project.name), '360 en Chromium');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const mock = seed();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await toPortal(page, mock);
  const mine = await openWardrobe(page);
  await mine.getByRole('tab', { name: 'Compañía' }).click();
  // Los nombres enteros, sin salirse de su tarjeta
  const overflow = await page.$$eval('.ep-pal', (bs) => bs.map((b) => b.querySelector('.ep-pal__name').scrollWidth - b.querySelector('.ep-pal__name').clientWidth));
  expect(Math.max(...overflow)).toBeLessThanOrEqual(0);
  const ready = mine.getByRole('button', { name: 'Listo' });
  const box = await ready.boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height);
  expect(await dragonPixels(page)).toBeGreaterThan(40);
  // Quieto: dos momentos dan el mismo dibujo
  const frame = () => page.evaluate(() => document.querySelector('canvas.ep-canvas').toDataURL());
  const a = await frame();
  await page.waitForTimeout(700);
  expect(await frame()).toBe(a);
  await shot(page, info, 'v177-armario-360');
  expect(errors).toEqual([]);
});
