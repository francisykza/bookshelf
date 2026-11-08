// Puerto Pixel, ajuste v3: portadas en frío y en caliente, cajón «Aplicaciones», títulos largos y pantallas pequeñas. Perfil propio con datos
// de ejemplo. Emulación, no un móvil físico.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const MINE = /^Entrar en tu piso, 1\.º A/;
const IMAGEN = readFileSync('public/assets/puerto/cielo-puerto.webp');

test.beforeEach(async ({ page }, info) => {
  test.skip(!/(chromium|webkit)-390x844$/.test(info.project.name), 'a 390, y cada prueba elige su pantalla');
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
});

const portadas = (page, responder) => page.route('https://covers.openlibrary.org/**', responder);
const sinPortadas = (page) => portadas(page, (route) => route.fulfill({ status: 404, body: '' }));

async function entrar(page) {
  await page.goto('/?piloto=piso');
  await page.getByRole('button', { name: MINE }).click();
  await page.waitForFunction(() => window.__pisoLabTiempos?.puerta, null, { timeout: 60000 });
}

async function sembrar(page, cambio) {
  await page.goto('/?piloto=piso');
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  const estado = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')));
  await page.addInitScript((next) => {
    if (sessionStorage.getItem('sembrado')) return;
    sessionStorage.setItem('sembrado', '1');
    localStorage.setItem('bookshelf:v1', next);
  }, JSON.stringify(cambio(estado)));
}

async function ordenador(page) {
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible({ timeout: 15000 });
}

const dentro = async (page, locator, alto) => {
  const caja = await locator.boundingBox();
  expect(caja).not.toBeNull();
  expect(caja.x).toBeGreaterThanOrEqual(0);
  expect(caja.y).toBeGreaterThanOrEqual(0);
  expect(caja.y + caja.height).toBeLessThanOrEqual(alto);
};

test('portada: en frío, la cubierta con el título hasta estar entera; al volver, sin parpadeo; caja estable', async ({ page }) => {
  let pedidas = 0;
  await portadas(page, async (route) => {
    pedidas += 1;
    await new Promise((ok) => setTimeout(ok, 1800));
    await route.fulfill({ status: 200, contentType: 'image/webp', body: IMAGEN, headers: { 'cache-control': 'no-store' } });
  });
  await entrar(page);
  await ordenador(page);
  const hueco = page.locator('.pp-reading__cover');
  await page.waitForTimeout(300); // termina la entrada animada del panel
  const antes = await hueco.boundingBox();
  await expect(hueco).toContainText(/\S/);
  const lienzo = hueco.locator('canvas');
  const lista = () => lienzo.evaluate((el) => el.style.opacity !== '0' && el.width > 1).catch(() => false);
  expect(await lista()).toBe(false);
  await expect.poll(lista, { timeout: 15000 }).toBe(true);
  expect(await hueco.boundingBox()).toEqual(antes);
  expect(await lienzo.evaluate((el) => getComputedStyle(el).objectFit)).toBe('contain');
  expect(pedidas).toBeGreaterThan(0);
  // En caliente: al volver a abrir, la imagen ya está y no asoma la cubierta provisional
  await page.getByRole('button', { name: 'Salir del ordenador' }).click();
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toHaveCount(0);
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.__provisional = 0;
    new MutationObserver(() => {
      const hueco = document.querySelector('.pp-reading__cover .cover-steady');
      if (hueco && hueco.children.length > 1) window.__provisional += 1;
    }).observe(document.body, { subtree: true, childList: true });
  });
  await ordenador(page);
  expect(await page.locator('.pp-reading__cover canvas').evaluate((el) => el.style.opacity !== '0' && el.width > 1)).toBe(true);
  expect(await page.evaluate(() => window.__provisional)).toBe(0);
});

test('portada que falla: cubierta con el título, sin imagen rota y sin saltos', async ({ page }) => {
  await sinPortadas(page);
  await entrar(page);
  await ordenador(page);
  const hueco = page.locator('.pp-reading__cover');
  await page.waitForTimeout(1200);
  await expect(hueco.locator('.cover-steady')).toContainText(/\S/);
  expect(await hueco.locator('canvas').evaluate((el) => el.style.opacity)).toBe('0');
  const caja = await hueco.boundingBox();
  expect(Math.round(caja.width)).toBe(64);
  expect(Math.round(caja.height)).toBe(96);
});

