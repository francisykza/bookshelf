// 1.135 · El almacén en el ordenador, bloque 2 (docs/qa/almacen-ordenador.md): seguir el precio de un mueble con su marcapáginas
// (desde la pantalla «Almacén» y desde la ficha del almacén), «Lo que sigues», la «!» de lo que sigues rebajado (una vez por
// oferta) y la «!» sobre el monitor del piso, que se va al abrir el ordenador. Supabase simulado: nunca una cuenta real.
// El día del servidor se fija en el 15-11-2026 (Capa y Antifaz llegó el 10-11 y aún es nuevo).
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { ANA, SALA } from './v190-apoyo';

const DIR = join('qa-report', 'v1135');
const tam = (info) => info.project.name.replace(/^chromium-/, '');
const OFERTAS = [
  { id: 'reloj', pct: 50, tipo: 'semana' },
  { id: 'mesa', pct: 20, tipo: 'dia' },
  { id: 'sillon', pct: 20, tipo: 'dia' },
  { id: 'cuadro', pct: 20, tipo: 'dia' },
  { id: 'espejo', pct: 20, tipo: 'dia' },
];
const HEROES = ['sillon-capa', 'estanteria-comics', 'foco-heroe', 'maniqui-capa', 'cartel-vinetas', 'neon-rayo'];
const VISTO = 'bookshelf:almacen-visto';

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

test.beforeEach(({}, info) => {
  test.skip(!['chromium-390x844', 'chromium-360x800'].includes(info.project.name), 'solo 390 y 360');
  mkdirSync(DIR, { recursive: true });
});

/**
 * El piso de Ana con el almacén abierto. `vistos`: lo ya visto de lo nuevo; `deseados`: lo que sigue (sin ponerlo, el servidor
 * aún no tiene la migración de los deseados).
 */
async function casa(page, { vistos = HEROES, deseados } = {}) {
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.addInitScript(([k, v]) => !sessionStorage.getItem('sembrado-visto') && (sessionStorage.setItem('sembrado-visto', '1'), localStorage.setItem(k, v)), [VISTO, JSON.stringify({ nuevos: vistos })]);
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout: SALA });
  mock.db.piso_cuentas[ANA.id] = { inicio_elegido: true, tickets: 120, sin_raro: 0 };
  mock.db.piso_inventario = { [ANA.id]: { sillon: 1, 'mesa-baja': 1, estanteria: 1, escritorio: 1, ventana: 1, 'lampara-pie': 1 } };
  mock.db.almacen = { ofertas: OFERTAS, hoy: '2026-11-15', ...(deseados ? { deseados: { [ANA.id]: deseados } } : {}) };
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1200);
  return mock;
}

/** Gira la vista hasta tener el ordenador de frente (para ver su «!»); devuelve si se ve. */
async function mirarAlOrdenador(page) {
  return page.evaluate(() => {
    const api = window.__pisoLab?.();
    if (!api) return false;
    const [a, b] = api.yawRange();
    let mejor = null;
    for (let k = 0; k <= 40; k += 1) {
      const y = a + ((b - a) * k) / 40;
      api.lookTo(y);
      const at = api.deskAnchor();
      const w = document.querySelector('.plab-stage').clientWidth;
      const d = Math.abs(at.x - w * 0.62);
      if (at.shown && (!mejor || d < mejor.d)) mejor = { y, d };
    }
    if (!mejor) return false;
    api.lookTo(mejor.y);
    return true;
  });
}

async function alOrdenador(page) {
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible({ timeout: 12000 });
}

