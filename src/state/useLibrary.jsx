// Estado de la biblioteca (SPEC §5.1): reducer puro + persistencia en localStorage + acciones.
import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { SAMPLE_EDITIONS, sampleBook, sampleBooks, sampleReadingLog } from '../data/sampleBooks';
import { clampPage, createBook, newId, normalizeRating, normalizeTotal, percentRead, roundTo, shelfSort, trackUnit, withPosition, withStatus, withTracking } from '../domain/books';
import { appendEntry, bookLog, editEntry, isActive, normalizeLog, quickUpdate } from '../domain/reading';
import { dayKey, timeOfDayByClock, weekKey } from '../domain/dates';
import { EMPTY_COMPANION, applyTreasure } from '../domain/companion';
import { applyImportBatch, setImportStatus, startImport, undoImport } from '../features/imports/importService';
import { EMPTY_FIGURES, grantSeal, initialFigures, markUnboxSeen, openBoxAttempt, openMysteryBox } from '../domain/figures';

export const STORAGE_KEY = 'bookshelf:v1';

/** Ajustes propios de cada dispositivo: no viajan con la sincronización (SPEC §9ter). */
export const DEVICE_SETTINGS = ['timeOfDay', 'timeAuto', 'sound', 'sfx', 'uiVolume', 'showGuides', 'lampOn', 'candleOn'];
const pickDevice = (settings) => Object.fromEntries(DEVICE_SETTINGS.filter((k) => k in settings).map((k) => [k, settings[k]]));

const DEFAULT_SETTINGS = {
  owner: 'Lectora',
  pagesPerHour: 40,
  timeOfDay: timeOfDayByClock(),
  timeAuto: true,
  sound: true,
  viewMode: 'cover',
  pet: 'miel',
  yearGoal: 24,
  drink: 'icedTea',
  focusMinutes: 25,
  breakMinutes: 5,
  currentBookId: 'circe',
  pinnedQuote: null,
  customSagas: [],
  showGuides: false,
  sfx: true,
  lampOn: true,
  candleOn: true,
  // 1.23.0: volumen de los efectos de interfaz (preferencia del dispositivo) y significados de los colores de
  // anotación (solo los que cambie el usuario; viajan con sus ajustes)
  uiVolume: 0.25,
  quoteMeanings: {},
  // IA-1: el ambiente de la habitación toma el tono del libro que estás leyendo (se puede desactivar)
  bookVibe: true,
};

function initialState() {
  const books = sampleBooks();
  return {
    version: 6,
    books,
    settings: { ...DEFAULT_SETTINGS },
    progress: { readingLog: normalizeLog(sampleReadingLog()), pomodoros: [], claimed: {}, companion: { ...EMPTY_COMPANION }, figures: initialFigures(books) },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? hydrate(JSON.parse(raw)) : initialState();
  } catch {
    return initialState();
  }
}

/** Pasa un estado guardado (local, de la nube o de una copia) por todas las migraciones; lanza si no lo es. */
export function hydrate(saved) {
  if (!saved || typeof saved !== 'object' || (saved.books != null && !Array.isArray(saved.books))) throw new Error('No es un estado de BookShelf');
  const base = initialState();
  const v = saved.version ?? 1;
  let books = (saved.books ?? base.books).map((b) => createBook(b));
  // v3: catálogo de ediciones; los libros de ejemplo estrenan su edición de coleccionista
  if (v < 3) {
    books = books.map((b) => {
      const ed = b.source === 'sample' && SAMPLE_EDITIONS[b.id];
      if (!ed) return b;
      const next = { ...b, editionType: ed.editionType };
      if (ed.sprayedEdgeStyle) next.sprayedEdgeStyle = ed.sprayedEdgeStyle;
      if (ed.audioHours) next.audioHours = ed.audioHours;
      return next;
    });
    if (saved.books && !books.some((b) => b.id === 'alas-sangre')) books.push(sampleBook('alas-sangre'));
  }
  // v4: Booknooks de sagas; llega «Nacidos de la bruma» para estrenar su diorama emparejado
  if (v < 4 && saved.books && !books.some((b) => b.id === 'mistborn')) books.push(sampleBook('mistborn'));
  // v5: los Booknooks dejan paso a las Figuras de Coleccionista; cada pieza por encima de 3 es una caja más
  const figures = saved.progress?.figures
    ? { ...EMPTY_FIGURES, ...saved.progress.figures, pity: { ...EMPTY_FIGURES.pity, ...saved.progress.figures.pity } }
    : initialFigures(books, Math.max(0, (saved.progress?.pieces ?? 3) - 3));
  return {
    ...base,
    ...saved,
    books,
    // v6 (1.20.0): libros con total opcional, porcentaje y valoración en cuartos (normalizados en createBook)
    // y registros de lectura individuales con id (los agregados antiguos se conservan como «registrados»)
    version: 6,
    // v2: el sonido pasa a estar activado por defecto (antes se guardaba apagado al recargar)
    settings: {
      ...DEFAULT_SETTINGS,
      ...saved.settings,
      ...(v < 2 ? { sound: true } : null),
      timeOfDay: timeOfDayByClock(),
      timeAuto: true,
    },
    progress: {
      ...base.progress,
      ...saved.progress,
      readingLog: saved.progress?.readingLog ? normalizeLog(saved.progress.readingLog) : base.progress.readingLog,
      companion: { ...EMPTY_COMPANION, ...saved.progress?.companion },
      figures,
    },
  };
}

