// QA de la 1.52.0 (SPEC §50): una sola habitación de día y de noche. Cambiar la hora no mueve ni sustituye nada: el
// fondo, el libro, su contenido, los carteles y las zonas tocables quedan en el mismo sitio; el libro de noche sigue
// legible. Contenido del libro: «Estás leyendo», título en tres líneas como máximo, autor estable, sin «Por donde vas».
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

async function load(page, title) {
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/');
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.waitForTimeout(300);
  const seeded = await page.evaluate((t) => {
    const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
    const b = st.books.find((x) => x.title === 'Circe');
    Object.assign(b, { title: t, author: 'Suzanne Collins', pageCount: 528, currentPage: 25, trackBy: 'pages', status: 'reading' });
    st.settings.currentBookId = b.id;
    return JSON.stringify(st);
  }, title);
  await page.addInitScript((v) => {
    if (!sessionStorage.getItem('v152')) {
      localStorage.setItem('bookshelf:v1', v);
      sessionStorage.setItem('v152', '1');
    }
  }, seeded);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.waitForTimeout(600);
}

async function setTime(page, name) {
  await page.getByRole('button', { name: 'Ambiente' }).click();
  await page.getByRole('radio', { name: new RegExp(name) }).click();
  await page.getByRole('button', { name: 'Cerrar Ambiente' }).click();
  await page.waitForTimeout(400);
}

const layout = (page) =>
  page.evaluate(() => {
    const r = (sel) => {
      const el = document.querySelector(`[data-panel="MAIN_ROOM"] ${sel}`);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return [b.left, b.top, b.width, b.height].map((n) => Math.round(n));
    };
    return {
      base: document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.getAttribute('src'),
      left: r('.bed-pages__page--left'),
      right: r('.bed-pages__page--right'),
      title: r('.bed-pages__title'),
      author: r('.bed-pages__author'),
      hit: r('.bed-pages__hit'),
      shelf: r('.room-plaque[data-id="shelf"]'),
      diary: r('.room-plaque[data-id="diary"]'),
      book: r('.hotspot[data-id="book"]'),
      spines: document.querySelectorAll('[data-panel="MAIN_ROOM"] .room-spine').length,
    };
  });

test('día y noche: la misma habitación, nada se mueve al cambiar de hora', async ({ page }, info) => {
  await load(page, 'The Ballad of Songbirds and Snakes');
  await setTime(page, 'Mañana');
  const day = await layout(page);
  await shot(page, info, 'v152-dia');
  await setTime(page, 'Noche');
  await expect(page.locator('.tod')).toHaveAttribute('data-tod', 'night');
  const night = await layout(page);
  await shot(page, info, 'v152-noche');
  expect(night).toEqual(day);
  // Un solo libro y sin texto pintado debajo: solo hay una capa de páginas visible
  await expect(page.locator('[data-panel="MAIN_ROOM"] .bed-pages:not(.bed-pages--actions)')).toHaveCount(1);
  // De noche el libro se lee: el velo se aclara sobre él
  const mask = await page.locator('.tod__night').evaluate((el) => getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage);
  expect(mask).toContain('radial-gradient');
});

test('libro: «Estás leyendo», sin «Por donde vas», autor estable con títulos corto y largo', async ({ page }) => {
  await load(page, 'Circe');
  const pages = page.locator('[data-panel="MAIN_ROOM"] .bed-pages').first();
  await expect(pages.locator('.bed-pages__kicker')).toHaveText('Estás leyendo');
  await expect(pages).not.toContainText('Por donde vas');
  await expect(pages.locator('.bed-pages__progress')).toHaveText('Página 25');
  const short = await layout(page);
  await page.evaluate(() => sessionStorage.removeItem('v152'));
  await load(page, 'Harry Potter y la piedra filosofal: edición ilustrada del vigésimo aniversario');
  const long = await layout(page);
  // El autor y el botón no se mueven aunque el título sea mucho más largo
  expect(long.author).toEqual(short.author);
  expect(long.hit).toEqual(short.hit);
  const t = await page.locator('[data-panel="MAIN_ROOM"] .bed-pages__title').first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return { lines: Math.round(el.clientHeight / parseFloat(cs.lineHeight)), size: parseFloat(cs.fontSize), hyphens: cs.hyphens };
  });
  expect(t.lines).toBeLessThanOrEqual(3);
  expect(t.size).toBeGreaterThanOrEqual(24);
  expect(t.hyphens).toBe('manual');
  // El botón tiene zona táctil suficiente
  const hit = await page.locator('[data-panel="MAIN_ROOM"] .bed-pages__hit').boundingBox();
  if (hit) expect(hit.height).toBeGreaterThanOrEqual(43);
});
