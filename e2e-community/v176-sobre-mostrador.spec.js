// 1.76 (SPEC §76) · El sobre sobre el mostrador, con Supabase simulado: el mismo sobre (una definición por colección)
// en el expositor, el selector y el primer plano del mostrador; el tablero de cerca es hondo y las cartas se apoyan en
// él (una centrada, cinco en 3 + 2), con «Revelar carta N de 5» y «Revelar todas». El sobre está en la madera, de frente
// e inclinado (un tercio del ancho, 1,4 veces más alto que ancho); al abrirlo, «1 de 5»: el sobre a la izquierda con la
// primera carta asomando y cuatro dorsos en 2 × 2; al continuar, 3 + 2 y el sobre sale del encuadre;
// una carta revelada se elige (✓) y «Colocar [nombre]» la lleva al piso, donde «Guardar» la devuelve sin tocar nada más.
import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { ANA, dirOf, openShop } from './sobreShop';
import { SOBRES_CERRADOS } from '../src/features/edificio/economy.js';

/**
 * Cada carta, contra el reparto calculado en el rasterizador (window.__gacha, solo en desarrollo): su base cae en su
 * punto del tablero ya escalado, lo que se toca en su centro es esa misma carta, la primera fila tiene madera detrás y
 * la segunda delante (antes del canto), y hay madera entre las filas.
 */
async function checkSpots(page, what) {
  const geo = await page.evaluate(() => {
    const scene = document.querySelector('.gacha').getBoundingClientRect();
    const { layout, board } = window.__gacha;
    const ratio = 262 / 150;
    const px = (f) => ({ x: scene.left + f.left * scene.width, y: scene.top + f.top * scene.width * ratio });
    return {
      boardTop: scene.top + board.top * scene.width * ratio,
      boardEdge: scene.top + board.edge * scene.width * ratio,
      cards: [...document.querySelectorAll('.gacha__card')].map((c, i) => {
        const r = c.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.gacha__card');
        return { r: { top: r.top, bottom: r.bottom, left: r.left, right: r.right }, at: px(layout.cards[i]), hit: hit === c };
      }),
    };
  });
  for (const [i, c] of geo.cards.entries()) {
    expect(Math.abs((c.r.left + c.r.right) / 2 - c.at.x), `${what}: centro de la carta ${i + 1}`).toBeLessThan(1);
    expect(Math.abs(c.r.bottom - c.at.y), `${what}: base de la carta ${i + 1}`).toBeLessThan(1);
    expect(c.hit, `${what}: se toca la carta ${i + 1}`).toBe(true);
  }
  const back = geo.cards.slice(0, 3).map((c) => c.r);
  const front = geo.cards.slice(3).map((c) => c.r);
  expect(Math.min(...back.map((r) => r.top)) - geo.boardTop).toBeGreaterThan(4);
  expect(Math.min(...front.map((r) => r.top)) - Math.max(...back.map((r) => r.bottom))).toBeGreaterThan(4);
  expect(geo.boardEdge - Math.max(...front.map((r) => r.bottom))).toBeGreaterThan(4);
  return geo;
}

