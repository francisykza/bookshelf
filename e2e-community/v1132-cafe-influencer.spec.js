// 1.132 (SPEC §132; docs/qa/cafe-libreria.md §16.2, Francisco, 14-11-2026) · Fuera la pizarra y el influencer de cada nivel:
// - Con la barra llena, el café está «a punto de subir» y llega el influencer de la subida (300 + nivel), con su accesorio, su
//   luz «REC» y su comanda en directo. Al ir a la barra se da la vuelta al reloj de arena (sin números; con movimiento
//   reducido, una barra quieta). Siempre a mano: Pilar no se ofrece. El nivel sube al despedirle, salga como salga.
// - A tiempo y con 3 estrellas, el vídeo se hace viral: al día siguiente, 3 clientes más por su vídeo y su foto firmada en la
//   pared de la derecha. Con la arena acabada, paga como un cliente normal y el nivel sube igual.
// Capturas y vídeos en qa-report/v1132/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { hacerGesto, quieto } from './cafeBarra';
import { hacerLibro, pideLibro } from './cafeLibro';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { generoDe, nombreOpcion, recetaPide } from '../src/features/edificio/cafe/cafeClientes';
import { ELIGE, ETAPAS, gestosDe } from '../src/features/edificio/cafe/cafeGestos';
import { INFLUENCERS, saludoViral } from '../src/features/edificio/cafe/cafeInfluencers';
import { cartaDe, desdeNivel } from '../src/features/edificio/cafe/cafeNiveles';
import { dayKey } from '../src/domain/dates';

const DIR = join('qa-report', 'v1132');
const tam = (info) => info.project.name.replace(/^(chromium|webkit)-/, '$1-');
const HOY = dayKey();
const AYER = dayKey(new Date(Date.now() - 864e5));
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
  libro('f', 'El dragón del muelle', { categories: ['Fantasy'], pageCount: 540 }),
  libro('f2', 'La bruja del faro', { categories: ['Fantasy'], pageCount: 210 }),
  libro('m', 'Crimen en la lonja', { categories: ['Mystery'], pageCount: 280 }),
  libro('m2', 'El caso del ancla', { categories: ['Mystery'], pageCount: 460 }),
  libro('a', 'Cartas de amor al puerto', { categories: ['Romance'], pageCount: 190 }),
  libro('s', 'Naves sobre la bahía', { categories: ['Science Fiction'], pageCount: 610 }),
  libro('c', 'Cuentos del tranvía', { pageCount: 120 }),
  libro('p', 'Versos de sal', { categories: ['Poetry'], pageCount: 96 }),
];
const BALDA = { bienvenida: true, libros: LIBROS.map((b) => ({ clave: b.id, titulo: b.title, genero: generoDe(b), caja: 0, balda: 1 })) };
const SEMILLAS = [2100, 1000, 8919];
const BLOGUERA = INFLUENCERS[2];

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

/** Al café con la barra como se diga (`estado`, lo del simulador) y el influencer en el servidor simulado (`influencer`). */
async function alCafe(page, { estado = {}, influencer = {} } = {}) {
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
  const c = await simularCafe(
    page,
    { inaugurado: true, nombre: 'Taza y Lomo', granos: 30, plano: structuredClone(PLANO_INICIAL), inventario: cuenta(PLANO_INICIAL), libros: BALDA, ...estado },
    { clientes: { hoy: HOY, semillas: SEMILLAS, quienes: [3], frases: [10], influencer } },
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
  return { cafe, estado: c };
}

const BOTON = (parte, valor, receta) => (parte === 'grano' && receta[0] === 'te' ? (valor === 'suave' ? 'Hoja verde · suave' : 'Hoja negra · intensa') : nombreOpcion(parte, valor));
const ELIGE_DE = { bebida: 0, grano: 1, leche: 2, toque: 3 };

/** El reloj de la página, adelantado `ms` (0: el de verdad). Solo lo mira el reloj de arena (y la caché de portadas). */
const adelantar = (page, ms) =>
  page.evaluate((ms) => {
    window.__ahoraReal ??= Date.now;
    const real = window.__ahoraReal;
    Date.now = ms ? () => real() + ms : real;
  }, ms);

/** Prepara `receta` a mano, con los gestos; Pilar no se ofrece nunca. `enEtapa(etapa)`: antes de cada paso de la barra. */
async function preparar(page, cafe, receta, { enEtapa = null, foto = null } = {}) {
  const caja = cafe.locator('.cf3-franja--atender');
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'barra');
  await page.waitForFunction(() => window.__cafe3d.enBarra());
  for (const etapa of ETAPAS) {
    await expect(caja).toHaveAttribute('data-etapa', etapa, { timeout: 8000 });
    await enEtapa?.(etapa);
    if (ELIGE[etapa]) {
      const k = ELIGE_DE[etapa];
      await cafe
        .locator('.cf3-opciones')
        .getByRole('button', { name: BOTON(etapa, receta[k], receta), exact: true })
        .click();
      await expect.poll(async () => (await caja.getAttribute('data-receta')).split(',')[k]).toBe(receta[k]);
      if (etapa === 'bebida') await expect(cafe.locator('.cf3-pilar')).toHaveCount(0);
    }
    const r = { bebida: receta[0], grano: receta[1], leche: receta[2], toque: receta[3] };
    for (const tipo of gestosDe(etapa, r)) await hacerGesto(page, cafe, tipo, { foto });
  }
  await expect(caja).toHaveAttribute('data-etapa', 'lista', { timeout: 8000 });
  expect(await caja.getAttribute('data-receta')).toBe(receta.join());
  await quieto(page, 300);
  await cafe.getByRole('button', { name: 'Llevársela' }).click();
}

