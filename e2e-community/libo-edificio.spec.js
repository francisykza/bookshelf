// Libo (docs/qa/libo.md, bloque 2): la primera vez que llegas a cada sitio del edificio (el portal, tu piso, el café y el
// hotel) y al cuaderno de la comunidad, te lo enseña sobre los controles de verdad; después se queda en su esquina sin tapar
// a Pilar ni los controles. Supabase simulado y una cuenta de prueba (ninguna cuenta real). Con vídeo.
// Emulación: no equivale a un Android ni a un iPhone reales.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NEIGHBOURS } from '../src/features/edificio/demo.js';
import { CAPITULOS } from '../src/features/libo/libo.js';
import { simularCafe } from './cafeMock';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222' };
const DIR = join('qa-report', 'libo');

test.use({ video: 'on' });

function seed() {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.profiles.push({ user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'zorro-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '1A' }, { user_id: BRUNO.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout: NEIGHBOURS.find((n) => n.id === '1a').room() }, { user_id: BRUNO.id, layout: NEIGHBOURS.find((n) => n.id === '1a').room() });
  return mock;
}
const shot = (page, info, name) => page.screenshot({ path: join(DIR, info.project.name, `${name}.png`) });
const vistos = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1') ?? '{}').settings?.libo?.vistos ?? []);
const corta = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * Recorre un capítulo de Libo hasta el final: en cada paso, la tarjeta dentro de la pantalla, botones de 44 px, el hueco
 * sobre su control (si lo tiene) y la tarjeta sin tapar ese control. Devuelve los pasos que se vieron.
 */
async function recorrer(page, info, capitulo, prefijo) {
  const pasos = CAPITULOS[capitulo].pasos;
  const vistosAqui = [];
  await expect(page.locator('.libo-tarjeta[data-paso="hola"]')).toBeVisible({ timeout: 15000 });
  for (let n = 0; n < 12; n += 1) {
    const tarjeta = page.locator('.libo-tarjeta');
    if (!(await tarjeta.count())) break;
    const id = await tarjeta.getAttribute('data-paso');
    if (vistosAqui.at(-1) === id) {
      await page.waitForTimeout(150);
      continue;
    }
    await page.waitForTimeout(450);
    const t = await tarjeta.boundingBox();
    const vp = page.viewportSize();
    expect(t.x, `${capitulo}/${id}`).toBeGreaterThanOrEqual(0);
    expect(t.y, `${capitulo}/${id}`).toBeGreaterThanOrEqual(0);
    expect(t.x + t.width, `${capitulo}/${id}`).toBeLessThanOrEqual(vp.width + 1);
    expect(t.y + t.height, `${capitulo}/${id}`).toBeLessThanOrEqual(vp.height + 1);
    for (const b of await tarjeta.locator('button').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    const paso = pasos.find((p) => p.id === id);
    if (paso.ancla) {
      // Con varias anclas, la primera que hay (como en la app)
      let sel = null;
      for (const x of [paso.ancla].flat()) if (!sel && (await page.locator(x).count())) sel = x;
      // (en estas pruebas hay un vecino, Bruno: «Tus vecinos» señala su ventana, no una puerta libre)
      if (Array.isArray(paso.ancla)) expect(sel).toBe(paso.ancla[0]);
      const objetivo = await page.locator(sel).first().boundingBox();
      const hueco = await page.locator('.libo-guia__hueco').boundingBox();
      expect(Math.abs(hueco.x + 6 - objetivo.x), `${capitulo}/${id}`).toBeLessThan(2);
      expect(Math.abs(hueco.y + 6 - objetivo.y), `${capitulo}/${id}`).toBeLessThan(2);
      expect(corta(t, objetivo), `${capitulo}/${id}: la tarjeta tapa lo que señala`).toBe(false);
    }
    vistosAqui.push(id);
    await shot(page, info, `${prefijo}-${vistosAqui.length}-${id}`);
    await tarjeta.locator('.libo-btn--principal').click();
  }
  await expect(page.locator('.libo-guia')).toHaveCount(0);
  return vistosAqui;
}

test.beforeEach(async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844)$|^webkit-390x844$/.test(info.project.name), 'móvil vertical');
  mkdirSync(join(DIR, info.project.name), { recursive: true });
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});

