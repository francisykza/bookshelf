// Ficha de biblioteca para añadir libros (SPEC §5.2, §40): búsqueda real en Google Books con Open Library cuando
// Google no responde, sin API key. Tres pasos: buscar (título, autor o ISBN), elegir la edición si el resultado es
// una obra con varias, y confirmar. Cada edición conserva solo sus datos; lo que falta se completa a mano. Siempre
// queda el alta manual. Las búsquedas viejas se cancelan y sus respuestas no pisan a las nuevas.
import { ChevronLeft, Loader2, PenLine, RotateCcw, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { EDITIONS, SELECTABLE_EDITION_IDS, STATUS } from '../../domain/books';
import { LANG_NAMES, editionFromFormat, langCode, languageName, ownedMatch, userLanguage, yearOf } from '../../domain/bookSearch';
import { EdgePicker } from '../book/EditionPicker';
import { fetchDetails, fetchEditions, searchBooks } from '../../services/bookApi';
import { useLibrary } from '../../state/useLibrary';
import { PanelShell } from '../panels/PanelShell';
import { Cover } from './BookItem';

const SOURCE = { google: 'Google Books', openlibrary: 'Open Library' };

/** Línea de datos de una edición: editorial · año · idioma · páginas (solo lo que existe). */
function editionLine(e) {
  return [e.publisher, yearOf(e.editionDate), languageName(e.language), e.pageCount ? `${e.pageCount} págs.` : ''].filter(Boolean).join(' · ');
}

export function AddBookCard({ onClose, onAdded }) {
  const { state, actions } = useLibrary();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState({ loading: false, error: null, source: null, results: [], isbn: null, done: '' });
  const [attempt, setAttempt] = useState(0);
  // Paso actual: null (buscar), { work } (elegir edición) o { draft } (confirmar)
  const [work, setWork] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [manual, setManual] = useState(false);
  const inputRef = useRef(null);
  const lang = userLanguage();

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setStatus({ loading: false, error: null, source: null, results: [], isbn: null, done: '' });
      return undefined;
    }
    const controller = new AbortController();
    const id = setTimeout(async () => {
      setStatus((s) => ({ ...s, loading: true, error: null }));
      try {
        const { results, source, isbn } = await searchBooks(q, { signal: controller.signal, lang });
        // Una respuesta que llega tarde (la consulta ya cambió) se descarta
        if (!controller.signal.aborted) setStatus({ loading: false, error: null, source, results, isbn, done: q });
      } catch (error) {
        if (error.name !== 'AbortError' && !controller.signal.aborted) setStatus({ loading: false, error: error.message, source: null, results: [], isbn: null, done: q });
      }
    }, 400);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [query, attempt, lang]);

  const choose = (result) => {
    // Una obra con ediciones se concreta antes de confirmar; una edición va directa
    if (result.kind === 'work') setWork(result);
    else setChosen(result);
  };

  const back = () => {
    setChosen(null);
    setManual(false);
  };

  return (
    <PanelShell onClose={onClose} label="Añadir un libro" variant="card">
      <div className="index-card" data-146="">
        <div className="index-card__head">
          <h2>Ficha de biblioteca</h2>
          <p>Busca por título, autor o ISBN.</p>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X aria-hidden="true" />
          </button>
        </div>

        {chosen || manual ? (
          <ConfirmBook
            initial={chosen ?? { title: parseQueryTitle(query), author: '', pageCount: null, categories: [], synopsis: '', cover: '', source: 'manual' }}
            manual={manual}
            books={state.books}
            onBack={() => (work && chosen ? setChosen(null) : back())}
            onSave={(book) => {
              actions.addBook(book);
              onAdded?.(book);
              onClose();
            }}
          />
        ) : work ? (
          <EditionStep work={work} lang={lang} books={state.books} onBack={() => setWork(null)} onPick={setChosen} />
        ) : (
          <>
            <label className="index-card__search">
              <Search aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Título, autor o ISBN"
                aria-label="Buscar libros por título, autor o ISBN"
              />
              {status.loading && <Loader2 className="spin" aria-hidden="true" />}
            </label>
            <p className="index-card__status" role="status" aria-live="polite">
              {status.loading ? 'Buscando…' : status.done && !status.error ? `${status.results.length} ${status.results.length === 1 ? 'resultado' : 'resultados'}${status.isbn ? ' · búsqueda por ISBN' : ''}` : ''}
            </p>
            {status.error && (
              <div className="index-card__error" role="alert">
                <span>{status.error}</span>
                <button type="button" className="link-btn" onClick={() => setAttempt((n) => n + 1)}>
                  <RotateCcw aria-hidden="true" /> Reintentar
                </button>
              </div>
            )}
            <ul className="results">
              {status.results.map((r) => {
                const owned = ownedMatch(r, state.books);
                const exact = status.isbn && r.isbn === status.isbn;
                const meta = r.kind === 'work' ? [r.firstPublished && `Obra de ${r.firstPublished}`, r.editionCount > 1 && `${r.editionCount} ediciones`].filter(Boolean).join(' · ') : editionLine(r);
                return (
                  <li key={r.key}>
                    <button type="button" className="result" onClick={() => choose(r)} disabled={owned === 'isbn'} data-kind={r.kind}>
                      <span className="result__cover">
                        <Cover book={{ ...r, id: r.key }} />
                      </span>
                      <span className="result__text">
                        <strong>{r.title}</strong>
                        <span>{r.author}</span>
                        {meta && <em>{meta}</em>}
                        {(exact || owned) && (
                          <span className="result__tags">
                            {exact && <b className="result__tag">Coincide el ISBN</b>}
                            {owned === 'isbn' && <b className="result__tag result__tag--owned">Ya está en tu biblioteca</b>}
                            {owned === 'title' && <b className="result__tag result__tag--owned">Ya tienes este título</b>}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {!status.loading && status.done && !status.results.length && !status.error && (
              <p className="index-card__hint">No hay resultados para «{status.done}». Prueba con otro título, el autor o el ISBN, o añádelo a mano.</p>
            )}
            {status.source && <p className="index-card__source">Datos de {SOURCE[status.source]}</p>}
            <button type="button" className="link-btn" onClick={() => setManual(true)}>
              <PenLine aria-hidden="true" /> Añadir a mano
            </button>
          </>
        )}
      </div>
    </PanelShell>
  );
}

/** Formato físico del proveedor en español cuando se reconoce (si no, tal cual lo da). */
function formatName(format) {
  const id = editionFromFormat(format);
  return id ? EDITIONS[id].short : format;
}

/** Lo escrito como título para el alta manual (un ISBN no es un título). */
function parseQueryTitle(query) {
  return /^[\d\s-Xx]{10,}$/.test(query.trim()) ? '' : query.trim();
}

/**
 * Elegir edición de una obra: cada fila es una edición con SUS datos (portada, editorial, fecha, idioma, páginas,
 * formato, ISBN), las del idioma del usuario primero. También se puede seguir solo con los datos de la obra.
 */
function EditionStep({ work, lang, books, onBack, onPick }) {
  const [data, setData] = useState({ loading: true, editions: [], total: 0, details: work });
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([fetchEditions(work.workKey, { signal: controller.signal, lang }), fetchDetails(work, { signal: controller.signal })])
      .then(([{ editions, total }, details]) => {
        if (!controller.signal.aborted) setData({ loading: false, editions, total, details });
      })
      .catch(() => {
        if (!controller.signal.aborted) setData((d) => ({ ...d, loading: false }));
      });
    return () => controller.abort();
  }, [work, lang]);
  const base = data.details;
  // Una edición elegida: sus datos y, de la obra, solo lo que es de la obra (autoría, sinopsis, temas y año)
  const pick = (e) =>
    onPick({
      ...base,
      kind: 'edition',
      key: `ol:${e.editionKey}`,
      editionKey: e.editionKey,
      title: e.title || base.title,
      cover: e.cover,
      publisher: e.publisher,
      editionDate: e.editionDate,
      pageCount: e.pageCount,
      language: e.language,
      isbn: e.isbn,
      format: e.format,
    });
  return (
    <div className="edition-step">
      <button type="button" className="link-btn" onClick={onBack}>
        <ChevronLeft aria-hidden="true" /> Volver a los resultados
      </button>
      <h3 className="edition-step__title">{work.title}</h3>
      <p className="edition-step__sub">
        {work.author}
        {base.firstPublished ? ` · obra publicada en ${base.firstPublished}` : ''}
      </p>
      <p className="index-card__status" role="status">
        {data.loading ? 'Cargando ediciones…' : data.editions.length ? `Elige tu edición${data.total > data.editions.length ? ` · ${data.editions.length} de ${data.total}` : ` · ${data.editions.length}`}` : 'No hay ediciones disponibles: puedes seguir con los datos de la obra.'}
      </p>
      <ul className="results">
        {data.editions.map((e) => {
          const owned = ownedMatch({ ...e, author: work.author }, books) === 'isbn';
          return (
            <li key={e.editionKey}>
              <button type="button" className="result" onClick={() => pick(e)} disabled={owned} data-kind="edition">
                <span className="result__cover">
                  <Cover book={{ ...e, title: e.title || work.title, author: work.author, id: e.editionKey }} />
                </span>
                <span className="result__text">
                  <strong>{e.title || work.title}</strong>
                  <em>{editionLine(e) || 'Sin datos de edición'}</em>
                  {(e.format || e.isbn) && <small>{[formatName(e.format), e.isbn && `ISBN ${e.isbn}`].filter(Boolean).join(' · ')}</small>}
                  {owned && (
                    <span className="result__tags">
                      <b className="result__tag result__tag--owned">Ya está en tu biblioteca</b>
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!data.loading && (
        <button type="button" className="link-btn" onClick={() => onPick({ ...base, kind: 'work' })}>
          No sé cuál es: seguir solo con los datos de la obra
        </button>
      )}
      <p className="index-card__source">Datos de Open Library</p>
    </div>
  );
}

function ConfirmBook({ initial, manual, books, onBack, onSave }) {
  const [draft, setDraft] = useState(() => ({
    status: 'want',
    publisher: '',
    editionDate: '',
    language: '',
    isbn: '',
    ...initial,
    editionType: editionFromFormat(initial.format) ?? 'paperback',
    pageCount: initial.pageCount ?? '',
    unpaged: false,
  }));
  const [tried, setTried] = useState(false);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const pagesOk = draft.unpaged || Number(draft.pageCount) >= 1;
  const owned = ownedMatch(draft, books);
  const line = editionLine(draft);

  return (
    <form
      className="confirm-book"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (!draft.title.trim() || !pagesOk) return;
        const now = new Date().toISOString();
        // Total desconocido (ebook sin paginación): se sigue por porcentaje, sin páginas ficticias
        const pages = draft.unpaged ? null : Math.max(1, Math.min(20000, Math.round(Number(draft.pageCount))));
        onSave({
          title: draft.title.trim(),
          author: draft.author.trim() || 'Autor desconocido',
          cover: draft.cover || '',
          synopsis: draft.synopsis || '',
          // Fecha de ESTA edición; la de la obra va aparte
          publishedDate: draft.editionDate || '',
          firstPublished: draft.firstPublished || '',
          publisher: draft.publisher.trim(),
          language: draft.language || '',
          categories: draft.categories ?? [],
          isbn: draft.isbn.trim(),
          source: draft.source || 'manual',
          ...(draft.editionKey ? { editionRef: { source: 'openlibrary', id: draft.editionKey } } : null),
          // Identidad de obra verificada (SPEC §25.4): solo la obra de Open Library; Google da ediciones, no obras
          ...(draft.source === 'openlibrary' && /^\/works\/OL\d+W$/.test(draft.workKey ?? '') ? { workRef: { source: 'openlibrary', id: draft.workKey } } : null),
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
      <div className="confirm-book__summary">
        <span className="confirm-book__preview">
          <Cover book={{ ...draft, id: draft.key || draft.title }} />
        </span>
        <div>
          <p className="confirm-book__kicker">{manual ? 'Alta manual' : draft.kind === 'work' ? 'Datos de la obra' : 'Edición elegida'}</p>
          <strong className="confirm-book__name">{draft.title || 'Sin título'}</strong>
          {line && <span className="confirm-book__line">{line}</span>}
          {draft.firstPublished && <span className="confirm-book__line">Obra publicada en {draft.firstPublished}</span>}
          {owned && <b className="result__tag result__tag--owned">{owned === 'isbn' ? 'Esta edición ya está en tu biblioteca' : 'Ya tienes un libro con este título'}</b>}
        </div>
      </div>
      <div className="confirm-book__grid">
        <label className="confirm-book__wide">
          <span>Título</span>
          <input value={draft.title} onChange={(e) => set({ title: e.target.value })} required autoFocus={manual} aria-invalid={tried && !draft.title.trim() ? true : undefined} />
        </label>
        <label className="confirm-book__wide">
          <span>Autoría</span>
          <input value={draft.author} onChange={(e) => set({ author: e.target.value })} />
        </label>
        <label>
          <span>Páginas</span>
          <input type="number" inputMode="numeric" min="1" max="20000" value={draft.pageCount} placeholder="Sin dato" disabled={draft.unpaged} onChange={(e) => set({ pageCount: e.target.value })} aria-invalid={tried && !pagesOk ? true : undefined} aria-describedby="cb-pages-help" />
        </label>
        <label className="confirm-book__check">
          <input type="checkbox" checked={draft.unpaged} onChange={(e) => set({ unpaged: e.target.checked })} />
          <span>Sin total (ebook)</span>
        </label>
        {tried && !pagesOk && (
          <small id="cb-pages-help" className="confirm-book__error confirm-book__wide" role="alert">
            Escribe el número de páginas o marca «Sin total».
          </small>
        )}
        <label>
          <span>Editorial</span>
          <input value={draft.publisher} onChange={(e) => set({ publisher: e.target.value })} placeholder="Sin dato" />
        </label>
        <label>
          <span>Fecha de la edición</span>
          <input value={draft.editionDate} onChange={(e) => set({ editionDate: e.target.value })} placeholder="Sin dato" />
        </label>
        <label>
          <span>Idioma</span>
          <select value={langCode(draft.language)} onChange={(e) => set({ language: e.target.value })}>
            <option value="">Sin dato</option>
            {/* Un idioma del proveedor fuera de la lista se conserva como opción */}
            {draft.language && !LANG_NAMES[langCode(draft.language)] && <option value={langCode(draft.language)}>{languageName(draft.language)}</option>}
            {Object.entries(LANG_NAMES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>ISBN</span>
          <input value={draft.isbn} inputMode="numeric" onChange={(e) => set({ isbn: e.target.value })} placeholder="Sin dato" />
        </label>
        <label>
          <span>Balda</span>
          <select value={draft.status} onChange={(e) => set({ status: e.target.value })}>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Formato</span>
          <select value={draft.editionType} onChange={(e) => set({ editionType: e.target.value })}>
            {SELECTABLE_EDITION_IDS.map((k) => [k, EDITIONS[k]]).map(([k, v]) => (
              <option key={k} value={k}>
                {v.short}
              </option>
            ))}
          </select>
        </label>
        {draft.editionType === 'sprayed_edges' && (
          <div className="confirm-book__wide">
            <EdgePicker value={draft.sprayedEdgeStyle ?? 'constellations'} onChange={(sprayedEdgeStyle) => set({ sprayedEdgeStyle })} />
          </div>
        )}
        {manual && (
          <label className="confirm-book__wide">
            <span>URL de la portada (opcional)</span>
            <input type="url" value={draft.cover} onChange={(e) => set({ cover: e.target.value })} placeholder="https://…" />
          </label>
        )}
      </div>
      {draft.synopsis && (
        <details className="confirm-book__more">
          <summary>Sinopsis</summary>
          <p className="confirm-book__synopsis">{draft.synopsis}</p>
        </details>
      )}
      <div className="confirm-book__actions">
        <button type="button" className="link-btn" onClick={onBack}>
          {manual ? 'Volver a buscar' : 'Elegir otro resultado'}
        </button>
        <button type="submit" className="stamp-btn">
          Colocar en la balda
        </button>
      </div>
    </form>
  );
}
