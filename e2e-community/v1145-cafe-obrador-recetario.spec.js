// 1.145 (SPEC §145; docs/qa/cafe-libreria.md §18, bloque 3 de §18.12, aprobado por Francisco el 17-11-2026) · El recetario crece:
// las galletas del puerto (el cortapastas y la glasa), el bizcocho de la abuela (envolver la masa y espolvorear el azúcar por la
// plantilla), la tortilla de patatas al fogón (cascar los huevos y darle la vuelta) y el pan de la bodega (se amasa un día, duerme en
// la bodega y al día siguiente se greña); los hitos del obrador por piezas vendidas (un adorno y 20 granos cada uno), el favorito de
// cada habitual (+2) y el acertijo del excéntrico (la pista al fallar, el doble al acertar). Los gestos se hacen con el ratón como el
// dedo, con el mismo trazo que usan las manos de Pilar. El servidor simulado aplica las reglas de
// `20261227120000_cafe_obrador_recetario.sql` (con hornos de segundos, para no esperar). Capturas y vídeo con sonido en qa-report/v1145/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { hacerGesto, quieto } from './cafeBarra';
import { grabarSonido, guardarConSonido, sonidoGrabado } from './cafeSonido';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { PLANO_INICIAL, asientosDe, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { clientesDelNivel, generoDe, nombreOpcion } from '../src/features/edificio/cafe/cafeClientes';
import { ELIGE } from '../src/features/edificio/cafe/cafeGestos';
import { ACERTIJOS, GESTO_OBRADOR, HITOS_OBRADOR, MASA, PISTA_ACERTIJO } from '../src/features/edificio/cafe/cafeObrador';
import { trazoPilar } from '../src/features/edificio/cafe/cafeObradorGestos';
import { umbralHito } from '../src/features/edificio/cafe/cafeNiveles';
import { dayKey } from '../src/domain/dates';

const DIR = join('qa-report', 'v1145');
const tam = (info) => info.project.name.replace(/^(chromium|webkit)-/, '$1-');
const HOY = dayKey();
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
const LIBROS = [libro('f', 'El dragón del muelle', { categories: ['Fantasy'] }), libro('m', 'Crimen en la lonja', { categories: ['Mystery'] }), libro('n', 'Un libro sin más')];
const BALDA = { bienvenida: true, libros: LIBROS.map((b) => ({ clave: b.id, titulo: b.title, genero: generoDe(b), caja: 0, balda: 1 })) };
const SONIDO = { v: 1, on: true, decided: true, legacy: false, effects: 40, ambience: 15, music: 40, master: 80, ambienceId: 'none', musicId: 'tarde', lastAmbience: 'none', lastMusic: 'tarde' };
const PLANO_4 = {
  v: 1,
  items: [
    ...PLANO_INICIAL.items,
    { uid: 'a2', id: 'cafe-mesa-larga', x: -3, y: 1, rot: 0 },
    { uid: 'a3', id: 'cafe-banco', x: -3, y: 2, rot: 2 },
    { uid: 'a4', id: 'cafe-biombo', x: -2, y: 4, rot: 2 },
  ],
};
const REP = umbralHito(8, 1) + 30;
/** El excéntrico es el último cliente del día (los del nivel 8 con los asientos del plano). */
const EXC = clientesDelNivel(8, asientosDe(PLANO_4));
const semillas = (s, n) => Array.from({ length: n }, (_, k) => s + k * 7919);
const sonidos = (page) => page.evaluate(() => window.__cafeSonidos ?? []);
const RECETA = ['cafe', 'intenso', 'entera', 'canela'];
const ELIGE_DE = { bebida: 0, grano: 1, leche: 2, toque: 3 };
/** Los hornos, de segundos (para no esperar el minuto de verdad). */
const SEGUNDOS = { galletas: 90, bizcocho: 90, pan: 90, tortilla: 6, magdalenas: 90, empanada: 90 };

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

async function alCafe(page, estado, obrador, { reducido = false, clientes = 6 } = {}) {
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 120, sin_raro: 3 } },
    piso_inventario: { [ANA.id]: { sillon: 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.libraries.push({ user_id: ANA.id, data: { books: LIBROS }, updated_at: new Date().toISOString(), version: 5 });
  if (reducido) await page.emulateMedia({ reducedMotion: 'reduce' });
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
  const plano = structuredClone(PLANO_4);
  const c = await simularCafe(
    page,
    { inaugurado: true, nombre: 'Taza y Lomo', granos: 40, nivel: 8, reputacion: REP, plano, inventario: cuenta(plano), libros: BALDA, dominio: { cafe: 12, te: 12, chocolate: 12 }, ...estado },
    { clientes: { hoy: HOY, semillas: semillas(4100, clientes), quienes: [3], frases: [10] }, obrador: { abierto: true, horno: 3, segundos: SEGUNDOS, ...obrador } },
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

/** En el ala, unos pasos atrás, mirando al fondo: el obrador entero. */
async function anteElAla(page) {
  await page.evaluate(() => window.__cafe3d.place(-0.9, 4.6, Math.atan2(-2 + 0.9, 0.3 - 4.6)));
  await quieto(page);
}

/** Al recetario, desde el ala. */
async function alRecetario(page, cafe) {
  await anteElAla(page);
  const tag = cafe.locator('.cf3-tags button', { hasText: /^El obrador/ });
  await expect(tag).toBeVisible();
  await tag.click();
  const recetario = cafe.locator('.cf3-recetario');
  await expect(recetario).toBeVisible({ timeout: 20000 });
  return recetario;
}

/** Lo que mide el objeto del gesto en la pantalla, como en Obrador.jsx (la hoja, la raya y su ola, la plantilla, la sartén…). */
const medidaDe = (page, tipo, fogon) =>
  page.evaluate(
    ({ tipo, fogon }) => {
      const s = window.__cafe3d;
      const MARCA = { rallar: 'rallador', colmar: 'moldes', rodillo: 'masa', repulgo: 'fuente', meter: 'pala', sacar: 'boca', cortapastas: 'hojaGalletas', glasa: 'raya', amasar: 'masaMadre', grenar: 'hogaza', envolver: 'bol', tamiz: 'plantilla', cascar: 'bolHuevos', vuelta: 'sarten' };
      const m = s.obradorMarca((tipo === 'meter' || tipo === 'sacar') && fogon ? 'fogon' : MARCA[tipo]);
      if (!m) return null;
      const med = { centro: { x: m.x, y: m.y } };
      const entre = (a, b, eje) => {
        const p = s.obradorMarca(a);
        const q = s.obradorMarca(b);
        return p && q ? Math.abs(q[eje] - p[eje]) : null;
      };
      if (tipo === 'cortapastas') Object.assign(med, { ancho: entre('hojaIzq', 'hojaDer', 'x'), alto: entre('hojaArr', 'hojaAbj', 'y') });
      if (tipo === 'glasa') {
        med.ancho = entre('rayaIzq', 'rayaDer', 'x');
        const cresta = s.obradorMarca('rayaCresta');
        if (cresta) med.ola = Math.abs(cresta.y - m.y);
      }
      if (tipo === 'tamiz') Object.assign(med, { ancho: entre('plantillaIzq', 'plantillaDer', 'x'), alto: entre('plantillaArr', 'plantillaAbj', 'y') });
      if (tipo === 'vuelta') {
        const b = s.obradorMarca('sartenBorde');
        if (b) med.radio = Math.abs(b.x - m.x);
      }
      if (tipo === 'colmar') med.ancho = entre('moldeIzq', 'moldeDer', 'x');
      if (tipo === 'repulgo') {
        const b = s.obradorMarca('fuenteBorde');
        if (b) med.radio = Math.abs(b.x - m.x) * 0.92;
      }
      return med;
    },
    { tipo, fogon },
  );

/**
 * Un gesto del obrador con el ratón, como el dedo, sobre su objeto: el trazo de las manos de Pilar (sin su pulso), con `alza` para
 * levantar el dedo y volver a apoyarlo (otro corte, otro empujón u otro huevo). La pala fuera, tirando hacia ti. `foto`, a medio gesto.
 */
async function gesto(page, cafe, tipo, foto, { fogon = false } = {}) {
  const franja = cafe.locator('.cf3-franja--obrador');
  await expect(franja).toHaveAttribute('data-gesto', tipo, { timeout: 10000 });
  const zona = cafe.locator('.cf3-gesto[data-activo="true"]');
  await page.waitForFunction(() => window.__cafe3d.enObrador() && window.__cafe3d.settled());
  await expect(zona.locator('.cf3-gesto__pista')).toBeVisible();
  await quieto(page, 250);
  await foto?.(`${tipo}-pista`);
  const zb = await zona.boundingBox();
  const fr = await franja.boundingBox();
  const escala = Math.min(zb.width, 600) / 390;
  const m = page.mouse;
  if (tipo === 'sacar') {
    const p = await zona.locator('.cf3-gesto__pista').boundingBox();
    const x = p.x + p.width / 2;
    const y0 = Math.min(p.y + p.height / 2, fr.y - 150 * escala);
    await m.move(x, y0);
    await m.down();
    for (let k = 1; k <= 14; k += 1) {
      await m.move(x, y0 + (135 * escala * k) / 14);
      if (k === 8) await foto?.(tipo);
    }
    await m.up();
    return;
  }
  // Lo que dice Pilar de cómo ha quedado sale 1,3 s: un observador lo apunta en cuanto aparece
  await page.evaluate(() => {
    window.__mimo = null;
    window.__mimoObs?.disconnect();
    const mira = () => {
      const m = document.querySelector('.cf3-gesto__hecho')?.dataset.mimo;
      if (m && !window.__mimo) window.__mimo = m;
    };
    window.__mimoObs = new MutationObserver(mira);
    window.__mimoObs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-mimo'] });
  });
  const med = await medidaDe(page, tipo, fogon);
  const { puntos } = trazoPilar(tipo, { escala, ...med, azar: () => 0.5 });
  // Si el trazo bajara hasta la franja, todo el trazo un poco más arriba (lo que cuenta es el recorrido)
  const bajo = Math.max(...puntos.map((p) => p.y)) - (fr.y - 8);
  const dy = bajo > 0 ? -bajo : 0;
  const mitad = Math.floor(puntos.length / 2);
  await m.move(puntos[0].x, puntos[0].y + dy);
  await m.down();
  // Hasta que el gesto queda hecho (lo que diga Pilar de cómo ha quedado): lo que queda del trazo ya no cuenta
  const hecho = () => page.evaluate(() => window.__mimo);
  for (let k = 1; k < puntos.length; k += 1) {
    const p = puntos[k];
    if (p.alza) {
      await m.up();
      await m.move(p.x, p.y + dy);
      await m.down();
    } else await m.move(p.x, p.y + dy);
    if (k === mitad) await foto?.(tipo);
    if (k % 3 === 0) {
      const mimo = await hecho();
      if (mimo) {
        await m.up();
        return mimo;
      }
    }
  }
  await m.up();
  // La pala no lleva comentario (no cuenta para las estrellas)
  if (tipo === 'meter') return null;
  await page.waitForFunction(() => window.__mimo, null, { timeout: 5000 });
  return hecho();
}

/** De la ficha del recetario a la hornada: el botón de la ficha, sus dos gestos (o el que toque) y la pala o el plato. */
async function hacer(page, cafe, nombre, boton, gestos, foto, { fogon = false, meter = true } = {}) {
  const recetario = cafe.locator('.cf3-recetario');
  await expect(recetario).toBeVisible();
  const ficha = recetario.locator('.cf3-papeleta', { hasText: nombre });
  await ficha.scrollIntoViewIfNeeded();
  await quieto(page, 300);
  await foto?.(`ficha-${gestos[0]}`);
  await ficha.getByRole('button', { name: boton, exact: true }).click();
  for (const t of gestos) {
    const mimo = await gesto(page, cafe, t, foto, { fogon });
    // Lo que dice Pilar de cómo ha quedado, antes del siguiente
    expect(mimo, t).toBe('bien');
    await foto?.(`${t}-bien`);
  }
  if (!meter) return;
  const franja = cafe.locator('.cf3-franja--obrador');
  await gesto(page, cafe, 'meter', foto, { fogon });
  await expect(franja).toHaveAttribute('data-fase', 'horneando', { timeout: 8000 });
  await expect(franja.locator('.cf3-estrellas')).toHaveAttribute('aria-label', '3 de 3 estrellas');
}

/**
 * A la barra con el cliente que se atiende, hasta la taza lista: las elecciones de su receta y, si Pilar la domina, «Que lo
 * prepare Pilar»; si no (el excéntrico se prepara siempre a mano), cada gesto de la barra con el ratón.
 */
async function prepararCafe(page, cafe) {
  const caja = cafe.locator('.cf3-franja--atender').first();
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await page.waitForFunction(() => window.__cafe3d.enBarra());
  for (let k = 0; k < 60; k += 1) {
    const etapa = await caja.getAttribute('data-etapa');
    if (etapa === 'lista') return;
    if (ELIGE[etapa]) {
      const op = cafe.locator('.cf3-opciones').getByRole('button', { name: nombreOpcion(etapa, RECETA[ELIGE_DE[etapa]]), exact: true });
      if ((await op.isVisible().catch(() => false)) && (await op.getAttribute('aria-pressed')) !== 'true') {
        await op.click();
        if (etapa === 'bebida') {
          const oferta = cafe.locator('.cf3-pilar');
          if (await oferta.isVisible().catch(() => false)) await oferta.getByRole('button', { name: 'Que lo prepare Pilar' }).click();
        }
        await page.waitForTimeout(250);
        continue;
      }
    }
    const g = await caja.getAttribute('data-gesto');
    if (g && (await cafe.locator('.cf3-gesto[data-activo="true"]').count())) {
      await hacerGesto(page, cafe, g, { ayuda: false });
      continue;
    }
    await page.waitForTimeout(300);
  }
  await expect(caja).toHaveAttribute('data-etapa', 'lista', { timeout: 15000 });
}

/** En la vitrina, con las pinzas: de la pieza al plato. */
async function pinzas(page, cafe, foto) {
  const atender = cafe.locator('.cf3-franja--atender').first();
  await expect(atender).toHaveAttribute('data-vitrina', 'pinzas');
  const zona = cafe.locator('.cf3-gesto[data-activo="true"]');
  await expect(zona.locator('.cf3-gesto__pista')).toBeVisible();
  await quieto(page, 250);
  const p = await zona.locator('.cf3-gesto__pista').boundingBox();
  const fr = await atender.boundingBox();
  const e = Math.min((await zona.boundingBox()).width, 600) / 390;
  const x = p.x + p.width / 2;
  const y = Math.min(p.y + p.height / 2, fr.y - 120 * e);
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let k = 1; k <= 10; k += 1) {
    await page.mouse.move(x, y + k * 11 * e);
    if (k === 6) await foto?.('pinzas');
  }
  await page.mouse.up();
}

test('nivel 8: las cuatro recetas nuevas, el fogón, la masa a la bodega y los hitos del obrador', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844)$/.test(info.project.name), 'a 360 y 390');
  test.setTimeout(420000);
  const t0 = Date.now();
  const conSonido = /390x844/.test(info.project.name);
  if (conSonido) await grabarSonido(page);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let n = 0;
  const foto = async (nombre) => {
    n += 1;
    await page.screenshot({ path: join(DIR, `recetario-${String(n).padStart(2, '0')}-${nombre}-${tam(info)}.png`) });
  };
  const { cafe, c } = await alCafe(page, { granos: 300 }, { piezas: { magdalenas: 4 }, vendidas: 120, hitos: 2 });

  // 1. El obrador, con los dos adornos de sus hitos (los cazos de cobre y la ristra de moldes); el recetario, las seis abiertas
  await anteElAla(page);
  await quieto(page, 400);
  await foto('obrador-con-adornos');
  const recetario = await alRecetario(page, cafe);
  await expect(recetario.locator('.cf3-papeleta[data-tipo][data-abierta="true"]')).toHaveCount(6);
  const fichas = {
    galletas: recetario.locator('.cf3-papeleta', { hasText: 'Galletas del puerto' }),
    pan: recetario.locator('.cf3-papeleta', { hasText: 'Pan de la bodega' }),
    bizcocho: recetario.locator('.cf3-papeleta', { hasText: 'Bizcocho del tostadero' }),
    tortilla: recetario.locator('.cf3-papeleta', { hasText: 'Tortilla de patatas' }),
  };
  await expect(fichas.galletas).toContainText('Cortar las galletas y poner la glasa');
  await expect(fichas.pan).toContainText('Duerme una noche en la bodega');
  await expect(fichas.tortilla).toContainText('Al fogón, un ratito');
  await expect(fichas.pan.getByRole('button', { name: 'Amasar', exact: true })).toBeEnabled();
  await expect(fichas.tortilla.getByRole('button', { name: 'Al fogón', exact: true })).toBeEnabled();

  // 2. Las galletas del puerto: el cortapastas en la hoja de masa, la glasa en ola y la pala al horno
  await hacer(page, cafe, 'Galletas del puerto', 'Hornear', ['cortapastas', 'glasa'], foto);
  await quieto(page, 900);
  await foto('galletas-al-horno');

  // 3. El bizcocho: envolver la masa con la espátula y espolvorear el azúcar por la plantilla
  await cafe.getByRole('button', { name: 'Al recetario' }).click();
  await hacer(page, cafe, 'Bizcocho del tostadero', 'Hornear', ['envolver', 'tamiz'], foto);

  // 4. La tortilla, al fogón de la izquierda: cascar los huevos, darle la vuelta con el plato, a la sartén y, al cuajar, fuera
  await cafe.getByRole('button', { name: 'Al recetario' }).click();
  await hacer(page, cafe, 'Tortilla de patatas', 'Al fogón', ['cascar', 'vuelta'], foto, { fogon: true });
  const franja = cafe.locator('.cf3-franja--obrador');
  await expect(franja).toContainText('fogón');
  await quieto(page, 600);
  await foto('tortilla-en-el-fogon');
  await expect(franja).toHaveAttribute('data-fase', 'sacar', { timeout: 30000 });
  await gesto(page, cafe, 'sacar', foto, { fogon: true });
  await expect(franja).toHaveAttribute('data-fase', 'hecho', { timeout: 8000 });
  await quieto(page, 900);
  await foto('tortilla-hecha');
  expect(c.obrador.piezas.tortilla).toBeGreaterThan(0);

  // 5. El pan: se amasa hoy (sin horno) y a la bodega en su cesto; mañana se greña
  await cafe.getByRole('button', { name: 'Otra hornada' }).click();
  await hacer(page, cafe, 'Pan de la bodega', 'Amasar', ['amasar'], foto, { meter: false });
  await expect(franja).toHaveAttribute('data-fase', 'reposa', { timeout: 8000 });
  await expect(franja).toContainText(MASA.reposa.replace(/[«»]/g, '').slice(0, 30));
  expect(c.obrador.masa).toMatchObject({ amasado: 2, lista: false });
  await quieto(page, 900);
  await foto('masa-a-la-bodega');
  await cafe.getByRole('button', { name: 'Al recetario' }).click();
  await fichas.pan.scrollIntoViewIfNeeded();
  await expect(fichas.pan.locator('.cf3-papeleta__masa')).toHaveText(MASA.esperando);
  await expect(fichas.pan.getByRole('button', { name: MASA.boton })).toBeDisabled();
  await quieto(page, 300);
  await foto('ficha-pan-durmiendo');

  // 6. La última página: los hitos del obrador (dos de cinco)
  const siguiente = recetario.getByRole('button', { name: 'Página siguiente' });
  for (let k = 0; k < 8 && (await siguiente.isEnabled()); k += 1) {
    await siguiente.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(350);
  }
  const hoja = recetario.locator('.cf3-papeleta--obrador');
  await expect(hoja).toBeInViewport();
  await expect(hoja.locator('.cf3-hito[data-hecho="true"]')).toHaveCount(2);
  await expect(hoja.locator('.cf3-hitos__titulo')).toContainText('Vendidas: 120');
  await expect(hoja.locator('.cf3-hitos__titulo')).toContainText('faltan 130');
  await hoja.locator('.cf3-hitos').scrollIntoViewIfNeeded();
  await quieto(page, 400);
  await foto('hitos');
  await recetario.getByRole('button', { name: 'Volver' }).click();
  await page.waitForFunction(() => !window.__cafe3d.enObrador());

  const oidos = await sonidos(page);
  expect(oidos).toEqual(expect.arrayContaining(['recetario', 'fichaReceta', 'obradorHecho', 'horno', 'chisporroteo']));
  expect(errors).toEqual([]);
  const sonido = conSonido ? await sonidoGrabado(page) : null;
  if (conSonido) expect(sonido?.b64?.length ?? 0).toBeGreaterThan(1000);
  const video = page.video();
  await page.close();
  if (video && conSonido) await guardarConSonido(video, join(DIR, `recetario-${tam(info)}.webm`), sonido, t0);
});

