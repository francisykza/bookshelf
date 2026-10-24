// QA de la integración diegética (SPEC §19): calendario encendido en el portátil, libro abierto con la lectura
// actual, lomos físicos, navegación discreta y movimiento ambiental. Perfil vacío (datos de ejemplo).
import { expect, test } from '@playwright/test';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const run = { project: '', tests: {}, pageErrors: [], data: {}, screenshots: [], videos: [] };

test.beforeEach(async ({ page }, info) => {
  run.project = info.project.name;
  page.on('pageerror', (err) => run.pageErrors.push({ test: info.title, text: String(err) }));
  await page.addInitScript(() => {
    try {
      localStorage.setItem('bookshelf_onboarding_done', 'true');
    } catch {
      // sin almacenamiento
    }
  });
});
test.afterEach(async ({ page: _page }, info) => {
  run.tests[info.title] = { status: info.status, error: info.error?.message?.split('\n')[0] ?? null };
});
test.afterAll(async ({ browserName: _b }, info) => {
  const dir = join('qa-report', 'telemetry');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${run.project}-diegetic-w${info.workerIndex}.json`), JSON.stringify(run, null, 2));
});

async function shot(page, info, name, clip) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.png`);
  await page.screenshot({ path: file, clip });
  run.screenshots.push(file.replaceAll('\\', '/'));
}

/** Cambia los datos guardados ANTES de que la app los lea (como en v123.spec). */
const setStored = (fn) => `(() => { try { const st = JSON.parse(localStorage.getItem('bookshelf:v1')); if (!st) return; (${fn})(st); localStorage.setItem('bookshelf:v1', JSON.stringify(st)); } catch (e) {} })()`;
async function load(page, mutate) {
  if (mutate) await page.addInitScript(setStored(mutate));
  await page.goto('/');
  if (mutate) {
    await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
    await page.reload();
  }
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.waitForTimeout(400);
}

/** Recorte de pantalla de un rectángulo de la ilustración (para capturas de detalle). */
const clipOf = (page, x0, y0, x1, y1) =>
  page.evaluate(([x0, y0, x1, y1]) => {
    const st = document.querySelector('[data-panel="MAIN_ROOM"] .scene-stage');
    const k = +st.dataset.scale;
    const ox = +st.dataset.offsetX;
    const oy = +st.dataset.offsetY;
    const x = Math.max(0, ox + x0 * k);
    const y = Math.max(0, oy + y0 * k);
    return { x, y, width: Math.min(innerWidth - x, (x1 - x0) * k), height: Math.min(innerHeight - y, (y1 - y0) * k) };
  }, [x0, y0, x1, y1]);

test('calendario encendido: mes, lunes primero, hoy, actividad real, dentro del bisel y sin post-it', async ({ page }, info) => {
  await load(page);
  await expect(page.locator('.lid-note')).toHaveCount(0);
  await expect(page.locator('.laptop-screen')).toHaveCount(1);
  const r = await page.evaluate(async () => {
    const { LAPTOP_DISPLAY } = await import('/src/scene/sceneMap.js');
    const { isActive } = await import('/src/domain/reading.js');
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const month = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
    const prefix = today.slice(0, 7);
    const expectedRead = [...new Set(st.progress.readingLog.filter((e) => e.date.startsWith(prefix) && isActive(e)).map((e) => Number(e.date.slice(8))))].sort((a, b) => a - b);
    const grid = document.querySelector('.laptop-screen__grid');
    const kids = [...grid.children];
    const wd = kids.slice(0, 7).map((k) => k.textContent);
    const blanks = kids.slice(7).findIndex((k) => k.textContent);
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const shownRead = [...grid.querySelectorAll('[data-read]')].map((k) => Number(k.textContent)).sort((a, b) => a - b);
    // Dentro del bisel: las esquinas proyectadas de la pantalla están en el quad interior medido
    const stage = document.querySelector('[data-panel="MAIN_ROOM"] .scene-stage');
    const k = +stage.dataset.scale;
    const ox = +stage.dataset.offsetX;
    const oy = +stage.dataset.offsetY;
    const b = document.querySelector('.laptop-screen__glass').getBoundingClientRect();
    const xs = LAPTOP_DISPLAY.map((p) => ox + p[0] * k);
    const ys = LAPTOP_DISPLAY.map((p) => oy + p[1] * k);
    const quad = { l: Math.min(...xs), t: Math.min(...ys), r: Math.max(...xs), b: Math.max(...ys) };
    return {
      monthText: document.querySelector('.laptop-screen__month').textContent,
      monthExpected: month.charAt(0).toUpperCase() + month.slice(1),
      wd,
      blanks,
      blanksExpected: (first.getDay() + 6) % 7,
      todayShown: Number(document.querySelector('.laptop-screen__day[data-today]').textContent),
      todayExpected: now.getDate(),
      shownRead,
      expectedRead,
      inside: b.left >= quad.l - 1.5 && b.top >= quad.t - 1.5 && b.right <= quad.r + 1.5 && b.bottom <= quad.b + 1.5,
    };
  });
  run.data.calendar = r;
  expect(r.monthText).toBe(r.monthExpected);
  expect(r.wd).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
  expect(r.blanks).toBe(r.blanksExpected);
  expect(r.todayShown).toBe(r.todayExpected);
  expect(r.shownRead).toEqual(r.expectedRead);
  // WebKit en Windows no aplica matrix3d proyectivo (limitación del entorno, §19.8): ahí no se mide el bisel
  if (info.project.name.startsWith('webkit')) info.annotations.push({ type: 'limitación', description: 'matrix3d proyectivo no disponible en WebKit/Windows' });
  else expect(r.inside).toBe(true);
  const clip = await clipOf(page, 700, 970, 930, 1150);
  if (clip.width > 20 && clip.height > 20) await shot(page, info, 'diegetic-portatil', clip);
});

