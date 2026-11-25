// El café-librería del bajo, 1.143 (encargo de Francisco del 17-11-2026: vender comida, «algo como starbucks pero super cozy»; de
// la cadena del ejemplo, solo el género. Plan en docs/qa/cafe-libreria.md §18, aprobado el mismo día con las cuatro
// recomendadas): el obrador, primera tanda (bloque 1 de §18.12).
// - Desde el nivel 4, al fondo del ala lateral, tras un tabique: el horno de la antigua tahona de doña Amparo, su mesa de
//   mármol, la pala y el recetario (un cuaderno de cocina con tapas de hule a cuadros). Al abrirlo, la primera hornada de la
//   casa (seis magdalenas) ya está en la vitrina de la barra.
// - Cada receta, dos gestos con su objeto y su sonido (`cafeObradorGestos.js`); después, la pala al horno. Se hornea sin números
//   ni prisa (de 1 a 1 min 30 s), nunca se quema y la campanilla avisa. La pala la saca y Pilar la lleva a la vitrina; lo que no
//   cabe espera en la bandeja.
// - Las estrellas salen del mimo de los dos gestos (las del taller) y dan piezas: las de la receta, una menos por estrella que
//   falta. Máximo dos cosas por cliente (Francisco, 17-11-2026, tras ver la 1.143: «Dos máx., 1 de cada 3»): uno de cada tres
//   pide la bebida y algo dulce o salado para acompañar, sin libro (lo decide el servidor), y sus estrellas salen solo de la
//   bebida. La taza y la pieza van en el mismo viaje: de la barra a la vitrina (las pinzas, de la vitrina al plato) y a su mesa.
//   La comida solo da granos, su precio: nunca reputación, tickets ni estrellas. Sin pieza del tipo que pide, solo el café.
// 1.144 (bloque 2): las mejoras del horno y de la vitrina, las vitrinas de tartas que suman, la venta del mostrador con la caja de
// latón, la especialidad del día y la maestría de cada receta, con «Que lo hornee Pilar».
// 1.145 (bloque 3, «el recetario crece»): las galletas del puerto (nivel 5), el pan de la bodega con su noche (6), el bizcocho
// del tostadero (7) y la tortilla en el fogón (8); los hitos con sus adornos; el acertijo del excéntrico (paga el doble) y el
// favorito de los habituales (+2).
// Las cifras son las de las migraciones `20261225120000_cafe_obrador.sql` y `20261226120000_cafe_obrador_mejoras.sql` y
// `20261227120000_cafe_obrador_recetario.sql` (unas pruebas lo comprueban). Solo reglas: sin React ni Three.
import { estrellasTaller } from './cafeTaller';

/** El nivel desde el que se abre el obrador (la Sala de lectura grande, con el ala lateral). */
export const OBRADOR_NIVEL = 4;
/** Hornadas al día, como mucho (un tope que nadie debería notar). */
export const TOPE_HORNADAS = 30;
/** Bandejas del horno y piezas que caben en la vitrina, por grado. */
export const BANDEJAS = { 1: 1, 2: 2, 3: 3 };
export const CABE_VITRINA = { 1: 12, 2: 20, 3: 30, 4: 40 };
/** 1.144: las piezas que vende Pilar en el mostrador por cada día entero, según el grado de la vitrina; guarda como mucho 7 días. */
export const CUPO_MOSTRADOR = { 1: 4, 2: 6, 3: 9, 4: 12 };
export const MOSTRADOR_DIAS = 7;
/** 1.144: las vitrinas de tartas (el mueble del nivel 2) colocadas en el café suman 6 huecos cada una, hasta dos. */
export const TARTAS = Object.freeze({ mueble: 'cafe-vitrina', huecos: 6, max: 2 });
/**
 * 1.144: las mejoras del obrador, como el cuaderno de Pilar (se pagan una vez con granos y nunca caducan). Por grado: su precio (el
 * 1, de serie), el nivel del café desde el que se compra y cómo se ve.
 */
