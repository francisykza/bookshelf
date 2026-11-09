// Tablón libre: el mueble y el monitor son objetos independientes, el lienzo guarda de verdad y la visita solo mira.
// Servidor simulado para la interfaz; los permisos reales están en tablon.rls.test.js sobre Postgres.
import { expect, test } from '@playwright/test';
import { createMockSupabase } from './mockSupabase';

const ANA = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@ejemplo.test' };
const BEA = { id: '22222222-2222-4222-8222-222222222222' };
const sala = (tablon) => ({ v: 1, pared: 'yeso', suelo: 'tablas', items: [{ uid: 1, id: 'sillon', tono: 1, x: 4, y: 6, rot: 2 }, ...(tablon ? [{ uid: 2, id: 'escritorio', x: 3, y: 0, rot: 0, tono: 0 }] : [])] });
const QUOTES = [{ id: 'c1', text: 'Una cita privada del Diario', page: 3, color: 'amber', createdAt: '2026-10-01' }];
const DATOS = { version: 8, books: [{ id: 'b1', title: 'El libro del puerto', author: 'Marina Sol', status: 'reading', cover: '', quotes: QUOTES, addedAt: '2026-01-01' }], settings: { sound: false, sfx: false, onboardingDone: true }, progress: { readingLog: [], pomodoros: [], claimed: {} } };
const CARD = (n, extra = {}) => ({ id: `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, kind: 'note', body: `Nota ${n}`, x: 80 + (n % 10) * 260, y: 60 + Math.floor(n / 10) * 230, width: 240, height: 180, rotation: (n % 5) - 2, z: n, paper: ['crema', 'salvia', 'azul', 'melocoton'][n % 4], pin: 'laton', sticker: null, spoiler: false, caption: null, cover: null, source_ref: null, received_note_id: null, ...extra });

function tablero(items = [], edges = [], extra = {}) {
  return { revision: 1, title: 'Lecturas de otoño', items, edges, acepta: false, publico: null, recibidas: [], ...extra };
}

/** El servidor de mentira: solo lo que usa la interfaz. Cuenta los guardados y conserva la revisión. */
async function servidor(page, t, log) {
  await page.route(/\/rest\/v1\/rpc\/(tablon_[a-z_]+)/, async (route) => {
    const name = route.request().url().match(/rpc\/(tablon_[a-z_]+)/)[1];
    const body = route.request().postDataJSON() ?? {};
    log.push(name);
    const json = (v) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) });
    if (t.falla === name) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'red' }) });
    if (name === 'tablon_cargar') return json({ tablero: { acepta: t.acepta, activa: 'c1', publica: t.publico ? 'c1' : null }, composiciones: [{ id: 'c1', title: t.title, visibility: t.publico ? 'public' : 'private', revision: t.revision }], actual: { id: 'c1', title: t.title, visibility: 'private', revision: t.revision, bounds: {}, items: t.items, edges: t.edges }, recibidas: t.recibidas, sin_leer: t.recibidas.filter((n) => !n.read_at).length, avisos: [] });
    if (name === 'tablon_guardar') {
      if (body.base !== t.revision) return json({ conflicto: true, revision: t.revision });
      t.revision += 1;
      t.items = body.nuevos;
      t.edges = body.hilos;
      t.title = body.titulo;
      return json({ revision: t.revision });
    }
    if (name === 'tablon_leer_nota') t.recibidas = t.recibidas.map((n) => (n.id === body.nota ? { ...n, read_at: 'hoy' } : n));
    if (name === 'tablon_publicar') {
      t.publico = { items: t.items.map(({ source_ref: _s, ...i }) => i), edges: t.edges };
      return json({ publicada: true, revision: t.revision });
    }
    if (name === 'tablon_visita') return json({ publico: t.publico ? { title: t.title, bounds: {}, revision: 1, ...t.publico } : null, acepta: true, enviada_hoy: t.enviada ?? false, proximo: '2026-11-10T00:00:00Z' });
    if (name === 'tablon_enviar_dibujo') {
      t.enviada = true;
      t.dibujoEnviado = body;
      return json({ id: 'n8', repetida: false });
    }
    if (name === 'tablon_enviar_nota') {
      t.enviada = true;
      t.enviadas = (t.enviadas ?? 0) + 1;
      return json({ id: 'n9', repetida: false });
    }
    return json(null);
  });
}

function simulador(conMueble) {
  const mock = createMockSupabase({ edificio_vecinos: [] });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana', avatar_id: 'gato-lector', community_enabled: true }, { user_id: BEA.id, alias: 'Bea', avatar_id: 'lector-farol', community_enabled: true });
  mock.db.edificio_vecinos.push({ user_id: ANA.id, edificio: 'e1', puerta: '2B' }, { user_id: BEA.id, edificio: 'e1', puerta: '1A' });
  mock.db.pisos.push({ user_id: ANA.id, layout: sala(conMueble) }, { user_id: BEA.id, layout: sala(true) });
  mock.db.follows.push({ follower: ANA.id, followed: BEA.id });
  mock.db.libraries.push({ user_id: ANA.id, data: DATOS, updated_at: new Date().toISOString(), version: 5 });
  return mock;
}

async function abrir(browser, t, { conMueble = true, reducido = false, video = false } = {}) {
  const context = await browser.newContext({ baseURL: 'http://localhost:5196', locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: reducido ? 'reduce' : 'no-preference', ...(video ? { recordVideo: { dir: 'qa-report/tablon-video', size: { width: 390, height: 844 } } } : {}) });
  const page = await context.newPage();
  const log = [];
  await page.addInitScript((d) => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!localStorage.getItem('bookshelf:v1')) localStorage.setItem('bookshelf:v1', JSON.stringify(d));
  }, DATOS);
  await simulador(conMueble).attach(page, ANA);
  await servidor(page, t, log);
  await page.goto('/?inicio=habitacion');
  await expect(page.locator('.plab-stage[data-ready]')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(900);
  return { context, page, log };
}
const probe = (page, id) => page.evaluate((x) => window.__pisoLab().probe(x), id);
const girar = (page, v) => page.evaluate((x) => window.__pisoLab().setYawForTest(x), v);
/** Gira hasta tener el objeto dentro del encuadre. */
async function mirarA(page, id) {
  const [a, b] = await page.evaluate(() => window.__pisoLab().yawRange());
  for (let k = 0; k <= 20; k += 1) {
    await girar(page, a + ((b - a) * k) / 20);
    await page.waitForTimeout(40);
    const p = await probe(page, id);
    if (p?.hit === id && p.x > 60 && p.x < 330) return p;
  }
  throw new Error(`no se encuentra ${id}`);
}
async function abrirTablon(page) {
  const p = await mirarA(page, 'tablon');
  await page.touchscreen.tap(p.x, p.y);
  await expect(page.locator('.tb-app')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.tb-map')).toBeVisible();
}
const disenar = (page) => page.getByRole('button', { name: 'Diseñar' }).click();
const organizar = async () => {};
const tarjeta = (page, n) => page.locator(`[data-item="${CARD(n).id}"]`);
const guardado = (page) => expect(page.locator('.tb-status')).toContainText('Guardado', { timeout: 6000 });

async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i += 1) await page.mouse.move(from.x + ((to.x - from.x) * i) / 6, from.y + ((to.y - from.y) * i) / 6);
  await page.mouse.up();
}
const centro = async (loc) => {
  const b = await loc.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

test('A · monitor y tablón llevan cada uno a lo suyo, y un arrastre no abre nada', async ({ browser }) => {
  test.setTimeout(120000);
  const { context, page } = await abrir(browser, tablero([CARD(0, { x: 60, y: 60, body: 'Capítulo tres' }), CARD(1, { x: 420, y: 90, body: 'Volver a leer' }), CARD(2, { x: 200, y: 340, body: 'Idea del final' }), CARD(3, { x: 560, y: 370, kind: 'quote', body: 'Una cita copiada del Diario', caption: 'El libro del puerto' }), CARD(4, { x: 840, y: 90, kind: 'book', body: 'El libro del puerto', caption: 'Marina Sol', height: 260, width: 200 })], [{ id: 'e1000000-0000-4000-8000-000000000001', source_item_id: CARD(0).id, target_item_id: CARD(2).id, source_anchor: 'pin', target_anchor: 'pin', color: 'terracota', label: null }]));
  const fallos = [];
  page.on('console', (m) => m.type() === 'error' && /texSubImage|texImage/.test(m.text()) && fallos.push(m.text()));
  await page.waitForTimeout(600);
  const t = await mirarA(page, 'tablon');
  await page.waitForTimeout(500);
  expect(fallos).toEqual([]);
  await page.screenshot({ path: 'qa-report/tablon-1-mueble-y-monitor.png' });
  await drag(page, { x: t.x, y: t.y }, { x: t.x + 60, y: t.y });
  await page.waitForTimeout(300);
  await expect(page.locator('.tb-app')).toHaveCount(0);
  await abrirTablon(page);
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(page.locator('.tb-app')).toHaveCount(0);
  await page.waitForTimeout(900);
  const m = await mirarA(page, 'ordenador');
  await page.touchscreen.tap(m.x, m.y);
  await expect(page.locator('.pp-desk')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.tb-app')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tablón', exact: true })).toHaveCount(0);
  await context.close();
});

test('A · el hueco, la mesa y la pared no abren ni el ordenador ni el tablón; movimiento reducido entra directo', async ({ browser }) => {
  test.setTimeout(120000);
  const { context, page } = await abrir(browser, tablero(), { reducido: true });
  const m = await mirarA(page, 'ordenador');
  // Bajo el monitor queda la mesa; junto al monitor y junto al tablón, la pared: el primer punto que ya no es de ninguno
  const libre = async (id, p) => {
    for (let dx = 4; dx < 150; dx += 4) for (const signo of [1, -1]) {
      const hit = await page.evaluate(([x, y]) => window.__pisoLab().hitAt(x, y), [p.x + dx * signo, p.y]);
      if (hit === null) return { x: p.x + dx * signo, y: p.y };
      if (hit !== id) break;
    }
    throw new Error('sin hueco');
  };
  const junto = await mirarA(page, 'tablon');
  const puntos = [await libre('tablon', junto)];
  const conMesa = await mirarA(page, 'ordenador');
  let bajo = null;
  for (let dy = 16; dy < 160 && !bajo; dy += 4) if ((await page.evaluate(([x, y]) => window.__pisoLab().hitAt(x, y), [conMesa.x, conMesa.y + dy])) === null) bajo = { x: conMesa.x, y: conMesa.y + dy };
  expect(bajo).not.toBeNull();
  puntos.push(bajo);
  for (const q of puntos) {
    // Cada punto se comprueba con la vista con la que se ha medido
    if (q === puntos[0]) await mirarA(page, 'tablon');
    else await mirarA(page, 'ordenador');
    await page.waitForTimeout(120);
    expect(await page.evaluate(([x, y]) => window.__pisoLab().hitAt(x, y), [q.x, q.y])).toBeNull();
    await page.touchscreen.tap(q.x, q.y);
    await page.waitForTimeout(250);
    await expect(page.locator('.pp-desk')).toHaveCount(0);
    await expect(page.locator('.tb-app')).toHaveCount(0);
  }
  const t = await mirarA(page, 'tablon');
  await page.touchscreen.tap(t.x, t.y);
  await expect(page.locator('.tb-app')).toBeVisible({ timeout: 1500 });
  await context.close();
});

test('B · organizar: mover, deshacer, conectar, guardar una vez por gesto y reabrir', async ({ browser }) => {
  test.setTimeout(150000);
  const t = tablero([CARD(1), CARD(2), CARD(3, { body: 'x'.repeat(200) })]);
  const { context, page, log } = await abrir(browser, t);
  await abrirTablon(page);
  const antes = await tarjeta(page, 1).boundingBox();
  // En Ver, arrastrar no modifica
  await drag(page, await centro(tarjeta(page, 1)), { x: antes.x + 60, y: antes.y + 90 });
  await page.waitForTimeout(350);
  expect(log.filter((x) => x === 'tablon_guardar')).toHaveLength(0);

  await page.screenshot({ path: 'qa-report/tablon-5-vista.png' });
  await disenar(page);
  await page.waitForTimeout(250);
  const c = await centro(tarjeta(page, 1));
  await drag(page, c, { x: c.x + 40, y: c.y + 70 });
  await guardado(page);
  expect(log.filter((x) => x === 'tablon_guardar')).toHaveLength(1);
  const x1 = t.items.find((i) => i.id === CARD(1).id);
  expect(x1.y).toBeGreaterThan(CARD(1).y + 50);

  await page.getByRole('button', { name: 'Deshacer' }).click();
  await guardado(page);
  expect(t.items.find((i) => i.id === CARD(1).id).y).toBeCloseTo(CARD(1).y, 3);
  await page.getByRole('button', { name: 'Rehacer' }).click();
  await guardado(page);
  expect(t.items.find((i) => i.id === CARD(1).id).y).toBeGreaterThan(CARD(1).y + 50);

  await page.getByRole('button', { name: 'Conectar' }).click();
  await page.touchscreen.tap(...Object.values(await centro(tarjeta(page, 1))));
  await page.touchscreen.tap(...Object.values(await centro(tarjeta(page, 2))));
  await guardado(page);
  expect(t.edges).toHaveLength(1);

  // El hilo sigue al ancla al mover la tarjeta
  await page.getByRole('button', { name: 'Cancelar' }).click();
  const hilo = page.locator('.tb-thread').first();
  const d0 = await hilo.getAttribute('d');
  const c2 = await centro(tarjeta(page, 2));
  await drag(page, c2, { x: c2.x, y: c2.y + 50 });
  await guardado(page);
  expect(await hilo.getAttribute('d')).not.toBe(d0);

  // Girar y cambiar de tamaño con sus asas
  await page.touchscreen.tap(...Object.values(await centro(tarjeta(page, 2))));
  await page.waitForTimeout(200);
  const size = await centro(tarjeta(page, 2).locator('.tb-handle--size'));
  const ancho = t.items.find((i) => i.id === CARD(2).id).width;
  await drag(page, size, { x: size.x + 30, y: size.y + 20 });
  await guardado(page);
  expect(t.items.find((i) => i.id === CARD(2).id).width).toBeGreaterThan(ancho + 20);
  const turn = await centro(tarjeta(page, 2).locator('.tb-handle--turn'));
  const giro = t.items.find((i) => i.id === CARD(2).id).rotation;
  await drag(page, turn, { x: turn.x + 50, y: turn.y + 10 });
  await guardado(page);
  expect(t.items.find((i) => i.id === CARD(2).id).rotation).not.toBeCloseTo(giro, 0);
  await page.screenshot({ path: 'qa-report/tablon-2-mapa-organizado.png' });

  // Reabrir desde el otro acceso conserva lo guardado
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.waitForTimeout(900);
  await abrirTablon(page);
  await expect(page.locator('.tb-thread')).toHaveCount(1);
  await context.close();
});

test('B · editor a 390 px con el teclado: 200 caracteres, Guardar alcanzable y Atrás respeta el borrador', async ({ browser }) => {
  test.setTimeout(120000);
  const t = tablero([CARD(1)]);
  const { context, page } = await abrir(browser, t);
  await abrirTablon(page);
  await disenar(page);
  await page.getByRole('button', { name: 'Añadir' }).click();
  await page.getByRole('button', { name: 'Nota', exact: true }).click();
  const area = page.locator('.tb-sheet textarea');
  await area.fill('y'.repeat(260));
  await expect(area).toHaveValue('y'.repeat(200));
  await expect(page.getByText('200 / 200')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Hay cambios sin guardar' })).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Seguir editando' }).click();
  await expect(area).toHaveValue('y'.repeat(200));
  await area.fill('Una idea sobre el capítulo tres');
  await page.setViewportSize({ width: 390, height: 500 });
  await page.waitForTimeout(150);
  const guardar = page.getByRole('button', { name: 'Guardar', exact: true });
  await expect(guardar).toBeInViewport();
  await page.screenshot({ path: 'qa-report/tablon-3-editor.png' });
  await guardar.click();
  await page.setViewportSize({ width: 390, height: 844 });
  await guardado(page);
  expect(t.items.some((i) => i.body === 'Una idea sobre el capítulo tres')).toBe(true);
  // Vista de lista accesible
  await page.getByRole('button', { name: 'Menú', exact: true }).click();
  await page.getByRole('button', { name: 'Ver como lista' }).click();
  await expect(page.getByRole('list', { name: 'Tarjetas en lista' })).toContainText('Una idea sobre');
  await context.close();
});

test('C · una cita se copia solo tras confirmar y un fallo de red conserva el borrador', async ({ browser }) => {
  test.setTimeout(120000);
  const t = tablero([CARD(1)]);
  const { context, page } = await abrir(browser, t);
  await abrirTablon(page);
  await disenar(page);
  t.falla = 'tablon_guardar';
  await page.getByRole('button', { name: 'Añadir' }).click();
  await page.getByRole('button', { name: 'Cita de mi Diario' }).click();
  await page.getByRole('button', { name: /Una cita privada/ }).click();
  await expect(page.getByRole('button', { name: 'Copiar al tablón' })).toBeVisible();
  expect(t.items).toHaveLength(1);
  await page.getByRole('button', { name: 'Copiar al tablón' }).click();
  await expect(page.locator('.tb-status')).toContainText('Error', { timeout: 6000 });
  await expect(page.locator('[data-kind="quote"]')).toBeVisible();
  const borrador = await page.evaluate((id) => localStorage.getItem(`bookshelf:tablon:borrador:${id}`), ANA.id);
  expect(borrador).toContain('Una cita privada');
  delete t.falla;
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await guardado(page);
  expect(t.items.find((i) => i.kind === 'quote').source_ref).toBe('c1');
  await context.close();
});

test('C · si otra sesión cambia el mapa, no se sobrescribe', async ({ browser }) => {
  test.setTimeout(120000);
  const t = tablero([CARD(1)]);
  const { context, page } = await abrir(browser, t);
  await abrirTablon(page);
  t.revision = 9;
  await disenar(page);
  await page.waitForTimeout(250);
  const c = await centro(tarjeta(page, 1));
  await drag(page, c, { x: c.x + 30, y: c.y + 30 });
  await expect(page.locator('.tb-status')).toContainText('Conflicto', { timeout: 6000 });
  expect(t.items[0].x).toBe(CARD(1).x);
  await context.close();
});

test('C · 100 tarjetas y 150 hilos: solo se monta lo cercano y el gesto sigue respondiendo', async ({ browser }) => {
  test.setTimeout(120000);
  const items = Array.from({ length: 100 }, (_, n) => CARD(n));
  const edges = Array.from({ length: 150 }, (_, n) => ({ id: `e0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, source_item_id: CARD(n % 100).id, target_item_id: CARD((n * 7 + 3) % 100).id, source_anchor: 'pin', target_anchor: 'pin', color: 'azul', label: null }));
  const { context, page } = await abrir(browser, tablero(items, edges));
  await abrirTablon(page);
  await disenar(page);
  await page.getByRole('button', { name: 'Acercar' }).click();
  for (let i = 0; i < 6; i += 1) await page.getByRole('button', { name: 'Acercar' }).click();
  await page.waitForTimeout(200);
  expect(await page.locator('.tb-card').count()).toBeLessThan(100);
  const ms = await page.evaluate(async () => {
    const t0 = performance.now();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return performance.now() - t0;
  });
  expect(ms).toBeLessThan(500);
  await context.close();
});

