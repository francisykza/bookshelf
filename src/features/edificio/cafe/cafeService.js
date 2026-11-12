// El café-librería del bajo (1.120, SPEC §120): las llamadas al servidor (`20261210120000_cafe_local.sql`). Sin la
// migración aplicada, `cargarCafe` devuelve null y el bajo sigue como en la 1.119 (el local en traspaso, sin Decorar).
import { client, fail } from '../../social/services/community';
import { CAFE_MUEBLES, cabe, deCasa, medidas } from './cafeCatalogo';

const sinMigracion = (error) => error && (error.code === 'PGRST202' || error.code === '42883');

/** El plano que llega, otra vez comprobado aquí: lo que no se sepa dibujar o no quepa, fuera. */
function limpio(plano) {
  const out = { v: 1, items: [] };
  for (const it of Array.isArray(plano?.items) ? plano.items : []) {
    if (!it || typeof it.uid !== 'string' || !medidas(it.id)) continue;
    if (!CAFE_MUEBLES.some((m) => m.id === it.id) && !deCasa(it.id)) continue;
    const item = { uid: it.uid, id: it.id, x: it.x, y: it.y, rot: it.rot };
    if (cabe(out, item)) out.items.push(item);
  }
  return out;
}

function normalizar(data) {
  if (!data) return null;
  return {
    nombre: data.nombre ?? null,
    nivel: data.nivel ?? 1,
    reputacion: data.reputacion ?? 0,
    granos: data.granos ?? 0,
    inaugurado: Boolean(data.inaugurado),
    plano: limpio(data.plano),
    inventario: data.inventario ?? {},
  };
}

/** Mi café (o null si el servidor aún no tiene la migración del café). */
export async function cargarCafe() {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_mio');
  if (sinMigracion(error)) return null;
  fail(error);
  return normalizar(data);
}

/** Pilar te da las llaves: el nombre, de la lista cerrada. */
export async function inaugurarCafe(nombre) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_inaugurar', { nombre });
  fail(error);
  return normalizar(data);
}

/** Guarda lo decorado; el servidor lo vuelve a comprobar. */
export async function guardarCafe(plano) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_guardar', { plano: { v: 1, items: plano.items.map(({ uid, id, x, y, rot }) => ({ uid, id, x, y, rot })) } });
  fail(error);
  return normalizar(data);
}

/** Compra un mueble del café con granos. */
export async function comprarCafe(mueble) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_comprar', { mueble });
  fail(error);
  return normalizar(data);
}

// ── Bloque 3 (1.121): los clientes del día (`20261211120000_cafe_clientes.sql`) ──
const entero = (v) => (Number.isInteger(v) ? v : 0);
function normalizarDia(d) {
  if (!d) return null;
  const estrellas = (e) => (e == null ? null : Math.min(3, Math.max(1, entero(e))));
  const cliente = (c) => ({ n: entero(c.n), semilla: entero(c.semilla), servido: Boolean(c.servido), encaja: c.encaja == null ? null : Boolean(c.encaja), estrellas: estrellas(c.estrellas) });
  return {
    dia: String(d.dia ?? ''),
    clientes: (Array.isArray(d.clientes) ? d.clientes : [])
      .map((c) => ({ ...cliente(c), excentrico: Boolean(c.excentrico), quien: c.excentrico ? entero(c.quien) % 6 : null }))
      .filter((c) => c.n >= 1 && c.n <= 5),
    habituales: (Array.isArray(d.habituales) ? d.habituales : []).map((h) => ({ ...cliente(h), quien: entero(h.quien) })).filter((h) => h.n >= 101 && h.n <= 102 && h.quien >= 0 && h.quien < 12),
    pizarra: (Array.isArray(d.pizarra) ? d.pizarra : [])
      .map((r) => ({ dia: String(r.dia ?? ''), quien: entero(r.quien), frase: entero(r.frase), dorada: Boolean(r.dorada) }))
      .filter((r) => (r.dorada ? r.quien < 6 : r.quien < 12) && r.frase < 12),
  };
}
const conDia = (data) => ({ cafe: normalizar(data?.cafe), dia: normalizarDia(data?.dia), dado: data?.dado ?? null });

/** El día del café (`dia`, AAAA-MM-DD): los clientes, los habituales y la pizarra. null si falta la migración del bloque 3. */
export async function cargarDia(dia) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_dia', { dia });
  if (sinMigracion(error)) return null;
  fail(error);
  return conDia(data);
}

/** Has leído hoy: llega un habitual (el servidor pone el tope de 2). */
export async function llegaHabitual(dia) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_habitual', { dia });
  fail(error);
  return conDia(data);
}

/** Llevarle a un cliente lo preparado: la receta [bebida, grano, leche, toque] y si el libro que le diste encaja (null, sin libro). */
export async function servirCliente(dia, cliente, receta, encaja) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_servir', { dia, cliente, receta, encaja: encaja ?? null });
  fail(error);
  return conDia(data);
}

/** Lo que dice cada error del servidor, en palabras de la app. */
export function errorCafe(e) {
  const m = String(e?.message ?? e ?? '');
  if (/cafe:servido/.test(m)) return 'A este cliente ya lo has atendido hoy.';
  if (/cafe:dia/.test(m)) return 'Ha cambiado el día: vuelve a entrar en el café.';
  if (/cafe:cliente|cafe:receta/.test(m)) return 'No se ha podido atender. Vuelve a entrar en el café.';
  if (/cafe:granos/.test(m)) return 'Aún no tienes granos suficientes.';
  if (/cafe:copias/.test(m)) return 'No te quedan copias libres de ese mueble: lo tienes puesto en tu piso o en el café.';
  if (/cafe:plano/.test(m)) return 'Eso no cabe ahí.';
  if (/cafe:ya/.test(m)) return 'El café ya está inaugurado.';
  return 'No se ha podido guardar. Vuelve a intentarlo.';
}
