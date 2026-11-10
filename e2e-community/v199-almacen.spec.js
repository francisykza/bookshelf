// 1.99 (SPEC §99) · El Almacén del Puerto, con Supabase simulado: entrar, mirar un mueble, añadirlo, quitarlo, pagar y
// encontrarlo en el inventario; sin saldo, doble toque, fallo de red, el albarán del día y la visita con un amigo (dos
// páginas con la misma base simulada). Las reglas de verdad se prueban en almacen.rls.test.js. Capturas en
// qa-report/almacen/.
import { expect, test } from '@playwright/test';
import { ANA, BEA, alAlmacen, mockAlmacen, shot } from './almacenHelpers';
import { join } from 'node:path';

const settled = (page) => page.waitForFunction(() => window.__almacen3d.settled());

test('capturas del almacén: entrada, pasillos, ficha, caja', async ({ page }, info) => {
  test.skip(!/360x800|390x844|430x932|1440x900/.test(info.project.name), '360, 390, 430 y escritorio');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const mock = mockAlmacen();
  const { alm } = await alAlmacen(page, mock);
  await page.waitForTimeout(300);
  await shot(page, info, '1-entrada');
  for (const [name, x, y, yaw] of [
    ['2-pasillo1', 4.2, 18, Math.PI],
    ['3-pasillo2', 11, 18, Math.PI],
    ['4-pasillo3', 15.5, 18, Math.PI],
    ['5-ambientes', 4.2, 15, -Math.PI / 2],
    ['6-fondo', 8, 4.2, Math.PI],
    ['7-caja', 4.2, 21, 0],
  ]) {
    await page.evaluate(([x, y, yaw]) => window.__almacen3d.place(x, y, yaw), [x, y, yaw]);
    await page.waitForTimeout(200);
    await shot(page, info, name);
  }
  await page.evaluate(() => window.__almacen3d.place(4.2, 10, Math.PI / 2));
  await alm.getByRole('button', { name: 'Directorio' }).click();
  await page.waitForTimeout(250);
  await shot(page, info, '7b-directorio');
  await alm.locator('.alm-dir__item').filter({ has: page.getByText('Sillón', { exact: true }) }).first().click();
  await expect(alm.locator('.alm-card--ficha')).toBeVisible();
  await settled(page);
  await shot(page, info, '8-ficha');
  await alm.getByRole('button', { name: 'Añadir al carrito' }).click();
  await alm.getByRole('button', { name: /Añadir otro/ }).click();
  await alm.locator('.alm-card__back').click();
  await settled(page);
  // El carro de delante lleva los paquetes; tocarlo abre el carrito
  await page.evaluate(() => window.__almacen3d.place(4.2, 18, Math.PI));
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__almacen3d.cargaN())).toBe(2);
  await shot(page, info, '8b-carro');
  await alm.locator('.alm-bar').getByRole('button', { name: 'Caja' }).click();
  await settled(page);
  await shot(page, info, '9-caja');
  expect(errors).toEqual([]);
});

/** Abre la ficha de un mueble desde el directorio. */
async function ficha(alm, nombre) {
  await alm.locator('.alm-bar').getByRole('button', { name: 'Directorio' }).click();
  await alm.locator('.alm-dir__item').filter({ has: alm.page().getByText(nombre, { exact: true }) }).first().click();
  await expect(alm.locator('.alm-card--ficha h4')).toHaveText(nombre, { timeout: 20000 });
}
async function aCaja(alm) {
  await alm.locator('.alm-bar').getByRole('button', { name: 'Caja' }).click();
  await expect(alm.locator('.alm-card--caja')).toBeVisible();
}

