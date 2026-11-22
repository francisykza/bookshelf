// Libo, bloque 4 (docs/qa/libo.md §3.6; play-store.md §3.4): el botón Atrás del móvil cierra lo último que se abrió dentro de una
// escena antes que la escena entera. Aquí se pulsa el Atrás del navegador (lo mismo que hace el de Android) en el café (la barra,
// el cuaderno de Pilar, Decorar), en el Gran Hotel (una sala y el Directorio) y con el bocadillo de Libo en casa. Supabase simulado
// y datos sintéticos (ninguna cuenta real). Emulación: no equivale a un Android real. Capturas y vídeo en qa-report/libo/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { NEIGHBOURS } from '../src/features/edificio/demo.js';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { CATALOGO_LIBROS } from '../src/features/edificio/cafe/cafeCatalogoLibros';
import { dayKey } from '../src/domain/dates';

const DIR = join('qa-report', 'libo');
const HOY = dayKey();
const LIBROS = CATALOGO_LIBROS.filter((c) => c.genero === 'novela')
  .slice(0, 4)
  .map((c) => ({ clave: c.clave, titulo: c.titulo, genero: 'novela', balda: 1, caja: 0 }));

test.use({ video: 'on' });

test.beforeEach(async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844)$|^webkit-390x844$/.test(info.project.name), 'móvil vertical');
  mkdirSync(join(DIR, info.project.name), { recursive: true });
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    localStorage.setItem('bookshelf:vestibulo-vista', 'plano');
  });
});
const shot = (page, info, name) => page.screenshot({ path: join(DIR, info.project.name, `${name}.png`) });

/** Del salón al portal del edificio, por la tablet. */
async function alPortal(page) {
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await expect(portal.locator('.ed-facade')).not.toHaveClass(/is-arriving/, { timeout: 15000 });
  return portal;
}

test('Atrás en el café: cierra la barra, el cuaderno y Decorar antes de salir al portal', async ({ page }, info) => {
  test.setTimeout(120000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 120, sin_raro: 3 } },
    piso_inventario: { [ANA.id]: { sillon: 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  await mock.attach(page, ANA);
  await simularCafe(
    page,
    { inaugurado: true, nombre: 'Taza y Lomo', nivel: 2, reputacion: 2400, granos: 300, plano: structuredClone(PLANO_INICIAL), inventario: cuenta(PLANO_INICIAL), libros: { bienvenida: true, libros: LIBROS } },
    { clientes: { hoy: HOY, semillas: [2100, 1000, 8919], quienes: [3], frases: [10] }, pilar: { hucha: 1, guardado: 0 } },
  );
  const portal = await alPortal(page);
  await portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' }).click({ timeout: 15000 });
  const cafe = page.getByRole('dialog', { name: 'El café-librería del bajo' });
  await expect(cafe.locator('.cf3[data-ready="true"]')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__cafe3d?.settled() && window.__cafe3d.renders() > 0);

  // La barra: Atrás es «Luego» (el cliente sigue esperando)
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  const luego = cafe.getByRole('button', { name: 'Luego', exact: true });
  await expect(luego).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, info, 'atras-1-barra');
  await page.goBack();
  await expect(luego).toHaveCount(0);
  await expect(cafe).toBeVisible();
  await expect(cafe.getByRole('button', { name: 'Atender', exact: true })).toBeVisible();

  // El cuaderno de Pilar
  await cafe.getByRole('button', { name: 'El cuaderno de Pilar: tareas a cambio de granos' }).click();
  const cuaderno = cafe.getByRole('region', { name: 'El cuaderno de Pilar' });
  await expect(cuaderno).toBeVisible();
  await page.goBack();
  await expect(cuaderno).toHaveCount(0);
  await expect(cafe).toBeVisible();

  // Decorar sin cambios: Atrás sale de Decorar
  await cafe.getByRole('button', { name: 'Decorar' }).click();
  const listo = cafe.getByRole('button', { name: 'Listo' });
  await expect(listo).toBeVisible();
  await page.goBack();
  await expect(listo).toHaveCount(0);
  await expect(cafe).toBeVisible();

  // Con todo cerrado, Atrás sale del café al portal
  await page.goBack();
  await expect(cafe).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'El edificio del puerto' })).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, info, 'atras-2-portal');
  expect(errores).toEqual([]);
});

