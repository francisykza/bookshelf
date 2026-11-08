// 1.89.3 · Evidencias (ETIQUETA=antes|despues): estantería de cerca, mesa con objetos y recorrido hasta el piso de otra persona,
// con vídeo. Distribuciones que solo existen aquí. Supabase simulado y motor de escritorio emulando móvil.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BEA = { id: '22222222-2222-4222-8222-222222222222', email: 'bea@ejemplo.test' };
const ETIQUETA = process.env.ETIQUETA ?? 'prueba';
const base = (items, pared = 'yeso') => ({ v: 1, pared, suelo: 'tablas', items });
const MUESTRA = [
  { uid: 1, id: 'sillon', tono: 1, x: 4, y: 6, rot: 2 },
  { uid: 2, id: 'mesa-baja', x: 4, y: 4, rot: 0, tono: 0 },
  { uid: 3, id: 'estanteria', x: 6, y: 0, rot: 0, tono: 0 },
  { uid: 4, id: 'escritorio', x: 0, y: 3, rot: 3, tono: 0 },
  { uid: 5, id: 'ventana', pared: 'fondo', a: 3, tono: 0 },
  { uid: 6, id: 'lampara-pie', x: 5, y: 2, rot: 0, tono: 0 },
];
const conObjetos = [...MUESTRA, { uid: 7, id: 'tetera', x: 4, y: 4, rot: 0, tono: 0 }, { uid: 8, id: 'planta-pequena', x: 5, y: 4, rot: 0, tono: 0 }];
const DE_BEA = [
  { uid: 1, id: 'sofa', tono: 0, x: 3, y: 6, rot: 2 },
  { uid: 2, id: 'mesa-baja', x: 3, y: 4, rot: 0, tono: 2 },
  { uid: 3, id: 'estanteria', x: 2, y: 0, rot: 0, tono: 1 },
  { uid: 4, id: 'escritorio', x: 7, y: 3, rot: 1, tono: 1 },
  { uid: 5, id: 'ventana', pared: 'fondo', a: 5, tono: 1 },
  { uid: 6, id: 'lampara-pie', x: 6, y: 6, rot: 0, tono: 1 },
  { uid: 7, id: 'planta-grande', x: 2, y: 6, rot: 0, tono: 1 },
  { uid: 8, id: 'mesilla', x: 6, y: 2, rot: 0, tono: 2 },
];

function seed(mias, deBea = DE_BEA) {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true }, { user_id: BEA.id, alias: 'Bea', avatar_id: 'lector-farol', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' }, { user_id: BEA.id, edificio: 'edificio-1', puerta: '1A' });
  mock.db.pisos.push({ user_id: ANA.id, layout: base(mias) });
  mock.db.pisos.push({ user_id: BEA.id, layout: base(deBea, 'salvia') });
  mock.db.corners.push({ user_id: BEA.id, visible: true, featured_books: [{ id: 'bea-1', title: 'Compartido por Bea', author: 'Autora' }, { id: 'bea-2', title: 'Otro de Bea', author: 'Autora' }], figure_ids: [], guardian_id: null, show_current: false, current_title: null, memories: [], last_book: null, next_book: null, signature_books: [] });
  return mock;
}
const debug = (page) => page.evaluate(() => window.__pisoLab().debug());
const ready = (page) => expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
async function escena(browser, info, nombre, mias, h = 844) {
  const dir = join('qa-report', 'v1894', ETIQUETA, info.project.name);
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, recordVideo: { dir, size: { width: 390, height: h } } });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  const mock = seed(mias);
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  await ready(page);
  await page.waitForTimeout(1200);
  const fin = async () => {
    const video = page.video();
    await context.close();
    await video.saveAs(join(dir, `${nombre}.webm`));
    await video.delete();
  };
  return { page, dir, mock, fin };
}
async function arrastra(page, de) {
  const px = de / 0.004;
  let resto = px;
  while (Math.abs(resto) > 1) {
    const paso = Math.sign(resto) * Math.min(Math.abs(resto), 200);
    const x0 = 195 + paso / 2;
    await page.mouse.move(x0, 420);
    await page.mouse.down();
    for (let k = 1; k <= 20; k += 1) {
      await page.mouse.move(x0 - (paso * k) / 20, 420);
      await page.waitForTimeout(30);
    }
    await page.mouse.up();
    resto -= paso;
  }
}

test.beforeEach(async ({}, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'las evidencias, en Chromium 390');
});

