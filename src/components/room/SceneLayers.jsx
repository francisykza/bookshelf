// Escenario pintado vivo (SPEC §2.2, §2.3): la ilustración base y recortes de sí misma animados con
// filtros SVG (mar, hiedra, flores, carillón, gato) más las capas de atardecer y noche que solo tiñen
// cielo y mar gracias a una "llave de azules". Todo en coordenadas de la imagen (984 × 1599).
import { forwardRef } from 'react';
import {
  CHIME,
  CLOUD_REGION,
  CURTAIN_REGION,
  EXTERIOR,
  FLOWER_REGION,
  IVY_REGION,
  LAMP_SWING,
  MOON,
  PLANTS,
  RIGHT_VINES,
  SCENE_H,
  SCENE_SRC,
  SCENE_W,
  SEA,
  SKY,
  STEAM,
  pts,
} from '../../scene/sceneMap';

const SPLINE = '0.45 0 0.55 1;0.45 0 0.55 1';

/** Matriz que convierte el verde de las hojas en alfa (hiedra, plantas). */
export const LEAF_ALPHA = '-6 9 -3 0 -0.2';
export const LEAF_KEY = `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${LEAF_ALPHA}`;
/** Brisa de la hiedra: la capa de oclusión frontal usa los mismos valores para ir sincronizada. */
export const IVY_SWAY = { freq: '0.022 0.04', amp: 7, dur: '5s' };
/** Brisa de la planta de la izquierda (también la usa la oclusión de la balda baja). */
export const PLANT_SWAY = { freq: '0.03 0.05', amp: 5, dur: '4.6s' };

/** Matriz que deja pasar todo lo que no es madera (hojas, flores, cielo). */
const NOT_WOOD_KEY = '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -8 7 1 0 1';

/**
 * Filtro de brisa: un campo de ruido fijo, enmascarado por la llave, desplaza los píxeles con una
 * escala que oscila adelante y atrás. Las zonas fuera de la llave reciben gris neutro (sin movimiento).
 */
