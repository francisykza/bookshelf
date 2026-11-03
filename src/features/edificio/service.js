// Servicio de «El edificio del puerto» (1.63, SPEC §63): todo pasa por el cliente de Supabase de la app y lo protegen
// las políticas de supabase/migrations/20261101120000_edificio_puerto.sql. El reparto en edificios lo hace el servidor
// (`asignar_edificio`), y el portal llega en una sola consulta (`edificio_portal`). Los pisos que llegan se vuelven a
// validar aquí antes de dibujarlos; el que se guarda va siempre limpio (`validateRoom`).
import { client, fail } from '../social/services/community';
import { PRENDAS, validateAvatar } from './actor';
import { FIRMAS, catalogItem } from './catalog';
import { rarezaOf } from './economy';
import { normalizeInventory } from './inventory';
import { validateRoom } from './room';

const DOORS = ['3B', '3A', '2B', '2A', '1B', '1A'];
export const doorLabel = (p) => `${p[0]}.º ${p[1]}`;

let available = null;

/**
 * ¿Está aplicada la migración del edificio en este servidor? Se recuerda solo un «sí» o un «no» claros; un fallo de
 * red no se recuerda (y mientras tanto la tablet hace lo de siempre: abrir la comunidad).
 */
export async function edificioAvailable() {
  if (available !== null) return available;
  try {
    const sb = await client();
    const { error } = await sb.from('pisos').select('user_id').limit(1);
    fail(error);
    available = true;
  } catch (e) {
    if (e.code === 'unavailable' || e.code === 'off') available = false;
    return false;
  }
  return available;
}

/** Mi puerta (me la asigna el servidor la primera vez) y mis vecinos, con sus pisos ya validados. */
export async function loadEdificio() {
  const sb = await client();
  const assigned = await sb.rpc('asignar_edificio');
  fail(assigned.error);
  const { data, error } = await sb.rpc('edificio_portal');
  fail(error);
  if (!data) throw Object.assign(new Error('No se ha podido encontrar tu edificio.'), { code: 'edificio' });
  const vecinos = (data.vecinos ?? []).map((v) => ({ ...v, room: v.layout ? validateRoom(v.layout) : null, personaje: validateAvatar(v.personaje) }));
  return { edificio: data.edificio, puerta: data.puerta, vecinos };
}

/** Las seis puertas en orden (de arriba abajo), con quien viva en cada una o null si está libre. */
export function doorsOf(vecinos) {
  return DOORS.map((puerta) => ({ puerta, vecino: vecinos.find((v) => v.puerta === puerta) ?? null }));
}

export async function savePiso(userId, room) {
  const layout = validateRoom(room);
  if (!layout) throw Object.assign(new Error('Ese piso no es válido.'), { code: 'invalid' });
  const sb = await client();
  const { error } = await sb.from('pisos').upsert({ user_id: userId, layout }, { onConflict: 'user_id' });
  fail(error);
}

// El personaje (§69) se recuerda también en el dispositivo: así no se pierde si la migración aún no está aplicada
const AVATAR_KEY = (userId) => `bookshelf:edificio:personaje:${userId}`;
export function localAvatar(userId) {
  try {
    return validateAvatar(JSON.parse(localStorage.getItem(AVATAR_KEY(userId)) ?? 'null'));
  } catch {
    return null;
  }
}

/** Guarda el aspecto de tu personaje (lo ven tus vecinos). Sin la columna en el servidor, solo queda en el dispositivo. */
export async function savePersonaje(userId, avatar) {
  const personaje = validateAvatar(avatar);
  if (!personaje) throw Object.assign(new Error('Ese personaje no es válido.'), { code: 'invalid' });
  try {
    localStorage.setItem(AVATAR_KEY(userId), JSON.stringify(personaje));
  } catch {
    // Sin almacenamiento: solo el servidor
  }
  const sb = await client();
  const { error } = await sb.from('pisos').update({ personaje }).eq('user_id', userId);
  if (error && (error.code === 'PGRST204' || error.code === '42703')) return { local: true };
  fail(error);
  return { local: false };
}

/** El místico legendario que te acompaña (docs/qa/misticos.md), o null. El servidor comprueba que lo tienes. */
export async function saveCompanero(userId, companero) {
  const sb = await client();
  const { error } = await sb.from('pisos').update({ companero }).eq('user_id', userId);
  fail(error);
}

/**
 * Mi inventario de muebles (1.66, §66): { inicioElegido, copias }. Si la migración del inventario no está aplicada,
 * null (y la balda ofrece todo como antes).
 */
export async function loadInventario() {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_mi_inventario');
  // Función que no existe: la migración aún no está aplicada en este servidor
  if (error && (error.code === 'PGRST202' || error.code === '42883')) return null;
  fail(error);
  return normalizeInventory(data);
}

// Armario del personaje y misiones del día (1.70, §70): { prendas: [«clave:valor»], hechas: [misiones del día], nueva,
// tickets } (`tickets`, desde la 1.79: los ganados al completar las tres con todo el armario ya tuyo)
const normalizeArmario = (d) => ({ prendas: Array.isArray(d?.prendas) ? d.prendas.filter((p) => PRENDAS.includes(p)) : [], hechas: Array.isArray(d?.hechas) ? d.hechas : [], nueva: PRENDAS.includes(d?.nueva) ? d.nueva : null, tickets: Number.isInteger(d?.tickets) && d.tickets > 0 ? d.tickets : 0 });

/** Mi armario y lo hecho hoy (`dia`: «AAAA-MM-DD» del dispositivo). Sin la migración de las misiones, null. */
export async function loadArmario(dia) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_mi_armario', { dia });
  if (error && (error.code === 'PGRST202' || error.code === '42883')) return null;
  fail(error);
  return normalizeArmario(data);
}

