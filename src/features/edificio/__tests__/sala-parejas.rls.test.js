// 1.118 · La placa del sofá y los gestos en un Postgres real (PGlite) con todas las migraciones: gestos de una lista
// cerrada, entre quienes leen a la vez en la sala (uno cada media hora) o entre los dos de una cita (uno por minuto);
// la placa de cada pareja con sus minutos juntos, sus hitos y los libros apuntados, que solo ven los dos.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';

let db;
let A, B, C, D;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const gesto = (u, quien, g) => call(u, 'select sala_gesto($1, $2)', [quien, g]);
const nuevos = (u) => call(u, 'select sala_gestos_nuevos()');
const placas = (u) => call(u, 'select sala_placas()');
const apuntar = (u, cita, titulo) => call(u, 'select sala_placa_libro($1, $2)', [cita, titulo]);
const invitar = (u, amigo, min = 25) => call(u, 'select sala_cita_invitar($1, 0, $2)', [amigo, min]);
const responder = (u, cita) => call(u, 'select sala_cita_responder($1, true)', [cita]);
const latido = (u, cita) => call(u, 'select sala_cita_latido($1)', [cita]);
const seguir = (a, b) => db.query('insert into follows (follower, followed) values ($1, $2)', [a, b]);
const sentar = (u) => as(db, u, (q) => q('insert into reading_presence (share_book) values (false)'));
const atrasarCita = (cita, min) =>
  db.query("update sala_citas set creada = creada - ($2 || ' minutes')::interval, caduca = caduca - ($2 || ' minutes')::interval, empieza = empieza - ($2 || ' minutes')::interval where id = $1", [
    cita,
    String(min),
  ]);
const atrasarGestos = (min) => db.query("update sala_saludos set created_at = created_at - ($1 || ' minutes')::interval", [String(min)]);
// Minutos juntos de golpe, como si los dos hubieran latido en cada uno
const juntos = (cita, a, b, n) =>
  db.query('insert into sala_latidos (cita, user_id, minuto) select $1, u, m from unnest($2::uuid[]) u, generate_series(0, $3 - 1) m on conflict do nothing', [cita, [a, b], n]);

