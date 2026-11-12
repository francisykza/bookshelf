// 1.118 · La placa del sofá y los gestos cerrados (bloque c de docs/qa/sala-lectura-3d.md), con Supabase simulado:
// vuestras placas en «Leer con un amigo» (latón, plata y oro según las horas, sin rachas), la placa en el respaldo del sofá
// (la de tu cita o, sin cita, la de más horas), los gestos a quien lee contigo y a tu amigo en el sofá, con su cupo, el
// gesto que te llega sobre su cabeza, apuntar en la placa el libro terminado leyendo juntos, y sin la migración.
// Capturas en qa-report/sala-placa/; vídeo con SALA_VIDEO=1.
import { expect, test } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_AVATAR } from '../src/features/edificio/actor';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BEA = '22222222-2222-4222-8222-222222222222';
const CARLOS = '33333333-3333-4333-8333-333333333333';
const DANI = '44444444-4444-4444-8444-444444444444';
const DIR = join('qa-report', 'sala-placa');
const AMIGA = { uid: BEA, alias: 'Bea lectora', avatar_id: 'lectora-cafe' };
const LIBRO = {
  id: 'faro',
  title: 'Una luz en la bahía',
  author: 'Autora de prueba',
  status: 'reading',
  pageCount: 320,
  currentPage: 96,
  addedAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-10T10:00:00.000Z',
  quotes: [],
};
// Ordenadas como las da el servidor: de más a menos minutos juntos
const PLACAS = () => [
  {
    uid: CARLOS,
    alias: 'Carlos lector',
    avatar_id: 'gato-lector',
    minutos: 3120,
    hito: 50,
    metal: 'oro',
    libros: [
      { titulo: 'Mareas de invierno', mio: true },
      { titulo: 'El cartógrafo', mio: false },
    ],
  },
  { uid: DANI, alias: 'Dani lectora', avatar_id: 'lectora-cafe', minutos: 640, hito: 10, metal: 'plata', libros: [] },
  { uid: BEA, alias: 'Bea lectora', avatar_id: 'lectora-cafe', minutos: 70, hito: 1, metal: 'laton', libros: [{ titulo: 'El faro del fin', mio: false }] },
];
async function shot(page, info, name, que = '.sl3') {
  mkdirSync(DIR, { recursive: true });
  await page.mouse.move(0, 0);
  await page
    .locator(que)
    .first()
    .evaluate((e) => e.scrollIntoView({ block: 'nearest' }))
    .catch(() => {});
  await page.screenshot({ path: join(DIR, `${name}-${info.project.name}.png`) });
}
const settled = (page) => page.waitForFunction(() => window.__sala3d?.settled());
// La sala vuelve a preguntar al servidor (como al volver a la app)
const mirar = (page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
const invitacion = (en = 0, minutos = 25) => {
  const empieza = Date.now() + en * 60000;
  return { cita: `c-${Math.random().toString(16).slice(2)}`, soy: 'invitado', ...AMIGA, minutos, empieza, fin: empieza + minutos * 60000, estado: 'invitada', juntos: 0, mios: 0 };
};

async function preparar(page, { reduced = true, parejas = { placas: PLACAS() }, bea = true } = {}) {
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.profiles.push({ user_id: BEA, alias: 'Bea lectora', avatar_id: 'lectora-cafe', community_enabled: true });
  mock.db.sala_personajes = [
    { user_id: ANA.id, personaje: { ...DEFAULT_AVATAR, jersey: 2, pelo: 'corto' }, companero: null },
    { user_id: BEA, personaje: { ...DEFAULT_AVATAR, piel: 3, colorPelo: 4, jersey: 5, pelo: 'melena' }, companero: null },
  ];
  mock.db.sala = { lomos: [], saludos: [] };
  mock.db.citas = { amigos: [AMIGA], invitaciones: [] };
  mock.db.parejas = parejas;
  const ahora = new Date().toISOString();
  if (bea) mock.db.reading_presence.push({ user_id: BEA, share_book: true, book_title: 'El faro del fin', started_at: ahora, last_seen: ahora });
  await mock.attach(page, ANA);
  await page.addInitScript((libro) => {
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
  }, LIBRO);
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  return mock;
}
async function entrar(page) {
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Coger la limusina al Gran Hotel' }).click({ timeout: 15000 });
  const hotel = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' });
  await hotel.getByRole('button', { name: 'Directorio' }).click({ timeout: 15000 });
  await hotel.getByRole('button', { name: /Café-biblioteca/ }).click();
  const sala = hotel.getByRole('region', { name: 'La sala de lectura' });
  await expect(sala).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
  await page.waitForFunction(() => window.__sala3d?.renders() > 0);
  return sala;
}
// Aceptar la invitación de Bea (ya empezada, y ella en el sofá) e ir al sofá
async function alSofa(page, sala, mock, cita) {
  mock.db.citas.otroLate = true;
  mock.db.citas.invitaciones = [cita];
  await mirar(page);
  const panel = sala.getByRole('region', { name: 'Leer con un amigo' });
  await panel.getByRole('button', { name: 'Aceptar' }).click();
  await panel.getByRole('button', { name: 'Ir al sofá' }).click();
  await page.waitForFunction(() => window.__sala3d.sentadoEn() === 7 && window.__sala3d.settled());
  await mirar(page);
  await expect.poll(() => page.evaluate(() => window.__sala3d.verLectores().map((l) => l.sillon))).toContain(6);
  return panel;
}

test('la placa del sofá: vuestras placas en el panel y, en el respaldo, la de tu cita o la de más horas', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|1440x900)$|webkit-390x844$/.test(info.project.name), '360, 390, escritorio y WebKit a 390');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const mock = await preparar(page);
  const sala = await entrar(page);
  await settled(page);

  // En «Leer con un amigo», una placa por amigo: el metal por las horas, sin rachas ni cuentas atrás
  const placas = sala.getByRole('list', { name: 'Vuestras placas del sofá' });
  await expect(placas.getByRole('listitem')).toHaveCount(3);
  await expect(placas.getByRole('listitem').nth(0)).toContainText('Carlos lector y tú · 52 h juntos');
  await expect(placas.getByRole('listitem').nth(0)).toContainText('Placa de oro · 50 horas · 2 libros terminados juntos: «Mareas de invierno», «El cartógrafo»');
  await expect(placas.getByRole('listitem').nth(1)).toContainText('Dani lectora y tú · 10 h 40 min juntos');
  await expect(placas.getByRole('listitem').nth(1)).toContainText('Placa de plata · 10 horas');
  await expect(placas.getByRole('listitem').nth(2)).toContainText('Bea lectora y tú · 1 h 10 min juntos');
  await expect(placas.getByRole('listitem').nth(2)).toContainText('Placa de latón · 1 hora · un libro terminado juntos: «El faro del fin»');
  await expect(sala.locator('.gh-placa[data-metal="oro"]')).toHaveCount(1);
  const texto = await sala.getByRole('region', { name: 'Leer con un amigo' }).innerText();
  expect(texto).not.toMatch(/racha|seguid|quedan|pierde/i);
  await shot(page, info, '01-vuestras-placas', '.gh-placas');

  // Sin cita, el respaldo lleva tu placa de más horas (la de oro); se lee al acercarte al sofá
  expect(await page.evaluate(() => window.__sala3d.verPlaca())).toBe('oro');
  await sala.getByRole('button', { name: 'Plano' }).click();
  await sala.getByRole('navigation', { name: 'Plano de la sala' }).getByRole('button', { name: 'Sofá para dos' }).click();
  await expect(sala.locator('.sl3-aviso')).toContainText('En el respaldo, tu placa con Carlos lector.');
  await settled(page);
  const placa = sala.locator('.sl3-placa');
  await expect(placa).not.toHaveAttribute('data-off', 'true');
  await expect(placa).toHaveText('Carlos lector y tú · 52 h juntos · 2 libros');
  await expect(placa).toHaveAttribute('data-metal', 'oro');
  await page.waitForTimeout(300);
  await shot(page, info, '02-placa-de-oro');

  // En la cita con Bea, la placa es la vuestra (latón) y se ve sentada en el sofá
  await alSofa(page, sala, mock, invitacion(0, 25));
  expect(await page.evaluate(() => window.__sala3d.verPlaca())).toBe('laton');
  await expect(placa).not.toHaveAttribute('data-off', 'true');
  await expect(placa).toHaveText('Bea lectora y tú · 1 h 10 min juntos · 1 libro');
  await page.waitForTimeout(300);
  await shot(page, info, '03-placa-en-la-cita');
  expect(errors).toEqual([]);
});

