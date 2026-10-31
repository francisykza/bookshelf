// QA del bloque 1 de la 1.62 (SPEC §62): tres pestañas (Lectores, Salón, Clubes) sin desplazamiento a 320/360,
// «Tu perfil lector» y «Mi rincón» desde el avatar propio con Atrás, buscador de la comunidad, opiniones compactas con
// ficha pública (spoilers ocultos, sin edición), «Añadir a pendientes» por la obra y opiniones por páginas.
// Datos sintéticos contra el simulador de Supabase. Nada de esto equivale a un iPhone real.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222' };
const CARLA = { id: '33333333-3333-4333-8333-333333333333' };
const DANI = { id: '44444444-4444-4444-8444-444444444444' };
const ELENA = { id: '88888888-8888-4888-8888-888888888888' };
const W1 = { id: '55555555-5555-4555-8555-555555555555', kind: 'local', title: 'Circe', author: 'Madeline Miller' };
const W2 = { id: '55555555-5555-4555-8555-555555555556', kind: 'local', title: 'El jardín de agua', author: 'Autora de Prueba' };

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

function seed({ many = 0 } = {}) {
  const mock = createMockSupabase();
  mock.db.works.push(W1, W2);
  mock.db.profiles.push(
    { user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true },
    { user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'lector-farol', community_enabled: true },
    { user_id: CARLA.id, alias: 'Carla', avatar_id: 'gato-lector', community_enabled: true },
    // Dani bloquea a Ana: nunca aparece en la búsqueda
    { user_id: DANI.id, alias: 'Dani Bruma', avatar_id: 'lector-farol', community_enabled: true },
    // Elena no participa en la comunidad: su perfil no es público
    { user_id: ELENA.id, alias: 'Elena Bruma', avatar_id: 'gato-lector', community_enabled: false },
  );
  mock.db.follows.push({ follower: ANA.id, followed: BRUNO.id }, { follower: ANA.id, followed: CARLA.id });
  mock.db.blocks.push({ blocker: DANI.id, blocked: ANA.id });
  const at = (i) => new Date(Date.now() - i * 3600e3).toISOString();
  mock.db.public_reviews.push(
    { id: '70000000-0000-4000-8000-000000000001', work_id: W1.id, user_id: BRUNO.id, rating_quarters: 16, body: 'Una historia que me ha acompañado durante días.', has_spoilers: false, status: 'published', published_at: at(1) },
    { id: '70000000-0000-4000-8000-000000000002', work_id: W2.id, user_id: CARLA.id, rating_quarters: 20, body: 'Al final los hombres grises pierden.', has_spoilers: true, status: 'published', published_at: at(2) },
    ...Array.from({ length: many }, (_, i) => ({ id: `71000000-0000-4000-8000-${String(i).padStart(12, '0')}`, work_id: W1.id, user_id: BRUNO.id, rating_quarters: 12, body: `Opinión antigua ${i + 1}`, has_spoilers: false, status: 'published', published_at: at(10 + i) })),
  );
  return mock;
}

async function openHub(page, mock, tab = 'lectores') {
  await mock.attach(page, ANA);
  await page.addInitScript((t) => {
    if (sessionStorage.getItem('v162-nav')) return;
    sessionStorage.setItem('v162-nav', '1');
    history.replaceState({ bookshelf: { loc: { view: 'room', panel: { type: 'social', tab: t } }, depth: 0, parent: null } }, '');
  }, tab);
  await page.goto('/');
  await expect(page.getByRole('tablist', { name: 'Secciones de la comunidad' })).toBeVisible();
}

