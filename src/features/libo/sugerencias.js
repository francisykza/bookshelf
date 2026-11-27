// Libo, bloque 3 (docs/qa/libo.md §2.4): los avisos que reúne en su bocadillo y la sugerencia del día. Reglas puras, sin React.
// Todo es de verdad (lo dice tu biblioteca, el almacén, tu café o tu buzón) y está escrito aquí a mano: sin rachas que se
// pierden, cuentas atrás, «te lo estás perdiendo» ni nada de pago. Como mucho una sugerencia al día, y el bocadillo asoma
// solo una vez al día, al abrir la app o al volver a tu piso.
import { dayKey, parseDay } from '../../domain/dates';
import { liboDe } from './libo';
import { conOlmo } from '../../domain/suscripcion';
import { tituloClave } from '../social/amigosLectura';
import { mesasQueEsperan } from '../edificio/hotel/veintiuna';

/** Días sin abrir un libro de «Leyendo» para preguntarte si sigues con él. */
export const DIAS_PARADO = 21;
/** Días desde que terminaste un libro en los que Libo te ofrece reseñarlo. */
export const DIAS_RESENA = 30;
/** 1.154 · Días desde que un amigo terminó un libro en los que Libo te lo cuenta (si lo tienes en «Quiero leer»). */
export const DIAS_AMIGO = 14;
/** Días que Libo calla una sugerencia que ya contestaste. */
export const DIAS_CALLADO = 30;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const diasEntre = (desde, hasta) => Math.round((parseDay(hasta) - parseDay(desde)) / 86400000);
const diaDe = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : dayKey(d);
};
const minuscula = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const mayuscula = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** El texto de una sugerencia o un aviso, sin marcas (los títulos van como { titulo }). */
export const textoPlano = (partes) => partes.map((p) => (typeof p === 'string' ? p : p.titulo)).join('');

// ── Los avisos (lo que tienes pendiente en otros sitios; cada sitio sigue avisando a su manera) ──

/**
 * Los avisos de hoy, en el orden en que se enseñan. `almacen`: el resumen del almacén (`resumenAlmacen`) y `monitorVistos`, lo
 * que la «!» del monitor ya avisó (se apaga al abrir el ordenador, y entonces Libo tampoco lo repite). `cafe`: lo que tu café
 * dejó apuntado en este aparato (`leerCafeLibo`). `correo`: cartas de tus vecinos sin leer. Cada aviso: { id, partes, ir, boton }.
 */
export function avisosDeLibo({ almacen = null, monitorVistos = [], cafe = null, correo = 0, hoy = dayKey(), ahora = Date.now() } = {}) {
  const lista = [];
  // 1.158 · Cada aviso lleva también lo de «Lo de hoy»: su icono (iconos.js), el dato en corto (`titulo`) y una frase con gracia
  if (Number.isInteger(correo) && correo > 0) {
    lista.push({
      id: 'correo',
      partes: [correo === 1 ? 'Tienes una carta de un vecino sin leer en el buzón del portal.' : `Tienes ${correo} cartas de tus vecinos sin leer en el buzón del portal.`],
      ir: 'edificio',
      boton: 'Ir al buzón',
      icono: 'buzon',
      titulo: correo === 1 ? 'Una carta en tu buzón' : `${correo} cartas en tu buzón`,
      gracia: correo === 1 ? 'No la he abierto. Casi.' : 'No las he abierto. Casi.',
    });
  }
  if (almacen) {
    const ya = new Set(monitorVistos);
    const rebajados = (almacen.rebajados ?? []).filter((m) => m.clave && (almacen.ofertasSinVer ?? []).includes(m.clave) && !ya.has(`o:${m.clave}`));
    const nuevos = (almacen.nuevos ?? []).filter((n) => almacen.sinVer?.has(n.id) && !ya.has(`n:${n.id}`));
    const texto =
      rebajados.length === 1
        ? `Lo que sigues está de oferta hoy en el almacén: ${minuscula(rebajados[0].nombre)}.`
        : rebajados.length > 1
          ? `Hay ${rebajados.length} muebles que sigues de oferta hoy en el almacén.`
          : nuevos.length === 1
            ? `Ha llegado algo nuevo al almacén: ${minuscula(nuevos[0].nombre)}.`
            : nuevos.length > 1
              ? `Han llegado ${nuevos.length} muebles nuevos al almacén.`
              : null;
    const corto =
      rebajados.length === 1
        ? { icono: 'rebaja', titulo: `${mayuscula(rebajados[0].nombre)}, de oferta`, gracia: 'Te lo he vigilado de reojo' }
        : rebajados.length > 1
          ? { icono: 'rebaja', titulo: `${rebajados.length} muebles que sigues, de oferta`, gracia: 'Los he vigilado de reojo' }
          : nuevos.length === 1
            ? { icono: 'nuevo', titulo: `Nuevo en el almacén: ${minuscula(nuevos[0].nombre)}`, gracia: 'Aún huele a barniz' }
            : { icono: 'nuevo', titulo: `${nuevos.length} muebles nuevos en el almacén`, gracia: 'Aún huelen a barniz' };
    if (texto) lista.push({ id: 'almacen', partes: [texto], ir: 'almacen', boton: 'Ver el almacén', ...corto });
  }
  if (cafe) {
    // Cada día llegan clientes nuevos; el mismo día, los que quedaron sin atender
    const clientes = cafe.hoy !== hoy || cafe.pendientes > 0;
    // La hucha suma un día entero tras otro desde que se vació: un día después de tu última visita, seguro que tiene algo
    const hucha = cafe.hucha > 0 && ahora - cafe.t >= 86400000;
    const texto =
      clientes && hucha
        ? `Tu café tiene clientes esperando, y ${conOlmo() ? 'Olmo' : 'Pilar'} te ha guardado propinas en la hucha.`
        : clientes
          ? 'Tu café tiene clientes esperando.'
          : hucha
            ? `${conOlmo() ? 'Olmo' : 'Pilar'} te ha guardado propinas en la hucha del café.`
            : null;
    const quien = conOlmo() ? 'Olmo' : 'Pilar';
    const corto = clientes && hucha ? { titulo: 'Clientes y propinas en tu café', gracia: `${quien} te guarda la hucha` } : clientes ? { titulo: 'Clientes en tu café', gracia: 'Ya huele a café recién hecho' } : { titulo: 'Propinas en la hucha del café', gracia: 'Tintinea cuando pasas' };
    if (texto) lista.push({ id: 'cafe', partes: [texto], ir: 'cafe', boton: 'Ir al café', icono: 'cafe', ...corto });
  }
  return lista;
}

