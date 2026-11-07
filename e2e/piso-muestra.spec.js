// 1.88 · Muestras visuales de la estantería del piso con ediciones reales (portadas de Open Library por ISBN). Necesitan red:
// si Open Library no responde, se saltan. Capturas en qa-report/piso-muestra/.
// - Cinco ediciones: desde la habitación, de cerca de cada balda y cada ejemplar elegido; y cada una de esas mismas
//   ediciones como libro de la mesa, a la misma hora (tarde), para comparar.
// - Veintiocho ediciones: caben (como mucho 30 representadas), ningún libro atraviesa a otro al salir y girar, y cada uno
//   se puede elegir con un toque en el móvil.
// Emulación: Chromium dibuja WebGL por software y WebKit de Playwright no equivale a Safari en un iPhone.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'qa-report/piso-muestra';
const MINE = /^Entrar en tu piso, 1\.º A/;
const FIVE = [
  { isbn: '9780307474728', title: 'Cien años de soledad', author: 'Gabriel García Márquez', pageCount: 417, editionType: 'paperback' },
  { isbn: '9780451524935', title: '1984', author: 'George Orwell', pageCount: 328, editionType: 'paperback' },
  { isbn: '9780756404741', title: 'The Name of the Wind', author: 'Patrick Rothfuss', pageCount: 662, editionType: 'hardcover' },
  { isbn: '9780141439518', title: 'Pride and Prejudice', author: 'Jane Austen', pageCount: 480, editionType: 'paperback' },
  { isbn: '9780547928227', title: 'The Hobbit', author: 'J. R. R. Tolkien', pageCount: 300, editionType: 'paperback' },
];
// Títulos, páginas y formato, de la ficha de cada ISBN en Open Library
const MORE = [
  ['9780061120084', 'To Kill a Mockingbird', 'Harper Lee', 323, 'paperback'],
  ['9780743273565', 'The Great Gatsby', 'F. Scott Fitzgerald', 180, 'paperback'],
  ['9780140449136', 'Crime and Punishment', 'Fyodor Dostoevsky', 671, 'paperback'],
  ['9780060850524', 'Brave New World', 'Aldous Huxley', 288, 'paperback'],
  ['9780544003415', 'The Lord of the Rings', 'J. R. R. Tolkien', 1216, 'hardcover'],
  ['9780385490818', "The Handmaid's Tale", 'Margaret Atwood', 311, 'paperback'],
  ['9780307277671', 'The Da Vinci Code', 'Dan Brown', 454, 'paperback'],
  ['9780143039433', 'The Grapes of Wrath', 'John Steinbeck', 464, 'paperback'],
  ['9780553293357', 'Foundation', 'Isaac Asimov', 320, 'paperback'],
  ['9780441172719', 'Dune', 'Frank Herbert', 535, 'paperback'],
  ['9780765326355', 'The Way of Kings', 'Brandon Sanderson', 1008, 'hardcover'],
  ['9780765311788', 'Mistborn', 'Brandon Sanderson', 541, 'hardcover'],
  ['9781501142970', 'It', 'Stephen King', 1168, 'paperback'],
  ['9780307387899', 'The Road', 'Cormac McCarthy', 287, 'paperback'],
  ['9780375842207', 'The Book Thief', 'Markus Zusak', 566, 'paperback'],
  ['9780812550702', "Ender's Game", 'Orson Scott Card', 324, 'paperback'],
  ['9780062315007', 'The Alchemist', 'Paulo Coelho', 208, 'paperback'],
  ['9780735219090', 'Where the Crawdads Sing', 'Delia Owens', 384, 'hardcover'],
  ['9781250301697', 'The Silent Patient', 'Alex Michaelides', 336, 'hardcover'],
  ['9780679783268', 'Pride and Prejudice', 'Jane Austen', 320, 'paperback'],
  ['9780142437230', 'Don Quixote', 'Miguel de Cervantes', 1023, 'paperback'],
  ['9780618260300', 'The Hobbit', 'J. R. R. Tolkien', 320, 'paperback'],
  ['9788408163381', 'El laberinto de los espíritus', 'Carlos Ruiz Zafón', 928, 'hardcover'],
].map(([isbn, title, author, pageCount, editionType]) => ({ isbn, title, author, pageCount, editionType }));
const COLORS = ['#7a2f2a', '#25496b', '#3f6048', '#8a6a2f', '#553a6b', '#2e5a5a', '#94502e', '#3a3a4a'];

