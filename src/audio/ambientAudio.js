// Sonido ambiental sintetizado con Web Audio (SPEC §8): olas, brisa entre hojas y roce de páginas,
// más efectos puntuales (carillón, maullido, ronroneo y campanita). Sin archivos de audio.

let ctx = null;
let master = null;
let ambience = null;
const AMBIENCE_LEVEL = 0.5;
/** Grillos de noche: muy bajitos, lejanos, con pausas como en el campo de verdad. */
const CRICKET_LEVEL = 0.06;
let phase = 'morning';
/** Sonidos táctiles (papel, rotulador, ronroneo, clic, cerilla…): se pueden desactivar en la habitación. */
let sfxOn = true;
export function setSfx(on) {
  sfxOn = on;
}
/** ¿Están activados los efectos de interfaz? (lo consulta `uiSounds`) */
export const sfxEnabled = () => sfxOn;
/** Atardecer: chicharras, gaviotas lejanas y la campana del pueblo, todo muy bajito. */
const EVENING_LEVEL = 0.07;
const noiseCache = {};

/**
 * Contexto de audio compartido (uno para toda la app; se crea con el primer gesto) y su bus maestro. Los efectos
 * de interfaz cuelgan de aquí con su propio bus y volumen (`uiSounds.js`).
 */
export function sharedAudio() {
  const c = audio();
  return c ? { ctx: c, master } : null;
}

function audio() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Buffers de ruido en bucle: blanco, rosa (Paul Kellet) y marrón. */
function noise(kind) {
  if (noiseCache[kind]) return noiseCache[kind];
  const seconds = 6;
  const buffer = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate);
  for (let c = 0; c < 2; c += 1) {
    const data = buffer.getChannelData(c);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      if (kind === 'white') data[i] = white * 0.5;
      else if (kind === 'brown') {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      } else {
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }
  }
  noiseCache[kind] = buffer;
  return buffer;
}

function loop(kind) {
  const src = ctx.createBufferSource();
  src.buffer = noise(kind);
  src.loop = true;
  src.loopStart = Math.random() * 2;
  return src;
}

/** Oscilador lento que modula un parámetro. Se arranca aquí y solo aquí (arrancarlo dos veces lanza). */
function lfo(freq, depth, target) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  gain.gain.value = depth;
  osc.connect(gain).connect(target);
  osc.start();
  return osc;
}

/**
 * Una ola: el agua crece (filtro que se abre y sube el volumen), rompe y se retira con espuma.
 * Cada ola usa sus propias fuentes de ruido, que se detienen solas al acabar.
 */
function wave(out, strength = 1) {
  const t = ctx.currentTime + 0.05;
  // Oleaje de bahía en calma: crece despacio, apenas rompe y se retira largo
  const rise = 3.4 + Math.random() * 1.6;
  const fall = 5.5 + Math.random() * 2.5;
  const peak = (0.045 + Math.random() * 0.02) * strength;
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (pan) pan.pan.value = (Math.random() - 0.5) * 0.6;
  const dest = pan ? (pan.connect(out), pan) : out;

  const body = loop('pink');
  const bodyFilter = ctx.createBiquadFilter();
  bodyFilter.type = 'lowpass';
  bodyFilter.Q.value = 0.6;
  bodyFilter.frequency.setValueAtTime(220, t);
  bodyFilter.frequency.exponentialRampToValueAtTime(380 + Math.random() * 120, t + rise);
  bodyFilter.frequency.exponentialRampToValueAtTime(260, t + rise + fall);
  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0.0001, t);
  bodyGain.gain.exponentialRampToValueAtTime(peak, t + rise);
  bodyGain.gain.setTargetAtTime(0.0001, t + rise + 0.4, fall / 2.6);
  body.connect(bodyFilter).connect(bodyGain).connect(dest);

  // Espuma que sisea al retirarse el agua sobre la arena
  const foam = loop('white');
  const foamFilter = ctx.createBiquadFilter();
  foamFilter.type = 'bandpass';
  foamFilter.type = 'lowpass';
  foamFilter.frequency.value = 2200;
  foamFilter.Q.value = 0.3;
  const foamGain = ctx.createGain();
  foamGain.gain.setValueAtTime(0.0001, t);
  foamGain.gain.exponentialRampToValueAtTime(0.0001 + peak * 0.025, t + rise + 0.8);
  foamGain.gain.setTargetAtTime(0.0001, t + rise + 1.2, fall / 2.2);
  foam.connect(foamFilter).connect(foamGain).connect(dest);

  const end = t + rise + fall + 2;
  body.start(t, Math.random() * 4);
  foam.start(t, Math.random() * 4);
  body.stop(end);
  foam.stop(end);
}


