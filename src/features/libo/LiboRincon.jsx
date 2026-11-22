// Libo, el gato guía (docs/qa/libo.md, bloques 1 y 2). Vive en una esquina de cada escena; al tocarle abre su bocadillo con
// el corazón del logo. La primera vez que llegas a cada sitio te lo enseña: señala, paso a paso, los controles de verdad
// (nunca un dibujo) y se puede saltar en cualquier momento. Sin temporizadores que avancen solos, sin sonido antes de un
// toque y, con movimiento reducido, quieto.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLibrary } from '../../state/useLibrary';
import { dayKey } from '../../domain/dates';
import { CAPITULOS, SALUDOS, abrePorSuCuenta, estaVisible, haVisto, marcarPresentadoAqui, marcarVisto, presentadoAqui } from './libo';
import { asomoAqui, callar, debeAsomar, fijarDia, ideaAhora, marcarAsomoAqui, sugerenciaDelDia, sugerencias } from './sugerencias';
import { maullar } from './maullido';
import { useAtras } from '../../hooks/useAtras';
import './libo.css';

const ARTE = '/assets/libo/libo-320.webp';
const ARTE_GRANDE = '/assets/libo/libo-640.webp';
const MARGEN = 12;

/** El corazón del bocadillo del logo, en píxeles. */
function Corazon() {
  return (
    <svg className="libo-corazon" viewBox="0 0 7 6" aria-hidden="true" shapeRendering="crispEdges">
      <path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z" />
    </svg>
  );
}

/** Dónde poner la tarjeta de un paso: junto a su control (arriba si cabe, si no debajo), siempre dentro del contenedor. */
function colocar(caja, objetivo, tarjeta) {
  const ancho = Math.min(tarjeta.w, caja.w - MARGEN * 2);
  if (!objetivo) return { x: (caja.w - ancho) / 2, y: Math.max(MARGEN, (caja.h - tarjeta.h) / 2 - 40), ancho, arriba: true };
  const cx = objetivo.x + objetivo.w / 2;
  const x = Math.min(Math.max(MARGEN, cx - ancho / 2), caja.w - ancho - MARGEN);
  const arriba = objetivo.y - tarjeta.h - 18 >= MARGEN;
  const y = arriba ? objetivo.y - tarjeta.h - 18 : Math.min(objetivo.y + objetivo.h + 18, caja.h - tarjeta.h - MARGEN);
  return { x, y, ancho, arriba, flecha: Math.min(Math.max(16, cx - x), ancho - 16) };
}

/** Un texto de Libo, con los títulos de los libros en cursiva. */
function Partes({ partes }) {
  return partes.map((p, i) => (typeof p === 'string' ? p : <em key={i}>{p.titulo}</em>));
}

/** Lo que Libo tiene para ti en tu piso: los avisos de otros sitios y, debajo, la sugerencia del día (o la idea que le pides). */
function ListaLibo({ avisos, sugerencia, onAviso, onSugerencia }) {
  return (
    <ul className="libo-avisos">
      {avisos.map((a) => (
        <li key={a.id} className="libo-aviso" data-aviso={a.id}>
          {/* Toda la tira lleva a su sitio: el texto y, al final, adónde */}
          <button type="button" className="libo-aviso__ir" onClick={() => onAviso(a)}>
            <p>
              <Partes partes={a.partes} /> <strong>{a.boton} ›</strong>
            </p>
          </button>
        </li>
      ))}
      {sugerencia && (
        <li className="libo-aviso libo-aviso--sugerencia" data-sugerencia={sugerencia.id}>
          <p>
            <Partes partes={sugerencia.partes} />
          </p>
          <div className="libo-aviso__acciones">
            {sugerencia.acciones.map((ac, i) => (
              <button key={ac.ir} type="button" className={`libo-btn libo-btn--mini${i === 0 ? ' libo-btn--principal' : ''}`} onClick={() => onSugerencia(sugerencia, ac)}>
                {ac.boton}
              </button>
            ))}
            {!sugerencia.id.startsWith('idea:') && !sugerencia.acciones.some((ac) => ac.ir === 'callar') && (
              <button type="button" className="libo-btn libo-btn--leve libo-btn--mini" onClick={() => onSugerencia(sugerencia, { ir: 'callar' })}>
                Ahora no
              </button>
            )}
          </div>
        </li>
      )}
    </ul>
  );
}

