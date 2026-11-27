// El vaso de té helado de la ilustración se vacía a medida que avanza la sesión de lectura (SPEC §6).
// Por encima del nivel, el propio vaso pintado sin el color del té (vidrio vacío con el hielo y sus
// reflejos) y alguna gota que resbala; en el nivel, la
// superficie ámbar del té. Durante el descanso el vaso se rellena poco a poco.
import { useSceneArt } from '../../hooks/useSceneArt';
import { SCENE_H, SCENE_W, TEA_LIQUID, pts } from '../../scene/sceneMap';
import { useSvgIds } from '../../hooks/useSvgIds';

export function TeaDrain({ level }) {
  const sid = useSvgIds();
  const { src: sceneSrc } = useSceneArt();
  if (level === null) return null;
  const top = TEA_LIQUID.top;
  const bottom = TEA_LIQUID.bottom;
  const surface = top + (bottom - top) * (1 - Math.max(0, Math.min(1, level)));
  const [l, r] = TEA_LIQUID.edgesAt(surface);
  return (
    <svg className="tea-drain" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} width={SCENE_W} height={SCENE_H} aria-hidden="true">
      <defs>
        <clipPath clipPathUnits="userSpaceOnUse" id={sid('clip-tea')}>
          <polygon points={pts(TEA_LIQUID.shape)} />
        </clipPath>
        <clipPath clipPathUnits="userSpaceOnUse" id={sid('clip-tea-empty')}>
          <rect x={TEA_LIQUID.x} y={top - 10} width={TEA_LIQUID.w} height={Math.max(0, surface - top + 10)} />
        </clipPath>
        {/* Vidrio vacío: el té pierde su color y se aclara, quedan el hielo y los brillos */}
        <filter id={sid('f-empty-glass')} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values="0.08" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="0.55" intercept="0.4" />
            <feFuncG type="linear" slope="0.55" intercept="0.4" />
            <feFuncB type="linear" slope="0.55" intercept="0.42" />
          </feComponentTransfer>
        </filter>
        <linearGradient id={sid('g-tea-surface')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd68a" />
          <stop offset="1" stopColor="#c8781f" />
        </linearGradient>
      </defs>
      <g clipPath={sid.url('clip-tea')}>
        <g clipPath={sid.url('clip-tea-empty')}>
          <image href={sceneSrc} width={SCENE_W} height={SCENE_H} filter={sid.url('f-empty-glass')} opacity="0.92" />
        </g>
        {/* Reflejos verticales del vidrio y gotitas que resbalan */}
        <rect x={TEA_LIQUID.x + 8} y={top} width="4" height={Math.max(0, surface - top)} fill="#fff" opacity="0.35" />
        {[0.3, 0.55, 0.78].map((fx, i) =>
          surface - top > 18 ? (
            <circle key={fx} className="tea-drain__drop" cx={TEA_LIQUID.x + TEA_LIQUID.w * fx} cy={top + 10 + i * 9} r="1.8" fill="#fff" opacity="0.8" style={{ animationDelay: `${i * 1.7}s` }} />
          ) : null,
        )}
      </g>
      {/* Cubitos de hielo que flotan en la superficie y se van haciendo pequeños */}
      {surface < bottom - 14 &&
        [0.22, 0.5, 0.74].map((fx, i) => {
          const sz = 13 * (0.45 + 0.55 * Math.max(0, Math.min(1, level)));
          return (
            <rect
              key={fx}
              className="tea-drain__ice"
              x={l + (r - l) * fx - sz / 2}
              y={surface - sz * 0.35}
              width={sz}
              height={sz * 0.9}
              rx={sz * 0.25}
              transform={`rotate(${(i - 1) * 14} ${l + (r - l) * fx} ${surface})`}
              style={{ animationDelay: `${i * 0.9}s` }}
            />
          );
        })}
      {surface < bottom - 2 && (
        <ellipse className="tea-drain__surface" cx={(l + r) / 2} cy={surface} rx={(r - l) / 2} ry="4.5" fill={sid.url('g-tea-surface')} opacity="0.95" />
      )}
    </svg>
  );
}
