// 1.82 · Los garbanzos del casino: mesas de garbanzos que no gastan manos ni dan fichas, la lata con sus premios y el
// cambio de garbanzos y tickets, con su tope semanal. Postgres real (PGlite) con todas las migraciones.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects, REFORMA_MUEBLES } from '../../social/__tests__/supabaseHarness';
import { catalogItem } from '../catalog';
import { starterRoom } from '../demo';
import { CASINO, LATA } from '../hotel/veintiuna';

let db;
let A, B, C, D;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const HOY = new Date().toISOString().slice(0, 10);
const casino = (u) => call(u, 'select piso_casino($1::date)', [HOY]);
const invitar = (u, amigo, fichas = 0, garbanzos = 0) => call(u, 'select piso_casino_invitar($1::date, $2, $3, $4)', [HOY, amigo, fichas, garbanzos]);
const invitarG = (u, amigo, garbanzos) => call(u, 'select piso_casino_invitar_garbanzos($1::date, $2, $3)', [HOY, amigo, garbanzos]);
const aceptar = (u, mesa) => call(u, 'select piso_casino_aceptar($1)', [mesa]);
const jugar = (u, mesa) => call(u, "select piso_casino_mesa_jugar($1, 'plantarse')", [mesa]);
const cambiar = (u, sentido) => call(u, 'select piso_casino_cambiar($1::date, $2)', [HOY, sentido]);
const canjear = (u, articulo) => call(u, 'select piso_casino_lata_canjear($1::date, $2)', [HOY, articulo]);
const dar = (u, garbanzos) => db.query('update piso_casino_cuentas set garbanzos = $2, garbanzos_dia = $3 where user_id = $1', [u, garbanzos, HOY]);
const cuenta = (u) => db.query('select fichas, garbanzos from piso_casino_cuentas where user_id = $1', [u]).then((r) => r.rows[0]);
const tickets = (u) => db.query('select tickets from piso_cuentas where user_id = $1', [u]).then((r) => r.rows[0].tickets);
const abierta = (s, amigo) => s.mesas.find((m) => m.amigo.uid === amigo && m.solo_garbanzos && ['invitada', 'jugando'].includes(m.estado));
const seguir = (a, b) => db.query('insert into follows (follower, followed) values ($1, $2)', [a, b]);
// Una mesa de garbanzos entera. Sin manos en juego: los dos se plantan (si no les salió veintiuna)
async function partida(a, b, garbanzos) {
  const id = abierta(await invitarG(a, b, garbanzos), b).id;
  await aceptar(b, id);
  for (const u of [a, b]) {
    const m = (await casino(u)).mesas.find((x) => x.id === id);
    if (m.estado === 'jugando' && m.mia.estado === 'jugando') await jugar(u, id);
  }
  return id;
}

beforeAll(async () => {
  // Reglas de sobres y muebles para cuando se reabran: sin la migración de la reforma (ver supabaseHarness)
  db = await createDatabase(Infinity, { sin: [REFORMA_MUEBLES] });
  [A, B, C, D] = await createUsers(db, 4);
  for (const [i, u] of [A, B, C, D].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Jugador ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await as(db, u, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(starterRoom())]));
  }
  for (const [x, y] of [
    [A, B],
    [C, D],
  ]) {
    await seguir(x, y);
    await seguir(y, x);
  }
}, 60000);

