// Serializar el estado sin rehacer cada libro. Los libros son inmutables (el reducer crea uno nuevo al cambiarlo), así que
// el texto de cada objeto vale mientras ese objeto exista. El resultado es idéntico al de JSON.stringify.

const bookText = new WeakMap();
/** Libros cuyo texto se ha tenido que rehacer en la serialización en curso. */
let rebuilt = 0;

/** Lo que han costado las últimas serializaciones y escrituras, para el medidor del piloto. Solo números, nunca datos. */
export const persistLog = [];
const LOG_MAX = 40;
export function logPersist(entry) {
  persistLog.push(entry);
  if (persistLog.length > LOG_MAX) persistLog.shift();
}
const SLICE = 250;
const IDLE_FALLBACK_MS = 800;

function textOf(book) {
  if (book === null || typeof book !== 'object') return JSON.stringify(book) ?? 'null';
  let text = bookText.get(book);
  if (text === undefined) {
    rebuilt += 1;
    text = JSON.stringify(book) ?? 'null';
    bookText.set(book, text);
  }
  return text;
}

export function serializeState(state) {
  const started = performance.now();
  rebuilt = 0;
  const parts = [];
  for (const key of Object.keys(state)) {
    const value = state[key];
    const text = key === 'books' && Array.isArray(value) ? `[${value.map(textOf).join(',')}]` : JSON.stringify(value);
    if (text !== undefined) parts.push(`${JSON.stringify(key)}:${text}`);
  }
  const text = `{${parts.join(',')}}`;
  const books = Array.isArray(state.books) ? state.books.length : 0;
  logPersist({ kind: 'serializar', at: started, ms: performance.now() - started, books, rebuilt, chars: text.length });
  return text;
}

/**
 * Prepara el texto de los libros a trozos, en reposo, y avisa al terminar. Devuelve cómo cancelarlo.
 * Safari no tiene requestIdleCallback: allí espera un momento fijo.
 */
export function warmSerialization(state, done) {
  const books = Array.isArray(state.books) ? state.books : [];
  let cancelled = false;
  let timer = null;
  let index = 0;
  const step = () => {
    if (cancelled) return;
    const end = Math.min(index + SLICE, books.length);
    for (; index < end; index += 1) textOf(books[index]);
    if (index < books.length) timer = setTimeout(step, 0);
    else done();
  };
  const idle = typeof requestIdleCallback === 'function' ? requestIdleCallback(step, { timeout: 2000 }) : null;
  if (idle === null) timer = setTimeout(step, IDLE_FALLBACK_MS);
  return () => {
    cancelled = true;
    if (idle !== null) cancelIdleCallback(idle);
    clearTimeout(timer);
  };
}
