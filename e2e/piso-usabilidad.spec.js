// Usabilidad móvil del piloto: el medidor de entrada, los encuadres a poca anchura, volver a donde estabas, tocar frente a
// arrastrar, los accesos a los muebles y el escritorio. Perfil propio y datos de ejemplo. Emulación, no un móvil físico.
import { expect, test } from '@playwright/test';

const KEY_A = 'bookshelf:lab:piso-primera-persona:plano2:lab-1A';
const MINE = /^Entrar en tu piso, 1\.º A/;
const NEIGHBOUR = /^Llamar y entrar en el piso de Vecina de prueba/;

test.beforeEach(async ({ page }, info) => {
  test.skip(!/(chromium|webkit)-390x844$/.test(info.project.name), 'cada prueba elige su pantalla');
  await page.route('https://covers.openlibrary.org/**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
});

async function enter(page, door = MINE, query = '/?piloto=piso') {
  await page.goto(query);
  await page.getByRole('button', { name: door }).click();
  await page.waitForFunction(() => window.__pisoLabTiempos?.puerta, null, { timeout: 60000 });
}
const lab = (page, fn, arg) => page.evaluate(fn, arg);
const yaw = (page) => lab(page, () => window.__pisoLab().yaw());
const stable = async (page, what) => {
  await page.waitForFunction(() => !window.__pisoLab().debug().paused);
  const read = () => lab(page, (w) => window.__pisoLab().screenOf(w), what);
  let at = await read();
  await expect
    .poll(async () => {
      const before = at;
      await page.waitForTimeout(120);
      at = await read();
      return Math.hypot(at.x - before.x, at.y - before.y);
    })
    .toBeLessThan(1);
  return at;
};
const closeSheet = (page) => page.goBack();
/** Un guardado con una planta en un sitio dado. Se completa con los esenciales al cargar. */
const seedRoom = (page, extra) =>
  page.evaluate(
    ([key, items]) => {
      const base = [
        { uid: 1, id: 'alfombra', x: 2, y: 2, rot: 0, tono: 1 },
        { uid: 2, id: 'sillon', x: 3, y: 4, rot: 2, tono: 2 },
        { uid: 5, id: 'ventana', pared: 'fondo', a: 3, tono: 0 },
      ];
      localStorage.setItem(key, JSON.stringify({ v: 1, pared: 'yeso', suelo: 'tablas', items: [...base, ...items] }));
    },
    [KEY_A, extra],
  );

test('Entrada: cuenta desde la puerta, por fases, y volver de Decorar no la cambia', async ({ page }) => {
  await enter(page, MINE, '/?piloto=piso&medir=1');
  const first = await lab(page, () => window.__pisoLabTiempos.puerta);
  expect(first.oculta).toBe(false);
  // Las fases son consecutivas: suman el total
  expect(Math.abs(first.acercamiento + first.datos + first.escena + first.interactuar - first.total)).toBeLessThanOrEqual(3);
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: 'Decorar' }).click();
  await page.waitForTimeout(500);
  await page.goBack();
  await page.waitForFunction(() => window.__pisoLabTiempos?.vuelta, null, { timeout: 30000 });
  const after = await lab(page, () => window.__pisoLabTiempos);
  expect(after.puerta.total).toBe(first.total);
  // El caso de la grabación: antes esto medía desde la puerta de hacía rato
  expect(after.vuelta.total).toBeLessThan(3000);
  await page.getByRole('button', { name: 'Medir' }).click();
  const sheet = page.locator('.plab-meter__sheet');
  await expect(sheet).toContainText(`Entrada: ${first.total} ms`);
  await expect(sheet).toContainText('Vuelta de Decorar:');
  await expect(sheet).toContainText('Arranque:');
});

test('al recargar dentro no se presenta como una entrada', async ({ page }) => {
  await enter(page);
  await page.reload();
  await page.waitForFunction(() => window.__pisoLabTiempos?.recarga, null, { timeout: 60000 });
  expect(await lab(page, () => window.__pisoLabTiempos.puerta)).toBeNull();
});

