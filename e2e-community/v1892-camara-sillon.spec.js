// 1.89.2 · La cámara del sillón: posición sentada en cada orientación, mirada fija al frente del asiento, distribuciones
// existentes y una distribución de muestra que solo existe en esta prueba. Emulación con Supabase simulado.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const FRENTE = [[0, 1], [-1, 0], [0, -1], [1, 0]];
const resto = [
  { uid: 3, id: 'estanteria', x: 5, y: 0, rot: 0, tono: 0 },
  { uid: 4, id: 'escritorio', x: 0, y: 3, rot: 3, tono: 0 },
  { uid: 5, id: 'ventana', pared: 'fondo', a: 2, tono: 0 },
  { uid: 6, id: 'lampara-pie', x: 7, y: 3, rot: 0, tono: 0 },
];
const piso = (items) => ({ v: 1, pared: 'yeso', suelo: 'tablas', items });
const sillon = (s) => ({ uid: 1, id: 'sillon', tono: 1, ...s });
const mesa = { uid: 2, id: 'mesa-baja', x: 2, y: 5, rot: 1, tono: 0 };

const CASOS = {
  'existente-inicial': piso([sillon({ x: 4, y: 6, rot: 2 }), mesa, ...resto]),
  'existente-movido': piso([sillon({ x: 6, y: 6, rot: 3 }), mesa, ...resto]),
  'existente-otro': piso([sillon({ x: 3, y: 2, rot: 0 }), mesa, ...resto]),
  // Las cuatro orientaciones en el centro, con la mesa delante en la primera
  'orientacion-0': piso([sillon({ x: 3, y: 3, rot: 0 }), { uid: 2, id: 'mesa-baja', x: 3, y: 6, rot: 0, tono: 0 }, ...resto.filter((i) => i.id !== 'escritorio')]),
  'orientacion-1': piso([sillon({ x: 4, y: 4, rot: 1 }), { uid: 2, id: 'mesa-baja', x: 2, y: 2, rot: 0, tono: 0 }, ...resto.filter((i) => i.id !== 'escritorio')]),
  'orientacion-2': piso([sillon({ x: 3, y: 5, rot: 2 }), { uid: 2, id: 'mesa-baja', x: 3, y: 3, rot: 0, tono: 0 }, ...resto.filter((i) => i.id !== 'escritorio')]),
  'orientacion-3': piso([sillon({ x: 2, y: 4, rot: 3 }), { uid: 2, id: 'mesa-baja', x: 5, y: 4, rot: 1, tono: 0 }, ...resto.filter((i) => i.id !== 'escritorio')]),
  // Solo para valorar la composición: no es ningún piso guardado. Medidas reales del catálogo.
  muestra: piso([
    sillon({ x: 4, y: 6, rot: 2 }),
    { uid: 2, id: 'mesa-baja', x: 4, y: 4, rot: 0, tono: 0 },
    { uid: 3, id: 'estanteria', x: 6, y: 0, rot: 0, tono: 0 },
    { uid: 4, id: 'escritorio', x: 0, y: 3, rot: 3, tono: 0 },
    { uid: 5, id: 'ventana', pared: 'fondo', a: 3, tono: 0 },
    { uid: 6, id: 'lampara-pie', x: 5, y: 2, rot: 0, tono: 0 },
  ]),
};

function seed(layout) {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout });
  return mock;
}

const dirDe = (info) => join('qa-report', 'v1892', info.project.name);
async function abrir(page, layout) {
  await seed(layout).attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await expect.poll(() => page.evaluate(() => window.__pisoLab().debug().exterior.renders), { timeout: 8000 }).toBeGreaterThan(0);
  await page.waitForTimeout(800);
}
const foto = async (page, path) => {
  await page.screenshot();
  await page.waitForTimeout(300);
  await page.screenshot({ path });
};

test.beforeEach(async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390 en Chromium y WebKit');
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});

for (const [nombre, layout] of Object.entries(CASOS)) {
  test(`cámara: ${nombre}`, async ({ page }, info) => {
    test.setTimeout(120000);
    await abrir(page, layout);
    const dir = dirDe(info);
    mkdirSync(dir, { recursive: true });
    const hora = (h) => page.evaluate((v) => window.__pisoLab().setHora(v), h);
    for (const h of ['dia', 'noche']) {
      await hora(h);
      await page.waitForTimeout(500);
      await foto(page, join(dir, `${nombre}-${h}.png`));
    }
    const c = (await page.evaluate(() => window.__pisoLab().debug())).camera;
    writeFileSync(join(dir, `${nombre}.json`), JSON.stringify(c, null, 1));
    const s = layout.items[0];
    // Ojos en el centro del asiento (celdas 2×2) y por delante del respaldo; la mirada, al frente exacto del sillón
    expect(c.x).toBeCloseTo(s.x + 1, 5);
    expect(c.z).toBeCloseTo(s.y + 1, 5);
    expect(c.inside).toEqual([]);
    const largo = Math.hypot(c.dir.x, c.dir.z);
    expect(c.dir.x / largo).toBeCloseTo(FRENTE[s.rot][0], 5);
    expect(c.dir.z / largo).toBeCloseTo(FRENTE[s.rot][1], 5);
    await expect(page.getByRole('button', { name: /Registrar lectura/ })).toBeVisible();
  });
}

test('giro breve desde el sillón en la muestra', async ({ browser }, info) => {
  test.setTimeout(120000);
  test.skip(!/chromium/.test(info.project.name), 'el vídeo, solo en Chromium');
  const dir = dirDe(info);
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, recordVideo: { dir, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await abrir(page, CASOS.muestra);
  await page.evaluate(() => window.__pisoLab().setHora('tarde'));
  const c = (await page.evaluate(() => window.__pisoLab().debug())).camera;
  const pc = c.reach.find((r) => r.id === 'escritorio' || r.id === 'ordenador');
  const puntos = [0, pc.yaw, 0, -0.5, 0];
  let n = 0;
  for (let t = 0; t < puntos.length - 1; t += 1) {
    for (let k = 0; k <= 24; k += 1) {
      const y = puntos[t] + ((puntos[t + 1] - puntos[t]) * k) / 24;
      await page.evaluate((v) => window.__pisoLab().lookTo(v), y);
      await page.waitForTimeout(45);
    }
    await page.waitForTimeout(350);
    await page.screenshot({ path: join(dir, `giro-${n++}.png`) });
  }
  const video = page.video();
  await context.close();
  await video.saveAs(join(dir, 'giro.webm'));
  await video.delete();
});