export function SwayFilter({ id, region, keyMatrix, freq, amp, dur, seed, outAlpha }) {
  return (
    <filter
      id={id}
      filterUnits="userSpaceOnUse"
      x={region.x}
      y={region.y}
      width={region.w}
      height={region.h}
      colorInterpolationFilters="sRGB"
    >
      <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves="2" seed={seed} result="noise" />
      <feColorMatrix in="noise" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1" result="noiseOpaque" />
      <feColorMatrix in="SourceGraphic" type="matrix" values={keyMatrix} result="mask" />
      <feComposite in="noiseOpaque" in2="mask" operator="in" result="maskedNoise" />
      <feFlood floodColor="rgb(128,128,128)" result="neutral" />
      <feComposite in="maskedNoise" in2="neutral" operator="over" result="map" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="moved">
        <animate
          attributeName="scale"
          values={`${-amp};${amp};${-amp}`}
          dur={dur}
          repeatCount="indefinite"
          calcMode="spline"
          keySplines={SPLINE}
        />
      </feDisplacementMap>
      {outAlpha && (
        <>
          <feColorMatrix in="moved" type="matrix" values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  ${outAlpha}`} result="keyed" />
          <feComponentTransfer in="keyed">
            <feFuncA type="linear" slope="1.6" intercept="-0.1" />
          </feComponentTransfer>
        </>
      )}
    </filter>
  );
}

/** Máscara de bordes difuminados para que los recortes se fundan con la imagen de debajo. */
export function Feather({ id, x, y, w, h, soft = 0.22 }) {
  return (
    <mask id={id} maskUnits="userSpaceOnUse" x={x} y={y} width={w} height={h}>
      <rect x={x} y={y} width={w} height={h} fill={`url(#${id}-g)`} />
      <radialGradient id={`${id}-g`} cx="50%" cy="50%" r="50%">
        <stop offset={1 - soft * 2} stopColor="#fff" />
        <stop offset="1" stopColor="#000" />
      </radialGradient>
    </mask>
  );
}

export function Crop({ clip, mask, filter }) {
  return (
    <g filter={filter ? `url(#${filter})` : undefined}>
      <g clipPath={clip ? `url(#${clip})` : undefined} mask={mask ? `url(#${mask})` : undefined}>
        <image href={SCENE_SRC} width={SCENE_W} height={SCENE_H} preserveAspectRatio="none" />
      </g>
    </g>
  );
}

const STARS = Array.from({ length: 46 }, (_, i) => {
  const r = Math.sin(i * 91.7) * 43758.5453;
  const f = r - Math.floor(r);
  const r2 = Math.sin(i * 17.3 + 4) * 12543.1;
  const f2 = r2 - Math.floor(r2);
  return {
    x: SKY.x - 160 + f * (SKY.w + 200),
    y: 40 + f2 * (SKY.y + SKY.h - 60),
    r: 0.6 + ((i * 7) % 5) * 0.28,
    d: 2 + (i % 7) * 0.6,
    delay: -(i % 11) * 0.7,
  };
});

const WING_UP = 'M-7 0 Q-4 -4.5 0 0 Q4 -4.5 7 0 Q4 -2.6 0 1 Q-4 -2.6 -7 0 Z';
const WING_DOWN = 'M-7 2.5 Q-4 -1 0 0 Q4 -1 7 2.5 Q4 0.6 0 1 Q-4 0.6 -7 2.5 Z';
const GULLS = [
  { from: [470, 452], to: [1000, 410], dur: 34, delay: -6, size: 1.1, flap: 0.9 },
  { from: [1000, 380], to: [470, 430], dur: 41, delay: -20, size: 0.8, flap: 0.75 },
  { from: [470, 500], to: [1000, 470], dur: 47, delay: -33, size: 0.65, flap: 0.68 },
];

export const SceneLayers = forwardRef(function SceneLayers({ timeOfDay, chimeRing }, ref) {
  return (
    <svg
      ref={ref}
      className="scene-svg"
      viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
      width={SCENE_W}
      height={SCENE_H}
      aria-hidden="true"
    >
      <defs>
        <clipPath id="clip-sea">
          <polygon points={pts(SEA)} />
        </clipPath>
        <clipPath id="clip-exterior">
          <polygon points={pts(EXTERIOR)} />
        </clipPath>
        <clipPath id="clip-chime">
          <rect x={CHIME.x} y={CHIME.y} width={CHIME.w} height={CHIME.h} />
        </clipPath>
        <clipPath id="clip-sky-top">
          <rect x="300" y="0" width="684" height="606" />
        </clipPath>
        <clipPath id="clip-sea-band">
          <rect x="300" y="606" width="684" height="214" />
        </clipPath>
        <Feather id="m-chime" x={CHIME.x} y={CHIME.y} w={CHIME.w} h={CHIME.h} soft={0.2} />

        {/* Olas lentas: la frecuencia del ruido deriva y las ondas parecen avanzar */}
        <filter id="f-sea" filterUnits="userSpaceOnUse" x="480" y="590" width="440" height="190">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.11" numOctaves="2" seed="7" result="waves">
            <animate
              attributeName="baseFrequency"
              values="0.008 0.11;0.0104 0.135;0.008 0.11"
              dur="9s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines={SPLINE}
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="waves" scale="11" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        <SwayFilter id="f-ivy" region={IVY_REGION} keyMatrix={LEAF_KEY} freq={IVY_SWAY.freq} amp={IVY_SWAY.amp} dur={IVY_SWAY.dur} seed="3" />
        <SwayFilter id="f-curtain" region={CURTAIN_REGION} keyMatrix={NOT_WOOD_KEY} freq="0.012 0.022" amp={7} dur="6.2s" seed="9" />
        <SwayFilter id="f-flowers" region={FLOWER_REGION} keyMatrix={NOT_WOOD_KEY} freq="0.018 0.03" amp={6.5} dur="5.8s" seed="11" />
        <SwayFilter id="f-vines" region={RIGHT_VINES} keyMatrix={LEAF_KEY} freq="0.02 0.035" amp={6.5} dur="5.4s" seed="5" />
        <SwayFilter id="f-plant-left" region={PLANTS.left} keyMatrix={LEAF_KEY} freq={PLANT_SWAY.freq} amp={PLANT_SWAY.amp} dur={PLANT_SWAY.dur} seed="13" />
        <SwayFilter id="f-plant-desk" region={PLANTS.desk} keyMatrix={NOT_WOOD_KEY} freq="0.03 0.05" amp={4.5} dur="5.2s" seed="17" />
        <SwayFilter id="f-balcony-l" region={PLANTS.balconyLeft} keyMatrix={NOT_WOOD_KEY} freq="0.035 0.05" amp={5} dur="3.9s" seed="19" />
        <SwayFilter id="f-balcony-r" region={PLANTS.balconyRight} keyMatrix={NOT_WOOD_KEY} freq="0.035 0.05" amp={5} dur="4.3s" seed="23" />
        <SwayFilter id="f-vase" region={PLANTS.vase} keyMatrix={NOT_WOOD_KEY} freq="0.03 0.045" amp={4} dur="4.8s" seed="29" />
        <clipPath id="clip-lamp">
          <rect x={LAMP_SWING.x} y={LAMP_SWING.y} width={LAMP_SWING.w} height={LAMP_SWING.h} />
        </clipPath>
        <Feather id="m-lamp" x={LAMP_SWING.x - 20} y={LAMP_SWING.y} w={LAMP_SWING.w + 40} h={LAMP_SWING.h} soft={0.18} />
        <SwayFilter id="f-clouds" region={CLOUD_REGION} keyMatrix={NOT_WOOD_KEY} freq="0.006 0.012" amp={14} dur="22s" seed="2" />

        {/* Noche: cielo, mar, nubes y flores exteriores pasan a azul de luna; la madera conserva la luz de dentro */}
        <filter id="f-night" x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.5 -1.5 3 0 0" result="blue" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 1 1 0 -2.1" result="white" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -6 9 -3 0 -0.2" result="leaf" />
          <feComposite in="blue" in2="white" operator="arithmetic" k2="1" k3="1" result="bw" />
          <feComposite in="bw" in2="leaf" operator="arithmetic" k2="1" k3="0.7" result="key" />
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="0.1 0.05 0.03 0 0.01  0.06 0.13 0.08 0 0.02  0.08 0.15 0.36 0 0.07  0 0 0 1 0"
            result="moonlit"
          />
          <feComposite in="moonlit" in2="key" operator="in" />
        </filter>

        {/* Atardecer: el cielo se vuelve melocotón y rosa; el mar, malva con reflejos ámbar */}
        <filter id="f-sunset-sky" x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.5 -1.5 3 0 0.05" result="key" />
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="0.27 0.55 0.1 0 0.34  0.17 0.36 0.06 0 0.14  0.15 0.3 0.05 0 0.16  0 0 0 1 0"
            result="peach"
          />
          <feComposite in="peach" in2="key" operator="in" />
        </filter>
        <filter id="f-sunset-sea" x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.5 -1.5 3 0 0" result="key" />
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="0.2 0.45 0.1 0 0.18  0.12 0.3 0.12 0 0.1  0.12 0.3 0.4 0 0.12  0 0 0 1 0"
            result="mauve"
          />
          <feComposite in="mauve" in2="key" operator="in" />
        </filter>

        {/* Llave del cielo como máscara: las estrellas solo se ven sobre azul abierto */}
        <filter id="f-skykey" x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -2 -2 4 0 -0.1" />
        </filter>
        <mask id="m-sky" maskUnits="userSpaceOnUse" x="0" y="0" width={SCENE_W} height={SCENE_H}>
          <g clipPath="url(#clip-sky-top)">
            <image href={SCENE_SRC} width={SCENE_W} height={SCENE_H} filter="url(#f-skykey)" />
          </g>
        </mask>
        <radialGradient id="g-moon-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#dfe8ff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#dfe8ff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Escena animada (se reutiliza con <use> en las capas de hora del día) */}
      <g id="scene-live">
        <image href={SCENE_SRC} width={SCENE_W} height={SCENE_H} />
        {/* Capa lejana del parallax: mar y nubes se desplazan menos que la habitación */}
        <g className="layer-far">
          <Crop clip="clip-sea" filter="f-sea" />
          <Crop filter="f-clouds" />
        </g>
        <Crop filter="f-ivy" />
        <Crop filter="f-curtain" />
        <Crop filter="f-plant-left" />
        <Crop filter="f-plant-desk" />
        <Crop filter="f-balcony-l" />
        <Crop filter="f-balcony-r" />
        <Crop filter="f-vase" />
        <g className="lamp-swing" style={{ transformOrigin: `${LAMP_SWING.pivotX}px ${LAMP_SWING.pivotY}px` }}>
          <Crop clip="clip-lamp" mask="m-lamp" />
        </g>
        <Crop filter="f-flowers" />
        <Crop filter="f-vines" />
        <g className={`chime-swing${chimeRing ? ' is-ringing' : ''}`} style={{ transformOrigin: `${CHIME.anchorX}px ${CHIME.anchorY}px` }}>
          <Crop clip="clip-chime" mask="m-chime" />
        </g>

        {/* Vapor de las tazas del balcón y de la mesa */}
        {STEAM.map((m, i) => (
          <g key={i} className="steam" transform={`translate(${m.x} ${m.y})`}>
            {[-5, 0, 5].map((dx, j) => (
              <path key={dx} d={`M${dx} 0 q-4 -7 0 -14 q4 -7 0 -14 q-4 -7 0 -12`} style={{ animationDelay: `${j * 0.9 + i * 0.4}s` }} />
            ))}
          </g>
        ))}

      </g>

      {/* Gaviotas lejanas: enmascaradas al cielo abierto, pasan por detrás de flores y hojas */}
      {timeOfDay !== 'night' && (
        <g mask="url(#m-sky)" className="gulls layer-far" data-tod={timeOfDay}>
          {GULLS.map((g, i) => (
            <g
              key={i}
              className="gull"
              style={{
                '--x0': `${g.from[0]}px`,
                '--y0': `${g.from[1]}px`,
                '--x1': `${g.to[0]}px`,
                '--y1': `${g.to[1]}px`,
                animationDuration: `${g.dur}s`,
                animationDelay: `${g.delay}s`,
              }}
            >
              <path transform={`scale(${g.size})`} d={WING_UP}>
                <animate attributeName="d" values={`${WING_UP};${WING_DOWN};${WING_UP}`} dur={`${g.flap}s`} repeatCount="indefinite" />
              </path>
            </g>
          ))}
        </g>
      )}

      {/* Atardecer dorado */}
      <g className="tod-layer" data-on={timeOfDay === 'sunset'}>
        {timeOfDay === 'sunset' && (
          <>
            <g clipPath="url(#clip-sky-top)" opacity="0.82">
              <use href="#scene-live" filter="url(#f-sunset-sky)" />
            </g>
            <g clipPath="url(#clip-sea-band)" opacity="0.7">
              <use href="#scene-live" filter="url(#f-sunset-sea)" />
            </g>
          </>
        )}
      </g>

      {/* Noche de lectura */}
      <g className="tod-layer" data-on={timeOfDay === 'night'}>
        {timeOfDay === 'night' && (
          <>
            <g clipPath="url(#clip-exterior)" opacity="0.94">
              <use href="#scene-live" filter="url(#f-night)" />
            </g>
            <g mask="url(#m-sky)" className="layer-far">
              {STARS.map((s, i) => (
                <circle
                  key={i}
                  className="star"
                  cx={s.x}
                  cy={s.y}
                  r={s.r}
                  style={{ animationDuration: `${s.d}s`, animationDelay: `${s.delay}s` }}
                />
              ))}
              <circle cx={MOON.x} cy={MOON.y} r={MOON.r * 3.6} fill="url(#g-moon-halo)" />
            </g>
          </>
        )}
      </g>
    </svg>
  );
});
