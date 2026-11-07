// Los «místicos» (docs/qa/misticos.md; decisiones de Francisco del 2-11-2026): seres con movimiento, de diseño
// espectacular y con guiños a sagas (originales que evocan un libro, nunca personajes, nombres ni diseños oficiales).
// Los legendarios te siguen; los demás se colocan en el piso. Se dibujan con el pintor de pixelfx
// (src/vendor/pixelfx, MIT) en el mismo tamaño de píxel que la habitación (render.js, S = 18): el personaje mide unos
// 26 píxeles. Cada uno es draw(p, t, o) con el origen en el suelo, bajo el ser; mira a la derecha (quien lo coloca
// lo voltea con p.place(x, y, flip)). o: { moving } (si va andando detrás de alguien), { perch } (posado junto a ti, en
// el armario, 1.77).
import { acabadoOf } from './acabados';
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

// ---------------------------------------------------------------------------------------------------------------
// 1.78 (encargo de Francisco del 3-11-2026). El perrito de la mascota (raro: no es místico; vive encima de su cojín,
// furniture.js): sentado, mueve la cola, parpadea, mueve una oreja y, a ratos, se tumba a dormir un poco. `o.tono`: el
// color del pelo (el tono del mueble).
const PUP_TONOS = [
  [H('#c48c5c'), H('#e0b484'), H('#8a5a38')],
  [H('#ece2ce'), H('#fff8ea'), H('#b8ab94')],
  [H('#463e3c'), H('#6a605c'), H('#2a2422')],
];
export function drawPuppy(p, t, o = {}) {
  const [fur, light, dark] = PUP_TONOS[o.tono ?? 0] ?? PUP_TONOS[0];
  const nose = H('#2a1c18');
  // Cada 14 s se tumba unos 4 s (con movimiento reducido, t fijo: sentado)
  const cyc = t % 14;
  const lying = cyc > 9 && cyc < 13;
  shadow(p, 7, 0);
  if (lying) {
    // Hecho un ovillo: cuerpo largo y bajo, la cabeza apoyada en las patas, ojos cerrados y una «z» que sube
    p.ellipse(0, -3, 7, 3.2, (d) => (d < 0.55 ? light : fur));
    p.disc(5.5, -3.2, 3, (d) => (d < 0.5 ? light : fur), 1);
    p.ellipse(4, -2.2, 1.6, 2.4, dark);
    p.px(8, -3, nose);
    p.line(5, -4, 6.5, -4, dark);
    const tail = Math.sin(t * 1.5) * 0.6;
    p.line(-7, -3, -9, -4 + tail, fur);
    const zz = ((t - 9) % 1.4) / 1.4;
    p.dot(7 + zz * 3, -9 - zz * 6, H('#fff8ea'), 1 - zz);
    return;
  }
  // La cola: barre a un lado y a otro (más deprisa de vez en cuando, como si te viera llegar)
  const happy = Math.sin(t * 0.4) > 0.3 ? 3 : 1;
  const wag = Math.sin(t * 9 * happy) * 2.2;
  p.line(-4, -5, -8, -9 + wag * 0.4, fur);
  p.line(-8, -9 + wag * 0.4, -8 + wag * 0.5, -12 + wag * 0.3, light);
  // Cuerpo sentado y patas delanteras
  p.ellipse(-1, -5, 4.6, 4.4, (d, a) => (d < 0.6 && Math.cos(a) > 0 ? light : d > 0.85 && Math.sin(a) > 0.2 ? dark : fur));
  p.rect(1, -4, 1.5, 4, fur);
  p.rect(3, -4, 1.5, 4, light);
  p.px(1, -1, dark);
  p.px(3, -1, dark);
  // Cabeza, hocico y orejas caídas (una se levanta a ratos)
  const bob = Math.sin(t * 1.7) * 0.5;
  const hy = -11 + bob;
  p.disc(2.5, hy, 3.6, (d, a) => (d < 0.55 && Math.cos(a) > 0.2 ? light : fur), 1);
  p.ellipse(5.4, hy + 1.2, 2.1, 1.5, light);
  p.px(7, hy + 0.6, nose);
  p.px(4.5, hy + 2.4, H('#c45a5a'));
  const ear = t % 6 < 0.35 ? -2 : 0;
  p.tri(-0.6, hy - 2.4, 1.6, hy - 2.8, -0.4, hy + 2 + ear, dark);
  p.tri(2.6, hy - 3.2, 4.4, hy - 2.6, 3.6, hy + 0.6, dark);
  // Ojos que parpadean
  if (t % 4.2 > 0.14) {
    p.px(3.6, hy - 0.6, H('#1c1412'));
    p.px(3.6, hy - 1.4, H('#fff8ea'));
  } else p.line(3.2, hy - 0.6, 4.2, hy - 0.6, dark);
  // El collar con su chapita
  p.line(0.4, hy + 3.2, 4, hy + 3.4, H('#3f6a8a'));
  p.dot(2.6, hy + 4.2, H('#f0c35a'));
}

