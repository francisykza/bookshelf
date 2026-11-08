// Puerto Pixel · menú, calendario y radio: medidas en seis tamaños, controles reales y un vídeo con el audio que sale de la app.
// Piso de prueba con Supabase simulado. Chromium emulado; no sustituye a un móvil físico.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { abrirCasa } from './v190-apoyo';

const DIR = join('qa-report', 'pixel-v4');
const TAMANOS = [
  [320, 640],
  [360, 800],
  [390, 844],
  [430, 932],
  [844, 390],
  [1440, 900],
];
const pausa = (page, ms) => page.waitForTimeout(ms);
const menu = (page) => page.getByRole('button', { name: 'Menú de accesos' });

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'recorre él mismo los tamaños');
  mkdirSync(join(DIR, 'capturas'), { recursive: true });
});

const sinDesborde = (locator) => locator.evaluate((n) => n.scrollWidth <= n.clientWidth);

for (const [ancho, alto] of TAMANOS) {
  test(`menú, calendario y radio a ${ancho} × ${alto}`, async ({ browser }) => {
    test.setTimeout(90000);
    const context = await browser.newContext({ baseURL: 'http://localhost:5196', locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: ancho, height: alto }, isMobile: ancho < 1000, hasTouch: ancho < 1000, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const foto = (n) => page.screenshot({ path: join(DIR, 'capturas', `${ancho}x${alto}-${n}.png`) });
    await abrirCasa(page);
    await menu(page).click();
    const hoja = page.locator('.port-menu__sheet');
    await pausa(page, 300);
    const caja = await hoja.boundingBox();
    expect(caja.y).toBeGreaterThanOrEqual(0);
    expect(caja.y + caja.height).toBeLessThanOrEqual(alto);
    expect(await sinDesborde(page.locator('.port-menu nav'))).toBe(true);
    // Registrar se ve sin desplazar, aunque la pantalla sea baja
    const registrar = await hoja.getByRole('button', { name: 'Registrar lectura de Circe' }).boundingBox();
    expect(registrar.y + registrar.height).toBeLessThanOrEqual(caja.y + caja.height);
    for (const b of await page.locator('.port-menu__sheet button').all()) {
      const r = await b.boundingBox();
      expect(r.height).toBeGreaterThanOrEqual(48);
    }
    await foto('menu');
    await page.getByRole('button', { name: 'Sonido' }).click();
    await expect(page.getByRole('heading', { name: 'Radio del puerto' })).toBeVisible();
    await page.getByRole('button', { name: 'Activar sonido' }).click();
    await pausa(page, 300);
    const cuerpo = page.locator('.pp-radio .port-sheet__body');
    expect(await sinDesborde(cuerpo)).toBe(true);
    await foto('radio');
    await page.getByRole('button', { name: 'Cerrar Sonido' }).click();
    await pausa(page, 300);
    await menu(page).click();
    await page.getByRole('button', { name: 'Calendario' }).click();
    await expect(page.locator('.port-cal')).toBeVisible();
    await pausa(page, 400);
    for (const d of (await page.locator('.port-cal__day').all()).slice(0, 7)) expect((await d.boundingBox()).height).toBeGreaterThanOrEqual(48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await foto('calendario');
    await context.close();
  });
}

test('radio: controles reales, silencio por canal y sin imagen en su lugar', async ({ page }) => {
  test.setTimeout(60000);
  await abrirCasa(page);
  await menu(page).click();
  await page.getByRole('button', { name: 'Sonido' }).click();
  await page.getByRole('button', { name: 'Activar sonido' }).click();
  const efectos = page.getByRole('slider', { name: /Efectos/ });
  await efectos.focus();
  await page.keyboard.press('ArrowRight');
  await expect(efectos).toHaveValue('26');
  const silencio = page.getByRole('button', { name: 'Silenciar Efectos' });
  await silencio.click();
  await expect(silencio).toHaveAttribute('aria-pressed', 'true');
  await expect(efectos).toHaveValue('0');
  await silencio.click();
  await expect(efectos).toHaveValue('26');
  await page.getByLabel('Lluvia', { exact: true }).check();
  await expect.poll(() => page.evaluate(() => window.__portAudio().ambiente), { timeout: 15000 }).toBe('lluvia');
  await page.getByRole('switch', { name: /Sonido/ }).uncheck();
  await expect(page.getByRole('switch', { name: 'Sonido silenciado' })).toBeVisible();
  await expect(efectos).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Radio del puerto' })).toBeHidden();
});

test('calendario: navegación de mes, día con lectura marcado y foco', async ({ page }) => {
  test.setTimeout(60000);
  await abrirCasa(page);
  await menu(page).click();
  await page.getByRole('button', { name: 'Calendario' }).click();
  const titulo = page.locator('.port-cal__head h3');
  const antes = await titulo.textContent();
  await page.getByRole('button', { name: 'Mes anterior' }).click();
  await expect(titulo).not.toHaveText(antes);
  await page.getByRole('button', { name: 'Mes siguiente' }).click();
  await expect(titulo).toHaveText(antes);
  const leido = page.locator('.port-cal__day[data-read]').first();
  await expect(leido.locator('i')).toBeVisible();
  await expect(leido).toHaveAttribute('aria-label', /con lectura/);
  await leido.click();
  await expect(leido).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.port-cal__list h3')).toHaveText(/^[A-ZÁÉÍÓÚ][a-záéíóú]+, \d+ de [a-z]+$/);
  await expect(page.locator('.port-cal__list .day-group').first()).toBeVisible();
  await page.screenshot({ path: join(DIR, 'capturas', 'calendario-con-lectura.png') });
});

function grabador() {
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function conectar(destino, ...resto) {
    const salida = connect.call(this, destino, ...resto);
    if (destino instanceof AudioDestinationNode) {
      const ctx = destino.context;
      if (!ctx.__copia) {
        ctx.__copia = ctx.createMediaStreamDestination();
        const rec = new MediaRecorder(ctx.__copia.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192000 });
        window.__trozos = [];
        rec.ondataavailable = (e) => window.__trozos.push(e.data);
        rec.start(1000);
        window.__rec = rec;
        window.__recEpoch = performance.timeOrigin + performance.now();
      }
      connect.call(this, ctx.__copia);
    }
    return salida;
  };
}

test('vídeo: menú, radio y calendario de día y de noche', async ({ browser }) => {
  test.setTimeout(240000);
  const context = await browser.newContext({ baseURL: 'http://localhost:5196', locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, recordVideo: { dir: join(DIR, 'bruto'), size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const inicioVideo = Date.now();
  await page.addInitScript(grabador);
  await abrirCasa(page);
  await pausa(page, 1500);
  await menu(page).click();
  await pausa(page, 2800);
  await page.getByRole('button', { name: 'Sonido' }).click();
  await pausa(page, 1800);
  await page.getByRole('button', { name: 'Activar sonido' }).click();
  await pausa(page, 2500);
  await page.locator('.pp-board').scrollIntoViewIfNeeded();
  await page.locator('#sonido-music').fill('35');
  await pausa(page, 1500);
  await page.getByRole('button', { name: 'Silenciar Música' }).click();
  await pausa(page, 1500);
  await page.getByRole('button', { name: 'Silenciar Música' }).click();
  await pausa(page, 1200);
  await page.getByLabel('Lluvia', { exact: true }).scrollIntoViewIfNeeded();
  await page.getByLabel('Lluvia', { exact: true }).check();
  await pausa(page, 3000);
  await page.getByLabel('Luz de escritorio', { exact: true }).check();
  await pausa(page, 3500);
  await page.getByRole('button', { name: 'Cerrar Sonido' }).click();
  await pausa(page, 900);
  await menu(page).click();
  await pausa(page, 1200);
  await page.getByRole('button', { name: 'Calendario' }).click();
  await expect(page.locator('.port-cal')).toBeVisible();
  await pausa(page, 2500);
  await page.getByRole('button', { name: 'Mes anterior' }).click();
  await pausa(page, 1500);
  await page.getByRole('button', { name: 'Mes siguiente' }).click();
  await pausa(page, 1200);
  await page.locator('.port-cal__day[data-read]').nth(1).click();
  await pausa(page, 3000);
  await page.locator('.port-cal__list').getByRole('button', { name: /Registrar/ }).click();
  await expect(page.locator('.log-sheet')).toBeVisible();
  await pausa(page, 1500);
  await page.getByRole('radio').first().click();
  await page.locator('.reading-form__input input').fill('12');
  await pausa(page, 1500);
  await page.locator('.reading-form__save').click();
  await expect(page.locator('.log-toast')).toBeVisible();
  await pausa(page, 3000);
  await page.getByRole('button', { name: 'Salir del ordenador' }).click();
  await pausa(page, 1500);
  await menu(page).click();
  await pausa(page, 800);
  await page.getByRole('button', { name: 'Ver de noche' }).click();
  await pausa(page, 1800);
  await menu(page).click();
  await pausa(page, 2800);
  await page.getByRole('button', { name: 'Sonido' }).click();
  await pausa(page, 3200);
  await page.getByRole('button', { name: 'Cerrar Sonido' }).click();
  await pausa(page, 800);
  await menu(page).click();
  await pausa(page, 800);
  await page.getByRole('button', { name: 'Calendario' }).click();
  await pausa(page, 3500);
  const datos = await page.evaluate(async () => {
    await new Promise((ok) => {
      window.__rec.onstop = ok;
      window.__rec.stop();
    });
    const buf = await new Blob(window.__trozos).arrayBuffer();
    let bin = '';
    new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
    return { b64: btoa(bin), epoch: window.__recEpoch };
  });
  writeFileSync(join(DIR, 'bruto', 'audio.webm'), Buffer.from(datos.b64, 'base64'));
  writeFileSync(join(DIR, 'bruto', 'desfase.txt'), String(Math.round(datos.epoch - inicioVideo)));
  const video = page.video();
  await context.close();
  writeFileSync(join(DIR, 'bruto', 'ruta.txt'), await video.path());
});
