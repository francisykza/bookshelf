// Piloto «Del portal al sillón» (solo en el laboratorio, se abre con /?piloto=piso): el portal de siempre, el interior
// del piso en primera persona y el editor isométrico de siempre sobre el mismo layout. Cada vista es un paso del
// historial (`panel.id`: piso; `panel.select`: 'decorar', 'actual', 'registro', 'balda:N', 'toda', 'ficha:N:libro', 'ordenador…' o 'abrir:herramienta'), así que Atrás
// funciona. La ficha y el registro se abren encima con el interior montado: al cerrarlos sigues con el mismo encuadre.
import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanelShell } from '../../components/panels/PanelShell';
import { EDITIONS, currentBook, spineColor, visualEdition } from '../../domain/books';
import { LAYOUTS, essentialName } from './essentials';
import { bookThicknessCm, inkFor } from '../../domain/roomShelf';
import { useLibrary } from '../../state/useLibrary';
import { FACADE_HORA } from '../edificio/facade';
import { mountFacade } from '../edificio/facadeView';
import { mountPiso } from '../edificio/piso';
import { installPixelVars, pixelIconSmallSrc } from '../edificio/pixelUi';
import { preloadCover } from './coverPreload';
import { LabMeter, markPress, markReady, wantsMeter } from './LabMeter';
import './pisoLab.css';
import { PisoLibrary, emptyLibraryMemory } from './PisoLibrary';
import { roomLimit, toggleExhibit } from './roomSelection';
import { TOP_ROW, fitSlots, shelfRows } from './shelfLayout';
import { canEdit, doorLabel, loadRoom, pendientes, pisoById, portalFlats, repairNews, resetRoom, saveRoom, ventanasDe } from './labStore';
import { PisoMenu } from './PisoMenu';

