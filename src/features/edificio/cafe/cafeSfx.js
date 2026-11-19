// Los sonidos de la barra del café (revisión del 12-11-2026): sintetizados con Web Audio, propios, breves y bajitos, uno
// por acción y por material (cristal, madera, cobre, loza, agua, vapor). Van por el bus de efectos de la app, así que
// respetan «Sonidos táctiles» y su volumen; además, solo con el sonido del edificio activado. Nada suena antes de que la
// persona toque algo (el contexto de audio se crea con su gesto). Los que duran mientras se mantiene (el café que cae, el
// agua de la tetera, el vapor) se apagan al soltar.
import { uiSfxBus } from '../../../audio/uiSounds';

let ruidoBuf = null;
function ruidoDe(ctx) {
  if (!ruidoBuf || ruidoBuf.sampleRate !== ctx.sampleRate) {
    const n = Math.floor(ctx.sampleRate * 1.0);
    ruidoBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = ruidoBuf.getChannelData(0);
    for (let i = 0; i < n; i += 1) d[i] = Math.random() * 2 - 1;
  }
  return ruidoBuf;
}
function env(ctx, t, pico, ataque, caida) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pico), t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + caida);
  return g;
}
function tono(b, { f, a = f, tipo = 'sine', pico = 0.2, ataque = 0.004, caida = 0.12, d = 0 }) {
  const t = b.ctx.currentTime + 0.005 + d;
  const o = b.ctx.createOscillator();
  o.type = tipo;
  o.frequency.setValueAtTime(f, t);
  if (a !== f) o.frequency.exponentialRampToValueAtTime(Math.max(20, a), t + ataque + caida);
  o.connect(env(b.ctx, t, pico, ataque, caida)).connect(b.out);
  o.start(t);
  o.stop(t + ataque + caida + 0.03);
}
function ruido(b, { f, q = 1, tipo = 'bandpass', pico = 0.4, ataque = 0.004, caida = 0.08, barrido = 1, d = 0 }) {
  const t = b.ctx.currentTime + 0.005 + d;
  const s = b.ctx.createBufferSource();
  s.buffer = ruidoDe(b.ctx);
  const fl = b.ctx.createBiquadFilter();
  fl.type = tipo;
  fl.frequency.setValueAtTime(f, t);
  if (barrido !== 1) fl.frequency.exponentialRampToValueAtTime(f * barrido, t + ataque + caida);
  fl.Q.value = q;
  s.connect(fl)
    .connect(env(b.ctx, t, pico, ataque, caida))
    .connect(b.out);
  s.start(t, Math.random() * 0.5);
  s.stop(t + ataque + caida + 0.03);
}

// ── 1.131 (Francisco, 14-11-2026: «que los sonidos sean más cozy»): lo que hace cálidos los sonidos del libro ──
/** La escala de los lomos (sol, la, do, re, mi, sol, la: pentatónica, nunca chocan entre sí). */
const ESCALA = [392, 440, 523.25, 587.33, 659.25, 784, 880];
/** Las vueltas del cordel que van (para que cada una suene un poco más tensa); el lazo la vuelve a 0. */
let vueltaCordel = 0;
/** Madera: un toque blando y afinado, como una marimba pequeña (su parcial alto, breve) y el golpecito de aire. */
function madera(b, { f, pico = 0.05, caida = 0.18, d = 0 }) {
  tono(b, { f, a: f * 0.985, pico, ataque: 0.003, caida, d });
  tono(b, { f: f * 3.9, pico: pico * 0.16, ataque: 0.002, caida: caida * 0.22, d });
  ruido(b, { f: f * 2, q: 1.2, pico: pico * 0.45, ataque: 0.002, caida: 0.02, d });
}
/** Una nota cálida de cajita de música: el seno, su octava y su quinta, que se apagan antes. */
function nota(b, { f, pico = 0.03, caida = 0.6, d = 0 }) {
  tono(b, { f, pico, ataque: 0.006, caida, d });
  tono(b, { f: f * 2, pico: pico * 0.3, ataque: 0.004, caida: caida * 0.45, d });
  tono(b, { f: f * 3, pico: pico * 0.07, ataque: 0.003, caida: caida * 0.2, d });
}
/**
 * La sala de la librería: una reverberación corta de habitación de madera (ruido que se apaga en unos 0,8 s y se oscurece al
 * apagarse, como la madera y los libros que se tragan lo agudo), sintetizada aquí.
 */
function sala(ctx) {
  const n = Math.floor(ctx.sampleRate * 0.9);
  const ir = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c += 1) {
    const d = ir.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i += 1) {
      const t = i / ctx.sampleRate;
      const a = 0.55 - 0.45 * Math.min(1, t / 0.5);
      lp += a * (Math.random() * 2 - 1 - lp);
      d[i] = lp * Math.exp(-t * 8.6) * Math.min(1, t / 0.012);
    }
  }
  return ir;
}
const CALIDOS = new WeakMap();
/**
 * El bus de los sonidos del libro: sin lo agudo (paso bajo a 3 kHz) y con un poco de sala; se monta una vez por bus y se
 * queda (el resto de sonidos del café no pasan por aquí).
 */
function calido(b) {
  let v = CALIDOS.get(b.out);
  if (!v) {
    const { ctx } = b;
    const entrada = ctx.createGain();
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = 3000;
    fl.Q.value = 0.5;
    const seco = ctx.createGain();
    seco.gain.value = 0.9;
    const conv = ctx.createConvolver();
    conv.buffer = sala(ctx);
    const humedo = ctx.createGain();
    humedo.gain.value = 0.32;
    entrada.connect(fl);
    fl.connect(seco).connect(b.out);
    fl.connect(conv).connect(humedo).connect(b.out);
    v = entrada;
    CALIDOS.set(b.out, v);
  }
  return { ...b, out: v };
}

/**
 * Tras ver la 1.133 (Francisco, 14-11-2026: «que esto tambien tuviese sus propios sonidos»): la sala de la trastienda, distinta de
 * la del café y de la librería. Un cuarto pequeño, bajo de techo y lleno de papel: la reverberación es más corta (medio
 * segundo), más densa y más oscura, con un eco temprano de la pared del banco; y todo lo del taller pasa por ella.
 */
function salaTrastienda(ctx) {
  const n = Math.floor(ctx.sampleRate * 0.6);
  const ir = ctx.createBuffer(2, n, ctx.sampleRate);
  const temprano = Math.floor(ctx.sampleRate * 0.017);
  for (let c = 0; c < 2; c += 1) {
    const d = ir.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i += 1) {
      const t = i / ctx.sampleRate;
      const a = 0.4 - 0.32 * Math.min(1, t / 0.3);
      lp += a * (Math.random() * 2 - 1 - lp);
      d[i] = lp * Math.exp(-t * 11) * Math.min(1, t / 0.006);
    }
    // El rebote de la pared del banco, a unos seis metros de ida y vuelta
    const k = temprano + c * 23;
    for (let i = 0; i < 160; i += 1) d[k + i] += (Math.random() * 2 - 1) * 0.22 * (1 - i / 160);
  }
  return ir;
}
const TRASTIENDAS = new WeakMap();
/** El bus del taller: sin lo agudo (paso bajo a 2,6 kHz), un poco de cuerpo en la madera (220 Hz) y la sala de la trastienda. */
function trastienda(b) {
  let v = TRASTIENDAS.get(b.out);
  if (!v) {
    const { ctx } = b;
    const entrada = ctx.createGain();
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = 2600;
    fl.Q.value = 0.6;
    const cuerpo = ctx.createBiquadFilter();
    cuerpo.type = 'peaking';
    cuerpo.frequency.value = 220;
    cuerpo.Q.value = 0.9;
    cuerpo.gain.value = 3;
    const seco = ctx.createGain();
    seco.gain.value = 0.88;
    const conv = ctx.createConvolver();
    conv.buffer = salaTrastienda(ctx);
    const humedo = ctx.createGain();
    humedo.gain.value = 0.38;
    entrada.connect(fl).connect(cuerpo);
    cuerpo.connect(seco).connect(b.out);
    cuerpo.connect(conv).connect(humedo).connect(b.out);
    v = entrada;
    TRASTIENDAS.set(b.out, v);
  }
  return { ...b, out: v };
}
/** La voz de don Celestino, sin palabras: un zumbido de garganta (diente de sierra por un filtro de vocal «o») que cae un poco. */
function voz(b, { f, a, pico = 0.04, ataque = 0.04, caida = 0.2, d = 0 }) {
  const t = b.ctx.currentTime + 0.005 + d;
  const o = b.ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(a, t + ataque + caida);
  const fl = b.ctx.createBiquadFilter();
  fl.type = 'bandpass';
  fl.frequency.value = 480;
  fl.Q.value = 1.1;
  const fl2 = b.ctx.createBiquadFilter();
  fl2.type = 'lowpass';
  fl2.frequency.value = 900;
  o.connect(fl).connect(fl2).connect(env(b.ctx, t, pico, ataque, caida)).connect(b.out);
  o.start(t);
  o.stop(t + ataque + caida + 0.05);
}

