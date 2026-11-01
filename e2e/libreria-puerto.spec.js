// Prototipo «La librería del puerto» (solo desarrollo, /dev/libreria-puerto.html): se juega de verdad con los controles
// reales —tocar y tocar, «Girar», arrastre y teclado— en 360, 390, 430, escritorio y WebKit. Datos de demostración;
// nada toca la biblioteca ni las recompensas. Emulación de Playwright: no equivale a un iPhone físico.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PROJECTS = /chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$|reduced/;

async function shot(page, info, name, fullPage = true) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  // Durante un arrastre, sin página completa: cambiar el tamaño de la ventana cancela el gesto (a propósito)
  await page.screenshot({ path: join(dir, `${name}.png`), fullPage });
}

async function open(page, nivel = 'n1', modo = 'practica') {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/fonts\.g/.test(m.text()) && errors.push(m.text()));
  await page.goto(`/dev/libreria-puerto.html?nivel=${nivel}&modo=${modo}`);
  await page.waitForFunction(() => window.__libreria?.debug().hits.length > 0);
  await page.locator('.lp-canvas').scrollIntoViewIfNeeded();
  return errors;
}

const placed = (page, id) => page.evaluate((b) => window.__libreria.state.placed[b], id);
const bookCentre = (page, id) =>
  page.evaluate((b) => {
    const g = window.__libreria;
    const h = g.debug().hits.find((x) => x.id === b);
    return g.artToScreen((h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2);
  }, id);
/** Punto de pantalla para tocar el destino: centro de las columnas que ocupará, un poco por encima de la tabla. */
const slotPoint = (page, balda, x, w) => page.evaluate(([b, x0, ww]) => window.__libreria.screenOf(b, x0 + ww / 2, 0.4), [balda, x, w]);

async function tapPlace(page, step, width) {
  const from = await bookCentre(page, step.libro);
  await page.mouse.click(from.x, from.y);
  if (step.orient === 'tumbado') await page.getByRole('button', { name: 'Girar' }).click();
  const to = await slotPoint(page, step.balda, step.x, width);
  await page.mouse.click(to.x, to.y);
}

test('se juegan los cinco niveles con tocar y tocar (y «Girar»); tres estrellas en el mínimo; victoria una sola vez', async ({ page }, info) => {
  test.skip(!PROJECTS.test(info.project.name), 'tamaños del prototipo');
  test.setTimeout(120_000);
  const errors = await open(page, 'n1');
  const levels = await page.evaluate(() => import('/src/features/minigames/libreria-puerto/levels.js').then((m) => m.LEVELS.map((l) => ({ id: l.id, solution: l.solution, libros: l.libros }))));
  for (const level of levels) {
    await page.locator('#level').selectOption(level.id);
    await page.waitForFunction((id) => window.__libreria?.state.level === id, level.id);
    // Cada nivel tiene su altura (y su nota de encargo): el lienzo tiene que quedar entero a la vista
    await page.locator('.lp-canvas').evaluate((c) => c.scrollIntoView({ block: 'center' }));
    for (const step of level.solution) {
      const libro = level.libros.find((b) => b.id === step.libro);
      const w = step.orient === 'tumbado' ? libro.alto : libro.grosor;
      await tapPlace(page, step, w);
      await expect.poll(() => placed(page, step.libro), { message: `${level.id} · ${step.libro}` }).toEqual({ balda: step.balda, x: step.x, y: step.y, orient: step.orient });
    }
    await expect(page.locator('.lp-done')).toBeVisible();
    await expect(page.locator('.lp-done')).toContainText('¡Estantería lista!');
    await expect(page.locator('.lp-stars')).toHaveAttribute('aria-label', '3 de 3 estrellas');
    await shot(page, info, `lp-${level.id}-completo`);
  }
  // Una victoria por partida: cinco niveles, cinco victorias en el registro (y ninguna repetida)
  const wins = await page.evaluate(() => window.__libreriaAdapter.state.log.filter((l) => l.includes('Victoria')).length);
  expect(wins).toBe(levels.length);
  expect(errors).toEqual([]);
});

test('arrastrar: previsualización, posición inválida que vuelve sin cambiar nada, gesto cancelado y girar en pleno arrastre', async ({ page }, info) => {
  test.skip(!/chromium-(390x844|1440x900)$|webkit-390x844$/.test(info.project.name), 'arrastre con ratón en 390 y escritorio');
  await open(page, 'n3');
  const before = await page.evaluate(() => window.__libreria.exportState());
  // El atlas de pie no cabe: soltarlo en la balda lo devuelve a la caja y el tablero no cambia
  const from = await bookCentre(page, 'gran-atlas');
  const to = await slotPoint(page, 'A', 0, 2);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 4, from.y - 16, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await expect(page.locator('.lp-btn--rotate')).toBeEnabled();
  await shot(page, info, 'lp-arrastre-invalido', false);
  await page.mouse.up();
  await expect(page.locator('.lp-status')).toContainText('No cabe');
  expect(await page.evaluate(() => window.__libreria.exportState())).toBe(before);
  // Espera a que termine la vuelta suave a la caja (220 ms) antes de cogerlo otra vez
  await page.waitForTimeout(350);
  // Ahora girándolo durante el arrastre (tecla R): encaja tumbado
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 4, from.y - 16, { steps: 3 });
  await page.keyboard.press('r');
  const lying = await slotPoint(page, 'A', 0, 5);
  await page.mouse.move(lying.x, lying.y, { steps: 6 });
  await shot(page, info, 'lp-arrastre-valido', false);
  await page.mouse.up();
  await expect.poll(() => placed(page, 'gran-atlas')).toEqual({ balda: 'A', x: 0, y: 0, orient: 'tumbado' });
  // Un gesto cancelado (pointercancel) no pierde el libro ni cambia el tablero
  const mid = await page.evaluate(() => window.__libreria.exportState());
  const lim = await bookCentre(page, 'limones');
  await page.mouse.move(lim.x, lim.y);
  await page.mouse.down();
  await page.mouse.move(lim.x + 4, lim.y - 30, { steps: 4 });
  await page.locator('.lp-canvas').dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__libreria.debug().held)).toBe(null);
  expect(await page.evaluate(() => window.__libreria.exportState())).toBe(mid);
  // El libro de abajo no se puede sacar con otro encima
  const dic = await bookCentre(page, 'diccionario');
  await page.mouse.click(dic.x, dic.y);
  await page.getByRole('button', { name: 'Girar' }).click();
  const top = await slotPoint(page, 'A', 0, 5);
  await page.mouse.click(top.x, top.y);
  await expect.poll(() => placed(page, 'diccionario')).toMatchObject({ y: 2 });
  const atlas = await bookCentre(page, 'gran-atlas');
  await page.mouse.click(atlas.x, atlas.y);
  await expect(page.locator('.lp-status')).toContainText('Primero quita el libro que tiene encima');
});