/** «Hasta luego» y, si sale, el cartel de la subida: su texto (con captura antes de cerrarlo). */
async function despedirConLogro(page, cafe, foto) {
  await cafe.getByRole('button', { name: 'Hasta luego' }).click();
  const logro = page.locator('.cf3-logro');
  await logro.waitFor({ state: 'visible', timeout: 4000 });
  await quieto(page, 700);
  await foto?.();
  const texto = await logro.textContent();
  await logro.locator('.cf3-logro__ok').click();
  await expect(logro).toBeHidden();
  return texto;
}

/** La pared de la derecha, de frente, donde cuelgan las fotos firmadas. */
async function mirarFotos(page) {
  // Si acaba de subir de nivel, primero termina el recorrido de cámara (enseña lo nuevo y vuelve a tu vista)
  await page.waitForTimeout(400);
  await page.waitForFunction(() => !window.__cafe3d.enRecorrido(), null, { timeout: 30000 });
  await page.evaluate(() => window.__cafe3d.place(6.6, 9.3, Math.PI / 2));
  await page.waitForFunction(() => window.__cafe3d.settled());
  await quieto(page, 600);
}

test('la Bloguera del Muelle: llega con la barra llena, el reloj de arena, a tiempo y viral; el café sube y cuelga su foto', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844)$/.test(info.project.name), '360 y 390');
  test.setTimeout(300000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const foto = (nombre) => page.screenshot({ path: join(DIR, `${nombre}-${tam(info)}.png`) });
  const umbral = desdeNivel(2);
  const { cafe, estado } = await alCafe(page, { estado: { nivel: 1, reputacion: umbral - 1, espera: 25, dominio: { cafe: 12, te: 12 } }, influencer: { segundos: 95 } });
  const caja = cafe.locator('.cf3-franja--atender');

  // La barra, llena y esperando; Pilar lo cuenta
  const placa = cafe.locator('.cf3-placa');
  await expect(placa).toHaveAttribute('data-sube', 'true');
  await expect(placa.locator('.cf3-xp__cifra')).toHaveText('¡A punto de subir!');
  await expect(placa).toHaveAttribute('aria-label', /¡A punto de subir de nivel!/);
  await expect(cafe.locator('.cf3-dice')).toContainText('y la Bloguera del Muelle viene a grabar tu café. Cuando le despidas, el café subirá de nivel.');
  const tag = cafe.getByRole('button', { name: 'Atender a La Bloguera del Muelle' });
  await expect(tag).toHaveClass(/cf3-tag--influencer/);
  await quieto(page, 900);
  await foto('1-llega');

  // Su comanda, en directo
  await tag.click();
  await expect(caja).toHaveAttribute('data-paso', 'pide');
  await expect(caja).toHaveAttribute('data-influencer', '2');
  await expect(cafe.locator('.cf3-comanda--influencer')).toBeVisible();
  await expect(cafe.getByLabel('La comanda de La Bloguera del Muelle, en directo')).toBeVisible();
  await expect(cafe.locator('.cf3-comanda .cf3-rec')).toHaveText('REC');
  await expect(caja.locator('.cf3-dice')).toContainText(BLOGUERA.saludo);
  const pide = await pideLibro(cafe);
  expect(pide).toMatchObject({ extension: BLOGUERA.libro.extension, forma: BLOGUERA.libro.forma });
  await expect(cafe.locator('.cf3-arena')).toHaveCount(0);
  await expect(cafe.getByRole('button', { name: 'A la barra: se da la vuelta al reloj de arena' })).toBeVisible();
  await quieto(page, 400);
  await foto('2-comanda');

  // A la barra, a mano: el reloj de arena se da la vuelta (el servidor apunta la hora) y cae mientras se prepara
  const arena = cafe.locator('.cf3-arena');
  await preparar(page, cafe, BLOGUERA.pide, {
    enEtapa: async (etapa) => {
      if (etapa === 'bebida') {
        expect(estado.llamadas.filter((l) => l.rpc === 'cafe_influencer_empezar').map((l) => l.body)).toEqual([{ dia: HOY, nivel: 2 }]);
        await expect(arena).toBeVisible();
        await expect(arena).toHaveAttribute('aria-label', 'El reloj de arena acaba de empezar');
        await expect(caja).toHaveAttribute('data-arena', 'true');
        await quieto(page, 500);
        await foto('3-barra-arena');
      }
      if (etapa === 'leche') {
        // Para la captura, el reloj de la página avanza 75 s (media arena) y vuelve
        await adelantar(page, 75000);
        await expect.poll(async () => Number(await arena.getAttribute('data-queda'))).toBeLessThan(60);
        await page.waitForTimeout(400);
        await foto('4-arena-a-medias');
        expect(await arena.textContent()).not.toMatch(/\d/);
        await adelantar(page, 0);
      }
    },
  });
  // En la librería, el reloj sigue a la vista
  await expect(caja).toHaveAttribute('data-paso', 'libreria');
  await expect(arena).toBeVisible();
  await hacerLibro(page, cafe, { foto: (n) => (n === 'estanteria' ? foto('5-libreria-arena') : null) });
  await expect(caja).toHaveAttribute('data-paso', 'gracias', { timeout: 20000 });

  // A tiempo y con 3 estrellas: viral
  await expect(cafe.getByRole('img', { name: '3 de 3 estrellas' })).toBeVisible();
  await expect(arena).toHaveCount(0);
  const publica = cafe.locator('.cf3-publica');
  await expect(publica).toHaveAttribute('data-viral', 'true');
  await expect(publica).toHaveAttribute('data-a-tiempo', 'true');
  await expect(publica.locator('.cf3-publica__titulo')).toContainText(BLOGUERA.publica);
  await expect(publica.locator('li[data-tipo="clientes"]')).toHaveText('Mañana vendrán 3 clientes por su vídeo');
  await expect(publica.locator('li[data-tipo="foto"]')).toHaveText('Foto firmada para tu pared');
  await expect(caja.locator('.cf3-dice')).toContainText('¡Esto se va a hacer viral!');
  await quieto(page, 500);
  await foto('6-viral');

  // Al despedirle, el café sube (con la reputación que esperaba) y el cartel dice de quién fue el vídeo
  const logro = await despedirConLogro(page, cafe, () => foto('7-sube'));
  expect(logro).toContain(`La Bloguera del Muelle ha publicado «${BLOGUERA.publica}», y se está haciendo viral.`);
  expect(estado.nivel).toBe(2);
  expect(estado.espera).toBe(0);
  expect(estado.reputacion).toBeGreaterThan(umbral + 25);
  await expect(placa).not.toHaveAttribute('data-sube', 'true');
  const entrega = estado.llamadas.filter((l) => l.rpc === 'cafe_influencer_entregar').map((l) => l.body);
  expect(entrega).toHaveLength(1);
  expect(entrega[0]).toMatchObject({ dia: HOY, nivel: 2, receta: BLOGUERA.pide });
  expect(estado.llamadas.filter((l) => ['cafe_entregar', 'cafe_servir'].includes(l.rpc))).toHaveLength(0);
  // Ya no es un cliente pendiente: su etiqueta se va; la foto firmada, en la pared
  await expect(tag).toHaveCount(0);
  await mirarFotos(page);
  await foto('8-foto-en-la-pared');
  expect(errors).toEqual([]);
  const video = page.video();
  await page.close();
  if (video) await video.saveAs(join(DIR, `influencer-viral-${tam(info)}.webm`));
});

