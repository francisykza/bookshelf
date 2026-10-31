// QA de la visita a un rincón compartido (SPEC §56; revisada en la 1.58.1 tras la auditoría del vídeo) contra el
// simulador de Supabase. Lectores seguidos: Bruno (rincón y colecciones), Carla (un libro), Eva (rincón visible sin
// libros) y Dani, que ha bloqueado a Ana. La entrada empieza sola al abrir la visita, sin opciones de animación ni
// «Saltar»; la escena llega a los bordes; Atrás cierra libro → libros → habitación → «Lectores»; recargar la habitación
// no repite la entrada; el vídeo que falla lleva a la habitación; lo privado no aparece. Sin datos personales.
// WebKit de Playwright decodifica el MP4 (entrada real); el Chromium de Playwright no tiene H.264 y valida el camino de
// fallo. Nada de esto equivale a un iPhone real.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SUPABASE, createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222', email: 'bruno@ejemplo.test' };
const BRUNO_ID = BRUNO.id;
const CARLA = { id: '33333333-3333-4333-8333-333333333333', email: 'carla@ejemplo.test' };
const DANI = { id: '44444444-4444-4444-8444-444444444444', email: 'dani@ejemplo.test' };
const EVA = { id: '66666666-6666-4666-8666-666666666666', email: 'eva@ejemplo.test' };
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
    { user_id: EVA.id, alias: 'Eva Montesinos de la Torre', avatar_id: 'gato-lector', community_enabled: true },
  );
  mock.db.follows.push({ follower: ANA.id, followed: BRUNO.id }, { follower: ANA.id, followed: CARLA.id }, { follower: ANA.id, followed: DANI.id }, { follower: ANA.id, followed: EVA.id });
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
    { user_id: EVA.id, visible: true, featured_books: [], figure_ids: [], guardian_id: null, show_current: false, current_title: null, signature_books: [], memories: [], last_book: null, next_book: null },
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
const ROOM_BUTTON = /Libros compartidos por Bruno/;

/** Errores de página y de consola (los avisos de red del simulador no cuentan). */
function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** Nada de opciones de animación en el recorrido (1.58.1). */
async function noAnimationOptions(visit) {
  await expect(visit.getByRole('button', { name: /Saltar|sin animación/i })).toHaveCount(0);
  await expect(visit.getByRole('checkbox')).toHaveCount(0);
  await expect(visit).not.toContainText(/sin animación|Saltar/);
}

