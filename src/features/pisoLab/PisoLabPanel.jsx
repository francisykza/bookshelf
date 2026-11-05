// Piloto «Del portal al sillón» (solo en el laboratorio, se abre con /?piloto=piso): el portal de siempre, el interior
// del piso en primera persona y el editor isométrico de siempre sobre el mismo layout. Cada vista es un paso del
// historial (`panel.id`: piso; `panel.select`: 'decorar', 'actual', 'balda' o 'registro'), así que Atrás funciona.
import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanelShell } from '../../components/panels/PanelShell';
import { EDITIONS, currentBook, spineColor, visualEdition } from '../../domain/books';
import { bookThicknessCm, featuredBook, spineQueue } from '../../domain/roomShelf';
import { useLibrary } from '../../state/useLibrary';
import { FACADE_HORA } from '../edificio/facade';
import { mountFacade } from '../edificio/facadeView';
import { mountPiso } from '../edificio/piso';
import { preloadCover } from './coverPreload';
import './pisoLab.css';
import { canEdit, doorLabel, loadRoom, pendientes, pisoById, portalFlats, saveRoom, ventanasDe } from './labStore';

const SAVE_MS = 400;
const SIGUE = { tarde: { hora: 'noche', label: 'Ver de noche' }, noche: { hora: 'dia', label: 'Ver de día' }, dia: { hora: 'tarde', label: 'Ver al atardecer' } };
/** Portadas expuestas en la balda: no se pide ninguna hasta acercarse a ella. */
const EXPUESTAS = 4;
const doorName = (piso) => (piso.propio ? `Entrar en tu piso, ${doorLabel(piso)}` : `Llamar y entrar en el piso de ${piso.nombre}, ${doorLabel(piso)}`);

