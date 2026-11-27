// QA de la 1.47.0 (SPEC §43–45): habitación pulida (encabezado, accesos, libro), registro con vista previa y cierre
// seguro, Ambiente compacto, cuenta fuera de Ambiente, biblioteca compacta con cinco etiquetas y estado
// «Abandonado» reversible. Con perfiles de prueba (localStorage propio de Playwright).
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { abrirBiblioteca, abrirRegistro, esperarInicio } from './entrada';

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')));
const portrait = (page) => page.viewportSize().width < page.viewportSize().height;

async function load(page) {
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/');
  await esperarInicio(page);
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.waitForTimeout(300);
}

async function openLibrary(page) {
  await abrirBiblioteca(page);
  await expect(page.locator('.library[data-open="true"]')).toBeVisible();
  await page.waitForTimeout(400);
}

const rect = (page, sel) => page.locator(sel).first().evaluate((el) => el.getBoundingClientRect().toJSON());

test('registro: «He leído 20» y «Voy por la página» dan la misma vista previa; cerrar con algo escrito pregunta', async ({ page }, info) => {
  await load(page);
  await abrirRegistro(page);
  const input = page.locator('.panel--log input[inputmode]');
  await page.getByRole('radio', { name: 'He leído' }).click();
  await expect(input).toHaveAttribute('placeholder', 'Ej. 20');
  await expect(input).toHaveValue('');
  await input.fill('20');
  const preview = page.locator('.panel--log .reading-form__preview');
  await expect(preview).toContainText('Registrarás 20 páginas');
  await expect(preview).toContainText('Pasarás de la página 184 a la 204');
  await expect(preview).toContainText('48,6 % leído');
  await expect(preview).not.toContainText('Escribe un valor');
  await page.getByRole('radio', { name: 'Voy por la página' }).click();
  await input.fill('204');
  await expect(preview).toContainText('Registrarás 20 páginas');
  await expect(preview).toContainText('Pasarás de la página 184 a la 204');
  await shot(page, info, 'v147-registro');
  // Cerrar con algo escrito no lo descarta en silencio
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog', { name: 'Cambios sin guardar' })).toBeVisible();
  await page.getByRole('button', { name: 'Seguir editando' }).click();
  await expect(input).toHaveValue('204');
  await page.locator('.log-sheet__close').click();
  await page.getByRole('button', { name: 'Descartar' }).click();
  await expect(page.locator('.panel--log')).toHaveCount(0);
  expect((await stored(page)).books.find((b) => b.title === 'Circe').currentPage).toBe(184);
});

