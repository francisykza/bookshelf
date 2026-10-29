// Archivos EPUB en este dispositivo (SPEC §53, §54.2): IndexedDB `bookshelf-files`, almacén `epubs`, uno por libro y
// cuenta (clave `usuario:libro`). El contenido nunca sale de aquí; con la cuenta solo viajan los metadatos (`book.epub`)
// y la posición. Las claves de la 1.55 (solo el id del libro) se leen una vez y se trasladan a la cuenta actual.
const DB = 'bookshelf-files';
const STORE = 'epubs';

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Este navegador no permite guardar archivos.'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('No se ha podido abrir el almacén de archivos.'));
  });
}

async function run(mode, fn) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let value;
      fn(tx.objectStore(STORE), (v) => {
        value = v;
      });
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error ?? new Error('No se ha podido guardar el archivo.'));
      tx.onabort = () => reject(tx.error ?? new Error('No hay espacio para guardar el archivo en este dispositivo.'));
    });
  } finally {
    db.close();
  }
}

const keyOf = (userId, bookId) => `${userId || 'local'}:${bookId}`;

/**
 * Guarda el archivo (ArrayBuffer: algunos WebKit no guardan Blob en IndexedDB) con su huella. Sustituye al anterior del
 * mismo libro en una sola transacción: si falla, el anterior sigue intacto. Resuelve cuando se ha confirmado.
 */
export const putEpub = (userId, bookId, { data, hash, name, size }) =>
  run('readwrite', (s) => {
    s.put({ data, hash, name, size, savedAt: new Date().toISOString() }, keyOf(userId, bookId));
    s.delete(bookId);
  });

/** `{ data, hash, name, size }` o `undefined` si en este dispositivo no está (para esta cuenta). */
export async function getEpub(userId, bookId) {
  const own = await run('readonly', (s, done) => {
    const req = s.get(keyOf(userId, bookId));
    req.onsuccess = () => done(req.result);
  });
  if (own) return own;
  const legacy = await run('readonly', (s, done) => {
    const req = s.get(bookId);
    req.onsuccess = () => done(req.result);
  });
  if (!legacy) return undefined;
  // Archivo de la 1.55: pasa a la cuenta que lo abre ahora
  await run('readwrite', (s) => {
    s.put(legacy, keyOf(userId, bookId));
    s.delete(bookId);
  });
  return legacy;
}

/** Quita el archivo de este dispositivo (no toca el libro, sus notas ni su posición sincronizada). */
export const deleteEpub = (userId, bookId) =>
  run('readwrite', (s) => {
    s.delete(keyOf(userId, bookId));
    s.delete(bookId);
  });
