// Play Store (docs/qa/play-store.md §2): borrar la cuenta desde «Tu cuenta», la edad y las normas al crearla, y las páginas
// legales. Contra el simulador de Supabase (`cuenta_borrar` se simula aquí; las reglas reales, en cuenta-borrar.rls.test.js).
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { SUPABASE } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };

test.use({ video: 'on' });

async function shot(page, info, name) {
  const dir = join('qa-report', 'play-store', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

async function ready(page) {
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
}

test('borrar la cuenta: hay que escribir BORRAR; después, sin sesión y con lo del dispositivo', async ({ page }, info) => {
  const mock = createMockSupabase();
  await mock.attach(page, ANA);
  const llamadas = [];
  await page.route(`${SUPABASE}/rest/v1/rpc/cuenta_borrar`, async (route) => {
    llamadas.push(route.request().postDataJSON());
    await new Promise((r) => setTimeout(r, 400));
    return route.fulfill({ status: 204, body: '' });
  });
  await ready(page);
  await page.getByRole('button', { name: /^Tu cuenta y copias/ }).click();
  await expect(page.getByText('Has entrado como')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Política de privacidad' })).toHaveAttribute('href', '/legal/privacidad.html');

  await page.getByRole('button', { name: 'Borrar mi cuenta' }).click();
  const borrar = page.getByRole('button', { name: 'Borrar mi cuenta para siempre' });
  await expect(borrar).toBeDisabled();
  await page.getByLabel('Escribe BORRAR para confirmar').fill('borra');
  await expect(borrar).toBeDisabled();
  await page.getByRole('form', { name: 'Borrar mi cuenta' }).scrollIntoViewIfNeeded();
  await shot(page, info, '1-borrar-aviso');
  // «No, volver» lo cierra sin borrar nada
  await page.getByRole('button', { name: 'No, volver' }).click();
  await expect(borrar).toHaveCount(0);
  expect(llamadas).toEqual([]);

  await page.getByRole('button', { name: 'Borrar mi cuenta' }).click();
  await page.getByLabel('Escribe BORRAR para confirmar').fill('borrar');
  await expect(borrar).toBeEnabled();
  await page.getByRole('form', { name: 'Borrar mi cuenta' }).scrollIntoViewIfNeeded();
  await shot(page, info, '2-borrar-listo');
  await borrar.click();
  await expect(page.getByText('Tu cuenta se ha borrado.')).toBeVisible();
  expect(llamadas).toEqual([{ confirmacion: 'BORRAR' }]);
  // Sin sesión: vuelve el formulario de entrar, y la sesión ya no está guardada en el dispositivo
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('bookshelf:auth'))).toBeNull();
  await page.getByText('Tu cuenta se ha borrado.').scrollIntoViewIfNeeded();
  await shot(page, info, '3-borrada');
});

test('si falla el borrado, lo dice y no cierra la sesión', async ({ page }) => {
  const mock = createMockSupabase();
  await mock.attach(page, ANA);
  await page.route(`${SUPABASE}/rest/v1/rpc/cuenta_borrar`, (route) => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: 'cuenta:sesion' }) }));
  await ready(page);
  await page.getByRole('button', { name: /^Tu cuenta y copias/ }).click();
  await page.getByRole('button', { name: 'Borrar mi cuenta' }).click();
  await page.getByLabel('Escribe BORRAR para confirmar').fill('BORRAR');
  await page.getByRole('button', { name: 'Borrar mi cuenta para siempre' }).click();
  await expect(page.getByRole('alert')).toContainText('No se ha podido borrar la cuenta');
  await expect(page.getByText('Has entrado como')).toBeVisible();
});

test('crear la cuenta pide 16 años y aceptar las normas', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('bookshelf_onboarding_done', 'true'));
  await page.route(`${SUPABASE}/**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ready(page);
  await page.getByRole('button', { name: /^Tu cuenta y copias/ }).click();
  await page.getByRole('button', { name: '¿Primera vez? Crea tu cuenta' }).click();
  await page.getByLabel('Correo').fill('nueva@ejemplo.test');
  await page.getByLabel('Contraseña').fill('una-clave-larga');
  const crear = page.getByRole('button', { name: 'Crear mi cuenta' });
  await expect(crear).toBeDisabled();
  await expect(page.getByRole('link', { name: 'normas de la comunidad', exact: true })).toHaveAttribute('href', '/legal/normas.html');
  await page.getByRole('checkbox', { name: /Tengo 16 años o más/ }).check();
  await expect(crear).toBeEnabled();
  await page.getByRole('button', { name: 'Crear mi cuenta' }).scrollIntoViewIfNeeded();
  await shot(page, info, '4-alta');
  // Al volver a «entrar», la casilla no hace falta
  await page.getByRole('button', { name: 'Ya tengo cuenta: entrar' }).click();
  await expect(page.getByRole('checkbox', { name: /Tengo 16 años o más/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled();
});

test('las páginas legales se abren solas, sin la app, y enlazan entre sí', async ({ page }, info) => {
  for (const [ruta, titulo] of [
    ['/legal/privacidad.html', 'Política de privacidad'],
    ['/legal/normas.html', 'Normas de la comunidad'],
    ['/legal/aviso-legal.html', 'Aviso legal'],
    ['/legal/borrar-cuenta.html', 'Borrar tu cuenta de Libotown'],
  ]) {
    await page.goto(ruta);
    await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
    // Sin desplazamiento horizontal
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await shot(page, info, `5-${ruta.split('/').pop().replace('.html', '')}`);
  }
  await expect(page.getByText('BORRAR', { exact: true })).toBeVisible();
});
