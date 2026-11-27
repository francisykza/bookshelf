// Reglas de los veleros de la bahía (SPEC §16, Anexo A): sin React, para poder probarlas.

/** Desfase determinista por habitación y barco (0–1): fracción del recorrido y del cabeceo, sin azar por render. */
export function boatPhase(roomId, index) {
  let h = 2166136261;
  for (const ch of `${roomId}:${index}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/** Punto del carril para una fracción `t` (posición estática con movimiento reducido). */
export const staticPoint = (lane, t) => [lane.from[0] + (lane.to[0] - lane.from[0]) * t, lane.from[1] + (lane.to[1] - lane.from[1]) * t];

/** ¿Está el punto dentro del polígono? (regla par-impar) */
export function insidePolygon([x, y], poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** ¿Cabe el barco entero (casco y vela) en alguna región de agua en este punto del carril? */
export function boatInWater(sea, lane, t) {
  const [x, y] = staticPoint(lane, t);
  const w = lane.size;
  const h = lane.size * 1.15;
  const corners = [[x - w / 2, y], [x + w / 2, y], [x, y - h], [x - w * 0.35, y - h * 0.25], [x + w * 0.35, y - h * 0.25]];
  return sea.water.some((poly) => corners.every((c) => insidePolygon(c, poly)));
}
