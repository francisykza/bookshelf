// QA de la 1.59.0 (SPEC §59): biblioteca grande en el móvil. 1.500 libros sintéticos (con portada, sin portada y con URL
// que falla) en un perfil de Playwright propio: nada montado mientras la biblioteca está cerrada, filas virtuales sin
// huecos al desplazarse, geometría de las portadas estable, búsqueda y filtros sobre la colección completa, posición al
// volver de una ficha, aviso de lectura con caducidad real y registro con el teclado abierto.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditState } from './audit159';

const run = { project: '', tests: {}, pageErrors: [], consoleErrors: [], data: {}, screenshots: [], states: [] };

test.beforeEach(async ({ page }, info) => {
  run.project = info.project.name;
  page.on('pageerror', (err) => run.pageErrors.push({ test: info.title, text: String(err) }));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/covers\.openlibrary|Failed to load resource/.test(msg.text())) run.consoleErrors.push({ test: info.title, text: msg.text() });
  });
});
test.afterEach(async ({ page: _page }, info) => {
  run.tests[info.title] = { status: info.status, error: info.error?.message?.split('\n')[0] ?? null };
});
test.afterAll(async ({ browserName: _b }, info) => {
  const dir = join('qa-report', 'telemetry');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${run.project}-v159-w${info.workerIndex}.json`), JSON.stringify(run, null, 2));
});

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.png`);
  await page.screenshot({ path: file });
  run.screenshots.push(file.replaceAll('\\', '/'));
  // Cada captura es un estado auditado para la telemetría (desbordes, fondo, controles tapados, imágenes, consola)
  run.states.push(await auditState(page, name, run.consoleErrors.filter((e) => e.test === info.title)));
}

const STATUSES = ['read', 'read', 'read', 'want', 'want', 'reading', 'abandoned'];
const WORDS = ['mar', 'luz', 'bruma', 'ceniza', 'jardín', 'faro', 'invierno', 'río', 'casa', 'sombra', 'viento', 'piedra'];

/** Los mismos datos que `scripts/perf-large-library.mjs`: 60 % con portada, 25 % sin portada y 15 % con URL que falla. */
function syntheticBooks(n) {
  return Array.from({ length: n }, (_, i) => {
    const kind = i % 20 < 12 ? 'ok' : i % 20 < 17 ? 'none' : 'fail';
    const status = STATUSES[i % STATUSES.length];
    return {
      id: `syn-${i}`,
      title: `${WORDS[i % 12]} ${WORDS[(i * 7) % 12]} ${i}`,
      author: `Autora ${i % 97}`,
      status,
      pageCount: 120 + ((i * 37) % 600),
      currentPage: status === 'reading' ? 40 : 0,
      cover: kind === 'ok' ? `https://covers.openlibrary.org/b/id/${100000 + i}-M.jpg` : kind === 'fail' ? `https://covers.openlibrary.org/b/id/fallo-${i}-M.jpg` : '',
      addedAt: new Date(Date.UTC(2024, 0, 1) + i * 3600_000).toISOString(),
      finishedAt: status === 'read' ? new Date(Date.UTC(2024, 0, 1) + i * 86400_000).toISOString() : null,
      quotes: [],
    };
  });
}

// Portada de prueba: un JPEG de 60 × 90 px (generado una vez con sharp; más de 10 px de ancho, como una portada real)
const JPEG = Buffer.from(
  '/9j/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCABaADwDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAQF/8QAJBABAAAEBgIDAQAAAAAAAAAAAAEEERIFFBZko+EDIhNRYcH/xAAZAQEAAgMAAAAAAAAAAAAAAAAAAQMCBAX/xAAaEQEAAgMBAAAAAAAAAAAAAAAAESEBAiMx/9oADAMBAAIRAxEAPwCMBpOiAAAAAANrD8Bzsl45jNWX19fjrSkYw+/xitrD8eyUl45fK32V9vkpWsYx+v0Y7TFKNL73i7NL73i7NUbLl6NUbLl6FfQ0vveLs0vveLs1RsuXo1RsuXoOjGxCVyU75Je++yntSlawhH+plOITWdnfJMWWX09a1pSEIfxMLceWACQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH//Z',
  'base64',
);