describe('las reglas', () => {
  it('las cifras y los precios de la app son los del servidor, y la lata está en el catálogo', async () => {
    expect((await db.query('select piso_casino_reglas() as r')).rows[0].r).toMatchObject({
      mesasGarbanzos: CASINO.mesasGarbanzos,
      cambioGarbanzos: CASINO.cambioGarbanzos,
      cambioTickets: CASINO.cambioTickets,
      vueltaGarbanzos: CASINO.vueltaGarbanzos,
      topeCambio: CASINO.topeCambio,
    });
    expect((await db.query('select piso_casino_lata_precios() as r')).rows[0].r).toEqual(Object.fromEntries(LATA.map((a) => [a.id, a.precio])));
    for (const a of LATA) {
      expect(catalogItem(a.id)).toMatchObject({ casino: true, rareza: 'especial' });
      const k = (await db.query('select capa, rareza from piso_catalogo where id = $1', [a.id])).rows[0];
      expect(k).toEqual({ capa: catalogItem(a.id).capa, rareza: 'especial' });
    }
  });

  it('nadie sin sesión llama a las funciones nuevas', async () => {
    for (const fn of ['piso_casino_invitar_garbanzos(date, uuid, integer)', 'piso_casino_lata_canjear(date, text)', 'piso_casino_cambiar(date, text)']) {
      const r = await db.query(`select has_function_privilege('anon', 'public.${fn}', 'execute') as p`);
      expect(r.rows[0].p).toBe(false);
    }
  });
});

describe('las mesas de garbanzos', () => {
  it('tras la mesa del día se sigue jugando, sin gastar manos ni dar fichas', async () => {
    await casino(A);
    await casino(B);
    await invitar(A, B, 0, 10);
    expect(await rejects(invitar(A, B))).toMatch(/una al día por pareja/);
    const dia = (await casino(A)).mesas.find((m) => !m.solo_garbanzos);
    await aceptar(B, dia.id);
    for (const u of [A, B]) {
      const m = (await casino(u)).mesas.find((x) => x.id === dia.id);
      if (m.estado === 'jugando' && m.mia.estado === 'jugando') await jugar(u, dia.id);
    }
    const antes = await casino(A);
    expect(antes.quedan).toBe(CASINO.manos - 1);
    const fichasAntes = (await cuenta(A)).fichas;

    const id = await partida(A, B, 25);
    const s = await casino(A);
    expect(s.quedan).toBe(antes.quedan);
    expect(s.manos).toHaveLength(1);
    expect(s.quedanGarbanzos).toBe(CASINO.mesasGarbanzos - 1);
    expect((await cuenta(A)).fichas).toBe(fichasAntes);
    expect(s.mesas.find((m) => m.id === id)).toMatchObject({ estado: 'cerrada', solo_garbanzos: true, mia: { fichas: 0 } });
  });

  it('la apuesta va a quien gana, o se devuelve, y nunca se crean garbanzos', async () => {
    await casino(C);
    await casino(D);
    await dar(C, 100);
    await dar(D, 100);
    await partida(C, D, 50);
    const [c, d] = [(await cuenta(C)).garbanzos, (await cuenta(D)).garbanzos];
    expect(c + d).toBe(200);
    expect([0, 50, 100, 150, 200]).toContain(c);
  });

  it('solo una abierta por pareja, de 1 a 50 y nunca más de lo que se tiene', async () => {
    await dar(C, 100);
    await dar(D, 100);
    expect(await rejects(invitarG(C, D, 0))).toMatch(/de 1 a 50/);
    expect(await rejects(invitarG(C, D, 51))).toMatch(/de 1 a 50/);
    await dar(C, 5);
    expect(await rejects(invitarG(C, D, 10))).toMatch(/No tienes tanto/);
    await dar(C, 100);
    const s = await invitarG(C, D, 10);
    expect(await rejects(invitarG(C, D, 10))).toMatch(/abierta/);
    await call(C, 'select piso_casino_rechazar($1)', [abierta(s, D).id]);
  });

  it('no aparta manos: quien invita puede seguir jugando a solas', async () => {
    const s = await invitarG(C, D, 10);
    for (let i = 0; i < CASINO.manos; i += 1) {
      await call(C, 'select piso_casino_repartir($1::date)', [HOY]);
      await db.query("update piso_casino_manos set estado = 'perdida' where user_id = $1 and estado = 'jugando' and mesa is null", [C]);
    }
    expect((await casino(C)).quedan).toBe(0);
    await call(C, 'select piso_casino_rechazar($1)', [abierta(s, D).id]);
  });

  it('seis al día por persona', async () => {
    await dar(C, 1000);
    await dar(D, 1000);
    const hechas = CASINO.mesasGarbanzos - (await casino(C)).quedanGarbanzos;
    for (let i = hechas; i < CASINO.mesasGarbanzos; i += 1) await partida(C, D, 1);
    expect((await casino(C)).quedanGarbanzos).toBe(0);
    expect(await rejects(invitarG(C, D, 1))).toMatch(/ya vale de garbanzos/);
  });
});

