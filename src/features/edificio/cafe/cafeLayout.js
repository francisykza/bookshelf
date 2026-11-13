// El café-librería del bajo (encargo de Francisco del 11-11-2026, plan en docs/qa/cafe-libreria.md): el plano del local, sin
// dibujo. Lo usan la escena (`cafe3d.js`) y los mandos (`Cafe.jsx`). Bloque 1 (1.119): el antiguo videoclub vacío, en
// traspaso: el escaparate a la calle y la puerta delante, el mostrador viejo a la derecha con Pilar (la dependienta, que se
// queda de camarera), cajas, sábanas y una escalera de pintor; al fondo, una cortina de terciopelo con su caballete tapa la
// parte del local que se abrirá al subir de nivel (nada industrial).
// Mundo de la app, como en las salas del hotel: x a lo ancho, y a lo hondo (de la pared del fondo, y = 0, a la del
// escaparate, y = SD), z arriba.

/** Ancho, hondo y alto del local (techo alto de bajo antiguo: cabe el altillo del nivel 4). */
export const SW = 10;
export const SD = 11;
export const SH = 5.2;
/** Ojos de quien lo recorre. */
export const EYE = 1.65;

/** El escaparate a la calle, en la pared de delante (y = SD), a la izquierda de la puerta. */
export const ESCAPARATE = { x0: 0.7, x1: 6.1, z0: 0.55, z1: 3.3 };
/** La puerta acristalada, a la derecha del escaparate. Del pomo cuelga el cartel «SE TRASPASA». */
export const PUERTA = { x0: 6.9, x1: 8.5, alto: 2.75 };
/** El cartel de cartón colgado en la puerta, de cara al local. */
export const CARTEL = { x: 7.7, z: 1.9, ancho: 1.2, alto: 0.46 };
/** El mostrador viejo, a lo largo de la derecha, y la caja registradora. */
export const MOSTRADOR = { x0: 7.3, x1: 8.0, y0: 3.9, y1: 7.5, alto: 1.05 };
/** Pilar, detrás del mostrador, mirando al local (hacia −x). */
export const PILAR = { x: 8.75, y: 5.6 };
/** La cortina de obra: de la pared izquierda al mostrador, a esta profundidad; detrás, el resto del local (niveles 2 a 5). */
export const CORTINA = { y: 3.5, x0: 0, x1: SW, alto: 3.9 };
/** El caballete de delante de la cortina, con su lámina en blanco. */
export const CABALLETE = { x: 3.6, y: 4.05 };
/** La bombilla desnuda que cuelga del techo y la lamparita del mostrador. */
export const BOMBILLA = { x: 4.0, y: 7.2, z: 3.7 };
export const LAMPARITA = { x: 7.65, y: 6.9, z: 1.05 };
/**
 * Bloque 4a (1.122): al subir al nivel 2 se recogen las cortinas y se abre el fondo del local, con un ventanal al puerto
 * en la pared del fondo; en el nivel 3, estanterías hasta el techo en la pared izquierda del fondo y la chimenea encendida
 * a la derecha. Nada de esto se mueve ni se decora: es el local.
 */
export const VENTANAL = { x0: 1.3, x1: 6.3, z0: 0.85, z1: 3.7 };
export const CHIMENEA = { x0: 7.5, x1: 9.2, hondo: 0.6, alto: 1.4 };
export const ALTAS = { y0: 0.45, y1: 3.35, fondo: 0.46 };
/**
 * Bloque 4b (1.123): en el nivel 4 se abre la pared de la izquierda (quedan dos pilares en los extremos y una viga) y el ala
 * lateral llega hasta x = −3,4; la pared, con las estanterías altas y la vieja, se va al fondo del ala. En el nivel 5, la
 * acera de la terraza, delante del escaparate (se sale por la puerta).
 */
