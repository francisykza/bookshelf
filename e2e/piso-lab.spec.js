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

test('registrar desde el piso abre el registro vigente; solo la cubierta de tu lectura y las miniaturas de los lomos que se ven', async ({ page }) => {
  const covers = [];
  page.on('request', (r) => {
    if (r.url().includes('covers.openlibrary.org')) covers.push(r.url());
  });
  await open(page);
  // El rincón de detrás ya pide las suyas al arrancar: se cuenta desde aquí
  await page.waitForTimeout(800);
  covers.length = 0;
  await enter(page);
  // Una sola cubierta grande, la misma en la mesa y en la estantería. Desde la 1.88, además, la miniatura (-M) de cada
  // ejemplar dibujado, para su tapa y su lomo; nada de los libros que no se ven
  const shown = (await debug(page)).shelf.books.length;
  const big = () => new Set(covers.filter((u) => !/-M.jpg/.test(u))).size;
  const small = () => new Set(covers.filter((u) => /-M.jpg/.test(u))).size;
  expect(big()).toBeLessThanOrEqual(1);
  expect(small()).toBeLessThanOrEqual(shown);
  await page.getByRole('button', { name: /^Registrar lectura de Circe/ }).click();
  await expect(page.getByRole('dialog').filter({ hasText: 'Guardar lectura' }).last()).toContainText('Circe');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Tu piso · 1.º A' })).toBeVisible();
  await page.getByRole('button', { name: 'Ver la balda' }).click();
  await expect(page.locator('.plab-spot')).not.toHaveCount(0);
  expect(big()).toBeLessThanOrEqual(1);
  expect(small()).toBeLessThanOrEqual(shown);
  await page.goBack();
  await expect(page.locator('.plab-spot')).toHaveCount(0);
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
  await expect(page.getByRole('dialog').filter({ hasText: 'Guardar lectura' }).last()).toContainText('Circe');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Tu piso · 1.º A' })).toBeVisible();
  await expect.poll(async () => (await debug(page)).zoomed).toBe(false);
  await tap('estanteria');
  await expect(page.locator('.plab-spot')).not.toHaveCount(0);
});

const interior = (page) => page.getByRole('dialog', { name: 'Interior del piso' });

test('el recorrido: tocar la balda, elegir un libro, abrir su ficha y volver al mismo encuadre', async ({ page }) => {
  await open(page);
  await enter(page);
  await page.waitForTimeout(300);
  // El lienzo se marca para saber si es el mismo al volver: la ficha no debe desmontar el interior
  await page.evaluate(() => (document.querySelector('.plab-canvas').__mismo = true));
  const at = await page.evaluate(() => window.__pisoLab().lookTo(-0.42) ?? window.__pisoLab().screenOf('balda'));
  await page.mouse.click(at.x, at.y);
  const spot = interior(page).getByRole('button', { name: /^El Principito, de Antoine de Saint-Exupéry/ });
  await expect(spot).toBeVisible();
  expect((await debug(page)).zoomed).toBe(true);
  const box = await spot.boundingBox();
  // Dos lomos finos seguidos se reparten el sitio: al menos el mínimo de WCAG 2.2 AA
  expect(box.width).toBeGreaterThanOrEqual(24);
  expect(box.height).toBeGreaterThanOrEqual(44);
  // Primer toque: elige, no abre
  await spot.click();
  await expect(spot).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.plab-pick')).toContainText('El Principito');
  await expect(page.getByRole('dialog', { name: /^El Principito/ })).toHaveCount(0);
  // Tocar otro libro cambia la elección sin abrir nada
  const cover = interior(page).getByRole('button', { name: /^Circe, de Madeline Miller/ });
  await cover.click();
  await expect(cover).toHaveAttribute('aria-pressed', 'true');
  await expect(spot).toHaveAttribute('aria-pressed', 'false');
  await spot.click();
  await page.getByRole('button', { name: 'Abrir ficha' }).click();
  const ficha = page.getByRole('dialog', { name: /^El Principito, de Antoine de Saint-Exupéry/ });
  await expect(ficha.getByRole('heading', { name: 'El Principito', level: 2 })).toBeVisible();
  await page.screenshot({ path: 'qa-report/piso-lab/ficha-sobre-interior.png' });
  await ficha.getByRole('button', { name: 'Cerrar' }).click();
  await expect(ficha).toHaveCount(0);
  await expect(spot).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('.plab-canvas').__mismo)).toBe(true);
  await page.getByRole('button', { name: 'Volver al sillón' }).click();
  await expect(page.locator('.plab-spot')).toHaveCount(0);
  await expect.poll(async () => (await debug(page)).zoomed).toBe(false);
  const back = await debug(page);
  expect(back.eye).toBeCloseTo(1.85, 1);
  expect(back.yaw).toBeCloseTo(-0.42, 5);
  await expect(page.getByRole('button', { name: 'Al portal' })).toBeVisible();
});