beforeAll(async () => {
  db = await createDatabase();
  [A, B, C, D] = await createUsers(db, 4);
  for (const [i, u] of [A, B, C, D].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lector ${i}`]));
  }
  // A y B son amigos; C lee en la sala pero no es amigo de nadie; D es amigo de A
  for (const [x, y] of [
    [A, B],
    [B, A],
    [A, D],
    [D, A],
  ])
    await seguir(x, y);
}, 60000);

describe('los gestos', () => {
  it('solo de la lista cerrada, y solo con quien lee a la vez', async () => {
    expect(await gesto(A, C, 'hola')).toBe(false);
    await sentar(A);
    await sentar(C);
    expect(await gesto(A, C, 'adios')).toBe(false);
    expect(await gesto(A, C, 'taza')).toBe(true);
    expect(await nuevos(C)).toEqual([{ de: A, gesto: 'taza' }]);
    // Cada gesto se entrega una vez
    expect(await nuevos(C)).toEqual([]);
  });

  it('en la sala, uno cada media hora por pareja', async () => {
    expect(await gesto(A, C, 'bueno')).toBe(false);
    expect(await nuevos(C)).toEqual([]);
    await atrasarGestos(31);
    expect(await gesto(A, C, 'noches')).toBe(true);
    expect(await nuevos(C)).toEqual([{ de: A, gesto: 'noches' }]);
    // El saludo de siempre sigue funcionando (y llega como «hola» a quien ya tiene la versión nueva)
    await atrasarGestos(31);
    expect(await call(C, 'select sala_saludar($1)', [A])).toBe(true);
    expect(await nuevos(A)).toEqual([{ de: C, gesto: 'hola' }]);
  });

  it('en una cita, entre los dos amigos aunque no estén en los sillones, uno por minuto', async () => {
    expect(await gesto(B, A, 'hola')).toBe(false);
    const c = await invitar(B, A);
    expect(await gesto(B, A, 'hola')).toBe(false);
    await responder(A, c.cita);
    expect(await gesto(B, A, 'libro')).toBe(true);
    expect(await gesto(B, A, 'capitulo')).toBe(false);
    expect(await nuevos(A)).toEqual([{ de: B, gesto: 'libro' }]);
    await atrasarGestos(2);
    expect(await gesto(A, B, 'intenso')).toBe(true);
    expect(await gesto(B, A, 'capitulo')).toBe(true);
    expect(await nuevos(B)).toEqual([{ de: A, gesto: 'intenso' }]);
    // Acabada la cita, ya no (B no está sentado en la sala)
    await atrasarCita(c.cita, 30);
    await atrasarGestos(2);
    expect(await gesto(A, B, 'noches')).toBe(false);
  });

  it('las tablas no se leen ni se tocan directamente', async () => {
    expect(await rejects(as(db, A, (q) => q('select * from sala_pareja_libros')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select * from sala_saludos')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select sala_pareja_minutos($1, $2)', [A, B])))).toMatch(/permission denied/);
  });
});

describe('la placa del sofá', () => {
  let cita;
  it('sin haber leído juntos, no hay placa', async () => {
    expect(await placas(D)).toEqual([]);
  });

  it('cuenta los minutos juntos de todas las citas de la pareja; la ven los dos y nadie más', async () => {
    const c1 = await invitar(A, B, 45);
    await responder(B, c1.cita);
    await juntos(c1.cita, A, B, 40);
    // Un minuto en el que solo latió uno no cuenta
    await db.query('insert into sala_latidos (cita, user_id, minuto) values ($1, $2, 44)', [c1.cita, A]);
    const c2 = await invitar(B, A, 45);
    await responder(A, c2.cita);
    await juntos(c2.cita, A, B, 30);
    cita = c2.cita;
    const pa = await placas(A);
    expect(pa).toEqual([{ uid: B, alias: 'Lector 1', avatar_id: 'gato-lector', minutos: 70, hito: 1, metal: 'laton', libros: [] }]);
    expect((await placas(B))[0]).toMatchObject({ uid: A, minutos: 70 });
    expect(await placas(C)).toEqual([]);
    expect(await placas(D)).toEqual([]);
  });

  it('los hitos solo cambian la placa: plata desde 10 h y oro desde 50 h', async () => {
    const c3 = await invitar(D, A, 45);
    await responder(A, c3.cita);
    await juntos(c3.cita, A, D, 1);
    for (const [min, hito, metal] of [
      [299, 1, 'laton'],
      [300, 5, 'laton'],
      [600, 10, 'plata'],
      [1500, 25, 'plata'],
      [3000, 50, 'oro'],
      [6000, 100, 'oro'],
    ]) {
      await db.query('delete from sala_latidos where cita = $1', [c3.cita]);
      // Los minutos de verdad van de 0 a 44; aquí se fuerzan para probar los umbrales
      await db.query('alter table sala_latidos drop constraint if exists sala_latidos_minuto_check');
      await juntos(c3.cita, A, D, min);
      expect((await placas(D))[0]).toMatchObject({ minutos: min, hito, metal });
    }
  });

  it('apuntar un libro terminado en una cita en la que habéis leído juntos', async () => {
    const r = await apuntar(A, cita, '  El faro del fin  ');
    expect(r.find((p) => p.uid === B).libros).toEqual([{ titulo: 'El faro del fin', mio: true }]);
    expect((await placas(B)).find((p) => p.uid === A).libros).toEqual([{ titulo: 'El faro del fin', mio: false }]);
    // El mismo título otra vez no se repite
    await apuntar(A, cita, 'El faro del fin');
    expect((await placas(A)).find((p) => p.uid === B).libros).toHaveLength(1);
    // Ni título vacío ni de otra cita ajena ni de alguien de fuera
    expect(await rejects(apuntar(A, cita, '   '))).toMatch(/sala:titulo/);
    expect(await rejects(apuntar(C, cita, 'Intruso'))).toMatch(/sala:placa/);
  });

  it('sin minutos juntos en esa cita, o pasadas 3 horas, no se apunta; hasta tres al día', async () => {
    const sola = await invitar(B, A, 15);
    await responder(A, sola.cita);
    await db.query('insert into sala_latidos (cita, user_id, minuto) values ($1, $2, 0)', [sola.cita, B]);
    expect(await rejects(apuntar(B, sola.cita, 'Leído a solas'))).toMatch(/sala:placa/);
    await atrasarCita(cita, 240);
    expect(await rejects(apuntar(B, cita, 'Tarde'))).toMatch(/sala:placa/);
    await atrasarCita(cita, -240);
    await apuntar(B, cita, 'Uno');
    await apuntar(B, cita, 'Dos');
    await apuntar(B, cita, 'Tres');
    expect(await rejects(apuntar(B, cita, 'Cuatro'))).toMatch(/sala:hoy/);
  });

  it('con un bloqueo, la placa desaparece para los dos', async () => {
    await db.query('insert into blocks (blocker, blocked) values ($1, $2)', [B, A]);
    expect((await placas(A)).map((p) => p.uid)).toEqual([D]);
    expect(await placas(B)).toEqual([]);
  });
});
