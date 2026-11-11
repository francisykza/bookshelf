// 1.112 · Los seis premios nuevos del casino (bloque e de docs/qa/casino-3d.md, §4), con Supabase simulado: los sellos de
// las chisteras (uno por partida perfecta) y sus premios, que se cambian delante de la mesa; el acabado, en un mueble tuyo; y
// la vitrina con el reloj y la alfombra de la caja y el armario «Chisteras y copas». Capturas en qa-report/casino/; vídeo
// con CASINO_VIDEO=1.
import { expect, test } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { ANA, alAlmacen, mockAlmacen } from './almacenHelpers';

const DIR = join('qa-report', 'casino');
const TAMAÑOS = /chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/;
async function shot(page, info, name) {
  mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: join(DIR, `${name}-${info.project.name}.png`) });
}
const settled = (page) => page.waitForFunction(() => window.__casino3d?.settled());
const HOY = new Date().toLocaleDateString('sv-SE');
const NUEVOS = ['alfombra-rombos', 'complemento:reloj-bolsillo', 'complemento:chistera-mago', 'complemento:varita', 'baul-mago', 'acabado:polvo-estrellas'];

async function alCasino(page, { datos, reduced = true }) {
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.casino = datos;
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
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
  return { casino, mock };
}
async function ir(page, casino, nombre, listo) {
  await casino.getByRole('button', { name: 'Plano' }).click();
  await casino.getByRole('navigation', { name: 'Plano de la sala' }).getByRole('button', { name: nombre }).click();
  await page.waitForFunction(listo);
}
const premio = (page, id) => page.evaluate((x) => window.__casino3d.premio(x), id);
const armarios = (casino) => casino.getByRole('group', { name: 'Armarios de la vitrina' });
/** Hoy ya jugadas (perfecta), siete perfectas en total y la chistera de mago ya cambiada: quedan 5 sellos. */
const chisteras = () => ({
  premios: true,
  perfectas: 7,
  canjes: ['complemento:chistera-mago'],
  acabables: ['sillon', 'estanteria'],
  partidas: { [HOY]: { estado: 'hecha', ronda: 3, rondas: [{ acierto: true, elegida: 0, conejo: 0 }, { acierto: true, elegida: 1, conejo: 1 }, { acierto: true, elegida: 2, conejo: 2 }], aciertos: 3, fichas: 10 } },
});

test('los sellos de las chisteras: se ven sus premios, se cambia la varita y lo que falta lo dice', async ({ page }, info) => {
  test.skip(!TAMAÑOS.test(info.project.name), '360, 390 y 430 (y WebKit a 390) y escritorio');
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const { casino } = await alCasino(page, { datos: { fichas: 30, semana: 30, chisteras: chisteras(), vitrina: { tienes: ['complemento:chistera-mago'], hitos: [] } } });
  await ir(page, casino, /Las tres chisteras/, () => window.__casino3d.enChisteras() && window.__casino3d.settled());
  await casino.getByRole('button', { name: 'Premios · 5 sellos' }).click();
  const hoja = casino.getByRole('region', { name: 'Premios de las chisteras' });
  await expect(hoja).toContainText('Tus sellos: 5');
  await expect(hoja.locator('li', { hasText: 'Chistera de mago' })).toContainText('Es tuyo');
  await expect(hoja.getByRole('button', { name: 'Baúl de mago: te faltan 1 sellos' })).toBeDisabled();
  await expect(hoja.getByRole('button', { name: 'Polvo de estrellas: te faltan 5 sellos' })).toBeDisabled();
  await shot(page, info, '27-chisteras-sellos');
  await hoja.getByRole('button', { name: 'Cambiar 4 sellos por Varita de mago' }).click();
  await expect(hoja).toContainText('¡Varita de mago, tuyo! Ya está en tu armario.');
  await expect(hoja).toContainText('Tus sellos: 1');
  await expect(hoja.locator('li', { hasText: 'Varita de mago' })).toContainText('Es tuyo');
  await shot(page, info, '28-chisteras-varita');
  await hoja.getByRole('button', { name: 'Cerrar' }).click();
  await expect(casino.getByRole('button', { name: 'Premios · 1 sello' })).toBeVisible();
  // En la vitrina ya está la varita, en el armario de las chisteras
  await casino.getByRole('button', { name: 'Volver a la sala' }).click();
  await settled(page);
  await ir(page, casino, /La vitrina/, () => window.__casino3d.enVitrina() && window.__casino3d.settled());
  await armarios(casino).getByRole('button', { name: 'Chisteras y copas' }).click();
  await settled(page);
  await expect.poll(async () => (await premio(page, 'complemento:varita')).visto).toBe(true);
  expect((await premio(page, 'baul-mago')).visto).toBe(false);
  expect(errors).toEqual([]);
});

