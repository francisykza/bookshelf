// Parte de e2e/v146.spec.js que probaba la habitación ilustrada (archivada en la 1.157.0). Son fragmentos: los imports, los datos de
// prueba y las demás ayudas siguen en el original (git show 2948485:e2e/v146.spec.js).

test('figuras: proporciones propias, sin taparse con los accesos y previsualizar no cambia lo expuesto', async ({ page }) => {
  test.skip(!FIGURES_ENABLED, 'Figuras ocultas desde la 1.67 (SPEC §67, decisión de Francisco del 1-11-2026): vuelve con FIGURES_ENABLED');
  await loadWithFigures(page, [{ id: 'guardian_clavos', display: 'box' }, { id: 'maestro_superviviente', display: 'box' }, null, null]);
  const figs = await page.evaluate(() =>
    [...document.querySelectorAll('.room-figure')].map((b) => {
      const img = b.querySelector('img');
      return { ratio: b.offsetWidth / b.offsetHeight, natural: img.naturalWidth / img.naturalHeight, box: b.getBoundingClientRect().toJSON() };
    }),
  );
  expect(figs).toHaveLength(2);
  // Cada pieza con su proporción (la caja doble no se comprime para parecer individual)
  for (const f of figs) expect(Math.abs(f.ratio - f.natural)).toBeLessThan(0.04);
  expect(figs[1].ratio).toBeGreaterThan(figs[0].ratio * 1.5);
  // Ningún acceso de papel tapa una figura
  const plaques = await page.evaluate(() => [...document.querySelectorAll('.room-plaque, .panorama-nav__btn--next')].map((p) => p.getBoundingClientRect().toJSON()));
  const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  for (const f of figs) for (const p of plaques) expect(overlap(f.box, p)).toBe(false);
  // Previsualizar la figura suelta no cambia la habitación; «Exponer…» sí
  await page.locator('.room-figure').first().evaluate((el) => el.click());
  await page.getByRole('radio', { name: 'Figura' }).click();
  await expect(page.locator('.room-figure').first()).toHaveAttribute('data-display', 'box');
  expect((await figuresOf(page)).shelf[0].display).toBe('box');
  await page.getByRole('button', { name: 'Exponer la figura suelta' }).click();
  await expect.poll(async () => (await figuresOf(page)).shelf[0].display).toBe('unboxed');
});

test('figuras: cambiar a una posición ocupada intercambia sin perder piezas y todo persiste al recargar', async ({ page }) => {
  test.skip(!FIGURES_ENABLED, 'Figuras ocultas desde la 1.67 (SPEC §67, decisión de Francisco del 1-11-2026): vuelve con FIGURES_ENABLED');
  await loadWithFigures(page, [{ id: 'guardian_clavos', display: 'unboxed' }, null, { id: 'maestro_superviviente', display: 'box' }, null]);
  await page.locator('.room-figure').first().evaluate((el) => el.click());
  await page.getByRole('button', { name: 'Cambiar de balda' }).click();
  await page.getByRole('button', { name: /Balda central, izquierda/ }).click();
  await page.getByRole('button', { name: 'Intercambiar' }).click();
  await expect.poll(async () => (await figuresOf(page)).shelf.map((s) => s && `${s.id}:${s.display}`)).toEqual(['maestro_superviviente:box', null, 'guardian_clavos:unboxed', null]);
  // Guardar en el ático: deja el hueco, la figura sigue siendo tuya con sus piezas
  await page.getByRole('button', { name: 'Guardar en el ático' }).click();
  await expect.poll(async () => (await figuresOf(page)).shelf[2]).toBeNull();
  const fs = await figuresOf(page);
  expect(fs.owned.guardian_clavos.parts).toEqual([0]);
  await page.keyboard.press('Escape');
  await page.reload();
  await esperarInicio(page);
  await expect(page.locator('.room-figure')).toHaveCount(1);
  await expect(page.locator('.room-figure')).toHaveAttribute('data-display', 'box');
});

// ── Pantalla del portátil (SPEC §42) ──
test('portátil: la ventana del calendario cabe en la pantalla, fuera de lo que tapan la planta y el vaso', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .laptop-screen .cal')?.offsetWidth > 0);
  const m = await page.evaluate(() => {
    const screen = document.querySelector('[data-panel="MAIN_ROOM"] .laptop-screen');
    const win = screen.querySelector('.cal[data-variant="scene"]');
    const line = win.querySelector('.cal__today-line');
    const body = win.querySelector('.cal__scene-body');
    // Medidas en el lienzo de la pantalla (300 × 248), antes de proyectarlo sobre el monitor
    return {
      screen: [screen.offsetWidth, screen.offsetHeight],
      win: { l: win.offsetLeft, t: win.offsetTop, r: win.offsetLeft + win.offsetWidth, b: win.offsetTop + win.offsetHeight },
      lineCut: line.scrollWidth > line.clientWidth + 1,
      bodyCut: body.scrollHeight > body.clientHeight + 1,
      cells: win.querySelectorAll('.cal__cell').length,
      today: win.querySelectorAll('.cal__cell[data-today="true"]').length,
    };
  });
  expect(m.screen).toEqual([300, 248]);
  expect(m.win.l).toBeGreaterThanOrEqual(8);
  expect(m.win.t).toBeGreaterThanOrEqual(8);
  // La planta pintada tapa x ≥ 250 y el vaso x ≥ 180 con y ≥ 165: la ventana queda a la izquierda y por encima
  expect(m.win.r).toBeLessThanOrEqual(248);
  expect(m.win.b).toBeLessThanOrEqual(165);
  // Centrada en la zona visible (0–250), con el mes entero y la línea de hoy sin cortar
  expect(Math.abs((m.win.l + m.win.r) / 2 - 125)).toBeLessThanOrEqual(8);
  expect(m.lineCut).toBe(false);
  expect(m.bodyCut).toBe(false);
  expect(m.cells).toBeGreaterThanOrEqual(28);
  expect(m.today).toBe(1);
});

// ── Figuras en las baldas (SPEC §37, §41): dos por balda, con y sin caja ──
const figuresOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).progress.figures);

// En horizontal (móvil apaisado y escritorio) el encuadre no muestra las baldas superiores: allí la vitrina se
// ofrece en «Guías › Fuera de vista» (SPEC §19.5) y no hay figuras que medir
const portraitOnly = (page) => test.skip(page.viewportSize().width > page.viewportSize().height, 'el encuadre horizontal no muestra las baldas de figuras');

async function loadWithFigures(page, shelf) {
  portraitOnly(page);
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/');
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.waitForTimeout(400);
  const seeded = await page.evaluate((sh) => {
    const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
    const t = new Date().toISOString();
    st.progress.figures.owned = { ...(st.progress.figures.owned || {}), guardian_clavos: { obtainedAt: t, parts: [0] }, maestro_superviviente: { obtainedAt: t, parts: [0] } };
    st.progress.figures.shelf = sh;
    return JSON.stringify(st);
  }, shelf);
  await page.addInitScript((v) => {
    // Solo la primera carga con estos datos: las recargas siguientes leen lo que la app haya guardado
    if (!sessionStorage.getItem('v146-seeded')) {
      localStorage.setItem('bookshelf:v1', v);
      sessionStorage.setItem('v146-seeded', '1');
    }
  }, seeded);
  await page.reload();
  await esperarInicio(page);
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('.room-figure img')];
    return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0);
  });
}