/** La escena cubre la pantalla de borde a borde (sin franjas) y los controles flotan sin banda propia. */
async function edgeToEdge(page, visit) {
  const vp = page.viewportSize();
  const r = await visit.locator('.reader-visit__frame').boundingBox();
  expect(r.x).toBeLessThanOrEqual(0.5);
  expect(r.y).toBeLessThanOrEqual(0.5);
  expect(r.x + r.width).toBeGreaterThanOrEqual(vp.width - 0.5);
  expect(r.y + r.height).toBeGreaterThanOrEqual(vp.height - 0.5);
  expect(Math.abs(r.width / r.height - 9 / 16)).toBeLessThan(0.01);
  const bands = await visit.evaluate((el) => ['.reader-visit__bar', '.reader-visit__foot'].map((sel) => (el.querySelector(sel) ? getComputedStyle(el.querySelector(sel)).backgroundColor : 'rgba(0, 0, 0, 0)')));
  expect(bands).toEqual(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']);
}

test('visita: la entrada empieza sola, sin opciones; habitación con lo compartido, libro, pendientes y vuelta', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390 en Chromium y WebKit');
  const errors = watchErrors(page);
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
  await noAnimationOptions(visit);
  // Una sola flecha discreta para volver (se llama «Salir de la visita» durante la entrada y «Volver» en la habitación)
  await expect(visit.getByRole('button', { name: /^(Salir de la visita|Volver)$/ })).toHaveCount(1);
  await edgeToEdge(page, visit);
  if (info.project.name.startsWith('webkit')) {
    // WebKit decodifica el MP4: la entrada empieza sin tocar nada y se ve un fotograma
    await expect(visit.locator('video[data-on]')).toHaveCount(1, { timeout: 8000 });
    await noAnimationOptions(visit);
    await edgeToEdge(page, visit);
    await shot(page, info, 'v1581-entrando');
  }
  await expect(visit.getByRole('button', { name: ROOM_BUTTON })).toBeVisible({ timeout: 15000 });
  // Chromium informa de la petición del vídeo (y como no decodifica H.264, entra por el camino de fallo); WebKit la hace
  // desde su motor multimedia sin exponerla a Playwright (allí la prueba es el fotograma visible de arriba)
  if (!info.project.name.startsWith('webkit')) expect(videoRequests(log).length).toBeGreaterThan(0);
  expect(await page.evaluate(() => history.state.bookshelf.loc.panel)).toEqual({ type: 'visit', id: BRUNO_ID, section: 'habitacion' });
  await expect(visit.locator('video')).toHaveCount(0);
  await edgeToEdge(page, visit);
  // Habitación: un lomo por libro compartido sobre las baldas, lo que lee (solo el título) y nada privado
  await expect(visit.locator('.reader-visit__spines > g')).toHaveCount(5);
  await expect(visit).toContainText('Está leyendo «Alas de hierro»');
  await expect(visit.locator('.reader-visit__shelf')).toContainText('Libros · 5');
  await page.waitForTimeout(400);
  await shot(page, info, 'v1581-habitacion');
  // Libros compartidos (tres por fila) → un libro → añadir a pendientes una sola vez
  await visit.getByRole('button', { name: ROOM_BUTTON }).click();
  const sheet = page.getByRole('dialog', { name: 'Libros compartidos por Bruno' });
  await expect(sheet).toContainText('no es su biblioteca completa');
  await expect(sheet.locator('.reader-visit__book')).toHaveCount(5);
  await expect(sheet).not.toContainText('Diario secreto');
  await expect(sheet).not.toContainText('Biblioteca privada');
  await expect(sheet.locator('.review-card')).toContainText('Contiene spoilers');
  await expect(sheet.locator('.review-card')).not.toContainText('El final cambia');
  await shot(page, info, 'v1581-libros');
  await sheet.getByRole('button', { name: /Rebeca/ }).click();
  const book = page.getByRole('dialog', { name: 'Rebeca' });
  await expect(book).toContainText('En su colección «Días de lluvia»');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.length);
  await book.getByRole('button', { name: 'Añadir a pendientes' }).click();
  await expect(book.getByRole('button', { name: 'Añadir a pendientes' })).toHaveCount(0);
  await expect(book.getByText('Añadido a Pendientes')).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.filter((b) => b.title === 'Rebeca' && b.source === 'community').length)).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.length)).toBe(before + 1);
  await expect(page.locator('.book-sheet')).toHaveCount(0);
  // Atrás: libro → libros → habitación → «Lectores» (la entrada no es un paso al que volver)
  await page.goBack();
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(visit.getByRole('button', { name: 'Volver', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('region', { name: 'Lectores que sigo' })).toBeVisible();
  // Segunda visita: vuelve a empezar sola y llega igual
  await page.getByRole('button', { name: 'Visitar el rincón de Bruno' }).click();
  await noAnimationOptions(page.getByRole('dialog', { name: 'Visita al rincón de Bruno' }));
  await expect(page.getByRole('dialog', { name: 'Visita al rincón de Bruno' }).getByRole('button', { name: ROOM_BUTTON })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Lectores que sigo' })).toBeVisible();
  // Ni una petición a la biblioteca sincronizada de otra persona
  expect(log.filter((u) => u.includes('/rest/v1/libraries') && u.includes(BRUNO.id))).toEqual([]);
  expect(errors).toEqual([]);
});

test('salir durante la entrada suelta el vídeo; si el vídeo falla se entra igualmente; recargar no repite', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390 en Chromium y WebKit');
  const errors = watchErrors(page);
  const mock = seed();
  const log = [];
  page.on('request', (r) => log.push(r.url()));
  await openReaders(page, mock);
  // Salir en plena entrada: vuelve a «Lectores» y no queda vídeo ni temporizador que luego empuje a la habitación
  await page.getByRole('button', { name: 'Visitar el rincón de Bruno' }).click();
  // (en Chromium el vídeo falla enseguida y la flecha ya puede llamarse «Volver»: es la misma)
  await page.getByRole('button', { name: /^(Salir de la visita|Volver)$/ }).click();
  await expect(page.getByRole('region', { name: 'Lectores que sigo' })).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.locator('.reader-visit')).toHaveCount(0);
  expect(await page.evaluate(() => history.state.bookshelf.loc.panel.type)).toBe('social');
  // Vídeo roto: se entra en la habitación sin preguntar
  await page.route('**/media/social-visit/entrada-v1.mp4', (route) => route.abort());
  await page.getByRole('button', { name: 'Visitar el rincón de Bruno' }).click();
  const visit = page.getByRole('dialog', { name: 'Visita al rincón de Bruno' });
  await expect(visit.getByRole('button', { name: ROOM_BUTTON })).toBeVisible({ timeout: 10000 });
  await noAnimationOptions(visit);
  // Recargar: la habitación vuelve sin vídeo
  log.length = 0;
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Visita al rincón de Bruno' }).getByRole('button', { name: ROOM_BUTTON })).toBeVisible();
  await page.waitForTimeout(500);
  expect(videoRequests(log)).toEqual([]);
  expect(await page.locator('.reader-visit video').count()).toBe(0);
  // Ver perfil (la vista de siempre) y volver a la habitación
  await page.getByRole('button', { name: 'Ver el perfil de Bruno' }).first().click();
  await expect(page.locator('.reader-profile')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Visita al rincón de Bruno' }).getByRole('button', { name: ROOM_BUTTON })).toBeVisible();
  expect(errors).toEqual([]);
});

