// 1.120 (SPEC §120; docs/qa/cafe-libreria.md, bloque 2) · El café-librería del bajo: Pilar te da las llaves, eliges el
// nombre de la lista cerrada, llegan los muebles del rincón y tus libros leídos llenan las estanterías; Decorar desde
// arriba con la rejilla (elegir, llevar a una casilla, girar, guardar en la balda, traer un mueble de casa) y lo guarda el
// servidor (simulado, con sus reglas): al volver a entrar está igual. Capturas y vídeos en qa-report/cafe-decorar/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';

const DIR = join('qa-report', 'cafe-decorar');
const tam = (info) => info.project.name.replace(/^(chromium|webkit)-/, '$1-');
const LIBROS = Array.from({ length: 14 }, (_, i) => ({
  id: `c-${i}`,
  title:
    ['La sombra del faro', 'Mareas de papel', 'El último tranvía', 'Cartas al puerto', 'La casa de las gaviotas', 'Niebla en el muelle', 'Té para dos', 'El reloj del farero'][i % 8] +
    (i >= 8 ? ` ${i}` : ''),
  author: 'Autoría de prueba',
  status: i < 11 ? 'read' : 'reading',
  pageCount: 300,
  currentPage: i < 11 ? 300 : 40,
  cover: '',
  addedAt: '2026-10-01T10:00:00.000Z',
  finishedAt: i < 11 ? '2026-10-20T10:00:00.000Z' : null,
  quotes: [],
}));

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

async function alPortal(page, cafe) {
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 120, sin_raro: 3 } },
    piso_inventario: { [ANA.id]: { sillon: 1, 'mesa-baja': 2, 'lampara-pie': 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.libraries.push({ user_id: ANA.id, data: { books: LIBROS }, updated_at: new Date().toISOString(), version: 5 });
  await page.addInitScript((books) => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!localStorage.getItem('bookshelf:v1')) localStorage.setItem('bookshelf:v1', JSON.stringify({ books }));
  }, LIBROS);
  await mock.attach(page, ANA);
  const estado = await simularCafe(page, cafe, { piso: () => ({ copias: mock.db.piso_inventario[ANA.id], layout: { items: [] } }) });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  return { mock, portal, estado };
}

async function entrar(page, portal) {
  await portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' }).click({ timeout: 15000 });
  const cafe = page.getByRole('dialog', { name: 'El café-librería del bajo' });
  await expect(cafe.locator('.cf3[data-ready="true"]')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__cafe3d?.settled() && window.__cafe3d.renders() > 0);
  return cafe;
}
const quieto = async (page, ms = 600) => {
  await page.waitForFunction(() => window.__cafe3d?.settled());
  await page.waitForTimeout(ms);
};
const tocarCasilla = async (page, x, y) => {
  const p = await page.evaluate(([cx, cy]) => window.__cafe3d.casillaEnPantalla(cx, cy), [x, y]);
  await page.mouse.click(p.x, p.y);
};
const tocarPieza = async (page, uid) => {
  const p = await page.evaluate((u) => window.__cafe3d.piezaEnPantalla(u), uid);
  await page.mouse.click(p.x, p.y);
};

