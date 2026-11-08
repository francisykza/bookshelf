// Genera los audios originales de «Escritorio del puerto» (1.90): dos músicas y dos ambientes de muestra, sintetizados sin conexión
// y con semilla fija, de modo que la misma orden produce las mismas muestras.
//
//   FFMPEG_PATH=/ruta/a/ffmpeg node scripts/audio/generate-port-audio.cjs
//
// Hace falta un ffmpeg con libmp3lame (solo para generar; la app no lo usa). lamejs 1.2.0 dejaba mudos los ruidos a 96 kbps.
//
// Salida: public/media/sonido/*.mp3 y docs/audio/medidas-audio.json.
// Son 32 s periódicos: las colas que se pasan del final vuelven al principio. El archivo lleva 1 s de más por cada lado, con el mismo
// contenido, y el reproductor hace el bucle entre los segundos 0,5 y 32,5; así da igual el retardo que añada cada decodificador de MP3.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

const SR = 44100;
const SECONDS = 32;
const N = SR * SECONDS;
const PAD = SR;
const OUT = path.join(__dirname, '..', '..', 'public', 'media', 'sonido');

function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const stereo = () => [new Float64Array(N), new Float64Array(N)];

/** Piano eléctrico suave: modulación de frecuencia poco profunda que se apaga pronto. Lo que pasa de 32 s vuelve al principio. */
function electricPiano(buf, note, at, velocity, pan, rnd) {
  const f = midi(note);
  const tau = Math.max(0.9, 2.4 - (note - 48) * 0.03);
  const length = Math.floor(Math.min(6, tau * 3.2) * SR);
  const start = Math.floor(at * SR);
  const detune = 1 + 0.0009 * (rnd() - 0.5);
  [0, 1].forEach((ch) => {
    const side = ch === 0 ? 1 - pan : 1 + pan;
    const fc = f * (ch === 0 ? detune : 2 - detune);
    for (let i = 0; i < length; i += 1) {
      const t = i / SR;
      const attack = Math.min(1, t / 0.012);
      const release = Math.min(1, (length - i) / (SR * 0.25));
      const env = attack * release * Math.exp(-t / tau);
      const index = 0.75 * Math.exp(-t / 0.28);
      const y = Math.sin(2 * Math.PI * fc * t + index * Math.sin(2 * Math.PI * fc * t)) + 0.1 * Math.sin(4 * Math.PI * fc * t) * Math.exp(-t / 0.5);
      buf[ch][(start + i) % N] += y * env * velocity * side * 0.5;
    }
  });
}

/** Colchón muy tenue: senos casi quietos con entrada y salida largas. */
function pad(buf, notes, at, seconds, level) {
  const start = Math.floor(at * SR);
  const length = Math.floor(seconds * SR);
  notes.forEach((note, n) => {
    const f = midi(note);
    [0, 1].forEach((ch) => {
      const fc = f * (ch === 0 ? 1.0007 : 0.9993);
      for (let i = 0; i < length; i += 1) {
        const x = i / length;
        const env = Math.pow(Math.sin(Math.PI * x), 1.3);
        buf[ch][(start + i) % N] += (Math.sin((2 * Math.PI * fc * i) / SR + n) + 0.18 * Math.sin((6 * Math.PI * fc * i) / SR)) * env * level;
      }
    });
  });
}

/** Filtro de un polo sobre un búfer circular: dos vueltas, para que el principio y el final coincidan. */
function lowpass(data, cutoff) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  let y = 0;
  for (let lap = 0; lap < 2; lap += 1) {
    for (let i = 0; i < data.length; i += 1) {
      y += a * (data[i] - y);
      if (lap === 1) data[i] = y;
    }
  }
}

/** Sala corta y discreta: peines realimentados sobre el búfer circular. */
function room(buf, wet) {
  const delays = [1557, 1617, 1491, 1422];
  [0, 1].forEach((ch) => {
    const dry = Float64Array.from(buf[ch]);
    const sum = new Float64Array(N);
    delays.forEach((d0) => {
      const d = d0 + ch * 23;
      const line = new Float64Array(d);
      let at = 0;
      for (let lap = 0; lap < 3; lap += 1) {
        for (let i = 0; i < N; i += 1) {
          const out = line[at];
          line[at] = dry[i] + out * 0.78;
          at = (at + 1) % d;
          if (lap === 2) sum[i] += out;
        }
      }
    });
    for (let i = 0; i < N; i += 1) buf[ch][i] = dry[i] + (sum[i] * wet) / delays.length;
  });
}

