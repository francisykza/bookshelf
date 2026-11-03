// Tu personaje en el piso (1.69, SPEC §69; decisión de Francisco del 1-11-2026): un personaje propio, de cajas como
// los muebles, que se dibuja con el mismo motor. Se personaliza (piel, pelo, ropa, gafas), se guarda en el servidor
// y lo ven los vecinos al visitar tu piso. Tocas el suelo y va andando; tocas un asiento y se sienta (en la cama se
// tumba); si no lo tocas, pasea solo de vez en cuando. Aquí solo hay datos y cálculo (sin DOM): el aspecto y su
// validación (la misma que `piso_personaje_valido` en el servidor), las cajas de cada pose y los caminos por el suelo.
import { catalogItem } from './catalog';
import { ROOM, rectOf } from './room';

export const PIELES = [
  { id: 0, nombre: 'Muy clara', color: [250, 216, 184] },
  { id: 1, nombre: 'Clara', color: [236, 192, 152] },
  { id: 2, nombre: 'Media', color: [206, 152, 110] },
  { id: 3, nombre: 'Morena', color: [162, 108, 74] },
  { id: 4, nombre: 'Oscura', color: [112, 74, 50] },
];
export const PELOS = [
  { id: 'corto', nombre: 'Corto' },
  { id: 'melena', nombre: 'Melena' },
  { id: 'mono', nombre: 'Moño' },
  { id: 'rizos', nombre: 'Rizos' },
  { id: 'largo', nombre: 'Largo' },
  { id: 'rapado', nombre: 'Rapado' },
];
export const COLORES_PELO = [
  { id: 0, nombre: 'Castaño oscuro', color: [70, 46, 32] },
  { id: 1, nombre: 'Castaño', color: [126, 80, 48] },
  { id: 2, nombre: 'Rubio', color: [214, 172, 98] },
  { id: 3, nombre: 'Pelirrojo', color: [184, 84, 48] },
  { id: 4, nombre: 'Negro', color: [42, 38, 44] },
  { id: 5, nombre: 'Canoso', color: [204, 202, 206] },
  // Se ganan con las misiones del día (§70)
  { id: 6, nombre: 'Rosa pastel', color: [222, 160, 176] },
  { id: 7, nombre: 'Azul noche', color: [58, 72, 112] },
];
export const JERSEYS = [
  { id: 0, nombre: 'Salvia', color: [128, 150, 112] },
  { id: 1, nombre: 'Terracota', color: [184, 98, 70] },
  { id: 2, nombre: 'Mostaza', color: [204, 158, 70] },
  { id: 3, nombre: 'Azul', color: [86, 112, 142] },
  { id: 4, nombre: 'Rosa', color: [206, 144, 140] },
  { id: 5, nombre: 'Crema', color: [232, 218, 190] },
  { id: 6, nombre: 'Ciruela', color: [110, 74, 104] },
  { id: 7, nombre: 'Pizarra', color: [72, 78, 92] },
  // Se ganan con las misiones del día (§70)
  { id: 8, nombre: 'Verde bosque', color: [62, 98, 72] },
  { id: 9, nombre: 'Cereza', color: [150, 50, 58] },
  { id: 10, nombre: 'Lavanda', color: [160, 146, 190] },
  { id: 11, nombre: 'Mar', color: [52, 104, 120] },
  // 1.78 (encargo del 3-11-2026): otra tanda, también de las misiones del día; el 14 es del conjunto «Noche estrellada»
  { id: 12, nombre: 'Coral', color: [222, 124, 104] },
  { id: 13, nombre: 'Turquesa', color: [72, 160, 156] },
  { id: 14, nombre: 'Noche estrellada', color: [42, 50, 92] },
];
export const PANTALONES = [
  { id: 0, nombre: 'Vaquero', color: [72, 88, 116] },
  { id: 1, nombre: 'Negro', color: [56, 50, 56] },
  { id: 2, nombre: 'Beis', color: [176, 150, 112] },
  { id: 3, nombre: 'Oliva', color: [98, 110, 80] },
  { id: 4, nombre: 'Pana', color: [122, 74, 48] },
  // Se ganan con las misiones del día (§70)
  { id: 5, nombre: 'Teja', color: [160, 86, 60] },
  { id: 6, nombre: 'Gris perla', color: [168, 168, 172] },
  // 1.78: el 8 es del conjunto «Noche estrellada»
  { id: 7, nombre: 'Burdeos', color: [112, 44, 56] },
  { id: 8, nombre: 'Medianoche', color: [34, 38, 66] },
];
// Complementos (§70): todos menos «ninguno» se ganan con las misiones del día
export const COMPLEMENTOS = [
  { id: 'ninguno', nombre: 'Ninguno' },
  { id: 'bufanda', nombre: 'Bufanda' },
  { id: 'gorro', nombre: 'Gorro de lana' },
  { id: 'boina', nombre: 'Boina' },
  { id: 'auriculares', nombre: 'Auriculares' },
  { id: 'flor', nombre: 'Flor en el pelo' },
  // 1.78: dos más y la capa del conjunto «Noche estrellada», que deja un polvo de estrellas a tu alrededor (misticos.js)
  { id: 'sombrero', nombre: 'Sombrero de paja' },
  { id: 'gorra', nombre: 'Gorra marinera' },
  { id: 'capa', nombre: 'Capa de estrellas' },
];

