// 1.125 (SPEC §125; docs/qa/cafe-libreria.md §14, bloque 6a, cifras de Francisco del 13-11-2026) · El sótano: en el nivel 6
// se abre la trampilla de detrás de la barra y se baja a la bodega (bóveda de ladrillo, barricas, botellero y su escalera),
// con su propia cuadrícula de 5 × 5, sus muebles (mesa de barrica, banco de bodega y candil) y clientes sentados abajo; un
// café se lleva bajando con la taza; en Decorar se elige la planta; y la subida al 6 enseña la trampilla y la bodega. El
// servidor simulado aplica las reglas de `20261214120000_cafe_sotano.sql`. Capturas y vídeos en qa-report/cafe-bodega/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { hacerGesto, quieto } from './cafeBarra';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { generoDe, nombreOpcion, recetaPide } from '../src/features/edificio/cafe/cafeClientes';
import { ELIGE, ETAPAS, gestosDe } from '../src/features/edificio/cafe/cafeGestos';
import { umbralHito } from '../src/features/edificio/cafe/cafeNiveles';
import { dayKey } from '../src/domain/dates';

const DIR = join('qa-report', 'cafe-bodega');
const tam = (info) => info.project.name.replace(/^(chromium|webkit)-/, '$1-');
const HOY = dayKey();
const libro = (id, title, extra = {}) => ({
  id,
  title,
  author: `Autoría ${id}`,
  status: 'read',
  pageCount: 320,
  currentPage: 320,
  cover: '',
  categories: [],
  publishedDate: '2012',
  addedAt: '2026-10-01T10:00:00.000Z',
  finishedAt: '2026-10-20T10:00:00.000Z',
  quotes: [],
  ...extra,
});
const LIBROS = [
  libro('f', 'El dragón del muelle', { categories: ['Fantasy'] }),
  libro('m', 'Crimen en la lonja', { categories: ['Mystery'] }),
  libro('a', 'Cartas de amor al puerto', { categories: ['Romance'] }),
  libro('s', 'Naves sobre la bahía', { categories: ['Science Fiction'] }),
  libro('n', 'Un libro sin más'),
];
const BALDA = { bienvenida: true, libros: LIBROS.map((b) => ({ clave: b.id, titulo: b.title, genero: generoDe(b), caja: 0, balda: 1 })) };
const CARTA = ['chocolate', 'nata', 'vainilla', 'hielo'];
/**
 * El plano del nivel 6: el de siempre, el ala (piano, mesa larga, biombo y bankers), la terraza sin sus sillas y, en la bodega,
 * dos barricas, dos sillas, el banco de bodega y el candil. Arriba hay 6 asientos y abajo 4: de los 8 clientes, 2 bajan.
 */
const PLANO_6 = {
  v: 1,
  items: [
    ...PLANO_INICIAL.items,
    { uid: 'a1', id: 'cafe-piano', x: -3, y: -3, rot: 0 },
    { uid: 'a2', id: 'cafe-mesa-larga', x: -3, y: 1, rot: 0 },
    { uid: 'a4', id: 'cafe-biombo', x: -2, y: 4, rot: 2 },
    { uid: 'a5', id: 'cafe-bankers', x: -1, y: 1, rot: 0 },
    { uid: 't1', id: 'cafe-mesa-hierro', x: 1, y: 8, rot: 0 },
    { uid: 't5', id: 'cafe-macetero', x: 2, y: 9, rot: 0 },
    { uid: 't6', id: 'cafe-farol', x: 0, y: 9, rot: 0 },
    { uid: 'b1', id: 'cafe-barrica', x: 1, y: 21, rot: 0 },
    { uid: 'b2', id: 'cafe-silla', x: 0, y: 21, rot: 1 },
    { uid: 'b3', id: 'cafe-silla', x: 2, y: 21, rot: 3 },
    { uid: 'b4', id: 'cafe-banco-bodega', x: 2, y: 23, rot: 2 },
    { uid: 'b5', id: 'cafe-barrica', x: 2, y: 22, rot: 0 },
    { uid: 'b6', id: 'cafe-candil', x: 4, y: 20, rot: 0 },
  ],
};
const semillas = (s, n) => Array.from({ length: n }, (_, k) => s + k * 7919);
/** Unas semillas en las que el cliente `n` pide café (con el té, las opciones del grano se llaman de otra manera). */
function semillasCafe(n, desde) {
  for (let s = desde; s < desde + 500000; s += 1000) if (recetaPide({ n, semilla: semillas(s, 8)[n - 1] }, CARTA)[0] === 'cafe') return semillas(s, 8);
  throw new Error('ninguna semilla');
}

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