test('D · recibir: leer marca solo esa nota, colocar va al mapa y publicar pide vista previa', async ({ browser }) => {
  test.setTimeout(120000);
  const recibidas = [
    { id: 'b0000000-0000-4000-8000-000000000001', sender_id: BEA.id, alias: 'Bea', body: 'Hola desde el segundo', style: 'azul', spoiler: false, author_allows_public: true, created_at: '2026-11-09', read_at: null, withdrawn_at: null },
    { id: 'b0000000-0000-4000-8000-000000000002', sender_id: BEA.id, alias: 'Bea', body: 'Otra', style: 'crema', spoiler: true, author_allows_public: false, created_at: '2026-11-08', read_at: null, withdrawn_at: null },
  ];
  const t = tablero([CARD(1)], [], { recibidas });
  const { context, page, log } = await abrir(browser, t);
  await abrirTablon(page);
  await page.getByRole('button', { name: 'Recibidas, 2' }).click();
  await page.locator('.tb-received__open').first().click();
  await expect(page.locator('.tb-detail')).toContainText('Hola desde el segundo');
  await page.getByRole('dialog', { name: 'Recibida' }).getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('button', { name: 'Recibidas, 1' })).toBeAttached({ timeout: 5000 });
  await expect.poll(() => t.recibidas.filter((n) => n.read_at).length).toBe(1);
  await page.getByRole('button', { name: 'Colocar en mapa' }).first().click();
  await guardado(page);
  expect(t.items.find((i) => i.kind === 'received').received_note_id).toBe(recibidas[0].id);
  await page.getByRole('button', { name: 'Menú', exact: true }).click();
  await page.getByRole('button', { name: 'Publicar…' }).click();
  await expect(page.locator('.tb-preview .tb-card')).toHaveCount(2);
  expect(log).not.toContain('tablon_publicar');
  await page.getByRole('button', { name: 'Publicar esta composición' }).click();
  await expect(page.getByText('Composición publicada.')).toBeVisible({ timeout: 6000 });
  await context.close();
});

