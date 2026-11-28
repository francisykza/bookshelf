// 1.158 · «Lo de hoy», la tarjeta de Libo en tu piso (docs/qa/libo-lo-de-hoy.md): al abrirla pregunta al servidor por el
// casino, la ruleta y las misiones del día, y lo junta con los avisos de otros sitios; cada fila lleva a su sitio y lo hecho
// pasa al final, en verde. Supabase simulado y datos sintéticos (ninguna cuenta real). Emulación: no equivale a un móvil real.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NEIGHBOURS } from '../src/features/edificio/demo.js';
import { createMockSupabase } from './mockSupabase';
import { missionsOf, todayKey } from '../src/features/edificio/dailyMissions';

const ANA = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'ana@ejemplo.test',
};
const BRUNO = { id: '22222222-2222-4222-8222-222222222222' };
const DIR = join('qa-report', 'v1158-lo-de-hoy');
const HEROES = ['sillon-capa', 'estanteria-comics', 'foco-heroe', 'maniqui-capa', 'cartel-vinetas', 'neon-rayo'];
const DIA = 86400000;
const iso = (dias) => new Date(Date.now() - dias * DIA).toISOString();
const libro = (id, title, extra) => ({
  id,
  title,
  author: 'Autoría de prueba',
  status: 'want',
  pageCount: 300,
  currentPage: 0,
  cover: '',
  addedAt: iso(60),
  quotes: [],
  review: '',
  rating: null,
  ...extra,
});
const VISTOS = ['hola', 'bienvenida', 'edificio', 'tu-piso', 'cafe', 'hotel', 'comunidad'];
const biblioteca = (books, log = [], libo = undefined) => ({
  version: 8,
  books,
  settings: {
    sound: false,
    sfx: false,
    onboardingDone: true,
    ...(libo ? { libo } : {}),
  },
  progress: { readingLog: log, pomodoros: [], claimed: {} },
});

test.use({ video: 'on' });

test.beforeEach(async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844)$|^webkit-390x844$/.test(info.project.name), 'móvil vertical');
  mkdirSync(join(DIR, info.project.name), { recursive: true });
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});