async function alCafe(page, estado, seeds) {
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 120, sin_raro: 3 } },
    piso_inventario: { [ANA.id]: { sillon: 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.libraries.push({ user_id: ANA.id, data: { books: LIBROS }, updated_at: new Date().toISOString(), version: 5 });
  await page.addInitScript((books) => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!localStorage.getItem('bookshelf:v1')) localStorage.setItem('bookshelf:v1', JSON.stringify({ books, progress: { readingLog: [], pomodoros: [], claimed: {} } }));
  }, LIBROS);
  await mock.attach(page, ANA);
  const plano = structuredClone(estado.plano ?? PLANO_INICIAL);
  const c = await simularCafe(page, { inaugurado: true, nombre: 'Taza y Lomo', inventario: cuenta(plano), libros: BALDA, ...estado, plano }, { clientes: { hoy: HOY, semillas: seeds, quienes: [3], frases: [10] } });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' }).click({ timeout: 15000 });
  const cafe = page.getByRole('dialog', { name: 'El café-librería del bajo' });
  await expect(cafe.locator('.cf3[data-ready="true"]')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__cafe3d?.settled() && window.__cafe3d.renders() > 0);
  return { cafe, c };
}

/** Prepara en la barra la receta pedida y se la lleva: lo de la carta nueva, tocándolo en la barra; lo demás, con los botones. */
async function prepararYLlevar(page, cafe, receta, { foto = null } = {}) {
  const caja = cafe.locator('.cf3-franja--atender');
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'barra');
  await page.waitForFunction(() => window.__cafe3d.enBarra());
  const r = { bebida: receta[0], grano: receta[1], leche: receta[2], toque: receta[3] };
  for (const etapa of ETAPAS) {
    await expect(caja).toHaveAttribute('data-etapa', etapa);
    const parte = ELIGE[etapa];
    if (parte) {
      const valor = r[parte];
      await quieto(page, 200);
      const p = valor === 'frio' || valor === 'vainilla' ? await page.evaluate((x) => window.__cafe3d.barraEnPantalla(x), `barra:${parte}:${valor}`) : null;
      if (p?.front) await page.mouse.click(p.x, p.y);
      else
        await cafe
          .locator('.cf3-opciones')
          .getByRole('button', { name: nombreOpcion(parte, valor), exact: true })
          .click();
      await expect.poll(async () => (await caja.getAttribute('data-receta')).split(',')[['bebida', 'grano', 'leche', 'toque'].indexOf(parte)]).toBe(valor);
    }
    for (const tipo of gestosDe(etapa, r)) await hacerGesto(page, cafe, tipo, { ayuda: false });
  }
  await expect(caja).toHaveAttribute('data-etapa', 'lista');
  expect(await caja.getAttribute('data-receta')).toBe(receta.join());
  await quieto(page, 400);
  await cafe.getByRole('button', { name: 'Llevársela' }).click();
  // Bajando con la taza en la mano
  await page.waitForFunction(() => window.__cafe3d.enRecorrido(), null, { timeout: 15000 });
  await page.waitForTimeout(1500);
  await foto?.('bajando-con-la-taza');
  await expect(caja).toHaveAttribute('data-paso', 'libro', { timeout: 20000 });
  await quieto(page, 300);
  await foto?.('llevada');
  await cafe.getByRole('button', { name: 'Solo el café' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'gracias');
  // El cartel del primer cliente del día puede salir a la vez y tapar el botón
  await page.waitForTimeout(900);
  const logro = page.locator('.cf3-logro');
  if (await logro.isVisible()) await logro.locator('.cf3-logro__ok').click();
  await cafe.getByRole('button', { name: 'Hasta luego' }).click();
}

const SOLO = /chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/;

