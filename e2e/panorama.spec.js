// QA de la Fase 1 (SPEC §16.10): panorama MAIN_ROOM ↔ SOCIAL_ROOM, escenario cover, hotspots recalibrados,
// gestos, accesibilidad y regresiones de la habitación. Cada proyecto escribe su telemetría y sus capturas en
// `qa-report/`. Se usa un perfil vacío (datos de ejemplo): nunca la biblioteca real.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const run = { project: '', browser: '', viewport: null, tests: {}, console: [], pageErrors: [], failedRequests: [], screenshots: [] };

test.beforeEach(async ({ page }, info) => {
  run.project = info.project.name;
  run.browser = info.project.use.defaultBrowserType ?? info.project.name.split('-')[0];
  run.viewport = info.project.use.viewport;
  page.on('console', (msg) => {
    if (msg.type() === 'error') run.console.push({ test: info.title, text: msg.text() });
  });
  page.on('pageerror', (err) => run.pageErrors.push({ test: info.title, text: String(err) }));
  page.on('response', (res) => {
    if (res.status() >= 400 && res.url().startsWith('http://localhost')) run.failedRequests.push({ test: info.title, url: res.url(), status: res.status() });
  });
  page.on('requestfailed', (req) => {
    if (req.url().startsWith('http://localhost')) run.failedRequests.push({ test: info.title, url: req.url(), error: req.failure()?.errorText });
  });
  // Estas pruebas son de la habitación: la guía de primera visita se da por vista (tiene su propio archivo)
  await page.addInitScript(() => {
    try {
      localStorage.setItem('bookshelf_onboarding_done', 'true');
    } catch {
      // sin almacenamiento
    }
  });
  await page.goto('/');
  await page.waitForFunction(() => {
    const img = document.querySelector('[data-panel="MAIN_ROOM"] .scene-base');
    return img && img.complete && img.naturalWidth > 0;
  });
  // Primer gesto: cierra el aviso de sonido sin depender de él
  await page.waitForTimeout(300);
});

test.afterEach(async ({ page: _page }, info) => {
  run.tests[info.title] = { status: info.status, error: info.error?.message?.split('\n')[0] ?? null, duration: info.duration };
});

