// Parte de e2e-community/v162.spec.js que probaba la habitación ilustrada (archivada en la 1.157.0). Son fragmentos: los imports, los datos de
// prueba y las demás ayudas siguen en el original (git show 2948485:e2e-community/v162.spec.js).

test('salón: sentarse desde el sillón con la lectura elegida, tarjeta propia con «Levantarme» y nada inventado', async ({ page }, info) => {
  const mock = seed();
  await toSalon(page, mock);
  await page.waitForTimeout(600);
  // Nadie sentado: sin medallones; el sillón libre lleva su etiqueta «Sentarme»
  await expect(page.locator('.seat-medallion')).toHaveCount(0);
  await expect(page.locator('.seat-free').first()).toContainText('Sentarme');
  await (await visibleSeat(page)).click();
  const card = page.getByRole('dialog', { name: 'Sentarme a leer' });
  await expect(card).toBeVisible();
  await insideViewport(page, card);
  await expect(card).toContainText('Sentarte no registra páginas.');
  await expect(card.getByRole('radio', { name: 'Mi alias y mi lectura actual' })).toBeChecked();
  // El selector de lecturas en curso: se elige otra que la actual
  const select = card.getByRole('combobox', { name: /Lectura actual/ });
  const options = await select.locator('option').allTextContents();
  expect(options.length).toBeGreaterThan(1);
  await select.selectOption({ index: 1 });
  const chosen = options[1].split(' · ')[0];
  await expect(card).toContainText(`Lectura actual · ${chosen}`);
  await shot(page, info, 'v162-sentarse');
  // Escape cierra sin sentarse; el foco vuelve al sillón
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  expect(mock.db.reading_presence).toEqual([]);
  await (await visibleSeat(page)).click();
  await card.getByRole('combobox', { name: /Lectura actual/ }).selectOption({ index: 1 });
  await card.getByRole('button', { name: 'Sentarme a leer' }).click();
  await expect(card).toHaveCount(0);
  expect(mock.db.reading_presence).toEqual([expect.objectContaining({ user_id: ANA.id, share_book: true, book_title: chosen })]);
  // Mi medallón abre mi tarjeta, anclada y dentro de la pantalla, con «Levantarme» (y sin visitarme a mí)
  await page.locator('.seat-medallion').click();
  const mine = page.getByRole('dialog', { name: 'Tu sitio en el salón' });
  await expect(mine).toContainText(`Leyendo ${chosen}`);
  await expect(mine.getByRole('button', { name: /Visitar/ })).toHaveCount(0);
  await insideViewport(page, mine);
  await mine.getByRole('button', { name: 'Levantarme' }).click();
  await expect(mine).toHaveCount(0);
  await expect(page.locator('.seat-medallion')).toHaveCount(0);
  expect(mock.db.reading_presence).toEqual([]);
});