/** Reverberación de campo abierto (impulso de ruido que se apaga): da distancia a los grillos. */
let fieldVerb = null;
function fieldReverb() {
  if (fieldVerb) return fieldVerb;
  const seconds = 1.8;
  const buffer = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate);
  for (let c = 0; c < 2; c += 1) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i += 1) {
      const t = i / ctx.sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 3.2) * (t < 0.012 ? t / 0.012 : 1);
    }
  }
  fieldVerb = buffer;
  return buffer;
}

/**
 * Un cri-cri de grillo de campo: 2–5 sílabas de ~18 ms. Cada sílaba arranca un pelo aguda y cae
 * (el roce del ala), con ataque rápido y cola suave; un armónico tenue le quita el tono de pitido.
 */
function chirp(dest, freq, syllables, gap) {
  const t = ctx.currentTime + 0.02;
  const osc = ctx.createOscillator();
  const overtone = ctx.createOscillator();
  osc.type = 'sine';
  overtone.type = 'sine';
  const env = ctx.createGain();
  const overtoneGain = ctx.createGain();
  overtoneGain.gain.value = 0.05;
  env.gain.setValueAtTime(0.0001, t);
  for (let i = 0; i < syllables; i += 1) {
    const p = t + i * gap * (0.94 + Math.random() * 0.12);
    const f = freq * (0.995 + Math.random() * 0.01);
    osc.frequency.setValueAtTime(f * 1.02, p);
    osc.frequency.exponentialRampToValueAtTime(f * 0.985, p + 0.02);
    overtone.frequency.setValueAtTime(f * 2.04, p);
    overtone.frequency.exponentialRampToValueAtTime(f * 1.97, p + 0.02);
    const peak = (i === 0 ? 0.55 : 0.8 + Math.random() * 0.2) * (i === syllables - 1 ? 0.7 : 1);
    env.gain.setValueAtTime(0.0001, p);
    env.gain.exponentialRampToValueAtTime(peak, p + 0.004);
    env.gain.setTargetAtTime(0.0001, p + 0.012, 0.006);
  }
  osc.connect(env);
  overtone.connect(overtoneGain).connect(env);
  env.connect(dest);
  const end = t + syllables * gap + 0.08;
  osc.start(t);
  overtone.start(t);
  osc.stop(end);
  overtone.stop(end);
}

/**
 * Noche de campo: tres grillos cercanos con su propio ritmo (casi regular, como los de verdad) y un
 * fondo de grillos lejanos que cantan al azar, todo con reverberación de campo abierto.
 */
