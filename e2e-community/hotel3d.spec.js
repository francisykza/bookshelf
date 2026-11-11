// «Exteriores en 3D», bloque 3 (11-11-2026): el Gran Hotel del Puerto desde la plaza (src/features/edificio/hotel/hotel3d.js),
// en la página de desarrollo dev/hotel3d.html. Capturas en qa-report/hotel3d/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join('qa-report', 'hotel3d');

test('el Gran Hotel en 3D desde la plaza', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844' && info.project.name !== 'chromium-1440x900', 'Chromium a 390 y en escritorio');
  mkdirSync(DIR, { recursive: true });
  const tag = info.project.name.replace('chromium-', '');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/dev/hotel3d.html');
  await page.waitForFunction(() => window.__hotel3d?.renders() > 0, null, { timeout: 30000 });
  console.log('hotel3d', JSON.stringify({ ...(await page.evaluate(() => window.__hotel3d.stats())), ms: await page.evaluate(() => window.__hotel3dMs) }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(DIR, `1-frente-${tag}.png`) });
  for (const [name, yaw, dp] of [
    ['izquierda', -0.5, 0],
    ['derecha', 0.5, 0],
    ['abajo', 0, -0.5],
    ['arriba', 0, 0.5],
  ]) {
    await page.evaluate(([y, d]) => window.__hotel3d.setView(y, window.__hotel3d.pitchHome() + d), [yaw, dp]);
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(DIR, `1-${name}-${tag}.png`) });
  }
  // Junto a la limusina, mirando hacia arriba
  await page.evaluate(() => window.__hotel3d.walk([{ spot: 'curb', yaw: -0.15, pitch: 0.75 }], { ms: 10 }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(DIR, `2-junto-a-la-limusina-${tag}.png`) });
  expect(errors).toEqual([]);
});

test('antes: el Gran Hotel en 2D', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'Chromium a 390');
  mkdirSync(DIR, { recursive: true });
  await page.goto('/dev/hotel-concepto.html');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(DIR, '0-antes-2d-390x844.png') });
});

// El vídeo para revisar: se mira alrededor (los focos barren solos), abajo a la plaza mojada, arriba a la aguja y se anda
// hasta la limusina
test('vídeo: el Gran Hotel en 3D', async ({ browser }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'Chromium a 390');
  test.setTimeout(90000);
  mkdirSync(DIR, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: join(DIR, 'video'), size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  await page.goto('/dev/hotel3d.html');
  await page.waitForFunction(() => window.__hotel3d?.renders() > 0, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  for (const [yaw, dp, ms] of [
    [-0.5, 0, 1800],
    [0.5, 0, 2600],
    [0, -0.5, 1800],
    [0, 0.5, 2200],
    [0, 0, 1400],
  ]) {
    await page.evaluate(([y, d, m]) => window.__hotel3d.glideTo(y, d, m), [yaw, dp, ms]);
    await page.waitForTimeout(ms + 1200);
  }
  await page.evaluate(() => window.__hotel3d.walk([{ spot: 'curb', yaw: -0.15, pitch: 0.75 }], { ms: 2200 }));
  await page.waitForTimeout(4500);
  const video = page.video();
  await context.close();
  await video.saveAs(join(DIR, 'hotel3d-390x844.webm'));
});
