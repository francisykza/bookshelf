// 1.80 · El casino del sótano del Gran Hotel, con Supabase simulado: se baja desde el Directorio (o con la «S» del
// ascensor); con lectura hoy, el crupier reparte «Las 21 páginas» (tres manos, sin apostar: cada mano da fichas); sin
// lectura, la puerta está apagada. La mesa para dos: con un amigo, el mismo crupier, en diferido y con bote.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { SOBRES_CERRADOS } from '../src/features/edificio/economy.js';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

// La fecha de hoy en el navegador (la misma que dayKey)
const HOY = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function toPortal(page, casino, { leido = true } = {}) {
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  if (casino) mock.db.casino = casino;
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  // La lectura de hoy, como la deja el registro (o ninguna)
  await page.evaluate(
    ({ hoy, leido: si }) => {
      const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
      st.progress.readingLog = st.progress.readingLog.filter((e) => e.date !== hoy);
      st.progress.pomodoros = st.progress.pomodoros.filter((p) => !p.at.startsWith(hoy));
      if (si) st.progress.readingLog.push({ id: 'qa-casino', bookId: st.books[0].id, date: hoy, pages: 20, from: 0, to: 20, createdAt: `${hoy}T09:00:00.000Z` });
      localStorage.setItem('bookshelf:v1', JSON.stringify(st));
      localStorage.setItem('bookshelf:qa-seed', JSON.stringify(st));
    },
    { hoy: HOY(), leido },
  );
  await page.addInitScript(() => {
    const seed = localStorage.getItem('bookshelf:qa-seed');
    if (seed) localStorage.setItem('bookshelf:v1', seed);
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  return { portal: page.getByRole('dialog', { name: 'El edificio del puerto' }), mock };
}

// 1.108 · La partida se juega sentado a la mesa 3D de la sala: «Sentarse a la mesa» anda hasta ella y se sienta
async function sentarse(page, casino) {
  await casino.getByRole('button', { name: 'Sentarse a la mesa' }).click();
  await page.waitForFunction(() => window.__casino3d?.sentado() && window.__casino3d.settled());
}

async function toHotel(page, casino, opts) {
  const { portal, mock } = await toPortal(page, casino, opts);
  await portal.getByRole('button', { name: 'Coger la limusina al Gran Hotel' }).click({ timeout: 15000 });
  const hotel = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' });
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible();
  return { hotel, mock };
}

test('el casino: repartir, plantarse y ganar fichas sin apostar nada', async ({ page }, info) => {
  test.skip(!/chromium-(320x640|390x844|1440x900)$|webkit-390x844/.test(info.project.name), '320, 390 (Chromium y WebKit) y escritorio');
  const { hotel, mock } = await toHotel(page, { fichas: 30, semana: 30 });
  // Los errores, desde que se está en el hotel (la recarga que siembra la lectura corta peticiones en WebKit)
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await shot(page, info, 'v180-fachada');

  await hotel.getByRole('button', { name: 'Directorio' }).click();
  const floor = hotel.getByRole('button', { name: /Casino del sótano/ });
  await expect(floor).toContainText('Abierto · entrar');
  await floor.click();
  const casino = hotel.getByRole('region', { name: 'El casino del sótano' });
  await expect(casino.getByRole('img', { name: '30 fichas' })).toBeVisible();
  await expect(casino).toContainText('Semana 30/150');
  await expect(casino.locator('.cs3-dice')).toContainText('¿Repartimos?');
  await expect(casino.getByRole('list', { name: 'Tus manos de hoy' })).toContainText('Mano 1: por jugar');
  await shot(page, info, 'v180-casino');

  // La baraja fija del simulado: tú 10 + 7 = 17; el crupier enseña un 9 (y tapa un 6)
  await sentarse(page, casino);
  await casino.getByRole('button', { name: 'Repartir la mano 1 de 3' }).click();
  await expect(casino.getByRole('list', { name: 'Tus cartas: 17' })).toBeVisible();
  await expect(casino.getByRole('list', { name: /Cartas del crupier/ }).getByRole('listitem')).toHaveCount(2);
  // En el paño: las dos del crupier (una tapada) y las dos tuyas
  await expect.poll(() => page.evaluate(() => window.__casino3d.cartas())).toEqual(['c0', 'c1', 't0', 't1']);
  await expect(casino.locator('.cs3-dice')).toContainText('¿Otra carta o te plantas?');
  await expect(casino.locator('.cs3-total').last()).toContainText('Tú');
  await shot(page, info, 'v180-casino-mano');

  // Plantarse: el crupier pide (15 + rey = 25) y se pasa
  await casino.getByRole('button', { name: 'Plantarse' }).click();
  await expect(casino.getByRole('status').last()).toContainText('Ganas la mano: +8 fichas.');
  await expect(casino.getByRole('img', { name: '38 fichas' })).toBeVisible();
  await expect(casino.locator('.gh-21__banner')).toContainText('¡Ganas la mano!');
  await expect(casino.getByRole('list', { name: 'Cartas del crupier: 25' })).toBeVisible();
  await expect(casino.getByRole('button', { name: 'Repartir la mano 2 de 3' })).toBeVisible();
  expect(mock.db.casino.manos[0]).toMatchObject({ estado: 'ganada', fichas: 8 });
  await shot(page, info, 'v180-casino-ganada');

  await page.keyboard.press('Escape');
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('pedir y pasarse da 2 fichas; tras tres manos, a mañana; la «S» del ascensor y la caja', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'una vez basta');
  const dia = HOY();
  const hecha = (mano) => ({ dia, mano, tuyas: [9, 7], crupier: [9, 6], mazo: [], estado: 'ganada', fichas: 8 });
  // Dos manos ya jugadas; la tercera: tú 10 + 5, pides un rey y te pasas
  const { hotel } = await toHotel(page, { fichas: 16, semana: 16, manos: [hecha(1), hecha(2)], barajas: [[9, 9, 4, 6, 12, 3]] });
  await hotel.getByRole('button', { name: 'Directorio' }).click();
  await hotel.getByRole('button', { name: /Vestíbulo/ }).click();
  // Desde la 1.98 el vestíbulo es la recepción en 3D: la «S» está en la botonera de la cabina del ascensor
  await hotel.locator('.rcp-bar').getByRole('button', { name: 'Ascensor' }).click();
  await hotel.locator('.rcp-cabina').getByRole('button', { name: /El casino del sótano/ }).click({ timeout: 15000 });
  const casino = hotel.getByRole('region', { name: 'El casino del sótano' });
  await expect(casino).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
  await sentarse(page, casino);
  await casino.getByRole('button', { name: 'Repartir la mano 3 de 3' }).click();
  await casino.getByRole('button', { name: 'Pedir carta' }).click();
  await expect(casino.getByRole('status').last()).toContainText('Gana el crupier: +2 fichas.');
  await expect(casino).toContainText('Hoy ya has jugado tus tres manos');
  await expect(casino.getByRole('button', { name: /Repartir/ })).toHaveCount(0);
  await expect(casino.getByRole('img', { name: '18 fichas' })).toBeVisible();
  await expect(casino.locator('.gh-21__banner')).toContainText('Gana la casa');
  await shot(page, info, 'v180-casino-perdida');
  // La ventanilla de la sala abre la caja (desde la 1.107, en la sala 3D: se va hasta ella con el plano; desde la 1.108,
  // sentado a la mesa, primero hay que levantarse)
  await casino.getByRole('button', { name: 'Levantarse' }).click();
  await casino.getByRole('button', { name: 'Plano' }).click();
  await casino.getByRole('navigation', { name: 'Plano de la sala' }).getByRole('button', { name: 'La caja' }).click();
  await expect(casino.locator('.gh-21__modes').getByRole('button', { name: 'La caja' })).toHaveAttribute('aria-pressed', 'true');
  await expect(casino.getByRole('list', { name: 'Lo que hay en la caja' })).toBeVisible();
});

test('la caja: el conejo arriba, cambiar fichas por ropa, el sobre y lo que falta', async ({ page }, info) => {
  test.skip(SOBRES_CERRADOS, 'Sobres cerrados por reforma (9-11-2026): vuelve al reabrirlos');
  test.skip(!/chromium-(320x640|390x844|1440x900)$|webkit-390x844/.test(info.project.name), '320, 390 (Chromium y WebKit) y escritorio');
  const { hotel, mock } = await toHotel(page, { fichas: 330, semana: 40, caja: ['complemento:visera'], sobre: [{ mueble: 'sofa', rareza: 'poco-comun', nuevo: true }] });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await hotel.getByRole('button', { name: 'Directorio' }).click();
  await hotel.getByRole('button', { name: /Casino del sótano/ }).click();
  const casino = hotel.getByRole('region', { name: 'El casino del sótano' });
  await casino.getByRole('button', { name: 'La caja' }).click();
  await expect(casino.locator('.cs3-dice')).toContainText('La caja está abierta');

  // El premio gordo, vivo, con lo que falta para él
  const gordo = casino.getByRole('article', { name: 'Conejo de la chistera' });
  await expect(gordo.locator('canvas.gh-caja__live')).toBeVisible();
  await expect(gordo.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '330');
  await expect(gordo.getByRole('button', { name: /te faltan 1170 fichas/ })).toBeDisabled();
  const lista = casino.getByRole('list', { name: 'Lo que hay en la caja' });
  await expect(lista.getByRole('listitem')).toHaveCount(9);
  await expect(lista.getByRole('listitem').filter({ hasText: 'Visera' })).toContainText('Ya es tuyo');
  await expect(lista.getByRole('button', { name: /Gramola: te faltan 70 fichas/ })).toBeDisabled();
  await expect.poll(() => casino.locator('.gh-caja__grid img').evaluateAll((im) => im.every((i) => i.complete && i.naturalWidth > 0))).toBe(true);
  await shot(page, info, 'v180-caja');
  await lista.getByRole('listitem').filter({ hasText: 'Vestido de lentejuelas' }).scrollIntoViewIfNeeded();
  await shot(page, info, 'v180-caja-lista');

  // Ropa: se pide confirmación, se cobra y queda el sello
  const vestido = lista.getByRole('listitem').filter({ hasText: 'Vestido de lentejuelas' });
  await vestido.getByRole('button', { name: /Cambiar 200 fichas/ }).click();
  await expect(vestido.getByRole('group', { name: /¿Cambias 200 fichas/ })).toBeVisible();
  await shot(page, info, 'v180-caja-confirmar');
  await vestido.getByRole('button', { name: 'Sí, cambiar' }).click();
  const reveal = casino.locator('.gh-caja__reveal');
  await expect(reveal).toContainText('¡Es tuyo!');
  await expect(reveal).toContainText('Vestido de lentejuelas');
  await expect(reveal).toContainText('Ya está en el armario de tu piso');
  await shot(page, info, 'v180-caja-premio');
  expect(mock.db.casino.fichas).toBe(130);
  expect(mock.db.casino.caja).toContain('jersey:16');
  await reveal.getByRole('button', { name: 'Volver a la caja' }).click();
  await expect(lista.getByRole('listitem').filter({ hasText: 'Vestido de lentejuelas' })).toContainText('Ya es tuyo');
  await expect(casino.getByRole('img', { name: '130 fichas' }).first()).toBeVisible();

  // El sobre: se abre y enseña lo que traía (se puede cambiar más de una vez)
  const sobre = lista.getByRole('listitem').filter({ hasText: 'Sobre del casino' });
  await sobre.getByRole('button', { name: /Cambiar 120 fichas/ }).click();
  await sobre.getByRole('button', { name: 'Sí, cambiar' }).click();
  await expect(reveal).toContainText('¡Sobre abierto!');
  await expect(reveal.getByRole('list', { name: 'Lo que traía el sobre' })).toContainText('Sofá');
  await expect(reveal).toContainText('¡nuevo!');
  await shot(page, info, 'v180-caja-sobre');
  expect(mock.db.casino.fichas).toBe(10);
  expect(errors).toEqual([]);
});

test('sin lectura hoy, el casino abre igual', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'una vez basta');
  const { hotel } = await toHotel(page, { fichas: 0 }, { leido: false });
  await hotel.getByRole('button', { name: 'Directorio' }).click();
  await hotel.getByRole('button', { name: /Casino del sótano/ }).click();
  const casino = hotel.getByRole('region', { name: 'El casino del sótano' });
  await expect(casino.getByRole('button', { name: 'Sentarse a la mesa' })).toBeVisible();
  await expect(casino).not.toContainText('apagada');
});

