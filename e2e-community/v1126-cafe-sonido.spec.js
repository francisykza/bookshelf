// 1.126 (SPEC §126; Francisco, 13-11-2026, tras probar la 1.125) · El sonido del café y la barra más ligera. Con el sonido
// activado, el café pone su música propia (la de Sonido se calla mientras estás dentro y vuelve al salir) y cada acción suena:
// andar, Pilar, la comanda, la taza en la mesa, las estrellas, los granos y la despedida. En la barra, la franja de abajo se
// queda en una línea con las etapas en fichitas, y el cómo de cada gesto va en una notita junto al objeto, sin tapar las
// herramientas. Capturas y vídeo en qa-report/cafe-sonido/.
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
import { umbralHito } from '../src/features/edificio/cafe/cafeNiveles';
import { dayKey } from '../src/domain/dates';

const DIR = join('qa-report', 'cafe-sonido');
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
const portada = (n) => `https://covers.openlibrary.org/b/id/${n}-L.jpg`;
/**
 * Con PORTADAS_REALES=1, tres libros conocidos con su portada real de Open Library (por ISBN, de la red, sin simular)
 * y las capturas con el sufijo «-reales». Sin la variable, portadas de prueba servidas por la propia prueba.
 */
const REALES = process.env.PORTADAS_REALES === '1';
const isbn = (n) => `https://covers.openlibrary.org/b/isbn/${n}-L.jpg?default=false`;
const LIBROS = REALES
  ? [
      libro('f', 'El nombre del viento', { author: 'Patrick Rothfuss', categories: ['Fantasy'], cover: isbn('9780756404741') }),
      libro('m', 'Asesinato en el Orient Express', { author: 'Agatha Christie', categories: ['Mystery'], cover: isbn('9780062693662') }),
      libro('a', 'Orgullo y prejuicio', { author: 'Jane Austen', categories: ['Romance'], cover: isbn('9780141439518') }),
      libro('n', 'Un libro sin más'),
    ]
  : [
      libro('f', 'El dragón del muelle', { categories: ['Fantasy'], cover: portada(101) }),
      libro('m', 'Crimen en la lonja', { categories: ['Mystery'], cover: portada(102) }),
      libro('a', 'Cartas de amor al puerto', { categories: ['Romance'], cover: portada(103) }),
      libro('n', 'Un libro sin más'),
    ];
/** Tres portadas de prueba (dibujos SVG propios, 300 × 450), con el permiso de CORS que da Open Library. */
const SVG = {
  101: '<rect width="300" height="450" fill="#1f3b5c"/><circle cx="150" cy="170" r="90" fill="#e8b04a"/><path d="M40 330 Q150 250 260 330 L260 450 L40 450Z" fill="#0f2236"/><rect x="30" y="370" width="240" height="40" fill="#f3e6c8"/>',
  102: '<rect width="300" height="450" fill="#7a1f24"/><rect x="40" y="60" width="220" height="220" fill="#151012"/><circle cx="150" cy="170" r="60" fill="#d9d2c0"/><rect x="40" y="320" width="220" height="30" fill="#e8c56a"/><rect x="70" y="370" width="160" height="20" fill="#e8c56a"/>',
  103: '<rect width="300" height="450" fill="#f2c4c8"/><path d="M150 300 C 40 210 80 110 150 170 C 220 110 260 210 150 300Z" fill="#b8324a"/><rect x="40" y="350" width="220" height="34" fill="#5a2a3a"/>',
};
async function servirPortadas(page) {
  if (REALES) return;
  await page.route('https://covers.openlibrary.org/**', (route) => {
    const n = route.request().url().match(/id\/(\d+)/)?.[1];
    const dibujo = SVG[n];
    if (!dibujo) return route.fulfill({ status: 404 });
    return route.fulfill({
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'image/svg+xml' },
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">${dibujo}</svg>`,
    });
  });
}
const BALDA = { bienvenida: true, libros: LIBROS.map((b) => ({ clave: b.id, titulo: b.title, genero: generoDe(b), caja: 0, balda: 1 })) };
const semillas = (s, n) => Array.from({ length: n }, (_, k) => s + k * 7919);
/** Unas semillas en las que el primer cliente pide café (el caso con más gestos: moler, apisonar, extraer…). */
function semillasCafe(desde) {
  for (let s = desde; s < desde + 500000; s += 1000) if (recetaPide({ n: 1, semilla: semillas(s, 5)[0] }, [])[0] === 'cafe') return semillas(s, 5);
  throw new Error('ninguna semilla');
}
const SONIDO = { v: 1, on: true, decided: true, legacy: false, effects: 40, ambience: 15, music: 40, master: 80, ambienceId: 'none', musicId: 'tarde', lastAmbience: 'none', lastMusic: 'tarde' };

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

