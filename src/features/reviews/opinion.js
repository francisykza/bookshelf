// Opiniones públicas (SPEC §25.5–25.6), sin React ni red: validación, copia pública explícita a partir de la
// reseña privada y presentación de las estadísticas que calcula el servidor. Nada se publica al guardar.
import { normalizeRating } from '../../domain/books';

export const ALIAS_MIN = 2;
export const ALIAS_MAX = 40;
export const BODY_MAX = 5000;

/** Impresiones opcionales (enteros 1–5 o null), cada una con sus extremos. */
export const IMPRESSIONS = [
  { id: 'pace', label: 'Ritmo', low: 'Pausado', high: 'Intenso' },
  { id: 'emotion', label: 'Emoción', low: 'Serena', high: 'Muy emotiva' },
  { id: 'surprise', label: 'Sorpresa', low: 'Previsible', high: 'Muy sorprendente' },
  { id: 'romance', label: 'Romance', low: 'Ausente', high: 'Protagonista' },
];

/** Intervalos exactos de las cinco barras sobre puntuaciones en cuartos (no son votos enteros). */
export const BANDS = [
  { id: 'band_1', label: '(0, 1]' },
  { id: 'band_2', label: '(1, 2]' },
  { id: 'band_3', label: '(2, 3]' },
  { id: 'band_4', label: '(3, 4]' },
  { id: 'band_5', label: '(4, 5]' },
];

/** Puntuación ↔ cuartos (1–20). Sin puntuación: null, nunca 0. */
export const toQuarters = (rating) => {
  const r = normalizeRating(rating);
  return r == null ? null : Math.round(r * 4);
};
export const fromQuarters = (q) => (Number.isInteger(q) && q >= 1 && q <= 20 ? q / 4 : null);

/** Alias público: 2–40 caracteres sin espacios sobrantes. Devuelve el error o ''. */
export function aliasError(alias) {
  const a = String(alias ?? '');
  if (a !== a.trim()) return 'Sin espacios al principio ni al final.';
  if (a.length < ALIAS_MIN) return `Al menos ${ALIAS_MIN} caracteres.`;
  if (a.length > ALIAS_MAX) return `Como mucho ${ALIAS_MAX} caracteres.`;
  return '';
}

const impression = (v) => (Number.isInteger(v) && v >= 1 && v <= 5 ? v : null);

/**
 * La copia pública que se enviaría: solo puntuación, texto elegido e indicadores opcionales (alias y avatar
 * salen del perfil). Nunca notas, citas, páginas, estado ni historial.
 */
export function publicCopy({ rating, body, spoilers, impressions = {} }) {
  return {
    rating_quarters: toQuarters(rating),
    body: String(body ?? '').slice(0, BODY_MAX),
    has_spoilers: Boolean(spoilers),
    pace: impression(impressions.pace),
    emotion: impression(impressions.emotion),
    surprise: impression(impressions.surprise),
    romance: impression(impressions.romance),
  };
}

/** ¿Difiere el borrador privado de lo último publicado? (para ofrecer «Actualizar publicación») */
export function draftDiffers(book, userId = book.publicReview?.userId) {
  const pub = book.publicReview?.userId === userId ? book.publicReview : null;
  if (!pub || pub.status !== 'published') return false;
  const now = publicCopy({ rating: book.rating, body: book.review, spoilers: book.reviewSpoilers, impressions: pub.impressions });
  return now.rating_quarters !== pub.copy.rating_quarters || now.body !== pub.copy.body || now.has_spoilers !== pub.copy.has_spoilers;
}

const fmt1 = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Presentación de `work_review_stats`: media con un decimal (la precisión interna no se toca), recuento de
 * personas, primeras valoraciones (< 5), opiniones sin puntuar u obra sin opiniones, barras e impresiones con su propio recuento.
 */
export function statsView(stats) {
  const ratings = Number(stats?.ratings ?? 0);
  const reviews = Number(stats?.reviews ?? 0);
  const average = stats?.average == null ? null : Number(stats.average);
  const headline =
    reviews === 0
      ? 'Esta historia todavía espera su primera opinión'
      : ratings === 0
        ? 'Todavía nadie la ha puntuado'
        : ratings < 5
          ? `Primeras valoraciones: ${ratings} ${ratings === 1 ? 'lector' : 'lectores'}`
          : `${ratings} lectores han puntuado`;
  return {
    ratings,
    reviews,
    average,
    averageText: average == null ? '—' : fmt1(average),
    headline,
    bands: BANDS.map((b) => ({ ...b, count: Number(stats?.[b.id] ?? 0) })),
    impressions: IMPRESSIONS.map((d) => ({ ...d, n: Number(stats?.[`${d.id}_n`] ?? 0), average: stats?.[`${d.id}_avg`] == null ? null : Number(stats[`${d.id}_avg`]) })),
  };
}

/** Referencia de obra verificada del libro (solo obras de Open Library), o null si la obra es local. */
export const externalWorkRef = (book) => (book?.workRef?.source === 'openlibrary' && /^\/works\/OL\d+W$/.test(book.workRef.id ?? '') ? book.workRef.id : null);