test('otra persona mientras carga: nunca se ven los libros de la anterior; sin libros; bloqueado; lectura oculta', async ({ page }, info) => {
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
  await expect(visit.getByRole('button', { name: /Libros compartidos por Carla \(1\)/ })).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1800);
  await expect(visit.locator('.reader-visit__spines > g')).toHaveCount(1);
  await visit.getByRole('button', { name: /Libros compartidos por Carla/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Libros compartidos por Carla' });
  await expect(sheet.locator('.reader-visit__book')).toHaveCount(1);
  await expect(sheet).toContainText('Momo');
  await expect(sheet).not.toContainText('Cuarta ala');
  await expect(page.locator('.reader-visit')).not.toContainText('No debería verse');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await visit.getByRole('button', { name: 'Volver', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Lectores que sigo' })).toBeVisible();
  // Eva comparte su rincón pero ningún libro: baldas vacías y un aviso honesto, sin libros inventados
  await page.getByRole('button', { name: /Visitar el rincón de Eva/ }).click();
  const eva = page.getByRole('dialog', { name: /Visita al rincón de Eva/ });
  await expect(eva).toContainText('Aún no ha compartido libros', { timeout: 15000 });
  await expect(eva.locator('.reader-visit__spines')).toHaveCount(0);
  await expect(eva.locator('.reader-visit__shelf')).toHaveText('Libros');
  // Alias largo: legible entero para lectores de pantalla aunque se abrevie
  await expect(eva.locator('.reader-visit__who')).toContainText('Eva Montesinos de la Torre');
  // Dani bloquea a Ana: su visita (abierta a mano) dice que no está disponible y no enseña nada suyo
  await page.evaluate((id) => {
    history.pushState({ bookshelf: { loc: { view: 'room', panel: { type: 'visit', id } }, depth: 5, parent: { view: 'room', panel: { type: 'social', tab: 'lectores' } } } }, '');
    dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
  }, DANI.id);
  await expect(page.locator('.reader-visit')).toContainText('Este rincón no está disponible');
  await expect(page.locator('.reader-visit')).not.toContainText('Libro de Dani');
});

test('movimiento reducido: directamente a la habitación, sin vídeo; encuadre a sangre en 360, 430 y escritorio', async ({ page }, info) => {
  test.skip(!/390x844$/.test(info.project.name) || info.project.name.startsWith('webkit'), 'una vez, en Chromium');
  const mock = seed();
  const log = [];
  page.on('request', (r) => log.push(r.url()));
  await openReaders(page, mock, { reduced: true });
  await page.getByRole('button', { name: 'Visitar el rincón de Bruno' }).click();
  const visit = page.getByRole('dialog', { name: 'Visita al rincón de Bruno' });
  await expect(visit.getByRole('button', { name: ROOM_BUTTON })).toBeVisible();
  await noAnimationOptions(visit);
  expect(videoRequests(log)).toEqual([]);
  expect(parseFloat(await visit.locator('.reader-visit__spines').evaluate((el) => getComputedStyle(el).transitionDuration))).toBeLessThan(0.01);
  for (const [w, h] of [
    [360, 800],
    [430, 932],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(300);
    const r = await visit.locator('.reader-visit__frame').boundingBox();
    expect(Math.abs(r.width / r.height - 9 / 16)).toBeLessThan(0.01);
    if (w < h) {
      // Vertical: cubre de borde a borde
      await edgeToEdge(page, visit);
    } else {
      // Escritorio: la ilustración casi entera en alto (recorte vertical ≤ 12 %), centrada, y a los lados la misma escena
      // desenfocada (no una banda)
      expect(r.height).toBeGreaterThanOrEqual(h - 1);
      expect(r.height).toBeLessThanOrEqual(h * 1.13);
      expect(r.y + r.height / 2 - h / 2).toBeLessThan(1);
      expect(Math.abs(r.x + r.width / 2 - w / 2)).toBeLessThan(2);
      await expect(visit.locator('.reader-visit__backdrop img[data-on]')).toHaveCount(1);
    }
    // La balda tocable queda dentro de la ilustración y los libros, a la vista (el recorte lateral no se los come)
    const s = await visit.locator('.reader-visit__shelf').boundingBox();
    expect(s.x).toBeGreaterThanOrEqual(r.x - 1);
    expect(s.x + s.width).toBeLessThanOrEqual(r.x + r.width * 0.24);
    const first = await visit.locator('.reader-visit__spines > g').first().boundingBox();
    expect(first.x).toBeGreaterThanOrEqual(0);
    await shot(page, info, `v1581-encuadre-${w}`);
  }
});
