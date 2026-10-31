// QA de la 1.35.0 (SPEC §28): librería con profundidad recuperada, placas sin solapes, anotaciones (crear, editar,
// filtrar, borrar con confirmación, borrador, sin sumar páginas), «Mi diario» (Hoy · Calendario · Notas) con un
// solo registro por lectura, señales de la habitación decorativas que actúan como su objeto, y movimiento reducido.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('bookshelf_onboarding_done', 'true');
    } catch {
      // sin almacenamiento
    }
  });
});

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')));

async function load(page) {
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.waitForTimeout(300);
}

async function openLibrary(page) {
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="shelf"]').evaluate((el) => el.click());
  await expect(page.locator('.library[data-open="true"]')).toBeVisible();
  await page.waitForTimeout(500);
}

async function openBookDiary(page, section) {
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="book"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.book-sheet')).toBeVisible();
  await page.getByRole('tab', { name: 'Diario' }).click();
  // 1.53: el diario abre en «Reseña»; las anotaciones están en «Notas»
  if (section) await page.getByRole('tab', { name: section }).click();
}

async function openDiary(page, view) {
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="laptop"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.pc-diary')).toBeVisible();
  if (view) await page.locator('.diary__tabs').getByRole('tab', { name: view }).click();
}

test('librería (1.43.0): libros completos de tres en tres sobre su balda, sin etiquetas y con su acabado', async ({ page }, info) => {
  await load(page);
  await openLibrary(page);
  const m = await page.evaluate(() => {
    const r = (el) => el.getBoundingClientRect();
    const vw = innerWidth;
    const shelves = [...document.querySelectorAll('.lib-shelf')].map((row) => {
      // Módulo en nueve regiones: superficie = los 208·s px inferiores del borde; canto = los últimos 135·s
      const cs = getComputedStyle(row);
      const bb = parseFloat(cs.borderBottomWidth);
      const plank = { top: r(row).bottom - bb, bottom: r(row).bottom - bb * (135 / 208) + 2 };
      const books = [...row.querySelectorAll('[data-book-id]')].map((b) => r(b));
      return {
        count: books.length,
        booksOnPlank: books.every((b) => b.bottom <= plank.bottom && b.bottom >= plank.top - 2),
        inside: books.every((b) => b.left >= 0 && b.right <= vw),
        sides: [parseFloat(cs.borderLeftWidth), parseFloat(cs.borderRightWidth)],
      };
    });
    const heads = [...document.querySelectorAll('.shelf-row')].map((row) => ({ text: row.querySelector('.shelf-row__title')?.textContent ?? '', count: row.querySelectorAll('[data-book-id]').length }));
    const book = document.querySelector('.library .pbook');
    return {
      shelves,
      heads,
      labels: document.querySelectorAll('.library .book-label').length,
      plaques: document.querySelectorAll('.library .hanging-plaque').length,
      // 1.59: mientras llega la imagen, la tapa en espera (.cover-img--wait) con la misma geometría
      parts: book ? ['.pbook__cover .cover-img, .pbook__cover .gen-cover', '.pbook__shadow'].map((s) => Boolean(book.querySelector(s))) : [],
      named: [...document.querySelectorAll('.library [data-book-id]')].every((b) => (b.getAttribute('aria-label') ?? '').includes(', de ')),
      overflowX: document.documentElement.scrollWidth - vw,
      cam: getComputedStyle(document.querySelector('.library__case')).transform,
    };
  });
  expect(m.overflowX).toBeLessThanOrEqual(0);
  expect(m.cam).toBe('none');
  // Sin etiquetas bajo las portadas ni placas colgantes; cada libro conserva su nombre accesible
  expect(m.labels).toBe(0);
  expect(m.plaques).toBe(0);
  expect(m.named).toBe(true);
  expect(m.parts).toEqual([true, true]);
  const perRow = info.project.name.includes('1440') || info.project.name.includes('844x390') ? 7 : 3;
  for (const s of m.shelves) {
    expect(s.count).toBeLessThanOrEqual(perRow);
    expect(s.booksOnPlank).toBe(true);
    expect(s.inside).toBe(true);
    expect(s.sides.every((w) => w >= 10)).toBe(true);
  }
  // Encabezados con cantidades reales
  for (const h of m.heads) expect(h.text).toMatch(new RegExp(`· ${h.count}$`));
  await shot(page, info, 'v135-libreria');
  // Recuerdos plegables, recordado en el dispositivo
  const board = page.locator('.keepsake-board');
  if (await board.count()) {
    await board.getByRole('button', { name: 'Plegar' }).click();
    await expect(board.locator('.keepsake-note')).toHaveCount(0);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
    await openLibrary(page);
    await expect(page.locator('.keepsake-board')).toHaveAttribute('data-folded', 'true');
    await page.locator('.keepsake-board').getByRole('button', { name: 'Mostrar' }).click();
    await expect(page.locator('.keepsake-board .keepsake-note')).toBeVisible();
  }
});

