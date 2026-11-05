// Rincón 01 · la estantería desde la cama: un libro expuesto de frente y lomos en grupos. Con 0, 1, 4 y más de mil
// libros de prueba (siempre en el perfil de Playwright, nunca en una biblioteca real); título largo, edición sin
// portada, cambiar el expuesto desde su ficha, recargar y retirarlo; tocar un grupo acerca la balda y Atrás la cierra.
// Emulación de Playwright: no equivale a un iPhone físico.
import { expect, test } from '@playwright/test';

const PROJECTS = /chromium-390x844$|webkit-390x844$|chromium-1440x900$/;
const room = (page) => page.locator('[data-panel="MAIN_ROOM"]');

/** Siembra la biblioteca con `make(plantilla)` (libros de prueba con la forma de los de ejemplo) y abre la habitación. */
async function seed(page, make, settings = {}) {
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/');
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.waitForTimeout(300);
  const state = await page.evaluate(
    ({ makeSrc, extra }) => {
      const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
      const template = { ...st.books[0], quotes: [], review: '', rating: 0, favorite: false, cover: '', status: 'read', currentPage: 0 };
      // eslint-disable-next-line no-new-func
      st.books = new Function('t', `return (${makeSrc})(t)`)(template);
      Object.assign(st.settings, { currentBookId: st.books.find((b) => b.status === 'reading')?.id ?? null, showGuides: false, sound: false, sfx: false, ...extra });
      return JSON.stringify(st);
    },
    { makeSrc: make.toString(), extra: settings },
  );
  await page.addInitScript((v) => {
    if (sessionStorage.getItem('rincon-01-seed')) return;
    sessionStorage.setItem('rincon-01-seed', '1');
    localStorage.setItem('bookshelf:v1', v);
  }, state);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
}

test.beforeEach(async ({}, info) => {
  test.skip(!PROJECTS.test(info.project.name), '390 (Chromium y WebKit) y escritorio');
});

test('sin libros se ve la madera, sin lomos ni expuesto, y «Mi biblioteca» sigue', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await seed(page, () => []);
  await expect(room(page).locator('.rb-art')).toHaveCount(1);
  await expect(room(page).locator('.rb-feature')).toHaveCount(0);
  await expect(room(page).locator('.rb-spine')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Mi biblioteca/ }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('con un libro, solo el expuesto', async ({ page }) => {
  await seed(page, (t) => [{ ...t, id: 'uno', title: 'Uno solo', author: 'Autora Uno' }]);
  await expect(room(page).locator('.rb-feature')).toHaveCount(1);
  await expect(room(page).locator('.rb-spine')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Uno solo, de Autora Uno: expuesto en tu estantería/ })).toHaveCount(1);
});

test('con cuatro libros, cuatro ejemplares: la lectura actual expuesta y, debajo, uno de frente y dos de lomo', async ({ page }) => {
  await seed(page, (t) => ['a', 'b', 'c', 'd'].map((id, i) => ({ ...t, id, title: `Libro ${id}`, author: 'Autora', status: i === 1 ? 'reading' : 'read' })));
  await expect(room(page).locator('.rb-feature')).toHaveCount(1);
  await expect(room(page).locator('.rb-shelf[data-shelf="middle"] .rb-front')).toHaveCount(1);
  await expect(room(page).locator('.rb-shelf[data-shelf="middle"] .rb-spine')).toHaveCount(2);
  await expect(room(page).locator('.rb-spine')).toHaveCount(2);
  // Cada ejemplar, una sola vez en toda la estantería
  const labels = await room(page).locator('.rb-hit').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')).join(' | '));
  for (const id of ['a', 'b', 'c', 'd']) expect(labels.split(`Libro ${id}`).length - 1).toBe(1);
  await expect(page.getByRole('button', { name: /^Libro b, de Autora: expuesto en tu estantería/ })).toHaveCount(1);
});

test('con más de mil libros, los nodos y las imágenes del rincón los acota la estantería', async ({ page }) => {
  await seed(page, (t) => Array.from({ length: 1200 }, (_, i) => ({ ...t, id: `m${i}`, title: `Tomo ${i}`, pageCount: 120 + (i % 9) * 80, status: i % 3 ? 'read' : 'want', cover: i === 0 ? t.cover : '' })));
  const counts = await room(page).evaluate((el) => ({
    spines: el.querySelectorAll('.rb-spine').length,
    nodes: el.querySelector('.rb-art').querySelectorAll('*').length,
    imgs: el.querySelector('.rb-art').querySelectorAll('img').length,
    hits: el.querySelectorAll('.rb-hit').length,
  }));
  expect(counts.spines).toBeGreaterThan(20);
  expect(counts.spines).toBeLessThan(80);
  expect(counts.nodes).toBeLessThan(220);
  // El expuesto y el ejemplar de frente de la balda de debajo: nada más
  expect(counts.imgs).toBeLessThanOrEqual(2);
  expect(counts.hits).toBeLessThan(40);
});