/** Cuenta una misión del día. Si con ella están las tres, `nueva` trae la prenda ganada (o `tickets`, sin ropa por ganar). */
export async function contarDiaria(mision, dia) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_mision_diaria', { mision, dia });
  fail(error);
  return normalizeArmario(data);
}

/** Los seis muebles comunes de inicio (una sola vez). Devuelve el inventario nuevo. */
export async function elegirInicio(ids) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_elegir_inicio', { muebles: ids });
  fail(error);
  return normalizeInventory(data);
}

/** 1.67 (§67): cobra los tickets de una misión cumplida (una vez por semana; `semana`: el lunes, AAAA-MM-DD). */
export async function reclamarMision(mision, semana) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_reclamar_mision', { mision, semana });
  fail(error);
  return normalizeInventory(data);
}

/** Compra un mueble en la tienda del bajo. Devuelve el inventario nuevo. */
export async function comprar(mueble) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_comprar', { mueble });
  fail(error);
  return normalizeInventory(data);
}

/** Abre un sobre de la pared, de 1 o de 5 (sorteo en el servidor): { premios: [{ mueble, rareza, nuevo }], inventario }. */
export async function abrirSobre(sobre, cuantos) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_abrir_sobre', { sobre, cuantos });
  fail(error);
  const premios = (Array.isArray(data?.premios) ? data.premios : [])
    .filter((p) => catalogItem(p?.mueble))
    .map((p) => ({ mueble: p.mueble, rareza: rarezaOf(catalogItem(p.mueble)), nuevo: p.nuevo === true }));
  return { premios, inventario: normalizeInventory(data?.inventario) };
}

/** Recicla una copia libre (no colocada) a cambio de tickets. */
export async function reciclar(mueble) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_reciclar', { mueble });
  fail(error);
  return normalizeInventory(data);
}

/** Deja (o cambia) mi sello en el buzón de un vecino; `sello` null lo quita. */
export async function setSello(userId, para, sello) {
  const sb = await client();
  if (!sello) {
    const { error } = await sb.from('piso_sellos').delete().eq('de', userId).eq('para', para);
    fail(error);
    return;
  }
  const { error } = await sb.from('piso_sellos').upsert({ de: userId, para, sello }, { onConflict: 'de,para' });
  fail(error);
}

// ── Vecinos (1.71, §71): regalos, libro de visitas y «me gusta» por mueble ──
const normalizeSocial = (d) => ({
  visitas: Array.isArray(d?.visitas) ? d.visitas.filter((v) => FIRMAS.some((f) => f.id === v.frase)) : [],
  megusta: d?.megusta && typeof d.megusta === 'object' ? d.megusta : {},
  mios: Array.isArray(d?.mios) ? d.mios.map(Number) : [],
  regalos: Array.isArray(d?.regalos) ? d.regalos.filter((r) => catalogItem(r.mueble)) : [],
});

/** Lo social de un piso (el tuyo o el de un vecino). Sin la migración de los vecinos, null. */
export async function loadSocial(piso) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_social', { piso });
  if (error && (error.code === 'PGRST202' || error.code === '42883')) return null;
  fail(error);
  return normalizeSocial(data);
}

/** Firma el libro de visitas de un vecino con una frase cerrada. */
export async function firmar(piso, frase) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_firmar', { piso, frase });
  fail(error);
  return normalizeSocial(data);
}

/** «Me gusta» (o quitarlo) a un mueble del piso de un vecino. */
export async function meGusta(piso, uid, si) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_megusta', { piso, uid, si });
  fail(error);
  return normalizeSocial(data);
}

/** Regala una copia libre de un mueble a un vecino. Devuelve tu inventario nuevo. */
export async function regalar(para, mueble) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_regalar', { para, mueble });
  fail(error);
  return normalizeInventory(data);
}

// ── La suite de la semana del Gran Hotel, decorada entre todos (1.79, supabase/migrations/20261109130000_hotel_suite_semana.sql) ──
const normalizeSuite = (d) => {
  const room = d?.layout ? validateRoom(d.layout) : null;
  const uids = new Set(room?.items.map((i) => i.uid) ?? []);
  return {
    semana: typeof d?.semana === 'string' ? d.semana : null,
    room,
    aportes: Array.isArray(d?.aportes) ? d.aportes.filter((a) => uids.has(a?.uid) && catalogItem(a.mueble)).map((a) => ({ uid: a.uid, alias: String(a.alias ?? ''), avatarId: a.avatar_id ?? null, mueble: a.mueble, yo: a.yo === true })) : [],
    mio: d?.mio && catalogItem(d.mio.id) ? d.mio : null,
    semanas: Number.isInteger(d?.semanas) ? d.semanas : 0,
    placa: d?.placa === true,
    meta: Number.isInteger(d?.meta) ? d.meta : 4,
  };
};

/** La suite de esta semana y lo que ha traído cada cual. Sin la migración de la suite, null. */
export async function loadSuite() {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_suite');
  if (error && (error.code === 'PGRST202' || error.code === '42883')) return null;
  fail(error);
  return normalizeSuite(data);
}

/** Lleva un mueble tuyo a la suite (o cambia el tuyo de sitio o por otro). `item`: sin uid, como en un piso. */
export async function llevarASuite(item) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_suite_llevar', { item });
  fail(error);
  return normalizeSuite(data);
}

/** Retira lo que llevaste a la suite esta semana. */
export async function retirarDeSuite() {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_suite_retirar');
  fail(error);
  return normalizeSuite(data);
}
