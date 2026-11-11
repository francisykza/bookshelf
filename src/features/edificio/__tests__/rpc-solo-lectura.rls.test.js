// PostgREST ejecuta las funciones `stable` e `immutable` en una transacción de solo lectura. Si una de ellas llama a
// piso_yo() (que escribe: asegura el inventario), en producción falla siempre, aunque en PGlite funcione. Pasó con la
// ruleta del casino (arreglado en 20261205120000_casino_ruleta_volatil.sql).
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers } from '../../social/__tests__/supabaseHarness';

let db;
let A;

beforeAll(async () => {
  db = await createDatabase(Infinity);
  [A] = await createUsers(db, 1);
  await as(db, A, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ('Lectora', 'gato-lector', true)"));
}, 60000);

describe('las funciones de solo lectura', () => {
  it('ninguna función stable o immutable que pueda llamar una cuenta usa piso_yo()', async () => {
    const { rows } = await db.query(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.provolatile in ('s', 'i')
        and has_function_privilege('authenticated', p.oid, 'execute')
        and p.prosrc like '%piso_yo()%'
      order by 1`);
    expect(rows.map((r) => r.proname)).toEqual([]);
  });

  it('la ruleta es volatile (PostgREST la llama en lectura y escritura) y se lee bien', async () => {
    const { rows } = await db.query("select provolatile from pg_proc where proname = 'piso_casino_ruleta'");
    expect(rows.map((r) => r.provolatile)).toEqual(['v']);
    // En solo lectura, como la llamaba PostgREST cuando era stable, piso_yo() no puede escribir
    const error = await as(db, A, async (q) => {
      await q('begin read only');
      try {
        await q('select piso_casino_ruleta(current_date)');
        return null;
      } catch (e) {
        return e.message;
      } finally {
        await q('rollback');
      }
    });
    expect(error).toMatch(/read-only/);
    const r = await as(db, A, (q) => q('select piso_casino_ruleta(current_date) as r')).then((x) => x[0].r);
    expect(r.casillas.length).toBeGreaterThan(0);
    expect(r.giro).toBeNull();
  });
});