test('tocar una balda acerca esa misma, y Atrás te devuelve al sillón', async ({ page }) => {
  await open(page);
  await enter(page);
  await page.waitForTimeout(300);
  const { rows } = (await debug(page)).shelf;
  // Los puntos de la balda del medio, donde caen sus lomos desde esta mirada
  const at = await page.evaluate(() => window.__pisoLab().lookTo(-0.42) ?? window.__pisoLab().screenOf('estanteria'));
  await page.mouse.click(at.x, at.y);
  await expect(page.locator('.plab-spot')).toHaveCount(rows[1]);
  await page.goBack();
  await expect(page.locator('.plab-spot')).toHaveCount(0);
});

test('girar no abre nada: arrastre, ida y vuelta, pulsación larga y dos dedos no cuentan como toque', async ({ page }) => {
  await open(page);
  await enter(page);
  await page.waitForTimeout(300);
  const at = await page.evaluate(() => window.__pisoLab().lookTo(-0.42) ?? window.__pisoLab().screenOf('balda'));
  const history = () => page.evaluate(() => window.history.length);
  const start = await history();
  const quiet = async () => {
    await page.waitForTimeout(120);
    const d = await debug(page);
    expect(d.zoomed).toBe(false);
    expect(await history()).toBe(start);
    await expect(page.locator('.plab-spot')).toHaveCount(0);
    return d;
  };
  // Arrastre que empieza sobre un libro
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x - 60, at.y, { steps: 6 });
  await page.mouse.up();
  expect((await quiet()).yaw).not.toBeCloseTo(-0.42, 2);
  // Va y vuelve al mismo punto: ya no es un toque
  const again = await page.evaluate(() => window.__pisoLab().lookTo(-0.42) ?? window.__pisoLab().screenOf('balda'));
  await page.mouse.move(again.x, again.y);
  await page.mouse.down();
  await page.mouse.move(again.x + 30, again.y, { steps: 3 });
  await page.mouse.move(again.x, again.y, { steps: 3 });
  await page.mouse.up();
  await quiet();
  // Se desliza en vertical: tampoco
  await page.mouse.move(again.x, again.y);
  await page.mouse.down();
  await page.mouse.move(again.x, again.y + 24, { steps: 3 });
  await page.mouse.up();
  await quiet();
  // Pulsación larga, sin moverse
  await page.mouse.move(again.x, again.y);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await quiet();
  // Un temblor de pocos píxeles sí es un toque
  await page.evaluate(() => window.__pisoLab().lookTo(-0.42));
  await page.mouse.move(again.x, again.y);
  await page.mouse.down();
  await page.mouse.move(again.x + 4, again.y + 2);
  await page.mouse.up();
  await expect(page.locator('.plab-spot')).not.toHaveCount(0);
  // De cerca: deslizar el dedo sobre un libro no lo elige, y tocar fuera suelta el elegido
  const spot = page.locator('.plab-spot').first();
  const box = await spot.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 40, { steps: 3 });
  await page.mouse.up();
  await expect(page.locator('.plab-pick')).toHaveCount(0);
  await spot.click();
  await expect(page.locator('.plab-pick')).toBeVisible();
  const canvas = await page.locator('.plab-canvas').boundingBox();
  await page.mouse.click(canvas.x + 12, canvas.y + 40);
  await expect(page.locator('.plab-pick')).toHaveCount(0);
});