const SONIDOS = {
  /** Tocar la cafetera: un soplo de vapor y el cobre que suena. */
  cafetera: (b) => {
    ruido(b, { f: 3800, tipo: 'highpass', pico: 0.25, ataque: 0.02, caida: 0.35 });
    tono(b, { f: 1240, tipo: 'triangle', pico: 0.05, caida: 0.3 });
  },
  /** Tocar la tetera: el hierro, grave, y la tapa que tintinea. */
  tetera: (b) => {
    tono(b, { f: 330, a: 300, tipo: 'triangle', pico: 0.14, caida: 0.25 });
    tono(b, { f: 1580, tipo: 'sine', pico: 0.05, caida: 0.12, d: 0.06 });
  },
  /** Tocar un tarro: el cristal y el grano (o la hoja) que se mueve dentro. */
  tarro: (b) => {
    tono(b, { f: 1760, tipo: 'sine', pico: 0.06, caida: 0.18 });
    for (let k = 0; k < 5; k += 1) ruido(b, { f: 2600 + k * 300, q: 3, pico: 0.12, caida: 0.03, d: 0.04 + k * 0.03 });
  },
  /** Una jarra o un bote: loza o latón sobre la madera. */
  jarra: (b) => {
    tono(b, { f: 300, a: 240, pico: 0.18, caida: 0.07 });
    tono(b, { f: 1320, tipo: 'triangle', pico: 0.04, caida: 0.14, d: 0.01 });
  },
  /** La manivela: cada octavo de vuelta, el grano que cruje entre las muelas. */
  clic: (b) => {
    ruido(b, { f: 1500, q: 2.5, pico: 0.32, caida: 0.045 });
    tono(b, { f: 180, a: 140, pico: 0.1, caida: 0.04 });
  },
  /** Apisonado: golpe sordo y el clac del portafiltro al encajar. */
  golpe: (b) => {
    tono(b, { f: 140, a: 60, pico: 0.3, caida: 0.14 });
    tono(b, { f: 900, a: 700, tipo: 'square', pico: 0.025, caida: 0.04, d: 0.16 });
  },
  /** La palanca llega abajo: el muelle que cede. */
  abajo: (b) => tono(b, { f: 220, a: 150, tipo: 'sawtooth', pico: 0.03, ataque: 0.02, caida: 0.2 }),
  /** Las hojas caen en el colador: un roce seco. */
  hojas: (b) => ruido(b, { f: 4200, q: 0.8, pico: 0.2, ataque: 0.01, caida: 0.22, barrido: 0.6 }),
  /** El colador entra en el agua. */
  plop: (b) => tono(b, { f: 620, a: 260, pico: 0.1, ataque: 0.002, caida: 0.09 }),
  /** Una onda al servir la leche. */
  onda: (b) => tono(b, { f: 480, a: 380, pico: 0.05, caida: 0.08 }),
  /** Una sacudida del bote de canela. */
  sacudida: (b) => {
    for (let k = 0; k < 3; k += 1) ruido(b, { f: 5200, q: 2, pico: 0.12, caida: 0.025, d: k * 0.02 });
  },
  /** El hilo de miel, que se estira. */
  hilo: (b) => tono(b, { f: 700, a: 900, pico: 0.03, ataque: 0.03, caida: 0.12 }),
  /** Una etapa terminada: dos notas de loza. */
  etapa: (b) => {
    tono(b, { f: 784, tipo: 'triangle', pico: 0.06, caida: 0.2 });
    tono(b, { f: 1175, tipo: 'triangle', pico: 0.05, caida: 0.3, d: 0.09 });
  },
  /** La taza lista: tres notas que suben, cálidas. */
  lista: (b) => [523, 659, 784].forEach((f, k) => tono(b, { f, tipo: 'triangle', pico: 0.06, caida: 0.35, d: k * 0.1 })),
  // ── Los libros (§121.3, «más cozy»): cartón, papel y madera, suaves ──
  /** Abrir la caja de reparto: la cinta que se despega y el cartón que cede. */
  cajaAbre: (b) => {
    ruido(b, { f: 2600, q: 1.4, pico: 0.12, ataque: 0.01, caida: 0.18, barrido: 0.6 });
    ruido(b, { f: 520, q: 0.9, pico: 0.22, ataque: 0.02, caida: 0.22, d: 0.14 });
    tono(b, { f: 150, a: 110, pico: 0.08, caida: 0.12, d: 0.16 });
  },
  /** Un libro que se asienta en la balda: el papel que roza y la madera, grave y blanda. */
  libroPon: (b) => {
    ruido(b, { f: 1800, q: 0.8, pico: 0.07, ataque: 0.015, caida: 0.07 });
    tono(b, { f: 210, a: 150, tipo: 'triangle', pico: 0.13, caida: 0.09, d: 0.05 });
  },
  /** Devolverlo a la caja: un roce de papel, más ligero. */
  libroQuita: (b) => ruido(b, { f: 1300, q: 1, pico: 0.07, ataque: 0.01, caida: 0.1, barrido: 0.7 }),
  /** La balda llena: dos notas de madera, como un «ya está». */
  baldaLlena: (b) => {
    tono(b, { f: 523, tipo: 'triangle', pico: 0.05, caida: 0.25 });
    tono(b, { f: 784, tipo: 'triangle', pico: 0.045, caida: 0.35, d: 0.12 });
  },
  /** Una caja comprada: la campanilla de la puerta de la distribuidora. */
  campanilla: (b) => {
    tono(b, { f: 1568, tipo: 'sine', pico: 0.05, caida: 0.5 });
    tono(b, { f: 2093, tipo: 'sine', pico: 0.035, caida: 0.6, d: 0.07 });
  },
  // ── Bloque 4a: subir de nivel y los hitos ──
  /** Subir de nivel: un arpegio de campanillas que sube, y un acorde suave debajo. */
  subeNivel: (b) => {
    [523, 659, 784, 1047].forEach((f, k) => tono(b, { f, tipo: 'triangle', pico: 0.06, caida: 0.4, d: k * 0.09 }));
    tono(b, { f: 262, tipo: 'sine', pico: 0.05, ataque: 0.04, caida: 0.9, d: 0.1 });
    tono(b, { f: 2093, tipo: 'sine', pico: 0.025, caida: 0.7, d: 0.42 });
  },
  /** Un hito: dos notas claras, como un «¡ding!». */
  hito: (b) => {
    tono(b, { f: 880, tipo: 'triangle', pico: 0.05, caida: 0.3 });
    tono(b, { f: 1319, tipo: 'triangle', pico: 0.045, caida: 0.45, d: 0.1 });
  },
  /** Elegir el chocolate: el cazo de cobre que se apoya en el hornillo. */
  cazo: (b) => {
    tono(b, { f: 520, a: 470, tipo: 'triangle', pico: 0.06, caida: 0.22 });
    ruido(b, { f: 900, q: 1.2, pico: 0.05, caida: 0.06 });
  },
  /** Remover el chocolate: el molinillo de madera que se arrastra por el fondo espeso. */
  remueve: (b) => ruido(b, { f: 420, q: 1.6, tipo: 'bandpass', pico: 0.12, ataque: 0.03, caida: 0.16, barrido: 0.7 }),
  /** Batir la nata: el tintineo de las varillas contra el bol. */
  bate: (b) => {
    tono(b, { f: 2600, a: 2400, tipo: 'triangle', pico: 0.02, caida: 0.05 });
    ruido(b, { f: 3200, q: 2, pico: 0.05, caida: 0.04 });
  },
  /** Bloque 4b: elegir el café con hielo, la cubitera de latón que suena al levantar la tapa (cubitos que se tocan). */
  cubitera: (b) => {
    tono(b, { f: 1900, a: 1750, tipo: 'triangle', pico: 0.04, caida: 0.09 });
    tono(b, { f: 2700, tipo: 'sine', pico: 0.03, caida: 0.07, d: 0.05 });
  },
  /** Agitar la coctelera: los cubitos contra el acero, un golpe por vaivén (cristalino, con algo de ruido). */
  hielo: (b) => {
    const f = 2200 + Math.random() * 900;
    tono(b, { f, a: f * 0.92, tipo: 'triangle', pico: 0.035, caida: 0.06 });
    ruido(b, { f: 5200, q: 2.2, pico: 0.06, caida: 0.05 });
  },
  /** Elegir la vainilla: la vaina que se deja en la tabla de madera. */
  vaina: (b) => tono(b, { f: 300, a: 260, tipo: 'triangle', pico: 0.06, caida: 0.1 }),
  /** Rascar la vaina: la punta del cuchillo por la piel, un raspado corto y seco. */
  raspa: (b) => ruido(b, { f: 2600, q: 3, tipo: 'bandpass', pico: 0.1, ataque: 0.02, caida: 0.14, barrido: 0.55 }),
  // ── Bloque 6c (1.129): la sala de catas ──
  /** Elegir el chai: el mortero de piedra que se arrima por la madera. */
  mortero: (b) => {
    tono(b, { f: 210, a: 180, tipo: 'triangle', pico: 0.08, caida: 0.14 });
    ruido(b, { f: 700, q: 1.4, pico: 0.05, caida: 0.06 });
  },
  /** Un golpe de la mano del mortero: piedra contra piedra, seco, y las especias que crujen. */
  machaca: (b) => {
    tono(b, { f: 150 + Math.random() * 30, a: 110, tipo: 'sine', pico: 0.14, caida: 0.09 });
    ruido(b, { f: 1800, q: 1.8, pico: 0.08, caida: 0.07, barrido: 0.6 });
  },
  /** Elegir el brûlée: la tapa del azucarero de loza. */
  azucarero: (b) => {
    tono(b, { f: 1680, a: 1560, tipo: 'triangle', pico: 0.04, caida: 0.1 });
    tono(b, { f: 2240, tipo: 'sine', pico: 0.025, caida: 0.08, d: 0.05 });
  },
  /** Encender el soplete: el chasquido de la chispa y el «fum» de la llama. */
  chispa: (b) => {
    ruido(b, { f: 4200, q: 3, pico: 0.06, caida: 0.03 });
    ruido(b, { f: 600, q: 0.8, tipo: 'lowpass', pico: 0.08, ataque: 0.02, caida: 0.16, d: 0.03 });
  },
  /** Empezar de nuevo: la taza vacía vuelve al plato. */
  vaciar: (b) => tono(b, { f: 1400, a: 1100, tipo: 'triangle', pico: 0.04, caida: 0.1 }),

  // ── 1.126: el resto del café (Francisco, 13-11-2026: «que cada acción tenga un sonido asociado»), cozy y bajito ──
  /** Un paso: madera que cede en el café, piedra en la bodega, losa en la acera; alterna pie y varía un poco. */
  paso: (b, { suelo = 'madera', n = 0 } = {}) => {
    const pie = n % 2 ? 1 : 0.92;
    const v = 0.85 + Math.random() * 0.3;
    if (suelo === 'piedra') {
      ruido(b, { f: 1500 * pie, q: 1.6, pico: 0.07 * v, ataque: 0.003, caida: 0.05 });
      tono(b, { f: 120 * pie, a: 80, pico: 0.06 * v, caida: 0.05 });
    } else if (suelo === 'acera') {
      ruido(b, { f: 2400 * pie, q: 1.1, pico: 0.06 * v, ataque: 0.004, caida: 0.06, barrido: 0.8 });
      tono(b, { f: 150 * pie, a: 100, pico: 0.04 * v, caida: 0.04 });
    } else {
      tono(b, { f: 105 * pie, a: 72, tipo: 'triangle', pico: 0.09 * v, caida: 0.07 });
      ruido(b, { f: 700 * pie, q: 1.4, pico: 0.05 * v, ataque: 0.006, caida: 0.06 });
      // De vez en cuando, una tabla que cruje
      if (Math.random() < 0.12) tono(b, { f: 380, a: 330, tipo: 'sawtooth', pico: 0.008, ataque: 0.04, caida: 0.18, d: 0.03 });
    }
  },
  /** Bajar o subir a la bodega: la tapa de la trampilla (bisagra y madera) y los peldaños; el tercero cruje. */
  planta: (b, { destino = 'bodega', duracion = 4 } = {}) => {
    const baja = destino === 'bodega';
    const tapa = baja ? 0 : duracion - 0.9;
    tono(b, { f: 520, a: 430, tipo: 'sawtooth', pico: 0.01, ataque: 0.08, caida: 0.32, d: tapa });
    tono(b, { f: 110, a: 70, tipo: 'triangle', pico: 0.12, caida: 0.16, d: tapa + 0.4 });
    ruido(b, { f: 600, q: 1, pico: 0.06, caida: 0.12, d: tapa + 0.4 });
    const desde = baja ? 0.9 : 0.4;
    const hasta = baja ? duracion - 0.3 : duracion - 1.1;
    for (let k = 0, t = desde; t < hasta; k += 1, t += 0.42) {
      tono(b, { f: baja ? 125 - k * 4 : 110 + k * 4, a: 75, tipo: 'triangle', pico: 0.075, caida: 0.08, d: t });
      ruido(b, { f: 800, q: 1.3, pico: 0.04, caida: 0.06, d: t });
      if (k === 2) tono(b, { f: 340, a: 290, tipo: 'sawtooth', pico: 0.009, ataque: 0.05, caida: 0.22, d: t + 0.02 });
    }
  },
  /** Un cliente pide: la comanda, una hoja que se arranca del bloc. */
  comanda: (b) => {
    ruido(b, { f: 3200, q: 0.9, pico: 0.07, ataque: 0.01, caida: 0.12, barrido: 0.6 });
    ruido(b, { f: 1900, q: 1.2, pico: 0.05, ataque: 0.005, caida: 0.05, d: 0.13 });
  },
  /** El cliente excéntrico: su comanda llega con un tintineo raro, como un móvil de conchas. */
  raro: (b) => [1661, 1976, 1480, 2217].forEach((f, k) => tono(b, { f, tipo: 'sine', pico: 0.025, caida: 0.5, d: k * 0.07 })),
  // 1.132: el influencer
  /** Llega en directo: el clic suave de su cámara al empezar a grabar y dos notas cálidas que suben (sin pitidos). */
  directo: (b) => {
    ruido(b, { f: 3400, q: 1.6, pico: 0.05, ataque: 0.002, caida: 0.025 });
    ruido(b, { f: 2200, q: 1.4, pico: 0.035, ataque: 0.002, caida: 0.03, d: 0.05 });
    nota(b, { f: 659.25, pico: 0.028, caida: 0.5, d: 0.12 });
    nota(b, { f: 987.77, pico: 0.024, caida: 0.6, d: 0.24 });
  },
  /** Dar la vuelta al reloj de arena: el latón que se apoya en la madera de la barra y la arena que empieza a caer. */
  arena: (b) => {
    madera(b, { f: 262, pico: 0.06, caida: 0.16 });
    tono(b, { f: 1568, a: 1540, tipo: 'sine', pico: 0.018, caida: 0.35, d: 0.02 });
    ruido(b, { f: 5200, q: 1.8, pico: 0.03, ataque: 0.12, caida: 0.6, barrido: 0.8, d: 0.08 });
  },
  /** El vídeo se hace viral: una escala que sube, como una cajita de música contenta, y un brillo de papel de foto. */
  viral: (b) => {
    [523.25, 659.25, 784, 1046.5, 1318.5].forEach((f, k) => nota(b, { f, pico: 0.022, caida: 0.55, d: k * 0.08 }));
    ruido(b, { f: 6200, q: 2.4, pico: 0.03, ataque: 0.01, caida: 0.25, barrido: 1.2, d: 0.42 });
  },
  /** Coger la taza para llevarla: la loza sobre el plato. */
  bandeja: (b) => {
    tono(b, { f: 2350, a: 2300, tipo: 'sine', pico: 0.03, caida: 0.16 });
    tono(b, { f: 3120, tipo: 'sine', pico: 0.015, caida: 0.1, d: 0.01 });
  },
  /** Dejar la taza en la mesa: el plato en la madera y la taza que asienta. */
  tazaMesa: (b) => {
    tono(b, { f: 180, a: 130, tipo: 'triangle', pico: 0.1, caida: 0.06 });
    tono(b, { f: 2600, a: 2500, tipo: 'sine', pico: 0.03, caida: 0.18, d: 0.02 });
    tono(b, { f: 2200, tipo: 'sine', pico: 0.018, caida: 0.14, d: 0.09 });
  },
  /** Recomendar un libro: se desliza por la mesa hacia el cliente. */
  libroDesliza: (b) => {
    ruido(b, { f: 1500, q: 0.7, pico: 0.06, ataque: 0.04, caida: 0.18, barrido: 0.75 });
    tono(b, { f: 200, a: 160, tipo: 'triangle', pico: 0.06, caida: 0.07, d: 0.2 });
  },
  /** Una estrella del resultado: una nota de celesta, más alta cada una. */
  estrella: (b, { k = 0 } = {}) => {
    const f = [784, 988, 1175][k] ?? 1175;
    tono(b, { f, tipo: 'sine', pico: 0.05, caida: 0.45 });
    tono(b, { f: f * 3, tipo: 'sine', pico: 0.01, caida: 0.15 });
  },
  /** Cobrar: los granos que caen en el tarro, uno a uno (con más granos, algún golpecito más). */
  granos: (b, { n = 3 } = {}) => {
    const golpes = Math.max(3, Math.min(9, Math.round(n / 2) + 2));
    for (let k = 0; k < golpes; k += 1) {
      const f = 2800 + Math.random() * 1600;
      tono(b, { f, a: f * 0.9, tipo: 'triangle', pico: 0.018, caida: 0.04, d: k * 0.055 + Math.random() * 0.02 });
      ruido(b, { f: 4200, q: 3, pico: 0.03, caida: 0.025, d: k * 0.055 });
    }
  },
  /** La reseña dorada: la tiza en la pizarra y un brillo. */
  dorada: (b) => {
    ruido(b, { f: 5200, q: 2.4, pico: 0.05, ataque: 0.01, caida: 0.2, barrido: 1.2 });
    [1319, 1760, 2637].forEach((f, k) => tono(b, { f, tipo: 'sine', pico: 0.03, caida: 0.6, d: 0.25 + k * 0.08 }));
  },
  /** Despedirse: la silla que se arrastra y la campanilla de la puerta. */
  despedida: (b) => {
    ruido(b, { f: 520, q: 1.8, pico: 0.06, ataque: 0.04, caida: 0.14, barrido: 0.8 });
    tono(b, { f: 1760, tipo: 'sine', pico: 0.03, caida: 0.6, d: 0.45 });
    tono(b, { f: 2349, tipo: 'sine', pico: 0.02, caida: 0.7, d: 0.5 });
  },
  /** Hablar con Pilar: tres sílabas suaves, un murmullo amable (sin voz). */
  pilar: (b) => {
    [0, 0.09, 0.2].forEach((d, k) => {
      const f = [392, 440, 349][k] * (0.97 + Math.random() * 0.06);
      tono(b, { f, a: f * 0.96, tipo: 'triangle', pico: 0.035, ataque: 0.015, caida: 0.06, d });
    });
  },
  /** Abrir la pizarra: la tiza que raya un poco. */
  tiza: (b) => {
    for (let k = 0; k < 3; k += 1) ruido(b, { f: 4600 + k * 400, q: 3, pico: 0.035, ataque: 0.01, caida: 0.05, d: k * 0.07 });
  },
  /** Tocar un sitio del local (la ventana, la cortina, la chimenea…): un golpecito de madera. */
  toque: (b) => tono(b, { f: 300, a: 240, tipo: 'triangle', pico: 0.06, caida: 0.05 }),
  /** El escaparate: los nudillos en el cristal. */
  cristal: (b) => {
    tono(b, { f: 1850, a: 1800, tipo: 'sine', pico: 0.035, caida: 0.2 });
    tono(b, { f: 2400, tipo: 'sine', pico: 0.02, caida: 0.15, d: 0.08 });
  },
  /** Inaugurar: el manojo de llaves que se entrega, y dos notas de bienvenida. */
  llaves: (b) => {
    for (let k = 0; k < 6; k += 1) {
      const f = 3000 + Math.random() * 2200;
      tono(b, { f, tipo: 'sine', pico: 0.022, caida: 0.12 + Math.random() * 0.1, d: k * 0.045 + Math.random() * 0.02 });
    }
    tono(b, { f: 1047, tipo: 'triangle', pico: 0.04, caida: 0.5, d: 0.35 });
    tono(b, { f: 1568, tipo: 'triangle', pico: 0.035, caida: 0.6, d: 0.45 });
  },
  // ── 1.130, la librería («especial mimo de detalle, sonido…»): latón, lomos, papel de estraza, cordel, páginas y el sello ──
  // 1.131 (Francisco, 14-11-2026: «que los sonidos sean más cozy»): rehechos más cálidos. Fuera el siseo agudo del papel (antes,
  // ruido entre 2,4 y 6 kHz con ataques secos): el papel, el cartón y el cordel suenan graves y blandos, la madera con su toque
  // afinado, y cada lomo, cada vuelta del cordel, el lazo y el sello tienen una nota de una escala pentatónica (sin notas que
  // choquen). Todos pasan por la sala de la librería (`calido`): sin agudos y con una reverberación corta de madera.
  /** Tocar la placa de una sección: el latón, templado, y el toquecito del dedo en la balda. */
  placa: (b) => {
    nota(b, { f: 784, pico: 0.03, caida: 0.5 });
    madera(b, { f: 262, pico: 0.04, caida: 0.12 });
  },
  /** El dedo que pasa por los lomos: cada uno, una nota de la escala (como pasar el dedo por un arpa) y su roce de tela. */
  lomo: (b, { k = 0 } = {}) => {
    nota(b, { f: ESCALA[k % ESCALA.length], pico: 0.024, caida: 0.42 });
    ruido(b, { f: 640 + (k % 3) * 70, q: 0.9, pico: 0.035, ataque: 0.008, caida: 0.05 });
  },
  /** Sacar el libro de la balda: el papel que roza al salir, despacio, y la madera. */
  sacar: (b) => {
    ruido(b, { f: 820, q: 0.7, pico: 0.09, ataque: 0.06, caida: 0.2, barrido: 1.25 });
    madera(b, { f: 196, pico: 0.05, d: 0.2 });
  },
  /** La tabla extraíble que sale de la estantería: la madera que corre por sus guías, los roces de la guía y el tope. */
  tabla: (b) => {
    ruido(b, { f: 300, q: 0.6, tipo: 'lowpass', pico: 0.16, ataque: 0.07, caida: 0.3, barrido: 0.85 });
    for (let k = 0; k < 3; k += 1) ruido(b, { f: 560 + Math.random() * 160, q: 2.2, pico: 0.024, caida: 0.025, d: 0.06 + k * 0.08 + Math.random() * 0.02 });
    madera(b, { f: 131, pico: 0.07, caida: 0.22, d: 0.34 });
  },
  /** El libro que se posa en la tabla: un «pof» blando. */
  libroTabla: (b) => {
    tono(b, { f: 165, a: 110, pico: 0.11, ataque: 0.004, caida: 0.1 });
    ruido(b, { f: 520, q: 0.7, tipo: 'lowpass', pico: 0.06, ataque: 0.004, caida: 0.06 });
  },
  /** Devolverlo a su sitio (o llevarlo a la bandeja): el roce y la madera. */
  devolver: (b) => {
    ruido(b, { f: 780, q: 0.7, pico: 0.08, ataque: 0.04, caida: 0.16, barrido: 0.7 });
    madera(b, { f: 175, pico: 0.045, d: 0.16 });
  },
  /** El papel de estraza que se desenrolla: crujidos graves y el rollo que gira en su soporte. */
  kraft: (b) => {
    for (let k = 0; k < 3; k += 1) ruido(b, { f: 1050 + Math.random() * 500, q: 1.1, pico: 0.05, ataque: 0.006, caida: 0.045, d: k * 0.045 + Math.random() * 0.015 });
    tono(b, { f: 98, a: 90, pico: 0.035, ataque: 0.02, caida: 0.12 });
  },
  /** Se rasga el papel: el desgarro, blando, sus fibras y el cuerpo del papel. */
  rasga: (b) => {
    ruido(b, { f: 1400, q: 0.7, pico: 0.09, ataque: 0.012, caida: 0.14, barrido: 1.35 });
    for (let k = 0; k < 4; k += 1) ruido(b, { f: 1600 + k * 150, q: 3, pico: 0.022, caida: 0.016, d: 0.03 + k * 0.03 });
    ruido(b, { f: 480, q: 0.7, tipo: 'lowpass', pico: 0.05, caida: 0.08 });
  },
  /** Un pliegue de papel: el «fum» de la solapa y el dedo que marca la arista contra la madera. */
  pliegue: (b) => {
    ruido(b, { f: 900, q: 0.8, pico: 0.08, ataque: 0.014, caida: 0.09, barrido: 0.7 });
    madera(b, { f: 294, pico: 0.03, caida: 0.12, d: 0.07 });
  },
  /**
   * El cordel que roza al dar la vuelta, cada vez un poco más tenso (más agudo); cada media vuelta, una nota que sube. La
   * cuenta vuelve a empezar con el lazo.
   */
  cordel: (b) => {
    const n = vueltaCordel;
    vueltaCordel += 1;
    ruido(b, { f: 900 + 40 * Math.min(12, n), q: 1.8, pico: 0.045, ataque: 0.016, caida: 0.07, barrido: 1.15 });
    if (n % 4 === 3) nota(b, { f: [392, 440, 523.25][Math.floor(n / 4) % 3], pico: 0.016, caida: 0.4 });
  },
  /** El lazo: dos tirones blandos y tres notas que suben, como un «listo». */
  lazo: (b) => {
    vueltaCordel = 0;
    ruido(b, { f: 950, q: 1.4, pico: 0.05, ataque: 0.008, caida: 0.04 });
    ruido(b, { f: 820, q: 1.4, pico: 0.05, ataque: 0.008, caida: 0.05, d: 0.07 });
    [523.25, 659.25, 784].forEach((f, k) => nota(b, { f, pico: 0.024 - k * 0.002, caida: 0.6, d: 0.13 + k * 0.08 }));
  },
  /** Las páginas que pasan al abrirlo: un abanico (más deprisa en medio) y el aire que mueven. */
  paginas: (b) => {
    [0, 0.032, 0.058, 0.078, 0.097, 0.12, 0.152].forEach((d) => ruido(b, { f: 850 + Math.random() * 450, q: 0.9, pico: 0.045, ataque: 0.005, caida: 0.032, d }));
    ruido(b, { f: 650, q: 0.6, tipo: 'lowpass', pico: 0.05, ataque: 0.05, caida: 0.15 });
  },
  /** El marcapáginas de cinta que se desliza entre las hojas, y un brillo pequeño. */
  marca: (b) => {
    ruido(b, { f: 1000, q: 1.4, pico: 0.06, ataque: 0.04, caida: 0.14, barrido: 0.8 });
    nota(b, { f: 784, pico: 0.012, caida: 0.45, d: 0.14 });
  },
  /** El libro que se cierra: un «tup» blando y el aire de las hojas. */
  cierra: (b) => {
    tono(b, { f: 150, a: 95, pico: 0.1, ataque: 0.004, caida: 0.09 });
    ruido(b, { f: 480, q: 0.7, tipo: 'lowpass', pico: 0.06, ataque: 0.003, caida: 0.05 });
    ruido(b, { f: 850, q: 0.6, pico: 0.025, ataque: 0.01, caida: 0.06 });
  },
  /** La bolsa de papel que se abre de un soplido: se llena de aire («fuum») y cruje un poco. */
  bolsa: (b) => {
    ruido(b, { f: 400, q: 0.7, tipo: 'lowpass', pico: 0.16, ataque: 0.016, caida: 0.12, barrido: 1.6 });
    tono(b, { f: 130, a: 190, pico: 0.05, ataque: 0.02, caida: 0.1 });
    ruido(b, { f: 1200, q: 1, pico: 0.03, ataque: 0.006, caida: 0.05, d: 0.06 });
  },
  /** El libro que se desliza al fondo de la bolsa y se asienta. */
  meter: (b) => {
    ruido(b, { f: 650, q: 0.7, tipo: 'lowpass', pico: 0.12, ataque: 0.05, caida: 0.18, barrido: 0.7 });
    tono(b, { f: 140, a: 95, pico: 0.07, caida: 0.1, d: 0.16 });
  },
  /** El sello que toca el papel (al apretar): la madera del pomo. */
  selloBaja: (b) => madera(b, { f: 330, pico: 0.028, caida: 0.08 }),
  /** El sello del café, marcado: el golpe blando, la goma con tinta y dos notas de la casa (do y sol). */
  sello: (b) => {
    tono(b, { f: 110, a: 72, pico: 0.15, ataque: 0.003, caida: 0.12 });
    ruido(b, { f: 380, q: 0.7, tipo: 'lowpass', pico: 0.07, caida: 0.05 });
    ruido(b, { f: 780, q: 1, pico: 0.02, ataque: 0.01, caida: 0.05, d: 0.02 });
    nota(b, { f: 523.25, pico: 0.022, caida: 0.7, d: 0.2 });
    nota(b, { f: 784, pico: 0.018, caida: 0.8, d: 0.3 });
  },
  /** Un paso del libro terminado (entre un gesto y el siguiente): dos toques de madera afinados, que suben. */
  libroEtapa: (b) => {
    madera(b, { f: 392, pico: 0.04, caida: 0.22 });
    madera(b, { f: 523.25, pico: 0.035, caida: 0.28, d: 0.1 });
  },
  /** El reparto de la mañana: dos golpes en la puerta, la caja que se deja y dos notas. */
  reparto: (b) => {
    tono(b, { f: 180, a: 150, tipo: 'triangle', pico: 0.08, caida: 0.05 });
    tono(b, { f: 180, a: 150, tipo: 'triangle', pico: 0.08, caida: 0.05, d: 0.16 });
    ruido(b, { f: 520, q: 0.8, tipo: 'lowpass', pico: 0.15, ataque: 0.02, caida: 0.2, d: 0.35 });
    tono(b, { f: 659, tipo: 'triangle', pico: 0.04, caida: 0.3, d: 0.62 });
    tono(b, { f: 880, tipo: 'triangle', pico: 0.035, caida: 0.4, d: 0.74 });
  },
  /** Colocarlos todos: los lomos que van llegando a sus secciones, uno detrás de otro. */
  secciones: (b, { n = 8 } = {}) => {
    for (let k = 0; k < Math.min(12, Math.max(3, n)); k += 1) {
      const f0 = 200 + Math.random() * 40;
      tono(b, { f: f0, a: f0 * 0.75, tipo: 'triangle', pico: 0.06, caida: 0.06, d: k * 0.06 });
      ruido(b, { f: 1800, q: 0.8, pico: 0.03, caida: 0.04, d: k * 0.06 });
    }
  },
  /** Pilar: «esto ya lo bordas» (su murmullo y un brillo). */
  bordas: (b) => {
    [0, 0.09, 0.2].forEach((d, k) => {
      const f = [392, 440, 494][k];
      tono(b, { f, a: f * 0.97, tipo: 'triangle', pico: 0.035, ataque: 0.015, caida: 0.06, d });
    });
    tono(b, { f: 1568, tipo: 'sine', pico: 0.02, caida: 0.5, d: 0.32 });
    tono(b, { f: 2093, tipo: 'sine', pico: 0.015, caida: 0.5, d: 0.4 });
  },
  // Decorar: coger, soltar, girar, quitar, comprar y guardar
  /** Coger un mueble: se levanta (la madera que roza, hacia arriba). */
  coger: (b) => {
    tono(b, { f: 220, a: 330, tipo: 'triangle', pico: 0.05, ataque: 0.01, caida: 0.08 });
    ruido(b, { f: 900, q: 1, pico: 0.03, caida: 0.05 });
  },
  /** Dejarlo en su sitio: un golpe blando de madera en el suelo. */
  soltar: (b) => {
    tono(b, { f: 140, a: 85, tipo: 'triangle', pico: 0.11, caida: 0.09 });
    ruido(b, { f: 500, q: 1.2, pico: 0.05, caida: 0.06 });
  },
  /** Arrastrarlo: las patas que rozan el suelo, una casilla cada vez. */
  arrastra: (b) => ruido(b, { f: 650 + Math.random() * 150, q: 1.8, pico: 0.035, ataque: 0.01, caida: 0.05 }),
  /** Girarlo: el roce de las patas al pivotar. */
  girar: (b) => {
    ruido(b, { f: 700, q: 2.2, pico: 0.05, ataque: 0.03, caida: 0.11, barrido: 1.3 });
    tono(b, { f: 160, a: 120, tipo: 'triangle', pico: 0.05, caida: 0.06, d: 0.12 });
  },
  /** Quitarlo: vuelve al almacén (un soplo de tela y la madera que se aleja). */
  quitar: (b) => {
    ruido(b, { f: 1200, q: 0.8, pico: 0.05, ataque: 0.02, caida: 0.14, barrido: 0.6 });
    tono(b, { f: 260, a: 160, tipo: 'triangle', pico: 0.04, caida: 0.12 });
  },
  /** Algo que no cabe: un toc grave y corto, sin reproche. */
  noCabe: (b) => tono(b, { f: 160, a: 140, tipo: 'triangle', pico: 0.06, caida: 0.07 }),
  /** Comprar en la tienda del café: la caja registradora antigua, su campanilla y el cajón. */
  comprar: (b) => {
    for (let k = 0; k < 4; k += 1) tono(b, { f: 3000 + k * 250, tipo: 'triangle', pico: 0.015, caida: 0.03, d: k * 0.03 });
    tono(b, { f: 2093, tipo: 'sine', pico: 0.045, caida: 0.5, d: 0.14 });
    ruido(b, { f: 400, q: 1, pico: 0.05, caida: 0.09, d: 0.2 });
  },
  /** Guardar lo decorado: dos notas de madera, «así queda». */
  guardar: (b) => {
    tono(b, { f: 392, tipo: 'triangle', pico: 0.05, caida: 0.25 });
    tono(b, { f: 587, tipo: 'triangle', pico: 0.045, caida: 0.35, d: 0.1 });
  },
  /** Abrir o cerrar un panel de papel (la pizarra, los libros) o pasar la hoja de Pilar: un papelito. */
  papel: (b) => ruido(b, { f: 2200, q: 0.9, pico: 0.05, ataque: 0.01, caida: 0.09, barrido: 0.75 }),
  // ── Bloque 6b (1.127): el tostadero ──
  /** Acercarse al tostador: el hierro templado que suena hueco y el fuego que respira en la boca. */
  tostador: (b) => {
    tono(b, { f: 98, a: 92, tipo: 'triangle', pico: 0.16, ataque: 0.01, caida: 0.5 });
    tono(b, { f: 392, tipo: 'sine', pico: 0.03, caida: 0.4, d: 0.03 });
    ruido(b, { f: 300, q: 0.6, tipo: 'lowpass', pico: 0.12, ataque: 0.08, caida: 0.5 });
  },
  /** La trampilla del tambor se abre: el pestillo de hierro y la bisagra. */
  trampillaTambor: (b) => {
    ruido(b, { f: 1800, q: 3, pico: 0.18, caida: 0.04 });
    tono(b, { f: 420, a: 300, tipo: 'square', pico: 0.02, caida: 0.06, d: 0.02 });
    tono(b, { f: 640, a: 520, tipo: 'sawtooth', pico: 0.015, ataque: 0.04, caida: 0.18, d: 0.05 });
  },
  /** El enfriador: el brazo que arrastra los granos tostados por la bandeja, que crepitan. */
  enfriador: (b) => {
    ruido(b, { f: 900, q: 0.8, pico: 0.12, ataque: 0.05, caida: 0.6, barrido: 0.8 });
    for (let k = 0; k < 7; k += 1) ruido(b, { f: 3400 + Math.random() * 1600, q: 4, pico: 0.06, caida: 0.02, d: 0.08 + k * 0.09 + Math.random() * 0.04 });
  },
  /** El saco de arpillera: la tela áspera y el grano que se asienta dentro (al recogerlo y al elegirlo en la barra). */
  saco: (b) => {
    ruido(b, { f: 1400, q: 0.7, pico: 0.12, ataque: 0.02, caida: 0.2, barrido: 0.7 });
    for (let k = 0; k < 6; k += 1) ruido(b, { f: 2200 + k * 220, q: 3, pico: 0.07, caida: 0.03, d: 0.12 + k * 0.025 });
    tono(b, { f: 130, a: 100, tipo: 'triangle', pico: 0.06, caida: 0.1, d: 0.2 });
  },
  /** El tueste de la casa, cobrado a quien lo pidió: dos campanillas de latón, una más alta. */
  tueste: (b) => {
    tono(b, { f: 1568, tipo: 'sine', pico: 0.05, caida: 0.4 });
    tono(b, { f: 2093, tipo: 'sine', pico: 0.04, caida: 0.5, d: 0.12 });
    tono(b, { f: 523, tipo: 'triangle', pico: 0.04, caida: 0.3, d: 0.12 });
  },
  // ── 1.133: el taller de la trastienda (todos por la sala cálida de madera, `DEL_TALLER`) ──
  /** La puerta baja de detrás de la barra: el picaporte, la bisagra que se queja un poco y la campanilla de dentro. */
  tallerPuerta: (b) => {
    ruido(b, { f: 1500, q: 3, pico: 0.14, caida: 0.04 });
    tono(b, { f: 520, a: 610, tipo: 'sawtooth', pico: 0.012, ataque: 0.06, caida: 0.32, d: 0.06 });
    nota(b, { f: 1318.5, pico: 0.03, caida: 0.9, d: 0.3 });
    nota(b, { f: 1760, pico: 0.02, caida: 0.8, d: 0.36 });
  },
  /**
   * Don Celestino habla: un «mm-hm» grave y amable de garganta (sin palabras), unas veces de dos golpes y otras de uno, y el
   * taburete que cruje un poco al inclinarse hacia el banco.
   */
  celestino: (b) => {
    const dos = Math.random() < 0.6;
    voz(b, { f: 132, a: 121, pico: 0.05, ataque: 0.05, caida: 0.2 });
    if (dos) voz(b, { f: 150, a: 126, pico: 0.042, ataque: 0.03, caida: 0.26, d: 0.24 });
    ruido(b, { f: 640, q: 4, pico: 0.035, ataque: 0.02, caida: 0.12, barrido: 0.85, d: dos ? 0.5 : 0.3 });
  },
  /** Un cuarto de la tapa, limpio: un soplo de polvo que se va a contraluz y una nota de madera que sube con cada cuarto. */
  polvoClaro: (b, datos = {}) => {
    const k = Math.max(1, Math.min(3, datos.k ?? 1));
    ruido(b, { f: 1900, q: 0.7, pico: 0.06, ataque: 0.04, caida: 0.3, barrido: 0.55 });
    madera(b, { f: ESCALA[k + 1], pico: 0.03, caida: 0.32, d: 0.1 });
    nota(b, { f: ESCALA[k + 3] * 2, pico: 0.008, caida: 0.6, d: 0.16 });
  },
  /** Coger una herramienta del banco: madera sobre el tapete y un roce. */
  herramienta: (b, datos = {}) => {
    madera(b, { f: datos.f ?? 330, pico: 0.05, caida: 0.14 });
    ruido(b, { f: 1600, q: 0.8, pico: 0.03, ataque: 0.01, caida: 0.07 });
  },
  /** Una mancha de moho que se va: un soplito y una nota pequeña. */
  moho: (b) => {
    ruido(b, { f: 2600, q: 1, pico: 0.05, ataque: 0.01, caida: 0.16, barrido: 0.6 });
    nota(b, { f: 784, pico: 0.018, caida: 0.5, d: 0.04 });
  },
  /** Una mancha borrada: dos notas suaves de cajita (la última, más alta). */
  manchaFuera: (b, datos = {}) => {
    const k = Math.min(ESCALA.length - 2, datos.k ?? 0);
    nota(b, { f: ESCALA[k + 2], pico: 0.025, caida: 0.55 });
    nota(b, { f: ESCALA[k + 4] ?? 880, pico: 0.02, caida: 0.6, d: 0.08 });
  },
  /** Barrer las migas con el canto de la mano: un soplo largo que se va. */
  migas: (b) => {
    ruido(b, { f: 3200, q: 0.7, pico: 0.08, ataque: 0.03, caida: 0.35, barrido: 0.5 });
    for (let k = 0; k < 5; k += 1) ruido(b, { f: 4200 + k * 300, q: 4, pico: 0.03, caida: 0.02, d: 0.12 + k * 0.04 });
  },
  /** 1.133.2: un tramo del pliegue, a medias: el papel que cede bajo la plegadera (un crujido suave y un toque grave). */
  aplana: (b, datos = {}) => {
    const k = datos.k ?? 0;
    ruido(b, { f: 1500 + k * 60, q: 1.6, pico: 0.03, ataque: 0.006, caida: 0.06, barrido: 0.8 });
    madera(b, { f: ESCALA[k % 3] / 2, pico: 0.018, caida: 0.1 });
  },
  /** 1.133.2: un tramo del pliegue, ya liso: un toque de madera que sube con cada tramo, como si el papel se afinara. */
  liso: (b, datos = {}) => {
    const k = Math.max(1, datos.k ?? 1);
    madera(b, { f: ESCALA[(k - 1) % ESCALA.length] * (k > ESCALA.length ? 2 : 1), pico: 0.032, caida: 0.22 });
    ruido(b, { f: 2200, q: 1.2, pico: 0.025, ataque: 0.01, caida: 0.06, barrido: 1.3 });
  },
  /** El pliegue entero, liso: el papel que se tensa y queda plano. */
  alisado: (b, datos = {}) => {
    ruido(b, { f: 1800, q: 1.4, pico: 0.06, ataque: 0.02, caida: 0.18, barrido: 1.4 });
    madera(b, { f: datos.ultima ? 523.25 : 392, pico: 0.035, caida: 0.3, d: 0.08 });
  },
  /** Un cuarto de vuelta del husillo: la madera que cruje y el hierro de la rosca. */
  husillo: (b, datos = {}) => {
    const k = datos.k ?? 0;
    ruido(b, { f: 700 + k * 40, q: 3, pico: 0.07, ataque: 0.01, caida: 0.09, barrido: 0.8 });
    tono(b, { f: 210 + k * 6, a: 190 + k * 6, tipo: 'triangle', pico: 0.03, caida: 0.07 });
  },
  /** La prensa llega al tope: un crujido largo de madera y un golpe sordo, «ya está». */
  tope: (b) => {
    ruido(b, { f: 520, q: 2.5, pico: 0.1, ataque: 0.02, caida: 0.4, barrido: 0.7 });
    tono(b, { f: 110, a: 82, tipo: 'triangle', pico: 0.12, caida: 0.22, d: 0.22 });
    madera(b, { f: 262, pico: 0.04, caida: 0.4, d: 0.26 });
  },
  /** El hierro caliente toca el pan de oro: un chisporroteo muy breve. */
  hierro: (b) => {
    for (let k = 0; k < 4; k += 1) ruido(b, { f: 5200 + Math.random() * 1600, q: 5, pico: 0.02, caida: 0.015, d: k * 0.025 });
    ruido(b, { f: 900, q: 0.8, pico: 0.02, ataque: 0.02, caida: 0.18 });
  },
  /** Una letra dorada: un tintineo suave que sube con cada letra. */
  oro: (b, datos = {}) => {
    const k = datos.k ?? 0;
    const f = ESCALA[k % ESCALA.length] * (k >= ESCALA.length ? 2 : 1);
    nota(b, { f: f * 2, pico: 0.022, caida: 0.7 });
    tono(b, { f: f * 5.04, pico: 0.006, caida: 0.25, d: 0.01 });
  },
  /**
   * El ex libris (1.133.2, Francisco: «el sello necesito que sea mas impactante»): el golpe hondo del sello de nogal sobre el
   * libro (un bombo grave que cae, la madera y el papel que se aplasta) y, detrás, un acorde que se abre, como la casa que lo
   * celebra.
   */
  exlibris: (b) => {
    tono(b, { f: 96, a: 50, pico: 0.24, ataque: 0.002, caida: 0.28 });
    tono(b, { f: 190, a: 118, tipo: 'triangle', pico: 0.05, ataque: 0.002, caida: 0.1 });
    madera(b, { f: 147, pico: 0.08, caida: 0.24 });
    ruido(b, { f: 420, q: 0.7, tipo: 'lowpass', pico: 0.15, ataque: 0.002, caida: 0.13 });
    ruido(b, { f: 2600, q: 0.9, pico: 0.045, ataque: 0.004, caida: 0.1, barrido: 0.6, d: 0.012 });
    [392, 493.88, 587.33, 783.99].forEach((f, i) => nota(b, { f, pico: 0.024, caida: 1.15, d: 0.26 + i * 0.075 }));
  },
  /** El sello se apoya en la guarda: la goma que toca el papel, blandita. */
  selloApoya: (b) => {
    madera(b, { f: 220, pico: 0.03, caida: 0.08 });
    ruido(b, { f: 900, q: 0.8, pico: 0.03, ataque: 0.004, caida: 0.05 });
  },
  /** El sello se despega: la goma que suelta el papel con la tinta aún húmeda. */
  selloLevanta: (b) => {
    ruido(b, { f: 1400, q: 2.2, pico: 0.04, ataque: 0.03, caida: 0.13, barrido: 1.6 });
    tono(b, { f: 300, a: 520, pico: 0.012, ataque: 0.04, caida: 0.1 });
  },
  /** Abrir o cerrar el libro en el banco: las hojas que respiran y la tapa sobre el tapete. */
  libroAbre: (b) => {
    ruido(b, { f: 2400, q: 0.8, pico: 0.05, ataque: 0.04, caida: 0.2, barrido: 0.7 });
    madera(b, { f: 233, pico: 0.035, caida: 0.18, d: 0.18 });
  },
  /** Un daño arreglado: tres notas que suben (el banco aprueba). */
  danoHecho: (b, datos = {}) => {
    const base = datos.bien ? 2 : 1;
    [0, 2, 4].forEach((k, i) => nota(b, { f: ESCALA[Math.min(ESCALA.length - 1, base + k)], pico: 0.024, caida: 0.55, d: i * 0.09 }));
  },
  /** La ficha «antes / después»: la cartulina sobre el banco. */
  ficha: (b) => {
    ruido(b, { f: 1600, q: 0.9, pico: 0.06, ataque: 0.01, caida: 0.12, barrido: 0.75 });
    madera(b, { f: 349.23, pico: 0.03, caida: 0.2, d: 0.06 });
  },
  /** El cliente recoge su libro: la campanilla de la puerta y el pago, granos en un platillo. */
  entregaTaller: (b) => {
    nota(b, { f: 1046.5, pico: 0.03, caida: 0.8 });
    nota(b, { f: 1318.5, pico: 0.025, caida: 0.8, d: 0.12 });
    for (let k = 0; k < 6; k += 1) ruido(b, { f: 3000 + k * 250, q: 4, pico: 0.03, caida: 0.025, d: 0.3 + k * 0.035 });
  },
  // ── 1.143: el obrador (por la sala cálida, como el libro) ──
  /** El tabique que cae y deja ver el horno: un golpe sordo, el yeso que se desmorona y, al final, un acorde cálido. */
  tabique: (b) => {
    tono(b, { f: 90, a: 60, pico: 0.14, ataque: 0.005, caida: 0.35 });
    ruido(b, { f: 700, q: 0.6, tipo: 'lowpass', pico: 0.2, ataque: 0.01, caida: 0.6, barrido: 0.5 });
    ruido(b, { f: 2400, q: 1.5, pico: 0.05, ataque: 0.02, caida: 0.4, d: 0.12 });
    [392, 523.25, 659.25].forEach((f, k) => nota(b, { f, pico: 0.03, caida: 0.9, d: 0.45 + k * 0.08 }));
  },
  /** Abrir el recetario: el hule que cruje y una página. */
  recetario: (b) => {
    ruido(b, { f: 1800, q: 0.8, pico: 0.06, ataque: 0.01, caida: 0.12 });
    ruido(b, { f: 3200, q: 1.2, pico: 0.04, ataque: 0.02, caida: 0.18, barrido: 0.7, d: 0.08 });
  },
  /** Pasar una ficha del recetario (la pinza de la ropa que se suelta y la cartulina). */
  fichaReceta: (b) => {
    madera(b, { f: 880, pico: 0.03, caida: 0.06 });
    ruido(b, { f: 2600, q: 1.1, pico: 0.035, ataque: 0.01, caida: 0.1, barrido: 0.8, d: 0.03 });
  },
  /** Rallar el limón: el roce áspero del latón, y un poquito de aroma (una notita aguda). */
  rallar: (b) => {
    ruido(b, { f: 5200, q: 2.2, pico: 0.07, ataque: 0.003, caida: 0.05, barrido: 0.8 });
    ruido(b, { f: 2900, q: 3, pico: 0.03, ataque: 0.002, caida: 0.03 });
  },
  /** La masa que cae de la cuchara al molde: un «plof» blando. */
  masa: (b) => {
    tono(b, { f: 220, a: 150, pico: 0.07, ataque: 0.006, caida: 0.1 });
    ruido(b, { f: 500, q: 1.4, tipo: 'lowpass', pico: 0.06, ataque: 0.005, caida: 0.07 });
  },
  /** Un molde colmado justo: una notita de madera. */
  colmado: (b) => madera(b, { f: 659.25, pico: 0.035, caida: 0.14 }),
  /** El molde que rebosa: un chof más grave. */
  rebosa: (b) => {
    tono(b, { f: 150, a: 90, pico: 0.06, ataque: 0.01, caida: 0.16 });
    ruido(b, { f: 380, q: 1, tipo: 'lowpass', pico: 0.06, ataque: 0.01, caida: 0.12 });
  },
  /** El rodillo de madera que rueda sobre la masa y el mármol. */
  rodillo: (b) => {
    ruido(b, { f: 260, q: 1.6, tipo: 'bandpass', pico: 0.08, ataque: 0.01, caida: 0.1 });
    madera(b, { f: 196, pico: 0.02, caida: 0.08 });
  },
  /** El rodillo da la vuelta: un toquecito de madera en el mármol. */
  vueltaRodillo: (b) => madera(b, { f: 330, pico: 0.03, caida: 0.07 }),
  /** Un pellizco del repulgo: la masa blandita entre los dedos, un poco más aguda en cada tramo. */
  pellizco: (b, k = 0) => {
    tono(b, { f: 520 + (k % 8) * 22, a: 380, pico: 0.03, ataque: 0.004, caida: 0.06 });
    ruido(b, { f: 1500, q: 1.3, pico: 0.025, ataque: 0.003, caida: 0.03 });
  },
  /** El gesto hecho: dos notas cálidas que suben. */
  obradorHecho: (b) => {
    nota(b, { f: 523.25, pico: 0.035, caida: 0.5 });
    nota(b, { f: 783.99, pico: 0.03, caida: 0.7, d: 0.1 });
  },
  /** La pala de madera sobre la solera de ladrillo (al meterla y al sacarla). */
  pala: (b) => {
    ruido(b, { f: 900, q: 0.9, pico: 0.09, ataque: 0.02, caida: 0.32, barrido: 0.6 });
    madera(b, { f: 147, pico: 0.05, caida: 0.2, d: 0.28 });
  },
  /** Dentro del horno: el soplo del calor y unas brasas que crepitan. */
  horno: (b) => {
    ruido(b, { f: 400, q: 0.5, tipo: 'lowpass', pico: 0.1, ataque: 0.06, caida: 0.5 });
    for (let k = 0; k < 5; k += 1) ruido(b, { f: 3000 + k * 400, q: 4, pico: 0.03, ataque: 0.001, caida: 0.012, d: 0.1 + Math.random() * 0.5 });
  },
  /** La campanilla de latón del horno: la hornada está lista. */
  campanillaHorno: (b) => {
    for (const [d, f] of [
      [0, 1318.5],
      [0.16, 1318.5],
      [0.32, 1568],
    ]) {
      tono(b, { f, tipo: 'sine', pico: 0.045, caida: 0.55, d });
      tono(b, { f: f * 2.76, tipo: 'sine', pico: 0.012, caida: 0.18, d });
    }
  },
  /** Las pinzas de latón que se cierran sobre la pieza: un clic de metal. */
  pinza: (b) => {
    tono(b, { f: 2900, tipo: 'triangle', pico: 0.04, ataque: 0.001, caida: 0.04 });
    tono(b, { f: 4100, tipo: 'sine', pico: 0.02, ataque: 0.001, caida: 0.06, d: 0.02 });
  },
  /** La pieza en el plato de loza. */
  plato: (b) => {
    tono(b, { f: 1760, tipo: 'sine', pico: 0.035, ataque: 0.002, caida: 0.25 });
    ruido(b, { f: 2200, q: 2, pico: 0.03, ataque: 0.002, caida: 0.03 });
  },
  /** La vitrina: la campana de cristal que se levanta. */
  vitrina: (b) => {
    tono(b, { f: 2349, tipo: 'sine', pico: 0.025, caida: 0.5 });
    tono(b, { f: 3136, tipo: 'sine', pico: 0.015, caida: 0.4, d: 0.05 });
  },
};