function rectEn(caja, el) {
  const r = el.getBoundingClientRect();
  return { x: r.left - caja.left, y: r.top - caja.top, w: r.width, h: r.height };
}

/** La parte visible del contenedor (sin su borde): la guía se dibuja ahí, aunque el panel tenga desplazamiento. */
function cajaDe(cont) {
  const cr = cont.getBoundingClientRect();
  return { left: cr.left + cont.clientLeft, top: cr.top + cont.clientTop, w: cont.clientWidth || cr.width, h: cont.clientHeight || cr.height };
}

/**
 * El control de un paso, solo si se ve (la calle se puede girar y un botón puede quedar fuera de la pantalla). `ancla` puede
 * ser una lista: vale el primero que se vea (p. ej. la ventana de un vecino y, si no hay, una puerta libre).
 */
function anclaVisible(cont, ancla) {
  const caja = cajaDe(cont);
  for (const sel of [ancla].flat()) {
    const el = cont.querySelector(sel);
    if (!el) continue;
    const o = rectEn(caja, el);
    if (o.w > 0 && o.h > 0 && o.x + o.w > 0 && o.y + o.h > 0 && o.x < caja.w && o.y < caja.h) return el;
  }
  return null;
}

/**
 * La guía: un velo suave con un hueco sobre el control del paso y la tarjeta de Libo al lado. `pasos` ya filtrados a los
 * que tienen su control en pantalla (o ninguno, como el saludo). `cont`: el elemento de la escena donde se dibuja.
 */
