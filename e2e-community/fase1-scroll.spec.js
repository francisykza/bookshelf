// Fase 1 · A: cada pantalla del ordenador se recorre hasta el final con el gesto real y se vuelve bien. Chromium: gesto táctil por CDP.
// WebKit no tiene ese gesto en Playwright: se usa la rueda, y se dice así; no equivale a tocar la pantalla de un iPhone.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { abrirCasa } from './v190-apoyo';

const DIR = join('qa-report', 'fase1', 'scroll');
const menu = (page) => page.getByRole('button', { name: 'Menú de accesos' });
const CUERPO = '.pc-win:not([hidden]) .pc-win__body';

async function montar(browser, browserName, ancho, alto, extra = {}) {
  const movil = browserName === 'chromium';
  const context = await browser.newContext({ baseURL: 'http://localhost:5196', locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil, deviceScaleFactor: 2, ...extra });
  const page = await context.newPage();
  const cdp = movil ? await context.newCDPSession(page) : null;
  const gesto = async (sel) => {
    const c = await page.locator(sel).boundingBox();
    const x = c.x + c.width / 2;
    const y = c.y + c.height * 0.75;
    if (cdp) {
      // Secuencia táctil completa: synthesizeScrollGesture no emite touchmove aquí y tampoco desplaza una página de control
      const recorrido = Math.round(c.height * 0.6);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 1; i <= 14; i += 1) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - (recorrido * i) / 14 }] });
        await page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.mouse.move(x, y);
      await page.mouse.wheel(0, Math.round(c.height * 0.6));
    }
    await page.waitForTimeout(300);
  };
  const hastaAbajo = async (sel) => {
    for (let i = 0; i < 25; i += 1) {
      const fin = await page.locator(sel).evaluate((n) => n.scrollTop + n.clientHeight >= n.scrollHeight - 1);
      if (fin) break;
      await gesto(sel);
    }
    return page.locator(sel).evaluate((n) => ({ top: Math.round(n.scrollTop), max: n.scrollHeight - n.clientHeight }));
  };
  return { context, page, gesto, hastaAbajo };
}

async function ordenador(page) {
  await menu(page).click();
  await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible({ timeout: 12000 });
  await page.waitForTimeout(400);
}

/** El elemento queda entero dentro de lo que el contenedor enseña, y por tanto no lo tapa ninguna barra. */
const dentro = (page, sel, css) =>
  page.evaluate(([s, c]) => {
    const caja = document.querySelector(s).getBoundingClientRect();
    const todos = document.querySelector(s).querySelectorAll(c);
    const r = todos[todos.length - 1].getBoundingClientRect();
    const barra = document.querySelector('.pp-taskbar')?.getBoundingClientRect().top ?? innerHeight;
    return r.bottom <= caja.bottom + 1 && r.bottom <= Math.max(barra, caja.bottom) + 1 && r.bottom <= innerHeight;
  }, [sel, css]);

const TAMANOS = [
  [390, 844],
  [320, 640],
  [844, 390],
];

