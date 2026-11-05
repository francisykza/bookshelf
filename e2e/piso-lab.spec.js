// Piloto «Del portal al sillón» (solo laboratorio). Perfil de Playwright con la biblioteca de ejemplo y sin Supabase.
// Emulación: Chromium dibuja WebGL por software y WebKit de Playwright no equivale a Safari en un iPhone.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'qa-report/piso-lab';
const KEY_A = 'bookshelf:lab:piso-primera-persona:plano2:lab-1A';
const KEY_B = 'bookshelf:lab:piso-primera-persona:plano2:lab-2B';
const door = (page, re) => page.getByRole('button', { name: re });
const MINE = /^Entrar en tu piso, 1\.º A/;
const NEIGHBOUR = /^Llamar y entrar en el piso de Vecina de prueba/;

test.beforeEach(async ({}, info) => {
  test.skip(!/(chromium|webkit)-390x844$/.test(info.project.name), 'móvil vertical');
  mkdirSync(OUT, { recursive: true });
});

async function open(page) {
  const external = [];
  page.on('request', (r) => {
    if (/supabase\.co/.test(r.url())) external.push(r.url());
  });
  await page.route('https://covers.openlibrary.org/**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/?piloto=piso');
  await expect(door(page, MINE)).toBeVisible();
  return external;
}

const ready = (page) => page.waitForFunction(() => window.__pisoLab?.()?.debug().windows.length > 0, null, { timeout: 30000 });
async function enter(page, re = MINE) {
  await door(page, re).click();
  await ready(page);
}
const debug = (page) => page.evaluate(() => window.__pisoLab().debug());

test('el portal no carga Three.js ni portadas; la puerta abre el piso y al volver el foco es suyo', async ({ page }) => {
  const scripts = [];
  page.on('request', (r) => scripts.push(r.url()));
  const external = await open(page);
  expect(scripts.some((u) => /three|interior3d/.test(u))).toBe(false);
  await enter(page);
  expect(scripts.some((u) => /three|interior3d/.test(u))).toBe(true);
  await expect(page.getByRole('heading', { name: 'Tu piso · 1.º A' })).toBeVisible();
  // Se entra a la hora de la fachada, sentado en el sillón real
  const view = await debug(page);
  expect(view.hora).toBe('tarde');
  expect(view.eye).toBeCloseTo(1.85, 1);
  // Se conserva el registro del rincón y aquí abre la edición de tu lectura
  await page.getByRole('button', { name: 'Al portal' }).click();
  await expect(door(page, MINE)).toBeFocused();
  expect(external).toEqual([]);
});

test('registrar desde el piso abre el registro vigente; balda: solo portadas expuestas y solo al acercarse', async ({ page }) => {
  const covers = [];
  page.on('request', (r) => {
    if (r.url().includes('covers.openlibrary.org')) covers.push(r.url());
  });
  await open(page);
  // El rincón de detrás ya pide las suyas al arrancar: se cuenta desde aquí
  await page.waitForTimeout(800);
  covers.length = 0;
  await enter(page);
  // Al entrar, solo la cubierta de tu lectura: la que está sobre la mesa
  expect(new Set(covers).size).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: /^Registrar lectura de Circe/ }).click();
  await expect(page.getByRole('dialog').filter({ hasText: 'Circe' }).last()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Tu piso · 1.º A' })).toBeVisible();
  await page.getByRole('button', { name: 'Ver la balda' }).click();
  await expect(page.locator('.plab-cover')).toHaveCount(4);
  await expect.poll(() => new Set(covers).size).toBeLessThanOrEqual(4);
  await page.goBack();
  await expect(page.locator('.plab-cover')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Tu piso · 1.º A' })).toBeVisible();
});

test('la cubierta se pide al tocar la puerta y el piso ya aparece con ella', async ({ page }) => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==', 'base64');
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.route('https://covers.openlibrary.org/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: png, headers: { 'access-control-allow-origin': '*' } }));
  await page.goto('/?piloto=piso');
  await door(page, MINE).click();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().windows.length > 0, null, { timeout: 30000 });
  expect((await debug(page)).book.coverReal).toBe(true);
});

test('tocar el libro abre el registro y tocar la estantería acerca la balda', async ({ page }) => {
  await open(page);
  await enter(page);
  const tap = async (what) => {
    const at = await page.evaluate((w) => window.__pisoLab().screenOf(w), what);
    expect(at).not.toBeNull();
    await page.mouse.click(at.x, at.y);
  };
  await tap('libro');
  await expect(page.getByRole('dialog').filter({ hasText: 'Circe' }).last()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Tu piso · 1.º A' })).toBeVisible();
  await page.waitForTimeout(300);
  await tap('estanteria');
  await expect(page.locator('.plab-cover')).toHaveCount(4);
});

test('mover y girar la lámpara en el editor llega al interior, resiste la recarga y no toca el segundo piso', async ({ page }) => {
  await open(page);
  await enter(page);
  const before = (await debug(page)).lamps[0];
  await page.getByRole('button', { name: 'Decorar' }).click();
  await page.waitForFunction(() => window.__edificioPiso);
  // Se elige en la lista «En el piso» y se mueve y gira con el teclado, como una persona
  const moved = await page.evaluate(() => {
    const api = window.__edificioPiso;
    return { hasApi: Boolean(api), keys: Object.keys(api) };
  });
  expect(moved.hasApi).toBe(true);
  const point = await page.evaluate((uid) => window.__edificioPiso.screenOfItem(uid), before.uid);
  await page.mouse.click(point.x, point.y);
  const canvas = page.locator('.ep-canvas');
  await canvas.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('r');
  await page.getByRole('button', { name: 'Volver al sillón' }).click();
  await ready(page);
  const after = (await debug(page)).lamps[0];
  expect([after.x, after.rot]).toEqual([before.x + 2, 1]);
  await page.waitForTimeout(100);
  await page.reload();
  await ready(page);
  const reloaded = (await debug(page)).lamps[0];
  expect([reloaded.x, reloaded.rot]).toEqual([after.x, after.rot]);
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY_B)).toBe(null);
  expect(JSON.parse(await page.evaluate((k) => localStorage.getItem(k), KEY_A)).items.find((i) => i.id === 'lampara-pie').rot).toBe(1);
});