async function alCafe(page, estado = {}, opciones = {}) {
  await servirPortadas(page);
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
  const plano = structuredClone(PLANO_INICIAL);
  await simularCafe(page, { inaugurado: true, nombre: 'Taza y Lomo', nivel: 1, reputacion: 60, granos: 30, inventario: cuenta(plano), libros: BALDA, plano, ...estado }, { clientes: { hoy: HOY, semillas: semillasCafe(1000), quienes: [3], frases: [10], ...opciones } });
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
  return { cafe, portal };
}

const sonidos = (page) => page.evaluate(() => window.__cafeSonidos ?? []);
const SOLO = /chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/;

test('el café suena: su música propia, los pasos, Pilar y cada momento del cliente; la barra, en una franja ligera', async ({ page }, info) => {
  test.skip(!SOLO.test(info.project.name), '360, 430, escritorio y 390 (Chromium y WebKit)');
  test.setTimeout(200000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const foto = async (nombre) => page.screenshot({ path: join(DIR, `${nombre}${REALES ? '-reales' : ''}-${tam(info)}.png`) });
  const { cafe, portal } = await alCafe(page);

  // La música del café: la de Sonido se calla mientras estás dentro y suena la propia (tras el primer gesto, que ya hubo)
  // Un toque dentro del café (en el escritorio, fuera del panel lo cerraría)
  const placa = await cafe.locator('.cf3-placa').boundingBox();
  await page.mouse.click(placa.x + placa.width / 2, placa.y + placa.height / 2);
  // El WebKit de Playwright en Windows no trae Web Audio: ahí solo se comprueba lo que no suena
  const hayAudio = await page.evaluate(() => Boolean(window.AudioContext || window.webkitAudioContext));
  await expect.poll(() => page.evaluate(() => window.__portAudio?.().bloqueos)).toContain('cafe');
  if (hayAudio) await expect.poll(() => page.evaluate(() => window.__portAudio?.().escena ?? 0)).toBeGreaterThan(0);

  // Andar suena (madera), y Pilar murmura al hablarle
  await page.evaluate(() => window.__cafe3d.go('pilar'));
  await expect.poll(async () => (await sonidos(page)).filter((s) => s === 'paso').length, { timeout: 10000 }).toBeGreaterThan(1);
  await quieto(page, 300);
  const pilar = cafe.locator('.cf3-tags button', { hasText: 'Pilar' });
  await expect(pilar).not.toHaveAttribute('data-off', 'true');
  await pilar.click();
  await expect.poll(async () => (await sonidos(page)).includes('pilar')).toBe(true);
  await cafe.getByRole('button', { name: 'Hasta luego' }).click();

  // Atender: la comanda suena al pedir
  const caja = cafe.locator('.cf3-franja--atender');
  await cafe.getByRole('button', { name: 'Atender' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'pide');
  await expect.poll(async () => (await sonidos(page)).includes('comanda') || (await sonidos(page)).includes('raro')).toBe(true);
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'barra');
  await page.waitForFunction(() => window.__cafe3d.enBarra());
  await quieto(page, 500);
  await foto('1-barra-elegir');
  // La franja ocupa poco: sin retrato, una línea y las etapas en fichitas
  await expect(caja.locator('.cf3-retrato')).toBeHidden();
  const alto = (await caja.boundingBox()).height;
  const ancho = page.viewportSize().width;
  expect(alto).toBeLessThan(ancho >= 700 ? 200 : 230);

  const pide = (await caja.getAttribute('data-pedido')) && recetaPide({ n: 1, semilla: semillasCafe(1000)[0] }, []);
  const r = { bebida: pide[0], grano: pide[1], leche: pide[2], toque: pide[3] };
  let primeraNota = true;
  for (const etapa of ETAPAS) {
    await expect(caja).toHaveAttribute('data-etapa', etapa);
    const parte = ELIGE[etapa];
    if (parte)
      await cafe
        .locator('.cf3-opciones')
        .getByRole('button', { name: nombreOpcion(parte, r[parte]), exact: true })
        .click();
    for (const tipo of gestosDe(etapa, r)) {
      if (primeraNota) {
        // El cómo, en una notita junto al objeto, sin taparlo ni tapar la franja
        await expect(caja).toHaveAttribute('data-gesto', tipo);
        await quieto(page, 300);
        const nota = cafe.locator('.cf3-gesto__nota');
        await expect(nota).toBeVisible();
        const n = await nota.boundingBox();
        const pista = await cafe.locator('.cf3-gesto__pista').boundingBox();
        const franja = await caja.boundingBox();
        const cruza = !(n.x + n.width <= pista.x + 8 || n.x >= pista.x + pista.width - 8 || n.y + n.height <= pista.y + 8 || n.y >= pista.y + pista.height - 8);
        expect(cruza, 'la notita no tapa el objeto').toBe(false);
        expect(n.y + n.height).toBeLessThan(franja.y);
        expect(n.x).toBeGreaterThanOrEqual(0);
        expect(n.x + n.width).toBeLessThanOrEqual(ancho);
        await foto(`2-barra-${tipo}`);
        primeraNota = false;
      }
      await hacerGesto(page, cafe, tipo, { ayuda: false });
    }
  }
  await expect(caja).toHaveAttribute('data-etapa', 'lista');
  await quieto(page, 300);
  await foto('3-barra-lista');
  await cafe.getByRole('button', { name: 'Llevársela' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'libro', { timeout: 20000 });
  // La taza: al cogerla y al dejarla en la mesa
  await expect.poll(async () => (await sonidos(page)).includes('tazaMesa')).toBe(true);
  expect(await sonidos(page)).toContain('bandeja');
  // Las fichas con su portada real (la que no tiene, con su tapa de color)
  await expect(cafe.locator('.cf3-ficha__portada').first()).toBeVisible();
  await page.waitForFunction(() => [...document.querySelectorAll('.cf3-ficha__portada')].every((i) => i.complete && i.naturalWidth > 0));
  await quieto(page, 300);
  await foto('3b-fichas-portada');
  await cafe.locator('.cf3-ficha').first().click();
  await expect(caja).toHaveAttribute('data-paso', 'gracias');
  // Las estrellas, una a una, y los granos al tarro
  await expect.poll(async () => (await sonidos(page)).includes('granos'), { timeout: 5000 }).toBe(true);
  expect(await sonidos(page)).toContain('libroDesliza');
  expect((await sonidos(page)).filter((s) => s === 'estrella').length).toBeGreaterThan(0);
  await quieto(page, 300);
  await foto('4-gracias');
  await cafe.getByRole('button', { name: 'Hasta luego' }).click();
  await expect.poll(async () => (await sonidos(page)).includes('despedida')).toBe(true);
  // El cartel de lo conseguido (los tickets del primer cliente del día) sale al despedirlo
  const logro = page.locator('.cf3-logro');
  await page.waitForTimeout(900);
  if (await logro.isVisible()) {
    await foto('5-logro');
    await logro.locator('.cf3-logro__ok').click();
  }

  // Decorar: coger, girar y guardar suenan
  await cafe.getByRole('button', { name: 'Decorar' }).click();
  await cafe.getByRole('button', { name: 'Listo' }).click();
  await expect(cafe.locator('.cf3-dice')).toContainText('Guardado');
  expect(await sonidos(page)).toEqual(expect.arrayContaining(['papel', 'guardar']));

  // Al salir del café, la música de Sonido vuelve
  await cafe.getByRole('button', { name: /Volver al portal/ }).click();
  await expect(portal).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__portAudio?.().bloqueos ?? [])).not.toContain('cafe');
  expect(errors).toEqual([]);
  const video = page.video();
  await page.close();
  if (video && /390x844/.test(info.project.name)) await video.saveAs(join(DIR, `cafe-sonido-${tam(info)}.webm`));
});

