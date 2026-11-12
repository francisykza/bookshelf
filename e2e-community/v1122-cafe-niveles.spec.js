// 1.122 (SPEC §122; docs/qa/cafe-libreria.md §12, bloque 4a, decisiones de Francisco del 12-11-2026) · El café sube de nivel:
// al atender al cliente que cruza los 300 de reputación sale el cartel del nivel 2 (sus tickets y lo que se abre); al
// cerrarlo, se recogen las cortinas y la cámara enseña el fondo con el ventanal al puerto. En Decorar, la tienda del café
// (lo nuevo del nivel, lo de un hito con lo que falta) y la cuadrícula hasta el fondo. En el nivel 3, la chimenea y las
// estanterías hasta el techo, y la carta abierta: un chocolate con nata hecho en la barra con sus gestos (remover con el
// molinillo, inclinar el cazo y batir las varillas). El servidor simulado aplica las reglas de
// `20261212120000_cafe_niveles.sql`. Capturas y vídeos en qa-report/cafe-niveles/.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { hacerGesto, quieto } from './cafeBarra';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { generoDe, nombreOpcion, premio, recetaPide } from '../src/features/edificio/cafe/cafeClientes';
import { ELIGE, ETAPAS, gestosDe } from '../src/features/edificio/cafe/cafeGestos';
import { dayKey } from '../src/domain/dates';

const DIR = join('qa-report', 'cafe-niveles');
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
const LIBROS = [
  libro('f', 'El dragón del muelle', { categories: ['Fantasy'] }),
  libro('m', 'Crimen en la lonja', { categories: ['Mystery'] }),
  libro('a', 'Cartas de amor al puerto', { categories: ['Romance'] }),
  libro('s', 'Naves sobre la bahía', { categories: ['Science Fiction'] }),
  libro('n', 'Un libro sin más'),
];
const BALDA = { bienvenida: true, libros: LIBROS.map((b) => ({ clave: b.id, titulo: b.title, genero: generoDe(b), caja: 0, balda: 1 })) };
/** La primera semilla desde `desde` (de mil en mil: la receta sale de semilla / 1000) cuyo cliente 1 pide lo que diga `quiere` con esta carta. */
function semillaQue(quiere, carta, desde = 1000) {
  for (let s = desde; s < desde + 500000; s += 1000) if (quiere(recetaPide({ n: 1, semilla: s }, carta))) return s;
  throw new Error('ninguna semilla');
}

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