test('tres pestañas sin desplazamiento; lo tuyo desde el avatar y Atrás vuelve a la pestaña', async ({ page }, info) => {
  const mock = seed();
  await openHub(page, mock);
  const tabs = page.getByRole('tablist', { name: 'Secciones de la comunidad' }).getByRole('tab');
  await expect(tabs).toHaveText(['Lectores', 'Salón', 'Clubes']);
  const geo = await page.evaluate(() => {
    const list = document.querySelector('.social-hub__tabs');
    return { overflow: list.scrollWidth - list.clientWidth, page: document.documentElement.scrollWidth - innerWidth, heights: [...list.querySelectorAll('button')].map((b) => b.offsetHeight) };
  });
  expect(geo.overflow).toBeLessThanOrEqual(0);
  expect(geo.page).toBeLessThanOrEqual(0);
  for (const h of geo.heights) expect(h).toBeGreaterThanOrEqual(44);
  await shot(page, info, 'v162-lectores');
  // Salón y Clubes cambian la pestaña sin apilar historial
  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  expect(await page.evaluate(() => history.state.bookshelf.loc.panel)).toEqual({ type: 'social', tab: 'sala' });
  await tabs.nth(0).click();
  // Tu avatar: «Tu perfil lector»; Atrás vuelve a Lectores
  await page.getByRole('button', { name: 'Tu perfil y tu rincón' }).click();
  await page.getByRole('menuitem', { name: 'Mi perfil y avatar' }).click();
  await expect(page.getByRole('heading', { name: 'Tu perfil lector' })).toBeVisible();
  await expect(page.getByLabel('Alias público')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Entre lectores' })).toBeVisible();
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
  // Mi rincón, y vuelta con su enlace
  await page.getByRole('button', { name: 'Tu perfil y tu rincón' }).click();
  await page.getByRole('menuitem', { name: 'Mi rincón' }).click();
  // Su hoja conserva el título «Comunidad» de la 1.60 y su propio encabezado «Mi rincón»
  await expect(page.locator('.social-hub__head h2')).toHaveText('Comunidad');
  await expect(page.getByRole('heading', { name: 'Mi rincón' })).toBeVisible();
  await page.getByRole('button', { name: '← Entre lectores' }).click();
  await expect(page.getByRole('region', { name: 'Lectores que sigo' })).toBeVisible();
  // El menú se cierra con Escape sin cerrar el panel
  await page.getByRole('button', { name: 'Tu perfil y tu rincón' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByRole('tablist', { name: 'Secciones de la comunidad' })).toBeVisible();
});

test('buscador, opiniones compactas, ficha pública con spoilers ocultos y pendientes por la obra', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390 en Chromium y WebKit');
  const mock = seed();
  await openHub(page, mock);
  const followed = page.getByRole('region', { name: 'Lectores que sigo' });
  await expect(followed.getByRole('button', { name: 'Ver el perfil de Bruno' })).toBeVisible();
  await expect(followed.getByRole('button', { name: 'Visitar el rincón de Carla' })).toBeVisible();
  // Buscar «bruma»: ni Dani (bloqueo) ni Elena (perfil no público)
  const search = page.getByRole('searchbox', { name: 'Buscar lectoras y lectores' });
  await search.fill('bruma');
  await expect(page.getByRole('region', { name: 'Resultados de la búsqueda' })).toContainText('Nadie con ese alias');
  await search.fill('carl');
  const results = page.getByRole('region', { name: 'Resultados de la búsqueda' });
  await expect(results.getByRole('button', { name: 'Ver el perfil de Carla' })).toBeVisible();
  await expect(followed.getByRole('button', { name: 'Ver el perfil de Bruno' })).toHaveCount(0);
  await search.fill('');
  // Opinión sin spoilers: extracto, «Leer reseña» y «Añadir a pendientes»
  const shared = page.getByRole('region', { name: 'Lo que comparten' });
  const bruno = shared.getByRole('article', { name: /Opinión de Bruno/ });
  await expect(bruno).toContainText('Una historia que me ha acompañado');
  // Opinión con spoilers: ni el texto ni la portada a la vista
  const carla = shared.getByRole('article', { name: /Opinión de Carla/ });
  await expect(carla).toContainText('Contiene spoilers');
  await expect(carla).not.toContainText('hombres grises');
  await shot(page, info, 'v162-opiniones');
  // Ficha pública: la reseña entera, sin edición del libro ajeno; Escape vuelve con el foco
  await bruno.getByRole('button', { name: 'Leer reseña' }).click();
  const sheet = page.getByRole('dialog', { name: 'Circe' });
  await expect(sheet.locator('.review-card')).toContainText('Una historia que me ha acompañado durante días.');
  await expect(page.locator('.book-sheet')).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: /Editar|Borrar|Eliminar/ })).toHaveCount(0);
  await shot(page, info, 'v162-ficha-publica');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(bruno.getByRole('button', { name: 'Leer reseña' })).toBeFocused();
  await expect(page.getByRole('tablist', { name: 'Secciones de la comunidad' })).toBeVisible();
  // La de spoilers: la ficha la oculta hasta pedirla
  await carla.getByRole('button', { name: /Contiene spoilers/ }).click();
  const momo = page.getByRole('dialog', { name: 'El jardín de agua' });
  await expect(momo.locator('.review-card')).not.toContainText('hombres grises');
  await momo.getByRole('button', { name: /spoiler/i }).first().click();
  await expect(momo.locator('.review-card')).toContainText('hombres grises');
  // Añadir a pendientes desde la ficha: una vez, guardando la obra; en la tarjeta ya figura como añadido
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.length);
  await momo.getByRole('button', { name: 'Añadir a pendientes' }).click();
  await expect(momo.getByText('Añadido a Pendientes')).toBeVisible();
  await expect.poll(() => page.evaluate((id) => JSON.parse(localStorage.getItem('bookshelf:v1')).books.filter((b) => b.workId === id).length, W2.id)).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.length)).toBe(before + 1);
  await page.keyboard.press('Escape');
  await carla.getByRole('button', { name: /Contiene spoilers/ }).click();
  await expect(page.getByRole('dialog', { name: 'El jardín de agua' }).getByText('Ya está en tu biblioteca')).toBeVisible();
  await page.keyboard.press('Escape');
  // El avatar de una opinión abre su perfil como panel propio; Atrás vuelve a Lectores
  await bruno.getByRole('button', { name: 'Ver el perfil de Bruno' }).click();
  await expect(page.locator('.reader-profile')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('region', { name: 'Lo que comparten' })).toBeVisible();
});

