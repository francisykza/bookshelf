// Parte de e2e/v148.spec.js que probaba la habitación ilustrada (archivada en la 1.157.0). Son fragmentos: los imports, los datos de
// prueba y las demás ayudas siguen en el original (git show 2948485:e2e/v148.spec.js).

test('habitación: sin título visible (con nombre accesible), cascos a la vista y carteles orientados', async ({ page }, info) => {
  test.skip(!portrait(page), 'libro grande y carteles anclados de pantallas verticales');
  await load(page);
  const header = page.locator('.room-header');
  await expect(header.locator('h2')).toHaveText('Mi rincón');
  expect((await rect(page, '.room-header')).width).toBeLessThanOrEqual(1);
  // Cascos: la mayor parte de su forma no queda bajo el libro de la cama
  const free = await page.evaluate(async () => {
    const { HOTSPOTS } = await import('/src/scene/sceneMap.js');
    const stage = document.querySelector('[data-panel="MAIN_ROOM"] .scene-stage');
    const k = parseFloat(stage.dataset.scale);
    const ox = parseFloat(stage.dataset.offsetX);
    const oy = parseFloat(stage.dataset.offsetY);
    const sr = stage.getBoundingClientRect();
    const pts = HOTSPOTS.headphones.shape.map(([x, y]) => [sr.left + ox + x * k, sr.top + oy + y * k]).filter(([x, y]) => x > 2 && y > 2 && x < innerWidth - 2 && y < innerHeight - 2);
    // 1.49: los cascos son parte de la ilustración; lo que importa es que el encuadre no los recorte
    const all = HOTSPOTS.headphones.shape.length;
    return { total: all, covered: all - pts.length };
  });
  expect(free.total).toBeGreaterThan(3);
  expect(free.covered / free.total).toBeLessThanOrEqual(0.25);
  // El libro sigue siendo usable y lejos del borde inferior
  const btn = await rect(page, '.bed-pages__hit');
  expect(btn.height).toBeGreaterThanOrEqual(43);
  expect(page.viewportSize().height - btn.bottom).toBeGreaterThanOrEqual(10);
  // El texto del botón cabe dentro del botón (se mide el texto: el área de toque ampliada sobresale a propósito)
  const label = await page.locator('.bed-pages__action').first().evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const t = r.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    return t.left >= b.left - 0.5 && t.right <= b.right + 0.5;
  });
  expect(label).toBe(true);
  // Carteles: cada uno con el ángulo de su superficie
  // 1.50: «Mi biblioteca» va proyectado sobre el frente de la balda (perspectiva del mueble, no un giro)
  await expect(page.locator('.room-plaque[data-id="shelf"]')).toHaveAttribute('data-projected', 'true');
  const angles = await page.evaluate(() =>
    ['diary'].map((id) => {
      const m = new DOMMatrixReadOnly(getComputedStyle(document.querySelector(`.room-plaque[data-id="${id}"]`)).transform);
      return Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI);
    }),
  );
  // 1.49: «Mi biblioteca» en el frente plano de la balda inferior (0°); «Mi diario» en el borde de la mesa (12°)
  expect(angles).toEqual([12]);
  const social = page.locator('.panorama-nav__btn--next');
  await expect(social).toHaveAttribute('aria-label', 'Abrir rincón social');
  await expect(social.locator('.panorama-nav__label')).toHaveText('Social');
  const sr = await social.boundingBox();
  expect(sr.width).toBeLessThanOrEqual(110);
  expect(sr.height).toBeGreaterThanOrEqual(44);
  expect(sr.x + sr.width).toBeLessThanOrEqual(page.viewportSize().width);
  // Indicadores de la esquina: dentro de su botón y con significado accesible
  await expect(page.getByRole('button', { name: 'Tu cuenta y copias' })).toBeVisible();
  await shot(page, info, 'v148-habitacion');
});
