// 1.133.1 (Francisco, 15-11-2026: «si pulsas un sitio de la sala puedas ir a el, ahora mismo no siempre hace esa función») · Al
// tocar un sitio del café se llega andando aunque haya algo en medio (se rodea el mostrador o las mesas) y, si se toca un mueble
// o la pared, se llega a su lado. Antes se andaba en línea recta y se paraba en lo primero que había. Vídeos en qa-report/v1133-1/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { quieto } from './cafeBarra';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { dentro, libreEntre, ruta } from '../src/features/edificio/cafe/cafeLayout';
import { generoDe } from '../src/features/edificio/cafe/cafeClientes';
import { dayKey } from '../src/domain/dates';
import { alEdificio } from './entrada';

const DIR = join('qa-report', 'v1133-1');
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
const LIBROS = [libro('f', 'El dragón del muelle', { categories: ['Fantasy'] }), libro('m', 'Crimen en la lonja', { categories: ['Mystery'] })];
const BALDA = { bienvenida: true, libros: LIBROS.map((b) => ({ clave: b.id, titulo: b.title, genero: generoDe(b), caja: 0, balda: 1 })) };
const semillas = (s, n) => Array.from({ length: n }, (_, k) => s + k * 7919);

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

async function alCafe(page) {
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 120, sin_raro: 3 } },
    piso_inventario: { [ANA.id]: { sillon: 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.libraries.push({ user_id: ANA.id, data: { books: LIBROS }, updated_at: new Date().toISOString(), version: 5 });
  await page.addInitScript((books) => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!localStorage.getItem('bookshelf:v1'))
      localStorage.setItem('bookshelf:v1', JSON.stringify({ books, settings: { sound: false }, progress: { readingLog: [], pomodoros: [], claimed: {} } }));
  }, LIBROS);
  await mock.attach(page, ANA);
  const plano = structuredClone(PLANO_INICIAL);
  await simularCafe(
    page,
    { inaugurado: true, nombre: 'Taza y Lomo', inventario: cuenta(plano), libros: BALDA, nivel: 3, reputacion: 1100, granos: 30, cobrados: [1, 2, 3], plano },
    { clientes: { hoy: HOY, semillas: semillas(2100, 5), quienes: [3], frases: [10] } },
  );
  await page.goto('/');
  await alEdificio(page);
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' }).click({ timeout: 15000 });
  const cafe = page.getByRole('dialog', { name: 'El café-librería del bajo' });
  await expect(cafe.locator('.cf3[data-ready="true"]')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__cafe3d?.settled() && window.__cafe3d.renders() > 0);
  // Los datos del día pueden llegar justo después y volver a colocar al jugador: se espera a que pase
  await page.waitForTimeout(1500);
  await quieto(page);
  return cafe;
}

/**
 * Un mueble de lo colocado con suelo libre delante y detrás, que corta la línea recta entre los dos: [salida, llegada], con la
 * llegada lo bastante lejos para que, desde los ojos, se vea el suelo por encima del mueble.
 */
const llega = (camino, b) => Boolean(camino) && Math.hypot(camino.at(-1).x - b.x, camino.at(-1).y - b.y) < 0.05;
function casosDeMueble(op) {
  const casos = [];
  for (const [x0, y0, , x1, y1] of op.muebles) {
    const c = [(x0 + x1) / 2, (y0 + y1) / 2];
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const medio = dx ? (x1 - x0) / 2 : (y1 - y0) / 2;
      for (const lejos of [3.4, 2.8, 2.3, 1.8]) {
        const a = { x: c[0] - dx * (medio + 0.75), y: c[1] - dy * (medio + 0.75) };
        const b = { x: c[0] + dx * (medio + lejos), y: c[1] + dy * (medio + lejos) };
        if (dentro(a.x, a.y, op) && dentro(b.x, b.y, op) && !libreEntre(a.x, a.y, b.x, b.y, op) && llega(ruta(a.x, a.y, b.x, b.y, op), b)) casos.push([a, b, Math.atan2(dx, dy)]);
      }
    }
  }
  // Primero los que acaban en medio del local (lejos de las paredes): se ve mejor el rodeo
  const enMedio = ([, b]) => (b.x > 1.2 && b.x < 6.6 && b.y > 5 && b.y < 9.6 ? 0 : 1);
  return casos.sort((p, q) => enMedio(p) - enMedio(q));
}

/** Se pone en (x, y) mirando a `yaw` y toca en la pantalla el punto del mundo (tx, ty, tz); devuelve dónde lo tocó. */
async function tocar(page, [x, y, yaw], [tx, ty, tz]) {
  await expect(async () => {
    await page.evaluate(([a, b, c]) => window.__cafe3d.place(a, b, c), [x, y, yaw]);
    await quieto(page, 300);
    const p = await page.evaluate(() => window.__cafe3d.pose());
    expect(Math.hypot(p.x - x, p.y - y)).toBeLessThan(0.01);
  }).toPass({ timeout: 15000 });
  const s = await page.evaluate(([a, b, c]) => window.__cafe3d.punto(a, b, c), [tx, ty, tz]);
  expect(s.front).toBe(true);
  expect(s.x).toBeGreaterThan(0);
  expect(s.x).toBeLessThan(390);
  // Que el toque no caiga en un cliente ni en un sitio que se abra (eso no es andar)
  const bajo = await page.evaluate(([a, b]) => window.__cafe3d.sueloEn(a, b), [s.x, s.y]);
  expect(bajo?.pick ?? null).toBeNull();
  await page.mouse.click(s.x, s.y);
  return s;
}

