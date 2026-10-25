// Diario de un libro (SPEC §27.7): entradas fechadas construidas solo con datos que ya existen.
import { dayKey } from './dates';
import { bookLog } from './reading';

const validIso = (iso) => Boolean(iso) && !Number.isNaN(new Date(iso).getTime());

/**
 * Entradas del diario a partir de los datos existentes: sesiones del registro de lectura, citas subrayadas (por
 * su fecha de creación, si la tienen) y la reseña al terminar. Agrupadas por día, de la más reciente a la más
 * antigua; lo que no tiene fecha fiable va al final, sin inventarla.
 */
export function journalDays(book, log) {
  const items = [];
  bookLog(log, book.id).forEach((e) => items.push({ kind: 'session', key: e.date, at: e.createdAt || e.date, id: e.id, entry: e }));
  book.quotes.forEach((q) => items.push({ kind: 'quote', key: validIso(q.createdAt) ? dayKey(new Date(q.createdAt)) : null, at: q.createdAt || '', id: q.id, quote: q }));
  if (book.review?.trim() && book.status === 'read') {
    items.push({ kind: 'review', key: validIso(book.finishedAt) ? dayKey(new Date(book.finishedAt)) : null, at: book.finishedAt || '', id: 'review' });
  }
  const days = new Map();
  items
    .sort((a, b) => (b.key ?? '').localeCompare(a.key ?? '') || String(b.at).localeCompare(String(a.at)))
    .forEach((item) => {
      const k = item.key ?? '';
      if (!days.has(k)) days.set(k, []);
      days.get(k).push(item);
    });
  return [...days.entries()].map(([key, list]) => ({ key: key || null, items: list }));
}
