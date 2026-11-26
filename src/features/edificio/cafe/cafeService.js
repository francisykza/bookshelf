// El café-librería del bajo (1.120, SPEC §120): las llamadas al servidor (`20261210120000_cafe_local.sql`). Sin la
// migración aplicada, `cargarCafe` devuelve null y el bajo sigue como en la 1.119 (el local en traspaso, sin Decorar).
import { client, fail } from '../../social/services/community';
import { anfitrion } from './cafePersonaje';
import { CAFE_MUEBLES, cabe, deCasa, medidas } from './cafeCatalogo';
import { encargoDe } from './cafeTaller';
import { pilarDe } from './cafeCuaderno';

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
    // 1.130: las servidas de 2 estrellas o más de cada bebida (y de lo de la carta con gesto), para Pilar
    dominio: dominioDe(data.dominio),
    // 1.132: la reputación que espera a que despidas al influencer de la subida, y las fotos firmadas de la pared (niveles)
    espera: Math.min(1000000, Math.max(0, Number.isInteger(data.espera) ? data.espera : 0)),
    fotos: (Array.isArray(data.fotos) ? data.fotos : []).filter((n) => Number.isInteger(n) && n >= 2 && n <= 8),
    // 1.142: el cuaderno de Pilar (null sin la migración)
    pilar: pilarDe(data.pilar),
  };
}

/** El dominio que llega: { clave: servidas } con claves cortas y enteros entre 0 y 99999. */
function dominioDe(x) {
  const out = {};
  if (x && typeof x === 'object' && !Array.isArray(x))
    for (const [k, v] of Object.entries(x)) if (/^[a-z:]{1,24}$/.test(k) && Number.isInteger(v)) out[k] = Math.min(99999, Math.max(0, v));
  return out;
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
    carta: Array.isArray(d.carta) ? d.carta.filter((x) => ['chocolate', 'nata', 'vainilla', 'hielo', 'casa', 'chai', 'brulee'].includes(x)) : [],
    tickets: entero(d.tickets ?? 0),
    // 1.130: la caja del reparto de la mañana ({ claves, granos, faltan }) o null
    reparto: repartoDe(d.reparto),
    clientes: (Array.isArray(d.clientes) ? d.clientes : [])
      .map((c) => ({ ...cliente(c), excentrico: Boolean(c.excentrico), quien: c.excentrico ? entero(c.quien) % 6 : null }))
      // Hasta 10 clientes en el nivel 8 y, con la pizarra de la acera (1.142), 3 más: 13 (el excéntrico es el último)
      .filter((c) => c.n >= 1 && c.n <= 13),
    habituales: (Array.isArray(d.habituales) ? d.habituales : []).map((h) => ({ ...cliente(h), quien: entero(h.quien) })).filter((h) => h.n >= 101 && h.n <= 102 && h.quien >= 0 && h.quien < 12),
    // 1.132: los que vienen por el vídeo viral de un influencer (201 a 203) y de quién era el vídeo
    virales: (Array.isArray(d.virales) ? d.virales : []).map(cliente).filter((v) => v.n >= 201 && v.n <= 203),
    viralesDe: Number.isInteger(d.virales_de) && d.virales_de >= 2 && d.virales_de <= 8 ? d.virales_de : null,
    // 1.132: el influencer del día ({ nivel, servido, sube, estrellas, aTiempo, viral }) o null
    influencer: influencerDe(d.influencer),
  };
}
/** El influencer que llega con el día: su nivel (2 a 8), si ya se fue, si es el de la subida y cómo salió. */
function influencerDe(x) {
  if (!x || typeof x !== 'object' || !Number.isInteger(x.nivel) || x.nivel < 2 || x.nivel > 8) return null;
  return {
    nivel: x.nivel,
    servido: Boolean(x.servido),
    sube: Boolean(x.sube),
    estrellas: x.estrellas == null ? null : Math.min(3, Math.max(1, entero(x.estrellas))),
    aTiempo: Boolean(x.a_tiempo),
    viral: Boolean(x.viral),
  };
}
/**
 * El reparto que llega con el día: como mucho 10 claves, los granos que costó y los que no llegaron. Desde la 1.139, gratis
 * (`gratis`) y cuántos reponen lo vendido (`repuestos`).
 */