/** Aplica la posición nueva de un libro (con sus cambios de estado). */
const placeBook = (state, id, position, now) => state.books.map((b) => (b.id === id ? withPosition(b, position, now) : b));

/** Leer hoy enciende un sello del Guardián (uno al día; las correcciones y las ediciones no). */
const sealFor = (state, entry) =>
  entry && isActive(entry) && entry.date === dayKey() ? grantSeal(state.progress.figures, entry.date, { bookId: entry.bookId }) : state.progress.figures;

/** Botones rápidos de página (ficha, cama, temporizador): agrupados en un registro por libro y día. */
function withQuick(state, id, target, source = 'quick') {
  const book = state.books.find((b) => b.id === id);
  if (!book) return state;
  const now = new Date().toISOString();
  const res = quickUpdate(book, state.progress.readingLog, target, { date: dayKey(), now, source });
  if (!res) return state;
  return {
    ...state,
    books: placeBook(state, id, res.position, now),
    progress: { ...state.progress, readingLog: res.log, figures: sealFor(state, res.entry) },
  };
}

/** Exportado solo para las pruebas de dominio (doble toque, reversión); la app usa `useLibrary`. */
export function reducer(state, action) {
  switch (action.type) {
    case 'addBook': {
      // 1.54 (SPEC §52.1): un libro nuevo no puede estrenar la edición visual retirada
      const book = createBook({ ...action.book, ...(action.book.editionType === 'kindle' ? { editionType: 'paperback' } : null), addedAt: new Date().toISOString() });
      return { ...state, books: [...state.books, book] };
    }
    case 'updateBook': {
      const now = new Date().toISOString();
      return {
        ...state,
        books: state.books.map((b) => {
          if (b.id !== action.id) return b;
          const next = { ...b, ...action.patch, updatedAt: now };
          if ('review' in action.patch && action.patch.review.trim() && action.patch.review !== b.review) next.reviewedAt = now;
          if (action.patch.status === 'read' && b.status !== 'read') {
            next.finishedAt = now;
            next.currentPage = b.pageCount || 0;
            next.currentPercent = 100;
          }
          if (action.patch.status === 'reading' && !b.startedAt) next.startedAt = now;
          if (action.patch.status && action.patch.status !== 'read') next.finishedAt = null;
          // Abandonar conserva página, sesiones, notas y valoración (SPEC §43); solo se anota cuándo
          if (action.patch.status && action.patch.status !== b.status) next.abandonedAt = action.patch.status === 'abandoned' ? now : null;
          if ('rating' in action.patch) next.rating = normalizeRating(action.patch.rating);
          // Total desconocido → seguimiento por porcentaje conservando lo leído; total nuevo → página ajustada
          if ('pageCount' in action.patch) {
            next.pageCount = normalizeTotal(action.patch.pageCount);
            if (!next.pageCount) Object.assign(next, { trackBy: 'percent', currentPercent: roundTo(percentRead(b), 1), currentPage: 0 });
            else if (trackUnit(next) === 'pages') next.currentPage = clampPage(next, next.currentPage);
            else next.currentPage = Math.round((next.pageCount * next.currentPercent) / 100);
          }
          return next;
        }),
      };
    }
    case 'setPage':
      return withQuick(state, action.id, action.page, action.source);
    case 'setTracking':
      return { ...state, books: state.books.map((b) => (b.id === action.id ? withTracking(b, action.unit) : b)) };
    case 'moveBook': {
      // Arrastrar un libro: cambia de balda si hace falta y queda delante de `beforeId` (o al final)
      let books = state.books.map((b) => (b.id === action.id ? withStatus(b, action.status) : b));
      const moving = books.find((b) => b.id === action.id);
      if (!moving) return state;
      const row = books.filter((b) => b.status === action.status && b.id !== action.id).sort(shelfSort(action.status));
      const at = action.beforeId ? row.findIndex((b) => b.id === action.beforeId) : -1;
      row.splice(at < 0 ? row.length : at, 0, moving);
      const order = new Map(row.map((b, i) => [b.id, i]));
      books = books.map((b) => (order.has(b.id) ? { ...b, shelfOrder: order.get(b.id) } : b));
      return { ...state, books };
    }
    case 'logReading': {
      // Registro completo ya validado (ReadingEntryForm); el mismo id dos veces no duplica (doble toque)
      const { entry, position } = action;
      const readingLog = appendEntry(state.progress.readingLog, entry);
      if (readingLog === state.progress.readingLog || !state.books.some((b) => b.id === entry.bookId)) return state;
      const now = entry.createdAt || new Date().toISOString();
      return {
        ...state,
        books: position != null ? placeBook(state, entry.bookId, position, now) : state.books,
        progress: { ...state.progress, readingLog, figures: sealFor(state, entry) },
      };
    }
    case 'revertLog': {
      // Deshace en memoria un registro cuyo guardado ha fallado (SPEC §22.7): quita esa entrada y devuelve el
      // libro y los sellos a como estaban antes, para no mostrar como terminada una lectura que no se guardó
      if (!state.progress.readingLog.some((e) => e.id === action.entryId)) return state;
      return {
        ...state,
        books: state.books.map((b) => (b.id === action.book.id ? action.book : b)),
        progress: { ...state.progress, readingLog: state.progress.readingLog.filter((e) => e.id !== action.entryId), figures: action.figures },
      };
    }
    case 'editSession': {
      // Editar por id: recalcula el registro, no concede sellos; si es el último del libro, mueve la posición
      const log = state.progress.readingLog;
      const entry = log.find((e) => e.id === action.sessionId);
      if (!entry) return state;
      const book = state.books.find((b) => b.id === entry.bookId);
      const res = editEntry(entry, book, action.text);
      if (res.error) return state;
      const mine = bookLog(log, entry.bookId);
      const isLast = mine[mine.length - 1]?.id === entry.id;
      const books = isLast && book && res.entry.to != null && res.entry.unit === trackUnit(book) ? placeBook(state, book.id, res.entry.to, new Date().toISOString()) : state.books;
      return { ...state, books, progress: { ...state.progress, readingLog: log.map((e) => (e.id === entry.id ? res.entry : e)) } };
    }
    case 'removeSession':
      return {
        ...state,
        progress: { ...state.progress, readingLog: state.progress.readingLog.filter((e) => e.id !== action.sessionId) },
      };
    case 'removeBook':
      return {
        ...state,
        books: state.books.filter((b) => b.id !== action.id),
        settings: state.settings.currentBookId === action.id ? { ...state.settings, currentBookId: null } : state.settings,
      };
    case 'addQuote':
      // 1.56: un id que ya existe es un reintento del mismo guardado (no se duplica)
      if (action.quote.id && state.books.some((b) => b.id === action.id && b.quotes.some((q) => q.id === action.quote.id))) return state;
      return {
        ...state,
        books: state.books.map((b) =>
          b.id === action.id
            ? { ...b, quotes: [...b.quotes, { id: newId('q'), createdAt: new Date().toISOString(), ...action.quote }] }
            : b,
        ),
      };
    // Editar una anotación: texto, página y color (SPEC §28.7). No toca el progreso ni el registro de lectura.
    case 'updateQuote': {
      const pick = ({ text, page, color }) => ({ text, page, color });
      return {
        ...state,
        books: state.books.map((b) =>
          b.id === action.id ? { ...b, quotes: b.quotes.map((q) => (q.id === action.quoteId ? { ...q, ...pick(action.patch), editedAt: new Date().toISOString() } : q)) } : b,
        ),
      };
    }
    case 'removeQuote':
      return {
        ...state,
        books: state.books.map((b) => (b.id === action.id ? { ...b, quotes: b.quotes.filter((q) => q.id !== action.quoteId) } : b)),
      };
    case 'settings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'pomodoro':
      return {
        ...state,
        progress: {
          ...state.progress,
          pomodoros: [...state.progress.pomodoros, { at: new Date().toISOString(), minutes: action.minutes, drink: action.drink }],
          figures: grantSeal(state.progress.figures, dayKey()),
        },
      };
    case 'claimMission': {
      const week = weekKey();
      const claimed = state.progress.claimed[week] ?? [];
      if (claimed.includes(action.id)) return state;
      return {
        ...state,
        progress: {
          ...state.progress,
          figures: { ...state.progress.figures, boxes: state.progress.figures.boxes + 1 },
          claimed: { ...state.progress.claimed, [week]: [...claimed, action.id] },
        },
      };
    }
    // Sobre lacrado del día (portátil)
    case 'companionTreasure':
      return { ...state, progress: applyTreasure(state.progress, action.treasure) };
    case 'companionSaveCard': {
      const c = { ...EMPTY_COMPANION, ...state.progress.companion };
      if (!c.pendingCard) return state;
      const cards = c.cards.includes(c.pendingCard) ? c.cards : [...c.cards, c.pendingCard];
      return { ...state, progress: { ...state.progress, companion: { ...c, cards, pendingCard: null, lastPieceUp: false } } };
    }
    // Figuras de Coleccionista (SPEC §7)
    case 'figures': {
      const fs = state.progress.figures;
      let next = fs;
      if (action.op === 'display' && fs.owned[action.id]) next = { ...fs, owned: { ...fs.owned, [action.id]: { ...fs.owned[action.id], display: action.display } } };
      if (action.op === 'guardian' && fs.owned[action.id]) next = { ...fs, guardian: action.id };
      if (action.op === 'seal') next = grantSeal(fs, dayKey(), { force: true });
      if (action.op === 'path') next = { ...fs, path: action.id };
      if (action.op === 'place') {
        const placements = { ...fs.placements };
        if (action.bookId) placements[action.id] = action.bookId;
        else delete placements[action.id];
        next = { ...fs, placements };
      }
      if (action.op === 'open') next = openMysteryBox(fs, action.catalog, action.rnd).fs;
      if (action.op === 'attempt') next = openBoxAttempt(fs, action.catalog, action.rnd, action.attemptId, action.at);
      if (action.op === 'seen') next = markUnboxSeen(fs, action.attemptId);
      if (action.op === 'ack') next = { ...fs, lastReward: null, sealBox: false };
      // Libros de la saga de cada figura que tienes (la sinergia ×2 sale de aquí)
      if (action.op === 'sync') next = { ...fs, placements: action.map };
      // Lo expuesto en las baldas de la habitación (SPEC §37): cuatro posiciones { id, display } o null
      if (action.op === 'shelf' && Array.isArray(action.shelf)) next = { ...fs, shelf: action.shelf.slice(0, 4).map((s) => (s && fs.owned[s.id] ? { id: s.id, display: s.display === 'unboxed' ? 'unboxed' : 'box' } : null)) };
      // Reclamar el sello de hoy si ya has leído (p. ej. si elegiste Guardián después de leer)
      if (action.op === 'today') {
        const today = dayKey();
        const read = state.progress.readingLog.some((e) => e.date === today && isActive(e)) || state.progress.pomodoros.some((p) => dayKey(new Date(p.at)) === today);
        if (read) next = grantSeal(fs, today);
      }
      return next === fs ? state : { ...state, progress: { ...state.progress, figures: next } };
    }
    // Importación de Goodreads (SPEC §52.3): por lotes, idempotente y sin tocar registros, sellos ni recompensas
    case 'importStart':
      return startImport(state, action.record);
    case 'importBatch':
      return applyImportBatch(state, action.id, action.keys);
    case 'importStatus':
      return setImportStatus(state, action.id, action.status, action.error);
    case 'importUndo':
      return undoImport(state, action.id);
    case 'reset':
      return initialState();
    // Estado completo llegado de la nube o de una copia (ya migrado); se conservan los ajustes del dispositivo
    case 'replace':
      return { ...action.state, settings: { ...action.state.settings, ...pickDevice(state.settings) } };
    default:
      return state;
  }
}

