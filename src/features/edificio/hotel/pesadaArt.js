// La pesada de Remedios, dibujada (1.84): la mesa de la lonjera de cerca, de frente y en píxeles, con su balanza de latón, el
// gato encima y las cajas del encargo. Se pinta en un lienzo pequeño que se amplía sin suavizar. El fondo se calcula una vez,
// con la luz del farol en tramado, y solo se mueven la cruz, los platillos, las cajas y el gato. Con movimiento reducido, cada
// cosa va directa a su sitio y no hay bucle.

export const PESADA_W = 200;
export const PESADA_H = 138;
const CAJA_W = 20;
const CAJA_H = 16;
const PIVOTE = { x: 100, y: 30 };
const BRAZO = 64;
const PLATO_Y = 84;
const CAIDA = 10;
const MESA_Y = 116;
const PASO_MESA = 21;

/** Lo que trae cada encargo. */
export const GENEROS = [
  { id: 'sardinas', nombre: 'Sardinas' },
  { id: 'naranjas', nombre: 'Naranjas' },
  { id: 'libros', nombre: 'Libros' },
];

const LETRAS = {
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '..#..', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
};

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const azar = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function lienzo(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

const rect = (g, color, x, y, w, h) => {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), w, h);
};

function letra(g, ch, x, y, color) {
  const filas = LETRAS[ch];
  if (!filas) return;
  g.fillStyle = color;
  filas.forEach((fila, j) => [...fila].forEach((b, i) => b === '#' && g.fillRect(x + i, y + j, 1, 1)));
}

