// 1.59 (SPEC §59): medición de la biblioteca grande con datos sintéticos aislados (perfil de Playwright propio, nunca
// la cuenta real). 100, 1.000 y 1.500 libros: con portada, sin portada y con URL fallida (404). Mismas condiciones en
// cada pasada: Chromium móvil 390 × 844 a 2×, CPU ralentizada ×4 por CDP, portadas servidas por una ruta local.
// Uso: node scripts/perf-large-library.mjs [salida.json] [tamaños, p. ej. 100,1000,1500]
// Necesita el servidor de desarrollo (lo arranca él en el puerto 5197) porque lee el React Profiler (`__bsPerf`).
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const PORT = 5197;
const OUT = process.argv[2] ?? 'qa-report/perf-large-library.json';
const SIZES = (process.argv[3] ?? '100,1000,1500').split(',').map(Number);
const CPU = 4;

const STATUSES = ['read', 'read', 'read', 'want', 'want', 'reading', 'abandoned'];
const WORDS = ['mar', 'luz', 'bruma', 'ceniza', 'jardín', 'faro', 'invierno', 'río', 'casa', 'sombra', 'viento', 'piedra'];

/** Biblioteca sintética determinista: 60 % con portada, 25 % sin portada, 15 % con URL que falla. */
export function syntheticBooks(n) {
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

async function waitServer() {
  for (let i = 0; i < 120; i += 1) {
    try {
      const r = await fetch(`http://localhost:${PORT}/`);
      if (r.ok) return;
    } catch {
      // aún arrancando
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('El servidor de desarrollo no arrancó');
}

/** Ejecuta una acción en la página y mide hasta que se cumple la condición y se pintan dos fotogramas. */
async function timed(page, action, condition, arg) {
  return page.evaluate(
    async ([actionSrc, condSrc, a]) => {
      const act = new Function('a', actionSrc);
      const cond = new Function('a', condSrc);
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      const t0 = performance.now();
      act(a);
      const limit = t0 + 15000;
      while (!cond(a)) {
        if (performance.now() > limit) return -1;
        await frame();
      }
      await frame();
      await frame();
      return Math.round(performance.now() - t0);
    },
    [action, condition, arg],
  );
}

const perf = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__bsPerf ?? {})));
const resetPerf = (page) => page.evaluate(() => (window.__bsPerf = {}));
const diff = (a, b) => Object.fromEntries(Object.keys(b).map((k) => [k, { commits: b[k].commits - (a[k]?.commits ?? 0), ms: Math.round(b[k].ms - (a[k]?.ms ?? 0)) }]));

