// Las portadas reales en el escaparate del café (1.126, Francisco, 13-11-2026: «Sí, haz las portadas en las fichas y el
// escaparate»). La portada no se pega como una foto: se reduce a una imagen pequeña de 36 × 54 píxeles (la proporción 2:3 de
// un libro) con los colores algo escalonados, y la escena la pinta sin suavizar, en el mismo pixel art que el resto. Con
// 10 × 15 (la primera prueba) una portada real se quedaba en manchas; así se reconoce y sigue siendo píxel (Francisco:
// «Sí, mejóralas un poco»). Para leer sus píxeles hace falta que la imagen se pueda usar en un lienzo: Open Library lo
// permite y lo demás pasa por `/api/portada` (el mismo camino que la imagen de las reseñas). Si no carga, el libro sigue con
// su tapa de color.
import { cargarPortada } from '../../reviews/reviewCard';

export const PORTADA_ANCHO = 36;
export const PORTADA_ALTO = 54;
const cache = new Map();

/** Escalona un canal en pasos de 12 (unos cuantos tonos por color, como un dibujo de píxel). */
const escalon = (v) => Math.min(255, Math.round(v / 12) * 12);

/** El lienzo pixelado de una imagen ya cargada (recortada al 2:3 por el centro, como el object-fit: cover de las fichas). */
export function lienzoDe(img, ancho = PORTADA_ANCHO, alto = PORTADA_ALTO) {
  // Primero a un tamaño intermedio (el navegador promedia mejor en dos pasos) y luego al tamaño final
  const medio = document.createElement('canvas');
  medio.width = ancho * 3;
  medio.height = alto * 3;
  const m = medio.getContext('2d');
  m.imageSmoothingEnabled = true;
  m.imageSmoothingQuality = 'high';
  const ar = img.naturalWidth / img.naturalHeight;
  const [sw, sh] = ar > 2 / 3 ? [img.naturalHeight * (2 / 3), img.naturalHeight] : [img.naturalWidth, img.naturalWidth * 1.5];
  m.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, medio.width, medio.height);
  const fin = document.createElement('canvas');
  fin.width = ancho;
  fin.height = alto;
  const f = fin.getContext('2d');
  f.imageSmoothingEnabled = true;
  f.imageSmoothingQuality = 'high';
  f.drawImage(medio, 0, 0, ancho, alto);
  const datos = f.getImageData(0, 0, ancho, alto);
  const d = datos.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = escalon(d[i]);
    d[i + 1] = escalon(d[i + 1]);
    d[i + 2] = escalon(d[i + 2]);
    d[i + 3] = 255;
  }
  f.putImageData(datos, 0, 0);
  return fin;
}

/** El lienzo pixelado de una portada por su URL (null si no la hay o no se puede leer). Se pide una vez por URL. */
export function portadaPixel(src) {
  if (!src) return Promise.resolve(null);
  if (!cache.has(src)) {
    cache.set(
      src,
      cargarPortada(src)
        .then((img) => {
          if (!img || img.naturalWidth < 10) return null;
          const lienzo = lienzoDe(img);
          // Un lienzo «manchado» (sin permiso de CORS) no se puede leer ni usar como textura
          lienzo.getContext('2d').getImageData(0, 0, 1, 1);
          return lienzo;
        })
        .catch(() => null),
    );
  }
  return cache.get(src);
}
