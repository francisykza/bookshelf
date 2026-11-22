// Libo, bloque 4, ampliación «Atrás en las salas» (docs/qa/libo.md §6): dentro de cada sala del Gran Hotel, el botón Atrás del
// móvil cierra lo último abierto igual que su botón de volver (el papel del vestíbulo, la mesa, la ruleta y la vitrina del
// casino, la ficha, el directorio y el mercadillo del almacén, el sillón y la librería de la sala de lectura) y, con todo
// cerrado, vuelve a la plaza del hotel. Supabase simulado y datos sintéticos (ninguna cuenta real). Emulación: no equivale a un
// móvil real. Capturas en qa-report/libo/<proyecto>/ y vídeo de cada recorrido.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { ANA, alAlmacen, mockAlmacen } from './almacenHelpers';

const DIR = join('qa-report', 'libo');

test.use({ video: 'on' });

test.beforeEach(async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844)$|^webkit-390x844$/.test(info.project.name), 'móvil vertical');
  mkdirSync(join(DIR, info.project.name), { recursive: true });
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});
const shot = (page, info, name) => page.screenshot({ path: join(DIR, info.project.name, `${name}.png`) });
// La capa se vuelve a apuntar 60 ms después de abrir algo (hooks/useAtras.js): se espera un poco antes de pulsar Atrás
const atras = async (page) => {
  await page.waitForTimeout(250);
  await page.goBack();
};

async function alHotel(page, mock) {
  await mock.attach(page, ANA);
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
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible({ timeout: 15000 });
  return hotel;
}
/** Por el Directorio del hotel hasta una sala. */
async function porDirectorio(hotel, nombre) {
  await hotel.getByRole('button', { name: 'Directorio' }).click({ timeout: 15000 });
  await hotel.getByRole('dialog', { name: 'Directorio' }).getByRole('button', { name: nombre }).click();
}
const enLaPlaza = async (page, hotel, sala) => {
  await expect(sala).toHaveCount(0);
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' })).toBeVisible();
};

