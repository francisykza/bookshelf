// Vida ambiental de MAIN_ROOM (SPEC §19.6): la llama de la vela anclada a su mecha y unas motas de polvo en el
// aire de la puerta-ventana. Solo transform y opacity en CSS (sin canvas ni estado React por fotograma); en
// pausa con la habitación fuera de pantalla, un modal delante o la pestaña oculta; quieta con movimiento
// reducido. Los destellos del mar viven en `BaySailboats`, dentro de la misma máscara del agua.
import { useEffect, useState } from 'react';
import { LITE_SCENE } from '../../scene/renderMode';
import { CANDLE, DUST_REGION } from '../../scene/sceneMap';
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
