// 1.107 · El casino del sótano en 3D (bloque a de docs/qa/casino-3d.md), con Supabase simulado: se baja desde el
// Directorio del hotel y se llega al rellano, con toda la sala delante; los letreros de la mesa, la caja, la ruleta, las
// chisteras y la vitrina; tocar la mesa lleva andando hasta ella (el crupier habla) y su panel sigue debajo; la caja abre
// la caja; lo que aún no se juega lo dice. Capturas en qa-report/casino/; vídeo con CASINO_VIDEO=1.
import { expect, test } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './almacenHelpers';

const DIR = join('qa-report', 'casino');
async function shot(page, info, name) {
  mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: join(DIR, `${name}-${info.project.name}.png`) });
}
const settled = (page) => page.waitForFunction(() => window.__casino3d?.settled());

async function alCasino(page, { datos = { fichas: 30, semana: 30 }, reduced = true } = {}) {
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.casino = datos;
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Coger la limusina al Gran Hotel' }).click({ timeout: 15000 });
  const hotel = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' });
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible();
  await hotel.getByRole('button', { name: 'Directorio' }).click();
  await hotel.getByRole('button', { name: /Casino del sótano/ }).click();
  const casino = hotel.getByRole('region', { name: 'El casino del sótano' });
  await expect(casino).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
  await page.waitForFunction(() => window.__casino3d?.renders() > 0);
  await expect(casino.getByRole('img', { name: '30 fichas' })).toBeVisible();
  return { hotel, casino, mock };
}

/** 1.108 · Una mano en la mesa 3D: repartir (las cartas salen del sabot al paño), plantarse y el cartel; las fichas a tu lado. */
async function juegaLaMano(page, info, casino) {
  await casino.getByRole('button', { name: 'Repartir la mano 1 de 3' }).click();
  await expect(casino.getByRole('list', { name: 'Tus cartas: 17' })).toBeAttached();
  await expect.poll(() => page.evaluate(() => window.__casino3d.cartas())).toEqual(['c0', 'c1', 't0', 't1']);
  await settled(page);
  await expect(casino.locator('.cs3-total').last()).toContainText('Tú');
  await expect(casino.locator('.cs3-dice')).toContainText('¿Otra carta o te plantas?');
  await page.waitForTimeout(300);
  await shot(page, info, '02b-reparto');
  await casino.getByRole('button', { name: 'Plantarse' }).click();
  await expect(casino.locator('.cs3-cartel')).toContainText('¡Ganas la mano!');
  await expect(casino.getByRole('list', { name: 'Cartas del crupier: 25' })).toBeAttached();
  await settled(page);
  await page.waitForTimeout(300);
  await shot(page, info, '02c-ganada');
  await expect(casino.getByRole('button', { name: 'Repartir la mano 2 de 3' })).toBeVisible();
}

