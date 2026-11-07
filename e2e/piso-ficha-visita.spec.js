// Piloto del piso: registrar una lectura desde la ficha con el teclado abierto, que lo guardado siga tras recargar, y el
// recorrido piso propio → edificio → piso de la vecina → edificio sin tocar nada del propietario.
// Biblioteca de prueba de 50 libros en el perfil de Playwright. Emulación: el teclado se simula (Android encoge la ventana;
// en el iPhone solo encoge la parte visible), no es un teclado ni un móvil reales.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'qa-report/piso-ficha-visita';
const KB = 336;
const MINE = /Entrar en tu piso/;
const NEIGHBOUR = /Llamar y entrar en el piso de Vecina de prueba/;

test.beforeEach(async ({ page }, info) => {
  test.skip(!/(chromium|webkit)-390x844$/.test(info.project.name), 'móvil vertical');
  mkdirSync(OUT, { recursive: true });
  await page.route('https://covers.openlibrary.org/**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/?piloto=piso&biblioteca=50');
});

async function enter(page, re = MINE) {
  await page.getByRole('button', { name: re }).click();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().windows.length > 0, null, { timeout: 30000 });
}
const stored = (page) =>
  page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('bookshelf:v1'));
    const b = s.books.find((x) => x.id === 'lab-0');
    return { pagina: b.currentPage, sesiones: s.progress.readingLog.filter((e) => e.bookId === 'lab-0').length };
  });

// Cada control del formulario, dentro de la parte visible y sin nada encima, tras llevarlo a la vista desplazando la ficha
const reachable = (page) =>
  page.evaluate(() => {
    const bottom = window.visualViewport.height + window.visualViewport.offsetTop;
    const form = document.querySelector('.book-sheet .reading-form');
    const parts = {
      campo: form.querySelector('.reading-form__input input'),
      resumen: form.querySelector('.reading-form__preview'),
      guardar: [...form.querySelectorAll('button')].find((b) => /Guardar lectura/.test(b.textContent)),
      cancelar: [...form.querySelectorAll('button')].find((b) => /Cancelar/.test(b.textContent)),
    };
    const out = {};
    for (const [name, el] of Object.entries(parts)) {
      el.scrollIntoView({ block: 'nearest' });
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      out[name] = r.top >= 0 && r.bottom <= bottom && Boolean(hit) && (hit === el || el.contains(hit));
    }
    return out;
  });
const ALL = { campo: true, resumen: true, guardar: true, cancelar: true };

