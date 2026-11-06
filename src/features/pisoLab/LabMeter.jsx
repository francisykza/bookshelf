// Medidas en el propio móvil, sin consola ni ordenador conectado. Solo aparece con `&medir=1` en la dirección.
import { useEffect, useState } from 'react';
import { timingLines } from './labTiming';

export const wantsMeter = (search) => new URLSearchParams(search).get('medir') === '1';

/** Cuánto ocupa lo guardado. Aquí se ve si el navegador se queda sin sitio: el móvil real puede admitir menos que el emulado. */
function storageUse() {
  try {
    const chars = localStorage.getItem('bookshelf:v1')?.length ?? 0;
    return `${(chars / 1e6).toFixed(2)} M de caracteres`;
  } catch {
    return 'sin acceso';
  }
}

function coversAsked() {
  const names = performance.getEntriesByType('resource').map((entry) => entry.name);
  return names.filter((name) => name.includes('/lab/covers/')).length;
}

export function LabMeter({ apiRef, total, limit, placed }) {
  const [open, setOpen] = useState(false);
  const [yaw, setYaw] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [debug, setDebug] = useState(null);
  useEffect(() => {
    if (!open) return undefined;
    const read = () => setDebug(apiRef.current?.debug() ?? null);
    read();
    const timer = setInterval(read, 1000);
    return () => clearInterval(timer);
  }, [open, apiRef]);
  const heap = performance.memory?.usedJSHeapSize;
  const lines = [
    `Biblioteca: ${total} libros; en la habitación: ${placed} de ${limit} como mucho`,
    ...timingLines(),
    `Portadas de prueba pedidas: ${coversAsked()}`,
    `Giro: ${yaw ? `${yaw.fps} FPS; fotograma: mediana ${yaw.p50ms} ms, percentil 95 ${yaw.p95ms} ms, peor ${yaw.maxMs} ms; ${yaw.frames} fotogramas` : 'sin medir'}`,
    `Redibujados: ${debug?.exterior.renders ?? '–'}`,
    `Geometrías y texturas: ${debug ? `${debug.memory.geometries} y ${debug.memory.textures}` : '–'}`,
    `Guardado: ${storageUse()}`,
    `Memoria de JavaScript: ${heap ? `${Math.round(heap / 1048576)} MB` : 'este navegador no la da'}`,
    `Pantalla: ${innerWidth} × ${innerHeight}, ${devicePixelRatio} ppp; ${navigator.userAgent}`,
  ];
  const measure = async () => {
    setBusy(true);
    setYaw((await apiRef.current?.measureYaw(5000)) ?? null);
    setBusy(false);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="plab-meter">
      <button type="button" className="px-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        Medir
      </button>
      {open && (
        <div className="plab-meter__sheet">
          {lines.map((line) => (
            <p key={line.slice(0, 12)}>{line}</p>
          ))}
          <button type="button" className="px-btn" disabled={busy || !debug} onClick={measure}>
            {busy ? 'Girando…' : 'Medir el giro, 5 s'}
          </button>
          <button type="button" className="px-btn" onClick={copy}>
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      )}
    </div>
  );
}
