// 1.78 · Más impacto en los sobres (encargo de Francisco del 3-11-2026), con Supabase simulado: el sobre cerrado lleva
// un brillo que lo cruza; cada carta, el color de su rareza; lo raro, al darse la vuelta, tiñe la escena y suelta confeti
// (solo lo raro o mejor: el color dice la verdad); al final, cuántos hay de cada rareza. Con movimiento reducido, los
// colores y el recuento sí, los efectos no.
import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { dirOf, openShop } from './sobreShop';
import { SOBRES_CERRADOS } from '../src/features/edificio/economy.js';

const FIVE = ['sofa', 'gato', 'radio', 'lampara-pie', 'planta-pequena'];

test('cinco con un raro: brillo, color por rareza, destello y confeti solo en el raro, y el recuento', async ({ page }, info) => {
  test.skip(SOBRES_CERRADOS, 'Sobres cerrados por reforma (9-11-2026): vuelve al reabrirlos');
  test.skip(!/chromium-(360x800|390x844)$/.test(info.project.name), '360 y 390 en Chromium');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const { mock, shop } = await openShop(page);
  mock.db.piso_sorteo = [...FIVE];
  await shop.getByRole('button', { name: /^Abrir 5 · 45/ }).click();
  const gacha = page.locator('.gacha');
  await expect(gacha).toHaveClass(/is-sealed/);
  await expect(gacha.locator('.gacha__shine')).toHaveCount(1);
  await page.waitForTimeout(2100);
  await page.screenshot({ path: join(dirOf(info), 'v178-sobre-brillo.png') });
  await gacha.getByRole('button', { name: /^Rasgar el sobre/ }).click();
  await expect(gacha).toHaveClass(/is-peek/, { timeout: 5000 });
  // Al revelar todas: el destello sale una vez, por el gato (raro); confeti solo en su carta
  await gacha.getByRole('button', { name: 'Revelar todas' }).click();
  await expect(gacha.locator('.gacha__flash.is-raro')).toHaveCount(1, { timeout: 4000 });
  await expect(gacha.locator('.gacha__card.is-raro .gacha__confetti')).toHaveCount(1);
  await expect(gacha.locator('.gacha__confetti')).toHaveCount(1);
  await page.waitForTimeout(420);
  await page.screenshot({ path: join(dirOf(info), 'v178-sobre-destello.png') });
  await expect(gacha).toHaveClass(/is-done/, { timeout: 6000 });
  // Rayos desde poco común; la común, sin ellos
  await expect(gacha.locator('.gacha__card.is-comun .gacha__rays')).toHaveCount(0);
  await expect(gacha.locator('.gacha__card.is-poco-comun .gacha__rays')).toHaveCount(2);
  // El recuento, de la mejor a la peor
  await expect(gacha.locator('.gacha__pips li')).toHaveText(['1 raro', '2 poco comunes', '2 comunes']);
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(dirOf(info), 'v178-sobre-final.png') });
  expect(errors).toEqual([]);
});

test('con movimiento reducido: colores y recuento, sin brillo, destello ni confeti', async ({ page }, info) => {
  test.skip(SOBRES_CERRADOS, 'Sobres cerrados por reforma (9-11-2026): vuelve al reabrirlos');
  test.skip(!/chromium-390x844$/.test(info.project.name), '390 en Chromium');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { mock, shop } = await openShop(page);
  mock.db.piso_sorteo = [...FIVE];
  await shop.getByRole('button', { name: /^Abrir 5 · 45/ }).click();
  const gacha = page.locator('.gacha');
  await expect(gacha).toHaveClass(/is-done/);
  await expect(gacha.locator('.gacha__flash, .gacha__confetti, .gacha__shine')).toHaveCount(0);
  await expect(gacha.locator('.gacha__pips li')).toHaveText(['1 raro', '2 poco comunes', '2 comunes']);
  const ribbon = await gacha.locator('.gacha__card.is-raro small').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(ribbon).toBe('rgb(138, 90, 16)');
});
