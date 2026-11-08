// 1.90 · Capturas comparables de día y de noche del menú, el escritorio, el calendario, el registro y Sonido, con datos de prueba.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { abrirCasa } from './v190-apoyo';

for (const tema of ['dia', 'noche']) {
  test(`pantallas de ${tema}`, async ({ page }, info) => {
    test.skip(!/chromium-(320|360|390|430|1440)/.test(info.project.name), 'solo Chromium');
    test.setTimeout(90000);
    const dir = join('qa-report', 'v190', 'capturas', info.project.name);
    mkdirSync(dir, { recursive: true });
    const foto = async (n) => {
      await page.waitForTimeout(350);
      await page.screenshot({ path: join(dir, `${tema}-${n}.png`) });
      const ancho = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
      expect(ancho[0], `scroll horizontal en ${n}`).toBeLessThanOrEqual(ancho[1]);
    };
    await abrirCasa(page);
    if (tema === 'noche') {
      await page.getByRole('button', { name: 'Menú de accesos' }).click();
      await page.getByRole('button', { name: 'Ver de noche' }).click();
      await page.waitForTimeout(900);
    }
    await foto('habitacion');
    await page.getByRole('button', { name: 'Menú de accesos' }).click();
    await foto('menu');
    await page.getByRole('button', { name: 'Sonido' }).click();
    await expect(page.getByRole('heading', { name: 'Radio del puerto' })).toBeVisible();
    await foto('sonido');
    await page.getByRole('button', { name: 'Cerrar Sonido' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Menú de accesos' }).click();
    await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible({ timeout: 12000 });
    await page.waitForFunction(() => document.querySelector('.pp-reading__cover canvas')?.width > 1, null, { timeout: 15000 }).catch(() => {});
    await foto('escritorio');
    await page.getByRole('button', { name: 'Calendario' }).click();
    await expect(page.locator('.port-cal')).toBeVisible();
    await foto('calendario');
    await page.locator('.port-cal__list').getByRole('button', { name: /Registrar/ }).click();
    await expect(page.locator('.log-sheet')).toBeVisible();
    await page.getByRole('radio').first().click();
    await page.locator('.reading-form__input input').fill('12');
    await page.waitForTimeout(2500);
    await foto('registro');
  });
}
