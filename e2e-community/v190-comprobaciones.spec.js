// 1.90 · «Escritorio del puerto»: sonido, registro, foco y anchos. Datos de prueba y Supabase simulado; motor Chromium emulando móvil.
import { expect, test } from '@playwright/test';
import { abrirCasa } from './v190-apoyo';

const audio = (page) => page.evaluate(() => window.__portAudio());
const menu = (page) => page.getByRole('button', { name: 'Menú de accesos' });
const abrirSonido = async (page) => {
  await menu(page).click();
  await page.getByRole('button', { name: 'Sonido' }).click();
  await expect(page.getByRole('heading', { name: 'Radio del puerto' })).toBeVisible();
};
const cerrarSonido = async (page) => {
  await page.getByRole('button', { name: 'Cerrar Sonido' }).click();
  await expect(page.getByRole('heading', { name: 'Radio del puerto' })).toBeHidden();
  await page.waitForTimeout(200);
};
const abrirOrdenador = async (page) => {
  await menu(page).click();
  await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible({ timeout: 12000 });
};
const salirOrdenador = async (page) => {
  await page.getByRole('button', { name: 'Salir del ordenador' }).click();
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeHidden();
  await page.waitForTimeout(300);
};
const registro = (page) => page.getByRole('button', { name: /^Registrar lectura de / }).first();
const libro = (page) =>
  page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
    return { log: st.progress.readingLog.length, leyendo: st.books.find((b) => b.status === 'reading') };
  });

test.beforeEach(({}, info) => {
  test.skip(!/390x844/.test(info.project.name), 'estas comprobaciones, a 390');
});

test('sonido: silencio inicial, activación, canales, continuidad y persistencia', async ({ page }) => {
  test.setTimeout(150000);
  const pedidos = [];
  page.on('request', (r) => r.url().includes('/media/sonido/') && pedidos.push(r.url()));
  await abrirCasa(page);
  let a = await audio(page);
  expect(a.prefs.decided).toBe(false);
  expect(a.prefs.on).toBe(false);
  await menu(page).click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  a = await audio(page);
  expect(a.unlocked, 'abrir un menú no activa el sonido').toBe(false);
  expect(pedidos, 'sin descargas antes de activar').toHaveLength(0);
  expect(await page.evaluate(() => window.__uiSoundLog ?? [])).toHaveLength(0);

  await abrirSonido(page);
  await page.getByRole('button', { name: 'Activar sonido' }).click();
  await expect.poll(async () => (await audio(page)).musica, { timeout: 15000 }).toBe('tarde');
  await expect.poll(async () => (await audio(page)).ambiente, { timeout: 15000 }).toBeFalsy();
  a = await audio(page);
  expect(a.prefs).toMatchObject({ effects: 25, ambience: 15, music: 12, master: 70, on: true });
  expect(a.starts).toBe(1);
  expect(pedidos).toHaveLength(1);

  // Canales independientes
  await page.locator('#sonido-music').fill('30');
  a = await audio(page);
  expect(a.prefs).toMatchObject({ effects: 25, ambience: 15, music: 30 });

  // Fundido cruzado al elegir otra pista
  await page.getByLabel('Luz de escritorio').check();
  await expect.poll(async () => (await audio(page)).musica, { timeout: 15000 }).toBe('luz');
  expect((await audio(page)).fundiendo).toBe(1);
  await expect.poll(async () => (await audio(page)).fundiendo, { timeout: 3000 }).toBe(0);
  const arranques = (await audio(page)).starts;
  await cerrarSonido(page);

  // Diez aperturas y cierres, y día/noche: la música sigue, sin duplicar ni reiniciar
  for (let i = 0; i < 10; i += 1) {
    await abrirOrdenador(page);
    await salirOrdenador(page);
  }
  await menu(page).click();
  await page.getByRole('button', { name: 'Ver de noche' }).click();
  await page.waitForTimeout(700);
  a = await audio(page);
  expect(a.starts, 'sin arranques nuevos').toBe(arranques);
  expect(a.fundiendo).toBe(0);
  expect(a.musica).toBe('luz');
  expect(await page.evaluate(() => document.documentElement.dataset.uiTheme)).toBe('noche');

  // Oculta: suspende; al volver, reanuda
  const visible = (hidden) =>
    page.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await visible(true);
  await expect.poll(async () => (await audio(page)).state).toBe('suspended');
  await visible(false);
  await expect.poll(async () => (await audio(page)).state).toBe('running');

  // Silencio general
  await abrirSonido(page);
  await page.getByRole('switch', { name: /Sonido/ }).uncheck();
  await expect.poll(async () => (await audio(page)).state, { timeout: 3000 }).toBe('suspended');
  await page.getByRole('switch', { name: /Sonido/ }).check();
  await expect.poll(async () => (await audio(page)).state, { timeout: 3000 }).toBe('running');
  expect((await audio(page)).starts).toBe(arranques);
  await page.waitForTimeout(400);

  // Persistencia: tras recargar, los mismos ajustes y nada hasta el primer gesto
  await page.reload();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  a = await audio(page);
  expect(a.prefs).toMatchObject({ music: 30, musicId: 'luz', on: true });
  expect(a.unlocked).toBe(false);
  await menu(page).click();
  await expect.poll(async () => (await audio(page)).musica, { timeout: 15000 }).toBe('luz');
});