test('las llaves, el nombre, Decorar y volver a entrar', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/.test(info.project.name), '360, 430, escritorio y 390 (Chromium y WebKit)');
  test.setTimeout(150000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { portal, estado, mock } = await alPortal(page, {});
  let cafe = await entrar(page, portal);
  await quieto(page);
  await page.screenshot({ path: join(DIR, `1-traspaso-${tam(info)}.png`) });

  // Pilar cuenta lo suyo y, al final, ofrece las llaves
  await cafe.getByRole('button', { name: 'Hablar con Pilar' }).click();
  for (let k = 0; k < 3; k += 1) await cafe.getByRole('button', { name: 'Seguir' }).click();
  await expect(cafe.locator('.cf3-dice')).toContainText('aquí tienes las llaves');
  await cafe.getByRole('button', { name: 'Quedarme con las llaves' }).click();
  // El nombre, de la lista cerrada (sin texto libre)
  const nombres = cafe.getByRole('radiogroup', { name: 'Nombres del café' });
  await expect(nombres.getByRole('radio')).toHaveCount(12);
  await expect(cafe.locator('input, textarea')).toHaveCount(0);
  await expect(cafe.getByRole('button', { name: 'Inaugurar el café' })).toBeDisabled();
  await nombres.getByRole('radio', { name: 'Taza y Lomo' }).click();
  await page.screenshot({ path: join(DIR, `2-nombre-${tam(info)}.png`) });
  await cafe.getByRole('button', { name: 'Inaugurar el café' }).click();
  await expect(cafe.locator('.cf3[data-abierto="true"]')).toBeVisible();
  await expect(cafe.locator('.cf3-placa')).toContainText('Taza y Lomo');
  await expect(cafe.locator('.cf3-dice')).toContainText('«Taza y Lomo» ya es tuyo');
  expect(estado.llamadas.find((l) => l.rpc === 'cafe_inaugurar').body).toEqual({ nombre: 'Taza y Lomo' });
  expect(await page.evaluate(() => window.__cafe3d.piezas())).toBe(10);
  await quieto(page, 900);
  await page.screenshot({ path: join(DIR, `3-inaugurado-${tam(info)}.png`) });
  // Tus libros en las estanterías: la baja del café, desde cerca
  await page.evaluate(() => window.__cafe3d.place(2.6, 7.3, Math.PI));
  await quieto(page);
  await page.screenshot({ path: join(DIR, `4-estanteria-${tam(info)}.png`) });

  // Decorar: desde arriba, con la rejilla
  await cafe.getByRole('button', { name: 'Decorar' }).click();
  await expect(cafe.locator('.cf3[data-decorar="true"]')).toBeVisible();
  await quieto(page);
  await page.screenshot({ path: join(DIR, `5-decorar-${tam(info)}.png`) });
  // Elegir la mesa del fondo y llevarla a otra casilla
  await tocarPieza(page, 'i5');
  await expect(cafe.locator('.cf3-balda__titulo')).toHaveText('Mesa redonda de mármol');
  await tocarCasilla(page, 4, 4);
  await expect.poll(() => page.evaluate(() => window.__cafe3d.piezaEnPantalla('i5') && true)).toBe(true);
  // Girar una silla y guardarla en la balda
  await cafe.getByRole('button', { name: 'Soltar' }).click();
  await tocarPieza(page, 'i7');
  await expect(cafe.locator('.cf3-balda__titulo')).toHaveText('Silla de bistró');
  await cafe.getByRole('button', { name: 'Girar' }).click();
  await cafe.getByRole('button', { name: 'Guardar en la balda' }).click();
  // Traer la mesa baja de casa (tienes dos y una está en tu piso: queda una libre)
  await cafe.getByRole('tab', { name: 'De tu casa' }).click();
  const mesaBaja = cafe.getByRole('button', { name: /^Poner Mesa baja/ });
  await expect(mesaBaja).toContainText('1 libre');
  await mesaBaja.click();
  await expect(cafe.locator('.cf3-balda__titulo')).toHaveText('Mesa baja');
  await quieto(page);
  await page.screenshot({ path: join(DIR, `6-decorando-${tam(info)}.png`) });
  await cafe.getByRole('button', { name: 'Soltar' }).click();
  await expect(cafe.getByRole('button', { name: /^Poner Mesa baja/ })).toBeDisabled();
  // La silla guardada vuelve a estar libre en «Del café»
  await cafe.getByRole('tab', { name: 'Del café' }).click();
  await expect(cafe.getByRole('button', { name: /^Poner Silla de bistró/ })).toContainText('1 libre');
  await cafe.getByRole('button', { name: 'Listo' }).click();
  await expect(cafe.locator('.cf3-dice')).toContainText('Guardado');
  const guardado = estado.plano.items;
  expect(guardado.find((i) => i.uid === 'i5')).toMatchObject({ x: 4, y: 4 });
  expect(guardado.some((i) => i.uid === 'i7')).toBe(false);
  expect(guardado.filter((i) => i.id === 'mesa-baja')).toHaveLength(1);
  await quieto(page, 900);
  await page.screenshot({ path: join(DIR, `7-guardado-${tam(info)}.png`) });

  // Se sale a la calle y se vuelve a entrar: está igual
  await cafe.getByRole('button', { name: 'Volver al portal' }).click();
  cafe = await entrar(page, portal);
  await expect(cafe.locator('.cf3-placa')).toContainText('Taza y Lomo');
  expect(await page.evaluate(() => window.__cafe3d.piezas())).toBe(guardado.length);
  await quieto(page, 900);
  await page.screenshot({ path: join(DIR, `8-otra-vez-${tam(info)}.png`) });
  // La barra con Pilar y el rótulo del café en la pared de detrás
  await cafe.getByRole('button', { name: 'Hablar con Pilar' }).click();
  await expect(cafe.locator('.cf3-dice')).toContainText('Pronto vendrán clientes');
  await quieto(page, 700);
  await page.screenshot({ path: join(DIR, `9-barra-${tam(info)}.png`) });
  await cafe.getByRole('button', { name: 'Hasta luego' }).click();
  // Los tickets y el inventario de casa no cambian
  expect(mock.db.piso_cuentas[ANA.id].tickets).toBe(120);
  expect(mock.db.piso_inventario[ANA.id]).toMatchObject({ sillon: 1, 'mesa-baja': 2, 'lampara-pie': 1 });
  expect(errors).toEqual([]);
  const video = page.video();
  await page.close();
  if (video && /390x844/.test(info.project.name)) await video.saveAs(join(DIR, `decorar-${tam(info)}.webm`));
});

