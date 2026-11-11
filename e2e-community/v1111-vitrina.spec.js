// 1.111 · La vitrina de premios del casino (bloque e de docs/qa/casino-3d.md), con Supabase simulado: delante de sus tres
// armarios, lo ganado expuesto en 3D y lo que falta bajo su paño; tocar un premio lo enseña de cerca (gira) con su ficha;
// las copas de hitos; y la vitrina de un amigo, solo para mirar. Capturas en qa-report/casino/; vídeo con CASINO_VIDEO=1.
import { expect, test } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './almacenHelpers';

const DIR = join('qa-report', 'casino');
const TAMAÑOS = /chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/;
async function shot(page, info, name) {
  mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: join(DIR, `${name}-${info.project.name}.png`) });
}
const settled = (page) => page.waitForFunction(() => window.__casino3d?.settled());
const BEA = { uid: '22222222-2222-4222-8222-222222222222', alias: 'Bea lectora', avatar_id: 'lectora-cafe' };
const MIA = {
  tienes: ['gramola', 'jersey:15', 'complemento:fedora', 'conejo-chistera', 'mapache-crupier', 'reloj-deco', 'jersey:22', 'tarro-garbanzos', 'lampara-flecos'],
  hitos: ['21-primera', '21-veintiuna', '21-diez', 'ruleta-primera', 'ruleta-dorada', 'ruleta-premio', 'chisteras-primera', 'chisteras-perfecta'],
  amigos: { [BEA.uid]: { alias: BEA.alias, tienes: ['neon-veintiuna', 'mesa-tapete', 'complemento:visera'], hitos: ['21-primera'], fichas: 60, garbanzos: 140 } },
};

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
async function aLaVitrina(page, casino) {
  await casino.getByRole('button', { name: 'Plano' }).click();
  await casino.getByRole('navigation', { name: 'Plano de la sala' }).getByRole('button', { name: /La vitrina/ }).click();
  await page.waitForFunction(() => window.__casino3d.enVitrina() && window.__casino3d.settled());
}
const premio = (page, id) => page.evaluate((x) => window.__casino3d.premio(x), id);
const armarios = (casino) => casino.getByRole('group', { name: 'Armarios de la vitrina' });

test('la vitrina: lo ganado expuesto, lo que falta tapado, de cerca con su ficha, las copas y la de un amigo', async ({ page }, info) => {
  test.skip(!TAMAÑOS.test(info.project.name), '360, 390 y 430 (y WebKit a 390) y escritorio');
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const { casino } = await alCasino(page, { datos: { fichas: 420, semana: 30, garbanzos: 380, amigos: [BEA], vitrina: MIA } });
  await expect(casino.locator('.cs3-tag', { hasText: 'La vitrina' })).not.toContainText('pronto');
  await aLaVitrina(page, casino);

  // El armario de la caja: lo que tienes, expuesto; lo demás, tapado; y la cuenta de todo
  await expect(casino.locator('.cs3-vit__cuenta')).toContainText('Tu vitrina');
  // 11 de la caja + 3 de la lata + 5 de la ruleta + 4 de las chisteras (1.112) + 12 copas = 35; tienes 9 + 8
  await expect(casino.locator('.cs3-vit__cuenta')).toContainText('17 de 35');
  await expect(armarios(casino).getByRole('button', { name: 'La caja' })).toHaveAttribute('aria-pressed', 'true');
  for (const id of ['gramola', 'jersey:15', 'complemento:fedora', 'conejo-chistera']) expect((await premio(page, id)).visto).toBe(true);
  for (const id of ['neon-veintiuna', 'mesa-tapete', 'complemento:visera', 'pantalon:9', 'jersey:16']) expect((await premio(page, id)).visto).toBe(false);
  for (const id of ['gramola', 'neon-veintiuna', 'conejo-chistera']) expect((await premio(page, id)).front).toBe(true);
  await page.waitForTimeout(300);
  await shot(page, info, '22-vitrina-caja');

  // Tocar un premio tuyo: gira en su balda y su ficha dice que es tuyo
  const g = await premio(page, 'gramola');
  await page.mouse.click(g.x, g.y);
  const ficha = casino.locator('.cs3-vit__ficha');
  await expect(ficha).toContainText('Gramola');
  await expect(ficha).toContainText('Es tuyo');
  if (!/reduced/.test(info.project.name)) await page.waitForFunction(() => window.__casino3d.premio('gramola').cerca);
  // Uno tapado: cómo se gana
  const n = await premio(page, 'neon-veintiuna');
  await page.mouse.click(n.x, n.y);
  await expect(ficha).toContainText('Rótulo de neón «21»');
  await expect(ficha).toContainText('Aún no. Se cambia por 250 fichas en la caja.');
  await shot(page, info, '23-vitrina-tapado');
  await ficha.getByRole('button', { name: 'Cerrar' }).click();

  // La ruleta y la lata: el mapache, el reloj, las pilas de fichas y garbanzos
  await armarios(casino).getByRole('button', { name: 'Ruleta y lata' }).click();
  await settled(page);
  for (const id of ['mapache-crupier', 'reloj-deco', 'jersey:22', 'fichas', 'garbanzos', 'lampara-flecos', 'tarro-garbanzos']) {
    const p = await premio(page, id);
    expect(p.visto).toBe(true);
    expect(p.front).toBe(true);
  }
  for (const id of ['ruleta-sobremesa', 'baraja-naipes', 'taburete-barra']) expect((await premio(page, id)).visto).toBe(false);
  // (los premios también se eligen sin tocar la escena, con la lista para lectores de pantalla)
  await casino.getByRole('navigation', { name: /Premios de la ruleta y la lata/ }).getByRole('button', { name: /Tus fichas/ }).evaluate((b) => b.click());
  await expect(ficha).toContainText('420 fichas ahora mismo.');
  await page.waitForTimeout(300);
  await shot(page, info, '24-vitrina-ruleta');

  // Las copas: las logradas, a la vista; las demás, tapadas
  await armarios(casino).getByRole('button', { name: 'Chisteras y copas' }).click();
  await settled(page);
  expect((await premio(page, 'chisteras-perfecta')).visto).toBe(true);
  expect((await premio(page, 'chisteras-diez')).visto).toBe(false);
  const c = await premio(page, 'ruleta-dorada');
  expect(c.front).toBe(true);
  await page.mouse.click(c.x, c.y);
  await expect(ficha).toContainText('La casilla dorada');
  await expect(ficha).toContainText('Logrado: solo de adorno');
  await page.waitForTimeout(300);
  await shot(page, info, '25-vitrina-copas');

  // La de un amigo: sus premios, solo para mirar, y se vuelve a la tuya
  await casino.getByRole('group', { name: 'Ver la vitrina de un amigo' }).getByRole('button', { name: 'Ver la de Bea lectora' }).click();
  await expect(casino.locator('.cs3-vit__cuenta')).toContainText('La vitrina de Bea lectora');
  await expect(casino.locator('.cs3-vit__cuenta')).toContainText('4 de 35');
  await armarios(casino).getByRole('button', { name: 'La caja' }).click();
  await settled(page);
  expect((await premio(page, 'neon-veintiuna')).visto).toBe(true);
  expect((await premio(page, 'gramola')).visto).toBe(false);
  const m = await premio(page, 'mesa-tapete');
  await page.mouse.click(m.x, m.y);
  await expect(ficha).toContainText('Lo tiene Bea lectora.');
  await page.waitForTimeout(300);
  await shot(page, info, '26-vitrina-amigo');
  await casino.getByRole('button', { name: 'Volver a la mía' }).click();
  await expect(casino.locator('.cs3-vit__cuenta')).toContainText('Tu vitrina');
  expect((await premio(page, 'gramola')).visto).toBe(true);
  await casino.getByRole('button', { name: 'Volver a la sala' }).click();
  await settled(page);
  expect(errors).toEqual([]);
});

