// 1.63 · «El edificio del puerto»: autorización en un Postgres real (PGlite) con la migración tal cual. Reparto al azar
// en edificios de seis, pisos que solo ven los vecinos (sin bloqueos y con la comunidad activada), validación del piso
// en el servidor idéntica a la del cliente, sellos de frase cerrada solo entre vecinos y el portal en una consulta.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { CATALOG } from '../catalog';
import { starterRoom } from '../demo';
import { addItem, createRoom, validateRoom } from '../room';

let db;
let users;
let A, B, C, D, E, F, G, H;

const piso = () => JSON.stringify(starterRoom());
const portal = (u) => as(db, u, (q) => q('select edificio_portal() as p')).then((r) => r[0].p);

beforeAll(async () => {
  db = await createDatabase();
  users = await createUsers(db, 8);
  [A, B, C, D, E, F, G, H] = users;
  for (const [i, u] of users.entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', $2)", [`Vecino ${i}`, u !== H]));
  }
}, 60000);

describe('catálogo del servidor', () => {
  it('coincide con el del cliente (medidas, capa, superficie y tonos)', async () => {
    const rows = await db.query('select id, capa, w, d, sup, tonos from piso_catalogo order by id');
    const server = Object.fromEntries(rows.rows.map((r) => [r.id, { capa: r.capa, w: r.w, d: r.d, sup: r.sup == null ? null : Number(r.sup.toFixed(2)), tonos: r.tonos }]));
    const client = Object.fromEntries(CATALOG.map((c) => [c.id, { capa: c.capa, w: c.w, d: c.capa === 'pared' ? null : c.d, sup: c.sup ?? null, tonos: c.tonos.length }]));
    expect(server).toEqual(client);
  });
});

describe('validación del piso: la misma en el servidor y en el cliente', () => {
  // Generador reproducible (mulberry32)
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomRoom(rand) {
    const pick = (list) => list[Math.floor(rand() * list.length)];
    const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
    // La mitad, pisos válidos construidos con las reglas del cliente y después tocados un poco
    if (rand() < 0.5) {
      let room = createRoom({ pared: pick(['yeso', 'salvia', 'rosa', 'noche']), suelo: pick(['tablas', 'damero', 'barro']) });
      for (let k = int(1, 18); k > 0; k -= 1) room = addItem(room, pick(CATALOG).id, { rot: int(0, 3), near: { x: int(0, 9), y: int(0, 9) } }).room ?? room;
      const items = room.items.map((i) => ({ ...i }));
      if (items.length && rand() < 0.6) {
        const it = pick(items);
        const what = int(0, 5);
        if (what === 0 && 'x' in it) it.x += pick([-1, 1, 2]);
        if (what === 1 && 'y' in it) it.y += pick([-1, 1, 3]);
        if (what === 2 && 'rot' in it) it.rot = (it.rot + 1) % 4;
        if (what === 3) it.tono += pick([1, 3]);
        if (what === 4 && 'a' in it) it.a += pick([-1, 1, 4]);
        if (what === 5) it.uid = items[0].uid;
      }
      return { ...room, items };
    }
    // La otra mitad, al azar del todo
    const items = [];
    for (let k = int(0, 10); k > 0; k -= 1) {
      const c = pick(CATALOG);
      const uid = int(1, 12);
      const tono = int(0, c.tonos.length);
      items.push(c.capa === 'pared' ? { uid, id: c.id, pared: pick(['fondo', 'izq', 'techo']), a: int(-1, 9), tono } : { uid, id: c.id, x: int(-1, 9), y: int(-1, 9), rot: int(0, 4), tono });
    }
    return { v: rand() < 0.95 ? 1 : 2, pared: pick(['yeso', 'noche', 'oro']), suelo: pick(['tablas', 'barro', 'moqueta']), items };
  }

  it('300 pisos al azar: aceptan y rechazan exactamente los mismos', async () => {
    const rand = rng(63);
    let valid = 0;
    for (let k = 0; k < 300; k += 1) {
      const room = randomRoom(rand);
      const client = validateRoom(room) !== null;
      const { rows } = await db.query('select piso_valido($1::jsonb) as ok', [JSON.stringify(room)]);
      expect(rows[0].ok, JSON.stringify(room)).toBe(client);
      if (client) valid += 1;
    }
    // Que haya de los dos tipos (si no, la comparación no diría nada)
    expect(valid).toBeGreaterThan(60);
    expect(valid).toBeLessThan(240);
  });

  it('el servidor rechaza campos de más (el cliente siempre manda el piso limpio)', async () => {
    const room = starterRoom();
    const extra = { ...room, items: room.items.map((i, k) => (k ? i : { ...i, nota: '<b>hola</b>' })) };
    expect((await db.query('select piso_valido($1::jsonb) as ok', [JSON.stringify(extra)])).rows[0].ok).toBe(false);
    expect((await db.query('select piso_valido($1::jsonb) as ok', [JSON.stringify({ ...room, titulo: 'x' })])).rows[0].ok).toBe(false);
    expect((await db.query('select piso_valido($1::jsonb) as ok', [JSON.stringify({ ...room, items: room.items.map((i, k) => (k ? i : { ...i, x: 1.5 })) })])).rows[0].ok).toBe(false);
  });
});