function buildCrickets(out) {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const dry = ctx.createGain();
  dry.gain.value = 0.7;
  const verb = ctx.createConvolver();
  verb.buffer = fieldReverb();
  const wet = ctx.createGain();
  wet.gain.value = 0.45;
  const soften = ctx.createBiquadFilter();
  soften.type = 'lowpass';
  soften.frequency.value = 6500;
  gain.connect(soften);
  soften.connect(dry).connect(out);
  soften.connect(verb).connect(wet).connect(out);

  const voice = (v) => {
    const level = ctx.createGain();
    level.gain.value = v.level;
    let node = level;
    if (v.far) {
      const distance = ctx.createBiquadFilter();
      distance.type = 'lowpass';
      distance.frequency.value = 3800;
      level.connect(distance);
      node = distance;
    }
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = v.pan;
      node.connect(pan).connect(gain);
    } else node.connect(gain);
    return level;
  };

  const near = [
    { freq: 4420, pan: -0.55, level: 0.9, every: 0.62, syllables: 3, gap: 0.042 },
    { freq: 4760, pan: 0.45, level: 0.55, every: 0.78, syllables: 4, gap: 0.038 },
    { freq: 4180, pan: 0.05, level: 0.35, every: 0.7, syllables: 3, gap: 0.046 },
  ];
  const timers = [];
  near.forEach((v, i) => {
    const dest = voice(v);
    let resting = false;
    const sing = () => {
      // Algún silencio de vez en cuando, y vuelta a cantar con su compás
      const rest = !resting && Math.random() < 0.06 ? 2500 + Math.random() * 6000 : 0;
      resting = rest > 0;
      timers[i] = window.setTimeout(() => {
        resting = false;
        chirp(dest, v.freq, v.syllables + (Math.random() < 0.15 ? 1 : 0), v.gap);
        sing();
      }, rest + v.every * 1000 * (0.92 + Math.random() * 0.16));
    };
    timers[i] = window.setTimeout(sing, Math.random() * 1500);
  });

  // Coro lejano: muchos grillos que se oyen a ratos, más graves y apagados
  const farDests = [-0.8, -0.3, 0.3, 0.8].map((pan) => voice({ pan, level: 0.18, far: true }));
  const chorus = () => {
    timers[near.length] = window.setTimeout(() => {
      const dest = farDests[Math.floor(Math.random() * farDests.length)];
      chirp(dest, 3900 + Math.random() * 1200, 2 + Math.floor(Math.random() * 3), 0.04 + Math.random() * 0.012);
      chorus();
    }, 180 + Math.random() * 520);
  };
  chorus();

  return {
    gain,
    stop() {
      timers.forEach((id) => window.clearTimeout(id));
    },
  };
}


/** Chicharra: zumbido áspero (ruido en banda pulsado ~110 Hz) que crece, se mantiene y se apaga. */
function cicadaSwell(dest, pan) {
  const t = ctx.currentTime + 0.05;
  const rise = 2 + Math.random() * 2;
  const hold = 2 + Math.random() * 4;
  const fall = 2.5 + Math.random() * 2;
  const src = loop('white');
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 4800 + Math.random() * 900;
  band.Q.value = 5;
  const am = ctx.createGain();
  am.gain.value = 0.5;
  const pulse = ctx.createOscillator();
  pulse.type = 'triangle';
  pulse.frequency.value = 95 + Math.random() * 35;
  const pulseDepth = ctx.createGain();
  pulseDepth.gain.value = 0.5;
  pulse.connect(pulseDepth).connect(am.gain);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(1, t + rise);
  env.gain.setValueAtTime(1, t + rise + hold);
  env.gain.exponentialRampToValueAtTime(0.0001, t + rise + hold + fall);
  let node = env;
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    env.connect(p);
    node = p;
  }
  src.connect(band).connect(am).connect(env);
  node.connect(dest);
  const end = t + rise + hold + fall + 0.2;
  src.start(t, Math.random() * 4);
  pulse.start(t);
  src.stop(end);
  pulse.stop(end);
}

/** Gaviota lejana: dos o tres "kiou" que suben y caen, apagados por la distancia. */
function gullCall(dest) {
  const calls = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < calls; i += 1) {
    const t = ctx.currentTime + 0.05 + i * (0.42 + Math.random() * 0.12);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const base = 980 + Math.random() * 160;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.linearRampToValueAtTime(base * 1.45, t + 0.09);
    osc.frequency.exponentialRampToValueAtTime(base * 0.8, t + 0.34);
    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.value = 1700;
    formant.Q.value = 2.5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.5, t + 0.04);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
    osc.connect(formant).connect(env).connect(dest);
    osc.start(t);
    osc.stop(t + 0.4);
  }
}