test('sonido: un archivo que falla no bloquea, se avisa y no se reintenta solo', async ({ page }) => {
  test.setTimeout(90000);
  let fallos = 0;
  await page.route('**/media/sonido/lluvia.mp3', (r) => {
    fallos += 1;
    return r.abort();
  });
  await abrirCasa(page);
  await abrirSonido(page);
  await page.getByRole('button', { name: 'Activar sonido' }).click();
  await expect.poll(async () => (await audio(page)).musica, { timeout: 15000 }).toBe('tarde');
  await page.getByLabel('Lluvia').check();
  await expect(page.locator('.port-note')).toContainText('Lluvia');
  await page.waitForTimeout(1500);
  expect(fallos).toBe(1);
  await expect(page.locator('.port-note')).toHaveCount(1);
  await cerrarSonido(page);
  await abrirOrdenador(page);
  await salirOrdenador(page);
  expect(fallos, 'sin reintentos al navegar').toBe(1);
});

test('registro: confirmado, recarga, doble toque, error, deshacer y fin de libro', async ({ page }) => {
  test.setTimeout(120000);
  await abrirCasa(page);
  await abrirSonido(page);
  await page.getByRole('button', { name: 'Activar sonido' }).click();
  await expect.poll(async () => (await audio(page)).musica, { timeout: 15000 }).toBe('tarde');
  await cerrarSonido(page);
  await page.evaluate(() => (window.__uiSoundLog = []));

  const inicio = await libro(page);
  await registro(page).click();
  await expect(page.locator('.log-sheet')).toBeVisible();
  await page.getByRole('radio', { name: /He leído/ }).click();
  await page.locator('.reading-form__input input').fill('10');
  await expect(page.locator('.reading-form__summary')).toHaveText(new RegExp(`^Llegarás a la página ${inicio.leyendo.currentPage + 10} de ${inicio.leyendo.pageCount}$`));
  // Doble toque: una sola escritura
  await page.locator('.reading-form__save').dblclick();
  await expect(page.locator('.log-toast')).toContainText('Lectura registrada');
  await expect(page.locator('.log-toast')).toContainText('10');
  await page.waitForTimeout(300);
  let ahora = await libro(page);
  expect(ahora.log).toBe(inicio.log + 1);
  expect(ahora.leyendo.currentPage).toBe(inicio.leyendo.currentPage + 10);
  const sonidos = await page.evaluate(() => window.__uiSoundLog.map((x) => x.event));
  expect(sonidos.filter((e) => e === 'save-success')).toHaveLength(1);

  // Deshacer
  await page.locator('.log-toast').getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.locator('.log-toast')).toBeHidden();
  await page.waitForTimeout(500);
  ahora = await libro(page);
  expect(ahora.log).toBe(inicio.log);
  expect(ahora.leyendo.currentPage).toBe(inicio.leyendo.currentPage);

  // Error de guardado: ni éxito ni pérdida de lo escrito; al arreglarse, se reintenta
  await page.evaluate(() => {
    window.__setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(k, v) {
      if (k === 'bookshelf:v1') throw new DOMException('lleno', 'QuotaExceededError');
      return window.__setItem.call(this, k, v);
    };
    window.__uiSoundLog = [];
  });
  await registro(page).click();
  await page.getByRole('radio', { name: /He leído/ }).click();
  await page.locator('.reading-form__input input').fill('7');
  await page.locator('.reading-form__save').click();
  await expect(page.locator('.reading-form__error')).toContainText('No se ha podido guardar');
  await expect(page.locator('.reading-form__input input')).toHaveValue('7');
  await expect(page.locator('.log-toast')).toBeHidden();
  const log = await page.evaluate(() => window.__uiSoundLog.map((x) => x.event));
  expect(log).toContain('save-error');
  expect(log).not.toContain('save-success');
  await page.evaluate(() => (Storage.prototype.setItem = window.__setItem));
  await page.locator('.reading-form__save').click();
  await expect(page.locator('.log-toast')).toContainText('7');

  // Recarga: el dato sigue
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  ahora = await libro(page);
  expect(ahora.log).toBe(inicio.log + 1);
  expect(ahora.leyendo.currentPage).toBe(inicio.leyendo.currentPage + 7);

  // Terminar el libro abre su reseña
  await registro(page).click();
  await page.getByRole('radio', { name: /Voy por la página/ }).click();
  await page.locator('.reading-form__input input').fill(String(ahora.leyendo.pageCount));
  await page.locator('.reading-form__save').click();
  await expect(page.getByRole('dialog').filter({ hasText: /reseña|Reseña|terminado/ }).last()).toBeVisible({ timeout: 8000 });
});

