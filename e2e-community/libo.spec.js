// Libo, el gato guía (docs/qa/libo.md, bloque 1): vive en una esquina del piso de inicio y la primera vez da la bienvenida,
// señalando los controles de verdad. Supabase simulado y una cuenta de prueba (ninguna cuenta real). Con vídeo.
// Emulación: no equivale a un Android ni a un iPhone reales.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NEIGHBOURS } from '../src/features/edificio/demo.js';
import { SUPABASE, createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const DIR = join('qa-report', 'libo');

test.use({ video: 'on' });

function seed() {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' });
  mock.db.pisos.push({ user_id: ANA.id, layout: NEIGHBOURS.find((n) => n.id === '1a').room() });
  return mock;
}
const shot = (page, info, name) => page.screenshot({ path: join(DIR, info.project.name, `${name}.png`) });
const libo = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1') ?? '{}').settings?.libo ?? null);

/** La tarjeta de la guía: dentro de la pantalla, botones de 44 px y, si señala algo, el hueco sobre ese control. */
async function tarjeta(page) {
  return page.evaluate(() => {
    const t = document.querySelector('.libo-tarjeta');
    const r = t.getBoundingClientRect();
    const hueco = document.querySelector('.libo-guia__hueco')?.getBoundingClientRect() ?? null;
    return {
      paso: t.dataset.paso,
      dentro: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      botones: [...t.querySelectorAll('button')].map((b) => b.getBoundingClientRect().height),
      foco: document.activeElement?.textContent ?? '',
      hueco: hueco && { x: hueco.x, y: hueco.y, w: hueco.width, h: hueco.height },
    };
  });
}

test.beforeEach(async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844)$|^webkit-390x844$/.test(info.project.name), 'móvil vertical');
  mkdirSync(join(DIR, info.project.name), { recursive: true });
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});

test('la primera vez, la bienvenida de Libo; luego vive en su esquina y se ajusta en «Tu cuenta»', async ({ page }, info) => {
  test.setTimeout(120000);
  const mock = seed();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await mock.attach(page, ANA);
  // El simulador da a Libo por presentado (para que no tape las demás pruebas); aquí no
  await page.addInitScript(() => localStorage.removeItem('bookshelf:libo'));
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });

  // 1 · Libo saluda solo, una vez la habitación está a la vista
  await expect(page.locator('.libo-tarjeta[data-paso="hola"]')).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(400);
  let t = await tarjeta(page);
  expect(t.dentro).toBe(true);
  expect(t.foco).toBe('Enséñame');
  for (const h of t.botones) expect(h).toBeGreaterThanOrEqual(44);
  await shot(page, info, '1-hola');

  // 2 · Paso a paso, cada uno sobre su control
  const pasos = [
    ['lectura', '.plab-controls .plab-primary'],
    ['balda', '.plab-controls .plab-tool[aria-label="Ver la balda"], .plab-controls .plab-tool[aria-label^="Toda la biblioteca"]'],
    ['menu', '.plab-controls .plab-tool[aria-label="Menú de accesos"]'],
    ['puerta', '.plab-bar > .px-btn'],
    ['fin', '.libo-rincon__gato'],
  ];
  await page.getByRole('button', { name: 'Enséñame' }).click();
  for (const [i, [paso, ancla]] of pasos.entries()) {
    await expect(page.locator(`.libo-tarjeta[data-paso="${paso}"]`)).toBeVisible();
    await page.waitForTimeout(450);
    t = await tarjeta(page);
    expect(t.dentro).toBe(true);
    for (const h of t.botones) expect(h).toBeGreaterThanOrEqual(44);
    const objetivo = await page.locator(ancla).first().boundingBox();
    // El hueco rodea el control (6 px de aire por cada lado)
    expect(Math.abs(t.hueco.x + 6 - objetivo.x)).toBeLessThan(2);
    expect(Math.abs(t.hueco.y + 6 - objetivo.y)).toBeLessThan(2);
    await shot(page, info, `${i + 2}-${paso}`);
    if (paso === 'balda') {
      // Atrás y otra vez adelante
      await page.getByRole('button', { name: 'Atrás' }).click();
      await expect(page.locator('.libo-tarjeta[data-paso="lectura"]')).toBeVisible();
    }
    await page.locator('.libo-tarjeta .libo-btn--principal').click();
    if (paso === 'balda') {
      await expect(page.locator('.libo-tarjeta[data-paso="balda"]')).toBeVisible();
      await page.locator('.libo-tarjeta .libo-btn--principal').click();
    }
  }
  await expect(page.locator('.libo-guia')).toHaveCount(0);
  await expect.poll(() => libo(page)).toMatchObject({ vistos: expect.arrayContaining(['hola', 'bienvenida']) });

  // 3 · En su esquina: el bocadillo con el corazón
  const gato = page.getByRole('button', { name: 'Libo, el gato guía' });
  await expect(gato).toBeVisible();
  const g = await gato.boundingBox();
  expect(g.width).toBeGreaterThanOrEqual(44);
  expect(g.height).toBeGreaterThanOrEqual(44);
  await gato.click();
  const bocadillo = page.getByRole('dialog', { name: 'Libo' });
  // Bloque 3: aún no ha bajado al edificio, así que la sugerencia del día es ir a verlo (sin cuenta atrás ni prisa)
  await expect(bocadillo).toContainText('Tus vecinos viven en el edificio del puerto. ¿Bajamos a verlo?');
  await page.waitForTimeout(300);
  await shot(page, info, '7-bocadillo');
  // Repasar y salir con Escape: no vuelve a marcar nada raro ni se queda abierta
  await bocadillo.getByRole('button', { name: 'Repasar la bienvenida' }).click();
  await expect(page.locator('.libo-tarjeta[data-paso="hola"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.libo-guia')).toHaveCount(0);
  await expect(page.locator('.plab-room')).toBeVisible();

  // 4 · «Ajustes de Libo»: cómo se porta; si descansa, deja la esquina
  await gato.click();
  await bocadillo.getByRole('button', { name: 'Ajustes de Libo' }).click();
  const ajustes = page.locator('.account-libo');
  await expect(ajustes).toBeInViewport();
  await expect(ajustes.getByRole('radio', { name: 'Libo me sugiere cosas' })).toBeChecked();
  await page.waitForTimeout(300);
  await shot(page, info, '8-ajustes');
  await ajustes.getByText('Libo descansa').click();
  await expect(ajustes).toContainText('No sale en las esquinas');
  await page.getByRole('button', { name: 'Cerrar' }).first().click();
  await expect(page.locator('.plab-room')).toBeVisible();
  await expect(page.locator('.libo-rincon')).toHaveCount(0);
  await expect.poll(() => libo(page)).toMatchObject({ modo: 'descansa' });

  // 5 · Se le despierta desde Ajustes del menú y vuelve a su esquina; al recargar no repite la bienvenida
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await page.locator('.account-libo').getByText('Libo me sugiere cosas').click();
  await page.getByRole('button', { name: 'Cerrar' }).first().click();
  await expect(gato).toBeVisible();
  await page.reload();
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await expect(page.locator('.libo-guia')).toHaveCount(0);
  await expect(gato).toBeVisible();
  expect(errores).toEqual([]);
});

