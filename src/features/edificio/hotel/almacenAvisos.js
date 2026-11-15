// 1.134 · El almacén en el ordenador del piso (encargo de Francisco del 15-11-2026, «Sí, las recomendadas»; plan en
// docs/qa/almacen-ordenador.md). Lo que el ordenador cuenta del almacén: las ofertas de hoy (las decide el servidor), los muebles
// nuevos y la «!» roja de lo nuevo que aún no has visto. Reglas puras; lo visto se recuerda en el dispositivo, como en el café.
import { isDeHabitacionEspecial } from '../economy';
import { ARTICULOS } from './almacenLayout';
import { mapaOfertas, precioOferta } from './ofertas';

/** Lo que el almacén vendía al abrir (1.99, 9-11-2026): nunca cuenta como nuevo. */
export const DE_SIEMPRE = new Set(['sillon', 'mesa-baja', 'mesa', 'estanteria', 'lampara-pie', 'ventana', 'cuadro', 'reloj', 'guirnalda', 'escritorio', 'estante-pared', 'espejo', 'mapa', 'tapiz']);

/**
 * Cuándo llegó al almacén cada mueble posterior (día de Madrid, 'AAAA-MM-DD'). Todo lo que se añada al almacén (un mueble nuevo
 * o uno retirado que vuelva rehecho) necesita aquí su fecha: una prueba lo exige.
 */
export const LLEGADAS = {
  // 1.101 · La colección «Capa y Antifaz», en las habitaciones (publicada el 10-11-2026)
  'sillon-capa': '2026-11-10',
  'estanteria-comics': '2026-11-10',
  'foco-heroe': '2026-11-10',
  'maniqui-capa': '2026-11-10',
  'cartel-vinetas': '2026-11-10',
  'neon-rayo': '2026-11-10',
};

/** Cuántos días se ve un mueble como nuevo desde que llega. */
export const DIAS_NUEVO = 30;
/** Cuántos muebles enseña la tarjeta del escritorio. */
export const EN_TARJETA = 3;

const CLAVE = 'bookshelf:almacen-visto';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const diaValido = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const diaUTC = (d) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
/** Días enteros de `desde` a `hasta` (los dos 'AAAA-MM-DD'). */
export const diasEntre = (desde, hasta) => Math.round((diaUTC(hasta) - diaUTC(desde)) / 86400000);
/** «10 de noviembre». */
export const fechaCorta = (d) => (diaValido(d) ? `${Number(d.slice(8, 10))} de ${MESES[Number(d.slice(5, 7)) - 1]}` : '');

/** Los muebles nuevos del almacén el día `hoy`: llegados hace menos de DIAS_NUEVO días, el más reciente primero. */
export function nuevosDelAlmacen(hoy) {
  if (!diaValido(hoy)) return [];
  return ARTICULOS.map((a, orden) => ({ id: a.id, llega: LLEGADAS[a.id], orden }))
    .filter((n) => diaValido(n.llega) && diasEntre(n.llega, hoy) >= 0 && diasEntre(n.llega, hoy) < DIAS_NUEVO)
    .sort((a, b) => (a.llega === b.llega ? a.orden - b.orden : a.llega < b.llega ? 1 : -1))
    .map(({ id, llega }) => ({ id, llega }));
}

/** Hasta cuándo vale una oferta, como lo dice el almacén: las del día, hasta medianoche; la de la semana, hasta el domingo. */
export function hastaOferta(tipo, estado) {
  if (tipo !== 'semana') return 'hasta medianoche';
  const acabaHoy = !estado?.semana_hasta || estado.semana_hasta <= (estado.vuelve ?? 0);
  return acabaHoy ? 'hasta medianoche' : 'hasta el domingo';
}