test('al día siguiente: la caja del mostrador da el primer hito y la masa subida se greña', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844)$/.test(info.project.name), 'a 360 y 390');
  test.setTimeout(240000);
  const t0 = Date.now();
  const conSonido = /390x844/.test(info.project.name);
  if (conSonido) await grabarSonido(page);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let n = 0;
  const foto = async (nombre) => {
    n += 1;
    await page.screenshot({ path: join(DIR, `masa-${String(n).padStart(2, '0')}-${nombre}-${tam(info)}.png`) });
  };
  const { cafe, c } = await alCafe(page, { granos: 100 }, { piezas: { galletas: 6, magdalenas: 3 }, vendidas: 22, mostrador: { dias: 1 }, masa: { lista: true, amasado: 2 } });

  // 1. La caja: Pilar vendió en el mostrador y, con las 25 vendidas, cuelga los cazos de cobre (+20 granos)
  const caja = cafe.locator('.cf3-franja--caja');
  await expect(caja).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__cafe3d.enVitrina() && window.__cafe3d.settled());
  const zona = cafe.locator('.cf3-gesto[data-activo="true"]');
  await expect(zona.locator('.cf3-gesto__pista')).toBeVisible();
  await quieto(page, 300);
  const p = await zona.locator('.cf3-gesto__pista').boundingBox();
  const fr = await caja.boundingBox();
  const e = Math.min((await zona.boundingBox()).width, 600) / 390;
  const x = p.x + p.width / 2;
  const y = Math.min(p.y + p.height / 2, fr.y - 150 * e);
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let k = 1; k <= 12; k += 1) await page.mouse.move(x, y + k * 12 * e);
  await page.mouse.up();
  await expect(caja).toHaveAttribute('data-fase', 'hecho', { timeout: 8000 });
  expect(c.obrador.hitos).toBe(1);
  expect(c.granos).toBeGreaterThanOrEqual(120);
  await quieto(page, 500);
  await foto('caja-cobrada');
  await caja.getByRole('button', { name: 'Volver' }).click();
  await page.waitForFunction(() => !window.__cafe3d.enVitrina());
  // Lo que dice Pilar del adorno nuevo
  await expect(cafe.getByText(HITOS_OBRADOR.frases[0].replace(/[«»]/g, '').slice(0, 30))).toBeVisible({ timeout: 8000 });
  await quieto(page, 500);
  await foto('primer-hito');

  // 2. La masa ha subido: «Greñar y hornear»; el greñado con la cuchilla y la pala al horno
  const recetario = await alRecetario(page, cafe);
  const pan = recetario.locator('.cf3-papeleta', { hasText: 'Pan de la bodega' });
  await pan.scrollIntoViewIfNeeded();
  await expect(pan.locator('.cf3-papeleta__masa')).toHaveText(MASA.lista);
  await quieto(page, 300);
  await foto('ficha-pan-subido');
  await hacer(page, cafe, 'Pan de la bodega', 'Greñar y hornear', ['grenar'], foto);
  expect(c.obrador.masa).toBeNull();
  await quieto(page, 900);
  await foto('pan-al-horno');
  const oidos = await sonidos(page);
  expect(oidos).toEqual(expect.arrayContaining(['hitoObrador', 'cajonCaja', 'fichaReceta', 'obradorHecho', 'horno']));
  expect(errors).toEqual([]);
  const sonido = conSonido ? await sonidoGrabado(page) : null;
  const video = page.video();
  await page.close();
  if (video && conSonido) await guardarConSonido(video, join(DIR, `masa-${tam(info)}.webm`), sonido, t0);
});

