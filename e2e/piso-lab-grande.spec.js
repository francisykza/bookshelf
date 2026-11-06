// Piloto con bibliotecas grandes: selección acotada, toda la biblioteca por bloques, registro con 5.000 libros, render
// pausado, contexto de la GPU perdido y devuelto, teclado simulado y zonas seguras. Son datos sintéticos en un perfil propio.
// Emulación: ni el teclado ni la GPU de un móvil real.
import { expect, test } from '@playwright/test';

const open = async (page, size = 5000, extra = '') => {
  await page.goto(`/?piloto=piso&biblioteca=${size}${extra}`);
  await page.getByRole('button', { name: /Entrar en tu piso/ }).click();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().exterior.renders > 0, null, { timeout: 30000 });
};
const debug = (page) => page.evaluate(() => window.__pisoLab().debug());
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')));
const library = async (page) => {
  await page.getByRole('button', { name: 'Ver la balda' }).click();
  await page.waitForFunction(() => window.__pisoLab().debug().zoomed);
  await page.getByRole('button', { name: /Buscar en toda la biblioteca, 5000 libros/ }).click();
  await expect(page.getByRole('heading', { name: 'Tu biblioteca' })).toBeVisible();
};
const search = (page) => page.getByRole('searchbox', { name: /Buscar por título/ });

test('la habitación representa como mucho 30 ejemplares, con las lecturas y los elegidos delante', async ({ page }) => {
  await open(page);
  const { shelf, book } = await debug(page);
  expect(shelf.books.length).toBeLessThanOrEqual(30);
  expect(book.id).toBe('lab-0');
  // Los lomos con menos sitio van arriba: las lecturas y los elegidos están en la selección
  for (const id of ['lab-0', 'lab-1', 'lab-2', 'lab-10', 'lab-20', 'lab-30']) expect(shelf.books).toContain(id);
});

test('el límite se puede cambiar en la dirección', async ({ page }) => {
  await open(page, 5000, '&visibles=8');
  expect((await debug(page)).shelf.books.length).toBeLessThanOrEqual(8);
});

test('se llega a cualquier libro: búsqueda, filtros y bloques, con las filas acotadas', async ({ page }) => {
  await open(page);
  await library(page);
  const count = page.locator('.plab-library__count');
  await expect(count).toContainText('5000 libros, 40 cargados');
  expect(await page.locator('.plab-row').count()).toBeLessThan(30);
  await expect(page.locator('.plab-row').first()).toHaveAttribute('aria-setsize', '5000');

  // El último libro, buscándolo, sin tildes
  await search(page).fill('N.º 5000');
  await expect(count).toHaveText('1 libro');
  await expect(page.locator('.plab-row')).toHaveCount(1);
  await search(page).fill('');
  await expect(count).toContainText('40 cargados');

  // Sin buscar: bajando se cargan más y las filas montadas no crecen
  const list = page.locator('.plab-library__list');
  let most = 0;
  for (let i = 0; i < 12; i += 1) {
    await list.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.waitForTimeout(60);
    most = Math.max(most, await page.locator('.plab-row').count());
  }
  expect(most).toBeLessThan(30);
  expect(await page.locator('.plab-library img').count()).toBeLessThan(30);
  await expect(count).not.toContainText(', 40 cargados');

  // Un filtro entero, con el botón y bajando, hasta el último de verdad
  await page.getByRole('button', { name: 'Abandonado', exact: true }).click();
  await expect(count).toContainText('cargados');
  const n = Number(/(\d+) libros/.exec(await count.textContent())[1]);
  expect(n).toBeGreaterThan(300);
  await page.getByRole('button', { name: /Cargar \d+ más/ }).click();
  for (let i = 0; i < 40 && (await count.textContent()).includes('cargados'); i += 1) {
    await list.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.waitForTimeout(60);
  }
  await expect(count).toHaveText(`${n} libros`);
  await list.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect(page.locator(`.plab-row[aria-posinset="${n}"]`)).toBeVisible();
  expect(await page.locator('.plab-row').count()).toBeLessThan(30);
});

