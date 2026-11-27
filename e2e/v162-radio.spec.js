// QA del bloque 3 de la 1.62 (SPEC §62.3): la radio del rincón. Un solo reproductor para toda la app, nada suena ni se
// descarga antes de pulsar «Reproducir», el estado es el del reproductor (no el del clic), volúmenes recordados y
// recarga en pausa, temporizador por hora límite, error dicho, y el control compacto del lector EPUB sin perder el sitio.
// Emulación de Chromium y WebKit: nada de esto equivale a un iPhone real (ni a su reproducción en segundo plano).
import { expect, test } from '@playwright/test';
import JSZip from 'jszip';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { abrirLibroActual, esperarInicio } from './entrada';
import { abrir, inicio } from './entrada';

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

const MP3 = '/media/social-radio/brisa-de-papel-demo.mp3';

/** Cuenta los elementos de audio que crea la app (debe haber uno como mucho, y solo tras pulsar «Reproducir»). */
async function watchAudio(page) {
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    window.__audios = [];
    const Native = window.Audio;
    window.Audio = function Audio(...args) {
      const a = new Native(...args);
      window.__audios.push(a);
      return a;
    };
  });
}

// 1.157: sin el salón ilustrado (su radio de la mesa), se entra en el inicio y la radio se abre como desde el piso
async function toSalon(page) {
  await inicio(page);
}

const panel = (page) => page.getByRole('dialog', { name: 'La radio del rincón' });
async function openRadio(page) {
  await abrir(page, { type: 'radio' });
}

const audios = (page) => page.evaluate(() => window.__audios.map((a) => ({ paused: a.paused, src: a.getAttribute('src') })));