/** Campana lejana del pueblo: parciales inarmónicos con una cola larga. */
function distantBell(dest) {
  const t = ctx.currentTime + 0.05;
  const f = 196 + Math.random() * 30;
  [
    [1, 1, 5],
    [2, 0.5, 3.5],
    [2.4, 0.35, 3],
    [3, 0.25, 2.2],
    [4.2, 0.12, 1.6],
  ].forEach(([ratio, level, decay]) => {
    const osc = ctx.createOscillator();
    osc.frequency.value = f * ratio;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(level, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(env).connect(dest);
    osc.start(t);
    osc.stop(t + decay + 0.1);
  });
}

function buildEvening(out) {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const verb = ctx.createConvolver();
  verb.buffer = fieldReverb();
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  const dry = ctx.createGain();
  dry.gain.value = 0.6;
  gain.connect(dry).connect(out);
  gain.connect(verb).connect(wet).connect(out);

  // Cada sonido con su volumen relativo; la campana y las gaviotas, lejanas y apagadas
  const cicadas = ctx.createGain();
  cicadas.gain.value = 0.22;
  cicadas.connect(gain);
  const far = ctx.createBiquadFilter();
  far.type = 'lowpass';
  far.frequency.value = 2600;
  const gulls = ctx.createGain();
  gulls.gain.value = 0.18;
  gulls.connect(far).connect(gain);
  const bellLow = ctx.createBiquadFilter();
  bellLow.type = 'lowpass';
  bellLow.frequency.value = 1400;
  const bells = ctx.createGain();
  bells.gain.value = 0.16;
  bells.connect(bellLow).connect(gain);

  const timers = {};
  const every = (key, min, max, fn) => {
    timers[key] = window.setTimeout(() => {
      fn();
      every(key, min, max, fn);
    }, min + Math.random() * (max - min));
  };
  every('cicada-l', 3000, 9000, () => cicadaSwell(cicadas, -0.5));
  every('cicada-r', 6000, 14000, () => cicadaSwell(cicadas, 0.55));
  every('gull', 12000, 30000, () => gullCall(gulls));
  every('bell', 45000, 90000, () => {
    // Tres campanadas espaciadas
    [0, 2600, 5200].forEach((d) => window.setTimeout(() => distantBell(bells), d));
  });
  // Primeras chicharras enseguida para que el atardecer se note al llegar
  cicadaSwell(cicadas, 0.1);

  return {
    gain,
    stop() {
      Object.values(timers).forEach((id) => window.clearTimeout(id));
    },
  };
}

function buildAmbience() {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(master);
  const sources = [];
  const timers = { wave: 0, rustle: 0 };

  // Fondo del mar: rumor grave y continuo de la bahía
  const sea = loop('brown');
  const seaFilter = ctx.createBiquadFilter();
  seaFilter.type = 'lowpass';
  seaFilter.frequency.value = 220;
  const seaGain = ctx.createGain();
  seaGain.gain.value = 0.08;
  sea.connect(seaFilter).connect(seaGain).connect(out);
  sources.push(sea, lfo(0.06, 0.025, seaGain.gain), lfo(0.04, 60, seaFilter.frequency));

  // Brisa entre hojas: ruido rosa en banda con ráfagas lentas desfasadas
  const breeze = loop('pink');
  const breezeFilter = ctx.createBiquadFilter();
  breezeFilter.type = 'bandpass';
  breezeFilter.frequency.value = 900;
  breezeFilter.Q.value = 0.7;
  const breezeGain = ctx.createGain();
  breezeGain.gain.value = 0.022;
  breeze.connect(breezeFilter).connect(breezeGain).connect(out);
  sources.push(breeze, lfo(0.047, 0.015, breezeGain.gain), lfo(0.031, 350, breezeFilter.frequency));

  const leaves = loop('white');
  const leavesFilter = ctx.createBiquadFilter();
  leavesFilter.type = 'highpass';
  leavesFilter.frequency.value = 5200;
  const leavesGain = ctx.createGain();
  leavesGain.gain.value = 0.006;
  leaves.connect(leavesFilter).connect(leavesGain).connect(out);
  sources.push(leaves, lfo(0.23, 0.005, leavesGain.gain));

  [sea, breeze, leaves].forEach((n) => n.start());

  // Olas que rompen cada 5–9 s, alguna más fuerte de vez en cuando
  const scheduleWave = (delay) => {
    timers.wave = window.setTimeout(() => {
      wave(out, (Math.random() < 0.25 ? 1.2 : 0.9) * (phase === 'night' ? 0.35 : 1));
      scheduleWave(8000 + Math.random() * 5000);
    }, delay);
  };
  scheduleWave(300);

  // Roce de páginas de papel cada 15–40 s
  const scheduleRustle = () => {
    timers.rustle = window.setTimeout(() => {
      pageRustle(0.5, true);
      scheduleRustle();
    }, 15000 + Math.random() * 25000);
  };
  scheduleRustle();

  // Capas por hora del día: grillos de noche, chicharras, gaviotas y campana al atardecer
  let crickets = null;
  let evening = null;
  const fadeOut = (layer) => {
    layer.gain.gain.setTargetAtTime(0, ctx.currentTime, 1.2);
    window.setTimeout(() => layer.stop(), 4000);
  };
  const setPhase = (next) => {
    const t = ctx.currentTime;
    const isNight = next === 'night';
    // De noche el agua y la brisa se recogen para que manden los grillos
    seaGain.gain.setTargetAtTime(isNight ? 0.028 : 0.08, t, 2);
    breezeGain.gain.setTargetAtTime(isNight ? 0.012 : 0.022, t, 2);
    if (isNight && !crickets) {
      crickets = buildCrickets(out);
      crickets.gain.gain.setTargetAtTime(CRICKET_LEVEL, t, 2.5);
    } else if (!isNight && crickets) {
      fadeOut(crickets);
      crickets = null;
    }
    if (next === 'sunset' && !evening) {
      evening = buildEvening(out);
      evening.gain.gain.setTargetAtTime(EVENING_LEVEL, t, 2.5);
    } else if (next !== 'sunset' && evening) {
      fadeOut(evening);
      evening = null;
    }
  };
  setPhase(phase);

  return {
    out,
    setPhase,
    stop() {
      setPhase('morning');
      window.clearTimeout(timers.wave);
      window.clearTimeout(timers.rustle);
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setTargetAtTime(0, t, 0.4);
      window.setTimeout(() => {
        sources.forEach((n) => {
          try {
            n.stop();
          } catch {
            // Ya detenido
          }
        });
        out.disconnect();
      }, 2500);
    },
  };
}

/** La escena avisa de la hora del día: grillos de noche, chicharras y gaviotas al atardecer. */
export function setTimeOfDay(next) {
  phase = next;
  ambience?.setPhase(next);
}

/** ¿Está sonando ya el ambiente? (hasta el primer gesto del usuario el navegador no deja). */
export const isAmbiencePlaying = () => Boolean(ambience);

export function setAmbience(on) {
  if (!audio()) return;
  if (on && !ambience) {
    ambience = buildAmbience();
    // Volumen de fondo bajito: un murmullo de bahía, no un temporal
    ambience.out.gain.setTargetAtTime(AMBIENCE_LEVEL, ctx.currentTime, 1.6);
  } else if (!on && ambience) {
    ambience.stop();
    ambience = null;
  }
}

function burst({ duration, filterFreq, q = 1, gain = 0.2, type = 'bandpass', sweep = 0 }) {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise('white');
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(filterFreq, t);
  if (sweep) filter.frequency.exponentialRampToValueAtTime(filterFreq * sweep, t + duration);
  filter.Q.value = q;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + duration * 0.15);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(filter).connect(env).connect(master);
  src.start(t, Math.random() * 3);
  src.stop(t + duration + 0.05);
}

