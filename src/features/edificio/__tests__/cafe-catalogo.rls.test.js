// 1.139 · El café-librería del bajo: de dónde salen los libros (`20261222120000_cafe_catalogo.sql`), en un Postgres real (PGlite)
// con todas las migraciones. El catálogo del café es el mismo en la app y en el servidor (80 libros, 8 por género); quien no ha
// leído nada recibe igual la bienvenida y puede comprar cajas; tus leídos, que manda la app, nunca se hacen pasar por el
// catálogo; el ejemplar del catálogo paga 4 y el tuyo 6; y nadie toca las tablas ni las funciones internas a mano.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { BIENVENIDA, CAJA_GENERO, CAJA_TITULO, GENEROS, librosDeLaBalda, premio, recetaPide, titulosDistribuidora } from '../cafe/cafeClientes';
import { CATALOGO_LIBROS, delCatalogo, libroDelCatalogo } from '../cafe/cafeCatalogoLibros';
import { EXTRA_LIBRO, EXTRA_LIBRO_TUYO, extraLibro } from '../cafe/cafeLibreria';

let db;
let A, B;
let hoy;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const granos = async (u) => (await db.query('select granos from cafe_locales where user_id = $1', [u])).rows[0].granos;
const abrir = async (u) => {
  await call(u, 'select cafe_mio()');
  await call(u, 'select cafe_inaugurar($1)', ['Taza y Lomo']);
};

beforeAll(async () => {
  db = await createDatabase();
  [A, B] = await createUsers(db, 2);
  for (const [i, u] of [A, B].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lectora ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await abrir(u);
  }
  hoy = (await db.query('select cafe_hoy()::text as h')).rows[0].h;
}, 60000);

describe('el catálogo del café, en la app', () => {
  it('80 libros reales, 8 por cada género, con claves únicas del catálogo y sus datos', () => {
    expect(CATALOGO_LIBROS).toHaveLength(80);
    for (const g of GENEROS) expect(CATALOGO_LIBROS.filter((x) => x.genero === g.id)).toHaveLength(8);
    expect(new Set(CATALOGO_LIBROS.map((x) => x.clave)).size).toBe(80);
    expect(new Set(CATALOGO_LIBROS.map((x) => x.titulo)).size).toBe(80);
    for (const x of CATALOGO_LIBROS) {
      expect(delCatalogo(x.clave)).toBe(true);
      expect(x.clave.length).toBeLessThanOrEqual(80);
      expect(x.titulo.length).toBeGreaterThan(0);
      expect(x.autor.length).toBeGreaterThan(0);
      expect(x.paginas).toBeGreaterThan(0);
      if (x.isbn) expect(x.isbn).toMatch(/^97[89][0-9]{10}$/);
      if (x.cover) expect(x.cover).toMatch(/^https:\/\/covers\.openlibrary\.org\/b\/id\/[0-9]+-M\.jpg$/);
    }
    // Como libro de la balda: con portada, páginas y autoría; los tuyos llevan el sello
    const l = libroDelCatalogo(CATALOGO_LIBROS[0].clave);
    expect(l).toMatchObject({ id: CATALOGO_LIBROS[0].clave, title: CATALOGO_LIBROS[0].titulo, pageCount: CATALOGO_LIBROS[0].paginas, catalogo: true });
    expect(libroDelCatalogo('b1')).toBeNull();
    const balda = librosDeLaBalda(
      {
        libros: [
          { clave: CATALOGO_LIBROS[0].clave, titulo: CATALOGO_LIBROS[0].titulo, genero: CATALOGO_LIBROS[0].genero, caja: 0, balda: 1 },
          { clave: 'b1', titulo: 'Mío', genero: 'novela', caja: 0, balda: 1 },
        ],
      },
      [{ id: 'b1', title: 'Mío', status: 'read' }],
    );
    expect(balda.map((b) => b.tuyo)).toEqual([false, true]);
    // La distribuidora: los tuyos primero (con su sello) y el catálogo entero
    const d = titulosDistribuidora([{ clave: 'b1', titulo: 'Mío', genero: 'novela' }]);
    expect(d).toHaveLength(81);
    expect(d[0]).toMatchObject({ clave: 'b1', tuyo: true });
    expect(d.slice(1).every((t) => !t.tuyo && delCatalogo(t.clave))).toBe(true);
    expect([extraLibro(CATALOGO_LIBROS[0].clave), extraLibro('b1'), EXTRA_LIBRO, EXTRA_LIBRO_TUYO]).toEqual([4, 6, 4, 6]);
  });
});

