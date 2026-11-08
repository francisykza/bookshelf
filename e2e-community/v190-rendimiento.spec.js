// 1.90 · Medidas de rendimiento antes y después (ETIQUETA=antes|despues), en emulación: carga de la habitación, apertura del menú
// y tareas largas. Sirven para comparar, no para hablar de un móvil físico.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const ETIQUETA = process.env.ETIQUETA ?? 'prueba';
const SALA = { v: 1, pared: 'yeso', suelo: 'tablas', items: [{ uid: 1, id: 'sillon', tono: 1, x: 4, y: 6, rot: 2 }, { uid: 2, id: 'mesa-baja', x: 4, y: 4, rot: 0, tono: 0 }, { uid: 3, id: 'estanteria', x: 6, y: 0, rot: 0, tono: 0 }, { uid: 4, id: 'escritorio', x: 0, y: 3, rot: 3, tono: 0 }, { uid: 5, id: 'ventana', pared: 'fondo', a: 3, tono: 0 }] };

test('medidas', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'solo a 390');
  test.setTimeout(120000);
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    window.__largas = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__largas.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true });
  });
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout: SALA });
  await mock.attach(page, ANA);
  const t0 = Date.now();
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  const carga = Date.now() - t0;
  await page.waitForTimeout(1500);
  const largasCarga = await page.evaluate(() => window.__largas.splice(0));
  const aperturas = [];
  for (let i = 0; i < 8; i += 1) {
    const ms = await page.evaluate(async () => {
      const b = document.querySelector('[aria-label="Menú de accesos"]');
      const t = performance.now();
      b.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const d = performance.now() - t;
      return d;
    });
    aperturas.push(Math.round(ms));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
  const largasMenu = await page.evaluate(() => window.__largas.splice(0));
  mkdirSync('qa-report/v190', { recursive: true });
  writeFileSync(`qa-report/v190/rendimiento-${ETIQUETA}.json`, JSON.stringify({ entorno: 'emulación Chromium 390x844, servidor de desarrollo', cargaMs: carga, largasCarga, aperturasMenuMs: aperturas, largasMenu }, null, 1));
});