test('volver de una ficha conserva la búsqueda; exponer no toca el estado de lectura', async ({ page }) => {
  await open(page);
  await library(page);
  await search(page).fill('n.º 4000');
  await expect(page.locator('.plab-row')).toHaveCount(1);
  const before = (await stored(page)).books.find((b) => b.id === 'lab-3999');

  await page.getByRole('button', { name: /Exponer en la estantería/ }).click();
  await expect(page.getByRole('button', { name: /Retirar de la estantería/ })).toBeVisible();
  await expect(page.locator('.plab-row small')).toContainText('En la estantería');
  await page.waitForFunction(() => window.__pisoLab().debug().shelf.books.includes('lab-3999'));
  await page.waitForTimeout(400);
  let saved = await stored(page);
  expect(saved.settings.roomExhibit).toContain('lab-3999');
  expect(saved.books.find((b) => b.id === 'lab-3999')).toEqual(before);

  // Sobrevive a recargar, y retirarlo tampoco cambia el libro
  await page.reload();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().shelf.books.includes('lab-3999'), null, { timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'Tu biblioteca' })).toBeVisible();
  await search(page).fill('n.º 4000');
  await page.getByRole('button', { name: /Retirar de la estantería/ }).click();
  await page.waitForFunction(() => !window.__pisoLab().debug().shelf.books.includes('lab-3999'));
  await page.waitForTimeout(400);
  saved = await stored(page);
  expect(saved.books.find((b) => b.id === 'lab-3999')).toEqual(before);

  // La ficha se abre encima y, al cerrarla, sigue la misma búsqueda
  await page.locator('.plab-row__open').click();
  await expect(page.getByRole('dialog').first()).toBeVisible();
  await page.goBack();
  await expect(search(page)).toHaveValue('n.º 4000');
  await expect(page.locator('.plab-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Volver a la balda' }).click();
  await expect(page.getByRole('button', { name: /Buscar en toda la biblioteca/ })).toBeVisible();
});

test('con 5.000 libros: registrar, cancelar, deshacer y recargar', async ({ page }) => {
  await open(page);
  const pageOf = async () => (await stored(page)).books.find((b) => b.id === 'lab-0').currentPage;
  const start = await pageOf();
  const register = page.getByRole('button', { name: /Registrar lectura de/ });
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Guardar lectura' }) });

  // Cancelar no cambia nada
  await register.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toBeHidden();
  expect(await pageOf()).toBe(start);

  // Guardar
  await register.click();
  const input = dialog.locator('.reading-form__input input');
  await input.fill('25');
  await dialog.getByRole('button', { name: 'Guardar lectura' }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(pageOf).toBe(start + 25);

  // Deshacer
  await page.getByRole('button', { name: /Deshacer/ }).click();
  await expect.poll(pageOf).toBe(start);

  // Guardar otra vez y recargar: sigue, y el piso vuelve a dibujarse
  await register.click();
  await dialog.locator('.reading-form__input input').fill('10');
  await dialog.getByRole('button', { name: 'Guardar lectura' }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(pageOf).toBe(start + 10);
  await page.reload();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().exterior.renders > 0, null, { timeout: 30000 });
  expect(await pageOf()).toBe(start + 10);
  // Lo guardado cupo: los 5.000 siguen ahí
  expect((await stored(page)).books.length).toBe(5000);
});

test('oculta no dibuja: en segundo plano y tapada por la biblioteca, y repinta al volver', async ({ page }) => {
  await open(page);
  const setHidden = (value) =>
    page.evaluate((v) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (v ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange'));
    }, value);
  await page.waitForTimeout(500);
  await setHidden(true);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const hiddenAt = (await debug(page)).exterior.renders;
  expect((await debug(page)).paused).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(1200);
  expect((await debug(page)).exterior.renders).toBe(hiddenAt);
  await setHidden(false);
  await page.waitForFunction((n) => window.__pisoLab().debug().exterior.renders > n, hiddenAt);

  await library(page);
  await page.waitForTimeout(300);
  const covered = await debug(page);
  expect(covered.paused).toBe(true);
  expect(covered.exterior.waterRunning).toBe(false);
  await page.locator('.plab-library__list').evaluate((el) => el.scrollTo(0, 2000));
  await page.waitForTimeout(800);
  expect((await debug(page)).exterior.renders).toBe(covered.exterior.renders);
  await page.getByRole('button', { name: 'Volver a la balda' }).click();
  await page.waitForFunction(() => !window.__pisoLab().debug().paused);
});

test('si se pierde el contexto de la GPU y vuelve, el piso sigue; si no vuelve, queda el mensaje', async ({ page }) => {
  await open(page);
  // Es el contexto que ya tiene el lienzo: pedirlo otra vez no crea otro
  await page.evaluate(() => {
    const canvas = document.querySelector('.plab-canvas');
    window.__lose = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')).getExtension('WEBGL_lose_context');
    window.__lose.loseContext();
  });
  await page.waitForFunction(() => window.__pisoLab().debug().contextLost);
  await expect(page.locator('.plab-fallback')).toHaveCount(0);
  const before = (await debug(page)).exterior.renders;
  await page.evaluate(() => window.__lose.restoreContext());
  await page.waitForFunction((n) => window.__pisoLab().debug().restores === 1 && window.__pisoLab().debug().exterior.renders > n, before);
  await expect(page.locator('.plab-fallback')).toHaveCount(0);
  // Vuelve con la imagen, no en negro: el centro del lienzo tiene color
  const lit = await page.evaluate(() => {
    const api = window.__pisoLab();
    api.lookTo(0);
    const canvas = document.querySelector('.plab-canvas');
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const ctx = copy.getContext('2d');
    ctx.drawImage(canvas, 0, 0);
    const { data } = ctx.getImageData(0, 0, copy.width, copy.height);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2];
    return sum / (data.length / 4);
  });
  expect(lit).toBeGreaterThan(20);

  await page.evaluate(() => window.__lose.loseContext());
  await expect(page.locator('.plab-fallback')).toBeVisible({ timeout: 6000 });
});

