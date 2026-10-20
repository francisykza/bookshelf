// Piezas visuales comunes de las figuras (SPEC §7, 1.15.0). Todas son <img loading="lazy" decoding="async">
// recortadas por CSS: la caja por los vértices reales de su contorno (sin la mesa ni el fondo de la foto), la
// figura fuera de caja por su silueta con bordes difuminados, las piezas del blíster y la mini-figura del pin.
import { useMemo } from 'react';

/** Rectángulo que envuelve una lista de puntos. */
const bbox = (pts) => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};

const pct = (pts, c) => pts.map(([x, y]) => `${(((x - c.x) / c.w) * 100).toFixed(2)}% ${(((y - c.y) / c.h) * 100).toFixed(2)}%`).join(', ');

/** Máscara SVG de una silueta con el borde difuminado (en px del recorte). */
function silhouetteMask(pts, c, soft = 3.5) {
  const points = pts.map(([x, y]) => `${(x - c.x).toFixed(1)},${(y - c.y).toFixed(1)}`).join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${c.w} ${c.h}" preserveAspectRatio="none"><filter id="b" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="${soft}"/></filter><polygon points="${points}" fill="#fff" filter="url(#b)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * Una imagen recortada a la región `crop` (px de la imagen). `clip` recorta por un polígono y `mask` por una
 * silueta suave; el elemento conserva la proporción del recorte y llena el alto de su contenedor.
 */
export function CroppedImg({ src, img, crop, clip, mask, className = '', round = false }) {
  const c = crop ?? { x: 0, y: 0, ...img };
  const style = useMemo(() => {
    const st = { aspectRatio: `${c.w} / ${c.h}` };
    if (clip) st.clipPath = `polygon(${pct(clip, c)})`;
    if (mask) {
      const m = silhouetteMask(mask, c);
      st.WebkitMaskImage = m;
      st.maskImage = m;
      st.WebkitMaskSize = '100% 100%';
      st.maskSize = '100% 100%';
    }
    return st;
  }, [c, clip, mask]);
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
  const outline = fig.boxOutline ?? [[0, 0], [fig.img.w, 0], [fig.img.w, fig.img.h], [0, fig.img.h]];
  const c = bbox(outline);
  const edges = outline.map(([x, y]) => `${x - c.x},${y - c.y}`).join(' ');
  return (
    <span className="fig-box" style={{ aspectRatio: `${c.w} / ${c.h}` }}>
      <CroppedImg src={fig.boxImage} img={fig.img} crop={c} clip={outline} className="fig-box__img" />
      {/* Cantos 3D: filo oscuro exterior y un hilo dorado gastado */}
      <svg className="fig-box__edges" viewBox={`0 0 ${c.w} ${c.h}`} preserveAspectRatio="none" aria-hidden="true">
        <polygon points={edges} fill="none" stroke="#0a0604" strokeWidth={c.w * 0.012} strokeLinejoin="round" />
        <polygon points={edges} fill="none" stroke="rgb(212 169 74 / 0.35)" strokeWidth={c.w * 0.003} strokeLinejoin="round" />
      </svg>
      {children}
    </span>
  );
}

/** La figura tal y como la expones: en su caja o desprecintada sobre la peana (sin el fondo de la foto). */
export function FigureArt({ fig, display = 'box', className = '', mist = false, window: windowLayer = null }) {
  if (!fig) return null;
  if (display === 'unboxed') {
    return (
      <span className={`fig-art fig-art--unboxed ${className}`}>
        {mist && <span className="fig-art__mist" aria-hidden="true" />}
        <CroppedImg src={fig.unboxedImage} img={fig.img} crop={fig.unboxedCrop} mask={fig.unboxedSilhouette} className="fig-art__figure" />
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
  if (part.crop) return <CroppedImg src={fig.boxImage} img={fig.img} crop={part.crop} className="part-art" />;
  return (
    <span className="part-art part-art--icon" aria-hidden="true">
      {KIND_ICON[part.kind] ?? '❖'}
    </span>
  );
}

/** Cabeza de la figura para la mini-figura de saga (pin redondo). */
export function PinArt({ fig }) {
  return <CroppedImg src={fig.unboxedImage} img={fig.img} crop={fig.pinCrop} round className="pin-art" />;
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

/** Proporción (ancho/alto) con la que se expone: la de la caja recortada o la de la figura. */
export function figureAspect(fig, display) {
  if (display === 'unboxed') return fig.unboxedCrop.w / fig.unboxedCrop.h;
  const c = bbox(fig.boxOutline ?? [[0, 0], [fig.img.w, fig.img.h]]);
  return c.w / c.h;
}

export { bbox };
