// Ilustración base de la habitación (SPEC §11.2, 1.17.0): una sola <img> HTML en el sistema de 984 × 1599,
// separada de los filtros y máscaras SVG. Si un efecto falla, la habitación sigue entera debajo. No depende
// de la sesión, los libros, el catálogo, el audio ni el canvas; solo avisa si el recurso falla de verdad.
import { useEffect, useRef } from 'react';
import { SCENE_H, SCENE_SRC, SCENE_W } from '../../scene/sceneMap';

export function SceneBase({ attempt = 0, onStatus }) {
  const ref = useRef(null);
  const statusRef = useRef(onStatus);
  useEffect(() => {
    statusRef.current = onStatus;
  }, [onStatus]);

  // Una imagen que ya venía de la caché puede estar completa antes de que React enganche `onLoad`
  useEffect(() => {
    const img = ref.current;
    if (!img?.complete) return;
    if (img.naturalWidth > 0) statusRef.current?.('ok');
    else statusRef.current?.('error');
  }, [attempt]);

  return (
    <img
      key={attempt}
      ref={ref}
      className="scene-base"
      src={attempt ? `${SCENE_SRC}?reintento=${attempt}` : SCENE_SRC}
      width={SCENE_W}
      height={SCENE_H}
      loading="eager"
      fetchPriority="high"
      decoding="async"
      draggable={false}
      alt=""
      onLoad={(event) => {
        // `decode()` puede rechazarse aunque la imagen ya se pinte: solo cuenta como fallo si no tiene píxeles
        const img = event.currentTarget;
        statusRef.current?.('ok');
        img.decode?.().catch(() => {
          if (!img.naturalWidth) statusRef.current?.('error');
        });
      }}
      onError={() => statusRef.current?.('error')}
    />
  );
}