test('la sala en 3D: el rellano, los letreros, la mesa con su crupier, la caja y lo que llega pronto', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/.test(info.project.name), '360, 390 y 430 (y WebKit a 390) y escritorio');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const { casino } = await alCasino(page);
  const tag = (name) => casino.locator('.cs3-tag', { hasText: name });
  // Para ir a lo que no está a la vista: el plano de la sala
  const ir = async (name) => {
    await casino.getByRole('button', { name: 'Plano' }).click();
    await casino.getByRole('navigation', { name: 'Plano de la sala' }).getByRole('button', { name }).click();
    await settled(page);
  };

  // En el rellano: se ve la sala entera, con la mesa, la ruleta y las chisteras rotuladas (la caja y la vitrina, a los lados)
  const pose = await page.evaluate(() => window.__casino3d.pose());
  expect(pose.z).toBeGreaterThan(2);
  await page.waitForTimeout(300);
  await shot(page, info, '01-rellano');
  for (const n of ['Las 21 páginas', 'La ruleta', 'Las tres chisteras']) await expect(tag(n)).toBeVisible();
  // 1.109 y 1.110: la ruleta y las chisteras ya se juegan
  await expect(tag('La ruleta')).not.toContainText('pronto');
  await expect(tag('Las tres chisteras')).not.toContainText('pronto');
  // La sala ocupa casi toda la pantalla y el panel de juego sigue justo debajo
  const stage = await casino.locator('.cs3').boundingBox();
  expect(stage.height).toBeGreaterThan(360);

  // La mesa: se baja la escalera andando, uno se sienta y el crupier habla (1.108: se juega en el propio paño)
  await tag('Las 21 páginas').click();
  await page.waitForFunction(() => window.__casino3d.sentado() && window.__casino3d.settled());
  const enMesa = await page.evaluate(() => window.__casino3d.pose());
  expect(enMesa.z).toBe(0);
  expect(Math.hypot(enMesa.x - 4.7, enMesa.y - 7.5)).toBeLessThan(0.05);
  await expect(casino.locator('.cs3-dice')).toBeVisible();
  await expect(casino.locator('.cs3-dice')).toContainText('Repartimos');
  await page.waitForTimeout(300);
  await shot(page, info, '02-mesa');
  await juegaLaMano(page, info, casino);
  await casino.getByRole('button', { name: 'Levantarse' }).click();
  await settled(page);

  // La ruleta (1.109): delante de la rueda; sin la migración de la ruleta, lo dice y no se gira
  await ir(/La ruleta/);
  await page.waitForFunction(() => window.__casino3d.enRuleta() && window.__casino3d.settled());
  await expect(casino.locator('.cs3-rul .cs3-acts')).toContainText('La ruleta aún no gira');
  await expect(casino.getByRole('button', { name: 'Girar la ruleta' })).toHaveCount(0);
  await page.waitForTimeout(300);
  await shot(page, info, '03-ruleta');
  await casino.getByRole('button', { name: 'Volver a la sala' }).click();
  await settled(page);

  // Las chisteras (1.110): delante de la mesa; sin su migración, lo dice y no se juega
  await ir(/Las tres chisteras/);
  await page.waitForFunction(() => window.__casino3d.enChisteras() && window.__casino3d.settled());
  await expect(casino.locator('.cs3-chis .cs3-acts')).toContainText('falta prepararla');
  await page.waitForTimeout(300);
  await shot(page, info, '04-chisteras');
  await casino.getByRole('button', { name: 'Volver a la sala' }).click();
  await settled(page);
  await ir(/La vitrina/);
  await page.waitForFunction(() => window.__casino3d.enVitrina() && window.__casino3d.settled());
  await page.waitForTimeout(300);
  await shot(page, info, '05-vitrina');
  await casino.getByRole('button', { name: 'Volver a la sala' }).click();
  await settled(page);

  // La caja: va hasta la ventanilla y abre la caja
  await ir(/La caja/);
  await expect(casino.locator('.gh-21__modes').getByRole('button', { name: 'La caja' })).toHaveAttribute('aria-pressed', 'true');
  await expect(casino.getByRole('button', { name: 'Ver la caja' })).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, info, '06-caja');

  // Desde el centro de la sala, mirando a la escalera
  await page.evaluate(() => window.__casino3d.place(8, 9, 0));
  await page.waitForTimeout(300);
  await shot(page, info, '07-hacia-la-escalera');
  // Tocar el suelo lleva hasta allí
  const n0 = await page.evaluate(() => window.__casino3d.renders());
  await page.evaluate(() => window.__casino3d.place(8, 13, Math.PI));
  // Se toca lo que se ve: hay que esperar al fotograma de la posición nueva
  await page.waitForFunction((n) => window.__casino3d.renders() > n, n0);
  const p = await page.evaluate(() => {
    const c = window.__casino3d.canvas.getBoundingClientRect();
    return { x: c.left + c.width / 2, y: c.top + c.height * 0.62 };
  });
  expect((await page.evaluate((q) => window.__casino3d.sueloEn(q.x, q.y), p)).y).toBeLessThan(10);
  await page.mouse.click(p.x, p.y);
  await settled(page);
  const tras = await page.evaluate(() => window.__casino3d.pose());
  expect(tras.y).toBeLessThan(13);
  expect(errors).toEqual([]);
});

