// Los «místicos» (docs/qa/misticos.md; decisiones de Francisco del 2-11-2026): seres con movimiento, de diseño
// espectacular y con guiños a sagas (originales que evocan un libro, nunca personajes, nombres ni diseños oficiales).
// Los legendarios te siguen; los demás se colocan en el piso. Se dibujan con el pintor de pixelfx
// (src/vendor/pixelfx, MIT) en el mismo tamaño de píxel que la habitación (render.js, S = 18): el personaje mide unos
// 26 píxeles. Cada uno es draw(p, t, o) con el origen en el suelo, bajo el ser; mira a la derecha (quien lo coloca
// lo voltea con p.place(x, y, flip)). o: { moving } (si va andando detrás de alguien), { perch } (posado junto a ti, en
// el armario, 1.77).
import { FIRE_RAMP, composite, createFrame, hex, mix, painterFor, sparkle } from '../../vendor/pixelfx/core/index.js';

const H = (s) => hex(s);
const hash = (a, b = 0) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const SHADOW = H('#000000');

/** Una sombra suave en el suelo, más pequeña cuanto más alto flota. */
function shadow(p, w, lift) {
  const k = Math.max(0.35, 1 - lift / 40);
  const rx = w * k;
  const ry = Math.max(1, 2 * k);
  for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y += 1)
    for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x += 1) {
      const d = (x / rx) ** 2 + (y / ry) ** 2;
      if (d < 1) p.blend(x, y, SHADOW, 0.3 * k * (1 - d));
    }
}

