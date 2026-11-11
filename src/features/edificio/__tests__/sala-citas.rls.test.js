// 1.117 · La cita de lectura en un Postgres real (PGlite) con todas las migraciones: solo entre amigos (seguimiento
// mutuo), una cita abierta a la vez, la invitación caduca a los 10 min y rechazar se ve como no venir, el reloj lo pone
// el servidor, el latido cuenta una vez por minuto y solo dentro del reloj, y nadie de fuera ve ni toca la cita.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';

let db;
let A, B, C, D;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const invitar = (u, amigo, en = 0, min = 25) => call(u, 'select sala_cita_invitar($1, $2, $3)', [amigo, en, min]);
const citas = (u) => call(u, 'select sala_citas()');
const responder = (u, cita, si) => call(u, 'select sala_cita_responder($1, $2)', [cita, si]);
const latido = (u, cita) => call(u, 'select sala_cita_latido($1)', [cita]);
const dejar = (u, cita) => as(db, u, (q) => q('select sala_cita_dejar($1)', [cita]));
const seguir = (a, b) => db.query('insert into follows (follower, followed) values ($1, $2)', [a, b]);
// Mueve el reloj de una cita hacia atrás (como si hubieran pasado `min` minutos)
const atrasar = (cita, min) =>
  db.query("update sala_citas set creada = creada - ($2 || ' minutes')::interval, caduca = caduca - ($2 || ' minutes')::interval, empieza = empieza - ($2 || ' minutes')::interval where id = $1", [
    cita,
    String(min),
  ]);

