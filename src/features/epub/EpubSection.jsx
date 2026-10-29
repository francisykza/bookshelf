// «Leer aquí» en la Ficha (SPEC §54.3): vincular un EPUB a ESTE ejemplar (sin crear otro libro ni tocar su portada,
// edición o páginas), continuar la lectura y, en un menú discreto, cambiar o quitar el archivo de este dispositivo.
// Elegir un archivo solo lo analiza; la vinculación se guarda al confirmar. JSZip se carga al elegir un archivo y el
// lector, al abrirlo; nunca con la habitación.
import { BookOpenText, Check, FileText, MoreHorizontal, Search, X } from 'lucide-react';
import { Suspense, lazy, useEffect, useId, useMemo, useRef, useState } from 'react';
import { EDITIONS, visualEdition } from '../../domain/books';
import { MATCH_MESSAGES, matchEpub, normalizeBib } from '../../domain/bookMatch';
import { Cover } from '../../components/shelf/BookItem';
import { useCloud } from '../../state/cloudSync';
import { useLibrary } from '../../state/useLibrary';
import { deleteEpub, getEpub, putEpub } from './epubStore';

const EpubReader = lazy(() => import('./EpubReader').then((m) => ({ default: m.EpubReader })));
const MAX_FILE = 60 * 1024 * 1024;
const mib = (b) => (b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1).replace('.', ',')} MiB`);

/** Edición y páginas del ejemplar, solo si existen. */
const editionLine = (book) => [EDITIONS[visualEdition(book)]?.label, book.pageCount ? `${book.pageCount} páginas` : null].filter(Boolean).join(' · ');

export function EpubSection({ book, autoRead = false, onOpenBook, onComplete, timer, soundOn, onToggleSound }) {
  const uid = useId();
  const { state, actions } = useLibrary();
  const cloud = useCloud();
  const userId = cloud.user?.id ?? null;
  const [local, setLocal] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reading, setReading] = useState(false);
  const [picked, setPicked] = useState(null);
  const [menu, setMenu] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const inputRef = useRef(null);
  const autoDone = useRef(false);

  useEffect(() => {
    let alive = true;
    setLocal(undefined);
    getEpub(userId, book.id)
      .then((r) => alive && setLocal(r ? { hash: r.hash, name: r.name, size: r.size } : null))
      .catch(() => alive && setLocal(null));
    return () => {
      alive = false;
    };
  }, [book.id, userId]);

  // Llegar con la intención de leer (vincular desde otro libro, «Continuar lectura» de la habitación)
  useEffect(() => {
    if (autoRead && local && !autoDone.current) {
      autoDone.current = true;
      setReading(true);
    }
  }, [autoRead, local]);

  const choose = async (file) => {
    setError('');
    setNotice('');
    setMenu(false);
    if (!file) return;
    if (file.size > MAX_FILE) {
      setError(`El archivo pesa ${mib(file.size)} y el máximo es ${mib(MAX_FILE)}.`);
      return;
    }
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      const [{ default: JSZip }, epub] = await Promise.all([import('jszip'), import('./epubFile')]);
      const parsed = await epub.openEpub(JSZip, buffer);
      const hash = await epub.epubHash(buffer);
      const meta = { title: parsed.title, author: parsed.author, isbn: parsed.isbn, chapters: parsed.chapters.length, lite: parsed.lite };
      // El mismo archivo que ya está vinculado (otro dispositivo, o volver a elegirlo): se guarda aquí sin preguntar
      if (book.epub?.hash === hash) {
        await putEpub(userId, book.id, { data: buffer, hash, name: file.name, size: file.size });
        setLocal({ hash, name: file.name, size: file.size });
        setNotice('Es el mismo EPUB: tu posición y tus notas te esperan.');
        setReading(true);
        return;
      }
      setPicked({ buffer, hash, name: file.name, size: file.size, meta, targetId: book.id, choosing: false, query: '' });
    } catch (e) {
      setError(e?.friendly ? e.message : 'No se ha podido leer este archivo.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const link = async () => {
    const target = state.books.find((b) => b.id === picked.targetId);
    if (!target) return;
    setBusy(true);
    setError('');
    try {
      // Primero el archivo (sustituye al anterior en la misma transacción); si falla, nada cambia
      await putEpub(userId, target.id, { data: picked.buffer, hash: picked.hash, name: picked.name, size: picked.size });
      const old = target.epub;
      actions.updateBook(target.id, {
        epub: { hash: picked.hash, name: picked.name, size: picked.size, title: picked.meta.title, author: picked.meta.author, isbn: picked.meta.isbn || undefined, chapters: picked.meta.chapters, lite: picked.meta.lite, anchors: 2, linkedAt: new Date().toISOString() },
        // La posición del archivo anterior se queda con su huella (nunca se aplica al nuevo)
        ...(target.epubPosition && old?.hash && !target.epubPosition.hash ? { epubPosition: { ...target.epubPosition, hash: old.hash } } : null),
      });
      setPicked(null);
      if (target.id === book.id) {
        setLocal({ hash: picked.hash, name: picked.name, size: picked.size });
        setReading(true);
      } else onOpenBook?.(target.id);
    } catch (e) {
      setError(e?.name === 'QuotaExceededError' ? 'No queda espacio en este dispositivo para guardar el EPUB. Tu vinculación anterior sigue igual.' : 'No se ha podido guardar el EPUB en este dispositivo. Tu vinculación anterior sigue igual.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setConfirmRemove(false);
    setMenu(false);
    try {
      await deleteEpub(userId, book.id);
      setLocal(null);
      setNotice('El archivo se ha quitado de este dispositivo. Tu posición y tus notas se conservan.');
    } catch {
      setError('No se ha podido quitar el archivo.');
    }
  };

  // El menú se cierra con Escape sin cerrar la ficha
  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setMenu(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [menu]);

  const pick = () => {
    setMenu(false);
    inputRef.current?.click();
  };

  return (
    <section className="epub-box" aria-labelledby={`${uid}-title`}>
      <input ref={inputRef} id={`${uid}-epub`} className="epub-file" type="file" accept=".epub,application/epub+zip" tabIndex={-1} aria-hidden="true" disabled={busy} onChange={(e) => choose(e.target.files?.[0])} />
      <div className="epub-box__head">
        <FileText aria-hidden="true" className="epub-box__icon" />
        <div>
          <h4 id={`${uid}-title`}>Leer aquí</h4>
          <p>
            {local === undefined
              ? ' '
              : local
                ? `${local.name} · ${mib(local.size)}${book.epub?.lite ? ' · modo ligero' : ''}`
                : book.epub
                  ? 'Selecciona el mismo EPUB para continuar en este dispositivo.'
                  : 'Vincula un EPUB a este ejemplar.'}
          </p>
        </div>
        {local && (
          <div className="epub-box__more" data-escape-local={menu ? 'open' : undefined}>
            <button type="button" className="icon-btn" aria-haspopup="menu" aria-expanded={menu} aria-label="Más opciones del EPUB" onClick={() => setMenu((v) => !v)}>
              <MoreHorizontal aria-hidden="true" />
            </button>
            {menu && (
              <ul className="options-menu__list" role="menu">
                <li role="none">
                  <button type="button" role="menuitem" onClick={pick}>
                    Cambiar archivo
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="options-menu__danger"
                    onClick={() => {
                      setMenu(false);
                      setConfirmRemove(true);
                    }}
                  >
                    Quitar de este dispositivo
                  </button>
                </li>
              </ul>
            )}
          </div>
        )}
      </div>
      {local ? (
        <button type="button" className="sheet-btn sheet-btn--primary craft craft--terra epub-box__main" onClick={() => setReading(true)}>
          <BookOpenText aria-hidden="true" />
          Continuar lectura
        </button>
      ) : (
        local !== undefined && (
          <>
            <button type="button" className="sheet-btn sheet-btn--primary craft craft--terra epub-box__main" onClick={pick} disabled={busy}>
              <FileText aria-hidden="true" />
              {busy ? 'Comprobando el archivo…' : 'Elegir EPUB'}
            </button>
            <p className="epub-box__hand">Tu portada y edición se conservarán.</p>
          </>
        )
      )}
      {confirmRemove && (
        <div className="confirm-inline" role="alertdialog" aria-label="Quitar el EPUB de este dispositivo">
          <span>¿Quitar el archivo de este dispositivo? Tu libro, tus notas y tu posición se conservan.</span>
          <button type="button" className="link-btn link-btn--danger" onClick={remove}>
            Sí, quitar
          </button>
          <button type="button" className="link-btn" onClick={() => setConfirmRemove(false)}>
            Cancelar
          </button>
        </div>
      )}
      {notice && (
        <p className="epub-box__note" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="epub-box__error" role="alert">
          {error}
        </p>
      )}
      {picked && <LinkSheet picked={picked} books={state.books} current={book} busy={busy} onChange={(patch) => setPicked((p) => ({ ...p, ...patch }))} onConfirm={link} onCancel={() => setPicked(null)} error={error} />}
      {reading && local && (
        <Suspense fallback={null}>
          <EpubReader book={book} fileHash={local.hash} onClose={() => setReading(false)} onComplete={onComplete} timer={timer} soundOn={soundOn} onToggleSound={onToggleSound} />
        </Suspense>
      )}
    </section>
  );
}

/** Confirmación de la vinculación: tu ejemplar, el archivo elegido, la explicación y las acciones (SPEC §54.3). */
function LinkSheet({ picked, books, current, busy, onChange, onConfirm, onCancel, error }) {
  const target = books.find((b) => b.id === picked.targetId) ?? current;
  const verdict = matchEpub(target, picked.meta);
  const replacing = target.epub?.hash && target.epub.hash !== picked.hash;
  const headRef = useRef(null);
  useEffect(() => {
    headRef.current?.focus({ preventScroll: true });
  }, [picked.choosing]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (picked.choosing) onChange({ choosing: false });
      else onCancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [picked.choosing, onChange, onCancel]);
  const results = useMemo(() => {
    const q = normalizeBib(picked.query);
    return books.filter((b) => !q || normalizeBib(`${b.title} ${b.author}`).includes(q)).slice(0, 40);
  }, [books, picked.query]);

  return (
    <div className="epub-link" role="dialog" aria-modal="true" aria-label="Vincular EPUB" data-escape-local="open">
      <div className="epub-link__sheet">
        <header className="epub-link__head">
          <button type="button" className="icon-btn" onClick={picked.choosing ? () => onChange({ choosing: false }) : onCancel} aria-label={picked.choosing ? 'Volver a la vinculación' : 'Cancelar sin vincular'}>
            <X aria-hidden="true" />
          </button>
          <h3 ref={headRef} tabIndex={-1}>
            {picked.choosing ? 'Elegir otro libro' : 'Vincular EPUB'}
          </h3>
        </header>
        {picked.choosing ? (
          <div className="epub-link__pick">
            <label className="epub-link__search">
              <Search aria-hidden="true" />
              <input type="search" value={picked.query} onChange={(e) => onChange({ query: e.target.value })} placeholder="Busca por título o autor" aria-label="Buscar en mi biblioteca" />
            </label>
            <ul>
              {results.map((b) => (
                <li key={b.id}>
                  <button type="button" aria-current={b.id === picked.targetId ? 'true' : undefined} onClick={() => onChange({ targetId: b.id, choosing: false })}>
                    <span className="epub-link__mini" aria-hidden="true">
                      <Cover book={b} />
                    </span>
                    <span>
                      <b>{b.title}</b>
                      <small>{b.author}</small>
                    </span>
                    {b.id === picked.targetId && <Check aria-hidden="true" />}
                  </button>
                </li>
              ))}
              {!results.length && <li className="epub-link__none">No hay libros con esa búsqueda.</li>}
            </ul>
          </div>
        ) : (
          <div className="epub-link__body">
            <section className="epub-link__card" aria-label="Tu ejemplar">
              <span className="epub-link__cover" aria-hidden="true">
                <Cover book={target} />
              </span>
              <div>
                <small>Tu ejemplar</small>
                <b>{target.title}</b>
                {target.author && <span>{target.author}</span>}
                {editionLine(target) && <em>{editionLine(target)}</em>}
              </div>
            </section>
            <span className="epub-link__thread" aria-hidden="true" />
            <section className="epub-link__card epub-link__card--file" aria-label="Archivo seleccionado">
              <FileText aria-hidden="true" className="epub-link__doc" />
              <div>
                <small>Archivo seleccionado</small>
                <b>{picked.name}</b>
                <span>{picked.meta.title || picked.meta.author ? [picked.meta.title, picked.meta.author].filter(Boolean).join(' · ') : 'El archivo no indica título ni autor.'}</span>
              </div>
            </section>
            <p className="epub-link__verdict" data-verdict={verdict}>
              {MATCH_MESSAGES[verdict]}
            </p>
            {replacing && <p className="epub-link__note">Sustituirá a «{target.epub.name}». Tus notas y tu progreso se conservan; en el archivo nuevo empezarás desde su índice.</p>}
            <p className="epub-link__note">El avance del EPUB se registrará por porcentaje. Tu portada y edición no cambian.</p>
            <p className="epub-link__note epub-link__note--device">El archivo se guarda en este dispositivo.</p>
            {error && (
              <p className="epub-box__error" role="alert">
                {error}
              </p>
            )}
            <button type="button" className="sheet-btn sheet-btn--primary craft craft--terra epub-link__go" onClick={onConfirm} disabled={busy}>
              {busy ? 'Guardando…' : verdict === 'mismatch' ? 'Vincular de todos modos' : 'Vincular y leer'}
            </button>
            <div className="epub-link__alt">
              <button type="button" className="link-btn" onClick={() => onChange({ choosing: true })}>
                Elegir otro libro
              </button>
              <button type="button" className="link-btn" onClick={onCancel}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