test('los gestos: a quien lee contigo en la sala y a tu amigo en el sofá, con su cupo', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844)$|webkit-390x844$/.test(info.project.name), '360, 390 y WebKit a 390');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // Bea, que lee en un sillón, te enseña su libro
  const mock = await preparar(page, { parejas: { placas: PLACAS(), gestos: [{ de: BEA, gesto: 'libro' }] } });
  const parejas = mock.db.parejas;
  const sala = await entrar(page);
  await settled(page);
  await sala.locator('.sl3-tag', { hasText: 'Un sillón libre' }).click();
  await page.waitForFunction(() => window.__sala3d.sentadoEn() === 1 && window.__sala3d.settled());
  const sit = sala.locator('.sl3-sit');
  await sit.getByRole('button', { name: 'Sentarme a leer' }).click();
  await expect(sit.getByRole('button', { name: 'Pausar' })).toBeVisible();
  await expect(sala.locator('.sl3-hola:not([data-vacio])')).toHaveText('¿Qué tal va?', { timeout: 20000 });
  await expect(sit.locator('.sl3-sit__hola')).toHaveText('Bea lectora te enseña su libro: «¿qué tal va el tuyo?».');
  await expect(sala.locator('.gh-21__note[role="status"]')).toHaveText('Bea lectora te enseña su libro: «¿qué tal va el tuyo?».');
  await page.waitForTimeout(300);
  await shot(page, info, '04-te-llega-un-gesto');

  // En «Leyendo ahora»: el saludo de siempre y, al lado, los demás gestos (lista cerrada, sin texto libre)
  const lista = sala.getByRole('list', { name: 'Quién lee ahora' });
  await expect(lista.getByRole('button', { name: 'Saludar a Bea lectora' })).toBeVisible();
  await lista.getByRole('button', { name: 'Más gestos para Bea lectora' }).click();
  const fila = lista.getByRole('group', { name: 'Un gesto para Bea lectora' });
  await expect(fila.getByRole('button')).toHaveText(['¡Hola!', 'Alzar la taza', '¿Qué tal va?', '¡Qué bueno!', 'Un capítulo más', 'Momento intenso', 'Buenas noches']);
  await expect(lista.locator('input, textarea')).toHaveCount(0);
  await fila.getByRole('button', { name: 'Alzar la taza' }).click();
  await expect(lista.getByRole('status')).toHaveText('Alzar la taza — enviado.');
  expect(parejas.enviados).toEqual([{ quien: BEA, gesto: 'taza' }]);
  await shot(page, info, '05-gestos-en-la-lista', '.gh-lect__list');
  // Otro enseguida: el servidor no lo deja (cupo) y se dice sin insistir
  await fila.getByRole('button', { name: 'Momento intenso' }).click();
  await expect(lista.getByRole('status')).toHaveText('Ya le has hecho un gesto hace muy poco: espera un momento.');

  // En la cita, en el sofá: los gestos van en la franja y en el panel de la cita
  parejas.cupo = [];
  const panel = await alSofa(page, sala, mock, invitacion(0, 25));
  await expect(panel.getByRole('group', { name: 'Un gesto para Bea lectora' })).toBeVisible();
  await sit.getByRole('button', { name: 'Gestos', exact: true }).click();
  const filaSofa = sit.getByRole('group', { name: 'Un gesto para Bea lectora' });
  await filaSofa.getByRole('button', { name: 'Un capítulo más' }).click();
  await expect(sit.getByRole('status')).toHaveText('Un capítulo más — enviado.');
  expect(parejas.enviados.at(-1)).toEqual({ quien: BEA, gesto: 'capitulo' });
  await page.waitForTimeout(300);
  await shot(page, info, '06-gestos-en-el-sofa');

  // Bea te da las buenas noches: el bocadillo sale sobre su plaza del sofá
  parejas.gestos = [{ de: BEA, gesto: 'noches' }];
  await mirar(page);
  const bocadillo = sala.locator('.sl3-hola:not([data-vacio])');
  await expect(bocadillo).toHaveText('Buenas noches');
  await expect(bocadillo).not.toHaveAttribute('data-off', 'true');
  await expect(sit.locator('.sl3-sit__hola')).toHaveText('Bea lectora te da las buenas noches.');
  await page.waitForTimeout(300);
  await shot(page, info, '07-buenas-noches');
  expect(errors).toEqual([]);
});

