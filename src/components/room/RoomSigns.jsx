// Señales físicas de la habitación (SPEC §28.9): placas, cintas y etiquetas permanentes y discretas ancladas a
// la posición real de cada objeto (px de la ilustración, calibrados con rejilla sobre `cozy-book-room.jpg`). Son
// decorativas (`aria-hidden`, sin eventos de puntero): el control es siempre el hotspot del objeto entero, que
// queda debajo y recibe el toque. No tapan libros, figuras ni controles.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SUN_DIAL } from "../../scene/sceneMap";
import { HangingPlaque } from "../primitives";

// Punto de cuelgue (centro superior) de cada señal en px de la escena 941 × 1672
export const SIGNS = {
  figures: { x: 226, y: 122, kind: "plaque", text: "Colección" },
  shelf: { x: 232, y: 858, kind: "plaque", text: "Mi biblioteca" },
  book: { x: 262, y: 1476, kind: "ribbon", text: "Mi lectura" },
  laptop: { x: 688, y: 1172, kind: "tab", text: "Calendario" },
  tray: { x: 850, y: 1238, kind: "tag", text: "Tiempo de lectura" },
  headphones: { x: 176, y: 1290, kind: "tag", text: "Ambiente" },
};

const HINT_KEY = "bookshelf:signs-hint-done";
const hintDone = () => {
  try {
    return localStorage.getItem(HINT_KEY) === "true";
  } catch {
    return true;
  }
};

/** Ayuda inicial breve: solo destaca la biblioteca. Se descarta y vuelve a aparecer al terminar «Guías». */
function useSignsHint(guideActive) {
  const [show, setShow] = useState(() => !hintDone());
  const was = useRef(guideActive);
  useEffect(() => {
    if (was.current && !guideActive) {
      try {
        localStorage.removeItem(HINT_KEY);
      } catch {
        // sin almacenamiento
      }
      setShow(true);
    }
    was.current = guideActive;
  }, [guideActive]);
  const dismiss = () => {
    try {
      localStorage.setItem(HINT_KEY, "true");
    } catch {
      // sin almacenamiento: se oculta en esta visita
    }
    setShow(false);
  };
  return { show: show && !guideActive, dismiss };
}

function Sign({ id, sign, highlight }) {
  const common = {
    className: `room-sign room-sign--${sign.kind}`,
    "data-sign": id,
    "data-highlight": highlight || undefined,
    style: { left: sign.x, top: sign.y },
  };
  if (sign.kind === "plaque")
    return <HangingPlaque {...common}>{sign.text}</HangingPlaque>;
  return (
    <span {...common}>
      <span className="room-sign__label">{sign.text}</span>
    </span>
  );
}

/**
 * Mantiene cada señal dentro de la vista del panel: si el encuadre la corta, se desliza lo justo (como mucho
 * media señal) hacia dentro, sin separarse de su objeto. Se recalcula al cambiar el encuadre o el tamaño.
 */
function useKeepInView(ref, deps) {
  useLayoutEffect(() => {
    const root = ref.current;
    const panel = root?.closest("[data-panel]");
    const world = root?.closest(".scene-world");
    if (!root || !panel) return undefined;
    let frame = 0;
    const fit = () => {
      frame = 0;
      const box = panel.getBoundingClientRect();
      root.querySelectorAll(".room-sign").forEach((el) => {
        el.style.setProperty("--nudge", "0px");
        const r = el.getBoundingClientRect();
        const k = parseFloat(getComputedStyle(el).getPropertyValue("--k")) || 1;
        let dx = 0;
        if (r.right > box.right - 6) dx = box.right - 6 - r.right;
        else if (r.left < box.left + 6) dx = box.left + 6 - r.left;
        dx = Math.max(-r.width / 2, Math.min(r.width / 2, dx));
        el.style.setProperty("--nudge", `${(dx / k).toFixed(1)}px`);
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(fit);
    };
    schedule();
    const mo = new MutationObserver(schedule);
    if (world)
      mo.observe(world, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      mo.disconnect();
      window.removeEventListener("resize", schedule);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function RoomSigns({ timeOfDay, guideActive }) {
  const hint = useSignsHint(guideActive);
  const ref = useRef(null);
  useKeepInView(ref, [timeOfDay]);
  const dial = SUN_DIAL[timeOfDay] ?? SUN_DIAL.morning;
  return (
    <>
      <div
        ref={ref}
        className="room-signs"
        data-hint={hint.show || undefined}
        aria-hidden="true"
      >
        {Object.entries(SIGNS).map(([id, sign]) => (
          <Sign
            key={id}
            id={id}
            sign={sign}
            highlight={hint.show && id === "shelf"}
          />
        ))}
        <Sign
          id="sagas"
          sign={{
            x: dial.x,
            y: dial.y + 46,
            kind: "plaque",
            text: "Mis sagas",
          }}
        />
      </div>
      {hint.show && (
        <div
          className="room-signs-hint"
          role="note"
          style={{ left: SIGNS.shelf.x, top: SIGNS.shelf.y + 64 }}
        >
          <p>
            Las placas señalan lo que puedes tocar. Empieza por tu biblioteca.
          </p>
          <button type="button" onClick={hint.dismiss}>
            Entendido
          </button>
        </div>
      )}
    </>
  );
}
