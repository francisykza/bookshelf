// QA de los Anexos A y B (SPEC §16): veleros de la bahía en ambas habitaciones y guía diegética de primera
// visita (Fase 1). Perfil vacío en cada prueba; telemetría en `qa-report/telemetry/<proyecto>-anexos.json`.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const run = { project: '', tests: {}, console: [], pageErrors: [], boats: {}, guide: {}, screenshots: [] };
const DONE = 'bookshelf_onboarding_done';

test.beforeEach(async ({ page }, info) => {
  run.project = info.project.name;
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/502|Failed to load resource/.test(msg.text())) run.console.push({ test: info.title, text: msg.text() });
  });
  page.on('pageerror', (err) => run.pageErrors.push({ test: info.title, text: String(err) }));
});

test.afterEach(async ({ page: _page }, info) => {
  run.tests[info.title] = { status: info.status, error: info.error?.message?.split('\n')[0] ?? null };
});

test.afterAll(async ({ browserName: _b }, info) => {
  const dir = join('qa-report', 'telemetry');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${run.project}-anexos-w${info.workerIndex}.json`), JSON.stringify(run, null, 2));
});

async function shot(page, info, name, clip) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.png`);
  await page.screenshot({ path: file, clip });
  run.screenshots.push(file.replaceAll('\\', '/'));
}

const reduced = (info) => info.project.name.includes('reduced');
const settle = (page, info) => page.waitForTimeout(reduced(info) ? 150 : 950);
const markDone = (page) =>
  page.addInitScript((key) => {
    try {
      localStorage.setItem(key, 'true');
    } catch {
      // sin almacenamiento
    }
  }, DONE);
const loaded = (page) => page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);

/** Barcos de la habitación visible: posición del casco en coordenadas de imagen y si está sobre el agua. */
async function boats(page, roomId) {
  return page.evaluate(async (id) => {
    const { ROOMS } = await import('/src/scene/sceneMap.js');
    const { insidePolygon } = await import('/src/scene/sea.js');
    const panel = document.querySelector(`.panorama-panel[data-panel="${id}"]`);
    const stage = panel.querySelector('.scene-stage');
    const bay = panel.querySelector('.bay');
    const pr = panel.getBoundingClientRect();
    const scale = Number(stage.dataset.scale);
    const ox = Number(stage.dataset.offsetX);
    const oy = Number(stage.dataset.offsetY);
    const list = [...bay.querySelectorAll('.sailboat')].map((el) => {
      const r = el.querySelector('.sailboat__art').getBoundingClientRect();
      const toImg = (x, y) => [(x - pr.x - ox) / scale, (y - pr.y - oy) / scale];
      const hull = toImg(r.x + r.width / 2, r.bottom - r.height * 0.1);
      const sail = toImg(r.x + r.width / 2, r.y + r.height * 0.1);
      const inWater = (pt) => ROOMS[id].sea.water.some((poly) => insidePolygon(pt, poly));
      const cs = getComputedStyle(el);
      return { hull: hull.map(Math.round), sail: sail.map(Math.round), hullInWater: inWater(hull), sailInWater: inWater(sail), cssWidth: +r.width.toFixed(1), anim: cs.animationName, state: cs.animationPlayState };
    });
    const bcs = getComputedStyle(bay);
    return { running: bay.hasAttribute('data-running'), clip: bcs.clipPath.slice(0, 12), pointerEvents: bcs.pointerEvents, list, rect: bay.getBoundingClientRect().toJSON() };
  }, roomId);
}

