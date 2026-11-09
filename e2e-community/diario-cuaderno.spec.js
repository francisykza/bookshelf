// Diario del ordenador como cuaderno: crear, editar y reabrir, volver al listado y capturas a 390 px, con datos sintéticos.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const DIR = join('qa-report', 'diario-cuaderno');
mkdirSync(DIR, { recursive: true });
const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const SALA = { v: 1, pared: 'yeso', suelo: 'tablas', items: [{ uid: 1, id: 'sillon', tono: 1, x: 4, y: 6, rot: 2 }, { uid: 2, id: 'escritorio', x: 0, y: 3, rot: 3, tono: 0 }] };
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="540"><rect width="360" height="540" fill="#3b6b8a"/><rect x="24" y="24" width="312" height="492" fill="none" stroke="#f4e6c8" stroke-width="6"/></svg>';
const COLORES = ['yellow', 'blue', 'pink', 'orange'];
const notas = (id, n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${id}-q${i}`,
    text: `Nota de prueba ${i + 1} de ${id}: una frase bastante larga para comprobar cómo se recorta el fragmento dentro del listado del cuaderno sin romper nada de lo que hay alrededor.`,
    page: 20 + i,
    color: COLORES[i % 4],
    createdAt: `2026-10-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
  }));
const libro = (id, extra) => ({ id, title: `Libro ${id}`, author: 'Autoría de prueba', status: 'reading', pageCount: 300, currentPage: 40, cover: `https://covers.openlibrary.org/b/id/501-M.jpg`, addedAt: '2026-10-01T10:00:00.000Z', quotes: [], ...extra });
const base = (books) => ({ version: 8, books, settings: { sound: false, sfx: false, onboardingDone: true }, progress: { readingLog: [], pomodoros: [], claimed: {} } });
const LLENO = base([libro('uno', { quotes: notas('uno', 8) }), libro('dos', { quotes: notas('dos', 6), status: 'read', finishedAt: '2026-10-20T10:00:00.000Z', review: 'Una reseña de prueba que se queda contigo.', rating: 4 })]);

async function abrir(browser, datos, { webkit = false, h = 844 } = {}) {
  const context = await browser.newContext({ baseURL: 'http://localhost:5196', locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: h }, deviceScaleFactor: 2, ...(webkit ? {} : { isMobile: true, hasTouch: true }) });
  const page = await context.newPage();
  await page.route(/covers\.openlibrary\.org/, (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: svg }));
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana de prueba', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout: SALA });
  mock.db.libraries.push({ user_id: ANA.id, data: datos, updated_at: new Date().toISOString(), version: 5 });
  await page.addInitScript((d) => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!localStorage.getItem('bookshelf:v1')) localStorage.setItem('bookshelf:v1', JSON.stringify(d));
  }, datos);
  await mock.attach(page, ANA);
  await entrar(page);
  return { context, page };
}
async function entrar(page) {
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(800);
}
async function diario(page) {
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
  await page.getByRole('button', { name: 'Mi diario' }).click();
  await expect(page.locator('.pcd-cuaderno')).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(300);
}
const pestana = (page, name) => page.getByRole('tab', { name, exact: true });
const CUERPO = '.pc-win:not([hidden]) .pc-win__body';
const altura = (page) => page.locator(CUERPO).evaluate((n) => n.scrollTop);
const bajar = (page, y) => page.locator(CUERPO).evaluate((n, v) => { n.scrollTop = v; }, y);
const guardadas = (page, id) => page.evaluate((b) => JSON.parse(localStorage.getItem('bookshelf:v1')).books.find((x) => x.id === b).quotes, id);
const foto = (page, n) => page.screenshot({ path: join(DIR, `${n}.png`) });
const noche = (page) => page.evaluate(() => { document.documentElement.dataset.uiTheme = 'noche'; });

