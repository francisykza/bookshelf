// Las poses de Libo (1.147, Francisco, 26-11-2026: «añádelas a lo largo de la app, para que parezca que libo está vivo»).
// En su esquina: llega corriendo la primera vez, habla con la pose de lo que cuenta, se sienta a leer y se duerme si no tocas
// nada, se enfada un momento con muchos toques y se le pasa enseguida, y celebra la lectura que apuntas. Con movimiento
// reducido no cambia solo. También en la guía, la biblioteca vacía y «Tu cuenta».
// Supabase simulado y datos sintéticos (ninguna cuenta real). Emulación: no equivale a un móvil real. Con vídeo.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NEIGHBOURS } from '../src/features/edificio/demo.js';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const DIR = join('qa-report', 'libo-poses');
const DIA = 86400000;
const iso = (dias) => new Date(Date.now() - dias * DIA).toISOString();
const libro = (id, title, extra) => ({ id, title, author: 'Autoría de prueba', status: 'want', pageCount: 300, currentPage: 0, cover: '', addedAt: iso(60), quotes: [], review: '', rating: null, ...extra });
const biblioteca = (books, libo) => ({ version: 8, books, settings: { sound: false, sfx: false, onboardingDone: true, ...(libo ? { libo } : {}) }, progress: { readingLog: [], pomodoros: [], claimed: {} } });
const VISTOS = ['hola', 'bienvenida', 'edificio', 'tu-piso', 'cafe', 'hotel', 'comunidad'];
const LIBROS = [libro('viento', 'El nombre del viento', { status: 'reading', currentPage: 120, startedAt: iso(40) })];

test.use({ video: 'on' });

test.beforeEach(async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844)$/.test(info.project.name), 'móvil vertical');
  mkdirSync(join(DIR, info.project.name), { recursive: true });
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});
const shot = (page, info, name) => page.screenshot({ path: join(DIR, info.project.name, `${name}.png`) });
/** De cerca, la esquina de Libo (para ver bien la pose) */
async function cerca(page, info, name) {
  const r = await page.locator('.libo-rincon').boundingBox();
  const x = Math.max(0, r.x - 70);
  const y = Math.max(0, r.y - 60);
  await page.screenshot({ path: join(DIR, info.project.name, `${name}.png`), clip: { x, y, width: Math.min(220, page.viewportSize().width - x), height: Math.min(170, page.viewportSize().height - y) } });
}
const pose = (page) => page.locator('.libo-rincon__gato img').getAttribute('data-pose');

async function casa(page, { datos = biblioteca(LIBROS, { vistos: VISTOS }) } = {}) {
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout: NEIGHBOURS.find((n) => n.id === '1a').room() });
  mock.db.piso_cuentas[ANA.id] = { inicio_elegido: true, tickets: 60, sin_raro: 0 };
  mock.db.libraries.push({ user_id: ANA.id, data: datos, updated_at: new Date().toISOString(), version: 5 });
  await page.addInitScript((d) => {
    if (sessionStorage.getItem('sembrado')) return;
    sessionStorage.setItem('sembrado', '1');
    localStorage.setItem('bookshelf:v1', JSON.stringify(d));
  }, datos);
  await mock.attach(page, ANA);
  return mock;
}

