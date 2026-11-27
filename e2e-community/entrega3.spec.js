// Entrega 3 · interfaz (SPEC §25.15): seguir, rincón compartido, club con invitación revocable (1.157: los sillones del
// salón ilustrado, archivados con él) y tropos con denominador, contra el simulador de Supabase.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { abrir, abrirLibroActual, esperarInicio } from './entrada';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222', email: 'bruno@ejemplo.test' };
const CARLA = { id: '33333333-3333-4333-8333-333333333333', email: 'carla@ejemplo.test' };
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
  await esperarInicio(page);
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
}

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
  await esperarInicio(page);
  const myBooks = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.map((b) => b.id).join(','));
  await abrirLibroActual(page);
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
  await esperarInicio(page);
  // Tras recargar, WebKit a veces no atiende Enter en el primer foco (intermitente también en 1.35.0): se abre con un clic
  await abrirLibroActual(page);
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
  // 1.157: el tablón del salón ilustrado abría los clubes; ahora se abren directamente
  await abrir(a, { type: 'social', tab: 'club' });
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
