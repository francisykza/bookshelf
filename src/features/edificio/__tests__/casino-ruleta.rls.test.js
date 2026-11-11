// 1.109 · La ruleta de premios del casino: un giro por semana, decidido en el servidor, con las casillas y las
// probabilidades de la app. Lo repetido se cambia por fichas y las fichas de la ruleta no cuentan en el tope de la semana.
// Postgres real (PGlite) con todas las migraciones.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { DEFAULT_AVATAR, ROPA_RULETA } from '../actor';
import { catalogItem } from '../catalog';
import { starterRoom } from '../demo';
import { shapeOf } from '../furniture';
import { CASILLA_RARA, RULETA, RULETA_REPETIDO, lunesDe } from '../hotel/ruleta';
import { MISTICOS } from '../misticos';

let db;
let A, B, C;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const HOY = new Date().toISOString().slice(0, 10);
const ruleta = (u, dia = HOY) => call(u, 'select piso_casino_ruleta($1::date)', [dia]);
const girar = (u, dia = HOY) => call(u, 'select piso_casino_ruleta_girar($1::date)', [dia]);
const vestir = (u, p) => as(db, u, (q) => q('update pisos set personaje = $1::jsonb', [JSON.stringify({ ...DEFAULT_AVATAR, ...p })]));
/** Fuerza el resultado del sorteo: el próximo random() de la sesión cae en `x` (de 0 a 1). */
const amañar = (x) => db.query('select setseed($1)', [x]);
const borrarGiro = (u) => db.query('delete from piso_casino_ruleta where user_id = $1', [u]);

beforeAll(async () => {
  db = await createDatabase(Infinity);
  [A, B, C] = await createUsers(db, 3);
  for (const [i, u] of [A, B, C].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Jugador ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await as(db, u, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(starterRoom())]));
    await call(u, 'select piso_casino($1::date)', [HOY]);
  }
  await db.query('alter table pisos disable trigger pisos_rate');
}, 60000);

