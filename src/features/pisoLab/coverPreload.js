// La cubierta de tu lectura, pedida en cuanto tocas la puerta de tu piso: así el acercamiento de la fachada da tiempo a
// que esté lista al llegar al sillón. Se pide una vez por dirección y nunca antes de tocar la puerta.
const pending = new Map();

/** Promesa de la imagen ya decodificada, o de `null` si no hay cubierta o no se puede usar como textura. */
export function preloadCover(url) {
  if (!url) return Promise.resolve(null);
  if (!pending.has(url)) {
    pending.set(
      url,
      new Promise((resolve) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.referrerPolicy = 'no-referrer';
        image.onload = () => {
          const finish = () => resolve(image);
          if (image.decode) image.decode().then(finish, finish);
          else finish();
        };
        image.onerror = () => {
          // Un fallo no se queda guardado: la próxima entrada lo vuelve a intentar
          pending.delete(url);
          resolve(null);
        };
        image.src = url;
      }),
    );
  }
  return pending.get(url);
}
