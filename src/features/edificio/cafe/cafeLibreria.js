// El café-librería del bajo, 1.130 (Francisco, 14-11-2026: «Si, me parece bien, asi cuando se automaticen las recetas el
// usuario seguirá teniendo que hacer el proceso de los libros»; plan en docs/qa/cafe-libreria.md §15). Los libros, igual de
// importantes que el café:
// - Una sola lista de categorías, los diez géneros de la distribuidora: cada uno es una sección de la estantería de la pared
//   con su placa, y solo aparecen las que tienen ejemplares.
// - Los clientes solo piden lo que hay en la balda en ese momento, en tres partes: el género (la sección), la extensión
//   (corto, hasta 300 páginas; largo, más; un libro sin páginas vale para las dos) y cómo se lo lleva (para regalar, para
//   leerlo aquí o para llevar). Con la balda vacía, solo el café.
// - Estrellas, mitad y mitad: hasta 4 aciertos de la bebida y 3 del libro; 3 estrellas con los 7, 2 con 4 a 6, 1 con menos.
// - El ejemplar se lo lleva si aciertas el género (+4 granos); si no, vuelve a su sección.
// - El reparto: cada mañana, una caja que repone lo vendido (hasta 10 ejemplares, a 2 granos, solo lo que se pueda pagar).
// - Pilar prepara las bebidas que dominas (12 servidas de 2 estrellas o más); el libro siempre lo eliges tú.
// Aquí, solo reglas y cuentas (sin React ni Three): las mismas cifras que la migración `20261218120000_cafe_libreria.sql`.
import { ESTANTERIA } from './cafeLayout';
import { GENEROS, nombreGenero } from './cafeClientes';
import { numeroInfluencer, pedidoInfluencer, semillaInfluencer } from './cafeInfluencers';

/** Cómo se lo lleva: cada forma con su objeto en la tabla y sus gestos (el último, el sello del café). */
export const FORMAS = [
  { id: 'regalar', nombre: 'Para regalar', objeto: 'El papel de estraza y el cordel', gestos: ['papel', 'doblar', 'cordel', 'sello'] },
  { id: 'aqui', nombre: 'Para leerlo aquí', objeto: 'El tarro de los marcapáginas', gestos: ['abrir', 'marca', 'sello'] },
  { id: 'llevar', nombre: 'Para llevar', objeto: 'Las bolsas de papel', gestos: ['bolsa', 'meter', 'pliegue', 'sello'] },
];
export const formaPorId = (id) => FORMAS.find((f) => f.id === id) ?? null;
/** Hasta aquí, corto; desde la página siguiente, largo. */
export const CORTO_MAX = 300;
export const EXTENSIONES = [
  { id: 'corto', nombre: 'Corto', cuanto: `hasta ${CORTO_MAX} páginas` },
  { id: 'largo', nombre: 'Largo', cuanto: `más de ${CORTO_MAX} páginas` },
];
/** La extensión de un libro por sus páginas (null si no se sabe: entonces vale para las dos). */
export const extensionDe = (paginas) => (Number(paginas) > 0 ? (Number(paginas) <= CORTO_MAX ? 'corto' : 'largo') : null);
export const encajaExtension = (paginas, extension) => {
  const e = extensionDe(paginas);
  return e == null || e === extension;
};

/** Granos de más cuando el cliente se lleva el ejemplar (si aciertas el género). `EXTRA_LLEVADO` (2) es el de antes. */
export const EXTRA_LIBRO = 4;
/** La caja del reparto: hasta 10 ejemplares, a 2 granos el ejemplar. */
export const REPARTO = { max: 10, precio: 2 };
/** Servidas de 2 estrellas o más para dominar una bebida (entonces Pilar puede prepararla). */
export const DOMINIO = 12;

/** Las estrellas del servicio: hasta 4 aciertos de la bebida y 3 del libro. 3 con los 7; 2 con 4 a 6; si no, 1 (nunca 0). */
export const estrellasTotal = (aciertosBebida = 0, aciertosLibro = 0) => {
  const p = aciertosBebida + aciertosLibro;
  return p >= 7 ? 3 : p >= 4 ? 2 : 1;
};

