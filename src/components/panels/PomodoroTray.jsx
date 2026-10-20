// Bandeja de madera de olivo (SPEC §6, 1.12.0): temporizador de lectura cozy con la carta de una cafetería
// mediterránea para elegir la bebida, que se va vaciando con la sesión. Al terminar una sesión pregunta
// cuántas páginas has leído y las suma a tu libro.
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { currentBook, progress } from '../../domain/books';
import { dayKey } from '../../domain/dates';
import { useLibrary } from '../../state/useLibrary';
import { DRINKS, Drink } from './Drinks';
import { PanelShell } from './PanelShell';

/**
 * Fin de una sesión: "¿por qué página vas?" con una estimación según tu velocidad, y después un resumen
 * de lo avanzado. Las páginas se apuntan en el día de hoy, así que aparecen en el calendario del portátil.
 */
function SessionReport({ book, onDone, onOpenCalendar }) {
  const { state, actions } = useLibrary();
  const reading = state.books.filter((b) => b.status === 'reading');
  const [bookId, setBookId] = useState(book?.id ?? reading[0]?.id ?? '');
  const chosen = state.books.find((b) => b.id === bookId);
  const estimate = chosen
    ? Math.min(chosen.pageCount, chosen.currentPage + Math.round((state.settings.focusMinutes * state.settings.pagesPerHour) / 60))
    : 0;
  const [page, setPage] = useState(estimate);
  const [report, setReport] = useState(null);
  const todayPages = state.progress.readingLog.filter((e) => e.date === dayKey()).reduce((sum, e) => sum + e.pages, 0);

  if (!chosen) {
    return (
      <div className="tray__ask">
        <p>¡Sesión completada! Abre un libro en tu librería para ir apuntando lo que lees.</p>
        <button type="button" className="link-btn" onClick={onDone}>
          Cerrar
        </button>
      </div>
    );
  }

  if (report) {
    return (
      <div className="tray__ask tray__report" role="status">
        <p className="tray__report-title">¡Bien leído! ☕</p>
        <p>
          {report.pages > 0 ? (
            <>
              Has avanzado <b>{report.pages} {report.pages === 1 ? 'pág.' : 'págs.'}</b> de <em>{report.title}</em>: <b>+{report.gain} %</b>, ahora vas por el{' '}
              <b>{report.now} %</b>
              {report.finished && ' y ¡lo has terminado!'}.
            </>
          ) : (
            <>Esta vez no has pasado de página, pero la sesión cuenta para tus misiones.</>
          )}
        </p>
        <p>Hoy llevas {todayPages} páginas. Ya está apuntado en tu calendario.</p>
        <div className="tray__report-actions">
          <button type="button" className="stamp-btn stamp-btn--small" onClick={onOpenCalendar}>
            <CalendarDays aria-hidden="true" /> Ver en el calendario
          </button>
          <button type="button" className="link-btn" onClick={onDone}>
            Seguir aquí
          </button>
        </div>
      </div>
    );
  }

  const target = Math.max(chosen.currentPage, Math.min(chosen.pageCount, Number(page) || 0));
  const delta = target - chosen.currentPage;
  return (
    <form
      className="tray__ask"
      onSubmit={(e) => {
        e.preventDefault();
        const before = progress(chosen);
        const after = chosen.pageCount ? Math.min(100, Math.round((target / chosen.pageCount) * 100)) : 0;
        if (delta > 0) actions.setPage(chosen.id, target);
        setReport({ title: chosen.title, pages: delta, gain: after - before, now: after, finished: target >= chosen.pageCount });
      }}
    >
      <p className="tray__report-title">¡Sesión completada!</p>
      <p>¿Por qué página vas?</p>
      {reading.length > 1 && (
        <select
          value={bookId}
          onChange={(e) => {
            const next = state.books.find((b) => b.id === e.target.value);
            setBookId(e.target.value);
            if (next) setPage(Math.min(next.pageCount, next.currentPage + Math.round((state.settings.focusMinutes * state.settings.pagesPerHour) / 60)));
          }}
          aria-label="Libro que has leído"
        >
          {reading.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
      )}
      <label className="tray__page">
        <span>Página</span>
        <input
          type="number"
          min={chosen.currentPage}
          max={chosen.pageCount}
          value={page}
          onChange={(e) => setPage(e.target.value)}
          className="ink-input ink-input--num"
          aria-label="Página por la que vas"
        />
        <span>de {chosen.pageCount}</span>
      </label>
      <span className="tray__delta">{delta > 0 ? `= ${delta} ${delta === 1 ? 'pág. leída' : 'págs. leídas'}` : 'Sin páginas nuevas'}</span>
      <div className="tray__ask-actions">
        <button type="submit" className="stamp-btn stamp-btn--small">
          Apuntar
        </button>
        <button type="button" className="link-btn" onClick={onDone}>
          Ahora no
        </button>
      </div>
    </form>
  );
}

const PRESETS = [
  { focus: 25, rest: 5, label: '25 · 5' },
  { focus: 50, rest: 10, label: '50 · 10' },
];

const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export function PomodoroTray({ onClose, timer, askPages, onPagesDone, onOpenCalendar }) {
  const { state, actions } = useLibrary();
  const { settings } = state;
  const book = currentBook(state.books, settings);
  const level = timer.phase === 'focus' ? timer.remaining / timer.total : 1 - timer.remaining / timer.total;
  const custom = !PRESETS.some((p) => p.focus === settings.focusMinutes && p.rest === settings.breakMinutes);

  return (
    <PanelShell onClose={onClose} label="Temporizador de lectura" variant="tray">
      <div className="tray">
        <div className="tray__wood">
          <span className="brass-clip brass-clip--tl" aria-hidden="true" />
          <span className="brass-clip brass-clip--tr" aria-hidden="true" />
          <div className="tray__head">
            <h2>Temporizador cozy</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar la bandeja">
              ×
            </button>
          </div>

          <div className="tray__main paper-sheet">
            <span className="washi washi--tl" aria-hidden="true" />
            <div className="tray__drink" data-phase={timer.phase}>
              <Drink kind={settings.drink} level={timer.running || timer.remaining < timer.total ? level : 1} size={150} />
              <p className="tray__drink-name">{DRINKS[settings.drink].name}</p>
            </div>
            <div className="tray__clock">
              <span className="tray__phase">{timer.phase === 'focus' ? 'Sesión de lectura' : 'Descanso: estírate como Miel'}</span>
              <strong aria-live="off">{mmss(timer.remaining)}</strong>
              {book && timer.phase === 'focus' && (
                <span className="tray__book">
                  con <em>{book.title}</em>
                </span>
              )}
              <div className="tray__controls">
                {timer.running ? (
                  <button type="button" className="stamp-btn" onClick={timer.pause}>
                    <Pause aria-hidden="true" /> Pausar
                  </button>
                ) : (
                  <button type="button" className="stamp-btn" onClick={timer.start}>
                    <Play aria-hidden="true" /> {timer.remaining < timer.total ? 'Seguir' : 'Empezar'}
                  </button>
                )}
                <button type="button" className="icon-btn" onClick={timer.reset} aria-label="Reiniciar el temporizador" title="Reiniciar">
                  <RotateCcw aria-hidden="true" />
                </button>
                {timer.phase === 'break' && (
                  <button type="button" className="icon-btn" onClick={timer.skipBreak} aria-label="Saltar el descanso" title="Saltar descanso">
                    <SkipForward aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {askPages && <SessionReport book={book} onDone={onPagesDone} onOpenCalendar={onOpenCalendar} />}

          {/* Carta de la cafetería del puerto: elige qué te acompaña en la sesión */}
          <fieldset className="tray__drinks cafe-menu paper-sheet" disabled={timer.running}>
            <span className="washi washi--top" aria-hidden="true" />
            <legend className="cafe-menu__title">
              <span>Carta</span>
              <em>Café del Puerto · bebidas para leer</em>
            </legend>
            <ul className="cafe-menu__list">
              {Object.entries(DRINKS).map(([key, d]) => (
                <li key={key}>
                  <button type="button" className="drink-choice" aria-pressed={settings.drink === key} onClick={() => actions.setSettings({ drink: key })}>
                    <span className="drink-choice__art">
                      <Drink kind={key} size={58} />
                    </span>
                    <span className="drink-choice__text">
                      <b>{d.name}</b>
                      <em>{d.note}</em>
                    </span>
                    <span className="drink-choice__leader" aria-hidden="true" />
                    <span className="drink-choice__temp">{d.hot ? 'caliente' : 'frío'}</span>
                    {settings.drink === key && (
                      <span className="drink-choice__mark" aria-hidden="true">
                        tu elección
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset className="tray__durations" disabled={timer.running}>
            <legend>Duración</legend>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="paper-chip"
                aria-pressed={p.focus === settings.focusMinutes && p.rest === settings.breakMinutes}
                onClick={() => actions.setSettings({ focusMinutes: p.focus, breakMinutes: p.rest })}
              >
                {p.label} min
              </button>
            ))}
            <label className="tray__custom" data-active={custom}>
              <span>Personalizada</span>
              <input
                type="number"
                min="1"
                max="180"
                value={settings.focusMinutes}
                onChange={(e) => actions.setSettings({ focusMinutes: Math.max(1, Math.min(180, Number(e.target.value) || 1)) })}
                aria-label="Minutos de lectura"
              />
              <span>+</span>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.breakMinutes}
                onChange={(e) => actions.setSettings({ breakMinutes: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })}
                aria-label="Minutos de descanso"
              />
              <span>min</span>
            </label>
          </fieldset>
        </div>
      </div>
    </PanelShell>
  );
}
