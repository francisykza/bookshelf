// 1.133 · El café-librería del bajo, el taller de la trastienda (primera tanda), en un Postgres real (PGlite) con todas las
// migraciones: las cifras y las listas son las de la app (cafeTaller.js); el taller se abre en el nivel 3; como mucho un
// encargo de un cliente al día, que no caduca; el primero, siempre el mismo; los demás, de 2 a 5 daños en su orden y con un
// libro distinto del anterior; las estrellas salen del mimo de cada daño y pagan 6 / 9 / 12 granos y 15 / 22 / 30 de
// reputación, una sola vez. El anónimo no puede nada y nadie toca la tabla a mano.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { CLIENTES_TALLER, DANOS, LIBROS_TALLER, PREMIO_TALLER, PRIMER_ENCARGO, TALLER_NIVEL, cuantosDanos, encargoDe, estrellasTaller } from '../cafe/cafeTaller';

let db;
let A, B, C, D;
let hoy, ayer;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const taller = (u, d) => call(u, 'select cafe_taller($1::date)', [d]);
const restaurar = (u, d, n, mimo) => call(u, 'select cafe_restaurar($1::date, $2, $3::smallint[])', [d, n, mimo]);
const local = (u) => db.query('select granos, reputacion, nivel from cafe_locales where user_id = $1', [u]).then((r) => r.rows[0]);
const alNivel = async (u, nivel, reputacion) => {
  await db.query('update cafe_locales set nivel = $2, reputacion = $3 where user_id = $1', [u, nivel, reputacion]);
  for (let n = 1; n <= nivel; n += 1) {
    await db.query('insert into cafe_niveles_cobrados (user_id, nivel, tickets) values ($1, $2, 0) on conflict do nothing', [u, n]);
    for (const k of [1, 2, 3]) await db.query('insert into cafe_hitos (user_id, nivel, hito) values ($1, $2, $3) on conflict do nothing', [u, n, k]);
  }
  // Los influencers de los niveles que ya tiene, despedidos (que no frenen la reputación)
  for (let n = 2; n <= Math.min(8, nivel + 1); n += 1)
    await db.query('insert into cafe_influencers (user_id, nivel, empezado, despedido, dia) values ($1, $2, now(), now(), cafe_hoy() - 3) on conflict do nothing', [u, n]);
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
  ayer = (await db.query('select (cafe_hoy() - 1)::text as a')).rows[0].a;
}, 60000);

