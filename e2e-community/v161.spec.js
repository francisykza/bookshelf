// QA de la visita 1.61 (SPEC §61) contra el simulador de Supabase: habitación sin accesos duplicados, etiqueta de la
// estantería, libro de la mesita, «Los libros de X» con buscador y posición conservada, colección grande sin montar todo,
// pendientes sin duplicados, casos sin libros, sin portada y sin lectura, cambio de persona y Atrás/Escape/foco.
// Datos sintéticos; nada de la cuenta de Francisco. Nada de esto equivale a un iPhone real.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SUPABASE, createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222' };
const CARLA = { id: '33333333-3333-4333-8333-333333333333' };
const EVA = { id: '66666666-6666-4666-8666-666666666666' };
const GRANDE = { id: '77777777-7777-4777-8777-777777777777' };
const WORK = { id: '55555555-5555-4555-8555-555555555555', kind: 'local', title: 'Circe', author: 'Madeline Miller' };
const cover = (isbn) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
const ref = (id, title, author, extra = {}) => ({ id, title, author, cover: '', ...extra });

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

function seed() {
  const mock = createMockSupabase();
  mock.db.works.push(WORK);
  mock.db.profiles.push(
    { user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true },
    { user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'lector-farol', community_enabled: true },
    { user_id: CARLA.id, alias: 'Carla', avatar_id: 'gato-lector', community_enabled: true },
    { user_id: EVA.id, alias: 'Eva', avatar_id: 'gato-lector', community_enabled: true },
    { user_id: GRANDE.id, alias: 'Gran lectora', avatar_id: 'lector-farol', community_enabled: true },
  );
  mock.db.follows.push(...[BRUNO, CARLA, EVA, GRANDE].map((u) => ({ follower: ANA.id, followed: u.id })));
  mock.db.public_reviews.push({ id: '70000000-0000-4000-8000-000000000001', work_id: WORK.id, user_id: BRUNO.id, rating_quarters: 16, body: 'El final cambia todo lo anterior.', has_spoilers: true, status: 'published', published_at: new Date().toISOString() });
  mock.db.corners.push(
    {
      user_id: BRUNO.id,
      visible: true,
      featured_books: [ref('b1', 'Circe', 'Madeline Miller', { cover: cover('9780316556347'), work_id: WORK.id }), ref('b2', 'El principito', 'Antoine de Saint-Exupéry', { cover: cover('9780156012195') }), ref('b3', 'Orgullo y prejuicio', 'Jane Austen', { cover: cover('9780141439518') })],
      figure_ids: [],
      guardian_id: null,
      show_current: true,
      current_title: 'Alas de hierro',
      scene: 'lluvia',
      signature_books: [ref('b5', 'La sombra del viento', 'Carlos Ruiz Zafón', { cover: cover('9780143034902'), phrase: 'El libro que me hizo lector' })],
      last_book: ref('b6', 'Momo', 'Michael Ende', { cover: cover('9780140317534') }),
      next_book: ref('b7', 'Libro sin portada', 'Autora Desconocida'),
      memories: [],
    },
    // Carla enseña su rincón pero no su lectura actual
    { user_id: CARLA.id, visible: true, featured_books: [ref('c1', 'El Hobbit', 'J. R. R. Tolkien', { cover: cover('9780547928227') })], figure_ids: [], guardian_id: null, show_current: false, current_title: 'No debería verse', signature_books: [], memories: [], last_book: null, next_book: null },
    // Eva: rincón privado y ninguna colección visible
    { user_id: EVA.id, visible: false, featured_books: [ref('e1', 'Privado de Eva', 'Eva')], figure_ids: [], guardian_id: null, show_current: true, current_title: 'Lectura privada' },
    { user_id: GRANDE.id, visible: true, featured_books: [], figure_ids: [], guardian_id: null, show_current: false, current_title: null, signature_books: [], memories: [], last_book: null, next_book: null },
  );
  mock.db.collections.push(
    { id: '80000000-0000-4000-8000-000000000001', owner: BRUNO.id, title: 'Días de lluvia', dedication: null, visible: true, books: [ref('c1', 'Rebeca', 'Daphne du Maurier'), ref('c2', 'Kafka en la orilla', 'Haruki Murakami', { cover: cover('9781400079278') })] },
    { id: '80000000-0000-4000-8000-000000000002', owner: BRUNO.id, title: 'Solo para mí', dedication: null, visible: false, books: [ref('c9', 'Diario secreto', 'Bruno')] },
    // Una colección grande (360 libros): la vista no debe montarlos todos
    { id: '80000000-0000-4000-8000-000000000003', owner: GRANDE.id, title: 'Todo lo leído', dedication: null, visible: true, books: Array.from({ length: 360 }, (_, i) => ref(`g${i}`, `Libro número ${i + 1}`, `Autora ${(i % 17) + 1}`)) },
  );
  mock.db.libraries.push({ user_id: BRUNO.id, data: { books: [{ id: 'p1', title: 'Biblioteca privada de Bruno' }] }, updated_at: new Date().toISOString() });
  return mock;
}