test('opiniones por páginas: «Ver más» trae la siguiente sin repetir', async ({ page }, info) => {
  test.skip(!/390x844$/.test(info.project.name) || info.project.name.startsWith('webkit'), 'una vez, en Chromium');
  const mock = seed({ many: 45 });
  await openHub(page, mock);
  const shared = page.getByRole('region', { name: 'Lo que comparten' });
  await expect(shared.getByRole('article').first()).toBeVisible();
  const first = await shared.getByRole('article').count();
  expect(first).toBeLessThan(47);
  await shared.getByRole('button', { name: 'Ver más opiniones' }).click();
  await expect.poll(() => shared.getByRole('article').count()).toBeGreaterThan(first);
  const ids = await shared.locator('.share-card').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') + e.textContent));
  expect(new Set(ids).size).toBe(ids.length);
});

// ── Bloque 2 (SPEC §62.2): sillones del salón, «Salón» y visita con fachada ─────────────────────────────────────
const presence = (u, mins, extra = {}) => ({ user_id: u.id, share_book: false, book_title: null, started_at: new Date(Date.now() - mins * 60000).toISOString(), last_seen: new Date().toISOString(), ...extra });

async function toSalon(page, mock, { reduced = false } = {}) {
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.waitForFunction(() => document.querySelector('[data-panel="SOCIAL_ROOM"] .scene-base')?.naturalWidth > 0);
}

/** El sillón que se ve en pantalla (en móviles estrechos el encuadre puede dejar uno fuera). */
async function visibleSeat(page) {
  const id = await page.evaluate(() => {
    const seats = [...document.querySelectorAll('[data-panel="SOCIAL_ROOM"] .social-spot[data-id^="sillon"]')];
    return seats.find((el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      return cx > 20 && cx < innerWidth - 20;
    })?.dataset.id;
  });
  return page.locator(`[data-panel="SOCIAL_ROOM"] .social-spot[data-id="${id}"]`);
}

/** Una caja dentro de la ventana, con margen. */
async function insideViewport(page, locator) {
  const r = await locator.boundingBox();
  const vp = page.viewportSize();
  expect(r.x).toBeGreaterThanOrEqual(0);
  expect(r.y).toBeGreaterThanOrEqual(0);
  expect(r.x + r.width).toBeLessThanOrEqual(vp.width + 0.5);
  expect(r.y + r.height).toBeLessThanOrEqual(vp.height + 0.5);
}

