// 1.84 · La Lonja: lo ofrecido queda apartado, el cambio es de una vez y no se puede abusar de la economía; y el canje de
// sellos, que nunca da tickets (la estiba, en estiba.rls.test.js). Postgres real (PGlite) con todas las migraciones.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { CATALOG } from '../catalog';
import { starterRoom } from '../demo';

let db;
let A, B, C, D, E, F;
let COMUN, COMUN2, POCO, RARO, RARO2, SAGA, MISTICO;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const lonja = (u) => call(u, 'select piso_lonja()');
const poner = (u, doy, pido, precio, clase = null) => call(u, 'select piso_lonja_poner($1, $2, $3, $4)', [doy, pido, precio, clase]);
const retirar = (u, id) => call(u, 'select piso_lonja_retirar($1)', [id]);
const aceptar = (u, id, pago = null) => call(u, 'select piso_lonja_aceptar($1, $2)', [id, pago]);
const canjear = (u, que) => call(u, 'select piso_lonja_canjear($1)', [que]);
const copias = (u, m) => db.query('select copias from piso_inventario where user_id = $1 and mueble = $2', [u, m]).then((r) => r.rows[0]?.copias ?? 0);
const tickets = (u) => db.query('select tickets from piso_cuentas where user_id = $1', [u]).then((r) => r.rows[0].tickets);
const dar = (u, m, n) => db.query('insert into piso_inventario (user_id, mueble, copias) values ($1, $2, $3) on conflict (user_id, mueble) do update set copias = $3', [u, m, n]);
const uno = (where) => db.query(`select id from piso_catalogo where ${where} order by id limit 2`).then((r) => r.rows.map((x) => x.id));
const envejecer = (dias) => db.query(`update piso_lonja_ofertas set cerrada = cerrada - interval '${dias} days', creada = creada - interval '${dias} days'`);

beforeAll(async () => {
  db = await createDatabase();
  [A, B, C, D, E, F] = await createUsers(db, 6);
  for (const [i, u] of [A, B, C, D, E, F].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lector ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await as(db, u, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify({ ...starterRoom(), items: [] })]));
    await lonja(u);
  }
  await db.query("update profiles set created_at = now() - interval '30 days'");
  [COMUN, COMUN2] = await uno("rareza = 'comun' and saga is null");
  [POCO] = await uno("rareza = 'poco-comun' and saga is null");
  [RARO, RARO2] = await uno("rareza = 'raro' and saga is null and id <> 'perrito'");
  [SAGA] = await uno('saga is not null');
  [MISTICO] = await uno("rareza = 'mistico'");
});

beforeEach(async () => {
  await db.query('delete from piso_lonja_ofertas');
  await db.query("update piso_lonja_cuenta set sellos = 0, toldo = null, toldos = '{}', sin_comision = 0, hueco_hasta = null");
  await db.query('update piso_cuentas set tickets = 100');
  for (const u of [A, B, C, D, E, F]) {
    for (const m of [COMUN, COMUN2, POCO, RARO, RARO2, SAGA, MISTICO, 'perrito']) await dar(u, m, 0);
  }
});