test('teclado: se resuelve el primer nivel sin ratón; deshacer y reiniciar', async ({ page }, info) => {
  test.skip(!/chromium-(390x844|1440x900)$|webkit-390x844$|reduced/.test(info.project.name), 'teclado');
  await open(page, 'n1');
  const canvas = page.locator('.lp-canvas');
  await canvas.focus();
  const solution = [0, 1, 2, 4];
  for (const [i, x] of solution.entries()) {
    if (i) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    for (let k = 0; k < x; k += 1) await page.keyboard.press('ArrowRight');
    if (i === 2) {
      // Deshacer a mitad: el tercero no se ha colocado aún; se suelta con Escape y se deshace el segundo
      await page.keyboard.press('Escape');
      await page.keyboard.press('z');
      await expect.poll(() => placed(page, 'faros')).toBe(null);
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
      for (let k = 0; k < x; k += 1) await page.keyboard.press('ArrowRight');
    }
    await page.keyboard.press('Enter');
  }
  await expect(page.locator('.lp-done')).toBeVisible();
  await expect(page.locator('.lp-status')).toContainText('¡Estantería lista!');
  // Reiniciar devuelve el nivel inicial
  await page.getByRole('button', { name: 'Volver a jugar' }).click();
  const fresh = await page.evaluate(() => JSON.parse(window.__libreria.exportState()));
  expect(Object.values(fresh.placed).every((p) => p === null)).toBe(true);
  expect(fresh.won).toBe(false);
});

