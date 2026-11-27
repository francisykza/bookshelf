// Libo, bloque 3 (docs/qa/libo.md §2.4): en tu piso de inicio reúne los avisos de otros sitios (el buzón, el almacén, el café)
// y te da una sugerencia al día. Su bocadillo asoma solo una vez al día, sin sonido; cada aviso lleva a su sitio y lo que
// contestas no se repite. Supabase simulado y datos sintéticos (ninguna cuenta real). Emulación: no equivale a un móvil real.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NEIGHBOURS } from '../src/features/edificio/demo.js';
import { createMockSupabase } from './mockSupabase';
import { simularCafe } from './cafeMock';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { dayKey } from '../src/domain/dates';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222' };
const DIR = join('qa-report', 'libo');
const HEROES = ['sillon-capa', 'estanteria-comics', 'foco-heroe', 'maniqui-capa', 'cartel-vinetas', 'neon-rayo'];
const DIA = 86400000;
const iso = (dias) => new Date(Date.now() - dias * DIA).toISOString();
const libro = (id, title, extra) => ({ id, title, author: 'Autoría de prueba', status: 'want', pageCount: 300, currentPage: 0, cover: '', addedAt: iso(60), quotes: [], review: '', rating: null, ...extra });
const biblioteca = (books, log = [], libo = undefined) => ({ version: 8, books, settings: { sound: false, sfx: false, onboardingDone: true, ...(libo ? { libo } : {}) }, progress: { readingLog: log, pomodoros: [], claimed: {} } });
const CON_TODO = biblioteca([
  libro('circe', 'Circe', { status: 'read', currentPage: 300, startedAt: iso(20), finishedAt: iso(2) }),
  libro('viento', 'El nombre del viento', { status: 'reading', currentPage: 120, startedAt: iso(40) }),
]);

test.use({ video: 'on' });

test.beforeEach(async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844)$|^webkit-390x844$/.test(info.project.name), 'móvil vertical');
  mkdirSync(join(DIR, info.project.name), { recursive: true });
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});

/**
 * El piso de Ana. `datos`: su biblioteca; `avisos`: con un regalo de Bruno sin leer, la mesa que sigue rebajada y su café con
 * clientes y la hucha (apuntado ayer). Lo de este aparato se siembra una sola vez (al recargar se conserva lo que haya cambiado).
 */
