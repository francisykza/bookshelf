// 1.143 (SPEC §143; docs/qa/cafe-libreria.md §18, bloque 1 de §18.12, aprobado por Francisco el 17-11-2026) · El obrador: en el
// nivel 4, tras el tabique del ala, el horno de la antigua tahona y su recetario. Pilar lo enseña y la primera hornada de la casa
// (seis magdalenas) ya está en la vitrina de la barra. Se hornea con dos gestos por receta (la empanada: el rodillo y el
// repulgo; las magdalenas: rallar el limón y colmar los moldes), la pala al horno, la campanilla y la pala fuera; lo que no cabe
// en la vitrina espera en la bandeja. Al servir la bebida, el cliente pide algo dulce y se le lleva una magdalena con las pinzas
// (+2 granos). Con movimiento reducido, cada gesto de un toque. El servidor simulado aplica las reglas de
// `20261225120000_cafe_obrador.sql` (con hornos de segundos, para no esperar). Capturas y vídeo en qa-report/v1143/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { quieto } from './cafeBarra';
import { grabarSonido, guardarConSonido, sonidoGrabado } from './cafeSonido';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { generoDe, nombreOpcion } from '../src/features/edificio/cafe/cafeClientes';
import { ELIGE, ETAPAS } from '../src/features/edificio/cafe/cafeGestos';
import { estrellasBebida } from '../src/features/edificio/cafe/cafeObrador';
import { umbralHito } from '../src/features/edificio/cafe/cafeNiveles';
import { dayKey } from '../src/domain/dates';
import { alEdificio } from './entrada';

const DIR = join('qa-report', 'v1143');
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
const SONIDO = { v: 1, on: true, decided: true, legacy: false, effects: 40, ambience: 15, music: 40, master: 80, ambienceId: 'none', musicId: 'tarde', lastAmbience: 'none', lastMusic: 'tarde' };
/** El plano del nivel 4: el de siempre y, en el ala, la mesa larga con su banco, el biombo y la lámpara de bankers (nada delante del horno). */
const PLANO_4 = {
  v: 1,
  items: [
    ...PLANO_INICIAL.items,
    { uid: 'a2', id: 'cafe-mesa-larga', x: -3, y: 1, rot: 0 },
    { uid: 'a3', id: 'cafe-banco', x: -3, y: 2, rot: 2 },
    { uid: 'a4', id: 'cafe-biombo', x: -2, y: 4, rot: 2 },
    { uid: 'a5', id: 'cafe-bankers', x: -1, y: 1, rot: 0 },
  ],
};
const REP = umbralHito(4, 1) + 30;
const semillas = (s, n) => Array.from({ length: n }, (_, k) => s + k * 7919);
/** El café que prepara Pilar (no hace falta que sea justo lo que pide: aquí se mira el obrador). */
const RECETA = ['cafe', 'intenso', 'entera', 'canela'];
const ELIGE_DE = { bebida: 0, grano: 1, leche: 2, toque: 3 };
const sonidos = (page) => page.evaluate(() => window.__cafeSonidos ?? []);

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