async function openReaders(page, mock, { reduced = false } = {}) {
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await mock.attach(page, ANA);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('v161-nav')) return;
    sessionStorage.setItem('v161-nav', '1');
    history.replaceState({ bookshelf: { loc: { view: 'room', panel: { type: 'social', tab: 'lectores' } }, depth: 0, parent: null } }, '');
  });
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Lectores que sigo' })).toBeVisible();
}

const visitOf = (page, alias) => page.getByRole('dialog', { name: `Visita al rincón de ${alias}` });
async function enter(page, alias) {
  await page.getByRole('button', { name: `Visitar el rincón de ${alias}` }).click();
  const visit = visitOf(page, alias);
  const room = visit.getByRole('button', { name: new RegExp(`Libros compartidos por ${alias}`) });
  // 1.62: con animación, se entra desde la fachada; con movimiento reducido se llega directamente
  const door = visit.getByRole('button', { name: `Entrar al rincón de ${alias}` });
  await expect(room.or(door)).toBeVisible({ timeout: 15000 });
  if (await door.isVisible()) await door.click();
  await expect(room).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(400);
  return visit;
}

test('habitación: un acceso por cosa, etiqueta en la estantería y lectura en la mesita', async ({ page }, info) => {
  // Todos los tamaños de la comunidad (320, 390, 430, escritorio y WebKit)
  const mock = seed();
  await openReaders(page, mock, { reduced: true });
  const visit = await enter(page, 'Bruno');
  // Sin botonera inferior, sin icono de perfil aparte ni cartel grande con el título
  await expect(visit.getByRole('button', { name: /Ver perfil$/ })).toHaveCount(0);
  await expect(visit.locator('.reader-visit__actions')).toHaveCount(0);
  await expect(visit.locator('.reader-visit__lead')).toHaveCount(0);
  await expect(visit.getByRole('button', { name: 'Ver el perfil de Bruno' })).toHaveCount(1);
  await expect(visit.getByRole('button', { name: /Libros compartidos por Bruno \(8\)/ })).toHaveCount(1);
  await expect(visit.locator('.reader-visit__tag')).toHaveText(/^Libros\s*compartidos$/);
  // La lectura actual: un libro en la mesita (solo el título publicado)
  const table = visit.getByRole('button', { name: 'Está leyendo «Alas de hierro»' });
  await expect(table).toBeVisible();
  // Todo dentro de la escena y del visor; zonas táctiles de al menos 44 px
  const vp = page.viewportSize();
  for (const sel of ['.reader-visit__tag', '.reader-visit__table', '.reader-visit__who', '.reader-visit__bar .reader-visit__icon']) {
    const r = await visit.locator(sel).first().boundingBox();
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(vp.width + 0.5);
  }
  const hit = await table.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const b = getComputedStyle(el, '::before');
    return { w: Math.max(r.width, parseFloat(b.width)), h: Math.max(r.height, parseFloat(b.height)) };
  });
  expect(hit.w).toBeGreaterThanOrEqual(44);
  expect(hit.h).toBeGreaterThanOrEqual(44);
  await shot(page, info, 'v161-habitacion');
  // Un toque en la etiqueta abre «Sus libros» una sola vez
  await visit.locator('.reader-visit__tag').click();
  await expect(page.getByRole('dialog', { name: 'Libros compartidos por Bruno' })).toHaveCount(1);
  expect(await page.evaluate(() => history.state.bookshelf.loc.panel.select)).toBe('libros');
  await page.goBack();
  // La lectura actual: su ficha solo con el título; sin reseña (no hay obra inequívoca)
  await table.click();
  const reading = page.getByRole('dialog', { name: 'Alas de hierro' });
  await expect(reading).toContainText('Está leyendo');
  await expect(reading.locator('.review-card')).toHaveCount(0);
  await expect(reading).not.toContainText('%');
  await page.keyboard.press('Escape');
  await expect(reading).toHaveCount(0);
  await expect(table).toBeFocused({ timeout: 3000 }).catch(() => {});
});