test.afterAll(async ({ browserName: _b }, info) => {
  const dir = join('qa-report', 'telemetry');
  mkdirSync(dir, { recursive: true });
  // Un archivo por proceso de pruebas: dos workers del mismo proyecto no se pisan
  writeFileSync(join(dir, `${run.project}-w${info.workerIndex}.json`), JSON.stringify(run, null, 2));
});

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.png`);
  await page.screenshot({ path: file });
  run.screenshots.push(file.replaceAll('\\', '/'));
}

const reduced = (info) => info.project.name.includes('reduced');
const settle = async (page, info) => page.waitForTimeout(reduced(info) ? 120 : 900);
const roomOf = (page) => page.locator('.panorama-track').getAttribute('data-room');

/** Geometría del viewport, el track, el panel visible y su escenario; hotspots con su prueba de impacto. */
async function geometry(page) {
  return page.evaluate(async () => {
    const { HOTSPOTS } = await import('/src/scene/sceneMap.js');
    const r = (el) => {
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom };
    };
    const vp = document.querySelector('.panorama-viewport');
    const track = document.querySelector('.panorama-track');
    const room = track.dataset.room;
    const panelEl = document.querySelector(`.panorama-panel[data-panel="${room}"]`);
    const stage = panelEl.querySelector('.scene-stage');
    const img = stage.querySelector('.scene-base');
    const scale = Number(stage.dataset.scale);
    const ox = Number(stage.dataset.offsetX);
    const oy = Number(stage.dataset.offsetY);
    const panel = r(panelEl);
    const inside = (pt, poly) => {
      let hit = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) hit = !hit;
      }
      return hit;
    };
    const hotspots = [];
    const anchors = [];
    if (room === 'MAIN_ROOM') {
      for (const [id, spot] of Object.entries(HOTSPOTS)) {
        const btn = document.querySelector(`.hotspot[data-id="${id}"]`);
        const xs = spot.shape.map((p) => p[0]);
        const ys = spot.shape.map((p) => p[1]);
        const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
        const expected = { x: panel.x + ox + box.x * scale, y: panel.y + oy + box.y * scale, w: box.w * scale, h: box.h * scale };
        const got = r(btn);
        anchors.push({ id, dx: +(got.x - expected.x).toFixed(2), dy: +(got.y - expected.y).toFixed(2), dw: +(got.w - expected.w).toFixed(2), dh: +(got.h - expected.h).toFixed(2) });
        // Puntos interiores reales del polígono (no la caja), dentro de la pantalla
        const pts = [];
        for (let gy = 1; gy < 8 && pts.length < 6; gy++)
          for (let gx = 1; gx < 8 && pts.length < 6; gx++) {
            const p = [box.x + (box.w * gx) / 8, box.y + (box.h * gy) / 8];
            if (!inside(p, spot.shape)) continue;
            const sx = panel.x + ox + p[0] * scale;
            const sy = panel.y + oy + p[1] * scale;
            if (sx < 1 || sy < 1 || sx > innerWidth - 1 || sy > innerHeight - 1) continue;
            pts.push([sx, sy]);
          }
        const results = pts.map(([sx, sy]) => {
          const el = document.elementFromPoint(sx, sy);
          const owner = el?.closest('[data-id], button, a, [role="button"]');
          return { sx: Math.round(sx), sy: Math.round(sy), hit: owner?.dataset?.id ?? owner?.className?.toString().split(' ')[0] ?? el?.tagName };
        });
        hotspots.push({ id, onScreen: pts.length > 0, points: results, // 1.46: con el libro grande de la cama delante, el libro pintado se abre desde él (su página izquierda)
        ok: pts.length === 0 || results.some((p) => p.hit === id || (id === 'book' && p.hit?.startsWith('bed-pages'))) });
      }
    }
    const m = new DOMMatrixReadOnly(getComputedStyle(track).transform);
    return {
      room,
      viewport: r(vp),
      window: { w: innerWidth, h: innerHeight },
      track: { ...r(track), translateX: m.m41 },
      panel,
      stage: { scale, ox, oy },
      image: { ...r(img), naturalW: img.naturalWidth, naturalH: img.naturalHeight, decoded: img.complete && img.naturalWidth > 0, opacity: getComputedStyle(img).opacity },
      docOverflowX: document.documentElement.scrollWidth - innerWidth,
      hotspots,
      anchors,
    };
  });
}

function assertGeometry(g) {
  expect(g.viewport.w).toBeCloseTo(g.window.w, 0);
  expect(g.viewport.h).toBeCloseTo(g.window.h, 0);
  expect(Math.abs(g.track.w - 2 * g.viewport.w)).toBeLessThanOrEqual(1);
  // El panel visible cubre sus cuatro bordes
  expect(Math.abs(g.panel.x - g.viewport.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(g.panel.w - g.viewport.w)).toBeLessThanOrEqual(1);
  expect(Math.abs(g.panel.h - g.viewport.h)).toBeLessThanOrEqual(1);
  // Desplazamiento exacto de un panel (o ninguno)
  const want = g.room === 'SOCIAL_ROOM' ? -g.viewport.w : 0;
  expect(Math.abs(g.track.translateX - want)).toBeLessThanOrEqual(1);
  // La imagen cubre el panel sin deformarse
  expect(g.image.decoded).toBe(true);
  expect(g.image.opacity).toBe('1');
  expect(g.image.x).toBeLessThanOrEqual(g.panel.x + 1);
  expect(g.image.y).toBeLessThanOrEqual(g.panel.y + 1);
  expect(g.image.r).toBeGreaterThanOrEqual(g.panel.r - 1);
  expect(g.image.b).toBeGreaterThanOrEqual(g.panel.b - 1);
  expect(Math.abs(g.image.w / g.image.h - g.image.naturalW / g.image.naturalH)).toBeLessThan(0.005);
  expect(g.docOverflowX).toBeLessThanOrEqual(0);
  for (const a of g.anchors) {
    expect.soft(Math.abs(a.dx), `ancla ${a.id} x`).toBeLessThanOrEqual(2);
    expect.soft(Math.abs(a.dy), `ancla ${a.id} y`).toBeLessThanOrEqual(2);
  }
  for (const h of g.hotspots) expect.soft(h.ok, `hotspot ${h.id} tapado: ${JSON.stringify(h.points)}`).toBe(true);
}

/** Swipe con puntero primario desde (x0, y0) con desplazamiento (dx, dy). */
async function swipe(page, dx, dy = 0, from) {
  const vp = page.viewportSize();
  const x0 = from?.x ?? vp.width / 2;
  const y0 = from?.y ?? vp.height * 0.45;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 + dx / 2, y0 + dy / 2, { steps: 4 });
  await page.mouse.move(x0 + dx, y0 + dy, { steps: 4 });
  await page.mouse.up();
}

/** Activa un objeto de la habitación: con el teclado si está en pantalla y, si no, con el control «Fuera de vista». */
const OFFSCREEN_TEXT = { book: /Libro abierto/, laptop: /Portátil/, tray: /Té helado/, headphones: /Auriculares/, figures: /Vitrina/, shelf: /Mi librería/, lamp: /Lámpara/, lantern: /Vela/ };
async function activate(page, id) {
  const onScreen = await page.evaluate((key) => {
    const b = document.querySelector(`.hotspot[data-id="${key}"]`)?.getBoundingClientRect();
    if (!b) return false;
    const w = Math.max(0, Math.min(b.right, innerWidth) - Math.max(b.left, 0));
    const h = Math.max(0, Math.min(b.bottom, innerHeight) - Math.max(b.top, 0));
    return (w * h) / Math.max(1, b.width * b.height) >= 0.25;
  }, id);
  if (onScreen) {
    await page.locator(`.hotspot[data-id="${id}"]`).focus();
    await page.keyboard.press('Enter');
    return 'hotspot';
  }
  // Los objetos que el encuadre recorta están en el menú de «Guías» (SPEC §19.5)
  await page.locator('.guides-toggle').click();
  await page.locator('.guides-menu__list button', { hasText: OFFSCREEN_TEXT[id] }).click();
  return 'fuera-de-vista';
}

test('1 · MAIN_ROOM inicial, geometría y anclas', async ({ page }, info) => {
  expect(await roomOf(page)).toBe('MAIN_ROOM');
  const g = await geometry(page);
  run.geometry = { ...(run.geometry ?? {}), initial: g };
  assertGeometry(g);
  // El panel inactivo no es alcanzable
  await expect(page.locator('[data-panel="SOCIAL_ROOM"]')).toHaveAttribute('inert', '');
  await shot(page, info, 'main-limpio');
  // «Guías» repite la guía de la habitación (Anexo B): captura con la guía abierta y salida con Escape
  await page.locator('.guides-toggle').click();
  await page.getByRole('button', { name: 'Repetir la guía de la habitación' }).click();
  await expect(page.locator('.onboarding-card')).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, info, 'main-guias');
  await page.keyboard.press('Escape');
  await expect(page.locator('.onboarding-card')).toHaveCount(0);
});

test('2-3 · swipe a SOCIAL_ROOM y de regreso', async ({ page }, info) => {
  await expect(page.locator('.panorama-nav__btn--next')).toBeEnabled();
  await swipe(page, -140);
  await settle(page, info);
  expect(await roomOf(page)).toBe('SOCIAL_ROOM');
  const g = await geometry(page);
  run.geometry = { ...(run.geometry ?? {}), social: g };
  assertGeometry(g);
  await shot(page, info, 'social');
  // Sin bucle: más a la izquierda no hace nada
  await swipe(page, -140);
  await settle(page, info);
  expect(await roomOf(page)).toBe('SOCIAL_ROOM');
  await swipe(page, 140);
  await settle(page, info);
  expect(await roomOf(page)).toBe('MAIN_ROOM');
  assertGeometry(await geometry(page));
});

test('4 · controles laterales y teclado', async ({ page }, info) => {
  await page.locator('.panorama-nav__btn--next').click();
  await settle(page, info);
  expect(await roomOf(page)).toBe('SOCIAL_ROOM');
  const back = page.locator('.panorama-nav__btn--prev');
  await expect(back).toHaveText(/Mi Habitación/);
  await back.focus();
  await page.keyboard.press('Enter');
  await settle(page, info);
  expect(await roomOf(page)).toBe('MAIN_ROOM');
  // Flechas solo con el foco en el panorama
  await page.locator('.panorama-nav__btn--next').focus();
  await page.keyboard.press('ArrowRight');
  await settle(page, info);
  expect(await roomOf(page)).toBe('SOCIAL_ROOM');
  await page.keyboard.press('ArrowLeft');
  await settle(page, info);
  expect(await roomOf(page)).toBe('MAIN_ROOM');
  const box = await page.locator('.panorama-nav__btn--next').boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
});

test('5-7 · 49 px, vertical y pointercancel no cambian de habitación', async ({ page }, info) => {
  await swipe(page, -49);
  await settle(page, info);
  expect(await roomOf(page)).toBe('MAIN_ROOM');
  await swipe(page, -60, -200);
  await settle(page, info);
  expect(await roomOf(page)).toBe('MAIN_ROOM');
  await page.evaluate(() => {
    const el = document.querySelector('.panorama-viewport');
    const ev = (type, x) => new PointerEvent(type, { pointerId: 9, isPrimary: true, pointerType: 'touch', clientX: x, clientY: 300, bubbles: true });
    el.dispatchEvent(ev('pointerdown', 300));
    el.dispatchEvent(ev('pointercancel', 200));
    el.dispatchEvent(ev('pointerup', 100));
  });
  await settle(page, info);
  expect(await roomOf(page)).toBe('MAIN_ROOM');
});

test('8 · swipe sobre un objeto no lo abre', async ({ page }, info) => {
  const target = await page.evaluate(() => {
    for (const id of ['laptop', 'tray', 'headphones', 'book']) {
      const b = document.querySelector(`.hotspot[data-id="${id}"]`).getBoundingClientRect();
      const x = b.left + b.width / 2;
      const y = b.top + b.height / 2;
      if (x > 160 && x < innerWidth - 20 && y > 20 && y < innerHeight - 20 && document.elementFromPoint(x, y)?.closest('[data-id]')?.dataset.id === id) return { id, x, y };
    }
    return null;
  });
  test.skip(!target, 'ningún objeto con hueco a la izquierda para el gesto en este encuadre');
  await swipe(page, -150, 0, target);
  await settle(page, info);
  expect(await roomOf(page)).toBe('SOCIAL_ROOM');
  await expect(page.locator('.panel-veil')).toHaveCount(0);
  run.tests.swipeOver = target.id;
});

test('9 · un panel abierto bloquea el panorama y Cerrar devuelve el foco', async ({ page }, info) => {
  const via = await activate(page, 'laptop');
  await expect(page.locator('.panel-veil')).toHaveCount(1);
  await expect(page.locator('.panorama-nav')).toHaveCount(0);
  await page.waitForTimeout(500);
  await shot(page, info, 'panel-portatil');
  await page.keyboard.press('ArrowRight');
  await swipe(page, -150);
  await settle(page, info);
  expect(await roomOf(page)).toBe('MAIN_ROOM');
  // En escritorio el arrastre cae dentro del portátil, sobre el calendario: puede abrir el desplegable de un día y hasta la
  // lista nativa del selector «Libro» (mientras está abierta, el navegador se queda el Escape). Se cierra de dentro
  // afuera —lista nativa, desplegable, panel—: nunca hacen falta más de tres Escape (1.58.2)
  for (let i = 0; i < 3 && (await page.locator('.panel-veil').count()); i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }
  await expect(page.locator('.panel-veil')).toHaveCount(0);
  if (via === 'hotspot') {
    await expect.poll(() => page.evaluate(() => document.activeElement?.dataset?.id)).toBe('laptop');
  }
});

test('10 · la escena inactiva no recibe el foco con Tab', async ({ page }, info) => {
  await page.locator('.panorama-nav__btn--next').click();
  await settle(page, info);
  await expect(page.locator('[data-panel="MAIN_ROOM"]')).toHaveAttribute('inert', '');
  const leaked = [];
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => Boolean(document.activeElement?.closest('[data-panel="MAIN_ROOM"]')));
    if (inside) leaked.push(i);
  }
  expect(leaked).toEqual([]);
});

test('11 · la librería abre y vuelve', async ({ page }, info) => {
  await activate(page, 'shelf');
  await expect(page.locator('.sanctuary')).toHaveAttribute('data-phase', /shelf/i);
  await page.waitForTimeout(700);
  await shot(page, info, 'libreria');
  await expect(page.locator('.panorama-nav')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.sanctuary')).toHaveAttribute('data-phase', /^room$|leaving/i);
  await page.waitForTimeout(500);
  expect(await roomOf(page)).toBe('MAIN_ROOM');
});

test('12 · libro, té, auriculares y Ático conservan su acción', async ({ page }) => {
  const used = {};
  used.book = await activate(page, 'book');
  await expect(page.locator('.panel-veil')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.panel-veil')).toHaveCount(0);
  used.tray = await activate(page, 'tray');
  await expect(page.locator('.panel-veil')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.panel-veil')).toHaveCount(0);
  // Con el sonido apagado, los auriculares lo encienden (con sonido activado sin gesto previo, el primer toque
  // solo intenta arrancar el audio, y WebKit sin cabeza no lo arranca: no serviría para comprobar la acción)
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
    st.settings.sound = false;
    localStorage.setItem('bookshelf:v1', JSON.stringify(st));
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  used.headphones = await activate(page, 'headphones');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1') ?? '{}').settings?.sound)).toBe(true);
  used.figures = await activate(page, 'figures');
  await expect(page.locator('.panel-veil')).toHaveCount(1);
  await page.keyboard.press('Escape');
  run.tests.activation = used;
});

test('13 · el temporizador no se reinicia al cambiar de habitación', async ({ page }, info) => {
  await activate(page, 'tray');
  await page.getByRole('button', { name: /Empezar/ }).click();
  const read = () => page.locator('.panel-veil strong').filter({ hasText: /^\d\d:\d\d$/ }).first().textContent();
  const t0 = await read();
  await page.keyboard.press('Escape');
  await page.locator('.panorama-nav__btn--next').click();
  await settle(page, info);
  await page.locator('.panorama-nav__btn--prev').click();
  await settle(page, info);
  await page.waitForTimeout(1500);
  await activate(page, 'tray');
  const t1 = await read();
  const secs = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  expect(secs(t1)).toBeLessThan(secs(t0));
  await expect(page.getByRole('button', { name: /Pausar/ })).toBeVisible();
  run.tests.timer = { t0, t1 };
});

test('14 · redimensionar mantiene panel y anclas alineados', async ({ page }) => {
  const vp = page.viewportSize();
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await page.waitForTimeout(600);
  const g = await geometry(page);
  run.geometry = { ...(run.geometry ?? {}), resized: g };
  assertGeometry(g);
  await page.setViewportSize(vp);
  await page.waitForTimeout(600);
  // Con la máquina cargada, al girar la escena puede tardar en volver a montarse: se mide cuando ya está (1.58.2)
  await page.waitForFunction(() => document.querySelector('.panorama-viewport [data-panel="MAIN_ROOM"] .scene-base')?.complete);
  assertGeometry(await geometry(page));
});

test('15 · ir y volver varias veces no duplica capas ni controles', async ({ page }, info) => {
  for (let i = 0; i < 4; i++) {
    await page.locator('.panorama-nav__btn--next').click();
    await settle(page, info);
    await page.locator('.panorama-nav__btn--prev').click();
    await settle(page, info);
  }
  await expect(page.locator('.panorama-nav__btn')).toHaveCount(1);
  await expect(page.locator('.scene-base')).toHaveCount(2);
  await expect(page.locator('.room-corner')).toHaveCount(1);
  await expect(page.locator('.tod')).toHaveCount(1);
  assertGeometry(await geometry(page));
});

test('16 · estados de iluminación', async ({ page }, info) => {
  // 1.46: la hora del día se elige en «Ambiente» (mañana, atardecer, noche)
  for (const [name, tod] of [['Mañana', 'morning'], ['Atardecer', 'sunset'], ['Noche', 'night']]) {
    await page.getByRole('button', { name: 'Ambiente' }).click();
    await page.getByRole('radio', { name: new RegExp(name) }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.tod')).toHaveAttribute('data-tod', tod);
    await page.waitForTimeout(500);
    await shot(page, info, `luz-${tod}`);
  }
});

test('17 · diagnóstico de escena (solo desarrollo)', async ({ page }, info) => {
  test.skip(!info.project.name.match(/390x844$|1440x900$|844x390$/), 'capturas de calibración solo en tres encuadres');
  await page.goto('/?sceneDebug=1');
  await page.waitForSelector('.scene-debug__info');
  await shot(page, info, 'main-diagnostico');
});
