// Puerto Pixel · capturas comparables de diario, estadísticas, biblioteca y decorar, de día y de noche, con datos de prueba.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { abrirCasa } from './v190-apoyo';

const menu = (page) => page.getByRole('button', { name: 'Menú de accesos' });

for (const tema of ['dia', 'noche']) {
  test(`pantallas de ${tema}`, async ({ page }, info) => {
    test.skip(!/chromium-(320|390|1440)/.test(info.project.name), 'solo Chromium');
    test.setTimeout(120000);
    const dir = join('qa-report', 'pixel-v5', 'capturas', info.project.name);
    mkdirSync(dir, { recursive: true });
    const foto = async (n) => {
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(dir, `${tema}-${n}.png`) });
      const [ancho, ventana] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
      expect(ancho, `scroll horizontal en ${n}`).toBeLessThanOrEqual(ventana);
    };
    await abrirCasa(page);
    if (tema === 'noche') {
      await menu(page).click();
      await page.getByRole('button', { name: 'Ver de noche' }).click();
      await page.waitForTimeout(900);
    }
    await menu(page).click();
    await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible({ timeout: 12000 });
    await page.getByRole('button', { name: 'Mi diario' }).click();
    await page.waitForTimeout(600);
    await foto('diario');
    const registro = page.locator('.pcd-book__log');
    expect(await registro.evaluate((n) => n.scrollWidth <= n.clientWidth), 'el botón de registrar no se corta').toBe(true);
    await page.getByRole('button', { name: 'Volver al escritorio' }).click();
    await page.getByRole('button', { name: 'Aplicaciones' }).click();
    await page.locator('.pp-apps').getByRole('button', { name: 'Notas' }).click();
    await page.waitForTimeout(600);
    await foto('diario-notas');
    await page.getByRole('button', { name: 'Volver al escritorio' }).click();
    await page.locator('.pp-apps').getByRole('button', { name: 'Volver al escritorio' }).click();
    await page.getByRole('button', { name: 'Estadísticas' }).click();
    await page.waitForTimeout(600);
    await foto('estadisticas');
    await page.getByRole('button', { name: 'Salir del ordenador' }).click();
    await page.waitForTimeout(500);
    await menu(page).click();
    await page.getByRole('button', { name: 'Mi biblioteca' }).click();
    await page.waitForTimeout(1500);
    await foto('biblioteca');
    expect(await page.locator('.plab-row__exhibit').first().evaluate((n) => getComputedStyle(n).color), 'Exponer se lee').toBe('rgb(58, 36, 21)');
    expect(await page.locator('.plab-library__top .px-btn').evaluate((n) => getComputedStyle(n).color), 'Volver se lee').toBe('rgb(58, 36, 21)');
    await page.goBack();
    await page.waitForTimeout(1200);
    await menu(page).click();
    await page.locator('.port-menu__sheet').getByRole('button', { name: 'Decorar' }).click();
    await page.waitForTimeout(1800);
    await foto('decorar');
  });
}

test('vídeo: diario, notas, estadísticas, biblioteca y decorar, de día y de noche', async ({ browser }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'el vídeo, a 390');
  test.setTimeout(240000);
  const context = await browser.newContext({ baseURL: 'http://localhost:5196', locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, recordVideo: { dir: join('qa-report', 'pixel-v5', 'bruto'), size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const pausa = (ms) => page.waitForTimeout(ms);
  const vuelta = async () => {
    await menu(page).click();
    await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible({ timeout: 12000 });
    await pausa(1200);
    await page.getByRole('button', { name: 'Mi diario' }).click();
    await pausa(2500);
    await page.locator('.pc-win:not([hidden]) .pc-win__body').evaluate((n) => n.scrollTo({ top: 420, behavior: 'smooth' }));
    await pausa(1800);
    await page.getByRole('button', { name: 'Volver al escritorio' }).click();
    await pausa(800);
    await page.getByRole('button', { name: 'Estadísticas' }).click();
    await pausa(2500);
    await page.locator('.pc-win:not([hidden]) .pc-win__body').evaluate((n) => n.scrollTo({ top: 520, behavior: 'smooth' }));
    await pausa(1800);
    await page.getByRole('button', { name: 'Salir del ordenador' }).click();
    await pausa(900);
    await menu(page).click();
    await page.getByRole('button', { name: 'Mi biblioteca' }).click();
    await pausa(2500);
    await page.getByRole('searchbox').pressSequentially('el', { delay: 250 });
    await pausa(1500);
    await page.getByRole('searchbox').fill('');
    await page.getByRole('button', { name: 'Leído', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'libro' })).toBeVisible();
    await pausa(1500);
    await page.getByRole('button', { name: 'Todos', exact: true }).click();
    await pausa(800);
    await page.goBack();
    await pausa(1200);
    await menu(page).click();
    await page.locator('.port-menu__sheet').getByRole('button', { name: 'Decorar' }).click();
    await pausa(2800);
    await page.getByRole('button', { name: 'Terminar' }).click();
    await pausa(1000);
    if (await page.getByRole('button', { name: 'Volver al sillón' }).isVisible()) await page.getByRole('button', { name: 'Volver al sillón' }).click();
    await pausa(1500);
  };
  await abrirCasa(page);
  await pausa(1200);
  await vuelta();
  await menu(page).click();
  await page.getByRole('button', { name: 'Ver de noche' }).click();
  await pausa(1500);
  await vuelta();
  const video = page.video();
  await context.close();
  (await import('node:fs')).copyFileSync(await video.path(), join('qa-report', 'pixel-v5', 'recorrido.webm'));
});
