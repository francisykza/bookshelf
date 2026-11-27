// 1.142 (SPEC §142; Francisco, 16-11-2026: «añadirle tareas a pilar a cambio de monedas»; «Mejoras para siempre»):
// - El cuaderno de Pilar, desde el HUD: colocar la caja, la hucha de propinas y la pizarra de la acera, con sus grados y precios.
// - La hucha se recoge al entrar (Pilar lo cuenta) y «Colocar la caja» sube lo del reparto a la balda.
// - Sin la migración, ni rastro del cuaderno.
// Capturas y vídeo en qa-report/cafe-cuaderno/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { PLANO_INICIAL, asientosDe, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { clientesDelNivel } from '../src/features/edificio/cafe/cafeClientes';
import { CATALOGO_LIBROS } from '../src/features/edificio/cafe/cafeCatalogoLibros';
import { dayKey } from '../src/domain/dates';
import { alEdificio } from './entrada';

const DIR = join('qa-report', 'cafe-cuaderno');
const tam = (info) => info.project.name.replace(/^(chromium|webkit)-/, '$1-');
const HOY = dayKey();
const DE_EJEMPLO = ['alas-sangre', 'mistborn'].map((id) => ({ id, title: id, author: '', status: 'want', pageCount: 300, cover: '', categories: [], quotes: [], addedAt: '2026-10-01T10:00:00.000Z' }));
const delCatalogo = (genero, n, balda = 1, caja = 0) =>
  CATALOGO_LIBROS.filter((c) => c.genero === genero)
    .slice(0, n)
    .map((c) => ({ clave: c.clave, titulo: c.titulo, genero, balda, caja }));

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

async function alCafe(page, { nivel = 3, granos = 600, pilar = null, libros = delCatalogo('novela', 4), reparto = false }) {
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 120, sin_raro: 3 } },
    piso_inventario: { [ANA.id]: { sillon: 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.libraries.push({ user_id: ANA.id, data: { books: DE_EJEMPLO }, updated_at: new Date().toISOString(), version: 5 });
  await page.addInitScript((b) => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!localStorage.getItem('bookshelf:v1')) localStorage.setItem('bookshelf:v1', JSON.stringify({ books: b, progress: { readingLog: [], pomodoros: [], claimed: {} } }));
  }, DE_EJEMPLO);
  await mock.attach(page, ANA);
  const estado = await simularCafe(
    page,
    { inaugurado: true, nombre: 'Taza y Lomo', nivel, reputacion: 2400, granos, plano: structuredClone(PLANO_INICIAL), inventario: cuenta(PLANO_INICIAL), libros: { bienvenida: true, libros } },
    { clientes: { hoy: HOY, semillas: [2100, 1000, 8919], quienes: [3], frases: [10], reparto }, pilar },
  );
  await page.goto('/');
  await alEdificio(page);
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' }).click({ timeout: 15000 });
  const cafe = page.getByRole('dialog', { name: 'El café-librería del bajo' });
  await expect(cafe.locator('.cf3[data-ready="true"]')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__cafe3d?.settled() && window.__cafe3d.renders() > 0);
  return { cafe, estado };
}