describe('la lata', () => {
  it('cambia garbanzos por un premio, una sola vez', async () => {
    await dar(A, 100);
    expect(await rejects(canjear(A, 'tarro-garbanzos'))).toMatch(/Te faltan garbanzos/);
    expect(await rejects(canjear(A, 'gramola'))).toMatch(/no está en la lata/);
    await dar(A, 200);
    const s = await canjear(A, 'tarro-garbanzos');
    expect(s.garbanzos).toBe(50);
    expect(s.lata.find((x) => x.id === 'tarro-garbanzos').tienes).toBe(true);
    await dar(A, 200);
    expect(await rejects(canjear(A, 'tarro-garbanzos'))).toMatch(/ya lo tienes/);
    expect((await db.query("select copias from piso_inventario where user_id = $1 and mueble = 'tarro-garbanzos'", [A])).rows[0].copias).toBe(1);
  });

  it('sus premios no se reciclan', async () => {
    expect(await rejects(call(A, "select piso_reciclar('tarro-garbanzos')"))).toBeTruthy();
  });
});

describe('el cambio', () => {
  it('garbanzos por tickets, hasta el tope de la semana', async () => {
    await dar(B, 500);
    const t = await tickets(B);
    const s = await cambiar(B, 'a-tickets');
    expect(s.garbanzos).toBe(500 - CASINO.cambioGarbanzos);
    expect(s.tickets).toBe(t + CASINO.cambioTickets);
    expect(s.cambio).toEqual({ aTickets: CASINO.cambioTickets, aGarbanzos: 0 });
    await cambiar(B, 'a-tickets');
    expect(await rejects(cambiar(B, 'a-tickets'))).toMatch(/Esta semana/);
    expect(await tickets(B)).toBe(t + CASINO.topeCambio);
  });

  it('tickets por garbanzos, con su propio tope, y el ida y vuelta siempre pierde', async () => {
    await db.query('update piso_cuentas set tickets = 100 where user_id = $1', [D]);
    await dar(D, 0);
    expect(await rejects(cambiar(D, 'a-tickets'))).toMatch(/Te faltan garbanzos/);
    const s = await cambiar(D, 'a-garbanzos');
    expect(s).toMatchObject({ garbanzos: CASINO.vueltaGarbanzos, tickets: 100 - CASINO.cambioTickets });
    await cambiar(D, 'a-garbanzos');
    expect(await rejects(cambiar(D, 'a-garbanzos'))).toMatch(/Esta semana/);
    expect(CASINO.vueltaGarbanzos).toBeLessThan(CASINO.cambioGarbanzos);
  });

  it('el tope vuelve el lunes, y no se engaña con otro día', async () => {
    expect(await rejects(call(B, "select piso_casino_cambiar(current_date + 1, 'a-tickets')"))).toMatch(/Esta semana/);
    await db.query('update piso_casino_cambios set semana = semana - 7 where user_id = $1', [B]);
    expect((await cambiar(B, 'a-tickets')).cambio.aTickets).toBe(CASINO.cambioTickets);
  });

  it('solo se cambia en esos dos sentidos, y sin tickets no hay vuelta', async () => {
    expect(await rejects(cambiar(C, 'fichas'))).toMatch(/no se hace aquí/);
    await db.query('update piso_cuentas set tickets = 0 where user_id = $1', [C]);
    expect(await rejects(cambiar(C, 'a-garbanzos'))).toMatch(/No tienes tickets/);
  });
});
