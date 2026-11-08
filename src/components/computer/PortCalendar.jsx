// Calendario del ordenador del piso (1.90). Los datos y el criterio de «día con lectura» son los del calendario de siempre; al elegir un día,
// sus lecturas aparecen debajo, sin ninguna ventana encima. Cada registro se puede editar y borrar como antes.
import { useEffect, useMemo, useRef, useState } from 'react';
import { playUiSound } from '../../audio/uiSounds';
import { dayKey, parseDay } from '../../domain/dates';
import { dayDatum, isActive, summarize } from '../../domain/reading';
import { monthCells } from '../../domain/roomSurfaces';
import { monthCovers } from '../../domain/monthSummary';
import { MonthBooks } from '../../features/monthBooks/MonthBooks';
import { warmCovers } from '../shelf/BookItem';
import { useLibrary } from '../../state/useLibrary';
import { PixelChevron, PixelControl } from '../../ui/PixelIcon';
import { BookGroup, useDays, usePomodoros } from '../panels/ReadingCalendar';

const WEEK = [
  ['L', 'lunes'],
  ['M', 'martes'],
  ['X', 'miércoles'],
  ['J', 'jueves'],
  ['V', 'viernes'],
  ['S', 'sábado'],
  ['D', 'domingo'],
];
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const longDay = (key) => parseDay(key).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
const fullDay = (key) => cap(parseDay(key).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));

/** La cuadrícula completa: los huecos de los días de otros meses quedan vacíos y sin acción. */
function fullCells(month) {
  const out = monthCells(dayKey(month)).map((date) => (date ? { date } : {}));
  while (out.length % 7) out.push({});
  return out;
}

