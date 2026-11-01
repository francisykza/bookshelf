// Servicio de «El edificio del puerto» (1.63, SPEC §63): todo pasa por el cliente de Supabase de la app y lo protegen
// las políticas de supabase/migrations/20261101120000_edificio_puerto.sql. El reparto en edificios lo hace el servidor
// (`asignar_edificio`), y el portal llega en una sola consulta (`edificio_portal`). Los pisos que llegan se vuelven a
// validar aquí antes de dibujarlos; el que se guarda va siempre limpio (`validateRoom`).
import { client, fail } from '../social/services/community';
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
  const vecinos = (data.vecinos ?? []).map((v) => ({ ...v, room: v.layout ? validateRoom(v.layout) : null }));
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

/** Los seis muebles comunes de inicio (una sola vez). Devuelve el inventario nuevo. */
export async function elegirInicio(ids) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_elegir_inicio', { muebles: ids });
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