// 1.108 · La mesa para dos, también en el paño: Bea, sentada en el taburete de al lado con su personaje y sus cartas boca
// abajo; tus cartas y las del crupier delante
const BEA = { uid: '22222222-2222-4222-8222-222222222222', alias: 'Bea lectora', avatar_id: 'lectora-cafe' };
test('la mesa para dos en el paño: tu amigo sentado al lado', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/.test(info.project.name), '360, 390 y 430 (y WebKit a 390) y escritorio');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const d = new Date();
  const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const { casino, mock } = await alCasino(page, {
    datos: {
      fichas: 30,
      semana: 30,
      garbanzos: 100,
      amigos: [BEA],
      mesas: [{ id: 'mesa-bea', dia, anfitrion: false, amigo: BEA, estado: 'invitada', fichas: 10, garbanzos: 50 }],
      barajas: [[9, 9, 5, 7, 22, 6, 4, 3]],
    },
  });
  mock.db.sala_personajes = [{ user_id: BEA.uid, personaje: { piel: 3, pelo: 'melena', colorPelo: 3, jersey: 4, pantalon: 2, gafas: true, complemento: 'ninguno' }, companero: null }];
  await casino.getByRole('button', { name: /Con un amigo/ }).click();
  await casino.getByRole('listitem').filter({ hasText: 'Bea lectora te invita a una mesa' }).getByRole('button', { name: 'Aceptar y repartir' }).click();
  await expect(casino.getByRole('list', { name: 'Tus cartas: 18' })).toBeVisible();
  // A la mesa: se sienta y en el paño están las dos del crupier, las tuyas y las de Bea (boca abajo)
  await casino.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await casino.getByRole('button', { name: 'Plano' }).click();
  await casino.getByRole('navigation', { name: 'Plano de la sala' }).getByRole('button', { name: /Las 21 páginas/ }).click();
  await page.waitForFunction(() => window.__casino3d.sentado() && window.__casino3d.settled());
  await expect.poll(() => page.evaluate(() => window.__casino3d.cartas().sort())).toEqual(['c0', 'c1', 's0', 's1', 't0', 't1']);
  await expect(casino.locator('.cs3-sit__nota')).toContainText('Mesa para dos con Bea lectora');
  await page.waitForTimeout(400);
  await shot(page, info, '02d-pareja');
  // «Jugar la mano» baja al panel de la mesa para dos
  await casino.getByRole('button', { name: 'Jugar la mano' }).click();
  await expect(casino.getByRole('button', { name: 'Plantarse' })).toBeInViewport();
  expect(errors).toEqual([]);
});

test('vídeo: bajar al casino, la mesa, la ruleta, las chisteras, la vitrina y la caja', async ({ browser }, info) => {
  test.skip(!process.env.CASINO_VIDEO || !/^(chromium|webkit)-390x844$/.test(info.project.name), 'solo con CASINO_VIDEO=1');
  test.setTimeout(180000);
  const bruto = join(DIR, 'bruto');
  mkdirSync(bruto, { recursive: true });
  const context = await browser.newContext({ ...info.project.use, recordVideo: { dir: bruto, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const { casino } = await alCasino(page, { reduced: false });
  const pausa = (ms) => page.waitForTimeout(ms);
  const tag = (name) => casino.locator('.cs3-tag', { hasText: name });
  await pausa(1800);
  // Mirar la sala desde el rellano, arrastrando
  const c = await page.evaluate(() => {
    const r = window.__casino3d.canvas.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  for (const dx of [-120, 120]) {
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    for (let i = 1; i <= 12; i += 1) {
      await page.mouse.move(c.x + (dx * i) / 12, c.y);
      await pausa(40);
    }
    await page.mouse.up();
    await pausa(700);
  }
  for (const [n, espera] of [
    ['Las 21 páginas', 2200],
    ['La ruleta', 2400],
    ['Las tres chisteras', 2400],
    ['La vitrina', 2400],
    ['La caja', 2400],
  ]) {
    if (n === 'Las 21 páginas') await tag(n).click();
    else {
      await casino.getByRole('button', { name: 'Plano' }).click();
      await pausa(500);
      await casino.getByRole('navigation', { name: 'Plano de la sala' }).getByRole('button', { name: new RegExp(n) }).click();
    }
    await settled(page);
    await pausa(espera);
    if (['La ruleta', 'Las tres chisteras', 'La vitrina'].includes(n)) {
      await casino.getByRole('button', { name: 'Volver a la sala' }).click();
      await settled(page);
      await pausa(800);
    }
    if (n === 'Las 21 páginas') {
      // 1.108 · Sentado: una mano entera en el paño (repartir, pedir hasta pasarse o plantarse) y levantarse
      await casino.getByRole('button', { name: 'Repartir la mano 1 de 3' }).click();
      await settled(page);
      await pausa(2200);
      await casino.getByRole('button', { name: 'Plantarse' }).click();
      await settled(page);
      await pausa(2600);
      await casino.getByRole('button', { name: 'Levantarse' }).click();
      await settled(page);
      await pausa(1000);
    }
  }
  await shot(page, info, '08-video-final');
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join(DIR, `sala-${info.project.name}.webm`));
});
