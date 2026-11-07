// 1.88.1 · La fachada al volver (fallo visto en Android: el edificio recortado y desplazado, con placas de pisos fuera del
// dibujo). Recorridos: abrir el edificio desde la habitación, volver de Decorar en tu piso, volver del piso de un vecino y
// cambiar el área visible (las barras del móvil). Se graba fotograma a fotograma, en la propia página, lo que se ve:
// ninguna placa ni el buzón pueden verse fuera de su sitio mientras el dibujo está ampliado, y al acabar el dibujo llena
// la fachada sin transformación y cada placa queda dentro del dibujo.
// Además: mover y girar la estantería en Decorar y pulsar «Terminar» se ve en primera persona y sigue tras recargar.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NEIGHBOURS } from '../src/features/edificio/demo.js';
import { findFreeSpot } from '../src/features/edificio/room.js';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222', email: 'bruno@ejemplo.test' };

function seed({ shelf = false } = {}) {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true }, { user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'lector-farol', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: BRUNO.id, edificio: 'edificio-1', puerta: '1A' }, { user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  const ana = NEIGHBOURS.find((n) => n.id === '3b').room();
  // Para la prueba de Decorar: una estantería (la de su piso de demostración no tiene), en un hueco libre como lo haría el editor
  if (shelf) {
    const spot = findFreeSpot(ana, 'estanteria');
    ana.items.push({ ...spot, uid: Math.max(...ana.items.map((i) => i.uid)) + 1 });
  }
  mock.db.pisos.push({ user_id: ANA.id, layout: ana }, { user_id: BRUNO.id, layout: NEIGHBOURS.find((n) => n.id === '1a').room() });
  return mock;
}

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

/**
 * Empieza a grabar cada fotograma de la próxima fachada que se monte (no la que hubiera ya), desde que aparece y durante
 * más de lo que dura cualquiera de sus animaciones.
 */
const record = (page) => page.evaluate(() => {
  window.__fachada = [];
  window.__fachadaDone = false;
  const old = document.querySelector('.ed-facade');
  const start = performance.now();
  let t0 = 0;
  const frame = () => {
    const root = document.querySelector('.ed-facade');
    if (root && root !== old && !t0) t0 = performance.now();
    if (root && root !== old) {
      const box = root.getBoundingClientRect();
      const stage = root.querySelector('.ed-facade__stage');
      const shown = (el) => {
        const s = getComputedStyle(el);
        return s.visibility !== 'hidden' && Number(s.opacity) > 0.05;
      };
      const outside = (el) => {
        const b = el.getBoundingClientRect();
        return b.left < box.left - 1 || b.right > box.right + 1 || b.top < box.top - 1 || b.bottom > box.bottom + 1;
      };
      const plates = [...root.querySelectorAll('.ed-window__plate')].filter(shown);
      const zoomed = getComputedStyle(stage).transform !== 'none';
      const mailbox = root.querySelector('.ed-mailbox');
      window.__fachada.push({
        t: Math.round(performance.now() - t0),
        zoomed,
        // El alejamiento parte de una ventana; la llegada por el muelle, del pie del dibujo (50% 100%)
        returning: zoomed && stage.style.transformOrigin !== '' && stage.style.transformOrigin !== '50% 100%',
        platesOut: plates.filter(outside).map((p) => p.textContent),
        // Con el dibujo ampliado, una placa a la vista ya no está sobre su ventana
        platesWhileZoomed: zoomed ? plates.length : 0,
        mailboxWhileZoomed: Boolean(zoomed && mailbox && shown(mailbox)),
      });
    }
    const now = performance.now();
    if ((t0 && now - t0 > 2600) || now - start > 20000) window.__fachadaDone = true;
    else requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
});
/** Dónde se ve un mueble del decorador; espera a que esté dibujado (justo tras un cambio puede no estarlo aún). */
async function itemPoint(page, uid) {
  await expect.poll(() => page.evaluate((u) => window.__edificioPiso.screenOfItem(u), uid), { timeout: 5000 }).not.toBeNull();
  return page.evaluate((u) => window.__edificioPiso.screenOfItem(u), uid);
}
const frames = async (page) => {
  await page.waitForFunction(() => window.__fachadaDone, null, { timeout: 25000 });
  return page.evaluate(() => window.__fachada);
};

/** Al acabar: el dibujo llena la fachada sin transformación y cada placa está dentro del dibujo, en su ventana. */
async function settled(page) {
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('.ed-facade__stage')).transform), { timeout: 5000 }).toBe('none');
  const g = await page.evaluate(() => {
    const r = (el) => el.getBoundingClientRect();
    const root = r(document.querySelector('.ed-facade'));
    const art = r(document.querySelector('.ed-facade__art'));
    const inside = (b) => b.left >= art.left - 1 && b.right <= art.right + 1 && b.top >= art.top - 1 && b.bottom <= art.bottom + 1;
    return {
      same: ['left', 'top', 'width', 'height'].every((k) => Math.abs(root[k] - art[k]) < 1),
      windowsOut: [...document.querySelectorAll('.ed-facade .ed-window')].filter((w) => !inside(r(w))).map((w) => w.getAttribute('aria-label')),
      inViewport: art.left >= -1 && art.right <= innerWidth + 1,
    };
  });
  expect(g).toEqual({ same: true, windowsOut: [], inViewport: true });
}

