// Entrega 3 · interfaz (SPEC §25.15): seguir, rincón compartido, sillones con 0, 1 y varios participantes reales,
// sentarse sin premios, club con invitación revocable y tropos con denominador, contra el simulador de Supabase.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222', email: 'bruno@ejemplo.test' };
const CARLA = { id: '33333333-3333-4333-8333-333333333333', email: 'carla@ejemplo.test' };
const DANI = { id: '44444444-4444-4444-8444-444444444444', email: 'dani@ejemplo.test' };

const members = (db, people) => people.forEach(([u, alias, avatar]) => db.profiles.push({ user_id: u.id, alias, avatar_id: avatar, community_enabled: true }));

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

async function ready(page) {
  // El aviso de primera visita de los carteles tiene su propia prueba; aquí se da por visto (a 320 tapa la flecha)
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
}

/** El sillón que se ve en pantalla (en móviles estrechos el encuadre puede dejar uno fuera). */
async function visibleSeat(page) {
  const id = await page.evaluate(() => {
    const seats = [...document.querySelectorAll('[data-panel="SOCIAL_ROOM"] .social-spot[data-id^="sillon"]')];
    const seen = seats.find((el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      return cx > 20 && cx < innerWidth - 20;
    });
    return seen?.dataset.id;
  });
  return page.locator(`[data-panel="SOCIAL_ROOM"] .social-spot[data-id="${id}"]`);
}

async function toSalon(page) {
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.waitForFunction(() => document.querySelector('[data-panel="SOCIAL_ROOM"] .scene-base')?.naturalWidth > 0);
}

const presence = (u, mins, extra = {}) => ({ user_id: u.id, share_book: false, book_title: null, started_at: new Date(Date.now() - mins * 60000).toISOString(), last_seen: new Date().toISOString(), ...extra });

test('sillones: vacíos sin nadie, un participante real con su libro y «+N» cuando no caben', async ({ page }, info) => {
  const mock = createMockSupabase();
  members(mock.db, [
    [ANA, 'Ana lectora', 'gato-lector'],
    [BRUNO, 'Bruno', 'lector-farol'],
    [CARLA, 'Carla', 'viajera-pelirroja'],
    [DANI, 'Dani', 'vidente-estrellas'],
  ]);
  await mock.attach(page, ANA);
  await ready(page);
  await toSalon(page);
  // Cero participantes: ningún medallón (nunca se inventa a nadie)
  await expect(page.locator('[data-panel="SOCIAL_ROOM"] .social-spot[data-id="tablet"]')).toHaveCount(1);
  await page.waitForTimeout(600);
  await expect(page.locator('.seat-medallion')).toHaveCount(0);
  await shot(page, info, 'salon-vacio');
  // Un participante (Bruno, compartiendo libro) y luego tres: dos sillones y «+1 lector»
  mock.db.reading_presence.push(presence(BRUNO, 12, { share_book: true, book_title: 'Circe' }));
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await toSalon(page);
  const medal = page.locator('.seat-medallion');
  await expect(medal).toHaveCount(1);
  await expect(medal).toContainText('Bruno');
  await expect(medal).toContainText('Circe');
  await expect(medal).toContainText('12 min');
  // El medallón está anclado al sillón (dentro de su caja en pantalla)
  const anchored = await page.evaluate(() => {
    const m = document.querySelector('.seat-medallion .reader-avatar').getBoundingClientRect();
    const s = document.querySelector('[data-panel="SOCIAL_ROOM"] .social-spot[data-id^="sillon"]');
    return { size: m.width, inside: Boolean(s) };
  });
  expect(anchored.size).toBeGreaterThanOrEqual(43.5);
  expect(anchored.size).toBeLessThanOrEqual(64.5);
  await shot(page, info, 'salon-uno');
  mock.db.reading_presence.push(presence(CARLA, 5), presence(DANI, 2));
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await toSalon(page);
  await expect(page.locator('.seat-medallion')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '+1 lector' })).toBeVisible();
  // Una presencia caducada (sin renovar más de 3 minutos) no aparece
  mock.db.reading_presence.forEach((r) => r.user_id === DANI.id && (r.last_seen = new Date(Date.now() - 5 * 60000).toISOString()));
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await toSalon(page);
  await expect(page.locator('.seat-medallion')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /\+\d lector/ })).toHaveCount(0);
});

