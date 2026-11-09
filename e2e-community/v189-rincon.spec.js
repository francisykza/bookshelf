// 1.89 · Objetos retirados sin perder datos, Esenciales en Decorar, cámara del sillón y visita en primera persona entre dos
// cuentas. Supabase simulado y motores de escritorio emulando móvil: no sustituye a la prueba en un móvil físico.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BEA = { id: '22222222-2222-4222-8222-222222222222', email: 'bea@ejemplo.test' };
const RETIRADOS = ['farol-azul', 'perrito', 'rosa-estrellas', 'buho-estrellas'];
const ITEMS = [
  { uid: 1, id: 'sillon', x: 4, y: 6, rot: 2, tono: 1 },
  { uid: 2, id: 'mesa-baja', x: 2, y: 5, rot: 1, tono: 0 },
  { uid: 3, id: 'estanteria', x: 5, y: 0, rot: 0, tono: 0 },
  { uid: 4, id: 'escritorio', x: 0, y: 3, rot: 3, tono: 0 },
  { uid: 5, id: 'ventana', pared: 'fondo', a: 2, tono: 0 },
  { uid: 7, id: 'farol-azul', x: 3, y: 3, rot: 0, tono: 0 },
  { uid: 8, id: 'perrito', x: 6, y: 4, rot: 1, tono: 0 },
  { uid: 9, id: 'rosa-estrellas', x: 2, y: 2, rot: 0, tono: 0 },
  { uid: 10, id: 'buho-estrellas', x: 4, y: 2, rot: 0, tono: 0 },
];
const layout = (items) => ({ v: 1, pared: 'yeso', suelo: 'tablas', items: JSON.parse(JSON.stringify(items)) });

function seed(items = ITEMS) {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true }, { user_id: BEA.id, alias: 'Bea', avatar_id: 'lector-farol', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' }, { user_id: BEA.id, edificio: 'edificio-1', puerta: '1A' });
  mock.db.pisos.push({ user_id: ANA.id, layout: layout(items) });
  return mock;
}
const mine = (mock, u = ANA) => JSON.parse(JSON.stringify(mock.db.pisos.find((p) => p.user_id === u.id).layout));
const debug = (page) => page.evaluate(() => window.__pisoLab().debug());
const iso = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__edificioPiso.room)));
const ready3d = (page) => expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });

async function enter(page) {
  await page.goto('/?inicio=habitacion');
  await ready3d(page);
}
async function decorar(page) {
  await page.getByRole('button', { name: 'Decorar' }).click();
  await expect(page.locator('.ep-canvas')).toBeVisible();
  await expect(page.locator('.ep-ess')).toBeVisible();
}
async function arrastra(page, uid, x, y) {
  // En WebKit, justo tras elegir, el dibujo aún no tiene los ids (traza en qa-report/trazas/v189): se espera
  await expect.poll(() => page.evaluate((u) => window.__edificioPiso.screenOfItem(u), uid), { timeout: 5000 }).not.toBeNull();
  const a = await page.evaluate((u) => window.__edificioPiso.screenOfItem(u), uid);
  const b = await page.evaluate(([cx, cy]) => window.__edificioPiso.screenOf(cx, cy, 0), [x, y]);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.waitForTimeout(350);
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 6 });
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.waitForTimeout(120);
  await page.mouse.up();
}
const card = (page, rol) => page.locator(`.ep-ess__card[data-rol="${rol}"]`);

test.beforeEach(async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390 en Chromium y WebKit');
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});

