// 1.99 · El Almacén del Puerto en un Postgres real (PGlite) con todas las migraciones: la compra del carrito es una sola
// operación (precios del servidor, saldo, descuento, entrega y gasto del descuento, todo o nada), una clave de compra
// repetida no cobra dos veces, el albarán es uno al día y se sella a su tiempo, y la visita con un amigo solo enseña dónde
// está cada uno (nunca tickets ni carrito).
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';

let db;
let A, B, C;
let antes = 0;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const estado = (u) => call(u, 'select piso_almacen_estado()');
const comprar = (u, clave, articulos, esperado, usar = false) => call(u, 'select piso_almacen_comprar($1::uuid, $2::jsonb, $3, $4)', [clave, JSON.stringify(articulos), esperado, usar]);
const empezar = (u, modo) => call(u, 'select piso_almacen_empezar($1)', [modo]);
const sellar = (u, plano, acierto) => call(u, 'select piso_almacen_sellar($1, $2)', [plano, acierto]);
const tickets = (u) => db.query('select tickets from piso_cuentas where user_id = $1', [u]).then((r) => r.rows[0].tickets);
const copias = (u, m) => db.query('select copias from piso_inventario where user_id = $1 and mueble = $2', [u, m]).then((r) => r.rows[0]?.copias ?? 0);
const atrasar = (u, ms) => db.query("update piso_almacen_dia set empezado_en = now() - ($2 || ' milliseconds')::interval where user_id = $1", [u, String(ms)]);
const seguir = (a, b) => db.query('insert into follows (follower, followed) values ($1, $2)', [a, b]);
const K = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// Las ofertas de hoy cambian cada día: aquí, sin ofertas salvo en su bloque (que las pone a mano o mira un día fijo)
const sinOfertas = () => db.query("create or replace function public.piso_almacen_ofertas() returns jsonb language sql stable set search_path = '' as $$ select '[]'::jsonb $$");
const conOfertas = (lista) =>
  db.query(`create or replace function public.piso_almacen_ofertas() returns jsonb language sql stable set search_path = '' as $$ select '${JSON.stringify(lista)}'::jsonb $$`);