test('una invitación avisa en el edificio: la nota, el buzón y al casino con un toque', async ({ page }, info) => {
  test.skip(!/chromium-(320x640|390x844|1440x900)$|webkit-390x844/.test(info.project.name), '320, 390 (Chromium y WebKit) y escritorio');
  const dia = HOY();
  const { portal, mock } = await toPortal(page, { fichas: 30, amigos: [BEA], mesas: [{ id: 'mesa-bea', dia, anfitrion: false, amigo: BEA, estado: 'invitada', fichas: 0, garbanzos: 0 }] }, { leido: false });
  const aviso = page.locator('.ed-aviso');
  await expect(aviso).toContainText('Bea lectora te invita a la mesa para dos del casino.');
  await shot(page, info, 'v181-aviso-portal');
  await expect(portal.locator('.ed-mailbox')).toHaveClass(/has-mail/);

  // «Ahora no» lo guarda; el buzón sigue teniéndolo
  await aviso.getByRole('button', { name: 'Ahora no' }).click();
  await expect(aviso).toHaveCount(0);
  await portal.locator('.ed-mailbox').click();
  await expect(portal.locator('.ed-mailnote')).toContainText('Bea lectora te invita a la mesa para dos del casino.');
  await portal.locator('.ed-mailbox').click();

  // Otra invitación llega también dentro de tu piso, y un toque lleva a la mesa
  mock.db.casino.mesas.push({ id: 'mesa-luis', dia, anfitrion: false, amigo: { uid: '33333333-3333-4333-8333-333333333333', alias: 'Luis', avatar_id: 'lectora-cafe' }, estado: 'invitada', fichas: 0, garbanzos: 0 });
  await portal.getByRole('button', { name: /^Entrar en tu piso/ }).click({ timeout: 15000 });
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('dialog', { name: 'Tu piso' }).locator('canvas.ep-canvas')).toBeVisible();
  await expect(aviso).toBeVisible();
  await shot(page, info, 'v181-aviso-piso');
  await aviso.getByRole('button', { name: 'Ir al casino' }).click();
  const casino = page.getByRole('region', { name: 'El casino del sótano' });
  await expect(casino.getByRole('button', { name: 'Con un amigo' })).toHaveAttribute('aria-pressed', 'true');
  await expect(casino).toContainText('Luis');
  await expect(aviso).toHaveCount(0);
});

