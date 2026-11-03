// 1.69 · Tu personaje (SPEC §69): el aspecto se guarda junto al piso, el servidor solo acepta las opciones del cliente
// (la misma validación que validateAvatar) y el portal lo enseña a los vecinos. Postgres real (PGlite) con todas las
// migraciones.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { COLORES_PELO, COMPLEMENTOS, DEFAULT_AVATAR, JERSEYS, PANTALONES, PELOS, PIELES, validateAvatar } from '../actor';
import { starterRoom } from '../demo';

let db;
let A, B, H;
const portal = (u) => as(db, u, (q) => q('select edificio_portal() as p')).then((r) => r[0].p);
const setPersonaje = (u, p) => as(db, u, (q) => q('update pisos set personaje = $1::jsonb', [JSON.stringify(p)]));

beforeAll(async () => {
  db = await createDatabase();
  [A, B, H] = await createUsers(db, 3);
  for (const [i, u] of [A, B, H].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Vecino ${i}`]));
  }
  for (const u of [A, B]) {
    await as(db, u, (q) => q('select asignar_edificio()'));
    await as(db, u, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(starterRoom())]));
  }
}, 60000);

describe('el personaje en el servidor', () => {
  it('se guarda en tu piso y el portal lo enseña a los vecinos', async () => {
    const mine = { ...DEFAULT_AVATAR, pelo: 'rizos', jersey: 6, gafas: true };
    await setPersonaje(A, mine);
    const seen = (await portal(B)).vecinos.find((v) => v.user_id === A);
    expect(seen.personaje).toEqual(mine);
    expect(validateAvatar(seen.personaje)).toEqual(mine);
    // Quien aún no lo ha cambiado no tiene ninguno (y el cliente pone el de serie)
    expect((await portal(A)).vecinos.find((v) => v.user_id === B).personaje).toBeNull();
  });

  it('solo cada uno cambia el suyo', async () => {
    await as(db, B, (q) => q('update pisos set personaje = $1::jsonb where user_id = $2', [JSON.stringify(DEFAULT_AVATAR), A]));
    expect((await portal(B)).vecinos.find((v) => v.user_id === A).personaje.pelo).toBe('rizos');
    expect(await rejects(as(db, null, (q) => q('select personaje from pisos')))).toMatch(/permission denied/);
  });

  it('acepta todas las opciones del cliente y nada más', async () => {
    const lists = { piel: PIELES.map((x) => x.id), pelo: PELOS.map((x) => x.id), colorPelo: COLORES_PELO.map((x) => x.id), jersey: JERSEYS.map((x) => x.id), pantalon: PANTALONES.map((x) => x.id), gafas: [false, true], complemento: COMPLEMENTOS.map((x) => x.id) };
    // La comprobación, directamente (guardar treinta veces seguidas toparía con el límite de escrituras)
    const valid = async (p) => (await db.query('select piso_personaje_valido($1::jsonb) as ok', [JSON.stringify(p)])).rows[0].ok;
    for (const [key, values] of Object.entries(lists)) for (const v of values) expect(await valid({ ...DEFAULT_AVATAR, [key]: v })).toBe(true);
    const bad = [
      { ...DEFAULT_AVATAR, piel: 5 },
      { ...DEFAULT_AVATAR, pelo: 'cresta' },
      { ...DEFAULT_AVATAR, colorPelo: '1' },
      { ...DEFAULT_AVATAR, jersey: JERSEYS.length },
      { ...DEFAULT_AVATAR, complemento: 'corona' },
      { ...DEFAULT_AVATAR, pantalon: -1 },
      { ...DEFAULT_AVATAR, gafas: 'sí' },
      { ...DEFAULT_AVATAR, nombre: 'Hola' },
      Object.fromEntries(Object.entries(DEFAULT_AVATAR).filter(([k]) => k !== 'gafas')),
      ['corto'],
    ];
    expect(await rejects(setPersonaje(A, bad[0]))).toMatch(/pisos_personaje_valido/);
    for (const p of bad) {
      expect(await valid(p)).toBe(false);
      expect(validateAvatar(p) && Object.keys(p).length === 7).toBeFalsy();
    }
  });
});
