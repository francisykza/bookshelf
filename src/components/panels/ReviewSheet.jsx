// Reseña al terminar una lectura (SPEC §22.8). No es otro almacenamiento: edita los mismos campos de la ficha del
// libro (`review` y `rating`, una reseña por libro) con el mismo control de valoración en cuartos de estrella. Se
// abre solo desde la finalización confirmada en el calendario, nunca al hidratar el estado. «Ahora no» cierra sin
// tocar nada (el libro sigue terminado); guardar no concede sellos, recompensas ni pity. La reseña es privada.
import { useId, useState } from 'react';
import { playUiSound } from '../../audio/uiSounds';
import { normalizeRating } from '../../domain/books';
import { useLibrary } from '../../state/useLibrary';
import { RatingInput } from '../book/Rating';
import { Cover } from '../shelf/BookItem';
import { PanelShell } from './PanelShell';

export function ReviewSheet({ bookId, onClose }) {
  const { state, actions } = useLibrary();
  const uid = useId();
  const book = state.books.find((b) => b.id === bookId);
  // Borrador local cargado de lo que ya hubiera: abrir no duplica ni borra la reseña existente
  const [rating, setRating] = useState(() => normalizeRating(book?.rating));
  const [review, setReview] = useState(() => book?.review ?? '');
  const [failure, setFailure] = useState('');
  if (!book) return null;

  const save = (event) => {
    event.preventDefault();
    actions.updateBook(book.id, { rating, review });
    setTimeout(() => {
      if (!actions.persistNow()) {
        setFailure('No se ha podido guardar en este dispositivo. Tu reseña sigue aquí: vuelve a intentarlo.');
        return;
      }
      playUiSound('save');
      onClose();
    }, 0);
  };

  return (
    <PanelShell onClose={onClose} label={`Reseña de ${book.title}`} variant="review">
      <form className="review-sheet paper-sheet" onSubmit={save} noValidate>
        <header className="review-sheet__head">
          <span className="review-sheet__cover" aria-hidden="true">
            <Cover book={book} />
          </span>
          <div>
            <p className="review-sheet__kicker">Una historia terminada</p>
            <h2 className="review-sheet__title">{book.title}</h2>
            {book.author && <p className="review-sheet__author">{book.author}</p>}
          </div>
        </header>
        <div className="review-sheet__body">
          <div className="review-sheet__field">
            <span className="review-sheet__label">Tu puntuación</span>
            <RatingInput value={rating} onChange={setRating} />
          </div>
          <label className="review-sheet__field" htmlFor={`${uid}-review`}>
            <span className="review-sheet__label">Tu reseña</span>
            <span className="review-sheet__note">Solo para ti</span>
          </label>
          <textarea id={`${uid}-review`} className="review-sheet__text" value={review} onChange={(e) => setReview(e.target.value)} placeholder="Lo que sentí al leerlo…" rows={6} />
          {failure && (
            <p className="reading-form__error" role="alert">
              {failure}
            </p>
          )}
        </div>
        <div className="review-sheet__actions">
          <button type="submit" className="stamp-btn">
            Guardar reseña
          </button>
          <button type="button" className="link-btn" onClick={onClose}>
            Ahora no
          </button>
        </div>
      </form>
    </PanelShell>
  );
}
