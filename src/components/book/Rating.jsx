// Valoraciones en cuartos de estrella (SPEC §14.4, 1.20.0). `RatingStars` pinta cinco estrellas SVG con
// contorno y relleno independientes: la estrella `i` se rellena `clamp(rating − i, 0, 1)` de su ancho con un
// recorte horizontal (dos SVG apilados, sin caracteres Unicode ni IDs). `RatingInput` añade el ajuste fino.
import { Minus, Plus, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { playUiSound } from '../../audio/uiSounds';
import { formatRating, normalizeRating, ratingText } from '../../domain/books';

const STAR = 'M12 2.6l2.86 5.8 6.4.93-4.63 4.51 1.09 6.37L12 17.2l-5.72 3.01 1.09-6.37L2.74 9.33l6.4-.93z';

/**
 * Ancho visible del relleno: la estrella no reparte su superficie de forma uniforme a lo ancho (el 25 % izquierdo
 * solo contiene la punta de un brazo). Se ajusta para que un cuarto, media y tres cuartos se lean como tales.
 */
export const visualFill = (f) => (f <= 0 ? 0 : f >= 1 ? 1 : 0.2 + f * 0.6);

function Star({ fill }) {
  return (
    <span className="rstar" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="rstar__base">
        <path d={STAR} />
      </svg>
      <span className="rstar__fill" style={{ width: `${visualFill(fill) * 100}%` }} data-fill={fill}>
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
 * Control de valoración (SPEC §27.6): estrellas + número. Cada estrella da esa nota entera; con el foco en las
 * estrellas, las flechas suben o bajan 0,25. El ajuste fino (−/rango/+ de 0,25 en 0,25) aparece al activar la
 * valoración —al tocar una estrella o «Ajustar»— y «Quitar valoración» vuelve a «sin valorar» (`null`).
 * `variant="sheet"` (hoja de la reseña del diario, 1.53): estrellas centradas, el valor debajo y el ajuste fino solo
 * con «Ajustar puntuación»; tocar una estrella no lo despliega.
 */
export function RatingInput({ value, onChange, variant, labelledBy }) {
  const sheet = variant === 'sheet';
  const rating = normalizeRating(value);
  const [fine, setFine] = useState(false);
  const set = (v) => onChange(normalizeRating(v));
  // Clic leve solo al confirmar con una estrella o ±; el control de rango no suena al arrastrar
  const confirm = (v) => {
    playUiSound('select');
    set(v);
  };
  const onKeyDown = (event) => {
    const dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
    if (!dir) return;
    event.preventDefault();
    set(Math.min(5, Math.max(0.25, (rating || 0) + dir * 0.25)));
  };
  return (
    <div className={`rating-input${sheet ? ' rating-input--sheet' : ''}`} role="group" aria-label={labelledBy ? undefined : 'Valoración'} aria-labelledby={labelledBy} aria-describedby={sheet ? `${labelledBy}-value` : undefined}>
      <div className="rating-input__stars" onKeyDown={onKeyDown}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className="rating-input__star"
            onClick={() => {
              confirm(n);
              if (!sheet) setFine(true);
            }}
            aria-label={`Valorar con ${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
          >
            <Star fill={Math.min(1, Math.max(0, rating - (n - 1)))} />
          </button>
        ))}
        {!sheet && (
          <>
            <span className="rating-input__value" data-empty={!rating || undefined} aria-live="polite">
              {rating ? `${formatRating(rating)} / 5` : 'Sin valorar'}
            </span>
            <button type="button" className="rating-input__adjust" aria-expanded={fine} onClick={() => setFine((v) => !v)} aria-label="Ajustar la valoración en cuartos de estrella" title="Ajuste fino">
              <SlidersHorizontal aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      {sheet && (
        <>
          <span id={`${labelledBy}-value`} className="rating-input__value" data-empty={!rating || undefined} aria-live="polite">
            {rating ? `${formatRating(rating)} de 5` : 'Sin valorar'}
          </span>
          <button type="button" className="link-btn rating-input__adjust-link" aria-expanded={fine} onClick={() => setFine((v) => !v)}>
            Ajustar puntuación
          </button>
        </>
      )}
      {fine && (
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
      )}
      {rating > 0 && fine && (
        <button type="button" className="link-btn rating-input__clear" onClick={() => onChange(null)}>
          Quitar valoración
        </button>
      )}
    </div>
  );
}
