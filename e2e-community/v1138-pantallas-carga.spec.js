// 1.138 · Las pantallas de carga, todas con la escena de Libotown (Francisco, 15-11-2026: «cambia las pantallas de carga de la
// app para que utilicen la nueva escena de libotown y que como mucho cambie el mensaje de adonde te redirijen»). En cada viaje
// se retiene lo que se está cargando (el módulo 3D de la sala, el panel o los datos) para ver la pantalla y medirla: el marrón
// de la marca, el logo en el mismo sitio y tamaño que al abrir la app, el mensaje debajo de las letras, toda la pantalla y por
// encima de todo. Supabase simulado: nunca una cuenta real. Capturas y vídeos en qa-report/v1138/ (ANTES=1: las de antes).
import { expect, test } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { ANA, SALA } from './v190-apoyo';

const ANTES = Boolean(process.env.ANTES);
const DIR = join('qa-report', 'v1138', ANTES ? 'antes' : 'ahora');
const tam = (info) => info.project.name.replace(/^chromium-/, '');
const BRUNO = { id: '33333333-3333-4333-8333-333333333333' };
const SUPABASE = '**/rest/v1/rpc';

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

test.beforeEach(({}, info) => {
  test.skip(!['chromium-390x844', 'chromium-360x800'].includes(info.project.name), 'solo 390 y 360');
  mkdirSync(DIR, { recursive: true });
});

test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) await page.screenshot({ path: join(DIR, `fallo-${tam(info)}-${info.title.split(':')[0].replace(/\W+/g, '-')}.png`) }).catch(() => {});
  // El vídeo de cada recorrido, con su nombre, para juntarlos después
  const video = page.video();
  await page.close();
  if (video && info.project.name === 'chromium-390x844') copyFileSync(await video.path(), join(DIR, `${info.title.split(':')[0].replace(/\W+/g, '-')}.webm`));
});

/** Ana en su piso, con Bruno de vecino y siguiéndole; el almacén, el casino y la sala con lo mínimo. */
async function preparar(page, { retenerPiso = false, reducido = false } = {}) {
  // La fachada del hotel se toca en su sitio solo con la cámara quieta (como en v198)
  if (reducido) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push(
    { user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true },
    { user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'lector-farol', community_enabled: true },
  );
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' }, { user_id: BRUNO.id, edificio: 'edificio-1', puerta: '1A' });
  mock.db.pisos.push({ user_id: ANA.id, layout: SALA }, { user_id: BRUNO.id, layout: SALA });
  mock.db.follows.push({ follower: ANA.id, followed: BRUNO.id });
  mock.db.corners.push({ user_id: BRUNO.id, visible: true, featured_books: [], figure_ids: [], guardian_id: null, show_current: false, current_title: null, memories: [] });
  mock.db.piso_cuentas[ANA.id] = { inicio_elegido: true, tickets: 120, sin_raro: 0 };
  mock.db.piso_inventario = { [ANA.id]: { sillon: 1, 'mesa-baja': 1, estanteria: 1, escritorio: 1, ventana: 1, 'lampara-pie': 1 } };
  mock.db.almacen = { ofertas: [{ id: 'reloj', pct: 50, tipo: 'semana' }], hoy: '2026-11-15' };
  mock.db.casino = { tienes: [], hitos: [], amigos: {} };
  mock.db.sala = { lomos: [], saludos: [] };
  mock.db.citas = { amigos: [], invitaciones: [] };
  mock.db.sala_personajes = [];
  await mock.attach(page, ANA);
  const piso = retenerPiso ? await retener(page, '**/src/features/pisoLab/interior3d.js*') : null;
  await page.goto('/?inicio=habitacion');
  return { mock, piso };
}

const enCasa = async (page) => {
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(900);
};

/** Retiene las peticiones de `patron` hasta llamar a lo que devuelve. */
async function retener(page, patron) {
  let soltar;
  const espera = new Promise((r) => (soltar = r));
  await page.route(patron, async (route) => {
    await espera;
    await route.fallback();
  });
  return async () => {
    soltar();
    await page.unroute(patron);
  };
}

/**
 * La pantalla de carga con `mensaje`: una sola, la escena de Libotown igual que al abrir la app, por encima de todo. Foto `n`.
 * Con ANTES=1 (la versión anterior) solo la foto del mensaje, sea cual sea su pantalla.
 */
