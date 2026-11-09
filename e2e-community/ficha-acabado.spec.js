// Acabado de la ficha y del registro: capturas a 390 px y flujo de registrar y deshacer, con datos sintéticos.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const DIR = join('qa-report', 'ficha-acabado', process.env.FICHA_ETAPA ?? 'despues');
mkdirSync(DIR, { recursive: true });
const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const SALA = {
  v: 1,
  pared: 'yeso',
  suelo: 'tablas',
  items: [
    { uid: 1, id: 'sillon', tono: 1, x: 4, y: 6, rot: 2 },
    { uid: 2, id: 'estanteria', x: 2, y: 0, rot: 0, tono: 0 },
  ],
};
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="540"><rect width="360" height="540" fill="#3b6b8a"/><rect x="24" y="24" width="312" height="492" fill="none" stroke="#f4e6c8" stroke-width="6"/><text x="180" y="280" fill="#f4e6c8" font-family="serif" font-size="46" text-anchor="middle">Prueba</text></svg>';
const libro = (id, extra) => ({
  id,
  title: `Libro de prueba ${id}`,
  author: 'Autoría de prueba',
  status: 'reading',
  pageCount: 420,
  currentPage: 184,
  cover: `https://covers.openlibrary.org/b/id/${id === 'lleno' ? 501 : 502}-M.jpg`,
  addedAt: '2026-10-01T10:00:00.000Z',
  synopsis: 'Sinopsis de prueba para comprobar el apartado desplegable.',
  categories: ['Fantasía'],
  quotes: [],
  ...extra,
});
const sesion = (id, date, from, to) => ({ id, bookId: 'lleno', date, createdAt: `${date}T10:00:00.000Z`, kind: 'read', unit: 'pages', mode: 'added', from, to, pages: to - from, delta: to - from, total: 420, active: true, source: 'form' });
const DATOS = {
  version: 8,
  books: [
    libro('lleno', {
      review: 'Una historia que se queda contigo mucho después de cerrarla.',
      rating: 4,
      quotes: [
        { id: 'q1', text: 'Una frase de prueba que merece quedarse subrayada para siempre.', page: 120, color: 'yellow', createdAt: '2026-10-20T10:00:00.000Z' },
        { id: 'q2', text: 'Otra nota más breve.', page: 150, color: 'blue', createdAt: '2026-10-21T10:00:00.000Z' },
      ],
    }),
    libro('vacio'),
  ],
  settings: { sound: false, sfx: false, onboardingDone: true },
  progress: { readingLog: [sesion('s1', '2026-10-20', 100, 150), sesion('s2', '2026-10-21', 150, 184)], pomodoros: [], claimed: {} },
};

async function abrir(browser, { w = 390, h = 844, webkit = false } = {}) {
  const context = await browser.newContext({ baseURL: 'http://localhost:5196', locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: w, height: h }, deviceScaleFactor: 2, ...(webkit ? {} : { isMobile: true, hasTouch: true }) });
  const page = await context.newPage();
  await page.route(/covers\.openlibrary\.org/, (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: svg }));
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana de prueba', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout: SALA });
  mock.db.libraries.push({ user_id: ANA.id, data: DATOS, updated_at: new Date().toISOString(), version: 5 });
  await page.addInitScript((datos) => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!localStorage.getItem('bookshelf:v1')) localStorage.setItem('bookshelf:v1', JSON.stringify(datos));
  }, DATOS);
  await mock.attach(page, ANA);
  await entrar(page);
  return { context, page };
}
async function entrar(page) {
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(800);
}
async function ficha(page, id) {
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('button', { name: 'Mi biblioteca', exact: true }).click();
  await expect(page.locator('.plab-library')).toBeVisible();
  await page.waitForTimeout(400);
  await page.locator(`.lit-libro[data-book="${id}"]`).click();
  await expect(page.locator('.lit-ficha')).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(500);
}
const pestana = (page, name) => page.getByRole('tab', { name, exact: true });
const foto = (page, nombre) => page.screenshot({ path: join(DIR, `${nombre}.png`) });
const guardado = (page) =>
  page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('bookshelf:v1'));
    return { pagina: d.books.find((b) => b.id === 'lleno').currentPage, sesiones: d.progress.readingLog.length };
  });