/** Tras recargar, la sesión simulada sigue puesta: se vuelve al almacén por el mismo camino. */
async function volverAlAlmacen(page) {
  // La app recuerda dónde estabas: al recargar vuelve sola al hotel (si no, se va por el camino de siempre)
  const hotel = page.getByRole('dialog', { name: 'El Gran Hotel del Puerto' });
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.waitForTimeout(1500);
  if (!(await hotel.isVisible())) {
    await page.locator('.panorama-nav__btn--next').click();
    await page.waitForTimeout(950);
    await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
    await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
    await page.getByRole('dialog', { name: 'El edificio del puerto' }).getByRole('button', { name: 'Coger la limusina al Gran Hotel' }).click({ timeout: 15000 });
  }
  await hotel.getByRole('button', { name: 'Directorio' }).click({ timeout: 15000 });
  await hotel.getByRole('dialog', { name: 'Directorio' }).getByRole('button', { name: /almacén/i }).click();
  const alm = hotel.locator('section.alm');
  await expect(alm).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
  return alm;
}

test('recorrido: mirar, añadir, cambiar, quitar, pagar y tenerlo en casa', async ({ page }, info) => {
  test.skip(!/^(chromium-390x844|chromium-1440x900|webkit-390x844)$/.test(info.project.name), '390 (Chromium y WebKit) y escritorio');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const mock = mockAlmacen();
  const { alm } = await alAlmacen(page, mock);
  await ficha(alm, 'Sillón');
  await expect(alm.locator('.alm-ficha__datos')).toContainText('Ya tienes 1');
  await alm.locator('.alm-tono').nth(1).click();
  await alm.getByRole('button', { name: 'Añadir al carrito' }).click();
  await alm.getByRole('button', { name: /Añadir otro/ }).click();
  await expect(alm.getByRole('button', { name: 'Carrito: 2 artículos' })).toBeVisible();
  await alm.locator('.alm-card__back').click();
  await ficha(alm, 'Mesa baja');
  await alm.getByRole('button', { name: 'Añadir al carrito' }).click();
  await alm.locator('.alm-card__back').click();
  await alm.getByRole('button', { name: /^Carrito: / }).click();
  const carro = alm.locator('.alm-card--carrito');
  await expect(carro.locator('li')).toHaveCount(2);
  await carro.getByRole('button', { name: 'Uno menos de Sillón' }).click();
  await expect(carro.getByLabel('Cantidad de Sillón')).toHaveText('1');
  await carro.locator('li', { hasText: 'Mesa baja' }).getByRole('button', { name: 'Quitar' }).click();
  await expect(carro.locator('li')).toHaveCount(1);
  await shot(page, info, '10-carrito');
  await carro.getByRole('button', { name: 'Ir a caja' }).click();
  const pagar = alm.getByRole('button', { name: /Confirmar compra/ });
  await expect(pagar).toBeEnabled();
  const precio = Number((await pagar.textContent()).match(/(\d+) tickets/)[1]);
  await pagar.click();
  await expect(alm.locator('.alm-caja')).toContainText('Ya lo tienes todo en tu inventario');
  await settled(page);
  await shot(page, info, '11-pagado');
  expect(mock.db.piso_cuentas[ANA.id].tickets).toBe(100 - precio);
  expect(mock.db.piso_inventario[ANA.id].sillon).toBe(2);
  await alm.getByRole('button', { name: 'Seguir mirando' }).click();
  await expect(alm.getByRole('button', { name: 'Carrito: 0 artículos' })).toBeVisible();
  await ficha(alm, 'Sillón');
  await expect(alm.locator('.alm-ficha__datos')).toContainText('Ya tienes 2');
  expect(errors).toEqual([]);
});

