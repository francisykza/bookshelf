// Mapa de las ilustraciones (SPEC §16.7). Desde la 1.157 solo queda lo que sigue en uso: la ruta de los recursos y la
// medida del fondo de Mi biblioteca (`images/cozy-book-room.jpg`, 941 × 1672). El mapa completo de la habitación
// ilustrada (encuadres, mar, objetos y zonas tocables) está en `archivo/habitacion-ilustrada/src/scene/sceneMap.js`.

/** Rutas de recursos según la base del despliegue (raíz en Vercel; `BASE_URL` si algún día va en subruta). */
export const asset = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

/** El fondo de Mi biblioteca: la ilustración de la habitación, que la librería usa desenfocada detrás de las baldas. */
export const SCENE_SRC = asset('images/cozy-book-room.jpg');
export const SCENE_W = 941;
export const SCENE_H = 1672;
