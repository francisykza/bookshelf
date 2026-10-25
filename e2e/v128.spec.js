// QA de la 1.28.0 (SPEC §22): biblioteca completa con buscador, calendario con solo lecturas activas, reseña al
// terminar desde el calendario, indicador del temporizador dentro del área visible y brisa por la ventana.
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
  writeFileSync(join(dir, `${run.project}-v128-w${info.workerIndex}.json`), JSON.stringify(run, null, 2));
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

/** Carga la app (con datos cambiados antes de que la app los lea, si se pide) y, opcionalmente, un panel abierto. */
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

/** Centra el control y lo pulsa (como un dedo tras desplazarse). */
async function tap(locator) {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await locator.click();
}
async function typeInto(locator, text) {
  await locator.evaluate((el) => {
    el.scrollIntoView({ block: 'center' });
    el.focus({ preventScroll: true });
    el.select?.();
  });
  await locator.page().keyboard.press('Backspace');
  await locator.page().keyboard.type(text, { delay: 30 });
}

/** Un libro a punto de terminar (400 de 420), leyendo y como libro actual. */
const nearlyDone = (st) => {
  const b = st.books.find((x) => x.id === 'hail-mary');
  b.status = 'reading';
  b.trackBy = 'pages';
  b.pageCount = 420;
  b.currentPage = 400;
  b.currentPercent = 95.2;
  b.finishedAt = null;
  b.rating = null;
  b.review = '';
  st.settings.currentBookId = 'hail-mary';
};

/** Abre el formulario de hoy con el libro casi terminado elegido y el modo «Página». */
async function todayFormFor(page, bookId) {
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="laptop"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.cal-pop')).toBeVisible();
  const add = page.locator('.cal-pop .cal-pop__add');
  if (await add.count()) await add.click();
  const form = page.locator('.cal-pop .reading-form');
  await form.locator('select').selectOption(bookId);
  await tap(form.getByRole('radio', { name: 'Voy por la página' }));
  return form;
}

