// Lector EPUB (SPEC §53), cargado solo al pulsar «Leer». Cada capítulo se pinta en un iframe con `sandbox` sin
// scripts; la posición (capítulo + fracción) se guarda en el libro y viaja con la cuenta, sin tocar el registro de
// lectura; al cerrar se ofrece registrar lo avanzado con la operación normal. Seleccionar texto crea una nota del libro.
import JSZip from 'jszip';
import { ChevronLeft, ChevronRight, List, Minus, NotebookPen, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { newId, percentRead, trackUnit } from '../../domain/books';
import { meaningOf } from '../../domain/quoteMeanings';
import { MarkerPicker } from '../../components/book/Annotations';
import { modalRoot } from '../../components/panels/modalRoot';
import { useLibrary } from '../../state/useLibrary';
import { chapterBody, openEpub, positionPercent } from './epubFile';
import { getEpub } from './epubStore';

const SAVE_EVERY = 5000;
const FONT_KEY = 'bookshelf:epub-font';
const readFont = () => {
  try {
    return Math.min(26, Math.max(14, Number(localStorage.getItem(FONT_KEY)) || 18));
  } catch {
    return 18;
  }
};

const pageCss = (size) => `
  html { background: #faf5e8; overflow: hidden; }
  body { box-sizing: border-box; max-width: 38em; margin: 0 auto; padding: 20px 20px 96px; color: #2c1e14;
    font: ${size}px/1.65 Lora, Georgia, serif; overflow-wrap: break-word; -webkit-text-size-adjust: 100%; }
  h1, h2, h3, h4 { font-family: 'Cormorant Garamond', Georgia, serif; line-height: 1.2; }
  img, svg, image { max-width: 100%; height: auto; }
  a, .epub-link { color: #8f4529; }
  .epub-link { text-decoration: underline; cursor: pointer; }
  ::selection { background: #f7dc6f; }
  .epub-alt { display: inline-block; padding: 2px 6px; border: 1px dashed #b89f7f; border-radius: 4px; color: #6a5847; font-size: .85em; }
  .epub-note { color: #6a5847; font-style: italic; }
  table { max-width: 100%; display: block; overflow-x: auto; }
`;

export function EpubReader({ book: initial, onClose }) {
  const { state, actions } = useLibrary();
  const book = state.books.find((b) => b.id === initial.id) ?? initial;
  const meanings = state.settings.quoteMeanings;
  const [epub, setEpub] = useState(null);
  const [error, setError] = useState('');
  const [chapter, setChapter] = useState(0);
  const [doc, setDoc] = useState(null);
  const [font, setFont] = useState(readFont);
  const [frac, setFrac] = useState(0);
  const [panel, setPanel] = useState(null);
  const [selection, setSelection] = useState('');
  const [color, setColor] = useState('yellow');
  const [notice, setNotice] = useState('');
  const [asking, setAsking] = useState(false);
  const frameRef = useRef(null);
  const pageRef = useRef(null);
  const [frameH, setFrameH] = useState(0);
  const restore = useRef(0);
  const fracRef = useRef(0);
  // Capítulo que se VE (el del documento pintado), para que ningún manejador guarde una posición de otro
  const shownRef = useRef(0);
  const lastSave = useRef(0);
  const urls = useRef([]);
  const rootRef = useRef(null);

  // Abrir el archivo de este dispositivo y volver a la posición guardada (solo si es el mismo archivo)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rec = await getEpub(book.id);
        if (!rec) throw Object.assign(new Error('El archivo ya no está en este dispositivo.'), { friendly: true });
        const opened = await openEpub(JSZip, rec.data);
        if (!alive) return;
        const pos = book.epubPosition && (!book.epub?.hash || book.epub.hash === rec.hash) ? book.epubPosition : null;
        const idx = pos ? Math.max(0, opened.chapters.findIndex((c) => c.href === pos.href)) : 0;
        restore.current = pos ? pos.frac : 0;
        setEpub(opened);
        setChapter(idx >= 0 ? idx : Math.min(pos?.chapter ?? 0, opened.chapters.length - 1));
        if (opened.lite) setNotice('Modo ligero: este libro tiene muchas imágenes y algunas se muestran como texto.');
      } catch (e) {
        if (alive) setError(e?.friendly ? e.message : 'No se ha podido abrir este EPUB.');
      }
    })();
    return () => {
      alive = false;
    };
    // Solo al abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Capítulo → HTML sin scripts; las imágenes del anterior se liberan
  useEffect(() => {
    if (!epub) return undefined;
    let alive = true;
    const idx = chapter;
    chapterBody(epub, idx)
      .then(({ body, urls: next }) => {
        if (!alive) return next.forEach((u) => URL.revokeObjectURL(u));
        urls.current.forEach((u) => URL.revokeObjectURL(u));
        urls.current = next;
        setDoc({ chapter: idx, body });
      })
      .catch((e) => alive && setError(e?.friendly ? e.message : 'No se ha podido abrir este capítulo.'));
    return () => {
      alive = false;
    };
  }, [epub, chapter]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const shown = doc?.chapter ?? chapter;
  shownRef.current = shown;
  const percent = epub ? positionPercent(epub.chapters, { chapter: shown, frac }) : 0;

  const save = useCallback(
    (ch, f, force = false) => {
      if (!epub) return;
      const now = Date.now();
      if (!force && now - lastSave.current < SAVE_EVERY) return;
      lastSave.current = now;
      actions.updateBook(book.id, {
        epubPosition: { chapter: ch, href: epub.chapters[ch].href, frac: Math.round(f * 1000) / 1000, percent: positionPercent(epub.chapters, { chapter: ch, frac: f }), at: new Date().toISOString() },
      });
    },
    [epub, actions, book.id],
  );

  const go = (next, at = 0) => {
    if (!epub || next < 0 || next >= epub.chapters.length) return;
    save(shownRef.current, fracRef.current, true);
    restore.current = at;
    setSelection('');
    setPanel(null);
    if (next === shownRef.current) applyScroll(at);
    else setChapter(next);
  };

  // Se desplaza el contenedor de la app, no el iframe (sus eventos llegan en todos los navegadores)
  const applyScroll = (f) => {
    const el = pageRef.current;
    if (el) el.scrollTop = f * Math.max(0, el.scrollHeight - el.clientHeight);
  };
  const onPageScroll = () => {
    const el = pageRef.current;
    if (!el) return;
    const f = el.scrollHeight > el.clientHeight ? el.scrollTop / (el.scrollHeight - el.clientHeight) : 1;
    fracRef.current = f;
    setFrac(f);
    save(shownRef.current, f);
  };
  // Alto del capítulo: el iframe crece con su contenido (también cuando cargan las imágenes)
  const measure = () => {
    const d = frameRef.current?.contentDocument;
    if (!d?.querySelector('[data-epub-chapter]')) return;
    const h = Math.ceil(d.documentElement.scrollHeight);
    setFrameH((prev) => (Math.abs(prev - h) > 1 ? h : prev));
  };
  // Primera medida de un capítulo: se vuelve a la posición pendiente
  const pendingRestore = useRef(null);
  const restoredKey = useRef('');
  useEffect(() => {
    if (!frameH || pendingRestore.current == null) return;
    const at = pendingRestore.current;
    pendingRestore.current = null;
    requestAnimationFrame(() => {
      applyScroll(at);
      fracRef.current = at;
      setFrac(at);
    });
  }, [frameH]);

  // El documento del capítulo, una sola vez: medida, posición pendiente y (donde el navegador lo permite) saltos por
  // enlaces internos. WebKit no ejecuta escuchadores dentro de un iframe sin scripts: por eso la selección y el alto se
  // comprueban también sondeando, y los enlaces internos no llevan `href` (nunca navegan solos)
  const onFrameLoad = () => {
    const win = frameRef.current?.contentWindow;
    const d = win?.document;
    if (!d || !d.querySelector('[data-epub-chapter]') || d.documentElement.dataset.wired) return false;
    d.documentElement.dataset.wired = '1';
    // La posición se restaura una vez por capítulo y tamaño de letra (WebKit puede volver a cargar el documento)
    const key = `${shownRef.current}-${font}`;
    if (restoredKey.current !== key) {
      restoredKey.current = key;
      pendingRestore.current = restore.current;
      if (frameH) setFrameH(0);
    }
    requestAnimationFrame(measure);
    d.addEventListener('click', (e) => {
      const a = e.target.closest?.('[data-epub-href]');
      if (!a) return;
      e.preventDefault();
      const href = a.getAttribute('data-epub-href');
      const i = href ? epub.chapters.findIndex((c) => c.href === href) : -1;
      if (i >= 0) go(i, 0);
    });
    // La selección se lee al cambiar y, por si el navegador no avisa dentro del iframe, al soltar el dedo o una tecla
    const readSelection = () => setSelection(win.getSelection()?.toString().trim().slice(0, 2000) ?? '');
    for (const type of ['selectionchange', 'pointerup', 'touchend', 'keyup']) d.addEventListener(type, readSelection);
    return true;
  };

  const saveNote = () => {
    if (!selection) return;
    actions.addQuote(book.id, { id: newId('q'), text: selection, color, page: null, epub: { chapter: shownRef.current, href: epub.chapters[shownRef.current].href, frac: Math.round(fracRef.current * 1000) / 1000 } });
    frameRef.current?.contentWindow?.getSelection()?.removeAllRanges();
    setSelection('');
    setNotice(`Nota guardada en «Mi diario» · ${meaningOf(meanings, color).label}`);
  };

  const close = useCallback(() => {
    save(shownRef.current, fracRef.current, true);
    if (epub && percent > percentRead(book) + 0.5 && book.status !== 'read') setAsking(true);
    else onClose();
  }, [save, epub, percent, book, onClose]);

  const register = () => {
    const target = trackUnit(book) === 'pages' ? Math.round((book.pageCount * percent) / 100) : percent;
    actions.setPage(book.id, target, 'epub');
    onClose();
  };

  // Cambiar la letra recarga el capítulo: se vuelve al mismo punto
  useEffect(() => {
    restore.current = fracRef.current;
    try {
      localStorage.setItem(FONT_KEY, String(font));
    } catch {
      // preferencia del dispositivo, opcional
    }
  }, [font]);

  // Modal de verdad: Escape cierra el lector (no la ficha) y lo de detrás queda inerte
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (panel) setPanel(null);
      else if (asking) setAsking(false);
      else close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [panel, asking, close]);
  useEffect(() => {
    const behind = [...modalRoot().children].filter((el) => el !== rootRef.current && !el.hasAttribute('inert'));
    behind.forEach((el) => el.setAttribute('inert', ''));
    rootRef.current?.querySelector('button')?.focus({ preventScroll: true });
    return () => behind.forEach((el) => el.removeAttribute('inert'));
  }, []);

  const srcDoc = useMemo(() => (doc == null ? null : `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${pageCss(font)}</style></head><body data-epub-chapter="">${doc.body}</body></html>`), [doc, font]);
  useEffect(() => {
    if (srcDoc == null) return undefined;
    let frame = 0;
    let tries = 0;
    const tick = () => {
      if (onFrameLoad() || ++tries > 180) return;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // onFrameLoad se rehace en cada render; basta con reintentar al cambiar el documento
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcDoc]);
  // Selección del capítulo: además de los eventos, se comprueba cada 400 ms (WebKit no siempre avisa dentro del iframe)
  useEffect(() => {
    const id = setInterval(() => {
      const text = frameRef.current?.contentWindow?.getSelection?.()?.toString().trim().slice(0, 2000) ?? '';
      setSelection((prev) => (prev === text ? prev : text));
      measure();
    }, 400);
    return () => clearInterval(id);
  }, []);
  const notes = book.quotes.filter((q) => q.epub);
  const title = epub?.chapters[shown]?.title ?? '';

  return createPortal(
    <div ref={rootRef} className="epub-reader" role="dialog" aria-modal="true" aria-label={`Leer ${book.title}`}>
      <header className="epub-reader__bar">
        <button type="button" className="epub-icon" onClick={close} aria-label="Cerrar el lector">
          <X aria-hidden="true" />
        </button>
        <p className="epub-reader__where">
          <b>{book.title}</b>
          <span className="epub-reader__line">
            <span className="epub-reader__chapter">{title}</span>
            {epub && <span className="epub-reader__pct">{percent.toLocaleString('es-ES')} %</span>}
          </span>
        </p>
        <button type="button" className="epub-icon" onClick={() => setFont((f) => Math.max(14, f - 2))} aria-label="Letra más pequeña" disabled={font <= 14}>
          <Minus aria-hidden="true" />
        </button>
        <button type="button" className="epub-icon" onClick={() => setFont((f) => Math.min(26, f + 2))} aria-label="Letra más grande" disabled={font >= 26}>
          <Plus aria-hidden="true" />
        </button>
        <button type="button" className="epub-icon" aria-expanded={panel === 'toc'} onClick={() => setPanel((p) => (p === 'toc' ? null : 'toc'))} aria-label="Índice" disabled={!epub}>
          <List aria-hidden="true" />
        </button>
        <button type="button" className="epub-icon" aria-expanded={panel === 'notes'} onClick={() => setPanel((p) => (p === 'notes' ? null : 'notes'))} aria-label="Mis notas de este libro" disabled={!epub}>
          <NotebookPen aria-hidden="true" />
        </button>
      </header>
      <div className="epub-reader__progress" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>

      <div className="epub-reader__body">
      <div ref={pageRef} className="epub-reader__page" onScroll={onPageScroll}>
        {error ? (
          <p className="epub-reader__error" role="alert">
            {error}
          </p>
        ) : srcDoc == null ? (
          <p className="epub-reader__loading">Abriendo el libro…</p>
        ) : (
          <iframe key={`${shown}-${font}`} ref={frameRef} title={title || 'Capítulo'} className="epub-reader__frame" sandbox="allow-same-origin" scrolling="no" style={{ height: frameH || '100%' }} srcDoc={srcDoc} onLoad={onFrameLoad} />
        )}
      </div>
        {panel && epub && (
          <aside className="epub-reader__panel" aria-label={panel === 'toc' ? 'Índice' : 'Mis notas de este libro'}>
            {panel === 'toc' ? (
              <ol>
                {epub.chapters.map((c, i) => (
                  <li key={c.href}>
                    <button type="button" aria-current={i === chapter ? 'true' : undefined} onClick={() => go(i, 0)}>
                      {c.title}
                    </button>
                  </li>
                ))}
              </ol>
            ) : notes.length ? (
              <ul>
                {notes.map((q) => (
                  <li key={q.id}>
                    <button type="button" onClick={() => go(Math.max(0, epub.chapters.findIndex((c) => c.href === q.epub.href)), q.epub.frac ?? 0)}>
                      <span className="epub-reader__swatch" style={{ '--marker': meaningOf(meanings, q.color).hex }} aria-hidden="true" />
                      {q.text}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Selecciona un fragmento del texto para guardarlo como nota.</p>
            )}
          </aside>
        )}
      </div>

      <footer className="epub-reader__foot">
        {selection ? (
          <div className="epub-reader__save" role="group" aria-label="Guardar el fragmento como nota">
            <span id="epub-color" className="sr-only-focus">
              Color de la nota
            </span>
            <MarkerPicker meanings={meanings} value={color} onChange={setColor} legendId="epub-color" />
            <button type="button" className="sheet-btn sheet-btn--primary craft craft--terra" onClick={saveNote}>
              Guardar como nota
            </button>
          </div>
        ) : (
          <nav className="epub-reader__nav" aria-label="Capítulos">
            <button type="button" className="sheet-btn" onClick={() => go(chapter - 1, 0)} disabled={!epub || chapter === 0}>
              <ChevronLeft aria-hidden="true" /> Anterior
            </button>
            <span className="epub-reader__count">{epub ? `${chapter + 1} / ${epub.chapters.length}` : ''}</span>
            <button type="button" className="sheet-btn" onClick={() => go(chapter + 1, 0)} disabled={!epub || chapter >= epub.chapters.length - 1}>
              Siguiente <ChevronRight aria-hidden="true" />
            </button>
          </nav>
        )}
        {notice && (
          <p className="epub-reader__notice" role="status">
            {notice}
          </p>
        )}
      </footer>

      {asking && (
        <div className="epub-reader__ask" role="alertdialog" aria-label="Registrar lo leído">
          <p>Has llegado al {percent.toLocaleString('es-ES')} % de «{book.title}».</p>
          <button type="button" className="sheet-btn sheet-btn--primary craft craft--terra" onClick={register}>
            Registrar hasta el {percent.toLocaleString('es-ES')} %
          </button>
          <button type="button" className="sheet-btn" onClick={onClose}>
            Cerrar sin registrar
          </button>
        </div>
      )}
    </div>,
    modalRoot(),
  );
}
