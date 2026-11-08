// Vista previa de las tarjetas del mes. Nada se publica: se comparte con el propio dispositivo o se descarga. Las imágenes se preparan antes del
// toque porque el iPhone solo comparte justo después de un gesto. Estados finitos: preparing → ready | error, nunca un «Preparando…» sin salida.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cargarPiezas, cargarPortadas, dibujarMes, esperarFuentes, olvidarFallidas } from './monthCard';
import '../reviews/review-export.css';

/** Topes en milisegundos: cada portada, todas juntas, las fuentes y el paso a PNG. */
export const LIMITES = { portada: 6000, portadas: 15000, fuentes: 2500, blob: 10000 };

const caduca = (ms, motivo) => new Promise((_, reject) => setTimeout(() => reject(new Error(motivo)), ms));
const aBlob = (lienzo) =>
  new Promise((resolve, reject) => {
    lienzo.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('blob'))), 'image/png');
  });

export function MonthExport({ summary, etiqueta, onClose }) {
  // La instantánea que se abrió: si llega una sincronización mientras se prepara, ni se reinicia ni cambian las cifras
  const [foto] = useState(summary);
  const [conFavoritos, setConFavoritos] = useState(true);
  const [conFrase, setConFrase] = useState(true);
  const [estado, setEstado] = useState({ fase: 'preparing' });
  const [intento, setIntento] = useState(0);
  const [sustitutas, setSustitutas] = useState(false);
  const [aviso, setAviso] = useState('');
  const dialogo = useRef(null);
  const memo = useRef(new Map());

  useEffect(() => {
    dialogo.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const control = new AbortController();
    let urls = [];
    let lienzos = [];
    const liberar = () => {
      lienzos.forEach((l) => {
        l.width = 0;
        l.height = 0;
      });
      lienzos = [];
    };
    const etapas = {};
    const marcar = async (nombre, tarea) => {
      const t0 = performance.now();
      const r = await tarea();
      etapas[nombre] = Math.round(performance.now() - t0);
      return r;
    };
    setEstado({ fase: 'preparing' });
    setAviso('');
    (async () => {
      const libros = await marcar('datos', () => foto.finished.map((f) => f.book));
      if (!sustitutas) {
        await marcar('portadas', () => Promise.race([cargarPortadas(libros, memo.current, { ms: LIMITES.portada, signal: control.signal }), caduca(LIMITES.portadas, 'tiempo')]));
      }
      const [, piezas] = await marcar('fuentes', () => Promise.all([esperarFuentes(LIMITES.fuentes), cargarPiezas(LIMITES.fuentes)]));
      if (control.signal.aborted) return;
      lienzos = await marcar('rasterizado', () => dibujarMes({ summary: foto, etiqueta, imagenes: memo.current, piezas, conFavoritos, conFrase }));
      const blobs = await marcar('blob', () => Promise.race([Promise.all(lienzos.map(aBlob)), caduca(LIMITES.blob, 'blob')]));
      liberar();
      if (control.signal.aborted) return;
      urls = blobs.map((b) => URL.createObjectURL(b));
      const sinPortada = libros.filter((b) => b.cover && !memo.current.get(b.id)).length;
      setEstado({ fase: 'ready', blobs, urls, sinPortada, etapas });
    })().catch((e) => {
      liberar();
      if (!control.signal.aborted) setEstado({ fase: 'error', motivo: e?.message, etapas });
    });
    return () => {
      control.abort();
      liberar();
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [foto, etiqueta, conFavoritos, conFrase, intento, sustitutas]);

  const lista = estado.fase === 'ready';
  const total = lista ? estado.urls.length : 0;
  const archivos = lista ? estado.blobs.map((b, k) => new File([b], `mi-mes-en-libros-${foto.month}${total > 1 ? `-${k + 1}` : ''}.png`, { type: 'image/png' })) : [];
  const sePuedeCompartir = archivos.length > 0 && navigator.canShare?.({ files: archivos });
  const compartir = async () => {
    try {
      await navigator.share({ files: archivos, title: `Mi mes en libros: ${etiqueta}` });
    } catch (e) {
      // Cancelar el menú de compartir no es un fallo
      if (e?.name !== 'AbortError') setAviso('No se ha podido compartir. Puedes guardarla.');
    }
  };
  const guardar = () => {
    // Safari se queda solo con la última si varias descargas salen a la vez: una cada medio segundo
    estado.urls.forEach((url, k) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = url;
        a.download = archivos[k].name;
        a.click();
      }, k * 500);
    });
    setAviso(total > 1 ? 'Imágenes descargadas.' : 'Imagen descargada.');
  };
  const reintentar = () => {
    olvidarFallidas();
    memo.current.clear();
    setSustitutas(false);
    setIntento((n) => n + 1);
  };

  return createPortal(
    <div className="rx mb-export" role="dialog" aria-modal="true" aria-label="Vista previa del resumen" tabIndex={-1} ref={dialogo} data-escape-local="open" data-estado={estado.fase} data-etapas={estado.etapas ? JSON.stringify(estado.etapas) : undefined} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rx__hoja">
        <header className="rx__cabecera">
          <h3>Vista previa</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar la vista previa">
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="rx__vista" data-formato="tiktok">
          {lista && estado.urls.map((url, k) => <img key={url} src={url} alt={`Tarjeta ${k + 1} de ${total} de ${etiqueta}`} />)}
          {estado.fase === 'preparing' && <p role="status">Preparando…</p>}
          {estado.fase === 'error' && <p role="alert">{estado.motivo === 'tiempo' ? 'Algunas portadas están tardando demasiado.' : 'No se ha podido preparar la imagen.'}</p>}
        </div>
        {estado.fase === 'error' && (
          <div className="rx__acciones">
            <button type="button" className="sheet-btn sheet-btn--primary craft craft--terra" onClick={reintentar}>
              Reintentar
            </button>
            {estado.motivo === 'tiempo' && (
              <button type="button" className="sheet-btn craft" onClick={() => setSustitutas(true)}>
                Generar con portadas sustitutas
              </button>
            )}
          </div>
        )}
        {total > 1 && <p className="rx__nota">Tu mes ocupa {total} tarjetas: desliza para verlas.</p>}
        {estado.sinPortada > 0 && (
          <p className="rx__nota">
            {estado.sinPortada === 1 ? 'Una portada no se ha podido usar' : `${estado.sinPortada} portadas no se han podido usar`}: va una cubierta con el título.{' '}
            <button type="button" className="link-btn" onClick={reintentar}>
              Reintentar
            </button>
          </p>
        )}
        {(foto.podium.length > 0 || foto.quote.trim()) && (
          <div className="rx__marcas">
            {foto.podium.length > 0 && (
              <label>
                <input type="checkbox" checked={conFavoritos} onChange={(e) => setConFavoritos(e.target.checked)} /> Incluir mis favoritos
              </label>
            )}
            {foto.quote.trim() && (
              <label>
                <input type="checkbox" checked={conFrase} onChange={(e) => setConFrase(e.target.checked)} /> Incluir mi recuerdo
              </label>
            )}
          </div>
        )}
        {aviso && (
          <p className="rx__nota" role="status">
            {aviso}
          </p>
        )}
        {estado.fase !== 'error' && (
          <div className="rx__acciones">
            {sePuedeCompartir && (
              <button type="button" className="sheet-btn sheet-btn--primary craft craft--terra" onClick={compartir}>
                Compartir
              </button>
            )}
            <button type="button" className={`sheet-btn craft ${sePuedeCompartir ? '' : 'sheet-btn--primary craft--terra'}`} disabled={!lista} onClick={guardar}>
              {total > 1 ? 'Guardar imágenes' : 'Guardar imagen'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.querySelector('.panel--port-computer') ?? document.body,
  );
}