/**
 * Las prendas que se ganan, en el orden en que llegan (una por cada día con las tres misiones hechas; §70). La misma
 * lista que `piso_prendas_orden` en el servidor. Cada una es «clave:valor» del aspecto.
 */
export const PRENDAS = [
  'complemento:bufanda', 'jersey:8', 'complemento:gorro', 'pantalon:5', 'colorPelo:6', 'jersey:9', 'complemento:boina', 'jersey:10', 'pantalon:6', 'complemento:auriculares', 'colorPelo:7', 'jersey:11', 'complemento:flor',
  // 1.78: la tanda nueva, después de las de antes (lo ya ganado no cambia); el conjunto «Noche estrellada» llega al final
  'jersey:12', 'complemento:sombrero', 'pantalon:7', 'jersey:13', 'complemento:gorra', 'jersey:14', 'pantalon:8', 'complemento:capa',
];
/** El conjunto con efectos (1.78): con las tres piezas puestas, las estrellas del jersey y la capa brillan más. */
export const CONJUNTO_ESTRELLAS = { jersey: 14, pantalon: 8, complemento: 'capa' };
const LISTS = { colorPelo: () => COLORES_PELO, jersey: () => JERSEYS, pantalon: () => PANTALONES, complemento: () => COMPLEMENTOS };
export const prendaKey = (key, value) => `${key}:${value}`;
export const isPrenda = (key, value) => PRENDAS.includes(prendaKey(key, value));
/** El nombre de una prenda que se gana (para los avisos). */
export function prendaNombre(prenda) {
  const [key, raw] = prenda.split(':');
  const value = key === 'complemento' ? raw : Number(raw);
  const item = LISTS[key]?.().find((x) => x.id === value);
  if (!item) return prenda;
  const lower = item.nombre.toLowerCase();
  return key === 'jersey' ? `Jersey ${lower}` : key === 'pantalon' ? `Pantalón ${lower}` : key === 'colorPelo' ? `Pelo ${lower}` : item.nombre;
}
/** ¿Lleva algo que no tienes? (`prendas`: las que has ganado). */
export const usesLocked = (a, prendas) => Object.entries(a).some(([k, v]) => isPrenda(k, v) && !prendas.includes(prendaKey(k, v)));

export const DEFAULT_AVATAR = { piel: 1, pelo: 'melena', colorPelo: 1, jersey: 0, pantalon: 0, gafas: false, complemento: 'ninguno' };

const inRange = (v, list) => Number.isInteger(v) && v >= 0 && v < list.length;

