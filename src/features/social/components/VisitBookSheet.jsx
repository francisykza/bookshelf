// Hojas de la visita (SPEC §56): «Libros compartidos» (portadas legibles, tres por fila) y la ficha de un libro
// compartido. Son referencias públicas de OTRA persona: nunca se abre su ficha con BookDetailModal ni con un id de la
// biblioteca propia; lo único que se puede hacer es «Añadir a pendientes», de forma explícita.
import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { PhysicalBook } from '../../../components/shelf/BookItem';
import { ReviewCard } from '../../reviews/ReadersPanel';
import { reviewsFor } from '../visit';
import { AddToPending } from './AddToPending';

/** Libro público como objeto físico contenido (sin edición inventada: tapa dura neutra, como en el perfil). */
const asBook = (ref, key) => ({ id: key, title: ref.title, author: ref.author ?? '', cover: ref.cover ?? '', editionType: 'hardcover' });

function SheetHead({ title, onBack, backLabel }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <header className="reader-visit__sheet-head">
      <button type="button" className="reader-visit__icon" onClick={onBack} aria-label={backLabel}>
        <ArrowLeft aria-hidden="true" />
      </button>
      <h3 ref={ref} tabIndex={-1}>
        {title}
      </h3>
    </header>
  );
}

export function SharedBooksSheet({ items, alias, profile, reviews, onOpenBook, onBack }) {
  return (
    <section className="reader-visit__sheet" role="dialog" aria-modal="true" aria-label={`Libros compartidos por ${alias}`}>
      <SheetHead title="Libros compartidos" onBack={onBack} backLabel="Volver a su rincón" />
      <div className="reader-visit__sheet-body">
        <p className="reader-visit__hint">Lo que {alias} ha decidido compartir; no es su biblioteca completa.</p>
        {items.length ? (
          <ul className="reader-visit__grid">
            {items.map((it) => (
              <li key={it.key}>
                <button type="button" className="reader-visit__book" onClick={() => onOpenBook(it.key)} aria-label={`${it.ref.title}${it.ref.author ? `, de ${it.ref.author}` : ''}`}>
                  <span className="reader-visit__cover" aria-hidden="true">
                    <PhysicalBook book={asBook(it.ref, it.key)} variant="corner" />
                  </span>
                  <span className="reader-visit__book-title" aria-hidden="true">
                    {it.ref.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="social-note">Aún no ha compartido libros.</p>
        )}
        {reviews.length > 0 && (
          <section className="reader-visit__reviews" aria-label="Reseñas publicadas">
            <h4>Reseñas publicadas</h4>
            {reviews.map((r) => (
              <div key={r.id} className="reader-profile__review">
                {r.work && <p className="social-hand">{r.work.title}</p>}
                <ReviewCard review={r} author={profile} mine={false} />
              </div>
            ))}
          </section>
        )}
      </div>
    </section>
  );
}

export function VisitBookSheet({ item, alias, profile, reviews, onBack }) {
  const own = item ? reviewsFor(reviews, item.ref) : [];
  return (
    <section className="reader-visit__sheet reader-visit__sheet--book" role="dialog" aria-modal="true" aria-label={item ? item.ref.title : 'Libro compartido'}>
      <SheetHead title={item ? item.ref.title : 'Libro compartido'} onBack={onBack} backLabel="Volver a los libros compartidos" />
      <div className="reader-visit__sheet-body">
        {item ? (
          <>
            <div className="reader-visit__detail">
              <span className="reader-visit__detail-cover" aria-hidden="true">
                <PhysicalBook book={asBook(item.ref, item.key)} variant="corner" />
              </span>
              <div>
                <p className="reader-visit__detail-title">{item.ref.title}</p>
                {item.ref.author && <p className="reader-visit__detail-author">{item.ref.author}</p>}
                <ul className="reader-visit__origins">
                  {item.origins.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              </div>
            </div>
            {item.phrase && <blockquote className="reader-visit__phrase">«{item.phrase}»</blockquote>}
            <AddToPending book={item.ref} from={{ kind: 'corner', ownerAlias: alias }} />
            {own.map((r) => (
              <ReviewCard key={r.id} review={r} author={profile} mine={false} />
            ))}
          </>
        ) : (
          <p className="social-note">Este libro ya no está compartido.</p>
        )}
      </div>
    </section>
  );
}