test('las portadas reales: en el escaparate, en píxeles, vistas desde la acera (nivel 5)', async ({ page }, info) => {
  test.skip(!SOLO.test(info.project.name), '360, 430, escritorio y 390 (Chromium y WebKit)');
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const foto = async (nombre) => page.screenshot({ path: join(DIR, `${nombre}${REALES ? '-reales' : ''}-${tam(info)}.png`) });
  const escaparate = ['f', 'a', 'm'].map((k) => ({ clave: k, titulo: LIBROS.find((b) => b.id === k).title, genero: generoDe(LIBROS.find((b) => b.id === k)) }));
  await alCafe(page, { nivel: 5, reputacion: umbralHito(5, 2) + 40, granos: 600, cobrados: [1, 2, 3], escaparate });
  // Las tres portadas leídas en píxeles (10 × 15) y pasadas a la escena
  await page.waitForFunction(() => window.__cafe3d?.portadasEscaparate?.() === 3, null, { timeout: 15000 });
  await page.evaluate(() => window.__cafe3d.place(3.4, 14.7, Math.PI));
  await quieto(page, 600);
  await foto('6-escaparate-portadas');
  await page.evaluate(() => window.__cafe3d.place(3.4, 12.6, Math.PI));
  await quieto(page, 600);
  await foto('7-escaparate-portadas-cerca');
  expect(errors).toEqual([]);
});

