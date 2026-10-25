// QA de la fase IA-1 (SPEC §18): estantería visible antes del análisis de portadas, bibliotecario local sin
// conexión, ninguna petición a proveedores de IA, ambiente del libro con su preferencia y sin pérdida de datos.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const run = { project: '', tests: {}, pageErrors: [], aiRequests: [], data: {}, screenshots: [] };
const AI_HOSTS = /openrouter|groq|openai|anthropic|generativelanguage|huggingface/i;

test.beforeEach(async ({ page }, info) => {
  run.project = info.project.name;
  page.on('pageerror', (err) => run.pageErrors.push({ test: info.title, text: String(err) }));
  page.on('request', (req) => {
    if (AI_HOSTS.test(new URL(req.url()).hostname)) run.aiRequests.push({ test: info.title, url: req.url() });
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('bookshelf_onboarding_done', 'true');
    } catch {
      // sin almacenamiento
    }
  });
});
test.afterEach(async ({ page: _page }, info) => {
  run.tests[info.title] = { status: info.status, error: info.error?.message?.split('\n')[0] ?? null };
});
test.afterAll(async ({ browserName: _b }, info) => {
  const dir = join('qa-report', 'telemetry');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${run.project}-ia1-w${info.workerIndex}.json`), JSON.stringify(run, null, 2));
});

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.png`);
  await page.screenshot({ path: file });
  run.screenshots.push(file.replaceAll('\\', '/'));
}

const openShelf = async (page) => {
  await page.addInitScript(() => {
    history.replaceState({ bookshelf: { loc: { view: 'shelf', panel: null }, depth: 0, parent: null } }, '');
  });
  await page.goto('/');
  await expect(page.locator('.sanctuary')).toHaveAttribute('data-phase', 'shelf');
};

test('la estantería se ve con sus colores deterministas antes de analizar portadas', async ({ page }, info) => {
  // Portadas muy lentas: el análisis (y la imagen) llegan tarde, la estantería no espera
  await page.route(/covers\.openlibrary\.org|books\.google/, async (route) => {
    await new Promise((r) => setTimeout(r, 4000));
    await route.continue().catch(() => {});
  });
  const t0 = Date.now();
  await openShelf(page);
  await expect(page.locator('.book3d, .spine').first()).toBeVisible();
  const elapsed = Date.now() - t0;
  const spines = await page.locator('.book3d, .spine').evaluateAll((els) => els.slice(0, 6).map((el) => ({ spine: el.style.getPropertyValue('--spine'), material: el.dataset.material })));
  run.data.shelf = { elapsed, spines };
  expect(spines.every((s) => /^#[0-9a-f]{6}$/i.test(s.spine))).toBe(true);
  expect(spines.every((s) => ['leather', 'cloth', 'paper', 'metallic'].includes(s.material))).toBe(true);
  await shot(page, info, 'ia1-estanteria');
});

test('recomendación local sin conexión, sin IA remota y sin tocar los datos', async ({ page, context }, info) => {
  await openShelf(page);
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  const before = await page.evaluate(() => localStorage.getItem('bookshelf:v1'));
  const requests = [];
  // Lo que cuenta es si el motor pide datos: fetch, XHR, websockets o eventos (las <img> de portada no son suyas)
  page.on('request', (req) => {
    if (['fetch', 'xhr', 'websocket', 'eventsource'].includes(req.resourceType())) requests.push(req.url());
  });
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Pedir una recomendación' }).click();
  const input = page.getByLabel('¿Qué te apetece leer?');
  await expect(input).toBeVisible();
  await input.fill('algo de fantasía, sin terror');
  await input.press('Enter');
  const result = page.locator('.librarian__result');
  await expect(result.locator('.librarian__whisper')).toBeVisible();
  const ids = await result.locator('.librarian__books li').count();
  const whisper = await result.locator('.librarian__whisper').textContent();
  run.data.recommendation = { ids, whisper, dataRequestsWhileOffline: requests };
  expect(ids).toBeGreaterThan(0);
  expect(ids).toBeLessThanOrEqual(2);
  expect(whisper.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(20);
  await expect(result).toContainText('Recomendación local por reglas · sin IA');
  // El bibliotecario no pide nada a la red
  expect(requests).toEqual([]);
  await shot(page, info, 'ia1-recomendacion');
  // Abrir la ficha desde el resultado
  await result.locator('.librarian__books li button').first().click();
  await expect(page.locator('.book-sheet')).toBeVisible();
  await context.setOffline(false);
  // Sin pérdida ni reinicio de datos
  const after = await page.evaluate(() => localStorage.getItem('bookshelf:v1'));
  expect(JSON.parse(after).books.map((b) => b.id)).toEqual(JSON.parse(before).books.map((b) => b.id));
  expect(JSON.parse(after).progress.readingLog.length).toBe(JSON.parse(before).progress.readingLog.length);
  expect(run.aiRequests).toEqual([]);
});

test('el panel de recomendaciones es usable en móvil y con teclado', async ({ page }) => {
  await openShelf(page);
  await page.getByRole('button', { name: 'Pedir una recomendación' }).click();
  const input = page.getByLabel('¿Qué te apetece leer?');
  const metrics = await page.evaluate(() => {
    const i = document.querySelector('.librarian__form input');
    // Alto de layout (el panel entra con una escala breve: el rectángulo transformado mide menos mientras dura)
    const btn = document.querySelector('.librarian__form .stamp-btn');
    const p = document.querySelector('.librarian').getBoundingClientRect();
    return { font: parseFloat(getComputedStyle(i).fontSize), btnH: btn.offsetHeight, inside: p.left >= 0 && p.right <= innerWidth, overflowX: document.documentElement.scrollWidth - innerWidth };
  });
  run.data.mobile = metrics;
  expect(metrics.font).toBeGreaterThanOrEqual(16);
  expect(metrics.btnH).toBeGreaterThanOrEqual(44);
  expect(metrics.inside).toBe(true);
  expect(metrics.overflowX).toBeLessThanOrEqual(0);
  // Petición no reconocida: invita a probar algo sencillo, sin resultados inventados
  await input.fill('xyzzy');
  await input.press('Enter');
  await expect(page.locator('.librarian__whisper')).toContainText('Prueba');
  await expect(page.locator('.librarian__books')).toHaveCount(0);
});

test('el ambiente sigue al libro actual y se puede desactivar', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  // Circe (Fantasía, Mitología) es la lectura actual de la biblioteca de ejemplo
  await expect(page.locator('.tod')).toHaveAttribute('data-vibe', 'fantasy');
  expect(await page.locator('.tod').evaluate((el) => el.style.getPropertyValue('--vibe-light'))).toBe('#E7BD79');
  // Preferencia manual: desactivado, sin tono
  await page.locator('.corner-btn--cloud').click();
  await page.getByLabel(/Teñir la luz de la habitación/).uncheck();
  await page.keyboard.press('Escape');
  await expect(page.locator('.tod')).not.toHaveAttribute('data-vibe', /.+/);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1') ?? '{}').settings?.bookVibe)).toBe(false);
});
