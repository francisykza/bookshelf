// Las colecciones del ala nueva del Almacén del Puerto (1.149, encargo de Francisco del 26-11-2026: «sets de muebles nuevos, lo
// más acogedores y atractivos que puedas, y una colección extra premium»). Cuatro habitaciones montadas, cada una con su paleta,
// sus materiales y su luz cálida: «Lumbre y Lana» (junto al fuego), «Cristal y Helecho» (el invernadero), «Buhardilla de
// Octubre» (el otoño bajo el tejado) y la colección premium «Medianoche» (la biblioteca de noche con velas).
// Las mismas reglas que furniture.js: solo cajas, en coordenadas locales (en el suelo, x a lo ancho, y a lo hondo con el frente
// en y = d, z arriba; en la pared, x a lo largo, y hacia fuera), `glow` en lo que se enciende de tarde y `grain: 0` en lo liso.
import { hash } from '../minigames/libreria-puerto/raster';

const B = (x0, y0, z0, x1, y1, z1, c, extra = {}) => ({ b: [x0, y0, z0, x1, y1, z1], c, ...extra });
const shade = (c, k) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
const P = { grain: 0 };
const G = { glow: true, grain: 0 };

// ── La paleta de las cuatro habitaciones ──
const NOGAL = [110, 70, 46];
const NOGAL_OSC = [78, 48, 34];
const MADERA = [150, 98, 60];
const MADERA_CLARA = [190, 142, 96];
const CREMA = [236, 226, 200];
const LANA = [238, 228, 206];
const LATON = [196, 156, 76];
const DORADO = [222, 180, 86];
const HIERRO = [64, 60, 66];
const FORJA = [228, 224, 212];
const HOJA = [86, 122, 78];
const HOJA_C = [128, 160, 96];
const HOJA_OSC = [62, 92, 66];
const TERRACOTA = [184, 98, 70];

const MOSTAZA = [204, 158, 70];
const CALABAZA = [222, 128, 52];
const HOJA_ROJA = [178, 70, 46];
const OCRE = [196, 140, 62];
const CORTEZA = [104, 70, 50];
const LENA = [196, 160, 112];
const HOLLIN = [42, 32, 30];
const FUEGO = [255, 168, 84];
const LLAMA = [255, 222, 146];
const BRASA = [240, 104, 54];
const VELA = [244, 236, 214];
const LUZ_VELA = [255, 206, 120];
const BOMBILLA = [255, 214, 140];

const TINTA = [36, 32, 42];

/** Un disco de cajas (`n` tiras a lo ancho) centrado en (cx, cy), de radio `r`, entre z0 y z1. */
function disco(cx, cy, r, z0, z1, c, n = 7, extra = {}) {
  const out = [];
  for (let k = 0; k < n; k += 1) {
    const x0 = cx - r + (k * 2 * r) / n;
    const x1 = x0 + (2 * r) / n;
    const m = (x0 + x1) / 2 - cx;
    const h = Math.sqrt(Math.max(0, r * r - m * m));
    out.push(B(x0, cy - h, z0, x1, cy + h, z1, c, extra));
  }
  return out;
}

/** Hojas: un puñado de cajitas repartidas en una copa redondeada (siempre las mismas para la misma planta). */
function copa(cx, cy, z0, z1, r, n, seed, tonos = [HOJA, HOJA_C]) {
  const out = [];
  for (let k = 0; k < n; k += 1) {
    const a = hash(k + seed, 1) * Math.PI * 2;
    const t = hash(k + seed, 3);
    const z = z0 + t * (z1 - z0);
    const d = Math.sqrt(hash(k + seed, 2)) * r * (1 - 0.45 * t);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const s = 0.09 + hash(k + seed, 5) * 0.06;
    out.push(B(x - s, y - s, z - s * 0.8, x + s, y + s, z + s * 0.8, tonos[Math.floor(hash(k + seed, 4) * tonos.length)], { step: 0.05 }));
  }
  return out;
}

/** Una hiedra que cuelga: cajitas de hoja en fila, de z0 hacia abajo, por delante de (x, y). */
function hiedra(x, y, z0, largo, seed) {
  const out = [];
  for (let k = 0; k * 0.09 < largo; k += 1) {
    const dx = (hash(seed, k) - 0.5) * 0.08;
    const z = z0 - k * 0.09;
    out.push(B(x + dx - 0.05, y, z - 0.06, x + dx + 0.05, y + 0.06, z, k % 3 ? HOJA : HOJA_C, P));
  }
  return out;
}

/** Una vela con su llama: cera de (x, y) a lo alto `h` desde z, con una gota a un lado. */
function vela(x, y, z, h, r = 0.04) {
  return [
    B(x - r, y - r, z, x + r, y + r, z + h, VELA),
    B(x + r, y - 0.01, z + h - 0.09, x + r + 0.012, y + 0.015, z + h - 0.02, VELA, P),
    B(x - 0.015, y - 0.015, z + h, x + 0.015, y + 0.015, z + h + 0.04, TINTA, P),
    B(x - 0.022, y - 0.022, z + h + 0.03, x + 0.022, y + 0.022, z + h + 0.12, LUZ_VELA, G),
  ];
}

export const SHAPES_COLECCIONES = {};
const S = SHAPES_COLECCIONES;

// ═══ «Lumbre y Lana»: granate, ladrillo, lana cruda y nogal, a la luz del fuego ═══