const LibraryContext = createContext(null);

export function LibraryProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  const latest = useRef(state);
  const savedUnbox = useRef(state.progress.figures?.unbox?.id ?? null);
  useEffect(() => {
    latest.current = state;
    const write = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(latest.current));
      } catch {
        // Almacenamiento lleno o bloqueado: la sesión sigue funcionando en memoria.
      }
    };
    // Una caja recién abierta se guarda al momento: recargar justo después no pierde el premio (SPEC §13.6)
    const unboxId = state.progress.figures?.unbox?.id ?? null;
    if (unboxId !== savedUnbox.current) {
      savedUnbox.current = unboxId;
      write();
      return undefined;
    }
    const id = setTimeout(write, 250);
    return () => clearTimeout(id);
  }, [state]);

  // Al ocultar o cerrar la página se vuelca lo pendiente
  useEffect(() => {
    const flush = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(latest.current));
      } catch {
        // Sin almacenamiento: nada que volcar.
      }
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  const actions = useMemo(
    () => ({
      addBook: (book) => dispatch({ type: 'addBook', book }),
      importStart: (record) => dispatch({ type: 'importStart', record }),
      importBatch: (id, keys) => dispatch({ type: 'importBatch', id, keys }),
      importStatus: (id, status, error) => dispatch({ type: 'importStatus', id, status, error }),
      importUndo: (id) => dispatch({ type: 'importUndo', id }),
      updateBook: (id, patch) => dispatch({ type: 'updateBook', id, patch }),
      setPage: (id, page, source) => dispatch({ type: 'setPage', id, page, source }),
      setTracking: (id, unit) => dispatch({ type: 'setTracking', id, unit }),
      logReading: (entry, position) => dispatch({ type: 'logReading', entry, position }),
      revertLog: (entryId, book, figures) => dispatch({ type: 'revertLog', entryId, book, figures }),
      editSession: (sessionId, text) => dispatch({ type: 'editSession', sessionId, text }),
      removeSession: (sessionId) => dispatch({ type: 'removeSession', sessionId }),
      // Escritura inmediata tras guardar una lectura: devuelve false si el almacenamiento falla (SPEC §14.6)
      persistNow: () => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(latest.current));
          return true;
        } catch {
          return false;
        }
      },
      removeBook: (id) => dispatch({ type: 'removeBook', id }),
      moveBook: (id, status, beforeId) => dispatch({ type: 'moveBook', id, status, beforeId }),
      addQuote: (id, quote) => dispatch({ type: 'addQuote', id, quote }),
      updateQuote: (id, quoteId, patch) => dispatch({ type: 'updateQuote', id, quoteId, patch }),
      removeQuote: (id, quoteId) => dispatch({ type: 'removeQuote', id, quoteId }),
      setSettings: (patch) => dispatch({ type: 'settings', patch }),
      logPomodoro: (minutes, drink) => dispatch({ type: 'pomodoro', minutes, drink }),
      claimMission: (id) => dispatch({ type: 'claimMission', id }),
      figureDisplay: (id, display) => dispatch({ type: 'figures', op: 'display', id, display }),
      setGuardian: (id) => dispatch({ type: 'figures', op: 'guardian', id }),
      simulateSeal: () => dispatch({ type: 'figures', op: 'seal' }),
      setFigurePath: (id) => dispatch({ type: 'figures', op: 'path', id }),
      placeFigure: (id, bookId) => dispatch({ type: 'figures', op: 'place', id, bookId }),
      openMysteryBox: (catalog) => dispatch({ type: 'figures', op: 'open', catalog, rnd: Array.from({ length: 8 }, Math.random) }),
      // Intento identificado e idempotente: el mismo id nunca consume otra caja ni sortea otro premio
      openBoxAttempt: (catalog, attemptId) =>
        dispatch({ type: 'figures', op: 'attempt', catalog, attemptId, at: new Date().toISOString(), rnd: Array.from({ length: 8 }, Math.random) }),
      markUnboxSeen: (attemptId) => dispatch({ type: 'figures', op: 'seen', attemptId }),
      ackFigureReward: () => dispatch({ type: 'figures', op: 'ack' }),
      syncFigureBooks: (map) => dispatch({ type: 'figures', op: 'sync', map }),
      setFigureShelf: (shelf) => dispatch({ type: 'figures', op: 'shelf', shelf }),
      claimTodaySeal: () => dispatch({ type: 'figures', op: 'today' }),
      claimTreasure: (treasure) => dispatch({ type: 'companionTreasure', treasure }),
      saveCard: () => dispatch({ type: 'companionSaveCard' }),
      reset: () => dispatch({ type: 'reset' }),
      replaceState: (state) => dispatch({ type: 'replace', state }),
    }),
    [],
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary debe usarse dentro de <LibraryProvider>');
  return ctx;
}
