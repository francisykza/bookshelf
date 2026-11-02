// 1.71 (SPEC §71) · Vecinos, con Supabase simulado: en el piso de un vecino, «me gusta» a un mueble tocándolo, firmar
// su libro de visitas con una frase cerrada y regalarle una copia libre; en el tuyo, el buzón del portal enseña
// regalos y firmas, y tus muebles dicen cuántos «me gusta» tienen. La autorización real está en
// src/features/edificio/__tests__/vecinos.rls.test.js.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { starterRoom } from '../src/features/edificio/demo.js';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222', email: 'bruno@ejemplo.test' };
const SOFA = { uid: 1, id: 'sofa', x: 3, y: 1, rot: 0, tono: 1 };

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

function seed() {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.vecinosSocial = true;
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true }, { user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'lector-farol', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'edificio-1', puerta: '2B' }, { user_id: BRUNO.id, edificio: 'edificio-1', puerta: '1A' });
  mock.db.pisos.push({ user_id: ANA.id, layout: starterRoom() }, { user_id: BRUNO.id, layout: { v: 1, pared: 'salvia', suelo: 'damero', items: [SOFA, { uid: 2, id: 'mesa-baja', x: 3, y: 4, rot: 0, tono: 0 }] } });
  // Ana tiene lo de su piso inicial y dos pufs guardados (libres)
  const inv = {};
  for (const i of starterRoom().items) inv[i.id] = (inv[i.id] ?? 0) + 1;
  inv.puf = 2;
  mock.db.piso_cuentas = { [ANA.id]: { inicio_elegido: true, tickets: 30, sin_raro: 0 }, [BRUNO.id]: { inicio_elegido: true, tickets: 30, sin_raro: 0 } };
  mock.db.piso_inventario = { [ANA.id]: inv, [BRUNO.id]: { sofa: 1, 'mesa-baja': 1 } };
  return mock;
}

async function toPortal(page, mock, user) {
  await mock.attach(page, user);
  await page.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  return page.getByRole('dialog', { name: 'El edificio del puerto' });
}

test('en el piso de un vecino: me gusta, libro de visitas y regalo', async ({ page }, info) => {
  test.skip(!/320x640|390x844|1440x900/.test(info.project.name), '320, 390 (Chromium y WebKit) y escritorio');
  const mock = seed();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const panel = await toPortal(page, mock, ANA);
  await panel.getByRole('button', { name: 'Llamar y entrar en el piso de Bruno, 1.º A' }).click({ timeout: 15000 });
  const bruno = page.getByRole('dialog', { name: 'Piso de Bruno' });
  const tabs = bruno.getByRole('tablist', { name: 'Qué hacer' });
  await expect(tabs.getByRole('tab')).toHaveText(['Buzón', 'Libro de visitas', 'Regalar']);
  // El buzón de siempre sigue a mano
  await expect(bruno.getByRole('button', { name: 'Menuda estantería' })).toBeVisible();

  // «Me gusta» al sofá, tocándolo en la habitación
  await expect(bruno.locator('canvas.ep-canvas')).toBeVisible();
  const at = await page.evaluate(() => window.__edificioPiso.screenOfItem(1));
  await page.mouse.click(at.x, at.y);
  const like = bruno.getByRole('button', { name: /^Me gusta: sofá/ });
  await expect(like).toHaveAttribute('aria-pressed', 'false');
  await like.click();
  await expect(bruno.getByRole('button', { name: 'Me gusta: sofá (1)' })).toHaveAttribute('aria-pressed', 'true');
  expect(mock.db.piso_megusta).toEqual([expect.objectContaining({ piso: BRUNO.id, de: ANA.id, uid: 1, mueble: 'sofa' })]);
  await shot(page, info, 'v171-megusta');

  // Libro de visitas: una frase cerrada
  await tabs.getByRole('tab', { name: 'Libro de visitas' }).click();
  await bruno.getByRole('button', { name: 'Vuelvo pronto' }).click();
  await expect(bruno.getByText('Has firmado su libro: «Vuelvo pronto».')).toBeVisible();
  await expect(bruno.getByRole('button', { name: 'Vuelvo pronto' })).toHaveAttribute('aria-pressed', 'true');
  expect(mock.db.piso_visitas).toEqual([expect.objectContaining({ piso: BRUNO.id, de: ANA.id, frase: 'pronto' })]);
  await shot(page, info, 'v171-libro');

  // Regalar: solo lo libre (los pufs); se elige y se confirma
  await tabs.getByRole('tab', { name: 'Regalar' }).click();
  await expect(bruno.getByRole('button', { name: /^Sillón/ })).toHaveCount(0);
  await bruno.getByRole('button', { name: 'Puf (tienes 2 libres)' }).click();
  await shot(page, info, 'v171-regalar');
  await bruno.getByRole('button', { name: 'Regalar puf a Bruno' }).click();
  await expect(bruno.getByText('Le has regalado: puf. Le aparecerá en su balda.')).toBeVisible();
  await expect(bruno.getByRole('button', { name: 'Puf (tienes 1 libre)' })).toBeVisible();
  expect(mock.db.piso_inventario[BRUNO.id].puf).toBe(1);
  expect(mock.db.piso_inventario[ANA.id].puf).toBe(1);
  expect(errors).toEqual([]);
});

