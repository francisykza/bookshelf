// 1.144 (SPEC §144; docs/qa/cafe-libreria.md §18, bloque 2 de §18.12, aprobado por Francisco el 17-11-2026) · El obrador crece:
// al volver, Pilar ha vendido de la vitrina en el mostrador y se cobra tirando del cajón de la caja de latón; la especialidad del
// día (pizarrita junto a la vitrina, marca en el recetario, +1 grano); la maestría de cada receta y «Que lo hornee Pilar» con la
// ★★★ (sus manos hacen los gestos); y la página de las mejoras: el horno (puerta de hierro, azulejos) y la vitrina (madera,
// mostrador, dos alturas). El servidor simulado aplica las reglas de `20261226120000_cafe_obrador_mejoras.sql`. Capturas y vídeo
// con sonido en qa-report/v1144/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { quieto } from './cafeBarra';
import { grabarSonido, guardarConSonido, sonidoGrabado } from './cafeSonido';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { generoDe } from '../src/features/edificio/cafe/cafeClientes';
import { umbralHito } from '../src/features/edificio/cafe/cafeNiveles';
import { dayKey } from '../src/domain/dates';
import { alEdificio } from './entrada';

const DIR = join('qa-report', 'v1144');
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
const LIBROS = [libro('f', 'El dragón del muelle', { categories: ['Fantasy'] }), libro('m', 'Crimen en la lonja', { categories: ['Mystery'] }), libro('n', 'Un libro sin más')];
const BALDA = { bienvenida: true, libros: LIBROS.map((b) => ({ clave: b.id, titulo: b.title, genero: generoDe(b), caja: 0, balda: 1 })) };
const SONIDO = { v: 1, on: true, decided: true, legacy: false, effects: 40, ambience: 15, music: 40, master: 80, ambienceId: 'none', musicId: 'tarde', lastAmbience: 'none', lastMusic: 'tarde' };
const PLANO_4 = {
  v: 1,
  items: [
    ...PLANO_INICIAL.items,
    { uid: 'a2', id: 'cafe-mesa-larga', x: -3, y: 1, rot: 0 },
    { uid: 'a3', id: 'cafe-banco', x: -3, y: 2, rot: 2 },
    { uid: 'a4', id: 'cafe-biombo', x: -2, y: 4, rot: 2 },
  ],
};
const REP = umbralHito(4, 1) + 30;
const semillas = (s, n) => Array.from({ length: n }, (_, k) => s + k * 7919);
const sonidos = (page) => page.evaluate(() => window.__cafeSonidos ?? []);

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