const libraryOf = (editions, reading) => ({
  version: 6,
  books: editions.map((e, i) => ({
    id: `muestra-${i}`,
    title: e.title,
    author: e.author,
    status: i === reading ? 'reading' : 'read',
    pageCount: e.pageCount,
    currentPage: i === reading ? 60 : e.pageCount,
    cover: `https://covers.openlibrary.org/b/isbn/${e.isbn}-L.jpg`,
    editionType: e.editionType,
    spineColor: COLORS[i % COLORS.length],
    addedAt: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(),
    updatedAt: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(),
    finishedAt: i === reading ? null : new Date(Date.UTC(2025, 1, 1 + i)).toISOString(),
    source: 'muestra',
    quotes: [],
  })),
  settings: { sound: false, viewMode: 'cover', owner: 'Prueba', currentBookId: `muestra-${reading}` },
});

test.beforeEach(async ({}, info) => {
  test.skip(!/(chromium|webkit)-390x844$/.test(info.project.name), 'móvil vertical');
  mkdirSync(OUT, { recursive: true });
  const online = await fetch(`https://covers.openlibrary.org/b/isbn/${FIVE[0].isbn}-M.jpg?default=false`).then((r) => r.ok, () => false);
  test.skip(!online, 'sin acceso a Open Library');
});

const engine = () => test.info().project.name.split('-')[0];
const shot = (page, name) => page.screenshot({ path: `${OUT}/${engine()}-${name}.png` });
const debug = (page) => page.evaluate(() => window.__pisoLab().debug());
const still = (page, ms = 700) => page.waitForTimeout(ms);

async function enterWith(page, state) {
  await page.addInitScript((seed) => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!sessionStorage.getItem('muestra')) {
      localStorage.setItem('bookshelf:v1', JSON.stringify(seed));
      sessionStorage.setItem('muestra', '1');
    }
  }, state);
  await page.goto('/?piloto=piso');
  await page.getByRole('button', { name: MINE }).click();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().windows.length > 0, null, { timeout: 30000 });
  await page.evaluate(() => window.__pisoLab().setHora('tarde'));
}

/** Todas las portadas de la balda puestas (las que se pueden leer), y tu lectura con la suya. */
const facesIn = (page, min) => page.waitForFunction((n) => {
  const s = window.__pisoLab().debug().shelf;
  return s.coverReal && s.faces >= n;
}, min, { timeout: 45000 });

/** Acerca una balda como lo haría una persona: desde el sillón, mirando hacia la estantería y tocándola. */
async function openRow(page, row) {
  if ((await debug(page)).zoomed) {
    await page.goBack();
    await page.waitForFunction(() => !window.__pisoLab().debug().zoomed, null, { timeout: 5000 });
  }
  await expect(page.locator('.plab-spot')).toHaveCount(0);
  await page.evaluate(() => window.__pisoLab().lookTo(-0.42));
  await still(page, 400);
  const at = await page.evaluate((r) => window.__pisoLab().screenOf(`balda:${r}`), row);
  await page.mouse.click(at.x, at.y);
  await page.waitForFunction((r) => window.__pisoLab().debug().view.row === r, row, { timeout: 5000 });
  await expect(page.locator('.plab-spot')).not.toHaveCount(0);
  await still(page, 900);
}

