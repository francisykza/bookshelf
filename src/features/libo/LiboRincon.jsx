// Libo, el gato guía (docs/qa/libo.md, bloques 1 y 2). Vive en una esquina de cada escena; al tocarle abre su bocadillo con
// el corazón del logo. La primera vez que llegas a cada sitio te lo enseña: señala, paso a paso, los controles de verdad
// (nunca un dibujo) y se puede saltar en cualquier momento. Sin temporizadores que avancen solos, sin sonido antes de un
// toque y, con movimiento reducido, quieto.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLibrary } from '../../state/useLibrary';
import { dayKey } from '../../domain/dates';
import { CAPITULOS, SALUDOS, abrePorSuCuenta, estaVisible, haVisto, liboDe, marcarPresentadoAqui, marcarVisto, presentadoAqui } from './libo';
import { asomoAqui, callar, debeAsomar, fijarDia, hoyDeLibo, ideaAhora, marcarAsomoAqui, saludoDeHoy, sugerenciaDelDia, sugerencias } from './sugerencias';
import { trazos } from './iconos';
import { DURA, DURA_GESTO, ESPERA_GESTO, POSES, REPOSO, gestoEnCalma, muchosToques, poseAlHablar, poseDelPaso, poseEnReposo, poseUrl, reaccionALectura } from './poses';
import { maullar } from './maullido';
import { useAtras } from '../../hooks/useAtras';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useCommunity } from '../social/hooks/useCommunity';
import { libocoinsText } from '../../domain/libocoins';
import { Libocoin } from '../../ui/Libocoin';
import { useSaldoLibo } from './useSaldoLibo';
import './libo.css';

const MARGEN = 12;

// Las poses se piden una vez por sesión, cuando el navegador está libre: al cambiar de pose no hay hueco mientras llega la imagen
let posesPedidas = false;
function pedirPoses() {
  if (posesPedidas || typeof Image === 'undefined') return;
  posesPedidas = true;
  const pedir = () => POSES.forEach((p) => (new Image().src = poseUrl(p)));
  if ('requestIdleCallback' in window) window.requestIdleCallback(pedir, { timeout: 4000 });
  else setTimeout(pedir, 1500);
}
// En cada sitio, la primera vez de la sesión, Libo llega corriendo
const llegadas = new Set();
// Cómo estaba tu lectura la última vez que Libo la miró. Fuera del componente: al apuntar una lectura, la hoja tapa la esquina
// y Libo se desmonta; al volver tiene que saber qué ha cambiado para celebrarlo
const memoria = { lectura: null, desde: Date.now() };

/** El corazón del bocadillo del logo, en píxeles. */
function Corazon() {
  return (
    <svg className="libo-corazon" viewBox="0 0 7 6" aria-hidden="true" shapeRendering="crispEdges">
      <path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z" />
    </svg>
  );
}

