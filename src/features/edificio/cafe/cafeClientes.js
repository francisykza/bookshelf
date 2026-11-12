// El café-librería del bajo, bloque 3 (1.121): los clientes del día, lo que piden (una bebida y un
// libro), la receta, las estrellas y lo que deja cada servicio; el excéntrico del día.
// El servidor (`20261211120000_cafe_clientes.sql`) fija cuántos clientes vienen, qué habituales, las cifras y las reseñas;
// la app decide qué pide cada cliente según tu biblioteca (que no está en el servidor) y si el libro encaja. Las cifras y
// las listas son las mismas que en la migración (una prueba lo comprueba). Personajes y frases, propios.
import { COMPLEMENTOS, JERSEYS, PANTALONES, PELOS, PIELES, COLORES_PELO, isPrenda } from '../actor';
import { dayKey } from '../../../domain/dates';
import { huecosDelNivel } from './cafeNiveles';

export { huecosDelNivel };

/** Cuántos clientes nuevos vienen al día según el nivel del café. */
export const clientesDelNivel = (nivel = 1) => (nivel <= 1 ? 3 : nivel === 2 ? 4 : 5);
/** Habituales como mucho al día (uno por sesión de lectura). */
export const MAX_HABITUALES = 2;
/** La carta: lo que se puede servir en cada nivel (el nivel 1, café y té). */
export const BEBIDAS = [
  { id: 'cafe', nombre: 'Café', nivel: 1 },
  { id: 'te', nombre: 'Té', nivel: 1 },
  { id: 'chocolate', nombre: 'Chocolate', nivel: 2, carta: 'chocolate' },
];
/** Las bebidas de la carta: café y té, y lo que hayas abierto en ella (bloque 4a: el chocolate). */
export const bebidasDe = (carta = []) => BEBIDAS.filter((b) => !b.carta || carta.includes(b.carta));
/**
 * Revisión del bloque 3 (Francisco, 12-11-2026): el café pesa más que el libro. Cada cliente pide una bebida con cuatro
 * elecciones, que se prepara en la barra; el libro es un extra. Las mismas listas y cuentas que `cafe_receta`,
 * `cafe_estrellas` y `cafe_premio` en el servidor (una prueba lo comprueba).
 */
export const PARTES = [
  {
    id: 'bebida',
    nombre: 'Bebida',
    opciones: [
      { id: 'cafe', nombre: 'Café' },
      { id: 'te', nombre: 'Té' },
      { id: 'chocolate', nombre: 'Chocolate', carta: 'chocolate' },
    ],
  },
  {
    id: 'grano',
    nombre: 'Grano u hoja',
    opciones: [
      { id: 'suave', nombre: 'Suave' },
      { id: 'intenso', nombre: 'Intenso' },
    ],
  },
  {
    id: 'leche',
    nombre: 'Leche',
    opciones: [
      { id: 'sin', nombre: 'Sin leche' },
      { id: 'entera', nombre: 'Entera' },
      { id: 'avena', nombre: 'De avena' },
    ],
  },
  {
    id: 'toque',
    nombre: 'Toque',
    opciones: [
      { id: 'nada', nombre: 'Sin nada' },
      { id: 'canela', nombre: 'Canela' },
      { id: 'miel', nombre: 'Miel' },
      { id: 'nata', nombre: 'Nata montada', carta: 'nata' },
    ],
  },
];
/** Las opciones de una parte con lo que haya abierto en la carta. */
export const opcionesDe = (parte, carta = []) => PARTES.find((p) => p.id === parte).opciones.filter((o) => !o.carta || carta.includes(o.carta));
/**
 * La receta de un número (los clientes, de las cifras de los miles de su semilla; los habituales, de quién son). Cada parte
 * toma su opción con su propia base (cuántas opciones tiene con la carta de ese día); sin carta, la cuenta de siempre.
 */