test('D · de visita solo se mira la copia pública, el spoiler se revela y el post-it no se duplica', async ({ browser }) => {
  test.setTimeout(150000);
  const t = tablero([], [], { publico: { items: [CARD(1, { body: 'Nota pública' }), CARD(2, { body: 'Final secreto', spoiler: true })], edges: [{ id: 'e1', source_item_id: CARD(1).id, target_item_id: CARD(2).id, source_anchor: 'pin', target_anchor: 'pin', color: 'azul', label: null }] } });
  const { context, page, log } = await abrir(browser, t);
  await page.getByRole('button', { name: 'Al edificio' }).click();
  await page.getByRole('dialog', { name: 'El edificio del puerto' }).getByRole('button', { name: 'Llamar y entrar en el piso de Bea, 1.º A' }).click();
  await page.getByRole('button', { name: 'Entrar en 3D' }).click({ timeout: 15000 });
  await expect(page.locator(`.ed-visita3d[data-visita="${BEA.id}"]`)).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Tablón de Bea' }).click({ timeout: 15000 });
  await expect(page.locator('.tb-map[data-mode="lectura"]')).toBeVisible();
  await expect(tarjeta(page, 2)).toContainText('Spoiler');
  await expect(tarjeta(page, 2)).not.toContainText('Final secreto');
  await expect(page.getByRole('button', { name: 'Diseñar' })).toHaveCount(0);
  const c = await centro(tarjeta(page, 1));
  await drag(page, c, { x: c.x, y: c.y + 12 });
  await page.waitForTimeout(150);
  expect(log).not.toContain('tablon_guardar');
  await page.screenshot({ path: 'qa-report/tablon-4-visita.png' });
  await page.touchscreen.tap(...Object.values(await centro(tarjeta(page, 2))));
  await page.getByRole('button', { name: 'Revelar spoiler' }).click();
  await expect(page.locator('.tb-detail')).toContainText('Final secreto');
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: 'Dejar un post-it' }).click();
  await page.locator('.tb-sheet textarea').fill('Qué bonito tablón');
  await expect(page.getByLabel('Permitir que lo exponga en su tablón público')).not.toBeChecked();
  await page.getByRole('button', { name: 'Dejar el post-it' }).dblclick();
  await expect(page.getByText('Post-it enviado.')).toBeVisible({ timeout: 6000 });
  expect(t.enviadas).toBe(1);
  await context.close();
});

