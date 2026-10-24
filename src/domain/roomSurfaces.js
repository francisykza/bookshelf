// Datos de las superficies de la habitación (SPEC §19.2–19.3), sin React: la cuadrícula del mes de la pantalla
// del portátil y el progreso del libro abierto.
import { formatPercent, percentRead, trackUnit } from './books';
import { parseDay } from './dates';

/** Cuadrícula del mes de `today` empezando en lunes: `null` para los huecos. */
export function monthCells(today) {
  const d = parseDay(today);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const count = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const pad = (n) => String(n).padStart(2, '0');
  return [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: count }, (_, i) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(i + 1)}`),
  ];
}

/**
 * Progreso para la página «Por donde vas» del libro abierto (SPEC §21.2): la página actual como dato principal
 * y «de T · P %» como secundario; por porcentaje, el porcentaje y «leído». Sin total conocido no hay
 * porcentaje ni línea de progreso. Nunca NaN ni «undefined».
 */
export function progressParts(book) {
  if (trackUnit(book) === 'percent') {
    const pct = percentRead(book);
    return Number.isFinite(pct) ? { main: formatPercent(pct), secondary: 'leído', fraction: pct / 100 } : { main: 'En curso', secondary: '', fraction: null };
  }
  const page = Number.isFinite(book.currentPage) ? book.currentPage : 0;
  if (!book.pageCount) return { main: `Página ${page}`, secondary: '', fraction: null };
  const pct = percentRead(book);
  return { main: `Página ${page}`, secondary: `de ${book.pageCount} · ${formatPercent(pct)}`, fraction: pct / 100 };
}
