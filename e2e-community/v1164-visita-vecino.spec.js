// 1.164 · La visita a un vecino, la habitación protagonista (Francisco, 28-11-2026: «hay demasiados menús que afean la
// experiencia. Querría que se viese su piso y que estuviesen las opciones bien integradas y organicas de dejar un regalo y un
// post it»; docs/qa/comunidad-visita.md, bloque 2). Su piso de borde a borde con una franja fina arriba (volver y su nombre),
// sin tarjeta de datos, «Ver de noche», cabecera ni pestañas; junto a la puerta, una caja de regalo y un post-it en blanco que
// abren una nota de papel pequeña. Supabase simulado y cuentas de prueba. Emulación: no equivale a un iPhone real.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { starterRoom } from '../src/features/edificio/demo.js';
import { createMockSupabase } from './mockSupabase';
import { SALA } from './v190-apoyo';
import { alEdificio } from './entrada';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222', email: 'bruno@ejemplo.test' };
const DIR = join('qa-report', 'v1164-visita');
const shot = (page, info, name) => page.screenshot({ path: join(DIR, info.project.name, `${name}.png`) });

test.use({ video: 'on' });

test.beforeEach(async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844)$|^webkit-390x844$/.test(info.project.name), 'móvil vertical');
  mkdirSync(join(DIR, info.project.name), { recursive: true });
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
});

function semilla() {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.vecinosSocial = true;
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true }, { user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'lector-farol', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' }, { user_id: BRUNO.id, edificio: 'edificio-1', puerta: '1A' });
  mock.db.pisos.push({ user_id: ANA.id, layout: starterRoom() }, { user_id: BRUNO.id, layout: SALA });
  // Ana tiene lo de su piso inicial y dos pufs guardados (libres): puede regalarle uno
  const inv = {};
  for (const i of starterRoom().items) inv[i.id] = (inv[i.id] ?? 0) + 1;
  inv.puf = 2;
  mock.db.piso_cuentas = { [ANA.id]: { inicio_elegido: true, tickets: 30, sin_raro: 0 }, [BRUNO.id]: { inicio_elegido: true, tickets: 30, sin_raro: 0 } };
  mock.db.piso_inventario = { [ANA.id]: inv, [BRUNO.id]: { sillon: 1 } };
  return mock;
}

/** El tablón de Bruno: acepta post-its y aún no le has dejado ninguno hoy. */
async function tablonDeBruno(page) {
  const t = { enviada: false, nota: null };
  await page.route(/\/rest\/v1\/rpc\/(tablon_[a-z_]+)/, async (route) => {
    const name = route.request().url().match(/rpc\/(tablon_[a-z_]+)/)[1];
    const json = (v) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) });
    if (name === 'tablon_visita') return json({ publico: null, acepta: true, enviada_hoy: t.enviada, proximo: '2026-11-29T00:00:00Z' });
    if (name === 'tablon_enviar_nota') {
      t.enviada = true;
      t.nota = route.request().postDataJSON();
      return json({ id: 'n9', repetida: false });
    }
    return json(null);
  });
  return t;
}

