// Libo, bloque 4 (docs/qa/libo.md §3.5 y §3.7): estados vacíos con un siguiente paso y zonas táctiles de 44 px.
// - Sin libros, el botón grande de casa dice «Añade tu primer libro» y la biblioteca vacía enseña a Libo con «Añadir un libro» e
//   «Importar de Goodreads».
// - Los controles pequeños (la habitación ilustrada, las etiquetas y la franja del café) se tocan en 44 px aunque se vean igual.
// Supabase simulado y datos sintéticos (ninguna cuenta real). Emulación: no equivale a un móvil real. Capturas en qa-report/libo/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { simularCafe } from './cafeMock';
import { ANA } from './sobreShop';
import { NEIGHBOURS } from '../src/features/edificio/demo.js';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { dayKey } from '../src/domain/dates';

const DIR = join('qa-report', 'libo');
const VACIA = { version: 8, books: [], settings: { sound: false, sfx: false, onboardingDone: true }, progress: { readingLog: [], pomodoros: [], claimed: {} } };

test.use({ video: 'on' });

test.beforeEach(async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844)$|^webkit-390x844$/.test(info.project.name), 'móvil vertical');
  mkdirSync(join(DIR, info.project.name), { recursive: true });
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});
const shot = (page, info, name) => page.screenshot({ path: join(DIR, info.project.name, `${name}.png`) });

/** Lo que hay bajo el dedo `dy` px por encima (o por debajo) del borde del control: ¿sigue siendo el control? */
const tocaA = (page, selector, { dx = 0, dy = 0 } = {}) =>
  page.evaluate(
    ([sel, x, y]) => {
      const el = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length && e.getBoundingClientRect().width > 0);
      if (!el) return 'no está';
      const r = el.getBoundingClientRect();
      const px = r.left + r.width / 2 + x;
      const py = (y < 0 ? r.top : y > 0 ? r.bottom : r.top + r.height / 2) + y;
      const bajo = document.elementFromPoint(px, py);
      if (bajo && (bajo === el || el.contains(bajo))) return 'sí';
      // Encima de la placa está el propio mueble, que abre lo mismo (la estantería abre «Mi biblioteca»)
      const nombre = (bajo?.closest('[aria-label]')?.getAttribute('aria-label') ?? '').toLowerCase();
      return nombre && nombre.includes((el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase().replace(/›/g, '').trim()) ? 'sí' : `no (${bajo?.className || bajo?.tagName}: ${nombre})`;
    },
    [selector, dx, dy],
  );

test('biblioteca vacía: el primer paso es añadir un libro, con Libo', async ({ page }, info) => {
  test.setTimeout(90000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout: NEIGHBOURS.find((n) => n.id === '1a').room() });
  mock.db.piso_cuentas[ANA.id] = { inicio_elegido: true, tickets: 60, sin_raro: 0 };
  mock.db.libraries.push({ user_id: ANA.id, data: VACIA, updated_at: new Date().toISOString(), version: 5 });
  await page.addInitScript((d) => {
    if (sessionStorage.getItem('vacia')) return;
    sessionStorage.setItem('vacia', '1');
    localStorage.setItem('bookshelf:v1', JSON.stringify(d));
  }, VACIA);
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });

  // En casa: el botón grande dice qué hacer
  const primero = page.locator('.plab-primary');
  await expect(primero).toContainText('Añade tu primer libro');
  await expect(primero).toContainText('Por título, autor o ISBN');
  await page.waitForTimeout(500);
  await shot(page, info, 'vacia-1-casa');

  // La biblioteca vacía: Libo y los dos caminos
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('dialog', { name: 'Tu rincón' }).getByRole('button', { name: 'Mi biblioteca' }).click();
  const vacia = page.locator('.lit-vacia');
  await expect(vacia).toBeVisible();
  await expect(vacia).toContainText('Tu estantería espera su primera historia');
  await expect(vacia.getByRole('button', { name: 'Añadir un libro' })).toBeVisible();
  await expect(vacia.getByRole('button', { name: 'Importar de Goodreads' })).toBeVisible();
  for (const b of await vacia.getByRole('button').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.waitForTimeout(400);
  await shot(page, info, 'vacia-2-biblioteca');

  // «Añadir un libro» abre el buscador
  await vacia.getByRole('button', { name: 'Añadir un libro' }).click();
  await expect(page.getByRole('dialog', { name: 'Añadir un libro' }).getByRole('searchbox')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(400);
  await shot(page, info, 'vacia-3-anadir');
  expect(errores).toEqual([]);
});

test('zonas táctiles: lo pequeño se toca en 44 px', async ({ page }, info) => {
  test.setTimeout(120000);
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  await mock.attach(page, ANA);
  await simularCafe(
    page,
    { inaugurado: true, nombre: 'Taza y Lomo', nivel: 2, reputacion: 2400, granos: 300, plano: structuredClone(PLANO_INICIAL), inventario: cuenta(PLANO_INICIAL), libros: { bienvenida: true, libros: [] } },
    { clientes: { hoy: dayKey(), semillas: [2100, 1000, 8919], quienes: [3], frases: [10] }, pilar: { hucha: 1 } },
  );

  // La habitación ilustrada: la cuenta, «Guías» y el sol, 7 px por encima y por debajo (44 px en total)
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.waitForTimeout(900);
  // («Mi biblioteca» está sobre la propia estantería: un toque a su lado la acerca)
  for (const sel of ['.corner-account', '.guides-toggle']) {
    expect(await tocaA(page, sel, { dy: -6 }), `${sel} por encima`).toBe('sí');
    expect(await tocaA(page, sel, { dy: 6 }), `${sel} por debajo`).toBe('sí');
  }
  // El sol, 20 px a su izquierda (se dibuja de 30 px): dentro de sus 44
  expect(await tocaA(page, '.time-dial', { dx: -20 }), 'el sol').toBe('sí');
  // La cuenta mide 32 px de ancho: se toca en 44
  expect(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.corner-account'), '::before').width))).toBeGreaterThanOrEqual(44);

  // El café: la franja de Pilar y los botones del lado, de 44 px; las etiquetas de los clientes se tocan alrededor
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' }).click({ timeout: 15000 });
  const cafe = page.getByRole('dialog', { name: 'El café-librería del bajo' });
  await expect(cafe.locator('.cf3[data-ready="true"]')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__cafe3d?.settled() && window.__cafe3d.renders() > 0);
  for (const b of await cafe.locator('.cf3-pizarra-btn, .cf3-caja .cf3-btn').all()) {
    if (!(await b.isVisible())) continue;
    expect((await b.boundingBox()).height, await b.getAttribute('aria-label') ?? await b.textContent()).toBeGreaterThanOrEqual(44);
  }
  // Los letreros de quien espera: 44 px de alto (y de ancho, el de la «!» sola), aunque el dibujo siga siendo pequeño
  const letreros = cafe.locator('.cf3-tag--cliente:not([data-off="true"])');
  await expect(letreros.first()).toBeVisible();
  for (const l of await letreros.all()) {
    const caja = await l.boundingBox();
    expect(caja.height).toBeGreaterThanOrEqual(44);
    if (await l.evaluate((e) => e.classList.contains('cf3-tag--solo'))) expect(caja.width).toBeGreaterThanOrEqual(44);
  }
  // Sin recorte en el botón (el recorte de las esquinas también recortaría el toque): toda la caja de 44 px se toca
  expect(await letreros.first().evaluate((e) => getComputedStyle(e).clipPath)).toBe('none');
  await page.waitForTimeout(300);
  await shot(page, info, 'toques-cafe');
});
