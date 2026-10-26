// Libro físico en la balda (SPEC §5.3): vista Escaparate (libro 3D con portada, lomo y bloque de
// páginas) o vista Librería (lomo con grosor proporcional a las páginas reales). Cada edición cambia el
// objeto: cuero con nervios y cantoneras, tela con foil, cantos pintados, post-its, e-reader o estuche
// de audiolibro. Además, post-its por cita guardada y cinta marcapáginas en los libros que estás leyendo.
import { AudioLines, Headphones } from 'lucide-react';
import { forwardRef, useCallback, useState } from 'react';
import { useCoverColor } from '../../hooks/useCoverColor';
import { calculateBookPhysics } from '../../utils/vibeEngine';
import { EDGE_NAMES, EDITIONS, QUOTE_COLORS, audioHours, formatPercent, hash, percentRead, progress, ratingText, spineColor, spineHeight, spineWidth, sprayedEdge } from '../../domain/books';

/** Portada tipográfica para libros sin imagen (o con la imagen rota). */
export function GeneratedCover({ book }) {
  return (
    <div className="gen-cover" style={{ '--spine': spineColor(book) }}>
      <span className="gen-cover__frame" />
      <span className="gen-cover__title">{book.title}</span>
      <span className="gen-cover__ornament">❦</span>
      <span className="gen-cover__author">{book.author}</span>
    </div>
  );
}