test('sin saldo no se puede pagar; el doble toque cobra una vez', async ({ page }, info) => {
  test.skip(!/^(chromium|webkit)-390x844$/.test(info.project.name), '390 px (Chromium y WebKit)');
  const mock = mockAlmacen({ tickets: 1 });
  const { alm } = await alAlmacen(page, mock);
  await ficha(alm, 'Mesa');
  await alm.getByRole('button', { name: 'Añadir al carrito' }).click();
  await aCaja(alm);
  await expect(alm.locator('.alm-caja')).toContainText('te faltan');
  await expect(alm.getByRole('button', { name: /Confirmar compra/ })).toBeDisabled();
  await shot(page, info, '12-sin-saldo');
  // Con saldo (lo cuenta el servidor al volver a la caja), dos toques seguidos: una sola compra
  mock.db.piso_cuentas[ANA.id].tickets = 1000;
  await alm.locator('.alm-card__back').click();
  await aCaja(alm);
  const pagar = alm.getByRole('button', { name: /Confirmar compra/ });
  await expect(pagar).toBeEnabled();
  const precio = Number((await pagar.textContent()).match(/(\d+) tickets/)[1]);
  await pagar.dblclick();
  await expect(alm.locator('.alm-caja')).toContainText('Ya lo tienes todo');
  expect(mock.db.almacen.cobros).toBe(1);
  expect(mock.db.piso_cuentas[ANA.id].tickets).toBe(1000 - precio);
});

test('fallo de red: el carrito se queda y el reintento no cobra dos veces', async ({ page }, info) => {
  test.skip(!/^(chromium|webkit)-390x844$/.test(info.project.name), '390 px (Chromium y WebKit)');
  const mock = mockAlmacen({ tickets: 1000 });
  const { alm } = await alAlmacen(page, mock);
  await ficha(alm, 'Mesa');
  await alm.getByRole('button', { name: 'Añadir al carrito' }).click();
  await aCaja(alm);
  const pagar = alm.getByRole('button', { name: /Confirmar compra/ });
  const precio = Number((await pagar.textContent()).match(/(\d+) tickets/)[1]);
  // 1) La petición no llega al servidor: no se cobra y el carrito sigue
  mock.db.almacen.caida = 1;
  await pagar.click();
  await expect(alm.getByRole('alert')).toContainText('no se cobrará dos veces');
  await expect(alm.getByRole('button', { name: 'Carrito: 1 artículo' })).toBeVisible();
  expect(mock.db.piso_cuentas[ANA.id].tickets).toBe(1000);
  // 2) Se cobra pero la respuesta se pierde: el reintento recibe la misma compra
  mock.db.almacen.cortar = 1;
  await pagar.click();
  await expect(alm.getByRole('alert')).toBeVisible();
  await expect.poll(() => mock.db.piso_cuentas[ANA.id].tickets).toBe(1000 - precio);
  await expect(alm.getByRole('button', { name: 'Carrito: 1 artículo' })).toBeVisible();
  await shot(page, info, '13-fallo-red');
  await pagar.click();
  await expect(alm.locator('.alm-caja')).toContainText('Ya lo tienes todo');
  expect(mock.db.almacen.cobros).toBe(1);
  expect(mock.db.piso_cuentas[ANA.id].tickets).toBe(1000 - precio);
  expect(mock.db.piso_inventario[ANA.id].mesa).toBe(1);
});

