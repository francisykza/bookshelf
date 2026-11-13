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
};

/** Lo que suena mientras se mantiene: el café que cae, el agua y el vapor (su color cambia con la leche). */
const BUCLES = {
  palanca: { tipo: 'lowpass', f: 700, q: 0.7, pico: 0.22 },
  tetera: { tipo: 'bandpass', f: 1100, q: 0.9, pico: 0.3 },
  vapor: { tipo: 'highpass', f: 2600, q: 0.7, pico: 0.12 },
  cazo: { tipo: 'lowpass', f: 480, q: 0.8, pico: 0.2 },
};

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
        SONIDOS[nombre](b, datos);
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
        s.connect(fl).connect(g).connect(b.out);
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