export const MEJORAS_OBRADOR = Object.freeze({
  horno: [
    { grado: 1, precio: 0, nivel: 4, nombre: 'Restaurado', se: 'Con sus grietas y una bandeja' },
    { grado: 2, precio: 250, nivel: 4, nombre: 'La puerta de hierro', se: 'Puerta de hierro nueva y dos bandejas: dos hornadas a la vez' },
    { grado: 3, precio: 600, nivel: 6, nombre: 'Los azulejos', se: 'Azulejos y tres bandejas: tres hornadas a la vez' },
  ],
  vitrina: [
    { grado: 1, precio: 0, nivel: 4, nombre: 'La campana de cristal', se: '12 piezas · Pilar vende 4 al día' },
    { grado: 2, precio: 150, nivel: 4, nombre: 'La vitrina de madera', se: '20 piezas · Pilar vende 6 al día' },
    { grado: 3, precio: 350, nivel: 5, nombre: 'El mostrador', se: '30 piezas · Pilar vende 9 al día' },
    { grado: 4, precio: 700, nivel: 7, nombre: 'La vitrina de dos alturas', se: '40 piezas · Pilar vende 12 al día' },
  ],
});
/** El grado siguiente de una mejora ('horno' o 'vitrina') a partir del que tienes, o null si ya está en el mejor. */
export const siguienteMejora = (mejora, grado = 1) => MEJORAS_OBRADOR[mejora]?.find((m) => m.grado === grado + 1) ?? null;
/**
 * 1.144: la maestría de cada receta, con las hornadas de 2 o 3 estrellas: ★ con 3 (+1 pieza por bandeja), ★★ con 10 (+1 grano por
 * pieza servida en la mesa) y ★★★ con 25 («Que lo hornee Pilar»).
 */
export const MAESTRIA = Object.freeze([3, 10, 25]);
export const maestriaDe = (buenas = 0) => MAESTRIA.filter((n) => (Number(buenas) || 0) >= n).length;
/** Las hornadas buenas que faltan para la estrella siguiente (null con las tres). */
export const faltanMaestria = (buenas = 0) => {
  const n = MAESTRIA.find((m) => (Number(buenas) || 0) < m);
  return n == null ? null : n - (Number(buenas) || 0);
};
/** Lo que trae cada estrella de maestría. */
export const PREMIO_MAESTRIA = ['Una pieza más en cada bandeja', 'Un grano más por pieza servida en la mesa', 'Que lo hornee Pilar'];
/** 1.144: la especialidad del día paga +1 grano por pieza (en la mesa y en el mostrador). */
export const EXTRA_ESPECIALIDAD = 1;
/** La maestría ★★ paga +1 grano por pieza servida en la mesa. */
export const EXTRA_MAESTRIA = 1;
/** De quienes piden comida, cuántos de cada tres quieren el tipo de la especialidad (sin especialidad, la mitad). */
export const PIDEN_ESPECIALIDAD = 2;
/** Las vitrinas de tartas que cuentan en un plano ({ items: [{ id }] }). */
export const tartasEn = (plano) => Math.min(TARTAS.max, (Array.isArray(plano?.items) ? plano.items : []).filter((e) => e?.id === TARTAS.mueble).length);
/** 1.145: el favorito de un habitual paga +2; el excéntrico paga el doble de la pieza. */
export const EXTRA_FAVORITO = 2;
/**
 * Lo que paga una pieza servida en la mesa: su precio (el doble, al excéntrico), +1 si es la especialidad, +1 con la maestría ★★ y
 * +2 si es el favorito del habitual que la pidió (`favorito`, la receta que quiere).
 */
export const precioMesa = (id, { especialidad = null, buenas = 0, excentrico = false, favorito = null } = {}) =>
  (recetaObrador(id)?.precio ?? 0) * (excentrico ? 2 : 1) +
  (id === especialidad ? EXTRA_ESPECIALIDAD : 0) +
  (maestriaDe(buenas) >= 2 ? EXTRA_MAESTRIA : 0) +
  (!excentrico && favorito && id === favorito ? EXTRA_FAVORITO : 0);
/** Uno de cada tres clientes pide comida (y ese no pide libro: máximo dos cosas por cliente). */
export const PIDE_COMIDA_CADA = 3;
/** Las estrellas de quien pide comida: solo los 4 aciertos de la bebida. 3 con los 4; 2 con 2 o 3; si no, 1 (nunca 0). */
export const estrellasBebida = (aciertos = 0) => (aciertos >= 4 ? 3 : aciertos >= 2 ? 2 : 1);
/**
 * El pedido de quien pide comida, en el lugar del libro (`cliente.pedido`). 1.145: `quiere`, la receta concreta (el acertijo del
 * excéntrico o el favorito de un habitual; lo dice el servidor) y `excentrico`.
 */
export const pedidoComida = (tipo, quiere = null, excentrico = false) =>
  Object.freeze({
    id: 'comida',
    tipo: tipo === 'salado' ? 'salado' : 'dulce',
    quiere: recetaObrador(quiere) ? quiere : null,
    excentrico: Boolean(excentrico && recetaObrador(quiere)),
    genero: null,
    extension: null,
    forma: null,
  });
