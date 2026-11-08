// 1.89.3 · Evidencias de la pasada artística (ETIQUETA=antes|despues): mismos muebles, cámara y hora; recorrido real arrastrando
// sobre la habitación y rendimiento en las mismas condiciones. Distribuciones que solo existen aquí. Supabase simulado.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const ETIQUETA = process.env.ETIQUETA ?? 'prueba';
const sillon = (s) => ({ uid: 1, id: 'sillon', tono: 1, ...s });
const CASOS = {
  // La composición de la tanda anterior, para valorar el arte
  muestra: {
    ventana: { x: 4, z: 0 },
    layout: {
      v: 1,
      pared: 'yeso',
      suelo: 'tablas',
      items: [
        sillon({ x: 4, y: 6, rot: 2 }),
        { uid: 2, id: 'mesa-baja', x: 4, y: 4, rot: 0, tono: 0 },
        { uid: 3, id: 'estanteria', x: 6, y: 0, rot: 0, tono: 0 },
        { uid: 4, id: 'escritorio', x: 0, y: 3, rot: 3, tono: 0 },
        { uid: 5, id: 'ventana', pared: 'fondo', a: 3, tono: 0 },
        { uid: 6, id: 'lampara-pie', x: 5, y: 2, rot: 0, tono: 0 },
      ],
    },
  },
  // Otro encuadre: ventana en la pared izquierda, sillón girado y otros tonos de madera
  otra: {
    ventana: { x: 0, z: 4 },
    layout: {
      v: 1,
      pared: 'yeso',
      suelo: 'tablas',
      items: [
        sillon({ x: 5, y: 3, rot: 1 }),
        { uid: 2, id: 'mesa-baja', x: 3, y: 3, rot: 1, tono: 2 },
        { uid: 3, id: 'estanteria', x: 2, y: 0, rot: 0, tono: 1 },
        { uid: 4, id: 'escritorio', x: 5, y: 7, rot: 2, tono: 1 },
        { uid: 5, id: 'ventana', pared: 'izq', a: 3, tono: 1 },
        { uid: 6, id: 'lampara-pie', x: 2, y: 6, rot: 0, tono: 1 },
      ],
    },
  },
};

function seed(layout) {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout });
  return mock;
}
async function abrir(page, layout) {
  await seed(layout).attach(page, ANA);
  const t0 = Date.now();
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  const montaje = Date.now() - t0;
  await expect.poll(() => page.evaluate(() => window.__pisoLab().debug().exterior.renders), { timeout: 8000 }).toBeGreaterThan(0);
  await page.waitForTimeout(800);
  return montaje;
}
const hora = (page, h) => page.evaluate((v) => window.__pisoLab().setHora(v), h);
const mirar = (page, y) => page.evaluate((v) => window.__pisoLab().lookTo(v), y);
const foto = async (page, path) => {
  await page.screenshot();
  await page.waitForTimeout(300);
  await page.screenshot({ path });
};
/** Giro hacia un punto, en el mismo sentido que `headingTo` de la escena. */
const yawA = (c, p) => {
  const a = Math.atan2(c.dir.x, c.dir.z) - Math.atan2(p.x - c.x, p.z - c.z);
  return Math.atan2(Math.sin(a), Math.cos(a));
};

test.beforeEach(async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390 en Chromium y WebKit');
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});

for (const [nombre, caso] of Object.entries(CASOS)) {
  test(`vistas: ${nombre}`, async ({ page }, info) => {
    test.setTimeout(150000);
    const montaje = await abrir(page, caso.layout);
    const dir = join('qa-report', 'v1893', ETIQUETA, info.project.name);
    mkdirSync(dir, { recursive: true });
    for (const h of ['dia', 'noche']) {
      await hora(page, h);
      await page.waitForTimeout(500);
      await foto(page, join(dir, `${nombre}-inicial-${h}.png`));
    }
    const d = await page.evaluate(() => window.__pisoLab().debug());
    const c = d.camera;
    const pc = c.reach.find((r) => r.id === 'ordenador') ?? c.reach.find((r) => r.id === 'escritorio');
    const objetivos = { ventana: yawA(c, caso.ventana), escritorio: pc.yaw };
    for (const [obj, yaw] of Object.entries(objetivos)) {
      for (const h of ['dia', 'noche']) {
        await hora(page, h);
        await mirar(page, yaw);
        await page.waitForTimeout(500);
        await foto(page, join(dir, `${nombre}-${obj}-${h}.png`));
      }
    }
    await mirar(page, 0);
    await expect(page.getByRole('button', { name: /Registrar lectura/ })).toBeVisible();
    const medir = [];
    if (/chromium/.test(info.project.name)) {
      for (const h of ['dia', 'noche']) {
        await hora(page, h);
        await page.waitForTimeout(400);
        for (let i = 0; i < 3; i += 1) medir.push({ hora: h, ...(await page.evaluate(() => window.__pisoLab().measureYaw(3000, { sync: true }))) });
      }
    }
    const final = await page.evaluate(() => window.__pisoLab().debug());
    writeFileSync(join(dir, `${nombre}-rendimiento.json`), JSON.stringify({ montaje, calls: final.calls, memory: final.memory, paintMs: final.exterior.paintMs, placed: final.placed?.length, medir }, null, 1));
    // Las posiciones guardadas se dibujan donde están
    for (const item of caso.layout.items.filter((i) => i.x !== undefined)) expect(JSON.stringify(final.placed)).toContain(String(item.uid));
  });
}

for (const nombre of Object.keys(CASOS)) {
  test(`recorrido real arrastrando: ${nombre}`, async ({ browser }, info) => {
    test.setTimeout(120000);
    test.skip(!/chromium/.test(info.project.name), 'el vídeo, solo en Chromium');
    const dir = join('qa-report', 'v1893', ETIQUETA, info.project.name);
    mkdirSync(dir, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, recordVideo: { dir, size: { width: 390, height: 844 } } });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
    await abrir(page, CASOS[nombre].layout);
    await hora(page, 'tarde');
    await page.waitForTimeout(900);
    const c = (await page.evaluate(() => window.__pisoLab().debug())).camera;
    const de = (id) => c.reach.find((r) => r.id === id)?.yaw ?? 0;
    const pc = c.reach.find((r) => r.id === 'ordenador') ? 'ordenador' : 'escritorio';
    const paradas = [yawA(c, CASOS[nombre].ventana), de('estanteria'), de(pc)];
    let actual = 0;
    for (const destino of paradas) {
      // El dedo recorre la pantalla en tramos: cada píxel de arrastre gira 0,004 radianes, como en la escena
      let restante = destino - actual;
      while (Math.abs(restante) > 0.02) {
        const paso = Math.sign(restante) * Math.min(Math.abs(restante), 0.8);
        const px = paso / 0.004;
        const y = 420;
        const x0 = 195 + px / 2;
        await page.mouse.move(x0, y);
        await page.mouse.down();
        for (let k = 1; k <= 24; k += 1) {
          await page.mouse.move(x0 - (px * k) / 24, y);
          await page.waitForTimeout(32);
        }
        await page.mouse.up();
        actual += paso;
        restante = destino - actual;
      }
      await page.waitForTimeout(900);
    }
    const video = page.video();
    await context.close();
    await video.saveAs(join(dir, `recorrido-${nombre}.webm`));
    await video.delete();
  });
}
