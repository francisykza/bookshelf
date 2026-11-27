// 1.139 (SPEC §139; docs/qa/cafe-libreria.md §17, Francisco, 16-11-2026) · De dónde salen los libros del café:
// - Sin haber leído nada, el café tiene libros: la caja de bienvenida y el reparto de la mañana (gratis, 6 en el nivel 1, sin
//   pasar de los huecos libres) traen del catálogo del café, y la distribuidora lo enseña entero, por géneros.
// - Tus leídos se suman al catálogo con el sello «Leído por ti» (la cinta granate en el lomo y la etiqueta en la
//   distribuidora); el reparto trae uno tuyo de cada tres y el ejemplar tuyo que se lleva el cliente paga 6 («lo recomiendas tú»).
// Capturas y vídeos en qa-report/cafe-catalogo/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { despedir, quieto } from './cafeBarra';
import { hacerLibro, pideLibro } from './cafeLibro';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { GENEROS, generoDe, nombreOpcion, recetaPide } from '../src/features/edificio/cafe/cafeClientes';
import { CATALOGO_LIBROS } from '../src/features/edificio/cafe/cafeCatalogoLibros';
import { ELIGE, ETAPAS, gestosDe } from '../src/features/edificio/cafe/cafeGestos';
import { dayKey } from '../src/domain/dates';
import { alEdificio } from './entrada';

const DIR = join('qa-report', 'cafe-catalogo');
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
const SEMILLAS = [2100, 1000, 8919];
// La app añade estos dos de ejemplo a una biblioteca guardada sin versión: aquí van por leer, para que no cuenten como leídos
const DE_EJEMPLO = [libro('alas-sangre', 'Alas de Sangre', { status: 'want' }), libro('mistborn', 'Nacidos de la bruma', { status: 'want' })];
const PIDE1 = recetaPide({ n: 1, semilla: SEMILLAS[0] });

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

async function alCafe(page, { books, libros, granos = 0, dominio = {} }) {
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 120, sin_raro: 3 } },
    piso_inventario: { [ANA.id]: { sillon: 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  books = [...books, ...DE_EJEMPLO];
  mock.db.libraries.push({ user_id: ANA.id, data: { books }, updated_at: new Date().toISOString(), version: 5 });
  await page.addInitScript((b) => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!localStorage.getItem('bookshelf:v1')) localStorage.setItem('bookshelf:v1', JSON.stringify({ books: b, progress: { readingLog: [], pomodoros: [], claimed: {} } }));
  }, books);
  await mock.attach(page, ANA);
  const estado = await simularCafe(
    page,
    { inaugurado: true, nombre: 'Taza y Lomo', granos, plano: structuredClone(PLANO_INICIAL), inventario: cuenta(PLANO_INICIAL), libros, dominio },
    { clientes: { hoy: HOY, semillas: SEMILLAS, quienes: [3], frases: [10], reparto: true } },
  );
  await page.goto('/');
  await alEdificio(page);
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' }).click({ timeout: 15000 });
  const cafe = page.getByRole('dialog', { name: 'El café-librería del bajo' });
  await expect(cafe.locator('.cf3[data-ready="true"]')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__cafe3d?.settled() && window.__cafe3d.renders() > 0);
  return { cafe, estado };
}

const BOTON = (parte, valor, receta) => (parte === 'grano' && receta[0] === 'te' ? (valor === 'suave' ? 'Hoja verde · suave' : 'Hoja negra · intensa') : nombreOpcion(parte, valor));
const ELIGE_DE = { bebida: 0, grano: 1, leche: 2, toque: 3 };
/** La receta en la barra, eligiendo con los botones y dejando que la prepare Pilar (ya la domina). */
async function prepararConPilar(page, cafe, receta) {
  const caja = cafe.locator('.cf3-franja--atender');
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'barra');
  await page.waitForFunction(() => window.__cafe3d.enBarra());
  for (const etapa of ETAPAS) {
    await expect(caja).toHaveAttribute('data-etapa', etapa, { timeout: 8000 });
    if (!ELIGE[etapa]) continue;
    const k = ELIGE_DE[etapa];
    await cafe
      .locator('.cf3-opciones')
      .getByRole('button', { name: BOTON(etapa, receta[k], receta), exact: true })
      .click();
    await expect.poll(async () => (await caja.getAttribute('data-receta')).split(',')[k]).toBe(receta[k]);
    if (etapa === 'bebida') await cafe.locator('.cf3-pilar').getByRole('button', { name: 'Que lo prepare Pilar' }).click();
    const r = { bebida: receta[0], grano: receta[1], leche: receta[2], toque: receta[3] };
    if (etapa === 'grano' && gestosDe(etapa, r).length) await expect(caja).toHaveAttribute('data-pilar-ahora', 'true', { timeout: 4000 });
  }
  await expect(caja).toHaveAttribute('data-etapa', 'lista', { timeout: 8000 });
  await cafe.getByRole('button', { name: 'Llevársela' }).click();
}

