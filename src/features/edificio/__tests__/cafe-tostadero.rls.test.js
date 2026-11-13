// 1.127 · El café-librería del bajo, bloque 6b (el tostadero, nivel 7), en un Postgres real (PGlite) con todas las migraciones:
// las cifras del nivel 7 son las de la app (desde 15.000, 90 tickets, 54 huecos, sus hitos a 16.500, 18.000 y 19.500, 20 granos
// en el 3.º); el sótano de 7 × 5 solo desde el nivel 7; el saco de arpillera cuenta como asiento y vienen hasta 9; el tueste de la
// casa en la carta y en las recetas, como en la app; un saco al día (5 tazas); y servir el tueste gasta una taza y, a quien lo
// pidió, paga +3 granos y +4 de reputación. El anónimo no puede nada.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { estrellasDe, premio, recetaDe, recetaPide, recetaValida, clientesDelNivel } from '../cafe/cafeClientes';
import { ASIENTOS, CAFE_NIVELES, asientosDe, casillaValida, maxCosas, sotanoDe } from '../cafe/cafeCatalogo';
import { BONO_TUESTE, HUECOS, TAZAS_SACO, TICKETS_NIVEL, cartaDe, granosHito, nivelDe, sacoListo, ticketsDelDia, umbralHito } from '../cafe/cafeNiveles';

let db;
let A, B, C, F;
let hoy, ayer;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const valido = (plano, nivel) => db.query('select cafe_plano_valido($1::jsonb, $2) v', [JSON.stringify(plano), nivel]).then((r) => r.rows[0].v);
const saco = (u, d) => call(u, 'select cafe_recoger_saco($1::date)', [d]);
const dia = (u, d) => call(u, 'select cafe_dia($1::date)', [d]);
const servir = (u, d, cliente, receta) => call(u, 'select cafe_servir($1::date, $2, $3::text[], $4, null)', [d, cliente, receta, false]);
const local = (u) => db.query('select tazas, saco_dia::text s, granos, reputacion from cafe_locales where user_id = $1', [u]).then((r) => r.rows[0]);
// Al nivel 7 con lo de antes cobrado (como quien llega jugando)
const alNivel7 = async (u, reputacion) => {
  await db.query('update cafe_locales set nivel = 7, reputacion = $2 where user_id = $1', [u, reputacion]);
  for (let n = 1; n <= 7; n += 1) {
    await db.query('insert into cafe_niveles_cobrados (user_id, nivel, tickets) values ($1, $2, 0) on conflict do nothing', [u, n]);
    for (const k of [1, 2, 3]) await db.query('insert into cafe_hitos (user_id, nivel, hito) values ($1, $2, $3) on conflict do nothing', [u, n, k]);
  }
};

beforeAll(async () => {
  db = await createDatabase();
  [A, B, C, F] = await createUsers(db, 4);
  for (const [i, u] of [A, B, C, F].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lectora ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await call(u, 'select cafe_mio()');
    await call(u, 'select cafe_inaugurar($1)', ['Taza y Lomo']);
  }
  hoy = (await db.query('select cafe_hoy()::text as h')).rows[0].h;
  ayer = (await db.query('select (cafe_hoy() - 1)::text as a')).rows[0].a;
  await db.query('insert into cafe_probadores (user_id) values ($1)', [F]);
}, 60000);