async function trazar(page, puntos) {
  const c = await page.locator('.tb-dib__hoja').boundingBox();
  const a = (p) => ({ x: c.x + (p[0] * c.width) / 120, y: c.y + (p[1] * c.height) / 120 });
  await page.mouse.move(a(puntos[0]).x, a(puntos[0]).y);
  await page.mouse.down();
  for (const p of puntos.slice(1)) await page.mouse.move(a(p).x, a(p).y, { steps: 4 });
  await page.mouse.up();
}
const GATO = [[25, 100], [20, 60], [22, 22], [45, 40], [75, 40], [98, 22], [100, 60], [95, 100], [60, 110], [25, 100]];
const DIB = { v: 1, s: [{ c: 0, p: GATO.flat() }, { c: 0, p: [43, 62, 46, 66] }, { c: 0, p: [77, 62, 74, 66] }, { c: 1, p: [56, 76, 64, 76, 60, 81, 56, 76] }] };

test('E · quien visita ve un dibujo publicado y deja el suyo como forma, sin duplicarlo y con el mismo cupo', async ({ browser, browserName }) => {
  test.setTimeout(150000);
  const t = tablero([], [], { publico: { items: [CARD(1, { x: 60, y: 60, body: 'Pasad y dejad algo' }), CARD(2, { x: 360, y: 40, kind: 'drawing', body: '', dibujo: DIB, recortado: true, width: 240, height: 240 })], edges: [] } });
  const { context, page } = await abrir(browser, t, { video: browserName === 'chromium' });
  await page.getByRole('button', { name: 'Al edificio' }).click();
  await page.getByRole('dialog', { name: 'El edificio del puerto' }).getByRole('button', { name: 'Llamar y entrar en el piso de Bea, 1.º A' }).click();
  await page.getByRole('button', { name: 'Entrar en 3D' }).click({ timeout: 15000 });
  await expect(page.locator('.ed-visita3d[data-visita="' + BEA.id + '"]')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Tablón de Bea' }).click({ timeout: 15000 });
  await expect(tarjeta(page, 2).locator('.tb-card__dibujo')).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'qa-report/tablon-dibujo-visita.png' });
  await page.getByRole('button', { name: 'Dejar un dibujo' }).click();
  await trazar(page, GATO);
  await page.waitForTimeout(300);
  await trazar(page, [[43, 62], [46, 66]]);
  await trazar(page, [[77, 62], [74, 66]]);
  await page.getByRole('button', { name: 'Rojo' }).click();
  await trazar(page, [[56, 76], [64, 76], [60, 81], [56, 76]]);
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'La forma' }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'qa-report/tablon-dibujo-enviar.png', fullPage: false });
  await expect(page.getByLabel('Permitir que lo exponga en su tablón público')).not.toBeChecked();
  await page.getByRole('button', { name: 'Dejar el dibujo' }).dblclick();
  await expect(page.getByText('Dibujo enviado.')).toBeVisible({ timeout: 6000 });
  expect(t.dibujoEnviado.forma).toBe(true);
  expect(t.dibujoEnviado.permite_publico).toBe(false);
  expect(t.dibujoEnviado.trazos.s).toHaveLength(4);
  expect(t.enviadas ?? 0).toBe(0);
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: 'Dejar un post-it' }).click();
  await expect(page.getByText(/Ya le has dejado un post-it o un dibujo hoy/)).toBeVisible({ timeout: 6000 });
  await page.waitForTimeout(800);
  const video = page.video();
  await context.close();
  if (video) await video.saveAs('qa-report/tablon-dibujo.webm');
});