test('«Dejar sobre la mesa» cambia el ejemplar de la habitación y lo que se registra, sin desmontar el interior', async ({ page }) => {
  await open(page);
  await enter(page);
  await page.waitForTimeout(300);
  await page.evaluate(() => (document.querySelector('.plab-canvas').__mismo = true));
  expect((await debug(page)).book.id).toBe('circe');
  await page.getByRole('button', { name: 'Ver la balda' }).click();
  const spot = interior(page).getByRole('button', { name: /^El Principito/ });
  await spot.waitFor();
  const start = (await debug(page)).memory;
  await spot.click();
  await page.getByRole('button', { name: 'Abrir ficha' }).click();
  const ficha = page.getByRole('dialog', { name: /^El Principito/ });
  await expect(ficha.getByText('sobre la cama')).toHaveCount(0);
  const place = ficha.getByRole('button', { name: 'Dejar sobre la mesa' });
  await expect(place).toHaveAttribute('aria-pressed', 'false');
  await place.click();
  await expect(ficha.getByRole('button', { name: 'Está sobre la mesa' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await debug(page)).book.id).not.toBe('circe');
  const moved = await debug(page);
  // El mismo ejemplar, de frente en la estantería; Circe vuelve a su sitio entre los lomos
  expect(moved.shelf.books[0]).toBe(moved.book.id);
  expect(moved.shelf.books).toContain('circe');
  expect(new Set(moved.shelf.books).size).toBe(moved.shelf.books.length);
  await ficha.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('button', { name: /^Registrar lectura de El Principito/ })).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('.plab-canvas').__mismo)).toBe(true);
  await expect(interior(page).getByRole('button', { name: /^El Principito/ })).toBeVisible();
  // En la misma balda, la misma memoria: los libros de antes se han liberado
  await page.waitForTimeout(150);
  const after = (await debug(page)).memory;
  expect(after.geometries).toBeLessThanOrEqual(start.geometries + 1);
  expect(after.textures).toBeLessThanOrEqual(start.textures + 1);
});

test('la ventana: el agua se mueve poco y se para en segundo plano, con la ficha encima o fuera de la vista', async ({ page }) => {
  await open(page);
  await enter(page);
  const steps = async () => (await debug(page)).exterior.waterSteps;
  await expect.poll(steps, { timeout: 5000 }).toBeGreaterThan(1);
  const hide = (hidden) =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (value ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  // En segundo plano no corre nada
  await hide(true);
  // Un dibujo pedido justo antes de pasar a segundo plano aún puede llegar: se cuenta desde después
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const hiddenAt = await debug(page);
  expect(hiddenAt.exterior.waterRunning).toBe(false);
  await page.waitForTimeout(1000);
  const later = await debug(page);
  expect(later.exterior.waterSteps).toBe(hiddenAt.exterior.waterSteps);
  expect(later.exterior.renders).toBe(hiddenAt.exterior.renders);
  await hide(false);
  await expect.poll(steps, { timeout: 5000 }).toBeGreaterThan(hiddenAt.exterior.waterSteps);
  // Mirando la balda la ventana no está a la vista: se sigue comprobando, pero no se redibuja
  await page.getByRole('button', { name: 'Ver la balda' }).click();
  const spot = interior(page).getByRole('button', { name: /^El Principito/ });
  await spot.waitFor();
  const near = await debug(page);
  expect(near.exterior.inView).toBe(false);
  await page.waitForTimeout(1000);
  expect((await debug(page)).exterior.renders).toBe(near.exterior.renders);
  // Con la ficha encima, ni eso
  await spot.click();
  await page.getByRole('button', { name: 'Abrir ficha' }).click();
  await page.getByRole('dialog', { name: /^El Principito/ }).waitFor();
  await expect.poll(async () => (await debug(page)).exterior.waterRunning).toBe(false);
});

test('la ventana: con movimiento reducido el agua está quieta y no hay redibujados', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await enter(page);
  // El exterior se pinta después de entrar: se cuenta desde que ya está pintado
  await expect.poll(async () => (await debug(page)).windows[0].painted, { timeout: 15000 }).toBe(true);
  await page.waitForTimeout(400);
  const a = await debug(page);
  expect(a.exterior.waterRunning).toBe(false);
  await page.waitForTimeout(1200);
  const b = await debug(page);
  expect(b.exterior.waterSteps).toBe(0);
  expect(b.exterior.renders).toBe(a.exterior.renders);
  // Si la preferencia cambia con el piso abierto, el agua arranca
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(async () => (await debug(page)).exterior.waterSteps, { timeout: 5000 }).toBeGreaterThan(0);
});

