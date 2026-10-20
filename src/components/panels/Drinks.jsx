// Bebidas de la carta de cafetería (SPEC §6, 1.12.0): ilustraciones detalladas que reaccionan a la sesión.
// El nivel baja a medida que avanza la lectura; en el vaso los hielos translúcidos se derriten y resbalan
// gotas de condensación por el cristal; las bebidas calientes desprenden vapor difuminado de verdad.
import { useId } from 'react';

export const DRINKS = {
  icedTea: {
    name: 'Té helado con cerezas',
    note: 'Té negro frío, limón y cerezas del huerto',
    liquid: '#c8781f',
    light: '#f0b25a',
    hot: false,
  },
  coffee: {
    name: 'Café con leche humeante',
    note: 'Espresso del puerto con leche cremosa',
    liquid: '#9a6338',
    light: '#d3a072',
    hot: true,
  },
  matcha: { name: 'Matcha', note: 'Batido a mano, con su espuma de jade', liquid: '#7da84a', light: '#b6d47e', hot: true },
  chocolate: {
    name: 'Chocolate caliente',
    note: 'Espeso, con nubes de azúcar tostadas',
    liquid: '#5a2f1c',
    light: '#8a5232',
    hot: true,
  },
};

const INK = '#3b2a1e';

/** Vapor real: volutas difuminadas que suben y se deshacen. */
function Steam({ id, x, y, strong }) {
  return (
    <g className="drink__steam" filter={`url(#${id}-blur)`} opacity={strong ? 0.85 : 0.6} aria-hidden="true">
      {[-12, 0, 12].map((dx, i) => (
        <path
          key={dx}
          d={`M${x + dx} ${y} c-7 -9 7 -15 0 -24 c-7 -9 7 -15 0 -24`}
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          style={{ animationDelay: `${i * 0.9}s` }}
        />
      ))}
    </g>
  );
}

/** Vaso de cristal: refracción, hielo que mengua, condensación, limón y cerezas. */
function Glass({ id, d, level, liquidTop }) {
  const ice = 0.42 + 0.58 * level;
  return (
    <>
      <defs>
        <clipPath id={`${id}-in`}>
          <path d="M34 22 L86 22 L79 106 Q60 112 41 106 Z" />
        </clipPath>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.18" stopColor="#e8f4ff" stopOpacity="0.12" />
          <stop offset="0.8" stopColor="#e8f4ff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={`${id}-tea`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={d.light} />
          <stop offset="1" stopColor={d.liquid} />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="110" rx="34" ry="5" fill="rgb(200 120 31 / 0.18)" />
      <g clipPath={`url(#${id}-in)`}>
        <rect x="0" y="0" width="120" height="120" fill="rgb(232 244 255 / 0.25)" />
        <rect className="drink__liquid" x="0" y={liquidTop} width="120" height={120 - liquidTop} fill={`url(#${id}-tea)`} />
        <ellipse cx="60" cy={liquidTop} rx="26" ry="3" fill={d.light} opacity="0.9" />
        {/* Hielos translúcidos que flotan y se van derritiendo */}
        {[
          [44, 0, -8],
          [62, 6, 10],
          [52, 18, 4],
        ].map(([x, dy, r]) => {
          const s = 15 * ice;
          return (
            <g key={x} className="drink__ice" transform={`rotate(${r} ${x + s / 2} ${liquidTop + dy})`}>
              <rect x={x} y={Math.max(24, liquidTop - 6 + dy)} width={s} height={s} rx={3 * ice} fill="rgb(255 255 255 / 0.32)" stroke="rgb(255 255 255 / 0.85)" strokeWidth="0.9" />
              <path d={`M${x + 2} ${Math.max(24, liquidTop - 6 + dy) + 3} l${s * 0.4} 0`} stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
            </g>
          );
        })}
        {/* Rodaja de limón */}
        <g transform={`translate(72 ${Math.max(30, liquidTop + 10)}) rotate(-20)`} opacity="0.9">
          <circle r="10" fill="#f6e27a" stroke="#d9b23a" strokeWidth="1.4" />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <path key={a} d="M0 0 L0 -8" stroke="#fff6c8" strokeWidth="1.2" transform={`rotate(${a})`} />
          ))}
        </g>
      </g>
      <path d="M34 22 L86 22 L79 106 Q60 112 41 106 Z" fill={`url(#${id}-glass)`} stroke="rgb(59 42 30 / 0.55)" strokeWidth="1.6" />
      <ellipse cx="60" cy="22" rx="26" ry="3.4" fill="none" stroke="rgb(59 42 30 / 0.5)" strokeWidth="1.2" />
      <path d="M39 30 L44 100" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      {/* Condensación: gotas en el cristal, algunas resbalan */}
      {[
        [48, 50],
        [70, 44],
        [76, 70],
        [56, 84],
        [44, 72],
        [66, 92],
      ].map(([x, y], i) => (
        <g key={x + y} className={i % 2 ? 'drink__drop drink__drop--slide' : 'drink__drop'} style={{ animationDelay: `${i * 1.3}s` }}>
          <ellipse cx={x} cy={y} rx="1.5" ry="2" fill="rgb(255 255 255 / 0.55)" stroke="rgb(120 160 190 / 0.35)" strokeWidth="0.4" />
          <circle cx={x - 0.4} cy={y - 0.7} r="0.5" fill="#fff" />
        </g>
      ))}
      {/* Pajita y cerezas */}
      <path d="M72 2 L64 76" stroke="#f3e2d0" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M72 2 L64 76" stroke="#c4623a" strokeWidth="4.5" strokeDasharray="4 4" strokeLinecap="round" opacity="0.7" />
      <path d="M86 24 Q92 6 102 9" stroke="#4f7a3a" strokeWidth="1.5" fill="none" />
      <path d="M90 26 Q98 12 104 12" stroke="#4f7a3a" strokeWidth="1.3" fill="none" />
      <circle cx="87" cy="27" r="6.4" fill="#b3172e" stroke="#6e0a1a" strokeWidth="1" />
      <circle cx="94" cy="29" r="5.6" fill="#c2203a" stroke="#6e0a1a" strokeWidth="1" />
      <circle cx="85" cy="25" r="1.7" fill="#ffd3d9" />
      <circle cx="92.5" cy="27.5" r="1.3" fill="#ffd3d9" />
    </>
  );
}

