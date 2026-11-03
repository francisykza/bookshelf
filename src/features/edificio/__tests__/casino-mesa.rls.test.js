// 1.80 · La mesa para dos del casino: dos amigos (se siguen los dos) juegan contra el mismo crupier y el mismo mazo, cada
// uno cuando quiere. Entre ellos se apuesta, una mesa al día por pareja, hasta 10 fichas y 50 garbanzos; gana quien
// acaba más cerca de 21 sin pasarse y el empate se devuelve. Postgres real (PGlite) con todas las migraciones; las
// cartas se colocan a mano, como superusuario.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { CASINO } from '../hotel/veintiuna';

let db;
let A, B, C, D, E;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const HOY = new Date().toISOString().slice(0, 10);
const casino = (u) => call(u, 'select piso_casino($1::date)', [HOY]);
const invitar = (u, amigo, fichas = 0, garbanzos = 0) => call(u, 'select piso_casino_invitar($1::date, $2, $3, $4)', [HOY, amigo, fichas, garbanzos]);
const aceptar = (u, mesa) => call(u, 'select piso_casino_aceptar($1)', [mesa]);
const rechazar = (u, mesa) => call(u, 'select piso_casino_rechazar($1)', [mesa]);
const jugar = (u, mesa, accion) => call(u, 'select piso_casino_mesa_jugar($1, $2)', [mesa, accion]);
const cuenta = (u) => db.query('select fichas, garbanzos from piso_casino_cuentas where user_id = $1', [u]).then((r) => r.rows[0]);
const mesaDe = (s, amigo) => s.mesas.find((m) => m.amigo.uid === amigo);
// Coloca las cartas de una mesa ya repartida: las de cada uno, las del crupier y lo que queda del mazo
async function colocar(mesa, { anfitrion, invitado, crupier, mazo }) {
  await db.query('update piso_casino_mesas set crupier = $2, mazo = $3 where id = $1', [mesa, crupier, mazo]);
  await db.query("update piso_casino_manos h set tuyas = $2, crupier = $3, estado = 'jugando' from piso_casino_mesas m where h.mesa = m.id and m.id = $1 and h.user_id = m.anfitrion", [mesa, anfitrion, crupier]);
  await db.query("update piso_casino_manos h set tuyas = $2, crupier = $3, estado = 'jugando' from piso_casino_mesas m where h.mesa = m.id and m.id = $1 and h.user_id = m.invitado", [mesa, invitado, crupier]);
}
const seguir = (a, b) => db.query('insert into follows (follower, followed) values ($1, $2)', [a, b]);

