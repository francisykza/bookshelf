// 1.121 (SPEC §121; docs/qa/cafe-libreria.md, bloque 3, revisado el 12-11-2026) · El café-librería del bajo: llegan los
// clientes del día (el último, el excéntrico) y un habitual (por la sesión de lectura de hoy). Cada uno pide una bebida en
// una comanda (la del excéntrico, en acertijos); se prepara en la barra 3D por etapas, cada una con su objeto y su gesto
// (revisión del 12-11-2026: la manivela, el prensador, la palanca, la cuchara, la tetera, el colador, la jarra bajo el vapor,
// servir con pulso, la canela y el hilo de miel), hechos con el ratón como con el dedo; se le lleva a su mesa y, de extra,
// se le recomienda un libro entre tres fichas. Las
// estrellas salen de lo acertado (fallar paga menos, nunca cero); el excéntrico bordado paga el triple y deja una reseña
// dorada; el habitual, su reseña. El servidor simulado aplica las reglas de `20261211120000_cafe_clientes.sql`. Un día
// entero, en vídeo, y otra vez con movimiento reducido (cada gesto, un toque). Capturas y vídeos en qa-report/cafe-clientes/.
// Libros en cajas (§121.3): solo se recomienda lo que está en la balda y, si encaja, el cliente se lo lleva (+2 granos); la
// caja de bienvenida (8 gratis) se abre y sus lomos se arrastran a la balda; en la distribuidora se compran cajas de un
// género (5 por 10) y de un título (3 por 9); sin ejemplares, solo el café.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { despedir, hacerGesto, quieto } from './cafeBarra';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { EXCENTRICOS, RESENAS, contextoPedidos, generoDe, nombreOpcion, pedidoPorId, recetaPide } from '../src/features/edificio/cafe/cafeClientes';
import { ELIGE, ETAPAS, GESTOS, gestosDe } from '../src/features/edificio/cafe/cafeGestos';
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
/** La balda llena: un ejemplar de cada uno de los 12 libros (la caja de bienvenida ya llegó). */
const BALDA_LLENA = { bienvenida: true, libros: LIBROS.map((b) => ({ clave: b.id, titulo: b.title, genero: generoDe(b), caja: 0, balda: 1 })) };

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