test('anotaciones: crear, editar, filtrar y borrar con confirmación; borrador; sin sumar páginas', async ({ page }) => {
  await load(page);
  const before = await stored(page);
  const book = before.books.find((b) => b.id === before.settings.currentBookId);
  await openBookDiary(page, 'Notas');
  const sheet = page.locator('.book-sheet');
  await expect(sheet.getByText('Solo para ti')).toBeVisible();
  // 1.53: «Notas» solo cuenta anotaciones; sin ninguna, el formulario se abre con «Escribir mi primera anotación»
  const first = sheet.getByRole('button', { name: 'Escribir mi primera anotación' });
  if (await first.isVisible()) await first.click();
  const form = sheet.locator('.annotation-form').last();
  // Borrador: se conserva al cambiar de pestaña y al recargar
  await form.getByLabel('Nueva anotación').fill('Una frase a medias');
  await page.getByRole('tab', { name: 'Ficha' }).click();
  await page.getByRole('tab', { name: 'Diario' }).click();
  await expect(sheet.locator('.annotation-form').last().getByLabel('Nueva anotación')).toHaveValue('Una frase a medias');
  // Página posterior al progreso: se permite y no suma páginas
  const later = (book.pageCount ?? 500) + 50;
  await form.getByLabel('Nueva anotación').fill('Y entonces me dijo adiós');
  await form.getByLabel('Página de referencia').fill(String(later));
  await form.getByRole('radio', { name: /Idea|Amarillo/ }).first().click();
  await form.getByRole('button', { name: 'Guardar anotación' }).click();
  await expect(form.getByRole('status')).toContainText('Guardado en este dispositivo');
  const after = await stored(page);
  const saved = after.books.find((b) => b.id === book.id);
  const q = saved.quotes.find((x) => x.text === 'Y entonces me dijo adiós');
  expect(q.page).toBe(later);
  expect(saved.currentPage).toBe(book.currentPage);
  expect(after.progress.readingLog.length).toBe(before.progress.readingLog.length);
  // El borrador se descarta al guardar
  await expect(form.getByLabel('Nueva anotación')).toHaveValue('');
  expect(await page.evaluate((id) => sessionStorage.getItem(`bookshelf:note-draft:${id}`), book.id)).toBeNull();
  // Editar
  const card = sheet.locator('.annotation-card', { hasText: 'Y entonces me dijo adiós' });
  await card.getByRole('button', { name: 'Editar esta anotación' }).click();
  const edit = sheet.locator('.journal-entry--editing .annotation-form');
  await edit.getByLabel('Texto de la anotación').fill('Y entonces me dijo adiós, despacio');
  await edit.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(sheet.locator('.annotation-card', { hasText: 'despacio' })).toBeVisible();
  await expect.poll(async () => (await stored(page)).books.find((b) => b.id === book.id).quotes.find((x) => x.id === q.id).text).toBe('Y entonces me dijo adiós, despacio');
  // Filtrar por categoría: color + etiqueta
  const filter = sheet.locator('.quote-filter');
  await filter.getByRole('radio').nth(1).click();
  await expect(sheet.locator('.diary-panel:not([hidden]) .journal-entry--session')).toHaveCount(0);
  await filter.getByRole('radio').first().click();
  // Borrar: el menú pide confirmación; cancelar no borra
  const target = sheet.locator('.annotation-card', { hasText: 'despacio' });
  await target.getByRole('button', { name: /Más opciones/ }).click();
  await page.getByRole('menuitem', { name: 'Borrar' }).click();
  await target.getByRole('button', { name: 'Cancelar' }).click();
  await expect(target).toBeVisible();
  await target.getByRole('button', { name: /Más opciones/ }).click();
  await page.getByRole('menuitem', { name: 'Borrar' }).click();
  await target.getByRole('button', { name: 'Sí, borrar' }).click();
  await expect(sheet.locator('.annotation-card', { hasText: 'despacio' })).toHaveCount(0);
  await expect.poll(async () => (await stored(page)).books.find((b) => b.id === book.id).quotes.some((x) => x.id === q.id)).toBe(false);
});

