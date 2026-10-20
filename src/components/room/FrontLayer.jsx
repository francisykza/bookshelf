// Capa de primer plano (SPEC §3.4, 1.8.0): la cama con todo lo que hay encima (libro, portátil, auriculares,
// bandeja, monstera y Miel dormida) recortada de la ilustración con un borde difuminado. En el parallax es
// la capa que más se mueve; aquí viven también la respiración de Miel, la esquina de la página y el reflejo
// de la tapa del portátil para que se muevan con ella.
import { FRONT, LAPTOP_LID, PAGE_CORNER, PAINTED_CAT, PLANTS, SCENE_H, SCENE_SRC, SCENE_W, pts } from '../../scene/sceneMap';
import { Crop, Feather, LEAF_KEY, SwayFilter } from './SceneLayers';

const SPLINE = '0.45 0 0.55 1;0.45 0 0.55 1';

export function FrontLayer() {
  const corner = PAGE_CORNER;
  return (
    <svg className="front-svg" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} width={SCENE_W} height={SCENE_H} aria-hidden="true">
      <defs>
        <filter id="f-front-feather" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <mask id="m-front" maskUnits="userSpaceOnUse" x="0" y="0" width={SCENE_W} height={SCENE_H}>
          <polygon points={pts(FRONT)} fill="#fff" filter="url(#f-front-feather)" />
        </mask>
        <clipPath id="clip-cat">
          <rect x={PAINTED_CAT.x} y={PAINTED_CAT.y} width={PAINTED_CAT.w} height={PAINTED_CAT.h} />
        </clipPath>
        <Feather id="m-cat" x={PAINTED_CAT.x - 30} y={PAINTED_CAT.y} w={PAINTED_CAT.w + 30} h={PAINTED_CAT.h} soft={0.16} />
        <SwayFilter id="f-monstera" region={PLANTS.monstera} keyMatrix={LEAF_KEY} freq="0.012 0.02" amp={6} dur="6.8s" seed="31" />
        <clipPath id="clip-lid">
          <polygon points={pts(LAPTOP_LID)} />
        </clipPath>
        <linearGradient id="g-lid-sheen" x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.38" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="g-page-flap" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbf3e1" />
          <stop offset="1" stopColor="#d9c9a8" />
        </linearGradient>
      </defs>

      <g mask="url(#m-front)">
        <image href={SCENE_SRC} width={SCENE_W} height={SCENE_H} />
        <Crop filter="f-monstera" />
      </g>

      {/* Reflejo de luz que recorre la tapa del portátil */}
      <g clipPath="url(#clip-lid)">
        <rect className="lid-sheen" x="300" y="1030" width="120" height="290" fill="url(#g-lid-sheen)" />
      </g>

      {/* Miel pintada: parte tranquila de la ilustración, solo respira despacio desde la panza */}
      <g className="miel-painted">
        <g className="miel-painted__breath" style={{ transformOrigin: `200px ${PAINTED_CAT.y + PAINTED_CAT.h - 12}px` }}>
          <Crop clip="clip-cat" mask="m-cat" />
        </g>
      </g>

      {/* Esquina de la página derecha que levanta la brisa */}
      <g className="page-corner" aria-hidden="true">
        <polygon points={`${corner.x - 14},${corner.y - 17} ${corner.x - 30},${corner.y + 6} ${corner.x},${corner.y}`} fill="#7a5a3a" opacity="0.22">
          <animate attributeName="opacity" values="0.08;0.28;0.08" dur="5.2s" repeatCount="indefinite" calcMode="spline" keySplines={SPLINE} />
        </polygon>
        <polygon fill="url(#g-page-flap)" stroke="#bda57d" strokeWidth="0.6">
          <animate
            attributeName="points"
            dur="11s"
            repeatCount="indefinite"
            calcMode="spline"
            keyTimes="0;0.22;0.45;0.62;0.78;1"
            keySplines={`${SPLINE};${SPLINE};0.45 0 0.55 1`}
            values={[[3, 2], [15, 9], [3, 2], [24, 16], [6, 4], [3, 2]]
              .map(([dx, dy]) => `${corner.x - 14},${corner.y - 17} ${corner.x - 30},${corner.y + 6} ${corner.x - dx},${corner.y - dy}`)
              .join(';')}
          />
        </polygon>
      </g>
    </svg>
  );
}
