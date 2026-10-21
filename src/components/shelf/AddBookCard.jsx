// Ficha de biblioteca para añadir libros (SPEC §5.2): búsqueda real en Google Books con respaldo en
// Open Library, sin API key. Resultados con portada, autor, año y páginas; alta manual si no aparece.
import { Loader2, PenLine, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FORMATS, STATUS } from '../../domain/books';
import { EdgePicker } from '../book/EditionPicker';
import { fetchDetails, searchBooks } from '../../services/bookApi';
import { useLibrary } from '../../state/useLibrary';
import { PanelShell } from '../panels/PanelShell';
import { Cover } from './BookItem';

const SOURCE = { google: 'Google Books', openlibrary: 'Open Library' };

export function AddBookCard({ onClose, onAdded }) {
  const { state, actions } = useLibrary();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState({ loading: false, error: null, source: null, results: [] });
  const [chosen, setChosen] = useState(null);
  const [manual, setManual] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setStatus({ loading: false, error: null, source: null, results: [] });
      return undefined;
    }
    const controller = new AbortController();
    const id = setTimeout(async () => {
      setStatus((s) => ({ ...s, loading: true, error: null }));
      try {
        const { results, source } = await searchBooks(q, { signal: controller.signal });
        setStatus({ loading: false, error: null, source, results });
      } catch (error) {
        if (error.name !== 'AbortError') setStatus({ loading: false, error: error.message, source: null, results: [] });
      }
    }, 400);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [query]);

  const choose = async (result) => {
    setChosen({ ...result, loadingDetails: result.source === 'openlibrary' });
    const full = await fetchDetails(result);
    setChosen((c) => (c?.key === result.key ? { ...full, loadingDetails: false } : c));
  };

  const owned = new Set(state.books.map((b) => `${b.title.toLowerCase()}|${b.author.toLowerCase()}`));

  return (
    <PanelShell onClose={onClose} label="Añadir un libro" variant="card">
      <div className="index-card">
        <div className="index-card__head">
          <h2>Ficha de biblioteca</h2>
          <p>Busca cualquier libro del mundo por título, autor o ISBN.</p>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X aria-hidden="true" />
          </button>
        </div>

        {chosen || manual ? (
          <ConfirmBook
            initial={chosen ?? { title: query, author: '', pageCount: 300, categories: [], synopsis: '', cover: '', source: 'manual' }}
            manual={manual}
            onBack={() => {
              setChosen(null);
              setManual(false);
            }}
            onSave={(book) => {
              actions.addBook(book);
              onAdded?.(book);
              onClose();
            }}
          />
        ) : (
          <>
            <label className="index-card__search">
              <Search aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="El nombre del viento, Ursula K. Le Guin…"
                aria-label="Buscar libros"
              />
              {status.loading && <Loader2 className="spin" aria-label="Buscando" />}
            </label>
            {status.source && (
              <p className="index-card__source">
                Resultados de {SOURCE[status.source]}
                {status.source === 'openlibrary' && ' (respaldo automático)'}
              </p>
            )}
            {status.error && <p className="index-card__error">{status.error}</p>}
            <ul className="results" aria-live="polite">
              {status.results.map((r) => {
                const have = owned.has(`${r.title.toLowerCase()}|${r.author.toLowerCase()}`);
                return (
                  <li key={r.key}>
                    <button type="button" className="result" onClick={() => choose(r)} disabled={have}>
                      <span className="result__cover">
                        <Cover book={{ ...r, id: r.key }} />
                      </span>
                      <span className="result__text">
                        <strong>{r.title}</strong>
                        <span>{r.author}</span>
                        <em>
                          {[r.publishedDate?.slice(0, 4), r.pageCount ? `${r.pageCount} págs.` : 'páginas desconocidas', have && 'ya en tu librería']
                            .filter(Boolean)
                            .join(' · ')}
                        </em>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {!status.loading && query.trim().length >= 2 && !status.results.length && !status.error && (
              <p className="index-card__hint">Sin resultados. Prueba con otro título o añádelo a mano.</p>
            )}
            <button type="button" className="link-btn" onClick={() => setManual(true)}>
              <PenLine aria-hidden="true" /> Añadir a mano
            </button>
          </>
        )}
      </div>
    </PanelShell>
  );
}

function ConfirmBook({ initial, manual, onBack, onSave }) {
  const [draft, setDraft] = useState({ status: 'want', editionType: 'paperback', ...initial, pageCount: initial.pageCount || 300, unpaged: false });
  useEffect(() => {
    setDraft((d) => ({ ...d, synopsis: d.synopsis || initial.synopsis, categories: d.categories?.length ? d.categories : initial.categories }));
  }, [initial.synopsis, initial.categories]);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <form
      className="confirm-book"
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.title.trim()) return;
        const now = new Date().toISOString();
        // Total desconocido (ebook sin paginación): se sigue por porcentaje, sin páginas ficticias
        const pages = draft.unpaged ? null : Math.max(1, Number(draft.pageCount) || 1);
        onSave({
          title: draft.title.trim(),
          author: draft.author.trim() || 'Autor desconocido',
          cover: draft.cover || '',
          synopsis: draft.synopsis || '',
          publishedDate: draft.publishedDate || '',
          categories: draft.categories ?? [],
          isbn: draft.isbn || '',
          source: draft.source || 'manual',
          status: draft.status,
          editionType: draft.editionType,
          sprayedEdgeStyle: draft.sprayedEdgeStyle,
          pageCount: pages,
          trackBy: pages ? 'pages' : 'percent',
          currentPage: draft.status === 'read' && pages ? pages : 0,
          currentPercent: draft.status === 'read' ? 100 : 0,
          finishedAt: draft.status === 'read' ? now : null,
          startedAt: draft.status !== 'want' ? now : null,
        });
      }}
    >
      <div className="confirm-book__preview">
        <Cover book={{ ...draft, id: draft.key || draft.title }} />
      </div>
      <div className="confirm-book__fields">
        <label>
          Título
          <input value={draft.title} onChange={(e) => set({ title: e.target.value })} required autoFocus={manual} />
        </label>
        <label>
          Autor
          <input value={draft.author} onChange={(e) => set({ author: e.target.value })} />
        </label>
        <div className="confirm-book__row">
          <label>
            Páginas
            <input type="number" min="1" max="20000" value={draft.pageCount} disabled={draft.unpaged} onChange={(e) => set({ pageCount: e.target.value })} />
            <span className="confirm-book__check">
              <input type="checkbox" checked={draft.unpaged} onChange={(e) => set({ unpaged: e.target.checked })} />
              Sin total (ebook)
            </span>
          </label>
          <label>
            Balda
            <select value={draft.status} onChange={(e) => set({ status: e.target.value })}>
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Edición
          <select value={draft.editionType} onChange={(e) => set({ editionType: e.target.value })}>
            {Object.entries(FORMATS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {draft.editionType === 'sprayed_edges' && (
          <EdgePicker value={draft.sprayedEdgeStyle ?? 'constellations'} onChange={(sprayedEdgeStyle) => set({ sprayedEdgeStyle })} />
        )}
        {manual && (
          <label>
            URL de la portada (opcional)
            <input type="url" value={draft.cover} onChange={(e) => set({ cover: e.target.value })} placeholder="https://…" />
          </label>
        )}
        {initial.loadingDetails && <p className="index-card__source">Buscando la sinopsis en Open Library…</p>}
        {draft.synopsis && <p className="confirm-book__synopsis">{draft.synopsis}</p>}
        <div className="confirm-book__actions">
          <button type="button" className="link-btn" onClick={onBack}>
            Volver a buscar
          </button>
          <button type="submit" className="stamp-btn">
            Colocar en la balda
          </button>
        </div>
      </div>
    </form>
  );
}