async function alCafe(page, estado, obrador, { reducido = false } = {}) {
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
    { clientes: { hoy: HOY, semillas: semillas(4100, 6), quienes: [3], frases: [10] }, obrador },
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

/** En el ala, unos pasos atrás, mirando al fondo: el obrador entero. */
async function anteElAla(page) {
  await page.evaluate(() => window.__cafe3d.place(-0.9, 4.6, Math.atan2(-2 + 0.9, 0.3 - 4.6)));
  await quieto(page);
}

/** Al recetario, desde el ala. */
async function alRecetario(page, cafe) {
  await anteElAla(page);
  const tag = cafe.locator('.cf3-tags button', { hasText: 'El obrador' });
  await expect(tag).toBeVisible();
  await tag.click();
  const recetario = cafe.locator('.cf3-recetario');
  await expect(recetario).toBeVisible({ timeout: 20000 });
  return recetario;
}

test('la caja del mostrador, la especialidad, las mejoras y Pilar en el horno', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844)$/.test(info.project.name), 'a 360 y 390');
  test.setTimeout(300000);
  const t0 = Date.now();
  const conSonido = /390x844/.test(info.project.name);
  if (conSonido) await grabarSonido(page);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let n = 0;
  const foto = async (nombre) => {
    n += 1;
    await page.screenshot({ path: join(DIR, `mejoras-${String(n).padStart(2, '0')}-${nombre}-${tam(info)}.png`) });
  };
  const { cafe, c } = await alCafe(
    page,
    { granos: 600 },
    { abierto: true, piezas: { magdalenas: 8, empanada: 5 }, mostrador: { dias: 2 }, especialidad: 'empanada', buenas: { magdalenas: 25, empanada: 4 }, segundos: { magdalenas: 40, empanada: 6 } },
  );

  // 1. Pilar ha vendido en el mostrador mientras no estabas: a la caja, a tirar del cajón
  const caja = cafe.locator('.cf3-franja--caja');
  await expect(caja).toBeVisible({ timeout: 20000 });
  await expect(caja).toContainText('Tira del cajón de la caja');
  await page.waitForFunction(() => window.__cafe3d.enVitrina() && window.__cafe3d.settled());
  const zona = cafe.locator('.cf3-gesto[data-activo="true"]');
  await expect(zona.locator('.cf3-gesto__pista')).toBeVisible();
  await quieto(page, 300);
  await foto('caja');
  const p = await zona.locator('.cf3-gesto__pista').boundingBox();
  const fr = await caja.boundingBox();
  const e = Math.min((await zona.boundingBox()).width, 600) / 390;
  const x = p.x + p.width / 2;
  const y = Math.min(p.y + p.height / 2, fr.y - 150 * e);
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let k = 1; k <= 12; k += 1) {
    await page.mouse.move(x, y + k * 12 * e);
    if (k === 6) await foto('cajon-a-medias');
  }
  await page.mouse.up();
  await expect(caja).toHaveAttribute('data-fase', 'hecho', { timeout: 8000 });
  // Dos días a 4 por día: primero la especialidad (las cinco empanadas, a 4) y después tres magdalenas (a 2)
  await expect(caja).toContainText('Mientras no estabas se llevaron tres magdalenas y cinco raciones de empanada.');
  await expect(caja.locator('.cf3-caja-mostrador__cuenta')).toHaveText('8 piezas en 2 días: +26 granos');
  expect(c.granos).toBe(626);
  expect(c.obrador.piezas).toEqual({ magdalenas: 5, empanada: 0 });
  await quieto(page, 500);
  await foto('cajon-con-granos');
  await caja.getByRole('button', { name: 'Volver' }).click();
  await page.waitForFunction(() => !window.__cafe3d.enVitrina());

  // 2. El recetario: la especialidad marcada, la maestría y, con ★★★, «Que lo hornee Pilar»
  const recetario = await alRecetario(page, cafe);
  await expect(recetario.locator('.cf3-papeleta[data-tipo]')).toHaveCount(6);
  await expect(recetario.locator('.cf3-papeleta')).toHaveCount(7);
  const magdalenas = recetario.locator('.cf3-papeleta', { hasText: 'Magdalenas de limón' });
  await expect(magdalenas.locator('.cf3-maestria')).toHaveAttribute('aria-label', 'Maestría: 3 de 3');
  await expect(magdalenas).toContainText('Pilar la hace de memoria.');
  await expect(magdalenas).toContainText('Salen de 5 a 7 magdalenas');
  await expect(magdalenas).toContainText('3 granos cada una en la mesa');
  await expect(magdalenas.getByRole('button', { name: 'Que lo hornee Pilar' })).toBeVisible();
  await quieto(page, 300);
  await foto('ficha-maestria');
  const empanada = recetario.locator('.cf3-papeleta', { hasText: 'Empanada de bonito' });
  await empanada.scrollIntoViewIfNeeded();
  await expect(empanada).toHaveAttribute('data-especialidad', 'true');
  await expect(empanada).toContainText('Especialidad de hoy');
  await expect(empanada.locator('.cf3-maestria')).toHaveAttribute('aria-label', 'Maestría: 1 de 3');
  await expect(empanada).toContainText('6 hornadas buenas más: un grano más por pieza servida en la mesa.');
  await expect(empanada).toContainText('4 granos cada una en la mesa');
  await expect(empanada.getByRole('button', { name: 'Que lo hornee Pilar' })).toHaveCount(0);
  await quieto(page, 400);
  await foto('ficha-especialidad');

  // 3. La última página: las mejoras del obrador
  const siguiente = recetario.getByRole('button', { name: 'Página siguiente' });
  // Página a página (la flecha se apaga en la última: sin esperar a pulsarla apagada)
  for (let k = 0; k < 8 && (await siguiente.isEnabled()); k += 1) {
    await siguiente.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(350);
  }
  const hoja = recetario.locator('.cf3-papeleta--obrador');
  await expect(hoja).toBeInViewport();
  await expect(hoja.locator('.cf3-papeleta__granos')).toHaveText('626 granos');
  await expect(hoja.locator('.cf3-mejora[data-mejora="horno"]')).toContainText('Restaurado');
  await quieto(page, 400);
  await foto('mejoras');
  await hoja.locator('.cf3-mejora[data-mejora="horno"]').getByRole('button', { name: 'Mejorar · 250 granos' }).click();
  await expect(recetario.locator('.cf3-recetario__estado')).toContainText('Qué bien suena la puerta nueva');
  await hoja.locator('.cf3-mejora[data-mejora="vitrina"]').getByRole('button', { name: 'Mejorar · 150 granos' }).click();
  await expect(recetario.locator('.cf3-recetario__estado')).toContainText('Mira cuánto sitio');
  await expect(hoja.locator('.cf3-mejora[data-mejora="horno"]')).toContainText('La puerta de hierro');
  await expect(hoja.locator('.cf3-mejora[data-mejora="horno"]').getByRole('button')).toHaveText('En el nivel 6');
  await expect(hoja.locator('.cf3-mejora[data-mejora="vitrina"]').getByRole('button')).toHaveText('En el nivel 5');
  await expect(hoja).toContainText('En la vitrina caben 20');
  await expect(hoja).toContainText('Pilar vende 6 al día en el mostrador');
  await expect(hoja).toContainText('Ha vendido 8 por 26 granos');
  expect(c.obrador.horno).toBe(2);
  expect(c.obrador.vitrina).toBe(2);
  expect(c.granos).toBe(226);
  await quieto(page, 300);
  await foto('mejoras-compradas');

  // 4. «Que lo hornee Pilar»: sus manos rallan, colman y meten la pala (y el horno, ya con su puerta de hierro)
  await magdalenas.scrollIntoViewIfNeeded();
  await quieto(page, 300);
  await magdalenas.getByRole('button', { name: 'Que lo hornee Pilar' }).click();
  const franja = cafe.locator('.cf3-franja--obrador');
  await expect(franja).toHaveAttribute('data-gesto', 'rallar', { timeout: 8000 });
  await expect(franja.locator('.cf3-quien')).toHaveText('Pilar');
  await expect(franja).toContainText('Déjamelo a mí');
  await expect(cafe.locator('.cf3-gesto[data-activo="true"]')).toHaveCount(0);
  await page.waitForFunction(() => (window.__cafeSonidos ?? []).includes('rallar'), null, { timeout: 8000 });
  await foto('pilar-ralla');
  await expect(franja).toHaveAttribute('data-gesto', 'colmar', { timeout: 8000 });
  await page.waitForFunction(() => (window.__cafeSonidos ?? []).includes('colmado'), null, { timeout: 8000 });
  await foto('pilar-colma');
  await expect(franja).toHaveAttribute('data-fase', 'horneando', { timeout: 10000 });
  await expect(franja.locator('.cf3-estrellas')).toHaveAttribute('aria-label', '3 de 3 estrellas');
  await expect(franja).toContainText('Saldrán 7 magdalenas');
  await expect(franja).toContainText('Al horno. Te aviso con la campanilla.');
  expect(c.obrador.horneando).toHaveLength(1);
  expect(c.obrador.dadoPilar).toBe(1);
  await quieto(page, 600);
  await foto('pilar-al-horno');
  // Con dos bandejas, la otra sigue libre
  await cafe.getByRole('button', { name: 'Al recetario' }).click();
  await empanada.scrollIntoViewIfNeeded();
  await expect(empanada.getByRole('button', { name: 'Hornear' })).toBeEnabled();
  await recetario.getByRole('button', { name: 'Volver' }).click();
  await page.waitForFunction(() => !window.__cafe3d.enObrador());

  // 5. La vitrina de madera en la barra, con la pizarrita de la especialidad
  await page.evaluate(() => window.__cafe3d.place(6.4, 4.45, Math.atan2(7.5 - 6.4, 4.25 - 4.45)));
  await quieto(page, 500);
  await foto('vitrina-de-madera');

  const oidos = await sonidos(page);
  expect(oidos).toEqual(expect.arrayContaining(['cajonCaja', 'granosCajon', 'mejora', 'recetario', 'fichaReceta', 'rallar', 'colmado', 'obradorHecho', 'horno']));
  expect(errors).toEqual([]);
  const sonido = conSonido ? await sonidoGrabado(page) : null;
  if (conSonido) expect(sonido?.b64?.length ?? 0).toBeGreaterThan(1000);
  const video = page.video();
  await page.close();
  if (video && conSonido) await guardarConSonido(video, join(DIR, `mejoras-${tam(info)}.webm`), sonido, t0);
});

