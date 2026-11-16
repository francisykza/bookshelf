// 1.141 (SPEC §141; Francisco, 16-11-2026) · Los cafés de los demás:
// - La copa del café abre el ranking: tu edificio y a quien sigues, por nivel, por granos ganados y por esta semana.
// - «Visitar» abre el café de otro lector en 3D, para pasear y mirar (su estantería, sin los títulos de sus leídos), y «A tu
//   café» vuelve al tuyo.
// - Sin la migración, el ranking lo dice y no falla nada.
// Capturas y vídeos en qa-report/cafe-social/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { quieto } from './cafeBarra';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { CATALOGO_LIBROS } from '../src/features/edificio/cafe/cafeCatalogoLibros';
import { ESTANTERIA, paredIzquierda } from '../src/features/edificio/cafe/cafeLayout';
import { dayKey } from '../src/domain/dates';

const DIR = join('qa-report', 'cafe-social');
const tam = (info) => info.project.name.replace(/^(chromium|webkit)-/, '$1-');
const HOY = dayKey();
const BEA = '00000000-0000-4000-8000-0000000000b1';
const CARLOS = '00000000-0000-4000-8000-0000000000c1';
const DORA = '00000000-0000-4000-8000-0000000000d1';
const DE_EJEMPLO = ['alas-sangre', 'mistborn'].map((id) => ({ id, title: id, author: '', status: 'want', pageCount: 300, cover: '', categories: [], quotes: [], addedAt: '2026-10-01T10:00:00.000Z' }));
const fila = (user_id, alias, cafe, nivel, reputacion, ganados, semana, yo = false) => ({ user_id, alias, avatar_id: 'gato-lector', cafe, nivel, reputacion, ganados, semana, yo });
const RANKING = {
  edificio: [fila(BEA, 'Bea', 'El Rincón del Faro', 4, 6200, 410, 35), fila(ANA.id, 'Ana lectora', 'Taza y Lomo', 3, 2400, 520, 80, true), fila(CARLOS, 'Carlos', 'La Última Página', 2, 900, 120, 80)],
  seguidos: [fila(DORA, 'Dora', 'Café Marea', 5, 9100, 900, 12), fila(ANA.id, 'Ana lectora', 'Taza y Lomo', 3, 2400, 520, 80, true)],
};
const delCatalogo = (genero, n, balda = 1) =>
  CATALOGO_LIBROS.filter((c) => c.genero === genero)
    .slice(0, n)
    .map((c) => ({ clave: c.clave, titulo: c.titulo, genero, balda }));
const VISITA_BEA = {
  user_id: BEA,
  alias: 'Bea',
  avatar_id: 'gato-lector',
  nombre: 'El Rincón del Faro',
  nivel: 4,
  reputacion: 6200,
  plano: PLANO_INICIAL,
  escaparate: [],
  fotos: [2, 3],
  // De sus leídos, solo el género y cuántos (así llegan del servidor)
  libros: [...delCatalogo('misterio', 4), ...delCatalogo('poesia', 3, 2), { genero: 'misterio', balda: 2 }, { genero: 'fantasia', balda: 3 }, ...delCatalogo('fantasia', 2)],
};

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

async function alCafe(page, { social }) {
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 120, sin_raro: 3 } },
    piso_inventario: { [ANA.id]: { sillon: 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.libraries.push({ user_id: ANA.id, data: { books: DE_EJEMPLO }, updated_at: new Date().toISOString(), version: 5 });
  await page.addInitScript((b) => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!localStorage.getItem('bookshelf:v1')) localStorage.setItem('bookshelf:v1', JSON.stringify({ books: b, progress: { readingLog: [], pomodoros: [], claimed: {} } }));
  }, DE_EJEMPLO);
  await mock.attach(page, ANA);
  const estado = await simularCafe(
    page,
    {
      inaugurado: true,
      nombre: 'Taza y Lomo',
      nivel: 3,
      reputacion: 2400,
      granos: 40,
      plano: structuredClone(PLANO_INICIAL),
      inventario: cuenta(PLANO_INICIAL),
      libros: { bienvenida: true, libros: delCatalogo('novela', 4) },
    },
    { clientes: { hoy: HOY, semillas: [2100, 1000, 8919], quienes: [3], frases: [10] }, social },
  );
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' }).click({ timeout: 15000 });
  const cafe = page.getByRole('dialog', { name: 'El café-librería del bajo' });
  await expect(cafe.locator('.cf3[data-ready="true"]')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__cafe3d?.settled() && window.__cafe3d.renders() > 0);
  return { cafe, estado };
}