export const ALA = { x0: -3.4, x1: 0, pilar: 0.35 };
export const ACERA = { x0: 0.4, x1: 9.0, y0: SD + 0.35, y1: SD + 3.9 };
/** La pared de la izquierda, donde esté: en x = 0 hasta el nivel 3; al fondo del ala desde el 4. */
export const paredIzquierda = (nivel = 1) => (nivel >= 4 ? ALA.x0 : 0);
/**
 * Bloque 6a (1.125): la bodega del sótano (nivel 6). Se baja por la trampilla de detrás de la barra (al fondo del pasillo de
 * Pilar). En el mundo va aparte, lejos del local (x desde 39,4), con el suelo en z = 0 como el café: así se anda, se toca y
 * se decora igual. Bóveda de ladrillo, barricas tumbadas en la pared izquierda, un botellero al fondo y la escalera a la
 * derecha, que sube hasta el hueco de la trampilla.
 */
export const BODEGA = { x0: 39.4, x1: 47.6, y0: -0.6, y1: 7.0, alto: 3.4 };
export const TRAMPILLA = { x0: 8.4, x1: 9.5, y0: 1.4, y1: 2.8 };
export const ESCALERA_BODEGA = { x0: 46.2, x1: 47.5, y0: 2.6, y1: BODEGA.y1 };
/** Al pie de la escalera de la bodega, mirando a la sala. */
export const LLEGADA_BODEGA = { x: 46.8, y: 1.9, yaw: Math.atan2(42.5 - 46.8, 3.0 - 1.9) };
/** Junto a la trampilla, en el café, mirando al local (al subir). */
export const ANTE_TRAMPILLA = { x: 7.8, y: 2.1, yaw: Math.atan2(4.0 - 7.8, 6.0 - 2.1) };
/**
 * Bloque 6b (1.127): en el nivel 7 la bodega crece por la izquierda (dos columnas más de cuadrícula) y, contra esa pared, el
 * tostador: el tambor de hierro con su trampilla y su asa, la tolva, la chimenea y el enfriador redondo delante. Las barricas
 * se corren al fondo de la misma pared.
 */
export const BODEGA_TOSTADERO = { ...BODEGA, x0: 35.8 };
/**
 * Bloque 6c (1.129): en el nivel 8, la sala de catas. La bodega crece por la derecha (dos columnas más de cuadrícula, donde
 * estaba la escalera, que se corre a la pared nueva) y hacia delante (una fila más). Contra el fondo, el mostrador de catas.
 */
export const BODEGA_CATAS = { ...BODEGA_TOSTADERO, x1: 49.6, y1: 7.6 };
export const ESCALERA_CATAS = { x0: 48.2, x1: 49.5, y0: 3.2, y1: BODEGA_CATAS.y1 };
export const LLEGADA_CATAS = { x: 48.8, y: 2.5, yaw: Math.atan2(44.5 - 48.8, 3.4 - 2.5) };
export const bodegaDe = (nivel = 6) => (nivel >= 8 ? BODEGA_CATAS : nivel >= 7 ? BODEGA_TOSTADERO : BODEGA);
/** La escalera de la bodega y dónde se llega al bajar, según el nivel (en el 8, en la pared nueva). */
export const escaleraDe = (nivel = 6) => (nivel >= 8 ? ESCALERA_CATAS : ESCALERA_BODEGA);
export const llegadaDe = (nivel = 6) => (nivel >= 8 ? LLEGADA_CATAS : LLEGADA_BODEGA);
/** Lo que ocupa el tostador con su enfriador (por aquí no se anda) y la trampilla del tambor, de cara a la sala. */
export const TOSTADOR = { x0: 35.8, x1: 38.25, y0: 0.45, y1: 2.95 };
export const TAMBOR = { x: 37.1, y: 1.4, z: 1.0, r: 0.42 };
export const ENFRIADOR = { x: 37.65, y: 1.45, z: 0.62, r: 0.5 };
/** Delante del tostador, mirando a la trampilla del tambor. */
export const ANTE_TOSTADOR = { x: 39.15, y: 1.75, yaw: Math.atan2(37.1 - 39.15, 1.5 - 1.75) };
/** La planta de un punto del mundo (la bodega, aparte, desde x = 30). */
export const plantaEn = (x) => (x >= 30 ? 'bodega' : 'calle');

/** La estantería vieja, vacía, en la pared izquierda. */
export const ESTANTERIA = { y0: 5.0, y1: 8.6, fondo: 0.42, alto: 2.4 };

