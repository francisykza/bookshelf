// 1.84 · La Lonja del Gran Hotel, con Supabase simulado: se llega desde el Directorio, pones una oferta, la retiras, cambias
// con un puesto. El servidor de verdad se prueba en lonja.rls.test.js; aquí, lo que se ve.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOG } from '../src/features/edificio/catalog';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const libres = CATALOG.filter((c) => !c.set && c.precio !== null).slice(0, 3);
const [M1, M2, M3] = libres.map((c) => c.id);
const BEA = { piel: 2, pelo: 'rizos', colorPelo: 2, jersey: 3, pantalon: 1 };

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

async function toLonja(page, extra = []) {
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.lonja = {
    tickets: 40,
    sellos: 12,
    cambios: { hechos: 0, tope: 3 },
    cobro: { hecho: 13, tope: 100 },
    topeOfertas: 3,
    horquilla: { comun: [5, 20], 'poco-comun': [10, 40], raro: [20, 60] },
    libres: { [M1]: 2, [M2]: 1 },
    toldos: [],
    mias: [],
    cerradas: [],
    puestos: [
      { id: 'o1', dueno: 'u-bea', alias: 'Bea lectora', personaje: BEA, da: M3, busca_mueble: null, busca_tickets: 15 },
      { id: 'o4', dueno: 'u-bea', alias: 'Bea lectora', personaje: BEA, da: M2, busca_mueble: null, busca_tickets: 20 },
      { id: 'o2', dueno: 'u-carla', alias: 'Carla', personaje: { piel: 0, pelo: 'largo', colorPelo: 4, jersey: 5, pantalon: 2 }, da: M3, busca_mueble: null, busca_tickets: 60 },
      { id: 'o3', dueno: 'u-dani', alias: 'Dani', personaje: { piel: 3, pelo: 'corto', colorPelo: 0, jersey: 1, pantalon: 3 }, da: M2, busca_mueble: M3, busca_tickets: null },
      ...extra,
    ],
  };
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
  await hotel.getByRole('button', { name: 'Directorio' }).click();
  await hotel.getByRole('dialog', { name: 'Directorio' }).getByRole('button', { name: /almacén/i }).click();
  // 1.99: la Lonja de antes es el mercadillo del almacén (acceso secundario)
  await hotel.locator('section.alm .alm-bar').getByRole('button', { name: 'Mercadillo' }).click();
  return { lonja: hotel.getByRole('region', { name: 'La Lonja' }), mock };
}

test('pones una oferta por tickets y la retiras', async ({ page }, info) => {
  test.skip(!/chromium-(320x640|390x844|1440x900)$|webkit-390x844/.test(info.project.name), '320, 390 (Chromium y WebKit) y escritorio');
  const { lonja, mock } = await toLonja(page);
  await expect(lonja.getByRole('button', { name: 'Tu puesto', exact: true })).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, info, 'v184-lonja');
  await lonja.getByRole('button', { name: 'Tu puesto', exact: true }).click();
  await lonja.getByRole('button', { name: 'Ofrecer un mueble' }).first().click();
  await lonja.getByRole('button', { name: 'Más tickets' }).click();
  await expect(lonja.getByText(/Recibirás 9: el 10 %/)).toBeVisible();
  await lonja.getByRole('button', { name: 'Más tickets' }).scrollIntoViewIfNeeded();
  await shot(page, info, 'v184-lonja-oferta');
  await lonja.getByRole('button', { name: 'Poner en el puesto' }).click();
  await expect(lonja.getByText('Ya está en tu puesto.')).toBeVisible();
  expect(mock.db.lonja.mias[0].busca_tickets).toBeGreaterThan(0);
  await lonja.getByRole('button', { name: /^Retirar/ }).click();
  await expect(lonja.getByText('vuelve a tu inventario.')).toBeVisible();
  await expect(lonja.getByRole('button', { name: /^Retirar/ })).toHaveCount(0);
});

test('cambiar pide confirmación, y lo que no puedes pagar se dice', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'una vez basta');
  const { lonja, mock } = await toLonja(page);
  const ofertas = lonja.getByRole('list', { name: 'Ofertas' });
  await expect(ofertas.getByText('Te faltan tickets')).toBeVisible();
  await expect(ofertas.getByText('No lo tienes libre')).toBeVisible();
  await lonja.getByRole('button', { name: 'Lo que puedo pagar' }).click();
  await expect(ofertas.getByRole('listitem')).toHaveCount(2);
  await lonja.getByRole('button', { name: 'Puesto de Bea lectora' }).click();
  await ofertas.getByRole('button', { name: /^Cambiar/ }).first().click();
  await expect(ofertas.getByText(/No se puede deshacer/)).toBeVisible();
  await shot(page, info, 'v184-lonja-puesto');
  await ofertas.getByRole('button', { name: 'No', exact: true }).click();
  expect(mock.db.lonja.tickets).toBe(40);
  await ofertas.getByRole('button', { name: /^Cambiar/ }).first().click();
  await ofertas.getByRole('button', { name: 'Confirmar' }).click();
  await expect(lonja.getByText(/Trato hecho/)).toBeVisible();
  await expect(ofertas.getByRole('listitem')).toHaveCount(1);
  expect(mock.db.lonja.tickets).toBe(25);
});

test('una oferta de «cualquiera de esa rareza» deja elegir con qué pagas', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'una vez basta');
  const { lonja } = await toLonja(page, [{ id: 'o5', dueno: 'u-eva', alias: 'Eva', personaje: BEA, da: M3, busca_mueble: null, busca_tickets: null, busca_rareza: 'comun' }]);
  const ofertas = lonja.getByRole('list', { name: 'Ofertas' });
  await expect(ofertas.getByText(/cualquier mueble común/)).toBeVisible();
  await ofertas.getByRole('button', { name: /de Eva$/ }).click();
  await expect(ofertas.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
  await expect(ofertas.getByRole('button', { name: 'Confirmar' })).toBeInViewport();
  await ofertas.locator('.gh-lonja__pick').first().click();
  const peticion = page.waitForRequest(/piso_lonja_aceptar/);
  await ofertas.getByRole('button', { name: 'Confirmar' }).click();
  expect((await peticion).postDataJSON()).toMatchObject({ cual: 'o5', pago: M1 });
  await expect(lonja.getByText(/Trato hecho/)).toBeVisible();
});
