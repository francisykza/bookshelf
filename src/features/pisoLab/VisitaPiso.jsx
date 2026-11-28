// La visita en primera persona a otro piso (1.89, SPEC §89). Es la misma habitación 3D, con el piso real de quien vive ahí tal
// como llega del portal. Quien visita y quien vive son dos cuentas distintas: aquí no entra nada de tu biblioteca ni de tu
// piso, no hay Registrar ni Decorar y no se guarda nada. Los libros son solo los que esa persona comparte (`sharedBooks`, con
// los permisos de su rincón); sin libros compartidos, su estantería se ve vacía, nunca rellena con otros.
// 1.164 (Francisco, 28-11-2026: «hay demasiados menús que afean la experiencia. Querría que se viese su piso y que estuviesen
// las opciones bien integradas y orgánicas de dejar un regalo y un post it»; docs/qa/comunidad-visita.md, bloque 2): la
// habitación ocupa la pantalla y todo se toca en ella. Su estantería abre su biblioteca; el libro de su mesa dice qué lee; el
// tablón, sus notas; la puerta, volver. Junto a la puerta, una caja de regalo con lazo (en el suelo) y un post-it en blanco
// (en el marco) abren una nota de papel pequeña, nunca una hoja que tape la habitación. Fuera la tarjeta de datos, los grupos
// de baldas, «Ver de noche» y el botón del tablón.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCommunity } from '../social/hooks/useCommunity';
import { useReaderCorner } from '../social/hooks/useReaderCorner';
import { VisitBookSheet } from '../social/components/VisitBookSheet';
import { ReviewCard } from '../reviews/ReadersPanel';
import { emptyLibraryMemory, PisoLibrary } from './PisoLibrary';
import { currentTitle, sharedBooks } from '../social/visit';
import { ROOM_LIMIT } from './roomSelection';
import { Interior } from './PisoLabPanel';
import { shelfRows } from './shelfLayout';
import { pisoFrom, withDoorAndComputer } from './useMyPiso';
import { cargarExpuestos } from './expuestos';
import { loadVisit } from '../tablon/service';
import { drawBoard } from '../tablon/drawBoard';
import TablonVisita, { DibujoForm, PostItForm } from '../tablon/TablonVisita';
import { VecinoMesa } from '../edificio/VecinoMesa';
import { regaloHechoHoy } from '../edificio/regaloDiario';
import { FACADE_HORA } from '../edificio/facade';
import { useAtras } from '../../hooks/useAtras';

const VACIA = { cover: null, rows: [[], [], []], hidden: [], placed: 0 };
const nada = () => {};
const SIN_COLOCAR = new Set();
// Lejos de los bordes y de la franja de arriba (volver y su nombre)
const MARGEN = 30;
const ARRIBA = 76;
// Al llegar, el nombre de cada objeto asoma unos segundos para que se sepa qué es; luego, solo los objetos
const ETIQUETAS_MS = 4200;

/** La caja de regalo de píxel: cuerpo, tapa, cinta y lazo; cerrada y con su etiqueta si ya regalaste hoy. */
function CajaRegalo({ cerrada }) {
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      <rect x="2" y="7" width="12" height="8" fill="#9c3d34" />
      <rect x="2" y="14" width="12" height="1" fill="#6e2a24" />
      <rect x="1" y="5" width="14" height="3" fill="#c0564a" />
      <rect x="1" y="7" width="14" height="1" fill="#8a352e" />
      <rect x="7" y="5" width="2" height="10" fill="#e6c25c" />
      <rect x="7" y="5" width="1" height="10" fill="#f5dc8c" />
      {cerrada ? (
        <>
          <rect x="5" y="3" width="6" height="2" fill="#e6c25c" />
          <rect x="12" y="9" width="3" height="3" fill="#f3e4bd" />
          <rect x="11" y="9" width="1" height="1" fill="#3a2412" />
        </>
      ) : (
        <>
          <rect x="4" y="2" width="3" height="3" fill="#e6c25c" />
          <rect x="9" y="2" width="3" height="3" fill="#e6c25c" />
          <rect x="5" y="3" width="1" height="1" fill="#9c3d34" />
          <rect x="10" y="3" width="1" height="1" fill="#9c3d34" />
          <rect x="7" y="4" width="2" height="1" fill="#f5dc8c" />
        </>
      )}
    </svg>
  );
}