test('E · el dueño dibuja, clava, cambia entre hoja y forma, y el dibujo recibido se ve y se coloca', async ({ browser, browserName }) => {
  test.setTimeout(150000);
  const recibida = { id: 'd0000000-0000-4000-8000-000000000001', sender_id: BEA.id, alias: 'Bea', body: '', dibujo: DIB, recortado: true, style: 'crema', spoiler: false, author_allows_public: true, created_at: '2026-11-09T10:00:00Z', read_at: null, withdrawn_at: null };
  const t = tablero([CARD(1, { x: 60, y: 60, body: 'Volver al capítulo tres' })], [], { acepta: true, recibidas: [recibida] });
  const { context, page, log } = await abrir(browser, t);
  await abrirTablon(page);
  await disenar(page);
  await page.getByRole('button', { name: /^Añadir/ }).click();
  await page.getByRole('button', { name: 'Dibujo', exact: true }).click();
  await trazar(page, [[30, 30], [90, 30], [90, 90], [30, 90], [30, 30]]);
  await page.getByRole('button', { name: 'Rojo' }).click();
  await trazar(page, [[50, 60], [70, 60]]);
  await page.getByRole('button', { name: 'La forma' }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'qa-report/tablon-dibujo-editor.png' });
  await page.getByRole('button', { name: 'Clavar en el tablón' }).click();
  await guardado(page);
  const propio = t.items.find((i) => i.kind === 'drawing');
  expect(propio.recortado).toBe(true);
  expect(propio.dibujo.s).toHaveLength(2);
  expect(propio.dibujo.s[1].c).toBe(1);
  await page.getByRole('button', { name: /Recibidas/ }).click();
  await expect(page.locator('.tb-mini img')).toBeVisible();
  await page.getByRole('button', { name: 'Colocar en mapa' }).click();
  await guardado(page);
  const clavado = t.items.find((i) => i.kind === 'received');
  expect(clavado.dibujo).toEqual(DIB);
  const carta = page.locator(`[data-item="${clavado.id}"]`);
  await expect(carta).toHaveAttribute('data-forma', 'si');
  await page.screenshot({ path: 'qa-report/tablon-dibujo-forma.png' });
  await page.getByRole('button', { name: 'Editar' }).click();
  await page.getByRole('button', { name: 'La hoja' }).click();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await guardado(page);
  await expect(carta).not.toHaveAttribute('data-forma', 'si');
  expect(t.items.find((i) => i.kind === 'received').recortado).toBe(false);
  await page.getByRole('button', { name: 'Encajar' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'qa-report/tablon-dibujo-hoja.png' });
  expect(log.filter((n) => n === 'tablon_guardar').length).toBeGreaterThanOrEqual(3);
  await page.getByRole('button', { name: 'Volver' }).first().click();
  await expect(page.locator('.tb-app[data-view="mirar"]')).toBeVisible();
  await page.getByRole('button', { name: 'Volver' }).first().click();
  await expect(page.locator('.tb-app')).toHaveCount(0);
  await page.waitForTimeout(1200);
  await mirarA(page, 'tablon');
  await page.waitForTimeout(700);
  await expect(page.locator('.plab-board-sharp')).toBeVisible();
  await page.screenshot({ path: 'qa-report/tablon-dibujo-habitacion.png' });
  await context.close();
});

