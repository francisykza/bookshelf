// 1.116 · La sala de lectura en 3D (bloque a de docs/qa/sala-lectura-3d.md), con Supabase simulado: se entra desde el
// Directorio del hotel con toda la biblioteca delante; quien lee, sentado con su personaje y su compañero; tocar un sillón
// lleva andando hasta él y sentarse empieza la sesión (con la elección de qué compartir de siempre); sentada, el libro abierto
// delante y el reloj encima de la escena; al levantarte, ese sillón es el tuyo y tu libro te espera en su mesita; la librería
// común con sus lomos; el reloj y el sofá (pronto). Sin WebGL, el dibujo de siempre. Capturas en qa-report/sala3d/; vídeo con
// SALA_VIDEO=1.
import { expect, test } from '@playwright/test';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_AVATAR } from '../src/features/edificio/actor';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BEA = '22222222-2222-4222-8222-222222222222';
const DIR = join('qa-report', 'sala3d');
async function shot(page, info, name) {
  mkdirSync(DIR, { recursive: true });
  await page.mouse.move(0, 0);
  // La sala ocupa casi toda la pantalla: encuadrarla entera antes de la captura (un toque puede haber desplazado la página)
  await page
    .locator('.sl3')
    .evaluate((e) => e.scrollIntoView({ block: 'nearest' }))
    .catch(() => {});
  await page.screenshot({ path: join(DIR, `${name}-${info.project.name}.png`) });
}
const settled = (page) => page.waitForFunction(() => window.__sala3d?.settled());
const PORTADA = 'https://covers.openlibrary.org/b/id/prueba-sala-L.jpg';
const LIBRO = {
  id: 'faro',
  title: 'Una luz en la bahía',
  author: 'Autora de prueba',
  status: 'reading',
  pageCount: 320,
  currentPage: 96,
  cover: PORTADA,
  addedAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-10T10:00:00.000Z',
  quotes: [],
};

async function aLaSala(page, { reduced = true, sinWebgl = false, saludo = false } = {}) {
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.profiles.push({ user_id: BEA, alias: 'Bea lectora', avatar_id: 'lectora-cafe', community_enabled: true });
  mock.db.sala_personajes = [
    { user_id: ANA.id, personaje: { ...DEFAULT_AVATAR, jersey: 2, pelo: 'corto' }, companero: null },
    { user_id: BEA, personaje: { ...DEFAULT_AVATAR, piel: 3, colorPelo: 4, jersey: 5, pelo: 'melena' }, companero: 'mapache-crupier' },
  ];
  mock.db.sala = {
    lomos: [
      { id: 'l1', titulo: 'El faro del fin', alias: 'Bea lectora', mio: false },
      { id: 'l2', titulo: 'Mar de fondo', alias: 'Carla', mio: false },
      { id: 'l3', titulo: 'La casa del acantilado', alias: 'Dani', mio: false },
      { id: 'l4', titulo: 'Bitácora de invierno', alias: 'Ana lectora', mio: true },
      ...['Niebla', 'Las mareas', 'Sal y tinta', 'El último ferri', 'Cartas al puerto', 'La lonja', 'Gaviotas', 'Noches de faro'].map((titulo, k) => ({
        id: `x${k}`,
        titulo,
        alias: 'Alguien',
        mio: false,
      })),
    ],
    saludos: saludo ? [BEA] : [],
  };
  const ahora = new Date().toISOString();
  mock.db.reading_presence.push({ user_id: BEA, share_book: true, book_title: 'El faro del fin', started_at: ahora, last_seen: ahora });
  await page.route(/covers\.openlibrary\.org/, (route) =>
    route.fulfill({ status: 200, contentType: 'image/jpeg', headers: { 'access-control-allow-origin': '*' }, body: readFileSync(join('public', 'images', 'room-refresh', 'bahia-anochecer.jpg')) }),
  );
  await mock.attach(page, ANA);
  await page.addInitScript(
    ({ libro, sinWebgl: sin }) => {
      localStorage.setItem('bookshelf:signs-hint-done', 'true');
      if (!localStorage.getItem('bookshelf:v1'))
        localStorage.setItem(
          'bookshelf:v1',
          JSON.stringify({
            version: 8,
            books: [libro],
            settings: { sound: false, sfx: false, onboardingDone: true, currentBookId: libro.id },
            progress: { readingLog: [], pomodoros: [], claimed: {} },
          }),
        );
      if (sin) {
        const get = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
          return /webgl/.test(kind) ? null : get.call(this, kind, ...rest);
        };
      }
    },
    { libro: LIBRO, sinWebgl },
  );
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Coger la limusina al Gran Hotel' }).click({ timeout: 15000 });
  const hotel = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' });
  await hotel.getByRole('button', { name: 'Directorio' }).click({ timeout: 15000 });
  await hotel.getByRole('button', { name: /Café-biblioteca/ }).click();
  const sala = hotel.getByRole('region', { name: 'La sala de lectura' });
  if (!sinWebgl) {
    await expect(sala).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
    await page.waitForFunction(() => window.__sala3d?.renders() > 0);
  }
  return { hotel, sala, mock };
}

