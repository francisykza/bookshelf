// 1.134 · El almacén en el ordenador del piso (encargo de Francisco del 15-11-2026, «Sí, las recomendadas»; plan en
// docs/qa/almacen-ordenador.md). Dos piezas con los mismos datos (`almacenHoy.js`):
// - `AlmacenTarjeta`: la tarjeta «En el almacén» del escritorio, con hasta tres muebles (lo que sigues rebajado, lo nuevo sin ver
//   y las ofertas de hoy);
// - `AlmacenApp`: la pantalla «Almacén» (lo que sigues, ofertas de hoy, nuevo y todo el almacén).
// Tocar un mueble lleva al almacén, delante de él (`onGo(id)`). Las ofertas las decide el servidor; aquí solo se leen. Sin sonidos
// de aviso ni cuentas atrás: «hasta medianoche» o «hasta el domingo», como el almacén.
// 1.135 · Seguir el precio de un mueble con su marcapáginas (en el servidor, `piso_almacen_desear`): si lo rebajan, la «!» roja
// sale una vez por oferta, aquí, en la tarjeta y sobre el monitor del piso. Sin la migración, no se ve ningún marcapáginas.
import { useEffect, useMemo, useRef, useState } from 'react';
import { PortIcon } from '../../../ui/PortIcon';
import { renderThumb } from '../render';
import { ARTICULOS, DE_PASO, EXPOSITORES, SECCIONES } from './almacenLayout';
import { fechaCorta, hastaOferta, monitorPendiente, resumenAlmacen, vistosDelAlmacen } from './almacenAvisos';
import { desear, mensajeDeseo, monitorAvisado, useAlmacenHoy, verAvisos } from './almacenHoy';
import { Marcapaginas } from './Marcapaginas';
import { ROTULO_OFERTA } from './ofertas';
import './almacenOrdenador.css';

const thumbs = new Map();
function thumbOf(id) {
  if (!thumbs.has(id)) {
    try {
      thumbs.set(id, renderThumb(id, EXPOSITORES.find((e) => e.id === id)?.tono ?? 0, 48).toDataURL());
    } catch {
      thumbs.set(id, '');
    }
  }
  return thumbs.get(id);
}

/** El resumen de hoy con lo visto en el dispositivo (se recalcula al cambiar lo visto o lo que sigues). */
function useResumen() {
  const { fase, estado, version, reintentar } = useAlmacenHoy();
  // `version` cambia con lo visto: hay que volver a leerlo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const vistos = useMemo(() => (estado ? vistosDelAlmacen(estado.dia) : null), [estado, version]);
  const r = useMemo(() => (estado ? resumenAlmacen(estado, vistos) : null), [estado, vistos]);
  return { fase, estado, vistos, r, reintentar };
}

/** La «!» roja de lo nuevo y de lo que sigues rebajado (la misma que la del café). */
const Nuevo = () => <i className="pp-alm-nuevo" aria-hidden="true" />;

/** La miniatura del mueble en su marco, con la «!» si hay algo que no has visto. */
function Miniatura({ m }) {
  const src = thumbOf(m.id);
  return (
    <span className="pp-alm-thumb">
      {src && <img src={src} alt="" width="48" height="48" draggable="false" />}
      {m.sinVer && <Nuevo />}
    </span>
  );
}

/** La etiqueta de precio, como las del directorio del almacén: el de siempre tachado y el de hoy. */
function Etiqueta({ m }) {
  return (
    <span className="pp-alm-precio" data-oferta={m.oferta?.tipo} aria-hidden="true">
      {m.oferta && <s>{m.precio}</s>}
      <b>{m.hoy}</b>
      <small>Libocoins</small>
    </span>
  );
}

/** Lo que se dice de un mueble para los lectores de pantalla. */
const etiquetaDe = (m, extra = '') => `${m.nombre}${extra ? `, ${extra}` : ''}: ${m.hoy} Libocoins${m.oferta ? `, antes ${m.precio}` : ''}. Verlo en el almacén`;

/** Una línea bajo el nombre. */
function detalle(m, estado, cual) {
  // El número y su «%» van juntos (espacio sin corte): a 360 px se partía en «−50 / %»
  const oferta = m.oferta ? `${ROTULO_OFERTA[m.oferta.tipo]} · −${m.oferta.pct} % · ${hastaOferta(m.oferta.tipo, estado)}` : '';
  if (cual === 'nuevo') return `Nuevo · llegó el ${fechaCorta(m.llega)}${m.oferta ? ` · −${m.oferta.pct} %` : ''}`;
  if (cual === 'sigues') return oferta || 'Sin oferta hoy';
  if (oferta) return oferta;
  if (m.especial) return 'No se rebaja nunca';
  return '';
}

