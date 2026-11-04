// 1.86 · Acabados de los muebles en un Postgres real (PGlite): quién los tiene, cómo salen de los sobres y que una copia con
// acabado nunca se pierda ni se multiplique al colocarla, reciclarla, regalarla o cambiarla en la Lonja.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { ACABADOS, ACABADO_PROB } from '../acabados';
import { createRoom } from '../room';

const DIR = join(import.meta.dirname, '..', '..', '..', '..', 'supabase', 'migrations');
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

let db;
let A, B;

const call = (u, sql, args = []) => as(db, u, (q) => q(sql, args)).then((r) => Object.values(r[0])[0]);
const inventario = (u) => call(u, 'select piso_mi_inventario()');
const dar = async (u, mueble, copias, acabado = null, n = 0) => {
  await db.query('delete from piso_acabados where user_id = $1 and mueble = $2', [u, mueble]);
  await db.query('insert into piso_inventario (user_id, mueble, copias) values ($1, $2, $3) on conflict (user_id, mueble) do update set copias = excluded.copias', [u, mueble, copias]);
  if (acabado) await db.query('insert into piso_acabados (user_id, mueble, acabado, copias) values ($1, $2, $3, $4) on conflict (user_id, mueble, acabado) do update set copias = excluded.copias', [u, mueble, acabado, n]);
};
const tickets = (u, n) => db.query('update piso_cuentas set tickets = $2 where user_id = $1', [u, n]);
const piso = (u) => db.query('select layout from pisos where user_id = $1', [u]).then((r) => r.rows[0].layout);
const guardar = (u, layout) => as(db, u, (q) => q('update pisos set layout = $1::jsonb where user_id = $2', [JSON.stringify(layout), u]));
const conMueble = (layout, item) => ({ ...layout, items: [...layout.items, item] });
const hueco = (layout, extra) => ({ uid: 900 + layout.items.length, id: 'silla', x: 0, y: 0, rot: 0, tono: 0, ...extra });

beforeAll(async () => {
  db = await createDatabase(FILES.length);
  [A, B] = await createUsers(db, 2);
  for (const [i, u] of [A, B].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Vecino ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await as(db, u, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(createRoom())]));
    await inventario(u);
  }
  // Cuentas con antigüedad, para que la Lonja las deje poner puesto
  await db.query("update profiles set created_at = now() - interval '30 days'");
}, 60000);

describe('la tabla', () => {
  it('no se puede leer ni escribir directamente', async () => {
    expect(await rejects(as(db, A, (q) => q('select * from piso_acabados')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q("insert into piso_acabados (user_id, mueble, acabado, copias) values ($1, 'silla', 'nacar', 1)", [A])))).toMatch(/permission denied/);
  });

  it('las funciones internas no se pueden llamar desde fuera', async () => {
    expect(await rejects(call(A, "select piso_acabado_sumar($1, 'silla', 'nacar', 1)", [A]))).toMatch(/permission denied/);
  });

  it('lo que ya se tenía sigue liso', async () => {
    expect((await inventario(A)).acabados).toEqual({});
  });
});

describe('los sobres', () => {
  it('salen con la probabilidad anunciada y solo en lo que admite acabado', async () => {
    await tickets(A, 100000);
    let total = 0;
    const vistos = {};
    for (let i = 0; i < 300; i += 1) {
      const r = await call(A, "select piso_abrir_sobre('coleccion', 5)");
      for (const p of r.premios) {
        total += 1;
        if (!p.acabado) continue;
        vistos[p.acabado] = (vistos[p.acabado] ?? 0) + 1;
        expect(['comun', 'poco-comun', 'raro']).toContain(p.rareza);
        expect(p.mueble).not.toBe('perrito');
      }
    }
    const salidos = Object.values(vistos).reduce((a, b) => a + b, 0);
    // 1500 copias al 5 %: unas 75; el margen cubre de sobra el azar
    expect(salidos / total).toBeGreaterThan(ACABADO_PROB * 0.5);
    expect(salidos / total).toBeLessThan(ACABADO_PROB * 1.6);
    expect(Object.keys(vistos).every((k) => ACABADOS.some((a) => a.id === k))).toBe(true);
    const inv = await inventario(A);
    const guardados = Object.values(inv.acabados).flatMap((x) => Object.values(x)).reduce((a, b) => a + b, 0);
    expect(guardados).toBe(salidos);
  }, 60000);

  it('la probabilidad y los pesos son los del servidor', async () => {
    expect(ACABADO_PROB).toBe(0.05);
    expect(ACABADOS.map((a) => [a.id, a.peso])).toEqual([['salitre', 45], ['sol-de-tarde', 30], ['lacado', 20], ['nacar', 5]]);
  });
});

