// Puerto Pixel · revisión final con datos difíciles: títulos larguísimos, sin portadas, biblioteca vacía, sin red y visita a otro piso.
// Datos de prueba y Supabase simulado. Chromium emulado; no equivale a un móvil físico ni a una cuenta real.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { abrirCasa } from './v190-apoyo';

const DIR = join('qa-report', 'pixel-final');
const menu = (page) => page.getByRole('button', { name: 'Menú de accesos' });
const LARGO = 'Las extraordinarias y muy largas crónicas del último farero del puerto de las siete brumas, volumen segundo';
const AUTOR = 'María de las Mercedes Fernández-Villaverde de la Concepción';

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'recorre él mismo los tamaños');
  mkdirSync(DIR, { recursive: true });
});

async function nuevo(browser, ancho, alto) {
  const context = await browser.newContext({ baseURL: 'http://localhost:5196', locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: ancho, height: alto }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.route(/covers\.openlibrary\.org|books\.google/, (r) => r.abort());
  return { context, page };
}

/** Carga el piso, cambia la biblioteca guardada y vuelve a entrar con ella desde el arranque. */
async function conBiblioteca(page, cambia) {
  await abrirCasa(page);
  await page.waitForTimeout(800);
  const estado = JSON.parse(await page.evaluate(() => localStorage.getItem('bookshelf:v1')));
  const nuevoEstado = cambia(estado);
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem('sembrado')) {
      sessionStorage.setItem('sembrado', '1');
      localStorage.setItem('bookshelf:v1', s);
    }
  }, JSON.stringify(nuevoEstado));
  await page.reload();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1000);
}

const sinDesborde = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const cortados = (page, css) => page.locator(css).evaluateAll((ns) => ns.filter((n) => n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).textOverflow !== 'ellipsis' && getComputedStyle(n).overflowX !== 'auto').map((n) => n.className || n.tagName));

for (const [ancho, alto] of [
  [320, 640],
  [390, 844],
]) {
  test(`títulos larguísimos y sin portadas a ${ancho}`, async ({ browser }) => {
    test.setTimeout(150000);
    const { context, page } = await nuevo(browser, ancho, alto);
    await conBiblioteca(page, (s) => ({
      ...s,
      books: s.books.map((b) => ({ ...b, ...(b.status === 'reading' ? { title: LARGO, author: AUTOR } : {}), coverUrl: '', cover: '', coverId: null, isbn: b.status === 'reading' ? '' : b.isbn })),
    }));
    const foto = async (n) => {
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(DIR, `largo-${ancho}-${n}.png`) });
      expect(await sinDesborde(page), `desborde en ${n}`).toBe(true);
    };
    await menu(page).click();
    await foto('menu');
    expect(await cortados(page, '.port-menu__sheet button')).toEqual([]);
    await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible({ timeout: 12000 });
    await foto('escritorio');
    await page.locator('.pp-reading').getByRole('button', { name: /^Registrar lectura de / }).click();
    await expect(page.locator('.log-sheet')).toBeVisible();
    await foto('registro');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Mi diario' }).click();
    await page.waitForTimeout(500);
    await foto('diario');
    expect(await cortados(page, '.pcd-book__log')).toEqual([]);
    await page.getByRole('button', { name: 'Volver al escritorio' }).click();
    await page.getByRole('button', { name: 'Calendario' }).click();
    await page.locator('.port-cal__day[data-read]').first().click();
    await foto('calendario');
    await page.getByRole('button', { name: 'Salir del ordenador' }).click();
    await page.waitForTimeout(500);
    await menu(page).click();
    await page.getByRole('button', { name: 'Mi biblioteca' }).click();
    await page.waitForTimeout(1000);
    await foto('biblioteca');
    await context.close();
  });
}

test('biblioteca vacía: nada se rompe y las pantallas lo dicen', async ({ browser }) => {
  test.setTimeout(120000);
  const { context, page } = await nuevo(browser, 390, 844);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await conBiblioteca(page, (s) => ({ ...s, books: [], quotes: [], entries: [], logs: [], pomodoros: [] }));
  const foto = (n) => page.screenshot({ path: join(DIR, `vacia-${n}.png`) });
  await menu(page).click();
  await page.waitForTimeout(400);
  await foto('menu');
  await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible({ timeout: 12000 });
  await page.waitForTimeout(500);
  await foto('escritorio');
  for (const [app, n] of [['Calendario', 'calendario'], ['Mi diario', 'diario'], ['Estadísticas', 'estadisticas']]) {
    await page.getByRole('button', { name: app }).click();
    await page.waitForTimeout(500);
    await foto(n);
    await page.getByRole('button', { name: 'Volver al escritorio' }).click();
  }
  await page.getByRole('button', { name: 'Salir del ordenador' }).click();
  await page.waitForTimeout(500);
  await menu(page).click();
  await page.locator('.port-menu__sheet').getByRole('button', { name: 'Mi biblioteca' }).click();
  await page.waitForTimeout(800);
  await foto('biblioteca');
  expect(errores).toEqual([]);
  await context.close();
});

test('sin red: menú, calendario y radio responden, y la música avisa sin bloquear', async ({ browser }) => {
  test.setTimeout(90000);
  const { context, page } = await nuevo(browser, 390, 844);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await abrirCasa(page);
  await context.setOffline(true);
  await menu(page).click();
  await page.getByRole('button', { name: 'Sonido' }).click();
  await page.getByRole('button', { name: 'Activar sonido' }).click();
  await expect(page.locator('.port-note')).toContainText('No se ha podido cargar', { timeout: 15000 });
  await page.screenshot({ path: join(DIR, 'sin-red-radio.png') });
  // Sin marcos descargados, el ambiente elegido se sigue leyendo sobre su verde
  expect(await page.locator('.pp-chip:has(input:checked)').first().evaluate((n) => getComputedStyle(n).backgroundColor)).toBe('rgb(67, 92, 43)');
  await expect(page.getByRole('slider', { name: /Efectos/ })).toBeEnabled();
  await page.getByRole('button', { name: 'Cerrar Sonido' }).click();
  await page.waitForTimeout(400);
  await menu(page).click();
  await page.getByRole('button', { name: 'Calendario' }).click();
  await expect(page.locator('.port-cal__day').first()).toBeVisible();
  await page.screenshot({ path: join(DIR, 'sin-red-calendario.png') });
  expect(errores).toEqual([]);
  await context.close();
});

test('visita a otro piso: solo mirar y salir, con el mismo organizador', async ({ browser }) => {
  test.setTimeout(90000);
  const { context, page } = await nuevo(browser, 390, 844);
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/?piloto=piso');
  await page.getByRole('button', { name: /^Llamar y entrar en el piso de Vecina de prueba/ }).click();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().windows.length > 0, null, { timeout: 30000 });
  await menu(page).click();
  const accesos = page.getByRole('navigation', { name: 'Accesos del piso' }).getByRole('button');
  await expect(accesos).toHaveText(['Ver de noche', 'Salir al portal']);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(DIR, 'visita-menu.png') });
  for (const n of ['Ordenador', 'Decorar', 'Ajustes', 'Sonido']) await expect(page.locator('.port-menu__sheet').getByRole('button', { name: n })).toHaveCount(0);
  await context.close();
});
