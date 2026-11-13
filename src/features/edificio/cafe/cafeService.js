// El café-librería del bajo (1.120, SPEC §120): las llamadas al servidor (`20261210120000_cafe_local.sql`). Sin la
// migración aplicada, `cargarCafe` devuelve null y el bajo sigue como en la 1.119 (el local en traspaso, sin Decorar).
import { client, fail } from '../../social/services/community';
import { CAFE_MUEBLES, cabe, deCasa, medidas } from './cafeCatalogo';

const sinMigracion = (error) => error && (error.code === 'PGRST202' || error.code === '42883');

/** El plano que llega, otra vez comprobado aquí: lo que no se sepa dibujar o no quepa, fuera. */
function limpio(plano, nivel = 1) {
  const out = { v: 1, items: [] };
  for (const it of Array.isArray(plano?.items) ? plano.items : []) {
    if (!it || typeof it.uid !== 'string' || !medidas(it.id)) continue;
    if (!CAFE_MUEBLES.some((m) => m.id === it.id) && !deCasa(it.id)) continue;
    const item = { uid: it.uid, id: it.id, x: it.x, y: it.y, rot: it.rot };
    if (cabe(out, item, item.uid, nivel)) out.items.push(item);
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
    plano: limpio(data.plano, data.nivel ?? 1),
    inventario: data.inventario ?? {},
    // Bloque 4b (1.123): hasta tres de tus leídos en el escaparate (nivel 5)
    escaparate: escaparateDe(data.escaparate),
    // Bloque 6b (1.127): las tazas de tueste de la casa que te quedan y el día del último saco recogido
    tostadero: tostaderoDe(data.tostadero),
  };
}

/** Lo del tostadero que llega: tazas entre 0 y 99 y el día del último saco (AAAA-MM-DD) o null. */
function tostaderoDe(t) {
  const tazas = Math.min(99, Math.max(0, Math.floor(Number(t?.tazas) || 0)));
  const sacoDia = typeof t?.saco_dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.saco_dia) ? t.saco_dia : null;
  return { tazas, sacoDia };
}

/** El escaparate que llega: como mucho tres títulos con su clave. */
function escaparateDe(x) {
  return (Array.isArray(x) ? x : [])
    .filter((b) => b && typeof b.clave === 'string' && b.clave)
    .slice(0, 3)
    .map((b) => ({ clave: b.clave, titulo: String(b.titulo ?? ''), genero: String(b.genero ?? 'novela') }));
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
    // La carta de ese día (bloque 4a) y los tickets del día que ya dio
    carta: Array.isArray(d.carta) ? d.carta.filter((x) => ['chocolate', 'nata', 'vainilla', 'hielo', 'casa'].includes(x)) : [],
    tickets: entero(d.tickets ?? 0),
    clientes: (Array.isArray(d.clientes) ? d.clientes : [])
      .map((c) => ({ ...cliente(c), excentrico: Boolean(c.excentrico), quien: c.excentrico ? entero(c.quien) % 6 : null }))
      // Hasta 9 clientes desde el nivel 7 (el excéntrico es el último: con 8 en el nivel 6 ya hacía falta pasar del 7)
      .filter((c) => c.n >= 1 && c.n <= 10),
    habituales: (Array.isArray(d.habituales) ? d.habituales : []).map((h) => ({ ...cliente(h), quien: entero(h.quien) })).filter((h) => h.n >= 101 && h.n <= 102 && h.quien >= 0 && h.quien < 12),
    pizarra: (Array.isArray(d.pizarra) ? d.pizarra : [])
      .map((r) => ({ dia: String(r.dia ?? ''), quien: entero(r.quien), frase: entero(r.frase), dorada: Boolean(r.dorada) }))
      .filter((r) => (r.dorada ? r.quien < 6 : r.quien < 12) && r.frase < 12),
  };
}
/** Tus libros del café (§121.3): los huecos de la balda, si ya llegó la bienvenida y cada título con su caja y su balda. */
function normalizarLibros(l) {
  if (!l) return null;
  const n = (v, max) => Math.min(max, Math.max(0, entero(v)));
  return {
    huecos: n(l.huecos, 99) || 12,
    bienvenida: Boolean(l.bienvenida),
    libros: (Array.isArray(l.libros) ? l.libros : [])
      .filter((b) => b && typeof b.clave === 'string' && b.clave)
      .map((b) => ({ clave: b.clave, titulo: String(b.titulo ?? ''), genero: String(b.genero ?? 'novela'), caja: n(b.caja, 999), balda: n(b.balda, 99) }))
      .filter((b) => b.caja > 0 || b.balda > 0),
  };
}
/** Lo nuevo tras un servicio (bloque 4a): niveles con sus tickets, hitos, granos de hito y tickets del día. */
function normalizarProgreso(p) {
  if (!p || typeof p !== 'object') return null;
  const lista = (x) => (Array.isArray(x) ? x.filter((y) => y && Number.isInteger(y.nivel)) : []);
  return { de: p.de ?? 1, a: p.a ?? 1, niveles: lista(p.niveles), hitos: lista(p.hitos), granos: p.granos ?? 0, ticketsDia: p.tickets_dia ?? 0, tickets: p.tickets ?? 0 };
}
const conDia = (data) => ({
  cafe: normalizar(data?.cafe),
  dia: normalizarDia(data?.dia),
  libros: normalizarLibros(data?.libros),
  dado: data?.dado ?? null,
  progreso: normalizarProgreso(data?.progreso),
});
const conLibros = (data) => ({ cafe: normalizar(data?.cafe), libros: normalizarLibros(data?.libros), caja: Array.isArray(data?.caja) ? data.caja.filter((k) => typeof k === 'string') : [] });