for (const [ancho, alto] of TAMANOS) {
  test(`recorrer hasta el final a ${ancho} × ${alto}`, async ({ browser, browserName }, info) => {
    test.skip(!/^(chromium|webkit)-390x844$/.test(info.project.name), 'recorre él mismo los tamaños');
    test.skip(browserName === 'webkit' && ancho !== 390, 'en WebKit, a 390');
    test.setTimeout(180000);
    mkdirSync(DIR, { recursive: true });
    const { context, page, hastaAbajo } = await montar(browser, browserName, ancho, alto);
    const informe = {};
    await abrirCasa(page);
    await ordenador(page);
    for (const [app, ultimo] of [
      ['Calendario', 'button'],
      ['Mi diario', '.pcd-section'],
      ['Estadísticas', '.pc-card'],
    ]) {
      await page.getByRole('button', { name: app }).click();
      await page.waitForTimeout(500);
      const r = await hastaAbajo(CUERPO);
      informe[app] = r;
      expect(r.top, `${app}: llega al final`).toBe(r.max);
      if (r.max > 0 || alto < 700) expect(await dentro(page, CUERPO, ultimo), `${app}: el último se ve`).toBe(true);
      await page.screenshot({ path: join(DIR, `${browserName}-${ancho}-${app.replace(' ', '')}-final.png`) });
      await expect(page.getByRole('button', { name: 'Volver al escritorio' })).toBeInViewport();
      await expect(page.getByRole('button', { name: 'Salir del ordenador' })).toBeInViewport();
      if (app === 'Calendario') {
        // Se pulsa la última acción y se vuelve al mismo sitio
        await page.locator('.port-cal__list').getByRole('button', { name: /Registrar/ }).click();
        await expect(page.locator('.log-sheet')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('.log-sheet')).toBeHidden();
        await page.waitForTimeout(300);
      }
      await page.getByRole('button', { name: 'Volver al escritorio' }).click();
      await page.waitForTimeout(300);
      await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Aplicaciones' }).click();
    await page.waitForTimeout(400);
    const a = await hastaAbajo('.pp-apps');
    informe.Aplicaciones = a;
    expect(a.top).toBe(a.max);
    const ultimo = page.locator('.pp-apps button').last();
    await expect(ultimo).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: join(DIR, `${browserName}-${ancho}-Aplicaciones-final.png`) });
    // Abrir una función desde el final y volver: mismo cajón y mismo punto
    // Playwright acerca el botón antes de pulsarlo: lo que debe conservarse es la altura en el momento del toque
    await page.locator('.pp-apps').evaluate((n) => n.addEventListener('click', () => (window.__alto = n.scrollTop), { capture: true, once: true }));
    await page.locator('.pp-apps').getByRole('button', { name: 'Reto anual' }).click();
    const altoToque = await page.evaluate(() => window.__alto);
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Volver al escritorio' }).click();
    await page.waitForTimeout(400);
    await expect(page.locator('.pp-apps')).toBeVisible();
    expect(Math.abs((await page.locator('.pp-apps').evaluate((n) => n.scrollTop)) - altoToque), 'conserva el punto').toBeLessThanOrEqual(2);
    writeFileSync(join(DIR, `${browserName}-${ancho}.json`), JSON.stringify(informe, null, 1));
    await context.close();
  });
}

test('texto largo y campo con poco alto (teclado aproximado): el último control se alcanza', async ({ browser, browserName }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'Chromium');
  test.setTimeout(90000);
  const { context, page, hastaAbajo } = await montar(browser, browserName, 390, 844);
  await abrirCasa(page);
  await ordenador(page);
  await page.getByRole('button', { name: 'Aplicaciones' }).click();
  await page.locator('.pp-apps').getByRole('button', { name: 'Notas' }).click();
  await page.waitForTimeout(500);
  await page.locator(`${CUERPO} input[type="search"], ${CUERPO} .pcd-search input`).first().focus();
  // El teclado se aproxima reduciendo la ventana; Playwright no abre uno de verdad
  await page.setViewportSize({ width: 390, height: 460 });
  await page.waitForTimeout(500);
  const r = await hastaAbajo(CUERPO);
  expect(r.max).toBeGreaterThan(0);
  expect(r.top).toBe(r.max);
  await expect(page.locator(`${CUERPO} button`).last()).toBeInViewport();
  await context.close();
});

test('vídeo del gesto hasta el final y vuelta', async ({ browser, browserName }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'el vídeo, a 390');
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  const { context, page, gesto, hastaAbajo } = await montar(browser, browserName, 390, 844, { recordVideo: { dir: join(DIR, 'bruto'), size: { width: 390, height: 844 } } });
  await abrirCasa(page);
  await ordenador(page);
  for (const app of ['Mi diario', 'Estadísticas', 'Calendario']) {
    await page.getByRole('button', { name: app }).click();
    await page.waitForTimeout(1200);
    await gesto(CUERPO);
    await page.waitForTimeout(500);
    await hastaAbajo(CUERPO);
    await page.waitForTimeout(1400);
    await page.getByRole('button', { name: 'Volver al escritorio' }).click();
    await page.waitForTimeout(900);
  }
  await page.getByRole('button', { name: 'Aplicaciones' }).click();
  await page.waitForTimeout(1000);
  await hastaAbajo('.pp-apps');
  await page.waitForTimeout(1200);
  await page.locator('.pp-apps').getByRole('button', { name: 'Reto anual' }).click();
  await page.waitForTimeout(1400);
  await hastaAbajo(CUERPO);
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Volver al escritorio' }).click();
  await page.waitForTimeout(1600);
  const video = page.video();
  await context.close();
  writeFileSync(join(DIR, 'bruto', 'ruta.txt'), await video.path());
});
