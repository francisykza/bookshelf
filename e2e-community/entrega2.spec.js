// Entrega 2 · interfaz (SPEC §25.15): perfil y avatar, publicación explícita con previsualización, Voces de
// lectores, retirar y spoilers plegados, con una sesión iniciada contra el simulador de Supabase.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222', email: 'bruno@ejemplo.test' };

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

async function ready(page) {
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
}

async function openProfile(page) {
  // Tras recargar, la navegación puede haber restaurado ya el panel abierto
  // (el panel se carga bajo demanda: se le da un momento antes de decidir)
  const restored = await page
    .locator('.social-hub')
    .waitFor({ timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (restored) return;
  await page.getByRole('button', { name: 'Tu cuenta y copias de tus datos' }).click();
  await page.getByRole('button', { name: 'Abrir mi perfil' }).click();
  await expect(page.getByRole('tab', { name: 'Mi Perfil & Avatar' })).toBeVisible();
}

async function saveProfile(page, alias, avatarLabel) {
  await page.getByLabel('Alias público').fill(alias);
  await page.getByRole('radio', { name: avatarLabel }).click();
  await page.getByRole('checkbox', { name: /Participar en la comunidad/ }).check();
  await page.getByRole('button', { name: 'Guardar perfil' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Guardado.' })).toBeVisible();
}

/** Abre la ficha del libro actual desde la habitación. */
async function openCurrentBook(page) {
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="book"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.open-book')).toBeVisible();
}

test('perfil: alias elegido y avatar; nunca el correo; persiste al recargar', async ({ page }, info) => {
  const mock = createMockSupabase();
  await mock.attach(page, ANA);
  await ready(page);
  await openProfile(page);
  // Sin perfil aún: el alias está vacío (no se rellena con el correo)
  await expect(page.getByLabel('Alias público')).toHaveValue('');
  await expect(page.locator('.social-hub')).not.toContainText(ANA.email);
  await saveProfile(page, 'Ana lectora', 'Gato lector');
  expect(mock.db.profiles).toEqual([expect.objectContaining({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true })]);
  await shot(page, info, 'perfil');
  // Recargar: el perfil viene del servidor
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await openProfile(page);
  await expect(page.getByLabel('Alias público')).toHaveValue('Ana lectora');
  await expect(page.getByRole('radio', { name: 'Gato lector' })).toHaveAttribute('aria-checked', 'true');
  // Un solo scroll y controles táctiles de 44 px
  const geometry = await page.evaluate(() => {
    const hub = document.querySelector('.social-hub');
    const body = document.querySelector('.social-hub__body');
    const small = [...hub.querySelectorAll('button, input')].filter((el) => el.offsetParent && el.getBoundingClientRect().height < 43.5 && el.type !== 'checkbox').map((el) => el.textContent || el.getAttribute('aria-label'));
    return { scrollers: [...hub.querySelectorAll('*')].filter((el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight).length, bodyScrolls: getComputedStyle(body).overflowY, small, inputFont: getComputedStyle(document.querySelector('#profile-alias')).fontSize, hOverflow: document.documentElement.scrollWidth > innerWidth };
  });
  expect(geometry.scrollers).toBeLessThanOrEqual(1);
  expect(geometry.small.filter((t) => t !== '×')).toEqual([]);
  expect(geometry.inputFont).toBe('16px');
  expect(geometry.hOverflow).toBe(false);
});

test('publicar: previsualización con solo los campos visibles, Voces de lectores y retirar', async ({ page }, info) => {
  const mock = createMockSupabase();
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  await mock.attach(page, ANA);
  await ready(page);
  await openCurrentBook(page);
  const diaryTab = page.getByRole('tab', { name: 'Diario' });
  if (await diaryTab.isVisible()) await diaryTab.click();
  await page.getByLabel('Tu reseña').fill('Una historia que se lee como un susurro.');
  await page.getByLabel('Tu reseña').blur();
  // Guardar no publica nada
  await page.waitForTimeout(800);
  expect(mock.db.public_reviews).toEqual([]);
  await page.getByRole('checkbox', { name: 'Contiene spoilers' }).check();
  await page.getByRole('button', { name: 'Publicar en mi rincón' }).click();
  const preview = page.getByLabel('Lo que verán otras personas');
  await expect(preview).toContainText('Ana lectora');
  await expect(preview).toContainText('Una historia que se lee como un susurro.');
  await expect(preview).toContainText('Sí: se mostrará plegada');
  await shot(page, info, 'previsualizacion');
  await preview.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByText('Publicada en tu rincón')).toBeVisible();
  expect(mock.db.public_reviews).toHaveLength(1);
  // Solo los campos de la copia pública (nada de citas, páginas ni estado del libro)
  expect(Object.keys(mock.db.public_reviews[0]).sort()).toEqual(['body', 'emotion', 'has_spoilers', 'id', 'pace', 'published_at', 'rating_quarters', 'romance', 'status', 'surprise', 'updated_at', 'user_id', 'work_id']);
  expect(mock.db.works).toEqual([expect.objectContaining({ kind: 'local' })]);
  // Lectores: la propia opinión con alias y avatar, spoiler plegado
  await page.getByRole('tab', { name: 'Lectores' }).click();
  const readers = page.getByLabel('Voces de lectores');
  await expect(readers.locator('.review-card')).toHaveCount(1);
  await expect(readers.locator('.review-card')).toContainText('Ana lectora');
  await expect(readers.locator('.review-card .reader-avatar img')).toHaveAttribute('src', /\/avatars\/gato-lector\.webp$/);
  await expect(readers.locator('.review-card')).not.toContainText('susurro');
  await expect(readers.getByRole('button', { name: /Contiene spoilers/ })).toBeVisible();
  await shot(page, info, 'lectores');
  // Retirar: deja de aparecer (el borrador privado sigue)
  await page.getByRole('tab', { name: 'Lectores' }).click();
  if (await diaryTab.isVisible()) await diaryTab.click();
  await page.getByRole('button', { name: 'Retirar publicación' }).click();
  await expect(page.getByText('Retiraste la publicación')).toBeVisible();
  expect(mock.db.public_reviews[0].status).toBe('withdrawn');
  await expect(page.getByLabel('Tu reseña')).toHaveValue('Una historia que se lee como un susurro.');
  await page.getByRole('tab', { name: 'Lectores' }).click();
  await expect(page.getByLabel('Voces de lectores').locator('.review-card')).toHaveCount(0);
  await expect(page.getByLabel('Voces de lectores')).toContainText('Esta historia todavía espera su primera opinión');
});

test('cambiar el avatar actualiza las reseñas sin tocar libros ni opiniones', async ({ browser }) => {
  const mock = createMockSupabase();
  const work = { id: '33333333-3333-4333-8333-333333333333', kind: 'local', title: 'Circe', author: 'Madeline Miller' };
  mock.db.works.push(work);
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true }, { user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'lector-farol', community_enabled: true });
  mock.db.public_reviews.push({ id: '44444444-4444-4444-8444-444444444444', work_id: work.id, user_id: BRUNO.id, rating_quarters: 15, body: 'Muy buena', has_spoilers: false, status: 'published', published_at: new Date().toISOString() });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await mock.attach(page, ANA);
  // El libro actual de Ana apunta a la misma obra (como tras publicar)
  await page.addInitScript(`(() => { try { const st = JSON.parse(localStorage.getItem('bookshelf:v1')); if (!st) return; const b = st.books.find((x) => x.id === st.settings.currentBookId) ?? st.books.find((x) => x.status === 'reading'); b.workId = '${work.id}'; localStorage.setItem('bookshelf:v1', JSON.stringify(st)); } catch (e) {} })()`);
  await ready(page);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await openCurrentBook(page);
  await page.getByRole('tab', { name: 'Lectores' }).click();
  const card = page.getByLabel('Voces de lectores').locator('.review-card');
  await expect(card).toContainText('Bruno');
  await expect(card.locator('.reader-avatar img')).toHaveAttribute('src', /lector-farol\.webp$/);
  await expect(page.getByLabel('Voces de lectores')).toContainText('Primeras valoraciones: 1 lector');
  await expect(page.locator('.readers__average')).toHaveText('3,8');
  const before = JSON.stringify(mock.db.public_reviews);
  // Bruno cambia de avatar (otro dispositivo): al volver a abrir Lectores, su reseña lo refleja
  mock.db.profiles.find((p) => p.user_id === BRUNO.id).avatar_id = 'vidente-estrellas';
  await page.keyboard.press('Escape');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await openCurrentBook(page);
  await page.getByRole('tab', { name: 'Lectores' }).click();
  await expect(page.getByLabel('Voces de lectores').locator('.review-card .reader-avatar img')).toHaveAttribute('src', /vidente-estrellas\.webp$/);
  expect(JSON.stringify(mock.db.public_reviews)).toBe(before);
  await ctx.close();
});

test('sin la migración social en el servidor: aviso claro y la biblioteca sigue igual', async ({ page }) => {
  const mock = createMockSupabase();
  await mock.attach(page, ANA);
  // El servidor aún no tiene las tablas sociales
  await page.route('http://supabase.test/rest/v1/profiles**', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.profiles'" }) }));
  await ready(page);
  await openProfile(page);
  await expect(page.locator('.social-hub')).toContainText('La comunidad aún no está disponible en este servidor');
  await page.keyboard.press('Escape');
  // La biblioteca sigue funcionando
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="shelf"]').evaluate((el) => el.click());
  await expect(page.locator('.library[data-open="true"]')).toBeVisible();
  expect(await page.locator('.library [data-book-id]').count()).toBeGreaterThan(0);
});

test('cambiar de cuenta no deja ver el perfil ni la caché social de la anterior', async ({ page }) => {
  const mock = createMockSupabase();
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  await mock.attach(page, ANA);
  await ready(page);
  await openProfile(page);
  await expect(page.getByLabel('Alias público')).toHaveValue('Ana lectora');
  await page.keyboard.press('Escape');
  // Otra persona inicia sesión en el mismo navegador (otra sesión guardada y el simulador con su identidad)
  await page.unroute('http://supabase.test/**');
  await createMockSupabase(mock.db).attach(page, BRUNO);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await openProfile(page);
  await expect(page.getByLabel('Alias público')).toHaveValue('');
  await expect(page.locator('.social-hub')).not.toContainText('Ana lectora');
});
