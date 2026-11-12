// 1.120 · El café-librería del bajo, bloque 2, en un Postgres real (PGlite) con todas las migraciones: el local se crea
// en traspaso, se inaugura una vez con un nombre de la lista cerrada y los muebles del rincón, el plano se comprueba en el
// servidor (dentro de la cuadrícula, sin solapes, solo lo que tienes), una copia de casa no está en el piso y en el café a
// la vez, los granos no bajan de cero, y las tablas no se leen ni se tocan directamente. Las listas son las de la app.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { CAFE_MUEBLES, CAFE_NOMBRES, PLANO_INICIAL, cuenta } from '../cafe/cafeCatalogo';
import { starterRoom } from '../demo';
import { addItem } from '../room';

let db;
let A, B, H;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const mio = (u) => call(u, 'select cafe_mio()');
const inaugurar = (u, nombre) => call(u, 'select cafe_inaugurar($1)', [nombre]);
const guardar = (u, plano) => call(u, 'select cafe_guardar($1::jsonb)', [JSON.stringify(plano)]);
const comprar = (u, id) => call(u, 'select cafe_comprar($1)', [id]);
const conItems = (items) => ({ v: 1, items });

beforeAll(async () => {
  db = await createDatabase();
  [A, B, H] = await createUsers(db, 3);
  for (const [i, u] of [A, B, H].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', $2)", [`Lectora ${i}`, u !== H]));
    if (u !== H) await as(db, u, (q) => q('select asignar_edificio()'));
  }
  // A tiene el piso de inicio y tantas sillas de casa como tiene puestas (ninguna libre)
  await as(db, A, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(starterRoom())]));
  await as(db, A, (q) => q('select piso_mi_inventario()'));
  const sillas = cuenta(starterRoom())['lampara-pie'] ?? 0;
  await db.query("insert into piso_inventario (user_id, mueble, copias) values ($1, 'lampara-pie', $2) on conflict (user_id, mueble) do update set copias = excluded.copias", [A, sillas]);
}, 60000);

