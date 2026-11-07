// 1.88 · Identidad de los libros de la estantería del piso: cada ejemplar dibujado es el modelo del libro de la mesa con la
// portada real de su edición en la tapa; solo se piden las portadas de los ejemplares que se ven, en miniatura; con 1000 libros sigue el límite de la
// estantería y la biblioteca completa sigue a mano. Piloto con biblioteca de demostración (portadas locales, el 15 % con
// una dirección que falla). Emulación: Chromium dibuja WebGL por software; no equivale a un teléfono real.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'qa-report/piso-lomos';

test.beforeEach(async ({ page }, info) => {
  test.skip(!/(chromium|webkit)-390x844$/.test(info.project.name), 'móvil vertical');
  mkdirSync(OUT, { recursive: true });
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
});

const debug = (page) => page.evaluate(() => window.__pisoLab().debug());

test('1000 libros: solo las portadas de los ejemplares que se ven, en miniatura, y cada uno con la suya', async ({ page }, info) => {
  const covers = [];
  page.on('request', (r) => {
    if (r.url().includes('/lab/covers/')) covers.push(r.url());
  });
  await page.goto('/?piloto=piso&biblioteca=1000');
  await page.getByRole('button', { name: /^Entrar en tu piso, 1\.º A/ }).click();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().windows.length > 0, null, { timeout: 30000 });
  // Cada tapa cambia la tela por su portada cuando llega
  await page.waitForFunction(() => window.__pisoLab().debug().shelf.faces > 0, null, { timeout: 20000 });
  const view = await debug(page);
  const shown = view.shelf.books.length;
  expect(shown).toBeLessThanOrEqual(30);
  // Cada dirección pedida es de un libro que se ve (la cubierta de la mesa incluida); nada de los otros novecientos y pico
  const asked = new Set(covers.map((u) => new URL(u).searchParams.get('n')));
  expect(asked.size).toBeLessThanOrEqual(shown + 1);
  const shownIds = new Set(view.shelf.books.map((id) => id.replace('lab-', '')));
  for (const n of asked) expect(shownIds.has(n)).toBe(true);
  // Con portada, la suya; sin ella o si falla, la tela con su título. Ningún libro de prueba trae un lomo auténtico
  expect(view.shelf.faces).toBeGreaterThan(0);
  expect(view.shelf.faces).toBeLessThanOrEqual(shown);
  expect(view.shelf.spines).toBe(0);
  await page.getByRole('button', { name: 'Ver la balda' }).click();
  await expect(page.locator('.plab-spot')).not.toHaveCount(0);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/balda-${info.project.name}.png` });
  // La biblioteca completa, a mano
  await expect(page.getByRole('button', { name: /^Buscar en toda la biblioteca, 1000 libros/ })).toBeVisible();
});

test('al elegir un ejemplar sale y gira hasta su portada; con movimiento reducido, sin animación', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?piloto=piso&biblioteca=1000');
  await page.getByRole('button', { name: /^Entrar en tu piso, 1\.º A/ }).click();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().windows.length > 0, null, { timeout: 30000 });
  await page.getByRole('button', { name: 'Ver la balda' }).click();
  const spot = page.locator('.plab-spot').last();
  await expect(spot).toBeVisible();
  await spot.click();
  await expect(page.locator('.plab-pick')).toBeVisible();
  // Sin esperar fotogramas: ya está fuera y de cara
  const shown = await page.evaluate(() => window.__pisoLab().debug().shelf.shown);
  expect(shown).toHaveLength(1);
  await page.screenshot({ path: `${OUT}/elegido-reducido-${test.info().project.name}.png` });
});