async function pantalla(page, info, mensaje, n) {
  if (ANTES) {
    // Los mensajes de antes eran otros («Entrando…», «Buscando tu puerta…»): lo retenido sigue cargando, se fotografía lo que hay
    await page.waitForTimeout(1800);
    await page.screenshot({ path: join(DIR, `${tam(info)}-${n}.png`) });
    return;
  }
  const p = page.locator('.pantalla-carga');
  await expect(p).toHaveCount(1, { timeout: 20000 });
  await expect(p).toHaveText(mensaje);
  // Una sola: ni el fondo de arranque repite su mensaje ni queda el aviso de antes de la sala
  await expect(page.getByRole('status').filter({ hasText: mensaje })).toHaveCount(1);
  await expect(page.locator('.home-boot')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  const m = await page.evaluate(() => {
    const el = document.querySelector('.pantalla-carga');
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const rango = document.createRange();
    rango.selectNodeContents(el);
    const t = rango.getBoundingClientRect();
    // Por encima de todo: en el centro, en las esquinas y donde suelen ir las barras, lo que se toca es la pantalla de carga
    const puntos = [[innerWidth / 2, innerHeight / 2], [8, 8], [innerWidth - 8, 8], [8, innerHeight - 8], [innerWidth - 8, innerHeight - 8], [innerWidth / 2, 30], [innerWidth / 2, innerHeight - 30]];
    return {
      fondo: cs.backgroundColor,
      logo: cs.backgroundImage,
      tamano: cs.backgroundSize,
      posicion: cs.backgroundPosition,
      letra: `${cs.fontStyle} ${cs.fontFamily.split(',')[0]}`,
      color: cs.color,
      caja: [r.x, r.y, r.width, r.height],
      vista: [innerWidth, innerHeight],
      encima: puntos.every(([x, y]) => document.elementFromPoint(x, y) === el),
      texto: { top: t.top, left: t.left, right: t.right },
      enBody: el.parentElement === document.body,
    };
  });
  const [vw, vh] = m.vista;
  expect(m.fondo).toBe('rgb(53, 28, 14)');
  expect(m.logo).toContain('/icons/libotown-logo.webp');
  expect(m.tamano.replace(/ auto$/, '')).toBe(`${Math.min(vw * 0.8, 420)}px`);
  expect(m.posicion).toBe('50% 50%');
  expect(m.letra).toBe('italic Lora');
  expect(m.color).toBe('rgb(243, 231, 204)');
  expect(m.caja).toEqual([0, 0, vw, vh]);
  expect(m.encima).toBe(true);
  expect(m.enBody).toBe(true);
  // El mensaje, debajo de las letras del logo (acaban al 81 % de su alto), como «Abriendo tu piso…» al abrir la app
  const finLetras = vh / 2 + ((Math.min(vw * 0.8, 420) * 2) / 3) * 0.31;
  expect(m.texto.top).toBeGreaterThan(finLetras);
  expect(m.texto.top).toBeLessThan(finLetras + 40);
  expect(m.texto.left).toBeGreaterThanOrEqual(16);
  expect(m.texto.right).toBeLessThanOrEqual(vw - 16);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(DIR, `${tam(info)}-${n}.png`) });
}