test('el cuaderno de Pilar: la hucha al entrar, encargar y mejorar, y lo que aún no se abre', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/.test(info.project.name), '360, 390, 430, escritorio y WebKit 390');
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Nivel 2: la hucha ya encargada (con 9 granos guardados), la caja sin encargar y la pizarra aún cerrada; 6 libros esperando
  const { cafe, estado } = await alCafe(page, { nivel: 2, granos: 300, pilar: { hucha: 1, guardado: 9 }, libros: [...delCatalogo('novela', 3), ...delCatalogo('misterio', 3, 0, 2)] });

  // La hucha, recogida al entrar
  await expect(cafe.locator('.cf3-dice')).toContainText('He vaciado la hucha de propinas mientras no estabas: 9 granos para ti.', { timeout: 10000 });
  await expect(cafe.locator('.cf3-monedero')).toHaveAttribute('aria-label', 'Granos: 309');
  expect(estado.llamadas.filter((l) => l.rpc === 'cafe_hucha')).toHaveLength(1);

  // El cuaderno
  await cafe.getByRole('button', { name: 'El cuaderno de Pilar: tareas a cambio de granos' }).click();
  const cuaderno = cafe.getByRole('region', { name: 'El cuaderno de Pilar' });
  await expect(cuaderno).toBeVisible();
  const tarea = (id) => cuaderno.locator(`.cf3-cuaderno__tarea[data-tarea="${id}"]`);
  await expect(tarea('hucha')).toHaveAttribute('data-grado', '1');
  await expect(tarea('hucha')).toContainText('Ahora: 8 granos al día. Siguiente: 15 granos al día.');
  await expect(tarea('hucha')).toContainText('Se paga sola en 36 días');
  await expect(cuaderno.locator('.cf3-cuaderno__marcador')).toHaveAttribute('aria-label', 'Llevas 1 de 8 encargos');
  await expect(tarea('hucha').getByRole('button')).toHaveAccessibleName('Mejorar la hucha de propinas por 250 granos');
  await expect(tarea('pizarra').getByRole('button')).toHaveAccessibleName('La pizarra de la acera: se abre en el nivel 3');
  await expect(tarea('pizarra').getByRole('button')).toBeDisabled();
  await page.screenshot({ path: join(DIR, `1-cuaderno-${tam(info)}.png`) });

  // Encargar «Colocar la caja»: 60 granos y los 6 de la caja, a la balda
  await tarea('caja').getByRole('button', { name: 'Encargar colocar la caja por 60 granos' }).click();
  await expect(tarea('caja')).toHaveAttribute('data-grado', '1');
  await expect(tarea('caja')).toContainText('«¡Apuntado! Me pongo con ello.»');
  await expect(tarea('caja').locator('.cf3-cuaderno__dado')).toHaveText('Te ha dado 6 libros colocados');
  // El grado siguiente («pide 3 libros más»), a la vista y desde el nivel 4
  await expect(tarea('caja').getByRole('button')).toHaveAccessibleName('Colocar la caja: el siguiente grado se abre en el nivel 4');
  await expect(cuaderno.locator('.cf3-cuaderno__marcador')).toHaveAttribute('aria-label', 'Llevas 2 de 8 encargos');
  await expect(cafe.locator('.cf3-monedero')).toHaveAttribute('aria-label', 'Granos: 249');
  expect(Object.values(estado.lib.libros).reduce((n, b) => n + b.caja, 0)).toBe(0);
  await expect(cafe.getByRole('button', { name: /^Tus libros: 9 en la balda$/ })).toBeVisible();
  // La hucha, al grado 2 no llega (249 < 250): el precio en rojo y el botón apagado
  await expect(tarea('hucha').getByRole('button')).toHaveAccessibleName('Mejorar la hucha de propinas por 250 granos (no tienes bastantes)');
  await expect(tarea('hucha').getByRole('button')).toBeDisabled();
  await page.screenshot({ path: join(DIR, `2-encargado-${tam(info)}.png`) });

  // Cerrar y volver a abrir: sigue como estaba
  await cuaderno.getByRole('button', { name: 'Cerrar' }).click();
  await expect(cuaderno).toBeHidden();
  expect(errors).toEqual([]);
  const video = page.video();
  await page.close();
  if (video && /chromium-390x844/.test(info.project.name)) await video.saveAs(join(DIR, `cuaderno-${tam(info)}.webm`));
});

