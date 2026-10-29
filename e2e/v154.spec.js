// QA de la 1.54.0 (SPEC §52): importación de Goodreads (elegir archivo, revisar, confirmar, resultado y buscar un
// libro importado), baldas de la habitación con toda la biblioteca y libros con la edición ebook retirada dibujados
// como bolsillo. Perfiles de prueba de Playwright (su propio localStorage) con fixtures sintéticos.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURE = join('src', 'features', 'imports', '__tests__', 'fixtures', 'goodreads-basico.csv');

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')));

async function load(page, mutate) {
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/');
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.waitForTimeout(300);
  if (mutate) {
    const seeded = await page.evaluate((fn) => {
      const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
      new Function('st', `(${fn})(st)`)(st);
      return JSON.stringify(st);
    }, mutate.toString());
    await page.addInitScript((v) => {
      if (!sessionStorage.getItem('v154')) {
        localStorage.setItem('bookshelf:v1', v);
        sessionStorage.setItem('v154', '1');
      }
    }, seeded);
    await page.reload();
  }
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.waitForTimeout(400);
}

async function openLibrary(page) {
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="shelf"]').evaluate((el) => el.click());
  await expect(page.locator('.library[data-open="true"]')).toBeVisible();
  await page.waitForTimeout(400);
}

test('importar de Goodreads: elegir, revisar, confirmar, resultado y buscar el libro importado', async ({ page }, info) => {
  test.skip(!/390x844|1440x900/.test(info.project.name), 'flujo visual en 390 × 844 y 1440 × 900');
  await load(page);
  const before = await stored(page);
  await openLibrary(page);
  await page.getByRole('button', { name: 'Vista y herramientas' }).click();
  await page.getByRole('button', { name: 'Importar biblioteca' }).click();
  const panel = page.getByRole('dialog', { name: 'Traer mis libros de Goodreads' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Tu biblioteca también puede sentirse en casa aquí.')).toBeVisible();
  await expect(panel.getByRole('link', { name: /Import and export/ })).toHaveAttribute('href', 'https://www.goodreads.com/review/import');
  await expect(panel.getByText('Los cambios posteriores en Goodreads no se sincronizan automáticamente.', { exact: false })).toBeVisible();
  // Lo de detrás queda inerte
  await expect(page.locator('main.sanctuary')).toHaveAttribute('inert', '');
  await shot(page, info, 'v154-importar-inicio');
  // Elegir archivo con el selector del dispositivo
  await panel.locator('#gr-file').setInputFiles(FIXTURE);
  await expect(panel.getByRole('heading', { name: /Revisa antes de importar/ })).toBeVisible();
  await expect(panel.getByText('Encontramos 7 libros. 1 ya estaba en tu biblioteca.')).toBeVisible();
  await shot(page, info, 'v154-importar-revision');
  // Fila «dnf»: se sugiere «Abandonado» y se acepta
  await panel.getByRole('button', { name: /parece «no terminado»/ }).click();
  const importBtn = panel.getByRole('button', { name: /^Importar 5 libros/ });
  await expect(importBtn).toBeEnabled();
  // Un control de 44 px y texto de 16 px
  const sel = panel.locator('.gr-row select').first();
  expect(await sel.evaluate((el) => [el.getBoundingClientRect().height, parseFloat(getComputedStyle(el).fontSize)])).toEqual([44, 16]);
  await importBtn.click();
  await expect(panel.getByRole('heading', { name: /Ya están en tu biblioteca/ })).toBeVisible();
  await expect(panel.locator('.gr-counts dd').first()).toHaveText('5');
  await shot(page, info, 'v154-importar-resultado');
  // Guardado de verdad, sin sesiones ni recompensas
  const after = await stored(page);
  expect(after.books.length).toBe(before.books.length + 5);
  expect(after.progress.readingLog.length).toBe(before.progress.readingLog.length);
  expect(JSON.stringify(after.progress.figures)).toBe(JSON.stringify(before.progress.figures));
  expect(after.books.filter((b) => b.source === 'goodreads').every((b) => !b.publicReview)).toBe(true);
  expect(after.books.find((b) => b.title === 'El que dejé').status).toBe('abandoned');
  // Incidencias
  await panel.getByRole('button', { name: 'Revisar incidencias' }).click();
  await expect(panel.locator('.gr-issues')).toContainText('Repite la fila 2');
  // Ver mis libros y buscar uno importado
  await panel.getByRole('button', { name: 'Ver mis libros' }).click();
  await expect(panel).toHaveCount(0);
  await page.getByLabel('Buscar en mi biblioteca').fill('mareas');
  await expect(page.locator('.library [data-book-id]').first()).toBeVisible();
  const found = await page.evaluate(() => [...document.querySelectorAll('.library [data-book-id]')].map((el) => el.getAttribute('aria-label')));
  expect(found.some((l) => /La casa de las mareas/.test(l))).toBe(true);
  await shot(page, info, 'v154-importar-busqueda');
});

test('deshacer la importación quita los libros intactos del lote (lo cambiado lo cubre la prueba de dominio 13)', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), 'solo 390');
  await load(page);
  await openLibrary(page);
  await page.getByRole('button', { name: 'Vista y herramientas' }).click();
  await page.getByRole('button', { name: 'Importar biblioteca' }).click();
  const panel = page.getByRole('dialog', { name: 'Traer mis libros de Goodreads' });
  await panel.locator('#gr-file').setInputFiles(FIXTURE);
  await panel.getByRole('button', { name: /^Importar \d+ libros/ }).click();
  await expect(panel.getByRole('heading', { name: /Ya están en tu biblioteca/ })).toBeVisible();
  await panel.getByRole('button', { name: 'Deshacer esta importación' }).click();
  await panel.getByRole('button', { name: 'Sí, deshacer' }).click();
  await expect(panel.getByRole('heading', { name: 'Importación deshecha' })).toBeVisible();
  await expect.poll(async () => (await stored(page)).books.filter((b) => b.source === 'goodreads').length).toBe(0);
});

