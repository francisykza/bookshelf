// 1.130 (SPEC §130; docs/qa/cafe-libreria.md §15, Francisco, 14-11-2026) · Pilar y los libros, juntos:
// - Pilar prepara lo que dominas (12 servidas de 2 estrellas o más): tras elegir la bebida, «Esto ya lo bordas; si quieres, te
//   lo preparo yo»; ella hace los gestos en 3D y se recuerda en el dispositivo. Al excéntrico, siempre a mano.
// - El libro, igual de importante: el cliente pide de lo que hay en la balda (género, corto o largo, y cómo se lo lleva), la
//   estantería de la pared va por secciones con placas de latón, se pasa el dedo por los lomos y se tira del que encaja, la
//   tabla sale de la estantería, se mira su ficha y se envuelve (papel, solapas y cordel; la tapa y el marcapáginas; la bolsa,
//   meterlo y el borde) con el sello del café. Estrellas de 7 aciertos; si aciertas el género se lo lleva (+4 granos).
// - El reparto de la mañana repone lo vendido y colocar es un gesto: empujar la caja. Desde la 1.139 el reparto es gratis (6 en
//   el nivel 1, sin pasar de los huecos libres; uno de cada tres, tuyo, y el resto del catálogo del café).
// Capturas y vídeos en qa-report/cafe-libreria/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { despedir, hacerGesto, quieto } from './cafeBarra';
import { hacerLibro, pideLibro } from './cafeLibro';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { EXCENTRICOS, generoDe, nombreGenero, nombreOpcion, recetaPide } from '../src/features/edificio/cafe/cafeClientes';
import { CATALOGO_LIBROS } from '../src/features/edificio/cafe/cafeCatalogoLibros';
import { ELIGE, ETAPAS, gestosDe } from '../src/features/edificio/cafe/cafeGestos';
import { dayKey } from '../src/domain/dates';
import { alEdificio } from './entrada';

const DIR = join('qa-report', 'cafe-libreria');
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
// Varias secciones, con libros cortos y largos en algunas
const LIBROS = [
  libro('f', 'El dragón del muelle', { categories: ['Fantasy'], pageCount: 540 }),
  libro('f2', 'La bruja del faro', { categories: ['Fantasy'], pageCount: 210 }),
  libro('m', 'Crimen en la lonja', { categories: ['Mystery'], pageCount: 280 }),
  libro('m2', 'El caso del ancla', { categories: ['Mystery'], pageCount: 460 }),
  libro('a', 'Cartas de amor al puerto', { categories: ['Romance'], pageCount: 190 }),
  libro('s', 'Naves sobre la bahía', { categories: ['Science Fiction'], pageCount: 610 }),
  libro('c', 'Cuentos del tranvía', { pageCount: 120 }),
  libro('t', 'La gran saga del mar', { pageCount: 900 }),
  libro('p', 'Versos de sal', { categories: ['Poetry'], pageCount: 96 }),
  libro('h', 'Historia del muelle viejo', { categories: ['History'], pageCount: 420 }),
];
const BALDA = { bienvenida: true, libros: LIBROS.map((b) => ({ clave: b.id, titulo: b.title, genero: generoDe(b), caja: 0, balda: 1 })) };
// Para regalar, para leerlo aquí y para llevar (la forma sale de la semilla); el tercero, el excéntrico (8919 % 6 = 3)
const SEMILLAS = [2100, 1000, 8919];
const PIDE = { 1: recetaPide({ n: 1, semilla: SEMILLAS[0] }), 2: recetaPide({ n: 2, semilla: SEMILLAS[1] }), 3: recetaPide({ n: 3, semilla: SEMILLAS[2] }) };
const RARO = EXCENTRICOS[3];

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

