// 1.124 · Los carteles de la fachada (maqueta de Francisco del 12-11-2026): placas de madera, esmalte y latón para las
// viviendas (libre, la tuya y la de un vecino con nombre largo), el rótulo colgante del café-librería con «Se traspasa» o
// con el nombre del café, y la placa azul del Gran Hotel. Comprueba el texto real, el nombre entero en la etiqueta
// accesible, los puntos suspensivos, el tamaño de letra, que no se pisan entre sí y que las acciones siguen igual.
// Capturas y vídeo en qa-report/placas/: la calle 3D (de noche) y la fachada 2D sin WebGL (al atardecer).
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';

const DIR = join('qa-report', 'placas');
const LARGO = 'Mercedes de los Ríos Villalobos';
const LUIS = { id: '00000000-0000-4000-8000-0000000000c1' };
const MERCE = { id: '00000000-0000-4000-8000-0000000000c2' };

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

async function abrirPortal(page, { cafe = null, sinWebgl = false } = {}) {
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 40 } } });
  mock.db.profiles.push(
    { user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true },
    { user_id: LUIS.id, alias: 'Luis', avatar_id: 'gato-lector', community_enabled: true },
    { user_id: MERCE.id, alias: LARGO, avatar_id: 'gato-lector', community_enabled: true },
  );
  mock.db.edificio_vecinos.push(
    { user_id: ANA.id, edificio: 'edificio-1', puerta: '1A' },
    { user_id: LUIS.id, edificio: 'edificio-1', puerta: '3B' },
    { user_id: MERCE.id, edificio: 'edificio-1', puerta: '2B' },
  );
  await mock.attach(page, ANA);
  await simularCafe(page, cafe);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  if (sinWebgl)
    await page.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
        return /webgl/.test(kind) ? null : get.call(this, kind, ...rest);
      };
    });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await expect(portal.getByRole('button', { name: 'Coger la limusina al Gran Hotel' })).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1800);
  return portal;
}

/** Medidas de los carteles a la vista: cajas, letra, si el texto se corta y si se pisan. */
const medir = (page) =>
  page.evaluate(() => {
    const shown = (el) => {
      const s = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      return s.visibility !== 'hidden' && Number(s.opacity) > 0.05 && b.width > 0 && !el.closest('.is-off');
    };
    const root = document.querySelector('.ed-facade');
    const box = root.getBoundingClientRect();
    const carteles = [...root.querySelectorAll('.ed-placa, .ed-cartel__tabla, .ed-cartel__aviso')].filter(shown);
    const rect = (el) => {
      const b = el.getBoundingClientRect();
      return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom };
    };
    const pisan = [];
    for (let i = 0; i < carteles.length; i += 1)
      for (let j = i + 1; j < carteles.length; j += 1) {
        if (carteles[i].contains(carteles[j]) || carteles[j].contains(carteles[i])) continue;
        const a = rect(carteles[i]);
        const b = rect(carteles[j]);
        if (a.x0 < b.x1 - 1 && b.x0 < a.x1 - 1 && a.y0 < b.y1 - 1 && b.y0 < a.y1 - 1) pisan.push([carteles[i].textContent, carteles[j].textContent]);
      }
    const txt = (el) => el.querySelector('.ed-placa__txt, .ed-cartel__txt') ?? el;
    return {
      carteles: carteles.map((el) => ({
        texto: el.textContent,
        letra: parseFloat(getComputedStyle(txt(el)).fontSize),
        cortado: txt(el).scrollWidth > txt(el).clientWidth + 1,
        fuera: (() => {
          const r = rect(el);
          return r.x0 < box.left - 1 || r.x1 > box.right + 1;
        })(),
      })),
      pisan,
      // Lo que se toca: el botón entero de cada sitio (balcón, escaparate, limusina)
      botones: [...root.querySelectorAll('button.ed-window')]
        .filter((el) => !el.classList.contains('is-off'))
        .map((el) => ({ nombre: el.getAttribute('aria-label'), alto: el.getBoundingClientRect().height })),
    };
  });

