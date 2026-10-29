// Lector EPUB (SPEC §53–55), cargado solo al abrirlo. Cada sección se pinta en un iframe con `sandbox` sin scripts.
// Dos formas de leer: desplazamiento continuo (el iframe mide lo que su documento y se desplaza su contenedor) o página a
// página (columnas CSS dentro del iframe, `epubLayout.js`). La posición se ancla a un bloque de texto (resiste cambios de
// letra, pantalla y forma de leer), se guarda en el dispositivo a los 750 ms y en el libro como mucho cada 60 s; nunca
// toca el registro de lectura. Los subrayados son las notas con fragmento (`epubHighlights.js`). Al salir, «Una pausa
// junto al mar» ofrece registrar lo avanzado con la operación de siempre.
//
// Por qué hay un sondeo (300–400 ms, solo con el lector visible y sin red): WebKit no ejecuta los escuchadores de la app
// dentro de un iframe con `allow-same-origin` y sin `allow-scripts`, y permitir scripts rompería el aislamiento. Se
// consultan la selección, el fragmento de los enlaces (`#bs-…`), la página actual y el alto del documento.
import JSZip from 'jszip';
import { ArrowLeft, BookmarkCheck, ChevronLeft, ChevronRight, Eye, EyeOff, List, Minus, NotebookPen, Plus, Trees } from 'lucide-react';
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
import { highlightAt, paintHighlights, rangeAnchor, resolveRange, tint } from './epubHighlights';
import { applyPaged, currentPage, goToPage, pageCount, pageOfBlock, removePaged, turns, visibleBlock } from './epubLayout';
import { LOCAL_DELAY, SYNC_EVERY, readLocal, startPosition, syncedPosition, writeLocal } from './epubPosition';
import { getEpub } from './epubStore';

const PREFS_KEY = 'bookshelf:epub-prefs';
const LEADINGS = [1.45, 1.65, 1.85];
const MARGINS = [16, 24, 32];
const DEFAULT_PREFS = { font: 18, leading: 1.65, margin: 24, theme: 'light', mode: 'scroll' };
const RELAYOUT_WAIT = 120;
const PANEL_TITLES = { toc: 'Índice', notes: 'Mi diario', aa: 'Letra y forma de leer', ambient: 'Ambiente' };