test('al terminar un libro leyendo juntos se apunta en vuestra placa', async ({ page }, info) => {
  test.skip(!/chromium-390x844$|webkit-390x844$/.test(info.project.name), 'a 390');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const mock = await preparar(page, { bea: false });
  const sala = await entrar(page);
  await settled(page);
  // Aceptas la cita y el servidor la deja a punto de acabar: el reloj de los dos acaba a la vez
  const citas = mock.db.citas;
  citas.otroLate = true;
  citas.invitaciones = [invitacion(0, 25)];
  await mirar(page);
  const panel = sala.getByRole('region', { name: 'Leer con un amigo' });
  await panel.getByRole('button', { name: 'Aceptar' }).click();
  await expect(panel.getByRole('button', { name: 'Ir al sofá' })).toBeVisible();
  const cita = citas.mia;
  cita.empieza = Date.now() - (25 * 60000 - 14000);
  cita.fin = cita.empieza + 25 * 60000;
  const antes = citas.llamadas.filter((l) => l.rpc === 'sala_citas').length;
  await mirar(page);
  await expect.poll(() => citas.llamadas.filter((l) => l.rpc === 'sala_citas').length).toBeGreaterThan(antes);
  await page.waitForTimeout(300);
  await panel.getByRole('button', { name: 'Ir al sofá' }).click();
  await page.waitForFunction(() => window.__sala3d.sentadoEn() === 7 && window.__sala3d.settled());
  const sit = sala.locator('.sl3-sit');
  await expect(sit.locator('.gh-lect__clock strong')).toHaveText(/^0:\d\d$|^00:\d\d$/);
  await expect(sit).toContainText('Leyendo con Bea lectora');
  await expect.poll(() => mock.db.citas.llamadas.filter((l) => l.rpc === 'sala_cita_latido').length).toBeGreaterThan(0);
  const paginas = sala.locator('input[type="number"]');
  await expect(paginas).toBeVisible({ timeout: 25000 });
  await paginas.fill(await paginas.getAttribute('max'));
  await sala.getByRole('button', { name: 'Apuntar' }).click();
  await sala.getByRole('button', { name: 'Seguir aquí' }).click();
  await expect(sala.getByText('Has terminado Una luz en la bahía leyendo con Bea lectora. ¿Lo apuntáis en la placa del sofá? Lo verá Bea lectora.')).toBeVisible();
  await expect(sala.locator('.gh-lect__con', { hasText: 'Habéis leído juntos 1 minuto, Bea lectora y tú.' })).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, info, '08-apuntar-en-la-placa');
  await sala.getByRole('button', { name: 'Apuntarlo en la placa' }).click();
  await expect(sala.locator('.sl3-aviso')).toHaveText('Apuntado en vuestra placa del sofá: «Una luz en la bahía».');
  expect(mock.db.parejas.apuntados).toEqual([{ cita: cita.cita, titulo: 'Una luz en la bahía' }]);
  const bea = sala.getByRole('list', { name: 'Vuestras placas del sofá' }).getByRole('listitem').filter({ hasText: 'Bea lectora' });
  await expect(bea).toContainText('2 libros terminados juntos: «El faro del fin», «Una luz en la bahía»');
  await shot(page, info, '09-apuntado', '.gh-placas');
  expect(errors).toEqual([]);
});

