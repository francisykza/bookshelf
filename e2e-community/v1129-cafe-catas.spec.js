// 1.129 (SPEC §129; docs/qa/cafe-libreria.md §14, bloque 6c, cifras de Francisco del 13-11-2026) · La sala de catas: en el
// nivel 8 la bodega crece por la derecha y hacia delante (cuadrícula de 9 × 6), la escalera se corre a la pared nueva y, al
// fondo, el mostrador de catas; tres muebles nuevos (butaca de cuero, mesa de catas y mapa de cafés). En la barra, el chai con
// especias (machacar en el mortero, cuatro golpes, y la tetera como el té) y el café brûlée (dorar el azúcar con el soplete en
// zigzag, sin soltar). La subida al 8 enseña la sala. El servidor simulado aplica las reglas de
// `20261217120000_cafe_catas.sql`. Capturas y vídeos en qa-report/cafe-catas/.
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
import { cartaDe, umbralHito } from '../src/features/edificio/cafe/cafeNiveles';
import { dayKey } from '../src/domain/dates';

const DIR = join('qa-report', 'cafe-catas');
// El nombre del botón: con té, chai y chocolate, el grano se llama por su hoja, su chai o su cacao
const boton = (parte, valor, bebida) =>
  parte === 'grano' && bebida === 'chai'
    ? valor === 'suave'
      ? 'Chai · suave'
      : 'Chai · intenso'
    : parte === 'grano' && bebida === 'te'
      ? valor === 'suave'
        ? 'Hoja verde · suave'
        : 'Hoja negra · intensa'
      : parte === 'grano' && bebida === 'chocolate'
        ? valor === 'suave'
          ? 'Cacao con leche'
          : 'Cacao negro'
        : nombreOpcion(parte, valor);
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
const REP = umbralHito(8, 2) + 40;
const CARTA = cartaDe(REP);
const SONIDO = { v: 1, on: true, decided: true, legacy: false, effects: 40, ambience: 15, music: 40, master: 80, ambienceId: 'none', musicId: 'tarde', lastAmbience: 'none', lastMusic: 'tarde' };
/** El plano del nivel 7 (el ala, la terraza, la bodega y el tostadero) y, en las columnas y la fila nuevas, lo de la sala de catas. */
const PLANO_7 = {
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
    { uid: 'c1', id: 'cafe-saco', x: -1, y: 23, rot: 0 },
    { uid: 'c2', id: 'cafe-latas', x: -2, y: 24, rot: 2 },
  ],
};
const PLANO_8 = {
  v: 1,
  items: [...PLANO_7.items, { uid: 'd1', id: 'cafe-butaca', x: 6, y: 21, rot: 3 }, { uid: 'd2', id: 'cafe-mapa', x: 6, y: 20, rot: 0 }, { uid: 'd3', id: 'cafe-mesa-catas', x: 4, y: 25, rot: 2 }],
};
const semillas = (s, n) => Array.from({ length: n }, (_, k) => s + k * 7919);
/** Unas semillas en las que el cliente `n` pide un chai con brûlée. */
function semillasChai(n, desde) {
  for (let s = desde; s < desde + 2000000; s += 1000) {
    const r = recetaPide({ n, semilla: semillas(s, 10)[n - 1] }, CARTA);
    if (r[0] === 'chai' && r[3] === 'brulee') return semillas(s, 10);
  }
  throw new Error('ninguna semilla');
}
const sonidos = (page) => page.evaluate(() => window.__cafeSonidos ?? []);

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