/**
 * 1.128 (Francisco, 13-11-2026: «algunos sonidos suenan muy fuerte»): medidos uno a uno (`medirSonidos`), la mayoría queda
 * hacia −40 dB de volumen medio y estos sobresalían (el golpe del apisonador, a −24,5; la cafetera, el tostador, la jarra y la
 * tetera, hacia −30; los pasos, que se repiten mucho, a −34). Se bajan a la altura del resto sin cambiar cómo suenan.
 */
const GANANCIA = {
  golpe: 0.33,
  cafetera: 0.5,
  tostador: 0.55,
  jarra: 0.55,
  tetera: 0.6,
  clic: 0.65,
  plop: 0.7,
  soltar: 0.7,
  paso: 0.6,
  libroPon: 0.7,
  hojas: 0.65,
  subeNivel: 0.8,
  cajaAbre: 0.8,
  // 1.130: la tabla, la bolsa y el sello, a la altura del resto
  tabla: 0.8,
  bolsa: 0.85,
  sello: 0.7,
  // 1.131: los del libro, rehechos, con el mismo pico que tenían (o algo menos): la placa y el papel, un poco más bajos; la
  // cinta del marcapáginas, las páginas y el cordel (que la sala apaga algo), un poco más altos
  placa: 0.75,
  kraft: 0.7,
  lomo: 1.15,
  cordel: 1.3,
  marca: 1.3,
  paginas: 1.2,
  // 1.133.2: el golpe del ex libris, que tiene que notarse, pero sin sobresalir tanto como el apisonador de antes
  exlibris: 0.6,
};