test('el calendario se actualiza al registrar lectura y tocar la pantalla abre Calendario', async ({ page }) => {
  // Sin lecturas hoy: el día de hoy aparece sin marca hasta registrar una
  await load(page, (st) => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    st.progress.readingLog = st.progress.readingLog.filter((e) => e.date !== today);
  });
  await expect(page.locator('.laptop-screen__day[data-today]')).not.toHaveAttribute('data-read');
  await page.locator('.hotspot[data-id="laptop"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.window__title')).toContainText('Calendario');
  await page.locator('.cal__cell[data-today="true"]').click();
  const form = page.locator('.cal-pop .reading-form');
  await form.getByRole('radio', { name: 'He leído' }).evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await form.getByRole('radio', { name: 'He leído' }).click();
  await form.locator('input[inputmode="numeric"]').evaluate((el) => {
    el.scrollIntoView({ block: 'center' });
    el.focus({ preventScroll: true });
  });
  await page.keyboard.type('6');
  await form.getByRole('button', { name: 'Guardar lectura' }).evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await form.getByRole('button', { name: 'Guardar lectura' }).click();
  await expect(form.locator('.reading-form__saved')).toHaveText('✓ Guardado');
  await page.keyboard.press('Escape');
  await expect(page.locator('.laptop-screen__day[data-today]')).toHaveAttribute('data-read');
});

test('el libro abierto muestra la lectura actual y cambia con ella', async ({ page }, info) => {
  await load(page);
  const current = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
    return st.books.find((b) => b.id === st.settings.currentBookId);
  });
  await expect(page.locator('.open-pages__title')).toHaveText(current.title);
  await expect(page.locator('.open-pages__kicker')).toHaveText('Tu lectura');
  await expect(page.locator('.open-pages__plate')).toHaveCount(1);
  // La lámina nunca está vacía: portada generada de base aunque la real tarde en llegar
  await expect(page.locator('.open-pages__plate .gen-cover').first()).toBeVisible();
  const text = await page.locator('.open-pages__progress').textContent();
  expect(text).not.toMatch(/NaN|undefined/);
  // Las dos páginas son superficies separadas que no cruzan el pliegue (cada una con su quad)
  const crossing = await page.evaluate(async () => {
    const { BOOK_LEFT_PAGE, BOOK_RIGHT_PAGE } = await import('/src/scene/sceneMap.js');
    const maxLeft = Math.max(...BOOK_LEFT_PAGE.map((p) => p[0]));
    const minRight = Math.min(...BOOK_RIGHT_PAGE.map((p) => p[0]));
    return { maxLeft, minRight };
  });
  expect(crossing.maxLeft).toBeLessThan(548);
  const clip = await clipOf(page, 220, 1330, 900, 1672);
  if (clip.width > 20 && clip.height > 20) await shot(page, info, 'diegetic-libro', clip);
  // Tocar el libro abre su ficha
  await page.locator('.hotspot[data-id="book"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.open-book')).toBeVisible();
});

