// El escritorio del ordenador en el piso (Puerto Pixel, ajuste v3): seis objetos, la lectura en curso y la barra de tareas. El resto de funciones del
// inventario (docs/qa/piso-funciones.md) está en el cajón «Aplicaciones». Las pantallas son las de siempre: aquí solo se elige cuál abrir.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { currentBook, formatPercent, percentRead, progressLabel, trackUnit } from '../../domain/books';
import { dailyQuoteReady } from '../../components/panels/DailyQuote';
import { Cover } from '../../components/shelf/BookItem';
import { useLibrary } from '../../state/useLibrary';
import { PixelIcon } from '../../ui/PixelIcon';
import { PortIcon } from '../../ui/PortIcon';

const MAIN = (open, go) => [
  { name: 'Calendario', icon: 'calendario', run: () => open('calendar', 'calendar') },
  { name: 'Mi diario', icon: 'diario', run: () => open('calendar', 'today') },
  { name: 'Estadísticas', icon: 'estadisticas', run: () => open('stats') },
  { name: 'Biblioteca', icon: 'biblioteca', run: () => go.library() },
  { name: 'Sesiones', icon: 'sesiones', run: () => open('sessions') },
  { name: 'Comunidad', icon: 'comunidad', run: () => go.community() },
];

const GROUPS = (open, tool) => [
  {
    title: 'Mi lectura',
    items: [
      { name: 'Notas', icon: 'cuaderno', run: () => open('calendar', 'notes') },
      { name: 'Temporizador', icon: 'reloj', run: () => tool('tray') },
    ],
  },
  {
    title: 'Mi progreso',
    items: [
      { name: 'Reto anual', icon: 'grafico', run: () => open('goal') },
      { name: 'Misiones', icon: 'check', run: () => open('missions') },
      { name: 'Citas', icon: 'cuaderno', run: () => open('quote'), badge: 'quote' },
    ],
  },
  {
    title: 'Mis libros',
    items: [
      { name: 'Añadir un libro', icon: 'libro', run: () => tool('add') },
      { name: 'Importar biblioteca', icon: 'estanteria', run: () => tool('import') },
      { name: 'Pedir recomendación', icon: 'busqueda', run: () => tool('librarian') },
      { name: 'Mapa de sagas', icon: 'estanteria', run: () => tool('atlas') },
    ],
  },
  {
    title: 'Radio y cuenta',
    items: [
      { name: 'Radio', icon: 'nota', run: () => tool('radio') },
      { name: 'Cuenta y copias', icon: 'ajustes', run: () => tool('account') },
    ],
  },
];

// Al abrir una función esta pantalla se desmonta: se recuerda por dónde ibas hasta volver. Si se sale del ordenador, se olvida
const START = { desk: 0, apps: 0, drawer: false, name: null, leaving: false, mounted: false };
const place = { ...START };

export function PisoDesktop({ open, tool, go }) {
  const { state } = useLibrary();
  const deskRef = useRef(null);
  const appsRef = useRef(null);
  const appsButton = useRef(null);
  const backButton = useRef(null);
  const [drawer, setDrawer] = useState(place.drawer);
  const book = currentBook(state.books, state.settings);
  const reading = book?.status === 'reading' ? book : null;

  useLayoutEffect(() => {
    deskRef.current.scrollTop = place.desk;
    appsRef.current.scrollTop = place.apps;
    if (place.name) deskRef.current.parentElement.querySelector(`button[data-name="${place.name}"]`)?.focus({ preventScroll: true });
    place.mounted = true;
    place.leaving = false;
    return () => {
      place.mounted = false;
      // En el turno siguiente: un remontaje inmediato (StrictMode) no es salir
      setTimeout(() => {
        if (!place.mounted && !place.leaving) Object.assign(place, START);
      }, 0);
    };
  }, []);

  const closeDrawer = () => {
    setDrawer(false);
    place.drawer = false;
    place.apps = 0;
    appsButton.current?.focus({ preventScroll: true });
  };
  const openDrawer = () => {
    setDrawer(true);
    place.drawer = true;
  };
  useLayoutEffect(() => {
    if (drawer && !place.name) backButton.current?.focus({ preventScroll: true });
  }, [drawer]);
  // Escape cierra primero el cajón, no el ordenador
  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.target.closest?.('[inert]')) return;
      e.stopPropagation();
      setDrawer(false);
      place.drawer = false;
      place.apps = 0;
      appsButton.current?.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [drawer]);

  const choose = (item) => {
    place.desk = deskRef.current.scrollTop;
    place.apps = appsRef.current.scrollTop;
    place.name = item.name;
    place.leaving = true;
    item.run();
  };
  const pages = reading && trackUnit(reading) === 'pages' && reading.pageCount ? `${reading.currentPage || 0} / ${reading.pageCount}` : reading && progressLabel(reading);

  return (
    <div className="plab-desktop">
      <div ref={deskRef} className="pp-desk" hidden={drawer}>
        <div className="pp-desk__in">
          <section aria-label="Lo principal">
            <ul className="pp-desk__main">
              {MAIN(open, go).map((item) => (
                <li key={item.name}>
                  <button type="button" data-name={item.name} onClick={() => choose(item)}>
                    <PixelIcon name={item.icon} size={80} />
                    <strong>{item.name}</strong>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          {reading && (
            <section className="pp-reading" aria-label="Lectura actual">
              <h3>Leyendo ahora</h3>
              <div className="pp-reading__body">
                <span className="pp-reading__cover">
                  <Cover key={reading.id} book={reading} steady />
                </span>
                <div className="pp-reading__text">
                  <b>{reading.title}</b>
                  <small>{pages}</small>
                  <span className="pp-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(percentRead(reading))} aria-label={`Progreso: ${formatPercent(percentRead(reading))}`}>
                    <i style={{ width: `${percentRead(reading)}%` }} />
                  </span>
                  <button type="button" className="pp-btn pp-btn--primary" data-name="Registrar" aria-label={`Registrar lectura de ${reading.title}`} onClick={() => choose({ name: 'Registrar', run: () => go.register() })}>
                    Registrar
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
      <div ref={appsRef} className="pp-apps" hidden={!drawer} data-escape-local={drawer ? 'open' : undefined}>
        <div className="pp-apps__head">
          <h3>Aplicaciones</h3>
          <button ref={backButton} type="button" className="pp-os-btn pp-os-btn--text" onClick={closeDrawer}>
            <PortIcon name="flecha" back />
            Volver al escritorio
          </button>
        </div>
        {GROUPS(open, tool).map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h4>{group.title}</h4>
            <ul className="port-rows">
              {group.items.map((item) => (
                <li key={item.name}>
                  <button type="button" data-name={item.name} onClick={() => choose(item)}>
                    <PortIcon name={item.icon} />
                    <span>{item.name}</span>
                    {item.badge === 'quote' && dailyQuoteReady(state) && <small>Sobre por abrir</small>}
                    <PortIcon name="flecha" className="port-rows__go" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <footer className="pp-taskbar">
        <button ref={appsButton} type="button" className="pp-taskbar__apps" aria-expanded={drawer} onClick={() => (drawer ? closeDrawer() : openDrawer())}>
          <PortIcon name="aplicaciones" />
          Aplicaciones
        </button>
        <button type="button" className="pp-taskbar__sound" data-name="Sonido" onClick={() => choose({ name: 'Sonido', run: () => tool('sonido') })}>
          <PortIcon name="altavoz" />
          <span className="pp-sr">Sonido</span>
        </button>
      </footer>
    </div>
  );
}
