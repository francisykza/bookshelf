// La estiba, dibujada (1.86): un carguero visto en corte, atracado al caer la tarde, con la bodega abierta a la vista. El fondo y
// el casco se pintan una vez; en cada fotograma solo cambian el agua, las gaviotas y los bultos. Cuanta más carga, más sube el agua
// por el casco. Al zarpar se iza la vela y el barco se va; después queda el muelle vacío y el barco a lo lejos. Con movimiento
// reducido no hay bucle: cada cosa va directa a su sitio.
import { renderThumb } from '../render';
import { recortar } from './CajaCasino';
import { bultoDe, girar, huecosDe } from './estiba';

export const ESTIBA_W = 216;
export const ESTIBA_H = 196;
const C = 24; // Lo que mide un hueco
const X0 = 12; // Dónde empieza la bodega
const Y0 = 52;
const CUBIERTA = Y0 - 6;
const AGUA = 186; // Hasta dónde llega el agua con el barco vacío
const SUBE = 9; // Lo que sube con la carga entera

const azar = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function lienzo(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const CIELO = ['#2e3a5c', '#4a4468', '#7c5470', '#b86a66', '#e8945c', '#f6c070'];

/** El cielo de tarde en tramado, el sol, el puerto a lo lejos y el mar. */
function fondo() {
  const [c, g] = lienzo(ESTIBA_W, ESTIBA_H);
  const alto = 76;
  for (let y = 0; y < 120; y += 1) {
    for (let x = 0; x < ESTIBA_W; x += 1) {
      const t = Math.min(CIELO.length - 1, (y / alto) * (CIELO.length - 1));
      const k = Math.floor(t);
      const salta = t - k > (BAYER[y % 4][x % 4] + 0.5) / 16;
      g.fillStyle = CIELO[Math.min(CIELO.length - 1, k + (salta ? 1 : 0))];
      g.fillRect(x, y, 1, 1);
    }
  }
  // Las primeras estrellas
  g.fillStyle = '#f4e8c8';
  for (let i = 0; i < 16; i += 1) g.fillRect(Math.floor(azar(i, 1) * ESTIBA_W), Math.floor(azar(i, 2) * 26), 1, 1);
  // El sol, bajo, detrás de las grúas
  g.fillStyle = '#ffe2a0';
  for (let y = -13; y <= 13; y += 1) {
    const w = Math.floor(Math.sqrt(169 - y * y));
    g.fillRect(176 - w, 34 + y, w * 2, 1);
  }
  // El puerto: tinglados y dos grúas
  g.fillStyle = '#3a3050';
  g.fillRect(0, 106, ESTIBA_W, 14);
  for (const [x, w, h] of [
    [4, 26, 8],
    [38, 18, 13],
    [120, 30, 7],
    [186, 26, 11],
  ])
    g.fillRect(x, 106 - h, w, h);
  for (const x of [66, 150]) {
    g.fillRect(x, 16, 3, 90);
    g.fillRect(x - 16, 16, 30, 2);
    g.fillRect(x - 15, 18, 1, 12);
    g.fillRect(x - 18, 30, 5, 3);
  }
  // El mar, con el reflejo del sol
  for (let y = 120; y < ESTIBA_H; y += 1) {
    const t = (y - 120) / (ESTIBA_H - 120);
    g.fillStyle = t < 0.3 ? '#3c6a7c' : t < 0.65 ? '#2a5068' : '#1e3a54';
    g.fillRect(0, y, ESTIBA_W, 1);
  }
  g.fillStyle = '#e8b878';
  for (let y = 121; y < 150; y += 3) g.fillRect(164 + Math.floor(azar(y, 3) * 8), y, 8 + Math.floor(azar(y, 4) * 10), 1);
  return c;
}

const hueco = (x, y) => [X0 + x * C, Y0 + y * C];

/** El casco en corte, con su forro de tablas, las cuadernas, el farol y lo que no se puede ocupar. */
function casco(bodega) {
  const [c, g] = lienzo(ESTIBA_W, ESTIBA_H);
  const casillas = new Set(bodega.bloqueadas.map(([x, y]) => `${x}:${y}`));
  const fondoY = Y0 + bodega.h * C;
  // El casco por fuera: cae en curva hacia la quilla
  const borde = (y) => {
    const t = Math.max(0, (y - (Y0 + 56)) / (fondoY + 8 - (Y0 + 56)));
    return Math.round(t * t * 54);
  };
  for (let y = CUBIERTA; y < fondoY + 8; y += 1) {
    const b = borde(y);
    const franja = y >= fondoY - 30 ? '#8a2c2c' : y > Y0 + 40 ? '#26313f' : '#2e3a48';
    g.fillStyle = franja;
    g.fillRect(b, y, ESTIBA_W - b * 2, 1);
    g.fillStyle = '#121824';
    g.fillRect(b, y, 2, 1);
    g.fillRect(ESTIBA_W - b - 2, y, 2, 1);
  }
  // La cubierta y la borda
  g.fillStyle = '#a87a48';
  g.fillRect(0, CUBIERTA, ESTIBA_W, 3);
  g.fillStyle = '#d8ae72';
  g.fillRect(0, CUBIERTA, ESTIBA_W, 1);
  g.fillStyle = '#5a3a22';
  g.fillRect(0, CUBIERTA + 3, ESTIBA_W, 3);
  for (let x = 3; x < ESTIBA_W; x += 14) {
    g.fillStyle = '#e8e0cc';
    g.fillRect(x, CUBIERTA - 7, 2, 7);
  }
  g.fillStyle = '#e8e0cc';
  g.fillRect(0, CUBIERTA - 8, ESTIBA_W, 2);
  // Las tablas de la bodega
  for (let y = 0; y < bodega.h; y += 1) {
    for (let x = 0; x < bodega.w; x += 1) {
      const [px, py] = hueco(x, y);
      if (casillas.has(`${x}:${y}`)) continue;
      g.fillStyle = (x + y) % 2 ? '#3e2a22' : '#463026';
      g.fillRect(px, py, C, C);
      g.fillStyle = '#2c1c18';
      g.fillRect(px, py + C - 1, C, 1);
      g.fillRect(px + C - 1, py, 1, C);
      g.fillStyle = '#5a4034';
      g.fillRect(px + 2, py + 2, 2, 1);
      g.fillRect(px + C - 4, py + 2, 1, 1);
      g.fillRect(px + 2, py + C - 4, 1, 1);
    }
  }
  // Lo que no se puede ocupar: la curva del casco y el pie del palo
  for (const [x, y] of bodega.bloqueadas) {
    const [px, py] = hueco(x, y);
    const palo = y < 2;
    g.fillStyle = palo ? '#7a5230' : '#5e2a26';
    g.fillRect(px, py, C, C);
    g.fillStyle = palo ? '#94683e' : '#74362e';
    for (let k = 3; k < C; k += 6) g.fillRect(px, py + k, C, 1);
    g.fillStyle = '#1e1214';
    g.fillRect(px, py, 1, C);
    g.fillRect(px + C - 1, py, 1, C);
    g.fillRect(px, py + C - 1, C, 1);
  }
  // El palo, que sube desde la bodega
  const palo = bodega.bloqueadas.find(([, y]) => y === 0);
  if (palo) {
    const [px] = hueco(palo[0], 0);
    const mx = px + C / 2 - 2;
    g.fillStyle = '#6a4426';
    g.fillRect(mx, 2, 4, CUBIERTA);
    g.fillStyle = '#946a3e';
    g.fillRect(mx, 2, 1, CUBIERTA);
    g.fillStyle = '#5a3a22';
    g.fillRect(mx - 22, 12, 48, 2);
    // Una bandera sin escudo ni letras
    g.fillStyle = '#c84a3c';
    g.fillRect(mx + 4, 3, 9, 3);
    g.fillRect(mx + 4, 6, 6, 1);
  }
  return c;
}

const TONOS = [
  ['#c89858', '#e8bc7c', '#8a6236'],
  ['#a86a42', '#cc8c5c', '#74452a'],
  ['#7c9078', '#a0b49a', '#54664f'],
  ['#c4765a', '#e49a78', '#8a4c3a'],
  ['#8a86a8', '#aeaacc', '#5e5a7a'],
  ['#d0ae62', '#ecd08a', '#94783c'],
];
const hechos = new Map();

/** Un bulto: cajas de listones unidas, con cinchas y el mueble que lleva. `c` es lo que mide un hueco. */
export function pintarBulto(pieza, rot, c = C) {
  const clave = `${pieza.id}:${pieza.celdas.join('/')}:${rot}:${c}`;
  if (hechos.has(clave)) return hechos.get(clave);
  const forma = girar(pieza.celdas, rot);
  const w = Math.max(...forma.map((p) => p[0])) + 1;
  const h = Math.max(...forma.map((p) => p[1])) + 1;
  const [lienzoB, g] = lienzo(w * c, h * c);
  const [base, luz, sombra] = TONOS[pieza.id % TONOS.length];
  const hay = new Set(forma.map(([x, y]) => `${x}:${y}`));
  const paso = Math.max(4, Math.round(c / 4));
  for (const [x, y] of forma) {
    const px = x * c;
    const py = y * c;
    g.fillStyle = base;
    g.fillRect(px, py, c, c);
    g.fillStyle = sombra;
    for (let k = paso; k < c; k += paso) g.fillRect(px, py + k, c, 1);
    // Solo el contorno de fuera: por dentro es un único bulto
    const dentro = Math.max(1, Math.round(c / 12));
    const ink = '#2a160c';
    if (!hay.has(`${x}:${y - 1}`)) {
      g.fillStyle = luz;
      g.fillRect(px, py + dentro, c, dentro);
      g.fillStyle = ink;
      g.fillRect(px, py, c, dentro);
    }
    if (!hay.has(`${x - 1}:${y}`)) {
      g.fillStyle = luz;
      g.fillRect(px + dentro, py, dentro, c);
      g.fillStyle = ink;
      g.fillRect(px, py, dentro, c);
    }
    if (!hay.has(`${x}:${y + 1}`)) {
      g.fillStyle = ink;
      g.fillRect(px, py + c - dentro, c, dentro);
    }
    if (!hay.has(`${x + 1}:${y}`)) {
      g.fillStyle = ink;
      g.fillRect(px + c - dentro, py, dentro, c);
    }
  }
  // El mueble, sobre el hueco más céntrico
  const mx = forma.reduce((n, p) => n + p[0], 0) / forma.length;
  const my = forma.reduce((n, p) => n + p[1], 0) / forma.length;
  const [ax, ay] = [...forma].sort((p, q) => Math.hypot(p[0] - mx, p[1] - my) - Math.hypot(q[0] - mx, q[1] - my))[0];
  const lado = c;
  const dibujo = recortar(renderThumb(bultoDe(pieza).id, 0, 96), lado * 2);
  g.drawImage(dibujo, ax * c, ay * c, lado, lado);
  hechos.set(clave, lienzoB);
  return lienzoB;
}

const GAVIOTA = {
  quieta: ['..##...', '.#####o', '..####.', '...##..'],
  arriba: ['#.....#', '.#...#.', '..###..'],
  abajo: ['..###..', '.#...#.', '#.....#'],
};
function gaviota(g, x, y, forma) {
  const filas = GAVIOTA[forma];
  filas.forEach((f, j) => {
    [...f].forEach((ch, i) => {
      if (ch === '.') return;
      g.fillStyle = ch === 'o' ? '#f2c23c' : '#f6f4ea';
      g.fillRect(Math.round(x) + i, Math.round(y) + j, 1, 1);
    });
  });
}

/** Pinta la escena en `canvas` y la deja viva. `poner` cambia lo que hay; `celda` traduce un toque a un hueco de la bodega. */
export function crearEstiba(canvas, { reducido = false } = {}) {
  canvas.width = ESTIBA_W;
  canvas.height = ESTIBA_H;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const cielo = fondo();
  let estado = { bodega: null, carga: [], mano: null, ido: false };
  let barco = null;
  let bodegaVista = null;
  let llenado = 0;
  let zarpe = null; // { t0, fin }
  let raf = 0;
  let ultimo = 0;
  let salto = -10;

  const pintar = (t) => {
    g.drawImage(cielo, 0, 0);
    const { bodega, carga, mano, ido } = estado;
    if (!bodega) return;
    const objetivo = bodega.total ? (ido ? 0 : carga.reduce((n, c) => n + (bodega.piezas.find((p) => p.id === c.pieza)?.celdas.length ?? 0), 0) / bodega.total) : 0;
    llenado = reducido ? objetivo : llenado + (objetivo - llenado) * 0.12;
    const nivel = AGUA - Math.round(llenado * SUBE);
    const avance = zarpe ? Math.min(1, (t - zarpe.t0) / 2600) : 0;
    const dx = Math.round(avance * avance * 250);
    const vela = zarpe ? Math.min(1, (t - zarpe.t0) / 700) : 0;

    if (ido && !zarpe) {
      // El muelle vacío y el barco a lo lejos
      g.fillStyle = '#26313f';
      g.fillRect(186, 116, 10, 3);
      g.fillStyle = '#efe4c8';
      g.fillRect(190, 108, 4, 8);
      g.fillStyle = '#6a4426';
      g.fillRect(189, 106, 1, 10);
    } else {
      g.save();
      g.translate(dx, Math.round(Math.sin(t / 900) * (reducido ? 0 : 0.6)));
      g.drawImage(barco, 0, 0);
      for (const c of carga) {
        const p = bodega.piezas.find((x) => x.id === c.pieza);
        if (!p) continue;
        const [px, py] = hueco(c.x, c.y);
        g.drawImage(pintarBulto(p, c.rot), px, py);
      }
      if (vela > 0) {
        const palo = bodega.bloqueadas.find(([, y]) => y === 0);
        const mx = hueco(palo[0], 0)[0] + C / 2;
        const alto = Math.round(30 * vela);
        g.fillStyle = '#efe4c8';
        g.fillRect(mx - 22, 14, 44, alto);
        g.fillStyle = '#c8b894';
        g.fillRect(mx + 16, 14, 6, alto);
        g.fillStyle = '#c84a3c';
        g.fillRect(mx - 22, 14 + Math.round(alto * 0.45), 44, 3);
      }
      if (mano && mano.x !== null) {
        const p = bodega.piezas.find((x) => x.id === mano.pieza);
        if (p) {
          const [px, py] = hueco(mano.x, mano.y);
          g.globalAlpha = 0.9;
          g.drawImage(pintarBulto(p, mano.rot), px, py);
          g.globalAlpha = 1;
          // El aviso de si cabe, sobre cada hueco
          g.fillStyle = mano.cabe ? '#8ce08c' : '#ff5a4a';
          for (const [x, y] of huecosDe(p, mano.x, mano.y, mano.rot)) {
            const [hx, hy] = hueco(x, y);
            g.fillRect(hx + 1, hy + 1, C - 2, 2);
            g.fillRect(hx + 1, hy + C - 3, C - 2, 2);
            g.fillRect(hx + 1, hy + 1, 2, C - 2);
            g.fillRect(hx + C - 3, hy + 1, 2, C - 2);
          }
        }
      }
      // La gaviota de la verga, que da un saltito cuando llega un bulto
      const palo = bodega.bloqueadas.find(([, y]) => y === 0);
      if (palo && !zarpe) {
        const hop = t - salto < 320 ? Math.round(Math.sin(((t - salto) / 320) * Math.PI) * 4) : 0;
        gaviota(g, hueco(palo[0], 0)[0] + 24, 8 - hop, 'quieta');
      }
      g.restore();
    }

    // El agua por delante: sube con la carga
    const ola = reducido ? 0 : t / 420;
    for (let x = 0; x < ESTIBA_W; x += 1) {
      const y = nivel + Math.round(Math.sin(x / 9 + ola) * 1.2);
      g.fillStyle = '#9cc8cc';
      g.fillRect(x, y, 1, 1);
      g.fillStyle = '#2a5a72';
      g.fillRect(x, y + 1, 1, ESTIBA_H - y - 1);
    }
    g.fillStyle = '#4c8496';
    for (let i = 0; i < 12; i += 1) {
      const x = (azar(i, 7) * ESTIBA_W + (reducido ? 0 : t / 60) * (i % 2 ? 1 : -1)) % ESTIBA_W;
      g.fillRect(Math.floor((x + ESTIBA_W) % ESTIBA_W), nivel + 3 + (i % 5) * 2, 7, 1);
    }
    // Una gaviota que cruza, sin prisa
    if (!reducido) {
      const u = (t / 14000) % 1;
      gaviota(g, u * (ESTIBA_W + 40) - 20, 26 + Math.sin(t / 1100) * 5, Math.floor(t / 260) % 2 ? 'arriba' : 'abajo');
    }
    if (zarpe && avance >= 1) {
      const fin = zarpe.fin;
      zarpe = null;
      fin?.();
    }
  };

  const bucle = (now) => {
    raf = requestAnimationFrame(bucle);
    if (now - ultimo < 66) return;
    ultimo = now;
    pintar(now);
  };
  if (!reducido) raf = requestAnimationFrame(bucle);

  return {
    poner(nuevo) {
      const llega = nuevo.carga.length > estado.carga.length;
      estado = { ...estado, ...nuevo };
      if (estado.bodega && estado.bodega !== bodegaVista) {
        bodegaVista = estado.bodega;
        barco = casco(estado.bodega);
      }
      if (llega) salto = performance.now();
      pintar(performance.now());
    },
    /** El hueco bajo un toque (puede salirse de la bodega) o `null` si está lejos de ella. */
    celda(cx, cy) {
      const r = canvas.getBoundingClientRect();
      const x = ((cx - r.left) / r.width) * ESTIBA_W;
      const y = ((cy - r.top) / r.height) * ESTIBA_H;
      if (y < Y0 - 30 || !estado.bodega) return null;
      return { x: Math.floor((x - X0) / C), y: Math.floor((y - Y0) / C) };
    },
    /** Iza la vela y se va; `fin` se llama cuando ya no se ve. */
    zarpar(fin) {
      if (reducido) {
        fin?.();
        return;
      }
      zarpe = { t0: performance.now(), fin };
    },
    destruir() {
      cancelAnimationFrame(raf);
    },
  };
}
