// Integridad del guardado con 5.000 libros tras la pasada de rendimiento: lo que se confirma es lo que hay escrito.
// Datos sintéticos en un perfil propio; emulación, ni un móvil ni un Safari reales.
import { expect, test } from '@playwright/test';

const KEY = 'bookshelf:v1';
const open = async (page, size = 5000) => {
  await page.goto(`/?piloto=piso&biblioteca=${size}`);
  await page.getByRole('button', { name: /Entrar en tu piso/ }).click();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().exterior.renders > 0, null, { timeout: 30000 });
};
const stored = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
const snapshot = async (page, id = 'lab-0') => {
  const state = await stored(page);
  return { page: state.books.find((b) => b.id === id).currentPage, log: state.progress.readingLog.filter((e) => e.bookId === id), books: state.books.length };
};
const dialogOf = (page) => page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Guardar lectura' }) });
const register = (page) => page.getByRole('button', { name: /Registrar lectura de/ });
const fill = async (page, pages) => {
  await register(page).click();
  await dialogOf(page).locator('.reading-form__input input').fill(String(pages));
};
const save = (page) => dialogOf(page).getByRole('button', { name: 'Guardar lectura' });

test.describe.configure({ timeout: 120000 });

test('al cerrarse el registro ya está escrito: recargar al momento no pierde nada', async ({ page }) => {
  await open(page);
  const start = await snapshot(page);
  await fill(page, 12);
  await save(page).click();
  await expect(dialogOf(page)).toBeHidden();
  // Sin esperar: lo escrito se lee en cuanto se cierra
  const after = await snapshot(page);
  expect(after.page).toBe(start.page + 12);
  expect(after.log.length).toBe(start.log.length + 1);
  await page.reload();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().exterior.renders > 0, null, { timeout: 30000 });
  const reloaded = await snapshot(page);
  expect(reloaded.page).toBe(start.page + 12);
  expect(reloaded.log.length).toBe(start.log.length + 1);
  expect(reloaded.books).toBe(5000);
});

test('un doble toque guarda una sola vez', async ({ page }) => {
  await open(page);
  const start = await snapshot(page);
  await fill(page, 7);
  await save(page).dblclick();
  await expect(dialogOf(page)).toBeHidden();
  await page.waitForTimeout(400);
  const after = await snapshot(page);
  expect(after.page).toBe(start.page + 7);
  expect(after.log.length).toBe(start.log.length + 1);
});

test('varios registros seguidos y Deshacer dejan el progreso y el historial cuadrados', async ({ page }) => {
  await open(page);
  const start = await snapshot(page);
  let total = 0;
  for (const pages of [5, 6, 7]) {
    await fill(page, pages);
    await save(page).click();
    await expect(dialogOf(page)).toBeHidden();
    total += pages;
    const now = await snapshot(page);
    expect(now.page).toBe(start.page + total);
  }
  const three = await snapshot(page);
  expect(three.log.length).toBe(start.log.length + 3);
  expect(new Set(three.log.map((e) => e.id)).size).toBe(three.log.length);

  // Deshacer quita solo el último, también de lo escrito
  await page.getByRole('button', { name: /Deshacer/ }).click();
  await expect.poll(async () => (await snapshot(page)).page).toBe(start.page + 11);
  expect((await snapshot(page)).log.length).toBe(start.log.length + 2);
  // Recargar justo después de deshacer tampoco lo recupera
  await page.reload();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().exterior.renders > 0, null, { timeout: 30000 });
  expect((await snapshot(page)).page).toBe(start.page + 11);
});

test('si no se puede escribir, no confirma: avisa, conserva lo escrito y se puede reintentar', async ({ page }) => {
  await open(page);
  const start = await snapshot(page);
  const text = await page.evaluate((key) => localStorage.getItem(key), KEY);
  await page.evaluate((key) => {
    const real = Storage.prototype.setItem;
    window.__realSetItem = real;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Sin espacio', 'QuotaExceededError');
      return real.call(this, name, value);
    };
  }, KEY);
  await fill(page, 9);
  await save(page).click();

  // Sigue abierto, con el aviso y lo escrito; ni «Deshacer» ni progreso
  const dialog = dialogOf(page);
  await expect(dialog.getByText(/No se ha podido guardar en este dispositivo/)).toBeVisible();
  await expect(dialog.locator('.reading-form__input input')).toHaveValue('9');
  await expect(page.getByRole('button', { name: /Deshacer/ })).toHaveCount(0);
  await page.waitForTimeout(400);
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(text);

  // Con espacio otra vez, el mismo intento entra una sola vez
  await page.evaluate(() => {
    Storage.prototype.setItem = window.__realSetItem;
  });
  await save(page).click();
  await expect(dialog).toBeHidden();
  const after = await snapshot(page);
  expect(after.page).toBe(start.page + 9);
  expect(after.log.length).toBe(start.log.length + 1);
});

test('arrancar no reescribe lo que no ha cambiado y sí lo que cambian las migraciones', async ({ page }) => {
  await open(page, 50);
  // Los datos de prueba se escriben una vez ya normalizados; a partir de ahí, lo guardado es estable
  await page.waitForTimeout(3000);
  await page.goto('/?piloto=piso');
  await page.getByRole('button', { name: /Entrar en tu piso/ }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(3000);
  const before = await page.evaluate((key) => localStorage.getItem(key), KEY);
  await page.evaluate(() => sessionStorage.setItem('prueba:escrituras', '0'));
  await page.addInitScript((key) => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) sessionStorage.setItem('prueba:escrituras', String(Number(sessionStorage.getItem('prueba:escrituras') ?? 0) + 1));
      return real.call(this, name, value);
    };
  }, KEY);
  await page.goto('/?piloto=piso');
  await page.getByRole('button', { name: /Entrar en tu piso/ }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(3000);
  expect(await page.evaluate(() => sessionStorage.getItem('prueba:escrituras'))).toBe('0');
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(before);

  // Una versión antigua sí se vuelve a escribir, ya migrada
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key));
    delete state.settings;
    state.version = 5;
    window.addEventListener('pagehide', () => localStorage.setItem(key, JSON.stringify(state)));
  }, KEY);
  await page.goto('/?piloto=piso');
  await page.getByRole('button', { name: /Entrar en tu piso/ }).waitFor({ timeout: 30000 });
  await expect.poll(async () => (await stored(page)).settings !== undefined, { timeout: 8000 }).toBe(true);
});
