// 1.131 (Francisco, 14-11-2026: «quiero que cuando pilar prepara el café ella se haga más orgánico y no tan robótico») ·
// Evidencias: Pilar prepara un café (molinillo, apisonar, palanca, vapor, verter y canela) y un té (cuchara, tetera, colador,
// vapor, verter y miel) con sus manos en la barra, cada gesto fotografiado a media marcha, y el vídeo del recorrido entero
// (con el libro de cada cliente, de cerca). Capturas y vídeo en qa-report/v1131/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { despedir } from './cafeBarra';
import { hacerLibro, pideLibro } from './cafeLibro';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { generoDe, nombreOpcion } from '../src/features/edificio/cafe/cafeClientes';
import { ELIGE, ETAPAS, gestosDe } from '../src/features/edificio/cafe/cafeGestos';
import { dayKey } from '../src/domain/dates';
import { alEdificio } from './entrada';

const DIR = join('qa-report', 'v1131');
const tam = (info) => info.project.name.replace(/^(chromium|webkit)-/, '$1-');
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
  libro('f2', 'La bruja del faro', { categories: ['Fantasy'], pageCount: 210 }),
  libro('m', 'Crimen en la lonja', { categories: ['Mystery'], pageCount: 280 }),
  libro('m2', 'El caso del ancla', { categories: ['Mystery'], pageCount: 460 }),
  libro('a', 'Cartas de amor al puerto', { categories: ['Romance'], pageCount: 190 }),
  libro('c', 'Cuentos del tranvía', { pageCount: 120 }),
  libro('t', 'La gran saga del mar', { pageCount: 900 }),
];
const BALDA = { bienvenida: true, libros: LIBROS.map((b) => ({ clave: b.id, titulo: b.title, genero: generoDe(b), caja: 0, balda: 1 })) };
const SEMILLAS = [2100, 1000, 8919];
/** Lo que se prepara (no hace falta que sea lo que pide: aquí se miran los gestos de Pilar). */
const RECETAS = { cafe: ['cafe', 'intenso', 'entera', 'canela'], te: ['te', 'suave', 'avena', 'miel'] };
const ELIGE_DE = { bebida: 0, grano: 1, leche: 2, toque: 3 };
const BOTON = (parte, valor, receta) => (parte === 'grano' && receta[0] === 'te' ? (valor === 'suave' ? 'Hoja verde · suave' : 'Hoja negra · intensa') : nombreOpcion(parte, valor));

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

async function alCafe(page) {
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 120, sin_raro: 3 } },
    piso_inventario: { [ANA.id]: { sillon: 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.libraries.push({ user_id: ANA.id, data: { books: LIBROS }, updated_at: new Date().toISOString(), version: 5 });
  await page.addInitScript((books) => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!localStorage.getItem('bookshelf:v1')) localStorage.setItem('bookshelf:v1', JSON.stringify({ books, progress: { readingLog: [], pomodoros: [], claimed: {} } }));
  }, LIBROS);
  await mock.attach(page, ANA);
  await simularCafe(
    page,
    { inaugurado: true, nombre: 'Taza y Lomo', granos: 0, plano: structuredClone(PLANO_INICIAL), inventario: cuenta(PLANO_INICIAL), libros: BALDA, dominio: { cafe: 12, te: 12 } },
    { clientes: { hoy: dayKey(), semillas: SEMILLAS, quienes: [3], frases: [10], vendidos: [] } },
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

/** Pilar prepara `receta`: se elige cada parte y se fotografía cada gesto suyo hacia la mitad. Devuelve los fotografiados. */
async function conPilar(page, cafe, receta, info, pre) {
  const caja = cafe.locator('.cf3-franja--atender');
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await page.waitForFunction(() => window.__cafe3d.enBarra());
  const fotos = [];
  for (const etapa of ETAPAS) {
    await expect(caja).toHaveAttribute('data-etapa', etapa, { timeout: 8000 });
    if (ELIGE[etapa]) {
      const k = ELIGE_DE[etapa];
      await cafe.locator('.cf3-opciones').getByRole('button', { name: BOTON(etapa, receta[k], receta), exact: true }).click();
      if (etapa === 'bebida') {
        const oferta = cafe.locator('.cf3-pilar');
        if (await oferta.isVisible().catch(() => false)) await oferta.getByRole('button', { name: 'Que lo prepare Pilar' }).click();
        await expect(caja).toHaveAttribute('data-pilar', 'pilar');
      }
    }
    const r = { bebida: receta[0], grano: receta[1], leche: receta[2], toque: receta[3] };
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
      if (!visto) continue;
      await page.screenshot({ path: join(DIR, `${pre}-${tipo}-${tam(info)}.png`) });
      fotos.push(tipo);
    }
  }
  await expect(caja).toHaveAttribute('data-etapa', 'lista', { timeout: 8000 });
  expect(await caja.getAttribute('data-receta')).toBe(receta.join());
  await cafe.getByRole('button', { name: 'Llevársela' }).click();
  return fotos;
}

test('Pilar prepara con sus manos, sin ritmo de máquina, y el libro, de cerca', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'Chromium 390');
  test.setTimeout(240000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cafe = await alCafe(page);
  const caja = cafe.locator('.cf3-franja--atender');

  // Un café: el molinillo, el prensador, la palanca, la lanza de vapor, la jarra y la canela
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  await pideLibro(cafe);
  const f1 = await conPilar(page, cafe, RECETAS.cafe, info, 'pilar-cafe');
  // Al menos la mitad de sus gestos, fotografiados en marcha (duran menos de medio segundo)
  expect(f1.length).toBeGreaterThanOrEqual(3);
  await expect(caja).toHaveAttribute('data-paso', 'libreria');
  await hacerLibro(page, cafe, { foto: (n) => page.screenshot({ path: join(DIR, `libro1-${n}-${tam(info)}.png`) }) });
  await expect(caja).toHaveAttribute('data-paso', 'gracias', { timeout: 20000 });
  await despedir(page, cafe);

  // Un té: la cuchara, la tetera, el colador, el vapor, la jarra y la miel
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  await pideLibro(cafe);
  const f2 = await conPilar(page, cafe, RECETAS.te, info, 'pilar-te');
  expect(f2.length).toBeGreaterThanOrEqual(3);
  await hacerLibro(page, cafe, { foto: (n) => page.screenshot({ path: join(DIR, `libro2-${n}-${tam(info)}.png`) }) });
  await expect(caja).toHaveAttribute('data-paso', 'gracias', { timeout: 20000 });
  await despedir(page, cafe);

  expect(errors).toEqual([]);
  const video = page.video();
  await page.close();
  if (video) await video.saveAs(join(DIR, `pilar-y-libro-${tam(info)}.webm`));
});