async function alCafe(page, estado, semillas) {
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 120, sin_raro: 3 } },
    piso_inventario: { [ANA.id]: { sillon: 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.libraries.push({ user_id: ANA.id, data: { books: LIBROS }, updated_at: new Date().toISOString(), version: 5 });
  await page.addInitScript((books) => {
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (!localStorage.getItem('bookshelf:v1')) localStorage.setItem('bookshelf:v1', JSON.stringify({ books, progress: { readingLog: [], pomodoros: [], claimed: {} } }));
  }, LIBROS);
  await mock.attach(page, ANA);
  const c = await simularCafe(
    page,
    { inaugurado: true, nombre: 'Taza y Lomo', plano: structuredClone(PLANO_INICIAL), inventario: cuenta(PLANO_INICIAL), libros: BALDA, ...estado },
    { clientes: { hoy: HOY, semillas, quienes: [3], frases: [10] } },
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

const BOTON = (parte, valor, bebida) =>
  parte === 'grano' && bebida === 'te'
    ? valor === 'suave'
      ? 'Hoja verde · suave'
      : 'Hoja negra · intensa'
    : parte === 'grano' && bebida === 'chocolate'
      ? valor === 'suave'
        ? 'Cacao con leche'
        : 'Cacao negro'
      : nombreOpcion(parte, valor);

/** Atiende al cliente 1 con la receta que pidió: lo de la carta (el cazo, el bol), tocándolo en la barra; lo demás, con los botones. */
async function atender(page, cafe, receta, { foto = null, ayuda = true } = {}) {
  await cafe.getByRole('button', { name: 'Atender', exact: true }).click();
  const caja = cafe.locator('.cf3-franja--atender');
  await expect(caja).toHaveAttribute('data-paso', 'pide');
  await cafe.getByRole('button', { name: 'A la barra' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'barra');
  await page.waitForFunction(() => window.__cafe3d.enBarra());
  const r = { bebida: receta[0], grano: receta[1], leche: receta[2], toque: receta[3] };
  for (const etapa of ETAPAS) {
    await expect(caja).toHaveAttribute('data-etapa', etapa);
    const parte = ELIGE[etapa];
    if (parte) {
      const valor = r[parte];
      await quieto(page, 200);
      if (etapa === 'bebida' || etapa === 'toque') await foto?.(`elige-${etapa}`);
      const p = valor === 'chocolate' || valor === 'nata' ? await page.evaluate((x) => window.__cafe3d.barraEnPantalla(x), `barra:${parte}:${valor}`) : null;
      if (p?.front) await page.mouse.click(p.x, p.y);
      else
        await cafe
          .locator('.cf3-opciones')
          .getByRole('button', { name: BOTON(parte, valor, r.bebida), exact: true })
          .click();
      await expect.poll(async () => (await caja.getAttribute('data-receta')).split(',')[['bebida', 'grano', 'leche', 'toque'].indexOf(parte)]).toBe(valor);
    }
    for (const tipo of gestosDe(etapa, r)) await hacerGesto(page, cafe, tipo, { foto, ayuda });
  }
  await expect(caja).toHaveAttribute('data-etapa', 'lista');
  expect(await caja.getAttribute('data-receta')).toBe(receta.join());
  await quieto(page, 400);
  await foto?.('lista');
  await cafe.getByRole('button', { name: 'Llevársela' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'libro', { timeout: 15000 });
  await cafe.getByRole('button', { name: 'Solo el café' }).click();
  await expect(caja).toHaveAttribute('data-paso', 'gracias');
  await cafe.getByRole('button', { name: 'Hasta luego' }).click();
}

test('sube al nivel 2: el cartel, el recorrido hasta el ventanal, la tienda del café y la cuadrícula hasta el fondo', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/.test(info.project.name), '360, 430, escritorio y 390 (Chromium y WebKit)');
  test.setTimeout(150000);
  mkdirSync(DIR, { recursive: true });
  const foto = async (nombre) => page.screenshot({ path: join(DIR, `subida-${nombre}-${tam(info)}.png`) });
  // A 6 de reputación del nivel 2: cualquier servicio (como poco, 1 estrella) lo cruza
  const rep = 300 - premio('cliente', 1).reputacion;
  const { cafe, c } = await alCafe(page, { nivel: 1, reputacion: rep, granos: 200, cobrados: [1] }, [1000, 8919, 16838]);
  await quieto(page);
  await foto('antes');
  await atender(page, cafe, recetaPide({ n: 1, semilla: 1000 }, []), { foto: /chromium-390x844$/.test(info.project.name) ? foto : null });
  // El cartel de la subida: el nivel, sus tickets y lo que se abre
  const cartel = page.getByRole('dialog', { name: /Nivel 2 · Café/ });
  await expect(cartel).toBeVisible();
  await expect(cartel).toContainText('+20 tickets');
  await expect(cartel).toContainText('18 huecos en la balda');
  await expect(cartel).toContainText('el ventanal al puerto');
  await expect(cartel).toContainText('+2 tickets del café de hoy');
  expect(c.nivel).toBe(2);
  await page.waitForTimeout(700);
  await foto('cartel');
  // Al cerrarlo, se recogen las cortinas y la cámara enseña el fondo
  await cartel.getByRole('button', { name: '¡A por ello!' }).click();
  await expect(cartel).toBeHidden();
  await page.waitForFunction(() => window.__cafe3d.enRecorrido());
  await page.waitForTimeout(1900);
  await foto('recorrido-ventanal');
  await page.waitForFunction(() => !window.__cafe3d.enRecorrido(), null, { timeout: 15000 });
  await quieto(page);
  await foto('despues');
  // Decorar: la tienda del café y la cuadrícula del nivel 2
  await cafe.getByRole('button', { name: 'Decorar' }).click();
  await quieto(page);
  await foto('decorar');
  await cafe.getByRole('tab', { name: 'Tienda' }).click();
  const tienda = cafe.locator('.cf3-tienda');
  await expect(tienda.getByRole('button', { name: 'Comprar Banco corrido por 70 granos' })).toBeEnabled();
  await expect(tienda.getByRole('button', { name: /Estantería alta: Se abre en el nivel 3/ })).toBeDisabled();
  await expect(tienda.getByRole('button', { name: /Perchero.*Hito 1 del nivel 2: faltan/ })).toBeDisabled();
  await foto('tienda');
  await tienda.getByRole('button', { name: 'Comprar Banco corrido por 70 granos' }).click();
  await expect(cafe.locator('.cf3-balda__titulo')).toContainText('¡Banco corrido, tuyo!');
  expect(c.inventario['cafe-banco']).toBe(1);
  // Colocarlo: sale en «Del café» y cabe al fondo, en las filas nuevas
  await cafe.getByRole('tab', { name: 'Del café' }).click();
  await cafe
    .getByRole('button', { name: /Banco corrido/ })
    .first()
    .click();
  await quieto(page);
  await foto('banco');
  await cafe.getByRole('button', { name: 'Soltar' }).click();
  await cafe.getByRole('button', { name: 'Listo' }).click();
  await expect.poll(() => c.plano.items.find((i) => i.id === 'cafe-banco')?.y).toBeLessThan(0);
  const video = page.video();
  await page.close();
  if (video && /390x844/.test(info.project.name)) await video.saveAs(join(DIR, `subida-${tam(info)}.webm`));
});

test('nivel 3: la chimenea y las estanterías altas, y un chocolate con nata hecho en la barra', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844|430x932|1440x900)$|webkit-390x844$/.test(info.project.name), '360, 430, escritorio y 390 (Chromium y WebKit)');
  test.setTimeout(150000);
  mkdirSync(DIR, { recursive: true });
  const foto = async (nombre) => page.screenshot({ path: join(DIR, `choco-${nombre}-${tam(info)}.png`) });
  const carta = ['chocolate', 'nata'];
  const s = semillaQue((p) => p[0] === 'chocolate' && p[3] === 'nata' && p[2] !== 'sin', carta);
  const pide = recetaPide({ n: 1, semilla: s }, carta);
  const { cafe } = await alCafe(page, { nivel: 3, reputacion: 1800, granos: 300, cobrados: [1, 2, 3] }, [s, s + 7919, s + 2 * 7919, s + 3 * 7919, s + 4 * 7919]);
  await quieto(page);
  await foto('local');
  // El recorrido del nivel 3, a mano: el ventanal y, después, la chimenea encendida
  await page.evaluate(() => {
    window.__cafe3d.recorrido(3);
  });
  await page.waitForTimeout(4400);
  await foto('chimenea');
  await page.waitForFunction(() => !window.__cafe3d.enRecorrido(), null, { timeout: 15000 });
  // Andar hasta el fondo: la chimenea y las estanterías altas
  await page.evaluate(() => window.__cafe3d.go('cortina'));
  await quieto(page);
  await foto('fondo');
  await atender(page, cafe, pide, { foto: /chromium-390x844$|webkit-390x844$/.test(info.project.name) ? foto : null, ayuda: false });
  // Los tickets del día (3, en el nivel 3)
  const cartel = page.getByRole('dialog', { name: /Primer cliente del día/ });
  await expect(cartel).toContainText('+3 tickets del café de hoy');
  await cartel.getByRole('button', { name: 'Seguir' }).click();
  const video = page.video();
  await page.close();
  if (video && /390x844/.test(info.project.name)) await video.saveAs(join(DIR, `choco-${tam(info)}.webm`));
});
