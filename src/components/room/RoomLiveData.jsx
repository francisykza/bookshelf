// Datos vivos integrados en la habitación (SPEC §3.3 y §16.7): tu lectura real aparece sobre los objetos
// pintados, en su misma perspectiva. Marcapáginas sobre la página del libro abierto, post-it con la racha en
// la pantalla del portátil, cuenta atrás como bruma sobre el té y notas doradas de los auriculares.
import { isActive } from '../../domain/reading';
import { useState } from 'react';
import { pageRustle } from '../../audio/ambientAudio';
import { formatPercent, isComplete, percentRead, progress, trackUnit } from '../../domain/books';
import { addDays, dayKey } from '../../domain/dates';
import { rectToQuad } from '../../scene/homography';
import { BOOK_PAGE, HOTSPOTS, LAPTOP_SCREEN, TEA_LIQUID } from '../../scene/sceneMap';
import { DRINKS } from '../panels/Drinks';
import { Cover } from '../shelf/BookItem';

/** Trozo de un cuadrilátero (u, v en 0–1) por interpolación bilineal: TL, TR, BR, BL. */
function subQuad(quad, u0, v0, u1, v1) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
  const at = (u, v) => [
    (1 - u) * (1 - v) * x0 + u * (1 - v) * x1 + u * v * x2 + (1 - u) * v * x3,
    (1 - u) * (1 - v) * y0 + u * (1 - v) * y1 + u * v * y2 + (1 - u) * v * y3,
  ];
  return [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
}

/** Días seguidos leyendo hasta hoy (si hoy aún no has leído, cuenta la racha hasta ayer). */
export function readingStreak(log, today = new Date()) {
  // Solo lecturas reales: una corrección o una posición sin lectura declarada no alarga la racha
  const days = new Set(log.filter(isActive).map((e) => e.date));
  let cursor = days.has(dayKey(today)) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

const CARD = { w: 136, h: 106 };

/**
 * Marcapáginas de papel apoyado sobre la página derecha del libro de la cama: mini-portada, progreso y
 * «+5 págs», que pasa una hoja ahí mismo. El resto del libro sigue abriendo el modal 3D.
 */
export function BedBookmark({ book, onAdvance, onOpen }) {
  const [flip, setFlip] = useState(0);
  if (!book) return null;
  const pct = progress(book);
  const done = isComplete(book);
  // Sin páginas no se suman «+5 págs.»: se abre la ficha, con el mismo formulario de registro (SPEC §14.9)
  const byPercent = trackUnit(book) === 'percent';
  return (
    <div className="bed-card" style={{ width: CARD.w, height: CARD.h, transform: rectToQuad(CARD.w, CARD.h, BOOK_PAGE) }}>
      <button type="button" className="bed-card__body" onClick={() => onOpen(book)} aria-label={`Abrir ${book.title}`}>
        <span className="bed-card__cover">
          <Cover book={book} />
        </span>
        <span className="bed-card__text">
          <em>Leyendo ahora</em>
          <b>{book.title}</b>
          <span className="bed-card__bar" style={{ '--p': `${pct}%` }} />
          <span className="bed-card__meta">
            {byPercent ? <b>{formatPercent(percentRead(book))} leído</b> : (
              <>
                <b>{pct} %</b> · Pág. {book.currentPage}/{book.pageCount}
              </>
            )}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="bed-card__plus"
        disabled={done}
        onClick={() => {
          if (byPercent) {
            onOpen(book);
            return;
          }
          onAdvance(book, 5);
          pageRustle(0.8);
          setFlip((n) => n + 1);
        }}
        aria-label={byPercent ? `Actualizar el porcentaje de ${book.title}` : `Sumar 5 páginas a ${book.title}`}
      >
        {byPercent ? 'Actualizar %' : '+5 págs'}
      </button>
      {/* Hoja que pasa al sumar páginas (la clave reinicia la animación) */}
      {flip > 0 && <span key={flip} className="bed-card__flip" aria-hidden="true" />}
      <span className="bed-card__ribbon" aria-hidden="true" />
    </div>
  );
}

const NOTE = { w: 100, h: 78 };

/** Post-it amarillo pegado en la esquina de la pantalla del portátil con la racha y lo leído hoy. */
export function LaptopPostit({ streak, todayPages, todayPercent = 0 }) {
  const quad = subQuad(LAPTOP_SCREEN, 0.06, 0.08, 0.5, 0.62);
  return (
    <div className="lid-note" style={{ width: NOTE.w, height: NOTE.h, transform: rectToQuad(NOTE.w, NOTE.h, quad) }} aria-hidden="true">
      <span className="lid-note__paper">
        <b>🔥 {streak} {streak === 1 ? 'día' : 'días'}</b>
        <span>{todayPages || !todayPercent ? `${todayPages} págs hoy` : 'avance en % hoy'}</span>
      </span>
    </div>
  );
}

const fmt = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** Cuenta atrás del temporizador flotando como bruma cálida sobre el vaso de té. */
export function TeaMist({ timer }) {
  if (!timer.running && timer.remaining >= timer.total) return null;
  const x = (TEA_LIQUID.x + TEA_LIQUID.w / 2);
  return (
    <div className="tea-mist" data-paused={!timer.running} style={{ left: x, top: TEA_LIQUID.top - 30 }} aria-hidden="true">
      <span className="tea-mist__wisp" />
      <span className="tea-mist__time">{fmt(timer.remaining)}</span>
      <span className="tea-mist__phase">{timer.running ? (timer.phase === 'focus' ? 'leyendo' : 'descanso') : 'en pausa'}</span>
    </div>
  );
}

const NOTES = ['♪', '♫', '♪', '♬', '♫'];

/** Notas musicales doradas y ondas suaves que suben desde los auriculares cuando suena el ambiente. */
export function SoundWaves({ on }) {
  if (!on) return null;
  const a = HOTSPOTS.headphones.label;
  return (
    <div className="sound-waves" style={{ left: a.x - 60, top: a.y - 40 }} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={`w${i}`} className="sound-waves__ring" style={{ animationDelay: `${i * 1.2}s` }} />
      ))}
      {NOTES.map((n, i) => (
        <span key={i} className="sound-waves__note" style={{ animationDelay: `${i * 0.8}s`, left: `${20 + ((i * 37) % 90)}px` }}>
          {n}
        </span>
      ))}
    </div>
  );
}

/** Columna de vapor sobre la bandeja cuando la bebida elegida es caliente (más densa durante la sesión). */
export function DrinkSteam({ drink, active }) {
  if (!DRINKS[drink]?.hot) return null;
  const x = TEA_LIQUID.x + TEA_LIQUID.w / 2;
  return (
    <div className="drink-steam" data-active={active} style={{ left: x, top: TEA_LIQUID.top - 10 }} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} style={{ animationDelay: `${i * 1.1}s`, left: `${(i % 2 ? 1 : -1) * (6 + i * 3)}px` }} />
      ))}
    </div>
  );
}

/**
 * Sombra de nube de verano: cada 35 s cruza en diagonal sobre la habitación y atenúa el sol unos
 * 6 segundos; a la vez la brisa trae pétalos de la pérgola (el lienzo de partículas lo sincroniza).
 */
export function CloudShadow({ timeOfDay }) {
  if (timeOfDay === 'night') return null;
  return (
    <div className="cloud-shadow" aria-hidden="true">
      <span className="cloud-shadow__blob" />
      <span className="cloud-shadow__dim" />
    </div>
  );
}
