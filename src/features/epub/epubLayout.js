// Lectura «Página a página» (SPEC §55.3): columnas CSS dentro del documento del capítulo, desplazamiento horizontal
// exacto de un ancho de página y `scroll-snap` nativo para deslizar sin capas encima del texto (WebKit no ejecuta
// escuchadores de la app dentro del iframe sin scripts). Al principio y al final de cada sección hay una página de paso
// que abre la sección contigua. Todo opera sobre el documento del iframe desde la app; nada de esto toca la biblioteca.

const STYLE_ID = 'bs-paged-style';
const TURN = 'bs-turn';

/** Estilos de la paginación: el ancho y el alto son los medidos del iframe (los márgenes van fuera, una sola vez). */
export function pagedCss({ width, height, rtl }) {
  return `
  html { height: ${height}px; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; scrollbar-width: none;
    direction: ${rtl ? 'rtl' : 'ltr'}; }
  html::-webkit-scrollbar { display: none; }
  body { box-sizing: border-box; height: ${height}px; max-width: none !important; margin: 0 !important; padding: 0 !important;
    column-width: ${width}px; column-gap: 0; column-fill: auto; overflow: visible; }
  body > * { break-inside: auto; }
  img, svg, image, figure, table { max-height: ${Math.max(80, height - 8)}px; break-inside: avoid; }
  h1, h2, h3, h4, h5, h6 { break-after: avoid; }
  .${TURN} { box-sizing: border-box; height: ${height}px; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 10px; text-align: center; break-before: column; break-after: column;
    -webkit-column-break-before: always; -webkit-column-break-after: always; color: inherit; opacity: .75; font-style: italic; }
  .${TURN} b { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 1.3em; font-style: normal; }
  .bs-snap { position: absolute; top: 0; height: 1px; width: ${width}px; scroll-snap-align: start; pointer-events: none; }
  `;
}

/**
 * Prepara el documento para paginar: estilos, páginas de paso (anterior/siguiente sección, si existen) y marcas de
 * ajuste. Idempotente: si ya estaba preparado, solo actualiza medidas y marcas.
 */
export function applyPaged(doc, { width, height, rtl = false, prev = null, next = null }) {
  let style = doc.getElementById(STYLE_ID);
  if (!style) {
    style = doc.createElement('style');
    style.id = STYLE_ID;
    doc.head.appendChild(style);
  }
  style.textContent = pagedCss({ width, height, rtl });
  const body = doc.body;
  const turn = (kind, title) => {
    let el = body.querySelector(`.${TURN}[data-turn="${kind}"]`);
    if (!title) {
      el?.remove();
      return;
    }
    if (!el) {
      el = doc.createElement('div');
      el.className = TURN;
      el.setAttribute('data-turn', kind);
      el.setAttribute('aria-hidden', 'true');
      if (kind === 'prev') body.insertBefore(el, body.firstChild);
      else body.appendChild(el);
    }
    el.textContent = '';
    const small = doc.createElement('span');
    small.textContent = kind === 'prev' ? 'Sección anterior' : 'Siguiente sección';
    const b = doc.createElement('b');
    b.textContent = title;
    el.append(small, b);
  };
  turn('prev', prev);
  turn('next', next);
  syncSnaps(doc, width);
}

/** Quita la paginación (vuelta al desplazamiento continuo). */
export function removePaged(doc) {
  doc.getElementById(STYLE_ID)?.remove();
  doc.querySelectorAll(`.${TURN}, .bs-snap`).forEach((el) => el.remove());
}

const scroller = (doc) => doc.scrollingElement ?? doc.documentElement;

/** Número de páginas de pantalla del documento (incluidas las de paso), sin página vacía por redondeo. */
export function pageCount(doc, width) {
  const w = Math.max(1, width);
  return Math.max(1, Math.round(scroller(doc).scrollWidth / w));
}

/** Una marca de ajuste por página (el `scroll-snap` necesita cajas a las que ajustarse). */
export function syncSnaps(doc, width) {
  doc.querySelectorAll('.bs-snap').forEach((el) => el.remove());
  const n = pageCount(doc, width);
  const rtl = doc.documentElement.style.direction === 'rtl' || getComputedStyle(doc.documentElement).direction === 'rtl';
  for (let i = 0; i < n; i++) {
    const s = doc.createElement('span');
    s.className = 'bs-snap';
    s.style[rtl ? 'right' : 'left'] = `${i * width}px`;
    doc.documentElement.appendChild(s);
  }
}

/** Página actual (0 = primera; incluye la de paso si existe). */
export function currentPage(doc, width) {
  return Math.round(Math.abs(scroller(doc).scrollLeft) / Math.max(1, width));
}

/** Ir a una página exacta (sin animación larga: el cambio es estable y respeta el movimiento reducido). */
export function goToPage(doc, width, page) {
  const el = scroller(doc);
  const rtl = getComputedStyle(doc.documentElement).direction === 'rtl';
  const n = pageCount(doc, width);
  const p = Math.min(n - 1, Math.max(0, page));
  el.scrollLeft = (rtl ? -1 : 1) * p * width;
  return p;
}

/** Páginas de paso del documento: `{ prev, next }` (si existen). */
export const turns = (doc) => ({ prev: Boolean(doc.querySelector(`.${TURN}[data-turn="prev"]`)), next: Boolean(doc.querySelector(`.${TURN}[data-turn="next"]`)) });

/** Página de pantalla en la que está un bloque (y su fracción, si se parte entre varias). */
export function pageOfBlock(doc, width, block, offset = 0) {
  const rects = [...block.getClientRects()].filter((r) => r.width || r.height);
  if (!rects.length) return null;
  const rect = rects[Math.min(rects.length - 1, Math.floor((offset ?? 0) * rects.length))];
  const rtl = getComputedStyle(doc.documentElement).direction === 'rtl';
  const x = rtl ? width - rect.right + Math.abs(scroller(doc).scrollLeft) : rect.left + scroller(doc).scrollLeft;
  return Math.max(0, Math.floor((x + 1) / Math.max(1, width)));
}

/** Primer bloque visible en la página actual y fracción aproximada dentro de él. */
export function visibleBlock(doc, width) {
  for (const b of doc.querySelectorAll('[data-bs-block]')) {
    const rects = [...b.getClientRects()].filter((r) => r.width || r.height);
    const i = rects.findIndex((r) => r.right > 1 && r.left < width - 1);
    if (i >= 0) return { block: b, offset: rects.length > 1 ? i / rects.length : 0 };
  }
  return null;
}
