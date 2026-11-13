// 1.119 (SPEC §119; docs/qa/cafe-libreria.md, bloque 1) · La tienda del bajo pasa a ser el café-librería: desde la calle se
// entra en el antiguo videoclub, vacío y en traspaso, en 3D; sin sobres, muebles ni reciclaje a la vista, y los tickets y el
// inventario no cambian. Pilar habla desde el mostrador; la cortina y el escaparate se tocan. Sin WebGL, el dibujo del local
// vacío. Capturas y vídeos en qa-report/cafe/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';

const DIR = join('qa-report', 'cafe');
const tam = (info) => info.project.name.replace(/^(chromium|webkit)-/, '$1-');

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

async function alPortal(page, { sinWebgl = false } = {}) {
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 120, sin_raro: 3 } },
    piso_inventario: { [ANA.id]: { sillon: 1, silla: 2, 'mesa-baja': 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  await mock.attach(page, ANA);
  // Sin la migración del café (1.120): el bajo sigue en traspaso, como en la 1.119
  await simularCafe(page, null);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  if (sinWebgl)
    await page.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
        return /webgl/.test(kind) ? null : get.call(this, kind, ...rest);
      };
    });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  return { mock, portal };
}

async function entrar(page, portal) {
  const puerta = portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' });
  await expect(puerta).toContainText('Café-librería');
  await expect(puerta).toContainText('Se traspasa');
  await puerta.click({ timeout: 15000 });
  const cafe = page.getByRole('dialog', { name: 'El café-librería del bajo' });
  await expect(cafe.locator('.cf3[data-ready="true"]')).toBeVisible({ timeout: 20000 });
  return cafe;
}

test('el bajo en traspaso: sin tienda, Pilar habla y lo tuyo no cambia', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/.test(info.project.name), '360, 430, escritorio y 390 (Chromium y WebKit)');
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { mock, portal } = await alPortal(page);
  const cafe = await entrar(page, portal);
  await page.waitForFunction(() => window.__cafe3d?.settled() && window.__cafe3d.renders() > 0);
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(DIR, `1-entrada-${tam(info)}.png`) });

  // Ni sobres, ni muebles a la venta, ni reciclar
  for (const t of ['Sobres', 'Muebles', 'Reciclar']) await expect(cafe.getByRole('tab', { name: t })).toHaveCount(0);
  await expect(cafe.getByRole('button', { name: /^Abrir|^Comprar|^Reciclar/ })).toHaveCount(0);
  await expect(cafe.locator('.ts-wallet, .ts-packs, .ts-grid')).toHaveCount(0);

  // Pilar saluda; al hablar con ella, la cámara va al mostrador y cuenta sus tres frases
  await expect(cafe.locator('.cf3-dice')).toContainText('Cuidado con las cajas');
  await cafe.getByRole('button', { name: 'Hablar con Pilar' }).click();
  await expect(cafe.locator('.cf3-dice')).toContainText('Soy Pilar');
  await page.waitForFunction(() => window.__cafe3d?.settled());
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(DIR, `2-pilar-${tam(info)}.png`) });
  // 1.126: sin hablar de lo que había antes en el bajo (Francisco, 13-11-2026)
  await expect(cafe.locator('.cf3-dice')).not.toContainText(/sobres|reforma|tickets/);
  await cafe.getByRole('button', { name: 'Seguir' }).click();
  await expect(cafe.locator('.cf3-dice')).not.toContainText(/sobres|reforma|tickets/);
  await expect(cafe.locator('.cf3-dice')).toContainText('un café con libros');
  await cafe.getByRole('button', { name: 'Seguir' }).click();
  await expect(cafe.locator('.cf3-dice')).toContainText('te doy las llaves');
  await cafe.getByRole('button', { name: 'Hasta pronto' }).click();
  await expect(cafe.locator('.cf3-dice')).toContainText('Cuidado con las cajas');

  // La cortina del fondo, desde su letrero: lo que se abrirá
  await page.evaluate(() => window.__cafe3d.place(5.4, 8.4, Math.PI + 0.1));
  await page.waitForTimeout(400);
  await cafe.getByRole('button', { name: 'El resto del local' }).click();
  await expect(cafe.locator('.cf3-dice')).toContainText('Detrás de la cortina');
  await page.waitForFunction(() => window.__cafe3d?.settled());
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(DIR, `3-cortina-${tam(info)}.png`) });

  // El escaparate y el cartel «SE TRASPASA» de la puerta, mirando a la calle
  await page.evaluate(() => window.__cafe3d.place(5.6, 6.4, 0.25));
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(DIR, `4-escaparate-${tam(info)}.png`) });

  // Lo tuyo no cambia: los mismos tickets y las mismas copias
  expect(mock.db.piso_cuentas[ANA.id].tickets).toBe(120);
  expect(mock.db.piso_inventario[ANA.id]).toMatchObject({ sillon: 1, silla: 2, 'mesa-baja': 1 });
  // Y se vuelve a la calle
  await cafe.getByRole('button', { name: 'Volver al portal' }).click();
  await expect(portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' })).toBeVisible({ timeout: 15000 });
  expect(errors).toEqual([]);
  const video = page.video();
  await page.close();
  if (video && /390x844/.test(info.project.name)) await video.saveAs(join(DIR, `cafe-${tam(info)}.webm`));
});

