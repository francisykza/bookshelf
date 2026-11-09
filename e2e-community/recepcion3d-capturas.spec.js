// Recepción del Gran Hotel en 3D · capturas comparables a 390 px (Supabase simulado; nunca una cuenta real).
// ETAPA=antes|bloque1|… elige la carpeta: qa-report/recepcion3d/<etapa>/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { abrirCasa } from './v190-apoyo';

const ETAPA = process.env.ETAPA || 'antes';
const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };

async function shot(page, name) {
  const dir = join('qa-report', 'recepcion3d', ETAPA);
  mkdirSync(dir, { recursive: true });
  await page.mouse.move(0, 0);
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

async function alHotel(page) {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Coger la limusina al Gran Hotel' }).click({ timeout: 15000 });
  const hotel = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' });
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible();
  return hotel;
}

test('la habitación en primera persona (referencia)', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'solo 390 px');
  await abrirCasa(page);
  await shot(page, '01-habitacion-3d');
});

test('la recepción en 3D: al entrar y girando a cada lado', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844' || ETAPA === 'antes', 'solo 390 px, desde el bloque 1');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/dev/recepcion3d.html');
  await page.waitForFunction(() => window.__recepcion3d?.renders() > 0);
  await page.waitForTimeout(300);
  await shot(page, '10-recepcion3d-entrada');
  const [lo, hi] = await page.evaluate(() => window.__recepcion3d.yawRange());
  for (const [name, yaw] of [
    ['11-recepcion3d-izquierda', hi],
    ['12-recepcion3d-derecha', lo],
  ]) {
    await page.evaluate((v) => window.__recepcion3d.setYaw(v), yaw);
    await page.waitForTimeout(250);
    await shot(page, name);
  }
  // De cerca: el conserje con el casillero detrás, y la huésped junto al ascensor
  for (const [name, eye, at] of [
    ['13-cerca-conserje', [3.6, 3.4, 2.1], [3.0, 0.4, 2.0]],
    ['14-cerca-casillero', [2.2, 2.6, 2.6], [2.9, 0, 2.5]],
    ['15-cerca-huesped', [6.7, 3.6, 1.9], [6.15, 1.4, 1.35]],
    ['16-ascensor-abierto', [7.9, 2.7, 1.95], [7.9, 0, 1.55]],
    ['17-cabina-banco', [7.9, -0.85, 1.7], [7.9, -3.4, 1.4]],
    ['18-cabina-botonera', [7.5, -1.18, 1.6], [8.95, -1.18, 1.56]],
  ]) {
    await page.evaluate((v) => window.__recepcion3d.doors(v), name.startsWith('1') && Number(name.slice(0, 2)) >= 16 ? 1 : 0);
    await page.evaluate(([e, a]) => window.__recepcion3d.view(e, a), [eye, at]);
    await page.waitForTimeout(250);
    await shot(page, name);
  }
  await page.evaluate(() => window.__recepcion3d.view(null));
  expect(errors).toEqual([]);
});