// ── 1.158 · Lo de hoy (docs/qa/libo-lo-de-hoy.md): lo que Libo pregunta al servidor al abrir su tarjeta ──

/**
 * Lo del día que se juega fuera de tu piso, con lo que dice el servidor: las manos del casino que te quedan, las mesas para dos
 * que te esperan, la ruleta de la semana sin girar y las tres misiones del día. `casino` (`loadCasino`), `ruleta` (`loadRuleta`)
 * y `armario` (`loadArmario`): null si no se pudo preguntar (sin la migración, sin red), y entonces Libo no habla de eso.
 * `misiones`: los ids de las tres de hoy (`missionsOf`). Devuelve { pendientes, hechas }, cada una
 * { id, icono, titulo, gracia, ir, chip? }. Sin cuentas atrás ni prisas: solo cuánto queda hoy.
 */
export function hoyDeLibo({ casino = null, ruleta = null, armario = null, misiones = [] } = {}) {
  const pendientes = [];
  const mesas = casino ? mesasQueEsperan(casino.mesas ?? []) : [];
  const hechas = [];
  if (mesas.length) {
    pendientes.push({ id: 'mesa', icono: 'casino', titulo: mesas.length === 1 ? 'Te esperan en una mesa para dos' : `Te esperan en ${mesas.length} mesas para dos`, gracia: 'El mapache ya ha puesto las sillas', ir: 'casino' });
  }
  if (casino && Number.isInteger(casino.quedan)) {
    if (casino.quedan > 0) pendientes.push({ id: 'casino', icono: 'casino', titulo: `Casino · ${casino.quedan === 1 ? 'te queda 1 mano' : `te quedan ${casino.quedan} manos`}`, gracia: 'El mapache ya está barajando', ir: 'casino', chip: String(casino.quedan) });
    else hechas.push({ id: 'casino', icono: 'casino', titulo: 'Casino · manos jugadas', gracia: 'El mapache te guarda el sitio' });
  }
  if (armario && misiones.length) {
    const n = misiones.filter((m) => armario.hechas?.includes(m)).length;
    const total = misiones.length;
    if (n < total) pendientes.push({ id: 'misiones', icono: 'misiones', titulo: `Misiones · ${n} de ${total}`, gracia: n === 0 ? 'Tres cosas pequeñas en tu piso del edificio' : n === total - 1 ? 'La última te espera sentada' : 'Las otras te esperan sentadas', ir: 'misiones', chip: `${n}/${total}` });
    else hechas.push({ id: 'misiones', icono: 'misiones', titulo: `Misiones · ${total} de ${total}`, gracia: 'Ni una se ha escapado' });
  }
  if (ruleta && !ruleta.giro) pendientes.push({ id: 'ruleta', icono: 'ruleta', titulo: 'La ruleta de la semana', gracia: 'Sigue sin girar. Una vuelta, cuando quieras', ir: 'casino' });
  return { pendientes, hechas };
}

