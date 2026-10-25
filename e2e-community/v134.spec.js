// QA de la 1.34.0 (SPEC §27.8): Voces de lectores como cartas. Cabecera con la media y estrella, desglose e
// impresiones dentro de «Cómo se ha sentido esta lectura», cartas en nueve cortes sin giro y de altura natural,
// spoilers plegados. Con una sesión iniciada contra el simulador de Supabase.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222', email: 'bruno@ejemplo.test' };
const CARMEN = { id: '33333333-3333-4333-8333-333333333334', email: 'carmen@ejemplo.test' };
const WORK = { id: '55555555-5555-4555-8555-555555555555', kind: 'local', title: 'Circe', author: 'Madeline Miller' };
const LONG = 'Una lectura que se queda contigo durante días. '.repeat(14).trim();

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

/** Abre «Lectores» de la lectura actual, enlazada a la obra sembrada. */
async function openReaders(page, mock) {
  await mock.attach(page, ANA);
  await page.addInitScript(`(() => { try { const st = JSON.parse(localStorage.getItem('bookshelf:v1')); if (!st) return; const b = st.books.find((x) => x.id === st.settings.currentBookId) ?? st.books.find((x) => x.status === 'reading'); b.workId = '${WORK.id}'; localStorage.setItem('bookshelf:v1', JSON.stringify(st)); } catch (e) {} })()`);
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="book"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.book-sheet')).toBeVisible();
  await page.getByRole('tab', { name: 'Lectores' }).click();
  return page.getByLabel('Voces de lectores');
}

test('cartas: media con estrella, «Cómo se ha sentido esta lectura» y cartas en nueve cortes', async ({ page }, info) => {
  const mock = createMockSupabase();
  mock.db.works.push(WORK);
  mock.db.profiles.push(
    { user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true },
    { user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'lector-farol', community_enabled: true },
    { user_id: CARMEN.id, alias: 'Carmen', avatar_id: 'vidente-estrellas', community_enabled: true },
  );
  const at = (h) => new Date(Date.now() - h * 3600e3).toISOString();
  mock.db.public_reviews.push(
    { id: '70000000-0000-4000-8000-000000000001', work_id: WORK.id, user_id: BRUNO.id, rating_quarters: 15, body: 'Breve y bonita.', has_spoilers: false, pace: 2, emotion: 5, status: 'published', published_at: at(1) },
    { id: '70000000-0000-4000-8000-000000000002', work_id: WORK.id, user_id: CARMEN.id, rating_quarters: 18, body: LONG, has_spoilers: false, pace: 3, emotion: 4, status: 'published', published_at: at(2) },
    { id: '70000000-0000-4000-8000-000000000003', work_id: WORK.id, user_id: ANA.id, rating_quarters: 12, body: 'Al final muere el monstruo.', has_spoilers: true, status: 'published', published_at: at(3) },
  );
  const readers = await openReaders(page, mock);
  const cards = readers.locator('.review-card');
  await expect(cards).toHaveCount(3);
  // Cabecera: media a un decimal con estrella
  await expect(page.locator('.readers__average')).toHaveText('3,8');
  await expect(page.locator('.readers__average svg')).toHaveCount(1);
  // Desglose e impresiones, plegados y con nombre, valor, extremos y respuestas
  const feel = readers.locator('.readers__feel');
  await expect(feel.locator('summary')).toHaveText('Cómo se ha sentido esta lectura');
  await feel.locator('summary').click();
  await expect(feel).toContainText('Emoción');
  await expect(feel).toContainText('4,5 de 5');
  await expect(feel).toContainText('Serena');
  await expect(feel).toContainText('Muy emotiva');
  await expect(feel).toContainText('2 respuestas');
  // Carta: nine-slice con el papel de carta, sin estirar el fondo, sin giro, altura natural
  const style = await cards.first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return { source: cs.borderImageSource, slice: cs.borderImageSlice, bgSize: cs.backgroundSize, transform: cs.transform, rotate: cs.rotate, height: cs.height, border: cs.borderTopWidth };
  });
  expect(style.source).toContain('/art/library-refresh/letter.webp');
  expect(style.slice).toContain('fill');
  expect(style.bgSize).not.toBe('100% 100%');
  expect(style.transform).toBe('none');
  expect(['none', '0deg']).toContain(style.rotate);
  expect(parseFloat(style.border)).toBe(info.project.name.includes('1440') ? 24 : 18);
  // La larga crece con su texto; la del spoiler queda plegada
  const heights = await cards.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  expect(heights[1]).toBeGreaterThan(heights[0] + 40);
  await expect(cards.nth(2)).not.toContainText('muere');
  await expect(cards.nth(2).getByRole('button', { name: /Contiene spoilers/ })).toBeVisible();
  // Sin scroll horizontal en la hoja
  const overflow = await page.locator('.book-sheet__scroll').evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await shot(page, info, 'v134-cartas');
});

test('una sola valoración: «Una primera voz para esta historia»', async ({ page }) => {
  const mock = createMockSupabase();
  mock.db.works.push(WORK);
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true }, { user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'lector-farol', community_enabled: true });
  mock.db.public_reviews.push({ id: '70000000-0000-4000-8000-000000000009', work_id: WORK.id, user_id: BRUNO.id, rating_quarters: 16, body: 'Muy fiel', has_spoilers: false, status: 'published', published_at: new Date().toISOString() });
  const readers = await openReaders(page, mock);
  await expect(readers).toContainText('Una primera voz para esta historia');
  await expect(page.locator('.readers__average')).toHaveText('4,0');
});
