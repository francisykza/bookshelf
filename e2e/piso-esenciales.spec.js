// Los elementos esenciales del piloto y el recorrido completo: entrar, biblioteca, registrar, calendario, diario y salir al
// portal. Perfil propio con la biblioteca de ejemplo y sin nube. Emulación: no equivale a un móvil físico.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'qa-report/piso-esenciales';
const KEY_A = 'bookshelf:lab:piso-primera-persona:plano2:lab-1A';
const MINE = /^Entrar en tu piso, 1\.º A/;
const NEIGHBOUR = /^Llamar y entrar en el piso de Vecina de prueba/;

test.beforeEach(async ({ page }, info) => {
  test.skip(!/(chromium|webkit)-390x844$/.test(info.project.name), 'móvil vertical');
  mkdirSync(OUT, { recursive: true });
  await page.route('https://covers.openlibrary.org/**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
});

const portal = (page, re = MINE) => page.getByRole('button', { name: re });
async function enter(page, re = MINE) {
  await page.goto('/?piloto=piso');
  await portal(page, re).click();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().windows.length > 0, null, { timeout: 30000 });
}
const menu = (page) => page.getByRole('button', { name: 'Menú de accesos' });
const sheet = (page) => page.getByRole('navigation', { name: 'Accesos del piso' });
async function tap(page, what, yaw) {
  // Con el dibujo en marcha: lo que se abre encima tarda un instante en irse
  await page.waitForFunction(() => !window.__pisoLab().debug().paused);
  // Se espera a que la cámara termine de volver de la balda
  const where = () => page.evaluate(([w, y]) => (window.__pisoLab().lookTo(y), window.__pisoLab().screenOf(w)), [what, yaw]);
  let at = await where();
  await expect
    .poll(async () => {
      const before = at;
      await page.waitForTimeout(150);
      at = await where();
      return Math.hypot(at.x - before.x, at.y - before.y);
    })
    .toBeLessThan(1);
  await page.mouse.click(at.x, at.y);
}
const desktop = (page) => page.getByRole('region', { name: 'Lo principal' });
const icon = (page, name) => page.locator('.plab-desktop').getByRole('button', { name: new RegExp(`^${name}`) });