test('el albarán: uno al día, recargar no lo repone y su descuento va en una compra', async ({ page }, info) => {
  test.skip(!/^(chromium|webkit)-390x844$/.test(info.project.name), '390 px (Chromium y WebKit)');
  test.setTimeout(120000);
  const mock = mockAlmacen({ tickets: 1000 });
  const { alm } = await alAlmacen(page, mock, ANA, { reduced: false });
  await ficha(alm, 'Mesa');
  await alm.getByRole('button', { name: 'Añadir al carrito' }).click();
  await alm.getByRole('button', { name: /Añadir otro/ }).click();
  await aCaja(alm);
  const subtotal = Number((await alm.getByRole('button', { name: /Confirmar compra/ }).textContent()).match(/(\d+) tickets/)[1]);
  await alm.getByRole('button', { name: 'Jugar el albarán' }).click();
  const boton = alm.getByRole('button', { name: '¡Sellar!' });
  await expect(boton).toBeVisible();
  // Se sella cuando la casilla llega a la marca (el albarán dice dónde va el plano; el acierto lo da el reloj al tocar)
  for (let k = 0; k < 3; k += 1) {
    await page.waitForFunction(
      () => {
        const a = document.querySelector('.alb');
        if (!a || a.dataset.pos == null || a.dataset.sellado != null) return false;
        const d = Number(a.dataset.pos) - Number(a.dataset.marca);
        return d > -0.05 && d < 0.015;
      },
      null,
      { timeout: 15000, polling: 16 },
    );
    if (k === 0) await shot(page, info, '14-albaran');
    await boton.click();
    if (k === 1) {
      await page.waitForTimeout(180);
      await shot(page, info, '14b-sellado');
    }
  }
  await page.waitForTimeout(500);
  await shot(page, info, '14c-cierre');
  await expect(alm.locator('.alm-albaran')).toContainText(/de 3 sellados/, { timeout: 20000 });
  const dia = Object.values(mock.db.almacen.dias)[0];
  const aciertos = dia.marcas.filter((m) => m === true).length;
  expect(aciertos).toBeGreaterThan(0);
  const pct = [0, 3, 6, 10][aciertos];
  await expect(alm.locator('.alm-albaran')).toContainText(`${pct} %`);
  await expect(alm.locator('.alm-albaran')).toContainText(/El albarán vuelve (mañana|hoy) a las/);
  // Al cerrar, la cámara vuelve a la caja y la hoja sellada queda en el resguardo
  await expect(page.locator('section.alm')).not.toHaveAttribute('data-mostrador', 'true', { timeout: 10000 });
  await settled(page);
  await page.waitForTimeout(1200);
  await shot(page, info, '15-albaran-hecho');
  // Recargar no devuelve el intento: el resultado sigue esperando a una compra
  await page.goto('/');
  const otra = await volverAlAlmacen(page);
  await aCaja(otra);
  await expect(otra.getByRole('button', { name: 'Jugar el albarán' })).toHaveCount(0);
  await expect(otra.locator('.alm-albaran')).toContainText(`${pct} %`);
  const total = subtotal - Math.floor((subtotal * pct) / 100);
  const pagar = otra.getByRole('button', { name: `Confirmar compra · ${total} tickets` });
  await expect(pagar).toBeEnabled();
  await pagar.click();
  await expect(otra.locator('.alm-caja')).toContainText('Ya lo tienes todo');
  expect(mock.db.piso_cuentas[ANA.id].tickets).toBe(1000 - total);
  expect(dia.usado).toBe(true);
  await otra.getByRole('button', { name: 'Seguir mirando' }).click();
  await ficha(otra, 'Mesa');
  await otra.getByRole('button', { name: 'Añadir al carrito' }).click();
  await aCaja(otra);
  await expect(otra.locator('.alm-albaran')).toContainText('Ya usaste el descuento de hoy');
  await expect(otra.getByRole('button', { name: 'Jugar el albarán' })).toHaveCount(0);
});

test('ofertas: se ven en el directorio, la ficha, la etiqueta y la caja, y se cobra el precio de oferta', async ({ page }, info) => {
  test.skip(!/^(chromium|webkit)-390x844$/.test(info.project.name), '390 px (Chromium y WebKit)');
  const ofertas = [
    { id: 'reloj', pct: 50, tipo: 'semana' },
    { id: 'mesa', pct: 20, tipo: 'dia' },
  ];
  const mock = mockAlmacen({ tickets: 1000, ofertas });
  const { alm } = await alAlmacen(page, mock);
  await alm.locator('.alm-bar').getByRole('button', { name: 'Directorio' }).click();
  const tablon = alm.getByRole('region', { name: 'Ofertas de hoy' });
  await expect(tablon).toContainText('Oferta de la semana');
  await expect(tablon.locator('.alm-dir__item', { hasText: 'Mesa' })).toContainText('16 tickets · −20 %');
  await page.waitForTimeout(250);
  await shot(page, info, '20-ofertas-directorio');
  await tablon.locator('.alm-dir__item', { hasText: 'Mesa' }).click();
  await expect(alm.locator('.alm-card--ficha h4')).toHaveText('Mesa', { timeout: 20000 });
  await expect(alm.locator('.alm-ficha__datos')).toContainText('Oferta del día · −20 %');
  await settled(page);
  await shot(page, info, '21-oferta-ficha');
  await alm.getByRole('button', { name: 'Añadir al carrito' }).click();
  await alm.getByRole('button', { name: /Añadir otro/ }).click();
  await alm.locator('.alm-card__back').click();
  await settled(page);
  await page.waitForTimeout(300);
  await expect(alm.locator('.alm-tag--precio[data-oferta="dia"]:not([data-off="true"])').first()).toBeVisible();
  await shot(page, info, '21b-oferta-etiqueta');
  await aCaja(alm);
  await expect(alm.locator('.alm-ticket').first()).toContainText('oferta −20 %');
  const pagar = alm.getByRole('button', { name: /Confirmar compra/ });
  await expect(pagar).toHaveText('Confirmar compra · 32 tickets');
  await settled(page);
  await shot(page, info, '22-oferta-caja');
  await pagar.click();
  await expect(alm.locator('.alm-caja')).toContainText('Ya lo tienes todo');
  await expect(alm.locator('.alm-caja')).toContainText('ahorras 8 tickets');
  expect(mock.db.piso_cuentas[ANA.id].tickets).toBe(968);
  await shot(page, info, '23-oferta-recibo');
});