test('mi reseña: hoja con firma y estado privado inequívoco', async ({ page }) => {
  await load(page);
  await openBookDiary(page);
  // 1.53 (SPEC §51): la carta con pinza es ahora la hoja de borde doble terracota de «Reseña»
  await expect(page.locator('.diary-sheet')).toBeVisible();
  await expect(page.locator('.review-state')).toContainText('Privada');
});

test('mi diario: Hoy registra una sola vez y la nota no suma páginas; Notas filtra, edita y borra', async ({ page }, info) => {
  await load(page);
  const before = await stored(page);
  await openDiary(page, 'Hoy');
  const today = page.locator('.pcd-today');
  await expect(today.locator('.pcd-date h3')).toBeVisible();
  await expect(today.getByRole('heading', { name: 'Mi semana lectora' })).toBeVisible();
  await shot(page, info, 'v135-diario-hoy');
  // Nota «Lo que me llevo de estas páginas»
  await today.getByRole('button', { name: 'Escribir una nota' }).click();
  const take = today.locator('.annotation-form');
  await take.getByLabel('Nueva anotación').fill('A veces una historia te encuentra');
  await take.getByRole('button', { name: 'Guardar nota' }).click();
  await expect(take.getByRole('status')).toContainText('Guardado');
  const mid = await stored(page);
  expect(mid.progress.readingLog.length).toBe(before.progress.readingLog.length);
  expect(mid.books.flatMap((b) => b.quotes).filter((x) => x.text === 'A veces una historia te encuentra')).toHaveLength(1);
  // Registrar lectura: el mismo formulario; una sola entrada nueva
  await today.getByRole('button', { name: 'Registrar lectura' }).click();
  const entry = page.locator('.pcd-today .reading-form');
  await expect(entry).toBeVisible();
  const reading = mid.books.find((b) => b.status === 'reading' && b.id === (mid.settings.currentBookId ?? b.id));
  await entry.getByRole('radio', { name: 'Voy por la página' }).click();
  await entry.getByRole('textbox', { name: 'Página', exact: true }).fill(String(reading.currentPage + 7));
  await entry.getByRole('button', { name: 'Guardar lectura' }).click();
  // Una sola entrada nueva, y el progreso coherente en ficha y diario
  await expect.poll(async () => (await stored(page)).progress.readingLog.length).toBe(mid.progress.readingLog.length + 1);
  await page.waitForTimeout(400);
  const end = await stored(page);
  expect(end.progress.readingLog.length).toBe(mid.progress.readingLog.length + 1);
  expect(end.books.find((b) => b.id === reading.id).currentPage).toBe(reading.currentPage + 7);
  // Notas: búsqueda, filtro por libro, edición y borrado con confirmación
  await page.locator('.diary__tabs').getByRole('tab', { name: 'Notas' }).click();
  const notes = page.locator('.pcd-notes');
  await notes.getByLabel('Buscar en mis notas').fill('historia te encuentra');
  await expect(notes.locator('.annotation-card')).toHaveCount(1);
  await notes.getByLabel('Buscar en mis notas').fill('');
  const card = notes.locator('.annotation-card', { hasText: 'historia te encuentra' });
  await card.getByRole('button', { name: 'Editar esta anotación' }).click();
  await notes.locator('.journal-entry--editing').getByLabel('Texto de la anotación').fill('A veces una historia te encuentra justo a tiempo');
  await notes.locator('.journal-entry--editing').getByRole('button', { name: 'Guardar cambios' }).click();
  const edited = notes.locator('.annotation-card', { hasText: 'justo a tiempo' });
  await expect(edited).toBeVisible();
  await edited.getByRole('button', { name: /Más opciones/ }).click();
  await page.getByRole('menuitem', { name: 'Borrar' }).click();
  await edited.getByRole('button', { name: 'Sí, borrar' }).click();
  await expect.poll(async () => (await stored(page)).books.flatMap((b) => b.quotes).some((x) => x.text.includes('justo a tiempo'))).toBe(false);
  // Abrir una nota en su contexto (la ficha del libro, pestaña Diario)
  const any = notes.locator('.pcd-notes__book').first();
  if (await any.count()) {
    await any.click();
    await expect(page.locator('.book-sheet')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Diario' })).toHaveAttribute('aria-selected', 'true');
  }
});

test('nombres de la habitación: solo con «Guías», decorativos, y el toque llega a su objeto', async ({ page }, info) => {
  await load(page);
  // 1.39.0 (SPEC §31.2): sin guías la escena queda limpia; la ayuda inicial se muestra y se descarta
  await expect(page.locator('.room-signs')).toHaveCount(0);
  const hint = page.locator('.room-signs-hint');
  await expect(hint).toBeVisible();
  await hint.getByRole('button', { name: 'Entendido' }).click();
  await expect(hint).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('bookshelf:signs-hint-done'))).toBe('true');
  // Con guías: icono + nombre por objeto, sin placas
  // (antes de cargar: al recargar, la app vuelca su estado en «pagehide» y pisaría un cambio hecho a mano)
  await page.addInitScript(() => {
    const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
    if (st) {
      st.settings.showGuides = true;
      localStorage.setItem('bookshelf:v1', JSON.stringify(st));
    }
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  const signs = page.locator('.room-signs .room-sign');
  await expect(signs).toHaveCount(7);
  await expect(page.locator('.room-signs')).toHaveAttribute('aria-hidden', 'true');
  const meta = await signs.evaluateAll((els) => els.map((el) => ({ pe: getComputedStyle(el).pointerEvents, focusable: el.matches('button, a, [tabindex]'), text: el.textContent, icon: Boolean(el.querySelector('svg')), plate: Boolean(el.querySelector('.room-sign__plate')) })));
  expect(meta.map((s) => s.text)).toEqual(['Colección', 'Mi biblioteca', 'Mi lectura', 'Mi diario', 'Tiempo de lectura', 'Ambiente', 'Mis sagas']);
  meta.forEach((s) => {
    expect(s.pe).toBe('none');
    expect(s.focusable).toBe(false);
    expect(s.icon).toBe(true);
    expect(s.plate).toBe(false);
  });
  await shot(page, info, 'v139-nombres');
  // Ningún nombre visible recibe el toque: lo recibe el objeto de debajo
  const hits = await page.evaluate(() =>
    [...document.querySelectorAll('.room-sign')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return null;
        return { onSign: Boolean(document.elementFromPoint(x, y)?.closest('.room-sign')) };
      })
      .filter(Boolean),
  );
  expect(hits.length).toBeGreaterThan(0);
  expect(hits.filter((h) => h.onSign)).toEqual([]);
});

test('movimiento reducido: las señales no se animan', async ({ page }, info) => {
  test.skip(!info.project.name.includes('reduced'), 'solo en el perfil de movimiento reducido');
  await load(page);
  const anims = await page.locator('.room-sign').evaluateAll((els) => els.map((el) => getComputedStyle(el).animationName));
  expect(anims.every((a) => a === 'none')).toBe(true);
});