test('salón: sentarse desde el sillón con la lectura elegida, tarjeta propia con «Levantarme» y nada inventado', async ({ page }, info) => {
  const mock = seed();
  await toSalon(page, mock);
  await page.waitForTimeout(600);
  // Nadie sentado: sin medallones; el sillón libre lleva su etiqueta «Sentarme»
  await expect(page.locator('.seat-medallion')).toHaveCount(0);
  await expect(page.locator('.seat-free').first()).toContainText('Sentarme');
  await (await visibleSeat(page)).click();
  const card = page.getByRole('dialog', { name: 'Sentarme a leer' });
  await expect(card).toBeVisible();
  await insideViewport(page, card);
  await expect(card).toContainText('Sentarte no registra páginas.');
  await expect(card.getByRole('radio', { name: 'Mi alias y mi lectura actual' })).toBeChecked();
  // El selector de lecturas en curso: se elige otra que la actual
  const select = card.getByRole('combobox', { name: /Lectura actual/ });
  const options = await select.locator('option').allTextContents();
  expect(options.length).toBeGreaterThan(1);
  await select.selectOption({ index: 1 });
  const chosen = options[1].split(' · ')[0];
  await expect(card).toContainText(`Lectura actual · ${chosen}`);
  await shot(page, info, 'v162-sentarse');
  // Escape cierra sin sentarse; el foco vuelve al sillón
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  expect(mock.db.reading_presence).toEqual([]);
  await (await visibleSeat(page)).click();
  await card.getByRole('combobox', { name: /Lectura actual/ }).selectOption({ index: 1 });
  await card.getByRole('button', { name: 'Sentarme a leer' }).click();
  await expect(card).toHaveCount(0);
  expect(mock.db.reading_presence).toEqual([expect.objectContaining({ user_id: ANA.id, share_book: true, book_title: chosen })]);
  // Mi medallón abre mi tarjeta, anclada y dentro de la pantalla, con «Levantarme» (y sin visitarme a mí)
  await page.locator('.seat-medallion').click();
  const mine = page.getByRole('dialog', { name: 'Tu sitio en el salón' });
  await expect(mine).toContainText(`Leyendo ${chosen}`);
  await expect(mine.getByRole('button', { name: /Visitar/ })).toHaveCount(0);
  await insideViewport(page, mine);
  await mine.getByRole('button', { name: 'Levantarme' }).click();
  await expect(mine).toHaveCount(0);
  await expect(page.locator('.seat-medallion')).toHaveCount(0);
  expect(mock.db.reading_presence).toEqual([]);
});


test('salón: la tarjeta de quien lee (lectura solo si la comparte), visitar su rincón y volver al salón', async ({ page }, info) => {
  const mock = seed();
  mock.db.corners.push({ user_id: BRUNO.id, visible: true, featured_books: [{ id: 'circe', title: 'Circe', author: 'Madeline Miller', cover: '' }], figure_ids: [], guardian_id: null, show_current: false, current_title: null });
  mock.db.reading_presence.push(presence(BRUNO, 12, { share_book: true, book_title: 'Circe' }), presence(CARLA, 4));
  await toSalon(page, mock);
  await expect(page.locator('.seat-medallion')).toHaveCount(2, { timeout: 15000 });
  // Carla no comparte libro: su tarjeta no dice qué lee
  await page.locator('.seat-medallion', { hasText: 'Carla' }).click();
  const carla = page.getByRole('dialog', { name: 'Carla en el salón' });
  await expect(carla).toBeVisible();
  await expect(carla).not.toContainText('Leyendo');
  await carla.getByRole('button', { name: 'Cerrar' }).click();
  await expect(carla).toHaveCount(0);
  await page.locator('.seat-medallion', { hasText: 'Bruno' }).click();
  const bruno = page.getByRole('dialog', { name: 'Bruno en el salón' });
  await expect(bruno).toContainText('Leyendo Circe');
  await expect(bruno.getByRole('button', { name: 'Ver perfil' })).toBeVisible();
  await insideViewport(page, bruno);
  await shot(page, info, 'v162-tarjeta-lector');
  await bruno.getByRole('button', { name: 'Visitar su rincón' }).click();
  // Fachada: quién es, volver al salón y entrar; el vídeo aún no se ha pedido
  const visit = page.getByRole('dialog', { name: 'Visita al rincón de Bruno' });
  await expect(visit.locator('.reader-visit__who')).toContainText('El rincón de Bruno');
  await expect(visit.getByRole('button', { name: 'Volver al salón' })).toBeVisible();
  const door = visit.getByRole('button', { name: 'Entrar al rincón de Bruno' });
  await expect(door).toBeEnabled();
  await insideViewport(page, door);
  await page.waitForTimeout(500);
  await shot(page, info, 'v162-fachada');
  await page.route('**/media/social-visit/entrada-v1.mp4', (route) => route.abort());
  await door.click();
  await expect(visit.getByRole('button', { name: /Libros compartidos por Bruno/ })).toBeVisible({ timeout: 15000 });
  expect(await page.evaluate(() => history.state.bookshelf.loc.panel)).toEqual({ type: 'visit', id: BRUNO.id, section: 'habitacion', from: 'salon' });
  await visit.getByRole('button', { name: 'Volver al salón' }).click();
  await expect(page.locator('.reader-visit')).toHaveCount(0);
  await expect(page.locator('.social-hub')).toHaveCount(0);
  await expect(page.locator('.seat-medallion')).toHaveCount(2);
});

