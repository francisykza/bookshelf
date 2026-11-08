// «Tu mes en libros» (Fase 2): la única agregación del mes; pantalla y tarjeta exportada leen lo mismo. Todo se calcula en el momento con los
// datos reales, así que corregir o borrar una sesión o una fecha cambia el resumen sin guardar nada. Campos usados:
// - Libros terminados: `book.finishedAt` (si está en «read») y `book.pastReads[].finishedAt` (relecturas). Cada ciclo con fecha válida cuenta una vez.
// - Páginas y días: `progress.readingLog`, con su `date` local. `pages` ya es el avance (una página absoluta se guardó convertida a avance).
// - Favoritos (hasta 3, por orden) y frase: `progress.monthNotes['AAAA-MM']`, dentro de la biblioteca de la cuenta. Un `favorite` antiguo cuenta como puesto 1.
import { dayKey, parseDay } from './dates';
import { isActive } from './reading';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Las importaciones guardan un día sin hora a mediodía UTC (`dayToIso`): ese día se respeta en cualquier zona horaria. */
const DAY_ONLY_ISO = /^(\d{4}-\d{2}-\d{2})T12:00:00\.000Z$/;

export const NOTE_MAX = 160;
export const FAVORITES_MAX = 3;

/** Los ids elegidos, por orden, sin repetir. El campo antiguo de un solo favorito se lee como puesto 1. */
export function noteFavorites(note) {
  const raw = Array.isArray(note?.favorites) ? note.favorites : note?.favorite ? [note.favorite] : [];
  return [...new Set(raw.filter(Boolean))].slice(0, FAVORITES_MAX);
}

/** Pone un libro en un puesto. Si ya estaba en otro, se intercambian: nunca sale dos veces. */
export function placeFavorite(list, id, slot) {
  const next = [...list];
  const at = next.indexOf(id);
  if (at >= 0) {
    if (slot >= next.length) return next;
    [next[at], next[slot]] = [next[slot], next[at]];
    return next;
  }
  if (slot < next.length) next[slot] = id;
  else next.push(id);
  return next.slice(0, FAVORITES_MAX);
}

