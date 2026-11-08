// Calendario del ordenador del piso (1.90). Los datos y el criterio de «día con lectura» son los del calendario de siempre; al elegir un día,
// sus lecturas aparecen debajo, sin ninguna ventana encima. Cada registro se puede editar y borrar como antes.
import { useMemo, useState } from 'react';
import { playUiSound } from '../../audio/uiSounds';
import { dayKey, parseDay } from '../../domain/dates';
import { dayDatum, isActive, summarize } from '../../domain/reading';
import { monthCells } from '../../domain/roomSurfaces';
import { useLibrary } from '../../state/useLibrary';
import { PixelControl } from '../../ui/PixelIcon';
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

export function PortCalendar({ selectDay = null, onRegister }) {
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

  const shift = (n) => {
    playUiSound('ui-press');
    const next = new Date(month.getFullYear(), month.getMonth() + n, 1);
    setMonth(next);
    const inMonth = today.slice(0, 7) === dayKey(next).slice(0, 7);
    setSelected(inMonth ? today : null);
  };

  return (
    <div className="port-cal">
      <i className="pp-cal-ring" aria-hidden="true" />
      <i className="pp-cal-ring" aria-hidden="true" />
      <div className="port-cal__head">
        <button type="button" className="pp-btn pp-btn--icon" onClick={() => shift(-1)} aria-label="Mes anterior">
          <PixelControl name="back" />
        </button>
        <h3 aria-live="polite">{cap(month.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }))}</h3>
        <button type="button" className="pp-btn pp-btn--icon" onClick={() => shift(1)} aria-label="Mes siguiente">
          <span className="pp-control--flip">
            <PixelControl name="back" />
          </span>
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
              {read && <i aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <p className="port-cal__summary">
        <b>{summary.pages.toLocaleString('es-ES')}</b> páginas · <b>{readDays}</b> {readDays === 1 ? 'día' : 'días'} leyendo
      </p>
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
  );
}