// `reparto`: si el día nuevo trae el reparto de la mañana (1.139; fuera de su prueba, no, para que no cambie lo demás)
async function alCafe(page, { libros = BALDA, granos = 0, dominio = {}, vendidos = [], reparto = false } = {}) {
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
  const estado = await simularCafe(
    page,
    { inaugurado: true, nombre: 'Taza y Lomo', granos, plano: structuredClone(PLANO_INICIAL), inventario: cuenta(PLANO_INICIAL), libros, dominio },
    { clientes: { hoy: HOY, semillas: SEMILLAS, quienes: [3], frases: [10], vendidos, reparto } },
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

/**
 * Prepara `receta` en la barra con los botones. `pilar`: 'oferta' (sale la oferta y se acepta), 'recordado' (ya lo prepara
 * ella sin preguntar) o null (a mano, con los gestos). `foto`: capturas.
 */
async function preparar(page, cafe, receta, { pilar = null, foto = null } = {}) {
  const caja = cafe.locator('.cf3-franja--atender');
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'barra');
  await page.waitForFunction(() => window.__cafe3d.enBarra());
  for (const etapa of ETAPAS) {
    await expect(caja).toHaveAttribute('data-etapa', etapa, { timeout: 8000 });
    if (ELIGE[etapa]) {
      const k = ELIGE_DE[etapa];
      await cafe
        .locator('.cf3-opciones')
        .getByRole('button', { name: BOTON(etapa, receta[k], receta), exact: true })
        .click();
      await expect.poll(async () => (await caja.getAttribute('data-receta')).split(',')[k]).toBe(receta[k]);
      if (etapa === 'bebida') {
        const oferta = cafe.locator('.cf3-pilar');
        if (pilar === 'oferta') {
          await expect(oferta).toContainText('Esto ya lo bordas; si quieres, te lo preparo yo.');
          await quieto(page, 200);
          await foto?.('pilar-oferta');
          await oferta.getByRole('button', { name: 'Que lo prepare Pilar' }).click();
          await expect(oferta).toHaveCount(0);
        } else await expect(oferta).toHaveCount(0);
        if (pilar) await expect(caja).toHaveAttribute('data-pilar', 'pilar');
      }
    }
    const r = { bebida: receta[0], grano: receta[1], leche: receta[2], toque: receta[3] };
    if (pilar) {
      // Lo hace ella, solo y deprisa (cada gesto, menos de medio segundo: no se espera a verlos uno a uno): la zona no recoge
      // toques y el cuadro lo dice; la etapa sigue sola (lo comprueba la vuelta siguiente, o «lista»)
      if (etapa === 'grano' && gestosDe(etapa, r).length) {
        await expect(caja).toHaveAttribute('data-pilar-ahora', 'true', { timeout: 4000 });
        await expect(cafe.locator('.cf3-dice')).toContainText('Deja, que esto lo bordo yo.');
        await foto?.('pilar-prepara');
      }
      continue;
    }
    for (const tipo of gestosDe(etapa, r)) await hacerGesto(page, cafe, tipo, { foto });
  }
  await expect(caja).toHaveAttribute('data-etapa', 'lista', { timeout: 8000 });
  expect(await caja.getAttribute('data-receta')).toBe(receta.join());
  await quieto(page, 300);
  await foto?.('lista');
  await cafe.getByRole('button', { name: 'Llevársela' }).click();
}

test('Pilar prepara lo que dominas y el libro, a mano: la estantería por secciones y sus tres formas', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844)$|webkit-390x844$/.test(info.project.name), '360 y 390 (Chromium y WebKit)');
  test.setTimeout(300000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const capturar = (pre) => (nombre) => page.screenshot({ path: join(DIR, `${pre}-${nombre}-${tam(info)}.png`) });
  const { cafe, estado } = await alCafe(page, { dominio: { cafe: 12, te: 12 } });
  await expect(cafe.locator('.cf3-dice')).toContainText('Tienes 3 clientes esperando');
  const caja = cafe.locator('.cf3-franja--atender');

  // El primero: pide de la balda, en tres partes; la bebida la prepara Pilar y el libro, a mano (para regalar)
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  const p1 = await pideLibro(cafe);
  expect(p1.forma).toBe('regalar');
  expect(BALDA.libros.some((b) => b.genero === p1.genero)).toBe(true);
  await expect(cafe.locator('.cf3-dice')).toContainText('Y para leer,');
  await expect(cafe.locator('.cf3-comanda__linea--libro')).toContainText(nombreGenero(p1.genero));
  await capturar('1')('pide');
  await preparar(page, cafe, PIDE[1], { pilar: 'oferta', foto: capturar('1') });
  // De la barra a la estantería: la taza espera en la bandeja de la tabla
  await expect(caja).toHaveAttribute('data-paso', 'libreria');
  await expect(caja).toHaveClass(/cf3-franja--libreria/);
  const l1 = await hacerLibro(page, cafe, { foto: capturar('2') });
  await expect(caja).toHaveAttribute('data-paso', 'yendo');
  await page.waitForTimeout(450);
  await capturar('2')('bandeja');
  await expect(caja).toHaveAttribute('data-paso', 'gracias', { timeout: 20000 });
  await expect(cafe.getByRole('img', { name: '3 de 3 estrellas' })).toBeVisible();
  // 1.139: es uno de tus leídos: paga 6 («lo recomiendas tú»)
  await expect(cafe.locator('.cf3-dado')).toContainText('+11 granos');
  await expect(cafe.locator('.cf3-dado')).toContainText('6 por tu libro');
  await expect(cafe.locator('.cf3-repaso li[data-ok="false"]')).toHaveCount(0);
  await expect(cafe.locator('.cf3-repaso li[data-parte="genero"]')).toHaveText(`✓ ${nombreGenero(p1.genero)}`);
  await expect(cafe.locator('.cf3-repaso li[data-parte="forma"]')).toHaveText('✓ Para regalar');
  await expect(cafe.locator('.cf3-repaso li[data-parte="ejemplar"]')).toHaveText(`✓ Se lleva «${l1.titulo}», que lo recomiendas tú`);
  await quieto(page, 300);
  await capturar('2')('gracias');
  await despedir(page, cafe);

  // El segundo: para leerlo aquí. Se equivoca de sección a propósito: el ejemplar vuelve a su sitio (2 estrellas)
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  const p2 = await pideLibro(cafe);
  expect(p2.forma).toBe('aqui');
  // Si es la misma bebida que el primero, Pilar ya la prepara sin preguntar (se recuerda en el dispositivo)
  const misma = PIDE[2][0] === PIDE[1][0];
  await preparar(page, cafe, PIDE[2], { pilar: misma ? 'recordado' : 'oferta', foto: capturar('3') });
  const placas = await page.waitForFunction(() => {
    const ps = window.__cafe3d.enLibreria() && window.__cafe3d.libreriaPlacas().filter((p) => p.front);
    return ps && ps.length > 1 ? ps : null;
  });
  const otra = (await placas.jsonValue()).find((p) => p.genero !== p2.genero).genero;
  const l2 = await hacerLibro(page, cafe, { genero: otra, extension: '*', foto: capturar('3') });
  await expect(caja).toHaveAttribute('data-paso', 'gracias', { timeout: 20000 });
  await expect(cafe.getByRole('img', { name: '2 de 3 estrellas' })).toBeVisible();
  await expect(cafe.locator('.cf3-repaso li[data-parte="genero"]')).toHaveText(`✗ ${nombreGenero(otra)} · pidió ${nombreGenero(p2.genero).toLowerCase()}`);
  await expect(cafe.locator('.cf3-repaso li[data-parte="forma"]')).toHaveText('✓ Para leerlo aquí');
  await expect(cafe.locator('.cf3-repaso li[data-parte="ejemplar"]')).toHaveText(`· «${l2.titulo}» vuelve a su sección`);
  await expect(cafe.locator('.cf3-dado')).not.toContainText('por el libro');
  await quieto(page, 300);
  await capturar('3')('gracias');
  await despedir(page, cafe);

  // El excéntrico: siempre a mano (sin oferta de Pilar), y su libro en acertijos; para llevar
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  await expect(cafe.locator('.cf3-comanda__acertijos li')).toHaveCount(7);
  const p3 = await pideLibro(cafe);
  expect(p3.forma).toBe('llevar');
  await capturar('4')('pide');
  await preparar(page, cafe, PIDE[3], { pilar: null });
  // En la librería, la comanda del excéntrico enseña solo el acertijo del paso
  await expect(cafe.locator('.cf3-comanda[data-solo-libro="true"]')).toBeVisible();
  await hacerLibro(page, cafe, { foto: capturar('4') });
  await expect(caja).toHaveAttribute('data-paso', 'gracias', { timeout: 20000 });
  await expect(cafe.getByRole('img', { name: '3 de 3 estrellas' })).toBeVisible();
  await expect(cafe.locator('.cf3-dado')).toContainText('+21 granos');
  await expect(cafe.locator('.cf3-franja--atender .cf3-dice')).toContainText(RARO.dorada);
  await quieto(page, 300);
  await capturar('4')('gracias');
  await despedir(page, cafe);

  // Al servidor: la clave del ejemplar y lo acertado del libro [género, extensión, forma]
  const entregas = estado.llamadas.filter((l) => l.rpc === 'cafe_entregar').map((l) => l.body);
  expect(entregas.map((b) => [b.cliente, b.receta.join(), b.libro_ok?.[0], b.libro_ok?.[2]])).toEqual([
    [1, PIDE[1].join(), true, true],
    [2, PIDE[2].join(), false, true],
    [3, PIDE[3].join(), true, true],
  ]);
  expect(entregas[0].libro).toBe(LIBROS.find((b) => b.title === l1.titulo).id);
  // Se llevaron dos (el primero y el excéntrico): quedan 8 en la balda
  expect(Object.values(estado.lib.libros).reduce((s, b) => s + b.balda, 0)).toBe(LIBROS.length - 2);
  expect(estado.llamadas.filter((l) => l.rpc === 'cafe_servir')).toHaveLength(0);
  expect(errors).toEqual([]);
  const video = page.video();
  await page.close();
  if (video && /390x844/.test(info.project.name)) await video.saveAs(join(DIR, `pilar-y-libros-${tam(info)}.webm`));
});

