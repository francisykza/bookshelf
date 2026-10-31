// Visita al rincón de una persona que sigues (SPEC §56, revisada en la 1.58.1). Al abrirla empieza directamente la
// entrada en vídeo (casa → ventana → habitación) y, al terminar, la habitación interactiva con los libros que esa persona
// ha decidido compartir. Sin preguntas previas ni opciones de animación: solo una flecha discreta para volver. Con
// movimiento reducido, o si el vídeo falla, no arranca o se queda parado, se entra directamente en la habitación.
// Casa, vídeo y habitación son capas de UNA sola escena que no se desmonta entre etapas (mismo encuadre, sin parpadeos):
// el último fotograma se queda a la vista hasta que la habitación está decodificada. Etapas en el historial:
// habitación → libros/libro (Atrás y Escape cierran de uno en uno); la entrada sustituye su entrada de historial, así que
// volver desde la habitación lleva al origen y recargar no repite el vídeo.
// 1.59 (SPEC §59.6): nunca una pantalla oscura. Hasta que la primera imagen (casa o habitación) está decodificada, la
// visita no tapa lo que había (la escena anterior sigue a la vista); el vídeo lleva la casa como póster y solo se
// muestra cuando el navegador ha presentado su primer fotograma.
// 1.61 (SPEC §61): un solo acceso a cada cosa. La flecha para volver, el avatar con el alias (abre el perfil), la
// estantería con su etiqueta «Libros compartidos ›» (abre «Los libros de X») y, si lo enseña, lo que está leyendo como un
// libro pequeño sobre la mesita. Sin botonera inferior ni cartel grande con el título.
// 1.62 (SPEC §62.2, decisión de Francisco): ya no arranca sola. Primero la fachada con el nombre y el avatar de la persona;
// se entra tocando la ventana inferior derecha (la única que recorre el vídeo) o «Entrar al rincón». Durante el vídeo,
// «Salir» y «Saltar»; al terminar no se repite. Movimiento reducido o ahorro de datos: directo a la habitación (y un
// error del vídeo también lleva dentro). Volver lleva al origen: «Volver al salón» o «Volver a lectores». El vídeo no se
// pide hasta que se decide entrar.
import { ArrowLeft, ArrowRight, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { PanelShell } from '../../../components/panels/PanelShell';
import { avatarById } from '../../../domain/avatars';
import { spineColor } from '../../../domain/books';
import { PhysicalBook } from '../../../components/shelf/BookItem';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useLibrary } from '../../../state/useLibrary';
import { useCommunity } from '../hooks/useCommunity';
import { useReaderCorner } from '../hooks/useReaderCorner';
import { SCENES, sceneOf } from '../huellas';
import { currentTitle, sharedBooks } from '../visit';
import { HOUSE_WINDOW, ROOM_SHELF, SHELF_TAG, TABLE_BOOK, TABLE_TAG, VISIT_H, VISIT_MEDIA, VISIT_W, shelfSpines } from '../visitScene';
import { SharedLibrary, VisitBookSheet } from './VisitBookSheet';

/** Espera máxima a que el vídeo empiece a moverse; y a que avance si se queda parado. Después, la habitación. */
const START_LIMIT = 6000;
const STALL_LIMIT = 4000;
/** Si la primera imagen tarda más, la visita se muestra igualmente (con su fondo): nunca se espera indefinidamente. */
const SHOW_LIMIT = 1500;

const pct = (v) => `${(v * 100).toFixed(3)}%`;
const zone = (z) => ({ left: pct(z.x0), top: pct(z.y0), width: pct(z.x1 - z.x0), height: pct(z.y1 - z.y0) });

/** Decodifica una imagen antes de mostrarla (sin bloquear si el navegador no sabe decodificar por adelantado). */
function decodeImage(src) {
  const img = new Image();
  img.src = src;
  return (img.decode ? img.decode() : Promise.resolve()).catch(() => {});
}

/** Texto de volver según de dónde se abrió la visita. */
const backText = (from) => (from === 'salon' ? 'Volver al salón' : from === 'lectores' ? 'Volver a lectores' : 'Volver');