/** El aspecto limpio, o null si no vale (lo mismo que comprueba el servidor). */
export function validateAvatar(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
  const keys = Object.keys(DEFAULT_AVATAR);
  if (Object.keys(a).some((k) => !keys.includes(k))) return null;
  const out = { ...DEFAULT_AVATAR, ...a };
  if (!inRange(out.piel, PIELES) || !PELOS.some((p) => p.id === out.pelo) || !inRange(out.colorPelo, COLORES_PELO)) return null;
  if (!inRange(out.jersey, JERSEYS) || !inRange(out.pantalon, PANTALONES) || typeof out.gafas !== 'boolean') return null;
  if (!COMPLEMENTOS.some((c) => c.id === out.complemento)) return null;
  return out;
}

// ── Formas ──
const shade = (c, k) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
const B = (x0, y0, z0, x1, y1, z1, c, extra = {}) => ({ b: [x0, y0, z0, x1, y1, z1], c, ...extra });
const SHOES = [64, 50, 44];
const INK = [44, 30, 26];
const GLASS = [214, 228, 232];
const BLUSH = [232, 150, 130];

/** El pelo de cada peinado, sobre la cabeza (x ±0,25, fondo de -0,22 a 0,24, de 1,45 a 1,95). */
function hair(style, H) {
  const L = shade(H, 1.14);
  const cap = B(-0.27, -0.24, 1.86, 0.27, 0.26, 2.0, H);
  const fringe = B(-0.25, 0.24, 1.84, 0.25, 0.27, 1.9, L, { grain: 0 });
  const back = (z0) => B(-0.27, -0.25, z0, 0.27, -0.12, 1.95, H);
  // Los lados no pasan de las orejas: de tres cuartos taparían la cara
  const sides = (z0) => [B(-0.29, -0.24, z0, -0.24, 0.06, 1.95, H), B(0.24, -0.24, z0, 0.29, 0.06, 1.95, H)];
  switch (style) {
    case 'rapado':
      return [B(-0.255, -0.225, 1.9, 0.255, 0.245, 1.97, H, { grain: 0 }), B(-0.255, -0.225, 1.62, 0.255, -0.2, 1.95, H, { grain: 0 })];
    case 'corto':
      return [cap, fringe, back(1.62), B(-0.27, -0.24, 1.7, -0.24, 0.1, 1.95, H), B(0.24, -0.24, 1.7, 0.27, 0.1, 1.95, H)];
    case 'mono':
      return [cap, fringe, back(1.6), ...sides(1.72), B(-0.11, -0.3, 1.98, 0.11, -0.06, 2.2, L)];
    case 'rizos': {
      const out = [B(-0.31, -0.28, 1.8, 0.31, 0.27, 2.06, H), back(1.48), ...sides(1.5)];
      for (const [x, y, z] of [[-0.2, 0, 2.06], [0.05, 0, 2.08], [0.22, 0, 2.04], [-0.3, -0.12, 1.62], [0.3, -0.12, 1.66]]) out.push(B(x - 0.08, y - 0.12, z - 0.06, x + 0.08, y + 0.1, z + 0.06, L));
      out.push(B(-0.25, 0.24, 1.82, 0.25, 0.28, 1.9, L));
      return out;
    }
    case 'largo':
      return [cap, fringe, B(-0.28, -0.27, 1.0, 0.28, -0.13, 1.95, H), ...sides(1.2)];
    case 'melena':
    default:
      return [cap, fringe, back(1.5), ...sides(1.52)];
  }
}

/**
 * Cajas del personaje de pie, mirando a +y (el frente) y con el centro de los pies en (0, 0). `step`: 0, 1 o 2 (quieto
 * o una zancada a cada lado al andar).
 */
