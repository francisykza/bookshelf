// Reestructuración de muebles (9-11-2026), con Supabase simulado: la tienda del bajo con los sobres cerrados por reforma
// (ni botones de abrir ni probabilidades; muebles y reciclaje siguen) y la caja y la lata del casino con lo retirado
// marcado «En reforma». Capturas y vídeo en qa-report/reforma-muebles/<ETAPA>/ (ETAPA=antes|despues; por defecto,
// despues). En «antes» (la 1.96) solo se hacen las capturas.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { ANA, openShop } from './sobreShop';

const ETAPA = process.env.ETAPA ?? 'despues';
const DIR = join('qa-report', 'reforma-muebles', ETAPA);
const DESPUES = ETAPA === 'despues';

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

test('la tienda: sobres cerrados por reforma; muebles y reciclaje, abiertos', async ({ page }, info) => {
  test.skip(true, 'Desde la 1.119 la tienda del bajo es el café-librería: sin sobres, muebles ni reciclaje a la vista (lo comprueba v1119-cafe)');
  test.skip(info.project.name !== 'chromium-390x844', 'Chromium a 390');
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  const { shop } = await openShop(page);
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(DIR, '4-tienda-sobres.png'), fullPage: true });
  if (DESPUES) {
    await expect(shop.locator('.ts-card--cerrado h3')).toHaveText('Cerrado por reforma');
    await expect(shop.getByRole('button', { name: /^Abrir/ })).toHaveCount(0);
    await expect(shop.locator('.ts-odds')).toHaveCount(0);
    await expect(shop.locator('.ts-note')).toContainText('cerrados por reforma');
  }
  await shop.getByRole('tab', { name: 'Muebles' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(DIR, '4-tienda-muebles.png'), fullPage: true });
  // Los 14 de la casa y, desde la 1.101, los 6 de la colección Capa y Antifaz
  if (DESPUES) await expect(shop.locator('.ts-grid .ts-item')).toHaveCount(20);
});

test('la caja y la lata del casino: lo retirado, «En reforma»', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'Chromium a 390');
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.casino = { fichas: 900, semana: 40, garbanzos: 700, caja: ['complemento:visera'] };
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
  await hotel.getByRole('button', { name: /Casino del sótano/ }).click();
  const casino = hotel.getByRole('region', { name: 'El casino del sótano' });
  await casino.getByRole('button', { name: 'La caja' }).click();
  const lista = casino.getByRole('list', { name: 'Lo que hay en la caja' });
  await expect.poll(() => casino.locator('.gh-caja__grid img').evaluateAll((im) => im.every((i) => i.complete && i.naturalWidth > 0))).toBe(true);
  const item = (texto) => lista.getByRole('listitem').filter({ hasText: texto });
  await item('Sobre del casino').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(DIR, '5-caja-sobre.png') });
  await item('Gramola').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(DIR, '5-caja-muebles.png') });
  if (DESPUES) {
    for (const t of ['Sobre del casino', 'Mesa de tapete verde', 'Gramola']) {
      await expect(item(t)).toContainText('En reforma');
      await expect(item(t).getByRole('button')).toHaveCount(0);
    }
    // Lo que no está retirado se sigue cambiando
    await expect(item('Rótulo de neón')).toContainText('Cambiar');
    await expect(item('Fedora')).toContainText('Cambiar');
  }
  const lata = casino.locator('details.gh-lata');
  await lata.locator('summary').click();
  await lata.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(DIR, '6-lata.png') });
  if (DESPUES) await expect(lata.getByRole('list', { name: 'Premios de la lata' }).getByText('En reforma')).toHaveCount(3);
});
