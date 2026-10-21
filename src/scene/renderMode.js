// Escena ligera para móviles (SPEC §9bis, 1.16.1). La brisa de hojas, cortinas y mar son filtros SVG animados
// sobre la ilustración entera; en la GPU de un teléfono (pantallas de densidad 2,5–3) agotan la memoria y el
// navegador deja bloques de la escena sin pintar. En modo ligero esas capas se quedan quietas (la ilustración
// se ve completa) y la noche y el atardecer tiñen la imagen fija en vez de duplicar la escena animada.
// Se puede forzar con ?escena=ligera o ?escena=completa.
const media = (query) => window.matchMedia?.(query).matches ?? false;

function detect() {
  const forced = new URLSearchParams(window.location.search).get('escena');
  if (forced === 'ligera') return true;
  if (forced === 'completa') return false;
  // Perfil móvil de SPEC §11.3, ampliado a cualquier pantalla táctil o con poca memoria
  return media('(max-width: 760px) and (pointer: coarse)') || media('(pointer: coarse)') || (navigator.deviceMemory ?? 8) <= 4;
}

export const LITE_SCENE = detect();

// El CSS también lo sabe: quieto el komorebi desenfocado y la sombra de nube que se mezcla con la escena
if (LITE_SCENE) document.documentElement.dataset.liteScene = '';