test('sin haber leído nada: la bienvenida y el reparto traen del catálogo, y la distribuidora lo enseña entero', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/.test(info.project.name), '360, 390, 430, escritorio y WebKit 390');
  test.setTimeout(150000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Solo «Quiero leer»: desde la 1.139 el café ya no los presta
  const books = [libro('q1', 'Un libro por leer', { status: 'want', categories: ['Fantasy'] }), libro('q2', 'Otro por empezar', { status: 'reading' })];
  const { cafe, estado } = await alCafe(page, { books, libros: { bienvenida: false, libros: [] } });
  // Al entrar, la app manda tus leídos (ninguno) antes de abrir el día
  await expect.poll(() => estado.llamadas.filter((l) => l.rpc === 'cafe_mis_titulos').map((l) => l.body.titulos)).toEqual([[]]);
  await expect.poll(() => estado.llamadas.some((l) => l.rpc === 'cafe_dia')).toBe(true);
  const nombres = estado.llamadas.map((l) => l.rpc);
  expect(nombres.indexOf('cafe_mis_titulos')).toBeLessThan(nombres.indexOf('cafe_dia'));
  // El reparto de la mañana (6, gratis) y la caja de bienvenida (8): todo del catálogo
  await expect(cafe.locator('.cf3-dice')).toContainText('¡Ha llegado una caja de la distribuidora! 8 libros de regalo.');
  const tag = cafe.locator('.cf3-tag--libros');
  await expect(tag).toHaveText('Caja de libros · 14');
  expect(estado.granos).toBe(0);
  await quieto(page, 900);
  await page.screenshot({ path: join(DIR, `1-llega-${tam(info)}.png`) });

  await tag.click();
  const panel = cafe.getByRole('region', { name: 'Tus libros del café' });
  const caja = panel.locator('.cf3-libros__caja');
  await expect(caja).toHaveAttribute('data-abierta', 'true');
  await expect(caja.locator('.cf3-lomo')).toHaveCount(14);
  await expect(caja.locator('.cf3-lomo[data-tuyo="true"]')).toHaveCount(0);
  const claves = await caja.locator('.cf3-lomo').evaluateAll((ls) => ls.map((l) => l.dataset.clave));
  expect(claves.every((k) => CATALOGO_LIBROS.some((c) => c.clave === k))).toBe(true);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(DIR, `2-caja-${tam(info)}.png`) });
  await panel.getByRole('button', { name: 'Llenar la balda (12)' }).click();
  await expect(panel.locator('.cf3-libros__cuenta')).toHaveText('12 / 12');
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(DIR, `3-balda-${tam(info)}.png`) });

  // La distribuidora: el catálogo, los diez géneros, ocho títulos en cada uno
  await panel.getByRole('tab', { name: 'Distribuidora' }).click();
  await expect(panel.locator('.cf3-distri__nota')).toHaveText('El catálogo del café. Lo que leas llegará también aquí.');
  await expect(panel.getByRole('radiogroup', { name: 'Géneros' }).getByRole('radio')).toHaveCount(GENEROS.length);
  await panel.getByRole('radio', { name: 'Poesía' }).click();
  const lista = panel.locator('.cf3-distri__titulos li');
  await expect(lista).toHaveCount(8);
  await expect(panel.locator('.cf3-sello-leido')).toHaveCount(0);
  await expect(panel.locator('.cf3-distri__que')).toContainText('Cada mañana el reparto trae libros gratis');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(DIR, `4-distribuidora-${tam(info)}.png`) });
  expect(errors).toEqual([]);
  const video = page.video();
  await page.close();
  if (video && /chromium-390x844/.test(info.project.name)) await video.saveAs(join(DIR, `sin-leidos-${tam(info)}.webm`));
});