// El cartel del almacén: el poste del directorio con sus tres flechas (los mismos colores que el del almacén)
const POSTE = [
  [7, 1, 2, 14, '#a8743a'],
  [3, 2, 10, 3, '#5a8f88'],
  [4, 6, 10, 3, '#b8624a'],
  [2, 10, 10, 3, '#cc9e46'],
  [12, 3, 2, 1, '#f6ecd8'],
  [2, 7, 2, 1, '#f6ecd8'],
];
const Poste = () => (
  <svg className="pp-alm__poste" viewBox="0 0 16 16" width="48" height="48" shapeRendering="crispEdges" aria-hidden="true">
    {POSTE.map(([x, y, w, h, c]) => (
      <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} fill={c} />
    ))}
  </svg>
);

// Las chapas de las secciones, dibujadas en píxeles (la letra Puerto Pixel no tiene «%» y la estrella en trazo se veía como una mancha)
// El «%»: dos puntos y la diagonal en escalera
const PORCIENTO = [
  [0, 0, 2, 2],
  [6, 6, 2, 2],
  [7, 0, 1, 1],
  [6, 1, 1, 1],
  [5, 2, 1, 1],
  [4, 3, 1, 1],
  [3, 4, 1, 1],
  [2, 5, 1, 1],
  [1, 6, 1, 1],
  [0, 7, 1, 1],
];
// La estrella de cinco puntas de lo nuevo
const ESTRELLA = [
  [4, 0, 1, 2],
  [3, 2, 3, 1],
  [0, 3, 9, 1],
  [1, 4, 7, 1],
  [2, 5, 5, 2],
  [1, 7, 2, 1],
  [6, 7, 2, 1],
  [1, 8, 1, 1],
  [7, 8, 1, 1],
];
const Pixeles = ({ celdas, lado }) => (
  <svg viewBox={`0 0 ${lado} ${lado}`} width={lado * 2} height={lado * 2} shapeRendering="crispEdges">
    {celdas.map(([x, y, w, h]) => (
      <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} fill="currentColor" />
    ))}
  </svg>
);

/** Seguir o dejar de seguir su precio. */
function Seguir({ m, onSeguir }) {
  return (
    <button
      type="button"
      className="pp-alm__seguir"
      aria-pressed={m.sigo}
      aria-label={m.sigo ? `Dejar de seguir el precio de ${m.nombre}` : `Seguir el precio de ${m.nombre}`}
      data-name={`seguir:${m.id}`}
      onClick={() => onSeguir(m)}
    >
      <Marcapaginas lleno={m.sigo} />
    </button>
  );
}

/** Lo que dice la tarjeta bajo el nombre. */
const MOTIVO = { sigues: 'Lo sigues', nuevo: 'Nuevo' };

/**
 * La tarjeta «En el almacén» del escritorio. `onGo(id)`: al almacén, delante de ese mueble; `onOpen()`: la pantalla «Almacén».
 * Sin conexión, sin la migración del almacén o sin nada que enseñar, no sale. Al verla, la «!» del monitor del piso se apaga.
 */