function normalize(buf, peak) {
  let top = 0;
  buf.forEach((d) => d.forEach((v) => (top = Math.max(top, Math.abs(v)))));
  const k = peak / top;
  buf.forEach((d) => {
    for (let i = 0; i < d.length; i += 1) d[i] *= k;
  });
}

function tarde() {
  const rnd = random(19032026);
  const buf = stereo();
  // Cada acorde, dos compases de 4 s; ningún segundo pasa de tres ataques
  const chords = [
    { root: 48, arp: [64, 67, 71, 72] },
    { root: 45, arp: [64, 67, 72, 76] },
    { root: 41, arp: [65, 69, 72, 76] },
    { root: 43, arp: [62, 67, 71, 76] },
  ];
  const figure = [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 1],
    [4.5, 3],
    [6, 2],
    [7, 0],
  ];
  chords.forEach((chord, c) => {
    const base = c * 8;
    electricPiano(buf, chord.root, base, 0.3, 0, rnd);
    figure.forEach(([beat, step]) => {
      const pan = [-0.28, -0.08, 0.1, 0.26][step];
      electricPiano(buf, chord.arp[step], base + beat + (rnd() - 0.5) * 0.012, 0.3 + rnd() * 0.05, pan, rnd);
    });
  });
  // Motivo E5–G5–D5–E5, una nota por compás en los cuatro primeros; los compases 5 a 8 quedan libres
  [
    [76, 1.5],
    [79, 5.5],
    [74, 9.5],
    [76, 13.5],
  ].forEach(([note, at]) => electricPiano(buf, note, at, 0.42, 0.04, rnd));
  buf.forEach((d) => lowpass(d, 3400));
  room(buf, 0.22);
  normalize(buf, 0.56);
  return buf;
}

function luz() {
  const rnd = random(7112026);
  const buf = stereo();
  const chords = [
    { pad: [57, 60, 64, 67], notes: [[64, 1], [60, 5.5]] },
    { pad: [53, 57, 60, 64], notes: [[69, 2], [65, 6]] },
    { pad: [48, 55, 59, 64], notes: [[67, 1.5], [59, 5]] },
    { pad: [55, 59, 62, 64], notes: [[62, 2.5], [64, 6.5]] },
  ];
  chords.forEach((chord, c) => {
    const base = c * 8;
    pad(buf, chord.pad, base - 1.5, 11, 0.018);
    chord.notes.forEach(([note, beat], k) => electricPiano(buf, note - 5 * (note > 66 ? 1 : 0), ((base + beat + N / SR) % SECONDS) + (rnd() - 0.5) * 0.02, 0.3 + rnd() * 0.04, k % 2 ? 0.18 : -0.18, rnd));
  });
  buf.forEach((d) => lowpass(d, 2200));
  room(buf, 0.26);
  normalize(buf, 0.5);
  return buf;
}

const noiseBuf = (rnd) => Float64Array.from({ length: N }, () => rnd() * 2 - 1);

/** Oleaje: rumor grave y espuma, con crecidas lentas que son armónicos de 1/32 Hz (bucle exacto). Ruido filtrado, no una grabación. */
function mar() {
  const rnd = random(48151623);
  const buf = stereo();
  const swell = (t, ph) => {
    const x = (2 * Math.PI * t) / SECONDS;
    const v = 0.62 + 0.16 * Math.sin(4 * x + ph) + 0.08 * Math.sin(3 * x + ph * 2.1) + 0.05 * Math.sin(5 * x + ph * 0.6);
    return Math.max(0.05, v);
  };
  [0, 1].forEach((ch) => {
    const low = noiseBuf(rnd);
    lowpass(low, 240);
    lowpass(low, 420);
    const mid = noiseBuf(rnd);
    lowpass(mid, 1100);
    const high = noiseBuf(rnd);
    lowpass(high, 500);
    for (let i = 0; i < N; i += 1) {
      const t = i / SR;
      const s = swell(t, 0.4 + ch * 0.35);
      const foam = Math.pow(swell(t - 1.4, 0.4 + ch * 0.35), 2);
      buf[ch][i] = low[i] * (0.75 + 0.5 * s) * 2.4 + (mid[i] - high[i]) * foam * 0.8;
    }
  });
  normalize(buf, 0.28);
  return buf;
}

