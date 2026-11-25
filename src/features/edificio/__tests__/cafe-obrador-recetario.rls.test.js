// 1.145 · El obrador, tercera tanda: «el recetario crece» (bloque 3 de docs/qa/cafe-libreria.md §18.12), en un Postgres real
// (PGlite) con todas las migraciones: las cifras de las cuatro recetas nuevas, los favoritos y los hitos son los de la app
// (cafeObrador.js); cada receta, desde su nivel; el pan, con su masa de la noche (una cada vez, lista al día siguiente o en la
// jornada de prueba siguiente; Pilar la hornea como una de 3 estrellas); los hitos, por piezas vendidas en la mesa y en el
// mostrador, una vez cada uno y con sus 20 granos; el excéntrico pide una receta concreta y paga el doble; el habitual pide su
// favorito y paga +2; las visitas ven el horno, la vitrina y los hitos, nada más. Nada da reputación ni tickets. El anónimo, nada.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { EXTRA_FAVORITO, FAVORITOS, HITOS_OBRADOR, HORNABLES, RECETAS_OBRADOR, precioMesa, recetaObrador } from '../cafe/cafeObrador';

let db;
let A, B, C, E;
let CANDIDATOS;
let hoy;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const sql1 = (sql, params) => db.query(sql, params).then((r) => Object.values(r.rows[0])[0]);
const obrador = (u, d = hoy) => call(u, 'select cafe_obrador($1::date)', [d]);
const abrir = (u) => call(u, 'select cafe_obrador_abrir()');
const hornear = (u, receta, mimo) => call(u, 'select cafe_hornear($1, $2::smallint[])', [receta, mimo]);
const hornearPilar = (u, receta) => call(u, 'select cafe_hornear_pilar($1)', [receta]);
const reposar = (u, amasado) => call(u, 'select cafe_masa_reposar($1::smallint)', [amasado]);
const mostrador = (u, d = hoy) => call(u, 'select cafe_mostrador($1::date)', [d]);
const servir = (u, cliente, receta, d = hoy) => call(u, 'select cafe_servir_comida($1::date, $2, $3)', [d, cliente, receta]);
const local = (u) => db.query('select granos, reputacion, nivel from cafe_locales where user_id = $1', [u]).then((r) => r.rows[0]);
const tickets = async (u) => (await db.query('select tickets from piso_cuentas where user_id = $1', [u])).rows[0]?.tickets ?? null;
const alNivel = (u, nivel) => db.query('update cafe_locales set nivel = $2 where user_id = $1', [u, nivel]);
const vaciarHorno = (u) => db.query('delete from cafe_obrador_horno where user_id = $1', [u]);
const vitrina = (u, receta, piezas) =>
  db.query('insert into cafe_obrador_vitrina (user_id, receta, piezas) values ($1, $2, $3) on conflict (user_id, receta) do update set piezas = $3', [u, receta, piezas]);
const pasanDias = (u, dias) => db.query("update cafe_obrador set mostrador_desde = now() - make_interval(days => $2) - interval '1 hour' where user_id = $1", [u, dias]);
const hornadasBuenas = (u, receta, n) =>
  db.query('insert into cafe_obrador_hornadas (user_id, dia, receta, estrellas, piezas) select $1, cafe_hoy() - 3, $2, 2, 5 from generate_series(1, $3)', [u, receta, n]);
/** El cliente ya tomó su taza hoy (hace falta para servirle algo de comer). */
const servido = (u, cliente) =>
  db.query(
    "insert into cafe_servicios (user_id, dia, cliente, receta, aciertos, encaja, estrellas, granos, reputacion) values ($1, $2::date, $3, array['cafe','suave','sin','nada'], 4, true, 3, 0, 0) on conflict do nothing",
    [u, hoy, cliente],
  );

