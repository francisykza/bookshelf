// Arte activo de MAIN_ROOM (SPEC §24.3): precarga el fondo limpio y sus capas y solo los da por buenos cuando
// TODOS han cargado y decodificado; hasta entonces (o si alguno falla) la escena sigue siendo la ilustración
// original. Los recortes que copian píxeles de la escena (resalte de objetos, canto de baldas, vaso, primer plano
// de la pantalla) leen de aquí qué imagen usar, para no mezclar dos pinturas.
import { createContext, useContext, useEffect, useState } from 'react';
import { LAPTOP_FOREGROUND, SCENE_REFRESH, SCENE_SRC } from '../scene/sceneMap';

const ORIGINAL = { ready: false, src: SCENE_SRC, foreground: LAPTOP_FOREGROUND.src };
const REFRESHED = { ready: true, src: SCENE_REFRESH.base, foreground: SCENE_REFRESH.foreground };

export const SceneArtContext = createContext(ORIGINAL);
export const useSceneArt = () => useContext(SceneArtContext);

function load(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => (img.naturalWidth ? resolve() : reject(new Error(src))));
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

/** Valor del contexto: el arte recompuesto cuando está todo listo, la ilustración original mientras tanto. */
export function useSceneArtLoader() {
  const [art, setArt] = useState(ORIGINAL);
  useEffect(() => {
    let alive = true;
    Promise.all([SCENE_REFRESH.base, SCENE_REFRESH.foreground, ...SCENE_REFRESH.layers.map((l) => l.src)].map(load))
      .then(() => alive && setArt(REFRESHED))
      .catch(() => {
        // Algún recurso no ha llegado: se queda la ilustración original, entera y coherente
      });
    return () => {
      alive = false;
    };
  }, []);
  return art;
}