test('sin escritorio no hay tablón, ni en la habitación ni en el menú', async ({ browser }) => {
  test.setTimeout(120000);
  const t = tablero([CARD(1)]);
  const { context, page } = await abrir(browser, t, { conMueble: false });
  expect(await page.evaluate(() => window.__pisoLab().hasBoard())).toBe(false);
  await page.getByRole('button', { name: 'Menú de accesos' }).click();
  await expect(page.getByRole('button', { name: 'Tablón', exact: true })).toHaveCount(0);
  await context.close();
});

test('recorrido grabado: mirar el tablón desde el mueble y pasar a diseñar', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'el vídeo se graba una vez');
  test.setTimeout(120000);
  const uno = CARD(1, { x: 60, y: 70, body: 'Volver al capítulo tres antes de seguir', paper: 'crema' });
  const dos = CARD(2, { x: 350, y: 60, body: '¿Quién mandó la carta?', paper: 'azul', rotation: 2 });
  const cita = CARD(3, { x: 630, y: 90, kind: 'quote', body: 'Nadie cierra un libro del todo.', caption: 'El libro del puerto, p. 88', paper: 'crema', rotation: -2 });
  const libro = CARD(4, { x: 90, y: 310, kind: 'book', body: 'El libro del puerto', caption: 'Marina Sol', width: 190, height: 250, paper: 'crema', rotation: -3 });
  const correo = CARD(5, { x: 360, y: 320, kind: 'received', body: 'Me ha encantado tu estantería', firma: 'Bea', paper: 'salvia', rotation: 3 });
  const tres = CARD(16, { x: 640, y: 330, body: 'Idea para el final', paper: 'melocoton', rotation: -1 });
  const hilo = (id, a, b, color) => ({ id: `b0000000-0000-4000-8000-00000000000${id}`, source_item_id: a.id, target_item_id: b.id, source_anchor: 'pin', target_anchor: 'pin', color, label: null });
  const t = tablero([uno, dos, cita, libro, correo, tres], [hilo(1, uno, dos, 'terracota'), hilo(2, dos, tres, 'azul'), hilo(3, libro, correo, 'laton')]);
  const { context, page } = await abrir(browser, t, { video: true });
  await mirarA(page, 'tablon');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa-report/tablon-6-mueble.png' });
  await expect(page.locator('.plab-board-sharp')).toBeVisible();
  const nitido = await page.locator('.plab-board-sharp').boundingBox();
  const sobre = await probe(page, 'tablon');
  expect(sobre.x).toBeGreaterThan(nitido.x);
  expect(sobre.x).toBeLessThan(nitido.x + nitido.width);
  await abrirTablon(page);
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'qa-report/tablon-7-vista-completa.png' });
  await page.touchscreen.tap(...Object.values(await centro(tarjeta(page, 3))));
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'qa-report/tablon-8-nota-en-grande.png' });
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await page.waitForTimeout(500);
  await disenar(page);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa-report/tablon-9-disenar.png' });
  for (const ancho of [390, 360]) {
    await page.setViewportSize({ width: ancho, height: 800 });
    await page.waitForTimeout(200);
    const cajas = await page.locator('.tb-tool').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.right]));
    expect(Math.min(...cajas.map((c) => c[0]))).toBeGreaterThanOrEqual(8);
    expect(Math.max(...cajas.map((c) => c[1]))).toBeLessThanOrEqual(ancho - 8);
    await page.screenshot({ path: `qa-report/tablon-bandeja-${ancho}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  const c = await centro(tarjeta(page, 16));
  await drag(page, c, { x: c.x - 20, y: c.y + 40 });
  await guardado(page);
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Menú' }).click();
  await expect(page.getByRole('button', { name: 'Tablón', exact: true })).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'qa-report/tablon-10-menu.png' });
  const video = page.video();
  await context.close();
  await video.saveAs('qa-report/tablon-recorrido.webm');
});
