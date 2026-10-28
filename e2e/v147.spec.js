// QA de la 1.47.0 (SPEC §43–45): habitación pulida (encabezado, accesos, libro), registro con vista previa y cierre
// seguro, Ambiente compacto, cuenta fuera de Ambiente, biblioteca compacta con cinco etiquetas y estado
// «Abandonado» reversible. Con perfiles de prueba (localStorage propio de Playwright).
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

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
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.waitForTimeout(300);
}

async function openLibrary(page) {
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="shelf"]').evaluate((el) => el.click());
  await expect(page.locator('.library[data-open="true"]')).toBeVisible();
  await page.waitForTimeout(400);
}

const rect = (page, sel) => page.locator(sel).first().evaluate((el) => el.getBoundingClientRect().toJSON());
const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

test('habitación: encabezado sin solaparse, accesos de 44 px, título sin guiones y libro lejos del borde', async ({ page }, info) => {
  test.skip(!portrait(page), 'el libro grande y el encabezado en dos filas son de pantallas verticales');
  await load(page);
  const header = await rect(page, '.room-header');
  const corner = await rect(page, '.room-corner');
  expect(overlap(header, corner)).toBe(false);
  // 1.50: «Mi biblioteca» va proyectado en el frente de la balda; su zona de toque se amplía con ::after (abajo)
  // Dentro de la escena: alto de la zona de toque (::after) en px de la ilustración × escala del escenario
  const shelfHit = await page.locator('.room-plaque[data-id="shelf"]').evaluate((el) => {
    const k = parseFloat(el.closest('.scene-stage')?.dataset.scale ?? '1');
    return parseFloat(getComputedStyle(el, '::after').height) * (el.classList.contains('room-plaque--scene') ? k : 1);
  });
  expect(shelfHit).toBeGreaterThanOrEqual(44);
  for (const sel of ['.room-plaque[data-id="diary"]', '.panorama-nav__btn--next']) {
    const r = await rect(page, sel);
    expect(r.height, sel).toBeGreaterThanOrEqual(44);
    expect(r.right, sel).toBeLessThanOrEqual(page.viewportSize().width);
  }
  const title = await page.locator('.bed-pages__title').first().evaluate((el) => getComputedStyle(el).hyphens);
  expect(title).toBe('manual');
  const btn = await rect(page, '.bed-pages__hit');
  expect(page.viewportSize().height - btn.bottom).toBeGreaterThanOrEqual(12);
  await shot(page, info, 'v147-habitacion');
});

test('registro: «He leído 20» y «Voy por la página» dan la misma vista previa; cerrar con algo escrito pregunta', async ({ page }, info) => {
  test.skip(!portrait(page), 'el registro se abre desde el libro grande de la cama');
  await load(page);
  await page.getByRole('button', { name: /^Registrar lectura de / }).click();
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

test('ambiente: compacto, con cierre, la hora manual deja de seguir el reloj y la cuenta tiene acceso propio', async ({ page }, info) => {
  await load(page);
  await page.getByRole('button', { name: 'Ambiente' }).click();
  const panel = page.locator('.ambient-menu__panel');
  await expect(panel).toBeVisible();
  const r = await panel.evaluate((el) => ({ ...el.getBoundingClientRect().toJSON(), scroll: getComputedStyle(el).overflowY }));
  expect(r.bottom).toBeLessThanOrEqual(page.viewportSize().height);
  expect(r.right).toBeLessThanOrEqual(page.viewportSize().width);
  for (const name of ['Mañana', 'Atardecer', 'Noche']) {
    const b = await panel.getByRole('radio', { name }).evaluate((el) => ({ fits: el.scrollWidth <= el.clientWidth + 1, h: el.getBoundingClientRect().height }));
    expect(b.fits, name).toBe(true);
    expect(b.h).toBeGreaterThanOrEqual(40);
  }
  await expect(panel.getByRole('button', { name: 'Tu cuenta y copias' })).toHaveCount(0);
  await panel.getByRole('radio', { name: 'Noche' }).click();
  await expect(panel.getByRole('radio', { name: 'Noche' })).toHaveAttribute('aria-checked', 'true');
  await expect(panel.getByRole('switch', { name: 'Seguir el reloj' })).toHaveAttribute('aria-checked', 'false');
  await expect(panel.locator('.ambient-menu__clock')).toContainText('ya no sigue el reloj');
  await shot(page, info, 'v147-ambiente');
  await panel.getByRole('button', { name: 'Cerrar Ambiente' }).click();
  await expect(panel).toHaveCount(0);
  const s = await stored(page);
  expect(s.settings).toMatchObject({ timeOfDay: 'night', timeAuto: false });
  await page.getByRole('button', { name: 'Tu cuenta y copias' }).click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
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

test('abandonado: si era el libro de la cama, se dice y se ofrece elegir otro sin escoger uno por su cuenta', async ({ page }) => {
  test.skip(!portrait(page), 'el libro grande de la cama es de pantallas verticales');
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/');
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.waitForTimeout(300);
  const seeded = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
    const circe = st.books.find((b) => b.title === 'Circe');
    circe.status = 'abandoned';
    st.settings.currentBookId = circe.id;
    return JSON.stringify(st);
  });
  await page.addInitScript((v) => localStorage.setItem('bookshelf:v1', v), seeded);
  await page.reload();
  await page.waitForSelector('.bed-pages');
  await expect(page.locator('.bed-pages').first()).toHaveAttribute('data-state', 'abandoned');
  await expect(page.locator('.bed-pages__kicker').first()).toHaveText('Lectura abandonada');
  await expect(page.locator('.bed-pages__title').first()).toHaveText('Circe');
  await expect(page.getByRole('button', { name: /^Registrar lectura de / })).toHaveCount(0);
  await page.getByRole('button', { name: 'Elegir otra lectura' }).click();
  await expect(page.locator('.library[data-open="true"]')).toBeVisible();
});
