// 1.86 · La estiba, con Supabase simulado: se encajan los bultos arrastrando y tocando, se ve lo que da cada nivel, se zarpa una vez
// y la pared de premios está siempre a la vista. Capturas en qa-report/screenshots-community/<proyecto>/v186-estiba-*.png. Las
// reglas de verdad, en src/features/edificio/__tests__/estiba.rls.test.js.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

// Una bodega fija: cada letra es un bulto y # lo que no se puede ocupar
const PLANO = ['AAB#CCDD', 'AEB#CFFD', 'EEBGGGFH', '#IIJJKH#', '##IJKK##'];
const HOY = new Date().toISOString().slice(0, 10);

function bodegaDePrueba() {
  const grupos = new Map();
  const bloqueadas = [];
  PLANO.forEach((fila, y) =>
    [...fila].forEach((ch, x) => {
      if (ch === '#') bloqueadas.push([x, y]);
      else grupos.set(ch, [...(grupos.get(ch) ?? []), [x, y]]);
    }),
  );
  const piezas = [];
  const solucion = [];
  [...grupos.values()].forEach((celdas, k) => {
    const ax = Math.min(...celdas.map((c) => c[0]));
    const ay = Math.min(...celdas.map((c) => c[1]));
    piezas.push({ id: k + 1, celdas: celdas.map(([x, y]) => [x - ax, y - ay]) });
    solucion.push({ pieza: k + 1, x: ax, y: ay, rot: 0 });
  });
  const total = piezas.reduce((n, p) => n + p.celdas.length, 0);
  return {
    solucion,
    estiba: {
      w: 8,
      h: 5,
      total,
      bloqueadas,
      piezas,
      dia: HOY,
      hecha: null,
      niveles: [
        { id: 'media', nombre: 'Media bodega', desde: 50, sellos: 2 },
        { id: 'llena', nombre: 'Bodega llena', desde: 80, sellos: 4 },
        { id: 'perfecta', nombre: 'Carga perfecta', desde: 100, sellos: 7 },
      ],
      pared: [
        { id: 'complemento:gorro-estibador', tipo: 'prenda', precio: 24, tienes: false },
        { id: 'pantalon:10', tipo: 'prenda', precio: 28, tienes: false },
        { id: 'jersey:17', tipo: 'prenda', precio: 36, tienes: true },
        { id: 'gaviota-puerto', tipo: 'companero', precio: 120, tienes: false },
      ],
      acabados: { salitre: 40, 'sol-de-tarde': 50, lacado: 70, nacar: 100 },
    },
  };
}

async function entrar(page, movimiento = true) {
  const { estiba, solucion } = bodegaDePrueba();
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.lonja = {
    tickets: 40,
    sellos: 60,
    cambios: { hechos: 0, tope: 3 },
    cobro: { hecho: 0, tope: 100 },
    topeOfertas: 3,
    horquilla: { comun: [5, 20], 'poco-comun': [10, 40], raro: [20, 60] },
    libres: { sofa: 2, silla: 1 },
    libresAcabado: [],
    toldos: [],
    mias: [],
    cerradas: [],
    puestos: [],
    estiba,
  };
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await portal.getByRole('button', { name: 'Coger la limusina al Gran Hotel' }).click({ timeout: 15000 });
  const hotel = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' });
  await expect(hotel.locator('canvas.hotel-canvas')).toBeVisible();
  await hotel.getByRole('button', { name: 'Directorio' }).click();
  await hotel
    .getByRole('dialog', { name: 'Directorio' })
    .getByRole('button', { name: /La Lonja/ })
    .click();
  const lonja = hotel.getByRole('region', { name: 'La Lonja' });
  await page.emulateMedia({ reducedMotion: movimiento ? 'no-preference' : 'reduce' });
  await lonja.getByRole('button', { name: /^La estiba/ }).click();
  const lienzo = lonja.locator('.lj-barco canvas');
  await expect(lienzo).toBeVisible();
  await page.waitForTimeout(300);
  return { mock, lonja, lienzo, solucion, estiba };
}