test('Libo enseña el portal, tu piso, el café y el hotel la primera vez, y luego se queda en su esquina', async ({ page }, info) => {
  test.setTimeout(240000);
  const mock = seed();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await mock.attach(page, ANA);
  await simularCafe(page, { inaugurado: true, nombre: 'El Rincón', nivel: 1, granos: 12 });
  // La bienvenida del piso ya la dio (bloque 1); los sitios del edificio, todavía no. En cada carga se olvida la marca del
  // dispositivo: al recargar, lo que impide repetir es lo apuntado en tus ajustes (viajan con la cuenta)
  await page.addInitScript(() => localStorage.setItem('bookshelf:libo', '["hola","bienvenida"]'));
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(800);
  await expect(page.locator('.libo-guia')).toHaveCount(0);

  // 1 · Al bajar al edificio por la puerta del piso: el portal
  await page.locator('.plab-bar > .px-btn').click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await expect(portal.locator('.ed-facade')).toBeVisible({ timeout: 20000 });
  const edificio = await recorrer(page, info, 'edificio', 'b2-portal');
  expect(edificio).toEqual(expect.arrayContaining(['hola', 'tu-ventana', 'vecinos', 'cafe', 'limusina', 'volver']));
  const gato = page.getByRole('button', { name: 'Libo, el gato guía' });
  await expect(gato).toBeVisible();
  // En su esquina, sin tapar los botones de la calle
  const g = await gato.boundingBox();
  for (const sel of ['.ed-window--mine', '.ed-shop', '.ed-limo', '.ed-mailbox', '.ed-bar__close']) {
    const b = await page.locator(sel).first().boundingBox();
    if (b) expect(corta(g, b), sel).toBe(false);
  }
  await gato.click();
  const bocadillo = page.getByRole('dialog', { name: 'Libo' });
  await expect(bocadillo.getByRole('button', { name: 'Repasar el edificio' })).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, info, 'b2-portal-bocadillo');
  // Tocando la acera, lejos del bocadillo, se cierra
  await page.mouse.click(30, page.viewportSize().height - 30);
  await expect(bocadillo).toHaveCount(0);
  // Escape cierra el bocadillo sin cerrar el edificio
  await gato.click();
  await expect(bocadillo).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(bocadillo).toHaveCount(0);
  await expect(portal).toBeVisible();

  // 2 · Tu piso del edificio
  await portal.locator('.ed-window--mine').click();
  await expect(page.locator('.ep-corner--right')).toBeVisible({ timeout: 20000 });
  const piso = await recorrer(page, info, 'tu-piso', 'b2-piso');
  expect(piso).toEqual(['hola', 'decorar', 'armario', 'luz', 'vista']);
  await expect(gato).toBeVisible();
  const gp = await gato.boundingBox();
  for (const sel of ['.ep-corner--right', '.ep-corner--left3', '.ep-corner--left', '.ed-bar__view']) expect(corta(gp, await page.locator(sel).boundingBox()), sel).toBe(false);
  await shot(page, info, 'b2-piso-esquina');
  // En el armario, Libo se aparta
  await page.locator('.ep-corner--left3').click();
  await expect(page.getByRole('button', { name: 'Al piso' })).toBeVisible();
  await expect(gato).toHaveCount(0);
  await page.getByRole('button', { name: 'Al piso' }).click();
  await expect(gato).toBeVisible();
  await page.getByRole('button', { name: 'Volver al portal' }).click();
  await expect(portal.locator('.ed-facade')).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1600);
  await expect(page.locator('.libo-guia')).toHaveCount(0);

  // 3 · El café: Libo lo presenta, señala a Pilar y se aparta arriba
  await portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' }).click();
  const cafe = page.getByRole('dialog', { name: 'El café-librería del bajo' });
  await expect(cafe.locator('.cf3[data-ready="true"]')).toBeVisible({ timeout: 25000 });
  const pasosCafe = await recorrer(page, info, 'cafe', 'b2-cafe');
  expect(pasosCafe).toEqual(['hola', 'nivel', 'granos', 'pilar', 'fin']);
  await expect(gato).toBeVisible();
  const gc = await gato.boundingBox();
  for (const sel of ['.cf3-placa', '.cf3-monedero', '.cf3-hud__der button', '.cf3-franja', '.ed-bar__back']) {
    for (const b of await page.locator(sel).all()) expect(corta(gc, await b.boundingBox()), sel).toBe(false);
  }
  await shot(page, info, 'b2-cafe-esquina');
  // Mientras se decora (como en la barra o el obrador), Libo no está
  await page.locator('.cf3-franja').getByRole('button', { name: /decorar/i }).click();
  await expect(cafe.locator('.cf3[data-decorar="true"]')).toBeVisible();
  await expect(gato).toBeHidden();
  await shot(page, info, 'b2-cafe-decorar');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(gato).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Volver al portal' }).click();
  await expect(portal.locator('.ed-facade')).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1600);

  // 4 · El hotel, en la limusina
  await portal.getByRole('button', { name: 'Coger la limusina al Gran Hotel' }).click();
  const hotel = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' });
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible({ timeout: 20000 });
  const pasosHotel = await recorrer(page, info, 'hotel', 'b2-hotel');
  expect(pasosHotel).toEqual(['hola', 'directorio', 'cartela', 'volver']);
  await expect(gato).toBeVisible();
  const gh = await gato.boundingBox();
  for (const sel of ['.ed-bar__dir', '.ed-bar__back', '.gh-plaque']) expect(corta(gh, await page.locator(sel).boundingBox()), sel).toBe(false);
  await shot(page, info, 'b2-hotel-esquina');
  // Con el directorio abierto, se aparta
  await page.getByRole('button', { name: 'Directorio' }).click();
  await expect(page.locator('.gh-dir')).toBeVisible();
  await expect(gato).toBeHidden();
  await page.locator('.gh-dir__close').click();
  await expect(gato).toBeVisible();

  await expect.poll(() => vistos(page)).toEqual(expect.arrayContaining(['edificio', 'tu-piso', 'cafe', 'hotel']));

  // 5 · Al volver otro día (recargar), ningún sitio repite su capítulo
  await page.getByRole('button', { name: 'Al puerto' }).click();
  await expect(portal.locator('.ed-facade')).toBeVisible({ timeout: 20000 });
  // (el historial vuelve a abrir el portal al recargar)
  await page.reload();
  await expect(portal.locator('.ed-facade')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(3000);
  await expect(page.locator('.libo-guia')).toHaveCount(0);
  await expect(gato).toBeVisible();
  expect(errores).toEqual([]);
});

