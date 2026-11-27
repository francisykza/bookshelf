// 1.134 · El almacén en el ordenador del piso (docs/qa/almacen-ordenador.md, bloque 1): la tarjeta «En el almacén» del
// escritorio, la pantalla «Almacén» (ofertas de hoy, nuevo y todo el almacén), la «!» de lo nuevo sin ver y, al tocar un mueble,
// el almacén directamente delante de él con su ficha y «Al ordenador» para volver. Supabase simulado: nunca una cuenta real.
// El día del servidor se fija en el 15-11-2026 (Capa y Antifaz llegó el 10-11 y aún es nuevo).
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { ANA, SALA } from './v190-apoyo';

const DIR = join('qa-report', 'v1134');
const tam = (info) => info.project.name.replace(/^chromium-/, '');
const OFERTAS = [
  { id: 'reloj', pct: 50, tipo: 'semana' },
  { id: 'mesa', pct: 20, tipo: 'dia' },
  { id: 'sillon', pct: 20, tipo: 'dia' },
  { id: 'cuadro', pct: 20, tipo: 'dia' },
  { id: 'espejo', pct: 20, tipo: 'dia' },
];
const VISTO = 'bookshelf:almacen-visto';

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

test.beforeEach(({}, info) => {
  test.skip(!['chromium-390x844', 'chromium-360x800'].includes(info.project.name), 'solo 390 y 360');
  mkdirSync(DIR, { recursive: true });
});

/** El piso de Ana con el almacén abierto. `vistos`: lo ya visto de lo nuevo (sin ponerlo, la primera vez). */
async function casa(page, { vistos, almacen = true } = {}) {
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  if (vistos) await page.addInitScript(([k, v]) => !sessionStorage.getItem('sembrado-visto') && (sessionStorage.setItem('sembrado-visto', '1'), localStorage.setItem(k, v)), [VISTO, JSON.stringify({ nuevos: vistos })]);
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout: SALA });
  mock.db.piso_cuentas[ANA.id] = { inicio_elegido: true, tickets: 120, sin_raro: 0 };
  mock.db.piso_inventario = { [ANA.id]: { sillon: 1, 'mesa-baja': 1, estanteria: 1, escritorio: 1, ventana: 1, 'lampara-pie': 1 } };
  if (almacen) mock.db.almacen = { ofertas: OFERTAS, hoy: '2026-11-15' };
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1200);
  return mock;
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

/** Que el almacén esté abierto delante de `nombre`, con su ficha, y la cámara mirándolo de cerca. */
async function delanteDe(page, nombre) {
  const hotel = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' });
  await expect(hotel.locator('section.alm')).toHaveAttribute('data-ready', 'true', { timeout: 20000 });
  await expect(hotel.locator('.alm-card--ficha h4')).toHaveText(nombre, { timeout: 10000 });
  await page.waitForFunction(() => window.__almacen3d?.examining() != null && window.__almacen3d.settled());
  await expect(hotel.getByRole('button', { name: 'Al ordenador' })).toBeVisible();
  // Sin viaje: ni la limusina ni la fachada del hotel
  await expect(hotel.locator('.gh-limo, canvas.hotel-canvas')).toHaveCount(0);
  return hotel;
}

