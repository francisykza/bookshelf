// Puerto Pixel (ajuste v3) · Vídeo silencioso del flujo real: ordenador de día, Aplicaciones, volver, registro, guardar y confirmar; y ordenador y registro de noche.
// Piso de prueba, Chromium emulado a 390 × 844. El vídeo no sustituye a las pruebas.
import { expect, test } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { abrirCasa } from './v190-apoyo';

const DIR = join('qa-report', 'pixel-v3');
const pausa = (page, ms) => page.waitForTimeout(ms);

async function portada(page, selector) {
  await page.waitForFunction((css) => {
    const lienzo = document.querySelector(css);
    return lienzo && lienzo.width > 1 && lienzo.style.opacity !== '0';
  }, selector, { timeout: 20000 });
}

async function ordenador(page) {
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await pausa(page, 900);
  await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible({ timeout: 12000 });
  await portada(page, '.pp-reading__cover canvas');
}

async function registrar(page, paginas) {
  await page.locator('.pp-reading').getByRole('button', { name: /^Registrar lectura de / }).click();
  await expect(page.locator('.log-sheet')).toBeVisible();
  await portada(page, '.log-pick__trigger .log-pick__cover canvas');
  await pausa(page, 1800);
  await page.getByRole('button', { name: 'Sumar uno' }).click();
  await pausa(page, 500);
  await page.getByRole('button', { name: 'Sumar uno' }).click();
  await pausa(page, 700);
  const campo = page.locator('.reading-form__input input');
  await campo.fill('');
  await campo.pressSequentially(paginas, { delay: 300 });
  await pausa(page, 2000);
  await page.locator('.reading-form__save').click();
  await expect(page.locator('.log-toast')).toBeVisible();
  await pausa(page, 2800);
}

test('ordenador y registro, de día y de noche', async ({ browser }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'el vídeo, a 390');
  test.setTimeout(180000);
  mkdirSync(DIR, { recursive: true });
  const context = await browser.newContext({ baseURL: 'http://localhost:5196', locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 }, recordVideo: { dir: join(DIR, 'bruto'), size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  await abrirCasa(page);
  await pausa(page, 1200);
  await ordenador(page);
  await pausa(page, 3200);
  await page.getByRole('button', { name: 'Aplicaciones' }).click();
  await pausa(page, 1600);
  await page.locator('.pp-apps').evaluate((el) => el.scrollTo({ top: 260, behavior: 'smooth' }));
  await pausa(page, 2200);
  await page.getByRole('button', { name: 'Volver al escritorio' }).click();
  await pausa(page, 1800);
  await registrar(page, '12');
  await page.getByRole('button', { name: 'Salir del ordenador' }).click();
  await pausa(page, 1800);
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await pausa(page, 700);
  await page.getByRole('button', { name: 'Ver de noche' }).click();
  await pausa(page, 1800);
  await ordenador(page);
  await pausa(page, 3000);
  await registrar(page, '8');
  await page.getByRole('button', { name: 'Salir del ordenador' }).click();
  await pausa(page, 1800);
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join(DIR, 'bruto', 'recorrido.webm'));
});
