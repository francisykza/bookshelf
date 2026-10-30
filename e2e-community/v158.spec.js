// QA de la 1.58.0 (SPEC §56): visita a un rincón compartido contra el simulador de Supabase. Dos lectores seguidos
// (Bruno con rincón y colecciones, Carla con otros libros) y Dani, que ha bloqueado a Ana. Lo privado no aparece; nada
// se pide del vídeo hasta tocar la ventana; Atrás cierra libro → habitación → casa → «Lectores»; recargar la habitación
// no repite la entrada; añadir a pendientes una sola vez; spoilers plegados; respuestas tardías de otra persona nunca se
// ven. Sin datos personales. WebKit de Playwright decodifica el MP4 (entrada real); el Chromium de Playwright no
// tiene H.264 y valida la entrada estática con su aviso. Nada de esto equivale a un iPhone real.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SUPABASE, createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222', email: 'bruno@ejemplo.test' };
const CARLA = { id: '33333333-3333-4333-8333-333333333333', email: 'carla@ejemplo.test' };
const DANI = { id: '44444444-4444-4444-8444-444444444444', email: 'dani@ejemplo.test' };
const WORK = { id: '55555555-5555-4555-8555-555555555555', kind: 'local', title: 'Circe', author: 'Madeline Miller' };
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
    { user_id: DANI.id, alias: 'Dani', avatar_id: 'lector-farol', community_enabled: true },
  );
  mock.db.follows.push({ follower: ANA.id, followed: BRUNO.id }, { follower: ANA.id, followed: CARLA.id }, { follower: ANA.id, followed: DANI.id });
  mock.db.blocks.push({ blocker: DANI.id, blocked: ANA.id });
  mock.db.public_reviews.push({ id: '70000000-0000-4000-8000-000000000001', work_id: WORK.id, user_id: BRUNO.id, rating_quarters: 16, body: 'El final cambia todo lo anterior.', has_spoilers: true, status: 'published', published_at: new Date().toISOString() });
  mock.db.corners.push(
    {
      user_id: BRUNO.id,
      visible: true,
      featured_books: [ref('b1', 'Cuarta ala', 'Rebecca Yarros'), ref('b2', 'El principito', 'Antoine de Saint-Exupéry'), ref('b3', 'Una vida pequeña', 'Hanya Yanagihara')],
      figure_ids: [],
      guardian_id: null,
      show_current: true,
      current_title: 'Alas de hierro',
      scene: 'lluvia',
      signature_books: [ref('b5', 'La sombra del viento', 'Carlos Ruiz Zafón', { phrase: 'El libro que me hizo lector' })],
      last_book: null,
      next_book: null,
      memories: [],
    },
    { user_id: CARLA.id, visible: true, featured_books: [ref('b1', 'Momo', 'Michael Ende')], figure_ids: [], guardian_id: null, show_current: false, current_title: 'No debería verse', signature_books: [], memories: [], last_book: null, next_book: null },
    { user_id: DANI.id, visible: true, featured_books: [ref('d1', 'Libro de Dani', 'Autora')], figure_ids: [], guardian_id: null, show_current: false, current_title: null },
  );
  mock.db.collections.push(
    { id: '80000000-0000-4000-8000-000000000001', owner: BRUNO.id, title: 'Días de lluvia', dedication: null, visible: true, books: [ref('c1', 'Rebeca', 'Daphne du Maurier')] },
    { id: '80000000-0000-4000-8000-000000000002', owner: BRUNO.id, title: 'Solo para mí', dedication: null, visible: false, books: [ref('c9', 'Diario secreto', 'Bruno')] },
  );
  // La biblioteca sincronizada de Bruno existe en el servidor, pero nunca debe pedirse ni verse
  mock.db.libraries.push({ user_id: BRUNO.id, data: { books: [{ id: 'p1', title: 'Biblioteca privada de Bruno' }] }, updated_at: new Date().toISOString() });
  return mock;
}

/** Abre la app con «Comunidad → Lectores» ya delante (el estado del navegador de la app, como al volver). */
async function openReaders(page, mock, { reduced = false } = {}) {
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await mock.attach(page, ANA);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('v158-nav')) return;
    sessionStorage.setItem('v158-nav', '1');
    history.replaceState({ bookshelf: { loc: { view: 'room', panel: { type: 'social', tab: 'lectores' } }, depth: 0, parent: null } }, '');
  });
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Lectores que sigo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Visitar el rincón de Bruno' })).toBeVisible();
}

const videoRequests = (log) => log.filter((u) => u.includes('/media/social-visit/entrada-v1.mp4'));