test('jornadas de prueba (la cuenta de Francisco): con todos atendidos, «Otra jornada» trae clientes nuevos', async ({ page }, info) => {
  test.skip(!SOLO.test(info.project.name), '360, 430, escritorio y 390 (Chromium y WebKit)');
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const foto = async (nombre) => page.screenshot({ path: join(DIR, `${nombre}-${tam(info)}.png`) });
  // La jornada de prueba 1 ya está atendida entera
  const { cafe } = await alCafe(page, {}, { jornada: '3000-01-01', atendidosEn: ['3000-01-01'] });
  await expect(cafe.getByText('Como estás probando el café, abro otra jornada cuando quieras.', { exact: false })).toBeVisible({ timeout: 15000 });
  const boton = cafe.getByRole('button', { name: 'Otra jornada' });
  await expect(boton).toBeVisible();
  await expect(cafe.getByRole('button', { name: 'Atender', exact: true })).toHaveCount(0);
  await quieto(page, 300);
  await foto('8-jornada-terminada');
  await boton.click();
  // La jornada nueva: clientes esperando y «Atender»
  await expect(cafe.getByRole('button', { name: 'Atender', exact: true })).toBeVisible({ timeout: 15000 });
  await expect(cafe.getByText(/clientes? esperando/)).toBeVisible();
  await expect(cafe.getByRole('button', { name: 'Otra jornada' })).toHaveCount(0);
  await quieto(page, 600);
  await foto('9-jornada-nueva');
  expect(errors).toEqual([]);
});

test('sin ser cuenta de pruebas, no hay «Otra jornada»: el día de hoy, como siempre', async ({ page }, info) => {
  test.skip(!SOLO.test(info.project.name), '360, 430, escritorio y 390 (Chromium y WebKit)');
  test.setTimeout(120000);
  const { cafe } = await alCafe(page, {}, { atendidosEn: [HOY] });
  await expect(cafe.getByText('Hoy ya está todo el mundo atendido', { exact: false })).toBeVisible({ timeout: 15000 });
  await expect(cafe.getByRole('button', { name: 'Otra jornada' })).toHaveCount(0);
});
