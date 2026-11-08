// Iconos propios de «Escritorio del puerto» (1.90): cuadrícula de 24 × 24, solo rectángulos, dos colores (el del texto y el latón).
// Cada icono: [rectángulos en el color del texto, rectángulos en el acento]; cada rectángulo es «x,y,ancho,alto».
const ICONS = {
  libro: ['5,3,14,2 5,19,14,2 5,5,2,14 17,5,2,14', '10,8,5,2 10,12,5,2'],
  estanteria: ['4,3,2,18 18,3,2,18 4,3,16,2 4,11,16,2 4,19,16,2', '8,5,2,6 11,6,2,5 14,5,2,6 8,13,2,6 12,14,2,5'],
  pincel: ['16,3,3,3 14,5,3,3 12,7,3,3 10,9,3,3', '6,12,6,3 5,15,6,3 4,18,5,3'],
  menu: ['4,6,16,2 4,11,16,2 4,16,16,2', ''],
  aplicaciones: ['4,4,7,7 13,4,7,7 4,13,7,7 13,13,7,7', ''],
  calendario: ['4,5,16,2 4,19,16,2 4,7,2,12 18,7,2,12 4,9,16,2 8,3,2,4 14,3,2,4', '8,12,3,3 13,12,3,3 8,16,3,2'],
  cuaderno: ['6,3,13,2 6,19,13,2 6,5,2,14 17,5,2,14 4,7,4,2 4,11,4,2 4,15,4,2', '11,8,4,2 11,12,4,2'],
  grafico: ['4,4,2,16 4,18,16,2', '8,12,3,6 13,8,3,10 17,5,3,13'],
  busqueda: ['8,4,6,2 8,14,6,2 6,6,2,8 14,6,2,8', '15,15,3,3 17,17,3,3'],
  altavoz: ['3,9,4,6 7,7,2,10 9,5,2,14', '13,9,2,6 16,7,2,10 19,10,2,4'],
  nota: ['13,4,2,13 15,4,5,2 18,6,2,2', '8,15,7,5'],
  ola: ['2,10,4,2 6,8,4,2 10,10,4,2 14,8,4,2 18,10,4,2', '2,16,4,2 6,14,4,2 10,16,4,2 14,14,4,2 18,16,4,2'],
  sol: ['11,2,2,4 11,18,2,4 2,11,4,2 18,11,4,2 5,5,2,2 17,5,2,2 5,17,2,2 17,17,2,2', '9,9,6,6'],
  luna: ['10,3,6,2 7,5,4,2 5,7,3,10 7,17,4,2 10,19,6,2 15,17,3,2', '16,8,2,2 13,11,2,2'],
  flecha: ['4,11,14,2 12,7,2,2 14,9,2,2 16,11,2,2 14,13,2,2 12,15,2,2', ''],
  cerrar: ['5,5,3,3 8,8,3,3 11,11,2,2 13,13,3,3 16,16,3,3 16,5,3,3 13,8,3,3 8,13,3,3 5,16,3,3', ''],
  check: ['4,12,3,3 7,15,3,3 10,13,3,3 13,10,3,3 16,7,3,3 19,4,2,3', ''],
  error: ['8,3,8,2 8,19,8,2 4,7,2,10 18,7,2,10 6,5,2,2 16,5,2,2 6,17,2,2 16,17,2,2 11,7,2,6 11,15,2,2', ''],
  ordenador: ['3,4,18,2 3,14,18,2 3,6,2,8 19,6,2,8 9,16,6,2 6,18,12,2', '8,8,8,4'],
  edificio: ['5,3,14,2 5,3,2,18 17,3,2,18 5,19,14,2', '9,7,2,3 13,7,2,3 9,12,2,3 13,12,2,3'],
  ajustes: ['4,7,16,2 4,15,16,2', '14,5,4,6 7,13,4,6'],
  lapiz: ['16,4,4,4 13,7,4,4 10,10,4,4 7,13,4,4', '4,17,4,3'],
  papelera: ['5,6,14,2 10,3,4,3 7,8,2,13 15,8,2,13 7,19,10,2', '11,10,2,7'],
  reloj: ['8,3,8,2 8,19,8,2 4,7,2,10 18,7,2,10 6,5,2,2 16,5,2,2 6,17,2,2 16,17,2,2', '11,7,2,6 11,12,5,2'],
};

const rects = (list, fill) =>
  list
    .split(' ')
    .filter(Boolean)
    .map((r) => {
      const [x, y, width, height] = r.split(',');
      return <rect key={r} x={x} y={y} width={width} height={height} fill={fill} />;
    });

/** Dibujado a 24 o 48 px, siempre múltiplo exacto de su cuadrícula. `back`: la flecha, hacia la izquierda. */
export function PortIcon({ name, size = 24, back = false, className = '' }) {
  const [ink, accent] = ICONS[name];
  return (
    <svg className={`port-icon ${className}`.trim()} viewBox="0 0 24 24" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" focusable="false" style={back ? { transform: 'scaleX(-1)' } : undefined}>
      {rects(ink, 'currentColor')}
      {rects(accent, 'var(--port-icon-accent, var(--port-accent))')}
    </svg>
  );
}
