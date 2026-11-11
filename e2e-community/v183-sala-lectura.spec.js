// 1.83 · La sala de lectura del Gran Hotel, con Supabase simulado: se llega desde el Directorio, te sientas, empieza tu
// sesión y ves a quien lee a la vez. Al acabar, las páginas se apuntan con el formulario de la bandeja.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_AVATAR } from '../src/features/edificio/actor';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BEA = '22222222-2222-4222-8222-222222222222';

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

async function toSala(page) {
  const mock = createMockSupabase({ edificio_vecinos: [], piso_cuentas: {} });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.profiles.push({ user_id: BEA, alias: 'Bea lectora', avatar_id: 'lectora-cafe', community_enabled: true });
  mock.db.sala_personajes = [
    { user_id: ANA.id, personaje: { ...DEFAULT_AVATAR, jersey: 2, pelo: 'corto' }, companero: 'dragoncillo' },
    { user_id: BEA, personaje: { ...DEFAULT_AVATAR, piel: 3, colorPelo: 4, jersey: 5 }, companero: 'conejo-chistera' },
  ];
  mock.db.sala = { lomos: [{ id: 'l1', titulo: 'El faro del fin', alias: 'Bea lectora', mio: false }, { id: 'l2', titulo: 'Mar de fondo', alias: 'Carla', mio: false }, { id: 'l3', titulo: 'La casa del acantilado', alias: 'Dani', mio: false }], saludos: [] };
  const ahora = new Date().toISOString();
  mock.db.reading_presence.push({ user_id: BEA, share_book: true, book_title: 'El faro del fin', started_at: ahora, last_seen: ahora });
  await mock.attach(page, ANA);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  // Desde la 1.116 la sala es 3D (su prueba es v1116-sala3d); aquí se sigue probando la de siempre, la que se ve sin WebGL
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
      return /webgl/.test(kind) ? null : get.call(this, kind, ...rest);
    };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Coger la limusina al Gran Hotel' }).click({ timeout: 15000 });
  const hotel = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' });
  await expect(hotel.getByRole('button', { name: 'Directorio' })).toBeVisible({ timeout: 15000 });
  await hotel.getByRole('button', { name: 'Directorio' }).click();
  await hotel.getByRole('button', { name: /Café-biblioteca/ }).click();
  return { sala: hotel.getByRole('region', { name: 'La sala de lectura' }), mock };
}

test('sentarse empieza la sesión, se ve a quien lee y al levantarse se deja el sillón', async ({ page }, info) => {
  test.skip(!/chromium-(320x640|390x844|1440x900)$|webkit-390x844/.test(info.project.name), '320, 390 (Chromium y WebKit) y escritorio');
  const { sala, mock } = await toSala(page);
  await expect(sala.getByText('Leyendo ahora')).toBeVisible();
  await expect(sala.getByRole('list', { name: 'Quién lee ahora' })).toContainText('Bea lectora');
  await expect(sala.getByRole('list', { name: 'Quién lee ahora' })).toContainText('«El faro del fin»');
  await shot(page, info, 'v183-sala');
  await sala.getByRole('button', { name: 'Sentarte a leer' }).click();
  await sala.getByRole('button', { name: 'Sentarme a leer' }).click();
  await expect(sala.getByRole('button', { name: 'Pausar' })).toBeVisible();
  await expect(sala.getByRole('list', { name: 'Quién lee ahora' })).toContainText('Tú');
  expect(mock.db.reading_presence.some((r) => r.user_id === ANA.id)).toBe(true);
  await shot(page, info, 'v183-sala-sentada');
  await sala.getByRole('button', { name: 'Levantarte' }).click();
  await expect(sala.getByRole('button', { name: 'Seguir leyendo' })).toBeVisible();
  await expect(sala.getByRole('list', { name: 'Quién lee ahora' })).not.toContainText('Tú');
  expect(mock.db.reading_presence.some((r) => r.user_id === ANA.id)).toBe(false);
});

test('al acabar la sesión se apuntan las páginas ahí mismo y te levantas', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'una vez basta');
  const { sala, mock } = await toSala(page);
  await page.clock.install();
  await sala.getByRole('button', { name: 'Sentarte a leer' }).click();
  await sala.getByRole('button', { name: 'Sentarme a leer' }).click();
  await expect(sala.getByRole('button', { name: 'Pausar' })).toBeVisible();
  await page.clock.fastForward('55:00');
  await expect(sala.getByText('¡Sesión completada!')).toBeVisible();
  await shot(page, info, 'v183-sala-paginas');
  await sala.getByRole('button', { name: 'Apuntar' }).click();
  await sala.getByRole('button', { name: 'Seguir aquí' }).click();
  await expect(sala.getByText('¡Sesión completada!')).toHaveCount(0);
  expect(mock.db.reading_presence.some((r) => r.user_id === ANA.id)).toBe(false);
});

test('la librería enseña de quién es cada lomo, y se saluda a quien lee contigo', async ({ page }, info) => {
  test.skip(!/chromium-(320x640|390x844|1440x900)$|webkit-390x844/.test(info.project.name), '320, 390 (Chromium y WebKit) y escritorio');
  const { sala, mock } = await toSala(page);
  await expect(sala.getByText('3 libros terminados aquí.')).toBeVisible();
  await sala.getByRole('button', { name: '«Mar de fondo», de Carla' }).click();
  await expect(sala.getByText('lo dejó Carla')).toBeVisible();
  mock.db.sala.saludos.push(BEA);
  await sala.getByRole('button', { name: 'Sentarte a leer' }).click();
  await sala.getByRole('button', { name: 'Sentarme a leer' }).click();
  await expect(sala.getByText('Bea lectora levanta la vista y te saluda.')).toBeVisible();
  await shot(page, info, 'v183-sala-saludo');
  await sala.getByRole('button', { name: 'Saludar a Bea lectora' }).click();
  await expect(sala.getByRole('button', { name: 'Saludar a Bea lectora' })).toBeDisabled();
  expect(mock.db.sala.enviados).toEqual([BEA]);
});

test('al terminar un libro dices con quién has leído y puedes dejar su lomo', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'una vez basta');
  const { sala, mock } = await toSala(page);
  await page.clock.install();
  await sala.getByRole('button', { name: 'Sentarte a leer' }).click();
  await sala.getByRole('button', { name: 'Sentarme a leer' }).click();
  await expect(sala.getByRole('button', { name: 'Pausar' })).toBeVisible();
  await page.clock.fastForward('55:00');
  await expect(sala.getByText('Has leído con Bea lectora.')).toBeVisible();
  const paginas = sala.locator('input[type="number"]');
  await paginas.fill(await paginas.getAttribute('max'));
  await sala.getByRole('button', { name: 'Apuntar' }).click();
  await sala.getByRole('button', { name: 'Seguir aquí' }).click();
  await expect(sala.getByText('¿Dejas su lomo en la librería de la sala?')).toBeVisible();
  await shot(page, info, 'v183-sala-lomo');
  expect(mock.db.reading_presence.some((r) => r.user_id === ANA.id)).toBe(true);
  await sala.getByRole('button', { name: 'Dejar el lomo' }).click();
  await expect(sala.getByText('4 libros terminados aquí.')).toBeVisible();
  await expect.poll(() => mock.db.reading_presence.some((r) => r.user_id === ANA.id)).toBe(false);
  await sala.getByRole('button', { name: /de ti$/ }).click();
  await sala.getByRole('button', { name: 'Retirar mi lomo' }).click();
  await expect(sala.getByText('3 libros terminados aquí.')).toBeVisible();
});
