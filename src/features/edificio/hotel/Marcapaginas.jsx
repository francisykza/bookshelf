// 1.135 · El marcapáginas de seguir el precio de un mueble (el ordenador del piso y la ficha del almacén): una cinta de píxel con
// su muesca. Vacía, sin seguir; roja, lo sigues. Solo dibujo: quien lo usa dice qué es.
const BORDE = [
  [1, 0, 6, 1],
  [1, 0, 1, 10],
  [6, 0, 1, 10],
  [2, 8, 1, 1],
  [5, 8, 1, 1],
  [3, 7, 2, 1],
];
const DENTRO = [
  [2, 1, 4, 6],
  [2, 7, 1, 1],
  [5, 7, 1, 1],
];

export function Marcapaginas({ lleno = false, escala = 2, className = '' }) {
  return (
    <svg className={`marcapaginas ${className}`} data-lleno={lleno || undefined} viewBox="0 0 8 10" width={8 * escala} height={10 * escala} shapeRendering="crispEdges" aria-hidden="true">
      {DENTRO.map(([x, y, w, h]) => (
        <rect key={`d${x}-${y}-${w}`} x={x} y={y} width={w} height={h} fill={lleno ? '#a8434c' : '#fff8ea'} />
      ))}
      {BORDE.map(([x, y, w, h]) => (
        <rect key={`b${x}-${y}-${w}-${h}`} x={x} y={y} width={w} height={h} fill="#26231f" />
      ))}
    </svg>
  );
}
