// Reestructuración de muebles (9-11-2026): un piso con muebles de la casa, retirados y de saga, en primera persona y en
// Decorar. Lo retirado no se dibuja ni se ofrece, pero el piso guardado no cambia. Capturas y vídeo en
// qa-report/reforma-muebles/<ETAPA>/ (ETAPA=antes|despues; por defecto, despues).
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NEIGHBOURS } from '../src/features/edificio/demo.js';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const ETAPA = process.env.ETAPA ?? 'despues';
const DIR = join('qa-report', 'reforma-muebles', ETAPA);

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

/** El piso de Noa (cama, mesilla, sillón, plantas, gato…) con un escritorio, una estantería y dos piezas de saga. */
function piso() {
  const room = NEIGHBOURS.find((n) => n.id === '3b').room();
  let uid = Math.max(...room.items.map((i) => i.uid));
  const add = (item) => room.items.push({ uid: (uid += 1), tono: 0, ...item });
  add({ id: 'escritorio', x: 0, y: 7, rot: 0 });
  add({ id: 'estanteria', x: 3, y: 8, rot: 2 });
  add({ id: 'barril', x: 8, y: 8, rot: 0 });
  add({ id: 'laud', pared: 'izq', a: 6 });
  return room;
}

test('piso con muebles retirados: primera persona y balda', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'Chromium a 390');
  test.setTimeout(180000);
  mkdirSync(DIR, { recursive: true });
  const shot = (name) => page.screenshot({ path: join(DIR, `${name}.png`) });
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  const layout = piso();
  mock.db.pisos.push({ user_id: ANA.id, layout });
  const guardado = JSON.stringify(layout);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await expect.poll(() => page.evaluate(() => window.__pisoLab().debug().exterior.renders), { timeout: 8000 }).toBeGreaterThan(0);
  for (const [k, yaw] of [0, -0.8, 0.6, -1.6].entries()) {
    await page.evaluate((v) => window.__pisoLab().setYawForTest(v), yaw);
    await page.waitForTimeout(500);
    await shot(`1-primera-persona-${k}`);
  }

  await page.getByRole('button', { name: 'Decorar' }).click();
  await expect(page.locator('.ep-canvas')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(600);
  await shot('2-decorar');
  const chips = page.locator('.ep-cats .ep-chip:not([hidden])');
  const nombres = await chips.evaluateAll((list) => list.map((b) => b.getAttribute('aria-label')));
  for (const [k, nombre] of nombres.entries()) {
    if (nombre === 'Tu personaje') continue;
    await page.locator('.ep-cats').getByRole('button', { name: nombre, exact: true }).click();
    await page.waitForTimeout(350);
    await shot(`3-balda-${String(k).padStart(2, '0')}-${nombre.replace(/[^a-záéíóúñ]+/gi, '-').toLowerCase()}`);
  }
  // Mirar no cambia el piso guardado
  expect(JSON.stringify(mock.db.pisos[0].layout)).toBe(guardado);
});