function standing(a, step = 0) {
  const skin = PIELES[a.piel].color;
  const top = JERSEYS[a.jersey].color;
  const legs = PANTALONES[a.pantalon].color;
  const H = COLORES_PELO[a.colorPelo].color;
  const s = step === 1 ? 0.09 : step === 2 ? -0.09 : 0;
  const out = [
    // Piernas y zapatos (al andar, una adelante y otra atrás)
    B(-0.2, -0.09 + s, 0.1, -0.03, 0.09 + s, 0.72, legs),
    B(0.03, -0.09 - s, 0.1, 0.2, 0.09 - s, 0.72, legs),
    B(-0.21, -0.09 + s, 0, -0.02, 0.14 + s, 0.12, SHOES, { grain: 0 }),
    B(0.02, -0.09 - s, 0, 0.21, 0.14 - s, 0.12, SHOES, { grain: 0 }),
    // Jersey de punto, con el cuello vuelto en un tono más claro
    B(-0.26, -0.14, 0.7, 0.26, 0.14, 1.42, top),
    B(-0.2, -0.1, 1.38, 0.2, 0.12, 1.47, shade(top, 1.12), { grain: 0 }),
    // Brazos (se balancean al revés que las piernas) y manos
    B(-0.37, -0.09 - s, 0.86, -0.26, 0.09 - s, 1.4, top),
    B(0.26, -0.09 + s, 0.86, 0.37, 0.09 + s, 1.4, top),
    B(-0.36, -0.07 - s, 0.74, -0.27, 0.07 - s, 0.86, skin, { grain: 0 }),
    B(0.27, -0.07 + s, 0.74, 0.36, 0.07 + s, 0.86, skin, { grain: 0 }),
    ...starryTop(a, s),
  ];
  return out.concat(head(a, skin, H));
}

const STAR = [255, 226, 140];
/** Las estrellitas del jersey «Noche estrellada» (en el pecho y las mangas; se encienden de tarde). */
function starryTop(a, s = 0) {
  if (a.jersey !== 14) return [];
  const g = { grain: 0, glow: true };
  return [[-0.16, 1.2], [0.1, 1.3], [-0.04, 1.02], [0.17, 0.92], [-0.19, 0.84]]
    .map(([x, z]) => B(x - 0.025, 0.14, z - 0.025, x + 0.025, 0.155, z + 0.025, STAR, g))
    .concat([B(-0.34, 0.09 - s, 1.12, -0.3, 0.1 - s, 1.16, STAR, g), B(0.3, 0.09 + s, 1.0, 0.34, 0.1 + s, 1.04, STAR, g)]);
}

/** La cabeza con la cara (ojos, mofletes, boca y, si las lleva, gafas redondas) y el pelo. */
function head(a, skin, H) {
  const out = [B(-0.25, -0.22, 1.45, 0.25, 0.24, 1.95, skin, { grain: 0, step: 0.025 })];
  const f = { grain: 0, step: 0.015 };
  for (const x of [-0.11, 0.11]) {
    if (a.gafas) {
      out.push(B(x - 0.085, 0.24, 1.6, x + 0.085, 0.262, 1.77, INK, f));
      out.push(B(x - 0.05, 0.24, 1.635, x + 0.05, 0.27, 1.735, GLASS, f));
    }
    out.push(B(x - 0.025, 0.24, 1.65, x + 0.025, 0.275, 1.72, INK, f));
  }
  if (a.gafas) out.push(B(-0.03, 0.24, 1.7, 0.03, 0.262, 1.72, INK, f));
  out.push(B(-0.2, 0.24, 1.56, -0.13, 0.262, 1.6, BLUSH, f), B(0.13, 0.24, 1.56, 0.2, 0.262, 1.6, BLUSH, f));
  out.push(B(-0.05, 0.24, 1.52, 0.05, 0.262, 1.545, [168, 82, 66], f));
  return out.concat(hair(a.pelo, H), extra(a.complemento));
}