/** Lo que suena mientras se mantiene: el café que cae, el agua y el vapor (su color cambia con la leche). */
// 1.128: más bajos; el vapor (un siseo agudo continuo) era el que más molestaba
const BUCLES = {
  palanca: { tipo: 'lowpass', f: 700, q: 0.7, pico: 0.17 },
  tetera: { tipo: 'bandpass', f: 1100, q: 0.9, pico: 0.17 },
  vapor: { tipo: 'highpass', f: 2600, q: 0.7, pico: 0.045 },
  cazo: { tipo: 'lowpass', f: 480, q: 0.8, pico: 0.2 },
  /** Bloque 6b: los granos tostados que caen por la rampa al enfriador (un chisporroteo seco). */
  granosCaen: { tipo: 'bandpass', f: 3000, q: 1.4, pico: 0.12 },
  /** Bloque 6c: la llama del soplete, un soplido suave y continuo. */
  soplete: { tipo: 'bandpass', f: 1500, q: 0.6, pico: 0.07 },
  // 1.133: lo que suena mientras se trabaja en el taller, bajito
  /** El roce de las cerdas de la brocha sobre la tela. */
  brocha: { tipo: 'bandpass', f: 4200, q: 0.8, pico: 0.035 },
  /** La goma de miga que frota el papel (más grave y blando). */
  goma: { tipo: 'bandpass', f: 1300, q: 1.2, pico: 0.05 },
  /** La plegadera que se desliza por el papel. */
  plegadera: { tipo: 'bandpass', f: 2600, q: 1.6, pico: 0.03 },
  /** El pincel con la cola caliente: húmedo y espeso. */
  cola: { tipo: 'lowpass', f: 900, q: 1.1, pico: 0.06 },
};

