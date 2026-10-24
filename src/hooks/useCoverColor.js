// Color del lomo a partir de la portada (SPEC §18.4): se pinta al momento con el color determinista y solo se
// analiza la portada cuando el libro está visible o a punto de entrar (200 px). Un resultado tardío de una portada
// anterior se ignora; al desmontar no se actualiza el estado; cancelar aquí no cancela la tarea compartida.
import { useEffect, useState } from 'react';
import { spineColor } from '../domain/books';
import { extractCoverColor } from '../utils/coverColor';

/** Oscurece un poco el color de la portada hacia la tinta para que funcione como tela de lomo. */
export function asSpine(hex, amount = 0.22) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c, ink) => Math.round(c * (1 - amount) + ink * amount);
  const r = mix((n >> 16) & 255, 0x2c);
  const g = mix((n >> 8) & 255, 0x1e);
  const b = mix(n & 255, 0x14);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function useCoverColor(book) {
  const fallback = spineColor(book);
  // Un color elegido por el usuario manda: no se analiza la portada
  const cover = !book.color && typeof book.cover === 'string' && book.cover ? book.cover : null;
  const [node, setNode] = useState(null);
  const [result, setResult] = useState({ url: null, color: null });

  useEffect(() => {
    if (!cover || !node || typeof IntersectionObserver === 'undefined') return undefined;
    const ctrl = new AbortController();
    let started = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || started) return;
        started = true;
        io.disconnect();
        extractCoverColor(cover, { fallbackColor: fallback, signal: ctrl.signal }).then((r) => {
          if (!ctrl.signal.aborted && r.source === 'cover') setResult({ url: cover, color: asSpine(r.color) });
        });
      },
      { rootMargin: '200px' },
    );
    io.observe(node);
    return () => {
      ctrl.abort();
      io.disconnect();
    };
  }, [cover, node, fallback]);

  return [result.url === cover && result.color ? result.color : fallback, setNode];
}
