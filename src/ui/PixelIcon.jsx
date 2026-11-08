// Puerto Pixel: los objetos ilustrados del atlas (posiciones de atlas.json, 4 × 3) y los controles de 24 px del paquete.
// El nombre accesible lo pone siempre el botón o su texto: estos dibujos son decorativos.

const POSITIONS = {
  calendario: [0, 0],
  diario: [1, 0],
  estadisticas: [2, 0],
  biblioteca: [3, 0],
  sesiones: [0, 1],
  comunidad: [1, 1],
  ordenador: [2, 1],
  edificio: [3, 1],
  sonido: [0, 2],
  decorar: [1, 2],
  ajustes: [2, 2],
  lectura: [3, 2],
};

export function PixelIcon({ name, size = 96 }) {
  const [col, row] = POSITIONS[name];
  return <span className="pp-icon" aria-hidden="true" style={{ '--col': col, '--row': row, '--icon-size': `${size}px` }} />;
}

export function PixelControl({ name }) {
  return <span className="pp-control" aria-hidden="true" style={{ '--control': `url('/assets/puerto/control-${name}.svg')` }} />;
}

// Cambiar de mes: un ángulo, para que no se confunda con la flecha de volver
export function PixelChevron({ next = false }) {
  const d = next ? 'M8 2h3v2h2v2h2v2h2v2h2v4h-2v2h-2v2h-2v2h-2v2H8v-3h2v-2h2v-2h2v-2h2v-2h-2v-2h-2V9h-2V7H8z' : 'M16 2h-3v2h-2v2H9v2H7v2H5v4h2v2h2v2h2v2h2v2h3v-3h-2v-2h-2v-2H9v-2H7v-2h2v-2h2V9h2V7h3z';
  return (
    <svg className="pp-chevron" viewBox="0 0 24 24" width="24" height="24" shapeRendering="crispEdges" fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
