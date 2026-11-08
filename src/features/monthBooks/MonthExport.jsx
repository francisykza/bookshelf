// Vista previa de la tarjeta del mes (Fase 2). No publica nada: se comparte con el propio dispositivo o se descarga. Las imágenes se preparan antes
// del toque porque el iPhone solo comparte justo después de un gesto.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { dibujarMes } from './monthCard';
import '../reviews/review-export.css';

const aBlob = (lienzo) => new Promise((resolve) => lienzo.toBlob(resolve, 'image/png'));

export function MonthExport({ summary, etiqueta, onClose }) {
  const [conFavorito, setConFavorito] = useState(true);
  const [conFrase, setConFrase] = useState(true);
  const [imagenes, setImagenes] = useState(null);
  const [aviso, setAviso] = useState('');
  const [intento, setIntento] = useState(0);
  const dialogo = useRef(null);

  useEffect(() => {
    dialogo.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    let vivo = true;
    let urls = [];
    setImagenes(null);
    setAviso('');
    dibujarMes({ summary, etiqueta, conFavorito, conFrase })
      .then(async ({ lienzos, sinPortada }) => {
        const blobs = await Promise.all(lienzos.map(aBlob));
        if (!vivo) return;
        urls = blobs.map((b) => URL.createObjectURL(b));
        setImagenes({ blobs, urls, sinPortada });
      })
      .catch(() => vivo && setAviso('No se ha podido preparar la imagen.'));
    return () => {
      vivo = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [summary, etiqueta, conFavorito, conFrase, intento]);

  const total = imagenes?.urls.length ?? 0;
  const archivos = imagenes?.blobs.map((b, k) => new File([b], `mi-mes-en-libros-${summary.month}${total > 1 ? `-${k + 1}` : ''}.png`, { type: 'image/png' })) ?? [];
  const sePuedeCompartir = archivos.length > 0 && navigator.canShare?.({ files: archivos });
  const compartir = async () => {
    try {
      await navigator.share({ files: archivos, title: `Mi mes en libros: ${etiqueta}` });
    } catch (e) {
      if (e?.name !== 'AbortError') setAviso('No se ha podido compartir. Prueba a guardarla.');
    }
  };
  const guardar = () => {
    // Safari se queda solo con la última si varias descargas salen a la vez: una cada medio segundo
    imagenes.urls.forEach((url, k) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = url;
        a.download = archivos[k].name;
        a.click();
      }, k * 500);
    });
    setAviso(total > 1 ? 'Imágenes descargadas.' : 'Imagen descargada.');
  };

  return createPortal(
    <div className="rx mb-export" role="dialog" aria-modal="true" aria-label="Vista previa del resumen" tabIndex={-1} ref={dialogo} data-escape-local="open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rx__hoja">
        <header className="rx__cabecera">
          <h3>Vista previa</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar la vista previa">
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="rx__vista" data-formato="tiktok">
          {imagenes ? imagenes.urls.map((url, k) => <img key={url} src={url} alt={`Tarjeta ${k + 1} de ${total} de ${etiqueta}`} />) : !aviso && <p role="status">Preparando…</p>}
        </div>
        {total > 1 && <p className="rx__nota">Tu mes ocupa {total} tarjetas: desliza para verlas.</p>}
        {imagenes?.sinPortada > 0 && <p className="rx__nota">{imagenes.sinPortada === 1 ? 'Una portada no se ha podido usar' : `${imagenes.sinPortada} portadas no se han podido usar`}: va una cubierta con el título.</p>}
        {(summary.favorite || summary.quote.trim()) && (
          <div className="rx__marcas">
            {summary.favorite && (
              <label>
                <input type="checkbox" checked={conFavorito} onChange={(e) => setConFavorito(e.target.checked)} /> Incluir mi favorito
              </label>
            )}
            {summary.quote.trim() && (
              <label>
                <input type="checkbox" checked={conFrase} onChange={(e) => setConFrase(e.target.checked)} /> Incluir mi recuerdo
              </label>
            )}
          </div>
        )}
        {aviso && (
          <p className="rx__nota" role="status">
            {aviso}
            {!imagenes && (
              <>
                {' '}
                <button type="button" className="link-btn" onClick={() => setIntento(intento + 1)}>
                  Reintentar
                </button>
              </>
            )}
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
    document.querySelector('.panel--port-computer') ?? document.body,
  );
}
