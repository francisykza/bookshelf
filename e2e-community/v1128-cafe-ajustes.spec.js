// 1.128 (SPEC §128; lista de Francisco del 13-11-2026, tras el tostadero) · Ajustes del café: las indicaciones de la barra ya no
// tapan el objeto (la comanda se pliega durante el gesto y el excéntrico enseña solo el acertijo del paso; el encuadre deja el
// objeto en el hueco libre), las portadas de las fichas que Open Library no tiene salen de su misma edición en Google Books, la
// cámara va hacia el cliente al que atiendes, las exclamaciones rojas de lo nuevo y el sonido más suave. Capturas y vídeos en
// qa-report/cafe-ajustes/.
import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { hacerGesto, quieto } from './cafeBarra';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { generoDe, nombreOpcion, recetaPide } from '../src/features/edificio/cafe/cafeClientes';
import { ELIGE, ETAPAS, gestosDe } from '../src/features/edificio/cafe/cafeGestos';
import { cartaDe, umbralHito } from '../src/features/edificio/cafe/cafeNiveles';
import { desbloqueados } from '../src/features/edificio/cafe/cafeNuevo';
import { dayKey } from '../src/domain/dates';

const DIR = join('qa-report', 'cafe-ajustes');
const tam = (info) => info.project.name.replace(/^(chromium|webkit)-/, '$1-');
const HOY = dayKey();
const boton = (parte, valor, bebida) =>
  parte === 'grano' && bebida === 'te'
    ? valor === 'suave'
      ? 'Hoja verde · suave'
      : 'Hoja negra · intensa'
    : parte === 'grano' && bebida === 'chocolate'
      ? valor === 'suave'
        ? 'Cacao con leche'
        : 'Cacao negro'
      : nombreOpcion(parte, valor);
// Un ISBN válido que Open Library no tiene (en la prueba responde 404) y Google Books sí
const ISBN_SIN = '9788408176022';
const libro = (id, title, extra = {}) => ({
  id,
  title,
  author: `Autoría ${id}`,
  status: 'read',
  pageCount: 320,
  currentPage: 320,
  cover: '',
  categories: [],
  publishedDate: '2012',
  addedAt: '2026-10-01T10:00:00.000Z',
  finishedAt: '2026-10-20T10:00:00.000Z',
  quotes: [],
  ...extra,
});
const LIBROS = [
  libro('f', 'El dragón del muelle', { categories: ['Fantasy'], isbn: ISBN_SIN, cover: `https://covers.openlibrary.org/b/isbn/${ISBN_SIN}-L.jpg?default=false` }),
  libro('m', 'Crimen en la lonja', { categories: ['Mystery'] }),
  libro('a', 'Cartas de amor al puerto', { categories: ['Romance'] }),
  libro('s', 'Naves sobre la bahía', { categories: ['Science Fiction'] }),
  libro('n', 'Un libro sin más'),
];
const BALDA = { bienvenida: true, libros: LIBROS.map((b) => ({ clave: b.id, titulo: b.title, genero: generoDe(b), caja: 0, balda: 1 })) };
const SONIDO = { v: 1, on: true, decided: true, legacy: false, effects: 40, ambience: 15, music: 40, master: 80, ambienceId: 'none', musicId: 'tarde', lastAmbience: 'none', lastMusic: 'tarde' };
const semillas = (s, n) => Array.from({ length: n }, (_, k) => s + k * 7919);
/** Semillas en las que los clientes `ns` piden café (para que salga la palanca). */
function semillasCafe(ns, carta, desde) {
  // De 500 en 500: la paridad de unos clientes y otros va ligada a los miles
  for (let s = desde; s < desde + 900000; s += 500) {
    const ss = semillas(s, 9);
    if (ns.every((n) => recetaPide({ n, semilla: ss[n - 1] }, carta)[0] === 'cafe')) return ss;
  }
  throw new Error('ninguna semilla');
}

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

