// QA de la 1.53.0 (SPEC §51): «Mi diario» del libro con tres secciones independientes —Reseña, Notas, Historial—.
// Reseña: valoración compartida con la Ficha (cuartos de estrella), campo cómodo que crece, firma con el nombre real,
// borrador por libro que sobrevive a cambiar de sección, cerrar y recargar, «Guardar reseña» que confirma solo
// tras escribir en el dispositivo y permite reintentar si falla. Historial por fechas y por tandas, sin mover la
// reseña. Capturas de las tres secciones en qa-report/screenshots/<proyecto>/v153-*.png.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')));

/** Carga la habitación con datos de prueba sembrados una sola vez (`mutate` recibe el estado y el libro actual). */
async function load(page, mutate = () => {}) {
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/');
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.waitForTimeout(300);
  const seeded = await page.evaluate((fn) => {
    const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
    const book = st.books.find((b) => b.id === st.settings.currentBookId);
    st.settings.owner = 'Marina';
    new Function('st', 'book', `(${fn})(st, book)`)(st, book);
    return JSON.stringify(st);
  }, mutate.toString());
  await page.addInitScript((v) => {
    if (!sessionStorage.getItem('v153')) {
      localStorage.setItem('bookshelf:v1', v);
      sessionStorage.setItem('v153', '1');
    }
  }, seeded);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.waitForTimeout(400);
}

async function openDiary(page) {
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="book"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.book-sheet')).toBeVisible();
  await page.getByRole('tab', { name: 'Diario' }).click();
  await page.waitForTimeout(250);
}

const sections = (page) => page.getByRole('tablist', { name: 'Secciones del diario' });
const field = (page) => page.getByLabel('Tu reseña');
const save = (page) => page.getByRole('button', { name: 'Guardar reseña' });

/** El elemento cabe entero dentro de la hoja visible (no tapado por la fila de secciones). */
async function fullyVisible(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const [box, area, bar] = await Promise.all([
    locator.boundingBox(),
    page.locator('.book-sheet__scroll').boundingBox(),
    page.locator('.diary-sections').boundingBox(),
  ]);
  return box.y >= Math.max(area.y, bar.y + bar.height) - 1 && box.y + box.height <= area.y + area.height + 1 && box.y + box.height <= page.viewportSize().height;
}

test('sin reseña: abre en «Reseña» con la jerarquía de la maqueta; capturas de las tres secciones', async ({ page }, info) => {
  await load(page, (st, book) => {
    book.review = '';
    book.rating = null;
  });
  await openDiary(page);
  const sheet = page.locator('.book-sheet');
  await expect(sheet.getByRole('heading', { name: 'Mi diario', exact: true })).toBeVisible();
  await expect(sheet.locator('.diary-head')).toContainText('Solo para ti');
  await expect(sections(page).getByRole('tab')).toHaveText(['Reseña', 'Notas', 'Historial']);
  await expect(sections(page).getByRole('tab', { name: 'Reseña' })).toHaveAttribute('aria-selected', 'true');
  await expect(sheet.getByRole('heading', { name: 'Mi reseña' })).toBeVisible();
  await expect(sheet.getByText('Lo que esta historia te está dejando.')).toBeVisible();
  await expect(sheet.getByText('Puedes escribirla mientras lees.')).toBeVisible();
  await expect(sheet.getByRole('group', { name: 'Tu valoración' })).toBeVisible();
  await expect(sheet.locator('.rating-input--sheet .rating-input__value')).toHaveText('Sin valorar');
  await expect(field(page)).toHaveAttribute('placeholder', '¿Qué te está haciendo sentir este libro?');
  await expect(sheet.locator('.diary-sheet__name')).toHaveText('— Marina');
  await expect(sheet.locator('.review-state')).toContainText('Privada · solo la ves tú');
  // Letra legible y el adorno fuera del área de escritura
  const m = await page.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    return { size: parseFloat(getComputedStyle(document.querySelector('.diary-sheet__field')).fontSize), field: r('.diary-sheet__field').bottom, sign: r('.diary-sheet__sign').top, sprig: r('.diary-sheet__sprig').top };
  });
  expect(m.size).toBeGreaterThanOrEqual(16);
  expect(m.sign).toBeGreaterThanOrEqual(m.field - 1);
  expect(m.sprig).toBeGreaterThanOrEqual(m.field - 1);
  await shot(page, info, 'v153-resena');
  // «Guardar reseña» se ve entero y se puede pulsar
  expect(await fullyVisible(page, save(page))).toBe(true);
  await shot(page, info, 'v153-resena-guardar');
  await sections(page).getByRole('tab', { name: 'Notas' }).click();
  await expect(sheet.locator('.diary-panel:not([hidden]) .journal')).toBeVisible();
  await expect(sheet.locator('.diary-panel:not([hidden]) .journal-entry--session')).toHaveCount(0);
  await shot(page, info, 'v153-notas');
  await sections(page).getByRole('tab', { name: 'Historial' }).click();
  await expect(sheet.locator('.diary-panel:not([hidden]) .annotation-form')).toHaveCount(0);
  await expect(sheet.locator('.diary-panel:not([hidden]) .journal-entry--session').first()).toBeVisible();
  await shot(page, info, 'v153-historial');
  // Flechas del teclado entre secciones
  await sections(page).getByRole('tab', { name: 'Historial' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(sections(page).getByRole('tab', { name: 'Reseña' })).toBeFocused();
  await expect(sections(page).getByRole('tab', { name: 'Reseña' })).toHaveAttribute('aria-selected', 'true');
});

