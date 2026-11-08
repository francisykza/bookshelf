// 1.90 · Evidencias con sonido: el recorrido principal y la muestra de escucha. El audio se toma de la salida real del AudioContext de la app
// (cada conexión a los altavoces se copia también a un MediaRecorder); no se añade nada en edición.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { abrirCasa } from './v190-apoyo';

const DIR = join('qa-report', 'v190', 'evidencias');

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

async function guardarAudio(page, ruta) {
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
  writeFileSync(ruta, Buffer.from(datos.b64, 'base64'));
  return datos.epoch;
}

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'las evidencias, a 390');
  mkdirSync(DIR, { recursive: true });
});

const pausa = (page, ms) => page.waitForTimeout(ms);
const menu = (page) => page.getByRole('button', { name: 'Menú de accesos' });

test('recorrido principal', async ({ browser }) => {
  test.setTimeout(240000);
  const context = await browser.newContext({ baseURL: 'http://localhost:5196', locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, recordVideo: { dir: DIR, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const inicioVideo = Date.now();
  await page.addInitScript(grabador);
  await abrirCasa(page);
  await pausa(page, 3000);
  await menu(page).click();
  await pausa(page, 2200);
  await page.getByRole('button', { name: 'Sonido' }).click();
  await pausa(page, 2500);
  await page.getByRole('button', { name: 'Activar sonido' }).click();
  await expect.poll(() => page.evaluate(() => window.__portAudio().musica), { timeout: 15000 }).toBe('tarde');
  await pausa(page, 6000);
  await page.getByRole('button', { name: 'Cerrar Sonido' }).click();
  await pausa(page, 1500);
  await menu(page).click();
  await pausa(page, 1200);
  await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible({ timeout: 12000 });
  await pausa(page, 3500);
  await page.getByRole('button', { name: 'Calendario' }).click();
  await pausa(page, 3000);
  const dia = page.locator('.port-cal__day').nth(3);
  await dia.click();
  await pausa(page, 3000);
  await page.locator('.port-cal__list').getByRole('button', { name: /Registrar/ }).click();
  await expect(page.locator('.log-sheet')).toBeVisible();
  await pausa(page, 2500);
  await page.getByRole('radio', { name: /He leído/ }).click();
  await pausa(page, 900);
  await page.locator('.reading-form__input input').pressSequentially('12', { delay: 350 });
  await pausa(page, 2500);
  await page.locator('.reading-form__save').click();
  await expect(page.locator('.log-toast')).toContainText('Lectura registrada');
  await pausa(page, 4000);
  await page.getByRole('button', { name: 'Salir del ordenador' }).click();
  await pausa(page, 3500);
  await menu(page).click();
  await pausa(page, 1500);
  await page.getByRole('button', { name: 'Ver de noche' }).click();
  await pausa(page, 3500);
  await menu(page).click();
  await pausa(page, 1200);
  await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible({ timeout: 12000 });
  await pausa(page, 3500);
  await page.getByRole('button', { name: 'Salir del ordenador' }).click();
  await pausa(page, 1500);
  await menu(page).click();
  await pausa(page, 1000);
  await page.getByRole('button', { name: 'Sonido' }).click();
  await pausa(page, 2000);
  await page.locator('#sonido-music').fill('35');
  await pausa(page, 3500);
  await page.locator('#sonido-ambience').fill('5');
  await pausa(page, 3000);
  await page.getByRole('switch', { name: /Sonido/ }).uncheck();
  await pausa(page, 3000);
  const epoch = await guardarAudio(page, join(DIR, 'recorrido-audio.webm'));
  const video = page.video();
  await context.close();
  await video.saveAs(join(DIR, 'recorrido-video.webm'));
  await video.delete();
  writeFileSync(join(DIR, 'recorrido.json'), JSON.stringify({ desplazamientoAudioMs: Math.round(epoch - inicioVideo) }, null, 1));
});

test('muestra de escucha', async ({ browser }) => {
  test.setTimeout(300000);
  const context = await browser.newContext({ baseURL: 'http://localhost:5196', locale: 'es-ES', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.addInitScript(grabador);
  await abrirCasa(page);
  await menu(page).click();
  await page.getByRole('button', { name: 'Sonido' }).click();
  await page.getByRole('button', { name: 'Activar sonido' }).click();
  await expect.poll(() => page.evaluate(() => window.__portAudio().musica), { timeout: 15000 }).toBe('tarde');
  const t0 = await page.evaluate(() => window.__recEpoch);
  const marcas = [];
  const marca = async (nombre) => marcas.push({ nombre, segundo: Math.round((await page.evaluate(() => Date.now())) - t0) / 1000 });
  const nivel = (id, v) => page.locator(`#sonido-${id}`).fill(String(v));
  const elige = (nombre) => page.getByLabel(nombre, { exact: true }).check();

  // Sin fondo, cada efecto una vez al nivel de fábrica
  await elige('Sin ambiente');
  await elige('Sin música');
  await pausa(page, 1500);
  for (const efecto of ['ui-press', 'panel-open', 'panel-close', 'computer-open', 'save-success', 'save-error']) {
    await marca(`efecto ${efecto}`);
    await page.evaluate((e) => window.__playUiSound(e), efecto);
    await pausa(page, 1500);
  }
  // Un ciclo completo de cada pista, sola y al 50 % para juzgar timbre y unión; más dos segundos para oír el bucle
  await nivel('music', 50);
  await nivel('ambience', 50);
  for (const [tipo, nombre] of [['m', 'Tarde en el puerto'], ['m', 'Luz de escritorio'], ['a', 'Lluvia']]) {
    await elige(tipo === 'm' ? 'Sin ambiente' : 'Sin música');
    await elige(nombre);
    await pausa(page, 1200);
    await marca(`bucle ${nombre}`);
    await pausa(page, 34500);
    await elige(tipo === 'm' ? 'Sin música' : 'Sin ambiente');
    await pausa(page, 1500);
  }
  // La mezcla con los valores de fábrica
  await nivel('music', 12);
  await nivel('ambience', 15);
  await elige('Lluvia');
  await elige('Tarde en el puerto');
  await pausa(page, 1200);
  await marca('mezcla de fábrica: música 12, ambiente 15, efectos 25');
  await pausa(page, 8000);
  await page.evaluate(() => window.__playUiSound('save-success'));
  await pausa(page, 4000);
  await guardarAudio(page, join(DIR, 'escucha.webm'));
  writeFileSync(join(DIR, 'escucha.json'), JSON.stringify(marcas, null, 1));
  await context.close();
});