/** Dónde poner la tarjeta de un paso: junto a su control (arriba si cabe, si no debajo), siempre dentro del contenedor. */
export function colocar(caja, objetivo, tarjeta) {
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

// 1.158 · Los iconos de «Lo de hoy» (iconos.js), dibujados a mano en una rejilla de 11 × 11
const trazosHechos = new Map();
function IconoLibo({ nombre, tam = 33 }) {
  if (!trazosHechos.has(nombre)) trazosHechos.set(nombre, trazos(nombre));
  return (
    <svg className="libo-icono" width={tam} height={tam} viewBox="0 0 11 11" shapeRendering="crispEdges" aria-hidden="true" data-icono={nombre}>
      {trazosHechos.get(nombre).map((t) => (
        <path key={t.color} fill={t.color} d={t.d} />
      ))}
    </svg>
  );
}

/** La flecha de «ir», en píxeles. */
function Flecha() {
  return (
    <svg className="libo-hoy__flecha" viewBox="0 0 6 7" aria-hidden="true" shapeRendering="crispEdges">
      <path d="M1 0h1v1h1v1h1v1h1v1H4v1H3v1H2v1H1V6h1V5h1V4h1V3H3V2H2V1H1z" />
    </svg>
  );
}

// Libocoins, bloque 2 (docs/qa/libocoins.md): tu saldo, siempre a mano junto a Libo. Tocar la moneda abre una nota de papel
// con el saldo, cómo se ganan y dónde se gastan; sin botones de compra ni nada que meta prisa
const cifra = (n) => n.toLocaleString('es-ES');

function Monedero({ tickets }) {
  const [abierta, setAbierta] = useState(false);
  const boton = useRef(null);
  const caja = useRef(null);
  useAtras(abierta, () => setAbierta(false));
  useEffect(() => {
    if (!abierta) return undefined;
    const fuera = (e) => {
      if (!caja.current?.contains(e.target) && !boton.current?.contains(e.target)) setAbierta(false);
    };
    const tecla = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setAbierta(false);
        boton.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('pointerdown', fuera, true);
    window.addEventListener('keydown', tecla, true);
    return () => {
      document.removeEventListener('pointerdown', fuera, true);
      window.removeEventListener('keydown', tecla, true);
    };
  }, [abierta]);
  const cerrar = () => {
    setAbierta(false);
    boton.current?.focus({ preventScroll: true });
  };
  return (
    <>
      {abierta && (
          <div ref={caja} className="libo-bocadillo libo-saldo-nota" role="dialog" aria-label="Tus Libocoins">
            <div className="libo-hoy__cab">
              <span className="libo-hoy__pestana">Tus Libocoins</span>
              <button type="button" className="libo-hoy__cerrar" aria-label="Cerrar" onClick={cerrar}>
                <svg viewBox="0 0 5 5" aria-hidden="true" shapeRendering="crispEdges">
                  <path d="M0 0h1v1h1v1h1V1h1V0h1v1H4v1H3v1h1v1h1v1H4V4H3V3H2v1H1v1H0V4h1V3h1V2H1V1H0z" />
                </svg>
              </button>
            </div>
            <p className="libo-saldo-nota__saldo">
              <Libocoin size={44} />
              <span>
                Tienes <b>{libocoinsText(tickets)}</b>
              </span>
            </p>
            <p className="libo-saldo-nota__titulo">Se ganan</p>
            <ul className="libo-saldo-nota__lista">
              <li>Con las misiones de la semana, en el ordenador.</li>
              <li>Con las tres misiones del día de tu piso, cuando ya tienes toda su ropa.</li>
              <li>Subiendo de nivel tu café, y un poco cada día que atiendes en él.</li>
              <li>En la lata de los garbanzos del casino y vendiendo en la Lonja.</li>
            </ul>
            <p className="libo-saldo-nota__titulo">Se gastan</p>
            <ul className="libo-saldo-nota__lista">
              <li>En el almacén del Gran Hotel: muebles y, en la planta de abajo, ropa.</li>
              <li>En la Lonja, con lo que ponen otros vecinos.</li>
            </ul>
          </div>
        )}
      <button
        ref={boton}
        type="button"
        className="libo-saldo"
        aria-label={`Tus Libocoins: ${libocoinsText(tickets)}`}
        aria-expanded={abierta}
        data-saldo={tickets}
        onClick={() => setAbierta((v) => !v)}
      >
        <span className="libo-saldo__placa">
          <Libocoin size={30} />
          <span className="libo-saldo__cifra">{cifra(tickets)}</span>
        </span>
      </button>
    </>
  );
}

const MAX_FILAS = 5;

/**
 * 1.158 · «Lo de hoy» (docs/qa/libo-lo-de-hoy.md): lo que Libo tiene para ti en tu piso, en una tarjeta de papel con marco de
 * píxel. Cada fila (los avisos de otros sitios y lo que el servidor dice del casino, la ruleta y las misiones) es un botón que
 * lleva a su sitio; lo ya hecho hoy va al final, en verde y sin botón. Como mucho cinco filas a la vista («ver todo» enseña el
 * resto) y, al pie, la sugerencia del día (o la idea que le pides).
 */
function LoDeHoy({ saludo, pendientes, hechas, cargando, sugerencia, onIr, onSugerencia, onCerrar, children }) {
  const [todo, setTodo] = useState(false);
  const filas = [...pendientes.map((f) => ({ ...f, hecha: false })), ...hechas.map((f) => ({ ...f, hecha: true }))];
  const vistas = todo ? filas : filas.slice(0, MAX_FILAS);
  const mas = filas.length - vistas.length;
  const todoHecho = !pendientes.length && hechas.length > 0 && !cargando;
  return (
    <div className="libo-hoy">
      <div className="libo-hoy__cab">
        <span className="libo-hoy__pestana">Lo de hoy</span>
        <button type="button" className="libo-hoy__cerrar" aria-label="Cerrar" onClick={onCerrar}>
          <svg viewBox="0 0 5 5" aria-hidden="true" shapeRendering="crispEdges">
            <path d="M0 0h1v1h1v1h1V1h1V0h1v1H4v1H3v1h1v1h1v1H4V4H3V3H2v1H1v1H0V4h1V3h1V2H1V1H0z" />
          </svg>
        </button>
      </div>
      <p className="libo-hoy__saludo">{saludo}</p>
      {(vistas.length > 0 || cargando) && (
        <ul className="libo-avisos libo-hoy__lista">
          {vistas.map((f) =>
            f.hecha ? (
              <li key={`h:${f.id}`} className="libo-hoy__fila" data-aviso={f.id} data-hecha="">
                <span className="libo-hoy__baldosa">
                  <IconoLibo nombre={f.icono} />
                </span>
                <span className="libo-hoy__texto">
                  <strong>{f.titulo}</strong>
                  <span>{f.gracia}</span>
                </span>
                <IconoLibo nombre="hecho" tam={22} />
              </li>
            ) : (
              <li key={f.id} className="libo-hoy__fila" data-aviso={f.id}>
                <button type="button" className="libo-hoy__ir" onClick={() => onIr(f)}>
                  <span className="libo-hoy__baldosa">
                    <IconoLibo nombre={f.icono} />
                  </span>
                  <span className="libo-hoy__texto">
                    <strong>{f.titulo}</strong>
                    <span>{f.gracia}</span>
                  </span>
                  {f.chip ? <span className="libo-hoy__chip">{f.chip}</span> : <Flecha />}
                </button>
              </li>
            ),
          )}
          {cargando && (
            <li className="libo-hoy__fila libo-hoy__fila--mirando" aria-live="polite">
              <span className="libo-hoy__baldosa" />
              <span className="libo-hoy__texto">
                <span>Miro el casino y tus misiones…</span>
              </span>
            </li>
          )}
        </ul>
      )}
      {mas > 0 && (
        <button type="button" className="libo-hoy__mas" onClick={() => setTodo(true)}>
          {mas === 1 ? 'y 1 cosa más' : `y ${mas} cosas más`} · <u>ver todo</u>
        </button>
      )}
      {sugerencia ? (
        <div className="libo-hoy__idea" data-sugerencia={sugerencia.id}>
          <span className="libo-hoy__etiqueta">Idea de Libo</span>
          <p>
            <Partes partes={sugerencia.partes} />
          </p>
          <div className="libo-hoy__botones">
            {sugerencia.acciones.map((ac, i) => (
              <button key={ac.ir} type="button" className={`libo-hoy__btn${i === 0 ? ' libo-hoy__btn--si' : ''}`} onClick={() => onSugerencia(sugerencia, ac)}>
                {ac.boton}
              </button>
            ))}
            {!sugerencia.id.startsWith('idea:') && !sugerencia.acciones.some((ac) => ac.ir === 'callar') && (
              <button type="button" className="libo-hoy__btn" onClick={() => onSugerencia(sugerencia, { ir: 'callar' })}>
                Ahora no
              </button>
            )}
          </div>
        </div>
      ) : (
        todoHecho && (
          <div className="libo-hoy__idea">
            <span className="libo-hoy__etiqueta">Mañana</span>
            <p>Vuelvo a asomarme. Si hay algo nuevo, te lo cuento.</p>
          </div>
        )
      )}
      {children}
    </div>
  );
}

export function rectEn(caja, el) {
  const r = el.getBoundingClientRect();
  return { x: r.left - caja.left, y: r.top - caja.top, w: r.width, h: r.height };
}

/** La parte visible del contenedor (sin su borde): la guía se dibuja ahí, aunque el panel tenga desplazamiento. */
export function cajaDe(cont) {
  const cr = cont.getBoundingClientRect();
  return { left: cr.left + cont.clientLeft, top: cr.top + cont.clientTop, w: cont.clientWidth || cr.width, h: cont.clientHeight || cr.height };
}

/**
 * El control de un paso, solo si se ve (la calle se puede girar y un botón puede quedar fuera de la pantalla). `ancla` puede
 * ser una lista: vale el primero que se vea (p. ej. la ventana de un vecino y, si no hay, una puerta libre).
 */
export function anclaVisible(cont, ancla) {
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
  // Saluda al empezar, te acompaña andando y celebra el último paso con él a la vista (en «fin» se señala el de la esquina)
  const poseGato = paso.id === 'hola' ? 'saluda' : poseDelPaso(i, pasos.at(-1)?.id === 'fin' ? pasos.length - 1 : pasos.length);
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
        {paso.id !== 'fin' && !(s && paso.id !== 'hola' && s.y < 66) && (
          <img key={i} className="libo-tarjeta__gato" src={poseUrl(poseGato)} data-pose={poseGato} alt="" aria-hidden="true" draggable="false" />
        )}
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
 * botón ('almacen', 'cafe', 'hotel', 'edificio', 'resena', 'ficha', 'registrar', 'biblioteca', 'anadir' y, desde la 1.154, 'amigos').
 * `amigos` (1.154): tu agenda de amigos (useAmigosLibo), para sus sugerencias.
 * `cargarHoy` (1.158): pregunta al servidor lo del día (cargarHoyLibo) al abrir «Lo de hoy»; adónde llevan sus filas, además:
 * 'casino' y 'misiones'.
 * `saldo` (1.161, Libocoins bloque 2): la moneda con tu saldo a su lado, con la comunidad activa (no en la cabecera de los
 * cuadernos ni en el telefonillo, que ya van llenos).
 */
export function Libo({ lugar = 'piso', capitulo = null, contexto = {}, listo = true, espera = null, respiro = 600, raiz = null, onAjustes, variante = 'barra', hub = false, avisos = SIN_AVISOS, amigos = null, onIr = null, cargarHoy = null, saldo = true }) {
  const { state, actions } = useLibrary();
  const community = useCommunity();
  const tickets = useSaldoLibo(saldo && variante !== 'cabecera' && lugar !== 'telefonillo' && community.status === 'ready' && community.member);
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
  // Una reacción de Libo (o varias seguidas): cada pose dura lo suyo (DURA) y luego vuelve a lo de siempre
  const [reaccion, setReaccion] = useState(null);
  const tReaccion = useRef(0);
  const reaccionar = useCallback((...poses) => {
    clearTimeout(tReaccion.current);
    let k = 0;
    const siguiente = () => {
      const p = poses[k] ?? null;
      k += 1;
      setReaccion(p);
      if (p) tReaccion.current = setTimeout(siguiente, DURA[p] ?? 2000);
    };
    siguiente();
  }, []);
  useEffect(() => () => clearTimeout(tReaccion.current), []);
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
    () => (hub ? sugerencias({ books, log: log ?? [], settings, vistos: sitiosVistos.split(','), amigos, hoy }) : []),
    [hub, books, log, settings, sitiosVistos, amigos, hoy],
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

  // 1.158 · Lo de hoy: al abrir la tarjeta, lo que dice el servidor del casino, la ruleta y las misiones (con caché de un minuto)
  const [datosHoy, setDatosHoy] = useState(null);
  const [mirando, setMirando] = useState(false);
  const preguntar = hub && abierto && Boolean(cargarHoy);
  useEffect(() => {
    if (!preguntar) return undefined;
    let vivo = true;
    const p = cargarHoy();
    // Lo que ya estaba en caché llega en el mismo instante: sin la fila de «Miro…»
    const id = setTimeout(() => vivo && setMirando(true), 120);
    p.then(
      (d) => {
        if (!vivo) return;
        setDatosHoy(d ?? null);
        setMirando(false);
      },
      () => vivo && setMirando(false),
    ).finally(() => clearTimeout(id));
    return () => {
      vivo = false;
      clearTimeout(id);
    };
  }, [preguntar, cargarHoy]);
  const hoyServidor = useMemo(() => (datosHoy ? hoyDeLibo(datosHoy) : { pendientes: [], hechas: [] }), [datosHoy]);
  const pendientesHoy = useMemo(() => [...avisos.filter((a) => a.icono), ...hoyServidor.pendientes], [avisos, hoyServidor]);
  const hechasHoy = hoyServidor.hechas;
  const todoHecho = hub && !mirando && !pendientesHoy.length && hechasHoy.length > 0;

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
    // «Ahora no»: se da la vuelta un momento, sin insistir
    else reaccionar('espaldas');
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

  // ── Las poses: Libo está vivo ──
  // Reacciona (un rato y vuelve a lo suyo), se sienta a leer o se duerme si no pasa nada, y habla con la pose de lo que cuenta.
  // Con movimiento reducido no cambia solo (ni llega corriendo ni se duerme): solo responde a lo que tú haces.
  const reducido = useReducedMotion();
  const { modo } = liboDe(settings);
  const [quieto, setQuieto] = useState(0);
  const [gatito, setGatito] = useState(false);
  const [llega, setLlega] = useState(false);
  const toques = useRef([]);
  useEffect(() => {
    if (!visible) return undefined;
    pedirPoses();
    if (reducido || llegadas.has(lugar)) return undefined;
    setLlega(true);
    // Se apunta al terminar la carrera: si la escena se rehace a mitad (o React monta dos veces), vuelve a llegar y no se
    // queda corriendo
    const id = setTimeout(() => {
      llegadas.add(lugar);
      setLlega(false);
    }, DURA.corre);
    return () => {
      clearTimeout(id);
      setLlega(false);
    };
  }, [visible, reducido, lugar]);
  // El rato sin tocar nada (cualquier toque, tecla o desplazamiento lo despierta)
  useEffect(() => {
    if (!visible || reducido) return undefined;
    let ultimo = Date.now();
    const despierta = () => {
      ultimo = Date.now();
      setQuieto((q) => (q ? 0 : q));
    };
    const opciones = { capture: true, passive: true };
    // Solo lo que hace la persona (un desplazamiento suelto puede venir de la propia escena)
    const eventos = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    eventos.forEach((ev) => window.addEventListener(ev, despierta, opciones));
    let antes = 0;
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - ultimo) / 1000);
      const nivel = s >= REPOSO.duerme ? REPOSO.duerme : s >= REPOSO.lee ? REPOSO.lee : 0;
      // Al sentarse, a veces viene a verle un gatito negro
      if (nivel === REPOSO.lee && antes !== nivel) setGatito(Math.random() < 0.2);
      antes = nivel;
      setQuieto(nivel);
    }, 3000);
    return () => {
      clearInterval(id);
      eventos.forEach((ev) => window.removeEventListener(ev, despierta, opciones));
    };
  }, [visible, reducido]);
  // Lo que acabas de leer: un registro nuevo lo celebra; un libro terminado, lo abraza
  const lectura = useMemo(() => ({ registros: log?.length ?? 0, terminados: books.filter((b) => b.status === 'read').length }), [log, books]);
  useEffect(() => {
    const r = reaccionALectura(memoria.lectura, lectura);
    memoria.lectura = lectura;
    // Los primeros segundos de la app, lo que cambia es la biblioteca que llega de la nube, no algo que acabas de hacer
    if (r && Date.now() - memoria.desde > 4000) reaccionar(r);
  }, [lectura, reaccionar]);
  // Con todo hecho, se echa la siesta mientras te lo cuenta
  const hablando = todoHecho ? 'duerme' : hub ? poseAlHablar({ avisos, sugerencia: idea ?? deHoy }) : 'saluda';
  const pose = abierto ? hablando : llega ? 'corre' : (reaccion ?? (reducido ? (modo === 'llamar' ? 'lee' : 'de-pie') : poseEnReposo({ modo, quieto, gatito })));

  // En calma (de pie o leyendo, sin hablar ni reaccionar), de vez en cuando un gesto pequeño: un saltito o mirar al otro lado
  const [gesto, setGesto] = useState(null);
  const poseCalma = useRef(pose);
  useEffect(() => {
    poseCalma.current = pose;
  }, [pose]);
  const enCalma = visible && !reducido && !abierto && !reaccion && !llega && !pasos && Boolean(gestoEnCalma(pose, 0));
  useEffect(() => {
    if (!enCalma) return undefined;
    let id = 0;
    const siguiente = () => {
      id = setTimeout(() => {
        const g = gestoEnCalma(poseCalma.current, Math.random());
        setGesto(g);
        id = setTimeout(() => {
          setGesto(null);
          siguiente();
        }, DURA_GESTO[g] ?? 1000);
      }, ESPERA_GESTO[0] + Math.random() * (ESPERA_GESTO[1] - ESPERA_GESTO[0]));
    };
    siguiente();
    return () => {
      clearTimeout(id);
      setGesto(null);
    };
  }, [enCalma]);

  if (!visible) return null;
  const cont = pasos ? contenedor() : null;
  return (
    <>
      <div
        ref={rincon}
        className="libo-rincon"
        data-variante={variante}
        data-lugar={lugar}
        data-llega={llega || undefined}
        data-oculto={(pasos && pasoVisto !== 'fin') || undefined}
        data-escape-local={abierto ? 'open' : undefined}
      >
        {abierto && (
          <div ref={bocadillo} className="libo-bocadillo" role="dialog" aria-label={hub ? 'Libo: lo de hoy' : 'Libo'} data-hub={hub || undefined} data-todo-hecho={todoHecho || undefined}>
            {hub ? (
              <LoDeHoy
                saludo={(() => {
                  const s = saludoDeHoy({ pendientes: pendientesHoy.length, hechas: mirando ? 0 : hechasHoy.length });
                  if (s)
                    return (
                      <>
                        {s.antes}
                        <b>{s.fuerte}</b>
                        {s.despues}
                      </>
                    );
                  if (mirando) return 'Un momento, que miro lo de hoy.';
                  if (idea ?? deHoy) return idea ? 'Se me ocurre esto:' : 'Hoy no hay nada pendiente. Solo una idea:';
                  return SALUDOS[lugar] ?? SALUDOS.otro;
                })()}
                pendientes={pendientesHoy}
                hechas={hechasHoy}
                cargando={mirando && !datosHoy}
                sugerencia={idea ?? deHoy}
                onIr={alAviso}
                onSugerencia={alSugerencia}
                onCerrar={() => {
                  setAbierto(false);
                  boton.current?.focus({ preventScroll: true });
                }}
              >
                <div className="libo-bocadillo__acciones">
                  {!hayAlgo && !idea && !pendientesHoy.length && (
                    <button type="button" className="libo-btn libo-btn--principal" onClick={() => setIdea(ideaAhora({ candidatas, deHoy, books }))}>
                      ¿Qué hago ahora?
                    </button>
                  )}
                  {guia && (
                    <button type="button" className="libo-btn libo-btn--leve" onClick={() => empezarGuia()}>
                      {cap.repaso}
                    </button>
                  )}
                  {onAjustes && (
                    <button
                      type="button"
                      className="libo-btn libo-btn--leve"
                      onClick={() => {
                        setAbierto(false);
                        onAjustes();
                      }}
                    >
                      Ajustes de Libo
                    </button>
                  )}
                </div>
              </LoDeHoy>
            ) : (
              <>
                <p>
                  <Corazon />
                  {SALUDOS[lugar] ?? SALUDOS.otro}
                </p>
                <div className="libo-bocadillo__acciones">
                  {guia && (
                    <button type="button" className="libo-btn libo-btn--principal" onClick={() => empezarGuia()}>
                      {cap.repaso}
                    </button>
                  )}
                  {onAjustes && (
                    <button
                      type="button"
                      className="libo-btn"
                      onClick={() => {
                        setAbierto(false);
                        onAjustes();
                      }}
                    >
                      Ajustes de Libo
                    </button>
                  )}
                </div>
              </>
            )}
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
          data-gesto={(enCalma && gesto) || undefined}
          onClick={() => {
            // Muchos toques seguidos: se enfada un momento y enseguida se le pasa (sin abrir ni cerrar nada más)
            const ahora = Date.now();
            toques.current = [...toques.current.filter((t) => ahora - t < 2000), ahora];
            if (muchosToques(toques.current, ahora)) {
              toques.current = [];
              setAbierto(false);
              reaccionar('enfado', 'carino');
              return;
            }
            if (!abierto) {
              maullar();
              setIdea(null);
              if (hub) fijar(false);
            }
            setAbierto((v) => !v);
          }}
        >
          <img key={pose} src={poseUrl(pose)} data-pose={pose} alt="" draggable="false" />
          {/* Tiene algo que contarte: el corazón del logo, quieto, junto a su oreja */}
          {hayAlgo && !abierto && (
            <span className="libo-rincon__nota" id="libo-nota">
              <Corazon />
              <span className="libo-sr">Tiene algo que contarte</span>
            </span>
          )}
        </button>
        {/* Su moneda, pegada a su pata y por delante de él */}
        {tickets !== null && <Monedero tickets={tickets} />}
      </div>
      {pasos && cont && createPortal(<Guia pasos={pasos} contexto={contexto} cont={cont} onFin={terminar} onPaso={setPasoVisto} />, cont)}
    </>
  );
}
