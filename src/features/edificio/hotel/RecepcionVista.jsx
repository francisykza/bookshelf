// La recepción del Gran Hotel en primera persona (encargo de Francisco del 9-11-2026, bloque 3). La escena es
// `recepcion3d.js` (Three.js, se carga al entrar); aquí, lo que se toca y los mandos, con el diseño de la recepción:
// - letreros pequeños de latón sobre la recepción, el ascensor, el tablón y el guardarropa, que siguen a la vista;
// - tocar una cosa (en la escena, en su letrero o en la barra) acerca la cámara a ella y abre su papel; «Volver», tocar
//   fuera o Escape vuelve a la entrada (un segundo Escape sale a la plaza, como en el vestíbulo isométrico);
// - la barra de abajo, de nogal con filete dorado: «Encargos de la semana» en terciopelo verde y tres iconos de píxel;
// - «Plano», arriba, cambia a la vista isométrica de siempre (y se recuerda en el dispositivo).
// - El ascensor no abre un papel: sus puertas se abren, se entra en la cabina y su botonera son los botones de la placa de
//   latón de la pared (petición de Francisco del 9-11-2026); «Salir del ascensor» o Escape vuelven al vestíbulo.
// Lo que dice cada papel (encargos, botonera, «Abre pronto») lo pone quien la usa, con `paper(spot)`: es el mismo que el del
// plano isométrico.
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const RCP_NAMES = {
  recepcion: "Recepción",
  ascensor: "Ascensor",
  tablon: "Tablón",
  guardarropa: "Guardarropa",
};
const TITLES = {
  recepcion: "La recepción",
  ascensor: "El ascensor",
  tablon: "El tablón «Busco quien lea…»",
  guardarropa: "El guardarropa",
};
const TOOLS = ["ascensor", "tablon", "guardarropa"];

/** Iconos de la barra, en píxeles (rejilla de 16): el ascensor, el tablón y la percha del guardarropa. */
function Icono({ id }) {
  const px = {
    ascensor: [
      [3, 1, 10, 1, "#ecbe60"],
      [3, 2, 1, 13, "#ecbe60"],
      [12, 2, 1, 13, "#ecbe60"],
      [4, 2, 8, 13, "#a8743a"],
      [7, 4, 2, 11, "#3a2418"],
      [5, 6, 2, 1, "#f6ecd8"],
      [4, 7, 4, 1, "#f6ecd8"],
      [9, 9, 4, 1, "#f6ecd8"],
      [10, 10, 2, 1, "#f6ecd8"],
    ],
    tablon: [
      [1, 2, 14, 12, "#8a5a32"],
      [2, 3, 12, 10, "#c48a52"],
      [3, 4, 4, 5, "#f6ecd8"],
      [9, 5, 4, 4, "#f6ecd8"],
      [6, 9, 4, 3, "#f6ecd8"],
      [4, 4, 2, 1, "#a8434c"],
      [10, 5, 2, 1, "#2f5e5c"],
      [7, 9, 2, 1, "#ecbe60"],
    ],
    guardarropa: [
      [7, 1, 2, 1, "#ecbe60"],
      [9, 2, 1, 2, "#ecbe60"],
      [7, 4, 2, 1, "#ecbe60"],
      [6, 5, 1, 1, "#ecbe60"],
      [5, 6, 1, 1, "#ecbe60"],
      [3, 7, 2, 1, "#ecbe60"],
      [9, 5, 1, 1, "#ecbe60"],
      [10, 6, 1, 1, "#ecbe60"],
      [11, 7, 2, 1, "#ecbe60"],
      [2, 8, 12, 1, "#ecbe60"],
      [4, 9, 8, 6, "#a8434c"],
      [7, 9, 2, 6, "#7a2a34"],
    ],
  }[id];
  return (
    <svg
      className="rcp-tool__icon"
      viewBox="0 0 16 16"
      width="28"
      height="28"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      {px.map(([x, y, w, h, c], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={c} />
      ))}
    </svg>
  );
}