test('título largo y edición sin portada: tela mate con título y autor, dentro de la cubierta', async ({ page }) => {
  const long = 'Una historia larguísima de faros, mareas, cartas sin abrir y librerías del puerto que nunca cierran';
  await seed(page, (t) => [{ ...t, id: 'largo', title: 'Una historia larguísima de faros, mareas, cartas sin abrir y librerías del puerto que nunca cierran', author: 'Autora con nombre también largo', cover: '', status: 'reading' }]);
  const feature = room(page).locator('.rb-feature');
  await expect(feature).toHaveAttribute('data-cover', 'none');
  await expect(feature.locator('.rb-feature__title')).toHaveText(long);
  const fits = await feature.evaluate((el) => {
    const t = el.querySelector('.rb-feature__cloth');
    return t.scrollHeight <= t.clientHeight + 1 && t.scrollWidth <= t.clientWidth + 1;
  });
  expect(fits).toBe(true);
});

test('un grupo acerca la balda; se elige el ejemplar, se expone, se recarga y se retira', async ({ page }) => {
  await seed(page, (t) => [
    { ...t, id: 'cama', title: 'El de la cama', author: 'Ana', status: 'reading' },
    ...Array.from({ length: 11 }, (_, i) => ({ ...t, id: `p${i}`, title: `Propio ${i}`, author: 'Berta', status: i % 2 ? 'want' : 'read' })),
  ]);
  await expect(page.getByRole('button', { name: /^El de la cama, de Ana: expuesto/ })).toBeVisible();
  // Los lomos son estrechos: cada grupo tiene su botón con los títulos que guarda
  const group = page.getByRole('button', { name: /^Balda 2, \d+ libros: / }).first();
  const pick = (await group.getAttribute('aria-label')).split(': ')[1].split(', ')[0];
  const pickBtn = (where) => where.getByRole('button', { name: `${pick}, de Berta. Abrir su ficha` });
  const shown = () => page.getByRole('button', { name: `${pick}, de Berta: expuesto en tu estantería. Abrir su ficha` });
  await group.click();
  const balda = page.getByRole('dialog', { name: 'Balda 2 de tu estantería' });
  await expect(balda).toBeVisible();
  await expect(pickBtn(balda)).toBeFocused();
  // Atrás (el gesto del iPhone) cierra la balda y deja la habitación
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await group.click();
  await pickBtn(balda).click();
  const ficha = page.getByRole('dialog').filter({ hasText: pick });
  await expect(ficha).toBeVisible();
  await ficha.getByRole('button', { name: 'Exponer en tu estantería' }).click();
  await expect(ficha.getByRole('button', { name: /Expuesto en tu estantería/ })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(shown()).toBeVisible();
  // El que estaba expuesto vuelve a la estantería, con su cinta de lectura actual
  await expect(room(page).locator('.rb-spine__ribbon')).toHaveCount(1);

  // Se conserva al recargar (preferencia de siempre: el id del ejemplar)
  await page.waitForTimeout(800);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await expect(shown()).toBeVisible();

  // Tocar el expuesto abre su ficha; al retirarlo de la librería, vuelve el de la cama (lectura actual)
  await shown().click();
  await ficha.getByRole('button', { name: 'Quitar de la librería' }).click();
  await ficha.getByRole('button', { name: 'Sí, quitar' }).click();
  await expect(page.getByRole('button', { name: /^El de la cama, de Ana: expuesto/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).settings.roomFeaturedId ?? null)).toBe(null);
});

test('la balda de debajo del expuesto: la cubierta de frente abre su ficha y los dos lomos acercan la balda', async ({ page }) => {
  await seed(page, (t) => ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({ ...t, id, title: `Libro ${id}`, author: 'Autora', status: i === 0 ? 'reading' : 'read' })));
  const front = room(page).locator('.rb-shelf[data-shelf="middle"] .rb-front');
  await expect(front).toHaveCount(1);
  // Unos dos tercios del ancho útil y madera visible encima
  const box = await room(page).evaluate((el) => {
    const shelf = el.querySelector('.rb-shelf[data-shelf="middle"]');
    const items = [...shelf.children].filter((c) => c.classList.contains('rb-front') || c.classList.contains('rb-spine'));
    const right = Math.max(...items.map((c) => c.offsetLeft + c.offsetWidth));
    const tallest = Math.max(...items.map((c) => c.offsetHeight));
    return { share: right / shelf.offsetWidth, room: 1 - tallest / shelf.offsetHeight };
  });
  expect(box.share).toBeGreaterThan(0.55);
  expect(box.share).toBeLessThan(0.75);
  expect(box.room).toBeGreaterThan(0.15);
  const title = await front.locator('.rb-feature__title').textContent();
  await page.getByRole('button', { name: `${title}, de Autora. Abrir su ficha` }).click();
  await expect(page.getByRole('dialog').filter({ hasText: title })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /^Balda 1, 2 libros: / }).click();
  await expect(page.getByRole('dialog', { name: 'Balda 1 de tu estantería' }).getByRole('listitem')).toHaveCount(3);
});