S['hogar-ladrillo'] = (T) => {
  const junta = shade(T, 0.72);
  const claro = shade(T, 1.14);
  const out = [
    // El hogar de piedra que asoma delante y las dos jambas de ladrillo con su arco escalonado
    B(-0.04, 0.52, 0, 2.04, 1.0, 0.08, [176, 166, 150]),
    B(0.0, 0.94, 0, 2.0, 1.0, 0.09, shade([176, 166, 150], 0.82), P),
    B(0, 0, 0.08, 0.45, 0.62, 1.25, T),
    B(1.55, 0, 0.08, 2, 0.62, 1.25, T),
    B(0.45, 0, 0.98, 1.55, 0.62, 1.25, T),
    B(0.45, 0, 0.84, 0.62, 0.62, 0.98, T),
    B(1.38, 0, 0.84, 1.55, 0.62, 0.98, T),
    B(0.45, 0, 0.72, 0.52, 0.62, 0.84, T),
    B(1.48, 0, 0.72, 1.55, 0.62, 0.84, T),
    // La boca, negra de hollín, con los morillos, los troncos cruzados y la lumbre
    B(0.45, 0, 0.08, 1.55, 0.3, 0.98, HOLLIN, P),
    B(0.52, 0.3, 0.08, 1.48, 0.6, 0.1, [58, 44, 40], P),
    B(0.55, 0.26, 0.08, 1.45, 0.58, 0.13, BRASA, G),
    B(0.62, 0.5, 0.1, 0.68, 0.56, 0.34, HIERRO),
    B(1.32, 0.5, 0.1, 1.38, 0.56, 0.34, HIERRO),
    B(0.58, 0.32, 0.13, 1.42, 0.5, 0.29, CORTEZA),
    B(1.42, 0.34, 0.15, 1.45, 0.48, 0.27, LENA, P),
    B(0.74, 0.28, 0.24, 1.28, 0.46, 0.38, shade(CORTEZA, 0.8)),
    B(0.68, 0.32, 0.29, 1.32, 0.48, 0.52, FUEGO, G),
    B(0.8, 0.34, 0.5, 1.2, 0.46, 0.7, LLAMA, G),
    B(0.92, 0.36, 0.68, 1.08, 0.44, 0.8, [255, 244, 214], G),
    B(0.7, 0.36, 0.5, 0.78, 0.44, 0.6, FUEGO, G),
    B(1.22, 0.36, 0.48, 1.3, 0.44, 0.62, FUEGO, G),
    // La rejilla de latón, delante de la boca
    B(0.42, 0.68, 0.08, 1.58, 0.72, 0.12, LATON, P),
    B(0.42, 0.68, 0.38, 1.58, 0.72, 0.42, LATON, P),
    ...[0.5, 0.75, 1.0, 1.25, 1.5].map((x) => B(x, 0.69, 0.12, x + 0.03, 0.71, 0.38, LATON, P)),
    // La repisa de nogal y el tiro, que sube hasta el techo de la habitación
    B(-0.08, -0.02, 1.25, 2.08, 0.76, 1.36, NOGAL),
    B(-0.04, 0.7, 1.2, 2.04, 0.78, 1.25, shade(NOGAL, 0.8)),
    B(0.2, 0, 1.36, 1.8, 0.48, 2.95, T),
    B(0.16, 0, 2.86, 1.84, 0.52, 2.95, claro),
  ];
  // Las hiladas de ladrillo, con su junta y algún ladrillo más claro a tresbolillo
  for (let z = 0.25; z < 1.25; z += 0.17) {
    out.push(B(0, 0.62, z, 0.45, 0.63, z + 0.02, junta, P), B(1.55, 0.62, z, 2, 0.63, z + 0.02, junta, P));
    if (z > 0.98) out.push(B(0.45, 0.62, z, 1.55, 0.63, z + 0.02, junta, P));
  }
  for (let z = 1.5; z < 2.86; z += 0.17) out.push(B(0.2, 0.48, z, 1.8, 0.49, z + 0.02, junta, P));
  for (let k = 0; k < 14; k += 1) {
    const x = 0.25 + hash(k, 61) * 1.25;
    const z = 1.42 + Math.floor(hash(k, 62) * 8) * 0.17;
    out.push(B(x, 0.48, z + 0.02, x + 0.24, 0.495, z + 0.15, hash(k, 63) > 0.5 ? claro : shade(T, 0.9), P));
  }
  // En la repisa: dos velas en sus palmatorias y una pila de libros; delante, una guirnalda de pino con bayas
  for (const x of [0.12, 1.74]) out.push(B(x, 0.28, 1.36, x + 0.16, 0.44, 1.4, LATON, P), ...vela(x + 0.08, 0.36, 1.4, 0.22));
  out.push(B(1.0, 0.14, 1.36, 1.36, 0.44, 1.42, [72, 96, 120]), B(1.03, 0.16, 1.42, 1.34, 0.42, 1.48, [150, 66, 52]), B(1.06, 0.12, 1.48, 1.3, 0.4, 1.53, CREMA));
  for (let k = 0; k < 11; k += 1) {
    const x = 0.02 + k * 0.18;
    const sag = 0.07 * Math.sin((k / 10) * Math.PI);
    out.push(B(x, 0.76, 1.17 - sag, x + 0.2, 0.84, 1.3 - sag, k % 2 ? [60, 104, 70] : [78, 124, 80]));
    if (k % 3 === 1) out.push(B(x + 0.07, 0.84, 1.18 - sag, x + 0.12, 0.86, 1.23 - sag, [204, 40, 46], P));
  }
  // Dos calcetines de punto colgados de la repisa
  for (const [x, c] of [
    [0.3, [176, 44, 48]],
    [1.5, LANA],
  ]) {
    out.push(B(x, 0.78, 0.86, x + 0.16, 0.82, 1.18, c), B(x, 0.78, 0.82, x + 0.26, 0.82, 0.96, c), B(x - 0.01, 0.78, 1.1, x + 0.17, 0.83, 1.18, c === LANA ? [176, 44, 48] : LANA, P));
  }
  return out;
};

S.orejero = (T) => {
  const claro = shade(T, 1.1);
  const oscuro = shade(T, 0.86);
  const out = [
    // Las patas de bola de nogal, el asiento, el cojín y el respaldo alto, con sus orejas
    ...[
      [0.2, 0.22],
      [1.66, 0.22],
      [0.2, 1.66],
      [1.66, 1.66],
    ].map(([x, y]) => B(x, y, 0, x + 0.14, y + 0.14, 0.2, NOGAL_OSC)),
    B(0.12, 0.2, 0.2, 1.88, 1.86, 0.6, T),
    B(0.42, 0.56, 0.6, 1.58, 1.84, 0.8, claro),
    B(0.44, 1.8, 0.62, 1.56, 1.86, 0.78, shade(T, 1.18), P),
    B(0.12, 0.12, 0.6, 1.88, 0.56, 2.06, oscuro),
    B(0.22, 0.12, 2.06, 1.78, 0.56, 2.16, oscuro),
    B(0.36, 0.56, 0.8, 1.64, 0.6, 1.98, T),
    // Las orejas, un poco abiertas hacia delante, y los brazos con su rollo
    B(0.1, 0.56, 1.18, 0.42, 1.06, 2.0, T),
    B(1.58, 0.56, 1.18, 1.9, 1.06, 2.0, T),
    B(0.12, 0.56, 0.6, 0.42, 1.86, 1.12, T),
    B(1.58, 0.56, 0.6, 1.88, 1.86, 1.12, T),
    B(0.08, 1.66, 0.92, 0.46, 1.9, 1.2, claro),
    B(1.54, 1.66, 0.92, 1.92, 1.9, 1.2, claro),
    // Los botones del respaldo
    ...[0.62, 1.0, 1.38].flatMap((x) => [1.25, 1.65].map((z) => B(x - 0.03, 0.6, z, x + 0.03, 0.62, z + 0.06, shade(T, 0.6), P))),
    // El cojín de lana cruda con su trenza
    B(0.66, 0.6, 0.8, 1.34, 0.82, 1.38, LANA),
    B(0.97, 0.82, 0.84, 1.03, 0.84, 1.34, shade(LANA, 0.86), P),
  ];
  // La manta de cuadros echada sobre el brazo derecho, que cae hasta casi el suelo
  const manta = [214, 196, 160];
  out.push(B(1.5, 0.9, 1.12, 1.96, 1.6, 1.2, manta), B(1.9, 0.9, 0.3, 1.96, 1.6, 1.2, manta));
  for (const y of [1.0, 1.3]) out.push(B(1.5, y, 1.2, 1.96, y + 0.06, 1.21, [150, 50, 46], P), B(1.96, y, 0.3, 1.97, y + 0.06, 1.2, [150, 50, 46], P));
  out.push(B(1.5, 1.15, 1.2, 1.96, 1.18, 1.21, [60, 90, 70], P), B(1.96, 1.15, 0.3, 1.97, 1.18, 1.2, [60, 90, 70], P));
  for (let y = 0.94; y < 1.6; y += 0.08) out.push(B(1.93, y, 0.2, 1.96, y + 0.03, 0.3, manta, P));
  return out;
};

S.lenero = (T) => {
  const out = [
    // El aro de hierro: dos patines, los dos cercos de los lados y el asa de arriba
    B(0.1, 0.18, 0, 0.9, 0.26, 0.06, T),
    B(0.1, 0.74, 0, 0.9, 0.82, 0.06, T),
    B(0.1, 0.18, 0.06, 0.16, 0.82, 0.12, T),
    B(0.84, 0.18, 0.06, 0.9, 0.82, 0.12, T),
    ...[0.1, 0.84].flatMap((x) => [B(x, 0.18, 0.06, x + 0.06, 0.24, 0.78, T), B(x, 0.76, 0.06, x + 0.06, 0.82, 0.78, T), B(x, 0.24, 0.78, x + 0.06, 0.76, 0.84, T)]),
    B(0.16, 0.47, 0.84, 0.84, 0.53, 0.9, T),
    B(0.4, 0.46, 0.9, 0.6, 0.54, 1.08, T),
    B(0.36, 0.46, 1.04, 0.64, 0.54, 1.1, T),
  ];
  // Los troncos, en tres filas: corteza a lo largo y la cara del corte, clara y con su anillo
  let k = 0;
  for (const [z, ys] of [
    [0.06, [0.22, 0.4, 0.58]],
    [0.24, [0.3, 0.5]],
    [0.42, [0.24, 0.42, 0.6]],
    [0.6, [0.4]],
  ]) {
    for (const y of ys) {
      const s = 0.16 + hash(k, 71) * 0.03;
      out.push(B(0.17, y, z, 0.83, y + s, z + s, hash(k, 72) > 0.5 ? CORTEZA : shade(CORTEZA, 0.82)));
      out.push(B(0.83, y + 0.015, z + 0.015, 0.85, y + s - 0.015, z + s - 0.015, LENA, P));
      out.push(B(0.85, y + s / 2 - 0.025, z + s / 2 - 0.025, 0.855, y + s / 2 + 0.025, z + s / 2 + 0.025, shade(LENA, 0.75), P));
      k += 1;
    }
  }
  // Unas piñas y una rama para encender
  out.push(B(0.3, 0.3, 0.78, 0.42, 0.42, 0.88, [120, 80, 50], { step: 0.05 }), B(0.56, 0.5, 0.78, 0.66, 0.6, 0.86, [132, 90, 56], { step: 0.05 }), B(0.2, 0.62, 0.78, 0.8, 0.66, 0.81, LENA, P));
  return out;
};

