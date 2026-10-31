// QA de la 1.59.0 (SPEC §59) contra el simulador de Supabase: figuras expuestas con imagen en el perfil de otra persona
// (también en WebKit), visita sin pantalla oscura mientras se decodifica la casa, «Libros · N» sin taparse con el pie,
// perfil abierto desde la visita sin repetir consultas, y «Lectores que sigo» sin un «Lector» genérico mientras cargan
// los nombres. Perfiles de prueba; nada equivale a un iPhone real.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditState } from '../e2e/audit159';
import { SUPABASE, createMockSupabase } from './mockSupabase';

// Telemetría de los estados capturados (se une a qa-report/qa-telemetry.json con la del resto de la QA)
const run = { project: '', suite: 'community-v159', pageErrors: [], consoleErrors: [], states: [] };
test.beforeEach(async ({ page }, info) => {
  run.project = info.project.name;
  page.on('pageerror', (err) => run.pageErrors.push({ test: info.title, text: String(err) }));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/Failed to load resource/.test(msg.text())) run.consoleErrors.push({ test: info.title, text: msg.text() });
  });
});
test.afterAll(async ({ browserName: _b }, info) => {
  const dir = join('qa-report', 'telemetry');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${run.project}-community-v159-w${info.workerIndex}.json`), JSON.stringify(run, null, 2));
});

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222', email: 'bruno@ejemplo.test' };
const ref = (id, title, author) => ({ id, title, author, cover: '' });

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
  run.states.push(await auditState(page, name, run.consoleErrors.filter((e) => e.test === info.title)));
}

function seed() {
  const mock = createMockSupabase();
  mock.db.profiles.push(
    { user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true },
    { user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'lector-farol', community_enabled: true },
  );
  mock.db.follows.push({ follower: ANA.id, followed: BRUNO.id });
  mock.db.corners.push({
    user_id: BRUNO.id,
    visible: true,
    featured_books: Array.from({ length: 8 }, (_, i) => ref(`b${i}`, `Libro compartido ${i + 1}`, 'Autora')),
    // Las dos figuras definitivas del vídeo: deben verse con su imagen, no solo su nombre
    figure_ids: ['dama_ceniza', 'jinete_dragones'],
    guardian_id: 'dama_ceniza',
    show_current: true,
    current_title: 'The Ballad of Songbirds and Snakes',
    scene: 'dia',
    signature_books: [],
    last_book: null,
    next_book: null,
    memories: [],
  });
  return mock;
}

async function openReaders(page, mock) {
  await mock.attach(page, ANA);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('v159-nav')) return;
    sessionStorage.setItem('v159-nav', '1');
    history.replaceState({ bookshelf: { loc: { view: 'room', panel: { type: 'social', tab: 'lectores' } }, depth: 0, parent: null } }, '');
  });
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Lectores que sigo' })).toBeVisible();
}

const overlap = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('perfil de otra persona: las figuras expuestas se ven con su imagen (no solo el nombre)', async ({ page }, info) => {
  test.skip(!/390x844|1440x900/.test(info.project.name), '390 en Chromium y WebKit, y escritorio');
  const mock = seed();
  await openReaders(page, mock);
  // 1.62: el avatar de quien sigues abre su perfil
  await page.locator('.reader-person__open').first().click();
  const figures = page.getByRole('region', { name: 'Figuras expuestas' });
  await expect(figures).toBeVisible();
  await figures.scrollIntoViewIfNeeded();
  await expect(figures.locator('li')).toHaveCount(2);
  await expect(figures).toContainText('La Dama de la Ceniza');
  await expect(figures).toContainText('La Jinete de Dragones');
  // Cada figura tiene su caja con ancho real y su imagen descargada y dibujada
  await expect
    .poll(() =>
      figures.evaluate((el) =>
        [...el.querySelectorAll('.huella-figures__art')].map((art) => {
          const img = art.querySelector('img');
          const box = art.querySelector('.fig-box')?.getBoundingClientRect();
          return Boolean(img?.complete && img.naturalWidth > 0 && box && box.width > 30 && box.height > 60);
        }),
      ),
    )
    .toEqual([true, true]);
  await shot(page, info, 'v159-perfil-figuras');
});

test('visita: sin pantalla oscura mientras llega la casa; «Libros · N» no se tapa; el perfil sale de lo ya cargado', async ({ page }, info) => {
  test.skip(!/390x844|320x640|430x932/.test(info.project.name), 'móviles en Chromium y WebKit');
  const mock = seed();
  await openReaders(page, mock);
  // La casa tarda en llegar: mientras, la visita no tapa nada con un fondo oscuro
  let release;
  const gate = new Promise((r) => (release = r));
  await page.route('**/media/social-visit/casa-v1.webp', async (route) => {
    await gate;
    await route.fallback();
  });
  await page.getByRole('button', { name: 'Visitar el rincón de Bruno' }).click();
  const visit = page.getByRole('dialog', { name: 'Visita al rincón de Bruno' });
  await expect(page.locator('.reader-visit')).toHaveCount(1);
  const waiting = await page.evaluate(() => {
    const rv = document.querySelector('.reader-visit');
    return {
      shown: rv.hasAttribute('data-shown'),
      veil: getComputedStyle(rv.closest('.panel-veil')).backgroundColor,
      own: getComputedStyle(rv).backgroundColor,
      stage: getComputedStyle(rv.querySelector('.reader-visit__stage')).opacity,
    };
  });
  expect(waiting).toEqual({ shown: false, veil: 'rgba(0, 0, 0, 0)', own: 'rgba(0, 0, 0, 0)', stage: '0' });
  // Volver está desde el primer momento
  await expect(visit.getByRole('button', { name: 'Volver a lectores' })).toBeVisible();
  release();
  await expect(page.locator('.reader-visit[data-shown]')).toHaveCount(1, { timeout: 5000 });
  // 1.62: se entra desde la fachada
  await visit.getByRole('button', { name: 'Entrar al rincón de Bruno' }).click();
  await expect(visit.getByRole('button', { name: /Libros compartidos por Bruno/ })).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(500);
  // 1.61: la etiqueta de la estantería no se cruza con la cabecera ni con el libro de la mesita (ya no hay pie)
  const tag = await visit.locator('.reader-visit__tag').boundingBox();
  const head = await visit.locator('.reader-visit__bar').boundingBox();
  const table = await visit.locator('.reader-visit__table').boundingBox();
  expect(overlap(tag, head)).toBe(false);
  if (table) expect(overlap(tag, table)).toBe(false);
  await expect(visit.locator('.reader-visit__actions, .reader-visit__lead')).toHaveCount(0);
  await shot(page, info, 'v159-visita-habitacion');
  // «Ver perfil»: el rincón ya cargado se reutiliza (ni una consulta más a su rincón) y se pinta sin «Abriendo…»
  const corners = [];
  page.on('request', (r) => r.url().includes('/rest/v1/corners') && corners.push(r.url()));
  await visit.getByRole('button', { name: 'Ver el perfil de Bruno' }).click();
  await expect(page.locator('.reader-profile')).toBeVisible();
  await expect(page.getByText('Abriendo su rincón…')).toHaveCount(0);
  expect(corners).toEqual([]);
  await page.waitForTimeout(500);
  await shot(page, info, 'v159-perfil-desde-visita');
});

test('lectores que sigo: mientras llega el nombre no aparece un «Lector» genérico', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390 en Chromium y WebKit');
  const mock = seed();
  // Los perfiles tardan en llegar
  let release;
  const gate = new Promise((r) => (release = r));
  await mock.attach(page, ANA);
  await page.route(`${SUPABASE}/rest/v1/profiles*`, async (route) => {
    if (route.request().url().includes('in.')) await gate;
    await route.fallback();
  });
  await page.addInitScript(() => {
    history.replaceState({ bookshelf: { loc: { view: 'room', panel: { type: 'social', tab: 'lectores' } }, depth: 0, parent: null } }, '');
  });
  await page.goto('/');
  const readers = page.getByRole('region', { name: 'Lectores que sigo' });
  await expect(readers).toBeVisible();
  await expect(readers.locator('.follow-row__name--loading')).toHaveCount(1);
  await expect(readers.getByText('Lector', { exact: true })).toHaveCount(0);
  release();
  await expect(readers.locator('.reader-person__name')).toHaveText('Bruno');
  await expect(readers.locator('.follow-row__name--loading')).toHaveCount(0);
});
