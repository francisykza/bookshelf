// QA de la 1.51.0 (SPEC §49): habitación nocturna de la maqueta con su propio mapa. Un solo libro (el recurso con la
// lectura real), carteles fijados a su soporte, cascos, vela y lámpara tocables, té en «Guías» y la escena de día
// intacta a mediodía. Las pruebas fijan el reloj a mediodía (playwright.config.js): la noche se elige a mano.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')));

async function loadNight(page, patch = {}) {
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/');
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.waitForTimeout(300);
  const seeded = await page.evaluate((p) => {
    const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
    const b = st.books.find((x) => x.title === 'Circe');
    Object.assign(b, { title: 'Balada de pájaros cantores y serpientes', author: 'Suzanne Collins', pageCount: 528, currentPage: 25, trackBy: 'pages', status: 'reading' }, p);
    st.settings.currentBookId = b.id;
    st.settings.timeOfDay = 'night';
    st.settings.timeAuto = false;
    return JSON.stringify(st);
  }, patch);
  await page.addInitScript((v) => {
    if (!sessionStorage.getItem('v151')) {
      localStorage.setItem('bookshelf:v1', v);
      sessionStorage.setItem('v151', '1');
    }
  }, seeded);
  await page.reload();
  // Al cargar, la hora sale del reloj (aquí, mediodía): la noche se elige en «Ambiente», como haría el usuario
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.getByRole('button', { name: 'Ambiente' }).click();
  await page.getByRole('radio', { name: /Noche/ }).click();
  await page.getByRole('button', { name: 'Cerrar Ambiente' }).click();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .night-room .scene-base')?.naturalWidth > 0);
  await page.waitForFunction(() => [...document.querySelectorAll('[data-panel="MAIN_ROOM"] img')].every((i) => i.complete));
  await page.waitForTimeout(400);
}

test('noche: ilustración nocturna, un solo libro con la lectura real y sin duplicados', async ({ page }, info) => {
  await loadNight(page);
  const room = page.locator('[data-panel="MAIN_ROOM"]');
  await expect(room.locator('.night-room')).toHaveCount(1);
  await expect(room.locator('.scene-base')).toHaveAttribute('src', /dormitorio-noche/);
  // Ni el cuarto de día ni el libro pintado de día: un único libro (el recurso)
  await expect(room.locator('.bed-pages, .bed-book, .room-spine, .room-figure')).toHaveCount(0);
  await expect(room.locator('.night-book__art')).toHaveCount(1);
  await expect(room.locator('.night-page__kicker')).toHaveText('Estás leyendo');
  await expect(room.locator('.night-page__title')).toHaveText('Balada de pájaros cantores y serpientes');
  await expect(room.locator('.night-page__author')).toHaveText('Suzanne Collins');
  await expect(room.locator('.night-page__progress')).toHaveText('Página 25');
  await expect(room.locator('.night-page__secondary')).toHaveText(/^de 528 · 4,7\s%$/);
  const fill = await room.locator('.night-page__meter i').evaluate((el) => el.style.width);
  expect(parseFloat(fill)).toBeCloseTo((25 / 528) * 100, 1);
  // Título completo en varias líneas, sin cortes
  // (con interlineado < 1 los descendentes sobresalen unos px: no es un corte)
  const t = await room.locator('.night-page__title').evaluate((el) => ({ cut: el.scrollHeight > el.clientHeight + parseFloat(getComputedStyle(el).fontSize) * 0.4 || el.scrollWidth > el.clientWidth + 1 }));
  expect(t.cut).toBe(false);
  // Carteles: uno de cada (biblioteca y diario en la escena, «Social» en la interfaz)
  await expect(room.locator('.room-plaque[data-id="shelf"]')).toHaveCount(1);
  await expect(room.locator('.room-plaque[data-id="diary"]')).toHaveCount(1);
  await expect(page.locator('.panorama-nav__btn--next')).toHaveCount(1);
  // Sin título de la pantalla visible
  expect((await page.locator('.room-header').boundingBox())?.width ?? 0).toBeLessThanOrEqual(1);
  await shot(page, info, 'v151-noche');
});

test('noche: registrar lectura, ficha, biblioteca, diario y cascos funcionan', async ({ page }) => {
  test.skip(page.viewportSize().width > page.viewportSize().height, 'composición vertical');
  await loadNight(page);
  const btn = page.getByRole('button', { name: 'Registrar lectura de Balada de pájaros cantores y serpientes' });
  const box = await btn.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(30);
  await btn.click();
  await expect(page.locator('.panel--log')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.panel--log')).toHaveCount(0);
  // Página izquierda, lejos del texto y del botón
  const open = page.locator('[data-panel="MAIN_ROOM"] .night-book__open');
  const ob = await open.boundingBox();
  await page.mouse.click(ob.x + ob.width * 0.22, ob.y + ob.height * 0.72);
  await expect(page.locator('.book-sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('[data-panel="MAIN_ROOM"] .room-plaque[data-id="shelf"]').click();
  await expect(page.locator('.library[data-open="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Volver a la cama' }).click();
  await expect(page.locator('.library[data-open="true"]')).toHaveCount(0);
  await page.locator('[data-panel="MAIN_ROOM"] .room-plaque[data-id="diary"]').click();
  await expect(page.locator('.pc')).toBeVisible();
  await page.keyboard.press('Escape');
  // Cascos: el toque llega a su control (que arranca o silencia el ambiente según si ya sonaba)
  const phones = page.locator('[data-panel="MAIN_ROOM"] .night-spot[data-id="headphones"]');
  await phones.evaluate((el) => el.addEventListener('click', () => (window.__phones = true), { once: true }));
  await phones.click();
  expect(await page.evaluate(() => window.__phones)).toBe(true);
  await expect(phones).toHaveAttribute('aria-label', /sonido ambiental/);
});

test('noche: el té está en «Guías» sin punto de aviso y la lámpara apagada oscurece solo su luz', async ({ page }) => {
  await loadNight(page);
  // En vertical no se recorta nada que exista: sin punto (en escritorio sí, por la estantería y la lámpara)
  if (page.viewportSize().width < page.viewportSize().height) await expect(page.locator('.guides-toggle__dot')).toHaveCount(0);
  await page.locator('.guides-toggle').click();
  await expect(page.locator('.guides-menu__list').getByRole('button', { name: /Té helado/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.night-lights__off')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ambiente' }).click();
  await page.getByRole('switch', { name: 'Lámpara de latón' }).click();
  await page.getByRole('button', { name: 'Cerrar Ambiente' }).click();
  await expect(page.locator('.night-lights__off')).toHaveCount(1);
});

test('noche → mañana: vuelve la escena de día con su libro pintado', async ({ page }) => {
  await loadNight(page);
  await page.getByRole('button', { name: 'Ambiente' }).click();
  await page.getByRole('radio', { name: /Mañana/ }).click();
  await page.getByRole('button', { name: 'Cerrar Ambiente' }).click();
  await expect(page.locator('[data-panel="MAIN_ROOM"] .night-room')).toHaveCount(0);
  await expect(page.locator('[data-panel="MAIN_ROOM"] .bed-pages').first()).toBeVisible();
});
