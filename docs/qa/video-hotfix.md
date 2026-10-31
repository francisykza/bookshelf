# Hotfix 1.58.1 · Auditoría del vídeo (BookShelf-fotogramas-QA)

Fuente: `BookShelf-fotogramas-QA/` (11 fotogramas de una grabación de pantalla de un móvil Android con la app
instalada; 720 px de ancho). Los fotogramas muestran síntomas; las causas de abajo se han comprobado en el código y,
cuando se ha podido, reproduciéndolas. Capturas de los estados corregidos en `docs/qa/video-hotfix/`.

Rama: `hotfix/auditoria-video`. Pruebas automatizadas en Chromium y WebKit de Playwright: **no equivalen a un móvil
real** (ni Android ni iPhone).

## FIX 1 · Figuras SVG provisionales (05, 07)

- **Alcance**: `viajero_asteroide` (El Pequeño Viajero del Asteroide), `bardo_viento` (El Bardo del Viento) y
  `hechicera_eea` (La Hechicera de Eea). Eran las únicas del catálogo con imágenes SVG (`public/figures/*.svg`, seis
  archivos). Sus piezas de blíster estaban dentro de su propia entrada del catálogo (no había piezas sueltas).
- **Hecho**: fuera de `public/figures/catalog.json` y borrados sus seis SVG tras comprobar que no quedaba ninguna
  referencia (solo dos pruebas de dominio, actualizadas). Los iconos SVG de la interfaz no se han tocado.
- **Compatibilidad** (`src/domain/figures.js`): `RETIRED_FIGURES`, `isRetired`, `withoutRetired` y `activeOwnedCount`.
  Al cargar cualquier estado (local, nube o copia, en `hydrate`) se quitan de las **selecciones activas** (Guardián,
  Senda, baldas de la habitación, sinergias, último premio y el resultado de unboxing pendiente, que se da por visto),
  **sin borrar `owned`**: el inventario histórico se conserva y no se convierte en otro premio. El rincón publicado no
  las incluye; los rincones ajenos antiguos que las tengan no las muestran. La habitación cuenta solo las vigentes.
- **Sorteos**: `openMysteryBox` descarta las retiradas aunque lleguen en el catálogo. Nueva `boxHasPrize`: si no hay
  figura que obtener, pieza que completar ni Guardián válido para un sello, la caja **no se abre ni se gasta** y la
  cámara lo dice («Caja guardada» + aviso). Nunca se entrega un premio vacío. Reglas, pesos y pity sin cambios.
- **Aceptación**: `src/domain/__tests__/retiredFigures.test.js` (6) y `e2e/hotfix1581.spec.js` (cuenta antigua con
  las tres retiradas como Guardián, Senda, expuesta y premio pendiente; sin premio posible).

## FIX 2 · Visita social a pantalla completa (08–11)

- **Causa comprobada**: las franjas eran del **layout**, no del vídeo (los tres recursos miden 720 × 1280 y no traen
  bandas). La escena se contenía en un marco 9:16 centrado y la cabecera y el pie eran barras crema opacas con el área
  segura dentro; en un móvil más alargado que 9:16 sobraba alto arriba y abajo.
- **Hecho** (`ReaderVisit.jsx`, `social-visit.css`): escena a sangre. En vertical la ilustración **cubre** la pantalla
  (recorte lateral repartido 10/90 para no perder el mueble de libros de la izquierda); en pantallas anchas se cubre con
  un recorte vertical de como mucho un 11 % y, más allá, se contiene sobre la misma escena desenfocada (no una banda).
  La escena mide `100lvh`: mostrar u ocultar las barras del navegador no la reescala. El área segura se aplica solo a
  los controles, que flotan sin banda. Mientras llega el código de la visita, fondo oscuro (sin destello claro).

## FIX 3 · Sin opciones de animación en la visita

- Fuera «Entrar sin animación», «Entrar siempre sin animación» (y su preferencia `bookshelf:visit-skip`), «Saltar» y la
  invitación a tocar la ventana. Al abrir la visita la entrada empieza sola en cuanto se sabe que el rincón existe;
  al terminar, la habitación. Solo queda una flecha discreta («Salir de la visita» durante la entrada, «Volver» en la
  habitación).
