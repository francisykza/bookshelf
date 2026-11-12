// 1.67 (SPEC §67) · La tienda del bajo y sus sobres, con Supabase simulado (el sorteo del simulador es fijo: la prueba
// pone los premios en `db.piso_sorteo`). Se entra por el escaparate, se abren un sobre y un paquete de cinco (con la
// animación entera y con movimiento reducido), se compra con confirmación, se recicla lo que no está colocado y las
// misiones del ordenador se cobran en tickets. Las figuras no aparecen. La autorización real está en
// src/features/edificio/__tests__/tienda.rls.test.js.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { SOBRES_CERRADOS } from '../src/features/edificio/economy.js';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

function mockWith(account) {
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, ...account } },
    piso_inventario: { [ANA.id]: { sillon: 1, silla: 2, 'mesa-baja': 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  return mock;
}

async function openPortal(page, mock) {
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
  return portal;
}

const wallet = (shop) => shop.locator('.ts-wallet strong');

test('la tienda del bajo: sobre, paquete de cinco, comprar y reciclar', async ({ page }, info) => {
  test.skip(SOBRES_CERRADOS, 'Sobres cerrados por reforma (9-11-2026): vuelve al reabrirlos');
  test.skip(!/320x640|390x844|1440x900/.test(info.project.name), '320, 390 (Chromium y WebKit) y escritorio');
  test.setTimeout(120000);
  const mock = mockWith({ tickets: 75, sin_raro: 3 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const portal = await openPortal(page, mock);

  // El escaparate de la planta baja es la puerta de la tienda, con el saldo en su placa
  const door = portal.getByRole('button', { name: 'Entrar en la tienda del bajo' });
  await expect(door).toBeVisible();
  await expect(door).toContainText('75 tickets');
  await shot(page, info, 'v167-portal-tienda');
  await door.click();
  const shop = page.getByRole('dialog', { name: 'La tienda del bajo' });
  await expect(wallet(shop)).toHaveText('75');
  // El videoclub: la pared de sobres de la temporada y el dependiente, que cuenta qué trae el elegido
  const wall = shop.getByRole('group', { name: /Sobres de la temporada 1/ });
  await expect(wall.getByRole('button')).toHaveCount(4);
  await expect(wall.getByRole('button', { name: /^Sala de estar/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(shop.locator('.ts-card h3')).toHaveText('Sala de estar');
  await expect(shop.getByText('Raro garantizado en un máximo de 12 muebles.')).toBeVisible();
  // Las probabilidades del sobre elegido, a la vista (lo raro no viene en este: sale de fuera, el gato o la pecera)
  await shop.getByText('Probabilidades y garantías').click();
  await expect(shop.getByRole('heading', { name: /^Raro · 6 %/ })).toContainText('de fuera del sobre');
  // 1.78: con la tanda 3, el balcón trae cuatro raros (gato, pecera, telescopio y perrito): 6 % entre cuatro
  await expect(shop.locator('.ts-odds__row.is-raro li', { hasText: 'Gato dormido' })).toContainText('1,5 %');
  await expect(shop.locator('.ts-odds__row.is-raro li', { hasText: 'Pecera' })).toContainText('1,5 %');
  await page.waitForTimeout(900);
  await shot(page, info, 'v167-tienda-sobres');
  await shop.getByText('Probabilidades y garantías').click();

  // El de coleccionista, más caro y con más suerte: el dependiente lo explica
  await wall.getByRole('button', { name: /^Edición coleccionista: 25 tickets el de 1, 110 el de 5/ }).click();
  await expect(shop.locator('.ts-card h3')).toHaveText('Edición coleccionista');
  await expect(shop.getByRole('button', { name: /^Abrir 5 · 110/ })).toBeDisabled();
  await page.waitForTimeout(900);
  await shot(page, info, 'v167-tienda-coleccionista');

  // Un sobre del balcón: tiembla con el halo de lo mejor, se rasga y la carta se da la vuelta sola
  await wall.getByRole('button', { name: /^Balcón y detalles/ }).click();
  mock.db.piso_sorteo = ['gato'];
  await shop.getByRole('button', { name: /^Abrir 1 · 10/ }).click();
  const gacha = page.locator('.gacha');
  await expect(gacha).toHaveClass(/gacha--raro/);
  await expect(gacha).toHaveClass(/is-sealed/);
  await page.waitForTimeout(400);
  await shot(page, info, 'v167-sobre-cerrado');
  await gacha.getByRole('button', { name: 'Rasgar el sobre «Balcón y detalles»' }).click();
  await page.waitForTimeout(250);
  await shot(page, info, 'v167-sobre-abriendo');
  await expect(gacha.getByRole('button', { name: 'Gato dormido, raro, nuevo' })).toBeVisible({ timeout: 5000 });
  await expect(gacha.getByRole('status')).toContainText('Te llevas gato dormido. Uno es nuevo para ti.', { timeout: 5000 });
  await page.waitForTimeout(700);
  await shot(page, info, 'v167-sobre-raro');
  await gacha.getByRole('button', { name: 'Volver a la tienda' }).click();
  await expect(wallet(shop)).toHaveText('65');
  await expect(shop.getByText('Raro garantizado en un máximo de 15 muebles.')).toBeVisible();

  // Paquete de cinco: cartas boca abajo, «Revelar todas» las vuelve una a una
  mock.db.piso_sorteo = ['libros', 'tetera', 'radio', 'libros', 'planta-pequena'];
  await shop.getByRole('button', { name: /^Abrir 5 · 45/ }).click();
  await expect(gacha).toHaveClass(/gacha--poco-comun/);
  await gacha.getByRole('button', { name: /^Rasgar el sobre/ }).click();
  await expect(gacha.getByRole('button', { name: /^Revelar carta \d de 5$/ })).toHaveCount(4, { timeout: 5000 });
  await page.waitForTimeout(600);
  await shot(page, info, 'v167-paquete-boca-abajo');
  await gacha.getByRole('button', { name: 'Revelar carta 3 de 5' }).click();
  await expect(gacha.getByRole('button', { name: 'Radio, poco común, nuevo' })).toBeVisible();
  await gacha.getByRole('button', { name: 'Revelar todas' }).click();
  await expect(gacha.getByRole('status')).toContainText('Te llevas 5 muebles: pila de libros, tetera, radio, pila de libros, planta pequeña.', { timeout: 5000 });
  await page.waitForTimeout(700);
  await shot(page, info, 'v167-paquete-revelado');
  await gacha.getByRole('button', { name: 'Volver a la tienda' }).click();
  await expect(wallet(shop)).toHaveText('20');

  // Comprar: precio fijo y confirmación; si no llega, no se puede
  await shop.getByRole('tab', { name: 'Muebles' }).click();
  await shop.getByRole('button', { name: /^Sofá, poco común, 40 tickets/ }).click();
  await expect(shop.getByText('Te faltan 20 tickets.')).toBeVisible();
  await expect(shop.getByRole('button', { name: 'Comprar' })).toBeDisabled();
  await shot(page, info, 'v167-tienda-muebles');
  await shop.getByRole('button', { name: /^Silla, común, 20 tickets/ }).click();
  await shop.getByRole('button', { name: 'Comprar' }).click();
  await expect(shop.locator('.ts-note')).toContainText('Silla: ya es tuyo.');
  await expect(wallet(shop)).toHaveText('0');
  expect(mock.db.piso_inventario[ANA.id].silla).toBe(3);

  // Reciclar: solo lo que no está colocado. Se llega tocando la caja de reciclaje del dibujo (no su letrero)
  const scene = await shop.locator('.ts-scene').boundingBox();
  await shop.locator('.ts-scene').click({ position: { x: scene.width * 0.474, y: scene.height * 0.72 } });
  await expect(shop.getByRole('tab', { name: 'Reciclar' })).toHaveAttribute('aria-selected', 'true');
  await shop.getByRole('button', { name: /^Gato dormido: 1 sin colocar; reciclar por 20 tickets/ }).click();
  await shot(page, info, 'v167-tienda-reciclar');
  await shop.getByRole('button', { name: 'Reciclar', exact: true }).click();
  await expect(wallet(shop)).toHaveText('20');
  await expect(shop.getByRole('button', { name: /^Gato dormido/ })).toHaveCount(0);

  // Volver al portal: la placa del escaparate trae el saldo nuevo
  await page.getByRole('button', { name: 'Volver al portal' }).click();
  await expect(portal.getByRole('button', { name: 'Entrar en la tienda del bajo' })).toContainText('20 tickets');
  expect(errors).toEqual([]);
});

test('con movimiento reducido, el sobre enseña lo que trae sin animación', async ({ page }, info) => {
  test.skip(SOBRES_CERRADOS, 'Sobres cerrados por reforma (9-11-2026): vuelve al reabrirlos');
  test.skip(!/390x844/.test(info.project.name), 'una vez basta');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const mock = mockWith({ tickets: 30, sin_raro: 0 });
  const portal = await openPortal(page, mock);
  await portal.getByRole('button', { name: 'Entrar en la tienda del bajo' }).click();
  const shop = page.getByRole('dialog', { name: 'La tienda del bajo' });
  mock.db.piso_sorteo = ['cuadro'];
  await shop.getByRole('button', { name: /^Abrir 1 · 10/ }).click();
  const gacha = page.locator('.gacha');
  await expect(gacha).toHaveClass(/is-done/);
  await expect(gacha.getByRole('button', { name: 'Cuadro del barco, común, nuevo' })).toBeVisible();
  await expect(gacha.getByRole('button', { name: /^Rasgar el sobre/ })).toHaveCount(0);
  await shot(page, info, 'v167-sobre-reducido');
});

test('sin tickets suficientes lo dice y lleva a las misiones; abajo, el nombre del sobre y qué hacer', async ({ page }, info) => {
  test.skip(SOBRES_CERRADOS, 'Sobres cerrados por reforma (9-11-2026): vuelve al reabrirlos');
  test.skip(!/320x640|390x844/.test(info.project.name), '320 y 390');
  const mock = mockWith({ tickets: 15, sin_raro: 1 });
  const portal = await openPortal(page, mock);
  await portal.getByRole('button', { name: 'Entrar en la tienda del bajo' }).click();
  const shop = page.getByRole('dialog', { name: 'La tienda del bajo' });
  // Con el de 1 sí llega; abajo, el nombre del sobre y «Toca para rasgar el precinto.»
  mock.db.piso_sorteo = ['sofa'];
  await shop.getByRole('button', { name: /^Abrir 1 · 10/ }).click();
  const gacha = page.locator('.gacha');
  await expect(gacha.getByRole('heading', { name: 'Sala de estar', exact: true })).toBeVisible();
  await expect(gacha.getByText('Toca para rasgar el precinto.')).toBeVisible();
  // El «Volver» de la barra vuelve a la tienda mientras el sobre está abierto
  await expect(page.locator('.ed-bar__back')).toHaveText('Volver a la tienda');
  await page.waitForTimeout(400);
  await shot(page, info, 'v168-sobre-mostrador');
  await gacha.getByRole('button', { name: 'Rasgar el sobre «Sala de estar»' }).click();
  await expect(gacha.getByRole('button', { name: 'Sofá, poco común, nuevo' })).toBeVisible({ timeout: 5000 });
  await expect(gacha.getByText('Un mueble para tu piso · nuevo')).toBeVisible();
  await page.waitForTimeout(500);
  await shot(page, info, 'v168-sobre-uno');
  // El papel de abajo cabe entero aunque la letra sea grande (en un móvil real se cortaba «Colocar en mi piso»)
  await page.addStyleTag({ content: '.gacha__paper { font-size: 1.3em; }' });
  const go = gacha.getByRole('button', { name: 'Colocar en mi piso' });
  const back = gacha.getByRole('button', { name: 'Volver a la tienda' });
  await back.scrollIntoViewIfNeeded();
  const [g, b] = [await gacha.boundingBox(), await back.boundingBox()];
  expect(b.y + b.height).toBeLessThanOrEqual(g.y + g.height);
  await expect(go).toBeInViewport();
  await page.locator('.ed-bar__back').click();
  await expect(page.locator('.ed-bar__back')).toHaveText('Volver al portal');
  // Ahora quedan 5: lo dice y ofrece las misiones
  await expect(shop.locator('.ts-note')).toContainText('Te faltan 5 tickets.');
  await expect(shop.getByRole('button', { name: /^Abrir 1 · 10/ })).toBeDisabled();
  await page.waitForTimeout(300);
  await shot(page, info, 'v168-tienda-sin-tickets');
  await shop.getByRole('button', { name: /Ver misiones/ }).click();
  await expect(page.getByRole('tab', { name: /Misiones/ })).toHaveAttribute('aria-selected', 'true', { timeout: 15000 });
});

test('las misiones del ordenador se cobran en tickets y las figuras no aparecen', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), 'una vez basta');
  const mock = mockWith({ tickets: 30, sin_raro: 0 });
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  // Ni la vitrina ni su recorrido
  await expect(page.locator('.hotspot[data-id="figures"]')).toHaveCount(0);
  // Dos sesiones de lectura esta semana (antes de que arranque la app): la misión de las sesiones queda cumplida
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.addInitScript(() => {
    try {
      const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
      if (!st || st.progress.pomodoros.length >= 2) return;
      const now = new Date().toISOString();
      st.progress.pomodoros = [...st.progress.pomodoros, { at: now, minutes: 25 }, { at: now, minutes: 25 }];
      localStorage.setItem('bookshelf:v1', JSON.stringify(st));
    } catch {
      // Sin estado guardado, la prueba fallará más abajo con un mensaje claro
    }
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.hotspot[data-id="laptop"]').focus();
  await page.keyboard.press('Enter');
  const laptop = page.getByRole('dialog').first();
  await laptop.getByRole('tab', { name: /Misiones/ }).click();
  await expect(laptop.getByText('tickets para el almacén del hotel')).toBeVisible({ timeout: 15000 });
  await expect(laptop.locator('.pc-tickets b')).toHaveText('30');
  await expect(laptop.getByText('Abrir el Ático')).toHaveCount(0);
  const row = laptop.locator('.pc-mission', { hasText: 'Completa 2 sesiones de lectura cozy' });
  await row.getByRole('button', { name: /Cobrar 12/ }).click();
  await expect(row).toContainText('Cobrada');
  await expect(laptop.locator('.pc-tickets b')).toHaveText('42');
  await shot(page, info, 'v167-misiones-tickets');
  // Una sola vez por semana: el simulador lo apunta y el ordenador ya no ofrece cobrarla
  expect(mock.db.piso_reclamos.filter((k) => k.includes(':pomodoro:'))).toHaveLength(1);
});