describe('colocar', () => {
  it('solo se coloca el acabado que tienes, y no más copias de las que hay', async () => {
    await dar(B, 'silla', 2, 'lacado', 1);
    const base = await piso(B);
    await guardar(B, conMueble(base, hueco(base, { acabado: 'lacado' })));
    expect((await piso(B)).items.at(-1).acabado).toBe('lacado');
    const uno = await piso(B);
    expect(await rejects(guardar(B, conMueble(uno, hueco(uno, { x: 1, acabado: 'lacado' }))))).toMatch(/copias suficientes/);
    expect(await rejects(guardar(B, conMueble(uno, hueco(uno, { x: 1, acabado: 'nacar' }))))).toMatch(/copias suficientes/);
    await guardar(B, conMueble(uno, hueco(uno, { x: 1 })));
    const dos = await piso(B);
    // Dos copias: una lacada y una lisa, ya puestas; una tercera lisa no existe
    expect(await rejects(guardar(B, conMueble(dos, hueco(dos, { x: 2 }))))).toMatch(/copias suficientes/);
    await guardar(B, { ...dos, items: dos.items.filter((i) => i.id !== 'silla') });
  });
});

describe('reciclar', () => {
  it('nunca se lleva una copia con acabado', async () => {
    await dar(B, 'mesilla', 2, 'nacar', 1);
    await call(B, "select piso_reciclar('mesilla')");
    const inv = await inventario(B);
    expect(inv.copias.mesilla).toBe(1);
    expect(inv.acabados.mesilla).toEqual({ nacar: 1 });
    expect(await rejects(call(B, "select piso_reciclar('mesilla')"))).toMatch(/acabado no se reciclan/);
  });
});

describe('regalar', () => {
  it('la copia conserva su acabado', async () => {
    await dar(A, 'banco', 2, 'sol-de-tarde', 1);
    await dar(B, 'banco', 0);
    await call(A, "select piso_regalar($1, 'banco', 'sol-de-tarde')", [B]);
    const [a, b] = [await inventario(A), await inventario(B)];
    expect(a.copias.banco).toBe(1);
    expect(a.acabados.banco?.['sol-de-tarde'] ?? 0).toBe(0);
    expect(b.copias.banco).toBe(1);
    expect(b.acabados.banco).toEqual({ 'sol-de-tarde': 1 });
  });

  it('no se regala un acabado que no tienes', async () => {
    await db.query('delete from piso_regalos');
    await dar(A, 'puf', 2);
    expect(await rejects(call(A, "select piso_regalar($1, 'puf', 'nacar')", [B]))).toMatch(/copias libres/);
  });
});

describe('la Lonja', () => {
  it('se vende con su acabado, por encima del tope liso, y llega entero', async () => {
    await dar(A, 'silla', 3, 'salitre', 1);
    await tickets(B, 100);
    expect(await rejects(call(A, "select piso_lonja_poner('silla', null, 41, null, 'salitre')"))).toMatch(/entre 5 y 40/);
    expect(await rejects(call(A, "select piso_lonja_poner('silla', null, 21, null, null)"))).toMatch(/entre 5 y 20/);
    const r = await call(A, "select piso_lonja_poner('silla', null, 40, null, 'salitre')");
    const oferta = r.mias[0];
    expect(oferta).toMatchObject({ da: 'silla', acabado: 'salitre' });
    expect((await inventario(A)).acabados.silla?.salitre ?? 0).toBe(0);
    const vista = await call(B, 'select piso_lonja()');
    expect(vista.puestos.find((p) => p.id === oferta.id).acabado).toBe('salitre');
    await call(B, 'select piso_lonja_aceptar($1)', [oferta.id]);
    expect((await inventario(B)).acabados.silla.salitre).toBe(1);
  });

  it('al retirar la oferta, vuelve con su acabado', async () => {
    await dar(A, 'mesa', 2, 'lacado', 1);
    const r = await call(A, "select piso_lonja_poner('mesa', null, 30, null, 'lacado')");
    await call(A, 'select piso_lonja_retirar($1)', [r.mias.find((o) => o.da === 'mesa').id]);
    const inv = await inventario(A);
    expect(inv.copias.mesa).toBe(2);
    expect(inv.acabados.mesa).toEqual({ lacado: 1 });
  });

  it('no deja ofrecer un acabado que no tienes, ni de una copia recién comprada', async () => {
    expect(await rejects(call(A, "select piso_lonja_poner('mesa', null, 30, null, 'nacar')"))).toMatch(/copias libres/);
    expect(await rejects(call(B, "select piso_lonja_poner('silla', null, 30, null, 'salitre')"))).toMatch(/copias libres/);
  });
});
