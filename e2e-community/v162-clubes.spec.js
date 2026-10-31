// QA del bloque 4 de la 1.62 (SPEC §62.4): clubes dentro del cuaderno, contra el simulador de Supabase. Pestañas
// Lectura / Conversación / Miembros; la conversación en orden de lectura, de 20 en 20, con los spoilers plegados al
// recibirlos y el redactor por encima del teclado; administrar y archivar en el menú del propietario, con confirmación
// y nunca entre mensajes; quien no es propietario solo puede salir. Sin adjuntos. Perfiles de prueba; nada equivale a un
// iPhone real. Las autorizaciones del servidor las comprueba `entrega3.rls.test.js` (Postgres real con RLS).
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BRUNO = { id: '22222222-2222-4222-8222-222222222222', email: 'bruno@ejemplo.test' };
const CLUB = '90000000-0000-4000-8000-000000000001';

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots-community', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

/** Ana es propietaria de «Lecturas junto al mar», Bruno es miembro; 25 mensajes y el último de Bruno con spoilers. */
function seed() {
  const mock = createMockSupabase();
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana', avatar_id: 'lectora-cafe', community_enabled: true }, { user_id: BRUNO.id, alias: 'Bruno', avatar_id: 'lector-farol', community_enabled: true });
  const t0 = Date.now() - 3 * 864e5;
  mock.db.clubs.push({ id: CLUB, owner: ANA.id, name: 'Lecturas junto al mar', description: 'Leemos despacio, con té.', work_id: null, work_title: 'Circe', discussion_point: 'hasta el capítulo 5', status: 'active', created_at: new Date(t0).toISOString(), updated_at: new Date(t0).toISOString() });
  mock.db.club_members.push({ club_id: CLUB, user_id: ANA.id, role: 'owner', joined_at: new Date(t0).toISOString() }, { club_id: CLUB, user_id: BRUNO.id, role: 'member', joined_at: new Date(t0).toISOString() });
  for (let i = 1; i <= 25; i += 1) {
    const last = i === 25;
    mock.db.club_messages.push({
      id: `a0000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      club_id: CLUB,
      user_id: i % 2 ? BRUNO.id : ANA.id,
      body: last ? 'Al final Odiseo vuelve y todo cambia' : `Mensaje ${i} sobre Circe`,
      has_spoilers: last,
      status: 'visible',
      created_at: new Date(t0 + i * 60000).toISOString(),
      edited_at: null,
    });
  }
  return mock;
}

async function openClub(page, mock, user, { keyboard = false } = {}) {
  if (keyboard) {
    // visualViewport simulado: el teclado deja 430 px visibles y desplaza la vista 120 px
    await page.addInitScript(() => {
      let open = false;
      const vv = Object.assign(new EventTarget(), { offsetLeft: 0, scale: 1, pageTop: 0, pageLeft: 0 });
      Object.defineProperties(vv, { height: { get: () => (open ? 430 : innerHeight) }, width: { get: () => innerWidth }, offsetTop: { get: () => (open ? 120 : 0) } });
      Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => vv });
      window.__keyboard = (next) => {
        open = next;
        vv.dispatchEvent(new Event('resize'));
      };
    });
  }
  await mock.attach(page, user);
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (sessionStorage.getItem('v162c')) return;
    sessionStorage.setItem('v162c', '1');
    history.replaceState({ bookshelf: { loc: { view: 'room', panel: { type: 'social', tab: 'club' } }, depth: 0, parent: null } }, '');
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Lecturas junto al mar/ }).click();
  const club = page.locator('.club-view');
  await expect(club.getByRole('tab', { name: 'Conversación' })).toHaveAttribute('aria-selected', 'true');
  return club;
}

test('club como propietaria: conversación por orden, spoilers plegados, redactor, Lectura, Miembros, administrar y archivar', async ({ page }, info) => {
  test.skip(!/390x844|320x640|430x932|1440x900/.test(info.project.name), 'móviles, escritorio y WebKit 390');
  const mock = seed();
  const club = await openClub(page, mock, ANA);
  // Tres pestañas a la vista y sin desbordar
  const tabs = club.getByRole('tab');
  await expect(tabs).toHaveCount(3);
  for (const name of ['Lectura', 'Conversación', 'Miembros']) await expect(club.getByRole('tab', { name })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // Contexto del debate (sin prometer bloqueo por capítulo)
  await expect(club).toContainText('Debate: hasta el capítulo 5');
  await expect(club).toContainText('Los mensajes con spoilers se ocultan');
  // Los 20 últimos, en orden de lectura; el último (con spoilers) está plegado y a la vista
  const msgs = club.locator('.club-msg');
  await expect(msgs).toHaveCount(20);
  await expect(msgs.first()).toContainText('Mensaje 6 sobre Circe');
  await expect(msgs.last()).toContainText('Contiene spoilers');
  await expect(msgs.last()).not.toContainText('Odiseo');
  await expect(msgs.last()).toBeInViewport();
  // Sin adjuntos
  await expect(club.locator('input[type="file"]')).toHaveCount(0);
  await shot(page, info, 'v162-club-conversacion');
  // Mensajes anteriores: arriba, y se mantienen en orden
  await club.getByRole('button', { name: 'Ver mensajes anteriores' }).click();
  await expect(msgs).toHaveCount(25);
  await expect(msgs.first()).toContainText('Mensaje 1 sobre Circe');
  await expect(club.getByRole('button', { name: 'Ver mensajes anteriores' })).toHaveCount(0);
  // Mostrar el spoiler es una decisión de quien lee
  await msgs.last().getByRole('button', { name: /Contiene spoilers/ }).click();
  await expect(msgs.last()).toContainText('Odiseo');
  // Publicar con aviso de spoilers: queda al final y plegado
  const composer = club.locator('.club-composer');
  await expect(composer).toBeInViewport();
  await composer.getByLabel('Mensaje para el club').fill('La isla de Eea me ha encantado');
  await composer.getByRole('checkbox', { name: 'Contiene spoilers' }).check();
  await composer.getByRole('button', { name: 'Publicar' }).click();
  await expect(msgs).toHaveCount(26);
  await expect(msgs.last()).toContainText('Contiene spoilers');
  await expect(composer.getByLabel('Mensaje para el club')).toHaveValue('');
  expect(mock.db.club_messages.filter((m) => m.body === 'La isla de Eea me ha encantado' && m.has_spoilers)).toHaveLength(1);
  // Entre los mensajes no hay acciones de administrar ni archivar
  await expect(club.locator('.club-msgs')).not.toContainText(/Archivar|Administrar/);
  // Lectura
  await club.getByRole('tab', { name: 'Lectura' }).click();
  await expect(club.locator('.club-reading__work')).toContainText('Circe');
  await expect(club).toContainText('Leemos despacio, con té.');
  await shot(page, info, 'v162-club-lectura');
  // Miembros: la propietaria puede retirar a Bruno (con confirmación)
  await club.getByRole('tab', { name: 'Miembros' }).click();
  await expect(club.locator('.club-member')).toHaveCount(2);
  await expect(club.locator('.club-member').first()).toContainText('Propietario');
  await expect(club.getByRole('button', { name: 'Retirar a Bruno del club' })).toBeVisible();
  await shot(page, info, 'v162-club-miembros');
  // Menú del propietario: administrar y archivar
  await club.getByRole('button', { name: 'Opciones del propietario del club' }).click();
  await expect(page.getByRole('menuitem')).toHaveText(['Administrar el club', 'Archivar el club']);
  await shot(page, info, 'v162-club-menu');
  await page.getByRole('menuitem', { name: 'Administrar el club' }).click();
  await expect(club.getByLabel('Punto de debate')).toHaveValue('hasta el capítulo 5');
  await expect(club.getByRole('button', { name: 'Crear enlace de invitación' })).toBeVisible();
  await shot(page, info, 'v162-club-administrar');
  await club.getByRole('button', { name: 'Volver al club' }).click();
  // Archivar pide confirmación; cancelar no cambia nada
  await club.getByRole('button', { name: 'Opciones del propietario del club' }).click();
  await page.getByRole('menuitem', { name: 'Archivar el club' }).click();
  const confirm = page.getByRole('alertdialog', { name: /Archivar el club/ });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Cancelar' }).click();
  expect(mock.db.clubs[0].status).toBe('active');
  await club.getByRole('button', { name: 'Opciones del propietario del club' }).click();
  await page.getByRole('menuitem', { name: 'Archivar el club' }).click();
  await page.getByRole('alertdialog', { name: /Archivar el club/ }).getByRole('button', { name: 'Sí' }).click();
  await expect(club).toContainText('Este club está archivado');
  expect(mock.db.clubs[0].status).toBe('archived');
  await club.getByRole('tab', { name: 'Conversación' }).click();
  await expect(club.locator('.club-composer')).toHaveCount(0);
});

test('club como miembro: sin administrar ni archivar ni retirar; solo salir, con confirmación', async ({ page }, info) => {
  test.skip(!/390x844|1440x900/.test(info.project.name), '390 (Chromium y WebKit) y escritorio');
  const mock = seed();
  const club = await openClub(page, mock, BRUNO);
  await club.getByRole('button', { name: 'Opciones del club' }).click();
  await expect(page.getByRole('menuitem')).toHaveText(['Salir del club']);
  await page.keyboard.press('Escape');
  await expect(club.getByRole('button', { name: 'Opciones del propietario del club' })).toHaveCount(0);
  await club.getByRole('tab', { name: 'Miembros' }).click();
  await expect(club.getByRole('button', { name: /Retirar a/ })).toHaveCount(0);
  // Sus mensajes se pueden editar y borrar; los de otra persona, denunciar o bloquear (nunca retirar)
  await club.getByRole('tab', { name: 'Conversación' }).click();
  const own = club.locator('.club-msg', { hasText: 'Mensaje 23 sobre Circe' });
  await own.getByRole('button', { name: /Opciones del mensaje/ }).click();
  await expect(page.getByRole('menuitem')).toHaveText(['Editar', 'Borrar']);
  await page.keyboard.press('Escape');
  const other = club.locator('.club-msg', { hasText: 'Mensaje 24 sobre Circe' });
  await other.getByRole('button', { name: /Opciones del mensaje/ }).click();
  await expect(page.getByRole('menuitem')).toHaveText(['Denunciar', 'Bloquear a Ana']);
  await page.keyboard.press('Escape');
  // Salir pide confirmación
  await club.getByRole('button', { name: 'Opciones del club' }).click();
  await page.getByRole('menuitem', { name: 'Salir del club' }).click();
  await page.getByRole('alertdialog', { name: /Salir del club/ }).getByRole('button', { name: 'Sí' }).click();
  await expect(page.locator('.club-view')).toHaveCount(0);
  expect(mock.db.club_members.some((m) => m.user_id === BRUNO.id)).toBe(false);
});

test('redactor por encima del teclado: con la parte visible reducida sigue a la vista y se puede enviar', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), 'teclado simulado en 390 (Chromium y WebKit)');
  const mock = seed();
  const club = await openClub(page, mock, ANA, { keyboard: true });
  const field = club.getByLabel('Mensaje para el club');
  await field.focus();
  await page.evaluate(() => window.__keyboard(true));
  await page.waitForTimeout(250);
  const box = await club.locator('.club-composer').boundingBox();
  // Dentro de la parte visible (120 + 430) y con el envío pulsable
  expect(box.y).toBeGreaterThanOrEqual(120);
  expect(box.y + box.height).toBeLessThanOrEqual(120 + 430 + 1);
  await field.fill('Escrito con el teclado abierto');
  await club.getByRole('button', { name: 'Publicar' }).click();
  await expect(club.locator('.club-msg').last()).toContainText('Escrito con el teclado abierto');
  await shot(page, info, 'v162-club-teclado');
});
