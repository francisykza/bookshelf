// 1.89.1 · Comparativas con el mismo piso y distribución (ETIQUETA=antes|despues): vista inicial de día y de noche, vista hacia
// el ordenador y recorrido tras mover el sillón; y lo que se ve durante el arranque. Emulación con Supabase simulado.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const ETIQUETA = process.env.ETIQUETA ?? 'prueba';
const base = (seat) => ({
  v: 1,
  pared: 'yeso',
  suelo: 'tablas',
  items: [
    { uid: 1, id: 'sillon', tono: 1, ...seat },
    { uid: 2, id: 'mesa-baja', x: 2, y: 5, rot: 1, tono: 0 },
    { uid: 3, id: 'estanteria', x: 5, y: 0, rot: 0, tono: 0 },
    { uid: 4, id: 'escritorio', x: 0, y: 3, rot: 3, tono: 0 },
    { uid: 5, id: 'ventana', pared: 'fondo', a: 2, tono: 0 },
    { uid: 6, id: 'lampara-pie', x: 7, y: 3, rot: 0, tono: 0 },
  ],
});
// El mismo piso, con el sillón en su sitio y movido por el decorador a otros dos
const SILLON = { inicial: { x: 4, y: 6, rot: 2 }, movido: { x: 6, y: 6, rot: 3 }, otro: { x: 3, y: 2, rot: 0 } };

function seed(layout) {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout });
  return mock;
}

test.beforeEach(async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390 en Chromium y WebKit');
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});

for (const [nombre, seat] of Object.entries(SILLON)) {
  test(`vistas desde el sillón: ${nombre}`, async ({ page }, info) => {
    test.setTimeout(120000);
    const mock = seed(base(seat));
    await mock.attach(page, ANA);
    await page.goto('/?inicio=habitacion');
    await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
    await expect.poll(() => page.evaluate(() => window.__pisoLab().debug().exterior.renders), { timeout: 8000 }).toBeGreaterThan(0);
    const dir = join('qa-report', 'v1891', ETIQUETA, info.project.name);
    mkdirSync(dir, { recursive: true });
    const hora = (h) => page.evaluate((v) => window.__pisoLab().setHora(v), h);
    await page.waitForTimeout(800);
    for (const h of ['dia', 'noche']) {
      await hora(h);
      await page.waitForTimeout(500);
      // Doble captura por WebKit, que puede entregar el fotograma anterior del lienzo; aun así, la luz se compara en Chromium
      await page.screenshot();
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(dir, `${nombre}-inicial-${h}.png`) });
    }
    const d = await page.evaluate(() => window.__pisoLab().debug());
    const pc = d.camera.reach.find((r) => r.id === 'ordenador') ?? d.camera.reach.find((r) => r.id === 'escritorio');
    await page.evaluate((y) => window.__pisoLab().lookTo(y), pc.yaw);
    await page.waitForTimeout(600);
    await page.screenshot();
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(dir, `${nombre}-ordenador-noche.png`) });
    writeFileSync(join(dir, `${nombre}.json`), JSON.stringify(d.camera, null, 1));
  });
}

test('el arranque, con el piso aún en camino', async ({ page }, info) => {
  test.setTimeout(60000);
  const mock = seed(base(SILLON.inicial));
  await mock.attach(page, ANA);
  await page.route('**/PisoLabPanel*', async (route) => {
    await new Promise((r) => setTimeout(r, 2000));
    return route.fallback();
  });
  await page.goto('/?inicio=habitacion', { waitUntil: 'commit' });
  const dir = join('qa-report', 'v1891', ETIQUETA, info.project.name);
  mkdirSync(dir, { recursive: true });
  await expect(page.locator('main.sanctuary')).toBeAttached({ timeout: 20000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(dir, 'arranque.png') });
  const vista = await page.evaluate(() => {
    const el = document.querySelector('.panorama-viewport');
    return el ? getComputedStyle(el).visibility : null;
  });
  console.log('ARRANQUE', ETIQUETA, vista);
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
});