test('el acabado de las chisteras: se elige el mueble y se pone', async ({ page }, info) => {
  test.skip(!/chromium-390x844$|webkit-390x844$/.test(info.project.name), 'a 390');
  const datos = chisteras();
  datos.perfectas = 22;
  datos.canjes = ['complemento:chistera-mago', 'complemento:varita', 'baul-mago'];
  const { casino } = await alCasino(page, { datos: { fichas: 30, semana: 30, chisteras: datos } });
  await ir(page, casino, /Las tres chisteras/, () => window.__casino3d.enChisteras() && window.__casino3d.settled());
  await casino.getByRole('button', { name: 'Premios · 10 sellos' }).click();
  const hoja = casino.getByRole('region', { name: 'Premios de las chisteras' });
  const boton = hoja.getByRole('button', { name: 'Cambiar 10 sellos por Polvo de estrellas' });
  await expect(boton).toBeDisabled();
  await hoja.getByLabel('Mueble para el acabado').selectOption('estanteria');
  await boton.click();
  await expect(hoja).toContainText('Hecho: tu Estantería ya tiene «Polvo de estrellas».');
  await expect(hoja).toContainText('Tus sellos: 0');
  await shot(page, info, '29-chisteras-acabado');
});

test('la vitrina con los premios nuevos: el reloj y la alfombra de la caja, y el armario de las chisteras', async ({ page }, info) => {
  test.skip(!TAMAÑOS.test(info.project.name), '360, 390 y 430 (y WebKit a 390) y escritorio');
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const vitrina = { tienes: [...NUEVOS, 'gramola', 'neon-veintiuna', 'jersey:15'], hitos: ['chisteras-primera', 'chisteras-perfecta', 'ruleta-primera'] };
  const { casino } = await alCasino(page, { datos: { fichas: 200, semana: 30, garbanzos: 200, vitrina } });
  await ir(page, casino, /La vitrina/, () => window.__casino3d.enVitrina() && window.__casino3d.settled());
  await expect(casino.locator('.cs3-vit__cuenta')).toContainText('12 de 35');
  for (const id of ['alfombra-rombos', 'complemento:reloj-bolsillo']) {
    const p = await premio(page, id);
    expect(p.visto).toBe(true);
    expect(p.front).toBe(true);
  }
  const r = await premio(page, 'complemento:reloj-bolsillo');
  await page.mouse.click(r.x, r.y);
  const ficha = casino.locator('.cs3-vit__ficha');
  await expect(ficha).toContainText('Reloj de bolsillo dorado');
  await expect(ficha).toContainText('Es tuyo');
  await page.waitForTimeout(300);
  await shot(page, info, '30-vitrina-caja-nuevos');
  await ficha.getByRole('button', { name: 'Cerrar' }).click();
  await armarios(casino).getByRole('button', { name: 'Chisteras y copas' }).click();
  await settled(page);
  for (const id of ['complemento:chistera-mago', 'complemento:varita', 'baul-mago', 'acabado:polvo-estrellas', 'chisteras-perfecta']) expect((await premio(page, id)).visto).toBe(true);
  expect((await premio(page, 'chisteras-diez')).visto).toBe(false);
  const b = await premio(page, 'acabado:polvo-estrellas');
  expect(b.front).toBe(true);
  await page.mouse.click(b.x, b.y);
  await expect(ficha).toContainText('Polvo de estrellas');
  await page.waitForTimeout(300);
  await shot(page, info, '31-vitrina-chisteras');
  // Y lo que falta, con cómo se gana
  await ficha.getByRole('button', { name: 'Cerrar' }).click();
  await casino.getByRole('navigation', { name: /Premios de chisteras y copas/i }).getByRole('button', { name: /Diez partidas/ }).evaluate((x) => x.click());
  await expect(ficha).toContainText('Aún no.');
  expect(errors).toEqual([]);
});