test('los retirados no se dibujan ni bloquean, y guardar y recargar los conserva', async ({ page }) => {
  test.setTimeout(150000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const mock = seed();
  await mock.attach(page, ANA);
  await enter(page);
  expect((await debug(page)).beings.list).toEqual([]);
  expect((await debug(page)).beings.running).toBe(false);
  await decorar(page);
  const room = await iso(page);
  expect(room.items.some((i) => RETIRADOS.includes(i.id))).toBe(false);
  expect(room.ocultos.map((i) => i.id).sort()).toEqual([...RETIRADOS].sort());
  // Fuera de la balda
  await page.locator('.ep-chip[data-cat="salon"]').click();
  await expect(page.locator('.ep-item[data-id="perrito"]')).toHaveCount(0);
  await expect(page.locator('.ep-chip[data-cat="misticos"]')).toBeHidden();
  // La estantería (un soporte) va justo donde está la rosa oculta
  await page.locator('.ep-chip[data-cat="esenciales"]').click();
  await card(page, 'estanteria').getByRole('button', { name: 'Elegir' }).click();
  await arrastra(page, 3, 2.5, 2.5);
  await expect.poll(() => iso(page).then((r) => r.items.find((i) => i.uid === 3).y), { timeout: 8000 }).toBe(2);
  // Se guarda: lo que cabe vuelve a items, y la rosa se aparca con su sitio intacto
  await expect.poll(() => mine(mock).ocultos?.map((i) => i.id), { timeout: 8000 }).toEqual(['rosa-estrellas']);
  const saved = mine(mock);
  expect(saved.ocultos[0]).toMatchObject({ uid: 9, x: 2, y: 2 });
  expect(saved.items.filter((i) => RETIRADOS.includes(i.id)).map((i) => i.uid).sort()).toEqual([10, 7, 8]);
  // Recarga: mismos objetos, mismos identificadores, sin solapes visibles y sin dibujarlos
  await page.reload();
  await expect(page.locator('.ep-canvas, .plab-stage[data-ready]').first()).toBeVisible({ timeout: 30000 });
  if (await page.getByRole('button', { name: 'Volver al sillón' }).count()) {
    expect((await iso(page)).ocultos.length).toBe(4);
    await page.getByRole('button', { name: 'Volver al sillón' }).click();
  }
  await ready3d(page);
  expect((await debug(page)).beings.list).toEqual([]);
  expect(mine(mock).ocultos[0].uid).toBe(9);
  // Un objeto nuevo no reutiliza un uid oculto
  expect(errors).toEqual([]);
});

test('Esenciales: mover, girar y sustituir se refleja en las dos vistas y tras recargar; el último no se guarda', async ({ page }) => {
  test.setTimeout(150000);
  const mock = seed();
  await mock.attach(page, ANA);
  await enter(page);
  await decorar(page);
  await expect(page.locator('.ep-chip').first()).toHaveAttribute('data-cat', 'esenciales');
  for (const rol of ['ordenador', 'estanteria', 'sillon']) await expect(card(page, rol)).toHaveAttribute('data-estado', 'colocado');
  // Elegir, girar y comprobar que el último no se puede guardar
  await card(page, 'sillon').getByRole('button', { name: 'Elegir' }).click();
  await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Girar' }).click();
  await expect.poll(() => iso(page).then((r) => r.items.find((i) => i.uid === 1).rot)).toBe(3);
  // La mecedora está en reforma (9-11-2026): ya no se ofrece para sustituir el sillón
  await card(page, 'sillon').getByRole('button', { name: 'Sustituir' }).click();
  await expect(page.getByRole('button', { name: /^Sustituir por Mecedora/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Volver al sillón' }).click();
  await ready3d(page);
  expect((await debug(page)).camera.seat).toMatchObject({ uid: 1, id: 'sillon', rot: 3 });
  await page.reload();
  await expect(page.locator('.ep-canvas, .plab-stage[data-ready]').first()).toBeVisible({ timeout: 30000 });
  if (await page.getByRole('button', { name: 'Volver al sillón' }).count()) await page.getByRole('button', { name: 'Volver al sillón' }).click();
  await ready3d(page);
  expect((await debug(page)).camera.seat).toMatchObject({ uid: 1, id: 'sillon', rot: 3 });
});

test('un piso antiguo sin esenciales sigue funcionando y no se reorganiza', async ({ page }) => {
  test.setTimeout(120000);
  const viejo = [{ uid: 1, id: 'lampara-pie', x: 7, y: 3, rot: 0, tono: 0 }, { uid: 2, id: 'silla', x: 3, y: 3, rot: 0, tono: 0 }];
  const mock = seed(viejo);
  await mock.attach(page, ANA);
  await enter(page);
  expect(mine(mock).items).toEqual(viejo);
  await expect(page.getByRole('button', { name: /biblioteca/i }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await expect(page.getByRole('button', { name: 'Ordenador' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Decorar' }).click();
  await expect(page.locator('.ep-ess')).toBeVisible();
  for (const rol of ['ordenador', 'estanteria', 'sillon']) await expect(card(page, rol)).toHaveAttribute('data-estado', 'falta');
  expect(mine(mock).items).toEqual(viejo);
  // Lo que había se puede seguir guardando y solo se coloca lo que se pide
  await card(page, 'estanteria').getByRole('button', { name: 'Colocar' }).click();
  await expect.poll(() => mine(mock).items.map((i) => i.id).sort(), { timeout: 8000 }).toEqual(['estanteria', 'lampara-pie', 'silla']);
  await expect(card(page, 'sillon')).toHaveAttribute('data-estado', 'falta');
});

test('la cámara del asiento: dentro de la habitación y con acceso, en distintas posiciones y giros', async ({ page }) => {
  test.setTimeout(240000);
  const mock = seed(ITEMS.filter((i) => !RETIRADOS.includes(i.id)));
  await mock.attach(page, ANA);
  const casos = [[4, 6, 0], [4, 6, 1], [4, 6, 2], [4, 6, 3], [0, 0, 0], [7, 7, 2], [7, 1, 1], [1, 7, 3]];
  const out = [];
  for (const [x, y, rot] of casos) {
    const piso = mock.db.pisos.find((p) => p.user_id === ANA.id);
    piso.layout = layout(ITEMS.filter((i) => !RETIRADOS.includes(i.id)).map((i) => (i.uid === 1 ? { ...i, x, y, rot } : i)));
    await enter(page);
    const c = (await debug(page)).camera;
    out.push({ x, y, rot, cam: [c.x, c.z], reach: c.reach });
    expect(c.inRoom, `${x},${y},${rot}`).toBe(true);
    expect(c.inside, `${x},${y},${rot}`).toEqual([]);
  }
  console.log('CAMARA', JSON.stringify(out));
  // Si un esencial queda a la espalda, el menú sigue llevando a él
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await expect(page.getByRole('button', { name: 'Ordenador' })).toBeVisible();
});

test('visita en primera persona: dos cuentas, su piso y sus libros, sin tocar nada', async ({ page }, info) => {
  test.setTimeout(150000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const mock = seed();
  const deBea = [
    { uid: 1, id: 'sillon', x: 1, y: 6, rot: 2, tono: 3 },
    { uid: 2, id: 'estanteria', x: 2, y: 0, rot: 0, tono: 1 },
    { uid: 3, id: 'ventana', pared: 'fondo', a: 5, tono: 0 },
  ];
  mock.db.pisos.push({ user_id: BEA.id, layout: { ...layout(deBea), pared: 'salvia' } });
  mock.db.corners.push({ user_id: BEA.id, visible: true, featured_books: [{ id: 'bea-1', title: 'Compartido por Bea', author: 'Autora' }], figure_ids: [], guardian_id: null, show_current: false, current_title: null, memories: [], last_book: null, next_book: null, signature_books: [] });
  mock.db.libraries.push({ user_id: BEA.id, data: { books: [{ id: 'priv', title: 'Biblioteca privada de Bea' }] }, updated_at: new Date().toISOString() });
  await mock.attach(page, ANA);
  const anaAntes = mine(mock);
  const beaAntes = mine(mock, BEA);
  await enter(page);
  const propio = await debug(page);
  await page.getByRole('button', { name: 'Al edificio' }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Llamar y entrar en el piso de Bea, 1.º A' }).click();
  await expect(page.locator('.ep-canvas')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Entrar en 3D' }).click();
  await ready3d(page);
  const visita = await debug(page);
  expect(visita.piso).toBe(`visita:${BEA.id}`);
  expect(visita.shelfAt).toMatchObject({ x: 2, y: 0 });
  expect(visita.camera.seat).toMatchObject({ x: 1, y: 6 });
  await expect.poll(() => debug(page).then((d) => d.shelf.books.length), { timeout: 8000 }).toBeGreaterThan(0);
  expect((await debug(page)).shelf.books.every((id) => String(id).startsWith(`${BEA.id}:`))).toBe(true);
  // Nada de su biblioteca privada, ni Registrar ni Decorar; las acciones sociales siguen y hay vuelta clara
  await expect(portal.getByText(/Registrar lectura/)).toHaveCount(0);
  await expect(page.locator('.ed-room').getByRole('button', { name: 'Decorar' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Volver al portal/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver en isométrica' })).toBeVisible();
  mkdirSync('qa-report/v189/visita', { recursive: true });
  await page.screenshot({ path: `qa-report/v189/visita/${info.project.name}-primera-persona.png` });
  // La isométrica sigue, y del mismo piso
  await page.getByRole('button', { name: 'Ver en isométrica' }).click();
  await expect(page.locator('.ep-canvas')).toBeVisible();
  expect((await iso(page)).pared).toBe('salvia');
  expect(mine(mock, BEA)).toEqual(beaAntes);
  // Al volver a mi piso, mi habitación y mis libros
  await page.goBack();
  await page.goBack();
  await ready3d(page);
  const vuelta = await debug(page);
  expect(vuelta.piso).toBe(`cuenta:${ANA.id}`);
  expect(vuelta.shelfAt).toEqual(propio.shelfAt);
  expect(mine(mock)).toEqual(anaAntes);
  expect(errors).toEqual([]);
});

test('vídeo: Decorar, mover un esencial, volver a 3D y recargar', async ({ browser }, info) => {
  test.skip(!/chromium/.test(info.project.name), 'una vez basta');
  test.setTimeout(150000);
  const context = await browser.newContext({ ...info.project.use, baseURL: info.project.use.baseURL, viewport: { width: 390, height: 844 }, recordVideo: { dir: 'qa-report/v189/video', size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  const mock = seed();
  await mock.attach(page, ANA);
  await enter(page);
  await page.waitForTimeout(1200);
  await decorar(page);
  await page.waitForTimeout(800);
  await card(page, 'estanteria').getByRole('button', { name: 'Elegir' }).click();
  await page.waitForTimeout(700);
  await arrastra(page, 3, 2.5, 0.5);
  await expect.poll(() => mine(mock).items.find((i) => i.uid === 3).x, { timeout: 8000 }).toBe(2);
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Volver al sillón' }).click();
  await ready3d(page);
  await page.waitForTimeout(1500);
  await page.reload();
  await ready3d(page);
  await page.waitForTimeout(1500);
  expect((await debug(page)).shelfAt).toMatchObject({ x: 2, y: 0 });
  await context.close();
});
