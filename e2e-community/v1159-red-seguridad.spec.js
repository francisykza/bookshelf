// 1.159 · El ordenador en negro en un iPhone (docs/qa/ordenador-negro.md). Se reproduce como una app que lleva días abierta tras
// publicar otra versión: el trozo de código del escritorio ya no existe (404). Antes, la app se desmontaba y quedaba el fondo
// marrón; ahora recarga una vez y, si tampoco llega, enseña la escena de Libotown con un aviso. Supabase simulado.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { ANA, SALA } from './v190-apoyo';

const DIR = join('qa-report', 'v1159-red-seguridad');
const TROZO = /PisoDesktop\.jsx/;

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

test.beforeEach(({}, info) => {
  test.skip(!['chromium-390x844', 'webkit-390x844'].includes(info.project.name), 'solo 390 en Chromium y WebKit');
  mkdirSync(join(DIR, info.project.name), { recursive: true });
});

/** El piso de Ana; `fallos`: cuántas veces el trozo del escritorio responde 404 (Infinity: siempre). */
async function casa(page, fallos) {
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout: SALA });
  mock.db.piso_cuentas[ANA.id] = { inicio_elegido: true, tickets: 120, sin_raro: 0 };
  mock.db.piso_inventario = { [ANA.id]: { sillon: 1, 'mesa-baja': 1, estanteria: 1, escritorio: 1, ventana: 1, 'lampara-pie': 1 } };
  await mock.attach(page, ANA);
  const cuenta = { pedidos: 0 };
  await page.route(TROZO, (r) => {
    cuenta.pedidos += 1;
    if (cuenta.pedidos <= fallos) return r.fulfill({ status: 404, contentType: 'text/plain', body: 'The page could not be found' });
    return r.fallback();
  });
  await page.goto('/');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(800);
  return cuenta;
}

async function abrirOrdenador(page) {
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
}

test('con el trozo perdido una vez, recarga sola y el ordenador se abre', async ({ page }, info) => {
  test.setTimeout(120000);
  const cuenta = await casa(page, 1);
  let recargas = 0;
  page.on('load', () => (recargas += 1));
  await abrirOrdenador(page);
  // Recarga una vez y vuelve donde estaba (el historial guarda el ordenador abierto)
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible({ timeout: 30000 });
  expect(recargas).toBe(1);
  expect(cuenta.pedidos).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.red-seguridad')).toHaveCount(0);
  // El piso termina de cargar debajo (su «Abriendo tu piso…» queda detrás del ordenador, como al recargar sin fallos)
  await expect(page.locator('.plab-stage[data-ready]')).toBeAttached({ timeout: 30000 });
  await page.waitForTimeout(2500);
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible();
  await page.screenshot({ path: join(DIR, info.project.name, '1-recargado.png') });
});

test('si el trozo no llega nunca, el aviso de Libotown en vez de la pantalla negra', async ({ page }, info) => {
  test.setTimeout(120000);
  await casa(page, Infinity);
  await abrirOrdenador(page);
  const aviso = page.locator('.red-seguridad[role="alert"]');
  await expect(aviso).toBeVisible({ timeout: 30000 });
  await expect(aviso).toContainText('Algo no se ha abierto bien.');
  await expect(aviso).toContainText('Puede que haya una versión nueva de Libotown');
  // Toques de 44 px como poco y nada que desborde a 390
  for (const nombre of ['Recargar', 'Ir al inicio']) {
    const caja = await aviso.getByRole('button', { name: nombre }).boundingBox();
    expect(caja.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // El aviso, debajo de las letras del logo (no tapa a Libo)
  const caja = await aviso.locator('.red-seguridad__caja').boundingBox();
  const vh = page.viewportSize().height;
  expect(caja.y).toBeGreaterThan(vh / 2 + 390 * 0.8 * 0.2);
  await page.screenshot({ path: join(DIR, info.project.name, '2-aviso.png') });
  await aviso.getByText('Detalles del fallo').click();
  await expect(aviso.locator('code')).not.toBeEmpty();
  await page.screenshot({ path: join(DIR, info.project.name, '3-detalles.png') });
  // «Ir al inicio» vuelve a tu piso
  await aviso.getByRole('button', { name: 'Ir al inicio' }).click();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.red-seguridad')).toHaveCount(0);
  await page.screenshot({ path: join(DIR, info.project.name, '4-inicio.png') });
});