/** Tazas de cerámica esmaltada con plato: café con arte latte, matcha con espuma y chocolate con nubes. */
function Cup({ id, kind, d, level, liquidTop }) {
  const ceramic = { coffee: ['#d9774a', '#a8502c'], matcha: ['#e9dcc0', '#bfae88'], chocolate: ['#f1e6d4', '#c9b496'] }[kind];
  const show = level > 0.03;
  // Superficie del líquido vista desde arriba (se estrecha al bajar dentro de la taza)
  const surfW = 30 - (liquidTop - 44) * 0.08;
  return (
    <>
      <defs>
        <linearGradient id={`${id}-cer`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={ceramic[1]} />
          <stop offset="0.35" stopColor={ceramic[0]} />
          <stop offset="0.7" stopColor={ceramic[0]} />
          <stop offset="1" stopColor={ceramic[1]} />
        </linearGradient>
        <radialGradient id={`${id}-liq`} cx="0.45" cy="0.4">
          <stop offset="0" stopColor={d.light} />
          <stop offset="1" stopColor={d.liquid} />
        </radialGradient>
        <clipPath id={`${id}-mouth`}>
          <ellipse cx="60" cy="44" rx="34" ry="8" />
        </clipPath>
      </defs>
      {/* Plato */}
      <ellipse cx="60" cy="104" rx="50" ry="9" fill="#efe4d0" stroke="rgb(59 42 30 / 0.4)" strokeWidth="1.2" />
      <ellipse cx="60" cy="103" rx="30" ry="4.5" fill="#e2d3b8" />
      {/* Asa */}
      <path d="M92 54 C110 54 110 82 90 84" fill="none" stroke={ceramic[1]} strokeWidth="7" strokeLinecap="round" />
      <path d="M92 54 C106 55 106 80 90 82" fill="none" stroke={ceramic[0]} strokeWidth="3.5" strokeLinecap="round" />
      {/* Cuerpo */}
      <path d="M26 44 L94 44 Q92 86 74 98 Q60 104 46 98 Q28 86 26 44 Z" fill={`url(#${id}-cer)`} stroke="rgb(59 42 30 / 0.5)" strokeWidth="1.4" />
      <path d="M34 52 Q36 80 48 92" stroke="#fff" strokeWidth="3" fill="none" opacity="0.35" strokeLinecap="round" />
      {/* Boca de la taza con el líquido */}
      <ellipse cx="60" cy="44" rx="34" ry="8" fill="#5a3a24" />
      <g clipPath={`url(#${id}-mouth)`}>
        {show && <ellipse className="drink__surface" cx="60" cy={44 + (liquidTop - 44) * 0.12} rx={surfW} ry="6.4" fill={`url(#${id}-liq)`} />}
        {show && kind === 'coffee' && (
          <path
            d={`M60 ${48 + (liquidTop - 44) * 0.12} c-9 -4 -9 -10 -3 -10 c2 0 3 2 3 3 c0 -1 1 -3 3 -3 c6 0 6 6 -3 10 Z`}
            fill="#f3e2c6"
            opacity="0.95"
          />
        )}
        {show && kind === 'matcha' &&
          [
            [50, 43],
            [64, 41],
            [70, 46],
            [56, 47],
            [46, 46],
          ].map(([x, y]) => <circle key={x + y} cx={x} cy={y + (liquidTop - 44) * 0.12} r="1.4" fill="#d9ecb0" opacity="0.9" />)}
        {show && kind === 'chocolate' && (
          <g>
            <rect x="46" y={38 + (liquidTop - 44) * 0.12} width="11" height="8" rx="3" fill="#fff6f0" stroke={INK} strokeWidth="0.8" transform="rotate(-10 51 42)" />
            <rect x="60" y={39 + (liquidTop - 44) * 0.12} width="10" height="8" rx="3" fill="#ffe3ea" stroke={INK} strokeWidth="0.8" transform="rotate(12 65 43)" />
            {[52, 58, 66, 72].map((x) => (
              <circle key={x} cx={x} cy={46 + (liquidTop - 44) * 0.12} r="0.6" fill="#3a1a0c" />
            ))}
          </g>
        )}
      </g>
      <ellipse cx="60" cy="44" rx="34" ry="8" fill="none" stroke="rgb(59 42 30 / 0.55)" strokeWidth="1.4" />
      {d.hot && show && <Steam id={id} x={60} y={38} strong={level > 0.5} />}
    </>
  );
}

export function Drink({ kind, level = 1, size = 120 }) {
  const id = useId().replace(/:/g, '');
  const d = DRINKS[kind] ?? DRINKS.icedTea;
  const glass = kind === 'icedTea';
  const clamped = Math.max(0, Math.min(1, level));
  const top = glass ? 24 : 46;
  const bottom = glass ? 106 : 96;
  const liquidTop = bottom - (bottom - top) * clamped;
  return (
    <svg className={`drink drink--${kind}`} viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" overflow="visible">
      <defs>
        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      {glass ? <Glass id={id} d={d} level={clamped} liquidTop={liquidTop} /> : <Cup id={id} kind={kind} d={d} level={clamped} liquidTop={liquidTop} />}
    </svg>
  );
}
