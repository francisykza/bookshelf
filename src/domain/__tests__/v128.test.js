// Pruebas de la 1.28.0 (SPEC §22): biblioteca completa y búsqueda, selector de lecturas activas, transición a
// terminado sin duplicados y valoración explícita. Son las condiciones que pueden perder o duplicar información.
import { describe, expect, it } from 'vitest';
import { completesReading, createBook, normalizeRating } from '../books';
import { initialReadingOrder, readingChoices } from '../bookPicker';
import { EMPTY_TEXT, activeReadings, filterLibrary, finishedBooks, libraryEmptyState, pendingBooks } from '../library';
import { buildEntry, groupByDay } from '../reading';
import { placeAnnotation } from '../../scene/guidePlacement';
import { hydrate, reducer } from '../../state/useLibrary';

const book = (id, status, title, author = 'Autora', extra = {}) => ({ ...createBook({ title, author, ...extra }), id, status });
const lib = [
  book('1', 'want', 'El Nombre del Viento', 'Patrick Rothfuss', { isbn: '9788401352836' }),
  book('2', 'reading', 'Canción de Aquiles', 'Madeline Miller'),
  book('3', 'read', 'Circe', 'Madeline Miller'),
  book('4', 'reading', 'Proyecto Hail Mary', 'Andy Weir'),
];

describe('1 · la librería parte de la biblioteca completa', () => {
  it('incluye todos los estados; los selectores separados no se mezclan', () => {
    expect(filterLibrary(lib).map((b) => b.id)).toEqual(['1', '2', '3', '4']);
    expect(activeReadings(lib).map((b) => b.id)).toEqual(['2', '4']);
    expect(pendingBooks(lib).map((b) => b.id)).toEqual(['1']);
    expect(finishedBooks(lib).map((b) => b.id)).toEqual(['3']);
  });
});

describe('2 · búsqueda con filtro de estado', () => {
  it('título o autor, con o sin tildes, mayúsculas y espacios sobrantes', () => {
    expect(filterLibrary(lib, { query: '  cancion  ' }).map((b) => b.id)).toEqual(['2']);
    expect(filterLibrary(lib, { query: 'CANCIÓN de aquiles' }).map((b) => b.id)).toEqual(['2']);
    expect(filterLibrary(lib, { query: 'miller' }).map((b) => b.id)).toEqual(['2', '3']);
    expect(filterLibrary(lib, { query: '9788401352836' }).map((b) => b.id)).toEqual(['1']);
  });

  it('el filtro y la búsqueda se aplican juntos', () => {
    expect(filterLibrary(lib, { status: 'read', query: 'miller' }).map((b) => b.id)).toEqual(['3']);
    expect(filterLibrary(lib, { status: 'want', query: 'miller' })).toEqual([]);
  });

  it('estados vacíos diferenciados y ninguno mientras carga', () => {
    expect(libraryEmptyState({ total: 0, shown: 0 })).toBe('library');
    expect(libraryEmptyState({ total: 4, shown: 0, status: 'want' })).toBe('filter');
    expect(libraryEmptyState({ total: 4, shown: 0, query: 'tolkien' })).toBe('search');
    expect(libraryEmptyState({ total: 0, shown: 0, loading: true })).toBe('loading');
    expect(libraryEmptyState({ total: 4, shown: 2 })).toBeNull();
    expect(EMPTY_TEXT.search).toBe('No encontramos ese libro en tu biblioteca');
  });
});

describe('3–4 · calendario: nuevos registros solo con lecturas activas; el historial se conserva', () => {
  it('el selector de un registro nuevo devuelve solo lecturas activas', () => {
    expect(readingChoices(lib, initialReadingOrder(lib, '4')).map((b) => b.id)).toEqual(['4', '2']);
    expect(readingChoices(lib.filter((b) => b.status !== 'reading'), [])).toEqual([]);
  });

  it('los registros de libros terminados siguen en el historial', () => {
    const log = [{ id: 's1', bookId: '3', date: '2026-10-01', kind: 'read', unit: 'pages', pages: 30, createdAt: '2026-10-01T10:00:00Z' }];
    expect(groupByDay(log, lib)['2026-10-01'][0].book.id).toBe('3');
  });
});

describe('5–6 · transición real a terminado', () => {
  const paged = book('p', 'reading', 'Paginado', 'A', { pageCount: 420, currentPage: 400, trackBy: 'pages' });
  it('419/420 no termina; 420/420 sí (nunca por el porcentaje redondeado)', () => {
    const at419 = buildEntry(paged, [], { date: '2026-10-24', mode: 'page', text: '419', today: '2026-10-24' });
    const at420 = buildEntry(paged, [], { date: '2026-10-24', mode: 'page', text: '420', today: '2026-10-24' });
    expect(completesReading(paged, at419.position)).toBe(false);
    expect(completesReading(paged, at420.position)).toBe(true);
    // Un libro ya terminado no «vuelve a terminar»
    expect(completesReading({ ...paged, status: 'read', currentPage: 420 }, 420)).toBe(false);
  });

  it('un ebook pasa de 99 a 100 sin páginas ficticias', () => {
    const ebook = book('e', 'reading', 'Ebook', 'A', { trackBy: 'percent', currentPercent: 99, pageCount: null, editionType: 'kindle' });
    const r = buildEntry(ebook, [], { date: '2026-10-24', mode: 'percent', text: '100', today: '2026-10-24' });
    expect(r.position).toBe(100);
    expect(completesReading(ebook, r.position)).toBe(true);
    const s = reducer(hydrate({ books: [ebook], progress: { readingLog: [] } }), { type: 'logReading', entry: r.entry, position: r.position });
    const after = s.books.find((b) => b.id === 'e');
    expect(after.status).toBe('read');
    expect(after.pageCount ?? null).toBeNull();
  });
});