/** Hoja de papel que se pasa: dos roces cortos. */
export function pageRustle(level = 1, ambient = false) {
  if ((!sfxOn && !ambient) || !audio()) return;
  burst({ duration: 0.22, filterFreq: 3200, q: 0.8, gain: 0.12 * level, sweep: 0.5 });
  window.setTimeout(() => burst({ duration: 0.3, filterFreq: 2200, q: 0.6, gain: 0.09 * level, sweep: 1.6 }), 120);
}

function tone(freq, { at = 0, duration = 2.5, gain = 0.12, type = 'sine' } = {}) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(env).connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

/** Carillón de cristal: notas pentatónicas con parciales inarmónicos. */
export function chime() {
  if (!sfxOn || !audio()) return;
  const notes = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093];
  for (let i = 0; i < 4; i += 1) {
    const f = notes[Math.floor(Math.random() * notes.length)];
    const at = i * (0.12 + Math.random() * 0.18);
    tone(f, { at, duration: 3.2, gain: 0.07 });
    tone(f * 2.76, { at, duration: 1.4, gain: 0.018 });
  }
}

/** Campanita del temporizador. */
export function bell() {
  if (!audio()) return;
  [880, 1318.5, 1760].forEach((f, i) => tone(f, { at: i * 0.18, duration: 2.6, gain: 0.1 }));
}

