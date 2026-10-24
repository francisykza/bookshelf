// «Pedir una recomendación» (SPEC §18.5–18.6, fase IA-1): el bibliotecario LOCAL busca en tu biblioteca con
// reglas explícitas, en el navegador, sin red ni IA. Hasta dos libros de tu estante y una frase breve; el clima
// que propone no se aplica solo. No hay cargas artificiales ni botones de IA: el resultado es inmediato.
import { useId, useRef, useState } from 'react';
import { playUiSound } from '../../audio/uiSounds';
import { STATUS } from '../../domain/books';
import { recommendLocally, toCatalog } from '../../utils/localLibrarian';
import { useLibrary } from '../../state/useLibrary';
import { Cover } from '../shelf/BookItem';
import { PanelShell } from './PanelShell';

export function LibrarianPanel({ onClose, onOpenBook }) {
  const { state } = useLibrary();
  const uid = useId();
  const [mood, setMood] = useState('');
  const [result, setResult] = useState(null);
  const resultRef = useRef(null);
  const byId = new Map(state.books.map((b) => [b.id, b]));

  const ask = (event) => {
    event.preventDefault();
    const r = recommendLocally({ userMood: mood, catalog: toCatalog(state.books) });
    setResult({ ...r, source: 'local' });
    playUiSound('select');
  };

  return (
    <PanelShell onClose={onClose} label="Pedir una recomendación" variant="account">
      <div className="librarian paper-sheet">
        <div className="account__head">
          <h2>Pedir una recomendación</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <p className="librarian__note">Busco entre los libros de tu biblioteca con unas reglas sencillas, aquí mismo, sin conexión.</p>
        <form className="librarian__form" onSubmit={ask}>
          <label htmlFor={`${uid}-mood`}>¿Qué te apetece leer?</label>
          <input id={`${uid}-mood`} value={mood} maxLength={500} onChange={(e) => setMood(e.target.value)} placeholder="algo corto y de misterio, sin terror…" autoComplete="off" />
          <button type="submit" className="stamp-btn">
            Buscar en mi biblioteca
          </button>
        </form>
        <div ref={resultRef} className="librarian__result" aria-live="polite">
          {result && (
            <>
              <p className="librarian__whisper">{result.librarianWhisper}</p>
              {result.recommendedIds.length > 0 && (
                <ul className="librarian__books">
                  {result.recommendedIds.map((id) => {
                    const b = byId.get(id);
                    if (!b) return null;
                    return (
                      <li key={id}>
                        <button type="button" className="book-search__result" onClick={() => onOpenBook(b)}>
                          <span className="book-search__cover" aria-hidden="true">
                            <Cover book={b} />
                          </span>
                          <span className="book-search__text">
                            <b>{b.title}</b>
                            <span>{b.author}</span>
                            <em>{STATUS[b.status] ?? b.status} · ver la ficha</em>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="librarian__source">Recomendación local por reglas · sin IA</p>
            </>
          )}
        </div>
      </div>
    </PanelShell>
  );
}