/** Bultos y cajas (cajas del mundo [x0, y0, z0, x1, y1, z1]): por aquí no se anda. */
export const SABANAS = [
  [1.0, 4.4, 0, 2.6, 5.4, 0.86],
  [4.6, 4.3, 0, 5.6, 5.1, 1.1],
];
export const CAJAS = [
  [0.6, 9.3, 0, 1.4, 10.0, 0.6],
  [0.7, 9.4, 0.6, 1.3, 9.95, 1.05],
  [1.5, 9.5, 0, 2.2, 10.1, 0.5],
  [4.4, 6.2, 0, 5.2, 6.9, 0.55],
];
/** La escalera de pintor, abierta (sus dos patas van a lo hondo). */
export const ESCALERA = { x: 1.5, y: 6.7 };
const ESCALERA_CAJA = [ESCALERA.x - 0.3, ESCALERA.y - 0.45, 0, ESCALERA.x + 0.3, ESCALERA.y + 0.45, 1.9];

/** Dónde se empieza: recién entrado por la puerta, con el local delante (mirando al fondo). */
export const INICIO = { x: 7.0, y: 9.9, yaw: Math.PI + 0.32 };
/** Con el café ya abierto (1.120), se entra mirando en diagonal a todo el rincón, con la barra a la derecha. */
export const INICIO_ABIERTO = { x: 6.9, y: 10.2, yaw: Math.PI + 0.78 };
/** Delante del mostrador, frente a Pilar. */
export const ANTE_PILAR = { x: 6.5, y: 5.6 };
/** La caja de reparto de la distribuidora (§121.3): en el suelo, al final del mostrador, cuando hay libros por colocar. */
export const CAJA_LIBROS = { x0: 7.35, y0: 7.95, x1: 8.0, y1: 8.5, alto: 0.5 };

/**
 * Lo que se toca: su caja en el mundo (para el toque y su letrero), dónde va su letrero y adónde se va y se mira al llegar.
 */
/** El sitio de la escalera que sube al café (su caja, su letrero y adónde se va). */
const subirPor = (E, ir) => ({
  nombre: 'Subir al café',
  planta: 'bodega',
  nivel: 6,
  box: [E.x0, E.y0, 0, E.x1, E.y0 + 2.2, 1.7],
  tag: [(E.x0 + E.x1) / 2, E.y0 + 0.9, 1.75],
  ir,
  mira: [(E.x0 + E.x1) / 2 + 0.0, E.y0 + 2.4],
});
export const SITIOS = {
  // Bloque 6a: la trampilla (en el café, desde el nivel 6) y la escalera de la bodega. Los demás sitios son del café
  trampilla: {
    nombre: 'Bajar a la bodega',
    planta: 'calle',
    nivel: 6,
    box: [TRAMPILLA.x0, TRAMPILLA.y0, 0, TRAMPILLA.x1, TRAMPILLA.y1, 1.0],
    tag: [(TRAMPILLA.x0 + TRAMPILLA.x1) / 2, (TRAMPILLA.y0 + TRAMPILLA.y1) / 2, 1.25],
    ir: ANTE_TRAMPILLA,
    mira: [9.0, 2.1],
  },
  subir: subirPor(ESCALERA_BODEGA, LLEGADA_BODEGA),
  // Bloque 6b: el tostador (en la bodega, desde el nivel 7)
  tostador: {
    nombre: 'El tostador',
    planta: 'bodega',
    nivel: 7,
    box: [TOSTADOR.x0 + 0.1, TOSTADOR.y0 + 0.2, 0, TOSTADOR.x1, TOSTADOR.y1, 2.0],
    tag: [TAMBOR.x, TAMBOR.y + 0.3, 2.15],
    ir: ANTE_TOSTADOR,
    mira: [TAMBOR.x, TAMBOR.y + 0.1],
  },
  pilar: { nombre: 'Pilar', box: [PILAR.x - 0.5, PILAR.y - 0.5, 0.9, PILAR.x + 0.5, PILAR.y + 0.5, 2.2], tag: [PILAR.x, PILAR.y, 2.35], ir: ANTE_PILAR, mira: [PILAR.x, PILAR.y] },
  cortina: { nombre: 'El resto del local', box: [0.2, CORTINA.y - 0.1, 0, 7.2, CORTINA.y + 0.15, CORTINA.alto], tag: [CABALLETE.x, CORTINA.y, 2.6], ir: { x: 3.6, y: 6.2 }, mira: [3.6, 0] },
  escaparate: {
    nombre: 'El escaparate',
    box: [ESCAPARATE.x0, SD - 0.12, ESCAPARATE.z0, ESCAPARATE.x1, SD, ESCAPARATE.z1],
    tag: [(ESCAPARATE.x0 + ESCAPARATE.x1) / 2, SD - 0.1, ESCAPARATE.z1 + 0.15],
    ir: { x: 3.4, y: 8.6 },
    mira: [3.4, SD],
  },
  // Solo se ve (y se toca) con libros esperando en la caja
  libros: {
    nombre: 'Caja de libros',
    box: [CAJA_LIBROS.x0, CAJA_LIBROS.y0, 0, CAJA_LIBROS.x1, CAJA_LIBROS.y1, CAJA_LIBROS.alto + 0.1],
    tag: [(CAJA_LIBROS.x0 + CAJA_LIBROS.x1) / 2, (CAJA_LIBROS.y0 + CAJA_LIBROS.y1) / 2, CAJA_LIBROS.alto + 0.25],
    ir: { x: 5.3, y: 10.2 },
    mira: [(CAJA_LIBROS.x0 + CAJA_LIBROS.x1) / 2, (CAJA_LIBROS.y0 + CAJA_LIBROS.y1) / 2],
  },
};