// Búho de las constelaciones (místico, 1.78): un búho de plumas de noche con ojos de ámbar que gira la cabeza y
// parpadea; a su alrededor, una constelación pequeña se va encendiendo estrella a estrella y se une con hilos de luz.
const OWL = [H('#2c2a44'), H('#4a4670'), H('#7a74a8'), H('#c8c2e6')];
const AMBER = H('#ffb84a');
export function drawOwl(p, t) {
  shadow(p, 6, 0);
  const sway = Math.sin(t * 0.8) * 0.4;
  // Cuerpo, alas y vientre moteado
  p.ellipse(sway, -8, 5.2, 7, (d, a) => (d < 0.55 && Math.cos(a - Math.PI / 2) < 0.2 ? OWL[2] : d > 0.82 ? OWL[0] : OWL[1]));
  for (const [x, y] of [[-1, -7], [1, -5], [0.5, -9], [-1.5, -4]]) p.px(sway + x, y, OWL[3]);
  // Garras sobre la peana
  p.px(-1.5, -1, AMBER);
  p.px(1.5, -1, AMBER);
  // Cabeza: gira a un lado y al otro cada pocos segundos
  const look = Math.max(-1, Math.min(1, Math.sin(t * 0.55) * 2)) * 1.4;
  const hx = sway + look * 0.4;
  p.disc(hx, -16, 4.6, (d) => (d > 0.85 ? OWL[0] : OWL[1]), 1);
  p.tri(hx - 4.2, -18, hx - 3.2, -23, hx - 1.6, -19, OWL[0]);
  p.tri(hx + 4.2, -18, hx + 3.2, -23, hx + 1.6, -19, OWL[0]);
  const blink = t % 5.3 < 0.16;
  for (const sx of [-1.9, 1.9]) {
    const ex = hx + sx + look * 0.5;
    p.disc(ex, -16.4, 1.8, OWL[3], 1);
    if (!blink) {
      p.disc(ex, -16.4, 1.1, AMBER, 1);
      p.px(ex, -16.4, H('#1a1208'));
    } else p.line(ex - 1.5, -16.4, ex + 1.5, -16.4, OWL[0]);
  }
  if (!blink) p.glow(hx, -16.4, 7, AMBER, 0.22);
  p.tri(hx + look * 0.5 - 0.8, -14.8, hx + look * 0.5 + 0.8, -14.8, hx + look * 0.5, -13.2, H('#d8a040'));
  // La constelación: cinco estrellas que se encienden por turnos y se unen
  const STARS = [[-12, -26], [-6, -31], [2, -29], [9, -33], [13, -25]];
  const lit = (t * 0.9) % (STARS.length + 3);
  for (let i = 0; i < STARS.length; i += 1) {
    const [x, y] = STARS[i];
    const on = Math.max(0, Math.min(1, lit - i)) * (lit > STARS.length + 1.5 ? Math.max(0, STARS.length + 3 - lit) / 1.5 : 1);
    if (i > 0 && on > 0) p.line(STARS[i - 1][0], STARS[i - 1][1], x, y, H('#9fb8ff'), 0.45 * on);
    if (on > 0.8) sparkle(p, x, y, 1, H('#ffffff'), H('#9fd8ff'), 0.3);
    else p.dot(x, y, H('#cfe0ff'), 0.25 + on * 0.6);
  }
  drift(t, 4, 3.6, (u, i) => {
    const x = (hash(i, 9) - 0.5) * 18;
    p.dot(x, -6 - u * 20, H('#c8c2e6'), Math.sin(Math.PI * u) * 0.7);
  });
}