test('con reseña y 3,75: se conserva sin redondear; ajustar en cuartos y la Ficha muestra lo mismo', async ({ page }) => {
  await load(page, (st, book) => {
    book.review = 'Una voz antigua que se vuelve íntima.';
    book.rating = 3.75;
  });
  await openDiary(page);
  const sheet = page.locator('.book-sheet');
  await expect(field(page)).toHaveValue('Una voz antigua que se vuelve íntima.');
  await expect(sheet.locator('.rating-input--sheet .rating-input__value')).toHaveText('3,75 de 5');
  // La cuarta estrella, rellena tres cuartos
  await expect(sheet.locator('.rating-input--sheet .rstar__fill').nth(3)).toHaveAttribute('data-fill', '0.75');
  await expect(sheet.getByRole('group', { name: 'Tu valoración' })).toHaveAttribute('aria-describedby', /.+/);
  // Abrir la reseña no cambia nada guardado
  const st0 = await stored(page);
  expect(st0.books.find((b) => b.id === st0.settings.currentBookId).rating).toBe(3.75);
  await sheet.getByRole('button', { name: 'Ajustar puntuación' }).click();
  await sheet.getByRole('button', { name: 'Restar un cuarto de estrella' }).click();
  await expect(sheet.locator('.rating-input--sheet .rating-input__value')).toHaveText('3,5 de 5');
  await page.getByRole('tab', { name: 'Ficha' }).click();
  await expect(sheet.locator('.sheet-rating .rating-input__value')).toHaveText('3,5 / 5');
  await page.getByRole('tab', { name: 'Diario' }).click();
  // Quitar la valoración deja «Sin valorar»
  await sheet.getByRole('button', { name: 'Quitar valoración' }).click();
  await expect(sheet.locator('.rating-input--sheet .rating-input__value')).toHaveText('Sin valorar');
  await expect.poll(async () => {
    const st = await stored(page);
    return st.books.find((b) => b.id === st.settings.currentBookId).rating;
  }).toBe(null);
});

