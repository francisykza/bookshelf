// 1.154, bloque 4 · Libo y los amigos (docs/qa/amigos-vecinos.md), con Supabase simulado: nunca una cuenta real. La primera vez
// que abres el telefonillo y la agenda de Amigos, Libo enseña cada uno con su capítulo; en tu piso, su sugerencia del día
// puede ser de tus amigos (aquí, la llave que te ha dado Bruno) y «Abrir Amigos» te lleva a la agenda. Reglas en
// src/features/libo/__tests__/sugerencias.test.js. Capturas en qa-report/v1154/; con LIBO_AMIGOS_VIDEO=1, el vídeo.
import { expect, test } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { CAPITULOS } from '../src/features/libo/libo.js';
import { createMockSupabase } from './mockSupabase';
import { ANA, SALA } from './v190-apoyo';

const DIR = join('qa-report', 'v1154');
const tam = (info) => info.project.name.replace(/^chromium-/, '');
const BRUNO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TODOS = ['hola', 'bienvenida', 'edificio', 'tu-piso', 'cafe', 'hotel', 'comunidad', 'telefonillo', 'amigos'];
const corta = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const shot = async (page, info, nombre) => {
  mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: join(DIR, `${nombre}-${tam(info)}.png`) });
};

/** Ana vive sola en su edificio; Bruno, su amigo, en el suyo, y le ha dado su llave. */
function seed() {
  const mock = createMockSupabase({ edificio_vecinos: [], edificio_llaves: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.profiles.push({ user_id: BRUNO, alias: 'Bruno', avatar_id: 'lector-farol', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-ana', puerta: '2B' });
  mock.db.edificio_vecinos.push({ user_id: BRUNO, edificio: 'edificio-bruno', puerta: '1A' });
  mock.db.pisos.push({ user_id: ANA.id, layout: SALA });
  mock.db.follows.push({ follower: ANA.id, followed: BRUNO, created_at: '2026-11-20T10:00:00.000Z' }, { follower: BRUNO, followed: ANA.id, created_at: '2026-11-20T10:00:00.000Z' });
  mock.db.amigos = { codigos: { [ANA.id]: 'ANAK7Q2M' } };
  mock.db.edificio_llaves.push({ codigo: 'BRUNWK3Y', edificio: 'edificio-bruno', de: BRUNO, para: ANA.id, caduca: new Date(Date.now() + 5 * 86400000).toISOString() });
  return mock;
}

/** Lo ya presentado en este aparato: todo menos `falta`. `asoma`: que el bocadillo de tu piso pueda asomar hoy. */
async function preparar(page, mock, { falta = [], asoma = false } = {}) {
  await mock.attach(page, ANA);
  await page.addInitScript(
    ([vistos, asomar]) => {
      localStorage.setItem('bookshelf:signs-hint-done', 'true');
      localStorage.setItem('bookshelf:telefonillo', '1');
      localStorage.setItem('bookshelf:libo', JSON.stringify(vistos));
      if (asomar) localStorage.removeItem('bookshelf:libo-asomo');
    },
    [TODOS.filter((c) => !falta.includes(c)), asoma],
  );
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(800);
}

/** Recorre un capítulo de Libo: cada paso dentro de la pantalla, su hueco sobre el control y la tarjeta sin taparlo. */
async function recorrer(page, info, capitulo, prefijo) {
  const pasos = CAPITULOS[capitulo].pasos;
  const vistos = [];
  await expect(page.locator('.libo-tarjeta[data-paso="hola"]')).toBeVisible({ timeout: 15000 });
  for (let n = 0; n < 12; n += 1) {
    const tarjeta = page.locator('.libo-tarjeta');
    if (!(await tarjeta.count())) break;
    const id = await tarjeta.getAttribute('data-paso');
    if (vistos.at(-1) === id) {
      await page.waitForTimeout(150);
      continue;
    }
    await page.waitForTimeout(450);
    const t = await tarjeta.boundingBox();
    const vp = page.viewportSize();
    expect(t.x >= 0 && t.y >= 0 && t.x + t.width <= vp.width + 1 && t.y + t.height <= vp.height + 1, `${capitulo}/${id} dentro de la pantalla`).toBe(true);
    const paso = pasos.find((p) => p.id === id);
    if (paso.ancla) {
      const objetivo = await page.locator(paso.ancla).first().boundingBox();
      const hueco = await page.locator('.libo-guia__hueco').boundingBox();
      expect(Math.abs(hueco.x + 6 - objetivo.x), `${capitulo}/${id}`).toBeLessThan(2);
      expect(corta(t, objetivo), `${capitulo}/${id}: la tarjeta tapa lo que señala`).toBe(false);
    }
    vistos.push(id);
    await shot(page, info, `${prefijo}-${vistos.length}-${id}`);
    await tarjeta.locator('.libo-btn--principal').click();
  }
  await expect(page.locator('.libo-guia')).toHaveCount(0);
  return vistos;
}

test.beforeEach(({}, info) => {
  test.skip(!/^chromium-(360x800|390x844|1440x900)$/.test(info.project.name), '360, 390 y escritorio');
});

test('el telefonillo: la primera vez, Libo lo enseña botón a botón', async ({ page }, info) => {
  const mock = seed();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await preparar(page, mock, { falta: ['telefonillo'] });
  await page.locator('.plab-bar > .px-btn').click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await expect(portal.getByRole('button', { name: /El telefonillo del portal/ })).toBeAttached({ timeout: 20000 });
  await page.waitForTimeout(900);
  await expect(page.locator('.libo-guia')).toHaveCount(0);
  await portal.getByRole('button', { name: /El telefonillo del portal/ }).click();
  expect(await recorrer(page, info, 'telefonillo', '01-telefonillo')).toEqual(['hola', 'botones', 'dar', 'usar', 'crece']);
  // Ya visto: Libo se queda sentado por encima del velo, y al tocarle lo repasa
  const gato = page.locator('.libo-rincon[data-lugar="telefonillo"] .libo-rincon__gato');
  await expect(gato).toBeVisible();
  expect(corta(await gato.boundingBox(), await page.locator('.ed-bar__close').boundingBox()), 'Libo no tapa la ✕').toBe(false);
  await gato.click();
  await expect(page.locator('.libo-bocadillo')).toContainText('¿Te recuerdo para qué sirve cada botón del telefonillo?');
  await page.waitForTimeout(500);
  const bocadillo = await page.locator('.libo-bocadillo').boundingBox();
  expect(bocadillo.x >= 0 && bocadillo.x + bocadillo.width <= page.viewportSize().width + 1, 'el bocadillo, dentro').toBe(true);
  await shot(page, info, '02-telefonillo-repaso');
  expect(errores).toEqual([]);
});

test('la agenda de Amigos: la primera vez, Libo enseña sus cuatro pestañas', async ({ page }, info) => {
  const mock = seed();
  await preparar(page, mock, { falta: ['amigos'] });
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
  await page.locator('.pp-am-card').getByRole('button', { name: 'Abrir Amigos' }).click();
  expect(await recorrer(page, info, 'amigos', '03-agenda')).toEqual(['hola', 'amigos', 'buscar', 'buzon', 'ajustes']);
  await expect(page.locator('.am .libo-rincon')).toBeVisible();
  await shot(page, info, '04-agenda-con-libo');
});

test('en tu piso, la sugerencia del día de Libo es de tus amigos y lleva a la agenda', async ({ page }, info) => {
  const mock = seed();
  await preparar(page, mock, { asoma: true });
  const bocadillo = page.locator('.libo-bocadillo');
  const sug = bocadillo.locator('[data-sugerencia="amigo-llave:BRUNWK3Y"]');
  await expect(sug).toContainText('Bruno te ha dado la llave de su edificio.', { timeout: 15000 });
  await page.waitForTimeout(400);
  await shot(page, info, '05-sugerencia');
  await sug.getByRole('button', { name: 'Abrir Amigos' }).click();
  await expect(page.locator('.am')).toBeVisible({ timeout: 15000 });
  await page.locator('.am').getByRole('tab', { name: /Buzón/ }).click();
  await expect(page.locator('.am-carta--llave')).toContainText('Bruno te ha dado la llave de su edificio.');
  await shot(page, info, '06-agenda-buzon');
  // Contestada: Libo no la repite en un mes
  const libo = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1') ?? '{}').settings?.libo?.callados ?? {});
  expect(Object.keys(libo)).toContain('amigo-llave:BRUNWK3Y');
});

test('vídeo de Libo con los amigos', async ({ browser }, info) => {
  test.skip(!process.env.LIBO_AMIGOS_VIDEO || info.project.name !== 'chromium-390x844', 'solo con LIBO_AMIGOS_VIDEO=1');
  test.setTimeout(150000);
  const dir = join(DIR, 'video');
  const bruto = join(dir, 'bruto');
  mkdirSync(bruto, { recursive: true });
  const context = await browser.newContext({ ...info.project.use, recordVideo: { dir: bruto, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const mock = seed();
  await preparar(page, mock, { falta: ['telefonillo', 'amigos'], asoma: true });
  const sug = page.locator('.libo-bocadillo [data-sugerencia="amigo-llave:BRUNWK3Y"]');
  await expect(sug).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(2500);
  await sug.getByRole('button', { name: 'Abrir Amigos' }).click();
  for (let n = 0; n < 5; n += 1) {
    await expect(page.locator('.libo-tarjeta')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1800);
    await page.locator('.libo-tarjeta .libo-btn--principal').click();
  }
  await page.waitForTimeout(800);
  await page.locator('.am').getByRole('tab', { name: /Buzón/ }).click();
  await page.waitForTimeout(2000);
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join(dir, '1154-libo-amigos.webm'));
});