/** Pared de ladrillo, ventana de noche, baldas y mostrador, con la luz del farol en cuatro niveles de tramado. */
function pintarFondo() {
  const [c, g] = lienzo(PESADA_W, PESADA_H);
  // Ladrillo
  for (let y = 0; y < MESA_Y; y += 1) {
    const fila = Math.floor(y / 6);
    for (let x = 0; x < PESADA_W; x += 1) {
      const col = Math.floor((x + (fila % 2) * 7) / 14);
      const junta = y % 6 === 5 || (x + (fila % 2) * 7) % 14 === 13;
      const tono = azar(col, fila);
      rect(g, junta ? '#3a2019' : tono > 0.66 ? '#8a4632' : tono > 0.33 ? '#7a3c2b' : '#6c3425', x, y, 1, 1);
    }
  }
  // Ventana con la noche del puerto
  rect(g, '#2a1a12', 10, 12, 36, 42);
  rect(g, '#121c44', 13, 15, 30, 36);
  rect(g, '#1c2a5c', 13, 33, 30, 18);
  rect(g, '#3a2418', 13, 44, 30, 7);
  [
    [17, 19],
    [24, 24],
    [36, 18],
    [39, 29],
    [20, 30],
  ].forEach(([x, y]) => rect(g, '#d8d4b0', x, y, 1, 1));
  rect(g, '#e8dca0', 31, 21, 5, 5);
  rect(g, '#121c44', 33, 20, 4, 5);
  rect(g, '#2a1a12', 27, 15, 2, 36);
  rect(g, '#2a1a12', 13, 32, 30, 2);
  rect(g, '#5a3a22', 8, 54, 40, 3);
  // Balda con tarros y un manojo de sacos
  rect(g, '#4a2c1a', 150, 42, 50, 3);
  rect(g, '#2a1a12', 150, 45, 50, 1);
  [
    [156, '#7ca088', 11],
    [165, '#c89048', 9],
    [173, '#8a5a7a', 12],
    [183, '#7ca088', 8],
    [191, '#b8b098', 10],
  ].forEach(([x, color, h]) => {
    rect(g, color, x, 42 - h, 6, h);
    rect(g, '#e8dcc0', x + 1, 42 - h + 2, 1, h - 4);
    rect(g, '#3a2418', x + 1, 41 - h, 4, 1);
  });
  // Mostrador
  rect(g, '#a8743f', 0, MESA_Y, PESADA_W, 8);
  rect(g, '#c8945a', 0, MESA_Y, PESADA_W, 1);
  for (let x = 0; x < PESADA_W; x += 1) {
    if (azar(x, 3) > 0.82) rect(g, '#946232', x, MESA_Y + 2 + Math.floor(azar(x, 9) * 5), 3, 1);
  }
  rect(g, '#6e4424', 0, MESA_Y + 8, PESADA_W, PESADA_H - MESA_Y - 8);
  rect(g, '#3a2214', 0, MESA_Y + 8, PESADA_W, 1);
  for (let x = 12; x < PESADA_W; x += 25) rect(g, '#4e2e18', x, MESA_Y + 9, 1, PESADA_H - MESA_Y - 9);
  for (let y = MESA_Y + 14; y < PESADA_H; y += 9) {
    for (let x = 0; x < PESADA_W; x += 1) if (azar(x, y) > 0.7) rect(g, '#7c5230', x, y, 2, 1);
  }
  // La luz: se oscurece lejos del farol, por escalones de tramado
  const datos = g.getImageData(0, 0, PESADA_W, PESADA_H);
  for (let y = 0; y < PESADA_H; y += 1) {
    for (let x = 0; x < PESADA_W; x += 1) {
      const d = Math.hypot((x - 100) / 1.3, (y - 56) / 1.2) / 104;
      const nivel = Math.min(1, Math.max(0, d)) * 4 + (BAYER[y % 4][x % 4] / 16 - 0.5) * 0.9;
      const luz = [1.12, 1, 0.78, 0.6, 0.46][Math.max(0, Math.min(4, Math.round(nivel)))];
      const k = (y * PESADA_W + x) * 4;
      datos.data[k] = Math.min(255, datos.data[k] * luz);
      datos.data[k + 1] = Math.min(255, datos.data[k + 1] * luz * (luz > 1 ? 1 : 0.94));
      datos.data[k + 2] = Math.min(255, datos.data[k + 2] * luz * (luz > 1 ? 0.92 : 0.98));
    }
  }
  g.putImageData(datos, 0, 0);
  // Farol colgado, por encima de la luz
  rect(g, '#1e120c', 134, 0, 1, 8);
  rect(g, '#2a1a12', 130, 8, 9, 2);
  rect(g, '#ffd98a', 131, 10, 7, 9);
  rect(g, '#fff4c4', 133, 12, 3, 5);
  rect(g, '#2a1a12', 130, 10, 1, 9);
  rect(g, '#2a1a12', 138, 10, 1, 9);
  rect(g, '#2a1a12', 130, 19, 9, 2);
  // El pie de la balanza
  rect(g, '#6e4a1c', 88, MESA_Y + 2, 24, 3);
  rect(g, '#b8862e', 90, MESA_Y - 1, 20, 3);
  rect(g, '#e8b85a', 90, MESA_Y - 1, 20, 1);
  rect(g, '#b8862e', 97, PIVOTE.y, 6, MESA_Y - PIVOTE.y);
  rect(g, '#f0cc78', 98, PIVOTE.y, 1, MESA_Y - PIVOTE.y);
  rect(g, '#7a5420', 102, PIVOTE.y, 1, MESA_Y - PIVOTE.y);
  [56, 80, 102].forEach((y) => {
    rect(g, '#7a5420', 95, y + 1, 10, 1);
    rect(g, '#e8b85a', 95, y, 10, 1);
  });
  return c;
}

function genero(g, id, n) {
  if (id === 'sardinas') {
    for (let k = 0; k < 3; k += 1) {
      const x = 2 + k * 5;
      rect(g, '#a8b8c4', x, 1, 4, 3);
      rect(g, '#dce8ee', x + 1, 1, 2, 1);
      rect(g, '#3a4a58', x + 1, 2, 1, 1);
    }
  } else if (id === 'naranjas') {
    for (let k = 0; k < 3; k += 1) {
      const x = 1 + k * 5 + (n % 2);
      rect(g, '#e88a2a', x + 1, 0, 3, 5);
      rect(g, '#e88a2a', x, 1, 5, 3);
      rect(g, '#ffc070', x + 1, 1, 1, 1);
      rect(g, '#b85e14', x + 3, 3, 1, 1);
    }
  } else {
    ['#a8283a', '#2c6a8a', '#e8b85a', '#3c7a4e', '#8a5a9a'].forEach((color, k) => {
      const alto = 3 + ((n + k) % 2);
      rect(g, color, 2 + k * 3, 4 - alto + 1, 3, alto);
      rect(g, '#00000040', 4 + k * 3, 5 - alto, 1, alto);
    });
  }
}