/** La primera hornada de la casa, ya en la vitrina al abrir el obrador. */
export const PRIMERA_HORNADA = { receta: 'magdalenas', piezas: 6 };

/**
 * Las seis páginas del recetario, en su orden: el nombre, si es dulce o salado, el nivel en que se abre, las piezas con 1, 2 y 3
 * estrellas, su precio en granos, lo que tarda en el horno (s), sus dos gestos y la nota de doña Amparo en la ficha. `tanda`: el
 * bloque en que llegó; `noche`, el pan (se amasa un día y se greña al siguiente); `fogon`, la tortilla (al fogón, no al horno).
 */
export const RECETAS_OBRADOR = [
  {
    id: 'magdalenas',
    nombre: 'Magdalenas de limón',
    tipo: 'dulce',
    nivel: 4,
    piezas: [4, 5, 6],
    precio: 2,
    segundos: 60,
    gestos: ['rallar', 'colmar'],
    tanda: 1,
    nota: 'La piel del limón, recién rallada, y los moldes bien colmados: así suben con su copete.',
  },
  {
    id: 'empanada',
    nombre: 'Empanada de bonito',
    tipo: 'salado',
    nivel: 4,
    piezas: [4, 5, 6],
    precio: 3,
    segundos: 90,
    gestos: ['rodillo', 'repulgo'],
    tanda: 1,
    nota: 'La masa, fina y pareja; el borde, cerrado con su repulgo, que no se escape el jugo.',
  },
  {
    id: 'galletas',
    nombre: 'Galletas del puerto',
    tipo: 'dulce',
    nivel: 5,
    piezas: [6, 7, 8],
    precio: 2,
    segundos: 60,
    gestos: ['cortapastas', 'glasa'],
    tanda: 3,
    nota: 'Un ancla, un barco, una estrella de mar y el faro. Que no se pisen, y la glasa por su raya.',
  },
  {
    id: 'pan',
    nombre: 'Pan de la bodega',
    tipo: 'salado',
    nivel: 6,
    piezas: [6, 7, 8],
    precio: 4,
    segundos: 60,
    gestos: ['amasar', 'grenar'],
    tanda: 3,
    noche: true,
    nota: 'Se amasa un día y duerme en la bodega fresca. Al otro, un tajo sin dudar y al horno.',
  },
  {
    id: 'bizcocho',
    nombre: 'Bizcocho del tostadero',
    tipo: 'dulce',
    nivel: 7,
    piezas: [6, 7, 8],
    precio: 4,
    segundos: 90,
    gestos: ['envolver', 'tamiz'],
    tanda: 3,
    nota: 'Con una cucharada del tueste de la casa. Se envuelve sin batir, que no se baje.',
  },
  {
    id: 'tortilla',
    nombre: 'Tortilla de patatas',
    tipo: 'salado',
    nivel: 8,
    piezas: [6, 7, 8],
    precio: 5,
    segundos: 60,
    gestos: ['cascar', 'vuelta'],
    tanda: 3,
    fogon: true,
    nota: 'Al fogón, no al horno. Y la vuelta, con el plato y sin pensarlo.',
  },
];
/** 1.145: ya se hornean todas (cada una, desde su nivel). */
export const HORNABLES = RECETAS_OBRADOR.map((r) => r.id);

/** La receta con ese id, o null. */
export const recetaObrador = (id) => RECETAS_OBRADOR.find((r) => r.id === id) ?? null;
/** ¿Se puede hornear ya esta receta en este nivel? */
export const recetaAbierta = (id, nivel) => {
  const r = recetaObrador(id);
  return Boolean(r && HORNABLES.includes(r.id) && r.nivel <= nivel);
};
/** Las estrellas de una hornada: las del taller (3 con los dos gestos bien, 2 con uno, 1 si no; nunca cero). */
export const estrellasHornada = (mimo = []) => estrellasTaller(mimo);
/** Las piezas que salen de una receta con esas estrellas (con la maestría ★, `buenas` ≥ 3, una más). */
export const piezasDe = (id, estrellas, buenas = 0) => {
  const base = recetaObrador(id)?.piezas[Math.min(3, Math.max(1, estrellas)) - 1] ?? 0;
  return base ? base + (maestriaDe(buenas) >= 1 ? 1 : 0) : 0;
};
/** Las piezas que hay ahora en la vitrina (de todas las recetas). */
export const enVitrina = (obrador) => Object.values(obrador?.piezas ?? {}).reduce((n, p) => n + (Number.isInteger(p) ? p : 0), 0);
/** Lo que queda libre en la vitrina. */
export const huecoVitrina = (obrador) => Math.max(0, (obrador?.cabe ?? CABE_VITRINA[1]) - enVitrina(obrador));
/** Una bandeja libre del horno (la primera), o null si están todas dentro. */
export function bandejaLibre(obrador) {
  const ocupadas = new Set((obrador?.horneando ?? []).map((h) => h.bandeja));
  for (let b = 1; b <= (obrador?.bandejas ?? 1); b += 1) if (!ocupadas.has(b)) return b;
  return null;
}
/**
 * Lo que le queda en el horno a una bandeja de `horneando` ({ receta, falta (s, al cargarla), desde (ms, cuando se cargó) }): los
 * segundos que faltan, lo hecha que está (de 0, recién metida, a 1) y si ya se puede sacar. El servidor deja sacarla 5 s antes.
 */