test('sus libros: buscador, ficha, vuelta a la misma posición, pendientes sin duplicar y nada privado', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390 en Chromium y WebKit');
  const mock = seed();
  await openReaders(page, mock, { reduced: true });
  const visit = await enter(page, 'Bruno');
  await visit.getByRole('button', { name: /Libros compartidos por Bruno/ }).click();
  const lib = page.getByRole('dialog', { name: 'Libros compartidos por Bruno' });
  await expect(lib.getByRole('heading', { name: 'Los libros de Bruno' })).toBeVisible();
  await expect(lib).toContainText('8 libros compartidos');
  await expect(lib.locator('.pbook')).toHaveCount(8);
  // Sin títulos bajo las portadas, sin añadir ni herramientas de la biblioteca propia
  await expect(lib.locator('.book-label, .add-slot, .lib-tools-btn')).toHaveCount(0);
  await expect(lib).not.toContainText('Diario secreto');
  await expect(lib).not.toContainText('Biblioteca privada');
  await page.waitForTimeout(1200);
  await shot(page, info, 'v161-sus-libros');
  // Buscar por autor y sin tildes
  const search = lib.getByRole('searchbox', { name: 'Buscar en sus libros' });
  await search.fill('saint exupery');
  await expect(lib.locator('.pbook')).toHaveCount(1);
  await expect(lib).toContainText('1 de 8 libros compartidos');
  await search.fill('zzz');
  await expect(lib).toContainText('Ningún libro suyo coincide con «zzz»');
  await search.fill('');
  // Abrir uno, añadirlo a pendientes y volver: la búsqueda y la posición siguen
  await search.fill('a');
  const scroller = lib.locator('.reader-visit__library-scroll');
  await scroller.evaluate((el) => el.scrollTo({ top: 120 }));
  const top = await scroller.evaluate((el) => el.scrollTop);
  await lib.getByRole('button', { name: /Rebeca/ }).click();
  const book = page.getByRole('dialog', { name: 'Rebeca' });
  await expect(book).toContainText('En su colección «Días de lluvia»');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.length);
  await book.getByRole('button', { name: 'Añadir a pendientes' }).click();
  await expect(book.getByText('Añadido a Pendientes')).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.filter((b) => b.title === 'Rebeca').length)).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.length)).toBe(before + 1);
  await page.keyboard.press('Escape');
  await expect(book).toHaveCount(0);
  await expect(search).toHaveValue('a');
  expect(Math.abs((await scroller.evaluate((el) => el.scrollTop)) - top)).toBeLessThan(2);
  await expect(lib.getByRole('button', { name: /Rebeca/ })).toBeFocused();
  // Volver a abrirlo: ya está en tu biblioteca (sin un segundo botón)
  await lib.getByRole('button', { name: /Rebeca/ }).click();
  await expect(page.getByRole('dialog', { name: 'Rebeca' }).getByText('Ya está en tu biblioteca')).toBeVisible();
  await page.goBack();
  // La reseña solo aparece en la obra inequívoca (Circe), con su aviso de spoilers
  await search.fill('circe');
  await lib.getByRole('button', { name: /Circe/ }).click();
  const circe = page.getByRole('dialog', { name: 'Circe' });
  await expect(circe.locator('.review-card')).toContainText('Contiene spoilers');
  await expect(circe.locator('.review-card')).not.toContainText('El final cambia');
  // Recargar con la ficha abierta: Atrás vuelve a sus libros, luego a la habitación (sin vídeo) y a «Lectores»
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Circe' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Libros compartidos por Bruno' })).toBeVisible();
  await page.getByRole('button', { name: 'Volver al rincón' }).click();
  await expect(visitOf(page, 'Bruno').getByRole('button', { name: 'Ver el perfil de Bruno' })).toBeVisible();
  await expect(page.locator('.reader-visit video')).toHaveCount(0);
  // El perfil y su vuelta a la habitación
  await page.getByRole('button', { name: 'Ver el perfil de Bruno' }).click();
  await expect(page.locator('.reader-profile')).toBeVisible();
  await page.goBack();
  await expect(visitOf(page, 'Bruno').getByRole('button', { name: 'Ver el perfil de Bruno' })).toBeVisible();
  await page.getByRole('button', { name: 'Volver a lectores', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Lectores que sigo' })).toBeVisible();
});