test('el reparto de la mañana repone lo vendido y se coloca de un gesto, cada lomo en su sección', async ({ page }, info) => {
  test.skip(!/chromium-390x844$|webkit-390x844$/.test(info.project.name), '390 (Chromium y WebKit)');
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Ayer se vendieron tres; quedan 5 huecos: el reparto, gratis, repone los tres, trae uno más de tus leídos (uno de cada
  // tres) y otro del catálogo del café
  const vendidas = ['f', 'm', 'a'];
  const libros = { bienvenida: true, libros: BALDA.libros.map((b) => (vendidas.includes(b.clave) ? { ...b, balda: 0 } : b)) };
  const { cafe, estado } = await alCafe(page, { libros, granos: 4, vendidos: vendidas, reparto: true });
  await expect(cafe.locator('.cf3-dice')).toContainText('Ha pasado el reparto de la mañana: 5 libros de regalo de la distribuidora. 3 reponen lo que se llevaron ayer. Hay 4 de los que has leído.');
  expect(estado.granos).toBe(4);
  const tag = cafe.locator('.cf3-tag--libros');
  await expect(tag).toHaveText('Caja de libros · 5');
  await quieto(page, 900);
  await page.screenshot({ path: join(DIR, `5-reparto-${tam(info)}.png`) });
  // El aviso, una vez al día en el dispositivo
  expect(await page.evaluate((d) => localStorage.getItem(`cafe-reparto:${d}`), HOY)).toBe('1');

  // La caja: los lomos del reparto saltan; empujarla hacia arriba los manda a sus secciones
  await tag.click();
  const panel = cafe.getByRole('region', { name: 'Tus libros del café' });
  const caja = panel.locator('.cf3-libros__caja');
  await expect(caja).toHaveAttribute('data-abierta', 'true');
  await expect(caja.locator('.cf3-lomo')).toHaveCount(5);
  // El del catálogo, sin la cinta de «Leído por ti»; los tuyos, con ella
  await expect(caja.locator('.cf3-lomo[data-tuyo="true"]')).toHaveCount(4);
  await expect(caja).toHaveAttribute('data-colocar', 'true');
  await expect(caja.locator('.cf3-libros__pista .cf3-pista[data-pista="arriba"]')).toBeVisible();
  await expect(panel.locator('.cf3-libros__cuenta')).toHaveText('7 / 12');
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(DIR, `6-caja-reparto-${tam(info)}.png`) });
  const b = await caja.boundingBox();
  const m = page.mouse;
  // Desde el frente de la caja (no desde un lomo)
  const x = b.x + 18;
  const y = b.y + b.height - 14;
  await m.move(x, y);
  await m.down();
  await m.move(x, y - 40, { steps: 5 });
  await expect(caja).toHaveAttribute('data-empuja', 'true');
  await page.screenshot({ path: join(DIR, `7-empujar-${tam(info)}.png`) });
  await m.move(x, y - 110, { steps: 6 });
  await m.up();
  await expect(panel.locator('.cf3-libros__cuenta')).toHaveText('12 / 12');
  await expect(panel.locator('.cf3-libros__hueco[data-vuela="true"]')).toHaveCount(5);
  await page.waitForTimeout(260);
  await page.screenshot({ path: join(DIR, `8-vuelan-${tam(info)}.png`) });
  await expect.poll(() => estado.llamadas.filter((l) => l.rpc === 'cafe_colocar').map((l) => ({ ...l.body, poner: [...l.body.poner].sort() }))).toEqual([{ poner: ['a', CATALOGO_LIBROS[0].clave, 'f', 'f', 'm'].sort(), quitar: [] }]);
  // La balda, por secciones: los de cada género, juntos, con su separador de latón
  const generos = await panel.locator('.cf3-libros__balda .cf3-lomo').evaluateAll((ls) => ls.map((l) => l.dataset.clave));
  const deGenero = (k) => CATALOGO_LIBROS.find((x) => x.clave === k)?.genero ?? generoDe(LIBROS.find((x) => x.id === k));
  const vistos = [];
  for (const k of generos) if (vistos.at(-1) !== deGenero(k)) vistos.push(deGenero(k));
  expect(new Set(vistos).size).toBe(vistos.length);
  await expect(panel.locator('.cf3-libros__hueco[data-seccion="true"]')).toHaveCount(vistos.length);
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(DIR, `9-balda-secciones-${tam(info)}.png`) });
  await panel.getByRole('button', { name: 'Cerrar' }).click();
  // Al volver a entrar el mismo día, ya no se avisa
  await cafe.getByRole('button', { name: 'Volver al portal' }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' }).click({ timeout: 15000 });
  await expect(cafe.locator('.cf3[data-ready="true"]')).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(800);
  await expect(cafe.locator('.cf3-dice')).not.toContainText('Ha pasado el reparto');
  expect(errors).toEqual([]);
  const video = page.video();
  await page.close();
  if (video && /chromium-390x844/.test(info.project.name)) await video.saveAs(join(DIR, `reparto-${tam(info)}.webm`));
});

