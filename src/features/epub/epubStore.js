// Archivos EPUB en este dispositivo (SPEC §53): IndexedDB `bookshelf-files`, almacén `epubs`, uno por libro. El contenido
// nunca sale de aquí; con la cuenta solo viajan los metadatos (`book.epub`) y la posición de lectura.
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
      const req = fn(tx.objectStore(STORE));
      let value;
      req.onsuccess = () => {
        value = req.result;
      };
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error ?? new Error('No se ha podido guardar el archivo.'));
      tx.onabort = () => reject(tx.error ?? new Error('No hay espacio para guardar el archivo en este dispositivo.'));
    });
  } finally {
    db.close();
  }
}

/**
 * Guarda el archivo (ArrayBuffer: algunos WebKit no guardan Blob en IndexedDB) con su huella; resuelve solo cuando la
 * transacción se ha confirmado.
 */
export const putEpub = (bookId, { data, hash, name, size }) => run('readwrite', (s) => s.put({ data, hash, name, size, savedAt: new Date().toISOString() }, bookId));
/** `{ data, hash, name, size }` o `undefined` si en este dispositivo no está. */
export const getEpub = (bookId) => run('readonly', (s) => s.get(bookId));
export const deleteEpub = (bookId) => run('readwrite', (s) => s.delete(bookId));
