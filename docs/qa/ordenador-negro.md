# El ordenador en negro en un iPhone (1.159.0)

Aviso de Francisco (27-11-2026): a una compañera suya, en un iPhone, el ordenador del piso se le queda en negro. Pendiente desde
entonces en `docs/ESTADO.md`. Aquí no hay un iPhone: todo lo de abajo es con WebKit y Chromium de Playwright.

## Qué se encontró

- Abrir el ordenador con normalidad funciona en WebKit y Chromium (390 × 844).
- **La app no tenía ninguna red de seguridad para errores** (ningún *error boundary* de React). Cualquier fallo al pintar
  desmontaba la app entera y solo quedaba el fondo de la página, `#351c0e`, un marrón casi negro.
- **La causa más probable en un iPhone**: la app instalada se queda días abierta en segundo plano. Si mientras tanto se
  publica otra versión, al abrir el ordenador por primera vez la app pide su trozo de código de la versión vieja
  (`PisoDesktop-<hash>.js`), que en producción ya no existe: `libotown.es/assets/…` responde 404. Safari lanza «Importing a
  module script failed.», React desmonta todo y la pantalla se queda en negro. El service worker no lo evita: solo guarda los
  trozos que ya se han cargado alguna vez, y al activarse la versión nueva borra la caché vieja.
- Reproducido así en WebKit: con el trozo del escritorio en 404, «Mi escritorio» no aparece, `#root` se queda vacío y la
  captura es un rectángulo marrón oscuro.
- **No confirmado en su iPhone**: no sabemos su modelo, la versión de iOS ni si usa la app instalada o Safari. Si después de la
  1.159.0 le vuelve a pasar, ahora verá un aviso con «Detalles del fallo»: con una captura de ese aviso sabremos qué es.

## Qué se ha hecho

- **`src/ui/RedDeSeguridad.jsx`**, alrededor de toda la app (`main.jsx`):
  - Si el fallo es un trozo de código que no ha llegado (`esTrozoPerdido`, en `src/ui/recarga.js`: los mensajes de Safari,
    Chrome y Firefox), **recarga una vez** con «Poniendo Libotown al día…»; la página nueva trae los trozos nuevos y el
    historial vuelve a abrir lo que estaba abierto (el ordenador).
  - Como mucho una recarga cada 30 s (`bookshelf:recarga-version` en `sessionStorage`), para no entrar en bucle; sin
    almacenamiento, no recarga.
  - Si no se arregla así, o es otro fallo: la escena de Libotown (la de las pantallas de carga, el logo sobre el marrón) con
    un aviso de papel debajo de las letras: «Algo no se ha abierto bien.», **Recargar**, **Ir al inicio** (vacía el historial
    para no volver a abrir lo mismo) y «Detalles del fallo» con el mensaje. Botones de 44 px como poco; sin sonido.
  - Sus estilos van en `src/index.css` (el paquete principal): se tienen que ver aunque lo que falló sea un trozo de estilos.
- **`vite:preloadError`** (`main.jsx`): si Vite no consigue un trozo antes de importarlo, la misma recarga única.
- No cambia nada más: ni datos, ni el service worker, ni la navegación.

## Comprobación

- Unitarias: `src/ui/__tests__/redDeSeguridad.test.js` (reconoce el trozo perdido; recarga una vez cada 30 s; sin
  almacenamiento, no recarga).
- e2e (Supabase simulado): `e2e-community/v1159-red-seguridad.spec.js`, en Chromium y WebKit a 390: con el trozo perdido una
  vez, recarga sola y el ordenador se abre; si no llega nunca, el aviso (debajo del logo, sin desbordar, toques de 44 px) y
  «Ir al inicio» vuelve a tu piso. Capturas en `qa-report/v1159-red-seguridad/`.
- Emulación: no equivale a un iPhone real.

## Visto de paso, sin tocar

- Al recargar con el ordenador abierto, «Abriendo tu piso…» se queda en la página detrás del ordenador (no se ve). Ya pasaba
  antes de este cambio.
- En WebKit, el título del aviso sale sin negrita, como las negritas de la tarjeta de Libo (1.158).