describe('el café-librería del bajo, el taller de la trastienda (primera tanda)', () => {
  it('las cifras y las listas del servidor son las de la app', async () => {
    const q = (await db.query('select cafe_taller_nivel() n, cafe_danos_taller() d, cafe_libros_taller() l, cafe_clientes_taller() c')).rows[0];
    expect(q).toEqual({ n: TALLER_NIVEL, d: DANOS, l: LIBROS_TALLER.length, c: CLIENTES_TALLER.length });
    for (const e of [1, 2, 3]) expect((await db.query('select cafe_premio_taller($1) p', [e])).rows[0].p).toEqual(PREMIO_TALLER[e]);
    expect([PREMIO_TALLER[1], PREMIO_TALLER[2], PREMIO_TALLER[3]]).toEqual([
      [6, 15],
      [9, 22],
      [12, 30],
    ]);
    for (let nivel = 1; nivel <= 8; nivel += 1)
      for (const s of [0, 1, 2, 7, 999998, 999999]) expect((await db.query('select cafe_taller_cuantos($1, $2) k', [nivel, s])).rows[0].k, `${nivel}/${s}`).toBe(cuantosDanos(nivel, s));
    expect([cuantosDanos(3, 0), cuantosDanos(3, 1), cuantosDanos(6, 1), cuantosDanos(8, 1)]).toEqual([2, 3, 4, 5]);
    for (const mimo of [[], [2], [1], [2, 2], [1, 2], [1, 1], [2, 2, 2], [1, 2, 2], [1, 1, 2], [2, 2, 1, 1], [1, 2, 2, 2, 2]])
      expect((await db.query('select cafe_estrellas_taller($1::smallint[]) e', [mimo])).rows[0].e, mimo.join()).toBe(estrellasTaller(mimo));
  });

  it('por debajo del nivel 3 no hay taller', async () => {
    expect((await local(A)).nivel).toBe(1);
    expect(await rejects(taller(A, hoy))).toMatch(/cafe:taller/);
    expect(await rejects(restaurar(A, hoy, 1, [2, 2, 2]))).toMatch(/cafe:taller/);
  });

  it('el primer encargo es siempre el mismo y no se repite en el día', async () => {
    await alNivel(A, TALLER_NIVEL, 1200);
    const t = await taller(A, ayer);
    expect(t.encargo).toMatchObject({ n: 1, libro: PRIMER_ENCARGO.libro, quien: PRIMER_ENCARGO.quien, danos: PRIMER_ENCARGO.danos, llega: ayer });
    expect(encargoDe(t.encargo)).toMatchObject({ titulo: 'Don Quijote de la Mancha', primero: true });
    expect(t.hechos).toBe(0);
    expect(t.hoy).toBeNull();
    // Entrar otra vez: el mismo
    expect((await taller(A, ayer)).encargo.n).toBe(1);
  });

  it('terminar paga según el mimo, una sola vez; ese día ya no llega otro y al siguiente sí', async () => {
    expect(await rejects(restaurar(A, ayer, 1, [2, 2]))).toMatch(/cafe:mimo/);
    expect(await rejects(restaurar(A, ayer, 1, [2, 2, 3]))).toMatch(/cafe:mimo/);
    expect(await rejects(restaurar(A, ayer, 1, [0, 2, 2]))).toMatch(/cafe:mimo/);
    expect(await rejects(restaurar(A, ayer, 2, [2, 2, 2]))).toMatch(/cafe:encargo/);
    const antes = await local(A);
    const r = await restaurar(A, ayer, 1, [1, 2, 2]);
    expect(r.dado).toMatchObject({ estrellas: 2, granos: 9, reputacion: 22, mimo: [1, 2, 2] });
    const despues = await local(A);
    expect([despues.granos - antes.granos, despues.reputacion - antes.reputacion]).toEqual([9, 22]);
    expect(r.taller).toMatchObject({ encargo: null, hechos: 1, hoy: { n: 1, estrellas: 2, granos: 9, reputacion: 22 } });
    expect(r.cafe).toMatchObject({ granos: despues.granos, reputacion: despues.reputacion });
    expect(r.progreso).toBeTruthy();
    // Una sola vez
    expect(await rejects(restaurar(A, ayer, 1, [2, 2, 2]))).toMatch(/cafe:encargo/);
    expect((await taller(A, ayer)).encargo).toBeNull();
    // Al día siguiente, otro: de 2 a 3 daños en el nivel 3, en su orden, y un libro distinto del Quijote
    const t = await taller(A, hoy);
    const e = t.encargo;
    expect(e).toMatchObject({ n: 2, llega: hoy });
    expect(e.danos.length).toBeGreaterThanOrEqual(2);
    expect(e.danos.length).toBeLessThanOrEqual(3);
    expect(e.danos).toEqual(DANOS.filter((d) => e.danos.includes(d)));
    expect(e.libro).not.toBe(0);
    expect(encargoDe(e)).toBeTruthy();
    expect(t.hoy).toBeNull();
    const r2 = await restaurar(A, hoy, 2, e.danos.map(() => 2));
    expect(r2.dado).toMatchObject({ estrellas: 3, granos: 12, reputacion: 30 });
    expect(r2.taller).toMatchObject({ encargo: null, hechos: 2 });
  });

  it('el encargo no caduca: si no se termina, al día siguiente sigue el mismo', async () => {
    await alNivel(B, 5, 3500);
    const t1 = await taller(B, ayer);
    expect(t1.encargo.n).toBe(1);
    const t2 = await taller(B, hoy);
    expect(t2.encargo).toMatchObject({ n: 1, llega: ayer, danos: PRIMER_ENCARGO.danos });
    // Termina hoy: hoy ya no llega otro
    await restaurar(B, hoy, 1, [1, 1, 2]).then((r) => expect(r.dado).toMatchObject({ estrellas: 1, granos: 6, reputacion: 15 }));
    expect((await taller(B, hoy)).encargo).toBeNull();
  });

  it('en los niveles altos, más daños', async () => {
    await alNivel(C, 8, 23000);
    await taller(C, ayer);
    await restaurar(C, ayer, 1, [2, 2, 2]);
    const e = (await taller(C, hoy)).encargo;
    expect(e.danos.length).toBeGreaterThanOrEqual(4);
    expect(e.danos.length).toBeLessThanOrEqual(5);
    expect(e.danos).toEqual(DANOS.filter((d) => e.danos.includes(d)));
  });

  it('cada cuenta, sus encargos; el anónimo no puede nada y nadie toca la tabla a mano', async () => {
    await alNivel(D, 3, 1100);
    const antesA = (await db.query('select count(*)::int n from cafe_encargos where user_id = $1', [A])).rows[0].n;
    expect((await taller(D, hoy)).encargo.n).toBe(1);
    await restaurar(D, hoy, 1, [2, 2, 2]);
    expect((await db.query('select count(*)::int n from cafe_encargos where user_id = $1', [A])).rows[0].n).toBe(antesA);
    expect(await rejects(as(db, null, (q) => q('select cafe_taller($1::date)', [hoy])))).toMatch(/permission denied/);
    expect(await rejects(as(db, null, (q) => q('select cafe_restaurar($1::date, 1, array[2,2,2]::smallint[])', [hoy])))).toMatch(/permission denied/);
    expect(await rejects(as(db, null, (q) => q('select * from cafe_encargos')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select * from cafe_encargos')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('update cafe_encargos set estrellas = 3')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select cafe_taller_de($1::uuid, $2::date)', [A, hoy])))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select cafe_premio_taller(3)')))).toMatch(/permission denied/);
  });
});