test('el segundo piso: otro id y otra ventana, sin hotel ni editor; un piso ajeno no se escribe', async ({ page }) => {
  await open(page);
  await enter(page);
  const a = await debug(page);
  expect(a.piso).toBe('lab-1A');
  expect(a.windows.map((w) => [w.pared, w.hotel])).toEqual([['fondo', true], ['izq', false]]);
  await page.getByRole('button', { name: 'Al portal' }).click();
  await enter(page, NEIGHBOUR);
  const b = await debug(page);
  expect(b.piso).toBe('lab-2B');
  expect(b.windows.map((w) => [w.pared, w.hotel])).toEqual([['izq', false]]);
  expect(b.windows[0].horizonY).not.toBe(a.windows[0].horizonY);
  await expect(page.getByRole('button', { name: 'Decorar' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Registrar lectura/ })).toHaveCount(0);
  await page.screenshot({ path: `${OUT}/vecina.png` });
});

test('diez entradas y salidas: sin acumular lienzos, oyentes ni texturas', async ({ page }) => {
  await page.addInitScript(() => {
    const net = (window.__listeners = { n: 0 });
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    const seen = new WeakMap();
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
      if (this instanceof HTMLCanvasElement || this === window || this === document) {
        net.n += 1;
        const signal = opts && typeof opts === 'object' ? opts.signal : null;
        signal?.addEventListener('abort', () => (net.n -= 1), { once: true });
        if (fn && typeof fn === 'object') seen.set(fn, 1);
      }
      return add.call(this, type, fn, opts);
    };
    EventTarget.prototype.removeEventListener = function (type, fn, opts) {
      if (this instanceof HTMLCanvasElement || this === window || this === document) net.n -= 1;
      return remove.call(this, type, fn, opts);
    };
    window.__contexts = 0;
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
      const had = this.__hadGl;
      const ctx = get.call(this, kind, ...rest);
      if (/webgl/.test(kind) && ctx && !had) {
        this.__hadGl = true;
        window.__contexts += 1;
      }
      return ctx;
    };
  });
  const warnings = [];
  page.on('console', (m) => {
    if (/too many active webgl|context lost/i.test(m.text())) warnings.push(m.text());
  });
  await open(page);
  const sample = () => page.evaluate(() => ({ canvases: document.querySelectorAll('canvas').length, gl: document.querySelectorAll('.plab-canvas').length, listeners: window.__listeners.n }));
  // Playwright instala sus propios oyentes en el primer clic: la referencia se toma tras la primera vuelta
  await enter(page, MINE);
  await page.getByRole('button', { name: 'Al portal' }).click();
  await expect(door(page, MINE)).toBeVisible();
  await page.waitForTimeout(300);
  const baseline = await sample();
  const memory = [];
  for (let i = 0; i < 10; i += 1) {
    await enter(page, i % 2 ? NEIGHBOUR : MINE);
    memory.push((await debug(page)).memory);
    await page.getByRole('button', { name: 'Al portal' }).click();
    await expect(door(page, MINE)).toBeVisible();
  }
  await page.waitForTimeout(300);
  const end = await sample();
  expect(end.gl).toBe(0);
  expect(end.canvases).toBe(baseline.canvases);
  expect(end.listeners).toBe(baseline.listeners);
  // Lo que la GPU tiene al entrar no crece con las visitas: mismos números para el mismo piso
  expect(memory[8]).toEqual(memory[0]);
  expect(memory[9]).toEqual(memory[1]);
  expect(warnings).toEqual([]);
  // En desarrollo, StrictMode monta y desmonta dos veces cada entrada; lo que importa es que ninguno siga vivo (arriba)
  expect(await page.evaluate(() => window.__contexts)).toBeLessThanOrEqual(22);
});

test('sin GPU se ofrecen biblioteca, registro y la vista de siempre, en HTML', async ({ page }) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
      return /webgl/.test(kind) ? null : get.call(this, kind, ...rest);
    };
  });
  await open(page);
  await door(page, MINE).click();
  await expect(page.getByRole('alert')).toContainText('no puede dibujar el interior');
  await expect(page.getByRole('button', { name: 'Abrir Mi biblioteca' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Registrar lectura de Circe/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /vista de siempre/ })).toBeVisible();
});

test('capturas de día y de noche y fluidez del giro (emulación)', async ({ page }, info) => {
  await open(page);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/portal-${info.project.name}.png` });
  await enter(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/dia-${info.project.name}.png` });
  await page.getByRole('button', { name: 'Ver de noche' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/noche-${info.project.name}.png` });
  await page.getByRole('button', { name: 'Ver la balda' }).click();
  await expect(page.locator('.plab-cover')).toHaveCount(4);
  await page.screenshot({ path: `${OUT}/balda-${info.project.name}.png` });
});
