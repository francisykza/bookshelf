// Identidad de obra de un libro para la comunidad (SPEC §25.2). Si el libro no trae referencia de Open Library pero
// sí ISBN, se pregunta UNA vez al catálogo de Open Library a qué obra pertenece ese ISBN y se guarda en el libro
// (`workRef`; `workRefIsbn` recuerda el ISBN consultado aunque no haya obra). Así dos personas con el mismo libro
// —aunque lo añadieran de forma distinta— ven las mismas opiniones, sin fusionar nunca por título.
import { useEffect, useState } from 'react';
import { workKeyForIsbn } from '../../services/bookApi';
import { findWork } from '../social/services/community';
import { externalWorkRef } from './opinion';

const pending = new Map();
/** Una consulta por ISBN aunque la pidan a la vez la hoja de Lectores y los controles de publicación. */
export function resolveIsbn(isbn) {
  if (!pending.has(isbn)) pending.set(isbn, workKeyForIsbn(isbn).catch(() => undefined));
  return pending.get(isbn);
}

/**
 * `{ ref, workId, ready }`: `ref` es la obra externa verificada (o null), `workId` la obra de la comunidad que
 * corresponde a este libro (la externa si ya existe en el servidor; si no, la local propia del libro) y `ready`
 * indica que ya no queda nada por resolver. `lookup`: consultar también `works` en el servidor.
 */
export function useWorkIdentity(book, onUpdate, { lookup = false } = {}) {
  const ref = externalWorkRef(book);
  const isbn = String(book?.isbn ?? '').replace(/[^0-9Xx]/g, '');
  const needsIsbn = !ref && isbn && book.workRefIsbn !== isbn;
  const [remote, setRemote] = useState({ ref: null, id: null, done: false });

  useEffect(() => {
    if (!needsIsbn) return undefined;
    let alive = true;
    resolveIsbn(isbn).then((key) => {
      // undefined = fallo de red: se reintentará en otra ocasión (no se marca como consultado)
      if (!alive || key === undefined) return;
      onUpdate(key ? { workRef: { source: 'openlibrary', id: key }, workRefIsbn: isbn } : { workRefIsbn: isbn });
    });
    return () => {
      alive = false;
    };
  }, [needsIsbn, isbn, onUpdate]);

  useEffect(() => {
    if (!lookup || !ref) return undefined;
    let alive = true;
    findWork(ref)
      .then((id) => alive && setRemote({ ref, id, done: true }))
      .catch(() => alive && setRemote({ ref, id: null, done: true }));
    return () => {
      alive = false;
    };
  }, [lookup, ref]);

  const lookedUp = remote.done && remote.ref === ref;
  const workId = ref ? (lookedUp ? remote.id : null) : (book?.workId ?? null);
  return { ref, workId, ready: !needsIsbn && (!lookup || !ref || lookedUp) };
}