function Portal({ onOpen, onPress, doorRef }) {
  const ref = useRef(null);
  useEffect(() => {
    const stop = new AbortController();
    // Al tocar una puerta, antes de que empiece el acercamiento
    const pressed = (e) => {
      const label = e.target.closest?.('button')?.getAttribute('aria-label');
      const piso = portalFlats().find((flat) => doorName(flat.piso) === label)?.piso;
      if (piso) onPress(piso);
    };
    ref.current.addEventListener('pointerdown', pressed, { signal: stop.signal, capture: true });
    ref.current.addEventListener('click', pressed, { signal: stop.signal, capture: true });
    const view = mountFacade(ref.current, {
      flats: portalFlats().map(({ piso, room }) => ({ puerta: piso.puerta, room, mine: piso.propio, name: piso.nombre, label: doorName(piso), onOpen: () => onOpen(piso.id) })),
    });
    // Al volver, el foco a la puerta de la que vienes
    const piso = pisoById(doorRef.current);
    if (piso) ref.current.querySelector(`button[aria-label="${doorName(piso)}"]`)?.focus({ preventScroll: true });
    return () => {
      stop.abort();
      view.destroy();
    };
    // El portal se monta una vez por visita
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref} className="ed-facade-mount" />;
}

/** El editor o la vista de siempre, sobre el mismo piso. */
function VistaActual({ piso, room, editable, evening, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    const view = mountPiso(ref.current, { room, editable, decorate: editable, inside: true, evening, label: `Piso ${doorLabel(piso)}`, onChange });
    if (import.meta.env.DEV) window.__edificioPiso = view;
    return () => view.destroy();
    // Se monta una vez: los cambios los lleva él y avisa con onChange
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref} className="ed-piso" />;
}

function CoverButton({ book, slot, onOpen }) {
  const [failed, setFailed] = useState(!book.cover);
  const name = `${book.title}${book.author ? `, de ${book.author}` : ''}. Abrir su ficha`;
  return (
    <button type="button" className="plab-cover" style={{ left: slot.left, top: slot.top, width: slot.width, height: slot.height, '--spine': spineColor(book) }} aria-label={name} onClick={() => onOpen(book)}>
      {failed ? <span className="plab-cover__cloth">{book.title}</span> : <img src={book.cover} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
    </button>
  );
}

function Interior({ piso, room, hora, reading, balda, exposed, onBook, onShelf, onOpenBook, onLost, onApi }) {
  const host = useRef(null);
  const api = useRef(null);
  const [ready, setReady] = useState(false);
  const [slots, setSlots] = useState(null);
  const handlers = useRef({ onBook, onShelf, onLost });
  useEffect(() => {
    handlers.current = { onBook, onShelf, onLost };
  });

  useEffect(() => {
    let gone = false;
    let view = null;
    const book = reading ? { title: reading.title, color: spineColor(reading), thickness: bookThicknessCm(reading) * 0.06, height: EDITIONS[visualEdition(reading)].height, coverLoad: preloadCover(reading.cover) } : null;
    import('./interior3d')
      .then(({ mountInterior }) => mountInterior(host.current, { room, piso, ventanas: ventanasDe(piso, room), book, hora, onBook: () => handlers.current.onBook(), onShelf: () => handlers.current.onShelf(), onLost: () => handlers.current.onLost() }))
      .then((v) => {
        if (gone) return v?.destroy();
        view = v;
        api.current = v;
        onApi(v);
        setReady(true);
        return undefined;
      })
      .catch((error) => {
        console.error('Piloto: no se ha podido montar el interior', error);
        if (!gone) handlers.current.onLost();
      });
    return () => {
      gone = true;
      view?.destroy();
      api.current = null;
      onApi(null);
    };
    // El interior se monta al entrar y se libera entero al salir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piso.id]);

  useEffect(() => {
    if (api.current?.debug().hora !== hora) api.current?.setHora(hora);
  }, [hora, ready]);

  useEffect(() => {
    if (!ready) return undefined;
    let stale = false;
    api.current.zoomShelf(balda).then(() => {
      if (!stale) setSlots(balda ? api.current?.coverSlots(EXPUESTAS) : null);
    });
    return () => {
      stale = true;
      setSlots(null);
    };
  }, [balda, ready]);

  return (
    <div ref={host} className="plab-stage" data-ready={ready || undefined}>
      {!ready && <p className="plab-loading">Entrando…</p>}
      {slots && exposed.slice(0, slots.length).map((book, i) => <CoverButton key={book.id} book={book} slot={slots[i]} onOpen={onOpenBook} />)}
    </div>
  );
}

function PisoView({ piso, select, onSelect, onBack, onOpenBook, onRegister, onOpenLibrary }) {
  const { state } = useLibrary();
  const { books, settings } = state;
  const [room, setRoom] = useState(() => loadRoom(piso));
  const editable = canEdit(piso);
  // Un visitante nunca llega al editor, aunque el historial lo pida
  const view = select === 'decorar' && !editable ? 'actual' : select;
  const iso = view === 'decorar' || view === 'actual';
  // Se entra a la hora de la fachada, el atardecer; el botón deja ver las otras
  const [hora, setHora] = useState(FACADE_HORA);
  const [noGpu, setNoGpu] = useState(false);
  const apiRef = useRef(null);
  const reading = editable ? currentBook(books, settings) : null;
  const exposed = useMemo(() => {
    if (!editable) return [];
    const featured = featuredBook(books, settings)?.book;
    return (featured ? [featured] : []).concat(spineQueue(books, settings, featured?.id));
  }, [books, settings, editable]);
  const faltan = useMemo(() => pendientes(room), [room]);

  // Guardado: como en el edificio, poco después de cada cambio y siempre al salir
  const pending = useRef(null);
  const timer = useRef(0);
  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current) saveRoom(piso, pending.current);
    pending.current = null;
  };
  const onChange = (next) => {
    setRoom(next);
    pending.current = next;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_MS);
  };
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!import.meta.env.PROD || location.search.includes('piloto=piso')) window.__pisoLab = () => apiRef.current;
    return () => {
      delete window.__pisoLab;
    };
  }, []);

  const title = piso.propio ? `Tu piso · ${doorLabel(piso)}` : `Piso de ${piso.nombre} · ${doorLabel(piso)}`;
  return (
    <div className="ed-room ed-inside plab-room">
      <div className="ed-bar plab-bar">
        <button type="button" className="px-btn" onClick={onBack}>
          <ArrowLeft aria-hidden="true" /> {view === 'decorar' ? 'Volver al sillón' : view === 'balda' || view === 'actual' ? 'Volver' : 'Al portal'}
        </button>
        <h2 className="plab-title">{title}</h2>
      </div>
      {iso ? (
        <VistaActual piso={piso} room={room} editable={view === 'decorar'} evening={hora !== 'dia'} onChange={onChange} />
      ) : noGpu ? (
        <div className="plab-fallback" role="alert">
          <p>Este dispositivo no puede dibujar el interior. Tu biblioteca y tu registro siguen aquí.</p>
          <button type="button" className="px-btn" onClick={onOpenLibrary}>
            Abrir Mi biblioteca
          </button>
          {reading && (
            <button type="button" className="px-btn" onClick={() => onRegister()}>
              Registrar lectura de {reading.title}
            </button>
          )}
          <button type="button" className="px-btn" onClick={() => onSelect(editable ? 'decorar' : 'actual')}>
            Ver el piso en la vista de siempre
          </button>
        </div>
      ) : (
        <>
          <Interior
            piso={piso}
            room={room}
            hora={hora}
            reading={reading}
            balda={view === 'balda'}
            exposed={exposed}
            onApi={(v) => (apiRef.current = v)}
            onBook={() => onRegister()}
            onShelf={() => onSelect('balda')}
            onOpenBook={onOpenBook}
            onLost={() => setNoGpu(true)}
          />
          <div className="plab-controls">
            {reading && (
              <button type="button" className="px-btn plab-primary" onClick={() => onRegister()}>
                Registrar lectura de {reading.title}
              </button>
            )}
            {view !== 'balda' && (
              <button type="button" className="px-btn" onClick={() => onSelect('balda')}>
                Ver la balda
              </button>
            )}
            {editable && (
              <button type="button" className="px-btn" onClick={() => onSelect('decorar')}>
                Decorar
              </button>
            )}
            <button type="button" className="px-btn" onClick={() => setHora(SIGUE[hora].hora)}>
              {SIGUE[hora].label}
            </button>
            {!editable && <p className="plab-note">Puedes mirar, pero no tocar nada.</p>}
            {faltan.length > 0 && (
              <p className="plab-note">
                Aún sin esta vista: {faltan.join(', ')}.{' '}
                <button type="button" className="link-btn" onClick={() => onSelect(editable ? 'decorar' : 'actual')}>
                  Verlos en la vista de siempre
                </button>
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function PisoLabPanel({ pisoId, select, onOpen, onSelect, onBack, onClose, onOpenBook, onRegister, onOpenLibrary }) {
  const piso = pisoById(pisoId);
  const { state } = useLibrary();
  // Lo que hace falta al otro lado de la puerta empieza a llegar al tocarla
  const prepare = (door) => {
    import('./interior3d');
    if (door.propio) preloadCover(currentBook(state.books, state.settings)?.cover);
  };
  // La puerta de la que vienes, para devolverle el foco al volver al portal
  const lastDoor = useRef(null);
  useEffect(() => {
    if (piso) lastDoor.current = piso.id;
  }, [piso]);
  return (
    // Con el registro encima, Escape es suyo
    <PanelShell onClose={select === 'registro' ? () => {} : onClose} label={piso ? 'Interior del piso' : 'El edificio del puerto · piloto'} variant="edificio">
      {piso ? (
        <PisoView key={piso.id} piso={piso} select={select} onSelect={onSelect} onBack={onBack} onOpenBook={onOpenBook} onRegister={onRegister} onOpenLibrary={onOpenLibrary} />
      ) : (
        <>
          <div className="ed-bar plab-bar">
            <button type="button" className="px-btn" onClick={onClose}>
              <ArrowLeft aria-hidden="true" /> Salir
            </button>
            <h2 className="px-sr">El edificio del puerto</h2>
          </div>
          <Portal onOpen={onOpen} onPress={prepare} doorRef={lastDoor} />
        </>
      )}
    </PanelShell>
  );
}
