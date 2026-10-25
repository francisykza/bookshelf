// QA de la 1.35.0 (SPEC §28.10): perfil «Las historias dejan huella» contra el simulador de Supabase. Rincón 3:2
// sin recortar con su variante, tres libros en la balda, recuerdos en la mesa que se abren y permiten añadir el libro
// a Pendientes con procedencia privada, colección que se guarda SIN añadir sus libros, adorno estético y
// distinciones solo si existen en el servidor (nada inventado).
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222', email: 'bruno@ejemplo.test' };
const WORK = { id: '55555555-5555-4555-8555-555555555555', kind: 'local', title: 'Circe', author: 'Madeline Miller' };
const ref = (id, title, author, extra = {}) => ({ id, title, author, cover: '', ...extra });

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

function seed({ extras = true, distinctions = true } = {}) {
  const mock = createMockSupabase();
  mock.db.works.push(WORK);
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true }, { user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'lector-farol', community_enabled: true, adornment_id: 'constelaciones' });
  mock.db.public_reviews.push({ id: '70000000-0000-4000-8000-000000000001', work_id: WORK.id, user_id: BRUNO.id, rating_quarters: 16, body: 'Las últimas cien páginas, sin respirar.', has_spoilers: false, status: 'published', published_at: new Date().toISOString() });
  mock.db.corners.push({
    user_id: BRUNO.id,
    visible: true,
    featured_books: [ref('b1', 'Cuarta ala', 'Rebecca Yarros'), ref('b2', 'El principito', 'Antoine de Saint-Exupéry'), ref('b3', 'Una vida pequeña', 'Hanya Yanagihara')],
    figure_ids: [],
    guardian_id: null,
    show_current: true,
    current_title: 'Alas de hierro',
    ...(extras
      ? {
          scene: 'lluvia',
          last_book: ref('b4', 'Circe', 'Madeline Miller'),
          next_book: ref('b2', 'El principito', 'Antoine de Saint-Exupéry'),
          signature_books: [ref('b5', 'La sombra del viento', 'Carlos Ruiz Zafón', { phrase: 'El libro que me hizo lectora' })],
          memories: [{ id: 'm1', object: 'farol', book: ref('b6', 'La isla del tesoro', 'Robert Louis Stevenson'), dedication: 'Este farol me recuerda mi primera gran aventura' }],
        }
      : {}),
  });
  if (extras) mock.db.collections.push({ id: '80000000-0000-4000-8000-000000000001', owner: BRUNO.id, title: 'Historias para días de lluvia', dedication: 'Para leer con manta', visible: true, books: [ref('c1', 'Rebeca', 'Daphne du Maurier', { phrase: 'Empieza aquí' }), ref('c2', 'La paciente silenciosa', 'Alex Michaelides'), ref('c3', 'Circe', 'Madeline Miller')] });
  if (distinctions) mock.db.distinctions.push({ id: '90000000-0000-4000-8000-000000000001', user_id: BRUNO.id, kind: 'fundadora', note: 'Comunidad fundadora', awarded_on: '2026-10-25' });
  return mock;
}

async function openBrunoProfile(page, mock) {
  await mock.attach(page, ANA);
  await page.addInitScript(`(() => { try { const st = JSON.parse(localStorage.getItem('bookshelf:v1')); if (!st) return; const b = st.books.find((x) => x.id === st.settings.currentBookId) ?? st.books.find((x) => x.status === 'reading'); b.workId = '${WORK.id}'; b.isbn = ''; localStorage.setItem('bookshelf:v1', JSON.stringify(st)); } catch (e) {} })()`);
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="book"]').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: 'Lectores' }).click();
  await page.getByLabel('Voces de lectores').getByRole('button', { name: 'Bruno', exact: true }).click();
  await expect(page.locator('.reader-profile')).toBeVisible();
}