test('la ropa nueva, puesta: la chistera de mago, la varita en la mano y el reloj en el chaleco', async ({ page }, info) => {
  test.skip(!/chromium-390x844$|webkit-390x844$/.test(info.project.name), 'a 390');
  const mock = mockAlmacen();
  mock.db.personajes = true;
  mock.db.pisos.push({ user_id: ANA.id, layout: { v: 1, pared: 0, suelo: 'tablas', items: [] }, personaje: { piel: 2, pelo: 'melena', colorPelo: 1, jersey: 15, pantalon: 1, gafas: false, complemento: 'ninguno' } });
  mock.db.diarias = { [ANA.id]: { prendas: ['jersey:15', 'complemento:reloj-bolsillo', 'complemento:chistera-mago', 'complemento:varita'], dias: {} } };
  const { alm } = await alAlmacen(page, mock);
  await page.evaluate(() => window.__almacen3d.place(14.3, 3.6, Math.PI, -4.6));
  await page.waitForTimeout(300);
  await alm.locator('.alm-tag--sitio', { hasText: 'Probador' }).click();
  const card = alm.locator('.alm-card--probador');
  await expect(card.locator('.alm-percha').first()).toBeVisible({ timeout: 15000 });
  await card.getByRole('tab', { name: /Extras|Complementos/ }).click();
  for (const [p, n] of [['complemento:chistera-mago', '32-probador-chistera'], ['complemento:varita', '33-probador-varita'], ['complemento:reloj-bolsillo', '34-probador-reloj']]) {
    await card.locator(`[data-prenda="${p}"]`).click();
    await page.waitForFunction(() => window.__almacen3d.settled());
    await page.waitForTimeout(400);
    await shot(page, info, n);
  }
});

test('vídeo: los sellos y la vitrina nueva', async ({ browser }, info) => {
  test.skip(!process.env.CASINO_VIDEO || !/^(chromium|webkit)-390x844$/.test(info.project.name), 'solo con CASINO_VIDEO=1');
  test.setTimeout(120000);
  const bruto = join(DIR, 'bruto');
  mkdirSync(bruto, { recursive: true });
  const context = await browser.newContext({ ...info.project.use, recordVideo: { dir: bruto, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const vitrina = { tienes: ['complemento:chistera-mago', 'alfombra-rombos', 'complemento:reloj-bolsillo', 'gramola'], hitos: ['chisteras-primera', 'chisteras-perfecta'] };
  const { casino } = await alCasino(page, { datos: { fichas: 200, semana: 30, chisteras: chisteras(), vitrina }, reduced: false });
  const pausa = (ms) => page.waitForTimeout(ms);
  await pausa(1000);
  await ir(page, casino, /Las tres chisteras/, () => window.__casino3d.enChisteras() && window.__casino3d.settled());
  await pausa(1200);
  await casino.getByRole('button', { name: 'Premios · 5 sellos' }).click();
  await pausa(1800);
  await casino.getByRole('button', { name: 'Cambiar 4 sellos por Varita de mago' }).click();
  await pausa(2000);
  await casino.getByRole('button', { name: 'Cerrar' }).click();
  await casino.getByRole('button', { name: 'Volver a la sala' }).click();
  await settled(page);
  await ir(page, casino, /La vitrina/, () => window.__casino3d.enVitrina() && window.__casino3d.settled());
  await pausa(1200);
  for (const id of ['alfombra-rombos', 'complemento:reloj-bolsillo']) {
    const p = await premio(page, id);
    await page.mouse.click(p.x, p.y);
    await pausa(2200);
  }
  await armarios(casino).getByRole('button', { name: 'Chisteras y copas' }).click();
  await pausa(1500);
  for (const id of ['complemento:chistera-mago', 'complemento:varita', 'baul-mago']) {
    const p = await premio(page, id);
    await page.mouse.click(p.x, p.y);
    await pausa(2000);
  }
  await casino.getByRole('button', { name: 'Volver a la sala' }).click();
  await settled(page);
  await pausa(1000);
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join(DIR, `premios-${info.project.name}.webm`));
});
