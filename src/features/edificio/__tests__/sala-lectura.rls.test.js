// 1.83 · La sala de lectura: el personaje y el compañero de quien lee, también de otro edificio y de nadie más; la
// librería común y el saludo. Postgres real (PGlite) con todas las migraciones.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { DEFAULT_AVATAR } from '../actor';
import { starterRoom } from '../demo';

let db;
let A, B, C;
const personajes = (u, ids) => as(db, u, (q) => q('select sala_lectura_personajes($1::uuid[]) as r', [ids])).then((r) => r[0].r);
const sentar = (u) => as(db, u, (q) => q('insert into reading_presence (share_book) values (false)'));

beforeAll(async () => {
  db = await createDatabase();
  const users = await createUsers(db, 7);
  // Seis por edificio: el séptimo queda en otro
  [A, C, , , , , B] = users;
  for (const [i, u] of users.entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lector ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await as(db, u, (q) => q('insert into pisos (layout, personaje) values ($1::jsonb, $2::jsonb)', [JSON.stringify(starterRoom()), JSON.stringify(DEFAULT_AVATAR)]));
  }
  await sentar(A);
  await sentar(B);
});

describe('sala_lectura_personajes', () => {
  it('da el aspecto de quien lee aunque sea de otro edificio, y nada más', async () => {
    const filas = await personajes(A, [A, B]);
    expect(filas.map((f) => f.user_id).sort()).toEqual([A, B].sort());
    expect(Object.keys(filas[0]).sort()).toEqual(['companero', 'personaje', 'user_id']);
    expect(await as(db, A, (q) => q('select user_id from pisos where user_id = $1', [B]))).toHaveLength(0);
  });

  it('no da a quien no está leyendo', async () => {
    expect(await personajes(A, [C])).toEqual([]);
  });

  it('no da a quien lleva más de tres minutos sin dar señales', async () => {
    // El reloj de la tabla pone la hora del servidor: para envejecer la fila hay que apagarlo
    await db.query('alter table reading_presence disable trigger reading_presence_clock');
    await db.query("update reading_presence set last_seen = now() - interval '4 minutes' where user_id = $1", [B]);
    expect(await personajes(A, [B])).toEqual([]);
    await db.query('update reading_presence set last_seen = now() where user_id = $1', [B]);
    await db.query('alter table reading_presence enable trigger reading_presence_clock');
  });

  it('no da a quien tienes bloqueado', async () => {
    await as(db, A, (q) => q('insert into blocks (blocked) values ($1)', [B]));
    expect(await personajes(A, [B])).toEqual([]);
    await as(db, A, (q) => q('delete from blocks where blocked = $1', [B]));
  });

  it('el anónimo no puede llamar a ninguna función de la sala', async () => {
    const firmas = ['sala_lectura_personajes(uuid[])', 'sala_libreria()', 'sala_lomo_dejar(text)', 'sala_lomo_retirar(uuid)', 'sala_saludar(uuid)', 'sala_saludos_nuevos()'];
    for (const f of firmas) {
      const { rows } = await db.query("select has_function_privilege('anon', $1, 'execute') as puede", [`public.${f}`]);
      expect(rows[0].puede).toBe(false);
    }
  });
});

describe('la librería de la sala', () => {
  const libreria = (u) => as(db, u, (q) => q('select sala_libreria() as r')).then((r) => r[0].r);
  const dejar = (u, titulo) => as(db, u, (q) => q('select sala_lomo_dejar($1) as r', [titulo])).then((r) => r[0].r);
  const retirar = (u, id) => as(db, u, (q) => q('select sala_lomo_retirar($1) as r', [id])).then((r) => r[0].r);

  it('deja un lomo con tu nombre, a la vista de quien es de otro edificio', async () => {
    await dejar(A, '  El faro del fin ');
    const vista = await libreria(B);
    expect(vista.lomos[0]).toMatchObject({ titulo: 'El faro del fin', alias: 'Lector 0', mio: false });
    expect(Object.keys(vista.lomos[0]).sort()).toEqual(['alias', 'id', 'mio', 'titulo']);
  });

  it('solo se deja sentado en la sala', async () => {
    expect(await rejects(dejar(C, 'Sin sentarse'))).toMatch(/sentado/);
  });

  it('cada título una vez y hasta tres al día', async () => {
    await dejar(A, 'el faro del fin');
    expect((await libreria(A)).total).toBe(1);
    await dejar(A, 'Segundo');
    await dejar(A, 'Tercero');
    expect(await rejects(dejar(A, 'Cuarto'))).toMatch(/tres lomos/);
  });

  it('solo quien lo dejó lo retira', async () => {
    const { lomos } = await libreria(A);
    const uno = lomos.find((l) => l.titulo === 'Tercero');
    await retirar(B, uno.id);
    expect((await libreria(A)).total).toBe(3);
    await retirar(A, uno.id);
    expect((await libreria(A)).total).toBe(2);
  });

  it('no se ven los lomos de quien tienes bloqueado', async () => {
    await as(db, B, (q) => q('insert into blocks (blocked) values ($1)', [A]));
    expect((await libreria(B)).total).toBe(0);
    await as(db, B, (q) => q('delete from blocks where blocked = $1', [A]));
  });

  it('las tablas no se tocan directamente', async () => {
    expect(await rejects(as(db, A, (q) => q('select * from sala_lomos')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select * from sala_saludos')))).toMatch(/permission denied/);
  });
});

describe('el saludo de la sala', () => {
  const saludar = (u, quien) => as(db, u, (q) => q('select sala_saludar($1) as r', [quien])).then((r) => r[0].r);
  const nuevos = (u) => as(db, u, (q) => q('select sala_saludos_nuevos() as r')).then((r) => r[0].r);

  it('llega una sola vez y no se repite en media hora', async () => {
    expect(await saludar(A, B)).toBe(true);
    expect(await nuevos(B)).toEqual([A]);
    expect(await nuevos(B)).toEqual([]);
    expect(await saludar(A, B)).toBe(false);
    expect(await nuevos(B)).toEqual([]);
  });

  it('solo entre dos personas sentadas, y nunca a uno mismo', async () => {
    expect(await saludar(A, C)).toBe(false);
    expect(await saludar(C, A)).toBe(false);
    expect(await saludar(A, A)).toBe(false);
  });

  it('no se saluda a quien te tiene bloqueado', async () => {
    await as(db, A, (q) => q('insert into blocks (blocked) values ($1)', [B]));
    expect(await saludar(B, A)).toBe(false);
    await as(db, A, (q) => q('delete from blocks where blocked = $1', [B]));
  });
});
