// El café-librería del bajo, 1.132 (§16.2): el dibujo del reloj de arena del influencer (RelojArena.jsx), en filas de letras
// para PixelArt. Solo el dibujo: sin React.

export const PALETA_ARENA = {
  k: '#2a1a10',
  L: '#f6d98a',
  B: '#d9a441',
  D: '#9a6a24',
  g: 'rgb(190 226 232 / 0.3)',
  G: 'rgb(255 255 255 / 0.62)',
  a: '#e9c27a',
  A: '#c99a4e',
  s: '#fff1c8',
};
const ANCHO = 17;
const CENTRO = 8;
/** El cristal por filas: [desde, hasta] (las columnas de dentro). La arena de arriba, de la fila 5 a la 13; la de abajo, de la 14 a la 21. */
const CRISTAL = {
  4: [4, 12],
  5: [4, 12],
  6: [4, 12],
  7: [4, 12],
  8: [4, 12],
  9: [5, 11],
  10: [6, 10],
  11: [7, 9],
  12: [8, 8],
  13: [8, 8],
  14: [7, 9],
  15: [6, 10],
  16: [5, 11],
  17: [4, 12],
  18: [4, 12],
  19: [4, 12],
  20: [4, 12],
  21: [4, 12],
};
const celdas = (filas) => filas.flatMap((y) => Array.from({ length: CRISTAL[y][1] - CRISTAL[y][0] + 1 }, (_, k) => [CRISTAL[y][0] + k, y]));
// Arriba, la arena se queda en las orillas y baja primero por el centro (el embudo); abajo, crece primero en el centro (el montón)
const ARRIBA = celdas([5, 6, 7, 8, 9, 10, 11, 12, 13]).sort((p, q) => q[1] - p[1] || Math.abs(q[0] - CENTRO) - Math.abs(p[0] - CENTRO));
const ABAJO = celdas([14, 15, 16, 17, 18, 19, 20, 21]).sort((p, q) => q[1] - p[1] || Math.abs(p[0] - CENTRO) - Math.abs(q[0] - CENTRO));
const TOTAL = ARRIBA.length;

/**
 * El dibujo del reloj (filas de letras para `PixelArt`) con `queda` de arena arriba (de 1 a 0) y `fase` (0 o 1) para el hilo que
 * cae. Se exporta para las pruebas.
 */
export function relojFilas(queda = 1, fase = 0) {
  // La tapa de arriba (con su brillo), el cristal entre los dos postes y la base
  const g = ['.' + 'k'.repeat(ANCHO - 2) + '.', 'k' + 'L'.repeat(ANCHO - 2) + 'k', 'k' + 'B'.repeat(ANCHO - 2) + 'k', '.k' + 'D'.repeat(ANCHO - 4) + 'k.'];
  for (let y = 4; y <= 21; y += 1) {
    const fila = Array(ANCHO).fill('.');
    fila[0] = 'k';
    fila[1] = 'B';
    fila[ANCHO - 2] = 'D';
    fila[ANCHO - 1] = 'k';
    const [x0, x1] = CRISTAL[y];
    fila[x0 - 1] = 'k';
    fila[x1 + 1] = 'k';
    for (let x = x0; x <= x1; x += 1) fila[x] = x === x0 && ((y >= 5 && y <= 7) || (y >= 17 && y <= 19)) ? 'G' : 'g';
    g.push(fila);
  }
  const arriba = Math.max(0, Math.min(TOTAL, Math.ceil(Math.max(0, Math.min(1, queda)) * TOTAL)));
  const abajo = TOTAL - arriba;
  const pinta = ([x, y]) => {
    g[y][x] = (x + y) % 5 === 0 ? 'A' : 'a';
  };
  ARRIBA.slice(0, arriba).forEach(pinta);
  ABAJO.slice(0, abajo).forEach(pinta);
  // El hilo de arena, mientras queda arriba y ya ha empezado a caer: granos que bajan por el centro hasta el montón
  if (arriba > 0 && arriba < TOTAL) {
    for (let y = 14; y <= 21 && g[y][CENTRO] !== 'a' && g[y][CENTRO] !== 'A'; y += 1) if ((y + fase) % 2 === 0) g[y][CENTRO] = 's';
  }
  for (let y = 4; y <= 21; y += 1) g[y] = g[y].join('');
  g.push('.k' + 'L'.repeat(ANCHO - 4) + 'k.', 'k' + 'B'.repeat(ANCHO - 2) + 'k', 'k' + 'D'.repeat(ANCHO - 2) + 'k', '.' + 'k'.repeat(ANCHO - 2) + '.');
  return g;
}

/** Con movimiento reducido: una barra de latón con su cristal, y la arena, que se vacía de derecha a izquierda. */
export function barraFilas(queda = 1) {
  const dentro = 16;
  const llena = Math.ceil(Math.max(0, Math.min(1, queda)) * dentro);
  const borde = '.' + 'k'.repeat(dentro + 6) + '.';
  const out = [borde, 'kLB' + 'k'.repeat(dentro + 2) + 'BDk'];
  for (let y = 2; y <= 4; y += 1) {
    let f = '';
    for (let x = 0; x < dentro; x += 1) f += x < llena ? ((x + y) % 5 === 0 ? 'A' : 'a') : y === 2 ? 'G' : 'g';
    out.push('kLBk' + f + 'kBDk');
  }
  out.push('kLB' + 'k'.repeat(dentro + 2) + 'BDk', borde);
  return out;
}
