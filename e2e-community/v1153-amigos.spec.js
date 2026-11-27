// 1.153, bloque 3 · La app «Amigos» del ordenador del piso (docs/qa/amigos-vecinos.md), con Supabase simulado: nunca una cuenta
// real. Ana tiene dos amigos (Bruno comparte lo que lee; Carla, nada), Dani la sigue y ella aún no, y Elena le ha pasado su
// código. En su buzón: una recomendación de Bruno, una propuesta de Carla para leer a la vez y la llave del edificio de Bruno.
// Las reglas de verdad, en src/features/social/__tests__/amigos.rls.test.js. Capturas en qa-report/v1153/; con
// AMIGOS_VIDEO=1, el vídeo.
import { expect, test } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { ANA, SALA } from './v190-apoyo';

const DIR = join('qa-report', 'v1153');
const tam = (info) => info.project.name.replace(/^chromium-/, '');
const uid = (h) => `${h.repeat(8)}-${h.repeat(4)}-4${h.repeat(3)}-8${h.repeat(3)}-${h.repeat(12)}`;
const BRUNO = uid('b');
const CARLA = uid('c');
const DANI = uid('d');
const ELENA = uid('e');
const TAMANOS = /^chromium-(360x800|390x844|1440x900)$/;

const libro = (id, title, author, status, extra = {}) => ({
  id,
  title,
  author,
  status,
  pageCount: 300,
  currentPage: status === 'read' ? 300 : 0,
  addedAt: '2026-10-01T10:00:00.000Z',
  finishedAt: null,
  quotes: [],
  ...extra,
});
const BIBLIOTECA = {
  version: 8,
  books: [
    libro('dracula', 'Drácula', 'Bram Stoker', 'reading', { currentPage: 120, updatedAt: '2026-11-25T10:00:00.000Z' }),
    libro('viento', 'El nombre del viento', 'Patrick Rothfuss', 'read', { finishedAt: '2026-11-18T10:00:00.000Z' }),
    libro('rebeca', 'Rebeca', 'Daphne du Maurier', 'want'),
  ],
  settings: { sound: false, sfx: false, onboardingDone: true },
  progress: { readingLog: [], pomodoros: [], claimed: {} },
};

function seed() {
  const mock = createMockSupabase({ edificio_vecinos: [], edificio_llaves: [] });
  const perfil = (user_id, alias, avatar_id) => mock.db.profiles.push({ user_id, alias, avatar_id, community_enabled: true });
  perfil(ANA.id, 'Ana lectora', 'gato-lector');
  perfil(BRUNO, 'Bruno', 'lector-farol');
  perfil(CARLA, 'Carla', 'gato-lector');
  perfil(DANI, 'Dani', 'lector-farol');
  perfil(ELENA, 'Elena', 'gato-lector');
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-ana', puerta: '2B' });
  mock.db.edificio_vecinos.push({ user_id: BRUNO, edificio: 'edificio-bruno', puerta: '1A' });
  mock.db.pisos.push({ user_id: ANA.id, layout: SALA });
  mock.db.pisos.push({ user_id: BRUNO, layout: SALA });
  mock.db.libraries.push({ user_id: ANA.id, data: BIBLIOTECA, updated_at: new Date().toISOString(), version: 5 });
  const sigue = (follower, followed) => mock.db.follows.push({ follower, followed, created_at: '2026-11-20T10:00:00.000Z' });
  sigue(ANA.id, BRUNO);
  sigue(BRUNO, ANA.id);
  sigue(ANA.id, CARLA);
  sigue(CARLA, ANA.id);
  sigue(DANI, ANA.id);
  const ahora = new Date().toISOString();
  mock.db.amigos = {
    codigos: { [ANA.id]: 'ANAK7Q2M', [ELENA]: 'ELENAZ23' },
    lectura: {
      [BRUNO]: {
        ver_leyendo: true,
        ver_terminados: true,
        ver_juntos: true,
        leyendo: [{ titulo: 'La sombra del viento', autor: 'Carlos Ruiz Zafón' }],
        terminados: [{ titulo: 'Rebeca', autor: 'Daphne du Maurier', fecha: '2026-11-21' }],
      },
      [CARLA]: { ver_leyendo: false, ver_terminados: false, ver_juntos: true, leyendo: null, terminados: null },
    },
    recomendaciones: [{ id: 'r1', de: BRUNO, para: ANA.id, titulo: 'Orgullo y prejuicio', autor: 'Jane Austen', frase: 'te_gustara', creada: ahora, vista: false }],
    juntos: [
      { id: 'j-bruno', de: BRUNO, para: ANA.id, titulo: 'Drácula', autor: 'Bram Stoker', estado: 'activa', avances: { [BRUNO]: 70 }, creada: ahora },
      { id: 'j-carla', de: CARLA, para: ANA.id, titulo: 'Rebeca', autor: 'Daphne du Maurier', estado: 'invitada', avances: {}, creada: ahora },
    ],
  };
  mock.db.edificio_llaves.push({ codigo: 'BRUN0K3Y'.replace('0', 'W'), edificio: 'edificio-bruno', de: BRUNO, para: ANA.id, caduca: new Date(Date.now() + 5 * 86400000).toISOString() });
  return mock;
}