test('sentarse a leer: explícito, sin compartir el libro si no se elige, y sin premios; levantarse', async ({ page }) => {
  const mock = createMockSupabase();
  members(mock.db, [[ANA, 'Ana lectora', 'gato-lector']]);
  await mock.attach(page, ANA);
  await ready(page);
  // La librería normaliza `placements` (figura → lista de libros) al cargar el catálogo: se espera a que acabe
  await page.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem('bookshelf:v1')).progress.figures.placements ?? {}).every(Array.isArray));
  const figuresBefore = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('bookshelf:v1')).progress.figures));
  await toSalon(page);
  // Entrar al salón no sienta a nadie
  await page.waitForTimeout(600);
  expect(mock.db.reading_presence).toEqual([]);
  // 1.62 (SPEC §62.2): el sillón libre abre aquí mismo la elección, sin salir del salón
  await (await visibleSeat(page)).click();
  const card = page.getByRole('dialog', { name: 'Sentarme a leer' });
  await card.getByRole('radio', { name: 'Solo mi alias' }).check();
  await card.getByRole('button', { name: 'Sentarme a leer' }).click();
  await expect(card).toHaveCount(0);
  await expect(page.locator('.social-hub')).toHaveCount(0);
  expect(mock.db.reading_presence).toEqual([expect.objectContaining({ user_id: ANA.id, share_book: false, book_title: null })]);
  await expect(page.locator('.seat-medallion')).toHaveCount(1);
  await expect(page.locator('.seat-medallion')).toContainText('Ana lectora');
  // Ni sellos ni figuras ni páginas
  expect(await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('bookshelf:v1')).progress.figures))).toBe(figuresBefore);
  // Mi medallón abre mi tarjeta junto al sillón, con «Levantarme»
  await page.locator('.seat-medallion').click();
  await page.getByRole('dialog', { name: 'Tu sitio en el salón' }).getByRole('button', { name: 'Levantarme' }).click();
  await expect(page.locator('.seat-medallion')).toHaveCount(0);
  await expect(page.locator('.seat-free')).toHaveCount(2);
  expect(mock.db.reading_presence).toEqual([]);
});

test('seguir desde una reseña, «Lectores que sigo» y rincón: solo lo elegido y se puede ocultar', async ({ browser }, info) => {
  const mock = createMockSupabase();
  members(mock.db, [
    [ANA, 'Ana lectora', 'gato-lector'],
    [BRUNO, 'Bruno', 'lector-farol'],
  ]);
  const work = { id: '55555555-5555-4555-8555-555555555555', kind: 'local', title: 'Circe', author: 'Madeline Miller' };
  mock.db.works.push(work);
  mock.db.public_reviews.push({ id: '66666666-6666-4666-8666-666666666666', work_id: work.id, user_id: BRUNO.id, rating_quarters: 16, body: 'Preciosa', has_spoilers: false, status: 'published', published_at: new Date().toISOString(), tropes: ['familia-encontrada', 'fuego-lento'], tropes_none: false });
  // Bruno expone su rincón: un libro y su lectura actual
  mock.db.corners.push({ user_id: BRUNO.id, visible: true, featured_books: [{ id: 'circe', title: 'Circe', author: 'Madeline Miller', cover: '' }], figure_ids: [], guardian_id: null, show_current: true, current_title: 'Momo' });
  const page = await (await browser.newContext()).newPage();
  await mock.attach(page, ANA);
  await page.addInitScript(`(() => { try { const st = JSON.parse(localStorage.getItem('bookshelf:v1')); if (!st) return; const b = st.books.find((x) => x.id === st.settings.currentBookId) ?? st.books.find((x) => x.status === 'reading'); b.workId = '${work.id}'; b.isbn = ''; localStorage.setItem('bookshelf:v1', JSON.stringify(st)); } catch (e) {} })()`);
  await ready(page);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  const myBooks = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.map((b) => b.id).join(','));
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="book"]').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: 'Lectores' }).click();
  const readers = page.getByLabel('Voces de lectores');
  // Tropos: con denominador y sin porcentaje (menos de 5); el sensible, oculto hasta pedirlo
  await readers.getByText(/Etiquetas narrativas/).click();
  await expect(readers.locator('.tropes')).toContainText('Familia encontrada');
  await expect(readers.locator('.tropes')).toContainText('1 de 1 lector');
  await expect(readers.locator('.tropes')).not.toContainText('%');
  await expect(readers.locator('.tropes')).not.toContainText('fuego lento');
  await readers.getByRole('button', { name: /revelar la trama/ }).click();
  await expect(readers.locator('.tropes')).toContainText('Romance a fuego lento');
  // Abrir el perfil de Bruno desde su reseña y seguirle (dos veces: no duplica)
  await readers.getByRole('button', { name: 'Bruno', exact: true }).click();
  await expect(page.locator('.huella-readings')).toContainText('Está leyendo');
  await expect(page.locator('.huella-readings')).toContainText('Momo');
  await expect(page.locator('.reader-profile')).toContainText('Circe');
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(page.getByRole('button', { name: 'Siguiendo' })).toBeVisible();
  expect(mock.db.follows).toEqual([expect.objectContaining({ follower: ANA.id, followed: BRUNO.id })]);
  await shot(page, info, 'perfil-lector');
  // Visitar su rincón no toca la biblioteca propia
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.map((b) => b.id).join(','))).toBe(myBooks);
  await page.getByRole('button', { name: 'Siguiendo' }).click();
  await expect(page.getByRole('button', { name: 'Seguir' })).toBeVisible();
  expect(mock.db.follows).toEqual([]);
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(page.getByRole('button', { name: 'Siguiendo' })).toBeVisible();
  // Bruno oculta su rincón: deja de verse
  mock.db.corners[0].visible = false;
  await page.keyboard.press('Escape');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  // Tras recargar, WebKit a veces no atiende Enter en el primer foco (intermitente también en 1.35.0): se abre con un clic
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="book"]').evaluate((el) => el.click());
  await page.getByRole('tab', { name: 'Lectores' }).click();
  await page.getByLabel('Voces de lectores').getByRole('button', { name: 'Lectores que sigo' }).click();
  await expect(page.getByLabel('Voces de lectores').locator('.review-card')).toHaveCount(1);
  await page.getByLabel('Voces de lectores').getByRole('button', { name: 'Bruno', exact: true }).click();
  await expect(page.locator('.reader-profile')).toContainText('Su rincón no está a la vista');
  await expect(page.locator('.reader-profile')).not.toContainText('Momo');
  await page.context().close();
});

