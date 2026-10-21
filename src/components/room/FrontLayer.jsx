// Capa de primer plano (SPEC §3.4, 1.8.0): la cama con todo lo que hay encima (libro, portátil, auriculares,
// bandeja, monstera y Miel dormida) recortada de la ilustración con un borde difuminado. En el parallax es
// la capa que más se mueve; aquí viven también la respiración de Miel, la esquina de la página y el reflejo
// de la tapa del portátil para que se muevan con ella.
import { FRONT, LAPTOP_LID, PAGE_CORNER, PAINTED_CAT, PLANTS, SCENE_H, SCENE_SRC, SCENE_W, pts } from '../../scene/sceneMap';
import { useSvgIds } from '../../hooks/useSvgIds';
import { LITE_SCENE } from '../../scene/renderMode';
import { Crop, Feather, LEAF_KEY, SwayFilter } from './SceneLayers';

const SPLINE = '0.45 0 0.55 1;0.45 0 0.55 1';

export function FrontLayer() {
  const sid = useSvgIds();
  const corner = PAGE_CORNER;
  return (
    <svg className="front-svg" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} width={SCENE_W} height={SCENE_H} aria-hidden="true">
      <defs>
        <filter id={sid('f-front-feather')} x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <mask id={sid('m-front')} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width={SCENE_W} height={SCENE_H}>
          <polygon points={pts(FRONT)} fill="#fff" filter={sid.url('f-front-feather')} />
        </mask>
        <clipPath clipPathUnits="userSpaceOnUse" id={sid('clip-cat')}>
          <rect x={PAINTED_CAT.x} y={PAINTED_CAT.y} width={PAINTED_CAT.w} height={PAINTED_CAT.h} />
        </clipPath>
        <Feather id={sid('m-cat')} x={PAINTED_CAT.x - 30} y={PAINTED_CAT.y} w={PAINTED_CAT.w + 30} h={PAINTED_CAT.h} soft={0.16} />
        <SwayFilter id={sid('f-monstera')} region={PLANTS.monstera} keyMatrix={LEAF_KEY} freq="0.012 0.02" amp={6} dur="6.8s" seed="31" />
        <clipPath clipPathUnits="userSpaceOnUse" id={sid('clip-lid')}>
          <polygon points={pts(LAPTOP_LID)} />
        </clipPath>
        {/* Horizontal y transparente en los dos tercios exteriores: los lados de la banda no se ven (SPEC §14.3) */}
        <linearGradient id={sid('g-lid-sheen')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFF7E6" stopOpacity="0" />
          <stop offset="0.35" stopColor="#FFF7E6" stopOpacity="0" />
          <stop offset="0.5" stopColor="#FFF1D2" stopOpacity="0.1" />
          <stop offset="0.65" stopColor="#FFF7E6" stopOpacity="0" />
          <stop offset="1" stopColor="#FFF7E6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={sid('g-page-flap')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbf3e1" />
          <stop offset="1" stopColor="#d9c9a8" />
        </linearGradient>
      </defs>

      {/* La cama recortada solo hace falta para el parallax; en móvil ya está en la imagen base */}
      {!LITE_SCENE && (
        <g mask={sid.url('m-front')}>
          <image href={SCENE_SRC} width={SCENE_W} height={SCENE_H} />
          <Crop filter={sid('f-monstera')} />
        </g>
      )}

      {/* Reflejo de luz que recorre la tapa: el grupo exterior recorta (estático) y solo se mueve el interior.
          La banda inclinada empieza fuera de la tapa, a la izquierda, y termina fuera a la derecha. */}
      <g clipPath={sid.url('clip-lid')} className="lid-sheen-clip">
        <g className="lid-sheen">
          <polygon points="330,1030 450,1030 390,1320 270,1320" fill={sid.url('g-lid-sheen')} stroke="none" />
        </g>
      </g>

      {/* Miel pintada: parte tranquila de la ilustración, solo respira despacio desde la panza */}
      <g className="miel-painted">
        <g className="miel-painted__breath" style={{ transformOrigin: `200px ${PAINTED_CAT.y + PAINTED_CAT.h - 12}px` }}>
          <Crop clip={sid('clip-cat')} mask={sid('m-cat')} />
        </g>
      </g>

      {/* Esquina de la página derecha que levanta la brisa */}
      <g className="page-corner" aria-hidden="true">
        <polygon points={`${corner.x - 14},${corner.y - 17} ${corner.x - 30},${corner.y + 6} ${corner.x},${corner.y}`} fill="#7a5a3a" opacity="0.22">
          <animate attributeName="opacity" values="0.08;0.28;0.08" dur="5.2s" repeatCount="indefinite" calcMode="spline" keySplines={SPLINE} />
        </polygon>
        <polygon fill={sid.url('g-page-flap')} stroke="#bda57d" strokeWidth="0.6">
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