test('las placas en la calle 3D: libre, la tuya, un vecino con nombre largo, el café en traspaso y el hotel', async ({ page }, info) => {
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const portal = await abrirPortal(page);
  await expect(portal.locator('canvas.calle-canvas')).toBeVisible();
  // Que la vista haya terminado de llegar y las letras estén cargadas
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(DIR, `noche-calle3d-${info.project.name}.png`) });

  // Texto real, separado del marco
  const placa = (puerta) => portal.locator('.ed-window').filter({ has: page.locator('.ed-placa__num', { hasText: puerta }) });
  await expect(placa('1.º A').locator('.ed-placa--propia .ed-placa__txt')).toHaveText('Tu piso');
  await expect(placa('1.º A').locator('.ed-placa__icono--llave')).toHaveCount(1);
  await expect(placa('3.º A').locator('.ed-placa--libre .ed-placa__txt')).toHaveText('Libre');
  await expect(placa('3.º B').locator('.ed-placa--ajena .ed-placa__txt')).toHaveText('Luis');
  // El nombre largo, entero en el texto y en la etiqueta accesible (no «Libre» ni otro estado)
  await expect(placa('2.º B').locator('.ed-placa--ajena .ed-placa__txt')).toHaveText(LARGO);
  await expect(portal.getByRole('button', { name: `Llamar y entrar en el piso de ${LARGO}, 2.º B` })).toBeAttached();
  await expect(portal.locator('.ed-shop .ed-cartel__txt')).toHaveText('Café-librería');
  await expect(portal.locator('.ed-shop .ed-cartel__aviso')).toHaveText('Se traspasa');
  await expect(portal.locator('.ed-limo .ed-placa--hotel .ed-placa__txt')).toHaveText('Al Gran Hotel');

  const m = await medir(page);
  console.log(info.project.name, JSON.stringify(m.carteles.map((c) => [c.texto, c.letra, c.cortado])));
  expect(m.pisan).toEqual([]);
  for (const c of m.carteles) {
    expect(c.letra, c.texto).toBeGreaterThanOrEqual(12);
    expect(c.fuera, c.texto).toBe(false);
  }
  // Solo se corta un nombre largo, nunca el número ni lo corto
  for (const c of m.carteles.filter((x) => x.cortado)) expect(c.texto).toContain(LARGO);
  if (info.project.name.includes('390')) expect(m.carteles.find((c) => c.texto.includes('Tu piso')).letra).toBeGreaterThanOrEqual(13);
  for (const b of m.botones) expect(b.alto, b.nombre).toBeGreaterThanOrEqual(44);

  // Las acciones de siempre: tu piso, el café y el hotel
  await portal.getByRole('button', { name: /^Entrar en tu piso/ }).click();
  await expect(page.getByRole('dialog', { name: 'Tu piso' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Volver al portal' }).click();
  const limo = portal.getByRole('button', { name: 'Coger la limusina al Gran Hotel' });
  await expect(limo).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1200);
  await limo.click();
  await expect(page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' })).toBeVisible({ timeout: 15000 });
  expect(errors).toEqual([]);
});

test('el café inaugurado: el rótulo con su nombre y sin aviso', async ({ page }, info) => {
  test.skip(!info.project.name.includes('390'), 'a 390');
  test.setTimeout(90000);
  mkdirSync(DIR, { recursive: true });
  const portal = await abrirPortal(page, { cafe: { inaugurado: true, nombre: 'Taza y Lomo', inventario: cuenta(PLANO_INICIAL), plano: structuredClone(PLANO_INICIAL) } });
  const shop = portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' });
  await expect(shop.locator('.ed-cartel__txt')).toHaveText('Taza y Lomo', { timeout: 15000 });
  await expect(shop.locator('.ed-cartel__aviso')).toHaveCount(0);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(DIR, `noche-cafe-inaugurado-${info.project.name}.png`) });
  await shop.click();
  await expect(page.getByRole('dialog', { name: 'El café-librería del bajo' })).toBeVisible({ timeout: 15000 });
});

test('la fachada 2D sin WebGL, al atardecer: las mismas placas', async ({ page }, info) => {
  test.setTimeout(90000);
  mkdirSync(DIR, { recursive: true });
  const portal = await abrirPortal(page, { sinWebgl: true });
  await expect(portal.locator('canvas.calle-canvas')).toHaveCount(0);
  await expect(portal.locator('.ed-placa--propia .ed-placa__txt')).toHaveText('Tu piso');
  await expect(portal.locator('.ed-placa--ajena .ed-placa__txt', { hasText: LARGO })).toHaveCount(1);
  await expect(portal.locator('.ed-shop .ed-cartel__aviso')).toHaveText('Se traspasa');
  await page.screenshot({ path: join(DIR, `atardecer-fachada2d-${info.project.name}.png`) });
  const m = await medir(page);
  expect(m.pisan).toEqual([]);
  for (const c of m.carteles) expect(c.letra, c.texto).toBeGreaterThanOrEqual(12);
  // El café se abre igual
  await portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' }).click();
  await expect(page.getByRole('dialog', { name: 'El café-librería del bajo' })).toBeVisible({ timeout: 15000 });
});