describe('el café-librería del bajo, 1.139: de dónde salen los libros', () => {
  it('el catálogo del servidor es el de la app, libro a libro', async () => {
    const filas = (await db.query('select clave, titulo, genero from cafe_catalogo() order by clave')).rows;
    const app = CATALOGO_LIBROS.map(({ clave, titulo, genero }) => ({ clave, titulo, genero })).sort((a, b) => (a.clave < b.clave ? -1 : 1));
    expect(filas).toEqual(app);
  });

  it('sin haber leído nada: la bienvenida llega igual, del catálogo, y se compran cajas de género o de un título', async () => {
    const b = await call(A, 'select cafe_bienvenida($1::jsonb)', ['[]']);
    expect(b.caja).toHaveLength(BIENVENIDA);
    expect(b.caja.every(delCatalogo)).toBe(true);
    expect(new Set(b.caja.map((k) => CATALOGO_LIBROS.find((x) => x.clave === k).genero)).size).toBe(BIENVENIDA);
    await db.query('update cafe_locales set granos = 30 where user_id = $1', [A]);
    const g = await call(A, 'select cafe_comprar_caja($1, null, $2::jsonb)', ['poesia', '[]']);
    expect(g.caja).toHaveLength(CAJA_GENERO.ejemplares);
    expect(g.caja.every((k) => CATALOGO_LIBROS.find((x) => x.clave === k)?.genero === 'poesia')).toBe(true);
    const clave = CATALOGO_LIBROS.find((x) => x.genero === 'juvenil').clave;
    const t = await call(A, 'select cafe_comprar_caja(null, $1, $2::jsonb)', [clave, '[]']);
    expect(t.caja).toEqual(Array(CAJA_TITULO.ejemplares).fill(clave));
    expect(await granos(A)).toBe(30 - CAJA_GENERO.precio - CAJA_TITULO.precio);
  });

  it('tus leídos: la app los manda (hasta 200) y nunca pasan por el catálogo', async () => {
    const tuyos = [
      { clave: 'b1', titulo: 'El nombre del viento', genero: 'fantasia' },
      { clave: 'b2', titulo: 'Mistborn', genero: 'fantasia' },
      { clave: 'cat:el-hobbit', titulo: 'Mi Hobbit', genero: 'amor' },
    ];
    expect(await call(B, 'select cafe_mis_titulos($1::jsonb)', [JSON.stringify(tuyos)])).toBe(2);
    expect((await db.query('select clave from cafe_tuyos where user_id = $1 order by clave', [B])).rows.map((r) => r.clave)).toEqual(['b1', 'b2']);
    // Volver a mandarlos sustituye la lista
    expect(await call(B, 'select cafe_mis_titulos($1::jsonb)', [JSON.stringify(tuyos.slice(0, 1))])).toBe(1);
    expect(await rejects(call(B, 'select cafe_mis_titulos($1::jsonb)', [JSON.stringify([{ clave: 'x', titulo: 'X', genero: 'cocina' }])]))).toMatch(/cafe:titulos/);
    // Una clave del catálogo con otro título o género no cuela en una compra: vale la del catálogo
    await db.query('update cafe_locales set granos = 9 where user_id = $1', [B]);
    const t = await call(B, 'select cafe_comprar_caja(null, $1, $2::jsonb)', ['cat:el-hobbit', JSON.stringify(tuyos)]);
    const fila = t.libros.libros.find((x) => x.clave === 'cat:el-hobbit');
    expect(fila).toMatchObject({ titulo: CATALOGO_LIBROS.find((x) => x.clave === 'cat:el-hobbit').titulo, genero: 'fantasia' });
  });

  it('el ejemplar que se lleva el cliente: +4 si es del catálogo, +6 si es uno de tus leídos', async () => {
    const cat = CATALOGO_LIBROS.find((x) => x.genero === 'misterio');
    await db.query('delete from cafe_libros where user_id = $1', [B]);
    await db.query("insert into cafe_libros (user_id, clave, titulo, genero, caja, balda) values ($1, $2, $3, 'misterio', 0, 2), ($1, 'b1', 'El nombre del viento', 'fantasia', 0, 2)", [
      B,
      cat.clave,
      cat.titulo,
    ]);
    const r0 = await call(B, 'select cafe_dia($1::date)', [hoy]);
    const [c1, c2] = r0.dia.clientes;
    const entregar = (n, receta, libro) => call(B, 'select cafe_entregar($1::date, $2, $3::text[], $4, $5::boolean[])', [hoy, n, receta, libro, [true, true, true]]);
    const r1 = await entregar(1, recetaPide(c1), cat.clave);
    expect(r1.dado).toMatchObject({ estrellas: 3, llevado: true, extra: EXTRA_LIBRO, granos: premio('cliente', 3).granos + EXTRA_LIBRO });
    const r2 = await entregar(2, recetaPide(c2), 'b1');
    expect(r2.dado).toMatchObject({ estrellas: 3, llevado: true, extra: EXTRA_LIBRO_TUYO, granos: premio('cliente', 3).granos + EXTRA_LIBRO_TUYO });
  });

  it('el anónimo no manda títulos; nadie lee tus leídos ni llama a las funciones internas', async () => {
    expect(await rejects(as(db, null, (q) => q("select cafe_mis_titulos('[]'::jsonb)")))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select * from cafe_tuyos')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q("insert into cafe_tuyos (user_id, clave, titulo, genero) values ($1, 'x', 'X', 'novela')", [A])))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select * from cafe_catalogo()')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q("select * from cafe_titulos_y_catalogo('[]'::jsonb)")))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select cafe_reparto_cupo(1)')))).toMatch(/permission denied/);
  });
});