test('libro: otra lectura, sin lectura, título largo, sin portada y sin total de páginas', async ({ page }) => {
  await load(page, (st) => {
    const b = st.books.find((x) => x.id === 'hail-mary');
    st.settings.currentBookId = 'hail-mary';
    b.title = 'Un título larguísimo que no cabe de ninguna manera en la página del libro abierto de la cama';
    b.cover = '';
    b.pageCount = null;
    b.trackBy = 'percent';
    b.currentPercent = 37.5;
  });
  await expect(page.locator('.open-pages__title')).toContainText('Un título larguísimo');
  const t = await page.locator('.open-pages__title').evaluate((el) => ({ clamped: el.scrollHeight > el.clientHeight + 1, overflowPage: el.closest('.open-pages__page').scrollWidth > el.closest('.open-pages__page').clientWidth + 1 }));
  expect(t.clamped).toBe(true);
  expect(t.overflowPage).toBe(false);
  await expect(page.locator('.open-pages__plate .gen-cover')).toHaveCount(1);
  await expect(page.locator('.open-pages__progress')).toHaveText(/^37,5\s%\sleído$/);
  // Sin ninguna lectura en curso
  await page.addInitScript(
    setStored((st) => {
      st.books.forEach((b) => {
        if (b.status === 'reading') b.status = 'want';
      });
      st.settings.currentBookId = null;
    }),
  );
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await expect(page.locator('.open-pages__kicker')).toHaveText('Tu próxima historia empieza aquí');
  await expect(page.locator('.open-pages__title')).toHaveCount(0);
});

test('lomos: apoyados en la balda, sin cruzarse, deterministas, dorado no generalizado', async ({ page }, info) => {
  await load(page);
  const measure = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.room-shelf[data-shelf^="cabinet"]')].map((shelf) => {
        const H = shelf.offsetHeight;
        const W = shelf.offsetWidth;
        const spines = [...shelf.querySelectorAll('.room-spine')].map((el) => ({ x: el.offsetLeft, w: el.offsetWidth, h: el.offsetHeight, bottom: el.offsetTop + el.offsetHeight, foil: el.hasAttribute('data-foil'), title: Boolean(el.querySelector('.room-spine__title')), material: el.dataset.material }));
        return { H, W, spines };
      }),
    );
  const a = await measure();
  run.data.spines = a;
  for (const row of a) {
    for (const s of row.spines) {
      expect(Math.abs(s.bottom - (row.H - 1))).toBeLessThanOrEqual(1);
      expect(s.x + s.w).toBeLessThanOrEqual(row.W);
    }
    for (let i = 1; i < row.spines.length; i += 1) expect(row.spines[i].x).toBeGreaterThanOrEqual(row.spines[i - 1].x + row.spines[i - 1].w + 1);
  }
  const all = a.flatMap((r) => r.spines);
  if (all.length >= 3) expect(all.filter((s) => s.foil).length).toBeLessThan(all.length);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  expect((await measure()).map((r) => r.spines.map((s) => s.h))).toEqual(a.map((r) => r.spines.map((s) => s.h)));
  const clip = await clipOf(page, 100, 480, 350, 820);
  if (clip.width > 20 && clip.height > 20) await shot(page, info, 'diegetic-lomos', clip);
});

test('navegación discreta: chevrón accesible y «Fuera de vista» dentro de Guías', async ({ page }, info) => {
  await load(page);
  const next = page.locator('.panorama-nav__btn--next');
  await expect(next).toHaveAttribute('aria-label', 'Ir al Salón Social');
  const box = await next.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeLessThanOrEqual(60);
  const glyph = await next.locator('svg').boundingBox();
  expect(glyph.width).toBeGreaterThanOrEqual(16);
  expect(glyph.width).toBeLessThanOrEqual(24);
  await expect(page.locator('.offscreen')).toHaveCount(0);
  await page.locator('.guides-toggle').click();
  await expect(page.getByRole('button', { name: 'Repetir la guía de la habitación' })).toBeVisible();
  const off = await page.locator('.guides-menu__list button').allTextContents();
  run.data.guidesMenu = off;
  await shot(page, info, 'diegetic-guias');
  // Si hay objetos recortados, tocar uno funciona (en 1440 × 900 la lámpara queda fuera)
  const lamp = page.locator('.guides-menu__list button', { hasText: /Lámpara/ });
  if (await lamp.count()) {
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).settings.lampOn);
    await lamp.click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).settings.lampOn)).toBe(!before);
  } else {
    await page.keyboard.press('Escape');
  }
  await next.click();
  await page.waitForTimeout(950);
  await expect(page.locator('.panorama-nav__btn--prev')).toHaveAttribute('aria-label', 'Volver a Mi Habitación');
});

