// Reflejos suaves de la habitación sin «Guías» (paquete bookshelf-reflejos). Cada máscara SVG ocupa el lienzo entero
// de la ilustración (941 × 1672) y se aplica como máscara alfa de una capa coloreada dentro del mismo mundo escalado que
// el fondo: comparten tamaño, escala, recorte y cámara. Son decorativas (`aria-hidden`, sin eventos de puntero): el
// toque sigue llegando al hotspot de cada objeto. Mis sagas no tiene máscara: su acento va en el propio astro.
import { useEffect, useState } from 'react';

const MASKS = {
  figures: 'coleccion',
  shelf: 'biblioteca',
  laptop: 'diario',
  tray: 'temporizador',
  headphones: 'ambiente',
  book: 'lectura',
};

// Una sola subida y bajada al entrar en la sesión: cerrar un panel no la repite
let introPlayed = false;

export function RoomReflections({ activeId, reducedMotion }) {
  const [intro] = useState(() => !introPlayed && !reducedMotion);
  useEffect(() => {
    introPlayed = true;
  }, []);
  return (
    <div className="room-reflections" data-intro={intro || undefined} aria-hidden="true">
      {Object.entries(MASKS).map(([id, file]) => (
        <span key={id} className="room-reflection" data-reflection={id} data-active={activeId === id || undefined} style={{ '--reflection-mask': `url('/images/room-refresh/reflejos/${file}.svg')` }} />
      ))}
    </div>
  );
}