test('el mismo sobre en el expositor, el selector y el mostrador; cinco cartas en 3 + 2 sobre la madera', async ({ page }, info) => {
  test.skip(SOBRES_CERRADOS, 'Sobres cerrados por reforma (9-11-2026): vuelve al reabrirlos');
  test.skip(!/360x800|390x844|1440x900/.test(info.project.name) || /reduced/.test(info.project.name), '360, 390 y escritorio');
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const { mock, shop } = await openShop(page);
  await page.waitForTimeout(900);
  const dir = dirOf(info);
  // El expositor (dibujado con el rasterizador) y el selector, con el mismo sobre
  await shop.locator('.ts-scene').screenshot({ path: join(dir, 'v176-expositor.png') });
  await shop.locator('.ts-packs').screenshot({ path: join(dir, 'v176-selector.png') });
  await page.screenshot({ path: join(dir, 'v176-tienda.png'), fullPage: true });

  // Un sobre: el mismo, de cerca, tumbado en el tablero
  mock.db.piso_sorteo = ['sofa'];
  await shop.getByRole('button', { name: /^Abrir 1 · 10/ }).click();
  const gacha = page.locator('.gacha');
  await expect(gacha).toHaveClass(/is-sealed/);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(dir, 'v176-sobre-cerca.png') });
  await gacha.getByRole('button', { name: 'Rasgar el sobre «Sala de estar»' }).click();
  await expect(gacha.getByRole('status')).toContainText('Te llevas sofá', { timeout: 6000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(dir, 'v176-una-carta.png') });
  await gacha.getByRole('button', { name: 'Volver a la tienda' }).click();

  // Cinco: cerrado, en el centro del mostrador, un tercio del ancho y 1,4 veces más alto que ancho
  mock.db.piso_sorteo = ['sofa', 'gato', 'radio', 'lampara-pie', 'planta-pequena'];
  await shop.getByRole('button', { name: /^Abrir 5 · 45/ }).click();
  const tall = (await gacha.boundingBox()).height;
  await expect(gacha).toHaveClass(/is-sealed/);
  const silhouette = await page.evaluate(() => {
    const s = document.querySelector('.gacha').getBoundingClientRect();
    const b = window.__gacha.pack.box;
    return { w: (b.right - b.left) * s.width, h: (b.bottom - b.top) * s.width * (262 / 150), cx: (b.left + b.right) / 2, sw: s.width };
  });
  expect(Math.abs(silhouette.w / silhouette.sw - 1 / 3)).toBeLessThan(0.01);
  expect(Math.abs(silhouette.h / silhouette.w - 1.4)).toBeLessThan(0.03);
  expect(Math.abs(silhouette.cx - 0.5)).toBeLessThan(0.01);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(dir, 'v176-sobre-cerrado.png') });
  // «1 de 5»: el sobre abierto a la izquierda con la primera asomando por la boca (su nombre por encima del sobre), la
  // tira encima y los cuatro dorsos en 2 × 2 a la derecha, en la madera
  await gacha.getByRole('button', { name: /^Rasgar el sobre/ }).click();
  await expect(gacha).toHaveClass(/is-peek/, { timeout: 4000 });
  await expect(gacha.getByRole('button', { name: /^Revelar carta \d de 5$/ })).toHaveCount(4);
  await expect(gacha.getByText('1 de 5 reveladas')).toBeVisible();
  await expect(gacha.getByRole('button', { name: 'Revelar todas' })).toBeVisible();
  await page.waitForTimeout(500);
  const peek = await page.evaluate(() => {
    const scene = document.querySelector('.gacha').getBoundingClientRect();
    const { layout, pack, board } = window.__gacha;
    const ratio = 262 / 150;
    const y = (f) => scene.top + f * scene.width * ratio;
    const cards = [...document.querySelectorAll('.gacha__card')].map((c) => c.getBoundingClientRect());
    return {
      mouth: y(pack.mouth.top + layout.side.top),
      name: document.querySelector('.gacha__card strong').getBoundingClientRect().bottom,
      waiting: cards
        .slice(1)
        .map((r, i) => ({ r: { top: r.top, bottom: r.bottom, left: r.left, x: (r.left + r.right) / 2 }, at: { x: scene.left + layout.peek[i + 1].left * scene.width, y: y(layout.peek[i + 1].top) } })),
      packRight: scene.left + (pack.box.right + layout.side.left) * scene.width,
      top: y(board.top),
      edge: y(board.edge),
    };
  });
  expect(peek.name).toBeLessThanOrEqual(peek.mouth);
  for (const w of peek.waiting) {
    expect(Math.abs(w.r.x - w.at.x)).toBeLessThan(1);
    expect(Math.abs(w.r.bottom - w.at.y)).toBeLessThan(1);
    expect(w.r.top - peek.top).toBeGreaterThan(4);
    expect(peek.edge - w.r.bottom).toBeGreaterThan(4);
    expect(w.r.left - peek.packRight).toBeGreaterThan(0);
  }
  await page.screenshot({ path: join(dir, 'v176-uno-de-cinco.png') });
  // Al continuar (tocar un dorso), las cartas van a su sitio definitivo (3 + 2) y el sobre vacío y la tira se deslizan
  // a la izquierda hasta quedar fuera del encuadre del todo (con su sombra y la tira girada), también en 360 px
  await gacha.getByRole('button', { name: 'Revelar carta 2 de 5' }).dblclick();
  await expect(gacha.getByText('2 de 5 reveladas')).toBeVisible();
  await page.waitForTimeout(1500);
  const frame = await gacha.boundingBox();
  const edges = await lieEdges(page);
  expect(edges).toHaveLength(2);
  for (const e of edges) expect(e.right, e.cls).toBeLessThanOrEqual(frame.x);
  await page.screenshot({ path: join(dir, 'v176-repartidas.png') });
  // El sofá (la primera) ya está en su sitio, con su tamaño definitivo
  const sofa = gacha.getByRole('button', { name: /^Sofá, poco común/ });
  const sofaAt = await sofa.boundingBox();
  await checkSpots(page, 'repartidas');
  // El doble toque reveló una sola carta; «Revelar todas» gira las demás en su sitio
  await expect(gacha.getByText('2 de 5 reveladas')).toBeVisible();
  await gacha.getByRole('button', { name: 'Revelar todas' }).click();
  await expect(gacha.getByRole('status')).toContainText('Te llevas 5 muebles', { timeout: 6000 });
  await page.waitForTimeout(800);
  // El sofá no se ha movido ni ha cambiado de tamaño; el pie ya tenía su alto, así que nada salta
  const sofaEnd = await sofa.boundingBox();
  for (const k of ['x', 'y', 'width', 'height']) expect(Math.abs(sofaEnd[k] - sofaAt[k])).toBeLessThan(0.6);
  expect(Math.abs((await gacha.boundingBox()).height - tall)).toBeLessThan(1);
  await checkSpots(page, 'final');
  // Nada se cobra ni se sortea otra vez: 120 − 10 − 45
  expect(mock.db.piso_cuentas[ANA.id].tickets).toBe(65);
  // Elegir una de la segunda fila… y luego la de «Gato dormido»: solo la elegida lleva ✓ (dentro de la carta) y la
  // acción dice su nombre
  await gacha.getByRole('button', { name: /^Lámpara de pie, común/ }).click();
  await expect(gacha.getByRole('button', { name: 'Colocar lámpara de pie' })).toBeVisible();
  const gato = gacha.getByRole('button', { name: 'Gato dormido, raro, nuevo' });
  await gato.click();
  await expect(gato).toHaveAttribute('aria-pressed', 'true');
  await expect(gacha.locator('.gacha__pick')).toHaveCount(1);
  const [g, mark] = [await gato.boundingBox(), await gato.locator('.gacha__pick').boundingBox()];
  expect(mark.x).toBeGreaterThanOrEqual(g.x);
  expect(mark.y).toBeGreaterThanOrEqual(g.y);
  expect(mark.x + mark.width).toBeLessThanOrEqual(g.x + g.width);
  expect(mark.y + mark.height).toBeLessThanOrEqual(g.y + g.height);
  // Sobre la madera solo quedan las cinco recompensas: ni sobre, ni tira, ni brillo del sobre
  await expect(gacha.locator('.gacha__lie, .gacha__fx, .gacha__env')).toHaveCount(0);
  await expect(gacha.locator('.gacha__card')).toHaveCount(5);
  for (const card of await gacha.locator('.gacha__card').all()) await expect(card).toBeVisible();
  const go = gacha.getByRole('button', { name: 'Colocar gato dormido' });
  await expect(go).toBeInViewport();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(dir, 'v176-cinco-cartas.png') });

  // «Colocar gato dormido» abre tu piso decorando, con el gato puesto y elegido; «Guardar» lo devuelve y el piso queda igual
  await go.click();
  await page.waitForFunction(() => window.__edificioPiso?.room?.items?.some((i) => i.id === 'gato'), null, { timeout: 15000 });
  const placed = await page.evaluate(() => {
    const p = window.__edificioPiso;
    const item = p.room.items.find((i) => i.id === 'gato');
    return { selected: p.selected === item.uid, count: p.room.items.length };
  });
  expect(placed.selected).toBe(true);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(dir, 'v176-piso-colocar.png') });
  await page.getByRole('button', { name: 'Guardar' }).click();
  const after = await page.evaluate(() => ({ gato: window.__edificioPiso.room.items.some((i) => i.id === 'gato'), count: window.__edificioPiso.room.items.length }));
  expect(after.gato).toBe(false);
  expect(after.count).toBe(placed.count - 1);
  // Sigue en el inventario y no se ha cobrado nada más
  expect(mock.db.piso_inventario[ANA.id].gato).toBe(1);
  expect(mock.db.piso_cuentas[ANA.id].tickets).toBe(65);
  expect(errors).toEqual([]);
});

