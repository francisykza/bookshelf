// Diagnóstico para el móvil (SPEC §9bis, 1.16.2): con ?diag en la dirección se muestra una ficha con la
// versión cargada y lo que el teléfono declara de su pantalla y su gráfica, para capturarla y compararla.
import { LITE_SCENE } from './scene/renderMode';

export const APP_VERSION = '1.31.2';

function gpuInfo() {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return { max: 'sin WebGL', renderer: '' };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      max: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    };
  } catch {
    return { max: '?', renderer: '' };
  }
}

export function showDiagnostics() {
  if (!new URLSearchParams(window.location.search).has('diag')) return;
  const gpu = gpuInfo();
  const img = new Image();
  const rows = () => [
    ['Versión', APP_VERSION],
    ['Escena', LITE_SCENE ? 'ligera' : 'completa'],
    ['Pantalla', `${window.innerWidth}×${window.innerHeight} · DPR ${window.devicePixelRatio}`],
    ['Memoria', navigator.deviceMemory ? `${navigator.deviceMemory} GB` : '?'],
    ['Textura máx.', gpu.max],
    ['GPU', gpu.renderer],
    ['Ilustración', img.complete ? (img.naturalWidth ? `cargada ${img.naturalWidth}×${img.naturalHeight}` : 'error al cargar') : 'cargando…'],
    ['Service worker', navigator.serviceWorker?.controller ? 'activo' : 'no'],
    ['Navegador', navigator.userAgent],
  ];
  const box = document.createElement('div');
  box.setAttribute('style', 'position:fixed;left:8px;right:8px;bottom:8px;z-index:9999;padding:10px 12px;border-radius:10px;background:rgb(20 12 6 / 0.88);color:#fbf3e1;font:12px/1.45 monospace;word-break:break-word;pointer-events:none');
  const paint = () => {
    box.innerHTML = rows().map(([k, v]) => `<div><b>${k}:</b> ${String(v).replace(/</g, '&lt;')}</div>`).join('');
  };
  img.onload = paint;
  img.onerror = paint;
  img.src = '/images/cozy-book-room.jpg';
  paint();
  document.body.appendChild(box);
}
