// 1.89 · El mismo piso, con el mismo encuadre, antes y después (ETIQUETA=antes|despues): capturas de día y de noche y
// mediciones comparables. El piso es un rincón completo con objetos de efectos. Solo emulación (WebGL por software).
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const ETIQUETA = process.env.ETIQUETA ?? 'prueba';
const ITEMS = [
  { uid: 1, id: 'sillon', x: 4, y: 6, rot: 2, tono: 1 },
  { uid: 2, id: 'mesa-baja', x: 2, y: 5, rot: 1, tono: 0 },
  { uid: 3, id: 'estanteria', x: 5, y: 0, rot: 0, tono: 0 },
  { uid: 4, id: 'escritorio', x: 0, y: 3, rot: 3, tono: 0 },
  { uid: 5, id: 'ventana', pared: 'fondo', a: 2, tono: 0 },
  { uid: 6, id: 'lampara-pie', x: 7, y: 3, rot: 0, tono: 0 },
  { uid: 7, id: 'farol-azul', x: 3, y: 3, rot: 0, tono: 0 },
  { uid: 8, id: 'perrito', x: 6, y: 4, rot: 1, tono: 0 },
  { uid: 9, id: 'rosa-estrellas', x: 2, y: 2, rot: 0, tono: 0 },
  { uid: 10, id: 'buho-estrellas', x: 4, y: 2, rot: 0, tono: 0 },
];

test('medidas y capturas del rincón', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390');
  test.setTimeout(180000);
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    window.__cuenta = { put: 0, raf: 0 };
    const put = CanvasRenderingContext2D.prototype.putImageData;
    CanvasRenderingContext2D.prototype.putImageData = function (...a) {
      window.__cuenta.put += 1;
      return put.apply(this, a);
    };
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (f) => {
      window.__cuenta.raf += 1;
      return raf(f);
    };
  });
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout: { v: 1, pared: 'yeso', suelo: 'tablas', items: ITEMS } });
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await expect.poll(() => page.evaluate(() => window.__pisoLab().debug().exterior.renders), { timeout: 8000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  const dir = join('qa-report', 'v189', ETIQUETA, info.project.name);
  mkdirSync(dir, { recursive: true });
  const horas = [];
  for (let k = 0; k < 4 && !horas.includes('fin'); k += 1) {
    const h = await page.evaluate(() => window.__pisoLab().debug().hora);
    if (horas.includes(h)) break;
    horas.push(h);
    await page.evaluate(() => window.__pisoLab().lookTo(0));
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(dir, `3d-${h}.png`) });
    await page.getByRole('button', { name: 'Menú de accesos' }).click();
    await page.getByRole('button', { name: /^Ver (de|al|a la|por)/ }).first().click();
    await page.waitForTimeout(400);
  }
  // En reposo: cuánto se redibuja sin tocar nada durante 5 s
  const mide = async (ms) => {
    const a = await page.evaluate(() => ({ c: { ...window.__cuenta }, d: window.__pisoLab().debug().exterior }));
    await page.waitForTimeout(ms);
    const b = await page.evaluate(() => ({ c: { ...window.__cuenta }, d: window.__pisoLab().debug().exterior }));
    return { renders: b.d.renders - a.d.renders, renderMs: Math.round((b.d.renderMs - a.d.renderMs) * 10) / 10, raf: b.c.raf - a.c.raf };
  };
  await page.evaluate(() => window.__pisoLab().lookTo(0));
  await page.waitForTimeout(500);
  const out = { etiqueta: ETIQUETA, motor: info.project.name, horas, reposo3d5s: await mide(5000) };
  const d = await page.evaluate(() => window.__pisoLab().debug());
  out.memoria = d.memory;
  out.llamadas = d.calls;
  out.seres = d.beings?.list.length ?? 0;
  out.giro = await page.evaluate(() => window.__pisoLab().measureYaw(3000));
  // Isométrico: pintadas del lienzo en 5 s sin tocar nada
  await page.getByRole('button', { name: 'Decorar' }).click();
  await expect(page.locator('.ep-canvas')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(dir, 'iso.png') });
  const c0 = await page.evaluate(() => ({ ...window.__cuenta }));
  await page.waitForTimeout(5000);
  const c1 = await page.evaluate(() => ({ ...window.__cuenta }));
  out.iso5s = { pintadas: c1.put - c0.put, raf: c1.raf - c0.raf };
  writeFileSync(join(dir, 'medidas.json'), JSON.stringify(out, null, 1));
  console.log('MEDIDAS', JSON.stringify(out));
});
