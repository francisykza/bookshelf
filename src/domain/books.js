// Reglas puras de los libros (SPEC §5): progreso, anatomía física y etiquetas.

export const STATUS = {
  reading: 'Leyendo ahora',
  want: 'Pendiente',
  read: 'Leído',
};

/**
 * Catálogo de ediciones (SPEC §5.3, 1.10.0). Cada una cambia el objeto físico en la balda, en los lomos
 * y al abrir el libro. `height` es el alto relativo al de una tapa dura; `cm` el grosor extra de las tapas.
 */
export const EDITIONS = {
  hardcover: { label: 'Tapa dura con sobrecubierta', short: 'Tapa dura', height: 1, cm: 0.5 },
  paperback: { label: 'Edición de bolsillo', short: 'Bolsillo', height: 0.94, cm: 0.12 },
  sprayed_edges: { label: 'Edición Especial Cantos Pintados', short: 'Cantos pintados', height: 1.02, cm: 0.5 },
  leatherbound: { label: 'Grimorio en Cuero y Oro', short: 'Cuero y oro', height: 1.05, cm: 0.7 },
  clothbound: { label: 'Clásico en Tela Estampada', short: 'Tela estampada', height: 0.98, cm: 0.45 },
  annotated: { label: 'Edición Anotada con Post-its', short: 'Anotada', height: 0.97, cm: 0.3 },
  kindle: { label: 'Kindle / E-Reader Tinta Electrónica', short: 'E-reader', height: 0.8, cm: 0 },
  audiobook: { label: 'Audiolibro (Estuche Acrílico + Cascos)', short: 'Audiolibro', height: 0.88, cm: 0 },
};

export const EDITION_IDS = Object.keys(EDITIONS);

/** Etiquetas para los selectores. */
export const FORMATS = Object.fromEntries(EDITION_IDS.map((k) => [k, EDITIONS[k].label]));

/** Diseños del canto para la edición de cantos pintados. */
export const EDGE_STYLES = {
  constellations: 'Noche estrellada y oro',
  botanical: 'Enredaderas y flores',
  dragon_fire: 'Brasas y escamas ámbar',
  watercolor: 'Acuarela mediterránea',
};

/** Formatos de versiones anteriores (campo `format`) → edición actual. */
const LEGACY_FORMATS = { hardcover: 'hardcover', paperback: 'paperback', special: 'sprayed_edges', kindle: 'kindle' };

/** Libros sin páginas de papel: el e-reader y el estuche del audiolibro. */
export const isDevice = (book) => book.editionType === 'kindle' || book.editionType === 'audiobook';

/** Duración estimada del audiolibro (≈ 1,9 min por página) si no se ha indicado. */
export const audioHours = (book) => book.audioHours || Math.max(1, Math.round((book.pageCount || 300) * 0.032));

export const QUOTE_COLORS = {
  pink: { label: 'Rosa Emoción', hex: '#f4a3b8', ink: '#9c3354' },
  yellow: { label: 'Amarillo Idea', hex: '#f7dc6f', ink: '#8a6d0a' },
  blue: { label: 'Azul Tristeza', hex: '#9cc7ec', ink: '#2b5f8c' },
  gold: { label: 'Dorado Épico', hex: '#e8b04a', ink: '#7a4f0a' },
};

/** Paleta de lomos: telas y cueros cálidos que combinan con el roble. */
const SPINE_COLORS = [
  '#7b2d26', '#2f4b3a', '#1f3a5a', '#8a5a2b', '#5b3a5e', '#a0522d', '#33524f', '#6b4423',
  '#274060', '#8c3b3b', '#4a5d23', '#3d2b4f', '#b5803a', '#2d4d6b', '#6d2e46', '#59693e',
];

export function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const spineColor = (book) => book.color || SPINE_COLORS[hash(book.id + book.title) % SPINE_COLORS.length];

export const clampPage = (book, page) => Math.max(0, Math.min(book.pageCount || 0, Math.round(page || 0)));

export function progress(book) {
  if (!book.pageCount) return 0;
  return Math.min(100, Math.round((book.currentPage / book.pageCount) * 100));
}

export function hoursLeft(book, pagesPerHour) {
  const left = Math.max(0, (book.pageCount || 0) - (book.currentPage || 0));
  return left / Math.max(1, pagesPerHour);
}

