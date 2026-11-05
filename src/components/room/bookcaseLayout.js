// Geometría y reparto de la estantería del rincón (Rincón 01), compartidos por la habitación y la balda de cerca.
import { useMemo } from 'react';
import { featuredBook, layoutSpines, showcaseRow, spineQueue } from '../../domain/roomShelf';
import { ROOM_SHELVES } from '../../scene/sceneMap';

export const shelfOf = (id) => ROOM_SHELVES.find((s) => s.id === id);
export const ROW_SHELVES = ['middle', 'cabinet', 'cabinet2'];
const FEATURE_SHELF = 'top';

/**
 * La portada expuesta: 24 cm de alto (2:3), de pie detrás del canto de la balda de arriba. Acompaña la mitad de la
 * pendiente del tablón (el resto lo tapa el canto, como con las figuras) y se hunde lo justo para que ninguna esquina
 * quede en el aire.
 */
function featureBox() {
  const [, , br, bl] = shelfOf(FEATURE_SHELF).quad;
  const slope = (br[1] - bl[1]) / (br[0] - bl[0]);
  const h = 112;
  const w = Math.round(h * 0.66);
  const x = 158;
  const cx = x + w / 2;
  const lip = bl[1] + slope * (cx - bl[0]);
  const share = 0.5;
  const sink = (slope * (1 - share) * w) / 2 + 3;
  return { x, w, h, top: lip + sink - h, skew: Math.atan(slope * share), cx };
}
export const FEATURE_BOX = featureBox();

/** Reparto de la estantería: el expuesto y los grupos de cada balda (solo lo que cabe). */
export function useBookcase(books, settings) {
  const { roomFeaturedId, currentBookId } = settings;
  return useMemo(() => {
    const featured = featuredBook(books, { roomFeaturedId, currentBookId });
    const queue = spineQueue(books, { currentBookId }, featured?.book.id);
    // Prueba de la corrección visual: la balda de debajo del expuesto lleva un grupo al tamaño de la maqueta; el resto
    // de la cola sigue en lomos estrechos en las dos de abajo (cada ejemplar, una sola vez)
    const [showcaseId, ...narrow] = ROW_SHELVES;
    const { row, rest } = showcaseRow(queue, shelfOf(showcaseId));
    const rows = [row, ...layoutSpines(rest, narrow.map(shelfOf))];
    return { featured, rows };
  }, [books, roomFeaturedId, currentBookId]);
}