async function alCafe(page, estado, obrador, { reducido = false, reparto = false } = {}) {
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 120, sin_raro: 3 } },
    piso_inventario: { [ANA.id]: { sillon: 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.libraries.push({ user_id: ANA.id, data: { books: LIBROS }, updated_at: new Date().toISOString(), version: 5 });
  if (reducido) await page.emulateMedia({ reducedMotion: 'reduce' });
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
  const plano = structuredClone(PLANO_4);
  const c = await simularCafe(
    page,
    { inaugurado: true, nombre: 'Taza y Lomo', granos: 40, nivel: 4, reputacion: REP, plano, inventario: cuenta(plano), libros: BALDA, dominio: { cafe: 12, te: 12, chocolate: 12 }, ...estado },
    { clientes: { hoy: HOY, semillas: semillas(4100, 6), quienes: [3], frases: [10], reparto }, obrador },
  );
  await page.goto('/');
  await alEdificio(page);
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' }).click({ timeout: 15000 });
  const cafe = page.getByRole('dialog', { name: 'El café-librería del bajo' });
  await expect(cafe.locator('.cf3[data-ready="true"]')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__cafe3d?.settled() && window.__cafe3d.renders() > 0);
  return { cafe, c };
}

/** En el ala, unos pasos atrás, mirando al fondo: el obrador (o el tabique) entero. */
async function anteElAla(page) {
  await page.evaluate(() => window.__cafe3d.place(-0.9, 4.6, Math.atan2(-2 + 0.9, 0.3 - 4.6)));
  await quieto(page);
}

/** Un gesto del obrador con el ratón, como el dedo, sobre su objeto (donde está la pista). `foto`, a medio gesto. */
async function gesto(page, cafe, tipo, foto) {
  const franja = cafe.locator('.cf3-franja--obrador');
  await expect(franja).toHaveAttribute('data-gesto', tipo, { timeout: 8000 });
  const zona = cafe.locator('.cf3-gesto[data-activo="true"]');
  await page.waitForFunction(() => window.__cafe3d.enObrador() && window.__cafe3d.settled());
  await expect(zona.locator('.cf3-gesto__pista')).toBeVisible();
  await quieto(page, 250);
  await foto?.(`${tipo}-pista`);
  const p = await zona.locator('.cf3-gesto__pista').boundingBox();
  const fr = await franja.boundingBox();
  const zb = await zona.boundingBox();
  const e = Math.min(zb.width, 600) / 390;
  const c = { x: p.x + p.width / 2, y: p.y + p.height / 2 };
  const m = page.mouse;
  const recta = async (x0, y0, x1, y1, n = 12) => {
    for (let k = 1; k <= n; k += 1) await m.move(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n);
  };
  const marca = (nombre) => page.evaluate((n) => window.__cafe3d.obradorMarca(n), nombre);
  if (tipo === 'rallar') {
    // Pasadas largas de arriba abajo
    const y0 = Math.min(c.y - 60 * e, fr.y - 170 * e);
    for (let k = 0; k < 6; k += 1) {
      await m.move(c.x, y0);
      await m.down();
      await recta(c.x, y0, c.x, y0 + 125 * e, 10);
      if (k === 2) await foto?.(tipo);
      await m.up();
    }
  } else if (tipo === 'colmar') {
    // Una pasada de ida y otra de vuelta por encima de los seis moldes
    const [a, b] = [await marca('moldeIzq'), await marca('moldeDer')];
    const y = Math.min(c.y, fr.y - 30);
    await m.move(a.x + 1, y);
    await m.down();
    await recta(a.x + 1, y, b.x - 2, y, 40);
    await foto?.(tipo);
    await recta(b.x - 2, y, a.x + 1, y, 40);
    await m.up();
  } else if (tipo === 'rodillo') {
    // Arriba y abajo, de punta a punta de la masa
    const y0 = Math.min(c.y - 70 * e, fr.y - 180 * e);
    await m.move(c.x, y0);
    await m.down();
    await recta(c.x, y0, c.x, y0 + 145 * e, 14);
    await recta(c.x, y0 + 145 * e, c.x, y0, 14);
    await foto?.(tipo);
    await recta(c.x, y0, c.x, y0 + 145 * e, 14);
    await m.up();
  } else if (tipo === 'repulgo') {
    // Una vuelta al borde de la fuente
    const [cen, bo] = [await marca('fuente'), await marca('fuenteBorde')];
    const R = Math.abs(bo.x - cen.x) * 0.92;
    await m.move(cen.x + R, cen.y);
    await m.down();
    for (let k = 1; k <= 76; k += 1) {
      const ang = (k / 72) * 2 * Math.PI;
      await m.move(cen.x + Math.cos(ang) * R, cen.y + Math.sin(ang) * R);
      if (k === 40) await foto?.(tipo);
    }
    await m.up();
  } else {
    // La pala: hacia el fondo (meter) o hacia ti (sacar)
    const d = (tipo === 'meter' ? -1 : 1) * 135 * e;
    const y0 = tipo === 'meter' ? Math.min(c.y, fr.y - 20) : Math.min(c.y, fr.y - 150 * e);
    await m.move(c.x, y0);
    await m.down();
    await recta(c.x, y0, c.x, y0 + d * 0.6, 8);
    await foto?.(tipo);
    await recta(c.x, y0 + d * 0.6, c.x, y0 + d, 6);
    await m.up();
  }
}

/** Del recetario a la hornada en el horno: elegir la página, los dos gestos y la pala. */
async function hornear(page, cafe, nombre, gestos, foto) {
  const recetario = cafe.locator('.cf3-recetario');
  await expect(recetario).toBeVisible();
  const ficha = recetario.locator('.cf3-papeleta', { hasText: nombre });
  await ficha.scrollIntoViewIfNeeded();
  await quieto(page, 300);
  await foto?.(`ficha-${gestos[0]}`);
  await ficha.getByRole('button', { name: 'Hornear' }).click();
  const franja = cafe.locator('.cf3-franja--obrador');
  for (const t of gestos) {
    await gesto(page, cafe, t, foto);
    // Lo que dice Pilar de cómo ha quedado, antes del siguiente
    await expect(cafe.locator('.cf3-gesto__hecho[data-mimo="bien"]')).toBeVisible();
    await foto?.(`${t}-bien`);
  }
  await gesto(page, cafe, 'meter', foto);
  await expect(franja).toHaveAttribute('data-fase', 'horneando', { timeout: 8000 });
  await expect(franja.locator('.cf3-estrellas')).toHaveAttribute('aria-label', '3 de 3 estrellas');
}

/** A la barra con el cliente que se atiende: Pilar prepara su café, hasta la taza lista. */
async function prepararCafe(page, cafe) {
  const caja = cafe.locator('.cf3-franja--atender').first();
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await page.waitForFunction(() => window.__cafe3d.enBarra());
  for (const etapa of ETAPAS) {
    await expect(caja).toHaveAttribute('data-etapa', etapa, { timeout: 12000 });
    if (!ELIGE[etapa]) continue;
    const v = RECETA[ELIGE_DE[etapa]];
    await cafe
      .locator('.cf3-opciones')
      .getByRole('button', { name: nombreOpcion(etapa, v), exact: true })
      .click();
    if (etapa === 'bebida') {
      const oferta = cafe.locator('.cf3-pilar');
      if (await oferta.isVisible().catch(() => false)) await oferta.getByRole('button', { name: 'Que lo prepare Pilar' }).click();
    }
  }
  await expect(caja).toHaveAttribute('data-etapa', 'lista', { timeout: 15000 });
}

test('nivel 4: se abre el obrador, se hornea la empanada y las magdalenas y se sirve una con las pinzas', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844)$/.test(info.project.name), 'a 360 y 390');
  test.setTimeout(360000);
  const t0 = Date.now();
  const conSonido = /390x844/.test(info.project.name);
  if (conSonido) await grabarSonido(page);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let n = 0;
  const foto = async (nombre) => {
    n += 1;
    await page.screenshot({ path: join(DIR, `obrador-${String(n).padStart(2, '0')}-${nombre}-${tam(info)}.png`) });
  };
  const { cafe, c } = await alCafe(page, {}, { piden: { 1: 'dulce', 2: 'dulce', 3: 'dulce', 4: 'salado', 5: 'salado' }, segundos: { empanada: 8, magdalenas: 40 } });

  // 1. Tras el tabique del ala: «¿Y esta pared?»
  await anteElAla(page);
  const tag = cafe.locator('.cf3-tags button', { hasText: '¿Y esta pared?' });
  await expect(tag).toBeVisible();
  await foto('tabique');
  await tag.click();
  const franja = cafe.locator('.cf3-franja--obrador');
  await expect(franja).toHaveAttribute('data-fase', 'descubre', { timeout: 20000 });
  await page.waitForFunction(() => window.__cafe3d.enObrador() && window.__cafe3d.settled());
  await quieto(page, 400);
  await expect(franja).toContainText('el horno de la tahona de doña Amparo');
  await foto('descubre');
  await cafe.getByRole('button', { name: 'Seguir' }).click();
  await expect(franja).toContainText('Ya están en la vitrina de la barra');
  await cafe.getByRole('button', { name: 'Abrir el recetario' }).click();
  expect(c.obrador.abierto).toBe(true);
  expect(c.obrador.piezas.magdalenas).toBe(6);

  // 2. El recetario: seis páginas, dos que se hornean; las demás dicen su nivel
  const recetario = cafe.locator('.cf3-recetario');
  await expect(recetario).toBeVisible();
  await expect(recetario.locator('.cf3-recetario__vitrina')).toHaveText('En la vitrina: 6 de 12');
  await expect(recetario.locator('.cf3-papeleta[data-tipo]')).toHaveCount(6);
  await expect(recetario.locator('.cf3-papeleta[data-tipo][data-abierta="true"]')).toHaveCount(2);
  await quieto(page, 300);
  await foto('recetario');
  await expect(recetario.locator('.cf3-papeleta', { hasText: 'Galletas del puerto' })).toContainText('Se abre en el nivel 5');

  // 3. La empanada: el rodillo, el repulgo y la pala al horno; la campanilla y la pala fuera
  await hornear(page, cafe, 'Empanada de bonito', ['rodillo', 'repulgo'], foto);
  await quieto(page, 1100);
  await foto('horneando');
  await expect(franja).toHaveAttribute('data-fase', 'sacar', { timeout: 20000 });
  await quieto(page, 300);
  await foto('campanilla');
  await gesto(page, cafe, 'sacar', foto);
  await expect(franja).toHaveAttribute('data-fase', 'hecho', { timeout: 8000 });
  await expect(franja).toContainText('6 más para la vitrina');
  await quieto(page, 1100);
  await foto('a-la-vitrina');
  expect(c.obrador.piezas).toEqual({ magdalenas: 6, empanada: 6 });

  // 4. Las magdalenas: rallar el limón, colmar los moldes y al horno; mientras se hacen, al café
  await cafe.getByRole('button', { name: 'Otra hornada' }).click();
  await hornear(page, cafe, 'Magdalenas de limón', ['rallar', 'colmar'], foto);
  await cafe.getByRole('button', { name: 'Volver al café' }).click();
  await page.waitForFunction(() => !window.__cafe3d.enObrador());
  await anteElAla(page);
  await quieto(page, 400);
  await foto('dorandose');

  // 5. Máximo dos cosas por cliente (Francisco, 17-11-2026): este pide café y algo dulce, sin libro. La taza, de la barra a la
  // vitrina; con las pinzas, una magdalena al plato; y la taza y el plato en la bandeja, a su mesa, en un solo viaje
  const atender = cafe.locator('.cf3-franja--atender').first();
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  await expect(atender).toHaveAttribute('data-paso', 'pide', { timeout: 8000 });
  await expect(atender).toHaveAttribute('data-pide-comida', 'dulce');
  await expect(atender).toContainText('algo dulce');
  const comanda = cafe.locator('.cf3-comanda');
  await expect(comanda.locator('.cf3-comanda__linea--comida')).toContainText('Algo dulce para acompañar');
  await expect(comanda.locator('.cf3-comanda__linea--libro')).toHaveCount(0);
  await quieto(page, 400);
  await foto('pide-dulce');
  await prepararCafe(page, cafe);
  await expect(atender).toContainText('Ahora, algo dulce de la vitrina');
  await expect(cafe.getByRole('button', { name: 'Llevársela' })).toHaveCount(0);
  await cafe.getByRole('button', { name: 'A la vitrina' }).click();
  await expect(atender).toHaveAttribute('data-paso', 'vitrina');
  await expect(atender).toHaveAttribute('data-vitrina', 'pinzas');
  await page.waitForFunction(() => window.__cafe3d.enVitrina() && window.__cafe3d.settled());
  const zona = cafe.locator('.cf3-gesto[data-activo="true"]');
  await expect(zona.locator('.cf3-gesto__pista')).toBeVisible();
  await expect(comanda).toHaveAttribute('data-solo-comida', 'true');
  await expect(comanda.locator('.cf3-comanda__linea--comida')).toHaveAttribute('data-ahora', 'true');
  await quieto(page, 250);
  await foto('vitrina');
  const p = await zona.locator('.cf3-gesto__pista').boundingBox();
  const fr = await atender.boundingBox();
  const e = Math.min((await zona.boundingBox()).width, 600) / 390;
  const x = p.x + p.width / 2;
  const y = Math.min(p.y + p.height / 2, fr.y - 120 * e);
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let k = 1; k <= 10; k += 1) {
    await page.mouse.move(x, y + k * 11 * e);
    if (k === 6) await foto('pinzas');
  }
  await page.mouse.up();
  // La taza y el plato, juntos en la bandeja, camino de su mesa
  await expect(atender).toHaveAttribute('data-paso', 'yendo', { timeout: 8000 });
  await expect(atender).toContainText('Con la bandeja');
  // A mitad de camino (sin esperar a que se pare: el paseo es corto)
  await foto('bandeja-taza-y-plato');
  await expect(atender).toHaveAttribute('data-paso', 'gracias', { timeout: 20000 });
  await expect(atender).toContainText('Como las de mi abuela');
  await expect(atender.locator('.cf3-repaso [data-parte="comida"]')).toHaveText('✓ Magdalenas de limón');
  await expect(atender.locator('.cf3-dado__ficha--comida')).toHaveText(/^[0-9]+ por la magdalena$/);
  // Sus estrellas, solo de la bebida (sin libro que sumar)
  const aciertos = await atender.locator('.cf3-repaso li:not([data-parte])[data-ok="true"]').count();
  await expect(atender.locator('.cf3-resultado .cf3-estrellas')).toHaveAttribute('aria-label', estrellasBebida(aciertos) + ' de 3 estrellas');
  await quieto(page, 500);
  // El plato, en su mesita junto al cliente, a la vista (por encima de la franja)
  const plato = await page.evaluate(() => window.__cafe3d.platoEnPantalla(1));
  const caja = await atender.boundingBox();
  expect(plato?.front).toBe(true);
  expect(plato.y).toBeLessThan(caja.y);
  expect(plato.x).toBeGreaterThan(20);
  expect(plato.x).toBeLessThan(page.viewportSize().width - 20);
  await foto('magdalena-en-la-mesa');
  expect(c.obrador.piezas.magdalenas).toBe(5);
  expect(c.obrador.vendidas).toBe(1);
  await cafe.getByRole('button', { name: 'Hasta luego' }).click();
  // El cartel de lo conseguido (los tickets del primer cliente del día), después de despedirle
  const logro = page.locator('.cf3-logro');
  if (await logro.isVisible().catch(() => false)) await logro.locator('.cf3-logro__ok').click();
  // Desde su costado, el plato en la mesita junto al cliente
  await page.evaluate(({ en, cliente }) => {
    const [dx, dy] = [en[0] - cliente[0], en[1] - cliente[1]];
    const n = Math.hypot(dx, dy) || 1;
    const [x, y] = [en[0] + (dx / n) * 1.3, en[1] + (dy / n) * 1.3];
    window.__cafe3d.place(x, y, Math.atan2(cliente[0] - x, cliente[1] - y));
  }, plato);
  await quieto(page, 400);
  await foto('plato-junto-al-cliente');

  // 6. La campanilla: «El obrador · ¡listo!»; dentro, la pala fuera; la vitrina, llena: el resto espera en la bandeja
  await anteElAla(page);
  const listo = cafe.locator('.cf3-tags button', { hasText: 'El obrador · ¡listo!' });
  await expect(listo).toBeVisible({ timeout: 45000 });
  await foto('listo');
  await listo.click();
  await expect(franja).toHaveAttribute('data-fase', 'sacar', { timeout: 20000 });
  await gesto(page, cafe, 'sacar', null);
  await expect(franja).toHaveAttribute('data-fase', 'hecho', { timeout: 8000 });
  await expect(franja).toContainText('Una más para la vitrina');
  await expect(franja).toContainText('espera calentito en la bandeja');
  await expect(franja).toContainText('5 magdalenas esperan en la bandeja');
  await quieto(page, 1100);
  await foto('vitrina-llena');
  expect(c.obrador.piezas).toEqual({ magdalenas: 6, empanada: 6 });
  expect(c.obrador.horneando).toHaveLength(1);
  await cafe.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.waitForFunction(() => !window.__cafe3d.enObrador());

  const oidos = await sonidos(page);
  expect(oidos).toEqual(
    expect.arrayContaining([
      'tabique',
      'recetario',
      'fichaReceta',
      'rodillo',
      'vueltaRodillo',
      'pellizco',
      'obradorHecho',
      'pala',
      'horno',
      'campanillaHorno',
      'vitrina',
      'rallar',
      'masa',
      'colmado',
      'pinza',
      'plato',
      'granos',
    ]),
  );
  expect(errors).toEqual([]);
  const sonido = conSonido ? await sonidoGrabado(page) : null;
  if (conSonido) expect(sonido?.b64?.length ?? 0).toBeGreaterThan(1000);
  const video = page.video();
  await page.close();
  if (video && conSonido) await guardarConSonido(video, join(DIR, `obrador-${tam(info)}.webm`), sonido, t0);
});

