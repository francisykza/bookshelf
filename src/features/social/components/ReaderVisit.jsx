// Visita al rincón de una persona que sigues (SPEC §56). Casa ilustrada con su alias y la ventana inferior derecha como
// acceso; al tocarla, el vídeo de entrada (único y común a todas las visitas) y la habitación del último fotograma, con
// los libros que esa persona ha decidido compartir. Etapas en el historial de la app: casa → habitación → libros/libro
// (Atrás y Escape cierran de uno en uno). Los estados del vídeo (preparando, entrando) no son entradas de historial y
// nunca bloquean la salida. El vídeo no se pide hasta tocar la ventana; recargar la habitación no lo repite.
import { ArrowLeft, BookOpen, UserRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { PanelShell } from '../../../components/panels/PanelShell';
import { spineColor } from '../../../domain/books';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useLibrary } from '../../../state/useLibrary';
import { useCommunity } from '../hooks/useCommunity';
import { useReaderCorner } from '../hooks/useReaderCorner';
import { currentTitle, readSkip, sharedBooks, writeSkip } from '../visit';
import { HOUSE_WINDOW, ROOM_SHELF, VISIT_H, VISIT_MEDIA, VISIT_W, shelfSpines } from '../visitScene';
import { SharedBooksSheet, VisitBookSheet } from './VisitBookSheet';

/** Espera máxima a que el vídeo tenga un fotograma: después se entra en la habitación sin animación. */
const PREPARE_LIMIT = 6000;

const pct = (v) => `${(v * 100).toFixed(3)}%`;
const zone = (z) => ({ left: pct(z.x0), top: pct(z.y0), width: pct(z.x1 - z.x0), height: pct(z.y1 - z.y0) });

export function ReaderVisit({ userId, stage, select, onEnter, onSelect, onBack, onProfile }) {
  const community = useCommunity({ autoload: true });
  const { state } = useLibrary();
  const reduced = useReducedMotion();
  const corner = useReaderCorner(userId, community);
  const data = corner.data;
  const alias = data?.profile?.alias ?? '';
  const shared = useMemo(() => (data ? sharedBooks({ ownerId: userId, corner: data.corner, collections: data.collections }) : { featured: [], all: [] }), [data, userId]);
  const label = (text) => (alias ? `${text} de ${alias}` : text);

  return (
    <PanelShell onClose={onBack} label={alias ? `Visita al rincón de ${alias}` : 'Visita a un rincón'} variant="visit">
      <div className="reader-visit" data-stage={stage} data-guides={state.settings.showGuides ? 'on' : 'off'} data-reduced={reduced || undefined}>
        {stage === 'casa' ? (
          <House userId={userId} alias={alias} data={data} status={corner.status} reduced={reduced} onEnter={onEnter} onBack={onBack} onProfile={onProfile} label={label} />
        ) : (
          <Room alias={alias} data={data} status={corner.status} failure={corner.failure} reload={corner.reload} shared={shared} select={select} reduced={reduced} onSelect={onSelect} onBack={onBack} onProfile={onProfile} />
        )}
      </div>
    </PanelShell>
  );
}

/** Marco 9:16 común a la casa, el vídeo y la habitación: contener y centrar, sin estirar ni recortar. */
function Frame({ children, className = '' }) {
  return (
    <div className={`reader-visit__stage ${className}`}>
      <div className="reader-visit__frame" style={{ aspectRatio: `${VISIT_W} / ${VISIT_H}` }}>
        {children}
      </div>
    </div>
  );
}

function Who({ data, alias }) {
  if (!data?.profile) return null;
  return (
    <span className="reader-visit__who">
      <ReaderAvatar avatarId={data.profile.avatar_id} alias={alias} size="list" decorative />
      <b>{alias}</b>
    </span>
  );
}

