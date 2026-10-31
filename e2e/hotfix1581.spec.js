// QA de la 1.58.1 (auditoría del vídeo, docs/qa/video-hotfix.md · FIX 1 y 9): las figuras SVG provisionales ya no
// existen como coleccionables. Una cuenta antigua que las tenía (incluso como Guardián, Senda o expuestas) carga sin
// errores, conserva su inventario guardado y no las ve, no las obtiene y no las expone. Sin premio posible, la caja no se
// abre ni se gasta. Perfiles de prueba de Playwright, nunca datos reales.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const RETIRED = /Viajero del Asteroide|Bardo del Viento|Hechicera de Eea/;
const figuresOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).progress.figures);

async function shot(page, info, name) {
  // En qa-report (las elegidas para la entrega se copian a docs/qa/video-hotfix/ a mano)
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `hotfix1581-${name}.png`) });
}

/** Siembra una cuenta antigua (solo la primera carga) y espera a la habitación. */
async function loadOldAccount(page, patch) {
  test.skip(page.viewportSize().width > page.viewportSize().height, 'la vitrina está en las baldas del encuadre vertical');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|blocked by CORS policy/.test(m.text()) && errors.push(m.text()));
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/');
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.waitForTimeout(400);
  const seeded = await page.evaluate((p) => {
    const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
    st.progress.figures = { ...st.progress.figures, ...p };
    return JSON.stringify(st);
  }, patch);
  await page.addInitScript((v) => {
    if (!sessionStorage.getItem('h1581-seeded')) {
      localStorage.setItem('bookshelf:v1', v);
      sessionStorage.setItem('h1581-seeded', '1');
    }
  }, seeded);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  return errors;
}

const t = '2026-09-01T10:00:00.000Z';

test('cuenta antigua con figuras retiradas: carga, conserva el inventario y no las muestra ni las sortea', async ({ page }, info) => {
  const errors = await loadOldAccount(page, {
    owned: {
      dama_ceniza: { display: 'box', parts: [0], obtainedAt: t },
      jinete_dragones: { display: 'box', parts: [0], obtainedAt: t },
      viajero_asteroide: { display: 'box', parts: [0, 1], obtainedAt: t },
      bardo_viento: { display: 'unboxed', parts: [], obtainedAt: t },
    },
    guardian: 'viajero_asteroide',
    path: 'bardo_viento',
    boxes: 2,
    shelf: [{ id: 'viajero_asteroide', display: 'box' }, null, null, null],
    unbox: { id: 'viejo', reward: { type: 'figure', id: 'bardo_viento' }, at: t, seen: false },
  });
  // La habitación cuenta solo las figuras vigentes y no expone ninguna retirada
  await expect(page.getByRole('button', { name: /Vitrina de figuras. 2 figuras/ })).toBeVisible();
  await expect(page.locator('.room-figure img[src*="viajero"], .room-figure img[src*="bardo"]')).toHaveCount(0);
  // Ático: solo figuras definitivas
  await page.getByRole('button', { name: /Vitrina de figuras/ }).first().click();
  const vault = page.getByRole('dialog', { name: /Ático|Coleccionista/ });
  await expect(vault).toBeVisible();
  await expect(vault).not.toContainText(RETIRED);
  await expect(vault).toContainText('2/4 en tu vitrina');
  await expect(vault.locator('img[src$=".svg"][src*="/figures/"]')).toHaveCount(0);
  // Sin Guardián (era una figura retirada): la herramienta de prueba de sellos no se ofrece en la app publicada
  // (aquí corre el servidor de desarrollo; su ausencia en producción se comprueba en el build)
  await shot(page, info, '01-atico-cuenta-antigua');
  // Cámara de Unboxing: el premio pendiente de una figura retirada no se presenta; abrir una caja da un premio válido
  await vault.getByRole('tab', { name: /Cámara de Unboxing/ }).click();
  await expect(vault).not.toContainText(RETIRED);
  await vault.getByRole('button', { name: /Abrir una Caja Sorpresa/ }).click();
  await expect.poll(async () => (await figuresOf(page)).boxes, { timeout: 8000 }).toBe(1);
  const reward = (await figuresOf(page)).unbox.reward;
  expect(['figure', 'part', 'seal']).toContain(reward.type);
  if (reward.id) expect(['dama_ceniza', 'jinete_dragones', 'guardian_clavos', 'maestro_superviviente']).toContain(reward.id);
  // Resultado a la vista (la ceremonia de la caja sí conserva su «Saltar animación»: no es la visita social)
  await vault.getByRole('button', { name: 'Saltar animación' }).click({ timeout: 1500 }).catch(() => {});
  await expect(vault.getByRole('button', { name: /Ver en mi colección|Abrir otra|Seguir/ }).first()).toBeVisible({ timeout: 8000 });
  await expect(vault).not.toContainText(RETIRED);
  await expect(vault).not.toContainText('undefined');
  // Tras el primer guardado, el inventario histórico sigue ahí y las selecciones activas ya no apuntan a retiradas
  const fs = await figuresOf(page);
  expect(Object.keys(fs.owned)).toEqual(expect.arrayContaining(['viajero_asteroide', 'bardo_viento']));
  expect(fs.guardian).toBeNull();
  expect(fs.path).toBeNull();
  expect(fs.shelf[0]).toBeNull();
  await shot(page, info, '02-unboxing-premio-valido');
  expect(errors).toEqual([]);
});

test('sin premio posible la caja no se abre ni se gasta, con un aviso claro', async ({ page }) => {
  // Todas las piezas de cada figura vigente (índices de sobra no estorban)
  const full = { display: 'box', parts: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], obtainedAt: t };
  await loadOldAccount(page, {
    owned: { dama_ceniza: full, jinete_dragones: full, guardian_clavos: full, maestro_superviviente: full, hechicera_eea: full },
    guardian: 'hechicera_eea',
    boxes: 3,
    unbox: null,
  });
  await page.getByRole('button', { name: /Vitrina de figuras/ }).first().click();
  const vault = page.getByRole('dialog', { name: /Ático|Coleccionista/ });
  await vault.getByRole('tab', { name: /Cámara de Unboxing/ }).click();
  const open = vault.getByRole('button', { name: 'Caja guardada' });
  await expect(open).toBeDisabled();
  await expect(vault.getByRole('status').filter({ hasText: 'no hay ningún premio que pueda salir' })).toBeVisible();
  expect((await figuresOf(page)).boxes).toBe(3);
});