// El polvo de estrellas del conjunto «Noche estrellada» (1.78; se lleva con la capa de estrellas, actor.js): motas
// que titilan alrededor de tu personaje y, al andar, una estela que se queda atrás y se apaga.
export function drawStardust(p, t, o = {}) {
  if (o.full) p.glow(0, -14, 18, H('#ffd27a'), 0.08 + 0.04 * Math.sin(t * 1.6));
  for (let i = 0; i < (o.full ? 12 : 7); i += 1) {
    const a = t * (0.6 + hash(i, 3) * 0.5) + i * 0.9;
    const x = Math.cos(a) * (7 + hash(i, 1) * 4);
    const y = -16 + Math.sin(a * 1.3) * 9 - hash(i, 2) * 6;
    const tw = 0.5 + 0.5 * Math.sin(t * (2 + hash(i) * 2) + i);
    if (tw > 0.9) sparkle(p, x, y, 1, H('#fff6d8'), H('#ffd27a'), 0.28);
    else p.dot(x, y, H('#ffe9a8'), tw * 0.8);
  }
  if (o.moving)
    drift(t, 6, 0.9, (u, i) => {
      const x = -4 - u * 10 + (hash(i, 5) - 0.5) * 3;
      const y = -4 - hash(i, 6) * 14 + u * 3;
      p.dot(x, y, i % 2 ? H('#9fd8ff') : H('#ffe9a8'), (1 - u) * 0.9);
    });
}

// ---------------------------------------------------------------------------------------------------------------
// La caja del casino (1.80). El conejo de la chistera (legendario): un conejo blanco que se asoma de una chistera del
// revés y baraja un naipe en el aire, con palos de la baraja que suben y titilan. Al seguirte, la chistera va dando
// saltitos.
const HAT_PAL = { o: '#0e0a10', k: '#241c28', K: '#463a4c', i: '#050306', r: '#a8283a', R: '#e05866' };
const HAT_ROWS = [
  '.oooooooooooo.',
  'oKkiiiiiiiikKo',
  '.oooooooooooo.',
  '..okkkkkkkKo..',
  '..orrrrrrrRo..',
  '..okkkkkkkKo..',
  '..okkkkkkkKo..',
  '..okkkkkkkKo..',
  '..oooooooooo..',
];
const BUN_PAL = { o: '#3a2e34', w: '#f6f2ec', W: '#ffffff', p: '#f2a0b0', e: '#1a1218', n: '#e0607a', g: '#d8ccc8' };
const BUN_ROWS = [
  '.oo...oo.',
  'owwo.owwo',
  'owpo.owpo',
  'owpo.owpo',
  'owwo.owwo',
  '.owwowwo.',
  'owwwwwwwo',
  'owewwwewo',
  'owWwnwWwo',
  'opwwwwwpo',
  '.owwwwwo.',
  'owgwwwgwo',
];
// Los cuatro palos, en 3 × 3
const SUITS = [
  { rows: ['.o.', 'ooo', 'o.o'], c: '#2a2230' },
  { rows: ['o.o', 'ooo', '.o.'], c: '#ff4a62' },
  { rows: ['.o.', 'o.o', 'ooo'], c: '#2a2230' },
  { rows: ['.o.', 'ooo', '.o.'], c: '#ff4a62' },
];