/** Los complementos (§70), sobre la figura de pie. */
function extra(id) {
  const f = { grain: 0 };
  switch (id) {
    case 'bufanda': {
      const c = [170, 58, 52];
      return [B(-0.24, -0.16, 1.36, 0.24, 0.19, 1.52, c), B(0.06, 0.15, 1.02, 0.17, 0.21, 1.4, shade(c, 0.9)), B(0.06, 0.15, 0.98, 0.17, 0.21, 1.03, [226, 208, 172], f)];
    }
    case 'gorro': {
      const c = [96, 118, 150];
      return [B(-0.29, -0.27, 1.86, 0.29, 0.27, 2.1, c), B(-0.3, -0.28, 1.82, 0.3, 0.28, 1.9, shade(c, 1.15)), B(-0.07, -0.07, 2.1, 0.07, 0.07, 2.24, [232, 220, 196])];
    }
    case 'boina':
      return [B(-0.31, -0.29, 1.94, 0.31, 0.25, 2.06, [64, 54, 64]), B(-0.02, -0.02, 2.06, 0.02, 0.02, 2.1, [64, 54, 64], f)];
    case 'auriculares': {
      const band = [52, 50, 58];
      const cup = [200, 92, 80];
      return [B(-0.3, -0.05, 1.98, 0.3, 0.05, 2.06, band, f), B(-0.33, -0.05, 1.8, -0.29, 0.05, 2.0, band, f), B(0.29, -0.05, 1.8, 0.33, 0.05, 2.0, band, f), B(-0.35, -0.1, 1.6, -0.27, 0.1, 1.8, cup), B(0.27, -0.1, 1.6, 0.35, 0.1, 1.8, cup)];
    }
    case 'flor':
      return [B(0.18, 0.04, 1.84, 0.32, 0.18, 1.98, [232, 140, 160], f), B(0.23, 0.17, 1.89, 0.27, 0.19, 1.93, [236, 196, 92], f)];
    case 'sombrero': {
      const c = [222, 192, 120];
      return [B(-0.42, -0.4, 1.9, 0.42, 0.42, 1.95, c), B(-0.27, -0.25, 1.95, 0.27, 0.27, 2.14, shade(c, 1.06)), B(-0.28, -0.26, 1.95, 0.28, 0.28, 2.0, [176, 82, 66], f)];
    }
    case 'gorra': {
      const c = [236, 232, 222];
      return [B(-0.28, -0.26, 1.88, 0.28, 0.27, 2.08, c), B(-0.29, -0.27, 1.86, 0.29, 0.28, 1.92, [44, 52, 80]), B(-0.2, 0.27, 1.86, 0.2, 0.42, 1.9, [44, 52, 80], f), B(-0.04, 0.27, 1.96, 0.04, 0.29, 2.02, [214, 178, 80], f)];
    }
    case 'capa': {
      // A la espalda, de los hombros a las rodillas, con el cierre dorado y estrellas que se encienden de tarde
      const c = [36, 42, 82];
      const g = { grain: 0, glow: true };
      return [
        B(-0.41, -0.24, 0.5, 0.41, -0.15, 1.44, c),
        B(-0.3, -0.18, 1.4, 0.3, 0.16, 1.48, shade(c, 1.2)),
        B(-0.05, 0.15, 1.36, 0.05, 0.18, 1.44, [240, 195, 90], f),
        ...[[-0.24, 1.2], [0.12, 1.05], [-0.06, 0.8], [0.25, 0.66], [-0.28, 0.6], [0.02, 1.3]].map(([x, z]) => B(x - 0.03, -0.26, z - 0.03, x + 0.03, -0.24, z + 0.03, STAR, g)),
      ];
    }
    default:
      return [];
  }
}

/** Sentado (en un asiento a la altura `h`): las piernas hacia delante y el resto apoyado en el asiento. */
function sitting(a, h) {
  const skin = PIELES[a.piel].color;
  const top = JERSEYS[a.jersey].color;
  const legs = PANTALONES[a.pantalon].color;
  const H = COLORES_PELO[a.colorPelo].color;
  const dz = h - 0.7;
  const up = (bx) => ({ ...bx, b: [bx.b[0], bx.b[1], bx.b[2] + dz, bx.b[3], bx.b[4], bx.b[5] + dz] });
  const thighs = [B(-0.2, -0.05, h, -0.03, 0.42, h + 0.17, legs), B(0.03, -0.05, h, 0.2, 0.42, h + 0.17, legs)];
  const shins = [B(-0.2, 0.32, Math.max(0.1, h - 0.6), -0.03, 0.46, h, legs), B(0.03, 0.32, Math.max(0.1, h - 0.6), 0.2, 0.46, h, legs)];
  const feet = [B(-0.21, 0.3, Math.max(0, h - 0.7), -0.02, 0.56, Math.max(0.12, h - 0.58), SHOES, { grain: 0 }), B(0.02, 0.3, Math.max(0, h - 0.7), 0.21, 0.56, Math.max(0.12, h - 0.58), SHOES, { grain: 0 })];
  const body = [
    B(-0.26, -0.14, 0.7, 0.26, 0.14, 1.42, top),
    B(-0.2, -0.1, 1.38, 0.2, 0.12, 1.47, shade(top, 1.12), { grain: 0 }),
    // Brazos hacia las rodillas, con las manos encima
    B(-0.37, -0.09, 0.9, -0.26, 0.2, 1.4, top),
    B(0.26, -0.09, 0.9, 0.37, 0.2, 1.4, top),
    B(-0.34, 0.18, 0.86, -0.24, 0.32, 0.96, skin, { grain: 0 }),
    B(0.24, 0.18, 0.86, 0.34, 0.32, 0.96, skin, { grain: 0 }),
    ...starryTop(a),
    ...head(a, skin, H),
  ].map(up);
  return [...feet, ...shins, ...thighs, ...body];
}