function Guia({ pasos, contexto, cont, onFin, onPaso }) {
  const [i, setI] = useState(0);
  const [geo, setGeo] = useState(null);
  const tarjeta = useRef(null);
  const principal = useRef(null);
  const paso = pasos[i];
  const ultimo = i === pasos.length - 1;
  // Quien manda en la esquina sabe qué paso se ve (en el último, el Libo de la esquina es el señalado)
  useEffect(() => onPaso?.(paso.id), [paso.id, onPaso]);

  const medir = useCallback(() => {
    if (!cont || !tarjeta.current) return;
    const caja = cajaDe(cont);
    const el = paso.ancla ? anclaVisible(cont, paso.ancla) : null;
    const objetivo = el ? rectEn(caja, el) : null;
    const t = { w: Math.min(340, tarjeta.current.offsetWidth || 340), h: tarjeta.current.offsetHeight || 180 };
    const sitio = colocar(caja, objetivo, t);
    // El marco: la parte del contenedor que se ve ahora (si el panel se ha desplazado, la guía va con la vista)
    const marco = { x: cont.scrollLeft, y: cont.scrollTop, w: caja.w, h: caja.h };
    setGeo((g) => {
      const n = { objetivo, sitio, marco };
      return JSON.stringify(g) === JSON.stringify(n) ? g : n;
    });
  }, [paso, cont]);

  useLayoutEffect(() => {
    medir();
    // La escena puede recolocar la barra (el texto de la lectura, el teclado, girar el móvil): se vuelve a medir
    const ro = new ResizeObserver(medir);
    if (cont) ro.observe(cont);
    if (tarjeta.current) ro.observe(tarjeta.current);
    window.addEventListener('resize', medir);
    cont?.addEventListener('scroll', medir, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', medir);
      cont?.removeEventListener('scroll', medir);
    };
  }, [medir, cont]);

  // El foco, a la acción principal en cuanto la tarjeta está colocada (antes está oculta y no se puede enfocar)
  const colocada = Boolean(geo);
  useEffect(() => {
    if (colocada) principal.current?.focus({ preventScroll: true });
  }, [i, colocada]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // Escape cierra la guía, no el panel de la escena
      e.stopPropagation();
      onFin();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onFin]);

  const o = geo?.objetivo;
  const s = geo?.sitio;
  const m = geo?.marco;
  const id = `libo-paso-${paso.id}`;
  return (
    <div className="libo-guia" data-escape-local="open" data-no-room-swipe style={m ? { left: m.x, top: m.y, width: m.w, height: m.h, right: 'auto', bottom: 'auto' } : undefined}>
      {o ? (
        <span className="libo-guia__hueco" style={{ left: o.x - 6, top: o.y - 6, width: o.w + 12, height: o.h + 12 }} aria-hidden="true" />
      ) : (
        <span className="libo-guia__velo" aria-hidden="true" />
      )}
      <section
        ref={tarjeta}
        className="libo-tarjeta"
        data-paso={paso.id}
        data-lado={s && !s.arriba ? 'abajo' : 'arriba'}
        // Con la tarjeta debajo, Libo asoma por el lado contrario a la flecha, para no tapar lo que señala
        data-gato={s && !s.arriba && s.flecha > s.ancho / 2 ? 'izquierda' : undefined}
        style={s ? { left: s.x, top: s.y, width: s.ancho, '--flecha': `${s.flecha ?? -100}px` } : { visibility: 'hidden' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={`${id}-d`}
      >
        {/* Libo asoma por encima de la tarjeta; si está pegada arriba y no cabe, no se corta: no sale */}
        {paso.id !== 'fin' && !(s && paso.id !== 'hola' && s.y < 66) && <img className="libo-tarjeta__gato" src={paso.id === 'hola' ? ARTE_GRANDE : ARTE} alt="" aria-hidden="true" draggable="false" />}
        <h2 id={`${id}-t`}>
          <Corazon />
          {paso.titulo}
        </h2>
        <p id={`${id}-d`}>{paso.texto(contexto)}</p>
        <div className="libo-tarjeta__acciones">
          <button ref={principal} type="button" className="libo-btn libo-btn--principal" onClick={() => (ultimo ? onFin() : setI(i + 1))}>
            {i === 0 && pasos.length > 1 ? 'Enséñame' : ultimo ? 'Gracias, Libo' : 'Siguiente'}
          </button>
          {i === 0 && pasos.length > 1 ? (
            <button type="button" className="libo-btn" onClick={onFin}>
              Ahora no
            </button>
          ) : (
            !ultimo && (
              <>
                <button type="button" className="libo-btn" onClick={() => setI(i - 1)}>
                  Atrás
                </button>
                <button type="button" className="libo-btn libo-btn--leve" onClick={onFin}>
                  Saltar
                </button>
              </>
            )
          )}
        </div>
        {pasos.length > 2 && i > 0 && (
          <p className="libo-tarjeta__cuenta" aria-hidden="true">
            {i} de {pasos.length - 1}
          </p>
        )}
      </section>
    </div>
  );
}

const SIN_AVISOS = Object.freeze([]);
const SITIOS = ['edificio', 'cafe', 'hotel'];

/**
 * Libo en su esquina. `lugar`: qué dice al tocarle (SALUDOS). `capitulo`: la guía de este sitio (CAPITULOS), o nada.
 * `listo`: la escena ya está a la vista (la guía no se abre encima de una pantalla de carga); `espera`, además, un selector
 * que tiene que estar en la escena antes de empezar (p. ej. la fachada ya llegada). `respiro`: lo que espera después, para
 * que la escena se asiente. `raiz`: el contenedor de la escena, donde se dibuja la guía (si no se da, el panel en el que está
 * Libo). `onAjustes`: abre «Tu cuenta», donde se elige cómo se porta. `variante`: dónde se sienta (sobre la barra del piso,
 * en la esquina de abajo o arriba, junto a la barra del panel).
 * Bloque 3, solo en tu piso de inicio (`hub`): reúne los `avisos` de otros sitios (useAvisosLibo) y la sugerencia del día; una
 * vez al día, al llegar, su bocadillo asoma solo (sin sonido) si tiene algo que decir. `onIr(ir, libro)`: adónde lleva cada
 * botón ('almacen', 'cafe', 'hotel', 'edificio', 'resena', 'ficha', 'registrar', 'biblioteca', 'anadir').
 */
export function Libo({ lugar = 'piso', capitulo = null, contexto = {}, listo = true, espera = null, respiro = 600, raiz = null, onAjustes, variante = 'barra', hub = false, avisos = SIN_AVISOS, onIr = null }) {
  const { state, actions } = useLibrary();
  const { settings, books } = state;
  const log = state.progress?.readingLog;
  const [abierto, setAbierto] = useState(false);
  const [pasos, setPasos] = useState(null);
  const [pasoVisto, setPasoVisto] = useState(null);
  const [hayEscena, setHayEscena] = useState(!espera);
  const empezado = useRef(false);
  const rincon = useRef(null);
  const boton = useRef(null);
  const bocadillo = useRef(null);
  const visible = estaVisible(settings);
  const cap = capitulo ? (CAPITULOS[capitulo] ?? null) : null;
  const guia = cap?.pasos ?? null;
  const contenedor = useCallback(() => raiz?.current ?? rincon.current?.closest('.panel') ?? null, [raiz]);

  const marcar = useCallback(
    (...capitulos) => {
      let s = settings;
      let patch = null;
      for (const c of capitulos) {
        const p = marcarVisto(s, c);
        if (p) {
          patch = p;
          s = { ...s, ...p };
        }
      }
      if (patch) actions.setSettings(patch);
    },
    [settings, actions],
  );

  const empezarGuia = useCallback(() => {
    const cont = contenedor();
    if (!guia || !cont) return false;
    const enPantalla = guia.filter((p) => !p.ancla || anclaVisible(cont, p.ancla));
    if (enPantalla.length < 2) return false;
    setAbierto(false);
    setPasos(enPantalla);
    return true;
  }, [guia, contenedor]);

  // Lo que la escena tiene que tener a la vista antes de que Libo diga nada (se mira cada poco, sin observar el DOM entero)
  useEffect(() => {
    if (!espera || hayEscena) return undefined;
    const id = setInterval(() => {
      if (contenedor()?.querySelector(espera)) setHayEscena(true);
    }, 250);
    return () => clearInterval(id);
  }, [espera, hayEscena, contenedor]);

  // La primera vez: la guía si este sitio tiene una; si no, solo el saludo en su bocadillo. El efecto solo depende de si
  // toca abrirse (otros ajustes cambian a menudo al arrancar y no deben reiniciar la espera)
  const propio = guia ? capitulo : 'hola';
  const toca = listo && hayEscena && visible && !presentadoAqui(propio) && abrePorSuCuenta(settings, propio);
  const ultimo = useRef({ empezarGuia, marcar });
  ultimo.current = { empezarGuia, marcar };
  useEffect(() => {
    if (!toca || empezado.current) return undefined;
    // Un respiro para que la escena se asiente (y la barra tenga su tamaño final) antes de señalar nada
    const id = setTimeout(() => {
      if (guia) {
        empezado.current = ultimo.current.empezarGuia();
      } else {
        empezado.current = true;
        setAbierto(true);
        ultimo.current.marcar('hola');
        marcarPresentadoAqui(['hola']);
      }
    }, respiro);
    return () => clearTimeout(id);
  }, [toca, guia, respiro]);

  // Bloque 3: la sugerencia del día y, al pedírsela, una idea. Lo que ya conoces del edificio (en tus ajustes o en este aparato)
  const hoy = useMemo(() => dayKey(), []);
  const [idea, setIdea] = useState(null);
  const sitiosVistos = hub ? SITIOS.filter((c) => haVisto(settings, c) || presentadoAqui(c)).join(',') : '';
  const candidatas = useMemo(
    () => (hub ? sugerencias({ books, log: log ?? [], settings, vistos: sitiosVistos.split(','), hoy }) : []),
    [hub, books, log, settings, sitiosVistos, hoy],
  );
  const deHoy = hub ? sugerenciaDelDia(candidatas, settings, hoy) : null;
  const hayAlgo = hub && (avisos.length > 0 || Boolean(deHoy));
  const fijar = useCallback(
    (asomo) => {
      const p = fijarDia(settings, hoy, deHoy?.id ?? null, asomo);
      if (p) actions.setSettings(p);
    },
    [settings, hoy, deHoy, actions],
  );
  ultimo.current.fijar = fijar;
  // Una vez al día, al llegar a tu piso, el bocadillo asoma solo si tiene algo que decir (sin maullido: nunca suena sin un toque).
  // Nunca el mismo día que la bienvenida ni encima de una guía
  const bienvenidaVista = haVisto(settings, 'bienvenida') || presentadoAqui('bienvenida');
  const asoma = hub && listo && hayEscena && visible && !pasos && bienvenidaVista && debeAsomar(settings, { hoy, hayAlgo, aqui: asomoAqui(hoy) });
  useEffect(() => {
    if (!asoma || empezado.current) return undefined;
    const id = setTimeout(() => {
      empezado.current = true;
      setAbierto(true);
      marcarAsomoAqui(hoy);
      ultimo.current.fijar(true);
    }, respiro + 900);
    return () => clearTimeout(id);
  }, [asoma, hoy, respiro]);

  const alAviso = (a) => {
    setAbierto(false);
    onIr?.(a.ir);
  };
  const alSugerencia = (s, ac) => {
    // Contestada (vayas o no), Libo no la repite en un mes; las ideas que le pides no se apuntan
    if (!s.id.startsWith('idea:')) actions.setSettings(callar(settings, s.id, hoy));
    setAbierto(false);
    setIdea(null);
    if (ac.ir !== 'callar') onIr?.(ac.ir, ac.libro);
  };

  const terminar = useCallback(() => {
    setPasos(null);
    marcar('hola', capitulo);
    marcarPresentadoAqui(['hola', capitulo]);
    requestAnimationFrame(() => boton.current?.focus({ preventScroll: true }));
  }, [marcar, capitulo]);
  // Bloque 4 (hooks/useAtras.js): Atrás del móvil cierra el bocadillo, o termina la guía (como «Saltar»), antes que la pantalla
  useAtras(abierto, () => setAbierto(false));
  useAtras(Boolean(pasos), terminar);

  // El bocadillo se cierra tocando fuera o con Escape (sin cerrar el panel de la escena)
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => {
      if (!bocadillo.current?.contains(e.target) && !boton.current?.contains(e.target)) setAbierto(false);
    };
    const tecla = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setAbierto(false);
        boton.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('pointerdown', fuera, true);
    window.addEventListener('keydown', tecla, true);
    return () => {
      document.removeEventListener('pointerdown', fuera, true);
      window.removeEventListener('keydown', tecla, true);
    };
  }, [abierto]);

  if (!visible) return null;
  const cont = pasos ? contenedor() : null;
  return (
    <>
      <div
        ref={rincon}
        className="libo-rincon"
        data-variante={variante}
        data-lugar={lugar}
        data-oculto={(pasos && pasoVisto !== 'fin') || undefined}
        data-escape-local={abierto ? 'open' : undefined}
      >
        {abierto && (
          <div ref={bocadillo} className="libo-bocadillo" role="dialog" aria-label="Libo" data-hub={hub || undefined}>
            {hub && (avisos.length > 0 || deHoy || idea) ? (
              <>
                <p>
                  <Corazon />
                  {idea && !avisos.length ? 'Se me ocurre esto:' : 'Miau. Esto es lo que hay hoy:'}
                </p>
                <ListaLibo avisos={avisos} sugerencia={idea ?? deHoy} onAviso={alAviso} onSugerencia={alSugerencia} />
              </>
            ) : (
              <p>
                <Corazon />
                {SALUDOS[lugar] ?? SALUDOS.otro}
              </p>
            )}
            <div className="libo-bocadillo__acciones">
              {hub && !hayAlgo && !idea && (
                <button type="button" className="libo-btn libo-btn--principal" onClick={() => setIdea(ideaAhora({ candidatas, deHoy, books }))}>
                  ¿Qué hago ahora?
                </button>
              )}
              {guia && (
                <button type="button" className={`libo-btn${!hub ? ' libo-btn--principal' : hayAlgo || idea ? ' libo-btn--leve' : ''}`} onClick={() => empezarGuia()}>
                  {cap.repaso}
                </button>
              )}
              {onAjustes && (
                <button
                  type="button"
                  className={`libo-btn${hub && (hayAlgo || idea) ? ' libo-btn--leve' : ''}`}
                  onClick={() => {
                    setAbierto(false);
                    onAjustes();
                  }}
                >
                  Ajustes de Libo
                </button>
              )}
            </div>
          </div>
        )}
        <button
          ref={boton}
          type="button"
          className="libo-rincon__gato"
          aria-label="Libo, el gato guía"
          aria-expanded={abierto}
          aria-describedby={hayAlgo && !abierto ? 'libo-nota' : undefined}
          data-nota={(hayAlgo && !abierto) || undefined}
          onClick={() => {
            if (!abierto) {
              maullar();
              setIdea(null);
              if (hub) fijar(false);
            }
            setAbierto((v) => !v);
          }}
        >
          <img src={ARTE} alt="" draggable="false" />
          {/* Tiene algo que contarte: el corazón del logo, quieto, junto a su oreja */}
          {hayAlgo && !abierto && (
            <span className="libo-rincon__nota" id="libo-nota">
              <Corazon />
              <span className="libo-sr">Tiene algo que contarte</span>
            </span>
          )}
        </button>
      </div>
      {pasos && cont && createPortal(<Guia pasos={pasos} contexto={contexto} cont={cont} onFin={terminar} onPaso={setPasoVisto} />, cont)}
    </>
  );
}
