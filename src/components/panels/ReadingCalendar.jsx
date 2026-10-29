// Apps del portátil (SPEC §6, §14): Calendario de lectura (portadas de lo que leíste cada día con el dato de
// ese día) y Sesiones (registro cronológico). Cada lectura es un registro propio: se ve, se edita y se borra
// por su id, agrupada por libro, y siempre con la posición que tenía el libro al registrarla.
import { CalendarDays, Check, ChevronLeft, ChevronRight, Coffee, Flame, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { dayKey, parseDay } from '../../domain/dates';
import { hash } from '../../domain/books';
import { dayDatum, editEntry, entryInput, entryText, groupByDay, heat, isActive, summarize } from '../../domain/reading';
import { monthCells } from '../../domain/roomSurfaces';
import { useLibrary } from '../../state/useLibrary';
import { Cover } from '../shelf/BookItem';
import { playUiSound } from '../../audio/uiSounds';
import { ReadingEntryForm } from './ReadingEntryForm';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
// Cabecera del calendario completo (SPEC §32.2): nombre abreviado, como en la maqueta
const WEEKDAYS_LONG = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const fmtDay = (key, opts) => cap(parseDay(key).toLocaleDateString('es-ES', opts));
const validTime = (iso) => Boolean(iso) && !Number.isNaN(new Date(iso).getTime());

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

/** Lecturas por día y libro, con todos sus registros individuales. */
function useDays(state) {
  return useMemo(() => groupByDay(state.progress.readingLog, state.books), [state.books, state.progress.readingLog]);
}

/**
 * Portada de calendario (SPEC §14.10): pequeña pieza editorial con lomo, canto de páginas y un giro
 * determinista por id; los e-readers van en su marco de tinta electrónica. No afecta a la estantería.
 */
export function CalCover({ book }) {
  const tilt = ((hash(book.id) % 41) - 20) / 10;
  return (
    <span className="cal-cover" style={{ '--tilt': `${tilt}deg` }}>
      <Cover book={book} />
    </span>
  );
}

/** Una fila del historial: lo que se registró, con edición y borrado de ESE registro. */
function EntryRow({ entry, book }) {
  const { actions } = useLibrary();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const check = editing && text.trim() ? editEntry(entry, book, text) : null;
  const label = entryText(entry);
  if (editing) {
    return (
      <li className="entry-row" data-editing="true">
        <form
          className="entry-row__edit"
          onSubmit={(e) => {
            e.preventDefault();
            if (!check?.entry) return;
            actions.editSession(entry.id, text);
            setEditing(false);
            // El sello suena cuando la escritura se ha confirmado
            setTimeout(() => {
              if (actions.persistNow()) playUiSound('save');
            }, 0);
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} inputMode="decimal" aria-label={`Nuevo valor para «${label}»`} aria-invalid={!!check?.error || undefined} autoFocus />
          <button type="submit" className="icon-btn icon-btn--tiny" disabled={!check?.entry} aria-label="Guardar el cambio">
            <Check aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn icon-btn--tiny" onClick={() => setEditing(false)} aria-label="Cancelar la edición">
            <X aria-hidden="true" />
          </button>
          <small className={check?.error ? 'reading-form__error' : 'reading-form__help'} role={check?.error ? 'alert' : undefined}>
            {check?.error ?? (check?.entry ? `Quedará: ${entryText(check.entry)}` : 'Escribe el valor corregido.')}
          </small>
        </form>
      </li>
    );
  }
  return (
    <li className="entry-row" data-kind={entry.kind}>
      <span className="entry-row__text">{label}</span>
      {validTime(entry.createdAt) && <time className="entry-row__time">{new Date(entry.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</time>}
      <button
        type="button"
        className="icon-btn icon-btn--tiny"
        onClick={() => {
          setText(entryInput(entry));
          setEditing(true);
        }}
        aria-label={`Editar «${label}» de ${book.title}`}
      >
        <Pencil aria-hidden="true" />
      </button>
      <button type="button" className="icon-btn icon-btn--tiny" onClick={() => actions.removeSession(entry.id)} aria-label={`Borrar «${label}» de ${book.title}`}>
        <Trash2 aria-hidden="true" />
      </button>
    </li>
  );
}

/** Un libro del día con sus registros (varias sesiones del mismo libro se ven por separado). */
function BookGroup({ group, author }) {
  const { book, entries } = group;
  return (
    <li className="day-group">
      <span className="cal-pop__cover">
        <CalCover book={book} />
      </span>
      <span className="cal-pop__text">
        <b>{book.title}</b>
        {author && <em>{book.author}</em>}
        <ul className="day-group__entries">
          {entries.map((e) => (
            <EntryRow key={e.id} entry={e} book={book} />
          ))}
        </ul>
      </span>
    </li>
  );
}

function DayPopover({ date, groups, pomodoro, onClose, onComplete, onOpenLibrary }) {
  const { state } = useLibrary();
  const [adding, setAdding] = useState(!groups.length);
  const summary = summarize(groups.flatMap((g) => g.entries), state.books);
  const future = date > dayKey();
  return (
    <div className="cal-pop" role="dialog" aria-label={`Lectura del ${fmtDay(date, { day: 'numeric', month: 'long' })}`}>
      {/* Pinza de latón que sujeta la ficha del día (decoración) */}
      <img className="cal-pop__clip" src="/assets/bookshelf/notebook/brass-paper-clip.webp" alt="" width="160" height="128" aria-hidden="true" />
      <div className="cal-pop__head">
        <strong>
          {fmtDay(date, { weekday: 'long', day: 'numeric', month: 'short' })}
          {summary.text && ` · ${summary.text}`}
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
      {groups.length > 0 && (
        <ul className="cal-pop__list">
          {groups.map((g) => (
            <BookGroup key={g.book.id} group={g} />
          ))}
        </ul>
      )}
      {future ? (
        <p className="cal-pop__empty">Este día aún no ha llegado.</p>
      ) : adding ? (
        // Instancia estable por día (key = fecha): el borrador no se pierde con re-renders ni sincronizaciones
        <ReadingEntryForm key={date} date={date} keepOpen onCancel={groups.length ? () => setAdding(false) : undefined} onComplete={(bookId) => onComplete?.(bookId, date)} onOpenLibrary={onOpenLibrary} />
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

/**
 * Calendario de lectura. `variant="scene"` es la vista compacta que se ve en la pantalla del portátil desde la
 * habitación (SPEC §21.3): misma app, mismos datos y mismas clases. `selectDay` abre ese día al llegar (hoy
 * desde la pantalla del portátil; el día de la lectura al volver de la reseña). `onComplete(bookId, date)`: un
 * registro de ese día acaba de terminar un libro (SPEC §22.7); `onOpenLibrary`: abrir la librería.
 */
export function CalendarApp({ variant = 'full', ...props }) {
  return variant === 'scene' ? <CalendarScene {...props} /> : <CalendarFull {...props} />;
}

/** Línea única de actividad de hoy: páginas registradas hoy (nunca la posición del libro) o el avance. */
function todayLine(groups) {
  const datum = dayDatum(groups.filter((g) => g.entries.some(isActive)));
  if (datum.kind === 'pages') return `Hoy · ${datum.pages.toLocaleString('es-ES')} ${datum.pages === 1 ? 'página' : 'páginas'}`;
  if (datum.kind === 'percent') return `Hoy · ${datum.label}`;
  return 'Hoy · Sin lectura registrada';
}

/**
 * Vista compacta para la escena: barra de la ventana, mes, cuadrícula con la misma intensidad por día que el
 * panel y una sola línea de hoy. Decorativa (sin botones): el hotspot del portátil abre el calendario completo.
 */
function CalendarScene({ today = dayKey() }) {
  const { state } = useLibrary();
  const days = useDays(state);
  const cells = useMemo(() => monthCells(today), [today]);
  return (
    <div className="cal" data-variant="scene" aria-hidden="true">
      <div className="window__bar">
        <span className="window__title">
          <CalendarDays aria-hidden="true" />
          Calendario
        </span>
      </div>
      <div className="cal__scene-body">
        <div className="cal__head">
          <h3>{cap(parseDay(today).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }))}</h3>
        </div>
        <div className="cal__grid">
          {WEEKDAYS.map((w) => (
            <span key={w} className="cal__weekday">
              {w}
            </span>
          ))}
          {cells.map((date, i) =>
            date ? (
              <span key={date} className="cal__cell" data-heat={heat(days[date] ?? [])} data-today={date === today} data-future={date > today}>
                <span className="cal__num">{parseDay(date).getDate()}</span>
              </span>
            ) : (
              <span key={`e${i}`} className="cal__blank" />
            ),
          )}
        </div>
        <p className="cal__today-line">{todayLine(days[today] ?? [])}</p>
      </div>
    </div>
  );
}

/** `inline`: dentro del ordenador el detalle del día va siempre bajo la cuadrícula, a cualquier ancho. */
function CalendarFull({ selectDay = null, onComplete, onOpenLibrary, inline = false }) {
  const { state } = useLibrary();
  const days = useDays(state);
  const pomos = usePomodoros(state);
  const today = dayKey();
  const [month, setMonth] = useState(() => {
    const d = selectDay ? parseDay(selectDay) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [open, setOpen] = useState(selectDay);
  const narrow = useNarrow() || inline;
  const panelRef = useRef(null);
  // Al abrir un día en móvil, su panel entra en la zona visible de la ventana (solo se desplaza esa zona)
  useEffect(() => {
    const panel = panelRef.current;
    const scroller = panel?.closest('.pc-win__body, .window__body');
    if (!narrow || !open || !panel || !scroller) return;
    const over = panel.getBoundingClientRect().bottom - scroller.getBoundingClientRect().bottom;
    if (over > 0) scroller.scrollTop += over + 8;
  }, [narrow, open]);

  // Los mismos días que la vista de la escena (lunes primero, huecos a `null`)
  const cells = useMemo(() => monthCells(dayKey(month)), [month]);

  const monthDays = cells.filter(Boolean);
  const monthEntries = monthDays.flatMap((d) => (days[d] ?? []).flatMap((g) => g.entries));
  const monthSummary = summarize(monthEntries, state.books);
  const readDays = monthDays.filter((d) => (days[d] ?? []).some((g) => g.entries.some(isActive))).length;
  const monthBooks = new Set(monthEntries.map((e) => e.bookId)).size;
  const best = monthDays.reduce((acc, d) => {
    const p = days[d]?.reduce((a, g) => a + g.pages, 0) ?? 0;
    return p > acc.p ? { d, p } : acc;
  }, { d: null, p: 0 });
  const shift = (n) => {
    playUiSound('monthTurn');
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
          <b>{monthSummary.pages.toLocaleString('es-ES')}</b> páginas
        </span>
        {monthSummary.percentBooks > 0 && (
          <span>
            avance por % en <b>{monthSummary.percentBooks}</b> {monthSummary.percentBooks === 1 ? 'libro' : 'libros'}
          </span>
        )}
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
        {WEEKDAYS_LONG.map((w) => (
          <span key={w} className="cal__weekday" role="columnheader">
            {w}
          </span>
        ))}
        {cells.map((date, i) => {
          // Días del mes anterior (gris, sin datos ni acción), como en la maqueta
          if (!date) {
            const prev = new Date(month.getFullYear(), month.getMonth(), 1 - (cells.findIndex(Boolean) - i));
            return i < cells.findIndex(Boolean) ? (
              <span key={`e${i}`} className="cal__blank cal__blank--prev" aria-hidden="true">
                <span className="cal__num">{prev.getDate()}</span>
              </span>
            ) : (
              <span key={`e${i}`} className="cal__blank" />
            );
          }
          const groups = days[date] ?? [];
          const datum = dayDatum(groups);
          const level = heat(groups);
          const col = i % 7;
          return (
            <div key={date} className="cal__cellwrap">
              <button
                type="button"
                className="cal__cell"
                data-heat={level}
                data-today={date === today}
                data-future={date > today}
                aria-pressed={open === date}
                aria-label={`${fmtDay(date, { day: 'numeric', month: 'long' })}: ${groups.length ? `${datum.label ? `${datum.label}, ` : ''}${groups.map((g) => g.book.title).join(', ')}` : 'sin lectura'}`}
                onClick={() => setOpen(open === date ? null : date)}
              >
                <span className="cal__num">{parseDay(date).getDate()}</span>
                {groups.length > 1 && <span className="cal__more">+{groups.length - 1}</span>}
                {groups.length > 0 && (
                  <span className="cal__covers" data-count={1}>
                    {groups.slice(0, 1).map((g, k) => (
                      <span key={g.book.id} className="cal__cover" data-k={k}>
                        <CalCover book={g.book} />
                      </span>
                    ))}
                  </span>
                )}
                {groups.length > 0 && <span className="cal__tab" aria-hidden="true" />}
                {pomos[date] && (
                  <span className="cal__cozy" title={`${pomos[date].count} sesiones cozy`}>
                    <Coffee aria-hidden="true" />
                  </span>
                )}
                {datum.text && (
                  <span className="cal__pages" data-kind={datum.kind}>
                    {datum.kind === 'pages' && level >= 3 && <Flame aria-hidden="true" />}
                    {datum.text}
                    {datum.kind === 'pages' && <span className="cal__unit">{' págs.'}</span>}
                  </span>
                )}
              </button>
              {open === date && !narrow && (
                <div className="cal__popwrap" data-side={col >= 4 ? 'left' : 'right'}>
                  <DayPopover date={date} groups={groups} pomodoro={pomos[date]} onClose={() => setOpen(null)} onComplete={onComplete} onOpenLibrary={onOpenLibrary} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {narrow && open && (
        <div ref={panelRef} className="cal__daypanel">
          <DayPopover date={open} groups={days[open] ?? []} pomodoro={pomos[open]} onClose={() => setOpen(null)} onComplete={onComplete} onOpenLibrary={onOpenLibrary} />
        </div>
      )}
      <p className="cal__legend">
        <span>Menos</span>
        {[0, 1, 2, 3, 4].map((h) => (
          <i key={h} data-heat={h} />
        ))}
        <span>Más páginas</span>
        <i data-heat="pct" className="cal__legend-pct" />
        <span>Lectura por %</span>
      </p>
    </div>
  );
}

export function SessionsApp() {
  const { state } = useLibrary();
  const days = useDays(state);
  const dates = Object.keys(days).sort().reverse();
  const pomodoros = state.progress.pomodoros;
  const [adding, setAdding] = useState(false);
  const today = dayKey();
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  const dayTitle = (date) => {
    const label = fmtDay(date, { day: 'numeric', month: 'long' });
    if (date === today) return `Hoy, ${label}`;
    if (date === yesterday) return `Ayer, ${label}`;
    return fmtDay(date, { weekday: 'long', day: 'numeric', month: 'long' });
  };
  return (
    <div className="sessions">
      <div className="sessions__top">
        <button type="button" className="pc-btn pc-btn--primary sessions__add" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
          <Plus aria-hidden="true" /> Registrar lectura
        </button>
        <p>
          {dates.length} días con lectura · {pomodoros.length} sesiones cozy con temporizador
        </p>
      </div>
      {adding && (
        <div className="sessions__form">
          <ReadingEntryForm key={dayKey()} date={dayKey()} keepOpen onCancel={() => setAdding(false)} />
        </div>
      )}
      {!dates.length && <p className="cal-pop__empty">Todavía no hay sesiones. Avanza páginas en un libro o usa el temporizador.</p>}
      <ol className="sessions__list">
        {dates.map((date) => (
          <li key={date}>
            <h4>
              {dayTitle(date)}
              <span>{summarize(days[date].flatMap((g) => g.entries), state.books).text}</span>
            </h4>
            <ul>
              {days[date].map((g) => (
                <BookGroup key={g.book.id} group={g} author />
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
