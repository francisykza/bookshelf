// 1.58 (SPEC §56): visita a un rincón compartido. Composición de libros públicos, sin duplicados, sin fusionar por
// título, respetando la visibilidad; lectura actual solo con su título; reseñas solo por obra; y la vuelta paso a paso.
import { describe, expect, it } from 'vitest';
import { safeParent } from '../../../domain/navigation';
import { currentTitle, reviewsFor, sharedBooks } from '../visit';
import { HOUSE_WINDOW, ROOM_SHELF, shelfSpines } from '../visitScene';

const ref = (id, title, author = 'Autora', extra = {}) => ({ id, title, author, cover: '', ...extra });
const OWNER = 'bruno';

describe('libros compartidos de una visita', () => {
  const corner = {
    visible: true,
    featured_books: [ref('b1', 'Cuarta ala'), ref('b2', 'El principito'), ref('b3', 'Una vida pequeña'), ref('b9', 'No cabe: solo tres')],
    signature_books: [ref('b2', 'El principito', 'Autora', { phrase: 'Mi primer libro' }), ref('b5', 'La sombra del viento')],
    last_book: ref('b4', 'Circe'),
    next_book: ref('b2', 'El principito'),
    memories: [{ id: 'm1', object: 'farol', book: ref('b6', 'La isla del tesoro') }],
    show_current: true,
    current_title: 'Alas de hierro',
  };
  const collections = [
    { id: 'c1', title: 'Días de lluvia', visible: true, books: [ref('c1', 'Rebeca'), ref('b4', 'Circe')] },
    { id: 'c2', title: 'Privada', visible: false, books: [ref('x1', 'Diario secreto')] },
  ];

  it('destacados primero y en su orden (como mucho tres), luego el resto, sin duplicados', () => {
    const { featured, all } = sharedBooks({ ownerId: OWNER, corner, collections });
    expect(featured.map((f) => f.ref.title)).toEqual(['Cuarta ala', 'El principito', 'Una vida pequeña']);
    expect(all.map((f) => f.ref.title)).toEqual(['Cuarta ala', 'El principito', 'Una vida pequeña', 'La sombra del viento', 'Circe', 'La isla del tesoro', 'Rebeca']);
    // El mismo libro desde varios orígenes: una sola entrada con todos ellos y su frase
    const principito = all.find((f) => f.ref.title === 'El principito');
    expect(principito.origins).toEqual(['Destacado en su rincón', 'Le representa', 'Su próxima lectura']);
    expect(principito.phrase).toBe('Mi primer libro');
    expect(all.find((f) => f.ref.title === 'Circe').origins).toEqual(['Su última lectura', 'En su colección «Días de lluvia»']);
    // La colección oculta no aparece
    expect(all.some((f) => f.ref.title === 'Diario secreto')).toBe(false);
  });

  it('las claves llevan el propietario: los ids locales de dos personas no se mezclan', () => {
    const a = sharedBooks({ ownerId: 'ana', corner: { visible: true, featured_books: [ref('b1', 'Libro de Ana')] } });
    const b = sharedBooks({ ownerId: 'bruno', corner: { visible: true, featured_books: [ref('b1', 'Libro de Bruno')] } });
    expect(a.all[0].key).toBe('ana:b1');
    expect(b.all[0].key).toBe('bruno:b1');
  });

  it('sin id no se fusiona por parecerse el título', () => {
    const { all } = sharedBooks({ ownerId: OWNER, corner: { visible: true, featured_books: [{ title: 'Circe', author: 'M. Miller' }], signature_books: [{ title: 'Circe', author: 'Madeline Miller' }] } });
    expect(all).toHaveLength(2);
  });

  it('rincón oculto: nada de su rincón; las colecciones visibles sí', () => {
    const { featured, all } = sharedBooks({ ownerId: OWNER, corner: { ...corner, visible: false }, collections });
    expect(featured).toEqual([]);
    expect(all.map((f) => f.ref.title)).toEqual(['Rebeca', 'Circe']);
    expect(currentTitle({ ...corner, visible: false })).toBe(null);
  });

  it('lectura actual: solo el título, y solo si la enseña', () => {
    expect(currentTitle(corner)).toBe('Alas de hierro');
    expect(currentTitle({ ...corner, show_current: false })).toBe(null);
    expect(currentTitle(null)).toBe(null);
  });

  it('reseñas: solo por obra, nunca por título parecido', () => {
    const reviews = [{ id: 'r1', work_id: 'w1', work: { title: 'Circe' } }];
    expect(reviewsFor(reviews, ref('b4', 'Circe'))).toEqual([]);
    expect(reviewsFor(reviews, ref('b4', 'Circe', 'A', { work_id: 'w1' }))).toHaveLength(1);
  });
});

describe('escena y navegación', () => {
  it('zonas normalizadas dentro de la imagen y como mucho tres lomos sobre la balda', () => {
    for (const z of [HOUSE_WINDOW, ROOM_SHELF]) {
      expect(z.x0).toBeGreaterThanOrEqual(0);
      expect(z.x1).toBeLessThanOrEqual(1);
      expect(z.y1).toBeLessThanOrEqual(1);
    }
    expect(shelfSpines(0)).toEqual([]);
    expect(shelfSpines(5)).toHaveLength(3);
    // Los lomos quedan dentro del mueble (x ≤ 0,23 del ancho)
    for (const s of shelfSpines(3)) expect(s.box.left + s.box.width).toBeLessThan(ROOM_SHELF.x1);
  });

  it('Atrás sin historial (recarga): libro → habitación → casa → «Lectores»', () => {
    const book = { view: 'room', panel: { type: 'visit', id: 'u', section: 'habitacion', select: 'u:b1' } };
    expect(safeParent(book)).toEqual({ view: 'room', panel: { type: 'visit', id: 'u', section: 'habitacion' } });
    expect(safeParent(safeParent(book))).toEqual({ view: 'room', panel: { type: 'visit', id: 'u' } });
    expect(safeParent({ view: 'room', panel: { type: 'visit', id: 'u' } })).toEqual({ view: 'room', panel: { type: 'social', tab: 'lectores' } });
  });
});
