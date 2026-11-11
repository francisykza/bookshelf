// 1.117 · La cita de lectura (bloque b de docs/qa/sala-lectura-3d.md), con Supabase simulado: invitar a un amigo desde
// la sala (cuándo y cuánto), «no ha podido venir», la invitación que te llega (en la sala y como aviso del edificio), el
// sofá para dos con la cuenta atrás y el reloj de los dos, tu amigo sentado a tu lado, el latido y «habéis leído juntos».
// Capturas en qa-report/sala-cita/; vídeo con SALA_VIDEO=1.
import { expect, test } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_AVATAR } from '../src/features/edificio/actor';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BEA = '22222222-2222-4222-8222-222222222222';
const DIR = join('qa-report', 'sala-cita');
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

async function preparar(page, { reduced = true, invitaciones = [] } = {}) {
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.profiles.push({ user_id: BEA, alias: 'Bea lectora', avatar_id: 'lectora-cafe', community_enabled: true });
  mock.db.sala_personajes = [
    { user_id: ANA.id, personaje: { ...DEFAULT_AVATAR, jersey: 2, pelo: 'corto' }, companero: null },
    { user_id: BEA, personaje: { ...DEFAULT_AVATAR, piel: 3, colorPelo: 4, jersey: 5, pelo: 'melena' }, companero: null },
  ];
  mock.db.sala = { lomos: [], saludos: [] };
  mock.db.citas = { amigos: [AMIGA], invitaciones };
  const ahora = new Date().toISOString();
  mock.db.reading_presence.push({ user_id: BEA, share_book: true, book_title: 'El faro del fin', started_at: ahora, last_seen: ahora });
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

test('la cita: invitar, «no ha podido venir», aceptar, el sofá para dos, el reloj de los dos y «habéis leído juntos»', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|1440x900)$|webkit-390x844$/.test(info.project.name), '360, 390, escritorio y WebKit a 390');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const mock = await preparar(page);
  const sala = await entrar(page);
  const citas = mock.db.citas;
  const panel = sala.getByRole('region', { name: 'Leer con un amigo' });
  await settled(page);

  // El sofá ya no es «pronto» y el panel ofrece quedar con un amigo
  await expect(sala.locator('.sl3-tag', { hasText: 'Sofá para dos' })).not.toContainText('pronto');
  await expect(panel).toContainText('Queda con un amigo');
  await panel.getByRole('button', { name: 'Invitar a un amigo' }).click();
  // Con una sola amiga, ya va elegida; se elige cuándo y cuánto
  await expect(panel.getByRole('group', { name: 'A quién invitas' }).getByRole('button', { name: 'Bea lectora' })).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('group', { name: 'Cuándo' }).getByRole('button', { name: 'En 15 min' }).click();
  await panel.getByRole('group', { name: 'Cuánto' }).getByRole('button', { name: '45 min' }).click();
  await shot(page, info, '01-invitar', '.gh-cita');
  await panel.getByRole('button', { name: 'Invitar', exact: true }).click();
  await expect(panel).toContainText('Has invitado a Bea lectora a leer dentro de 15 min (45 min)');
  expect(citas.llamadas.find((l) => l.rpc === 'sala_cita_invitar').body).toEqual({ amigo: BEA, en_min: 15, minutos: 45 });

  // No contesta (o dice que no): solo «no ha podido venir»
  citas.mia.estado = 'no_vino';
  await mirar(page);
  await expect(panel).toContainText('Bea lectora no ha podido venir.');
  await shot(page, info, '02-no-ha-podido', '.gh-cita');
  await panel.getByRole('button', { name: 'Vale' }).click();
  await expect(panel.getByRole('button', { name: 'Invitar a un amigo' })).toBeVisible();

  // Bea te invita para dentro de 15 min: aceptas y vas al sofá a esperarla
  citas.mia = null;
  citas.invitaciones = [invitacion(15, 25)];
  await mirar(page);
  await expect(panel).toContainText('Bea lectora te invita a leer juntos dentro de 15 min (25 min) en el sofá para dos.');
  await shot(page, info, '03-te-invita', '.gh-cita');
  await panel.getByRole('button', { name: 'Aceptar' }).click();
  await expect(panel).toContainText('Habéis quedado Bea lectora y tú en el sofá para dos. Empieza en');
  await expect(sala.locator('.sl3-tag', { hasText: 'Sofá para dos' })).toContainText('con Bea lectora');
  await panel.getByRole('button', { name: 'Ir al sofá' }).click();
  await page.waitForFunction(() => window.__sala3d.sentadoEn() === 7 && window.__sala3d.settled());
  const tira = sala.locator('.sl3-sit');
  await expect(tira).toContainText('Con Bea lectora, en el sofá');
  await expect(tira.locator('.gh-lect__clock strong')).toHaveText(/^1[45]:\d\d$/);
  await shot(page, info, '04-esperando-en-el-sofa');

  // Llega la hora (el servidor la adelanta) y Bea se sienta a tu lado: el reloj es el de los dos
  citas.otroLate = true;
  citas.mia.empieza = Date.now() - 2000;
  citas.mia.fin = citas.mia.empieza + 25 * 60000;
  await mirar(page);
  await expect(tira).toContainText('Leyendo con Bea lectora');
  await expect(tira.locator('.gh-lect__clock strong')).toHaveText(/^2[45]:\d\d$/);
  await expect.poll(() => citas.llamadas.filter((l) => l.rpc === 'sala_cita_latido').length).toBeGreaterThan(0);
  await mirar(page);
  await expect
    .poll(() => page.evaluate(() => window.__sala3d.verLectores()))
    .toEqual([
      { sillon: 6, yo: false, companero: null },
      { sillon: 7, yo: true, companero: null },
    ]);
  await expect(panel).toContainText('Juntos, 1 minuto. Bea lectora está en el sofá.');
  await expect(panel).toContainText('con la app a la vista');
  await page.waitForTimeout(300);
  await shot(page, info, '05-leyendo-juntos');

  // Al dejarla, la sala dice cuánto habéis leído juntos
  await panel.getByRole('button', { name: 'Dejar la cita' }).click();
  await expect(panel).toContainText('Habéis leído juntos 1 minuto, Bea lectora y tú.');
  await shot(page, info, '06-habeis-leido-juntos', '.gh-cita');
  await tira.getByRole('button', { name: 'Levantarte del sofá' }).click();
  await settled(page);
  // Bea vuelve a su sillón (sigue en la sala)
  await expect.poll(() => page.evaluate(() => window.__sala3d.verLectores())).toEqual([{ sillon: 0, yo: false, companero: null }]);
  expect(errors).toEqual([]);
});