- Vídeo que falla, `play()` rechazado, sin fotograma en 6 s o parado más de 4 s: habitación automáticamente.
  Movimiento reducido: directamente la habitación, sin pedir el vídeo. Al salir se cancelan escuchadores y temporizadores
  y se suelta el vídeo. Corregido además un fallo que solo se veía en desarrollo (StrictMode marcaba la visita como
  cerrada y no entraba nunca).
- El «Saltar animación» de la Cámara de Unboxing **no** es de este flujo y se conserva.

## FIX 4 · Continuidad entre entrada, vídeo y habitación

- Casa, vídeo y habitación son capas de una sola escena que no se desmonta (antes cada etapa montaba su propio marco):
  mismo encuadre, misma caja y la habitación preparada debajo del vídeo. Al terminar, el último fotograma se funde con
  la habitación en 220 ms (inmediato con movimiento reducido). Controles de la habitación con un fundido breve.
- **Recursos** (medido en WebKit con capturas a 360 × 640): el primer fotograma coincide en composición con
  `casa-v1.webp` y el último con `habitacion-v1.webp`; solo difieren en tono y compresión (diferencia media 11,6 y 8,1
  sobre 255; casa frente a habitación, 67,4). No hay incompatibilidad de encuadre que corregir con CSS.
- Historial: la entrada sustituye su paso; Atrás desde la habitación vuelve a «Lectores» y recargar no repite el vídeo.

## FIX 5 · Libros compartidos en la habitación (11)

- **Causa comprobada**: no era un fallo de datos (la consulta era la del perfil visitado y «Libros · 4» lo
  confirmaba). La escena solo pintaba **tres lomos pequeños de los destacados** en una balda; con otros orígenes
  (los que le representan, últimas lecturas, colecciones) las baldas parecían vacías.
- **Hecho**: un lomo por libro compartido, en cuatro baldas medidas sobre `habitacion-v1.webp` (hasta 24, de seis en
  seis, juntos y apoyados en la base inclinada de cada balda). Sin libros: baldas vacías y «Aún no ha compartido
  libros», sin rellenos. Carga, error y «no disponible» siguen distinguidos. Sin cambios de permisos.

## FIX 6 · Franja superior de la librería (01)

- **Causa comprobada**: `src/index.css`, `@media (display-mode: fullscreen), (display-mode: standalone)` daba a
  `.library` `padding-top: max(10px, env(safe-area-inset-top))`. La franja ilustrada de la cabecera ya aplica el área
  segura a sus controles, así que en la **app instalada** quedaba encima una franja del color del mueble (73,48,31; en
  el fotograma 70,47,30). En el navegador normal no se ve: por eso no salía en las pruebas.
- **Reproducción**: Chromium con área segura emulada de 45 px (`Emulation.setSafeAreaInsetsOverride`) y las reglas
  reales de modo app activadas a mano (el CDP no emula `display-mode`): cabecera 45 px más abajo antes, en 0 después.
  `docs/qa/video-hotfix/06-libreria-antes.webp` y `06-libreria-despues.webp`.
- **Hecho**: fuera el relleno superior (se mantiene el inferior para la barra de gestos). Buscador, filtros y baldas
  intactos.

## FIX 7 · Alias y fecha en reseñas (04)

- **Causa comprobada**: la cabecera de la tarjeta era una fila flexible sin saltos en la ficha (`notebook-137.css`):
  avatar, estrellas y menú quitaban ancho al nombre, que se cortaba con puntos suspensivos («book…»), y la fecha se
  partía en tres líneas.
- **Hecho** (`hotfix-1581.css`): rejilla avatar | nombre y fecha | menú, con las estrellas en su propia fila; el
  alias se lee entero (salta de línea, sin reducir la letra) y la fecha va en una línea. Los mensajes del club
  conservan su disposición. Prueba: `e2e-community/hotfix1581.spec.js` (320 y 390, Chromium y WebKit).

## FIX 8 · Ficha, EPUB y anotaciones (02, 03)

