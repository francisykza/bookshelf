// «El Gran Hotel del Puerto» (concepto en dev/hotel-concepto.html; en la app desde la 1.74, §74), un rascacielos de hotel, de noche, como edificio
// principal de la parte social abierta (conocer gente, en la línea de los hoteles sociales en píxeles; solo el género,
// nada de su arte). Mismo rasterizador y paleta que la fachada del edificio del puerto (facade.js): estuco crema con
// pilastras y filos de luz dorada al estilo art déco, retranqueos, una corona escalonada con aguja, terraza con
// guirnaldas en la azotea, salón de baile acristalado a media altura, marquesina con bombillas y la plaza del muelle
// con gente. Delante, el agua refleja las luces. `renderHotel` hace el dibujo quieto y devuelve lo que la vista
// (hotelView.js) anima encima: ventanas, aguja, bombillas, neón, cielo, agua, gente y las zonas que se tocan.
import { createRaster, hash, noise, rgb } from '../../minigames/libreria-puerto/raster.js';
import { drawLimo, LIMO_D, LIMO_L } from '../limo.js';

const S = 6;
const YAW = 0.3;
const W = 200;
const GLOW = 0x8000;
const TAG_WIN = 0x1000; // + número de ventana encendida
const TAG_SPIRE = 0x0f01;
const TAG_BULB = 0x0f02;
const TAG_LIMO = 0x0f03; // la carrocería de la limusina, para perfilarla
const TD = 6; // fondo de la torre
const QUAY = TD + 4.6; // donde acaba la plaza y empieza el agua
const SPIRE = 53;
const U = 8; // lo que sube todo lo que está por encima del fuste

const CREAM = [232, 214, 178];
const GOLD = [240, 196, 104];
const STONE = [150, 138, 128];
const GLASS = [44, 52, 86];
const MUSTARD = [226, 186, 78];
const ROOF = [176, 98, 72];
const BRICK = [168, 104, 92];
const IRON = [52, 48, 56];
const COBBLE = [132, 124, 120];
const WATER = [26, 44, 74];
const LEAF = [70, 112, 78];
const RED = [176, 52, 48];
const WHITE = [240, 232, 214];
const LAMP = [255, 222, 156];
const WINDOWS = [
  [255, 214, 140],
  [255, 198, 122],
  [250, 232, 182],
  [246, 172, 132],
  [214, 204, 250],
];
const CLOTHES = [
  [214, 120, 88],
  [118, 138, 104],
  [96, 120, 170],
  [226, 186, 78],
  [180, 110, 150],
  [236, 226, 206],
];
const SKIN = [[236, 196, 160], [196, 140, 100], [140, 92, 64]];