test('baldas de la habitación: toda la biblioteca, figuras en su sitio y toque a «Todos»', async ({ page }, info) => {
  test.skip(!/390x844|1440x900/.test(info.project.name), '390 y escritorio');
  // Biblioteca sin ninguna lectura activa: solo pendientes y leídos
  await load(page, (st) => {
    st.books.forEach((b, i) => {
      b.status = i % 2 ? 'want' : 'read';
    });
  });
  const statuses = await page.evaluate(() => [...document.querySelectorAll('[data-panel="MAIN_ROOM"] .room-spine')].map((el) => el.dataset.status));
  expect(statuses.length).toBeGreaterThan(3);
  expect(new Set(statuses)).toEqual(new Set(['want', 'read']));
  // Las figuras siguen en las baldas de arriba
  const figs = await page.locator('[data-panel="MAIN_ROOM"] .room-figures, [data-panel="MAIN_ROOM"] [data-shelf="top"], [data-panel="MAIN_ROOM"] [data-shelf="middle"]').count();
  expect(figs).toBeGreaterThan(0);
  await shot(page, info, 'v154-baldas');
  // Tocar un lomo abre la librería en «Todos»
  await page.locator('[data-panel="MAIN_ROOM"] .room-spine').first().evaluate((el) => el.click());
  await expect(page.locator('.library[data-open="true"]')).toBeVisible();
  await expect(page.getByRole('radio', { name: /Todos/ })).toHaveAttribute('aria-checked', 'true');
});

test('ebook antiguo: se ve como bolsillo en Escaparate, Lomos y habitación, y conserva su porcentaje', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), 'solo 390');
  await load(page, (st) => {
    const b = st.books.find((x) => x.id === 'hail-mary');
    Object.assign(b, { editionType: 'kindle', trackBy: 'percent', currentPercent: 37.5, status: 'reading' });
  });
  await expect(page.locator('[data-panel="MAIN_ROOM"] .room-spine[data-edition="kindle"]')).toHaveCount(0);
  await openLibrary(page);
  const cover = page.locator('.library [data-book-id="hail-mary"]').first();
  await expect(cover).toHaveAttribute('data-edition', 'paperback');
  await expect(page.locator('.library .ereader__screen, .library [data-device]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Vista y herramientas' }).click();
  await page.getByRole('radio', { name: 'Lomos' }).click();
  await expect(page.locator('.library .spine[data-book-id="hail-mary"]')).toHaveAttribute('data-edition', 'paperback');
  await expect(page.locator('.library .spine__button')).toHaveCount(0);
  const st = await stored(page);
  expect(st.books.find((x) => x.id === 'hail-mary')).toMatchObject({ editionType: 'kindle', trackBy: 'percent', currentPercent: 37.5 });
});
