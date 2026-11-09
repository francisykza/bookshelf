// Tablón libre: privacidad entre cuentas, publicación, revocación y cuota diaria, sobre Postgres real (PGlite) con todas las migraciones.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { starterRoom } from '../../edificio/demo';

let db;
let A, B, C, Z;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const cargar = (u) => call(u, 'select tablon_cargar()');
const visita = (u, l) => call(u, 'select tablon_visita($1)', [l]);
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const nota = (n, extra = {}) => ({ id: uuid(n), kind: 'note', body: `Nota ${n}`, x: n * 10, y: 20, width: 200, height: 150, rotation: 0, z: n, paper: 'crema', pin: 'laton', spoiler: false, ...extra });
const hilo = (n, s, t) => ({ id: uuid(n), source_item_id: uuid(s), target_item_id: uuid(t), color: 'terracota', label: null });
const guardar = (u, comp, base, items, edges = [], titulo = 'Mi tablón') => call(u, 'select tablon_guardar($1, $2, $3, $4::jsonb, $5::jsonb)', [comp, base, titulo, JSON.stringify(items), JSON.stringify(edges)]);
const enviar = (u, d, texto, clave, permite = false) => call(u, 'select tablon_enviar_nota($1, $2, $3, $4, $5, $6)', [d, texto, 'crema', false, permite, clave]);

beforeAll(async () => {
  db = await createDatabase();
  [A, B, C, Z] = await createUsers(db, 4);
  for (const [i, u] of [A, B, C, Z].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lector ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await as(db, u, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(starterRoom())]));
    await call(u, 'select piso_mi_inventario()');
  }
  await as(db, C, (q) => q('insert into blocks (blocked) values ($1)', [A]));
  const { rows } = await db.query('select edificio from edificio_vecinos where user_id = $1', [A]);
  await db.query('insert into edificios default values');
  await db.query('update edificio_vecinos set edificio = (select id from edificios where id <> $1 order by id limit 1) where user_id = $2', [rows[0].edificio, Z]);
}, 60000);

