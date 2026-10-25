// Diario general (SPEC §28.6): semana local y últimas entradas, solo con datos existentes.
import { addDays, dayKey, parseDay } from './dates';
import { isActive } from './reading';

const validIso = (iso) => Boolean(iso) && !Number.isNaN(new Date(iso).getTime());

/** Lunes de la semana local de `key` (YYYY-MM-DD) y sus siete días. */
export function weekOf(key) {
  const d = parseDay(key);
  const monday = addDays(d, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => dayKey(addDays(monday, i)));
}

/** Últimas anotaciones y registros, de lo más reciente a lo más antiguo (sin fechas inventadas). */
export function latestEntries(books, log, limit = 3) {
  const byId = Object.fromEntries(books.map((b) => [b.id, b]));
  const sessions = log.filter((e) => isActive(e) && byId[e.bookId]).map((e) => ({ kind: 'session', at: e.createdAt ?? `${e.date}T12:00:00.000Z`, date: e.date, book: byId[e.bookId], entry: e }));
  const notes = books.flatMap((b) => b.quotes.filter((q) => validIso(q.createdAt)).map((q) => ({ kind: 'note', at: q.createdAt, book: b, quote: q })));
  return [...sessions, ...notes].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

