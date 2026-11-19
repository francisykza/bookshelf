// 1.144 · El obrador, segunda tanda (bloque 2 de docs/qa/cafe-libreria.md §18.12), en un Postgres real (PGlite) con todas las
// migraciones: las cifras son las de la app (cafeObrador.js); las mejoras del horno y de la vitrina se compran por grado, con su
// nivel y sus granos; las vitrinas de tartas colocadas suman huecos; Pilar vende en el mostrador por días (hasta 7, a su cupo, y las
// jornadas de prueba cuentan); la especialidad del día paga más y la piden más; la maestría da piezas, granos y «Que lo hornee
// Pilar». Nada de esto da reputación ni tickets. El anónimo no puede nada.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { CUPO_MOSTRADOR, HORNABLES, MAESTRIA, MEJORAS_OBRADOR, MOSTRADOR_DIAS, TARTAS, maestriaDe, piezasDe, precioMesa, recetaObrador, tartasEn } from '../cafe/cafeObrador';

let db;
let A, B, C, E;
let hoy;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const obrador = (u, d = hoy) => call(u, 'select cafe_obrador($1::date)', [d]);
const abrir = (u) => call(u, 'select cafe_obrador_abrir()');
const hornear = (u, receta, mimo) => call(u, 'select cafe_hornear($1, $2::smallint[])', [receta, mimo]);
const hornearPilar = (u, receta) => call(u, 'select cafe_hornear_pilar($1)', [receta]);
const mejorar = (u, mejora, d = hoy) => call(u, 'select cafe_obrador_mejorar($1, $2::date)', [mejora, d]);
const mostrador = (u, d = hoy) => call(u, 'select cafe_mostrador($1::date)', [d]);
const servir = (u, cliente, receta, d = hoy) => call(u, 'select cafe_servir_comida($1::date, $2, $3)', [d, cliente, receta]);
const local = (u) => db.query('select granos, reputacion, nivel from cafe_locales where user_id = $1', [u]).then((r) => r.rows[0]);
const tickets = async (u) => (await db.query('select tickets from piso_cuentas where user_id = $1', [u])).rows[0]?.tickets ?? null;
const alNivel = (u, nivel) => db.query('update cafe_locales set nivel = $2 where user_id = $1', [u, nivel]);
const conGranos = (u, granos) => db.query('update cafe_locales set granos = $2 where user_id = $1', [u, granos]);
const vitrina = (u, receta, piezas) =>
  db.query('insert into cafe_obrador_vitrina (user_id, receta, piezas) values ($1, $2, $3) on conflict (user_id, receta) do update set piezas = $3', [u, receta, piezas]);
/** Que pasen días para el mostrador. */
const pasanDias = (u, dias) => db.query("update cafe_obrador set mostrador_desde = now() - make_interval(days => $2) - interval '1 hour' where user_id = $1", [u, dias]);
const hornadasBuenas = (u, receta, n) =>
  db.query("insert into cafe_obrador_hornadas (user_id, dia, receta, estrellas, piezas) select $1, cafe_hoy() - 3, $2, 2, 5 from generate_series(1, $3)", [u, receta, n]);
const pasaElTiempo = (u, s = 120) => db.query('update cafe_obrador_horno set metida = metida - make_interval(secs => $2) where user_id = $1', [u, s]);

