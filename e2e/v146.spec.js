// QA de la 1.46.0 (SPEC §39): libro físico con la portada original intacta y el material según la edición
// guardada (tapas rígidas, rústica, lector electrónico y estuche de audiolibro), sin dorados generales.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

const EDITIONS = { hard: 'hardcover', soft: 'paperback', device: 'kindle', case: 'audiobook' };

test('libros: encuadernación según la edición, portada intacta e indicador del audiolibro fuera de ella', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/');
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.waitForTimeout(400);
  // Cuatro ejemplares iguales (mismas páginas y portada) que solo cambian de edición, sembrados antes de cargar
  const seeded = await page.evaluate((eds) => {
    const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
    const base = st.books.find((b) => b.cover) ?? st.books[0];
    const copies = Object.entries(eds).map(([k, editionType]) => ({ ...base, id: `fmt-${k}`, editionType, status: 'reading', pageCount: 517, shelfOrder: -10 }));
    st.books = [...copies, ...st.books.filter((b) => b.status !== 'reading')];
    return JSON.stringify(st);
  }, EDITIONS);
  await page.addInitScript((v) => localStorage.setItem('bookshelf:v1', v), seeded);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="shelf"]').evaluate((el) => el.click());
  await expect(page.locator('.library[data-open="true"]')).toBeVisible();
  const m = await page.evaluate((ids) => {
    const out = {};
    for (const id of ids) {
      const b = document.querySelector(`.library [data-book-id="fmt-${id}"] .pbook, .library .pbook[data-book-id="fmt-${id}"]`) ?? document.querySelector(`[data-book-id="fmt-${id}"]`)?.closest('.pbook');
      if (!b) continue;
      const cover = b.querySelector('.pbook__cover').getBoundingClientRect();
      const audio = b.querySelector('.pbook__audio')?.getBoundingClientRect();
      const img = b.querySelector('.pbook__cover img');
      out[id] = {
        binding: b.dataset.binding,
        depth: parseFloat(b.style.getPropertyValue('--d')),
        finish: Boolean(b.querySelector('.pbook__finish')),
        corners: b.querySelectorAll('.pbook__corner').length,
        // La portada se muestra entera y sin cambiar su proporción
        // (tamaño de maquetación, antes del giro 3D; sin descargar todavía no hay proporción que comparar)
        ratioOk: !img?.naturalWidth || Math.abs(img.offsetWidth / img.offsetHeight - img.naturalWidth / img.naturalHeight) < 0.03,
        audioCoversArt: audio ? audio.left + audio.width / 2 < cover.right - 4 && audio.top + audio.height / 2 < cover.bottom - 4 : false,
      };
    }
    return out;
  }, Object.keys(EDITIONS));
  for (const [id] of Object.entries(EDITIONS)) {
    expect(m[id], `ejemplar ${id}`).toBeTruthy();
    expect(m[id].binding).toBe(id);
    expect(m[id].finish).toBe(true);
    expect(m[id].corners).toBe(0);
    expect(m[id].ratioOk).toBe(true);
  }
  // Mismas páginas: la tapa dura es más gruesa que la rústica; el lector es una lámina
  expect(m.hard.depth).toBeGreaterThan(m.soft.depth);
  expect(m.device.depth).toBeLessThan(m.soft.depth);
  // El indicador del audiolibro no tapa la portada (va en la esquina del estuche)
  expect(m.case.audioCoversArt).toBe(false);
});

// ── Buscador (SPEC §40), con los proveedores simulados: nada depende de la red real ──
const OL_WORK = { key: '/works/OL20716197W', title: 'The Ballad of Songbirds and Snakes', author_name: ['Suzanne Collins'], cover_i: 14421833, first_publish_year: 2020, edition_count: 34, language: ['eng', 'spa'] };
const ED_ES = { key: '/books/OL57579500M', title: 'Balada de pájaros cantores y serpientes', publishers: ['Molino'], publish_date: '2025', number_of_pages: 592, languages: [{ key: '/languages/spa' }], isbn_13: ['9788427248496'], physical_format: 'Hardcover', works: [{ key: '/works/OL20716197W' }] };
const ED_EN = { key: '/books/OL1M', title: 'The Ballad of Songbirds and Snakes', publishers: ['Scholastic'], publish_date: '2020', number_of_pages: 517, languages: [{ key: '/languages/eng' }], isbn_13: ['9781338635171'], covers: [10] };
const gItem = (id, title) => ({ id, volumeInfo: { title, authors: ['Autora de prueba'], publisher: 'Editorial', publishedDate: '2001', language: 'es', pageCount: 200, industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780306406157' }] } });

async function mockProviders(page, { google = 'ok' } = {}) {
  const calls = [];
  await page.route('https://www.googleapis.com/**', async (route) => {
    const q = new URL(route.request().url()).searchParams.get('q') ?? '';
    calls.push(`google:${q}`);
    if (google === '429') return route.fulfill({ status: 429, body: '{}' });
    if (q.startsWith('lento')) {
      await new Promise((r) => setTimeout(r, 1500));
      return route.fulfill({ json: { items: [gItem('v1', 'Resultado viejo')] } }).catch(() => {});
    }
    return route.fulfill({ json: { items: [gItem('v2', 'Resultado nuevo de una consulta con un título muy largo que necesita varias líneas para leerse entero')] } });
  });
  await page.route('https://openlibrary.org/**', async (route) => {
    const url = new URL(route.request().url());
    calls.push(`ol:${url.pathname}${url.search}`);
    if (url.pathname === '/search.json') return route.fulfill({ json: { docs: [OL_WORK] } });
    if (url.pathname === '/isbn/9788427248496.json') return route.fulfill({ json: ED_ES });
    if (url.pathname.endsWith('/editions.json')) return route.fulfill({ json: { size: 34, entries: [ED_EN, ED_ES] } });
    if (url.pathname === '/works/OL20716197W.json') return route.fulfill({ json: { description: 'Sinopsis de la obra.' } });
    return route.fulfill({ status: 404, body: '' });
  });
  await page.route('https://covers.openlibrary.org/**', (route) => route.fulfill({ status: 404, body: '' }));
  return calls;
}

async function openAdd(page) {
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="shelf"]').evaluate((el) => el.click());
  await page.getByRole('button', { name: 'Añadir libro' }).click();
  return page.getByRole('searchbox', { name: /Buscar libros/ });
}

const storedBook = (page, pred) => page.evaluate((src) => JSON.parse(localStorage.getItem('bookshelf:v1')).books.find(new Function('b', `return ${src}`)), pred);

test('buscador: una respuesta vieja no pisa a la nueva y los títulos largos se leen enteros', async ({ page }) => {
  const calls = await mockProviders(page);
  const box = await openAdd(page);
  await box.fill('lento');
  await page.waitForTimeout(550);
  await box.fill('rapido');
  await expect(page.locator('.result strong').first()).toContainText('Resultado nuevo');
  await page.waitForTimeout(1600);
  await expect(page.locator('.results')).not.toContainText('Resultado viejo');
  const t = await page.locator('.result strong').first().evaluate((el) => ({ lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)), cut: el.scrollWidth > el.clientWidth + 1 }));
  expect(t.lines).toBeGreaterThan(1);
  expect(t.cut).toBe(false);
  // Sin mensajes técnicos; sí la atribución
  await expect(page.locator('.index-card')).not.toContainText('respaldo');
  await expect(page.locator('.index-card__source')).toHaveText('Datos de Google Books');
  // Repetir la misma consulta (cambiando mayúsculas y tildes) no vuelve a pedirla
  const before = calls.filter((c) => c.startsWith('google:')).length;
  await box.fill('RÁPIDO');
  await page.waitForTimeout(700);
  await box.fill('rapido');
  await page.waitForTimeout(700);
  expect(calls.filter((c) => c.startsWith('google:')).length).toBe(before);
});