test('tocar un sitio de la sala: rodea lo que hay en medio, llega al lado de un mueble y del techo no se mueve', async ({ page }, info) => {
  test.skip(!/chromium-(390x844|360x800)$/.test(info.project.name), 'a 360 y 390');
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await alCafe(page);
  const foto = (n) => page.screenshot({ path: join(DIR, `${tam(info)}-${n}.png`) });

  // 1) Delante de una mesa (o una silla) colocada, el suelo de detrás: en línea recta se chocaba con ella y no se movía
  const op = await page.evaluate(() => window.__cafe3d.pasos());
  let caso = null;
  for (const [a, b, yaw] of casosDeMueble(op)) {
    await page.evaluate(([x, y, w]) => window.__cafe3d.place(x, y, w), [a.x, a.y, yaw]);
    await quieto(page, 200);
    const s = await page.evaluate(([x, y]) => window.__cafe3d.punto(x, y, 0), [b.x, b.y]);
    // Que se vea, por encima de la nota de Pilar, y que no sea un sitio ni un cliente
    if (!s.front || s.x < 20 || s.x > 370 || s.y < 150 || s.y > 660) continue;
    const bajo = await page.evaluate(([x, y]) => window.__cafe3d.sueloEn(x, y), [s.x, s.y]);
    if (bajo?.pick) continue;
    // Y que se vea el suelo de allí, no el mueble que tapa
    const lleva = await page.evaluate(([x, y]) => window.__cafe3d.toqueEn(x, y), [s.x, s.y]);
    if (!lleva || lleva.mueble || Math.hypot(lleva.x - b.x, lleva.y - b.y) > 0.2) continue;
    caso = [a, b, yaw];
    break;
  }
  expect(caso).not.toBeNull();
  const [a, b, yaw] = caso;
  await tocar(page, [a.x, a.y, yaw], [b.x, b.y, 0]);
  await foto('1-toque-tras-la-mesa');
  await page.waitForTimeout(600);
  await foto('2-rodeando');
  await quieto(page);
  let p = await page.evaluate(() => window.__cafe3d.pose());
  // Antes se quedaba en la salida, delante del mueble; ahora llega
  expect(Math.hypot(p.x - b.x, p.y - b.y)).toBeLessThan(0.6);
  await foto('3-llegada');

  // 2) Encima de un mueble (su tapa): se llega a su lado, por donde se viene, y se mira hacia él
  let mesa = null;
  for (const [x0, y0, , x1, y1] of op.muebles) {
    const c = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const a = { x: c.x - dx * 2.6, y: c.y - dy * 2.6 };
      if (!dentro(a.x, a.y, op)) continue;
      const yawM = Math.atan2(dx, dy);
      await page.evaluate(([x, y, w]) => window.__cafe3d.place(x, y, w), [a.x, a.y, yawM]);
      await quieto(page, 200);
      const s = await page.evaluate(([x, y]) => window.__cafe3d.punto(x, y, 0.72), [c.x, c.y]);
      if (!s.front || s.x < 20 || s.x > 370 || s.y < 150 || s.y > 660) continue;
      const bajo = await page.evaluate(([x, y]) => window.__cafe3d.sueloEn(x, y), [s.x, s.y]);
      const lleva = await page.evaluate(([x, y]) => window.__cafe3d.toqueEn(x, y), [s.x, s.y]);
      if (bajo?.pick || !lleva?.mueble) continue;
      mesa = { a, c, yaw: yawM, caja: [x0, y0, x1, y1] };
      break;
    }
    if (mesa) break;
  }
  expect(mesa).not.toBeNull();
  await tocar(page, [mesa.a.x, mesa.a.y, mesa.yaw], [mesa.c.x, mesa.c.y, 0.72]);
  await quieto(page);
  p = await page.evaluate(() => window.__cafe3d.pose());
  const [mx0, my0, mx1, my1] = mesa.caja;
  // Pegado al mueble (a menos de un paso de su borde), en un sitio libre, del lado por el que se venía, y mirándolo
  const borde = Math.hypot(Math.max(mx0 - p.x, 0, p.x - mx1), Math.max(my0 - p.y, 0, p.y - my1));
  expect(borde).toBeLessThan(0.9);
  expect(dentro(p.x, p.y, op)).toBe(true);
  expect(Math.hypot(p.x - mesa.a.x, p.y - mesa.a.y)).toBeLessThan(2.6);
  expect(Math.cos(p.yaw - Math.atan2(mesa.c.x - p.x, mesa.c.y - p.y))).toBeGreaterThan(0.9);
  await foto('4-junto-a-la-mesa');

  // 3) El techo: nada
  await page.evaluate(() => window.__cafe3d.place(4.2, 7.5, 0));
  await quieto(page, 300);
  const techo = await page.evaluate(() => window.__cafe3d.punto(4.2, 9.5, 5.0));
  if (techo.front && techo.y > 0) {
    await page.mouse.click(techo.x, techo.y);
    await page.waitForTimeout(900);
    p = await page.evaluate(() => window.__cafe3d.pose());
    expect(Math.hypot(p.x - 4.2, p.y - 7.5)).toBeLessThan(0.01);
  }
  expect(errors).toEqual([]);
});
