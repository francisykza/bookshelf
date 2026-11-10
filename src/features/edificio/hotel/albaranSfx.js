// Sonidos de «Sella el albarán» (1.99, §99): sintetizados con Web Audio, breves y bajitos, uno por acción. Solo suenan con
// el sonido del edificio activado y después de que la persona toque algo (el contexto se crea con el primer golpe).

let ctx = null;
function audio() {
  if (!ctx) {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tono(a, { freq, to = freq, type = 'sine', gain = 0.05, length = 0.12, delay = 0 }) {
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + length);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + length + 0.03);
}

function ruido(a, { gain = 0.04, length = 0.08, freq = 1800, delay = 0 }) {
  const t = a.currentTime + delay;
  const n = Math.floor(a.sampleRate * length);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = a.createBufferSource();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  src.buffer = buf;
  f.type = 'bandpass';
  f.frequency.value = freq;
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

const SONIDOS = {
  /** El sello baja: golpe de madera sobre papel. */
  golpe: (a) => {
    tono(a, { freq: 150, to: 70, gain: 0.12, length: 0.13 });
    ruido(a, { gain: 0.05, length: 0.05, freq: 900 });
  },
  /** Dentro de la casilla: un clic de tinta y una nota corta. */
  sellado: (a) => tono(a, { freq: 660, to: 700, type: 'triangle', gain: 0.035, length: 0.16, delay: 0.05 }),
  /** Clavado en el centro: dos notas de campanilla. */
  clavado: (a) => {
    tono(a, { freq: 880, type: 'triangle', gain: 0.035, length: 0.18, delay: 0.05 });
    tono(a, { freq: 1320, type: 'triangle', gain: 0.03, length: 0.26, delay: 0.13 });
  },
  /** Fuera: un roce de papel, sin castigo. */
  fuera: (a) => ruido(a, { gain: 0.035, length: 0.12, freq: 2400, delay: 0.03 }),
  /** El plano entra en la cinta. */
  entra: (a) => ruido(a, { gain: 0.018, length: 0.1, freq: 3200 }),
  /** Albarán cerrado: tres notas que suben (más alto cuantos más sellos). */
  final: (a, n = 0) => [523, 659, 784, 1047].slice(0, n + 1).forEach((f, i) => tono(a, { freq: f, type: 'triangle', gain: 0.03, length: 0.24, delay: i * 0.11 })),
};

/** Toca un sonido si el sonido está activado. */
export function sonar(nombre, activo, extra) {
  if (!activo) return;
  const a = audio();
  if (a) SONIDOS[nombre]?.(a, extra);
}