function repartoDe(r) {
  if (!r || typeof r !== 'object') return null;
  const claves = (Array.isArray(r.claves) ? r.claves : []).filter((k) => typeof k === 'string' && k).slice(0, 13);
  const faltan = Math.min(99, Math.max(0, entero(r.faltan)));
  if (!claves.length && !faltan) return null;
  return { claves, granos: Math.min(20, Math.max(0, entero(r.granos))), faltan, gratis: r.gratis === true, repuestos: Math.min(claves.length, Math.max(0, entero(r.repuestos))), pilar: Math.min(claves.length, Math.max(0, entero(r.pilar ?? 0))) };
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

/** El día del café (`dia`, AAAA-MM-DD): los clientes, los habituales, los virales y el influencer. null si falta la migración del bloque 3. */
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
 * 1.130 (`20261218120000_cafe_libreria.sql`): llevarle lo preparado con el libro en tres partes: la receta, la clave del
 * ejemplar de la balda (null, solo el café) y lo acertado del libro [género, extensión, forma]. Si el servidor aún no tiene
 * la migración, se sirve como antes (`cafe_servir`: el libro encaja si aciertas el género).
 */
export async function entregarCliente(dia, cliente, receta, libro = null, libroOk = null) {
  const sb = await client();
  const ok = libro ? [0, 1, 2].map((k) => Boolean(libroOk?.[k])) : null;
  const { data, error } = await sb.rpc('cafe_entregar', { dia, cliente, receta, libro: libro ?? null, libro_ok: ok });
  if (sinMigracion(error)) return servirCliente(dia, cliente, receta, libro ? ok[0] : null, libro);
  fail(error);
  return conDia(data);
}

/**
 * 1.132 (`20261219120000_cafe_influencer.sql`): ir a la barra con el influencer del día da la vuelta al reloj de arena (el
 * servidor apunta la hora; volver a empezar no castiga).
 */
export async function empezarInfluencer(dia, nivel) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_influencer_empezar', { dia, nivel });
  fail(error);
  return data;
}

/** Llevarle al influencer lo preparado (como `entregarCliente`): el servidor mira si llegó a tiempo y, al despedirle, sube el café. */
export async function entregarInfluencer(dia, nivel, receta, libro = null, libroOk = null) {
  const sb = await client();
  const ok = libro ? [0, 1, 2].map((k) => Boolean(libroOk?.[k])) : null;
  const { data, error } = await sb.rpc('cafe_influencer_entregar', { dia, nivel, receta, libro: libro ?? null, libro_ok: ok });
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

// ── 1.133: el taller de la trastienda (`20261220120000_cafe_taller.sql`) ──
/** El taller tal como llega: { encargo (con su libro y su cliente, o null), hechos, hoy (el terminado ese día, o null) }. */
function normalizarTaller(t) {
  if (!t || typeof t !== 'object') return null;
  const hoy = t.hoy && Number.isInteger(t.hoy.estrellas) ? { n: t.hoy.n, libro: t.hoy.libro, quien: t.hoy.quien, estrellas: t.hoy.estrellas, granos: entero(t.hoy.granos), reputacion: entero(t.hoy.reputacion) } : null;
  return { encargo: encargoDe(t.encargo), hechos: entero(t.hechos), hoy };
}
/**
 * El taller del día (`dia`, el de la app): el encargo que espera en el banco (si hoy no ha llegado ni se ha terminado otro, llega
 * uno nuevo). null si el servidor no tiene la migración; el error `cafe:taller`, por debajo del nivel 3.
 */
export async function cargarTaller(dia) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_taller', { dia });
  if (sinMigracion(error)) return null;
  fail(error);
  return normalizarTaller(data);
}
/**
 * Terminar un encargo: cómo quedó cada daño, en su orden (`mimo`: 2, bien; 1, se podía mejorar). El servidor pone las estrellas,
 * paga y mira si el café sube. Devuelve { cafe, dia, libros, dado: { granos, reputacion, estrellas }, progreso, taller }.
 */
export async function restaurarEncargo(dia, n, mimo) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_restaurar', { dia, n, mimo: mimo.map((m) => (m === 2 ? 2 : 1)) });
  fail(error);
  return { ...conDia(data), taller: normalizarTaller(data?.taller) };
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
/**
 * 1.139: tus leídos (`titulosDelCafe`, hasta 200), para que el reparto de la mañana traiga alguno tuyo. El servidor no tiene tu
 * biblioteca; sin la migración del catálogo o sin sesión, no pasa nada.
 */
