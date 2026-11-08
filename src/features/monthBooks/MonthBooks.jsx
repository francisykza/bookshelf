// «Tu mes en libros», dentro del calendario del ordenador. Enseña solo tus datos, calculados por `monthSummary`; lo único que guarda es tu ranking
// y tu recuerdo. Tres pestañas: Resumen (podio, cifras y el resto de libros), Favoritos (el editor del podio) y Recuerdo.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Share } from 'lucide-react';
import { Cover, warmCovers } from '../../components/shelf/BookItem';
import { useConfirmedSave } from '../../components/book/Annotations';
import { spineColor } from '../../domain/books';
import { FAVORITES_MAX, NOTE_MAX, dropFavorite, monthCovers, monthOf, monthSummary, moveFavorite, noteFavorites, placeFavorite, shiftMonth } from '../../domain/monthSummary';
import { parseDay } from '../../domain/dates';
import { useCloud } from '../../state/cloudSync';
import { useLibrary } from '../../state/useLibrary';
import { PixelChevron } from '../../ui/PixelIcon';
import { MonthExport } from './MonthExport';
import './month-books.css';

const POR_BALDA = 4;
const PEANAS = ['first', 'second', 'third'];
const SUBTITULO = { 1: 'Una historia que se queda conmigo', 2: 'Dos historias que se quedan conmigo', 3: 'Tres historias que se quedan conmigo' };
/** Lo que se espera a un mes nuevo antes de enseñarlo: lo guardado llega antes; lo que no, entra después sobre su tapa de color. */
const ESPERA_MES = 350;
const PESTANAS = [
  { id: 'resumen', label: 'Resumen', tone: 'sage' },
  { id: 'favoritos', label: 'Favoritos', tone: 'terracotta' },
  { id: 'recuerdo', label: 'Recuerdo', tone: 'blue' },
];
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const nombreMes = (month) => cap(parseDay(`${month}-01`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));

function Portada({ book }) {
  return (
    <span className="mb__tapa" style={{ background: spineColor(book) }}>
      <Cover book={book} instant />
    </span>
  );
}

function Podio({ podium }) {
  return (
    <section className="mb-podio__marco" aria-label="Mis favoritos del mes">
      <header className="mb-podio__cabecera">
        <h3>Mis favoritos del mes</h3>
        <p>{SUBTITULO[podium.length]}</p>
      </header>
      <ol className="mb-podio" data-n={podium.length}>
        {podium.map(({ book, count }, i) => (
          <li key={book.id} data-puesto={i + 1} aria-label={`Puesto ${i + 1}: ${book.title}, de ${book.author}${count > 1 ? `, ${count} lecturas` : ''}`}>
            <span className="mb-podio__libro">
              {i === 0 && <img className="mb-podio__destello" src="/assets/puerto/acabado/destello.svg" alt="" />}
              {i === 0 && <img className="mb-podio__estrella" src="/assets/puerto/acabado/star.svg" alt="" />}
              <Portada book={book} />
            </span>
            <span className="mb-podio__peana">
              <img src={`/assets/puerto/acabado/podium-${PEANAS[i]}.svg`} alt="" />
              <b aria-hidden="true">{i + 1}</b>
            </span>
          </li>
        ))}
      </ol>
      <span className="mb-podio__base" aria-hidden="true" />
    </section>
  );
}

