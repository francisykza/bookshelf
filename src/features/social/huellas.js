// Las historias dejan huella (SPEC §28.10): lógica pura del rincón ilustrado, los recuerdos, las colecciones y
// las distinciones. Sin React ni red. Lo público de un libro es SOLO id, título, autor, portada y una frase
// opcional; nunca notas, citas, reseña ni progreso (el servidor lo vuelve a comprobar).

export const SCENES = {
  dia: { label: 'Día', src: '/assets/profile/rincon-dia' },
  lluvia: { label: 'Lluvia', src: '/assets/profile/rincon-lluvia' },
  noche: { label: 'Noche', src: '/assets/profile/rincon-noche' },
};
export const sceneOf = (id) => (SCENES[id] ? id : 'dia');

/**
 * Coordenadas calibradas sobre `rincon-dia.png` (1536 × 1024, rejilla de 25 px; las variantes de lluvia y noche
 * comparten la composición). Porcentajes del ancho/alto de la imagen; `base` es la línea donde apoyan.
 */
export const CORNER_LAYOUT = {
  shelf: { left: 893 / 1536, right: 1472 / 1536, base: 302 / 1024, maxH: 190 / 1024 },
  niche: { left: 945 / 1536, right: 1410 / 1536, base: 652 / 1024, maxH: 235 / 1024 },
  table: { slots: [300 / 1536, 640 / 1536, 1000 / 1536], base: 890 / 1024, maxH: 190 / 1024 },
};

/** Recuerdos que se pueden exponer en la mesa (los que no tienen ilustración usan un SVG provisional). */
export const MEMORY_OBJECTS = {
  farol: { name: 'Farol', art: '/assets/memories/farol-256.webp', ratio: 256 / 498 },
  // 1.39.0: ilustraciones de /assets/bookshelf/reading-corner (scripts/prepare-bookshelf-pieces.mjs)
  barquito: { name: 'Barquito', art: '/assets/bookshelf/reading-corner/memory-sailboat.webp', ratio: 256 / 296 },
  planta: { name: 'Planta', art: '/assets/bookshelf/reading-corner/memory-potted-plant.webp', ratio: 256 / 274 },
  tintero: { name: 'Tintero', art: '/assets/bookshelf/reading-corner/memory-inkwell-feather.webp', ratio: 256 / 376 },
  mapa: { name: 'Mapa', art: '/assets/bookshelf/reading-corner/memory-rolled-map.webp', ratio: 320 / 194 },
};
export const MEMORY_IDS = Object.keys(MEMORY_OBJECTS);
export const MEMORY_MAX = 3;
export const SIGNATURE_MAX = 5;
export const PHRASE_MAX = 160;
export const DEDICATION_MAX = 200;
export const COLLECTION_MAX = 12;

/**
 * Distinciones (premios y roles visibles). Se asignan SOLO en el servidor por administración; aquí solo se
 * describen. Moderación sale de la tabla de moderadores; el resto, de `distinctions`. Ninguna concede permisos
 * en la app: los permisos los da el servidor.
 */
export const DISTINCTIONS = {
  semanal: { name: 'Lectura de la semana', mark: 'star-ribbon', art: '/assets/bookshelf/profile/badges/badge-weekly-star.webp', meaning: 'Una reseña elegida por el equipo esa semana.' },
  mensual: { name: 'Lectura del mes', mark: 'book-moon', art: '/assets/bookshelf/profile/badges/badge-monthly-book-moon.webp', meaning: 'Una reseña elegida por el equipo ese mes.' },
  moderacion: { name: 'Moderación', mark: 'sage-lantern', art: '/assets/bookshelf/profile/badges/badge-moderator-lantern.webp', meaning: 'Cuida la convivencia: revisa denuncias y puede retirar contenido.', role: true },
  creadora: { name: 'Creadora', mark: 'old-key', art: '/assets/bookshelf/profile/badges/badge-creator-key.webp', meaning: 'Persona creadora de BookShelf.', role: true },
  equipo: { name: 'Equipo', mark: 'house-nib', art: '/assets/bookshelf/profile/badges/badge-team-house-nib.webp', meaning: 'Forma parte del equipo de BookShelf.', role: true },
  fundadora: { name: 'Comunidad fundadora', mark: 'sealed-letter', art: '/assets/bookshelf/profile/badges/badge-founder-letter.webp', meaning: 'Estuvo en la comunidad desde sus primeros días.' },
};