test('la sala en 3D: la entrada, quien lee, sentarte en un sillón, tu libro en la mesita y la librería común', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/.test(info.project.name), '360, 390 y 430 (y WebKit a 390) y escritorio');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const { sala, mock } = await aLaSala(page, { saludo: true });
  const tag = (name) => sala.locator('.sl3-tag', { hasText: name });
  const ir = async (name) => {
    await sala.getByRole('button', { name: 'Plano' }).click();
    await sala.getByRole('navigation', { name: 'Plano de la sala' }).getByRole('button', { name }).click();
  };

  // Recién entrada: la biblioteca delante, Bea leyendo en el primer sillón con su mapache, y los letreros
  await settled(page);
  await page.waitForTimeout(300);
  await shot(page, info, '01-entrada');
  expect(await page.evaluate(() => window.__sala3d.verLectores())).toEqual([{ sillon: 0, yo: false, companero: 'mapache-crupier' }]);
  await expect(tag('Un sillón libre')).toBeVisible();
  await expect(tag('El reloj')).toBeVisible();
  const stage = await sala.locator('.sl3').boundingBox();
  expect(stage.height).toBeGreaterThan(360);
  // El panel de siempre sigue debajo, con quien lee
  await expect(sala.getByRole('list', { name: 'Quién lee ahora' })).toContainText('Bea lectora');
  // La sesión, en una franja baja; antes de empezar eliges cuánto dura (el mismo ajuste que el Pomodoro de la app)
  const sesion = sala.locator('.sl3-sesion');
  expect((await sesion.boundingBox()).height).toBeLessThan(150);
  const dura = sala.getByRole('group', { name: 'Duración de la sesión' });
  await dura.getByRole('button', { name: '45' }).click();
  await expect(sesion.locator('.gh-lect__clock strong')).toHaveText('45:00');
  await dura.getByRole('button', { name: 'Cinco minutos más' }).click();
  await expect(sesion.locator('.gh-lect__clock strong')).toHaveText('50:00');
  await sesion.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(DIR, `01b-duracion-${info.project.name}.png`) });
  await dura.getByRole('button', { name: '25' }).click();
  await expect(sesion.locator('.gh-lect__clock strong')).toHaveText('25:00');

  // Un sillón libre: se va andando, te sientas y eliges qué compartir; empieza la sesión
  await tag('Un sillón libre').click();
  await page.waitForFunction(() => window.__sala3d.sentadoEn() === 1 && window.__sala3d.settled());
  const sit = sala.locator('.sl3-sit');
  await sit.getByRole('button', { name: 'Sentarme a leer' }).click();
  await expect(sit.getByRole('button', { name: 'Pausar' })).toBeVisible();
  expect(mock.db.reading_presence.some((r) => r.user_id === ANA.id)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__sala3d.verTuLibro().manos)).toBe(true);
  // Bea te saluda: el bocadillo va sobre su cabeza (está a tu lado, fuera de la vista) y la tarjeta lo dice
  await expect(sala.locator('.sl3-hola:not([data-vacio])')).toHaveCount(1, { timeout: 20000 });
  await expect(sit.locator('.sl3-sit__hola')).toContainText('Bea lectora levanta la vista y te saluda');
  await page.waitForTimeout(300);
  await shot(page, info, '02-sentada');
  expect(await page.evaluate(() => window.__sala3d.verLectores().find((l) => l.yo)?.sillon)).toBe(1);

  // Levantarse del sillón: ese sillón ya es el tuyo y tu libro está en su mesita
  await sit.getByRole('button', { name: 'Levantarte del sillón' }).click();
  await settled(page);
  await sala.getByRole('button', { name: 'Levantarte', exact: true }).click();
  await expect(tag('Tu sillón')).toBeAttached();
  await expect.poll(() => page.evaluate(() => window.__sala3d.verTuLibro().mesa)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('bookshelf:sala-sillon:11111111-1111-4111-8111-111111111111'))).toBe('1');
  await page.evaluate(() => window.__sala3d.place(7, 5.0, Math.PI));
  await settled(page);
  await page.waitForTimeout(300);
  await shot(page, info, '03-tu-sillon');

  // La librería común: delante de las baldas, los lomos; tocar uno dice de quién es
  await ir('La librería de la sala');
  await page.waitForFunction(() => window.__sala3d.enLibreria() && window.__sala3d.settled());
  const l1 = await page.evaluate(() => window.__sala3d.lomo('l1'));
  expect(await page.evaluate(({ x, y }) => window.__sala3d.lomoEn(x, y), l1)).toBe('l1');
  expect(l1.front).toBe(true);
  await page.mouse.click(l1.x, l1.y);
  await expect(sala.locator('.sl3-lib__nota')).toContainText('lo dejó Bea lectora');
  await expect.poll(() => page.evaluate(() => window.__sala3d.lomo('l1').fuera)).toBe(true);
  await page.waitForTimeout(300);
  await shot(page, info, '04-libreria');
  const l4 = await page.evaluate(() => window.__sala3d.lomo('l4'));
  await page.mouse.click(l4.x, l4.y);
  await expect(sala.locator('.sl3-lib__nota')).toContainText('lo dejaste tú');
  await expect(sala.locator('.sl3-lib__nota').getByRole('button', { name: 'Retirar mi lomo' })).toBeVisible();
  await sala.locator('.sl3-lib').getByRole('button', { name: 'Volver' }).click();
  await settled(page);

  // El reloj de pie y el sofá para dos (pronto)
  await ir('El reloj');
  await expect(sala.locator('.sl3-aviso')).toContainText('quedan');
  await settled(page);
  await page.waitForTimeout(300);
  await shot(page, info, '05-reloj');
  await ir(/Sofá para dos/);
  await expect(sala.locator('.sl3-aviso')).toContainText('pronto');
  await settled(page);
  await page.waitForTimeout(300);
  await shot(page, info, '06-sofa');

  // Desde el ventanal, mirando a la entrada (la librería común, la chimenea y la galería)
  await page.evaluate(() => window.__sala3d.place(7, 5.0, 0));
  await page.waitForTimeout(300);
  await shot(page, info, '07-hacia-la-entrada');
  // Tocar el suelo lleva hasta allí
  await page.evaluate(() => window.__sala3d.place(4.2, 13.4, Math.PI)); // al pie del pasillo de la izquierda, mirando al ventanal
  await settled(page);
  const box = await sala.locator('.sl3-canvas').boundingBox();
  const p = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.85 };
  const suelo = await page.evaluate(({ x, y }) => window.__sala3d.sueloEn(x, y), p);
  expect(suelo).not.toBeNull();
  await page.mouse.click(p.x, p.y);
  await settled(page);
  const pose = await page.evaluate(() => window.__sala3d.pose());
  expect(Math.hypot(pose.x - 4.2, pose.y - 13.4)).toBeGreaterThan(0.2);
  expect(errors).toEqual([]);
});