const NUMEROS = ['ninguna', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];

/** Lo primero que dice Libo en «Lo de hoy», según lo que hay: { texto, fuerte } (lo fuerte va en negrita en medio). */
export function saludoDeHoy({ pendientes = 0, hechas = 0 } = {}) {
  if (pendientes > 0) {
    const n = NUMEROS[pendientes] ?? String(pendientes);
    return pendientes === 1 ? { antes: 'Hoy tienes ', fuerte: 'una cosa', despues: ' por aquí. No corre prisa.' } : { antes: 'Hoy tienes ', fuerte: `${n} cosas`, despues: ' por aquí. Ninguna corre prisa.' };
  }
  if (hechas > 0) return { antes: 'Hoy ya está ', fuerte: 'todo', despues: '. Me echo una siesta en tu piso.' };
  return null;
}

// ── Lo que tu café deja apuntado para Libo (en este aparato, por cuenta) ──
const claveCafe = (uid) => `bookshelf:libo-cafe:${uid}`;

/** Al estar en tu café: cuántos clientes quedan hoy y el grado de la hucha. */
export function guardarCafeLibo(uid, { pendientes = 0, hucha = 0 } = {}, { hoy = dayKey(), ahora = Date.now() } = {}, storage = globalThis.localStorage) {
  if (!uid) return;
  try {
    storage?.setItem(claveCafe(uid), JSON.stringify({ hoy, pendientes: Math.max(0, pendientes | 0), hucha: Math.max(0, hucha | 0), t: ahora }));
  } catch {
    // Sin almacenamiento, Libo no habla del café
  }
}

/** Lo apuntado por tu café: { hoy, pendientes, hucha, t } o null (nunca has entrado aquí, o no se puede leer). */
export function leerCafeLibo(uid, storage = globalThis.localStorage) {
  if (!uid) return null;
  try {
    const c = JSON.parse(storage?.getItem(claveCafe(uid)) ?? 'null');
    if (!c || !FECHA.test(c.hoy ?? '') || !Number.isInteger(c.pendientes) || !Number.isInteger(c.hucha) || !Number.isFinite(c.t)) return null;
    return c;
  } catch {
    return null;
  }
}

// ── 1.154 · Lo de tus amigos (docs/qa/amigos-vecinos.md, bloque 4) ──

/**
 * Lo que Libo te puede contar de tus amigos, con lo que dice tu agenda (`amigos_panel`): una llave que te han dado, un libro que
 * te han recomendado y aún no has visto, y un amigo que ha terminado hace poco un libro que tienes en «Quiero leer». Sin prisas:
 * nada caduca «ya» y nada se repite (cada una se calla un mes al contestarla).
 */
export function sugerenciasDeAmigos(amigos, books = [], hoy = dayKey()) {
  if (!amigos) return [];
  const lista = [];
  const alias = (x) => x?.alias || 'Un amigo';
  for (const k of (amigos.llaves ?? []).slice(0, 1)) {
    lista.push({
      id: `amigo-llave:${k.codigo}`,
      partes: [`${alias(k)} te ha dado la llave de su edificio. Si os apetece ser vecinos, la tienes en tu agenda de Amigos.`],
      acciones: [
        { ir: 'amigos', boton: 'Abrir Amigos' },
        { ir: 'callar', boton: 'Ahora no' },
      ],
    });
  }
  for (const r of (amigos.recomendaciones ?? []).filter((x) => !x.vista).slice(0, 1)) {
    lista.push({ id: `amigo-recomienda:${r.id}`, partes: [`${alias(r)} te ha recomendado `, { titulo: r.titulo }, '. ¿Le echas un vistazo?'], acciones: [{ ir: 'amigos', boton: 'Ver la recomendación' }] });
  }
  const quiero = new Map(books.filter((b) => b.status === 'want').map((b) => [tituloClave(b.title), b]));
  for (const a of amigos.amigos ?? []) {
    for (const t of a.terminados ?? []) {
      const b = quiero.get(tituloClave(t.titulo));
      if (!b || !FECHA.test(t.fecha ?? '')) continue;
      const dias = diasEntre(t.fecha, hoy);
      if (dias < 0 || dias > DIAS_AMIGO) continue;
      lista.push({
        id: `amigo-termino:${a.user_id}:${b.id}`,
        partes: [`${alias(a)} ha terminado `, { titulo: b.title }, ', que tienes en «Quiero leer». Por si te anima a empezarlo.'],
        acciones: [
          { ir: 'ficha', libro: b.id, boton: 'Ver su ficha' },
          { ir: 'amigos', boton: 'Abrir Amigos' },
        ],
      });
    }
  }
  return lista;
}