test('Aplicaciones: todo el inventario, volver, Escape y el sitio al entrar y salir de una función', async ({ page }) => {
  await sinPortadas(page);
  await entrar(page);
  await ordenador(page);
  const boton = page.getByRole('button', { name: 'Aplicaciones' });
  await boton.click();
  await expect(boton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Volver al escritorio' })).toBeFocused();
  for (const name of ['Notas', 'Temporizador', 'Reto anual', 'Misiones', 'Añadir un libro', 'Importar biblioteca', 'Pedir recomendación', 'Mapa de sagas', 'Radio', 'Cuenta y copias', /^Citas/]) await expect(page.getByRole('button', { name, exact: typeof name === 'string' })).toBeAttached();
  await expect(page.getByRole('region', { name: 'Lo principal' })).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible();
  await expect(boton).toHaveAttribute('aria-expanded', 'false');
  await expect(boton).toBeFocused();
  await boton.click();
  await page.locator('.pp-apps').evaluate((el) => (el.scrollTop = 50));
  const antes = await page.locator('.pp-apps').evaluate((el) => el.scrollTop);
  await page.getByRole('button', { name: 'Misiones', exact: true }).click();
  await page.getByRole('button', { name: 'Volver al escritorio' }).click();
  await expect(page.getByRole('button', { name: 'Misiones', exact: true })).toBeFocused();
  expect(await page.locator('.pp-apps').evaluate((el) => el.scrollTop)).toBe(antes);
  await page.getByRole('button', { name: 'Volver al escritorio' }).click();
  await expect(page.getByRole('region', { name: 'Lo principal' })).toBeVisible();
  // Al salir del ordenador se olvida: se vuelve al escritorio
  await boton.click();
  await page.getByRole('button', { name: 'Salir del ordenador' }).click();
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toHaveCount(0);
  await page.waitForTimeout(300);
  await ordenador(page);
  await expect(page.getByRole('region', { name: 'Lo principal' })).toBeVisible();
});

for (const [nombre, width, height] of [['320 × 568', 320, 568], ['horizontal 844 × 390', 844, 390], ['texto al 150 % (260 × 562)', 260, 562]]) {
  test(`título largo sin portada, de día y de noche, a ${nombre}`, async ({ page }) => {
    test.setTimeout(120000);
    await sinPortadas(page);
    await page.setViewportSize({ width, height });
    const LARGO = 'La increíble y triste historia de la cándida Eréndira y de su abuela desalmada, edición conmemorativa';
    await sembrar(page, (s) => ({ ...s, books: s.books.map((b) => (b.id === 'circe' ? { ...b, title: LARGO, cover: '' } : b)) }));
    await entrar(page);
    for (const tema of ['dia', 'noche']) {
      if (tema === 'noche') {
        await page.getByRole('button', { name: 'Menú de accesos' }).click();
        await page.getByRole('button', { name: 'Ver de noche' }).click();
        await page.waitForTimeout(700);
      }
      await ordenador(page);
      await dentro(page, page.getByRole('button', { name: 'Salir del ordenador' }), height);
      await dentro(page, page.getByRole('button', { name: 'Aplicaciones' }), height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const registrar = page.locator('.pp-reading').getByRole('button', { name: /^Registrar lectura de / });
      await registrar.scrollIntoViewIfNeeded();
      await dentro(page, registrar, height);
      await registrar.click();
      await expect(page.locator('.log-sheet')).toBeVisible();
      await page.locator('.reading-form__input input').fill('3');
      await page.locator('.reading-form__save').scrollIntoViewIfNeeded();
      await dentro(page, page.locator('.reading-form__save'), height);
      await dentro(page, page.locator('.log-sheet__close'), height);
      const desborda = await page.locator('.log-sheet').evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(desborda).toBeLessThanOrEqual(0);
      await page.locator('.log-sheet__close').click();
      await page.getByRole('button', { name: 'Descartar' }).click();
      await expect(page.locator('.log-sheet')).toHaveCount(0);
      await page.getByRole('button', { name: 'Salir del ordenador' }).click();
      await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toHaveCount(0);
      await page.waitForTimeout(400);
    }
  });
}

test('safe-area: ni la barra de título ni la de tareas quedan bajo el notch o el gesto', async ({ page, context }, info) => {
  test.skip(!/chromium/.test(info.project.name), 'el área segura se emula por CDP, solo en Chromium');
  await sinPortadas(page);
  await entrar(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 45, bottom: 30, left: 0, right: 0 } });
  await ordenador(page);
  const titulo = await page.locator('.port-computer__head').boundingBox();
  const barra = await page.locator('.pp-taskbar').boundingBox();
  expect(titulo.y).toBeGreaterThanOrEqual(45);
  expect(barra.y + barra.height).toBeLessThanOrEqual(844 - 30);
});