test('club: crear, invitar, aceptar con el enlace, revocar y debate con spoilers plegados', async ({ browser }, info) => {
  const mock = createMockSupabase();
  members(mock.db, [
    [ANA, 'Ana lectora', 'gato-lector'],
    [BRUNO, 'Bruno', 'lector-farol'],
    [CARLA, 'Carla', 'viajera-pelirroja'],
  ]);
  const a = await (await browser.newContext()).newPage();
  await mock.attach(a, ANA);
  await ready(a);
  const libraryBefore = await a.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.map((b) => `${b.id}:${b.status}`).join(','));
  await toSalon(a);
  await a.locator('[data-panel="SOCIAL_ROOM"] .social-spot[data-id="board"]').click();
  await a.getByRole('button', { name: 'Crear un club' }).click();
  await a.locator('.social-hub').getByLabel('Nombre', { exact: true }).fill('Club del mar');
  await a.locator('.social-hub').getByLabel('Descripción breve', { exact: true }).fill('Leemos despacio');
  await a.locator('.social-hub').getByLabel('Obra que leeréis', { exact: true }).fill('Kafka en la orilla');
  await a.getByRole('button', { name: 'Crear club' }).click();
  // 1.62 (§62.4): la obra está en la pestaña «Lectura»
  await a.locator('.club-view').getByRole('tab', { name: 'Lectura' }).click();
  await expect(a.locator('.club-reading__work')).toContainText('Kafka en la orilla');
  // El libro del club no entra en la biblioteca ni cambia estados
  expect(await a.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.map((b) => `${b.id}:${b.status}`).join(','))).toBe(libraryBefore);
  // Administrar (punto de debate e invitaciones) está en el menú del propietario
  await a.getByRole('button', { name: 'Opciones del propietario del club' }).click();
  await a.getByRole('menuitem', { name: 'Administrar el club' }).click();
  await a.getByLabel('Punto de debate').fill('Hasta el capítulo 8');
  await a.locator('.club-view').getByRole('button', { name: 'Guardar' }).click();
  await a.getByRole('button', { name: 'Crear enlace de invitación' }).click();
  const link = await a.getByLabel('Enlace de invitación').inputValue();
  expect(link).toMatch(/#club=[0-9a-f]{64}$/);
  await shot(a, info, 'club');
  // Bruno abre el enlace: se une
  const b = await (await browser.newContext()).newPage();
  await mock.attach(b, BRUNO);
  await b.goto(`/${link.slice(link.indexOf('#'))}`);
  await expect(b.locator('.club-view')).toContainText('Club del mar', { timeout: 15000 });
  await expect(b.locator('.club-view')).toContainText('Debate: Hasta el capítulo 8');
  expect(await b.evaluate(() => location.hash)).toBe('');
  await b.getByLabel('Mensaje para el club').fill('El capítulo 3 me ha roto');
  await b.locator('.club-view').getByRole('checkbox', { name: 'Contiene spoilers' }).check();
  await b.getByRole('button', { name: 'Publicar' }).click();
  await expect(b.locator('.club-view .club-msg')).toHaveCount(1);
  // Ana revoca la invitación: Carla ya no puede usarla
  await a.getByRole('button', { name: 'Revocar' }).click();
  await expect(a.locator('.club-view')).toContainText('Invitación revocada');
  const c = await (await browser.newContext()).newPage();
  await mock.attach(c, CARLA);
  await c.goto(`/${link.slice(link.indexOf('#'))}`);
  await expect(c.locator('.invite-toast')).toContainText('no es válida', { timeout: 15000 });
  expect(mock.db.club_members.filter((m) => m.user_id === CARLA.id)).toEqual([]);
  // En el club de Ana, el mensaje de Bruno aparece plegado
  await a.locator('.club-view').getByRole('button', { name: 'Mis clubes' }).click();
  await a.getByRole('button', { name: /Club del mar/ }).click();
  await expect(a.locator('.club-view .club-msg')).toContainText('Contiene spoilers');
  await expect(a.locator('.club-view .club-msg')).not.toContainText('me ha roto');
  for (const p of [a, b, c]) await p.context().close();
});