function readPrefs() {
  try {
    const p = { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
    return {
      font: Math.min(28, Math.max(16, Math.round(Number(p.font)) || 18)),
      leading: LEADINGS.includes(p.leading) ? p.leading : 1.65,
      margin: MARGINS.includes(p.margin) ? p.margin : 24,
      theme: p.theme === 'night' ? 'night' : 'light',
      mode: p.mode === 'paged' ? 'paged' : 'scroll',
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

const THEMES = {
  light: { bg: '#FAF5E8', ink: '#2C1E14', soft: '#725B46', accent: '#934829', rule: 'rgba(114, 91, 70, 0.22)', select: '#F3DFA2' },
  night: { bg: '#211D19', ink: '#EADFCB', soft: '#C5B69F', accent: '#D6B56D', rule: 'rgba(214, 181, 109, 0.25)', select: '#5B4A2A' },
};

/** Las fuentes de la app también en el documento (el iframe no hereda las de la página). */
const fontsHref = () => document.querySelector('link[rel="stylesheet"][href*="fonts.googleapis.com"]')?.getAttribute('href') ?? '';

/** Estilos del documento: tipografía editorial sin forzar su jerarquía; todo lo ancho cabe o se desplaza en su caja. */
const pageCss = ({ font, leading, margin, theme }, narrow) => {
  const t = THEMES[theme];
  const m = narrow && margin === 24 ? 20 : margin;
  return `
  html { background: ${t.bg}; overflow: hidden; -webkit-text-size-adjust: 100%; }
  html, body { max-width: 100%; }
  body { box-sizing: border-box; max-width: calc(68ch + ${m * 2}px); margin: 0 auto; padding: 16px ${m}px 32px;
    color: ${t.ink}; background: ${t.bg}; font: ${font}px/${leading} Lora, Georgia, serif; text-align: left;
    overflow-wrap: break-word; }
  * { box-sizing: border-box; }
  img, svg, image, video, pre, table, figure, iframe { max-width: 100%; }
  h1, h2, h3, h4, h5, h6 { font-family: 'Cormorant Garamond', Georgia, serif; line-height: 1.2; color: ${t.ink}; margin: 0.4em 0 0.6em; }
  h1 { font-size: clamp(26px, 6vw, 36px); } h2 { font-size: clamp(22px, 5vw, 30px); } h3 { font-size: 1.25em; }
  p { margin: 0 0 0.9em; }
  img, svg, image, video { max-width: 100%; height: auto; }
  figure { margin: 1em 0; }
  hr { border: 0; border-top: 1px solid ${t.rule}; margin: 1.6em auto; width: 40%; }
  blockquote { margin: 1em 0 1em 1.2em; }
  pre, code { white-space: pre-wrap; overflow-wrap: anywhere; }
  a { color: ${t.accent}; overflow-wrap: anywhere; }
  ::selection { background: ${t.select}; }
  .epub-alt { display: inline-block; padding: 2px 6px; border: 1px dashed ${t.soft}; border-radius: 4px; color: ${t.soft}; font-size: .85em; }
  .epub-note { color: ${t.soft}; font-style: italic; }
  table { display: block; max-width: 100%; overflow-x: auto; }
  `;
};

const fmt = (n) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });
const editable = (el) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

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
  const [pages, setPages] = useState(null);
  const [panel, setPanel] = useState(null);
  const [selection, setSelection] = useState(null);
  const [note, setNote] = useState(null);
  const [hlMenu, setHlMenu] = useState(null);
  const [lost, setLost] = useState(() => new Set());
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
  const localTimer = useRef(0);
  const baseRev = useRef(0);
  const dirty = useRef(false);
  const hlItems = useRef([]);
  /** Paginado: el ancla lógica restaurada se conserva mientras no se pase de página (si no, cada recolocación iría
   *  retrocediendo al primer párrafo de la página). */
  const logical = useRef(null);
  const lastCaret = useRef(null);
  const relayoutTimer = useRef(0);
  const paged = prefs.mode === 'paged';
  const pagedRef = useRef(paged);
  pagedRef.current = paged;
  /** Ancla pendiente con su hora: caduca a los 2 s para que nunca bloquee el guardado de la posición. */
  const stamp = (a) => (a ? { ...a, pendingSince: Date.now() } : null);
  const pendingActive = () => Boolean(pending.current && Date.now() - pending.current.pendingSince < 2000);

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
    if (ch === shownRef.current && frameRef.current) restorePending();
    else setChapter(ch);
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
  const narrow = typeof window !== 'undefined' && window.innerWidth < 360;
  const prefsKey = `${prefs.font}-${prefs.leading}-${prefs.margin}-${prefs.theme}-${prefs.mode}-${narrow}`;
  const rtl = epub?.rtl ?? false;
  const srcDoc = useMemo(() => {
    if (doc == null) return null;
    const fonts = fontsHref();
    return `<!doctype html><html lang="es"${rtl ? ' dir="rtl"' : ''}><head><meta charset="utf-8"><base href="about:srcdoc"><meta name="viewport" content="width=device-width, initial-scale=1">${fonts ? `<link rel="stylesheet" href="${fonts}">` : ''}<style>${pageCss(prefs, narrow)}</style></head><body data-epub-chapter="">${doc.body}</body></html>`;
    // prefsKey resume las preferencias
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, prefsKey, rtl]);

  const frameDoc = () => {
    const d = frameRef.current?.contentDocument;
    return d?.querySelector('[data-epub-chapter]') ? d : null;
  };
  const pageWidth = () => frameRef.current?.clientWidth || 1;

  // ── Ancla: bloque de texto visible (arriba en continuo; primero de la página en paginado) ───────────────────────
  const readAnchor = useCallback(() => {
    const d = frameDoc();
    const el = pageRef.current;
    if (!el || !epub || !d) return null;
    const ch = shownRef.current;
    let block = null;
    let offset = 0;
    let frac = 0;
    if (pagedRef.current) {
      const w = pageWidth();
      const t = turns(d);
      const total = pageCount(d, w);
      const first = t.prev ? 1 : 0;
      const last = total - 1 - (t.next ? 1 : 0);
      const p = currentPage(d, w);
      frac = last > first ? Math.min(1, Math.max(0, (p - first) / (last - first))) : 0;
      const keep = logical.current && logical.current.chapter === ch && logical.current.page === p ? d.querySelector(`[data-bs-block="${logical.current.block}"]`) : null;
      if (keep) {
        block = keep;
        offset = logical.current.offset ?? 0;
      } else {
        logical.current = null;
        const v = visibleBlock(d, w);
        if (v) {
          block = v.block;
          offset = v.offset;
        }
      }
    } else {
      const top = el.scrollTop;
      frac = el.scrollHeight > el.clientHeight ? top / (el.scrollHeight - el.clientHeight) : 0;
      for (const b of d.querySelectorAll('[data-bs-block]')) {
        if (b.offsetTop > top + 8) break;
        block = b;
      }
      offset = block?.offsetHeight ? Math.min(1, Math.max(0, (top - block.offsetTop) / block.offsetHeight)) : 0;
    }
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
    // frameDoc y pageWidth leen referencias
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epub]);

  /** Lleva la lectura a un ancla (bloque, fragmento, fracción o «última página»). */
  function applyAnchor(a) {
    const el = pageRef.current;
    const d = frameDoc();
    if (!el || !a || !d) return;
    const target = a.fragment ? (d.getElementById(a.fragment) ?? d.querySelector(`[name="${CSS.escape(a.fragment)}"]`)) : null;
    const block = !target && a.block != null ? d.querySelector(`[data-bs-block="${a.block}"]`) : null;
    if (pagedRef.current) {
      const w = pageWidth();
      const t = turns(d);
      const total = pageCount(d, w);
      const first = t.prev ? 1 : 0;
      const last = total - 1 - (t.next ? 1 : 0);
      let p = first;
      if (a.last) p = last;
      else if (target) p = pageOfBlock(d, w, target) ?? first;
      else if (block) p = pageOfBlock(d, w, block, a.offset) ?? first;
      else if (a.frac) p = first + Math.round(a.frac * Math.max(0, last - first));
      goToPage(d, w, Math.min(last, Math.max(first, p)));
      return;
    }
    if (a.last) el.scrollTop = el.scrollHeight;
    else if (target) el.scrollTop = Math.max(0, target.offsetTop - 16);
    else if (block) el.scrollTop = block.offsetTop + (a.offset ?? 0) * block.offsetHeight;
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
    if (pagedRef.current) updatePages();
    const same = posRef.current && posRef.current.href === pos.href && posRef.current.block === pos.block && posRef.current.frac === pos.frac;
    posRef.current = pos;
    setPercent(pos.percent);
    if (same) return;
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
      clearTimeout(relayoutTimer.current);
      document.removeEventListener('visibilitychange', onHide);
      // Salida por otra vía (Atrás del sistema): la posición queda guardada aunque no se registre lectura
      if (posRef.current) writeLocal(userId, bookRef.current.id, { pos: posRef.current, baseRev: baseRev.current, dirty: dirty.current });
      syncNow();
    };
  }, [syncNow, userId]);

  // Otra cuenta: el lector se cierra sin escribir nada en la biblioteca nueva
  useEffect(() => {
    if ((cloud.user?.id ?? null) !== userId) onClose();
  }, [cloud.user, userId, onClose]);

  // ── Maquetación del documento (continuo: alto del contenido; paginado: columnas) ───────────────────────────────
  function updatePages() {
    const d = frameDoc();
    if (!d || !pagedRef.current) return setPages(null);
    const w = pageWidth();
    const t = turns(d);
    const total = pageCount(d, w);
    const first = t.prev ? 1 : 0;
    const count = Math.max(1, total - first - (t.next ? 1 : 0));
    const page = Math.min(count, Math.max(1, currentPage(d, w) - first + 1));
    setPages((p) => (p?.page === page && p?.count === count ? p : { page, count }));
  }
  function layout() {
    const d = frameDoc();
    if (!d || !epub) return;
    if (pagedRef.current) {
      const f = frameRef.current;
      const ch = shownRef.current;
      applyPaged(d, { width: f.clientWidth, height: f.clientHeight, rtl, prev: ch > 0 ? epub.chapters[ch - 1].title : null, next: ch < epub.chapters.length - 1 ? epub.chapters[ch + 1].title : null });
    } else {
      removePaged(d);
      const h = Math.ceil(d.documentElement.scrollHeight);
      setFrameH((prev) => (Math.abs(prev - h) > 1 ? h : prev));
    }
  }
  function measure() {
    if (pagedRef.current) return;
    const d = frameDoc();
    if (!d) return;
    const h = Math.ceil(d.documentElement.scrollHeight);
    setFrameH((prev) => (Math.abs(prev - h) > 1 ? h : prev));
  }
  /** Aplica el ancla pendiente cuando el documento ya tiene su maquetación (si no, lo reintenta). */
  function restorePending(tries = 0) {
    const a = pending.current;
    const f = frameRef.current;
    const d = frameDoc();
    if (!a || !d) return;
    if (!pagedRef.current && f.offsetHeight < d.documentElement.scrollHeight - 2 && tries < 30) {
      requestAnimationFrame(() => restorePending(tries + 1));
      return;
    }
    pending.current = null;
    applyAnchor(a);
    if (pagedRef.current && a.block != null && !a.last) logical.current = { chapter: shownRef.current, page: currentPage(d, pageWidth()), block: a.block, offset: a.offset ?? 0 };
    else logical.current = null;
    track();
    repaint();
  }
  /** Recolocar tras un cambio de tamaño, fuentes o imágenes sin perder el sitio. */
  function relayout() {
    clearTimeout(relayoutTimer.current);
    relayoutTimer.current = setTimeout(() => {
      const anchor = pendingActive() ? pending.current : (readAnchor() ?? posRef.current);
      pending.current = stamp(anchor);
      layout();
      requestAnimationFrame(() => requestAnimationFrame(() => restorePending()));
    }, RELAYOUT_WAIT);
  }

  function wire() {
    const d = frameDoc();
    if (!d || d.documentElement.dataset.wired) return false;
    d.documentElement.dataset.wired = '1';
    const key = `${shownRef.current}-${prefsKey}-${allowImgs.size}`;
    if (restoredKey.current !== key) {
      restoredKey.current = key;
      if (!pending.current) pending.current = stamp(posRef.current && posRef.current.href === epub?.chapters[shownRef.current]?.href ? posRef.current : { frac: 0 });
      if (!pagedRef.current) setFrameH(0);
    }
    layout();
    // Las fuentes del documento cambian la maquetación al llegar: se recoloca una vez, sin perder el sitio
    d.fonts?.ready?.then(() => frameDoc() === d && relayout());
    requestAnimationFrame(() => requestAnimationFrame(() => restorePending()));
    d.addEventListener('selectionchange', readSelection);
    return true;
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
  // Cambios de tamaño (rotación, herramientas, ventana): recolocar con espera
  useEffect(() => {
    const el = pageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    let w = el.clientWidth;
    let h = el.clientHeight;
    const ro = new ResizeObserver(() => {
      if (Math.abs(el.clientWidth - w) < 2 && Math.abs(el.clientHeight - h) < 2) return;
      w = el.clientWidth;
      h = el.clientHeight;
      relayout();
    });
    ro.observe(el);
    return () => ro.disconnect();
    // relayout lee referencias
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epub]);

  // ── Subrayados: las notas con fragmento de este archivo y esta sección ─────────────────────────────────────────
  const quotesKey = book.quotes.map((q) => `${q.id}:${q.color}:${q.epub?.mark === false ? 0 : 1}`).join('|');
  function repaint() {
    const d = frameDoc();
    if (!d || !epub) return;
    const href = epub.chapters[shownRef.current].href;
    const night = prefs.theme === 'night';
    const items = [];
    const missing = new Set();
    for (const q of bookRef.current.quotes) {
      const ep = q.epub;
      if (!ep || ep.section || ep.mark === false || ep.href !== href || (ep.hash && ep.hash !== epub.hash) || (!ep.hash && fileHash !== bookRef.current.epub?.hash)) continue;
      const { range, status } = resolveRange(d, q);
      if (range) items.push({ id: q.id, range, color: tint(meaningOf(meanings, q.color).hex, night) });
      else if (status === 'ambiguous') missing.add(q.id);
    }
    hlItems.current = paintHighlights(d, items);
    setLost((s) => (s.size === missing.size && [...missing].every((x) => s.has(x)) ? s : missing));
  }
  useEffect(() => {
    repaint();
    // repaint lee referencias; basta con que cambien las notas o el tema
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotesKey, prefs.theme]);

  // ── Selección y toques sobre subrayados ────────────────────────────────────────────────────────────────────────
  function readSelection() {
    const sel = frameRef.current?.contentWindow?.getSelection?.();
    if (!sel) return;
    const text = sel.toString().trim().slice(0, 2000);
    if (!text) {
      setSelection((s) => (s ? null : s));
      // Un toque deja la selección contraída en ese punto: si cae en un subrayado, se abre su menú
      if (sel.isCollapsed && sel.anchorNode) {
        const key = `${sel.anchorOffset}`;
        if (lastCaret.current?.node !== sel.anchorNode || lastCaret.current?.key !== key) {
          lastCaret.current = { node: sel.anchorNode, key };
          const id = highlightAt(hlItems.current, sel.anchorNode, sel.anchorOffset);
          if (id) setHlMenu((m) => (m?.id === id ? m : { id }));
        }
      }
      return;
    }
    const node = sel.anchorNode?.nodeType === 1 ? sel.anchorNode : sel.anchorNode?.parentElement;
    const block = node?.closest?.('[data-bs-block]')?.getAttribute('data-bs-block');
    setSelection((s) => (s?.text === text ? s : { text, block: block != null ? Number(block) : null, range: sel.rangeCount ? rangeAnchor(sel.getRangeAt(0)) : null }));
  }

  // ── Enlaces del documento: `#bs-go-…` (otra sección), `#bs-img-…` (cargar imagen) y notas al pie ──────────────
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

  // ── Paginado: páginas de paso → sección contigua ──────────────────────────────────────────────────────────────
  function followTurn() {
    const d = frameDoc();
    if (!d || !pagedRef.current || pendingActive()) return;
    const w = pageWidth();
    const t = turns(d);
    const total = pageCount(d, w);
    const p = currentPage(d, w);
    if (t.prev && p === 0) goSection(shownRef.current - 1, { last: true });
    else if (t.next && p === total - 1) goSection(shownRef.current + 1, { frac: 0 });
    else track();
  }

  // ── Sondeo de respaldo, solo con el lector visible ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(
      () => {
        if (document.visibilityState !== 'visible') return;
        readSelection();
        followHash();
        if (pagedRef.current) followTurn();
        else measure();
      },
      paged ? 300 : 400,
    );
    return () => clearInterval(id);
  });

  // ── Navegación ─────────────────────────────────────────────────────────────────────────────────────────────────
  const goSection = (next, at = { frac: 0 }) => {
    if (!epub || next < 0 || next >= epub.chapters.length) return;
    syncNow();
    setSelection(null);
    setBack(null);
    if (panel) closePanel();
    if (next === shownRef.current) {
      pending.current = stamp(at);
      restorePending();
      return;
    }
    pending.current = stamp(at);
    restoredKey.current = '';
    setChapter(next);
  };
  /** Página anterior/siguiente (paginado); al pasar del borde de la sección, la contigua. */
  const turnPage = (dir) => {
    const d = frameDoc();
    if (!d) return;
    const w = pageWidth();
    const t = turns(d);
    const total = pageCount(d, w);
    const first = t.prev ? 1 : 0;
    const last = total - 1 - (t.next ? 1 : 0);
    const p = currentPage(d, w) + dir;
    if (p < first) goSection(shownRef.current - 1, { last: true });
    else if (p > last) goSection(shownRef.current + 1, { frac: 0 });
    else {
      goToPage(d, w, p);
      track();
    }
  };
  const step = (dir) => (paged ? turnPage(dir) : goSection(shown + dir));

  // ── Paneles: uno a la vez, con vuelta a la lectura ─────────────────────────────────────────────────────────────
  const closePanel = () => {
    setPanel(null);
    requestAnimationFrame(() => triggerRef.current?.focus?.({ preventScroll: true }));
  };
  const openPanel = (name, e) => {
    if (panel === name) return closePanel();
    if (!panel) triggerRef.current = e?.currentTarget ?? null;
    setHlMenu(null);
    setPanel(name);
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

  // ── Notas y subrayados ─────────────────────────────────────────────────────────────────────────────────────────
  const startNote = (fromSelection) => {
    if (!fromSelection && note && note.section) return setNote((n) => ({ ...n, hidden: false }));
    const here = readAnchor();
    setNote({ id: newId('q'), text: fromSelection ? selection.text : '', block: fromSelection ? selection.block : here?.block, range: fromSelection ? selection.range : null, section: !fromSelection, anchor: here, comment: '', color: 'yellow', hidden: false });
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
      epub: {
        v: ANCHOR_VERSION,
        hash: epub.hash,
        name: epub.name,
        href: a?.href ?? epub.chapters[shownRef.current].href,
        chapter: a?.chapter ?? shownRef.current,
        block: note.block ?? null,
        frac: a?.frac ?? 0,
        ...(note.section ? { section: true } : null),
        ...(note.range ? { range: note.range } : null),
      },
    });
    frameRef.current?.contentWindow?.getSelection()?.removeAllRanges();
    setSelection(null);
    setNote(null);
    setNotice(`Nota guardada en «Mi diario» · ${meaningOf(meanings, note.color).label}`);
  };
  const quoteById = (id) => book.quotes.find((q) => q.id === id);

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

  /** Cerrar la capa de arriba: menú o nota (la nota conserva su borrador) → panel → salir. */
  const closeTop = () => {
    if (hlMenu) return setHlMenu(null);
    if (note && !note.hidden) return setNote((n) => ({ ...n, hidden: true }));
    if (pause) return setPause(null);
    if (panel) return closePanel();
    return close();
  };
  const closeTopRef = useRef(closeTop);
  closeTopRef.current = closeTop;

  // ── Teclado: Escape cierra por capas; flechas pasan página en el paginado ──────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeTopRef.current();
        return;
      }
      if (!pagedRef.current || panel || hlMenu || (note && !note.hidden) || pause || editable(e.target)) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        turnPage((e.key === 'ArrowRight') !== rtl ? 1 : -1);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  // ── Historial: una sola entrada mientras haya una capa abierta (Atrás la cierra; nada se apila al leer) ─────────
  const layerOpen = Boolean(panel || hlMenu || (note && !note.hidden));
  const hist = useRef({ pushed: false, ignore: 0 });
  useEffect(() => {
    const h = hist.current;
    if (layerOpen && !h.pushed) {
      window.history.pushState({ ...(window.history.state ?? {}), bsReaderLayer: true }, '');
      h.pushed = true;
    } else if (!layerOpen && h.pushed) {
      h.pushed = false;
      h.ignore += 1;
      window.history.back();
    }
  }, [layerOpen]);
  useEffect(() => {
    const h = hist.current;
    const onPop = () => {
      if (h.ignore > 0) {
        h.ignore -= 1;
        return;
      }
      if (h.pushed) {
        h.pushed = false;
        closeTopRef.current();
      }
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (h.pushed) {
        h.pushed = false;
        window.history.back();
      }
    };
  }, []);

  useEffect(() => {
    const behind = [...modalRoot().children].filter((el) => el !== rootRef.current && !el.hasAttribute('inert'));
    behind.forEach((el) => el.setAttribute('inert', ''));
    rootRef.current?.querySelector('button')?.focus({ preventScroll: true });
    return () => behind.forEach((el) => el.removeAttribute('inert'));
  }, []);

  const title = epub?.chapters[shown]?.title ?? '';
  const sameFile = (q) => q.epub && (q.epub.hash ? q.epub.hash === epub?.hash : fileHash === book.epub?.hash);
  const notes = book.quotes.filter((q) => q.epub);
  const covered = Boolean(panel || (note && !note.hidden) || pause || conflict || hlMenu);
  const backTo = () => {
    const b = back;
    setBack(null);
    const i = epub.chapters.findIndex((c) => c.href === b.href);
    goSection(i, b);
  };
  const atStart = paged ? shown === 0 && pages?.page === 1 : shown === 0;
  const atEnd = paged ? shown >= (epub?.chapters.length ?? 1) - 1 && pages?.page === pages?.count : shown >= (epub?.chapters.length ?? 1) - 1;
  const hlQuote = hlMenu ? quoteById(hlMenu.id) : null;

  return createPortal(
    <div ref={rootRef} className="epub-reader" data-theme={prefs.theme} data-mode={prefs.mode} data-tools={toolsHidden ? 'hidden' : 'shown'} style={{ '--rd-margin': `${narrow && prefs.margin === 24 ? 20 : prefs.margin}px` }} role="dialog" aria-modal="true" aria-label={`Leer ${book.title}`}>
      {!toolsHidden && (
        <header className="epub-reader__bar" inert={covered ? true : undefined}>
          <button type="button" className="epub-icon" onClick={close} aria-label="Volver a la ficha">
            <ArrowLeft aria-hidden="true" />
          </button>
          <p className="epub-reader__where">
            <b>{book.title}</b>
            <span className="epub-reader__chapter">{title}</span>
          </p>
          <span className="epub-reader__actions">
            <button type="button" className="epub-icon epub-icon--aa" aria-expanded={panel === 'aa'} onClick={(e) => openPanel('aa', e)} aria-label="Letra y forma de leer">
              Aa
            </button>
            <button type="button" className="epub-icon" onClick={() => setToolsHidden(true)} aria-label="Ocultar herramientas">
              <EyeOff aria-hidden="true" />
            </button>
          </span>
          <span className="epub-reader__ribbon" aria-hidden="true" />
        </header>
      )}

      <div className="epub-reader__body">
        <div ref={pageRef} className="epub-reader__page" onScroll={paged ? undefined : track} inert={covered ? true : undefined}>
          {error ? (
            <p className="epub-reader__error" role="alert">
              {error}
            </p>
          ) : srcDoc == null ? (
            <p className="epub-reader__loading">Abriendo el libro…</p>
          ) : (
            <iframe key={`${shown}-${prefsKey}`} ref={frameRef} title={title || 'Sección'} className="epub-reader__frame" sandbox="allow-same-origin" scrolling="no" style={paged ? undefined : { height: frameH || '100%' }} srcDoc={srcDoc} onLoad={wire} />
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
        {note?.hidden && !covered && (
          <button type="button" className="epub-reader__resume sheet-btn" onClick={() => setNote((n) => ({ ...n, hidden: false }))}>
            Seguir con la nota
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
              <button type="button" className="epub-icon" onClick={closePanel} aria-label="Volver a la lectura">
                <ArrowLeft aria-hidden="true" />
              </button>
              <h3 id="epub-sheet-title">{PANEL_TITLES[panel]}</h3>
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
                    <NotebookPen aria-hidden="true" /> {note?.section ? 'Seguir con la nota de esta sección' : 'Nota de esta sección'}
                  </button>
                  <p className="epub-sheet__hint">Para subrayar un fragmento, selecciónalo en el texto.</p>
                  {notes.length > 0 && (
                    <ul className="epub-sheet__list epub-sheet__notes">
                      {notes.map((q) =>
                        sameFile(q) ? (
                          <li key={q.id} className="epub-sheet__note">
                            <button type="button" onClick={() => goSection(Math.max(0, epub.chapters.findIndex((c) => c.href === q.epub.href)), { block: q.epub.range?.start.block ?? q.epub.block, offset: 0, frac: q.epub.frac ?? 0 })}>
                              <span className="epub-reader__swatch" style={{ '--marker': meaningOf(meanings, q.color).hex }} aria-hidden="true" />
                              <span>
                                {q.text}
                                {q.comment && <em className="epub-sheet__comment">{q.comment}</em>}
                                {lost.has(q.id) && <small>Ubicación por recuperar: el fragmento aparece varias veces y no se marca al azar.</small>}
                                {q.epub.mark === false && !q.epub.section && <small>Sin subrayado en el texto.</small>}
                              </span>
                            </button>
                            {!q.epub.section && (
                              <button type="button" className="epub-icon epub-sheet__opts" aria-label={`Opciones del subrayado «${q.text.slice(0, 30)}»`} onClick={() => setHlMenu({ id: q.id })}>
                                ···
                              </button>
                            )}
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
                  <Choice label="Forma de leer" value={prefs.mode} options={[['scroll', 'Desplazamiento continuo'], ['paged', 'Página a página']]} onChange={(mode) => setPref({ mode })} />
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

        {hlQuote && (
          <HighlightMenu
            quote={hlQuote}
            meanings={meanings}
            onClose={() => setHlMenu(null)}
            onView={() => {
              setHlMenu(null);
              setPanel('notes');
            }}
            onColor={(color) => actions.updateQuote(book.id, hlQuote.id, { color })}
            onToggleMark={(on) => {
              actions.updateQuote(book.id, hlQuote.id, { epub: { ...hlQuote.epub, mark: on } });
              setHlMenu(null);
            }}
            onDelete={() => {
              actions.removeQuote(book.id, hlQuote.id);
              setHlMenu(null);
            }}
          />
        )}
      </div>

      {!toolsHidden && (
        <footer className="epub-reader__foot" inert={covered ? true : undefined}>
          <div className="epub-reader__progress">
            <button type="button" className="epub-icon" onClick={() => step(-1)} disabled={!epub || atStart} aria-label={paged ? 'Página anterior' : 'Sección anterior'}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <div className="epub-reader__meter">
              <span className="epub-reader__label">
                {paged && pages ? (
                  <>
                    Página <span className="epub-mono">{pages.page}</span> de <span className="epub-mono">{pages.count}</span> · esta sección ·{' '}
                  </>
                ) : (
                  'Posición en el archivo · '
                )}
                <span className="epub-reader__pct">{fmt(percent)} %</span>
              </span>
              <span className="epub-reader__track" aria-hidden="true">
                <span style={{ width: `${percent}%` }} />
              </span>
            </div>
            <button type="button" className="epub-icon" onClick={() => step(1)} disabled={!epub || atEnd} aria-label={paged ? 'Página siguiente' : 'Siguiente sección'}>
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
          <nav className="epub-reader__tools" aria-label="Herramientas del lector">
            <button type="button" aria-pressed={panel === 'toc'} onClick={(e) => openPanel('toc', e)} disabled={!epub}>
              <List aria-hidden="true" />
              Índice
            </button>
            <button type="button" aria-pressed={panel === 'ambient'} onClick={(e) => openPanel('ambient', e)}>
              <Trees aria-hidden="true" />
              Ambiente
            </button>
            <button type="button" aria-pressed={panel === 'notes'} onClick={(e) => openPanel('notes', e)} disabled={!epub}>
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

      {note && !note.hidden && <NoteSheet note={note} meanings={meanings} onChange={(patch) => setNote((n) => ({ ...n, ...patch }))} onSave={saveNote} onCancel={() => setNote(null)} />}

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

/** Ambiente: el sonido y el temporizador de siempre (abrir o cerrar esta hoja no los toca). */
function AmbientPanel({ timer, soundOn, onToggleSound }) {
  const mm = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
  return (
    <div className="epub-ambient">
      <p className="epub-sheet__hint">Tu ambiente te acompaña mientras lees.</p>
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
    </div>
  );
}

/** Menú de un subrayado: categoría, ver nota, cambiar color, quitar la marca o borrar la nota (con aviso). */
function HighlightMenu({ quote, meanings, onClose, onView, onColor, onToggleMark, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  const marked = quote.epub?.mark !== false;
  const headRef = useRef(null);
  useEffect(() => {
    headRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="epub-hl" role="dialog" aria-modal="true" aria-labelledby="epub-hl-title">
      <div className="epub-hl__sheet">
        <header className="epub-sheet__head">
          <button type="button" className="epub-icon" onClick={onClose} aria-label="Volver a la lectura">
            <ArrowLeft aria-hidden="true" />
          </button>
          <h3 id="epub-hl-title" ref={headRef} tabIndex={-1}>
            Subrayado · {meaningOf(meanings, quote.color).label}
          </h3>
        </header>
        <blockquote className="epub-note__quote">{quote.text}</blockquote>
        {quote.comment && <p className="epub-sheet__comment">{quote.comment}</p>}
        <span id="epub-hl-color" className="sr-only-focus">
          Cambiar color
        </span>
        <MarkerPicker meanings={meanings} value={quote.color} onChange={onColor} legendId="epub-hl-color" />
        <div className="epub-hl__actions">
          <button type="button" className="sheet-btn" onClick={onView}>
            Ver nota
          </button>
          {marked ? (
            <button type="button" className="sheet-btn" onClick={() => setConfirm(true)}>
              Eliminar subrayado
            </button>
          ) : (
            <button type="button" className="sheet-btn" onClick={() => onToggleMark(true)}>
              Volver a subrayar
            </button>
          )}
        </div>
        {confirm && (
          <div className="epub-hl__confirm" role="alertdialog" aria-label="Eliminar subrayado">
            <p>Se quita la marca del texto; la nota sigue en tu diario.</p>
            <button type="button" className="sheet-btn" onClick={() => onToggleMark(false)}>
              Quitar solo el subrayado
            </button>
            <p>{quote.comment ? 'Borrar también la nota elimina tu comentario escrito. No se puede deshacer.' : 'También puedes borrar la nota del diario. No se puede deshacer.'}</p>
            <button type="button" className="link-btn link-btn--danger" onClick={onDelete}>
              {quote.comment ? 'Borrar la nota y su comentario' : 'Borrar también la nota'}
            </button>
            <button type="button" className="link-btn" onClick={() => setConfirm(false)}>
              Cancelar
            </button>
          </div>
        )}
      </div>
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
