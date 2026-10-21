// Apps del portátil (SPEC §6): Calendario de lectura (portadas de lo que leíste cada día, páginas y
// porcentaje avanzado) y Sesiones (registro cronológico, editable).
import { ChevronLeft, ChevronRight, Coffee, Flame, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { dayKey, parseDay } from '../../domain/dates';
import { progress } from '../../domain/books';
import { useLibrary } from '../../state/useLibrary';
import { Cover } from '../shelf/BookItem';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const fmtDay = (key, opts) => cap(parseDay(key).toLocaleDateString('es-ES', opts));

/** Sesiones del temporizador por día: { [date]: { count, minutes } }. */
function usePomodoros(state) {
  return useMemo(() => {
    const days = {};
    state.progress.pomodoros.forEach((p) => {
      const key = dayKey(new Date(p.at));
      days[key] ??= { count: 0, minutes: 0 };
      days[key].count += 1;
      days[key].minutes += p.minutes || 0;
    });
    return days;
  }, [state.progress.pomodoros]);
}

/** Lecturas agrupadas por día: { [date]: [{ book, pages, pct }] } con el libro más leído primero. */
function useDays(state) {
  return useMemo(() => {
    const byId = new Map(state.books.map((b) => [b.id, b]));
    const days = {};
    state.progress.readingLog.forEach((e) => {
      const book = byId.get(e.bookId);
      if (!book || e.pages <= 0) return;
      (days[e.date] ??= []).push({ book, pages: e.pages, pct: book.pageCount ? Math.round((e.pages / book.pageCount) * 100) : 0 });
    });
    Object.values(days).forEach((list) => list.sort((a, b) => b.pages - a.pages));
    return days;
  }, [state.books, state.progress.readingLog]);
}

function heat(pages) {
  if (!pages) return 0;
  if (pages < 15) return 1;
  if (pages < 35) return 2;
  if (pages < 60) return 3;
  return 4;
}

function AddSession({ date, onDone }) {
  const { state, actions } = useLibrary();
  const candidates = state.books.filter((b) => b.status !== 'read' || b.id === state.settings.currentBookId);
  const [bookId, setBookId] = useState(candidates.find((b) => b.status === 'reading')?.id ?? candidates[0]?.id ?? '');
  const [pages, setPages] = useState(20);
  if (!candidates.length) return <p className="cal-pop__empty">No hay libros que puedas seguir leyendo.</p>;
  return (
    <form
      className="cal-pop__form"
      onSubmit={(e) => {
        e.preventDefault();
        actions.addSession(date, bookId, Math.max(1, Number(pages) || 1));
        onDone();
      }}
    >
      <select value={bookId} onChange={(e) => setBookId(e.target.value)} aria-label="Libro leído">
        {candidates.map((b) => (
          <option key={b.id} value={b.id}>
            {b.title}
          </option>
        ))}
      </select>
      <input type="number" min="1" max="2000" value={pages} onChange={(e) => setPages(e.target.value)} aria-label="Páginas leídas" />
      <span>págs.</span>
      <button type="submit" className="stamp-btn stamp-btn--small">
        Apuntar
      </button>
    </form>
  );
}

function DayPopover({ date, entries, pomodoro, onClose }) {
  const { actions } = useLibrary();
  const [adding, setAdding] = useState(!entries.length);
  const total = entries.reduce((s, e) => s + e.pages, 0);
  const future = date > dayKey();
  return (
    <div className="cal-pop" role="dialog" aria-label={`Lectura del ${fmtDay(date, { day: 'numeric', month: 'long' })}`}>
      <div className="cal-pop__head">
        <strong>
          {fmtDay(date, { weekday: 'long', day: 'numeric', month: 'short' })} · {total} págs.
        </strong>
        <button type="button" className="icon-btn icon-btn--tiny" onClick={onClose} aria-label="Cerrar">
          <X aria-hidden="true" />
        </button>
      </div>
      {pomodoro && (
        <p className="cal-pop__cozy">
          <Coffee aria-hidden="true" /> {pomodoro.count} {pomodoro.count === 1 ? 'sesión cozy' : 'sesiones cozy'} · {pomodoro.minutes} min
        </p>
      )}
      {entries.length > 0 && (
        <ul className="cal-pop__list">
          {entries.map(({ book, pages, pct }) => (
            <li key={book.id}>
              <span className="cal-pop__cover">
                <Cover book={book} />
              </span>
              <span className="cal-pop__text">
                <b>{book.title}</b>
                <em>
                  {pages} págs. · +{pct} % · va por el {progress(book)} %
                </em>
              </span>
              <button type="button" className="icon-btn icon-btn--tiny" onClick={() => actions.removeSession(date, book.id)} aria-label={`Borrar la sesión de ${book.title}`}>
                <Trash2 aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {future ? (
        <p className="cal-pop__empty">Este día aún no ha llegado.</p>
      ) : adding ? (
        <AddSession date={date} onDone={() => setAdding(false)} />
      ) : (
        <button type="button" className="cal-pop__add" onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" /> Apuntar otra lectura
        </button>
      )}
    </div>
  );
}

/** En móvil el detalle de un día va como panel interno bajo la cuadrícula, no flotando junto a la celda. */
const NARROW = '(max-width: 760px)';
function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(NARROW).matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.(NARROW);
    if (!media) return undefined;
    const onChange = () => setNarrow(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

export function CalendarApp() {
  const { state } = useLibrary();
  const days = useDays(state);
  const pomos = usePomodoros(state);
  const today = dayKey();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [open, setOpen] = useState(null);
  const narrow = useNarrow();
  const panelRef = useRef(null);
  // Al abrir un día en móvil, su panel entra en la zona visible de la ventana (solo se desplaza esa zona)
  useEffect(() => {
    const panel = panelRef.current;
    const scroller = panel?.closest('.window__body');
    if (!narrow || !open || !panel || !scroller) return;
    const over = panel.getBoundingClientRect().bottom - scroller.getBoundingClientRect().bottom;
    if (over > 0) scroller.scrollTop += over + 8;
  }, [narrow, open]);

  const cells = useMemo(() => {
    const first = new Date(month);
    const offset = (first.getDay() + 6) % 7;
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: count }, (_, i) => dayKey(new Date(month.getFullYear(), month.getMonth(), i + 1))),
    ];
  }, [month]);

  const monthDays = cells.filter(Boolean);
  const monthPages = monthDays.reduce((s, d) => s + (days[d]?.reduce((a, e) => a + e.pages, 0) ?? 0), 0);
  const readDays = monthDays.filter((d) => days[d]).length;
  const monthBooks = new Set(monthDays.flatMap((d) => (days[d] ?? []).map((e) => e.book.id))).size;
  const best = monthDays.reduce((acc, d) => {
    const p = days[d]?.reduce((a, e) => a + e.pages, 0) ?? 0;
    return p > acc.p ? { d, p } : acc;
  }, { d: null, p: 0 });
  const shift = (n) => {
    setOpen(null);
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  };

  return (
    <div className="cal">
      <div className="cal__head">
        <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="Mes anterior">
          <ChevronLeft aria-hidden="true" />
        </button>
        <h3>{cap(month.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }))}</h3>
        <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label="Mes siguiente">
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
      <div className="cal__summary">
        <span>
          <b>{monthPages.toLocaleString('es-ES')}</b> páginas
        </span>
        <span>
          <b>{readDays}</b> días leyendo
        </span>
        <span>
          <b>{monthBooks}</b> libros tocados
        </span>
        {best.d && (
          <span>
            Mejor día: <b>{fmtDay(best.d, { day: 'numeric' })}</b> ({best.p} págs.)
          </span>
        )}
      </div>
      <div className="cal__grid" role="grid" aria-label="Calendario de lectura">
        {WEEKDAYS.map((w) => (
          <span key={w} className="cal__weekday" role="columnheader">
            {w}
          </span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`e${i}`} className="cal__blank" />;
          const entries = days[date] ?? [];
          const pages = entries.reduce((s, e) => s + e.pages, 0);
          const col = i % 7;
          return (
            <div key={date} className="cal__cellwrap">
              <button
                type="button"
                className="cal__cell"
                data-heat={heat(pages)}
                data-today={date === today}
                data-future={date > today}
                aria-pressed={open === date}
                aria-label={`${fmtDay(date, { day: 'numeric', month: 'long' })}: ${pages ? `${pages} páginas, ${entries.map((e) => e.book.title).join(', ')}` : 'sin lectura'}`}
                onClick={() => setOpen(open === date ? null : date)}
              >
                <span className="cal__num">{parseDay(date).getDate()}</span>
                {entries.length > 1 && <span className="cal__more">+{entries.length - 1}</span>}
                {entries.length > 0 && (
                  <span className="cal__covers">
                    {entries.slice(0, 2).map((e, k) => (
                      <span key={e.book.id} className="cal__cover" data-k={k}>
                        <Cover book={e.book} />
                      </span>
                    ))}
                  </span>
                )}
                {pomos[date] && (
                  <span className="cal__cozy" title={`${pomos[date].count} sesiones cozy`}>
                    <Coffee aria-hidden="true" />
                  </span>
                )}
                {pages > 0 && (
                  <span className="cal__pages">
                    {heat(pages) >= 3 && <Flame aria-hidden="true" />}
                    {pages}
                  </span>
                )}
              </button>
              {open === date && !narrow && (
                <div className="cal__popwrap" data-side={col >= 4 ? 'left' : 'right'}>
                  <DayPopover date={date} entries={entries} pomodoro={pomos[date]} onClose={() => setOpen(null)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {narrow && open && (
        <div ref={panelRef} className="cal__daypanel">
          <DayPopover date={open} entries={days[open] ?? []} pomodoro={pomos[open]} onClose={() => setOpen(null)} />
        </div>
      )}
      <p className="cal__legend">
        <span>Menos</span>
        {[0, 1, 2, 3, 4].map((h) => (
          <i key={h} data-heat={h} />
        ))}
        <span>Más páginas</span>
      </p>
    </div>
  );
}

export function SessionsApp() {
  const { state, actions } = useLibrary();
  const days = useDays(state);
  const dates = Object.keys(days).sort().reverse();
  const pomodoros = state.progress.pomodoros;
  const [adding, setAdding] = useState(false);
  return (
    <div className="sessions">
      <div className="sessions__top">
        <p>
          {dates.length} días con lectura · {pomodoros.length} sesiones cozy con temporizador
        </p>
        <button type="button" className="stamp-btn stamp-btn--small" onClick={() => setAdding((v) => !v)}>
          <Plus aria-hidden="true" /> Apuntar lectura de hoy
        </button>
      </div>
      {adding && <AddSession date={dayKey()} onDone={() => setAdding(false)} />}
      {!dates.length && <p className="cal-pop__empty">Todavía no hay sesiones. Avanza páginas en un libro o usa el temporizador.</p>}
      <ol className="sessions__list">
        {dates.map((date) => (
          <li key={date}>
            <h4>
              {fmtDay(date, { weekday: 'long', day: 'numeric', month: 'long' })}
              <span>{days[date].reduce((s, e) => s + e.pages, 0)} págs.</span>
            </h4>
            <ul>
              {days[date].map(({ book, pages, pct }) => (
                <li key={book.id}>
                  <span className="cal-pop__cover">
                    <Cover book={book} />
                  </span>
                  <span className="cal-pop__text">
                    <b>{book.title}</b>
                    <em>
                      {book.author} · {pages} págs. (+{pct} %)
                    </em>
                  </span>
                  <span className="sessions__bar" style={{ '--p': `${Math.min(100, pct * 4)}%` }} aria-hidden="true" />
                  <button type="button" className="icon-btn icon-btn--tiny" onClick={() => actions.removeSession(date, book.id)} aria-label={`Borrar la sesión de ${book.title}`}>
                    <Trash2 aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