S['alfombra-escocesa'] = (T) => {
  const out = [B(0.08, 0.06, 0, 2.92, 1.94, 0.04, T)];
  const oscuro = shade(T, 0.62);
  // El cuadro escocés: bandas anchas oscuras y filetes de lana cruda y mostaza, a lo largo y a lo ancho
  for (const x of [0.5, 1.5, 2.5])
    out.push(B(x - 0.2, 0.06, 0.04, x + 0.2, 1.94, 0.05, oscuro, P), B(x + 0.28, 0.06, 0.05, x + 0.31, 1.94, 0.056, LANA, P), B(x - 0.31, 0.06, 0.05, x - 0.29, 1.94, 0.056, MOSTAZA, P));
  for (const y of [0.5, 1.5])
    out.push(B(0.08, y - 0.2, 0.045, 2.92, y + 0.2, 0.052, oscuro, P), B(0.08, y + 0.28, 0.052, 2.92, y + 0.31, 0.058, LANA, P), B(0.08, y - 0.31, 0.052, 2.92, y - 0.29, 0.058, MOSTAZA, P));
  // Los cruces, más oscuros, y los flecos de los lados cortos
  for (const x of [0.5, 1.5, 2.5]) for (const y of [0.5, 1.5]) out.push(B(x - 0.2, y - 0.2, 0.052, x + 0.2, y + 0.2, 0.056, shade(T, 0.48), P));
  for (let k = 0; k < 12; k += 1) {
    const y = 0.12 + k * 0.15;
    out.push(B(0, y, 0, 0.08, y + 0.06, 0.02, LANA, P), B(2.92, y, 0, 3.0, y + 0.06, 0.02, LANA, P));
  }
  return out;
};

S['lamina-nevada'] = (T) => {
  const out = [
    // El marco y el paspartú
    B(0.2, 0, 1.55, 1.8, 0.07, 2.75, T),
    B(0.27, 0, 1.62, 1.73, 0.09, 2.68, CREMA, P),
    // El cielo de noche, la luna y unas estrellas
    B(0.34, 0, 2.12, 1.66, 0.1, 2.61, [54, 64, 108], P),
    B(0.34, 0, 2.38, 1.66, 0.102, 2.61, [42, 50, 92], P),
    B(1.38, 0, 2.38, 1.5, 0.105, 2.5, [240, 234, 206], G),
    ...[
      [0.46, 2.52],
      [0.74, 2.44],
      [1.06, 2.56],
      [1.2, 2.3],
      [0.58, 2.32],
    ].map(([x, z]) => B(x, 0, z, x + 0.03, 0.104, z + 0.03, [250, 240, 200], G)),
    // La nieve y la cabaña con su ventana encendida y el humo
    B(0.34, 0, 1.69, 1.66, 0.1, 2.12, [234, 238, 242], P),
    B(0.34, 0, 2.06, 1.66, 0.101, 2.16, [210, 218, 228], P),
    B(0.84, 0, 1.92, 1.22, 0.11, 2.16, [130, 80, 52], P),
    B(0.8, 0, 2.16, 1.26, 0.112, 2.22, [96, 60, 42], P),
    B(0.86, 0, 2.22, 1.2, 0.112, 2.28, [96, 60, 42], P),
    B(0.92, 0, 2.28, 1.14, 0.112, 2.33, [96, 60, 42], P),
    B(0.8, 0, 2.2, 1.26, 0.114, 2.24, [244, 246, 250], P),
    B(0.9, 0, 1.98, 1.02, 0.115, 2.1, [255, 206, 110], G),
    B(1.08, 0, 1.92, 1.16, 0.115, 2.08, [80, 50, 36], P),
    B(1.1, 0, 2.28, 1.16, 0.113, 2.4, [120, 80, 60], P),
    B(1.12, 0, 2.42, 1.18, 0.11, 2.48, [190, 196, 210], P),
    B(1.16, 0, 2.5, 1.24, 0.11, 2.55, [176, 184, 200], P),
  ];
  // Los abetos nevados, a los dos lados
  for (const [cx, h] of [
    [0.5, 0.42],
    [0.66, 0.3],
    [1.46, 0.36],
  ]) {
    for (let k = 0; k < 4; k += 1) {
      const w = (0.14 * (4 - k)) / 4;
      const z = 1.74 + (k * h) / 4;
      out.push(B(cx - w, 0, z, cx + w, 0.11, z + h / 4, k === 3 ? [236, 240, 244] : [46, 84, 66], P));
    }
  }
  return out;
};

// ═══ «Cristal y Helecho»: forja blanca, salvia, terracota y cristal, con la luz del día que entra ═══

S['banco-forja'] = (T) => {
  const F = FORJA;
  const out = [
    // Las patas curvas con su voluta y el bastidor del asiento
    ...[
      [0.1, 0.14],
      [1.78, 0.14],
      [0.1, 0.78],
      [1.78, 0.78],
    ].flatMap(([x, y]) => [B(x, y, 0.1, x + 0.08, y + 0.08, 0.5, F), B(x - 0.04, y, 0, x + 0.12, y + 0.08, 0.1, F)]),
    B(0.08, 0.12, 0.5, 1.92, 0.92, 0.56, F),
    // El cojín del asiento, con su vivo, y los dos cojines de la espalda
    B(0.14, 0.16, 0.56, 1.86, 0.9, 0.7, T),
    B(0.14, 0.88, 0.62, 1.86, 0.91, 0.66, shade(T, 0.78), P),
    B(0.26, 0.2, 0.7, 0.86, 0.38, 1.14, shade(T, 1.12)),
    B(1.14, 0.2, 0.7, 1.74, 0.38, 1.12, CREMA),
    B(1.22, 0.38, 0.86, 1.66, 0.39, 0.96, T, P),
    // El respaldo: dos postes, el remate y los travesaños
    B(0.08, 0.1, 0.56, 0.16, 0.18, 1.66, F),
    B(1.84, 0.1, 0.56, 1.92, 0.18, 1.66, F),
    B(0.08, 0.1, 1.58, 1.92, 0.18, 1.64, F),
    B(0.16, 0.11, 0.98, 1.84, 0.17, 1.02, F),
    // Los brazos con su voluta delante
    B(0.08, 0.12, 0.92, 0.16, 0.92, 0.98, F),
    B(1.84, 0.12, 0.92, 1.92, 0.92, 0.98, F),
    B(0.08, 0.84, 0.56, 0.16, 0.92, 0.92, F),
    B(1.84, 0.84, 0.56, 1.92, 0.92, 0.92, F),
    B(0.06, 0.86, 0.84, 0.18, 0.98, 0.96, F),
    B(1.82, 0.86, 0.84, 1.94, 0.98, 0.96, F),
  ];
  // El dibujo del respaldo: barrotes y, entre ellos, lazos de forja (cuadraditos huecos)
  for (let x = 0.3; x < 1.8; x += 0.24) {
    out.push(B(x, 0.12, 1.02, x + 0.035, 0.16, 1.58, F));
    if (x + 0.24 < 1.84)
      out.push(
        B(x + 0.08, 0.12, 1.24, x + 0.16, 0.16, 1.27, F),
        B(x + 0.08, 0.12, 1.36, x + 0.16, 0.16, 1.39, F),
        B(x + 0.08, 0.12, 1.27, x + 0.1, 0.16, 1.36, F),
        B(x + 0.14, 0.12, 1.27, x + 0.16, 0.16, 1.36, F),
      );
  }
  // Una regadera de cinc a sus pies
  out.push(B(1.5, 0.92, 0, 1.74, 1.0, 0.2, [150, 160, 166]), B(1.38, 0.94, 0.14, 1.5, 0.98, 0.18, [150, 160, 166], P));
  return out;
};