const SAVE_MS = 400;
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
function VistaActual({ piso, room, editable, evening, onChange, onView }) {
  const ref = useRef(null);
  useEffect(() => {
    const view = mountPiso(ref.current, { room, editable, decorate: editable, inside: true, evening, label: `Piso ${doorLabel(piso)}`, onChange });
    if (import.meta.env.DEV) window.__edificioPiso = view;
    onView?.(view);
    return () => {
      onView?.(null);
      view.destroy();
    };
    // Se monta una vez: los cambios los lleva él y avisa con onChange
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

const shelfData = (book) => ({ id: book.id, title: book.title, color: spineColor(book), ink: inkFor(spineColor(book)), edition: visualEdition(book), thickness: bookThicknessCm(book) * 0.06, height: EDITIONS[visualEdition(book)].height });
const tableData = (book) => book && { ...shelfData(book), coverLoad: preloadCover(book.cover) };
const shelfScene = (shelfBooks) => shelfBooks && { cover: tableData(shelfBooks.cover), rows: shelfBooks.rows };
/** Cambia si hay que recolocar algo en la habitación; registrar una página, no. */
const sceneKey = (reading, shelfBooks) => [reading?.id, shelfBooks?.cover.id, ...(shelfBooks?.rows.map((row) => row.map((i) => i.id).join()) ?? [])].join('|');

/** Una acción secundaria: un icono y una palabra. El nombre completo es para el lector de pantalla y empieza igual. */
function Tool({ icon, name, short, onClick }) {
  return (
    <button type="button" className="px-btn plab-tool" aria-label={name} onClick={onClick}>
      <img src={pixelIconSmallSrc(icon)} alt="" width={22} height={22} />
      <span>{short}</span>
    </button>
  );
}

function Interior({ piso, room, hora, reading, balda, covered, logging, listing, hint, shelfBooks, onBook, onShelf, onOpenBook, onLost, onApi, onDesk, onDoor }) {
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
    import('./interior3d')
      .then(({ mountInterior }) =>
        mountInterior(host.current, { room, piso, ventanas: ventanasDe(piso, room), book: tableData(reading), shelfBooks: shelfScene(shelfBooks), hora, onBook: () => handlers.current.onBook(), onShelf: (row) => handlers.current.onShelf(row), onShelfTap: () => handlers.current.onShelfTap(), onLost: () => handlers.current.onLost(), onDesk: () => handlers.current.onDesk?.(), onDoor: () => handlers.current.onDoor?.() }),
      )
      .then((v) => {
        if (gone) return v?.destroy();
        view = v;
        api.current = v;
        onApi(v);
        markReady();
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
    if (ready && !logging && balda === null) api.current?.leanToBook(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logging, ready]);

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
function EssentialsBar({ piso, room, onPick, onReset }) {
  const [asking, setAsking] = useState(false);
  const fixed = room.items.filter((i) => room.guard?.locked(i));
  return (
    <div className="plab-essentials" role="group" aria-label="Elementos esenciales">
      <p>Esenciales: fijos y con paso libre. Puedes cambiarles el color.</p>
      <div>
        {fixed.map((item) => (
          <button key={item.uid} type="button" onClick={() => onPick(item.uid)}>
            {essentialName(LAYOUTS[piso.id], item)}
          </button>
        ))}
      </div>
      {asking ? (
        <p role="alert">
          Se quitará lo que has colocado y volverá la distribución de partida.{' '}
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

function PisoView({ piso, select, onSelect, onBack, onExit, onOpenBook, onRegister, onOpenLibrary }) {
  const { state, actions } = useLibrary();
  const { books, settings } = state;
  const [room, setRoom] = useState(() => loadRoom(piso));
  const [news] = useState(() => repairNews(piso));
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
  const hint = !editable || balda !== null || overlay || !settings.showGuides ? null : reading ? 'Toca para registrar' : 'Elige una lectura';

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
      <div className="ed-bar plab-bar" inert={listing}>
        <button type="button" className="px-btn" onClick={onBack}>
          <ArrowLeft aria-hidden="true" /> {view === 'decorar' || view === 'balda' ? 'Volver al sillón' : view === 'actual' ? 'Volver' : 'Al portal'}
        </button>
        <h2 className="plab-title">{title}</h2>
        {wantsMeter(location.search) && <LabMeter apiRef={apiRef} total={books.length} limit={limit} placed={shelfBooks?.placed.size ?? 0} />}
      </div>
      {iso ? (
        <>
          <VistaActual key={roomRev} piso={piso} room={room} editable={view === 'decorar'} evening={hora !== 'dia'} onChange={onChange} onView={(v) => (isoView.current = v)} />
          {view === 'decorar' && (
            <EssentialsBar
              piso={piso}
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
            room={room}
            hora={hora}
            reading={reading}
            balda={balda}
            covered={listing || overlay}
            logging={select === 'registro'}
            listing={listing}
            hint={hint}
            shelfBooks={shelfBooks}
            onApi={(v) => (apiRef.current = v)}
            onBook={openLog}
            onShelf={(row) => onSelect(`balda:${row}`)}
            onOpenBook={onOpenBook}
            onDesk={editable ? () => onSelect('ordenador') : null}
            onDoor={onBack}
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
              {view !== 'balda' && <Tool icon="balda" name="Ver la balda" short="Balda" onClick={() => onSelect(`balda:${TOP_ROW}`)} />}
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
                  { name: 'Salir al portal', run: () => (select ? onExit() : onBack()) },
                ]}
              />
            </div>
            {!editable && <p className="plab-note">Puedes mirar y salir por la puerta; lo demás no se toca.</p>}
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

export function PisoLabPanel({ pisoId, select, onOpen, onSelect, onBack, onClose, onExit, onOpenBook, onRegister, onOpenLibrary }) {
  const piso = pisoById(pisoId);
  const { state } = useLibrary();
  // Lo que hace falta al otro lado de la puerta empieza a llegar al tocarla
  const prepare = (door) => {
    markPress();
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
    <PanelShell onClose={select === 'registro' || /^(ficha:|ordenador|abrir:)/.test(select ?? '') ? () => {} : select === 'toda' ? onBack : onClose} label={piso ? 'Interior del piso' : 'El edificio del puerto · piloto'} variant="edificio">
      {piso ? (
        <PisoView key={piso.id} piso={piso} select={select} onSelect={onSelect} onBack={onBack} onExit={onExit} onOpenBook={onOpenBook} onRegister={onRegister} onOpenLibrary={onOpenLibrary} />
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
