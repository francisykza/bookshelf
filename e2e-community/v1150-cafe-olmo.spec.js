// 1.150 · Olmo, el búho librero (Francisco, 26-11-2026: «el personaje de suscriptor que sustituye a Pilar… que sea muy
// característico y atractivo para el público»), con Supabase simulado. Una cuenta de pruebas (con jornada de prueba, como las
// de `cafe_probadores`) lo ve en vista previa: detrás de la barra, en 3D y vivo; su nombre en el letrero, su retrato y su voz
// en la franja; una frase suya cada vez que le tocas, y preparando la taza con las alas. Una cuenta normal sigue con Pilar.
// Capturas en qa-report/v1150/; con OLMO_VIDEO=1, el vídeo en qa-report/v1150/video/.
import { expect, test } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { pideLibro } from './cafeLibro';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { generoDe, nombreOpcion } from '../src/features/edificio/cafe/cafeClientes';
import { ELIGE, ETAPAS, gestosDe } from '../src/features/edificio/cafe/cafeGestos';
import { FRASES_OLMO } from '../src/features/edificio/cafe/cafePersonaje';
import { MOMENTO_OLMO, poseOlmoAlHablar } from '../src/features/edificio/cafe/olmoPoses';
import { dayKey } from '../src/domain/dates';
import { alEdificio } from './entrada';

const DIR = join('qa-report', 'v1150');
const DIR156 = join('qa-report', 'v1156');
const tam = (info) => info.project.name.replace(/^chromium-/, '');
const libro = (id, title, extra = {}) => ({
  id,
  title,
  author: `Autoría ${id}`,
  status: 'read',
  pageCount: 320,
  currentPage: 320,
  cover: '',
  categories: [],
  publishedDate: '2012',
  addedAt: '2026-10-01T10:00:00.000Z',
  finishedAt: '2026-10-20T10:00:00.000Z',
  quotes: [],
  ...extra,
});
const LIBROS = [
  libro('f', 'El dragón del muelle', { categories: ['Fantasy'], pageCount: 540 }),
  libro('m', 'Crimen en la lonja', { categories: ['Mystery'], pageCount: 280 }),
  libro('a', 'Cartas de amor al puerto', { categories: ['Romance'], pageCount: 190 }),
  libro('c', 'Cuentos del tranvía', { pageCount: 120 }),
];
const BALDA = { bienvenida: true, libros: LIBROS.map((b) => ({ clave: b.id, titulo: b.title, genero: generoDe(b), caja: 0, balda: 1 })) };
const JORNADA = '3000-01-01';
const RECETA = ['cafe', 'intenso', 'entera', 'canela'];
const ELIGE_DE = { bebida: 0, grano: 1, leche: 2, toque: 3 };
// Delante de la barra, mirando a Olmo (en x 8,75, y 5,6), y un poco de lado
const DE_FRENTE = [6.35, 5.6, Math.PI / 2];
const DE_LADO = [6.95, 4.35, Math.atan2(8.75 - 6.95, 5.6 - 4.35)];

async function alCafe(page, { previa = true, reduced = true } = {}) {
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 120, sin_raro: 3 } },
    piso_inventario: { [ANA.id]: { sillon: 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.libraries.push({ user_id: ANA.id, data: { books: LIBROS }, updated_at: new Date().toISOString(), version: 5 });
  if (!reduced) await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript((books) => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!localStorage.getItem('bookshelf:v1')) localStorage.setItem('bookshelf:v1', JSON.stringify({ books, progress: { readingLog: [], pomodoros: [], claimed: {} } }));
  }, LIBROS);
  await mock.attach(page, ANA);
  await simularCafe(
    page,
    { inaugurado: true, nombre: 'Taza y Lomo', granos: 0, plano: structuredClone(PLANO_INICIAL), inventario: cuenta(PLANO_INICIAL), libros: BALDA, dominio: { cafe: 12, te: 12 } },
    { clientes: { hoy: dayKey(), semillas: [2100, 1000, 8919], quienes: [3], frases: [10], vendidos: [], ...(previa ? { jornada: JORNADA } : {}) } },
  );
  await page.goto('/');
  await alEdificio(page);
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' }).click({ timeout: 15000 });
  const cafe = page.getByRole('dialog', { name: 'El café-librería del bajo' });
  await expect(cafe.locator('.cf3[data-ready="true"]')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__cafe3d?.settled() && window.__cafe3d.renders() > 0);
  return cafe;
}