/** Una caja de madera con su género asomando y su número en una etiqueta. Lo de arriba son 4 píxeles de género. */
function pintarCaja(id, n) {
  const [c, g] = lienzo(CAJA_W, CAJA_H + 4);
  rect(g, '#2a160c', 1, 3, CAJA_W - 2, 2);
  g.translate(1, 0);
  genero(g, id, n);
  g.translate(-1, 0);
  const y = 4;
  rect(g, '#2a160c', 0, y, CAJA_W, CAJA_H);
  [0, 1, 2].forEach((k) => {
    rect(g, k === 1 ? '#b98a54' : '#c89a62', 1, y + 1 + k * 5, CAJA_W - 2, 4);
    rect(g, '#dcb27c', 1, y + 1 + k * 5, CAJA_W - 2, 1);
    rect(g, '#8e6236', 1 + ((n * 5 + k * 7) % 13), y + 3 + k * 5, 4, 1);
  });
  rect(g, '#8e6236', 1, y + 1, 2, CAJA_H - 2);
  rect(g, '#8e6236', CAJA_W - 3, y + 1, 2, CAJA_H - 2);
  rect(g, '#2a160c', 4, y + 2, 12, 12);
  rect(g, '#f8ecd0', 5, y + 3, 10, 10);
  letra(g, String(n), 8, y + 4, '#2a160c');
  return c;
}

/** El gato de la lonja, sentado sobre el pivote; mira al platillo que baja y mueve la cola. */
function gato(g, x, y, mira, cola, parpadea) {
  const pelo = '#3a3038';
  const claro = '#54485a';
  rect(g, pelo, x - 5, y - 8, 10, 8);
  rect(g, claro, x - 4, y - 8, 8, 1);
  rect(g, pelo, x - 5, y - 15, 10, 8);
  rect(g, pelo, x - 5, y - 17, 2, 2);
  rect(g, pelo, x + 3, y - 17, 2, 2);
  rect(g, '#e8a0a0', x - 4, y - 16, 1, 1);
  rect(g, '#e8a0a0', x + 4, y - 16, 1, 1);
  rect(g, '#f0e4d0', x - 2, y - 10, 4, 2);
  if (parpadea) {
    rect(g, '#1a1418', x - 3, y - 12, 2, 1);
    rect(g, '#1a1418', x + 1, y - 12, 2, 1);
  } else {
    rect(g, '#e8d05a', x - 3, y - 13, 2, 2);
    rect(g, '#e8d05a', x + 1, y - 13, 2, 2);
    rect(g, '#1a1418', x - 3 + (mira > 0 ? 1 : 0), y - 13, 1, 2);
    rect(g, '#1a1418', x + 1 + (mira > 0 ? 1 : 0), y - 13, 1, 2);
  }
  rect(g, '#e88a8a', x, y - 11, 1, 1);
  const lado = cola ? 1 : -1;
  rect(g, pelo, x + lado * 5 + (lado < 0 ? -2 : 0), y - 3, 3, 2);
  rect(g, pelo, x + lado * 7 + (lado < 0 ? -1 : 0), y - 7, 2, 5);
}

function cruz(g, t) {
  const caida = t * CAIDA;
  for (let i = -BRAZO; i <= BRAZO; i += 1) {
    const x = PIVOTE.x + i;
    const y = Math.round(PIVOTE.y + (i / BRAZO) * caida);
    rect(g, '#2a160c', x, y - 2, 1, 5);
    rect(g, '#f0cc78', x, y - 1, 1, 1);
    rect(g, '#c8963a', x, y, 1, 1);
    rect(g, '#8a6024', x, y + 1, 1, 1);
  }
  [-BRAZO, BRAZO].forEach((i) => {
    const y = Math.round(PIVOTE.y + (i / BRAZO) * caida);
    rect(g, '#2a160c', PIVOTE.x + i - 3, y - 3, 7, 7);
    rect(g, '#e8b85a', PIVOTE.x + i - 2, y - 2, 5, 5);
    rect(g, '#fff0b8', PIVOTE.x + i - 1, y - 1, 2, 1);
  });
  rect(g, '#2a160c', PIVOTE.x - 5, PIVOTE.y - 3, 10, 8);
  rect(g, '#e8b85a', PIVOTE.x - 4, PIVOTE.y - 2, 8, 6);
  rect(g, '#fff0b8', PIVOTE.x - 3, PIVOTE.y - 1, 4, 1);
}

