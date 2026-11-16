// 1.132 · El café-librería del bajo: el influencer de cada nivel, en un Postgres real (PGlite) con todas las migraciones.
// Las recetas y las cifras son las de la app; con la barra llena el nivel no sube (la reputación de más espera aparte, sin
// perderse) y llega el influencer de esa subida; el nivel sube al despedirle, salga como salga; el reloj de arena lo mide el
// servidor (con su margen); a tiempo y con 3 estrellas, viral: el siguiente día, 3 clientes más y su foto en la pared. Como
// mucho uno al día; las cuentas que ya habían subido los reciben sin frenar nada. La pizarra ya no va en el día, pero las
// reseñas se siguen guardando. El anónimo no puede nada y nadie toca la tabla a mano.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { premio, recetaPide, recetaValida } from '../cafe/cafeClientes';
import { cartaDe, desdeNivel } from '../cafe/cafeNiveles';
import { ARENA_MARGEN, ARENA_SEGUNDOS, INFLUENCERS, NIVELES_INFLUENCER, VIRALES } from '../cafe/cafeInfluencers';
// 1.139: b1 es uno de tus leídos (no del catálogo): paga 6
import { EXTRA_LIBRO_TUYO as EXTRA_LIBRO } from '../cafe/cafeLibreria';

let db;
let A, B, C, D;
let hoy, ayer;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const dia = (u, d) => call(u, 'select cafe_dia($1::date)', [d]);
const entregar = (u, d, cliente, receta, libro = null, ok = null) => call(u, 'select cafe_entregar($1::date, $2, $3::text[], $4, $5::boolean[])', [d, cliente, receta, libro, ok]);
const empezar = (u, d, nivel) => call(u, 'select cafe_influencer_empezar($1::date, $2)', [d, nivel]);
const despedir = (u, d, nivel, receta, libro = null, ok = null) => call(u, 'select cafe_influencer_entregar($1::date, $2, $3::text[], $4, $5::boolean[])', [d, nivel, receta, libro, ok]);
const local = async (u) => (await db.query('select nivel, reputacion, reputacion_espera as espera, granos from cafe_locales where user_id = $1', [u])).rows[0];
const ponLocal = (u, nivel, reputacion, espera = 0) => db.query('update cafe_locales set nivel = $2, reputacion = $3, reputacion_espera = $4 where user_id = $1', [u, nivel, reputacion, espera]);
const TITULOS = [
  { clave: 'b1', titulo: 'El nombre del viento', genero: 'fantasia' },
  { clave: 'b2', titulo: 'Diez negritos', genero: 'misterio' },
];
const abrir = async (u) => {
  await call(u, 'select cafe_mio()');
  await call(u, 'select cafe_inaugurar($1)', ['Taza y Lomo']);
  await call(u, 'select cafe_bienvenida($1::jsonb)', [JSON.stringify(TITULOS)]);
  // 1.139: la bienvenida mezcla el catálogo al azar; para estas pruebas, la balda de antes (cuatro de cada uno de tus títulos)
  await db.query('delete from cafe_libros where user_id = $1', [u]);
  for (const t of TITULOS) await db.query('insert into cafe_libros (user_id, clave, titulo, genero, caja, balda) values ($1, $2, $3, $4, 0, 4)', [u, t.clave, t.titulo, t.genero]);
};
const PIDE = (n) => INFLUENCERS[n].pide;

beforeAll(async () => {
  db = await createDatabase();
  [A, B, C, D] = await createUsers(db, 4);
  for (const [i, u] of [A, B, C, D].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lectora ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await abrir(u);
  }
  const f = (await db.query('select cafe_hoy()::text as h, (cafe_hoy() - 1)::text as a')).rows[0];
  [hoy, ayer] = [f.h, f.a];
}, 60000);