test('guardar y restaurar; salir y volver no duplica bucles ni audio; reto mensual de demostración', async ({ page }, info) => {
  test.skip(!/chromium-390x844$|webkit-390x844$/.test(info.project.name), '390');
  await open(page, 'n2');
  const step = { libro: 'velas', balda: 'A', x: 0, y: 0, orient: 'pie' };
  await tapPlace(page, step, 1);
  await expect.poll(() => placed(page, 'velas')).toEqual({ balda: 'A', x: 0, y: 0, orient: 'pie' });
  await page.getByRole('button', { name: 'Guardar partida' }).click();
  await page.getByRole('button', { name: 'Reiniciar' }).click();
  expect(await placed(page, 'velas')).toBe(null);
  await page.getByRole('button', { name: 'Restaurar' }).click();
  await expect.poll(() => placed(page, 'velas')).toEqual({ balda: 'A', x: 0, y: 0, orient: 'pie' });
  // Salir y volver cinco veces: un solo juego montado, sin fotogramas ni contextos de audio de más
  for (let k = 0; k < 5; k += 1) await page.getByRole('button', { name: 'Salir y volver' }).click();
  await expect(page.locator('.lp')).toHaveCount(1);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__libreria.debug())).toMatchObject({ raf: 0, audio: 0 });
  expect(await placed(page, 'velas')).toEqual({ balda: 'A', x: 0, y: 0, orient: 'pie' });
  // Reto mensual (demo): bloqueado hasta usar el ticket de demostración; la recompensa es ilustrativa
  await page.getByLabel('Reto mensual (demo)').check();
  await expect(page.locator('#game')).toContainText('ticket dorado de demostración');
  await page.getByRole('button', { name: 'Usar ticket dorado (demo)' }).click();
  await page.locator('#level').selectOption('n1');
  await page.waitForFunction(() => window.__libreria?.state.level === 'n1');
  const levels = await page.evaluate(() => import('/src/features/minigames/libreria-puerto/levels.js').then((m) => m.LEVELS[0]));
  for (const s of levels.solution) await tapPlace(page, s, levels.libros.find((b) => b.id === s.libro).grosor);
  await expect(page.locator('#reward')).toBeVisible();
  await expect(page.locator('#reward')).toContainText('Demo');
  await shot(page, info, 'lp-reto-demo');
  // La biblioteca de BookShelf no se ha tocado (la demo no escribe en su clave)
  expect(await page.evaluate(() => localStorage.getItem('bookshelf:v1'))).toBe(null);
});

