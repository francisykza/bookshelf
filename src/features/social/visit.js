// Visita a un rincón compartido (SPEC §56): lógica pura, sin React ni red. Solo se representa lo que la persona ya ha
// decidido compartir y devuelven los servicios autorizados: libros destacados del rincón, los que le representan, última
// y próxima lectura, los de sus recuerdos y los de sus colecciones visibles. Nunca su biblioteca privada.

/** Etiquetas visibles de cada origen. */
export const ORIGINS = {
  featured: 'Destacado en su rincón',
  signature: 'Le representa',
  last: 'Su última lectura',
  next: 'Su próxima lectura',
  memory: 'Un recuerdo de su rincón',
  collection: 'En su colección',
};

/**
 * Libros compartidos de una persona, sin duplicados: los destacados primero y en su orden, después el resto. La clave es
 * `propietario:id` (los ids son locales de cada persona: nunca se mezclan los de dos propietarios) y, si una referencia no
 * trae id, una clave propia de su origen (no se fusiona con otra por parecerse el título). Respeta la visibilidad del
 * rincón (`corner.visible`) y de cada colección. Devuelve `{ featured, all }`.
 */
export function sharedBooks({ ownerId, corner, collections = [] }) {
  const byKey = new Map();
  const add = (ref, origin, extra = {}) => {
    if (!ref || !String(ref.title ?? '').trim()) return null;
    const key = ref.id ? `${ownerId}:${ref.id}` : `${ownerId}:${origin}:${extra.slot ?? byKey.size}`;
    const item = byKey.get(key) ?? { key, ref: { id: ref.id ?? null, title: ref.title, author: ref.author ?? '', cover: ref.cover ?? '' }, origins: [], phrase: '' };
    const label = origin === 'collection' ? `${ORIGINS.collection} «${extra.collection}»` : ORIGINS[origin];
    if (!item.origins.includes(label)) item.origins.push(label);
    if (!item.phrase && ref.phrase) item.phrase = ref.phrase;
    if (ref.work_id && !item.ref.work_id) item.ref.work_id = ref.work_id;
    byKey.set(key, item);
    return item;
  };
  const featured = [];
  if (corner?.visible) {
    (corner.featured_books ?? []).slice(0, 3).forEach((b, i) => {
      const it = add(b, 'featured', { slot: `f${i}` });
      if (it && !featured.includes(it)) featured.push(it);
    });
    (corner.signature_books ?? []).forEach((b, i) => add(b, 'signature', { slot: `s${i}` }));
    add(corner.last_book, 'last', { slot: 'last' });
    add(corner.next_book, 'next', { slot: 'next' });
    (corner.memories ?? []).forEach((m, i) => add(m.book, 'memory', { slot: `m${i}` }));
  }
  collections
    .filter((c) => c.visible)
    .forEach((c) => (c.books ?? []).forEach((b, i) => add(b, 'collection', { collection: c.title, slot: `c${c.id}-${i}` })));
  return { featured, all: [...byKey.values()] };
}

/** Lo que está leyendo, solo si lo enseña: únicamente su título (sin autor, portada, páginas ni porcentaje). */
export const currentTitle = (corner) => (corner?.visible && corner.show_current && corner.current_title ? String(corner.current_title) : null);

/** Reseñas de un libro compartido: solo con una correspondencia inequívoca de obra (nunca por parecido de título). */
export const reviewsFor = (reviews, ref) => (ref?.work_id ? reviews.filter((r) => r.work_id && r.work_id === ref.work_id) : []);

/** Estado de la carga para la visita: distingue privado, no disponible, sin libros y error. */
export function visitState({ status, data }) {
  if (status !== 'ready') return status;
  if (!data?.profile) return 'unavailable';
  return 'ready';
}

const SKIP_KEY = 'bookshelf:visit-skip';
/** Preferencia de este dispositivo: entrar sin animación en próximas visitas (no toca el ambiente ni el sonido). */
export function readSkip() {
  try {
    return localStorage.getItem(SKIP_KEY) === '1';
  } catch {
    return false;
  }
}
export function writeSkip(on) {
  try {
    if (on) localStorage.setItem(SKIP_KEY, '1');
    else localStorage.removeItem(SKIP_KEY);
  } catch {
    // preferencia opcional
  }
}
