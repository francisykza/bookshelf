// Místicos, bloque 3 (docs/qa/misticos.md), con Supabase simulado: en el sobre «Edición coleccionista» las
// probabilidades enseñan el místico (0,75 %) y el legendario (0,25 %); al salir uno, el sobre brilla de su color (solo
// porque lo trae de verdad), su carta enseña al ser moviéndose y el papel dice dónde ponerlo. El sorteo real y sus cifras
// se prueban en src/features/edificio/__tests__/misticos.rls.test.js.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

async function toShop(page) {
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 300, sin_raro: 3 } },
    piso_inventario: { [ANA.id]: { sillon: 1, silla: 2, 'mesa-baja': 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await expect(portal.locator('.ed-facade')).not.toHaveClass(/is-arriving/, { timeout: 5000 });
  await portal.getByRole('button', { name: 'Entrar en la tienda del bajo' }).click();
  const shop = page.getByRole('dialog', { name: 'La tienda del bajo' });
  await shop.getByRole('group', { name: /Sobres de la temporada 1/ }).getByRole('button', { name: /^Edición coleccionista/ }).click();
  return { mock, shop };
}

test('un legendario en el sobre de coleccionista: sus probabilidades, su carta y dónde ponerlo', async ({ page }, info) => {
  test.skip(!/390x844|1440x900/.test(info.project.name), '390 (Chromium y WebKit) y escritorio');
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const { mock, shop } = await toShop(page);

  // Las probabilidades, a la vista y sin redondear hacia arriba
  await shop.getByText('Probabilidades y garantías').click();
  await expect(shop.getByRole('heading', { name: /^Raro · 14 %/ })).toBeVisible();
  await expect(shop.getByRole('heading', { name: /^Místico · 0,75 %/ })).toBeVisible();
  await expect(shop.getByRole('heading', { name: /^Místico legendario · 0,25 %/ })).toBeVisible();
  await expect(shop.locator('.ts-odds__row.is-legendario li', { hasText: 'Dragoncillo de escamas rojas' })).toContainText('0,08 %');
  await expect(shop.getByText(/Los místicos solo salen en este sobre, sin garantía ni pity propio/)).toBeVisible();
  await shop.locator('.ts-odds__row.is-legendario').scrollIntoViewIfNeeded();
  await shot(page, info, 'v173-sobre-probabilidades');
  await shop.getByText('Probabilidades y garantías').click();

  // Uno solo, y es el dragoncillo: el sobre brilla rosa (lo trae de verdad), se rasga y la carta lo enseña vivo
  mock.db.piso_sorteo = ['dragoncillo'];
  await shop.getByRole('button', { name: /^Abrir 1 · 25/ }).click();
  const gacha = page.locator('.gacha');
  await expect(gacha).toHaveClass(/gacha--legendario/);
  await page.waitForTimeout(600);
  await shot(page, info, 'v173-sobre-cerrado');
  await gacha.getByRole('button', { name: 'Rasgar el sobre «Edición coleccionista»' }).click();
  const card = gacha.getByRole('button', { name: 'Dragoncillo de escamas rojas, místico legendario, nuevo' });
  await expect(card).toBeVisible({ timeout: 5000 });
  await expect(card.locator('canvas.gacha__mistico')).toBeVisible();
  // Se mueve: dos fotos del lienzo, distintas
  const frame = () => card.locator('canvas.gacha__mistico').evaluate((c) => c.toDataURL());
  const a = await frame();
  await page.waitForTimeout(400);
  expect(await frame()).not.toBe(a);
  await expect(gacha.locator('.gacha__mnote')).toHaveText('Dragoncillo de escamas rojas puede acompañarte: elígelo en el armario de tu personaje.', { timeout: 5000 });
  await page.waitForTimeout(700);
  await shot(page, info, 'v173-sobre-legendario');
  expect(mock.db.piso_inventario[ANA.id].dragoncillo).toBe(1);
  expect(mock.db.piso_cuentas[ANA.id].sin_raro).toBe(0);
  await gacha.getByRole('button', { name: 'Volver a la tienda' }).click();

  // Cinco, con un místico entre ellos
  mock.db.piso_sorteo = ['silla', 'farol-azul', 'tetera', 'libros', 'radio'];
  await shop.getByRole('button', { name: /^Abrir 5 · 110/ }).click();
  await expect(gacha).toHaveClass(/gacha--mistico/);
  await gacha.getByRole('button', { name: /^Rasgar el sobre/ }).click();
  await expect(gacha.getByRole('button', { name: /^Dar la vuelta a la carta/ })).toHaveCount(5, { timeout: 5000 });
  await gacha.getByRole('button', { name: 'Mostrar todos' }).click();
  await expect(gacha.getByRole('button', { name: 'Farol de llama azul, místico, nuevo' })).toBeVisible();
  await expect(gacha.locator('.gacha__mnote')).toHaveText('Farol de llama azul se coloca en tu piso sobre su peana, en la pestaña «Místicos».', { timeout: 5000 });
  await page.waitForTimeout(700);
  await shot(page, info, 'v173-sobre-cinco');
  expect(errors).toEqual([]);
});

test('con movimiento reducido, el místico sale quieto y directo', async ({ page }, info) => {
  test.skip(!/chromium-390x844/.test(info.project.name), 'Chromium 390');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { mock, shop } = await toShop(page);
  mock.db.piso_sorteo = ['zorro-bruma'];
  await shop.getByRole('button', { name: /^Abrir 1 · 25/ }).click();
  const gacha = page.locator('.gacha');
  await expect(gacha).toHaveClass(/is-done/);
  const card = gacha.getByRole('button', { name: 'Zorro de bruma y ceniza, místico legendario, nuevo' });
  await expect(card).toBeVisible();
  const frame = () => card.locator('canvas.gacha__mistico').evaluate((c) => c.toDataURL());
  const a = await frame();
  await page.waitForTimeout(500);
  expect(await frame()).toBe(a);
});
