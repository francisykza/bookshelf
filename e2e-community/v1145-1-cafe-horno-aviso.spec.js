// 1.145.1 (Francisco, 25-11-2026: «quiero que cuando tengas cosas haciéndose en el horno te salga una notificación cuando se
// terminen, o un indicador visual claro») · El horno del HUD (la lumbre y el vaho mientras hornea; la campanilla con su «!» y
// «¡Listo!» cuando termina; se toca para ir al horno) y la nota de papel de la campanilla, estés donde estés del café. El servidor
// simulado hornea en segundos. Capturas y vídeo con sonido en qa-report/v1145-1/.
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

const DIR = join('qa-report', 'v1145-1');
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
const semillas = (s, n) => Array.from({ length: n }, (_, k) => s + k * 7919);
const sonidos = (page) => page.evaluate(() => window.__cafeSonidos ?? []);
/** Lo que tarda el horno simulado: lo justo para ver el café entero antes de que suene la campanilla. */
const SEGUNDOS = { magdalenas: 40, empanada: 40, galletas: 40, pan: 40, bizcocho: 40, tortilla: 40 };

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

async function alCafe(page, horneando, { reducido = false } = {}) {
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
    { inaugurado: true, nombre: 'Taza y Lomo', granos: 40, nivel: 5, reputacion: umbralHito(5, 1) + 30, plano, inventario: cuenta(plano), libros: BALDA, dominio: { cafe: 12, te: 12 } },
    { clientes: { hoy: HOY, semillas: semillas(4100, 4), quienes: [3], frases: [10] }, obrador: { abierto: true, horno: 2, segundos: SEGUNDOS, horneando: horneando() } },
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

const hornada = (bandeja, receta, antes = 0) => ({ bandeja, receta, piezas: 6, estrellas: 3, metida: Date.now() - antes });

test('en la sala: el horno del HUD hornea, suena la campanilla con su nota y lleva a sacarla', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844)$/.test(info.project.name), 'a 360 y 390');
  test.setTimeout(180000);
  const t0 = Date.now();
  const conSonido = /390x844/.test(info.project.name);
  if (conSonido) await grabarSonido(page);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let n = 0;
  const foto = async (nombre) => {
    n += 1;
    await page.screenshot({ path: join(DIR, `sala-${String(n).padStart(2, '0')}-${nombre}-${tam(info)}.png`) });
  };
  const { cafe, c } = await alCafe(page, () => [hornada(1, 'magdalenas'), hornada(2, 'galletas')]);
  const btn = cafe.locator('.cf3-horno-btn');
  const nota = cafe.locator('.cf3-nota-horno');

  // 1. Horneando: el horno en el HUD, con la lumbre y el vaho; sin «¡Listo!». Al tocarlo, lo que hay dentro, sin ir a ningún sitio
  await expect(btn).toBeVisible();
  await expect(btn).not.toHaveAttribute('data-listo', 'true');
  await expect(btn).toHaveAccessibleName('El horno: dentro, las magdalenas y las galletas. Aún no está.');
  await expect(btn.locator('.cf3-horno-btn__vaho')).toBeVisible();
  await expect(cafe.locator('.cf3-horno__listo')).toHaveCount(0);
  await quieto(page, 400);
  await foto('horneando');
  await btn.click();
  await expect(nota).toContainText('Dentro: las magdalenas y las galletas. Aún se está haciendo');
  await expect(nota.locator('.cf3-nota-horno__ding')).toHaveCount(0);
  await expect(cafe.locator('.cf3-recetario')).toHaveCount(0);
  await foto('horneando-toque');
  await expect(nota).toHaveCount(0, { timeout: 8000 });

  // 2. Termina: la campanilla suena una vez, baja la nota «¡Ding! Ya están las magdalenas y las galletas.» y el horno se enciende
  await expect(nota).toContainText('Ya están las magdalenas y las galletas.', { timeout: 60000 });
  await expect(nota.locator('.cf3-nota-horno__ding')).toHaveText('¡Ding!');
  await expect(nota).toHaveAttribute('role', 'status');
  await expect(btn).toHaveAttribute('data-listo', 'true');
  await expect(cafe.locator('.cf3-horno__listo')).toHaveText('¡Listo!');
  await expect(btn.locator('.cf3-horno-btn__campana')).toBeVisible();
  await expect(btn).toHaveAccessibleName('El horno: ya están las magdalenas y las galletas. Toca para ir a sacarlo.');
  expect((await sonidos(page)).filter((s) => s === 'campanillaHorno')).toHaveLength(1);
  await quieto(page, 350);
  await foto('listo-nota');
  // La nota se va sola; el horno encendido se queda
  await expect(nota).toHaveCount(0, { timeout: 8000 });
  await expect(btn).toHaveAttribute('data-listo', 'true');
  await foto('listo-indicador');

  // 3. El letrero del obrador, encendido en ámbar, mirando al ala
  await page.evaluate(() => window.__cafe3d.place(-0.9, 4.6, Math.atan2(-2 + 0.9, 0.3 - 4.6)));
  await quieto(page);
  const tag = cafe.locator('.cf3-tags button', { hasText: /^El obrador/ });
  await expect(tag).toHaveAttribute('data-listo', 'true');
  await expect(tag).toContainText('¡listo!');
  await foto('letrero-listo');

  // 4. Tocar el horno del HUD lleva al obrador, directo a sacar la hornada (la pala)
  await btn.click();
  const obrador = cafe.getByRole('region', { name: 'El obrador' });
  await expect(obrador).toContainText('Saca la hornada', { timeout: 20000 });
  await expect(btn).toHaveCount(0);
  await quieto(page, 400);
  await foto('al-obrador');
  expect(c.obrador.horneando).toHaveLength(2);

  expect(errors).toEqual([]);
  const sonido = conSonido ? await sonidoGrabado(page) : null;
  const video = page.video();
  await page.close();
  if (video && conSonido) await guardarConSonido(video, join(DIR, `sala-${tam(info)}.webm`), sonido, t0);
});