/** Elige cada ejemplar de la balda abierta con un toque en el centro de su sitio y espera a que salga y gire. */
async function pickEach(page, name) {
  const spots = page.locator('.plab-spot');
  const n = await spots.count();
  const picked = [];
  for (let k = 0; k < n; k += 1) {
    const box = await spots.nth(k).boundingBox();
    const label = await spots.nth(k).getAttribute('aria-label');
    // Lo que hay de verdad bajo el dedo: el mismo ejemplar, no un vecino que lo tape
    const under = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.getAttribute('aria-label'), [box.x + box.width / 2, box.y + box.height / 2]);
    expect(under, `tocar el centro de «${label}»`).toBe(label);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('.plab-pick')).toBeVisible();
    const title = await page.locator('.plab-pick strong').textContent();
    await page.waitForFunction(() => window.__pisoLab().debug().shelf.shown.length === 1, null, { timeout: 5000 });
    await still(page, 900);
    picked.push({ label, title, width: Math.round(box.width) });
    if (name) await shot(page, name(title));
  }
  return picked;
}

test('muestra: cinco ediciones en la balda, de cerca y elegidas, frente al libro de la mesa', async ({ page }) => {
  test.setTimeout(150000);
  await enterWith(page, libraryOf(FIVE, 0));
  await facesIn(page, 5);
  const view = await debug(page);
  expect(view.shelf.books).toHaveLength(5);
  // Ninguna de estas ediciones trae imagen de su lomo: todos los lomos son reconstruidos
  expect(view.shelf.spines).toBe(0);
  await still(page);
  await shot(page, '1-habitacion');
  const frames = {};
  for (const row of [2, 1, 0]) {
    if (!view.shelf.rows[row]) continue;
    await openRow(page, row);
    frames[row] = (await debug(page)).view;
    await shot(page, `2-balda-${row}`);
    await pickEach(page, (title) => `3-elegido-${FIVE.findIndex((e) => e.title === title)}`);
  }
  console.log(`ENCUADRE ${engine()} ${JSON.stringify(frames)}`);
});

for (const [k, e] of FIVE.entries()) {
  test(`mesa: ${e.title}, la misma edición como libro de la mesa`, async ({ page }) => {
    await enterWith(page, libraryOf(FIVE, k));
    await page.waitForFunction(() => window.__pisoLab().debug().book?.coverReal, null, { timeout: 30000 });
    await page.evaluate(() => window.__pisoLab().leanToBook(true));
    await still(page, 1200);
    await shot(page, `4-mesa-${k}`);
  });
}

test('muestra grande: veintiocho ediciones caben, no se atraviesan al salir y girar, y todas se eligen con un toque', async ({ page }) => {
  test.setTimeout(240000);
  const all = [...FIVE, ...MORE];
  await enterWith(page, libraryOf(all, 0));
  const first = await debug(page);
  const shown = first.shelf.books.length;
  expect(shown).toBeGreaterThanOrEqual(20);
  expect(shown).toBeLessThanOrEqual(30);
  await facesIn(page, shown - 2);
  // Ningún cruce: ni en reposo ni en ninguna postura de la salida y el giro de cada uno
  const crossings = await page.evaluate(() => window.__pisoLab().sweep(32));
  expect(crossings).toEqual([]);
  await still(page);
  await shot(page, 'g1-habitacion');
  const widths = [];
  for (const row of [2, 1, 0]) {
    if (!first.shelf.rows[row]) continue;
    await openRow(page, row);
    await shot(page, `g2-balda-${row}`);
    const picked = await pickEach(page, null);
    expect(picked).toHaveLength(first.shelf.rows[row]);
    widths.push(...picked.map((p) => p.width));
    await shot(page, `g3-elegido-${row}`);
  }
  console.log(`GRANDE ${engine()} libros=${shown} filas=${first.shelf.rows} anchos=${Math.min(...widths)}-${Math.max(...widths)}px`);
  expect(Math.min(...widths)).toBeGreaterThanOrEqual(14);
});