test('Atrás en el Gran Hotel: de la sala a la plaza, cierra el Directorio y luego vuelve al portal', async ({ page }, info) => {
  test.setTimeout(120000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  await mock.attach(page, ANA);
  const portal = await alPortal(page);
  await portal.getByRole('button', { name: 'Coger la limusina al Gran Hotel' }).click({ timeout: 15000 });
  const hotel = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' });
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible({ timeout: 15000 });
  await expect(hotel.locator('.gh-art')).not.toHaveClass(/is-walking/, { timeout: 8000 });

  // Una sala: el vestíbulo
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
  await page.waitForTimeout(500);
  await shot(page, info, 'atras-3-sala');
  await page.goBack();
  await expect(sala).toHaveCount(0);
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible();

  // El Directorio
  await hotel.getByRole('button', { name: 'Directorio' }).click();
  const directorio = hotel.getByRole('dialog', { name: 'Directorio' });
  await expect(directorio).toBeVisible();
  await page.goBack();
  await expect(directorio).toHaveCount(0);
  await expect(hotel).toBeVisible();

  // Y por fin, al portal
  await page.goBack();
  await expect(hotel).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'El edificio del puerto' })).toBeVisible();
  expect(errores).toEqual([]);
});

test('Atrás con Libo: cierra su bocadillo y no sale de casa', async ({ page }, info) => {
  test.setTimeout(90000);
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout: NEIGHBOURS.find((n) => n.id === '1a').room() });
  mock.db.piso_cuentas[ANA.id] = { inicio_elegido: true, tickets: 60, sin_raro: 0 };
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  const escena = page.locator('.plab-stage[data-ready]');
  await expect(escena).toBeVisible({ timeout: 30000 });
  const gato = page.locator('.libo-rincon__gato');
  await gato.click();
  const bocadillo = page.locator('.libo-bocadillo');
  await expect(bocadillo).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, info, 'atras-4-libo');
  await page.goBack();
  await expect(bocadillo).toHaveCount(0);
  await expect(escena).toBeVisible();
  await expect(gato).toBeVisible();
  // Abrir y cerrar con el propio gato no deja entradas de más: Atrás no vuelve a abrir nada ni se queda atascado
  await gato.click();
  await expect(bocadillo).toBeVisible();
  await gato.click();
  await expect(bocadillo).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (Array.isArray(history.state?.capas) ? history.state.capas.length : 0))).toBe(0);
});

test('Atrás en el ordenador del piso: cierra la app y el cajón de aplicaciones antes de salir', async ({ page }, info) => {
  test.setTimeout(90000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout: NEIGHBOURS.find((n) => n.id === '1a').room() });
  mock.db.piso_cuentas[ANA.id] = { inicio_elegido: true, tickets: 60, sin_raro: 0 };
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  const escena = page.locator('.plab-stage[data-ready]');
  await expect(escena).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
  const escritorio = page.getByRole('heading', { name: 'Mi escritorio' });
  await expect(escritorio).toBeVisible({ timeout: 12000 });

  // El cajón «Aplicaciones»
  const cajon = page.locator('.pp-apps');
  await page.getByRole('button', { name: 'Aplicaciones', exact: true }).click();
  await expect(cajon).toBeVisible();
  await page.goBack();
  await expect(cajon).toBeHidden();
  await expect(escritorio).toBeVisible();

  // Una app abierta desde el cajón: Atrás vuelve al ordenador (al cajón, que recuerda de dónde venías)
  await page.getByRole('button', { name: 'Aplicaciones', exact: true }).click();
  await cajon.getByRole('button', { name: 'Reto anual' }).click();
  await expect(escritorio).toHaveCount(0);
  await page.waitForTimeout(400);
  await shot(page, info, 'atras-5-app');
  await page.goBack();
  await expect(cajon).toBeVisible();
  // El cajón vuelve a apuntarse en el historial al repintarse (60 ms); nadie pulsa Atrás tan rápido
  await page.waitForTimeout(200);
  await page.goBack();
  await expect(cajon).toBeHidden();
  await expect(escritorio).toBeVisible();

  // Y, con todo cerrado, fuera del ordenador
  await page.goBack();
  await expect(escritorio).toHaveCount(0);
  await expect(escena).toBeVisible();
  expect(errores).toEqual([]);
});
