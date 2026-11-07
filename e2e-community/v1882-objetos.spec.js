// 1.88.2 · Los objetos que faltaban en primera persona (místicos, la mascota y los destellos de un acabado) y la
// sincronía entre el decorador isométrico, la primera persona y la visita desde otra cuenta.
// Piso de Ana: el de su demostración más una estantería, una mesa con una lámpara de mesa con acabado encima, una tetera
// en lo alto de la estantería, un farol azul (místico) y un perrito (mascota), cada uno donde lo pondría el editor.
// Recorrido: entrar → Decorar → mover la mesa (la lámpara de encima va con ella; girarla con algo encima no se puede, regla
// del piso), girar la lámpara, girar el perrito y cambiarle el tono, y guardar la tetera → Terminar → primera persona → recargar → Bruno visita el piso de Ana. Lo dibujado sale siempre del piso guardado.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NEIGHBOURS } from '../src/features/edificio/demo.js';
import { findFreeSpot, heightOf, rectOf } from '../src/features/edificio/room.js';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222', email: 'bruno@ejemplo.test' };

function seed() {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true }, { user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'lector-farol', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: BRUNO.id, edificio: 'edificio-1', puerta: '1A' }, { user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  const ana = NEIGHBOURS.find((n) => n.id === '3b').room();
  const add = (item) => {
    const placed = { ...item, uid: Math.max(...ana.items.map((i) => i.uid)) + 1 };
    ana.items.push(placed);
    return placed;
  };
  const shelf = add(findFreeSpot(ana, 'estanteria'));
  const table = add(findFreeSpot(ana, 'mesa', { near: { x: 3, y: 6 } }));
  // Encima de los muebles, en su primera celda (como al soltarlos encima en el editor; así el resto de la mesa se puede tocar)
  const onTop = (base, id, extra = {}) => {
    const r = rectOf(base);
    return add({ id, x: r.x0, y: r.y0, rot: 0, tono: 0, ...extra });
  };
  onTop(table, 'lampara-mesa', { acabado: 'salitre' });
  onTop(shelf, 'tetera');
  add(findFreeSpot(ana, 'farol-azul'));
  add(findFreeSpot(ana, 'perrito'));
  mock.db.pisos.push({ user_id: ANA.id, layout: ana }, { user_id: BRUNO.id, layout: NEIGHBOURS.find((n) => n.id === '1a').room() });
  return mock;
}

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

async function itemPoint(page, uid) {
  await expect.poll(() => page.evaluate((u) => window.__edificioPiso.screenOfItem(u), uid), { timeout: 5000 }).not.toBeNull();
  return page.evaluate((u) => window.__edificioPiso.screenOfItem(u), uid);
}

const debug = (page) => page.evaluate(() => window.__pisoLab().debug());

/**
 * La primera persona frente al piso guardado: cada pieza (salvo las que se dibujan aparte) a la altura de lo que la
 * sostiene; cada místico y la mascota sobre su peana o su cojín; los destellos de un acabado sobre su mueble.
 */
async function matches(page, layout) {
  await expect.poll(async () => (await debug(page)).beings?.list.length ?? 0, { timeout: 15000 }).toBeGreaterThan(0);
  const d = await debug(page);
  const placed = new Map(d.placed.map((p) => [p.uid, p]));
  for (const id of ['lampara-mesa', 'tetera', 'farol-azul', 'perrito']) {
    const item = layout.items.find((i) => i.id === id && (id !== 'lampara-mesa' || i.acabado));
    if (!item) continue;
    const seen = placed.get(item.uid);
    expect(seen, `${id} dibujado`).toBeTruthy();
    expect(seen.y, `${id} a la altura de su soporte`).toBeCloseTo(heightOf(layout, item), 3);
    expect([seen.x, seen.z], `${id} en su sitio`).toEqual([item.x, item.y]);
  }
  const want = [];
  for (const item of layout.items) {
    const r = rectOf(item);
    const centre = [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
    if (item.acabado) want.push({ uid: item.uid, id: 'chispas-acabado', x: centre[0], y: heightOf(layout, item), z: centre[1] });
    if (item.id === 'farol-azul') want.push({ uid: item.uid, id: item.id, x: centre[0], y: heightOf(layout, item) + 0.22, z: centre[1] });
    if (item.id === 'perrito') want.push({ uid: item.uid, id: item.id, x: centre[0], y: heightOf(layout, item) + 0.2, z: centre[1] });
  }
  const round = (list) => list.map((b) => ({ ...b, x: Math.round(b.x * 100) / 100, y: Math.round(b.y * 100) / 100, z: Math.round(b.z * 100) / 100 })).sort((a, b) => a.uid - b.uid || a.id.localeCompare(b.id));
  expect(round(d.beings.list)).toEqual(round(want));
  return d;
}

test.beforeEach(async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390 en Chromium y WebKit');
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});