test('el ranking del edificio y de quien sigues, y la visita al café de una vecina', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/.test(info.project.name), '360, 390, 430, escritorio y WebKit 390');
  test.setTimeout(150000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { cafe, estado } = await alCafe(page, { social: { ranking: RANKING, visitas: { [BEA]: VISITA_BEA } } });

  // La copa del café: el ranking de tu edificio, por nivel (tú, marcado y sin «Visitar»)
  await cafe.getByRole('button', { name: 'Los cafés del barrio: ranking y visitas' }).click();
  const panel = cafe.getByRole('region', { name: 'Los cafés del barrio' });
  const filas = panel.locator('.cf3-ranking__fila');
  await expect(filas).toHaveCount(3);
  await expect(filas.locator('.cf3-ranking__cafe')).toHaveText(['El Rincón del Faro', 'Taza y Lomo', 'La Última Página']);
  await expect(filas.nth(1)).toHaveAttribute('data-yo', 'true');
  await expect(filas.nth(1).locator('.cf3-ranking__alias')).toHaveText('Tú');
  await expect(filas.nth(1).locator('.cf3-ranking__sub')).toHaveText('2.400 rep.');
  await expect(filas.nth(1).getByRole('button')).toHaveCount(0);
  await expect(filas.first().locator('.cf3-ranking__cifra')).toHaveAccessibleName('Nv 4, 6.200 de reputación');
  await quieto(page, 400);
  await page.screenshot({ path: join(DIR, `1-ranking-nivel-${tam(info)}.png`) });
  // Por granos ganados y por esta semana (empate: comparten puesto)
  await panel.getByRole('radio', { name: 'Granos ganados' }).click();
  await expect(filas.locator('.cf3-ranking__cafe')).toHaveText(['Taza y Lomo', 'El Rincón del Faro', 'La Última Página']);
  await panel.getByRole('radio', { name: 'Esta semana' }).click();
  await expect(filas.locator('.cf3-ranking__puesto')).toHaveText(['1', '2', '3']);
  await expect(filas.locator('.cf3-ranking__cafe')).toHaveText(['Taza y Lomo', 'La Última Página', 'El Rincón del Faro']);
  await page.screenshot({ path: join(DIR, `2-ranking-semana-${tam(info)}.png`) });
  // A quien sigues
  await panel.getByRole('tab', { name: 'A quien sigues' }).click();
  await panel.getByRole('radio', { name: 'Nivel' }).click();
  await expect(filas.locator('.cf3-ranking__cafe')).toHaveText(['Café Marea', 'Taza y Lomo']);
  await page.screenshot({ path: join(DIR, `3-ranking-seguidos-${tam(info)}.png`) });
  // (en desarrollo, React monta dos veces: la misma consulta puede repetirse)
  expect([...new Set(estado.llamadas.filter((l) => l.rpc === 'cafe_ranking').map((l) => l.body.ambito))]).toEqual(['edificio', 'seguidos']);

  // Visitar a Bea: su café en 3D, en solo lectura
  await panel.getByRole('tab', { name: 'Tu edificio' }).click();
  await panel.getByRole('button', { name: 'Visitar El Rincón del Faro, el café de Bea' }).click();
  const visita = page.getByRole('dialog', { name: 'El Rincón del Faro, el café de Bea' });
  await expect(visita.locator('.cf3[data-visita="true"][data-ready="true"]')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__cafe3d?.settled() && window.__cafe3d.renders() > 0);
  await expect(visita.locator('.cf3-visita__placa')).toHaveAttribute('aria-label', 'El Rincón del Faro, el café de Bea: nivel 4, 6200 de reputación');
  expect(estado.llamadas.find((l) => l.rpc === 'cafe_visita').body.lector).toBe(BEA);
  await quieto(page, 900);
  await page.screenshot({ path: join(DIR, `4-visita-${tam(info)}.png`) });
  // Su estantería: tres secciones (las del catálogo, enteras; sus leídos, sin título)
  const x = paredIzquierda(4) + ESTANTERIA.fondo + 2.4;
  await page.evaluate((px) => window.__cafe3d.place(px, (5 + 8.6) / 2, -Math.PI / 2), x);
  await quieto(page, 900);
  await page.screenshot({ path: join(DIR, `5-visita-estanteria-${tam(info)}.png`) });
  // Nada de lo tuyo: ni granos, ni Atender, ni Decorar
  await expect(visita.locator('.cf3-monedero')).toHaveCount(0);
  await expect(visita.getByRole('button', { name: 'Atender', exact: true })).toHaveCount(0);
  await expect(visita.getByRole('button', { name: 'Decorar' })).toHaveCount(0);

  // «A tu café» vuelve al tuyo
  await visita.getByRole('button', { name: 'A tu café' }).click();
  await expect(cafe.locator('.cf3[data-ready="true"]:not([data-visita])')).toBeVisible({ timeout: 20000 });
  await expect(cafe.getByRole('button', { name: 'Volver al portal' })).toBeVisible();
  expect(errors).toEqual([]);
  const video = page.video();
  await page.close();
  if (video && /chromium-390x844/.test(info.project.name)) await video.saveAs(join(DIR, `ranking-y-visita-${tam(info)}.webm`));
});

test('sin la migración, el ranking lo dice y el café sigue igual', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'solo 390');
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { cafe } = await alCafe(page, { social: null });
  await cafe.getByRole('button', { name: 'Los cafés del barrio: ranking y visitas' }).click();
  const panel = cafe.getByRole('region', { name: 'Los cafés del barrio' });
  await expect(panel.locator('.cf3-ranking__nota')).toHaveText('El ranking de los cafés llegará muy pronto.');
  await panel.getByRole('button', { name: 'Cerrar' }).click();
  await expect(panel).toHaveCount(0);
  await expect(cafe.getByRole('button', { name: 'Atender', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