test('vídeo: mirar alrededor arrastrando el dedo', async ({ browser }, info) => {
  test.skip(info.project.name !== 'chromium-390x844' || ETAPA === 'antes', 'solo 390 px, desde el bloque 1');
  const dir = join('qa-report', 'recepcion3d', ETAPA, 'video');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, recordVideo: { dir, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  await page.goto('/dev/recepcion3d.html');
  await page.waitForFunction(() => window.__recepcion3d?.renders() > 0);
  await page.waitForTimeout(1200);
  // Arrastrar a la derecha mira a la izquierda (el guardarropa), y al revés; con pasos cortos, como un dedo
  const drag = async (from, to) => {
    await page.mouse.move(from, 420);
    await page.mouse.down();
    for (let k = 1; k <= 30; k += 1) {
      await page.mouse.move(from + ((to - from) * k) / 30, 420);
      await page.waitForTimeout(40);
    }
    await page.mouse.up();
    await page.waitForTimeout(700);
  };
  await drag(60, 340);
  await drag(340, 40);
  await drag(40, 340);
  await drag(330, 200);
  await page.waitForTimeout(800);
  await context.close();
});

async function tocarVestibulo(page) {
  const at = await page.evaluate(() => {
    const v = window.__granHotel;
    const z = v.zones.find((x) => x.id === 'vestibulo');
    const r = v.canvas.getBoundingClientRect();
    return { x: r.left + z.center.x * r.width, y: r.top + z.center.y * r.height };
  });
  await page.mouse.click(at.x, at.y);
}

test('la fachada y el vestíbulo en plano isométrico', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'solo 390 px');
  if (ETAPA !== 'antes') await page.addInitScript(() => localStorage.setItem('bookshelf:vestibulo-vista', 'plano'));
  const hotel = await alHotel(page);
  await page.waitForTimeout(600);
  await shot(page, '02-fachada-hotel');
  await tocarVestibulo(page);
  const lobby = hotel.getByRole('region', { name: 'El vestíbulo' });
  await expect(lobby.locator('.gh-lobby__art')).toBeVisible();
  await page.waitForFunction(() => document.querySelector('.gh-lobby__art')?.complete);
  await shot(page, '03-vestibulo-isometrico');
  await lobby.getByRole('tab', { name: 'Recepción' }).click();
  await expect(lobby.locator('.gh-task').first()).toBeVisible();
  await shot(page, '04-recepcion-encargos');
  await lobby.getByRole('button', { name: 'Cerrar' }).click();
  await lobby.getByRole('tab', { name: 'Ascensor' }).click();
  await shot(page, '05-ascensor');
});

