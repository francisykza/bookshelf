// Servicio de «El edificio del puerto» (1.63, SPEC §63): todo pasa por el cliente de Supabase de la app y lo protegen
// las políticas de supabase/migrations/20261101120000_edificio_puerto.sql. El reparto en edificios lo hace el servidor
// (`asignar_edificio`), y el portal llega en una sola consulta (`edificio_portal`). Los pisos que llegan se vuelven a
// validar aquí antes de dibujarlos; el que se guarda va siempre limpio (`validateRoom`).
import { client, fail } from '../social/services/community';
import { PRENDAS, ROPA_CASINO, validateAvatar } from './actor';
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

/**
 * El aspecto de quien lee en la sala del hotel: { [user_id]: { personaje, companero } }. Sin la migración de la 1.83
 * se conforma con lo que `pisos` deja ver: tú y tus vecinos.
 */
export async function salaPersonajes(ids) {
  const sb = await client();
  const { data, error } = await sb.rpc('sala_lectura_personajes', { ids });
  let filas = data;
  if (error) {
    const { data: pisos, error: fallo } = await sb.from('pisos').select('user_id, personaje, companero').in('user_id', ids);
    if (fallo) throw fail(fallo);
    filas = pisos;
  }
  return Object.fromEntries((filas ?? []).map((f) => [f.user_id, { personaje: validateAvatar(f.personaje), companero: f.companero ?? null }]));
}

// ── La Lonja del Gran Hotel (1.84, supabase/migrations/20261114120000_hotel_lonja.sql) ──
const normalizeLonja = (d) => ({
  personaje: validateAvatar(d.personaje),
  tickets: d.tickets ?? 0,
  sellos: d.sellos ?? 0,
  cambios: d.cambios ?? { hechos: 0, tope: 3 },
  cobro: d.cobro ?? { hecho: 0, tope: 100 },
  nueva: Boolean(d.nueva),
  toldo: d.toldo ?? null,
  toldos: d.toldos ?? [],
  sinComision: d.sinComision ?? 0,
  huecoHasta: d.huecoHasta ?? null,
  juego: { ronda: 1, cajas: 6, par: 2, tope: 3, pesaMas: null, pesadas: [], encargos: [], sellos: 0, acabada: false, ...d.juego },
  retenidas: d.retenidas ?? 0,
  topeOfertas: d.topeOfertas ?? 3,
  horquilla: d.horquilla ?? {},
  libres: d.libres ?? {},
  mias: d.mias ?? [],
  cerradas: d.cerradas ?? [],
  puestos: (d.puestos ?? []).map((o) => ({ ...o, personaje: validateAvatar(o.personaje) })),
});
async function lonjaRpc(fn, args) {
  const sb = await client();
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw fail(error);
  return normalizeLonja(data);
}
export const cargarLonja = () => lonjaRpc('piso_lonja');
export const ponerLonja = (doy, pido, precio, clase) => lonjaRpc('piso_lonja_poner', { doy, pido, precio, clase });
export const retirarLonja = (cual) => lonjaRpc('piso_lonja_retirar', { cual });
export const aceptarLonja = (cual, pago = null) => lonjaRpc('piso_lonja_aceptar', { cual, pago });
export const pesarLonja = (izq, der) => lonjaRpc('piso_lonja_pesar', { izq, der });
export const senalarLonja = (cual) => lonjaRpc('piso_lonja_senalar', { cual });
export const canjearLonja = (que) => lonjaRpc('piso_lonja_canjear', { que });
export const toldoLonja = (cual) => lonjaRpc('piso_lonja_toldo', { cual });

async function salaRpc(fn, args) {
  const sb = await client();
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw fail(error);
  return data;
}

/** La librería común de la sala: { total, lomos: [{ id, titulo, alias, mio }] }. Sin la migración, falla y no se enseña. */
export const salaLibreria = () => salaRpc('sala_libreria');
export const dejarLomo = (nuevo) => salaRpc('sala_lomo_dejar', { nuevo });
export const retirarLomo = (lomo) => salaRpc('sala_lomo_retirar', { lomo });
/** Saluda a quien lee a la vez. Devuelve si ha salido (uno cada media hora por pareja). */
export const saludarEnSala = (quien) => salaRpc('sala_saludar', { quien });
/** Los ids de quien te acaba de saludar; cada saludo llega una vez. */
export const saludosEnSala = () => salaRpc('sala_saludos_nuevos');

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
const normalizeArmario = (d) => ({ prendas: Array.isArray(d?.prendas) ? d.prendas.filter((p) => PRENDAS.includes(p) || ROPA_CASINO.includes(p)) : [], hechas: Array.isArray(d?.hechas) ? d.hechas : [], nueva: PRENDAS.includes(d?.nueva) ? d.nueva : null, tickets: Number.isInteger(d?.tickets) && d.tickets > 0 ? d.tickets : 0 });

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

