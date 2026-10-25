// 1.35.0 (SPEC §28.6, §28.10): diario general con datos reales y lógica del rincón ilustrado.
import { describe, expect, it } from 'vitest';
import { latestEntries, weekOf } from '../diary';
import { collectionPayload, cornerExtras, inLibrary, pendingFromRef, publicBookRef, savedCollection, visibleDistinctions } from '../../features/social/huellas';
import { createBook } from '../books';

const book = (id, over = {}) => ({ id, title: `Libro ${id}`, author: 'Autora', cover: '', quotes: [], review: 'privada', currentPage: 40, status: 'read', ...over });

describe('diario general', () => {
  it('la semana va de lunes a domingo en fechas locales', () => {
    expect(weekOf('2026-10-25')).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
    expect(weekOf('2026-10-19')[0]).toBe('2026-10-19');
    // Cambio de mes y de horario de verano (25-10-2026 en Europa) sin saltarse días
    expect(weekOf('2026-11-01')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  });

  it('últimas entradas: sesiones activas y notas con fecha fiable, sin inventar ni mezclar libros borrados', () => {
    const books = [book('a', { quotes: [{ id: 'q1', text: 'Frase', color: 'yellow', createdAt: '2026-10-24T18:00:00.000Z' }, { id: 'q2', text: 'Sin fecha', color: 'yellow', createdAt: 'nunca' }] })];
    const log = [
      { id: 's1', bookId: 'a', date: '2026-10-23', kind: 'read', pages: 10, active: true, createdAt: '2026-10-23T20:00:00.000Z' },
      { id: 's2', bookId: 'a', date: '2026-10-25', kind: 'correction', pages: 0, createdAt: '2026-10-25T09:00:00.000Z' },
      { id: 's3', bookId: 'borrado', date: '2026-10-25', kind: 'read', pages: 5, active: true, createdAt: '2026-10-25T10:00:00.000Z' },
    ];
    const latest = latestEntries(books, log);
    expect(latest.map((e) => (e.kind === 'note' ? e.quote.id : e.entry.id))).toEqual(['q1', 's1']);
  });
});

describe('rincón ilustrado', () => {
  const books = [book('a1'), book('a2', { status: 'want' }), book('a3')];

  it('la referencia pública de un libro nunca lleva notas, citas, reseña ni progreso', () => {
    const ref = publicBookRef(books[0], '  Me cambió  ');
    expect(ref).toEqual({ id: 'a1', title: 'Libro a1', author: 'Autora', cover: '', phrase: 'Me cambió' });
    expect(publicBookRef(books[0], 'x'.repeat(400)).phrase).toHaveLength(160);
  });

  it('solo libros que siguen en la biblioteca, objetos del catálogo y límites de cantidad', () => {
    const x = cornerExtras({
      books,
      scene: 'tormenta',
      lastId: 'a1',
      nextId: 'borrado',
      signature: ['a1', 'a2', 'a3', 'a1', 'a2', 'a3'].map((id) => ({ id, phrase: '' })),
      memories: [
        { object: 'farol', bookId: 'a1', dedication: '  Para ti  ' },
        { object: 'cohete', bookId: 'a1' },
        { object: 'mapa', bookId: 'borrado' },
        { object: 'planta', bookId: 'a2' },
        { object: 'tintero', bookId: 'a3' },
        { object: 'barquito', bookId: 'a3' },
      ],
    });
    expect(x.scene).toBe('dia');
    expect(x.last_book.id).toBe('a1');
    expect(x.next_book).toBeNull();
    expect(x.signature_books).toHaveLength(5);
    expect(x.memories.map((m) => m.object)).toEqual(['farol', 'planta', 'tintero']);
    expect(x.memories[0].dedication).toBe('Para ti');
    expect(x.memories[1]).not.toHaveProperty('dedication');
  });

  it('colección: título y al menos un libro propio, hasta 12', () => {
    expect(collectionPayload({ title: ' ', dedication: '', items: [], books, visible: false }).errors).toEqual({ title: 'Ponle un título.', books: 'Elige al menos un libro.' });
    const ok = collectionPayload({ title: 'Lluvia', dedication: 'Con manta', items: [{ id: 'a1', phrase: 'Empieza aquí' }, { id: 'ajeno' }], books, visible: true });
    expect(ok.errors).toEqual({});
    expect(ok.payload.books).toEqual([{ id: 'a1', title: 'Libro a1', author: 'Autora', cover: '', phrase: 'Empieza aquí' }]);
  });

  it('añadir a pendientes guarda la procedencia en privado; guardar una colección no añade libros', () => {
    const b = createBook(pendingFromRef({ id: 'x', title: 'Rebeca', author: 'Daphne du Maurier', cover: '' }, { kind: 'collection', ownerAlias: 'Bruno', collectionTitle: 'Lluvia', id: 'c1' }, '2026-10-25T10:00:00.000Z'));
    expect(b).toMatchObject({ status: 'want', pageCount: null, trackBy: 'percent', savedFrom: { kind: 'collection', ownerAlias: 'Bruno', collectionTitle: 'Lluvia', id: 'c1' } });
    expect(inLibrary([{ title: 'Rebéca ', author: 'daphne du maurier' }], { title: 'rebeca', author: 'Daphne du Maurier' })).toBe(true);
    const saved = savedCollection({ id: 'c1', title: 'Lluvia', books: [{ id: 'x', title: 'Rebeca', author: 'D', cover: '', extra: 'no' }] }, 'Bruno', 'hoy');
    expect(saved.books[0]).not.toHaveProperty('extra');
    expect(saved).not.toHaveProperty('addedToPending');
  });

  it('distinciones: solo las asignadas; moderación sale del rol real; nada para quien no tiene', () => {
    expect(visibleDistinctions([], false)).toEqual([]);
    expect(visibleDistinctions([{ kind: 'inventada' }], false)).toEqual([]);
    expect(visibleDistinctions([{ kind: 'fundadora' }], true).map((d) => d.kind)).toEqual(['moderacion', 'fundadora']);
  });
});