test('el favorito del cliente y el acertijo del excéntrico, en la vitrina', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844)$/.test(info.project.name), 'a 360 y 390');
  test.setTimeout(300000);
  const t0 = Date.now();
  const conSonido = /390x844/.test(info.project.name);
  if (conSonido) await grabarSonido(page);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let n = 0;
  const foto = async (nombre) => {
    n += 1;
    await page.screenshot({ path: join(DIR, `vitrina-${String(n).padStart(2, '0')}-${nombre}-${tam(info)}.png`) });
  };
  const { cafe, c } = await alCafe(page, { granos: 100 }, { piezas: { empanada: 3, tortilla: 2, galletas: 3, pan: 2, magdalenas: 2 }, quiere: { 1: 'empanada', [EXC]: 'galletas' } });
  const atender = cafe.locator('.cf3-franja--atender').first();
  const comanda = cafe.locator('.cf3-comanda');

  // 1. El habitual pide su favorito (la empanada): el primero en la vitrina, y +2 granos
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  await expect(atender).toHaveAttribute('data-paso', 'pide', { timeout: 8000 });
  await expect(comanda.locator('.cf3-comanda__linea--comida')).toContainText('Empanada de bonito (su favorito)');
  await quieto(page, 400);
  await foto('pide-su-favorito');
  await prepararCafe(page, cafe);
  await cafe.getByRole('button', { name: 'A la vitrina' }).click();
  await page.waitForFunction(() => window.__cafe3d.enVitrina() && window.__cafe3d.settled());
  await expect(atender).toContainText('Es su favorito');
  await expect(atender.locator('button[data-receta]').first()).toHaveAttribute('data-receta', 'empanada');
  await expect(atender.locator('button[data-receta="empanada"]')).toContainText('su favorito');
  await quieto(page, 300);
  await foto('vitrina-favorito');
  const antes = c.granos;
  await atender.locator('button[data-receta="empanada"]').click();
  await pinzas(page, cafe, foto);
  await expect(atender).toHaveAttribute('data-paso', 'gracias', { timeout: 25000 });
  expect(c.obrador.piezas.empanada).toBe(2);
  // La empanada, 3 granos; por ser su favorito, 2 más (y lo de la bebida aparte)
  await expect(atender.locator('.cf3-dado__ficha--comida')).toHaveText('5 por su favorito');
  expect(c.granos).toBeGreaterThan(antes);
  await quieto(page, 500);
  await foto('favorito-servido');
  await cafe.getByRole('button', { name: 'Hasta luego' }).click();
  const logro = page.locator('.cf3-logro');
  if (await logro.isVisible().catch(() => false)) await logro.locator('.cf3-logro__ok').click();

  // 2. El excéntrico (el último del día) pide de comer con un acertijo: se ve todo lo que hay; si no es lo suyo, una pista y otra vez
  await page.waitForFunction(() => window.__cafe3d.settled());
  await page.evaluate(() => document.querySelector('.cf3-tag--raro').click());
  await expect(atender).toHaveAttribute('data-paso', 'pide', { timeout: 8000 });
  await expect(comanda.locator('.cf3-comanda__linea--comida')).toContainText(ACERTIJOS.galletas);
  await quieto(page, 400);
  await foto('acertijo-comanda');
  await prepararCafe(page, cafe);
  await cafe.getByRole('button', { name: 'A la vitrina' }).click();
  await page.waitForFunction(() => window.__cafe3d.enVitrina() && window.__cafe3d.settled());
  await expect(atender.locator('button[data-receta]')).toHaveCount(5);
  await quieto(page, 300);
  await foto('acertijo-vitrina');
  await atender.locator('button[data-receta="pan"]').click();
  await expect(atender).toContainText(PISTA_ACERTIJO.galletas);
  await expect(atender.locator('button[data-receta="pan"]')).toBeDisabled();
  await quieto(page, 300);
  await foto('acertijo-pista');
  await atender.locator('button[data-receta="galletas"]').click();
  await pinzas(page, cafe, null);
  await expect(atender).toHaveAttribute('data-paso', 'gracias', { timeout: 25000 });
  expect(c.obrador.piezas.galletas).toBe(2);
  expect(c.obrador.piezas.pan).toBe(2);
  // Las galletas, 2 granos; con el acertijo, el doble
  await expect(atender.locator('.cf3-dado__ficha--comida')).toHaveText(/^4 por .*, el doble$/);
  await quieto(page, 500);
  await foto('acertijo-servido');

  const oidos = await sonidos(page);
  expect(oidos).toEqual(expect.arrayContaining(['pinza', 'plato', 'noEs', 'acertijo']));
  expect(errors).toEqual([]);
  const sonido = conSonido ? await sonidoGrabado(page) : null;
  const video = page.video();
  await page.close();
  if (video && conSonido) await guardarConSonido(video, join(DIR, `vitrina-${tam(info)}.webm`), sonido, t0);
});