test('la ventana: no se ve el final de ninguna capa, ni girando ni yendo a la balda', async ({ page }) => {
  await open(page);
  await enter(page);
  const margins = await page.evaluate(() => {
    const api = window.__pisoLab();
    return api.exteriorMargins(api.eyePath());
  });
  expect(margins).toHaveLength(1);
  for (const [name, m] of Object.entries(margins[0].layers)) {
    for (const [side, value] of Object.entries(m)) {
      // La cercana y la media no tienen nada arriba: por ahí su lámina es transparente
      if (name !== 'far' && side === 'top') continue;
      expect(value, `${name} ${side}`).toBeGreaterThan(0);
    }
  }
});

test('la ventana: una que no se ve no pinta nada, y un piso sin vista al hotel no carga su dibujo', async ({ page }) => {
  const scripts = [];
  page.on('request', (r) => scripts.push(r.url()));
  await open(page);
  await enter(page, NEIGHBOUR);
  const view = await debug(page);
  expect(view.windows.map((w) => w.hotel)).toEqual([false]);
  expect(scripts.some((u) => /hotelArt|hotelMini/.test(u))).toBe(false);
  await page.getByRole('button', { name: 'Al portal' }).click();
  await enter(page);
  await expect.poll(async () => (await debug(page)).windows.map((w) => [w.pared, w.painted])).toEqual([['fondo', true], ['izq', false]]);
  expect((await debug(page)).exterior.windows).toBe(1);
  expect(scripts.some((u) => /hotelMini/.test(u))).toBe(true);
  // Solo su miniatura: el dibujo entero del hotel no hace falta para verlo de lejos
  expect(scripts.some((u) => /hotelArt/.test(u))).toBe(false);
});

