// 1.130 · El café-librería del bajo: los libros, igual de importantes que el café, y el dominio de Pilar, en un Postgres real
// (PGlite) con todas las migraciones. `cafe_entregar`: hasta 4 aciertos de la bebida y 3 del libro, las estrellas de siete
// (las de la app), el ejemplar que se va solo si aciertas el género (+4 granos) y el que no está en la balda no cuenta. El
// reparto de la mañana: lo vendido desde el último, hasta 10, a 2 granos y solo lo que se pueda pagar, una vez. El dominio:
// servidas de 2 estrellas o más por bebida. El anónimo no puede nada y nadie toca las tablas a mano.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { premio, recetaPide } from '../cafe/cafeClientes';
import { DOMINIO, EXTRA_LIBRO, REPARTO, estrellasTotal } from '../cafe/cafeLibreria';

let db;
let A, B, C, D;
let hoy, ayer;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const dia = (u, d) => call(u, 'select cafe_dia($1::date)', [d]);
const entregar = (u, d, cliente, receta, libro = null, ok = null) => call(u, 'select cafe_entregar($1::date, $2, $3::text[], $4, $5::boolean[])', [d, cliente, receta, libro, ok]);
const TITULOS = [
  { clave: 'b1', titulo: 'El nombre del viento', genero: 'fantasia' },
  { clave: 'b2', titulo: 'Mistborn', genero: 'fantasia' },
  { clave: 'b3', titulo: 'Diez negritos', genero: 'misterio' },
  { clave: 'b4', titulo: 'Orgullo y prejuicio', genero: 'clasico' },
];
const enBalda = (r) => Object.fromEntries(r.libros.libros.filter((b) => b.balda > 0).map((b) => [b.clave, b.balda]));
const enCaja = (r) => Object.fromEntries(r.libros.libros.filter((b) => b.caja > 0).map((b) => [b.clave, b.caja]));
const granos = async (u) => (await db.query('select granos from cafe_locales where user_id = $1', [u])).rows[0].granos;
/** Una receta que no acierta nada: en cada parte, otra opción. */
const alReves = ([b, g, l, t]) => [b === 'cafe' ? 'te' : 'cafe', g === 'suave' ? 'intenso' : 'suave', l === 'sin' ? 'avena' : 'sin', t === 'nada' ? 'miel' : 'nada'];
const abrir = async (u) => {
  await call(u, 'select cafe_mio()');
  await call(u, 'select cafe_inaugurar($1)', ['Taza y Lomo']);
  const b = await call(u, 'select cafe_bienvenida($1::jsonb)', [JSON.stringify(TITULOS)]);
  return call(u, 'select cafe_colocar($1::text[], $2::text[])', [b.caja, []]);
};

beforeAll(async () => {
  db = await createDatabase();
  [A, B, C, D] = await createUsers(db, 4);
  for (const [i, u] of [A, B, C, D].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lectora ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
  }
  const f = (await db.query('select cafe_hoy()::text as h, (cafe_hoy() - 1)::text as a')).rows[0];
  [hoy, ayer] = [f.h, f.a];
  for (const u of [A, B, C, D]) await abrir(u);
}, 60000);