// Dónde acaba lo dibujado de cada capa del sobre (el cuerpo y la tira): cada píxel no transparente (su esquina de la
// derecha), llevado a la pantalla con su desplazamiento y su giro tal como los aplica el navegador
async function lieEdges(page) {
  return page.evaluate(async () => {
    const out = [];
    for (const el of document.querySelectorAll('.gacha__lie')) {
      await el.decode();
      const c = document.createElement('canvas');
      [c.width, c.height] = [el.naturalWidth, el.naturalHeight];
      const ctx = c.getContext('2d');
      ctx.drawImage(el, 0, 0);
      const px = ctx.getImageData(0, 0, c.width, c.height).data;
      const k = el.offsetWidth / el.naturalWidth;
      const cs = getComputedStyle(el);
      const [tx = 0] = cs.translate === 'none' ? [] : cs.translate.split(' ').map(parseFloat);
      const m = new DOMMatrix(cs.transform === 'none' ? undefined : cs.transform);
      const [ox, oy] = cs.transformOrigin.split(' ').map(parseFloat);
      const base = el.offsetParent.getBoundingClientRect();
      let right = -Infinity;
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++) {
          if (!px[(y * c.width + x) * 4 + 3]) continue;
          for (const [a, b] of [
            [x + 1, y],
            [x + 1, y + 1],
          ]) {
            const p = m.transformPoint(new DOMPoint(a * k - ox, b * k - oy));
            right = Math.max(right, base.left + el.offsetLeft + ox + p.x + tx);
          }
        }
      out.push({ cls: el.className, right });
    }
    return out;
  });
}

test('con movimiento reducido, la misma composición final: sin sobre ni tira y las cinco en su sitio', async ({ page }, info) => {
  test.skip(SOBRES_CERRADOS, 'Sobres cerrados por reforma (9-11-2026): vuelve al reabrirlos');
  test.skip(!/360x800|390x844/.test(info.project.name), '360 y 390');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { mock, shop } = await openShop(page);
  mock.db.piso_sorteo = ['sofa', 'gato', 'radio', 'lampara-pie', 'planta-pequena'];
  await shop.getByRole('button', { name: /^Abrir 5 · 45/ }).click();
  const gacha = page.locator('.gacha');
  await expect(gacha).toHaveClass(/is-done/);
  await expect(gacha.getByRole('status')).toContainText('Te llevas 5 muebles');
  await checkSpots(page, 'reducido');
  await expect(gacha.locator('.gacha__lie, .gacha__fx, .gacha__env')).toHaveCount(0);
  await expect(gacha.locator('.gacha__card')).toHaveCount(5);
  await page.screenshot({ path: join(dirOf(info), 'v176-cinco-reducido.png') });
});
