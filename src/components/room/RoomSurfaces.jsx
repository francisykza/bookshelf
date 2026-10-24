// Superficies con datos de la habitación (SPEC §20): la pantalla del portátil con BookShelf abierto en Calendario
// y el libro abierto con la lectura actual. Cada una es un lienzo local proyectado con la homografía del mueble
// (`rectToQuad`) sobre su quad medido en la ilustración: comparte escala y recorte con el fondo, no sale del bisel
// ni cruza el pliegue. Son vistas ambientales: no tienen botones propios (los hotspots del portátil y del libro
// abren el panel y la ficha).
import { useMemo, useState } from 'react';
import { parseDay } from '../../domain/dates';
import { monthCells, progressParts, todayReading } from '../../domain/roomSurfaces';
import { activeDays, groupByDay } from '../../domain/reading';
import { rectToQuad } from '../../scene/homography';
import { BOOK_LEFT_PAGE, BOOK_RIGHT_PAGE, LAPTOP_FOREGROUND, LAPTOP_SCREEN } from '../../scene/sceneMap';
import { GeneratedCover } from '../shelf/BookItem';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
/** Lienzo lógico de la pantalla, proporcional a su quad (≈ 143 × 118 px de la ilustración). */
const SCREEN = { w: 300, h: 248 };

/**
 * La pantalla encendida con BookShelf abierto en Calendario (SPEC §20.1): cabecera de la app, lo leído hoy como
 * dato principal y el mes como contexto. Un único lienzo proyectado en las esquinas interiores del bisel; la
 * planta y el vaso se repintan delante. Decorativa: el hotspot del portátil es el único objetivo táctil.
 */
export function LaptopScreen({ log, books, today, streak }) {
  const cells = useMemo(() => monthCells(today), [today]);
  const active = useMemo(() => activeDays(log), [log]);
  const day = useMemo(() => todayReading(groupByDay(log.filter((e) => e.date === today), books)[today]), [log, books, today]);
  const date = parseDay(today);
  const month = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const dayLabel = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
  return (
    <>
      <div className="laptop-screen" data-kind={day.kind} style={{ width: SCREEN.w, height: SCREEN.h, transform: rectToQuad(SCREEN.w, SCREEN.h, LAPTOP_SCREEN) }} aria-hidden="true">
        <div className="laptop-screen__app">
          <header className="laptop-screen__bar">
            <span className="laptop-screen__brand">BookShelf</span>
            <span className="laptop-screen__tab">Calendario</span>
          </header>
          <section className="laptop-screen__today">
            <span className="laptop-screen__kicker">Hoy · {dayLabel}</span>
            {day.kind === 'none' ? (
              <span className="laptop-screen__empty">Tu próxima página te espera</span>
            ) : (
              <>
                <span className="laptop-screen__figure">
                  <b>{day.value}</b> {day.label}
                </span>
                <span className="laptop-screen__book">
                  {day.title}
                  {day.more > 0 && <em> +{day.more} {day.more === 1 ? 'libro' : 'libros'}</em>}
                </span>
              </>
            )}
          </section>
          <section className="laptop-screen__month">
            <span className="laptop-screen__month-name">{month.charAt(0).toUpperCase() + month.slice(1)}</span>
            <div className="laptop-screen__grid">
              {WEEKDAYS.map((w, i) => (
                <span key={i} className="laptop-screen__wd">
                  {w}
                </span>
              ))}
              {cells.map((d, i) =>
                d ? (
                  <span key={d} className="laptop-screen__day" data-today={d === today || undefined} data-read={active.has(d) || undefined}>
                    {Number(d.slice(8))}
                  </span>
                ) : (
                  <span key={`e${i}`} />
                ),
              )}
            </div>
          </section>
          <footer className="laptop-screen__status">{streak > 0 ? `${streak} ${streak === 1 ? 'día' : 'días'} seguidos` : 'Hoy empieza tu racha'}</footer>
        </div>
      </div>
      {/* Lo que está delante de la pantalla, recortado de la propia ilustración */}
      <img className="laptop-foreground" src={LAPTOP_FOREGROUND.src} alt="" width={LAPTOP_FOREGROUND.w} height={LAPTOP_FOREGROUND.h} style={{ left: LAPTOP_FOREGROUND.x, top: LAPTOP_FOREGROUND.y }} draggable="false" aria-hidden="true" />
    </>
  );
}