test('recorrido: entrar, biblioteca, registrar, calendario, diario y salir al portal', async ({ page }, info) => {
  const external = [];
  page.on('request', (r) => {
    if (/supabase\.co/.test(r.url())) external.push(r.url());
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await enter(page);

  // Biblioteca, desde la estantería
  await tap(page, 'estanteria', -0.42);
  await page.waitForFunction(() => window.__pisoLab().debug().zoomed);
  await page.getByRole('button', { name: /Buscar en toda la biblioteca/ }).click();
  await expect(page.getByRole('heading', { name: 'Biblioteca', exact: true })).toBeVisible();
  await page.goBack();
  await page.goBack();
  await page.waitForFunction(() => !window.__pisoLab().debug().zoomed);

  // Registrar, tocando el libro de la mesa
  await tap(page, 'libro', 0);
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Guardar lectura' }) });
  await expect(dialog).toBeVisible();
  await dialog.locator('.reading-form__input input').fill('25');
  await dialog.getByRole('button', { name: 'Guardar lectura' }).click();
  await expect(dialog).toBeHidden();

  // El ordenador, tocándolo: calendario
  await tap(page, 'ordenador', 0.6);
  await expect(desktop(page)).toBeVisible();
  await page.screenshot({ path: `${OUT}/ordenador-${info.project.name}.png` });
  await icon(page, 'Calendario').click();
  await expect(page.locator('[data-pc-app="calendar"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Calendario' })).toBeVisible();
  await page.screenshot({ path: `${OUT}/calendario-${info.project.name}.png` });

  // De vuelta al escritorio del ordenador: el diario, con la lectura de hoy
  await page.getByRole('button', { name: 'Volver al escritorio' }).click();
  await icon(page, 'Mi diario').click();
  await expect(page.getByRole('heading', { name: 'Mi diario' })).toBeVisible();
  await expect(page.locator('[data-pc-app="calendar"]')).toContainText('Circe');
  await page.screenshot({ path: `${OUT}/diario-${info.project.name}.png` });

  // Se apaga y se sale por la puerta
  await page.getByRole('button', { name: 'Volver al escritorio' }).click();
  await page.getByRole('button', { name: /^Salir/ }).click();
  await expect(desktop(page)).toBeHidden();
  await page.waitForFunction(() => !window.__pisoLab().debug().paused);
  await tap(page, 'puerta', 0.6);
  await expect(portal(page)).toBeVisible();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('el menú compacto: teclado, foco y las mismas funciones', async ({ page }, info) => {
  await enter(page);
  await page.keyboard.press('m');
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByRole('button')).toHaveText(['Ordenador', 'Mi biblioteca', 'Salir al portal', /Sonido/, 'Decorar', 'Ajustes', 'Calendario', 'Mi diario', /^Ver de/, /^Registrar lectura/]);
  await expect(sheet(page).getByRole('button').first()).toBeFocused();
  await page.screenshot({ path: `${OUT}/menu-${info.project.name}.png` });
  // Escape solo cierra el menú y devuelve el foco
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toBeHidden();
  await expect(menu(page)).toBeFocused();
  await expect(menu(page)).toHaveAttribute('aria-expanded', 'false');
  // Con el tabulador, hasta el calendario
  await page.keyboard.press('Enter');
  for (let i = 0; i < 6; i += 1) await page.keyboard.press('Tab');
  await expect(sheet(page).getByRole('button', { name: 'Calendario' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Calendario' })).toBeVisible();
  // Con una capa encima, la tecla no lo abre
  await page.keyboard.press('m');
  await expect(sheet(page)).toBeHidden();
  await page.goBack();
  await expect(menu(page)).toBeVisible();
  // Desde la balda también se sale al portal
  await page.getByRole('button', { name: 'Ver la balda' }).click();
  await page.waitForFunction(() => window.__pisoLab().debug().zoomed);
  await menu(page).click();
  await sheet(page).getByRole('button', { name: 'Salir al portal' }).click();
  await expect(portal(page)).toBeVisible();
});

test('el menú cabe en la pantalla, encima de los controles', async ({ page }) => {
  await enter(page);
  await menu(page).click();
  const box = await page.locator('.port-menu__sheet').boundingBox();
  expect(box.width).toBeLessThanOrEqual(480);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height);
});

test('en casa de la vecina la puerta funciona, y el ordenador no es tuyo', async ({ page }, info) => {
  await enter(page, NEIGHBOUR);
  await page.screenshot({ path: `${OUT}/vecina-${info.project.name}.png` });
  await menu(page).click();
  await expect(sheet(page).getByRole('button')).toHaveText(['Ver de noche', 'Salir al portal']);
  await page.keyboard.press('Escape');
  await tap(page, 'ordenador', 0.6);
  await page.waitForTimeout(200);
  await expect(desktop(page)).toBeHidden();
  await page.evaluate(() => window.__pisoLab().lookTo(-0.6));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/vecina-puerta-${info.project.name}.png` });
  await tap(page, 'puerta', -0.6);
  await expect(portal(page, NEIGHBOUR)).toBeVisible();
});

test('el ordenador se usa a 360 px: todo se alcanza y no hay desplazamiento lateral', async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await enter(page);
  await menu(page).click();
  await sheet(page).getByRole('button', { name: 'Ordenador' }).click();
  await expect(desktop(page)).toBeVisible();
  await page.screenshot({ path: `${OUT}/ordenador-360-${info.project.name}.png` });
  await page.getByRole('button', { name: 'Aplicaciones' }).click();
  const last = icon(page, 'Cuenta y copias');
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const button of await page.locator('.plab-desktop button:visible').all()) expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
  // Cada acceso abre una pantalla de verdad y se vuelve al ordenador
  for (const [name, seen] of [
    ['Añadir un libro', /biblioteca|título/i],
    ['Mapa de sagas', /saga/i],
    ['Temporizador', /tiempo|temporizador|lectura|min/i],
  ]) {
    await icon(page, name).click();
    await expect(desktop(page)).toBeHidden();
    await expect(page.getByRole('dialog').last()).toContainText(seen);
    await page.goBack();
    await expect(page.locator('.pp-apps')).toBeVisible();
  }
});

test('el decorador los identifica: se mueven como cualquier mueble, pero no se guardan', async ({ page }, info) => {
  await enter(page);
  await page.getByRole('button', { name: 'Decorar' }).click();
  const bar = page.getByRole('group', { name: 'Elementos esenciales' });
  await expect(bar.getByRole('button').filter({ hasNotText: 'Restablecer' })).toHaveText(['Estantería', 'Mesa de lectura', 'Escritorio', 'Ordenador', 'Puerta de salida']);
  await bar.getByRole('button', { name: 'Escritorio' }).click();
  await expect(page.locator('.ed-room').getByText(/\(esencial\)/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Guardar/ }).first()).toBeDisabled();
  await page.screenshot({ path: `${OUT}/decorador-elegido-${info.project.name}.png` });
  const item = (id) => page.evaluate((i) => window.__edificioPiso.room.items.find((x) => x.id === i), id);
  const before = await item('escritorio');
  const pc = await item('ordenador');
  await page.getByRole('button', { name: /[Cc]olor/ }).first().click();
  expect((await item('escritorio')).tono).not.toBe(before.tono);
  // Arrastrarlo lo mueve, y el ordenador va con él
  const point = await page.evaluate((uid) => window.__edificioPiso.screenOfItem(uid), before.uid);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x - 40, point.y + 50, { steps: 8 });
  await page.mouse.up();
  const after = await item('escritorio');
  expect([after.x, after.y]).not.toEqual([before.x, before.y]);
  const carried = await item('ordenador');
  expect([carried.x - pc.x, carried.y - pc.y]).toEqual([after.x - before.x, after.y - before.y]);
  await page.screenshot({ path: `${OUT}/decorador-movido-${info.project.name}.png` });
  // Girarlo también; y su paso va con él
  await page.getByRole('button', { name: /Girar/ }).first().click();
  const spun = await item('escritorio');
  expect(spun.rot).toBe(1);
  expect((await item('ordenador')).rot).toBe(1);
  // De vuelta al sillón se ve donde lo has puesto, y al ordenador se llega igual
  await page.getByRole('button', { name: 'Volver al sillón' }).click();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().windows.length > 0, null, { timeout: 30000 });
  await page.evaluate(() => window.__pisoLab().lookTo(0.6));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/movido-sillon-${info.project.name}.png` });
  await menu(page).click();
  await sheet(page).getByRole('button', { name: 'Ordenador' }).click();
  await expect(desktop(page)).toBeVisible();
});

test('la barra flota sobre la habitación: el dibujo llega hasta arriba', async ({ page }, info) => {
  await enter(page);
  const canvas = await page.locator('.plab-canvas').boundingBox();
  expect(canvas.y).toBe(0);
  const portalButton = page.getByRole('button', { name: 'Al portal' });
  await expect(portalButton).toBeVisible();
  // Encima de un botón sigue el botón; al lado, el lienzo
  const box = await portalButton.boundingBox();
  const under = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.className, [box.x + box.width + 60, box.y + box.height / 2]);
  expect(under).toContain('plab-canvas');
  await page.screenshot({ path: `${OUT}/barra-${info.project.name}.png` });
});

test('un guardado antiguo se completa al cargar, y restablecer vuelve a la distribución de partida', async ({ page }, info) => {
  await page.goto('/?piloto=piso');
  const old = {
    v: 1,
    pared: 'yeso',
    suelo: 'tablas',
    items: [
      { uid: 1, id: 'alfombra', x: 2, y: 2, rot: 0, tono: 1 },
      { uid: 2, id: 'sillon', x: 2, y: 4, rot: 2, tono: 2 },
      { uid: 3, id: 'planta-grande', x: 7, y: 0, rot: 0, tono: 1 },
      { uid: 4, id: 'lampara-pie', x: 2, y: 0, rot: 0, tono: 0 },
      { uid: 5, id: 'ventana', pared: 'fondo', a: 3, tono: 0 },
    ],
  };
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY_A, JSON.stringify(old)]);
  await enter(page);
  await expect(page.getByRole('status').filter({ hasText: 'Tu piso se ha completado' })).toContainText('escritorio');
  // El aviso no le quita sitio al lienzo
  expect((await page.locator('.plab-canvas').boundingBox()).height).toBeGreaterThan(400);
  await page.screenshot({ path: `${OUT}/reparado-${info.project.name}.png` });
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY_A);
  const ids = saved.items.map((i) => i.id);
  for (const id of ['estanteria', 'mesa-baja', 'escritorio', 'ordenador', 'puerta-piso', 'alfombra', 'sillon', 'planta-grande', 'lampara-pie']) expect(ids).toContain(id);
  expect(saved.items.find((i) => i.id === 'sillon').tono).toBe(2);
  expect(saved.items.find((i) => i.id === 'planta-grande').tono).toBe(1);
  expect(await page.evaluate((k) => localStorage.getItem(`${k}:antes`), KEY_A)).toBe(JSON.stringify(old));
  // Y solo lo dice una vez
  await page.reload();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().windows.length > 0, null, { timeout: 30000 });
  await expect(page.getByRole('status').filter({ hasText: 'Tu piso se ha completado' })).toHaveCount(0);

  // Restablecer pregunta antes
  await page.getByRole('button', { name: 'Decorar' }).click();
  const bar = page.getByRole('group', { name: 'Elementos esenciales' });
  await bar.getByRole('button', { name: 'Restablecer la habitación' }).click();
  await expect(bar.getByRole('alert')).toBeVisible();
  await bar.getByRole('button', { name: 'Cancelar' }).click();
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY_A)).not.toBeNull();
  await bar.getByRole('button', { name: 'Restablecer la habitación' }).click();
  await bar.getByRole('button', { name: 'Restablecer', exact: true }).click();
  await expect(bar.getByRole('alert')).toHaveCount(0);
  const room = await page.evaluate(() => window.__edificioPiso.room.items.map((i) => [i.id, i.tono]));
  expect(room).toContainEqual(['sillon', 0]);
  expect(room.map(([id]) => id)).toContain('puerta-piso');
});
