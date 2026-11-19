// 1.143 · El café-librería del bajo, el obrador (primera tanda), en un Postgres real (PGlite) con todas las migraciones: las
// cifras son las de la app (cafeObrador.js); se abre en el nivel 4, una vez, con la primera hornada de la casa en la vitrina;
// hornear pide una receta abierta, el mimo de sus dos gestos y una bandeja libre (hasta 30 hornadas al día); sacarla, su tiempo,
// y a la vitrina hasta llenarla (lo que no cabe espera); servir comida, una vez por cliente ya servido que la pidió, del tipo
// que pidió, y paga solo granos (ni reputación ni tickets). Máximo dos cosas por cliente (Francisco, 17-11-2026): quien pide comida
// no pide libro y sus estrellas salen solo de la bebida. El anónimo no puede nada y nadie toca las tablas a mano.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { CABE_VITRINA, HORNABLES, OBRADOR_NIVEL, PRIMERA_HORNADA, TOPE_HORNADAS, estrellasBebida, estrellasHornada, piezasDe, recetaObrador } from '../cafe/cafeObrador';
import { premio } from '../cafe/cafeClientes';

let db;
let A, B, C, D;
let hoy;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const obrador = (u, d = hoy) => call(u, 'select cafe_obrador($1::date)', [d]);
const abrir = (u) => call(u, 'select cafe_obrador_abrir()');
const hornear = (u, receta, mimo) => call(u, 'select cafe_hornear($1, $2::smallint[])', [receta, mimo]);
const sacar = (u, bandeja) => call(u, 'select cafe_sacar_hornada($1)', [bandeja]);
const servir = (u, cliente, receta, d = hoy) => call(u, 'select cafe_servir_comida($1::date, $2, $3)', [d, cliente, receta]);
const local = (u) => db.query('select granos, reputacion, nivel, granos_ganados from cafe_locales where user_id = $1', [u]).then((r) => r.rows[0]);
const tickets = async (u) => (await db.query('select tickets from piso_cuentas where user_id = $1', [u])).rows[0]?.tickets ?? null;
const alNivel = (u, nivel) => db.query('update cafe_locales set nivel = $2 where user_id = $1', [u, nivel]);
/** Que pase el tiempo de lo que hay en el horno. */
const pasaElTiempo = (u, s = 120) => db.query("update cafe_obrador_horno set metida = metida - make_interval(secs => $2) where user_id = $1", [u, s]);
/** Servir la bebida a mano (lo que hace `cafe_entregar`): solo la fila del servicio. */
const servido = (u, cliente, d = hoy) =>
  db.query("insert into cafe_servicios (user_id, dia, cliente, receta, aciertos, encaja, estrellas, granos, reputacion) values ($1, $2::date, $3, array['cafe','suave','sin','nada'], 4, true, 3, 0, 0)", [u, d, cliente]);

