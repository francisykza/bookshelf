// 1.86 · Talleres y tablón «Se busca» en un Postgres real (PGlite): la placa y los sellos se recogen una vez y solo con el taller
// completo, y el tablón deja marcar tres muebles, sin texto, y respeta los bloqueos.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { CATALOG } from '../catalog';
import { rarezaOf } from '../economy';
import { createRoom } from '../room';
import { PREMIO_TALLER, TALLERES, placaDe } from '../talleres';

const DIR = join(import.meta.dirname, '..', '..', '..', '..', 'supabase', 'migrations');
const FILES = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

let db;
let A, B, C;
const call = (u, sql, args = []) => as(db, u, (q) => q(sql, args)).then((r) => Object.values(r[0])[0]);
const lonja = (u) => call(u, 'select piso_lonja()');
const recoger = (u, t) => call(u, 'select piso_taller_recoger($1)', [t]);
const buscar = (u, m, quiere = true) => call(u, 'select piso_lonja_buscar($1, $2)', [m, quiere]);
const dar = (u, m, n = 1) => db.query('insert into piso_inventario (user_id, mueble, copias) values ($1, $2, $3) on conflict (user_id, mueble) do update set copias = $3', [u, m, n]);
const faro = TALLERES.find((t) => t.id === 'faro');

beforeAll(async () => {
  db = await createDatabase(FILES.length);
  [A, B, C] = await createUsers(db, 3);
  for (const [i, u] of [A, B, C].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Vecino ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await as(db, u, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify({ ...createRoom(), items: [] })]));
    await lonja(u);
  }
  await db.query("update profiles set created_at = now() - interval '30 days'");
}, 60000);

beforeEach(async () => {
  await db.query('delete from piso_taller_placas');
  await db.query('delete from piso_lonja_buscados');
  await db.query('update piso_inventario set copias = 0');
  await db.query('update piso_lonja_cuenta set sellos = 0');
});

describe('los talleres', () => {
  it('son los de la pantalla y cada mueble de la tienda está en uno, y solo en uno', async () => {
    const { rows } = await db.query('select piso_talleres() as t');
    expect(rows[0].t).toEqual(TALLERES.map(({ id, muebles }) => ({ id, muebles })));
    const todos = TALLERES.flatMap((t) => t.muebles).sort();
    expect(new Set(todos).size).toBe(todos.length);
    const validos = await db.query("select id from piso_catalogo where saga is null and rareza in ('comun', 'poco-comun', 'raro') and id <> all (piso_lonja_mascotas()) order by id");
    expect(todos).toEqual(validos.rows.map((r) => r.id).sort());
    for (const t of TALLERES) expect(rarezaOf(CATALOG.find((c) => c.id === placaDe(t.id)))).toBe('especial');
  });

  it('dice lo que falta y sin el taller completo no hay placa', async () => {
    await dar(A, faro.muebles[0]);
    const t = (await lonja(A)).talleres.find((x) => x.id === 'faro');
    expect(t.faltan).toHaveLength(faro.muebles.length - 1);
    expect(t.faltan).not.toContain(faro.muebles[0]);
    expect(await rejects(recoger(A, 'faro'))).toMatch(/te faltan/);
    expect(await rejects(recoger(A, 'inventado'))).toMatch(/no existe/);
  });

  it('completo da la placa y los sellos una vez, sin tickets, aunque luego se venda algo', async () => {
    const antes = (await lonja(A)).tickets;
    for (const m of faro.muebles) await dar(A, m);
    const l = await recoger(A, 'faro');
    expect(l.sellos).toBe(PREMIO_TALLER);
    expect(l.tickets).toBe(antes);
    expect(l.talleres.find((x) => x.id === 'faro')).toMatchObject({ recogido: true, faltan: [] });
    const { rows } = await db.query("select copias from piso_inventario where user_id = $1 and mueble = 'placa-faro'", [A]);
    expect(rows[0].copias).toBe(1);
    expect(await rejects(recoger(A, 'faro'))).toMatch(/ya es tuya/);
    await dar(A, faro.muebles[0], 0);
    expect((await lonja(A)).talleres.find((x) => x.id === 'faro').recogido).toBe(true);
  });

  it('la placa no se recicla ni se pone en la Lonja', async () => {
    for (const m of faro.muebles) await dar(A, m);
    await recoger(A, 'faro');
    expect(await rejects(call(A, "select piso_reciclar('placa-faro')"))).toMatch(/no se puede reciclar/);
    expect(await rejects(call(A, "select piso_lonja_poner('placa-faro', null, 10, null)"))).toBeTruthy();
    expect(await rejects(call(A, "select piso_comprar('placa-faro')"))).toMatch(/no se vende/);
  });
});

describe('el tablón «Se busca»', () => {
  it('cada cual marca hasta tres muebles y los puede quitar', async () => {
    const [a, b, c, d] = faro.muebles;
    await buscar(A, a);
    await buscar(A, b);
    expect((await buscar(A, c)).buscas).toEqual([a, b, c]);
    expect(await rejects(buscar(A, d))).toMatch(/hasta tres/);
    await buscar(A, a);
    expect((await buscar(A, b, false)).buscas).toHaveLength(2);
    expect((await buscar(A, d)).buscas).toContain(d);
  });

  it('solo se busca lo que se puede cambiar en la Lonja', async () => {
    for (const m of ['perrito', 'dragoncillo', 'farol-azul', 'brasero', 'placa-faro', 'no-existe']) expect(await rejects(buscar(A, m))).toMatch(/no se busca/);
  });

  it('los vecinos ven qué se busca, quién y si tienen copia; lo propio no sale', async () => {
    const m = faro.muebles[0];
    await buscar(A, m);
    await buscar(B, m);
    expect((await lonja(A)).tablon[0]).toMatchObject({ mueble: m, cuantos: 1, quienes: ['Vecino 1'] });
    let [e] = (await lonja(C)).tablon;
    expect(e).toMatchObject({ mueble: m, cuantos: 2, tienes: false });
    expect(e.quienes.sort()).toEqual(['Vecino 0', 'Vecino 1']);
    await dar(C, m, 2);
    [e] = (await lonja(C)).tablon;
    expect(e.tienes).toBe(true);
  });

  it('quien bloquea no aparece y lo viejo caduca', async () => {
    const m = faro.muebles[1];
    await buscar(A, m);
    await db.query('insert into blocks (blocker, blocked) values ($1, $2)', [C, A]);
    expect((await lonja(C)).tablon).toEqual([]);
    await db.query('delete from blocks');
    expect((await lonja(C)).tablon).toHaveLength(1);
    await db.query("update piso_lonja_buscados set creado = now() - interval '31 days'");
    expect((await lonja(C)).tablon).toEqual([]);
    expect((await lonja(A)).buscas).toEqual([]);
  });
});

it('las tablas no se tocan directamente y el anónimo no llama a nada', async () => {
  for (const t of ['piso_taller_placas', 'piso_lonja_buscados']) expect(await rejects(as(db, A, (q) => q(`select * from ${t}`)))).toMatch(/permission denied/);
  for (const f of ['piso_lonja_buscar(text, boolean)', 'piso_taller_recoger(text)']) {
    const { rows } = await db.query("select has_function_privilege('anon', $1, 'execute') as p", [`public.${f}`]);
    expect(rows[0].p).toBe(false);
  }
  const { rows } = await db.query("select has_function_privilege('authenticated', 'public.piso_talleres_de(uuid)', 'execute') as p");
  expect(rows[0].p).toBe(false);
});