beforeAll(async () => {
  db = await createDatabase();
  [A, B, C, D, E] = await createUsers(db, 5);
  for (const [i, u] of [A, B, C, D, E].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Jugador ${i}`]));
  }
  // A es amiga de B, D y E; a C solo la sigue A
  for (const o of [B, D, E]) {
    await seguir(A, o);
    await seguir(o, A);
  }
  await seguir(A, C);
}, 60000);

describe('la mesa para dos', () => {
  it('solo con amigos: os seguís los dos', async () => {
    const s = await casino(A);
    expect(s.garbanzos).toBe(CASINO.garbanzosInicio);
    expect(s.amigos.map((x) => x.uid).sort()).toEqual([B, D, E].sort());
    expect(s.amigos[0]).toHaveProperty('alias');
    expect(await rejects(invitar(A, C))).toMatch(/amigo/);
    expect(await rejects(invitar(C, A))).toMatch(/amigo/);
  });

  it('las apuestas tienen tope y nadie apuesta lo que no tiene', async () => {
    expect(await rejects(invitar(A, B, CASINO.apuestaFichas + 1))).toMatch(/como mucho/);
    expect(await rejects(invitar(A, B, 0, CASINO.apuestaGarbanzos + 1))).toMatch(/como mucho/);
    expect(await rejects(invitar(A, B, -1))).toMatch(/como mucho/);
    expect(await rejects(invitar(A, B, 5))).toMatch(/No tienes tanto/);
  });

  it('una mesa al día por pareja; el invitado la ve y solo él la acepta', async () => {
    await db.query('update piso_casino_cuentas set fichas = 20 where user_id = $1', [A]);
    await casino(B);
    await db.query('update piso_casino_cuentas set fichas = 20 where user_id = $1', [B]);
    const s = await invitar(A, B, 10, 50);
    const m = mesaDe(s, B);
    expect(m).toMatchObject({ anfitrion: true, estado: 'invitada', fichas: 10, garbanzos: 50, mia: null });
    // Los garbanzos del día se dan al jugar (100 + 20); lo apostado aún no se ha apartado
    expect(s).toMatchObject({ fichas: 20, garbanzos: 120 });
    expect(await rejects(invitar(A, B))).toMatch(/una al día por pareja/);
    expect(await rejects(invitar(B, A))).toMatch(/una al día por pareja/);
    expect(mesaDe(await casino(B), A)).toMatchObject({ id: m.id, anfitrion: false, estado: 'invitada' });
    expect(await rejects(aceptar(A, m.id))).toMatch(/ya no te espera/);
  });

  it('al aceptar se aparta lo apostado y se reparte; las cartas del otro no se ven', async () => {
    const m = mesaDe(await casino(B), A);
    const s = await aceptar(B, m.id);
    expect(await cuenta(A)).toEqual({ fichas: 10, garbanzos: 70 });
    expect(await cuenta(B)).toEqual({ fichas: 10, garbanzos: 70 });
    expect(s.quedan).toBe(2);
    // A 10 + 8 = 18; B 10 + 6 = 16; el crupier 10 + 7 = 17 enseña el 10
    await colocar(m.id, { anfitrion: [9, 7], invitado: [9, 5], crupier: [22, 6], mazo: [4, 12, 1] });
    const t = await casino(A);
    const vista = mesaDe(t, B);
    expect(vista).toMatchObject({ estado: 'jugando', crupier: [22], suyo: null, mia: { tuyas: [9, 7], tu: 18, estado: 'jugando' }, suya: { estado: 'jugando', cartas: 2, tuyas: null, tu: null } });
    expect(JSON.stringify(t)).not.toContain('mazo');
    expect(t.manos.find((x) => x.mesa === m.id)).toMatchObject({ crupier: [22], suyo: null });
    // La mano de la mesa no bloquea la del crupier a solas
    expect(t.jugando).toBe(false);
  });

  it('cada uno juega cuando quiere; al terminar los dos, el crupier destapa y se reparte la apuesta', async () => {
    const m = mesaDe(await casino(A), B);
    let s = await jugar(A, m.id, 'plantarse');
    expect(mesaDe(s, B)).toMatchObject({ estado: 'jugando', mia: { estado: 'esperando' } });
    expect(await rejects(jugar(A, m.id, 'pedir'))).toMatch(/ninguna mano abierta/);
    // B pide un 5: 21 justos, se planta solo y la mesa se resuelve (el crupier tiene 17: se planta)
    s = await jugar(B, m.id, 'pedir');
    const vista = mesaDe(s, A);
    expect(vista).toMatchObject({
      estado: 'cerrada',
      crupier: [22, 6],
      suyo: 17,
      apuesta: 'ganas',
      mia: { tuyas: [9, 5, 4], tu: 21, estado: 'ganada', fichas: CASINO.ganada + CASINO.compania },
      suya: { tuyas: [9, 7], tu: 18 },
    });
    expect(mesaDe(await casino(A), B)).toMatchObject({ apuesta: 'pierdes', mia: { estado: 'ganada', fichas: CASINO.ganada + CASINO.compania } });
    // A: 10 + 10 de la mano. B: 10 + 10 de la mano + el bote de 20; los garbanzos, el bote de 100
    expect(await cuenta(A)).toEqual({ fichas: 20, garbanzos: 70 });
    expect(await cuenta(B)).toEqual({ fichas: 40, garbanzos: 170 });
    expect(await rejects(jugar(B, m.id, 'plantarse'))).toMatch(/ninguna mano abierta/);
  });

  it('el empate (o pasarse los dos) devuelve lo apostado', async () => {
    await casino(D);
    await db.query('update piso_casino_cuentas set fichas = 10 where user_id = $1', [D]);
    const m = mesaDe(await invitar(D, A, 5, 30), A);
    await aceptar(A, m.id);
    await colocar(m.id, { anfitrion: [9, 6, 12], invitado: [9, 7, 11], crupier: [9, 7], mazo: [] });
    await jugar(D, m.id, 'plantarse');
    const s = await jugar(A, m.id, 'plantarse');
    expect(mesaDe(s, D)).toMatchObject({ estado: 'cerrada', apuesta: 'empate', mia: { tu: 28, estado: 'perdida', fichas: CASINO.perdida + CASINO.compania } });
    expect(await cuenta(A)).toEqual({ fichas: 24, garbanzos: 70 });
    expect(await cuenta(D)).toEqual({ fichas: 14, garbanzos: 120 });
  });

  it('una invitación se puede rechazar o retirar, y entonces se puede invitar otra vez', async () => {
    let m = mesaDe(await invitar(A, E), E);
    await rechazar(E, m.id);
    expect(await rejects(aceptar(E, m.id))).toMatch(/ya no te espera/);
    m = mesaDe(await invitar(A, E), E);
    expect(m.estado).toBe('invitada');
    expect(await rejects(rechazar(C, m.id))).toMatch(/ya no se puede retirar/);
    const s = await rechazar(A, m.id);
    expect(s.mesas.filter((x) => x.amigo.uid === E).map((x) => x.estado)).toEqual(['rechazada', 'rechazada']);
  });

  it('con un bloqueo no hay mesa', async () => {
    await as(db, E, (q) => q('insert into blocks (blocked) values ($1)', [A]));
    expect(await rejects(invitar(A, E))).toMatch(/amigo/);
    expect((await casino(A)).amigos.map((x) => x.uid)).not.toContain(E);
  });

  it('las mesas de hace días se cierran solas: la invitación se retira y la partida se resuelve plantando a quien faltaba', async () => {
    const r = await db.query(
      "insert into piso_casino_mesas (dia, anfitrion, invitado, estado) values (current_date - 3, $1, $2, 'invitada'), (current_date - 2, $1, $2, 'jugando') returning id",
      [A, B],
    );
    const [vieja, aMedias] = r.rows.map((x) => x.id);
    await db.query("update piso_casino_mesas set crupier = '{9,7}', mazo = '{}' where id = $1", [aMedias]);
    await db.query(
      "insert into piso_casino_manos (user_id, dia, mano, mazo, tuyas, crupier, estado, mesa) values ($1, current_date - 2, 1, '{}', '{9,8}', '{9,7}', 'esperando', $3), ($2, current_date - 2, 1, '{}', '{9,2}', '{9,7}', 'jugando', $3)",
      [A, B, aMedias],
    );
    await casino(B);
    const estados = await db.query('select id, estado, ganador from piso_casino_mesas where id = any($1)', [[vieja, aMedias]]);
    expect(Object.fromEntries(estados.rows.map((x) => [x.id, x.estado]))).toEqual({ [vieja]: 'rechazada', [aMedias]: 'cerrada' });
    expect(estados.rows.find((x) => x.id === aMedias).ganador).toBe(A);
    const manos = await db.query('select user_id, estado from piso_casino_manos where mesa = $1', [aMedias]);
    expect(Object.fromEntries(manos.rows.map((x) => [x.user_id, x.estado]))).toEqual({ [A]: 'ganada', [B]: 'perdida' });
  });

  it('las manos de la mesa son de las tres del día', async () => {
    // A lleva dos (con B y con D): una más a solas y ya no hay mesa
    await call(A, 'select piso_casino_repartir($1::date)', [HOY]);
    expect(await rejects(invitar(A, B))).toMatch(/tres manos/);
  });

  it('sin sesión no se llega a nada, y la tabla de mesas no se toca', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    for (const sql of [
      `select piso_casino_invitar('${HOY}', '${B}', 0, 0)`,
      `select piso_casino_aceptar('${id}')`,
      `select piso_casino_rechazar('${id}')`,
      `select piso_casino_mesa_jugar('${id}', 'pedir')`,
    ]) {
      expect(await rejects(as(db, null, (q) => q(sql)))).toMatch(/permission denied/);
    }
    expect(await rejects(as(db, A, (q) => q('select * from piso_casino_mesas')))).toMatch(/permission denied/);
    for (const sql of [`select piso_casino_mesa_resolver('${id}')`, `select piso_casino_amigo('${B}')`, `select piso_casino_llegar('${A}', '${HOY}')`, `select piso_casino_mesas_vencer('${A}')`]) {
      expect(await rejects(as(db, A, (q) => q(sql)))).toMatch(/permission denied/);
    }
  });
});
