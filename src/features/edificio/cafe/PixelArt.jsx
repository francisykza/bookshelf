// Dibuja un icono de píxel del café (`cafeIconos.js`) como SVG con bordes duros (1.120.1).

/** Un dibujo de píxel: filas de letras y su paleta. Los tramos seguidos del mismo color van en un solo rectángulo. */
export function PixelArt({ icono, className = '', titulo = null }) {
  const { filas, paleta } = icono;
  const w = Math.max(...filas.map((f) => f.length));
  const rects = [];
  filas.forEach((fila, y) => {
    let x = 0;
    while (x < fila.length) {
      const ch = fila[x];
      let n = 1;
      while (fila[x + n] === ch) n += 1;
      if (ch !== '.' && paleta[ch]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={n} height={1} fill={paleta[ch]} />);
      x += n;
    }
  });
  return (
    <svg
      className={`cf3-px ${className}`}
      viewBox={`0 0 ${w} ${filas.length}`}
      shapeRendering="crispEdges"
      aria-hidden={titulo ? undefined : 'true'}
      role={titulo ? 'img' : undefined}
      aria-label={titulo ?? undefined}
    >
      {rects}
    </svg>
  );
}