export function ReaderVisit({ userId, stage, select, from = null, onEnter, onSelect, onBack, onProfile }) {
  const community = useCommunity({ autoload: true });
  const { state } = useLibrary();
  const reduced = useReducedMotion();
  // Ahorro de datos del navegador: sin vídeo, directo a la habitación (como con movimiento reducido)
  const [saveData] = useState(() => typeof navigator !== 'undefined' && navigator.connection?.saveData === true);
  const direct = reduced || saveData;
  const corner = useReaderCorner(userId, community);
  const data = corner.data;
  const alias = data?.profile?.alias ?? '';
  const shared = useMemo(() => (data ? sharedBooks({ ownerId: userId, corner: data.corner, collections: data.collections }) : { featured: [], all: [] }), [data, userId]);
  const ready = corner.status === 'ready' && Boolean(data?.profile);
  // Lo que «Ver perfil» pintará primero (su rincón ilustrado y su avatar) se adelanta: el perfil no llega por fases
  useEffect(() => {
    if (!ready) return;
    const art = [avatarById(data.profile.avatar_id)?.image, data.corner?.visible ? `${SCENES[sceneOf(data.corner.scene)].src}-768.webp` : null];
    for (const src of art.filter(Boolean)) {
      const img = new Image();
      img.src = src;
    }
  }, [ready, data]);
  // Fase de la entrada (solo en la etapa «casa»): espera (o preparando, si ya hay vídeo) → entrando → fin
  const [phase, setPhase] = useState('espera');
  const [roomShown, setRoomShown] = useState(stage === 'habitacion');
  const videoRef = useRef(null);
  const done = useRef(stage === 'habitacion');
  // La visita se pinta cuando su primera imagen ya está decodificada (antes, se ve la escena de la que se viene)
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let alive = true;
    const show = () => alive && setShown(true);
    const limit = setTimeout(show, SHOW_LIMIT);
    decodeImage(stage === 'habitacion' || direct ? VISIT_MEDIA.room : VISIT_MEDIA.house).then(show);
    return () => {
      alive = false;
      clearTimeout(limit);
    };
    // Solo la primera imagen de esta visita
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Montada de verdad (StrictMode monta, desmonta y vuelve a montar: no basta con marcar «hecho» al desmontar)
  const alive = useRef(false);

  /**
   * Mostrar la habitación (una sola vez) cuando su imagen ya está lista. El último fotograma se funde con ella (220 ms;
   * el vídeo y la ilustración solo difieren en tono y compresión) y después se suelta el vídeo.
   */
  const finish = () => {
    if (done.current) return;
    done.current = true;
    decodeImage(VISIT_MEDIA.room).then(() => {
      if (!alive.current) return;
      setRoomShown(true);
      // Sin vídeo montado (movimiento reducido) no hay fundido: nunca se monta ni se pide el vídeo por llegar aquí
      const fading = Boolean(videoRef.current);
      setPhase(fading ? 'saliendo' : 'fin');
      onEnter();
      if (!fading) return;
      setTimeout(() => {
        const v = videoRef.current;
        if (v) {
          v.pause();
          v.removeAttribute('src');
          v.load();
        }
        if (alive.current) setPhase('fin');
      }, 260);
    });
  };

  // Movimiento reducido o ahorro de datos: directamente a la habitación (también si el perfil aún carga: allí se indica)
  useEffect(() => {
    if (stage === 'casa' && direct) finish();
    // finish es estable para esta visita
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, direct]);

  // La entrada empieza cuando se decide entrar (ventana o «Entrar al rincón») y se sabe que el rincón existe
  const [entering, setEntering] = useState(false);
  const play = stage === 'casa' && !direct && ready && entering && phase === 'espera';
  const facade = stage === 'casa' && !direct && !entering && phase === 'espera';
  const playing = play || phase === 'entrando' || phase === 'saliendo';
  // Depende solo de que la entrada haya empezado: pasar de «preparando» a «entrando» no suelta los escuchadores
  useEffect(() => {
    if (!playing) return undefined;
    const v = videoRef.current;
    if (!v) return undefined;
    decodeImage(VISIT_MEDIA.room);
    let over = false;
    let stall = null;
    const fallback = () => {
      if (over) return;
      over = true;
      finish();
    };
    const start = setTimeout(fallback, START_LIMIT);
    // Si deja de avanzar (red, decodificador), no se espera indefinidamente
    const watch = () => {
      clearTimeout(stall);
      stall = setTimeout(fallback, STALL_LIMIT);
    };
    // El vídeo se enseña con su primer fotograma ya presentado (antes, la casa: también es su póster)
    const onPlaying = () => {
      clearTimeout(start);
      watch();
      if (typeof v.requestVideoFrameCallback === 'function') v.requestVideoFrameCallback(() => !over && setPhase('entrando'));
      else setPhase('entrando');
    };
    const onEnded = () => {
      over = true;
      clearTimeout(start);
      clearTimeout(stall);
      finish();
    };
    v.addEventListener('playing', onPlaying);
    v.addEventListener('timeupdate', watch);
    v.addEventListener('ended', onEnded);
    v.addEventListener('error', fallback);
    v.src = VISIT_MEDIA.video;
    const p = v.play();
    if (p?.catch) p.catch(fallback);
    // Pestaña oculta: se pausa; al volver sigue, sin repetir la entrada
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(stall);
        v.pause();
      } else if (!over) {
        watch();
        v.play().catch(fallback);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      over = true;
      clearTimeout(start);
      clearTimeout(stall);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('timeupdate', watch);
      v.removeEventListener('ended', onEnded);
      v.removeEventListener('error', fallback);
      document.removeEventListener('visibilitychange', onVis);
    };
    // finish es estable para esta visita
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Al salir (Atrás, Escape, otra pantalla): el vídeo se suelta
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      const v = videoRef.current;
      if (!v) return;
      v.pause();
      v.removeAttribute('src');
      v.load();
    };
  }, []);

  const inRoom = stage === 'habitacion' && roomShown;
  // Durante el vídeo, «Salir»; antes y después, volver a donde se estaba
  const backLabel = playing ? 'Salir' : backText(from);
  const reading = ready ? currentTitle(data.corner) : null;
  // Qué hay abierto encima de la habitación: «libros», «libros/clave» (un libro desde sus libros), «leyendo» o una clave
  const inLibrary = select === 'libros' || (typeof select === 'string' && select.startsWith('libros/'));
  const bookKey = inLibrary && select !== 'libros' ? select.slice('libros/'.length) : null;
  const readingItem = reading ? { key: 'leyendo', ref: { id: null, title: reading, author: '', cover: '' }, origins: ['Está leyendo'], phrase: '' } : null;

  return (
    <PanelShell onClose={onBack} label={alias ? `Visita al rincón de ${alias}` : 'Visita a un rincón'} variant="visit">
      <div className="reader-visit" data-shown={shown || undefined} data-stage={inRoom ? 'habitacion' : 'casa'} data-phase={facade ? 'fachada' : play ? 'preparando' : phase} data-guides={state.settings.showGuides ? 'on' : 'off'} data-reduced={reduced || undefined}>
        <Scene layer={roomShown || direct ? 'room' : phase === 'entrando' ? 'video' : 'house'} playing={playing} videoRef={videoRef}>
          {facade && <Window alias={alias} ready={ready} onEnter={() => setEntering(true)} />}
          {inRoom && ready && <Shelf alias={alias} shared={shared} reduced={reduced} onSelect={onSelect} />}
          {inRoom && ready && reading && <TableBook title={reading} onOpen={() => onSelect('leyendo')} />}
        </Scene>
        <header className="reader-visit__bar">
          <button type="button" className="reader-visit__icon reader-visit__leave" onClick={onBack}>
            <ArrowLeft aria-hidden="true" />
            <span>{backLabel}</span>
          </button>
          {inRoom && <Who data={data} alias={alias} onProfile={ready ? onProfile : null} />}
          {!inRoom && <Who data={data} alias={alias} house />}
        </header>
        {inRoom ? (
          <RoomFoot data={data} status={corner.status} failure={corner.failure} reload={corner.reload} shared={shared} onBack={onBack} />
        ) : corner.status === 'error' || (corner.status === 'ready' && !data?.profile) ? (
          <footer className="reader-visit__foot">
            <VisitStatus status={corner.status} data={data} failure={corner.failure} reload={corner.reload} onBack={onBack} />
          </footer>
        ) : (
          // Durante el vídeo, «Saltar» lleva directo a la habitación; en la fachada solo se avisa de que se podrá
          (facade || playing) && (
            <footer className="reader-visit__foot">
              {playing ? (
                <button type="button" className="reader-visit__skip" onClick={finish}>
                  Saltar
                </button>
              ) : (
                <p className="reader-visit__hint">Puedes saltar la animación</p>
              )}
            </footer>
          )
        )}
        {/* «Los libros de X» sigue montada bajo la ficha de un libro: al cerrarla, la búsqueda y la posición siguen ahí */}
        {inRoom && ready && inLibrary && <SharedLibrary items={shared.all} alias={alias} profile={data.profile} reviews={data.reviews} openKey={bookKey} onOpenBook={(key) => onSelect(`libros/${key}`)} onBack={onBack} />}
        {inRoom && ready && bookKey && <VisitBookSheet item={shared.all.find((it) => it.key === bookKey) ?? null} alias={alias} profile={data.profile} reviews={data.reviews} onBack={onBack} />}
        {inRoom && ready && select === 'leyendo' && <VisitBookSheet item={readingItem} alias={alias} profile={data.profile} reviews={data.reviews} onBack={onBack} backLabel="Volver a su rincón" />}
        {inRoom && ready && select && !inLibrary && select !== 'leyendo' && (
          <VisitBookSheet item={shared.all.find((it) => it.key === select) ?? null} alias={alias} profile={data.profile} reviews={data.reviews} onBack={onBack} backLabel="Volver a su rincón" />
        )}
      </div>
    </PanelShell>
  );
}