export function Recepcion3D({ onStreet, onPlano, onFail, paper }) {
  const wrap = useRef(null);
  const host = useRef(null);
  const api = useRef(null);
  const tagEls = useRef({});
  const [spot, setSpot] = useState(null);
  const [ready, setReady] = useState(false);
  // Dentro de la cabina, ya quieta delante de la botonera
  const [cabina, setCabina] = useState(false);
  const placa = useRef(null);
  const spotRef = useRef(null);
  const fail = useRef(onFail);
  useEffect(() => {
    spotRef.current = spot;
    fail.current = onFail;
  });
  // Tocar lo abierto, o fuera de ello, vuelve a la entrada
  // (dentro del ascensor, tocar la cabina no saca de él: se sale con «Salir del ascensor»)
  const choose = useRef((id) =>
    setSpot((cur) =>
      cur === "ascensor" && id !== "ascensor"
        ? cur
        : id === cur || (!id && cur)
          ? null
          : id,
    ),
  );

  // El alto que hay, de la barra del panel al pie de la pantalla (en escritorio, al pie del panel, que no llega abajo)
  useLayoutEffect(() => {
    const fit = () => {
      const el = wrap.current;
      if (!el) return;
      let bottom = window.innerHeight;
      const shell = el.closest('[role="dialog"]');
      const shellBottom = shell?.getBoundingClientRect().bottom ?? bottom;
      if (shell && shellBottom < bottom - 1) {
        const cs = getComputedStyle(shell);
        bottom =
          shellBottom -
          parseFloat(cs.borderBottomWidth) -
          parseFloat(cs.paddingBottom);
      }
      el.style.setProperty(
        "--rcp-h",
        `${Math.max(360, bottom - el.getBoundingClientRect().top)}px`,
      );
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    let alive = true;
    let mounted = null;
    import("./recepcion3d")
      .then(({ mountRecepcion }) => {
        if (!alive) return;
        mounted = mountRecepcion(host.current, {
          onPick: (id) => choose.current(id),
          onLost: () => fail.current(),
          onSettle: () => setCabina(Boolean(mounted?.inCabin())),
          onFrame: (tags) => {
            for (const [id, t] of Object.entries(tags)) {
              const el = tagEls.current[id];
              if (!el) continue;
              el.style.transform = `translate(${Math.round(t.x)}px, ${Math.round(t.y)}px) translate(-50%, -100%)`;
              el.dataset.off = t.visible ? "" : "true";
            }
            // Los botones del ascensor, justo encima de la placa de latón de la cabina
            if (placa.current && mounted) {
              const r = mounted.plateRect();
              Object.assign(placa.current.style, {
                left: `${r.left}px`,
                top: `${r.top}px`,
                width: `${r.width}px`,
                height: `${r.height}px`,
              });
            }
          },
        });
        api.current = mounted;
        if (import.meta.env.DEV) window.__recepcion3d = mounted;
        setReady(true);
      })
      .catch(() => alive && fail.current());
    return () => {
      alive = false;
      mounted?.destroy();
      api.current = null;
    };
  }, []);

  // Al quedarse quieta la cabina, los botones van a su sitio (luego los recoloca cada dibujo, p. ej. al girar el móvil)
  useLayoutEffect(() => {
    const el = placa.current;
    if (!cabina || !el || !api.current) return;
    const r = api.current.plateRect();
    Object.assign(el.style, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
  }, [cabina]);

  // De cerca, lo enfocado queda en el hueco que deja el papel por encima
  useEffect(() => {
    if (!ready) return;
    const stage = host.current?.getBoundingClientRect();
    const card = wrap.current
      ?.querySelector(".rcp-card")
      ?.getBoundingClientRect();
    const top =
      stage?.height && card
        ? Math.max(0.2, (card.top - stage.top) / stage.height)
        : 1;
    api.current?.focus(spot, top);
  }, [spot, ready]);

  // Escape cierra el papel; sin papel, sale a la plaza (no cierra el hotel: PanelShell respeta data-escape-local)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (spotRef.current) {
        setCabina(false);
        setSpot(null);
      } else onStreet();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onStreet]);

  const pick = (id) => choose.current(id);
  return (
    <section
      className="rcp"
      ref={wrap}
      aria-labelledby="rcp-title"
      data-escape-local="open"
      data-spot={spot || undefined}
      data-ready={ready || undefined}
    >
      <h3 className="px-sr" id="rcp-title">
        El vestíbulo
      </h3>
      <div className="rcp-stage" ref={host}>
        {!ready && <p className="rcp-loading">Abriendo la puerta giratoria…</p>}
        <div className="rcp-tags">
          {Object.keys(RCP_NAMES).map((id) => (
            <button
              key={id}
              type="button"
              className="rcp-tag"
              ref={(el) => (tagEls.current[id] = el)}
              data-off="true"
              onClick={() => pick(id)}
              tabIndex={spot ? -1 : 0}
            >
              {RCP_NAMES[id]}
            </button>
          ))}
        </div>
        <button type="button" className="rcp-plano" onClick={onPlano}>
          Plano
        </button>
      </div>
      {spot === "ascensor" && cabina && (
        <>
          <div
            className="rcp-cabina"
            ref={placa}
            role="group"
            aria-label="Dentro del ascensor"
          >
            {paper("ascensor")}
          </div>
          <button
            type="button"
            className="rcp-salir"
            onClick={() => {
              setCabina(false);
              setSpot(null);
            }}
          >
            Salir del ascensor
          </button>
        </>
      )}
      {spot && spot !== "ascensor" && (
        <section
          className={`rcp-card rcp-card--${spot}`}
          aria-labelledby="rcp-card-title"
        >
          <header className="rcp-card__head">
            <h4 id="rcp-card-title">{TITLES[spot]}</h4>
            <button
              type="button"
              className="rcp-card__back"
              onClick={() => setSpot(null)}
            >
              Volver
            </button>
          </header>
          <div className="rcp-card__body">{paper(spot)}</div>
        </section>
      )}
      <nav className="rcp-bar" aria-label="Lo que hay en el vestíbulo">
        <button
          type="button"
          className="rcp-primary"
          aria-pressed={spot === "recepcion"}
          onClick={() => pick("recepcion")}
        >
          <span>Encargos de la semana</span>
          <small>Te los da el conserje</small>
        </button>
        {TOOLS.map((id) => (
          <button
            key={id}
            type="button"
            className="rcp-tool"
            aria-pressed={spot === id}
            onClick={() => pick(id)}
          >
            <Icono id={id} />
            <span>{RCP_NAMES[id]}</span>
          </button>
        ))}
      </nav>
    </section>
  );
}