test('A · veleros sobre el agua, recortados, en pausa fuera de pantalla y sin robar gestos', async ({ page }, info) => {
  await markDone(page);
  await page.goto('/');
  await loaded(page);
  await page.waitForTimeout(500);
  const main = await boats(page, 'MAIN_ROOM');
  run.boats.main = main;
  expect(main.list).toHaveLength(2);
  expect(main.clip).toMatch(/^path\(/);
  expect(main.pointerEvents).toBe('none');
  for (const b of main.list) {
    expect.soft(b.hullInWater, `casco ${b.hull}`).toBe(true);
    expect.soft(b.sailInWater, `vela ${b.sail}`).toBe(true);
  }
  if (reduced(info)) expect(main.list.every((b) => b.anim === 'none')).toBe(true);
  else {
    expect(main.running).toBe(true);
    expect(main.list.every((b) => b.state === 'running')).toBe(true);
  }
  // El salón, fuera de pantalla: sus barcos están en pausa
  await page.waitForFunction(() => document.querySelector('[data-panel="SOCIAL_ROOM"] .bay'));
  const hidden = await boats(page, 'SOCIAL_ROOM');
  expect(hidden.running).toBe(false);
  // Zoom de la bahía principal para la revisión visual
  const vp = page.viewportSize();
  const r = main.rect;
  const clip = { x: Math.max(0, r.x + (r.width * 760) / 941 - 10), y: Math.max(0, r.y + (r.height * 610) / 1672), width: 0, height: 0 };
  clip.width = Math.min(vp.width - clip.x, (r.width * 140) / 941);
  clip.height = Math.min(vp.height - clip.y, (r.height * 290) / 1672);
  if (clip.width > 20 && clip.height > 20) await shot(page, info, 'bahia-main', clip);

  // Un swipe que empieza encima de un barco cambia de habitación (los barcos no interceptan el gesto)
  // (en horizontal la bahía queda fuera del encuadre: entonces el gesto empieza en el centro)
  const boat = await page.locator('[data-panel="MAIN_ROOM"] .sailboat__art').first().boundingBox();
  const onScreen = boat && boat.x > 140 && boat.x < vp.width - 30 && boat.y > 60 && boat.y < vp.height - 60;
  run.boats.swipeFromBoat = Boolean(onScreen);
  const from = onScreen ? { x: boat.x + boat.width / 2, y: boat.y + boat.height / 2 } : { x: vp.width / 2, y: vp.height * 0.45 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x - 130, from.y, { steps: 6 });
  await page.mouse.up();
  await settle(page, info);
  await expect(page.locator('.panorama-track')).toHaveAttribute('data-room', 'SOCIAL_ROOM');
  const social = await boats(page, 'SOCIAL_ROOM');
  run.boats.social = social;
  expect(social.list).toHaveLength(2);
  for (const b of social.list) {
    expect.soft(b.hullInWater, `casco ${b.hull}`).toBe(true);
    expect.soft(b.sailInWater, `vela ${b.sail}`).toBe(true);
  }
  if (!reduced(info)) expect(social.running).toBe(true);
  const mainAfter = await boats(page, 'MAIN_ROOM');
  expect(mainAfter.running).toBe(false);
  await shot(page, info, 'social-veleros');
});

/** La tarjeta de la guía y la luciérnaga, con su posición respecto al viewport. */
async function card(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.onboarding-card');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const f = document.querySelector('.firefly')?.getBoundingClientRect();
    return {
      count: document.querySelectorAll('.onboarding-card').length,
      state: document.querySelector('.onboarding')?.dataset.state,
      title: el.querySelector('h2')?.textContent,
      inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      firefly: f ? { x: Math.round(f.x + f.width / 2), y: Math.round(f.y + f.height / 2) } : null,
      focus: document.activeElement?.textContent,
      buttons: [...el.querySelectorAll('button')].map((b) => {
        const q = b.getBoundingClientRect();
        return { text: b.textContent, w: Math.round(q.width), h: Math.round(q.height) };
      }),
    };
  });
}