export function estadoHorno(h, ahora = Date.now()) {
  const seg = recetaObrador(h?.receta)?.segundos ?? 60;
  const queda = Math.max(0, (h?.falta ?? 0) - (ahora - (h?.desde ?? ahora)) / 1000);
  return { queda, t: Math.min(1, Math.max(0, 1 - queda / seg)), listo: queda <= 0 };
}
/**
 * 1.145.1 (Francisco, 25-11-2026: «cuando tengas cosas haciéndose en el horno te salga una notificación cuando se terminen, o
 * un indicador visual claro»): lo que dice la nota de la campanilla. «Ya están las magdalenas.», «Ya ha cuajado la tortilla.»,
 * y con varias a la vez, «Ya están las galletas y el pan.».
 */
const YA_ESTA = {
  magdalenas: 'Ya están las magdalenas',
  empanada: 'Ya está la empanada',
  galletas: 'Ya están las galletas',
  pan: 'Ya está el pan',
  bizcocho: 'Ya está el bizcocho',
  tortilla: 'Ya ha cuajado la tortilla',
};
const LA_RECETA = { magdalenas: 'las magdalenas', empanada: 'la empanada', galletas: 'las galletas', pan: 'el pan', bizcocho: 'el bizcocho', tortilla: 'la tortilla' };
export function yaEsta(recetas) {
  const ids = [...new Set(recetas ?? [])].filter((id) => YA_ESTA[id]);
  if (!ids.length) return '';
  if (ids.length === 1) return `${YA_ESTA[ids[0]]}.`;
  const l = ids.map((id) => LA_RECETA[id]);
  return `Ya están ${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}.`;
}
/** Lo que hay en el horno, para el indicador del HUD: «las magdalenas» o «las galletas y el pan». */
export function enElHornoTexto(recetas) {
  const l = [...new Set(recetas ?? [])].map((id) => LA_RECETA[id]).filter(Boolean);
  return l.length <= 1 ? (l[0] ?? '') : `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`;
}
/** Cómo se llaman las piezas de cada receta (una y varias). */
const PIEZA = {
  magdalenas: ['magdalena', 'magdalenas'],
  empanada: ['ración de empanada', 'raciones de empanada'],
  galletas: ['galleta', 'galletas'],
  pan: ['pieza de pan', 'piezas de pan'],
  bizcocho: ['porción de bizcocho', 'porciones de bizcocho'],
  tortilla: ['pincho de tortilla', 'pinchos de tortilla'],
};
/** «la magdalena», «la empanada»… (en «2 por la magdalena»). */
export const laPieza = (id) => ({ magdalenas: 'la magdalena', empanada: 'la empanada', galletas: 'la galleta', pan: 'el pan', bizcocho: 'el bizcocho', tortilla: 'la tortilla' })[id] ?? 'la pieza';
/** «6 magdalenas», «1 ración de empanada»… */
export const nombrePiezas = (id, n) => `${n} ${(PIEZA[id] ?? ['pieza', 'piezas'])[n === 1 ? 0 : 1]}`;
/** Las piezas de la vitrina que valen para quien pide algo `tipo` ('dulce' o 'salado'): [{ receta, piezas }]. */
export const paraAcompanar = (obrador, tipo) =>
  RECETAS_OBRADOR.filter((r) => r.tipo === tipo && (obrador?.piezas?.[r.id] ?? 0) > 0).map((r) => ({ receta: r.id, piezas: obrador.piezas[r.id] }));