test('pestaña «Salón»: tu lugar, leyendo en compañía y «Ver rincón» vuelve a la pestaña', async ({ page }, info) => {
  const mock = seed();
  mock.db.corners.push({ user_id: BRUNO.id, visible: true, featured_books: [], figure_ids: [], guardian_id: null, show_current: false, current_title: null });
  mock.db.reading_presence.push(presence(BRUNO, 12, { share_book: true, book_title: 'Circe' }), presence(CARLA, 4));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHub(page, mock, 'sala');
  const hub = page.locator('.social-hub');
  await expect(hub.getByRole('heading', { name: 'Tu lugar en el salón' })).toBeVisible();
  const company = hub.getByRole('region', { name: 'Leyendo en compañía' });
  await expect(company.locator('.room-tab__reader')).toHaveCount(2);
  await expect(company).toContainText('Leyendo Circe');
  await expect(company.locator('.room-tab__reader', { hasText: 'Carla' })).not.toContainText('Leyendo');
  await shot(page, info, 'v162-salon-tab');
  // Sentarse con solo el alias: el título no sale del dispositivo
  await hub.getByRole('radio', { name: 'Solo mi alias' }).check();
  await hub.getByRole('button', { name: 'Sentarme a leer' }).click();
  await expect(hub.getByRole('button', { name: 'Levantarme' })).toBeVisible();
  expect(mock.db.reading_presence.find((r) => r.user_id === ANA.id)).toEqual(expect.objectContaining({ share_book: false, book_title: null }));
  await expect(hub).toContainText('Solo con tu alias');
  // «Ver rincón» (movimiento reducido: directamente dentro) y volver, a la misma pestaña
  await company.getByRole('button', { name: 'Ver el rincón de Bruno' }).click();
  const visit = page.getByRole('dialog', { name: 'Visita al rincón de Bruno' });
  await expect(visit.getByRole('button', { name: /Libros compartidos por Bruno/ })).toBeVisible({ timeout: 15000 });
  await visit.getByRole('button', { name: 'Volver al salón' }).click();
  await expect(hub.getByRole('heading', { name: 'Tu lugar en el salón' })).toBeVisible();
  expect(await page.evaluate(() => history.state.bookshelf.loc.panel)).toEqual({ type: 'social', tab: 'sala' });
  await hub.getByRole('button', { name: 'Levantarme' }).click();
  await expect(hub.getByRole('button', { name: 'Sentarme a leer' })).toBeVisible();
  expect(mock.db.reading_presence.find((r) => r.user_id === ANA.id)).toBeUndefined();
});

test('más lectores que sillones: dos retratos sin solaparse y el resto en la lista', async ({ page }) => {
  const mock = seed();
  const extra = [
    { id: '99999999-9999-4999-8999-999999999991', alias: 'Eloy' },
    { id: '99999999-9999-4999-8999-999999999992', alias: 'Fina' },
  ];
  for (const p of extra) mock.db.profiles.push({ user_id: p.id, alias: p.alias, avatar_id: 'gato-lector', community_enabled: true });
  mock.db.reading_presence.push(presence(BRUNO, 12), presence(CARLA, 8), presence(extra[0], 6), presence(extra[1], 2));
  await toSalon(page, mock);
  await expect(page.locator('.seat-medallion')).toHaveCount(2, { timeout: 15000 });
  const [a, b] = await page.locator('.seat-medallion .reader-avatar').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
  expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
  await page.getByRole('button', { name: '+2 lectores' }).click();
  const company = page.locator('.social-hub').getByRole('region', { name: 'Leyendo en compañía' });
  await expect(company.locator('.room-tab__reader')).toHaveCount(4);
  await expect(company).toContainText('Fina');
});