/** 1.131: los sonidos del libro, que suenan en la sala de la librería (`calido`). */
const DEL_LIBRO = new Set(['tabique', 'recetario', 'fichaReceta', 'rallar', 'masa', 'colmado', 'rebosa', 'rodillo', 'vueltaRodillo', 'pellizco', 'obradorHecho', 'pala', 'horno', 'campanillaHorno', 'pinza', 'plato', 'vitrina', 'placa', 'lomo', 'sacar', 'tabla', 'libroTabla', 'devolver', 'kraft', 'rasga', 'pliegue', 'cordel', 'lazo', 'paginas', 'marca', 'cierra', 'bolsa', 'meter', 'selloBaja', 'sello', 'libroEtapa', 'reparto', 'secciones']);
/** 1.133: los del taller de la trastienda, por la misma sala cálida. */
const DEL_TALLER = new Set([
  'tallerPuerta',
  'celestino',
  'herramienta',
  'polvoClaro',
  'moho',
  'manchaFuera',
  'migas',
  'aplana',
  'liso',
  'alisado',
  'husillo',
  'tope',
  'hierro',
  'oro',
  'exlibris',
  'selloApoya',
  'selloLevanta',
  'libroAbre',
  'danoHecho',
  'ficha',
  'entregaTaller',
]);
/** Los bucles del taller, que también suenan en la trastienda. */
const BUCLES_TALLER = new Set(['brocha', 'goma', 'plegadera', 'cola']);
/** El bus de un sonido: el del libro, por la sala de la librería; el del taller, por la trastienda; y con su ganancia. */
const busDe = (b, nombre) => conGanancia(DEL_TALLER.has(nombre) ? trastienda(b) : DEL_LIBRO.has(nombre) ? calido(b) : b, nombre);

