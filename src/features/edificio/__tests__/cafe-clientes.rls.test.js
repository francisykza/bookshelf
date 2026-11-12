// 1.121 · El café-librería del bajo, bloque 3, en un Postgres real (PGlite) con todas las migraciones: el día solo vale hoy
// o ayer (Madrid), los clientes los fija el nivel del servidor y el último es el excéntrico, cada uno se atiende una vez con
// una receta válida, el servidor compara la receta con la que pidió y pone estrellas (fallar paga menos, nunca cero), el
// excéntrico bordado paga el triple y deja su reseña dorada, los habituales tienen tope de 2 al día y dejan su reseña, y las
// tablas no se leen ni se tocan directamente. Las cifras, listas y recetas son las de la app.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { BEBIDAS, EXCENTRICOS, HABITUALES, MAX_HABITUALES, PREMIOS, RESENAS, clientesDelNivel, estrellasDe, recetaDe, recetaPide } from '../cafe/cafeClientes';

let db;
let A, B;
let hoy, ayer, antier, manana;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const dia = (u, d) => call(u, 'select cafe_dia($1::date)', [d]);
const habitual = (u, d) => call(u, 'select cafe_habitual($1::date)', [d]);
const servir = (u, d, cliente, receta, encaja) => call(u, 'select cafe_servir($1::date, $2, $3::text[], $4)', [d, cliente, receta, encaja]);
/** Una receta que no acierta nada: en cada parte, otra opción. */
const alReves = ([b, g, l, t]) => [b === 'cafe' ? 'te' : 'cafe', g === 'suave' ? 'intenso' : 'suave', l === 'sin' ? 'avena' : 'sin', t === 'nada' ? 'miel' : 'nada'];

beforeAll(async () => {
  db = await createDatabase();
  [A, B] = await createUsers(db, 2);
  for (const [i, u] of [A, B].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lectora ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
  }
  const fechas = (await db.query('select cafe_hoy()::text as h, (cafe_hoy() - 1)::text as a, (cafe_hoy() - 2)::text as aa, (cafe_hoy() + 1)::text as m')).rows[0];
  [hoy, ayer, antier, manana] = [fechas.h, fechas.a, fechas.aa, fechas.m];
  await call(A, 'select cafe_mio()');
  await call(A, 'select cafe_inaugurar($1)', ['Taza y Lomo']);
}, 60000);

