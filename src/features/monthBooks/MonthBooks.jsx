// «Tu mes en libros» (Fase 2), dentro del calendario del ordenador. Enseña solo tus datos, calculados por `monthSummary`, sin guardar nada salvo tu
// favorito y tu frase, y sin escenas 3D: portadas normales sobre baldas de madera. La balda es también donde se elige el favorito.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Cover, warmCovers } from '../../components/shelf/BookItem';
import { spineColor } from '../../domain/books';
import { NOTE_MAX, monthCovers, monthOf, monthSummary, shiftMonth } from '../../domain/monthSummary';
import { parseDay } from '../../domain/dates';
import { useCloud } from '../../state/cloudSync';
import { useLibrary } from '../../state/useLibrary';
import { PixelChevron, PixelControl } from '../../ui/PixelIcon';
import { MonthExport } from './MonthExport';
import './month-books.css';

const POR_BALDA = 3;
/** Lo que se espera a un mes nuevo antes de enseñarlo: lo guardado llega antes; lo que no, entra después sobre su tapa de color. */
const ESPERA_MES = 350;
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const nombreMes = (month) => cap(parseDay(`${month}-01`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));

function Portada({ book }) {
  return (
    <span className="mb__tapa" style={{ background: spineColor(book) }}>
      <Cover book={book} instant />
    </span>
  );
}

function Baldas({ finished, favorito, onElegir }) {
  const filas = [];
  for (let i = 0; i < finished.length; i += POR_BALDA) filas.push(finished.slice(i, i + POR_BALDA));
  return (
    <div className="mb__baldas" role="radiogroup" aria-label="Libros terminados este mes. Elige tu favorito">
      {filas.map((fila) => (
        <div key={fila[0].book.id} className="mb__balda">
          {fila.map(({ book, count }) => (
            <label key={book.id} className="mb__libro" data-favorito={favorito?.id === book.id || undefined}>
              <Portada book={book} />
              <input type="radio" name="mb-favorito" aria-label={book.title} checked={favorito?.id === book.id} onChange={() => onElegir(book.id)} />
              {count > 1 && <span className="mb__lecturas">{count} lecturas</span>}
              {favorito?.id === book.id && <i className="mb__cinta" aria-hidden="true" />}
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}

function Destacado({ libro, perdido, onQuitar }) {
  return (
    <section className="mb__destacado" data-vacio={libro ? undefined : ''} aria-label="Mi favorito del mes">
      <div className="mb__atril">{libro ? <Portada book={libro} /> : <span className="mb__silueta" aria-hidden="true" />}</div>
      <div className="mb__ficha">
        <p className="mb__antetitulo">Mi favorito del mes</p>
        {libro ? (
          <>
            <h4>{libro.title}</h4>
            {libro.author && <p className="mb__autoria">{libro.author}</p>}
            <button type="button" className="mb__quitar" onClick={onQuitar}>
              Quitar favorito
            </button>
          </>
        ) : (
          <p className="mb__pista">{perdido ? 'El libro que elegiste ya no consta como terminado este mes. Toca otra portada de la balda.' : 'Toca una portada de la balda para destacarla aquí.'}</p>
        )}
      </div>
    </section>
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
    <section className="mb__recuerdo">
      <label htmlFor="mb-recuerdo">Un recuerdo de este mes</label>
      <textarea id="mb-recuerdo" rows={2} maxLength={NOTE_MAX} value={texto} placeholder="Escribe una frase, si te apetece" onChange={(e) => setTexto(e.target.value)} onBlur={guardar} />
      <p className="mb__contador" aria-live="polite">
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
  const destino = useRef(initialMonth);
  const actual = monthOf();
  const cargando = cloud?.status === 'loading';
  const datos = useMemo(() => ({ books: state.books, log: state.progress.readingLog, notes: state.progress.monthNotes }), [state.books, state.progress.readingLog, state.progress.monthNotes]);
  const { summary, fallo } = useMemo(() => {
    try {
      return { summary: monthSummary(datos, month) };
    } catch {
      return { fallo: true };
    }
    // `intento` vuelve a calcular al pulsar Reintentar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, month, intento]);

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

  // Los meses vecinos, listos antes de que se pida ir a ellos
  useEffect(() => {
    if (cargando) return;
    warmCovers([...monthCovers(datos, shiftMonth(month, -1)), ...(month < actual ? monthCovers(datos, shiftMonth(month, 1)) : [])], 4000);
  }, [datos, month, actual, cargando]);

  // El mes cambia cuando sus portadas ya se pueden pintar: la balda nunca se ve vacía entre uno y otro
  const cambiar = async (by) => {
    const siguiente = shiftMonth(destino.current, by);
    if (siguiente > actual) return;
    destino.current = siguiente;
    await warmCovers(monthCovers(datos, siguiente), ESPERA_MES);
    if (destino.current !== siguiente) return;
    setMonth(siguiente);
    raiz.current?.closest('.pc-win__body')?.scrollTo(0, 0);
  };
  const guardarNota = (patch) => actions.setMonthNote(month, patch);
  const etiqueta = nombreMes(month);

  return (
    <div className="mb" ref={raiz} data-escape-local="open">
      <div className="mb__mes">
        <button type="button" className="pp-btn pp-btn--icon" onClick={() => cambiar(-1)} aria-label="Mes anterior">
          <PixelChevron />
        </button>
        <p aria-live="polite">
          <b>{etiqueta}</b>
          {month === actual && <span className="mb__encurso">En curso</span>}
        </p>
        <button type="button" className="pp-btn pp-btn--icon" onClick={() => cambiar(1)} disabled={month >= actual} aria-label="Mes siguiente">
          <PixelChevron next />
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
          {summary.finished.length > 0 ? <Baldas finished={summary.finished} favorito={summary.favorite} onElegir={(favorite) => guardarNota({ favorite })} /> : <p className="mb__estado">{summary.hasActivity ? 'Este mes has seguido avanzando' : 'Este mes no hay lecturas registradas. Cuando las haya, aparecerán aquí.'}</p>}

          <dl className="mb__cifras">
            <div className="mb__cifra--mayor">
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

          {summary.finished.length > 0 && <Destacado libro={summary.favorite} perdido={summary.favoriteLost} onQuitar={() => guardarNota({ favorite: null })} />}

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