test('rincón ilustrado: escena 3:2 entera, tres libros, recuerdo con su historia y pendientes con procedencia', async ({ page }, info) => {
  const mock = seed();
  await openBrunoProfile(page, mock);
  const scene = page.locator('.corner-scene');
  await expect(scene).toBeVisible();
  // Variante elegida (lluvia) y la escena completa: proporción 3:2, imagen sin recortar
  await expect(scene.locator('.corner-scene__base')).toHaveAttribute('src', /rincon-lluvia-768\.webp/);
  await page.waitForFunction(() => document.querySelector('.corner-scene__base')?.naturalWidth > 0);
  const geo = await scene.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const img = el.querySelector('.corner-scene__base');
    return { ratio: r.width / r.height, fit: getComputedStyle(img).objectFit, books: el.querySelectorAll('.corner-scene__shelf li').length, inside: r.left >= 0 && r.right <= innerWidth + 0.5 };
  });
  expect(Math.abs(geo.ratio - 1.5)).toBeLessThan(0.02);
  expect(geo.fit).toBe('contain');
  expect(geo.books).toBe(3);
  expect(geo.inside).toBe(true);
  // Los libros apoyan en la balda calibrada (base a 302/1024 del alto) y quedan dentro del hueco
  const shelf = await scene.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [...el.querySelectorAll('.corner-scene__book')].map((b) => {
      const s = b.getBoundingClientRect();
      return { bottom: (s.bottom - r.top) / r.height, left: (s.left - r.left) / r.width, right: (s.right - r.left) / r.width };
    });
  });
  for (const b of shelf) {
    expect(Math.abs(b.bottom - 302 / 1024)).toBeLessThan(0.01);
    expect(b.left).toBeGreaterThan(893 / 1536 - 0.005);
    expect(b.right).toBeLessThan(1472 / 1536 + 0.005);
  }
  // Nombre, avatar y botones fuera de la escena; adorno estético bajo el avatar; distinción solo si existe
  await expect(scene.getByRole('button', { name: 'Seguir' })).toHaveCount(0);
  await expect(page.locator('.huella-avatar .reader-adornment')).toHaveAttribute('data-adornment', 'constelaciones');
  await page.getByRole('button', { name: 'Comunidad fundadora' }).click();
  await expect(page.locator('.huella-badge__info')).toContainText('25 de octubre de 2026');
  // Última / actual / próxima, libros que le representan, colección y reseña destacada
  await expect(page.locator('.huella-trio')).toContainText('Circe');
  await expect(page.locator('.huella-trio')).toContainText('Alas de hierro');
  await expect(page.locator('.huella-trio')).toContainText('El principito');
  await expect(page.locator('.huella-signature')).toContainText('El libro que me hizo lectora');
  await expect(page.getByLabel('Reseña destacada')).toContainText('sin respirar');
  await shot(page, info, 'v135-rincon');
  // Abrir el recuerdo: su historia y «Añadir a pendientes» con procedencia privada
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.length);
  await page.getByRole('button', { name: /Farol de «La isla del tesoro»/ }).click();
  const sheet = page.getByRole('dialog', { name: /Recuerdo: Farol/ });
  await expect(sheet).toContainText('Este farol me recuerda mi primera gran aventura');
  await sheet.getByRole('button', { name: 'Añadir a pendientes' }).click();
  await expect(sheet).toContainText('Añadido a Pendientes');
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.find((b) => b.title === 'La isla del tesoro')))
    .toMatchObject({ status: 'want', savedFrom: { kind: 'corner', ownerAlias: 'Bruno' } });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.length)).toBe(before + 1);
  // Nada se envía a nadie: ninguna escritura en el servidor al guardar en pendientes
  expect(mock.db.follows).toEqual([]);
});

test('guardar una colección NO añade sus libros; añadir a pendientes es por libro', async ({ page }) => {
  const mock = seed();
  await openBrunoProfile(page, mock);
  const card = page.locator('.huella-collection');
  await expect(card).toContainText('Historias para días de lluvia');
  await expect(card.locator('.huella-collection__covers li')).toHaveCount(3);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.length);
  await card.getByRole('button', { name: 'Guardar colección' }).click();
  await expect(card.getByRole('button', { name: 'Guardada' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).settings.savedCollections?.[0]?.title)).toBe('Historias para días de lluvia');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.length)).toBe(before);
  await card.getByRole('button', { name: /Ver los 3 libros/ }).click();
  await card.locator('.huella-collection__books li').first().getByRole('button', { name: 'Añadir a pendientes' }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.length)).toBe(before + 1);
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.find((b) => b.title === 'Rebeca')?.savedFrom))
    .toMatchObject({ kind: 'collection', collectionTitle: 'Historias para días de lluvia' });
  // «Circe» ya está en la biblioteca de ejemplo: no se duplica
  await expect(card.locator('.huella-collection__books li').nth(2)).toContainText('Ya está en tu biblioteca');
});

test('sin la migración 1.35.0 en el servidor el perfil de siempre sigue funcionando, sin premios inventados', async ({ page }) => {
  const mock = seed({ extras: false, distinctions: false });
  await openBrunoProfile(page, mock);
  await expect(page.locator('.corner-scene')).toBeVisible();
  await expect(page.locator('.corner-scene__table li')).toHaveCount(0);
  await expect(page.locator('.huella-badge')).toHaveCount(0);
  await expect(page.locator('.huella-collection')).toHaveCount(0);
  await expect(page.locator('.huella-trio')).toContainText('Alas de hierro');
});