beforeAll(async () => {
  db = await createDatabase();
  [A, B, C, E] = await createUsers(db, 4);
  for (const [i, u] of [A, B, C, E].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lectora ${i}`]));
    await call(u, 'select cafe_mio()');
    await call(u, 'select cafe_inaugurar($1)', ['Taza y Lomo']);
    await alNivel(u, 4);
    await abrir(u);
  }
  hoy = (await db.query('select cafe_hoy()::text as h')).rows[0].h;
}, 60000);

describe('las mejoras del obrador', () => {
  it('las cifras del servidor son las de la app', async () => {
    for (const [mejora, grados] of Object.entries(MEJORAS_OBRADOR))
      for (const g of grados) {
        const precio = (await db.query('select cafe_obrador_precio($1, $2) as p', [mejora, g.grado])).rows[0].p;
        expect(precio).toBe(g.grado === 1 ? null : g.precio);
        if (g.grado > 1) expect((await db.query('select cafe_obrador_mejora_nivel($1, $2) as n', [mejora, g.grado])).rows[0].n).toBe(g.nivel);
      }
    for (const g of [1, 2, 3, 4]) expect((await db.query('select cafe_obrador_cupo($1) as n', [g])).rows[0].n).toBe(CUPO_MOSTRADOR[g]);
    expect((await db.query('select cafe_obrador_tarta_huecos() as n')).rows[0].n).toBe(TARTAS.huecos);
    for (const b of [0, 2, 3, 9, 10, 24, 25, 40]) expect((await db.query('select cafe_obrador_maestria($1) as n', [b])).rows[0].n).toBe(maestriaDe(b));
    expect(MAESTRIA).toEqual([3, 10, 25]);
    const plano = { items: [{ id: 'cafe-vitrina' }, { id: 'cafe-silla' }, { id: 'cafe-vitrina' }, { id: 'cafe-vitrina' }] };
    expect((await db.query('select cafe_obrador_tartas($1::jsonb) as n', [JSON.stringify(plano)])).rows[0].n).toBe(tartasEn(plano));
    expect(tartasEn(plano)).toBe(2);
  });

  it('el horno: el grado siguiente con su nivel y sus granos; dos bandejas, dos hornadas a la vez', async () => {
    await conGranos(A, 100);
    await expect(mejorar(A, 'horno')).rejects.toThrow(/cafe:granos/);
    await expect(mejorar(A, 'chimenea')).rejects.toThrow(/cafe:obrador_mejora/);
    await conGranos(A, 1000);
    const tk = await tickets(A);
    const rep = (await local(A)).reputacion;
    const r = await mejorar(A, 'horno');
    expect(r.obrador).toMatchObject({ horno: 2, bandejas: 2 });
    expect((await local(A)).granos).toBe(1000 - 250);
    // El 3, desde el nivel 6
    await expect(mejorar(A, 'horno')).rejects.toThrow(/cafe:obrador_nivel/);
    // Dos hornadas a la vez, y la segunda cuenta en lo que te ha dado el horno
    await hornear(A, 'magdalenas', [2, 2]);
    const dos = await hornear(A, 'empanada', [2, 2]);
    expect(dos.dado.bandeja).toBe(2);
    expect(dos.obrador.horneando).toHaveLength(2);
    expect(dos.obrador.dado.horno).toBe(1);
    await expect(hornear(A, 'magdalenas', [2, 2])).rejects.toThrow(/cafe:horno/);
    await alNivel(A, 6);
    expect((await mejorar(A, 'horno')).obrador).toMatchObject({ horno: 3, bandejas: 3 });
    await expect(mejorar(A, 'horno')).rejects.toThrow(/cafe:obrador_mejora/);
    // Ni reputación ni tickets
    expect((await local(A)).reputacion).toBe(rep);
    expect(await tickets(A)).toBe(tk);
  });

  it('la vitrina: más sitio y más cupo; las vitrinas de tartas colocadas suman 6 huecos cada una, hasta dos', async () => {
    await conGranos(B, 2000);
    expect((await obrador(B)).obrador).toMatchObject({ vitrina: 1, cabe: 12, cupo: 4, tartas: 0 });
    expect((await mejorar(B, 'vitrina')).obrador).toMatchObject({ vitrina: 2, cabe: 20, cupo: 6 });
    await expect(mejorar(B, 'vitrina')).rejects.toThrow(/cafe:obrador_nivel/);
    await alNivel(B, 5);
    expect((await mejorar(B, 'vitrina')).obrador).toMatchObject({ vitrina: 3, cabe: 30, cupo: 9 });
    await expect(mejorar(B, 'vitrina')).rejects.toThrow(/cafe:obrador_nivel/);
    await alNivel(B, 7);
    expect((await mejorar(B, 'vitrina')).obrador).toMatchObject({ vitrina: 4, cabe: 40, cupo: 12 });
    expect((await local(B)).granos).toBe(2000 - 150 - 350 - 700);
    // Tres vitrinas de tartas en el plano: cuentan dos
    await db.query(
      "update cafe_locales set plano = jsonb_set(coalesce(plano, '{}'::jsonb), '{items}', coalesce(plano -> 'items', '[]'::jsonb) || '[{\"id\":\"cafe-vitrina\",\"x\":1,\"y\":1},{\"id\":\"cafe-vitrina\",\"x\":3,\"y\":1},{\"id\":\"cafe-vitrina\",\"x\":5,\"y\":1}]'::jsonb) where user_id = $1",
      [B],
    );
    expect((await obrador(B)).obrador).toMatchObject({ cabe: 40 + 2 * TARTAS.huecos, tartas: 2 });
    // Y valen al sacar una hornada: 51 de 52, cabe una más
    await vitrina(B, 'magdalenas', 51);
    await hornear(B, 'empanada', [2, 2]);
    await pasaElTiempo(B);
    const s = await call(B, 'select cafe_sacar_hornada(1)');
    expect(s.dado).toMatchObject({ sacadas: 1, quedan: piezasDe('empanada', 3) - 1 });
  });

  it('el mostrador: por días enteros (hasta 7), a su cupo, primero la especialidad; a precio base', async () => {
    await vitrina(C, 'magdalenas', 10);
    await vitrina(C, 'empanada', 3);
    // Recién abierto, nada
    expect((await obrador(C)).obrador.mostrador).toEqual({ dias: 0, piezas: 0, granos: 0 });
    expect((await mostrador(C)).cobrado).toMatchObject({ dias: 0, piezas: 0, granos: 0 });
    // Dos días: 8 piezas con la vitrina de grado 1
    await pasanDias(C, 2);
    const o = await obrador(C);
    expect(o.obrador.mostrador.dias).toBe(2);
    const esp = o.especialidad;
    expect(HORNABLES).toContain(esp);
    const antes = await local(C);
    const tk = await tickets(C);
    const r = await mostrador(C);
    expect(r.cobrado.piezas).toBe(2 * CUPO_MOSTRADOR[1]);
    // Primero la especialidad (todas las que haya, hasta el cupo) y después lo que más haya
    const deEsp = Math.min(esp === 'magdalenas' ? 10 : 3, 8);
    expect(r.cobrado.vendidas[esp]).toBe(deEsp);
    let granos = 0;
    for (const [id, n] of Object.entries(r.cobrado.vendidas)) granos += n * (recetaObrador(id).precio + (id === esp ? 1 : 0));
    expect(r.cobrado.granos).toBe(granos);
    expect((await local(C)).granos - antes.granos).toBe(granos);
    expect((await local(C)).reputacion).toBe(antes.reputacion);
    expect(await tickets(C)).toBe(tk);
    expect(r.obrador.mostrador).toEqual({ dias: 0, piezas: 8, granos });
    // Lo mismo no se cobra dos veces
    expect((await mostrador(C)).cobrado.piezas).toBe(0);
    // Más de 7 días: solo 7 (y aun así, lo que haya en la vitrina)
    await vitrina(C, 'magdalenas', 40);
    await pasanDias(C, 12);
    expect((await obrador(C)).obrador.mostrador.dias).toBe(MOSTRADOR_DIAS);
    expect((await mostrador(C)).cobrado.piezas).toBe(MOSTRADOR_DIAS * CUPO_MOSTRADOR[1]);
    // Con la vitrina vacía, los días se gastan sin vender nada
    await db.query('update cafe_obrador_vitrina set piezas = 0 where user_id = $1', [C]);
    await pasanDias(C, 1);
    expect((await mostrador(C)).cobrado).toMatchObject({ dias: 1, piezas: 0, granos: 0 });
    expect((await obrador(C)).obrador.mostrador.dias).toBe(0);
  });

  it('las jornadas de prueba cuentan como un día más para el mostrador', async () => {
    await db.query("insert into cafe_probadores (user_id, jornada) values ($1, date '3000-01-01')", [E]);
    const dia = '3000-01-01';
    await vitrina(E, 'magdalenas', 12);
    expect((await mostrador(E, dia)).cobrado.piezas).toBe(0);
    await db.query("update cafe_probadores set jornada = date '3000-01-02' where user_id = $1", [E]);
    expect((await obrador(E, '3000-01-02')).obrador.mostrador.dias).toBe(1);
    expect((await mostrador(E, '3000-01-02')).cobrado.piezas).toBe(CUPO_MOSTRADOR[1]);
    expect((await mostrador(E, '3000-01-02')).cobrado.piezas).toBe(0);
  });

  it('al mejorar la vitrina, primero se cobra lo vendido con el cupo de antes', async () => {
    await vitrina(E, 'magdalenas', 12);
    await conGranos(E, 500);
    await db.query("update cafe_probadores set jornada = date '3000-01-03' where user_id = $1", [E]);
    const r = await mejorar(E, 'vitrina', '3000-01-03');
    expect(r.cobrado.piezas).toBe(CUPO_MOSTRADOR[1]);
    expect(r.obrador).toMatchObject({ vitrina: 2, mostrador: { dias: 0 } });
  });

  it('la especialidad: la misma todo el día, una receta abierta; la piden más y paga un grano más en la mesa', async () => {
    const o = await obrador(A);
    expect(HORNABLES).toContain(o.especialidad);
    expect((await obrador(A)).especialidad).toBe(o.especialidad);
    // Con 13 clientes, de los que piden comida, más del tipo de la especialidad que del otro (dos de cada tres, con la semilla)
    await db.query('update cafe_dias set clientes = 13 where user_id = $1 and dia = $2::date', [A, hoy]);
    const piden = (await obrador(A)).piden;
    const tipoEsp = recetaObrador(o.especialidad).tipo;
    const sem = await db.query(
      "select count(*) filter (where k < 4) as esp, count(*) as n from (select ((cafe_semilla($1::uuid, $2::date, 'f' || g) / 3) % 6) as k from generate_series(1, 12) g where cafe_semilla($1::uuid, $2::date, 'f' || g) % 3 = 0) t",
      [A, hoy],
    );
    const deLaCarta = piden.filter((p) => p.n < 100);
    expect(deLaCarta.filter((p) => p.tipo === tipoEsp)).toHaveLength(Number(sem.rows[0].esp));
    expect(deLaCarta).toHaveLength(Number(sem.rows[0].n));
    // Servir la especialidad: precio + 1
    const pide = deLaCarta.find((p) => p.tipo === tipoEsp);
    if (pide) {
      await db.query("insert into cafe_servicios (user_id, dia, cliente, receta, aciertos, encaja, estrellas, granos, reputacion) values ($1, $2::date, $3, array['cafe','suave','sin','nada'], 4, true, 3, 0, 0) on conflict do nothing", [A, hoy, pide.n]);
      await vitrina(A, o.especialidad, 3);
      const r = await servir(A, pide.n, o.especialidad);
      expect(r.dado).toMatchObject({ granos: precioMesa(o.especialidad, { especialidad: o.especialidad }), especialidad: true, maestria: false });
    }
  });

  it('la maestría: ★ una pieza más, ★★ un grano más en la mesa y ★★★ «Que lo hornee Pilar», como una de 3 estrellas', async () => {
    // Sin dominarla, Pilar no la hornea
    await expect(hornearPilar(C, 'empanada')).rejects.toThrow(/cafe:maestria/);
    await db.query('delete from cafe_obrador_horno where user_id = $1', [C]);
    // Con 3 buenas, una pieza más (también con 1 estrella)
    await hornadasBuenas(C, 'empanada', 3);
    let r = await hornear(C, 'empanada', [1, 1]);
    expect(r.dado).toMatchObject({ estrellas: 1, piezas: piezasDe('empanada', 1, 3), maestria: 1 });
    expect(r.dado.piezas).toBe(recetaObrador('empanada').piezas[0] + 1);
    expect((await obrador(C)).obrador.recetas.empanada).toEqual({ buenas: 3, maestria: 1 });
    await db.query('delete from cafe_obrador_horno where user_id = $1', [C]);
    // Con 25, Pilar la hornea: 3 estrellas y la pieza de más; cuenta como suya
    await hornadasBuenas(C, 'empanada', 22);
    expect((await obrador(C)).obrador.recetas.empanada).toEqual({ buenas: 25, maestria: 3 });
    r = await hornearPilar(C, 'empanada');
    expect(r.dado).toMatchObject({ estrellas: 3, piezas: piezasDe('empanada', 3, 25), pilar: true });
    expect(r.obrador.dado.pilar).toBe(1);
    expect(r.obrador.recetas.empanada.buenas).toBe(26);
    // La otra receta, aún a mano
    await expect(hornearPilar(C, 'magdalenas')).rejects.toThrow(/cafe:maestria/);
    await expect(hornearPilar(C, 'galletas')).rejects.toThrow(/cafe:maestria|cafe:receta/);
  });

  it('el anónimo no puede nada de lo nuevo, ni nadie las funciones internas', async () => {
    expect(await rejects(as(db, null, (q) => q("select cafe_obrador_mejorar('horno', $1::date)", [hoy])))).toMatch(/permission denied/);
    expect(await rejects(as(db, null, (q) => q('select cafe_mostrador($1::date)', [hoy])))).toMatch(/permission denied/);
    expect(await rejects(as(db, null, (q) => q("select cafe_hornear_pilar('magdalenas')")))).toMatch(/permission denied/);
    for (const sql of [
      "select cafe_hornear_de($1::uuid, 'magdalenas', array[2,2]::smallint[], true)",
      'select cafe_mostrador_cobrar($1::uuid, cafe_hoy())',
      'select cafe_mostrador_dias($1::uuid)',
      'select cafe_obrador_capacidad($1::uuid)',
      'select cafe_obrador_especialidad($1::uuid, cafe_hoy())',
      "select cafe_obrador_buenas($1::uuid, 'magdalenas')",
    ])
      expect(await rejects(as(db, A, (q) => q(sql, [A])))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q("select cafe_obrador_precio('horno', 2)")))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('update cafe_obrador set horno = 3')))).toMatch(/permission denied/);
  });
});