export function Cover({ book, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (!book.cover || failed) return <GeneratedCover book={book} />;
  return (
    <img
      className={`cover-img ${className}`}
      src={book.cover}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      onLoad={(event) => {
        // Open Library devuelve a veces un píxel transparente en vez de un 404
        if (event.currentTarget.naturalWidth < 10) setFailed(true);
      }}
    />
  );
}

function Tabs({ quotes }) {
  if (!quotes.length) return null;
  return (
    <span className="book-tabs" aria-hidden="true">
      {quotes.slice(0, 6).map((q, i) => (
        <span key={q.id} style={{ '--tab': QUOTE_COLORS[q.color]?.hex ?? '#f7dc6f', left: `${12 + i * 13}%`, '--h': `${7 + ((i * 5) % 6)}px` }} />
      ))}
    </span>
  );
}

const NOTE_COLORS = ['#f7dc6f', '#f4a3b8', '#9cc7ec', '#a8d58f', '#f6b26b', '#c9a7e8'];

/** Post-its de la edición anotada: de 5 a 7, a distintas alturas por el corte derecho y el superior. */
export function annotatedNotes(book) {
  const seed = hash(book.id + book.title);
  const count = 5 + (seed % 3);
  return Array.from({ length: count }, (_, i) => {
    const r = (seed >> (i * 3)) & 7;
    return {
      side: i % 3 === 2 ? 'top' : 'right',
      at: i % 3 === 2 ? 18 + ((i * 23 + r * 5) % 64) : 10 + ((i * 17 + r * 7) % 76),
      out: 4 + (r % 4),
      color: NOTE_COLORS[(i + seed) % NOTE_COLORS.length],
    };
  });
}

/** Batería decorativa del e-reader, distinta (y estable) en cada libro. */
const battery = (book) => 38 + (hash(book.id) % 58);

/** Marco del e-reader: negro mate o salvia mate. */
export const bezel = (book) => (hash(book.title) % 2 ? 'sage' : 'black');

/** Pantalla de tinta electrónica con la portada y la micro-barra de batería y progreso. */
export function EReaderScreen({ book }) {
  const level = battery(book);
  return (
    <>
      <span className="ereader__screen">
        <Cover book={book} />
      </span>
      <span className="ereader__bar">
        <span className="ereader__battery" style={{ '--b': `${level}%` }} title={`Batería ${level} %`} />
        <span>{formatPercent(percentRead(book))}</span>
      </span>
    </>
  );
}

/** Franja del estuche acrílico: ondas de voz doradas, cascos y duración. */
export function AudioStrip({ book }) {
  return (
    <span className="audio-case__strip">
      <AudioLines aria-hidden="true" />
      <span>{audioHours(book)} h</span>
      <Headphones aria-hidden="true" />
    </span>
  );
}

function describe(book) {
  const parts = [`${book.title}, de ${book.author}`, EDITIONS[book.editionType]?.short];
  if (book.editionType === 'audiobook') parts.push(`${audioHours(book)} horas`);
  else parts.push(book.pageCount ? `${book.pageCount} páginas` : 'sin paginación');
  if (book.status === 'reading') parts.push(`leyendo, ${formatPercent(percentRead(book))}`);
  if (book.rating) parts.push(ratingText(book.rating));
  if (book.quotes.length) parts.push(`${book.quotes.length} citas`);
  return parts.filter(Boolean).join(' · ');
}

/** Arrastrar para mover entre baldas o reordenar (escritorio). */
function dragProps(book, draggable) {
  if (!draggable) return {};
  return {
    draggable: true,
    onDragStart: (event) => {
      event.dataTransfer.setData('application/x-bookshelf', book.id);
      event.dataTransfer.setData('text/plain', book.title);
      event.dataTransfer.effectAllowed = 'move';
      event.currentTarget.dataset.dragging = 'true';
      document.body.dataset.draggingBook = 'true';
    },
    onDragEnd: (event) => {
      delete event.currentTarget.dataset.dragging;
      delete document.body.dataset.draggingBook;
    },
  };
}

/** Grosor del lomo según la edición: el e-reader es una lámina y el estuche tiene medida fija. */
function spineW(book) {
  if (book.editionType === 'kindle') return 8;
  if (book.editionType === 'audiobook') return 18;
  const w = spineWidth(book.pageCount);
  return book.editionType === 'paperback' ? Math.max(9, w * 0.92) : w;
}

const NERVES = [0.2, 0.36, 0.52, 0.68];

/**
 * Libro físico reutilizable (SPEC §35.2): la portada REAL como cara principal, completa y sin estirar; un lomo
 * estrecho del color de la cubierta, el bloque de páginas en marfil asomando por el corte y una sombra de contacto.
 * Sin letras falsas en el lomo ni insignias encima: los acabados solo cuando son de esa edición (cuero, cantos
 * pintados, post-its de la anotada); el e-reader va en su marco y el audiolibro lleva una marca pequeña.
 * `variant`: «shelf» (apoyado en la balda, botón) o «corner» (más contenido, decorativo).
 */
export function PhysicalBook({ book, variant = 'shelf', spine, edge = sprayedEdge(book), scale = 1, className = '', ...rest }) {
  const edition = book.editionType;
  const device = edition === 'kindle';
  const Tag = variant === 'shelf' ? 'button' : 'span';
  return (
    <Tag
      {...rest}
      className={`pbook ${className}`.trim()}
      data-variant={variant}
      data-edition={edition}
      data-device={device || undefined}
      data-bezel={device ? bezel(book) : undefined}
      aria-hidden={variant === 'shelf' ? undefined : 'true'}
      style={{ '--spine': spine ?? spineColor(book), '--scale': scale }}
    >
      <span className="pbook__body">
        {!device && <span className="pbook__spine" />}
        {!device && <span className={`pbook__pages${edge ? ` edge--${edge}` : ''}`} />}
        <span className="pbook__cover">
          <Cover book={book} />
          {edition === 'leatherbound' && (
            <>
              <span className="pbook__corner pbook__corner--top" />
              <span className="pbook__corner pbook__corner--bottom" />
            </>
          )}
        </span>
        {edition === 'annotated' && (
          <span className="pbook__notes">
            {annotatedNotes(book)
              .filter((n) => n.side === 'right')
              .slice(0, 3)
              .map((n, i) => (
                <span key={i} style={{ top: `${n.at}%`, '--note': n.color }} />
              ))}
          </span>
        )}
        {edition === 'audiobook' && (
          <span className="pbook__audio" title={`Audiolibro · ${audioHours(book)} h`}>
            <Headphones />
          </span>
        )}
      </span>
      <span className="pbook__shadow" />
    </Tag>
  );
}

export const BookItem = forwardRef(function BookItem({ book, mode, rowHeight, onOpen, onEdition, picked = false, draggable = false }, ref) {
  const edition = book.editionType;
  // Color determinista al momento; el de la portada llega después, solo si está visible y lo permite CORS
  const [coverSpine, observe] = useCoverColor(book);
  const physics = calculateBookPhysics(book);
  const setRef = useCallback(
    (el) => {
      observe(el);
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [observe, ref],
  );
  const edge = sprayedEdge(book);
  const h = Math.round(rowHeight * spineHeight(book));
  const reading = book.status === 'reading';
  const silkRibbon = edition === 'clothbound';
  const title = `${book.title} · ${EDITIONS[edition]?.label}${onEdition ? ' · clic derecho: cambiar edición' : ''}`;
  const common = {
    ref: setRef,
    'data-material': physics.material,
    'data-foil': physics.goldFoil || undefined,
    type: 'button',
    ...dragProps(book, draggable),
    'data-book-id': book.id,
    'data-picked': picked || undefined,
    'data-edition': edition,
    'data-edge': edge || undefined,
    'data-bezel': edition === 'kindle' ? bezel(book) : undefined,
    onClick: () => onOpen(book),
    onContextMenu: onEdition
      ? (event) => {
          event.preventDefault();
          onEdition(book, event);
        }
      : undefined,
    'aria-label': describe(book),
    title,
  };

  if (mode === 'spine') {
    const w = spineW(book);
    const device = edition === 'kindle' || edition === 'audiobook';
    return (
      <button {...common} className="spine" style={{ width: w, height: h, '--spine': coverSpine }}>
        {edge && <span className={`spine__top edge--${edge}`} title={`Cantos: ${EDGE_NAMES[edge]}`} />}
        <Tabs quotes={book.quotes} />
        {edition === 'annotated' && (
          <span className="spine__notes" aria-hidden="true">
            {annotatedNotes(book)
              .slice(0, 3)
              .map((n, i) => (
                <span key={i} style={{ '--note': n.color, left: `${14 + i * 28}%`, '--out': `${n.out}px` }} />
              ))}
          </span>
        )}
        {edition === 'leatherbound' && (
          <span className="spine__nerves" aria-hidden="true">
            {NERVES.map((y) => (
              <span key={y} style={{ top: `${y * 100}%` }} />
            ))}
          </span>
        )}
        {edition === 'clothbound' && <span className="spine__stamp" aria-hidden="true" />}
        {edition === 'kindle' && <span className="spine__button" aria-hidden="true" />}
        {!device && <span className="spine__band spine__band--top" />}
        {edition === 'audiobook' ? (
          <span className="spine__audio" aria-hidden="true">
            <AudioLines />
            <b>{audioHours(book)}h</b>
          </span>
        ) : (
          edition !== 'kindle' && <span className="spine__title">{book.title}</span>
        )}
        {!device && <span className="spine__author">{book.author.split(',')[0].split(' ').slice(-1)[0]}</span>}
        {!device && <span className="spine__band spine__band--bottom" />}
        {edition === 'annotated' && <span className="spine__belly" aria-hidden="true" />}
        {(reading || silkRibbon) && (
          <span className="ribbon" data-silk={silkRibbon || undefined} style={{ '--ribbon-h': `${Math.min(26, 12 + progress(book) / 6)}px` }} />
        )}
      </button>
    );
  }

  // Escaparate (SPEC §35.2): el libro físico sobre la portada real (cubierta, lomo estrecho, cantos y sombra)
  return <PhysicalBook {...common} book={book} variant="shelf" spine={coverSpine} edge={edge} scale={Math.min(1, 0.9 + (spineHeight(book) - 0.89) * 0.6)} />;
});
