// «Exteriores en 3D», bloque 1 (11-11-2026): el edificio del puerto desde el muelle (src/features/edificio/calle3d.js),
// comparado con el portal 2D de la app. Capturas y vídeo en qa-report/calle3d/: 1-antes-portal-2d.png (la app, con
// Supabase simulado) y 2-despues-*.png (la página de desarrollo dev/calle3d.html, con tres pisos ocupados).
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';

const DIR = join('qa-report', 'calle3d');

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

// ETAPA=antes (con la fachada 2D, la 1.112) solo hace la captura del portal; por defecto, la calle 3D con sus toques
const ETAPA = process.env.ETAPA ?? 'despues';

test('el portal de la app', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'Chromium a 390');
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 40 } } });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  const openPortal = async () => {
    await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
    await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  };
  await openPortal();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  const limo = portal.getByRole('button', { name: 'Coger la limusina al Gran Hotel' });
  await expect(limo).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: join(DIR, `1-${ETAPA}-portal.png`) });
  if (ETAPA === 'antes') return;

  await expect(portal.locator('canvas.calle-canvas')).toBeVisible();
  // Arrastrar encima de tu piso gira la vista y no entra
  const mine = portal.getByRole('button', { name: /^Entrar en tu piso/ });
  const r = await mine.boundingBox();
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  for (let k = 1; k <= 10; k += 1) await page.mouse.move(r.x + r.width / 2 - k * 12, r.y + r.height / 2);
  await page.mouse.up();
  await page.waitForTimeout(500);
  await expect(page.getByRole('dialog', { name: 'El edificio del puerto' })).toBeVisible();
  await page.screenshot({ path: join(DIR, '1-despues-portal-girado.png') });
  // Un toque sí entra: la vista se acerca a la ventana y abre el piso; «Volver al portal» se aleja desde ella
  await mine.click();
  await expect(page.getByRole('dialog', { name: 'Tu piso' })).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(DIR, '1-despues-dentro.png') });
  await page.getByRole('button', { name: 'Volver al portal' }).click();
  await expect(limo).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(DIR, '1-despues-volviendo.png') });
  await page.waitForTimeout(900);
  // El buzón con su nota
  await portal.getByRole('button', { name: /^Tu buzón/ }).click();
  await expect(portal.getByRole('region', { name: 'Tu buzón' })).toBeVisible();
  await page.screenshot({ path: join(DIR, '1-despues-buzon.png') });
  await portal.getByRole('button', { name: /^Tu buzón/ }).click();
  // La limusina lleva al Gran Hotel. Seguías mirando a la izquierda (como al entrar): al llegar a ella con el teclado,
  // la vista gira hasta ella
  await expect(limo).toHaveClass(/is-off/);
  await limo.focus();
  await expect(limo).not.toHaveClass(/is-off/);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(DIR, '1-despues-limusina.png') });
  await limo.click();
  await expect(page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' })).toBeVisible({ timeout: 15000 });
  // Los fallos de red del Supabase simulado (tiempo real, 404 de lo que no simula) no cuentan
  expect(errors.filter((e) => !/WebSocket|Failed to load resource/.test(e))).toEqual([]);
});

test('después: la calle en 3D desde el muelle', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'Chromium a 390');
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/dev/calle3d.html');
  await page.waitForFunction(() => window.__calle3d?.renders() > 0);
  const stats = await page.evaluate(() => ({
    ...window.__calle3d.stats(),
    ms: window.__calle3dMs,
  }));
  console.log('calle3d', JSON.stringify(stats));
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(DIR, '2-despues-frente.png') });
  // Girar con el dedo: a la izquierda (la librería y el vecino) y a la derecha (la limusina y la tienda)
  const box = await page.locator('canvas.calle-canvas').boundingBox();
  const drag = async (dx, dy = 0) => {
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let k = 1; k <= 12; k += 1) {
      await page.mouse.move(x + (dx * k) / 12, y + (dy * k) / 12);
      await page.waitForTimeout(40);
    }
    await page.mouse.up();
    await page.waitForTimeout(300);
  };
  await drag(-130);
  expect(await page.evaluate(() => window.__calle3d.yaw())).toBeLessThan(-0.45);
  await page.screenshot({ path: join(DIR, '2-despues-izquierda.png') });
  await drag(250);
  expect(await page.evaluate(() => window.__calle3d.yaw())).toBeGreaterThan(0.45);
  await page.screenshot({ path: join(DIR, '2-despues-derecha.png') });
  // Bajar la vista hacia el muelle y volver
  await drag(-125, -60);
  expect(await page.evaluate(() => window.__calle3d.pitch() < window.__calle3d.pitchHome())).toBe(true);
  await page.screenshot({ path: join(DIR, '2-despues-abajo.png') });
  await drag(0, 80);
  expect(await page.evaluate(() => Math.abs(window.__calle3d.pitch() - window.__calle3d.pitchHome()))).toBeLessThan(1e-6);
  expect(errors).toEqual([]);
});
