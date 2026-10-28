// QA de la 1.49.0 (SPEC §47): la lectura sobre el libro pintado (sin libro superpuesto), cascos dentro del encuadre,
// «Mi biblioteca» fijado al frente de la balda sin tapar lomos e indicadores anclados a la esquina de su botón.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

async function shot(page, info, name, clip) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`), ...(clip ? { clip } : null) });
}

const portrait = (page) => page.viewportSize().width < page.viewportSize().height;
const overlap = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;

async function load(page) {
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.waitForTimeout(800);
}

test('escena: libro pintado con la lectura, cascos enteros casi del todo y cartel fijado a la balda', async ({ page }, info) => {
  test.skip(!portrait(page), 'composición de pantallas verticales');
  await load(page);
  // Un solo libro: el pintado, con la lectura en sus páginas (nada superpuesto en píxeles de pantalla)
  await expect(page.locator('.bed-book')).toHaveCount(0);
  await expect(page.locator('[data-panel="MAIN_ROOM"] .scene-world .bed-pages').first()).toBeVisible();
  // Cascos: al menos el 80 % de su silueta dentro del encuadre
  const h = await page.evaluate(async () => {
    const { HOTSPOTS } = await import('/src/scene/sceneMap.js');
    const stage = document.querySelector('[data-panel="MAIN_ROOM"] .scene-stage');
    const k = parseFloat(stage.dataset.scale);
    const ox = parseFloat(stage.dataset.offsetX);
    const xs = HOTSPOTS.headphones.shape.map(([x]) => ox + x * k);
    const min = Math.min(...xs);
    const max = Math.max(...xs);
    return (max - Math.max(0, min)) / (max - min);
  });
  expect(h).toBeGreaterThanOrEqual(0.8);
  // «Mi biblioteca»: dentro del mueble, sin rotación y sin tapar ningún lomo
  const m = await page.evaluate(async () => {
    const { HOTSPOTS } = await import('/src/scene/sceneMap.js');
    const stage = document.querySelector('[data-panel="MAIN_ROOM"] .scene-stage');
    const k = parseFloat(stage.dataset.scale);
    const ox = parseFloat(stage.dataset.offsetX);
    const sr = stage.getBoundingClientRect();
    const plaque = document.querySelector('.room-plaque[data-id="shelf"]');
    const visible = getComputedStyle(plaque, '::before');
    const r = plaque.getBoundingClientRect();
    // Papel visible (el botón es más alto para la pulsación)
    const inset = parseFloat(visible.top) || 0;
    const paper = { left: r.left, right: r.right, top: r.top + inset, bottom: r.bottom - inset };
    const spines = [...document.querySelectorAll('[data-panel="MAIN_ROOM"] .room-spine')].map((s) => s.getBoundingClientRect().toJSON());
    const shelfRight = sr.left + ox + 342 * k;
    return { paper, spines, shelfRight, transform: getComputedStyle(plaque).transform, anchorX: sr.left + ox + HOTSPOTS.shelf.plaque.x * k };
  });
  expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(m.transform);
  for (const s of m.spines) expect(overlap(m.paper, s)).toBe(false);
  expect(m.paper.right).toBeLessThanOrEqual(m.shelfRight + 2);
  await shot(page, info, 'v149-habitacion');
  const book = await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="book"]').boundingBox();
  await shot(page, info, 'v149-libro-cascos', { x: 0, y: Math.max(0, book.y - 70), width: page.viewportSize().width, height: Math.min(page.viewportSize().height - Math.max(0, book.y - 70), book.height + 90) });
  const plaque = await page.locator('.room-plaque[data-id="shelf"]').boundingBox();
  await shot(page, info, 'v149-biblioteca-anclaje', { x: 0, y: Math.max(0, plaque.y - 140), width: Math.min(page.viewportSize().width, 220), height: 220 });
});

test('indicadores: en la esquina exterior de su botón, sin pisar icono ni texto, y solo con estado real', async ({ page }, info) => {
  await load(page);
  const acc = page.getByRole('button', { name: /^Tu cuenta y copias/ });
  // Sin cuenta conectada no hay punto (no se muestra un estado ficticio)
  expect(await acc.evaluate((el) => el.hasAttribute('data-dot'))).toBe(false);
  expect(await acc.evaluate((el) => getComputedStyle(el, '::after').display)).toBe('none');
  // Con un estado real, el punto va en la esquina y no toca el icono; el nombre accesible lo explica
  await acc.evaluate((el) => {
    el.dataset.dot = '';
    el.dataset.status = 'synced';
  });
  const g = await acc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const icon = el.querySelector('svg').getBoundingClientRect();
    const a = getComputedStyle(el, '::after');
    const top = r.top + parseFloat(getComputedStyle(el).borderTopWidth) + parseFloat(a.top);
    const right = r.right - parseFloat(getComputedStyle(el).borderRightWidth) - parseFloat(a.right);
    const dot = { left: right - parseFloat(a.width), right, top, bottom: top + parseFloat(a.height) };
    return { dot, icon: icon.toJSON(), display: a.display };
  });
  expect(g.display).toBe('block');
  expect(overlap(g.dot, g.icon)).toBe(false);
  const guides = page.locator('.guides-toggle');
  const dot = guides.locator('.guides-toggle__dot');
  if (await dot.count()) {
    const d = await dot.boundingBox();
    const t = await guides.locator('span').boundingBox();
    expect(overlap({ left: d.x, right: d.x + d.width, top: d.y, bottom: d.y + d.height }, { left: t.x, right: t.x + t.width, top: t.y, bottom: t.y + t.height })).toBe(false);
    await expect(guides).toHaveAttribute('aria-label', /fuera de vista/);
  }
  const corner = await page.locator('.room-corner').boundingBox();
  await shot(page, info, 'v149-indicadores', { x: Math.max(0, corner.x - 10), y: 0, width: Math.min(page.viewportSize().width - Math.max(0, corner.x - 10), corner.width + 20), height: corner.height + 20 });
});