describe('poner una oferta', () => {
  it('aparta la copia: sale del inventario y no se ofrece dos veces', async () => {
    await dar(A, COMUN, 1);
    const l = await poner(A, COMUN, null, 10);
    expect(await copias(A, COMUN)).toBe(0);
    expect(l.mias).toHaveLength(1);
    const [visto] = (await lonja(B)).puestos;
    expect(visto.dueno).toBe(A);
    expect(visto).toHaveProperty('personaje');
    expect(await rejects(poner(A, COMUN, null, 10))).toMatch(/copias libres/);
  });

  it('no deja ofrecer lo que está colocado', async () => {
    await dar(A, COMUN, 1);
    // La comprobación del piso no viene al caso: aquí solo importa que el mueble esté colocado
    await db.query('alter table pisos disable trigger user');
    await db.query('update pisos set layout = $2::jsonb where user_id = $1', [A, JSON.stringify({ ...starterRoom(), items: [{ id: COMUN, x: 1, y: 1 }] })]);
    expect(await rejects(poner(A, COMUN, null, 10))).toMatch(/copias libres/);
    await db.query('update pisos set layout = $2::jsonb where user_id = $1', [A, JSON.stringify({ ...starterRoom(), items: [] })]);
    await db.query('alter table pisos enable trigger user');
  });

  it('deja fuera sagas, místicos y mascotas, también como lo que se pide', async () => {
    await dar(A, SAGA, 2);
    await dar(A, MISTICO, 2);
    await dar(A, COMUN, 2);
    await dar(A, 'perrito', 2);
    await dar(A, RARO, 1);
    expect(await rejects(poner(A, SAGA, null, 10))).toMatch(/no se puede cambiar/);
    expect(await rejects(poner(A, MISTICO, null, 10))).toMatch(/no se puede cambiar/);
    expect(await rejects(poner(A, 'perrito', null, 30))).toMatch(/no se puede cambiar/);
    expect(await rejects(poner(A, RARO, 'perrito', null))).toMatch(/no se puede pedir/);
    expect(await rejects(poner(A, COMUN, MISTICO, null))).toMatch(/no se puede pedir/);
    expect(await rejects(poner(A, COMUN, COMUN, null))).toMatch(/no se puede pedir/);
    expect((await lonja(A)).libres).not.toHaveProperty('perrito');
  });

  it('todas las mascotas del catálogo están excluidas', async () => {
    const { rows } = await db.query('select piso_lonja_mascotas() as lista');
    expect(rows[0].lista.sort()).toEqual(
      CATALOG.filter((c) => c.mascota)
        .map((c) => c.id)
        .sort(),
    );
  });

  it('el precio va dentro de la horquilla de su rareza', async () => {
    await dar(A, COMUN, 1);
    await dar(A, RARO, 1);
    expect(await rejects(poner(A, COMUN, null, 4))).toMatch(/entre 5 y 20/);
    expect(await rejects(poner(A, COMUN, null, 21))).toMatch(/entre 5 y 20/);
    expect(await rejects(poner(A, RARO, null, 19))).toMatch(/entre 20 y 60/);
  });

  it('un mueble solo se cambia por otro de su rareza o de la de al lado', async () => {
    await dar(A, RARO, 3);
    expect(await rejects(poner(A, RARO, COMUN, null))).toMatch(/de la de al lado/);
    expect(await rejects(poner(A, RARO, null, null, 'comun'))).toMatch(/de la de al lado/);
    await poner(A, RARO, POCO, null);
    await poner(A, RARO, null, null, 'raro');
    expect((await lonja(A)).mias).toHaveLength(2);
  });

  it('pide una cosa y solo una', async () => {
    await dar(A, COMUN, 1);
    expect(await rejects(poner(A, COMUN, null, null))).toMatch(/Di qué buscas/);
    expect(await rejects(poner(A, COMUN, COMUN2, 10))).toMatch(/Di qué buscas/);
    expect(await rejects(poner(A, COMUN, null, 10, 'comun'))).toMatch(/Di qué buscas/);
  });

  it('hasta tres ofertas por puesto, cuatro con el hueco', async () => {
    await dar(A, COMUN, 5);
    for (let i = 0; i < 3; i += 1) await poner(A, COMUN, null, 10);
    expect(await rejects(poner(A, COMUN, null, 10))).toMatch(/lleno/);
    await db.query('update piso_lonja_cuenta set sellos = 14 where user_id = $1', [A]);
    await canjear(A, 'hueco');
    await poner(A, COMUN, null, 10);
    expect(await rejects(poner(A, COMUN, null, 10))).toMatch(/lleno/);
  });

  it('retirar devuelve la copia, una sola vez y solo a quien la puso', async () => {
    await dar(A, COMUN, 1);
    const { mias } = await poner(A, COMUN, null, 10);
    await retirar(B, mias[0].id);
    expect(await copias(A, COMUN)).toBe(0);
    await retirar(A, mias[0].id);
    await retirar(A, mias[0].id);
    expect(await copias(A, COMUN)).toBe(1);
  });

  it('a los siete días caduca: nadie la ve ni la acepta y la copia vuelve', async () => {
    await dar(A, COMUN, 1);
    const { mias } = await poner(A, COMUN, null, 10);
    await db.query("update piso_lonja_ofertas set creada = now() - interval '8 days'");
    expect((await lonja(B)).puestos).toHaveLength(0);
    expect(await rejects(aceptar(B, mias[0].id))).toMatch(/ya no está/);
    expect((await lonja(A)).mias).toHaveLength(0);
    expect(await copias(A, COMUN)).toBe(1);
  });

  it('las cuentas de menos de tres días solo miran', async () => {
    await dar(A, COMUN, 1);
    await dar(F, COMUN, 1);
    const { mias } = await poner(A, COMUN, null, 10);
    await db.query('update profiles set created_at = now() where user_id = $1', [F]);
    expect((await lonja(F)).nueva).toBe(true);
    expect(await rejects(poner(F, COMUN, null, 10))).toMatch(/solo miran/);
    expect(await rejects(aceptar(F, mias[0].id))).toMatch(/solo miran/);
    await db.query("update profiles set created_at = now() - interval '30 days' where user_id = $1", [F]);
  });
});