test('con la comunidad activada, Libo enseña las hojas del cuaderno una vez', async ({ page }, info) => {
  test.setTimeout(120000);
  const mock = seed();
  await mock.attach(page, ANA);
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf:libo', '["hola","bienvenida"]');
    if (sessionStorage.getItem('libo-e2e')) return;
    sessionStorage.setItem('libo-e2e', '1');
    history.replaceState({ bookshelf: { loc: { view: 'room', panel: { type: 'social', tab: 'lectores' } }, depth: 0, parent: null } }, '');
  });
  await page.goto('/');
  const cuaderno = page.getByRole('dialog', { name: 'Comunidad' });
  await expect(cuaderno.locator('.social-hub__tabs')).toBeVisible({ timeout: 30000 });
  const pasos = await recorrer(page, info, 'comunidad', 'b2-comunidad');
  expect(pasos).toEqual(['hola', 'lectores', 'salon', 'clubes', 'tuyo']);
  const gato = cuaderno.getByRole('button', { name: 'Libo, el gato guía' });
  await expect(gato).toBeVisible();
  // En la cabecera, sin pisar el título, tu avatar ni cerrar
  const g = await gato.boundingBox();
  for (const sel of ['.social-hub__head h2', '.social-own__btn', '.social-hub__head .icon-btn']) expect(corta(g, await cuaderno.locator(sel).boundingBox()), sel).toBe(false);
  await gato.click();
  await expect(page.getByRole('dialog', { name: 'Libo' }).getByRole('button', { name: 'Repasar la comunidad' })).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, info, 'b2-comunidad-bocadillo');
  // Escape cierra el bocadillo, no el cuaderno
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Libo' })).toHaveCount(0);
  await expect(cuaderno).toBeVisible();
  await expect.poll(() => vistos(page)).toEqual(expect.arrayContaining(['comunidad']));
  await page.reload();
  await expect(cuaderno.locator('.social-hub__tabs')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await expect(page.locator('.libo-guia')).toHaveCount(0);
});