test('sin la migración de las placas: sin placa en el sofá y solo «¡Hola!», como antes', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'una vez basta');
  const mock = await preparar(page, { parejas: null });
  mock.db.sala.saludos = [BEA];
  const sala = await entrar(page);
  await settled(page);
  expect(await page.evaluate(() => window.__sala3d.verPlaca())).toBeNull();
  await expect(sala.getByRole('list', { name: 'Vuestras placas del sofá' })).toHaveCount(0);
  await sala.locator('.sl3-tag', { hasText: 'Un sillón libre' }).click();
  await page.waitForFunction(() => window.__sala3d.sentadoEn() === 1 && window.__sala3d.settled());
  await sala.locator('.sl3-sit').getByRole('button', { name: 'Sentarme a leer' }).click();
  await expect(sala.locator('.sl3-hola:not([data-vacio])')).toHaveText('¡Hola!', { timeout: 20000 });
  await expect(sala.locator('.sl3-sit__hola')).toHaveText('Bea lectora levanta la vista y te saluda.');
  const lista = sala.getByRole('list', { name: 'Quién lee ahora' });
  await expect(lista.getByRole('button', { name: 'Más gestos para Bea lectora' })).toHaveCount(0);
  await lista.getByRole('button', { name: 'Saludar a Bea lectora' }).click();
  await expect(lista.getByRole('button', { name: 'Saludar a Bea lectora' })).toBeDisabled();
  await expect.poll(() => mock.db.sala.enviados ?? []).toEqual([BEA]);
});