/**
 * Escena a sangre: los tres recursos comparten encuadre (720 × 1280) y la misma caja, que cubre la pantalla en vertical
 * (recorte lateral con el mueble de libros a la vista) y se contiene sobre un fondo desenfocado en pantallas anchas.
 * Las capas no se desmontan entre etapas: solo cambian de visibilidad.
 */
function Scene({ layer, playing, videoRef, children }) {
  return (
    <div className="reader-visit__stage" data-layer={layer}>
      <div className="reader-visit__backdrop" aria-hidden="true">
        <img src={VISIT_MEDIA.house} alt="" data-on={layer !== 'room' || undefined} />
        <img src={VISIT_MEDIA.room} alt="" data-on={layer === 'room' || undefined} loading="lazy" />
      </div>
      <div className="reader-visit__frame">
        <img className="reader-visit__bg" data-on src={VISIT_MEDIA.house} alt="" width={VISIT_W} height={VISIT_H} decoding="async" />
        {/* La habitación se prepara bajo el vídeo: en el relevo ya está pintada y sustituye al último fotograma sin hueco */}
        {(playing || layer === 'room') && <img className="reader-visit__bg" data-on={layer === 'room' || undefined} src={VISIT_MEDIA.room} alt="" width={VISIT_W} height={VISIT_H} decoding="async" />}
        {playing && <video ref={videoRef} className="reader-visit__video" data-on={layer === 'video' || undefined} poster={VISIT_MEDIA.house} preload="none" muted playsInline disablePictureInPicture disableRemotePlayback aria-hidden="true" tabIndex={-1} />}
        {children}
      </div>
    </div>
  );
}