describe('aceptar', () => {
  const oferta = async (u, doy, pido, precio, clase) => (await poner(u, doy, pido, precio, clase)).mias.at(-1).id;

  it('por tickets: el 10 % se queda en la Lonja y no se crea ninguno', async () => {
    await dar(A, COMUN, 1);
    const id = await oferta(A, COMUN, null, 15);
    await aceptar(B, id);
    expect([await tickets(A), await tickets(B)]).toEqual([113, 85]);
    expect(await copias(B, COMUN)).toBe(1);
    expect((await lonja(A)).cerradas).toHaveLength(1);
    expect((await lonja(A)).cobro.hecho).toBe(13);
  });

  it('la venta sin comisión se gasta en la siguiente venta', async () => {
    await dar(A, COMUN, 1);
    await db.query('update piso_lonja_cuenta set sin_comision = 1 where user_id = $1', [A]);
    await aceptar(B, await oferta(A, COMUN, null, 20));
    expect(await tickets(A)).toBe(120);
    expect((await lonja(A)).sinComision).toBe(0);
  });

  it('por otro mueble: se cambian los dos', async () => {
    await dar(A, COMUN, 1);
    await dar(B, COMUN2, 1);
    await aceptar(B, await oferta(A, COMUN, COMUN2, null));
    expect([await copias(A, COMUN2), await copias(B, COMUN), await copias(B, COMUN2)]).toEqual([1, 1, 0]);
  });

  it('por cualquiera de una rareza: paga quien acepta con lo que elige', async () => {
    await dar(A, RARO, 1);
    await dar(B, RARO2, 1);
    await dar(B, COMUN, 1);
    const id = await oferta(A, RARO, null, null, 'raro');
    expect(await rejects(aceptar(B, id))).toMatch(/Elige con qué/);
    expect(await rejects(aceptar(B, id, COMUN))).toMatch(/Elige con qué/);
    await aceptar(B, id, RARO2);
    expect([await copias(A, RARO2), await copias(B, RARO)]).toEqual([1, 1]);
  });

  it('si falta algo no cambia nada', async () => {
    await dar(A, COMUN, 2);
    const porMueble = await oferta(A, COMUN, COMUN2, null);
    expect(await rejects(aceptar(B, porMueble))).toMatch(/copia libre/);
    await db.query('update piso_cuentas set tickets = 3 where user_id = $1', [B]);
    const porTickets = await oferta(A, COMUN, null, 15);
    expect(await rejects(aceptar(B, porTickets))).toMatch(/tickets suficientes/);
    expect([await tickets(A), await tickets(B), await copias(B, COMUN)]).toEqual([100, 3, 0]);
    expect((await lonja(B)).puestos).toHaveLength(2);
  });

  it('una oferta se acepta una vez, y no la tuya', async () => {
    await dar(A, COMUN, 1);
    const id = await oferta(A, COMUN, null, 10);
    expect(await rejects(aceptar(A, id))).toMatch(/ya no está/);
    await aceptar(B, id);
    expect(await rejects(aceptar(C, id))).toMatch(/ya no está/);
  });

  it('hasta tres cambios al día', async () => {
    for (const u of [A, C, D, E]) {
      await dar(u, COMUN, 1);
    }
    for (const u of [A, C, D]) await aceptar(B, await oferta(u, COMUN, null, 5));
    const id = await oferta(E, COMUN, null, 5);
    expect(await rejects(aceptar(B, id))).toMatch(/tres cambios/);
    expect((await lonja(B)).cambios.hechos).toBe(3);
  });

  it('las mismas dos personas, un cambio por semana y en cualquier sentido', async () => {
    await dar(A, COMUN, 2);
    await dar(B, COMUN2, 1);
    await aceptar(B, await oferta(A, COMUN, null, 5));
    const otra = await oferta(A, COMUN, null, 5);
    expect((await lonja(B)).puestos[0].pareja).toBe(true);
    expect(await rejects(aceptar(B, otra))).toMatch(/un cambio por semana/);
    const alReves = await oferta(B, COMUN2, null, 5);
    expect(await rejects(aceptar(A, alReves))).toMatch(/un cambio por semana/);
    await envejecer(8);
    await db.query("update piso_lonja_ofertas set creada = now() where estado = 'abierta'");
    await aceptar(B, otra);
  });

  it('lo recién llegado no se reofrece ni paga durante tres días', async () => {
    await dar(A, COMUN, 1);
    await aceptar(B, await oferta(A, COMUN, null, 5));
    expect(await copias(B, COMUN)).toBe(1);
    expect((await lonja(B)).retenidas).toBe(1);
    expect((await lonja(B)).libres).not.toHaveProperty(COMUN);
    expect(await rejects(poner(B, COMUN, null, 20))).toMatch(/copias libres/);
    await envejecer(4);
    await poner(B, COMUN, null, 20);
  });

  it('cobrar tiene tope semanal, pero se puede seguir cambiando por muebles', async () => {
    await dar(A, RARO, 3);
    await dar(A, COMUN, 1);
    await aceptar(B, await oferta(A, RARO, null, 60));
    const segunda = await oferta(A, RARO, null, 60);
    expect(await rejects(aceptar(C, segunda))).toMatch(/su tope/);
    expect((await lonja(A)).cobro.hecho).toBe(54);
    await db.query("update piso_lonja_ofertas set neto = 100 where estado = 'hecha'");
    expect(await rejects(poner(A, RARO, null, 60))).toMatch(/cobrado el tope/);
    await poner(A, COMUN, COMUN2, null);
  });

  it('con un bloqueo no se ve ni se acepta', async () => {
    await dar(A, COMUN, 1);
    const id = await oferta(A, COMUN, null, 10);
    await as(db, A, (q) => q('insert into blocks (blocked) values ($1)', [B]));
    expect((await lonja(B)).puestos).toHaveLength(0);
    expect(await rejects(aceptar(B, id))).toMatch(/ya no está/);
    await as(db, A, (q) => q('delete from blocks where blocked = $1', [B]));
  });
});

