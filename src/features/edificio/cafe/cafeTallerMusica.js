// La música del taller de la trastienda (1.133; plan en docs/qa/cafe-libreria.md §16.3: «su música, más lenta, de cuerda
// pulsada»). Original y sintetizada con Web Audio, sin archivos: una guitarra de nailon que arpegia despacio, a 56 pulsos, en re
// mayor (re, si menor, sol y la, con un fa sostenido menor de vez en cuando), un bajo pulsado y, a ratos, unas notas de arpa
// por encima. Debajo, solo alguna gota de lluvia en el cristal del ventanuco, muy de vez en cuando (nada de reloj ni de
// tictac: en el taller no corre el tiempo). Cada vuelta de ocho compases cambia un poco el arpegio y la melodía. Va por la
// misma salida que la del café (`sceneMusicOut`), con su volumen, «Sin música», el silencio y la radio.
// Tras ver la 1.133 (Francisco, 14-11-2026: «además de tener su propia musica como la cafeteria»), con más alma y más suya:
// desde la segunda vuelta entra un violonchelo con arco, notas largas que van de un acorde a otro por el camino más corto (dos
// vueltas de cada tres; la tercera, descansa) y, de vez en cuando, la cola caliente que hace «blup» en su cazo.
// 1.133.1 (Francisco, 15-11-2026: «La musica de la sala de don celestino se escucha con mucho ruido de fondo»): fuera el rumor
// de la lluvia y las brasas, que eran ruido (un siseo continuo y chasquidos); las gotas, solo su nota de agua, sin soplo.
// Ahora todo lo que suena tiene tono.
import { azar, crearMusicaViva, nota, sala } from './cafeMusica';

const PULSO = 60 / 56;
const COMPAS = PULSO * 4;
const VUELTA = 8;
// [bajo, voces del arpegio] en números MIDI
const ACORDES = [
  [38, [50, 57, 62, 66]], // Re
  [35, [47, 54, 59, 62]], // Si menor
  [43, [50, 55, 59, 62]], // Sol
  [45, [49, 57, 61, 64]], // La
  [38, [50, 57, 62, 66]], // Re
  [42, [49, 54, 57, 61]], // Fa# menor
  [43, [50, 55, 59, 64]], // Sol add9
  [45, [50, 57, 62, 64]], // La sus4
];
const VARIANTES = { 3: [45, [49, 57, 61, 67]], 7: [45, [49, 57, 61, 64]] };
const PENTA = [69, 71, 74, 76, 78, 81, 83];
// Los dibujos del arpegio (índices de las voces por corchea): cada vuelta usa uno
const DIBUJOS = [
  [0, 2, 1, 3, 2, 1, 3, 2],
  [0, 1, 2, 3, 2, 3, 1, 2],
  [0, 2, 3, 2, 1, 2, 3, 1],
];