/** Siembra la biblioteca sintética y sirve las portadas por una ruta local (cuenta cada URL pedida). */
async function seed(page, n) {
  const hits = new Map();
  await page.route('https://covers.openlibrary.org/**', (route) => {
    const url = route.request().url();
    hits.set(url, (hits.get(url) ?? 0) + 1);
    if (url.includes('fallo-')) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: 'image/jpeg', body: JPEG, headers: { 'cache-control': 'max-age=3600' } });
  });
  await page.addInitScript(
    ([state]) => {
      if (sessionStorage.getItem('v159-seeded')) return;
      localStorage.setItem('bookshelf_onboarding_done', 'true');
      localStorage.setItem('bookshelf:signs-hint-done', 'true');
      localStorage.setItem('bookshelf:v1', state);
      sessionStorage.setItem('v159-seeded', '1');
    },
    [JSON.stringify({ version: 6, books: syntheticBooks(n), settings: { sound: false, viewMode: 'cover', owner: 'Prueba' } })],
  );
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0, null, { timeout: 30_000 });
  await page.waitForTimeout(600);
  return hits;
}

async function openLibrary(page) {
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="shelf"]').evaluate((el) => el.click());
  await expect(page.locator('.library[data-phase="shelf"]')).toBeVisible();
  await page.waitForTimeout(300);
}

const mounted = (page) => page.locator('.library [data-book-id]').count();
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test('1.500 libros: nada montado en la habitación, filas virtuales sin huecos y portadas fallidas pedidas una vez', async ({ page }, info) => {
  test.skip(!/390x844|1440x900/.test(info.project.name), 'biblioteca grande en 390 × 844 (Chromium y WebKit) y escritorio');
  test.setTimeout(180_000);
  const hits = await seed(page, 1500);
  // Cerrada: ni libros montados ni portadas pedidas
  expect(await mounted(page)).toBe(0);
  expect([...hits.keys()].length).toBe(0);
  await openLibrary(page);
  await page.waitForTimeout(800);
  const open = await mounted(page);
  // Al abrir solo se piden las portadas de los libros montados (cerca de la vista), no las de toda la biblioteca
  expect(hits.size).toBeLessThanOrEqual(open);
  run.data.mountedOnOpen = open;
  expect(open).toBeGreaterThan(0);
  expect(open).toBeLessThan(160);
  await shot(page, info, 'v159-biblioteca-1500');

  // Desplazamiento hasta el final: en cada paso, libros dibujados en el centro de la vista (nunca madera sin libros)
  const result = await page.evaluate(async () => {
    const el = document.querySelector('.library__shelves');
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const blanks = [];
    let steps = 0;
    let maxMounted = 0;
    while (el.scrollTop + el.clientHeight < el.scrollHeight - 2 && steps < 600) {
      el.scrollTop += el.clientHeight * 0.9;
      await frame();
      await frame();
      steps += 1;
      const box = el.getBoundingClientRect();
      for (const f of [0.25, 0.5, 0.75]) {
        const nodes = document.elementsFromPoint(box.left + box.width / 2, box.top + box.height * f);
        const shelf = nodes.find((n) => n.classList?.contains('lib-shelf'));
        if (shelf?.classList.contains('lib-shelf--ghost')) blanks.push({ step: steps, f });
      }
      maxMounted = Math.max(maxMounted, document.querySelectorAll('.library [data-book-id]').length);
    }
    return { steps, blanks, maxMounted, atEnd: el.scrollTop + el.clientHeight >= el.scrollHeight - 2 };
  });
  run.data.scroll = result;
  expect(result.atEnd).toBe(true);
  expect(result.blanks).toEqual([]);
  expect(result.maxMounted).toBeLessThan(200);
  // El último libro de la última balda (Abandonados) está montado al final
  await expect(page.locator('.shelf-row[data-row="abandoned"] [data-book-id]').last()).toBeVisible();
  await shot(page, info, 'v159-biblioteca-final');

  // Vuelta arriba: una URL que falla no se vuelve a pedir al remontar su libro
  await page.evaluate(() => (document.querySelector('.library__shelves').scrollTop = 0));
  await frames(page);
  await page.waitForTimeout(400);
  const repeated = [...hits.entries()].filter(([url, n]) => url.includes('fallo-') && n > 1);
  run.data.coverRequests = { distinct: hits.size, repeatedFailures: repeated.length };
  expect(repeated).toEqual([]);
});