test('visita: casa, entrada, habitación con lo compartido, libro, pendientes y vuelta paso a paso', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390 en Chromium y WebKit');
  const mock = seed();
  const log = [];
  page.on('request', (r) => log.push(r.url()));
  await openReaders(page, mock);
  // Dani (que bloquea a Ana) no ofrece visita; nada del vídeo se ha pedido al abrir la app
  await expect(page.getByRole('button', { name: /Visitar el rincón de Dani/ })).toHaveCount(0);
  expect(videoRequests(log)).toEqual([]);
  await page.getByRole('button', { name: 'Visitar el rincón de Bruno' }).click();
  const visit = page.getByRole('dialog', { name: 'Visita al rincón de Bruno' });
  await expect(visit).toBeVisible();
  await expect(visit.locator('.reader-visit__who')).toContainText('Bruno');
  const win = visit.getByRole('button', { name: 'Entrar por la ventana en el rincón de Bruno' });
  await expect(win).toBeEnabled();
  await page.waitForTimeout(400);
  expect(videoRequests(log)).toEqual([]);
  expect(await visit.locator('video').count()).toBe(0);
  await shot(page, info, 'v158-casa');
  // Tocar la ventana (dos veces seguidas: una sola entrada)
  await win.dblclick({ force: true }).catch(() => {});
  if (info.project.name.startsWith('webkit')) {
    // WebKit decodifica el MP4: hay un fotograma visible antes de llegar
    await expect(visit.locator('video[data-shown]')).toHaveCount(1, { timeout: 8000 });
    await shot(page, info, 'v158-entrando');
  }
  await expect(visit.getByRole('button', { name: /Libros compartidos por Bruno/ })).toBeVisible({ timeout: 15000 });
  // Chromium informa de la petición del vídeo; WebKit la hace desde su motor multimedia sin exponerla a Playwright (allí
  // la prueba es el fotograma visible de arriba)
  if (!info.project.name.startsWith('webkit')) expect(videoRequests(log).length).toBeGreaterThan(0);
  expect(await page.evaluate(() => history.state.bookshelf.loc.panel)).toEqual({ type: 'visit', id: '22222222-2222-4222-8222-222222222222', section: 'habitacion' });
  // Habitación: tres lomos destacados, lo que lee (solo el título) y nada privado
  await expect(visit.locator('.reader-visit__spines > g')).toHaveCount(3);
  await expect(visit).toContainText('Está leyendo «Alas de hierro»');
  await expect(visit.locator('.reader-visit__shelf')).toContainText('Libros · 5');
  await page.waitForTimeout(400);
  await shot(page, info, 'v158-habitacion');
  // Libros compartidos (tres por fila) → un libro → añadir a pendientes una sola vez
  await visit.getByRole('button', { name: /Libros compartidos por Bruno/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Libros compartidos por Bruno' });
  await expect(sheet).toContainText('no es su biblioteca completa');
  await expect(sheet.locator('.reader-visit__book')).toHaveCount(5);
  await expect(sheet).not.toContainText('Diario secreto');
  await expect(sheet).not.toContainText('Biblioteca privada');
  // Reseña con spoilers: plegada
  await expect(sheet.locator('.review-card')).toContainText('Contiene spoilers');
  await expect(sheet.locator('.review-card')).not.toContainText('El final cambia');
  await shot(page, info, 'v158-libros');
  await sheet.getByRole('button', { name: /Rebeca/ }).click();
  const book = page.getByRole('dialog', { name: 'Rebeca' });
  await expect(book).toContainText('En su colección «Días de lluvia»');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.length);
  // Un toque; después el botón deja de existir (no se puede añadir dos veces)
  await book.getByRole('button', { name: 'Añadir a pendientes' }).click();
  await expect(book.getByRole('button', { name: 'Añadir a pendientes' })).toHaveCount(0);
  await expect(book.getByText('Añadido a Pendientes')).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.filter((b) => b.title === 'Rebeca' && b.source === 'community').length)).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.length)).toBe(before + 1);
  // Ninguna ficha propia se abrió por error
  await expect(page.locator('.book-sheet')).toHaveCount(0);
  // Atrás: libro → libros → habitación → casa → «Lectores»
  await page.goBack();
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(visit.getByRole('button', { name: 'Volver a la casa' })).toBeVisible();
  await page.goBack();
  await expect(visit.getByRole('button', { name: 'Entrar por la ventana en el rincón de Bruno' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('region', { name: 'Lectores que sigo' })).toBeVisible();
  // Ni una petición a la biblioteca sincronizada de otra persona
  expect(log.filter((u) => u.includes('/rest/v1/libraries') && u.includes(BRUNO.id))).toEqual([]);
});

test('recargar en la habitación no repite la entrada; «Ver perfil» y vuelta; saltar el vídeo', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390 en Chromium y WebKit');
  const mock = seed();
  const log = [];
  page.on('request', (r) => log.push(r.url()));
  await openReaders(page, mock);
  await page.getByRole('button', { name: 'Visitar el rincón de Bruno' }).click();
  const visit = page.getByRole('dialog', { name: 'Visita al rincón de Bruno' });
  await visit.getByRole('button', { name: 'Entrar por la ventana en el rincón de Bruno' }).click();
  // «Saltar» siempre disponible mientras se prepara o reproduce
  const skip = visit.getByRole('button', { name: 'Saltar' });
  if (await skip.isVisible().catch(() => false)) await skip.click({ timeout: 2000 }).catch(() => {});
  await expect(visit.getByRole('button', { name: /Libros compartidos por Bruno/ })).toBeVisible({ timeout: 15000 });
  // Recargar: la habitación vuelve sin vídeo
  log.length = 0;
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Visita al rincón de Bruno' }).getByRole('button', { name: /Libros compartidos por Bruno/ })).toBeVisible();
  await page.waitForTimeout(500);
  expect(videoRequests(log)).toEqual([]);
  expect(await page.locator('.reader-visit video').count()).toBe(0);
  // Ver perfil (la vista de siempre) y volver a la habitación
  await page.getByRole('button', { name: 'Ver el perfil de Bruno' }).click();
  await expect(page.locator('.reader-profile')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Visita al rincón de Bruno' }).getByRole('button', { name: /Libros compartidos por Bruno/ })).toBeVisible();
});

