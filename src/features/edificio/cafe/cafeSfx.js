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
    play(nombre) {
      const b = bus();
      if (!b || !SONIDOS[nombre]) return;
      try {
        SONIDOS[nombre](b);
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