test('en tu piso: el buzón enseña regalos y firmas, y tus muebles sus «me gusta»', async ({ page }, info) => {
  test.skip(!/390x844|1440x900/.test(info.project.name), '390 (Chromium y WebKit) y escritorio');
  const mock = seed();
  mock.db.piso_regalos = [{ de: ANA.id, para: BRUNO.id, mueble: 'puf', creado: new Date().toISOString() }];
  mock.db.piso_visitas = [{ piso: BRUNO.id, de: ANA.id, dia: new Date().toISOString().slice(0, 10), frase: 'cafe', creado: new Date().toISOString() }];
  mock.db.piso_megusta = [{ piso: BRUNO.id, de: ANA.id, uid: 1, mueble: 'sofa' }];
  const panel = await toPortal(page, mock, BRUNO);
  // 1.73: el buzón está dibujado en la fachada; asoma una carta con cuántas cosas hay y se abre al tocarlo
  await expect(panel.getByRole('button', { name: 'Tu buzón: 2 cosas' })).toBeVisible({ timeout: 15000 });
  await expect(panel.locator('.ed-facade')).not.toHaveClass(/is-arriving/, { timeout: 5000 });
  await shot(page, info, 'v173-buzon-carta');
  await panel.getByRole('button', { name: 'Tu buzón: 2 cosas' }).click();
  const inbox = panel.getByRole('region', { name: 'Tu buzón' });
  await expect(inbox.getByText('Ana lectora te regaló: puf.')).toBeVisible({ timeout: 15000 });
  await expect(inbox.getByText('Ana lectora firmó en tu libro de visitas: «Otro día traigo café».')).toBeVisible();
  await shot(page, info, 'v171-buzon');
  // Tocar fuera cierra la nota
  await panel.locator('.ed-facade__art').click({ position: { x: 20, y: 20 } });
  await expect(inbox).toBeHidden();
  await panel.getByRole('button', { name: /^Entrar en tu piso/ }).click();
  const mine = page.getByRole('dialog', { name: 'Tu piso' });
  await mine.getByRole('button', { name: 'Terminar' }).click();
  const at = await page.evaluate(() => window.__edificioPiso.screenOfItem(1));
  await page.mouse.click(at.x, at.y);
  await expect(mine.locator('.ep-status')).toHaveText('Sofá · 1 me gusta');
  // En tu piso no hay «Me gusta» que dar
  await expect(mine.getByRole('button', { name: /^Me gusta/ })).toHaveCount(0);
});

test('sin la migración de vecinos: el piso del vecino se queda con los sellos de siempre', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), '390 (Chromium y WebKit)');
  const mock = seed();
  mock.db.vecinosSocial = false;
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const panel = await toPortal(page, mock, ANA);
  await panel.getByRole('button', { name: 'Llamar y entrar en el piso de Bruno, 1.º A' }).click({ timeout: 15000 });
  const bruno = page.getByRole('dialog', { name: 'Piso de Bruno' });
  await expect(bruno.getByRole('heading', { name: 'Dejar un sello en su buzón' })).toBeVisible();
  await expect(bruno.getByRole('tablist')).toHaveCount(0);
  const at = await page.evaluate(() => window.__edificioPiso.screenOfItem(1));
  await page.mouse.click(at.x, at.y);
  await expect(bruno.locator('.ep-status')).toHaveText('Sofá');
  await expect(bruno.getByRole('button', { name: /^Me gusta/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});