test('Libo, vivo en su esquina', async ({ page }, info) => {
  test.setTimeout(150000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await casa(page);
  await page.clock.install();
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  const gato = page.locator('.libo-rincon__gato');
  await expect(gato).toBeVisible();

  // 1 · La primera vez en la sesión llega corriendo y se queda de pie
  await expect.poll(() => pose(page), { timeout: 5000 }).toBe('de-pie');
  await page.waitForTimeout(600);
  await shot(page, info, '1-de-pie');
  await cerca(page, info, '1-de-pie-cerca');
  // Libo de pie mide lo mismo que antes (66 px en su botón)
  const alto = await page.locator('.libo-rincon__gato img').evaluate((img) => (img.getBoundingClientRect().height * 365) / 400);
  expect(Math.abs(alto - 66)).toBeLessThan(2);

  // 2 · Al tocarle habla, con la pose de lo que cuenta (hoy, ir a ver el edificio: andando)
  await gato.click();
  await expect(page.locator('.libo-bocadillo')).toBeVisible();
  await page.waitForTimeout(500);
  const hablando = await pose(page);
  expect(['saluda', 'camina', 'duda', 'abraza', 'sorpresa']).toContain(hablando);
  await shot(page, info, `2-habla-${hablando}`);
  await page.keyboard.press('Escape');
  await expect(page.locator('.libo-bocadillo')).toHaveCount(0);

  // 3 · Sin tocar nada: se sienta a leer (a veces con el gatito)…
  await page.clock.fastForward(33000);
  await expect.poll(() => pose(page), { timeout: 8000 }).toMatch(/^(lee|gatito)$/);
  await page.waitForTimeout(500);
  await cerca(page, info, `3-${await pose(page)}`);
  await shot(page, info, '3-quieto');
  // …y mucho rato después se duerme
  await page.clock.fastForward(65000);
  await expect.poll(() => pose(page), { timeout: 8000 }).toBe('duerme');
  await page.waitForTimeout(500);
  await cerca(page, info, '4-duerme');

  // 4 · Cualquier toque le despierta
  await page.mouse.click(20, 300);
  await expect.poll(() => pose(page), { timeout: 8000 }).toBe('de-pie');

  // 5 · Muchos toques seguidos: se enfada un momento y enseguida se le pasa
  for (let k = 0; k < 4; k += 1) {
    await gato.click();
    await page.waitForTimeout(120);
  }
  await expect.poll(() => pose(page), { timeout: 3000 }).toBe('enfado');
  await cerca(page, info, '5-enfado');
  await expect.poll(() => pose(page), { timeout: 4000 }).toBe('carino');
  await page.waitForTimeout(250);
  await cerca(page, info, '6-carino');
  await expect.poll(() => pose(page), { timeout: 5000 }).toBe('de-pie');
  await expect(page.locator('.libo-bocadillo')).toHaveCount(0);

  // 6 · Apuntas tu lectura y lo celebra
  await page.clock.fastForward(5000);
  await page.locator('.plab-primary').click();
  await page.waitForTimeout(800);
  await shot(page, info, '7-registrar');
  await page.getByRole('radio', { name: /Páginas leídas|He leído/ }).first().click();
  for (let k = 0; k < 12; k += 1) await page.getByRole('button', { name: 'Sumar uno' }).click();
  await page.waitForTimeout(300);
  await shot(page, info, '7-registrar-20');
  await page.getByRole('button', { name: 'Guardar lectura' }).first().click();
  await expect.poll(() => pose(page), { timeout: 6000 }).toBe('celebra');
  await page.waitForTimeout(300);
  await shot(page, info, '8-celebra');
  await cerca(page, info, '8-celebra-cerca');
  expect(errores).toEqual([]);
});

test('en la guía y en la biblioteca vacía', async ({ page }, info) => {
  test.setTimeout(120000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await casa(page, { datos: biblioteca([]) });
  await page.addInitScript(() => localStorage.removeItem('bookshelf:libo'));
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  // La guía: saluda, acompaña y celebra el final
  await expect(page.locator('.libo-tarjeta[data-paso="hola"]')).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(500);
  await shot(page, info, 'g1-hola-saluda');
  await page.getByRole('button', { name: 'Enséñame' }).click();
  for (let k = 0; k < 6; k += 1) {
    const t = page.locator('.libo-tarjeta');
    if (!(await t.count())) break;
    await page.waitForTimeout(450);
    const p = await t.getAttribute('data-paso');
    const g = page.locator('.libo-tarjeta__gato');
    await shot(page, info, `g${k + 2}-${p}-${(await g.count()) ? await g.getAttribute('data-pose') : 'esquina'}`);
    await t.locator('.libo-btn--principal').click();
  }
  await expect(page.locator('.libo-guia')).toHaveCount(0);

  // La biblioteca vacía: Libo con su libro en brazos
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('dialog', { name: 'Tu rincón' }).getByRole('button', { name: 'Mi biblioteca' }).click();
  await expect(page.locator('.lit-vacia')).toBeVisible();
  await page.waitForTimeout(500);
  await shot(page, info, 'v1-biblioteca-vacia');
  expect(errores).toEqual([]);
});

test('en «Tu cuenta», la pose dice cómo se porta', async ({ page }, info) => {
  test.setTimeout(90000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await casa(page);
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('button', { name: 'Ajustes' }).click();
  const ajustes = page.locator('.account-libo');
  await ajustes.scrollIntoViewIfNeeded();
  for (const [modo, texto] of [['sugiere', 'Libo me sugiere cosas'], ['llamar', 'Solo cuando le llamo'], ['descansa', 'Libo descansa']]) {
    await ajustes.getByText(texto).click();
    await page.waitForTimeout(400);
    await ajustes.screenshot({ path: join(DIR, info.project.name, `c-${modo}.png`) });
  }
  await ajustes.getByText('Libo me sugiere cosas').click();
  expect(errores).toEqual([]);
});

test('con movimiento reducido, Libo no cambia solo', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'una vez basta');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await casa(page);
  await page.clock.install();
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await expect.poll(() => pose(page)).toBe('de-pie');
  await page.clock.fastForward(100000);
  await page.waitForTimeout(1500);
  expect(await pose(page)).toBe('de-pie');
  // Sin animación de pose ni de respiración
  expect(await page.locator('.libo-rincon__gato img').evaluate((img) => getComputedStyle(img).animationName)).toBe('none');
});