const ponerse = async (page, [x, y, yaw]) => {
  await page.evaluate(([x, y, yaw]) => window.__cafe3d.place(x, y, yaw), [x, y, yaw]);
  await page.waitForFunction(() => window.__cafe3d.settled());
  await page.waitForTimeout(300);
};

test('la cuenta de pruebas ve a Olmo detrás de la barra, con su nombre, su retrato y su voz', async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844|1440x900)$/.test(info.project.name), '360, 390 y escritorio');
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cafe = await alCafe(page);
  await page.waitForFunction(() => window.__cafe3d.anfitrion() === 'olmo');
  const franja = cafe.locator('.cf3-franja');
  await expect(franja).toHaveAttribute('aria-label', 'Olmo, en el mostrador');
  await expect(franja.locator('.cf3-quien')).toHaveText('Olmo');
  await expect(franja.locator('.cf3-retrato')).toHaveAttribute('data-quien', 'olmo');
  await expect(cafe.locator('.cf3-tag', { hasText: /^Olmo/ })).toHaveCount(1);
  await expect(cafe.locator('.cf3-tag', { hasText: /^Pilar/ })).toHaveCount(0);
  await ponerse(page, DE_FRENTE);
  await page.screenshot({ path: join(DIR, `01-olmo-barra-${tam(info)}.png`) });
  await ponerse(page, DE_LADO);
  await page.screenshot({ path: join(DIR, `02-olmo-de-lado-${tam(info)}.png`) });
  // Le tocas: se acerca y dice una frase suya; otra vez, la siguiente
  await cafe.locator('.cf3-tag', { hasText: /^Olmo/ }).click();
  await expect(franja.locator('.cf3-dice')).toContainText(FRASES_OLMO[0]);
  await page.waitForFunction(() => window.__cafe3d.settled());
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(DIR, `03-olmo-habla-${tam(info)}.png`) });
  await cafe.locator('.cf3-tag', { hasText: /^Olmo/ }).click();
  await expect(franja.locator('.cf3-dice')).toContainText(FRASES_OLMO[1]);
  // Sin precios de suscriptor: la vista previa solo cambia quién atiende
  expect(await page.evaluate(() => document.querySelector('.cf3')?.dataset.abierto)).toBe('true');
  expect(errors).toEqual([]);
});