test('portadas: la misma geometría cargando, cargada, sin portada y con la URL rota', async ({ page }, info) => {
  test.skip(!/390x844|1440x900/.test(info.project.name), 'geometría en 390 × 844 y escritorio');
  // Portadas lentas: se mide antes y después de que lleguen
  let release;
  const gate = new Promise((r) => (release = r));
  await page.route('https://covers.openlibrary.org/**', async (route) => {
    await gate;
    if (route.request().url().includes('fallo-')) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: 'image/jpeg', body: JPEG });
  });
  await page.addInitScript(
    ([state]) => {
      localStorage.setItem('bookshelf_onboarding_done', 'true');
      localStorage.setItem('bookshelf:signs-hint-done', 'true');
      localStorage.setItem('bookshelf:v1', state);
    },
    [JSON.stringify({ version: 6, books: syntheticBooks(60), settings: { sound: false, viewMode: 'cover', owner: 'Prueba' } })],
  );
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0, null, { timeout: 30_000 });
  await openLibrary(page);
  const measure = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.library .shelf-row[data-row="read"] .lib-shelf:not(.lib-shelf--ghost)')].slice(0, 4).map((line) => ({
        line: Math.round(line.getBoundingClientRect().height),
        covers: [...line.querySelectorAll('.pbook__cover')].map((c) => {
          const r = c.getBoundingClientRect();
          return Math.round((r.height / r.width) * 100) / 100;
        }),
      })),
    );
  const before = await measure();
  release();
  await page.waitForTimeout(1200);
  const after = await measure();
  run.data.geometry = { before, after };
  expect(after.map((l) => l.line)).toEqual(before.map((l) => l.line));
  // Cada portada conserva su proporción al llegar la imagen, y es la misma con portada, sin ella y con la URL rota
  expect(after.map((l) => l.covers)).toEqual(before.map((l) => l.covers));
  const ratios = after.flatMap((l) => l.covers);
  expect(Math.max(...ratios) - Math.min(...ratios)).toBeLessThan(0.02);
  await shot(page, info, 'v159-portadas-estables');
});

test('búsqueda y filtros sobre toda la colección; la ficha devuelve a la misma posición', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), 'flujo en 390 × 844');
  test.setTimeout(120_000);
  await seed(page, 1500);
  await openLibrary(page);
  // Un libro del final de la lista se encuentra (la búsqueda no depende de lo montado)
  await page.locator('#shelf-search-input').fill('1499');
  // La búsqueda se aplica un paso por detrás de lo escrito: se espera a que quede solo ese libro
  await expect.poll(() => mounted(page)).toBe(1);
  await expect(page.locator('.library [data-book-id="syn-1499"]')).toBeVisible();
  await page.locator('#shelf-search-input').fill('');
  // Filtro: la cantidad de la balda es la real
  await page.locator('.lib-cloth[data-status="read"]').click();
  const reads = syntheticBooks(1500).filter((b) => b.status === 'read').length;
  await expect(page.locator('.shelf-row[data-row="read"] .shelf-row__count')).toHaveText(`· ${reads}`);
  await page.locator('.lib-cloth[data-status="all"]').click();
  // Posición: bajar, abrir una ficha y volver
  await page.evaluate(() => (document.querySelector('.library__shelves').scrollTop = 9000));
  await frames(page);
  await page.waitForTimeout(300);
  const at = await page.evaluate(() => document.querySelector('.library__shelves').scrollTop);
  // Un libro que está a la vista (no uno de arriba: Playwright desplazaría la página hasta él)
  const id = await page.evaluate(() => {
    const box = document.querySelector('.library__shelves').getBoundingClientRect();
    return [...document.querySelectorAll('.library [data-book-id]')].find((n) => {
      const r = n.getBoundingClientRect();
      return r.top > box.top + 40 && r.bottom < box.bottom - 40;
    })?.dataset.bookId;
  });
  await page.locator(`.library [data-book-id="${id}"]`).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await frames(page);
  expect(Math.abs((await page.evaluate(() => document.querySelector('.library__shelves').scrollTop)) - at)).toBeLessThan(2);
  await expect(page.locator(`.library [data-book-id="${id}"]`)).toBeInViewport();
  // Volver a la habitación y entrar otra vez: misma posición
  await page.goBack();
  await expect(page.locator('.library[data-phase="room"]')).toHaveCount(1);
  expect(await mounted(page)).toBe(0);
  await openLibrary(page);
  await frames(page);
  expect(Math.abs((await page.evaluate(() => document.querySelector('.library__shelves').scrollTop)) - at)).toBeLessThan(2);
});