test('B · primera visita: carta, dos paradas, final y visita posterior sin guía', async ({ page }, info) => {
  await page.goto('/');
  await loaded(page);
  await expect(page.locator('.onboarding-card')).toBeVisible();
  let c = await card(page);
  run.guide.welcome = c;
  expect(c.count).toBe(1);
  expect(c.state).toBe('welcome');
  expect(c.inside).toBe(true);
  expect(c.focus).toBe('Descubrir mi habitación');
  for (const b of c.buttons) expect(b.h).toBeGreaterThanOrEqual(44);
  await expect(page.locator('.onboarding-card')).toContainText('Bienvenido a tu refugio de lectura');
  await page.waitForTimeout(400);
  await shot(page, info, 'guia-bienvenida');
  // La guía bloquea el panorama
  await expect(page.locator('.panorama-nav')).toHaveCount(0);

  await page.keyboard.press('Enter');
  await expect(page.locator('.onboarding')).toHaveAttribute('data-state', 'reading');
  await page.waitForTimeout(reduced(info) ? 100 : 800);
  c = await card(page);
  run.guide.reading = c;
  expect(c.inside).toBe(true);
  expect(c.count).toBe(1);
  await expect(page.locator('.hotspot[data-id="shelf"]')).toHaveAttribute('data-active', 'true');
  await shot(page, info, 'guia-lectura');

  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.locator('.onboarding')).toHaveAttribute('data-state', 'habits');
  await page.waitForTimeout(reduced(info) ? 100 : 800);
  c = await card(page);
  run.guide.habits = c;
  expect(c.inside).toBe(true);
  await expect(page.locator('.hotspot[data-id="tray"]')).toHaveAttribute('data-active', 'true');
  await shot(page, info, 'guia-rituales');
  // Atrás y otra vez adelante
  await page.getByRole('button', { name: 'Atrás' }).click();
  await expect(page.locator('.onboarding')).toHaveAttribute('data-state', 'reading');
  await page.getByRole('button', { name: 'Continuar' }).click();
  // Fase 1: no hay parada social ni regalo; «Terminar» cierra
  await page.getByRole('button', { name: 'Terminar' }).click();
  await expect(page.locator('.onboarding-card')).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), DONE)).toBe('true');
  await expect(page.locator('.panorama-nav')).toHaveCount(1);

  await page.reload();
  await loaded(page);
  await page.waitForTimeout(800);
  await expect(page.locator('.onboarding-card')).toHaveCount(0);
});

test('B · saltar marca la guía y «Guías» la repite', async ({ page }) => {
  await page.goto('/');
  await loaded(page);
  await page.getByRole('button', { name: 'Saltar guía' }).click();
  await expect(page.locator('.onboarding-card')).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), DONE)).toBe('true');
  await page.reload();
  await loaded(page);
  await page.waitForTimeout(600);
  await expect(page.locator('.onboarding-card')).toHaveCount(0);
  await page.locator('.guides-toggle').click();
  await expect(page.locator('.onboarding')).toHaveAttribute('data-state', 'welcome');
  // Escape cierra y el foco vuelve a «Guías»
  await page.keyboard.press('Escape');
  await expect(page.locator('.onboarding-card')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.activeElement?.classList.contains('guides-toggle'))).toBe(true);
});

test('B · con localStorage bloqueado la app abre y la guía funciona en memoria', async ({ page }) => {
  await page.addInitScript(() => {
    const fail = () => {
      throw new DOMException('bloqueado', 'SecurityError');
    };
    Storage.prototype.getItem = fail;
    Storage.prototype.setItem = fail;
  });
  await page.goto('/');
  await loaded(page);
  await expect(page.locator('.onboarding-card')).toBeVisible();
  await page.getByRole('button', { name: 'Saltar guía' }).click();
  await expect(page.locator('.onboarding-card')).toHaveCount(0);
  expect(run.pageErrors.filter((e) => e.test.includes('bloqueado'))).toEqual([]);
});

test('B · un panel prioritario retrasa la guía hasta cerrarse', async ({ page }) => {
  // Recarga con un panel abierto en el historial (p. ej. la cuenta): la guía espera
  await page.addInitScript(() => {
    history.replaceState({ bookshelf: { loc: { view: 'room', panel: { type: 'account' } }, depth: 0, parent: null } }, '');
  });
  await page.goto('/');
  await loaded(page);
  await expect(page.locator('.panel-veil')).toHaveCount(1);
  await page.waitForTimeout(700);
  await expect(page.locator('.onboarding-card')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.panel-veil')).toHaveCount(0);
  await expect(page.locator('.onboarding-card')).toBeVisible();
  expect((await card(page)).count).toBe(1);
});

test('B · redimensionar y girar mantiene la tarjeta dentro del viewport', async ({ page }) => {
  await page.goto('/');
  await loaded(page);
  await page.getByRole('button', { name: 'Descubrir mi habitación' }).click();
  const vp = page.viewportSize();
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await page.waitForTimeout(900);
  const c = await card(page);
  run.guide.rotated = c;
  expect(c.inside).toBe(true);
  expect(c.count).toBe(1);
  await page.setViewportSize(vp);
  await page.waitForTimeout(900);
  expect((await card(page)).inside).toBe(true);
});

test('B · teclado: Tab recorre los botones de la tarjeta y Enter avanza', async ({ page }) => {
  await page.goto('/');
  await loaded(page);
  await expect(page.locator('.onboarding-card')).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.textContent)).toBe('Saltar guía');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('.onboarding')).toHaveAttribute('data-state', 'reading');
});