describe('el café-librería del bajo, 1.132: el influencer de cada nivel', () => {
  it('las recetas y el reloj son los de la app, y cada receta ya está en la carta con la barra anterior llena', async () => {
    expect(NIVELES_INFLUENCER).toEqual([2, 3, 4, 5, 6, 7, 8]);
    for (const n of NIVELES_INFLUENCER) {
      expect((await db.query('select cafe_influencer_pide($1) p', [n])).rows[0].p).toEqual(PIDE(n));
      expect(recetaValida(PIDE(n), cartaDe(desdeNivel(n) - 1))).toBe(true);
    }
    expect((await db.query('select cafe_arena_segundos() s, cafe_arena_margen() m', [])).rows[0]).toEqual({ s: ARENA_SEGUNDOS, m: ARENA_MARGEN });
    expect([ARENA_SEGUNDOS, ARENA_MARGEN, VIRALES]).toEqual([150, 10, 3]);
  });

  it('con la barra llena el nivel no sube: lo de más espera, sin perderse, y llega el influencer de la subida', async () => {
    await dia(A, ayer);
    await ponLocal(A, 1, 290);
    const c = (await dia(A, ayer)).dia.clientes;
    const r = await entregar(A, ayer, 1, recetaPide(c[0], []), 'b1', [true, true, true]);
    expect(r.progreso).toMatchObject({ de: 1, a: 1 });
    expect(r.progreso.niveles.filter((x) => x.nivel > 1)).toEqual([]);
    expect(await local(A)).toMatchObject({ nivel: 1, reputacion: 299, espera: 290 + premio('cliente', 3).reputacion - 299 });
    expect(r.cafe).toMatchObject({ nivel: 1, reputacion: 299, espera: 290 + premio('cliente', 3).reputacion - 299, fotos: [] });
    expect(r.dia.influencer).toEqual({ nivel: 2, servido: false, sube: true });
    // La pizarra ya no viene con el día
    expect(r.dia).not.toHaveProperty('pizarra');
    // Otro servicio: la reputación sigue en 299 y lo de más se suma a lo que espera
    const r2 = await entregar(A, ayer, 2, recetaPide(c[1], []));
    expect(r2.cafe.reputacion).toBe(299);
    expect(r2.cafe.espera).toBe(r.cafe.espera + r2.dado.reputacion);
  });

  it('sin ir a la barra, o con otro nivel, no se le puede atender; a tiempo y con 3 estrellas, viral, y el café sube', async () => {
    expect(await rejects(despedir(A, ayer, 2, PIDE(2)))).toMatch(/cafe:influencer/);
    expect(await rejects(empezar(A, ayer, 3))).toMatch(/cafe:influencer/);
    expect(await empezar(A, ayer, 2)).toEqual({ nivel: 2, segundos: ARENA_SEGUNDOS });
    const antes = await local(A);
    // Una receta que no va con su carta, fuera (el chocolate aún no está en el nivel 1)
    expect(await rejects(despedir(A, ayer, 2, ['chocolate', 'suave', 'sin', 'nada']))).toMatch(/cafe:receta/);
    const r = await despedir(A, ayer, 2, PIDE(2), 'b1', [true, true, true]);
    const p = premio('excentrico', 3);
    expect(r.dado).toMatchObject({ estrellas: 3, aciertos: 4, libro_aciertos: 3, llevado: true, granos: p.granos + EXTRA_LIBRO, reputacion: p.reputacion });
    expect(r.dado.influencer).toMatchObject({ nivel: 2, a_tiempo: true, viral: true, sube: true });
    expect(r.dado.influencer.segundos).toBeLessThanOrEqual(ARENA_SEGUNDOS);
    expect(r.progreso).toMatchObject({ de: 1, a: 2, niveles: [{ nivel: 2, tickets: 20 }] });
    // Lo que esperaba entra entero
    expect(await local(A)).toMatchObject({ nivel: 2, reputacion: antes.reputacion + antes.espera + p.reputacion, espera: 0 });
    expect(r.cafe.fotos).toEqual([2]);
    expect(r.dia.influencer).toEqual({ nivel: 2, servido: true, sube: false, estrellas: 3, a_tiempo: true, viral: true });
    expect(await rejects(despedir(A, ayer, 2, PIDE(2)))).toMatch(/cafe:influencer/);
    expect(await rejects(empezar(A, ayer, 2))).toMatch(/cafe:influencer/);
    const fila = (await db.query('select cliente, estrellas from cafe_servicios where user_id = $1 and dia = $2 and cliente > 300', [A, ayer])).rows;
    expect(fila).toEqual([{ cliente: 302, estrellas: 3 }]);
  });

  it('el siguiente día que abres, 3 clientes más por su vídeo, que pagan como un cliente (una sola vez)', async () => {
    const r = await dia(A, hoy);
    expect(r.dia.virales.map((v) => v.n)).toEqual([201, 202, 203]);
    expect(r.dia.virales_de).toBe(2);
    const v = r.dia.virales[0];
    const s = await entregar(A, hoy, 201, recetaPide(v, r.dia.carta));
    expect(s.dado).toMatchObject({ estrellas: 2, aciertos: 4, granos: premio('cliente', 2).granos, reputacion: premio('cliente', 2).reputacion });
    expect(s.dia.virales[0]).toMatchObject({ n: 201, servido: true, estrellas: 2 });
    expect(await rejects(entregar(A, hoy, 204, recetaPide(v, r.dia.carta)))).toMatch(/cafe:cliente/);
    expect((await db.query('select viral_dia::text as d from cafe_influencers where user_id = $1 and nivel = 2', [A])).rows[0].d).toBe(hoy);
    // Hoy no hay otro influencer (la barra del 2 no está llena)
    expect(r.dia.influencer).toBeNull();
  });

  it('con la arena acabada no pasa nada malo: paga como un cliente normal, el café sube igual y no hay viral', async () => {
    await dia(B, ayer);
    await ponLocal(B, 1, 299, 30);
    expect((await dia(B, ayer)).dia.influencer).toEqual({ nivel: 2, servido: false, sube: true });
    await empezar(B, ayer, 2);
    await db.query("update cafe_influencers set empezado = now() - interval '200 seconds' where user_id = $1 and nivel = 2", [B]);
    const r = await despedir(B, ayer, 2, PIDE(2), 'b1', [true, true, true]);
    expect(r.dado.influencer).toMatchObject({ a_tiempo: false, viral: false, sube: true });
    expect(r.dado.influencer.segundos).toBeGreaterThanOrEqual(200);
    expect(r.dado).toMatchObject({ estrellas: 3, granos: premio('cliente', 3).granos + EXTRA_LIBRO, reputacion: premio('cliente', 3).reputacion });
    expect(r.progreso).toMatchObject({ de: 1, a: 2 });
    expect(r.cafe.fotos).toEqual([]);
    expect((await db.query('select a_tiempo, viral, dia::text as d from cafe_influencers where user_id = $1 and nivel = 2', [B])).rows[0]).toEqual({ a_tiempo: false, viral: false, d: ayer });
    // Sin vídeo viral, mañana no hay clientes de más
    expect((await dia(B, hoy)).dia.virales).toEqual([]);
  });

  it('volver a la barra da la vuelta al reloj (sin castigo) y el margen cuenta como a tiempo', async () => {
    await dia(D, hoy);
    await ponLocal(D, 1, 299, 1);
    await empezar(D, hoy, 2);
    await db.query("update cafe_influencers set empezado = now() - interval '400 seconds' where user_id = $1 and nivel = 2", [D]);
    await empezar(D, hoy, 2);
    await db.query('update cafe_influencers set empezado = now() - make_interval(secs => $2) where user_id = $1 and nivel = 2', [D, ARENA_SEGUNDOS + ARENA_MARGEN - 3]);
    const r = await despedir(D, hoy, 2, PIDE(2));
    // Solo el café: 4 aciertos son 2 estrellas, a tiempo pero sin viral
    expect(r.dado).toMatchObject({ estrellas: 2 });
    expect(r.dado.influencer).toMatchObject({ a_tiempo: true, viral: false });
  });

  it('como mucho uno al día: con lo que esperaba se llena la barra siguiente y su influencer viene otro día', async () => {
    await dia(C, ayer);
    await ponLocal(C, 1, 299, 2000);
    await empezar(C, ayer, 2);
    const r = await despedir(C, ayer, 2, PIDE(2));
    expect(r.progreso).toMatchObject({ de: 1, a: 2 });
    // Hasta 999 (el techo del 3) y el resto, esperando
    expect(await local(C)).toMatchObject({ nivel: 2, reputacion: desdeNivel(3) - 1, espera: 299 + 2000 + r.dado.reputacion - (desdeNivel(3) - 1) });
    expect(r.dia.influencer).toMatchObject({ nivel: 2, servido: true });
    const h = await dia(C, hoy);
    expect(h.dia.influencer).toEqual({ nivel: 3, servido: false, sube: true });
  });

  it('las cuentas que ya habían subido reciben a los suyos, del más antiguo al más nuevo, sin frenar nada', async () => {
    const [E] = await createUsers(db, 1);
    await as(db, E, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ('Lectora E', 'gato-lector', true)"));
    await as(db, E, (q) => q('select asignar_edificio()'));
    await abrir(E);
    await dia(E, ayer);
    await ponLocal(E, 4, 3000);
    const d0 = await dia(E, ayer);
    expect(d0.dia.influencer).toEqual({ nivel: 2, servido: false, sube: false });
    // Servir no frena nada por debajo del techo del 5
    const c = d0.dia.clientes;
    const s = await entregar(E, ayer, 1, recetaPide(c[0], d0.dia.carta));
    expect(s.cafe).toMatchObject({ nivel: 4, reputacion: 3000 + s.dado.reputacion, espera: 0 });
    await empezar(E, ayer, 2);
    const r = await despedir(E, ayer, 2, PIDE(2));
    expect(r.progreso).toMatchObject({ de: 4, a: 4 });
    expect(r.dado.influencer).toMatchObject({ nivel: 2, sube: false });
    // Al día siguiente, el del 3; y con la barra del 4 llena, el de la subida va primero
    expect((await dia(E, hoy)).dia.influencer).toEqual({ nivel: 3, servido: false, sube: false });
    await ponLocal(E, 4, 4990);
    const h = await dia(E, hoy);
    const s2 = await entregar(E, hoy, 1, recetaPide(h.dia.clientes[0], h.dia.carta), 'b2', [true, true, true]);
    expect(s2.cafe).toMatchObject({ nivel: 4, reputacion: desdeNivel(5) - 1 });
    expect(s2.dia.influencer).toEqual({ nivel: 5, servido: false, sube: true });
  });

  it('las reseñas se siguen guardando aunque la pizarra ya no esté', async () => {
    const r0 = await call(A, 'select cafe_habitual($1::date)', [hoy]);
    const h = r0.dia.habituales[0];
    const r = await entregar(A, hoy, h.n, recetaPide(h));
    expect(r.dado.frase).not.toBeNull();
    expect((await db.query('select count(*)::int n from cafe_resenas where user_id = $1 and dia = $2 and not excentrico', [A, hoy])).rows[0].n).toBe(1);
  });

  it('el anónimo no puede nada y nadie lee ni toca la tabla a mano', async () => {
    expect(await rejects(as(db, null, (q) => q('select cafe_influencer_empezar($1::date, 2)', [hoy])))).toMatch(/permission denied/);
    expect(await rejects(as(db, null, (q) => q('select cafe_influencer_entregar($1::date, 2, $2::text[])', [hoy, PIDE(2)])))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select * from cafe_influencers')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q("update cafe_influencers set viral = true")))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select cafe_techo($1)', [A])))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select cafe_apartar($1)', [A])))).toMatch(/permission denied/);
  });
});