test('con movimiento reducido y la arena acabada: el reloj es una barra quieta, paga como un cliente y el nivel sube igual', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844)$/.test(info.project.name), '360 y 390');
  test.setTimeout(240000);
  mkdirSync(DIR, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const foto = (nombre) => page.screenshot({ path: join(DIR, `${nombre}-${tam(info)}.png`) });
  const { cafe, estado } = await alCafe(page, { estado: { nivel: 1, reputacion: desdeNivel(2) - 1, espera: 10 }, influencer: { segundos: 200 } });
  const caja = cafe.locator('.cf3-franja--atender');
  const arena = cafe.locator('.cf3-arena');
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  await expect(caja).toHaveAttribute('data-influencer', '2');
  await preparar(page, cafe, BLOGUERA.pide, {
    enEtapa: async (etapa) => {
      if (etapa === 'bebida') {
        await expect(arena).toHaveAttribute('data-quieto', 'true');
        await quieto(page, 300);
        await foto('9-reducido-barra-llena');
        // Se entretiene: el reloj de la página avanza 165 s y la arena se acaba (sin alarmas)
        await adelantar(page, 165000);
        await expect(arena).toHaveAttribute('data-vacia', 'true', { timeout: 4000 });
        await expect(arena).toHaveAttribute('aria-label', 'Se ha acabado la arena');
        await foto('10-reducido-arena-acabada');
      }
    },
  });
  await hacerLibro(page, cafe, { reducido: true });
  await expect(caja).toHaveAttribute('data-paso', 'gracias', { timeout: 15000 });
  const publica = cafe.locator('.cf3-publica');
  await expect(publica).toHaveAttribute('data-a-tiempo', 'false');
  await expect(publica).not.toHaveAttribute('data-viral', 'true');
  await expect(publica.locator('.cf3-publica__viral')).toHaveCount(0);
  await expect(caja.locator('.cf3-dice')).toContainText('¡Se me acabó el directo!');
  await quieto(page, 300);
  await foto('11-reducido-sin-viral');
  await adelantar(page, 0);
  const logro = await despedirConLogro(page, cafe, () => foto('12-reducido-sube'));
  expect(logro).toContain('La Bloguera del Muelle ha publicado');
  expect(logro).not.toContain('viral');
  expect(estado.nivel).toBe(2);
  expect(estado.influencers[2]).toMatchObject({ despedido: true, a_tiempo: false, viral: false, segundos: 200 });
  expect(errors).toEqual([]);
  const video = page.video();
  await page.close();
  if (video && /390x844/.test(info.project.name)) await video.saveAs(join(DIR, `influencer-reducido-${tam(info)}.webm`));
});

