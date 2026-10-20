// Objetos interactivos de la ilustración (SPEC §3.2, 1.8.0): hotspots diegéticos vivos. Sin botones
// pintados encima: al pasar el ratón o tocar, el propio objeto se aviva con un halo dorado que sigue su
// silueta y crece un 5 %. Las insignias con icono solo aparecen con «✨ Mostrar guías».
import { BookOpen, CupSoda, Flame, Headphones, Lamp, Laptop, Library, Trophy, Wind } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { bounds, clipPolygon } from '../../scene/homography';
import { HOTSPOTS, SCENE_H, SCENE_SRC, SCENE_W, SILHOUETTES, SUN_DIAL } from '../../scene/sceneMap';

const ICONS = { book: BookOpen, shelf: Library, laptop: Laptop, headphones: Headphones, tray: CupSoda, figures: Trophy, chime: Wind, lamp: Lamp, lantern: Flame };

/** Silueta en px de la imagen → caja y ruta relativa a esa caja (para `clip-path: path()`). */
function silhouetteBox(d) {
  const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  let i = 0;
  const rel = d.replace(/-?\d+(\.\d+)?/g, (n) => {
    const v = Number(n) - (i % 2 === 0 ? x : y);
    i += 1;
    return String(v);
  });
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, path: rel };
}

const LIFTS = Object.fromEntries(Object.entries(SILHOUETTES).map(([id, d]) => [id, silhouetteBox(d)]));

export function Hotspot({ id, label, onActivate, onHover, spot = false, guides = false, hint = 0, children }) {
  const spotData = HOTSPOTS[id];
  const box = bounds(spotData.shape);
  const clip = clipPolygon(spotData.shape);
  const [hover, setHover] = useState(false);
  const leaveTimer = useRef(0);
  const active = hover || spot;
  const Icon = ICONS[id];
  const lift = LIFTS[id];
  const show = () => onHover({ id, x: spotData.label.x, y: spotData.label.y, ...label });
  // Silueta e insignia comparten el estado; una pequeña espera al salir evita parpadeos al pasar de una a otra
  const enter = () => {
    window.clearTimeout(leaveTimer.current);
    setHover(true);
    show();
  };
  const leave = () => {
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      setHover(false);
      onHover(null, id);
    }, 160);
  };
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);
  const activate = (event) => {
    onActivate(event);
    if (event.nativeEvent?.pointerType === 'touch') {
      show();
      setHover(true);
      window.setTimeout(() => {
        setHover(false);
        onHover(null, id);
      }, 1800);
    }
  };
  const place = { left: box.x, top: box.y, width: box.w, height: box.h };

  return (
    <>
      {lift ? (
        // El objeto pintado se aviva: halo dorado que sigue su contorno y un 5 % más grande
        <div className="hotspot-lift" data-active={active} style={{ left: lift.x, top: lift.y, width: lift.w, height: lift.h }} aria-hidden="true">
          <span
            style={{
              clipPath: `path('${lift.path}')`,
              backgroundImage: `url(${SCENE_SRC})`,
              backgroundSize: `${SCENE_W}px ${SCENE_H}px`,
              backgroundPosition: `${-lift.x}px ${-lift.y}px`,
            }}
          />
        </div>
      ) : (
        <span className="hotspot-aura" data-active={active} style={place} aria-hidden="true" />
      )}
      <button
        type="button"
        className="hotspot"
        data-id={id}
        data-active={active}
        style={{ ...place, clipPath: clip }}
        aria-label={label.aria ?? `${label.title}. ${label.text ?? ''}`}
        onClick={activate}
        onPointerEnter={(event) => event.pointerType !== 'touch' && enter()}
        onPointerLeave={leave}
        onFocus={enter}
        onBlur={leave}
      >
        {children}
      </button>
      {guides && spotData.badge && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="hotspot-badge"
          data-id={id}
          data-active={active}
          style={{ left: spotData.badge.x, top: spotData.badge.y, animationDelay: `${-hint * 0.37}s` }}
          onClick={activate}
          onPointerEnter={(event) => event.pointerType !== 'touch' && enter()}
          onPointerLeave={leave}
        >
          <Icon />
        </button>
      )}
    </>
  );
}

/** Etiqueta de papel con chincheta que flota junto al objeto. */
export function RoomLabel({ label }) {
  if (!label) return null;
  return (
    <div className="room-label" data-below={label.y < 170 || undefined} style={{ left: label.x, top: label.y }} role="status">
      <div className="room-label__paper">
        <strong>{label.title}</strong>
        {label.text && <span>{label.text}</span>}
        {label.meta && <em>{label.meta}</em>}
      </div>
    </div>
  );
}

const TOD = {
  morning: { name: 'Mañana soleada' },
  sunset: { name: 'Atardecer dorado' },
  night: { name: 'Noche de lectura' },
};
export const TOD_ORDER = ['morning', 'sunset', 'night'];
export const todName = (t) => TOD[t].name;

/** Astrolabio de latón alrededor del astro: anillos graduados que giran despacio. */
function Astrolabe() {
  return (
    <svg className="time-dial__astrolabe" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="1 3.2" />
      {Array.from({ length: 24 }, (_, i) => (
        <line key={i} x1="50" y1="4" x2="50" y2={i % 6 ? 8 : 12} stroke="currentColor" strokeWidth={i % 6 ? 0.6 : 1.2} transform={`rotate(${i * 15} 50 50)`} />
      ))}
      <path d="M50 1 L53 7 L50 6 L47 7 Z" fill="currentColor" />
      <ellipse cx="50" cy="50" rx="46" ry="16" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.6" transform="rotate(-24 50 50)" />
    </svg>
  );
}

/**
 * El astro del cielo (sol, sol poniente o luna) lleva un astrolabio dorado: al tocarlo se abre el Atlas de
 * Sagas (1.13.0). La hora del día se cambia con el carillón.
 */
export function TimeDial({ timeOfDay, onOpen, onHover, spot = false }) {
  const at = SUN_DIAL[timeOfDay];
  const astro = timeOfDay === 'night' ? 'la luna' : 'el sol';
  const show = () => onHover({ id: 'dial', x: at.x, y: at.y - 34, title: 'Atlas de Sagas', text: `Toca ${astro}: tus sagas y qué leer ahora` });
  return (
    <button
      type="button"
      className="time-dial"
      data-tod={timeOfDay}
      data-spot={spot || undefined}
      style={{ left: at.x, top: at.y }}
      aria-label={`Abrir el Atlas de Sagas (${astro})`}
      onClick={onOpen}
      onPointerEnter={show}
      onPointerLeave={() => onHover(null, 'dial')}
      onFocus={show}
      onBlur={() => onHover(null, 'dial')}
    >
      <Astrolabe />
      <span className="time-dial__body" />
    </button>
  );
}