for (const [width, height] of [
  [320, 568],
  [360, 800],
  [390, 844],
]) {
  test(`${width} px: desde el sillón se llega a ver entero cada esencial, y cada balda cabe`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/?piloto=piso');
    for (const door of [MINE, NEIGHBOUR]) {
      await page.evaluate(() => (window.__pisoLabTiempos = null));
      await page.getByRole('button', { name: door }).click();
      await page.waitForFunction(() => window.__pisoLabTiempos?.puerta, null, { timeout: 60000 });
      const seen = await lab(page, () => {
        const a = window.__pisoLab();
        const [low, high] = a.yawRange();
        const best = (id) => {
          let top = 0;
          for (let y = low; y <= high + 0.001; y += 0.05) {
            a.lookTo(y);
            const f = a.frameOf(id);
            if (f) top = Math.max(top, f.inside);
          }
          return top;
        };
        const out = { estanteria: best('estanteria'), ordenador: best('ordenador'), puerta: best('puerta-piso') };
        a.lookTo(0);
        return out;
      });
      expect(seen.estanteria).toBeGreaterThan(0.95);
      expect(seen.ordenador).toBeGreaterThan(0.95);
      expect(seen.puerta).toBeGreaterThan(0.95);
      for (const row of [0, 1, 2]) {
        const spots = await lab(
          page,
          async (r) => {
            const a = window.__pisoLab();
            await a.zoomShelf(r, { instant: true });
            return a.bookSlots(r);
          },
          row,
        );
        for (const spot of spots) {
          expect(spot.left).toBeGreaterThanOrEqual(0);
          expect(spot.left + spot.width).toBeLessThanOrEqual(width);
        }
      }
      await lab(page, () => window.__pisoLab().zoomShelf(null, { instant: true }));
      await page.getByRole('button', { name: 'Al portal' }).click();
      await page.getByRole('button', { name: MINE }).waitFor();
    }
  });
}

test('al inclinarse sobre el ordenador se ve entero, también a 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await enter(page);
  const frame = await lab(page, async () => {
    const a = window.__pisoLab();
    a.lookTo(0.2);
    await a.leanToDesk();
    return a.frameOf('ordenador');
  });
  expect(frame.inside).toBe(1);
  expect(frame.clear).toBe(1);
});

test('cerrar una ficha o una herramienta devuelve a donde estabas', async ({ page }) => {
  await enter(page);
  await lab(page, () => window.__pisoLab().lookTo(0.31));
  // El registro
  await page.getByRole('button', { name: /^Registrar lectura/ }).click();
  await expect(page.getByRole('button', { name: 'Guardar lectura' })).toBeVisible();
  await closeSheet(page);
  await page.waitForFunction(() => !window.__pisoLab().debug().zoomed);
  expect(await yaw(page)).toBeCloseTo(0.31, 2);
  // El ordenador, con la mirada puesta y una herramienta abierta y cerrada
  const pc = await stable(page, 'ordenador');
  await page.mouse.click(pc.x, pc.y);
  await expect(page.getByRole('region', { name: 'Lo principal' })).toBeVisible();
  await page.getByRole('button', { name: 'Aplicaciones' }).click();
  await page.locator('.pp-apps').evaluate((el) => (el.scrollTop = 60));
  const before = await page.locator('.pp-apps').evaluate((el) => el.scrollTop);
  await page.getByRole('button', { name: 'Reto anual', exact: true }).click();
  await page.getByRole('button', { name: 'Volver al escritorio' }).click();
  await expect(page.getByRole('button', { name: 'Reto anual', exact: true })).toBeFocused();
  expect(await page.locator('.pp-apps').evaluate((el) => el.scrollTop)).toBe(before);
  await page.getByRole('button', { name: 'Salir del ordenador' }).click();
  await page.waitForFunction(() => !window.__pisoLab().debug().zoomed && !window.__pisoLab().debug().paused);
  expect(await yaw(page)).toBeCloseTo(0.31, 2);
  // Decorar desmonta la habitación: el giro se conserva
  await page.getByRole('button', { name: 'Decorar' }).click();
  await page.waitForTimeout(400);
  await page.goBack();
  await page.waitForFunction(() => window.__pisoLabTiempos?.vuelta);
  expect(await yaw(page)).toBeCloseTo(0.31, 2);
  // La balda, con su ficha abierta y cerrada
  await page.getByRole('button', { name: 'Ver la balda' }).click();
  await page.waitForFunction(() => window.__pisoLab().debug().zoomed);
  await page.waitForSelector('.plab-spot');
  await page.locator('.plab-spot').first().click();
  await page.getByRole('button', { name: 'Abrir ficha' }).click();
  await page.goBack();
  await page.waitForFunction(() => window.__pisoLab().debug().zoomed);
  await page.goBack();
  await page.waitForFunction(() => !window.__pisoLab().debug().zoomed);
  expect(await yaw(page)).toBeCloseTo(0.31, 2);
});

