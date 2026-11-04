// 1.86 · La estiba en un Postgres real (PGlite): la bodega del día siempre tiene carga perfecta, el servidor comprueba lo que se
// carga y da los sellos una vez al día, y la pared canjea sin tocar los tickets.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { ACABADOS } from '../acabados';
import { ROPA_ESTIBA } from '../actor';
import { CATALOG } from '../catalog';
import { PARED, cabe, girar, huecosLlenos, nivelDe } from '../hotel/estiba';
import { createRoom } from '../room';

const DIR = join(import.meta.dirname, '..', '..', '..', '..', 'supabase', 'migrations');
const FILES = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

let db;
let A, B;
const call = (u, sql, args = []) => as(db, u, (q) => q(sql, args)).then((r) => Object.values(r[0])[0]);
const lonja = (u) => call(u, 'select piso_lonja()');
const zarpar = (u, carga) => call(u, 'select piso_estiba_zarpar($1::jsonb)', [JSON.stringify(carga)]);
const canjear = (u, que) => call(u, 'select piso_lonja_canjear($1)', [que]);
const sellos = (u, n) => db.query('update piso_lonja_cuenta set sellos = $2 where user_id = $1', [u, n]);
const dar = (u, m, n) => db.query('insert into piso_inventario (user_id, mueble, copias) values ($1, $2, $3) on conflict (user_id, mueble) do update set copias = $3', [u, m, n]);

/** Resuelve la bodega con las reglas de la pantalla: si hay solución, también la acepta el juego. Cada colocación, un bit por hueco. */
function resolver(b) {
  const bit = (x, y) => 1n << BigInt(y * b.w + x);
  const lleno = b.bloqueadas.reduce((m, [x, y]) => m | bit(x, y), 0n);
  const opciones = new Map();
  for (const p of b.piezas) {
    const vistas = new Set();
    for (let rot = 0; rot < 4; rot += 1) {
      const forma = girar(p.celdas, rot);
      if (vistas.has(JSON.stringify(forma))) continue;
      vistas.add(JSON.stringify(forma));
      for (let y = 0; y < b.h; y += 1) {
        for (let x = 0; x < b.w; x += 1) {
          if (!cabe(b, [], p, x, y, rot)) continue;
          const mask = forma.reduce((m, [a, d]) => m | bit(x + a, y + d), 0n);
          const primero = forma[0];
          const clave = (y + primero[1]) * b.w + x + primero[0];
          if (!opciones.has(clave)) opciones.set(clave, []);
          opciones.get(clave).push({ pieza: p.id, x, y, rot, mask });
        }
      }
    }
  }
  const carga = [];
  const usadas = new Set();
  const paso = (m) => {
    if (carga.length === b.piezas.length) return true;
    let hueco = 0;
    while (m & (1n << BigInt(hueco))) hueco += 1;
    for (const o of opciones.get(hueco) ?? []) {
      if (usadas.has(o.pieza) || m & o.mask) continue;
      usadas.add(o.pieza);
      carga.push({ pieza: o.pieza, x: o.x, y: o.y, rot: o.rot });
      if (paso(m | o.mask)) return true;
      carga.pop();
      usadas.delete(o.pieza);
    }
    return false;
  };
  return paso(lleno) ? carga : null;
}

beforeAll(async () => {
  db = await createDatabase(FILES.length);
  [A, B] = await createUsers(db, 2);
  for (const [i, u] of [A, B].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Estibador ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await as(db, u, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(createRoom())]));
    await lonja(u);
  }
  await db.query("update profiles set created_at = now() - interval '30 days'");
}, 60000);

beforeEach(async () => {
  await db.query('delete from piso_lonja_estiba');
  await db.query('update piso_lonja_cuenta set sellos = 0');
  await db.query('insert into piso_cuentas (user_id, tickets) values ($1, 100), ($2, 100) on conflict (user_id) do update set tickets = 100', [A, B]);
});

