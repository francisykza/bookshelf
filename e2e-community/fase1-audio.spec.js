// Fase 1 · B: con el sonido activado por un gesto, la pista elegida atraviesa el edificio sin reiniciarse; silencio y volúmenes. Graba vídeo y el audio interno.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { abrirCasa } from './v190-apoyo';

const DIR = join('qa-report', 'fase1', 'audio');
const menu = (page) => page.getByRole('button', { name: 'Menú de accesos' });
const estado = (page) => page.evaluate(() => ({ c: window.__portAudio(), e: { playing: performance.getEntriesByType('resource').some((r) => r.name.includes('dos-balcones')) } }));

function grabador() {
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function conectar(destino, ...resto) {
    const salida = connect.call(this, destino, ...resto);
    if (destino instanceof AudioDestinationNode) {
      const ctx = destino.context;
      if (!ctx.__copia) {
        ctx.__copia = ctx.createMediaStreamDestination();
        const rec = new MediaRecorder(ctx.__copia.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 160000 });
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

test('recorrido con audio real', async ({ browser }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'Chromium: el grabador usa MediaRecorder');
  test.setTimeout(150000);
  mkdirSync(join(DIR, 'bruto'), { recursive: true });
  const context = await browser.newContext({ baseURL: 'http://localhost:5196', locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, recordVideo: { dir: join(DIR, 'bruto'), size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const inicioVideo = Date.now();
  await page.addInitScript(grabador);
  await abrirCasa(page);
  await menu(page).click();
  await page.getByRole('button', { name: 'Sonido' }).click();
  await page.getByRole('button', { name: 'Activar sonido' }).click();
  await page.getByLabel('Luz de escritorio', { exact: true }).check();
  await page.waitForTimeout(3000);
  const inicio = await estado(page);
  expect(inicio.c.musica).toBe('luz');
  const arranques = inicio.c.starts;
  await page.getByRole('button', { name: 'Cerrar Sonido' }).click();
  await page.waitForTimeout(500);
  for (let vuelta = 0; vuelta < 2; vuelta += 1) {
    await menu(page).click();
    await page.getByRole('button', { name: 'Edificio', exact: true }).click();
    const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
    await expect(portal).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3500);
    let s = await estado(page);
    expect(s.c.musica).toBe('luz');
    expect(s.e.playing).toBe(false);
    await page.getByRole('button', { name: 'Cerrar el edificio' }).click();
    await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(3000);
    s = await estado(page);
    expect(s.c.musica).toBe('luz');
    expect(s.c.starts, 'no se reinicia').toBe(arranques);
    expect(s.e.playing).toBe(false);
    expect(s.c.fundiendo).toBe(0);
  }
  // Silencio inmediato, que dura al navegar; volúmenes por separado; al activar, la misma pista
  await menu(page).click();
  await page.getByRole('button', { name: 'Sonido' }).click();
  await page.locator('#sonido-music').fill('35');
  await page.waitForTimeout(1200);
  expect((await estado(page)).c.prefs.music).toBe(35);
  expect((await estado(page)).c.prefs.ambience).toBe(inicio.c.prefs.ambience);
  await page.getByRole('switch').first().click({ force: true });
  await page.waitForTimeout(900);
  expect((await estado(page)).c.prefs.on).toBe(false);
  await page.getByRole('button', { name: 'Cerrar Sonido' }).click();
  await menu(page).click();
  await page.getByRole('button', { name: 'Edificio', exact: true }).click();
  await page.waitForTimeout(2500);
  const mudo = await estado(page);
  expect(mudo.c.prefs.on).toBe(false);
  expect(mudo.e.playing).toBe(false);
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

test('con «Sin música» el edificio sigue en silencio de música', async ({ browser }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'Chromium');
  test.setTimeout(90000);
  const context = await browser.newContext({ baseURL: 'http://localhost:5196', locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const pedidas = [];
  page.on('request', (r) => /\.mp3/.test(r.url()) && pedidas.push(r.url()));
  await abrirCasa(page, { init: () => localStorage.getItem('bookshelf:v1') || localStorage.setItem('bookshelf:v1', JSON.stringify({ settings: { sound: true, sfx: true, uiVolume: 0.25 } })) });
  await menu(page).click();
  await page.getByRole('button', { name: 'Edificio', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'El edificio del puerto' })).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(3000);
  expect(pedidas.filter((u) => u.includes('dos-balcones'))).toEqual([]);
  expect((await estado(page)).c.musica).toBeNull();
  await context.close();
});