/** El post-it en blanco, pegado por arriba, con la esquina de abajo levantada. */
function PostItBlanco({ usado }) {
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="12" height="12" fill={usado ? '#d9c98f' : '#f2d36b'} />
      <rect x="2" y="2" width="12" height="2" fill={usado ? '#c8b67a' : '#e2bd4f'} />
      <rect x="11" y="13" width="1" height="1" fill="#b8963a" />
      <rect x="12" y="12" width="1" height="1" fill="#b8963a" />
      <rect x="13" y="12" width="1" height="2" fill="#7a5c24" opacity="0.35" />
      {usado && <rect x="4" y="7" width="7" height="1" fill="#7a6a40" />}
      {usado && <rect x="4" y="9" width="5" height="1" fill="#7a6a40" />}
    </svg>
  );
}

/**
 * `regalo` (desde el portal; null desde la Comunidad, donde no se regala): `{ social, inventory, myRoom, myId, today,
 * onFirmar, onRegalar }`, lo mismo que la mesa del vecino (VecinoMesa.jsx).
 */
export default function VisitaPiso({ vecino, edificio, onVolver, onSin3d, regalo = null }) {
  const community = useCommunity();
  const corner = useReaderCorner(vecino.user_id, community);
  const yawMemory = useRef(0);
  const [biblioteca, setBiblioteca] = useState(false);
  const [ficha, setFicha] = useState(null);
  const memoriaLista = useRef({ ...emptyLibraryMemory(), order: 'shared' });
  const [tablon, setTablon] = useState(false);
  const [visitaTablon, setVisitaTablon] = useState(null);
  const [listo3d, setListo3d] = useState(false);
  const [expuestos, setExpuestos] = useState([]);
  // La nota de papel que se abre al tocar algo: 'regalo', 'postit', 'lectura' o 'estanteria'
  const [nota, setNota] = useState(null);
  const [dibujo, setDibujo] = useState(false);
  const [regalado, setRegalado] = useState(() => Boolean(regalo && regaloHechoHoy(regalo.myId)));
  const [etiquetas, setEtiquetas] = useState(true);
  const apiRef = useRef(null);
  const regaloRef = useRef(null);
  const postitRef = useRef(null);
  const ultimoObjeto = useRef(null);
  // Solo en desarrollo: al salir, las pruebas vuelven a ver tu habitación, que sigue montada debajo
  const previo = useRef(import.meta.env.DEV ? window.__pisoLab : null);
  const onApi = (api) => {
    apiRef.current = api;
    if (import.meta.env.DEV) window.__pisoLab = api ? () => apiRef.current : previo.current;
  };
  const piso = useMemo(
    () => ({ ...pisoFrom(vecino.user_id, { edificio, puerta: vecino.puerta }), id: `visita:${vecino.user_id}`, real: false, propio: false, nombre: `Piso de ${vecino.alias ?? 'tu vecino'}` }),
    [vecino.user_id, vecino.alias, vecino.puerta, edificio],
  );
  const room = useMemo(() => withDoorAndComputer(vecino.room), [vecino.room]);
  const nombre = vecino.alias ?? 'tu vecino';
  const listo = corner.status === 'ready' && corner.data;
  useEffect(() => {
    let off = false;
    cargarExpuestos(vecino.user_id).then((l) => !off && setExpuestos(l));
    return () => {
      off = true;
    };
  }, [vecino.user_id]);
  // Lo que tiene a la vista y lo que decide compartir, nada más; nada se guarda ni se marca por visitarla
  const compartidos = useMemo(() => (listo ? sharedBooks({ ownerId: vecino.user_id, corner: corner.data.corner, collections: corner.data.collections ?? [], expuestos }).all : []), [listo, corner.data, vecino.user_id, expuestos]);
  // En su estantería, los primeros que caben (el modelo y las portadas siguen acotados aunque la biblioteca sea enorme); todos,
  // en su biblioteca, que se abre tocándola
  const shelf = useMemo(() => {
    const books = compartidos.slice(0, ROOM_LIMIT).map((it) => ({ id: it.key, title: it.ref.title, author: it.ref.author, cover: it.ref.cover, status: 'read' }));
    return shelfRows(books, {}) ?? VACIA;
  }, [compartidos]);
  // «Está leyendo» es solo el título que enseña; la portada, únicamente si ese libro también está entre los compartidos
  const titulo = listo ? currentTitle(corner.data.corner) : null;
  const lectura = useMemo(() => {
    if (!titulo) return null;
    const igual = compartidos.find((it) => it.ref.title === titulo);
    return { id: `visita-lectura:${vecino.user_id}`, title: titulo, author: igual?.ref.author ?? '', cover: igual?.ref.cover ?? '', status: 'reading' };
  }, [titulo, compartidos, vecino.user_id]);
  const fichaAbierta = compartidos.find((it) => it.key === ficha) ?? null;
  // La biblioteca actual, con referencias públicas: el primer origen dice por qué está a la vista
  const librosVisita = useMemo(() => compartidos.map((it) => ({ id: it.key, title: it.ref.title, author: it.ref.author, cover: it.ref.cover, origin: it.origins[0] })), [compartidos]);
  const leerTablon = () => loadVisit(vecino.user_id).then(setVisitaTablon, () => setVisitaTablon(null));
  useEffect(() => {
    leerTablon();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vecino.user_id]);
  // En el corcho, solo la copia pública: sin composición compartida, corcho vacío
  useEffect(() => {
    if (!listo3d) return undefined;
    let off = false;
    drawBoard(visitaTablon?.publico?.doc ?? null).then((image) => !off && apiRef.current?.setBoardImage(image));
    return () => {
      off = true;
    };
  }, [listo3d, visitaTablon]);
  useEffect(() => {
    if (!listo3d) return undefined;
    const t = setTimeout(() => setEtiquetas(false), ETIQUETAS_MS);
    return () => clearTimeout(t);
  }, [listo3d]);

  // Hay post-it si el tablón lo acepta (o, sin su migración, el libro de visitas de siempre); hay caja si se viene del portal
  const conPostit = Boolean(visitaTablon || regalo?.social);
  const conRegalo = Boolean(regalo?.social && regalo.inventory && regalo.myRoom);
  const postitUsado = Boolean(visitaTablon?.enviada_hoy);

  // La caja y el post-it siguen a la puerta al girar, sin pasar por React; si la puerta queda fuera, esperan en el borde más
  // cercano (nunca se pierden)
  useEffect(() => {
    if (!listo3d) return undefined;
    const api = apiRef.current;
    if (!api?.doorAnchors) return undefined;
    const poner = (el, p, w, h) => {
      if (!el) return;
      const x = p.delante ? p.x : p.x < w / 2 ? w - MARGEN : MARGEN;
      const y = p.delante ? p.y : h - MARGEN;
      const cx = Math.round(Math.max(MARGEN, Math.min(w - MARGEN, x)));
      const cy = Math.round(Math.max(ARRIBA, Math.min(h - MARGEN, y)));
      el.dataset.borde = cx !== Math.round(x) || cy !== Math.round(y) || !p.delante ? 'si' : 'no';
      el.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
    };
    const place = () => {
      const at = apiRef.current?.doorAnchors();
      if (!at) return;
      poner(regaloRef.current, at.regalo, at.width, at.height);
      poner(postitRef.current, at.postit, at.width, at.height);
      for (const el of [regaloRef.current, postitRef.current]) if (el) el.hidden = at.cerca;
    };
    place();
    api.onFrame(place, 'visita-puerta');
    return () => apiRef.current?.onFrame(null, 'visita-puerta');
  }, [listo3d, conRegalo, conPostit]);

  const abrirNota = (que, desde = null) => {
    ultimoObjeto.current = desde;
    setDibujo(false);
    setNota(que);
  };
  const cerrarNota = () => {
    setNota(null);
    setDibujo(false);
    requestAnimationFrame(() => ultimoObjeto.current?.focus({ preventScroll: true }));
  };
  // Atrás del móvil y Escape cierran de uno en uno (la ficha, la biblioteca, la nota) sin llegar al panel del edificio
  useAtras(Boolean(nota), cerrarNota);
  useAtras(biblioteca && !ficha, () => cerrar());
  useAtras(Boolean(ficha), () => cerrarFicha());
  useEffect(() => {
    if (!biblioteca && !nota) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape' || tablon) return;
      e.stopPropagation();
      if (ficha) cerrarFicha();
      else if (biblioteca) cerrar();
      else cerrarNota();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biblioteca, ficha, nota, tablon]);
  // La lista sigue montada debajo de la ficha: conserva búsqueda y posición, y el foco vuelve al libro
  function cerrarFicha() {
    const abierto = ficha;
    setFicha(null);
    requestAnimationFrame(() => document.querySelector(`.ed-visita3d__lista [data-book="${CSS.escape(abierto)}"]`)?.focus({ preventScroll: true }));
  }
  function cerrar() {
    setBiblioteca(false);
    setFicha(null);
  }
  // Su estantería: su biblioteca si comparte algo; si no (o mientras llega), una nota que lo dice
  const onShelf = () => {
    if (listo && compartidos.length) {
      setNota(null);
      setBiblioteca(true);
    } else abrirNota('estanteria');
  };

  let contenidoNota = null;
  let tituloNota = '';
  if (nota === 'regalo') {
    tituloNota = `Un regalo para ${nombre}`;
    contenidoNota = <VecinoMesa vecino={vecino} social={regalo.social} inventory={regalo.inventory} myRoom={regalo.myRoom} myId={regalo.myId} today={regalo.today} onFirmar={regalo.onFirmar} onRegalar={regalo.onRegalar} solo="regalar" onHecho={() => setRegalado(true)} />;
  } else if (nota === 'postit') {
    tituloNota = dibujo ? `Un dibujo para ${nombre}` : visitaTablon ? `Un post-it para ${nombre}` : `Su libro de visitas`;
    contenidoNota = visitaTablon ? (
      <>
        {dibujo ? <DibujoForm destino={vecino.user_id} alias={nombre} visit={visitaTablon} onSent={leerTablon} /> : <PostItForm destino={vecino.user_id} alias={nombre} visit={visitaTablon} onSent={leerTablon} />}
        {visitaTablon.acepta && !visitaTablon.enviada_hoy && (
          <button type="button" className="ed-visita3d__cambiar" onClick={() => setDibujo((d) => !d)}>
            {dibujo ? 'Mejor, un post-it' : 'O déjale un dibujo'}
          </button>
        )}
      </>
    ) : (
      <VecinoMesa vecino={vecino} social={regalo.social} inventory={regalo.inventory} myRoom={regalo.myRoom} myId={regalo.myId} today={regalo.today} onFirmar={regalo.onFirmar} onRegalar={regalo.onRegalar} solo="libro" />
    );
  } else if (nota === 'lectura') {
    tituloNota = 'En su mesa';
    contenidoNota = <p className="ed-visita3d__texto">{titulo ? <>Está leyendo «{titulo}».</> : 'No comparte su lectura actual.'}</p>;
  } else if (nota === 'estanteria') {
    tituloNota = `La estantería de ${nombre}`;
    contenidoNota =
      corner.status === 'error' ? (
        <p className="ed-visita3d__texto" role="alert">
          No se ha podido cargar lo que comparte.{' '}
          <button type="button" className="ed-visita3d__cambiar" onClick={corner.reload}>
            Reintentar
          </button>
        </p>
      ) : (
        <p className="ed-visita3d__texto" role="status">
          {listo ? `${nombre} aún no ha compartido libros.` : 'Cargando lo que comparte…'}
        </p>
      );
  }

  return (
    <div className="ed-visita3d" data-visita={vecino.user_id}>
      <Interior onBoard={() => visitaTablon && setTablon(true)} onReady={() => setListo3d(true)} piso={piso} room={room} hora={FACADE_HORA} reading={lectura} balda={null} covered={false} leaning={false} listing={false} yawMemory={yawMemory} hint={null} shelfBooks={shelf} onBook={() => abrirNota('lectura')} onShelf={onShelf} onOpenBook={nada} onLost={onSin3d} onApi={onApi} onDesk={nada} onDoor={onVolver} cargando={`Entrando en el piso de ${nombre}…`} />
      {listo3d && (conRegalo || conPostit) && (
        <div className={`ed-visita3d__objetos${etiquetas ? ' is-llegando' : ''}`} inert={nota || biblioteca || tablon ? true : undefined}>
          {conRegalo && (
            <button ref={regaloRef} type="button" className={`ed-visita3d__obj ed-visita3d__obj--regalo${regalado ? ' is-hecho' : ''}`} aria-label={regalado ? `Ya le has hecho tu regalo de hoy a ${nombre}; mañana, otro` : `Dejarle un regalo a ${nombre}`} onClick={(e) => abrirNota('regalo', e.currentTarget)}>
              <CajaRegalo cerrada={regalado} />
              <span className="ed-visita3d__etiqueta" aria-hidden="true">
                {regalado ? 'Mañana, otro' : 'Un regalo'}
              </span>
            </button>
          )}
          {conPostit && (
            <button ref={postitRef} type="button" className={`ed-visita3d__obj ed-visita3d__obj--postit${postitUsado ? ' is-hecho' : ''}`} aria-label={visitaTablon ? `Dejarle un post-it a ${nombre}` : `Firmar el libro de visitas de ${nombre}`} onClick={(e) => abrirNota('postit', e.currentTarget)}>
              <PostItBlanco usado={postitUsado} />
              <span className="ed-visita3d__etiqueta" aria-hidden="true">
                {visitaTablon ? 'Un post-it' : 'Firmar'}
              </span>
            </button>
          )}
        </div>
      )}
      {nota && (
        <section className="ed-visita3d__nota" role="dialog" aria-label={tituloNota} data-nota={nota} data-escape-local="open">
          <header>
            <h3>{tituloNota}</h3>
            <button type="button" className="ed-visita3d__cerrar" onClick={cerrarNota} aria-label="Cerrar la nota">
              <svg viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
                <path d="M1 1h1v1h1v1h2V2h1V1h1v1H6v1H5v2h1v1h1v1H6V6H5V5H3v1H2v1H1V6h1V5h1V3H2V2H1z" fill="currentColor" />
              </svg>
            </button>
          </header>
          <div className="ed-visita3d__notacuerpo">{contenidoNota}</div>
        </section>
      )}
      {tablon && visitaTablon && <TablonVisita ownerId={vecino.user_id} alias={nombre} visit={visitaTablon} onClose={() => setTablon(false)} onSent={leerTablon} />}
      {biblioteca && (
        <div className="reader-visit ed-visita3d__biblioteca" data-escape-local="open">
          <div className="ed-visita3d__lista" inert={ficha ? true : undefined}>
            <PisoLibrary
              books={librosVisita}
              placed={SIN_COLOCAR}
              memory={memoriaLista.current}
              onBack={cerrar}
              onOpen={(book) => setFicha(book.id)}
              visit={{
                title: `Biblioteca de ${nombre}`,
                backLabel: 'Volver a su piso',
                searchLabel: 'Buscar en sus libros',
                empty: `${nombre} aún no ha compartido libros`,
                after: corner.data.reviews.length > 0 && (
                  <section className="reader-visit__reviews ed-visita3d__resenas" aria-label="Reseñas publicadas">
                    <h4>Reseñas publicadas</h4>
                    {corner.data.reviews.map((r) => (
                      <div key={r.id} className="reader-profile__review">
                        {r.work && <p className="social-hand">{r.work.title}</p>}
                        <ReviewCard review={r} author={corner.data.profile} mine={false} />
                      </div>
                    ))}
                  </section>
                ),
              }}
            />
          </div>
          {ficha && <VisitBookSheet item={fichaAbierta} alias={nombre} profile={corner.data.profile} reviews={corner.data.reviews} onBack={cerrarFicha} />}
        </div>
      )}
    </div>
  );
}
