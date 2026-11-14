// El café-librería del bajo, 1.132 (plan en docs/qa/cafe-libreria.md §16): el reloj de arena del influencer. De latón y en
// píxel, arriba a la derecha de la escena, desde que vas a la barra hasta que le das la taza y el libro. Sin números ni
// alarmas: la arena baja y ya está (el servidor mide de verdad, con su margen). Para los lectores de pantalla, cómo va dicho
// en palabras (`arenaTexto`); con movimiento reducido, una barra quieta que se vacía, sin el hilo de arena que cae.
import { useEffect, useState } from 'react';
import { arenaQueda, arenaTexto } from './cafeInfluencers';
import { PALETA_ARENA, barraFilas, relojFilas } from './cafeArena';
import { PixelArt } from './PixelArt';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** `desde`: cuándo se le dio la vuelta (Date.now()). */
export function RelojArena({ desde }) {
  const [quieto] = useState(reduced);
  const [ahora, setAhora] = useState(() => Date.now());
  const [fase, setFase] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => {
        setAhora(Date.now());
        setFase((f) => 1 - f);
      },
      quieto ? 2000 : 260,
    );
    return () => clearInterval(id);
  }, [quieto]);
  const queda = arenaQueda(ahora - desde);
  const texto = arenaTexto(queda);
  return (
    <div className="cf3-arena" role="img" aria-label={texto} data-quieto={quieto ? 'true' : undefined} data-vacia={queda <= 0 ? 'true' : undefined} data-queda={Math.round(queda * 100)}>
      <PixelArt icono={{ paleta: PALETA_ARENA, filas: quieto ? barraFilas(queda) : relojFilas(queda, fase) }} />
    </div>
  );
}