S['escalera-macetas'] = (T) => {
  const out = [];
  // Los dos laterales en escalera, a un lado y a otro: el larguero de atrás alto y el de delante bajo, con sus peldaños
  for (const x of [0.06, 1.86]) {
    out.push(B(x, 0.1, 0, x + 0.08, 0.2, 1.62, T), B(x, 0.84, 0, x + 0.08, 0.94, 0.5, T));
    out.push(B(x, 0.2, 1.42, x + 0.08, 0.5, 1.48, T), B(x, 0.2, 0.96, x + 0.08, 0.72, 1.02, T), B(x, 0.2, 0.44, x + 0.08, 0.94, 0.5, T));
  }
  // Tres baldas escalonadas, de atrás arriba a delante abajo
  const baldas = [
    [0.2, 0.5, 1.48],
    [0.2, 0.72, 1.02],
    [0.2, 0.94, 0.5],
  ];
  for (const [y0, y1, z] of baldas) out.push(B(0.06, y0, z - 0.06, 1.94, y1, z, shade(T, 1.08)), B(0.06, y1 - 0.03, z - 0.08, 1.94, y1, z - 0.06, shade(T, 0.8), P));
  // Las macetas de barro con sus plantas: helechos, un geranio, unas suculentas y hiedra que cae por delante
  let k = 0;
  for (const [y0, y1, z] of baldas) {
    const y = (y0 + y1) / 2 + 0.05;
    for (const x of [0.36, 1.0, 1.64]) {
      const s = 0.13 + hash(k, 81) * 0.04;
      const barro = hash(k, 82) > 0.6 ? [206, 120, 84] : TERRACOTA;
      out.push(B(x - s, y - s, z, x + s, y + s, z + s * 1.6, barro), B(x - s - 0.02, y - s - 0.02, z + s * 1.5, x + s + 0.02, y + s + 0.02, z + s * 1.7, shade(barro, 1.1)));
      const tipo = k % 3;
      if (tipo === 0) out.push(...copa(x, y, z + s * 1.7, z + s * 1.7 + 0.36, 0.22, 12, 300 + k, [HOJA, HOJA_C, HOJA_OSC]));
      else if (tipo === 1)
        out.push(
          ...copa(x, y, z + s * 1.7, z + s * 1.7 + 0.26, 0.16, 8, 400 + k, [HOJA_OSC, HOJA]),
          ...[0, 1, 2].map((j) =>
            B(x - 0.1 + j * 0.08, y - 0.04 + (j % 2) * 0.06, z + s * 1.7 + 0.22, x - 0.04 + j * 0.08, y + 0.02 + (j % 2) * 0.06, z + s * 1.7 + 0.28, j === 1 ? [236, 120, 140] : [214, 72, 84], {
              step: 0.05,
            }),
          ),
        );
      else
        out.push(
          ...[0, 1, 2, 3].map((j) =>
            B(x - 0.1 + (j % 2) * 0.1, y - 0.08 + Math.floor(j / 2) * 0.1, z + s * 1.7, x - 0.02 + (j % 2) * 0.1, y + Math.floor(j / 2) * 0.1, z + s * 1.7 + 0.08, [122, 156, 128], { step: 0.05 }),
          ),
        );
      if (hash(k, 83) > 0.45) out.push(...hiedra(x + 0.06, y1, z, 0.3 + hash(k, 84) * 0.3, k));
      k += 1;
    }
  }
  return out;
};

S.limonero = (T) => {
  const out = [
    // La maceta grande de barro, con su borde, la tierra y el tronco con dos ramas
    B(0.2, 0.2, 0, 0.8, 0.8, 0.56, T),
    B(0.15, 0.15, 0.52, 0.85, 0.85, 0.64, shade(T, 1.1)),
    B(0.22, 0.22, 0.6, 0.78, 0.78, 0.63, [80, 60, 46], P),
    B(0.2, 0.84, 0.2, 0.8, 0.86, 0.26, shade(T, 0.78), P),
    B(0.46, 0.46, 0.63, 0.54, 0.54, 1.45, CORTEZA),
    B(0.36, 0.48, 1.2, 0.48, 0.54, 1.28, CORTEZA),
    B(0.54, 0.46, 1.32, 0.66, 0.52, 1.4, CORTEZA),
    ...copa(0.5, 0.5, 1.32, 2.32, 0.48, 46, 90, [HOJA_OSC, HOJA, HOJA_C]),
  ];
  // Los limones (y alguna flor de azahar), sobre la copa
  for (let k = 0; k < 11; k += 1) {
    const a = hash(k, 91) * Math.PI * 2;
    const z = 1.45 + hash(k, 92) * 0.75;
    const d = 0.32 + hash(k, 93) * 0.14;
    const x = 0.5 + Math.cos(a) * d * (1 - (z - 1.45) * 0.4);
    const y = 0.5 + Math.sin(a) * d * (1 - (z - 1.45) * 0.4);
    if (k < 9) out.push(B(x - 0.06, y - 0.05, z - 0.07, x + 0.06, y + 0.05, z + 0.05, [244, 206, 64]), B(x - 0.015, y - 0.015, z + 0.05, x + 0.015, y + 0.015, z + 0.07, HOJA_OSC, P));
    else out.push(B(x - 0.04, y - 0.04, z - 0.02, x + 0.04, y + 0.04, z + 0.03, [252, 248, 236], P));
  }
  return out;
};

S['lampara-jaula'] = (T) => {
  const out = [
    // El pie: base redonda, columna con sus nudos y el plato donde se posa la jaula
    ...disco(0.5, 0.5, 0.3, 0, 0.06, T),
    ...disco(0.5, 0.5, 0.2, 0.06, 0.12, shade(T, 1.08)),
    B(0.46, 0.46, 0.12, 0.54, 0.54, 1.12, T),
    B(0.42, 0.42, 0.42, 0.58, 0.58, 0.48, shade(T, 1.1)),
    B(0.42, 0.42, 0.82, 0.58, 0.58, 0.88, shade(T, 1.1)),
    ...disco(0.5, 0.5, 0.3, 1.12, 1.18, T, 9),
  ];
  // La jaula: barrotes alrededor, el aro de en medio, la cúpula en escalones y la argolla
  for (let k = 0; k < 12; k += 1) {
    const a = (k / 12) * Math.PI * 2;
    const x = 0.5 + Math.cos(a) * 0.27;
    const y = 0.5 + Math.sin(a) * 0.27;
    out.push(B(x - 0.018, y - 0.018, 1.18, x + 0.018, y + 0.018, 1.72, T, P));
  }
  out.push(...disco(0.5, 0.5, 0.29, 1.44, 1.47, T, 9, P));
  for (const [r, z] of [
    [0.27, 1.72],
    [0.22, 1.79],
    [0.15, 1.85],
    [0.08, 1.9],
  ])
    out.push(...disco(0.5, 0.5, r, z, z + 0.07, T, 7));
  out.push(B(0.47, 0.47, 1.97, 0.53, 0.53, 2.04, T), B(0.44, 0.48, 2.04, 0.56, 0.52, 2.12, T, P));
  // Dentro, un tarro de cristal con su vela y una ristra de lucecitas
  out.push(B(0.4, 0.4, 1.18, 0.6, 0.6, 1.24, [200, 214, 222], P), ...vela(0.5, 0.5, 1.24, 0.18, 0.05));
  for (let k = 0; k < 7; k += 1) {
    const a = (k / 7) * Math.PI * 2 + 0.3;
    out.push(
      B(0.5 + Math.cos(a) * 0.2 - 0.02, 0.5 + Math.sin(a) * 0.2 - 0.02, 1.52 + (k % 2) * 0.08, 0.5 + Math.cos(a) * 0.2 + 0.02, 0.5 + Math.sin(a) * 0.2 + 0.02, 1.56 + (k % 2) * 0.08, BOMBILLA, G),
    );
  }
  // Una hiedra que trepa por la columna
  for (let k = 0; k < 8; k += 1) out.push(B(0.42 + (k % 2) * 0.1, 0.52 + (k % 2) * 0.02, 0.2 + k * 0.12, 0.5 + (k % 2) * 0.1, 0.6 + (k % 2) * 0.02, 0.28 + k * 0.12, k % 3 ? HOJA : HOJA_C, P));
  return out;
};

