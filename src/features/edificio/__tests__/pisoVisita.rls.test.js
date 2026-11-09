// En un Postgres real (PGlite): el piso de otro lector solo llega si vive en tu edificio o le sigues, con comunidad activa y sin bloqueo.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers } from '../../social/__tests__/supabaseHarness';
import { createRoom } from '../room';

const DIR = join(import.meta.dirname, '..', '..', '..', '..', 'supabase', 'migrations');
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

let db;
let A, B, C;
const ver = async (yo, lector) => {
  let piso;
  await as(db, yo, async (q) => {
    piso = (await q('select piso_visita($1) as piso', [lector]))[0].piso;
  });
  return piso;
};

beforeAll(async () => {
  db = await createDatabase(FILES.length);
  [A, B, C] = await createUsers(db, 3);
  for (const [i, u] of [A, B, C].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lector ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await as(db, u, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(createRoom())]));
  }
  await db.query('with nuevo as (insert into edificios default values returning id) update edificio_vecinos set edificio = (select id from nuevo) where user_id = $1', [C]);
}, 60000);

describe('piso_visita', () => {
  it('una vecina se ve; alguien de otro edificio, solo si le sigues; nunca devuelve su biblioteca', async () => {
    const vecina = await ver(A, B);
    expect(vecina.user_id).toBe(B);
    expect(Object.keys(vecina).sort()).toEqual(['alias', 'avatar_id', 'layout', 'puerta', 'user_id']);
    expect(await ver(A, C)).toBeNull();
    await as(db, A, (q) => q('insert into follows (followed) values ($1)', [C]));
    expect((await ver(A, C)).user_id).toBe(C);
    // Seguir no es recíproco
    expect(await ver(C, A)).toBeNull();
  });

  it('sin comunidad activa o con bloqueo, no llega', async () => {
    await db.query('update profiles set community_enabled = false where user_id = $1', [C]);
    expect(await ver(A, C)).toBeNull();
    await db.query('update profiles set community_enabled = true where user_id = $1', [C]);
    await as(db, C, (q) => q('insert into blocks (blocked) values ($1)', [A]));
    expect(await ver(A, C)).toBeNull();
  });
});
