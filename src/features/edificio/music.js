// La música del edificio (1.73): «Dos balcones», la melodía que hizo Francisco (CLAUDE.md, 2-11-2026), según sus
// instrucciones del 2-11-2026:
// - Se carga al entrar en el edificio y, con el sonido activado, empieza desde el mismo toque que abre el portal.
// - Una única reproducción en bucle para todo el edificio: ir a un piso, decorar o entrar en la tienda no la corta ni
//   la vuelve a empezar; entrar dos veces no la duplica (si aún se estaba desvaneciendo, vuelve a subir la misma).
// - Dentro de los pisos baja suavemente; al volver a la fachada recupera el volumen.
// - Respeta el silencio de la app y calla mientras suena la radio del rincón (usa su volumen de música).
// - Al salir del edificio se desvanece y se detiene.
// Va por Web Audio (un búfer en bucle) y no por un elemento <audio>: el bucle de un <audio> deja un hueco al volver a
// empezar (sobre todo en Safari de iPhone). Además se recortan el silencio que el codificador MP3 añade al principio y
// al final, para que el final enlace con el principio. El contexto es el de la app (`sharedAudio`).
import { sharedAudio } from '../../audio/ambientAudio';
import { isRadioOn, musicVolume, onRadioChange } from '../radio/radioPlayer';

export const MELODY_SRC = '/media/edificio/dos-balcones.mp3';
/** Por debajo de la radio: es la música de fondo del sitio, no algo que se elige escuchar. */
const LEVEL = 0.55;
/** Dentro de un piso, algo más bajita. */
const INSIDE = 0.55;
const FADE_IN = 0.8;
const FADE_OUT = 1.2;
/** Lo que se considera silencio digital al recortar los bordes del búfer. */
const SILENCE = 0.0015;

let wanted = false;
let inside = false;
let buffer = null;
let loading = null;
let source = null;
let gain = null;
let stopTimer = null;
let offTimer = null;
let unRadio = null;
let retryArmed = false;
/** Cuántas reproducciones se han arrancado (las pruebas comprueban que entrar dos veces no las duplica). */
let starts = 0;

/** Descarga y decodifica la pista una sola vez (la siguiente entrada ya la tiene). */
function load(ctx) {
  if (buffer || loading) return loading;
  loading = fetch(MELODY_SRC)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((data) => new Promise((ok, ko) => ctx.decodeAudioData(data, ok, ko)))
    .then((b) => {
      buffer = b;
      sync();
    })
    .catch(() => {
      // Sin red o formato no admitido: el edificio sigue sin música (se reintenta en la próxima entrada)
      loading = null;
    });
  return loading;
}

/** Inicio y final del bucle, sin el silencio del codificador. */
function loopBounds(b) {
  let start = b.length;
  let end = 0;
  for (let c = 0; c < b.numberOfChannels; c += 1) {
    const d = b.getChannelData(c);
    let i = 0;
    while (i < d.length && Math.abs(d[i]) < SILENCE) i += 1;
    let j = d.length - 1;
    while (j > i && Math.abs(d[j]) < SILENCE) j -= 1;
    start = Math.min(start, i);
    end = Math.max(end, j + 1);
  }
  if (end <= start) return [0, b.duration];
  return [start / b.sampleRate, end / b.sampleRate];
}

const target = () => (wanted && !isRadioOn() ? LEVEL * musicVolume() * (inside ? INSIDE : 1) : 0);

function sync() {
  const shared = sharedAudio();
  if (!shared) return;
  const { ctx, master } = shared;
  const level = target();
  if (level > 0 && ctx.state === 'suspended') {
    // Si el navegador no deja reanudar fuera de un toque (iOS), se reintenta con el siguiente toque en el edificio
    ctx.resume().catch(() => {});
    if (!retryArmed) {
      retryArmed = true;
      window.addEventListener('pointerdown', () => ((retryArmed = false), wanted && sync()), { once: true, capture: true });
    }
  }
  if (!buffer) {
    if (wanted) load(ctx);
    return;
  }
  if (level > 0 && !source) {
    const [from, to] = loopBounds(buffer);
    gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(master);
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = from;
    source.loopEnd = to;
    source.connect(gain);
    source.start(ctx.currentTime + 0.02, from);
    starts += 1;
  }
  if (!source) return;
  clearTimeout(stopTimer);
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
  if (level > 0) {
    gain.gain.setTargetAtTime(level, now, FADE_IN / 3);
  } else if (!wanted) {
    // Al salir del edificio: se desvanece y se detiene (se libera la reproducción)
    gain.gain.setTargetAtTime(0.0001, now, FADE_OUT / 4);
    const s = source;
    const g = gain;
    stopTimer = setTimeout(() => {
      if (source !== s) return;
      try {
        s.stop();
      } catch {
        // Ya parada
      }
      s.disconnect();
      g.disconnect();
      source = null;
      gain = null;
    }, FADE_OUT * 1000 + 100);
  } else {
    // Suena la radio: la melodía calla pero sigue en su punto, para volver cuando la radio pare
    gain.gain.setTargetAtTime(0.0001, now, FADE_IN / 3);
  }
}

/**
 * Enciende o apaga la música del edificio. `on` ya tiene en cuenta si el sonido de la app está activado. Apagar se
 * aplaza un instante: si el edificio se vuelve a montar enseguida (cambio de pantalla), la música ni se entera.
 */
export function setEdificioMusic(on) {
  clearTimeout(offTimer);
  if (!on) {
    offTimer = setTimeout(() => {
      wanted = false;
      unRadio?.();
      unRadio = null;
      sync();
    }, 120);
    return;
  }
  wanted = true;
  if (!unRadio) unRadio = onRadioChange(sync);
  sync();
}

/** Dentro de un piso (la propia o la de un vecino) suena más bajita; en la fachada y la tienda, a su volumen. */
export function setEdificioMusicInside(next) {
  if (inside === Boolean(next)) return;
  inside = Boolean(next);
  sync();
}

/** Para las pruebas: ¿hay una reproducción en marcha? (nunca más de una). */
export const edificioMusicState = () => ({ playing: Boolean(source), starts, wanted, inside, level: target(), loop: source ? [source.loopStart, source.loopEnd, buffer.duration] : null });
if (import.meta.env.DEV) window.__edificioMusic = edificioMusicState;
