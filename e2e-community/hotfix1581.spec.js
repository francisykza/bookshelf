// QA de la 1.58.1 (auditoría del vídeo, docs/qa/video-hotfix.md · FIX 7): en «Voces de lectores» el alias se lee
// entero aunque sea largo (sin «book…») y la fecha no se parte en varias líneas; las estrellas y el menú de opciones no
// le quitan el sitio. Pantallas estrechas en Chromium y WebKit. Sin datos personales.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const LONG = { id: '22222222-2222-4222-8222-222222222222', alias: 'bookcharacter_de_las_mareas_lentas' };
const SHORT = { id: '33333333-3333-4333-8333-333333333333', alias: 'Master' };
const WORK = { id: '44444444-4444-4444-8444-444444444444', kind: 'local', title: 'Circe', author: 'Madeline Miller' };

test('reseñas: alias largo completo y fecha en una línea, con estrellas y menú', async ({ page }, info) => {
  test.skip(!/320x640|390x844/.test(info.project.name), 'pantallas estrechas en Chromium y WebKit');
  const mock = createMockSupabase();
  mock.db.works.push(WORK);
  mock.db.profiles.push(
    { user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true },
    { user_id: LONG.id, alias: LONG.alias, avatar_id: 'lector-farol', community_enabled: true },
    { user_id: SHORT.id, alias: SHORT.alias, avatar_id: 'gato-lector', community_enabled: true },
  );
  const at = '2026-10-25T10:00:00.000Z';
  mock.db.public_reviews.push(
    { id: '50000000-0000-4000-8000-000000000001', work_id: WORK.id, user_id: SHORT.id, rating_quarters: 16, body: 'Creo que siento la idea', has_spoilers: false, status: 'published', published_at: at },
    { id: '50000000-0000-4000-8000-000000000002', work_id: WORK.id, user_id: LONG.id, rating_quarters: 16, body: 'Un libro muy entretenido y fiel a la peli', has_spoilers: false, status: 'published', published_at: at },
  );
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
  const cards = page.getByLabel('Voces de lectores').locator('.review-card');
  await expect(cards).toHaveCount(2);
  for (const alias of [LONG.alias, SHORT.alias]) {
    const card = cards.filter({ hasText: alias });
    await card.scrollIntoViewIfNeeded();
    const m = await card.evaluate((el) => {
      const name = el.querySelector('.review-card__author, .review-card__who b');
      const date = el.querySelector('.review-card__who small');
      const lh = parseFloat(getComputedStyle(date).lineHeight) || parseFloat(getComputedStyle(date).fontSize) * 1.3;
      const stars = el.querySelector('.rating-stars')?.getBoundingClientRect();
      const nb = name.getBoundingClientRect();
      return {
        text: name.textContent,
        clipped: name.scrollWidth > name.clientWidth + 1 || getComputedStyle(name).textOverflow === 'ellipsis',
        dateLines: Math.round(date.getBoundingClientRect().height / lh),
        overlap: stars ? !(stars.right <= nb.left || stars.left >= nb.right || stars.bottom <= nb.top || stars.top >= nb.bottom) : false,
        fontSize: parseFloat(getComputedStyle(name).fontSize),
      };
    });
    expect(m.text).toBe(alias);
    expect(m.clipped).toBe(false);
    expect(m.dateLines).toBe(1);
    expect(m.overlap).toBe(false);
    expect(m.fontSize).toBeGreaterThanOrEqual(14);
  }
  // El menú de opciones de la reseña ajena sigue a mano
  await expect(cards.filter({ hasText: LONG.alias }).getByRole('button', { name: `Opciones de la reseña de ${LONG.alias}` })).toBeVisible();
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await cards.filter({ hasText: LONG.alias }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(dir, 'v1581-resenas.png') });
});