test('sin la migración del casino, la sala dice que abre pronto', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'una vez basta');
  const { hotel } = await toHotel(page, null);
  await hotel.getByRole('button', { name: 'Directorio' }).click();
  await hotel.getByRole('button', { name: /Casino del sótano/ }).click();
  await expect(hotel.getByRole('region', { name: 'El casino del sótano' })).toContainText('abre muy pronto');
});

// La mesa para dos: Bea (amiga simulada) invita; se acepta, se juega, se espera y, cuando Bea juega, se resuelve
const BEA = { uid: '22222222-2222-4222-8222-222222222222', alias: 'Bea lectora', avatar_id: 'lectora-cafe' };
const CARLOS = { uid: '33333333-3333-4333-8333-333333333333', alias: 'Carlos', avatar_id: null };

test('la mesa para dos: aceptar la invitación, jugar, esperar al amigo y llevarse el bote', async ({ page }, info) => {
  test.skip(!/chromium-(320x640|390x844|1440x900)$|webkit-390x844/.test(info.project.name), '320, 390 (Chromium y WebKit) y escritorio');
  const dia = HOY();
  // Del mazo: Bea 10 + 6, tú 10 + 8 = 18, el crupier 10 + 7 = 17
  const { hotel, mock } = await toHotel(page, {
    fichas: 30,
    semana: 30,
    garbanzos: 100,
    amigos: [BEA],
    mesas: [{ id: 'mesa-bea', dia, anfitrion: false, amigo: BEA, estado: 'invitada', fichas: 10, garbanzos: 50 }],
    barajas: [[9, 9, 5, 7, 22, 6, 4, 3]],
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await hotel.getByRole('button', { name: 'Directorio' }).click();
  await hotel.getByRole('button', { name: /Casino del sótano/ }).click();
  const casino = hotel.getByRole('region', { name: 'El casino del sótano' });
  await expect(casino.locator('.cs3-dice')).toContainText('Bea lectora te espera en la mesa para dos');
  // 1.107 · El crupier solo habla de cerca; quien te espera se dice al llegar, en el aviso de la sala
  await expect(casino.locator('.cs3-aviso')).toContainText('Bea lectora te espera en la mesa para dos.');
  await expect(casino.getByRole('img', { name: '100 garbanzos' })).toBeVisible();
  const conAmigo = casino.getByRole('button', { name: /Con un amigo/ });
  await expect(conAmigo).toContainText('1');
  await conAmigo.click();
  const invitacion = casino.getByRole('listitem').filter({ hasText: 'Bea lectora te invita a una mesa' });
  await expect(invitacion).toContainText('10 fichas y 50 garbanzos cada uno');
  await shot(page, info, 'v180-mesa-invitacion');

  await invitacion.getByRole('button', { name: 'Aceptar y repartir' }).click();
  await expect(casino.getByRole('list', { name: 'Tus cartas: 18' })).toBeVisible();
  await expect(casino.getByRole('list', { name: 'Cartas de Bea lectora: 2, boca abajo' }).getByLabel('Carta tapada')).toHaveCount(2);
  await expect(casino.locator('.gh-21__pot')).toContainText('20 fichas y 100 garbanzos');
  // Lo apostado ya está apartado (30 − 10; 100 + 20 del día − 50)
  await expect(casino.getByRole('img', { name: '20 fichas' })).toBeVisible();
  await expect(casino.getByRole('img', { name: '70 garbanzos' })).toBeVisible();
  await expect(casino.getByRole('list', { name: 'Tus manos de hoy' })).toContainText('Mano 1 con Bea lectora: en juego');
  await shot(page, info, 'v180-mesa-jugando');

  await casino.getByRole('button', { name: 'Plantarse' }).click();
  await expect(casino).toContainText('Esperando a que Bea lectora juegue su mano');
  await expect(casino.getByRole('button', { name: 'Pedir carta' })).toHaveCount(0);
  await shot(page, info, 'v180-mesa-esperando');

  // Bea pide un rey y se pasa (16 + 10)
  Object.assign(mock.db.casino.mesas[0].suya, { tuyas: [9, 5, 12], estado: 'esperando' });
  await casino.getByRole('button', { name: 'Mirar si ha jugado' }).click();
  await expect(casino.locator('.gh-21__banner')).toContainText('¡Ganas la mano!');
  await expect(casino.locator('.gh-21__banner')).toContainText('El bote es tuyo');
  await expect(casino.getByRole('status').last()).toContainText('Ganas la mano: +10 fichas. Te llevas el bote: 20 fichas y 100 garbanzos.');
  await expect(casino.getByRole('list', { name: 'Cartas de Bea lectora: 26' }).getByRole('listitem')).toHaveCount(3);
  await expect(casino.getByRole('list', { name: 'Cartas del crupier: 17' })).toBeVisible();
  await expect(casino.getByRole('img', { name: '50 fichas' })).toBeVisible();
  await expect(casino.getByRole('img', { name: '170 garbanzos' })).toBeVisible();
  await shot(page, info, 'v180-mesa-ganada');

  await casino.getByRole('button', { name: 'Volver a las mesas para dos' }).click();
  await expect(casino.getByRole('listitem').filter({ hasText: 'Mesa con Bea lectora' })).toContainText('Ganas la apuesta');
  expect(errors).toEqual([]);
});

test('invitar a un amigo: cantidades fijas, nunca más de lo que tienes, una mesa al día con cada uno', async ({ page }, info) => {
  test.skip(!/chromium-(320x640|390x844)$/.test(info.project.name), '320 y 390');
  const { hotel, mock } = await toHotel(page, { fichas: 6, semana: 6, garbanzos: 100, amigos: [BEA, CARLOS] });
  await hotel.getByRole('button', { name: 'Directorio' }).click();
  await hotel.getByRole('button', { name: /Casino del sótano/ }).click();
  const casino = hotel.getByRole('region', { name: 'El casino del sótano' });
  await casino.getByRole('button', { name: /Con un amigo/ }).click();
  await expect(casino.getByRole('button', { name: 'Elige con quién jugar' })).toBeDisabled();
  await casino.getByRole('button', { name: 'Bea lectora', exact: true }).click();
  await expect(casino.getByRole('button', { name: '10 fichas' })).toBeDisabled();
  await casino.getByRole('button', { name: '5 fichas' }).click();
  await casino.getByRole('button', { name: '25 garbanzos' }).click();
  await expect(casino.getByRole('button', { name: '5 fichas' })).toHaveAttribute('aria-pressed', 'true');
  await shot(page, info, 'v180-mesa-invitar');
  await casino.getByRole('button', { name: 'Invitar a Bea lectora' }).click();
  await expect(casino.getByRole('status').last()).toContainText('Invitación enviada a Bea lectora');
  const enviada = casino.getByRole('listitem').filter({ hasText: 'Mesa con Bea lectora' });
  await expect(enviada).toContainText('Esperando a que Bea lectora acepte · 5 fichas y 25 garbanzos cada uno');
  expect(mock.db.casino.mesas[0]).toMatchObject({ amigo: BEA, fichas: 5, garbanzos: 25, estado: 'invitada' });
  // Con Bea ya hay mesa hoy: solo queda Carlos para invitar
  await expect(casino.getByRole('button', { name: 'Bea lectora', exact: true })).toHaveCount(0);
  await expect(casino.getByRole('button', { name: 'Carlos', exact: true })).toBeVisible();
  await enviada.getByRole('button', { name: 'Retirar' }).click();
  await expect(casino.getByRole('button', { name: 'Bea lectora', exact: true })).toBeVisible();
});

test('sin amigos, la mesa para dos explica cómo se juega en pareja', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'una vez basta');
  const { hotel } = await toHotel(page, { fichas: 0 });
  await hotel.getByRole('button', { name: 'Directorio' }).click();
  await hotel.getByRole('button', { name: /Casino del sótano/ }).click();
  const casino = hotel.getByRole('region', { name: 'El casino del sótano' });
  await casino.getByRole('button', { name: /Con un amigo/ }).click();
  await expect(casino).toContainText('hace falta un amigo: alguien a quien sigues y que te sigue');
});