test('la vitrina y el horno, grado a grado', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844)$/.test(info.project.name), 'a 360 y 390');
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const piezas = { magdalenas: 22, empanada: 20 };
  await alCafe(page, {}, { abierto: true, piezas: { magdalenas: 6 }, especialidad: 'magdalenas' });
  for (const grado of [1, 2, 3, 4]) {
    await page.evaluate(
      ({ g, pz }) => {
        window.__cafe3d.vitrina(true);
        window.__cafe3d.setVitrina({ piezas: pz, grado: g, especialidad: 'magdalenas' });
      },
      { g: grado, pz: piezas },
    );
    await page.waitForFunction(() => window.__cafe3d.settled());
    await quieto(page, 400);
    await page.screenshot({ path: join(DIR, `vitrina-grado-${grado}-${tam(info)}.png`) });
  }
  // Con pocas piezas, desde el lado de los clientes (como se ve paseando)
  await page.evaluate(() => {
    window.__cafe3d.vitrina(false);
    window.__cafe3d.setVitrina({ piezas: { magdalenas: 9, empanada: 7 }, grado: 3, especialidad: 'empanada' });
    window.__cafe3d.place(6.4, 4.45, Math.atan2(7.5 - 6.4, 4.25 - 4.45));
  });
  await quieto(page, 500);
  await page.screenshot({ path: join(DIR, `vitrina-mostrador-paseando-${tam(info)}.png`) });
  for (const grado of [1, 2, 3]) {
    await page.evaluate((g) => {
      window.__cafe3d.obrador(true);
      window.__cafe3d.setObrador({ abierto: true, vista: 'todo', horno: g, horneando: [{ receta: 'magdalenas', t: 0.6 }] });
    }, grado);
    await page.waitForFunction(() => window.__cafe3d.settled());
    await quieto(page, 400);
    await page.screenshot({ path: join(DIR, `horno-grado-${grado}-${tam(info)}.png`) });
  }
  expect(errors).toEqual([]);
});