S['ventanal-invernadero'] = (T) => {
  const cielo = [214, 232, 222];
  const out = [
    // El alféizar con sus tiestos de hierbas, el marco blanco y los cristales, con un rayo de sol
    B(0.1, 0, 1.22, 1.9, 0.22, 1.3, T),
    B(0.16, 0, 1.3, 1.84, 0.04, 2.96, cielo, G),
    B(0.16, 0, 2.2, 1.84, 0.041, 2.96, [228, 240, 232], G),
    B(0.22, 0, 1.3, 0.42, 0.045, 2.6, [244, 236, 210], G),
    B(0.1, 0, 1.3, 0.2, 0.1, 3.0, T),
    B(1.8, 0, 1.3, 1.9, 0.1, 3.0, T),
  ];
  // El arco de arriba, en escalones
  for (const [x0, x1, z] of [
    [0.1, 1.9, 2.96],
    [0.18, 1.82, 3.04],
    [0.34, 1.66, 3.12],
    [0.6, 1.4, 3.2],
  ])
    out.push(B(x0, 0, z, x1, 0.1, z + 0.08, T));
  // Los parteluces y los travesaños de los cuarterones
  for (const x of [0.58, 1.0, 1.42]) out.push(B(x - 0.03, 0, 1.3, x + 0.03, 0.08, 3.12, T, P));
  for (const z of [1.72, 2.14, 2.56]) out.push(B(0.16, 0, z - 0.03, 1.84, 0.08, z + 0.03, T, P));
  // La hiedra, que sube por el lado izquierdo y cruza el arco
  for (let k = 0; k < 18; k += 1) {
    const t = k / 17;
    const x = t < 0.55 ? 0.12 + hash(k, 95) * 0.1 : 0.2 + (t - 0.55) * 3.2;
    const z = t < 0.55 ? 1.34 + t * 3.2 : 3.08 + (hash(k, 96) - 0.5) * 0.12;
    out.push(B(x - 0.06, 0.08, z - 0.05, x + 0.06, 0.14, z + 0.05, k % 3 ? HOJA : HOJA_C, P));
  }
  // Tres tiestos en el alféizar: albahaca, romero y un pensamiento
  for (const [x, hoja] of [
    [0.45, [110, 150, 84]],
    [1.0, [96, 124, 100]],
    [1.55, [150, 110, 170]],
  ]) {
    out.push(B(x - 0.1, 0.04, 1.3, x + 0.1, 0.2, 1.48, TERRACOTA), B(x - 0.11, 0.03, 1.46, x + 0.11, 0.21, 1.5, shade(TERRACOTA, 1.1)));
    out.push(...copa(x, 0.12, 1.5, 1.72, 0.12, 6, Math.round(x * 100), [hoja, HOJA]));
  }
  return out;
};

// ═══ «Buhardilla de Octubre»: mostaza, calabaza, hoja roja y madera clara, con lucecitas bajo el tejado ═══

S['nido-lectura'] = (T) => {
  const out = [
    // El palé bajo con sus tablas y el colchón
    B(0.04, 0.04, 0, 1.96, 1.96, 0.16, MADERA_CLARA),
    ...[0.5, 1.0, 1.5].map((x) => B(x - 0.02, 1.96, 0.02, x + 0.02, 1.97, 0.14, shade(MADERA_CLARA, 0.72), P)),
    B(0.08, 0.08, 0.16, 1.92, 1.92, 0.42, T),
    ...[0.5, 1.0, 1.5].flatMap((x) => [0.6, 1.2].map((y) => B(x - 0.03, y - 0.03, 0.42, x + 0.03, y + 0.03, 0.43, shade(T, 0.7), P))),
    // Los cojines grandes contra la pared y uno pequeño de hoja roja
    B(0.12, 0.1, 0.42, 0.96, 0.44, 1.06, CALABAZA),
    B(1.02, 0.1, 0.42, 1.88, 0.42, 1.0, LANA),
    B(1.12, 0.42, 0.62, 1.78, 0.43, 0.86, [196, 140, 62], P),
    B(0.32, 0.42, 0.42, 0.78, 0.64, 0.82, HOJA_ROJA),
    // La manta de punto, doblada sobre la esquina y cayendo por el lado
    B(0.9, 0.96, 0.42, 1.94, 1.94, 0.5, OCRE),
    B(1.92, 1.0, 0.16, 1.98, 1.9, 0.5, OCRE),
    ...[1.1, 1.35, 1.6].map((y) => B(0.92, y, 0.5, 1.94, y + 0.05, 0.51, shade(OCRE, 1.14), P)),
    // Un libro abierto y una taza de chocolate
    B(0.42, 1.18, 0.42, 0.86, 1.52, 0.46, CREMA),
    B(0.63, 1.18, 0.46, 0.65, 1.52, 0.47, shade(CREMA, 0.7), P),
    B(0.44, 1.2, 0.41, 0.84, 1.5, 0.43, [150, 66, 52], P),
    B(1.32, 0.66, 0.42, 1.48, 0.82, 0.6, [220, 120, 60]),
    B(1.34, 0.68, 0.6, 1.46, 0.8, 0.61, [110, 64, 44], P),
    // El dosel: dos postes, el larguero, la gasa de los lados y la ristra de lucecitas
    B(0.04, 0.04, 0.16, 0.1, 0.1, 2.36, MADERA_CLARA),
    B(1.9, 0.04, 0.16, 1.96, 0.1, 2.36, MADERA_CLARA),
    B(0.04, 0.04, 2.3, 1.96, 0.1, 2.36, MADERA_CLARA),
    B(0.1, 0.06, 0.5, 0.36, 0.12, 2.3, [244, 236, 220], P),
    B(1.64, 0.06, 0.5, 1.9, 0.12, 2.3, [244, 236, 220], P),
    B(0.1, 0.05, 2.0, 1.9, 0.11, 2.3, [244, 236, 220], P),
  ];
  for (let k = 0; k < 10; k += 1) {
    const x = 0.14 + k * 0.19;
    const sag = 0.12 * Math.sin((k / 9) * Math.PI);
    out.push(B(x - 0.03, 0.11, 1.92 - sag, x + 0.03, 0.15, 1.98 - sag, k % 2 ? BOMBILLA : [255, 190, 120], G));
  }
  return out;
};

