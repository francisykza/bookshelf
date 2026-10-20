// Haces de sol (komorebi) que entran por la pérgola desde arriba a la derecha y cruzan la cama.
// Centro, dirección unitaria, longitud, anchura (σ) e intensidad, en px de la imagen.
const dir = (deg) => ({ dx: Math.cos((deg * Math.PI) / 180), dy: Math.sin((deg * Math.PI) / 180) });

export const BEAMS = [
  { x: 560, y: 1000, ...dir(122), len: 1100, w: 46, strength: 0.9 },
  { x: 360, y: 980, ...dir(122), len: 1000, w: 30, strength: 0.75 },
  { x: 760, y: 1120, ...dir(122), len: 900, w: 34, strength: 0.7 },
  { x: 200, y: 760, ...dir(118), len: 700, w: 24, strength: 0.6 },
];