function Resto({ libros }) {
  const filas = [];
  for (let i = 0; i < libros.length; i += POR_BALDA) filas.push(libros.slice(i, i + POR_BALDA));
  return (
    <ul className="mb__baldas" aria-label="Libros terminados este mes">
      {filas.map((fila) => (
        <li key={fila[0].book.id} className="mb__balda">
          {fila.map(({ book, count }) => (
            <span key={book.id} className="mb__libro" role="img" aria-label={`${book.title}, de ${book.author}${count > 1 ? `, ${count} lecturas` : ''}`}>
              <Portada book={book} />
              {count > 1 && <span className="mb__lecturas">{count} lecturas</span>}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}

function Cifras({ summary }) {
  return (
    <>
      <dl className="mb__cifras">
        <div className="mb__cifra--mayor">
          <dd>{summary.finishedCount.toLocaleString('es-ES')}</dd>
          <dt>libros</dt>
        </div>
        <div>
          <dd>{summary.pages.toLocaleString('es-ES')}</dd>
          <dt>páginas</dt>
        </div>
        <div>
          <dd>{summary.days.toLocaleString('es-ES')}</dd>
          <dt>días leyendo</dt>
        </div>
      </dl>
      {summary.unknown > 0 && <p className="mb__nota">Solo incluye los avances convertibles a páginas: {summary.unknown === 1 ? 'hay un avance' : `hay ${summary.unknown} avances`} sin total de páginas conocido.</p>}
      {summary.converted > 0 && <p className="mb__nota">Incluye {summary.converted.toLocaleString('es-ES')} páginas calculadas desde porcentajes.</p>}
    </>
  );
}

/** Tres puestos; toca uno y luego un libro. Subir y bajar con botones: arrastrar nunca es la única forma. */
function Favoritos({ summary, onCambiar, guardado, onReintentar }) {
  const ids = summary.podium.map((p) => p.book.id);
  const [activo, setActivo] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const hueco = Math.min(ids.length, FAVORITES_MAX - 1);
  const puesto = activo == null ? hueco : Math.min(activo, hueco);
  const titulo = (id) => summary.finished.find((f) => f.book.id === id)?.book.title ?? '';
  const aplicar = (siguiente, texto) => {
    onCambiar(siguiente);
    setMensaje(texto);
  };
  const elegir = (id) => {
    const siguiente = placeFavorite(ids, id, puesto);
    aplicar(siguiente, `«${titulo(id)}» está en el puesto ${siguiente.indexOf(id) + 1}.`);
    setActivo(null);
  };
  const mover = (i, by) => aplicar(moveFavorite(ids, i, by), `«${titulo(ids[i])}» pasa al puesto ${i + by + 1}.`);
  return (
    <section className="mb-editor" aria-label="Elegir mis favoritos">
      <p className="mb__nota">Tu selección y tu orden. Solo la ves tú.</p>
      {summary.favoriteLost && <p className="mb__nota">Un libro que habías elegido ya no consta como terminado este mes y ha salido del podio.</p>}
      <ol className="mb-puestos">
        {[0, 1, 2].map((i) => {
          const entrada = summary.podium[i];
          const libre = !entrada;
          const disponible = i <= ids.length;
          return (
            <li key={i} className="mb-puesto" data-activo={puesto === i || undefined} data-libre={libre || undefined}>
              <button type="button" className="mb-puesto__elige" disabled={!disponible} aria-pressed={puesto === i} aria-label={libre ? `Puesto ${i + 1}, libre` : `Puesto ${i + 1}: ${entrada.book.title}. Sustituir`} onClick={() => setActivo(i)}>
                <span className="mb-puesto__num" aria-hidden="true">
                  {i + 1}
                </span>
                {entrada ? <Portada book={entrada.book} /> : <span className="mb-puesto__vacio" aria-hidden="true" />}
                <span className="mb-puesto__titulo">{entrada ? entrada.book.title : 'Sin elegir'}</span>
              </button>
              {entrada && (
                <span className="mb-puesto__mandos">
                  <button type="button" className="pp-btn pp-btn--icon" disabled={i === 0} aria-label={`Subir ${entrada.book.title}`} onClick={() => mover(i, -1)}>
                    ↑
                  </button>
                  <button type="button" className="pp-btn pp-btn--icon" disabled={i === ids.length - 1} aria-label={`Bajar ${entrada.book.title}`} onClick={() => mover(i, 1)}>
                    ↓
                  </button>
                  <button type="button" className="pp-btn pp-btn--icon" aria-label={`Quitar ${entrada.book.title}`} onClick={() => aplicar(dropFavorite(ids, entrada.book.id), `«${entrada.book.title}» ya no está en el podio.`)}>
                    ✕
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mb__nota">Elige un libro para el puesto {puesto + 1}:</p>
      <ul className="mb-candidatos">
        {summary.finished.map(({ book }) => {
          const en = ids.indexOf(book.id);
          return (
            <li key={book.id}>
              <button type="button" className="mb-candidato" aria-label={`${book.title}, de ${book.author}${en >= 0 ? `. En el puesto ${en + 1}` : ''}`} onClick={() => elegir(book.id)}>
                <Portada book={book} />
                {en >= 0 && <span className="mb-candidato__puesto">{en + 1}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mb__estadoguardar" role={guardado === 'error' ? 'alert' : 'status'} data-estado={guardado}>
        {guardado === 'error' ? (
          <>
            No se ha podido guardar tu ranking.{' '}
            <button type="button" className="link-btn" onClick={onReintentar}>
              Reintentar
            </button>
          </>
        ) : guardado === 'saving' ? (
          'Guardando…'
        ) : (
          mensaje && `${mensaje}${guardado === 'saved' ? ' Guardado.' : ''}`
        )}
      </p>
    </section>
  );
}

function Recuerdo({ valor, onGuardar, guardado, onReintentar }) {
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
      <textarea id="mb-recuerdo" rows={3} maxLength={NOTE_MAX} value={texto} placeholder="Escribe una frase, si te apetece" onChange={(e) => setTexto(e.target.value)} onBlur={guardar} />
      <p className="mb__contador" aria-live="polite">
        {texto.length} de {NOTE_MAX}
      </p>
      <p className="mb__estadoguardar" role={guardado === 'error' ? 'alert' : 'status'} data-estado={guardado}>
        {guardado === 'error' ? (
          <>
            No se ha podido guardar tu recuerdo.{' '}
            <button type="button" className="link-btn" onClick={onReintentar}>
              Reintentar
            </button>
          </>
        ) : guardado === 'saved' ? (
          'Recuerdo guardado.'
        ) : null}
      </p>
    </section>
  );
}

export function MonthBooks({ initialMonth, onBack }) {
  const { state, actions } = useLibrary();
  const cloud = useCloud();
  const [month, setMonth] = useState(initialMonth);
  const [pestana, setPestana] = useState('resumen');
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
  const notaActual = state.progress.monthNotes?.[month];
  const guardaFavoritos = useConfirmedSave((check) => JSON.stringify(noteFavorites(notaActual)) === check);
  const guardaRecuerdo = useConfirmedSave((check) => (notaActual?.quote ?? '') === check);

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
    guardaFavoritos.setStatus('idle');
    guardaRecuerdo.setStatus('idle');
    raiz.current?.closest('.pc-win__body')?.scrollTo(0, 0);
  };
  const ir = (id) => {
    setPestana(id);
    raiz.current?.closest('.pc-win__body')?.scrollTo(0, 0);
  };
  const cambiarFavoritos = (favorites) => guardaFavoritos.save(() => actions.setMonthNote(month, { favorites }), JSON.stringify(favorites));
  const guardarRecuerdo = (quote) => guardaRecuerdo.save(() => actions.setMonthNote(month, { quote }), quote.trim() ? quote : '');
  const etiqueta = nombreMes(month);
  const hayLibros = summary?.finished.length > 0;

  return (
    <div className="mb bs-literary" ref={raiz} data-escape-local="open">
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
          <div className="lit-tabs" role="tablist" aria-label="Secciones del resumen">
            {PESTANAS.map((p) => (
              <button key={p.id} type="button" role="tab" id={`mb-tab-${p.id}`} aria-controls={`mb-panel-${p.id}`} aria-selected={pestana === p.id} className="color-tab" data-tone={p.tone} onClick={() => ir(p.id)}>
                {p.label}
              </button>
            ))}
          </div>

          <div className="mb__panel" role="tabpanel" id="mb-panel-resumen" aria-labelledby="mb-tab-resumen" hidden={pestana !== 'resumen'}>
            {summary.podium.length > 0 && <Podio podium={summary.podium} />}
            {summary.favoriteLost && summary.podium.length === 0 && <p className="mb__nota">El libro que habías elegido ya no consta como terminado este mes.</p>}
            {hayLibros && (
              <button type="button" className="pp-btn mb__elegir" onClick={() => ir('favoritos')}>
                <Pencil aria-hidden="true" width="16" height="16" />
                {summary.podium.length ? 'Cambiar mis favoritos' : 'Elegir mis favoritos'}
              </button>
            )}
            {hayLibros && <p className="mb__notita">(Mi selección y orden personal)</p>}
            {!hayLibros && <p className="mb__estado">{summary.hasActivity ? 'Este mes has seguido avanzando' : 'Este mes no hay lecturas registradas. Cuando las haya, aparecerán aquí.'}</p>}
            <div className="lit-adorno" aria-hidden="true">
              <img src="/assets/puerto/acabado/book.svg" alt="" />
            </div>
            <Cifras summary={summary} />
            {summary.rest.length > 0 && (
              <>
                <h4 className="mb__titulo">
                  {summary.podium.length ? 'También me acompañaron' : 'Libros terminados'} <span>({summary.rest.length})</span>
                </h4>
                <Resto libros={summary.rest} />
              </>
            )}
            {summary.quote.trim() && <p className="mb__frase">{summary.quote}</p>}
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
              <Share aria-hidden="true" width="20" height="20" />
              Guardar o compartir resumen
            </button>
          </div>

          <div className="mb__panel" role="tabpanel" id="mb-panel-favoritos" aria-labelledby="mb-tab-favoritos" hidden={pestana !== 'favoritos'}>
            {hayLibros ? <Favoritos key={month} summary={summary} onCambiar={cambiarFavoritos} guardado={guardaFavoritos.status} onReintentar={guardaFavoritos.retry} /> : <p className="mb__estado">Cuando termines algún libro este mes, podrás elegir aquí tus favoritos.</p>}
          </div>

          <div className="mb__panel" role="tabpanel" id="mb-panel-recuerdo" aria-labelledby="mb-tab-recuerdo" hidden={pestana !== 'recuerdo'}>
            <Recuerdo key={month} valor={summary.quote} onGuardar={guardarRecuerdo} guardado={guardaRecuerdo.status} onReintentar={guardaRecuerdo.retry} />
          </div>

          {exportando && <MonthExport summary={summary} etiqueta={etiqueta} onClose={() => setExportando(false)} />}
        </>
      )}
    </div>
  );
}
