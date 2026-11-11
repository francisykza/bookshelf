// 1.110 · «Las tres chisteras» (bloque d de docs/qa/casino-3d.md), con Supabase simulado: delante de la mesa, el conejo se
// mete bajo una chistera, las chisteras se cruzan y se elige tocando la chistera o con los tres botones; el servidor
// comprueba y, si no estaba, se levanta la de verdad. Tres rondas, el premio según las aciertas y una partida al día.
// Capturas en qa-report/casino/; vídeo con CASINO_VIDEO=1.
import { expect, test } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './almacenHelpers';
import { conejoTras } from '../src/features/edificio/hotel/chisteras.js';

const DIR = join('qa-report', 'casino');
const TAMAÑOS = /chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/;
async function shot(page, info, name) {
  mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: join(DIR, `${name}-${info.project.name}.png`) });
}
const settled = (page) => page.waitForFunction(() => window.__casino3d?.settled());
const HOY = new Date().toLocaleDateString('sv-SE');
// Tres rondas fijas: el conejo acaba a la izquierda, en medio y a la derecha
const BARAJAS = [
  [0, [0, 1, 2]],
  [1, [1, 0, 2, 1, 0]],
  [2, [2, 2, 1, 0, 1, 2, 0]],
];

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
async function aLasChisteras(page, casino) {
  await casino.getByRole('button', { name: 'Plano' }).click();
  await casino.getByRole('navigation', { name: 'Plano de la sala' }).getByRole('button', { name: /Las tres chisteras/ }).click();
  await page.waitForFunction(() => window.__casino3d.enChisteras() && window.__casino3d.settled());
}
const elige = (casino) => casino.getByRole('group', { name: '¿Dónde está el conejo?' });
/** Tocar en la pantalla la chistera del sitio `k`. */
async function tocaChistera(page, k) {
  const p = await page.evaluate((n) => window.__casino3d.chistera(n), k);
  expect(p.front).toBe(true);
  await page.mouse.click(p.x, p.y);
}

test('las chisteras: tres rondas, se elige tocando la chistera o con los botones, y el premio según las aciertas', async ({ page }, info) => {
  test.skip(!TAMAÑOS.test(info.project.name), '360, 390 y 430 (y WebKit a 390) y escritorio');
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const { casino, mock } = await alCasino(page, { datos: { fichas: 30, semana: 30, chisteras: { barajas: BARAJAS.map((b) => [...b]) } }, reduced: false });
  await expect(casino.locator('.cs3-tag', { hasText: 'Las tres chisteras' })).not.toContainText('pronto');
  await aLasChisteras(page, casino);

  // Delante de la mesa: las tres chisteras a la vista, en fila de izquierda a derecha; las reglas y las fichas, a la vista
  const c = await Promise.all([0, 1, 2].map((k) => page.evaluate((n) => window.__casino3d.chistera(n), k)));
  for (const x of c) expect(x.front).toBe(true);
  expect(c[0].x).toBeLessThan(c[1].x);
  expect(c[1].x).toBeLessThan(c[2].x);
  await expect(casino.locator('.cs3-chis__reglas')).toContainText('1, 3, 6, 10 fichas');
  await expect(casino.getByRole('list', { name: 'Rondas de hoy' }).getByRole('listitem')).toHaveCount(3);
  await expect(casino.getByRole('button', { name: 'Plano' })).toHaveCount(0);
  await page.waitForTimeout(300);
  await shot(page, info, '17-chisteras');

  // Ronda 1: el conejo salta bajo la chistera de la izquierda y las chisteras se cruzan; mientras, no se puede elegir
  await casino.getByRole('button', { name: 'Empezar' }).click();
  await expect(casino.getByRole('button', { name: 'Volver a la sala' })).toBeDisabled();
  await page.waitForFunction(() => window.__casino3d.chistera(0).jugando);
  expect(await page.evaluate(() => window.__casino3d.chistera(0).eligiendo)).toBe(false);
  await expect(elige(casino)).toBeVisible({ timeout: 15000 });
  await settled(page);
  expect(await page.evaluate(() => window.__casino3d.chistera(0).eligiendo)).toBe(true);
  expect(await page.evaluate(() => window.__casino3d.chistera(0).conejo)).toBe(false);
  await shot(page, info, '18-chisteras-elige');
  // Se toca la chistera de la izquierda, donde acaba: ¡ahí estaba!
  expect(conejoTras(...BARAJAS[0])).toBe(0);
  await tocaChistera(page, 0);
  await expect(casino.locator('.cs3-chis__cartel')).toContainText('¡Ahí estaba!');
  await settled(page);
  expect(await page.evaluate(() => window.__casino3d.chistera(0).alzada)).toBe(1);
  expect(await page.evaluate(() => window.__casino3d.chistera(0).conejo)).toBe(true);
  await expect(casino.getByRole('list', { name: 'Rondas de hoy' }).getByRole('listitem').nth(0)).toHaveClass(/is-bien/);
  await shot(page, info, '19-chisteras-acierto');

  // Ronda 2: se falla (a la derecha); se levanta la elegida y luego la del medio, donde estaba, y se dice tal cual
  await casino.getByRole('button', { name: 'Ronda 2 de 3' }).click();
  await expect(elige(casino)).toBeVisible({ timeout: 15000 });
  expect(conejoTras(...BARAJAS[1])).toBe(1);
  await elige(casino).getByRole('button', { name: 'Derecha' }).click();
  await expect(casino.locator('.cs3-chis__cartel')).toContainText('Esta vez, no');
  await expect(casino.locator('.cs3-chis__cartel')).toContainText('Estaba en la del medio.');
  await settled(page);
  expect(await page.evaluate(() => [window.__casino3d.chistera(2).alzada, window.__casino3d.chistera(1).alzada, window.__casino3d.chistera(0).alzada])).toEqual([1, 1, 0]);
  await expect(casino.getByRole('list', { name: 'Rondas de hoy' }).getByRole('listitem').nth(1)).toHaveClass(/is-mal/);
  await shot(page, info, '20-chisteras-fallo');

  // Ronda 3: la última, acertada: 2 de 3, 6 fichas (dentro del tope); hoy ya no se juega más
  await casino.getByRole('button', { name: 'Ronda 3 de 3' }).click();
  await expect(elige(casino)).toBeVisible({ timeout: 15000 });
  await tocaChistera(page, conejoTras(...BARAJAS[2]));
  await expect(casino.locator('.cs3-chis__cartel')).toContainText('2 de 3');
  await expect(casino.locator('.cs3-chis__cartel').getByRole('img', { name: 'más 6 fichas' })).toBeVisible();
  await expect(casino.locator('.cs3-chis .cs3-acts')).toContainText('Hoy: 2 de 3, +6 fichas. Mañana, más chisteras.');
  await expect(casino.getByRole('button', { name: /Ronda|Empezar/ })).toHaveCount(0);
  expect(mock.db.casino.fichas).toBe(36);
  expect(mock.db.casino.semana).toBe(36);
  await expect(casino.locator('.gh-21__week')).toContainText('Semana 36/150');
  await settled(page);
  await shot(page, info, '21-chisteras-final');

  // Al volver a la sala, la mesa se recoge: las chisteras abajo y el conejo en su sitio
  await casino.getByRole('button', { name: 'Volver a la sala' }).click();
  await settled(page);
  expect(await page.evaluate(() => [0, 1, 2].map((k) => window.__casino3d.chistera(k).alzada))).toEqual([0, 0, 0]);
  expect(errors).toEqual([]);
});