/** El bus de un sonido con su ganancia (la de `GANANCIA`, si la tiene). */
function conGanancia(b, nombre) {
  const k = GANANCIA[nombre];
  if (!k) return b;
  const g = b.ctx.createGain();
  g.gain.value = k;
  g.connect(b.out);
  setTimeout(() => g.disconnect(), 3000);
  return { ...b, out: g };
}

export function crearSfxBarra() {
  let activo = false;
  const bucles = {};
  const bus = () => (activo ? uiSfxBus() : null);
  return {
    /** Sonido del edificio encendido o apagado (además de «Sonidos táctiles»). */
    setActivo(on) {
      activo = Boolean(on);
      if (!activo) for (const k of Object.keys(bucles)) this.bucle(k, false);
    },
    play(nombre, datos) {
      // Para las pruebas: qué suena, en orden (con el sonido del edificio activado; aunque el navegador no tenga Web Audio)
      if (import.meta.env?.DEV && activo && SONIDOS[nombre] && typeof window !== 'undefined') (window.__cafeSonidos ??= []).push(nombre);
      const b = bus();
      if (!b || !SONIDOS[nombre]) return;
      try {
        SONIDOS[nombre](busDe(b, nombre), datos);
      } catch {
        /* un fallo de audio nunca bloquea nada */
      }
    },
    /** Encender o apagar un bucle; `color` (0 a 1) mueve su filtro (la leche que se crea suena más grave). */
    bucle(nombre, on, color = 0) {
      const cur = bucles[nombre];
      if (!on) {
        if (cur) {
          try {
            const t = cur.ctx.currentTime;
            cur.g.gain.cancelScheduledValues(t);
            cur.g.gain.setValueAtTime(Math.max(0.0001, cur.g.gain.value), t);
            cur.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
            cur.s.stop(t + 0.1);
          } catch {
            /* nada */
          }
          delete bucles[nombre];
        }
        return;
      }
      const def = BUCLES[nombre];
      if (cur) {
        cur.fl.frequency.setTargetAtTime(def.f * (1 - 0.45 * color), cur.ctx.currentTime, 0.1);
        return;
      }
      const b = bus();
      if (!b || !def) return;
      try {
        const t = b.ctx.currentTime + 0.005;
        const s = b.ctx.createBufferSource();
        s.buffer = ruidoDe(b.ctx);
        s.loop = true;
        const fl = b.ctx.createBiquadFilter();
        fl.type = def.tipo;
        fl.frequency.value = def.f;
        fl.Q.value = def.q;
        const g = b.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(def.pico, t + 0.08);
        s.connect(fl).connect(g).connect(BUCLES_TALLER.has(nombre) ? trastienda(b).out : b.out);
        s.start(t);
        bucles[nombre] = { ctx: b.ctx, s, fl, g };
      } catch {
        /* nada */
      }
    },
    apagar() {
      for (const k of Object.keys(bucles)) this.bucle(k, false);
    },
  };
}

/**
 * 1.128 (Francisco, 13-11-2026: «algunos sonidos suenan muy fuerte»): cada sonido renderizado aparte, para medirlo (pruebas).
 * Devuelve { nombre: { pico, rms } } en dBFS; el RMS, de la parte que suena (por encima de −50 dB).
 */
export async function medirSonidos(nombres = Object.keys(SONIDOS), datos = {}) {
  const out = {};
  for (const nombre of nombres) {
    const ctx = new OfflineAudioContext(1, 44100 * 2, 44100);
    SONIDOS[nombre](busDe({ ctx, out: ctx.destination }, nombre), datos[nombre]);
    const d = (await ctx.startRendering()).getChannelData(0);
    let pico = 0;
    let suma = 0;
    let n = 0;
    for (const v of d) pico = Math.max(pico, Math.abs(v));
    const umbral = pico * 10 ** (-50 / 20);
    for (const v of d)
      if (Math.abs(v) > umbral) {
        suma += v * v;
        n += 1;
      }
    const db = (x) => Math.round(20 * Math.log10(Math.max(1e-9, x)) * 10) / 10;
    out[nombre] = { pico: db(pico), rms: db(Math.sqrt(suma / Math.max(1, n))) };
  }
  return out;
}