for (const keyboard of ['cerrado', 'android', 'iphone']) {
  test(`ficha: registrar con el teclado ${keyboard} y seguir guardado tras recargar`, async ({ page }, info) => {
    await enter(page);
    await page.getByRole('button', { name: 'Ver la balda' }).click();
    await page.waitForFunction(() => window.__pisoLab().debug().zoomed);
    await page.getByRole('button', { name: /Buscar en toda la biblioteca/ }).click();
    const title = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.find((b) => b.id === 'lab-0').title);
    await page.getByRole('searchbox', { name: /Buscar por título/ }).fill(title);
    await page.locator('.plab-row__open').first().click();
    const sheet = page.locator('.book-sheet');
    await sheet.getByRole('button', { name: 'Registrar lectura' }).click();
    const input = sheet.locator('.reading-form__input input');
    await input.focus();
    if (keyboard === 'android') await page.setViewportSize({ width: 390, height: 844 - KB });
    if (keyboard === 'iphone') {
      await page.evaluate((kb) => {
        const vv = window.visualViewport;
        Object.defineProperty(vv, 'height', { configurable: true, get: () => window.innerHeight - kb });
        vv.dispatchEvent(new Event('resize'));
        const k = document.createElement('div');
        k.style.cssText = `position:fixed;left:0;right:0;bottom:0;height:${kb}px;background:rgba(40,40,48,.92);z-index:2147483647;pointer-events:none`;
        document.body.append(k);
      }, KB);
    }
    await page.waitForTimeout(400);
    // El campo con el foco queda a la vista sin tocar nada
    const box = await input.boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(844 - (keyboard === 'cerrado' ? 0 : KB));
    expect(await reachable(page)).toEqual(ALL);

    const before = await stored(page);
    // «He leído» (el modo de entrada): páginas leídas en esta sesión
    await input.fill('5');
    await page.screenshot({ path: `${OUT}/ficha-${keyboard}-${info.project.name}.png` });
    await sheet.getByRole('button', { name: /Guardar lectura/ }).click();
    await expect.poll(() => stored(page)).toEqual({ pagina: before.pagina + 5, sesiones: before.sesiones + 1 });
    // Confirmación, progreso al día y formulario cerrado, con «Deshacer» a mano
    await expect(sheet.locator('.log-toast--inline')).toContainText('Lectura registrada');
    await expect(sheet.locator('.log-toast--inline').getByRole('button', { name: 'Deshacer' })).toBeVisible();
    await expect(sheet.locator('.reading-form')).toHaveCount(0);
    await expect(sheet.getByRole('spinbutton', { name: 'Página actual' })).toHaveValue(String(before.pagina + 5));
    await expect(sheet.getByRole('button', { name: 'Registrar lectura' })).toBeFocused();
    await sheet.locator('.log-toast--inline').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/ficha-guardado-${keyboard}-${info.project.name}.png` });
    // Al recargar, la app vuelve a donde estaba (el historial) con lo leído del almacenamiento
    await page.reload();
    await page.waitForFunction(() => document.querySelector('.plab-room, .book-sheet') && typeof window.__pisoLab === 'function', null, { timeout: 30000 });
    await page.waitForTimeout(500);
    expect(await stored(page)).toEqual({ pagina: before.pagina + 5, sesiones: before.sesiones + 1 });
  });
}

// Abre la ficha de un libro de la biblioteca de prueba desde «Buscar en toda la biblioteca»
async function openSheet(page, id) {
  await page.getByRole('button', { name: 'Ver la balda' }).click();
  await page.waitForFunction(() => window.__pisoLab().debug().zoomed);
  await page.getByRole('button', { name: /Buscar en toda la biblioteca/ }).click();
  const title = await page.evaluate((x) => JSON.parse(localStorage.getItem('bookshelf:v1')).books.find((b) => b.id === x).title, id);
  await page.getByRole('searchbox', { name: /Buscar por título/ }).fill(title);
  await page.locator('.plab-row__open').first().click();
  return page.locator('.book-sheet');
}
const bookOf = (page, id) => page.evaluate((x) => {
  const s = JSON.parse(localStorage.getItem('bookshelf:v1'));
  const b = s.books.find((y) => y.id === x);
  return { status: b.status, pagina: b.currentPage, total: b.pageCount, terminado: b.finishedAt, antes: b.pastReads ?? [], sesiones: (s.progress?.readingLog ?? []).filter((e) => e.bookId === x).length };
}, id);
// Cambia un libro (y, si se pide, añade una sesión al registro) antes de que la app arranque en la siguiente carga: al
// salir, la app vuelve a escribir su estado y pisaría un cambio hecho con la página abierta. Solo una vez.
async function setBook(page, id, patch, entry = null) {
  await page.addInitScript(([x, p, e]) => {
    if (sessionStorage.getItem('prueba:hecho')) return;
    sessionStorage.setItem('prueba:hecho', '1');
    const s = JSON.parse(localStorage.getItem('bookshelf:v1'));
    s.books = s.books.map((b) => (b.id === x ? { ...b, ...p } : b));
    if (e) s.progress = { ...s.progress, readingLog: [...(s.progress?.readingLog ?? []), { ...e, bookId: x }] };
    localStorage.setItem('bookshelf:v1', JSON.stringify(s));
  }, [id, patch, entry]);
  await page.goto('/?piloto=piso&biblioteca=50');
}

test('ficha: «Deshacer» devuelve el progreso y la sesión, también tras recargar', async ({ page }) => {
  await enter(page);
  const sheet = await openSheet(page, 'lab-0');
  const before = await stored(page);
  await sheet.getByRole('button', { name: 'Registrar lectura' }).click();
  await sheet.locator('.reading-form__input input').fill('7');
  await sheet.getByRole('button', { name: /Guardar lectura/ }).click();
  await expect.poll(() => stored(page)).toEqual({ pagina: before.pagina + 7, sesiones: before.sesiones + 1 });
  await sheet.locator('.log-toast--inline').getByRole('button', { name: 'Deshacer' }).click();
  await expect(sheet.getByText('Registro deshecho')).toBeVisible();
  await expect.poll(() => stored(page)).toEqual(before);
  await page.reload();
  await page.waitForTimeout(1500);
  expect(await stored(page)).toEqual(before);
});

test('ficha: en la última página y aún en «Leyendo» se ofrece terminarlo', async ({ page }) => {
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.find((b) => b.status === 'reading' && b.id !== 'lab-0' && b.pageCount > 0).id);
  const { total } = await bookOf(page, id);
  await setBook(page, id, { currentPage: total, currentPercent: 100 });
  await enter(page);
  const sheet = await openSheet(page, id);
  await expect(sheet.locator('.sheet-log__finish')).toContainText('última página');
  expect((await bookOf(page, id)).status).toBe('reading');
  await sheet.getByRole('button', { name: 'Marcar como terminado' }).click();
  await expect.poll(async () => (await bookOf(page, id)).status).toBe('read');
});

test('ficha: la relectura se empieza a petición y conserva el historial', async ({ page }) => {
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.find((b) => b.status === 'read' && b.pageCount > 0).id);
  // Una sesión anterior en el registro, para ver que se conserva
  await setBook(page, id, {}, { id: 'prueba-relectura', date: '2026-10-01', kind: 'read', delta: 20, createdAt: '2026-10-01T10:00:00.000Z' });
  const before = await bookOf(page, id);
  expect(before.sesiones).toBeGreaterThan(0);
  await enter(page);
  const sheet = await openSheet(page, id);
  // Terminado: ni registro ni controles de página que lo devuelvan a «Leyendo» sin querer
  await expect(sheet.getByRole('button', { name: 'Registrar lectura' })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Avanzar una página' })).toHaveCount(0);
  expect((await bookOf(page, id)).status).toBe('read');
  await sheet.getByRole('button', { name: 'Empezar relectura' }).click();
  await expect(sheet.getByText('Ya lo leíste una vez')).toBeVisible();
  await sheet.getByText('Ya lo leíste una vez').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/relectura-${test.info().project.name}.png` });
  await expect(sheet.getByRole('button', { name: 'Registrar lectura' })).toBeVisible();
  await page.reload();
  await page.waitForTimeout(1500);
  const after = await bookOf(page, id);
  expect(after).toMatchObject({ status: 'reading', pagina: 0, terminado: null, sesiones: before.sesiones });
  expect(after.antes).toEqual([expect.objectContaining({ finishedAt: before.terminado })]);
});

