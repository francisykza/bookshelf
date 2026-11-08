// 1.90 · Apoyo de las comprobaciones: un piso de prueba con Supabase simulado. Nunca toca una cuenta real.
import { expect } from '@playwright/test';
import { createMockSupabase } from './mockSupabase';

export const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
export const SALA = { v: 1, pared: 'yeso', suelo: 'tablas', items: [{ uid: 1, id: 'sillon', tono: 1, x: 4, y: 6, rot: 2 }, { uid: 2, id: 'mesa-baja', x: 4, y: 4, rot: 0, tono: 0 }, { uid: 3, id: 'estanteria', x: 6, y: 0, rot: 0, tono: 0 }, { uid: 4, id: 'escritorio', x: 0, y: 3, rot: 3, tono: 0 }, { uid: 5, id: 'ventana', pared: 'fondo', a: 3, tono: 0 }, { uid: 6, id: 'lampara-pie', x: 5, y: 2, rot: 0, tono: 0 }] };

export async function abrirCasa(page, { init } = {}) {
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  if (init) await page.addInitScript(init);
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout: SALA });
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1200);
  return mock;
}