test('con movimiento reducido: Pilar, de una vez, y el libro con toques', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'Chromium 390');
  test.setTimeout(150000);
  mkdirSync(DIR, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { cafe, estado } = await alCafe(page, { dominio: { cafe: 12, te: 12 } });
  const caja = cafe.locator('.cf3-franja--atender');
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await cafe
    .locator('.cf3-opciones')
    .getByRole('button', { name: BOTON('bebida', PIDE[1][0], PIDE[1]), exact: true })
    .click();
  // «Lo hago yo» también se recuerda; y el botón deja cambiar de idea en cualquier momento
  await cafe.locator('.cf3-pilar').getByRole('button', { name: 'Lo hago yo' }).click();
  await expect(caja).toHaveAttribute('data-pilar', 'mano');
  await expect(cafe.getByRole('button', { name: 'A mano. Cambiar a que lo prepare Pilar' })).toBeVisible();
  await cafe.getByRole('button', { name: 'A mano. Cambiar a que lo prepare Pilar' }).click();
  await expect(caja).toHaveAttribute('data-pilar', 'pilar');
  for (const etapa of ETAPAS.slice(1)) {
    await expect(caja).toHaveAttribute('data-etapa', etapa, { timeout: 4000 });
    if (ELIGE[etapa]) {
      const k = ELIGE_DE[etapa];
      await cafe
        .locator('.cf3-opciones')
        .getByRole('button', { name: BOTON(etapa, PIDE[1][k], PIDE[1]), exact: true })
        .click();
    }
  }
  // Con movimiento reducido, lo de Pilar es directo
  await expect(caja).toHaveAttribute('data-etapa', 'lista', { timeout: 4000 });
  await cafe.getByRole('button', { name: 'Llevársela' }).click();
  await hacerLibro(page, cafe, { reducido: true, foto: (n) => page.screenshot({ path: join(DIR, `10-reducido-${n}-${tam(info)}.png`) }) });
  await expect(caja).toHaveAttribute('data-paso', 'gracias', { timeout: 15000 });
  await expect(cafe.getByRole('img', { name: '3 de 3 estrellas' })).toBeVisible();
  expect(estado.llamadas.filter((l) => l.rpc === 'cafe_entregar')).toHaveLength(1);
  expect(errors).toEqual([]);
  const video = page.video();
  await page.close();
  if (video) await video.saveAs(join(DIR, `reducido-${tam(info)}.webm`));
});