test('con el dedo: tocar el libro abre; arrastrar desde él solo mira; temblar sigue siendo tocar; mantener no hace nada', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'los eventos táctiles se envían por CDP, solo en Chromium');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, baseURL: 'http://localhost:5196' });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await enter(page);
  const cdp = await context.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const save = page.getByRole('button', { name: 'Guardar lectura' });
  const at = await stable(page, 'libro');

  // Arrastrar desde el libro: gira y no abre
  await touch('touchStart', at.x, at.y);
  for (let i = 1; i <= 8; i += 1) await touch('touchMove', at.x - i * 10, at.y);
  await touch('touchEnd');
  await page.waitForTimeout(400);
  await expect(save).toBeHidden();
  expect(await yaw(page)).toBeGreaterThan(0.25);
  // Y volver al mismo sitio arrastrando tampoco es un toque
  await lab(page, () => window.__pisoLab().lookTo(0));
  await touch('touchStart', at.x, at.y);
  await touch('touchMove', at.x + 40, at.y);
  await touch('touchMove', at.x, at.y);
  await touch('touchEnd');
  await page.waitForTimeout(400);
  await expect(save).toBeHidden();

  // Mantener pulsado no pide nada
  await lab(page, () => window.__pisoLab().lookTo(0));
  await touch('touchStart', at.x, at.y);
  await page.waitForTimeout(600);
  await touch('touchEnd');
  await page.waitForTimeout(400);
  await expect(save).toBeHidden();

  // Un toque con temblor abre sin girar
  await lab(page, () => window.__pisoLab().lookTo(0));
  await touch('touchStart', at.x, at.y);
  await touch('touchMove', at.x + 4, at.y + 3);
  await touch('touchEnd');
  await expect(save).toBeVisible();
  expect(await yaw(page)).toBe(0);
  await context.close();
});

test('el radio del dedo: tocar justo al lado del libro también vale', async ({ page }) => {
  await enter(page);
  const frame = await lab(page, () => window.__pisoLab().frameOf('libro'));
  const center = await stable(page, 'libro');
  // Baja por el libro hasta salirse de él, y se queda a menos de un dedo del borde
  const edge = await lab(
    page,
    ([x, y0, y1]) => {
      for (let y = y1 + 12; y > y0; y -= 2) {
        if (!document.elementFromPoint(x, y)) continue;
        return y;
      }
      return y1;
    },
    [center.x, frame.box[1], frame.box[3]],
  );
  expect(edge).toBeGreaterThan(0);
  await page.mouse.click(center.x, center.y);
  await expect(page.getByRole('button', { name: 'Guardar lectura' })).toBeVisible();
});

test('la decoración no quita el toque ni la vista de la estantería', async ({ page }) => {
  await page.goto('/?piloto=piso');
  // Una planta alta en la línea que va de los ojos a la balda, justo fuera del paso reservado
  await seedRoom(page, [{ uid: 3, id: 'planta-grande', x: 1, y: 3, rot: 0, tono: 1 }]);
  await page.getByRole('button', { name: MINE }).click();
  await page.waitForFunction(() => window.__pisoLabTiempos?.puerta, null, { timeout: 60000 });
  const row = await lab(page, async () => {
    const a = window.__pisoLab();
    await a.zoomShelf(1, { instant: true });
    return a.frameOf('estanteria');
  });
  expect(row.clear).toBe(1);
  await lab(page, () => window.__pisoLab().zoomShelf(null, { instant: true }));
  // Tocando la estantería a través de lo que tenga delante se llega a su balda
  await lab(page, () => window.__pisoLab().lookTo(-0.5));
  const at = await stable(page, 'estanteria');
  await page.mouse.click(at.x, at.y);
  await page.waitForFunction(() => window.__pisoLab().debug().zoomed);
});

