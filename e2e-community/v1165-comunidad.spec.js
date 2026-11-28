// 1.165 · La Comunidad al día (docs/qa/comunidad-visita.md, bloque 3; Francisco, 28-11-2026, «Sí, así»): sin el cuaderno de
// cuero, en el papel de píxel de «Lo de hoy», con la letra del puerto y el busto del personaje de cada lector como avatar (sin
// personaje, Libo; sin la migración, los retratos de antes). Supabase simulado y cuentas de prueba. Emulación: no equivale a un
// iPhone real.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222' };
const CARLA = { id: '33333333-3333-4333-8333-333333333333' };
const DANI = { id: '44444444-4444-4444-8444-444444444444' };
const W1 = { id: '55555555-5555-4555-8555-555555555555', kind: 'local', title: 'Circe', author: 'Madeline Miller' };
const W2 = { id: '55555555-5555-4555-8555-555555555556', kind: 'local', title: 'El jardín de agua', author: 'Autora de Prueba' };
const DIR = join('qa-report', 'v1165-comunidad');
const shot = (page, info, name) => page.screenshot({ path: join(DIR, info.project.name, `${name}.png`) });
const PJ = (o) => ({ piel: 1, pelo: 'melena', colorPelo: 1, jersey: 0, pantalon: 0, gafas: false, complemento: 'ninguno', ...o });

test.use({ video: 'on' });

test.beforeEach(async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844)$|^webkit-390x844$/.test(info.project.name), 'móvil vertical');
  mkdirSync(join(DIR, info.project.name), { recursive: true });
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});

function semilla({ personajes = true } = {}) {
  const mock = createMockSupabase();
  mock.db.works.push(W1, W2);
  mock.db.profiles.push(
    { user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true },
    { user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'lector-farol', community_enabled: true },
    { user_id: CARLA.id, alias: 'Carla', avatar_id: 'gato-lector', community_enabled: true },
    // Dani no tiene piso ni personaje: Libo
    { user_id: DANI.id, alias: 'Dani', avatar_id: 'lector-farol', community_enabled: true },
  );
  mock.db.follows.push({ follower: ANA.id, followed: BRUNO.id }, { follower: ANA.id, followed: CARLA.id }, { follower: ANA.id, followed: DANI.id });
  const at = (i) => new Date(Date.now() - i * 3600e3).toISOString();
  mock.db.public_reviews.push(
    { id: '70000000-0000-4000-8000-000000000001', work_id: W1.id, user_id: BRUNO.id, rating_quarters: 16, body: 'Una historia que me ha acompañado durante días.', has_spoilers: false, status: 'published', published_at: at(1) },
    { id: '70000000-0000-4000-8000-000000000002', work_id: W2.id, user_id: CARLA.id, rating_quarters: 20, body: 'Al final los hombres grises pierden.', has_spoilers: true, status: 'published', published_at: at(2) },
  );
  mock.db.pisos ??= [];
  mock.db.pisos.push(
    { user_id: ANA.id, personaje: PJ({ jersey: 2 }) },
    { user_id: BRUNO.id, personaje: PJ({ piel: 3, pelo: 'rizos', colorPelo: 4, jersey: 1, gafas: true }) },
    { user_id: CARLA.id, personaje: PJ({ piel: 0, pelo: 'largo', colorPelo: 3, jersey: 3 }) },
  );
  mock.db.comunidadPersonajes = personajes;
  return mock;
}

async function abrir(page, mock, tab = 'lectores') {
  await mock.attach(page, ANA);
  await page.addInitScript((t) => {
    if (sessionStorage.getItem('v1165-nav')) return;
    sessionStorage.setItem('v1165-nav', '1');
    history.replaceState({ bookshelf: { loc: { view: 'room', panel: { type: 'social', tab: t } }, depth: 0, parent: null } }, '');
  }, tab);
  await page.goto('/');
  await expect(page.getByRole('tablist', { name: 'Secciones de la comunidad' })).toBeVisible({ timeout: 20000 });
}