test('en la barra, con un cliente: la nota llega sin tapar la barra y el horno espera a que acabes', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844)$/.test(info.project.name), 'a 360 y 390');
  test.setTimeout(180000);
  const t0 = Date.now();
  const conSonido = /390x844/.test(info.project.name);
  if (conSonido) await grabarSonido(page);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let n = 0;
  const foto = async (nombre) => {
    n += 1;
    await page.screenshot({ path: join(DIR, `barra-${String(n).padStart(2, '0')}-${nombre}-${tam(info)}.png`) });
  };
  const { cafe } = await alCafe(page, () => [hornada(1, 'empanada')]);
  const btn = cafe.locator('.cf3-horno-btn');
  const nota = cafe.locator('.cf3-nota-horno');
  const atender = cafe.locator('.cf3-franja--atender').first();

  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  await expect(atender).toHaveAttribute('data-paso', 'pide', { timeout: 8000 });
  await expect(btn).toBeVisible();
  await quieto(page, 400);
  await foto('pide-horneando');

  // Termina con el cliente delante: la nota y la campanilla, sin cambiar de pantalla
  await expect(nota).toContainText('Ya está la empanada.', { timeout: 60000 });
  await expect(btn).toHaveAttribute('data-listo', 'true');
  await expect(atender).toBeVisible();
  // La nota no tapa la comanda (va justo debajo) ni los botones de la franja; con un cliente delante, sin «¡Listo!» suelto
  const n1 = await nota.boundingBox();
  const f1 = await atender.boundingBox();
  const k1 = await cafe.locator('.cf3-comanda').boundingBox();
  expect(n1.y).toBeGreaterThanOrEqual(k1.y + k1.height);
  expect(n1.y + n1.height).toBeLessThan(f1.y);
  await expect(cafe.locator('.cf3-horno__listo')).toHaveCount(0);
  await quieto(page, 350);
  await foto('nota-en-la-barra');
  // Tocar el horno con un cliente delante no te saca de la barra: te lo guarda para cuando acabes
  await expect(nota).toHaveCount(0, { timeout: 8000 });
  await btn.click();
  await expect(nota).toContainText('Ya está la empanada. Te espera en el horno cuando acabes.');
  await expect(atender).toBeVisible();
  await expect(cafe.locator('.cf3-recetario')).toHaveCount(0);
  await foto('te-espera');
  expect((await sonidos(page)).filter((s) => s === 'campanillaHorno')).toHaveLength(1);

  expect(errors).toEqual([]);
  const sonido = conSonido ? await sonidoGrabado(page) : null;
  const video = page.video();
  await page.close();
  if (video && conSonido) await guardarConSonido(video, join(DIR, `barra-${tam(info)}.webm`), sonido, t0);
});

test('con movimiento reducido y lo que terminó mientras no estabas: la nota al entrar y el horno quieto', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'a 390, con movimiento reducido');
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // La hornada terminó hace rato (mientras estabas en el piso): al entrar, la nota y el horno encendido
  const { cafe } = await alCafe(page, () => [hornada(1, 'galletas', 120000)], { reducido: true });
  const btn = cafe.locator('.cf3-horno-btn');
  const nota = cafe.locator('.cf3-nota-horno');
  await expect(nota).toContainText('Ya están las galletas.', { timeout: 8000 });
  await expect(btn).toHaveAttribute('data-listo', 'true');
  const anim = await page.evaluate(() => [
    getComputedStyle(document.querySelector('.cf3-horno-btn__campana')).animationName,
    getComputedStyle(document.querySelector('.cf3-nota-horno')).animationName,
    getComputedStyle(document.querySelector('.cf3-horno-btn'), '::after').animationName,
  ]);
  expect(anim).toEqual(['none', 'none', 'none']);
  await quieto(page, 300);
  await page.screenshot({ path: join(DIR, `reducido-al-entrar-${tam(info)}.png`) });
  expect(errors).toEqual([]);
});