export function recetaDe(r, carta = []) {
  let d = 1;
  return PARTES.map((p) => {
    const ops = opcionesDe(p.id, carta);
    const o = ops[Math.floor(r / d) % ops.length].id;
    d *= ops.length;
    return o;
  });
}
/**
 * Lo que pide un cliente del día con la carta de ese día (la fija el servidor al abrir el día). Los habituales, siempre lo
 * mismo («lo de siempre»), con la carta de siempre.
 */
export const recetaPide = (c, carta = []) => (c.n > 100 ? recetaDe(c.quien * 29 + 7) : recetaDe(Math.floor(c.semilla / 1000), carta));
/** Cuántas partes de la bebida coinciden. */
export const aciertosDe = (receta, pide) => pide.reduce((n, x, k) => n + (receta?.[k] === x ? 1 : 0), 0);
/** Estrellas: cada parte acertada vale un punto y el libro que encaja, otro (de cinco). */
export const estrellasDe = (aciertos, encaja) => {
  const p = aciertos + (encaja ? 1 : 0);
  return p >= 5 ? 3 : p >= 3 ? 2 : 1;
};
/** Lo que deja un servicio según quién es y las estrellas: fallar paga menos, pero nunca cero. El excéntrico, el triple. */
export const PREMIOS = {
  cliente: [
    { granos: 2, reputacion: 6 },
    { granos: 4, reputacion: 10 },
    { granos: 5, reputacion: 14 },
  ],
  habitual: [
    { granos: 3, reputacion: 8 },
    { granos: 5, reputacion: 12 },
    { granos: 6, reputacion: 15 },
  ],
  excentrico: [
    { granos: 5, reputacion: 14 },
    { granos: 10, reputacion: 26 },
    { granos: 15, reputacion: 40 },
  ],
};
export const premio = (tipo, estrellas) => PREMIOS[tipo][Math.min(3, Math.max(1, estrellas)) - 1];
export const tipoDe = (c) => (c.habitual ? 'habitual' : c.excentrico ? 'excentrico' : 'cliente');
/** El nombre de una opción de la receta. */
export const nombreOpcion = (parte, id) => PARTES.find((p) => p.id === parte)?.opciones.find((o) => o.id === id)?.nombre ?? id;
/** La comanda, clara: «Un café intenso con leche de avena y canela». */
export function comandaClara([bebida, grano, leche, toque]) {
  const base = bebida === 'chocolate' ? `Un chocolate ${grano === 'suave' ? 'con leche' : 'negro'}` : `Un ${bebida === 'te' ? 'té' : 'café'} ${grano === 'suave' ? 'suave' : 'intenso'}`;
  const conLeche = leche === 'sin' ? 'sin leche' : leche === 'entera' ? 'con leche entera' : 'con leche de avena';
  const conToque = toque === 'nada' ? '' : toque === 'canela' ? ' y canela' : toque === 'nata' ? ' y nata montada' : ' y miel';
  return `${base} ${conLeche}${conToque}.`;
}
/** La comanda del excéntrico: cada parte, con un acertijo (frases cerradas). */
export const ACERTIJOS = {
  bebida: { cafe: 'Algo que se muela, no que se deje en remojo.', te: 'Hojas en agua caliente; nada de molinillos.', chocolate: 'Lo que se bate en el cazo, espeso como una tarde de lluvia.' },
  grano: { suave: 'Que me susurre al oído, no que me grite.', intenso: 'Fuerte como un temporal en el puerto.' },
  leche: { sin: 'Ni una nube en mi taza.', entera: 'Con la nube de una vaca contenta.', avena: 'Con la nube del campo, no de la granja.' },
  toque: { nada: 'Y tal cual, sin adornos.', canela: 'Con el polvo de una corteza.', miel: 'Con lo que guardan las abejas.', nata: 'Con una nube que se monta a mano.' },
};
export const comandaAcertijo = (receta) => PARTES.map((p, k) => ACERTIJOS[p.id][receta[k]]);

/**
 * Los excéntricos (uno al día, el último cliente): seis personajes propios, claramente distintos al resto (un tocado que
 * nadie más lleva, un aura de su color y su bocadillo de estrella), con un saludo y una reseña dorada propia (el orden es
 * el del servidor: `quien` = semilla % 6). Su ropa es de la corriente; el tocado, solo suyo (no es ninguna prenda).
 */