const fotoDe = (page, info) => async (n) => {
  await page.waitForTimeout(350);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: join(DIR, `${tam(info)}-${n}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `desborde en ${n}`).toBe(true);
};

async function delanteDe(page, nombre) {
  const hotel = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' });
  await expect(hotel.locator('section.alm')).toHaveAttribute('data-ready', 'true', { timeout: 20000 });
  await expect(hotel.locator('.alm-card--ficha h4')).toHaveText(nombre, { timeout: 10000 });
  await page.waitForFunction(() => window.__almacen3d?.examining() != null && window.__almacen3d.settled());
  await expect(hotel.getByRole('button', { name: 'Al ordenador' })).toBeVisible();
  return hotel;
}

test('recorrido: seguir y dejar de seguir, la «!» de lo que sigues rebajado y la del monitor del piso', async ({ page }, info) => {
  test.setTimeout(260000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  // Ana ya sigue la mesa (hoy, −20 %) y el mapa (sin oferta); lo nuevo ya lo ha visto
  const mock = await casa(page, { deseados: ['mesa', 'mapa'] });
  const foto = fotoDe(page, info);

  // 1. En el piso, la «!» sobre el monitor
  expect(await mirarAlOrdenador(page)).toBe(true);
  const aviso = page.locator('.plab-aviso');
  await expect(aviso).toBeVisible({ timeout: 10000 });
  await foto('1-piso-aviso-en-el-monitor');

  // 2. El escritorio: la mesa que sigues, rebajada y con su «!», delante de todo
  await alOrdenador(page);
  const card = page.locator('.pp-alm-card');
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect(card.locator('h3 .pp-alm-nuevo')).toHaveCount(1);
  await expect(card.locator('.pp-alm-card__nombre')).toHaveText(['Mesa', 'Reloj', 'Sillón']);
  await expect(card.locator('.pp-alm-card__list li').first()).toContainText('Lo sigues');
  await expect(card.locator('.pp-alm-card__list li').first().locator('.pp-alm-nuevo')).toHaveCount(1);
  await card.scrollIntoViewIfNeeded();
  await foto('2-escritorio-lo-que-sigues');

  // 3. En «Aplicaciones», lo que sigues rebajado
  await page.getByRole('button', { name: 'Aplicaciones', exact: true }).click();
  const fila = page.locator('.pp-apps button[data-name="Almacén"]');
  await fila.scrollIntoViewIfNeeded();
  await expect(fila).toContainText('1 que sigues, rebajado');
  await fila.click();

  // 4. La pantalla: «Lo que sigues» primero, la mesa rebajada (con su «!») y el mapa sin oferta
  const app = page.locator('.pp-alm');
  await expect(app.getByRole('heading', { name: 'El Almacén del Puerto' })).toBeVisible({ timeout: 15000 });
  const sigues = app.locator('section[aria-labelledby="pp-alm-sigues"]');
  await expect(app.locator('.pp-alm__seccion').first()).toHaveAttribute('aria-labelledby', 'pp-alm-sigues');
  await expect(sigues.locator('.pp-alm__fila')).toHaveCount(2);
  await expect(sigues.locator('.pp-alm__fila').first()).toContainText('Mesa');
  await expect(sigues.locator('.pp-alm__fila').first()).toContainText('Oferta del día · −20 % · hasta medianoche');
  await expect(sigues.locator('.pp-alm__fila').first().locator('.pp-alm-nuevo')).toHaveCount(1);
  await expect(sigues.locator('.pp-alm__fila').nth(1)).toContainText('Sin oferta hoy');
  await expect(sigues.locator('button[data-name="seguir:mesa"]')).toHaveAttribute('aria-pressed', 'true');
  await foto('3-almacen-lo-que-sigues');

  // 5. Seguir el espejo desde las ofertas: se ve al momento, sin «!» (lo estás viendo), y lo guarda el servidor
  const ofertas = app.locator('section[aria-labelledby="pp-alm-ofertas"]');
  const espejo = ofertas.locator('button[data-name="seguir:espejo"]');
  await espejo.scrollIntoViewIfNeeded();
  await expect(espejo).toHaveAttribute('aria-pressed', 'false');
  await espejo.click();
  await expect(espejo).toHaveAttribute('aria-pressed', 'true');
  await expect(app.locator('.pp-alm__aviso')).toContainText('Sigues el precio de Espejo');
  await foto('4-almacen-sigues-el-espejo');
  await expect(sigues.locator('.pp-alm__fila')).toHaveCount(3);
  await expect(sigues.locator('.pp-alm__fila', { hasText: 'Espejo' }).locator('.pp-alm-nuevo')).toHaveCount(0);
  expect(mock.db.almacen.deseados[ANA.id]).toEqual(['mesa', 'mapa', 'espejo']);

  // 6. Dejar de seguir el mapa desde «Lo que sigues»
  await sigues.scrollIntoViewIfNeeded();
  await sigues.locator('button[data-name="seguir:mapa"]').click();
  await expect(sigues.locator('.pp-alm__fila')).toHaveCount(2);
  await expect(app.locator('.pp-alm__aviso')).toContainText('Ya no sigues Mapa');
  expect(mock.db.almacen.deseados[ANA.id]).toEqual(['mesa', 'espejo']);
  await foto('5-almacen-deja-de-seguir-el-mapa');

  // 7. Lo de las habitaciones especiales no se sigue: no tiene marcapáginas
  const todo = app.locator('section[aria-labelledby="pp-alm-todo"]');
  const capa = todo.locator('.pp-alm__item', { hasText: 'Sillón de la capa' });
  await capa.scrollIntoViewIfNeeded();
  await expect(capa.locator('button.pp-alm__seguir')).toHaveCount(0);
  await expect(capa).toContainText('No se rebaja nunca');
  await foto('6-almacen-especiales-sin-marcapaginas');

  // 8. Al almacén, delante del reloj: «Seguir su precio» en su ficha
  await ofertas.locator('.pp-alm__fila', { hasText: 'Reloj' }).scrollIntoViewIfNeeded();
  await ofertas.locator('.pp-alm__fila', { hasText: 'Reloj' }).click();
  const hotel = await delanteDe(page, 'Reloj');
  const boton = hotel.locator('.alm-card--ficha .alm-btn--seguir');
  await expect(boton).toHaveText('Seguir su precio');
  await expect(boton).toHaveAttribute('aria-pressed', 'false');
  await foto('7-ficha-seguir-su-precio');
  await boton.click();
  await expect(boton).toHaveText('Sigues su precio');
  await expect(boton).toHaveAttribute('aria-pressed', 'true');
  await expect(hotel.locator('.alm-avisos')).toContainText('Sigues su precio');
  expect(mock.db.almacen.deseados[ANA.id]).toEqual(['mesa', 'espejo', 'reloj']);
  await page.waitForTimeout(500);
  await foto('8-ficha-sigues-su-precio');

  // 9. En el directorio del almacén, la marca de lo que sigues
  await hotel.getByRole('button', { name: 'Volver', exact: true }).click();
  await hotel.getByRole('button', { name: /^Directorio/ }).click();
  const dir = hotel.locator('.alm-dir__item', { hasText: 'Mapa' }).first();
  await expect(hotel.locator('.alm-dir__ofertas .alm-dir__item', { hasText: 'Reloj' })).toContainText('lo sigues');
  await expect(dir).not.toContainText('Lo sigues');
  const espejoDir = hotel.locator('.alm-dir__seccion:not(.alm-dir__ofertas) .alm-dir__item', { hasText: 'Espejo' });
  await espejoDir.scrollIntoViewIfNeeded();
  await expect(espejoDir.locator('.alm-dir__sigues')).toBeVisible();
  await foto('9-directorio-con-la-marca');

  // 10. «Al ordenador»: lo que sigues, con el reloj (la de la semana primero), y ya sin «!»
  await hotel.getByRole('button', { name: 'Al ordenador' }).click();
  await expect(page.getByRole('heading', { name: 'Almacén', exact: true })).toBeVisible({ timeout: 20000 });
  await expect(sigues.locator('.pp-alm__fila')).toHaveCount(3, { timeout: 15000 });
  await expect(sigues.locator('.pp-alm__txt b')).toHaveText(['Reloj', 'Mesa', 'Espejo']);
  await expect(app.locator('.pp-alm-nuevo')).toHaveCount(0);
  await foto('10-vuelta-lo-que-sigues');

  // 11. De vuelta al piso: la «!» del monitor ya no está
  await page.getByRole('button', { name: 'Volver al escritorio' }).click();
  await page.locator('.pp-apps').getByRole('button', { name: 'Volver al escritorio' }).click();
  await expect(card.locator('.pp-alm-nuevo')).toHaveCount(0);
  await page.getByRole('button', { name: 'Salir del ordenador' }).click();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 20000 });
  expect(await mirarAlOrdenador(page)).toBe(true);
  await page.waitForTimeout(600);
  await expect(aviso).toHaveCount(0);
  await foto('11-piso-sin-aviso');

  expect(errores).toEqual([]);
  const video = page.video();
  await page.close();
  if (video) await video.saveAs(join(DIR, `recorrido-${tam(info)}.webm`));
});

test('una oferta avisa una sola vez: al día siguiente, otra oferta de lo que sigues vuelve a avisar', async ({ page }, info) => {
  test.setTimeout(150000);
  test.skip(info.project.name !== 'chromium-390x844', 'basta a 390');
  const mock = await casa(page, { deseados: ['mesa'] });
  await alOrdenador(page);
  const card = page.locator('.pp-alm-card');
  await expect(card.locator('h3 .pp-alm-nuevo')).toHaveCount(1, { timeout: 15000 });
  // Al tocarla en la tarjeta, vista
  await card.getByRole('button', { name: /^Mesa, lo sigues/ }).click();
  const hotel = await delanteDe(page, 'Mesa');
  await hotel.getByRole('button', { name: 'Al ordenador' }).click();
  await expect(card).toBeVisible({ timeout: 20000 });
  await expect(card.locator('.pp-alm-nuevo')).toHaveCount(0);
  // Se cierra el ordenador (si no, al recargar vuelve a abrirse y tapa el monitor)
  await page.getByRole('button', { name: 'Salir del ordenador' }).click();
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toHaveCount(0);
  // Al recargar sigue vista
  await page.reload();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  expect(await mirarAlOrdenador(page)).toBe(true);
  await page.waitForTimeout(800);
  await expect(page.locator('.plab-aviso')).toHaveCount(0);
  // Otro día, la mesa vuelve a estar rebajada: otra oferta, otra «!»
  mock.db.almacen.hoy = '2026-11-16';
  await page.reload();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  expect(await mirarAlOrdenador(page)).toBe(true);
  await expect(page.locator('.plab-aviso')).toBeVisible({ timeout: 10000 });
  await alOrdenador(page);
  await expect(page.locator('.pp-alm-card h3 .pp-alm-nuevo')).toHaveCount(1, { timeout: 15000 });
  const video = page.video();
  await page.close();
  await video?.delete();
});

test('el tope de 40 y sin la migración de los deseados', async ({ page }, info) => {
  test.setTimeout(150000);
  test.skip(info.project.name !== 'chromium-390x844', 'basta a 390');
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  // Con 40 (de relleno: el almacén vende menos), el servidor no deja seguir otro y el marcapáginas vuelve a como estaba
  const mock = await casa(page, { deseados: Array.from({ length: 40 }, (_, i) => `relleno-${i}`) });
  await alOrdenador(page);
  await page.locator('.pp-alm-card').getByRole('button', { name: 'Ver el almacén' }).click();
  const app = page.locator('.pp-alm');
  await expect(app.locator('section[aria-labelledby="pp-alm-sigues"]')).toContainText('Toca el marcapáginas', { timeout: 15000 });
  const mesa = app.locator('section[aria-labelledby="pp-alm-ofertas"] button[data-name="seguir:mesa"]');
  await mesa.click();
  await expect(app.locator('.pp-alm__aviso')).toContainText('Ya sigues 40 muebles');
  await expect(mesa).toHaveAttribute('aria-pressed', 'false');
  await fotoDe(page, info)('12-tope-de-40');
  expect(mock.db.almacen.deseados[ANA.id]).toHaveLength(40);

  // Sin la migración: lo de la 1.134 (ofertas, nuevo, la «!» de lo nuevo, también en el monitor), sin marcapáginas
  await page.close();
  const otra = await page.context().newPage();
  otra.on('pageerror', (e) => errores.push(e.message));
  await casa(otra, { vistos: HEROES.slice(1), deseados: undefined });
  expect(await mirarAlOrdenador(otra)).toBe(true);
  await expect(otra.locator('.plab-aviso')).toBeVisible({ timeout: 10000 });
  await alOrdenador(otra);
  await otra.locator('.pp-alm-card').getByRole('button', { name: 'Ver el almacén' }).click();
  await expect(otra.locator('.pp-alm section[aria-labelledby="pp-alm-ofertas"] .pp-alm__fila')).toHaveCount(5, { timeout: 15000 });
  await expect(otra.locator('.pp-alm section[aria-labelledby="pp-alm-sigues"]')).toHaveCount(0);
  await expect(otra.locator('.pp-alm__seguir')).toHaveCount(0);
  await otra.locator('.pp-alm section[aria-labelledby="pp-alm-ofertas"] .pp-alm__fila', { hasText: 'Mesa' }).click();
  const hotel = await delanteDe(otra, 'Mesa');
  await expect(hotel.locator('.alm-btn--seguir')).toHaveCount(0);
  expect(errores).toEqual([]);
  const video = otra.video();
  await otra.close();
  await video?.delete();
});