/**
 * El único acceso al perfil: avatar, alias y una flecha discreta (mientras carga, solo se ve, no se pulsa). Ante la casa,
 * solo identifica de quién es: «El rincón de X».
 */
function Who({ data, alias, onProfile = null, house = false }) {
  if (!data?.profile) return null;
  const inner = (
    <>
      <ReaderAvatar avatarId={data.profile.avatar_id} alias={alias} size="list" decorative />
      {house ? (
        <b className="reader-visit__who-house">
          El rincón <span>de {alias}</span>
        </b>
      ) : (
        <b>{alias}</b>
      )}
      {onProfile && <ChevronRight aria-hidden="true" className="reader-visit__who-go" />}
    </>
  );
  return onProfile ? (
    <button type="button" className="reader-visit__who" onClick={onProfile} aria-label={`Ver el perfil de ${alias}`}>
      {inner}
    </button>
  ) : (
    <span className="reader-visit__who">{inner}</span>
  );
}

/**
 * La ventana inferior derecha de la casa (la única que recorre el vídeo) y «Entrar al rincón» justo debajo. Tocar la
 * ventana es un atajo de puntero; el control accesible es el botón. Mientras el rincón carga, se espera sin vídeo.
 */
function Window({ alias, ready, onEnter }) {
  const cx = (HOUSE_WINDOW.x0 + HOUSE_WINDOW.x1) / 2;
  return (
    <>
      <button type="button" className="reader-visit__window" style={zone(HOUSE_WINDOW)} onClick={onEnter} disabled={!ready} tabIndex={-1} aria-hidden="true" />
      <button type="button" className="reader-visit__enter" style={{ left: pct(cx), top: pct(HOUSE_WINDOW.y1 + 0.018) }} onClick={onEnter} disabled={!ready} aria-label={alias ? `Entrar al rincón de ${alias}` : 'Entrar al rincón'}>
        {ready ? 'Entrar al rincón' : 'Abriendo su rincón…'}
        {ready && <ArrowRight aria-hidden="true" />}
      </button>
    </>
  );
}