test('la Comunidad al día: papel de píxel y el busto del personaje de cada lector', async ({ page }, info) => {
  test.setTimeout(150000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await abrir(page, semilla());
  const hub = page.locator('.social-hub.comunidad-px');
  await expect(hub).toBeVisible();
  // Sin el cuaderno de cuero: ni las anillas ni el cuero se ven
  for (const sel of ['.notebook-shell__binding', '.notebook-shell__edges']) {
    const visible = await hub.locator(sel).evaluate((el) => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0).catch(() => false);
    expect(visible).toBe(false);
  }
  // Las tres pestañas de siempre, en la letra del puerto y sin desplazamiento
  const tabs = page.getByRole('tablist', { name: 'Secciones de la comunidad' });
  await expect(tabs.getByRole('tab')).toHaveText(['Lectores', 'Salón', 'Clubes']);
  expect(await tabs.getByRole('tab').first().evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/PuertoPixel/);
  expect(await tabs.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);

  // Los retratos: el busto del personaje (Bruno, Carla y tú) y Libo para quien no tiene (Dani)
  const retrato = (nombre) => page.getByRole('button', { name: `Ver el perfil de ${nombre}` }).first().locator('.reader-avatar');
  await expect(retrato('Bruno')).toHaveAttribute('data-retrato', 'personaje', { timeout: 10000 });
  await expect(retrato('Carla')).toHaveAttribute('data-retrato', 'personaje');
  await expect(retrato('Dani')).toHaveAttribute('data-retrato', 'libo');
  await expect(page.getByRole('button', { name: 'Tu perfil y tu rincón' }).locator('.reader-avatar')).toHaveAttribute('data-retrato', 'personaje');
  expect(await retrato('Bruno').locator('img').evaluate((img) => img.src.startsWith('data:image/png'))).toBe(true);
  await page.waitForTimeout(400);
  await shot(page, info, '1-lectores');

  // Lo que comparten: la tarjeta con su retrato
  const tarjeta = page.getByRole('article', { name: /Opinión de Bruno/ });
  await tarjeta.scrollIntoViewIfNeeded();
  await expect(tarjeta.locator('.reader-avatar')).toHaveAttribute('data-retrato', 'personaje');
  await page.waitForTimeout(300);
  await shot(page, info, '2-lo-que-comparten');

  // Su perfil, con su retrato grande
  await page.getByRole('button', { name: 'Ver el perfil de Bruno' }).first().click();
  await expect(page.locator('.huella-avatar .reader-avatar')).toHaveAttribute('data-retrato', 'personaje', { timeout: 10000 });
  await page.waitForTimeout(400);
  await shot(page, info, '3-perfil-bruno');
  await page.goBack();
  await expect(tabs).toBeVisible();

  // Salón y Clubes, en el mismo papel
  await tabs.getByRole('tab', { name: 'Salón' }).click();
  await page.waitForTimeout(500);
  await shot(page, info, '4-salon');
  await tabs.getByRole('tab', { name: 'Clubes' }).click();
  await page.waitForTimeout(500);
  await shot(page, info, '5-clubes');

  // Tu perfil: tu retrato es tu personaje (ya no se elige un avatar ilustrado)
  await page.getByRole('button', { name: 'Tu perfil y tu rincón' }).click();
  await page.getByRole('menuitem', { name: 'Mi perfil y avatar' }).click();
  await expect(page.locator('.profile-hero .reader-avatar')).toHaveAttribute('data-retrato', 'personaje', { timeout: 10000 });
  await expect(page.getByRole('radiogroup', { name: 'Avatar' })).toHaveCount(0);
  await expect(page.getByText('Tu retrato es tu personaje')).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, info, '6-tu-perfil');
  expect(errores).toEqual([]);
});

test('sin la migración de los personajes, los retratos de antes y el selector de avatar', async ({ page }, info) => {
  await abrir(page, semilla({ personajes: false }));
  const retrato = page.getByRole('button', { name: 'Ver el perfil de Bruno' }).first().locator('.reader-avatar');
  await expect(retrato).toHaveAttribute('data-retrato', 'antiguo', { timeout: 10000 });
  await expect(retrato.locator('img')).toHaveAttribute('src', /avatars|webp|png/);
  await page.getByRole('button', { name: 'Tu perfil y tu rincón' }).click();
  await page.getByRole('menuitem', { name: 'Mi perfil y avatar' }).click();
  await expect(page.getByRole('radiogroup', { name: 'Avatar' })).toBeVisible({ timeout: 10000 });
  await shot(page, info, '7-sin-migracion');
});