test('movimiento: destellos en el agua, vela anclada, motas limitadas, pausa fuera de la habitación', async ({ page }, info) => {
  await load(page);
  const reduced = info.project.name.includes('reduced');
  const r = await page.evaluate(async () => {
    const { ROOMS } = await import('/src/scene/sceneMap.js');
    const { insidePolygon } = await import('/src/scene/sea.js');
    const glints = [...document.querySelectorAll('[data-panel="MAIN_ROOM"] .sea-glint')].map((el) => [parseFloat(el.style.left) + parseFloat(el.style.width) / 2, parseFloat(el.style.top)]);
    return {
      glints: glints.length,
      glintsInWater: glints.every((p) => ROOMS.MAIN_ROOM.sea.water.some((poly) => insidePolygon(p, poly))),
      dust: document.querySelectorAll('[data-panel="MAIN_ROOM"] .dust-mote').length,
      flame: document.querySelectorAll('.candle-flame').length,
      running: document.querySelector('.ambient-life')?.hasAttribute('data-running'),
      bayRunning: document.querySelector('[data-panel="MAIN_ROOM"] .bay')?.hasAttribute('data-running'),
      flameAnim: getComputedStyle(document.querySelector('.candle-flame__body')).animationName,
    };
  });
  run.data.motion = r;
  expect(r.glints).toBeGreaterThan(0);
  expect(r.glintsInWater).toBe(true);
  expect(r.dust).toBeLessThanOrEqual(16);
  expect(r.flame).toBe(1);
  if (reduced) {
    expect(r.flameAnim).toBe('none');
    await shot(page, info, 'diegetic-reducido');
  } else {
    expect(r.running).toBe(true);
    expect(r.bayRunning).toBe(true);
  }
  // En el salón, la habitación principal se detiene; al volver, sin capas duplicadas
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  expect(await page.evaluate(() => document.querySelector('.ambient-life').hasAttribute('data-running'))).toBe(false);
  await page.locator('.panorama-nav__btn--prev').click();
  await page.waitForTimeout(950);
  expect(await page.evaluate(() => document.querySelectorAll('.ambient-life').length)).toBe(1);
  expect(await page.locator('[data-panel="MAIN_ROOM"] .sea-glint').count()).toBe(r.glints);
  // Vela apagada: ni llama ni resplandor
  await page.evaluate(() => document.querySelector('.hotspot[data-id="lantern"]')?.click());
  await expect(page.locator('.candle-flame')).toHaveCount(0);
});

test('grabación de 14 s de la escena en reposo y fluidez medida', async ({ browser }, info) => {
  test.skip(!['chromium-390x844', 'chromium-1440x900'].includes(info.project.name), 'una grabación por encuadre representativo');
  const dir = join('qa-report', 'videos');
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ ...info.project.use, recordVideo: { dir, size: info.project.use.viewport } });
  await context.addInitScript(() => localStorage.setItem('bookshelf_onboarding_done', 'true'));
  const page = await context.newPage();
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  const fps = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let n = 0;
        const t0 = performance.now();
        const tick = (t) => {
          n += 1;
          if (t - t0 < 3000) requestAnimationFrame(tick);
          else resolve(Math.round((n / (t - t0)) * 1000));
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.waitForTimeout(11000);
  const video = page.video();
  await context.close();
  const target = join(dir, `${info.project.name}-ambiente.webm`);
  renameSync(await video.path(), target);
  run.videos.push(target.replaceAll('\\', '/'));
  run.data.fps = fps;
  // Medición informativa en este entorno (Chromium sin cabeza): no es una garantía en móviles reales
  expect(fps).toBeGreaterThan(20);
});