// Bloque 3: desde la fachada se entra en la recepción en 3D; tocar cada cosa acerca la vista y abre su papel
test('la recepción en 3D dentro de la app: tocar cada cosa', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844' || !/bloque[3-9]/.test(ETAPA), 'solo 390 px, desde el bloque 3');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const hotel = await alHotel(page);
  await tocarVestibulo(page);
  const rcp = hotel.locator('section.rcp');
  await expect(rcp).toHaveAttribute('data-ready', 'true');
  await page.waitForFunction(() => window.__recepcion3d?.renders() > 2);
  await page.waitForTimeout(300);
  await expect(rcp.locator('.rcp-tag:not([data-off="true"])')).not.toHaveCount(0);
  await shot(page, '20-app-entrada');
  const esperar = () => page.waitForFunction(() => window.__recepcion3d.settled());
  // Tocar al conserje en la escena (no el letrero): la vista se acerca y salen los encargos
  const p = await page.evaluate(() => window.__recepcion3d.spotOnScreen('recepcion'));
  await page.mouse.click(p.x, p.y);
  await esperar();
  await expect(rcp.locator('.rcp-card h4')).toHaveText('La recepción');
  await expect(rcp.locator('.gh-task')).toHaveCount(5);
  await shot(page, '21-app-recepcion');
  await rcp.getByRole('button', { name: 'Volver' }).click();
  await esperar();
  await expect(rcp.locator('.rcp-card')).toHaveCount(0);
  // El ascensor: se abren las puertas, se entra y la botonera son los botones de la placa de la cabina
  await rcp.locator('.rcp-bar').getByRole('button', { name: 'Ascensor' }).click();
  await esperar();
  await expect(rcp.locator('.rcp-cabina .gh-lift__btn')).toHaveCount(9);
  await expect(rcp.locator('.rcp-bar')).toBeHidden();
  await shot(page, '22-app-ascensor');
  await rcp.locator('.rcp-cabina').getByRole('button', { name: /mirador/ }).click();
  await expect(rcp.locator('.gh-lift__note h4')).toHaveText('El mirador de la corona');
  await shot(page, '22b-app-ascensor-planta');
  // Tocar la cabina no saca del ascensor; «Salir del ascensor» sí
  await page.mouse.click(40, 300);
  await expect(rcp.locator('.rcp-cabina')).toBeVisible();
  await rcp.getByRole('button', { name: 'Salir del ascensor' }).click();
  await esperar();
  await expect(rcp.locator('.rcp-cabina')).toHaveCount(0);
  await expect(rcp.locator('.rcp-bar')).toBeVisible();
  for (const [n, id, titulo] of [
    ['23-app-tablon', 'Tablón', 'El tablón «Busco quien lea…»'],
    ['24-app-guardarropa', 'Guardarropa', 'El guardarropa'],
  ]) {
    await rcp.locator('.rcp-bar').getByRole('button', { name: id }).click();
    await esperar();
    await expect(rcp.locator('.rcp-card h4')).toHaveText(titulo);
    await shot(page, n);
    await page.keyboard.press('Escape');
    await esperar();
    await expect(rcp.locator('.rcp-card')).toHaveCount(0);
  }
  // «Plano» cambia a la vista isométrica y «Entrar en la recepción» vuelve al 3D
  await rcp.getByRole('button', { name: 'Plano' }).click();
  const lobby = hotel.getByRole('region', { name: 'El vestíbulo' });
  await expect(lobby.locator('.gh-lobby__art')).toBeVisible();
  await page.waitForFunction(() => document.querySelector('.gh-lobby__art')?.complete);
  await shot(page, '25-app-plano');
  await lobby.getByRole('button', { name: 'Entrar en la recepción' }).click();
  await expect(hotel.locator('section.rcp')).toHaveAttribute('data-ready', 'true');
  // Un Escape sin papel sale a la plaza
  await page.keyboard.press('Escape');
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

// Vídeo del recorrido del bloque 3, dentro de la app
test('vídeo: entrar y tocar la recepción y el ascensor', async ({ browser }, info) => {
  test.skip(info.project.name !== 'chromium-390x844' || !/bloque[3-9]/.test(ETAPA), 'solo 390 px, desde el bloque 3');
  const dir = join('qa-report', 'recepcion3d', ETAPA, 'video-app');
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir, size: { width: 390, height: 844 } },
  });
  const page = await context.newPage();
  const hotel = await alHotel(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(1500);
  await tocarVestibulo(page);
  const rcp = hotel.locator('section.rcp');
  await expect(rcp).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(1200);
  const esperar = async () => {
    await page.waitForFunction(() => window.__recepcion3d.settled());
    await page.waitForTimeout(1300);
  };
  const p = await page.evaluate(() => window.__recepcion3d.spotOnScreen('recepcion'));
  await page.mouse.click(p.x, p.y);
  await esperar();
  await rcp.locator('.rcp-card__body').evaluate((el) => el.scrollBy({ top: 200, behavior: 'smooth' }));
  await page.waitForTimeout(900);
  await rcp.getByRole('button', { name: 'Volver' }).click();
  await esperar();
  // El ascensor: se abren las puertas, se entra y se pulsa un botón de la placa
  await rcp.locator('.rcp-bar').getByRole('button', { name: 'Ascensor' }).click();
  await esperar();
  await rcp.locator('.rcp-cabina').getByRole('button', { name: /terraza/ }).click();
  await page.waitForTimeout(1600);
  await rcp.getByRole('button', { name: 'Salir del ascensor' }).click();
  await esperar();
  for (const id of ['Tablón', 'Guardarropa']) {
    await rcp.locator('.rcp-bar').getByRole('button', { name: id }).click();
    await esperar();
    await rcp.getByRole('button', { name: 'Volver' }).click();
    await esperar();
  }
  await rcp.getByRole('button', { name: 'Plano' }).click();
  await page.waitForTimeout(1500);
  await hotel.getByRole('button', { name: 'Entrar en la recepción' }).click();
  await page.waitForTimeout(1500);
  // Desde el bloque 4: subir al ascensor y bajar al casino con la «S»
  if (!/bloque3/.test(ETAPA)) {
    await expect(rcp).toHaveAttribute('data-ready', 'true');
    await page.waitForTimeout(800);
    await rcp.locator('.rcp-bar').getByRole('button', { name: 'Ascensor' }).click();
    await esperar();
    await rcp.locator('.rcp-cabina').getByRole('button', { name: /casino/ }).click();
    await expect(hotel.getByRole('region', { name: 'El casino del sótano' })).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2500);
  }
  await context.close();
});