// 1.82: seguir jugando con garbanzos, los avisos dentro del casino y la lata
async function alCasino(hotel) {
  await hotel.getByRole('button', { name: 'Directorio' }).click();
  await hotel.getByRole('button', { name: /Casino del sótano/ }).click();
  return hotel.getByRole('region', { name: 'El casino del sótano' });
}

test('tras la mesa del día se sigue con una mesa de garbanzos, sin fichas en juego', async ({ page }, info) => {
  test.skip(!/chromium-(320x640|390x844|1440x900)$|webkit-390x844/.test(info.project.name), '320, 390 (Chromium y WebKit) y escritorio');
  const { hotel, mock } = await toHotel(page, {
    fichas: 40,
    semana: 10,
    garbanzos: 100,
    amigos: [BEA],
    mesas: [{ id: 'mesa-dia', dia: HOY(), anfitrion: true, amigo: BEA, estado: 'cerrada', fichas: 0, garbanzos: 0, crupier: [9, 8], apuesta: 'empate', suya: { tuyas: [1, 2], estado: 'esperando' } }],
    manos: [{ dia: HOY(), mano: 1, mesa: 'mesa-dia', tuyas: [3, 4], crupier: [9, 8], mazo: [], estado: 'ganada', fichas: 10 }],
  });
  const casino = await alCasino(hotel);
  await casino.getByRole('button', { name: /Con un amigo/ }).click();
  await casino.getByRole('button', { name: 'Bea lectora', exact: true }).click();
  await expect(casino.getByText('Mesa de garbanzos: no gasta manos ni da fichas. Hoy te quedan 6.')).toBeVisible();
  await expect(casino.getByRole('button', { name: '5 fichas' })).toHaveCount(0);
  await expect(casino.getByRole('button', { name: 'Elige cuántos garbanzos' })).toBeDisabled();
  await casino.getByRole('button', { name: '25 garbanzos' }).click();
  await shot(page, info, 'v182-mesa-garbanzos');
  await casino.getByRole('button', { name: 'Invitar a Bea lectora' }).click();
  await expect(casino.getByRole('listitem').filter({ hasText: 'Mesa de garbanzos con Bea lectora' })).toContainText('25 garbanzos cada uno');
  expect(mock.db.casino.mesas[0]).toMatchObject({ solo_garbanzos: true, garbanzos: 25, fichas: 0 });
});

