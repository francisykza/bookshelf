// QA de la 1.34.0 (SPEC §27): librería modular con texturas gouache, cabecera compacta, recuerdo destacado e
// hiedra; ficha reordenada con «Registrar lectura» y detalles plegados; diario como cuaderno; paneles.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const run = { project: '', tests: {}, pageErrors: [], data: {}, screenshots: [] };

test.beforeEach(async ({ page }, info) => {
  run.project = info.project.name;
  page.on('pageerror', (err) => run.pageErrors.push({ test: info.title, text: String(err) }));
  await page.addInitScript(() => {
    try {
      localStorage.setItem('bookshelf_onboarding_done', 'true');
    } catch {
      // sin almacenamiento
    }
  });
});
test.afterEach(async ({ page: _page }, info) => {
  run.tests[info.title] = { status: info.status, error: info.error?.message?.split('\n')[0] ?? null };
});
test.afterAll(async ({ browserName: _b }, info) => {
  const dir = join('qa-report', 'telemetry');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${run.project}-v134-w${info.workerIndex}.json`), JSON.stringify(run, null, 2));
});

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.png`);
  await page.screenshot({ path: file });
  run.screenshots.push(file.replaceAll('\\', '/'));
}

const setStored = (fn) => `(() => { try { const st = JSON.parse(localStorage.getItem('bookshelf:v1')); if (!st) return; (${fn})(st); localStorage.setItem('bookshelf:v1', JSON.stringify(st)); } catch (e) {} })()`;
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')));

async function load(page, { mutate, panel } = {}) {
  if (panel) {
    await page.addInitScript(
      ([p]) => {
        if (!history.state?.bookshelf) history.replaceState({ bookshelf: { loc: { view: 'room', panel: p }, depth: 0, parent: null } }, '');
      },
      [panel],
    );
  }
  if (mutate) await page.addInitScript(setStored(mutate));
  await page.goto('/');
  if (mutate) {
    await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
    await page.reload();
  }
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.waitForTimeout(300);
}

async function openLibrary(page) {
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="shelf"]').evaluate((el) => el.click());
  await expect(page.locator('.library[data-open="true"]')).toBeVisible();
  await page.waitForTimeout(500);
}

const mobile = (info) => !info.project.name.includes('1440') && !info.project.name.includes('844x390');

test('librería: cabecera compacta, baldas modulares y libros visibles al abrir', async ({ page }, info) => {
  await load(page);
  await openLibrary(page);
  const m = await page.evaluate(() => {
    const r = (el) => el.getBoundingClientRect();
    const head = document.querySelector('.lib-head');
    const book = document.querySelector('.library [data-book-id]');
    const controls = [...head.querySelectorAll('button, input')].filter((el) => el.offsetParent).map((el) => ({ name: el.getAttribute('aria-label') || el.textContent.trim(), h: r(el).height, w: r(el).width }));
    // 1.43.0: cada fila de libros es el módulo de madera en nueve regiones; su canto frontal son 135 de los 208 px
    const row0 = getComputedStyle(document.querySelector('.lib-shelf'));
    const body = null;
    const rows = [...document.querySelectorAll('.lib-shelf')].map((row) => getComputedStyle(row).borderImageSource);
    return {
      header: Math.round(r(head).height),
      bookBottom: Math.round(r(book).bottom),
      viewport: innerHeight,
      overflowX: document.documentElement.scrollWidth - innerWidth,
      small: controls.filter((c) => c.h < 40 || c.w < 40),
      plankImage: row0.borderImageSource,
      plankHeight: parseFloat(row0.borderBottomWidth) * (135 / 208),
      bodyTransform: body ? getComputedStyle(body).transform : null,
      rows,
      tabs: [...document.querySelectorAll('.lib-tabs [role="radio"]')].map((t) => t.textContent),
      quoteInHeader: Boolean(head.querySelector('.pinned-quote, blockquote')),
    };
  });
  run.data.library = m;
  expect(m.tabs).toEqual(['Todos', 'Leyendo', 'Pendientes', 'Leídos']);
  expect(m.overflowX).toBeLessThanOrEqual(0);
  expect(m.small).toEqual([]);
  expect(m.quoteInHeader).toBe(false);
  expect(m.plankImage).toContain('/assets/library/shelf-module.webp');
  expect(m.rows.every((bg) => bg.includes('/assets/library/shelf-module.webp'))).toBe(true);
  if (mobile(info)) {
    // 1.43.0: canto más fino (módulo a menor escala) para que quepan tres libros completos
    expect(m.plankHeight).toBeGreaterThanOrEqual(14);
    expect(m.plankHeight).toBeLessThanOrEqual(30);
    // Cabecera baja (título sin placa) + barra con buscador, acciones y filtros
    expect(m.header).toBeLessThanOrEqual(380);
    // Los libros se ven en el primer encuadre
    expect(m.bookBottom).toBeLessThanOrEqual(m.viewport);
  }
  // 1.37.0 (SPEC §30.2): libros casi frontales como en la maqueta aprobada, rotateY(-12deg)
  if (m.bodyTransform && m.bodyTransform !== 'none') {
    const v = m.bodyTransform.match(/matrix3d\(([^)]+)\)/)?.[1].split(',').map(Number);
    if (v) expect(Math.abs((Math.acos(Math.min(1, v[0])) * 180) / Math.PI)).toBeGreaterThan(8);
  }
  await shot(page, info, 'v134-libreria');
});