async function casa(page, { datos = CON_TODO, avisos = true, antes = null } = {}) {
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true }, { user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' }, { user_id: BRUNO.id, edificio: 'edificio-1', puerta: '1A' });
  const sala = NEIGHBOURS.find((n) => n.id === '1a').room();
  mock.db.pisos.push({ user_id: ANA.id, layout: sala }, { user_id: BRUNO.id, layout: sala });
  mock.db.piso_cuentas[ANA.id] = { inicio_elegido: true, tickets: 60, sin_raro: 0 };
  mock.db.libraries.push({ user_id: ANA.id, data: datos, updated_at: new Date().toISOString(), version: 5 });
  if (avisos) {
    mock.db.vecinosSocial = true;
    mock.db.piso_regalos = [{ de: BRUNO.id, para: ANA.id, mueble: 'sillon', creado: new Date().toISOString() }];
    mock.db.almacen = { ofertas: [{ id: 'mesa', pct: 20, tipo: 'dia' }], deseados: { [ANA.id]: ['mesa'] } };
  }
  await page.addInitScript(
    ([uid, d, heroes, conAvisos]) => {
      if (sessionStorage.getItem('libo-sembrado')) return;
      sessionStorage.setItem('libo-sembrado', '1');
      localStorage.setItem('bookshelf:v1', JSON.stringify(d));
      localStorage.setItem('bookshelf:almacen-visto', JSON.stringify({ nuevos: heroes }));
      const ayer = new Date(Date.now() - 86400000);
      const dia = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`;
      if (conAvisos) localStorage.setItem(`bookshelf:libo-cafe:${uid}`, JSON.stringify({ hoy: dia, pendientes: 0, hucha: 1, t: Date.now() - 30 * 3600000 }));
    },
    [ANA.id, datos, HEROES, avisos],
  );
  await mock.attach(page, ANA);
  // El simulador da el bocadillo de hoy por visto (para las demás pruebas); aquí vale lo que la app apuntó al irse
  await page.addInitScript(() => {
    const K = 'bookshelf:libo-asomo';
    const v = sessionStorage.getItem('asomo-real');
    if (v) localStorage.setItem(K, v);
    else localStorage.removeItem(K);
    addEventListener('pagehide', () => sessionStorage.setItem('asomo-real', localStorage.getItem(K) ?? ''));
  });
  if (antes) await antes(page);
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  return mock;
}
const shot = (page, info, name) => page.screenshot({ path: join(DIR, info.project.name, `${name}.png`) });
const libo = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1') ?? '{}').settings?.libo ?? null);
const bocadillo = (page) => page.locator('.libo-bocadillo');
const gato = (page) => page.locator('.libo-rincon__gato');
const filas = (page) => page.locator('.libo-hoy__fila[data-aviso]');

/** El bocadillo, dentro de la pantalla y con botones de 44 px; devuelve lo que dice cada aviso. */
async function medir(page) {
  return page.evaluate(() => {
    const b = document.querySelector('.libo-bocadillo');
    const r = b.getBoundingClientRect();
    return {
      dentro: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5,
      botones: [...b.querySelectorAll('button')].map((x) => x.getBoundingClientRect().height),
      // 1.158: las filas de «Lo de hoy» (su dato en corto) y, al pie, la sugerencia del día
      avisos: [...b.querySelectorAll('.libo-hoy__fila[data-aviso]')].map((li) => ({ id: li.dataset.aviso, texto: li.querySelector('strong').textContent })),
      sugerencia: b.querySelector('[data-sugerencia]')?.dataset.sugerencia ?? null,
    };
  });
}

test('Libo reúne los avisos en tu piso, asoma una vez al día y cada botón lleva a su sitio', async ({ page }, info) => {
  test.setTimeout(150000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  const mock = await casa(page);

  // 1 · Al llegar, el bocadillo asoma solo, con los tres avisos y la sugerencia del día
  await expect(page.locator('.libo-bocadillo[data-hub]')).toBeVisible({ timeout: 12000 });
  await expect(filas(page)).toHaveCount(3, { timeout: 8000 });
  await page.waitForTimeout(400);
  let m = await medir(page);
  expect(m.dentro).toBe(true);
  for (const h of m.botones) expect(h).toBeGreaterThanOrEqual(44);
  expect(m.avisos).toEqual([
    { id: 'correo', texto: 'Una carta en tu buzón' },
    { id: 'almacen', texto: 'Mesa, de oferta' },
    { id: 'cafe', texto: 'Clientes y propinas en tu café' },
  ]);
  expect(m.sugerencia).toBe('resena:circe');
  await expect(page.locator('[data-sugerencia="resena:circe"]')).toContainText('Terminaste Circe. ¿Le dejas una reseña?');
  await shot(page, info, 'b3-1-asoma');
  await expect.poll(async () => (await libo(page))?.dia ?? null).toMatchObject({ sugerencia: 'resena:circe', asomo: true });

  // 2 · Se cierra tocando fuera; queda el corazón junto a Libo, quieto
  await page.mouse.click(30, 120);
  await expect(bocadillo(page)).toHaveCount(0);
  await expect(page.locator('.libo-rincon__nota')).toBeVisible();
  await shot(page, info, 'b3-2-corazon');

  // 3 · Al volver hoy no asoma otra vez; tocándole, lo mismo
  await page.reload();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.libo-rincon__nota')).toBeVisible({ timeout: 12000 });
  await page.waitForTimeout(3500);
  await expect(bocadillo(page)).toHaveCount(0);
  await gato(page).click();
  await expect(filas(page)).toHaveCount(3, { timeout: 8000 });

  // 4 · «Ver el almacén»: la pantalla del almacén en el ordenador; al volver, ese aviso ya no está (la «!» del monitor tampoco)
  await page.locator('[data-aviso="almacen"] button').click();
  await expect(page.locator('section[aria-labelledby="pp-alm-ofertas"]')).toBeVisible({ timeout: 12000 });
  await shot(page, info, 'b3-3-almacen');
  await page.goBack();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await gato(page).click();
  await expect(filas(page)).toHaveCount(2, { timeout: 8000 });
  expect((await medir(page)).avisos.map((a) => a.id)).toEqual(['correo', 'cafe']);
  expect((await medir(page)).sugerencia).toBe('resena:circe');

  // 5 · «Escribir la reseña»: la hoja de la reseña de Circe; al volver, la sugerencia ya no está y hoy no llega otra
  await page.getByRole('button', { name: 'Escribir la reseña' }).click();
  await expect(page.locator('.review-sheet__title')).toHaveText('Circe', { timeout: 8000 });
  await shot(page, info, 'b3-4-resena');
  await page.goBack();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await gato(page).click();
  await expect(filas(page)).toHaveCount(2, { timeout: 8000 });
  await expect(page.locator('[data-sugerencia]')).toHaveCount(0);
  await expect.poll(async () => Object.keys((await libo(page))?.callados ?? {})).toEqual(['resena:circe']);
  await page.waitForTimeout(400);
  await shot(page, info, 'b3-5-quedan');

  // 6 · «Ir al buzón»: el portal del edificio, con el buzón
  await page.locator('[data-aviso="correo"] button').click();
  await expect(page.locator('.ed-facade')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.ed-mailbox')).toBeVisible({ timeout: 15000 });
  // El buzón cuenta la misma carta (el mismo texto que Libo) y, leída allí, Libo deja de avisar de ella
  await expect(page.locator('.ed-mailbox')).toHaveAttribute('aria-label', 'Tu buzón: una cosa nueva');
  await page.locator('.ed-mailbox').click();
  await expect(page.locator('#ed-mailnote')).toContainText('Bruno te regaló');
  await shot(page, info, 'b3-6-buzon');
  await page.goBack();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await gato(page).click();
  await expect(filas(page)).toHaveCount(1, { timeout: 8000 });
  expect((await medir(page)).avisos.map((a) => a.id)).toEqual(['cafe']);
  expect(mock.db.piso_regalos).toHaveLength(1);
  expect(errores).toEqual([]);
});

test('sin nada pendiente, no asoma y ofrece «¿Qué hago ahora?»', async ({ page }, info) => {
  test.setTimeout(120000);
  const hoy = new Date();
  const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const datos = biblioteca([libro('viento', 'El nombre del viento', { status: 'reading', currentPage: 120, startedAt: iso(5) })], [{ id: 's1', bookId: 'viento', date: fecha, pages: 20, kind: 'pages', at: new Date().toISOString() }]);
  await casa(page, { datos, avisos: false });

  // Nada que decir: no asoma y no hay corazón; tocándole, el saludo y «¿Qué hago ahora?»
  await page.waitForTimeout(4000);
  await expect(bocadillo(page)).toHaveCount(0);
  await expect(page.locator('.libo-rincon__nota')).toHaveCount(0);
  await gato(page).click();
  await expect(page.getByRole('button', { name: '¿Qué hago ahora?' })).toBeVisible();
  await shot(page, info, 'b3-6-nada');
  await page.getByRole('button', { name: '¿Qué hago ahora?' }).click();
  await expect(page.locator('[data-sugerencia="idea:registrar"]')).toContainText('El nombre del viento');
  const m = await medir(page);
  expect(m.dentro).toBe(true);
  for (const h of m.botones) expect(h).toBeGreaterThanOrEqual(44);
  await shot(page, info, 'b3-7-idea');
  await page.getByRole('button', { name: 'Apuntar mi lectura' }).click();
  await expect(page.getByRole('button', { name: 'Guardar lectura' })).toBeVisible({ timeout: 8000 });
  // Las ideas que pides no se apuntan como contestadas
  expect((await libo(page))?.callados ?? {}).toEqual({});
});

test('con «Solo cuando le llamo», Libo no asoma aunque tenga algo que decir', async ({ page }, info) => {
  test.setTimeout(90000);
  const datos = biblioteca(CON_TODO.books, [], { modo: 'llamar', vistos: ['hola', 'bienvenida', 'edificio', 'tu-piso', 'cafe', 'hotel', 'comunidad'] });
  await casa(page, { datos, avisos: false });
  await expect(page.locator('.libo-rincon__nota')).toBeVisible({ timeout: 12000 });
  await page.waitForTimeout(3500);
  await expect(bocadillo(page)).toHaveCount(0);
  await gato(page).click();
  await expect(page.locator('[data-sugerencia="resena:circe"]')).toBeVisible();
  // «Ahora no»: callada un mes, sin ir a ningún sitio
  await page.getByRole('button', { name: 'Ahora no' }).click();
  await expect(bocadillo(page)).toHaveCount(0);
  await expect.poll(async () => Object.keys((await libo(page))?.callados ?? {})).toEqual(['resena:circe']);
  await shot(page, info, 'b3-8-llamar');
});

test('el café apunta lo que queda hoy y, de vuelta en tu piso, Libo avisa de sus clientes', async ({ page }, info) => {
  test.setTimeout(150000);
  const hoy = dayKey();
  const datos = biblioteca([libro('viento', 'El nombre del viento', { status: 'reading', currentPage: 120, startedAt: iso(5) })], [{ id: 's1', bookId: 'viento', date: hoy, pages: 20, kind: 'pages', at: new Date().toISOString() }]);
  const cafe3 = { inaugurado: true, nombre: 'El Rincón', nivel: 1, granos: 12, plano: structuredClone(PLANO_INICIAL), inventario: cuenta(PLANO_INICIAL) };
  await casa(page, { datos, avisos: false, antes: (p) => simularCafe(p, cafe3, { clientes: { hoy, semillas: [11, 22, 33], quienes: [3], frases: [10] } }) });
  // Antes de entrar nunca en el café, Libo no sabe nada de él: no inventa clientes
  await page.waitForTimeout(3000);
  await expect(page.locator('.libo-rincon__nota')).toHaveCount(0);

  // Al café, por la puerta del edificio
  await page.getByRole('button', { name: 'Al edificio' }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' }).click({ timeout: 30000 });
  const cafe = page.getByRole('dialog', { name: 'El café-librería del bajo' });
  await expect(cafe.locator('.cf3[data-ready="true"]')).toBeVisible({ timeout: 30000 });
  const apuntado = () => page.evaluate((uid) => JSON.parse(localStorage.getItem('bookshelf:libo-cafe:' + uid) ?? 'null'), ANA.id);
  await expect.poll(async () => (await apuntado())?.pendientes ?? 0).toBeGreaterThan(0);
  expect((await apuntado()).hoy).toBe(hoy);

  // De vuelta en tu piso (Atrás dos veces: el café y el portal): hoy aún no había asomado, así que asoma con el café
  await page.goBack();
  await expect(portal.locator('.ed-facade')).toBeVisible({ timeout: 30000 });
  await page.goBack();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.libo-bocadillo[data-hub]')).toBeVisible({ timeout: 12000 });
  await expect(page.locator('[data-aviso="cafe"]')).toContainText('Clientes en tu café');
  await shot(page, info, 'b3-9-cafe');
  await page.locator('[data-aviso="cafe"] button').click();
  await expect(page.getByRole('dialog', { name: 'El café-librería del bajo' }).locator('.cf3[data-ready="true"]')).toBeVisible({ timeout: 30000 });
});