test('una mesa de garbanzos se acepta sin manos del día y no da fichas', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'una vez basta');
  const manos = [1, 2, 3].map((mano) => ({ dia: HOY(), mano, tuyas: [3, 4], crupier: [9, 8], mazo: [], estado: 'perdida', fichas: 2 }));
  const { hotel, mock } = await toHotel(page, {
    fichas: 6,
    semana: 6,
    garbanzos: 100,
    garbanzosDia: HOY(),
    amigos: [BEA],
    manos,
    barajas: [[9, 8, 8, 7, 5, 6, 1, 2, 3, 4]],
    mesas: [{ id: 'mesa-g', dia: HOY(), anfitrion: false, amigo: BEA, estado: 'invitada', fichas: 0, garbanzos: 25, solo_garbanzos: true }],
  });
  const casino = await alCasino(hotel);
  await expect(casino.getByText('Bea lectora te invita a una mesa de garbanzos')).toBeVisible();
  await casino.getByRole('button', { name: 'Aceptar y repartir' }).click();
  await casino.getByRole('button', { name: 'Plantarse' }).click();
  await expect(casino.getByText(/Esperando a que Bea lectora juegue/)).toBeVisible();
  mock.db.casino.mesas[0].suya = { tuyas: [2, 3], estado: 'esperando' };
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(casino.getByText('¡Ganas tú!')).toBeVisible();
  await expect(casino.getByText('El bote es tuyo')).toBeVisible();
  expect(mock.db.casino.fichas).toBe(6);
  expect(mock.db.casino.garbanzos).toBe(125);
});