test('nivel 6: la trampilla, bajar a la bodega, sus clientes, Decorar abajo, un café llevado abajo y subir', async ({ page }, info) => {
  test.skip(!SOLO.test(info.project.name), '360, 430, escritorio y 390 (Chromium y WebKit)');
  test.setTimeout(240000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const foto = async (nombre) => page.screenshot({ path: join(DIR, `bodega-${nombre}-${tam(info)}.png`) });
  const seeds = semillasCafe(7, 4000);
  const { cafe, c } = await alCafe(page, { nivel: 6, reputacion: umbralHito(6, 1) + 40, granos: 900, cobrados: [1, 2, 3, 4, 5, 6], plano: PLANO_6 }, seeds);
  // Con 10 asientos (6 arriba y 4 abajo) vienen los 8 del nivel 6: 7 ya esperan (el excéntrico llega luego); el 7.º, abajo
  await expect(cafe.locator('.cf3-dice')).toContainText('Tienes 7 clientes esperando', { timeout: 9000 });
  await quieto(page);
  await foto('local');
  // La trampilla abierta, detrás de la barra, con su letrero
  await page.evaluate(() => window.__cafe3d.place(5.0, 2.7, Math.atan2(9.0 - 5.0, 1.9 - 2.7)));
  await quieto(page);
  const tag = (texto) => cafe.locator('.cf3-tags button', { hasText: texto });
  const bajar = tag('Bajar a la bodega');
  await expect(bajar).not.toHaveAttribute('data-off', 'true');
  await foto('trampilla');
  // Bajar: se anda a la trampilla y la cámara baja por la escalera
  await bajar.click();
  await page.waitForFunction(() => window.__cafe3d.enRecorrido(), null, { timeout: 15000 });
  await page.waitForTimeout(1300);
  await foto('bajando');
  await page.waitForFunction(() => window.__cafe3d.planta() === 'bodega' && !window.__cafe3d.cambiando() && window.__cafe3d.settled(), null, { timeout: 20000 });
  await quieto(page);
  await foto('bodega');
  // Abajo: la escalera para subir, y el cliente 7 esperando; Pilar y la trampilla no se tocan desde aquí
  // La escalera queda a la espalda: arriba, a la derecha, el botón para subir
  await expect(cafe.getByRole('button', { name: 'Subir al café', exact: true })).toBeVisible();
  await expect(tag('Bajar a la bodega')).toHaveAttribute('data-off', 'true');
  await expect(cafe.locator('.cf3-tags button', { hasText: 'Pilar' })).toHaveAttribute('data-off', 'true');
  expect((await page.evaluate(() => window.__cafe3d.clienteEnPantalla(7))).front).toBe(true);
  // La bodega desde el otro lado: las barricas, la bóveda y el botellero
  await page.evaluate(() => window.__cafe3d.place(45.6, 5.9, Math.atan2(41.0 - 45.6, 0.8 - 5.9)));
  await quieto(page);
  await foto('bodega-barricas');
  await page.evaluate(() => window.__cafe3d.place(41.6, 6.0, Math.atan2(46.6 - 41.6, 3.6 - 6.0)));
  await quieto(page);
  await foto('bodega-escalera');
  // Decorar en la bodega: su cuadrícula de 5 × 5 y la tienda con sus muebles
  await cafe.getByRole('button', { name: 'Decorar' }).click();
  const plantas = cafe.getByRole('group', { name: 'Qué planta decoras' });
  await expect(plantas.getByRole('button', { name: 'La bodega' })).toHaveAttribute('aria-pressed', 'true');
  await quieto(page);
  await foto('decorar-bodega');
  await plantas.getByRole('button', { name: 'El café' }).click();
  await quieto(page);
  await foto('decorar-cafe');
  await plantas.getByRole('button', { name: 'La bodega' }).click();
  await cafe.getByRole('tab', { name: 'Tienda' }).click();
  const tienda = cafe.locator('.cf3-tienda');
  await expect(tienda.getByRole('button', { name: 'Comprar Candil de hierro por 300 granos (tienes 1)' })).toBeEnabled();
  await tienda.getByRole('button', { name: 'Comprar Mesa de barrica por 220 granos (tienes 2)' }).click();
  await expect.poll(() => c.inventario['cafe-barrica']).toBe(3);
  await foto('tienda');
  // La nueva, a la bodega (la planta que se decora)
  await cafe.getByRole('tab', { name: 'Del café' }).click();
  await cafe.locator('.cf3-balda__fila').getByRole('button', { name: /Mesa de barrica/ }).click();
  await quieto(page);
  await foto('decorar-nueva');
  await cafe.getByRole('button', { name: 'Soltar' }).click();
  await cafe.getByRole('button', { name: 'Listo' }).click();
  await expect.poll(() => c.plano.items.filter((i) => i.id === 'cafe-barrica').map((i) => i.y >= 20)).toEqual([true, true, true]);
  await quieto(page);
  // El cliente 7, en la bodega: se le atiende, se sube a la barra y se le baja el café
  await page.evaluate(() => window.__cafe3d.place(46.8, 1.9, Math.atan2(42.5 - 46.8, 3.0 - 1.9)));
  await quieto(page);
  await cafe.locator('.cf3-tag--cliente:not([data-off="true"])').first().click();
  await expect(cafe.locator('.cf3-franja--atender')).toHaveAttribute('data-paso', 'pide');
  await prepararYLlevar(page, cafe, recetaPide({ n: 7, semilla: seeds[6] }, CARTA), { foto });
  expect(await page.evaluate(() => window.__cafe3d.planta())).toBe('bodega');
  // El cartel del primer cliente del día
  const logro = page.locator('.cf3-logro');
  await page.waitForTimeout(900);
  if (await logro.isVisible()) await logro.locator('.cf3-logro__ok').click();
  // Subir al café por la escalera
  await quieto(page);
  await page.evaluate(() => window.__cafe3d.place(45.2, 2.2, Math.atan2(46.8 - 45.2, 3.6 - 2.2)));
  await quieto(page);
  await expect(tag('Subir al café')).not.toHaveAttribute('data-off', 'true');
  await tag('Subir al café').click();
  await page.waitForFunction(() => window.__cafe3d.enRecorrido(), null, { timeout: 15000 });
  await page.waitForTimeout(1300);
  await foto('subiendo');
  await page.waitForFunction(() => window.__cafe3d.planta() === 'calle' && !window.__cafe3d.cambiando() && window.__cafe3d.settled(), null, { timeout: 20000 });
  await quieto(page);
  await foto('arriba');
  expect(errors).toEqual([]);
  const video = page.video();
  await page.close();
  if (video && /390x844/.test(info.project.name)) await video.saveAs(join(DIR, `bodega-${tam(info)}.webm`));
});

test('subir al nivel 6: el cartel de la subida y el recorrido por la trampilla y la bodega', async ({ page }, info) => {
  test.skip(!/chromium-390x844$|webkit-390x844$/.test(info.project.name), 'a 390');
  test.setTimeout(150000);
  mkdirSync(DIR, { recursive: true });
  const foto = async (nombre) => page.screenshot({ path: join(DIR, `subida-${nombre}-${tam(info)}.png`) });
  const seeds = semillasCafe(1, 9000);
  const plano5 = { v: 1, items: PLANO_6.items.filter((i) => i.y < 20) };
  const { cafe, c } = await alCafe(page, { nivel: 5, reputacion: 9995, granos: 300, cobrados: [1, 2, 3, 4, 5], plano: plano5 }, seeds);
  await quieto(page);
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  await expect(cafe.locator('.cf3-franja--atender')).toHaveAttribute('data-paso', 'pide');
  // El cliente 1 está arriba: la taza se lleva sin bajar
  const caja = cafe.locator('.cf3-franja--atender');
  const receta = recetaPide({ n: 1, semilla: seeds[0] }, CARTA);
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await page.waitForFunction(() => window.__cafe3d.enBarra());
  const r = { bebida: receta[0], grano: receta[1], leche: receta[2], toque: receta[3] };
  for (const etapa of ETAPAS) {
    await expect(caja).toHaveAttribute('data-etapa', etapa);
    const parte = ELIGE[etapa];
    if (parte) {
      await quieto(page, 200);
      const p = r[parte] === 'frio' || r[parte] === 'vainilla' ? await page.evaluate((x) => window.__cafe3d.barraEnPantalla(x), `barra:${parte}:${r[parte]}`) : null;
      if (p?.front) await page.mouse.click(p.x, p.y);
      else
        await cafe
          .locator('.cf3-opciones')
          .getByRole('button', { name: nombreOpcion(parte, r[parte]), exact: true })
          .click();
    }
    for (const tipo of gestosDe(etapa, r)) await hacerGesto(page, cafe, tipo, { ayuda: false });
  }
  await cafe.getByRole('button', { name: 'Llevársela' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'libro', { timeout: 15000 });
  await cafe.getByRole('button', { name: 'Solo el café' }).click();
  await cafe.getByRole('button', { name: 'Hasta luego' }).click();
  // El cartel: nivel 6, la bodega, 80 tickets y lo que se abre
  const logro = page.locator('.cf3-logro');
  await expect(logro).toBeVisible({ timeout: 9000 });
  await expect(logro).toContainText('La bodega');
  await expect(logro).toContainText('80');
  await expect(logro).toContainText('la trampilla de detrás de la barra');
  expect(c.nivel).toBe(6);
  await page.waitForTimeout(600);
  await foto('cartel');
  await logro.locator('.cf3-logro__ok').click();
  await page.waitForFunction(() => window.__cafe3d.enRecorrido(), null, { timeout: 9000 });
  await page.waitForTimeout(2600);
  await foto('recorrido-trampilla');
  await page.waitForTimeout(2400);
  await foto('recorrido-bodega');
  await page.waitForFunction(() => !window.__cafe3d.enRecorrido(), null, { timeout: 15000 });
  await quieto(page);
  // Ya se puede bajar
  await expect(cafe.locator('.cf3-tags button', { hasText: 'Bajar a la bodega' })).toBeAttached();
  // De vuelta a tu vista, en el café
  expect(await page.evaluate(() => window.__cafe3d.planta())).toBe('calle');
  await foto('despues');
  const video = page.video();
  await page.close();
  if (video && /390x844/.test(info.project.name)) await video.saveAs(join(DIR, `subida-${tam(info)}.webm`));
});