beforeAll(async () => {
  db = await createDatabase();
  [A, B, C, D] = await createUsers(db, 4);
  for (const [i, u] of [A, B, C, D].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lector ${i}`]));
  }
  // A y B se siguen; A sigue a C, pero C no a A; D se sigue con A pero luego hay bloqueo
  await seguir(A, B);
  await seguir(B, A);
  await seguir(A, C);
  await seguir(A, D);
  await seguir(D, A);
}, 60000);

describe('la cita de lectura', () => {
  it('solo se invita a un amigo, con las opciones cerradas', async () => {
    expect(await rejects(invitar(A, C))).toMatch(/sala:no_amigo/);
    expect(await rejects(invitar(A, A))).toMatch(/sala:no_amigo/);
    expect(await rejects(invitar(A, B, 10))).toMatch(/sala:cita/);
    expect(await rejects(invitar(A, B, 0, 30))).toMatch(/sala:cita/);
    const r = await citas(A);
    expect(r.amigos.map((a) => a.uid).sort()).toEqual([B, D].sort());
    expect(typeof r.ahora).toBe('number');
    expect(r.mia).toBeNull();
  });

  it('la invitación llega al amigo con la hora del servidor; las tablas no se leen ni se tocan directamente', async () => {
    const c = await invitar(A, B, 15, 45);
    expect(c).toMatchObject({ soy: 'anfitrion', uid: B, alias: 'Lector 1', minutos: 45, estado: 'invitada', juntos: 0 });
    expect(c.fin - c.empieza).toBe(45 * 60000);
    const r = await citas(B);
    expect(r.invitaciones).toHaveLength(1);
    expect(r.invitaciones[0]).toMatchObject({ cita: c.cita, soy: 'invitado', uid: A, alias: 'Lector 0', estado: 'invitada' });
    expect(r.invitaciones[0].empieza - r.ahora).toBeGreaterThan(14 * 60000);
    // Sin aceptar, la cita de B aún no es suya
    expect(r.mia).toBeNull();
    expect((await citas(A)).mia).toMatchObject({ cita: c.cita, estado: 'invitada' });
    expect(await rejects(as(db, B, (q) => q('select * from sala_citas')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('insert into sala_latidos (cita, user_id, minuto) values ($1, $2, 0)', [c.cita, A])))).toMatch(/permission denied/);
    // Nadie de fuera la ve, la acepta ni late en ella
    expect((await citas(C)).invitaciones).toEqual([]);
    expect(await rejects(responder(C, c.cita, true))).toMatch(/sala:cita/);
    expect(await rejects(latido(C, c.cita))).toMatch(/sala:cita/);
    // Ni quien invitó puede aceptarla por el otro
    expect(await rejects(responder(A, c.cita, true))).toMatch(/sala:cita/);
  });

  it('invitar de nuevo cierra la anterior: una cita abierta a la vez', async () => {
    const vieja = (await citas(A)).mia;
    const nueva = await invitar(A, B, 0, 25);
    expect(nueva.cita).not.toBe(vieja.cita);
    const r = await citas(B);
    expect(r.invitaciones.map((x) => x.cita)).toEqual([nueva.cita]);
    expect(await rejects(responder(B, vieja.cita, true))).toMatch(/sala:cita/);
  });

  it('a los 10 min sin respuesta caduca y quien invitó lee «no ha podido venir»', async () => {
    const c = (await citas(A)).mia;
    await atrasar(c.cita, 11);
    expect((await citas(B)).invitaciones).toEqual([]);
    expect(await rejects(responder(B, c.cita, true))).toMatch(/sala:cita/);
    expect((await citas(A)).mia).toMatchObject({ cita: c.cita, estado: 'no_vino' });
  });

  it('rechazar se ve igual que no contestar', async () => {
    const c = await invitar(A, B, 30, 15);
    expect(await responder(B, c.cita, false)).toMatchObject({ estado: 'no_vino' });
    expect((await citas(A)).mia).toMatchObject({ cita: c.cita, estado: 'no_vino' });
    expect((await citas(B)).mia).toMatchObject({ cita: c.cita, estado: 'no_vino' });
  });

  it('aceptada «ahora», el reloj empieza al aceptar y es el mismo para los dos', async () => {
    const c = await invitar(A, B, 0, 25);
    await atrasar(c.cita, 3);
    const r = await responder(B, c.cita, true);
    expect(r).toMatchObject({ estado: 'aceptada', soy: 'invitado' });
    const ahora = (await citas(B)).ahora;
    expect(Math.abs(r.empieza - ahora)).toBeLessThan(5000);
    expect((await citas(A)).mia).toMatchObject({ cita: c.cita, estado: 'aceptada', empieza: r.empieza, fin: r.fin });
    expect((await citas(B)).mia).toMatchObject({ cita: c.cita, empieza: r.empieza, fin: r.fin });
  });

  it('el latido cuenta una vez por minuto, y «juntos» son los minutos en que latisteis los dos', async () => {
    const { cita } = (await citas(A)).mia;
    expect(await latido(A, cita)).toMatchObject({ mios: 1, juntos: 0, otro_aqui: false });
    expect(await latido(A, cita)).toMatchObject({ mios: 1, juntos: 0 });
    expect((await citas(B)).mia).toMatchObject({ otro_aqui: true });
    expect(await latido(B, cita)).toMatchObject({ mios: 1, juntos: 1 });
    await atrasar(cita, 1);
    await latido(A, cita);
    await atrasar(cita, 1);
    await latido(A, cita);
    expect(await latido(B, cita)).toMatchObject({ mios: 2, juntos: 2 });
    expect(await latido(A, cita)).toMatchObject({ mios: 3, juntos: 2, otro_aqui: true });
    // Quien se va del sofá deja de estar «aquí» a los dos minutos
    await atrasar(cita, 2);
    expect((await citas(B)).mia).toMatchObject({ otro_aqui: false });
  });

  it('pasado el reloj ya no cuenta y la cita queda «terminada» con lo leído juntos', async () => {
    const { cita } = (await citas(A)).mia;
    await atrasar(cita, 24);
    expect(await latido(B, cita)).toMatchObject({ estado: 'terminada', juntos: 2 });
    expect((await citas(A)).mia).toMatchObject({ cita, estado: 'terminada', juntos: 2 });
    const { rows } = await db.query('select max(minuto) as m from sala_latidos where cita = $1', [cita]);
    expect(rows[0].m).toBeLessThan(25);
  });

  it('dejarla a medias la acaba para los dos y conserva lo leído juntos; antes de empezar, la anula', async () => {
    const c = await invitar(B, A, 0, 15);
    await responder(A, c.cita, true);
    await latido(A, c.cita);
    await latido(B, c.cita);
    await dejar(B, c.cita);
    expect((await citas(A)).mia).toMatchObject({ cita: c.cita, estado: 'terminada', juntos: 1 });
    expect(await latido(A, c.cita)).toMatchObject({ juntos: 1, mios: 1 });
    // Una que aún no ha empezado desaparece
    const d = await invitar(A, B, 30, 15);
    await dejar(C, d.cita);
    expect((await citas(B)).invitaciones.map((x) => x.cita)).toEqual([d.cita]);
    await dejar(A, d.cita);
    expect((await citas(B)).invitaciones).toEqual([]);
    expect((await citas(A)).mia).toBeNull();
  });

  it('con un bloqueo de por medio no hay cita ni invitación', async () => {
    const c = await invitar(A, D, 0, 15);
    await db.query('insert into blocks (blocker, blocked) values ($1, $2)', [D, A]);
    expect((await citas(D)).invitaciones).toEqual([]);
    expect(await rejects(responder(D, c.cita, true))).toMatch(/sala:cita/);
    expect(await rejects(invitar(A, D))).toMatch(/sala:no_amigo/);
    expect((await citas(A)).amigos.map((a) => a.uid)).toEqual([B]);
  });
});