// ── Casa y entrada ────────────────────────────────────────────────────────────────────────────────────────────────
function House({ alias, data, status, reduced, onEnter, onBack, onProfile, label }) {
  // casa | preparando | entrando (solo en esta pantalla; no son entradas de historial)
  const [phase, setPhase] = useState('casa');
  const [skip, setSkip] = useState(readSkip);
  const [note, setNote] = useState('');
  const videoRef = useRef(null);
  const done = useRef(false);

  /** Entrar en la habitación (una sola vez), sin dejar el vídeo cargando detrás. */
  const enter = () => {
    if (done.current) return;
    done.current = true;
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.removeAttribute('src');
      v.load();
    }
    onEnter();
  };

  const start = () => {
    if (phase !== 'casa' || done.current) return;
    if (reduced || skip) return enter();
    setPhase('preparando');
  };

  const playing = phase !== 'casa';
  // Preparar: el vídeo recibe su fuente AHORA (nunca antes de tocar la ventana) y el fondo final se decodifica a la vez.
  // Depende solo de que la visita haya empezado: pasar de «preparando» a «entrando» no debe soltar sus escuchadores
  useEffect(() => {
    if (!playing) return undefined;
    const v = videoRef.current;
    if (!v) return undefined;
    const room = new Image();
    room.src = VISIT_MEDIA.room;
    room.decode?.().catch(() => {});
    let finished = false;
    const fallback = () => {
      if (finished) return;
      finished = true;
      setNote('La entrada no se ha podido reproducir: pasas directamente.');
      enter();
    };
    const timer = setTimeout(fallback, PREPARE_LIMIT);
    const onPlaying = () => {
      clearTimeout(timer);
      setPhase('entrando');
    };
    const onEnded = () => {
      finished = true;
      clearTimeout(timer);
      enter();
    };
    v.addEventListener('playing', onPlaying);
    v.addEventListener('ended', onEnded);
    v.addEventListener('error', fallback);
    v.src = VISIT_MEDIA.video;
    const p = v.play();
    if (p?.catch) p.catch(fallback);
    // Pestaña oculta: se pausa (sin sonido que reanudar); al volver sigue, sin repetir la entrada
    const onVis = () => {
      if (document.visibilityState === 'hidden') v.pause();
      else if (!finished) v.play().catch(fallback);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      finished = true;
      clearTimeout(timer);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('ended', onEnded);
      v.removeEventListener('error', fallback);
      document.removeEventListener('visibilitychange', onVis);
    };
    // enter es estable para esta pantalla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Al salir (Atrás, Escape, otra pantalla): el vídeo se suelta
  useEffect(
    () => () => {
      const v = videoRef.current;
      if (!v) return;
      v.pause();
      v.removeAttribute('src');
      v.load();
    },
    [],
  );

  return (
    <>
      <Frame className="reader-visit__stage--house">
        <img className="reader-visit__bg" src={VISIT_MEDIA.house} alt="" width={VISIT_W} height={VISIT_H} decoding="async" />
        {playing && (
          <video
            ref={videoRef}
            className="reader-visit__video"
            data-shown={phase === 'entrando' || undefined}
            preload="none"
            muted
            playsInline
            disablePictureInPicture
            disableRemotePlayback
            aria-hidden="true"
            tabIndex={-1}
          />
        )}
        {!playing && (
          <button type="button" className="reader-visit__window" style={zone(HOUSE_WINDOW)} onClick={start} disabled={status !== 'ready' || !data?.profile} aria-label={label('Entrar por la ventana en el rincón')}>
            <span className="reader-visit__tag">Entrar</span>
          </button>
        )}
      </Frame>
      <header className="reader-visit__bar">
        <button type="button" className="reader-visit__icon" onClick={onBack} aria-label="Volver">
          <ArrowLeft aria-hidden="true" />
        </button>
        <Who data={data} alias={alias} />
      </header>
      <footer className="reader-visit__foot" data-phase={phase}>
        {playing ? (
          <button type="button" className="sheet-btn" onClick={enter}>
            Saltar
          </button>
        ) : status === 'ready' && data?.profile ? (
          <>
            <p className="reader-visit__lead">Toca la ventana para entrar en el rincón de {alias}.</p>
            <div className="reader-visit__actions">
              <button type="button" className="sheet-btn" onClick={enter}>
                Entrar sin animación
              </button>
              <button type="button" className="sheet-btn" onClick={onProfile}>
                <UserRound aria-hidden="true" /> Ver perfil
              </button>
            </div>
            <label className="reader-visit__check">
              <input
                type="checkbox"
                checked={skip}
                onChange={(e) => {
                  setSkip(e.target.checked);
                  writeSkip(e.target.checked);
                }}
              />
              Entrar siempre sin animación
            </label>
          </>
        ) : (
          <VisitStatus status={status} data={data} onBack={onBack} />
        )}
        {note && (
          <p className="reader-visit__note" role="status">
            {note}
          </p>
        )}
      </footer>
    </>
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
function Room({ alias, data, status, failure, reload, shared, select, reduced, onSelect, onBack, onProfile }) {
  const [bgFailed, setBgFailed] = useState(false);
  const [settled, setSettled] = useState(reduced);
  const reading = currentTitle(data?.corner);
  const privateCorner = data?.profile && !data.corner?.visible;
  const spines = shelfSpines(shared.featured.length);
  // Los libros aparecen cuando la habitación ya está quieta: breve y discreto (inmediato con movimiento reducido)
  useEffect(() => {
    if (reduced) return undefined;
    const id = setTimeout(() => setSettled(true), 60);
    return () => clearTimeout(id);
  }, [reduced]);
  const ready = status === 'ready' && data?.profile;
  const item = select && select !== 'libros' ? (shared.all.find((it) => it.key === select) ?? null) : null;

  return (
    <>
      <Frame>
        {!bgFailed && <img className="reader-visit__bg" src={VISIT_MEDIA.room} alt="" width={VISIT_W} height={VISIT_H} decoding="async" onError={() => setBgFailed(true)} />}
        {ready && spines.length > 0 && (
          <svg className="reader-visit__spines" data-shown={settled || undefined} viewBox={`0 0 ${VISIT_W} ${VISIT_H}`} preserveAspectRatio="none" aria-hidden="true">
            {spines.map((s, i) => {
              const b = shared.featured[i].ref;
              const [p0, p1, p2, p3] = s.points;
              // Lomo con su canto y una banda alta discreta (nada de brillos): un libro, no una tarjeta
              const band = (k) => [p3[0], p3[1] + (p0[1] - p3[1]) * k, p2[0], p2[1] + (p1[1] - p2[1]) * k];
              const [a1, b1, c1, d1] = band(0.12);
              const [a2, b2, c2, d2] = band(0.16);
              return (
                <g key={shared.featured[i].key}>
                  <polygon points={s.points.map((p) => p.join(',')).join(' ')} fill={spineColor({ title: b.title, author: b.author })} stroke="rgba(44, 30, 20, 0.45)" strokeWidth="1.2" />
                  <polygon points={`${a1},${b1} ${c1},${d1} ${c2},${d2} ${a2},${b2}`} fill="rgba(250, 236, 200, 0.55)" />
                  <line x1={p0[0] + 1} y1={p0[1] - 2} x2={p3[0] + 1} y2={p3[1] + 2} stroke="rgba(255, 245, 220, 0.25)" strokeWidth="1" />
                </g>
              );
            })}
          </svg>
        )}
        {ready && (
          <button type="button" className="reader-visit__shelf" style={zone(ROOM_SHELF)} onClick={() => onSelect('libros')} aria-label={`Libros compartidos por ${alias} (${shared.all.length})`}>
            <span className="reader-visit__tag">
              <BookOpen aria-hidden="true" /> Libros{shared.all.length ? ` · ${shared.all.length}` : ''}
            </span>
          </button>
        )}
      </Frame>
      <header className="reader-visit__bar">
        <button type="button" className="reader-visit__icon" onClick={onBack} aria-label="Volver a la casa">
          <ArrowLeft aria-hidden="true" />
        </button>
        <Who data={data} alias={alias} />
        {ready && (
          <button type="button" className="reader-visit__icon" onClick={onProfile} aria-label={`Ver el perfil de ${alias}`}>
            <UserRound aria-hidden="true" />
          </button>
        )}
      </header>
      <footer className="reader-visit__foot">
        {ready ? (
          <>
            {reading && (
              <p className="reader-visit__lead">
                Está leyendo <b>«{reading}»</b>
              </p>
            )}
            {privateCorner && <p className="reader-visit__hint">Su rincón es privado: aquí solo se ve lo que comparte en colecciones visibles.</p>}
            {!privateCorner && !shared.all.length && <p className="reader-visit__hint">Aún no ha compartido libros. Las baldas esperan.</p>}
            {bgFailed && <p className="reader-visit__hint">La ilustración de la habitación no se ha podido cargar.</p>}
            <div className="reader-visit__actions">
              <button type="button" className="sheet-btn" onClick={() => onSelect('libros')}>
                <BookOpen aria-hidden="true" /> Libros compartidos
              </button>
              <button type="button" className="sheet-btn" onClick={onProfile}>
                <UserRound aria-hidden="true" /> Ver perfil
              </button>
            </div>
          </>
        ) : (
          <VisitStatus status={status} data={data} failure={failure} reload={reload} onBack={onBack} />
        )}
      </footer>
      {ready && select === 'libros' && <SharedBooksSheet items={shared.all} alias={alias} profile={data.profile} reviews={data.reviews} onOpenBook={(key) => onSelect(key)} onBack={onBack} />}
      {ready && select && select !== 'libros' && <VisitBookSheet item={item} alias={alias} profile={data.profile} reviews={data.reviews} onBack={onBack} />}
    </>
  );
}