describe('el canje de la Lonja', () => {
  it('los sellos solo canjean toldos, ventas sin comisión y huecos, sin tickets', async () => {
    await db.query('update piso_lonja_cuenta set sellos = 40 where user_id = $1', [A]);
    const antes = await tickets(A);
    let l = await canjear(A, 'toldo:noche');
    expect([l.toldo, l.toldos, l.sellos]).toEqual(['noche', ['noche'], 22]);
    expect(await rejects(canjear(A, 'toldo:noche'))).toMatch(/ya es tuyo/);
    expect(await rejects(canjear(A, 'tickets'))).toMatch(/no se canjea/);
    await canjear(A, 'sin-comision');
    l = await canjear(A, 'sin-comision');
    expect(l.sinComision).toBe(2);
    expect(await rejects(canjear(A, 'sin-comision'))).toMatch(/dos ventas/);
    expect(await tickets(A)).toBe(antes);
    await db.query('update piso_lonja_cuenta set sellos = 2 where user_id = $1', [A]);
    expect(await rejects(canjear(A, 'hueco'))).toMatch(/faltan sellos/);
  });
});

it('las tablas no se tocan directamente y el anónimo no llama a nada', async () => {
  for (const t of ['piso_lonja_ofertas', 'piso_lonja_cuenta', 'piso_lonja_juego']) {
    expect(await rejects(as(db, A, (q) => q(`select * from ${t}`)))).toMatch(/permission denied/);
  }
  for (const f of ['piso_lonja()', 'piso_lonja_poner(text, text, integer, text, text)', 'piso_lonja_retirar(uuid)', 'piso_lonja_aceptar(uuid, text)', 'piso_lonja_canjear(text)', 'piso_lonja_toldo(text)']) {
    const { rows } = await db.query("select has_function_privilege('anon', $1, 'execute') as puede", [`public.${f}`]);
    expect(rows[0].puede).toBe(false);
  }
});
