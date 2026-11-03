// Las piezas de la mesa de «Las 21 páginas» (1.80), compartidas por el casino a solas (Casino.jsx) y la mesa para dos
// (MesaParaDos.jsx): las cifras de píxel, las cartas-página con sus palos en píxeles, la placa del total y el contador
// de fichas (useCountUp.js).
import { carta } from './veintiuna';

// Cifras de píxel (3 × 5) para el marcador y los totales
const DIGITS = {
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['###', '..#', '###', '#..', '###'],
  3: ['###', '..#', '.##', '..#', '###'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '###', '..#', '###'],
  6: ['###', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '###'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '?': ['###', '..#', '.##', '...', '.#.'],
};

/** Un número en cifras de píxel (para los lectores de pantalla, `label`). */
export function PixelNum({ value, className = '', label }) {
  const chars = [...String(value)].filter((ch) => DIGITS[ch]);
  const w = chars.length * 4 - 1;
  return (
    <svg className={`gh-px-num ${className}`} viewBox={`0 0 ${w} 5`} role="img" aria-label={label ?? String(value)} shapeRendering="crispEdges" style={{ aspectRatio: `${w} / 5` }}>
      {chars.flatMap((ch, i) => DIGITS[ch].flatMap((row, y) => [...row].map((b, x) => (b === '#' ? <rect key={`${i}-${x}-${y}`} x={i * 4 + x} y={y} width="1" height="1" /> : null))))}
    </svg>
  );
}

// Los palos en píxeles (7 × 6), para que la carta sea del mismo dibujo que el resto
const PIPS = {
  picas: ['...#...', '..###..', '.#####.', '#######', '#######', '..#.#..'],
  corazones: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  tréboles: ['..###..', '..###..', '##.#.##', '#######', '##.#.##', '...#...'],
  diamantes: ['...#...', '..###..', '.#####.', '.#####.', '..###..', '...#...'],
};

function Pip({ palo, className = 'gh-card21__pip' }) {
  return (
    <svg className={className} viewBox="0 0 7 6" aria-hidden="true" shapeRendering="crispEdges">
      {PIPS[palo].flatMap((row, y) => [...row].map((b, x) => (b === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null)))}
    </svg>
  );
}

/** Una carta-página (o boca abajo, `tapada`). `k`: su orden en la mano, para el retraso del reparto; `mini`, más pequeña. */
export function Carta({ c, tapada = false, nueva = false, k = 0, mini = false }) {
  const style = nueva ? { animationDelay: `${k * 90}ms` } : undefined;
  const cls = `gh-card21${mini ? ' is-mini' : ''}${nueva ? ' is-new' : ''}`;
  if (tapada) return <li className={`${cls} is-back`} style={style} aria-label="Carta tapada" />;
  const info = carta(c);
  return (
    <li className={`${cls}${info.rojo ? ' is-red' : ''}`} style={style} aria-label={info.nombre}>
      <span className="gh-card21__sign" aria-hidden="true">
        {info.signo}
        <Pip palo={info.palo} className="gh-card21__mini" />
      </span>
      <Pip palo={info.palo} />
      <span className="gh-card21__sign is-foot" aria-hidden="true">
        {info.signo}
      </span>
    </li>
  );
}

/** Dos huecos vacíos donde caerán las cartas. */
export function Huecos() {
  return (
    <ul className="gh-21__cards is-empty" aria-hidden="true">
      <li className="gh-card21 is-slot" />
      <li className="gh-card21 is-slot" />
    </ul>
  );
}

/** El total de una mano, en una placa (en rojo si se pasa de 21). */
export function Total({ value, who }) {
  const over = value != null && value > 21;
  return (
    <p className={`gh-21-total${over ? ' is-over' : ''}${value === 21 ? ' is-21' : ''}`}>
      <span>{who}</span>
      <PixelNum value={value ?? '?'} label={value == null ? 'sin ver' : String(value)} />
    </p>
  );
}