// ── La sugerencia del día ──

/** El último día en que has tocado un libro (registro de lectura, empezado o añadido). */
function ultimoDia(book, log) {
  let ultimo = diaDe(book.startedAt) ?? diaDe(book.addedAt);
  for (const e of log) if (e.bookId === book.id && FECHA.test(e.date ?? '') && (!ultimo || e.date > ultimo)) ultimo = e.date;
  return ultimo;
}

const callada = (libo, id, hoy) => {
  const f = libo.callados[id];
  return Boolean(f) && diasEntre(f, hoy) < DIAS_CALLADO;
};

/**
 * Lo que Libo podría sugerirte hoy, por orden. `vistos`: los capítulos de la guía que ya has visto (en tus ajustes o en este
 * aparato). `edificio`: tienes piso en el edificio (sin la comunidad, no te manda allí). `amigos` (1.154): tu agenda de amigos
 * (`loadAmigos`), o null. Cada una: { id, partes, acciones }.
 */
export function sugerencias({ books = [], log = [], settings = {}, vistos = [], edificio = true, amigos = null, hoy = dayKey() } = {}) {
  const libo = liboDe(settings);
  const lista = [];
  if (!books.length) {
    lista.push({ id: 'vacia', partes: ['Tu estantería está vacía. ¿Añadimos el libro que estás leyendo?'], acciones: [{ ir: 'anadir', boton: 'Añadir un libro' }] });
  }
  // Un libro terminado hace poco, sin reseña ni estrellas: el más reciente
  const sinResena = books
    .filter((b) => b.status === 'read' && !String(b.review ?? '').trim() && !b.rating)
    .map((b) => ({ b, fin: diaDe(b.finishedAt) }))
    .filter(({ fin }) => fin && diasEntre(fin, hoy) >= 0 && diasEntre(fin, hoy) <= DIAS_RESENA)
    .sort((x, y) => (x.fin < y.fin ? 1 : -1));
  for (const { b } of sinResena) {
    lista.push({ id: `resena:${b.id}`, partes: ['Terminaste ', { titulo: b.title }, '. ¿Le dejas una reseña?'], acciones: [{ ir: 'resena', libro: b.id, boton: 'Escribir la reseña' }] });
  }
  // 1.154 · Lo de tus amigos, después de las reseñas
  lista.push(...sugerenciasDeAmigos(amigos, books, hoy));
  // Un libro de «Leyendo» que llevas tiempo sin abrir: el más olvidado
  const parados = books
    .filter((b) => b.status === 'reading')
    .map((b) => ({ b, ultimo: ultimoDia(b, log) }))
    .filter(({ ultimo }) => ultimo && diasEntre(ultimo, hoy) >= DIAS_PARADO)
    .sort((x, y) => (x.ultimo < y.ultimo ? -1 : 1));
  for (const { b } of parados) {
    lista.push({
      id: `parado:${b.id}`,
      partes: ['Hace un tiempo que no abres ', { titulo: b.title }, '. ¿Sigues con él o lo dejas para más adelante?'],
      acciones: [
        { ir: 'callar', boton: 'Sigo con él' },
        { ir: 'ficha', libro: b.id, boton: 'Ver su ficha' },
      ],
    });
  }
  // Los sitios del edificio que aún no conoces
  if (edificio) {
    const visto = new Set(vistos);
    if (!visto.has('edificio')) lista.push({ id: 'ver:edificio', partes: ['Tus vecinos viven en el edificio del puerto. ¿Bajamos a verlo?'], acciones: [{ ir: 'edificio', boton: 'Al edificio' }] });
    if (!visto.has('cafe')) lista.push({ id: 'ver:cafe', partes: ['En el bajo del edificio hay un café-librería esperando a que lo abras.'], acciones: [{ ir: 'cafe', boton: 'Ir al café' }] });
    if (!visto.has('hotel')) lista.push({ id: 'ver:hotel', partes: ['Todavía no has visto el Gran Hotel del puerto. La limusina espera delante del portal.'], acciones: [{ ir: 'hotel', boton: 'Ir al hotel' }] });
  }
  return lista.filter((s) => !callada(libo, s.id, hoy));
}

/**
 * La sugerencia de hoy: la que ya te dio hoy (si sigue en pie) o, si aún no te ha dado ninguna, la primera; si la de ayer se
 * quedó sin contestar, otra distinta, para no repetirte lo mismo cada día.
 */
