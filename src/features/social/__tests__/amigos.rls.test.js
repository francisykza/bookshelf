// 1.153 · La app «Amigos» del ordenador (docs/qa/amigos-vecinos.md, bloque 3), en un Postgres real (PGlite) con todas las
// migraciones: el código de amigo, las solicitudes, lo que cada cual comparte de su lectura (y lo que apaga), recomendar un
// libro, «Leemos el mismo» y la llave del edificio enviada a un amigo. Solo entre amigos (os seguís los dos, sin bloqueo).
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from './supabaseHarness';

let db;
let A, B, C, D, E;

const call = (u, sql, params) => as(db, u, (q) => q(sql, params));
const uno = async (u, sql, params) => Object.values((await call(u, sql, params))[0])[0];
const panel = (u) => uno(u, 'select amigos_panel()');
const seguir = (u, otro) => call(u, 'insert into follows (followed) values ($1)', [otro]);
const LEYENDO = JSON.stringify([{ titulo: '  La   sombra del viento ', autor: 'Carlos Ruiz Zafón' }]);
const TERMINADOS = JSON.stringify([{ titulo: 'Rebeca', autor: 'Daphne du Maurier', fecha: '2026-11-20T10:00:00Z' }]);

beforeAll(async () => {
  db = await createDatabase();
  [A, B, C, D, E] = await createUsers(db, 5);
  for (const [i, u] of [A, B, C, D, E].entries()) {
    await call(u, "insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', $2)", [['Ana', 'Bruno', 'Carla', 'Dani', 'Elena'][i], i !== 4]);
    if (i !== 4) await call(u, 'select asignar_edificio()');
  }
  // A y B, amigos; C sigue a A (solicitud); A sigue a D, que no la sigue (esperando)
  await seguir(A, B);
  await seguir(B, A);
  await seguir(C, A);
  await seguir(A, D);
}, 60000);