test('vídeo de la placa y los gestos (SALA_VIDEO=1)', async ({ browser }, info) => {
  test.skip(!process.env.SALA_VIDEO || !/chromium-390x844$|webkit-390x844$/.test(info.project.name), 'solo para grabar');
  test.setTimeout(150000);
  const context = await browser.newContext({ ...info.project.use, baseURL: info.project.use.baseURL, recordVideo: { dir: join(DIR, 'bruto'), size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const mock = await preparar(page, { reduced: false, parejas: { placas: PLACAS(), gestos: [{ de: BEA, gesto: 'libro' }] } });
  const sala = await entrar(page);
  await settled(page);
  await page.waitForTimeout(1200);
  // Vuestras placas, en el panel
  await sala.locator('.gh-placas').evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  await page.waitForTimeout(2600);
  await sala.locator('.sl3').evaluate((e) => e.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  await page.waitForTimeout(1000);
  // La placa de oro, en el respaldo del sofá
  await sala.getByRole('button', { name: 'Plano' }).click();
  await page.waitForTimeout(700);
  await sala.getByRole('navigation', { name: 'Plano de la sala' }).getByRole('button', { name: 'Sofá para dos' }).click();
  await settled(page);
  await page.waitForTimeout(2500);
  // Te sientas: Bea te enseña su libro y le alzas la taza (desde el sofá, el letrero del sillón no se ve: se va con el botón)
  await sala.getByRole('button', { name: 'Ir a un sillón libre' }).click();
  await page.waitForFunction(() => window.__sala3d.sentadoEn() === 1 && window.__sala3d.settled());
  await page.waitForTimeout(600);
  await sala.locator('.sl3-sit').getByRole('button', { name: 'Sentarme a leer' }).click();
  await expect(sala.locator('.sl3-hola:not([data-vacio])')).toHaveText('¿Qué tal va?', { timeout: 20000 });
  await page.waitForTimeout(2500);
  const lista = sala.getByRole('list', { name: 'Quién lee ahora' });
  await lista.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  await page.waitForTimeout(1000);
  await lista.getByRole('button', { name: 'Más gestos para Bea lectora' }).click();
  await page.waitForTimeout(900);
  await lista.getByRole('group', { name: 'Un gesto para Bea lectora' }).getByRole('button', { name: 'Alzar la taza' }).click();
  await page.waitForTimeout(1800);
  // La cita: al sofá, con vuestra placa de latón, y un gesto desde la franja
  mock.db.parejas.cupo = [];
  mock.db.citas.otroLate = true;
  mock.db.citas.invitaciones = [invitacion(0, 25)];
  await mirar(page);
  const panel = sala.getByRole('region', { name: 'Leer con un amigo' });
  await panel.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  await page.waitForTimeout(1500);
  await panel.getByRole('button', { name: 'Aceptar' }).click();
  await page.waitForTimeout(900);
  await panel.getByRole('button', { name: 'Ir al sofá' }).click();
  await page.waitForFunction(() => window.__sala3d.sentadoEn() === 7 && window.__sala3d.settled());
  await mirar(page);
  await page.waitForTimeout(2500);
  const sit = sala.locator('.sl3-sit');
  await sit.getByRole('button', { name: 'Gestos', exact: true }).click();
  await page.waitForTimeout(900);
  await sit.getByRole('group', { name: 'Un gesto para Bea lectora' }).getByRole('button', { name: 'Un capítulo más' }).click();
  await page.waitForTimeout(1500);
  mock.db.parejas.gestos = [{ de: BEA, gesto: 'noches' }];
  await mirar(page);
  await page.waitForTimeout(3500);
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join(DIR, `sala-placa-${info.project.name}.webm`));
});