/** El centro de un hueco de la bodega, en la pantalla. */
async function puntoDe(lienzo, x, y) {
  const r = await lienzo.boundingBox();
  const k = r.width / 216;
  return [r.x + (12 + x * 24 + 12) * k, r.y + (52 + y * 24 + 12) * k];
}

test('se ve qué hacer y qué se gana, y la pared no está plegada', async ({ page }, info) => {
  const { lonja } = await entrar(page);
  await expect(lonja.locator('.lj-dice')).toContainText('bultos en el muelle');
  await expect(lonja.locator('.lj-carga__niveles li')).toHaveCount(3);
  await expect(lonja.locator('.lj-carga__niveles')).toContainText('7 sellos');
  await expect(lonja.locator('.lj-bulto')).toHaveCount(11);
  await expect(lonja.getByRole('button', { name: /^Zarpar/ })).toBeDisabled();
  await shot(page, info, 'v186-estiba-inicio');
  const pared = lonja.locator('.lj-pared');
  await expect(pared.getByRole('heading', { name: 'Gaviota del puerto' })).toBeVisible();
  await expect(pared.getByText('Gorro de estibador')).toBeVisible();
  await expect(pared.locator('.lj-etiqueta.is-acabado')).toHaveCount(4);
  await expect(lonja.locator('.lj-pared details')).toHaveCount(0);
  await pared.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await shot(page, info, 'v186-estiba-pared');
});

test('tocar un bulto y un sitio lo coloca; donde no cabe, se dice; tocarlo otra vez lo levanta', async ({ page }, info) => {
  const { lonja, lienzo } = await entrar(page);
  await lonja.locator('.lj-bulto').first().click();
  await expect(lonja.getByRole('button', { name: 'Girar' })).toBeVisible();
  const [bx, by] = await puntoDe(lienzo, 0, 4);
  await page.mouse.click(bx, by);
  await expect(lonja.locator('.lj-nota')).toContainText('no cabe');
  await page.waitForTimeout(150);
  await shot(page, info, 'v186-estiba-no-cabe');
  const [x, y] = await puntoDe(lienzo, 0, 0);
  await page.mouse.click(x, y);
  await expect(lonja.locator('.lj-bulto')).toHaveCount(10);
  await expect(lonja.getByRole('button', { name: /^Zarpar · 1 sello/ })).toBeEnabled();
  await page.mouse.click(x, y);
  await expect(lonja.getByRole('button', { name: 'Al muelle' })).toBeVisible();
  await lonja.getByRole('button', { name: 'Al muelle' }).click();
  await expect(lonja.locator('.lj-bulto')).toHaveCount(11);
});

test('arrastrar del muelle a la bodega también vale, y la carga dura al salir', async ({ page }) => {
  const { lonja, lienzo } = await entrar(page);
  const caja = await lonja.locator('.lj-bulto').first().boundingBox();
  const [x, y] = await puntoDe(lienzo, 0, 0);
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.mouse.down();
  await page.mouse.move(x + 5, y + 5, { steps: 6 });
  await page.mouse.up();
  await expect(lonja.locator('.lj-bulto')).toHaveCount(10);
  await lonja.getByRole('button', { name: 'Los puestos' }).click();
  await lonja.getByRole('button', { name: /^La estiba/ }).click();
  await expect(lonja.locator('.lj-bulto')).toHaveCount(10);
});

test('con teclado: se elige, se mueve, se gira y se suelta', async ({ page }) => {
  const { lonja } = await entrar(page);
  await lonja.locator('.lj-bulto').first().focus();
  await page.keyboard.press('Enter');
  await expect(lonja.locator('.lj-barco canvas')).toBeFocused();
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(lonja.locator('.lj-bulto')).toHaveCount(10);
});