/** La app con su biblioteca de ejemplo (Circe en la cama), sin guía. */
async function loadSample(page) {
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.waitForTimeout(300);
}

test('aviso «Lectura registrada»: caduca 8 s después del registro aunque un panel lo oculte; un solo registro', async ({ page }, info) => {
  test.skip(!/390x844$/.test(info.project.name), 'el registro se abre desde el libro grande de la cama (390 × 844)');
  await loadSample(page);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).progress.readingLog.length);
  await page.getByRole('button', { name: /^Registrar lectura de / }).click();
  await page.getByRole('radio', { name: 'He leído' }).click();
  await page.locator('.panel--log input[inputmode]').fill('12');
  await page.getByRole('button', { name: 'Guardar lectura' }).click();
  const toast = page.locator('.log-toast');
  await expect(toast).toContainText('Lectura registrada');
  await expect(toast).toBeInViewport();
  // Tras su entrada (160 ms), la captura lo muestra entero
  await page.waitForTimeout(400);
  await shot(page, info, 'v159-aviso-lectura');
  // Se abre otro panel (el aviso queda oculto) y se cierra cuando ya han pasado los 8 s del registro
  await page.getByRole('button', { name: 'Ambiente' }).click();
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="laptop"]').evaluate((el) => el.click());
  await expect(page.locator('.panel-veil')).toBeVisible();
  await expect(toast).toHaveCount(0);
  await page.waitForTimeout(8500);
  await page.keyboard.press('Escape');
  await expect(page.locator('.panel-veil')).toHaveCount(0);
  await page.waitForTimeout(400);
  await expect(toast).toHaveCount(0);
  // Un solo registro guardado (ni eventos ni guardados duplicados)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).progress.readingLog.length)).toBe(before + 1);
});

