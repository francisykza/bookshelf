// Escenario de una habitación (SPEC §16.4): un lienzo con las dimensiones intrínsecas de su ilustración que
// contiene imagen, overlays y hotspots y recibe UNA transformación (escala cover + desplazamiento del encuadre).
// La geometría sale de medir el panel con ResizeObserver, nunca de `window.innerHeight` leído una vez.
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { fitCover, stageTransform } from '../../scene/stageFit';

// Diagnóstico solo en desarrollo y bajo petición explícita: en producción este código desaparece del bundle
const DEBUG = import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sceneDebug') === '1';
const SceneDebug = DEBUG ? lazy(() => import('./SceneDebug')) : null;

const same = (a, b) => a.panelW === b.panelW && a.panelH === b.panelH;

export function SceneStage({ room, className = '', children, overlay, inert, ariaHidden, ...rest }) {
  const ref = useRef(null);
  const [fit, setFit] = useState(() => fitCover(window.innerWidth, window.innerHeight, room));

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Durante un pinch-zoom del navegador no se reencuadra
        const vv = window.visualViewport;
        if (vv && Math.abs(vv.scale - 1) > 0.01) return;
        const w = node.clientWidth;
        const h = node.clientHeight;
        if (!w || !h) return;
        const next = fitCover(w, h, room);
        setFit((prev) => (same(prev, next) ? prev : next));
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [room]);

  return (
    <div
      ref={ref}
      className={`scene-stage ${className}`}
      data-room={room.id}
      data-scale={fit.scale.toFixed(4)}
      data-offset-x={fit.offsetX.toFixed(2)}
      data-offset-y={fit.offsetY.toFixed(2)}
      inert={inert ? true : undefined}
      aria-hidden={ariaHidden || undefined}
      {...rest}
    >
      <div className="scene-world" style={{ width: room.width, height: room.height, transform: stageTransform(fit), '--k': fit.scale }}>
        {typeof children === 'function' ? children(fit) : children}
      </div>
      {/* Controles propios del panel, fuera del lienzo escalado (no se deforman ni salen de su sitio) */}
      {overlay?.(fit)}
      {SceneDebug && (
        <Suspense fallback={null}>
          <SceneDebug room={room} fit={fit} stageRef={ref} />
        </Suspense>
      )}
    </div>
  );
}
