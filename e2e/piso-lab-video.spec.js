// Vídeo continuo del piloto en móvil vertical: portal → piso → registrar → decorar → mover lámpara → volver al sillón →
// portal. Emulación con la biblioteca de ejemplo; el recorrido es una sola toma y deja la prueba de cada paso.
import { expect, test } from '@playwright/test';

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

test('recorrido continuo', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'una sola toma');
  test.setTimeout(120000);
  await page.route('https://covers.openlibrary.org/**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  const pause = (ms = 1100) => page.waitForTimeout(ms);
  await page.goto('/?piloto=piso');
  const door = page.getByRole('button', { name: /^Entrar en tu piso/ });
  await door.waitFor();
  await pause(1800);

  await door.click();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().windows.length > 0, null, { timeout: 30000 });
  await pause();
  const yaw = await page.evaluate(() => window.__pisoLab().measureYaw(2600));
  expect(yaw.frames).toBeGreaterThan(0);
  await pause(500);

  await page.getByRole('button', { name: /^Registrar lectura de Circe/ }).click();
  await expect(page.getByRole('dialog').filter({ hasText: 'Circe' }).last()).toBeVisible();
  await pause(1800);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Tu piso · 1.º A' })).toBeVisible();
  await pause(800);

  const before = (await page.evaluate(() => window.__pisoLab().debug())).lamps[0];
  await page.getByRole('button', { name: 'Decorar' }).click();
  await page.waitForFunction(() => window.__edificioPiso);
  await pause(1400);
  const point = await page.evaluate((uid) => window.__edificioPiso.screenOfItem(uid), before.uid);
  await page.mouse.click(point.x, point.y);
  await pause(700);
  await page.locator('.ep-canvas').focus();
  for (const key of ['ArrowRight', 'ArrowRight', 'r']) {
    await page.keyboard.press(key);
    await pause(600);
  }
  await pause(600);

  await page.getByRole('button', { name: 'Volver al sillón' }).click();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().windows.length > 0, null, { timeout: 30000 });
  const after = (await page.evaluate(() => window.__pisoLab().debug())).lamps[0];
  expect([after.x, after.rot]).toEqual([before.x + 2, 1]);
  await pause(1800);

  await page.getByRole('button', { name: 'Al portal' }).click();
  await expect(door).toBeFocused();
  await pause(1500);
});