/** Cada gesto de la tanda: su objeto, lo que se pide, su ayuda, el atajo (un toque) y lo que se dice según cómo quede. */
export const GESTO_OBRADOR = {
  rallar: {
    objeto: 'el rallador de latón',
    orden: 'Ralla la piel del limón',
    ayuda: 'Desliza el limón de arriba abajo por el rallador, en pasadas largas.',
    atajo: 'Rallar el limón',
    bien: '«Huele a limón hasta la calle. Pasadas largas, así.»',
    mejor: 'Con pasadas largas, de punta a punta del rallador, sale la piel fina y sin lo blanco.',
  },
  colmar: {
    objeto: 'la cuchara y los moldes de papel rizado',
    orden: 'Colma los moldes con la masa',
    ayuda: 'Pasa la cuchara por encima de los seis moldes: una pasada de ida y otra de vuelta.',
    atajo: 'Llenar los moldes',
    bien: '«Colmados justo hasta el borde: saldrán con su copete.»',
    mejor: 'Una pasada de ida y otra de vuelta, de punta a punta: si se pasa dos veces por el mismo, rebosa.',
  },
  rodillo: {
    objeto: 'el rodillo de madera',
    orden: 'Estira la masa con el rodillo',
    ayuda: 'Pasa el rodillo arriba y abajo, de punta a punta de la masa.',
    atajo: 'Estirar la masa',
    bien: '«Fina y pareja, que se transparenta. Así se estira.»',
    mejor: 'Con pasadas largas, de punta a punta, la masa queda pareja; a pasaditas, se hace grumos.',
  },
  repulgo: {
    objeto: 'los dedos, sobre la fuente de barro',
    orden: 'Cierra el borde con el repulgo',
    ayuda: 'Da la vuelta a la empanada siguiendo el borde con el dedo.',
    atajo: 'Hacer el repulgo',
    bien: '«Un repulgo de los de antes: no se escapa ni una gota.»',
    mejor: 'Pegado al borde, el repulgo cierra bien; si te vas hacia dentro, se pellizca el relleno.',
  },
};
/** 1.145: los gestos de las cuatro recetas nuevas (§18.5). */
Object.assign(GESTO_OBRADOR, {
  cortapastas: {
    objeto: 'los cortapastas de hojalata',
    orden: 'Corta las cuatro galletas',
    ayuda: 'Toca la masa donde quieras cortar: un ancla, un barco, una estrella de mar y el faro.',
    atajo: 'Cortar las galletas',
    bien: '«Cuatro formas y ni una pisada. Así se aprovecha la masa.»',
    mejor: 'Si cortas una encima de otra, se pisan: separadas, salen enteras.',
  },
  glasa: {
    objeto: 'la manga de glasa',
    orden: 'Sigue la raya con la glasa',
    ayuda: 'Pasa el dedo por la raya de puntos, de un lado al otro, sin despegarte.',
    atajo: 'Poner la glasa',
    bien: '«Un hilillo fino, por su raya. Ni que fuera encaje.»',
    mejor: 'Pegado a la raya de puntos, el hilillo queda fino; si te apartas, se emborrona.',
  },
  amasar: {
    objeto: 'la masa madre, sobre el mármol enharinado',
    orden: 'Amasa: empuja con la palma, cuatro veces',
    ayuda: 'Empuja la masa hacia arriba con la palma y suéltala: cuatro empujones, todos iguales.',
    atajo: 'Amasar',
    bien: '«Lisa y viva: mira cómo vuelve. A dormir a la bodega.»',
    mejor: 'Con empujones parejos, la masa se estira igual por todas partes; unos largos y otros cortos, se rasga.',
  },
  grenar: {
    objeto: 'la cuchilla de greñar',
    orden: 'Greña el pan: un tajo',
    ayuda: 'Un solo tajo curvo, de punta a punta del pan, sin levantar el dedo.',
    atajo: 'Greñar el pan',
    bien: '«Un tajo sin dudar. Ya verás qué oreja le sale.»',
    mejor: 'De una vez y sin parar: si se duda a medio tajo, la greña se cierra en el horno.',
  },
  envolver: {
    objeto: 'la espátula y el bol de loza',
    orden: 'Envuelve la masa con la espátula',
    ayuda: 'Tres trazos en jota: baja por el centro y sube por el lado.',
    atajo: 'Envolver la masa',
    bien: '«Envuelta sin batir: el aire se queda dentro.»',
    mejor: 'Cada jota entera, bajando por el centro y subiendo por el lado; a medias, la masa se baja.',
  },
  tamiz: {
    objeto: 'el tamiz y la plantilla del ancla',
    orden: 'Espolvorea el azúcar sobre la plantilla',
    ayuda: 'Pasa el dedo sobre la plantilla, de un lado a otro, hasta cubrirla entera.',
    atajo: 'Espolvorear el azúcar',
    bien: '«Mira el ancla del café, blanca como la nieve.»',
    mejor: 'Dentro de la plantilla cae donde debe; si te sales, se llena la mesa de azúcar.',
  },
  cascar: {
    objeto: 'los huevos y el bol',
    orden: 'Casca los tres huevos',
    ayuda: 'Un toque en el borde del bol y abre el huevo hacia un lado. Tres veces.',
    atajo: 'Cascar los huevos',
    bien: '«Ni una cáscara. Así se casca.»',
    mejor: 'Ábrelo de lado, de un tirón: si tiras hacia arriba o abajo, cae alguna cáscara.',
  },
  vuelta: {
    objeto: 'la sartén de hierro y el plato de loza',
    orden: 'Dale la vuelta con el plato',
    ayuda: 'Media vuelta alrededor de la sartén, decidida y sin parar.',
    atajo: 'Darle la vuelta',
    bien: '«¡Plof! Entera y en su sitio.»',
    mejor: 'Sin pararse a medias ni volver atrás: la vuelta, de una vez.',
  },
});
/** La pala: al horno (empujar hacia el fondo) y fuera (tirar hacia ti). No cuenta para las estrellas. */
export const PALA = {
  meter: { orden: 'Mete la bandeja en el horno', ayuda: 'Empuja la pala hacia el fondo del horno.', atajo: 'Meterla en el horno' },
  sacar: { orden: 'Saca la hornada', ayuda: 'Tira de la pala hacia ti.', atajo: 'Sacarla del horno' },
};
/** 1.145: la tortilla no va al horno, va al fogón: de vuelta a la sartén (empujar) y fuera (tirar hacia ti). */
export const FOGON = {
  meter: { orden: 'Desliza la tortilla a la sartén', ayuda: 'Empuja el plato hacia la sartén: que cuaje por el otro lado.', atajo: 'A la sartén' },
  sacar: { orden: 'Saca la tortilla del fogón', ayuda: 'Tira de la sartén hacia ti.', atajo: 'Sacarla del fogón' },
};
/** La pala o el fogón, según la receta (la tortilla, al fogón). */
export const palaDe = (receta) => (recetaObrador(receta)?.fogon ? FOGON : PALA);
/** El nivel en que llega el fogón (con la tortilla). */
export const FOGON_NIVEL = 8;
/** 1.145: el pan de la bodega, de un día para otro. */
export const MASA = {
  reposa: '«Al cesto de mimbre, con su paño, y a la bodega fresca. Mañana habrá subido.»',
  esperando: 'La masa duerme en la bodega. Mañana se greña.',
  lista: 'La masa ha subido bajo su paño: ya se greña.',
  boton: 'Durmiendo en la bodega',
  recetario: '«He subido la masa de la bodega: ha crecido toda la noche.»',
};
/** 1.145: los hitos del obrador, por piezas vendidas en total (mesa y mostrador): un adorno fijo en el obrador y 20 granos cada uno. */
export const HITOS_OBRADOR = Object.freeze({
  cifras: [25, 100, 250, 500, 1000],
  granos: 20,
  adornos: ['Los cazos de cobre', 'La ristra de moldes', 'El letrero del obrador', 'La campanilla del mostrador', 'El retrato de doña Amparo'],
  frases: [
    '«Veinticinco vendidas: he colgado los cazos de cobre de la tahona. Brillan como el primer día.»',
    '«¡Cien! He encontrado la ristra de moldes de doña Amparo. Ahí, en la pared, que se vea.»',
    '«Doscientas cincuenta. Le he repintado el letrero al obrador, sobre la campana.»',
    '«¡Quinientas! La campanilla de latón, en el mostrador: sonará cada vez que se venda algo.»',
    '«Mil piezas… Doña Amparo estaría orgullosa. He colgado su retrato junto a la mesa.»',
  ],
});
/** Los hitos alcanzados con esas piezas vendidas (de 0 a 5) y lo que falta para el siguiente (null con los cinco). */
export const hitosDe = (vendidas = 0) => HITOS_OBRADOR.cifras.filter((n) => (Number(vendidas) || 0) >= n).length;
export const faltanHito = (vendidas = 0) => {
  const n = HITOS_OBRADOR.cifras.find((c) => (Number(vendidas) || 0) < c);
  return n == null ? null : n - (Number(vendidas) || 0);
};
/** La campanilla del mostrador llega con el cuarto hito. */
export const HITO_CAMPANILLA = 4;
/**
 * 1.145: el favorito de cada habitual (por su número, el orden de HABITUALES en cafeClientes.js; el mismo que `cafe_obrador_favorito`).
 * Si le toca pedir comida y su favorito está en tu recetario, lo pide por su nombre y paga +2.
 */
