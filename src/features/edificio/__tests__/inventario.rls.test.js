// 1.66 · Inventario de muebles del edificio (fase 1 de docs/qa/economia-muebles.md) en un Postgres real (PGlite). La
// base se monta con todas las migraciones menos la del inventario, se guardan pisos «de antes» y después se aplica la
// migración tal cual, como pasaría en producción: nadie pierde lo que tenía colocado, quien empieza recibe el piso
// inicial, los seis comunes se eligen una vez y el servidor no deja colocar más copias de las que tienes.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { CATALOG, isEspecial, isMistico } from '../catalog';
import { starterRoom } from '../demo';
import { addItem } from '../room';

const DIR = join(import.meta.dirname, '..', '..', '..', '..', 'supabase', 'migrations');
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const MIGRATION = '20261103120000_edificio_inventario.sql';

let db;
let A, B, C, H;

const inventario = (u) => as(db, u, (q) => q('select piso_mi_inventario() as i')).then((r) => r[0].i);
const guardar = (u, room) => as(db, u, (q) => q('update pisos set layout = $1::jsonb where user_id = $2', [JSON.stringify(room), u]));
const crear = (u, room) => as(db, u, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(room)]));
const con = (room, ...ids) => ids.reduce((r, id) => addItem(r, id).room ?? r, room);
const contar = (room) => room.items.reduce((m, i) => ({ ...m, [i.id]: (m[i.id] ?? 0) + 1 }), {});

// Un piso de antes de la migración: el inicial con dos sillones más y un brasero (de un set de saga)
let antes;

beforeAll(async () => {
  db = await createDatabase(FILES.indexOf(MIGRATION));
  [A, B, C, H] = await createUsers(db, 4);
  for (const [i, u] of [A, B, C, H].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', $2)", [`Vecino ${i}`, u !== H]));
    if (u !== H) await as(db, u, (q) => q('select asignar_edificio()'));
  }
  antes = con(starterRoom(), 'sillon', 'sillon', 'brasero');
  expect(contar(antes)).toMatchObject({ sillon: 3, brasero: 1 });
  await crear(A, antes);
  await crear(B, starterRoom());
  await db.exec(readFileSync(join(DIR, MIGRATION), 'utf8'));
}, 60000);

describe('catálogo del servidor', () => {
  it('sabe qué muebles son de un set de saga y todos son comunes por ahora', async () => {
    const { rows } = await db.query('select id, saga, rareza from piso_catalogo order by id');
    // Lo que había en la 1.66 (las tandas 2 de la 1.69 y 3 de la 1.78, los místicos y la placa de la 1.79 llegan en migraciones posteriores)
    const tanda2 = new Set(['puf', 'mecedora', 'escritorio', 'comoda', 'baul', 'velas', 'farol', 'cactus', 'monstera', 'pecera', 'globo', 'tocadiscos', 'taza', 'estante-pared', 'espejo', 'mapa', 'alfombra-rayas',
      'perchero', 'cesto-mantas', 'jarron', 'chimenea', 'piano', 'tapiz', 'telescopio', 'perrito']);
    expect(Object.fromEntries(rows.map((r) => [r.id, r.saga]))).toEqual(Object.fromEntries(CATALOG.filter((c) => !tanda2.has(c.id) && !isMistico(c) && !isEspecial(c)).map((c) => [c.id, c.set ?? null])));
    expect(new Set(rows.map((r) => r.rareza))).toEqual(new Set(['comun']));
  });
});

describe('inventario', () => {
  it('lo que tenías colocado pasa a ser tuyo (los muebles de sagas siguen libres)', async () => {
    const inv = await inventario(A);
    expect(inv.inicio_elegido).toBe(false);
    const { brasero, ...sinSaga } = contar(antes);
    expect(brasero).toBe(1);
    expect(inv.copias).toEqual(sinSaga);
    // Guardar el mismo piso sigue valiendo; un cuarto sillón, no; otro brasero, sí
    await guardar(A, antes);
    expect(await rejects(guardar(A, con(antes, 'sillon')))).toMatch(/copias suficientes de «sillon»/);
    await guardar(A, con(antes, 'brasero'));
  });

  it('quien empieza recibe los diez muebles del piso inicial', async () => {
    expect((await inventario(C)).copias).toEqual(contar(starterRoom()));
    expect(await rejects(crear(C, con(starterRoom(), 'silla')))).toMatch(/copias suficientes de «silla»/);
    await crear(C, starterRoom());
  });

  it('el inventario se crea también al guardar, con el piso que había (aunque no se haya pedido antes)', async () => {
    // B guardó antes de la migración y no ha pedido su inventario: al guardar, primero se le asegura
    expect(await rejects(guardar(B, con(starterRoom(), 'sillon')))).toMatch(/copias suficientes/);
    expect((await inventario(B)).copias).toEqual(contar(starterRoom()));
  });

  it('seis comunes a elegir, una sola vez, y después caben en el piso', async () => {
    const elegir = (u, ids) => as(db, u, (q) => q('select piso_elegir_inicio($1::text[]) as i', [ids]));
    expect(await rejects(elegir(C, ['silla', 'silla']))).toMatch(/Elige seis/);
    expect(await rejects(elegir(C, ['silla', 'silla', 'sofa', 'banco', 'maceta', 'brasero']))).toMatch(/comunes/);
    expect(await rejects(elegir(C, ['silla', 'silla', 'sofa', 'banco', 'maceta', 'trono']))).toMatch(/comunes/);
    const ids = ['silla', 'silla', 'sofa', 'banco', 'sillon', 'cuadro'];
    for (const id of ids) expect(CATALOG.find((c) => c.id === id), id).toBeTruthy();
    const inv = (await elegir(C, ids))[0].i;
    expect(inv.inicio_elegido).toBe(true);
    expect(inv.copias).toMatchObject({ silla: 2, sofa: 1, banco: 1, sillon: 2, cuadro: 2 });
    expect(await rejects(elegir(C, ids))).toMatch(/Ya elegiste/);
    await guardar(C, con(starterRoom(), 'silla', 'silla'));
  });

  it('las tablas no se leen ni se escriben directamente; sin sesión o sin comunidad, nada', async () => {
    expect(await rejects(as(db, A, (q) => q('select * from piso_inventario')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q("insert into piso_inventario (user_id, mueble, copias) values ($1, 'sofa', 9)", [A])))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('update piso_cuentas set inicio_elegido = false')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select piso_inventario_asegurar($1)', [A])))).toMatch(/permission denied/);
    expect(await rejects(as(db, null, (q) => q('select piso_mi_inventario()')))).toMatch(/permission denied/);
    expect(await rejects(as(db, H, (q) => q('select piso_mi_inventario()')))).toMatch(/Activa la comunidad/);
  });
});
