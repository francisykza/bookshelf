// Lector EPUB (SPEC §53–54), cargado solo al abrirlo. Cada sección se pinta en un iframe con `sandbox` sin scripts; el
// iframe mide lo que su contenido y se desplaza el contenedor (un solo dueño del desplazamiento). La posición se ancla a
// un bloque de texto (resiste cambios de letra y pantalla), se guarda en el dispositivo a los 750 ms y en el libro
// sincronizado como mucho cada 60 s; nunca toca el registro de lectura. Al salir, «Una pausa junto al mar» ofrece
// registrar lo avanzado con la operación de siempre.
//
// Por qué hay un sondeo de 400 ms: WebKit no ejecuta los escuchadores de la app dentro de un iframe con
// `allow-same-origin` y sin `allow-scripts`, y permitir scripts rompería el aislamiento. Mientras el lector está visible
// se consultan la selección, el fragmento (enlaces `#bs-…`) y el alto del documento; sin red, y se detiene al ocultarse.
import JSZip from 'jszip';
import { ArrowLeft, BookmarkCheck, ChevronLeft, ChevronRight, Eye, EyeOff, List, Minus, NotebookPen, Plus, Trees, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { newId, percentRead, trackUnit } from '../../domain/books';
import { meaningOf } from '../../domain/quoteMeanings';
import { MarkerPicker } from '../../components/book/Annotations';
import { modalRoot } from '../../components/panels/modalRoot';
import { Cover } from '../../components/shelf/BookItem';
import { useCloud } from '../../state/cloudSync';
import { useLibrary } from '../../state/useLibrary';
import { ANCHOR_VERSION, chapterBody, openEpub, parseReaderHash, positionPercent } from './epubFile';
import { LOCAL_DELAY, SYNC_EVERY, readLocal, startPosition, syncedPosition, writeLocal } from './epubPosition';
import { getEpub } from './epubStore';

const POLL = 400;
const PREFS_KEY = 'bookshelf:epub-prefs';
const LEADINGS = [1.45, 1.65, 1.85];
const MARGINS = [16, 24, 32];
const DEFAULT_PREFS = { font: 18, leading: 1.65, margin: 24, theme: 'light' };

function readPrefs() {
  try {
    const p = { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
    return {
      font: Math.min(28, Math.max(16, Math.round(Number(p.font)) || 18)),
      leading: LEADINGS.includes(p.leading) ? p.leading : 1.65,
      margin: MARGINS.includes(p.margin) ? p.margin : 24,
      theme: p.theme === 'night' ? 'night' : 'light',
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

const THEMES = {
  light: { bg: '#FAF5E8', ink: '#2C1E14', soft: '#725B46', accent: '#934829', rule: 'rgba(114, 91, 70, 0.22)', select: '#F3DFA2' },
  night: { bg: '#211D19', ink: '#EADFCB', soft: '#C5B69F', accent: '#D6B56D', rule: 'rgba(214, 181, 109, 0.25)', select: '#5B4A2A' },
};

/** Estilos del documento: tipografía editorial sin forzar la jerarquía ni la semántica del EPUB. */
const pageCss = ({ font, leading, margin, theme }) => {
  const t = THEMES[theme];
  return `
  html { background: ${t.bg}; overflow: hidden; }
  body { box-sizing: border-box; max-width: calc(68ch + ${margin * 2}px); margin: 0 auto; padding: 24px ${margin}px 40px;
    color: ${t.ink}; background: ${t.bg}; font: ${font}px/${leading} Lora, Georgia, serif; text-align: left;
    overflow-wrap: break-word; -webkit-text-size-adjust: 100%; }
  h1, h2, h3, h4, h5, h6 { font-family: 'Cormorant Garamond', Georgia, serif; line-height: 1.2; color: ${t.ink}; }
  h1 { font-size: 1.9em; } h2 { font-size: 1.55em; } h3 { font-size: 1.3em; }
  p { margin: 0 0 0.9em; }
  img, svg, image { max-width: 100%; height: auto; }
  figure { margin: 1em 0; }
  hr { border: 0; border-top: 1px solid ${t.rule}; margin: 1.6em auto; width: 40%; }
  blockquote { margin: 1em 0 1em 1.2em; }
  pre { white-space: pre-wrap; }
  a { color: ${t.accent}; }
  ::selection { background: ${t.select}; }
  .epub-alt { display: inline-block; padding: 2px 6px; border: 1px dashed ${t.soft}; border-radius: 4px; color: ${t.soft}; font-size: .85em; }
  .epub-note { color: ${t.soft}; font-style: italic; }
  table { max-width: 100%; display: block; overflow-x: auto; }
  `;
};

const fmt = (n) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });

/** Estado real de la posición frente a la cuenta (sin anunciar una sincronización que no se ha confirmado). */
function positionStatus(cloud) {
  if (!cloud.user) return 'Posición guardada en este dispositivo';
  let dirty = true;
  try {
    dirty = Boolean(JSON.parse(localStorage.getItem('bookshelf:sync') ?? '{}').dirty);
  } catch {
    // sin datos de la cola: se trata como pendiente
  }
  return cloud.status === 'synced' && !dirty ? 'Posición sincronizada' : 'Pendiente de sincronizar';
}

export function EpubReader({ book: initial, fileHash, onClose, onComplete, timer, soundOn, onToggleSound }) {
  const { state, actions } = useLibrary();
  const cloud = useCloud();
  const userId = useRef(cloud.user?.id ?? null).current;
  const book = state.books.find((b) => b.id === initial.id) ?? initial;
  const bookRef = useRef(book);
  bookRef.current = book;
  const meanings = state.settings.quoteMeanings;

  const [epub, setEpub] = useState(null);
  const [error, setError] = useState('');
  const [chapter, setChapter] = useState(0);
  const [doc, setDoc] = useState(null);
  const [prefs, setPrefs] = useState(readPrefs);
  const [percent, setPercent] = useState(0);
  const [panel, setPanel] = useState(null);
  const [selection, setSelection] = useState(null);
  const [note, setNote] = useState(null);
  const [notice, setNotice] = useState('');
  const [toolsHidden, setToolsHidden] = useState(false);
  const [pause, setPause] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [back, setBack] = useState(null);
  const [frameH, setFrameH] = useState(0);
  const [allowImgs, setAllowImgs] = useState(() => new Set());

  const frameRef = useRef(null);
  const pageRef = useRef(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const urls = useRef([]);
  const shownRef = useRef(0);
  const posRef = useRef(null);
  const pending = useRef(null);
  const restoredKey = useRef('');
  /** Ancla pendiente con su hora: caduca a los 2 s para que nunca bloquee el guardado de la posición. */
  const stamp = (a) => (a ? { ...a, pendingSince: Date.now() } : null);
  const pendingActive = () => Boolean(pending.current && Date.now() - pending.current.pendingSince < 2000);
  const localTimer = useRef(0);
  const baseRev = useRef(0);
  const dirty = useRef(false);

  // ── Abrir el archivo y decidir dónde empezar ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rec = await getEpub(userId, book.id);
        if (!rec) throw Object.assign(new Error('Selecciona el mismo EPUB para continuar en este dispositivo.'), { friendly: true });
        const opened = await openEpub(JSZip, rec.data);
        if (!alive) return;
        const local = readLocal(userId, book.id);
        const start = startPosition(local, book.epubPosition, rec.hash);
        const syncedRev = !book.epubPosition?.hash || book.epubPosition.hash === rec.hash ? (book.epubPosition?.rev ?? 0) : 0;
        baseRev.current = Math.max(local?.baseRev ?? 0, start.conflict ? 0 : syncedRev);
        const full = { ...opened, hash: rec.hash, name: rec.name };
        setEpub(full);
        if (start.conflict) setConflict(start.conflict);
        goTo(full, start.pos);
        if (opened.lite) setNotice('Modo ligero: este libro tiene muchas imágenes; algunas se cargan al pedirlas.');
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

  /** Ir a una posición guardada (o al principio) en un EPUB ya abierto. */
  function goTo(opened, pos) {
    const idx = pos ? opened.chapters.findIndex((c) => c.href === pos.href) : 0;
    const ch = idx >= 0 ? idx : Math.min(pos?.chapter ?? 0, opened.chapters.length - 1);
    pending.current = stamp(pos && idx >= 0 ? { block: pos.block, offset: pos.offset, frac: pos.frac } : { frac: 0 });
    restoredKey.current = '';
    if (ch === shownRef.current && frameRef.current) {
      const a = pending.current;
      pending.current = null;
      applyAnchor(a);
      track();
    } else setChapter(ch);
  }

  // ── Documento de la sección ─────────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!epub) return undefined;
    let alive = true;
    const idx = chapter;
    chapterBody(epub, idx, { allow: allowImgs })
      .then(({ body, urls: next }) => {
        if (!alive) return next.forEach((u) => URL.revokeObjectURL(u));
        urls.current.forEach((u) => URL.revokeObjectURL(u));
        urls.current = next;
        setDoc({ chapter: idx, body });
      })
      .catch((e) => alive && setError(e?.friendly ? e.message : 'No se ha podido abrir esta sección.'));
    return () => {
      alive = false;
    };
  }, [epub, chapter, allowImgs]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const shown = doc?.chapter ?? chapter;
  shownRef.current = shown;
  const prefsKey = `${prefs.font}-${prefs.leading}-${prefs.margin}-${prefs.theme}`;
  const srcDoc = useMemo(
    () => (doc == null ? null : `<!doctype html><html lang="es"><head><meta charset="utf-8"><base href="about:srcdoc"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${pageCss(prefs)}</style></head><body data-epub-chapter="">${doc.body}</body></html>`),
    // prefsKey resume las preferencias
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc, prefsKey],
  );

  // ── Ancla: bloque de texto visible arriba ──────────────────────────────────────────────────────────────────────
  const readAnchor = useCallback(() => {
    const el = pageRef.current;
    const d = frameRef.current?.contentDocument;
    if (!el || !epub || !d?.querySelector('[data-epub-chapter]')) return null;
    const top = el.scrollTop;
    const frac = el.scrollHeight > el.clientHeight ? top / (el.scrollHeight - el.clientHeight) : 0;
    let block = null;
    for (const b of d.querySelectorAll('[data-bs-block]')) {
      if (b.offsetTop > top + 8) break;
      block = b;
    }
    const offset = block?.offsetHeight ? Math.min(1, Math.max(0, (top - block.offsetTop) / block.offsetHeight)) : 0;
    const ch = shownRef.current;
    return {
      v: ANCHOR_VERSION,
      hash: epub.hash,
      href: epub.chapters[ch].href,
      chapter: ch,
      block: block ? Number(block.getAttribute('data-bs-block')) : null,
      offset: Math.round(offset * 1000) / 1000,
      frac: Math.round(frac * 1000) / 1000,
      percent: positionPercent(epub.chapters, { chapter: ch, frac }),
      at: new Date().toISOString(),
    };
  }, [epub]);

  function applyAnchor(a) {
    const el = pageRef.current;
    if (!el || !a) return;
    const d = frameRef.current?.contentDocument;
    if (a.fragment) {
      const target = d?.getElementById(a.fragment) ?? d?.querySelector(`[name="${CSS.escape(a.fragment)}"]`);
      if (target) {
        el.scrollTop = Math.max(0, target.offsetTop - 16);
        return;
      }
    }
    const b = a.block != null ? d?.querySelector(`[data-bs-block="${a.block}"]`) : null;
    if (b) el.scrollTop = b.offsetTop + (a.offset ?? 0) * b.offsetHeight;
    else el.scrollTop = (a.frac ?? 0) * Math.max(0, el.scrollHeight - el.clientHeight);
  }

  // ── Guardado: dispositivo (750 ms) y cuenta (60 s, al salir y al ocultarse) ───────────────────────────────────
  const syncNow = useCallback(() => {
    const pos = posRef.current;
    if (!pos || !dirty.current) return;
    const next = syncedPosition(pos, bookRef.current.epubPosition);
    actions.updateBook(bookRef.current.id, { epubPosition: next });
    baseRev.current = next.rev;
    dirty.current = false;
    writeLocal(userId, bookRef.current.id, { pos, baseRev: next.rev, dirty: false });
  }, [actions, userId]);

  function track() {
    // Con un ancla pendiente, el documento aún se está recolocando: ese desplazamiento no es una posición
    if (pendingActive()) return;
    const pos = readAnchor();
    if (!pos) return;
    posRef.current = pos;
    setPercent(pos.percent);
    dirty.current = true;
    clearTimeout(localTimer.current);
    localTimer.current = setTimeout(() => writeLocal(userId, bookRef.current.id, { pos, baseRev: baseRev.current, dirty: true }), LOCAL_DELAY);
  }

  useEffect(() => {
    const every = setInterval(syncNow, SYNC_EVERY);
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return;
      if (posRef.current) writeLocal(userId, bookRef.current.id, { pos: posRef.current, baseRev: baseRev.current, dirty: dirty.current });
      syncNow();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearInterval(every);
      clearTimeout(localTimer.current);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [syncNow, userId]);

  // Otra cuenta: el lector se cierra sin escribir nada en la biblioteca nueva
  useEffect(() => {
    if ((cloud.user?.id ?? null) !== userId) onClose();
  }, [cloud.user, userId, onClose]);

  // ── Documento cargado: medir y volver a la posición; donde el navegador deja, escuchar la selección ─────────────
  function measure() {
    const d = frameRef.current?.contentDocument;
    if (!d?.querySelector('[data-epub-chapter]')) return;
    const h = Math.ceil(d.documentElement.scrollHeight);
    setFrameH((prev) => (Math.abs(prev - h) > 1 ? h : prev));
  }
  function wire() {
    const d = frameRef.current?.contentWindow?.document;
    if (!d || !d.querySelector('[data-epub-chapter]') || d.documentElement.dataset.wired) return false;
    d.documentElement.dataset.wired = '1';
    const key = `${shownRef.current}-${prefsKey}-${allowImgs.size}`;
    if (restoredKey.current !== key) {
      restoredKey.current = key;
      if (!pending.current) pending.current = stamp(posRef.current && posRef.current.href === epub?.chapters[shownRef.current]?.href ? posRef.current : { frac: 0 });
      setFrameH(0);
    }
    requestAnimationFrame(measure);
    // La restauración no depende de que cambie el alto medido (dos documentos pueden medir lo mismo)
    requestAnimationFrame(() => requestAnimationFrame(() => restorePending()));
    d.addEventListener('selectionchange', readSelection);
    return true;
  }
  /** Aplica el ancla pendiente cuando el iframe ya tiene el alto de su documento (si no, lo reintenta). */
  function restorePending(tries = 0) {
    const a = pending.current;
    const f = frameRef.current;
    const d = f?.contentDocument;
    if (!a || !d?.querySelector('[data-epub-chapter]')) return;
    if (f.offsetHeight < d.documentElement.scrollHeight - 2 && tries < 30) {
      requestAnimationFrame(() => restorePending(tries + 1));
      return;
    }
    pending.current = null;
    applyAnchor(a);
    track();
  }
  useEffect(() => {
    if (frameH && pending.current) requestAnimationFrame(() => restorePending());
    // restorePending lee referencias; basta con la medida
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameH]);
  useEffect(() => {
    if (srcDoc == null) return undefined;
    let frame = 0;
    let tries = 0;
    const tick = () => {
      if (wire() || ++tries > 180) return;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // wire se rehace en cada render; se reintenta al cambiar el documento
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcDoc]);

  // ── Selección ──────────────────────────────────────────────────────────────────────────────────────────────────
  function readSelection() {
    const sel = frameRef.current?.contentWindow?.getSelection?.();
    const text = sel?.toString().trim().slice(0, 2000) ?? '';
    if (!text) return setSelection((s) => (s ? null : s));
    const node = sel.anchorNode?.nodeType === 1 ? sel.anchorNode : sel.anchorNode?.parentElement;
    const block = node?.closest?.('[data-bs-block]')?.getAttribute('data-bs-block');
    setSelection((s) => (s?.text === text ? s : { text, block: block != null ? Number(block) : null }));
  }

  // ── Enlaces del documento: `#bs-go-…` (otra sección), `#bs-img-…` (cargar imagen) y notas al pie ──────────────
  // (`<base href="about:srcdoc">` hace que un fragmento se quede en el documento: sin ella, un srcdoc resuelve `#x`
  // contra la dirección de la app y el iframe navegaría fuera del capítulo)
  function followHash() {
    const win = frameRef.current?.contentWindow;
    if (!win || !epub) return;
    let hash = '';
    try {
      hash = win.location.hash;
    } catch {
      return;
    }
    if (!hash || hash === '#') return;
    try {
      win.location.hash = '';
    } catch {
      // sin acceso al fragmento: se queda como está
    }
    const link = parseReaderHash(hash);
    if (!link) return;
    const here = readAnchor();
    if (link.kind === 'img') {
      pending.current = stamp(here);
      setAllowImgs((s) => new Set(s).add(link.index));
      return;
    }
    setBack(here);
    if (link.kind === 'go' && link.chapter !== shownRef.current) {
      syncNow();
      pending.current = stamp(link.fragment ? { fragment: link.fragment, frac: 0 } : { frac: 0 });
      restoredKey.current = '';
      setChapter(link.chapter);
      return;
    }
    applyAnchor({ fragment: link.fragment });
    track();
  }

  // ── Sondeo de respaldo, solo con el lector visible ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      readSelection();
      followHash();
      measure();
    }, POLL);
    return () => clearInterval(id);
  });

  // ── Navegación y paneles ───────────────────────────────────────────────────────────────────────────────────────
  const closePanel = () => {
    setPanel(null);
    requestAnimationFrame(() => triggerRef.current?.focus?.({ preventScroll: true }));
  };
  const goSection = (next, at = { frac: 0 }) => {
    if (!epub || next < 0 || next >= epub.chapters.length) return;
    syncNow();
    setSelection(null);
    setBack(null);
    if (panel) closePanel();
    if (next === shownRef.current) {
      applyAnchor(at);
      track();
      return;
    }
    pending.current = stamp(at);
    restoredKey.current = '';
    setChapter(next);
  };
  const openPanel = (name, e) => {
    triggerRef.current = e?.currentTarget ?? null;
    setPanel((p) => (p === name ? null : name));
  };

  const setPref = (patch) => {
    // Varios cambios seguidos: se conserva el ancla pendiente (el documento recargado aún no ha vuelto a su sitio)
    if (!pendingActive()) pending.current = stamp(readAnchor() ?? posRef.current);
    restoredKey.current = '';
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        // preferencia del dispositivo, opcional
      }
      return next;
    });
  };

  // ── Notas ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const startNote = (fromSelection) => {
    const here = readAnchor();
    setNote({ id: newId('q'), text: fromSelection ? selection.text : '', block: fromSelection ? selection.block : here?.block, section: !fromSelection, anchor: here, comment: '', color: 'yellow' });
    if (panel) setPanel(null);
  };
  const saveNote = () => {
    const text = note.section ? note.comment.trim() : note.text;
    if (!text) return;
    const a = note.anchor;
    // El id se creó al abrir la hoja: repetir el guardado no duplica (el estado ignora un id que ya existe)
    actions.addQuote(book.id, {
      id: note.id,
      text,
      comment: note.section ? '' : note.comment.trim(),
      color: note.color,
      page: null,
      epub: { v: ANCHOR_VERSION, hash: epub.hash, name: epub.name, href: a?.href ?? epub.chapters[shownRef.current].href, chapter: a?.chapter ?? shownRef.current, block: note.block ?? null, frac: a?.frac ?? 0, ...(note.section ? { section: true } : null) },
    });
    frameRef.current?.contentWindow?.getSelection()?.removeAllRanges();
    setSelection(null);
    setNote(null);
    setNotice(`Nota guardada en «Mi diario» · ${meaningOf(meanings, note.color).label}`);
  };

  // ── Salida ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const close = () => {
    const pos = readAnchor() ?? posRef.current;
    if (pos) {
      posRef.current = pos;
      dirty.current = true;
      writeLocal(userId, book.id, { pos, baseRev: baseRev.current, dirty: true });
    }
    syncNow();
    const reached = pos?.percent ?? percent;
    if (epub && book.status !== 'read' && reached > percentRead(bookRef.current) + 0.5) setPause({ reached });
    else onClose();
  };

  // ── Modal: Escape y lo de detrás inerte ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (note) setNote(null);
      else if (pause) setPause(null);
      else if (panel) closePanel();
      else close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });
  useEffect(() => {
    const behind = [...modalRoot().children].filter((el) => el !== rootRef.current && !el.hasAttribute('inert'));
    behind.forEach((el) => el.setAttribute('inert', ''));
    rootRef.current?.querySelector('button')?.focus({ preventScroll: true });
    return () => behind.forEach((el) => el.removeAttribute('inert'));
  }, []);

  const title = epub?.chapters[shown]?.title ?? '';
  const sameFile = (q) => q.epub && (q.epub.hash ? q.epub.hash === epub?.hash : fileHash === book.epub?.hash);
  const notes = book.quotes.filter((q) => q.epub);
  const covered = Boolean(panel || note || pause || conflict);
  const backTo = () => {
    const b = back;
    setBack(null);
    const i = epub.chapters.findIndex((c) => c.href === b.href);
    if (i === shownRef.current) {
      applyAnchor(b);
      track();
    } else goSection(i, b);
  };

  return createPortal(
    <div ref={rootRef} className="epub-reader" data-theme={prefs.theme} data-tools={toolsHidden ? 'hidden' : 'shown'} role="dialog" aria-modal="true" aria-label={`Leer ${book.title}`}>
      {!toolsHidden && (
        <header className="epub-reader__bar" inert={covered ? true : undefined}>
          <button type="button" className="epub-icon" onClick={close} aria-label="Volver a la ficha">
            <ArrowLeft aria-hidden="true" />
          </button>
          <p className="epub-reader__where">
            <b>{book.title}</b>
            <span className="epub-reader__chapter">{title}</span>
          </p>
          <button type="button" className="epub-icon epub-icon--aa" aria-expanded={panel === 'aa'} onClick={(e) => openPanel('aa', e)} aria-label="Letra y tema">
            Aa
          </button>
          <button type="button" className="epub-icon" onClick={() => setToolsHidden(true)} aria-label="Ocultar herramientas">
            <EyeOff aria-hidden="true" />
          </button>
          <span className="epub-reader__ribbon" aria-hidden="true" />
        </header>
      )}

      <div className="epub-reader__body">
        <div ref={pageRef} className="epub-reader__page" onScroll={track} inert={covered ? true : undefined}>
          {error ? (
            <p className="epub-reader__error" role="alert">
              {error}
            </p>
          ) : srcDoc == null ? (
            <p className="epub-reader__loading">Abriendo el libro…</p>
          ) : (
            <iframe key={`${shown}-${prefsKey}`} ref={frameRef} title={title || 'Sección'} className="epub-reader__frame" sandbox="allow-same-origin" scrolling="no" style={{ height: frameH || '100%' }} srcDoc={srcDoc} onLoad={wire} />
          )}
        </div>

        {toolsHidden && (
          <button type="button" className="epub-reader__show" onClick={() => setToolsHidden(false)} aria-label="Mostrar herramientas">
            <Eye aria-hidden="true" />
          </button>
        )}
        {back && !covered && (
          <button type="button" className="epub-reader__back sheet-btn" onClick={backTo}>
            Volver al texto
          </button>
        )}
        {selection && !covered && (
          <button type="button" className="epub-reader__select sheet-btn sheet-btn--primary craft craft--terra" onClick={() => startNote(true)}>
            <NotebookPen aria-hidden="true" /> Guardar en mi diario
          </button>
        )}

        {panel && (
          <aside className="epub-sheet" role="dialog" aria-modal="true" aria-labelledby="epub-sheet-title" data-panel={panel}>
            <header className="epub-sheet__head">
              <h3 id="epub-sheet-title">{{ toc: 'Índice', notes: 'Mi diario', aa: 'Letra y tema', ambient: 'Ambiente' }[panel]}</h3>
              <button type="button" className="epub-icon" onClick={closePanel} aria-label="Cerrar">
                <X aria-hidden="true" />
              </button>
            </header>
            <div className="epub-sheet__body">
              {panel === 'toc' && epub && (
                <ol className="epub-sheet__list">
                  {epub.chapters.map((c, i) => (
                    <li key={c.href}>
                      <button type="button" aria-current={i === shown ? 'true' : undefined} onClick={() => goSection(i)}>
                        {c.title}
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              {panel === 'notes' && epub && (
                <>
                  <button type="button" className="sheet-btn epub-sheet__new" onClick={() => startNote(false)}>
                    <NotebookPen aria-hidden="true" /> Nota de esta sección
                  </button>
                  <p className="epub-sheet__hint">Para guardar un fragmento, selecciónalo en el texto.</p>
                  {notes.length > 0 && (
                    <ul className="epub-sheet__list epub-sheet__notes">
                      {notes.map((q) =>
                        sameFile(q) ? (
                          <li key={q.id}>
                            <button type="button" onClick={() => goSection(Math.max(0, epub.chapters.findIndex((c) => c.href === q.epub.href)), { block: q.epub.block, offset: 0, frac: q.epub.frac ?? 0 })}>
                              <span className="epub-reader__swatch" style={{ '--marker': meaningOf(meanings, q.color).hex }} aria-hidden="true" />
                              <span>
                                {q.text}
                                {q.comment && <em className="epub-sheet__comment">{q.comment}</em>}
                              </span>
                            </button>
                          </li>
                        ) : (
                          <li key={q.id} className="epub-sheet__other">
                            <span className="epub-reader__swatch" style={{ '--marker': meaningOf(meanings, q.color).hex }} aria-hidden="true" />
                            <span>
                              {q.text}
                              <small>De otro archivo{q.epub.name ? ` («${q.epub.name}»)` : ''}: no se puede abrir aquí.</small>
                            </span>
                          </li>
                        ),
                      )}
                    </ul>
                  )}
                </>
              )}
              {panel === 'aa' && (
                <div className="epub-aa">
                  <div className="epub-aa__row" role="group" aria-label="Tamaño de letra">
                    <span>Letra</span>
                    <button type="button" className="epub-icon" onClick={() => setPref({ font: Math.max(16, prefs.font - 1) })} disabled={prefs.font <= 16} aria-label="Letra más pequeña">
                      <Minus aria-hidden="true" />
                    </button>
                    <output className="epub-mono" aria-live="polite">
                      {prefs.font} px
                    </output>
                    <button type="button" className="epub-icon" onClick={() => setPref({ font: Math.min(28, prefs.font + 1) })} disabled={prefs.font >= 28} aria-label="Letra más grande">
                      <Plus aria-hidden="true" />
                    </button>
                  </div>
                  <Choice label="Interlineado" value={prefs.leading} options={LEADINGS.map((v) => [v, fmt(v)])} onChange={(leading) => setPref({ leading })} />
                  <Choice label="Márgenes" value={prefs.margin} options={MARGINS.map((v) => [v, `${v} px`])} onChange={(margin) => setPref({ margin })} />
                  <Choice label="Tema" value={prefs.theme} options={[['light', 'Claro'], ['night', 'Nocturno']]} onChange={(theme) => setPref({ theme })} />
                </div>
              )}
              {panel === 'ambient' && <AmbientPanel timer={timer} soundOn={soundOn} onToggleSound={onToggleSound} />}
            </div>
          </aside>
        )}
      </div>

      {!toolsHidden && (
        <footer className="epub-reader__foot" inert={covered ? true : undefined}>
          <div className="epub-reader__progress">
            <button type="button" className="epub-icon" onClick={() => goSection(shown - 1)} disabled={!epub || shown === 0} aria-label="Sección anterior">
              <ChevronLeft aria-hidden="true" />
            </button>
            <div className="epub-reader__meter">
              <span className="epub-reader__label">
                Posición en el archivo · <span className="epub-reader__pct">{fmt(percent)} %</span>
              </span>
              <span className="epub-reader__track" aria-hidden="true">
                <span style={{ width: `${percent}%` }} />
              </span>
            </div>
            <button type="button" className="epub-icon" onClick={() => goSection(shown + 1)} disabled={!epub || shown >= (epub?.chapters.length ?? 1) - 1} aria-label="Siguiente sección">
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
          <nav className="epub-reader__tools" aria-label="Herramientas del lector">
            <button type="button" aria-expanded={panel === 'toc'} onClick={(e) => openPanel('toc', e)} disabled={!epub}>
              <List aria-hidden="true" />
              Índice
            </button>
            <button type="button" aria-expanded={panel === 'ambient'} onClick={(e) => openPanel('ambient', e)}>
              <Trees aria-hidden="true" />
              Ambiente
            </button>
            <button type="button" aria-expanded={panel === 'notes'} onClick={(e) => openPanel('notes', e)} disabled={!epub}>
              <BookmarkCheck aria-hidden="true" />
              Diario
            </button>
          </nav>
          {notice && (
            <p className="epub-reader__notice" role="status">
              {notice}
            </p>
          )}
        </footer>
      )}

      {conflict && epub && (
        <div className="epub-pause" role="alertdialog" aria-modal="true" aria-label="Dos posiciones distintas">
          <div className="epub-pause__sheet">
            <h3>¿Dónde sigues?</h3>
            <p>Este libro tiene una posición en este dispositivo y otra distinta guardada desde otro.</p>
            <button
              type="button"
              className="sheet-btn"
              onClick={() => {
                const here = conflict.here;
                setConflict(null);
                goTo(epub, here);
              }}
            >
              En este dispositivo · {fmt(conflict.here.percent ?? 0)} %
            </button>
            <button
              type="button"
              className="sheet-btn"
              onClick={() => {
                const other = conflict.other;
                setConflict(null);
                baseRev.current = other.rev ?? baseRev.current;
                goTo(epub, other);
              }}
            >
              En el otro dispositivo · {fmt(conflict.other.percent ?? 0)} %
            </button>
          </div>
        </div>
      )}

      {note && <NoteSheet note={note} meanings={meanings} onChange={(patch) => setNote((n) => ({ ...n, ...patch }))} onSave={saveNote} onCancel={() => setNote(null)} />}

      {pause && (
        <PauseSheet
          book={book}
          reached={pause.reached}
          status={positionStatus(cloud)}
          onRegister={(target) => {
            const latest = bookRef.current;
            if (percentRead(latest) >= target - 0.05) return 'already';
            if (trackUnit(latest) === 'pages') actions.setTracking(latest.id, 'percent');
            actions.setPage(latest.id, target, 'epub');
            onClose();
            if (target >= 100) onComplete?.(latest.id);
            return 'done';
          }}
          onLeave={onClose}
        />
      )}
    </div>,
    modalRoot(),
  );
}

/** Opciones del panel «Aa» como radios. */
function Choice({ label, value, options, onChange }) {
  return (
    <div className="epub-aa__row" role="radiogroup" aria-label={label}>
      <span>{label}</span>
      {options.map(([v, text]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={value === v} className="epub-aa__opt" onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

/** Ambiente: el sonido y el temporizador de siempre (no se crea otro motor ni otro contador). */
function AmbientPanel({ timer, soundOn, onToggleSound }) {
  const mm = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
  return (
    <div className="epub-ambient">
      {onToggleSound && (
        <button type="button" role="switch" aria-checked={Boolean(soundOn)} className="sheet-btn" onClick={onToggleSound}>
          {soundOn ? 'Sonido del mar: activado' : 'Sonido del mar: apagado'}
        </button>
      )}
      {timer && (
        <div className="epub-ambient__timer">
          <p>
            {timer.running ? (timer.phase === 'focus' ? 'Sesión en curso' : 'Descanso') : 'Temporizador parado'} · <span className="epub-mono">{mm(timer.remaining)}</span>
          </p>
          {timer.running ? (
            <button type="button" className="sheet-btn" onClick={timer.pause}>
              Pausar
            </button>
          ) : (
            <button type="button" className="sheet-btn" onClick={timer.start}>
              {timer.remaining < timer.total ? 'Seguir' : 'Empezar sesión'}
            </button>
          )}
        </div>
      )}
      <p className="epub-sheet__hint">Es el mismo temporizador y el mismo sonido de tu habitación.</p>
    </div>
  );
}

/** Hoja de nota: el fragmento (o la sección), comentario opcional y tus colores (SPEC §54.6). */
function NoteSheet({ note, meanings, onChange, onSave, onCancel }) {
  const fieldRef = useRef(null);
  useEffect(() => {
    fieldRef.current?.focus({ preventScroll: true });
  }, []);
  const can = note.section ? note.comment.trim() : note.text;
  return (
    <div className="epub-note" role="dialog" aria-modal="true" aria-labelledby="epub-note-title">
      <div className="epub-note__sheet">
        <h3 id="epub-note-title">{note.section ? 'Nota de esta sección' : 'Guardar en mi diario'}</h3>
        {note.section ? <p className="epub-note__hint">Sin fragmento seleccionado: la nota queda vinculada a esta sección.</p> : <blockquote className="epub-note__quote">{note.text}</blockquote>}
        <label className="epub-note__field">
          <span>{note.section ? 'Tu nota' : 'Comentario (opcional)'}</span>
          <textarea ref={fieldRef} value={note.comment} onChange={(e) => onChange({ comment: e.target.value })} rows={3} />
        </label>
        <span id="epub-note-color" className="sr-only-focus">
          Color de la nota
        </span>
        <MarkerPicker meanings={meanings} value={note.color} onChange={(color) => onChange({ color })} legendId="epub-note-color" />
        <div className="epub-note__actions">
          <button type="button" className="sheet-btn sheet-btn--primary craft craft--terra" onClick={onSave} disabled={!can}>
            Guardar nota
          </button>
          <button type="button" className="link-btn" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/** «Una pausa junto al mar»: lo registrado, lo alcanzado y registrar con la operación de siempre (SPEC §54.4). */
function PauseSheet({ book, reached, status, onRegister, onLeave }) {
  const registered = percentRead(book);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(reached).replace('.', ','));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const parsed = value.trim() === '' ? NaN : Number(value.trim().replace(',', '.'));
  const valid = Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
  const target = editing ? parsed : reached;
  const diff = Number.isFinite(target) ? Math.round((target - registered) * 10) / 10 : null;
  const pagesBook = trackUnit(book) === 'pages';

  const register = () => {
    if (busy || (editing && !valid)) return;
    setBusy(true);
    const res = onRegister(Math.round(target * 10) / 10);
    if (res === 'already') {
      setMsg('Ese avance ya estaba registrado (quizá desde otro dispositivo). No se ha sumado nada.');
      setBusy(false);
    }
  };

  return (
    <div className="epub-pause" role="dialog" aria-modal="true" aria-labelledby="epub-pause-title">
      <div className="epub-pause__sheet">
        <div className="epub-pause__art" aria-hidden="true" />
        <h3 id="epub-pause-title">Una pausa junto al mar</h3>
        <div className="epub-pause__book">
          <span className="epub-pause__cover" aria-hidden="true">
            <Cover book={book} />
          </span>
          <div>
            <b>{book.title}</b>
            {book.author && <span>{book.author}</span>}
          </div>
        </div>
        <dl className="epub-pause__nums">
          <div>
            <dt>Registrado:</dt>
            <dd className="epub-mono">{fmt(registered)} %</dd>
          </div>
          <div>
            <dt>Has llegado al:</dt>
            <dd className="epub-mono">{fmt(reached)} %</dd>
          </div>
        </dl>
        {diff != null && diff > 0 && <p className="epub-pause__diff">Avance propuesto: {fmt(diff)} puntos porcentuales.</p>}
        {editing ? (
          <label className="epub-pause__edit">
            <span>Registrar hasta el (%)</span>
            <input type="text" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={!valid} />
            {!valid && <small role="alert">Escribe un número entre 0 y 100.</small>}
          </label>
        ) : (
          <button type="button" className="link-btn" onClick={() => setEditing(true)}>
            Corregir progreso
          </button>
        )}
        {pagesBook && <p className="epub-pause__note">Este libro pasará a registrarse por porcentaje. Tus sesiones anteriores no cambian.</p>}
        <p className="epub-pause__status">{status}</p>
        {msg && (
          <p className="epub-pause__note" role="status">
            {msg}
          </p>
        )}
        <button type="button" className="sheet-btn sheet-btn--primary craft craft--terra" onClick={register} disabled={busy || (editing && !valid)}>
          Registrar en el calendario
        </button>
        <button type="button" className="link-btn" onClick={onLeave}>
          Volver sin registrar
        </button>
        <p className="epub-pause__foot">Sin convertir el avance en páginas.</p>
      </div>
    </div>
  );
}