export const EXCENTRICOS = [
  {
    nombre: 'La Condesa de los Marcapáginas',
    tocado: 'turbante',
    tema: [150, 84, 190],
    saludo: '«Querida, mi paladar es un reino exigente. Atiende bien.»',
    dorada: 'Un servicio digno de una corte. La Condesa vuelve.',
    avatar: { piel: 0, pelo: 'largo', colorPelo: 5, jersey: 6, pantalon: 1, gafas: false, complemento: 'ninguno' },
  },
  {
    nombre: 'El Señor Tictac',
    tocado: 'bombin',
    tema: [214, 166, 70],
    saludo: '«Llego a la hora exacta. Mi taza también debería.»',
    dorada: 'Puntual, exacto, perfecto. Tic, tac.',
    avatar: { piel: 2, pelo: 'rapado', colorPelo: 4, jersey: 7, pantalon: 1, gafas: true, complemento: 'ninguno' },
  },
  {
    nombre: 'Madame Niebla',
    tocado: 'velo',
    tema: [140, 156, 196],
    saludo: '«Vengo de lejos, con la bruma. Escúchame con atención.»',
    dorada: 'Por fin alguien entendió la niebla.',
    avatar: { piel: 1, pelo: 'melena', colorPelo: 4, jersey: 7, pantalon: 1, gafas: false, complemento: 'ninguno' },
  },
  {
    nombre: 'El Capitán Tinta',
    tocado: 'tricornio',
    tema: [80, 120, 200],
    saludo: '«¡Ah del café! Mi pedido viene en clave, grumete.»',
    dorada: 'Ni en siete mares he bebido mejor.',
    avatar: { piel: 3, pelo: 'rizos', colorPelo: 0, jersey: 3, pantalon: 4, gafas: false, complemento: 'ninguno' },
  },
  {
    nombre: 'Doña Orquídea',
    tocado: 'flores',
    tema: [226, 110, 160],
    saludo: '«Huelo las tazas antes de verlas. No me falles, cielo.»',
    dorada: 'Floreció en la taza. Un diez.',
    avatar: { piel: 4, pelo: 'mono', colorPelo: 5, jersey: 4, pantalon: 2, gafas: true, complemento: 'ninguno' },
  },
  {
    nombre: 'El Profesor Lupa',
    tocado: 'birrete',
    tema: [110, 170, 110],
    saludo: '«Hoy le pongo examen. Lea mi pedido con lupa.»',
    dorada: 'Matrícula de honor para este café.',
    avatar: { piel: 1, pelo: 'corto', colorPelo: 5, jersey: 0, pantalon: 3, gafas: true, complemento: 'ninguno' },
  },
];

/** El pedido de libro del excéntrico, en acertijo. */
export const PEDIDO_ACERTIJO = {
  fantasia: 'Y para leer, algo donde la magia sea lo normal.',
  misterio: 'Y para leer, un secreto que no me deje dormir.',
  amor: 'Y para leer, dos corazones y muchos obstáculos.',
  futuro: 'Y para leer, un mañana que aún no ha llegado.',
  corto: 'Y para leer, algo que quepa entre dos estaciones.',
  tocho: 'Y para leer, algo que pese como un ancla.',
  clasico: 'Y para leer, algo que ya leían mis abuelos.',
  favorito: 'Y para leer, el que a ti te robó el corazón.',
  autor: 'Y para leer, a quien más visitas en tu estantería.',
  ultimo: 'Y para leer, el último viaje que terminaste.',
  libre: 'Y para leer, sorpréndeme.',
};