export const FAVORITOS = Object.freeze(['magdalenas', 'galletas', 'pan', 'empanada', 'tortilla', 'bizcocho', 'empanada', 'magdalenas', 'pan', 'bizcocho', 'tortilla', 'galletas']);
/** El acertijo del excéntrico para cada receta (lo que pide, sin nombrarla). */
export const ACERTIJOS = Object.freeze({
  magdalenas: 'Algo con copete, que guarde el sol de un limón.',
  empanada: 'Algo con el mar dentro y masa por fuera.',
  galletas: 'Algo con un ancla, un barco y una estrella, que cruja.',
  pan: 'Algo que haya dormido una noche entera en la bodega.',
  bizcocho: 'Algo esponjoso que huela al tostadero.',
  tortilla: 'Algo que haya dado una vuelta en el aire y caído de pie.',
});
/** La pista si se equivoca de pieza con el excéntrico (no se le sirve: se elige otra). */
export const PISTA_ACERTIJO = Object.freeze({
  magdalenas: '«No, no… Piensa en un limón y en un copete.»',
  empanada: '«Frío, frío. Lo que yo quiero lleva el mar dentro.»',
  galletas: '«Eso no cruje como un puerto. Busca el ancla.»',
  pan: '«Lo mío ha dormido en la bodega, querido.»',
  bizcocho: '«Huele, huele: lo mío viene del tostadero.»',
  tortilla: '«Lo mío ha dado una vuelta en el aire. Piénsalo.»',
});
/** Cómo pide su favorito un habitual, por su nombre. */
const PIDE_FAVORITO = {
  magdalenas: '¿Te quedan magdalenas?',
  empanada: '¿Te queda empanada de bonito?',
  galletas: '¿Te quedan galletas del puerto?',
  pan: '¿Me pones un poco de pan de la bodega?',
  bizcocho: '¿Te queda bizcocho del tostadero?',
  tortilla: '¿Hay tortilla hoy?',
};
/** Pilar, al acertar el acertijo o al servir el favorito. */
export const PILAR_ENCARGOS = {
  acertijo: '«¡Lo has adivinado! Paga el doble, ya verás.»',
  favorito: (nombre) => `«Su favorito: ${nombre} siempre vuelve por esto.»`,
};
/** Las piezas de la vitrina que valen para un pedido: el excéntrico las mira todas (y solo vale la de su acertijo). */
export const paraElPedido = (obrador, pedido) => {
  if (pedido?.excentrico) return RECETAS_OBRADOR.filter((r) => (obrador?.piezas?.[r.id] ?? 0) > 0).map((r) => ({ receta: r.id, piezas: obrador.piezas[r.id] }));
  const l = paraAcompanar(obrador, pedido?.tipo);
  // Su favorito, el primero
  return pedido?.quiere ? l.sort((x, y) => (y.receta === pedido.quiere) - (x.receta === pedido.quiere)) : l;
};
/** Las pinzas, en la vitrina: de la vitrina al plato. */
export const PINZAS = { orden: 'Coge una con las pinzas', ayuda: 'Toca la pieza y bájala al plato.', atajo: 'Ponerla en el plato' };