/**
 * Bloque 2 (1.120): la cuadrícula que se decora, delante de la cortina, en casillas de una unidad: de la pared izquierda
 * (pasada la estantería vieja) al pasillo del mostrador, y de la cortina (pasado el caballete) al escaparate.
 */
export const CUADRO = { x0: 0.6, y0: 4.45, celda: 1 };
/** Bloque 6c: en el nivel 8 la escalera sube por la pared nueva. Un sitio, según el nivel. */
export const SUBIR_CATAS = subirPor(ESCALERA_CATAS, LLEGADA_CATAS);
export const sitioDe = (id, nivel = 1) => (id === 'subir' && nivel >= 8 ? SUBIR_CATAS : SITIOS[id]);
/** Bloque 6a: la cuadrícula de la bodega (filas 20 a 24 del plano, `SOTANO` en cafeCatalogo.js), pasadas las barricas. */
export const CUADRO_BODEGA = { x0: 40.7, y0: 0.7, fila: 20 };
/** Esquina de una casilla en el mundo (las filas desde la 20 son de la bodega). */
export const enMundo = (cx, cy) =>
  cy >= CUADRO_BODEGA.fila
    ? { x: CUADRO_BODEGA.x0 + cx * CUADRO.celda, y: CUADRO_BODEGA.y0 + (cy - CUADRO_BODEGA.fila) * CUADRO.celda }
    : { x: CUADRO.x0 + cx * CUADRO.celda, y: CUADRO.y0 + cy * CUADRO.celda };
/** La casilla bajo un punto del mundo (puede caer fuera de la cuadrícula). */
export const enCasilla = (x, y) =>
  plantaEn(x) === 'bodega'
    ? { x: Math.floor((x - CUADRO_BODEGA.x0) / CUADRO.celda), y: CUADRO_BODEGA.fila + Math.floor((y - CUADRO_BODEGA.y0) / CUADRO.celda) }
    : { x: Math.floor((x - CUADRO.x0) / CUADRO.celda), y: Math.floor((y - CUADRO.y0) / CUADRO.celda) };

const HOLGURA = 0.35;
const choca = (x, y, [x0, y0, , x1, y1], h = HOLGURA) => x > x0 - h && x < x1 + h && y > y0 - h && y < y1 + h;
/**
 * Si se puede estar en (x, y): dentro del local abierto (delante de la cortina; desde el nivel 2, hasta el fondo), sin
 * atravesar el mostrador ni los bultos.
 * `limpio`: el local ya inaugurado (sin cajas, sábanas ni escalera); `muebles`: cajas del mundo de lo colocado.
 */