test('con tus leídos: el sello «Leído por ti», uno de cada tres en el reparto y el tuyo paga 6', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/.test(info.project.name), '360, 390, 430, escritorio y WebKit 390');
  test.setTimeout(240000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const books = [
    libro('f', 'El dragón del muelle', { categories: ['Fantasy'], pageCount: 540 }),
    libro('f2', 'La bruja del faro', { categories: ['Fantasy'], pageCount: 210 }),
    libro('m', 'Crimen en la lonja', { categories: ['Mystery'], pageCount: 280 }),
  ];
  // En la balda, solo tus dos de fantasía (así el cliente pide fantasía y se lleva uno tuyo)
  const libros = { bienvenida: true, libros: books.slice(0, 2).map((b) => ({ clave: b.id, titulo: b.title, genero: generoDe(b), caja: 0, balda: 1 })) };
  const { cafe, estado } = await alCafe(page, { books, libros, dominio: { cafe: 12, te: 12 } });
  // (la app puede tener más leídos de la biblioteca de ejemplo: solo se comprueba que van los tuyos y ninguno del catálogo)
  await expect.poll(() => estado.llamadas.find((l) => l.rpc === 'cafe_mis_titulos')?.body.titulos.map((t) => t.clave)).toEqual(expect.arrayContaining(['f', 'f2', 'm']));
  expect(estado.llamadas.find((l) => l.rpc === 'cafe_mis_titulos').body.titulos.some((t) => t.clave.startsWith('cat:'))).toBe(false);
  // 10 huecos libres: el reparto trae los 6 del nivel 1, uno de cada tres tuyo
  await expect(cafe.locator('.cf3-dice')).toContainText('Ha pasado el reparto de la mañana: 6 libros de regalo de la distribuidora. Hay 2 de los que has leído.');
  await quieto(page, 600);
  await page.screenshot({ path: join(DIR, `5-reparto-${tam(info)}.png`) });
  await cafe.locator('.cf3-tag--libros').click();
  const panel = cafe.getByRole('region', { name: 'Tus libros del café' });
  const caja = panel.locator('.cf3-libros__caja');
  await expect(caja.locator('.cf3-lomo')).toHaveCount(6);
  await expect(caja.locator('.cf3-lomo[data-tuyo="true"]')).toHaveCount(2);
  await expect(caja.locator('.cf3-lomo[data-tuyo="true"] .cf3-lomo__sello')).toHaveCount(2);
  await expect(caja.locator('.cf3-lomo[data-tuyo="true"]').first()).toHaveAccessibleName(/leído por ti/);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(DIR, `6-caja-sello-${tam(info)}.png`) });
  // La distribuidora: tus leídos, primero en su género y con su etiqueta
  await panel.getByRole('tab', { name: 'Distribuidora' }).click();
  await expect(panel.locator('.cf3-distri__nota')).toHaveText('El catálogo del café y 3 de tus leídos.');
  await panel.getByRole('radio', { name: 'Fantasía' }).click();
  const fantasia = panel.locator('.cf3-distri__titulos li');
  await expect(fantasia).toHaveCount(10);
  await expect(fantasia.first()).toHaveAttribute('data-tuyo', 'true');
  await expect(fantasia.first().locator('.cf3-sello-leido')).toHaveText('Leído por ti');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(DIR, `7-distribuidora-tuyos-${tam(info)}.png`) });
  await panel.getByRole('button', { name: 'Cerrar' }).click();

  // El primer cliente pide fantasía (lo que hay en la balda) y se lleva uno de tus leídos: 6 granos por el libro
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  const p1 = await pideLibro(cafe);
  expect(p1.genero).toBe('fantasia');
  await prepararConPilar(page, cafe, PIDE1);
  const franja = cafe.locator('.cf3-franja--atender');
  await expect(franja).toHaveAttribute('data-paso', 'libreria');
  const l1 = await hacerLibro(page, cafe);
  await expect(franja).toHaveAttribute('data-paso', 'gracias', { timeout: 20000 });
  await expect(cafe.locator('.cf3-dado')).toContainText('6 por tu libro');
  await expect(cafe.locator('.cf3-repaso li[data-parte="ejemplar"]')).toHaveText(`✓ Se lleva «${l1.titulo}», que lo recomiendas tú`);
  await quieto(page, 300);
  await page.screenshot({ path: join(DIR, `8-gracias-tuyo-${tam(info)}.png`) });
  await despedir(page, cafe);
  const entrega = estado.llamadas.find((l) => l.rpc === 'cafe_entregar').body;
  expect(['f', 'f2']).toContain(entrega.libro);
  expect(errors).toEqual([]);
  const video = page.video();
  await page.close();
  if (video && /chromium-390x844/.test(info.project.name)) await video.saveAs(join(DIR, `con-leidos-${tam(info)}.webm`));
});