test('Olmo prepara la taza con las alas, con su voz', async ({ page }, info) => {
  test.skip(!/^chromium-(390x844|1440x900)$/.test(info.project.name), '390 y escritorio');
  test.setTimeout(180000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cafe = await alCafe(page);
  const caja = cafe.locator('.cf3-franja--atender');
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  await pideLibro(cafe);
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await page.waitForFunction(() => window.__cafe3d.enBarra());
  let fotos = 0;
  for (const etapa of ETAPAS) {
    await expect(caja).toHaveAttribute('data-etapa', etapa, { timeout: 8000 });
    if (ELIGE[etapa]) {
      await cafe
        .locator('.cf3-opciones')
        .getByRole('button', { name: nombreOpcion(etapa, RECETA[ELIGE_DE[etapa]]), exact: true })
        .click();
      if (etapa === 'bebida') {
        const oferta = cafe.locator('.cf3-pilar');
        await expect(oferta).toBeVisible();
        await expect(oferta).toHaveAttribute('aria-label', 'Olmo te ofrece prepararla');
        await expect(oferta).toContainText('Esto ya lo dominas');
        await expect(oferta.locator('img.cf3-px--pose')).toHaveAttribute('data-pose', MOMENTO_OLMO.ofrece);
        await page.screenshot({ path: join(DIR, `04-olmo-ofrece-${tam(info)}.png`) });
        await oferta.getByRole('button', { name: 'Que lo prepare Olmo' }).click();
        await expect(caja).toHaveAttribute('data-pilar', 'pilar');
      }
    }
    const r = { bebida: RECETA[0], grano: RECETA[1], leche: RECETA[2], toque: RECETA[3] };
    for (const tipo of gestosDe(etapa, r)) {
      const visto = await page
        .waitForFunction(
          (t) => {
            const c = document.querySelector('.cf3-franja--atender');
            return c?.dataset.gesto === t && c.dataset.pilarAhora === 'true' && Number(c.dataset.progreso) >= 35;
          },
          tipo,
          { polling: 'raf', timeout: 5000 },
        )
        .then(() => true)
        .catch(() => false);
      if (!visto || fotos >= 3) continue;
      await expect(caja).toContainText('esto lo tengo bajo el ala');
      await expect(caja.locator('img.cf3-px--pose').first()).toHaveAttribute('data-pose', MOMENTO_OLMO.prepara);
      await page.screenshot({ path: join(DIR, `05-olmo-prepara-${tipo}-${tam(info)}.png`) });
      fotos += 1;
    }
  }
  await expect(caja).toHaveAttribute('data-etapa', 'lista', { timeout: 8000 });
  expect(fotos).toBeGreaterThanOrEqual(2);
  expect(errors).toEqual([]);
});

test('una cuenta normal sigue con Pilar', async ({ page }, info) => {
  test.skip(!/^chromium-390x844$/.test(info.project.name), 'Chromium 390');
  test.setTimeout(90000);
  const cafe = await alCafe(page, { previa: false });
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__cafe3d.anfitrion())).toBe('pilar');
  await expect(cafe.locator('.cf3-franja .cf3-quien')).toHaveText('Pilar');
  await expect(cafe.locator('.cf3-tag', { hasText: /^Pilar/ })).toHaveCount(1);
});

test('vídeo: Olmo, vivo detrás de la barra', async ({ browser }, info) => {
  test.skip(!process.env.OLMO_VIDEO || !/^chromium-390x844$/.test(info.project.name), 'solo con OLMO_VIDEO=1');
  test.setTimeout(300000);
  const bruto = join(DIR, 'bruto');
  const dir = join(DIR, 'video');
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ ...info.project.use, recordVideo: { dir: bruto, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const cafe = await alCafe(page, { reduced: false });
  await page.waitForFunction(() => window.__cafe3d.anfitrion() === 'olmo');
  // Un paseo lento hasta ponerse delante de él
  const de = DE_LADO;
  const a = DE_FRENTE;
  for (let i = 1; i <= 90; i += 1) {
    const t = i / 90;
    const s = t * t * (3 - 2 * t);
    await page.evaluate(([x, y, yaw]) => window.__cafe3d.place(x, y, yaw), [de[0] + (a[0] - de[0]) * s, de[1] + (a[1] - de[1]) * s, de[2] + (a[2] - de[2]) * s]);
    await page.waitForTimeout(33);
  }
  // Un ciclo entero suyo (15 s): respira, parpadea, mira a un lado, ladea la cabeza, se ahueca y mira al otro
  await page.waitForTimeout(15500);
  // Y le tocas tres veces: tres frases suyas
  for (let k = 0; k < 3; k += 1) {
    await cafe.locator('.cf3-tag', { hasText: /^Olmo/ }).click();
    await page.waitForTimeout(3200);
  }
  const video = page.video();
  await context.close();
  copyFileSync(await video.path(), join(dir, '1150-olmo.webm'));
});

// 1.156 · Las poses que dibujó Francisco (27-11-2026, «Igualar el 3D al dibujo»): en la franja, de pie con su libro; al tocarle,
// la pose de cada frase; con muchos toques seguidos, mareado; sin tocar nada, primero lee y después se duerme. Y el 3D, el mismo
// Olmo que el de la hoja (bufanda a rayas roja y verde, gafas naranjas, sin chaleco).
const poseFranja = (cafe) => cafe.locator('.cf3-franja .cf3-retrato img.cf3-px--pose');

test('1.156: Olmo en la franja con las poses de su hoja', async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844|1440x900)$/.test(info.project.name), '360, 390 y escritorio');
  test.setTimeout(150000);
  mkdirSync(DIR156, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cafe = await alCafe(page, { reduced: false });
  await page.waitForFunction(() => window.__cafe3d.anfitrion() === 'olmo');
  await expect(poseFranja(cafe)).toHaveAttribute('data-pose', 'libro');
  await expect.poll(() => poseFranja(cafe).evaluate((img) => img.complete && img.naturalWidth)).toBe(311);
  // El Olmo 3D, de frente y de lado, con los colores de la hoja
  await ponerse(page, DE_FRENTE);
  await page.screenshot({ path: join(DIR156, `01-olmo-3d-de-frente-${tam(info)}.png`) });
  await ponerse(page, DE_LADO);
  await page.screenshot({ path: join(DIR156, `02-olmo-3d-de-lado-${tam(info)}.png`) });
  await ponerse(page, DE_FRENTE);
  // Le tocas: cada frase, su pose
  const tag = cafe.locator('.cf3-tag', { hasText: /^Olmo/ });
  await tag.click();
  await expect(cafe.locator('.cf3-franja .cf3-dice')).toContainText(FRASES_OLMO[0]);
  await expect(poseFranja(cafe)).toHaveAttribute('data-pose', poseOlmoAlHablar(0));
  await page.waitForFunction(() => window.__cafe3d.settled());
  await page.screenshot({ path: join(DIR156, `03-franja-habla-${tam(info)}.png`) });
  await page.waitForTimeout(1200);
  await tag.click();
  await expect(cafe.locator('.cf3-franja .cf3-dice')).toContainText(FRASES_OLMO[1]);
  await expect(poseFranja(cafe)).toHaveAttribute('data-pose', poseOlmoAlHablar(1));
  // Muchos toques seguidos: se marea un momento y vuelve a lo suyo
  await page.waitForTimeout(2100);
  for (let k = 0; k < 4; k += 1) await tag.click();
  await expect(poseFranja(cafe)).toHaveAttribute('data-pose', 'mareado');
  await page.screenshot({ path: join(DIR156, `04-franja-mareado-${tam(info)}.png`) });
  await expect(poseFranja(cafe)).not.toHaveAttribute('data-pose', 'mareado', { timeout: 5000 });
  expect(errors).toEqual([]);
});