test('recorrido: tu piso → edificio → piso de la vecina → edificio, y de visita no se toca nada', async ({ page }, info) => {
  await enter(page);
  await expect(page.getByRole('button', { name: 'Decorar' })).toBeVisible();
  await page.getByRole('button', { name: 'Al portal' }).click();
  await expect(page.getByRole('button', { name: NEIGHBOUR })).toBeVisible();

  const keys = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
  const before = await keys();
  await enter(page, NEIGHBOUR);
  // De visita: ni registrar ni decorar ni buscar en la biblioteca del propietario
  await expect(page.locator('.plab-primary')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Decorar' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver la balda' }).click();
  await expect(page.getByRole('button', { name: 'Volver a la sala' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Buscar en toda la biblioteca/ })).toHaveCount(0);
  // El nombre del piso, entero con un toque aunque no quepa
  const name = page.locator('.plab-title__btn');
  await expect(name).toHaveAttribute('aria-expanded', 'false');
  await name.click();
  await expect(name).toHaveAttribute('aria-expanded', 'true');
  expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: `${OUT}/vecina-${info.project.name}.png` });
  await page.getByRole('button', { name: 'Volver a la sala' }).click();
  await page.getByRole('button', { name: 'Al portal' }).click();
  await expect(page.getByRole('button', { name: MINE })).toBeVisible();
  expect(await keys()).toEqual(before);
});