/** El piso de Ana, con el casino, la ruleta y las misiones en el servidor simulado. `todoHecho`: las tres manos jugadas y las tres misiones hechas. */
async function casa(page, { datos, avisos = false, todoHecho = false }) {
  const hoy = todayKey();
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push(
    {
      user_id: ANA.id,
      alias: 'Ana lectora',
      avatar_id: 'gato-lector',
      community_enabled: true,
    },
    {
      user_id: BRUNO.id,
      alias: 'Bruno',
      avatar_id: 'gato-lector',
      community_enabled: true,
    },
  );
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' }, { user_id: BRUNO.id, edificio: 'edificio-1', puerta: '1A' });
  const sala = NEIGHBOURS.find((n) => n.id === '1a').room();
  mock.db.pisos.push({ user_id: ANA.id, layout: sala }, { user_id: BRUNO.id, layout: sala });
  mock.db.piso_cuentas[ANA.id] = {
    inicio_elegido: true,
    tickets: 60,
    sin_raro: 0,
  };
  mock.db.libraries.push({
    user_id: ANA.id,
    data: datos,
    updated_at: new Date().toISOString(),
    version: 5,
  });
  mock.db.personajes = true;
  mock.db.casino = todoHecho
    ? {
        fichas: 30,
        semana: 30,
        manos: [1, 2, 3].map((mano) => ({
          dia: hoy,
          mano,
          tuyas: [9, 8],
          crupier: [10, 7],
          mazo: [],
          estado: 'ganada',
          fichas: 10,
        })),
      }
    : { fichas: 30, semana: 30, ruleta: {} };
  mock.db.diarias = {
    [ANA.id]: {
      prendas: [],
      dias: todoHecho ? { [hoy]: missionsOf(hoy).map((m) => m.id) } : {},
    },
  };
  if (avisos) {
    mock.db.vecinosSocial = true;
    mock.db.piso_regalos = [
      {
        de: BRUNO.id,
        para: ANA.id,
        mueble: 'sillon',
        creado: new Date().toISOString(),
      },
    ];
    mock.db.almacen = {
      ofertas: [{ id: 'mesa', pct: 20, tipo: 'dia' }],
      deseados: { [ANA.id]: ['mesa'] },
    };
  }
  await page.addInitScript(
    ([uid, d, heroes, conAvisos]) => {
      if (sessionStorage.getItem('libo-sembrado')) return;
      sessionStorage.setItem('libo-sembrado', '1');
      localStorage.setItem('bookshelf:v1', JSON.stringify(d));
      localStorage.setItem('bookshelf:almacen-visto', JSON.stringify({ nuevos: heroes }));
      const ayer = new Date(Date.now() - 86400000);
      const dia = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`;
      if (conAvisos)
        localStorage.setItem(
          `bookshelf:libo-cafe:${uid}`,
          JSON.stringify({
            hoy: dia,
            pendientes: 0,
            hucha: 1,
            t: Date.now() - 30 * 3600000,
          }),
        );
    },
    [ANA.id, datos, HEROES, avisos],
  );
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({
    timeout: 30000,
  });
  return mock;
}

const shot = (page, info, name) => page.screenshot({ path: join(DIR, info.project.name, `${name}.png`) });
const tarjeta = (page) => page.getByRole('dialog', { name: 'Libo: lo de hoy' });
const gato = (page) => page.locator('.libo-rincon__gato');
const filas = (page) => page.locator('.libo-hoy__fila[data-aviso]').evaluateAll((ls) => ls.map((l) => l.dataset.aviso));

/** La tarjeta, dentro de la pantalla y con botones de 44 px; la letra de píxel cargada en los títulos. */
async function medir(page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const b = document.querySelector('.libo-bocadillo[data-hub]');
    const r = b.getBoundingClientRect();
    const titulo = b.querySelector('.libo-hoy__texto strong');
    return {
      dentro: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5,
      botones: [...b.querySelectorAll('button')].map((x) => x.getBoundingClientRect().height),
      pixel: titulo ? getComputedStyle(titulo).fontFamily.includes('PuertoPixel') && document.fonts.check('13px PuertoPixel') : null,
    };
  });
}

test('con cosas por hacer: los avisos, el casino, las misiones y la ruleta; cada fila lleva a su sitio', async ({ page }, info) => {
  test.setTimeout(180000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  const datos = biblioteca(
    [
      libro('circe', 'Circe', {
        status: 'read',
        currentPage: 300,
        startedAt: iso(20),
        finishedAt: iso(2),
      }),
      libro('viento', 'El nombre del viento', {
        status: 'reading',
        currentPage: 120,
        startedAt: iso(40),
      }),
    ],
    [],
    { vistos: VISTOS },
  );
  await casa(page, { datos, avisos: true });

  // 1 · Tocándole (el simulador da el asomo de hoy por visto): lo de otros sitios y, en cuanto responde el servidor, lo del día
  await expect(page.locator('.libo-rincon__nota')).toBeVisible({
    timeout: 12000,
  });
  await gato(page).click();
  await expect(tarjeta(page)).toBeVisible();
  await expect.poll(() => filas(page), { timeout: 10000 }).toEqual(['correo', 'almacen', 'cafe', 'casino', 'misiones']);
  await expect(tarjeta(page)).toContainText('Hoy tienes seis cosas por aquí. Ninguna corre prisa.');
  await expect(page.locator('[data-aviso="casino"]')).toContainText('Casino · te quedan 3 manos');
  await expect(page.locator('[data-aviso="misiones"] .libo-hoy__chip')).toHaveText('0/3');
  await expect(page.locator('[data-sugerencia="resena:circe"]')).toContainText('Terminaste Circe');
  await page.waitForTimeout(500);
  const m = await medir(page);
  expect(m.dentro).toBe(true);
  expect(m.pixel).toBe(true);
  for (const h of m.botones) expect(h).toBeGreaterThanOrEqual(44);
  await shot(page, info, '1-lo-de-hoy');

  // 2 · «ver todo»: la sexta, la ruleta de la semana
  await page.getByRole('button', { name: /y 1 cosa más/ }).click();
  await expect.poll(() => filas(page)).toEqual(['correo', 'almacen', 'cafe', 'casino', 'misiones', 'ruleta']);
  // 1.162.1 · Sin bajar, la idea y sus botones se ven enteros dentro de la tarjeta (antes, a 360, quedaban cortados al pie)
  const pie = await page.evaluate(() => {
    const hoy = document.querySelector('.libo-hoy').getBoundingClientRect();
    const cuerpo = document.querySelector('.libo-hoy__cuerpo');
    const botones = [...document.querySelectorAll('.libo-hoy__idea button')].map((b) => b.getBoundingClientRect());
    return {
      enteros: botones.length > 0 && botones.every((r) => r.top >= hoy.top && r.bottom <= hoy.bottom - 3),
      desplaza: cuerpo.scrollHeight > cuerpo.clientHeight + 1,
    };
  });
  expect(pie.enteros, 'los botones de la idea, enteros').toBe(true);
  await shot(page, info, '2-ver-todo-arriba');
  await page.locator('[data-aviso="ruleta"]').scrollIntoViewIfNeeded();
  await shot(page, info, '2-ver-todo');
  if (pie.desplaza) {
    const r = await page.locator('[data-aviso="ruleta"]').boundingBox();
    const idea = await page.locator('.libo-hoy__idea').boundingBox();
    expect(r.y + r.height, 'la última fila, por encima de la idea').toBeLessThanOrEqual(idea.y + 1);
  }

  // 3 · El casino: directamente en el casino del sótano del hotel
  await page.locator('[data-aviso="casino"] button').click();
  const casino = page.getByRole('region', { name: 'El casino del sótano' });
  await expect(casino).toHaveAttribute('data-ready', 'true', {
    timeout: 30000,
  });
  await shot(page, info, '3-casino');

  // 4 · Atrás vuelve a tu piso; las misiones llevan a tu piso del edificio, con la hoja «Hoy en tu piso»
  await page.goBack();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({
    timeout: 30000,
  });
  await gato(page).click();
  await expect(page.locator('[data-aviso="misiones"]')).toBeVisible({
    timeout: 10000,
  });
  await page.locator('[data-aviso="misiones"] button').click();
  await expect(page.getByRole('button', { name: /^Hoy en tu piso \(0 de 3\)/ })).toBeVisible({ timeout: 30000 });
  await shot(page, info, '4-misiones');
  expect(errores).toEqual([]);
});

test('con todo hecho: lo hecho en verde y Libo se echa la siesta', async ({ page }, info) => {
  test.setTimeout(120000);
  const hoy = todayKey();
  const datos = biblioteca(
    [
      libro('viento', 'El nombre del viento', {
        status: 'reading',
        currentPage: 120,
        startedAt: iso(5),
      }),
    ],
    [
      {
        id: 's1',
        bookId: 'viento',
        date: hoy,
        pages: 20,
        kind: 'pages',
        at: new Date().toISOString(),
      },
    ],
    { vistos: VISTOS },
  );
  await casa(page, { datos, todoHecho: true });
  // Sin avisos ni sugerencia, no asoma: se abre tocándole
  await page.waitForTimeout(3000);
  await expect(tarjeta(page)).toHaveCount(0);
  await gato(page).click();
  await expect.poll(() => filas(page), { timeout: 10000 }).toEqual(['casino', 'misiones']);
  await expect(page.locator('.libo-hoy__fila[data-hecha]')).toHaveCount(2);
  await expect(tarjeta(page)).toContainText('Hoy ya está todo. Me echo una siesta en tu piso.');
  await expect(tarjeta(page)).toContainText('Vuelvo a asomarme');
  await expect(gato(page).locator('img')).toHaveAttribute('data-pose', 'duerme');
  // Lo hecho no es un botón
  await expect(page.locator('.libo-hoy__fila[data-hecha] button')).toHaveCount(0);
  await page.waitForTimeout(500);
  const m = await medir(page);
  expect(m.dentro).toBe(true);
  for (const h of m.botones) expect(h).toBeGreaterThanOrEqual(44);
  await shot(page, info, '5-todo-hecho');
  // Se cierra con su botón y el foco vuelve a Libo
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await expect(tarjeta(page)).toHaveCount(0);
  await expect(gato(page)).toBeFocused();
});
