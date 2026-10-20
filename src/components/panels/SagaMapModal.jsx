// Atlas Cartográfico de Sagas (SPEC §6bis, 1.13.0): se abre tocando el sol (o la luna) del cielo. Pergamino
// náutico con marco de latón; cada saga es una ruta: lo leído en gris con su sello, lo que toca leer ahora a
// todo color con una brújula dorada, y los siguientes en color unidos por puntos dorados (#1 ➔ #2 ➔ #3).
import { BookOpen, Check, Compass, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { pageRustle } from '../../audio/ambientAudio';
import { isbnCover, newId } from '../../domain/books';
import { PRESET_SAGAS, customSaga, sagaDone, sagaRoute } from '../../domain/sagas';
import { useLibrary } from '../../state/useLibrary';
import { Cover } from '../shelf/BookItem';
import { PanelShell } from './PanelShell';

/** Rosa de los vientos de latón. */
function CompassRose({ className = '' }) {
  return (
    <svg className={`compass-rose ${className}`} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="1.5 3" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
        <path
          key={a}
          d={i % 2 ? 'M50 50 L54 50 L50 22 L46 50 Z' : 'M50 50 L56 50 L50 6 L44 50 Z'}
          fill={i % 2 ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1"
          transform={`rotate(${a} 50 50)`}
          opacity={i % 2 ? 0.6 : 1}
        />
      ))}
      <text x="50" y="5" textAnchor="middle" fontSize="7" fill="currentColor" fontFamily="serif">
        N
      </text>
      <circle cx="50" cy="50" r="3" fill="currentColor" />
    </svg>
  );
}

/** Brújula dorada animada de la parada «Leer ahora». */
function LiveCompass() {
  return (
    <svg className="live-compass" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="17" fill="#fbf1d6" stroke="#c59b27" strokeWidth="2.4" />
      <circle cx="20" cy="20" r="13" fill="none" stroke="#c59b27" strokeWidth="0.6" strokeDasharray="1 2" />
      <g className="live-compass__needle">
        <path d="M20 6 L23 20 L20 22 L17 20 Z" fill="#b3261e" />
        <path d="M20 34 L23 20 L20 18 L17 20 Z" fill="#2c1e14" />
      </g>
      <circle cx="20" cy="20" r="2" fill="#c59b27" />
    </svg>
  );
}

function Stop({ stop, saga, onOpen, onAdd }) {
  const { entry, book, state } = stop;
  const shown = book ?? {
    id: `${saga.id}-${entry.n}`,
    title: entry.title,
    author: saga.author,
    cover: entry.isbn ? isbnCover(entry.isbn) : '',
  };
  const number = entry.label ?? `#${entry.n}`;
  return (
    <li className="atlas-stop" data-state={state}>
      {state === 'now' && (
        <span className="atlas-stop__flag">
          <span aria-hidden="true">🧭</span> LEER AHORA
        </span>
      )}
      <button type="button" className="atlas-stop__cover" onClick={() => book && onOpen(book)} disabled={!book} aria-label={book ? `Abrir ${entry.title}` : entry.title}>
        <Cover book={shown} />
        {state === 'read' && <span className="atlas-stop__stamp">✔ LEÍDO</span>}
        {state === 'now' && <LiveCompass />}
      </button>
      <span className="atlas-stop__num">{number}</span>
      <b className="atlas-stop__title">{entry.title}</b>
      {state === 'read' ? (
        <span className="atlas-stop__stars" aria-label={book?.rating ? `${book.rating} estrellas` : 'Sin valorar'}>
          {'★'.repeat(book?.rating || 0)}
          <i>{'★'.repeat(5 - (book?.rating || 0))}</i>
        </span>
      ) : book ? (
        <span className="atlas-stop__where">{book.status === 'reading' ? 'En tu cama' : 'En tu estantería'}</span>
      ) : (
        <button type="button" className="atlas-stop__add" onClick={() => onAdd(entry)}>
          <Plus aria-hidden="true" /> Añadir a mi librería
        </button>
      )}
    </li>
  );
}