test('la pizarra: con el nivel 3, dos clientes más al día nuevo; y Pilar pide y coloca el reparto', async ({ page }, info) => {
  test.skip(!/chromium-(390x844|1440x900)$/.test(info.project.name), '390 y escritorio');
  test.setTimeout(90000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { cafe, estado } = await alCafe(page, { nivel: 3, granos: 600, pilar: { caja: 2, pizarra: 2 }, libros: [], reparto: true });
  // El reparto llega con 3 más que pidió Pilar (8 del nivel 3 y 3) y ya está en la balda
  await expect(cafe.locator('.cf3-dice')).toContainText('Ha pasado el reparto de la mañana: 11 libros', { timeout: 10000 });
  await expect(cafe.locator('.cf3-dice')).toContainText('3 los pedí yo a la distribuidora. Ya lo he colocado todo en la balda.');
  expect(Object.values(estado.lib.libros).reduce((n, b) => n + b.caja, 0)).toBe(0);
  expect(Object.values(estado.lib.libros).reduce((n, b) => n + b.balda, 0)).toBeGreaterThan(0);
  // Los del nivel 3 y 2 más por la pizarra
  expect(estado.dias[HOY].clientes).toBe(clientesDelNivel(3, asientosDe(PLANO_INICIAL)) + 2);
  await cafe.getByRole('button', { name: 'El cuaderno de Pilar: tareas a cambio de granos' }).click();
  const cuaderno = cafe.getByRole('region', { name: 'El cuaderno de Pilar' });
  await expect(cuaderno.locator('.cf3-cuaderno__tarea[data-tarea="pizarra"]')).toContainText('Ahora: 2 clientes más al día.');
  await expect(cuaderno.locator('.cf3-cuaderno__tarea[data-tarea="pizarra"]').getByRole('button')).toHaveAccessibleName('La pizarra de la acera: el siguiente grado se abre en el nivel 5');
  await expect(cuaderno.locator('.cf3-cuaderno__tarea[data-tarea="pizarra"] .cf3-cuaderno__dado')).toHaveText('Te ha dado 2 clientes más');
  await expect(cuaderno.locator('.cf3-cuaderno__tarea[data-tarea="caja"] .cf3-cuaderno__dado')).toHaveText('Te ha dado 11 libros colocados · 3 pedidos de más');
  await expect(cuaderno.locator('.cf3-cuaderno__tarea[data-tarea="caja"] .cf3-cuaderno__listo')).toHaveText('Hecho');
  await page.screenshot({ path: join(DIR, `3-pizarra-${tam(info)}.png`) });
  expect(errors).toEqual([]);
});

test('todo encargado: el cuaderno completo', async ({ page }, info) => {
  test.skip(!/chromium-(390x844|1440x900)$/.test(info.project.name), '390 y escritorio');
  test.setTimeout(90000);
  mkdirSync(DIR, { recursive: true });
  const { cafe } = await alCafe(page, { nivel: 5, granos: 900, pilar: { caja: 2, hucha: 3, pizarra: 3, dado: { hucha: 640, colocados: 212, clientes: 57, pedidos: 30 } } });
  await cafe.getByRole('button', { name: 'El cuaderno de Pilar: tareas a cambio de granos' }).click();
  const cuaderno = cafe.getByRole('region', { name: 'El cuaderno de Pilar' });
  await expect(cuaderno.locator('.cf3-cuaderno__marcador')).toHaveAttribute('aria-label', 'Llevas 8 de 8 encargos');
  await expect(cuaderno.locator('.cf3-cuaderno__listo')).toHaveCount(3);
  await expect(cuaderno).toContainText('«Lo tengo todo apuntado. Este café va solo… casi.»');
  await expect(cuaderno.locator('.cf3-cuaderno__tarea[data-tarea="hucha"] .cf3-cuaderno__dado')).toHaveText('Te ha dado 640 granos de propinas');
  await page.screenshot({ path: join(DIR, `4-completo-${tam(info)}.png`) });
});

test('sin la migración: ni cuaderno ni hucha', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'solo 390');
  test.setTimeout(90000);
  const { cafe, estado } = await alCafe(page, {});
  await expect(cafe.getByRole('button', { name: 'Los cafés del barrio: ranking y visitas' })).toBeVisible();
  await expect(cafe.getByRole('button', { name: 'El cuaderno de Pilar: tareas a cambio de granos' })).toHaveCount(0);
  expect(estado.llamadas.some((l) => l.rpc === 'cafe_hucha')).toBe(false);
});