// ── Lo que hay en la balda ──
/** Los títulos de la balda (los de `librosDeLaBalda`) con ejemplares, en sus secciones (en el orden de los géneros). */
export function seccionesDe(balda = []) {
  const con = balda.filter((b) => (b.ejemplares ?? 0) > 0);
  return GENEROS.map((g) => ({
    genero: g.id,
    nombre: g.nombre,
    libros: con.filter((b) => (b.genero ?? 'novela') === g.id).sort((a, b) => String(a.title).localeCompare(String(b.title), 'es') || String(a.clave).localeCompare(String(b.clave))),
  })).filter((s) => s.libros.length);
}
/** Lo que se puede pedir hoy: cada género con ejemplares y cada extensión que exista en él. */
export function pedidosPosiblesBalda(balda = []) {
  const out = [];
  for (const s of seccionesDe(balda)) for (const e of EXTENSIONES) if (s.libros.some((b) => encajaExtension(b.paginas, e.id))) out.push({ genero: s.genero, extension: e.id });
  return out;
}
/** Sin ejemplares en la balda: nadie pide libro (solo el café). */
export const SIN_LIBRO = Object.freeze({ id: 'nada', genero: null, extension: null, forma: null });
/**
 * Qué libro pide cada cliente del día, de lo que hay en la balda ahora: por su semilla, primero géneros que nadie ha pedido aún
 * hoy (en el orden de los clientes), y la forma, aparte. Devuelve { [n]: { id: 'libro', genero, extension, forma } }.
 */
export function pedidosLibro(dia, balda = []) {
  const posibles = pedidosPosiblesBalda(balda);
  const usados = new Set();
  const elegir = (semilla) => {
    if (!posibles.length) return SIN_LIBRO;
    const s = Math.abs(Math.floor(Number(semilla) || 0));
    const libres = posibles.filter((p) => !usados.has(p.genero));
    const lista = libres.length ? libres : posibles;
    const p = lista[s % lista.length];
    usados.add(p.genero);
    return { id: 'libro', genero: p.genero, extension: p.extension, forma: FORMAS[Math.floor(s / 7) % FORMAS.length].id };
  };
  const out = {};
  for (const c of dia?.clientes ?? []) out[c.n] = elegir(c.semilla);
  for (const h of dia?.habituales ?? []) out[h.n] = elegir(h.semilla);
  // 1.132: los virales piden como cualquiera; el influencer, con su extensión y su forma fijas
  for (const v of dia?.virales ?? []) out[v.n] = elegir(v.semilla);
  const inf = dia?.influencer;
  if (inf) out[numeroInfluencer(inf.nivel)] = pedidoInfluencer(inf.nivel, posibles, semillaInfluencer(dia.dia, inf.nivel)) ?? SIN_LIBRO;
  return out;
}
/** Qué partes del libro aciertas: [género, extensión, forma]. */
export function aciertosLibro(libro, pedido, forma) {
  if (!libro || !pedido || pedido.id !== 'libro') return [false, false, false];
  return [(libro.genero ?? 'novela') === pedido.genero, encajaExtension(libro.paginas, pedido.extension), forma === pedido.forma];
}