test('con movimiento reducido: cada gesto del obrador, de un toque, y queda bien', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'Chromium 390');
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { cafe, c } = await alCafe(page, {}, { abierto: true, piezas: { magdalenas: 3 } }, { reducido: true });
  await anteElAla(page);
  const tag = cafe.locator('.cf3-tags button', { hasText: 'El obrador' });
  await expect(tag).toBeVisible();
  await tag.click();
  const recetario = cafe.locator('.cf3-recetario');
  await expect(recetario).toBeVisible({ timeout: 20000 });
  await expect(recetario.locator('.cf3-recetario__vitrina')).toHaveText('En la vitrina: 3 de 12');
  await recetario.locator('.cf3-papeleta', { hasText: 'Empanada de bonito' }).getByRole('button', { name: 'Hornear' }).click();
  const franja = cafe.locator('.cf3-franja--obrador');
  for (const atajo of ['Estirar la masa', 'Hacer el repulgo', 'Meterla en el horno']) {
    await cafe.getByRole('button', { name: atajo }).click({ timeout: 10000 });
  }
  await expect(franja).toHaveAttribute('data-fase', 'horneando', { timeout: 8000 });
  await expect(franja.locator('.cf3-estrellas')).toHaveAttribute('aria-label', '3 de 3 estrellas');
  await expect(franja).toContainText('Saldrán 6 raciones de empanada');
  await page.screenshot({ path: join(DIR, `obrador-reducido-horneando-${tam(info)}.png`) });
  expect(c.obrador.horneando).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('nivel 3: la pista del obrador, una vez y sin pisar el reparto de la mañana', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'Chromium 390');
  test.setTimeout(90000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const plano = structuredClone(PLANO_INICIAL);
  const { cafe } = await alCafe(page, { nivel: 3, reputacion: umbralHito(3, 1) + 30, plano, inventario: cuenta(plano) }, undefined, { reparto: true });
  const dice = cafe.locator('.cf3-dice');
  // Primero, el reparto entero; la pista espera a que Pilar acabe y haya un rato de calma
  await expect(dice).toContainText('Ha pasado el reparto de la mañana', { timeout: 10000 });
  await page.waitForTimeout(3000);
  await expect(dice).toContainText('Ha pasado el reparto de la mañana');
  await expect(dice).toContainText('Detrás de esa pared huele a pan de otro tiempo', { timeout: 15000 });
  expect(await page.evaluate(() => localStorage.getItem('bookshelf:cafe-obrador-pista'))).toBe('1');
  await page.screenshot({ path: join(DIR, `obrador-pista-nivel3-${tam(info)}.png`) });
  // Una sola vez: se va y no vuelve
  await expect(dice).not.toContainText('huele a pan', { timeout: 10000 });
  await page.waitForTimeout(4000);
  await expect(dice).not.toContainText('huele a pan');
  expect(errors).toEqual([]);
});