describe('la bodega del día', () => {
  it('es la misma para todo el mundo y cambia con el día', async () => {
    const [a, b] = [(await lonja(A)).estiba, (await lonja(B)).estiba];
    expect(a.piezas).toEqual(b.piezas);
    const { rows } = await db.query('select piso_estiba_bodega(current_date + 1) as m');
    expect(rows[0].m.piezas).not.toEqual(a.piezas);
  });

  it('siempre se puede cargar entera, con bultos de buen tamaño', async () => {
    for (let d = 0; d < 40; d += 1) {
      const { rows } = await db.query('select piso_estiba_bodega(current_date + $1::integer) as b', [d]);
      const b = { ...rows[0].b, niveles: [] };
      expect(b.piezas.reduce((n, p) => n + p.celdas.length, 0)).toBe(b.total);
      expect(b.total + b.bloqueadas.length).toBe(b.w * b.h);
      expect(b.piezas.length).toBeGreaterThanOrEqual(7);
      expect(b.piezas.length).toBeLessThanOrEqual(15);
      expect(Math.max(...b.piezas.map((p) => p.celdas.length))).toBeLessThanOrEqual(7);
      const carga = resolver(b);
      expect(carga, `día +${d}`).not.toBeNull();
      expect(huecosLlenos(b, carga)).toBe(b.total);
    }
  });

  it('el giro de la pantalla es el del servidor', async () => {
    const forma = [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
    ];
    for (let rot = 0; rot < 4; rot += 1) {
      const { rows } = await db.query('select piso_estiba_girar($1::jsonb, $2) as g', [JSON.stringify(forma), rot]);
      expect(rows[0].g).toEqual(girar(forma, rot));
    }
  });
});

describe('zarpar', () => {
  it('la carga perfecta da 7 sellos, ningún ticket y una vez al día', async () => {
    const { estiba } = await lonja(A);
    const carga = resolver(estiba);
    const l = await zarpar(A, carga);
    expect(l.sellos).toBe(7);
    expect(l.tickets).toBe(100);
    expect(l.estiba.hecha).toMatchObject({ celdas: estiba.total, total: estiba.total, sellos: 7 });
    expect(l.estiba.hecha.carga).toEqual(carga);
    expect(await rejects(zarpar(A, carga))).toMatch(/ya ha zarpado/);
    expect((await lonja(A)).sellos).toBe(7);
  });

  it('los niveles son los que se enseñan y los calcula igual la pantalla', async () => {
    const { estiba } = await lonja(A);
    const carga = resolver(estiba);
    for (const corte of [0.3, 0.6]) {
      await db.query('delete from piso_lonja_estiba');
      const parte = [];
      for (const c of carga) if (huecosLlenos(estiba, parte) < estiba.total * corte) parte.push(c);
      const celdas = huecosLlenos(estiba, parte);
      const l = await zarpar(A, parte);
      expect(l.estiba.hecha.celdas).toBe(celdas);
      expect(l.estiba.hecha.sellos).toBe(nivelDe(estiba, celdas).sellos);
    }
    expect(nivelDe(estiba, 1).sellos).toBe(1);
    expect(nivelDe(estiba, Math.ceil(estiba.total / 2)).sellos).toBe(2);
    expect(nivelDe(estiba, Math.ceil(estiba.total * 0.8)).sellos).toBe(4);
    expect(nivelDe(estiba, estiba.total).sellos).toBe(7);
  });

  it('no se cuela nada: fuera, encima, repetido, ajeno o mal escrito', async () => {
    const { estiba } = await lonja(A);
    const carga = resolver(estiba);
    const [p, q] = carga;
    expect(await rejects(zarpar(A, []))).toMatch(/no vale/);
    expect(await rejects(zarpar(A, { a: 1 }))).toMatch(/no vale/);
    expect(await rejects(zarpar(A, [{ ...p, x: 20 }]))).toMatch(/fuera/);
    expect(await rejects(zarpar(A, [{ ...p, x: -3 }]))).toMatch(/fuera/);
    expect(await rejects(zarpar(A, [p, { ...q, x: p.x, y: p.y }]))).toMatch(/mismo sitio|fuera/);
    expect(await rejects(zarpar(A, [p, p]))).toMatch(/no es de esta bodega/);
    expect(await rejects(zarpar(A, [{ ...p, pieza: 99 }]))).toMatch(/no es de esta bodega/);
    expect(await rejects(zarpar(A, [{ ...p, rot: 4 }]))).toMatch(/no vale/);
    expect(await rejects(zarpar(A, [{ ...p, x: 1.5 }]))).toMatch(/no vale/);
    const [bx, by] = estiba.bloqueadas[0];
    expect(await rejects(zarpar(A, [{ pieza: p.pieza, x: bx, y: by, rot: 0 }]))).toMatch(/fuera/);
    expect((await lonja(A)).sellos).toBe(0);
  });

  it('la pesada queda cerrada y su tabla no se borra', async () => {
    expect(await rejects(call(A, 'select piso_lonja_pesar($1::integer[], $2::integer[])', [[1], [2]]))).toMatch(/permission denied/);
    expect(await rejects(call(A, 'select piso_lonja_senalar($1)', [1]))).toMatch(/permission denied/);
    expect((await lonja(A)).juego).toBeTruthy();
  });
});

