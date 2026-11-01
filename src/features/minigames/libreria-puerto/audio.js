// Sonidos de «La librería del puerto» (prototipo): sintetizados con Web Audio, suaves y breves, uno por acción. Sin
// archivos de audio (la música de Pixel Plays no tiene licencia de reutilización y no se usa). El contexto se crea con
// el primer gesto y se cierra al desmontar el juego, así que salir y volver no deja sonidos ni nodos colgando.

export function createSfx({ muted = false } = {}) {
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

  /** Un golpe de madera: seno grave con caída rápida y un poco de ruido filtrado. */
  function knock(freq, gain, length, delay = 0) {
    const a = ensure();
    if (!a) return;
    const t = a.currentTime + delay;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.62, t + length);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(g).connect(a.destination);
    osc.start(t);
    osc.stop(t + length + 0.02);
  }

  /** Una nota suave (para balda completa y final). */
  function note(freq, gain, length, delay = 0) {
    const a = ensure();
    if (!a) return;
    const t = a.currentTime + delay;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(g).connect(a.destination);
    osc.start(t);
    osc.stop(t + length + 0.05);
  }

  const sounds = {
    lift: () => knock(520, 0.025, 0.06),
    place: () => {
      knock(190, 0.09, 0.14);
      knock(330, 0.03, 0.08, 0.01);
    },
    back: () => knock(240, 0.04, 0.12),
    invalid: () => knock(130, 0.05, 0.16),
    shelf: () => {
      note(523.25, 0.035, 0.35);
      note(659.25, 0.03, 0.4, 0.09);
    },
    win: () => {
      note(392, 0.035, 0.6);
      note(523.25, 0.03, 0.6, 0.12);
      note(659.25, 0.028, 0.8, 0.24);
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
    get muted() {
      return off;
    },
    /** Al desmontar: se cierra el contexto (no quedan nodos ni un segundo contexto al volver). */
    destroy() {
      ctx?.close().catch(() => {});
      ctx = null;
    },
    /** Para las pruebas: cuántos contextos de audio están abiertos (0 o 1). */
    get open() {
      return ctx ? 1 : 0;
    },
  };
}
