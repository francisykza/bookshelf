// Panorama de dos habitaciones (SPEC §16.2–16.6, Fase 1): viewport fijo de una pantalla, track de dos
// pantallas y un panel por habitación. MAIN_ROOM a la izquierda y SOCIAL_ROOM a la derecha, sin bucle.
// Un único controlador de gesto en el viewport (swipe horizontal ≥ 50 px y |dx| > |dy| × 1,3), controles
// laterales accesibles y flechas del teclado solo con el foco en el panorama. La habitación activa es estado de
// interfaz: cambiarla no toca la biblioteca, el temporizador, el audio ni la sesión.
import { useCallback, useEffect, useRef, useState } from 'react';
import { MAIN_ROOM, SOCIAL_ROOM, SWIPE_MIN, SWIPE_RATIO, swipeTarget } from '../../scene/panorama';
import { ROOMS } from '../../scene/sceneMap';

const MOVE_MS = 700;
const EXCLUDED = 'input, textarea, select, [role="slider"], [contenteditable="true"], [data-no-room-swipe], .panorama-nav, .panel-veil, [role="dialog"]';
const EDITABLE = 'input, textarea, select, [contenteditable="true"], [role="slider"]';

/** Precarga y decodificación de la ilustración social: 'loading' | 'ok' | 'error' (+ reintento). */
function useSocialImage() {
  const [state, setState] = useState({ status: 'loading', attempt: 0 });
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.decoding = 'async';
    img.src = state.attempt ? `${ROOMS.SOCIAL_ROOM.src}?reintento=${state.attempt}` : ROOMS.SOCIAL_ROOM.src;
    img
      .decode()
      .then(() => alive && setState((s) => ({ ...s, status: 'ok' })))
      .catch(() => alive && setState((s) => ({ ...s, status: img.naturalWidth ? 'ok' : 'error' })));
    return () => {
      alive = false;
    };
  }, [state.attempt]);
  const retry = useCallback(() => setState((s) => ({ status: 'loading', attempt: s.attempt + 1 })), []);
  return { ...state, retry };
}

export function PanoramicRoom({ locked = false, reducedMotion = false, renderMain, renderSocial, controls }) {
  const [room, setRoom] = useState(MAIN_ROOM);
  const social = useSocialImage();
  const viewportRef = useRef(null);
  const toSocialRef = useRef(null);
  const toMainRef = useRef(null);
  const panels = useRef({});
  const moving = useRef(false);
  const moveTimer = useRef(0);
  const gesture = useRef(null);
  const pointers = useRef(new Set());
  const suppressUntil = useRef(0);

  const go = useCallback(
    (target) => {
      if (locked || moving.current || target === room || (target === SOCIAL_ROOM && social.status === 'loading')) return false;
      // El foco no puede quedarse dentro del panel que pasa a inerte: va al control de regreso del nuevo
      const leaving = panels.current[room];
      const focusInside = leaving && leaving.contains(document.activeElement);
      // Solo hay bloqueo si el track va a animarse de verdad (con movimiento reducido el CSS lo deja en 0 s)
      const track = viewportRef.current?.querySelector('.panorama-track');
      const animated = track && parseFloat(getComputedStyle(track).transitionDuration) >= 0.05;
      if (animated) {
        moving.current = true;
        window.clearTimeout(moveTimer.current);
        moveTimer.current = window.setTimeout(() => {
          moving.current = false;
        }, MOVE_MS + 80);
      }
      setRoom(target);
      if (focusInside) requestAnimationFrame(() => (target === SOCIAL_ROOM ? toMainRef : toSocialRef).current?.focus());
      return true;
    },
    [locked, room, social.status],
  );

  useEffect(() => () => window.clearTimeout(moveTimer.current), []);

  const reset = () => {
    gesture.current = null;
  };

  const onPointerDown = (event) => {
    pointers.current.add(event.pointerId);
    // Un segundo contacto (pinza) anula el gesto en curso
    if (pointers.current.size > 1 || !event.isPrimary) {
      if (gesture.current) gesture.current.cancelled = true;
      return;
    }
    if (locked || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (event.target instanceof Element && event.target.closest(EXCLUDED)) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, cancelled: false };
  };

  const onPointerUp = (event) => {
    pointers.current.delete(event.pointerId);
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    reset();
    if (g.cancelled || locked) return;
    const target = swipeTarget(room, event.clientX - g.x, event.clientY - g.y);
    // Un movimiento claro (aunque no cambie de habitación, p. ej. hacia el borde) no debe abrir el objeto
    const dx = Math.abs(event.clientX - g.x);
    if (dx >= SWIPE_MIN && dx > Math.abs(event.clientY - g.y) * SWIPE_RATIO) suppressUntil.current = performance.now() + 450;
    if (target) go(target);
  };

  const onPointerCancel = (event) => {
    pointers.current.delete(event.pointerId);
    reset();
  };

  // Solo se suprime el clic derivado del swipe reconocido
  const onClickCapture = (event) => {
    if (performance.now() < suppressUntil.current) {
      suppressUntil.current = 0;
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const onKeyDown = (event) => {
    if (locked || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target instanceof Element && event.target.closest(EDITABLE)) return;
    if (event.key === 'ArrowRight' && go(SOCIAL_ROOM)) event.preventDefault();
    if (event.key === 'ArrowLeft' && go(MAIN_ROOM)) event.preventDefault();
  };

  const mainActive = room === MAIN_ROOM;
  return (
    <div
      ref={viewportRef}
      className="panorama-viewport"
      data-room={room}
      data-locked={locked || undefined}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerCancel}
      onClickCapture={onClickCapture}
      onKeyDown={onKeyDown}
    >
      <div
        className="panorama-track"
        data-room={room}
        data-reduced={reducedMotion || undefined}
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget) moving.current = false;
        }}
      >
        <section
          ref={(node) => {
            panels.current[MAIN_ROOM] = node;
          }}
          className="panorama-panel"
          data-panel={MAIN_ROOM}
          aria-label="Mi habitación"
          inert={!mainActive ? true : undefined}
          aria-hidden={!mainActive || undefined}
        >
          {renderMain(mainActive)}
        </section>
        <section
          ref={(node) => {
            panels.current[SOCIAL_ROOM] = node;
          }}
          className="panorama-panel"
          data-panel={SOCIAL_ROOM}
          aria-label="Salón social"
          inert={mainActive ? true : undefined}
          aria-hidden={mainActive || undefined}
        >
          {renderSocial(!mainActive, social)}
        </section>
      </div>

      {!locked && (
        <nav className="panorama-nav" aria-label="Habitaciones">
          {mainActive ? (
            <button
              ref={toSocialRef}
              type="button"
              className="panorama-nav__btn panorama-nav__btn--next"
              onClick={() => go(SOCIAL_ROOM)}
              disabled={social.status === 'loading'}
              aria-label={social.status === 'loading' ? 'Salón Social (cargando…)' : 'Ir al Salón Social'}
            >
              <span>Salón Social</span>
              <span aria-hidden="true">→</span>
            </button>
          ) : (
            <button ref={toMainRef} type="button" className="panorama-nav__btn panorama-nav__btn--prev" onClick={() => go(MAIN_ROOM)} aria-label="Volver a Mi Habitación">
              <span aria-hidden="true">←</span>
              <span>Mi Habitación</span>
            </button>
          )}
        </nav>
      )}
      {controls}
    </div>
  );
}