test('1.156: sin tocar nada, Olmo se pone a leer y después se duerme; un toque le despierta', async ({ page }, info) => {
  test.skip(!/^chromium-(390x844|1440x900)$/.test(info.project.name), '390 y escritorio');
  test.setTimeout(150000);
  mkdirSync(DIR156, { recursive: true });
  const cafe = await alCafe(page, { reduced: false });
  await page.waitForFunction(() => window.__cafe3d.anfitrion() === 'olmo');
  await expect(poseFranja(cafe)).toHaveAttribute('data-pose', 'libro');
  // El reloj de la página corre deprisa
  await page.clock.install();
  await page.clock.fastForward(33000);
  await expect.poll(() => poseFranja(cafe).getAttribute('data-pose'), { timeout: 10000 }).toBe('lee');
  await page.screenshot({ path: join(DIR156, `05-franja-lee-${tam(info)}.png`) });
  await page.clock.fastForward(65000);
  await expect.poll(() => poseFranja(cafe).getAttribute('data-pose'), { timeout: 10000 }).toBe('duerme');
  await page.screenshot({ path: join(DIR156, `06-franja-duerme-${tam(info)}.png`) });
  await page.keyboard.press('Shift');
  await expect.poll(() => poseFranja(cafe).getAttribute('data-pose'), { timeout: 10000 }).toBe('libro');
});

test('1.156: con movimiento reducido, Olmo no cambia solo', async ({ page }, info) => {
  test.skip(!/^chromium-390x844$/.test(info.project.name), 'Chromium 390');
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const cafe = await alCafe(page);
  await page.waitForFunction(() => window.__cafe3d.anfitrion() === 'olmo');
  await page.clock.install();
  await page.clock.fastForward(100000);
  await page.waitForTimeout(3500);
  await expect(poseFranja(cafe)).toHaveAttribute('data-pose', 'libro');
});