describe('tablón', () => {
  it('las tablas no se pueden tocar directamente', async () => {
    for (const t of ['tablon_tableros', 'tablon_composiciones', 'tablon_items', 'tablon_hilos', 'tablon_recibidas', 'tablon_publico', 'tablon_cuota']) expect(await rejects(as(db, A, (q) => q(`select * from ${t}`)))).toMatch(/permission denied/);
  });

  it('es privado por defecto y nadie más lo modifica ni lo ve', async () => {
    const { actual } = await cargar(A);
    expect(actual.visibility).toBe('private');
    expect((await guardar(A, actual.id, 0, [nota(1, { source_ref: 'libro-privado' }), nota(2)], [hilo(50, 1, 2)])).revision).toBe(1);
    expect(await rejects(guardar(B, actual.id, 1, []))).toMatch(/no es tuya/);
    expect((await visita(B, A)).publico).toBeNull();
    expect(await visita(Z, A)).toBeNull();
    expect(await visita(C, A)).toBeNull();
  });

  it('valida en el servidor y no admite hilos a tarjetas de otro mapa', async () => {
    const { actual } = await cargar(A);
    expect(await rejects(guardar(A, actual.id, 1, [nota(1, { body: 'x'.repeat(201) })]))).toMatch(/check/);
    expect(await rejects(guardar(A, actual.id, 1, [nota(1)], [hilo(51, 1, 99)]))).toMatch(/foreign key/);
    expect(await rejects(guardar(A, actual.id, 1, [nota(1, { x: 'NaN' })]))).toMatch(/check/);
    expect((await cargar(A)).actual.items).toHaveLength(2);
  });

  it('una revisión vieja no sobrescribe: devuelve conflicto', async () => {
    const { actual } = await cargar(A);
    const r = await guardar(A, actual.id, 0, []);
    expect(r.conflicto).toBe(true);
    expect((await cargar(A)).actual.items).toHaveLength(2);
  });

  it('borrar una tarjeta se lleva sus conexiones', async () => {
    const { actual } = await cargar(A);
    await guardar(A, actual.id, actual.revision, [nota(1, { source_ref: 'libro-privado' }), nota(2), nota(3)], [hilo(50, 1, 2), hilo(52, 2, 3)]);
    const siguiente = await cargar(A);
    await guardar(A, actual.id, siguiente.actual.revision, [nota(1, { source_ref: 'libro-privado' }), nota(2)], [hilo(50, 1, 2)]);
    expect((await cargar(A)).actual.edges).toHaveLength(1);
  });

  it('la copia pública no lleva referencias privadas y lo editado después no se filtra', async () => {
    const { actual } = await cargar(A);
    expect((await call(A, 'select tablon_publicar($1, $2)', [actual.id, actual.revision - 1])).conflicto).toBe(true);
    expect((await call(A, 'select tablon_publicar($1, $2)', [actual.id, actual.revision])).publicada).toBe(true);
    await guardar(A, actual.id, actual.revision, [nota(1, { body: 'Secreto posterior' }), nota(2)], [hilo(50, 1, 2)]);
    const v = await visita(B, A);
    const texto = JSON.stringify(v);
    expect(v.publico.items).toHaveLength(2);
    expect(texto).not.toContain('source_ref');
    expect(texto).not.toContain('libro-privado');
    expect(texto).not.toContain('Secreto posterior');
    expect(texto).not.toContain('received_note_id');
  });

  it('volver a privado corta la lectura pública', async () => {
    await call(A, 'select tablon_despublicar()');
    expect((await visita(B, A)).publico).toBeNull();
    expect((await cargar(A)).actual.visibility).toBe('private');
  });

  it('no se puede dejar post-it si el tablón no lo acepta', async () => {
    expect(await rejects(enviar(B, A, 'Hola', uuid(100)))).toMatch(/no recibe/);
    await call(A, 'select tablon_ajustes(true)');
  });

  it('un post-it al día: doble toque devuelve el original y dos claves solo dejan uno', async () => {
    const [x, y] = await Promise.all([enviar(B, A, 'Hola', uuid(101)), enviar(B, A, 'Hola', uuid(101)).catch((e) => e)]);
    expect(x.id).toBeTruthy();
    expect(y.id ?? x.id).toBe(x.id);
    expect(await rejects(enviar(B, A, 'Otro', uuid(102)))).toMatch(/Ya le has dejado/);
    expect((await cargar(A)).recibidas).toHaveLength(1);
    expect((await visita(B, A)).enviada_hoy).toBe(true);
  });

  it('archivar no repone la cuota y otro destino sigue permitido', async () => {
    const { recibidas } = await cargar(A);
    await call(A, 'select tablon_archivar_nota($1)', [recibidas[0].id]);
    expect(await rejects(enviar(B, A, 'Otra vez', uuid(103)))).toMatch(/Ya le has dejado/);
    await call(C, 'select tablon_ajustes(true)');
    expect((await enviar(B, C, 'Para otra persona', uuid(104))).id).toBeTruthy();
  });

  it('bloqueo y texto vacío o largo se rechazan', async () => {
    expect(await rejects(enviar(A, C, 'Hola', uuid(105)))).toMatch(/No puedes/);
    await call(B, 'select tablon_ajustes(true)');
    expect(await rejects(enviar(A, B, 'x'.repeat(201), uuid(106)))).toMatch(/200/);
    expect(await rejects(enviar(A, B, '   ', uuid(107)))).toMatch(/200/);
  });

  it('leer marca solo esa nota y solo la destinataria', async () => {
    await as(db, A, (q) => q('insert into follows (followed) values ($1)', [Z]));
    await call(Z, 'select tablon_ajustes(true)');
    const b1 = await enviar(A, B, 'Primera', uuid(110));
    await db.query("update tablon_cuota set day_utc = day_utc - 1 where idempotency_key = $1", [uuid(110)]);
    const b2 = await enviar(A, B, 'Segunda', uuid(111));
    await call(C, 'select tablon_leer_nota($1)', [b1.id]);
    expect((await cargar(B)).sin_leer).toBe(2);
    await call(B, 'select tablon_leer_nota($1)', [b1.id]);
    const r = await cargar(B);
    expect(r.sin_leer).toBe(1);
    expect(r.recibidas.find((n) => n.id === b2.id).read_at).toBeNull();
  });

  it('sin permiso del remitente no se publica; con permiso sí; revocar retira texto y conexiones', async () => {
    await db.query('delete from tablon_cuota where sender_id = $1', [A]);
    const n = await enviar(A, B, 'Texto firmado', uuid(120));
    let s = await cargar(B);
    const items = [nota(1), { ...nota(2, { kind: 'received', body: 'manipulado' }), received_note_id: n.id }];
    await guardar(B, s.actual.id, s.actual.revision, items, [hilo(50, 1, 2)]);
    s = await cargar(B);
    expect(s.actual.items.find((i) => i.kind === 'received').body).toBe('Texto firmado');
    const no = await call(B, 'select tablon_publicar($1, $2)', [s.actual.id, s.actual.revision]);
    expect(no.faltan).toHaveLength(1);
    expect((await visita(A, B)).publico).toBeNull();
    await call(A, 'select tablon_permiso_nota($1, true)', [n.id]);
    expect((await call(B, 'select tablon_publicar($1, $2)', [s.actual.id, s.actual.revision])).publicada).toBe(true);
    expect((await visita(C, B))?.publico?.items ?? []).toHaveLength(2);
    expect(await rejects(call(C, 'select tablon_retirar_nota($1)', [n.id]))).toMatch(/no es tuya/);
    await call(A, 'select tablon_retirar_nota($1)', [n.id]);
    const v = await visita(C, B);
    expect(JSON.stringify(v)).not.toContain('Texto firmado');
    expect(v.publico.edges).toHaveLength(0);
    expect(v.publico.items).toHaveLength(1);
    s = await cargar(B);
    expect(s.avisos).toHaveLength(1);
    const privada = s.actual.items.find((i) => i.kind === 'received');
    expect(privada.retirada).toBe(true);
    expect(privada.body).toBe('');
  });

  it('una nota ajena no se puede colocar', async () => {
    const r = await cargar(C);
    const ajena = (await cargar(B)).recibidas[0].id;
    expect(await rejects(guardar(C, r.actual.id, r.actual.revision, [{ ...nota(1, { kind: 'received' }), received_note_id: ajena }]))).toMatch(/no es tuya/);
  });

  it('el libro de visitas antiguo solo lo ve su anfitrión', async () => {
    await as(db, A, (q) => q('select piso_firmar($1, $2)', [B, 'saludo']));
    expect((await call(B, 'select piso_social($1)', [B])).visitas.length).toBeGreaterThan(0);
    expect((await call(C, 'select piso_social($1)', [B])).visitas).toHaveLength(0);
  });
});