test('con movimiento reducido: el cajón y «Que lo hornee Pilar», de un toque', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'Chromium 390');
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { cafe, c } = await alCafe(page, {}, { abierto: true, piezas: { magdalenas: 3 }, mostrador: { dias: 1 }, buenas: { magdalenas: 30 } }, { reducido: true });
  const caja = cafe.locator('.cf3-franja--caja');
  await expect(caja).toBeVisible({ timeout: 20000 });
  await caja.getByRole('button', { name: 'Abrir el cajón' }).click();
  await expect(caja).toHaveAttribute('data-fase', 'hecho', { timeout: 8000 });
  await expect(caja).toContainText('Mientras no estabas se llevaron tres magdalenas.');
  await page.screenshot({ path: join(DIR, `reducido-cajon-${tam(info)}.png`) });
  await caja.getByRole('button', { name: 'Volver' }).click();
  const recetario = await alRecetario(page, cafe);
  await recetario.locator('.cf3-papeleta', { hasText: 'Magdalenas de limón' }).getByRole('button', { name: 'Que lo hornee Pilar' }).click();
  const franja = cafe.locator('.cf3-franja--obrador');
  await expect(franja).toHaveAttribute('data-fase', 'horneando', { timeout: 8000 });
  await expect(franja.locator('.cf3-estrellas')).toHaveAttribute('aria-label', '3 de 3 estrellas');
  await page.screenshot({ path: join(DIR, `reducido-pilar-${tam(info)}.png`) });
  expect(c.obrador.horneando).toHaveLength(1);
  expect(errors).toEqual([]);
});