const platoY = (lado, t) => PLATO_Y + (lado === 'izq' ? -t : t) * CAIDA;
const platoX = (lado) => PIVOTE.x + (lado === 'izq' ? -BRAZO : BRAZO);

function cadena(g, x0, y0, x1, y1) {
  const pasos = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let k = 0; k <= pasos; k += 1) {
    const x = x0 + ((x1 - x0) * k) / pasos;
    const y = y0 + ((y1 - y0) * k) / pasos;
    rect(g, k % 3 === 0 ? '#f0cc78' : '#8a6024', x, y, 1, 1);
  }
}

function plato(g, lado, t) {
  const x = platoX(lado);
  const y = Math.round(platoY(lado, t));
  const arriba = Math.round(PIVOTE.y + ((lado === 'izq' ? -BRAZO : BRAZO) / BRAZO) * t * CAIDA);
  cadena(g, x, arriba + 2, x - 23, y);
  cadena(g, x, arriba + 2, x + 23, y);
  rect(g, '#2a160c', x - 25, y, 50, 2);
  rect(g, '#f0cc78', x - 24, y, 48, 1);
  rect(g, '#2a160c', x - 23, y + 2, 46, 2);
  rect(g, '#c8963a', x - 22, y + 2, 44, 1);
  rect(g, '#2a160c', x - 18, y + 4, 36, 2);
  rect(g, '#8a6024', x - 17, y + 4, 34, 1);
}

/** Dónde va una caja. `sitio` = { lugar: 'mesa' | 'izq' | 'der', k }; `t`, la inclinación de la balanza. */
function destino(sitio, n, total, t) {
  if (sitio.lugar === 'mesa') return { x: PIVOTE.x + (n - 1 - (total - 1) / 2) * PASO_MESA - CAJA_W / 2, y: MESA_Y + 8 - CAJA_H };
  const fila = Math.floor(sitio.k / 2);
  return { x: platoX(sitio.lugar) - 21 + (sitio.k % 2) * 22, y: platoY(sitio.lugar, t) - CAJA_H - fila * (CAJA_H + 1) };
}

/** Recuadro de cada caja en tanto por uno, para poner encima sus botones. */
export function huecoCaja(sitio, n, total, t) {
  const { x, y } = destino(sitio, n, total, t);
  return { left: (x - 1) / PESADA_W, top: (y - 4) / PESADA_H, width: (CAJA_W + 2) / PESADA_W, height: (CAJA_H + 5) / PESADA_H };
}

/** Descartada: la caja se apaga y Remedios la cruza con una raya de tiza, sin taparle el número. */
function tachar(g, x, y) {
  rect(g, 'rgb(24 12 8 / 0.5)', x, y - 4, CAJA_W, CAJA_H + 4);
  for (let k = 0; k < CAJA_W - 2; k += 1) {
    if (k % 5 !== 4) rect(g, '#f4f0e0', x + 1 + k, y + CAJA_H - 2 - Math.round((k * (CAJA_H - 3)) / (CAJA_W - 3)), 1, 1);
  }
}

