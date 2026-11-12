// 1.123 (SPEC §123; docs/qa/cafe-libreria.md §13, bloque 4b, cifras de Francisco del 12-11-2026) · El café crece: en el
// nivel 4 se abre el ala lateral (la pared de la izquierda se va al fondo, quedan los pilares y la viga; cuadrícula 9 × 9) y
// llega la vainilla (rascar la vaina); en el nivel 5, la terraza en la acera con su toldo y sus farolillos, el escaparate con
// tres de tus leídos y el café con hielo (agitar la coctelera). Con menos asientos que clientes posibles, Pilar lo avisa. El
// servidor simulado aplica las reglas de `20261213120000_cafe_ampliacion.sql`. Capturas y vídeos en qa-report/cafe-ampliacion/.
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

const DIR = join('qa-report', 'cafe-ampliacion');
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
/** El plano del nivel 4: el de siempre y, en el ala, el piano, la mesa larga con su banco, el biombo y la lámpara de bankers. */
const PLANO_4 = {
  v: 1,
  items: [
    ...PLANO_INICIAL.items,
    { uid: 'a1', id: 'cafe-piano', x: -3, y: -3, rot: 0 },
    { uid: 'a2', id: 'cafe-mesa-larga', x: -3, y: 1, rot: 0 },
    { uid: 'a3', id: 'cafe-banco', x: -3, y: 2, rot: 2 },
    { uid: 'a4', id: 'cafe-biombo', x: -2, y: 4, rot: 2 },
    { uid: 'a5', id: 'cafe-bankers', x: -1, y: 1, rot: 0 },
  ],
};
/** El del nivel 5: además, en la terraza, dos mesas de hierro con sus sillas, el macetero y el farol. */
const PLANO_5 = {
  v: 1,
  items: [
    ...PLANO_4.items,
    { uid: 't1', id: 'cafe-mesa-hierro', x: 1, y: 8, rot: 0 },
    { uid: 't2', id: 'cafe-silla-terraza', x: 0, y: 8, rot: 3 },
    { uid: 't3', id: 'cafe-mesa-hierro', x: 4, y: 8, rot: 0 },
    { uid: 't4', id: 'cafe-silla-terraza', x: 5, y: 8, rot: 1 },
    { uid: 't5', id: 'cafe-macetero', x: 2, y: 9, rot: 0 },
    { uid: 't6', id: 'cafe-farol', x: 0, y: 9, rot: 0 },
  ],
};
/** La primera semilla desde `desde` (de mil en mil) cuyo cliente 1 pide lo que diga `quiere` con esta carta. */
function semillaQue(quiere, carta, desde = 1000) {
  for (let s = desde; s < desde + 500000; s += 1000) if (quiere(recetaPide({ n: 1, semilla: s }, carta))) return s;
  throw new Error('ninguna semilla');
}

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