test('texto largo: el campo crece sin scroll propio y «Guardar reseña» sigue al alcance; guarda y confirma', async ({ page }) => {
  await load(page, (st, book) => {
    book.review = '';
  });
  await openDiary(page);
  const long = Array.from({ length: 40 }, (_, i) => `Párrafo ${i + 1}: lo que esta historia me deja cuando cierro el libro por la noche.`).join('\n');
  await field(page).fill(long);
  const inner = await field(page).evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(inner).toBeLessThanOrEqual(2);
  await expect(page.locator('.review-save__status')).toHaveText('Cambios sin guardar');
  // Nada se guarda hasta pulsar
  const st0 = await stored(page);
  expect(st0.books.find((b) => b.id === st0.settings.currentBookId).review).toBe('');
  expect(await fullyVisible(page, save(page))).toBe(true);
  await save(page).click();
  await expect(page.locator('.review-save__status')).toHaveText('Reseña guardada en este dispositivo');
  const st = await stored(page);
  expect(st.books.find((b) => b.id === st.settings.currentBookId).review).toBe(long);
  // Guardar nunca publica
  expect(st.books.find((b) => b.id === st.settings.currentBookId).publicReview ?? null).toBeNull();
});

test('borrador: sobrevive a cambiar de sección, cerrar y recargar; es de cada libro', async ({ page }) => {
  await load(page, (st, book) => {
    book.review = 'Lo guardado.';
    const other = st.books.find((b) => b.id !== book.id);
    other.review = '';
  });
  const before = await stored(page);
  const id = before.settings.currentBookId;
  const otherId = before.books.find((b) => b.id !== id).id;
  await openDiary(page);
  await field(page).fill('Lo guardado, y algo más que aún no he guardado');
  for (const s of ['Notas', 'Historial', 'Reseña']) await sections(page).getByRole('tab', { name: s }).click();
  await expect(field(page)).toHaveValue('Lo guardado, y algo más que aún no he guardado');
  await page.getByRole('tab', { name: 'Ficha' }).click();
  await page.getByRole('tab', { name: 'Diario' }).click();
  await expect(field(page)).toHaveValue('Lo guardado, y algo más que aún no he guardado');
  // Cerrar y volver a abrir
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(page.locator('.book-sheet')).toHaveCount(0);
  await openDiary(page);
  await expect(field(page)).toHaveValue('Lo guardado, y algo más que aún no he guardado');
  // Recargar
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await openDiary(page);
  await expect(field(page)).toHaveValue('Lo guardado, y algo más que aún no he guardado');
  // Lo guardado no se ha tocado
  expect((await stored(page)).books.find((b) => b.id === id).review).toBe('Lo guardado.');
  // Otro libro: su propia reseña (vacía), sin el borrador del primero
  expect(await page.evaluate((k) => sessionStorage.getItem(`bookshelf:review-draft:${k}`), otherId)).toBeNull();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="shelf"]').evaluate((el) => el.click());
  await expect(page.locator('.library[data-open="true"]')).toBeVisible();
  await page.waitForTimeout(400);
  await page.locator(`.library [data-book-id="${otherId}"]`).first().evaluate((el) => (el.querySelector('button') ?? el).click());
  await expect(page.locator('.book-sheet')).toBeVisible();
  await page.getByRole('tab', { name: 'Diario' }).click();
  await expect(field(page)).toHaveValue('');
});

test('error al guardar: conserva el texto, avisa y permite reintentar sin duplicar', async ({ page }) => {
  await load(page, (st, book) => {
    book.review = '';
  });
  await openDiary(page);
  await field(page).fill('Escrita con el almacenamiento lleno');
  // El almacenamiento del dispositivo falla (cuota, modo privado…)
  await page.evaluate(() => {
    const real = Storage.prototype.setItem;
    window.__realSetItem = real;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'bookshelf:v1') throw new DOMException('lleno', 'QuotaExceededError');
      return real.call(this, k, v);
    };
  });
  await save(page).click();
  const status = page.locator('.review-save__status');
  await expect(status).toHaveAttribute('role', 'alert');
  await expect(status).toContainText('No se ha podido guardar');
  await expect(field(page)).toHaveValue('Escrita con el almacenamiento lleno');
  await expect(status).not.toContainText('guardada');
  // El borrador sigue a salvo mientras no se confirme
  const id = (await stored(page)).settings.currentBookId;
  expect(await page.evaluate((k) => sessionStorage.getItem(`bookshelf:review-draft:${k}`), id)).toBe('Escrita con el almacenamiento lleno');
  await page.evaluate(() => {
    Storage.prototype.setItem = window.__realSetItem;
  });
  await status.getByRole('button', { name: 'Reintentar' }).click();
  await expect(status).toHaveText('Reseña guardada en este dispositivo');
  const st = await stored(page);
  expect(st.books.find((b) => b.id === id).review).toBe('Escrita con el almacenamiento lleno');
  expect(await page.evaluate((k) => sessionStorage.getItem(`bookshelf:review-draft:${k}`), id)).toBeNull();
});

