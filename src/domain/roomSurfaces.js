// Datos de las superficies de la habitación (SPEC §19.2–19.3), sin React: la cuadrícula del mes de la pantalla
// del portátil y la línea de progreso del libro abierto.
import { formatPercent, percentRead, trackUnit } from './books';
import { parseDay } from './dates';
import { dayDatum, isActive } from './reading';

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


/**
 * Lo leído HOY para la pantalla del portátil (SPEC §20.1), con los mismos grupos y datos que el panel del
 * calendario (`groupByDay`, `dayDatum`): páginas registradas hoy (nunca `currentPage`), o la posición en
 * porcentaje si solo hay libros por porcentaje. Sin actividad: `kind: 'none'`. Nunca inventa duración.
 */
export function todayReading(groups = []) {
  const active = groups.filter((g) => g.entries.some(isActive));
  if (!active.length) return { kind: 'none', value: '', label: '', title: '', more: 0 };
  const datum = dayDatum(active);
  const main = datum.kind === 'pages' ? active : active.filter((g) => g.entries.some((e) => e.unit === 'percent'));
  const top = main[0] ?? active[0];
  const label = datum.kind === 'pages' ? (datum.pages === 1 ? 'página leída' : 'páginas leídas') : datum.kind === 'percent' ? 'del libro' : 'lectura registrada';
  const value = datum.kind === 'none' ? '✓' : datum.kind === 'pages' ? datum.pages.toLocaleString('es-ES') : datum.text;
  return { kind: datum.kind, value, label, title: top.book.title || 'Sin título', more: active.length - 1 };
}

/**
 * Progreso para la página derecha del libro (SPEC §20.2): línea principal y secundaria con los datos que existen
 * y la fracción para el motivo de progreso. Sin total conocido no hay porcentaje ni motivo.
 */
export function progressParts(book) {
  if (trackUnit(book) === 'percent') {
    const pct = percentRead(book);
    return Number.isFinite(pct) ? { main: `${formatPercent(pct)} leído`, secondary: '', fraction: pct / 100 } : { main: 'Lectura en curso', secondary: '', fraction: null };
  }
  const page = Number.isFinite(book.currentPage) ? book.currentPage : 0;
  if (!book.pageCount) return { main: `Página ${page}`, secondary: '', fraction: null };
  const pct = percentRead(book);
  return { main: `Página ${page} de ${book.pageCount}`, secondary: `${formatPercent(pct)} leído`, fraction: pct / 100 };
}
