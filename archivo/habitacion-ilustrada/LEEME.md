# La habitación ilustrada (archivada en la 1.157.0)

Esta carpeta guarda la **habitación ilustrada de la 1.86**, la «experiencia anterior» de Libotown: la ventana al mar, la
estantería, la cama con su libro, el portátil, el salón social de al lado (sillones, radio y tablet) y la guía de Libo
«Descubrir mi habitación». Francisco pidió quitarla de la app el 26-11-2026 («sigue saliendo cuando la gente se mete en la web
para instalar la app») y guardarla aparte el 27-11-2026 («por si acaso la necesitamos en el futuro para algo»). Plan y lista
exacta: `docs/qa/borrar-habitacion-ilustrada.md`; SPEC §157.

**No forma parte de la app.** Vite no la compila ni la publica (nada de `src/` la importa), Vitest solo busca pruebas en
`src/`, Playwright solo en `e2e/` y `e2e-community/`, y Tailwind no lee sus clases (`@source not '../archivo'` en
`src/index.css`). Ningún dato de nadie dependía de ella: libros, lecturas, diario, reseñas y decoración siguen en la app.

## Qué hay

Cada archivo está en la misma ruta que tenía en el repositorio, debajo de esta carpeta:

- `src/components/room/`: la habitación entera (`PanoramicRoom`, `CozyRoom`, `SocialRoom`, `RoomCorner`, `BaldaPanel`, las
  capas de la escena, el mar, los veleros, la cama…) y `DecorBoundary`.
- `src/components/onboarding/`, `src/hooks/useOnboarding.js`, `src/domain/onboarding.js`: la guía «Descubrir mi habitación».
- `src/scene/`: el panorama, el encuadre, la homografía, el mar, el mapa del salón y **`sceneMap.js` completo** (en la app
  queda una versión recortada con la ruta de los recursos y el fondo de Mi biblioteca).
- `src/hooks/useSceneArt.js`, `useSvgIds.js`, `useToday.js`; `src/domain/spineArt.js`.
- `src/features/social/components/SocialSeats.jsx` y `SeatCard.jsx`: los sillones del salón.
- `src/styles/`: las hojas **completas** de la habitación. `room-151`, `room-152`, `room-160` y `room-signs-137` salieron
  enteras; de `room.css`, `room-146`, `room-147`, `room-149` y `rincon-01` la app conserva solo las reglas que aún usa (el
  registro de lectura, las cabeceras de la biblioteca…), en su mismo sitio de la cascada.
- `src/**/__tests__/`: sus pruebas unitarias (y las partes de `v128.test.js` y `seats162.domain.test.js` que eran suyas).
- `public/`: sus imágenes (unos 7 MB): la ilustración del salón, el primer plano del portátil, `room-refresh/` (escena,
  lomos, reflejos, cortinas, enredaderas…), las placas y el libro abierto. Se quedaron en la app las que sigue usando:
  `images/cozy-book-room.jpg` (fondo de Mi biblioteca), `images/room-refresh/pantalla-bahia.webp` (lector EPUB) y
  `assets/room/boton-terracota-cosido.webp` (botón de guardar del registro).
- `e2e/`: las pruebas de extremo a extremo de la habitación (se archivan en el bloque 2).

## Cómo volver a enchufarla (si algún día hace falta)

1. Devolver los archivos a su ruta con `git mv archivo/habitacion-ilustrada/<ruta> <ruta>` (y las imágenes a `public/`).
2. Restaurar las hojas completas sobre las recortadas y sus `@import` en `src/index.css` (orden: ver `git show
   2948485:src/index.css`).
3. En `src/App.jsx`, volver a montar `PanoramicRoom` debajo de los paneles y el panel `balda` (ver `git show 2948485:src/App.jsx`),
   y en `src/features/pisoLab/inicio.js` y `PisoLabPanel.jsx`, la elección `bookshelf:inicio` y «Volver a la experiencia
   anterior».
4. Añadir de nuevo sus imágenes a la precarga del service worker (`public/sw.js`, `CORE`).

La última versión publicada con la habitación dentro es la **1.156.0** (commit `2948485`).