test('librería: parte de toda la biblioteca y busca con o sin tildes, conservando la búsqueda entre vistas', async ({ page }, info) => {
  await load(page);
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  const st = await stored(page);
  await openLibrary(page);
  // «Todas» por defecto y los tres estados juntos
  await expect(page.getByRole('radio', { name: 'Todas' })).toHaveAttribute('aria-checked', 'true');
  const counts = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.shelf-row')].map((r) => [r.dataset.row, r.querySelectorAll('[data-book-id]').length])));
  const expected = { reading: 0, want: 0, read: 0 };
  st.books.forEach((b) => (expected[b.status] += 1));
  run.data.counts = { counts, expected };
  expect(counts).toEqual(expected);
  // El buscador no se enfoca solo al abrir
  expect(await page.evaluate(() => document.activeElement?.id)).not.toBe('shelf-search-input');
  const input = page.getByRole('searchbox', { name: 'Buscar en mi biblioteca' });
  await expect(input).toHaveAttribute('placeholder', 'Título o autor…');
  expect(await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  expect((await page.locator('.shelf-search').boundingBox()).height).toBeGreaterThanOrEqual(44);
  // Sin tildes ni mayúsculas
  const target = st.books.find((b) => /[áéíóú]/i.test(b.title)) ?? st.books[0];
  const plain = target.title.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  await input.fill(`  ${plain}  `);
  await expect(page.locator(`.library [data-book-id="${target.id}"]`)).toHaveCount(1);
  const shown = await page.locator('.library__shelves [data-book-id]').count();
  expect(shown).toBeLessThan(st.books.length);
  await shot(page, info, 'v128-libreria-escaparate');
  // Lomos: la búsqueda se conserva y el campo sigue montado
  await page.getByRole('radio', { name: 'Lomos' }).click();
  await expect(input).toHaveValue(`  ${plain}  `);
  await expect(page.locator(`.library [data-book-id="${target.id}"]`)).toHaveCount(1);
  await shot(page, info, 'v128-libreria-lomos');
  await page.getByRole('radio', { name: 'Escaparate' }).click();
  // Filtro + búsqueda a la vez; estados vacíos diferenciados
  const other = ['reading', 'want', 'read'].find((s) => s !== target.status);
  const label = { reading: 'Leyendo', want: 'Pendientes', read: 'Leídos' }[other];
  // Las cintas se balancean (nunca están «quietas» para Playwright): se pulsan como lo haría un dedo
  await page.getByRole('radio', { name: label }).click({ force: true });
  await expect(page.locator('.library__empty')).toHaveText('No encontramos ese libro en tu biblioteca');
  await input.fill('');
  await page.getByRole('button', { name: 'Limpiar búsqueda' }).count();
  await page.getByRole('radio', { name: 'Todas' }).click({ force: true });
  await input.fill('xyz no existe');
  await expect(page.locator('.library__empty')).toHaveText('No encontramos ese libro en tu biblioteca');
  await page.getByRole('button', { name: 'Limpiar búsqueda' }).click();
  await expect(input).toHaveValue('');
  await expect(page.locator('.library__empty')).toHaveCount(0);
  // Nada ha cambiado de estado
  expect((await stored(page)).books.map((b) => [b.id, b.status])).toEqual(st.books.map((b) => [b.id, b.status]));
});

test('calendario → 419/420 no termina; 420/420 abre la reseña una sola vez; «Ahora no» vuelve al mismo día', async ({ page }, info) => {
  await load(page, { mutate: nearlyDone });
  let form = await todayFormFor(page, 'hail-mary');
  await typeInto(form.locator('input[inputmode="numeric"]'), '419');
  await tap(form.getByRole('button', { name: 'Guardar lectura' }));
  await expect(form.locator('.reading-form__saved')).toHaveText('✓ Guardado');
  await page.waitForTimeout(300);
  await expect(page.locator('.review-sheet')).toHaveCount(0);
  expect((await stored(page)).books.find((b) => b.id === 'hail-mary').status).toBe('reading');
  // 420/420 con doble toque: un registro, una finalización, una reseña
  form = page.locator('.cal-pop .reading-form');
  await typeInto(form.locator('input[inputmode="numeric"]'), '420');
  const save = form.getByRole('button', { name: 'Guardar lectura' });
  await save.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await save.dblclick();
  await expect(page.locator('.review-sheet')).toBeVisible();
  await expect(page.locator('.review-sheet')).toContainText('Una historia terminada');
  await expect(page.locator('.review-sheet__title')).toHaveText((await stored(page)).books.find((b) => b.id === 'hail-mary').title);
  // Un único panel interactivo en primer plano (el calendario no queda debajo)
  await expect(page.locator('.panel-veil')).toHaveCount(1);
  await expect(page.locator('.cal')).toHaveCount(1); // solo la miniatura de la pantalla del portátil
  const st = await stored(page);
  expect(st.books.find((b) => b.id === 'hail-mary').status).toBe('read');
  expect(st.progress.readingLog.filter((e) => e.bookId === 'hail-mary' && e.to === 420)).toHaveLength(1);
  await expect(page.getByRole('button', { name: 'Guardar reseña' })).toBeInViewport();
  await shot(page, info, 'v128-resena');
  // «Ahora no»: conserva la finalización y vuelve al mismo día del calendario
  await page.getByRole('button', { name: 'Ahora no' }).click();
  await expect(page.locator('.review-sheet')).toHaveCount(0);
  await expect(page.locator('.panel .window__title')).toContainText('Calendario');
  await expect(page.locator('.cal-pop')).toBeVisible();
  expect((await stored(page)).books.find((b) => b.id === 'hail-mary').status).toBe('read');
  // El selector ya no ofrece el libro terminado; el historial del día sí lo conserva
  const opts = await page.locator('.cal-pop select option').evaluateAll((els) => els.map((o) => o.value));
  expect(opts).not.toContain('hail-mary');
  await expect(page.locator('.cal-pop')).toContainText((await stored(page)).books.find((b) => b.id === 'hail-mary').title);
  // Recargar con el libro terminado no abre la reseña
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.waitForTimeout(500);
  await expect(page.locator('.review-sheet')).toHaveCount(0);
});

test('reseña: 3,75 se guarda y se vuelve a cargar; no concede sellos ni recompensas', async ({ page }) => {
  await load(page, { mutate: nearlyDone });
  const form = await todayFormFor(page, 'hail-mary');
  await typeInto(form.locator('input[inputmode="numeric"]'), '420');
  await tap(form.getByRole('button', { name: 'Guardar lectura' }));
  await expect(page.locator('.review-sheet')).toBeVisible();
  const figuresBefore = JSON.stringify((await stored(page)).progress.figures);
  await page.getByRole('button', { name: 'Valorar con 4 estrellas' }).click();
  await page.getByRole('button', { name: 'Restar un cuarto de estrella' }).click();
  await page.locator('.review-sheet__text').fill('Una amistad inolvidable.');
  await page.getByRole('button', { name: 'Guardar reseña' }).click();
  await expect(page.locator('.review-sheet')).toHaveCount(0);
  const st = await stored(page);
  const b = st.books.find((x) => x.id === 'hail-mary');
  expect(b.rating).toBe(3.75);
  expect(b.review).toBe('Una amistad inolvidable.');
  expect(JSON.stringify(st.progress.figures)).toBe(figuresBefore);
  // La ficha del libro (mismo almacenamiento) muestra la misma valoración y la reseña
  // (la ida y vuelta por el almacenamiento la cubre la prueba de dominio v128 · 11)
  // Al guardar se vuelve al calendario de ese día; se cierra cuando ya está en pantalla
  await expect(page.locator('.panel .window__title')).toContainText('Calendario');
  await page.waitForTimeout(600);
  await page.keyboard.press('Escape');
  await expect(page.locator('.panel-veil')).toHaveCount(0);
  // (el libro ya no es la lectura actual: se abre su ficha desde la librería)
  await openLibrary(page);
  await page.locator('.library [data-book-id="hail-mary"]').first().evaluate((el) => (el.querySelector('button') ?? el).click());
  await expect(page.locator('.open-book .rating-input__value').first()).toHaveText('3,75 / 5');
});

test('fallo al guardar: conserva lo escrito, no termina el libro y no abre la reseña; reintentar sí', async ({ page }) => {
  await load(page, { mutate: nearlyDone });
  const form = await todayFormFor(page, 'hail-mary');
  await typeInto(form.locator('input[inputmode="numeric"]'), '420');
  // El almacenamiento falla (cuota, modo privado…)
  await page.evaluate(() => {
    window.__setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function () {
      throw new Error('QuotaExceededError');
    };
  });
  await tap(form.getByRole('button', { name: 'Guardar lectura' }));
  await expect(form.locator('.reading-form__error[role="alert"]')).toContainText('No se ha podido guardar');
  await expect(page.locator('.review-sheet')).toHaveCount(0);
  await expect(form.locator('input[inputmode="numeric"]')).toHaveValue('420');
  // En memoria tampoco queda terminado: el selector lo sigue ofreciendo
  expect(await form.locator('select option').evaluateAll((els) => els.map((o) => o.value))).toContain('hail-mary');
  await page.evaluate(() => {
    Storage.prototype.setItem = window.__setItem;
  });
  await tap(form.getByRole('button', { name: 'Guardar lectura' }));
  await expect(page.locator('.review-sheet')).toBeVisible();
  expect((await stored(page)).progress.readingLog.filter((e) => e.bookId === 'hail-mary' && e.to === 420)).toHaveLength(1);
});

test('temporizador: el indicador sigue al vaso dentro del área visible, sin escala doble', async ({ page }, info) => {
  await load(page);
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="tray"]').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /Empezar/ }).click();
  await page.getByRole('button', { name: 'Cerrar la bandeja' }).click();
  await expect(page.locator('.panel-veil')).toHaveCount(0);
  const visible = await page.evaluate(() => {
    const r = document.querySelector('[data-panel="MAIN_ROOM"] .hotspot[data-id="tray"]').getBoundingClientRect();
    return r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight;
  });
  const badge = page.locator('.tea-mist[data-placed]');
  if (!visible) {
    // Vaso fuera del encuadre: sin indicador flotando en un borde (el temporizador sigue en marcha)
    await expect(page.locator('.tea-mist')).toHaveCount(0);
    return;
  }
  await expect(badge).toHaveCount(1);
  const measure = () =>
    badge.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const t = el.querySelector('.tea-mist__time');
      return { rect: [r.left, r.top, r.right, r.bottom].map(Math.round), inside: r.left >= 11.5 && r.top >= 11.5 && r.right <= innerWidth - 11.5 && r.bottom <= innerHeight - 11.5, inWorld: Boolean(el.closest('.scene-world')), font: getComputedStyle(t).fontFamily, nums: getComputedStyle(t).fontVariantNumeric, bg: getComputedStyle(el).backgroundColor, time: t.textContent };
    });
  const a = await measure();
  run.data.timer = a;
  expect(a.inside).toBe(true);
  expect(a.inWorld).toBe(false);
  expect(a.font).toMatch(/JetBrains Mono/);
  expect(a.nums).toMatch(/tabular-nums/);
  expect(a.bg).toBe('rgba(0, 0, 0, 0)');
  await shot(page, info, 'v128-temporizador');
  // Cambio de cámara (panorama ida y vuelta): un solo indicador, la misma cuenta, dentro del área visible
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.locator('.panorama-nav__btn--prev').click();
  await page.waitForTimeout(950);
  await expect(page.locator('.tea-mist')).toHaveCount(1);
  const b = await measure();
  expect(b.inside).toBe(true);
  expect(b.time).not.toBe('25:00');
});