S['escalera-mantas'] = (T) => {
  const out = [];
  // Los dos largueros, apoyados en la pared: escalonados de arriba (pegado a la pared) a abajo (más fuera)
  for (const x of [0.12, 0.8]) for (let k = 0; k < 8; k += 1) out.push(B(x, 0.12 + k * 0.08, 2.1 - (k + 1) * 0.26, x + 0.08, 0.22 + k * 0.08, 2.1 - k * 0.26, T));
  const peldano = (z) => 0.12 + ((2.1 - z) / 0.26) * 0.08;
  for (const z of [0.45, 0.95, 1.45, 1.92]) out.push(B(0.2, peldano(z), z - 0.04, 0.8, peldano(z) + 0.08, z + 0.02, shade(T, 1.08)));
  // Las mantas, dobladas sobre los peldaños: mostaza de punto, cuadros de calabaza y lana cruda
  for (const [z, c, largo] of [
    [1.92, MOSTAZA, 0.7],
    [1.45, CALABAZA, 0.6],
    [0.95, LANA, 0.5],
  ]) {
    const y = peldano(z);
    out.push(B(0.22, y - 0.03, z + 0.02, 0.78, y + 0.11, z + 0.07, c));
    out.push(B(0.22, y + 0.08, z - largo, 0.78, y + 0.13, z + 0.06, c), B(0.22, y - 0.06, z - largo * 0.6, 0.78, y - 0.01, z + 0.06, shade(c, 0.86)));
    if (c === CALABAZA) for (const zz of [z - 0.15, z - 0.35]) out.push(B(0.22, y + 0.13, zz, 0.78, y + 0.135, zz + 0.04, [120, 50, 36], P));
    for (let x = 0.24; x < 0.78; x += 0.07) out.push(B(x, y + 0.08, z - largo - 0.06, x + 0.03, y + 0.12, z - largo, c, P));
  }
  return out;
};

S.calabazas = (T) => {
  const out = [
    // La caja de fruta con sus tablillas
    B(0.08, 0.16, 0, 0.92, 0.84, 0.06, MADERA),
    ...[0.06, 0.16].map((z) => B(0.08, 0.82, z + 0.04, 0.92, 0.86, z + 0.1, MADERA_CLARA)),
    B(0.08, 0.16, 0.06, 0.14, 0.84, 0.3, MADERA),
    B(0.86, 0.16, 0.06, 0.92, 0.84, 0.3, MADERA),
    B(0.14, 0.2, 0.06, 0.86, 0.8, 0.22, [214, 186, 120], P),
  ];
  // Una calabaza grande (gajos más oscuros) sobre la paja, una blanca pequeña encima y otra verde a un lado
  const calabaza = (cx, cy, z, r, c, seed) => {
    const capas = [
      [0.7, 0.0],
      [0.95, 0.22],
      [1.0, 0.45],
      [0.9, 0.68],
      [0.6, 0.86],
    ];
    for (const [k, t] of capas) out.push(...disco(cx, cy, r * k, z + t * r * 1.6, z + (t + 0.24) * r * 1.6, c, 7));
    for (let j = 0; j < 4; j += 1) {
      const a = (j / 4) * Math.PI + seed;
      out.push(
        B(
          cx + Math.cos(a) * r * 0.98 - 0.015,
          cy + Math.sin(a) * r * 0.98 - 0.015,
          z + r * 0.3,
          cx + Math.cos(a) * r * 0.98 + 0.015,
          cy + Math.sin(a) * r * 0.98 + 0.015,
          z + r * 1.2,
          shade(c, 0.78),
          P,
        ),
      );
    }
    out.push(B(cx - 0.025, cy - 0.025, z + r * 1.6, cx + 0.025, cy + 0.025, z + r * 1.6 + 0.08, [96, 104, 60]));
  };
  calabaza(0.46, 0.5, 0.22, 0.3, T, 0.3);
  calabaza(0.52, 0.48, 0.22 + 0.3 * 1.6 - 0.04, 0.14, LANA, 1.1);
  calabaza(0.82, 0.86, 0, 0.12, [128, 140, 84], 0.7);
  // Hojas de otoño por el suelo
  for (let k = 0; k < 6; k += 1) {
    const x = 0.08 + hash(k, 101) * 0.84;
    const y = 0.06 + hash(k, 102) * 0.88;
    out.push(B(x - 0.06, y - 0.04, 0, x + 0.06, y + 0.04, 0.015, [HOJA_ROJA, OCRE, MOSTAZA][k % 3], P));
  }
  return out;
};

S['lampara-seta'] = (T) => {
  const out = [
    // El musgo de la base, el pie de seta y la seta pequeña que le ha salido al lado
    ...disco(0.5, 0.5, 0.34, 0, 0.06, [104, 128, 76], 7),
    ...disco(0.5, 0.5, 0.16, 0.06, 0.3, [238, 228, 206], 5),
    ...disco(0.5, 0.5, 0.13, 0.3, 0.85, [238, 228, 206], 5),
    ...disco(0.5, 0.5, 0.17, 0.62, 0.68, [226, 214, 190], 5),
    B(0.74, 0.7, 0.06, 0.8, 0.76, 0.22, [238, 228, 206]),
    ...disco(0.77, 0.73, 0.1, 0.22, 0.3, shade(T, 0.95), 5),
    // La parte de abajo del sombrero, encendida (es la pantalla), y el sombrero en escalones
    ...disco(0.5, 0.5, 0.46, 0.85, 0.9, [255, 222, 160], 9, G),
  ];
  for (const [r, z] of [
    [0.48, 0.9],
    [0.44, 1.02],
    [0.36, 1.12],
    [0.24, 1.2],
  ])
    out.push(...disco(0.5, 0.5, r, z, z + 0.12, T, 9, { glow: true }));
  // Los lunares del sombrero
  for (const [x, y, z] of [
    [0.22, 0.52, 0.96],
    [0.5, 0.86, 0.98],
    [0.7, 0.24, 1.0],
    [0.42, 0.34, 1.16],
    [0.62, 0.62, 1.2],
    [0.8, 0.6, 0.96],
  ])
    out.push(B(x - 0.04, y - 0.04, z, x + 0.04, y + 0.04, z + 0.06, [252, 246, 230], P));
  return out;
};

S['guirnalda-hojas'] = (T) => {
  const out = [];
  // La cuerda, que cuelga en dos senos, y en ella hojas de otoño, bellotas y bombillas
  for (let k = 0; k < 16; k += 1) {
    const x = 0.12 + k * 0.18;
    const sag = 0.16 * Math.abs(Math.sin((k / 15) * Math.PI * 2));
    const z = 3.1 - sag;
    out.push(B(x, 0, z, x + 0.18, 0.04, z + 0.03, [120, 90, 60], P));
    const c = [T, OCRE, HOJA_ROJA, MOSTAZA][k % 4];
    out.push(B(x + 0.02, 0.03, z - 0.16, x + 0.14, 0.07, z, c), B(x + 0.06, 0.04, z - 0.2, x + 0.1, 0.07, z - 0.16, shade(c, 0.8), P));
    if (k % 2) out.push(B(x + 0.05, 0.04, z - 0.3, x + 0.13, 0.12, z - 0.2, BOMBILLA, G));
    if (k % 5 === 2) out.push(B(x + 0.12, 0.05, z - 0.12, x + 0.18, 0.11, z - 0.05, [150, 104, 60]), B(x + 0.11, 0.05, z - 0.06, x + 0.19, 0.11, z - 0.03, [96, 70, 44], P));
  }
  for (const x of [0.06, 2.88]) out.push(B(x, 0, 3.06, x + 0.06, 0.06, 3.16, LATON, P));
  return out;
};

// ═══ «Medianoche», la colección premium: terciopelo, nogal oscuro, latón dorado, velas y estrellas ═══

