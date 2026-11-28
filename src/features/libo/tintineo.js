// Libocoins, bloque 3 (docs/qa/libocoins.md): el tintineo de las monedas al caer en la de Libo. Sintetizado (nunca una
// grabación), corto y suave, una nota por moneda y cada una un poco más aguda. Suena por el bus de «Sonidos táctiles», así que
// respeta el silencio y su volumen, y solo si el audio ya existe (tras un toque). Un fallo de audio no bloquea nada.
// Cuando se haga lo de los sonidos de lumina-sfx, su `coin-pickup-chime` puede sustituirlo (CLAUDE.md).
import { uiSfxBus } from '../../audio/uiSounds';

/** Toca `veces` tintineos: el primero a `primero` s de ahora y los demás cada `paso` s (al ritmo de las monedas que caen). */
export function tintinear(veces = 1, { primero = 0, paso = 0.11 } = {}) {
  try {
    const bus = uiSfxBus();
    if (!bus) return false;
    const { ctx, out } = bus;
    const t0 = ctx.currentTime + 0.01;
    for (let i = 0; i < veces; i += 1) dibujarTintineo(ctx, out, t0 + primero + i * paso, i);
    if (import.meta.env?.DEV && typeof window !== 'undefined') (window.__uiSoundLog ??= []).push({ event: 'libocoins', veces, at: Math.round(performance.now()) });
    return true;
  } catch {
    return false;
  }
}

// Una moneda pequeña: la nota y dos parciales metálicos que se apagan antes (mi, fa sostenido, sol sostenido, si… hacia arriba)
const PARCIALES = [
  [1, 0.16, 0.28],
  [2.76, 0.05, 0.12],
  [5.4, 0.02, 0.06],
];

/** Un tintineo sobre cualquier contexto de audio (también uno sin conexión, para grabarlo y enseñarlo). Dura ~0,3 s. */
export function dibujarTintineo(ctx, out, t, i = 0) {
  const base = 1318.5 * 2 ** ([0, 2, 4, 7, 9][i % 5] / 12);
  for (const [mult, pico, dura] of PARCIALES) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base * mult, t);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(pico, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.004 + dura);
    osc.connect(env).connect(out);
    osc.start(t);
    osc.stop(t + dura + 0.02);
  }
}