test('en el decorador, dos muebles superpuestos: otro toque elige el de detrás, y se puede mover', async ({ page }) => {
  await page.goto('/?piloto=piso');
  // La planta tapa la estantería vista en isométrica
  await seedRoom(page, [{ uid: 3, id: 'planta-grande', x: 2, y: 1, rot: 0, tono: 1 }]);
  await page.getByRole('button', { name: MINE }).click();
  await page.waitForFunction(() => window.__pisoLabTiempos?.puerta, null, { timeout: 60000 });
  await page.getByRole('button', { name: 'Decorar' }).click();
  const canvas = page.locator('.ed-piso canvas').first();
  await expect(canvas).toBeVisible();
  const spot = await lab(page, () => window.__edificioPiso.stackProbe('planta-grande', 'estanteria'));
  expect(spot).not.toBeNull();
  const box = await canvas.boundingBox();
  const point = { x: box.x + (spot.x / spot.w) * box.width, y: box.y + (spot.y / spot.h) * box.height };
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('.ed-piso').getByText(/Detrás hay estantería/)).toBeVisible();
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('.ed-piso').getByText(/Estantería: arrástralo/)).toBeVisible();
  // Se arrastra aunque por delante siga la planta
  const where = () => lab(page, () => window.__edificioPiso.placed('estanteria'));
  const before = await where();
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i += 1) {
    await page.mouse.move(point.x + i * 12, point.y + i * 5);
    await page.waitForTimeout(60);
  }
  await page.mouse.up();
  const after = await where();
  expect([after.x, after.y]).not.toEqual([before.x, before.y]);
});

test('el escritorio: calendario, diario y estadísticas delante, y todas las funciones', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await enter(page);
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('navigation', { name: 'Accesos del piso' }).getByRole('button', { name: 'Ordenador' }).click();
  const main = page.getByRole('region', { name: 'Lo principal' });
  await expect(main.getByRole('button')).toHaveText([/Calendario/, /Mi diario/, /Estadísticas/, /Biblioteca/, /Sesiones/, /Comunidad/]);
  await page.getByRole('button', { name: 'Aplicaciones' }).click();
  const names = await page.locator('.plab-desktop button').allInnerTexts();
  const all = ['Calendario', 'Mi diario', 'Estadísticas', 'Notas', 'Sesiones', 'Temporizador', 'Reto anual', 'Misiones', 'Citas', 'Biblioteca', 'Sonido', 'Registrar', 'Aplicaciones', 'Volver al escritorio', 'Añadir un libro', 'Importar biblioteca', 'Pedir recomendación', 'Mapa de sagas', 'Radio', 'Comunidad', 'Cuenta y copias'];
  for (const name of all) expect(names.some((text) => text.includes(name))).toBe(true);
  expect(names).toHaveLength(all.length);
  for (const section of ['Mi lectura', 'Mi progreso', 'Mis libros', 'Radio y cuenta']) await expect(page.getByRole('region', { name: section })).toBeAttached();
  // Los cuatro grandes se ven sin desplazar y sin salirse
  for (const button of await main.getByRole('button').all()) {
    const b = await button.boundingBox();
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(320);
    expect(b.y + b.height).toBeLessThanOrEqual(568);
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('el render descansa: quieto, tapado y oculto no dibuja', async ({ page }) => {
  await enter(page);
  const renders = () => lab(page, () => window.__pisoLab().debug().exterior.renders);
  // Con la ventana a la vista, solo el agua pide dibujos, a su paso lento
  await page.waitForTimeout(800);
  const water = await renders();
  await page.waitForTimeout(2000);
  expect((await renders()) - water).toBeLessThanOrEqual(6);
  // Sin la ventana a la vista, ni uno
  await lab(page, () => window.__pisoLab().lookTo(-0.6));
  await page.waitForTimeout(800);
  const still = await renders();
  await page.waitForTimeout(2000);
  expect(await renders()).toBe(still);
  await lab(page, () => window.__pisoLab().lookTo(0));
  await page.getByRole('button', { name: /^Registrar lectura/ }).click();
  await page.getByRole('button', { name: 'Guardar lectura' }).waitFor();
  await page.waitForTimeout(600);
  const covered = await renders();
  await page.waitForTimeout(1500);
  expect(await renders()).toBe(covered);
});
