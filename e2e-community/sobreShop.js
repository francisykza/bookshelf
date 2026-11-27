// Ayudas de las pruebas del sobre en el mostrador (1.76): abrir la tienda del bajo con Supabase simulado y la carpeta
// de las capturas de cada proyecto.
import { expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { alEdificio } from './entrada';

export const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
export const dirOf = (info) => {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  return dir;
};

export async function openShop(page) {
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 120, sin_raro: 3 } },
    piso_inventario: { [ANA.id]: { sillon: 1, silla: 2, 'mesa-baja': 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/');
  await alEdificio(page);
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Entrar en la tienda del bajo' }).click({ timeout: 15000 });
  const shop = page.getByRole('dialog', { name: 'La tienda del bajo' });
  await expect(shop.locator('.ts-wallet strong')).toHaveText('120');
  return { mock, shop };
}
