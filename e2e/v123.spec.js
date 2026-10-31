// QA de la 1.23.0 (SPEC §17; selector según §22.6): selector de lecturas activas, borrador estable y una sola zona de scroll en el
// formulario del calendario, significados de colores, sonidos semánticos y pulsación. Perfil vacío por prueba.
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
  writeFileSync(join(dir, `${run.project}-v123-w${info.workerIndex}.json`), JSON.stringify(run, null, 2));
});

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.png`);
  await page.screenshot({ path: file });
  run.screenshots.push(file.replaceAll('\\', '/'));
}

/** Abre la app con un panel ya en el historial (como al recargar con él abierto). */
async function openWith(page, panel, mutate) {
  await page.addInitScript(
    ([p]) => {
      history.replaceState({ bookshelf: { loc: { view: 'room', panel: p }, depth: 0, parent: null } }, '');
    },
    [panel],
  );
  // Los datos se cambian ANTES de que la app los lea (al descargarse, la app vuelca su estado en memoria)
  if (mutate) await page.addInitScript(mutate);
  await page.goto('/');
  if (mutate) {
    await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
    await page.reload();
  }
  await page.waitForSelector('.panel-veil');
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
}

const setStored = (fn) => `(() => { try { const st = JSON.parse(localStorage.getItem('bookshelf:v1')); if (!st) return; (${fn})(st); localStorage.setItem('bookshelf:v1', JSON.stringify(st)); } catch (e) {} })()`;

/** Abre el formulario del día de hoy en el calendario del portátil. */
async function openTodayForm(page) {
  if (!(await page.locator('.cal-pop').count())) await page.locator('.panel .cal__cell[data-today="true"]').click();
  const add = page.locator('.cal-pop .cal-pop__add');
  if (await add.count()) await add.click();
  await page.waitForSelector('.cal-pop .reading-form');
  return page.locator('.cal-pop .reading-form');
}

/** En móvil el diario es una pestaña; en pantallas anchas el libro abierto muestra las dos páginas. */
async function openDiary(page) {
  const tab = page.getByRole('tab', { name: /Diario/ });
  if (await tab.isVisible()) await tab.click();
  // Desde la 1.53 «Mi diario» abre en «Reseña»; las anotaciones (y «Personalizar colores») están en «Notas»
  const notes = page.getByRole('tablist', { name: 'Secciones del diario' }).getByRole('tab', { name: 'Notas' });
  await notes.waitFor({ timeout: 5000 }).then(() => notes.click()).catch(() => {});
}

/** Centra el control en su zona de scroll y lo pulsa (como un dedo tras desplazarse; la fila sticky no lo tapa). */
async function tap(locator) {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await locator.click();
}

/** Escribe en un campo sin el desplazamiento automático de Playwright. */
async function typeInto(locator, text) {
  await locator.evaluate((el) => {
    el.scrollIntoView({ block: 'center' });
    el.focus({ preventScroll: true });
  });
  await locator.page().keyboard.type(text, { delay: 50 });
}

const options = (form) => form.locator('select option').evaluateAll((els) => els.map((o) => ({ v: o.value, t: o.textContent, d: o.disabled })));

test('selector: solo lecturas activas (1.28.0: sin «Otros…»); guardar no cambia estados', async ({ page }, info) => {
  await openWith(page, { type: 'laptop' });
  const form = await openTodayForm(page);
  const opts = await options(form);
  run.data.options = opts;
  const books = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.map((b) => ({ id: b.id, status: b.status })));
  const reading = books.filter((b) => b.status === 'reading').map((b) => b.id);
  expect(opts.map((o) => o.v).sort()).toEqual([...reading].sort());
  expect(opts.some((o) => o.t === 'Otros…' || o.v === '__other__')).toBe(false);
  await shot(page, info, 'v123-selector-otros');
  // Guardar con una lectura activa: el registro lleva su id real
  const target = opts[0].v;
  await tap(form.getByRole('radio', { name: 'He leído' }));
  await typeInto(form.locator('input[inputmode="numeric"]'), '7');
  await tap(form.getByRole('button', { name: 'Guardar lectura' }));
  await expect(form.locator('.reading-form__saved')).toHaveText('✓ Guardado');
  const saved = await page.evaluate((id) => JSON.parse(localStorage.getItem('bookshelf:v1')).progress.readingLog.filter((e) => e.bookId === id && e.pages === 7).length, target);
  expect(saved).toBe(1);
});

test('selector: sin lecturas activas lo dice, deshabilita el registro y ofrece la librería', async ({ page }) => {
  await openWith(
    page,
    { type: 'laptop' },
    setStored((st) => {
      st.books.forEach((b) => {
        if (b.status === 'reading') b.status = 'want';
      });
    }),
  );
  const form = await openTodayForm(page);
  await expect(form.locator('select')).toHaveCount(0);
  await expect(form).toContainText('No tienes ninguna lectura en curso');
  await expect(form.getByRole('button', { name: 'Guardar lectura' })).toBeDisabled();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.map((b) => [b.id, b.status]));
  await form.getByRole('button', { name: 'Elegir un libro de mi biblioteca' }).click();
  await expect(page.locator('.library[data-open="true"]')).toBeVisible();
  await expect(page.locator('.panel-veil')).toHaveCount(0);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.map((b) => [b.id, b.status]));
  expect(after).toEqual(before);
});

test('formulario: una sola zona de scroll, acciones sticky y borrador estable con el temporizador en marcha', async ({ page }, info) => {
  // Temporizador en marcha (su reloj re-renderiza la app cada medio segundo)
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.hotspot[data-id="tray"]').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /Empezar/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.panel-veil')).toHaveCount(0);
  await page.locator('.hotspot[data-id="laptop"]').focus();
  await page.keyboard.press('Enter');
  const form = await openTodayForm(page);
  await tap(form.getByRole('radio', { name: 'Voy por la página' }));
  const input = form.locator('input[inputmode="numeric"]');
  await typeInto(input, '2');
  await page.waitForTimeout(1800);
  await page.keyboard.type('05', { delay: 60 });
  await page.waitForTimeout(1200);
  const state = await page.evaluate(() => {
    const el = document.querySelector('.cal-pop .reading-form input[inputmode="numeric"]');
    // Zonas de scroll vertical entre el campo y el modal
    const scrollers = [];
    for (let n = el.parentElement; n && !n.classList.contains('panel-veil'); n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) scrollers.push(n.className.toString().split(' ')[0]);
    }
    const actions = document.querySelector('.cal-pop .reading-form__actions');
    const veil = getComputedStyle(document.querySelector('.panel-veil'));
    return { value: el.value, focused: document.activeElement === el, scrollers, sticky: getComputedStyle(actions).position, veilOverflow: veil.overflowY, inputFont: parseFloat(getComputedStyle(el).fontSize), popOverflow: getComputedStyle(document.querySelector('.cal-pop')).overflowY };
  });
  run.data.form = state;
  expect(state.value).toBe('205');
  expect(state.focused).toBe(true);
  // Sticky donde hay sitio; en ventanas bajas (≤ 480 px) la fila vuelve al flujo para no tapar el formulario
  expect(state.sticky).toBe(page.viewportSize().height <= 480 ? 'static' : 'sticky');
  expect(state.popOverflow).toBe('visible');
  expect(state.scrollers.every((c) => c === 'pc-win__body')).toBe(true);
  expect(state.inputFont).toBeGreaterThanOrEqual(16);
  // Cambiar a porcentaje y volver no pierde la instancia ni fuerza el scroll
  const body = page.locator('.pc-win:not([hidden]) .pc-win__body');
  const pct = form.getByRole('radio', { name: 'Porcentaje' });
  await pct.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const top0 = await body.evaluate((el) => el.scrollTop);
  await pct.click();
  await expect(form.locator('input[inputmode="decimal"]')).toBeVisible();
  expect(Math.abs((await body.evaluate((el) => el.scrollTop)) - top0)).toBeLessThanOrEqual(6);
  await tap(form.getByRole('radio', { name: 'Voy por la página' }));
  // El valor de cada modalidad se conserva al ir y volver
  expect(await input.inputValue()).toBe('205');
  // «Guardar» alcanzable dentro de la misma zona
  const save = form.getByRole('button', { name: /Guardar/ });
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeInViewport();
  const box = await save.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  await shot(page, info, 'v123-formulario-sticky');
});

test('sonido de guardado: uno solo, tras el éxito; ninguno al escribir ni con efectos desactivados', async ({ page }) => {
  await openWith(page, { type: 'laptop' });
  const form = await openTodayForm(page);
  await tap(form.getByRole('radio', { name: 'He leído' }));
  await page.evaluate(() => {
    window.__uiSoundLog = [];
  });
  await typeInto(form.locator('input[inputmode="numeric"]'), '9');
  expect(await page.evaluate(() => window.__uiSoundLog.length)).toBe(0);
  const save = form.getByRole('button', { name: 'Guardar lectura' });
  await tap(save);
  await save.click({ timeout: 500 }).catch(() => {});
  await expect(form.locator('.reading-form__saved')).toHaveText('✓ Guardado');
  await page.waitForTimeout(300);
  const log = await page.evaluate(() => window.__uiSoundLog.map((e) => e.event));
  run.data.saveLog = await page.evaluate(() => window.__uiSoundLog);
  expect(log.filter((e) => e === 'save')).toHaveLength(1);
  const entries = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).progress.readingLog.filter((e) => e.pages === 9 && e.createdAt).length);
  expect(entries).toBe(1);
  await expect(form.locator('.reading-form__saved')).toHaveText('', { timeout: 3000 });
  // Efectos desactivados (en Ajustes): silencio total
  await page.addInitScript(
    setStored((st) => {
      st.settings.sfx = false;
    }),
  );
  await page.reload();
  await page.waitForSelector('.panel-veil');
  const form2 = await openTodayForm(page);
  await page.evaluate(() => {
    window.__uiSoundLog = [];
  });
  await tap(form2.getByRole('radio', { name: 'He leído' }));
  await typeInto(form2.locator('input[inputmode="numeric"]'), '3');
  await tap(form2.getByRole('button', { name: 'Guardar lectura' }));
  await expect(form2.locator('.reading-form__saved')).toHaveText('✓ Guardado');
  expect(await page.evaluate(() => window.__uiSoundLog.length)).toBe(0);
  // Volumen inicial del 25 % sin pisar ajustes guardados
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).settings.uiVolume)).toBe(0.25);
});

test('sonidos distintos por acción: mes, pestaña del diario, color, cierre', async ({ page }) => {
  await openWith(page, { type: 'laptop' });
  await page.evaluate(() => {
    window.__uiSoundLog = [];
  });
  await page.getByRole('button', { name: 'Mes anterior' }).click();
  await page.waitForTimeout(120);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const log = await page.evaluate(() => window.__uiSoundLog.map((e) => e.event));
  run.data.actionsLog = log;
  expect(log).toEqual(['monthTurn', 'close']);
});

test('colores: renombrar, filtrar, recargar, cancelar y restaurar sin tocar las citas ni otros ajustes', async ({ page }, info) => {
  await openWith(page, { type: 'book', id: 'principito' });
  await openDiary(page);
  const before = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
    return { quotes: st.books.flatMap((b) => b.quotes.map((q) => [q.id, q.text, q.color])), settings: { ...st.settings, quoteMeanings: undefined } };
  });
  await page.getByRole('button', { name: 'Personalizar colores' }).click();
  await expect(page.getByText('Estos significados se aplican a tus anotaciones de todos los libros.')).toBeVisible();
  const gold = page.getByLabel(/Significado \(dorado épico de origen\)/);
  await gold.fill('Frases para tatuarme');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.quote__tag').first()).toHaveText('Frases para tatuarme');
  await expect(page.locator('.quote-filter')).toContainText('Frases para tatuarme · 1');
  await page.locator('.quote-filter button', { hasText: 'Frases para tatuarme' }).click();
  await expect(page.locator('.quote')).toHaveCount(1);
  await shot(page, info, 'v123-colores');
  // Validación: vacío y duplicado
  await page.getByRole('button', { name: 'Personalizar colores' }).click();
  await page.getByLabel(/Significado \(rosa emoción de origen\)/).fill('frases para TATUARME');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Otro color ya tiene este significado.')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  // Recargar conserva el significado; las citas y el resto de ajustes no cambian
  await page.reload();
  await page.waitForSelector('.panel-veil');
  await openDiary(page);
  await expect(page.locator('.quote__tag').first()).toHaveText('Frases para tatuarme');
  const after = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
    return { quotes: st.books.flatMap((b) => b.quotes.map((q) => [q.id, q.text, q.color])), settings: { ...st.settings, quoteMeanings: undefined }, meanings: st.settings.quoteMeanings };
  });
  expect(after.quotes).toEqual(before.quotes);
  expect({ ...after.settings, timeOfDay: 0, timeAuto: 0 }).toEqual({ ...before.settings, timeOfDay: 0, timeAuto: 0 });
  expect(after.meanings).toEqual({ gold: { label: 'Frases para tatuarme', description: '' } });
  // Restaurar valores originales
  await page.getByRole('button', { name: 'Personalizar colores' }).click();
  await page.getByRole('button', { name: 'Restaurar valores originales' }).click();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.quote__tag').first()).toHaveText('Dorado Épico');
});

test('pulsación: sin cambio de layout ni de transform; sin desplazamiento con movimiento reducido', async ({ page }, info) => {
  await openWith(page, { type: 'laptop' });
  const form = await openTodayForm(page);
  const save = form.getByRole('button', { name: /Guardar/ });
  await save.scrollIntoViewIfNeeded();
  const box0 = await save.boundingBox();
  const layout0 = await save.evaluate((el) => [el.offsetWidth, el.offsetHeight, el.offsetTop]);
  await page.mouse.move(box0.x + box0.width / 2, box0.y + box0.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  const pressed = await save.evaluate((el) => ({ translate: getComputedStyle(el).translate, scale: getComputedStyle(el).scale, transform: getComputedStyle(el).transform }));
  // Se suelta fuera del botón: no se guarda nada
  await page.mouse.move(5, 5);
  await page.mouse.up();
  run.data.pressed = pressed;
  expect(pressed.transform).toBe('none');
  if (info.project.name.includes('reduced')) expect(['none', '0px'].includes(pressed.translate)).toBe(true);
  // Limitación del entorno: con emulación táctil, el ratón de WebKit no activa :active
  else if (info.project.name.startsWith('webkit')) run.data.webkitActive = pressed.translate;
  else expect(pressed.translate).not.toMatch(/^(none|0px)$/);
  // translate/scale no tocan el layout: tamaño y posición de caja iguales
  expect(await save.evaluate((el) => [el.offsetWidth, el.offsetHeight, el.offsetTop])).toEqual(layout0);
});
