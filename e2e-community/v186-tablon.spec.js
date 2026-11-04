// 1.86 · El tablón de la Lonja, con Supabase simulado: «Se busca» sin texto libre, ofrecer lo que buscan, marcar lo que falta, recoger
// la placa de un taller y el aviso en los puestos. Las reglas de verdad, en src/features/edificio/__tests__/talleres.rls.test.js.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { TALLERES } from '../src/features/edificio/talleres';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

async function entrar(page) {
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.lonja = {
    tickets: 40,
    sellos: 12,
    cambios: { hechos: 0, tope: 3 },
    cobro: { hecho: 0, tope: 100 },
    topeOfertas: 3,
    horquilla: { comun: [5, 20], 'poco-comun': [10, 40], raro: [20, 60] },
    libres: { sofa: 2, silla: 1 },
    libresAcabado: [],
    toldos: [],
    mias: [],
    cerradas: [],
    puestos: [
      { id: 'o1', dueno: 'u-bea', alias: 'Bea lectora', personaje: { piel: 2, pelo: 'rizos', colorPelo: 2, jersey: 3, pantalon: 1 }, da: 'telescopio', busca_mueble: null, busca_tickets: 30 },
      { id: 'o2', dueno: 'u-bea', alias: 'Bea lectora', personaje: { piel: 2, pelo: 'rizos', colorPelo: 2, jersey: 3, pantalon: 1 }, da: 'mapa', busca_mueble: null, busca_tickets: 15 },
    ],
    buscas: ['mapa'],
    tablon: [
      { mueble: 'sofa', cuantos: 4, quienes: ['Bea lectora', 'Carla', 'Dani'], tienes: true },
      { mueble: 'gato', cuantos: 1, quienes: ['Carla'], tienes: false },
      { mueble: 'silla', cuantos: 2, quienes: ['Dani', 'Bea lectora'], tienes: true },
    ],
    talleres: TALLERES.map((t) => {
      if (t.id === 'faro') return { id: t.id, recogido: false, faltan: [] };
      if (t.id === 'vivero') return { id: t.id, recogido: true, faltan: [] };
      return { id: t.id, recogido: false, faltan: t.muebles.filter((_, k) => k % 2 === 1) };
    }),
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
  await hotel
    .getByRole('dialog', { name: 'Directorio' })
    .getByRole('button', { name: /La Lonja/ })
    .click();
  const lonja = hotel.getByRole('region', { name: 'La Lonja' });
  await expect(lonja.getByRole('button', { name: /^El tablón/ })).toBeVisible();
  return { mock, lonja };
}

test('los puestos dicen qué te interesa', async ({ page }, info) => {
  const { lonja } = await entrar(page);
  await expect(lonja.locator('.gh-lonja__interes').filter({ hasText: 'Lo buscas' })).toHaveCount(1);
  await lonja.locator('.gh-lonja__list').scrollIntoViewIfNeeded();
  await expect(lonja.locator('.gh-lonja__interes').filter({ hasText: /Te falta/ })).toHaveCount(1);
  await shot(page, info, 'v186-tablon-puestos');
});

test('se ve lo que se busca, y ofrecer lleva a tu puesto con el mueble elegido', async ({ page }, info) => {
  const { lonja } = await entrar(page);
  await lonja.getByRole('button', { name: /^El tablón/ }).click();
  const corcho = lonja.locator('.lj-corcho');
  await expect(corcho.locator('li')).toHaveCount(3);
  await expect(corcho.locator('li').first()).toContainText('Bea lectora, Carla, Dani y 1 más');
  await expect(corcho.getByText('No tienes copia libre')).toBeVisible();
  await corcho.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await shot(page, info, 'v186-tablon-corcho');
  await corcho.getByRole('button', { name: 'Ofrecer Sofá en tu puesto' }).click();
  await expect(lonja.getByRole('button', { name: /^Tu puesto/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(lonja.locator('.lj-albaran').first()).toBeVisible();
  await expect(lonja.getByRole('button', { name: /Sofá/ }).first()).toHaveAttribute('aria-pressed', 'true');
});

test('tocar lo que falta lo marca, y se quita', async ({ page }) => {
  const { lonja, mock } = await entrar(page);
  await lonja.getByRole('button', { name: /^El tablón/ }).click();
  const hueco = lonja.getByRole('button', { name: /Mesa: te falta/ });
  await hueco.click();
  await expect(hueco).toHaveAttribute('aria-pressed', 'true');
  expect(mock.db.lonja.buscas).toContain('mesa');
  await expect(lonja.locator('.lj-buscas li')).toHaveCount(2);
  await lonja.getByRole('button', { name: 'Quitar Mesa del tablón' }).click();
  await expect(lonja.locator('.lj-buscas li')).toHaveCount(1);
});

test('un taller completo da su placa y sus sellos, y sale el aviso', async ({ page }, info) => {
  const { lonja, mock } = await entrar(page);
  await expect(lonja.locator('.lj-toldo').getByRole('img', { name: 'Tienes una placa por recoger' })).toBeVisible();
  await lonja.getByRole('button', { name: /^El tablón/ }).click();
  const faro = lonja.locator('.lj-taller').filter({ hasText: 'Lámparas del Faro' });
  await expect(lonja.locator('.lj-taller')).toHaveCount(6);
  await faro.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await shot(page, info, 'v186-tablon-talleres');
  await faro.getByRole('button', { name: 'Recoger la placa y 30 sellos' }).click();
  await expect(lonja.locator('.lj-aviso')).toContainText('Placa recogida');
  await expect(faro.locator('.lj-taller__placa')).toBeVisible();
  expect(mock.db.lonja.sellos).toBe(42);
  await expect(lonja.locator('.lj-taller').filter({ hasText: 'Vivero del Muelle' }).locator('.lj-taller__placa')).toBeVisible();
});

test('el toldo con cuatro faldones cabe sin desbordarse', async ({ page }) => {
  const { lonja } = await entrar(page);
  const anchos = await lonja.locator('.lj-toldo button').evaluateAll((b) => b.map((x) => x.scrollWidth - x.clientWidth));
  expect(Math.max(...anchos)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