test('visita con un amigo: os veis, «Mira esto», carritos y compras de cada uno', async ({ browser }, info) => {
  test.skip(!/^(chromium-390x844|webkit-390x844)$/.test(info.project.name), '390 px');
  test.setTimeout(120000);
  const mock = mockAlmacen();
  mock.db.follows.push({ follower: ANA.id, followed: BEA.id }, { follower: BEA.id, followed: ANA.id });
  const ca = await browser.newContext(info.project.use);
  const cb = await browser.newContext(info.project.use);
  const pa = await ca.newPage();
  const pb = await cb.newPage();
  const { alm: a } = await alAlmacen(pa, mock, ANA);
  const { alm: b } = await alAlmacen(pb, mock, BEA);
  await a.locator('.alm-bar').getByRole('button', { name: 'Con un amigo' }).click();
  await a.locator('.alm-amigos__lista li', { hasText: 'Bea' }).getByRole('button', { name: 'Invitar' }).click();
  await shot(pa, info, '16-invitar');
  await b.locator('.alm-bar').getByRole('button', { name: 'Con un amigo' }).click();
  await b.getByRole('button', { name: /Entrar con Ana/ }).click({ timeout: 10000 });
  await expect(a.locator('.alm-aviso-flota')).toContainText('Bea está en el almacén contigo', { timeout: 10000 });
  await expect(b.locator('.alm-aviso-flota')).toContainText('Ana lectora está en el almacén contigo', { timeout: 10000 });
  // Cada uno ve al otro donde está
  if (await a.locator('.alm-card__back').count()) await a.locator('.alm-card__back').click();
  if (await b.locator('.alm-card__back').count()) await b.locator('.alm-card__back').click();
  await pb.evaluate(() => window.__almacen3d.place(11, 15, 0));
  await pa.evaluate(() => window.__almacen3d.place(11, 20.5, Math.PI));
  await expect(a.locator('.alm-nombre', { hasText: 'Bea' })).toHaveAttribute('data-off', '', { timeout: 10000 });
  await pa.waitForTimeout(400);
  await shot(pa, info, '17-con-bea');
  // Ana señala un mueble; Bea decide si lo mira
  await ficha(a, 'Escritorio');
  await a.getByRole('button', { name: 'Mira esto' }).click();
  await expect(b.locator('.alm-mira')).toContainText('Ana lectora te señala: Escritorio', { timeout: 10000 });
  await shot(pb, info, '18-mira-esto');
  await b.locator('.alm-mira').getByRole('button', { name: 'Ver' }).click();
  await expect(b.locator('.alm-card--ficha h4')).toHaveText('Escritorio');
  // Carritos y compras de cada uno
  await a.getByRole('button', { name: 'Añadir al carrito' }).click();
  await expect(a.getByRole('button', { name: 'Carrito: 1 artículo' })).toBeVisible();
  await expect(b.getByRole('button', { name: 'Carrito: 0 artículos' })).toBeVisible();
  await aCaja(a);
  const pagar = a.getByRole('button', { name: /Confirmar compra/ });
  const precio = Number((await pagar.textContent()).match(/(\d+) tickets/)[1]);
  await pagar.click();
  await expect(a.locator('.alm-caja')).toContainText('Ya lo tienes todo');
  expect(mock.db.piso_cuentas[ANA.id].tickets).toBe(100 - precio);
  expect(mock.db.piso_cuentas[BEA.id].tickets).toBe(100);
  // Lo que viaja de uno a otro no lleva tickets ni carrito
  expect(JSON.stringify(mock.db.almacen.presencia)).not.toMatch(/tickets|carrito|lineas/);
  // Si Bea se va, Ana sigue en el almacén
  await cb.close();
  await expect(a.locator('.alm-aviso-flota')).toContainText('se ha ido', { timeout: 30000 });
  await expect(a.locator('.alm-bar')).toBeVisible();
  await ca.close();
});