async function measure(browser, n, jpeg) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES' });
  const requests = { ok: 0, fail: 0, other: 0 };
  await context.route('https://covers.openlibrary.org/**', (route) => {
    const url = route.request().url();
    if (url.includes('fallo-')) {
      requests.fail += 1;
      return route.fulfill({ status: 404, body: '' });
    }
    requests.ok += 1;
    return route.fulfill({ status: 200, contentType: 'image/jpeg', body: jpeg, headers: { 'access-control-allow-origin': '*' } });
  });
  // Nada externo más (tipografías, Open Library…): que la red no meta ruido
  await context.route(/^https:\/\/(?!covers\.openlibrary\.org)/, (route) => {
    requests.other += 1;
    return route.abort();
  });
  const books = syntheticBooks(n);
  await context.addInitScript(
    ([state]) => {
      if (sessionStorage.getItem('perf-seeded')) return;
      localStorage.clear();
      localStorage.setItem('bookshelf_onboarding_done', 'true');
      localStorage.setItem('bookshelf:signs-hint-done', 'true');
      localStorage.setItem('bookshelf:v1', state);
      sessionStorage.setItem('perf-seeded', '1');
    },
    [JSON.stringify({ version: 6, books, settings: { sound: false, viewMode: process.env.PERF_MODE ?? 'cover', owner: 'Prueba' } })],
  );
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const r = { books: n };
  r.loadToRoomMs = Date.now() - t0;
  r.room = {
    mountedBooks: await page.locator('.library [data-book-id]').count(),
    coverRequests: requests.ok + requests.fail,
    renders: await perf(page),
  };

  // Abrir la biblioteca
  await resetPerf(page);
  const before = { ...requests };
  r.openLibraryMs = await timed(page, `document.querySelector('[data-panel="MAIN_ROOM"] .hotspot[data-id="shelf"]').click()`, `return document.querySelector('.library[data-phase="shelf"]')`);
  await page.waitForTimeout(1500);
  r.library = {
    mountedBooks: await page.locator('.library [data-book-id]').count(),
    coverRequestsOnOpen: requests.ok + requests.fail - before.ok - before.fail,
    renders: await perf(page),
  };

  // Cambio de filtro (Leídos y vuelta a Todos)
  let p0 = await perf(page);
  r.filterReadMs = await timed(page, `document.querySelector('.lib-cloth[data-status="read"]').click()`, `return document.querySelector('.lib-cloth[data-status="read"][aria-checked="true"]')`);
  r.filterAllMs = await timed(page, `document.querySelector('.lib-cloth[data-status="all"]').click()`, `return document.querySelector('.lib-cloth[data-status="all"][aria-checked="true"]')`);
  r.filterRenders = diff(p0, await perf(page));

  // Escritura en la búsqueda: cinco teclas, tiempo medio y máximo hasta pintar
  p0 = await perf(page);
  const input = page.locator('#shelf-search-input');
  await input.focus();
  const keys = [];
  for (const ch of 'bruma') {
    const t = Date.now();
    await input.press(ch);
    await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
    keys.push(Date.now() - t);
  }
  r.searchKeyMs = { avg: Math.round(keys.reduce((a, b) => a + b, 0) / keys.length), max: Math.max(...keys) };
  r.searchRenders = diff(p0, await perf(page));
  r.searchMountedBooks = await page.locator('.library [data-book-id]').count();
  await input.fill('');
  await page.waitForTimeout(600);

  // Desplazamiento: hasta el final a saltos de 600 px, un fotograma por salto; huecos sin libros pintados
  r.scroll = await page.evaluate(async () => {
    const el = document.querySelector('.library__shelves');
    const frame = () => new Promise((res) => requestAnimationFrame(() => res()));
    let worst = 0;
    let blank = 0;
    let steps = 0;
    const t0 = performance.now();
    let last = t0;
    while (el.scrollTop + el.clientHeight < el.scrollHeight - 2 && steps < 400) {
      el.scrollTop += 600;
      await frame();
      const now = performance.now();
      worst = Math.max(worst, now - last);
      last = now;
      steps += 1;
      // ¿Hay libros dibujados en el centro de la vista? (si no, se vería madera sin libros)
      const box = el.getBoundingClientRect();
      const y = box.top + box.height / 2;
      const hit = document.elementsFromPoint(box.left + box.width / 2, y).some((n) => n.closest?.('.lib-shelf, .keepsake-board, .shelf-row__head'));
      if (!hit) blank += 1;
    }
    return { steps, totalMs: Math.round(performance.now() - t0), worstFrameMs: Math.round(worst), framesWithoutShelf: blank, mountedAtEnd: document.querySelectorAll('.library [data-book-id]').length };
  });
  await page.evaluate(() => (document.querySelector('.library__shelves').scrollTop = 0));
  await page.waitForTimeout(500);

  // Abrir y cerrar la ficha del primer libro visible
  p0 = await perf(page);
  r.openBookMs = await timed(page, `document.querySelector('.library [data-book-id]').click()`, `return document.querySelector('[role="dialog"] .sheet-page')`);
  r.openBookRenders = diff(p0, await perf(page));
  await page.waitForTimeout(400);
  // Diario del libro (sección «Mi diario» de la ficha)
  r.openDiaryMs = await timed(
    page,
    `[...document.querySelectorAll('.book-sheet__tabs [role="tab"]')].find((b) => b.textContent.trim() === 'Diario')?.click()`,
    `const s = document.querySelector('[aria-label="Mi diario"]'); return s && !s.hidden`,
  );
  await page.waitForTimeout(300);
  p0 = await perf(page);
  r.closeBookMs = await timed(page, `history.back()`, `return !document.querySelector('[role="dialog"] .sheet-page')`);
  r.closeBookRenders = diff(p0, await perf(page));

  // Volver a la habitación
  r.backToRoomMs = await timed(page, `history.back()`, `return document.querySelector('.library[data-phase="room"]')`);
  r.coverRequestsTotal = { ok: requests.ok, fail: requests.fail };
  r.storageBytes = await page.evaluate(() => (localStorage.getItem('bookshelf:v1') ?? '').length);
  r.stringifyMs = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
    const t = performance.now();
    for (let i = 0; i < 5; i += 1) JSON.stringify(st);
    return Math.round(((performance.now() - t) / 5) * 10) / 10;
  });
  await context.close();
  return r;
}

const server = spawn(process.platform === 'win32' ? 'npx.cmd vite --port ' + PORT + ' --strictPort' : 'npx vite --port ' + PORT + ' --strictPort', { shell: true, stdio: 'ignore' });
try {
  await waitServer();
  const jpeg = await sharp({ create: { width: 180, height: 270, channels: 3, background: { r: 120, g: 80, b: 60 } } }).jpeg({ quality: 70 }).toBuffer();
  const browser = await chromium.launch();
  const results = [];
  for (const n of SIZES) {
    const r = await measure(browser, n, jpeg);
    console.log(JSON.stringify(r));
    results.push(r);
  }
  await browser.close();
  writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), cpuThrottle: CPU, viewport: '390x844@2', results }, null, 2));
  console.log(`Guardado en ${OUT}`);
} finally {
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  else server.kill();
}