function montar(ctx, destino, inicio, { offline = false } = {}) {
  const salida = ctx.createGain();
  salida.gain.value = 1.4;
  const tono = ctx.createBiquadFilter();
  tono.type = 'lowpass';
  tono.frequency.value = 3600;
  tono.Q.value = 0.5;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 10;
  comp.ratio.value = 4;
  comp.attack.value = 0.01;
  comp.release.value = 0.3;
  const margen = ctx.createGain();
  margen.gain.value = 0.8;
  salida.connect(tono).connect(comp).connect(margen).connect(destino);
  const eco = sala(ctx);
  const ecoG = ctx.createGain();
  ecoG.gain.value = 0.28;
  eco.connect(ecoG).connect(salida);

  const guitarra = ctx.createGain();
  guitarra.gain.value = 0.9;
  guitarra.connect(salida);
  guitarra.connect(eco);
  const bajo = ctx.createGain();
  bajo.gain.value = 0.8;
  bajo.connect(salida);
  const arpa = ctx.createGain();
  arpa.gain.value = 0.55;
  arpa.connect(salida);
  arpa.connect(eco);
  const lluvia = ctx.createGain();
  lluvia.gain.value = 0.4;
  lluvia.connect(salida);
  const chelo = ctx.createGain();
  chelo.gain.value = 0.7;
  chelo.connect(salida);
  chelo.connect(eco);
  const hornillo = ctx.createGain();
  hornillo.gain.value = 0.5;
  hornillo.connect(salida);

  const tarde = (t) => !offline && t < ctx.currentTime + 0.02;
  /**
   * Una cuerda pulsada: un triángulo y un diente de sierra suave por un filtro que se cierra deprisa (el brillo del ataque que
   * se apaga, como el nailon) y una envolvente larga.
   */
  function cuerda(t, f, { dur = 1.8, pico = 0.08, brillo = 5, d }) {
    if (tarde(t)) return;
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass';
    fl.Q.value = 0.8;
    fl.frequency.setValueAtTime(Math.min(9000, f * brillo), t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(120, f * 1.3), t + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pico, t + 0.004);
    g.gain.exponentialRampToValueAtTime(pico * 0.35, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const o1 = ctx.createOscillator();
    o1.type = 'triangle';
    o1.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = f * 1.002;
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    o1.connect(fl);
    o2.connect(g2).connect(fl);
    fl.connect(g).connect(d);
    for (const o of [o1, o2]) {
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    o1.onended = () => {
      g.disconnect();
      fl.disconnect();
      g2.disconnect();
    };
  }
  /** Una gota en el cristal: una nota de agua muy breve, bajita, con su caída de tono (sin ruido). */
  function gota(t) {
    if (tarde(t)) return;
    const f = 1800 + Math.random() * 1600;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.008 + Math.random() * 0.006, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(lluvia);
    o.start(t);
    o.stop(t + 0.15);
    o.onended = () => g.disconnect();
  }

  /**
   * Una nota del violonchelo con arco: dos dientes de sierra algo desafinados por un filtro cálido, el arco que entra despacio,
   * el vibrato que llega cuando la nota ya suena y el arco que se levanta al final.
   */
  function arco(t, f, { dur, pico = 0.03 }) {
    if (tarde(t)) return;
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = Math.min(1100, f * 4); // 1.133.1: menos raspado de arco (sonaba a ruido)
    fl.Q.value = 0.9;
    const cuerpo = ctx.createBiquadFilter();
    cuerpo.type = 'peaking';
    cuerpo.frequency.value = 280;
    cuerpo.Q.value = 1;
    cuerpo.gain.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pico, t + 0.7);
    g.gain.setValueAtTime(pico, t + dur - 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const vib = ctx.createOscillator();
    vib.frequency.value = 4.8;
    const vibG = ctx.createGain();
    vibG.gain.setValueAtTime(0, t);
    vibG.gain.linearRampToValueAtTime(0, t + 0.6);
    vibG.gain.linearRampToValueAtTime(f * 0.005, t + 1.6);
    vib.connect(vibG);
    const os = [1, 1.0035].map((k) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f * k;
      vibG.connect(o.frequency);
      o.connect(fl);
      return o;
    });
    fl.connect(cuerpo).connect(g).connect(chelo);
    for (const o of [...os, vib]) {
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    os[0].onended = () => {
      g.disconnect();
      fl.disconnect();
      cuerpo.disconnect();
      vibG.disconnect();
    };
  }
  /** La cola caliente en su cazo: una burbuja que sube y revienta, grave y blanda. */
  function burbuja(t) {
    if (tarde(t)) return;
    const o = ctx.createOscillator();
    const f = 170 + Math.random() * 60;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.014, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g).connect(hornillo);
    o.start(t);
    o.stop(t + 0.12);
    o.onended = () => g.disconnect();
  }

  // Corcheas un poco sueltas (como a mano): cada una llega unos milisegundos antes o después
  const corchea = (c, k, r) => inicio + c * COMPAS + k * (PULSO / 2) + (r() - 0.5) * 0.02;
  let hecho = -1;
  let proximaGota = inicio + 3 + Math.random() * 4;
  let proximaBurbuja = inicio + 9 + Math.random() * 8;
  let ultimaChelo = 57;

  function compas(c) {
    const vuelta = Math.floor(c / VUELTA);
    const i = c % VUELTA;
    const r = azar(vuelta * 97 + i * 23 + 11);
    const [raiz, voces] = (vuelta % 2 === 1 && VARIANTES[i]) || ACORDES[i];
    const dibujo = DIBUJOS[vuelta % DIBUJOS.length];
    const t0 = inicio + c * COMPAS;
    const entra = c < 1;
    // El bajo, con el pulgar: en el 1 y, a veces, en el 3
    cuerda(t0, nota(raiz), { dur: 2.6, pico: 0.12, brillo: 3, d: bajo });
    if (!entra && r() < 0.7) cuerda(t0 + PULSO * 2, nota(raiz + (r() < 0.5 ? 7 : 12)), { dur: 2.0, pico: 0.08, brillo: 3, d: bajo });
    // El arpegio, con los demás dedos (en el último compás de la vuelta, más despacio: solo negras)
    dibujo.forEach((v, k) => {
      if (i === VUELTA - 1 && k % 2) return;
      const vel = k === 0 ? 0.95 : k % 2 ? 0.62 : 0.78;
      cuerda(corchea(c, k, r), nota(voces[v]), { dur: 1.9, pico: 0.06 * vel * (entra ? 0.8 : 1), brillo: 5 + r() * 2, d: guitarra });
    });
    // El violonchelo: desde la segunda vuelta, dos de cada tres, una nota larga cada dos compases, la más cercana a la anterior
    if (vuelta >= 1 && vuelta % 3 !== 2 && i % 2 === 0) {
      const opciones = [...voces, raiz + 12].flatMap((n) => [n, n - 12]).filter((n) => n >= 48 && n <= 64);
      let mejor = opciones[0];
      for (const n of opciones) if (Math.abs(n - ultimaChelo) < Math.abs(mejor - ultimaChelo) || (Math.abs(n - ultimaChelo) === Math.abs(mejor - ultimaChelo) && r() < 0.5)) mejor = n;
      ultimaChelo = mejor;
      arco(t0 + 0.05, nota(mejor), { dur: COMPAS * 2 - 0.1, pico: i === 0 ? 0.032 : 0.026 });
    }
    // El arpa: en vueltas alternas, unas pocas notas por encima, que caen dentro del acorde
    if (vuelta % 2 === 1 && i % 4 >= 1) {
      let ultima = PENTA[Math.floor(r() * PENTA.length)];
      for (let k = 0; k < 8; k += 1) {
        if (r() > 0.28) continue;
        const paso = PENTA.indexOf(ultima) + (r() < 0.5 ? -1 : 1);
        ultima = PENTA[Math.max(0, Math.min(PENTA.length - 1, paso))];
        cuerda(corchea(c, k, r), nota(ultima), { dur: 2.4, pico: 0.035, brillo: 8, d: arpa });
      }
    }
  }

  return {
    salida,
    programar(hasta) {
      const ultimo = Math.floor((hasta - inicio) / COMPAS);
      if (!offline) hecho = Math.max(hecho, Math.floor((ctx.currentTime - inicio) / COMPAS) - 1);
      while (hecho < ultimo) {
        hecho += 1;
        compas(hecho);
      }
      // Alguna gota suelta, y a veces dos o tres seguidas
      while (proximaGota < hasta) {
        gota(proximaGota);
        if (Math.random() < 0.3) gota(proximaGota + 0.12 + Math.random() * 0.2);
        proximaGota += 3 + Math.random() * 7;
      }
      // La cola que hace «blup» de tarde en tarde
      while (proximaBurbuja < hasta) {
        burbuja(proximaBurbuja);
        if (Math.random() < 0.35) burbuja(proximaBurbuja + 0.25 + Math.random() * 0.3);
        proximaBurbuja += 8 + Math.random() * 14;
      }
    },
    parar() {
      /* las notas se acaban solas */
    },
  };
}

/** La música del taller en directo (la misma forma que `crearCafeMusica`: arrancar, parar, atenuar y sonando). */
export function crearTallerMusica(abrir) {
  return crearMusicaViva(abrir, montar);
}

/** Para escucharla fuera de la app: `segundos` de música en un AudioBuffer (estéreo, 44,1 kHz). */
export async function renderTallerMusica(segundos = 60) {
  const ctx = new OfflineAudioContext(2, Math.ceil(44100 * segundos), 44100);
  const m = montar(ctx, ctx.destination, 0.05, { offline: true });
  m.programar(segundos);
  return ctx.startRendering();
}
