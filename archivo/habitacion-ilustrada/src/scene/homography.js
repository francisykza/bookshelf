// Transformación proyectiva rectángulo → cuadrilátero (SPEC §3.2): la fila de libros de cada balda
// pintada sigue exactamente el ángulo de fuga del mueble. Devuelve un `matrix3d` con origen en 0 0.

export function rectToQuad(width, height, quad) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = den ? (dx3 * dy2 - dx2 * dy3) / den : 0;
  const h = den ? (dx1 * dy3 - dx3 * dy1) / den : 0;
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + h * x3;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + h * y3;
  const m = [a / width, d / width, 0, g / width, b / height, e / height, 0, h / height, 0, 0, 1, 0, x0, y0, 0, 1];
  return `matrix3d(${m.map((v) => +v.toFixed(8)).join(',')})`;
}

/** Punto (u, v) del rectángulo local → coordenadas de la imagen dentro del cuadrilátero. */
export function projectPoint(width, height, quad, u, v) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
  const s = u / width;
  const t = v / height;
  // Interpolación bilineal: suficiente para anclar etiquetas sobre un lomo
  const x = (1 - s) * (1 - t) * x0 + s * (1 - t) * x1 + s * t * x2 + (1 - s) * t * x3;
  const y = (1 - s) * (1 - t) * y0 + s * (1 - t) * y1 + s * t * y2 + (1 - s) * t * y3;
  return { x, y };
}

/** Centro y caja de un polígono (para colocar botones con `clip-path`). */
export function bounds(shape) {
  const xs = shape.map((p) => p[0]);
  const ys = shape.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function clipPolygon(shape) {
  const box = bounds(shape);
  const parts = shape.map(([px, py]) => `${(((px - box.x) / box.w) * 100).toFixed(2)}% ${(((py - box.y) / box.h) * 100).toFixed(2)}%`);
  return `polygon(${parts.join(', ')})`;
}

export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