test('historial con muchas sesiones: por fechas, recientes primero, por tandas y sin mover la reseña', async ({ page }) => {
  await load(page, (st, book) => {
    const base = { bookId: book.id, kind: 'read', unit: 'pages', pages: 12, delta: 12, from: 0, to: 12 };
    st.progress.readingLog = st.progress.readingLog.filter((e) => e.bookId !== book.id);
    const day = new Date('2026-10-20T12:00:00');
    for (let i = 0; i < 90; i++) {
      const d = new Date(day);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      st.progress.readingLog.push({ ...base, id: `h${i}`, date: key, createdAt: `${key}T20:00:00.000Z`, from: i, to: i + 12 });
    }
  });
  // La reseña va antes que el historial y en su propia sección: el historial no la empuja
  await openDiary(page);
  const top0 = await page.locator('.diary-sheet').evaluate((el) => el.getBoundingClientRect().top);
  await sections(page).getByRole('tab', { name: 'Historial' }).click();
  const days = page.locator('.diary-panel:not([hidden]) .journal-day');
  await expect(days).toHaveCount(20);
  await expect(days.first().locator('.journal-day__date')).toContainText('20 de octubre de 2026');
  await expect(days.nth(1).locator('.journal-day__date')).toContainText('19 de octubre de 2026');
  await page.getByRole('button', { name: /Ver registros anteriores · 70 días/ }).click();
  await expect(days).toHaveCount(40);
  // La reseña sigue en su sitio al volver
  await sections(page).getByRole('tab', { name: 'Reseña' }).click();
  expect(await page.locator('.diary-sheet').evaluate((el) => el.getBoundingClientRect().top)).toBe(top0);
});

test('accesos directos: una nota del ordenador abre «Notas» y la ficha conserva «Diario»', async ({ page }) => {
  await load(page, (st, book) => {
    book.quotes = [{ id: 'q153', text: 'Una frase para volver a ella', page: 12, color: 'yellow', createdAt: '2026-10-20T10:00:00.000Z' }];
  });
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="laptop"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.pc-diary')).toBeVisible();
  await page.locator('.diary__tabs').getByRole('tab', { name: 'Notas' }).click();
  await page.locator('.pcd-notes .annotation-card', { hasText: 'Una frase para volver a ella' }).locator('.pcd-notes__book').click();
  await expect(page.locator('.book-sheet')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Diario' })).toHaveAttribute('aria-selected', 'true');
  await expect(sections(page).getByRole('tab', { name: 'Notas' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.book-sheet .annotation-card', { hasText: 'Una frase para volver a ella' })).toBeVisible();
});

test('teclado del móvil (emulado con un visor más bajo): el campo activo y «Guardar» se ven y se pulsan', async ({ page }, info) => {
  test.skip(info.project.name.includes('1440'), 'solo móvil');
  await load(page, (st, book) => {
    book.review = Array.from({ length: 14 }, (_, i) => `Línea ${i + 1} de una reseña escrita en el móvil.`).join('\n');
  });
  await openDiary(page);
  const { width } = page.viewportSize();
  await page.setViewportSize({ width, height: 430 });
  await page.waitForTimeout(300);
  await field(page).click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' Y una línea más.');
  const box = await field(page).boundingBox();
  const area = await page.locator('.book-sheet__scroll').boundingBox();
  // Alguna parte del campo activo queda en la zona visible de la hoja
  expect(box.y < area.y + area.height && box.y + box.height > area.y).toBe(true);
  expect(await fullyVisible(page, save(page))).toBe(true);
  await shot(page, info, 'v153-teclado');
  await save(page).click();
  await expect(page.locator('.review-save__status')).toHaveText('Reseña guardada en este dispositivo');
});