beforeAll(async () => {
  db = await createDatabase();
  [A, B, C] = await createUsers(db, 3);
  // Para «máximo dos», una cuenta con al menos tres de los doce primeros que piden comida y alguno que no (la semilla depende de la
  // cuenta y del día; así la prueba no depende del azar del identificador)
  const h = (await db.query("select cafe_hoy()::text as h")).rows[0].h;
  D = (
    await db.query(
      "select u.id from (select gen_random_uuid() as id from generate_series(1, 300)) u where (select count(*) from generate_series(1, 12) n where cafe_semilla(u.id, $1::date, 'f' || n) % 3 = 0) between 3 and 11 limit 1",
      [h],
    )
  ).rows[0].id;
  await db.query('insert into auth.users (id) values ($1)', [D]);
  for (const [i, u] of [A, B, C, D].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lectora ${i}`]));
    await call(u, 'select cafe_mio()');
    await call(u, 'select cafe_inaugurar($1)', ['Taza y Lomo']);
  }
  hoy = (await db.query('select cafe_hoy()::text as h')).rows[0].h;
}, 60000);

describe('el obrador', () => {
  it('las cifras del servidor son las de la app', async () => {
    expect((await db.query('select cafe_obrador_nivel() as n')).rows[0].n).toBe(OBRADOR_NIVEL);
    expect((await db.query('select cafe_obrador_tope() as n')).rows[0].n).toBe(TOPE_HORNADAS);
    for (const g of [1, 2, 3, 4]) expect((await db.query('select cafe_obrador_cabe($1) as n', [g])).rows[0].n).toBe(CABE_VITRINA[g]);
    for (const id of HORNABLES) {
      const r = recetaObrador(id);
      const s = (await db.query('select cafe_obrador_receta($1) as r', [id])).rows[0].r;
      expect(s).toEqual({ tipo: r.tipo, nivel: r.nivel, piezas: r.piezas, precio: r.precio, segundos: r.segundos });
    }
    // Las de la 1.145, aún no
    expect((await db.query("select cafe_obrador_receta('galletas') as r")).rows[0].r).toBeNull();
    for (const mimo of [[2, 2], [2, 1], [1, 2], [1, 1]]) expect((await db.query('select cafe_estrellas_taller($1::smallint[]) as e', [mimo])).rows[0].e).toBe(estrellasHornada(mimo));
    for (const a of [0, 1, 2, 3, 4]) expect((await db.query('select cafe_estrellas_bebida($1) as e', [a])).rows[0].e).toBe(estrellasBebida(a));
  });

  it('por debajo del nivel 4 no se abre ni se hornea, y nadie pide comida', async () => {
    const o = await obrador(A);
    // Sin el obrador abierto, tampoco va la especialidad (1.144)
    expect(o).toEqual({ obrador: null, piden: [] });
    await expect(abrir(A)).rejects.toThrow(/cafe:obrador/);
    await expect(hornear(A, 'magdalenas', [2, 2])).rejects.toThrow(/cafe:obrador/);
  });

  it('en el nivel 4 se abre una vez, con la primera hornada de la casa en la vitrina', async () => {
    await alNivel(A, 4);
    const r = await abrir(A);
    expect(r.nuevo).toBe(true);
    expect(r.obrador).toMatchObject({ horno: 1, vitrina: 1, bandejas: 1, cabe: 12, horneando: [], piezas: { [PRIMERA_HORNADA.receta]: PRIMERA_HORNADA.piezas }, hornadas_hoy: 0, vendidas: 0 });
    const otra = await abrir(A);
    expect(otra.nuevo).toBe(false);
    expect(otra.obrador.piezas).toEqual({ magdalenas: 6 });
  });

  it('hornear: receta abierta, el mimo de los dos gestos y una bandeja libre; las estrellas dan las piezas', async () => {
    await expect(hornear(A, 'galletas', [2, 2])).rejects.toThrow(/cafe:receta/);
    await expect(hornear(A, 'pizza', [2, 2])).rejects.toThrow(/cafe:receta/);
    await expect(hornear(A, 'empanada', [2])).rejects.toThrow(/cafe:mimo/);
    await expect(hornear(A, 'empanada', [2, 3])).rejects.toThrow(/cafe:mimo/);
    const r = await hornear(A, 'empanada', [2, 1]);
    expect(r.dado).toMatchObject({ bandeja: 1, estrellas: 2, piezas: piezasDe('empanada', 2) });
    expect(r.obrador.horneando).toHaveLength(1);
    expect(r.obrador.horneando[0]).toMatchObject({ bandeja: 1, receta: 'empanada', piezas: 5, estrellas: 2 });
    expect(r.obrador.horneando[0].falta).toBeGreaterThan(80);
    expect(r.obrador.hornadas_hoy).toBe(1);
    // Una sola bandeja en el grado 1
    await expect(hornear(A, 'magdalenas', [2, 2])).rejects.toThrow(/cafe:horno/);
  });

  it('sacar: pasado su tiempo; a la vitrina hasta llenarla y lo que no cabe espera en la bandeja', async () => {
    await expect(sacar(A, 2)).rejects.toThrow(/cafe:bandeja/);
    await expect(sacar(A, 1)).rejects.toThrow(/cafe:pronto/);
    await pasaElTiempo(A);
    let r = await sacar(A, 1);
    expect(r.dado).toMatchObject({ receta: 'empanada', sacadas: 5, quedan: 0 });
    expect(r.obrador.piezas).toEqual({ magdalenas: 6, empanada: 5 });
    expect(r.obrador.horneando).toEqual([]);
    // 11 de 12: de la siguiente (6 magdalenas) cabe una y las otras cinco esperan
    r = await hornear(A, 'magdalenas', [2, 2]);
    expect(r.dado.piezas).toBe(6);
    await pasaElTiempo(A);
    r = await sacar(A, 1);
    expect(r.dado).toMatchObject({ sacadas: 1, quedan: 5 });
    expect(r.obrador.piezas).toEqual({ magdalenas: 7, empanada: 5 });
    expect(r.obrador.horneando[0]).toMatchObject({ receta: 'magdalenas', piezas: 5, falta: 0 });
    await expect(sacar(A, 1)).rejects.toThrow(/cafe:vitrina/);
    // Con la bandeja esperando, el horno no admite otra
    await expect(hornear(A, 'empanada', [2, 2])).rejects.toThrow(/cafe:horno/);
  });

  it('quién pide comida lo decide el servidor; servirla paga solo granos, una vez y del tipo que pidió', async () => {
    await obrador(A);
    // Con trece clientes, que alguno de la carta pida y otro no es casi seguro (la semilla depende de la cuenta)
    await db.query('update cafe_dias set clientes = 13 where user_id = $1 and dia = $2::date', [A, hoy]);
    const o = await obrador(A);
    const d = (await db.query('select clientes, habituales from cafe_dias where user_id = $1 and dia = $2::date', [A, hoy])).rows[0];
    // Ni el excéntrico (el último de la carta) ni el influencer
    expect(o.piden.every((p) => p.n !== d.clientes && p.n < 300)).toBe(true);
    expect(o.piden.every((p) => p.tipo === 'dulce' || p.tipo === 'salado')).toBe(true);
    // El mismo día, siempre los mismos
    expect((await obrador(A)).piden).toEqual(o.piden);
    // Buscamos uno que pida y otro que no entre los clientes de la carta (con más días si hace falta)
    const pide = o.piden.find((p) => p.n < 100);
    const noPide = Array.from({ length: d.clientes - 1 }, (_, k) => k + 1).find((n) => !o.piden.some((p) => p.n === n));
    expect(pide).toBeTruthy();
    const receta = pide.tipo === 'dulce' ? 'magdalenas' : 'empanada';
    const otra = pide.tipo === 'dulce' ? 'empanada' : 'magdalenas';
    // Sin servirle la bebida, no
    await expect(servir(A, pide.n, receta)).rejects.toThrow(/cafe:cliente/);
    await servido(A, pide.n);
    await expect(servir(A, pide.n, otra)).rejects.toThrow(/cafe:comida/);
    await expect(servir(A, pide.n, 'galletas')).rejects.toThrow(/cafe:comida/);
    const antes = await local(A);
    const tk = await tickets(A);
    const r = await servir(A, pide.n, receta);
    // 1.144: la especialidad del día paga un grano más (cafe-obrador-mejoras.rls.test.js)
    const precio = recetaObrador(receta).precio + (o.especialidad === receta ? 1 : 0);
    expect(r.dado).toMatchObject({ granos: precio, receta });
    const despues = await local(A);
    expect(despues.granos - antes.granos).toBe(precio);
    expect(despues.granos_ganados - antes.granos_ganados).toBe(precio);
    expect(despues.reputacion).toBe(antes.reputacion);
    expect(await tickets(A)).toBe(tk);
    expect(r.obrador.vendidas).toBe(1);
    expect((await obrador(A)).piden.find((p) => p.n === pide.n)).toMatchObject({ servido: true, receta });
    await expect(servir(A, pide.n, receta)).rejects.toThrow(/cafe:servido/);
    if (noPide) {
      await servido(A, noPide);
      await expect(servir(A, noPide, 'magdalenas')).rejects.toThrow(/cafe:comida/);
    }
    // Un día que no vale
    await expect(servir(A, pide.n, receta, '2020-01-01')).rejects.toThrow(/cafe:dia/);
  });

  it('máximo dos: quien pide comida no pide libro; sus estrellas, solo de la bebida, y un libro que llegara no cuenta', async () => {
    await alNivel(D, 4);
    await abrir(D);
    await obrador(D);
    await db.query('update cafe_dias set clientes = 13 where user_id = $1 and dia = $2::date', [D, hoy]);
    const o = await obrador(D);
    // Uno de cada tres, más o menos (la semilla depende de la cuenta): ni todos ni ninguno de los doce de la carta
    const deLaCarta = o.piden.filter((p) => p.n < 100);
    expect(deLaCarta.length).toBeGreaterThan(0);
    expect(deLaCarta.length).toBeLessThan(12);
    const pide = deLaCarta[0];
    const noPide = Array.from({ length: 12 }, (_, k) => k + 1).find((n) => !o.piden.some((p) => p.n === n));
    const receta = async (n) => (await db.query('select cafe_pide($1::uuid, $2::date, $3) as p', [D, hoy, n])).rows[0].p;
    const entregar = (n, r, libro, ok) => call(D, 'select cafe_entregar($1::date, $2, $3::text[], $4, $5::boolean[])', [hoy, n, r, libro, ok]);
    const cat = 'cat:el-hobbit';
    await db.query("insert into cafe_libros (user_id, clave, titulo, genero, caja, balda) values ($1, $2, 'El hobbit', 'fantasia', 0, 3) on conflict (user_id, clave) do update set balda = 3", [D, cat]);
    const balda = async () => (await db.query('select balda from cafe_libros where user_id = $1 and clave = $2', [D, cat])).rows[0].balda;
    // La bebida perfecta y un libro «perfecto» que no pidió: 3★, sin libro llevado ni extra, y la balda, igual
    const bien = await receta(pide.n);
    const r1 = await entregar(pide.n, bien, cat, [true, true, true]);
    expect(r1.dado).toMatchObject({ comida: pide.tipo, estrellas: 3, en_balda: false, llevado: false, extra: 0, libro_aciertos: 0, granos: premio('cliente', 3).granos });
    expect(await balda()).toBe(3);
    // Con la comida, ya servida la bebida, se le sirve su pieza
    const pieza = pide.tipo === 'dulce' ? 'magdalenas' : 'empanada';
    await db.query('insert into cafe_obrador_vitrina (user_id, receta, piezas) values ($1, $2, 2) on conflict (user_id, receta) do update set piezas = 2', [D, pieza]);
    expect((await servir(D, pide.n, pieza)).dado).toMatchObject({ granos: recetaObrador(pieza).precio + (o.especialidad === pieza ? 1 : 0), receta: pieza });
    // 2 o 3 aciertos de la bebida, 2★; menos, 1★ (sin libro que los suba)
    const otros = deLaCarta.slice(1, 3);
    expect(otros).toHaveLength(2);
    expect(noPide).toBeTruthy();
    for (const [k, p] of otros.entries()) {
      const r = await receta(p.n);
      const mal = k === 0 ? [r[0], r[1], r[2] === 'sin' ? 'entera' : 'sin', r[3]] : [r[0] === 'cafe' ? 'te' : 'cafe', r[1] === 'suave' ? 'intenso' : 'suave', r[2] === 'sin' ? 'entera' : 'sin', r[3]];
      const esperadas = estrellasBebida(mal.filter((x, i) => x === r[i]).length);
      expect(esperadas).toBe(k === 0 ? 2 : 1);
      expect((await entregar(p.n, mal, null, null)).dado).toMatchObject({ comida: p.tipo, estrellas: esperadas });
    }
    // Quien no pide comida sigue pidiendo libro, como siempre: 3★ con los siete
    const r2 = await entregar(noPide, await receta(noPide), cat, [true, true, true]);
    expect(r2.dado).toMatchObject({ comida: null, estrellas: 3, en_balda: true, llevado: true, extra: 4 });
    expect(await balda()).toBe(2);
  });

  it('sin piezas del tipo que pide, no se sirve', async () => {
    await alNivel(B, 4);
    await abrir(B);
    await db.query("update cafe_obrador_vitrina set piezas = 0 where user_id = $1", [B]);
    const o = await obrador(B);
    const pide = o.piden.find((p) => p.n < 100);
    if (!pide) return;
    await servido(B, pide.n);
    await expect(servir(B, pide.n, pide.tipo === 'dulce' ? 'magdalenas' : 'empanada')).rejects.toThrow(/cafe:agotado/);
  });

  it('hasta 30 hornadas al día', async () => {
    await db.query("insert into cafe_obrador_hornadas (user_id, dia, receta, estrellas, piezas) select $1, cafe_hoy(), 'magdalenas', 3, 6 from generate_series(1, 30)", [B]);
    await expect(hornear(B, 'magdalenas', [2, 2])).rejects.toThrow(/cafe:hornadas/);
  });

  it('cada cuenta, su obrador; el anónimo no puede nada y nadie toca las tablas a mano', async () => {
    await alNivel(C, 4);
    await abrir(C);
    expect((await obrador(C)).obrador.piezas).toEqual({ magdalenas: 6 });
    expect(await rejects(as(db, null, (q) => q('select cafe_obrador($1::date)', [hoy])))).toMatch(/permission denied/);
    expect(await rejects(as(db, null, (q) => q('select cafe_obrador_abrir()')))).toMatch(/permission denied/);
    expect(await rejects(as(db, null, (q) => q("select cafe_hornear('magdalenas', array[2,2]::smallint[])")))).toMatch(/permission denied/);
    expect(await rejects(as(db, null, (q) => q('select cafe_sacar_hornada(1)')))).toMatch(/permission denied/);
    expect(await rejects(as(db, null, (q) => q("select cafe_servir_comida($1::date, 1, 'magdalenas')", [hoy])))).toMatch(/permission denied/);
    for (const t of ['cafe_obrador', 'cafe_obrador_horno', 'cafe_obrador_vitrina', 'cafe_obrador_hornadas', 'cafe_obrador_ventas']) {
      expect(await rejects(as(db, A, (q) => q(`select * from ${t}`)))).toMatch(/permission denied/);
      expect(await rejects(as(db, null, (q) => q(`select * from ${t}`)))).toMatch(/permission denied/);
    }
    expect(await rejects(as(db, A, (q) => q('update cafe_obrador_vitrina set piezas = 99')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select cafe_pide_comida($1::uuid, $2::date, 1)', [A, hoy])))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select cafe_obrador_json($1::uuid)', [A])))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q("select cafe_obrador_receta('magdalenas')")))).toMatch(/permission denied/);
  });
});