test('piso y almacén: al abrir la app y al tocar un mueble del almacén en el ordenador', async ({ page }, info) => {
  test.setTimeout(180000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const { piso } = await preparar(page, { retenerPiso: true });
  await pantalla(page, info, 'Abriendo tu piso…', '1-abriendo-tu-piso');
  await piso();
  await enCasa(page);

  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
  const card = page.locator('.pp-alm-card');
  await expect(card).toBeVisible({ timeout: 15000 });
  const soltar = await retener(page, '**/src/features/edificio/hotel/almacen3d.js*');
  await card.locator('.pp-alm-card__list button').first().click();
  await pantalla(page, info, 'Abriendo el portón del almacén…', '2-almacen');
  await soltar();
  const hotel = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' });
  await expect(hotel.locator('section.alm')).toHaveAttribute('data-ready', 'true', { timeout: 20000 });
  await expect(page.locator('.pantalla-carga')).toHaveCount(0);
  await page.waitForTimeout(1500);
  expect(errores).toEqual([]);
});

test('edificio y café: al salir al portal y al entrar en el bajo', async ({ page }, info) => {
  test.setTimeout(180000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await preparar(page);
  await enCasa(page);
  const portal = await retener(page, `${SUPABASE}/edificio_portal**`);
  await page.getByRole('button', { name: 'Al edificio' }).click();
  await pantalla(page, info, 'Abriendo el portal…', '3-portal');
  await portal();
  const edificio = page.getByRole('dialog', { name: 'El edificio del puerto' });
  const cafe = await retener(page, '**/src/features/edificio/cafe/cafe3d.js*');
  await edificio.getByRole('button', { name: 'Entrar en el café-librería del bajo' }).click({ timeout: 20000 });
  await pantalla(page, info, 'Abriendo el bajo…', '4-cafe');
  await cafe();
  await expect(page.locator('.cf3-stage canvas, .cf3-iso').first()).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.pantalla-carga')).toHaveCount(0);
  await page.waitForTimeout(1500);
  expect(errores).toEqual([]);
});

test('hotel y casino: la recepción y el sótano', async ({ page }, info) => {
  test.setTimeout(180000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await preparar(page, { reducido: true });
  await enCasa(page);
  // Se precargan: se retienen desde antes de coger la limusina
  const recepcion = await retener(page, '**/src/features/edificio/hotel/recepcion3d.js*');
  const casino = await retener(page, '**/src/features/edificio/hotel/casino3d.js*');
  await page.getByRole('button', { name: 'Al edificio' }).click();
  const edificio = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await edificio.getByRole('button', { name: 'Coger la limusina al Gran Hotel' }).click({ timeout: 20000 });
  const hotel = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' });
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1200);
  const at = await page.evaluate(() => {
    const v = window.__granHotel;
    const z = v.zones.find((x) => x.id === 'vestibulo');
    const r = v.canvas.getBoundingClientRect();
    return { x: r.left + z.center.x * r.width, y: r.top + z.center.y * r.height };
  });
  await page.mouse.click(at.x, at.y);
  await pantalla(page, info, 'Abriendo la puerta giratoria…', '5-recepcion');
  await recepcion();
  const rcp = hotel.locator('section.rcp');
  await expect(rcp).toHaveAttribute('data-ready', 'true', { timeout: 20000 });
  await page.waitForFunction(() => window.__recepcion3d?.settled());
  await page.waitForTimeout(800);
  await rcp.locator('.rcp-bar').getByRole('button', { name: 'Ascensor' }).click();
  await page.waitForFunction(() => window.__recepcion3d.settled());
  await rcp.locator('.rcp-cabina').getByRole('button', { name: /casino/ }).click();
  await pantalla(page, info, 'Bajando la escalera del sótano…', '6-casino');
  await casino();
  await expect(hotel.getByRole('region', { name: 'El casino del sótano' })).toHaveAttribute('data-ready', 'true', { timeout: 20000 });
  await expect(page.locator('.pantalla-carga')).toHaveCount(0);
  await page.waitForTimeout(1500);
  expect(errores).toEqual([]);
});

test('sala de lectura: desde el directorio del hotel', async ({ page }, info) => {
  test.setTimeout(180000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await preparar(page);
  await enCasa(page);
  const sala = await retener(page, '**/src/features/edificio/hotel/sala3d.js*');
  await page.getByRole('button', { name: 'Al edificio' }).click();
  const edificio = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await edificio.getByRole('button', { name: 'Coger la limusina al Gran Hotel' }).click({ timeout: 20000 });
  const hotel = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' });
  await hotel.getByRole('button', { name: 'Directorio' }).click({ timeout: 20000 });
  await hotel.getByRole('button', { name: /Café-biblioteca/ }).click();
  await pantalla(page, info, 'Entrando en la sala de lectura…', '7-sala-de-lectura');
  await sala();
  await expect(hotel.getByRole('region', { name: 'La sala de lectura' })).toHaveAttribute('data-ready', 'true', { timeout: 20000 });
  await expect(page.locator('.pantalla-carga')).toHaveCount(0);
  await page.waitForTimeout(1500);
  expect(errores).toEqual([]);
});

test('visita desde el portal: la puerta del vecino y «Entrar en 3D»', async ({ page }, info) => {
  test.setTimeout(180000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await preparar(page);
  await enCasa(page);
  await page.getByRole('button', { name: 'Al edificio' }).click();
  const edificio = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await edificio.getByRole('button', { name: 'Llamar y entrar en el piso de Bruno, 1.º A' }).click({ timeout: 20000 });
  const visita = await retener(page, '**/src/features/pisoLab/VisitaPiso.jsx*');
  await page.getByRole('button', { name: 'Entrar en 3D' }).click({ timeout: 15000 });
  await pantalla(page, info, 'Entrando en el piso de Bruno…', '8-visita-desde-el-portal');
  await visita();
  await expect(page.locator(`.ed-visita3d[data-visita="${BRUNO.id}"] .plab-stage[data-ready]`)).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.pantalla-carga')).toHaveCount(0);
  await page.waitForTimeout(1500);
  expect(errores).toEqual([]);
});

test('visita desde Comunidad: «Visitar» abre su piso', async ({ page }, info) => {
  test.setTimeout(180000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await preparar(page);
  await enCasa(page);
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
  await page.getByRole('button', { name: 'Comunidad', exact: true }).click();
  const datos = await retener(page, `${SUPABASE}/piso_visita**`);
  await page.getByRole('button', { name: 'Visitar el piso de Bruno' }).click({ timeout: 15000 });
  await pantalla(page, info, 'Abriendo su piso…', '9-visita-desde-comunidad');
  await datos();
  await expect(page.locator(`.ed-visita3d[data-visita="${BRUNO.id}"] .plab-stage[data-ready]`)).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.pantalla-carga')).toHaveCount(0);
  await page.waitForTimeout(1500);
  expect(errores).toEqual([]);
});
