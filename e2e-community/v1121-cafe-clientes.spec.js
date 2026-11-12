// 1.121 (SPEC §121; docs/qa/cafe-libreria.md, bloque 3, revisado el 12-11-2026) · El café-librería del bajo: llegan los
// clientes del día (el último, el excéntrico) y un habitual (por la sesión de lectura de hoy). Cada uno pide una bebida en
// una comanda (la del excéntrico, en acertijos); se prepara en la barra 3D (tocando sus cosas o eligiendo abajo), se
// mantiene pulsado para llenar la taza, se le lleva a su mesa y, de extra, se le recomienda un libro entre tres fichas. Las
// estrellas salen de lo acertado (fallar paga menos, nunca cero); el excéntrico bordado paga el triple y deja una reseña
// dorada; el habitual, su reseña. El servidor simulado aplica las reglas de `20261211120000_cafe_clientes.sql`. Un día
// entero, en vídeo, y otra vez con movimiento reducido (servir con un toque). Capturas y vídeos en qa-report/cafe-clientes/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { EXCENTRICOS, PARTES, RESENAS, contextoPedidos, nombreOpcion, pedidoPorId, recetaPide } from '../src/features/edificio/cafe/cafeClientes';
import { dayKey } from '../src/domain/dates';

const DIR = join('qa-report', 'cafe-clientes');
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
// Un libro que encaja con cada pedido posible, y uno que no encaja con ninguno
const LIBROS = [
  libro('f', 'El dragón del muelle', { categories: ['Fantasy'] }),
  libro('m', 'Crimen en la lonja', { categories: ['Mystery'] }),
  libro('a', 'Cartas de amor al puerto', { categories: ['Romance'] }),
  libro('s', 'Naves sobre la bahía', { categories: ['Science Fiction'] }),
  libro('c', 'Cuentos del tranvía', { pageCount: 120, currentPage: 120 }),
  libro('t', 'La gran saga del mar', { pageCount: 900, currentPage: 900 }),
  libro('k', 'El viejo y la marea', { publishedDate: '1921' }),
  libro('v', 'Té para dos', { favorite: true }),
  libro('e1', 'Faro de invierno', { author: 'Elena Faro' }),
  libro('u', 'El último tranvía', { finishedAt: `${HOY}T08:00:00.000Z` }),
  libro('e2', 'Faro de verano', { author: 'Elena Faro' }),
  libro('n', 'Un libro sin más'),
];
const CTX = contextoPedidos(LIBROS);
// Las semillas del servidor simulado (1000 + k · 7919): el tercero, el excéntrico, es Madame Niebla (16838 % 6 = 2)
const SEMILLAS = [1000, 8919, 16838];
const PIDE = { 1: recetaPide({ n: 1, semilla: SEMILLAS[0] }), 2: recetaPide({ n: 2, semilla: SEMILLAS[1] }), 3: recetaPide({ n: 3, semilla: SEMILLAS[2] }), 101: recetaPide({ n: 101, quien: 3 }) };
const NIEBLA = EXCENTRICOS[2];

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

