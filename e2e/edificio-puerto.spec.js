// Prototipo «El edificio del puerto» (solo desarrollo, /dev/edificio-puerto.html): portal, tu piso (decorar con el
// catálogo, arrastrar, girar, color, guardar, teclado) y la visita a un vecino de prueba con su sello. Datos inventados;
// nada toca la biblioteca ni la nube. Emulación de Playwright: no equivale a un iPhone físico.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PROJECTS = /chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$|reduced/;

async function shot(page, info, name, fullPage = true) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`), fullPage });
}

async function open(page, query = '') {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/fonts\.g/.test(m.text()) && errors.push(m.text()));
  await page.goto(`/dev/edificio-puerto.html${query}`);
  await page.waitForFunction(() => window.__edificio);
  return errors;
}

const room = (page) => page.evaluate(() => window.__edificio.piso.room);
const itemPoint = (page, uid) => page.evaluate((u) => window.__edificio.piso.screenOfItem(u), uid);
const cellPoint = (page, x, y) => page.evaluate(([a, b]) => window.__edificio.piso.screenOf(a, b, 0), [x, y]);

test('portal: seis puertas, podios de prueba y tu buzón', async ({ page }, info) => {
  test.skip(!PROJECTS.test(info.project.name), 'tamaños del prototipo');
  const errors = await open(page);
  await expect(page.locator('.door')).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Entrar en tu piso, 2.º B' })).toBeVisible();
  await expect(page.locator('.door__badge')).toHaveText(['Podio de la semana', 'Podio del mes']);
  await expect(page.locator('#inbox li')).toHaveCount(2);
  await page.waitForFunction(() => [...document.querySelectorAll('.door img')].every((i) => i.complete && i.naturalWidth > 0));
  // Sin desbordes horizontales
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await shot(page, info, 'ep-portal');
  expect(errors).toEqual([]);
});

test('tu piso: decorar con el catálogo, arrastrar, girar, color, guardar y se conserva al volver', async ({ page }, info) => {
  test.skip(!PROJECTS.test(info.project.name), 'tamaños del prototipo');
  test.setTimeout(60_000);
  const errors = await open(page, '?piso=2b');
  await expect(page.locator('#piso-title')).toHaveText('Tu piso · 2.º B');
  await shot(page, info, 'ep-mi-piso');
  await page.getByRole('button', { name: 'Decorar' }).click();
  await expect(page.locator('.ep-panel')).toBeVisible();

  // Una lámpara de mesa va sola encima de un mueble con superficie
  await page.locator('.ep-chip', { hasText: 'Luz' }).click();
  await page.getByRole('button', { name: 'Añadir lámpara de mesa' }).click();
  await expect(page.locator('.ep-status')).toContainText('Lámpara de mesa en tu piso');
  let r = await room(page);
  const lamp = r.items.at(-1);
  expect(lamp.id).toBe('lampara-mesa');

  // Un sillón nuevo y se arrastra a un hueco libre
  await page.locator('.ep-chip', { hasText: 'Para sentarse' }).click();
  await page.getByRole('button', { name: 'Añadir sillón' }).click();
  r = await room(page);
  const chair = r.items.at(-1);
  expect(chair.id).toBe('sillon');
  await page.locator('.ep-canvas').evaluate((c) => c.scrollIntoView({ block: 'center' }));
  const from = await itemPoint(page, chair.uid);
  const to = await cellPoint(page, 1.5 + (chair.x <= 2 ? 5 : 0), 7.5);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await shot(page, info, 'ep-arrastrando', false);
  await page.mouse.up();
  await expect(page.locator('.ep-status')).toContainText('Sillón en su sitio nuevo');
  const placed = (await room(page)).items.find((i) => i.uid === chair.uid);
  expect(placed.y).toBeGreaterThanOrEqual(6);

  await page.getByRole('button', { name: 'Girar' }).click();
  expect((await room(page)).items.find((i) => i.uid === chair.uid).rot).toBe(1);
  await page.getByRole('button', { name: 'Color' }).click();
  expect((await room(page)).items.find((i) => i.uid === chair.uid).tono).toBe(1);

  // Paredes y suelo
  await page.getByRole('button', { name: 'Salvia' }).click();
  await page.getByRole('button', { name: 'Baldosa en damero' }).click();
  r = await room(page);
  expect([r.pared, r.suelo]).toEqual(['salvia', 'damero']);
  await page.locator('.ep-canvas').evaluate((c) => c.scrollIntoView({ block: 'start' }));
  await shot(page, info, 'ep-decorando');

  // Guardar la lámpara
  await page.locator('.ep-list summary').click();
  await page.getByRole('button', { name: 'Lámpara de mesa', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('.ep-status')).toHaveText('Lámpara de mesa guardado.');
  const count = (await room(page)).items.length;

  // Se conserva al recargar
  await page.getByRole('button', { name: 'Terminar' }).click();
  await page.reload();
  await page.waitForFunction(() => window.__edificio?.piso);
  r = await room(page);
  expect(r.items).toHaveLength(count);
  expect(r.items.find((i) => i.uid === chair.uid)).toMatchObject({ rot: 1, tono: 1 });
  expect(r.pared).toBe('salvia');

  await page.getByRole('button', { name: 'Luz de tarde' }).click();
  await expect(page.getByRole('button', { name: 'Luz de tarde' })).toHaveAttribute('aria-pressed', 'true');
  await shot(page, info, 'ep-tarde');
  expect(await page.evaluate(() => localStorage.getItem('bookshelf:v1'))).toBe(null);
  expect(errors).toEqual([]);
});

test('teclado: elegir desde la lista, mover con flechas, girar y soltar', async ({ page }, info) => {
  test.skip(!/chromium-(390x844|1440x900)$/.test(info.project.name), 'teclado');
  const errors = await open(page, '?piso=2b');
  await page.getByRole('button', { name: 'Decorar' }).click();
  await page.locator('.ep-list summary').click();
  await page.getByRole('button', { name: 'Mesa baja', exact: true }).click();
  await expect(page.locator('.ep-canvas')).toBeFocused();
  const before = (await room(page)).items.find((i) => i.id === 'mesa-baja');
  const tops = (await room(page)).items.filter((i) => i.id === 'libros' || i.id === 'tetera');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const after = (await room(page)).items.find((i) => i.id === 'mesa-baja');
  expect(after.y).toBe(before.y + 2);
  // Lo de encima se mueve con la mesa
  for (const t of tops) expect((await room(page)).items.find((i) => i.uid === t.uid).y).toBe(t.y + 2);
  // Con cosas encima no se gira
  await page.keyboard.press('r');
  await expect(page.locator('.ep-status')).toHaveText('Primero quita lo que tiene encima.');
  await page.keyboard.press('Escape');
  await expect(page.locator('.ep-tools')).toBeHidden();
  expect(errors).toEqual([]);
});

test('visitar a un vecino: solo mirar, dejar un sello y volver al portal', async ({ page }, info) => {
  test.skip(!PROJECTS.test(info.project.name), 'tamaños del prototipo');
  const errors = await open(page);
  await page.getByRole('button', { name: 'Llamar y entrar en el piso de Lucía, 2.º A' }).click();
  await expect(page.locator('#piso-title')).toHaveText('Piso de Lucía · 2.º A');
  await expect(page.locator('#piso-sub')).toContainText('Podio de la semana');
  await expect(page.getByRole('button', { name: 'Decorar' })).toHaveCount(0);
  const before = await room(page);
  // Tocar y arrastrar no mueve nada
  const p = await itemPoint(page, before.items.find((i) => i.id === 'sillon').uid);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 40, p.y + 30, { steps: 5 });
  await page.mouse.up();
  expect(await room(page)).toEqual(before);
  await expect(page.locator('.ep-status')).toHaveText('Sillón');
  await page.getByRole('button', { name: 'Menuda estantería' }).click();
  await expect(page.locator('#sello-msg')).toContainText('Has dejado «Menuda estantería» en el buzón de Lucía');
  await page.getByRole('button', { name: 'Luz de tarde' }).click();
  await shot(page, info, 'ep-visita');
  await page.getByRole('button', { name: 'Volver al portal' }).click();
  await expect(page.locator('#portal')).toBeVisible();
  await page.getByRole('button', { name: 'Llamar y entrar en el piso de Lucía, 2.º A' }).click();
  await expect(page.getByRole('button', { name: 'Menuda estantería' })).toHaveAttribute('aria-pressed', 'true');
  await page.goBack();
  await expect(page.locator('#portal')).toBeVisible();
  expect(errors).toEqual([]);
});

test('la estantería de tu piso abre «La librería del puerto»', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'una vez');
  await open(page, '?piso=2b');
  const shelf = (await room(page)).items.find((i) => i.id === 'estanteria');
  await page.locator('.ep-canvas').evaluate((c) => c.scrollIntoView({ block: 'center' }));
  const p = await itemPoint(page, shelf.uid);
  await page.mouse.click(p.x, p.y);
  await page.getByRole('button', { name: 'Ordenar la estantería' }).click();
  await expect(page).toHaveURL(/libreria-puerto\.html\?nivel=semana/);
});

test('vista previa en la app: la tablet del Salón Social abre el edificio', async ({ page }, info) => {
  test.skip(!/chromium-(390x844|1440x900)$/.test(info.project.name), 'vista previa');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/dev/edificio-puerto-app.html');
  await page.waitForFunction(() => document.querySelector('.shot').complete);
  await shot(page, info, 'ep-app-salon', false);
  await page.getByRole('button', { name: 'Abrir la tablet: El edificio del puerto' }).click();
  const frame = page.frameLocator('#frame');
  await expect(frame.locator('.door')).toHaveCount(6);
  await expect(frame.locator('.dev-bar')).toBeHidden();
  await page.waitForTimeout(300);
  await shot(page, info, 'ep-app-tablet', false);
  await frame.getByRole('button', { name: 'Entrar en tu piso, 2.º B' }).click();
  await expect(frame.locator('#piso-title')).toHaveText('Tu piso · 2.º B');
  await shot(page, info, 'ep-app-piso', false);
  // El foco está dentro del marco: se cierra con su botón (Escape cierra cuando el foco está en la página)
  await page.getByRole('button', { name: 'Cerrar la tablet' }).click();
  await expect(page.locator('#sheet')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Abrir la tablet: El edificio del puerto' })).toBeFocused();
  expect(errors).toEqual([]);
});
