// 1.88.2 · Comparativas del mismo piso en isométrico y en primera persona, con los objetos que antes salían en «Aún sin
// esta vista»: los tres místicos del catálogo, la mascota, los dos muebles vivos y copias con acabado (en el suelo, encima de
// una mesa y en lo alto de la estantería). Cada objeto se coloca donde lo dejaría el editor (findFreeSpot) y se comprueba que
// en primera persona está a la altura de lo que lo sostiene. Capturas en qa-report/screenshots-community/<motor>/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NEIGHBOURS } from '../src/features/edificio/demo.js';
import { findFreeSpot, heightOf, rectOf } from '../src/features/edificio/room.js';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };

function seed() {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  const room = NEIGHBOURS.find((n) => n.id === '3b').room();
  const add = (item) => {
    if (!item) return null;
    const placed = { ...item, uid: Math.max(...room.items.map((i) => i.uid)) + 1 };
    room.items.push(placed);
    return placed;
  };
  // Delante del sillón de Ana (mira hacia el fondo de la habitación, y creciente), para que salgan en la primera persona
  const near = { x: 1, y: 4 };
  const shelf = add(findFreeSpot(room, 'estanteria', { near: { x: 0, y: 6 } }));
  const table = add(findFreeSpot(room, 'mesa-tapete', { near: { x: 2, y: 6 } }));
  const onTop = (base, id, extra = {}) => {
    const r = rectOf(base);
    return add({ id, x: r.x0, y: r.y0, rot: 0, tono: 0, ...extra });
  };
  onTop(table, 'baraja-naipes');
  onTop(table, 'lampara-mesa', { x: rectOf(table).x1 - 1, acabado: 'sol-de-tarde' });
  onTop(shelf, 'jarron', { acabado: 'nacar' });
  for (const id of ['farol-azul', 'rosa-estrellas', 'buho-estrellas', 'perrito', 'gramola']) add(findFreeSpot(room, id, { near }));
  const sofa = findFreeSpot(room, 'sofa', { near: { x: 3, y: 7 }, tono: 1 });
  if (sofa) add({ ...sofa, acabado: 'lacado' });
  mock.db.pisos.push({ user_id: ANA.id, layout: room });
  return { mock, room };
}

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

test.beforeEach(async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390 en Chromium y WebKit');
  test.skip(true, '1.89: estos objetos y efectos están retirados por ahora (retirados.js). Volver a activarla al restaurarlos.');
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});

test('el mismo piso en isométrico y en primera persona: místicos, mascota, vivos y acabados, cada uno sobre su soporte', async ({ page }, info) => {
  test.setTimeout(120000);
  const { mock, room } = seed();
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Aún sin esta vista')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__pisoLab().debug().beings.list.length), { timeout: 15000 }).toBeGreaterThan(0);
  const d = await page.evaluate(() => window.__pisoLab().debug());

  // Cada ser, en el centro de su mueble y a la altura de lo que lo sostiene (más su peana o su cojín)
  const lift = { 'farol-azul': 0.22, 'rosa-estrellas': 0.22, 'buho-estrellas': 0.22, perrito: 0.2, gramola: 0, 'mesa-tapete': 0, 'chispas-acabado': 0 };
  const want = [];
  for (const item of room.items) {
    const r = rectOf(item);
    const at = (id) => ({ uid: item.uid, id, x: (r.x0 + r.x1) / 2, y: heightOf(room, item) + lift[id], z: (r.y0 + r.y1) / 2 });
    if (item.acabado) want.push(at('chispas-acabado'));
    if (item.id in lift && item.id !== 'chispas-acabado') want.push(at(item.id));
  }
  const norm = (list) => list.map((b) => `${b.uid}|${b.id}|${b.x.toFixed(2)}|${b.y.toFixed(2)}|${b.z.toFixed(2)}`).sort();
  expect(norm(d.beings.list)).toEqual(norm(want));
  // Las piezas de encima, a la altura de su mueble (no flotan ni se hunden)
  const placed = new Map(d.placed.map((p) => [p.uid, p]));
  for (const item of room.items.filter((i) => ['baraja-naipes', 'lampara-mesa', 'jarron'].includes(i.id))) {
    expect(placed.get(item.uid)?.y, `${item.id} (${item.uid})`).toBeCloseTo(heightOf(room, item), 3);
    expect(heightOf(room, item), `${item.id} tiene soporte`).toBeGreaterThan(0);
  }
  // Se animan (salvo con movimiento reducido)
  await expect.poll(() => page.evaluate(() => window.__pisoLab().debug().beings.steps), { timeout: 5000 }).toBeGreaterThan(2);

  for (const [name, yaw] of [['izq', -2], ['centro', 0], ['der', 2]]) {
    await page.evaluate((v) => window.__pisoLab().lookTo(v), yaw);
    await page.waitForTimeout(300);
    await shot(page, info, `v1882-cmp-3d-${name}`);
  }
  // El mismo piso en isométrico (Decorar, sin tocar nada)
  await page.getByRole('button', { name: 'Decorar' }).click();
  await expect(page.locator('.ep-canvas')).toBeVisible();
  await page.waitForTimeout(600);
  await shot(page, info, 'v1882-cmp-iso');
  expect(JSON.stringify(mock.db.pisos[0].layout)).toBe(JSON.stringify(room));
});