/** Ningún fotograma con una placa o el buzón fuera de su sitio. */
function clean(list, label) {
  expect(list.length, `${label}: fotogramas grabados`).toBeGreaterThan(5);
  const bad = list.filter((f) => f.platesOut.length || f.platesWhileZoomed || f.mailboxWhileZoomed);
  expect(bad.slice(0, 3), `${label}: placas o buzón fuera de su sitio`).toEqual([]);
}

test.beforeEach(async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390 en Chromium y WebKit');
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});

test('la fachada no se queda recortada ni con placas fuera: desde la habitación, tras Decorar, tras un vecino y con las barras', async ({ page }, info) => {
  test.setTimeout(120000);
  const mock = seed();
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });

  // 1. Desde la habitación (llegas por el muelle)
  await record(page);
  await page.getByRole('button', { name: 'Al edificio' }).click();
  await expect(portal.locator('.ed-facade')).toBeVisible({ timeout: 15000 });
  clean(await frames(page), 'desde la habitación');
  await settled(page);

  // 2. Tu piso, Decorar y volver: la vista se aleja desde tu ventana
  await portal.getByRole('button', { name: 'Entrar en tu piso, 2.º B' }).click();
  await expect(page.locator('.ep-canvas')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Decorar' }).first().click();
  await page.waitForTimeout(400);
  await record(page);
  await page.goBack();
  // Si Decorar ocupaba su propio paso del historial, aún queda salir del piso
  await page.waitForTimeout(800);
  if (!(await portal.locator('.ed-facade').isVisible())) {
    await record(page);
    await page.goBack();
  }
  await expect(portal.locator('.ed-facade')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(150);
  await shot(page, info, 'v1881-vuelta-decorar');
  const fromDecor = await frames(page);
  // El recorrido de verdad: se aleja desde la ventana (no llega por el muelle)
  expect(fromDecor.some((f) => f.returning)).toBe(true);
  clean(fromDecor, 'tras Decorar');
  await settled(page);

  // 3. El piso de otra persona y regresar
  await portal.getByRole('button', { name: 'Llamar y entrar en el piso de Bruno, 1.º A' }).click();
  await expect(page.locator('.ep-canvas')).toBeVisible({ timeout: 15000 });
  await record(page);
  await page.goBack();
  await expect(portal.locator('.ed-facade')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(100);
  await shot(page, info, 'v1881-vuelta-vecino');
  const fromNeighbour = await frames(page);
  expect(fromNeighbour.some((f) => f.returning)).toBe(true);
  clean(fromNeighbour, 'tras el vecino');
  await settled(page);
  // Y se puede volver a entrar: nada se ha quedado bloqueado
  await expect(portal.getByRole('button', { name: 'Llamar y entrar en el piso de Bruno, 1.º A' })).toBeEnabled();

  // 4. Las barras del móvil aparecen y se van: cambia el área visible
  for (const height of [760, 844, 700, 844]) {
    await page.setViewportSize({ width: 390, height });
    await page.waitForTimeout(150);
    await settled(page);
  }
  await shot(page, info, 'v1881-fachada-final');
});

test('Decorar: mover y girar la estantería y «Terminar» se ve en primera persona y sigue tras recargar', async ({ page }, info) => {
  test.setTimeout(120000);
  const mock = seed({ shelf: true });
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  const layout = () => JSON.parse(JSON.stringify(mock.db.pisos.find((p) => p.user_id === ANA.id).layout));
  const before = layout();
  const shelfOf = (l) => l.items.find((i) => i.id === 'estanteria');
  const start = shelfOf(before);
  expect(start).toBeTruthy();

  await page.getByRole('button', { name: 'Decorar' }).click();
  await expect(page.locator('.ep-canvas')).toBeVisible();
  // Elegir la estantería, girarla y moverla con el teclado del decorador
  const iso = () => page.evaluate(() => window.__edificioPiso.room.items.find((i) => i.id === 'estanteria'));
  const uid = (await iso()).uid;
  const point = await itemPoint(page, uid);
  await page.mouse.click(point.x, point.y);
  await page.getByRole('button', { name: 'Girar' }).first().click();
  await expect.poll(async () => (await iso()).rot).not.toBe(start.rot);
  // Y moverla: arrastrarla con el dedo (si hacia un lado no cabe, hacia el otro)
  for (const [dx, dy] of [[-45, 30], [45, -30], [45, 30], [-45, -30]]) {
    const p = await itemPoint(page, uid);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + dx, p.y + dy, { steps: 8 });
    await page.mouse.up();
    const now = await iso();
    if (now.x !== start.x || now.y !== start.y) break;
  }
  const moved = await iso();
  expect([moved.x, moved.y]).not.toEqual([start.x, start.y]);
  await page.getByRole('button', { name: 'Listo' }).first().click();
  await shot(page, info, 'v1881-estanteria-decorar');
  await page.getByRole('button', { name: 'Terminar' }).first().click();
  await expect.poll(() => shelfOf(layout()), { timeout: 8000 }).toMatchObject({ x: moved.x, y: moved.y, rot: moved.rot });
  const saved = shelfOf(layout());
  // De vuelta al sillón, si «Terminar» no lleva ya a él
  if (!(await page.locator('.plab-stage[data-ready]').isVisible())) await page.getByRole('button', { name: 'Volver al sillón' }).click();
  // Los objetos sin modelo en primera persona siguen en el piso guardado
  expect(layout().items.map((i) => i.id).sort()).toEqual(before.items.map((i) => i.id).sort());

  // En primera persona: la estantería, como quedó
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 20000 });
  await expect.poll(async () => JSON.stringify(await page.evaluate(() => window.__pisoLab().debug().shelfAt ?? null))).not.toBe('null');
  const seen = await page.evaluate(() => window.__pisoLab().debug().shelfAt);
  expect(seen).toMatchObject({ x: saved.x, y: saved.y, rot: saved.rot });
  await shot(page, info, 'v1881-estanteria-primera-persona');

  // Tras recargar, igual
  await page.reload();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(() => window.__pisoLab().debug().shelfAt)).toMatchObject({ x: saved.x, y: saved.y, rot: saved.rot });
  expect(shelfOf(layout())).toMatchObject({ x: saved.x, y: saved.y, rot: saved.rot });
  await shot(page, info, 'v1881-estanteria-recarga');
});
