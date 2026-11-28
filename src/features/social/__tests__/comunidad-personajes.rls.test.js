// 1.165 · El busto del personaje como avatar en la Comunidad: el aspecto de cualquiera de la comunidad, aunque sea de otro
// edificio; nada más de su piso, y de nadie con la comunidad apagada ni bloqueado. Postgres real (PGlite) con todas las
// migraciones.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, juntarComoAntes } from './supabaseHarness';
import { DEFAULT_AVATAR } from '../../edificio/actor';
import { starterRoom } from '../../edificio/demo';

let db;
let A, B, C, D, E;
const personajes = (u, ids) => as(db, u, (q) => q('select comunidad_personajes($1::uuid[]) as r', [ids])).then((r) => r[0].r);

beforeAll(async () => {
  db = await createDatabase();
  const users = await createUsers(db, 8);
  // Seis por edificio: B queda en otro
  [A, C, D, E, , , B] = users;
  for (const [i, u] of users.entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lector ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    if (u !== E) await as(db, u, (q) => q('insert into pisos (layout, personaje) values ($1::jsonb, $2::jsonb)', [JSON.stringify(starterRoom()), JSON.stringify({ ...DEFAULT_AVATAR, jersey: i % 5 })]));
  }
  await juntarComoAntes(db, [...users]);
  // D apaga la comunidad después de tener su piso
  await as(db, D, (q) => q('update profiles set community_enabled = false where user_id = auth.uid()'));
});

describe('comunidad_personajes', () => {
  it('da el aspecto de quien es de otro edificio, y nada más de su piso', async () => {
    const filas = await personajes(A, [A, B, C]);
    expect(filas.map((f) => f.user_id).sort()).toEqual([A, B, C].sort());
    expect(Object.keys(filas[0]).sort()).toEqual(['personaje', 'user_id']);
    expect(filas.find((f) => f.user_id === B).personaje).toMatchObject({ pelo: DEFAULT_AVATAR.pelo });
    // Sigue sin poder leer su piso
    expect(await as(db, A, (q) => q('select user_id from pisos where user_id = $1', [B]))).toHaveLength(0);
  });

  it('no da a quien tiene la comunidad apagada ni a quien no tiene piso', async () => {
    expect(await personajes(A, [D, E])).toEqual([]);
  });

  it('con la comunidad apagada, solo el tuyo', async () => {
    expect((await personajes(D, [D, A, B])).map((f) => f.user_id)).toEqual([D]);
  });

  it('no da a quien tienes bloqueado ni a quien te ha bloqueado', async () => {
    await as(db, A, (q) => q('insert into blocks (blocked) values ($1)', [B]));
    expect(await personajes(A, [B])).toEqual([]);
    expect(await personajes(B, [A])).toEqual([]);
    await as(db, A, (q) => q('delete from blocks where blocked = $1', [B]));
    expect(await personajes(B, [A])).toHaveLength(1);
  });

  it('el anónimo no puede llamarla', async () => {
    const { rows } = await db.query("select has_function_privilege('anon', 'public.comunidad_personajes(uuid[])', 'execute') as puede");
    expect(rows[0].puede).toBe(false);
  });
});