beforeAll(async () => {
  db = await createDatabase();
  await sinOfertas();
  [A, B, C] = await createUsers(db, 3);
  for (const [i, u] of [A, B, C].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Cliente ${i}`]));
    await estado(u);
  }
  await db.query('update piso_cuentas set tickets = 100 where user_id = $1', [A]);
  await seguir(A, B);
  await seguir(B, A);
  await seguir(A, C);
}, 60000);

describe('la caja del almacén', () => {
  it('el estado: día de Madrid, hora del servidor, cuándo vuelve el intento y tus tickets', async () => {
    const s = await estado(A);
    expect(s.descuento).toEqual({ estado: 'libre' });
    expect(s.tickets).toBe(100);
    expect(s.vuelve).toBeGreaterThan(s.ahora);
    expect(s.vuelve - s.ahora).toBeLessThanOrEqual(25 * 3600 * 1000);
  });

  it('compra el carrito con los precios del servidor y entrega los muebles', async () => {
    antes = await copias(A, 'sillon');
    const r = await comprar(A, K(1), [{ id: 'sillon', n: 2 }, { id: 'reloj', n: 1 }], 80);
    expect(r).toMatchObject({ repetida: false, subtotal: 80, pct: 0, descuento: 0, total: 80 });
    expect(r.inventario.copias.sillon).toBe(antes + 2);
    expect(await tickets(A)).toBe(20);
    expect(await copias(A, 'reloj')).toBe(1);
  });

  it('la misma clave (doble toque o reintento) no cobra ni entrega dos veces', async () => {
    const r = await comprar(A, K(1), [{ id: 'sillon', n: 2 }, { id: 'reloj', n: 1 }], 80);
    expect(r).toMatchObject({ repetida: true, total: 80 });
    expect(await tickets(A)).toBe(20);
    expect(await copias(A, 'sillon')).toBe(antes + 2);
    // La clave de otra persona no sirve para ver su compra
    expect(await rejects(comprar(B, K(1), [{ id: 'sillon', n: 1 }], 20))).toMatch(/almacen:clave/);
  });

  it('sin saldo, con el total cambiado o con algo que no se vende, no se cobra nada', async () => {
    expect(await rejects(comprar(A, K(2), [{ id: 'mesa', n: 2 }], 40))).toMatch(/almacen:saldo/);
    expect(await rejects(comprar(A, K(3), [{ id: 'mesa', n: 1 }], 5))).toMatch(/almacen:precio/);
    expect(await rejects(comprar(A, K(4), [{ id: 'sofa', n: 1 }], 40))).toMatch(/almacen:retirado/);
    expect(await rejects(comprar(A, K(5), [{ id: 'no-existe', n: 1 }], 20))).toMatch(/almacen:no_se_vende/);
    for (const mal of [[], [{ id: 'mesa', n: 0 }], [{ id: 'mesa', n: 11 }], [{ id: 'mesa', n: 1.5 }], [{ id: 'mesa', n: 1 }, { id: 'mesa', n: 1 }], [{ id: 'mesa' }]]) {
      expect(await rejects(comprar(A, K(6), mal, 20))).toMatch(/almacen:(vacio|linea)/);
    }
    expect(await tickets(A)).toBe(20);
    expect(await copias(A, 'mesa')).toBe(0);
    // La compra fallida no deja la clave gastada: con el carrito bien, la misma clave cobra una vez
    expect(await comprar(A, K(3), [{ id: 'mesa', n: 1 }], 20)).toMatchObject({ repetida: false, total: 20 });
    expect(await tickets(A)).toBe(0);
  });

  it('sin descuento ganado no se puede usar', async () => {
    await db.query('update piso_cuentas set tickets = 200 where user_id = $1', [A]);
    expect(await rejects(comprar(A, K(7), [{ id: 'mesa', n: 1 }], 20, true))).toMatch(/almacen:descuento/);
  });
});

describe('«Sella el albarán»', () => {
  it('el intento se gasta al empezar; empezar otra vez no lo repone', async () => {
    const s = await empezar(A, 'rapido');
    expect(s.descuento).toMatchObject({ estado: 'jugando', modo: 'rapido', marcas: [null, null, null] });
    await atrasar(A, 1700);
    const otra = await empezar(A, 'sinprisa');
    expect(otra.descuento.modo).toBe('rapido');
    expect(otra.descuento.empezado).toBeLessThan(s.descuento.empezado);
    expect(await rejects(empezar(A, 'trampa'))).toMatch(/almacen:modo/);
  });

  it('cada plano se sella una vez y a su tiempo; antes de tiempo cuenta como fallado', async () => {
    let s = await sellar(A, 0, true);
    expect(s.descuento.marcas).toEqual([true, null, null]);
    s = await sellar(A, 0, false);
    expect(s.descuento.marcas).toEqual([true, null, null]);
    s = await sellar(A, 2, true);
    expect(s.descuento.marcas).toEqual([true, null, false]);
    expect(await rejects(sellar(A, 3, true))).toMatch(/almacen:plano/);
  });

  it('acabado el tiempo, lo que falta cuenta como fallado y el porcentaje lo pone el servidor', async () => {
    await atrasar(A, 20000);
    const s = await estado(A);
    expect(s.descuento).toMatchObject({ estado: 'hecho', aciertos: 1, pct: 3 });
    // Y un sello tardío ya no acierta
    expect((await sellar(A, 1, true)).descuento.marcas).toEqual([true, false, false]);
  });

  it('el descuento va en una sola compra (redondeo a la baja) y luego queda usado hasta mañana', async () => {
    const r = await comprar(A, K(8), [{ id: 'mesa', n: 5 }], 97, true);
    expect(r).toMatchObject({ subtotal: 100, pct: 3, descuento: 3, total: 97 });
    expect(await tickets(A)).toBe(103);
    expect((await estado(A)).descuento.estado).toBe('usado');
    expect(await rejects(comprar(A, K(9), [{ id: 'mesa', n: 1 }], 20, true))).toMatch(/almacen:descuento/);
    expect(await rejects(sellar(A, 1, true))).toMatch(/almacen:sin_albaran/);
    // El reintento de la compra con descuento devuelve lo mismo, sin volver a cobrar
    expect(await comprar(A, K(8), [{ id: 'mesa', n: 5 }], 97, true)).toMatchObject({ repetida: true, total: 97 });
    expect(await tickets(A)).toBe(103);
  });

  it('el total que se enseñó tiene que ser el que se cobra', async () => {
    await empezar(B, 'sinprisa');
    await db.query("update piso_almacen_dia set marcas = '[true, true, true]'::jsonb where user_id = $1", [B]);
    await db.query('update piso_cuentas set tickets = 100 where user_id = $1', [B]);
    expect((await estado(B)).descuento).toMatchObject({ estado: 'hecho', pct: 10 });
    expect(await rejects(comprar(B, K(10), [{ id: 'mesa', n: 2 }], 40, true))).toMatch(/almacen:precio/);
    expect((await estado(B)).descuento.estado).toBe('hecho');
    expect(await comprar(B, K(10), [{ id: 'mesa', n: 2 }], 36, true)).toMatchObject({ pct: 10, total: 36 });
  });
});

describe('visitar el almacén con un amigo', () => {
  const invitar = (u, amigo) => call(u, 'select piso_almacen_invitar($1)', [amigo]);
  const amigos = (u) => call(u, 'select piso_almacen_amigos()');
  const unirse = (u, sala) => call(u, 'select piso_almacen_unirse($1)', [sala]);
  const salir = (u, sala) => as(db, u, (q) => q('select piso_almacen_salir($1)', [sala]));
  const pulso = (u, sala, p = {}) =>
    call(u, 'select piso_almacen_pulso($1, $2, $3, $4, $5, $6, $7, $8::jsonb)', [sala, p.x ?? 10, p.y ?? 12, p.yaw ?? 1, p.zona ?? 'pasillos', p.mira ?? null, p.mira_n ?? 0, p.sello ? JSON.stringify(p.sello) : null]);
  let sala;

  it('solo con amigos (os seguís los dos)', async () => {
    expect((await amigos(A)).amigos.map((x) => x.uid)).toEqual([B]);
    expect(await rejects(invitar(A, C))).toMatch(/almacen:no_amigo/);
    sala = (await invitar(A, B)).sala;
    expect((await invitar(A, B)).sala).toBe(sala);
    const b = await amigos(B);
    expect(b.invitaciones).toHaveLength(1);
    expect(b.invitaciones[0]).toMatchObject({ sala, uid: A, alias: 'Cliente 0' });
    expect((await amigos(A)).mia).toMatchObject({ sala, uid: B, estado: 'invitada' });
    expect(await rejects(unirse(C, sala))).toMatch(/almacen:sala/);
    expect(await rejects(pulso(C, sala))).toMatch(/almacen:sala/);
  });

  it('cada uno ve dónde está el otro, qué señala y su albarán; nunca sus tickets', async () => {
    expect(await pulso(B, sala)).toEqual({ estado: 'invitada', otros: [] });
    await unirse(B, sala);
    await pulso(A, sala, { x: 4.2, y: 22.4, yaw: 3.1, zona: 'caja', mira: 'sillon', mira_n: 2, sello: { modo: 'rapido', empezado: 123, marcas: [true, 'x', null, true], tickets: 99 } });
    const v = await pulso(B, sala, { x: 99, y: -5, zona: 'otra', mira: 'sofa' });
    expect(v.estado).toBe('abierta');
    expect(v.otros).toHaveLength(1);
    const a = v.otros[0];
    expect(a).toMatchObject({ uid: A, alias: 'Cliente 0', zona: 'caja', mira: 'sillon', mira_n: 2, sello: { modo: 'rapido', empezado: 123, marcas: [true, null, null] } });
    expect(a.x).toBeCloseTo(4.2);
    expect(JSON.stringify(v)).not.toMatch(/tickets/);
    const vuelta = (await pulso(A, sala)).otros[0];
    expect(vuelta).toMatchObject({ uid: B, x: 18, y: 0, zona: 'pasillos', mira: null, sello: null });
  });

  it('si el invitado se va, quien invitó sigue; si se va quien invitó, la sala se cierra', async () => {
    await salir(B, sala);
    expect((await pulso(A, sala)).otros).toEqual([]);
    await unirse(B, sala);
    await salir(A, sala);
    expect((await pulso(B, sala)).estado).toBe('cerrada');
    expect((await amigos(B)).invitaciones).toEqual([]);
  });
});

describe('las ofertas del almacén', () => {
  const ofertasDe = (dia) => db.query('select piso_almacen_ofertas_de($1::date) as o', [dia]).then((r) => r.rows[0].o);
  const semana = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'];

  it('cada día, 4 muebles con −20 % y uno de la semana con −50 %, todos de los que se venden', async () => {
    const venta = (await db.query("select id from piso_catalogo where saga is null and piso_precio(rareza) is not null and not piso_retirado(id)")).rows.map((r) => r.id);
    for (const dia of semana) {
      const o = await ofertasDe(dia);
      expect(o).toHaveLength(5);
      expect(o[0]).toMatchObject({ pct: 50, tipo: 'semana' });
      expect(o.slice(1).every((x) => x.pct === 20 && x.tipo === 'dia')).toBe(true);
      expect(new Set(o.map((x) => x.id)).size).toBe(5);
      for (const x of o) expect(venta).toContain(x.id);
    }
  });

  it('las mismas para todos y todo el día; la de la semana no cambia de lunes a domingo', async () => {
    expect(await ofertasDe('2026-11-11')).toEqual(await ofertasDe('2026-11-11'));
    const dias = await Promise.all(semana.map(ofertasDe));
    expect(new Set(dias.map((o) => o[0].id)).size).toBe(1);
    expect(new Set(dias.map((o) => JSON.stringify(o.slice(1)))).size).toBeGreaterThan(1);
    // El lunes siguiente empieza otra semana (con su propio sorteo)
    const otra = await ofertasDe('2026-11-16');
    expect(otra[0].tipo).toBe('semana');
  });

  it('el estado trae las de hoy y cuándo acaba la semana', async () => {
    await db.query("create or replace function public.piso_almacen_ofertas() returns jsonb language sql stable set search_path = '' as $$ select public.piso_almacen_ofertas_de(public.piso_almacen_hoy()) $$");
    const s = await estado(C);
    expect(s.ofertas).toEqual(await ofertasDe(s.dia));
    expect(s.semana_hasta).toBeGreaterThanOrEqual(s.vuelve);
    expect(s.semana_hasta - s.ahora).toBeLessThanOrEqual(8 * 24 * 3600 * 1000);
  });

  it('la compra cobra el precio de oferta y luego el albarán; el precio de siempre ya no cuadra', async () => {
    await conOfertas([{ id: 'reloj', pct: 50, tipo: 'semana' }, { id: 'mesa', pct: 20, tipo: 'dia' }]);
    await db.query('update piso_cuentas set tickets = 200 where user_id = $1', [C]);
    await empezar(C, 'rapido');
    await db.query("update piso_almacen_dia set marcas = '[true, true, true]'::jsonb where user_id = $1", [C]);
    await atrasar(C, 20000);
    const carro = [{ id: 'mesa', n: 2 }, { id: 'reloj', n: 1 }];
    // Sin ofertas serían 80; con ellas 32 + 20 = 52; con el −10 % del albarán, 52 − 5 = 47
    expect(await rejects(comprar(C, K(20), carro, 72, true))).toMatch(/almacen:precio/);
    const r = await comprar(C, K(20), carro, 47, true);
    expect(r).toMatchObject({ subtotal: 52, ahorro: 28, pct: 10, descuento: 5, total: 47 });
    expect(await tickets(C)).toBe(153);
    expect(await comprar(C, K(20), carro, 47, true)).toMatchObject({ repetida: true, ahorro: 28, total: 47 });
    await sinOfertas();
  });
});