/** Tumbado boca arriba (en la cama, a la altura `h`): la figura de pie, acostada con la cabeza hacia -y. */
function lying(a, h) {
  return standing(a).map((bx) => {
    const [x0, y0, z0, x1, y1, z1] = bx.b;
    // z (de los pies a la cabeza) pasa a ser -y; y (de la espalda a la cara) pasa a ser z
    return { ...bx, b: [x0, 2.0 - z1, h + (y0 + 0.28) * 0.7, x1, 2.0 - z0, h + (y1 + 0.28) * 0.7] };
  });
}

/** Gira cajas locales (frente a +y) un número de cuartos: 0 → +y, 1 → -x, 2 → -y, 3 → +x (como los muebles). */
function turn(boxes, rot) {
  const f = [(x, y) => [x, y], (x, y) => [-y, x], (x, y) => [-x, -y], (x, y) => [y, -x]][rot & 3];
  return boxes.map((bx) => {
    const [x0, y0, z0, x1, y1, z1] = bx.b;
    const p = f(x0, y0);
    const q = f(x1, y1);
    return { ...bx, b: [Math.min(p[0], q[0]), Math.min(p[1], q[1]), z0, Math.max(p[0], q[0]), Math.max(p[1], q[1]), z1] };
  });
}

/**
 * Cajas del personaje en el mundo. `state`: { x, y, facing (0..3), pose: 'stand' | 'walk' | 'sit' | 'lie', step, h }.
 */
export function actorBoxes(avatar, state) {
  let local;
  if (state.pose === 'sit') local = sitting(avatar, state.h);
  else if (state.pose === 'lie') local = lying(avatar, state.h);
  else local = standing(avatar, state.pose === 'walk' ? state.step : 0);
  return turn(local, state.facing).map((bx) => ({ ...bx, b: [bx.b[0] + state.x, bx.b[1] + state.y, bx.b[2], bx.b[3] + state.x, bx.b[4] + state.y, bx.b[5]] }));
}

// ── Asientos ──
// Dónde se sienta cada cosa, en coordenadas del mueble sin girar (frente a +y), y a qué altura; la cama, tumbado
const SEATS = {
  silla: { at: [0.5, 0.5], h: 0.82 },
  sillon: { at: [1, 1.05], h: 0.92 },
  sofa: { at: [1.5, 1.05], h: 0.92 },
  banco: { at: [1, 0.5], h: 0.7 },
  puf: { at: [0.5, 0.5], h: 0.58 },
  mecedora: { at: [0.5, 0.55], h: 0.74 },
  cama: { at: [1.5, 0.5], h: 1.0, lie: true },
};
// Hacia dónde mira un mueble girado (el frente de cada giro, en la misma clave que `facing`)
const FRONT = [0, 1, 2, 3];

export const isSeat = (id) => Boolean(SEATS[id]);

/** Dónde queda el personaje en un asiento: { x, y, h, facing, pose } en el mundo. */
export function seatOf(item) {
  const seat = SEATS[item.id];
  const cat = catalogItem(item.id);
  if (!seat || !cat) return null;
  const [lx, ly] = seat.at;
  const { w, d } = cat;
  let x = lx;
  let y = ly;
  if (item.rot === 1) [x, y] = [d - ly, lx];
  else if (item.rot === 2) [x, y] = [w - lx, d - ly];
  else if (item.rot === 3) [x, y] = [ly, w - lx];
  return { x: item.x + x, y: item.y + y, h: seat.h, facing: FRONT[item.rot ?? 0], pose: seat.lie ? 'lie' : 'sit' };
}

