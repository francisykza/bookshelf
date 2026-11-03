// 1.67 · Tickets, tienda del bajo y sobres en un Postgres real (PGlite) con todas las migraciones: las mismas reglas y
// números que economy.js; misiones una vez por semana; comprar, abrir sobres (con pity y el de 5 con algo mejor) y
// reciclar solo lo que no está colocado. Nada se escribe directamente.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { CATALOG, catalogItem, isEspecial, isMistico } from '../catalog';
import { starterRoom } from '../demo';
import { BIENVENIDA, MISION_TICKETS, PITY, RAREZAS, SOBRES, oddsTable, precioDe, rarezaOf, sobreOf } from '../economy';
import { normalizeInventory } from '../inventory';

let db;
let A, B, H;
// Los raros del sobre «Balcón y detalles» (desde la 1.69, más de uno) y el que le sale a B
const RAROS_BALCON = sobreOf('balcon').muebles.filter((id) => rarezaOf(catalogItem(id)) === 'raro');
let raroDeB;

const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const inv = (u) => call(u, 'select piso_mi_inventario()');
const setTickets = (u, n, sinRaro = 0) => db.query('update piso_cuentas set tickets = $2, sin_raro = $3 where user_id = $1', [u, n, sinRaro]);
// El lunes de esta semana, como lo calcula la app (weekKey)
const monday = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

beforeAll(async () => {
  db = await createDatabase();
  [A, B, H] = await createUsers(db, 3);
  for (const [i, u] of [A, B, H].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', $2)", [`Vecino ${i}`, u !== H]));
  }
  await as(db, A, (q) => q('select asignar_edificio()'));
  await as(db, A, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(starterRoom())]));
}, 60000);

describe('las reglas del servidor coinciden con economy.js', () => {
  it('rarezas del catálogo y precios', async () => {
    const { rows } = await db.query('select id, rareza, piso_precio(rareza) as precio from piso_catalogo where saga is null order by id');
    expect(Object.fromEntries(rows.map((r) => [r.id, r.rareza]))).toEqual(Object.fromEntries(CATALOG.filter((c) => !c.set).map((c) => [c.id, rarezaOf(c)])));
    for (const r of rows) expect(r.precio, r.id).toBe(precioDe(r.id));
    for (const r of RAREZAS) expect(rows.some((x) => x.rareza === r.id), r.id).toBe(true);
  });

  it('los sobres de la pared: precios, probabilidades y muebles', async () => {
    // «Todo el catálogo» en el servidor es por rareza: los místicos se sortean aparte (solo en el de coleccionista) y
    // los premios (1.79) no salen nunca
    const todos = CATALOG.filter((c) => !c.set && !isMistico(c) && !isEspecial(c)).map((c) => c.id);
    for (const s of SOBRES) {
      const { rows } = await db.query('select piso_sobre($1) as d', [s.id]);
      const d = rows[0].d;
      expect([d.coste1, d.coste5, d.raro, d.poco, d.mistico ?? null, d.legendario ?? null], s.id).toEqual([s.coste1, s.coste5, s.prob.raro, s.prob['poco-comun'], s.prob.mistico ?? null, s.legendario ?? null]);
      expect([...(d.muebles ?? todos)].sort(), s.id).toEqual([...s.muebles].sort());
      // Lo que enseña la tienda suma 1
      expect(oddsTable(s).reduce((t, r) => t + r.cada * r.items.length, 0)).toBeCloseTo(1);
    }
    expect((await db.query("select piso_sobre('inventado') as d")).rows[0].d).toBeNull();
  });
});

describe('tickets', () => {
  it('empiezas con los de bienvenida; cada misión, una vez por semana', async () => {
    expect((await inv(A)).tickets).toBe(BIENVENIDA);
    expect((await call(A, 'select piso_reclamar_mision($1, $2::date)', ['pages', monday()])).tickets).toBe(BIENVENIDA + MISION_TICKETS);
    expect((await call(A, 'select piso_reclamar_mision($1, $2::date)', ['pages', monday()])).tickets).toBe(BIENVENIDA + MISION_TICKETS);
    expect((await call(A, 'select piso_reclamar_mision($1, $2::date)', ['pages', monday(-1)])).tickets).toBe(BIENVENIDA + 2 * MISION_TICKETS);
    // El inventario dice cuáles están cobradas (y la app lo entiende)
    const cobradas = normalizeInventory(await inv(A)).reclamadas;
    expect(cobradas).toEqual([`mision:pages:${monday(-1)}`, `mision:pages:${monday()}`]);
    expect(await rejects(call(A, 'select piso_reclamar_mision($1, $2::date)', ['pages', monday(-3)]))).toMatch(/ya no se puede/);
    expect(await rejects(call(A, 'select piso_reclamar_mision($1, $2::date)', ['inventada', monday()]))).toMatch(/no existe/);
    // Un martes no es una semana
    const martes = new Date(`${monday()}T12:00:00`);
    martes.setDate(martes.getDate() + 1);
    expect(await rejects(call(A, 'select piso_reclamar_mision($1, $2::date)', ['quotes', martes.toISOString().slice(0, 10)]))).toMatch(/ya no se puede/);
  });
});