test('con movimiento reducido: cada gesto nuevo, de un toque', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'Chromium 390');
  test.setTimeout(180000);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { cafe, c } = await alCafe(page, {}, { piezas: {}, masa: { lista: true, amasado: 1 } }, { reducido: true });
  const recetario = await alRecetario(page, cafe);
  const franja = cafe.locator('.cf3-franja--obrador');
  const recetas = [
    ['Galletas del puerto', 'Hornear', ['cortapastas', 'glasa'], false],
    ['Bizcocho del tostadero', 'Hornear', ['envolver', 'tamiz'], false],
    ['Tortilla de patatas', 'Al fogón', ['cascar', 'vuelta'], true],
  ];
  for (const [nombre, boton, gestos, fogon] of recetas) {
    await expect(recetario).toBeVisible();
    const ficha = recetario.locator('.cf3-papeleta', { hasText: nombre });
    await ficha.scrollIntoViewIfNeeded();
    await ficha.getByRole('button', { name: boton, exact: true }).click();
    for (const t of gestos) {
      await expect(franja).toHaveAttribute('data-gesto', t, { timeout: 8000 });
      await franja.getByRole('button', { name: GESTO_OBRADOR[t].atajo }).click();
    }
    await expect(franja).toHaveAttribute('data-gesto', 'meter', { timeout: 8000 });
    await franja.getByRole('button', { name: fogon ? 'A la sartén' : 'Meterla en el horno' }).click();
    await expect(franja).toHaveAttribute('data-fase', 'horneando', { timeout: 8000 });
    await page.screenshot({ path: join(DIR, `reducido-${gestos[0]}-${tam(info)}.png`) });
    await cafe.getByRole('button', { name: 'Al recetario' }).click();
  }
  expect(c.obrador.horneando).toHaveLength(3);
  // Con las tres bandejas ocupadas, el pan espera; la masa subida, en su ficha
  const pan = recetario.locator('.cf3-papeleta', { hasText: 'Pan de la bodega' });
  await pan.scrollIntoViewIfNeeded();
  await expect(pan.locator('.cf3-papeleta__masa')).toHaveText(MASA.lista);
  await expect(pan.getByRole('button', { name: 'El horno está ocupado' })).toBeDisabled();
  expect(errors).toEqual([]);
});