test('al volver con la sesión en marcha, la sala te sienta en tu sillón', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'una vez basta');
  await page.addInitScript(() => localStorage.setItem('bookshelf:sala-sillon:11111111-1111-4111-8111-111111111111', '4'));
  const { sala } = await aLaSala(page);
  await sala.getByRole('button', { name: 'Plano' }).click();
  await sala.getByRole('navigation', { name: 'Plano de la sala' }).getByRole('button', { name: 'Tu sillón' }).click();
  await page.waitForFunction(() => window.__sala3d.sentadoEn() === 4 && window.__sala3d.settled());
  await sala.locator('.sl3-sit').getByRole('button', { name: 'Sentarme a leer' }).click();
  await expect(sala.locator('.sl3-sit').getByRole('button', { name: 'Pausar' })).toBeVisible();
  // Se sale a la plaza y se vuelve: la sesión sigue y la cámara vuelve a tu sillón
  await page.keyboard.press('Escape');
  const hotel = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' });
  await hotel.getByRole('button', { name: 'Directorio' }).click({ timeout: 15000 });
  await hotel.getByRole('button', { name: /Café-biblioteca/ }).click();
  await expect(sala).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
  await page.waitForFunction(() => window.__sala3d?.sentadoEn() === 4 && window.__sala3d.settled());
  await expect(sala.locator('.sl3-sit').getByRole('button', { name: 'Pausar' })).toBeVisible();
  await shot(page, info, '08-de-vuelta');
});