async function preparar(page, mock) {
  await page.addInitScript((datos) => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!localStorage.getItem('bookshelf:v1')) localStorage.setItem('bookshelf:v1', JSON.stringify(datos));
  }, BIBLIOTECA);
  await mock.attach(page, ANA);
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1000);
}

async function abrirAmigos(page) {
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('button', { name: 'Ordenador', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi escritorio' })).toBeVisible({ timeout: 12000 });
  const tarjeta = page.locator('.pp-am-card');
  await expect(tarjeta).toBeVisible();
  return tarjeta;
}

const shot = async (page, info, nombre) => {
  mkdirSync(DIR, { recursive: true });
  await page.waitForTimeout(350);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: join(DIR, `${nombre}-${tam(info)}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `desborde en ${nombre}`).toBe(true);
};

const agenda = (page) => page.locator('.am');

test.beforeEach(({}, info) => {
  test.skip(!TAMANOS.test(info.project.name), '360, 390 y escritorio');
});

test('la tarjeta del escritorio abre la agenda: las fichas de tus amigos y lo que leéis a la vez', async ({ page }, info) => {
  const mock = seed();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await preparar(page, mock);
  const tarjeta = await abrirAmigos(page);
  await shot(page, info, '01-escritorio');
  await tarjeta.getByRole('button', { name: 'Abrir Amigos' }).click();
  const am = agenda(page);
  const bruno = am.locator('.am-ficha', { hasText: 'Bruno' });
  await expect(bruno).toContainText('La sombra del viento');
  await expect(bruno).toContainText('Rebeca');
  await expect(am.locator('.am-ficha', { hasText: 'Carla' })).toContainText('No lo comparte');
  // Leemos a la vez: Drácula con Bruno, tu 40 % (120 de 300) y su 70 %
  const junto = am.locator('.am-junto', { hasText: 'Drácula' });
  await expect(junto.getByRole('progressbar', { name: 'Tú: 40 %' })).toBeAttached();
  await expect(junto.getByRole('progressbar', { name: 'Bruno: 70 %' })).toBeAttached();
  await expect(am.getByRole('tab', { name: /Buzón/ })).toContainText('3');
  // Al abrir, tu app manda lo que lees, lo terminado y tu avance en lo de Bruno
  await expect.poll(() => mock.db.amigos.llamadas?.some((l) => l.rpc === 'amigos_publicar')).toBe(true);
  const envio = mock.db.amigos.llamadas.find((l) => l.rpc === 'amigos_publicar').body;
  expect(envio.leyendo).toEqual([{ titulo: 'Drácula', autor: 'Bram Stoker' }]);
  expect(envio.terminados).toEqual([{ titulo: 'El nombre del viento', autor: 'Patrick Rothfuss', fecha: '2026-11-18' }]);
  expect(envio.avances).toEqual([{ id: 'j-bruno', pct: 40 }]);
  await shot(page, info, '02-amigos');
  // Recomendar un libro a Bruno, con una frase cerrada
  await bruno.getByRole('button', { name: 'Recomendar un libro' }).click();
  const hoja = page.getByRole('dialog', { name: 'Recomendar un libro' });
  await hoja.getByRole('radio', { name: /El nombre del viento/ }).click();
  await hoja.getByText('«No pude soltarlo»').click();
  await shot(page, info, '03-recomendar');
  await hoja.getByRole('button', { name: 'Recomendárselo' }).click();
  await expect(am.locator('.am-aviso')).toHaveText('Le has recomendado «El nombre del viento» a Bruno.');
  expect(mock.db.amigos.recomendaciones.find((r) => r.para === BRUNO)).toMatchObject({ titulo: 'El nombre del viento', frase: 'no_pude_soltarlo' });
  // Darle la llave a Carla (Bruno ya vive en su propio edificio y también puede recibirla)
  await am.locator('.am-ficha', { hasText: 'Carla' }).getByRole('button', { name: 'Darle la llave' }).click();
  await expect(am.locator('.am-aviso')).toContainText('Le has dado la llave de tu edificio a Carla');
  await expect(am.locator('.am-ficha', { hasText: 'Carla' }).locator('.am-sello--llave')).toHaveText('Tiene tu llave');
  expect(mock.db.edificio_llaves.find((l) => l.para === CARLA)).toMatchObject({ de: ANA.id, edificio: 'edificio-ana' });
  expect(errores).toEqual([]);
});

test('buscar: por código de amigo, y seguir también a quien te sigue', async ({ page }, info) => {
  const mock = seed();
  await preparar(page, mock);
  await (await abrirAmigos(page)).getByRole('button', { name: 'Abrir Amigos' }).click();
  const am = agenda(page);
  await am.getByRole('tab', { name: /Buscar/ }).click();
  await expect(am.locator('.am-carnet__codigo')).toHaveText('ANAK-7Q2M');
  await am.getByLabel('Busca por alias o por código').fill('elen-az23');
  await am.getByRole('button', { name: 'Buscar', exact: true }).click();
  const res = am.getByRole('list', { name: 'Resultados' });
  await expect(res.getByText('Elena')).toBeVisible();
  await shot(page, info, '04-buscar');
  await res.getByRole('button', { name: 'Seguir' }).click();
  await expect(am.locator('.am-aviso')).toHaveText('Sigues a Elena. Seréis amigos cuando te siga.');
  expect(mock.db.follows.some((f) => f.follower === ANA.id && f.followed === ELENA)).toBe(true);
  // Dani te sigue: «Seguir también» y ya sois amigos
  const sol = am.locator('section', { has: page.getByRole('heading', { name: 'Te siguen' }) });
  await sol.getByRole('button', { name: 'Seguir también' }).click();
  await expect(am.locator('.am-aviso')).toHaveText('Ya sois amigos Dani y tú.');
  await am.getByRole('tab', { name: /Amigos/ }).click();
  await expect(am.locator('.am-ficha', { hasText: 'Dani' })).toBeVisible();
});

test('el buzón: leer a la vez, añadir lo recomendado y mudarse con la llave de un amigo', async ({ page }, info) => {
  const mock = seed();
  await preparar(page, mock);
  await (await abrirAmigos(page)).getByRole('button', { name: 'Abrir Amigos' }).click();
  const am = agenda(page);
  await am.getByRole('tab', { name: /Buzón/ }).click();
  await expect(am.locator('.am-carta--llave')).toContainText('Bruno te ha dado la llave de su edificio.');
  await expect(am.locator('.am-carta', { hasText: 'Orgullo y prejuicio' })).toContainText('«Creo que te gustará»');
  await shot(page, info, '05-buzon');
  await expect.poll(() => mock.db.amigos.recomendaciones.find((r) => r.id === 'r1').vista).toBe(true);
  // Carla: Rebeca a la vez (Ana ya la tiene en Quiero leer)
  await am.locator('.am-carta', { hasText: 'Carla' }).getByRole('button', { name: 'Leerlo a la vez' }).click();
  await expect(am.locator('.am-aviso')).toHaveText('Leéis a la vez «Rebeca».');
  expect(mock.db.amigos.juntos.find((j) => j.id === 'j-carla').estado).toBe('activa');
  // Lo recomendado, a Quiero leer
  await am.locator('.am-carta', { hasText: 'Orgullo y prejuicio' }).getByRole('button', { name: 'Añadir a Quiero leer' }).click();
  await expect(am.locator('.am-carta', { hasText: 'Orgullo y prejuicio' }).getByText('Ya lo tienes')).toBeVisible();
  // Mudarse al edificio de Bruno
  await am.locator('.am-carta--llave').getByRole('button', { name: 'Mudarme' }).click();
  const hoja = page.getByRole('dialog', { name: 'Mudarse' });
  await expect(hoja).toContainText('¿Te mudas al edificio de Bruno?');
  await shot(page, info, '06-mudarse');
  await hoja.getByRole('button', { name: 'Mudarme' }).click();
  await expect(am.locator('.am-aviso')).toHaveText('Ya vives en el edificio de Bruno.');
  expect(mock.db.edificio_vecinos.find((v) => v.user_id === ANA.id).edificio).toBe('edificio-bruno');
  await am.getByRole('tab', { name: /Amigos/ }).click();
  await expect(am.locator('.am-ficha', { hasText: 'Bruno' }).locator('.am-sello')).toHaveText('Vive en tu edificio');
});

test('lo que ven tus amigos: apagar «Qué leo ahora» lo borra del servidor', async ({ page }, info) => {
  const mock = seed();
  await preparar(page, mock);
  await (await abrirAmigos(page)).getByRole('button', { name: 'Abrir Amigos' }).click();
  const am = agenda(page);
  await am.getByRole('tab', { name: 'Lo que ven' }).click();
  const leo = am.getByRole('switch', { name: /Qué leo ahora/ });
  await expect(leo).toBeChecked();
  await expect.poll(() => mock.db.amigos.lectura[ANA.id]?.leyendo?.length).toBe(1);
  await leo.click();
  await expect(am.locator('.am-aviso')).toHaveText('Hecho: ya no lo ven.');
  await expect(leo).not.toBeChecked();
  expect(mock.db.amigos.lectura[ANA.id]).toMatchObject({ ver_leyendo: false, leyendo: null });
  await shot(page, info, '07-lo-que-ven');
});

test('sin la migración, la agenda lo dice sin romper nada', async ({ page }) => {
  const mock = seed();
  delete mock.db.amigos;
  await preparar(page, mock);
  const tarjeta = await abrirAmigos(page);
  await tarjeta.getByRole('button', { name: 'Abrir Amigos' }).click();
  await expect(page.getByRole('heading', { name: 'Amigos llega pronto' })).toBeVisible();
});

test('vídeo de la agenda de amigos', async ({ browser }, info) => {
  test.skip(!process.env.AMIGOS_VIDEO || info.project.name !== 'chromium-390x844', 'solo con AMIGOS_VIDEO=1');
  test.setTimeout(120000);
  const dir = join(DIR, 'video');
  const bruto = join(dir, 'bruto');
  mkdirSync(bruto, { recursive: true });
  const context = await browser.newContext({ ...info.project.use, recordVideo: { dir: bruto, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const mock = seed();
  await preparar(page, mock);
  await (await abrirAmigos(page)).getByRole('button', { name: 'Abrir Amigos' }).click();
  const am = agenda(page);
  await page.waitForTimeout(1500);
  await page.locator('[data-pc-app="amigos"] .pc-win__body').evaluate((n) => n.scrollBy({ top: 420, behavior: 'smooth' }));
  await page.waitForTimeout(1500);
  await am.locator('.am-ficha', { hasText: 'Bruno' }).getByRole('button', { name: 'Recomendar un libro' }).click();
  const hoja = page.getByRole('dialog', { name: 'Recomendar un libro' });
  await page.waitForTimeout(700);
  await hoja.getByRole('radio', { name: /El nombre del viento/ }).click();
  await page.waitForTimeout(500);
  await hoja.getByText('«No pude soltarlo»').click();
  await page.waitForTimeout(700);
  await hoja.getByRole('button', { name: 'Recomendárselo' }).click();
  await page.waitForTimeout(1400);
  await am.getByRole('tab', { name: /Buscar/ }).click();
  await page.waitForTimeout(900);
  await am.getByLabel('Busca por alias o por código').pressSequentially('ELENAZ23', { delay: 70 });
  await am.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.waitForTimeout(900);
  await am.getByRole('list', { name: 'Resultados' }).getByRole('button', { name: 'Seguir' }).click();
  await page.waitForTimeout(1200);
  await am.getByRole('tab', { name: /Buzón/ }).click();
  await page.waitForTimeout(1500);
  await am.locator('.am-carta', { hasText: 'Carla' }).getByRole('button', { name: 'Leerlo a la vez' }).click();
  await page.waitForTimeout(1500);
  await am.getByRole('tab', { name: 'Lo que ven' }).click();
  await page.waitForTimeout(1800);
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join(dir, '1153-amigos.webm'));
});