/** El día del café (`dia`, AAAA-MM-DD): los clientes, los habituales y la pizarra. null si falta la migración del bloque 3. */
export async function cargarDia(dia) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_dia', { dia });
  if (sinMigracion(error)) return null;
  fail(error);
  return conDia(data);
}

/**
 * Jornadas de prueba (1.126, solo para las cuentas de `cafe_probadores`): el día de prueba que toca jugar (AAAA-MM-DD) o null
 * (no prueba, o el servidor no tiene la migración `20261215120000_cafe_probador.sql`; nunca rompe el café).
 */
export async function cargarJornada() {
  try {
    const sb = await client();
    const { data, error } = await sb.rpc('cafe_jornada');
    if (error || typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
    return data;
  } catch {
    return null;
  }
}

/** Otra jornada de prueba, con todos los de la actual atendidos: devuelve el día nuevo. */
export async function nuevaJornada() {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_nueva_jornada');
  fail(error);
  return String(data);
}

/** Has leído hoy: llega un habitual (el servidor pone el tope de 2). */
export async function llegaHabitual(dia) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_habitual', { dia });
  fail(error);
  return conDia(data);
}

/**
 * Llevarle a un cliente lo preparado: la receta [bebida, grano, leche, toque], si el libro que le diste encaja (null, sin
 * libro) y la clave de ese libro de la balda (si encaja, se lo lleva y paga 2 granos más).
 */
export async function servirCliente(dia, cliente, receta, encaja, libro = null) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_servir', { dia, cliente, receta, encaja: encaja ?? null, libro: libro ?? null });
  fail(error);
  return conDia(data);
}

/**
 * Bloque 6b (1.127, `20261216120000_cafe_tostadero.sql`): recoger el saco del día del tambor del tostadero (`dia`, el de la
 * app). Devuelve { cafe, tazas } con las tazas que ha dado.
 */
export async function recogerSaco(dia) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_recoger_saco', { dia });
  fail(error);
  return { cafe: normalizar(data?.cafe), tazas: Number(data?.tazas) || 0 };
}

// ── Bloque 4b (1.123): el escaparate y lo que se ve desde la calle (`20261213120000_cafe_ampliacion.sql`) ──
/** Pone en el escaparate hasta tres de tus leídos (`titulosDelCafe` de los elegidos). */
export async function ponerEscaparate(titulos) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_poner_escaparate', { titulos });
  fail(error);
  return normalizar(data);
}

/** Tu café visto desde la calle: { inaugurado, nombre, nivel, escaparate } o null (sin café o sin la migración). */
export async function cargarFachada() {
  try {
    const sb = await client();
    const { data, error } = await sb.rpc('cafe_fachada');
    if (error || !data) return null;
    return { inaugurado: Boolean(data.inaugurado), nombre: typeof data.nombre === 'string' ? data.nombre : null, nivel: Number.isInteger(data.nivel) ? data.nivel : 1, escaparate: escaparateDe(data.escaparate) };
  } catch {
    return null;
  }
}

// ── Libros en cajas (§121.3) ──
/** La caja de bienvenida (8 ejemplares, gratis y una vez) con tus títulos (`titulosDelCafe`). */
export async function bienvenidaLibros(titulos) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_bienvenida', { titulos });
  fail(error);
  return conLibros(data);
}

/** Comprar una caja en la distribuidora: de un género (`genero`) o de un título (`clave`). */
export async function comprarCaja({ genero = null, clave = null }, titulos) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_comprar_caja', { genero, clave, titulos });
  fail(error);
  return conLibros(data);
}

/** Sube ejemplares de la caja a la balda (`poner`, una clave por ejemplar) o los devuelve a la caja (`quitar`). */
export async function colocarLibros(poner = [], quitar = []) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_colocar', { poner, quitar });
  fail(error);
  return conLibros(data);
}

/** Lo que dice cada error del servidor, en palabras de la app. */
export function errorCafe(e) {
  const m = String(e?.message ?? e ?? '');
  if (/cafe:tueste/.test(m)) return 'No te queda tueste de la casa: baja al tostadero a por el saco.';
  if (/cafe:saco/.test(m)) return 'Hoy ya recogiste el saco: mañana habrá otro en el tambor.';
  if (/cafe:tazas/.test(m)) return 'Ya tienes 99 tazas guardadas: sirve unas cuantas y vuelve a por el saco.';
  if (/cafe:servido/.test(m)) return 'A este cliente ya lo has atendido hoy.';
  if (/cafe:dia/.test(m)) return 'Ha cambiado el día: vuelve a entrar en el café.';
  if (/cafe:cliente|cafe:receta/.test(m)) return 'No se ha podido atender. Vuelve a entrar en el café.';
  if (/cafe:granos/.test(m)) return 'Aún no tienes granos suficientes.';
  if (/cafe:bienvenida/.test(m)) return 'La caja de bienvenida ya te llegó.';
  if (/cafe:titulos|cafe:titulo|cafe:genero/.test(m)) return 'La distribuidora no tiene ese libro. Vuelve a entrar en el café.';
  if (/cafe:colocar/.test(m)) return 'Son demasiados de una vez.';
  if (/cafe:copias/.test(m)) return 'No te quedan copias libres de ese mueble: lo tienes puesto en tu piso o en el café.';
  if (/cafe:plano/.test(m)) return 'Eso no cabe ahí.';
  if (/cafe:ya/.test(m)) return 'El café ya está inaugurado.';
  if (/cafe:nivel/.test(m)) return 'El escaparate se abre en el nivel 5.';
  if (/cafe:pendientes/.test(m)) return 'Aún queda alguien por atender en esta jornada.';
  if (/cafe:probador/.test(m)) return 'Las jornadas de prueba solo están en la cuenta de pruebas.';
  return 'No se ha podido guardar. Vuelve a intentarlo.';
}