export function PortCalendar({ selectDay = null, onRegister, onSubview }) {
  const { state } = useLibrary();
  const days = useDays(state);
  const pomos = usePomodoros(state);
  const today = dayKey();
  const [month, setMonth] = useState(() => {
    const d = selectDay ? parseDay(selectDay) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(selectDay ?? today);
  const cells = useMemo(() => fullCells(month), [month]);
  const monthDays = cells.filter((c) => c.date).map((c) => c.date);
  const entries = monthDays.flatMap((d) => (days[d] ?? []).flatMap((g) => g.entries));
  const summary = summarize(entries, state.books);
  const readDays = monthDays.filter((d) => (days[d] ?? []).some((g) => g.entries.some(isActive))).length;
  const groups = selected ? (days[selected] ?? []) : [];
  const pomo = selected ? pomos[selected] : null;
  // «Tu mes en libros» se abre encima y deja el calendario montado: al volver, el mismo mes y la misma altura
  const [resumen, setResumen] = useState(false);
  const raiz = useRef(null);
  const altura = useRef(0);
  const cuerpo = () => raiz.current?.closest('.pc-win__body');
  const abrirResumen = () => {
    playUiSound('ui-press');
    altura.current = cuerpo()?.scrollTop ?? 0;
    // Una entrada en el historial: el «atrás» del móvil cierra el resumen y no el ordenador
    window.history.pushState(window.history.state, '');
    setResumen(true);
  };
  // El resumen del mes en pantalla, listo antes de que se pida
  const mesClave = dayKey(month).slice(0, 7);
  useEffect(() => {
    warmCovers(monthCovers({ books: state.books, log: state.progress.readingLog, notes: state.progress.monthNotes }, mesClave), 4000);
  }, [state.books, state.progress.readingLog, state.progress.monthNotes, mesClave]);
  useEffect(() => {
    if (!resumen) return undefined;
    cuerpo()?.scrollTo(0, 0);
    onSubview?.(true);
    const cerrar = () => setResumen(false);
    window.addEventListener('popstate', cerrar);
    return () => {
      window.removeEventListener('popstate', cerrar);
      onSubview?.(false);
      const body = cuerpo();
      if (body) body.scrollTop = altura.current;
    };
    // `onSubview` solo avisa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumen]);

  const shift = (n) => {
    playUiSound('ui-press');
    const next = new Date(month.getFullYear(), month.getMonth() + n, 1);
    setMonth(next);
    const inMonth = today.slice(0, 7) === dayKey(next).slice(0, 7);
    setSelected(inMonth ? today : null);
  };

  return (
    <>
    <div className="port-cal" ref={raiz} style={resumen ? { display: 'none' } : undefined}>
      <i className="pp-cal-ring" aria-hidden="true" />
      <i className="pp-cal-ring" aria-hidden="true" />
      <div className="port-cal__head">
        <button type="button" className="pp-btn pp-btn--icon" onClick={() => shift(-1)} aria-label="Mes anterior">
          <PixelChevron />
        </button>
        <h3 aria-live="polite">{cap(month.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }))}</h3>
        <button type="button" className="pp-btn pp-btn--icon" onClick={() => shift(1)} aria-label="Mes siguiente">
          <PixelChevron next />
        </button>
      </div>
      <div className="port-cal__week" aria-hidden="true">
        {WEEK.map(([short, name]) => (
          <span key={name}>{short}</span>
        ))}
      </div>
      <div className="port-cal__grid" role="group" aria-label="Días del mes">
        {cells.map((cell, i) => {
          if (!cell.date)
            return <span key={`o${i}`} className="port-cal__other" aria-hidden="true" />;
          const g = days[cell.date] ?? [];
          const read = g.some((x) => x.entries.some(isActive));
          const datum = dayDatum(g);
          const name = `${longDay(cell.date)}${cell.date === today ? ', hoy' : ''}: ${read ? `con lectura${datum.label ? `, ${datum.label}` : ''}` : 'sin lectura'}`;
          return (
            <button
              key={cell.date}
              type="button"
              className="port-cal__day"
              data-today={cell.date === today || undefined}
              data-read={read || undefined}
              aria-pressed={selected === cell.date}
              aria-label={name}
              onClick={() => {
                playUiSound('ui-press');
                setSelected(cell.date);
              }}
            >
              <span>{parseDay(cell.date).getDate()}</span>
              {read && (datum.text ? <small className="port-cal__pag" aria-hidden="true">{datum.kind === 'pages' ? `${datum.text} p.` : datum.text}</small> : <i aria-hidden="true" />)}
            </button>
          );
        })}
      </div>
      <p className="port-cal__summary">
        <b>{summary.pages.toLocaleString('es-ES')}</b> páginas · <b>{readDays}</b> {readDays === 1 ? 'día' : 'días'} leyendo
      </p>
      <button type="button" className="pp-btn port-cal__mes" onClick={abrirResumen}>
        Tu mes en libros
      </button>
      <section className="port-cal__list" aria-live="polite" aria-label={selected ? `Lecturas del ${longDay(selected)}` : 'Lecturas'}>
        {selected ? (
          <>
            <h3>{fullDay(selected)}</h3>
            {pomo && (
              <p className="port-cal__cozy">
                {pomo.count} {pomo.count === 1 ? 'sesión' : 'sesiones'} con temporizador · {pomo.minutes} min
              </p>
            )}
            {groups.length > 0 ? (
              <ul className="cal-pop__list">
                {groups.map((g) => (
                  <BookGroup key={g.book.id} group={g} />
                ))}
              </ul>
            ) : (
              <p className="port-cal__empty">{selected > today ? 'Este día aún no ha llegado.' : 'Aún no hay lecturas este día'}</p>
            )}
            {selected <= today && (
              <button type="button" className="pp-btn pp-btn--primary" onClick={() => onRegister(selected)}>
                <PixelControl name="check" />
                {groups.length ? 'Registrar otra lectura' : 'Registrar lectura'}
              </button>
            )}
          </>
        ) : (
          <p className="port-cal__empty">Elige un día para ver sus lecturas.</p>
        )}
      </section>
    </div>
    {resumen && <MonthBooks initialMonth={dayKey(month).slice(0, 7)} onBack={() => window.history.back()} />}
    </>
  );
}
