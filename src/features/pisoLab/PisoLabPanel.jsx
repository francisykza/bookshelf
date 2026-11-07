// Piloto «Del portal al sillón» (solo en el laboratorio, se abre con /?piloto=piso): el portal de siempre, el interior
// del piso en primera persona y el editor isométrico de siempre sobre el mismo layout. Cada vista es un paso del
// historial (`panel.id`: piso; `panel.select`: 'decorar', 'actual', 'registro', 'balda:N', 'toda', 'ficha:N:libro', 'ordenador…' o 'abrir:herramienta'), así que Atrás
// funciona. La ficha y el registro se abren encima con el interior montado: al cerrarlos sigues con el mismo encuadre.
import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanelShell } from '../../components/panels/PanelShell';
import { currentBook } from '../../domain/books';
import { essentialItems, essentialName } from './essentials';
import { useLibrary } from '../../state/useLibrary';
import { FACADE_HORA } from '../edificio/facade';
import { mountFacade } from '../edificio/facadeView';
import { mountPiso } from '../edificio/piso';
import { installPixelVars, pixelIconSmallSrc } from '../edificio/pixelUi';
import { preloadCover } from './coverPreload';
import { bookFace } from './spineLooks';
import { LabMeter, wantsMeter } from './LabMeter';
import { beginMount, cancelMount, markCode, markInteractive, markPortal, markPress, markScene } from './labTiming';
import './pisoLab.css';
import { PisoLibrary, emptyLibraryMemory } from './PisoLibrary';
import { roomLimit, toggleExhibit } from './roomSelection';
import { TOP_ROW, copyData, fitSlots, sceneKey, shelfRows } from './shelfLayout';
import { canEdit, doorLabel, loadRoom, pendientes, pisoById, portalFlats, repairNews, resetRoom, saveRoom, ventanasDe } from './labStore';
import { PisoMenu } from './PisoMenu';
import { demoLibraryActive } from './sampleLibrary';
import { HOME_PISO } from './inicio';
import { rememberMyPiso, saveMyPiso } from '../edificio/myPiso';
import { savable, useMyPiso, withDoorAndComputer } from './useMyPiso';

const SAVE_MS = 400;
const NO_NEWS = { added: [], moved: 0, stored: 0 };
const SIGUE = { tarde: { hora: 'noche', label: 'Ver de noche', short: 'Noche', icon: 'luna' }, noche: { hora: 'dia', label: 'Ver de día', short: 'Día', icon: 'sol' }, dia: { hora: 'tarde', label: 'Ver al atardecer', short: 'Tarde', icon: 'sol' } };
/** Un dedo que se desliza más que esto sobre un libro no lo está eligiendo. */
const SPOT_SLOP = 8;
const doorName = (piso) => (piso.propio ? `Entrar en tu piso, ${doorLabel(piso)}` : `Llamar y entrar en el piso de ${piso.nombre}, ${doorLabel(piso)}`);

