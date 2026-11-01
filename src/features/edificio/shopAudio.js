// Sonidos de la tienda del bajo (1.67, SPEC §67): sintetizados con Web Audio, suaves y breves, uno por acción, y solo
// después de que la persona toque algo (el contexto se crea con su gesto). Respetan el sonido de la app (`setMuted`).
// Papel que cruje, la solapa que se rasga, la carta que se da la vuelta y una nota por rareza (más notas cuanto más rara).

export function createShopSfx({ muted = false } = {}) {
  let ctx = null;
  let off = muted;

  function ensure() {
    if (off) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  /** Ruido filtrado (papel): `from` → `to` Hz de paso de banda. */
  function paper(gain, length, from, to, delay = 0) {
    const a = ensure();
    if (!a) return;
    const t = a.currentTime + delay;
    const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * length), a.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.random());
    const src = a.createBufferSource();
    src.buffer = buffer;
    const band = a.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 1.4;
    band.frequency.setValueAtTime(from, t);
    band.frequency.exponentialRampToValueAtTime(to, t + length);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    src.connect(band).connect(g).connect(a.destination);
    src.start(t);
    src.stop(t + length + 0.02);
  }

  function tone(type, freq, gain, length, delay = 0) {
    const a = ensure();
    if (!a) return;
    const t = a.currentTime + delay;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(g).connect(a.destination);
    osc.start(t);
    osc.stop(t + length + 0.05);
  }

  const sounds = {
    tap: () => tone('sine', 520, 0.02, 0.06),
    rustle: () => paper(0.05, 0.14, 2400, 1400),
    tear: () => {
      paper(0.07, 0.32, 5200, 900);
      paper(0.04, 0.12, 3000, 2000, 0.05);
    },
    flip: () => paper(0.045, 0.08, 3200, 1800),
    'reveal-comun': () => tone('triangle', 523.25, 0.03, 0.45),
    'reveal-poco-comun': () => {
      tone('triangle', 523.25, 0.03, 0.45);
      tone('triangle', 783.99, 0.026, 0.6, 0.1);
    },
    'reveal-raro': () => {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, k) => tone('triangle', f, 0.028, 0.7, k * 0.09));
      tone('sine', 2093, 0.008, 1.1, 0.36);
    },
    buy: () => {
      tone('sine', 880, 0.025, 0.12);
      tone('sine', 1174.66, 0.022, 0.2, 0.07);
    },
    recycle: () => {
      paper(0.04, 0.12, 1800, 900);
      tone('triangle', 440, 0.022, 0.3, 0.08);
    },
  };

  return {
    play(name) {
      if (!off) sounds[name]?.();
    },
    setMuted(value) {
      off = value;
      if (off && ctx?.state === 'running') ctx.suspend().catch(() => {});
    },
    destroy() {
      ctx?.close().catch(() => {});
      ctx = null;
    },
  };
}