async function alCafe(page, estado, seeds) {
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 120, sin_raro: 3 } },
    piso_inventario: { [ANA.id]: { sillon: 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.libraries.push({ user_id: ANA.id, data: { books: LIBROS }, updated_at: new Date().toISOString(), version: 5 });
  await page.addInitScript(
    ({ books, sonido }) => {
      localStorage.setItem('bookshelf:signs-hint-done', 'true');
      localStorage.setItem('bookshelf:sonido:v1', JSON.stringify(sonido));
      if (!localStorage.getItem('bookshelf:v1'))
        localStorage.setItem('bookshelf:v1', JSON.stringify({ books, settings: { sound: true, sfx: true, uiVolume: 0.4 }, progress: { readingLog: [], pomodoros: [], claimed: {} } }));
    },
    { books: LIBROS, sonido: SONIDO },
  );
  await mock.attach(page, ANA);
  const plano = structuredClone(estado.plano ?? PLANO_INICIAL);
  const c = await simularCafe(
    page,
    { inaugurado: true, nombre: 'Taza y Lomo', inventario: cuenta(plano), libros: BALDA, ...estado, plano },
    { clientes: { hoy: HOY, semillas: seeds, quienes: [3], frases: [10] } },
  );
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('.panorama-nav__btn--next').click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Tablet: la comunidad y El edificio del puerto' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'El edificio del puerto', exact: true }).click();
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' }).click({ timeout: 15000 });
  const cafe = page.getByRole('dialog', { name: 'El café-librería del bajo' });
  await expect(cafe.locator('.cf3[data-ready="true"]')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__cafe3d?.settled() && window.__cafe3d.renders() > 0);
  return { cafe, c };
}

/** Lo que pisa la pista (su centro) o la notita del gesto: la comanda, la placa, el monedero, los botones de la derecha o la franja. */
const choques = (page) =>
  page.evaluate(() => {
    const zona = document.querySelector('.cf3-gesto[data-activo="true"]');
    const p = zona?.querySelector('.cf3-gesto__pista')?.getBoundingClientRect();
    const n = zona?.querySelector('.cf3-gesto__nota')?.getBoundingClientRect();
    if (!p) return ['sin pista'];
    const cx = p.x + p.width / 2;
    const cy = p.y + p.height / 2;
    const centro = { left: cx - 24, right: cx + 24, top: cy - 24, bottom: cy + 24 };
    const corta = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const out = [];
    for (const sel of ['.cf3-comanda', '.cf3-placa', '.cf3-monedero', '.cf3-hud__der', '.cf3-franja--atender', '.ed-bar__back']) {
      for (const el of document.querySelectorAll(sel)) {
        const b = el.getBoundingClientRect();
        if (!b.width) continue;
        if (corta(centro, b)) out.push(`pista/${sel}`);
        if (n && corta(n, b)) out.push(`nota/${sel}`);
      }
    }
    if (n && (n.left < 0 || n.right > innerWidth)) out.push('nota/fuera');
    return out;
  });

/** Prepara en la barra la receta pedida; antes de cada gesto, comprueba que nada tapa el objeto. */
async function prepararMidiendo(page, cafe, receta, { foto = null, fallos }) {
  const caja = cafe.locator('.cf3-franja--atender');
  const r = { bebida: receta[0], grano: receta[1], leche: receta[2], toque: receta[3] };
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await page.waitForFunction(() => window.__cafe3d.enBarra());
  for (const etapa of ETAPAS) {
    await expect(caja).toHaveAttribute('data-etapa', etapa);
    const parte = ELIGE[etapa];
    if (parte) {
      await quieto(page, 200);
      const p = r[parte] === 'frio' || r[parte] === 'vainilla' ? await page.evaluate((x) => window.__cafe3d.barraEnPantalla(x), `barra:${parte}:${r[parte]}`) : null;
      if (p?.front) await page.mouse.click(p.x, p.y);
      else
        await cafe
          .locator('.cf3-opciones')
          .getByRole('button', { name: boton(parte, r[parte], r.bebida), exact: true })
          .click();
    }
    for (const tipo of gestosDe(etapa, r)) {
      await expect(caja).toHaveAttribute('data-gesto', tipo);
      await quieto(page, 300);
      // Durante el gesto la comanda se queda en su título
      await expect(cafe.locator('.cf3-comanda')).toHaveAttribute('data-plegada', 'true');
      const c = await choques(page);
      if (c.length) fallos.push(`${tipo}: ${c.join(', ')}`);
      if (foto && ['palanca', 'manivela', 'apisonar'].includes(tipo)) await foto(`gesto-${tipo}`);
      await hacerGesto(page, cafe, tipo, { ayuda: false });
    }
  }
  await cafe.getByRole('button', { name: 'Llevársela' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'libro', { timeout: 20000 });
}

test('la barra: la comanda se pliega en el gesto, el excéntrico enseña un acertijo y nada tapa la palanca', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/.test(info.project.name), '360, 390, 430, escritorio y WebKit 390');
  test.setTimeout(300000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const foto = async (nombre) => page.screenshot({ path: join(DIR, `barra-${nombre}-${tam(info)}.png`) });
  const carta = cartaDe(0);
  const seeds = semillasCafe([1, 3], carta, 3000);
  const { cafe } = await alCafe(page, { nivel: 1, reputacion: 0, granos: 20 }, seeds);
  await quieto(page);
  const fallos = [];
  // El primero: café, con la palanca
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  await prepararMidiendo(page, cafe, recetaPide({ n: 1, semilla: seeds[0] }, carta), { foto, fallos });
  await foto('libro');
  await cafe.getByRole('button', { name: 'Solo el café' }).click();
  await cafe.getByRole('button', { name: 'Hasta luego' }).click();
  // El excéntrico (el 3.º): en «pide», sus cuatro acertijos; en la barra, solo el del paso
  await page.evaluate(() => document.querySelector('.cf3-tag--raro').click());
  const caja = cafe.locator('.cf3-franja--atender');
  await expect(caja).toHaveAttribute('data-paso', 'pide', { timeout: 20000 });
  await expect(cafe.locator('.cf3-comanda__acertijos li')).toHaveCount(4);
  await expect(cafe.locator('.cf3-comanda')).not.toHaveAttribute('data-un-acertijo', 'true');
  await foto('raro-pide');
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await page.waitForFunction(() => window.__cafe3d.enBarra());
  await expect(caja).toHaveAttribute('data-etapa', 'bebida');
  await expect(cafe.locator('.cf3-comanda')).toHaveAttribute('data-un-acertijo', 'true');
  await expect(cafe.locator('.cf3-comanda__acertijos li[data-ahora="true"]')).toHaveCount(1);
  await quieto(page, 300);
  await foto('raro-bebida');
  await cafe.getByRole('button', { name: 'Luego' }).click();
  await page.evaluate(() => document.querySelector('.cf3-tag--raro').click());
  await expect(caja).toHaveAttribute('data-paso', 'pide', { timeout: 20000 });
  await prepararMidiendo(page, cafe, recetaPide({ n: 3, semilla: seeds[2] }, carta), { foto: (n) => foto(`raro-${n}`), fallos });
  expect(fallos).toEqual([]);
  expect(errors).toEqual([]);
});

// Una imagen cualquiera de la app como portada de la prueba (más de 10 px: las de 1 px cuentan como «sin portada»)
const PORTADA = readFileSync(join('public', 'assets', 'icons', 'sections', 'biblioteca.webp'));

test('portadas por ISBN, la cámara hacia el cliente y la «!» roja de lo nuevo', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/.test(info.project.name), '360, 390, 430, escritorio y WebKit 390');
  test.setTimeout(240000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const foto = async (nombre) => page.screenshot({ path: join(DIR, `${nombre}-${tam(info)}.png`) });
  // Open Library no tiene la portada; Google Books, la de la misma edición
  const pedidasGoogle = [];
  await page.route('https://covers.openlibrary.org/**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.route('https://www.googleapis.com/books/v1/volumes**', (route) => {
    pedidasGoogle.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'X1',
            volumeInfo: {
              title: 'El dragón del muelle',
              authors: ['Autoría f'],
              industryIdentifiers: [{ type: 'ISBN_13', identifier: ISBN_SIN }],
              imageLinks: { thumbnail: 'http://books.google.com/books/content?id=X1&printsec=frontcover&img=1&zoom=1&edge=curl' },
            },
          },
        ],
      }),
    });
  });
  await page.route('https://books.google.com/**', (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: PORTADA }));
  // Nivel 2 con su segundo hito: el chocolate y los muebles del nivel 2 son nuevos (lo visto, lo del nivel 1)
  const rep = umbralHito(2, 2);
  const vistos = desbloqueados(0);
  await page.addInitScript((v) => {
    if (!localStorage.getItem('bookshelf:cafe-visto')) localStorage.setItem('bookshelf:cafe-visto', JSON.stringify({ cafe: v }));
  }, vistos);
  const carta = cartaDe(rep);
  const seeds = semillasCafe([1], carta, 9000);
  const soloF = { bienvenida: true, libros: [{ clave: 'f', titulo: LIBROS[0].title, genero: generoDe(LIBROS[0]), caja: 0, balda: 3 }] };
  const { cafe } = await alCafe(page, { nivel: 2, reputacion: rep, granos: 400, libros: soloF }, seeds);
  await quieto(page);
  // La «!» en Decorar
  const decorar = cafe.getByRole('button', { name: /^Decorar ?, nuevo$/ });
  await expect(decorar.first()).toBeVisible();
  await foto('nuevo-decorar');
  await decorar.first().click();
  const tabTienda = cafe.getByRole('tab', { name: /^Tienda ?, nuevo$/ });
  await expect(tabTienda).toBeVisible();
  await tabTienda.click();
  await expect(cafe.locator('.cf3-mueble--tienda[data-nuevo="true"]').first()).toBeVisible();
  const nuevosTienda = await cafe.locator('.cf3-mueble--tienda[data-nuevo="true"]').count();
  expect(nuevosTienda).toBeGreaterThan(0);
  // Visto: la pestaña ya no lo marca, las tarjetas sí mientras sigues en Decorar
  await expect(cafe.getByRole('tab', { name: 'Tienda', exact: true })).toBeVisible();
  await cafe.locator('.cf3-mueble--tienda[data-nuevo="true"]').first().scrollIntoViewIfNeeded();
  await quieto(page, 300);
  await foto('nuevo-tienda');
  await cafe.getByRole('button', { name: 'Listo' }).click();
  await expect(cafe.getByRole('button', { name: 'Decorar', exact: true }).first()).toBeVisible({ timeout: 15000 });
  await expect(cafe.locator('.cf3-nuevo')).toHaveCount(0);
  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:cafe-visto')).cafe);
  expect(guardado.some((k) => k.startsWith('mueble:') && !vistos.includes(k))).toBe(true);
  // La cámara va hacia el cliente al que atiendes
  await quieto(page);
  const antes = await page.evaluate(() => window.__cafe3d.pose());
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  await expect(cafe.locator('.cf3-franja--atender')).toHaveAttribute('data-paso', 'pide', { timeout: 20000 });
  await quieto(page);
  const despues = await page.evaluate(() => window.__cafe3d.pose());
  expect(Math.hypot(despues.x - antes.x, despues.y - antes.y)).toBeGreaterThan(0.5);
  await foto('camara-cliente');
  // En la barra, el chocolate es nuevo; al elegir la bebida se da por visto
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await page.waitForFunction(() => window.__cafe3d.enBarra());
  const caja = cafe.locator('.cf3-franja--atender');
  await expect(caja).toHaveAttribute('data-etapa', 'bebida');
  await expect(cafe.locator('.cf3-opcion[data-opcion="chocolate"][data-nuevo="true"]')).toBeVisible();
  await quieto(page, 300);
  await foto('nuevo-barra');
  const receta = recetaPide({ n: 1, semilla: seeds[0] }, carta);
  await cafe
    .locator('.cf3-opciones')
    .getByRole('button', { name: boton('bebida', receta[0]), exact: true })
    .click();
  await expect(cafe.locator('.cf3-opcion[data-nuevo="true"]')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:cafe-visto')).cafe.includes('carta:chocolate'))).toBe(true);
  await cafe.getByRole('button', { name: 'Luego' }).click();
  // Las fichas: la portada de Google Books de ese ISBN (Open Library no la tiene)
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  await expect(caja).toHaveAttribute('data-paso', 'pide', { timeout: 20000 });
  await prepararMidiendo(page, cafe, receta, { fallos: [] });
  await expect(cafe.locator('.cf3-ficha__portada[src*="books.google.com"]').first()).toBeVisible({ timeout: 15000 });
  expect(pedidasGoogle.some((u) => decodeURIComponent(u).includes(`isbn:${ISBN_SIN}`))).toBe(true);
  await foto('fichas-portada');
  expect(errors).toEqual([]);
});
