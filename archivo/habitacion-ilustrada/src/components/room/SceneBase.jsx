// Ilustración base de una habitación (SPEC §16.5): una sola <img> HTML en el sistema de coordenadas de su
// imagen, sin filtros, máscaras ni mezclas. Si un efecto falla, la habitación sigue entera debajo. Solo avisa
// si el recurso falla de verdad; `decode()` puede rechazarse aunque la imagen ya se pinte.
import { useEffect, useRef } from 'react';

export function SceneBase({ room, attempt = 0, onStatus, priority = 'high' }) {
  const ref = useRef(null);
  const statusRef = useRef(onStatus);
  useEffect(() => {
    statusRef.current = onStatus;
  }, [onStatus]);

  // Una imagen que ya venía de la caché puede estar completa antes de que React enganche `onLoad`
  useEffect(() => {
    const img = ref.current;
    if (!img?.complete) return;
    statusRef.current?.(img.naturalWidth > 0 ? 'ok' : 'error');
  }, [attempt]);

  return (
    <img
      key={attempt}
      ref={ref}
      className="scene-base"
      src={attempt ? `${room.src}?reintento=${attempt}` : room.src}
      width={room.width}
      height={room.height}
      loading="eager"
      fetchPriority={priority}
      decoding="async"
      draggable={false}
      alt=""
      onLoad={(event) => {
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