/** Los habituales: doce personajes propios que vuelven, con nombre y aspecto fijos (el orden es el del servidor). */
export const HABITUALES = [
  { nombre: 'Tomás', avatar: { piel: 2, pelo: 'corto', colorPelo: 5, jersey: 7, pantalon: 1, gafas: true, complemento: 'ninguno' } },
  { nombre: 'Lucía', avatar: { piel: 0, pelo: 'largo', colorPelo: 3, jersey: 0, pantalon: 0, gafas: false, complemento: 'ninguno' } },
  { nombre: 'Anselmo', avatar: { piel: 1, pelo: 'rapado', colorPelo: 5, jersey: 5, pantalon: 4, gafas: true, complemento: 'ninguno' } },
  { nombre: 'Marga', avatar: { piel: 3, pelo: 'mono', colorPelo: 4, jersey: 1, pantalon: 2, gafas: false, complemento: 'ninguno' } },
  { nombre: 'Iker', avatar: { piel: 1, pelo: 'rizos', colorPelo: 0, jersey: 3, pantalon: 0, gafas: false, complemento: 'ninguno' } },
  { nombre: 'Valentina', avatar: { piel: 4, pelo: 'rizos', colorPelo: 4, jersey: 4, pantalon: 1, gafas: false, complemento: 'ninguno' } },
  { nombre: 'Paco', avatar: { piel: 2, pelo: 'corto', colorPelo: 0, jersey: 6, pantalon: 3, gafas: false, complemento: 'ninguno' } },
  { nombre: 'Nuria', avatar: { piel: 0, pelo: 'melena', colorPelo: 2, jersey: 2, pantalon: 4, gafas: true, complemento: 'ninguno' } },
  { nombre: 'Héctor', avatar: { piel: 3, pelo: 'corto', colorPelo: 4, jersey: 0, pantalon: 1, gafas: false, complemento: 'ninguno' } },
  { nombre: 'Carmela', avatar: { piel: 1, pelo: 'mono', colorPelo: 5, jersey: 4, pantalon: 2, gafas: true, complemento: 'ninguno' } },
  { nombre: 'Bruno', avatar: { piel: 4, pelo: 'rapado', colorPelo: 4, jersey: 5, pantalon: 0, gafas: false, complemento: 'ninguno' } },
  { nombre: 'Inés', avatar: { piel: 2, pelo: 'largo', colorPelo: 1, jersey: 1, pantalon: 3, gafas: false, complemento: 'ninguno' } },
];
/** Lo que dejan escrito en la pizarra (frases cerradas; el servidor elige cuál). */
export const RESENAS = [
  'Volveré por ese café.',
  'Me llevé el que me dijiste y no pude parar.',
  'El mejor rincón del puerto.',
  'Aquí se lee mejor que en casa.',
  'Qué bien huele a papel y a café.',
  'Me quedé hasta el último capítulo.',
  'Pilar pone el té como nadie.',
  'Ya tengo libro para toda la semana.',
  'Un sitio para no tener prisa.',
  'Mañana traigo a una amiga.',
  'Acerté con tu recomendación.',
  'Se oye la lluvia y se está de maravilla.',
];

const anio = (b) => Number(String(b.publishedDate ?? '').slice(0, 4)) || null;
const categorias = (b) => (b.categories ?? []).join(' ').toLowerCase();
const tiene = (re) => (b) => re.test(categorias(b));

/**
 * Lo que puede pedir un cliente (frases cerradas). `encaja(libro, ctx)`: si un libro le va bien; ctx = { autor, ultimo }
 * (el autor que más tienes en la estantería y el último que terminaste). Solo se piden los que tu estantería puede cumplir.
 */
