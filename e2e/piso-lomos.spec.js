// 1.88 · Identidad de los libros de la estantería del piso: cada lomo dibujado lleva los colores de su portada, su título y
// su autor; solo se piden las portadas de los ejemplares que se ven, en miniatura; con 1000 libros sigue el límite de la
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

test('1000 libros: solo las portadas de los lomos que se ven, en miniatura, y cada lomo con su cara', async ({ page }, info) => {
  const covers = [];
  page.on('request', (r) => {
    if (r.url().includes('/lab/covers/')) covers.push(r.url());
  });
  await page.goto('/?piloto=piso&biblioteca=1000');
  await page.getByRole('button', { name: /^Entrar en tu piso, 1\.º A/ }).click();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().windows.length > 0, null, { timeout: 30000 });
  // Los lomos se repintan una vez, cuando han llegado las caras
  await page.waitForFunction(() => window.__pisoLab().debug().shelf.looks > 0, null, { timeout: 20000 });
  const view = await debug(page);
  const shown = view.shelf.books.length;
  expect(shown).toBeLessThanOrEqual(30);
  // Cada dirección pedida es de un libro que se ve (la cubierta de la mesa incluida); nada de los otros novecientos y pico
  const asked = new Set(covers.map((u) => new URL(u).searchParams.get('n')));
  expect(asked.size).toBeLessThanOrEqual(shown + 1);
  const shownIds = new Set(view.shelf.books.map((id) => id.replace('lab-', '')));
  for (const n of asked) expect(shownIds.has(n)).toBe(true);
  // Con portada: su cara; sin ella o si falla, el color de siempre
  expect(view.shelf.looks).toBeGreaterThan(0);
  expect(view.shelf.looks).toBeLessThanOrEqual(shown - 1);
  await page.getByRole('button', { name: 'Ver la balda' }).click();
  await expect(page.locator('.plab-spot')).not.toHaveCount(0);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/balda-${info.project.name}.png` });
  // La biblioteca completa, a mano
  await expect(page.getByRole('button', { name: /^Buscar en toda la biblioteca, 1000 libros/ })).toBeVisible();
});