const clip = (text, max) => String(text ?? '').trim().slice(0, max);

/** Referencia pública mínima de un libro propio. */
export function publicBookRef(book, phrase = '') {
  if (!book) return null;
  const ref = { id: book.id, title: book.title, author: book.author, cover: book.cover ?? '' };
  const p = clip(phrase, PHRASE_MAX);
  if (p) ref.phrase = p;
  return ref;
}

/**
 * Selección del rincón 1.35.0 a partir del formulario. Solo libros que siguen en la biblioteca; recuerdos con un
 * objeto del catálogo; límites de cantidad y longitud. Lo que no cumple se descarta, nunca se inventa.
 */
export function cornerExtras({ books, scene, lastId, nextId, signature = [], memories = [] }) {
  const byId = new Map(books.map((b) => [b.id, b]));
  return {
    scene: sceneOf(scene),
    last_book: publicBookRef(byId.get(lastId)),
    next_book: publicBookRef(byId.get(nextId)),
    signature_books: signature
      .filter((s) => byId.has(s.id))
      .slice(0, SIGNATURE_MAX)
      .map((s) => publicBookRef(byId.get(s.id), s.phrase)),
    memories: memories
      .filter((m) => MEMORY_OBJECTS[m.object] && byId.has(m.bookId))
      .slice(0, MEMORY_MAX)
      .map((m, i) => {
        const out = { id: m.id || `m${i + 1}`, object: m.object, book: publicBookRef(byId.get(m.bookId)) };
        const d = clip(m.dedication, DEDICATION_MAX);
        if (d) out.dedication = d;
        return out;
      }),
  };
}

/** Colección a partir de libros propios (1–12), con frase opcional por libro. */
export function collectionPayload({ title, dedication, items, books, visible }) {
  const byId = new Map(books.map((b) => [b.id, b]));
  const picked = items.filter((i) => byId.has(i.id)).slice(0, COLLECTION_MAX);
  const t = clip(title, 80);
  const errors = {};
  if (!t) errors.title = 'Ponle un título.';
  if (!picked.length) errors.books = 'Elige al menos un libro.';
  return {
    errors,
    payload: { title: t, dedication: clip(dedication, 300) || null, books: picked.map((i) => publicBookRef(byId.get(i.id), i.phrase)), visible: Boolean(visible) },
  };
}

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es')
    .trim();

/** ¿Está ya ese libro en mi biblioteca? (mismo título y autor, sin tildes ni mayúsculas) */
export const inLibrary = (books, ref) => books.some((b) => norm(b.title) === norm(ref.title) && norm(b.author) === norm(ref.author));

/**
 * Libro nuevo en Pendientes a partir de una referencia pública, con su procedencia guardada en privado (de qué
 * rincón o colección vino). No envía nada a nadie.
 */
export function pendingFromRef(ref, from, now = new Date().toISOString()) {
  return {
    title: ref.title,
    author: ref.author,
    cover: ref.cover ?? '',
    // El total de páginas de esa edición no se conoce: se registra por porcentaje hasta que lo indiques
    pageCount: null,
    status: 'want',
    source: 'community',
    savedFrom: { kind: from.kind, ownerAlias: from.ownerAlias ?? null, collectionTitle: from.collectionTitle ?? null, id: from.id ?? null, at: now },
  };
}

/** Colección guardada en privado: una copia (sin añadir sus libros a Pendientes). */
export function savedCollection(collection, ownerAlias, now = new Date().toISOString()) {
  return { id: collection.id, title: collection.title, ownerAlias, dedication: collection.dedication ?? null, books: collection.books.map(({ id, title, author, cover, phrase }) => ({ id, title, author, cover, phrase })), savedAt: now };
}

/** Distinciones visibles de alguien: las asignadas en `distinctions` + Moderación si modera. Orden estable. */
export function visibleDistinctions(rows = [], isModerator = false) {
  const kinds = rows.filter((r) => DISTINCTIONS[r.kind]);
  if (isModerator && !kinds.some((r) => r.kind === 'moderacion')) kinds.push({ kind: 'moderacion', note: null, awarded_on: null });
  const order = Object.keys(DISTINCTIONS);
  return kinds.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || String(b.awarded_on ?? '').localeCompare(String(a.awarded_on ?? '')));
}