S['chester-terciopelo'] = (T) => {
  const claro = shade(T, 1.12);
  const out = [
    // Patas de bola, base, dos cojines de asiento, respaldo y brazos enrollados a la misma altura
    ...[
      [0.2, 0.24],
      [2.66, 0.24],
      [0.2, 1.66],
      [2.66, 1.66],
    ].map(([x, y]) => B(x, y, 0, x + 0.14, y + 0.14, 0.18, NOGAL_OSC)),
    B(0.1, 0.18, 0.18, 2.9, 1.86, 0.62, T),
    B(0.46, 0.5, 0.62, 1.48, 1.84, 0.82, claro),
    B(1.52, 0.5, 0.62, 2.54, 1.84, 0.82, claro),
    B(0.1, 0.12, 0.62, 2.9, 0.52, 1.46, T),
    B(0.06, 0.08, 1.4, 2.94, 0.58, 1.58, claro),
    B(0.06, 0.12, 0.62, 0.46, 1.88, 1.42, T),
    B(2.54, 0.12, 0.62, 2.94, 1.88, 1.42, T),
    B(0.02, 0.2, 1.3, 0.5, 1.9, 1.52, claro),
    B(2.5, 0.2, 1.3, 2.98, 1.9, 1.52, claro),
    // El ribete dorado de tachuelas al pie de los brazos y del frente
    ...Array.from({ length: 16 }, (_, k) => B(0.2 + k * 0.165, 1.86, 0.5, 0.24 + k * 0.165, 1.88, 0.54, DORADO, P)),
    ...Array.from({ length: 9 }, (_, k) => [B(0.06, 0.3 + k * 0.17, 0.66, 0.04, 0.34 + k * 0.17, 0.7, DORADO, P), B(2.94, 0.3 + k * 0.17, 0.66, 2.96, 0.34 + k * 0.17, 0.7, DORADO, P)]).flat(),
    // Un cojín de raso dorado con su borla y un libro abierto en el asiento
    B(0.54, 0.54, 0.82, 1.0, 0.74, 1.26, DORADO),
    B(0.74, 0.74, 0.98, 0.8, 0.78, 1.1, shade(DORADO, 0.8), P),
    B(1.9, 1.1, 0.82, 2.3, 1.42, 0.86, CREMA),
    B(2.09, 1.1, 0.86, 2.11, 1.42, 0.87, shade(CREMA, 0.7), P),
    B(1.92, 1.12, 0.81, 2.28, 1.4, 0.83, [30, 60, 50], P),
  ];
  // El capitoné: botones en rombo por el respaldo y por dentro de los brazos, cada uno con su brillo
  for (let row = 0; row < 3; row += 1) {
    const z = 0.86 + row * 0.2;
    for (let x = 0.62 + (row % 2) * 0.16; x < 2.4; x += 0.32)
      out.push(B(x - 0.03, 0.52, z, x + 0.03, 0.535, z + 0.05, shade(T, 0.55), P), B(x - 0.08, 0.52, z + 0.06, x + 0.08, 0.525, z + 0.075, claro, P));
  }
  for (let row = 0; row < 2; row += 1)
    for (let y = 0.7 + row * 0.16; y < 1.7; y += 0.32) for (const x of [0.46, 2.535]) out.push(B(x, y, 0.86 + row * 0.22, x + 0.005, y + 0.05, 0.91 + row * 0.22, shade(T, 0.55), P));
  return out;
};

S['biblioteca-escalera'] = (T) => {
  const out = [
    // El mueble alto de nogal: zócalo, laterales, fondo y la cornisa en tres escalones con su filete dorado
    B(0, 0, 0, 2, 0.98, 0.22, shade(T, 0.85)),
    B(0, 0, 0, 0.12, 0.96, 3.34, T),
    B(1.88, 0, 0, 2, 0.96, 3.34, T),
    B(0.12, 0, 0.22, 1.88, 0.1, 3.3, shade(T, 0.7)),
    B(-0.04, -0.02, 3.34, 2.04, 1.0, 3.42, T),
    B(-0.08, -0.04, 3.42, 2.08, 1.04, 3.5, shade(T, 1.12)),
    B(-0.08, 1.04, 3.43, 2.08, 1.05, 3.46, DORADO, P),
    B(0.0, 0.96, 0.08, 2.0, 0.98, 0.12, DORADO, P),
    // El riel de latón con sus escuadras y la lamparita de cuadro que alumbra los lomos
    B(0.1, 0.98, 3.0, 1.9, 1.02, 3.04, LATON, P),
    ...[0.2, 1.8].map((x) => B(x - 0.02, 0.94, 2.98, x + 0.02, 1.0, 3.06, LATON, P)),
    B(0.86, 0.9, 3.26, 1.14, 1.04, 3.32, LATON),
    B(0.9, 0.98, 3.2, 1.1, 1.04, 3.26, [255, 230, 170], G),
  ];
  // Cuatro baldas de libros en colores de joya, con sus nervios dorados; alguno inclinado y uno de cara
  const LOMOS = [
    [96, 40, 70],
    [30, 60, 50],
    [118, 30, 44],
    [36, 44, 86],
    [150, 104, 70],
    [70, 40, 90],
    [196, 156, 76],
    [42, 36, 44],
  ];
  let k = 0;
  for (const z of [0.22, 1.0, 1.78, 2.56]) {
    out.push(B(0.12, 0.1, z, 1.88, 0.96, z + 0.07, shade(T, 1.05)), B(0.12, 0.92, z, 1.88, 0.97, z + 0.07, DORADO, P));
    let x = 0.16;
    while (x < 1.8) {
      const t = 0.1 + hash(k, 111) * 0.08;
      const h = 0.48 + hash(k, 112) * 0.22;
      if (x + t > 1.84) break;
      const c = LOMOS[k % LOMOS.length];
      if (hash(k, 113) > 0.88 && x + 0.4 < 1.84) {
        out.push(B(x, 0.3, z + 0.07, x + 0.36, 0.38, z + 0.6, c), B(x + 0.04, 0.38, z + 0.4, x + 0.32, 0.39, z + 0.48, DORADO, P));
        x += 0.42;
      } else {
        out.push(B(x, 0.24, z + 0.07, x + t - 0.015, 0.9, z + 0.07 + h, c));
        out.push(
          B(x + 0.01, 0.9, z + 0.07 + h * 0.18, x + t - 0.025, 0.905, z + 0.07 + h * 0.22, DORADO, P),
          B(x + 0.01, 0.9, z + 0.07 + h * 0.74, x + t - 0.025, 0.905, z + 0.07 + h * 0.78, DORADO, P),
        );
        x += t;
      }
      k += 1;
    }
  }
  // La escalera de biblioteca, colgada del riel por la derecha, con sus ruedas abajo
  for (const x of [1.4, 1.74]) {
    for (let j = 0; j < 6; j += 1) out.push(B(x, 1.0 + (j % 2) * 0.005, 3.04 - (j + 1) * 0.5, x + 0.05, 1.05, 3.04 - j * 0.5, LATON));
    out.push(B(x - 0.01, 0.98, 0, x + 0.06, 1.05, 0.06, [40, 36, 40]));
  }
  for (let z = 0.35; z < 2.9; z += 0.36) out.push(B(1.45, 1.0, z, 1.74, 1.05, z + 0.04, shade(T, 1.2)));
  return out;
};

