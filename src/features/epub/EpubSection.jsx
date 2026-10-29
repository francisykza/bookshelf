// «Libro digital» en la Ficha (SPEC §53): añadir el EPUB de este libro (se guarda solo en este dispositivo), leerlo y
// quitarlo. JSZip se carga al elegir un archivo y el lector, al pulsar «Leer»; nunca al abrir la habitación.
import { BookOpenText, FileUp } from 'lucide-react';
import { Suspense, lazy, useEffect, useId, useState } from 'react';
import { deleteEpub, getEpub, putEpub } from './epubStore';

const EpubReader = lazy(() => import('./EpubReader').then((m) => ({ default: m.EpubReader })));
const mib = (b) => (b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1).replace('.', ',')} MiB`);
const MAX_FILE = 60 * 1024 * 1024;

export function EpubSection({ book, onUpdate }) {
  const uid = useId();
  const [local, setLocal] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reading, setReading] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    let alive = true;
    getEpub(book.id)
      .then((r) => alive && setLocal(r ? { hash: r.hash, name: r.name, size: r.size } : null))
      .catch(() => alive && setLocal(null));
    return () => {
      alive = false;
    };
  }, [book.id]);

  const choose = async (file, input) => {
    setError('');
    setNotice('');
    if (!file) return;
    if (file.size > MAX_FILE) {
      setError(`El archivo pesa ${mib(file.size)} y el máximo es ${mib(MAX_FILE)}.`);
      return;
    }
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      const [{ default: JSZip }, epub] = await Promise.all([import('jszip'), import('./epubFile')]);
      const parsed = await epub.openEpub(JSZip, buffer);
      const hash = await epub.epubHash(buffer);
      const other = book.epub?.hash && book.epub.hash !== hash;
      await putEpub(book.id, { data: buffer, hash, name: file.name, size: file.size });
      onUpdate({
        epub: { name: file.name, size: file.size, hash, chapters: parsed.chapters.length, lite: parsed.lite, addedAt: new Date().toISOString() },
        ...(other ? { epubPosition: null } : null),
      });
      setLocal({ hash, name: file.name, size: file.size });
      if (other) setNotice('Es un archivo distinto del que guardaste antes: la lectura empezará desde el principio.');
      else if (parsed.lite) setNotice('Este libro tiene muchas imágenes: se abrirá en modo ligero (algunas se mostrarán como texto).');
    } catch (e) {
      setError(e?.friendly ? e.message : e?.name === 'QuotaExceededError' ? 'No queda espacio en este dispositivo para guardar el EPUB.' : 'No se ha podido guardar el EPUB en este dispositivo.');
    } finally {
      setBusy(false);
      if (input) input.value = '';
    }
  };

  const remove = async () => {
    setConfirmRemove(false);
    try {
      await deleteEpub(book.id);
      setLocal(null);
      setNotice('El archivo se ha quitado de este dispositivo. Tu posición y tus notas se conservan.');
    } catch {
      setError('No se ha podido quitar el archivo.');
    }
  };

  const picker = (label) => (
    <>
      <input id={`${uid}-epub`} className="epub-file" type="file" accept=".epub,application/epub+zip" disabled={busy} onChange={(e) => choose(e.target.files?.[0], e.target)} />
      <label htmlFor={`${uid}-epub`} className="sheet-btn epub-pick" data-disabled={busy || undefined}>
        <FileUp aria-hidden="true" />
        {busy ? 'Comprobando el archivo…' : label}
      </label>
    </>
  );

  return (
    <section className="epub-box" aria-labelledby={`${uid}-title`}>
      <h4 id={`${uid}-title`}>Libro digital</h4>
      {local === undefined ? null : local ? (
        <>
          <p className="epub-box__file">
            {local.name} · {mib(local.size)}
            {book.epub?.lite ? ' · modo ligero' : ''}
          </p>
          <div className="epub-box__actions">
            <button type="button" className="sheet-btn sheet-btn--primary craft craft--terra" onClick={() => setReading(true)}>
              <BookOpenText aria-hidden="true" />
              Leer
            </button>
            {confirmRemove ? (
              <span className="confirm-inline">
                ¿Quitar el archivo de este dispositivo?
                <button type="button" className="link-btn link-btn--danger" onClick={remove}>
                  Sí, quitar
                </button>
                <button type="button" className="link-btn" onClick={() => setConfirmRemove(false)}>
                  Cancelar
                </button>
              </span>
            ) : (
              <button type="button" className="link-btn" onClick={() => setConfirmRemove(true)}>
                Quitar de este dispositivo
              </button>
            )}
          </div>
        </>
      ) : book.epub ? (
        <>
          <p>Tienes «{book.epub.name}» en otro dispositivo. Elige el mismo archivo para leerlo aquí; tu posición y tus notas te esperan.</p>
          {picker('Elegir el EPUB')}
        </>
      ) : (
        <>
          <p>Añade el EPUB de este libro para leerlo aquí. El archivo se guarda solo en este dispositivo; con tu cuenta viajan tu posición y tus notas.</p>
          {picker('Añadir EPUB')}
        </>
      )}
      <p className="epub-box__hint">Hasta 60 MiB.</p>
      {notice && (
        <p className="epub-box__note" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="epub-box__error" role="alert">
          {error}
        </p>
      )}
      {reading && (
        <Suspense fallback={null}>
          <EpubReader book={book} onClose={() => setReading(false)} />
        </Suspense>
      )}
    </section>
  );
}