export function AlmacenTarjeta({ onGo, onOpen }) {
  const { fase, vistos, r } = useResumen();
  useEffect(() => {
    if (r && monitorPendiente(r, vistos)) monitorAvisado(r);
  }, [r, vistos]);
  if (fase !== 'listo' || !r || !r.tarjeta.length) return null;
  const hay = r.sinVer.size > 0 || r.ofertasSinVer.length > 0;
  return (
    <section className="pp-reading pp-alm-card" aria-labelledby="pp-alm-card-title">
      <h3 id="pp-alm-card-title">
        En el almacén
        {hay && (
          <>
            <Nuevo />
            <span className="pp-sr"> (hay avisos)</span>
          </>
        )}
      </h3>
      <ul className="pp-alm-card__list">
        {r.tarjeta.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              data-name={`almacen:${m.id}`}
              aria-label={etiquetaDe(
                m,
                m.motivo === 'oferta' ? ROTULO_OFERTA[m.oferta.tipo].toLowerCase() : m.motivo === 'sigues' ? `lo sigues, ${ROTULO_OFERTA[m.oferta.tipo].toLowerCase()}` : 'nuevo',
              )}
              onClick={() => {
                if (m.sinVer) verAvisos(r.sinVer.has(m.id) ? [m.id] : [], r.dia, m.clave && r.ofertasSinVer.includes(m.clave) ? [m.clave] : []);
                onGo(m.id);
              }}
            >
              <Miniatura m={m} />
              <b className="pp-alm-card__nombre">{m.nombre}</b>
              <small>{MOTIVO[m.motivo] ?? (m.oferta.tipo === 'semana' ? 'De la semana' : 'Del día')}</small>
              <Etiqueta m={m} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="pp-alm-card__all" data-name="Ver el almacén" onClick={onOpen}>
        Ver el almacén
        <PortIcon name="flecha" />
      </button>
    </section>
  );
}

/** Lo que avisa, en el cajón «Aplicaciones»: lo que sigues rebajado y, si no, lo nuevo sin ver. */
export function AlmacenNota() {
  const { fase, r } = useResumen();
  if (fase !== 'listo' || !r) return null;
  const rebajados = r.ofertasSinVer.length;
  if (rebajados) return <small>{rebajados === 1 ? '1 que sigues, rebajado' : `${rebajados} que sigues, rebajados`}</small>;
  if (r.sinVer.size) return <small>{r.sinVer.size === 1 ? '1 mueble nuevo' : `${r.sinVer.size} muebles nuevos`}</small>;
  return null;
}

function Fila({ m, estado, cual, onGo, onSeguir }) {
  return (
    <li className="pp-alm__item">
      <button type="button" className="pp-alm__fila" aria-label={etiquetaDe(m, detalle(m, estado, cual))} onClick={() => onGo(m.id)}>
        <Miniatura m={m} />
        <span className="pp-alm__txt">
          <b>{m.nombre}</b>
          {detalle(m, estado, cual) && <small>{detalle(m, estado, cual)}</small>}
        </span>
        <Etiqueta m={m} />
      </button>
      {/* Lo de las habitaciones especiales no se sigue (nunca se rebaja): su hueco, vacío, para que las columnas cuadren */}
      {onSeguir && (m.especial ? <span className="pp-alm__seguir pp-alm__seguir--no" aria-hidden="true" /> : <Seguir m={m} onSeguir={onSeguir} />)}
    </li>
  );
}

/** Una sección de la pantalla, con su chapa. */
function Seccion({ id, chapa, clase = '', titulo, children }) {
  return (
    <section className="pp-alm__seccion" aria-labelledby={id}>
      <h4 id={id}>
        <span className={`pp-alm__chapa ${clase}`} aria-hidden="true">
          {chapa}
        </span>
        {titulo}
      </h4>
      {children}
    </section>
  );
}

/** La pantalla «Almacén» del ordenador. `onGo(id)`: al almacén, delante de ese mueble. */
export function AlmacenApp({ onGo }) {
  const { fase, estado, reintentar } = useResumen();
  // Lo que no habías visto lleva su «!» mientras estás aquí; al abrir la pantalla ya cuenta como visto
  const [vistos, setVistos] = useState(null);
  // Una sola vez por pantalla (el efecto puede repetirse sin desmontarse: lo ya marcado no debe quitar la «!» de esta vista)
  const leido = useRef(false);
  useEffect(() => {
    if (!estado || leido.current) return;
    leido.current = true;
    const ya = vistosDelAlmacen(estado.dia);
    setVistos(ya);
    const r = resumenAlmacen(estado, ya);
    if (r) {
      verAvisos([...r.sinVer], estado.dia, r.ofertasSinVer);
      monitorAvisado(r);
    }
  }, [estado]);
  // Lo de ahora (lo que sigues cambia al tocar un marcapáginas) con la «!» de cuando se abrió
  const r = useMemo(() => (estado && vistos ? resumenAlmacen(estado, vistos) : null), [estado, vistos]);
  const [nota, setNota] = useState('');
  useEffect(() => {
    if (!nota) return undefined;
    const t = setTimeout(() => setNota(''), 4000);
    return () => clearTimeout(t);
  }, [nota]);

  if (fase === 'cargando' || (fase === 'listo' && !r)) return <p className="pp-alm__nota">Mirando el almacén…</p>;
  if (fase !== 'listo') {
    return (
      <div className="pp-alm__nota" role="status">
        <p>No se ha podido ver el almacén ahora. Comprueba la conexión.</p>
        <button type="button" className="pp-btn" onClick={reintentar}>
          Reintentar
        </button>
      </div>
    );
  }

  const seguir = r.deseables
    ? async (m) => {
        const quiere = !m.sigo;
        setNota('');
        // Lo sigues mientras lo ves rebajado: esa oferta ya está vista
        if (quiere && m.clave) {
          verAvisos([], r.dia, [m.clave]);
          setVistos((v) => ({ ...v, ofertas: [...(v?.ofertas ?? []), m.clave] }));
        }
        try {
          await desear(m.id, quiere);
          setNota(quiere ? `Sigues el precio de ${m.nombre}: si lo rebajan, te avisará.` : `Ya no sigues ${m.nombre}.`);
        } catch (e) {
          setNota(mensajeDeseo(e));
        }
      }
    : null;
  // Lo que sigues: lo rebajado primero
  const sigues = [...r.rebajados, ...r.deseados.filter((m) => !m.oferta)];
  const secciones = SECCIONES.filter((s) => !DE_PASO.has(s.id));
  return (
    <div className="pp-alm">
      <header className="pp-alm__head">
        <Poste />
        <div>
          <h3>El Almacén del Puerto</h3>
          <p>{r.tickets != null ? `Tienes ${r.tickets} Libocoins. Toca un mueble para verlo allí.` : 'Toca un mueble para verlo allí.'}</p>
        </div>
      </header>

      {r.deseables && (
        <Seccion id="pp-alm-sigues" chapa={<Marcapaginas lleno escala={2} />} clase="pp-alm__chapa--sigues" titulo="Lo que sigues">
          {sigues.length ? (
            <ul className="pp-alm__filas">
              {sigues.map((m) => (
                <Fila key={m.id} m={m} estado={estado} cual="sigues" onGo={onGo} onSeguir={seguir} />
              ))}
            </ul>
          ) : (
            <p className="pp-alm__vacio">
              Toca el marcapáginas <Marcapaginas escala={1.5} /> de un mueble para seguir su precio: cuando lo rebajen, te avisará aquí y en el escritorio.
            </p>
          )}
        </Seccion>
      )}

      <Seccion id="pp-alm-ofertas" chapa={<Pixeles celdas={PORCIENTO} lado={8} />} titulo="Ofertas de hoy">
        {r.ofertas.length ? (
          <ul className="pp-alm__filas">
            {r.ofertas.map((m) => (
              <Fila key={m.id} m={m} estado={estado} cual="oferta" onGo={onGo} onSeguir={seguir} />
            ))}
          </ul>
        ) : (
          <p className="pp-alm__vacio">Hoy no hay ofertas.</p>
        )}
      </Seccion>

      <Seccion id="pp-alm-nuevo" chapa={<Pixeles celdas={ESTRELLA} lado={9} />} clase="pp-alm__chapa--nuevo" titulo="Nuevo en el almacén">
        {r.nuevos.length ? (
          <ul className="pp-alm__filas">
            {r.nuevos.map((m) => (
              <Fila key={m.id} m={m} estado={estado} cual="nuevo" onGo={onGo} onSeguir={seguir} />
            ))}
          </ul>
        ) : (
          <p className="pp-alm__vacio">Nada nuevo en el último mes.</p>
        )}
      </Seccion>

      <Seccion id="pp-alm-todo" chapa={<PortIcon name="etiqueta" size={24} />} clase="pp-alm__chapa--todo" titulo="Todo el almacén">
        {secciones.map((s) => {
          // Cada mueble, en la sección de su expositor principal (como en el directorio)
          const de = r.todos.filter((m) => EXPOSITORES[ARTICULOS.find((a) => a.id === m.id)?.expositor]?.seccion === s.id);
          if (!de.length) return null;
          return (
            <div key={s.id} className="pp-alm__pasillo">
              <h5>
                {s.nombre} <small>{s.donde}</small>
              </h5>
              <ul className="pp-alm__filas">
                {de.map((m) => (
                  <Fila key={m.id} m={m} estado={estado} cual="todo" onGo={onGo} onSeguir={seguir} />
                ))}
              </ul>
            </div>
          );
        })}
      </Seccion>

      <p className={nota ? 'pp-alm__aviso is-on' : 'pp-alm__aviso'} role="status" aria-live="polite">
        {nota}
      </p>
    </div>
  );
}