test('sin WebGL, la sala de siempre', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'una vez basta');
  const { sala } = await aLaSala(page, { sinWebgl: true });
  await expect(sala.locator('.gh-casino__art')).toBeVisible({ timeout: 15000 });
  await expect(sala.locator('.sl3')).toHaveCount(0);
  await expect(sala.getByRole('button', { name: 'Sentarte a leer' })).toBeVisible();
});

test('vídeo del recorrido (SALA_VIDEO=1)', async ({ browser }, info) => {
  test.skip(!process.env.SALA_VIDEO || !/chromium-390x844$|webkit-390x844$/.test(info.project.name), 'solo para grabar');
  test.setTimeout(120000);
  const context = await browser.newContext({ ...info.project.use, baseURL: info.project.use.baseURL, recordVideo: { dir: join(DIR, 'bruto'), size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const { sala } = await aLaSala(page, { reduced: false, saludo: true });
  const tag = (name) => sala.locator('.sl3-tag', { hasText: name });
  await page.waitForTimeout(2500);
  await tag('Un sillón libre').click();
  await page.waitForFunction(() => window.__sala3d.sentadoEn() === 1 && window.__sala3d.settled());
  await page.waitForTimeout(600);
  await sala.locator('.sl3-sit').getByRole('button', { name: 'Sentarme a leer' }).click();
  await page.waitForTimeout(4000);
  await sala.locator('.sl3-sit').getByRole('button', { name: 'Levantarte del sillón' }).click();
  await settled(page);
  await page.waitForTimeout(1500);
  await sala.getByRole('button', { name: 'Plano' }).click();
  await sala.getByRole('navigation', { name: 'Plano de la sala' }).getByRole('button', { name: 'La librería de la sala' }).click();
  await page.waitForFunction(() => window.__sala3d.enLibreria() && window.__sala3d.settled());
  const l1 = await page.evaluate(() => window.__sala3d.lomo('l1'));
  await page.waitForTimeout(800);
  await page.mouse.click(l1.x, l1.y);
  await page.waitForTimeout(2000);
  await sala.locator('.sl3-lib').getByRole('button', { name: 'Volver' }).click();
  await settled(page);
  await sala.getByRole('button', { name: 'Plano' }).click();
  await sala.getByRole('navigation', { name: 'Plano de la sala' }).getByRole('button', { name: 'El reloj' }).click();
  await settled(page);
  await page.waitForTimeout(2500);
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join(DIR, `sala3d-${info.project.name}.webm`));
});
