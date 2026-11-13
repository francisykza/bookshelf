// La música del café (1.126, Francisco, 13-11-2026: «quiero que se sienta cozy la música que se oye en la cafetería»).
// Original y sintetizada con Web Audio, sin archivos: un jazz lento de café a 72 pulsos, con swing, en fa mayor. Suenan un
// piano eléctrico cálido con su trémolo, un contrabajo pulsado, escobillas y un bombo blando, a ratos una melodía de celesta
// y, debajo, alguna taza a lo lejos (sin vinilo ni murmullo: sonaban a lluvia). Cada vuelta de ocho compases
// varía un poco (el acompañamiento, los pasos del bajo, la melodía), así que no cansa. Todo pasa por un filtro suave y una
// sala pequeña. Va por la salida de música propia del sitio (`sceneMusicOut`): sigue el volumen de música, «Sin música», el
// silencio y la radio, y nunca suena antes de un gesto.
// `programar(desde, hasta)` deja escritas las notas de ese tramo; en directo se llama a ratos y, para escucharla fuera de la
// app, se puede llamar una vez sobre un OfflineAudioContext (`renderCafeMusica`).

const PULSO = 60 / 72;
const COMPAS = PULSO * 4;
const SWING = 0.62;
const VUELTA = 8;

const nota = (n) => 440 * 2 ** ((n - 69) / 12);
// [bajo, voces del piano] en números MIDI
const ACORDES = [
  [41, [57, 60, 64, 67]], // Fmaj9
  [38, [53, 57, 60, 64]], // Dm9
  [43, [58, 62, 65, 69]], // Gm9
  [36, [58, 62, 65, 69]], // C9sus
  [46, [57, 60, 62, 65]], // Bbmaj9
  [45, [55, 60, 64, 67]], // Am7
  [43, [53, 58, 62, 65]], // Gm7
  [36, [58, 62, 64, 67]], // C9
];
// Las otras vueltas cambian dos acordes (un color distinto de vez en cuando)
const VARIANTES = { 5: [45, [55, 61, 64, 67]], 7: [36, [58, 61, 64, 67]] };
const PENTA = [65, 67, 69, 72, 74, 77, 79, 81];

/** Un número al azar que se repite con la misma semilla (cada vuelta, su variación). */
function azar(semilla) {
  let s = semilla >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

let ruidoCache = new WeakMap();
function ruidoDe(ctx) {
  let b = ruidoCache.get(ctx);
  if (!b) {
    const n = Math.floor(ctx.sampleRate * 2);
    b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i += 1) d[i] = Math.random() * 2 - 1;
    ruidoCache.set(ctx, b);
  }
  return b;
}

/** Una sala pequeña: un eco que se apaga en algo más de un segundo y medio. */
function sala(ctx) {
  const n = Math.floor(ctx.sampleRate * 1.7);
  const ir = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c += 1) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < n; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3.2 * (i < 300 ? i / 300 : 1);
  }
  const cv = ctx.createConvolver();
  cv.buffer = ir;
  return cv;
}

/**
 * Monta la música en `ctx` hacia `destino`. Devuelve { programar(desde, hasta), salida, parar() }. El tiempo musical empieza
 * en `inicio` (segundos del contexto).
 */