/** La caja abierta: si pesaba de más, dentro estaba el gatito; si pesaba de menos, solo quedan las raspas. */
function abierta(g, x, y, pesaMas) {
  if (pesaMas) {
    const c = x + 4;
    rect(g, '#2a160c', c - 1, y - 12, 14, 13);
    rect(g, '#e8a040', c, y - 11, 12, 11);
    rect(g, '#2a160c', c - 1, y - 15, 4, 4);
    rect(g, '#2a160c', c + 9, y - 15, 4, 4);
    rect(g, '#e8a040', c, y - 14, 2, 3);
    rect(g, '#e8a040', c + 10, y - 14, 2, 3);
    rect(g, '#c87a24', c + 4, y - 11, 1, 3);
    rect(g, '#c87a24', c + 7, y - 11, 1, 3);
    rect(g, '#2a160c', c + 2, y - 7, 2, 2);
    rect(g, '#2a160c', c + 8, y - 7, 2, 2);
    rect(g, '#f8ecd0', c + 4, y - 4, 4, 3);
    rect(g, '#e88a8a', c + 5, y - 4, 2, 1);
    rect(g, '#f8ecd0', c + 1, y, 3, 2);
    rect(g, '#f8ecd0', c + 8, y, 3, 2);
  } else {
    const c = x + 2;
    rect(g, '#2a160c', c - 1, y - 9, 18, 9);
    rect(g, '#f0ecdc', c, y - 5, 15, 1);
    [4, 7, 10].forEach((i) => rect(g, '#f0ecdc', c + i, y - 8, 1, 7));
    rect(g, '#f0ecdc', c + 12, y - 8, 3, 7);
    rect(g, '#2a160c', c + 13, y - 7, 1, 1);
    rect(g, '#f0ecdc', c, y - 7, 2, 2);
    rect(g, '#f0ecdc', c, y - 4, 2, 2);
  }
}

function resalte(g, x, y) {
  rect(g, '#ffe39a', x - 2, y - 2, CAJA_W + 4, 1);
  rect(g, '#ffe39a', x - 2, y + CAJA_H + 1, CAJA_W + 4, 1);
  rect(g, '#ffe39a', x - 2, y - 2, 1, CAJA_H + 4);
  rect(g, '#ffe39a', x + CAJA_W + 1, y - 2, 1, CAJA_H + 4);
}

const SELLO_W = 82;
const SELLO_H = 46;

/** El albarán que Remedios sella: papel de estraza con el sello rojo encima, para que se lea sobre el ladrillo. */
function pintarSello(valor) {
  const [c, g] = lienzo(SELLO_W, SELLO_H);
  const rojo = '#b8202e';
  rect(g, '#2a160c', 0, 0, SELLO_W, SELLO_H);
  rect(g, '#f2dfb4', 1, 1, SELLO_W - 2, SELLO_H - 2);
  for (let x = 2; x < SELLO_W - 2; x += 1) {
    if (azar(x, 5) > 0.6) rect(g, '#e4c690', x, 2 + Math.floor(azar(x, 8) * (SELLO_H - 5)), 2, 1);
  }
  [
    [6, 6, SELLO_W - 12, 2],
    [6, SELLO_H - 8, SELLO_W - 12, 2],
    [6, 6, 2, SELLO_H - 12],
    [SELLO_W - 8, 6, 2, SELLO_H - 12],
  ].forEach(([x, y, w, h]) => rect(g, rojo, x, y, w, h));
  [...'SELLADO'].forEach((ch, k) => letra(g, ch, 17 + k * 7, 12, rojo));
  ['+', String(valor)].forEach((ch, k) => letra(g, ch, 34 + k * 8, 25, rojo));
  // El sello no entinta igual en todas partes
  for (let y = 6; y < SELLO_H - 6; y += 1) {
    for (let x = 6; x < SELLO_W - 6; x += 1) if (azar(x, y) > 0.98) rect(g, '#f2dfb4', x, y, 1, 1);
  }
  return c;
}

/**
 * Pone la escena en `canvas` y devuelve { poner, destruir }. `poner(estado)` recibe lo que debe verse: { genero, total,
 * sitios: { n: {lugar, k} }, t (-1 baja la izquierda, 1 la derecha), tachadas, elegida, abierta: { caja, pesaMas }, sello }.
 * `alAsentar` avisa cuando la balanza deja de moverse tras una pesada.
 */