test('máximo dos: quien viene a por un libro no pasa por la vitrina, aunque esté llena', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'Chromium 390');
  test.setTimeout(90000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // El 2 viene a por algo de comer; el 1, a por café y un libro
  const { cafe } = await alCafe(page, {}, { abierto: true, piezas: { magdalenas: 6, empanada: 6 }, piden: { 2: 'dulce' } });
  const atender = cafe.locator('.cf3-franja--atender').first();
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  await expect(atender).toHaveAttribute('data-paso', 'pide', { timeout: 8000 });
  await expect(atender).not.toHaveAttribute('data-pide-comida', /.+/);
  const comanda = cafe.locator('.cf3-comanda');
  await expect(comanda.locator('.cf3-comanda__linea--libro')).toHaveCount(1);
  await expect(comanda.locator('.cf3-comanda__linea--comida')).toHaveCount(0);
  await expect(atender).not.toContainText('para acompañar');
  await quieto(page, 300);
  await page.screenshot({ path: join(DIR, 'maximo-dos-libro-pide-' + tam(info) + '.png') });
  await prepararCafe(page, cafe);
  await expect(atender).toContainText('Ahora, el libro');
  await expect(cafe.getByRole('button', { name: 'A la vitrina' })).toHaveCount(0);
  await cafe.getByRole('button', { name: 'Llevársela' }).click();
  await expect(atender).toHaveAttribute('data-paso', 'libreria', { timeout: 8000 });
  expect(await page.evaluate(() => window.__cafe3d.enVitrina())).toBe(false);
  expect(errors).toEqual([]);
});
