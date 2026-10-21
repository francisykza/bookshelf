// Piezas visuales comunes de las figuras (SPEC §7 y §11.7). Todas son <img loading="lazy" decoding="async">:
// la caja recortada por los vértices reales de su contorno (sin la mesa ni el fondo de la foto), la figura
// desprecintada solo si existe un asset propio con transparencia (entero, sin máscaras), las piezas del
// blíster y la mini-figura del pin. Sin asset transparente se muestra la caja (ruta legacy).
import { useMemo } from 'react';
import { shownDisplay } from './figureDisplay';

/** Rectángulo que envuelve una lista de puntos. */
const bbox = (pts) => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};

const pct = (pts, c) => pts.map(([x, y]) => `${(((x - c.x) / c.w) * 100).toFixed(2)}% ${(((y - c.y) / c.h) * 100).toFixed(2)}%`).join(', ');

/**
 * Una imagen recortada a la región `crop` (px de la imagen). `clip` recorta por un polígono; el elemento
 * conserva la proporción del recorte y llena el alto de su contenedor.
 */
export function CroppedImg({ src, img, crop, clip, className = '', round = false }) {
  const c = crop ?? { x: 0, y: 0, ...img };
  const style = useMemo(() => {
    const st = { aspectRatio: `${c.w} / ${c.h}` };
    if (clip) st.clipPath = `polygon(${pct(clip, c)})`;
    return st;
  }, [c, clip]);
  return (
    <span className={`crop-img ${round ? 'crop-img--round' : ''} ${className}`} style={style}>
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        draggable="false"
        style={{ width: `${(img.w / c.w) * 100}%`, left: `${(-c.x / c.w) * 100}%`, top: `${(-c.y / c.h) * 100}%` }}
      />
    </span>
  );
}

/** La caja recortada por su contorno real, con sus cantos oscuros dibujados encima. */
export function BoxArt({ fig, children }) {
  const size = fig.boxSize ?? fig.img;
  const outline = fig.boxOutline ?? [[0, 0], [size.w, 0], [size.w, size.h], [0, size.h]];
  const c = bbox(outline);
  const edges = outline.map(([x, y]) => `${x - c.x},${y - c.y}`).join(' ');
  return (
    <span className="fig-box" style={{ aspectRatio: `${c.w} / ${c.h}` }}>
      <CroppedImg src={fig.boxImage} img={size} crop={c} clip={outline} className="fig-box__img" />
      {/* Cantos 3D: filo oscuro exterior y un hilo dorado gastado */}
      <svg className="fig-box__edges" viewBox={`0 0 ${c.w} ${c.h}`} preserveAspectRatio="none" aria-hidden="true">
        <polygon points={edges} fill="none" stroke="#0a0604" strokeWidth={c.w * 0.012} strokeLinejoin="round" />
        <polygon points={edges} fill="none" stroke="rgb(212 169 74 / 0.35)" strokeWidth={c.w * 0.003} strokeLinejoin="round" />
      </svg>
      {children}
    </span>
  );
}

/** La figura tal y como la expones: en su caja o desprecintada sobre la peana (asset con alfa, entero). */
export function FigureArt({ fig, display = 'box', className = '', mist = false, window: windowLayer = null }) {
  if (!fig) return null;
  if (shownDisplay(fig, display) === 'unboxed') {
    return (
      <span className={`fig-art fig-art--unboxed ${className}`}>
        {mist && <span className="fig-art__mist" aria-hidden="true" />}
        <img
          className="fig-art__alpha"
          src={fig.unboxedImage}
          width={fig.unboxedSize.w}
          height={fig.unboxedSize.h}
          style={{ aspectRatio: `${fig.unboxedSize.w} / ${fig.unboxedSize.h}` }}
          alt=""
          loading="lazy"
          decoding="async"
          draggable="false"
        />
        <span className="fig-art__contact" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className={`fig-art fig-art--box ${className}`}>
      <BoxArt fig={fig}>{windowLayer}</BoxArt>
    </span>
  );
}

const KIND_ICON = { face: '☺', weapon: '⚔', effect: '✦', relic: '❖' };

/** Una pieza del blíster: recorte real de la caja o, si no lo hay, un icono según su tipo. */
export function PartArt({ fig, part }) {
  if (part.crop) return <CroppedImg src={fig.boxImage} img={fig.boxSize ?? fig.img} crop={part.crop} className="part-art" />;
  return (
    <span className="part-art part-art--icon" aria-hidden="true">
      {KIND_ICON[part.kind] ?? '❖'}
    </span>
  );
}

/** Cabeza de la figura para la mini-figura de saga (pin redondo). */
export function PinArt({ fig }) {
  return <CroppedImg src={fig.pinImage ?? fig.boxImage} img={fig.pinSize ?? fig.img} crop={fig.pinCrop} round className="pin-art" />;
}

/** Partículas vivas sobre la figura (bruma plateada, brasas, polvo de estrellas, viento u oro). */
export function FigureParticles({ kind, strong = false }) {
  return (
    <span className="fig-particles" data-kind={kind} data-strong={strong || undefined} aria-hidden="true">
      {Array.from({ length: strong ? 10 : 6 }, (_, i) => (
        <i key={i} style={{ '--i': i, left: `${8 + ((i * 37) % 84)}%`, animationDelay: `${-i * 0.7}s` }} />
      ))}
    </span>
  );
}

export const RANK_STARS = (rank) => '★'.repeat(rank) + '☆'.repeat(5 - rank);

/** Proporción (ancho/alto) con la que se ve: la de la caja recortada o la de la figura transparente. */
export function figureAspect(fig, display) {
  if (shownDisplay(fig, display) === 'unboxed') return fig.unboxedSize.w / fig.unboxedSize.h;
  const size = fig.boxSize ?? fig.img;
  const c = bbox(fig.boxOutline ?? [[0, 0], [size.w, size.h]]);
  return c.w / c.h;
}

export { bbox };
