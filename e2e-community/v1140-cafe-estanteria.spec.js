// 1.140 (SPEC §140; Francisco, 16-11-2026: «sigue viendose algo vacía», «Repartir y vestir») · La estantería de la pared:
// - Cada género, en su casilla de la pared entera, de la columna del centro hacia fuera (antes, un bloque pequeño en el centro).
// - En los huecos: plantas, tarros, marcos, tazas, velas, un globo y un molinillo (1.142: ningún libro de adorno); lo que
//   espera en cajas, abajo, en la fila del suelo. El libro de cara, dentro de su sección y pulsable como un lomo (1.142).
// - Al atender, la estantería y la sección se siguen viendo y eligiendo igual.
// Capturas y vídeos en qa-report/cafe-estanteria/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { despedir, quieto } from './cafeBarra';
import { hacerLibro } from './cafeLibro';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { nombreOpcion, recetaPide } from '../src/features/edificio/cafe/cafeClientes';
import { CATALOGO_LIBROS } from '../src/features/edificio/cafe/cafeCatalogoLibros';
import { ELIGE, ETAPAS, gestosDe } from '../src/features/edificio/cafe/cafeGestos';
import { ESTANTERIA, paredIzquierda } from '../src/features/edificio/cafe/cafeLayout';
import { dayKey } from '../src/domain/dates';
import { alEdificio } from './entrada';

const DIR = join('qa-report', 'cafe-estanteria');
const tam = (info) => info.project.name.replace(/^(chromium|webkit)-/, '$1-');
const HOY = dayKey();
const SEMILLAS = [2100, 1000, 8919];
const PIDE1 = recetaPide({ n: 1, semilla: SEMILLAS[0] });
const DE_EJEMPLO = ['alas-sangre', 'mistborn'].map((id) => ({ id, title: id, author: '', status: 'want', pageCount: 300, cover: '', categories: [], quotes: [], addedAt: '2026-10-01T10:00:00.000Z' }));

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

/** Del catálogo del café: `n` títulos de cada género pedido, con `copias` ejemplares cada uno. */
const balda = (generos, n, copias = 1, caja = 0) =>
  generos.flatMap((g) =>
    CATALOGO_LIBROS.filter((c) => c.genero === g)
      .slice(0, n)
      .map((c, k) => ({ clave: c.clave, titulo: c.titulo, genero: g, balda: copias, caja: k === 0 ? caja : 0 })),
  );

async function alCafe(page, { nivel, libros, dominio = {} }) {
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 120, sin_raro: 3 } },
    piso_inventario: { [ANA.id]: { sillon: 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.libraries.push({ user_id: ANA.id, data: { books: DE_EJEMPLO }, updated_at: new Date().toISOString(), version: 5 });
  await page.addInitScript((b) => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!localStorage.getItem('bookshelf:v1')) localStorage.setItem('bookshelf:v1', JSON.stringify({ books: b, progress: { readingLog: [], pomodoros: [], claimed: {} } }));
  }, DE_EJEMPLO);
  await mock.attach(page, ANA);
  const estado = await simularCafe(
    page,
    { inaugurado: true, nombre: 'Taza y Lomo', nivel, granos: 40, plano: structuredClone(PLANO_INICIAL), inventario: cuenta(PLANO_INICIAL), libros: { bienvenida: true, libros }, dominio },
    { clientes: { hoy: HOY, semillas: SEMILLAS, quienes: [3], frases: [10] } },
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

/** De pie delante de la estantería de la pared, mirándola (como quien se acerca a curiosear). */
async function anteLaPared(page, nivel, distancia = 2.3, dy = 0) {
  const x = paredIzquierda(nivel) + ESTANTERIA.fondo + distancia;
  const y = (ESTANTERIA.y0 + ESTANTERIA.y1) / 2 + dy;
  await page.evaluate(([px, py]) => window.__cafe3d.place(px, py, -Math.PI / 2), [x, y]);
  await quieto(page, 900);
}

const ELIGE_DE = { bebida: 0, grano: 1, leche: 2, toque: 3 };
const BOTON = (parte, valor, receta) => (parte === 'grano' && receta[0] === 'te' ? (valor === 'suave' ? 'Hoja verde · suave' : 'Hoja negra · intensa') : nombreOpcion(parte, valor));
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

test('pocos libros (como el café de Francisco): la pared entera vestida y, al atender, se elige igual', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/.test(info.project.name), '360, 390, 430, escritorio y WebKit 390');
  test.setTimeout(200000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Nivel 3: dos géneros con 6 ejemplares cada uno y 6 esperando en la caja
  const libros = balda(['fantasia', 'misterio'], 6, 1, 3);
  const { cafe } = await alCafe(page, { nivel: 3, libros, dominio: { cafe: 12, te: 12 } });
  await anteLaPared(page, 3, 3.0);
  await page.screenshot({ path: join(DIR, `1-pared-pocos-${tam(info)}.png`) });
  await anteLaPared(page, 3, 1.3, -0.6);
  await page.screenshot({ path: join(DIR, `2-de-cerca-${tam(info)}.png`) });

  // Al atender: la estantería, la sección y el libro, como siempre
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  await prepararConPilar(page, cafe, PIDE1);
  const franja = cafe.locator('.cf3-franja--atender');
  await expect(franja).toHaveAttribute('data-paso', 'libreria');
  await hacerLibro(page, cafe, {
    foto: async (paso) => {
      if (paso === 'seccion') expect((await page.evaluate(() => window.__cafe3d.libreriaLomos())).filter((l) => l.cara && l.front)).toHaveLength(1);
      if (paso === 'estanteria' || paso === 'seccion') await page.screenshot({ path: join(DIR, `${paso === 'estanteria' ? 3 : 4}-atender-${paso}-${tam(info)}.png`) });
    },
  });
  await expect(franja).toHaveAttribute('data-paso', 'gracias', { timeout: 20000 });
  await despedir(page, cafe);
  expect(errors).toEqual([]);
  const video = page.video();
  await page.close();
  if (video && /chromium-390x844/.test(info.project.name)) await video.saveAs(join(DIR, `pocos-${tam(info)}.webm`));
});

test('muchos libros (nivel 5): siete secciones repartidas por la pared y el adorno en lo que queda', async ({ page }, info) => {
  test.skip(!/chromium-(390x844|1440x900)$/.test(info.project.name), '390 y escritorio');
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const libros = balda(['novela', 'fantasia', 'misterio', 'amor', 'ciencia-ficcion', 'historia', 'poesia'], 3, 2);
  await alCafe(page, { nivel: 5, libros });
  await anteLaPared(page, 5, 2.6);
  await page.screenshot({ path: join(DIR, `5-pared-muchos-${tam(info)}.png`) });
  expect(errors).toEqual([]);
});