describe('el café-librería del bajo, bloque 6b: el tostadero', () => {
  it('las cifras del nivel 7 son las de la app; los niveles 1 a 6 no cambian', async () => {
    expect(CAFE_NIVELES.at(-1)).toMatchObject({ nivel: 7, desde: 15000 });
    for (const n of [1, 2, 3, 4, 5, 6, 7]) {
      const q = (await db.query('select cafe_nivel_desde($1) d, cafe_tickets_nivel($1) t, cafe_tickets_dia($1) td, cafe_huecos($1) h, cafe_granos_hito($1) g', [n])).rows[0];
      expect(q).toEqual({ d: CAFE_NIVELES[n - 1].desde, t: TICKETS_NIVEL[n], td: ticketsDelDia(n), h: HUECOS[n], g: granosHito(n) });
      for (const k of [1, 2, 3]) expect((await db.query('select cafe_hito_umbral($1, $2) u', [n, k])).rows[0].u).toBe(umbralHito(n, k));
    }
    expect([TICKETS_NIVEL[7], HUECOS[7], granosHito(7), ticketsDelDia(7)]).toEqual([90, 54, 20, 5]);
    expect([1, 2, 3].map((k) => umbralHito(6, k))).toEqual([11250, 12500, 13750]);
    expect([1, 2, 3].map((k) => umbralHito(7, k))).toEqual([16500, 18000, 19500]);
    for (const r of [9999, 10000, 14999, 15000, 17999, 18000, 21000, 99999]) {
      const q = (await db.query('select cafe_nivel_de($1) n, cafe_carta($1) c', [r])).rows[0];
      expect(q).toEqual({ n: nivelDe(r), c: cartaDe(r) });
    }
    expect([nivelDe(14999), nivelDe(15000), nivelDe(99999)]).toEqual([6, 7, 7]);
    expect(cartaDe(17999)).not.toContain('casa');
    expect(cartaDe(18000)).toContain('casa');
  });

  it('el sótano de 7 × 5, el mismo en la app y en el servidor, y solo desde el nivel 7', async () => {
    for (const nivel of [6, 7])
      for (let y = 18; y <= 26; y += 1)
        for (let x = -5; x <= 7; x += 1) expect((await db.query('select cafe_casilla_valida($1, $2, $3) v', [x, y, nivel])).rows[0].v, `${x},${y} nivel ${nivel}`).toBe(casillaValida(x, y, nivel));
    expect([sotanoDe(6).x0, sotanoDe(7).x0, sotanoDe(7).x1]).toEqual([0, -2, 5]);
    const tostadero = {
      v: 1,
      items: [
        { uid: 's', id: 'cafe-saco', x: -2, y: 20, rot: 0 },
        { uid: 'l', id: 'cafe-latas', x: -2, y: 24, rot: 0 },
      ],
    };
    expect(await valido(tostadero, 6)).toBe(false);
    expect(await valido(tostadero, 7)).toBe(true);
    // Siguen cabiendo 40 cosas
    expect(maxCosas(7)).toBe(40);
  });

  it('el saco de arpillera es un asiento: hasta 9 clientes al día en el nivel 7', async () => {
    expect(ASIENTOS['cafe-saco']).toBe(1);
    const plano = {
      v: 1,
      items: [
        { uid: 's', id: 'cafe-saco', x: -2, y: 20, rot: 0 },
        { uid: 'b', id: 'cafe-banco-bodega', x: 0, y: 23, rot: 0 },
      ],
    };
    expect((await db.query('select cafe_asientos($1::jsonb) n', [JSON.stringify(plano)])).rows[0].n).toBe(asientosDe(plano));
    for (const asientos of [0, 5, 8, 9, 10, 20]) expect((await db.query('select cafe_clientes_dia(7, $1) n', [asientos])).rows[0].n).toBe(clientesDelNivel(7, asientos));
    expect([clientesDelNivel(7, 20), clientesDelNivel(6, 20)]).toEqual([9, 8]);
  });

  it('las recetas con el tueste de la casa son las mismas en la app y en el servidor (solo con café)', async () => {
    const cartas = [cartaDe(14000), cartaDe(18000), ['casa'], ['chocolate', 'casa']];
    for (const carta of cartas)
      for (let r = 0; r < 400; r += 7) {
        const s = (await db.query('select cafe_receta_carta($1, $2::text[]) x', [r, carta])).rows[0].x;
        expect(s, `${r} ${carta}`).toEqual(recetaDe(r, carta));
        expect(recetaValida(s, carta)).toBe(true);
        if (s[1] === 'casa') expect(['cafe', 'frio']).toContain(s[0]);
      }
    expect(recetaValida(['te', 'casa', 'sin', 'nada'], ['casa'])).toBe(false);
    expect(recetaValida(['cafe', 'casa', 'sin', 'nada'], [])).toBe(false);
  });

  it('un saco al día, con el tueste en la carta: 5 tazas, sin juntar más de uno', async () => {
    // Nivel 7 sin el tueste todavía: el tostador está frío
    await alNivel7(A, 17000);
    expect(sacoListo(17000, null, hoy)).toBe(false);
    expect(await rejects(saco(A, hoy))).toMatch(/cafe:tueste/);
    await db.query('update cafe_locales set reputacion = 18000 where user_id = $1', [A]);
    expect(sacoListo(18000, null, ayer)).toBe(true);
    // Ayer sin recoger: se recoge hoy (o ayer), pero solo uno
    const r = await saco(A, ayer);
    expect(r).toMatchObject({ tazas: TAZAS_SACO, cafe: { tostadero: { tazas: 5, saco_dia: ayer } } });
    expect(await rejects(saco(A, ayer))).toMatch(/cafe:saco/);
    expect(sacoListo(18000, ayer, hoy)).toBe(true);
    await saco(A, hoy);
    expect(await local(A)).toMatchObject({ tazas: 10, s: hoy });
    expect(sacoListo(18000, hoy, hoy)).toBe(false);
    expect(sacoListo(18000, hoy, ayer)).toBe(false);
    expect(await rejects(saco(A, hoy))).toMatch(/cafe:saco/);
    expect(await rejects(saco(A, ayer))).toMatch(/cafe:saco/);
    // Días que no valen
    expect(await rejects(saco(A, '2020-01-01'))).toMatch(/cafe:dia/);
    // Como mucho 99 tazas: si no caben, el saco espera
    await db.query('update cafe_locales set tazas = 95, saco_dia = null where user_id = $1', [A]);
    expect(await rejects(saco(A, hoy))).toMatch(/cafe:tazas/);
    expect(await local(A)).toMatchObject({ tazas: 95, s: null });
    await db.query('update cafe_locales set tazas = 10, saco_dia = $2 where user_id = $1', [A, hoy]);
  });

  it('quien prueba: el saco de su jornada no tapa el de hoy', async () => {
    await alNivel7(F, 18000);
    const j = await call(F, 'select cafe_jornada()::text');
    expect(j).toBe('3000-01-01');
    await saco(F, j);
    expect(await rejects(saco(F, j))).toMatch(/cafe:saco/);
    expect(sacoListo(18000, j, hoy)).toBe(true);
    await saco(F, hoy);
    expect(await local(F)).toMatchObject({ tazas: 10, s: hoy });
  });

  it('servir el tueste de la casa: gasta una taza y, a quien lo pidió, +3 granos y +4 de reputación', async () => {
    // Buscamos un cliente que pida el tueste (uno de cada seis, más o menos: con tres cafés y dos días casi seguro)
    await alNivel7(B, 18000);
    await alNivel7(C, 18000);
    let hallado = null;
    for (const u of [A, B, C]) {
      for (const d of [hoy, ayer]) {
        const x = await dia(u, d);
        expect(x.dia.carta).toContain('casa');
        const c = x.dia.clientes.find((k) => !k.servido && recetaPide(k, x.dia.carta)[1] === 'casa');
        if (c) {
          hallado = { u, d, c, carta: x.dia.carta };
          break;
        }
      }
      if (hallado) break;
    }
    expect(hallado).not.toBeNull();
    const { u, d, c, carta } = hallado;
    const pide = recetaPide(c, carta);
    // Sin tazas no hay tueste
    await db.query('update cafe_locales set tazas = 0 where user_id = $1', [u]);
    expect(await rejects(servir(u, d, c.n, pide))).toMatch(/cafe:tueste/);
    // Con té, no se puede
    expect(await rejects(servir(u, d, c.n, ['te', 'casa', pide[2], pide[3]]))).toMatch(/cafe:receta/);
    await db.query('update cafe_locales set tazas = 3 where user_id = $1', [u]);
    const antes = await local(u);
    const r = await servir(u, d, c.n, pide);
    const base = premio(c.excentrico ? 'excentrico' : 'cliente', estrellasDe(4, false));
    expect(r.dado).toMatchObject({ tueste: true, aciertos: 4, granos: base.granos + BONO_TUESTE.granos, reputacion: base.reputacion + BONO_TUESTE.reputacion });
    expect(r.cafe.tostadero.tazas).toBe(2);
    const despues = await local(u);
    expect(despues.tazas).toBe(2);
    expect(despues.reputacion - antes.reputacion).toBe(base.reputacion + 4);
    // A quien no lo pidió: gasta la taza, sin bono, y el grano cuenta como fallo
    const x = await dia(u, d);
    const otro = x.dia.clientes.find((k) => !k.servido && recetaPide(k, x.dia.carta)[0] === 'cafe' && recetaPide(k, x.dia.carta)[1] !== 'casa');
    if (otro) {
      const p = recetaPide(otro, x.dia.carta);
      const r2 = await servir(u, d, otro.n, [p[0], 'casa', p[2], p[3]]);
      expect(r2.dado).toMatchObject({ tueste: false, aciertos: 3, bono_granos: 0, bono_reputacion: 0 });
      expect((await local(u)).tazas).toBe(1);
    }
  });

  it('el anónimo no puede recoger el saco ni servir; nadie toca las columnas a mano', async () => {
    expect(await rejects(as(db, null, (q) => q('select cafe_recoger_saco($1::date)', [hoy])))).toMatch(/permission denied/);
    expect(await rejects(as(db, null, (q) => q("select cafe_servir($1::date, 1, array['cafe','casa','sin','nada'], false, null)", [hoy])))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('update cafe_locales set tazas = 99')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select cafe_granos_carta(array[$1])', ['casa'])))).toMatch(/permission denied/);
  });
});
