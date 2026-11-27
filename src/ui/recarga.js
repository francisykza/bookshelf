// 1.159 · Recargar cuando falta un trozo de código de otra versión (docs/qa/ordenador-negro.md). Lo usan la red de seguridad
// (RedDeSeguridad.jsx) y el aviso de Vite en main.jsx.

const CLAVE = 'bookshelf:recarga-version';
const PLAZO_MS = 30000;

/** ¿Es un trozo de código que no ha llegado (otra versión publicada o sin conexión)? Los mensajes de Safari, Chrome y Firefox. */
export function esTrozoPerdido(error) {
  const texto = `${error?.name ?? ''} ${error?.message ?? error ?? ''}`;
  return /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError/i.test(texto);
}

/** Recarga una sola vez cada 30 s (si el trozo sigue sin llegar, no entra en bucle). true si recarga. */
export function recargarUnaVez(ahora = Date.now(), almacen = globalThis.sessionStorage, recargar = () => location.reload()) {
  try {
    const antes = almacen?.getItem(CLAVE);
    if (antes !== null && antes !== undefined && ahora - Number(antes) < PLAZO_MS) return false;
    almacen?.setItem(CLAVE, String(ahora));
  } catch {
    // Sin almacenamiento (navegación privada): sin saber si ya se recargó, mejor no recargar
    return false;
  }
  recargar();
  return true;
}
