// 1.162.2 · Lo que le pasaba a la compañera de Francisco en el iPhone (28-11-2026): el café, «a veces», sin el 3D, y la pantalla
// marrón al tocar Comunidad en el ordenador.
// 1) El café pierde el 3D (como al volver de WhatsApp) y el navegador lo devuelve: sigue en 3D, sin el aviso «Sin 3D». Si no lo
//    devuelve, a los pocos segundos sale el aviso de siempre.
// 2) Comunidad, desde el ordenador del piso: mientras se descarga, la pantalla de carga de Libotown con «Abriendo la
//    comunidad…» (antes, nada), y nunca «Abriendo tu piso…».
// Supabase simulado y una cuenta de prueba. Emulación: no equivale a un iPhone real.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NEIGHBOURS } from '../src/features/edificio/demo.js';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { simularCafe } from './cafeMock';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { alEdificio } from './entrada';

const DIR = join('qa-report', 'v11622-3d-vuelve');
const shot = (page, info, name) => page.screenshot({ path: join(DIR, info.project.name, `${name}.png`) });

test.use({ video: 'on' });

test.beforeEach(async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844)$|^webkit-390x844$/.test(info.project.name), 'móvil vertical');
  mkdirSync(join(DIR, info.project.name), { recursive: true });
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});

function semilla() {
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '1A' });
  mock.db.pisos.push({ user_id: ANA.id, layout: NEIGHBOURS.find((n) => n.id === '1a').room() });
  mock.db.piso_cuentas[ANA.id] = { inicio_elegido: true, tickets: 60, sin_raro: 0 };
  return mock;
}

/** Quita el contexto WebGL del lienzo del café (lo que hace el móvil) y, si `volver`, lo devuelve al rato. */
const perder = (page, volver) =>
  page.evaluate(async (volver) => {
    const canvas = document.querySelector('.cf3-stage canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const ext = gl.getExtension('WEBGL_lose_context');
    ext.loseContext();
    if (!volver) return;
    await new Promise((r) => setTimeout(r, 900));
    ext.restoreContext();
  }, volver);

async function alCafe(page) {
  const mock = semilla();
  await mock.attach(page, ANA);
  await simularCafe(page, { inaugurado: true, nombre: 'Taza y Lomo', plano: structuredClone(PLANO_INICIAL), inventario: cuenta(PLANO_INICIAL) });
  await page.goto('/');
  const portal = await alEdificio(page);
  await portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' }).click({ timeout: 15000 });
  const cafe = page.getByRole('dialog', { name: 'El café-librería del bajo' });
  await expect(cafe.locator('.cf3[data-ready="true"]')).toBeVisible({ timeout: 25000 });
  await page.waitForFunction(() => window.__cafe3d?.settled() && window.__cafe3d.renders() > 0);
  return cafe;
}

test('el café pierde el 3D y el navegador lo devuelve: sigue en 3D; si no lo devuelve, el aviso de siempre', async ({ page }, info) => {
  test.setTimeout(120000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  const cafe = await alCafe(page);
  await shot(page, info, '1-cafe');

  // Se pierde y vuelve: ni aviso ni respaldo, y vuelve a dibujar
  const antes = await page.evaluate(() => window.__cafe3d.renders());
  await perder(page, true);
  await page.waitForTimeout(3800);
  await expect(cafe.locator('.ed-sin3d')).toHaveCount(0);
  await expect(cafe.locator('.cf3-stage canvas')).toHaveCount(1);
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await expect.poll(() => page.evaluate(() => window.__cafe3d.renders())).toBeGreaterThan(antes);
  await shot(page, info, '2-vuelve');

  // Se pierde y no vuelve: a los ~3 s, el aviso «Sin 3D en este móvil»
  await perder(page, false);
  await page.waitForTimeout(1000);
  await expect(cafe.locator('.ed-sin3d')).toHaveCount(0);
  await expect(cafe.locator('.ed-sin3d')).toBeVisible({ timeout: 6000 });
  await shot(page, info, '3-no-vuelve');
  expect(errores).toEqual([]);
});

test('Comunidad desde el ordenador: la pantalla de carga de la comunidad, nunca «Abriendo tu piso…»', async ({ page }, info) => {
  test.setTimeout(120000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  // La comunidad tarda en llegar (como con poca cobertura)
  await page.route('**/SocialHub.jsx*', async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  const mock = semilla();
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible({ timeout: 12000 });
  await page.getByRole('button', { name: 'Comunidad', exact: true }).click();
  const carga = page.locator('.pantalla-carga');
  await expect(carga).toHaveText('Abriendo la comunidad…', { timeout: 2000 });
  await expect(page.getByText('Abriendo tu piso…')).toHaveCount(0);
  await shot(page, info, '4-abriendo-comunidad');
  await expect(page.getByRole('tab', { name: 'Lectores' })).toBeVisible({ timeout: 20000 });
  await expect(carga).toHaveCount(0);
  await expect(page.getByText('Abriendo tu piso…')).toHaveCount(0);
  await page.waitForTimeout(600);
  await shot(page, info, '5-comunidad');
  expect(errores).toEqual([]);
});
