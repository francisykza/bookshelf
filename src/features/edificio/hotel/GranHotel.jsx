// «El Gran Hotel del Puerto» en la app (1.74, SPEC §74; bloque 1 de docs/qa/gran-hotel.md). Se llega en la limusina
// negra que espera delante del portal del edificio: el viaje por la calle del puerto de noche (ride.js; se salta
// tocándolo; sin él, con movimiento reducido) y la fachada viva del hotel, a todo lo que da la pantalla, que se toca
// planta a planta (Francisco: «el gran hotel tiene demasiados menús y se empequeñece»: sin fila de botones; para el
// teclado, cada planta tiene un botón invisible sobre el dibujo que se ve al enfocarlo). Aún no se entra en ninguna
// sala salvo el vestíbulo (1.75, Vestibulo.jsx): tocarlo es entrar; las demás plantas dicen qué habrá y «Abre pronto».
import { useEffect, useRef, useState } from 'react';
import { mountHotel, ZONES } from './hotelView';
import { mountRide } from './ride';
import { Vestibulo } from './Vestibulo';
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

/** La fachada viva del hotel; al tocar una planta, una nota pequeña arriba dice qué habrá. */
function HotelFacade({ onEnter }) {
  const host = useRef(null);
  const view = useRef(null);
  const [zones, setZones] = useState([]);
  const [zone, setZone] = useState(null);
  const enter = useRef(onEnter);
  useEffect(() => {
    enter.current = onEnter;
  }, [onEnter]);
  useEffect(() => {
    const v = mountHotel(host.current, { still: reducedMotion(), t0: 3, onPick: (id) => (id === 'vestibulo' ? enter.current(id) : setZone(id)) });
    view.current = v;
    // Que quepa entero de alto (sin pasar de la pantalla) y, si no, de borde a borde
    host.current.style.setProperty('--gh-ratio', String(v.canvas.width / v.canvas.height));
    setZones(v.zones);
    if (import.meta.env.DEV) window.__granHotel = v;
    return () => v.destroy();
  }, []);
  const pick = (id) => {
    if (id === 'vestibulo') return onEnter(id);
    view.current?.select(id);
    setZone(id);
  };
  useEffect(() => {
    if (!zone) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      view.current?.select(null);
      setZone(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [zone]);
  return (
    <div className="gh">
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
        {zone && (
          // Con la nota abierta, Escape la cierra a ella y no al panel (PanelShell lo respeta)
          <section className="gh-card" aria-live="polite" aria-label={ZONES[zone].nombre} data-escape-local="open">
            <h3>{ZONES[zone].nombre}</h3>
            <p>{ZONES[zone].texto}</p>
            <span className="gh-card__soon">Abre pronto</span>
            <button type="button" className="gh-card__close" onClick={() => pick(null)} aria-label="Cerrar">
              ×
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

/** `room`: la sala en la que estás (null, la fachada); `onRoom(sala)` entra en ella o sale a la calle. */
export function GranHotel({ room = null, onRoom = () => {} }) {
  const [riding, setRiding] = useState(() => !reducedMotion());
  return (
    <div className="gh-wrap">
      <h2 className="px-sr" id="ed-title">
        El Gran Hotel del Puerto
      </h2>
      {riding ? <LimoRide onDone={() => setRiding(false)} /> : room === 'vestibulo' ? <Vestibulo onStreet={() => onRoom(null)} /> : <HotelFacade onEnter={onRoom} />}
    </div>
  );
}