test('escena recompuesta (1.30.0): capas sobre el fondo limpio, decorativas, con movimiento solo en las validadas', async ({ page }, info) => {
  await load(page);
  await expect(page.locator('.scene-refresh-base')).toHaveCount(1, { timeout: 15000 });
  const reduced = info.project.name.includes('reduced');
  const state = () =>
    page.evaluate(() => {
      const root = document.querySelector('.room-refresh');
      const layers = [...root.querySelectorAll('.room-refresh__layer')];
      const moving = layers.filter((l) => l.dataset.motion);
      return {
        layers: layers.map((l) => l.dataset.id),
        moving: moving.map((l) => l.dataset.id),
        breeze: document.querySelectorAll('.breeze').length,
        hidden: root.getAttribute('aria-hidden'),
        pe: [getComputedStyle(root).pointerEvents, ...layers.map((l) => getComputedStyle(l).pointerEvents)],
        filter: layers.map((l) => getComputedStyle(l).filter),
        anim: moving.map((l) => getComputedStyle(l).animationName),
        play: moving.map((l) => getComputedStyle(l).animationPlayState),
        staticAnim: layers.filter((l) => !l.dataset.motion).map((l) => getComputedStyle(l).animationName),
        crops: [document.querySelector('.room-shelf-lips image')?.getAttribute('href'), document.querySelector('.laptop-foreground')?.getAttribute('src')],
      };
    });
  const s = await state();
  run.data.refresh = s;
  expect(s.layers).toEqual(['cortina-alta', 'cortina-caida', 'enredadera-poste', 'hiedra-izquierda', 'hiedra-derecha']);
  // Nunca dos representaciones de la vegetación a la vez
  expect(s.breeze).toBe(0);
  expect(s.hidden).toBe('true');
  expect(s.pe.every((v) => v === 'none')).toBe(true);
  expect(s.filter.every((v) => v === 'none')).toBe(true);
  // La cortina de arriba y la enredadera con su poste rígido no se mueven
  expect(s.moving).toEqual(['cortina-caida', 'hiedra-izquierda', 'hiedra-derecha']);
  expect(s.staticAnim.every((v) => v === 'none')).toBe(true);
  // Los recortes copian la misma pintura que se ve (fondo limpio), no la ilustración anterior
  expect(s.crops[0]).toMatch(/escena\/fondo-limpio\.webp$/);
  expect(s.crops[1]).toMatch(/escena\/portatil-primer-plano\.webp$/);
  if (reduced) {
    expect(s.anim.every((v) => v === 'none')).toBe(true);
    return;
  }
  expect(s.play.every((v) => v === 'running')).toBe(true);
  // Panel delante → en pausa
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="laptop"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.panel-veil')).toHaveCount(1);
  expect((await state()).play.every((v) => v === 'paused')).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('.panel-veil')).toHaveCount(0);
  // Otra habitación → en pausa
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  expect((await state()).play.every((v) => v === 'paused')).toBe(true);
});

