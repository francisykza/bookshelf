// Parte de e2e/v147.spec.js que probaba la habitación ilustrada (archivada en la 1.157.0). Son fragmentos: los imports, los datos de
// prueba y las demás ayudas siguen en el original (git show 2948485:e2e/v147.spec.js).

test('habitación: encabezado sin solaparse, accesos de 44 px, título sin guiones y libro lejos del borde', async ({ page }, info) => {
  test.skip(!portrait(page), 'el libro grande y el encabezado en dos filas son de pantallas verticales');
  await load(page);
  const header = await rect(page, '.room-header');
  const corner = await rect(page, '.room-corner');
  expect(overlap(header, corner)).toBe(false);
  // 1.50: «Mi biblioteca» va proyectado en el frente de la balda; su zona de toque se amplía con ::after (abajo)
  // Dentro de la escena: alto de la zona de toque (::after) en px de la ilustración × escala del escenario
  const shelfHit = await page.locator('.room-plaque[data-id="shelf"]').evaluate((el) => {
    const k = parseFloat(el.closest('.scene-stage')?.dataset.scale ?? '1');
    return parseFloat(getComputedStyle(el, '::after').height) * (el.classList.contains('room-plaque--scene') ? k : 1);
  });
  expect(shelfHit).toBeGreaterThanOrEqual(44);
  for (const sel of ['.room-plaque[data-id="diary"]', '.panorama-nav__btn--next']) {
    const r = await rect(page, sel);
    expect(r.height, sel).toBeGreaterThanOrEqual(44);
    expect(r.right, sel).toBeLessThanOrEqual(page.viewportSize().width);
  }
  const title = await page.locator('.bed-pages__title').first().evaluate((el) => getComputedStyle(el).hyphens);
  expect(title).toBe('manual');
  const btn = await rect(page, '.bed-pages__hit');
  expect(page.viewportSize().height - btn.bottom).toBeGreaterThanOrEqual(12);
  await shot(page, info, 'v147-habitacion');
});

test('ambiente: compacto, con cierre, la hora manual deja de seguir el reloj y la cuenta tiene acceso propio', async ({ page }, info) => {
  await load(page);
  await page.getByRole('button', { name: 'Ambiente' }).click();
  const panel = page.locator('.ambient-menu__panel');
  await expect(panel).toBeVisible();
  const r = await panel.evaluate((el) => ({ ...el.getBoundingClientRect().toJSON(), scroll: getComputedStyle(el).overflowY }));
  expect(r.bottom).toBeLessThanOrEqual(page.viewportSize().height);
  expect(r.right).toBeLessThanOrEqual(page.viewportSize().width);
  for (const name of ['Mañana', 'Atardecer', 'Noche']) {
    const b = await panel.getByRole('radio', { name }).evaluate((el) => ({ fits: el.scrollWidth <= el.clientWidth + 1, h: el.getBoundingClientRect().height }));
    expect(b.fits, name).toBe(true);
    expect(b.h).toBeGreaterThanOrEqual(40);
  }
  await expect(panel.getByRole('button', { name: 'Tu cuenta y copias' })).toHaveCount(0);
  await panel.getByRole('radio', { name: 'Noche' }).click();
  await expect(panel.getByRole('radio', { name: 'Noche' })).toHaveAttribute('aria-checked', 'true');
  await expect(panel.getByRole('switch', { name: 'Seguir el reloj' })).toHaveAttribute('aria-checked', 'false');
  await expect(panel.locator('.ambient-menu__clock')).toContainText('ya no sigue el reloj');
  await shot(page, info, 'v147-ambiente');
  await panel.getByRole('button', { name: 'Cerrar Ambiente' }).click();
  await expect(panel).toHaveCount(0);
  const s = await stored(page);
  expect(s.settings).toMatchObject({ timeOfDay: 'night', timeAuto: false });
  await page.getByRole('button', { name: 'Tu cuenta y copias' }).click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
});

test('abandonado: si era el libro de la cama, se dice y se ofrece elegir otro sin escoger uno por su cuenta', async ({ page }) => {
  test.skip(!portrait(page), 'el libro grande de la cama es de pantallas verticales');
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/');
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.waitForTimeout(300);
  const seeded = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
    const circe = st.books.find((b) => b.title === 'Circe');
    circe.status = 'abandoned';
    st.settings.currentBookId = circe.id;
    return JSON.stringify(st);
  });
  await page.addInitScript((v) => localStorage.setItem('bookshelf:v1', v), seeded);
  await page.reload();
  await page.waitForSelector('.bed-pages');
  await expect(page.locator('.bed-pages').first()).toHaveAttribute('data-state', 'abandoned');
  await expect(page.locator('.bed-pages__kicker').first()).toHaveText('Lectura abandonada');
  await expect(page.locator('.bed-pages__title').first()).toHaveText('Circe');
  await expect(page.getByRole('button', { name: /^Registrar lectura de / })).toHaveCount(0);
  await page.getByRole('button', { name: 'Elegir otra lectura' }).click();
  await expect(page.locator('.library[data-open="true"]')).toBeVisible();
});