test('al día siguiente del vídeo viral: tres clientes que vienen por él y la foto firmada en la pared', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), '390');
  test.setTimeout(240000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const foto = (nombre) => page.screenshot({ path: join(DIR, `${nombre}-${tam(info)}.png`) });
  const { cafe, estado } = await alCafe(page, {
    estado: { nivel: 2, reputacion: desdeNivel(2) + 40, cobrados: [1, 2], influencers: { 2: { despedido: true, dia: AYER, estrellas: 3, a_tiempo: true, viral: true, segundos: 95, orden: 1 } } },
  });
  const caja = cafe.locator('.cf3-franja--atender');
  // Sin influencer hoy (el del 2 ya se fue y la barra del 2 no está llena): los virales, al final de la fila
  await expect(cafe.locator('.cf3-placa')).not.toHaveAttribute('data-sube', 'true');
  await expect(cafe.locator('.cf3-tag--influencer')).toHaveCount(0);
  await mirarFotos(page);
  await foto('13-foto-al-dia-siguiente');
  const dia = estado.llamadas.find((l) => l.rpc === 'cafe_dia');
  expect(dia).toBeTruthy();
  // Uno de los que vienen por el vídeo (el 201): su etiqueta es la de cualquier cliente; se le atiende tocándole
  const tags = cafe.locator('.cf3-tag--cliente');
  const n = await tags.count();
  expect(n).toBeGreaterThanOrEqual(3);
  // (puede quedar fuera de la vista: se toca su etiqueta igual que con el dedo, sin buscarla)
  await tags.nth(n - 3).evaluate((el) => el.click());
  await expect(caja).toHaveAttribute('data-paso', 'pide');
  await expect(caja).toHaveAttribute('data-viral', 'true');
  await expect(caja.locator('.cf3-dice')).toContainText(saludoViral(2));
  expect(saludoViral(2)).toBe('¡Hola! Vengo por el vídeo de la Bloguera del Muelle. ¿Me pones esto?');
  await quieto(page, 400);
  await foto('14-viene-por-el-video');
  // Pide de la carta, como cualquiera, y paga como un cliente
  const r = recetaPide({ n: 201, semilla: 1000 + 30 * 7919 }, cartaDe(desdeNivel(2) + 40));
  await preparar(page, cafe, r);
  await hacerLibro(page, cafe);
  await expect(caja).toHaveAttribute('data-paso', 'gracias', { timeout: 20000 });
  const entrega = estado.llamadas.filter((l) => l.rpc === 'cafe_entregar').map((l) => l.body);
  expect(entrega.map((b) => b.cliente)).toEqual([201]);
  await quieto(page, 300);
  await foto('15-viral-servido');
  expect(errors).toEqual([]);
  const video = page.video();
  await page.close();
  if (video) await video.saveAs(join(DIR, `virales-${tam(info)}.webm`));
});
