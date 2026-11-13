// 1.129 · El café-librería del bajo, bloque 6c (la sala de catas, nivel 8), en un Postgres real (PGlite) con todas las
// migraciones: las cifras del nivel 8 son las de la app (desde 21.000, 100 tickets, 60 huecos, sus hitos a 23.000, 25.000 y
// 27.000, 25 granos en el 3.º); el sótano de 9 × 6 solo desde el nivel 8; la butaca de cuero cuenta como asiento y vienen hasta
// 10; el chai y el brûlée en la carta y en las recetas, como en la app (el chai nunca con el tueste de la casa); y se pueden
// servir solo desde su hito. El anónimo no puede nada.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { clientesDelNivel, opcionesDe, recetaDe, recetaPide, recetaValida } from '../cafe/cafeClientes';
import { ASIENTOS, CAFE_MUEBLES, CAFE_NIVELES, asientosDe, casillaValida, casillasDe, maxCosas, sotanoDe } from '../cafe/cafeCatalogo';
import { ABRE, HITOS, HUECOS, NIVEL_MAX, TICKETS_NIVEL, cartaDe, granosHito, nivelDe, novedades, textoHito, ticketsDelDia, umbralHito } from '../cafe/cafeNiveles';

let db;
let A, B, C, D;
let hoy;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const valido = (plano, nivel) => db.query('select cafe_plano_valido($1::jsonb, $2) v', [JSON.stringify(plano), nivel]).then((r) => r.rows[0].v);
const dia = (u, d) => call(u, 'select cafe_dia($1::date)', [d]);
const servir = (u, d, cliente, receta) => call(u, 'select cafe_servir($1::date, $2, $3::text[], $4, null)', [d, cliente, receta, false]);
// A un nivel con lo de antes cobrado (como quien llega jugando)
const alNivel = async (u, nivel, reputacion) => {
  await db.query('update cafe_locales set nivel = $2, reputacion = $3 where user_id = $1', [u, nivel, reputacion]);
  for (let n = 1; n <= nivel; n += 1) {
    await db.query('insert into cafe_niveles_cobrados (user_id, nivel, tickets) values ($1, $2, 0) on conflict do nothing', [u, n]);
    for (const k of [1, 2, 3]) if (reputacion >= umbralHito(n, k)) await db.query('insert into cafe_hitos (user_id, nivel, hito) values ($1, $2, $3) on conflict do nothing', [u, n, k]);
  }
};

beforeAll(async () => {
  db = await createDatabase();
  [A, B, C, D] = await createUsers(db, 4);
  for (const [i, u] of [A, B, C, D].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lectora ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await call(u, 'select cafe_mio()');
    await call(u, 'select cafe_inaugurar($1)', ['Taza y Lomo']);
  }
  hoy = (await db.query('select cafe_hoy()::text as h')).rows[0].h;
}, 60000);