export function formatHours(hours) {
  if (hours <= 0) return 'terminado';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Grosor del lomo proporcional a las páginas reales (900 págs. = 5 × 180 págs.). */
export function spineWidth(pages, factor = 0.07, min = 10) {
  return Math.max(min, Math.round((pages || 180) * factor * 10) / 10);
}

/** Alto relativo por edición con una pequeña variación por libro, como en una balda real. */
export function spineHeight(book) {
  const base = EDITIONS[book.editionType]?.height ?? 0.94;
  // Los e-readers y los estuches son objetos fabricados: todos iguales
  if (isDevice(book)) return base;
  return base * (0.95 + (hash(book.title) % 9) / 100);
}

/**
 * Canto de las hojas según la edición: el diseño elegido en los cantos pintados, pan de oro en las
 * ediciones de cuero y tela, o `null` (papel) en el resto.
 */
export function sprayedEdge(book) {
  if (book.editionType === 'sprayed_edges') return EDGE_STYLES[book.sprayedEdgeStyle] ? book.sprayedEdgeStyle : 'constellations';
  if (book.editionType === 'leatherbound' || book.editionType === 'clothbound') return 'gilded';
  return null;
}

export const EDGE_NAMES = { ...EDGE_STYLES, gilded: 'Pan de oro' };

export function currentBook(books, settings) {
  const chosen = books.find((b) => b.id === settings.currentBookId && b.status === 'reading');
  if (chosen) return chosen;
  return [...books]
    .filter((b) => b.status === 'reading')
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0];
}

/** El pendiente más antiguo sin empezar: el favorito del Michi Juez. */
export function oldestUnstarted(books) {
  return [...books]
    .filter((b) => b.status === 'want' && !b.currentPage)
    .sort((a, b) => (a.addedAt || '').localeCompare(b.addedAt || ''))[0];
}

let counter = 0;
export const newId = (prefix = 'b') =>
  `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function createBook(data) {
  const now = new Date().toISOString();
  // `format` es el campo de versiones anteriores: se convierte en `editionType`
  const { format, editionType, sprayedEdgeStyle, ...rest } = data;
  return {
    id: newId(),
    title: 'Sin título',
    author: 'Autor desconocido',
    cover: '',
    synopsis: '',
    publishedDate: '',
    categories: [],
    pageCount: 300,
    isbn: '',
    currentPage: 0,
    status: 'want',
    rating: 0,
    favorite: false,
    quotes: [],
    review: '',
    reviewedAt: null,
    addedAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
    source: 'manual',
    ...rest,
    editionType: EDITIONS[editionType] ? editionType : LEGACY_FORMATS[format] ?? 'paperback',
    sprayedEdgeStyle: EDGE_STYLES[sprayedEdgeStyle]
      ? sprayedEdgeStyle
      : Object.keys(EDGE_STYLES)[hash(rest.id || rest.title || '') % 4],
  };
}

/** Portada de Open Library por ISBN (404 si no existe → portada tipográfica). */
export const isbnCover = (isbn) => (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false` : '');

export function stripHtml(text) {
  if (!text) return '';
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Orden de cada balda: el que hayas elegido arrastrando y, si no, uno natural por estado. */
const SHELF_BASE = {
  reading: (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''),
  want: (a, b) => (a.addedAt || '').localeCompare(b.addedAt || ''),
  read: (a, b) => (b.finishedAt || '').localeCompare(a.finishedAt || ''),
};

export function shelfSort(status) {
  const base = SHELF_BASE[status] ?? SHELF_BASE.want;
  return (a, b) => {
    const ao = a.shelfOrder;
    const bo = b.shelfOrder;
    if (ao != null && bo != null) return ao - bo;
    if (ao != null) return -1;
    if (bo != null) return 1;
    return base(a, b);
  };
}

/** Cambio de balda con sus consecuencias: terminado, empezado o vuelta a pendientes. */
export function withStatus(book, status, now = new Date().toISOString()) {
  if (book.status === status) return book;
  const next = { ...book, status, updatedAt: now };
  if (status === 'read') {
    next.finishedAt = now;
    next.currentPage = book.pageCount;
  } else {
    next.finishedAt = null;
    if (book.status === 'read' && status === 'want') next.currentPage = 0;
  }
  if (status === 'reading' && !book.startedAt) next.startedAt = now;
  return next;
}