/** Controles visibles por debajo de 44 px y textos por debajo de 14 px dentro de la ficha. */
const medir = (page) =>
  page.locator('.lit-ficha__cuerpo').evaluate((raiz) => {
    const visible = (n) => n.getClientRects().length > 0;
    const chicos = [...raiz.querySelectorAll('button, select, summary, textarea, input:not([type="range"], [type="checkbox"], [type="file"])')].filter(visible).filter((n) => n.getBoundingClientRect().height < 43.5 || n.getBoundingClientRect().width < 43.5);
    const letra = [...raiz.querySelectorAll('p, span, small, label, li, button, summary, input, textarea, select, dd, dt')].filter(visible).filter((n) => n.childNodes.length && [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())).filter((n) => parseFloat(getComputedStyle(n).fontSize) < 14);
    const nombre = (n) => `${n.tagName.toLowerCase()}.${String(n.className).split(' ')[0]}:${(n.textContent || n.getAttribute('aria-label') || '').trim().slice(0, 24)}`;
    return { chicos: chicos.map(nombre), letra: letra.map(nombre), ancho: raiz.scrollWidth <= raiz.clientWidth };
  });

for (const tema of ['dia', 'noche']) {
  test(`capturas a 390 px · ${tema}`, async ({ browser }, info) => {
    test.skip(info.project.name !== 'chromium-390x844');
    test.setTimeout(150000);
    const { context, page } = await abrir(browser, { h: 1500 });
    if (tema === 'noche') await page.evaluate(() => { document.documentElement.dataset.uiTheme = 'noche'; });
    await ficha(page, 'lleno');
    const f = page.locator('.lit-ficha');
    await f.getByRole('button', { name: 'Registrar lectura' }).click();
    await f.locator('.reading-form input[inputmode]').first().fill('12');
    await page.waitForTimeout(250);
    await foto(page, `${tema}-formulario`);
    const formulario = await medir(page);
    await f.getByRole('button', { name: 'Cancelar' }).click();
    await page.waitForTimeout(200);
    await foto(page, `${tema}-lectura`);
    for (const s of await f.locator('[role="tabpanel"]:not([hidden]) details > summary').all()) {
      await s.click();
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(250);
    await foto(page, `${tema}-lectura-herramientas`);
    const lectura = await medir(page);
    await pestana(page, 'Notas y citas').click();
    await page.waitForTimeout(250);
    await foto(page, `${tema}-notas`);
    const notas = await medir(page);
    await pestana(page, 'Reseña').click();
    await page.waitForTimeout(250);
    await foto(page, `${tema}-resena`);
    const resena = await medir(page);
    await f.getByRole('button', { name: 'Volver', exact: true }).click();
    await expect(page.locator('.lit-ficha')).toBeHidden();
    await page.waitForTimeout(400);
    await page.locator('.lit-libro[data-book="vacio"]').click();
    await expect(page.locator('.lit-ficha')).toBeVisible({ timeout: 8000 });
    await pestana(page, 'Notas y citas').click();
    await page.waitForTimeout(250);
    await foto(page, `${tema}-notas-vacio`);
    await page.locator('.journal__empty button').click();
    await page.waitForTimeout(250);
    await foto(page, `${tema}-notas-formulario`);
    const notasForm = await medir(page);
    await pestana(page, 'Reseña').click();
    await page.waitForTimeout(250);
    await foto(page, `${tema}-resena-vacio`);
    console.log(JSON.stringify({ tema, formulario, lectura, notas, resena, notasForm }));
    for (const m of [formulario, lectura, notas, resena, notasForm]) expect(m.ancho).toBe(true);
    await context.close();
  });
}

test('registrar y deshacer: progreso y sesión vuelven, también tras recargar', async ({ browser }, info) => {
  test.setTimeout(120000);
  const { context, page } = await abrir(browser, { webkit: info.project.name.startsWith('webkit') });
  await ficha(page, 'lleno');
  const f = page.locator('.lit-ficha');
  const inicio = await guardado(page);
  expect(inicio).toEqual({ pagina: 184, sesiones: 2 });
  await f.getByRole('button', { name: 'Registrar lectura' }).click();
  await f.getByRole('radio', { name: /Páginas leídas|He leído/ }).click();
  await f.locator('.reading-form input[inputmode]').first().fill('12');
  await f.getByRole('button', { name: 'Guardar lectura' }).click();
  const aviso = f.locator('.log-toast');
  await expect(aviso).toBeVisible({ timeout: 5000 });
  await foto(page, `${info.project.name}-aviso-deshacer`);
  await expect.poll(() => guardado(page)).toEqual({ pagina: 196, sesiones: 3 });
  await aviso.getByRole('button', { name: 'Deshacer' }).click();
  await expect(f.getByText('Registro deshecho: el progreso vuelve a como estaba.')).toBeVisible();
  await expect.poll(() => guardado(page)).toEqual(inicio);
  await entrar(page);
  await expect.poll(() => guardado(page)).toEqual(inicio);
  await context.close();
});