async function alCafe(page, { pomodoros = 1 } = {}) {
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 120, sin_raro: 3 } },
    piso_inventario: { [ANA.id]: { sillon: 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.libraries.push({ user_id: ANA.id, data: { books: LIBROS }, updated_at: new Date().toISOString(), version: 5 });
  const progreso = { readingLog: [], pomodoros: Array.from({ length: pomodoros }, () => ({ at: new Date().toISOString(), minutes: 25, drink: 'te' })), claimed: {} };
  await page.addInitScript(
    ([books, progress]) => {
      localStorage.setItem('bookshelf:signs-hint-done', 'true');
      if (!localStorage.getItem('bookshelf:v1')) localStorage.setItem('bookshelf:v1', JSON.stringify({ books, progress }));
    },
    [LIBROS, progreso],
  );
  await mock.attach(page, ANA);
  const estado = await simularCafe(
    page,
    { inaugurado: true, nombre: 'Taza y Lomo', plano: structuredClone(PLANO_INICIAL), inventario: cuenta(PLANO_INICIAL) },
    { clientes: { hoy: HOY, semillas: SEMILLAS, quienes: [3], frases: [10] } },
  );
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  return { portal, estado };
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

/**
 * Atiende al siguiente cliente con «Atender». `receta`: lo que se prepara (por defecto, lo que pidió); `en3d`: elegir la
 * bebida y el grano tocándolos en la barra; `libro`: 'encaja', 'no' o null (solo el café).
 */
async function atenderUno(page, cafe, n, { receta = PIDE[n], en3d = false, libro: conLibro = 'encaja', capturas = null, info = null, reducido = false } = {}) {
  const foto = async (nombre) => capturas && page.screenshot({ path: join(DIR, `${capturas}-${nombre}-${tam(info)}.png`) });
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  const caja = cafe.locator('.cf3-franja--atender');
  await expect(caja).toHaveAttribute('data-paso', 'pide');
  const pedido = await caja.getAttribute('data-pedido');
  await foto('pide');
  // A la barra: la vista baja al mostrador
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'barra');
  await page.waitForFunction(() => window.__cafe3d.enBarra());
  await quieto(page, 300);
  await foto('barra');
  if (en3d) {
    for (const [parte, k] of [
      ['bebida', 0],
      ['grano', 1],
    ]) {
      const p = await page.evaluate((id) => window.__cafe3d.barraEnPantalla(id), `barra:${parte}:${receta[k]}`);
      await page.mouse.click(p.x, p.y);
      await expect.poll(async () => (await caja.getAttribute('data-receta')).split(',')[k]).toBe(receta[k]);
    }
  }
  // Lo que falte, en los huecos de abajo (cada toque pasa a la siguiente opción)
  for (const [k, parte] of PARTES.entries()) {
    for (let i = 0; i < 4 && (await caja.getAttribute('data-receta')).split(',')[k] !== receta[k]; i += 1) await cafe.getByRole('button', { name: new RegExp(`^${parte.nombre}:`) }).click();
    await expect.poll(async () => (await caja.getAttribute('data-receta')).split(',')[k]).toBe(receta[k]);
  }
  await foto('receta');
  const verter = cafe.getByRole('button', { name: reducido ? 'Servir' : 'Mantén pulsado para servir' });
  if (reducido) await verter.click();
  else {
    // Mantener pulsado: a medias se queda a medias (no se pierde), y al seguir se llena
    const b = await verter.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(450);
    await page.mouse.up();
    const medio = Number((await verter.textContent()).match(/(\d+) %/)?.[1]);
    expect(medio).toBeGreaterThan(10);
    expect(medio).toBeLessThan(100);
    await foto('vertiendo');
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.mouse.up();
  }
  // Llevársela: la taza en la mano, andando hasta su mesa
  await expect(caja).toHaveAttribute('data-paso', 'llevar');
  await quieto(page, 400);
  await foto('llevar');
  await cafe.getByRole('button', { name: 'Llevársela' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'libro', { timeout: 15000 });
  await quieto(page, 300);
  await foto('libro');
  // El libro, de extra: tres fichas
  const fichas = cafe.locator('.cf3-ficha');
  await expect(fichas).toHaveCount(3);
  if (conLibro) {
    const titulos = await fichas.locator('.cf3-ficha__titulo').allTextContents();
    const p = pedidoPorId(pedido);
    const elegido = titulos.find(
      (t) =>
        (conLibro === 'encaja') ===
        p.encaja(
          LIBROS.find((b) => b.title === t),
          CTX,
        ),
    );
    expect(elegido, `una ficha que ${conLibro === 'encaja' ? 'encaje' : 'no encaje'} con «${pedido}»`).toBeTruthy();
    await cafe.getByRole('button', { name: `Recomendar «${elegido}»` }).click();
  } else await cafe.getByRole('button', { name: 'Solo el café' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'gracias');
  await expect(cafe.getByRole('button', { name: 'Hasta luego' })).toBeVisible();
  return pedido;
}

test('un día en el café: dos clientes, el excéntrico y un habitual, de la barra a «todo el mundo atendido»', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/.test(info.project.name), '360, 430, escritorio y 390 (Chromium y WebKit)');
  test.setTimeout(240000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { portal, estado } = await alCafe(page);
  const cafe = await entrar(page, portal);
  // Tres clientes del nivel 1 (el tercero, el excéntrico) y un habitual por la sesión de hoy (Marga)
  await expect(cafe.locator('.cf3-dice')).toContainText('Tienes 4 clientes esperando, y uno es muy peculiar');
  await expect.poll(() => page.evaluate(() => window.__cafe3d.clientes())).toBe(4);
  expect(estado.llamadas.filter((l) => l.rpc === 'cafe_habitual')).toHaveLength(1);
  await expect(cafe.locator('.cf3-tag--cliente')).toHaveCount(4);
  await expect(cafe.locator('.cf3-tag--raro')).toHaveCount(1);
  await expect(cafe.getByRole('button', { name: `Atender a ${NIEBLA.nombre}` })).toBeAttached();
  await quieto(page, 900);
  await page.screenshot({ path: join(DIR, `1-clientes-${tam(info)}.png`) });

  // El primero: lo que pidió, eligiendo la bebida y el grano en la barra 3D, y un libro que le encaja: 3 estrellas
  await expect(cafe.locator('.cf3-comanda')).toHaveCount(0);
  await atenderUno(page, cafe, 1, { en3d: true, capturas: '2', info });
  await expect(cafe.getByRole('img', { name: '3 de 3 estrellas' })).toBeVisible();
  await expect(cafe.locator('.cf3-dado')).toContainText('+5 granos');
  await expect(cafe.locator('.cf3-dado')).toContainText('+14 reputación');
  await expect(cafe.locator('.cf3-repaso li[data-ok="false"]')).toHaveCount(0);
  await expect(cafe.locator('.cf3-monedero')).toContainText('5');
  await page.screenshot({ path: join(DIR, `3-servido-${tam(info)}.png`) });
  await cafe.getByRole('button', { name: 'Hasta luego' }).click();
  await expect(cafe.locator('.cf3-tag--cliente')).toHaveCount(3);

  // El segundo: se equivoca la leche y sin libro: 2 estrellas, y el repaso dice qué pidió
  const mal = [...PIDE[2]];
  mal[2] = PIDE[2][2] === 'entera' ? 'avena' : 'entera';
  await atenderUno(page, cafe, 2, { receta: mal, libro: null });
  await expect(cafe.getByRole('img', { name: '2 de 3 estrellas' })).toBeVisible();
  await expect(cafe.locator('.cf3-dado')).toContainText('+4 granos');
  await expect(cafe.locator('.cf3-repaso li[data-ok="false"]')).toHaveText(`✗ ${nombreOpcion('leche', mal[2])} · pidió ${nombreOpcion('leche', PIDE[2][2]).toLowerCase()}`);
  await expect(cafe.locator('.cf3-repaso li[data-ok="nada"]')).toHaveText('· Sin libro');
  await page.screenshot({ path: join(DIR, `3-dos-estrellas-${tam(info)}.png`) });
  await cafe.getByRole('button', { name: 'Hasta luego' }).click();

  // El excéntrico: primero «Luego» (no pasa nada); su comanda en acertijos; bordado, el triple y la reseña dorada
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  await expect(cafe.locator('.cf3-comanda--raro')).toBeVisible();
  await expect(cafe.locator('.cf3-comanda__acertijos li')).toHaveCount(4);
  await expect(cafe.locator('.cf3-quien')).toHaveText(`★ ${NIEBLA.nombre}`);
  await cafe.getByRole('button', { name: 'Luego' }).click();
  await atenderUno(page, cafe, 3, { capturas: '4-excentrico', info });
  await expect(cafe.getByRole('img', { name: '3 de 3 estrellas' })).toBeVisible();
  await expect(cafe.locator('.cf3-dado')).toContainText('+15 granos');
  await expect(cafe.locator('.cf3-dado')).toContainText('+40 reputación');
  await expect(cafe.locator('.cf3-franja--atender .cf3-dice')).toContainText(NIEBLA.dorada);
  await page.screenshot({ path: join(DIR, `4-excentrico-gracias-${tam(info)}.png`) });
  await cafe.getByRole('button', { name: 'Hasta luego' }).click();

  // El habitual: «lo de siempre», bien preparado, pero el libro no era: 2 estrellas y su reseña
  await atenderUno(page, cafe, 101, { libro: 'no' });
  await expect(cafe.locator('.cf3-franja--atender .cf3-dice')).toContainText(RESENAS[10]);
  await expect(cafe.locator('.cf3-quien')).toHaveText('Marga');
  await expect(cafe.locator('.cf3-dado')).toContainText('+5 granos');
  await page.screenshot({ path: join(DIR, `5-habitual-${tam(info)}.png`) });
  await cafe.getByRole('button', { name: 'Hasta luego' }).click();

  // Todo el mundo atendido; la pizarra con la reseña dorada y la de Marga
  await expect(cafe.locator('.cf3-dice')).toContainText('Hoy ya está todo el mundo atendido');
  await expect(cafe.locator('.cf3-tag--cliente')).toHaveCount(0);
  await expect(cafe.locator('.cf3-monedero')).toContainText(String(5 + 4 + 15 + 5));
  const servidos = estado.llamadas.filter((l) => l.rpc === 'cafe_servir').map((l) => l.body);
  expect(servidos.map((b) => [b.cliente, b.receta.join(), b.encaja])).toEqual([
    [1, PIDE[1].join(), true],
    [2, mal.join(), null],
    [3, PIDE[3].join(), true],
    [101, PIDE[101].join(), false],
  ]);
  expect(servidos.every((b) => b.dia === HOY)).toBe(true);
  expect(estado.reputacion).toBe(14 + 10 + 40 + 12);
  await quieto(page, 900);
  await page.screenshot({ path: join(DIR, `6-atendidos-${tam(info)}.png`) });
  await cafe.getByRole('button', { name: /^La pizarra/ }).click();
  const pizarra = cafe.getByRole('region', { name: 'La pizarra' });
  await expect(pizarra).toContainText(RESENAS[10]);
  await expect(pizarra).toContainText(NIEBLA.dorada);
  await expect(pizarra.locator('li[data-dorada="true"]')).toHaveCount(1);
  await page.screenshot({ path: join(DIR, `7-pizarra-${tam(info)}.png`) });
  await pizarra.getByRole('button', { name: 'Cerrar' }).click();
  // Tocar a quien ya lee: no se le molesta
  const p = await page.evaluate(() => window.__cafe3d.clienteEnPantalla(1));
  if (p?.front) {
    await page.mouse.click(p.x, p.y);
    await expect(cafe.locator('.cf3-dice')).toContainText('leyendo tan a gusto');
  }

  // Al volver a entrar, los atendidos siguen leyendo y nadie espera
  await cafe.getByRole('button', { name: 'Volver al portal' }).click();
  const cafe2 = await entrar(page, portal);
  await expect(cafe2.locator('.cf3-dice')).toContainText('Hoy ya está todo el mundo atendido');
  await expect.poll(() => page.evaluate(() => window.__cafe3d.clientes())).toBe(4);
  await quieto(page, 900);
  await page.screenshot({ path: join(DIR, `8-otra-vez-${tam(info)}.png`) });
  expect(estado.llamadas.filter((l) => l.rpc === 'cafe_servir')).toHaveLength(4);
  expect(errors).toEqual([]);
  const video = page.video();
  await page.close();
  if (video && /390x844/.test(info.project.name)) await video.saveAs(join(DIR, `dia-${tam(info)}.webm`));
});

test('con movimiento reducido: se sirve con un toque y se llega sin andar', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'Chromium 390');
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { portal } = await alCafe(page, { pomodoros: 0 });
  const cafe = await entrar(page, portal);
  // Sin leer hoy, sin habitual: solo los tres del nivel
  await expect(cafe.locator('.cf3-dice')).toContainText('Tienes 3 clientes esperando');
  await atenderUno(page, cafe, 1, { reducido: true });
  await expect(cafe.locator('.cf3-dado')).toContainText('+5 granos');
  await page.screenshot({ path: join(DIR, `9-reducido-${tam(info)}.png`) });
  const video = page.video();
  await page.close();
  if (video) await video.saveAs(join(DIR, `reducido-${tam(info)}.webm`));
});