export function crearPesada(canvas, { reducido = false, alAsentar = () => {} } = {}) {
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const fondo = pintarFondo();
  const cajas = new Map();
  const sprites = new Map();
  let estado = null;
  let t = 0;
  let velocidad = 0;
  let moviendo = false;
  let sello = null;
  let selloEscala = 1;
  let reloj = 0;
  let marco = 0;
  let ultimo = 0;
  let pedido = 0;
  let idle = 0;
  let vivo = true;

  const sprite = (id, n) => {
    const clave = `${id}${n}`;
    if (!sprites.has(clave)) sprites.set(clave, pintarCaja(id, n));
    return sprites.get(clave);
  };

  function dibujar() {
    if (!estado) return;
    g.drawImage(fondo, 0, 0);
    const mira = estado.t > 0 ? 1 : estado.t < 0 ? 0 : reloj % 40 < 20 ? 0 : 1;
    plato(g, 'izq', t);
    plato(g, 'der', t);
    cruz(g, t);
    gato(g, PIVOTE.x, PIVOTE.y - 3, mira, reloj % 14 < 7, reloj % 46 === 45);
    // De atrás adelante: lo de los platillos primero, las filas de abajo antes que las de arriba
    const orden = [...cajas.entries()].sort((a, b) => b[1].y - a[1].y);
    for (const [n, c] of orden) {
      const x = Math.round(c.x);
      const y = Math.round(c.y) - (estado.elegida === n ? 3 : 0);
      g.drawImage(sprite(estado.genero, n), x, y - 4);
      if (estado.tachadas?.has(n)) tachar(g, x, y);
      if (estado.elegida === n || estado.abierta?.caja === n) resalte(g, x, y);
      if (estado.abierta?.caja === n) abierta(g, x, y, estado.abierta.pesaMas);
    }
    if (sello) {
      const w = Math.round(SELLO_W * selloEscala);
      const h = Math.round(SELLO_H * selloEscala);
      g.drawImage(sello, Math.round(100 - w / 2), Math.round(66 - h / 2), w, h);
    }
  }

  function paso(ahora) {
    pedido = 0;
    if (!vivo) return;
    if (ahora - ultimo < 32) {
      pedido = requestAnimationFrame(paso);
      return;
    }
    ultimo = ahora;
    marco += 1;
    velocidad = (velocidad + (estado.t - t) * 0.16) * 0.8;
    t += velocidad;
    let quieto = Math.abs(estado.t - t) < 0.01 && Math.abs(velocidad) < 0.01;
    if (quieto) t = estado.t;
    for (const [n, c] of cajas) {
      const d = destino(estado.sitios[n], n, estado.total, t);
      const dx = d.x - c.x;
      const dy = d.y - c.y;
      if (Math.abs(dx) < 0.6 && Math.abs(dy) < 0.6) {
        c.x = d.x;
        c.y = d.y;
      } else {
        c.x += dx * 0.34;
        c.y += dy * 0.34 - Math.min(2.2, Math.abs(dx) * 0.05);
        quieto = false;
      }
    }
    if (selloEscala > 1) {
      selloEscala = Math.max(1, selloEscala - 0.34);
      quieto = false;
    }
    dibujar();
    if (quieto) {
      if (moviendo) alAsentar();
      moviendo = false;
    } else pedido = requestAnimationFrame(paso);
  }

  const mover = () => {
    if (reducido) {
      t = estado.t;
      for (const [n, c] of cajas) Object.assign(c, destino(estado.sitios[n], n, estado.total, t));
      dibujar();
      return;
    }
    if (!pedido) pedido = requestAnimationFrame(paso);
  };

  if (!reducido) {
    // El gato vive un poco por su cuenta: unos pocos dibujos por segundo, sin nada más que se mueva
    idle = window.setInterval(() => {
      reloj += 1;
      if (!pedido) dibujar();
    }, 260);
  }

  return {
    poner(nuevo) {
      const inclina = estado && nuevo.t !== estado.t && nuevo.t !== 0;
      estado = nuevo;
      for (let n = 1; n <= nuevo.total; n += 1) {
        if (!cajas.has(n)) {
          const d = destino(nuevo.sitios[n], n, nuevo.total, t);
          cajas.set(n, reducido ? { ...d } : { x: d.x + 210 + n * 8, y: d.y });
        }
      }
      if (inclina) moviendo = true;
      const valor = nuevo.sello ?? null;
      if (valor !== null && !sello) {
        sello = pintarSello(valor);
        selloEscala = reducido ? 1 : 2.4;
      } else if (valor === null) sello = null;
      mover();
    },
    destruir() {
      vivo = false;
      cancelAnimationFrame(pedido);
      window.clearInterval(idle);
    },
  };
}