/** Pequeñas partículas que salen de (x, y) y suben o caen, repartidas en el tiempo: fn(x, y, edad 0..1, i). */
function drift(t, n, period, fn) {
  for (let i = 0; i < n; i += 1) {
    const u = (t / period + hash(i, 7)) % 1;
    fn(u, i);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Dragoncillo de escamas rojas (legendario; guiño a «Alas de sangre»): un dragón pequeño de escamas granate con el
// vientre de brasa, cuernos de marfil y alas de membrana que baten; de vez en cuando suelta una bocanada de fuego.
const DR = {
  o: '#1c0a12', d: '#5c1420', r: '#9e2330', h: '#d9503e', l: '#f08a5c', y: '#ffb347', Y: '#ffe08a', e: '#fff2a8', k: '#efe2c6', K: '#b8a888',
};
const DRAGON_BODY = [
  '............kK.k....',
  '...........okKokK...',
  '..........orrhhro...',
  '..........orhlhreo..',
  '...........orrrrrroo',
  '.......oooorrdrroYYo',
  '.....oorrhhhrrroo...',
  '....orrhllhrryyyo...',
  '...ordrrhhrryYYyo...',
  '...odrrrrrrryyydo...',
  '....oddddddddddo....',
  '.....od.od..od.od...',
  '.....oo.oo..oo.oo...',
];
const DR_PAL = DR;

function dragonWing(p, x, y, flap, far) {
  // Puntas del ala según el batido (arriba, medio, abajo, medio)
  const poses = [
    [[-4, -13], [-11, -15], [-14, -9]],
    [[-6, -9], [-13, -8], [-14, -3]],
    [[-5, -2], [-11, 1], [-12, 5]],
    [[-6, -9], [-13, -8], [-14, -3]],
  ][flap];
  const pts = [[x, y], ...poses.map(([a, b]) => [x + a, y + b]), [x - 7, y + 2]];
  const membrane = far ? H('#3a0d18') : H('#7a1b2a');
  const edge = far ? H('#1c0a12') : H('#2a0c14');
  const bone = far ? H('#5c1420') : H('#c0464c');
  p.poly(pts, membrane);
  p.polyline([...pts, pts[0]], edge);
  for (const [a, b] of poses) p.line(x, y, x + a, y + b, bone);
}

export function drawDragon(p, t, o = {}) {
  // Posado (en el armario): en el suelo, a la altura de la cintura de tu personaje, con las alas a medio abrir y, de
  // vez en cuando, un batido corto; volando, bate sin parar
  const perch = !!o.perch && !o.moving;
  const bob = perch ? 0 : Math.sin(t * 3.2) * 1.6;
  const lift = perch ? 3 : 14;
  shadow(p, 8, lift);
  const by = -lift - 6 + bob;
  const beat = t % 3.4;
  const flap = perch ? (beat < 0.6 ? Math.floor((beat / 0.6) * 8) % 4 : 1) : Math.floor(((t * (o.moving ? 9 : 6)) % 4 + 4) % 4);
  // Ala del fondo
  dragonWing(p, 1, by + 1, (flap + 1) % 4, true);
  // Cola con su punta de pica, ondulando
  let px = -7;
  let py = by + 3;
  for (let i = 1; i <= 9; i += 1) {
    const x = -7 - i * 1.5;
    const wave = Math.sin(t * (perch ? 2 : 4) - i * 0.7) * 1.4 * (i / 9);
    // Posado, la cola descansa en el suelo
    const y = perch ? Math.min(-1, by + 3 + i * 0.7 + wave) : by + 3 + i * 0.7 + wave;
    p.beam(px, py, x, y, 2.4 - i * 0.18, H(i < 5 ? DR.r : DR.d));
    px = x;
    py = y;
  }
  p.tri(px - 3, py, px + 1, py - 2, px + 1, py + 2, H(DR.d));
  p.px(px - 3, py, H(DR.o));
  // Cuerpo
  p.sprite(DRAGON_BODY, DR_PAL, -10, by - 5);
  // Ala de delante
  dragonWing(p, 0, by + 1, flap, false);
  // Brasa del vientre y ojo encendido
  p.glow(-1, by + 3, 7, H('#ff8a3a'), 0.35 + 0.1 * Math.sin(t * 5));
  p.glow(7, by - 2, 3, H(DR.e), 0.5);
  // Bocanada de fuego cada pocos segundos
  const breath = (t % 4.5) - 3.6;
  if (breath > 0 && breath < 0.8) {
    for (let i = 0; i < 14; i += 1) {
      const u = (breath / 0.8 + hash(i, 3) * 0.6) % 1;
      const x = 10 + u * 14;
      const y = by + 0 + (hash(i, 4) - 0.5) * u * 7 - u * 2;
      p.dot(x, y, FIRE_RAMP[Math.min(FIRE_RAMP.length - 1, Math.floor(u * FIRE_RAMP.length))], 1 - u * 0.6);
    }
    p.glow(16, by, 12, H('#ff9a3a'), 0.55 * Math.sin((Math.PI * breath) / 0.8));
  }
  // Ascuas que se le escapan
  drift(t, 4, 1.8, (u, i) => {
    const x = -2 + (hash(i, 1) - 0.5) * 10 + Math.sin(u * 6 + i) * 1.5;
    const y = by + 4 - u * 12;
    p.dot(x, y, u < 0.5 ? H('#ffd27a') : H('#ff7a3a'), 1 - u);
    p.glow(x, y, 3, H('#ff8a3a'), 0.25 * (1 - u));
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Zorro de bruma y ceniza (legendario; guiño a «Mistborn»): un zorro hecho de niebla con ojos de acero azul. Le cae
// ceniza alrededor y, a ratos, tiende hilos azules finos hacia lo que le rodea.
const MIST = [H('#3c4250'), H('#7c8496'), H('#b8bfcc'), H('#e4e8f0')];

export function drawFox(p, t, o = {}) {
  const lift = 5;
  shadow(p, 9, lift);
  const bob = Math.sin(t * 2.4) * 1;
  const by = -lift - 8 + bob;
  // Cola: una estela de niebla que ondea detrás
  for (let i = 12; i >= 0; i -= 1) {
    const x = -7 - i * 1.3;
    const y = by + 2 - i * 0.55 + Math.sin(t * 2.6 - i * 0.5) * 1.6;
    const r = 3.4 - i * 0.18;
    p.disc(x, y, r, (d) => mix(MIST[2], MIST[1], d), (d) => (1 - d) * (0.5 - i * 0.025));
  }
  // Cuerpo y patas de niebla
  p.disc(0, by + 2, 7.5, (d) => mix(MIST[3], MIST[1], d), (d) => (1 - d * d) * 0.9);
  p.glow(0, by + 1, 14, H('#8fa8ff'), 0.12);
  for (const [lx, ph] of [[-3, 0], [3, 1.6]]) {
    const step = o.moving ? Math.sin(t * 10 + ph) * 1.2 : 0;
    p.disc(lx + step, by + 7.5, 1.6, MIST[2], (d) => (1 - d) * 0.6);
  }
  // Cabeza: hocico afilado y dos orejas
  p.disc(6, by - 2, 4.8, (d) => mix(MIST[3], MIST[2], d), (d) => (1 - d * d) * 0.95);
  p.tri(8, by - 3, 13, by - 0.5, 8, by + 0.5, MIST[3]);
  p.px(13, by - 1, MIST[0]);
  p.tri(3.5, by - 4.5, 5, by - 10, 7, by - 5, MIST[2]);
  p.tri(6.5, by - 4.5, 9, by - 9.5, 9.5, by - 4, MIST[3]);
  p.px(5, by - 7, MIST[1]);
  // Ojos de acero
  const blink = t % 5 < 0.12;
  if (!blink) {
    p.px(7, by - 3, H('#bfe8ff'));
    p.px(8, by - 3, H('#5fb4ff'));
    p.glow(7.5, by - 3, 4, H('#5fb4ff'), 0.55);
  }
  // Hilos azules: tres líneas finas que salen del pecho hacia fuera, se encienden y se apagan
  const pull = (t % 3.5) / 3.5;
  if (pull < 0.3) {
    const k = Math.sin((Math.PI * pull) / 0.3);
    for (let i = 0; i < 3; i += 1) {
      const a = -0.9 + i * 0.9 + hash(Math.floor(t / 3.5), i) * 0.5;
      const L = 14 + hash(i, Math.floor(t / 3.5)) * 8;
      p.line(2, by + 1, 2 + Math.cos(a) * L, by + 1 + Math.sin(a) * L * 0.6, H('#7cc4ff'), (u) => k * (1 - u) * 0.9);
      p.glowLine(2, by + 1, 2 + Math.cos(a) * L, by + 1 + Math.sin(a) * L * 0.6, 3, H('#3a8cff'), 0.18 * k);
    }
  }
  // Ceniza que cae despacio a su alrededor
  drift(t, 9, 3.2, (u, i) => {
    const x = (hash(i, 2) - 0.5) * 30 + Math.sin(u * 5 + i) * 2;
    const y = by - 14 + u * 22;
    p.dot(x, y, hash(i, 5) > 0.5 ? H('#9a9aa2') : H('#d6d6dc'), Math.sin(Math.PI * u) * 0.9);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Cinta de luz de tormenta (legendario; guiño a «El archivo de las tormentas»): una cinta de luz blanca y azul que
// dibuja lazos en el aire alrededor de una pequeña gema encendida.
export function drawRibbon(p, t) {
  const lift = 16;
  shadow(p, 5, lift);
  const head = (tt) => [Math.sin(tt * 1.9) * 11 + Math.sin(tt * 4.3) * 3, -lift - 6 + Math.sin(tt * 2.7) * 8];
  const N = 40;
  for (let i = N; i >= 1; i -= 1) {
    const [x0, y0] = head(t - i * 0.035);
    const [x1, y1] = head(t - (i - 1) * 0.035);
    const u = i / N;
    const c = u < 0.25 ? H('#ffffff') : u < 0.55 ? H('#bdf2ff') : u < 0.8 ? H('#6fc8ff') : H('#3a6fd8');
    if (u < 0.5) p.beam(x0, y0, x1, y1, 2.6 - u * 3, c, 1 - u);
    else p.line(x0, y0, x1, y1, c, 1 - u * 0.85);
    // Un segundo hilo que se enrosca alrededor del primero
    const tw = Math.sin(t * 9 - i * 0.6) * 1.5 * (1 - u);
    p.dot(x0 + tw, y0 - tw * 0.5, H('#e8fbff'), (1 - u) * 0.7);
    if (i % 4 === 0) p.glow(x0, y0, 5, H('#6fc8ff'), 0.12 * (1 - u));
  }
  // La gema, que late
  const [gx, gy] = head(t);
  const pulse = 0.5 + 0.5 * Math.sin(t * 4);
  p.px(gx, gy - 1, H('#e8fbff'));
  p.px(gx - 1, gy, H('#8ae4ff'));
  p.px(gx + 1, gy, H('#5ab0ff'));
  p.px(gx, gy + 1, H('#3a7ae0'));
  p.px(gx, gy, H('#ffffff'));
  p.glow(gx, gy, 10, H('#7fd8ff'), 0.45 + 0.25 * pulse);
  if (pulse > 0.92) sparkle(p, gx, gy, 3, H('#bdf2ff'), H('#6fc8ff'), 0.4);
  // Chispas sueltas
  drift(t, 5, 1.4, (u, i) => {
    const [x, y] = head(t - 0.4 - i * 0.07);
    p.dot(x + (hash(i, 9) - 0.5) * 8, y + u * 6, H('#bdf2ff'), (1 - u) * 0.8);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Farol de llama azul (místico; guiño a «El nombre del viento»): un farol de hierro con una llama azul que no se
// apaga; de vez en cuando le pasa viento y la llama se tumba y suelta chispas.
const LANTERN = [
  '....ooo....',
  '...o...o...',
  '..ooooooo..',
  '.oiiiiiiio.',
  '.og.....go.',
  '.og.....go.',
  '.og.....go.',
  '.og.....go.',
  '.og.....go.',
  '.og.....go.',
  '.oiiiiiiio.',
  '..oiiiiio..',
  '...ooooo...',
];
const LANTERN_PAL = { o: '#1a1820', i: '#3c3a46', g: '#5a5868' };
const BLUE = [H('#0b1d4a'), H('#1c3f9e'), H('#2f6bff'), H('#6fb2ff'), H('#cfe8ff'), H('#ffffff')];

export function drawLantern(p, t) {
  shadow(p, 6, 0);
  p.sprite(LANTERN, LANTERN_PAL, -5, -13);
  // La llama (dentro del cristal: x -3..3, y -10..-4)
  const gust = Math.max(0, Math.sin(t * 0.9) - 0.75) * 4;
  for (let layer = 0; layer < 5; layer += 1) {
    const h = 6 - layer * 1.1 + Math.sin(t * 11 + layer) * 0.6;
    const w = 2.4 - layer * 0.45;
    for (let y = 0; y < h; y += 1) {
      const u = y / h;
      const lean = gust * u * u + Math.sin(t * 7 + y) * 0.4 * u;
      const half = w * (1 - u * u);
      for (let x = -half; x <= half; x += 1) p.px(x + lean, -4 - y, BLUE[Math.min(5, layer + 1)]);
    }
  }
  p.glow(0, -7, 16, BLUE[2], 0.5 + 0.1 * Math.sin(t * 9));
  p.glow(0, -7, 5, BLUE[4], 0.5);
  drift(t, 5, 1.6, (u, i) => {
    const x = (hash(i, 3) - 0.5) * 4 + gust * u * 3 + Math.sin(u * 7 + i);
    const y = -12 - u * 12;
    p.dot(x, y, u < 0.4 ? BLUE[4] : BLUE[3], 1 - u);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Rosa bajo la lluvia de estrellas (místico; guiño a «Una corte de rosas y espinas»): una rosa roja con espinas en
// una maceta, que brilla; caen pétalos y, a ratos, una estrella fugaz pequeña.
const ROSE_POT = ['.ooooooo.', 'otttttttto', '.ottttto.', '.otdddto.', '..ooooo..'];
const ROSE = ['..oro..', '.orRro.', 'orRRrRo', 'orrRrro', '.orrro.', '..ooo..'];

export function drawRose(p, t) {
  shadow(p, 6, 0);
  p.sprite(ROSE_POT, { o: '#2a1410', t: '#b4613e', d: '#7c3a26' }, -5, -5);
  // Tallo con espinas y dos hojas
  const sway = Math.sin(t * 1.4) * 0.6;
  p.line(0, -5, sway, -15, H('#3f6a3a'));
  for (const [y, s] of [[-8, 1], [-11, -1], [-13, 1]]) p.px(sway * ((-y - 5) / 10) + s, y, H('#1e2e1a'));
  p.tri(0, -9, 4, -11, 1, -8, H('#5c8a4c'));
  p.tri(0, -12, -4, -13, -1, -11, H('#4a7a40'));
  // La flor
  p.sprite(ROSE, { o: '#4a0c16', r: '#c42a3a', R: '#ff5a62' }, Math.round(sway) - 3, -21);
  p.glow(sway, -18, 9, H('#ff4a6a'), 0.32 + 0.08 * Math.sin(t * 2));
  // Pétalos que caen meciéndose
  drift(t, 2, 4.5, (u, i) => {
    const x = sway + Math.sin(u * 8 + i * 2) * 4 + (i ? 3 : -3) * u;
    const y = -18 + u * 18;
    p.dot(x, y, H('#e23a4a'), Math.sin(Math.PI * u));
  });
  // Puntos de luz como estrellas a su alrededor, y una estrella fugaz de vez en cuando
  for (let i = 0; i < 6; i += 1) {
    const tw = 0.5 + 0.5 * Math.sin(t * (1.5 + hash(i) * 2) + i * 2);
    const x = (hash(i, 1) - 0.5) * 22;
    const y = -26 + hash(i, 2) * 14;
    if (tw > 0.85) sparkle(p, x, y, 1, H('#fff2c8'), H('#ffd27a'), 0.25);
    else p.dot(x, y, H('#fff2c8'), tw * 0.8);
  }
  const fall = (t % 6) / 0.7;
  if (fall < 1) {
    const x0 = 10 - fall * 16;
    const y0 = -32 + fall * 10;
    p.line(x0, y0, x0 + 5, y0 - 3, H('#fff2c8'), (u) => (1 - u) * (1 - fall));
    p.glow(x0, y0, 4, H('#ffd27a'), 0.4 * (1 - fall));
  }
}

export const MISTICOS = [
  { id: 'dragoncillo', nombre: 'Dragoncillo de escamas rojas', guino: 'Para quien leyó «Alas de sangre»', legendario: true, draw: drawDragon },
  { id: 'zorro-bruma', nombre: 'Zorro de bruma y ceniza', guino: 'Para quien leyó «Mistborn»', legendario: true, draw: drawFox },
  { id: 'cinta-tormenta', nombre: 'Cinta de luz de tormenta', guino: 'Para quien leyó «El archivo de las tormentas»', legendario: true, draw: drawRibbon },
  { id: 'farol-azul', nombre: 'Farol de llama azul', guino: 'Para quien leyó «El nombre del viento»', legendario: false, draw: drawLantern },
  { id: 'rosa-estrellas', nombre: 'Rosa bajo la lluvia de estrellas', guino: 'Para quien leyó «Una corte de rosas y espinas»', legendario: false, draw: drawRose },
];

export const misticoOf = (id) => MISTICOS.find((m) => m.id === id) ?? null;

/** Su miniatura (para la balda, el armario y la tienda): un momento fijo de su animación, recortado y ampliado. */
export function misticoThumb(id, size = 44, t = 1.3) {
  const m = misticoOf(id);
  const N = 72;
  const frame = createFrame(N, N);
  const p = painterFor(frame);
  p.place(N / 2, N - 10, false);
  m.draw(p, t, {});
  const img = new ImageData(N, N);
  composite(frame, img.data, null);
  // Lo que se ve de verdad (sin el halo más tenue), para ampliarlo a toda la miniatura
  let x0 = N;
  let y0 = N;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < N * N; i += 1) {
    if (img.data[i * 4 + 3] < 90) continue;
    const x = i % N;
    const y = (i / N) | 0;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const src = document.createElement('canvas');
  src.width = N;
  src.height = N;
  src.getContext('2d').putImageData(img, 0, 0);
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (x1 < 0) return out;
  const side = Math.max(x1 - x0, y1 - y0) + 3;
  const k = Math.max(1, Math.floor(((size - 2) / side) * 2) / 2);
  const w = side * k;
  const cx = (x0 + x1 + 1) / 2;
  const cy = (y0 + y1 + 1) / 2;
  ctx.drawImage(src, cx - side / 2, cy - side / 2, side, side, Math.round((size - w) / 2), Math.round((size - w) / 2), w, w);
  return out;
}

/**
 * Un compañero que sigue a tu personaje por el piso, en celdas del suelo (x, y): se queda un poco detrás de él y
 * algo a un lado, y llega con retraso. update(me, dt) con me = { x, y, facing } (facing 0..3 como facingOf).
 */
export function createCompanion() {
  const BACK = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // hacia dónde queda «detrás» según facing (0: +y, 1: -x, 2: -y, 3: +x)
  let x = null;
  let y = null;
  let moving = false;
  let flip = false;
  return {
    update(me, dt) {
      const [bx, by] = BACK[me.facing] ?? [0, -1];
      const gx = me.x + bx * 0.9 + by * 0.45;
      const gy = me.y + by * 0.9 - bx * 0.45;
      if (x === null || dt >= 1) {
        x = gx;
        y = gy;
      }
      const k = 1 - Math.exp(-dt * 2.6);
      const dx = (gx - x) * k;
      const dy = (gy - y) * k;
      x += dx;
      y += dy;
      moving = Math.hypot(gx - x, gy - y) > 0.15;
      // En pantalla, x del mundo va a la derecha y abajo, y del mundo a la izquierda y abajo: mira hacia donde va
      const sx = dx - dy;
      if (Math.abs(sx) > 0.002) flip = sx < 0;
      else if (!moving) flip = me.x - me.y < x - y;
    },
    get state() {
      return { x, y, moving, flip };
    },
  };
}