test('la estantería: tu lectura de frente, sin repetir, y solo lo que cabe', async ({ page }) => {
  await open(page);
  await enter(page);
  const { shelf } = await debug(page);
  expect(shelf.books[0]).toBe('circe');
  expect(new Set(shelf.books).size).toBe(shelf.books.length);
  expect(shelf.rows.reduce((a, b) => a + b)).toBe(shelf.books.length);
  // Las cubiertas están bloqueadas en esta prueba: queda la tela con su título
  expect(shelf.coverReal).toBe(false);
  await page.getByRole('button', { name: 'Ver la balda' }).click();
  await expect(page.locator('.plab-spot')).toHaveCount(shelf.rows[2]);
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
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('button', { name: 'Ver de noche' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/noche-${info.project.name}.png` });
  await page.getByRole('button', { name: 'Ver la balda' }).click();
  await expect(page.locator('.plab-spot')).not.toHaveCount(0);
  await page.screenshot({ path: `${OUT}/balda-${info.project.name}.png` });
});

// La mesa y el libro: la franja de abajo, tocar para registrar, y lo que pasa sin lectura, sin portada o con un título largo
const stateOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')));
/** Cambia los datos guardados antes de que arranque la app, una sola vez: lo que se guarde después se conserva al recargar. */
async function seeded(page, change) {
  await open(page);
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.addInitScript((next) => {
    if (sessionStorage.getItem('sembrado')) return;
    sessionStorage.setItem('sembrado', '1');
    localStorage.setItem('bookshelf:v1', next);
  }, JSON.stringify(change(await stateOf(page))));
  await page.reload();
  await expect(door(page, MINE)).toBeVisible();
}
const tapBook = async (page) => {
  const at = await page.evaluate(() => window.__pisoLab().screenOf('libro'));
  await page.mouse.click(at.x, at.y);
};
const logDialog = (page) => page.getByRole('dialog').filter({ hasText: 'Guardar lectura' }).last();

test('el libro: tocarlo abre el registro de ese ejemplar y al cancelar vuelves al mismo encuadre', async ({ page }) => {
  await open(page);
  await enter(page);
  await page.evaluate(() => {
    document.querySelector('.plab-canvas').__mismo = true;
    window.__pisoLab().lookTo(0.14);
  });
  const before = await page.evaluate(() => window.__pisoLab().screenOf('libro'));
  await tapBook(page);
  await expect(logDialog(page)).toContainText('Circe');
  await page.keyboard.press('Escape');
  await expect(logDialog(page)).toHaveCount(0);
  await expect.poll(async () => (await debug(page)).zoomed).toBe(false);
  expect((await debug(page)).yaw).toBeCloseTo(0.14, 5);
  const after = await page.evaluate(() => window.__pisoLab().screenOf('libro'));
  expect(after.x).toBeCloseTo(before.x, 1);
  expect(after.y).toBeCloseTo(before.y, 1);
  expect(await page.evaluate(() => document.querySelector('.plab-canvas').__mismo)).toBe(true);
});

test('el libro: un arrastre que empieza encima gira y no abre nada; dos toques seguidos abren un solo registro', async ({ page }) => {
  await open(page);
  await enter(page);
  const at = await page.evaluate(() => window.__pisoLab().screenOf('libro'));
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x - 70, at.y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(450);
  await expect(logDialog(page)).toHaveCount(0);
  const { yaw } = await debug(page);
  expect(Math.abs(yaw)).toBeGreaterThan(0.2);
  // Sigue girando después de haber abierto y cerrado el registro
  await tapBook(page);
  await tapBook(page);
  await expect(logDialog(page)).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await debug(page)).zoomed).toBe(false);
  await page.mouse.move(195, 300);
  await page.mouse.down();
  await page.mouse.move(255, 300, { steps: 6 });
  await page.mouse.up();
  expect((await debug(page)).yaw).toBeCloseTo(yaw - 0.24, 1);
});

test('registrar páginas: se guarda, avisa con Deshacer, vuelve a la habitación y se conserva al recargar', async ({ page }) => {
  await open(page);
  await enter(page);
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  const start = (await stateOf(page)).books.find((b) => b.id === 'circe');
  await tapBook(page);
  const dialog = logDialog(page);
  await dialog.locator('.reading-form__input input').fill('12');
  await dialog.getByRole('button', { name: 'Guardar lectura' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.log-toast')).toContainText('Lectura registrada');
  await expect.poll(async () => (await debug(page)).zoomed).toBe(false);
  await expect.poll(async () => (await stateOf(page)).books.find((b) => b.id === 'circe').currentPage).toBe(start.currentPage + 12);
  await page.reload();
  // La navegación se conserva: sigues en el piso, con el mismo libro y su progreso
  await expect(page.getByRole('heading', { name: 'Tu piso · 1.º A' })).toBeVisible();
  await ready(page);
  expect((await stateOf(page)).books.find((b) => b.id === 'circe').currentPage).toBe(start.currentPage + 12);
  expect((await debug(page)).book.id).toBe('circe');
  await page.getByRole('button', { name: 'Registrar lectura de Circe' }).click();
  await expect(logDialog(page)).toContainText(String(start.currentPage + 12));
});

test('«Deshacer» tras registrar deja el progreso como estaba y sigues en la habitación', async ({ page }) => {
  await open(page);
  await enter(page);
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  const start = (await stateOf(page)).books.find((b) => b.id === 'circe').currentPage;
  await page.getByRole('button', { name: /^Registrar lectura de Circe/ }).click();
  await logDialog(page).locator('.reading-form__input input').fill('5');
  await logDialog(page).getByRole('button', { name: 'Guardar lectura' }).click();
  await page.locator('.log-toast').getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.locator('.log-toast')).toHaveCount(0);
  await expect.poll(async () => (await stateOf(page)).books.find((b) => b.id === 'circe').currentPage).toBe(start);
  await expect(page.getByRole('heading', { name: 'Tu piso · 1.º A' })).toBeVisible();
});

test('si el registro termina el libro, su reseña y al cerrarla vuelves al piso', async ({ page }) => {
  await open(page);
  await enter(page);
  await tapBook(page);
  await logDialog(page).locator('.reading-form__input input').fill('236');
  await logDialog(page).getByRole('button', { name: 'Guardar lectura' }).click();
  const review = page.getByRole('dialog').filter({ hasText: 'Guardar reseña' }).last();
  await review.getByRole('button', { name: 'Ahora no' }).click();
  await expect(page.getByRole('heading', { name: 'Tu piso · 1.º A' })).toBeVisible();
  await ready(page);
  // El libro terminado ya no está sobre la mesa
  expect((await debug(page)).book?.id).not.toBe('circe');
});

test('teclado y lector de pantalla: se llega a registrar con el tabulador y el foco vuelve al mismo botón', async ({ page }) => {
  await open(page);
  await enter(page);
  const register = page.getByRole('button', { name: 'Registrar lectura de Circe' });
  await expect(page.getByRole('img', { name: /Arrastra o usa las flechas/ })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Más acciones' }).getByRole('button')).toHaveText(['Balda', 'Decorar', 'Menú']);
  for (const name of ['Ver la balda', 'Decorar', 'Menú de accesos']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  // Desde el lienzo, en el orden natural
  await page.locator('.plab-canvas').focus();
  const yaw0 = (await debug(page)).yaw;
  await page.keyboard.press('ArrowRight');
  expect((await debug(page)).yaw).toBeCloseTo(yaw0 + 0.08, 5);
  await page.keyboard.press('Tab');
  await expect(register).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(logDialog(page)).toContainText('Circe');
  await page.keyboard.press('Escape');
  await expect(logDialog(page)).toHaveCount(0);
  await expect(register).toBeFocused();
  // Todo se puede tocar con el dedo y nada se sale
  for (const b of await page.locator('.plab-controls button').all()) {
    const box = await b.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  }
  const strip = await page.locator('.plab-controls').boundingBox();
  expect(strip.height).toBeLessThanOrEqual(70);
});

test('con movimiento reducido el registro se abre sin mover la cámara', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await enter(page);
  await page.evaluate(() => {
    const api = window.__pisoLab();
    window.__moved = false;
    api.onFrame(() => (window.__moved ||= api.debug().zoomed));
  });
  await tapBook(page);
  await expect(logDialog(page)).toBeVisible();
  expect(await page.evaluate(() => window.__moved)).toBe(false);
  expect((await debug(page)).zoomed).toBe(false);
});

test('con las guías, una indicación discreta junto al libro que lo sigue al girar; sin guías, nada', async ({ page }) => {
  await open(page);
  await enter(page);
  await expect(page.locator('.plab-hint')).toHaveCount(0);
  const page2 = await page.context().newPage();
  await seeded(page2, (s) => ({ ...s, settings: { ...s.settings, showGuides: true } }));
  await enter(page2);
  const hint = page2.locator('.plab-hint');
  await expect(hint).toHaveText('Toca para registrar');
  await expect(hint).toHaveAttribute('aria-hidden', 'true');
  await expect(hint).toHaveCSS('pointer-events', 'none');
  const a = await hint.boundingBox();
  const book = await page2.evaluate(() => window.__pisoLab().screenOf('libro'));
  // Encima del libro, sin taparlo por el centro
  expect(a.y + a.height).toBeLessThan(book.y);
  await page2.evaluate(() => window.__pisoLab().lookTo(0.3));
  const b = await hint.boundingBox();
  expect(b.x).toBeLessThan(a.x);
  await page2.getByRole('button', { name: /^Registrar lectura de/ }).click();
  await expect(logDialog(page2)).toBeVisible();
  await expect(hint).toHaveCount(0);
  await page2.close();
});

test('sin lectura: mesa vacía y se ofrece elegir en la estantería; el piso funciona', async ({ page }) => {
  await seeded(page, (s) => ({ ...s, settings: { ...s.settings, currentBookId: null, showGuides: true }, books: s.books.map((b) => (b.status === 'reading' ? { ...b, status: 'want' } : b)) }));
  await enter(page);
  expect((await debug(page)).book).toBeNull();
  await expect(page.getByRole('button', { name: /^Registrar lectura/ })).toHaveCount(0);
  await expect(page.locator('.plab-hint')).toHaveText('Elige una lectura');
  await page.getByRole('button', { name: /^Elegir una lectura/ }).click();
  await expect(page.locator('.plab-spot')).not.toHaveCount(0);
});

test('biblioteca vacía: mesa y estantería sin libros, y se ofrece ir a Mi biblioteca', async ({ page }) => {
  await seeded(page, (s) => ({ ...s, books: [], settings: { ...s.settings, currentBookId: null } }));
  await enter(page);
  expect((await debug(page)).book).toBeNull();
  await expect(page.getByRole('button', { name: /^Elegir una lectura/ })).toContainText('En Mi biblioteca');
});

test('sin portada y con un título larguísimo: tela con el título, todo cabe y el nombre completo se conserva', async ({ page }) => {
  const LONG = 'La increíble y triste historia de la cándida Eréndira y de su abuela desalmada, edición conmemorativa';
  await seeded(page, (s) => ({ ...s, books: s.books.map((b) => (b.id === 'circe' ? { ...b, title: LONG, cover: '' } : b)) }));
  await enter(page);
  expect((await debug(page)).book.coverReal).toBe(false);
  const register = page.getByRole('button', { name: `Registrar lectura de ${LONG}` });
  await expect(register).toBeVisible();
  const box = await register.boundingBox();
  expect(box.height).toBeLessThanOrEqual(56);
  const fits = await page.evaluate(() => {
    const small = document.querySelector('.plab-primary small');
    return { cut: small.scrollWidth > small.clientWidth, page: document.documentElement.scrollWidth <= innerWidth };
  });
  expect(fits).toEqual({ cut: true, page: true });
  await tapBook(page);
  await expect(logDialog(page)).toContainText(LONG.slice(0, 30));
  await page.screenshot({ path: `${OUT}/titulo-largo-registro.png` });
});

test('el visitante: sin registrar ni decorar, y tocar la mesa no abre nada', async ({ page }) => {
  await open(page);
  await enter(page, NEIGHBOUR);
  expect((await debug(page)).book).toBeNull();
  await expect(page.locator('.plab-primary')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Más acciones' }).getByRole('button')).toHaveText(['Balda', 'Menú']);
});
