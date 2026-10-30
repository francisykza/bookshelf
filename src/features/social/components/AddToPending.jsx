// «Añadir a pendientes» (SPEC §28.10, §56): acción explícita y separada por libro; guarda en privado de dónde vino.
// La usan el perfil de lector y la visita a un rincón. Nunca se añade nada solo por mirar.
import { useState } from 'react';
import { createBook } from '../../../domain/books';
import { useLibrary } from '../../../state/useLibrary';
import { inLibrary, pendingFromRef } from '../huellas';

/** Si el libro ya está en tu biblioteca, lo dice; si no, un botón que lo añade una sola vez. */
export function AddToPending({ book, from }) {
  const { state, actions } = useLibrary();
  const [done, setDone] = useState(false);
  const already = inLibrary(state.books, book);
  if (already || done)
    return (
      <span className="huella-added" role="status">
        {done ? 'Añadido a Pendientes' : 'Ya está en tu biblioteca'}
      </span>
    );
  return (
    <button
      type="button"
      className="social-btn"
      onClick={() => {
        if (done) return;
        actions.addBook(createBook(pendingFromRef(book, from)));
        setDone(true);
      }}
    >
      Añadir a pendientes
    </button>
  );
}