describe('el café-librería del bajo, 1.130: el libro en tres partes, el reparto y Pilar', () => {
  it('las estrellas de siete y las cifras son las de la app', async () => {
    for (let p = 0; p <= 7; p += 1) expect((await db.query('select cafe_estrellas_total($1) s', [p])).rows[0].s).toBe(estrellasTotal(p, 0));
    expect([estrellasTotal(4, 3), estrellasTotal(4, 2), estrellasTotal(4, 0), estrellasTotal(1, 2), estrellasTotal(0, 0)]).toEqual([3, 2, 2, 1, 1]);
    expect([EXTRA_LIBRO, REPARTO.max, REPARTO.precio, DOMINIO]).toEqual([4, 10, 2, 12]);
  });

  it('servir con el libro: los 7 aciertos dan 3 estrellas, el ejemplar se va y paga 4 granos más', async () => {
    const r0 = await dia(A, hoy);
    const [c1, c2, c3] = r0.dia.clientes;
    const antes = await granos(A);
    const balda = enBalda(r0).b1;
    const r = await entregar(A, hoy, 1, recetaPide(c1), 'b1', [true, true, true]);
    expect(r.dado).toMatchObject({ estrellas: 3, aciertos: 4, libro_aciertos: 3, libro_ok: [true, true, true], en_balda: true, llevado: true, extra: EXTRA_LIBRO, granos: premio('cliente', 3).granos + EXTRA_LIBRO });
    expect(await granos(A)).toBe(antes + premio('cliente', 3).granos + EXTRA_LIBRO);
    expect(enBalda(r).b1 ?? 0).toBe(balda - 1);
    expect(r.dia.clientes[0]).toMatchObject({ servido: true, encaja: true, estrellas: 3 });
    // El género no es: se queda en su sección y no paga de más; la extensión y la forma sí cuentan (4 + 2 = 6, 2 estrellas)
    const r2 = await entregar(A, hoy, 2, recetaPide(c2), 'b3', [false, true, true]);
    expect(r2.dado).toMatchObject({ estrellas: 2, libro_aciertos: 2, llevado: false, extra: 0, granos: premio('cliente', 2).granos });
    expect(enBalda(r2).b3).toBe(enBalda(r).b3);
    // Solo el café, aunque esté perfecto: 2 estrellas
    expect((await entregar(A, hoy, 3, recetaPide(c3))).dado).toMatchObject({ estrellas: 2, libro_aciertos: 0, llevado: false, en_balda: false });
    expect(await rejects(entregar(A, hoy, 1, recetaPide(c1)))).toMatch(/cafe:servido/);
    const filas = (await db.query('select cliente, libro, libro_aciertos, encaja, repuesto from cafe_servicios where user_id = $1 and dia = $2 order by cliente', [A, hoy])).rows;
    expect(filas).toEqual([
      { cliente: 1, libro: 'b1', libro_aciertos: 3, encaja: true, repuesto: false },
      { cliente: 2, libro: 'b3', libro_aciertos: 2, encaja: false, repuesto: false },
      { cliente: 3, libro: null, libro_aciertos: 0, encaja: false, repuesto: false },
    ]);
  });

  it('un libro que no está en la balda cuenta como solo el café; nada acertado, 1 estrella; los datos, comprobados', async () => {
    const [c1, c2] = (await dia(A, ayer)).dia.clientes;
    expect((await entregar(A, ayer, 1, recetaPide(c1), 'no-esta', [true, true, true])).dado).toMatchObject({ estrellas: 2, en_balda: false, llevado: false, libro_aciertos: 0, libro_ok: [false, false, false] });
    expect(await rejects(entregar(A, ayer, 2, recetaPide(c2), 'b1', null))).toMatch(/cafe:libro/);
    expect(await rejects(entregar(A, ayer, 2, recetaPide(c2), 'b1', [true, true]))).toMatch(/cafe:libro/);
    expect(await rejects(entregar(A, ayer, 2, ['cafe', 'suave'], 'b1', [true, true, true]))).toMatch(/cafe:receta/);
    expect(await rejects(entregar(A, ayer, 9, recetaPide(c2)))).toMatch(/cafe:cliente/);
    expect((await entregar(A, ayer, 2, alReves(recetaPide(c2)))).dado).toMatchObject({ estrellas: 1, aciertos: 0, granos: premio('cliente', 1).granos });
  });

  it('el reparto: al abrir el día llega lo vendido, a 2 granos, una sola vez', async () => {
    // Ayer se vendieron dos ejemplares (b1 y b3) y uno se quedó (el género no era)
    const r0 = await dia(B, ayer);
    expect(r0.dia.reparto).toBeNull();
    const [c1, c2, c3] = r0.dia.clientes;
    await entregar(B, ayer, 1, recetaPide(c1), 'b1', [true, false, false]);
    await entregar(B, ayer, 2, recetaPide(c2), 'b3', [true, true, false]);
    const r1 = await entregar(B, ayer, 3, recetaPide(c3), 'b2', [false, true, true]);
    const caja = enCaja(r1);
    const antes = await granos(B);
    const r = await dia(B, hoy);
    expect(r.dia.reparto).toEqual({ claves: ['b1', 'b3'], granos: 2 * REPARTO.precio, faltan: 0 });
    expect(enCaja(r)).toEqual({ ...caja, b1: (caja.b1 ?? 0) + 1, b3: (caja.b3 ?? 0) + 1 });
    expect(await granos(B)).toBe(antes - 2 * REPARTO.precio);
    // Volver a entrar no lo repite
    const otra = await dia(B, hoy);
    expect(otra.dia.reparto).toEqual(r.dia.reparto);
    expect(enCaja(otra)).toEqual(enCaja(r));
    expect(await granos(B)).toBe(antes - 2 * REPARTO.precio);
    expect((await db.query('select bool_and(repuesto) t from cafe_servicios where user_id = $1 and encaja', [B])).rows[0].t).toBe(true);
  });

  it('el reparto llega hasta donde llegan los granos (nunca a deber) y como mucho 10', async () => {
    const [c1, c2] = (await dia(C, ayer)).dia.clientes;
    await entregar(C, ayer, 1, recetaPide(c1), 'b1', [true, true, true]);
    await entregar(C, ayer, 2, recetaPide(c2), 'b2', [true, true, true]);
    await db.query('update cafe_locales set granos = 3 where user_id = $1', [C]);
    const r = await dia(C, hoy);
    expect(r.dia.reparto).toEqual({ claves: ['b1'], granos: REPARTO.precio, faltan: 1 });
    expect(await granos(C)).toBe(1);
    // Doce vendidos: llegan diez
    await dia(D, ayer);
    await db.query('update cafe_locales set granos = 100 where user_id = $1', [D]);
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 101, 102])
      await db.query("insert into cafe_servicios (user_id, dia, cliente, receta, aciertos, encaja, estrellas, granos, reputacion, libro) values ($1, $2, $3, array['cafe','suave','sin','nada'], 0, true, 1, 0, 0, $4)", [D, ayer, n, n % 2 ? 'b1' : 'b4']);
    const rd = await dia(D, hoy);
    expect(rd.dia.reparto.claves).toHaveLength(REPARTO.max);
    expect(rd.dia.reparto).toMatchObject({ granos: REPARTO.max * REPARTO.precio, faltan: 2 });
    expect(await granos(D)).toBe(100 - REPARTO.max * REPARTO.precio);
  });

  it('el dominio: servidas de 2 estrellas o más por bebida (y lo de la carta con gesto)', async () => {
    const mio = await call(A, 'select cafe_mio()');
    const filas = (await db.query('select receta[1] b, count(*)::int n from cafe_servicios where user_id = $1 and estrellas >= 2 group by 1', [A])).rows;
    expect(mio.dominio).toEqual(Object.fromEntries(filas.map((f) => [f.b, f.n])));
    expect(Object.values(mio.dominio).reduce((s, n) => s + n, 0)).toBe(4);
    // Con la nata servida, cuenta aparte
    await db.query("update cafe_servicios set receta[4] = 'nata' where user_id = $1 and cliente = 1 and dia = $2", [A, hoy]);
    expect((await call(A, 'select cafe_mio()')).dominio['toque:nata']).toBe(1);
  });

  it('el anónimo no puede entregar; nadie llama al reparto ni toca las tablas a mano', async () => {
    expect(await rejects(as(db, null, (q) => q("select cafe_entregar($1::date, 1, array['cafe','suave','sin','nada'], null, null)", [hoy])))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select cafe_reparto($1, $2::date)', [A, hoy])))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select cafe_estrellas_total(7)')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('update cafe_servicios set repuesto = false')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('update cafe_dias set reparto = null')))).toMatch(/permission denied/);
  });
});
