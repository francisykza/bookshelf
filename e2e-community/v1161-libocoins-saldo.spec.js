// 1.161 · Libocoins, bloque 2 (docs/qa/libocoins.md): tu saldo, siempre a mano junto a Libo. La moneda con la cifra a su lado
// en tu piso, el portal, tu piso del edificio y el café; tocarla abre una nota de papel (saldo, cómo se ganan y dónde se gastan)
// que se cierra tocando fuera, con su cruz o con Atrás. Donde Libo se aparta (el armario), la moneda tampoco está. Supabase
// simulado y una cuenta de prueba (ninguna cuenta real). Emulación: no equivale a un Android ni a un iPhone reales.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NEIGHBOURS } from '../src/features/edificio/demo.js';
import { simularCafe } from './cafeMock';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222' };
const DIR = join('qa-report', 'v1161-libocoins');

test.use({ video: 'on' });

function seed() {
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.profiles.push({ user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'zorro-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '1A' }, { user_id: BRUNO.id, edificio: 'edificio-1', puerta: '2B' });
  const sala = NEIGHBOURS.find((n) => n.id === '1a').room();
  mock.db.pisos.push({ user_id: ANA.id, layout: sala }, { user_id: BRUNO.id, layout: sala });
  mock.db.piso_cuentas[ANA.id] = { inicio_elegido: true, tickets: 60, sin_raro: 0 };
  return mock;
}
const shot = (page, info, name) => page.screenshot({ path: join(DIR, info.project.name, `${name}.png`) });
const corta = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const moneda = (page) => page.locator('.libo-saldo');
const nota = (page) => page.getByRole('dialog', { name: 'Tus Libocoins' });

/** La moneda, dentro de la pantalla, tocable en 44 px, pegada a la pata de Libo y sin tapar los controles de `sels`. */
async function sinTapar(page, sels) {
  const vp = page.viewportSize();
  const placa = await page.locator('.libo-saldo__placa').boundingBox();
  expect(placa.x).toBeGreaterThanOrEqual(0);
  expect(placa.y).toBeGreaterThanOrEqual(0);
  expect(placa.x + placa.width).toBeLessThanOrEqual(vp.width + 1);
  expect(placa.y + placa.height).toBeLessThanOrEqual(vp.height + 1);
  expect((await moneda(page).boundingBox()).height).toBeGreaterThanOrEqual(44);
  // Pegada a su pata: la moneda toca a Libo por abajo a la izquierda, sin taparle más que el borde
  const coin = await page.locator('.libo-saldo .libocoin').boundingBox();
  const libo = await page.locator('.libo-rincon__gato').boundingBox();
  expect(coin.x + coin.width - libo.x, 'cuánto entra en Libo').toBeGreaterThanOrEqual(0);
  expect(coin.x + coin.width - libo.x, 'cuánto entra en Libo').toBeLessThanOrEqual(libo.width * 0.4);
  expect(coin.y + coin.height).toBeGreaterThanOrEqual(libo.y + libo.height - 12);
  for (const sel of sels) for (const b of await page.locator(sel).all()) if (await b.isVisible()) expect(corta(placa, await b.boundingBox()), sel).toBe(false);
}

test.beforeEach(async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844)$|^webkit-390x844$/.test(info.project.name), 'móvil vertical');
  mkdirSync(join(DIR, info.project.name), { recursive: true });
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});