test('arrastrar una pieza y no poder ponerla encima de otra', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'Chromium 390');
  const plano = {
    v: 1,
    items: [
      { uid: 'a', id: 'cafe-mesa', x: 1, y: 1, rot: 0 },
      { uid: 'b', id: 'cafe-silla', x: 3, y: 1, rot: 0 },
    ],
  };
  const { portal, estado } = await alPortal(page, { inaugurado: true, nombre: 'El Farolillo', plano, inventario: { 'cafe-mesa': 1, 'cafe-silla': 1 } });
  const cafe = await entrar(page, portal);
  await cafe.getByRole('button', { name: 'Decorar' }).click();
  await quieto(page, 300);
  await tocarPieza(page, 'a');
  // Arrastrarla dos casillas abajo
  const de = await page.evaluate(() => window.__cafe3d.piezaEnPantalla('a'));
  const a = await page.evaluate(() => window.__cafe3d.casillaEnPantalla(1, 3));
  await page.mouse.move(de.x, de.y);
  await page.mouse.down();
  await page.mouse.move((de.x + a.x) / 2, (de.y + a.y) / 2, { steps: 4 });
  await page.mouse.move(a.x, a.y, { steps: 4 });
  await page.mouse.up();
  // Y luego tocar la casilla de la silla: no se mueve encima
  await tocarCasilla(page, 3, 1);
  await cafe.getByRole('button', { name: 'Soltar' }).click();
  await cafe.getByRole('button', { name: 'Listo' }).click();
  await expect(cafe.locator('.cf3-dice')).toContainText('Guardado');
  expect(estado.plano.items.find((i) => i.uid === 'a')).toMatchObject({ x: 1, y: 3 });
});

test('sin WebGL: inaugurado, el dibujo y sin Decorar', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'Chromium 390');
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
      return /webgl/.test(kind) ? null : get.call(this, kind, ...rest);
    };
  });
  const { portal } = await alPortal(page, { inaugurado: true, nombre: 'Capítulo Uno', plano: { v: 1, items: [] }, inventario: {} });
  await portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' }).click({ timeout: 15000 });
  const cafe = page.getByRole('dialog', { name: 'El café-librería del bajo' });
  await expect(cafe.locator('.cf3[data-ready="true"]')).toBeVisible({ timeout: 20000 });
  await expect(cafe.locator('.cf3-iso img')).toBeVisible();
  await expect(cafe.locator('.cf3-placa')).toContainText('Capítulo Uno');
  await expect(cafe.getByRole('button', { name: 'Decorar' })).toHaveCount(0);
});
