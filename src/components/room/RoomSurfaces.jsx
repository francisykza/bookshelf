// Superficies con datos de la habitación (SPEC §19.2–19.3): la pantalla encendida del portátil con el calendario
// del mes y el libro abierto con la lectura actual. Cada una es un lienzo local proyectado con la homografía del
// mueble (`rectToQuad`) sobre su quad medido en la ilustración: comparte escala y recorte con el fondo y no sale
// del bisel ni cruza el pliegue. Son vistas ambientales: no tienen botones propios (los hotspots del portátil y
// del libro abren el panel y la ficha).
import { useMemo } from 'react';
import { parseDay } from '../../domain/dates';
import { monthCells, progressLine } from '../../domain/roomSurfaces';
import { activeDays } from '../../domain/reading';
import { rectToQuad } from '../../scene/homography';
import { BOOK_LEFT_PAGE, BOOK_RIGHT_PAGE, LAPTOP_DISPLAY, LAPTOP_GLOW, SCENE_H, SCENE_W, pts } from '../../scene/sceneMap';
import { Cover, GeneratedCover } from '../shelf/BookItem';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const SCREEN = { w: 236, h: 196 };
const LEFT = { w: 300, h: 250 };
const RIGHT = { w: 360, h: 250 };

/** Pantalla encendida: mes y año, L–D, el mes con hoy destacado, los días leídos marcados y un pie breve. */
export function LaptopCalendar({ log, today, streak, todayText }) {
  const cells = useMemo(() => monthCells(today), [today]);
  const active = useMemo(() => activeDays(log), [log]);
  const month = parseDay(today).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return (
    <>
      {/* La pantalla entera encendida (no solo el calendario): parece un monitor, no una pegatina */}
      <svg className="laptop-screen__backlight" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} width={SCENE_W} height={SCENE_H} aria-hidden="true">
        <polygon points={pts(LAPTOP_GLOW)} />
      </svg>
    <div className="laptop-screen" style={{ width: SCREEN.w, height: SCREEN.h, transform: rectToQuad(SCREEN.w, SCREEN.h, LAPTOP_DISPLAY) }} aria-hidden="true">
      <div className="laptop-screen__glass">
        <p className="laptop-screen__month">{month.charAt(0).toUpperCase() + month.slice(1)}</p>
        <div className="laptop-screen__grid">
          {WEEKDAYS.map((w) => (
            <span key={w} className="laptop-screen__wd">
              {w}
            </span>
          ))}
          {cells.map((date, i) =>
            date ? (
              <span key={date} className="laptop-screen__day" data-today={date === today || undefined} data-read={active.has(date) || undefined}>
                {Number(date.slice(8))}
              </span>
            ) : (
              <span key={`e${i}`} />
            ),
          )}
        </div>
        <p className="laptop-screen__foot">
          {streak > 0 ? `${streak} ${streak === 1 ? 'día' : 'días'} seguidos` : 'Hoy empieza tu racha'}
          {todayText ? ` · ${todayText}` : ''}
        </p>
      </div>
    </div>
    </>
  );
}

/** El libro abierto: portada como lámina a la izquierda y «Tu lectura» impresa a la derecha. */
export function OpenBookPages({ book }) {
  return (
    <div className="open-pages" aria-hidden="true">
      <div className="open-pages__page open-pages__page--left" style={{ width: LEFT.w, height: LEFT.h, transform: rectToQuad(LEFT.w, LEFT.h, BOOK_LEFT_PAGE) }}>
        {book ? (
          <>
            <span className="open-pages__plate">
              {/* La portada generada hace de base mientras la real carga (o si no llega): la lámina nunca queda vacía */}
              {book.cover && <GeneratedCover book={book} />}
              <Cover book={book} />
            </span>
            <span className="open-pages__caption">
              <b>{book.title || 'Sin título'}</b>
              {book.author && <i>{book.author}</i>}
            </span>
          </>
        ) : (
          <span className="open-pages__ornament">❦</span>
        )}
      </div>
      <div className="open-pages__page open-pages__page--right" style={{ width: RIGHT.w, height: RIGHT.h, transform: rectToQuad(RIGHT.w, RIGHT.h, BOOK_RIGHT_PAGE) }}>
        {book ? (
          <>
            <span className="open-pages__kicker">Tu lectura</span>
            <b className="open-pages__title">{book.title || 'Sin título'}</b>
            {book.author && <span className="open-pages__author">{book.author}</span>}
            <span className="open-pages__rule" />
            <span className="open-pages__progress">{progressLine(book)}</span>
            <span className="open-pages__note">toca para abrirlo</span>
          </>
        ) : (
          <>
            <span className="open-pages__kicker">Tu próxima historia empieza aquí</span>
            <span className="open-pages__rule" />
            <span className="open-pages__note">toca para elegir un libro</span>
          </>
        )}
      </div>
    </div>
  );
}
