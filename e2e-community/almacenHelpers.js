// Ayudantes del Almacén del Puerto para las pruebas con Supabase simulado (de v199-almacen.spec.js, 1.101): capturas, la base
// simulada con dos lectoras y el camino del Salón al almacén. Aparte, para que otro archivo los use sin repetir las pruebas de la 1.99.
import { expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

export const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
export const BEA = { id: '22222222-2222-4222-8222-222222222222', email: 'bea@ejemplo.test' };

export async function shot(page, info, name) {
  const dir = join('qa-report', 'almacen');
  mkdirSync(dir, { recursive: true });
  await page.mouse.move(0, 0);
  await page.screenshot({ path: join(dir, `${info.project.name}-${name}.png`) });
}

export function mockAlmacen({ tickets = 100, ofertas = [] } = {}) {
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.almacen = { ofertas };
  mock.db.lonja = { tickets: 0, sellos: 0, cambios: { hechos: 0, tope: 3 }, cobro: { hecho: 0, tope: 100 }, topeOfertas: 3, horquilla: { comun: [5, 20], 'poco-comun': [10, 40], raro: [20, 60] }, libres: {}, toldos: [], mias: [], cerradas: [], puestos: [] };
  for (const [u, alias] of [
    [ANA, 'Ana lectora'],
    [BEA, 'Bea'],
  ]) {
    mock.db.profiles.push({ user_id: u.id, alias, avatar_id: 'gato-lector', community_enabled: true });
    mock.db.piso_cuentas[u.id] = { inicio_elegido: true, tickets, sin_raro: 0 };
  }
  mock.db.piso_inventario = { [ANA.id]: { sillon: 1 }, [BEA.id]: {} };
  return mock;
}

/** Del Salón al almacén: tablet, edificio, limusina y el Directorio del hotel. */
export async function alAlmacen(page, mock, user = ANA, { reduced = true } = {}) {
  await mock.attach(page, user);
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
  await hotel.getByRole('dialog', { name: 'Directorio' }).getByRole('button', { name: /almacén/i }).click();
  const alm = hotel.locator('section.alm');
  await expect(alm).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
  await page.waitForFunction(() => window.__almacen3d?.renders() > 0);
  return { hotel, alm };
}