test('foco, teclado y volver al escritorio', async ({ page }) => {
  test.setTimeout(90000);
  await abrirCasa(page);
  await page.keyboard.press('m');
  const hoja = page.getByRole('dialog', { name: 'Tu rincón' });
  await expect(hoja).toBeVisible();
  await expect(hoja.getByRole('button', { name: 'Ordenador' })).toBeFocused();
  // El tabulador no sale de la hoja
  for (let i = 0; i < 14; i += 1) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement.closest('.port-menu__sheet')))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(hoja).toBeHidden();
  await expect(menu(page)).toBeFocused();

  await abrirOrdenador(page);
  await page.getByRole('button', { name: 'Calendario' }).click();
  await expect(page.getByRole('heading', { name: 'Calendario' })).toBeVisible();
  await page.getByRole('button', { name: 'Volver al escritorio' }).click();
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Calendario' })).toBeFocused();

  await page.getByRole('button', { name: 'Calendario' }).click();
  const dias = page.locator('.port-cal__day');
  await expect(dias.first()).toBeVisible();
  const ancho = await dias.first().evaluate((d) => d.getBoundingClientRect().width);
  expect(ancho).toBeGreaterThanOrEqual(48);
  await salirOrdenador(page);
  await expect(page.locator('.plab-controls')).toBeVisible();
});

test('movimiento reducido: solo opacidad', async ({ browser }) => {
  test.setTimeout(60000);
  const context = await browser.newContext({ baseURL: 'http://localhost:5196', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await abrirCasa(page);
  await menu(page).click();
  const animacion = await page.locator('.port-menu__sheet').evaluate((n) => getComputedStyle(n).animationName);
  expect(animacion).toBe('port-fade');
  await context.close();
});

test('teclado visible y texto ampliado no tapan funciones', async ({ browser }) => {
  test.setTimeout(60000);
  const context = await browser.newContext({ baseURL: 'http://localhost:5196', viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await abrirCasa(page);
  await registro(page).click();
  await page.getByRole('radio', { name: /He leído/ }).click();
  // Como en el móvil con teclado: la parte visible se queda en 340 px
  await page.setViewportSize({ width: 320, height: 340 });
  await page.locator('.reading-form__input input').focus();
  await page.locator('.reading-form__input input').fill('5');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'qa-report/v190/capturas/320-teclado-simulado.png' });
  const r = await page.evaluate(() => {
    const campo = document.querySelector('.reading-form__input input').getBoundingClientRect();
    const pie = document.querySelector('.reading-form__actions').getBoundingClientRect();
    return { campoBottom: campo.bottom, pieTop: pie.top, ancho: document.documentElement.scrollWidth, inner: innerWidth };
  });
  expect(r.campoBottom, 'el pie no tapa el campo').toBeLessThanOrEqual(r.pieTop);
  expect(r.ancho).toBeLessThanOrEqual(r.inner);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar' }).click();
  await page.waitForTimeout(300);
  // Texto ampliado: la página a 150 %
  await page.evaluate(() => (document.documentElement.style.zoom = '1.5'));
  await menu(page).click();
  await expect(page.getByRole('button', { name: 'Ordenador', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Ver de noche/ }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: /Ver de noche/ })).toBeVisible();
  await context.close();
});
