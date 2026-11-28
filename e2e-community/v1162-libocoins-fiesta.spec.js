// 1.162 · Libocoins, bloque 3 (docs/qa/libocoins.md): al ganarlas, Libo lo celebra. Cobras una misión de la semana en el
// ordenador (con el ordenador encima, Libo no se ve y no celebra nada) y, al volver a tu piso, las monedas saltan a la suya,
// Libo pone su pose de celebrar, sale «+12» y la cifra sube de 60 a 72. Con movimiento reducido, solo cambia la cifra.
// Supabase simulado y una cuenta de prueba (ninguna cuenta real). Emulación: no equivale a un Android ni a un iPhone reales.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NEIGHBOURS } from '../src/features/edificio/demo.js';
import { createMockSupabase } from './mockSupabase';
import { abrir } from './entrada';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const DIR = join('qa-report', 'v1162-libocoins-fiesta');

test.use({ video: 'on' });

function seed() {
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '1A' });
  mock.db.pisos.push({ user_id: ANA.id, layout: NEIGHBOURS.find((n) => n.id === '1a').room() });
  mock.db.piso_cuentas[ANA.id] = { inicio_elegido: true, tickets: 60, sin_raro: 0 };
  return mock;
}
const shot = (page, info, name) => page.screenshot({ path: join(DIR, info.project.name, `${name}.png`) });
const moneda = (page) => page.locator('.libo-saldo');
const cifra = (page) => page.locator('.libo-saldo__cifra');

/** Tu piso, con dos sesiones de lectura esta semana (la misión de las sesiones, cumplida). */
async function piso(page, mock) {
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.addInitScript(() => {
    try {
      const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
      if (!st || st.progress.pomodoros.length >= 2) return;
      const now = new Date().toISOString();
      st.progress.pomodoros = [...st.progress.pomodoros, { at: now, minutes: 25 }, { at: now, minutes: 25 }];
      localStorage.setItem('bookshelf:v1', JSON.stringify(st));
    } catch {
      // Sin estado guardado, la prueba fallará más abajo con un mensaje claro
    }
  });
  await page.reload();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await expect(moneda(page)).toHaveAttribute('data-saldo', '60', { timeout: 15000 });
}

/** Cobra «Completa 2 sesiones de lectura cozy» (12) en el ordenador. */
async function cobrar(page) {
  await abrir(page, { type: 'laptop', tab: 'missions' });
  const laptop = page.getByRole('dialog').first();
  await laptop.getByRole('tab', { name: /Misiones/ }).click();
  await expect(laptop.locator('.pc-tickets b')).toHaveText('60', { timeout: 15000 });
  const row = laptop.locator('.pc-mission', { hasText: 'Completa 2 sesiones de lectura cozy' });
  await row.getByRole('button', { name: /Cobrar 12/ }).click();
  await expect(laptop.locator('.pc-tickets b')).toHaveText('72');
  return laptop;
}

test.beforeEach(async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844)$|^webkit-390x844$/.test(info.project.name), 'móvil vertical');
  mkdirSync(join(DIR, info.project.name), { recursive: true });
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});

test('cobras una misión en el ordenador y, al volver, Libo lo celebra: monedas, su pose, «+12» y la cifra sube', async ({ page }, info) => {
  test.setTimeout(150000);
  const mock = seed();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await piso(page, mock);
  await page.waitForTimeout(500);
  await shot(page, info, '1-antes');

  // Con el ordenador encima, Libo no se ve: lo ganado espera
  await cobrar(page);
  await page.waitForTimeout(1500);
  await expect(page.locator('.libo-saldo[data-fiesta]')).toHaveCount(0);

  // Al volver a tu piso: la fiesta
  await page.goBack();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.libo-saldo[data-fiesta]')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.libo-saldo__salta')).toHaveCount(3);
  await expect(page.locator('.libo-saldo__mas')).toHaveText('+12');
  await expect(page.locator('.libo-rincon__gato img')).toHaveAttribute('data-pose', 'celebra');
  await expect(page.getByRole('status').filter({ hasText: 'Has ganado 12 Libocoins' })).toHaveCount(1);
  await page.waitForTimeout(420);
  await shot(page, info, '2-saltan');
  await page.waitForTimeout(500);
  await shot(page, info, '3-cae');
  await expect(cifra(page)).toHaveText('72', { timeout: 3000 });
  await page.waitForTimeout(250);
  await shot(page, info, '4-sube');
  // Se acaba sola, y no se repite
  await expect(page.locator('.libo-saldo[data-fiesta]')).toHaveCount(0, { timeout: 5000 });
  await expect(cifra(page)).toHaveText('72');
  await expect(moneda(page)).toHaveAccessibleName('Tus Libocoins: 72 Libocoins');
  await page.waitForTimeout(1500);
  await expect(page.locator('.libo-saldo[data-fiesta]')).toHaveCount(0);
  expect(errores).toEqual([]);
});

test('con movimiento reducido, solo cambia la cifra', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), 'una vez basta');
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const mock = seed();
  await piso(page, mock);
  await cobrar(page);
  await page.goBack();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await expect(cifra(page)).toHaveText('72', { timeout: 5000 });
  await expect(page.locator('.libo-saldo[data-fiesta]')).toHaveCount(0);
  await expect(page.locator('.libo-saldo__salta')).toHaveCount(0);
  await expect(page.locator('.libo-rincon__gato img')).not.toHaveAttribute('data-pose', 'celebra');
  await shot(page, info, '5-reducido');
});
