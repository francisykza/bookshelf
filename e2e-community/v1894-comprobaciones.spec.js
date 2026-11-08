// 1.89.3 · Comprobaciones: el botón de la visita en 3D a la vista (también en pantalla baja), permisos y salida del visitante,
// asiento oculto al girar y toque del libro con objetos en la mesa. Supabase simulado y motor de escritorio emulando móvil.
import { expect, test } from '@playwright/test';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BEA = { id: '22222222-2222-4222-8222-222222222222', email: 'bea@ejemplo.test' };
const base = (items, pared = 'yeso') => ({ v: 1, pared, suelo: 'tablas', items });
const MIO = [
  { uid: 1, id: 'sillon', tono: 1, x: 4, y: 6, rot: 2 },
  { uid: 2, id: 'mesa-baja', x: 4, y: 4, rot: 0, tono: 0 },
  { uid: 3, id: 'estanteria', x: 6, y: 0, rot: 0, tono: 0 },
  { uid: 4, id: 'escritorio', x: 0, y: 3, rot: 3, tono: 0 },
  { uid: 5, id: 'ventana', pared: 'fondo', a: 3, tono: 0 },
  { uid: 7, id: 'planta-pequena', x: 5, y: 4, rot: 0, tono: 0 },
];
const DE_BEA = [
  { uid: 1, id: 'sofa', tono: 0, x: 3, y: 6, rot: 2 },
  { uid: 2, id: 'mesa-baja', x: 3, y: 4, rot: 0, tono: 2 },
  { uid: 3, id: 'estanteria', x: 2, y: 0, rot: 0, tono: 1 },
  { uid: 4, id: 'escritorio', x: 7, y: 3, rot: 1, tono: 1 },
];

async function abre(page) {
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true }, { user_id: BEA.id, alias: 'Bea', avatar_id: 'lector-farol', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' }, { user_id: BEA.id, edificio: 'edificio-1', puerta: '1A' });
  mock.db.pisos.push({ user_id: ANA.id, layout: base(MIO) }, { user_id: BEA.id, layout: base(DE_BEA, 'salvia') });
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  return mock;
}

for (const alto of [null, 640]) {
  test(`el botón Entrar en 3D se ve sin desplazar${alto ? ' en pantalla baja' : ''}`, async ({ page, viewport }) => {
    test.setTimeout(90000);
    if (alto) await page.setViewportSize({ width: 360, height: alto });
    const mock = await abre(page);
    await page.getByRole('button', { name: 'Al edificio' }).click();
    await page.getByRole('dialog', { name: 'El edificio del puerto' }).getByRole('button', { name: 'Llamar y entrar en el piso de Bea, 1.º A' }).click();
    await expect(page.locator('.ep-canvas')).toBeVisible({ timeout: 15000 });
    const boton = page.getByRole('button', { name: 'Entrar en 3D' });
    await expect(boton).toBeVisible();
    const m = await boton.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const h = document.querySelector('.ed-head').getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, alto: innerHeight, ancho: innerWidth, bajoEtiqueta: r.top >= h.bottom, scroll: el.closest('.ed-inside').parentElement.scrollTop };
    });
    expect(m.bajoEtiqueta).toBe(true);
    expect(m.top).toBeGreaterThanOrEqual(0);
    expect(m.bottom).toBeLessThanOrEqual(m.alto);
    expect(m.left).toBeGreaterThanOrEqual(0);
    expect(m.right).toBeLessThanOrEqual(m.ancho);
    expect(m.bottom - m.top).toBeGreaterThanOrEqual(44);
    await boton.click();
    await expect(page.locator('.ed-visita3d .plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
    // Permisos de visitante y salida
    const dentro = page.locator('.ed-visita3d');
    await expect(dentro.getByRole('button', { name: /Registrar/ })).toHaveCount(0);
    await expect(dentro.getByRole('button', { name: 'Decorar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Volver al portal' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver en isométrica' })).toBeVisible();
    const guardados = mock.db.pisos.find((p) => p.user_id === BEA.id).layout.items.length;
    expect(guardados).toBe(DE_BEA.length);
    const c = (await page.evaluate(() => window.__pisoLab().debug())).camera;
    expect(c.inside).toEqual([]);
    expect(c.seatVisible).toBe(false);
    await page.getByRole('button', { name: 'Volver al portal' }).click();
    await expect(page.getByRole('dialog', { name: 'El edificio del puerto' })).toBeVisible();
    void viewport;
  });
}

test('el toque del libro llega con objetos en la mesa', async ({ page }) => {
  test.setTimeout(90000);
  await abre(page);
  await page.waitForTimeout(1200);
  const at = await page.evaluate(() => window.__pisoLab().screenOf('libro'));
  await page.mouse.click(at.x, at.y);
  await expect(page.getByRole('dialog').filter({ hasText: 'Guardar lectura' }).last()).toBeVisible();
});