// ── Cómo lo piden ──
const QUE = {
  novela: 'una novela',
  fantasia: 'algo de fantasía',
  misterio: 'un misterio',
  amor: 'una historia de amor',
  clasico: 'un clásico',
  'ciencia-ficcion': 'algo de ciencia ficción',
  poesia: 'un poemario',
  historia: 'algo de historia',
  biografia: 'una biografía',
  juvenil: 'algo juvenil',
};
const CUANTO = { corto: 'cortito', largo: 'largo, de los que duran' };
const COMO = { regalar: 'para regalar', aqui: 'para leerlo aquí', llevar: 'para llevármelo' };
/** Lo que dice el cliente al pedir el libro. */
export function frasePedido(p) {
  if (!p || p.id !== 'libro') return 'Si tienes libros, otro día; hoy, con el café me basta.';
  return `Y para leer, ${QUE[p.genero] ?? 'una novela'}, ${CUANTO[p.extension]}, ${COMO[p.forma]}.`;
}
/** La línea del libro en la comanda (clara). */
export function comandaLibro(p) {
  if (!p || p.id !== 'libro') return null;
  return `${nombreGenero(p.genero)} · ${p.extension === 'corto' ? 'corto' : 'largo'} · ${formaPorId(p.forma)?.nombre.toLowerCase()}`;
}
/** El libro del excéntrico, en acertijos (uno por parte). */
export const ACERTIJOS_LIBRO = {
  genero: {
    novela: 'Para leer, vidas ajenas contadas despacio.',
    fantasia: 'Para leer, algo donde la magia sea lo normal.',
    misterio: 'Para leer, un secreto que no me deje dormir.',
    amor: 'Para leer, dos corazones y muchos obstáculos.',
    clasico: 'Para leer, algo que ya leían mis abuelos.',
    'ciencia-ficcion': 'Para leer, un mañana que aún no ha llegado.',
    poesia: 'Para leer, versos que quepan en un suspiro.',
    historia: 'Para leer, lo que pasó de verdad, hace mucho.',
    biografia: 'Para leer, la vida entera de alguien que existió.',
    juvenil: 'Para leer, algo que me devuelva los quince años.',
  },
  extension: { corto: 'Que quepa entre dos estaciones de tren.', largo: 'Que pese como un ancla.' },
  forma: { regalar: 'Y envuelto, que no es para mí.', aqui: 'Me lo quedo aquí, con su marcapáginas.', llevar: 'Me lo llevo puesto, en su bolsa.' },
};
export const comandaLibroAcertijo = (p) => (p?.id === 'libro' ? [ACERTIJOS_LIBRO.genero[p.genero], ACERTIJOS_LIBRO.extension[p.extension], ACERTIJOS_LIBRO.forma[p.forma]] : []);

