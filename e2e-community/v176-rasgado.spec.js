// 1.76 (SPEC §76) · Grabación breve del rasgado del sobre a 360 px (Chromium, emulación): la tira se desprende entera
// por la perforación y queda en la madera, y la primera carta sale por la abertura. El vídeo queda en qa-report.
import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { dirOf, openShop } from './sobreShop';
import { SOBRES_CERRADOS } from '../src/features/edificio/economy.js';

test.use({ video: { mode: 'on', size: { width: 360, height: 800 } } });

test('el rasgado del sobre, grabado a 360', async ({ page }, info) => {
  test.skip(SOBRES_CERRADOS, 'Sobres cerrados por reforma (9-11-2026): vuelve al reabrirlos');
  test.skip(!/chromium-360x800/.test(info.project.name), 'Chromium 360');
  test.setTimeout(90000);
  const { mock, shop } = await openShop(page);
  mock.db.piso_sorteo = ['sofa', 'gato', 'radio', 'lampara-pie', 'planta-pequena'];
  await shop.getByRole('button', { name: /^Abrir 5 · 45/ }).click();
  const gacha = page.locator('.gacha');
  await page.waitForTimeout(1200);
  await gacha.getByRole('button', { name: /^Rasgar el sobre/ }).click();
  await expect(gacha.getByText('1 de 5 reveladas')).toBeVisible({ timeout: 5000 });
  // Primero el sofá (asoma, va a su sitio y se da la vuelta); después las otras cuatro, en su sitio
  await page.waitForTimeout(1400);
  await gacha.getByRole('button', { name: 'Revelar todas' }).click();
  await expect(gacha.getByRole('status')).toContainText('Te llevas 5 muebles', { timeout: 6000 });
  await page.waitForTimeout(900);
  await gacha.getByRole('button', { name: 'Gato dormido, raro, nuevo' }).click();
  await page.waitForTimeout(900);
  const video = page.video();
  await page.close();
  await video.saveAs(join(dirOf(info), 'v176-rasgado.webm'));
});
