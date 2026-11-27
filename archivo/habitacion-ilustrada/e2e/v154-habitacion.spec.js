// Parte de e2e/v154.spec.js que probaba la habitación ilustrada (archivada en la 1.157.0). Son fragmentos: los imports, los datos de
// prueba y las demás ayudas siguen en el original (git show 2948485:e2e/v154.spec.js).

test('baldas de la habitación: toda la biblioteca, figuras en su sitio y toque a «Todos»', async ({ page }, info) => {
  test.skip(!/390x844|1440x900/.test(info.project.name), '390 y escritorio');
  // Biblioteca sin ninguna lectura activa: solo pendientes y leídos
  await load(page, (st) => {
    st.books.forEach((b, i) => {
      b.status = i % 2 ? 'want' : 'read';
    });
  });
  const statuses = await page.evaluate(() => [...document.querySelectorAll('[data-panel="MAIN_ROOM"] .room-spine')].map((el) => el.dataset.status));
  expect(statuses.length).toBeGreaterThan(3);
  expect(new Set(statuses)).toEqual(new Set(['want', 'read']));
  // Las figuras siguen en las baldas de arriba
  const figs = await page.locator('[data-panel="MAIN_ROOM"] .room-figures, [data-panel="MAIN_ROOM"] [data-shelf="top"], [data-panel="MAIN_ROOM"] [data-shelf="middle"]').count();
  // 1.67: con las figuras ocultas, las baldas no llevan ninguna
  if (FIGURES_ENABLED) expect(figs).toBeGreaterThan(0);
  else expect(await page.locator('[data-panel="MAIN_ROOM"] .room-figures').count()).toBe(0);
  await shot(page, info, 'v154-baldas');
  // Tocar un lomo abre la librería en «Todos»
  await page.locator('[data-panel="MAIN_ROOM"] .room-spine').first().evaluate((el) => el.click());
  await expect(page.locator('.library[data-open="true"]')).toBeVisible();
  await expect(page.getByRole('radio', { name: /Todos/ })).toHaveAttribute('aria-checked', 'true');
});
