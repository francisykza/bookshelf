// Versión privada: la habitación en primera persona como pantalla inicial, el edificio desde su puerta y la opción de
// volver a la experiencia anterior. Perfil de Playwright con su propia biblioteca (la de ejemplo de la app), sin
// biblioteca de demostración del piloto. `?inicio=habitacion` la activa en este perfil, como hará la preview por defecto.
// Emulación: no equivale a un Android ni a un iPhone reales.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'qa-report/piso-inicio';

test.beforeEach(async ({ page }, info) => {
  test.skip(!/(chromium|webkit)-390x844$/.test(info.project.name), 'móvil vertical');
  mkdirSync(OUT, { recursive: true });
  await page.route('https://covers.openlibrary.org/**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
});

const room = (page) => page.locator('.plab-room');
const ready = (page) => page.waitForFunction(() => window.__pisoLab?.()?.debug().windows.length > 0, null, { timeout: 30000 });
// Lo que es de la persona: libros, lecturas y ajustes guardados (sin las marcas de tiempo de la propia escritura)
const library = (page) =>
  page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('bookshelf:v1') ?? 'null');
    return s && { books: s.books.map((b) => [b.id, b.status, b.currentPage, b.finishedAt]), log: (s.progress?.readingLog ?? []).length };
  });

test('la habitación es el inicio, su puerta lleva al edificio y se vuelve a ella', async ({ page }, info) => {
  // Primero, la experiencia de siempre: así queda guardada la biblioteca del perfil
  await page.goto('/');
  await page.waitForTimeout(1500);
  const before = await library(page);
  expect(before?.books.length).toBeGreaterThan(0);

  await page.goto('/?inicio=habitacion');
  await expect(room(page)).toBeVisible({ timeout: 30000 });
  await ready(page);
  await page.screenshot({ path: `${OUT}/inicio-${info.project.name}.png` });
  // Sin portal de prueba ni vecina inventada: el botón y la puerta llevan al edificio
  await expect(page.getByRole('button', { name: /Llamar y entrar en el piso de Vecina/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Al edificio' })).toBeVisible();
  // Escape no cierra la pantalla de inicio
  await page.keyboard.press('Escape');
  await expect(room(page)).toBeVisible();

  await page.getByRole('button', { name: 'Al edificio' }).click();
  await expect(room(page)).toHaveCount(0);
  // El edificio del puerto de la app; sin la nube (como en las pruebas y en la preview), pide iniciar sesión
  await expect(page.getByText('Inicia sesión en «Tu cuenta» para tener un piso en el edificio.')).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: `${OUT}/edificio-${info.project.name}.png` });
  await page.goBack();
  await expect(room(page)).toBeVisible();

  // Recargar vuelve a la habitación, con la biblioteca de siempre y sin datos de demostración
  await page.goto('/');
  await expect(room(page)).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(() => localStorage.getItem('bookshelf:lab:biblioteca'))).toBeNull();
  expect(await library(page)).toEqual(before);
});

test('se puede volver a la experiencia anterior y regresar, sin tocar la biblioteca', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1500);
  const before = await library(page);

  await page.goto('/?inicio=habitacion');
  await ready(page);
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('navigation', { name: 'Accesos del piso' }).getByRole('button', { name: 'Volver a la experiencia anterior' }).click();
  await expect(room(page)).toHaveCount(0);
  // La elección se recuerda en este dispositivo
  await page.goto('/');
  await page.waitForTimeout(1500);
  await expect(room(page)).toHaveCount(0);

  // Desde «Ambiente» de la habitación ilustrada, de vuelta a la nueva
  await page.getByRole('button', { name: /Ambiente/ }).click();
  await page.getByRole('button', { name: 'Ir a la habitación nueva' }).click();
  await expect(room(page)).toBeVisible({ timeout: 30000 });
  await page.goto('/');
  await expect(room(page)).toBeVisible({ timeout: 30000 });
  expect(await library(page)).toEqual(before);
});

// En producción (compilada en Vercel) el inicio es la habitación; en local y en las pruebas, sin elegir nada, la ilustrada
test('sin elegir nada, en local sigue empezando la habitación ilustrada', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1500);
  await expect(room(page)).toHaveCount(0);
});
