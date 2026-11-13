// 1.127 (SPEC §127; docs/qa/cafe-libreria.md §14, bloque 6b, cifras de Francisco del 13-11-2026) · El tostadero: en el nivel 7
// la bodega crece por la izquierda (cuadrícula de 7 × 5) con el tostador contra la pared; con el tueste de la casa en la carta
// hay un saco al día en el tambor, que se recoge tirando del asa de la trampilla (5 tazas); el saco va a la barra, junto a los
// tarros, y a quien pide «tueste de la casa» se le sirve con él (+3 granos y +4 de reputación). Pilar avisa una vez al día. La
// subida al 7 enseña el tostadero. El servidor simulado aplica las reglas de `20261216120000_cafe_tostadero.sql`. Capturas y
// vídeos en qa-report/cafe-tostadero/.
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

const DIR = join('qa-report', 'cafe-tostadero');
// El nombre del botón: con té y chocolate, el grano se llama por su hoja o su cacao
const boton = (parte, valor, bebida) =>
  parte === 'grano' && bebida === 'te'
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
const REP = umbralHito(7, 2) + 40;
const CARTA = cartaDe(REP);
const SONIDO = { v: 1, on: true, decided: true, legacy: false, effects: 40, ambience: 15, music: 40, master: 80, ambienceId: 'none', musicId: 'tarde', lastAmbience: 'none', lastMusic: 'tarde' };
/**
 * El plano del nivel 7: el del 6 (el ala, la terraza y la bodega) y, en las columnas nuevas del tostadero, el saco de
 * arpillera y la estantería de latas. Arriba hay 6 asientos y abajo 5: vienen los 9 del nivel 7.
 */
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
const semillas = (s, n) => Array.from({ length: n }, (_, k) => s + k * 7919);
/** Unas semillas en las que el cliente `n` pide café con el tueste de la casa. */
function semillasTueste(n, desde) {
  for (let s = desde; s < desde + 900000; s += 1000) {
    const r = recetaPide({ n, semilla: semillas(s, 9)[n - 1] }, CARTA);
    if (r[0] === 'cafe' && r[1] === 'casa') return semillas(s, 9);
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

/** Tirar del asa de la trampilla del tambor y mantenerla, con el ratón como el dedo. */
async function tirarDelAsa(page, cafe, { foto = null } = {}) {
  const zona = cafe.locator('.cf3-gesto[data-activo="true"]');
  await expect(zona.locator('.cf3-gesto__pista')).toBeVisible();
  const asa = await page.evaluate(() => window.__cafe3d.tostadorMarca('asa'));
  const box = await zona.boundingBox();
  const e = Math.min(box.width, 600) / 390;
  const m = page.mouse;
  await m.move(asa.x, asa.y);
  await m.down();
  await m.move(asa.x, asa.y + 50 * e, { steps: 4 });
  await m.move(asa.x, asa.y + 110 * e, { steps: 4 });
  await page.waitForTimeout(800);
  await foto?.('cayendo');
  await page.waitForTimeout(1200);
  await m.up();
}

const SOLO = /chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/;

test('nivel 7: el tostadero, recoger el saco del día, el saco en la barra y servir el tueste de la casa', async ({ page }, info) => {
  test.skip(!SOLO.test(info.project.name), '360, 430, escritorio y 390 (Chromium y WebKit)');
  test.setTimeout(300000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const foto = async (nombre) => page.screenshot({ path: join(DIR, `tostadero-${nombre}-${tam(info)}.png`) });
  const seeds = semillasTueste(1, 6000);
  const { cafe, c } = await alCafe(page, { nivel: 7, reputacion: REP, granos: 900, cobrados: [1, 2, 3, 4, 5, 6, 7], plano: PLANO_7, tazas: 0, sacoDia: null }, seeds);
  // Pilar avisa del saco (una vez al día)
  await expect(cafe.locator('.cf3-dice')).toContainText('hay un saco recién hecho esperando en el tambor', { timeout: 9000 });
  await quieto(page);
  await foto('aviso');
  // Abajo: la bodega más ancha, con el tostador a la izquierda
  await bajar(page, cafe);
  await page.evaluate(() => window.__cafe3d.place(43.4, 5.4, Math.atan2(37.0 - 43.4, 1.8 - 5.4)));
  await quieto(page);
  await foto('bodega');
  await page.evaluate(() => window.__cafe3d.place(40.2, 4.6, Math.atan2(36.6 - 40.2, 1.5 - 4.6)));
  await quieto(page);
  const tostador = cafe.locator('.cf3-tags button', { hasText: 'El tostador' });
  await expect(tostador).toHaveText('El tostador · saco listo');
  await expect(tostador).not.toHaveAttribute('data-off', 'true');
  await foto('tostador');
  // Delante del tostador: la trampilla, su asa y el enfriador
  await tostador.click();
  const franja = cafe.locator('.cf3-franja--tostador');
  await expect(franja).toHaveAttribute('data-fase', 'tirar', { timeout: 15000 });
  await page.waitForFunction(() => window.__cafe3d.enTostador());
  await quieto(page);
  // Nivel 7: la «!» solo si te quedas parado 6 s
  await expect(franja).not.toHaveAttribute('data-ayuda', 'true');
  await foto('trampilla');
  await expect(franja).toHaveAttribute('data-ayuda', 'true', { timeout: 9000 });
  await expect(cafe.locator('.cf3-ayuda--gesto')).toBeVisible();
  await foto('ayuda');
  await tirarDelAsa(page, cafe, { foto });
  await expect(franja).toHaveAttribute('data-fase', 'enfriar', { timeout: 6000 });
  await page.waitForTimeout(700);
  await foto('enfriador');
  await expect(franja).toHaveAttribute('data-fase', 'hecho', { timeout: 9000 });
  await expect(franja).toContainText('5 tazas de tueste de la casa');
  expect([c.tazas, c.sacoDia]).toEqual([5, HOY]);
  await quieto(page);
  await foto('saco');
  await expect.poll(async () => (await sonidos(page)).includes('saco')).toBe(true);
  expect(await sonidos(page)).toEqual(expect.arrayContaining(['tostador', 'trampillaTambor', 'enfriador', 'saco']));
  await cafe.getByRole('button', { name: 'Volver', exact: true }).click();
  await expect(franja).toHaveCount(0);
  await quieto(page);
  // Otra vez hoy: ya no hay saco
  await expect(tostador).toHaveText('El tostador');
  await tostador.click();
  await expect(franja).toHaveAttribute('data-fase', 'nada', { timeout: 15000 });
  await expect(franja).toContainText('Hoy ya sacaste el tueste');
  await cafe.getByRole('button', { name: 'Volver', exact: true }).click();
  await quieto(page);
  // Decorar abajo: la cuadrícula de 7 × 5 con el saco y la estantería de latas
  await cafe.getByRole('button', { name: 'Decorar' }).click();
  await expect(cafe.getByRole('group', { name: 'Qué planta decoras' }).getByRole('button', { name: 'La bodega' })).toHaveAttribute('aria-pressed', 'true');
  await quieto(page);
  await foto('decorar');
  await cafe.getByRole('tab', { name: 'Tienda' }).click();
  const tienda = cafe.locator('.cf3-tienda');
  await expect(tienda.getByRole('button', { name: 'Comprar Saco de arpillera por 250 granos (tienes 1)' })).toBeEnabled();
  await expect(tienda.getByRole('button', { name: 'Comprar Estantería de latas por 350 granos (tienes 1)' })).toBeEnabled();
  await foto('tienda');
  await cafe.getByRole('button', { name: 'Listo' }).click();
  await quieto(page);
  // Arriba, el cliente 1 pide café con el tueste de la casa: se elige tocando el saco de la barra
  await cafe.getByRole('button', { name: 'Subir al café', exact: true }).click();
  await page.waitForFunction(() => window.__cafe3d.planta() === 'calle' && !window.__cafe3d.cambiando() && window.__cafe3d.settled(), null, { timeout: 25000 });
  await quieto(page);
  await cafe.locator('.cf3-tag--cliente:not([data-off="true"])').first().waitFor();
  const receta = recetaPide({ n: 1, semilla: seeds[0] }, CARTA);
  expect(receta.slice(0, 2)).toEqual(['cafe', 'casa']);
  await page.evaluate(() => window.__cafe3d.place(6.9, 10.2, Math.PI + 0.78));
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  const caja = cafe.locator('.cf3-franja--atender');
  await expect(caja).toHaveAttribute('data-paso', 'pide');
  await expect(cafe.locator('.cf3-comanda')).toContainText('tueste de la casa');
  await foto('comanda');
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await page.waitForFunction(() => window.__cafe3d.enBarra());
  const r = { bebida: receta[0], grano: receta[1], leche: receta[2], toque: receta[3] };
  for (const etapa of ETAPAS) {
    await expect(caja).toHaveAttribute('data-etapa', etapa);
    const parte = ELIGE[etapa];
    if (parte) {
      await quieto(page, 200);
      const valor = r[parte];
      if (valor === 'casa') {
        await expect(cafe.locator('.cf3-opcion[data-opcion="casa"]')).toHaveText('Tueste de la casa · 5 tazas');
        await foto('barra-saco');
      }
      const p = ['frio', 'vainilla', 'casa'].includes(valor) ? await page.evaluate((x) => window.__cafe3d.barraEnPantalla(x), `barra:${parte}:${valor}`) : null;
      if (p?.front) await page.mouse.click(p.x, p.y);
      else
        await cafe
          .locator('.cf3-opciones')
          .getByRole('button', { name: valor === 'casa' ? /Tueste de la casa/ : boton(parte, valor, r.bebida), exact: valor !== 'casa' })
          .click();
      await expect.poll(async () => (await caja.getAttribute('data-receta')).split(',')[['bebida', 'grano', 'leche', 'toque'].indexOf(parte)]).toBe(valor);
    }
    for (const tipo of gestosDe(etapa, r)) await hacerGesto(page, cafe, tipo, { ayuda: false });
  }
  await expect(caja).toHaveAttribute('data-etapa', 'lista');
  await quieto(page, 400);
  await cafe.getByRole('button', { name: 'Llevársela' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'libro', { timeout: 20000 });
  await cafe.getByRole('button', { name: 'Solo el café' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'gracias');
  await expect(caja.locator('.cf3-dado__ficha--tueste')).toHaveText('+3 y +4 por el tueste');
  expect(c.tazas).toBe(4);
  await page.waitForTimeout(900);
  const logro = page.locator('.cf3-logro');
  if (await logro.isVisible()) await logro.locator('.cf3-logro__ok').click();
  await foto('gracias');
  await expect.poll(async () => (await sonidos(page)).includes('tueste'), { timeout: 5000 }).toBe(true);
  await cafe.getByRole('button', { name: 'Hasta luego' }).click();
  expect(errors).toEqual([]);
  const video = page.video();
  await page.close();
  if (video && /390x844/.test(info.project.name)) await video.saveAs(join(DIR, `tostadero-${tam(info)}.webm`));
});

test('subir al nivel 7: el cartel del tostadero y su recorrido; el tostador, frío hasta el tueste', async ({ page }, info) => {
  test.skip(!/chromium-390x844$|webkit-390x844$/.test(info.project.name), 'a 390');
  test.setTimeout(180000);
  mkdirSync(DIR, { recursive: true });
  const foto = async (nombre) => page.screenshot({ path: join(DIR, `subida-${nombre}-${tam(info)}.png`) });
  const seeds = semillas(9000, 9);
  const plano6 = { v: 1, items: PLANO_7.items.filter((i) => i.x >= 0 || i.y < 20) };
  const { cafe, c } = await alCafe(page, { nivel: 6, reputacion: 14995, granos: 300, cobrados: [1, 2, 3, 4, 5, 6], plano: plano6 }, seeds);
  await quieto(page);
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  const caja = cafe.locator('.cf3-franja--atender');
  await expect(caja).toHaveAttribute('data-paso', 'pide');
  const carta6 = cartaDe(14995);
  const receta = recetaPide({ n: 1, semilla: seeds[0] }, carta6);
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await page.waitForFunction(() => window.__cafe3d.enBarra());
  const r = { bebida: receta[0], grano: receta[1], leche: receta[2], toque: receta[3] };
  for (const etapa of ETAPAS) {
    await expect(caja).toHaveAttribute('data-etapa', etapa);
    const parte = ELIGE[etapa];
    if (parte) {
      await quieto(page, 200);
      const p = r[parte] === 'frio' || r[parte] === 'vainilla' ? await page.evaluate((x) => window.__cafe3d.barraEnPantalla(x), `barra:${parte}:${r[parte]}`) : null;
      if (p?.front) await page.mouse.click(p.x, p.y);
      else
        await cafe
          .locator('.cf3-opciones')
          .getByRole('button', { name: boton(parte, r[parte], r.bebida), exact: true })
          .click();
    }
    for (const tipo of gestosDe(etapa, r)) await hacerGesto(page, cafe, tipo, { ayuda: false });
  }
  await cafe.getByRole('button', { name: 'Llevársela' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'libro', { timeout: 20000 });
  await cafe.getByRole('button', { name: 'Solo el café' }).click();
  await cafe.getByRole('button', { name: 'Hasta luego' }).click();
  // El cartel: nivel 7, el tostadero, 90 tickets y lo que se abre
  const logro = page.locator('.cf3-logro');
  await expect(logro).toBeVisible({ timeout: 9000 });
  await expect(logro).toContainText('El tostadero');
  await expect(logro).toContainText('90');
  await expect(logro).toContainText('La bodega crece');
  expect(c.nivel).toBe(7);
  await page.waitForTimeout(600);
  await foto('cartel');
  await logro.locator('.cf3-logro__ok').click();
  await page.waitForFunction(() => window.__cafe3d.enRecorrido(), null, { timeout: 9000 });
  await page.waitForTimeout(2300);
  await foto('recorrido-bodega');
  await page.waitForTimeout(1600);
  await foto('recorrido-tostador');
  await page.waitForFunction(() => !window.__cafe3d.enRecorrido(), null, { timeout: 15000 });
  await quieto(page);
  // Sin el tueste en la carta, el tostador está frío
  await bajar(page, cafe);
  await page.evaluate(() => window.__cafe3d.place(40.2, 4.6, Math.atan2(36.6 - 40.2, 1.5 - 4.6)));
  await quieto(page);
  await cafe.locator('.cf3-tags button', { hasText: 'El tostador' }).click();
  const franja = cafe.locator('.cf3-franja--tostador');
  await expect(franja).toHaveAttribute('data-fase', 'frio', { timeout: 15000 });
  await expect(franja).toContainText('aún está frío');
  await quieto(page);
  await foto('frio');
  await cafe.getByRole('button', { name: 'Volver', exact: true }).click();
  const video = page.video();
  await page.close();
  if (video && /390x844/.test(info.project.name)) await video.saveAs(join(DIR, `subida-${tam(info)}.webm`));
});