export async function misTitulos(titulos) {
  try {
    const sb = await client();
    const { error } = await sb.rpc('cafe_mis_titulos', { titulos });
    return !error;
  } catch {
    return false;
  }
}

/** La caja de bienvenida (8 ejemplares, gratis y una vez), del catálogo del café y de tus leídos (`titulosDelCafe`). */
export async function bienvenidaLibros(titulos) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_bienvenida', { titulos });
  fail(error);
  return conLibros(data);
}

/** Comprar una caja en la distribuidora: de un género (`genero`) o de un título (`clave`, tuyo o del catálogo). `titulos`, solo tus leídos. */
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

// ── 1.142: el cuaderno de Pilar (`20261224120000_cafe_pilar.sql`) ──
/** Encargar a Pilar el grado siguiente de una tarea ('caja', 'hucha' o 'pizarra'). Devuelve { cafe, libros }. */
export async function mejorarPilar(mejora) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_pilar_mejorar', { mejora });
  fail(error);
  return conLibros(data);
}

/** Recoger la hucha de propinas. Devuelve { recogido, cafe }, o null sin la migración. */
export async function recogerHucha() {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_hucha');
  if (sinMigracion(error)) return null;
  fail(error);
  return { recogido: Math.min(10000, Math.max(0, Number.isInteger(data?.recogido) ? data.recogido : 0)), cafe: normalizar(data?.cafe) };
}

// ── 1.143: el obrador (`20261225120000_cafe_obrador.sql`) ──
const RECETA_ID = /^[a-z]{1,20}$/;
/** El obrador que llega, comprobado: null si aún no se ha abierto. */
export function obradorDe(o) {
  if (!o || typeof o !== 'object') return null;
  const ent = (v, max) => Math.min(max, Math.max(0, Number.isInteger(v) ? v : 0));
  const piezas = {};
  if (o.piezas && typeof o.piezas === 'object') for (const [k, v] of Object.entries(o.piezas)) if (RECETA_ID.test(k) && ent(v, 100) > 0) piezas[k] = ent(v, 100);
  // 1.144: la maestría de cada receta ({ buenas, maestria })
  const recetas = {};
  if (o.recetas && typeof o.recetas === 'object')
    for (const [k, v] of Object.entries(o.recetas)) if (RECETA_ID.test(k) && v && typeof v === 'object') recetas[k] = { buenas: ent(v.buenas, 1000000), maestria: ent(v.maestria, 3) };
  const m = o.mostrador && typeof o.mostrador === 'object' ? o.mostrador : {};
  return {
    // 1.144: si el servidor ya tiene la migración 2 (las mejoras, el mostrador y Pilar en el horno)
    conMejoras: Number.isInteger(o.cupo),
    horno: ent(o.horno, 3) || 1,
    vitrina: ent(o.vitrina, 4) || 1,
    bandejas: ent(o.bandejas, 3) || 1,
    cabe: ent(o.cabe, 100) || 12,
    tartas: ent(o.tartas, 2),
    cupo: ent(o.cupo, 100) || 4,
    mostrador: { dias: ent(m.dias, 7), piezas: ent(m.piezas, 1000000000), granos: ent(m.granos, 1000000000) },
    recetas,
    dado: { horno: ent(o.dado?.horno, 1000000), pilar: ent(o.dado?.pilar, 1000000) },
    horneando: (Array.isArray(o.horneando) ? o.horneando : [])
      .filter((h) => h && Number.isInteger(h.bandeja) && RECETA_ID.test(h.receta ?? ''))
      .slice(0, 3)
      .map((h) => ({ bandeja: ent(h.bandeja, 3), receta: h.receta, piezas: ent(h.piezas, 20), estrellas: ent(h.estrellas, 3) || 1, falta: ent(h.falta, 600), desde: Date.now() })),
    piezas,
    hornadasHoy: ent(o.hornadas_hoy, 1000),
    vendidas: ent(o.vendidas, 1000000),
    // 1.145: las piezas vendidas en total (mesa y mostrador), los hitos dados (0 a 5) y la masa del pan ({ lista } o null)
    vendidasTotal: ent(o.vendidas_total, 1000000000),
    hitos: ent(o.hitos, 5),
    masa: o.masa && typeof o.masa === 'object' ? { lista: o.masa.lista === true } : null,
  };
}
/** 1.145: los hitos nuevos que devuelve el servidor al vender ([3, 4]…). */
const hitosNuevos = (l) => (Array.isArray(l) ? l.filter((k) => Number.isInteger(k) && k >= 1 && k <= 5) : []);
/** Quién pide algo para acompañar ese día: [{ n, tipo, quiere, servido, receta }] (1.145: `quiere`, la receta concreta o null). */
const pidenDe = (l) =>
  (Array.isArray(l) ? l : [])
    .filter((p) => p && Number.isInteger(p.n) && (p.tipo === 'dulce' || p.tipo === 'salado'))
    .map((p) => ({
      n: p.n,
      tipo: p.tipo,
      quiere: RECETA_ID.test(p.quiere ?? '') ? p.quiere : null,
      servido: p.servido === true,
      receta: RECETA_ID.test(p.receta ?? '') ? p.receta : null,
    }));
