// Fase 1 · C: dos cuentas de prueba con pisos, bibliotecas y lectura distintos (Supabase simulado; ninguna cuenta real).
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const DIR = join('qa-report', 'fase1', 'visitas');
const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BEA = { id: '22222222-2222-4222-8222-222222222222', email: 'bea@ejemplo.test' };
const base = [
  { uid: 1, id: 'sillon', x: 4, y: 6, rot: 2, tono: 1 },
  { uid: 2, id: 'mesa-baja', x: 4, y: 4, rot: 0, tono: 0 },
  { uid: 3, id: 'estanteria', x: 2, y: 0, rot: 0, tono: 0 },
];
const copia = (o) => JSON.parse(JSON.stringify(o));
const libros = Array.from({ length: 70 }, (_, i) => ({ id: `bea-${i}`, title: `Libro de Bea ${i + 1}`, author: 'Autora de Bea' }));

function sembrar({ lectura = 'Lectura actual de Bea', paredAna = 'rosa', paredBea = 'salvia' } = {}) {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true }, { user_id: BEA.id, alias: 'Bea', avatar_id: 'lector-farol', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' }, { user_id: BEA.id, edificio: 'edificio-1', puerta: '1A' });
  mock.db.pisos.push({ user_id: ANA.id, layout: { v: 1, pared: paredAna, suelo: 'tablas', items: copia(base) } }, { user_id: BEA.id, layout: { v: 1, pared: paredBea, suelo: 'damero', items: copia(base) } });
  mock.db.corners.push({ user_id: BEA.id, visible: true, featured_books: libros.slice(0, 3), figure_ids: [], guardian_id: null, show_current: Boolean(lectura), current_title: lectura, memories: [] });
  mock.db.collections.push({ id: 'c1', owner: BEA.id, title: 'Todo', dedication: null, visible: true, books: libros.slice(3), created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  mock.db.libraries.push({ user_id: BEA.id, data: { books: [{ id: 'priv', title: 'Privado de Bea' }] }, updated_at: new Date().toISOString() });
  return mock;
}
const ready = (page) => expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
const debug = (page) => page.evaluate(() => window.__pisoLab().debug());
async function aVisita(page) {
  await page.getByRole('button', { name: 'Al edificio' }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Llamar y entrar en el piso de Bea, 1.º A' }).click();
  await expect(page.locator('.ep-canvas')).toBeVisible({ timeout: 15000 });
}
async function entrar3d(page) {
  await page.getByRole('button', { name: 'Entrar en 3D' }).click();
  await ready(page);
  await expect(page.locator('.ed-visita3d__datos')).toContainText('Está leyendo', { timeout: 10000 });
}
async function contexto(browser, extra = {}) {
  const context = await browser.newContext({ baseURL: 'http://localhost:5196', locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, ...extra });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  return { context, page };
}

test('A visita a B: todo es de B, recorre sus libros, vuelve a A y B no cambia', async ({ browser }, info) => {
  test.skip(!/^chromium-390x844$|^webkit-390x844$/.test(info.project.name), '390');
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  const { context, page } = await contexto(browser, info.project.name.startsWith('webkit') ? { isMobile: false, hasTouch: false } : {});
  const mock = sembrar();
  await mock.attach(page, ANA);
  const antes = copia(mock.db.pisos);
  await page.goto('/?inicio=habitacion');
  await ready(page);
  const propio = await debug(page);
  expect(propio.piso).not.toContain(BEA.id);
  await aVisita(page);
  await entrar3d(page);
  const v1 = await debug(page);
  expect(v1.piso).toBe(`visita:${BEA.id}`);
  await expect.poll(() => debug(page).then((d) => d.shelf.books.length), { timeout: 8000 }).toBeGreaterThan(0);
  const g1 = (await debug(page)).shelf.books;
  expect(g1.every((id) => String(id).startsWith(`${BEA.id}:`))).toBe(true);
  expect(g1.length).toBeLessThanOrEqual(31);
  const datos = page.locator('.ed-visita3d__datos');
  await expect(datos).toContainText('Lectura actual de Bea');
  await expect(datos).toContainText('Biblioteca de Bea');
  await expect(datos).toContainText('70 libros compartidos');
  await page.screenshot({ path: join(DIR, `${info.project.name}-visita.png`) });
  await page.getByRole('button', { name: 'Baldas siguientes' }).click();
  await expect(datos).toContainText('Grupo 2 de 3');
  await expect.poll(async () => (await debug(page)).shelf.books.some((id) => !g1.includes(id)), { timeout: 8000 }).toBe(true);
  await page.getByRole('button', { name: 'Ver toda la biblioteca' }).click();
  await expect(page.getByRole('heading', { name: 'Biblioteca de Bea' })).toBeVisible();
  await page.getByRole('searchbox').or(page.locator('.reader-visit__library input')).first().fill('Libro de Bea 70');
  await page.getByRole('button', { name: /Libro de Bea 70/ }).first().click();
  await expect(page.getByRole('dialog', { name: 'Libro de Bea 70' })).toBeVisible();
  await page.screenshot({ path: join(DIR, `${info.project.name}-ficha.png`) });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Libro de Bea 70' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Biblioteca de Bea' })).toBeVisible();
  await page.getByRole('button', { name: 'Volver a su piso' }).click();
  await expect(page.getByRole('heading', { name: 'Biblioteca de Bea' })).toBeHidden();
  await expect(page.getByText('Privado de Bea')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Decorar' })).toHaveCount(0);
  // Tu habitación sigue montada debajo del edificio: lo que cuenta es lo que ofrece la visita
  await expect(page.getByRole('dialog', { name: 'El edificio del puerto' }).getByText(/Registrar lectura/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver en isométrica' }).click();
  await page.waitForTimeout(800);
  // Recargar conserva dónde estabas (el piso visitado); al salir, otra vez A, sin rastro de B
  await page.reload();
  await expect(page.getByText('Piso de Bea · 1.º A').first()).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Volver al portal' }).click();
  await page.getByRole('button', { name: 'Cerrar el edificio' }).click();
  await ready(page);
  const vuelta = await debug(page);
  expect(vuelta.piso).toBe(propio.piso);
  expect(vuelta.shelf.books.some((id) => String(id).startsWith(`${BEA.id}:`))).toBe(false);
  expect(copia(mock.db.pisos.find((p) => p.user_id === BEA.id))).toEqual(antes.find((p) => p.user_id === BEA.id));
  expect(copia(mock.db.pisos.find((p) => p.user_id === ANA.id))).toEqual(antes.find((p) => p.user_id === ANA.id));
  await context.close();
  // Otra cuenta en el mismo equipo de pruebas: entra B y nada es de A
  const dos = await contexto(browser, info.project.name.startsWith('webkit') ? { isMobile: false, hasTouch: false } : {});
  await mock.attach(dos.page, BEA);
  await dos.page.goto('/?inicio=habitacion');
  await ready(dos.page);
  const deB = await debug(dos.page);
  expect(JSON.stringify(deB)).not.toContain(ANA.id);
  await dos.context.close();
});

test('sin lectura compartida se dice; no se usa la de quien visita', async ({ browser }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'Chromium');
  test.setTimeout(90000);
  const { context, page } = await contexto(browser);
  const mock = sembrar({ lectura: null });
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  await ready(page);
  await aVisita(page);
  await entrar3d(page);
  await expect(page.locator('.ed-visita3d__datos')).toContainText('No comparte su lectura actual.');
  expect((await debug(page)).book ?? null).toBeNull();
  await context.close();
});

test('la misma pared en cada vista y a la misma hora', async ({ browser }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'Chromium');
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  const { context, page } = await contexto(browser);
  const mock = sembrar({ paredAna: 'salvia', paredBea: 'salvia' });
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  await ready(page);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(DIR, 'pared-propia-3d-tarde.png') });
  await page.getByRole('button', { name: 'Decorar' }).click();
  await expect(page.locator('.ep-canvas')).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(DIR, 'pared-decorar-tarde.png') });
  await page.goBack();
  await ready(page);
  await aVisita(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(DIR, 'pared-visita-iso-tarde.png') });
  await entrar3d(page);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(DIR, 'pared-visita-3d-tarde.png') });
  await page.getByRole('button', { name: 'Ver de noche' }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Ver de día' }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(DIR, 'pared-visita-3d-dia.png') });
  await context.close();
});