test('estantería de cerca', async ({ browser }, info) => {
  test.setTimeout(120000);
  const { page, dir, fin } = await escena(browser, info, 'estanteria', MUESTRA);
  await page.evaluate(() => window.__pisoLab().setHora('dia'));
  const shelfYaw = (await debug(page)).camera.reach.find((r) => r.id === 'estanteria').yaw;
  await arrastra(page, shelfYaw);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(dir, 'estanteria-general.png') });
  for (const row of [2, 1, 0]) {
    const at = await page.evaluate((r) => window.__pisoLab().screenOf(`balda:${r}`), row);
    await page.mouse.click(at.x, at.y);
    await page.waitForFunction((r) => window.__pisoLab().debug().view.row === r, row, { timeout: 6000 });
    await page.waitForTimeout(1400);
    await page.screenshot({ path: join(dir, `estanteria-balda-${row}.png`) });
    await page.goBack();
    await page.waitForFunction(() => !window.__pisoLab().debug().zoomed, null, { timeout: 6000 });
    await page.waitForTimeout(500);
  }
  const d = await debug(page);
  writeFileSync(join(dir, 'estanteria.json'), JSON.stringify({ libros: d.shelf.books.length, filas: d.shelf.rows, caras: d.shelf.faces, lomos: d.shelf.spines }, null, 1));
  await fin();
});

test('mesa con varios objetos', async ({ browser }, info) => {
  test.setTimeout(120000);
  const { page, dir, fin } = await escena(browser, info, 'mesa', conObjetos);
  await page.evaluate(() => window.__pisoLab().setHora('dia'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(dir, 'mesa-sillon.png') });
  await page.getByRole('button', { name: 'Decorar' }).click();
  await expect(page.locator('.ep-canvas')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(dir, 'mesa-decorar.png') });
  if (ETIQUETA === 'despues') {
    const uids = await page.evaluate(() => Object.fromEntries(window.__edificioPiso.room.items.map((i) => [i.id, i.uid])));
    const nota = page.locator('.ep-book-note');
    await expect(nota).toContainText('tetera');
    await page.waitForTimeout(1500);
    const antes = await page.evaluate(() => window.__edificioPiso.room.items.length);
    await page.getByRole('button', { name: 'Dejar sitio al libro' }).click();
    await expect(nota).toBeHidden();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(dir, 'mesa-resuelta.png') });
    const plantaEn = await page.evaluate((u) => window.__edificioPiso.screenOfItem(u), uids['planta-pequena']);
    await page.mouse.click(plantaEn.x, plantaEn.y);
    await page.waitForTimeout(500);
    await page.mouse.move(plantaEn.x, plantaEn.y + 12);
    await page.mouse.down();
    // Una celda a la izquierda en la cuadrícula isométrica a 390 px: el hueco del libro
    await page.mouse.move(plantaEn.x - 23, plantaEn.y - 1, { steps: 14 });
    await page.waitForTimeout(700);
    await page.mouse.up();
    await expect(page.locator('.ep-status')).toContainText('ese hueco es del libro');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(dir, 'mesa-rechazo.png') });
    const items = await page.evaluate(() => window.__edificioPiso.room.items);
    writeFileSync(join(dir, 'mesa.json'), JSON.stringify({ antes, despues: items.length, tetera: items.find((i) => i.id === 'tetera'), planta: items.find((i) => i.id === 'planta-pequena') }, null, 1));
    await page.getByRole('button', { name: 'Volver al sillón' }).click();
    await ready(page);
    await page.waitForFunction(() => window.__pisoLab?.()?.debug().windows.length > 0, null, { timeout: 30000 });
    await page.evaluate(() => window.__pisoLab().setHora('dia'));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(dir, 'mesa-final.png') });
    const at = await page.evaluate(() => window.__pisoLab().screenOf('libro'));
    await page.mouse.click(at.x, at.y);
    await expect(page.getByRole('dialog').filter({ hasText: 'Guardar lectura' }).last()).toBeVisible();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(dir, 'mesa-toque-libro.png') });
  }
  await fin();
});

test('recorrido hasta el piso de otra persona', async ({ browser }, info) => {
  test.setTimeout(150000);
  const { page, dir, fin } = await escena(browser, info, 'visita', DE_BEA);
  await page.evaluate(() => window.__pisoLab().setHora('tarde'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(dir, 'visita-propio.png') });
  await page.getByRole('button', { name: 'Al edificio' }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Llamar y entrar en el piso de Bea, 1.º A' }).click();
  await expect(page.locator('.ep-canvas')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(dir, 'visita-vista-previa.png') });
  const boton = page.getByRole('button', { name: /Entrar en (primera persona|3D)/ });
  const medida = await boton.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const tope = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, alto: innerHeight, cubierto: !(tope && (tope === el || el.contains(tope))), encima: tope?.className ?? null };
  });
  writeFileSync(join(dir, 'visita-boton.json'), JSON.stringify(medida, null, 1));
  await boton.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await boton.click({ force: true });
  await ready(page);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(dir, 'visita-3d-entrada.png') });
  const c = (await debug(page)).camera;
  writeFileSync(join(dir, 'visita-camara.json'), JSON.stringify(c, null, 1));
  await arrastra(page, c.yawRange[1]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(dir, 'visita-3d-giro-a.png') });
  await arrastra(page, c.yawRange[0] - c.yawRange[1]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(dir, 'visita-3d-giro-b.png') });
  await fin();
});