test('objetos en primera persona: mover, girar, tono y guardar se ven en 3D, tras recargar y desde otra cuenta', async ({ page, browser }, info) => {
  test.setTimeout(180000);
  const mock = seed();
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  const layoutOf = (id) => JSON.parse(JSON.stringify(mock.db.pisos.find((p) => p.user_id === id).layout));
  const before = layoutOf(ANA.id);
  const brunoBefore = JSON.stringify(layoutOf(BRUNO.id));
  // Ana ya tenía una lámpara de mesa (en la mesilla): la de la prueba es la del acabado
  const find = (l, id) => l.items.find((i) => i.id === id && (id !== 'lampara-mesa' || i.acabado));

  // Al entrar, ya están: la lámpara sobre la mesa, la tetera en lo alto de la estantería, el farol y el perrito
  await matches(page, before);
  await expect(page.getByText('Aún sin esta vista')).toHaveCount(0);
  await shot(page, info, 'v1882-1-primera-persona');

  // Decorar
  await page.getByRole('button', { name: 'Decorar' }).click();
  await expect(page.locator('.ep-canvas')).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, info, 'v1882-2-isometrico');
  const iso = (id) => page.evaluate((x) => window.__edificioPiso.room.items.find((i) => i.id === x && (x !== 'lampara-mesa' || i.acabado)), id);
  const table = await iso('mesa');
  const lamp = await iso('lampara-mesa');

  // La mesa: moverla; la lámpara va con ella
  await page.mouse.click(...Object.values(await itemPoint(page, table.uid)));
  await expect(page.getByRole('group', { name: 'Mueble elegido' })).toContainText('Mesa');
  for (const [dx, dy] of [[45, 30], [-45, -30], [-45, 30], [45, -30]]) {
    const p = await itemPoint(page, table.uid);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + dx, p.y + dy, { steps: 8 });
    await page.mouse.up();
    const now = await iso('mesa');
    if (now.x !== table.x || now.y !== table.y) break;
  }
  const movedTable = await iso('mesa');
  expect([movedTable.x, movedTable.y]).not.toEqual([table.x, table.y]);
  const carried = await iso('lampara-mesa');
  expect([carried.x - lamp.x, carried.y - lamp.y]).toEqual([movedTable.x - table.x, movedTable.y - table.y]);
  await page.getByRole('button', { name: 'Listo' }).first().click();

  // La lámpara: girarla
  await page.mouse.click(...Object.values(await itemPoint(page, lamp.uid)));
  await expect(page.getByRole('group', { name: 'Mueble elegido' })).toContainText('Lámpara de mesa');
  await page.getByRole('button', { name: 'Girar' }).first().click();
  await expect.poll(async () => (await iso('lampara-mesa')).rot).not.toBe(lamp.rot);
  await page.getByRole('button', { name: 'Listo' }).first().click();

  // El perrito: girarlo (mira hacia el otro lado) y otro tono
  const dog = await iso('perrito');
  await page.mouse.click(...Object.values(await itemPoint(page, dog.uid)));
  await expect(page.getByRole('group', { name: 'Mueble elegido' })).toContainText('Perrito');
  await page.getByRole('button', { name: 'Girar' }).first().click();
  await expect.poll(async () => (await iso('perrito')).rot).not.toBe(dog.rot);
  await page.getByRole('button', { name: 'Color' }).first().click();
  await expect.poll(async () => (await iso('perrito')).tono).not.toBe(dog.tono);
  await page.getByRole('button', { name: 'Listo' }).first().click();

  // La tetera: guardarla en el inventario
  const tea = await iso('tetera');
  await page.mouse.click(...Object.values(await itemPoint(page, tea.uid)));
  await page.getByRole('button', { name: 'Guardar' }).first().click();
  await expect.poll(() => iso('tetera')).toBeFalsy();
  await shot(page, info, 'v1882-3-isometrico-cambiado');
  const isoAfter = await page.evaluate(() => JSON.parse(JSON.stringify(window.__edificioPiso.room)));

  await page.getByRole('button', { name: 'Terminar' }).first().click();
  await expect.poll(() => find(layoutOf(ANA.id), 'tetera') ?? null, { timeout: 8000 }).toBeNull();
  const saved = layoutOf(ANA.id);
  expect(find(saved, 'mesa')).toMatchObject({ x: movedTable.x, y: movedTable.y, rot: movedTable.rot });
  expect(find(saved, 'lampara-mesa').rot).not.toBe(lamp.rot);
  expect(find(saved, 'perrito').tono).not.toBe(dog.tono);
  expect(find(saved, 'perrito').rot).not.toBe(dog.rot);
  // La lámpara sigue sobre la mesa (a su altura) y conserva su acabado
  expect(heightOf(saved, find(saved, 'lampara-mesa'))).toBeCloseTo(1.25, 3);
  expect(find(saved, 'lampara-mesa')).toMatchObject({ acabado: lamp.acabado });
  // Lo guardado es lo que dejó el decorador: nada más, nada menos
  expect(saved.items.map((i) => JSON.stringify(i)).sort()).toEqual(isoAfter.items.map((i) => JSON.stringify(i)).sort());

  // En primera persona, como quedó
  if (!(await page.locator('.plab-stage[data-ready]').isVisible())) await page.getByRole('button', { name: 'Volver al sillón' }).click();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 20000 });
  const d1 = await matches(page, saved);
  expect(d1.placed.some((p) => p.id === 'tetera')).toBe(false);
  expect(d1.placed.find((p) => p.uid === lamp.uid)?.rot).toBe(find(saved, 'lampara-mesa').rot);
  expect(d1.placed.find((p) => p.uid === dog.uid)?.rot).toBe(find(saved, 'perrito').rot);
  // Traza (WebKit): estado del lienzo al volver, y la captura cuando ya ha dibujado
  const trace = [];
  for (let k = 0; k < 12; k += 1) {
    trace.push(await page.evaluate(() => {
      const d = window.__pisoLab().debug();
      const st = document.querySelector('.plab-stage');
      const cs = st && getComputedStyle(st);
      return { t: Math.round(performance.now()), renders: d.exterior.renders, paused: d.paused, lost: d.contextLost, opacity: cs?.opacity, vis: cs?.visibility, curtain: [...document.querySelectorAll('[class*="curtain"], [class*="telon"], [class*="fade"]')].map((e) => e.className + ':' + getComputedStyle(e).opacity).join(',') };
    }));
    await page.waitForTimeout(100);
  }
  // Se guarda siempre (antes, en WebKit, una captura tomada en este punto salió oscura: aún no había dibujado)
  mkdirSync(join('qa-report', 'trazas'), { recursive: true });
  writeFileSync(join('qa-report', 'trazas', `v1882-vuelta-${info.project.name}-${Date.now()}.json`), JSON.stringify(trace, null, 1));
  await expect.poll(() => page.evaluate(() => window.__pisoLab().debug().exterior.renders), { timeout: 5000 }).toBeGreaterThan(0);
  await shot(page, info, 'v1882-4-primera-persona-cambiada');

  // Tras recargar, igual
  await page.reload();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await matches(page, saved);
  expect(JSON.stringify(layoutOf(ANA.id))).toBe(JSON.stringify(saved));

  // Bruno visita el piso de Ana: lo ve como ella lo dejó y nada cambia ni en el suyo ni en el de ella
  const other = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: info.project.use.isMobile, deviceScaleFactor: info.project.use.deviceScaleFactor ?? 2, hasTouch: info.project.use.hasTouch });
  const bruno = await other.newPage();
  await bruno.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await mock.attach(bruno, BRUNO);
  await bruno.goto('/?inicio=habitacion');
  await expect(bruno.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await bruno.getByRole('button', { name: 'Al edificio' }).click();
  const portal = bruno.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: /Llamar y entrar en el piso de Ana lectora/ }).click();
  await expect(bruno.locator('.ep-canvas')).toBeVisible({ timeout: 15000 });
  await expect.poll(() => bruno.evaluate(() => window.__edificioPiso?.room?.items?.length ?? 0), { timeout: 10000 }).toBeGreaterThan(0);
  const visited = await bruno.evaluate(() => JSON.parse(JSON.stringify(window.__edificioPiso.room.items)));
  const pick = (list) => list.map(({ uid, id, x, y, rot, tono, acabado, pared, a }) => JSON.stringify({ uid, id, x, y, rot, tono, acabado, pared, a })).sort();
  expect(pick(visited)).toEqual(pick(saved.items));
  // Quien visita no puede decorar
  await expect(bruno.getByRole('button', { name: 'Decorar' })).toHaveCount(0);
  await bruno.waitForTimeout(400);
  await shot(bruno, info, 'v1882-5-visita-bruno');
  await bruno.goBack();
  await bruno.waitForTimeout(600);
  expect(JSON.stringify(layoutOf(BRUNO.id))).toBe(brunoBefore);
  expect(JSON.stringify(layoutOf(ANA.id))).toBe(JSON.stringify(saved));
  await other.close();
});

