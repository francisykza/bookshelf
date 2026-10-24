// Escena recompuesta de MAIN_ROOM (SPEC §24): el fondo limpio sobre la ilustración original (que queda debajo
// como alternativa) y, por encima de los veleros y por debajo de los objetos y la luz, la cortina, la enredadera
// con su poste y las dos guirnaldas. Decorativas: sin eventos ni nombre accesible. Solo se mueven las capas con
// `motion`, en CSS (transform), en pausa con la habitación fuera de vista, un panel delante o la pestaña oculta,
// y quietas con movimiento reducido.
import { useEffect, useState } from 'react';
import { SCENE_H, SCENE_REFRESH, SCENE_W } from '../../scene/sceneMap';

/** Fondo limpio: una <img> más en el mismo lienzo (misma transformación, sin object-fit propio). */
export function RefreshBase() {
  return <img className="scene-refresh-base" src={SCENE_REFRESH.base} width={SCENE_W} height={SCENE_H} alt="" aria-hidden="true" draggable={false} decoding="async" />;
}

export function RefreshLayers({ active, reducedMotion }) {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  useEffect(() => {
    const on = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  const running = active && visible && !reducedMotion;
  return (
    <div className="room-refresh" data-running={running || undefined} data-reduced={reducedMotion || undefined} aria-hidden="true">
      {SCENE_REFRESH.layers.map((l) => (
        <img
          key={l.id}
          className="room-refresh__layer"
          data-id={l.id}
          data-motion={l.motion?.kind}
          src={l.src}
          width={l.w}
          height={l.h}
          alt=""
          draggable={false}
          decoding="async"
          style={{
            left: l.x,
            top: l.y,
            ...(l.motion ? { animationDelay: l.motion.delay, transformOrigin: l.motion.origin ? `${l.motion.origin[0]}px ${l.motion.origin[1]}px` : '50% 0' } : null),
          }}
        />
      ))}
    </div>
  );
}