function montar(ctx, destino, inicio) {
  const salida = ctx.createGain();
  salida.gain.value = 1.9;
  // Cálido: sin agudos chillones
  const tono = ctx.createBiquadFilter();
  tono.type = 'lowpass';
  tono.frequency.value = 4200;
  tono.Q.value = 0.5;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 5;
  comp.attack.value = 0.02;
  comp.release.value = 0.3;
  salida.connect(tono).connect(comp).connect(destino);
  const eco = sala(ctx);
  const ecoG = ctx.createGain();
  ecoG.gain.value = 0.22;
  eco.connect(ecoG).connect(salida);

  // El piano, con su trémolo (un vaivén lento del volumen) y un poco de «cinta» (la afinación que ondula muy poco)
  const piano = ctx.createGain();
  piano.gain.value = 0.9;
  const trem = ctx.createOscillator();
  trem.frequency.value = 4.2;
  const tremG = ctx.createGain();
  tremG.gain.value = 0.12;
  trem.connect(tremG).connect(piano.gain);
  const cinta = ctx.createOscillator();
  cinta.frequency.value = 0.35;
  const cintaG = ctx.createGain();
  cintaG.gain.value = 4;
  cinta.connect(cintaG);
  const pianoFl = ctx.createBiquadFilter();
  pianoFl.type = 'lowpass';
  pianoFl.frequency.value = 2400;
  piano.connect(pianoFl);
  pianoFl.connect(salida);
  pianoFl.connect(eco);

  const bajo = ctx.createGain();
  bajo.gain.value = 0.85;
  const bajoFl = ctx.createBiquadFilter();
  bajoFl.type = 'lowpass';
  bajoFl.frequency.value = 650;
  bajo.connect(bajoFl).connect(salida);

  const bateria = ctx.createGain();
  bateria.gain.value = 0.6;
  bateria.connect(salida);
  bateria.connect(eco);

  const celesta = ctx.createGain();
  celesta.gain.value = 0.5;
  celesta.connect(salida);
  celesta.connect(eco);

  // El café de fondo: solo alguna taza a lo lejos (1.126, Francisco: el vinilo y el murmullo sonaban a lluvia y la empañaban)
  const fondo = ctx.createGain();
  fondo.gain.value = 0.5;
  fondo.connect(salida);

  const fuentes = [trem, cinta];
  for (const f of fuentes) f.start(inicio);

  function voz(t, f, { dur, pico, tipo = 'sine', ataque = 0.006, a = null, destino: d, detune = false }) {
    const o = ctx.createOscillator();
    o.type = tipo;
    o.frequency.setValueAtTime(f, t);
    if (a) o.frequency.exponentialRampToValueAtTime(a, t + dur);
    if (detune) cintaG.connect(o.detune);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pico, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + dur);
    o.connect(g).connect(d);
    o.start(t);
    o.stop(t + ataque + dur + 0.05);
  }
  function soplo(t, { f, q = 1, tipo = 'bandpass', dur, pico, ataque = 0.004, d }) {
    const s = ctx.createBufferSource();
    s.buffer = ruidoDe(ctx);
    const fl = ctx.createBiquadFilter();
    fl.type = tipo;
    fl.frequency.value = f;
    fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pico, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + dur);
    s.connect(fl).connect(g).connect(d);
    s.start(t, Math.random() * 1.5);
    s.stop(t + ataque + dur + 0.05);
  }

  /** Una nota del piano eléctrico: la fundamental, un brillo de campana al pulsar y un gemelo un pelín desafinado. */
  function tecla(t, n, dur, vel) {
    const f = nota(n);
    voz(t, f, { dur, pico: 0.05 * vel, ataque: 0.008, destino: piano, detune: true });
    voz(t, f * 1.0035, { dur: dur * 0.9, pico: 0.025 * vel, ataque: 0.01, destino: piano, detune: true });
    voz(t, f * 4, { dur: 0.25, pico: 0.008 * vel, ataque: 0.002, destino: piano });
  }
  function acorde(t, voces, dur, vel) {
    voces.forEach((n, k) => tecla(t + k * 0.014, n, dur, vel * (k === voces.length - 1 ? 1.1 : 1)));
  }
  function contrabajo(t, n, dur, vel = 1) {
    const f = nota(n);
    voz(t, f, { dur, pico: 0.22 * vel, tipo: 'triangle', ataque: 0.012, destino: bajo });
    voz(t, f, { dur: dur * 0.7, pico: 0.12 * vel, ataque: 0.015, destino: bajo });
    soplo(t, { f: 900, q: 2, dur: 0.04, pico: 0.03 * vel, d: bajo });
  }
  function bombo(t, vel = 1) {
    voz(t, 95, { dur: 0.28, pico: 0.22 * vel, a: 45, ataque: 0.004, destino: bateria });
  }
  function escobilla(t, vel = 1, largo = 0.2) {
    soplo(t, { f: 2400, q: 1.1, dur: largo * 0.6, pico: 0.03 * vel, ataque: 0.02, d: bateria });
  }
  function charles(t, vel = 1) {
    soplo(t, { f: 7000, tipo: 'highpass', q: 0.7, dur: 0.05, pico: 0.018 * vel, d: bateria });
  }
  function campanita(t, n, vel = 1) {
    const f = nota(n);
    voz(t, f, { dur: 1.1, pico: 0.05 * vel, ataque: 0.003, destino: celesta });
    voz(t, f * 3, { dur: 0.35, pico: 0.012 * vel, ataque: 0.002, destino: celesta });
  }
  function taza(t) {
    const f = 2400 + Math.random() * 900;
    voz(t, f, { dur: 0.35, pico: 0.012, tipo: 'sine', ataque: 0.002, destino: fondo });
    voz(t, f * 1.52, { dur: 0.2, pico: 0.006, ataque: 0.002, destino: fondo });
  }

  // El tiempo de cada corchea con swing: la segunda de cada pulso llega un poco tarde
  const corchea = (compas, k) => inicio + compas * COMPAS + Math.floor(k / 2) * PULSO + (k % 2 ? PULSO * SWING : 0);
  let hecho = -1;
  let proximaTaza = inicio + 6 + Math.random() * 8;

  function compas(c) {
    const vuelta = Math.floor(c / VUELTA);
    const i = c % VUELTA;
    const r = azar(vuelta * 131 + i * 17 + 7);
    const [raiz, voces] = (vuelta % 2 === 1 && VARIANTES[i]) || ACORDES[i];
    const sig = ACORDES[(i + 1) % VUELTA][0];
    const t0 = inicio + c * COMPAS;
    const entra = c < 2;
    // El piano: el acorde al empezar y un toque a contratiempo (a veces dos); en la última de la vuelta, un respiro
    acorde(t0, voces, PULSO * 2.2, entra ? 0.7 : 1);
    if (r() < 0.75) acorde(corchea(c, 3), voces.slice(1), PULSO * 1.2, 0.6);
    if (r() < 0.35) acorde(corchea(c, 6), voces.slice(0, 3), PULSO * 0.8, 0.5);
    // El contrabajo: la raíz, la quinta y una nota que lleva al siguiente acorde
    if (!entra || c === 1) {
      contrabajo(t0, raiz, PULSO * 1.6);
      contrabajo(t0 + PULSO * 2, raiz + (r() < 0.5 ? 7 : 12), PULSO * 1.2, 0.8);
      if (r() < 0.6) contrabajo(corchea(c, 7), sig + (r() < 0.5 ? -1 : 2), PULSO * 0.45, 0.7);
    }
    // La batería, a partir del segundo compás: bombo blando, escobillas en el 2 y el 4, el charles con swing
    if (c >= 1) {
      bombo(t0, 0.8);
      if (r() < 0.5) bombo(corchea(c, 5), 0.5);
      escobilla(t0 + PULSO, 1);
      escobilla(t0 + PULSO * 3, 0.9, 0.25);
      for (let k = 0; k < 8; k += 1) if (k % 2 === 1 || r() < 0.4) charles(corchea(c, k), k % 2 ? 0.8 : 0.5);
    }
    // La celesta: en la segunda mitad de vueltas alternas, unas pocas notas que caen en el acorde
    if (vuelta % 2 === 1 && i >= 4) {
      let ultima = PENTA[Math.floor(r() * PENTA.length)];
      for (let k = 0; k < 8; k += 1) {
        if (r() > 0.32) continue;
        const paso = PENTA.indexOf(ultima) + (r() < 0.5 ? -1 : 1);
        ultima = PENTA[Math.max(0, Math.min(PENTA.length - 1, paso))];
        campanita(corchea(c, k), ultima, k % 2 ? 0.7 : 1);
      }
    }
  }

  return {
    salida,
    /** Escribe los compases que empiezan antes de `hasta` (segundos del contexto) y alguna taza de fondo. */
    programar(hasta) {
      const ultimo = Math.floor((hasta - inicio) / COMPAS);
      while (hecho < ultimo) {
        hecho += 1;
        compas(hecho);
      }
      while (proximaTaza < hasta) {
        taza(proximaTaza);
        proximaTaza += 7 + Math.random() * 14;
      }
    },
    parar(t) {
      for (const f of fuentes) {
        try {
          f.stop(t);
        } catch {
          /* ya parada */
        }
      }
    },
  };
}