test('las chisteras con movimiento reducido: los cambios, uno a uno y dichos en palabras', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'una vez basta');
  const { casino } = await alCasino(page, { datos: { fichas: 0, semana: 0, chisteras: { barajas: [[1, [0, 2, 1]]] } } });
  await aLasChisteras(page, casino);
  await casino.getByRole('button', { name: 'Empezar' }).click();
  // Cada cambio se dice para quien no ve la mesa
  await expect(casino.locator('.cs3-chis [role="status"]')).toHaveText(/Cambian la de la izquierda y la del medio\./, { timeout: 8000 });
  await expect(elige(casino)).toBeVisible({ timeout: 15000 });
  // Los botones también eligen; se dice dónde estaba
  await elige(casino).getByRole('button', { name: 'Izquierda' }).click();
  await expect(casino.locator('.cs3-chis [role="status"]')).toHaveText(`El conejo estaba en ${['la de la izquierda', 'la del medio', 'la de la derecha'][conejoTras(1, [0, 2, 1])]}.`);
});

test('las chisteras: hoy ya jugadas, se dice cómo fue y no se juega otra', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'una vez basta');
  const hecha = { estado: 'hecha', ronda: 3, aciertos: 3, fichas: 10, rondas: [0, 1, 2].map((k) => ({ elegida: k, conejo: k, acierto: true })) };
  const { casino } = await alCasino(page, { datos: { fichas: 10, semana: 10, chisteras: { perfectas: 1, partidas: { [HOY]: hecha } } } });
  await aLasChisteras(page, casino);
  await expect(casino.locator('.cs3-chis .cs3-acts')).toContainText('Hoy: 3 de 3, +10 fichas. Mañana, más chisteras. Partidas perfectas: 1.');
  await expect(casino.getByRole('button', { name: /Ronda|Empezar/ })).toHaveCount(0);
  await expect(casino.getByRole('list', { name: 'Rondas de hoy' }).locator('li.is-bien')).toHaveCount(3);
});

test('vídeo: las tres chisteras, de verdad', async ({ browser }, info) => {
  test.skip(!process.env.CASINO_VIDEO || !/^(chromium|webkit)-390x844$/.test(info.project.name), 'solo con CASINO_VIDEO=1');
  test.setTimeout(120000);
  const bruto = join(DIR, 'bruto');
  mkdirSync(bruto, { recursive: true });
  const context = await browser.newContext({ ...info.project.use, recordVideo: { dir: bruto, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const { casino } = await alCasino(page, { datos: { fichas: 30, semana: 30, chisteras: { barajas: BARAJAS.map((b) => [...b]) } }, reduced: false });
  const pausa = (ms) => page.waitForTimeout(ms);
  await pausa(1200);
  await aLasChisteras(page, casino);
  await pausa(1500);
  await casino.getByRole('button', { name: 'Empezar' }).click();
  await expect(elige(casino)).toBeVisible({ timeout: 15000 });
  await pausa(900);
  await tocaChistera(page, 0);
  await expect(casino.locator('.cs3-chis__cartel')).toContainText('¡Ahí estaba!');
  await pausa(2200);
  await casino.getByRole('button', { name: 'Ronda 2 de 3' }).click();
  await expect(elige(casino)).toBeVisible({ timeout: 15000 });
  await pausa(900);
  await tocaChistera(page, 2);
  await expect(casino.locator('.cs3-chis__cartel')).toContainText('Esta vez, no');
  await pausa(2400);
  await casino.getByRole('button', { name: 'Ronda 3 de 3' }).click();
  await expect(elige(casino)).toBeVisible({ timeout: 15000 });
  await pausa(900);
  await tocaChistera(page, 2);
  await expect(casino.locator('.cs3-chis__cartel')).toContainText('2 de 3');
  await pausa(3000);
  await casino.getByRole('button', { name: 'Volver a la sala' }).click();
  await settled(page);
  await pausa(1200);
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join(DIR, `chisteras-${info.project.name}.webm`));
});
