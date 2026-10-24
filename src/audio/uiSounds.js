// Sonidos de interfaz (SPEC §17.5): un catálogo semántico de eventos por material (papel, madera, cerámica,
// latón), sintetizados con Web Audio (procedurales: no son grabaciones). Única entrada: `playUiSound(evento)`.
// Reutiliza el AudioContext del ambiente con un bus de efectos propio y volumen independiente; como máximo tres
// sonidos breves a la vez y 80 ms entre repeticiones del mismo evento. Un fallo de audio nunca bloquea nada.
import { bell, sfxEnabled, sharedAudio } from './ambientAudio';

const MIN_GAP_MS = 80;
const MAX_VOICES = 3;
let volume = 0.25;
let bus = null;
let busCtx = null;
let noiseBuf = null;

/** Volumen de los efectos de interfaz (0–1); por defecto 25 %. */
export function setUiVolume(v) {
  volume = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.25));
  if (bus) bus.gain.value = volume;
}

/**
 * Puerta de reproducción (pura, para pruebas): limita repeticiones del mismo evento y voces simultáneas.
 * `now` en ms. Devuelve `true` si se puede sonar y registra la voz durante `durationMs`.
 */
export function createSoundGate({ minGap = MIN_GAP_MS, maxVoices = MAX_VOICES } = {}) {
  const last = new Map();
  let voices = [];
  return (event, now, durationMs) => {
    voices = voices.filter((end) => end > now);
    if (now - (last.get(event) ?? -Infinity) < minGap) return false;
    if (voices.length >= maxVoices) return false;
    last.set(event, now);
    voices.push(now + durationMs);
    return true;
  };
}
const gate = createSoundGate();

/** Registro de eventos en desarrollo (para las pruebas de emisión única); no existe en producción. */
const log = (event) => {
  if (import.meta.env?.DEV && typeof window !== 'undefined') (window.__uiSoundLog ??= []).push({ event, at: Math.round(performance.now()) });
};

function ensureBus() {
  const shared = sharedAudio();
  if (!shared) return null;
  if (!bus || busCtx !== shared.ctx) {
    busCtx = shared.ctx;
    bus = shared.ctx.createGain();
    bus.gain.value = volume;
    bus.connect(shared.master);
    const len = Math.floor(shared.ctx.sampleRate * 0.5);
    noiseBuf = shared.ctx.createBuffer(1, len, shared.ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
  }
  return shared.ctx;
}

/** Envolvente con rampas cortas (sin clics de audio). */
function envelope(ctx, t, peak, attack, release) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  return g;
}

/** Ruido filtrado: papel (agudo, con barrido), algodón (suave), madera (banda media). */
function noise(ctx, t, { type = 'bandpass', freq, q = 1, peak, attack = 0.006, release, sweep = 1 }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweep !== 1) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + attack + release);
  f.Q.value = q;
  const env = envelope(ctx, t, peak, attack, release);
  src.connect(f).connect(env).connect(bus);
  src.start(t, Math.random() * 0.3);
  src.stop(t + attack + release + 0.02);
}

/** Tono con decaimiento: golpe de madera (grave), cerámica o latón (agudos inarmónicos). */
function tone(ctx, t, { freq, peak, attack = 0.003, release, type = 'sine', glide = 1 }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glide !== 1) osc.frequency.exponentialRampToValueAtTime(freq * glide, t + attack + release);
  const env = envelope(ctx, t, peak, attack, release);
  osc.connect(env).connect(bus);
  osc.start(t);
  osc.stop(t + attack + release + 0.02);
}

/** Recetas por evento: material, nivel normalizado y duración objetivo (ms). */
const RECIPES = {
  // Roce de madera y libro
  libraryOpen: { ms: 180, play: (c, t) => (noise(c, t, { freq: 900, q: 0.9, peak: 0.5, release: 0.16, sweep: 0.7 }), tone(c, t, { freq: 160, peak: 0.25, release: 0.12, glide: 0.8 })) },
  // Cubierta y papel
  bookOpen: { ms: 200, play: (c, t) => (tone(c, t, { freq: 120, peak: 0.22, release: 0.09 }), noise(c, t + 0.04, { type: 'highpass', freq: 2400, q: 0.7, peak: 0.32, release: 0.15, sweep: 0.6 })) },
  // Hoja de algodón
  diaryTab: { ms: 95, play: (c, t) => noise(c, t, { type: 'lowpass', freq: 2000, q: 0.5, peak: 0.3, release: 0.085 }) },
  // Paso de página breve
  monthTurn: { ms: 90, play: (c, t) => noise(c, t, { type: 'highpass', freq: 3000, q: 0.6, peak: 0.28, release: 0.08, sweep: 0.55 }) },
  // Toque suave de madera
  select: { ms: 60, play: (c, t) => (tone(c, t, { freq: 420, peak: 0.3, release: 0.05, glide: 0.9 }), noise(c, t, { freq: 1300, q: 2, peak: 0.12, release: 0.03 })) },
  // Contacto de lápiz
  pencil: { ms: 55, play: (c, t) => noise(c, t, { freq: 4200, q: 3, peak: 0.22, attack: 0.004, release: 0.045 }) },
  // Sello sobre papel
  save: { ms: 130, play: (c, t) => (tone(c, t, { freq: 110, peak: 0.42, release: 0.11, glide: 0.7 }), noise(c, t, { type: 'lowpass', freq: 1400, q: 0.7, peak: 0.26, release: 0.08 })) },
  // Papel amortiguado
  close: { ms: 95, play: (c, t) => noise(c, t, { type: 'lowpass', freq: 1100, q: 0.5, peak: 0.3, release: 0.085, sweep: 0.6 }) },
  // Cerámica suave
  timer: { ms: 120, play: (c, t) => (tone(c, t, { freq: 2350, peak: 0.12, release: 0.11 }), tone(c, t, { freq: 6100, peak: 0.03, release: 0.06 })) },
  // Pestillo de latón: dos contactos metálicos
  atticOpen: {
    ms: 160,
    play: (c, t) => {
      tone(c, t, { freq: 3100, peak: 0.07, release: 0.04, type: 'triangle' });
      noise(c, t, { freq: 2600, q: 4, peak: 0.16, release: 0.03 });
      tone(c, t + 0.08, { freq: 2500, peak: 0.06, release: 0.07, type: 'triangle' });
      noise(c, t + 0.08, { freq: 2100, q: 4, peak: 0.12, release: 0.05 });
    },
  },
  // Contacto discreto sobre madera
  figureSelect: { ms: 70, play: (c, t) => tone(c, t, { freq: 300, peak: 0.26, release: 0.06, glide: 0.85 }) },
};

export const UI_EVENTS = [...Object.keys(RECIPES), 'sessionEnd'];

/**
 * Reproduce un evento de interfaz. Respeta «Sonidos táctiles», la puerta de repeticiones y voces, y no lanza
 * nunca: si el navegador no permite audio todavía, simplemente no suena.
 */
export function playUiSound(event, { force = false } = {}) {
  try {
    if (!force && !sfxEnabled()) return false;
    if (event === 'sessionEnd') {
      log(event);
      bell();
      return true;
    }
    const recipe = RECIPES[event];
    if (!recipe || !gate(event, performance.now(), recipe.ms)) return false;
    // Se registra la emisión (una por acción) aunque el navegador aún no permita reproducir audio
    log(event);
    const ctx = ensureBus();
    if (!ctx) return false;
    recipe.play(ctx, ctx.currentTime + 0.005);
    return true;
  } catch {
    return false;
  }
}