test('el vestíbulo: Atrás cierra el papel del mostrador y saca del ascensor; después, a la plaza', async ({ page }, info) => {
  test.setTimeout(120000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  const hotel = await alHotel(page, mock);
  await expect(hotel.locator('.gh-art')).not.toHaveClass(/is-walking/, { timeout: 8000 });
  await page.evaluate(() => window.__granHotel.hotel().setView(0));
  await page.waitForTimeout(300);
  const p = await page.evaluate(() => {
    const v = window.__granHotel;
    const z = v.zones.find((x) => x.id === 'vestibulo');
    const r = v.canvas.getBoundingClientRect();
    return { x: r.left + z.center.x * r.width, y: r.top + z.center.y * r.height };
  });
  await page.mouse.click(p.x, p.y);
  const sala = hotel.getByRole('region', { name: 'El vestíbulo' });
  await expect(sala).toBeVisible({ timeout: 8000 });

  // Los encargos del conserje
  await sala.getByRole('button', { name: /Encargos de la semana/ }).click();
  const papel = sala.locator('.rcp-card');
  await expect(papel).toBeVisible();
  await page.waitForTimeout(500);
  await shot(page, info, 'salas-1-vestibulo-papel');
  await atras(page);
  await expect(papel).toHaveCount(0);
  await expect(sala).toBeVisible();

  // Dentro del ascensor
  await sala.locator('.rcp-tool', { hasText: 'Ascensor' }).click();
  const salir = sala.getByRole('button', { name: 'Salir del ascensor' });
  await expect(salir).toBeVisible({ timeout: 8000 });
  await atras(page);
  await expect(salir).toHaveCount(0);
  await expect(sala).toBeVisible();

  // Con todo cerrado, a la plaza
  await atras(page);
  await enLaPlaza(page, hotel, sala);
  expect(errores).toEqual([]);
});

test('el casino: Atrás levanta de la mesa, deja la ruleta y la vitrina; después, a la plaza', async ({ page }, info) => {
  test.setTimeout(150000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.casino = { fichas: 30, semana: 30 };
  const hotel = await alHotel(page, mock);
  await porDirectorio(hotel, /Casino del sótano/);
  const casino = hotel.getByRole('region', { name: 'El casino del sótano' });
  await expect(casino).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
  await page.waitForFunction(() => window.__casino3d?.renders() > 0);
  const settled = () => page.waitForFunction(() => window.__casino3d?.settled());
  const ir = async (name) => {
    await casino.getByRole('button', { name: 'Plano' }).click();
    await casino.getByRole('navigation', { name: 'Plano de la sala' }).getByRole('button', { name }).click();
  };

  // La mesa de «Las 21 páginas»
  await casino.locator('.cs3-tag', { hasText: 'Las 21 páginas' }).click();
  await page.waitForFunction(() => window.__casino3d.sentado() && window.__casino3d.settled());
  await page.waitForTimeout(300);
  await shot(page, info, 'salas-2-casino-mesa');
  await atras(page);
  await page.waitForFunction(() => !window.__casino3d.sentado());
  await settled();
  await expect(casino).toBeVisible();

  // La ruleta y la vitrina
  await ir(/La ruleta/);
  await page.waitForFunction(() => window.__casino3d.enRuleta() && window.__casino3d.settled());
  await atras(page);
  await page.waitForFunction(() => !window.__casino3d.enRuleta());
  await settled();
  await ir(/La vitrina/);
  await page.waitForFunction(() => window.__casino3d.enVitrina() && window.__casino3d.settled());
  await page.waitForTimeout(300);
  await shot(page, info, 'salas-3-casino-vitrina');
  await atras(page);
  await page.waitForFunction(() => !window.__casino3d.enVitrina());
  await settled();
  await expect(casino).toBeVisible();

  // Con todo cerrado, a la plaza
  await atras(page);
  await enLaPlaza(page, hotel, casino);
  expect(errores).toEqual([]);
});

test('el almacén: Atrás cierra el directorio y la ficha y sale del mercadillo; después, a la plaza', async ({ page }, info) => {
  test.setTimeout(150000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const mock = mockAlmacen();
  const { hotel, alm } = await alAlmacen(page, mock);
  const papel = alm.locator('.alm-card');

  // El directorio de la tienda
  await alm.locator('.alm-bar').getByRole('button', { name: 'Directorio' }).click();
  await expect(papel).toBeVisible();
  await atras(page);
  await expect(papel).toHaveCount(0);
  await expect(alm).toBeVisible();

  // La ficha de un mueble (desde el directorio: Atrás cierra la ficha, no vuelve al directorio)
  await alm.locator('.alm-bar').getByRole('button', { name: 'Directorio' }).click();
  await alm.locator('.alm-dir__item').filter({ has: page.getByText('Sillón', { exact: true }) }).first().click();
  await expect(alm.locator('.alm-card--ficha')).toBeVisible();
  await page.waitForTimeout(600);
  await shot(page, info, 'salas-4-almacen-ficha');
  await atras(page);
  await expect(papel).toHaveCount(0);
  await expect(alm).toBeVisible();

  // El mercadillo de antes: Atrás vuelve al almacén
  await alm.locator('.alm-bar').getByRole('button', { name: 'Mercadillo' }).click();
  const lonja = hotel.getByRole('region', { name: 'La Lonja' });
  await expect(lonja).toBeVisible({ timeout: 15000 });
  await atras(page);
  await expect(lonja).toHaveCount(0);
  await expect(alm).toBeVisible();

  // Con todo cerrado, a la plaza
  await atras(page);
  await enLaPlaza(page, hotel, alm);
  expect(errores).toEqual([]);
});

test('la sala de lectura: Atrás te levanta del sillón y deja la librería; después, a la plaza', async ({ page }, info) => {
  test.setTimeout(150000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.sala = { lomos: [{ id: 'l1', titulo: 'El faro del fin', alias: 'Alguien', mio: false }], saludos: [] };
  const hotel = await alHotel(page, mock);
  await porDirectorio(hotel, /Café-biblioteca/);
  const sala = hotel.getByRole('region', { name: 'La sala de lectura' });
  await expect(sala).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
  await page.waitForFunction(() => window.__sala3d?.renders() > 0);
  const settled = () => page.waitForFunction(() => window.__sala3d?.settled());
  await settled();

  // Un sillón libre
  await sala.locator('.sl3-tag', { hasText: 'Un sillón libre' }).first().click();
  await page.waitForFunction(() => window.__sala3d.sentadoEn() != null && window.__sala3d.settled());
  const sit = sala.locator('.sl3-sit');
  await expect(sit).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, info, 'salas-5-sala-sillon');
  // Al sentarte se abre también qué compartir: Atrás lo cierra primero («Ahora no») y sigues sentada
  const compartir = sala.getByRole('button', { name: 'Sentarme a leer' });
  await expect(compartir).toBeVisible();
  await atras(page);
  await expect(compartir).toHaveCount(0);
  const levantarte = sala.getByRole('button', { name: /Levantarte del (sillón|sofá)/ });
  await expect(levantarte).toBeVisible();
  // Y la siguiente vez, te levanta
  await atras(page);
  await expect(levantarte).toHaveCount(0);
  await settled();
  await expect(sala).toBeVisible();

  // La librería común
  await sala.getByRole('button', { name: 'Plano' }).click();
  await sala.getByRole('navigation', { name: 'Plano de la sala' }).getByRole('button', { name: 'La librería de la sala' }).click();
  await page.waitForFunction(() => window.__sala3d.enLibreria() && window.__sala3d.settled());
  await atras(page);
  await page.waitForFunction(() => !window.__sala3d.enLibreria());
  await settled();
  await expect(sala).toBeVisible();

  // Con todo cerrado, a la plaza
  await atras(page);
  await enLaPlaza(page, hotel, sala);
  expect(errores).toEqual([]);
});