describe('la ruleta de premios', () => {
  it('las casillas y las probabilidades de la app son las del servidor, y suman 100', async () => {
    const r = (await db.query('select piso_casino_ruleta_casillas() as r')).rows[0].r;
    expect(r).toEqual(RULETA);
    expect(RULETA.reduce((s, c) => s + c.peso, 0)).toBe(100);
    expect((await db.query('select piso_casino_ruleta_repetido() as r')).rows[0].r).toBe(RULETA_REPETIDO);
    expect((await db.query('select piso_casino_ruleta_ropa() as r')).rows[0].r).toEqual(ROPA_RULETA);
    // Los muebles son premios de la ruleta, con su modelo, y están en el catálogo del servidor
    for (const c of RULETA.filter((x) => x.tipo === 'mueble')) {
      expect(catalogItem(c.id)).toMatchObject({ rareza: 'especial', casino: true, ruleta: true });
      expect(shapeOf(c.id, catalogItem(c.id).tonos[0]).length).toBeGreaterThan(10);
      const k = (await db.query('select rareza from piso_catalogo where id = $1', [c.id])).rows[0];
      expect(k).toEqual({ rareza: 'especial' });
    }
    // La casilla más rara: el mapache, un compañero legendario que te acompaña, con su dibujo y fuera de los sobres
    const m = RULETA[CASILLA_RARA];
    expect(m).toMatchObject({ id: 'mapache-crupier', tipo: 'companero' });
    expect(Math.max(...RULETA.map((c) => c.peso))).toBeGreaterThan(m.peso);
    expect(RULETA.every((c) => c.peso >= m.peso)).toBe(true);
    expect(catalogItem(m.id)).toMatchObject({ rareza: 'legendario', compania: true, casino: true, ruleta: true });
    expect(MISTICOS.find((x) => x.id === m.id)).toMatchObject({ legendario: true });
    expect((await db.query('select rareza from piso_catalogo where id = $1', [m.id])).rows[0]).toEqual({ rareza: 'legendario' });
    expect((await db.query('select piso_casino_exclusivos() as r')).rows[0].r).toContain(m.id);
  });

  it('sin girar: la semana empieza el lunes y no hay giro', async () => {
    const s = await ruleta(A);
    expect(s.semana).toBe(lunesDe(HOY));
    expect(s.giro).toBeNull();
    expect(s.casillas.map((c) => c.id)).toEqual(RULETA.map((c) => c.id));
    expect(s.casillas.every((c) => c.tienes === false)).toBe(true);
  });

  it('un giro por semana; el premio lo da el servidor en el mismo momento', async () => {
    const antes = await ruleta(A);
    const s = await girar(A);
    expect(s.giro).not.toBeNull();
    const c = RULETA[s.giro.casilla];
    expect(s.giro.premio).toBe(c.id);
    if (c.tipo === 'fichas') expect(s.fichas).toBe(antes.fichas + c.cantidad);
    // (el primer juego del día suma además los garbanzos del día, como en la mesa)
    if (c.tipo === 'garbanzos') expect([c.cantidad, c.cantidad + 20]).toContain(s.garbanzos - antes.garbanzos);
    if (c.tipo !== 'fichas' && c.tipo !== 'garbanzos') expect(s.casillas[s.giro.casilla].tienes).toBe(true);
    expect(await rejects(girar(A))).toMatch(/Esta semana ya has girado/);
    // Lo que se ve después es lo mismo que se decidió
    expect((await ruleta(A)).giro).toEqual(s.giro);
  });

  it('cada casilla sale y da lo suyo (el sorteo, forzado)', async () => {
    // Con la semilla, el primer random() de la sesión: buscamos una semilla para cada casilla
    const vistas = new Map();
    for (let k = 0; k < 400 && vistas.size < RULETA.length; k += 1) {
      const x = (k / 400) * 2 - 1;
      await amañar(x);
      const t = (await db.query('select random() * 100 as t')).rows[0].t;
      let acum = 0;
      const n = RULETA.findIndex((c) => (acum += c.peso) > t);
      if (!vistas.has(n)) vistas.set(n, x);
    }
    expect(vistas.size).toBe(RULETA.length);
    for (const [n, x] of vistas) {
      await borrarGiro(B);
      const antes = await ruleta(B);
      await amañar(x);
      const s = await girar(B);
      expect(s.giro.casilla).toBe(n);
      const c = RULETA[n];
      if (c.tipo === 'fichas') expect(s.fichas - antes.fichas).toBe(c.cantidad);
      // (el primer juego del día suma además los garbanzos del día, como en la mesa)
      if (c.tipo === 'garbanzos') expect([c.cantidad, c.cantidad + 20]).toContain(s.garbanzos - antes.garbanzos);
      if (c.tipo === 'garbanzos') expect(s.giro.garbanzos).toBe(c.cantidad);
      if (c.tipo === 'mueble' || c.tipo === 'companero') expect((await call(B, 'select piso_mi_inventario()')).copias[c.id]).toBe(1);
      // El mapache, una vez tuyo, te acompaña (como el conejo y la gaviota)
      if (c.tipo === 'companero') {
        await as(db, B, (q) => q('update pisos set companero = $1', [c.id]));
        expect((await db.query('select companero from pisos where user_id = $1', [B])).rows[0].companero).toBe(c.id);
      }
      if (c.tipo === 'prenda') await vestir(B, { jersey: 22 });
    }
  });

  it('lo que ya tienes y vuelve a salir se cambia por fichas, sin perder el giro', async () => {
    const reloj = CASILLA_RARA;
    await db.query("insert into piso_inventario (user_id, mueble, copias) values ($1, 'mapache-crupier', 1) on conflict (user_id, mueble) do update set copias = 1", [C]);
    // Buscamos una semilla que dé el mapache (la última casilla: del 98 al 100)
    let semilla = null;
    for (let k = 0; k < 2000 && semilla === null; k += 1) {
      const x = (k / 2000) * 2 - 1;
      await amañar(x);
      if ((await db.query('select random() * 100 as t')).rows[0].t >= 98) semilla = x;
    }
    const antes = await ruleta(C);
    expect(antes.casillas[reloj].tienes).toBe(true);
    await amañar(semilla);
    const s = await girar(C);
    expect(s.giro).toMatchObject({ casilla: reloj, premio: 'mapache-crupier', repetido: true, fichas: RULETA_REPETIDO });
    expect(s.fichas).toBe(antes.fichas + RULETA_REPETIDO);
    expect((await call(C, 'select piso_mi_inventario()')).copias['mapache-crupier']).toBe(1);
  });

  it('las fichas de la ruleta no cuentan en el tope de la semana', async () => {
    const casino = await call(C, 'select piso_casino($1::date)', [HOY]);
    expect(casino.semana).toBe(0);
  });

  it('el esmoquin solo se lleva si te ha tocado, y lo de la ruleta no se recicla', async () => {
    expect(await rejects(vestir(C, { jersey: 22 }))).toMatch(/ruleta del casino/);
    expect(await rejects(call(C, 'select piso_reciclar($1)', ['reloj-deco']))).toMatch(/no se puede reciclar/);
  });

  it('solo hoy, ayer o mañana; sin sesión no se gira y lo interno no se llama', async () => {
    expect(await rejects(girar(A, '2020-01-06'))).toMatch(/ya no se puede jugar/);
    expect(await rejects(as(db, null, (q) => q(`select piso_casino_ruleta_girar('${HOY}')`)))).toMatch(/permission denied/);
    expect(await rejects(call(A, 'select piso_casino_ruleta_tiene($1, $2::jsonb)', [A, JSON.stringify(RULETA[1])]))).toMatch(/permission denied/);
    expect(await rejects(call(A, 'select * from piso_casino_ruleta'))).toMatch(/permission denied/);
  });
});
