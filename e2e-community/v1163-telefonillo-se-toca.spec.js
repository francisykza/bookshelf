// 1.163 · El telefonillo, que se vea que se toca (Francisco, 28-11-2026: «el telefonillo debería tener un indicador visual de
// que es clicable»; docs/qa/comunidad-visita.md, bloque 1). En el portal: su luz ámbar sobre la rejilla, que parpadea hasta
// abrirlo la primera vez y luego respira, y su plaquita de latón con el auricular (con «Telefonillo» escrito «ocupaba
// demasiado»); tocar la plaquita abre el telefonillo.
// Con movimiento reducido, la luz quieta. Supabase simulado y una cuenta de prueba. Emulación: no equivale a un iPhone real.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { alEdificio } from './entrada';

const DIR = join('qa-report', 'v1163-telefonillo');
const shot = (page, info, name, clip) => page.screenshot({ path: join(DIR, info.project.name, `${name}.png`), clip });

test.use({ video: 'on' });

test.beforeEach(async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844)$|^webkit-390x844$|^chromium-390x844-reduced$/.test(info.project.name), 'móvil vertical');
  mkdirSync(join(DIR, info.project.name), { recursive: true });
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});

function semilla() {
  const mock = createMockSupabase({ edificio_vecinos: [], edificio_llaves: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-ana', puerta: '2B' });
  return mock;
}

/** Un recorte alrededor del portal: del botón del telefonillo a su placa, con aire. */
async function cerca(boton, placa, page) {
  const a = await boton.boundingBox();
  const b = await placa.boundingBox();
  const vp = page.viewportSize();
  const x = Math.max(0, Math.min(a.x, b.x) - 70);
  const y = Math.max(0, a.y - 60);
  const right = Math.min(vp.width, Math.max(a.x + a.width, b.x + b.width) + 70);
  const bottom = Math.min(vp.height, b.y + b.height + 50);
  return { x, y, width: right - x, height: bottom - y };
}

test('el telefonillo del portal se ve tocable: luz ámbar y placa de latón; la placa lo abre', async ({ page }, info) => {
  test.setTimeout(120000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  const reducido = info.project.name.endsWith('-reduced');
  await semilla().attach(page, ANA);
  await page.goto('/');
  const portal = await alEdificio(page);
  const boton = portal.getByRole('button', { name: /El telefonillo del portal/ });
  await expect(boton).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(reducido ? 600 : 2200);

  const luz = boton.locator('.ed-telefonillo__luz');
  const placa = boton.locator('.ed-placa--telefonillo');
  await expect(luz).toBeVisible();
  await expect(placa).toBeVisible();
  // Pequeña: solo el auricular, sin texto (el nombre lo dice la etiqueta del botón)
  await expect(placa.locator('.ed-placa__icono--auricular')).toBeVisible();
  await expect(placa).toHaveText('');
  expect((await placa.boundingBox()).width).toBeLessThan(40);
  // Nueva en este dispositivo: la luz llama (parpadea); con movimiento reducido, quieta
  await expect(boton).toHaveClass(/is-nuevo/);
  const anim = () => luz.evaluate((el) => getComputedStyle(el).animationName);
  expect(await anim()).toBe(reducido ? 'none' : 'ed-tel-llama');

  // La plaquita, entera en pantalla y sin tapar la placa del hotel
  const vp = page.viewportSize();
  const p = await placa.boundingBox();
  expect(p.x).toBeGreaterThanOrEqual(0);
  expect(p.x + p.width).toBeLessThanOrEqual(vp.width);
  const hotel = await portal.locator('.ed-placa--hotel').boundingBox();
  if (hotel) expect(p.x >= hotel.x + hotel.width || p.y >= hotel.y + hotel.height || p.y + p.height <= hotel.y).toBe(true);
  await shot(page, info, '1-portal');
  await shot(page, info, '2-telefonillo-cerca', await cerca(boton, placa, page));

  // Tocar la placa abre el telefonillo
  await placa.click();
  await expect(page.locator('.ed-tel__placa')).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(400);
  await shot(page, info, '3-abierto');

  // Al volver, ya visto: la luz respira despacio
  await page.keyboard.press('Escape');
  await page.locator('.ed-tel__placa').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
  if (await page.locator('.ed-tel__placa').count()) await page.getByRole('button', { name: /Cerrar|Volver/ }).first().click();
  await expect(page.locator('.ed-tel__placa')).toHaveCount(0);
  await expect(boton).not.toHaveClass(/is-nuevo/);
  expect(await anim()).toBe(reducido ? 'none' : 'ed-tel-respira');
  await page.waitForTimeout(1500);
  await shot(page, info, '4-ya-visto', await cerca(boton, placa, page));
  expect(errores).toEqual([]);
});
