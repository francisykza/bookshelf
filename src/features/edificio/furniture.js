// Formas de los muebles de «El edificio del puerto» (1.63, SPEC §63), hechas solo con cajas para que se
// puedan girar de cuarto en cuarto sin redibujarlas. Coordenadas locales: en el suelo, `x` a lo ancho (0..w), `y` a lo
// hondo (0..d; el frente del mueble mira a y = d) y `z` hacia arriba; en la pared, `x` a lo largo de la pared, `y` hacia
// fuera de ella y `z` hacia arriba. Cada caja: { b: [x0, y0, z0, x1, y1, z1], c: [r, g, b], glow, grain }. `glow`:
// la parte que se enciende de tarde (pantallas de lámpara, la ventanita de la estufa, las bombillas).
// Geometría provisional, sin recursos de imagen (ver docs/qa/edificio-puerto.md).
import { hash } from '../minigames/libreria-puerto/raster';

const WOOD = [150, 98, 60];
const WOOD_DARK = [110, 70, 46];
const LATON = [196, 156, 76];
const CREAM = [236, 226, 200];
const LEAF = [96, 126, 82];
const LEAF_LIGHT = [136, 160, 100];
const IRON = [64, 60, 66];
const FIRE = [255, 176, 92];
const SEA = [78, 120, 146];
const SKY = [236, 214, 186];
const SUN = [255, 236, 196];
const SPINES = [[150, 66, 52], [72, 96, 120], [118, 136, 100], [204, 158, 70], [96, 70, 98], [184, 98, 70], [226, 208, 172]];

const shade = (c, k) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
const B = (x0, y0, z0, x1, y1, z1, c, extra = {}) => ({ b: [x0, y0, z0, x1, y1, z1], c, ...extra });

function legs(w, d, h, c, inset = 0.12, size = 0.14) {
  return [
    B(inset, inset, 0, inset + size, inset + size, h, c),
    B(w - inset - size, inset, 0, w - inset, inset + size, h, c),
    B(inset, d - inset - size, 0, inset + size, d - inset, h, c),
    B(w - inset - size, d - inset - size, 0, w - inset, d - inset, h, c),
  ];
}

/** Hojas: un puñado de cajitas repartidas en una copa redondeada (siempre las mismas para la misma planta). */
function leaves(cx, cy, z0, z1, r, n, seed) {
  const out = [];
  for (let k = 0; k < n; k += 1) {
    const a = hash(k + seed, 1) * Math.PI * 2;
    const t = hash(k + seed, 3);
    const z = z0 + t * (z1 - z0);
    const d = Math.sqrt(hash(k + seed, 2)) * r * (1 - 0.45 * t);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const s = 0.11 + hash(k + seed, 5) * 0.06;
    out.push(B(x - s, y - s, z - s * 0.8, x + s, y + s, z + s * 0.8, hash(k + seed, 4) > 0.55 ? LEAF_LIGHT : LEAF, { step: 0.05 }));
  }
  return out;
}

function armchair(w, T) {
  const light = shade(T, 1.12);
  const dark = shade(T, 0.86);
  const x1 = w - 0.15;
  return [
    ...legs(w, 2, 0.22, WOOD_DARK, 0.2, 0.12),
    B(0.15, 0.25, 0.22, x1, 1.85, 0.7, T),
    B(0.15, 0.2, 0.7, x1, 0.62, 1.75, dark),
    B(0.15, 0.62, 0.7, 0.55, 1.85, 1.12, T),
    B(x1 - 0.4, 0.62, 0.7, x1, 1.85, 1.12, T),
    B(0.55, 0.62, 0.7, x1 - 0.4, 1.82, 0.92, light),
  ];
}

function bookcase(T) {
  const out = [B(0, 0, 0, 2, 0.14, 3.4, shade(T, 0.78)), B(0, 0, 0, 0.14, 1, 3.4, T), B(1.86, 0, 0, 2, 1, 3.4, T)];
  for (const z of [0, 1.1, 2.2, 3.26]) out.push(B(0.14, 0, z, 1.86, 1, z + 0.14, T));
  // Libros en las dos baldas de abajo y uno tumbado arriba (colores fijos, como lomos de verdad)
  let k = 0;
  for (const z of [0.14, 1.24, 2.34]) {
    let x = 0.2;
    while (x < 1.75) {
      const t = 0.12 + hash(k, 7) * 0.1;
      const h = 0.6 + hash(k, 8) * 0.28;
      if (x + t > 1.8) break;
      if (z > 2 && hash(k, 9) > 0.6) {
        out.push(B(x, 0.25, z, Math.min(1.8, x + 0.75), 0.85, z + 0.13, SPINES[k % SPINES.length]));
        x += 0.82;
      } else {
        out.push(B(x, 0.25, z, x + t - 0.02, 0.88, z + h, SPINES[k % SPINES.length]));
        x += t;
      }
      k += 1;
    }
  }
  return out;
}