export function drawRabbit(p, t, o = {}) {
  const hop = o.moving ? Math.abs(Math.sin(t * 7)) * 3 : 0;
  shadow(p, 7, hop);
  const top = -9 - hop;
  // Se asoma y se esconde un poco, sin prisa (y al andar va asomado del todo)
  const cycle = (t % 5) / 5;
  const pop = o.moving ? BUN_ROWS.length : Math.round(BUN_ROWS.length * (cycle < 0.08 ? 0.55 + cycle * 5.6 : 1));
  p.sprite(HAT_ROWS.slice(0, 2), HAT_PAL, -7, top);
  p.sprite(BUN_ROWS.slice(0, pop), BUN_PAL, -4.5, top + 1.5 - pop);
  p.sprite(HAT_ROWS.slice(2), HAT_PAL, -7, top + 2);
  // El naipe, que gira sobre sí mismo encima de sus orejas
  const cx = Math.sin(t * 1.6) * 3;
  const cy = top - pop - 6 + Math.sin(t * 3.2) * 1.2;
  const turn = Math.cos(t * 3);
  const w = Math.max(1, Math.round(Math.abs(turn) * 4));
  p.rect(cx - w / 2 - 0.5, cy - 3.5, w + 1, 7, H('#2a1a22'));
  p.rect(cx - w / 2, cy - 3, w, 6, turn > 0 ? H('#fff4dc') : H('#a8283a'));
  if (turn > 0.5) p.px(cx, cy, H('#ff4a62'));
  p.glow(cx, cy, 6, H('#ffe39a'), 0.18 + 0.08 * Math.sin(t * 4));
  // Los palos, que suben y se apagan
  drift(t, 4, 2.6, (u, i) => {
    const x = (hash(i, 2) - 0.5) * 18 + Math.sin(u * 5 + i) * 1.5;
    const y = top - 4 - u * 16;
    const suit = SUITS[i % 4];
    if (u > 0.8) return;
    p.sprite(suit.rows, { o: suit.c }, x - 1, y - 1);
    if (hash(i, 9) > 0.5 && u > 0.4 && u < 0.5) sparkle(p, x, y - 2, 1, H('#fff6d8'), H('#ffd27a'), 0.3);
  });
}

// La pared de la Lonja (1.86). La gaviota del puerto (legendaria): blanca y gris, con el pico amarillo y su punto rojo. Parada,
// mira de reojo y de vez en cuando abre las alas; al seguirte, vuela a tu lado. Una pluma cae despacio.
const GULL_PAL = { o: '#3a4450', w: '#f6f6f0', W: '#ffffff', g: '#a8b4c0', G: '#7c8a98', k: '#2a3038', e: '#141820', y: '#f2c23c', r: '#d84a3c', p: '#e8a05c' };
const GULL_ROWS = [
  '....ooo......',
  '...owwwo.....',
  '...oweWoyy...',
  '...owwwoyr...',
  '..owwwwoo....',
  '.ogggwwwwo...',
  'okGggwwwwwo..',
  'okkGggwwwwo..',
  '.oookgwwwo...',
  '....oooooo...',
  '.....p..p....',
  '....pp.pp....',
];
const GULL_WING_UP = ['oo.......', 'ogo....oo', 'oggo..ogo', '.oggoogo.', '..oggggo.'];
const GULL_WING_DOWN = ['..oggggo.', '.oggoogo.', 'oggo..ogo', 'ogo....oo', 'oo.......'];

export function drawGull(p, t, o = {}) {
  const flying = Boolean(o.moving);
  const cycle = t % 7;
  const stretch = !flying && cycle > 5.4 && cycle < 6.4;
  const lift = flying ? 7 + Math.sin(t * 5) * 1.6 : 0;
  shadow(p, flying ? 5 : 6, lift);
  const y = -12 - lift;
  const look = !flying && Math.sin(t * 0.9) > 0.55 ? 1 : 0;
  p.sprite(GULL_ROWS, GULL_PAL, -6 + look, y);
  if (flying || stretch) {
    const up = Math.sin(t * (flying ? 12 : 9)) > 0;
    p.sprite(up ? GULL_WING_UP : GULL_WING_DOWN, GULL_PAL, -8, y + (up ? 0 : 4));
  }
  drift(t, 1, 5, (u) => {
    if (u > 0.8) return;
    p.dot(5 + Math.sin(u * 8) * 3, y - 2 + u * 16, H('#ffffff'), 0.85 - u);
  });
}