// ── Caminos por el suelo ──
/** Celdas ocupadas por muebles de suelo (las alfombras, lo de encima y lo de la pared no estorban). */
export function blockedCells(room) {
  const grid = new Uint8Array(ROOM.w * ROOM.d);
  for (const item of room.items) {
    if (catalogItem(item.id)?.capa !== 'suelo') continue;
    const r = rectOf(item);
    for (let y = r.y0; y < r.y1; y += 1) for (let x = r.x0; x < r.x1; x += 1) grid[y * ROOM.w + x] = 1;
  }
  return grid;
}

const inGrid = (x, y) => x >= 0 && y >= 0 && x < ROOM.w && y < ROOM.d;

/** La celda libre más cercana a (x, y), o null si no queda ninguna. */
export function nearestFree(grid, x, y) {
  let best = null;
  let bestD = Infinity;
  for (let cy = 0; cy < ROOM.d; cy += 1)
    for (let cx = 0; cx < ROOM.w; cx += 1) {
      if (grid[cy * ROOM.w + cx]) continue;
      const d = Math.hypot(cx + 0.5 - x, cy + 0.5 - y);
      if (d < bestD) {
        bestD = d;
        best = { x: cx, y: cy };
      }
    }
  return best;
}

/**
 * Camino de celda en celda (en diagonal solo si las dos de los lados están libres) de `from` a `to`. Devuelve la lista
 * de celdas sin la de salida, o null si no se llega.
 */
export function findPath(grid, from, to) {
  if (!inGrid(to.x, to.y) || grid[to.y * ROOM.w + to.x]) return null;
  const key = (x, y) => y * ROOM.w + x;
  const prev = new Int16Array(ROOM.w * ROOM.d).fill(-1);
  const start = key(from.x, from.y);
  prev[start] = start;
  const queue = [start];
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (queue.length) {
    const k = queue.shift();
    const x = k % ROOM.w;
    const y = (k / ROOM.w) | 0;
    if (x === to.x && y === to.y) break;
    for (const [dx, dy] of steps) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inGrid(nx, ny) || grid[key(nx, ny)] || prev[key(nx, ny)] !== -1) continue;
      if (dx && dy && (grid[key(nx, y)] || grid[key(x, ny)])) continue;
      prev[key(nx, ny)] = k;
      queue.push(key(nx, ny));
    }
  }
  const end = key(to.x, to.y);
  if (prev[end] === -1) return null;
  const path = [];
  for (let k = end; k !== start; k = prev[k]) path.unshift({ x: k % ROOM.w, y: (k / ROOM.w) | 0 });
  return path;
}

/** Desde qué celda libre se llega a un mueble (la de delante si se puede; si no, cualquiera pegada a él). */
export function approachCell(grid, item, from) {
  const r = rectOf(item);
  const seat = seatOf(item);
  const cands = [];
  for (let y = r.y0 - 1; y <= r.y1; y += 1)
    for (let x = r.x0 - 1; x <= r.x1; x += 1) {
      const edge = x === r.x0 - 1 || x === r.x1 || y === r.y0 - 1 || y === r.y1;
      if (!edge || !inGrid(x, y) || grid[y * ROOM.w + x]) continue;
      const corner = (x === r.x0 - 1 || x === r.x1) && (y === r.y0 - 1 || y === r.y1);
      if (corner) continue;
      const aim = seat ?? { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 };
      cands.push({ x, y, d: Math.hypot(x + 0.5 - aim.x, y + 0.5 - aim.y) + (from ? Math.hypot(x - from.x, y - from.y) * 0.05 : 0) });
    }
  cands.sort((p, q) => p.d - q.d);
  return cands;
}

/** Hacia dónde mira quien va de (x0, y0) a (x1, y1). */
export function facingOf(dx, dy, current = 0) {
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return current;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 3 : 1;
  return dy > 0 ? 0 : 2;
}
