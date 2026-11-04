// «El Gran Hotel del Puerto» en la app (1.74, SPEC §74; bloque 1 de docs/qa/gran-hotel.md). Se llega en la limusina
// negra que espera delante del portal del edificio: el viaje por la calle del puerto de noche (ride.js; se salta
// tocándolo; sin él, con movimiento reducido) y la fachada viva del hotel, a todo lo que da la pantalla, que se toca
// planta a planta (Francisco: «el gran hotel tiene demasiados menús y se empequeñece»: sin fila de botones; para el
// teclado, cada planta tiene un botón invisible sobre el dibujo que se ve al enfocarlo). Aún no se entra en ninguna
// sala salvo el vestíbulo (1.75, Vestibulo.jsx), y el casino del
// sótano (1.80, Casino.jsx): tocarlas es
// entrar; las demás plantas dicen qué habrá y «Abre pronto».
// 1.77 (maqueta de Francisco): el hotel entero cabe en la pantalla, de la aguja a la limusina, por encima de una cartela
// crema al pie que dice qué es la planta elegida («Café-biblioteca», «Próxima apertura» y su lema); la planta elegida
// lleva un filete de latón con un rombo a su izquierda (hotelView.js). «Directorio», en la barra, abre la lista de las
// plantas con su estado: elegir una ahí es lo mismo que tocarla en la fachada.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FLOOR_ORDER, mountHotel, ZONES } from './hotelView';
import { Casino } from './Casino';
import { mountRide } from './ride';
import { Vestibulo } from './Vestibulo';
import { SalaLectura } from './SalaLectura';
import './hotel.css';

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** El viaje: la limusina por la calle del puerto de noche, con la cámara detrás. Tocar llega ya. */
function LimoRide({ onDone }) {
  const host = useRef(null);
  const done = useRef(onDone);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    let t = 0;
    const ride = mountRide(host.current, {
      onArrive: () => {
        setLeaving(true);
        t = setTimeout(() => done.current(), 350);
      },
    });
    return () => {
      clearTimeout(t);
      ride.destroy();
    };
  }, []);
  return (
    <button type="button" className={leaving ? 'gh-ride is-leaving' : 'gh-ride'} onClick={() => done.current()} aria-label="En limusina hacia el Gran Hotel. Toca para llegar ya.">
      <span className="gh-ride__view" ref={host} aria-hidden="true" />
      <span className="gh-ride__note" aria-hidden="true">
        Camino del Gran Hotel…
      </span>
    </button>
  );
}