describe('el café-librería del bajo: el local y Decorar', () => {
  it('las listas del servidor son las de la app', async () => {
    const filas = (await db.query('select id, w, d, precio, nivel, hito from cafe_catalogo order by id')).rows;
    expect(filas).toEqual(CAFE_MUEBLES.map(({ id, w, d, precio, nivel, hito = 0 }) => ({ id, w, d, precio, nivel, hito })).sort((a, b) => a.id.localeCompare(b.id)));
    expect((await db.query('select cafe_nombres() as n')).rows[0].n).toEqual(CAFE_NOMBRES);
    expect((await db.query('select cafe_plano_inicial() as p')).rows[0].p).toEqual(PLANO_INICIAL);
    expect((await db.query('select cafe_plano_valido(cafe_plano_inicial()) as ok')).rows[0].ok).toBe(true);
  });

  it('el local nace en traspaso; sin comunidad no hay café; las tablas no se tocan directamente', async () => {
    const c = await mio(A);
    expect(c).toMatchObject({ inaugurado: false, nivel: 1, reputacion: 0, granos: 0, nombre: null, plano: { v: 1, items: [] }, inventario: {} });
    expect(await rejects(mio(H))).toMatch(/comunidad/i);
    for (const t of ['cafe_locales', 'cafe_inventario', 'cafe_catalogo']) expect(await rejects(as(db, A, (q) => q(`select * from ${t}`)))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('update cafe_locales set granos = 999')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q("insert into cafe_inventario (user_id, mueble, copias) values ($1, 'cafe-mesa', 9)", [A])))).toMatch(/permission denied/);
    expect(await rejects(as(db, null, (q) => q('select cafe_mio()')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q("select cafe_falta_de_casa($1, '{}'::jsonb, '{}'::jsonb)", [A])))).toMatch(/permission denied/);
  });

  it('se inaugura una vez, con un nombre de la lista, y llegan los muebles del rincón colocados', async () => {
    expect(await rejects(inaugurar(A, 'Mi café'))).toMatch(/cafe:nombre/);
    expect(await rejects(inaugurar(A, null))).toMatch(/cafe:nombre/);
    expect(await rejects(guardar(A, PLANO_INICIAL))).toMatch(/cafe:cerrado/);
    const c = await inaugurar(A, 'Taza y Lomo');
    expect(c).toMatchObject({ inaugurado: true, nombre: 'Taza y Lomo', plano: PLANO_INICIAL, granos: 0 });
    expect(c.inventario).toEqual(cuenta(PLANO_INICIAL));
    expect(await rejects(inaugurar(A, 'El Farolillo'))).toMatch(/cafe:ya/);
    expect((await mio(A)).nombre).toBe('Taza y Lomo');
  });

  it('el plano: dentro de la cuadrícula, sin solapes, girado a cuartos y solo lo que tienes', async () => {
    const base = PLANO_INICIAL.items;
    // Mover una mesa y girar la estantería: vale
    const movido = conItems(base.map((i) => (i.uid === 'i5' ? { ...i, x: 4, y: 4 } : i.uid === 'i1' ? { ...i, x: 1, y: 0, rot: 1 } : i)));
    // (la estantería girada ocupa (1,0) y (1,1); la mesa i2 está en (1,2): no se pisan)
    expect((await guardar(A, movido)).plano).toEqual(movido);
    // Fuera, encima de otra cosa, girada a medias, repetida o más de 24 cosas: no
    const casos = [
      conItems([{ uid: 'a', id: 'cafe-estanteria', x: 5, y: 0, rot: 0 }]),
      conItems([{ uid: 'a', id: 'cafe-mesa', x: 0, y: 6, rot: 0 }]),
      conItems([{ uid: 'a', id: 'cafe-mesa', x: -1, y: 0, rot: 0 }]),
      conItems([
        { uid: 'a', id: 'cafe-mesa', x: 1, y: 1, rot: 0 },
        { uid: 'b', id: 'cafe-silla', x: 1, y: 1, rot: 0 },
      ]),
      conItems([{ uid: 'a', id: 'cafe-mesa', x: 1, y: 1, rot: 0.5 }]),
      conItems([
        { uid: 'a', id: 'cafe-mesa', x: 1, y: 1, rot: 0 },
        { uid: 'a', id: 'cafe-silla', x: 2, y: 1, rot: 0 },
      ]),
      conItems([{ uid: 'a', id: 'nada', x: 1, y: 1, rot: 0 }]),
      conItems(Array.from({ length: 25 }, (_, k) => ({ uid: `u${k}`, id: 'cafe-silla', x: k % 6, y: Math.floor(k / 6) % 6, rot: 0 }))),
      { v: 1, items: 'no' },
    ];
    for (const p of casos) expect(await rejects(guardar(A, p))).toMatch(/cafe:plano/);
    // Cinco sillas con cuatro: no
    const cinco = conItems([...base, { uid: 'z', id: 'cafe-silla', x: 5, y: 5, rot: 0 }]);
    expect(await rejects(guardar(A, cinco))).toMatch(/cafe:copias:cafe-silla/);
    // Vaciar el local: vale (lo quitado sigue en el inventario)
    const vacio = await guardar(A, conItems([]));
    expect(vacio.plano.items).toEqual([]);
    expect(vacio.inventario).toEqual(cuenta(PLANO_INICIAL));
  });

  it('los muebles de casa: solo los que pueden ir, y cada copia en un solo sitio', async () => {
    // Las lámparas de pie de casa están en el piso y no hay otra libre
    const conSilla = conItems([{ uid: 's', id: 'lampara-pie', x: 0, y: 0, rot: 0 }]);
    expect(await rejects(guardar(A, conSilla))).toMatch(/cafe:copias:lampara-pie/);
    // Con otra copia, sí
    await db.query("update piso_inventario set copias = copias + 1 where user_id = $1 and mueble = 'lampara-pie'", [A]);
    expect((await guardar(A, conSilla)).plano.items).toHaveLength(1);
    // Y entonces el piso ya no puede poner otra más: la copia está en el café
    const { rows } = await db.query('select layout from pisos where user_id = $1', [A]);
    const otra = addItem(rows[0].layout, 'lampara-pie').room;
    expect(await rejects(as(db, A, (q) => q('update pisos set layout = $1::jsonb where user_id = $2', [JSON.stringify(otra), A])))).toMatch(/copias suficientes/);
    // Esenciales, místicos y lo de pared no van al café
    for (const id of ['sillon', 'estanteria', 'ventana', 'cuadro']) expect(await rejects(guardar(A, conItems([{ uid: 'x', id, x: 0, y: 0, rot: 0 }])))).toMatch(/cafe:plano/);
    const mistico = (await db.query("select id from piso_catalogo where rareza in ('mistico', 'legendario') limit 1")).rows[0]?.id;
    if (mistico) expect(await rejects(guardar(A, conItems([{ uid: 'x', id: mistico, x: 0, y: 0, rot: 0 }])))).toMatch(/cafe:plano/);
  });

  it('comprar con granos: nunca por debajo de cero, con el precio del servidor', async () => {
    expect(await rejects(comprar(B, 'cafe-mesa'))).toMatch(/cafe:cerrado/);
    expect(await rejects(comprar(A, 'cafe-mesa'))).toMatch(/cafe:granos/);
    await db.query('update cafe_locales set granos = 100 where user_id = $1', [A]);
    const c = await comprar(A, 'cafe-mesa');
    expect(c.granos).toBe(60);
    expect(c.inventario['cafe-mesa']).toBe(3);
    expect(await rejects(comprar(A, 'cafe-estanteria'))).toMatch(/cafe:granos/);
    expect(await rejects(comprar(A, 'silla'))).toMatch(/cafe:mueble/);
    expect((await mio(A)).granos).toBe(60);
  });

  it('el café de otra cuenta no se ve ni se toca', async () => {
    const b = await mio(B);
    expect(b.inaugurado).toBe(false);
    expect(b.plano.items).toEqual([]);
    expect(await rejects(guardar(B, PLANO_INICIAL))).toMatch(/cafe:cerrado/);
    expect((await mio(A)).nombre).toBe('Taza y Lomo');
  });
});