test('biblioteca: cabecera compacta, cinco etiquetas, herramientas cerradas y búsqueda con cada estado', async ({ page }, info) => {
  await load(page);
  await openLibrary(page);
  await expect(page.locator('.lib-head--147 h1')).toHaveText(/Mi biblioteca/);
  await expect(page.locator('.library__title')).toHaveCount(0);
  const search = page.getByRole('searchbox', { name: 'Buscar en mi biblioteca' });
  await expect(search).toBeVisible();
  await expect(search).toHaveAttribute('placeholder', 'Buscar título o autor…');
  await expect(search).not.toBeFocused();
  const tabs = page.locator('[aria-label="Qué baldas ver"] [role="radio"]');
  await expect(tabs).toHaveText(['Todos', 'Leyendo', 'Pendientes', 'Leídos', 'Abandonados']);
  // Herramientas cerradas por defecto; al abrirlas empujan las baldas (no las tapan)
  await expect(page.locator('#lib-tools')).toHaveCount(0);
  const m = await page.evaluate(() => ({
    shelfTop: document.querySelector('.library .lib-shelf, .library .shelf-row')?.getBoundingClientRect().top,
    overflowX: document.documentElement.scrollWidth - innerWidth,
    small: [...document.querySelectorAll('.lib-head--147 button, .lib-head--147 input')].map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height < 40).length,
  }));
  expect(m.overflowX).toBeLessThanOrEqual(0);
  expect(m.small).toBe(0);
  if (portrait(page)) expect(m.shelfTop).toBeLessThan(page.viewportSize().height * 0.36);
  await shot(page, info, 'v147-biblioteca');
  const before = await rect(page, '.library .lib-shelf');
  await page.getByRole('button', { name: 'Vista y herramientas' }).click();
  await expect(page.getByRole('button', { name: 'Añadir libro' })).toBeVisible();
  const tools = await rect(page, '#lib-tools');
  const after = await rect(page, '.library .lib-shelf');
  expect(after.top).toBeGreaterThanOrEqual(tools.bottom - 1);
  expect(after.top).toBeGreaterThan(before.top);
  await shot(page, info, 'v147-biblioteca-herramientas');
  await page.getByRole('button', { name: 'Vista y herramientas' }).click();
  // Búsqueda combinada con cada estado, y forma de volver a verlo todo
  await search.fill('circe');
  await tabs.filter({ hasText: 'Leyendo' }).click();
  await expect(page.locator('.library [data-book-id]')).toHaveCount(1);
  for (const name of ['Pendientes', 'Leídos', 'Abandonados']) {
    await tabs.filter({ hasText: name }).click();
    await expect(tabs.filter({ hasText: name })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.library [data-book-id]')).toHaveCount(0);
    await expect(page.locator('.library')).toContainText(/No encontramos ese libro|Todavía no tienes|No has dejado/);
  }
  await page.getByRole('button', { name: 'Limpiar búsqueda' }).click();
  await tabs.filter({ hasText: 'Todos' }).click();
  expect(await page.locator('.library [data-book-id]').count()).toBeGreaterThan(5);
});

test('abandonado: se conserva la página, no cuenta como leído y se retoma como «Leyendo»', async ({ page }) => {
  await load(page);
  const before = await stored(page);
  const circe = before.books.find((b) => b.title === 'Circe');
  const readBefore = before.books.filter((b) => b.status === 'read').length;
  await openLibrary(page);
  await page.locator(`.library [data-book-id="${circe.id}"]`).click();
  await expect(page.locator('.book-sheet')).toBeVisible();
  await page.locator('.sheet-status').getByRole('radio', { name: 'Abandonado' }).click();
  await expect.poll(async () => (await stored(page)).books.find((b) => b.id === circe.id).status).toBe('abandoned');
  let s = await stored(page);
  let b = s.books.find((x) => x.id === circe.id);
  expect(b).toMatchObject({ currentPage: circe.currentPage, finishedAt: null });
  expect(b.abandonedAt).toBeTruthy();
  expect(s.books.filter((x) => x.status === 'read').length).toBe(readBefore);
  expect(s.progress.readingLog.filter((e) => e.bookId === circe.id).length).toBe(before.progress.readingLog.filter((e) => e.bookId === circe.id).length);
  await page.keyboard.press('Escape');
  const tabs = page.locator('[aria-label="Qué baldas ver"] [role="radio"]');
  await tabs.filter({ hasText: 'Abandonados' }).click();
  await expect(page.locator(`.library [data-book-id="${circe.id}"]`)).toBeVisible();
  await tabs.filter({ hasText: 'Todos' }).click();
  await expect(page.locator(`.library [data-book-id="${circe.id}"]`)).toBeVisible();
  await tabs.filter({ hasText: 'Leyendo' }).click();
  await expect(page.locator(`.library [data-book-id="${circe.id}"]`)).toHaveCount(0);
  // Retomarlo desde su ficha: vuelve a «Leyendo» con su página
  await tabs.filter({ hasText: 'Abandonados' }).click();
  await page.locator(`.library [data-book-id="${circe.id}"]`).click();
  await page.locator('.sheet-status').getByRole('radio', { name: 'Leyendo ahora' }).click();
  await expect.poll(async () => (await stored(page)).books.find((x) => x.id === circe.id).status).toBe('reading');
  s = await stored(page);
  b = s.books.find((x) => x.id === circe.id);
  expect(b).toMatchObject({ currentPage: circe.currentPage, abandonedAt: null });
});