- **Sin defecto de código demostrado.** El archivo se guarda por cuenta y libro (`usuario:libro` en IndexedDB), la
  posición lleva la huella del archivo y las notas viven en `book.quotes` de ese libro. Vincular un EPUB cuyo título
  no coincide exige pulsar «Vincular de todos modos». La ficha entera se monta de nuevo por libro (`key={panel.id}` en
  `App.jsx`), así que no hay estado residual del libro abierto antes.
- **Discrepancia de datos pendiente de confirmar**: «The Ballad of Songbirds and Snakes» tiene vinculado «El árbol de
  la ciencia» (Pío Baroja) y sus notas de ese archivo. Encaja con una vinculación hecha a propósito. No se ha
  reasignado, borrado ni sustituido nada.

## FIX 9 · «Simular lectura diaria (+1 Sello)» (06)

- Era una **herramienta de prueba** (enciende un sello saltándose la regla de uno al día), visible para todos.
- **Hecho**: el botón solo existe con `import.meta.env.DEV` y la acción del estado también se ignora fuera de
  desarrollo (ocultar el botón no basta). No hay operación de servidor implicada: los sellos viven en el estado del
  usuario. En la app publicada no aparece (comprobado en el build).

## Resultados de QA (reales)

- `npm run qa:full` (una vez, 52,7 min): **Vitest 273/273**. **Playwright: 867 aprobadas, 29 fallidas, 139 omitidas.**
  No llega a 0 fallos. Clasificación de los 29:
  - **3 de este hotfix** (`e2e/hotfix1581.spec.js`): falso positivo (un error CORS de portadas de Open Library contado
    como error de la app) y un clic opcional sin límite de tiempo con movimiento reducido. Corregidos; la prueba pasa en
    todos los proyectos.
  - **9 de `v123 colores`**: prueba desfasada desde la 1.53 (buscaba «Personalizar colores» en «Reseña»; está en
    «Notas»). Corregida la prueba; pasa en los 9 proyectos.
  - **15 anteriores a este hotfix**, comprobados ejecutando los mismos tests sobre `main` (1.58.0) en una copia aparte:
    fallan igual allí. `v123 formulario` (412, 430), `v123 pulsación` (1440), `v128 librería` (844×390 en Chromium y
    WebKit), `panorama 9` (1440, ya anotado en ESTADO), `v149` (WebKit 390) y los 8 del proyecto
    `chromium-390x844-reduced` (`panorama` 4, 10, 13 y 15, `diegetic` ×2, `gouache`, `v128 temporizador`). En
    estos últimos Playwright ve la capa `.world` encima de la flecha del panorama al pulsar, pero el navegador
    devuelve la flecha arriba en el mismo punto, sin desplazamientos ni animaciones: **causa sin determinar**.
  - **2 intermitentes**: `panorama 14` (360) y `v128 reseña 3,75` (412) pasan al repetirlos (8/8 la reseña en `main`
    y en la rama).
  - No se ha vuelto a ejecutar `qa:full` completo tras las correcciones de pruebas; se repitieron los tests afectados.
- `npm run build`: correcto. El build no contiene «Simular lectura diaria» ni las figuras SVG.
- Comunidad (`playwright.community.config.js`, fuera de `qa:full`): `v158` 7/7 por proyecto en Chromium y WebKit 390 (con
  repetición), `hotfix1581` (reseñas) en 320, 390 y WebKit. `v135`: sus 2 fallos de siempre (`.huella-trio`, desde 1.43).
- Durante la verificación apareció un fallo real nuevo y se corrigió: con movimiento reducido, el relevo a la habitación
  montaba el vídeo y lo pedía. Ahora sin vídeo no hay fundido ni petición.
- `qa-report/qa-telemetry.json` (analizado con Python): 951 ejecuciones, 0 errores de página, 0 peticiones fallidas de
  la app. Los 1450 mensajes de consola son todos de portadas externas (`covers.openlibrary.org`: CORS, 429, 502): ruido
  de un servicio de terceros, anterior a este hotfix. Esta telemetría **no tiene** los campos `overflowElements`,
  `backgroundCheck`, `overlappingInteractive`, `brokenOrUncroppedAssets`, `consoleErrors` ni estados 01–08.
- Sin pruebas en un móvil real (ni Android ni iPhone).

## No incluido

Narrativa Ink, radio Tone.js, atlas de lecturas y marcapáginas de recuerdos (fuera de este hotfix).