describe('el café-librería del bajo: clientes, recetas, estrellas y el excéntrico', () => {
  it('las cifras, recetas y estrellas del servidor son las de la app', async () => {
    for (const n of [1, 2, 3, 4, 5]) expect((await db.query('select cafe_clientes_nivel($1) as c', [n])).rows[0].c).toBe(clientesDelNivel(n));
    expect((await db.query('select cafe_bebidas(1) as b')).rows[0].b).toEqual(BEBIDAS.filter((b) => b.nivel <= 1).map((b) => b.id));
    for (const r of [0, 1, 2, 5, 11, 12, 13, 35, 36, 99, 431, 999]) expect((await db.query('select cafe_receta($1) as r', [r])).rows[0].r).toEqual(recetaDe(r));
    for (let a = 0; a <= 4; a += 1) for (const e of [false, true]) expect((await db.query('select cafe_estrellas($1, $2) as s', [a, e])).rows[0].s).toBe(estrellasDe(a, e));
    for (const [tipo, lista] of Object.entries(PREMIOS))
      for (const [k, p] of lista.entries()) expect((await db.query('select cafe_premio($1, $2) as p', [tipo, k + 1])).rows[0].p).toEqual([p.granos, p.reputacion]);
    expect(HABITUALES).toHaveLength(12);
    expect(RESENAS).toHaveLength(12);
    expect(EXCENTRICOS).toHaveLength(6);
    expect(MAX_HABITUALES).toBe(2);
  });

  it('sin inaugurar no hay clientes; el día, solo hoy o ayer', async () => {
    await call(B, 'select cafe_mio()');
    expect(await rejects(dia(B, hoy))).toMatch(/cafe:cerrado/);
    for (const d of [antier, manana, null]) expect(await rejects(dia(A, d))).toMatch(/cafe:dia/);
    const r = await dia(A, ayer);
    expect(r.dia.clientes).toHaveLength(3);
  });

  it('los clientes del día los fija el nivel; el último es el excéntrico; son siempre los mismos al volver', async () => {
    const r = await dia(A, hoy);
    expect(r.dia).toMatchObject({ dia: hoy, habituales: [], pizarra: [] });
    expect(r.dia.clientes.map((c) => [c.n, c.excentrico])).toEqual([
      [1, false],
      [2, false],
      [3, true],
    ]);
    const ex = r.dia.clientes[2];
    expect(ex.quien).toBe(ex.semilla % 6);
    expect(r.dia.clientes[0].quien).toBeNull();
    expect(r.dia.clientes.every((c) => c.servido === false && Number.isInteger(c.semilla))).toBe(true);
    expect((await dia(A, hoy)).dia.clientes).toEqual(r.dia.clientes);
  });

  it('llevarle a un cliente lo que pidió: una vez, con una receta válida; las estrellas, de lo acertado', async () => {
    const [c1, c2] = (await dia(A, hoy)).dia.clientes;
    const pide1 = recetaPide(c1);
    expect(await rejects(servir(A, hoy, 4, pide1, true))).toMatch(/cafe:cliente/);
    expect(await rejects(servir(A, hoy, 101, pide1, true))).toMatch(/cafe:cliente/);
    expect(await rejects(servir(A, hoy, 1, ['chocolate', 'suave', 'sin', 'nada'], true))).toMatch(/cafe:receta/);
    expect(await rejects(servir(A, hoy, 1, ['cafe', 'suave', 'sin'], true))).toMatch(/cafe:receta/);
    expect(await rejects(servir(A, hoy, 1, null, true))).toMatch(/cafe:receta/);
    // Todo bien y el libro encaja: 3 estrellas
    const r = await servir(A, hoy, 1, pide1, true);
    expect(r.dado).toMatchObject({ granos: 5, reputacion: 14, estrellas: 3, aciertos: 4, pide: pide1, frase: null, dorada: false });
    expect(r.cafe).toMatchObject({ granos: 5, reputacion: 14 });
    expect(r.dia.clientes[0]).toMatchObject({ n: 1, servido: true, encaja: true, estrellas: 3 });
    expect(await rejects(servir(A, hoy, 1, pide1, true))).toMatch(/cafe:servido/);
    // Nada acertado y sin libro: 1 estrella, que paga menos pero nunca cero
    const r2 = await servir(A, hoy, 2, alReves(recetaPide(c2)), null);
    expect(r2.dado).toMatchObject({ granos: 2, reputacion: 6, estrellas: 1, aciertos: 0 });
    expect(r2.cafe).toMatchObject({ granos: 7, reputacion: 20 });
    // Ayer cuenta aparte (sus clientes también esperaban): la bebida perfecta sin libro, 2 estrellas
    const [a1] = (await dia(A, ayer)).dia.clientes;
    expect((await servir(A, ayer, 1, recetaPide(a1), false)).dado).toMatchObject({ estrellas: 2, granos: 4, reputacion: 10 });
  });

  it('el excéntrico bordado paga el triple y deja su reseña dorada', async () => {
    const ex = (await dia(A, hoy)).dia.clientes[2];
    const r = await servir(A, hoy, 3, recetaPide(ex), true);
    expect(r.dado).toMatchObject({ granos: 15, reputacion: 40, estrellas: 3, frase: ex.quien, dorada: true });
    expect(r.dia.pizarra[0]).toEqual({ dia: hoy, quien: ex.quien, frase: ex.quien, dorada: true });
    // Un excéntrico a medias (ayer): paga más que un cliente, pero sin reseña dorada
    const exAyer = (await dia(A, ayer)).dia.clientes[2];
    const pide = recetaPide(exAyer);
    const r2 = await servir(A, ayer, 3, [pide[0], pide[1], pide[2], pide[3] === 'nada' ? 'miel' : 'nada'], false);
    expect(r2.dado).toMatchObject({ estrellas: 2, granos: 10, reputacion: 26, dorada: false });
    expect(r2.dia.pizarra.filter((p) => p.dorada)).toHaveLength(1);
  });

  it('los habituales: como mucho 2 al día, distintos, piden «lo de siempre» y dejan su reseña en la pizarra', async () => {
    let r = await habitual(A, hoy);
    r = await habitual(A, hoy);
    r = await habitual(A, hoy);
    expect(r.dia.habituales.map((h) => h.n)).toEqual([101, 102]);
    const [h1, h2] = r.dia.habituales;
    expect(h1.quien).not.toBe(h2.quien);
    expect(h1.quien).toBeGreaterThanOrEqual(0);
    expect(h1.quien).toBeLessThan(12);
    const s = await servir(A, hoy, 101, recetaPide(h1), false);
    expect(s.dado).toMatchObject({ granos: 5, reputacion: 12, estrellas: 2, dorada: false });
    expect(s.dado.frase).toBeGreaterThanOrEqual(0);
    expect(s.dado.frase).toBeLessThan(12);
    expect(s.dia.pizarra[0]).toEqual({ dia: hoy, quien: h1.quien, frase: s.dado.frase, dorada: false });
    expect(await rejects(servir(A, hoy, 103, recetaPide(h1), false))).toMatch(/cafe:cliente/);
  });

  it('las tablas no se leen ni se tocan; las funciones internas, tampoco', async () => {
    for (const t of ['cafe_dias', 'cafe_servicios', 'cafe_resenas']) expect(await rejects(as(db, A, (q) => q(`select * from ${t}`)))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('update cafe_dias set habituales = 9')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q("select cafe_dia_json($1, '2026-01-01'::date)", [A])))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q("select cafe_premio('excentrico', 3)")))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q("select cafe_pide($1, '2026-01-01'::date, 1)", [A])))).toMatch(/permission denied/);
    expect(await rejects(as(db, null, (q) => q('select cafe_dia(current_date)')))).toMatch(/permission denied/);
    // B no ve nada de A: su día empieza de cero cuando inaugura
    await call(B, 'select cafe_inaugurar($1)', ['El Farolillo']);
    const rb = await dia(B, hoy);
    expect(rb.cafe).toMatchObject({ granos: 0, reputacion: 0 });
    expect(rb.dia.pizarra).toEqual([]);
  });
});
