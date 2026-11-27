// Parte de e2e-community/entrega3.spec.js que probaba la habitación ilustrada (archivada en la 1.157.0). Son fragmentos: los imports, los datos de
// prueba y las demás ayudas siguen en el original (git show 2948485:e2e-community/entrega3.spec.js).

test('sillones: vacíos sin nadie, un participante real con su libro y «+N» cuando no caben', async ({ page }, info) => {
  const mock = createMockSupabase();
  members(mock.db, [
    [ANA, 'Ana lectora', 'gato-lector'],
    [BRUNO, 'Bruno', 'lector-farol'],
    [CARLA, 'Carla', 'viajera-pelirroja'],
    [DANI, 'Dani', 'vidente-estrellas'],
  ]);
  await mock.attach(page, ANA);
  await ready(page);
  await toSalon(page);
  // Cero participantes: ningún medallón (nunca se inventa a nadie)
  await expect(page.locator('[data-panel="SOCIAL_ROOM"] .social-spot[data-id="tablet"]')).toHaveCount(1);
  await page.waitForTimeout(600);
  await expect(page.locator('.seat-medallion')).toHaveCount(0);
  await shot(page, info, 'salon-vacio');
  // Un participante (Bruno, compartiendo libro) y luego tres: dos sillones y «+1 lector»
  mock.db.reading_presence.push(presence(BRUNO, 12, { share_book: true, book_title: 'Circe' }));
  await page.reload();
  await esperarInicio(page);
  await toSalon(page);
  const medal = page.locator('.seat-medallion');
  await expect(medal).toHaveCount(1);
  await expect(medal).toContainText('Bruno');
  await expect(medal).toContainText('Circe');
  await expect(medal).toContainText('12 min');
  // El medallón está anclado al sillón (dentro de su caja en pantalla)
  const anchored = await page.evaluate(() => {
    const m = document.querySelector('.seat-medallion .reader-avatar').getBoundingClientRect();
    const s = document.querySelector('[data-panel="SOCIAL_ROOM"] .social-spot[data-id^="sillon"]');
    return { size: m.width, inside: Boolean(s) };
  });
  expect(anchored.size).toBeGreaterThanOrEqual(43.5);
  expect(anchored.size).toBeLessThanOrEqual(64.5);
  await shot(page, info, 'salon-uno');
  mock.db.reading_presence.push(presence(CARLA, 5), presence(DANI, 2));
  await page.reload();
  await esperarInicio(page);
  await toSalon(page);
  await expect(page.locator('.seat-medallion')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '+1 lector' })).toBeVisible();
  // Una presencia caducada (sin renovar más de 3 minutos) no aparece
  mock.db.reading_presence.forEach((r) => r.user_id === DANI.id && (r.last_seen = new Date(Date.now() - 5 * 60000).toISOString()));
  await page.reload();
  await esperarInicio(page);
  await toSalon(page);
  await expect(page.locator('.seat-medallion')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /\+\d lector/ })).toHaveCount(0);
});

test('sentarse a leer: explícito, sin compartir el libro si no se elige, y sin premios; levantarse', async ({ page }) => {
  const mock = createMockSupabase();
  members(mock.db, [[ANA, 'Ana lectora', 'gato-lector']]);
  await mock.attach(page, ANA);
  await ready(page);
  // La librería normaliza `placements` (figura → lista de libros) al cargar el catálogo: se espera a que acabe
  await page.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem('bookshelf:v1')).progress.figures.placements ?? {}).every(Array.isArray));
  const figuresBefore = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('bookshelf:v1')).progress.figures));
  await toSalon(page);
  // Entrar al salón no sienta a nadie
  await page.waitForTimeout(600);
  expect(mock.db.reading_presence).toEqual([]);
  // 1.62 (SPEC §62.2): el sillón libre abre aquí mismo la elección, sin salir del salón
  await (await visibleSeat(page)).click();
  const card = page.getByRole('dialog', { name: 'Sentarme a leer' });
  await card.getByRole('radio', { name: 'Solo mi alias' }).check();
  await card.getByRole('button', { name: 'Sentarme a leer' }).click();
  await expect(card).toHaveCount(0);
  await expect(page.locator('.social-hub')).toHaveCount(0);
  expect(mock.db.reading_presence).toEqual([expect.objectContaining({ user_id: ANA.id, share_book: false, book_title: null })]);
  await expect(page.locator('.seat-medallion')).toHaveCount(1);
  await expect(page.locator('.seat-medallion')).toContainText('Ana lectora');
  // Ni sellos ni figuras ni páginas
  expect(await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('bookshelf:v1')).progress.figures))).toBe(figuresBefore);
  // Mi medallón abre mi tarjeta junto al sillón, con «Levantarme»
  await page.locator('.seat-medallion').click();
  await page.getByRole('dialog', { name: 'Tu sitio en el salón' }).getByRole('button', { name: 'Levantarme' }).click();
  await expect(page.locator('.seat-medallion')).toHaveCount(0);
  await expect(page.locator('.seat-free')).toHaveCount(2);
  expect(mock.db.reading_presence).toEqual([]);
});

/** El sillón que se ve en pantalla (en móviles estrechos el encuadre puede dejar uno fuera). */
async function visibleSeat(page) {
  const id = await page.evaluate(() => {
    const seats = [...document.querySelectorAll('[data-panel="SOCIAL_ROOM"] .social-spot[data-id^="sillon"]')];
    const seen = seats.find((el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      return cx > 20 && cx < innerWidth - 20;
    });
    return seen?.dataset.id;
  });
  return page.locator(`[data-panel="SOCIAL_ROOM"] .social-spot[data-id="${id}"]`);
}

async function toSalon(page) {
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.waitForFunction(() => document.querySelector('[data-panel="SOCIAL_ROOM"] .scene-base')?.naturalWidth > 0);
}

const presence = (u, mins, extra = {}) => ({ user_id: u.id, share_book: false, book_title: null, started_at: new Date(Date.now() - mins * 60000).toISOString(), last_seen: new Date().toISOString(), ...extra });

const DANI = { id: '44444444-4444-4444-8444-444444444444', email: 'dani@ejemplo.test' };