describe('el café-librería del bajo, bloque 6c: la sala de catas', () => {
  it('las cifras del nivel 8 son las de la app; los niveles 1 a 7 no cambian', async () => {
    expect(CAFE_NIVELES.at(-1)).toMatchObject({ nivel: 8, desde: 21000 });
    expect(NIVEL_MAX).toBe(8);
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const q = (await db.query('select cafe_nivel_desde($1) d, cafe_tickets_nivel($1) t, cafe_tickets_dia($1) td, cafe_huecos($1) h, cafe_granos_hito($1) g', [n])).rows[0];
      expect(q).toEqual({ d: CAFE_NIVELES[n - 1].desde, t: TICKETS_NIVEL[n], td: ticketsDelDia(n), h: HUECOS[n], g: granosHito(n) });
      for (const k of [1, 2, 3]) expect((await db.query('select cafe_hito_umbral($1, $2) u', [n, k])).rows[0].u).toBe(umbralHito(n, k));
    }
    expect([TICKETS_NIVEL[8], HUECOS[8], granosHito(8), ticketsDelDia(8)]).toEqual([100, 60, 25, 5]);
    expect([1, 2, 3].map((k) => umbralHito(7, k))).toEqual([16500, 18000, 19500]);
    expect([1, 2, 3].map((k) => umbralHito(8, k))).toEqual([23000, 25000, 27000]);
    for (const r of [20999, 21000, 22999, 23000, 24999, 25000, 27000, 99999]) {
      const q = (await db.query('select cafe_nivel_de($1) n, cafe_carta($1) c', [r])).rows[0];
      expect(q).toEqual({ n: nivelDe(r), c: cartaDe(r) });
    }
    expect([nivelDe(20999), nivelDe(21000), nivelDe(99999)]).toEqual([7, 8, 8]);
    expect(cartaDe(24999)).not.toContain('chai');
    expect(cartaDe(25000)).toEqual(['chocolate', 'nata', 'vainilla', 'hielo', 'casa', 'chai', 'brulee']);
    // Los hitos del 8: el mapa de cafés, el chai y el brûlée a la vez, y 25 granos
    expect(HITOS[8]).toEqual({ 1: { mueble: 'cafe-mapa' }, 2: { carta: 'chai', carta2: 'brulee' }, 3: { granos: 25 } });
    expect(textoHito({ nivel: 8, hito: 2 })).toBe('Nuevo en la carta: Chai con especias y Café brûlée');
    expect(ABRE[8]).toHaveLength(4);
    const muebles = CAFE_MUEBLES.filter((m) => m.nivel === 8);
    expect(muebles.map((m) => m.id)).toEqual(['cafe-butaca', 'cafe-mesa-catas', 'cafe-mapa']);
    for (const m of muebles) {
      expect(m.precio).toBeGreaterThanOrEqual(300);
      expect(m.precio).toBeLessThanOrEqual(400);
      const s = (await db.query('select w, d, precio, nivel, hito from cafe_catalogo where id = $1', [m.id])).rows[0];
      expect(s).toEqual({ w: m.w, d: m.d, precio: m.precio, nivel: 8, hito: m.hito ?? 0 });
    }
  });

  it('el sótano de 9 × 6, el mismo en la app y en el servidor, y solo desde el nivel 8', async () => {
    for (const nivel of [6, 7, 8])
      for (let y = 18; y <= 27; y += 1)
        for (let x = -4; x <= 9; x += 1) expect((await db.query('select cafe_casilla_valida($1, $2, $3) v', [x, y, nivel])).rows[0].v, `${x},${y} nivel ${nivel}`).toBe(casillaValida(x, y, nivel));
    expect(sotanoDe(8)).toEqual({ x0: -2, x1: 7, y0: 20, y1: 26 });
    expect(casillasDe(8, 'bodega')).toHaveLength(9 * 6);
    expect(casillasDe(7, 'bodega')).toHaveLength(7 * 5);
    const catas = {
      v: 1,
      items: [
        { uid: 'm', id: 'cafe-mesa-catas', x: 5, y: 25, rot: 0 },
        { uid: 'b', id: 'cafe-butaca', x: 6, y: 20, rot: 0 },
        { uid: 'p', id: 'cafe-mapa', x: -2, y: 25, rot: 0 },
      ],
    };
    expect(await valido(catas, 7)).toBe(false);
    expect(await valido(catas, 8)).toBe(true);
    // Fuera de la sala, nunca
    expect(await valido({ v: 1, items: [{ uid: 'm', id: 'cafe-mesa-catas', x: 6, y: 25, rot: 0 }] }, 8)).toBe(false);
    // Siguen cabiendo 40 cosas
    expect(maxCosas(8)).toBe(40);
  });

  it('la butaca de cuero es un asiento: hasta 10 clientes al día en el nivel 8', async () => {
    expect(ASIENTOS['cafe-butaca']).toBe(1);
    const plano = {
      v: 1,
      items: [
        { uid: 'u', id: 'cafe-butaca', x: 6, y: 20, rot: 0 },
        { uid: 's', id: 'cafe-saco', x: -2, y: 20, rot: 0 },
        { uid: 'm', id: 'cafe-mesa-catas', x: 5, y: 25, rot: 0 },
      ],
    };
    expect((await db.query('select cafe_asientos($1::jsonb) n', [JSON.stringify(plano)])).rows[0].n).toBe(asientosDe(plano));
    expect(asientosDe(plano)).toBe(2);
    for (const asientos of [0, 5, 9, 10, 11, 20]) expect((await db.query('select cafe_clientes_dia(8, $1) n', [asientos])).rows[0].n).toBe(clientesDelNivel(8, asientos));
    expect([clientesDelNivel(8, 20), clientesDelNivel(7, 20), clientesDelNivel(9, 20)]).toEqual([10, 9, 10]);
  });

  it('las recetas con el chai y el brûlée son las mismas en la app y en el servidor (el chai, nunca con el tueste)', async () => {
    const cartas = [cartaDe(24000), cartaDe(25000), ['chai'], ['brulee'], ['chai', 'casa'], ['hielo', 'chai', 'brulee']];
    let chai = 0;
    let brulee = 0;
    for (const carta of cartas)
      for (let r = 0; r < 600; r += 7) {
        const s = (await db.query('select cafe_receta_carta($1, $2::text[]) x', [r, carta])).rows[0].x;
        expect(s, `${r} ${carta}`).toEqual(recetaDe(r, carta));
        expect(recetaValida(s, carta)).toBe(true);
        if (s[0] === 'chai') {
          chai += 1;
          expect(s[1]).not.toBe('casa');
        }
        if (s[3] === 'brulee') brulee += 1;
      }
    expect(chai).toBeGreaterThan(0);
    expect(brulee).toBeGreaterThan(0);
    expect(opcionesDe('grano', cartaDe(25000), 'chai').map((o) => o.id)).toEqual(['suave', 'intenso']);
    expect(recetaValida(['chai', 'casa', 'sin', 'nada'], ['chai', 'casa'])).toBe(false);
    expect(recetaValida(['chai', 'suave', 'sin', 'brulee'], ['casa'])).toBe(false);
  });

  it('subir al nivel 8 en un servicio: 100 tickets una vez y sus hitos', async () => {
    await alNivel(A, 7, 20990);
    const t0 = (await db.query('select tickets from piso_cuentas where user_id = $1', [A])).rows[0].tickets;
    const d = await dia(A, hoy);
    const c = d.dia.clientes[0];
    const r = await call(A, 'select cafe_servir($1::date, $2, $3::text[], $4, $5)', [hoy, c.n, recetaPide(c, d.dia.carta), null, null]);
    const rep = 20990 + r.dado.reputacion;
    expect(rep).toBeGreaterThanOrEqual(21000);
    expect(r.progreso).toMatchObject({ de: 7, a: 8, niveles: [{ nivel: 8, tickets: 100 }] });
    expect(r.progreso.hitos).toEqual(novedades(20990, rep).hitos.map(({ nivel, hito }) => ({ nivel, hito })));
    const t1 = (await db.query('select tickets from piso_cuentas where user_id = $1', [A])).rows[0].tickets;
    expect(t1 - t0).toBe(100 + ticketsDelDia(8));
    expect(r.cafe).toMatchObject({ nivel: 8 });
  });

  it('el chai y el brûlée se sirven solo desde su hito; el chai con el tueste, nunca', async () => {
    await alNivel(B, 8, 24000);
    await alNivel(C, 8, 26000);
    const b = await dia(B, hoy);
    expect(b.dia.carta).not.toContain('chai');
    expect(await rejects(servir(B, hoy, b.dia.clientes[0].n, ['chai', 'suave', 'sin', 'nada']))).toMatch(/cafe:receta/);
    expect(await rejects(servir(B, hoy, b.dia.clientes[0].n, ['cafe', 'suave', 'sin', 'brulee']))).toMatch(/cafe:receta/);
    const c = await dia(C, hoy);
    expect(c.dia.carta).toEqual(expect.arrayContaining(['chai', 'brulee']));
    await db.query('update cafe_locales set tazas = 3 where user_id = $1', [C]);
    expect(await rejects(servir(C, hoy, c.dia.clientes[0].n, ['chai', 'casa', 'sin', 'nada']))).toMatch(/cafe:receta/);
    const r = await servir(C, hoy, c.dia.clientes[0].n, ['chai', 'intenso', 'avena', 'brulee']);
    expect(r.dado.aciertos).toBeGreaterThanOrEqual(0);
    const pidio = recetaPide(c.dia.clientes[0], c.dia.carta);
    expect(r.dado.aciertos).toBe(['chai', 'intenso', 'avena', 'brulee'].filter((p, k) => p === pidio[k]).length);
  });

  it('el anónimo no puede servir; las funciones nuevas no se llaman desde fuera', async () => {
    expect(await rejects(as(db, null, (q) => q("select cafe_servir($1::date, 1, array['chai','suave','sin','brulee'], false, null)", [hoy])))).toMatch(/permission denied/);
    expect(await rejects(as(db, D, (q) => q('select cafe_bebidas_carta(array[$1])', ['chai'])))).toMatch(/permission denied/);
    expect(await rejects(as(db, D, (q) => q('select cafe_toques_carta(array[$1])', ['brulee'])))).toMatch(/permission denied/);
    expect(await rejects(as(db, D, (q) => q('select cafe_casilla_valida(6, 25, 8)')))).toMatch(/permission denied/);
  });
});