function NewSagaForm({ onCreate, onCancel }) {
  const [form, setForm] = useState({ name: '', author: '', titles: '' });
  const ok = form.name.trim() && form.titles.trim();
  return (
    <form
      className="atlas-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onCreate(form);
      }}
    >
      <h3>Trazar una saga nueva</h3>
      <label>
        Nombre de la saga
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Una Corte de Rosas y Espinas" required />
      </label>
      <label>
        Autora o autor
        <input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="Sarah J. Maas" />
      </label>
      <label>
        Libros en orden (uno por línea)
        <textarea rows={5} value={form.titles} onChange={(e) => setForm({ ...form, titles: e.target.value })} placeholder={'Una corte de rosas y espinas\nUna corte de niebla y furia\nUna corte de alas y ruina'} required />
      </label>
      <div className="atlas-form__row">
        <button type="submit" className="stamp-btn stamp-btn--small" disabled={!ok}>
          <Compass aria-hidden="true" /> Trazar la ruta
        </button>
        <button type="button" className="link-btn" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function SagaMapModal({ onClose, onOpenBook }) {
  const { state, actions } = useLibrary();
  const custom = state.settings.customSagas ?? [];
  const sagas = useMemo(() => [...PRESET_SAGAS, ...custom], [custom]);
  const [current, setCurrent] = useState(() => {
    // Abre en la saga que estés leyendo, si hay alguna
    const reading = sagas.find((s) => sagaRoute(s, state.books).some((st) => st.book?.status === 'reading'));
    return reading?.id ?? sagas[0].id;
  });
  const [creating, setCreating] = useState(false);
  const saga = sagas.find((s) => s.id === current) ?? sagas[0];
  const route = sagaRoute(saga, state.books);
  const done = sagaDone(route);

  const addToLibrary = (entry) => {
    actions.addBook({
      title: entry.title,
      author: saga.author || 'Autor desconocido',
      pageCount: entry.pages || 300,
      isbn: entry.isbn || '',
      cover: entry.isbn ? isbnCover(entry.isbn) : '',
      publishedDate: entry.year ? String(entry.year) : '',
      status: 'want',
      source: 'saga',
    });
    pageRustle(0.5);
  };

  return (
    <PanelShell onClose={onClose} label="Atlas de Sagas" variant="atlas">
      <div className="atlas">
        <button type="button" className="icon-btn atlas__close" onClick={onClose} aria-label="Cerrar el atlas">
          <X aria-hidden="true" />
        </button>
        <header className="atlas__head">
          <CompassRose className="atlas__rose" />
          <div>
            <h2>Atlas de Sagas</h2>
            <p>Cartografía de tus lecturas · lo recorrido en gris, el rumbo en color</p>
          </div>
        </header>

        <nav className="atlas__sagas" aria-label="Sagas">
          {sagas.map((s) => {
            const r = sagaRoute(s, state.books);
            return (
              <button key={s.id} type="button" className="atlas__saga" aria-pressed={s.id === saga.id && !creating} onClick={() => { setCurrent(s.id); setCreating(false); }}>
                <b>{s.name}</b>
                <span>
                  {sagaDone(r)}/{s.books.length} leídos
                </span>
              </button>
            );
          })}
          <button type="button" className="atlas__saga atlas__saga--new" aria-pressed={creating} onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" /> Nueva saga
          </button>
        </nav>

        {creating ? (
          <NewSagaForm
            onCancel={() => setCreating(false)}
            onCreate={(form) => {
              const s = customSaga(form, newId('saga'));
              actions.setSettings({ customSagas: [...custom, s] });
              setCurrent(s.id);
              setCreating(false);
            }}
          />
        ) : (
          <section className="atlas__map" aria-label={`Ruta de ${saga.name}`}>
            <div className="atlas__title">
              <h3>{saga.name}</h3>
              <p>
                {saga.author}
                {saga.alt && <em> · {saga.alt}</em>} · <strong>{done === route.length ? '¡Saga completada!' : `${done} de ${route.length} leídos`}</strong>
              </p>
              {saga.custom && (
                <button
                  type="button"
                  className="link-btn link-btn--danger"
                  onClick={() => {
                    actions.setSettings({ customSagas: custom.filter((c) => c.id !== saga.id) });
                    setCurrent(PRESET_SAGAS[0].id);
                  }}
                >
                  <Trash2 aria-hidden="true" /> Borrar esta saga
                </button>
              )}
            </div>
            <ol className="atlas__route">
              {route.map((stop, i) => (
                <Stop
                  key={`${saga.id}-${stop.entry.n}-${i}`}
                  stop={stop}
                  saga={saga}
                  onOpen={(book) => {
                    onClose();
                    onOpenBook(book);
                  }}
                  onAdd={addToLibrary}
                />
              ))}
            </ol>
            <p className="atlas__legend">
              <span data-key="read">
                <Check aria-hidden="true" /> Leído
              </span>
              <span data-key="now">
                <Compass aria-hidden="true" /> Leer ahora
              </span>
              <span data-key="next">
                <BookOpen aria-hidden="true" /> Siguientes
              </span>
            </p>
          </section>
        )}
      </div>
    </PanelShell>
  );
}