test('buscador: ISBN exacto primero, elegir edición sin mezclar datos y guardar', async ({ page }, info) => {
  await mockProviders(page, { google: '429' });
  const box = await openAdd(page);
  await box.fill('978-84-272-4849-6');
  const first = page.locator('.result').first();
  await expect(first).toContainText('Coincide el ISBN');
  await expect(first).toContainText('Molino · 2025 · Español · 592 págs.');
  await shot(page, info, 'v146-buscador-isbn');
  // Por título: la obra lleva a sus ediciones (la del idioma del usuario primero)
  await box.fill('balada de pajaros');
  await expect(page.locator('.result[data-kind="work"]')).toContainText('34 ediciones');
  await page.locator('.result[data-kind="work"]').click();
  await expect(page.locator('.edition-step .result').first()).toContainText('Molino');
  await expect(page.locator('.edition-step .result')).toHaveCount(2);
  await shot(page, info, 'v146-buscador-ediciones');
  await page.locator('.edition-step .result').first().click();
  // Confirmación: edición elegida con SUS datos; la fecha de la obra va aparte; sinopsis desplegable
  await expect(page.locator('.confirm-book__kicker')).toHaveText('Edición elegida');
  await expect(page.getByLabel('Páginas', { exact: true })).toHaveValue('592');
  await expect(page.getByLabel('Editorial')).toHaveValue('Molino');
  await expect(page.getByLabel('Fecha de la edición')).toHaveValue('2025');
  await expect(page.getByLabel('Formato')).toHaveValue('hardcover');
  await expect(page.locator('.confirm-book__summary')).toContainText('Obra publicada en 2020');
  await expect(page.locator('.confirm-book__synopsis')).toBeHidden();
  await page.locator('details.confirm-book__more summary').click();
  await expect(page.locator('.confirm-book__synopsis')).toHaveText('Sinopsis de la obra.');
  await shot(page, info, 'v146-buscador-confirmar');
  await page.getByRole('button', { name: 'Colocar en la balda' }).click();
  await expect.poll(() => storedBook(page, "b.isbn === '9788427248496'")).toBeTruthy();
  const book = await storedBook(page, "b.isbn === '9788427248496'");
  expect(book).toMatchObject({ title: 'Balada de pájaros cantores y serpientes', pageCount: 592, publisher: 'Molino', publishedDate: '2025', firstPublished: '2020', language: 'es', editionType: 'hardcover', cover: '' });
});

test('buscador: sin páginas conocidas no se inventan (hay que escribirlas o marcar «Sin total»)', async ({ page }) => {
  await mockProviders(page, { google: '429' });
  const box = await openAdd(page);
  await box.fill('balada de pajaros');
  await page.locator('.result[data-kind="work"]').click();
  await page.getByRole('button', { name: /seguir solo con los datos de la obra/ }).click();
  await expect(page.getByLabel('Páginas', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Colocar en la balda' }).click();
  await expect(page.getByRole('alert')).toContainText('Sin total');
  await page.getByLabel('Sin total (ebook)').check();
  await page.getByRole('button', { name: 'Colocar en la balda' }).click();
  await expect(page.locator('.index-card')).toHaveCount(0);
  await expect.poll(() => storedBook(page, "b.title === 'The Ballad of Songbirds and Snakes'")).toBeTruthy();
  const book = await storedBook(page, "b.title === 'The Ballad of Songbirds and Snakes'");
  expect(book.pageCount).toBeNull();
  expect(book.trackBy).toBe('percent');
});
