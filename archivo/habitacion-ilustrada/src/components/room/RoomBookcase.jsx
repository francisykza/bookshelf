// La estantería del rincón (Rincón 01). Arriba, un solo libro expuesto de frente, con su canto y su sombra; en las tres
// baldas de abajo, lomos estrechos del color de su edición, en grupos con hueco para respirar. Dos capas con la misma
// geometría: el dibujo (`BookcaseArt`, por debajo de la hiedra y de la luz, sin eventos) y los botones
// (`BookcaseHits`, en la capa de los hotspots). Cada balda es un rectángulo local proyectado con `rectToQuad` sobre su
// cuadrilátero medido, y el canto del tablón, recortado de la propia ilustración, tapa la base de lo que se apoya.
import { useEffect, useState } from 'react';
import { spineColor, sprayedEdge, visualEdition } from '../../domain/books';
import { inkFor } from '../../domain/roomShelf';
import { projectPoint, rectToQuad } from '../../scene/homography';
import { BOOKCASE_LIPS, SCENE_H, SCENE_REFRESH, SCENE_W, pts } from '../../scene/sceneMap';
import { useSceneArt } from '../../hooks/useSceneArt';
import { useSvgIds } from '../../hooks/useSvgIds';
import { watchCover } from '../shelf/BookItem';
import { FEATURE_BOX } from './bookcaseLayout';

/** Lo mínimo que se puede tocar con fiabilidad (px CSS): por debajo, se toca el grupo y se acerca la balda. */
const MIN_TAP = 24;
/** El título vertical solo se escribe donde se lee (px CSS). */
const TITLE_MIN_W = 11;

/** Estado de una portada con la misma caché que la biblioteca (una petición por URL). */
function useCover(src) {
  const [seen, setSeen] = useState({ src: '', status: 'none' });
  useEffect(() => (src ? watchCover(src, (status) => setSeen({ src, status })) : undefined), [src]);
  if (!src) return 'none';
  return seen.src === src ? seen.status : 'loading';
}

function FeaturedCover({ book }) {
  const status = useCover(book.cover || '');
  const { x, w, h, top, skew } = FEATURE_BOX;
  const color = spineColor(book);
  return (
    <div className="rb-feature" data-cover={status} data-ink={inkFor(color)} style={{ left: x, top, width: w, height: h, '--skew': `${skew}rad`, '--spine': color }}>
      <span className="rb-feature__shadow" />
      <span className="rb-feature__edge" />
      {status === 'loaded' ? (
        <img className="rb-feature__img" src={book.cover} alt="" decoding="async" referrerPolicy="no-referrer" draggable="false" />
      ) : (
        // Sin portada, o si falla: título y autor sobre tela mate del color de la edición
        <span className="rb-feature__cloth">
          <span className="rb-feature__title">{book.title}</span>
          {book.author && <span className="rb-feature__author">{book.author}</span>}
        </span>
      )}
    </div>
  );
}

function Spine({ item, scale, showcase = false }) {
  const { book, physics, x, w, h } = item;
  // En la balda de prueba el lomo tiene su grosor natural: el título se escribe a su medida si se llega a leer
  const showTitle = showcase ? w * scale >= 6 : w * scale >= TITLE_MIN_W && h * scale >= 46;
  return (
    <span
      className="rb-spine"
      data-material={physics.material}
      data-edition={visualEdition(book)}
      data-gilt={physics.goldFoil || undefined}
      data-edge={sprayedEdge(book) || undefined}
      data-ink={inkFor(spineColor(book))}
      style={{ left: x, width: w, height: h, '--spine': spineColor(book), ...(showcase ? { '--title-size': `${Math.min(11, Math.round(w * 0.6))}px`, '--title-line': `${w}px` } : null) }}
    >
      {showTitle && <span className="rb-spine__title">{book.title}</span>}
      {book.status === 'reading' && <span className="rb-spine__ribbon" />}
    </span>
  );
}

/** Un ejemplar de frente sobre el tablón, en la perspectiva de la balda: cubierta, canto (girado) y sombra de contacto. */
function FrontCover({ item }) {
  const { book, x, w, h, edge } = item;
  const status = useCover(book.cover || '');
  const color = spineColor(book);
  return (
    <span className="rb-front" data-cover={status} data-ink={inkFor(color)} style={{ left: x, width: w, height: h, '--edge': `${edge}px`, '--spine': color }}>
      <span className="rb-front__shadow" />
      <span className="rb-front__edge" />
      {status === 'loaded' ? (
        <img className="rb-feature__img" src={book.cover} alt="" decoding="async" referrerPolicy="no-referrer" draggable="false" />
      ) : (
        <span className="rb-feature__cloth">
          <span className="rb-feature__title">{book.title}</span>
          {book.author && <span className="rb-feature__author">{book.author}</span>}
        </span>
      )}
      {book.status === 'reading' && <span className="rb-spine__ribbon rb-front__ribbon" />}
    </span>
  );
}