test('temporizador por hora límite: pausa la música, también al volver del segundo plano; y el error se dice', async ({ page }, info) => {
  test.skip(!/390x844$/.test(info.project.name) || info.project.name.startsWith('webkit'), 'una vez, en Chromium');
  await watchAudio(page);
  await toSalon(page);
  await openRadio(page);
  await panel(page).getByRole('button', { name: 'Reproducir la música' }).click();
  await expect(panel(page).getByRole('status')).toHaveText('Sonando', { timeout: 15000 });
  await panel(page).getByRole('radio', { name: '15 min' }).click();
  await expect(panel(page)).toContainText('Se apagará a las');
  // Antes de la hora límite, volver a la app no la apaga
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(panel(page).getByRole('status')).toHaveText('Sonando');
  // Segundo plano: la hora límite pasa sin que corra el temporizador (el reloj del sistema avanza una hora); al volver
  // se comprueba la hora límite
  await page.evaluate(() => {
    const real = Date.now.bind(Date);
    Date.now = () => real() + 60 * 60000;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(panel(page).getByRole('status')).toHaveText('La música se ha apagado con el temporizador.');
  await expect(panel(page).getByRole('radio', { name: 'No' })).toBeChecked();
  expect(await audios(page)).toEqual([{ paused: true, src: MP3 }]);
  // Pista que no carga: se dice, sin fingir que suena
  await page.route(`**${MP3}`, (route) => route.abort());
  await page.evaluate(() => {
    const a = window.__audios[0];
    a.removeAttribute('src');
    a.load();
  });
  await panel(page).getByRole('button', { name: 'Reproducir la música' }).click();
  await expect(panel(page).getByRole('alert')).toContainText('No se ha podido', { timeout: 10000 });
  await expect(panel(page).getByRole('button', { name: 'Reproducir la música' })).toBeVisible();
});

// ── Lector EPUB ─────────────────────────────────────────────────────────────────────────────────────────────────────
const PARA = 'la luz de la tarde entraba por la ventana y el mar seguía su ritmo tranquilo mientras alguien leía en silencio.';
async function makeEpub() {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/c.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const x = (b, t) => `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${t}</title></head><body>${b}</body></html>`;
  const paras = (n, s) => Array.from({ length: n }, (_, k) => `<p>Párrafo ${k + 1} de la sección ${s}: ${PARA}</p>`).join('');
  zip.file('OEBPS/s1.xhtml', x(`<h1>Capítulo primero</h1>${paras(40, 1)}`, 'Uno'));
  zip.file('OEBPS/s2.xhtml', x(`<h1>Dos</h1>${paras(20, 2)}`, 'Dos'));
  zip.file('OEBPS/nav.xhtml', '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="s1.xhtml">Uno</a></li><li><a href="s2.xhtml">Dos</a></li></ol></nav></body></html>');
  zip.file('OEBPS/c.opf', `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Circe</dc:title><dc:creator>Madeline Miller</dc:creator></metadata><manifest><item id="s1" href="s1.xhtml" media-type="application/xhtml+xml"/><item id="s2" href="s2.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="s1"/><itemref idref="s2"/></spine></package>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

/** Primer párrafo visible (paginado) o el de arriba (continuo). */
const anchorText = (page) =>
  page.evaluate(() => {
    const paged = document.querySelector('.epub-reader').dataset.mode === 'paged';
    const el = document.querySelector('.epub-reader__page');
    const f = document.querySelector('.epub-reader__frame');
    for (const b of f.contentDocument.querySelectorAll('[data-bs-block]')) {
      if (paged) {
        const r = [...b.getClientRects()].find((x) => x.right > 1 && x.left < f.clientWidth - 1);
        if (r) return b.textContent.slice(0, 30);
      } else if (b.offsetTop > el.scrollTop + 8) return (b.previousElementSibling ?? b).textContent.slice(0, 30);
    }
    return null;
  });

test('lector EPUB: la música es opcional, el control compacto va en el pie y abrir o cerrar la radio no mueve la lectura', async ({ page }, info) => {
  test.skip(/844x390|412|reduced/.test(info.project.name), 'tamaños del bloque');
  await watchAudio(page);
  await page.goto('/');
  await esperarInicio(page);
  await page.waitForTimeout(300);
  await abrirLibroActual(page);
  await page.locator('.epub-box input[type=file]').setInputFiles({ name: 'circe.epub', mimeType: 'application/epub+zip', buffer: await makeEpub() });
  await page.getByRole('dialog', { name: 'Vincular EPUB' }).getByRole('button', { name: /Vincular/ }).click();
  const reader = page.getByRole('dialog', { name: /^Leer / });
  await expect(page.frameLocator('.epub-reader__frame').getByRole('heading', { name: /Capítulo primero/ })).toBeVisible();
  await page.waitForTimeout(800);
  // Sin música elegida, nada de radio en el pie
  await expect(reader.locator('.radio-mini')).toHaveCount(0);
  await page.locator('.epub-reader__page').evaluate((el) => (el.scrollTop = el.scrollHeight / 3));
  await page.waitForTimeout(600);
  const before = await anchorText(page);
  await reader.getByRole('button', { name: 'Ambiente', exact: true }).click();
  await page.getByRole('button', { name: 'Música: la radio del rincón' }).click();
  const sheet = page.getByRole('dialog', { name: 'La radio del rincón' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Reproducir la música' }).click();
  await expect(sheet.getByRole('status')).toHaveText('Sonando', { timeout: 15000 });
  await page.getByRole('button', { name: 'Volver a la lectura' }).click();
  await expect(sheet).toHaveCount(0);
  // El control compacto aparece en el pie, sin tapar el texto, y la lectura sigue donde estaba
  const mini = reader.locator('.radio-mini');
  await expect(mini).toBeVisible();
  await page.waitForTimeout(800);
  expect(await anchorText(page)).toBe(before);
  const pageBox = await reader.locator('.epub-reader__page').boundingBox();
  const miniBox = await mini.boundingBox();
  expect(miniBox.y).toBeGreaterThanOrEqual(pageBox.y + pageBox.height - 1);
  await shot(page, info, 'v162-radio-epub');
  await mini.getByRole('button', { name: 'Pausar la música' }).click();
  await expect(mini).toContainText('En pausa');
  await mini.getByRole('button', { name: 'Abrir la radio' }).click();
  await expect(sheet.getByRole('status')).toHaveText('En pausa');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(reader).toBeVisible();
  expect(await anchorText(page)).toBe(before);
  expect((await audios(page)).length).toBe(1);
});
