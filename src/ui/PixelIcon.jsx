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