async function cafeAbierto(u, i, nivel) {
  await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lectora ${i}`]));
  await call(u, 'select cafe_mio()');
  await call(u, 'select cafe_inaugurar($1)', ['Taza y Lomo']);
  await alNivel(u, nivel);
  await abrir(u);
}

beforeAll(async () => {
  db = await createDatabase();
  hoy = (await db.query('select cafe_hoy()::text as h')).rows[0].h;
  [A, B, C, E] = await createUsers(db, 4);
  for (const [i, u] of [A, B, C, E].entries()) await cafeAbierto(u, i, 4);
  // Doce cafés en el nivel 8 (las seis recetas abiertas), con sus dos habituales, para encontrar excéntricos y favoritos del día
  // (lo decide la semilla de cada cuenta y día: la mitad de los días el excéntrico pide algo; uno de cada tres habituales, su favorito)
  CANDIDATOS = await createUsers(db, 12);
  for (const [i, u] of CANDIDATOS.entries()) {
    await cafeAbierto(u, 10 + i, 8);
    await obrador(u);
  }
  await db.query('update cafe_dias set habituales = 2 where user_id = any ($1::uuid[]) and dia = $2::date', [CANDIDATOS, hoy]);
}, 90000);

describe('el recetario crece: las cifras y los niveles', () => {
  it('las seis recetas, los doce favoritos y los cinco hitos del servidor son los de la app', async () => {
    for (const r of RECETAS_OBRADOR) {
      const s = await sql1('select cafe_obrador_receta($1)', [r.id]);
      expect(s, r.id).toEqual({ tipo: r.tipo, nivel: r.nivel, piezas: r.piezas, precio: r.precio, segundos: r.segundos });
    }
    expect(await sql1("select cafe_obrador_receta('paella')")).toBeNull();
    expect(await sql1('select cafe_obrador_recetario()')).toEqual(HORNABLES);
    for (let k = 0; k < 12; k += 1) expect(await sql1('select cafe_obrador_favorito($1)', [k]), `habitual ${k}`).toBe(FAVORITOS[k]);
    expect(await sql1('select cafe_obrador_hitos_cifras()')).toEqual(HITOS_OBRADOR.cifras);
    expect(await sql1('select cafe_obrador_hito_granos()')).toBe(HITOS_OBRADOR.granos);
  });

  it('cada receta se abre en su nivel y solo entonces se hornea', async () => {
    for (const n of [3, 4, 5, 6, 7, 8]) {
      await alNivel(A, n);
      expect(await sql1('select cafe_obrador_abiertas($1)', [A]), `nivel ${n}`).toEqual(RECETAS_OBRADOR.filter((r) => r.nivel <= n).map((r) => r.id));
    }
    await alNivel(A, 4);
    await expect(hornear(A, 'galletas', [2, 2])).rejects.toThrow(/cafe:receta/);
    await alNivel(A, 5);
    let r = await hornear(A, 'galletas', [2, 2]);
    expect(r.dado).toMatchObject({ estrellas: 3, piezas: recetaObrador('galletas').piezas[2] });
    await vaciarHorno(A);
    await alNivel(A, 7);
    await expect(hornear(A, 'tortilla', [2, 2])).rejects.toThrow(/cafe:receta/);
    r = await hornear(A, 'bizcocho', [2, 1]);
    expect(r.dado).toMatchObject({ estrellas: 2, piezas: recetaObrador('bizcocho').piezas[1] });
    // La tortilla, al fogón: cuenta como una bandeja más y tarda lo suyo
    await vaciarHorno(A);
    await alNivel(A, 8);
    r = await hornear(A, 'tortilla', [1, 1]);
    expect(r.dado).toMatchObject({ estrellas: 1, piezas: recetaObrador('tortilla').piezas[0] });
    expect(r.obrador.horneando[0]).toMatchObject({ receta: 'tortilla' });
    expect(r.obrador.horneando[0].falta).toBeGreaterThan(recetaObrador('tortilla').segundos - 5);
    await vaciarHorno(A);
    // En la ficha, las seis con su maestría
    expect(Object.keys((await obrador(A)).obrador.recetas).sort()).toEqual([...HORNABLES].sort());
  });
});

describe('el pan de la bodega: se amasa un día y se greña al siguiente', () => {
  it('desde el nivel 6; una masa cada vez; lista desde el día siguiente; al hornearla, el amasado de ayer cuenta', async () => {
    await alNivel(B, 5);
    await expect(reposar(B, 2)).rejects.toThrow(/cafe:receta/);
    await alNivel(B, 6);
    // Sin masa, el pan no se hornea
    await expect(hornear(B, 'pan', [2, 2])).rejects.toThrow(/cafe:masa/);
    await expect(reposar(B, 3)).rejects.toThrow(/cafe:mimo/);
    const r = await reposar(B, 1);
    expect(r.obrador.masa).toEqual({ lista: false, puesta: hoy });
    // Una cada vez
    await expect(reposar(B, 2)).rejects.toThrow(/cafe:masa/);
    // El mismo día, todavía no
    await expect(hornear(B, 'pan', [2, 2])).rejects.toThrow(/cafe:masa/);
    // Al día siguiente (o cuando sea: no caduca), lista
    await db.query("update cafe_obrador_masa set puesta = cafe_hoy() - 4 where user_id = $1", [B]);
    expect((await obrador(B)).obrador.masa.lista).toBe(true);
    const tk = await tickets(B);
    const rep = (await local(B)).reputacion;
    const h = await hornear(B, 'pan', [2, 2]);
    // El amasado de ayer (se podía mejorar) y el greñado de hoy (bien): 2 estrellas
    expect(h.dado).toMatchObject({ mimo: [1, 2], estrellas: 2, piezas: recetaObrador('pan').piezas[1] });
    expect(h.obrador.masa).toBeNull();
    await vaciarHorno(B);
    // La masa se gastó
    await expect(hornear(B, 'pan', [2, 2])).rejects.toThrow(/cafe:masa/);
    expect((await local(B)).reputacion).toBe(rep);
    expect(await tickets(B)).toBe(tk);
  });

  it('con la receta dominada, Pilar la hornea como una de 3 estrellas aunque el amasado no saliera bien', async () => {
    await hornadasBuenas(B, 'pan', 25);
    await expect(hornearPilar(B, 'pan')).rejects.toThrow(/cafe:masa/);
    await reposar(B, 1);
    await db.query("update cafe_obrador_masa set puesta = cafe_hoy() - 1 where user_id = $1", [B]);
    const r = await hornearPilar(B, 'pan');
    expect(r.dado).toMatchObject({ estrellas: 3, pilar: true, piezas: recetaObrador('pan').piezas[2] + 1 });
    await vaciarHorno(B);
  });

  it('en las jornadas de prueba, la jornada siguiente cuenta como la noche', async () => {
    await alNivel(E, 6);
    await db.query("insert into cafe_probadores (user_id, jornada) values ($1, date '3000-01-01')", [E]);
    await reposar(E, 2);
    expect((await obrador(E, '3000-01-01')).obrador.masa.lista).toBe(false);
    await expect(hornear(E, 'pan', [2, 2])).rejects.toThrow(/cafe:masa/);
    await db.query("update cafe_probadores set jornada = date '3000-01-02' where user_id = $1", [E]);
    expect((await obrador(E, '3000-01-02')).obrador.masa.lista).toBe(true);
    expect((await hornear(E, 'pan', [2, 2])).dado).toMatchObject({ estrellas: 3 });
    await vaciarHorno(E);
  });
});

describe('los hitos del obrador', () => {
  it('por piezas vendidas en total (mesa y mostrador): cada hito una vez, con sus 20 granos; nada de reputación ni tickets', async () => {
    const o0 = (await obrador(C)).obrador;
    expect(o0).toMatchObject({ hitos: 0, vendidas_total: 0 });
    // 24 vendidas: el siguiente lo da el 25
    await db.query('update cafe_obrador set mostrador_piezas = 24 where user_id = $1', [C]);
    await vitrina(C, 'magdalenas', 5);
    await pasanDias(C, 1);
    const tk = await tickets(C);
    const antes = await local(C);
    let r = await mostrador(C);
    expect(r.cobrado.piezas).toBe(4);
    expect(r.cobrado.hitos).toEqual([1]);
    let despues = await local(C);
    expect(despues.granos - antes.granos).toBe(r.cobrado.granos + HITOS_OBRADOR.granos);
    expect(r.obrador).toMatchObject({ hitos: 1, vendidas_total: 28 });
    // De golpe, varios: cada uno sus granos
    await db.query('update cafe_obrador set mostrador_piezas = 990 where user_id = $1', [C]);
    await vitrina(C, 'magdalenas', 40);
    await pasanDias(C, 7);
    const antes2 = await local(C);
    r = await mostrador(C);
    expect(r.cobrado.hitos).toEqual([2, 3, 4, 5]);
    despues = await local(C);
    expect(despues.granos - antes2.granos).toBe(r.cobrado.granos + 4 * HITOS_OBRADOR.granos);
    expect(r.obrador.hitos).toBe(5);
    // Ya no hay más, ni se repiten
    expect(await sql1('select cafe_obrador_dar_hitos($1)', [C])).toEqual([]);
    expect(despues.reputacion).toBe(antes.reputacion);
    expect(await tickets(C)).toBe(tk);
  });
});

describe('lo que piden: el acertijo del excéntrico y el favorito del habitual', () => {
  it('el excéntrico, la mitad de los días, pide una receta concreta de tu recetario; solo vale esa y paga el doble', async () => {
    const vistos = [];
    for (const u of CANDIDATOS) {
      const o = await obrador(u);
      const n = (await db.query('select clientes from cafe_dias where user_id = $1 and dia = $2::date', [u, hoy])).rows[0].clientes;
      const fx = await sql1("select cafe_semilla($1::uuid, $2::date, 'fx') % 2", [u, hoy]);
      const exc = o.piden.find((p) => p.n === n);
      // Lo decide la semilla del día, la mitad de los días
      if (fx !== 0) expect(exc, 'sin acertijo, el excéntrico no pide comida').toBeUndefined();
      else {
        expect(HORNABLES).toContain(exc.quiere);
        expect(exc.tipo).toBe(recetaObrador(exc.quiere).tipo);
        vistos.push({ u, n, quiere: exc.quiere, esp: o.especialidad });
      }
    }
    // Con doce cafés, alguno lo tiene hoy (falla 1 vez de cada 4.096)
    expect(vistos.length).toBeGreaterThan(0);
    const { u, n, quiere, esp } = vistos[0];
    await servido(u, n);
    const otra = RECETAS_OBRADOR.find((r) => r.tipo === recetaObrador(quiere).tipo && r.id !== quiere).id;
    await vitrina(u, otra, 3);
    await vitrina(u, quiere, 3);
    // Del mismo tipo, pero no la del acertijo: no
    await expect(servir(u, n, otra)).rejects.toThrow(/cafe:comida/);
    const rep = (await local(u)).reputacion;
    const r = await servir(u, n, quiere);
    expect(r.dado).toMatchObject({ excentrico: true, favorito: false, granos: precioMesa(quiere, { excentrico: true, especialidad: esp }) });
    expect(r.dado.granos).toBeGreaterThanOrEqual(2 * recetaObrador(quiere).precio);
    expect((await local(u)).reputacion).toBe(rep);
  });

  it('el habitual, si le toca pedir comida, pide su favorito por su nombre: +2; otra del mismo tipo le vale, a su precio', async () => {
    const vistos = [];
    for (const u of CANDIDATOS) {
      const o = await obrador(u);
      for (const k of [1, 2]) {
        const quien = await sql1('select cafe_quien($1::uuid, $2::date, $3)', [u, hoy, k]);
        const p = o.piden.find((x) => x.n === 100 + k);
        const toca = (await sql1("select cafe_semilla($1::uuid, $2::date, 'f' || $3::text) % 3", [u, hoy, String(100 + k)])) === 0;
        if (!toca) {
          expect(p, 'no le toca pedir comida').toBeUndefined();
          continue;
        }
        expect(p).toMatchObject({ quiere: FAVORITOS[quien], tipo: recetaObrador(FAVORITOS[quien]).tipo });
        vistos.push({ u, cliente: 100 + k, fav: FAVORITOS[quien], esp: o.especialidad });
      }
    }
    // Con 24 habituales, al menos dos piden hoy su favorito (falla menos de 1 vez de cada 1.000)
    expect(vistos.length).toBeGreaterThanOrEqual(2);
    // Su favorito: +2
    const [f1, f2] = vistos;
    await servido(f1.u, f1.cliente);
    await vitrina(f1.u, f1.fav, 3);
    let r = await servir(f1.u, f1.cliente, f1.fav);
    expect(r.dado).toMatchObject({ favorito: true, excentrico: false, granos: precioMesa(f1.fav, { favorito: f1.fav, especialidad: f1.esp }) });
    expect(r.dado.granos - recetaObrador(f1.fav).precio - (f1.fav === f1.esp ? 1 : 0)).toBe(EXTRA_FAVORITO);
    // Otra del mismo tipo: le vale, sin el +2
    const otra = RECETAS_OBRADOR.find((x) => x.tipo === recetaObrador(f2.fav).tipo && x.id !== f2.fav).id;
    await servido(f2.u, f2.cliente);
    await vitrina(f2.u, otra, 3);
    r = await servir(f2.u, f2.cliente, otra);
    expect(r.dado).toMatchObject({ favorito: false, granos: precioMesa(otra, { especialidad: f2.esp }) });
    // Una vez por cliente y día
    await vitrina(f2.u, f2.fav, 3);
    await expect(servir(f2.u, f2.cliente, f2.fav)).rejects.toThrow(/cafe:servido/);
  });
});

describe('las visitas', () => {
  it('ven el horno, la vitrina y los hitos (sus adornos), nada del horno por dentro; por debajo del nivel 4, nada', async () => {
    await as(db, A, (q) => q('insert into follows (followed) values ($1)', [C]));
    await as(db, A, (q) => q('insert into follows (followed) values ($1)', [E]));
    await vitrina(C, 'galletas', 2);
    await alNivel(C, 5);
    await hornear(C, 'galletas', [2, 2]);
    const v = await call(A, 'select cafe_visita($1)', [C]);
    expect(Object.keys(v.obrador).sort()).toEqual(['hitos', 'horno', 'piezas', 'vitrina']);
    expect(v.obrador).toMatchObject({ horno: 1, vitrina: 1, hitos: 5 });
    expect(v.obrador.piezas.galletas).toBe(2);
    await vaciarHorno(C);
    await alNivel(E, 3);
    expect((await call(A, 'select cafe_visita($1)', [E])).obrador).toBeNull();
  });
});

describe('lo que no se puede', () => {
  it('el anónimo no puede amasar ni ver nada, ni nadie las funciones internas ni la tabla de la masa', async () => {
    expect(await rejects(as(db, null, (q) => q('select cafe_masa_reposar(2::smallint)')))).toMatch(/permission denied/);
    expect(await rejects(as(db, null, (q) => q('select cafe_obrador($1::date)', [hoy])))).toMatch(/permission denied/);
    for (const sql of [
      'select cafe_quiere_comida($1::uuid, cafe_hoy(), 1)',
      'select cafe_obrador_dar_hitos($1::uuid)',
      'select cafe_masa_lista($1::uuid)',
      'select cafe_obrador_abiertas($1::uuid)',
      'select cafe_obrador_vendidas($1::uuid)',
    ])
      expect(await rejects(as(db, A, (q) => q(sql, [A]))), sql).toMatch(/permission denied/);
    for (const sql of ['select cafe_obrador_favorito(1)', "select cafe_obrador_receta('pan')", 'select cafe_obrador_hitos_cifras()'])
      expect(await rejects(as(db, A, (q) => q(sql))), sql).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select * from cafe_obrador_masa')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('update cafe_obrador set hitos = 5')))).toMatch(/permission denied/);
  });
});