// ── La estantería por secciones (la de la pared izquierda) ──
/** Las filas de la estantería, de la que queda a mano a las de los extremos: a la altura del pecho, la de abajo, arriba, el suelo. */
export const FILAS = [2, 1, 3, 0];
export const filaZ = (fila) => 0.08 + fila * 0.58;
const hashTexto = (t) => {
  let h = 2166136261;
  for (const ch of String(t)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h / 4294967296;
};
/** El grueso de un lomo por sus páginas (sin páginas, uno mediano) y su alto (de 26 a 36 cm, fijo por título). */
export const grosorDe = (paginas) => (Number(paginas) > 0 ? 0.035 + Math.min(1, Number(paginas) / 900) * 0.055 : 0.05);
export const altoDe = (clave) => 0.26 + hashTexto(clave) * 0.1;
const HUELGO = 0.008;
const SUJETA = 0.05;
/** Secciones por fila como mucho (cada una con sitio para su placa) y el ancho del bloque, del más recogido al de la pared entera. */
const POR_FILA = 3;
const ANCHOS_BLOQUE = [1.7, 2.5, 3.4];
const MARGEN = 0.04;
/**
 * Dónde va cada sección y cada lomo (uno por ejemplar) en la estantería de la pared: un bloque centrado en la pared, por filas
 * (en y del mundo, del fondo a la puerta), con hasta tres secciones por fila y cada una en su hueco, con sus sujetalibros y
 * sitio para que su placa se lea (1.130: antes iban todas seguidas y, en un móvil, las placas se pisaban). Si no cabe en la
 * fila, a la siguiente; si no cabe todo en las cuatro filas, el bloque se ensancha. Devuelve [{ genero, nombre, fila, z, y0,
 * y1, hueco, placa: { y, ancho }, lomos: [{ clave, titulo, k, y0, y1, alto, paginas }] }] (y0 e y1, de los sujetalibros).
 */
export function estanteLibreria(balda = []) {
  const secciones = seccionesDe(balda);
  for (const W of ANCHOS_BLOQUE) {
    const r = colocarSecciones(secciones, W);
    if (r.cabe || W === ANCHOS_BLOQUE.at(-1)) return r.tramos;
  }
  return [];
}
function colocarSecciones(secciones, W) {
  const { y0, y1 } = ESTANTERIA;
  const centro = (y0 + y1) / 2;
  const [desde, hasta] = [Math.max(y0 + 0.1, centro - W / 2), Math.min(y1 - 0.1, centro + W / 2)];
  const hueco = (hasta - desde) / POR_FILA;
  const ultima = FILAS.length - 1;
  let f = 0;
  let y = desde;
  let cabe = true;
  const out = [];
  for (const s of secciones) {
    const ejemplares = s.libros.flatMap((b) => Array.from({ length: Math.min(99, b.ejemplares) }, () => b));
    const ancho = SUJETA + ejemplares.reduce((n, b) => n + grosorDe(b.paginas) + HUELGO, 0);
    const ocupa = Math.max(hueco, ancho + 2 * MARGEN);
    if (y > desde + 1e-9 && y + ocupa > hasta + 1e-9 && f < ultima) {
      f += 1;
      y = desde;
    }
    // En su hueco, centrada (si es más larga, desde el principio)
    const inicio = y + Math.max(MARGEN, (ocupa - ancho) / 2);
    let tramo = { genero: s.genero, nombre: s.nombre, fila: FILAS[f], z: filaZ(FILAS[f]), y0: inicio, y1: inicio, hueco: Math.min(ocupa, hueco), lomos: [] };
    out.push(tramo);
    let yy = inicio + SUJETA;
    let partida = false;
    ejemplares.forEach((b, k) => {
      const g = grosorDe(b.paginas);
      // Una sección más larga que la fila sigue en la siguiente (sin placa)
      if (yy + g > hasta - MARGEN && f < ultima) {
        tramo.y1 = yy;
        f += 1;
        yy = desde + MARGEN;
        tramo = { genero: s.genero, nombre: s.nombre, fila: FILAS[f], z: filaZ(FILAS[f]), y0: yy, y1: yy, hueco, lomos: [], sigue: true };
        out.push(tramo);
        yy += SUJETA;
        partida = true;
      }
      tramo.lomos.push({ clave: b.clave, titulo: b.title, k, y0: yy, y1: yy + g, alto: altoDe(b.clave), paginas: b.paginas ?? null });
      yy += g + HUELGO;
    });
    tramo.y1 = yy;
    if (yy > hasta) cabe = false;
    y = partida ? yy + MARGEN : y + ocupa;
  }
  for (const t of out) {
    // La placa, a lo ancho de su hueco (con el nombre grabado si cabe), bajo los lomos
    const ancho = Math.max(0.16, Math.min(0.34, t.hueco - 0.12));
    t.placa = t.sigue ? null : { y: (t.y0 + t.y1) / 2, ancho };
  }
  return { tramos: out, cabe };
}

// ── Pilar (§15.1) ──
/** Lo que se abre con la carta (sus gestos son tuyos hasta que lo domines, aunque Pilar ya prepare la bebida). */
export const DE_LA_CARTA = { toque: ['nata', 'vainilla', 'brulee'], grano: ['casa'] };
export const domina = (dominio = {}, clave) => (Number(dominio?.[clave]) || 0) >= DOMINIO;
/** Si Pilar puede preparar esta bebida (la dominas) para este cliente (al excéntrico, siempre a mano). */
export const pilarPuede = (dominio, bebida, { excentrico = false } = {}) => Boolean(bebida) && !excentrico && domina(dominio, bebida);
/** Si los gestos de esta etapa los hace Pilar: la bebida dominada y lo elegido en la etapa, si es de la carta, también. */
export function pilarHaceEtapa(dominio, receta = {}, etapa) {
  if (!domina(dominio, receta.bebida)) return false;
  if (etapa === 'toque' && DE_LA_CARTA.toque.includes(receta.toque)) return domina(dominio, `toque:${receta.toque}`);
  if (etapa === 'grano' && DE_LA_CARTA.grano.includes(receta.grano)) return domina(dominio, `grano:${receta.grano}`);
  return true;
}
/** Cuántas servidas lleva cada bebida hacia el dominio (para el aviso), entre 0 y 12. */
export const haciaDominio = (dominio = {}, bebida) => Math.min(DOMINIO, Number(dominio?.[bebida]) || 0);
const RECUERDO = 'cafe-pilar-prepara';
/** Lo último elegido para cada bebida en este dispositivo: 'pilar', 'mano' o null (aún no lo has elegido). */
export function preparaRecordado(bebida) {
  try {
    const v = JSON.parse(localStorage.getItem(RECUERDO) ?? '{}')?.[bebida];
    return v === 'pilar' || v === 'mano' ? v : null;
  } catch {
    return null;
  }
}
export function recordarPrepara(bebida, v) {
  try {
    const m = JSON.parse(localStorage.getItem(RECUERDO) ?? '{}') ?? {};
    localStorage.setItem(RECUERDO, JSON.stringify({ ...m, [bebida]: v }));
  } catch {
    /* sin almacenamiento, se pregunta otra vez */
  }
}