// La gramola: el arco cambia de color despacio, suben burbujas de luz por los tubos y salen notas por arriba
const JUKE = [H('#ff5a8a'), H('#ffb347'), H('#6fe0ff'), H('#9b7bff')];
const NOTE = ['.oo', '.o.', 'oo.', 'oo.'];
export function drawJukebox(p, t) {
  const k = (t / 2.2) % JUKE.length;
  const c = mix(JUKE[Math.floor(k)], JUKE[(Math.floor(k) + 1) % JUKE.length], k % 1);
  p.glow(0, -14, 11, c, 0.32 + 0.06 * Math.sin(t * 3));
  for (const side of [-5, 5])
    drift(t, 3, 1.6, (u, i) => {
      p.dot(side + (side < 0 ? 0 : 0), -3 - u * 13, JUKE[(i + (side < 0 ? 0 : 2)) % JUKE.length], 0.9 - u * 0.4);
    });
  drift(t, 3, 2.4, (u, i) => {
    const x = 2 + u * 9 + Math.sin(u * 7 + i) * 1.5;
    const y = -22 - u * 12;
    p.sprite(NOTE, { o: '#fff0c8' }, x, y);
    p.glow(x + 1, y + 2, 3, JUKE[i % JUKE.length], 0.25 * (1 - u));
  });
}

// La mesa de tapete: la lámpara de encima, un naipe que se reparte solo de un lado a otro y un brillo en las fichas
export function drawFeltTable(p, t) {
  p.glow(0, -20, 16, H('#ffe39a'), 0.12 + 0.03 * Math.sin(t * 1.3));
  const u = (t % 3.2) / 3.2;
  if (u < 0.7) {
    const k = u / 0.7;
    const x = -9 + k * 15;
    const y = -16 - Math.sin(k * Math.PI) * 5;
    const w = Math.max(1, Math.round(Math.abs(Math.cos(k * Math.PI * 2)) * 3));
    p.rect(x - w / 2, y - 2, w, 4, k < 0.25 || k > 0.75 ? H('#fff4dc') : H('#a8283a'));
  }
  const g = (t % 2.6) / 2.6;
  if (g < 0.12) sparkle(p, -8, -17, 1, H('#fff6d8'), H('#ffd27a'), 0.35);
}

// Los destellos del vestido de lentejuelas: brillos que saltan por el vestido y, al andar, una estela dorada
export function drawSequins(p, t, o = {}) {
  for (let i = 0; i < 6; i += 1) {
    const tw = (t * (1.3 + hash(i, 4)) + hash(i, 5) * 4) % 2.2;
    if (tw > 0.28) continue;
    const x = (hash(i, 1) - 0.5) * 9;
    const y = -6 - hash(i, 2) * 14;
    sparkle(p, x, y, tw < 0.14 ? 1 : 2, H('#fff6e8'), i % 2 ? H('#ffb8c8') : H('#ffd27a'), 0.32);
  }
  if (o.moving)
    drift(t, 5, 0.8, (u, i) => {
      p.dot(-3 - u * 9 + (hash(i, 6) - 0.5) * 3, -5 - hash(i, 7) * 12 + u * 2, i % 2 ? H('#ffc8d4') : H('#ffe2a0'), (1 - u) * 0.85);
    });
}

