// Galería de muebles en primera persona (reestructuración de muebles, 9-11-2026): cada mueble del catálogo, solo, delante
// del sillón y con la misma luz que la casa, para decidir con Francisco cuáles están a la altura. No comprueba nada: saca
// capturas en qa-report/muebles-retratos/. A mano: npx playwright test -c playwright.community.config.js
// e2e-community/muebles-galeria.spec.js --project=chromium-390x844 (MUEBLE=sofa para uno solo)
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOG } from '../src/features/edificio/catalog.js';
import { createRoom, validateRoom } from '../src/features/edificio/room.js';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const DIR = join('qa-report', 'muebles-retratos');

// Los que ya tiene la casa con modelo propio (sillón tapizado, lámpara, mesas de píxel, estantería, ventana)
const REFERENCIA = ['sillon', 'lampara-pie', 'estanteria', 'mesa', 'escritorio', 'mesa-baja', 'ventana'];
const fuera = (c) => c.rareza === 'mistico' || c.rareza === 'legendario' || c.id === 'tablon';

/** El sillón desde el que se mira y el mueble solo, en el centro de lo que se ve. */
function salaDe(cat) {
  let uid = 0;
  const items = [];
  const add = (item) => items.push({ uid: (uid += 1), tono: 0, ...item });
  if (cat.capa === 'pared') {
    // Mirando a la pared del fondo
    add({ id: 'sillon', x: 3, y: 6, rot: 2 });
    add({ id: cat.id, pared: 'fondo', a: Math.round(4.5 - cat.w / 2) });
  } else {
    add({ id: 'sillon', x: 3, y: 0, rot: 0 });
    const x = Math.round(4 - cat.w / 2);
    if (cat.capa === 'encima') {
      add({ id: 'mesa-baja', x: 3, y: 3, rot: 0 });
      add({ id: cat.id, x: 4, y: 3, rot: 2 });
    } else add({ id: cat.id, x, y: cat.capa === 'alfombra' ? 3 : 4, rot: cat.capa === 'alfombra' ? 0 : 2 });
  }
  return validateRoom(createRoom({ items }));
}

const elegidos = CATALOG.filter((c) => !fuera(c) && (!process.env.MUEBLE || c.id === process.env.MUEBLE));

test('galería de muebles en primera persona', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'Chromium a 390');
  test.setTimeout(900000);
  mkdirSync(DIR, { recursive: true });
  const resumen = [];
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  for (const cat of elegidos) {
    const room = salaDe(cat);
    if (!room) {
      resumen.push({ id: cat.id, error: 'piso no válido' });
      continue;
    }
    const mock = createMockSupabase({ edificio_vecinos: [] });
    mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
    mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
    mock.db.pisos.push({ user_id: ANA.id, layout: room });
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock.attach(page, ANA);
    await page.goto('/?inicio=habitacion');
    await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
    await expect.poll(() => page.evaluate(() => window.__pisoLab().debug().exterior.renders), { timeout: 8000 }).toBeGreaterThan(0);
    await page.evaluate(() => window.__pisoLab().setYawForTest(0));
    await page.waitForTimeout(300);
    const grupo = cat.cat === 'sagas' ? 'saga' : REFERENCIA.includes(cat.id) ? 'casa' : cat.capa;
    await page.screenshot({ path: join(DIR, `${grupo}-${cat.id}.png`), clip: { x: 0, y: 120, width: 390, height: 600 } });
    resumen.push({ id: cat.id, grupo, dibujado: (await page.evaluate(() => window.__pisoLab().debug().placed.map((p) => p.id))).includes(cat.id) });
  }
  writeFileSync(join(DIR, 'galeria.json'), JSON.stringify(resumen, null, 1));
});