test('teclado simulado: el buscador y los resultados siguen a la vista y el texto no acerca la página', async ({ page }) => {
  await open(page);
  await library(page);
  const input = search(page);
  await input.focus();
  expect(await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  // Se reduce la ventana a lo que deja un teclado: no es un teclado real
  await page.setViewportSize({ width: 390, height: 450 });
  await page.waitForTimeout(200);
  const box = await input.boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThan(450);
  await input.fill('n.º 123');
  await expect(page.locator('.plab-row').first()).toBeInViewport();
  const room = await page.locator('.plab-library__list').boundingBox();
  expect(room.height).toBeGreaterThan(76);
  expect(room.y + room.height).toBeLessThanOrEqual(451);
});

test('el formulario de registro cabe con el teclado simulado', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Registrar lectura de/ }).click();
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Guardar lectura' }) });
  const input = dialog.locator('.reading-form__input input');
  await input.focus();
  expect(await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  await page.setViewportSize({ width: 390, height: 450 });
  await page.waitForTimeout(300);
  await expect(input).toBeInViewport();
  await dialog.getByRole('button', { name: 'Guardar lectura' }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole('button', { name: 'Guardar lectura' })).toBeInViewport();
});

test('zonas seguras: nada interactivo bajo la muesca ni bajo la barra inferior', async ({ page, browserName, context }) => {
  test.skip(browserName !== 'chromium', 'Solo Chromium emula el área segura por CDP');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 45, bottom: 34, left: 0, right: 0 } });
  await open(page);
  const inSafe = async (locator) => {
    const box = await locator.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(45);
    expect(box.y + box.height).toBeLessThanOrEqual(844 - 34 + 0.5);
  };
  await inSafe(page.getByRole('button', { name: /Al portal/ }));
  await inSafe(page.getByRole('button', { name: /Registrar lectura de/ }));
  await inSafe(page.getByRole('button', { name: 'Decorar' }));
  await library(page);
  await inSafe(page.getByRole('button', { name: 'Volver a la balda' }));
  await inSafe(search(page));
  // Lo último de la lista se puede subir por encima de la barra
  const list = page.locator('.plab-library__list');
  await list.evaluate((el) => el.scrollTo(0, 0));
  const padding = await list.evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
  expect(padding).toBe(34);
});

test('biblioteca vacía: el piso se abre y lleva a Mi biblioteca', async ({ page }) => {
  await open(page, 0);
  expect((await debug(page)).book).toBeNull();
  await expect(page.getByRole('button', { name: /Elegir una lectura/ })).toContainText('En Mi biblioteca');
});