/**
 * Lo que está leyendo, como un libro pequeño de pie sobre la mesita (solo el título publicado: cubierta tipográfica
 * neutra, sin edición, páginas ni porcentaje). Libro, etiqueta y zona táctil (≥ 44 px) en las coordenadas de la escena.
 */
function TableBook({ title, onOpen }) {
  const at = (x, y) => ({ left: pct(x / VISIT_W), top: pct(y / VISIT_H) });
  return (
    <button type="button" className="reader-visit__table" style={{ ...at(TABLE_BOOK.x, TABLE_BOOK.base - TABLE_BOOK.h), width: pct(TABLE_BOOK.w / VISIT_W), height: pct(TABLE_BOOK.h / VISIT_H) }} onClick={onOpen} aria-label={`Está leyendo «${title}»`}>
      <span className="reader-visit__table-book" aria-hidden="true">
        <PhysicalBook book={{ id: `leyendo:${title}`, title, author: '', cover: '', editionType: 'hardcover' }} variant="corner" />
      </span>
      <span className="reader-visit__table-tag" style={{ left: pct((TABLE_TAG.x - TABLE_BOOK.x) / TABLE_BOOK.w), top: pct((TABLE_TAG.y - TABLE_BOOK.base + TABLE_BOOK.h) / TABLE_BOOK.h) }} aria-hidden="true">
        Está leyendo
      </span>
    </button>
  );
}

/** Estados honestos de la carga: comunidad no lista, cargando, perfil no disponible o error. */
function VisitStatus({ status, data, failure, reload, onBack }) {
  if (status === 'waiting') return <p className="reader-visit__lead">Conectando con la comunidad…</p>;
  if (status === 'loading') return <p className="reader-visit__lead">Abriendo su rincón…</p>;
  if (status === 'error')
    return (
      <div className="reader-visit__status" role="alert">
        <p>No se ha podido abrir este rincón ahora mismo{failure ? ` (${failure})` : ''}.</p>
        {reload && (
          <button type="button" className="sheet-btn" onClick={reload}>
            Reintentar
          </button>
        )}
        <button type="button" className="link-btn" onClick={onBack}>
          Volver
        </button>
      </div>
    );
  if (!data?.profile)
    return (
      <div className="reader-visit__status" role="status">
        <p>Este rincón no está disponible.</p>
        <button type="button" className="link-btn" onClick={onBack}>
          Volver
        </button>
      </div>
    );
  return null;
}

