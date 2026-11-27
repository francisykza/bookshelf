// 1.157 · Fuera la habitación ilustrada (docs/qa/borrar-habitacion-ilustrada.md), con Supabase simulado. Quien llega sin
// cuenta ve la pantalla de entrada y Mi biblioteca; con cuenta, su piso; quien tenía elegida la experiencia anterior en su
// móvil (`bookshelf:inicio = anterior`) entra también en su piso, sin que se le borre nada. Ya no hay ningún camino a la
// habitación ilustrada. CAPTURAS=<carpeta> guarda las capturas en otra carpeta (para comparar antes y después).
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NEIGHBOURS } from '../src/features/edificio/demo.js';
import { SUPABASE, createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const DIR = process.env.CAPTURAS || join('qa-report', 'v1157');
const ANTERIOR = 'Volver a la experiencia anterior';

async function shot(page, info, name) {
  const dir = join(DIR, info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

function seed() {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout: NEIGHBOURS.find((n) => n.id === '3b').room() });
  return mock;
}

const sinSesion = (page) => page.route(`${SUPABASE}/**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
/** Nada de la habitación ilustrada en la página: ni su escenario, ni su guía, ni el botón para volver a ella. */
async function sinHabitacion(page) {
  await expect(page.locator('.scene-stage, .panorama, .room, .onboarding, [data-room]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: ANTERIOR })).toHaveCount(0);
  await expect(page.getByText('Descubrir mi habitación')).toHaveCount(0);
}

test.beforeEach(async ({ page }, info) => {
  test.skip(!/390x844|1440x900/.test(info.project.name), '390 (Chromium y WebKit) y 1440');
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});

test('sin cuenta, desde la web: la pantalla de entrada y Mi biblioteca, y Atrás vuelve a la entrada', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await sinSesion(page);
  await page.goto('/');
  await expect(page.getByText(/inicia sesión en «Tu cuenta» para entrar/)).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Abrir «Tu cuenta»' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir Mi biblioteca' })).toBeVisible();
  await sinHabitacion(page);
  await shot(page, info, '01-sin-cuenta-entrada');
  await page.getByRole('button', { name: 'Abrir Mi biblioteca' }).click();
  await expect(page.locator('main.sanctuary')).toHaveAttribute('data-view', 'SHELF_VIEW');
  await page.waitForTimeout(900);
  await shot(page, info, '02-sin-cuenta-biblioteca');
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Abrir «Tu cuenta»' })).toBeVisible({ timeout: 10000 });
  await sinHabitacion(page);
  expect(errors).toEqual([]);
});

test('con cuenta: tu piso, y en su menú ya no está la experiencia anterior', async ({ page }, info) => {
  const mock = seed();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await mock.attach(page, ANA);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tu piso · 2.º B' })).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 20000 });
  await sinHabitacion(page);
  await shot(page, info, '03-con-cuenta-piso');
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await expect(page.getByRole('button', { name: /Registrar lectura/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: ANTERIOR })).toHaveCount(0);
  await shot(page, info, '04-con-cuenta-menu');
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('quien tenía elegida la experiencia anterior entra en su piso, y su preferencia no se borra', async ({ page }, info) => {
  const mock = seed();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('bookshelf:inicio', 'anterior'));
  await mock.attach(page, ANA);
  // También con el enlace de prueba de antes
  await page.goto('/?inicio=anterior');
  await expect(page.getByRole('heading', { name: 'Tu piso · 2.º B' })).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 20000 });
  await sinHabitacion(page);
  expect(await page.evaluate(() => localStorage.getItem('bookshelf:inicio'))).toBe('anterior');
  await shot(page, info, '05-elegida-anterior-piso');
  expect(errors).toEqual([]);
});

test('quien tenía elegida la experiencia anterior y no tiene sesión ve la pantalla de entrada', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('bookshelf:inicio', 'anterior'));
  await sinSesion(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Abrir «Tu cuenta»' })).toBeVisible({ timeout: 15000 });
  await sinHabitacion(page);
  await shot(page, info, '06-elegida-anterior-sin-cuenta');
});