test('otra persona mientras carga: nunca se ven los libros de la anterior; bloqueado y lectura actual oculta', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390 en Chromium y WebKit');
  const mock = seed();
  await openReaders(page, mock);
  // El rincón de Bruno tarda en llegar
  await page.route(`${SUPABASE}/rest/v1/corners*`, async (route) => {
    if (route.request().url().includes(BRUNO.id)) await new Promise((r) => setTimeout(r, 1500));
    await route.fallback();
  });
  await page.getByRole('button', { name: 'Visitar el rincón de Bruno' }).click();
  await page.goBack();
  await page.getByRole('button', { name: 'Visitar el rincón de Carla' }).click();
  const visit = page.getByRole('dialog', { name: 'Visita al rincón de Carla' });
  await visit.getByRole('button', { name: 'Entrar sin animación' }).click();
  await expect(visit.getByRole('button', { name: /Libros compartidos por Carla \(1\)/ })).toBeVisible();
  await page.waitForTimeout(1800);
  await visit.getByRole('button', { name: /Libros compartidos por Carla/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Libros compartidos por Carla' });
  await expect(sheet.locator('.reader-visit__book')).toHaveCount(1);
  await expect(sheet).toContainText('Momo');
  await expect(sheet).not.toContainText('Cuarta ala');
  // Carla no enseña su lectura actual: no aparece
  await expect(page.locator('.reader-visit')).not.toContainText('No debería verse');
  // Dani bloquea a Ana: su visita (abierta a mano) dice que no está disponible y no enseña nada suyo
  await page.evaluate((id) => {
    history.pushState({ bookshelf: { loc: { view: 'room', panel: { type: 'visit', id } }, depth: 5, parent: { view: 'room', panel: { type: 'social', tab: 'lectores' } } } }, '');
    dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
  }, DANI.id);
  await expect(page.locator('.reader-visit')).toContainText('Este rincón no está disponible');
  await expect(page.locator('.reader-visit')).not.toContainText('Libro de Dani');
});

test('movimiento reducido y preferencia: se entra sin vídeo; encuadre 9:16 contenido en 360, 430 y escritorio', async ({ page }, info) => {
  test.skip(!/390x844$/.test(info.project.name) || info.project.name.startsWith('webkit'), 'una vez, en Chromium');
  const mock = seed();
  const log = [];
  page.on('request', (r) => log.push(r.url()));
  await openReaders(page, mock, { reduced: true });
  await page.getByRole('button', { name: 'Visitar el rincón de Bruno' }).click();
  const visit = page.getByRole('dialog', { name: 'Visita al rincón de Bruno' });
  await visit.getByRole('button', { name: 'Entrar por la ventana en el rincón de Bruno' }).click();
  await expect(visit.getByRole('button', { name: /Libros compartidos por Bruno/ })).toBeVisible();
  expect(videoRequests(log)).toEqual([]);
  // Los lomos aparecen sin transición con movimiento reducido
  // (la regla global de movimiento reducido deja 0,000001 s: en la práctica, inmediato)
  expect(parseFloat(await visit.locator('.reader-visit__spines').evaluate((el) => getComputedStyle(el).transitionDuration))).toBeLessThan(0.01);
  for (const [w, h] of [
    [360, 800],
    [430, 932],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(300);
    const r = await visit.locator('.reader-visit__frame').boundingBox();
    // Proporción 9:16 exacta, entera dentro de la pantalla y centrada
    expect(Math.abs(r.width / r.height - 9 / 16)).toBeLessThan(0.01);
    expect(r.x).toBeGreaterThanOrEqual(-1);
    expect(r.y).toBeGreaterThanOrEqual(-1);
    expect(r.x + r.width).toBeLessThanOrEqual(w + 1);
    expect(r.y + r.height).toBeLessThanOrEqual(h + 1);
    expect(Math.abs(r.x + r.width / 2 - w / 2)).toBeLessThan(2);
    // La balda tocable queda dentro del marco (anclada a la imagen, no a la pantalla)
    const s = await visit.locator('.reader-visit__shelf').boundingBox();
    expect(s.x).toBeGreaterThanOrEqual(r.x - 1);
    expect(s.x + s.width).toBeLessThanOrEqual(r.x + r.width * 0.24);
    await shot(page, info, `v158-encuadre-${w}`);
  }
});
