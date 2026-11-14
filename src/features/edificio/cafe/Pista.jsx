// La pista de cada gesto del café (la barra, el tostador y, desde la 1.130, la librería): una flecha de píxel sobre el objeto,
// con el dedo que la recorre (quieta con movimiento reducido). Antes vivía en Atender.jsx; Atender la sigue exportando.
import { GESTOS } from './cafeGestos';

const TRAZOS = {
  giro: 'M 44 12 A 32 32 0 1 1 12 44',
  abajo: 'M 44 8 L 44 70',
  'abajo-mantener': 'M 44 8 L 44 62',
  // Bloque 6b: tirar del asa del tambor hacia ti (el asa arriba y el tirón hacia abajo)
  tirar: 'M 28 12 L 60 12 M 44 12 L 44 64',
  derecha: 'M 6 44 Q 44 10 82 44',
  'arriba-mantener': 'M 44 76 L 44 18',
  'vaiven-vertical': 'M 44 14 L 44 74',
  'lado-mantener': 'M 14 44 L 74 44',
  'izquierda-mantener': 'M 76 44 L 18 44',
  remover: 'M 44 10 A 34 26 0 1 1 10 44 A 34 26 0 0 1 44 10',
  batir: 'M 44 30 a 12 12 0 1 1 -1 0 m 1 10 a 12 12 0 1 1 -1 0 m 1 10 a 12 12 0 1 1 -1 0',
  rascar: 'M 30 10 L 30 70 M 44 10 L 44 70 M 58 10 L 58 70',
  coctelera: 'M 4 56 Q 44 16 84 56 M 84 56 L 74 50 M 4 56 L 14 50',
  // Bloque 6c: cuatro golpes secos en el mortero, y el zigzag del soplete sin soltar
  golpes: 'M 44 10 L 44 50 M 30 62 L 58 62 M 34 70 L 54 70',
  zigzag: 'M 8 30 L 30 58 L 52 30 L 74 58 L 84 44',
  trazo: 'M 44 6 Q 30 24 44 40 Q 58 56 44 78',
  vaiven: 'M 8 44 L 80 44',
  dibujo: 'M 44 44 m -6 0 a 6 6 0 1 1 12 0 a 12 12 0 1 1 -24 0 a 18 18 0 1 1 36 0',
  // 1.130, la librería: pasar la tapa a la izquierda, un toque (la bolsa), apretar y mantener (el sello) y doblar a la derecha
  izquierda: 'M 78 44 L 12 44 M 12 44 L 22 36 M 12 44 L 22 52',
  toque: 'M 44 30 L 44 34 M 58 44 L 54 44 M 44 58 L 44 54 M 30 44 L 34 44',
  mantener: 'M 44 26 L 44 46 M 36 54 L 52 54',
  'derecha-recta': 'M 10 44 L 76 44 M 76 44 L 66 36 M 76 44 L 66 52',
  // 1.130, cada paso del libro con su trazo: tirar del lomo (con el canto arriba), desenrollar el papel (y su rasgado), las dos
  // solapas, la vuelta y media del cordel, el marcapáginas (con su cola) y meterlo en la bolsa
  'tirar-lomo': 'M 36 18 L 44 10 L 52 18 M 44 16 L 44 66 M 36 58 L 44 66 L 52 58',
  desenrollar: 'M 44 6 L 44 72 M 32 80 L 38 74 L 44 80 L 50 74 L 56 80',
  solapas: 'M 10 54 Q 26 22 42 40 M 78 54 Q 62 22 46 40',
  lazo: 'M 14 44 A 30 20 0 1 1 74 44 A 30 20 0 1 1 14 44 A 30 20 0 0 1 74 44',
  marcapaginas: 'M 44 8 L 44 64 M 44 64 L 37 76 M 44 64 L 51 76',
  meter: 'M 44 6 L 44 50 M 22 38 L 22 76 L 66 76 L 66 38',
  // 1.130: empujar la caja de libros hacia arriba (colocarlos todos)
  arriba: 'M 44 76 L 44 14 M 44 14 L 34 26 M 44 14 L 54 26',
};

/** La pista del gesto `tipo` (o la de `trazo`, una de `TRAZOS`), dibujada sobre el objeto. */
export function Pista({ tipo, trazo: forzada = null }) {
  const p = forzada ?? GESTOS[tipo]?.pista;
  const trazo = TRAZOS[p];
  if (!trazo) return null;
  return (
    <svg className="cf3-pista" data-pista={p} viewBox="0 0 88 88" aria-hidden="true" shapeRendering="crispEdges">
      <path d={trazo} className="cf3-pista__trazo" />
      <circle className="cf3-pista__dedo" r="7" />
      {p.endsWith('mantener') && <circle className="cf3-pista__mantener" r="13" />}
    </svg>
  );
}