// ── El casino del sótano del Gran Hotel (1.80, supabase/migrations/20261110120000_hotel_casino.sql) ──
const normalizeCasino = (d) => ({
  dia: d.dia,
  fichas: d.fichas ?? 0,
  semana: d.semana ?? 0,
  tope: d.tope ?? 150,
  manos: (d.manos ?? []).map((m) => ({ ...m, tuyas: m.tuyas ?? [], crupier: m.crupier ?? [] })),
  quedan: d.quedan ?? 0,
  jugando: Boolean(d.jugando),
  garbanzos: d.garbanzos ?? 0,
  tickets: d.tickets ?? 0,
  quedanGarbanzos: d.quedanGarbanzos ?? 0,
  // La mesa para dos: las invitaciones y las mesas (las cartas del amigo, solo al resolverse) y los amigos con quien jugar
  mesas: (d.mesas ?? []).map((m) => ({ ...m, crupier: m.crupier ?? [], mia: m.mia ? { ...m.mia, tuyas: m.mia.tuyas ?? [] } : null })),
  amigos: d.amigos ?? [],
  // La caja: [{ id, tipo, precio, tienes }]; al cambiar el sobre, sus premios
  caja: d.caja ?? [],
  // La lata de los garbanzos: [{ id, precio, tienes }], y los tickets cambiados esta semana en cada sentido
  lata: d.lata ?? [],
  cambio: { aTickets: d.cambio?.aTickets ?? 0, aGarbanzos: d.cambio?.aGarbanzos ?? 0 },
  ...(d.premios ? { premios: d.premios } : {}),
});

/** Las fichas y las manos del día `dia` (AAAA-MM-DD). Sin la migración del casino, null. */
export async function loadCasino(dia) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_casino', { dia });
  if (error && (error.code === 'PGRST202' || error.code === '42883')) return null;
  fail(error);
  return normalizeCasino(data);
}

/** Reparte la siguiente mano del día. */
export async function repartirCasino(dia) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_casino_repartir', { dia });
  fail(error);
  return normalizeCasino(data);
}

/** Juega la mano abierta a solas: 'pedir' o 'plantarse'. */
export async function jugarCasino(dia, accion) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_casino_jugar', { dia, accion });
  fail(error);
  return normalizeCasino(data);
}

/** Cambia fichas en la caja por `articulo` (un id de CAJA). Con el sobre, trae `premios`. */
export async function canjearCaja(dia, articulo) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_casino_canjear', { dia, articulo });
  fail(error);
  return normalizeCasino(data);
}

/** Invita a un amigo a la mesa para dos del día, con lo que se apuesta (0 si nada). */
export async function invitarMesa(dia, amigo, fichas, garbanzos) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_casino_invitar', { dia, amigo, fichas, garbanzos });
  fail(error);
  return normalizeCasino(data);
}

/** Invita a un amigo a una mesa de garbanzos: no gasta manos del día ni da fichas. */
export async function invitarMesaGarbanzos(dia, amigo, garbanzos) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_casino_invitar_garbanzos', { dia, amigo, garbanzos });
  fail(error);
  return normalizeCasino(data);
}

/** Cambia garbanzos por un premio de la lata (un id de LATA). */
export async function canjearLata(dia, articulo) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_casino_lata_canjear', { dia, articulo });
  fail(error);
  return normalizeCasino(data);
}

/** El cambio de la lata: 'a-tickets' o 'a-garbanzos', con el tope semanal del servidor. */
export async function cambiarGarbanzos(dia, sentido) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_casino_cambiar', { dia, sentido });
  fail(error);
  return normalizeCasino(data);
}

// Los toques de la mesa para dos (1.82): un aviso sin datos al canal del amigo, para que mire su casino al momento. No
// lleva nada: lo que hay en la mesa lo sigue diciendo el servidor. Si falla, queda la consulta periódica
const oyentesMesa = new Set();
let canalMesa = null;
let clienteMesa = null;

/** Llama a `fn` cuando un amigo toca tu mesa. Devuelve cómo dejar de escuchar. */
export function escucharMesas(fn) {
  oyentesMesa.add(fn);
  if (oyentesMesa.size === 1) {
    (async () => {
      try {
        const sb = await client();
        const { data } = await sb.auth.getSession();
        const uid = data.session?.user?.id;
        if (!uid || !oyentesMesa.size || canalMesa) return;
        clienteMesa = sb;
        canalMesa = sb
          .channel(`casino-${uid}`)
          .on('broadcast', { event: 'mesa' }, () => oyentesMesa.forEach((f) => f()))
          .subscribe();
      } catch {
        // Sin canal: la consulta periódica sigue avisando
      }
    })();
  }
  return () => {
    oyentesMesa.delete(fn);
    if (!oyentesMesa.size && canalMesa) {
      clienteMesa.removeChannel(canalMesa);
      canalMesa = null;
    }
  };
}

/** Avisa a `uid` de que su mesa ha cambiado. Nunca falla: el aviso es solo un adelanto. */
export async function avisarMesa(uid) {
  try {
    const sb = await client();
    const canal = sb.channel(`casino-${uid}`);
    await canal.httpSend('mesa', {});
    await sb.removeChannel(canal);
  } catch {
    // La consulta periódica del amigo lo verá igual
  }
}

/** Acepta una invitación: se aparta lo apostado y se reparte. */
export async function aceptarMesa(mesa) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_casino_aceptar', { mesa });
  fail(error);
  return normalizeCasino(data);
}

/** No acepta una invitación (o la retira quien invitó). */
export async function rechazarMesa(mesa) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_casino_rechazar', { mesa });
  fail(error);
  return normalizeCasino(data);
}

/** Juega tu mano de una mesa para dos: 'pedir' o 'plantarse'. */
export async function jugarMesa(mesa, accion) {
  const sb = await client();
  const { data, error } = await sb.rpc('piso_casino_mesa_jugar', { mesa, accion });
  fail(error);
  return normalizeCasino(data);
}