const SHAPES = {
  sillon: (T) => armchair(2, T),
  sofa: (T) => armchair(3, T).concat([B(1.48, 0.64, 0.92, 1.52, 1.8, 0.94, shade(T, 0.9))]),
  silla: (T) => [...legs(1, 1, 0.72, T, 0.14, 0.1), B(0.12, 0.12, 0.72, 0.88, 0.88, 0.82, T), B(0.14, 0.12, 0.82, 0.24, 0.24, 1.8, T), B(0.76, 0.12, 0.82, 0.86, 0.24, 1.8, T), B(0.14, 0.12, 1.45, 0.86, 0.22, 1.75, shade(T, 1.08))],
  banco: (T) => [B(0.25, 0.22, 0, 0.45, 0.78, 0.56, shade(T, 0.8)), B(1.55, 0.22, 0, 1.75, 0.78, 0.56, shade(T, 0.8)), B(0.05, 0.15, 0.56, 1.95, 0.85, 0.7, T)],
  'mesa-baja': (T) => [...legs(2, 1, 0.55, shade(T, 0.85), 0.15, 0.12), B(0.1, 0.1, 0.55, 1.9, 0.9, 0.7, T)],
  mesa: (T) => [...legs(2, 2, 1.1, shade(T, 0.85), 0.2, 0.14), B(0.08, 0.08, 1.1, 1.92, 1.92, 1.25, T)],
  mesilla: (T) => [B(0.1, 0.1, 0, 0.9, 0.9, 0.9, T), B(0.16, 0.88, 0.5, 0.84, 0.9, 0.52, shade(T, 0.75)), B(0.42, 0.9, 0.62, 0.58, 0.94, 0.7, LATON)],
  estanteria: (T) => bookcase(T),
  cama: (T) => [
    B(0, 0, 0, 3, 4, 0.5, WOOD),
    B(0, 0, 0, 3, 0.25, 1.9, WOOD_DARK),
    B(0.1, 0.25, 0.5, 2.9, 3.9, 0.85, CREAM),
    B(0.08, 1.4, 0.5, 2.92, 3.95, 0.98, T),
    B(0.08, 1.4, 0.98, 2.92, 1.7, 1.02, shade(T, 1.12)),
    B(0.35, 0.35, 0.85, 1.35, 1.1, 1.15, shade(CREAM, 1.05)),
    B(1.65, 0.35, 0.85, 2.65, 1.1, 1.15, shade(CREAM, 1.05)),
  ],
  'lampara-pie': (T) => [B(0.3, 0.3, 0, 0.7, 0.7, 0.1, LATON), B(0.46, 0.46, 0.1, 0.54, 0.54, 2.2, LATON, { grain: 0 }), B(0.2, 0.2, 2.2, 0.8, 0.8, 2.8, T, { glow: true })],
  estufa: (T) => [
    B(0.22, 0.25, 0, 0.32, 0.35, 0.18, T),
    B(0.68, 0.25, 0, 0.78, 0.35, 0.18, T),
    B(0.15, 0.2, 0.18, 0.85, 0.85, 1.15, T),
    B(0.3, 0.85, 0.35, 0.7, 0.88, 0.8, FIRE, { glow: true, grain: 0 }),
    B(0.12, 0.17, 1.15, 0.88, 0.88, 1.22, shade(T, 1.2)),
    B(0.4, 0.35, 1.22, 0.6, 0.55, 3.4, shade(T, 0.9), { grain: 0 }),
    B(0.2, 0.86, 0.2, 0.8, 1, 0.26, IRON),
  ],
  'lampara-mesa': (T) => [B(0.35, 0.35, 0, 0.65, 0.65, 0.08, LATON), B(0.46, 0.46, 0.08, 0.54, 0.54, 0.55, LATON, { grain: 0 }), B(0.22, 0.22, 0.55, 0.78, 0.78, 1.0, T, { glow: true })],
  'planta-grande': (T) => [B(0.22, 0.22, 0, 0.78, 0.78, 0.7, T), B(0.18, 0.18, 0.62, 0.82, 0.82, 0.74, shade(T, 1.1)), ...leaves(0.5, 0.5, 0.85, 2.3, 0.5, 34, 11)],
  'planta-pequena': (T) => [B(0.32, 0.32, 0, 0.68, 0.68, 0.32, T), ...leaves(0.5, 0.5, 0.42, 0.85, 0.28, 12, 40)],
  libros: (T) => [B(0.18, 0.28, 0, 0.84, 0.76, 0.13, T), B(0.22, 0.24, 0.13, 0.8, 0.72, 0.25, SPINES[2]), B(0.2, 0.3, 0.25, 0.78, 0.78, 0.35, SPINES[3]), B(0.3, 0.36, 0.35, 0.62, 0.66, 0.52, CREAM)],
  radio: (T) => [B(0.12, 0.3, 0, 0.88, 0.76, 0.5, T), B(0.2, 0.75, 0.12, 0.58, 0.77, 0.4, shade(CREAM, 0.9), { grain: 0 }), B(0.66, 0.75, 0.2, 0.78, 0.8, 0.32, LATON), B(0.3, 0.45, 0.5, 0.34, 0.49, 0.85, IRON, { grain: 0 })],
  tetera: (T) => [B(0.3, 0.3, 0, 0.7, 0.7, 0.34, T), B(0.4, 0.4, 0.34, 0.6, 0.6, 0.4, shade(T, 1.1)), B(0.46, 0.46, 0.4, 0.54, 0.54, 0.45, LATON), B(0.46, 0.7, 0.12, 0.54, 0.86, 0.28, T), B(0.46, 0.18, 0.14, 0.54, 0.3, 0.3, shade(T, 0.9))],
  gato: (T) => [
    B(0.06, 0.1, 0, 0.94, 0.94, 0.1, [168, 84, 62]),
    B(0.18, 0.22, 0.1, 0.82, 0.78, 0.46, T),
    B(0.5, 0.48, 0.1, 0.9, 0.88, 0.42, T),
    B(0.54, 0.58, 0.42, 0.62, 0.66, 0.54, T, { grain: 0 }),
    B(0.76, 0.58, 0.42, 0.84, 0.66, 0.54, T, { grain: 0 }),
    B(0.2, 0.78, 0.1, 0.62, 0.9, 0.2, shade(T, 1.15)),
  ],
  // Pared: x a lo largo, y hacia fuera
  ventana: (T) => [
    B(0.2, 0, 1.5, 1.8, 0.03, 2.15, SEA, { grain: 0 }),
    B(0.2, 0, 2.15, 1.8, 0.03, 3.2, SKY, { grain: 0 }),
    B(0.75, 0, 2.3, 1.05, 0.05, 2.55, SUN, { grain: 0 }),
    B(0.12, 0, 1.42, 1.88, 0.14, 1.52, T),
    B(0.12, 0, 3.18, 1.88, 0.14, 3.28, T),
    B(0.12, 0, 1.42, 0.22, 0.14, 3.28, T),
    B(1.78, 0, 1.42, 1.88, 0.14, 3.28, T),
    B(0.96, 0, 1.52, 1.04, 0.1, 3.18, T),
    B(0.22, 0, 2.5, 1.78, 0.1, 2.56, T),
    B(0.04, 0, 1.3, 1.96, 0.34, 1.42, T),
  ],
  cuadro: (T) => [
    B(0.25, 0, 2.0, 1.75, 0.08, 2.95, T),
    B(0.36, 0, 2.11, 1.64, 0.1, 2.42, SEA, { grain: 0 }),
    B(0.36, 0, 2.42, 1.64, 0.1, 2.84, SKY, { grain: 0 }),
    B(0.7, 0, 2.3, 1.3, 0.12, 2.42, [168, 84, 62], { grain: 0 }),
    B(0.98, 0, 2.42, 1.02, 0.12, 2.78, WOOD_DARK, { grain: 0 }),
    B(0.72, 0, 2.46, 0.96, 0.12, 2.72, CREAM, { grain: 0 }),
  ],
  reloj: (T) => [B(0.2, 0, 2.35, 0.8, 0.1, 3.15, T), B(0.3, 0, 2.6, 0.7, 0.13, 3.0, CREAM, { grain: 0 }), B(0.48, 0, 2.78, 0.52, 0.15, 2.96, IRON, { grain: 0 }), B(0.5, 0, 2.78, 0.64, 0.15, 2.82, IRON, { grain: 0 }), B(0.45, 0, 2.38, 0.55, 0.12, 2.55, LATON)],
  guirnalda: (T) => {
    const out = [];
    for (let k = 0; k < 9; k += 1) {
      const x = 0.15 + k * 0.33;
      const sag = 0.18 * Math.sin((k / 8) * Math.PI);
      out.push(B(x, 0, 3.62 - sag, x + 0.06, 0.06, 3.68 - sag, IRON, { grain: 0 }));
      out.push(B(x - 0.05, 0.02, 3.46 - sag, x + 0.11, 0.18, 3.6 - sag, k % 2 ? T : CREAM, { glow: true, grain: 0 }));
    }
    return out;
  },
};

/** Cajas de un mueble en coordenadas locales (sin girar). */
export function shapeOf(id, tono) {
  const fn = SHAPES[id];
  return fn ? fn(tono) : [];
}

export const shadeColor = shade;