test('andar tocando el suelo, sin atravesar el mostrador', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'Chromium 390');
  const { portal } = await alPortal(page);
  await entrar(page, portal);
  await page.waitForFunction(() => window.__cafe3d?.settled() && window.__cafe3d.renders() > 0);
  // Un punto del suelo delante: se anda hasta él
  const box = await page.locator('.cf3-canvas').boundingBox();
  const tx = box.x + box.width * 0.5;
  const ty = box.y + box.height * 0.82;
  const suelo = await page.evaluate(([x, y]) => window.__cafe3d.sueloEn(x, y), [tx, ty]);
  expect(suelo).not.toBeNull();
  const antes = await page.evaluate(() => window.__cafe3d.pose());
  await page.mouse.click(tx, ty);
  await page.waitForFunction(() => window.__cafe3d.settled());
  const despues = await page.evaluate(() => window.__cafe3d.pose());
  expect(Math.hypot(despues.x - antes.x, despues.y - antes.y)).toBeGreaterThan(0.3);
  // Hacia Pilar (detrás del mostrador): se para delante del mostrador
  await page.evaluate(() => window.__cafe3d.go('pilar'));
  await page.waitForFunction(() => window.__cafe3d.settled());
  const ante = await page.evaluate(() => window.__cafe3d.pose());
  expect(ante.x).toBeLessThan(7.0);
});

test('con movimiento reducido, sin paseo de cámara', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'Chromium 390');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { portal } = await alPortal(page);
  const cafe = await entrar(page, portal);
  await page.waitForFunction(() => window.__cafe3d?.renders() > 0);
  await cafe.getByRole('button', { name: 'Hablar con Pilar' }).click();
  // Directo delante del mostrador, sin andar
  const p = await page.evaluate(() => window.__cafe3d.pose());
  expect(p.x).toBeCloseTo(6.5, 1);
  expect(await page.evaluate(() => window.__cafe3d.settled())).toBe(true);
});

test('sin WebGL, el dibujo del local vacío y Pilar igual', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'Chromium 390');
  mkdirSync(DIR, { recursive: true });
  const { portal } = await alPortal(page, { sinWebgl: true });
  const cafe = await entrar(page, portal);
  const img = cafe.locator('.cf3-iso img');
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
  await expect(cafe.getByRole('button', { name: 'Hablar con Pilar' })).toBeVisible();
  await page.screenshot({ path: join(DIR, `5-sin-webgl-${tam(info)}.png`) });
});