test('la vitrina sin su migración: todo tapado y lo dice', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'una vez basta');
  const { casino } = await alCasino(page, { datos: { fichas: 0, semana: 0 } });
  await aLaVitrina(page, casino);
  await expect(casino.locator('.cs3-vit__nota')).toContainText('La vitrina aún no está lista');
  expect((await premio(page, 'gramola')).visto).toBe(false);
  expect((await premio(page, 'fichas')).visto).toBe(false);
});

test('vídeo: la vitrina, de cerca', async ({ browser }, info) => {
  test.skip(!process.env.CASINO_VIDEO || !/^(chromium|webkit)-390x844$/.test(info.project.name), 'solo con CASINO_VIDEO=1');
  test.setTimeout(120000);
  const bruto = join(DIR, 'bruto');
  mkdirSync(bruto, { recursive: true });
  const context = await browser.newContext({ ...info.project.use, recordVideo: { dir: bruto, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const { casino } = await alCasino(page, { datos: { fichas: 420, semana: 30, garbanzos: 380, amigos: [BEA], vitrina: MIA }, reduced: false });
  const pausa = (ms) => page.waitForTimeout(ms);
  await pausa(1200);
  await aLaVitrina(page, casino);
  await pausa(1500);
  for (const id of ['gramola', 'conejo-chistera', 'neon-veintiuna']) {
    const p = await premio(page, id);
    await page.mouse.click(p.x, p.y);
    await pausa(2200);
  }
  await armarios(casino).getByRole('button', { name: 'Ruleta y lata' }).click();
  await pausa(1500);
  const mp = await premio(page, 'mapache-crupier');
  await page.mouse.click(mp.x, mp.y);
  await pausa(2600);
  await armarios(casino).getByRole('button', { name: 'Chisteras y copas' }).click();
  await pausa(1500);
  const cp = await premio(page, 'ruleta-dorada');
  await page.mouse.click(cp.x, cp.y);
  await pausa(2200);
  await casino.getByRole('button', { name: 'Ver la de Bea lectora' }).click();
  await pausa(2200);
  await casino.getByRole('button', { name: 'Volver a la mía' }).click();
  await pausa(1000);
  await casino.getByRole('button', { name: 'Volver a la sala' }).click();
  await settled(page);
  await pausa(1200);
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join(DIR, `vitrina-${info.project.name}.webm`));
});