describe('7–8 · doble toque y fallo al guardar', () => {
  const paged = book('p', 'reading', 'Paginado', 'A', { pageCount: 420, currentPage: 400, trackBy: 'pages' });
  const start = hydrate({ books: [paged], progress: { readingLog: [] } });
  const r = buildEntry(paged, [], { date: '2026-10-24', mode: 'page', text: '420', today: '2026-10-24', id: 's-op-1' });

  it('el mismo id de operación no duplica sesión, finalización ni sellos', () => {
    const once = reducer(start, { type: 'logReading', entry: r.entry, position: r.position });
    const twice = reducer(once, { type: 'logReading', entry: r.entry, position: r.position });
    expect(twice).toBe(once);
    expect(twice.progress.readingLog.filter((e) => e.id === 's-op-1')).toHaveLength(1);
    expect(twice.progress.figures).toBe(once.progress.figures);
  });

  it('si el guardado falla, el registro se deshace: el libro no queda terminado', () => {
    const before = start.books.find((b) => b.id === 'p');
    const logged = reducer(start, { type: 'logReading', entry: r.entry, position: r.position });
    expect(logged.books.find((b) => b.id === 'p').status).toBe('read');
    const reverted = reducer(logged, { type: 'revertLog', entryId: 's-op-1', book: before, figures: start.progress.figures });
    expect(reverted.books.find((b) => b.id === 'p')).toEqual(before);
    expect(reverted.progress.readingLog.some((e) => e.id === 's-op-1')).toBe(false);
    expect(reverted.progress.figures).toBe(start.progress.figures);
  });
});

describe('9–11 · hidratar, «Ahora no» y la valoración', () => {
  it('hidratar un libro terminado no produce ninguna orden de reseña (no hay estado de «reseña pendiente»)', () => {
    const s = hydrate({ books: [book('3', 'read', 'Circe')], progress: { readingLog: [] } });
    expect(JSON.stringify(s)).not.toMatch(/review(Open|Pending)/i);
    expect(s.books[0].status).toBe('read');
  });

  it('cerrar la reseña sin guardar conserva la finalización (no hay acción que la deshaga)', () => {
    const s = hydrate({ books: [book('3', 'read', 'Circe')], progress: { readingLog: [] } });
    // «Ahora no» no despacha nada: el estado sigue igual
    expect(s.books[0].status).toBe('read');
  });

  it('3,75 se conserva al guardar y cargar; sin valorar es null explícito, no cero', () => {
    const s = reducer(hydrate({ books: [book('3', 'read', 'Circe')], progress: { readingLog: [] } }), { type: 'updateBook', id: '3', patch: { rating: 3.75, review: 'Preciosa' } });
    const again = hydrate(JSON.parse(JSON.stringify(s)));
    expect(again.books[0].rating).toBe(3.75);
    expect(again.books[0].review).toBe('Preciosa');
    expect(normalizeRating(0)).toBeNull();
    expect(createBook({ title: 'x' }).rating).toBeNull();
  });
});

describe('temporizador junto al borde: márgenes mínimos', () => {
  it('se limita a max(12 px, área segura) por cada lado', () => {
    expect(placeAnnotation({ w: 390, h: 844 }, { x: 385, y: 560 }, { w: 80, h: 44 }, { top: 0, right: 0, bottom: 0, left: 0 })).toEqual({ x: 298, y: 504 });
    expect(placeAnnotation({ w: 844, h: 390 }, { x: 840, y: 20 }, { w: 80, h: 44 }, { top: 0, right: 47, bottom: 21, left: 47 })).toEqual({ x: 717, y: 12 });
  });
});

describe('1.29.0 · texturas de lomo sin deformaciones extremas', async () => {
  const { MAX_STRETCH, spineArtSize } = await import('../spineArt');
  it('estira como mucho 1,35 y recorta el resto, siempre cubriendo el lomo', () => {
    const ratio = 0.19;
    for (const [w, h] of [[5, 100], [12, 100], [19, 100], [24, 100], [40, 100]]) {
      const s = spineArtSize(w, h, ratio);
      expect(s.w).toBeGreaterThanOrEqual(w - 1e-9);
      expect(s.h).toBeGreaterThanOrEqual(h - 1e-9);
      const stretch = s.w / s.h / ratio;
      expect(stretch).toBeLessThanOrEqual(MAX_STRETCH + 1e-9);
      expect(stretch).toBeGreaterThanOrEqual(1 / MAX_STRETCH - 1e-9);
    }
    expect(spineArtSize(19, 100, ratio)).toEqual({ w: 19, h: 100 });
  });
});