/** Lluvia uniforme: ruido brillante continuo y muchas gotas pequeñas repartidas por igual; sin truenos. Ruido filtrado, no una grabación. */
function lluvia() {
  const rnd = random(27182818);
  const buf = stereo();
  [0, 1].forEach((ch) => {
    const a = noiseBuf(rnd);
    const low = Float64Array.from(a);
    lowpass(low, 1100);
    for (let i = 0; i < N; i += 1) buf[ch][i] = (a[i] - low[i]) * 0.3 + low[i] * 0.5;
    lowpass(buf[ch], 7000);
    for (let d = 0; d < 9000; d += 1) {
      const start = Math.floor(rnd() * N);
      const level = 0.04 + rnd() * 0.12;
      const f = 1400 + rnd() * 3200;
      const length = Math.floor(SR * (0.004 + rnd() * 0.01));
      for (let i = 0; i < length; i += 1) buf[ch][(start + i) % N] += Math.sin((2 * Math.PI * f * i) / SR) * level * (1 - i / length);
    }
  });
  normalize(buf, 0.34);
  return buf;
}

function toInt16(data) {
  const out = new Int16Array(data.length + PAD * 2);
  const put = (at, i) => (out[at] = Math.max(-32767, Math.min(32767, Math.round(data[i] * 32767))));
  for (let i = 0; i < PAD; i += 1) put(i, data.length - PAD + i);
  for (let i = 0; i < data.length; i += 1) put(PAD + i, i);
  for (let i = 0; i < PAD; i += 1) put(PAD + data.length + i, i);
  return out;
}

function mp3(buf, kbps) {
  const L = toInt16(buf[0]);
  const R = toInt16(buf[1]);
  const pcm = Buffer.alloc(L.length * 4);
  for (let i = 0; i < L.length; i += 1) {
    pcm.writeInt16LE(L[i], i * 4);
    pcm.writeInt16LE(R[i], i * 4 + 2);
  }
  const tmp = path.join(os.tmpdir(), `bookshelf-puerto-${process.pid}`);
  fs.writeFileSync(`${tmp}.raw`, pcm);
  execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 's16le', '-ar', String(SR), '-ac', '2', '-i', `${tmp}.raw`, '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', `${kbps}k`, '-id3v2_version', '0', '-write_xing', '0', `${tmp}.mp3`]);
  const file = fs.readFileSync(`${tmp}.mp3`);
  fs.unlinkSync(`${tmp}.raw`);
  fs.unlinkSync(`${tmp}.mp3`);
  return file;
}

const dBFS = (v) => Math.round(20 * Math.log10(v) * 10) / 10;
fs.mkdirSync(OUT, { recursive: true });
const report = {};
for (const [name, make, kbps] of [
  ['tarde-en-el-puerto', tarde, 128],
  ['luz-de-escritorio', luz, 112],
  ['mar', mar, 96],
  ['lluvia', lluvia, 96],
]) {
  const buf = make();
  const file = mp3(buf, kbps);
  fs.writeFileSync(path.join(OUT, `${name}.mp3`), file);
  let top = 0;
  let sum = 0;
  buf.forEach((d) =>
    d.forEach((v) => {
      top = Math.max(top, Math.abs(v));
      sum += v * v;
    }),
  );
  // Unión del bucle: diferencia entre la última muestra y la primera, comparada con la mayor diferencia entre muestras vecinas
  const seam = Math.max(...buf.map((d) => Math.abs(d[N - 1] - d[0])));
  report[name] = { bytes: file.length, kbps, canales: 2, tasa: SR, duracionArchivo: 34, bucle: 32, picoPCM: Math.round(top * 1000) / 1000, picoDBFS: dBFS(top), rmsDBFS: dBFS(Math.sqrt(sum / (2 * N))), saltoEnLaUnion: Math.round(seam * 10000) / 10000 };
  console.log(name, JSON.stringify(report[name]));
}
fs.writeFileSync(path.join(__dirname, '..', '..', 'docs', 'audio', 'medidas-audio.json'), `${JSON.stringify(report, null, 1)}\n`);