async function alCafe(page, estado, semillas, quienes = [3]) {
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
  const plano = structuredClone(estado.plano ?? PLANO_INICIAL);
  const c = await simularCafe(
    page,
    { inaugurado: true, nombre: 'Taza y Lomo', inventario: cuenta(plano), libros: BALDA, ...estado, plano },
    { clientes: { hoy: HOY, semillas, quienes, frases: [10] } },
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
  return { cafe, c, portal };
}

/** Atiende al cliente 1 con la receta que pidió: lo de la carta nueva, tocándolo en la barra; lo demás, con los botones. */
async function atender(page, cafe, receta, { foto = null } = {}) {
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  const caja = cafe.locator('.cf3-franja--atender');
  await expect(caja).toHaveAttribute('data-paso', 'pide');
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'barra');
  await page.waitForFunction(() => window.__cafe3d.enBarra());
  const r = { bebida: receta[0], grano: receta[1], leche: receta[2], toque: receta[3] };
  for (const etapa of ETAPAS) {
    await expect(caja).toHaveAttribute('data-etapa', etapa);
    const parte = ELIGE[etapa];
    if (parte) {
      const valor = r[parte];
      await quieto(page, 200);
      if (etapa === 'bebida' || etapa === 'toque') await foto?.(`elige-${etapa}`);
      const p = valor === 'frio' || valor === 'vainilla' ? await page.evaluate((x) => window.__cafe3d.barraEnPantalla(x), `barra:${parte}:${valor}`) : null;
      if (p?.front) await page.mouse.click(p.x, p.y);
      else
        await cafe
          .locator('.cf3-opciones')
          .getByRole('button', { name: nombreOpcion(parte, valor), exact: true })
          .click();
      await expect.poll(async () => (await caja.getAttribute('data-receta')).split(',')[['bebida', 'grano', 'leche', 'toque'].indexOf(parte)]).toBe(valor);
    }
    for (const tipo of gestosDe(etapa, r)) await hacerGesto(page, cafe, tipo, { foto: tipo === 'rascar' || tipo === 'coctelera' ? foto : null, ayuda: false });
  }
  await expect(caja).toHaveAttribute('data-etapa', 'lista');
  expect(await caja.getAttribute('data-receta')).toBe(receta.join());
  await quieto(page, 400);
  await foto?.('lista');
  await cafe.getByRole('button', { name: 'Llevársela' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'libro', { timeout: 15000 });
  await cafe.getByRole('button', { name: 'Solo el café' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'gracias');
  await cafe.getByRole('button', { name: 'Hasta luego' }).click();
}

const SOLO = /chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/;

test('nivel 4: el ala lateral, su cuadrícula de 9 × 9 y un café con vainilla rascada en la barra', async ({ page }, info) => {
  test.skip(!SOLO.test(info.project.name), '360, 430, escritorio y 390 (Chromium y WebKit)');
  test.setTimeout(150000);
  mkdirSync(DIR, { recursive: true });
  const foto = async (nombre) => page.screenshot({ path: join(DIR, `ala-${nombre}-${tam(info)}.png`) });
  const carta = ['chocolate', 'nata', 'vainilla'];
  const s = semillaQue((p) => p[0] === 'cafe' && p[3] === 'vainilla', carta);
  const { cafe } = await alCafe(page, { nivel: 4, reputacion: umbralHito(4, 2) + 40, granos: 400, cobrados: [1, 2, 3], plano: PLANO_4 }, [
    s,
    s + 7919,
    s + 2 * 7919,
    s + 3 * 7919,
    s + 4 * 7919,
    s + 5 * 7919,
  ]);
  await quieto(page);
  await foto('local');
  // El ala, desde dentro: la viga y los pilares, el piano y la mesa larga
  await page.evaluate(() => window.__cafe3d.place(4.6, 7.6, Math.PI * 1.37));
  await quieto(page);
  await foto('ala');
  await page.evaluate(() => window.__cafe3d.place(-0.4, 9.6, Math.PI + 0.2));
  await quieto(page);
  await foto('ala-fondo');
  // El recorrido de la subida al nivel 4
  await page.evaluate(() => {
    window.__cafe3d.recorrido(4);
  });
  await page.waitForTimeout(2600);
  await foto('recorrido');
  await page.waitForFunction(() => !window.__cafe3d.enRecorrido(), null, { timeout: 15000 });
  // Decorar: la cuadrícula de 9 × 9 y la tienda del nivel 4
  await cafe.getByRole('button', { name: 'Decorar' }).click();
  await quieto(page);
  await foto('decorar');
  await cafe.getByRole('tab', { name: 'Tienda' }).click();
  const tienda = cafe.locator('.cf3-tienda');
  await expect(tienda.getByRole('button', { name: 'Comprar Lámpara de bankers por 120 granos' })).toBeEnabled();
  await expect(tienda.getByRole('button', { name: /Mesa de hierro: Se abre en el nivel 5/ })).toBeDisabled();
  await foto('tienda');
  await cafe.getByRole('button', { name: 'Listo' }).click();
  await quieto(page);
  // Un café con vainilla: rascar la vaina
  await atender(page, cafe, recetaPide({ n: 1, semilla: s }, carta), { foto });
  const video = page.video();
  await page.close();
  if (video && /390x844/.test(info.project.name)) await video.saveAs(join(DIR, `ala-${tam(info)}.webm`));
});

test('nivel 5: la terraza, el escaparate con tres leídos, el aviso de los asientos y un café con hielo', async ({ page }, info) => {
  test.skip(!SOLO.test(info.project.name), '360, 430, escritorio y 390 (Chromium y WebKit)');
  test.setTimeout(180000);
  mkdirSync(DIR, { recursive: true });
  const foto = async (nombre) => page.screenshot({ path: join(DIR, `terraza-${nombre}-${tam(info)}.png`) });
  const carta = ['chocolate', 'nata', 'vainilla', 'hielo'];
  const s = semillaQue((p) => p[0] === 'frio' && p[2] !== 'sin', carta);
  // Sin las sillas de la terraza ni el banco: 6 asientos, y en el nivel 5 podrían venir 7
  const sinSillas = { v: 1, items: PLANO_5.items.filter((i) => i.id !== 'cafe-silla-terraza' && i.id !== 'cafe-banco') };
  const { cafe, c, portal } = await alCafe(page, { nivel: 5, reputacion: umbralHito(5, 2) + 40, granos: 600, cobrados: [1, 2, 3], plano: sinSillas }, [
    s,
    s + 7919,
    s + 2 * 7919,
    s + 3 * 7919,
    s + 4 * 7919,
    s + 5 * 7919,
    s + 6 * 7919,
  ]);
  // Pilar avisa de los asientos que faltan (una vez al día, al entrar) y vienen 6
  await expect(cafe.locator('.cf3-dice')).toContainText('ahora caben 6 clientes al día y podrían venir 7');
  await expect(cafe.locator('.cf3-dice')).toContainText('Tienes 6 clientes esperando', { timeout: 9000 });
  await quieto(page);
  await foto('local');
  // La terraza desde la acera: la fachada, el toldo con sus farolillos, las mesas de hierro y el escaparate
  await page.evaluate(() => window.__cafe3d.place(8.4, 14.6, -2.05));
  await quieto(page);
  await foto('acera');
  // El recorrido del nivel 5: el escaparate y la terraza desde la acera
  await page.evaluate(() => {
    window.__cafe3d.recorrido(5);
  });
  await page.waitForTimeout(2700);
  await foto('recorrido-acera');
  await page.waitForFunction(() => !window.__cafe3d.enRecorrido(), null, { timeout: 15000 });
  await quieto(page);
  // El escaparate: tres de tus leídos
  await page.evaluate(() => window.__cafe3d.go('escaparate'));
  const p = await page.evaluate(() => window.__cafe3d.onScreen('escaparate'));
  await page.mouse.click(p.x, p.y);
  const region = cafe.getByRole('region', { name: 'El escaparate' });
  await expect(region).toBeVisible();
  for (const t of ['El dragón del muelle', 'Cartas de amor al puerto', 'Naves sobre la bahía']) await region.getByRole('button', { name: t }).click();
  await expect(region.getByRole('button', { name: 'Crimen en la lonja' })).toBeDisabled();
  await foto('escaparate-elegir');
  await region.getByRole('button', { name: 'Poner en el escaparate' }).click();
  await expect.poll(() => c.escaparate.map((b) => b.clave).join()).toBe('f,a,s');
  await quieto(page);
  await foto('escaparate');
  await page.evaluate(() => window.__cafe3d.place(3.4, 14.7, Math.PI));
  await quieto(page);
  await foto('escaparate-fuera');
  // Decorar: la cuadrícula del local y la de la terraza
  await cafe.getByRole('button', { name: 'Decorar' }).click();
  await quieto(page);
  await foto('decorar');
  await cafe.getByRole('button', { name: 'Listo' }).click();
  await quieto(page);
  // Un café con hielo: agitar la coctelera
  await atender(page, cafe, recetaPide({ n: 1, semilla: s }, carta), { foto });
  // Si sale el cartel de lo conseguido (el primer cliente del día), se cierra
  const logro = page.locator('.cf3-logro');
  await page.waitForTimeout(900);
  if (await logro.isVisible()) await logro.locator('.cf3-logro__ok').click();
  // La fachada: desde la calle se ven la placa con el nombre del café, tus libros en el escaparate y la terraza
  await page.getByRole('button', { name: 'Volver al portal' }).click();
  await expect(portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' })).toContainText('Taza y Lomo', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await foto('portal');
  const video = page.video();
  await page.close();
  if (video && /390x844/.test(info.project.name)) await video.saveAs(join(DIR, `terraza-${tam(info)}.webm`));
});

test('la fachada: desde la calle, la terraza en la acera y tus tres libros en el escaparate (nivel 5)', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'Chromium a 390');
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const [nombre, q] of [
    ['antes', ''],
    ['despues', '?cafe=1'],
  ]) {
    await page.goto(`/dev/calle3d.html${q}`);
    await page.waitForFunction(() => window.__calle3d?.renders() > 0);
    await page.evaluate(() => window.__calle3d.walk([{ spot: 'shop', yaw: Math.atan2(6.475 - 6.5, 3.2), pitch: 0 }]));
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(DIR, `fachada-${nombre}-${tam(info)}.png`) });
  }
  expect(errors).toEqual([]);
});