async function alCafe(page, estado, seeds) {
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 120, sin_raro: 3 } },
    piso_inventario: { [ANA.id]: { sillon: 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.libraries.push({ user_id: ANA.id, data: { books: LIBROS }, updated_at: new Date().toISOString(), version: 5 });
  await page.addInitScript(
    ({ books, sonido }) => {
      localStorage.setItem('bookshelf:signs-hint-done', 'true');
      localStorage.setItem('bookshelf:sonido:v1', JSON.stringify(sonido));
      if (!localStorage.getItem('bookshelf:v1'))
        localStorage.setItem('bookshelf:v1', JSON.stringify({ books, settings: { sound: true, sfx: true, uiVolume: 0.4 }, progress: { readingLog: [], pomodoros: [], claimed: {} } }));
    },
    { books: LIBROS, sonido: SONIDO },
  );
  await mock.attach(page, ANA);
  const plano = structuredClone(estado.plano ?? PLANO_INICIAL);
  const c = await simularCafe(
    page,
    { inaugurado: true, nombre: 'Taza y Lomo', inventario: cuenta(plano), libros: BALDA, ...estado, plano },
    { clientes: { hoy: HOY, semillas: seeds, quienes: [3], frases: [10] } },
  );
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

/** Bajar a la bodega por la trampilla. */
async function bajar(page, cafe) {
  await page.evaluate(() => window.__cafe3d.place(5.0, 2.7, Math.atan2(9.0 - 5.0, 1.9 - 2.7)));
  await quieto(page);
  await cafe.locator('.cf3-tags button', { hasText: 'Bajar a la bodega' }).click();
  await page.waitForFunction(() => window.__cafe3d.planta() === 'bodega' && !window.__cafe3d.cambiando() && window.__cafe3d.settled(), null, { timeout: 25000 });
  await quieto(page);
}

/** Preparar en la barra la receta `r`, eligiendo tocando el objeto cuando se ve (si no, con su botón). */
async function preparar(page, cafe, r, { foto = null } = {}) {
  const caja = cafe.locator('.cf3-franja--atender');
  for (const etapa of ETAPAS) {
    await expect(caja).toHaveAttribute('data-etapa', etapa);
    const parte = ELIGE[etapa];
    if (parte) {
      await quieto(page, 200);
      const valor = r[parte];
      if (foto && (valor === 'chai' || valor === 'brulee')) await foto(`elige-${valor}`);
      const p = ['chai', 'brulee', 'frio', 'vainilla'].includes(valor) ? await page.evaluate((x) => window.__cafe3d.barraEnPantalla(x), `barra:${parte}:${valor}`) : null;
      if (p?.front) await page.mouse.click(p.x, p.y);
      else
        await cafe
          .locator('.cf3-opciones')
          .getByRole('button', { name: boton(parte, valor, r.bebida), exact: true })
          .click();
      await expect.poll(async () => (await caja.getAttribute('data-receta')).split(',')[['bebida', 'grano', 'leche', 'toque'].indexOf(parte)]).toBe(valor);
    }
    for (const tipo of gestosDe(etapa, r)) await hacerGesto(page, cafe, tipo, { ayuda: false, foto: ['mortero', 'soplete'].includes(tipo) ? foto : null });
  }
  await expect(caja).toHaveAttribute('data-etapa', 'lista');
}

const SOLO = /chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/;

test('nivel 8: la sala de catas abajo, su escalera nueva y Decorar en 9 × 6; en la barra, un chai con brûlée', async ({ page }, info) => {
  test.skip(!SOLO.test(info.project.name), '360, 430, escritorio y 390 (Chromium y WebKit)');
  test.setTimeout(300000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const foto = async (nombre) => page.screenshot({ path: join(DIR, `catas-${nombre}-${tam(info)}.png`) });
  const seeds = semillasChai(1, 4000);
  const { cafe, c } = await alCafe(page, { nivel: 8, reputacion: REP, granos: 1200, cobrados: [1, 2, 3, 4, 5, 6, 7, 8], plano: PLANO_8, tazas: 3, sacoDia: HOY }, seeds);
  await quieto(page);
  // Abajo: se llega al pie de la escalera nueva, en la pared de la derecha
  await bajar(page, cafe);
  await foto('llegada');
  // Mirando a la escalera (se llega de espaldas a ella), su letrero está delante
  await page.evaluate(() => window.__cafe3d.place(48.8, 2.5, Math.atan2(48.85 - 48.8, 5.6 - 2.5)));
  await quieto(page);
  await foto('escalera');
  const subir = await page.evaluate(() => window.__cafe3d.onScreen('subir'));
  expect(subir.front).toBe(true);
  // La sala, de punta a punta: el tostador a la izquierda y la sala de catas a la derecha, con su mostrador al fondo
  await page.evaluate(() => window.__cafe3d.place(42.0, 6.6, Math.atan2(47.6 - 42.0, -0.4 - 6.6)));
  await quieto(page);
  await foto('sala');
  await page.evaluate(() => window.__cafe3d.place(45.0, 3.4, Math.atan2(47.0 - 45.0, -0.6 - 3.4)));
  await quieto(page);
  await foto('mostrador');
  // Decorar abajo: la cuadrícula de 9 × 6 con la butaca, el mapa y la mesa de catas
  await cafe.getByRole('button', { name: /^Decorar/ }).click();
  await expect(cafe.getByRole('group', { name: 'Qué planta decoras' }).getByRole('button', { name: 'La bodega' })).toHaveAttribute('aria-pressed', 'true');
  await quieto(page);
  const esquina = await page.evaluate(() => [window.__cafe3d.casillaEnPantalla(6, 25), window.__cafe3d.casillaEnPantalla(-2, 20)]);
  const vp = page.viewportSize();
  for (const p of esquina) {
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(vp.width);
    expect(p.y).toBeGreaterThan(0);
  }
  await foto('decorar');
  await cafe.getByRole('tab', { name: /^Tienda/ }).click();
  const tienda = cafe.locator('.cf3-tienda');
  await expect(tienda.getByRole('button', { name: /^Comprar Butaca de cuero por 300 granos/ })).toBeEnabled();
  await expect(tienda.getByRole('button', { name: /^Comprar Mesa de catas por 360 granos/ })).toBeEnabled();
  await expect(tienda.getByRole('button', { name: /^Comprar Mapa de cafés por 400 granos/ })).toBeEnabled();
  await foto('tienda');
  await cafe.getByRole('button', { name: 'Listo' }).click();
  await quieto(page);
  // Arriba por la escalera nueva
  await cafe.getByRole('button', { name: 'Subir al café', exact: true }).click();
  await page.waitForFunction(() => window.__cafe3d.planta() === 'calle' && !window.__cafe3d.cambiando() && window.__cafe3d.settled(), null, { timeout: 25000 });
  await quieto(page);
  // El cliente 1 pide un chai con brûlée
  await cafe.locator('.cf3-tag--cliente:not([data-off="true"])').first().waitFor();
  const receta = recetaPide({ n: 1, semilla: seeds[0] }, CARTA);
  expect([receta[0], receta[3]]).toEqual(['chai', 'brulee']);
  await page.evaluate(() => window.__cafe3d.place(6.9, 10.2, Math.PI + 0.78));
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  const caja = cafe.locator('.cf3-franja--atender');
  await expect(caja).toHaveAttribute('data-paso', 'pide');
  await expect(cafe.locator('.cf3-comanda')).toContainText('chai');
  await expect(cafe.locator('.cf3-comanda')).toContainText('brûlée');
  await foto('comanda');
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await page.waitForFunction(() => window.__cafe3d.enBarra());
  const r = { bebida: receta[0], grano: receta[1], leche: receta[2], toque: receta[3] };
  await preparar(page, cafe, r, { foto });
  await quieto(page, 400);
  await foto('lista');
  expect(await sonidos(page)).toEqual(expect.arrayContaining(['mortero', 'machaca', 'azucarero', 'chispa']));
  await cafe.getByRole('button', { name: 'Llevársela' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'libro', { timeout: 20000 });
  await cafe.getByRole('button', { name: 'Solo el café' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'gracias');
  await page.waitForTimeout(900);
  const logro = page.locator('.cf3-logro');
  if (await logro.isVisible()) await logro.locator('.cf3-logro__ok').click();
  await foto('gracias');
  await cafe.getByRole('button', { name: 'Hasta luego' }).click();
  expect(errors).toEqual([]);
  const video = page.video();
  await page.close();
  if (video && /390x844/.test(info.project.name)) await video.saveAs(join(DIR, `catas-${tam(info)}.webm`));
});

test('subir al nivel 8: el cartel de la sala de catas y su recorrido', async ({ page }, info) => {
  test.skip(!/chromium-390x844$|webkit-390x844$/.test(info.project.name), 'a 390');
  test.setTimeout(180000);
  mkdirSync(DIR, { recursive: true });
  const foto = async (nombre) => page.screenshot({ path: join(DIR, `subida-${nombre}-${tam(info)}.png`) });
  const seeds = semillas(9000, 10);
  const { cafe, c } = await alCafe(page, { nivel: 7, reputacion: 20995, granos: 300, cobrados: [1, 2, 3, 4, 5, 6, 7], plano: PLANO_7, tazas: 0, sacoDia: HOY }, seeds);
  await quieto(page);
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  const caja = cafe.locator('.cf3-franja--atender');
  await expect(caja).toHaveAttribute('data-paso', 'pide');
  const receta = recetaPide({ n: 1, semilla: seeds[0] }, cartaDe(20995));
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await page.waitForFunction(() => window.__cafe3d.enBarra());
  await preparar(page, cafe, { bebida: receta[0], grano: receta[1], leche: receta[2], toque: receta[3] });
  await cafe.getByRole('button', { name: 'Llevársela' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'libro', { timeout: 20000 });
  await cafe.getByRole('button', { name: 'Solo el café' }).click();
  await cafe.getByRole('button', { name: 'Hasta luego' }).click();
  // El cartel: nivel 8, la sala de catas, 100 tickets y lo que se abre
  const logro = page.locator('.cf3-logro');
  await expect(logro).toBeVisible({ timeout: 9000 });
  await expect(logro).toContainText('La sala de catas');
  await expect(logro).toContainText('100');
  await expect(logro).toContainText('la bodega crece hacia la derecha');
  expect(c.nivel).toBe(8);
  await page.waitForTimeout(600);
  await foto('cartel');
  await logro.locator('.cf3-logro__ok').click();
  await page.waitForFunction(() => window.__cafe3d.enRecorrido(), null, { timeout: 9000 });
  await page.waitForTimeout(2300);
  await foto('recorrido-escalera');
  await page.waitForTimeout(1500);
  await foto('recorrido-catas');
  await page.waitForFunction(() => !window.__cafe3d.enRecorrido(), null, { timeout: 15000 });
  await quieto(page);
  const video = page.video();
  await page.close();
  if (video && /390x844/.test(info.project.name)) await video.saveAs(join(DIR, `subida-${tam(info)}.webm`));
});