describe('reparto en edificios', () => {
  it('sin la comunidad activada no hay piso; anónimo tampoco', async () => {
    expect(await rejects(as(db, H, (q) => q('select asignar_edificio()')))).toMatch(/Activa la comunidad/);
    expect(await rejects(as(db, null, (q) => q('select asignar_edificio()')))).toMatch(/permission denied/);
  });

  it('se llenan primero los edificios con hueco: seis en el primero y la séptima en uno nuevo; cada puerta, una vez', async () => {
    const got = [];
    for (const u of [A, B, C, D, E, F, G]) got.push((await as(db, u, (q) => q('select asignar_edificio() as r')))[0].r);
    const first = got[0].edificio;
    expect(got.slice(0, 6).every((g) => g.edificio === first)).toBe(true);
    expect(new Set(got.slice(0, 6).map((g) => g.puerta))).toEqual(new Set(['1A', '1B', '2A', '2B', '3A', '3B']));
    expect(got[6].edificio).not.toBe(first);
    // Pedirlo otra vez devuelve lo mismo
    expect((await as(db, A, (q) => q('select asignar_edificio() as r')))[0].r).toEqual(got[0]);
  });

  it('las tablas del reparto no se leen ni se escriben directamente', async () => {
    expect(await rejects(as(db, A, (q) => q('select * from edificio_vecinos')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('insert into edificios default values')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select * from piso_catalogo')))).toMatch(/permission denied/);
  });
});

describe('pisos', () => {
  it('cada cual guarda solo el suyo, y solo si es válido', async () => {
    await as(db, A, (q) => q('insert into pisos (layout) values ($1::jsonb)', [piso()]));
    expect(await rejects(as(db, A, (q) => q('insert into pisos (user_id, layout) values ($1, $2::jsonb)', [B, piso()])))).toMatch(/row-level security/);
    const bad = { ...starterRoom(), items: [...starterRoom().items, { uid: 99, id: 'sofa', x: 8, y: 0, rot: 0, tono: 0 }] };
    expect(await rejects(as(db, A, (q) => q('update pisos set layout = $1::jsonb', [JSON.stringify(bad)])))).toMatch(/no es válido/);
    expect(await rejects(as(db, H, (q) => q('insert into pisos (layout) values ($1::jsonb)', [piso()])))).toMatch(/row-level security/);
    await as(db, B, (q) => q('insert into pisos (layout) values ($1::jsonb)', [piso()]));
    await as(db, F, (q) => q('insert into pisos (layout) values ($1::jsonb)', [piso()]));
    await as(db, G, (q) => q('insert into pisos (layout) values ($1::jsonb)', [piso()]));
    // B no puede tocar el de A
    await as(db, B, (q) => q('update pisos set layout = $1::jsonb where user_id = $2', [JSON.stringify(createRoom()), A]));
    expect((await as(db, A, (q) => q('select layout from pisos where user_id = $1', [A])))[0].layout.items.length).toBe(starterRoom().items.length);
  });

  it('los vecinos lo ven; alguien de otro edificio, un bloqueo o anónimo, no', async () => {
    expect(await as(db, B, (q) => q('select user_id from pisos where user_id = $1', [A]))).toHaveLength(1);
    expect(await as(db, G, (q) => q('select user_id from pisos where user_id = $1', [A]))).toHaveLength(0);
    await as(db, A, (q) => q('insert into blocks (blocked) values ($1)', [F]));
    expect(await as(db, F, (q) => q('select user_id from pisos where user_id = $1', [A]))).toHaveLength(0);
    expect(await as(db, A, (q) => q('select user_id from pisos where user_id = $1', [F]))).toHaveLength(0);
    expect(await rejects(as(db, null, (q) => q('select * from pisos')))).toMatch(/permission denied/);
  });
});

describe('sellos en el buzón', () => {
  it('solo de la lista, solo a vecinos, a nombre propio y uno por pareja', async () => {
    await as(db, A, (q) => q("insert into piso_sellos (para, sello) values ($1, 'acogedor')", [B]));
    expect(await rejects(as(db, A, (q) => q("insert into piso_sellos (para, sello) values ($1, 'eres genial')", [C])))).toMatch(/check/);
    expect(await rejects(as(db, A, (q) => q("insert into piso_sellos (para, sello) values ($1, 'luz')", [G])))).toMatch(/row-level security/);
    expect(await rejects(as(db, A, (q) => q("insert into piso_sellos (para, sello) values ($1, 'luz')", [A])))).not.toBe(null);
    expect(await rejects(as(db, A, (q) => q("insert into piso_sellos (de, para, sello) values ($1, $2, 'luz')", [B, C])))).toMatch(/row-level security/);
    expect(await rejects(as(db, A, (q) => q("insert into piso_sellos (para, sello) values ($1, 'luz')", [F])))).toMatch(/row-level security/);
    expect(await rejects(as(db, A, (q) => q("insert into piso_sellos (para, sello) values ($1, 'luz')", [B])))).toMatch(/duplicate key|unique/);
    await as(db, A, (q) => q("update piso_sellos set sello = 'estanteria' where para = $1", [B]));
    expect((await as(db, B, (q) => q('select sello from piso_sellos where para = $1', [B])))[0].sello).toBe('estanteria');
    expect(await as(db, C, (q) => q('select * from piso_sellos'))).toHaveLength(0);
  });
});

describe('portal', () => {
  it('mis vecinos con su puerta, su piso y los sellos; sin bloqueos ni quien no tiene piso', async () => {
    const p = await portal(A);
    const ids = p.vecinos.map((v) => v.user_id);
    expect(ids).toContain(A);
    expect(ids).toContain(B);
    expect(ids).not.toContain(F);
    expect(ids).not.toContain(G);
    const me = p.vecinos.find((v) => v.yo);
    expect(me.puerta).toBe(p.puerta);
    expect(me.layout.items.length).toBe(starterRoom().items.length);
    expect(p.vecinos.find((v) => v.user_id === B)).toMatchObject({ sello_dado: 'estanteria', alias: 'Vecino 1' });
    // Desde el buzón de B: A le dejó «estanteria» y B no le ha dejado nada
    expect((await portal(B)).vecinos.find((v) => v.user_id === A)).toMatchObject({ sello_recibido: 'estanteria', sello_dado: null });
    expect(await portal(H)).toBe(null);
  });

  it('quien desactiva la comunidad desaparece del portal de sus vecinos', async () => {
    await as(db, C, (q) => q('update profiles set community_enabled = false where user_id = $1', [C]));
    expect((await portal(A)).vecinos.map((v) => v.user_id)).not.toContain(C);
    await as(db, C, (q) => q('update profiles set community_enabled = true where user_id = $1', [C]));
  });
});
