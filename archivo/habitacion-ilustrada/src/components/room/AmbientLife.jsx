// Vida ambiental de MAIN_ROOM (SPEC §19.6): la llama de la vela anclada a su mecha y unas motas de polvo en el
// aire de la puerta-ventana. Solo transform y opacity en CSS (sin canvas ni estado React por fotograma); en
// pausa con la habitación fuera de pantalla, un modal delante o la pestaña oculta; quieta con movimiento
// reducido. Los destellos del mar viven en `BaySailboats`, dentro de la misma máscara del agua.
import { useEffect, useState } from 'react';
import { LITE_SCENE } from '../../scene/renderMode';
import { CANDLE, DUST_REGION, SCENE_H, SCENE_W } from '../../scene/sceneMap';
import { boatPhase } from '../../scene/sea';

/** Motas deterministas: 12 en el perfil móvil (el máximo pedido), 16 en escritorio. */
const DUST = Array.from({ length: LITE_SCENE ? 12 : 16 }, (_, i) => {
  const a = boatPhase('dust', i);
  const b = boatPhase('dust-y', i);
  return { x: DUST_REGION.x + a * DUST_REGION.w, y: DUST_REGION.y + b * DUST_REGION.h, s: 1.6 + (i % 3) * 0.7, d: 14 + (i % 5) * 2, delay: -a * 20 };
});

export function AmbientLife({ active, reducedMotion, candleOn, timeOfDay }) {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  useEffect(() => {
    const on = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  const running = active && visible && !reducedMotion;
  return (
    <div className="ambient-life" data-running={running || undefined} data-reduced={reducedMotion || undefined} aria-hidden="true">
      {/* Llama pequeña sobre la mecha pintada (si la vela está apagada no hay ni llama ni resplandor) */}
      {candleOn && (
        <span className="candle-flame" style={{ left: CANDLE.x, top: CANDLE.y }}>
          <span className="candle-flame__glow" />
          <span className="candle-flame__body" />
        </span>
      )}
      {/* Motas a la luz: de día y al atardecer, nunca de noche */}
      {timeOfDay !== 'night' &&
        DUST.map((m, i) => (
          <span key={i} className="dust-mote" style={{ left: m.x, top: m.y, width: m.s, height: m.s, animationDuration: `${m.d}s`, animationDelay: `${m.delay.toFixed(2)}s` }} />
        ))}
    </div>
  );
}

/**
 * Brisa por la ventana (SPEC §22.3). La vegetación de la ilustración está pintada en la misma imagen (no hay
 * capas de hojas separables), así que no se recorta ni se mueve: se AÑADEN cuatro grupos pequeños de hojas
 * SVG junto al borde vegetal del arco, cada uno sujeto por su tallo (`transform-origin` en el punto de anclaje).
 * Una ráfaga cada 14 s (sube, oscila y vuelve; reposo ≈ 65 %), desfasada por grupo. Solo `transform` en CSS;
 * en pausa fuera de la habitación, con un panel delante o con la pestaña oculta; quieta con movimiento reducido.
 */
const BREEZE = [
  { id: 'mullion', x: 706, y: 352, rot: 6, delay: '0s', leaves: [[0, 18, -20], [-6, 30, 25], [4, 40, -10]] },
  { id: 'arch-right', x: 880, y: 118, rot: -8, delay: '-2.4s', leaves: [[0, 14, 15], [5, 26, -25], [-4, 36, 10], [2, 46, -5]] },
  { id: 'arch-top', x: 792, y: 150, rot: 4, delay: '-5.1s', leaves: [[0, 16, -15], [-5, 28, 20], [3, 38, -8]] },
  { id: 'beam', x: 512, y: 120, rot: -3, delay: '-7.3s', leaves: [[0, 16, 18], [6, 28, -22], [-3, 40, 12]] },
];
/** Hoja de hiedra sencilla (punta y dos lóbulos suaves), centrada en su base; ×1,5 ≈ 16 × 20 px de la imagen, como la hiedra pintada. */
const LEAF_SCALE = 1.5;
const LEAF = 'M0 0 C-5 -2 -7 -7 -4 -11 C-2 -9 -1 -12 0 -14 C1 -12 2 -9 4 -11 C7 -7 5 -2 0 0 Z';

export function BreezeLeaves({ active, reducedMotion }) {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  useEffect(() => {
    const on = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  const running = active && visible && !reducedMotion;
  return (
    <svg className="breeze" data-running={running || undefined} data-reduced={reducedMotion || undefined} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} width={SCENE_W} height={SCENE_H} aria-hidden="true">
      {BREEZE.map((g) => (
        <g key={g.id} transform={`translate(${g.x} ${g.y}) rotate(${g.rot})`}>
          <g className="breeze__group" data-id={g.id} style={{ animationDelay: g.delay }}>
            <path className="breeze__stem" d={`M0 0 Q2 ${(g.leaves.at(-1)[1] * LEAF_SCALE) / 2} ${g.leaves.at(-1)[0] * LEAF_SCALE} ${g.leaves.at(-1)[1] * LEAF_SCALE}`} />
            {g.leaves.map(([lx, ly, a], i) => (
              <g key={i} transform={`translate(${lx * LEAF_SCALE} ${ly * LEAF_SCALE}) rotate(${a + 180}) scale(${LEAF_SCALE})`}>
                <path className="breeze__leaf" data-tone={i % 3} d={LEAF} />
                <path className="breeze__vein" d="M0 0 L0 -11" />
              </g>
            ))}
          </g>
        </g>
      ))}
    </svg>
  );
}