export const PEDIDOS = [
  { id: 'fantasia', frase: '¿Tienes algo de fantasía que enganche?', encaja: tiene(/fantas/) },
  { id: 'misterio', frase: 'Me apetece un misterio, de los de no dormir.', encaja: tiene(/myster|misterio|crime|crimen|thriller|polic|suspense|detective/) },
  { id: 'amor', frase: 'Quiero una historia de amor bonita.', encaja: tiene(/romanc|amor|love/) },
  { id: 'futuro', frase: '¿Algo de ciencia ficción? Naves, futuros raros…', encaja: tiene(/science fiction|ciencia ficci|ficción científica|dystop|distop/) },
  { id: 'corto', frase: 'Uno cortito, para leer en el tren.', encaja: (b) => b.pageCount > 0 && b.pageCount <= 250 },
  { id: 'tocho', frase: 'Busco un buen tocho para todo el invierno.', encaja: (b) => b.pageCount >= 500 },
  { id: 'clasico', frase: 'Dame un clásico, de los de antes.', encaja: (b) => (anio(b) ?? 9999) < 1950 },
  { id: 'favorito', frase: '¿Cuál es el que más te ha gustado?', encaja: (b) => b.favorite || b.rating >= 5 },
  { id: 'autor', frase: 'Algo del autor que más lees, que dicen que sabes mucho.', encaja: (b, ctx) => Boolean(ctx.autor) && b.author === ctx.autor },
  { id: 'ultimo', frase: '¿Qué es lo último que has terminado?', encaja: (b, ctx) => Boolean(ctx.ultimo) && b.id === ctx.ultimo },
];
/** Si tu estantería no puede cumplir ningún pedido (pocos libros o sin datos), se pide esto: siempre encaja. */
export const PEDIDO_LIBRE = { id: 'libre', frase: 'Lo que tú me recomiendes, me fío.', encaja: () => true };
export const pedidoPorId = (id) => PEDIDOS.find((p) => p.id === id) ?? PEDIDO_LIBRE;

/** El contexto de los pedidos: el autor que más se repite (al menos 2 libros) y el último que terminaste. */
export function contextoPedidos(libros = []) {
  const n = {};
  for (const b of libros) if (b.author && b.author !== 'Autor desconocido') n[b.author] = (n[b.author] ?? 0) + 1;
  const [autor, veces] = Object.entries(n).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? [null, 0];
  const leidos = libros.filter((b) => b.status === 'read' && b.finishedAt);
  const ultimo = leidos.sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)))[0]?.id ?? null;
  return { autor: veces >= 2 ? autor : null, ultimo };
}
/** Los pedidos que tu estantería puede cumplir (alguno de sus libros encaja). */
export function pedidosPosibles(libros = [], ctx = contextoPedidos(libros)) {
  return PEDIDOS.filter((p) => libros.some((b) => p.encaja(b, ctx)));
}
/**
 * Qué pide cada cliente del día: de los posibles, por su semilla, sin repetir mientras se pueda. Un habitual que vuelve el
 * día después de que terminaras un libro pregunta justo por él («el último que terminaste»).
 */