// Los destellos de un mueble con acabado (1.86): del color del acabado, repartidos por el mueble
export function drawFinish(p, t, o = {}) {
  const color = H(acabadoOf(o.acabado)?.chispa ?? '#ffffff');
  const ancho = (o.ancho ?? 1) * 9;
  for (let i = 0; i < 7; i += 1) {
    const tw = (t * (0.8 + hash(i, 4) * 0.7) + hash(i, 5) * 5) % 2.4;
    if (tw > 0.42) continue;
    sparkle(p, (hash(i, 1) - 0.5) * 2 * ancho, -4 - hash(i, 2) * (10 + ancho), tw < 0.2 ? 2 : 1, H('#ffffff'), color, 0.4);
  }
}

export const MISTICOS = [
  { id: 'dragoncillo', nombre: 'Dragoncillo de escamas rojas', guino: 'Para quien leyó «Alas de sangre»', legendario: true, draw: drawDragon },
  { id: 'zorro-bruma', nombre: 'Zorro de bruma y ceniza', guino: 'Para quien leyó «Mistborn»', legendario: true, draw: drawFox },
  { id: 'cinta-tormenta', nombre: 'Cinta de luz de tormenta', guino: 'Para quien leyó «El archivo de las tormentas»', legendario: true, draw: drawRibbon },
  { id: 'farol-azul', nombre: 'Farol de llama azul', guino: 'Para quien leyó «El nombre del viento»', legendario: false, draw: drawLantern },
  { id: 'rosa-estrellas', nombre: 'Rosa bajo la lluvia de estrellas', guino: 'Para quien leyó «Una corte de rosas y espinas»', legendario: false, draw: drawRose },
  { id: 'buho-estrellas', nombre: 'Búho de las constelaciones', guino: 'Para quien lee hasta tarde', legendario: false, draw: drawOwl },
  // 1.78: no son místicos, pero se dibujan igual (vivos, con el pintor de pixelfx): la mascota y el polvo de estrellas
  { id: 'perrito', nombre: 'Perrito en su cojín', mascota: true, draw: drawPuppy },
  { id: 'polvo-estrellas', nombre: 'Polvo de estrellas', efecto: true, draw: drawStardust },
  // 1.80: la caja del casino (el conejo te acompaña; la gramola y la mesa son muebles vivos; los destellos, del vestido)
  { id: 'conejo-chistera', nombre: 'Conejo de la chistera', guino: 'De la caja del casino del Gran Hotel', legendario: true, draw: drawRabbit },
  // 1.86: la pared de la Lonja
  { id: 'gaviota-puerto', nombre: 'Gaviota del puerto', guino: 'De la pared de premios de la Lonja', legendario: true, draw: drawGull },
  { id: 'gramola', nombre: 'Gramola', vivo: true, draw: drawJukebox },
  { id: 'mesa-tapete', nombre: 'Mesa de tapete verde', vivo: true, draw: drawFeltTable },
  { id: 'destellos', nombre: 'Destellos de lentejuelas', efecto: true, draw: drawSequins },
  { id: 'chispas-acabado', nombre: 'Destellos del acabado', efecto: true, draw: drawFinish },
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
 * Un místico animado fuera del piso (1.78: tu compañero, detrás de ti por el muelle de la fachada). Devuelve
 * { canvas, ax, ay, paint(t, { moving, flip }) }: `ax`, `ay` es dónde caen sus pies dentro del dibujo.
 */
export function misticoSprite(id) {
  const m = misticoOf(id);
  const N = 72;
  const frame = createFrame(N, N);
  const canvas = document.createElement('canvas');
  canvas.width = N;
  canvas.height = N;
  const ctx = canvas.getContext('2d');
  const img = new ImageData(N, N);
  // 1.88.2: el resto de opciones (tono, acabado, ancho…) llegan al dibujo, como en el piso isométrico
  const paint = (t, { moving = false, flip = false, ...extra } = {}) => {
    frame.color.fill(0);
    frame.light.fill(0);
    const p = painterFor(frame);
    p.place(N / 2, N - 10, flip);
    m.draw(p, t, { moving, ...extra });
    img.data.fill(0);
    composite(frame, img.data, null);
    ctx.putImageData(img, 0, 0);
  };
  return { canvas, ax: N / 2, ay: N - 10, paint };
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
