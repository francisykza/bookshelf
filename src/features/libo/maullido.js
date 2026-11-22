// El maullido de Libo: corto y suave, sintetizado (nunca una grabación). Suena por el bus de «Sonidos táctiles», así que
// respeta el silencio y su volumen, y solo tras un toque (el AudioContext no existe antes). Un fallo de audio no bloquea nada.
import { uiSfxBus } from '../../audio/uiSounds';

let ultimo = -Infinity;

export function maullar() {
  try {
    const bus = uiSfxBus();
    if (!bus) return false;
    const { ctx, out } = bus;
    const now = performance.now();
    if (now - ultimo < 600) return false;
    ultimo = now;
    dibujarMaullido(ctx, out, ctx.currentTime + 0.01);
    if (import.meta.env?.DEV && typeof window !== 'undefined') (window.__uiSoundLog ??= []).push({ event: 'libo', at: Math.round(now) });
    return true;
  } catch {
    return false;
  }
}

/** El maullido sobre cualquier contexto de audio (también uno sin conexión, para grabarlo y enseñarlo). Dura ~0,5 s. */
export function dibujarMaullido(ctx, out, t) {
  // La voz: un diente de sierra que sube y baja («mi-au»), con un pequeño temblor
  const voz = ctx.createOscillator();
  voz.type = 'sawtooth';
  voz.frequency.setValueAtTime(560, t);
  voz.frequency.linearRampToValueAtTime(820, t + 0.12);
  voz.frequency.linearRampToValueAtTime(700, t + 0.24);
  voz.frequency.exponentialRampToValueAtTime(470, t + 0.42);
  const temblor = ctx.createOscillator();
  temblor.frequency.value = 7;
  const hondo = ctx.createGain();
  hondo.gain.value = 9;
  temblor.connect(hondo).connect(voz.frequency);
  // La boca: un formante que pasa de «i» a «au» y otro más grave que lo redondea
  const boca = ctx.createBiquadFilter();
  boca.type = 'bandpass';
  boca.Q.value = 5;
  boca.frequency.setValueAtTime(2300, t);
  boca.frequency.linearRampToValueAtTime(1500, t + 0.16);
  boca.frequency.exponentialRampToValueAtTime(850, t + 0.42);
  const garganta = ctx.createBiquadFilter();
  garganta.type = 'lowpass';
  garganta.frequency.value = 2600;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
  env.gain.setValueAtTime(0.5, t + 0.2);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.46);
  voz.connect(boca).connect(garganta).connect(env).connect(out);
  voz.start(t);
  temblor.start(t);
  voz.stop(t + 0.5);
  temblor.stop(t + 0.5);
}