// Letra de píxeles propia para el rótulo
const GLYPHS = {
  G: ['###', '#..', '#.#', '#.#', '###'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  E: ['###', '#..', '##.', '#..', '###'],
  L: ['#..', '#..', '#..', '#..', '###'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
};

function frame() {
  const probe = createRaster({ W: 1, H: 1, S, yaw: YAW, ox: 0, oy: 0 });
  const c = probe.project(5, TD / 2, 0);
  const top = probe.project(5, 2.9, SPIRE);
  const bottom = probe.project(5, QUAY + 9, 0);
  const ox = Math.round(W / 2 - c.sx);
  const oy = Math.round(16 - top.sy);
  return { ox, oy, H: Math.ceil(bottom.sy - top.sy) + 16 };
}

export function renderHotel() {
  const F = frame();
  const H = F.H;
  const r = createRaster({ W, H, S, yaw: YAW, ox: F.ox, oy: F.oy });
  r.clear(0);
  const water = new Uint8Array(W * H);
  const glow = new Uint8Array(W * H);
  const lights = [];
  const light = (x, y, z, radius, color = [255, 200, 130]) => lights.push({ ...r.project(x, y, z), radius, color });
  const lit = (fn) => {
    r.setId(GLOW);
    fn();
    r.setId(0);
  };

  // Plaza de adoquines, el borde del muelle y el agua
  const cobble = r.rampOf(COBBLE);
  const stone = r.rampOf(STONE);
  r.floor((x, y, ix, iy) => {
    if (y < -3) return 0;
    if (y > QUAY + 0.4) {
      water[iy * W + ix] = 1;
      return r.rampOf(WATER)[2];
    }
    if (y > QUAY) return stone[(x * 1.6) % 1 < 0.08 ? 1 : 3];
    const cy = Math.floor(y * 2.4);
    const cx = Math.floor(x * 2 + (cy % 2) * 0.5);
    const seam = (x * 2 + (cy % 2) * 0.5) % 1 < 0.12 || (y * 2.4) % 1 < 0.14;
    // Un círculo de baldosas claras delante de la puerta, como una rosa de los vientos
    const dx = x - 5;
    const dy = y - (TD + 2.9);
    if (dx * dx + dy * dy * 1.6 < 2.2) return stone[(Math.atan2(dy, dx) * 4) % 1.6 < 0.8 ? 4 : 3];
    return cobble[Math.max(0, Math.min(4, Math.floor(3 + (hash(cx, cy) - 0.5) * 1.2 - (seam ? 1.3 : 0))))];
  });

  const cream = r.rampOf(CREAM);
  const towerFace = (f, a, b) => {
    if (f === 'top') return r.rampOf(ROOF)[(a * 2) % 1 < 0.1 || (b * 2) % 1 < 0.1 ? 1 : 2];
    if (f === 'side') return cream[(b * 0.95) % 1 < 0.07 ? 0 : 1];
    // Frente: impostas finas cada planta
    return cream[(b - 5) % 1.05 < 0.08 ? 2 : 3];
  };

  // Basamento de dos alturas, en piedra
  r.box(-0.6, -0.2, 0, 10.6, TD + 0.3, 5, STONE, {
    grain: 0,
    step: 0.09,
    face: (f, a, b) => (f === 'top' ? stone[2] : stone[f === 'side' ? 1 : (b % 0.6 < 0.06 || a % 1.4 < 0.05 ? 2 : 3)]),
  });
  r.box(-0.75, -0.3, 4.9, 10.75, TD + 0.45, 5.15, WHITE, { grain: 0, step: 0.09 });

  // Fuste principal, retranqueos y corona
  r.box(0, 0, 5.15, 10, TD, 22 + U, CREAM, { grain: 0, step: 0.09, face: towerFace });
  r.box(1.4, 0.8, 22 + U, 8.6, TD - 1, 29 + U, CREAM, { grain: 0, step: 0.09, face: towerFace });
  r.box(3, 1.8, 29 + U, 7, TD - 2, 33 + U, CREAM, { grain: 0, step: 0.08, face: towerFace });
  r.box(3.4, 2.0, 33 + U, 6.6, TD - 2.2, 34.2 + U, CREAM, { grain: 0, step: 0.06 });
  r.box(3.9, 2.3, 34.2 + U, 6.1, TD - 2.5, 35.6 + U, CREAM, { grain: 0, step: 0.06 });
  r.box(4.4, 2.6, 35.6 + U, 5.6, TD - 2.8, 37 + U, CREAM, { grain: 0, step: 0.05 });
  r.box(4.92, 2.82, 37 + U, 5.08, 2.98, SPIRE - 0.3, GOLD, { grain: 0, step: 0.03 });
  r.setId(GLOW | TAG_SPIRE);
  r.box(4.88, 2.78, SPIRE - 0.3, 5.12, 3.02, SPIRE, [255, 80, 70], { grain: 0, step: 0.03 });
  r.setId(0);
  // Cornisas doradas en cada retranqueo
  for (const [x0, x1, y1, z] of [
    [-0.15, 10.15, TD + 0.15, 21.8 + U],
    [1.25, 8.75, TD - 0.85, 28.8 + U],
    [2.85, 7.15, TD - 1.85, 32.8 + U],
  ])
    r.box(x0, 0, z, x1, y1, z + 0.25, GOLD, { grain: 0, step: 0.07 });

  // Pilastras con un filo de luz dorada (art déco), de abajo arriba
  for (const p of [0, 3.33, 6.67, 10]) {
    r.box(p - 0.18, TD, 5.15, p + 0.18, TD + 0.14, 21.8 + U, CREAM, { grain: 0, step: 0.06 });
    lit(() => r.box(p - 0.035, TD + 0.14, 5.3, p + 0.035, TD + 0.17, 21.7 + U, GOLD, { grain: 0, step: 0.03 }));
  }
  for (const p of [1.4, 5, 8.6]) lit(() => r.box(p - 0.035, TD - 1, 22.3 + U, p + 0.035, TD - 0.97, 28.7 + U, GOLD, { grain: 0, step: 0.03 }));
  // Costillas de luz en la corona
  for (const [x, y, z0, z1] of [
    [3.75, TD - 2, 29.4, 32.7],
    [6.25, TD - 2, 29.4, 32.7],
    [4.2, TD - 2.2, 33.1, 34.1],
    [5.8, TD - 2.2, 33.1, 34.1],
    [5, TD - 2.5, 34.3, 35.5],
    [4.6, TD - 2.8, 35.7, 36.9],
    [5.4, TD - 2.8, 35.7, 36.9],
  ])
    lit(() => r.box(x - 0.04, y, z0 + U, x + 0.04, y + 0.04, z1 + U, GOLD, { grain: 0, step: 0.03 }));

  // Ventanas: encendidas de colores cálidos, apagadas de cristal azul noche
  let winCount = 0;
  const win = (x0, y, z0, w, h, seed, side = false) => {
    const on = hash(x0 * 3.1 + seed, z0 * 1.7 + y) > 0.36;
    const c = on ? WINDOWS[Math.floor(hash(x0 * 7 + seed, z0 * 3) * WINDOWS.length)] : GLASS;
    r.setId(on ? GLOW | (TAG_WIN + (winCount++ & 0x7ff)) : 0);
    if (side) r.box(y, x0, z0, y + 0.05, x0 + w, z0 + h, c, { grain: 0, step: 0.06 });
    else r.box(x0, y, z0, x0 + w, y + 0.05, z0 + h, c, { grain: 0, step: 0.06, face: on && hash(x0, z0 + 9) > 0.8 ? (f, a, b) => (f === 'front' && Math.abs(a - (x0 + w / 2)) < 0.09 && b < z0 + 0.38 ? rgb(70, 50, 62) : undefined) : null });
    r.setId(0);
  };
  const B = 3; // lo que sube el salón de baile
  const ballroom = (z) => z > 13 + B && z < 16.7 + B;
  for (let z = 5.45; z + 0.62 < 21.7 + U; z += 1.05) {
    if (ballroom(z) || ballroom(z + 0.62)) continue;
    for (const p of [0, 3.33, 6.67]) for (let k = 0; k < 3; k += 1) win(p + 0.38 + k * 0.95, TD, z, 0.55, 0.62, 1);
    for (let k = 0; k < 6; k += 1) win(0.5 + k * 0.95, 10, z, 0.55, 0.62, 2, true);
  }
  for (let z = 22.5 + U; z + 0.62 < 28.7 + U; z += 1.05) {
    for (let x = 1.75; x + 0.55 < 8.4; x += 0.95) if (Math.abs(x + 0.27 - 5) > 0.35) win(x, TD - 1, z, 0.55, 0.62, 3);
    for (let k = 0; k < 4; k += 1) win(1.1 + k * 0.95, 8.6, z, 0.55, 0.62, 4, true);
  }
  // Ventanales altos de la corona: el bar del mirador
  lit(() => {
    for (const x of [3.35, 4.65, 5.95]) r.box(x, TD - 2, 29.6 + U, x + 0.7, TD - 1.95, 32.3 + U, [255, 206, 128], { grain: 0, step: 0.05, face: (f, a, b) => (f === 'front' && (b > 31.9 + U || Math.abs(a - (x + 0.35)) < 0.04) ? r.rampOf(GOLD)[2] : undefined) });
  });

  // Salón de baile acristalado a media altura, con lámparas de araña y gente bailando
  r.box(-0.25, TD, 13.3 + B, 10.25, TD + 0.7, 13.55 + B, CREAM, { grain: 0, step: 0.06 });
  lit(() =>
    r.box(0.25, TD, 13.55 + B, 9.75, TD + 0.06, 16.5 + B, [252, 204, 172], {
      grain: 0,
      step: 0.04,
      face: (f, a, b) => {
        if (f !== 'front') return undefined;
        if ((a - 0.25) % 0.93 < 0.07) return r.rampOf(GOLD)[2];
        if (b > 16.25 + B) return r.rampOf([255, 220, 180])[4];
        // Lámparas de araña
        const ch = Math.abs(((a - 0.7) % 1.85) - 0.0) < 0.22 && b > 15.6 + B && b < 16.0 + B;
        if (ch) return rgb(255, 246, 214);
        // Siluetas que bailan en la parte baja
        const k = Math.floor(a * 3.4);
        if (b < 14.35 + B + hash(k, 2) * 0.2 && hash(k, 7) > 0.55 && (a * 3.4) % 1 > 0.35) return rgb(110, 62, 86);
        return undefined;
      },
    }),
  );
  for (let x = -0.2; x < 10.2; x += 0.22) r.box(x, TD + 0.62, 13.55 + B, x + 0.04, TD + 0.68, 13.95 + B, GOLD, { grain: 0, step: 0.03 });
  r.box(-0.25, TD + 0.62, 13.95 + B, 10.25, TD + 0.7, 14.0 + B, GOLD, { grain: 0, step: 0.03 });

  // Terraza de la azotea (sobre el fuste): barandilla, sombrillas, macetas, gente y guirnaldas de bombillas
  for (let x = 0.05; x < 9.95; x += 0.25) r.box(x, TD - 0.1, 22.05 + U, x + 0.04, TD - 0.05, 22.5 + U, IRON, { grain: 0, step: 0.03 });
  r.box(0, TD - 0.12, 22.5 + U, 10, TD - 0.04, 22.56 + U, IRON, { grain: 0, step: 0.03 });
  const person = (x, y, z, k) => {
    const c = CLOTHES[k % CLOTHES.length];
    r.box(x, y, z, x + 0.17, y + 0.13, z + 0.42, c, { grain: 0, step: 0.03 });
    r.box(x + 0.02, y + 0.01, z + 0.42, x + 0.15, y + 0.12, z + 0.56, SKIN[k % 3], { grain: 0, step: 0.03 });
    if (k % 4 === 1) r.box(x + 0.01, y, z + 0.52, x + 0.16, y + 0.13, z + 0.6, [84, 60, 46], { grain: 0, step: 0.03 });
  };
  for (const [x, c] of [
    [0.7, RED],
    [9.1, [96, 132, 120]],
  ]) {
    r.box(x, TD - 0.7, 22 + U, x + 0.05, TD - 0.65, 23.1 + U, IRON, { grain: 0, step: 0.03 });
    r.box(x - 0.45, TD - 1.1, 23.1 + U, x + 0.5, TD - 0.25, 23.25 + U, c, { grain: 0, step: 0.04, face: (f, a) => (f !== 'side' && Math.floor(a * 6) % 2 ? r.rampOf(WHITE)[3] : undefined) });
  }
  [0.3, 1.2, 8.3, 9.5].forEach((x, k) => person(x, TD - 0.5 - (k % 2) * 0.3, 22 + U, k + 2));
  for (const x of [0.15, 9.6]) {
    r.box(x, TD - 0.45, 22 + U, x + 0.3, TD - 0.15, 22.25 + U, [184, 98, 70], { grain: 0, step: 0.04 });
    for (let j = 0; j < 4; j += 1) r.box(x - 0.05 + j * 0.1, TD - 0.4, 22.25 + U, x + 0.08 + j * 0.1, TD - 0.2, 22.55 + U + hash(x, j) * 0.3, LEAF, { grain: 0, step: 0.03 });
  }
  lit(() => {
    for (const [y, zt, ph] of [
      [TD - 0.08, 23.0 + U, 0],
      [TD - 0.9, 23.25 + U, 1.3],
    ])
      for (let x = 0.2; x < 9.85; x += 0.32) {
        const sag = Math.abs(Math.sin(((x + ph) / 2.4) * Math.PI)) * 0.3;
        r.box(x, y, zt - sag, x + 0.08, y + 0.06, zt - sag + 0.08, [[255, 214, 140], [244, 170, 150], [250, 236, 190], [190, 220, 250]][Math.floor(x * 3.1) % 4], { grain: 0, step: 0.03 });
      }
  });
  light(5, TD, 23 + U, 30, [255, 190, 140]);

  // Planta baja: marquesina roja con bombillas, puertas de cristal encendidas, ventanales del vestíbulo, alfombra
  lit(() =>
    r.box(3.6, TD + 0.3, 0.1, 6.4, TD + 0.36, 2.0, [255, 214, 150], {
      grain: 0,
      step: 0.04,
      face: (f, a, b) => (f === 'front' && (Math.abs(a - 5) < 0.05 || (a - 3.6) % 0.7 < 0.05 || b > 1.88) ? r.rampOf(GOLD)[2] : undefined),
    }),
  );
  lit(() => {
    for (const [x0, x1] of [
      [0.2, 3.1],
      [6.9, 8.2],
    ])
      r.box(x0, TD + 0.3, 0.5, x1, TD + 0.36, 2.0, [252, 210, 150], {
        grain: 0,
        step: 0.04,
        face: (f, a, b) => {
          if (f !== 'front') return undefined;
          if ((a - x0) % 0.72 < 0.05 || b > 1.88) return r.rampOf(GOLD)[2];
          if (b > 1.55 && b < 1.72 && (a - x0) % 0.72 > 0.28 && (a - x0) % 0.72 < 0.44) return rgb(255, 248, 220);
          const k = Math.floor(a * 3);
          if (b < 1.05 && hash(k, 4) > 0.6 && (a * 3) % 1 > 0.4) return rgb(120, 76, 80);
          return undefined;
        },
      });
  });
  r.box(2.6, TD + 0.3, 2.1, 7.4, TD + 2.0, 2.32, RED, { grain: 0, step: 0.05 });
  for (const x of [2.7, 7.25]) r.box(x, TD + 1.85, 0, x + 0.06, TD + 1.91, 2.1, GOLD, { grain: 0, step: 0.03 });
  r.setId(GLOW | TAG_BULB);
  {
    for (let x = 2.65; x < 7.4; x += 0.28) r.box(x, TD + 1.98, 2.02, x + 0.08, TD + 2.04, 2.1, LAMP, { grain: 0, step: 0.03 });
    for (let y = TD + 0.4; y < TD + 2; y += 0.28) for (const x of [2.58, 7.37]) r.box(x, y, 2.02, x + 0.05, y + 0.08, 2.1, LAMP, { grain: 0, step: 0.03 });
  }
  r.setId(0);
  r.box(4.3, TD + 0.3, 0, 5.7, TD + 3.2, 0.02, RED, { grain: 0, step: 0.05 });
  // 1.80: la puerta del casino del sótano, a la derecha de la marquesina: un marco de latón, la puerta verde entornada
  // con luz roja dentro y los escalones que bajan (el naipe de neón de encima va al final, con el rótulo)
  lit(() => r.box(8.35, TD + 0.28, 0, 9.85, TD + 0.34, 2.15, [255, 150, 170], { grain: 0, step: 0.04 }));
  r.box(8.5, TD + 0.34, 0, 9.7, TD + 0.38, 2.0, [34, 30, 38], {
    grain: 0,
    step: 0.03,
    face: (f, a, b) => {
      if (f !== 'front') return undefined;
      if (b < 0.5) return (b * 10) % 1 < 0.3 ? rgb(70, 60, 64) : rgb(110, 100, 96);
      if (a > 9.25) return (b * 5) % 1 < 0.12 ? rgb(30, 70, 52) : rgb(46, 104, 76);
      return b < 1.7 ? rgb(196, 62, 72) : rgb(120, 36, 48);
    },
  });
  light(9.1, TD + 0.6, 1.2, 14, [255, 120, 140]);
  // El rótulo: tablero oscuro (las letras van al final, en neón)
  r.box(1.5, TD + 0.3, 2.45, 8.5, TD + 0.38, 4.8, [42, 30, 44], { grain: 0, step: 0.05 });
  light(5, TD + 1.5, 1.4, 34, [255, 196, 130]);
  light(1.6, TD + 0.5, 1.4, 22);
  light(8.4, TD + 0.5, 1.4, 22);
  light(5, TD + 0.5, 3.9, 26, [255, 160, 170]);

  // Farolas de la plaza, árboles en macetero, bancos y gente (algunos charlando)
  for (const x of [-2.4, 2.0, 8.0, 12.4]) {
    r.box(x, TD + 3.7, 0, x + 0.1, TD + 3.8, 2.2, IRON, { grain: 0, step: 0.03 });
    lit(() => r.box(x - 0.1, TD + 3.6, 2.2, x + 0.2, TD + 3.9, 2.55, LAMP, { grain: 0, step: 0.03 }));
    r.box(x - 0.14, TD + 3.56, 2.55, x + 0.24, TD + 3.94, 2.62, IRON, { grain: 0, step: 0.03 });
    light(x, TD + 3.75, 2.4, 26);
  }
  for (const x of [-0.6, 11.0]) {
    r.box(x - 0.5, TD + 1.4, 0, x + 0.5, TD + 2.4, 0.5, STONE, { grain: 0, step: 0.05 });
    r.box(x - 0.05, TD + 1.85, 0.5, x + 0.05, TD + 1.95, 1.3, [96, 70, 52], { grain: 0, step: 0.03 });
    r.box(x - 0.55, TD + 1.35, 1.3, x + 0.55, TD + 2.45, 2.5, LEAF, { grain: 1, step: 0.05, seed: x });
  }
  for (const x of [0.6, 8.5]) r.box(x, TD + 3.0, 0, x + 1.0, TD + 3.35, 0.38, [104, 72, 52], { grain: 0, step: 0.04 });
  const crowd = [
    [2.5, TD + 2.5],
    [2.85, TD + 2.7],
    [6.6, TD + 2.4],
    [6.95, TD + 2.55],
    [1.0, TD + 3.6],
    [9.0, TD + 3.75],
    [-1.5, TD + 3.0],
    [11.3, TD + 2.9],
    [11.6, TD + 3.1],
    [1.4, TD + 4.3],
    [8.3, TD + 4.0],
    [-3.2, TD + 4.0],
    [13.4, TD + 4.2],
    [5.0, TD + 2.25],
  ];
  crowd.forEach(([x, y], k) => {
    person(x, y, 0, k);
    r.castShadow(x + 0.08, y + 0.06, 0.1, 0.12, 1, 0);
  });
  // Botones del portero junto a la puerta
  person(3.3, TD + 0.9, 0, 0);
  r.box(3.3, TD + 0.9, 0.52, 3.47, TD + 1.03, 0.66, RED, { grain: 0, step: 0.03 });

  // Edificios vecinos, más bajos: a la izquierda uno mostaza como el nuestro, a la derecha uno de ladrillo
  const neighbour = (x0, x1, h, color, seed, roof) => {
    const ramp = r.rampOf(color);
    r.box(x0, 0.6, 0, x1, TD - 0.4, h, color, { grain: 0, step: 0.09, face: (f, a, b) => (f === 'top' ? r.rampOf(roof)[1] : f === 'side' ? ramp[1] : ramp[(b % 1.6 < 0.08) ? 2 : 3]) });
    r.box(x0 - 0.1, 0.5, h, x1 + 0.1, TD - 0.3, h + 0.2, WHITE, { grain: 0, step: 0.07 });
    for (let z = 0.6; z + 0.9 < h - 0.2; z += 1.6) for (let x = x0 + 0.45; x + 0.6 < x1 - 0.2; x += 1.15) win(x, TD - 0.4, z, 0.6, 0.9, seed);
  };
  neighbour(-11, -1.6, 7.4, MUSTARD, 5, ROOF);
  neighbour(11.6, 21, 9.0, BRICK, 6, [110, 96, 92]);
  // Depósito de agua en la azotea del de ladrillo
  r.box(15.5, 2.0, 9.2, 16.9, 3.4, 10.6, [120, 84, 60], { grain: 1, step: 0.05 });
  r.box(15.7, 2.2, 10.6, 16.7, 3.2, 11.0, [92, 64, 48], { grain: 0, step: 0.05 });
  
  // Un barquito con luces en el agua
  r.box(12.5, QUAY + 3.4, 0, 17.0, QUAY + 4.5, 0.55, WHITE, { grain: 0, step: 0.05 });
  r.box(13.4, QUAY + 3.6, 0.55, 15.8, QUAY + 4.3, 1.2, [214, 204, 186], { grain: 0, step: 0.05 });
  lit(() => {
    for (let x = 13.6; x < 15.6; x += 0.45) r.box(x, QUAY + 4.3, 0.7, x + 0.25, QUAY + 4.33, 1.0, LAMP, { grain: 0, step: 0.03 });
  });
  // Bolardos del muelle
  for (const x of [-1, 3, 7, 11]) r.box(x, QUAY - 0.3, 0, x + 0.3, QUAY, 0.4, IRON, { grain: 0, step: 0.03 });
  // La limusina negra que te ha traído (1.74, §74), esperando delante de la alfombra roja
  drawLimo(r, 3.35, TD + 3.2, { glowId: GLOW, bodyId: TAG_LIMO });
  r.setId(0);
  // Un charco de luz cálida a su alrededor, para que el coche negro se lea sobre el empedrado
  light(5, TD + 4.4, 0.1, 30, [255, 214, 160]);
  light(5, TD + 3.6, 1.2, 22, [255, 226, 190]);
  // Hasta dónde baja la entrada (la limusina incluida): por encima de esa línea va todo lo que tiene que verse
  const entryY = Math.max(...[3.35, 3.35 + LIMO_L].flatMap((x) => [TD + 3.2, TD + 3.2 + LIMO_D].map((y) => r.project(x, y, 0).sy))) + 3;

  r.applyShadows();
  r.bakeOcclusion();
  r.shadeEdges();

  // Las letras del rótulo, en neón: «GRAN HOTEL» / «DEL PUERTO»
  const p0 = r.project(1.5, TD + 0.38, 4.8);
  const p1 = r.project(8.5, TD + 0.38, 4.8);
  const slope = (p1.sy - p0.sy) / (p1.sx - p0.sx);
  const boardW = Math.round(p1.sx - p0.sx);
  const neon = rgb(255, 214, 128);
  const neonPinkC = rgb(255, 150, 170);
  const neonPink = [];
  const put = (x, y, c) => {
    const sx = Math.round(p0.sx + x);
    const sy = Math.round(p0.sy + y + slope * x);
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
    r.pix[sy * W + sx] = c;
    glow[sy * W + sx] = 1;
    if (c === neonPinkC) neonPink.push(sy * W + sx);
  };
  const widthOf = (line) => [...line].reduce((w, ch) => w + (ch === ' ' ? 2 : GLYPHS[ch][0].length + 1), -1);
  // El naipe de neón rosa del casino, encima de su puerta (parpadea con el resto del neón rosa)
  {
    const c = r.project(9.1, TD + 0.36, 2.75);
    const SPADE = ['..#..', '.###.', '#####', '#####', '..#..'];
    SPADE.forEach((row, gy) =>
      [...row].forEach((bit, gx) => {
        if (bit !== '#') return;
        const sx = Math.round(c.sx - 2 + gx);
        const sy = Math.round(c.sy - 2 + gy);
        r.pix[sy * W + sx] = neonPinkC;
        glow[sy * W + sx] = 1;
        neonPink.push(sy * W + sx);
      }),
    );
  }
  ['GRAN HOTEL', 'DEL PUERTO'].forEach((line, row) => {
    let x = Math.round((boardW - widthOf(line)) / 2);
    const y0 = 2 + row * 6;
    for (const ch of line) {
      if (ch === ' ') {
        x += 2;
        continue;
      }
      const g = GLYPHS[ch];
      g.forEach((bits, gy) => [...bits].forEach((bit, gx) => bit === '#' && put(x + gx, y0 + gy, row ? neonPinkC : neon)));
      x += g[0].length + 1;
    }
  });

  // Cielo de noche: degradado, estrellas, luna, la ciudad al fondo y dos focos que barren el cielo
  const horizon = r.project(5, -3, 0).sy;
  const skyRamp = [[10, 12, 34], [26, 24, 66], [64, 42, 100], [128, 70, 118]];
  const beamFrom = r.project(5, 3, 29 + U);
  const beams = [];
  const moon = { x: 34, y: 34, r: 8 };
  for (let iy = 0; iy < H; iy += 1) {
    const t = Math.min(1, Math.max(0, iy / (horizon - 2)));
    const band = t * (skyRamp.length - 1);
    for (let ix = 0; ix < W; ix += 1) {
      const i = iy * W + ix;
      if (r.zb[i] > -1e8) continue;
      const k = Math.max(0, Math.min(skyRamp.length - 2, Math.floor(band + (r.bayerAt(ix, iy) - 0.5) * 0.7)));
      const m = Math.min(1, Math.max(0, band - k));
      const a = skyRamp[k];
      const b = skyRamp[k + 1];
      let c = [a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m, a[2] + (b[2] - a[2]) * m];
      // Focos
      const ang = Math.atan2(ix - beamFrom.sx, beamFrom.sy - iy);
      if (iy < beamFrom.sy)
        for (const bA of beams) {
          const d = Math.abs(ang - bA);
          if (d < 0.07 + r.bayerAt(ix, iy) * 0.02) {
            const fade = (1 - d / 0.09) * Math.max(0, 1 - (beamFrom.sy - iy) / 260);
            c = c.map((v, j) => v + [70, 62, 48][j] * fade);
          }
        }
      // Ciudad al fondo
      const ridge = horizon - 6 - noise(ix * 0.09, 1) * 10 - (hash(Math.floor(ix / 7), 3) > 0.6 ? 14 + hash(Math.floor(ix / 7), 5) * 18 : 0);
      if (iy > ridge) {
        const winLit = hash(Math.floor(ix / 2), Math.floor(iy / 2)) > 0.86 && ix % 2 === 0 && iy % 2 === 0;
        r.pix[i] = winLit ? rgb(255, 210, 140) : rgb(30 + (iy - ridge) * 0.3, 26, 56);
        if (winLit) glow[i] = 1;
        continue;
      }
      // Luna
      const md = Math.hypot(ix - moon.x, iy - moon.y);
      if (md < moon.r) {
        const crater = noise(ix * 0.5, iy * 0.5) > 0.62;
        r.pix[i] = crater ? rgb(220, 210, 190) : rgb(250, 242, 220);
        glow[i] = 1;
        continue;
      }
      if (md < moon.r + 6) c = c.map((v, j) => v + [40, 36, 30][j] * (1 - (md - moon.r) / 6));
      const star = iy < horizon * 0.6 && hash(ix, iy) > 0.992;
      r.pix[i] = star ? rgb(250, 240, 220) : rgb(c[0], c[1], c[2]);
    }
  }

  // Noche: todo lo que no da luz se apaga y se enfría, salvo cerca de las farolas, la puerta y la terraza
  for (let i = 0; i < r.pix.length; i += 1) {
    if (r.zb[i] < -1e8) continue;
    if (r.ids[i] & GLOW) {
      glow[i] = 1;
      continue;
    }
    if (glow[i]) continue;
    const ix = i % W;
    const iy = (i / W) | 0;
    let g = [0, 0, 0];
    for (const l of lights) {
      const d = Math.hypot(ix - l.sx, (iy - l.sy) * 1.25) / l.radius;
      if (d < 1) {
        const k = (1 - d) ** 1.7;
        g = g.map((v, j) => v + (k * l.color[j]) / 255);
      }
    }
    // Luz que sube por la fachada desde el basamento y baja desde la corona
    const p = r.pix[i];
    const R = p & 255;
    const G = (p >> 8) & 255;
    const B = (p >> 16) & 255;
    r.pix[i] = rgb(R * (0.42 + Math.min(0.75, g[0] * 0.75)), G * (0.44 + Math.min(0.62, g[1] * 0.62)), B * (0.7 + Math.min(0.3, g[2] * 0.3)));
  }
  // La limusina, negra sobre el empedrado de noche: un filo de luz de la marquesina en su perfil de arriba y de los lados
  for (let i = W; i < r.pix.length - W; i += 1) {
    if (r.ids[i] !== TAG_LIMO) continue;
    if (r.ids[i - W] !== TAG_LIMO) r.pix[i] = rgb(214, 196, 178);
    else if (r.ids[i - 1] !== TAG_LIMO || r.ids[i + 1] !== TAG_LIMO) r.pix[i] = rgb(120, 110, 118);
  }

  // Reflejos en el agua: lo de arriba, al revés, ondulado y oscuro; las luces, en estelas verticales
  const s0 = r.project(-10, QUAY + 0.4, 0);
  const s1 = r.project(20, QUAY + 0.4, 0);
  const shoreY = (ix) => s0.sy + ((s1.sy - s0.sy) * (ix - s0.sx)) / (s1.sx - s0.sx);
  const src = r.pix.slice();
  const srcGlow = glow.slice();
  for (let iy = 0; iy < H; iy += 1) {
    for (let ix = 0; ix < W; ix += 1) {
      const i = iy * W + ix;
      if (!water[i] || r.zb[i] !== r.zb[i]) continue;
      if (r.ids[i] !== 0 && !(r.ids[i] === 0)) continue;
      const sy0 = shoreY(ix);
      const dist = iy - sy0;
      const wob = Math.round(Math.sin(iy * 1.3 + ix * 0.15) * (1 + dist * 0.02));
      const sy = Math.round(sy0 - dist * 1.05);
      const sx = Math.min(W - 1, Math.max(0, ix + wob));
      const base = r.pix[i];
      const bR = base & 255;
      const bG = (base >> 8) & 255;
      const bB = (base >> 16) & 255;
      const ripple = Math.sin(ix * 0.35 + iy * 2.1 + noise(ix * 0.1, iy * 0.3) * 5);
      let out = [bR * 0.5, bG * 0.55, bB * 0.75];
      if (sy >= 0 && sy < H) {
        const j = sy * W + sx;
        const c = src[j];
        const k = srcGlow[j] ? (ripple > -0.3 ? 0.8 : 0.35) : 0.38;
        out = out.map((v, n) => v * (1 - k) + ((c >> (n * 8)) & 255) * k * (srcGlow[j] ? 0.95 : 0.6));
        if (srcGlow[j] && ripple > 0.2) glow[i] = 1;
      }
      if (ripple > 0.93) out = out.map((v) => v + 26);
      r.pix[i] = rgb(out[0], out[1], out[2]);
    }
  }

  // Resplandor de las luces (suave, sin pasarse)
  const acc = new Float32Array(W * H * 3);
  const RAD = 4;
  for (let i = 0; i < r.pix.length; i += 1) {
    if (!glow[i]) continue;
    const p = r.pix[i];
    const c = [p & 255, (p >> 8) & 255, (p >> 16) & 255];
    if (c[0] + c[1] + c[2] < 330) continue;
    const ix = i % W;
    const iy = (i / W) | 0;
    for (let dy = -RAD; dy <= RAD; dy += 1)
      for (let dx = -RAD; dx <= RAD; dx += 1) {
        const x = ix + dx;
        const y = iy + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const d = Math.hypot(dx, dy) / (RAD + 0.5);
        if (d >= 1) continue;
        const w = (1 - d) ** 2 * 0.055;
        const j = (y * W + x) * 3;
        acc[j] += c[0] * w;
        acc[j + 1] += c[1] * w;
        acc[j + 2] += c[2] * w * 0.85;
      }
  }
  for (let i = 0; i < r.pix.length; i += 1) {
    const p = r.pix[i];
    r.pix[i] = rgb((p & 255) + acc[i * 3], ((p >> 8) & 255) + acc[i * 3 + 1], ((p >> 16) & 255) + acc[i * 3 + 2]);
  }

  // Lo que se anima: cada ventana encendida (sus píxeles), la aguja, las bombillas de la marquesina, el neón rosa
  const windows = new Map();
  const spire = [];
  const bulbs = [];
  for (let i = 0; i < r.pix.length; i += 1) {
    const id = r.ids[i];
    if (!(id & GLOW)) continue;
    const tag = id & 0x7fff;
    if (tag >= TAG_WIN && tag < TAG_WIN + 0x800) {
      if (!windows.has(tag)) windows.set(tag, []);
      windows.get(tag).push(i);
    } else if (tag === TAG_SPIRE) spire.push(i);
    else if (tag === TAG_BULB) bulbs.push(i);
  }
  const sky = new Uint8Array(W * H);
  for (let i = 0; i < sky.length; i += 1) if (r.zb[i] < -1e8) sky[i] = 1;

  // Zonas que se tocan, de la más concreta a la más general: el contorno de cada caja (sus 8 esquinas proyectadas)
  const hull = (x0, y0, z0, x1, y1, z1) => {
    const pts = [];
    for (const x of [x0, x1])
      for (const y of [y0, y1])
        for (const z of [z0, z1]) {
          const p = r.project(x, y, z);
          pts.push([p.sx, p.sy]);
        }
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (const p of pts.slice().reverse()) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  };
  const inside = (poly, x, y) => {
    let c = false;
    for (let a = 0, b = poly.length - 1; a < poly.length; b = a, a += 1) {
      const [xa, ya] = poly[a];
      const [xb, yb] = poly[b];
      if (ya > y !== yb > y && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) c = !c;
    }
    return c;
  };
  const ZONES = [
    { id: 'terraza', boxes: [[-0.3, TD - 1.3, 22 + U - 0.1, 10.3, TD + 0.2, 23.6 + U]] },
    { id: 'mirador', boxes: [[2.8, 1.7, 29 + U - 0.2, 7.2, TD - 1.8, SPIRE]] },
    { id: 'baile', boxes: [[-0.3, TD - 0.1, 13.3 + 3, 10.3, TD + 0.75, 16.6 + 3]] },
    // 1.79: el bloque estrecho de encima de la terraza es el ático, la suite de la semana
    { id: 'suite', boxes: [[1.4, 0.8, 22 + U + 0.25, 8.6, TD - 1, 29 + U]] },
    { id: 'suites', boxes: [[0, 0, 16.6 + 3, 10, TD, 22 + U]] },
    { id: 'cafe', boxes: [[0, 0, 5.15, 10, TD, 13.3 + 3]] },
    // 1.80: la puerta del casino del sótano, a la derecha de la marquesina (antes que el vestíbulo, que la rodea)
    { id: 'casino', boxes: [[8.3, TD + 0.2, 0, 9.9, TD + 0.6, 3.1]] },
    { id: 'vestibulo', boxes: [[-0.8, -0.3, 0, 10.8, TD + 2.1, 5.2]] },
    { id: 'plaza', boxes: [[-4.5, TD + 0.3, 0, 14.5, QUAY, 1.2]] },
  ];
  const zoneMap = new Uint8Array(W * H);
  ZONES.forEach((z, k) => {
    z.polys = z.boxes.map((b) => hull(...b));
    for (let i = 0; i < zoneMap.length; i += 1) {
      if (zoneMap[i] || sky[i] || water[i]) continue;
      const x = (i % W) + 0.5;
      const y = ((i / W) | 0) + 0.5;
      if (z.polys.some((p) => inside(p, x, y))) zoneMap[i] = k + 1;
    }
    // Dónde poner su etiqueta: encima del centro de su primera caja
    const top = Math.min(...z.polys[0].map((p) => p[1]));
    const xs = z.polys[0].map((p) => p[0]);
    z.label = { x: (Math.min(...xs) + Math.max(...xs)) / 2 / W, y: Math.max(0, top) / H };
  });

  // La gente de la plaza (para los bocadillos) y la línea por la que pasean otros
  const people = crowd.map(([x, y]) => {
    const p = r.project(x + 0.08, y, 0.95);
    return { x: Math.round(p.sx), y: Math.round(p.sy) };
  });
  const walk = [r.project(-4, TD + 4.25, 0), r.project(14, TD + 4.25, 0)].map((p) => ({ x: p.sx, y: p.sy }));

  return { W, H, pix: r.pix.slice(), sky, water, windows, spire, bulbs, neonPink, beamFrom: r.project(5, 3, 29 + U), shoreY, entryY, zones: ZONES.map(({ id, label }) => ({ id, label })), zoneMap, people, walk };
}
