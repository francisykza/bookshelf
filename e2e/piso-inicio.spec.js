// El inicio es siempre tu piso (la habitación en primera persona) y su botón lleva al edificio. Desde la 1.157 ya no hay
// experiencia anterior (la habitación ilustrada de la 1.86 está archivada en archivo/habitacion-ilustrada/): ni el botón
// para volver a ella, ni `?inicio=…`, ni la elección guardada en el dispositivo la traen de vuelta, y nada de eso toca la
// biblioteca. Perfil de Playwright con su propia biblioteca (la de ejemplo de la app), sin biblioteca de demostración.
// Aquí no hay nube, así que se ve el aviso para iniciar sesión (y nunca un piso de prueba). Con cuentas, en
// e2e-community/v188-habitacion-real.spec.js y v1157-sin-habitacion.spec.js.
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
  });
});

const room = (page) => page.locator('.plab-room');
const ready = (page) => expect(page.getByText(/inicia sesión en «Tu cuenta» para entrar/)).toBeVisible({ timeout: 30000 });
// Lo que es de la persona: libros, lecturas y ajustes guardados (sin las marcas de tiempo de la propia escritura)
const library = (page) =>
  page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('bookshelf:v1') ?? 'null');
    return s && { books: s.books.map((b) => [b.id, b.status, b.currentPage, b.finishedAt]), log: (s.progress?.readingLog ?? []).length };
  });

test('el piso es el inicio, su botón lleva al edificio y se vuelve a él', async ({ page }, info) => {
  await page.goto('/');
  await expect(room(page)).toBeVisible({ timeout: 30000 });
  await ready(page);
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  const before = await library(page);
  expect(before?.books.length).toBeGreaterThan(0);
  await page.screenshot({ path: `${OUT}/inicio-${info.project.name}.png` });
  // Sin portal de prueba ni vecina inventada, ni un piso de prueba como tuyo: el aviso y el botón al edificio
  await expect(page.locator('.plab-stage')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('bookshelf:lab:piso-primera-persona:plano2:lab-1A'))).toBeNull();
  await expect(page.getByRole('button', { name: /Llamar y entrar en el piso de Vecina/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Al edificio' })).toBeVisible();
  // Ya no hay camino a la experiencia anterior
  await expect(page.getByRole('button', { name: 'Volver a la experiencia anterior' })).toHaveCount(0);
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

  // Recargar vuelve al piso, con la biblioteca de siempre y sin datos de demostración
  await page.goto('/');
  await expect(room(page)).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(() => localStorage.getItem('bookshelf:lab:biblioteca'))).toBeNull();
  expect(await library(page)).toEqual(before);
});

test('la elección antigua del dispositivo y `?inicio=` ya no llevan a la habitación ilustrada, y no se borra nada', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  const before = await library(page);

  // Quien eligió la experiencia anterior en la 1.156 o antes: su marca sigue ahí, pero entra en su piso
  await page.evaluate(() => localStorage.setItem('bookshelf:inicio', 'anterior'));
  for (const url of ['/', '/?inicio=anterior', '/?inicio=habitacion']) {
    await page.goto(url);
    await expect(room(page)).toBeVisible({ timeout: 30000 });
    await ready(page);
    await expect(page.locator('.scene-base')).toHaveCount(0);
    expect(await page.evaluate(() => history.state?.bookshelf?.loc?.panel)).toMatchObject({ type: 'pisoLab', id: 'mio' });
  }
  expect(await page.evaluate(() => localStorage.getItem('bookshelf:inicio'))).toBe('anterior');
  expect(await library(page)).toEqual(before);
});

// Una entrada del historial de antes (la habitación ilustrada sin panel, o el piso de prueba lab-1A de la 1.87), que
// sobrevive a recargar, lleva a tu piso
for (const [nombre, panel] of [
  ['la habitación ilustrada', null],
  ['el piso de prueba lab-1A', { type: 'pisoLab', id: 'lab-1A' }],
]) {
  test(`una entrada antigua del historial (${nombre}) abre tu piso`, async ({ page }) => {
    await page.addInitScript((p) => {
      if (sessionStorage.getItem('prueba:hecho')) return;
      sessionStorage.setItem('prueba:hecho', '1');
      history.replaceState({ bookshelf: { loc: { view: 'room', panel: p }, depth: 0, parent: null } }, '');
    }, panel);
    await page.goto('/');
    await ready(page);
    await expect(page.locator('.plab-stage')).toHaveCount(0);
    await expect(page.getByText('Tu piso · 1.º A')).toHaveCount(0);
    expect(await page.evaluate(() => history.state.bookshelf.loc.panel.id)).toBe('mio');
    expect(await page.evaluate(() => localStorage.getItem('bookshelf:lab:piso-primera-persona:plano2:lab-1A'))).toBeNull();
  });
}
