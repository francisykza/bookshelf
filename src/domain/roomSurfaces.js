// Datos de las superficies de la habitación (SPEC §19.2–19.3), sin React: la cuadrícula del mes de la pantalla
// del portátil y la línea de progreso del libro abierto.
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

/** Texto de progreso con los datos que existen (sin porcentaje si no hay total, nunca NaN ni «undefined»). */
export function progressLine(book) {
  if (trackUnit(book) === 'percent') return `${formatPercent(percentRead(book))} leído`;
  const page = Number.isFinite(book.currentPage) ? book.currentPage : 0;
  if (!book.pageCount) return `Página ${page}`;
  return `Página ${page} de ${book.pageCount} · ${formatPercent(percentRead(book))}`;
}

