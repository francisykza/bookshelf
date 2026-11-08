// «Tu mes en libros» (Fase 2), dentro del calendario del ordenador. Enseña solo tus datos, calculados por `monthSummary`, sin guardar nada salvo tu
// favorito y tu frase, y sin escenas 3D: portadas normales sobre baldas de madera.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Cover } from '../../components/shelf/BookItem';
import { NOTE_MAX, monthOf, monthSummary, shiftMonth } from '../../domain/monthSummary';
import { parseDay } from '../../domain/dates';
import { useCloud } from '../../state/cloudSync';
import { useLibrary } from '../../state/useLibrary';
import { PixelControl } from '../../ui/PixelIcon';
import { MonthExport } from './MonthExport';
import './month-books.css';

const POR_BALDA = 3;
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const nombreMes = (month) => cap(parseDay(`${month}-01`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));

function Baldas({ finished }) {
  const filas = [];
  for (let i = 0; i < finished.length; i += POR_BALDA) filas.push(finished.slice(i, i + POR_BALDA));
  return (
    <ul className="mb__baldas" aria-label="Libros terminados este mes">
      {filas.map((fila) => (
        <li key={fila[0].book.id} className="mb__balda">
          <ul>
            {fila.map(({ book, count }) => (
              <li key={book.id} className="mb__libro">
                <span className="mb__portada">
                  <Cover book={book} />
                </span>
                {count > 1 && <span className="mb__lecturas">{count} lecturas</span>}
                <span className="mb__titulo">{book.title}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function Recuerdo({ valor, onGuardar }) {
  const [texto, setTexto] = useState(valor);
  const ultimo = useRef(valor);
  const guardar = () => {
    if (texto === ultimo.current) return;
    ultimo.current = texto;
    onGuardar(texto);
  };
  return (
    <section className="mb__caja">
      <label htmlFor="mb-recuerdo">
        <h4>Un recuerdo de este mes</h4>
      </label>
      <textarea id="mb-recuerdo" rows={2} maxLength={NOTE_MAX} value={texto} placeholder="Opcional" onChange={(e) => setTexto(e.target.value)} onBlur={guardar} />
      <p className="mb__nota" aria-live="polite">
        {texto.length} de {NOTE_MAX}
      </p>
    </section>
  );
}

export function MonthBooks({ initialMonth, onBack }) {
  const { state, actions } = useLibrary();
  const cloud = useCloud();
  const [month, setMonth] = useState(initialMonth);
  const [intento, setIntento] = useState(0);
  const [exportando, setExportando] = useState(false);
  const raiz = useRef(null);
  const actual = monthOf();
  const cargando = cloud?.status === 'loading';
  const { summary, fallo } = useMemo(() => {
    try {
      return { summary: monthSummary({ books: state.books, log: state.progress.readingLog, notes: state.progress.monthNotes }, month) };
    } catch {
      return { fallo: true };
    }
    // `intento` vuelve a calcular al pulsar Reintentar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.books, state.progress.readingLog, state.progress.monthNotes, month, intento]);

  // Escape cierra primero la vista previa y luego el resumen, sin llegar al ordenador
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (exportando) setExportando(false);
      else onBack();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [exportando, onBack]);

  const cambiar = (by) => {
    setMonth(shiftMonth(month, by));
    raiz.current?.closest('.pc-win__body')?.scrollTo(0, 0);
  };
  const guardarNota = (patch) => actions.setMonthNote(month, patch);
  const etiqueta = nombreMes(month);

  return (
    <div className="mb" ref={raiz} data-escape-local="open">
      <header className="mb__top">
        <button type="button" className="pp-btn pp-btn--icon" onClick={onBack} aria-label="Volver al calendario">
          <PixelControl name="back" />
        </button>
        <h3>Tu mes en libros</h3>
      </header>
      <div className="mb__mes">
        <button type="button" className="pp-btn pp-btn--icon" onClick={() => cambiar(-1)} aria-label="Mes anterior">
          <PixelControl name="back" />
        </button>
        <p aria-live="polite">
          <b>{etiqueta}</b>
          {month === actual && <span className="mb__encurso">En curso</span>}
        </p>
        <button type="button" className="pp-btn pp-btn--icon" onClick={() => cambiar(1)} disabled={month >= actual} aria-label="Mes siguiente">
          <span className="pp-control--flip">
            <PixelControl name="back" />
          </span>
        </button>
      </div>

      {cargando ? (
        <p className="mb__estado" role="status">
          Cargando tu biblioteca…
        </p>
      ) : fallo ? (
        <p className="mb__estado" role="alert">
          No se ha podido preparar este mes.{' '}
          <button type="button" className="pp-btn" onClick={() => setIntento(intento + 1)}>
            Reintentar
          </button>
        </p>
      ) : (
        <>
          {summary.finished.length > 0 ? <Baldas finished={summary.finished} /> : <p className="mb__estado">{summary.hasActivity ? 'Este mes has seguido avanzando' : 'Este mes no hay lecturas registradas. Cuando las haya, aparecerán aquí.'}</p>}

          <dl className="mb__cifras">
            <div>
              <dd>{summary.finishedCount.toLocaleString('es-ES')}</dd>
              <dt>Libros terminados</dt>
            </div>
            <div>
              <dd>{summary.pages.toLocaleString('es-ES')}</dd>
              <dt>Páginas registradas</dt>
            </div>
            <div>
              <dd>{summary.days.toLocaleString('es-ES')}</dd>
              <dt>Días de lectura</dt>
            </div>
          </dl>
          {summary.unknown > 0 && <p className="mb__nota">Solo incluye los avances convertibles a páginas: {summary.unknown === 1 ? 'hay un avance' : `hay ${summary.unknown} avances`} sin total de páginas conocido.</p>}
          {summary.converted > 0 && <p className="mb__nota">Incluye {summary.converted.toLocaleString('es-ES')} páginas calculadas desde porcentajes.</p>}

          {summary.finished.length > 0 && (
            <fieldset className="mb__caja mb__favorito">
              <legend>Mi favorito del mes</legend>
              {summary.favoriteLost && <p className="mb__nota">El libro que elegiste ya no consta como terminado este mes. Puedes elegir otro.</p>}
              <label>
                <input type="radio" name="mb-favorito" checked={!summary.favorite} onChange={() => guardarNota({ favorite: null })} />
                <span>Sin elegir</span>
              </label>
              {summary.finished.map(({ book }) => (
                <label key={book.id}>
                  <input type="radio" name="mb-favorito" checked={summary.favorite?.id === book.id} onChange={() => guardarNota({ favorite: book.id })} />
                  <span>{book.title}</span>
                </label>
              ))}
            </fieldset>
          )}

          <Recuerdo key={month} valor={summary.quote} onGuardar={(quote) => guardarNota({ quote })} />

          {summary.undated.length > 0 && (
            <details className="mb__sinfecha">
              <summary>Hay libros leídos sin fecha</summary>
              <p className="mb__nota">No se cuentan en ningún mes porque no consta cuándo los terminaste.</p>
              <ul>
                {summary.undated.slice(0, 50).map((b) => (
                  <li key={b.id}>{b.title}</li>
                ))}
              </ul>
              {summary.undated.length > 50 && <p className="mb__nota">Y {summary.undated.length - 50} más.</p>}
            </details>
          )}

          <button type="button" className="pp-btn pp-btn--primary mb__guardar" onClick={() => setExportando(true)}>
            <PixelControl name="check" />
            Guardar o compartir resumen
          </button>
          {exportando && <MonthExport summary={summary} etiqueta={etiqueta} onClose={() => setExportando(false)} />}
        </>
      )}
    </div>
  );
}