/** El obrador y quién pide comida ese día: { obrador (null si no se ha abierto), piden }, o null sin la migración. */
export async function cargarObrador(dia) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_obrador', { dia });
  if (sinMigracion(error)) return null;
  fail(error);
  // 1.144: la especialidad del día (sin la migración 2, null)
  return { obrador: obradorDe(data?.obrador), piden: pidenDe(data?.piden), especialidad: RECETA_ID.test(data?.especialidad ?? '') ? data.especialidad : null };
}
/** Abrir el obrador (una vez, desde el nivel 4). Devuelve { obrador, nuevo }. */
export async function abrirObrador() {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_obrador_abrir');
  fail(error);
  return { obrador: obradorDe(data?.obrador), nuevo: data?.nuevo === true };
}
/** Hornear: la receta y cómo quedaron sus dos gestos (2, bien; 1, se podía mejorar). Devuelve { obrador, dado: { bandeja, estrellas, piezas } }. */
export async function hornear(receta, mimo) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_hornear', { receta, mimo: mimo.map((m) => (m === 2 ? 2 : 1)) });
  fail(error);
  const d = data?.dado ?? {};
  return { obrador: obradorDe(data?.obrador), dado: { bandeja: d.bandeja ?? 1, estrellas: d.estrellas ?? 1, piezas: d.piezas ?? 0 } };
}
/** Sacar la hornada de una bandeja. Devuelve { obrador, dado: { receta, sacadas, quedan } }. */
export async function sacarHornada(bandeja) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_sacar_hornada', { bandeja });
  fail(error);
  const d = data?.dado ?? {};
  return { obrador: obradorDe(data?.obrador), dado: { receta: d.receta ?? null, sacadas: d.sacadas ?? 0, quedan: d.quedan ?? 0, estrellas: d.estrellas ?? 1 } };
}
/** Servir algo para acompañar al cliente ya servido. Devuelve { cafe, obrador, dado: { granos, receta } }. */
export async function servirComida(dia, cliente, receta) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_servir_comida', { dia, cliente, receta });
  fail(error);
  const d = data?.dado ?? {};
  return {
    cafe: normalizar(data?.cafe),
    obrador: obradorDe(data?.obrador),
    dado: {
      granos: d.granos ?? 0,
      receta: d.receta ?? receta,
      especialidad: d.especialidad === true,
      maestria: d.maestria === true,
      // 1.145
      excentrico: d.excentrico === true,
      favorito: d.favorito === true,
      hitos: hitosNuevos(d.hitos),
    },
  };
}
/** 1.145: dejar la masa del pan reposando en la bodega (con cómo quedó el amasado). Devuelve { obrador }. */
export async function reposarMasa(amasado) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_masa_reposar', { amasado: amasado === 2 ? 2 : 1 });
  fail(error);
  return { obrador: obradorDe(data?.obrador) };
}

