// Sentarse a leer en el salón (1.62, SPEC §62.2): una sola elección, la misma desde el sillón de la escena y desde la
// pestaña «Salón». «Mi alias y mi lectura actual» (con un selector visible de tus libros en curso) o «Solo mi alias».
// Con «Solo mi alias» el título no sale del dispositivo. Sentarse no registra páginas ni empieza una sesión contable.
import { ChevronDown } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { PhysicalBook } from '../../../components/shelf/BookItem';
import { currentBook } from '../../../domain/books';
import { useLibrary } from '../../../state/useLibrary';

/** Tus libros en curso, el actual primero y después los más recientes. */
export function readingBooks(books, settings) {
  const current = currentBook(books, settings);
  const rest = books.filter((b) => b.status === 'reading' && b.id !== current?.id).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return current ? [current, ...rest] : rest;
}

export function SeatChoice({ onSit, busy = false, titleId }) {
  const { state } = useLibrary();
  const reading = useMemo(() => readingBooks(state.books, state.settings), [state.books, state.settings]);
  const [share, setShare] = useState(true);
  const [bookId, setBookId] = useState(null);
  const book = reading.find((b) => b.id === bookId) ?? reading[0] ?? null;
  const withBook = share && Boolean(book);
  const name = useId();
  const selectId = useId();

  return (
    <form
      className="seat-choice"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) onSit({ shareBook: withBook, bookTitle: withBook ? book.title : null });
      }}
    >
      <fieldset className="seat-choice__options">
        <legend id={titleId}>Elige qué quieres compartir al sentarte.</legend>
        <label className="seat-choice__radio">
          <input type="radio" name={name} checked={withBook} disabled={!book} onChange={() => setShare(true)} />
          <span>Mi alias y mi lectura actual</span>
        </label>
        <label className="seat-choice__radio">
          <input type="radio" name={name} checked={!withBook} onChange={() => setShare(false)} />
          <span>Solo mi alias</span>
        </label>
      </fieldset>
      {book ? (
        withBook && (
          <div className="seat-choice__book">
            <label htmlFor={selectId} className="seat-choice__book-label">
              Lectura actual · {book.title}
            </label>
            <div className="seat-choice__book-card">
              <span className="seat-choice__cover" aria-hidden="true">
                <PhysicalBook book={book} variant="corner" />
              </span>
              <span className="seat-choice__book-text" aria-hidden="true">
                <b>{book.title}</b>
                {book.author && <small>{book.author}</small>}
              </span>
              {reading.length > 1 && <ChevronDown className="seat-choice__chevron" aria-hidden="true" />}
              {/* El selector nativo cubre la tarjeta: se ve la portada y se elige con el control del sistema */}
              <select id={selectId} className="seat-choice__select" value={book.id} disabled={reading.length < 2} onChange={(e) => setBookId(e.target.value)}>
                {reading.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                    {b.author ? ` · ${b.author}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )
      ) : (
        <p className="seat-choice__note">No tienes ninguna lectura empezada: te sentarás con tu alias.</p>
      )}
      <button type="submit" className="seat-choice__sit" disabled={busy}>
        {busy ? 'Sentándote…' : 'Sentarme a leer'}
      </button>
      <p className="seat-choice__foot">Sentarte no registra páginas.</p>
    </form>
  );
}