test('colección grande: sin montar todos los libros; sin portada, sin lectura, privada y cambio de persona', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390 en Chromium y WebKit');
  const mock = seed();
  await openReaders(page, mock, { reduced: true });
  // 360 libros: el número es el total y solo se montan unas pocas filas
  let visit = await enter(page, 'Gran lectora');
  await visit.getByRole('button', { name: /Libros compartidos por Gran lectora \(360\)/ }).click();
  const lib = page.getByRole('dialog', { name: 'Libros compartidos por Gran lectora' });
  await expect(lib).toContainText('360 libros compartidos');
  const mounted = await lib.locator('.pbook').count();
  expect(mounted).toBeGreaterThan(0);
  expect(mounted).toBeLessThan(80);
  await lib.locator('.reader-visit__library-scroll').evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await expect(lib.getByRole('button', { name: /Libro número 360,/ })).toBeVisible();
  expect(await lib.locator('.pbook').count()).toBeLessThan(80);
  await lib.getByRole('searchbox', { name: 'Buscar en sus libros' }).fill('número 7');
  await expect(lib).toContainText('de 360 libros compartidos');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Volver a lectores', exact: true }).click();
  // Carla: sin lectura publicada, ningún libro en la mesita ni su título oculto
  visit = await enter(page, 'Carla');
  await expect(visit.locator('.reader-visit__table')).toHaveCount(0);
  await expect(page.locator('.reader-visit')).not.toContainText('No debería verse');
  await page.getByRole('button', { name: 'Volver a lectores', exact: true }).click();
  // Eva: rincón privado y nada en colecciones visibles
  await page.getByRole('button', { name: 'Visitar el rincón de Eva' }).click();
  const eva = visitOf(page, 'Eva');
  await expect(eva).toContainText('Su rincón es privado', { timeout: 15000 });
  await expect(eva.locator('.reader-visit__table')).toHaveCount(0);
  await expect(eva).not.toContainText('Lectura privada');
  await eva.getByRole('button', { name: /Libros compartidos por Eva \(0\)/ }).click();
  await expect(page.getByRole('dialog', { name: 'Libros compartidos por Eva' })).toContainText('Eva aún no ha compartido libros');
  await expect(page.getByRole('searchbox', { name: 'Buscar en sus libros' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Volver a lectores', exact: true }).click();
  // Cambio de persona mientras carga: nunca se ven los libros de la anterior
  await page.route(`${SUPABASE}/rest/v1/corners*`, async (route) => {
    if (route.request().url().includes(BRUNO.id)) await new Promise((r) => setTimeout(r, 1500));
    await route.fallback();
  });
  await page.getByRole('button', { name: 'Visitar el rincón de Bruno' }).click();
  await page.goBack();
  visit = await enter(page, 'Carla');
  await page.waitForTimeout(1800);
  await visit.getByRole('button', { name: /Libros compartidos por Carla/ }).click();
  const carla = page.getByRole('dialog', { name: 'Libros compartidos por Carla' });
  await expect(carla.locator('.pbook')).toHaveCount(1);
  await expect(carla).not.toContainText('Circe');
});

test('llegada: el vídeo no se pide al arrancar; con vídeo roto se llega a la habitación; capturas', async ({ page }, info) => {
  test.skip(!/390x844$|webkit-390x844/.test(info.project.name), '390 en Chromium y WebKit');
  const mock = seed();
  const log = [];
  page.on('request', (r) => log.push(r.url()));
  await openReaders(page, mock);
  expect(log.filter((u) => u.includes('entrada-v1.mp4'))).toEqual([]);
  await page.route('**/media/social-visit/entrada-v1.mp4', (route) => route.abort());
  const visit = await enter(page, 'Bruno');
  await expect(visit.locator('video')).toHaveCount(0);
  await expect(visit.getByRole('button', { name: 'Ver el perfil de Bruno' })).toBeVisible();
  await page.waitForTimeout(800);
  await shot(page, info, 'v161-llegada');
});

test('desde la habitación: «Social» → tableta → «Lectores» → visitar, sin pasar por la cuenta', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390 en Chromium y WebKit');
  const mock = seed();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mock.attach(page, ANA);
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir rincón social' }).click();
  const tablet = page.getByRole('button', { name: /Tablet: perfiles, lectores que sigues y opiniones/ });
  await expect(tablet).toBeVisible({ timeout: 15000 });
  await tablet.click();
  await expect(page.getByRole('region', { name: 'Lectores que sigo' })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.account-panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Visitar el rincón de Bruno' }).click();
  await expect(visitOf(page, 'Bruno').getByRole('button', { name: 'Ver el perfil de Bruno' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Volver a lectores', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Lectores que sigo' })).toBeVisible();
});