async function alPisoDeBruno(page) {
  const mock = semilla();
  await mock.attach(page, ANA);
  // Después del simulador: la última ruta manda
  const tablon = await tablonDeBruno(page);
  await page.goto('/');
  const portal = await alEdificio(page);
  await portal.getByRole('button', { name: 'Llamar y entrar en el piso de Bruno, 1.º A' }).click({ timeout: 15000 });
  const piso = page.getByRole('dialog', { name: 'Piso de Bruno' });
  await expect(piso.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  return { mock, tablon, piso };
}

test('la visita: su piso de borde a borde, el regalo y el post-it junto a la puerta', async ({ page }, info) => {
  test.setTimeout(150000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  const { mock, tablon, piso } = await alPisoDeBruno(page);
  const vp = page.viewportSize();

  // Fuera los menús: ni cabecera, ni tarjeta de datos, ni «Ver de noche», ni pestañas, ni cambiar de vista
  await expect(piso.locator('.ed-head')).toHaveCount(0);
  await expect(piso.locator('.ed-visita3d__datos')).toHaveCount(0);
  await expect(piso.getByRole('button', { name: /Ver de noche|Ver de día|Ver al atardecer/ })).toHaveCount(0);
  await expect(piso.getByRole('tablist')).toHaveCount(0);
  await expect(piso.locator('.ed-bar__view')).toHaveCount(0);
  await expect(piso.getByText('Puedes mirar, pero no tocar nada.')).toHaveCount(0);
  // Arriba, solo volver y su nombre con su puerta
  await expect(piso.getByRole('button', { name: 'Volver al portal' })).toBeVisible();
  await expect(piso.locator('.ed-bar__quien')).toContainText('Bruno');
  await expect(piso.locator('.ed-bar__quien')).toContainText('1.º A');
  // La habitación ocupa la pantalla
  const lienzo = await piso.locator('.plab-stage').boundingBox();
  expect(lienzo.height).toBeGreaterThan(vp.height * 0.9);

  // Junto a la puerta, la caja de regalo y el post-it, dentro de la pantalla, con su nombre al llegar
  const caja = piso.getByRole('button', { name: 'Dejarle un regalo a Bruno' });
  const postit = piso.getByRole('button', { name: 'Dejarle un post-it a Bruno' });
  await expect(caja).toBeVisible();
  await expect(postit).toBeVisible();
  for (const b of [await caja.boundingBox(), await postit.boundingBox()]) {
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
    expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
    expect(b.width).toBeGreaterThanOrEqual(44);
  }
  await page.waitForTimeout(900);
  await shot(page, info, '1-llegada');
  await expect(piso.locator('.ed-visita3d__objetos')).not.toHaveClass(/is-llegando/, { timeout: 8000 });
  await page.waitForTimeout(500);
  await shot(page, info, '2-su-piso');

  // La caja: una nota pequeña con lo que te sobra; se regala y la caja se cierra con su etiqueta
  await caja.click();
  const nota = piso.getByRole('dialog', { name: 'Un regalo para Bruno' });
  await expect(nota).toBeVisible();
  const n = await nota.boundingBox();
  expect(n.height).toBeLessThan(vp.height * 0.62);
  await expect(nota.getByRole('group', { name: 'Elige qué regalarle' }).getByRole('button')).toHaveText(['Puf×2']);
  await nota.getByRole('button', { name: /^Puf/ }).click();
  await page.waitForTimeout(300);
  await shot(page, info, '3-regalo');
  await nota.getByRole('button', { name: 'Regalar puf a Bruno' }).click();
  await expect(nota.getByText('Le has regalado: puf. Le aparecerá en su balda. Mañana podrás regalar otro.')).toBeVisible();
  expect(mock.db.piso_inventario[BRUNO.id].puf).toBe(1);
  expect(mock.db.piso_inventario[ANA.id].puf).toBe(1);
  await nota.getByRole('button', { name: 'Cerrar la nota' }).click();
  await expect(nota).toHaveCount(0);
  const hecha = piso.getByRole('button', { name: 'Ya le has hecho tu regalo de hoy a Bruno; mañana, otro' });
  await expect(hecha).toHaveClass(/is-hecho/);
  await expect(hecha).toBeFocused();

  // El post-it: la misma nota pequeña con el post-it de siempre; también se puede dejar un dibujo
  await postit.click();
  const np = piso.getByRole('dialog', { name: 'Un post-it para Bruno' });
  await expect(np).toBeVisible();
  await expect(np.getByRole('button', { name: 'O déjale un dibujo' })).toBeVisible();
  await np.getByLabel('Tu post-it para Bruno').fill('¡Qué estantería más bonita! Te dejo un puf para leer.');
  await page.waitForTimeout(300);
  await shot(page, info, '4-postit');
  await np.getByRole('button', { name: 'Dejar el post-it' }).click();
  await expect(np.getByText(/Post-it enviado/)).toBeVisible();
  expect(tablon.nota?.p_texto ?? tablon.nota?.texto ?? JSON.stringify(tablon.nota)).toContain('estantería');
  await page.waitForTimeout(300);
  await shot(page, info, '5-postit-enviado');
  // Escape cierra la nota y no saca del piso
  await page.keyboard.press('Escape');
  await expect(np).toHaveCount(0);
  await expect(piso.locator('.plab-stage[data-ready]')).toBeVisible();

  // Su estantería: sin libros compartidos, una nota que lo dice
  // Se busca en pantalla un punto que dé en la estantería (la de su sala se ve a la derecha)
  const punto = await page.evaluate(() => {
    const api = window.__pisoLab?.();
    if (!api) return null;
    for (let y = 200; y < innerHeight - 100; y += 24) for (let x = 20; x < innerWidth - 10; x += 20) if (api.hitAt(x, y) === 'estanteria') return { x, y };
    return null;
  });
  expect(punto).not.toBeNull();
  {
    await page.mouse.click(punto.x, punto.y);
    const ne = piso.getByRole('dialog', { name: 'La estantería de Bruno' });
    await expect(ne).toBeVisible();
    await expect(ne).toContainText('Bruno aún no ha compartido libros.');
    await shot(page, info, '6-estanteria');
    await ne.getByRole('button', { name: 'Cerrar la nota' }).click();
  }

  // Volver al portal
  await piso.getByRole('button', { name: 'Volver al portal' }).click();
  await expect(page.getByRole('dialog', { name: 'El edificio del puerto' })).toBeVisible({ timeout: 15000 });
  expect(errores).toEqual([]);
});