/** Lienzo lógico de cada página: el mismo para las dos (son del mismo tamaño físico; la perspectiva la pone el quad). */
const PAGE = { w: 250, h: 330 };
const pageStyle = (quad) => ({ width: PAGE.w, height: PAGE.h, transform: rectToQuad(PAGE.w, PAGE.h, quad) });

/** Portada impresa en la página: la generada hace de base solo hasta que la real carga (o si no llega). */
function PlateCover({ book }) {
  const [state, setState] = useState(book.cover ? 'loading' : 'none');
  return (
    <span className="open-pages__plate" data-state={state}>
      {state !== 'loaded' && <GeneratedCover book={book} />}
      {book.cover && state !== 'failed' && (
        <img
          className="open-pages__cover"
          src={book.cover}
          alt=""
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={(event) => setState(event.currentTarget.naturalWidth < 10 ? 'failed' : 'loaded')}
          onError={() => setState('failed')}
        />
      )}
    </span>
  );
}

/**
 * El libro abierto como doble página editorial de la lectura actual (SPEC §20.2): la portada como ilustración de
 * apertura a la izquierda y, a la derecha, «Entre tus páginas», título, autoría, filete y progreso. Cada página
 * tiene su quad y nada cruza el pliegue. Se monta de nuevo al cambiar de libro (`key`), así que nunca mezcla
 * datos de dos lecturas.
 */
export function OpenBookPages({ book }) {
  if (!book) {
    return (
      <div className="open-pages" data-state="empty" aria-hidden="true">
        <div className="open-pages__page open-pages__page--left" style={pageStyle(BOOK_LEFT_PAGE)}>
          <span className="open-pages__ornament">❦</span>
        </div>
        <div className="open-pages__page open-pages__page--right" style={pageStyle(BOOK_RIGHT_PAGE)}>
          <span className="open-pages__kicker">Entre tus páginas</span>
          <b className="open-pages__invite">Tu próxima historia empieza aquí</b>
          <span className="open-pages__rule" />
          <span className="open-pages__secondary">Elige un libro en tu librería</span>
        </div>
      </div>
    );
  }
  const title = book.title || 'Sin título';
  const progress = progressParts(book);
  const size = title.length > 48 ? 'long' : title.length > 24 ? 'medium' : 'short';
  return (
    <div key={book.id} className="open-pages" data-state="book" aria-hidden="true">
      <div className="open-pages__page open-pages__page--left" style={pageStyle(BOOK_LEFT_PAGE)}>
        {book.cover ? (
          <PlateCover key={book.cover} book={book} />
        ) : (
          // Sin portada: frontispicio tipográfico (la inicial y un florón; el título va una sola vez, a la derecha)
          <span className="open-pages__frontis">
            <span className="open-pages__initial">{title.charAt(0)}</span>
            <span className="open-pages__ornament">❦</span>
          </span>
        )}
      </div>
      <div className="open-pages__page open-pages__page--right" style={pageStyle(BOOK_RIGHT_PAGE)}>
        <span className="open-pages__kicker">Entre tus páginas</span>
        <b className="open-pages__title" data-size={size}>
          {title}
        </b>
        {book.author && <span className="open-pages__author">{book.author}</span>}
        <span className="open-pages__rule" />
        <span className="open-pages__progress">{progress.main}</span>
        {progress.secondary && <span className="open-pages__secondary">{progress.secondary}</span>}
        {progress.fraction != null && (
          <span className="open-pages__meter">
            <i style={{ width: `${Math.max(0, Math.min(1, progress.fraction)) * 100}%` }} />
          </span>
        )}
      </div>
    </div>
  );
}