test('el maullido, grabado aparte (los vídeos no llevan sonido)', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'una vez basta');
  await page.goto('/');
  // La misma síntesis que suena en la app, en un contexto sin conexión, con el volumen por defecto de los efectos (25 %)
  const wav = await page.evaluate(async () => {
    const { dibujarMaullido } = await import('/src/features/libo/maullido.js');
    const rate = 44100;
    const ctx = new OfflineAudioContext(1, rate * 1.2, rate);
    const bus = ctx.createGain();
    bus.gain.value = 0.25 * 2.5;
    bus.connect(ctx.destination);
    dibujarMaullido(ctx, bus, 0.2);
    const data = (await ctx.startRendering()).getChannelData(0);
    const buf = new ArrayBuffer(44 + data.length * 2);
    const v = new DataView(buf);
    const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF');
    v.setUint32(4, 36 + data.length * 2, true);
    str(8, 'WAVEfmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    str(36, 'data');
    v.setUint32(40, data.length * 2, true);
    let pico = 0;
    data.forEach((x, i) => {
      pico = Math.max(pico, Math.abs(x));
      v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x)) * 32767, true);
    });
    let bin = '';
    new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
    return { b64: btoa(bin), pico };
  });
  // Se oye, pero sin saturar
  expect(wav.pico).toBeGreaterThan(0.02);
  expect(wav.pico).toBeLessThan(0.9);
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(DIR, 'maullido-libo.wav'), Buffer.from(wav.b64, 'base64'));
});

test('sin cuenta: Libo saluda en la esquina y explica qué falta', async ({ page }, info) => {
  await page.route(`${SUPABASE}/**`, (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.goto('/?inicio=habitacion');
  await expect(page.getByText(/inicia sesión en «Tu cuenta» para entrar/)).toBeVisible({ timeout: 30000 });
  const bocadillo = page.getByRole('dialog', { name: 'Libo' });
  await expect(bocadillo).toContainText('Cuando entres con tu cuenta, te enseño tu piso', { timeout: 8000 });
  await page.waitForTimeout(300);
  await shot(page, info, '9-sin-cuenta');
  // Tocando fuera se cierra, y no vuelve a salir solo
  await page.locator('.plab-gate p').first().click();
  await expect(bocadillo).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/inicia sesión en «Tu cuenta» para entrar/)).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await expect(bocadillo).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Libo, el gato guía' })).toBeVisible();
});