async function alCafe(page, { pomodoros = 1, libros = BALDA_LLENA, granos = 0 } = {}) {
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
    { inaugurado: true, nombre: 'Taza y Lomo', granos, plano: structuredClone(PLANO_INICIAL), inventario: cuenta(PLANO_INICIAL), libros },
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
/** Los nombres de los botones de cada opción (los mismos que tocar la cosa en la barra). */
const BOTON = (parte, valor, receta) => (parte === 'grano' && receta[0] === 'te' ? (valor === 'suave' ? 'Hoja verde · suave' : 'Hoja negra · intensa') : nombreOpcion(parte, valor));
const ELIGE_DE = { bebida: 0, grano: 1, leche: 2, toque: 3 };
const PARTE_DE = { bebida: 'bebida', grano: 'grano', leche: 'leche', toque: 'toque' };

/**
 * Atiende al siguiente cliente con «Atender». `receta`: lo que se prepara (por defecto, lo que pidió); `en3d`: elegir tocando
 * las cosas de la barra (si no, con los botones); `libro`: 'encaja', 'no' o null (solo el café); `capturas`: el prefijo de
 * las fotos de cada paso; `arte`: el dibujo de la leche ('hoja' ondulando o 'corazon' recto).
 */
async function atenderUno(page, cafe, n, { receta = PIDE[n], en3d = false, libro: conLibro = 'encaja', capturas = null, info = null, reducido = false, arte = 'hoja' } = {}) {
  const foto = capturas ? async (nombre) => page.screenshot({ path: join(DIR, `${capturas}-${nombre}-${tam(info)}.png`) }) : null;
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  const caja = cafe.locator('.cf3-franja--atender');
  await expect(caja).toHaveAttribute('data-paso', 'pide');
  const pedido = await caja.getAttribute('data-pedido');
  await foto?.('pide');
  // A la barra: la vista baja al mostrador y empieza por la bebida
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'barra');
  await page.waitForFunction(() => window.__cafe3d.enBarra());
  for (const etapa of ETAPAS) {
    await expect(caja).toHaveAttribute('data-etapa', etapa);
    if (ELIGE[etapa]) {
      const k = ELIGE_DE[etapa];
      const valor = receta[k];
      await quieto(page, 200);
      // Nivel 1: la «!» sobre cada cosa que se puede elegir de esta parte (las dos; nunca delata cuál)
      await expect(cafe.locator('.cf3-ayuda:not(.cf3-ayuda--gesto)')).toHaveCount(2);
      if (k === 0) await foto?.('barra');
      else await foto?.(`elige-${etapa}`);
      const id = `barra:${PARTE_DE[etapa]}:${valor}`;
      const p = en3d ? await page.evaluate((x) => window.__cafe3d.barraEnPantalla(x), id) : null;
      if (p?.front) await page.mouse.click(p.x, p.y);
      else
        await cafe
          .locator('.cf3-opciones')
          .getByRole('button', { name: BOTON(PARTE_DE[etapa], valor, receta), exact: true })
          .click();
      await expect.poll(async () => (await caja.getAttribute('data-receta')).split(',')[k]).toBe(valor);
    }
    const r = { bebida: receta[0], grano: receta[1], leche: receta[2], toque: receta[3] };
    for (const tipo of gestosDe(etapa, r)) {
      if (reducido) {
        await expect(caja).toHaveAttribute('data-gesto', tipo);
        await foto?.(`gesto-${tipo}`);
        await cafe.getByRole('button', { name: GESTOS[tipo].atajo, exact: true }).click();
        await expect(caja).not.toHaveAttribute('data-gesto', tipo);
      } else await hacerGesto(page, cafe, tipo, { foto, arte });
    }
  }
  // La taza lista, de cerca
  await expect(caja).toHaveAttribute('data-etapa', 'lista');
  expect(await caja.getAttribute('data-receta')).toBe(receta.join());
  await quieto(page, 400);
  await foto?.('lista');
  // Llevársela: la taza en la mano, andando hasta su mesa
  await cafe.getByRole('button', { name: 'Llevársela' }).click();
  if (!reducido) {
    // Con movimiento reducido se llega sin andar
    await expect(caja).toHaveAttribute('data-paso', 'yendo');
    await page.waitForTimeout(500);
    await foto?.('llevar');
  }
  await expect(caja).toHaveAttribute('data-paso', 'libro', { timeout: 15000 });
  await quieto(page, 300);
  await foto?.('libro');
  // El libro, de extra: tres fichas
  const fichas = cafe.locator('.cf3-ficha');
  if (conLibro === 'vacia') {
    await expect(fichas).toHaveCount(0);
    await expect(cafe.locator('.cf3-fichas__vacia')).toContainText('No te quedan libros en la balda');
    await foto?.('balda-vacia');
  } else await expect(fichas).toHaveCount(3);
  if (conLibro && conLibro !== 'vacia') {
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
  await expect(cafe.locator('.cf3-dado')).toContainText('+7 granos');
  await expect(cafe.locator('.cf3-dado')).toContainText('2 por el libro');
  await expect(cafe.locator('.cf3-dado')).toContainText('+14 reputación');
  await expect(cafe.locator('.cf3-repaso li[data-ok="false"]')).toHaveCount(0);
  await expect(cafe.locator('.cf3-repaso li').last()).toContainText('✓ Se lleva «');
  await expect(cafe.locator('.cf3-monedero')).toContainText('7');
  await page.screenshot({ path: join(DIR, `3-servido-${tam(info)}.png`) });
  // 1.122: con el primer cliente, el cartel del primer día (los 10 tickets del nivel 1 y el del día)
  const logro = await despedir(page, cafe);
  expect(logro).toContain('Primer día con clientes');
  expect(logro).toContain('+10 tickets por abrir el café');
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
  await despedir(page, cafe);

  // El excéntrico: primero «Luego» (no pasa nada); su comanda en acertijos; bordado, el triple y la reseña dorada
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  await expect(cafe.locator('.cf3-comanda--raro')).toBeVisible();
  await expect(cafe.locator('.cf3-comanda__acertijos li')).toHaveCount(4);
  await expect(cafe.locator('.cf3-quien')).toHaveText(`★ ${NIEBLA.nombre}`);
  await cafe.getByRole('button', { name: 'Luego' }).click();
  await atenderUno(page, cafe, 3, { capturas: '4-excentrico', info });
  await expect(cafe.getByRole('img', { name: '3 de 3 estrellas' })).toBeVisible();
  await expect(cafe.locator('.cf3-dado')).toContainText('+17 granos');
  await expect(cafe.locator('.cf3-dado')).toContainText('+40 reputación');
  await expect(cafe.locator('.cf3-franja--atender .cf3-dice')).toContainText(NIEBLA.dorada);
  await page.screenshot({ path: join(DIR, `4-excentrico-gracias-${tam(info)}.png`) });
  await despedir(page, cafe);

  // El habitual: «lo de siempre», pero con miel en vez de canela (el hilo de miel), y un libro que encaja: 2 estrellas y su reseña
  const conMiel = [...PIDE[101]];
  conMiel[3] = 'miel';
  await atenderUno(page, cafe, 101, { receta: conMiel, capturas: '5-habitual', info, arte: 'corazon' });
  await expect(cafe.locator('.cf3-repaso li[data-ok="false"]')).toHaveText(`✗ Miel · pidió ${nombreOpcion('toque', PIDE[101][3]).toLowerCase()}`);
  await expect(cafe.locator('.cf3-franja--atender .cf3-dice')).toContainText(RESENAS[10]);
  await expect(cafe.locator('.cf3-quien')).toHaveText('Marga');
  await expect(cafe.locator('.cf3-dado')).toContainText('+7 granos');
  await page.screenshot({ path: join(DIR, `5-habitual-${tam(info)}.png`) });
  await despedir(page, cafe);

  // Todo el mundo atendido; la pizarra con la reseña dorada y la de Marga
  await expect(cafe.locator('.cf3-dice')).toContainText('Hoy ya está todo el mundo atendido');
  await expect(cafe.locator('.cf3-tag--cliente')).toHaveCount(0);
  await expect(cafe.locator('.cf3-monedero')).toContainText(String(7 + 4 + 17 + 7));
  // Los tres libros que encajaban se los han llevado: quedan 9 en la balda
  expect(Object.values(estado.lib.libros).reduce((s, b) => s + b.balda, 0)).toBe(9);
  await expect(cafe.getByRole('button', { name: /^Tus libros: 9 en la balda/ })).toBeVisible();
  const servidos = estado.llamadas.filter((l) => l.rpc === 'cafe_servir').map((l) => l.body);
  expect(servidos.filter((b) => b.encaja).every((b) => LIBROS.some((x) => x.id === b.libro))).toBe(true);
  expect(servidos.map((b) => [b.cliente, b.receta.join(), b.encaja])).toEqual([
    [1, PIDE[1].join(), true],
    [2, mal.join(), null],
    [3, PIDE[3].join(), true],
    [101, conMiel.join(), true],
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
  // Con la balda vacía (la bienvenida ya se colocó y se la llevaron): solo el café
  const { portal } = await alCafe(page, { pomodoros: 0, libros: { bienvenida: true, libros: [] } });
  const cafe = await entrar(page, portal);
  // Sin leer hoy, sin habitual: solo los tres del nivel
  await expect(cafe.locator('.cf3-dice')).toContainText('Tienes 3 clientes esperando');
  // «De nuevo» tira lo preparado sin castigo y vuelve a la bebida; «Cambiar» deja elegir otra cosa antes del gesto
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  const caja = cafe.locator('.cf3-franja--atender');
  await cafe.locator('.cf3-opciones').getByRole('button', { name: 'Café', exact: true }).click();
  await expect(caja).toHaveAttribute('data-etapa', 'grano');
  await cafe.locator('.cf3-opciones').getByRole('button', { name: 'Intenso', exact: true }).click();
  await expect(caja).toHaveAttribute('data-gesto', 'manivela');
  await cafe.getByRole('button', { name: 'Cambiar', exact: true }).click();
  await expect(caja).toHaveAttribute('data-etapa', 'grano');
  await expect(cafe.locator('.cf3-opciones')).toBeVisible();
  await cafe.getByRole('button', { name: 'Tirar lo preparado y empezar otra taza' }).click();
  await expect(caja).toHaveAttribute('data-etapa', 'bebida');
  await expect(caja).toHaveAttribute('data-receta', ',,,');
  await cafe.getByRole('button', { name: 'Luego', exact: true }).click();
  await atenderUno(page, cafe, 1, { reducido: true, capturas: '9-reducido', info, libro: 'vacia' });
  // Sin fichas, «Solo el café»: cobra el café (2 estrellas, el libro no cuenta)
  await expect(cafe.locator('.cf3-dado')).toContainText('+4 granos');
  await expect(cafe.locator('.cf3-repaso li[data-ok="nada"]')).toHaveText('· Sin libro');
  await page.screenshot({ path: join(DIR, `9-reducido-${tam(info)}.png`) });
  const video = page.video();
  await page.close();
  if (video) await video.saveAs(join(DIR, `reducido-${tam(info)}.webm`));
});

/** Arrastra un lomo con el ratón (como el dedo) hasta una zona del cuadro de los libros. */
async function arrastrar(page, lomo, zona) {
  const a = await lomo.boundingBox();
  const b = await zona.boundingBox();
  const m = page.mouse;
  await m.move(a.x + a.width / 2, a.y + a.height / 2);
  await m.down();
  await m.move(a.x + a.width / 2 + 4, a.y + a.height / 2 - 10, { steps: 3 });
  await m.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  return async () => m.up();
}

test('libros en cajas: la bienvenida, arrastrar a la balda, la distribuidora y recomendar solo de la balda', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/.test(info.project.name), '360, 430, escritorio y 390 (Chromium y WebKit)');
  test.setTimeout(180000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { portal, estado } = await alCafe(page, { pomodoros: 0, libros: { bienvenida: false, libros: [] }, granos: 30 });
  const cafe = await entrar(page, portal);
  // Llega la caja de bienvenida: 8 ejemplares de tus leídos, repartidos por géneros, gratis
  await expect(cafe.locator('.cf3-dice')).toContainText('¡Ha llegado una caja de la distribuidora! 8 libros');
  const bienvenida = estado.llamadas.find((l) => l.rpc === 'cafe_bienvenida');
  // Tus títulos (los 12 leídos y lo que traiga la biblioteca de la cuenta)
  expect(bienvenida.body.titulos.length).toBeGreaterThanOrEqual(LIBROS.length);
  expect(bienvenida.body.titulos.find((x) => x.clave === 'f')).toEqual({ clave: 'f', titulo: 'El dragón del muelle', genero: 'fantasia' });
  await expect(cafe.getByRole('button', { name: 'Tus libros: 0 en la balda, 8 por colocar' })).toBeVisible();
  const tag = cafe.locator('.cf3-tag--libros');
  await expect(tag).toHaveText('Caja de libros · 8');
  // La vista se vuelve hacia la caja, al final del mostrador
  await quieto(page, 900);
  await expect(tag).toBeVisible();
  await page.screenshot({ path: join(DIR, `10-caja-llega-${tam(info)}.png`) });
  // Sin ejemplares en la balda, las estanterías del café están vacías
  expect(estado.granos).toBe(30);

  // Tocar la caja: se abre y los lomos saltan
  await tag.click();
  const panel = cafe.getByRole('region', { name: 'Tus libros del café' });
  await expect(panel).toBeVisible();
  const caja = panel.locator('.cf3-libros__caja');
  await expect(caja).toHaveAttribute('data-abierta', 'true');
  await expect(caja.locator('.cf3-lomo')).toHaveCount(8);
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(DIR, `11-caja-abierta-${tam(info)}.png`) });
  await page.waitForTimeout(700);
  // Arrastrar un lomo a la balda (a medio camino, la foto del lomo en la mano)
  const balda = panel.locator('.cf3-libros__balda');
  const primero = caja.locator('.cf3-lomo').first();
  const titulo = await primero.getAttribute('data-clave');
  const soltar = await arrastrar(page, primero, balda);
  await page.screenshot({ path: join(DIR, `12-arrastrando-${tam(info)}.png`) });
  await soltar();
  await expect(balda.locator('.cf3-lomo')).toHaveCount(1);
  await expect(balda.locator('.cf3-lomo')).toHaveAttribute('data-clave', titulo);
  await expect(panel.locator('.cf3-libros__cuenta')).toHaveText('1 / 12');
  await expect.poll(() => estado.llamadas.filter((l) => l.rpc === 'cafe_colocar').map((l) => l.body)).toEqual([{ poner: [titulo], quitar: [] }]);
  // Tocar un lomo también lo coloca; y «Colocarlos todos», el resto
  await caja.locator('.cf3-lomo').first().click();
  await expect(panel.locator('.cf3-libros__cuenta')).toHaveText('2 / 12');
  await panel.getByRole('button', { name: 'Colocarlos todos' }).click();
  await expect(panel.locator('.cf3-libros__cuenta')).toHaveText('8 / 12');
  await expect(caja.locator('.cf3-lomo')).toHaveCount(0);
  await expect(tag).toBeHidden();
  await page.screenshot({ path: join(DIR, `13-balda-${tam(info)}.png`) });
  // Devolver uno a la caja (tocándolo en la balda)
  await balda.locator('.cf3-lomo').first().click();
  await expect(panel.locator('.cf3-libros__cuenta')).toHaveText('7 / 12');
  await expect(caja.locator('.cf3-lomo')).toHaveCount(1);

  // La distribuidora: tus títulos por género; la caja de un género (5 por 10) y la de un título (3 por 9)
  await panel.getByRole('tab', { name: 'Distribuidora' }).click();
  await expect(panel.locator('.cf3-distri__granos')).toContainText('30');
  await expect(panel.locator('.cf3-distri__nota')).toContainText(`${bienvenida.body.titulos.length} títulos`);
  await panel.getByRole('radio', { name: 'Novela' }).click();
  await expect(panel.locator('.cf3-distri__que')).toContainText('5 ejemplares al azar entre tus');
  await page.screenshot({ path: join(DIR, `14-distribuidora-${tam(info)}.png`) });
  await panel.getByRole('button', { name: '5 por 10' }).click();
  // Vuelve a la caja, con los cinco recién llegados (y el devuelto)
  await expect(panel.getByRole('tab', { name: /^La caja/ })).toHaveAttribute('aria-selected', 'true');
  await expect(caja.locator('.cf3-lomo')).toHaveCount(6);
  await expect(cafe.locator('.cf3-monedero')).toContainText('20');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(DIR, `15-caja-comprada-${tam(info)}.png`) });
  const compra = estado.llamadas.find((l) => l.rpc === 'cafe_comprar_caja').body;
  expect(compra.genero).toBe('novela');
  expect(compra.clave).toBeNull();
  await panel.getByRole('tab', { name: 'Distribuidora' }).click();
  await panel.getByRole('radio', { name: 'Fantasía' }).click();
  await panel.getByRole('button', { name: '3 ejemplares de «El dragón del muelle» por 9 granos' }).click();
  await expect(caja.locator('.cf3-lomo')).toHaveCount(9);
  await expect(cafe.locator('.cf3-monedero')).toContainText('11');
  // Con 11 granos ya no llega a una caja de género (10 sí; 2 cajas no)
  await panel.getByRole('button', { name: 'Llenar la balda (5)' }).click();
  await expect(panel.locator('.cf3-libros__cuenta')).toHaveText('12 / 12');
  await expect(panel.getByRole('button', { name: /^Llenar la balda/ })).toHaveCount(0);
  // Llena: un lomo más no cabe
  await caja.locator('.cf3-lomo').first().click();
  await expect(panel.locator('.cf3-error')).toContainText('La balda está llena');
  await panel.getByRole('button', { name: 'Cerrar' }).click();
  // Las estanterías enseñan la balda
  await page.evaluate(() => window.__cafe3d.place(2.6, 7.3, Math.PI));
  await quieto(page);
  await page.screenshot({ path: join(DIR, `16-estanteria-${tam(info)}.png`) });
  expect(errors).toEqual([]);
  const video = page.video();
  await page.close();
  if (video && /390x844/.test(info.project.name)) await video.saveAs(join(DIR, `cajas-${tam(info)}.webm`));
});