export function moveFavorite(list, index, by) {
  const to = index + by;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

export const dropFavorite = (list, id) => list.filter((x) => x !== id);
export const monthOf = (date = new Date()) => dayKey(date).slice(0, 7);

const realDay = (key) => DAY.test(key) && dayKey(parseDay(key)) === key;

/** Día local (`AAAA-MM-DD`) de una finalización, o `null` si falta o no es una fecha válida: nunca se adivina. */
export function finishDay(value) {
  if (typeof value !== 'string' || !value) return null;
  if (DAY.test(value)) return realDay(value) ? value : null;
  const dayOnly = DAY_ONLY_ISO.exec(value);
  if (dayOnly) return realDay(dayOnly[1]) ? dayOnly[1] : null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dayKey(date);
}

/** Ciclos de lectura terminados de un libro. */
function cycles(book) {
  const past = Array.isArray(book.pastReads) ? book.pastReads.map((r) => r?.finishedAt ?? null) : [];
  return book.status === 'read' ? [...past, book.finishedAt ?? null] : past;
}

export function shiftMonth(month, by) {
  const [y, m] = month.split('-').map(Number);
  return monthOf(new Date(y, m - 1 + by, 1));
}

const validTotal = (n) => (Number.isFinite(n) && n > 0 ? n : null);

/** Páginas del mes: los avances positivos, y los porcentajes solo si hay total. `unknown` cuenta los que no se pueden convertir. */
function pagesOf(entries, byId) {
  let exact = 0;
  let converted = 0;
  let unknown = 0;
  for (const e of entries) {
    if (e.kind === 'correction') continue;
    if (Number.isFinite(e.pages) && e.pages > 0) {
      exact += e.pages;
      continue;
    }
    if (e.unit === 'percent' && e.delta > 0) {
      const total = validTotal(e.total) ?? validTotal(byId.get(e.bookId)?.pageCount);
      if (total) converted += (e.delta * total) / 100;
      else unknown += 1;
    } else if (e.delta == null && (e.to != null || e.active)) {
      // Una posición sin otra anterior: se sabe dónde ibas, no cuánto avanzaste
      unknown += 1;
    }
  }
  return { pages: exact + Math.round(converted), converted: Math.round(converted), unknown };
}

/**
 * Resumen de un mes (`AAAA-MM`). `notes` es `progress.monthNotes`.
 * `finished`: una entrada por libro, con `count` lecturas ese mes; `finishedCount` es la suma de lecturas.
 * `podium`: los elegidos que siguen siendo válidos, en orden; `rest`: los demás terminados, sin repetir ninguno. Nunca se elige nada solo.
 * `favoriteLost`: algún elegido ya no se terminó este mes: sale del podio y lo que guardó la persona no se borra hasta que vuelva a editarlo.
 */
export function monthSummary({ books = [], log = [], notes = {} }, month, today = new Date()) {
  const byId = new Map(books.map((b) => [b.id, b]));
  const finished = [];
  const undated = [];
  for (const book of books) {
    let count = 0;
    let last = '';
    let missing = false;
    for (const value of cycles(book)) {
      const day = finishDay(value);
      if (!day) missing = true;
      else if (day.slice(0, 7) === month) {
        count += 1;
        if (day > last) last = day;
      }
    }
    if (missing) undated.push(book);
    if (count) finished.push({ book, count, last });
  }
  finished.sort((a, b) => a.last.localeCompare(b.last) || a.book.title.localeCompare(b.book.title, 'es'));
  const entries = log.filter((e) => typeof e.date === 'string' && realDay(e.date) && e.date.slice(0, 7) === month && byId.has(e.bookId));
  const { pages, converted, unknown } = pagesOf(entries, byId);
  const days = new Set(entries.filter(isActive).map((e) => e.date)).size;
  const note = notes?.[month] ?? {};
  const chosen = noteFavorites(note);
  const podium = chosen.map((id) => finished.find((f) => f.book.id === id)).filter(Boolean);
  const inPodium = new Set(podium.map((p) => p.book.id));
  return {
    month,
    current: month === monthOf(today),
    finished,
    finishedCount: finished.reduce((n, f) => n + f.count, 0),
    pages,
    converted,
    unknown,
    days,
    podium,
    rest: finished.filter((f) => !inPodium.has(f.book.id)),
    favorite: podium[0]?.book ?? null,
    favoriteLost: podium.length < chosen.length,
    quote: typeof note.quote === 'string' ? note.quote : '',
    undated,
    hasActivity: finished.length > 0 || entries.some((e) => e.kind !== 'correction'),
  };
}

/** Lo que se guarda: sin campos vacíos y con la frase recortada. */
export function cleanNote(previous = {}, patch = {}) {
  const next = { ...previous, ...patch };
  const quote = String(next.quote ?? '').slice(0, NOTE_MAX);
  const favorites = noteFavorites('favorites' in patch ? patch : previous);
  return { ...(favorites.length ? { favorites } : null), ...(quote.trim() ? { quote } : null) };
}

/** Las portadas de un mes, para tenerlas listas antes de enseñarlo. Si los datos fallan, ninguna: quien pinta ya mostrará el error. */
export function monthCovers(data, month, limit = 12) {
  try {
    return monthSummary(data, month)
      .finished.slice(0, limit)
      .map((f) => f.book.cover);
  } catch {
    return [];
  }
}

/** Reparto de la exportación: con podio, hasta 6 libros más en la primera tarjeta; sin él, hasta 9; en las siguientes, hasta 9. Cada libro, una vez. */
export function cardPlan(rest, withPodium = false, first = withPodium ? 6 : 9, size = 9) {
  const pages = [rest.slice(0, first)];
  for (let i = first; i < rest.length; i += size) pages.push(rest.slice(i, i + size));
  return pages;
}
