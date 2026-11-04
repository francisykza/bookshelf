// «Imagen de la reseña» (1.85): enseña cómo queda y la deja compartir o guardar, para subirla a TikTok u otra red. No publica nada
// por su cuenta. Las imágenes se preparan antes de tocar el botón porque el iPhone solo comparte justo después del toque.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { FORMATOS, PAPELES, dibujarResena } from './reviewCard';
import './review-export.css';

const aBlob = (lienzo) => new Promise((resolve) => lienzo.toBlob(resolve, 'image/png'));
const nombreArchivo = (book, k, total) => {
  const base = book.title.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'libro';
  return `resena-${base}${total > 1 ? `-${k + 1}` : ''}.png`;
};

function Opcion({ etiqueta, valores, valor, onCambio }) {
  return (
    <fieldset className="rx-opcion">
      <legend>{etiqueta}</legend>
      <div>
        {Object.entries(valores).map(([id, v]) => (
          <button key={id} type="button" aria-pressed={id === valor} onClick={() => onCambio(id)}>
            {v.nombre}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function ReviewExport({ book, texto, nombre, root, onClose }) {
  const [formato, setFormato] = useState('tiktok');
  const [papel, setPapel] = useState('cuaderno');
  const [detalles, setDetalles] = useState(true);
  const [conCita, setConCita] = useState(false);
  const [imagenes, setImagenes] = useState(null);
  const [aviso, setAviso] = useState('');
  const dialogo = useRef(null);
  const cita = useMemo(() => [...(book.quotes ?? [])].filter((q) => q.text?.trim()).sort((a, b) => a.text.length - b.text.length).find((q) => q.text.length <= 240) ?? null, [book.quotes]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    dialogo.current?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  useEffect(() => {
    let vivo = true;
    let urls = [];
    dibujarResena({ book, texto, nombre, formato, papel, detalles, cita: conCita ? cita : null })
      .then(async ({ lienzos, sinPortada }) => {
        const blobs = await Promise.all(lienzos.map(aBlob));
        if (!vivo) return;
        urls = blobs.map((b) => URL.createObjectURL(b));
        setImagenes({ blobs, urls, sinPortada });
      })
      .catch(() => vivo && setAviso('No se ha podido preparar la imagen. Inténtalo otra vez.'));
    return () => {
      vivo = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [book, texto, nombre, formato, papel, detalles, conCita, cita]);

  const archivos = imagenes?.blobs.map((b, k) => new File([b], nombreArchivo(book, k, imagenes.blobs.length), { type: 'image/png' })) ?? [];
  const sePuedeCompartir = archivos.length > 0 && navigator.canShare?.({ files: archivos });
  const compartir = async () => {
    try {
      await navigator.share({ files: archivos, title: `Mi reseña de ${book.title}` });
    } catch (e) {
      if (e?.name !== 'AbortError') setAviso('No se ha podido compartir. Prueba a guardarla.');
    }
  };
  const guardar = () => {
    imagenes.urls.forEach((url, k) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = archivos[k].name;
      a.click();
    });
    setAviso(imagenes.urls.length > 1 ? 'Imágenes descargadas.' : 'Imagen descargada.');
  };
  const total = imagenes?.urls.length ?? 0;

  return createPortal(
    <div className="rx" role="dialog" aria-modal="true" aria-label="Imagen de la reseña" tabIndex={-1} ref={dialogo} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rx__hoja">
        <header className="rx__cabecera">
          <h3>Imagen de la reseña</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="rx__vista" data-formato={formato}>
          {imagenes ? imagenes.urls.map((url, k) => <img key={url} src={url} alt={`Imagen ${k + 1} de ${total} de tu reseña de ${book.title}`} />) : <p>Preparando…</p>}
        </div>
        {total > 1 && <p className="rx__nota">Tu reseña ocupa {total} imágenes: desliza para verlas. En TikTok se suben como carrusel.</p>}
        {imagenes && !sePuedeCompartir && window.matchMedia?.('(pointer: coarse)').matches && <p className="rx__nota">Si no se descarga, mantén pulsada la imagen para guardarla.</p>}
        {imagenes?.sinPortada && <p className="rx__nota">No se ha podido usar la portada, así que va una cubierta dibujada.</p>}
        <Opcion etiqueta="Formato" valores={FORMATOS} valor={formato} onCambio={setFormato} />
        <Opcion etiqueta="Papel" valores={PAPELES} valor={papel} onCambio={setPapel} />
        <div className="rx__marcas">
          <label>
            <input type="checkbox" checked={detalles} onChange={(e) => setDetalles(e.target.checked)} /> Datos de la lectura
          </label>
          {cita && (
            <label>
              <input type="checkbox" checked={conCita} onChange={(e) => setConCita(e.target.checked)} /> Añadir una cita
            </label>
          )}
        </div>
        {aviso && (
          <p className="rx__nota" role="status">
            {aviso}
          </p>
        )}
        <div className="rx__acciones">
          {sePuedeCompartir && (
            <button type="button" className="sheet-btn sheet-btn--primary craft craft--terra" onClick={compartir}>
              Compartir
            </button>
          )}
          <button type="button" className={`sheet-btn craft ${sePuedeCompartir ? '' : 'sheet-btn--primary craft--terra'}`} disabled={!imagenes} onClick={guardar}>
            {total > 1 ? 'Guardar imágenes' : 'Guardar imagen'}
          </button>
        </div>
      </div>
    </div>,
    root,
  );
}