export function sugerenciaDelDia(candidatas, settings, hoy = dayKey()) {
  const { dia } = liboDe(settings);
  if (dia?.fecha === hoy && dia.sugerencia) return candidatas.find((c) => c.id === dia.sugerencia) ?? null;
  const ayer = dia && dia.fecha !== hoy ? dia.sugerencia : null;
  return candidatas.find((c) => c.id !== ayer) ?? candidatas[0] ?? null;
}

/**
 * «¿Qué hago ahora?»: lo pides tú, así que vale otra idea aunque hoy ya tuvieras tu sugerencia. Si no hay ninguna pendiente,
 * una idea tranquila con lo que tienes: apuntar tu lectura, elegir la próxima o bajar al edificio.
 */
export function ideaAhora({ candidatas = [], deHoy = null, books = [], edificio = true } = {}) {
  const otra = candidatas.find((c) => c.id !== deHoy?.id);
  if (otra) return otra;
  const leyendo = books.find((b) => b.status === 'reading');
  if (leyendo) return { id: 'idea:registrar', partes: ['¿Apuntas por qué página vas de ', { titulo: leyendo.title }, '? Así se llena tu calendario.'], acciones: [{ ir: 'registrar', boton: 'Apuntar mi lectura' }] };
  const quiero = books.filter((b) => b.status === 'want').length;
  if (quiero) return { id: 'idea:pendientes', partes: [quiero === 1 ? 'Tienes un libro esperando en «Quiero leer». ¿Lo empiezas?' : `Tienes ${quiero} libros esperando en «Quiero leer». ¿Eliges el próximo?`], acciones: [{ ir: 'biblioteca', boton: 'Ver mi biblioteca' }] };
  if (edificio) return { id: 'idea:edificio', partes: ['Puedes bajar al edificio a ver qué hacen tus vecinos.'], acciones: [{ ir: 'edificio', boton: 'Al edificio' }] };
  return { id: 'idea:anadir', partes: ['¿Añades a tu estantería el próximo libro que quieres leer?'], acciones: [{ ir: 'anadir', boton: 'Añadir un libro' }] };
}

/** El cambio de ajustes que fija la sugerencia de hoy y, si `asomo`, que el bocadillo ya asomó hoy (null si no cambia nada). */
export function fijarDia(settings, hoy, sugerencia = null, asomo = false) {
  const l = liboDe(settings);
  const antes = l.dia?.fecha === hoy ? l.dia : { fecha: hoy, sugerencia: null, asomo: false };
  const dia = { fecha: hoy, sugerencia: antes.sugerencia ?? sugerencia ?? null, asomo: antes.asomo || asomo };
  if (l.dia && l.dia.fecha === dia.fecha && l.dia.sugerencia === dia.sugerencia && l.dia.asomo === dia.asomo) return null;
  return { libo: { ...l, dia } };
}

/** El cambio de ajustes que calla una sugerencia ya contestada (y olvida las que ya pasaron). */
export function callar(settings, id, hoy = dayKey()) {
  const l = liboDe(settings);
  const callados = Object.fromEntries(Object.entries(l.callados).filter(([, f]) => diasEntre(f, hoy) < DIAS_CALLADO));
  callados[id] = hoy;
  return { libo: { ...l, callados } };
}

// ── El bocadillo asoma solo una vez al día ──
export const ASOMO_KEY = 'bookshelf:libo-asomo';

/** ¿Asomó ya hoy en este aparato? (una fecha posterior también cuenta: las pruebas la usan para que no salga). */
export function asomoAqui(hoy = dayKey(), storage = globalThis.localStorage) {
  try {
    const f = storage?.getItem(ASOMO_KEY);
    return Boolean(f) && FECHA.test(f) && f >= hoy;
  } catch {
    return false;
  }
}

export function marcarAsomoAqui(hoy = dayKey(), storage = globalThis.localStorage) {
  try {
    if (!asomoAqui(hoy, storage)) storage?.setItem(ASOMO_KEY, hoy);
  } catch {
    // Sin almacenamiento: vale lo guardado en los ajustes
  }
}

/** ¿Asoma hoy el bocadillo por su cuenta? Solo si te sugiere cosas, tiene algo que decir y hoy aún no ha asomado. */
export function debeAsomar(settings, { hoy = dayKey(), hayAlgo = false, aqui = false } = {}) {
  const l = liboDe(settings);
  return l.modo === 'sugiere' && hayAlgo && !aqui && !(l.dia?.fecha === hoy && l.dia.asomo);
}
