// 1.89 · En un Postgres real (PGlite): los básicos se colocan sin copia, lo demás sigue pidiéndola, y lo aparcado se admite
// solo si está bien formado. Cada cuenta escribe solo su piso.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { createRoom } from '../room';

const DIR = join(import.meta.dirname, '..', '..', '..', '..', 'supabase', 'migrations');
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

let db;
let A, B;
const guardar = (u, layout) => as(db, u, (q) => q('update pisos set layout = $1::jsonb where user_id = $2', [JSON.stringify(layout), u]));
const piso = (u) => db.query('select layout from pisos where user_id = $1', [u]).then((r) => r.rows[0].layout);
const conItems = (items, extra = {}) => ({ ...createRoom(), items, ...extra });
const item = (uid, id, x, y) => ({ uid, id, x, y, rot: 0, tono: 0 });

beforeAll(async () => {
  db = await createDatabase(FILES.length);
  [A, B] = await createUsers(db, 2);
  for (const [i, u] of [A, B].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Vecino ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await as(db, u, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(createRoom())]));
    await as(db, u, (q) => q('select piso_mi_inventario()'));
  }
  await db.query('delete from piso_inventario');
}, 60000);

describe('esenciales en el servidor', () => {
  it('un sillón, una estantería y un escritorio lisos no piden copia; el segundo y otro mueble, sí', async () => {
    const layout = conItems([item(1, 'sillon', 0, 0), item(2, 'estanteria', 3, 0), item(3, 'escritorio', 6, 0)]);
    await guardar(A, layout);
    expect((await piso(A)).items.length).toBe(3);
    expect(await rejects(guardar(A, conItems([item(1, 'sillon', 0, 0), item(2, 'sillon', 3, 3)])))).toBeTruthy();
    expect(await rejects(guardar(A, conItems([item(1, 'sofa', 0, 0)])))).toBeTruthy();
  });

  it('lo aparcado se guarda si está bien formado; lo que no, se rechaza', async () => {
    const oculto = { uid: 9, id: 'rosa-estrellas', x: 2, y: 2, rot: 0, tono: 0 };
    await guardar(A, conItems([item(1, 'sillon', 2, 2)], { ocultos: [oculto] }));
    expect((await piso(A)).ocultos).toEqual([oculto]);
    expect(await rejects(guardar(A, conItems([], { ocultos: [{ ...oculto, id: 'inventado' }] })))).toBeTruthy();
    expect(await rejects(guardar(A, conItems([], { ocultos: [{ ...oculto, raro: 1 }] })))).toBeTruthy();
    expect(await rejects(guardar(A, conItems([], { ocultos: 'x' })))).toBeTruthy();
    expect(await rejects(guardar(A, conItems([], { otra: [] })))).toBeTruthy();
  });

  it('una cuenta no puede escribir el piso de otra', async () => {
    const antes = await piso(B);
    await guardar(A, { ...conItems([]), pared: 'noche' }).catch(() => {});
    await as(db, A, (q) => q('update pisos set layout = $1::jsonb where user_id = $2', [JSON.stringify(conItems([], { pared: 'noche' })), B])).catch(() => {});
    expect(await piso(B)).toEqual(antes);
  });
});