describe('tienda', () => {
  it('se compra lo común y lo poco común; lo raro y las sagas, no; sin saldo, tampoco', async () => {
    await setTickets(A, 60);
    const after = await call(A, "select piso_comprar('silla')");
    expect(after.tickets).toBe(60 - precioDe('silla'));
    expect(after.copias.silla).toBe(1);
    expect((await call(A, "select piso_comprar('sofa')")).copias.sofa).toBe(1);
    expect(await rejects(call(A, "select piso_comprar('gato')"))).toMatch(/no se vende/);
    expect(await rejects(call(A, "select piso_comprar('brasero')"))).toMatch(/no se vende/);
    expect(await rejects(call(A, "select piso_comprar('sofa')"))).toMatch(/tickets suficientes/);
  });
});

describe('sobres', () => {
  it('el de 1 cobra su precio y da un mueble que no es de sagas', async () => {
    await setTickets(A, 10);
    const r = await call(A, "select piso_abrir_sobre('salon', 1)");
    expect(r.premios).toHaveLength(1);
    expect(CATALOG.find((c) => c.id === r.premios[0].mueble && !c.set)).toBeTruthy();
    expect(r.inventario.tickets).toBe(0);
    expect(await rejects(call(A, "select piso_abrir_sobre('salon', 1)"))).toMatch(/tickets suficientes/);
    expect(await rejects(call(A, "select piso_abrir_sobre('salon', 3)"))).toMatch(/de 1 o de 5/);
    expect(await rejects(call(A, "select piso_abrir_sobre('inventado', 1)"))).toMatch(/no está a la venta/);
  });

  it('cada sobre trae lo suyo (o, si no tiene de esa rareza, de fuera)', async () => {
    for (let k = 0; k < 6; k += 1) {
      await setTickets(A, sobreOf('luces').coste5);
      const r = await call(A, "select piso_abrir_sobre('luces', 5)");
      for (const p of r.premios) {
        const fila = oddsTable(sobreOf('luces')).find((x) => x.id === p.rareza);
        expect(fila.items.map((c) => c.id), p.mueble).toContain(p.mueble);
      }
    }
    // El de coleccionista cuesta más
    await setTickets(A, sobreOf('coleccion').coste1 - 1);
    expect(await rejects(call(A, "select piso_abrir_sobre('coleccion', 1)"))).toMatch(/tickets suficientes/);
  });

  it('el de 5 trae al menos un poco común; con el pity al límite, algo raro', async () => {
    for (let k = 0; k < 8; k += 1) {
      await setTickets(A, sobreOf('salon').coste5);
      const r = await call(A, "select piso_abrir_sobre('salon', 5)");
      expect(r.premios).toHaveLength(5);
      expect(r.premios.some((p) => p.rareza !== 'comun')).toBe(true);
      expect(r.inventario.tickets).toBe(0);
    }
    await setTickets(A, 10, PITY - 1);
    const r = await call(A, "select piso_abrir_sobre('salon', 1)");
    expect(r.premios[0].rareza).toBe('raro');
    expect(r.inventario.sin_raro).toBe(0);
  });

  it('«nuevo» solo si no tenías ninguna copia', async () => {
    // La cuenta de B se crea al pedir su inventario la primera vez
    await inv(B);
    await setTickets(B, 10, PITY - 1);
    const r = await call(B, "select piso_abrir_sobre('balcon', 1)");
    expect(r.premios[0]).toMatchObject({ rareza: 'raro', nuevo: true });
    expect(RAROS_BALCON).toContain(r.premios[0].mueble);
    raroDeB = r.premios[0].mueble;
    // Con una copia de cada raro del sobre, el siguiente ya no es nuevo
    for (const id of RAROS_BALCON) if (id !== raroDeB) await db.query('insert into piso_inventario (user_id, mueble, copias) values ($1, $2, 1)', [B, id]);
    await setTickets(B, 10, PITY - 1);
    expect((await call(B, "select piso_abrir_sobre('balcon', 1)")).premios[0]).toMatchObject({ rareza: 'raro', nuevo: false });
  });
});

describe('reciclar', () => {
  it('solo copias que no están colocadas, y da lo que vale su rareza', async () => {
    await setTickets(B, 0);
    await db.query('update piso_inventario set copias = 2 where user_id = $1 and mueble = $2', [B, raroDeB]);
    const r = await call(B, 'select piso_reciclar($1)', [raroDeB]);
    expect(r.tickets).toBe(RAREZAS.find((x) => x.id === 'raro').reciclar);
    expect(r.copias[raroDeB]).toBe(1);
    // El sillón del piso inicial de A está colocado y es su única copia: no se recicla
    await db.query("update piso_inventario set copias = 1 where user_id = $1 and mueble = 'sillon'", [A]);
    expect(await rejects(call(A, "select piso_reciclar('sillon')"))).toMatch(/copias libres/);
    expect(await rejects(call(A, "select piso_reciclar('brasero')"))).toMatch(/no se puede/);
  });
});

describe('permisos', () => {
  it('nada se escribe directamente; sin sesión o sin comunidad, nada', async () => {
    expect(await rejects(as(db, A, (q) => q('update piso_cuentas set tickets = 999')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select * from piso_reclamos')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q("select piso_sumar($1, 'gato', 5)", [A])))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q("select piso_al_azar('raro', null)")))).toMatch(/permission denied/);
    expect(await rejects(as(db, null, (q) => q("select piso_abrir_sobre('salon', 1)")))).toMatch(/permission denied/);
    expect(await rejects(as(db, H, (q) => q("select piso_abrir_sobre('salon', 1)")))).toMatch(/Activa la comunidad/);
  });
});
