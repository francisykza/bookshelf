// 1.106 · Los muebles de las habitaciones especiales (hoy «Capa y Antifaz»), en un Postgres real (PGlite) con todas las
// migraciones: cuestan el doble en el almacén y en la tienda, no salen nunca en las ofertas y el albarán no les toca.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { HABITACIONES_ESPECIALES, isDeHabitacionEspecial, precioDe } from '../economy';
import { TALLERES } from '../talleres';
import { mapaOfertas } from '../hotel/ofertas';

let db;
let A;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const comprar = (u, clave, articulos, esperado, usar = false) => call(u, 'select piso_almacen_comprar($1::uuid, $2::jsonb, $3, $4)', [clave, JSON.stringify(articulos), esperado, usar]);
const tickets = (u) => db.query('select tickets from piso_cuentas where user_id = $1', [u]).then((r) => r.rows[0].tickets);
const K = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ESPECIALES = TALLERES.filter((t) => HABITACIONES_ESPECIALES.includes(t.id)).flatMap((t) => t.muebles);
const conOfertas = (lista) =>
  db.query(`create or replace function public.piso_almacen_ofertas() returns jsonb language sql stable set search_path = '' as $$ select '${JSON.stringify(lista)}'::jsonb $$`);

beforeAll(async () => {
  db = await createDatabase();
  [A] = await createUsers(db, 1);
  await as(db, A, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ('Clienta', 'gato-lector', true)"));
  await call(A, 'select piso_almacen_estado()');
  await db.query('update piso_cuentas set tickets = 500 where user_id = $1', [A]);
}, 60000);

describe('los muebles de las habitaciones especiales', () => {
  it('son los mismos en el servidor y en economy.js, y cuestan el doble: común 40, poco común 80', async () => {
    expect(ESPECIALES).toHaveLength(6);
    const { rows } = await db.query('select id, rareza, piso_de_habitacion_especial(id) as esp, piso_precio_mueble(id) as precio from piso_catalogo where saga is null');
    for (const r of rows) {
      expect(r.esp, r.id).toBe(isDeHabitacionEspecial(r.id));
      expect(r.precio, r.id).toBe(precioDe(r.id));
    }
    expect(precioDe('estanteria-comics')).toBe(40);
    expect(precioDe('sillon-capa')).toBe(80);
    expect(precioDe('placa-heroes')).toBeNull();
    expect(precioDe('sillon')).toBe(20);
  });

  it('nunca salen en las ofertas, ningún día', async () => {
    for (let d = 0; d < 60; d += 1) {
      const dia = new Date(Date.UTC(2026, 10, 1 + d)).toISOString().slice(0, 10);
      const o = (await db.query('select piso_almacen_ofertas_de($1::date) as o', [dia])).rows[0].o;
      expect(o).toHaveLength(5);
      for (const x of o) expect(ESPECIALES, dia).not.toContain(x.id);
    }
    // Y si llegara una, el cliente la ignora
    expect(mapaOfertas([{ id: 'sillon-capa', pct: 50, tipo: 'semana' }]).size).toBe(0);
  });

  it('la tienda del bajo los cobra al doble', async () => {
    const antes = await tickets(A);
    await call(A, 'select piso_comprar($1)', ['neon-rayo']);
    expect(await tickets(A)).toBe(antes - 80);
  });

  it('en el almacén, sin oferta aunque la hubiera y fuera del albarán', async () => {
    await conOfertas([{ id: 'sillon-capa', pct: 50, tipo: 'semana' }, { id: 'mesa', pct: 20, tipo: 'dia' }]);
    await call(A, "select piso_almacen_empezar('rapido')");
    await db.query("update piso_almacen_dia set marcas = '[true, true, true]'::jsonb, empezado_en = now() - interval '20 seconds' where user_id = $1", [A]);
    const carro = [{ id: 'sillon-capa', n: 1 }, { id: 'mesa', n: 2 }];
    const antes = await tickets(A);
    // Sillón 80 sin rebaja + mesas 2 × 16 = 112; el −10 % del albarán, solo sobre las mesas: 32 → −3. Total 109
    expect(await rejects(comprar(A, K(1), carro, 112 - 11, true))).toMatch(/almacen:precio/);
    expect(await rejects(comprar(A, K(1), carro, 72, true))).toMatch(/almacen:precio/);
    const r = await comprar(A, K(1), carro, 109, true);
    expect(r).toMatchObject({ subtotal: 112, ahorro: 8, pct: 10, descuento: 3, total: 109 });
    expect(await tickets(A)).toBe(antes - 109);
  });
});
