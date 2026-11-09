// Lo expuesto en la estantería: quién lo puede leer y qué se guarda, sobre Postgres real (PGlite) con todas las migraciones
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';

let db;
let A, B, C, Z;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const publicar = (u, lista) => call(u, 'select piso_publicar_expuestos($1::jsonb)', [JSON.stringify(lista)]);
const leer = (u, l) => call(u, 'select piso_expuestos_de($1)', [l]);

beforeAll(async () => {
  db = await createDatabase();
  [A, B, C, Z] = await createUsers(db, 4);
  for (const [i, u] of [A, B, C, Z].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lector ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
  }
  await as(db, C, (q) => q('insert into blocks (blocked) values ($1)', [A]));
  const { rows } = await db.query('select edificio from edificio_vecinos where user_id = $1', [A]);
  await db.query('insert into edificios default values');
  await db.query('update edificio_vecinos set edificio = (select id from edificios where id <> $1 order by id limit 1) where user_id = $2', [rows[0].edificio, Z]);
}, 60000);

describe('libros expuestos', () => {
  it('quien vive en tu edificio ve lo expuesto, limpio y en orden', async () => {
    await publicar(A, [
      { id: '1', title: ' Primero ', author: 'Ana', cover: 'https://a.test/1.jpg', notas: 'privado' },
      { id: '2', title: 'Segundo', cover: 'data:image/png;base64,xx' },
      { id: '3', title: '   ' },
    ]);
    expect(await leer(B, A)).toEqual([
      { id: '1', title: 'Primero', author: 'Ana', cover: 'https://a.test/1.jpg' },
      { id: '2', title: 'Segundo', author: '', cover: '' },
    ]);
  });

  it('sin relación o con bloqueo no se ve nada, y publicar otra vez sustituye', async () => {
    expect(await leer(Z, A)).toEqual([]);
    expect(await leer(C, A)).toEqual([]);
    await publicar(A, [{ id: '9', title: 'Otro' }]);
    expect((await leer(B, A)).map((l) => l.id)).toEqual(['9']);
  });

  it('la tabla no se lee ni se escribe directamente, y nadie publica sin sesión', async () => {
    await rejects(as(db, B, (q) => q('select * from piso_expuestos')));
    await rejects(as(db, B, (q) => q("insert into piso_expuestos (user_id) values ($1)", [B])));
    await rejects(publicar(null, []));
  });
});