test('crear, editar, reabrir y volver al listado conservando filtro y altura', async ({ browser }, info) => {
  test.setTimeout(120000);
  const { context, page } = await abrir(browser, LLENO, { webkit: info.project.name.startsWith('webkit') });
  await diario(page);
  await pestana(page, 'Notas y citas').click();
  const totalAntes = (await guardadas(page, 'uno')).length;

  // Crear: va al libro elegido y no a otro
  await page.getByRole('button', { name: 'Nueva nota' }).click();
  await page.locator('.pcd-editor .pcd-picker select').selectOption('dos');
  await page.getByRole('textbox', { name: 'Nueva anotación' }).fill('Nota creada desde el cuaderno.');
  await page.getByRole('button', { name: 'Guardar nota' }).click();
  await expect(page.getByRole('button', { name: 'Nueva nota' })).toBeVisible({ timeout: 6000 });
  expect((await guardadas(page, 'dos')).map((q) => q.text)).toContain('Nota creada desde el cuaderno.');
  expect(await guardadas(page, 'uno')).toHaveLength(totalAntes);

  // Filtro y altura sobreviven a abrir y volver
  await page.locator('.pcd-notes__filters select').selectOption('uno');
  await page.waitForTimeout(150);
  await bajar(page, 260);
  const entrada = page.locator('.pcd-entrada', { hasText: 'Nota de prueba 3 de uno' });
  // El clic desplaza hasta la entrada si no se ve: la altura se mide ya con ella a la vista
  await entrada.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const y = await altura(page);
  expect(y).toBeGreaterThan(100);
  await entrada.click();
  await expect(page.getByRole('textbox', { name: 'Texto de la anotación' })).toHaveValue(/Nota de prueba 3 de uno/);
  await page.getByRole('button', { name: 'Volver al listado' }).click();
  await expect(pestana(page, 'Notas y citas')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.pcd-notes__filters select')).toHaveValue('uno');
  expect(Math.abs((await altura(page)) - y)).toBeLessThanOrEqual(2);

  // Editar y reabrir tras recargar
  await page.locator('.pcd-entrada', { hasText: 'Nota de prueba 3 de uno' }).click();
  await page.getByRole('textbox', { name: 'Texto de la anotación' }).fill('Nota de prueba 3 corregida.');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.locator('.pcd-entrada', { hasText: 'Nota de prueba 3 corregida.' })).toBeVisible({ timeout: 6000 });
  // La nota corregida es más corta: si la lista encoge, la altura se queda en el nuevo final
  const tope = await page.locator(CUERPO).evaluate((n) => n.scrollHeight - n.clientHeight);
  expect(Math.abs((await altura(page)) - Math.min(y, tope))).toBeLessThanOrEqual(2);
  const q = (await guardadas(page, 'uno')).find((n) => n.id === 'uno-q2');
  expect(q).toMatchObject({ text: 'Nota de prueba 3 corregida.', page: 22, color: 'pink' });
  expect(await guardadas(page, 'uno')).toHaveLength(totalAntes);

  // Reabrir de verdad: tras recargar, la nota sigue corregida y en su libro
  await page.waitForTimeout(1200);
  await page.reload();
  await page.waitForTimeout(2500);
  // La recarga puede devolver al Diario o al escritorio del ordenador, ya abierto
  if (!(await page.locator('.pcd-cuaderno').count())) {
    await page.getByRole('button', { name: 'Mi diario' }).click();
    await expect(page.locator('.pcd-cuaderno')).toBeVisible({ timeout: 8000 });
  }
  await pestana(page, 'Notas y citas').click();
  await page.locator('.pcd-entrada', { hasText: 'Nota de prueba 3 corregida.' }).click();
  await expect(page.getByRole('textbox', { name: 'Texto de la anotación' })).toHaveValue('Nota de prueba 3 corregida.');
  await page.getByRole('button', { name: 'Volver al listado' }).click();
  await expect(page.locator('.pcd-entrada', { hasText: 'Nota creada desde el cuaderno.' })).toBeVisible();
  await context.close();
});