// ── Habitación ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Lomos de lo compartido sobre las baldas pintadas (decorativos) y la zona tocable del mueble. */
function Shelf({ alias, shared, reduced, onSelect }) {
  const [settled, setSettled] = useState(reduced);
  const spines = shelfSpines(shared.all.length);
  // Los libros aparecen cuando la habitación ya está quieta: breve y discreto (inmediato con movimiento reducido)
  useEffect(() => {
    if (reduced) return undefined;
    const id = setTimeout(() => setSettled(true), 60);
    return () => clearTimeout(id);
  }, [reduced]);
  return (
    <>
      {spines.length > 0 && (
        <svg className="reader-visit__spines" data-shown={settled || undefined} viewBox={`0 0 ${VISIT_W} ${VISIT_H}`} preserveAspectRatio="none" aria-hidden="true">
          {spines.map((s, i) => {
            const b = shared.all[i].ref;
            const [p0, p1, p2, p3] = s.points;
            // Lomo con su canto y una banda alta discreta (nada de brillos): un libro, no una tarjeta
            const band = (k) => [p3[0], p3[1] + (p0[1] - p3[1]) * k, p2[0], p2[1] + (p1[1] - p2[1]) * k];
            const [a1, b1, c1, d1] = band(0.12);
            const [a2, b2, c2, d2] = band(0.16);
            return (
              <g key={shared.all[i].key}>
                <polygon points={s.points.map((p) => p.join(',')).join(' ')} fill={spineColor({ title: b.title, author: b.author })} stroke="rgba(44, 30, 20, 0.45)" strokeWidth="1.2" />
                <polygon points={`${a1},${b1} ${c1},${d1} ${c2},${d2} ${a2},${b2}`} fill="rgba(250, 236, 200, 0.55)" />
                <line x1={p0[0] + 1} y1={p0[1] - 2} x2={p3[0] + 1} y2={p3[1] + 2} stroke="rgba(255, 245, 220, 0.25)" strokeWidth="1" />
              </g>
            );
          })}
        </svg>
      )}
      {/* Un solo control: la zona del mueble y su etiqueta (colgada del borde derecho, como en la maqueta) */}
      <button type="button" className="reader-visit__shelf" style={zone(ROOM_SHELF)} onClick={() => onSelect('libros')} aria-label={`Libros compartidos por ${alias} (${shared.all.length})`}>
        <span className="reader-visit__tag" style={{ left: pct((SHELF_TAG.x - ROOM_SHELF.x0 * VISIT_W) / ((ROOM_SHELF.x1 - ROOM_SHELF.x0) * VISIT_W)), top: pct((SHELF_TAG.y - ROOM_SHELF.y0 * VISIT_H) / ((ROOM_SHELF.y1 - ROOM_SHELF.y0) * VISIT_H)) }} aria-hidden="true">
          <span>
            Libros
            <br />
            compartidos
          </span>
          <ChevronRight aria-hidden="true" />
        </span>
      </button>
    </>
  );
}

/** Solo estados honestos: cargando, error, rincón privado o sin libros (los accesos están en la escena y la cabecera). */
function RoomFoot({ data, status, failure, reload, shared, onBack }) {
  const ready = status === 'ready' && data?.profile;
  const privateCorner = data?.profile && !data.corner?.visible;
  if (ready && !privateCorner && shared.all.length) return null;
  return (
    <footer className="reader-visit__foot">
      {ready ? (
        <>
          {privateCorner && <p className="reader-visit__hint">Su rincón es privado: aquí solo se ve lo que comparte en colecciones visibles.</p>}
          {!privateCorner && !shared.all.length && <p className="reader-visit__hint">Aún no ha compartido libros. Las baldas esperan.</p>}
        </>
      ) : (
        <VisitStatus status={status} data={data} failure={failure} reload={reload} onBack={onBack} />
      )}
    </footer>
  );
}