/** Maullido suave: sierra con glissando a través de un formante. */
export function meow() {
  if (!sfxOn || !audio()) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(520, t);
  osc.frequency.linearRampToValueAtTime(820, t + 0.18);
  osc.frequency.linearRampToValueAtTime(560, t + 0.62);
  const formant = ctx.createBiquadFilter();
  formant.type = 'bandpass';
  formant.Q.value = 4;
  formant.frequency.setValueAtTime(900, t);
  formant.frequency.linearRampToValueAtTime(1700, t + 0.2);
  formant.frequency.linearRampToValueAtTime(1000, t + 0.62);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.16, t + 0.06);
  env.gain.setValueAtTime(0.16, t + 0.4);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  osc.connect(formant).connect(env).connect(master);
  osc.start(t);
  osc.stop(t + 0.75);
}

/** Ronroneo: ruido marrón modulado en amplitud a ~26 Hz durante unos segundos. */
export function purr(seconds = 3) {
  if (!sfxOn || !audio()) return;
  const t = ctx.currentTime;
  const src = loop('brown');
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  const am = ctx.createGain();
  am.gain.value = 0;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.5, t + 0.4);
  env.gain.setValueAtTime(0.5, t + seconds - 0.6);
  env.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  const mod = ctx.createOscillator();
  mod.frequency.value = 26;
  const modGain = ctx.createGain();
  modGain.gain.value = 0.5;
  mod.connect(modGain).connect(am.gain);
  src.connect(filter).connect(am).connect(env).connect(master);
  src.start(t);
  mod.start(t);
  src.stop(t + seconds + 0.1);
  mod.stop(t + seconds + 0.1);
}

/** Trazo de rotulador fluorescente al subrayar una cita: roce agudo que se desliza. */
export function markerStroke() {
  if (!sfxOn || !audio()) return;
  burst({ duration: 0.34, filterFreq: 2600, q: 2.2, gain: 0.07, sweep: 1.5 });
  window.setTimeout(() => burst({ duration: 0.12, filterFreq: 3600, q: 3, gain: 0.04, sweep: 0.8 }), 300);
}

/** Interruptor de la lámpara: un clic seco y pequeño. */
export function lampClick() {
  if (!sfxOn || !audio()) return;
  burst({ duration: 0.035, filterFreq: 2200, q: 1.2, gain: 0.22 });
  tone(1800, { duration: 0.05, gain: 0.03, type: 'square' });
}

/** Cerilla que se enciende (raspado y llama que prende) o vela que se apaga de un soplo. */
export function matchStrike(on = true) {
  if (!sfxOn || !audio()) return;
  if (on) {
    burst({ duration: 0.22, filterFreq: 1800, q: 0.7, gain: 0.16, sweep: 2.4 });
    window.setTimeout(() => burst({ duration: 0.6, filterFreq: 700, q: 0.5, gain: 0.06, type: 'lowpass' }), 200);
  } else {
    burst({ duration: 0.45, filterFreq: 900, q: 0.4, gain: 0.09, type: 'lowpass', sweep: 0.5 });
  }
}
