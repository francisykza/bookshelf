// QA de la coherencia gouache (SPEC §21): etiquetas y temporizador dentro del viewport, el calendario de la
// pantalla como vista compacta del calendario interior, lomos mates y capturas de revisión. Perfil de ejemplo.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const run = { project: '', tests: {}, pageErrors: [], data: {}, screenshots: [] };

test.beforeEach(async ({ page }, info) => {
  run.project = info.project.name;
  page.on('pageerror', (err) => run.pageErrors.push({ test: info.title, text: String(err) }));
  await page.addInitScript(() => {
    try {
      localStorage.setItem('bookshelf_onboarding_done', 'true');
      // 1.37.0: la ayuda de las señales (descartable, probada en v135) se da por vista para medir la escena despejada
      localStorage.setItem('bookshelf:signs-hint-done', 'true');
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
  writeFileSync(join(dir, `${run.project}-gouache-w${info.workerIndex}.json`), JSON.stringify(run, null, 2));
});

async function shot(page, info, name, clip) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.png`);
  await page.screenshot({ path: file, clip });
  run.screenshots.push(file.replaceAll('\\', '/'));
}

async function load(page) {
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.waitForTimeout(400);
}

/** Rectángulo de pantalla de una zona de la ilustración (para recortes de revisión). */
const clipOf = (page, x0, y0, x1, y1) =>
  page.evaluate(([x0, y0, x1, y1]) => {
    const el = document.querySelector('[data-panel="MAIN_ROOM"] .scene-base').getBoundingClientRect();
    const k = el.width / 941;
    const x = Math.max(0, el.left + x0 * k);
    const y = Math.max(0, el.top + y0 * k);
    return { x, y, width: Math.min(innerWidth - x, (x1 - x0) * k), height: Math.min(innerHeight - y, (y1 - y0) * k) };
  }, [x0, y0, x1, y1]);

const insideViewport = (sel) =>
  sel.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { inside: r.left >= 11.5 && r.top >= 11.5 && r.right <= innerWidth - 11.5 && r.bottom <= innerHeight - 11.5, rect: [r.left, r.top, r.right, r.bottom].map(Math.round) };
  });

test('etiquetas: fuera del lienzo escalado y siempre dentro del viewport (también junto al borde)', async ({ page }, info) => {
  await load(page);
  const ids = await page.evaluate(() => [...document.querySelectorAll('[data-panel="MAIN_ROOM"] .hotspot')].map((h) => h.dataset.id));
  const results = {};
  for (const id of ids) {
    const spot = page.locator(`[data-panel="MAIN_ROOM"] .hotspot[data-id="${id}"]`);
    // Solo los objetos que el encuadre deja ver (los recortados se ofrecen en «Guías»)
    const visible = await spot.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight;
    });
    if (!visible) continue;
    await spot.focus();
    const label = page.locator('.room-label[data-placed]');
    await expect(label).toHaveCount(1);
    await page.waitForTimeout(80);
    const r = await insideViewport(label);
    const inWorld = await label.evaluate((el) => Boolean(el.closest('.scene-world')));
    results[id] = r;
    expect.soft(r.inside, `${id} ${r.rect}`).toBe(true);
    expect.soft(inWorld, id).toBe(false);
    await spot.blur();
  }
  run.data.labels = results;
  // La del temporizador (la que se cortaba) junto al borde derecho
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="tray"]').focus();
  await page.waitForTimeout(150);
  await shot(page, info, 'gouache-etiqueta-tray');
});

test('toque: abre la función y no deja una tarjeta encima de la escena', async ({ page }, info) => {
  test.skip(!info.project.use.hasTouch, 'solo con pantalla táctil');
  await load(page);
  // 1.49: con el encuadre vertical que deja ver los cascos, el vaso queda fuera de pantalla y se abre desde
  // «Guías › Fuera de vista»; si está a la vista, tocándolo
  const tray = page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="tray"]');
  const tb = await tray.boundingBox();
  if (tb && tb.x + tb.width / 2 < page.viewportSize().width) await tray.tap();
  else {
    await page.locator('.guides-toggle').tap();
    await page.locator('.guides-menu__list').getByRole('button', { name: /Té helado/ }).tap();
  }
  await expect(page.locator('.panel .tray')).toBeVisible();
  // En un móvil se cierra tocando «Cerrar» (con Escape, que es teclado, el foco devuelto sí muestra la etiqueta)
  await page.getByRole('button', { name: 'Cerrar la bandeja' }).tap();
  await expect(page.locator('.panel .tray')).toHaveCount(0);
  await page.waitForTimeout(300);
  await expect(page.locator('.room-label')).toHaveCount(0);
});

test('temporizador: panel en portal, dentro del viewport, cierre y reloj visibles con scroll', async ({ page }, info) => {
  await load(page);
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="tray"]').focus();
  await page.keyboard.press('Enter');
  const tray = page.locator('.panel .tray');
  await expect(tray).toBeVisible();
  await page.waitForTimeout(700);
  const r = await insideViewport(tray);
  run.data.tray = r;
  expect(r.inside).toBe(true);
  // Portal: fuera del track panorámico transformado
  expect(await tray.evaluate((el) => Boolean(el.closest('.panorama-track')))).toBe(false);
  const close = page.getByRole('button', { name: 'Cerrar la bandeja' });
  await expect(close).toBeInViewport();
  await shot(page, info, 'gouache-temporizador');
  // Al desplazar el contenido, «Cerrar» y el reloj siguen a la vista
  await page.locator('.tray__wood').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(150);
  await expect(close).toBeInViewport();
  await expect(page.locator('.tray__clock strong')).toBeInViewport();
  await close.click();
  await expect(tray).toHaveCount(0);
});

test('calendario: la pantalla es la vista compacta del calendario interior (datos y diseño)', async ({ page }, info) => {
  await load(page);
  const scene = await page.evaluate(() => {
    const root = document.querySelector('.laptop-screen .cal[data-variant="scene"]');
    const cells = Object.fromEntries([...root.querySelectorAll('.cal__cell')].map((c) => [c.textContent.trim(), c.dataset.heat]));
    const today = root.querySelector('.cal__cell[data-today="true"]');
    const css = (el, p) => getComputedStyle(el)[p];
    return {
      month: root.querySelector('.cal__head h3').textContent,
      title: root.querySelector('.window__title').textContent,
      cells,
      today: today.textContent.trim(),
      fonts: { h3: css(root.querySelector('.cal__head h3'), 'fontFamily'), title: css(root.querySelector('.window__title'), 'fontFamily') },
      colors: { cell: css(root.querySelector('.cal__cell[data-heat="0"]'), 'backgroundColor'), heat: Object.fromEntries(['1', '2', '3', '4'].map((h) => [h, root.querySelector(`.cal__cell[data-heat="${h}"]`) ? css(root.querySelector(`.cal__cell[data-heat="${h}"]`), 'backgroundColor') : null])), ring: css(today, 'boxShadow'), bar: css(root.querySelector('.window__bar'), 'backgroundImage') },
      line: root.querySelector('.cal__today-line').textContent,
      buttons: root.querySelectorAll('button').length,
    };
  });
  const clip = await clipOf(page, 700, 960, 941, 1170);
  if (clip.width > 20 && clip.height > 20) await shot(page, info, 'gouache-portatil', clip);
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="laptop"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.panel .pc-win:not([hidden]) .pc-win__title')).toContainText('Mi diario'); // 1.35.0: la app «Calendario» es «Mi diario» (abre en Calendario)
  await page.waitForTimeout(600);
  const panel = await page.evaluate(() => {
    const root = document.querySelector('.pc-win .cal');
    const cells = Object.fromEntries([...root.querySelectorAll('.cal__cell')].map((c) => [c.querySelector('.cal__num').textContent.trim(), c.dataset.heat]));
    const css = (el, p) => getComputedStyle(el)[p];
    return {
      month: root.querySelector('.cal__head h3').textContent,
      cells,
      today: root.querySelector('.cal__cell[data-today="true"] .cal__num').textContent.trim(),
      fonts: { h3: css(root.querySelector('.cal__head h3'), 'fontFamily'), title: css(document.querySelector('.panel .pc-win:not([hidden]) .pc-win__title'), 'fontFamily') },
      colors: { cell: root.querySelector('.cal__cell[data-heat="0"]') ? css(root.querySelector('.cal__cell[data-heat="0"]'), 'backgroundColor') : null, heat: Object.fromEntries(['1', '2', '3', '4'].map((h) => [h, root.querySelector(`.cal__cell[data-heat="${h}"]`) ? css(root.querySelector(`.cal__cell[data-heat="${h}"]`), 'backgroundColor') : null])), bar: css(document.querySelector('.panel .pc-win__head'), 'backgroundImage') },
    };
  });
  await shot(page, info, 'gouache-calendario-abierto');
  run.data.calendar = { scene, panel };
  // Mismos datos: mes, hoy e intensidad de cada día
  expect(scene.month).toBe(panel.month);
  expect(scene.today).toBe(panel.today);
  expect(scene.cells).toEqual(panel.cells);
  // 1.42.0 (SPEC §34): el ordenador se ha rediseñado y la pantalla de la habitación conserva su diseño aprobado;
  // ya no se exigen la misma tipografía ni los mismos colores, solo los mismos datos (arriba)
  expect(scene.colors.ring).toMatch(/rgb\(196, 98, 58\)/);
  expect(scene.title).toContain('Calendario');
  expect(scene.line).toMatch(/^Hoy · /);
  // Las celdas proyectadas no son objetivos táctiles
  expect(scene.buttons).toBe(0);
});

test('lomos ilustrados (1.29.0): textura gouache determinista, sin adornos CSS duplicados, tinta según la textura', async ({ page }, info) => {
  await load(page);
  const read = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.room-spine')].map((el) => {
        const cs = getComputedStyle(el);
        const t = el.querySelector('.room-spine__title');
        return { id: el.getAttribute('aria-label'), edition: el.dataset.edition, art: el.dataset.art ?? null, ink: el.dataset.ink, bg: cs.backgroundImage, shadow: cs.boxShadow, ornaments: el.querySelectorAll('.room-spine__band, .room-spine__emblem, .room-spine__label, .room-spine__nerves').length, title: t ? { font: getComputedStyle(t).fontFamily, color: getComputedStyle(t).color } : null };
      }),
    );
  const spines = await read();
  run.data.spines = spines;
  // Las texturas cargan (ninguna petición fallida de lomos)
  const loaded = await page.evaluate(() => Promise.all([...new Set([...document.querySelectorAll('.room-spine[data-art]')].map((el) => getComputedStyle(el).backgroundImage.slice(5, -2)))].map((src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i.naturalWidth > 0); i.onerror = () => ok(false); i.src = src; }))));
  expect(loaded.every(Boolean)).toBe(true);
  for (const s of spines) {
    const device = ['kindle', 'audiobook'].includes(s.edition);
    if (device) {
      expect.soft(s.art, s.id).toBeNull();
      continue;
    }
    expect.soft(s.bg, s.id).toMatch(/room-refresh\/lomos\/web\/lomo-\d{2}\.webp/);
    // Los relieves y ornamentos están pintados: ninguno añadido en CSS; sin bisel ni halo alrededor
    expect.soft(s.ornaments, s.id).toBe(0);
    expect.soft(s.shadow, s.id).toBe('none');
    // Tinta del título según la textura: oscura #2C1E14 en las claras, crema #F6EFE2 en las oscuras
    expect.soft(s.ink, s.id).toBe(['2', '5', '9', '10', '12'].includes(s.art) ? 'dark' : 'light');
    if (s.title) {
      expect.soft(s.title.font, s.id).toMatch(/Lora/);
      expect.soft(s.title.color, s.id).toBe(s.ink === 'dark' ? 'rgb(44, 30, 20)' : 'rgb(246, 239, 226)');
    }
  }
  // Determinista: la misma textura para cada libro al recargar
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  expect((await read()).map((s) => [s.id, s.art])).toEqual(spines.map((s) => [s.id, s.art]));
  const clip = await clipOf(page, 100, 480, 350, 820);
  if (clip.width > 20 && clip.height > 20) await shot(page, info, 'gouache-lomos', clip);
});

test('capturas de revisión: habitación en reposo y libro de la cama', async ({ page }, info) => {
  await load(page);
  await shot(page, info, 'gouache-habitacion');
  const clip = await clipOf(page, 220, 1330, 900, 1672);
  if (clip.width > 20 && clip.height > 20) await shot(page, info, 'gouache-libro', clip);
});

test('elementos sueltos: nada invisible intercepta toques y no quedan etiquetas al cambiar de habitación', async ({ page }) => {
  await load(page);
  // En el centro de cada objeto visible, lo que recibe el toque es su propio botón (o su insignia)
  const hits = await page.evaluate(() =>
    [...document.querySelectorAll('[data-panel="MAIN_ROOM"] .hotspot')]
      .map((h) => {
        const r = h.getBoundingClientRect();
        const pts = [
          [r.left + r.width / 2, r.top + r.height / 2],
          [r.left + r.width * 0.4, r.top + r.height * 0.6],
        ].filter(([x, y]) => x > 0 && y > 0 && x < innerWidth && y < innerHeight);
        const ok = pts.some(([x, y]) => {
          const el = document.elementFromPoint(x, y);
          // 1.46: el libro pintado queda bajo el libro grande de la cama, que hace su función
          return el === h || h.contains(el) || el?.closest('.hotspot-badge, .room-spine, .time-dial, .panorama-nav, .room-corner, .guides-menu') || (h.dataset.id === 'book' && el?.closest('.bed-pages__hit'));
        });
        return { id: h.dataset.id, tested: pts.length > 0, ok, top: pts.length ? document.elementFromPoint(...pts[0])?.className : null };
      })
      .filter((x) => x.tested),
  );
  run.data.hits = hits;
  for (const h of hits) expect.soft(h.ok, `${h.id} → ${h.top}`).toBe(true);
  // Las capas decorativas nuevas no reciben toques
  const pe = await page.evaluate(() => ['.laptop-foreground', '.laptop-screen', '.bed-pages:not(.bed-pages--actions)', '.ambient-life', '.room-shelf-lips'].map((s) => [s, document.querySelector(s) ? getComputedStyle(document.querySelector(s)).pointerEvents : 'none']));
  for (const [sel, value] of pe) expect.soft(value, sel).toBe('none');
  // Etiqueta abierta y cambio de habitación: se retira y la habitación inactiva queda inerte
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="laptop"]').focus();
  await expect(page.locator('.room-label')).toHaveCount(1);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await expect(page.locator('.room-label')).toHaveCount(0);
  expect(await page.locator('[data-panel="MAIN_ROOM"]').evaluate((el) => el.inert || el.closest('[inert]') !== null)).toBe(true);
});