// ── 1.135 · Los muebles que sigues ──
/** Cuántos muebles se pueden seguir a la vez (lo comprueba el servidor). */
export const TOPE_DESEADOS = 40;
/** ¿Se puede seguir su precio? Lo que vende el almacén, salvo los de las habitaciones especiales (nunca se rebajan). */
export const sePuedeSeguir = (id) => ARTICULOS.some((a) => a.id === id) && !isDeHabitacionEspecial(id);
/** El lunes de la semana de un día ('AAAA-MM-DD'): las ofertas de la semana van de lunes a domingo. */
export const lunesDe = (d) => {
  const t = diaUTC(d);
  return new Date(t - ((new Date(t).getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
};
/** Una oferta concreta: el mueble y su periodo (el día, o el lunes de su semana). Su «!» sale una sola vez. */
export const claveOferta = (id, tipo, dia) => `${id}@${tipo === 'semana' ? lunesDe(dia) : dia}`;
/** ¿Sigue vigente esa oferta el día `hoy`? */
const ofertaVigente = (clave, hoy) => clave.endsWith(`@${hoy}`) || clave.endsWith(`@${lunesDe(hoy)}`);

/** Un mueble del almacén con su precio de hoy: { id, nombre, precio, hoy, oferta: { pct, tipo } | null, especial }. */
function conPrecio(a, ofertas) {
  const o = ofertas.get(a.id) ?? null;
  return { id: a.id, nombre: a.nombre, precio: a.precio, hoy: o ? precioOferta(a.precio, o.pct) : a.precio, oferta: o ? { pct: o.pct, tipo: o.tipo } : null, especial: isDeHabitacionEspecial(a.id) };
}

/** Lo visto, venga como venga: la lista de nuevos de la 1.134 o { nuevos, ofertas, monitor }. */
const comoVistos = (v) => (Array.isArray(v) ? { nuevos: v, ofertas: [], monitor: [] } : { nuevos: v?.nuevos ?? [], ofertas: v?.ofertas ?? [], monitor: v?.monitor ?? [] });

/**
 * Lo que enseña el ordenador con el estado de la caja (`piso_almacen_estado`) y lo ya visto (`vistos`):
 * - `ofertas`: las de hoy, la de la semana primero;
 * - `nuevos`: los llegados en el último mes;
 * - `deseables`: si el servidor deja seguir muebles (la migración de la 1.135); `sigues`, los que sigues; `deseados`, con su
 *   precio de hoy, en el orden en que los seguiste, y `rebajados`, los que hoy tienen oferta;
 * - `sinVer`: los nuevos que aún no has visto, y `ofertasSinVer`, las claves de las ofertas de lo que sigues que aún no has visto:
 *   las dos cosas que encienden la «!» roja (en cada mueble, `sinVer`);
 * - `tarjeta`: lo de la tarjeta del escritorio (lo que sigues rebajado, lo nuevo sin ver y luego las ofertas, sin repetir), como
 *   mucho EN_TARJETA; `motivo`: 'sigues', 'nuevo' u 'oferta'.
 * Sin estado (sin la migración del almacén o sin conexión), null.
 */
export function resumenAlmacen(estado, vistos = []) {
  if (!estado || !diaValido(estado.dia)) return null;
  const v = comoVistos(vistos);
  const ofertas = mapaOfertas(estado.ofertas);
  const ya = new Set(v.nuevos);
  const ofertasVistas = new Set(v.ofertas);
  const de = (id) => ARTICULOS.find((a) => a.id === id) ?? null;
  const deseables = Array.isArray(estado.deseados);
  const sigues = new Set(deseables ? estado.deseados.filter((id) => typeof id === 'string' && sePuedeSeguir(id)) : []);
  const nuevosIds = nuevosDelAlmacen(estado.dia);
  const sinVer = new Set(nuevosIds.filter((n) => !ya.has(n.id)).map((n) => n.id));
  const claveDe = (id) => (ofertas.has(id) ? claveOferta(id, ofertas.get(id).tipo, estado.dia) : null);
  const ofertasSinVer = [...sigues].map(claveDe).filter((k) => k && !ofertasVistas.has(k));
  const avisa = (id) => sinVer.has(id) || (sigues.has(id) && ofertasSinVer.includes(claveDe(id)));
  const ficha = (a) => ({ ...conPrecio(a, ofertas), sigo: sigues.has(a.id), sinVer: avisa(a.id), clave: claveDe(a.id) });
  const porTipo = (a, b) => (a.oferta?.tipo === b.oferta?.tipo ? 0 : a.oferta?.tipo === 'semana' ? -1 : 1);
  const lista = [...ofertas.values()]
    .filter((o) => de(o.id))
    .map((o) => ficha(de(o.id)))
    .sort(porTipo);
  const nuevos = nuevosIds.map((n) => ({ ...ficha(de(n.id)), llega: n.llega }));
  const deseados = [...sigues].map((id) => ficha(de(id)));
  const rebajados = deseados.filter((m) => m.oferta).sort((a, b) => (a.sinVer === b.sinVer ? porTipo(a, b) : a.sinVer ? -1 : 1));
  const tarjeta = [];
  for (const m of [
    ...rebajados.map((x) => ({ ...x, motivo: 'sigues' })),
    ...nuevos.filter((n) => sinVer.has(n.id)).map((n) => ({ ...n, motivo: 'nuevo' })),
    ...lista.map((o) => ({ ...o, motivo: 'oferta' })),
  ]) {
    if (tarjeta.length >= EN_TARJETA) break;
    if (!tarjeta.some((t) => t.id === m.id)) tarjeta.push(m);
  }
  return {
    dia: estado.dia,
    tickets: Number.isInteger(estado.tickets) ? estado.tickets : null,
    ofertas: lista,
    nuevos,
    deseables,
    sigues,
    deseados,
    rebajados,
    sinVer,
    ofertasSinVer,
    tarjeta,
    todos: ARTICULOS.map(ficha),
  };
}

/** Las claves de lo que hoy enciende la «!» (para la del monitor del piso): `n:` lo nuevo, `o:` las ofertas de lo que sigues. */
export const avisosDe = (r) => (r ? [...[...r.sinVer].map((id) => `n:${id}`), ...r.ofertasSinVer.map((k) => `o:${k}`)] : []);
/** ¿Hay algo de lo que el monitor del piso aún no haya avisado? Se apaga al abrir el ordenador (o al verlo). */
export const monitorPendiente = (r, vistos) => {
  const ya = new Set(comoVistos(vistos).monitor);
  return avisosDe(r).some((k) => !ya.has(k));
};

// ── Lo visto (en el dispositivo) ──
const textos = (x) => (Array.isArray(x) ? x.filter((y) => typeof y === 'string') : []);
function leer() {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    return v && Array.isArray(v.nuevos) ? { nuevos: textos(v.nuevos), ofertas: textos(v.ofertas), monitor: textos(v.monitor) } : null;
  } catch {
    return null;
  }
}
function escribir(v) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(v));
  } catch {
    // Sin almacenamiento: la «!» vuelve a salir la próxima vez, sin más
  }
  return v;
}
/** Lo que sigue valiendo el día `hoy`: los nuevos que siguen siéndolo y las ofertas que siguen vigentes. */
function vigente(v, hoy) {
  const nuevos = new Set(nuevosDelAlmacen(hoy).map((n) => n.id));
  const vale = (k) => (k.startsWith('n:') ? nuevos.has(k.slice(2)) : k.startsWith('o:') && ofertaVigente(k.slice(2), hoy));
  return { nuevos: [...new Set(v.nuevos)].filter((id) => nuevos.has(id)), ofertas: [...new Set(v.ofertas)].filter((k) => ofertaVigente(k, hoy)), monitor: [...new Set(v.monitor)].filter(vale) };
}