export function dentro(x, y, { limpio = false, muebles = [], nivel = 1, planta = 'calle' } = {}) {
  // Bloque 6a: en la bodega, entre las barricas, el botellero y la pared de delante, sin pisar la escalera
  if (planta === 'bodega') {
    const B = bodegaDe(nivel);
    if (x < B.x0 + 1.1 || x > B.x1 - 0.5 || y < B.y0 + 0.75 || y > B.y1 - 0.5) return false;
    // Bloque 6b: el tostador y su enfriador
    if (nivel >= 7 && x < TOSTADOR.x1 + HOLGURA && y < TOSTADOR.y1 + HOLGURA) return false;
    const E = escaleraDe(nivel);
    if (x > E.x0 - HOLGURA && y > E.y0 - 0.15) return false;
    return !muebles.some((b) => choca(x, y, b, 0.22));
  }
  if (x > 30) return false;
  // El hueco abierto de la trampilla (nivel 6)
  if (nivel >= 6 && x > TRAMPILLA.x0 - 0.2 && y > TRAMPILLA.y0 - 0.2 && y < TRAMPILLA.y1 + 0.2) return false;
  // Nivel 5: la acera de la terraza; entre dentro y fuera, solo por la puerta
  if (nivel >= 5 && y > SD - 0.5) {
    if (y < ACERA.y0) {
      if (x < PUERTA.x0 + 0.3 || x > PUERTA.x1 - 0.3) return false;
    } else if (x < ACERA.x0 || x > ACERA.x1 || y > ACERA.y1) return false;
    return !muebles.some((b) => choca(x, y, b, 0.22));
  }
  const pared = paredIzquierda(nivel);
  if (x < pared + 0.5 || x > SW - 0.5 || y < (nivel >= 2 ? 0.5 : CORTINA.y + 0.45) || y > SD - 0.5) return false;
  // Nivel 4: los dos pilares que quedan de la pared, en los extremos
  if (nivel >= 4 && Math.abs(x) < 0.2 + HOLGURA && (y < ALA.pilar + HOLGURA || y > SD - ALA.pilar - HOLGURA)) return false;
  // Nivel 3: la chimenea y las estanterías altas del fondo (desde el 4, en la pared del ala)
  if (nivel >= 3 && x > CHIMENEA.x0 - HOLGURA && x < CHIMENEA.x1 + HOLGURA && y < CHIMENEA.hondo + 0.35 + HOLGURA) return false;
  if (nivel >= 3 && x < pared + ALTAS.fondo + HOLGURA && y < ALTAS.y1 + HOLGURA) return false;
  if (x > MOSTRADOR.x0 - HOLGURA && y > MOSTRADOR.y0 - HOLGURA && y < MOSTRADOR.y1 + HOLGURA) return false;
  if (x < pared + ESTANTERIA.fondo + HOLGURA && y > ESTANTERIA.y0 && y < ESTANTERIA.y1) return false;
  if (muebles.some((b) => choca(x, y, b, 0.22))) return false;
  return limpio || ![...SABANAS, ...CAJAS, ESCALERA_CAJA].some((b) => choca(x, y, b));
}

/** El punto libre más cercano a (x, y) en el camino desde (fx, fy): se anda en línea recta y se para antes de chocar. */
export function hastaDonde(fx, fy, x, y, opciones = {}) {
  const d = Math.hypot(x - fx, y - fy);
  const pasos = Math.max(1, Math.ceil(d / 0.1));
  let ok = { x: fx, y: fy };
  for (let k = 1; k <= pasos; k += 1) {
    const t = k / pasos;
    const px = fx + (x - fx) * t;
    const py = fy + (y - fy) * t;
    if (!dentro(px, py, opciones)) break;
    ok = { x: px, y: py };
  }
  return ok;
}

/** Pilar (la dependienta del antiguo videoclub): el mismo aire que en la tienda (melena, gafas, jersey mostaza, delantal). */
export const PILAR_ASPECTO = { piel: 1, pelo: 'melena', colorPelo: 1, jersey: 2, pantalon: 4, gafas: true, complemento: 'ninguno' };