test('pista: marca el siguiente paso y quita la estrella de «limpio»; vista en la app como app del ordenador', async ({ page }, info) => {
  test.skip(!/chromium-390x844$|webkit-390x844$/.test(info.project.name), '390');
  const errors = await open(page, 'n1');
  await page.getByRole('button', { name: 'Pista' }).click();
  await expect(page.locator('.lp-status')).toContainText('Pista: «Cuaderno de sal»');
  const levels = await page.evaluate(() => import('/src/features/minigames/libreria-puerto/levels.js').then((m) => m.LEVELS[0]));
  for (const s of levels.solution) await tapPlace(page, s, levels.libros.find((b) => b.id === s.libro).grosor);
  await expect(page.locator('.lp-stars')).toHaveAttribute('aria-label', '2 de 3 estrellas');
  await expect(page.locator('.lp-stars__list')).toContainText('· En 4 (el mínimo) y sin pistas');
  // Vista previa en la app: portátil → app «Librería» del ordenador → juego en su ventana; cerrar lo desmonta
  await page.goto('/dev/libreria-puerto-app.html');
  await page.getByRole('button', { name: 'Abrir el ordenador' }).click();
  await page.getByRole('button', { name: 'La librería del puerto', exact: true }).click();
  await expect(page.getByRole('button', { name: 'La librería del puerto', exact: true })).toHaveAttribute('aria-selected', 'true');
  const frame = page.frameLocator('#frame');
  await expect(frame.locator('.lp-canvas')).toBeVisible();
  await frame.getByRole('button', { name: /Nivel 4/ }).click();
  await expect(frame.locator('.lp-title')).toHaveText('Tres baldas');
  await expect(frame.getByRole('button', { name: /Nivel 4/ })).toHaveAttribute('aria-pressed', 'true');
  // Las estrellas del nivel 1 se recuerdan (clave propia de la demo)
  await expect(frame.getByRole('button', { name: /Nivel 1/ })).toHaveAttribute('aria-label', /2 de 3 estrellas/);
  // Dentro de la ventana del ordenador no hay cabecera propia: la pone la ventana
  await expect(frame.getByRole('button', { name: /Volver al rincón/ })).toBeHidden();
  await page.getByRole('button', { name: 'Cerrar La librería del puerto' }).click();
  await expect(page.locator('#win')).toBeHidden();
  expect(await page.locator('#frame').getAttribute('src')).toBe('about:blank');
  await page.getByRole('button', { name: 'Salir del ordenador' }).click();
  await expect(page.getByRole('button', { name: 'Abrir el ordenador' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('bookshelf:v1'))).toBe(null);
  expect(errors).toEqual([]);
});

test('nivel de la semana: sin pistas, la victoria se valida repitiendo las jugadas y entra en el ranking (demo)', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844)$|webkit-390x844$/.test(info.project.name), '360 y 390');
  test.setTimeout(90_000);
  const errors = await open(page, 'semana');
  await expect(page.locator('.lp-title')).toHaveText('Nivel de la semana');
  await expect(page.getByRole('button', { name: 'Pista' })).toHaveCount(0);
  const weekly = await page.evaluate(() => ({ solution: window.__libreriaWeekly.solution, libros: window.__libreriaWeekly.libros }));
  await page.locator('.lp-canvas').evaluate((c) => c.scrollIntoView({ block: 'center' }));
  for (const step of weekly.solution) {
    const libro = weekly.libros.find((b) => b.id === step.libro);
    await tapPlace(page, step, step.orient === 'tumbado' ? libro.alto : libro.grosor);
    await expect.poll(() => placed(page, step.libro), { message: step.libro }).toEqual({ balda: step.balda, x: step.x, y: step.y, orient: step.orient });
  }
  await expect(page.locator('.lp-stars')).toHaveAttribute('aria-label', '3 de 3 estrellas');
  // El resultado se guarda contado desde las jugadas (el mínimo), en la clave de la demo
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:dev:libreria-puerto:semanas')));
  expect(Object.values(saved)[0]).toMatchObject({ moves: weekly.libros.length, min: weekly.libros.length });
  await page.getByRole('button', { name: 'Ranking semanal y mensual' }).click();
  const me = page.locator('.rank-row.is-me');
  await expect(me).toContainText('Tú');
  await expect(me).toContainText(`${weekly.libros.length} mov.`);
  await expect(page.locator('#rank-me')).toContainText('Si la semana cerrara ahora');
  await shot(page, info, 'lp-ranking-semana', false);
  await page.getByRole('tab', { name: 'Mes' }).click();
  await expect(page.getByRole('tab', { name: 'Mes' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#badge-name')).toHaveText('Podio del mes');
  await page.keyboard.press('Escape');
  await expect(page.locator('#ranking')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('bookshelf:v1'))).toBe(null);
  expect(errors).toEqual([]);
});