test('el saldo junto a Libo en tu piso, el portal, tu piso del edificio y el café; la nota se abre y se cierra', async ({ page }, info) => {
  test.setTimeout(180000);
  const mock = seed();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await mock.attach(page, ANA);
  await simularCafe(page, { inaugurado: true, nombre: 'El Rincón', nivel: 1, granos: 12 });
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });

  // 1 · En tu piso: la moneda con tu saldo, a la izquierda de Libo y sin tapar la barra
  await expect(moneda(page)).toHaveAttribute('data-saldo', '60', { timeout: 15000 });
  await expect(page.locator('.libo-saldo__cifra')).toHaveText('60');
  await expect(moneda(page)).toHaveAccessibleName('Tus Libocoins: 60 Libocoins');
  await page.waitForTimeout(600);
  await sinTapar(page, ['.plab-bar button']);
  await shot(page, info, '1-piso');

  // 2 · La nota de papel: el saldo, cómo se ganan y dónde se gastan; dentro de la pantalla y con botones de 44 px
  await moneda(page).click();
  await expect(nota(page)).toBeVisible();
  await expect(nota(page)).toContainText('Tienes 60 Libocoins');
  await expect(nota(page)).toContainText('Se ganan');
  await expect(nota(page)).toContainText('Se gastan');
  await page.waitForTimeout(300);
  const r = await nota(page).boundingBox();
  const vp = page.viewportSize();
  expect(r.x >= 0 && r.y >= 0 && r.x + r.width <= vp.width + 1 && r.y + r.height <= vp.height + 1).toBe(true);
  for (const b of await nota(page).locator('button').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await shot(page, info, '2-nota');
  // Tocar a Libo cierra la nota y abre su tarjeta (nunca las dos a la vez)
  await page.locator('.libo-rincon__gato').click();
  await expect(nota(page)).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Libo: lo de hoy' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Libo: lo de hoy' })).toHaveCount(0);
  // Atrás del móvil cierra la nota y te deja en tu piso
  await moneda(page).click();
  await expect(nota(page)).toBeVisible();
  await page.goBack();
  await expect(nota(page)).toHaveCount(0);
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible();
  // La cruz también
  await moneda(page).click();
  await nota(page).getByRole('button', { name: 'Cerrar' }).click();
  await expect(nota(page)).toHaveCount(0);

  // 3 · Lo ganado en otro sitio llega al cambiar de escena (el servidor manda): en el portal ya dice 75
  mock.db.piso_cuentas[ANA.id].tickets = 75;
  await page.waitForTimeout(10500);
  await page.locator('.plab-bar > .px-btn').click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await expect(portal.locator('.ed-facade')).toBeVisible({ timeout: 20000 });
  await expect(portal.locator('.ed-facade')).not.toHaveClass(/is-arriving/, { timeout: 8000 });
  await expect(moneda(page)).toHaveAttribute('data-saldo', '75', { timeout: 10000 });
  await page.waitForTimeout(600);
  await sinTapar(page, ['.ed-bar button', '.ed-buzon', '.ed-limo']);
  await shot(page, info, '3-portal');

  // 4 · Tu piso del edificio, sin tapar sus esquinas; en el armario, la moneda se aparta con Libo
  await portal.locator('.ed-window--mine').click();
  await expect(page.locator('.ep-corner--right')).toBeVisible({ timeout: 20000 });
  await expect(moneda(page)).toBeVisible();
  await page.waitForTimeout(600);
  await shot(page, info, '4-tu-piso');
  await sinTapar(page, ['.ep-corner--right', '.ep-corner--left3', '.ep-corner--left', '.ed-bar__view']);
  await page.locator('.ep-corner--left3').click();
  await expect(page.getByRole('button', { name: 'Al piso' })).toBeVisible();
  await expect(moneda(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Al piso' }).click();
  await expect(moneda(page)).toBeVisible();
  await page.getByRole('button', { name: 'Volver al portal' }).click();
  await expect(portal.locator('.ed-facade')).toBeVisible({ timeout: 20000 });

  // 5 · El café, arriba junto a Libo, sin tapar el marcador ni los granos
  await portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' }).click();
  const cafe = page.getByRole('dialog', { name: 'El café-librería del bajo' });
  await expect(cafe.locator('.cf3[data-ready="true"]')).toBeVisible({ timeout: 25000 });
  await expect(moneda(page)).toBeVisible();
  await page.waitForTimeout(800);
  await sinTapar(page, ['.cf3-placa', '.cf3-monedero', '.cf3-hud__der button', '.cf3-franja', '.ed-bar__back']);
  await shot(page, info, '5-cafe');
  await moneda(page).click();
  await expect(nota(page)).toBeVisible();
  const rc = await nota(page).boundingBox();
  expect(rc.y + rc.height).toBeLessThanOrEqual(page.viewportSize().height + 1);
  await shot(page, info, '6-cafe-nota');
  expect(errores).toEqual([]);
});