describe('la pared de premios', () => {
  it('los precios y la ropa son los de la pantalla', async () => {
    const { estiba } = await lonja(A);
    expect(Object.fromEntries(estiba.pared.map((a) => [a.id, a.precio]))).toEqual(Object.fromEntries(PARED.map((a) => [a.id, a.precio])));
    expect(Object.keys(estiba.acabados).sort()).toEqual(ACABADOS.map((a) => a.id).sort());
    expect([...ROPA_ESTIBA].sort()).toEqual(
      PARED.filter((a) => a.tipo === 'prenda')
        .map((a) => a.id)
        .sort(),
    );
  });

  it('la ropa llega al armario, una vez, y sin ella no se viste', async () => {
    const puesto = (jersey) =>
      as(db, A, (q) => q('update pisos set personaje = $1::jsonb', [JSON.stringify({ piel: 1, pelo: 'melena', colorPelo: 1, jersey, pantalon: 0, gafas: false, complemento: 'ninguno' })]));
    expect(await rejects(puesto(17))).toMatch(/pared de la Lonja/);
    await sellos(A, 40);
    const l = await canjear(A, 'jersey:17');
    expect(l.sellos).toBe(4);
    expect(l.estiba.pared.find((a) => a.id === 'jersey:17').tienes).toBe(true);
    await puesto(17);
    await sellos(A, 40);
    expect(await rejects(canjear(A, 'jersey:17'))).toMatch(/ya lo tienes/);
  });

  it('la gaviota te acompaña, no se recicla ni sale en sobres, y sin sellos no llega', async () => {
    await sellos(A, 100);
    expect(await rejects(canjear(A, 'gaviota-puerto'))).toMatch(/faltan sellos/);
    await sellos(A, 120);
    await canjear(A, 'gaviota-puerto');
    await as(db, A, (q) => q("update pisos set companero = 'gaviota-puerto'"));
    const { rows } = await db.query("select count(*)::integer as n from generate_series(1, 200) g, lateral (select piso_al_azar('legendario', null) as m, g) s where s.m = 'gaviota-puerto'");
    expect(rows[0].n).toBe(0);
    expect(CATALOG.find((c) => c.id === 'gaviota-puerto')).toMatchObject({ rareza: 'legendario', compania: true, casino: true });
  });

  it('un acabado concreto se pone en una copia lisa libre, sin azar y con su precio', async () => {
    const { rows } = await db.query("select id from piso_catalogo where rareza = 'comun' and saga is null order by id limit 1");
    const m = rows[0].id;
    await db.query('delete from piso_acabados where user_id = $1', [A]);
    await dar(A, m, 2);
    await sellos(A, 110);
    const l = await canjear(A, `acabado:nacar:${m}`);
    expect(l.sellos).toBe(10);
    expect(l.libresAcabado).toContainEqual({ mueble: m, acabado: 'nacar', libres: 1 });
    expect((await db.query('select copias from piso_inventario where user_id = $1 and mueble = $2', [A, m])).rows[0].copias).toBe(2);
    expect(await rejects(canjear(A, `acabado:oro:${m}`))).toMatch(/no existe/);
    expect(await rejects(canjear(A, 'acabado:salitre:gaviota-puerto'))).toMatch(/no admite/);
    await sellos(A, 200);
    await canjear(A, `acabado:salitre:${m}`);
    expect(await rejects(canjear(A, `acabado:salitre:${m}`))).toMatch(/copia lisa/);
  });

  it('sigue sin dar tickets', async () => {
    await sellos(A, 300);
    expect(await rejects(canjear(A, 'tickets'))).toMatch(/no se canjea/);
    expect(await rejects(canjear(A, 'acabado'))).toBeTruthy();
    expect((await lonja(A)).tickets).toBe(100);
  });
});

it('la tabla no se toca directamente y el anónimo no zarpa', async () => {
  expect(await rejects(as(db, A, (q) => q('select * from piso_lonja_estiba')))).toMatch(/permission denied/);
  for (const [rol, f, puede] of [
    ['anon', 'piso_estiba_zarpar(jsonb)', false],
    ['authenticated', 'piso_estiba_zarpar(jsonb)', true],
    ['authenticated', 'piso_estiba(uuid)', false],
    ['authenticated', 'piso_estiba_bodega(date)', false],
  ]) {
    const { rows } = await db.query('select has_function_privilege($1, $2, $3) as p', [rol, `public.${f}`, 'execute']);
    expect(rows[0].p).toBe(puede);
  }
});