function Portal({ onOpen, onPress, doorRef }) {
  const ref = useRef(null);
  useEffect(() => {
    const stop = new AbortController();
    // Al tocar una puerta, antes de que empiece el acercamiento
    const pressed = (e) => {
      const label = e.target.closest?.('button')?.getAttribute('aria-label');
      const piso = portalFlats().find((flat) => doorName(flat.piso) === label)?.piso;
      if (piso) onPress(piso, e.type === 'click');
    };
    ref.current.addEventListener('pointerdown', pressed, { signal: stop.signal, capture: true });
    ref.current.addEventListener('click', pressed, { signal: stop.signal, capture: true });
    const view = mountFacade(ref.current, {
      flats: portalFlats().map(({ piso, room }) => ({ puerta: piso.puerta, room, mine: piso.propio, name: piso.nombre, label: doorName(piso), onOpen: () => onOpen(piso.id) })),
    });
    markPortal();
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
function VistaActual({ piso, room, editable, evening, inventory = null, onChange, onView }) {
  const ref = useRef(null);
  const api = useRef(null);
  useEffect(() => {
    // Tu piso real: tus copias de cada mueble, como al decorar en el edificio (el servidor decide al guardar)
    const view = mountPiso(ref.current, { room, editable, decorate: editable, inside: true, evening, label: `Piso ${doorLabel(piso)}`, onChange, stackTaps: true, inventory });
    api.current = view;
    if (import.meta.env.DEV) window.__edificioPiso = view;
    onView?.(view);
    return () => {
      api.current = null;
      onView?.(null);
      view.destroy();
    };
    // Se monta una vez: los cambios los lleva él y avisa con onChange
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (inventory) api.current?.setInventory(inventory);
  }, [inventory]);
  return <div ref={ref} className="ed-piso" />;
}

/** El ejemplar dibujado es el que se toca: encima solo hay un botón transparente, para el dedo y el lector de pantalla. */
function BookSpot({ book, slot, selected, onChoose }) {
  const down = useRef(null);
  const name = `${book.title}${book.author ? `, de ${book.author}` : ''}`;
  return (
    <button
      type="button"
      className="plab-spot"
      style={{ left: slot.left, top: slot.top, width: slot.width, height: slot.height }}
      aria-label={name}
      aria-pressed={selected}
      onPointerDown={(e) => (down.current = [e.clientX, e.clientY])}
      onClick={(e) => {
        // Con el teclado no hay dedo que comprobar
        if (e.detail && down.current && Math.hypot(e.clientX - down.current[0], e.clientY - down.current[1]) > SPOT_SLOP) return;
        onChoose(book);
      }}
    />
  );
}

/** Lo que se ve del ejemplar elegido: qué viene de su edición y qué está reconstruido. */
const copyNote = (book) => {
  const spine = typeof book.spine === 'string' && book.spine ? 'lomo de su edición' : 'lomo reconstruido';
  return book.cover ? `Portada de su edición · ${spine}` : `Sin portada · ${spine}`;
};
// El mismo ejemplar en la mesa y en la estantería (1.88): mismos datos, mismas medidas y la misma cara (portada y lomo)
const tableData = (book) => book && { ...copyData(book), coverLoad: preloadCover(book.cover), face: bookFace(book) };
// Cada ejemplar, con la portada de su edición (1.88): solo se piden las de los que se dibujan, en miniatura
const shelfScene = (shelfBooks) => shelfBooks && { cover: tableData(shelfBooks.cover), rows: shelfBooks.rows.map((row) => row.map((i) => ({ ...i, face: bookFace(i.book) }))) };


/** Una acción secundaria: un icono y una palabra. El nombre completo es para el lector de pantalla y empieza igual. */
function Tool({ icon, name, short, onClick }) {
  return (
    <button type="button" className="px-btn plab-tool" aria-label={name} onClick={onClick}>
      <img src={pixelIconSmallSrc(icon)} alt="" width={22} height={22} />
      <span>{short}</span>
    </button>
  );
}

function Interior({ piso, room, hora, reading, balda, covered, leaning, listing, yawMemory, hint, shelfBooks, onBook, onShelf, onOpenBook, onLost, onApi, onDesk, onDoor }) {
  const [picked, setPicked] = useState(null);
  const host = useRef(null);
  const api = useRef(null);
  const [ready, setReady] = useState(false);
  const [slots, setSlots] = useState(null);
  // Al volver de la ficha de un libro, la vista sigue en la balda sin rehacer el recorrido
  const firstZoom = useRef(balda !== null);
  // De cerca, tocar fuera de un libro suelta el elegido
  const choose = (book) => {
    setPicked(book);
    api.current?.selectBook(book?.id ?? null);
  };
  const handlers = useRef({});
  useEffect(() => {
    handlers.current = { onBook, onShelf, onLost, onDesk, onDoor, onShelfTap: () => choose(null) };
  });

  useEffect(() => {
    let gone = false;
    let view = null;
    beginMount();
    import('./interior3d')
      .then(({ mountInterior }) => {
        markCode();
        return mountInterior(host.current, { room, piso, ventanas: ventanasDe(piso, room), book: tableData(reading), shelfBooks: shelfScene(shelfBooks), hora, startYaw: yawMemory.current, onBook: () => handlers.current.onBook(), onShelf: (row) => handlers.current.onShelf(row), onShelfTap: () => handlers.current.onShelfTap(), onLost: () => handlers.current.onLost(), onDesk: () => handlers.current.onDesk?.(), onDoor: () => handlers.current.onDoor?.() });
      })
      .then((v) => {
        if (gone) return v?.destroy();
        view = v;
        api.current = v;
        onApi(v);
        markScene();
        setReady(true);
        markInteractive();
        return undefined;
      })
      .catch((error) => {
        console.error('Piloto: no se ha podido montar el interior', error);
        if (!gone) handlers.current.onLost();
      });
    return () => {
      gone = true;
      cancelMount();
      if (view) yawMemory.current = view.yaw();
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
    api.current?.setCovered(covered);
  }, [covered, ready]);

  // Lo que dejas sobre la mesa desde la ficha es el ejemplar que hay en la habitación, y la estantería se recoloca con él
  const key = sceneKey(reading, shelfBooks);
  const placed = useRef(key);
  useEffect(() => {
    if (!ready || placed.current === key) return;
    placed.current = key;
    api.current.setBooks({ book: tableData(reading), shelfBooks: shelfScene(shelfBooks) });
    if (balda !== null) {
      const next = fitSlots(api.current.bookSlots(balda));
      setSlots(next);
      // Si el elegido ya no está en esta balda, se suelta
      const still = picked && next.some((s) => s.id === picked.id) ? picked : null;
      setPicked(still);
      api.current.selectBook(still?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  // Al guardar o cancelar el registro, de vuelta al encuadre del que saliste
  useEffect(() => {
    if (ready && !leaning && balda === null) api.current?.leanToBook(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaning, ready]);

  // La indicación de las guías sigue al libro al girar, sin pasar por React
  const hintRef = useRef(null);
  useEffect(() => {
    const el = hintRef.current;
    if (!ready || !el) return undefined;
    const place = () => {
      const at = api.current?.bookAnchor();
      if (!at) return;
      el.hidden = !at.shown;
      // Sin salirse por los lados: el texto mide lo que mide
      const half = el.offsetWidth / 2 + 6;
      el.style.transform = `translate(${Math.round(Math.max(half, Math.min(at.width - half, at.x)))}px, ${Math.round(at.y)}px) translate(-50%, -100%)`;
    };
    place();
    api.current.onFrame(place);
    return () => api.current?.onFrame(null);
  }, [ready, hint]);

  useEffect(() => {
    if (!ready) return undefined;
    let stale = false;
    const instant = firstZoom.current;
    firstZoom.current = false;
    api.current.zoomShelf(balda, { instant }).then(() => {
      if (!stale) setSlots(balda !== null ? fitSlots(api.current?.bookSlots(balda) ?? []) : null);
    });
    return () => {
      stale = true;
      setSlots(null);
      setPicked(null);
      api.current?.selectBook(null);
    };
  }, [balda, ready]);

  return (
    <div ref={host} className="plab-stage" data-ready={ready || undefined} inert={listing}>
      {!ready && <p className="plab-loading">Entrando…</p>}
      {/* El acceso de verdad es el botón de abajo: esto solo lo señala */}
      {ready && hint && (
        <span ref={hintRef} className="plab-hint" aria-hidden="true" hidden>
          {hint}
        </span>
      )}
      {slots && shelfBooks && slots.map((slot) => {
        const book = slot.id === shelfBooks.cover.id ? shelfBooks.cover : shelfBooks.rows.flat().find((i) => i.id === slot.id).book;
        return <BookSpot key={slot.id} book={book} slot={slot} selected={picked?.id === book.id} onChoose={(b) => (picked?.id === b.id ? onOpenBook(b, balda) : choose(b))} />;
      })}
      {slots && picked && (
        <div className="plab-pick" role="status">
          <p className="plab-pick__text">
            <strong>{picked.title}</strong>
            {picked.author ? <span>{picked.author}</span> : null}
            {/* Qué es de su edición y qué no: la portada es la real; un lomo sin imagen propia es reconstruido */}
            <small className="plab-pick__note">{copyNote(picked)}</small>
          </p>
          <button type="button" className="px-btn plab-pick__open" onClick={() => onOpenBook(picked, balda)}>
            Abrir ficha
          </button>
        </div>
      )}
    </div>
  );
}

/** Los cuatro esenciales, en el decorador: se eligen desde aquí y se puede volver a la distribución de partida. */
function EssentialsBar({ room, onPick, onReset }) {
  const [asking, setAsking] = useState(false);
  const fixed = essentialItems(room);
  return (
    <div className="plab-essentials" role="group" aria-label="Elementos esenciales">
      <p>Esenciales: siempre están y con paso libre. Muévelos a tu gusto.</p>
      <div>
        {fixed.map((item) => (
          <button key={item.uid} type="button" onClick={() => onPick(item.uid)}>
            {essentialName(item)}
          </button>
        ))}
      </div>
      {asking ? (
        <p role="alert">
          Se quitará lo que has colocado y todo volverá a la distribución de partida.{' '}
          <button
            type="button"
            onClick={() => {
              setAsking(false);
              onReset();
            }}
          >
            Restablecer
          </button>{' '}
          <button type="button" onClick={() => setAsking(false)}>
            Cancelar
          </button>
        </p>
      ) : (
        <button type="button" className="link-btn" onClick={() => setAsking(true)}>
          Restablecer la habitación
        </button>
      )}
    </div>
  );
}

function PisoView({ piso, real = null, select, onSelect, onBack, onExit, onOpenBook, onRegister, onOpenLibrary, home = false, onEdificio, onAnterior }) {
  // Habitación de inicio: su puerta y «atrás» llevan al edificio del puerto, no al portal de prueba
  const leave = home && !select ? onEdificio : onBack;
  const { state, actions } = useLibrary();
  const { books, settings } = state;
  // `real`: tu piso del edificio (useMyPiso), tal como está guardado. Sin él, un piso del piloto (solo con ?piloto=piso)
  const [room, setRoom] = useState(() => (real ? real.room : loadRoom(piso)));
  const [news] = useState(() => (real ? NO_NEWS : repairNews(piso)));
  // En primera persona, con la puerta y el ordenador si caben (solo dibujados: no se guardan)
  const inner = useMemo(() => (real ? withDoorAndComputer(room) : room), [real, room]);
  const [saving, setSaving] = useState('');
  const [roomRev, setRoomRev] = useState(0);
  const isoView = useRef(null);
  const editable = canEdit(piso);
  // Un visitante nunca llega al editor, aunque el historial lo pida
  const listing = select === 'toda' && editable;
  const shelfView = /^(?:balda|ficha):(\d)/.exec(select ?? '');
  const balda = listing ? TOP_ROW : shelfView ? Number(shelfView[1]) : null;
  const view = select === 'decorar' && !editable ? 'actual' : shelfView || listing ? 'balda' : select;
  const iso = view === 'decorar' || view === 'actual';
  // Lo que se abre encima, con el interior montado debajo
  const overlay = select === 'registro' || /^(ficha:|ordenador|abrir:)/.test(select ?? '');
  // Se entra a la hora de la fachada, el atardecer; el botón deja ver las otras
  const [hora, setHora] = useState(FACADE_HORA);
  const [noGpu, setNoGpu] = useState(false);
  const apiRef = useRef(null);
  // El nombre del piso visitado, entero al tocarlo cuando no cabe
  const [fullTitle, setFullTitle] = useState(false);
  const reading = editable ? currentBook(books, settings) : null;
  const limit = useMemo(() => roomLimit(location.search), []);
  const shelfBooks = useMemo(() => (editable ? shelfRows(books, settings, limit) : null), [books, settings, editable, limit]);
  const [libraryMemory] = useState(emptyLibraryMemory);
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef(0);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);
  // Exponer solo cambia los ajustes: ni el estado de lectura ni la página del libro
  const exhibit = (book) => {
    const patch = toggleExhibit(settings, book.id, limit);
    if (patch) actions.setSettings(patch);
    clearTimeout(noticeTimer.current);
    setNotice(patch ? '' : `Ya hay ${limit - 1} elegidos: retira alguno para exponer otro`);
    if (!patch) noticeTimer.current = setTimeout(() => setNotice(''), 5000);
  };
  const faltan = useMemo(() => pendientes(room), [room]);
  useEffect(() => installPixelVars(), []);

  // Registrar: la cámara se inclina sobre el libro y se abre el registro de siempre. Un segundo toque no abre otro. Con el
  // teclado o el lector de pantalla no hay nada que ver ni esperar: se abre directamente
  const opening = useRef(false);
  const gone = useRef(false);
  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
    };
  }, []);
  const openLog = () => {
    if (opening.current) return;
    if (balda !== null || !apiRef.current) {
      onRegister();
      return;
    }
    opening.current = true;
    apiRef.current.leanToBook(true).then(() => {
      opening.current = false;
      if (!gone.current) onRegister();
    });
  };
  // Tocar el ordenador: la cámara se acerca y se abre su pantalla. El mismo seguro que el registro
  const openDesk = () => {
    if (opening.current) return;
    if (balda !== null || !apiRef.current) {
      onSelect('ordenador');
      return;
    }
    opening.current = true;
    apiRef.current.leanToDesk().then(() => {
      opening.current = false;
      if (!gone.current) onSelect('ordenador');
    });
  };
  // Hacia dónde mirabas: se conserva aunque Decorar desmonte la habitación
  const yawMemory = useRef(0);
  const hint = !editable || balda !== null || overlay || !settings.showGuides ? null : reading ? 'Toca para registrar' : 'Elige una lectura';

  // Guardado: como en el edificio, poco después de cada cambio y siempre al salir
  const pending = useRef(null);
  const timer = useRef(0);
  const flush = () => {
    clearTimeout(timer.current);
    const next = pending.current;
    pending.current = null;
    if (!next) return;
    if (!real) {
      saveRoom(piso, next);
      return;
    }
    // Tu piso real, con el servicio del edificio: el servidor solo deja escribir el tuyo y lo vuelve a validar
    saveMyPiso(real.userId, savable(next)).then(
      () => !gone.current && setSaving('Guardado.'),
      (e) => !gone.current && setSaving(`No se ha podido guardar: ${e.message}`),
    );
  };
  const onChange = (next) => {
    setRoom(next);
    if (real) {
      // El edificio lo ve ya así, aunque el guardado aún no haya salido
      rememberMyPiso(real.userId, { room: savable(next) });
      setSaving('Guardando…');
    }
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
      <div className="ed-bar plab-bar" inert={listing}>
        <button type="button" className="px-btn" onClick={leave}>
          <ArrowLeft aria-hidden="true" /> {view === 'decorar' || view === 'balda' ? (editable ? 'Volver al sillón' : 'Volver a la sala') : view === 'actual' ? 'Volver' : home ? 'Al edificio' : 'Al portal'}
        </button>
        {piso.propio ? (
          <h2 className="plab-title plab-title--quiet">{title}</h2>
        ) : (
          // De visita, el nombre puede no caber: un toque lo muestra entero (y otro lo recoge)
          <h2 className={fullTitle ? 'plab-title plab-title--full' : 'plab-title'} title={title}>
            <button type="button" className="plab-title__btn" aria-expanded={fullTitle} onClick={() => setFullTitle((v) => !v)}>
              {title}
            </button>
          </h2>
        )}
        {wantsMeter(location.search) && <LabMeter apiRef={apiRef} total={books.length} limit={limit} placed={shelfBooks?.placed.size ?? 0} />}
      </div>
      {iso ? (
        <>
          <VistaActual key={roomRev} piso={piso} room={room} editable={view === 'decorar'} evening={hora !== 'dia'} inventory={real?.inventory ?? null} onChange={onChange} onView={(v) => (isoView.current = v)} />
          {real && view === 'decorar' && (
            <p className="ed-saving plab-saving" role="status" aria-live="polite">
              {saving}
            </p>
          )}
          {!real && view === 'decorar' && (
            <EssentialsBar
              room={room}
              onPick={(uid) => isoView.current?.selectItem(uid)}
              onReset={() => {
                clearTimeout(timer.current);
                pending.current = null;
                setRoom(resetRoom(piso));
                setRoomRev((n) => n + 1);
              }}
            />
          )}
        </>
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
          {editable && (
            <button type="button" className="px-btn" onClick={() => onSelect('ordenador')}>
              Abrir el ordenador
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
            room={inner}
            hora={hora}
            reading={reading}
            balda={balda}
            covered={listing || overlay}
            leaning={select === 'registro' || /^(?:ordenador|abrir:)/.test(select ?? '')}
            yawMemory={yawMemory}
            listing={listing}
            hint={hint}
            shelfBooks={shelfBooks}
            onApi={(v) => (apiRef.current = v)}
            onBook={openLog}
            onShelf={(row) => onSelect(`balda:${row}`)}
            onOpenBook={onOpenBook}
            onDesk={editable ? openDesk : null}
            onDoor={home ? onEdificio : onBack}
            onLost={() => setNoGpu(true)}
          />
          <div className="plab-controls" inert={listing}>
            {(news.added.length > 0 || news.moved > 0 || news.stored > 0) && (
              <p className="plab-note plab-repair" role="status">
                {news.added.length > 0 && `Tu piso se ha completado: ${news.added.join(', ').toLowerCase()}. `}
                {news.moved > 0 && `${news.moved === 1 ? 'Un objeto ha cambiado' : `${news.moved} objetos han cambiado`} de sitio para dejar paso. `}
                {news.stored > 0 && `${news.stored === 1 ? 'Un objeto espera' : `${news.stored} objetos esperan`} a que haya sitio; no se ha borrado nada.`}
              </p>
            )}
            {reading ? (
              <button type="button" className="px-btn px-btn--sage plab-primary" aria-label={`Registrar lectura de ${reading.title}`} onClick={(e) => (e.detail ? openLog() : onRegister())}>
                <span>Registrar lectura</span>
                <small>{reading.title}</small>
              </button>
            ) : editable ? (
              <button type="button" className="px-btn px-btn--sage plab-primary" onClick={() => (shelfBooks ? onSelect(`balda:${TOP_ROW}`) : onOpenLibrary())}>
                <span>Elegir una lectura</span>
                <small>{shelfBooks ? 'En tu estantería' : 'En Mi biblioteca'}</small>
              </button>
            ) : null}
            <div className="plab-tools" role="group" aria-label="Más acciones">
              {/* 1.88.2: sin estantería en el piso no hay balda que mirar; el mismo botón lleva a la biblioteca entera (no se añade ningún mueble) */}
              {view !== 'balda' && (room.items.some((i) => i.id === 'estanteria') || !editable ? <Tool icon="balda" name="Ver la balda" short="Balda" onClick={() => onSelect(`balda:${TOP_ROW}`)} /> : <Tool icon="balda" name="Toda la biblioteca (tu piso no tiene estantería)" short="Biblioteca" onClick={() => onSelect('toda')} />)}
              {view === 'balda' && editable && shelfBooks && <Tool icon="lupa" name={`Buscar en toda la biblioteca, ${books.length} libros`} short="Buscar" onClick={() => onSelect('toda')} />}
              {editable && <Tool icon="decorar" name="Decorar" short="Decorar" onClick={() => onSelect('decorar')} />}
              <PisoMenu
                off={overlay}
                items={[
                  ...(editable
                    ? [
                        { name: 'Toda la biblioteca', run: () => onSelect('toda') },
                        ...(reading ? [{ name: `Registrar lectura de ${reading.title}`, run: () => onRegister() }] : []),
                        { name: 'Calendario', run: () => onSelect('ordenador:calendar:calendar') },
                        { name: 'Mi diario', run: () => onSelect('ordenador:calendar:today') },
                        { name: 'Ordenador', run: () => onSelect('ordenador') },
                      ]
                    : []),
                  { name: SIGUE[hora].label, run: () => setHora(SIGUE[hora].hora) },
                  home ? { name: 'Ir al edificio', run: onEdificio } : { name: 'Salir al portal', run: () => (select ? onExit() : onBack()) },
                  ...(home && onAnterior ? [{ name: 'Volver a la experiencia anterior', run: onAnterior }] : []),
                ]}
              />
            </div>
            {!editable && <p className="plab-note">Puedes mirar y salir por la puerta; lo demás no se toca.</p>}
            {/* Biblioteca de demostración en este navegador: se dice, y se puede volver a la tuya (la nube está apagada mientras tanto) */}
            {editable && demoLibraryActive() && (
              <p className="plab-note">
                Biblioteca de demostración en este navegador.{' '}
                <a className="link-btn" href="/?piloto=piso&biblioteca=propia">
                  Volver a la tuya
                </a>
              </p>
            )}
            {faltan.length > 0 && (
              <p className="plab-note">
                Aún sin esta vista: {faltan.join(', ')}.{' '}
                <button type="button" className="link-btn" onClick={() => onSelect(editable ? 'decorar' : 'actual')}>
                  Verlos en la vista de siempre
                </button>
              </p>
            )}
          </div>
          {listing && <PisoLibrary books={books} settings={settings} placed={shelfBooks?.placed ?? new Set()} memory={libraryMemory} notice={notice} onBack={onBack} onOpen={(book) => onOpenBook(book, TOP_ROW)} onToggle={exhibit} />}
        </>
      )}
    </div>
  );
}

/**
 * La habitación de inicio: tu piso del edificio (1.88). Hasta que se sabe quién eres y llega tu piso, solo un aviso; sin
 * cuenta o sin la comunidad, lo que falta y los caminos de siempre. Nunca un piso de prueba.
 */
function HomePiso({ onOpenLibrary, onEdificio, onAnterior, onOpenAccount, onOpenProfile, ...rest }) {
  const mine = useMyPiso();
  useEffect(() => installPixelVars(), []);
  if (mine.state === 'ready') return <PisoView key={mine.piso.id} piso={mine.piso} real={{ userId: mine.userId, room: mine.room, inventory: mine.inventory }} onOpenLibrary={onOpenLibrary} onEdificio={onEdificio} onAnterior={onAnterior} {...rest} />;
  const text = {
    loading: 'Abriendo tu piso…',
    'signed-out': 'Tu habitación es tu piso del edificio del puerto: inicia sesión en «Tu cuenta» para entrar.',
    'no-member': 'Tu habitación es tu piso del edificio del puerto, que es para quien tiene la comunidad activada: tus vecinos verán tu piso y tu alias.',
    unavailable: mine.error || 'Tu piso no está disponible ahora mismo.',
    error: mine.error || 'No se ha podido abrir tu piso.',
  }[mine.state];
  return (
    <div className="ed-room ed-inside plab-room plab-home" data-estado={mine.state}>
      <div className="ed-bar plab-bar">
        <button type="button" className="px-btn" onClick={onEdificio}>
          <ArrowLeft aria-hidden="true" /> Al edificio
        </button>
        <h2 className="plab-title plab-title--quiet">Tu piso</h2>
      </div>
      <div className="plab-fallback plab-gate" role={mine.state === 'loading' ? 'status' : 'alert'}>
        <p>{text}</p>
        {mine.state === 'signed-out' && onOpenAccount && (
          <button type="button" className="px-btn px-btn--sage" onClick={onOpenAccount}>
            Abrir «Tu cuenta»
          </button>
        )}
        {mine.state === 'no-member' && onOpenProfile && (
          <button type="button" className="px-btn px-btn--sage" onClick={onOpenProfile}>
            Activar la comunidad en mi perfil
          </button>
        )}
        {mine.state === 'error' && (
          <button type="button" className="px-btn" onClick={mine.retry}>
            Reintentar
          </button>
        )}
        {mine.state !== 'loading' && (
          <>
            <button type="button" className="px-btn" onClick={onOpenLibrary}>
              Abrir Mi biblioteca
            </button>
            {onAnterior && (
              <button type="button" className="px-btn" onClick={onAnterior}>
                Volver a la experiencia anterior
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function PisoLabPanel({ pisoId, select, onOpen, onSelect, onBack, onClose, onExit, onOpenBook, onRegister, onOpenLibrary, home = false, onEdificio, onAnterior, onOpenAccount, onOpenProfile }) {
  const isHome = pisoId === HOME_PISO;
  const piso = isHome ? null : pisoById(pisoId);
  const { state } = useLibrary();
  // Lo que hace falta al otro lado de la puerta empieza a llegar al tocarla
  const prepare = (door, repeat) => {
    markPress({ repeat });
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
    // Con el registro encima, Escape es suyo; en la habitación de inicio, Escape no la cierra (es la pantalla de inicio)
    <PanelShell onClose={select === 'registro' || /^(ficha:|ordenador|abrir:)/.test(select ?? '') || (home && !select) ? () => {} : select === 'toda' ? onBack : onClose} label={piso || isHome ? 'Interior del piso' : 'El edificio del puerto · piloto'} variant="edificio">
      {isHome ? (
        <HomePiso select={select} onSelect={onSelect} onBack={onBack} onExit={onExit} onOpenBook={onOpenBook} onRegister={onRegister} onOpenLibrary={onOpenLibrary} home={home} onEdificio={onEdificio} onAnterior={onAnterior} onOpenAccount={onOpenAccount} onOpenProfile={onOpenProfile} />
      ) : piso ? (
        <PisoView key={piso.id} piso={piso} select={select} onSelect={onSelect} onBack={onBack} onExit={onExit} onOpenBook={onOpenBook} onRegister={onRegister} onOpenLibrary={onOpenLibrary} home={home} onEdificio={onEdificio} onAnterior={onAnterior} />
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