test('la invitación avisa estés donde estés del edificio y «Ir a la sala» te lleva', async ({ page }, info) => {
  test.skip(!/chromium-390x844$|webkit-390x844$/.test(info.project.name), 'a 390');
  await preparar(page, { invitaciones: [invitacion(0, 25)] });
  const aviso = page.locator('.ed-aviso');
  await expect(aviso).toContainText('Bea lectora te invita a leer juntos en la sala de lectura ahora (25 min).', { timeout: 15000 });
  await shot(page, info, '07-aviso-edificio', '.ed-aviso');
  await aviso.getByRole('button', { name: 'Ir a la sala' }).click();
  const sala = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' }).getByRole('region', { name: 'La sala de lectura' });
  await expect(sala).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
  // Dentro de la sala no avisa: la invitación está en su panel
  await expect(page.locator('.ed-aviso')).toHaveCount(0);
  await expect(sala.getByRole('region', { name: 'Leer con un amigo' })).toContainText('Bea lectora te invita a leer juntos ahora (25 min)');
});

test('sin la migración, el sofá sigue «pronto» y no hay cita', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'una vez basta');
  const mock = await preparar(page);
  mock.db.citas = null;
  const sala = await entrar(page);
  await expect(sala.locator('.sl3-tag', { hasText: 'Sofá para dos' })).toContainText('pronto');
  await expect(sala.getByRole('region', { name: 'Leer con un amigo' })).toHaveCount(0);
});

test('vídeo de la cita (SALA_VIDEO=1)', async ({ browser }, info) => {
  test.skip(!process.env.SALA_VIDEO || !/chromium-390x844$|webkit-390x844$/.test(info.project.name), 'solo para grabar');
  test.setTimeout(120000);
  const context = await browser.newContext({ ...info.project.use, baseURL: info.project.use.baseURL, recordVideo: { dir: join(DIR, 'bruto'), size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const mock = await preparar(page, { reduced: false, invitaciones: [invitacion(0, 25)] });
  const aviso = page.locator('.ed-aviso');
  await expect(aviso).toContainText('Bea lectora te invita', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await aviso.getByRole('button', { name: 'Ir a la sala' }).click();
  const sala = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' }).getByRole('region', { name: 'La sala de lectura' });
  await expect(sala).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
  const panel = sala.getByRole('region', { name: 'Leer con un amigo' });
  await panel.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(1500);
  mock.db.citas.otroLate = true;
  await panel.getByRole('button', { name: 'Aceptar' }).click();
  await page.waitForTimeout(800);
  await panel.getByRole('button', { name: 'Ir al sofá' }).click();
  await page.waitForFunction(() => window.__sala3d.sentadoEn() === 7 && window.__sala3d.settled());
  await mirar(page);
  await page.waitForTimeout(4500);
  await panel.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(2000);
  await panel.getByRole('button', { name: 'Dejar la cita' }).click();
  await page.waitForTimeout(2500);
  await sala.locator('.sl3-sit').getByRole('button', { name: 'Levantarte del sofá' }).click();
  await settled(page);
  await page.waitForTimeout(1500);
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join(DIR, `sala-cita-${info.project.name}.webm`));
});