// ── 1.144: las mejoras del obrador, el mostrador y Pilar en el horno (`20261226120000_cafe_obrador_mejoras.sql`) ──
/** Lo que vendió Pilar en el mostrador, comprobado: { dias, piezas, granos, vendidas: { receta: n } }. */
const cobradoDe = (c) => {
  if (!c || typeof c !== 'object') return null;
  const ent = (v, max) => Math.min(max, Math.max(0, Number.isInteger(v) ? v : 0));
  const vendidas = {};
  if (c.vendidas && typeof c.vendidas === 'object') for (const [k, v] of Object.entries(c.vendidas)) if (RECETA_ID.test(k) && ent(v, 1000) > 0) vendidas[k] = ent(v, 1000);
  return { dias: ent(c.dias, 7), piezas: ent(c.piezas, 1000), granos: ent(c.granos, 100000), vendidas, hitos: hitosNuevos(c.hitos) };
};
/** El grado siguiente del horno o de la vitrina. Devuelve { cafe, obrador, cobrado } (lo que vendió Pilar antes, si era la vitrina). */
export async function mejorarObrador(mejora, dia) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_obrador_mejorar', { mejora, dia });
  fail(error);
  return { cafe: normalizar(data?.cafe), obrador: obradorDe(data?.obrador), cobrado: cobradoDe(data?.cobrado) };
}
/** Tirar del cajón: lo que vendió Pilar en el mostrador. Devuelve { cobrado, cafe, obrador }, o null sin la migración. */
export async function cobrarMostrador(dia) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_mostrador', { dia });
  if (sinMigracion(error)) return null;
  fail(error);
  return { cobrado: cobradoDe(data?.cobrado), cafe: normalizar(data?.cafe), obrador: obradorDe(data?.obrador) };
}
/** «Que lo hornee Pilar» (con la receta dominada). Devuelve { obrador, dado: { bandeja, estrellas, piezas } }. */
export async function hornearPilar(receta) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_hornear_pilar', { receta });
  fail(error);
  const d = data?.dado ?? {};
  return { obrador: obradorDe(data?.obrador), dado: { bandeja: d.bandeja ?? 1, estrellas: d.estrellas ?? 3, piezas: d.piezas ?? 0 } };
}

/** Lo que dice cada error del servidor, en palabras de la app. */
export function errorCafe(e) {
  const m = String(e?.message ?? e ?? '');
  if (/cafe:obrador_nivel/.test(m)) return 'Esa mejora se abre en un nivel más alto del café.';
  if (/cafe:obrador_mejora/.test(m)) return 'Ya está en su mejor grado.';
  if (/cafe:maestria/.test(m)) return `${anfitrion().nombre} aún no domina esa receta.`;
  if (/cafe:obrador/.test(m)) return 'El obrador se abre en el nivel 4, con el ala lateral.';
  if (/cafe:hornadas/.test(m)) return 'Por hoy ya se ha horneado bastante. Mañana, más.';
  if (/cafe:horno/.test(m)) return 'El horno está lleno: saca antes lo que hay dentro.';
  if (/cafe:bandeja/.test(m)) return 'Esa bandeja ya no está en el horno. Vuelve a entrar en el obrador.';
  if (/cafe:pronto/.test(m)) return 'Aún no está: espera a la campanilla.';
  if (/cafe:vitrina/.test(m)) return 'La vitrina está llena: lo que no cabe espera en la bandeja.';
  if (/cafe:agotado/.test(m)) return 'Ya no queda de eso en la vitrina.';
  if (/cafe:comida/.test(m)) return 'Eso no es lo que pidió. Vuelve a entrar en el café.';
  if (/cafe:cuaderno_nivel/.test(m)) return 'Esa tarea se abre en un nivel más alto del café.';
  if (/cafe:cuaderno/.test(m)) return `Esa tarea ya la tiene ${anfitrion().nombre} en su mejor grado.`;
  if (/cafe:tueste/.test(m)) return 'No te queda tueste de la casa: baja al tostadero a por el saco.';
  if (/cafe:saco/.test(m)) return 'Hoy ya recogiste el saco: mañana habrá otro en el tambor.';
  if (/cafe:tazas/.test(m)) return 'Ya tienes 99 tazas guardadas: sirve unas cuantas y vuelve a por el saco.';
  if (/cafe:servido/.test(m)) return 'A este cliente ya lo has atendido hoy.';
  if (/cafe:influencer/.test(m)) return 'Ese cliente ya se ha ido. Vuelve a entrar en el café.';
  if (/cafe:taller/.test(m)) return 'El taller se abre en el nivel 3, con la librería.';
  if (/cafe:encargo/.test(m)) return 'Ese encargo ya está terminado. Vuelve a entrar en el taller.';
  if (/cafe:masa/.test(m)) return 'La masa del pan aún está en la bodega: mañana se greña.';
  if (/cafe:mimo/.test(m)) return 'No se ha podido guardar el encargo. Vuelve a intentarlo.';
  if (/cafe:dia/.test(m)) return 'Ha cambiado el día: vuelve a entrar en el café.';
  if (/cafe:cliente|cafe:receta|cafe:libro/.test(m)) return 'No se ha podido atender. Vuelve a entrar en el café.';
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

// ── 1.141: los cafés de los demás (`20261223120000_cafe_social.sql`) ──
const textoDe = (v, max = 80) => (typeof v === 'string' ? v.slice(0, max) : null);
const cifra = (v, max = 2000000000) => Math.min(max, Math.max(0, Number.isInteger(v) ? v : 0));

/**
 * El ranking de cafés: 'edificio' (tus vecinos) o 'seguidos' (quien sigues); tú siempre sales. Devuelve [{ userId, alias,
 * avatarId, cafe, nivel, reputacion, ganados, semana, yo }], o null sin la migración.
 */
export async function cargarRanking(ambito) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_ranking', { ambito });
  if (sinMigracion(error)) return null;
  fail(error);
  return (Array.isArray(data) ? data : [])
    .filter((x) => x && typeof x.user_id === 'string')
    .map((x) => ({
      userId: x.user_id,
      alias: textoDe(x.alias) ?? 'Alguien',
      avatarId: textoDe(x.avatar_id),
      cafe: textoDe(x.cafe) ?? 'Su café',
      nivel: cifra(x.nivel, 99) || 1,
      reputacion: cifra(x.reputacion),
      ganados: cifra(x.ganados),
      semana: cifra(x.semana),
      yo: x.yo === true,
    }));
}