test('una carga perfecta zarpa sin preguntar, y el barco se va', async ({ page }, info) => {
  const { lonja, lienzo, mock, solucion } = await entrar(page);
  // Se cargan todos los bultos, tocando bulto y sitio
  for (const c of solucion) {
    await lonja.locator('.lj-bulto').first().click();
    const [x, y] = await puntoDe(lienzo, c.x, c.y);
    const ancla = mock.db.lonja.estiba.piezas.find((p) => p.id === c.pieza);
    const w = Math.max(...ancla.celdas.map((p) => p[0])) + 1;
    const h = Math.max(...ancla.celdas.map((p) => p[1])) + 1;
    const r = await lienzo.boundingBox();
    const k = (r.width / 216) * 24;
    await page.mouse.click(x + Math.floor((w - 1) / 2) * k, y + Math.floor((h - 1) / 2) * k);
  }
  await expect(lonja.getByRole('progressbar', { name: 'Carga de la bodega' })).toHaveAttribute('aria-valuenow', '32');
  await expect(lonja.locator('.lj-dice')).toContainText('Ni un hueco');
  await shot(page, info, 'v186-estiba-llena');
  await lonja.getByRole('button', { name: 'Zarpar · 7 sellos' }).click();
  await page.waitForTimeout(1200);
  await shot(page, info, 'v186-estiba-zarpando');
  await expect(lonja.locator('.lj-parte')).toContainText('Carga perfecta', { timeout: 6000 });
  await expect(lonja.locator('.lj-parte')).toContainText('+7 sellos');
  expect(mock.db.lonja.sellos).toBe(67);
  await shot(page, info, 'v186-estiba-parte');
  await expect(lonja.getByRole('button', { name: /^Zarpar/ })).toHaveCount(0);
  await expect(lonja.locator('.lj-pared')).toBeVisible();
});

test('con la bodega a medias pregunta antes de zarpar', async ({ page }) => {
  const { lonja, lienzo, mock } = await entrar(page);
  await lonja.locator('.lj-bulto').first().click();
  const [x, y] = await puntoDe(lienzo, 0, 0);
  await page.mouse.click(x, y);
  await lonja.getByRole('button', { name: /^Zarpar/ }).click();
  await expect(lonja.locator('.lj-seguro')).toContainText('poca carga');
  await expect(lonja.locator('.lj-seguro')).toContainText('una vez al día');
  await lonja.getByRole('button', { name: 'Seguir cargando' }).click();
  expect(mock.db.lonja.estiba.hecha).toBeNull();
});

test('la pared: ropa, gaviota y acabado sobre una copia lisa', async ({ page }, info) => {
  const { lonja, mock } = await entrar(page);
  const pared = lonja.locator('.lj-pared');
  await expect(pared.getByText('Ya es tuyo')).toBeVisible();
  await expect(pared.getByRole('button', { name: /Gaviota del puerto: te faltan 60 sellos/ })).toBeDisabled();
  await pared.getByRole('button', { name: 'Cambiar 24 sellos por Gorro de estibador' }).click();
  await pared.getByRole('button', { name: 'Sí, cambiar' }).click();
  await expect(pared.locator('.lj-premio-nuevo')).toContainText('Gorro de estibador');
  await expect(pared.locator('.lj-premio-nuevo')).toContainText('armario');
  expect(mock.db.lonja.sellos).toBe(36);
  await pared.getByRole('button', { name: 'Vale' }).click();
  mock.db.lonja.sellos = 120;
  await lonja.getByRole('button', { name: 'Los puestos' }).click();
  await lonja.getByRole('button', { name: /^La estiba/ }).click();
  await pared.locator('.lj-etiqueta.is-acabado').filter({ hasText: 'Lacado' }).getByRole('button', { name: 'Elegir' }).click();
  await expect(pared.locator('.lj-copias')).toContainText('Sofá');
  await pared.locator('.lj-copias').scrollIntoViewIfNeeded();
  await shot(page, info, 'v186-estiba-acabado');
});

test('con movimiento reducido el parte sale directo', async ({ page }) => {
  const { lonja, lienzo } = await entrar(page, false);
  await lonja.locator('.lj-bulto').first().click();
  const [x, y] = await puntoDe(lienzo, 0, 0);
  await page.mouse.click(x, y);
  await lonja.getByRole('button', { name: /^Zarpar/ }).click();
  await lonja.getByRole('button', { name: 'Sí, zarpar' }).click();
  await expect(lonja.locator('.lj-parte')).toContainText('+1 sello', { timeout: 1500 });
});