test('escena recompuesta: si falla un recurso se queda la ilustración original, entera, con sus hojas SVG', async ({ page }) => {
  await page.route('**/room-refresh/escena/cortina-caida.webp', (route) => route.abort());
  await load(page);
  await page.waitForTimeout(1500);
  await expect(page.locator('.scene-refresh-base')).toHaveCount(0);
  await expect(page.locator('.room-refresh')).toHaveCount(0);
  await expect(page.locator('.breeze')).toHaveCount(1);
  expect(await page.locator('.room-shelf-lips image').getAttribute('href')).toMatch(/cozy-book-room\.jpg$/);
  expect(await page.locator('.laptop-foreground').getAttribute('src')).toMatch(/laptop-foreground\.png$/);
});

test('mar vivo (1.33.0): el agua ondula dentro de la máscara, no intercepta toques y se detiene con un panel', async ({ page }, info) => {
  await load(page);
  await expect(page.locator('.scene-refresh-base')).toHaveCount(1, { timeout: 15000 });
  const reduced = info.project.name.includes('reduced');
  const ripple = page.locator('[data-panel="MAIN_ROOM"] .sea-ripple');
  if (reduced) {
    // Movimiento reducido: composición estática (sin canvas)
    await expect(ripple).toHaveCount(0);
    return;
  }
  await expect(ripple).toHaveCount(1);
  expect(await ripple.evaluate((el) => [getComputedStyle(el).pointerEvents, el.closest('.bay') !== null])).toEqual(['none', true]);
  // Dos lecturas del canvas separadas en el tiempo: cambia mientras anima y no cambia con un panel delante
  const pixels = () => ripple.evaluate((c) => Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data.filter((_, i) => i % 97 === 0)));
  const changed = (x, y) => x.reduce((n, v, i) => n + (v !== y[i] ? 1 : 0), 0);
  await page.waitForTimeout(800);
  const a = await pixels();
  await page.waitForTimeout(900);
  expect(changed(a, await pixels())).toBeGreaterThan(0);
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="laptop"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.panel-veil')).toHaveCount(1);
  await page.waitForTimeout(300);
  const p1 = await pixels();
  await page.waitForTimeout(900);
  expect(changed(p1, await pixels())).toBe(0);
});