test('una invitación llega también estando en el casino sin ninguna mesa abierta', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'una vez basta');
  const { hotel, mock } = await toHotel(page, { fichas: 0, amigos: [BEA] });
  const casino = await alCasino(hotel);
  await expect(casino.getByRole('button', { name: 'Sentarse a la mesa' })).toBeVisible();
  mock.db.casino.mesas.push({ id: 'mesa-nueva', dia: HOY(), anfitrion: false, amigo: BEA, estado: 'invitada', fichas: 0, garbanzos: 0 });
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(casino.getByLabel('1 te espera')).toBeVisible();
  await expect(casino.locator('.cs3-aviso')).toContainText('Bea lectora te espera en la mesa para dos.');
});

test('la lata: plegada al pie de la caja, sus premios y el cambio con tope', async ({ page }, info) => {
  test.skip(!/chromium-(320x640|390x844|1440x900)$|webkit-390x844/.test(info.project.name), '320, 390 (Chromium y WebKit) y escritorio');
  const { hotel, mock } = await toHotel(page, { fichas: 0, garbanzos: 400, garbanzosDia: HOY(), tickets: 3 });
  const casino = await alCasino(hotel);
  await casino.getByRole('button', { name: 'La caja' }).first().click();
  const lata = casino.locator('details.gh-lata');
  await expect(lata.getByRole('list', { name: 'Premios de la lata' })).toBeHidden();
  await lata.locator('summary').click();
  await lata.scrollIntoViewIfNeeded();
  await shot(page, info, 'v182-lata');
  // Los tres premios de la lata están en reforma (9-11-2026)
  await expect(lata.getByRole('list', { name: 'Premios de la lata' }).getByText('En reforma')).toHaveCount(3);
  await expect(lata.getByRole('button', { name: '¿Cambias 5 tickets por 25 garbanzos?' })).toBeDisabled();
  for (const veces of [5, 10]) {
    await lata.getByRole('button', { name: '¿Cambias 50 garbanzos por 5 tickets?' }).click();
    await lata.getByRole('button', { name: 'Sí, cambiar' }).click();
    await expect(lata.getByText(`Esta semana, ${veces} de 10 tickets.`).first()).toBeVisible();
  }
  await expect(lata.getByRole('button', { name: '¿Cambias 50 garbanzos por 5 tickets?' })).toBeDisabled();
  expect(mock.db.casino).toMatchObject({ garbanzos: 300, tickets: 13 });
  // Con 13 tickets ya se puede volver
  await expect(lata.getByRole('button', { name: '¿Cambias 5 tickets por 25 garbanzos?' })).toBeEnabled();
});