test('la invitación llega estés donde estés del edificio y «Ir al almacén» te une', async ({ browser }, info) => {
  test.skip(!/^(chromium|webkit)-390x844$/.test(info.project.name), '390 px (Chromium y WebKit)');
  test.setTimeout(120000);
  const mock = mockAlmacen();
  mock.db.follows.push({ follower: ANA.id, followed: BEA.id }, { follower: BEA.id, followed: ANA.id });
  const ca = await browser.newContext(info.project.use);
  const cb = await browser.newContext(info.project.use);
  const pa = await ca.newPage();
  const pb = await cb.newPage();
  // Bea se queda en el portal del edificio
  await mock.attach(pb, BEA);
  await pb.addInitScript(() => localStorage.setItem('bookshelf:signs-hint-done', 'true'));
  await pb.emulateMedia({ reducedMotion: 'reduce' });
  await pb.goto('/');
  await pb.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await pb.locator('.panorama-nav__btn--next').click();
  await pb.waitForTimeout(950);
  await pb.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await pb.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  await expect(pb.getByRole('dialog', { name: 'El edificio del puerto' })).toBeVisible();
  // Ana la invita desde el almacén
  const { alm: a } = await alAlmacen(pa, mock, ANA);
  await a.locator('.alm-bar').getByRole('button', { name: 'Con un amigo' }).click();
  await a.locator('.alm-amigos__lista li', { hasText: 'Bea' }).getByRole('button', { name: 'Invitar' }).click();
  const nota = pb.locator('.ed-aviso');
  await expect(nota).toContainText('Ana lectora te invita a recorrer el almacén de muebles', { timeout: 30000 });
  await shot(pb, info, '19-aviso-portal');
  await nota.getByRole('button', { name: 'Ir al almacén' }).click();
  const b = pb.getByRole('dialog', { name: 'El Gran Hotel del Puerto' }).locator('section.alm');
  await expect(b).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
  await expect(a.locator('.alm-aviso-flota')).toContainText('Bea está en el almacén contigo', { timeout: 15000 });
  await expect(b.locator('.alm-aviso-flota')).toContainText('Ana lectora está en el almacén contigo', { timeout: 15000 });
  await ca.close();
  await cb.close();
});