/**
 * El café de otro lector, para pasear y mirar: { userId, alias, avatarId, nombre, nivel, reputacion, plano, escaparate, fotos,
 * libros: [{ clave?, titulo?, genero, balda }] } (de sus leídos, solo el género), o null si no se puede ver.
 */
export async function cargarVisitaCafe(lector) {
  const sb = await client();
  const { data, error } = await sb.rpc('cafe_visita', { lector });
  if (sinMigracion(error)) return null;
  fail(error);
  if (!data || typeof data.user_id !== 'string') return null;
  const nivel = cifra(data.nivel, 99) || 1;
  return {
    userId: data.user_id,
    alias: textoDe(data.alias) ?? 'Alguien',
    avatarId: textoDe(data.avatar_id),
    nombre: textoDe(data.nombre) ?? 'Su café',
    nivel,
    reputacion: cifra(data.reputacion),
    plano: limpio(data.plano, nivel),
    escaparate: escaparateDe(data.escaparate),
    fotos: (Array.isArray(data.fotos) ? data.fotos : []).filter((n) => Number.isInteger(n) && n >= 2 && n <= 8),
    libros: (Array.isArray(data.libros) ? data.libros : [])
      .filter((b) => b && typeof b.genero === 'string')
      .slice(0, 200)
      .map((b) => ({ clave: textoDe(b.clave), titulo: textoDe(b.titulo, 200), genero: b.genero, balda: cifra(b.balda, 99) })),
    // 1.145: su obrador, para mirarlo (el horno, la vitrina con lo que haya y los adornos de los hitos), o null
    obrador: obradorVisita(data.obrador),
  };
}
/** El obrador de una visita, comprobado: { horno, vitrina, hitos, piezas } o null. */
function obradorVisita(o) {
  if (!o || typeof o !== 'object') return null;
  const piezas = {};
  if (o.piezas && typeof o.piezas === 'object') for (const [k, v] of Object.entries(o.piezas)) if (RECETA_ID.test(k) && Number.isInteger(v) && v > 0) piezas[k] = Math.min(100, v);
  const ent = (v, max) => Math.min(max, Math.max(0, Number.isInteger(v) ? v : 0));
  return { horno: ent(o.horno, 3) || 1, vitrina: ent(o.vitrina, 4) || 1, hitos: ent(o.hitos, 5), piezas };
}