/** Lo que dice Pilar en el obrador. */
export const PILAR_OBRADOR = {
  /** En el nivel 3, una vez: la pista de lo que hay tras el tabique del ala. */
  pista: '«Detrás de esa pared huele a pan de otro tiempo. Cuando abramos el ala, ya lo verás.»',
  /** Al descubrirlo, la primera vez. */
  descubre: [
    '«Mira lo que había detrás: el horno de la tahona de doña Amparo, la que tenía el bajo cuando yo era niña.»',
    '«Su recetario seguía en la mesa. Y mira: le he hecho una hornada de magdalenas para estrenarlo. Ya están en la vitrina de la barra.»',
  ],
  cartel: 'Se abre el obrador',
  horneando: ['Ya huele…', 'Se está dorando.', 'Sube despacio.'],
  listo: '«¡La campanilla! Ya está.»',
  vitrinaLlena: '«La vitrina está llena: lo que no cabe espera calentito en la bandeja.»',
  alVitrina: (n) => (n === 1 ? '«Una más para la vitrina.»' : `«${n} más para la vitrina. Las llevo yo.»`),
  tope: '«Por hoy ya hemos horneado bastante. Mañana, más.»',
};
/** 1.144: lo de las mejoras, la especialidad, Pilar en el horno y el mostrador. */
export const PILAR_MEJORAS = {
  especialidad: (id) => `«Hoy la especialidad es ${(recetaObrador(id)?.nombre ?? 'la de la casa').toLowerCase()}: la piden más y paga un grano más.»`,
  hornea: '«Déjamelo a mí, que esta me la sé de memoria.»',
  horneaHecho: '«Al horno. Te aviso con la campanilla.»',
  horno: '«¡Qué bien suena la puerta nueva! Ahora caben más bandejas.»',
  vitrina: '«Mira cuánto sitio: ya no se nos amontona nada.»',
  caja: '«Mientras no estabas he ido vendiendo en el mostrador. Tira del cajón de la caja.»',
  cajaVacia: '«La vitrina se quedó vacía y no pude vender nada. Mañana será.»',
};
const LETRA = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce'];
/** «cuatro magdalenas», «una ración de empanada»… (con cifras desde 13). */
export const piezasEnLetra = (id, n) => {
  const [una, varias] = PIEZA[id] ?? ['pieza', 'piezas'];
  if (n === 1) return `${/^pincho/.test(una) ? 'un' : 'una'} ${una}`;
  return `${n <= 12 ? LETRA[n] : n} ${varias}`;
};
/** Lo que vendió Pilar en el mostrador ({ receta: n }), en una frase. */
export function fraseMostrador(vendidas = {}) {
  const partes = RECETAS_OBRADOR.filter((r) => (vendidas[r.id] ?? 0) > 0).map((r) => piezasEnLetra(r.id, vendidas[r.id]));
  if (!partes.length) return PILAR_MEJORAS.cajaVacia;
  const lista = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`;
  return `«Mientras no estabas se llevaron ${lista}.»`;
}
/** El cajón de la caja de latón: tirar hacia ti. */
export const CAJON = { orden: 'Tira del cajón de la caja', ayuda: 'Tira del cajón hacia abajo.', atajo: 'Abrir el cajón' };

/** El horno, sin números: lo que se ve según lo que le queda (de 0, recién metida, a 1, lista). */
export const fraseHorno = (t) => (t >= 1 ? PILAR_OBRADOR.listo : PILAR_OBRADOR.horneando[t < 0.34 ? 0 : t < 0.67 ? 1 : 2]);

/**
 * Lo que pide para acompañar, tras la bebida (sin comillas: va dentro de su frase), según el tipo y su semilla. 1.145: con un pedido
 * (`pedidoComida`) que quiere algo concreto, el acertijo del excéntrico o el favorito por su nombre.
 */
export function fraseComida(tipo, semilla = 0, pedido = null) {
  if (pedido?.excentrico && pedido.quiere) return `Y de comer… ${ACERTIJOS[pedido.quiere]}`;
  if (pedido?.quiere) return `Y… ${PIDE_FAVORITO[pedido.quiere]}`;
  const dulce = ['Y algo dulce para acompañar, si tienes.', 'Y algo dulce, que me apetece.', 'Y, si tienes, algo dulce para picar.'];
  const salado = ['Y algo salado para acompañar, si tienes.', 'Y algo salado, que vengo con hambre.', 'Y, si tienes, algo salado para picar.'];
  const l = tipo === 'salado' ? salado : dulce;
  return l[Math.abs(Math.floor(Number(semilla) || 0)) % l.length];
}
/** La línea de la comanda (1.145: el acertijo, entre comillas; el favorito, por su nombre). */
export const comandaComida = (tipo, pedido = null) =>
  pedido?.excentrico && pedido.quiere
    ? `«${ACERTIJOS[pedido.quiere]}»`
    : pedido?.quiere
      ? `${recetaObrador(pedido.quiere)?.nombre} (su favorito)`
      : tipo === 'salado'
        ? 'Algo salado para acompañar'
        : 'Algo dulce para acompañar';
/** Sin pieza del tipo que pide: no pasa nada, solo el café. */
export const sinPieza = (tipo, pedido = null) =>
  pedido?.excentrico && pedido.quiere
    ? '«¿No te queda? Qué lástima… Otro día te lo vuelvo a pedir.»'
    : `«¡Qué buena pinta! ¿No te queda nada ${tipo === 'salado' ? 'salado' : 'dulce'}? No te preocupes, otro día será.»`;
/** Lo que dice al recibirlo. */
export const GRACIAS_COMIDA = {
  magdalenas: '«¡Huele a limón! Como las de mi abuela.»',
  empanada: '«Qué jugosa. ¿Es de bonito? Está buenísima.»',
  galletas: '«¡Un faro! Me la como despacito, que da pena.»',
  pan: '«Esta corteza cruje como las de antes.»',
  bizcocho: '«Sabe un poco a café… y el ancla de azúcar, qué detalle.»',
  tortilla: '«Jugosa por dentro, como tiene que ser.»',
};
