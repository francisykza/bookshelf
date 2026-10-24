// Datos vivos integrados en la habitación (SPEC §3.3, §16.7 y §19): cuenta atrás como bruma sobre el té, notas
// doradas de los auriculares, vapor solo para bebidas calientes y sombra de nube. La pantalla del portátil y el
// libro abierto viven en `RoomSurfaces`.
import { useLayoutEffect, useRef, useState } from 'react';
import { placeAnnotation, safeAreas } from '../../scene/guidePlacement';
import { HOTSPOTS, TEA_LIQUID } from '../../scene/sceneMap';
import { toScreen, visibleFraction } from '../../scene/stageFit';
import { DRINKS } from '../panels/Drinks';

const fmt = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Indicador del temporizador sobre el vaso de té (SPEC §22.2). Es una anotación de la habitación: va en la capa
 * del panel (fuera del lienzo escalado y de su recorte), con el ancla del vaso proyectada UNA vez con la cámara
 * (`toScreen`) y colocada con `placeAnnotation` dentro del área segura. Se recoloca al cambiar el encuadre
 * (tamaño, orientación) o su propio tamaño (fuentes, cifras). Solo muestra el estado del temporizador único
 * (no lleva cuenta propia); si el vaso queda fuera del encuadre, no se pinta.
 */
export function TeaMist({ timer, fit }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const shown = (timer.running || timer.remaining < timer.total) && visibleFraction(fit, HOTSPOTS.tray.shape) > 0;
  const point = toScreen(fit, TEA_LIQUID.x + TEA_LIQUID.w / 2, TEA_LIQUID.top);
  const key = `${fit.panelW}x${fit.panelH}|${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const place = () => setPos(placeAnnotation({ w: fit.panelW, h: fit.panelH }, point, { w: el.offsetWidth, h: el.offsetHeight }, safeAreas()));
    place();
    const observer = new ResizeObserver(place);
    observer.observe(el);
    return () => observer.disconnect();
    // `key` resume el encuadre y el ancla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, shown]);
  if (!shown) return null;
  return (
    <div ref={ref} className="tea-mist" data-paused={!timer.running} data-placed={pos ? '' : undefined} style={pos ? { left: pos.x, top: pos.y } : { left: 0, top: 0, visibility: 'hidden' }} aria-hidden="true">
      <span className="tea-mist__time">{fmt(timer.remaining)}</span>
      <span className="tea-mist__phase">{timer.running ? (timer.phase === 'focus' ? 'leyendo' : 'descanso') : 'en pausa'}</span>
    </div>
  );
}

const NOTES = ['♪', '♫', '♪', '♬', '♫'];

/** Notas musicales doradas y ondas suaves que suben desde los auriculares cuando suena el ambiente. */
export function SoundWaves({ on }) {
  if (!on) return null;
  const a = HOTSPOTS.headphones.label;
  return (
    <div className="sound-waves" style={{ left: a.x - 60, top: a.y - 40 }} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={`w${i}`} className="sound-waves__ring" style={{ animationDelay: `${i * 1.2}s` }} />
      ))}
      {NOTES.map((n, i) => (
        <span key={i} className="sound-waves__note" style={{ animationDelay: `${i * 0.8}s`, left: `${20 + ((i * 37) % 90)}px` }}>
          {n}
        </span>
      ))}
    </div>
  );
}

/** Columna de vapor sobre la bandeja cuando la bebida elegida es caliente (más densa durante la sesión). */
export function DrinkSteam({ drink, active }) {
  if (!DRINKS[drink]?.hot) return null;
  const x = TEA_LIQUID.x + TEA_LIQUID.w / 2;
  return (
    <div className="drink-steam" data-active={active} style={{ left: x, top: TEA_LIQUID.top - 10 }} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} style={{ animationDelay: `${i * 1.1}s`, left: `${(i % 2 ? 1 : -1) * (6 + i * 3)}px` }} />
      ))}
    </div>
  );
}

/**
 * Sombra de nube de verano: cada 35 s cruza en diagonal sobre la habitación y atenúa el sol unos
 * 6 segundos; a la vez la brisa trae pétalos de la pérgola (el lienzo de partículas lo sincroniza).
 */
export function CloudShadow({ timeOfDay }) {
  if (timeOfDay === 'night') return null;
  return (
    <div className="cloud-shadow" aria-hidden="true">
      <span className="cloud-shadow__blob" />
      <span className="cloud-shadow__dim" />
    </div>
  );
}