test('librería: filtros, búsqueda y vistas se conservan; herramientas plegadas', async ({ page }, info) => {
  await load(page);
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  const st = await stored(page);
  await openLibrary(page);
  const input = page.getByRole('searchbox', { name: 'Buscar en mi biblioteca' });
  for (const [label, status] of [['Leyendo', 'reading'], ['Pendientes', 'want'], ['Leídos', 'read']]) {
    await page.getByRole('radio', { name: label }).click();
    await expect(page.locator('.shelf-row')).toHaveCount(1);
    await expect(page.locator(`.shelf-row[data-row="${status}"]`)).toHaveCount(1);
    expect(await page.locator('.library__shelves [data-book-id]').count()).toBe(st.books.filter((b) => b.status === status).length);
  }
  await page.getByRole('radio', { name: 'Todos' }).click();
  await input.fill(st.books[0].author.split(' ').at(-1));
  // 1.43.0: vista y herramientas, plegadas en su panel
  await expect(page.getByRole('radio', { name: 'Lomos' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Vista y herramientas' }).click();
  await page.getByRole('radio', { name: 'Lomos' }).click();
  await expect(input).toHaveValue(st.books[0].author.split(' ').at(-1));
  await expect(page.locator('.library .spine').first()).toBeVisible();
  await page.getByRole('radio', { name: 'Escaparate' }).click();
  await expect(input).toHaveValue(st.books[0].author.split(' ').at(-1));
  await input.fill('');
  // Herramientas con icono y nombre (dado, bibliotecario y vitrina)
  const tools = page.getByRole('group', { name: 'Herramientas' });
  await expect(tools.getByRole('button', { name: 'Libro al azar' })).toBeVisible();
  await expect(tools.getByRole('button', { name: 'Pedir una recomendación' })).toBeVisible();
  await expect(tools.getByRole('button', { name: 'Vitrina de Figuras' })).toBeVisible();
  await shot(page, info, 'v134-herramientas');
  await expect(page.locator('.library[data-open="true"]')).toBeVisible();
  // Nada cambia de estado
  expect((await stored(page)).books.map((b) => [b.id, b.status])).toEqual(st.books.map((b) => [b.id, b.status]));
});

test('recuerdos: uno destacado con fecha fiable; sin terminados ni cita, nada', async ({ page }) => {
  await load(page);
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  const st = await stored(page);
  await openLibrary(page);
  const dated = st.books.filter((b) => b.status === 'read' && b.finishedAt).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  if (dated.length) await expect(page.locator('.keepsake-note')).toHaveAttribute('aria-label', new RegExp(dated[0].title));
  // Hiedra: como mucho dos, decorativa
  const ivy = await page.evaluate(() => [...document.querySelectorAll('.lib-ivy')].map((el) => ({ pe: getComputedStyle(el).pointerEvents, hidden: el.getAttribute('aria-hidden'), w: el.getBoundingClientRect().width })));
  expect(ivy.length).toBeLessThanOrEqual(2);
  ivy.forEach((v) => {
    expect(v.pe).toBe('none');
    expect(v.hidden).toBe('true');
    expect(v.w).toBeGreaterThanOrEqual(87);
    expect(v.w).toBeLessThanOrEqual(121);
  });
  // Sin libros terminados ni cita clavada: ningún bloque de recuerdos
  await page.addInitScript(
    setStored((s) => {
      s.books = s.books.filter((b) => b.status !== 'read');
      s.settings.pinnedQuote = null;
    }),
  );
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await openLibrary(page);
  await expect(page.locator('.keepsake-board')).toHaveCount(0);
});

test('hiedra: sin movimiento con movimiento reducido', async ({ page }, info) => {
  test.skip(!info.project.name.includes('reduced'), 'solo en el perfil de movimiento reducido');
  await load(page);
  await openLibrary(page);
  const names = await page.evaluate(() => [...document.querySelectorAll('.lib-ivy')].map((el) => getComputedStyle(el).animationName));
  names.forEach((n) => expect(n).toBe('none'));
});

test('ficha: orden, detalles plegados, valoración con teclado y cierre «Cerrar»', async ({ page }, info) => {
  await load(page, { panel: { type: 'book', id: 'principito' } });
  const sheet = page.locator('.book-sheet');
  await expect(sheet).toBeVisible();
  // Sin flechas de habitación con un panel abierto
  await expect(page.locator('.panorama-nav')).toHaveCount(0);
  const order = await page.evaluate(() => {
    const page = document.querySelector('.sheet-page--ficha');
    const sel = ['.ex-libris', '.sheet-head', '.sheet-status', '.sheet-progress', '.sheet-log', '.sheet-rating', '.sheet-details'];
    return sel.map((s) => Math.round(page.querySelector(s).getBoundingClientRect().top));
  });
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  const stamp = await page.locator('.ex-libris__stamp').boundingBox();
  // 1.35.1: ex-libris compacto; el sello es decorativo (el control es el nombre, de 44 px)
  expect(stamp.width).toBeGreaterThanOrEqual(36);
  expect(stamp.width).toBeLessThanOrEqual(56);
  const cover = await page.locator('.sheet-head__cover').boundingBox();
  expect(cover.width).toBeGreaterThanOrEqual(63);
  expect(cover.width).toBeLessThanOrEqual(89);
  // Detalles de mi edición: plegado, con total, desconocido, unidad, velocidad y edición
  const details = page.locator('.sheet-details').first();
  await expect(details.getByLabel('Total de páginas', { exact: true })).toBeHidden();
  await details.locator('summary').click();
  await expect(details.getByLabel('Total de páginas', { exact: true })).toBeVisible();
  await expect(details.getByText('Total de páginas desconocido')).toBeVisible();
  await expect(details.getByRole('radiogroup', { name: 'Seguir el progreso por' })).toBeVisible();
  await expect(details.getByLabel('Velocidad de lectura en páginas por hora')).toBeVisible();
  await expect(details.locator('select')).toBeVisible();
  // Valoración: estrellas + número; flechas de 0,25; ajuste fino al activarla
  await page.getByRole('button', { name: 'Valorar con 3 estrellas' }).click();
  await expect(page.getByRole('button', { name: 'Restar un cuarto de estrella' })).toBeVisible();
  await page.getByRole('button', { name: 'Valorar con 3 estrellas' }).press('ArrowRight');
  await page.getByRole('button', { name: 'Valorar con 3 estrellas' }).press('ArrowRight');
  await page.getByRole('button', { name: 'Valorar con 3 estrellas' }).press('ArrowRight');
  await expect(page.locator('.sheet-page--ficha .rating-input__value')).toHaveText('3,75 / 5');
  await expect.poll(async () => (await stored(page)).books.find((b) => b.id === 'principito').rating).toBe(3.75);
  // Cierre: pestaña de papel ≥ 44 × 44, dentro de la pantalla, nombre «Cerrar»
  const close = page.getByRole('button', { name: 'Cerrar', exact: true });
  const box = await close.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
  expect(box.y).toBeGreaterThanOrEqual(0);
  // Un solo scroll, sin horizontal
  const overflow = await page.locator('.book-sheet__scroll').evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await shot(page, info, 'v134-ficha');
  await close.click();
  await expect(page.locator('.panel-veil')).toHaveCount(0);
});

test('diario: entradas fechadas y vacío con «Escribir mi primera anotación»', async ({ page }, info) => {
  await load(page, {
    panel: { type: 'book', id: 'principito' },
    mutate: (st) => {
      const b = st.books.find((x) => x.id === 'principito');
      b.quotes = [];
      b.review = '';
      st.progress.readingLog = st.progress.readingLog.filter((e) => e.bookId !== 'principito');
    },
  });
  await page.getByRole('tab', { name: 'Diario' }).click();
  await expect(page.getByText('¿Qué te gustaría recordar de esta historia?')).toBeVisible();
  await expect(page.getByLabel('Nueva anotación', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Escribir mi primera anotación' }).click();
  const text = page.getByLabel('Nueva anotación', { exact: true });
  await expect(text).toBeFocused();
  await text.fill('Lo esencial es invisible a los ojos.');
  await page.getByRole('button', { name: 'Guardar anotación' }).click();
  const entry = page.locator('.journal-entry.quote');
  await expect(entry).toHaveCount(1);
  // Marca lateral + nombre del significado (nunca solo color), con fecha en Caveat
  await expect(entry.locator('.quote__tag')).not.toHaveText('');
  const date = await page.locator('.journal-day__date').first().evaluate((el) => ({ font: getComputedStyle(el).fontFamily, size: getComputedStyle(el).fontSize }));
  expect(date.font).toContain('Caveat');
  expect(date.size).toBe('20px');
  await expect.poll(async () => (await stored(page)).books.find((b) => b.id === 'principito').quotes.length).toBe(1);
  await shot(page, info, 'v134-diario');
});

test('registrar lectura desde la ficha: terminar abre la reseña y «Ahora no» vuelve a la ficha', async ({ page }) => {
  await load(page, {
    panel: { type: 'book', id: 'hail-mary' },
    mutate: (st) => {
      const b = st.books.find((x) => x.id === 'hail-mary');
      b.status = 'reading';
      b.trackBy = 'pages';
      b.pageCount = 420;
      b.currentPage = 400;
      b.finishedAt = null;
      b.rating = null;
      b.review = '';
    },
  });
  await page.getByRole('button', { name: 'Registrar lectura' }).click();
  const form = page.locator('.sheet-log .reading-form');
  await expect(form).toBeVisible();
  // Modo «Voy por la página»: 420 de 420
  await form.getByRole('radio', { name: 'Voy por la página' }).click();
  await form.locator('input[inputmode="numeric"]').fill('420');
  await form.getByRole('button', { name: 'Guardar lectura' }).click();
  await expect(page.locator('.review-sheet')).toBeVisible();
  await expect(page.locator('.panel-veil')).toHaveCount(1);
  expect((await stored(page)).books.find((b) => b.id === 'hail-mary').status).toBe('read');
  await page.getByRole('button', { name: 'Ahora no' }).click();
  await expect(page.locator('.book-sheet')).toBeVisible();
  await expect(page.locator('.sheet-status [aria-checked="true"]')).toHaveText('Leído');
});