test('registrar lectura con el teclado abierto: el panel cabe en la parte visible y el título no sube bajo la barra', async ({ page }, info) => {
  test.skip(!/390x844$/.test(info.project.name), 'teclado simulado en 390 × 844 (Chromium y WebKit)');
  // visualViewport simulado: el teclado de iOS deja 430 px visibles y desplaza la vista 120 px hacia abajo
  await page.addInitScript(() => {
    const target = new EventTarget();
    const vv = Object.assign(target, { offsetTop: 0, offsetLeft: 0, height: innerHeight, width: innerWidth, scale: 1, pageTop: 0, pageLeft: 0 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => vv });
    window.__keyboard = (open) => {
      vv.height = open ? 430 : innerHeight;
      vv.offsetTop = open ? 120 : 0;
      vv.dispatchEvent(new Event('resize'));
      vv.dispatchEvent(new Event('scroll'));
    };
  });
  await loadSample(page);
  await page.getByRole('button', { name: /^Registrar lectura de / }).click();
  await page.getByRole('radio', { name: 'Porcentaje' }).click();
  await page.locator('.panel--log input[inputmode]').focus();
  await page.evaluate(() => window.__keyboard(true));
  await page.waitForTimeout(200);
  const m = await page.evaluate(() => {
    const veil = document.querySelector('.panel-veil[data-variant="log"]').getBoundingClientRect();
    const panel = document.querySelector('.panel--log');
    const r = panel.getBoundingClientRect();
    const close = document.querySelector('.log-sheet__close').getBoundingClientRect();
    return { veilTop: veil.top, veilH: veil.height, top: r.top, bottom: r.bottom, scrolls: panel.scrollHeight > panel.clientHeight, closeTop: close.top };
  });
  expect(m.veilTop).toBe(120);
  expect(m.veilH).toBe(430);
  // El panel (con su título y el cierre) empieza dentro de la parte visible y no la desborda: se desplaza por dentro
  expect(m.top).toBeGreaterThanOrEqual(120);
  expect(m.bottom).toBeLessThanOrEqual(120 + 430 + 1);
  expect(m.closeTop).toBeGreaterThanOrEqual(120);
  await expect(page.locator('.panel--log input[inputmode]')).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Guardar lectura' })).toHaveCount(1);
  await shot(page, info, 'v159-registro-teclado');
  // Al cerrar el teclado, el velo vuelve a ocupar la pantalla entera
  await page.evaluate(() => window.__keyboard(false));
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => document.querySelector('.panel-veil[data-variant="log"]').getBoundingClientRect().height)).toBe(844);
});

test('vista de lomos con 1.500 libros: solo los cercanos montados y la balda llega entera hasta el final', async ({ page }, info) => {
  test.skip(!/390x844$|1440x900/.test(info.project.name), 'lomos en 390 × 844 y escritorio');
  test.setTimeout(120_000);
  await seed(page, 1500);
  await openLibrary(page);
  await page.getByRole('button', { name: 'Vista y herramientas' }).click();
  await page.getByRole('radio', { name: 'Lomos' }).click();
  await page.getByRole('button', { name: 'Vista y herramientas' }).click();
  await expect(page.locator('.library .spine').first()).toBeVisible();
  const open = await mounted(page);
  run.data.spinesOnOpen = open;
  expect(open).toBeLessThan(400);
  // Balda de leídos (643 libros): al final de su desplazamiento está el último, pegado al borde de la pista
  const row = page.locator('.shelf-row[data-row="read"] .shelf-row__scroller');
  const end = await row.evaluate(async (el) => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    let blanks = 0;
    while (el.scrollLeft + el.clientWidth < el.scrollWidth - 2) {
      el.scrollLeft += el.clientWidth * 0.9;
      await frame();
      await frame();
      const box = el.getBoundingClientRect();
      // Algún lomo montado en el centro de la vista (con margen para la separación de 3 px entre lomos)
      const cx = box.left + box.width / 2;
      const hit = [...el.querySelectorAll('.spine')].some((n) => {
        const r = n.getBoundingClientRect();
        return r.left <= cx + 5 && r.right >= cx - 5;
      });
      if (!hit) blanks += 1;
    }
    const spines = [...el.querySelectorAll('.spine')];
    const last = spines[spines.length - 1];
    return { blanks, lastId: last.dataset.bookId, gapToEnd: Math.round(el.getBoundingClientRect().right - last.getBoundingClientRect().right) };
  });
  run.data.spinesEnd = end;
  expect(end.blanks).toBe(0);
  const reads = syntheticBooks(1500).filter((b) => b.status === 'read');
  expect(await page.locator(`.shelf-row[data-row="read"] [data-book-id="${end.lastId}"]`).getAttribute('aria-label')).toContain(', de ');
  expect(reads.some((b) => b.id === end.lastId)).toBe(true);
  // El último lomo de la balda acaba junto al final de la pista (los huecos tienen el ancho exacto)
  expect(Math.abs(end.gapToEnd)).toBeLessThan(80);
  await shot(page, info, 'v159-lomos-1500');
});