test('recorrido: el aviso en el escritorio, la pantalla «Almacén» y al almacén delante del mueble', async ({ page }, info) => {
  test.setTimeout(240000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  // Dos de los nuevos sin ver (así se verá cuando llegue un mueble nuevo)
  await casa(page, { vistos: ['estanteria-comics', 'foco-heroe', 'maniqui-capa', 'cartel-vinetas'] });
  const foto = fotoDe(page, info);
  await alOrdenador(page);

  // 1. La tarjeta del escritorio: lo nuevo sin ver primero, luego la oferta de la semana; con la «!»
  const card = page.locator('.pp-alm-card');
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect(card.getByRole('heading')).toContainText('En el almacén');
  await expect(card.locator('h3 .pp-alm-nuevo')).toHaveCount(1);
  await expect(card.locator('.pp-alm-card__list button')).toHaveCount(3);
  await expect(card.locator('.pp-alm-card__nombre')).toHaveText(['Sillón de la capa', 'Neón del rayo', 'Reloj']);
  await card.scrollIntoViewIfNeeded();
  await foto('1-escritorio-tarjeta');

  // 2. En «Aplicaciones», el grupo «El edificio» con el almacén y lo nuevo
  await page.getByRole('button', { name: 'Aplicaciones', exact: true }).click();
  const fila = page.locator('.pp-apps button[data-name="Almacén"]');
  await fila.scrollIntoViewIfNeeded();
  await expect(fila).toContainText('2 muebles nuevos');
  await foto('2-aplicaciones');
  await fila.click();

  // 3. La pantalla «Almacén»
  await expect(page.getByRole('heading', { name: 'Almacén', exact: true })).toBeVisible();
  const app = page.locator('.pp-alm');
  await expect(app.getByRole('heading', { name: 'El Almacén del Puerto' })).toBeVisible({ timeout: 15000 });
  await expect(app).toContainText('Tienes 120 Libocoins');
  const ofertas = app.locator('section[aria-labelledby="pp-alm-ofertas"] .pp-alm__fila');
  await expect(ofertas).toHaveCount(5);
  await expect(ofertas.first()).toContainText('Reloj');
  await expect(ofertas.first()).toContainText('Oferta de la semana · −50 % · hasta el domingo');
  await expect(ofertas.nth(1)).toContainText('Oferta del día · −20 % · hasta medianoche');
  await foto('3-almacen-ofertas');
  const nuevos = app.locator('section[aria-labelledby="pp-alm-nuevo"]');
  await expect(nuevos.locator('.pp-alm__fila')).toHaveCount(6);
  await expect(nuevos.locator('.pp-alm-nuevo')).toHaveCount(2);
  await expect(nuevos).toContainText('Nuevo · llegó el 10 de noviembre');
  await nuevos.scrollIntoViewIfNeeded();
  await foto('4-almacen-nuevo');
  const todo = app.locator('section[aria-labelledby="pp-alm-todo"]');
  // 1.149: con las veinte del ala nueva, 40
  await expect(todo.locator('.pp-alm__fila')).toHaveCount(40);
  await expect(todo.locator('.pp-alm__fila', { hasText: 'Sillón de la capa' })).toContainText('No se rebaja nunca');
  await todo.locator('h5').first().scrollIntoViewIfNeeded();
  await foto('5-almacen-todo');
  await todo.locator('.pp-alm__pasillo').last().scrollIntoViewIfNeeded();
  await foto('6-almacen-capa-y-antifaz');

  // 4. Tocar la oferta de la semana: el almacén, directamente delante del reloj y con su ficha
  await ofertas.first().scrollIntoViewIfNeeded();
  await ofertas.first().click();
  let hotel = await delanteDe(page, 'Reloj');
  await expect(hotel.locator('.alm-card--ficha')).toContainText('Oferta de la semana · −50 %');
  await page.waitForTimeout(600);
  await foto('7-almacen-delante-del-reloj');

  // 5. «Al ordenador» vuelve a la pantalla «Almacén»; lo nuevo ya está visto
  await hotel.getByRole('button', { name: 'Al ordenador' }).click();
  await expect(page.getByRole('heading', { name: 'Almacén', exact: true })).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.pp-alm section[aria-labelledby="pp-alm-nuevo"] .pp-alm__fila')).toHaveCount(6, { timeout: 15000 });
  await expect(page.locator('.pp-alm .pp-alm-nuevo')).toHaveCount(0);
  await foto('8-vuelta-al-ordenador');

  // 6. Un mueble nuevo de las habitaciones, desde su apartado
  await page.locator('.pp-alm section[aria-labelledby="pp-alm-nuevo"] .pp-alm__fila', { hasText: 'Sillón de la capa' }).click();
  hotel = await delanteDe(page, 'Sillón de la capa');
  await page.waitForTimeout(600);
  await foto('9-almacen-delante-del-sillon-capa');
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Almacén', exact: true })).toBeVisible({ timeout: 20000 });

  // 7. De vuelta al escritorio: la tarjeta, ya sin la «!», son las ofertas; desde ella, al almacén delante de la mesa
  await page.getByRole('button', { name: 'Volver al escritorio' }).click();
  // El ordenador recuerda que venías del cajón «Aplicaciones» (como con el resto de funciones): se cierra con su flecha
  await expect(page.locator('.pp-apps')).toBeVisible();
  await page.locator('.pp-apps').getByRole('button', { name: 'Volver al escritorio' }).click();
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect(card.locator('.pp-alm-nuevo')).toHaveCount(0);
  await expect(card.locator('.pp-alm-card__nombre')).toHaveText(['Reloj', 'Mesa', 'Sillón']);
  await card.scrollIntoViewIfNeeded();
  await foto('10-escritorio-sin-aviso');
  await card.getByRole('button', { name: /^Mesa, oferta del día/ }).click();
  hotel = await delanteDe(page, 'Mesa');
  await foto('11-almacen-delante-de-la-mesa');
  await hotel.getByRole('button', { name: 'Al ordenador' }).click();
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.pp-alm-card')).toBeVisible({ timeout: 15000 });
  await foto('12-de-vuelta-al-escritorio');

  expect(errores).toEqual([]);
  const video = page.video();
  await page.close();
  if (video) await video.saveAs(join(DIR, `recorrido-${tam(info)}.webm`));
});

test('la primera vez lo que ya había cuenta como visto; sin el almacén, no hay tarjeta', async ({ page }, info) => {
  test.setTimeout(150000);
  test.skip(info.project.name !== 'chromium-390x844', 'basta a 390');
  await casa(page);
  const foto = fotoDe(page, info);
  await alOrdenador(page);
  const card = page.locator('.pp-alm-card');
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect(card.locator('.pp-alm-nuevo')).toHaveCount(0);
  await expect(card.locator('.pp-alm-card__nombre')).toHaveText(['Reloj', 'Mesa', 'Sillón']);
  await page.getByRole('button', { name: 'Aplicaciones', exact: true }).click();
  await expect(page.locator('.pp-apps button[data-name="Almacén"] small')).toHaveCount(0);
  await page.locator('.pp-apps button[data-name="Almacén"]').click();
  await expect(page.locator('.pp-alm section[aria-labelledby="pp-alm-nuevo"] .pp-alm__fila')).toHaveCount(6, { timeout: 15000 });
  await expect(page.locator('.pp-alm .pp-alm-nuevo')).toHaveCount(0);
  await foto('13-primera-vez');
  const video = page.video();
  await page.close();
  await video?.delete();
});

test('sin la migración del almacén: ni tarjeta ni error en el escritorio', async ({ page }, info) => {
  test.setTimeout(120000);
  test.skip(info.project.name !== 'chromium-390x844', 'basta a 390');
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await casa(page, { almacen: false });
  await alOrdenador(page);
  await page.waitForTimeout(1500);
  await expect(page.locator('.pp-alm-card')).toHaveCount(0);
  expect(errores).toEqual([]);
  const video = page.video();
  await page.close();
  await video?.delete();
});
