// La caché de texto por libro solo vale si la salida es idéntica a JSON.stringify y ninguna acción cambia un libro en sitio.
import { describe, expect, it, vi } from 'vitest';
import { serializeState, warmSerialization } from '../serialize';
import { hydrate, reducer } from '../useLibrary.jsx';

const book = (id, extra = {}) => ({ id, title: `Título "${id}" ñ\n`, author: 'Autora', status: 'reading', totalPages: 300, currentPage: 10, ...extra });
const base = () => hydrate({ version: 99, books: [book('a'), book('b', { status: 'read' }), book('c', { status: 'pending' })] });

describe('serializeState', () => {
  it('da exactamente lo mismo que JSON.stringify', () => {
    const state = base();
    expect(serializeState(state)).toBe(JSON.stringify(state));
    expect(serializeState(state)).toBe(JSON.stringify(state));
  });

  it('respeta las claves sin valor y los huecos, como JSON.stringify', () => {
    const state = { version: 1, nada: undefined, nulo: null, fn: () => 1, books: [{ id: 'a', x: undefined }, null, undefined, 3], z: [undefined] };
    expect(serializeState(state)).toBe(JSON.stringify(state));
    expect(serializeState({ books: {} })).toBe(JSON.stringify({ books: {} }));
    expect(serializeState({})).toBe('{}');
  });

  it('sigue igual tras cada acción: ninguna modifica un libro en sitio', () => {
    let state = base();
    const steps = [
      { type: 'addBook', book: book('d') },
      { type: 'updateBook', id: 'a', patch: { title: 'Otro', rating: 4 } },
      { type: 'setPage', id: 'a', page: 50 },
      { type: 'setTracking', id: 'a', unit: 'percent' },
      { type: 'moveBook', id: 'b', status: 'reading', beforeId: 'a' },
      { type: 'moveBook', id: 'a', status: 'reading', beforeId: null },
      { type: 'addQuote', id: 'a', quote: { text: 'Una cita', page: 3 } },
      { type: 'settings', patch: { soundOn: false } },
      { type: 'pomodoro', minutes: 25, drink: 'te' },
      { type: 'removeBook', id: 'c' },
    ];
    serializeState(state);
    for (const action of steps) {
      state = reducer(state, action);
      expect(serializeState(state), action.type).toBe(JSON.stringify(state));
    }
  });

  it('registrar y revertir una lectura deja cada libro como estaba', () => {
    const start = base();
    const before = start.books.find((b) => b.id === 'a');
    const entry = { id: 's1', bookId: 'a', pagesRead: 20, fromPage: 10, toPage: 30, date: '2026-11-06', at: 1 };
    serializeState(start);
    const logged = reducer(start, { type: 'logReading', entry, position: 30 });
    expect(serializeState(logged)).toBe(JSON.stringify(logged));
    const reverted = reducer(logged, { type: 'revertLog', entryId: 's1', book: before, figures: start.progress.figures });
    expect(serializeState(reverted)).toBe(JSON.stringify(reverted));
    expect(reverted.books.find((b) => b.id === 'a')).toBe(before);
  });
});

describe('warmSerialization', () => {
  it('avisa al terminar y se puede cancelar', () => {
    vi.useFakeTimers();
    const state = { books: Array.from({ length: 600 }, (_, i) => ({ id: i })) };
    const done = vi.fn();
    warmSerialization(state, done);
    vi.runAllTimers();
    expect(done).toHaveBeenCalledTimes(1);
    const never = vi.fn();
    const cancel = warmSerialization(state, never);
    cancel();
    vi.runAllTimers();
    expect(never).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