describe('la app Amigos en el servidor', () => {
  it('tu código de amigo: siempre el mismo, y te encuentran con él (escrito como sea)', async () => {
    const cod = await uno(A, 'select amigos_mi_codigo()');
    expect(cod).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(await uno(A, 'select amigos_mi_codigo()')).toBe(cod);
    const visto = await uno(C, 'select amigos_buscar_codigo($1)', [`${cod.slice(0, 4).toLowerCase()} - ${cod.slice(4)}`]);
    expect(visto).toMatchObject({ user_id: A, alias: 'Ana' });
    // El tuyo no te encuentra a ti, ni un código que no existe
    expect(await uno(A, 'select amigos_buscar_codigo($1)', [cod])).toBeNull();
    expect(await uno(C, 'select amigos_buscar_codigo($1)', ['ZZZZZZZZ'])).toBeNull();
    // Sin la comunidad, nada
    expect(await rejects(call(E, 'select amigos_mi_codigo()'))).toMatch(/Activa la comunidad/);
  });

  it('el panel: amigos, solicitudes (te siguen y tú aún no) y a quién esperas', async () => {
    const p = await panel(A);
    expect(p.amigos.map((x) => x.alias)).toEqual(['Bruno']);
    expect(p.solicitudes.map((x) => x.alias)).toEqual(['Carla']);
    expect(p.esperando.map((x) => x.alias)).toEqual(['Dani']);
    expect(p.ajustes).toEqual({ leyendo: true, terminados: true, juntos: true });
    expect(p.amigos[0].vecino).toBe(false);
    // Las tablas, cerradas
    expect(await rejects(call(B, 'select * from amigos_lectura'))).toMatch(/permission denied/);
    expect(await rejects(call(B, 'select * from amigos_codigos'))).toMatch(/permission denied/);
  });

  it('lo que compartes: solo títulos, limpios; lo apagado no se guarda y tus amigos dejan de verlo', async () => {
    await call(A, 'select amigos_publicar($1::jsonb, $2::jsonb)', [LEYENDO, TERMINADOS]);
    let amiga = (await panel(B)).amigos.find((x) => x.user_id === A);
    expect(amiga.leyendo).toEqual([{ titulo: 'La sombra del viento', autor: 'Carlos Ruiz Zafón' }]);
    expect(amiga.terminados).toEqual([{ titulo: 'Rebeca', autor: 'Daphne du Maurier', fecha: '2026-11-20' }]);
    // Quien no es amigo no ve nada (ni aparece)
    expect((await panel(C)).amigos).toEqual([]);
    // Apagar «qué leo ahora»: se borra y deja de verse
    await call(A, 'select amigos_ajustes(false, true, true)');
    expect((await db.query('select leyendo from amigos_lectura where user_id = $1', [A])).rows[0].leyendo).toBeNull();
    await call(A, 'select amigos_publicar($1::jsonb, $2::jsonb)', [LEYENDO, TERMINADOS]);
    amiga = (await panel(B)).amigos.find((x) => x.user_id === A);
    expect(amiga.leyendo).toBeNull();
    expect(amiga.terminados).toHaveLength(1);
    await call(A, 'select amigos_ajustes(true, true, true)');
  });

  it('recomendar un libro: a amigos, con frase cerrada, una vez por libro', async () => {
    await call(A, "select amigos_recomendar($1, 'Rebeca', 'Daphne du Maurier', 'te_gustara')", [B]);
    const p = await panel(B);
    expect(p.recomendaciones).toHaveLength(1);
    expect(p.recomendaciones[0]).toMatchObject({ alias: 'Ana', titulo: 'Rebeca', frase: 'te_gustara', vista: false });
    expect(await rejects(call(A, "select amigos_recomendar($1, 'rebeca', '', 'me_acorde')", [B]))).toMatch(/Ya le recomendaste/);
    expect(await rejects(call(A, "select amigos_recomendar($1, 'Otro', '', 'hola, mira esto')", [B]))).toMatch(/frases/);
    expect(await rejects(call(A, "select amigos_recomendar($1, 'Otro', '', 'te_gustara')", [C]))).toMatch(/amigos/);
    await call(B, 'select amigos_recomendaciones_vistas()');
    expect((await panel(B)).recomendaciones[0].vista).toBe(true);
  });

  it('Leemos el mismo: proponer, aceptar, cada uno ve el avance del otro (si lo comparte) y dejarlo', async () => {
    const { id } = await uno(A, "select amigos_juntos_proponer($1, 'Rebeca', 'Daphne du Maurier')", [B]);
    let deB = (await panel(B)).juntos[0];
    expect(deB).toMatchObject({ id, alias: 'Ana', estado: 'invitada', propuse: false });
    // Solo quien la recibe la acepta
    expect(await rejects(call(A, 'select amigos_juntos_responder($1, true)', [id]))).toMatch(/ya no está/);
    await call(B, 'select amigos_juntos_responder($1, true)', [id]);
    await call(A, 'select amigos_publicar($1::jsonb, $2::jsonb, $3::jsonb)', [LEYENDO, TERMINADOS, JSON.stringify([{ id, pct: 42.6 }])]);
    await call(B, 'select amigos_publicar($1::jsonb, $2::jsonb, $3::jsonb)', ['[]', '[]', JSON.stringify([{ id, pct: 180 }])]);
    deB = (await panel(B)).juntos[0];
    expect(deB).toMatchObject({ estado: 'activa', avance_mio: 100, avance_suyo: 43 });
    // Si A apaga compartir su avance, B deja de verlo
    await call(A, 'select amigos_ajustes(true, true, false)');
    expect((await panel(B)).juntos[0].avance_suyo).toBeNull();
    expect((await panel(A)).juntos[0].avance_mio).toBeNull();
    await call(A, 'select amigos_ajustes(true, true, true)');
    expect(await rejects(call(A, "select amigos_juntos_proponer($1, 'REBECA', '')", [B]))).toMatch(/Ya estáis/);
    await call(B, 'select amigos_juntos_dejar($1)', [id]);
    expect((await panel(A)).juntos).toEqual([]);
  });

  it('la llave del edificio, para un amigo: le llega a su app, una sola a la vez, y abre como las del telefonillo', async () => {
    const llave = await uno(A, 'select amigos_dar_llave($1)', [B]);
    expect(llave.codigo).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect((await panel(B)).llaves).toEqual([expect.objectContaining({ codigo: llave.codigo, alias: 'Ana' })]);
    expect((await panel(A)).llaves_dadas).toEqual([B]);
    expect(await rejects(call(A, 'select amigos_dar_llave($1)', [B]))).toMatch(/Ya le diste una llave/);
    expect(await rejects(call(A, 'select amigos_dar_llave($1)', [C]))).toMatch(/solo a amigos/);
    await call(B, 'select edificio_mudarse($1)', [llave.codigo]);
    const p = await panel(B);
    expect(p.llaves).toEqual([]);
    expect(p.amigos[0].vecino).toBe(true);
    expect(await rejects(call(A, 'select amigos_dar_llave($1)', [B]))).toMatch(/mismo edificio/);
  });

  it('un bloqueo lo corta todo: ni amigos, ni recomendaciones, ni código', async () => {
    const cod = await uno(B, 'select amigos_mi_codigo()');
    await call(A, 'insert into blocks (blocked) values ($1)', [B]);
    const p = await panel(A);
    expect(p.amigos).toEqual([]);
    expect((await panel(B)).recomendaciones).toEqual([]);
    expect(await uno(A, 'select amigos_buscar_codigo($1)', [cod])).toBeNull();
    expect(await rejects(call(A, "select amigos_recomendar($1, 'Drácula', '', 'te_gustara')", [B]))).toMatch(/amigos/);
  });
});
