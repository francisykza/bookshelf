// Dibujos del tablón: se guardan como trazos, nunca como imagen, y la app los pinta. `{ v: 1, s: [{ c: color, p: [x, y, x, y…] }] }`.
// Los límites son los mismos que comprueba `tablon_dibujo_limpio` en el servidor.
export const LADO = 120;
export const COLORES = ['#2F1C12', '#A8352B', '#2F6F8F', '#4A6B3F', '#C69845'];
export const COLOR_NOMBRES = ['Tinta', 'Rojo', 'Azul', 'Verde', 'Latón'];
export const MAX_TRAZOS = 150;
export const MAX_PUNTOS = 4000;
const GROSOR = 3;

const N = 140;
const MARGEN = 10;
const BORDE = 6;
const SALIDA = 480;
const PAPEL_FORMA = '#FBF4E2';

export const puntosDe = (trazos) => trazos.reduce((t, k) => t + k.p.length / 2, 0);

/** Pinta los trazos en `ctx`. `color` sustituye al de cada trazo y `ancho` al grosor, ambos en unidades del dibujo. */
export function pintar(ctx, trazos, escala, margen = 0, { color, ancho = GROSOR } = {}) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = ancho * escala;
  for (const k of trazos) {
    ctx.strokeStyle = color ?? COLORES[k.c] ?? COLORES[0];
    ctx.beginPath();
    ctx.moveTo((k.p[0] + margen) * escala, (k.p[1] + margen) * escala);
    if (k.p.length === 2) ctx.lineTo((k.p[0] + margen) * escala + 0.01, (k.p[1] + margen) * escala);
    for (let i = 2; i < k.p.length; i += 2) ctx.lineTo((k.p[i] + margen) * escala, (k.p[i + 1] + margen) * escala);
    ctx.stroke();
  }
}

/** La silueta: lo que tocan los trazos con su borde, más lo que queda encerrado por ellos. */
export function silueta(dibujo) {
  const total = N * N;
  const solido = new Uint8Array(total);
  const sello = (cx, cy) => {
    for (let dy = -BORDE; dy <= BORDE; dy += 1)
      for (let dx = -BORDE; dx <= BORDE; dx += 1) {
        const x = cx + dx;
        const y = cy + dy;
        if (dx * dx + dy * dy <= BORDE * BORDE && x >= 0 && y >= 0 && x < N && y < N) solido[y * N + x] = 1;
      }
  };
  for (const { p } of dibujo.s) {
    for (let i = 0; i < p.length; i += 2) {
      const x = p[i] + MARGEN;
      const y = p[i + 1] + MARGEN;
      const px = i ? p[i - 2] + MARGEN : x;
      const py = i ? p[i - 1] + MARGEN : y;
      const pasos = Math.max(Math.abs(x - px), Math.abs(y - py), 1);
      for (let t = 0; t <= pasos; t += 1) sello(Math.round(px + ((x - px) * t) / pasos), Math.round(py + ((y - py) * t) / pasos));
    }
  }
  const fuera = new Uint8Array(total);
  const pila = [];
  const entra = (x, y) => {
    const i = y * N + x;
    if (!solido[i] && !fuera[i]) {
      fuera[i] = 1;
      pila.push(i);
    }
  };
  for (let k = 0; k < N; k += 1) {
    entra(k, 0);
    entra(k, N - 1);
    entra(0, k);
    entra(N - 1, k);
  }
  while (pila.length) {
    const i = pila.pop();
    const x = i % N;
    const y = (i - x) / N;
    if (x > 0) entra(x - 1, y);
    if (x < N - 1) entra(x + 1, y);
    if (y > 0) entra(x, y - 1);
    if (y < N - 1) entra(x, y + 1);
  }
  const encerrado = new Uint8Array(total);
  for (let i = 0; i < total; i += 1) encerrado[i] = !solido[i] && !fuera[i] ? 1 : 0;
  return { n: N, solido, encerrado };
}

const memoria = new WeakMap();
const memo = (dibujo) => {
  if (!memoria.has(dibujo)) memoria.set(dibujo, {});
  return memoria.get(dibujo);
};

/** Dónde se clava una forma: en la columna con papel más cercana al centro, en lo alto. Fracciones del cuadrado. */
export function pinDe(dibujo) {
  const m = memo(dibujo);
  if (m.pin) return m.pin;
  const { solido, encerrado } = silueta(dibujo);
  const c = N >> 1;
  for (let d = 0; d < c; d += 1) {
    for (const x of d ? [c - d, c + d] : [c]) {
      for (let y = 0; y < N; y += 1) {
        if (solido[y * N + x] || encerrado[y * N + x]) {
          m.pin = { x: (x + 0.5) / N, y: (y + BORDE * 0.6) / N };
          return m.pin;
        }
      }
    }
  }
  m.pin = { x: 0.5, y: 0 };
  return m.pin;
}

/** La imagen del dibujo con fondo transparente: solo la tinta, o la tinta sobre su recorte de papel. */
export function dibujoCanvas(dibujo, forma) {
  const m = memo(dibujo);
  const clave = forma ? 'forma' : 'hoja';
  if (m[clave]) return m[clave];
  const canvas = document.createElement('canvas');
  canvas.width = SALIDA;
  canvas.height = SALIDA;
  const ctx = canvas.getContext('2d');
  const escala = SALIDA / N;
  if (forma) {
    pintar(ctx, dibujo.s, escala, MARGEN, { color: PAPEL_FORMA, ancho: BORDE * 2 });
    // Todo lo que queda dentro de la silueta, salvo su última fila: el borde suave lo pone el trazo grueso de arriba
    const { solido, encerrado } = silueta(dibujo);
    const lleno = (x, y) => x >= 0 && y >= 0 && x < N && y < N && (solido[y * N + x] || encerrado[y * N + x]);
    ctx.fillStyle = PAPEL_FORMA;
    for (let y = 0; y < N; y += 1) {
      for (let x = 0; x < N; x += 1) {
        if (lleno(x, y) && lleno(x - 1, y) && lleno(x + 1, y) && lleno(x, y - 1) && lleno(x, y + 1)) ctx.fillRect(Math.floor(x * escala), Math.floor(y * escala), Math.ceil(escala) + 1, Math.ceil(escala) + 1);
      }
    }
  }
  pintar(ctx, dibujo.s, escala, MARGEN);
  m[clave] = canvas;
  return canvas;
}

export function dibujoUrl(dibujo, forma) {
  const m = memo(dibujo);
  const clave = forma ? 'urlForma' : 'urlHoja';
  if (!m[clave]) m[clave] = dibujoCanvas(dibujo, forma).toDataURL('image/png');
  return m[clave];
}