/**
 * La música en directo. `abrir()` devuelve la salida ({ ctx, out }) o null si aún no se puede sonar. Devuelve
 * { arrancar(), parar(), atenuar(on) }; arrancar se puede llamar de nuevo sin efecto si ya suena.
 */
export function crearCafeMusica(abrir) {
  let m = null;
  let timer = 0;
  let ctxVivo = null;
  let g = null;
  return {
    arrancar() {
      if (m) return true;
      const o = abrir();
      if (!o) return false;
      const { ctx, out } = o;
      ctxVivo = ctx;
      g = ctx.createGain();
      const t = ctx.currentTime + 0.05;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1, t + 2.5);
      g.connect(out);
      m = montar(ctx, g, t);
      const latido = () => m?.programar(ctx.currentTime + 1.2);
      latido();
      timer = setInterval(latido, 250);
      return true;
    },
    parar() {
      if (!m) return;
      clearInterval(timer);
      const t = ctxVivo.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      const [mm, gg] = [m, g];
      setTimeout(() => {
        mm.parar(0);
        gg.disconnect();
      }, 1000);
      m = null;
      g = null;
    },
    /** Más bajita mientras se prepara en la barra, para que se oiga bien lo que haces. */
    atenuar(on) {
      if (!g) return;
      g.gain.setTargetAtTime(on ? 0.55 : 1, ctxVivo.currentTime, 0.4);
    },
    sonando: () => Boolean(m),
  };
}

/** Para escucharla fuera de la app: `segundos` de música en un AudioBuffer (estéreo, 44,1 kHz). */
export async function renderCafeMusica(segundos = 60) {
  const ctx = new OfflineAudioContext(2, Math.ceil(44100 * segundos), 44100);
  ruidoCache = new WeakMap();
  const m = montar(ctx, ctx.destination, 0.05);
  m.programar(segundos);
  return ctx.startRendering();
}
