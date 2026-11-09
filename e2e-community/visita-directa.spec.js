// «Visitar» abre directamente el piso del lector: acceso desde Comunidad y desde el edificio, identidad y regreso al origen.
import { expect, test } from '@playwright/test';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BEA = { id: '22222222-2222-4222-8222-222222222222' };
const BRUNO = { id: '33333333-3333-4333-8333-333333333333' };
const sala = (pared) => ({ v: 1, pared, suelo: 'tablas', items: [{ uid: 1, id: 'sillon', tono: 1, x: 4, y: 6, rot: 2 }, { uid: 2, id: 'escritorio', x: 0, y: 3, rot: 3, tono: 0 }] });
const DATOS = { version: 8, books: [], settings: { sound: false, sfx: false, onboardingDone: true }, progress: { readingLog: [], pomodoros: [], claimed: {} } };

function simulador() {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push(
    { user_id: ANA.id, alias: 'Ana', avatar_id: 'gato-lector', community_enabled: true },
    { user_id: BEA.id, alias: 'Bea', avatar_id: 'lector-farol', community_enabled: true },
    { user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'lector-farol', community_enabled: true },
  );
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'e1', puerta: '2B' }, { user_id: BEA.id, edificio: 'e1', puerta: '1A' }, { user_id: BRUNO.id, edificio: 'e2', puerta: '3A' });
  mock.db.pisos.push({ user_id: ANA.id, layout: sala('yeso') }, { user_id: BEA.id, layout: sala('yeso') }, { user_id: BRUNO.id, layout: sala('yeso') });
  mock.db.follows.push({ follower: ANA.id, followed: BEA.id }, { follower: ANA.id, followed: BRUNO.id });
  for (const [dueno, titulo] of [[BEA.id, 'Libro de Bea'], [BRUNO.id, 'Libro de Bruno']]) mock.db.corners.push({ user_id: dueno, visible: true, featured_books: [{ id: `${dueno}-1`, title: titulo, author: 'Autoría', cover: '' }], figure_ids: [], guardian_id: null, show_current: true, current_title: titulo, memories: [] });
  mock.db.libraries.push({ user_id: ANA.id, data: DATOS, updated_at: new Date().toISOString(), version: 5 });
  return mock;
}

async function abrir(browser, mock) {
  const context = await browser.newContext({ baseURL: 'http://localhost:5196', locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const pedidas = [];
  page.on('request', (r) => pedidas.push(r.url()));
  await page.addInitScript((d) => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!localStorage.getItem('bookshelf:v1')) localStorage.setItem('bookshelf:v1', JSON.stringify(d));
  }, DATOS);
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(800);
  return { context, page, pedidas };
}
async function comunidad(page) {
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
  await page.getByRole('button', { name: 'Comunidad', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Visitar el piso de Bruno' })).toBeVisible({ timeout: 15000 });
}
const sinEscena = (pedidas) => expect(pedidas.filter((u) => u.includes('/media/social-visit'))).toEqual([]);

test('desde Comunidad abre el piso de quien sigues y vuelve a Lectores', async ({ browser }) => {
  test.setTimeout(120000);
  const { context, page, pedidas } = await abrir(browser, simulador());
  await comunidad(page);
  await page.getByRole('button', { name: 'Visitar el piso de Bruno' }).click();
  await expect(page.locator(`.ed-visita3d[data-visita="${BRUNO.id}"]`)).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.visita-lector__quien')).toContainText('Piso de Bruno');
  await expect(page.locator('.ed-visita3d__datos')).toContainText('Libro de Bruno', { timeout: 10000 });
  await page.screenshot({ path: 'qa-report/visita-comunidad.png' });
  await page.getByRole('button', { name: 'Volver a lectores' }).click();
  await expect(page.getByRole('button', { name: 'Visitar el piso de Bruno' })).toBeVisible({ timeout: 8000 });
  await expect(page.locator('.visita-lector')).toHaveCount(0);
  sinEscena(pedidas);
  await context.close();
});

test('desde el edificio abre el piso de la vecina y vuelve al portal', async ({ browser }) => {
  test.setTimeout(120000);
  const { context, page, pedidas } = await abrir(browser, simulador());
  await page.getByRole('button', { name: 'Al edificio' }).click();
  const puerta = page.getByRole('dialog', { name: 'El edificio del puerto' }).getByRole('button', { name: 'Llamar y entrar en el piso de Bea, 1.º A' });
  await puerta.click();
  await page.getByRole('button', { name: 'Entrar en 3D' }).click({ timeout: 15000 });
  await expect(page.locator(`.ed-visita3d[data-visita="${BEA.id}"]`)).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.ed-title')).toContainText('Piso de Bea');
  await page.locator('.ed-bar__back').click();
  await expect(page.getByRole('button', { name: 'Llamar y entrar en el piso de Bea, 1.º A' })).toBeVisible({ timeout: 8000 });
  sinEscena(pedidas);
  await context.close();
});

test('sin la migración: la vecina se abre y a quien vive en otro edificio se le avisa, con su perfil', async ({ browser }) => {
  test.setTimeout(120000);
  const mock = simulador();
  mock.db.sinPisoVisita = true;
  const { context, page } = await abrir(browser, mock);
  await comunidad(page);
  await page.getByRole('button', { name: 'Visitar el piso de Bruno' }).click();
  await expect(page.locator('.visita-lector__aviso')).toContainText('no se puede visitar', { timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Ver su perfil' })).toBeVisible();
  await page.getByRole('button', { name: 'Volver a lectores' }).click();
  await page.getByRole('button', { name: 'Visitar el piso de Bea' }).click();
  await expect(page.locator(`.ed-visita3d[data-visita="${BEA.id}"]`)).toBeVisible({ timeout: 20000 });
  await context.close();
});
