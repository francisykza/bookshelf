// Valoraciones en cuartos de estrella (SPEC §14.4, 1.20.0). `RatingStars` pinta cinco estrellas SVG con
// contorno y relleno independientes: la estrella `i` se rellena `clamp(rating − i, 0, 1)` de su ancho con un
// recorte horizontal (dos SVG apilados, sin caracteres Unicode ni IDs). `RatingInput` añade el ajuste fino.
import { Minus, Plus } from 'lucide-react';
import { playUiSound } from '../../audio/uiSounds';
import { formatRating, normalizeRating, ratingText } from '../../domain/books';

const STAR = 'M12 2.6l2.86 5.8 6.4.93-4.63 4.51 1.09 6.37L12 17.2l-5.72 3.01 1.09-6.37L2.74 9.33l6.4-.93z';

function Star({ fill }) {
  return (
    <span className="rstar" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="rstar__base">
        <path d={STAR} />
      </svg>
      <span className="rstar__fill" style={{ width: `${fill * 100}%` }}>
        <svg viewBox="0 0 24 24">
          <path d={STAR} />
        </svg>
      </span>
    </span>
  );
}

/** Solo lectura: un nombre accesible («3,75 de 5 estrellas») y las estrellas decorativas. */
export function RatingStars({ value, className = '' }) {
  const rating = normalizeRating(value);
  return (
    <span className={`rating-stars ${className}`} role="img" aria-label={ratingText(rating)}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} fill={Math.min(1, Math.max(0, rating - i))} />
      ))}
    </span>
  );
}

/**
 * Control de valoración: cada estrella da esa nota entera, el control de rango y los botones −/+ ajustan de
 * 0,25 en 0,25 y «Quitar valoración» vuelve a «sin valorar» (`null`, explícito).
 */
export function RatingInput({ value, onChange }) {
  const rating = normalizeRating(value);
  const set = (v) => onChange(normalizeRating(v));
  // Clic leve solo al confirmar con una estrella o ±; el control de rango no suena al arrastrar
  const confirm = (v) => {
    playUiSound('select');
    set(v);
  };
  return (
    <div className="rating-input" role="group" aria-label="Valoración">
      <div className="rating-input__stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className="rating-input__star" onClick={() => confirm(n)} aria-label={`Valorar con ${n} ${n === 1 ? 'estrella' : 'estrellas'}`}>
            <Star fill={Math.min(1, Math.max(0, rating - (n - 1)))} />
          </button>
        ))}
        <span className="rating-input__value" data-empty={!rating || undefined} aria-hidden="true">
          {rating ? `${formatRating(rating)} / 5` : 'Sin valorar'}
        </span>
      </div>
      <div className="rating-input__fine">
        <button type="button" className="rating-input__step" onClick={() => confirm(Math.max(0.25, rating - 0.25))} disabled={rating <= 0.25} aria-label="Restar un cuarto de estrella">
          <Minus aria-hidden="true" />
        </button>
        <input
          type="range"
          min="0.25"
          max="5"
          step="0.25"
          value={rating || 0.25}
          data-empty={!rating || undefined}
          onChange={(e) => set(e.target.value)}
          aria-label="Valoración"
          aria-valuetext={ratingText(rating)}
          style={{ '--p': `${rating ? ((rating - 0.25) / 4.75) * 100 : 0}%` }}
        />
        <button type="button" className="rating-input__step" onClick={() => confirm(Math.min(5, rating + 0.25))} disabled={rating >= 5} aria-label="Sumar un cuarto de estrella">
          <Plus aria-hidden="true" />
        </button>
      </div>
      {rating > 0 && (
        <button type="button" className="link-btn rating-input__clear" onClick={() => onChange(null)}>
          Quitar valoración
        </button>
      )}
    </div>
  );
}