// Vídeo del recorrido para la entrega (solo con ALMACEN_VIDEO=1): qa-report/almacen/recorrido-<proyecto>.webm
test('vídeo: recorrido del almacén de principio a fin', async ({ browser }, info) => {
  test.skip(!process.env.ALMACEN_VIDEO || !/^(chromium|webkit)-390x844$/.test(info.project.name), 'solo con ALMACEN_VIDEO=1');
  test.setTimeout(180000);
  const dir = join('qa-report', 'almacen', 'bruto');
  const context = await browser.newContext({ ...info.project.use, recordVideo: { dir, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  const mock = mockAlmacen();
  const { alm } = await alAlmacen(page, mock, ANA, { reduced: false });
  const lienzo = await alm.locator('canvas').first().boundingBox();
  const pausa = (ms) => page.waitForTimeout(ms);
  await pausa(1200);
  // Mirar alrededor arrastrando y andar tocando el suelo
  await page.mouse.move(lienzo.x + lienzo.width * 0.7, lienzo.y + lienzo.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(lienzo.x + lienzo.width * 0.3, lienzo.y + lienzo.height * 0.5, { steps: 25 });
  await page.mouse.up();
  await pausa(700);
  await page.mouse.move(lienzo.x + lienzo.width * 0.3, lienzo.y + lienzo.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(lienzo.x + lienzo.width * 0.7, lienzo.y + lienzo.height * 0.5, { steps: 25 });
  await page.mouse.up();
  await pausa(500);
  await page.mouse.click(lienzo.x + lienzo.width * 0.5, lienzo.y + lienzo.height * 0.82);
  await pausa(2200);
  // Directorio → el sillón, sus tonos y al carrito
  await ficha(alm, 'Sillón');
  await pausa(900);
  await alm.locator('.alm-tono').nth(1).click();
  await pausa(900);
  await alm.locator('.alm-tono').nth(3).click();
  await pausa(900);
  await alm.getByRole('button', { name: 'Añadir al carrito' }).click();
  await pausa(700);
  await alm.locator('.alm-card__back').click();
  await pausa(600);
  await ficha(alm, 'Mesa baja');
  await pausa(700);
  await alm.getByRole('button', { name: 'Añadir al carrito' }).click();
  await pausa(600);
  await alm.locator('.alm-card__back').click();
  // El carrito: uno más, uno menos, quitar
  await alm.getByRole('button', { name: /^Carrito: / }).click();
  const carro = alm.locator('.alm-card--carrito');
  await pausa(900);
  await carro.getByRole('button', { name: 'Uno más de Sillón' }).click().catch(() => {});
  await pausa(700);
  await carro.locator('li', { hasText: 'Mesa baja' }).getByRole('button', { name: 'Quitar' }).click();
  await pausa(900);
  // A la caja: el albarán y pagar
  await carro.getByRole('button', { name: 'Ir a caja' }).click();
  await settled(page);
  await pausa(900);
  await alm.getByRole('button', { name: 'Jugar el albarán' }).click();
  const boton = alm.getByRole('button', { name: '¡Sellar!' });
  for (let k = 0; k < 3; k += 1) {
    await page.waitForFunction(
      () => {
        const a = document.querySelector('.alb');
        if (!a || a.dataset.pos == null || a.dataset.sellado != null) return false;
        const d = Number(a.dataset.pos) - Number(a.dataset.marca);
        return d > -0.05 && d < 0.015;
      },
      null,
      { timeout: 15000, polling: 16 },
    );
    await boton.click();
  }
  await expect(alm.locator('.alm-albaran')).toContainText(/de 3 sellados/, { timeout: 20000 });
  await pausa(1500);
  await alm.getByRole('button', { name: /Confirmar compra/ }).click();
  await expect(alm.locator('.alm-caja')).toContainText('Ya lo tienes todo');
  await pausa(2200);
  await alm.getByRole('button', { name: 'Seguir mirando' }).click();
  await pausa(600);
  await ficha(alm, 'Sillón');
  await pausa(1500);
  await alm.locator('.alm-card__back').click();
  // El mercadillo de antes sigue a mano
  await alm.locator('.alm-bar').getByRole('button', { name: 'Mercadillo' }).click();
  await expect(page.getByRole('region', { name: 'La Lonja' })).toBeVisible({ timeout: 20000 });
  await pausa(1800);
  await page.getByRole('button', { name: 'Volver al almacén' }).click();
  await pausa(1500);
  const video = page.video();
  await context.close();
  const { copyFileSync } = await import('node:fs');
  copyFileSync(await video.path(), join('qa-report', 'almacen', `recorrido-${info.project.name}.webm`));
});