export function pedidosDelDia(dia, libros = [], hoy = dayKey()) {
  const ctx = contextoPedidos(libros);
  const posibles = pedidosPosibles(libros, ctx);
  const usados = new Set();
  const elegir = (semilla) => {
    if (!posibles.length) return PEDIDO_LIBRE;
    const libres = posibles.filter((p) => !usados.has(p.id));
    const lista = libres.length ? libres : posibles;
    const p = lista[semilla % lista.length];
    usados.add(p.id);
    return p;
  };
  const out = {};
  for (const c of dia?.clientes ?? []) out[c.n] = elegir(c.semilla);
  const ultimoLibro = libros.find((b) => b.id === ctx.ultimo);
  const reciente = ultimoLibro && String(ultimoLibro.finishedAt).slice(0, 10) >= ayerDe(hoy);
  for (const h of dia?.habituales ?? []) out[h.n] = reciente && posibles.some((p) => p.id === 'ultimo') && !usados.has('ultimo') ? (usados.add('ultimo'), pedidoPorId('ultimo')) : elegir(h.semilla);
  return { pedidos: out, ctx };
}
function ayerDe(hoy) {
  const d = new Date(`${hoy}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

// El aspecto de un cliente nuevo, sacado de su semilla, con ropa de la corriente (nunca prendas que se ganan)
const basicos = (lista, key) => lista.filter((x) => !isPrenda(key, x.id));
const JERSEYS_BASE = basicos(JERSEYS, 'jersey').slice(0, 12);
const PANTALONES_BASE = basicos(PANTALONES, 'pantalon').slice(0, 8);
const COMPLEMENTOS_BASE = basicos(COMPLEMENTOS, 'complemento');
const COLORES_BASE = COLORES_PELO.slice(0, 6);
const pick = (lista, semilla, k) => lista[Math.floor(semilla / k) % lista.length];
export function aspectoDe(semilla = 0) {
  return {
    piel: pick(PIELES, semilla, 1).id,
    pelo: pick(PELOS, semilla, 5).id,
    colorPelo: pick(COLORES_BASE, semilla, 31).id,
    jersey: pick(JERSEYS_BASE, semilla, 187).id,
    pantalon: pick(PANTALONES_BASE, semilla, 2243).id,
    gafas: Math.floor(semilla / 17947) % 4 === 0,
    complemento: pick(COMPLEMENTOS_BASE, semilla, 7).id,
  };
}

/**
 * Los libros que ofreces al recomendar: tres fichas de la estantería, sacadas de la semilla del cliente; una encaja si
 * alguno puede (el reto es elegir bien entre pocas, no buscar en toda la estantería) y las demás, mejor que no.
 */
export function librosParaRecomendar(pedido, libros = [], ctx = contextoPedidos(libros), semilla = 0, n = 3) {
  const si = libros.filter((b) => pedido.encaja(b, ctx));
  const no = libros.filter((b) => !pedido.encaja(b, ctx));
  const out = [];
  if (si.length) out.push(si[semilla % si.length]);
  for (let k = 0; out.length < n && k < no.length; k += 1) {
    const b = no[(semilla + k * 7) % no.length];
    if (!out.includes(b)) out.push(b);
  }
  for (const b of [...no, ...si]) if (out.length < n && !out.includes(b)) out.push(b);
  // El orden también sale de la semilla: la que encaja no va siempre primera
  const giro = Math.floor(semilla / 3) % Math.max(1, out.length);
  return [...out.slice(giro), ...out.slice(0, giro)];
}

/**
 * Las sesiones de lectura de hoy que traen habituales (como mucho 2): cada sesión de lectura cozy de 15 minutos o más, y
 * haber registrado lectura hoy (el registro no guarda minutos: cuenta como una).
 */
export function sesionesDeHoy(progress, hoy = dayKey()) {
  const pomodoros = (progress?.pomodoros ?? []).filter((p) => p.at && dayKey(new Date(p.at)) === hoy && (p.minutes ?? 0) >= 15).length;
  const registro = (progress?.readingLog ?? []).some((e) => e.date === hoy && e.kind !== 'correction' && (e.active ?? e.pages > 0)) ? 1 : 0;
  return Math.min(MAX_HABITUALES, pomodoros + registro);
}

/** Todos los clientes del día en orden: primero los nuevos, luego los habituales; con su aspecto, nombre y pedido. */
export function clientesDelDia(dia, pedidos) {
  if (!dia) return [];
  const nuevos = (dia.clientes ?? []).map((c) => {
    const ex = c.excentrico ? (EXCENTRICOS[c.quien] ?? EXCENTRICOS[0]) : null;
    return {
      ...c,
      habitual: false,
      excentrico: Boolean(ex),
      raro: ex,
      nombre: ex?.nombre ?? 'Cliente',
      aspecto: ex?.avatar ?? aspectoDe(c.semilla),
      pedido: pedidos[c.n] ?? PEDIDO_LIBRE,
      pide: recetaPide(c, dia.carta ?? []),
    };
  });
  const habituales = (dia.habituales ?? []).map((h) => ({
    ...h,
    habitual: true,
    nombre: HABITUALES[h.quien]?.nombre ?? 'Habitual',
    aspecto: HABITUALES[h.quien]?.avatar ?? aspectoDe(h.semilla),
    pedido: pedidos[h.n] ?? PEDIDO_LIBRE,
    pide: recetaPide(h),
  }));
  return [...nuevos, ...habituales];
}

// ── Libros en cajas (§121.3, cifras aprobadas por Francisco el 12-11-2026, «Sí, esas cifras») ──
// Lo que lees desbloquea el título en la distribuidora; con granos se compran cajas (de un género o de un título), la caja
// llega al café, se abre y los ejemplares se colocan en la balda. Solo se recomienda lo que está en la balda; si encaja, el
// cliente se lo lleva y paga unos granos más. Las cifras son las de la migración (una prueba lo comprueba).
/** Los géneros de la distribuidora (los mismos ids que `cafe_generos()` en el servidor). */
export const GENEROS = [
  { id: 'novela', nombre: 'Novela' },
  { id: 'fantasia', nombre: 'Fantasía' },
  { id: 'misterio', nombre: 'Misterio' },
  { id: 'amor', nombre: 'Amor' },
  { id: 'clasico', nombre: 'Clásico' },
  { id: 'ciencia-ficcion', nombre: 'Ciencia ficción' },
  { id: 'poesia', nombre: 'Poesía' },
  { id: 'historia', nombre: 'Historia' },
  { id: 'biografia', nombre: 'Biografía' },
  { id: 'juvenil', nombre: 'Juvenil' },
];
/** Cómo se reconoce cada género en las categorías del libro (en orden: la primera que casa manda). */
const GENERO_DE = [
  [/science fiction|ciencia ficci|ficción científica|dystop|distop/, 'ciencia-ficcion'],
  [/fantas/, 'fantasia'],
  [/myster|misterio|crime|crimen|thriller|polic|suspense|detective/, 'misterio'],
  [/romanc|amor|love/, 'amor'],
  [/classic|clásic/, 'clasico'],
  [/poetry|poesía|poesia/, 'poesia'],
  [/histor/, 'historia'],
  [/biograph|biograf|memoir|memorias/, 'biografia'],
  [/juvenile|young adult|juvenil/, 'juvenil'],
];
/** El género de un libro de tu biblioteca (si no se sabe, «Novela»). */
export const generoDe = (b) => GENERO_DE.find(([re]) => re.test(categorias(b)))?.[1] ?? 'novela';
export const nombreGenero = (id) => GENEROS.find((g) => g.id === id)?.nombre ?? 'Novela';
/** Caja de un género: 5 ejemplares al azar entre tus títulos de ese género. */
export const CAJA_GENERO = { ejemplares: 5, precio: 10 };
/** Caja de un título concreto: 3 ejemplares. */
export const CAJA_TITULO = { ejemplares: 3, precio: 9 };
/** La caja de bienvenida, gratis y una vez. */
export const BIENVENIDA = 8;
/** Granos de más cuando el cliente se lleva el libro (solo si encaja). */
export const EXTRA_LLEVADO = 2;

/** Los títulos que la distribuidora tiene para ti (los de `librosDelCafe`), como los espera el servidor. */
export const titulosDelCafe = (libros = []) => libros.slice(0, 200).map((b) => ({ clave: String(b.id).slice(0, 80), titulo: String(b.title || 'Sin título').slice(0, 200), genero: generoDe(b) }));
/** Cuántos títulos tienes de cada género (para la distribuidora: solo se venden los que tienes). */
export function generosDisponibles(titulos = []) {
  const n = {};
  for (const t of titulos) n[t.genero] = (n[t.genero] ?? 0) + 1;
  return GENEROS.filter((g) => n[g.id]).map((g) => ({ ...g, titulos: n[g.id] }));
}
/** Lo que hay en la balda, como libros para recomendar: el de tu biblioteca si sigue ahí; si no, uno mínimo con su título. */
export function librosDeLaBalda(estado, libros = []) {
  const porId = new Map(libros.map((b) => [String(b.id), b]));
  return (estado?.libros ?? [])
    .filter((x) => x.balda > 0)
    .map((x) => ({ ...(porId.get(x.clave) ?? { id: x.clave, title: x.titulo, author: '', categories: [GENEROS.find((g) => g.id === x.genero)?.nombre ?? ''] }), clave: x.clave, ejemplares: x.balda }));
}
/** Cuántos ejemplares hay en la balda y cuántos esperan en las cajas. */
export const enBalda = (estado) => (estado?.libros ?? []).reduce((s, x) => s + x.balda, 0);
export const enCajas = (estado) => (estado?.libros ?? []).reduce((s, x) => s + x.caja, 0);