test('salón: la tarjeta de quien lee (lectura solo si la comparte), visitar su rincón y volver al salón', async ({ page }, info) => {
  const mock = seed();
  mock.db.corners.push({ user_id: BRUNO.id, visible: true, featured_books: [{ id: 'circe', title: 'Circe', author: 'Madeline Miller', cover: '' }], figure_ids: [], guardian_id: null, show_current: false, current_title: null });
  mock.db.reading_presence.push(presence(BRUNO, 12, { share_book: true, book_title: 'Circe' }), presence(CARLA, 4));
  await toSalon(page, mock);
  await expect(page.locator('.seat-medallion')).toHaveCount(2, { timeout: 15000 });
  // Carla no comparte libro: su tarjeta no dice qué lee
  await page.locator('.seat-medallion', { hasText: 'Carla' }).click();
  const carla = page.getByRole('dialog', { name: 'Carla en el salón' });
  await expect(carla).toBeVisible();
  await expect(carla).not.toContainText('Leyendo');
  await carla.getByRole('button', { name: 'Cerrar' }).click();
  await expect(carla).toHaveCount(0);
  await page.locator('.seat-medallion', { hasText: 'Bruno' }).click();
  const bruno = page.getByRole('dialog', { name: 'Bruno en el salón' });
  await expect(bruno).toContainText('Leyendo Circe');
  await expect(bruno.getByRole('button', { name: 'Ver perfil' })).toBeVisible();
  await insideViewport(page, bruno);
  await shot(page, info, 'v162-tarjeta-lector');
  await bruno.getByRole('button', { name: 'Visitar su rincón' }).click();
  // Fachada: quién es, volver al salón y entrar; el vídeo aún no se ha pedido
  const visit = page.getByRole('dialog', { name: 'Visita al rincón de Bruno' });
  await expect(visit.locator('.reader-visit__who')).toContainText('El rincón de Bruno');
  await expect(visit.getByRole('button', { name: 'Volver al salón' })).toBeVisible();
  const door = visit.getByRole('button', { name: 'Entrar al rincón de Bruno' });
  await expect(door).toBeEnabled();
  await insideViewport(page, door);
  await page.waitForTimeout(500);
  await shot(page, info, 'v162-fachada');
  await page.route('**/media/social-visit/entrada-v1.mp4', (route) => route.abort());
  await door.click();
  await expect(visit.getByRole('button', { name: /Libros compartidos por Bruno/ })).toBeVisible({ timeout: 15000 });
  expect(await page.evaluate(() => history.state.bookshelf.loc.panel)).toEqual({ type: 'visit', id: BRUNO.id, section: 'habitacion', from: 'salon' });
  await visit.getByRole('button', { name: 'Volver al salón' }).click();
  await expect(page.locator('.reader-visit')).toHaveCount(0);
  await expect(page.locator('.social-hub')).toHaveCount(0);
  await expect(page.locator('.seat-medallion')).toHaveCount(2);
});

test('más lectores que sillones: dos retratos sin solaparse y el resto en la lista', async ({ page }) => {
  const mock = seed();
  const extra = [
    { id: '99999999-9999-4999-8999-999999999991', alias: 'Eloy' },
    { id: '99999999-9999-4999-8999-999999999992', alias: 'Fina' },
  ];
  for (const p of extra) mock.db.profiles.push({ user_id: p.id, alias: p.alias, avatar_id: 'gato-lector', community_enabled: true });
  mock.db.reading_presence.push(presence(BRUNO, 12), presence(CARLA, 8), presence(extra[0], 6), presence(extra[1], 2));
  await toSalon(page, mock);
  await expect(page.locator('.seat-medallion')).toHaveCount(2, { timeout: 15000 });
  const [a, b] = await page.locator('.seat-medallion .reader-avatar').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
  expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
  await page.getByRole('button', { name: '+2 lectores' }).click();
  const company = page.locator('.social-hub').getByRole('region', { name: 'Leyendo en compañía' });
  await expect(company.locator('.room-tab__reader')).toHaveCount(4);
  await expect(company).toContainText('Fina');
});

async function toSalon(page, mock, { reduced = false } = {}) {
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/');
  await esperarInicio(page);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.waitForFunction(() => document.querySelector('[data-panel="SOCIAL_ROOM"] .scene-base')?.naturalWidth > 0);
}

/** El sillón que se ve en pantalla (en móviles estrechos el encuadre puede dejar uno fuera). */
async function visibleSeat(page) {
  const id = await page.evaluate(() => {
    const seats = [...document.querySelectorAll('[data-panel="SOCIAL_ROOM"] .social-spot[data-id^="sillon"]')];
    return seats.find((el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      return cx > 20 && cx < innerWidth - 20;
    })?.dataset.id;
  });
  return page.locator(`[data-panel="SOCIAL_ROOM"] .social-spot[data-id="${id}"]`);
}

/** Una caja dentro de la ventana, con margen. */
async function insideViewport(page, locator) {
  const r = await locator.boundingBox();
  const vp = page.viewportSize();
  expect(r.x).toBeGreaterThanOrEqual(0);
  expect(r.y).toBeGreaterThanOrEqual(0);
  expect(r.x + r.width).toBeLessThanOrEqual(vp.width + 0.5);
  expect(r.y + r.height).toBeLessThanOrEqual(vp.height + 0.5);
}