/**
 * Lo ya visto: { nuevos, ofertas, monitor }. La primera vez, todo lo que hoy es nuevo cuenta como visto: la «!» es solo para lo
 * que llegue a partir de ahora (las ofertas de lo que sigues sí avisan: lo has elegido tú).
 */
export function vistosDelAlmacen(hoy) {
  return leer() ?? escribir({ nuevos: nuevosDelAlmacen(hoy).map((n) => n.id), ofertas: [], monitor: [] });
}

/** Dar por vistos unos nuevos (`ids`) y unas ofertas de lo que sigues (`claves`); devuelve lo visto entero. Lo pasado se olvida. */
export function marcarVistos(ids, hoy, claves = []) {
  // Sin nada guardado, se parte de la base (lo que ya era nuevo, visto)
  const v = vistosDelAlmacen(hoy);
  return escribir(vigente({ nuevos: [...v.nuevos, ...ids], ofertas: [...v.ofertas, ...claves], monitor: v.monitor }, hoy));
}

/** El monitor del piso ya ha avisado de lo de hoy (al abrir el ordenador). */
export function marcarMonitor(r) {
  if (!r) return null;
  const v = vistosDelAlmacen(r.dia);
  return escribir(vigente({ ...v, monitor: [...v.monitor, ...avisosDe(r)] }, r.dia));
}