test('la ficha abierta desde el Diario vuelve con pestaña y altura; el final se alcanza con poco alto', async ({ browser }, info) => {
  test.skip(info.project.name !== 'chromium-390x844');
  test.setTimeout(120000);
  const { context, page } = await abrir(browser, base([libro('dos', { quotes: notas('dos', 6), status: 'read', review: 'Reseña uno.' }), ...Array.from({ length: 9 }, (_, i) => libro(`r${i}`, { review: `Reseña de prueba ${i}.`, status: 'read', finishedAt: `2026-10-0${i + 1}T10:00:00.000Z` }))]));
  await diario(page);
  await pestana(page, 'Reseñas').click();
  await bajar(page, 200);
  const resena = page.locator('.pcd-entrada', { hasText: 'Reseña de prueba 2' }).first();
  await resena.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const y = await altura(page);
  expect(y).toBeGreaterThan(100);
  await resena.click();
  await expect(page.locator('.lit-ficha')).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole('tab', { name: 'Reseña', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.locator('.lit-ficha').getByRole('button', { name: 'Volver', exact: true }).click();
  await expect(page.locator('.pcd-cuaderno')).toBeVisible({ timeout: 8000 });
  await expect(pestana(page, 'Reseñas')).toHaveAttribute('aria-selected', 'true');
  expect(Math.abs((await altura(page)) - y)).toBeLessThanOrEqual(2);

  // Editor con el teclado aproximado (ventana baja): se llega a guardar
  await pestana(page, 'Notas y citas').click();
  await page.getByRole('button', { name: 'Nueva nota' }).click();
  await page.setViewportSize({ width: 390, height: 420 });
  await page.waitForTimeout(400);
  await page.getByRole('textbox', { name: 'Nueva anotación' }).fill('Algo.');
  const guardar = page.getByRole('button', { name: 'Guardar nota' });
  await guardar.scrollIntoViewIfNeeded();
  await expect(guardar).toBeInViewport({ ratio: 1 });
  await context.close();
});

test('capturas a 390 px y estados vacíos', async ({ browser }, info) => {
  test.skip(info.project.name !== 'chromium-390x844');
  test.setTimeout(120000);
  const { context, page } = await abrir(browser, LLENO);
  await diario(page);
  await foto(page, 'hoy-dia');
  await pestana(page, 'Notas y citas').click();
  await page.waitForTimeout(300);
  await foto(page, 'listado-dia');
  await page.locator('.pcd-entrada').first().click();
  await page.waitForTimeout(300);
  await foto(page, 'editor-dia');
  await noche(page);
  await page.waitForTimeout(200);
  await foto(page, 'editor-noche');
  await page.getByRole('button', { name: 'Volver al listado' }).click();
  await page.waitForTimeout(300);
  await foto(page, 'listado-noche');
  await pestana(page, 'Reseñas').click();
  await page.waitForTimeout(300);
  await foto(page, 'resenas-noche');
  await pestana(page, 'Hoy').click();
  await page.waitForTimeout(300);
  await foto(page, 'hoy-noche');
  const desborde = await page.locator(CUERPO).evaluate((n) => n.scrollWidth - n.clientWidth);
  expect(desborde).toBeLessThanOrEqual(1);
  const justos = await page.locator(CUERPO).evaluate((n) => [...n.querySelectorAll('button, select, input:not([type="checkbox"])')].filter((b) => b.getClientRects().length && b.getBoundingClientRect().height < 43.5).map((b) => `${b.className}:${(b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 24)}`));
  console.log('bajos en Hoy', JSON.stringify(justos));
  await context.close();
  const vacio = await abrir(browser, base([libro('solo')]));
  await diario(vacio.page);
  await pestana(vacio.page, 'Notas y citas').click();
  await expect(vacio.page.locator('.pcd-vacio button')).toHaveText('Nueva nota');
  await vacio.page.waitForTimeout(200);
  await foto(vacio.page, 'vacio-dia');
  await vacio.context.close();
});