/** El Directorio: las plantas reales de arriba abajo, con su estado. Elegir una es lo mismo que tocarla en la fachada. */
function Directory({ zone, onPick, onClose }) {
  const first = useRef(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <section className="gh-dir" role="dialog" aria-modal="false" aria-labelledby="gh-dir-title" data-escape-local="open">
      <h3 id="gh-dir-title">Directorio</h3>
      <ul>
        {FLOOR_ORDER.map((id, k) => (
          <li key={id}>
            <button type="button" ref={k === 0 ? first : null} className="gh-dir__floor" aria-current={zone === id ? 'true' : undefined} onClick={() => onPick(id)}>
              <span className="gh-dir__name">{ZONES[id].corto}</span>
              <span className={ZONES[id].abierta ? 'gh-dir__state is-open' : 'gh-dir__state'}>{ZONES[id].abierta ? 'Abierto · entrar' : 'Próxima apertura'}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="gh-dir__close" onClick={onClose}>
        Cerrar
      </button>
    </section>
  );
}

/** La fachada viva del hotel; la planta elegida se dice en la cartela del pie. */
function HotelFacade({ onEnter, directory, onDirectory }) {
  const box = useRef(null);
  const host = useRef(null);
  const foot = useRef(null);
  const view = useRef(null);
  const [zones, setZones] = useState([]);
  const [zone, setZone] = useState(null);
  const enter = useRef(onEnter);
  useEffect(() => {
    enter.current = onEnter;
  }, [onEnter]);
  // Una planta abierta (el vestíbulo) se entra; las demás se señalan y se dicen en la cartela
  const choose = useRef((id) => {
    if (id && ZONES[id].abierta) return enter.current(id);
    view.current?.select(id);
    setZone(id);
  });
  useEffect(() => {
    const v = mountHotel(host.current, { still: reducedMotion(), t0: 3, onPick: (id) => choose.current(id) });
    view.current = v;
    host.current.style.setProperty('--gh-ratio', String(v.canvas.width / v.canvas.height));
    box.current.style.setProperty('--gh-entry', String(v.entry));
    setZones(v.zones);
    if (import.meta.env.DEV) window.__granHotel = v;
    return () => v.destroy();
  }, []);
  // El alto que hay (de la barra al pie de la pantalla) y el de la cartela: el hotel cabe entre los dos
  useLayoutEffect(() => {
    const fit = () => {
      const el = box.current;
      if (!el) return;
      el.style.setProperty('--gh-h', `${Math.max(320, window.innerHeight - el.getBoundingClientRect().top)}px`);
      el.style.setProperty('--gh-foot', `${foot.current?.offsetHeight ?? 0}px`);
    };
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    if (foot.current) ro?.observe(foot.current);
    window.addEventListener('resize', fit);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);
  const pick = (id) => choose.current(id);
  useEffect(() => {
    if (!zone) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape' || directory) return;
      view.current?.select(null);
      setZone(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [zone, directory]);
  const closeDirectory = () => {
    onDirectory(false);
    document.querySelector('.ed-bar__dir')?.focus();
  };
  const info = zone ? ZONES[zone] : null;
  return (
    <div className="gh" ref={box}>
      <div className="gh-art" ref={host}>
        <ul className="gh-zones" aria-label="Plantas del hotel">
          {zones.map((z) => (
            <li key={z.id}>
              <button
                type="button"
                className="gh-zone"
                style={{ left: `${z.center.x * 100}%`, top: `${z.center.y * 100}%` }}
                aria-pressed={zone === z.id}
                onClick={() => pick(zone === z.id ? null : z.id)}
              >
                {ZONES[z.id].nombre}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {/* La cartela del pie: con una planta elegida, Escape la deja sin elegir y no cierra el hotel (PanelShell lo respeta) */}
      {/* 1.79 (encargo de Francisco): sin planta elegida, la cartela es pequeña y deja ver el hotel; el resto lo dice el Directorio */}
      <section className={info ? 'gh-plaque' : 'gh-plaque gh-plaque--small'} ref={foot} aria-live="polite" aria-label={info ? info.nombre : 'El Gran Hotel del Puerto'} data-escape-local={zone ? 'open' : undefined}>
        <h3>{info ? info.corto : 'Gran Hotel del Puerto'}</h3>
        <p className="gh-plaque__state">
          <i aria-hidden="true" />
          {info ? (info.abierta ? 'Abierto' : 'Próxima apertura') : 'Toca una planta'}
          <i aria-hidden="true" />
        </p>
        <p className={info ? 'gh-plaque__text' : 'px-sr'}>{info ? info.lema : 'O abre el Directorio para ver qué hay en cada una.'}</p>
      </section>
      {directory && (
        <Directory
          zone={zone}
          onClose={closeDirectory}
          onPick={(id) => {
            onDirectory(false);
            pick(id);
          }}
        />
      )}
    </div>
  );
}

/**
 * `room`: la sala en la que estás (null, la fachada); `onRoom(sala)` entra en ella o sale a la calle. `directory`:
 * el Directorio abierto (lo abre la barra del panel); `onDirectory(abierto)`. `soundOn`: el sonido de la app (el casino lo usa).
 * `timer`, `askPages`, `onPagesDone` y `onOpenCalendar`: el temporizador de la app, para la sala de lectura.
 */
export function GranHotel({ room = null, onRoom = () => {}, directory = false, onDirectory = () => {}, soundOn = false, timer = null, askPages = false, onPagesDone, onOpenCalendar }) {
  // Si se llega ya a una sala (el aviso de la mesa para dos), sin el viaje
  const [riding, setRiding] = useState(() => !reducedMotion() && !room);
  // Abrir el Directorio durante el viaje es llegar ya
  if (directory && riding) setRiding(false);
  return (
    <div className="gh-wrap">
      <h2 className="px-sr" id="ed-title">
        El Gran Hotel del Puerto
      </h2>
      {riding ? (
        <LimoRide onDone={() => setRiding(false)} />
      ) : room === 'vestibulo' ? (
        <Vestibulo onStreet={() => onRoom(null)} onFloor={onRoom} />
      ) : room === 'casino' ? (
        <Casino onStreet={() => onRoom(null)} soundOn={soundOn} />
      ) : room === 'cafe' && timer ? (
        <SalaLectura onStreet={() => onRoom(null)} timer={timer} askPages={askPages} onPagesDone={onPagesDone} onOpenCalendar={onOpenCalendar} />
      ) : (
        <HotelFacade onEnter={onRoom} directory={directory} onDirectory={onDirectory} />
      )}
    </div>
  );
}