/** El canto de cada balda, recortado de la ilustración de la hora que se ve (día o noche). */
function Lips({ night }) {
  const sid = useSvgIds();
  const { src, ready } = useSceneArt();
  const href = ready && night ? SCENE_REFRESH.night : src;
  return (
    <svg className="rb-lips" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} width={SCENE_W} height={SCENE_H} aria-hidden="true">
      <defs>
        <clipPath clipPathUnits="userSpaceOnUse" id={sid('lips')}>
          {Object.values(BOOKCASE_LIPS).map((poly, i) => (
            <polygon key={i} points={pts(poly)} />
          ))}
        </clipPath>
      </defs>
      <image href={href} width={SCENE_W} height={SCENE_H} clipPath={sid.url('lips')} />
    </svg>
  );
}

export function BookcaseArt({ layout, scale = 1, night = false }) {
  const { featured, rows } = layout;
  return (
    <div className="rb-art" aria-hidden="true">
      {featured && <FeaturedCover book={featured.book} />}
      {rows.map(({ shelf, groups, showcase }) =>
        groups.length ? (
          <div key={shelf.id} className="rb-shelf" data-shelf={shelf.id} data-showcase={showcase || undefined} style={{ width: shelf.width, height: shelf.height, transform: rectToQuad(shelf.width, shelf.height, shelf.quad) }}>
            {groups.map((g) => g.items.map((item) => (item.front ? <FrontCover key={item.book.id} item={item} /> : <Spine key={item.book.id} item={item} scale={scale} showcase={showcase} />)))}
          </div>
        ) : null,
      )}
      <Lips night={night} />
    </div>
  );
}

const names = (items) => items.map((i) => i.book.title).join(', ');

/**
 * Lo que se toca: la portada expuesta abre su ficha; cada lomo, la suya si mide lo bastante en pantalla; si no, su grupo
 * acerca la balda para elegir. Cada botón tiene nombre propio. «Mi biblioteca» sigue en el frente de la balda.
 */
export function BookcaseHits({ layout, scale = 1, onOpenBook, onOpenBalda, onHover }) {
  const { featured, rows } = layout;
  const f = FEATURE_BOX;
  return (
    <div className="rb-hits">
      {featured && (
        <button
          type="button"
          className="rb-hit rb-hit--feature"
          style={{ left: f.x - 6, top: f.top - 4, width: f.w + 12, height: f.h + 10, '--skew': `${f.skew}rad` }}
          aria-label={`${featured.book.title}${featured.book.author ? `, de ${featured.book.author}` : ''}: expuesto en tu estantería. Abrir su ficha`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenBook(featured.book);
          }}
          onPointerEnter={() => onHover?.({ id: 'shelf-feature', x: f.cx, y: f.top - 6, title: featured.book.title, text: featured.book.author, meta: 'Expuesto en tu estantería' })}
          onPointerLeave={() => onHover?.(null)}
        />
      )}
      {rows.map(({ shelf, groups }, row) =>
        groups.length ? (
          <div key={shelf.id} className="rb-hits__shelf" style={{ width: shelf.width, height: shelf.height, transform: rectToQuad(shelf.width, shelf.height, shelf.quad) }}>
            {groups.flatMap((g) => {
              const wide = g.items.filter((i) => i.w * scale >= MIN_TAP);
              const rest = g.items.filter((i) => i.w * scale < MIN_TAP);
              const out = wide.map((i) => (
                  <button
                    key={i.book.id}
                    type="button"
                    className="rb-hit"
                    style={{ left: i.x, width: i.w, height: i.h, bottom: 0 }}
                    aria-label={`${i.book.title}${i.book.author ? `, de ${i.book.author}` : ''}. Abrir su ficha`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenBook(i.book);
                    }}
                  />
              ));
              if (!rest.length) return out;
              const first = rest[0];
              const last = rest.at(-1);
              const tall = Math.max(...rest.map((i) => i.h));
              const anchor = projectPoint(shelf.width, shelf.height, shelf.quad, (first.x + last.x + last.w) / 2, shelf.height - tall);
              return [
                ...out,
                <button
                  key={`${shelf.id}-${g.index}`}
                  type="button"
                  className="rb-hit rb-hit--group"
                  data-shelf={shelf.id}
                  data-group={g.index}
                  style={{ left: first.x - 2, width: last.x + last.w - first.x + 4, height: tall + 4, bottom: 0 }}
                  aria-label={`Balda ${row + 1}, ${rest.length === 1 ? '1 libro' : `${rest.length} libros`}: ${names(rest)}. Acercar la balda para elegir`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenBalda(shelf.id, g.index);
                  }}
                  onPointerEnter={() => onHover?.({ id: `shelf-group-${shelf.id}-${g.index}`, x: anchor.x, y: anchor.y - 6, title: rest.length === 1 ? first.book.title : `${rest.length} libros`, text: 'Toca para acercar la balda', meta: 'Mi estantería' })}
                  onPointerLeave={() => onHover?.(null)}
                />,
              ];
            })}
          </div>
        ) : null,
      )}
    </div>
  );
}