test('sin estantería, escritorio ni ordenador: biblioteca, registro y ordenador siguen a mano y no se añade nada', async ({ page }, info) => {
  test.setTimeout(120000);
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  const bare = NEIGHBOURS.find((n) => n.id === '3b').room();
  bare.items = bare.items.filter((i) => !['estanteria', 'escritorio', 'ordenador', 'mesa'].includes(i.id));
  mock.db.pisos.push({ user_id: ANA.id, layout: bare });
  const untouched = JSON.stringify(bare);
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  const stage = page.locator('.plab-stage[data-ready]');
  await expect(stage).toBeVisible({ timeout: 30000 });
  // La captura, cuando ya ha dibujado (justo al montar el lienzo aún está vacío)
  await expect.poll(() => page.evaluate(() => window.__pisoLab().debug().exterior.renders), { timeout: 5000 }).toBeGreaterThan(0);
  await shot(page, info, 'v1882-6-sin-muebles');
  const menuItem = async (name) => {
    await page.getByRole('button', { name: 'Menú' }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };

  // El ordenador, desde el menú (no hay mueble que tocar)
  await menuItem('Ordenador');
  await expect(page.getByRole('button', { name: 'Salir del ordenador' })).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(300);
  await shot(page, info, 'v1882-7-ordenador-sin-mueble');
  await page.getByRole('button', { name: 'Salir del ordenador' }).click();
  await expect(stage).toBeVisible({ timeout: 15000 });

  // La biblioteca entera, desde el menú
  await menuItem('Toda la biblioteca');
  await expect(page.locator('.plab-room')).toBeVisible();
  await expect.poll(() => page.evaluate(() => new URL(location.href).search + JSON.stringify(history.state ?? null)), { timeout: 5000 }).toContain('toda');
  await page.waitForTimeout(300);
  await shot(page, info, 'v1882-8-biblioteca-sin-estanteria');
  await page.goBack();
  await expect(stage).toBeVisible({ timeout: 15000 });

  // Registrar la lectura en curso (o elegir una, que sin estantería lleva a Mi biblioteca)
  const register = page.getByRole('button', { name: /Registrar lectura de|Elegir una lectura/ }).first();
  await expect(register).toBeVisible();

  // Sin estantería no hay «Ver la balda» (antes llevaba a una vista vacía): ese botón abre la biblioteca entera
  await expect(page.getByRole('button', { name: 'Ver la balda' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Toda la biblioteca (tu piso no tiene estantería)' }).click();
  await expect.poll(() => page.evaluate(() => new URL(location.href).search + JSON.stringify(history.state ?? null)), { timeout: 5000 }).toContain('toda');
  await page.waitForTimeout(500);
  await shot(page, info, 'v1882-9-balda-sin-estanteria');

  // El piso guardado no ha cambiado: no se ha añadido, movido ni guardado nada
  expect(JSON.stringify(mock.db.pisos[0].layout)).toBe(untouched);
});