S['candelabro-pie'] = (T) => {
  const claro = shade(T, 1.14);
  const out = [
    // Las tres garras de la base, el pie en escalones y la columna torneada con sus nudos
    ...[
      [0.14, 0.44],
      [0.74, 0.44],
      [0.44, 0.14],
      [0.44, 0.74],
    ].map(([x, y]) => B(x, y, 0, x + 0.12, y + 0.12, 0.06, T)),
    ...disco(0.5, 0.5, 0.26, 0.04, 0.12, T),
    ...disco(0.5, 0.5, 0.16, 0.12, 0.22, claro),
    B(0.46, 0.46, 0.22, 0.54, 0.54, 1.82, T),
    ...[0.5, 0.95, 1.4].flatMap((z) => [B(0.42, 0.42, z, 0.58, 0.58, z + 0.06, claro, P), B(0.44, 0.44, z + 0.06, 0.56, 0.56, z + 0.1, T, P)]),
    // Los brazos en cruz que suben hacia sus platillos y el platillo del centro, más alto
    B(0.12, 0.47, 1.76, 0.88, 0.53, 1.82, T),
    B(0.47, 0.12, 1.76, 0.53, 0.88, 1.82, T),
    ...disco(0.5, 0.5, 0.08, 2.0, 2.04, claro, 5),
    B(0.47, 0.47, 1.82, 0.53, 0.53, 2.0, T),
  ];
  for (const [x, y] of [
    [0.15, 0.5],
    [0.85, 0.5],
    [0.5, 0.15],
    [0.5, 0.85],
  ]) {
    out.push(B(x - 0.03, y - 0.03, 1.82, x + 0.03, y + 0.03, 1.9, T), ...disco(x, y, 0.07, 1.9, 1.94, claro, 5), ...vela(x, y, 1.94, 0.24 + hash(Math.round(x * 10 + y), 121) * 0.1));
  }
  out.push(...vela(0.5, 0.5, 2.04, 0.3, 0.045));
  return out;
};

S['globo-celeste'] = (T) => {
  const out = [
    // El pie de nogal: tres patas curvas, la cruceta y el aro del horizonte, dorado
    ...[
      [0.16, 0.2],
      [0.72, 0.2],
      [0.44, 0.78],
    ].flatMap(([x, y]) => [B(x, y, 0, x + 0.12, y + 0.08, 0.1, NOGAL_OSC), B(x + (0.5 - x) * 0.3, y + (0.5 - y) * 0.3, 0.1, x + (0.5 - x) * 0.3 + 0.08, y + (0.5 - y) * 0.3 + 0.08, 0.7, NOGAL_OSC)]),
    B(0.3, 0.3, 0.42, 0.7, 0.7, 0.46, NOGAL, P),
    B(0.46, 0.46, 0.46, 0.54, 0.54, 0.74, NOGAL),
  ];
  // La esfera, en capas, de azul de noche (el tono), con sus estrellas encendidas y la banda del zodiaco
  const cz = 1.16;
  const R = 0.36;
  for (let j = 0; j < 9; j += 1) {
    const z0 = cz - R + (j * 2 * R) / 9;
    const z1 = z0 + (2 * R) / 9;
    const m = (z0 + z1) / 2 - cz;
    const r = Math.sqrt(Math.max(0, R * R - m * m));
    out.push(...disco(0.5, 0.5, r, z0, z1, j === 4 ? shade(T, 1.3) : T, 7));
  }
  for (let k = 0; k < 22; k += 1) {
    const a = hash(k, 131) * Math.PI * 2;
    const z = cz + (hash(k, 132) - 0.5) * 1.5 * R;
    const r = Math.sqrt(Math.max(0, R * R - (z - cz) ** 2)) + 0.004;
    const x = 0.5 + Math.cos(a) * r;
    const y = 0.5 + Math.sin(a) * r;
    out.push(B(x - 0.018, y - 0.018, z - 0.018, x + 0.018, y + 0.018, z + 0.018, k % 4 ? [252, 230, 160] : [255, 250, 230], G));
  }
  out.push(...disco(0.5, 0.5, 0.46, cz - 0.03, cz + 0.01, DORADO, 11, P));
  // El meridiano: un aro de latón vertical, alrededor de la esfera, con el eje que asoma arriba y abajo
  for (let k = 0; k < 20; k += 1) {
    const a = (k / 20) * Math.PI * 2;
    const x = 0.5 + Math.cos(a) * 0.42;
    const z = cz + Math.sin(a) * 0.42;
    if (z > 0.76) out.push(B(x - 0.03, 0.47, z - 0.03, x + 0.03, 0.53, z + 0.03, DORADO, P));
  }
  out.push(B(0.48, 0.48, cz + 0.36, 0.52, 0.52, cz + 0.48, DORADO, P), B(0.48, 0.48, 0.74, 0.52, 0.52, cz - 0.34, DORADO, P), ...disco(0.5, 0.5, 0.05, cz + 0.48, cz + 0.52, DORADO, 5, P));
  return out;
};

S['vidriera-luna'] = (T) => {
  const plomo = [30, 28, 36];
  const out = [
    // El marco de piedra (el tono) y el alféizar
    B(0.2, 0, 1.2, 1.8, 0.2, 1.3, T),
    B(0.24, 0, 1.3, 0.34, 0.1, 2.7, T),
    B(1.66, 0, 1.3, 1.76, 0.1, 2.7, T),
  ];
  // El arco ojival, en escalones, y el cristal de cada fila (más estrecho hacia la punta)
  const filas = [];
  for (let z = 1.3; z < 3.3; z += 0.1) {
    const t = Math.max(0, (z - 2.6) / 0.7);
    const half = 0.66 * Math.sqrt(Math.max(0, 1 - t * t * 1.02)) - t * 0.12;
    if (half < 0.05) break;
    filas.push([z, half]);
  }
  for (const [z, half] of filas) {
    const x0 = 1.0 - half;
    const x1 = 1.0 + half;
    if (z >= 2.6) out.push(B(x0 - 0.1, 0, z, x0, 0.1, z + 0.1, T), B(x1, 0, z, x1 + 0.1, 0.1, z + 0.1, T));
    // Los vidrios: azul de noche, violeta y un filo ámbar alrededor
    for (let x = x0; x < x1 - 0.01; x += 0.12) {
      const xa = Math.min(x1, x + 0.12);
      const borde = x === x0 || xa >= x1 - 0.001 || z < 1.36;
      const c = borde ? [232, 170, 72] : hash(Math.round(x * 50), Math.round(z * 50)) > 0.72 ? [86, 60, 140] : hash(Math.round(x * 30), Math.round(z * 30)) > 0.4 ? [40, 58, 124] : [52, 76, 150];
      out.push(B(x, 0, z, xa, 0.03, z + 0.1, c, G));
    }
  }
  const tope = filas[filas.length - 1][0] + 0.1;
  out.push(B(0.96, 0, tope, 1.04, 0.1, tope + 0.12, T));
  // La red de plomo: dos parteluces y tres travesaños
  for (const x of [0.78, 1.22]) out.push(B(x - 0.015, 0, 1.3, x + 0.015, 0.05, 2.9, plomo, P));
  for (const z of [1.76, 2.24, 2.72]) out.push(B(0.34, 0, z - 0.015, 1.66, 0.05, z + 0.015, plomo, P));
  // La luna creciente y sus estrellas, en vidrio claro, en lo alto
  for (const [x, z, w] of [
    [0.9, 2.44, 0.06],
    [0.86, 2.5, 0.06],
    [0.84, 2.56, 0.06],
    [0.86, 2.62, 0.06],
    [0.9, 2.68, 0.06],
    [0.96, 2.42, 0.06],
    [0.96, 2.7, 0.06],
  ])
    out.push(B(x, 0.03, z, x + w, 0.045, z + 0.06, [250, 238, 196], G));
  for (const [x, z] of [
    [1.16, 2.56],
    [1.3, 2.4],
    [1.08, 2.9],
    [0.62, 2.14],
    [1.4, 1.9],
    [0.6, 1.6],
  ])
    out.push(B(x, 0.03, z, x + 0.05, 0.045, z + 0.05, [255, 248, 220], G), B(x - 0.02, 0.03, z + 0.015, x + 0.07, 0.042, z + 0.035, [255, 236, 190], G));
  // En el alféizar, un candelero con su vela
  out.push(B(1.4, 0.06, 1.3, 1.56, 0.18, 1.34, DORADO, P), ...vela(1.48, 0.12, 1.34, 0.2));
  return out;
};

/** Las placas de los talleres nuevos: la misma pieza que las demás (furniture.js la copia de la de la suite). */
export const TALLERES_COLECCIONES = ['lumbre', 'invernadero', 'octubre', 'medianoche'];
