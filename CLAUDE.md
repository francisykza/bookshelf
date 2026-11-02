# BookShelf · guía para trabajar en el proyecto

Este archivo lo lee Claude Code al empezar cada sesión en esta carpeta. Lo comparten **dos cuentas de Claude** que
trabajan por turnos en este mismo ordenador y en esta misma carpeta, sin ver la conversación de la otra. Todo lo que
una cuenta sepa, decida o deje a medias solo llega a la otra a través de este archivo, `docs/ESTADO.md` y git.
La especificación completa está en `SPEC.md` (una sección por versión; la cabecera dice la versión vigente).

## 0. Traspaso entre cuentas (obligatorio, sin que Francisco tenga que pedirlo)

**Al empezar una sesión**, antes del primer cambio:
1. Leer `docs/ESTADO.md` entero (estado, pendientes y la bitácora, la entrada más reciente arriba).
2. Ejecutar `git log --oneline -15` y `git status`. Si hay commits posteriores a la última entrada de la bitácora,
   o cambios sin commit, los hizo la otra cuenta: revisarlos (`git show`, `git diff`) y no deshacerlos.
3. Si Francisco empieza con un encargo, hacerlo; si hay algo a medias de la otra cuenta que le afecte, decírselo.

**En cada commit** (cuando Francisco lo pida):
1. Añadir en `docs/ESTADO.md` una entrada arriba de la bitácora con el formato de ese documento (fecha, cuenta,
   versión, qué se hizo, qué queda a medias o sin verificar, decisiones nuevas de Francisco) y actualizar «Estado
   actual» y «Pendiente».
2. Incluir `docs/ESTADO.md` (y `CLAUDE.md` si cambió) **en ese mismo commit**. El hash no hace falta escribirlo:
   ya está en `git log`.

**Reglas nuevas**: si Francisco da una instrucción que deba valer más allá de la tarea («a partir de ahora…»,
«nunca…», «siempre…», una preferencia de diseño o de trabajo), escribirla en el apartado que toque de este archivo
en ese momento, aunque no haya commit todavía. Lo que no esté aquí, la otra cuenta no lo sabe.

**Sesión sin commit**: si se trabaja y Francisco no pide commit, antes de terminar anotar igualmente en la bitácora
lo que queda sin commit y por qué (el archivo se queda en disco y la otra cuenta lo leerá).

**Nunca a la vez**: si al empezar hay cambios sin commit que no están descritos en la bitácora, preguntar a
Francisco antes de tocarlos (puede que la otra cuenta esté trabajando en ese momento).

## 1. Reglas de trabajo (las pone Francisco, el dueño del proyecto)

- **Todo en español**: respuestas, resúmenes, botones, mensajes de commit y comentarios de código. **Nunca en inglés**,
  ni una frase suelta ni en el cuadro final (Francisco lo recordó el 2-11-2026).
- **Commits y subidas, solo cuando se pidan** («haz el commit», «súbelo»). Subir `main` **despliega en producción**
  (Vercel). Nunca forzar el push ni reescribir historia publicada.
- **Sin líneas `Co-Authored-By`** ni firmas de IA en commits ni PR.
- **Supabase**: nunca exponer claves de servicio ni secretas; no desactivar RLS. Las migraciones nuevas van en
  `supabase/migrations/` y **las aplica Francisco** en el SQL Editor. Desde el 1-11-2026, si él lo pide («hazlo tú»):
  abrir el SQL Editor del proyecto en el panel del navegador (él inicia sesión), pegar la migración comprobando su
  SHA-256 con el archivo, y que él pulse «Run» (el control de permisos no deja ejecutar en producción desde aquí);
  después, comprobarlo con la clave pública (las tablas nuevas deben dar «permission denied» al anónimo, no «not found»).
- **No manejar contraseñas** ni iniciar sesión en cuentas.
- **No borrar datos del usuario.** Al probar en el navegador, usar perfiles de prueba (Playwright con su propio
  `localStorage`), no sus datos reales. Si algo no cuadra con lo esperado, puede ser que él esté usando la app:
  no «arreglar» sus datos.
- **No cambiar** la paleta del Ático ni las reglas de recompensas, piezas, cajas y pity.
- **Figuras ocultas desde la 1.67** (decisión de Francisco del 1-11-2026, «Ocultarlas, sin borrar»): las figuras, el
  Ático, las Cajas Sorpresa, el Guardián y sus sellos no se ven en la app (`FIGURES_ENABLED = false` en
  `src/domain/figures.js`) mientras él decide cómo integrarlas; su lugar lo ocupan los tickets y la tienda del bajo.
  No se borra ningún dato de figuras. No volver a mostrarlas sin que lo pida.
- **Figuras SVG provisionales retiradas** (1.58.1, decisión de Francisco): el Pequeño Viajero, el Bardo del Viento y la
  Hechicera de Eea no deben volver como coleccionables ni sustituirse por otro marcador. Las cuentas antiguas conservan
  su inventario; se filtran con `RETIRED_FIGURES` (`src/domain/figures.js`).
- **Comunidad en el cuaderno de cuero** (1.60, decisión de Francisco): el panel de la comunidad usa el cuaderno con
  anillas (`NotebookShell`) y pestañas de papel en todas sus hojas, según sus maquetas; no volver a la tarjeta lisa. Se
  conserva «Visitar rincón». Una maqueta con una figura retirada no la recupera.
  **Desde la 1.62 (decisión de Francisco, paquete `material-diseno/social-radio/`)**: tres pestañas principales,
  Lectores / Salón / Clubes, visibles a 360 px sin desplazamiento; Perfil y Mi rincón se abren desde el avatar propio
  (no se pierde ninguna función). Sustituye a «se conservan las cinco pestañas» de la 1.60.
- **Visita social** (sustituye a la regla de la 1.58.1 desde la 1.62, decisión de Francisco): fachada con el nombre y el
  avatar de la persona; se entra tocando la ventana inferior derecha o «Entrar al rincón»; durante el vídeo, «Salir» y
  «Saltar»; al terminar no se repite. Movimiento reducido, error o ahorro de datos: directo a la habitación. Solo la
  ventana inferior derecha es interactiva (es la única trayectoria del vídeo). Volver lleva al origen (salón o lectores).
- **Paquete `material-diseno/social-radio/`** (1.62): se implementa por bloques, enseñando capturas al terminar cada uno
  antes de seguir (decisión de Francisco). Orden: 1) comunidad y tarjetas públicas, 2) asientos del salón y visita,
  3) radio y continuidad en el EPUB, 4) clubes.
- **Minijuego «La librería del puerto»** (prototipo, decisiones de Francisco del 31-10-2026):
  - Se entra desde una 7.ª app del ordenador.
  - Sin encargos: los libros no se distinguen.
  - Estrellas por movimientos: terminar, mínimo + 2, y mínimo sin pistas.
  - El ranking usa un nivel generado cada semana; el mes suma las semanas; en caso de empate gana quien llegó antes.
  - Distinción en el perfil para el top 3 semanal y el mensual.
  - Nada pasa a la app ni a Supabase sin su aprobación (plan en `docs/qa/libreria-puerto.md` §9).
- **Prototipo «El edificio del puerto»** (decisiones de Francisco del 1-11-2026):
  - Tu piso es una habitación isométrica que se decora y está en un edificio de 3 plantas × 2 pisos.
  - **No sustituye** al rincón ilustrado ni a su visita.
  - Visitas en diferido; el directo, más adelante.
  - Reparto en edificios **al azar** (confirmado el 1-11-2026):
    - Solo entran los perfiles con la comunidad activada.
    - Se llenan primero los edificios con hueco y la puerta se elige al azar.
    - Lo decide el servidor.
  - **Entrada en la app:** la tablet del Salón pregunta entre «Comunidad» (lo de antes) y «El edificio del puerto»; no se
    quita nada.
  - Catálogo gratis: no toca recompensas, cajas ni pity.
  - Sin texto libre: solo sellos de frase cerrada.
  - Otros cambios en a qué lleva la tablet del Salón Social necesitan su aprobación.
  - Del vídeo de referencia se toma el género, nunca su arte.
  - **Más personalidad** (encargo del 1-11-2026, por bloques con capturas entre uno y otro: 1) fachada que se vea como
    un edificio de verdad, 2) piso y personalización más integrados, con un catálogo lo más intuitivo y orgánico
    posible, 3) sets de sagas). **Sets de sagas**: nombre propio y un guiño («Para quien leyó …»); muebles originales
    que evocan la saga, nunca portadas, logos ni diseños oficiales. Primera tanda: Alas de sangre, Mistborn, El nombre
    del viento, Una corte de rosas y espinas y El archivo de las tormentas.
  - **Fachada** (1-11-2026): según una foto de un edificio clásico mostaza que pasó Francisco (estilo, no copia). En
    la azotea, el cartel «AQUÍ NO HAY QUIEN LEA» (guiño a «Aquí no hay quien viva»), con letra propia de píxeles:
    nunca el logotipo de la serie. Por las ventanas, siluetas de frente (`windowView.js`); al tocar una, la vista se
    asoma y entras.
  - **Controles del piso en el mismo pixel art** (1-11-2026, a Francisco las píldoras HTML le desentonaban):
    - marcos de píxel e iconos propios (`pixelUi.js`);
    - telón tramado dentro del dibujo;
    - «Decorar» y la luz en las esquinas de la habitación, y las herramientas flotando junto al mueble;
    - el catálogo es una balda de madera de la que se arrastran los muebles.
    - No volver a botones redondeados sueltos alrededor del piso.
  - **Pantalla completa** (2-11-2026, «que la app ocupe toda la pantalla sin dejar un borde encima»): en el móvil, el
    edificio (portal, piso, tienda) llena la pantalla hasta arriba, con su color bajo la barra de estado; nada de hojas
    con un hueco encima.
  - **Portal sin carteles** (2-11-2026): sin el título «El edificio del puerto» ni «Tu puerta… Toca una puerta para
    entrar» (queda solo para lectores de pantalla), y sin la tarjeta «Tu buzón»: el correo (sellos, regalos y firmas)
    es un **buzón dibujado junto al portal** del que asoma una carta con el número; al tocarlo, una nota de papel.
  - **Cuenta del fundador** (2-11-2026): la cuenta de Francisco tiene muchos más tickets y los místicos para probar,
    con el script `supabase/scripts/cuenta_fundador.sql` (a mano, solo su cuenta). Es la única excepción a «los
    tickets solo se ganan leyendo»; no se extiende a nadie más sin que lo pida.
  - **Vista «dentro de la habitación» por defecto** (1-11-2026):
    - el piso, a pantalla completa, con la balda (o los sellos) abajo;
    - se puede cambiar a la vista de ficha y queda recordado en el dispositivo.
  - **Sets de sagas en la balda** (1.64, §64): pestaña «Sagas» con un set cada vez (`SETS` en `catalog.js`). Cada
    mueble nuevo del catálogo necesita su fila en `piso_catalogo` con una migración nueva (la prueba de paridad lo
    exige); la de las sagas es `20261102120000_edificio_sagas.sql` y la aplica Francisco.
  - **Economía de muebles** (aprobada el 1-11-2026, «Sí a todo»; plan y fases en `docs/qa/economia-muebles.md`):
    - inventario con copias;
    - tickets, una moneda aparte de las Cajas de figuras, que solo se ganan leyendo (nunca con dinero);
    - tienda, rarezas que se animan al tocarlas y sorteo con probabilidades visibles y pity;
    - sagas que se desbloquean al terminar su libro;
    - primero regalar y cambiar entre vecinos, y el mercado abierto solo después.
    - Lo colocado hoy pasa a ser de cada uno. Inventario y tickets, en el servidor.
    - Se hace por fases, con capturas entre una y otra. Hasta que cada fase esté hecha sigue valiendo «catálogo gratis».
  - **Sobres de la tienda** (1.67, «tipo gacha», decisión de Francisco del 1-11-2026): sobres de 1 y de 5 (el de 5
    con al menos un poco común), probabilidades visibles, pity y sorteo en el servidor. Animaciones con emoción pero
    honestas: sin falsos «casi», sin cuentas atrás, sin presión para seguir abriendo; con movimiento reducido, directo
    al resultado. Las misiones semanales pagan en tickets.
    **Sobres por tipo y temporada** (mismo día): cada sobre trae un grupo de muebles y hay sobres más caros con más
    probabilidad de lo mejor (`piso_sobre` en la migración y `SOBRES` en `economy.js`, siempre iguales). Aspecto de
    sobre de cartas, colgados en una pared.
  - **Tienda por dentro: el antiguo videoclub** (1-11-2026): mezcla de la idea de una tienda de sobres de un juego de
    cartas (pared de sobres, uno marcado, bocadillo con precio) con el videoclub de «Aquí no hay quien viva», en
    nuestro pixel art y con perspectiva. Tiene dependienta propia. Solo guiños y género: nunca arte, logos, decorado ni
    personajes (ni su parecido) de esas obras.
    **Desde la 1.68** (maquetas de Francisco, «muy plano» la versión 2D):
    - la tienda y su mostrador de cerca se dibujan con el mismo motor isométrico que los pisos (`shopRoom.js`), con
      profundidad, sombras y luz de tarde;
    - Sobres, Muebles y Reciclar son objetos de la escena (expositor, rincón del sillón, caja de reciclaje) con un
      letrero y su contorno encendido;
    - no volver a una fila de pestañas grandes que le quite protagonismo a la tienda.
  - **Más vida en el edificio** (encargo del 1-11-2026, por bloques con capturas entre uno y otro: 1) más muebles,
    2) personaje, 3) misiones diarias, 4) vecinos). Decisiones de Francisco:
    - **Personaje propio y personalizable** en tu piso: tocas el suelo o un mueble y va andando hasta allí. En sillas,
      sillones y camas se sienta o se tumba; si no lo tocas, pasea solo de vez en cuando.
    - Su aspecto se guarda en el servidor y **los vecinos lo ven** al visitar tu piso (migración nueva, la aplica
      Francisco).
    - **Misiones diarias de la habitación**: dan **ropa y colores del personaje**, nunca tickets (los tickets siguen
      ganándose solo leyendo).
    - **Vecinos**, sin texto libre: regalar copias de muebles, libro de visitas con sellos de frase cerrada y «me
      gusta» por mueble. Visitar con tu personaje queda fuera por ahora.
  - **Sonidos cozy propios del edificio** (1-11-2026): sintetizados, por material y por acción (§6 del plan).
  - **Sintonía de «Aquí no hay quien viva»**: a Francisco le encantaría en versión chiptune cozy. Sin licencia no se usa
    ni se recrea esa melodía (tampoco de oído). En la app, solo un tema original con guiño.
  - **Melodía «Dos balcones»** (2-11-2026): Francisco pasó un audio (WhatsApp, título ID3 «Dos balcones») para usarlo
    **más adelante** como música del edificio. La generó él con ChatGPT y descartó la sintonía de la serie (confirmado
    el 2-11-2026): se puede usar. **Desde la 1.73 suena en el edificio** (`public/media/edificio/dos-balcones.mp3`,
    `edificio/music.js`): en bucle, bajita, solo con el sonido activado y callada mientras suena la radio. Y **sonidos de acciones estilo Stardew Valley**, muy satisfactorios: solo el estilo, sonidos
    propios sintetizados (nunca muestras del juego).
  - **pixelfx** (2-11-2026, «adelante»): se puede usar https://github.com/patch-gg/pixelfx (MIT) para los efectos de
    muebles y diseños de aquí en adelante. Copiar solo el núcleo y los efectos que se usen, con su `LICENSE` y su
    `NOTICE.md`; **nunca su fuente «Patch Pixel»** (no es MIT).
  - **No usar `material-diseno/barrio-v2/`** (2-11-2026): Francisco pidió no usarla y borrarla (a la Papelera; el
    primer intento falló porque Windows tenía un archivo abierto).
  - **Rareza «místicos»** (2-11-2026, plan en `docs/qa/misticos.md`): dragones y otros seres con movimiento, de
    **diseño espectacular** y, si se puede, **con guiños a sagas** (originales que evocan, nunca personajes, nombres
    propios, logos ni diseños oficiales). Salen con **una probabilidad muy baja** en los sobres (Francisco lo eligió
    frente a un sobre propio o a premios por leer). Dentro de los místicos, **los más raros te siguen a todas partes**
    (tu piso, las visitas, el hotel). **Cifras aprobadas** («Sí, esas cifras», 2-11-2026): solo en el sobre «Edición
    coleccionista», **1 %** místico y, de esos, **1 de cada 4 legendario** (0,25 %); se resta de «raro», el resto de
    probabilidades y el pity actual no cambian; **sin pity propio**. Diseños de la primera tanda en `dev/misticos.html`.
    **No son moneda**: no se compran, no se reciclan ni se regalan. Solo un legendario te acompaña a la vez.
  - **El Gran Hotel del Puerto** (2-11-2026, plan en `docs/qa/gran-hotel.md`): más espectacular y, como la fachada del
    edificio, **que se pueda interactuar desde la propia fachada**. **Se llega en una limusina negra de lujo**
    (2-11-2026): para ir al hotel hay que coger la limusina (en nuestro pixel art, original). **Se coge delante del portal
    del edificio**, aparcada en el muelle con su chófer (aprobado «Sí, a la limusina», 2-11-2026; 1.74, §74.4).
    **Salas del hotel** (2-11-2026, `gran-hotel.md` §9): cada sala es la versión física de una función de la app y se
    navega con **un ascensor de latón**, no con menús. La Lonja (intercambio de muebles; nunca místicos ni sagas), la
    suite de la semana (en dos pasos y voluntaria: candidato por edificio, vota todo el hotel, gana el lunes; premio sin
    moneda) y **el casino del sótano**: minijuego «Las 21 páginas», **sin apostar** (partida diaria gratis, nunca se
    pierde nada, sin falsos «casi»), **solo se abre si has registrado lectura ese día**; las fichas nunca se compran y
    se canjean por sobres, ropa de casino y la mascota «el conejo de la chistera» (ocupa el sitio del legendario).
    Orden: vestíbulo con ascensor, suite, casino, sala de lectura y quiosco, Lonja, vitrinas y mirador.
  - **Aprobado el paso a la app** («Sí, prepárala», 1-11-2026): 1.63, SPEC §63. La migración
    `20261101120000_edificio_puerto.sql` la aplica Francisco; sin ella, la tablet hace lo de siempre.
- Las herramientas de prueba (p. ej. simular sellos) van solo con `import.meta.env.DEV`, botón y acción.
- **Biblioteca grande** (1.59, §59): la biblioteca cerrada no monta libros; el escaparate y los lomos solo montan lo
  cercano a la vista (no medir ni buscar libros en el DOM: puede no estar montado). Las portadas se piden una vez por URL
  (`watchCover` en `BookItem.jsx`). Para medir: `node scripts/perf-large-library.mjs` (datos sintéticos, nunca la
  cuenta de Francisco); no dar por resuelto el rendimiento del iPhone sin probarlo en el iPhone.
- **Pruebas acotadas** a lo que se cambia: build + pruebas relevantes. **Nada de `npm run qa:full`** ni auditorías
  globales salvo que lo pida.
- **No afirmar pruebas en iPhone o Safari reales**: aquí solo hay emulación (Chromium y WebKit de Playwright).
- **Fidelidad con maquetas**: comparar capturas al mismo tamaño (390 px; revisar 360, 430 y escritorio) y declarar
  las diferencias que queden. No usar una maqueta como fondo ni recortar botones con texto de ella. Si falta un
  recurso imprescindible, decirlo y pedirlo en vez de improvisarlo.
- **Maquetas como guía, no como relleno**: no inventar funciones, datos, iconos ni adornos para llenar huecos de una
  maqueta; no implementar controles (p. ej. escaneo) solo porque aparezcan en ella. Separar ilustración, recursos,
  contenido dinámico y controles reales.
- **Efectos**: solo respuestas discretas (presión, sonido breve por acción); respetar silencio, volumen y movimiento
  reducido; nada de sonido antes de una interacción.
- **Al terminar un bloque**: subir la versión en `src/diag.js`, `package.json`, `public/sw.js` (constante `VERSION`)
  y la cabecera de `SPEC.md`; añadir su sección a `SPEC.md`; y anotarlo en `docs/ESTADO.md` (apartado 0).

## 2. Comandos

```bash
npm install
npm run dev -- --port 5190 --strictPort   # servidor de desarrollo (el que usan las capturas)
npm run build                              # siempre al cerrar un cambio
npm test                                   # Vitest (dominio, catálogo, RLS con PGlite)
npx playwright test e2e/v135.spec.js --project=chromium-390x844   # e2e de lo afectado
npx oxlint src                             # lint
```

- Proyectos Playwright (`playwright.config.js`): `chromium-360x800`, `chromium-390x844`, `chromium-412x915`,
  `chromium-430x932`, `chromium-844x390`, `chromium-1440x900`, `webkit-390x844`, `webkit-844x390`,
  `chromium-390x844-reduced`. Levantan su propio servidor (no hace falta tener `npm run dev` abierto).
- Comunidad con Supabase simulado: `playwright.community.config.js` + `e2e-community/`.
- La config del panel del navegador de Claude está en `../.claude/launch.json` (entrada «bookshelf», puerto 5190).
- Producción: https://bookshelf-wine-iota.vercel.app · repo: https://github.com/francisykza/bookshelf (rama `main`).
  Tras subir, comprobar que `https://bookshelf-wine-iota.vercel.app/sw.js` ya trae la versión nueva.

## 3. Mapa del código

| Zona | Dónde |
| --- | --- |
| Arranque, paneles y navegación (History API) | `src/App.jsx`, `src/domain/navigation.js`, `src/hooks/useAppNavigation.js` |
| Estado (reducer + localStorage `bookshelf:v1` + migraciones) | `src/state/useLibrary.jsx`; nube: `src/state/cloudSync.jsx`, `src/services/cloud.js` |
| Reglas puras (sin React) y sus pruebas | `src/domain/*.js`, `src/domain/__tests__/` |
| Habitación (escena, hotspots, capas, reflejos, figuras en baldas) | `src/components/room/`, coordenadas en `src/scene/sceneMap.js` (px de la ilustración 941 × 1672) |
| Biblioteca y libro físico | `src/components/shelf/ShelfView.jsx`, `BookItem.jsx` (`PhysicalBook`) |
| Ficha del libro, diario y reseñas | `src/components/book/` |
| Ordenador (6 apps) | `src/components/panels/LaptopPanel.jsx`, `DiaryApp.jsx`, `ReadingCalendar.jsx`, `src/components/computer/ComputerApps.jsx` |
| Figuras (catálogo, Ático, unboxing, detalle) | `public/figures/catalog.json`, `src/domain/figures.js`, `src/domain/figureCatalog.js`, `src/components/figures/` |
| Comunidad, rincón del lector, club | `src/features/social/`, `src/features/reviews/` |
| Sonido (sintetizado con Web Audio, un evento por acción) | `src/audio/uiSounds.js`, `src/audio/ambientAudio.js` |
| Iconos ilustrados de sección | `src/components/SectionIcon.jsx`, `public/assets/icons/sections/` |
| Prototipo de minijuego (solo desarrollo, fuera del build y de la app) | `src/features/minigames/libreria-puerto/`, `dev/libreria-puerto.html` (y `dev/libreria-puerto-app.html`, vista en el móvil de la app), `docs/qa/libreria-puerto.md` |
| «El edificio del puerto» (pisos con vecinos, en la app desde la 1.63) | `src/features/edificio/` (panel, servicio, reglas, dibujo; usa `raster.js` y `audio.js` de `minigames/libreria-puerto/`), estilos en su `edificio.css` (se carga con el panel), páginas `dev/edificio-puerto.html` y `dev/edificio-puerto-app.html`, `docs/qa/edificio-puerto.md` |

**Estilos**: `src/index.css` importa las hojas en orden y **las últimas mandan**. Las capas recientes (cada una
acotada a su zona) son: `library-143.css` (biblioteca y libro físico), `craft-144.css` (materiales de los controles
de biblioteca y ficha), `figures-145.css` (figuras en baldas, su detalle y la pantalla del portátil) y
`computer.css` (ordenador, todo bajo `.pc`), y desde la 1.46: `room-146.css` (cabecera, «Ambiente», accesos, libro de la
cama, registro y pantalla del portátil), `books-146.css` (acabado del libro físico por edición) y `search-146.css`
(buscador y confirmación del alta); desde la 1.47: `library-147.css` (cabecera compacta y fila textil de la
biblioteca) y `room-147.css` (encabezado, accesos, registro y Ambiente); desde la 1.48: `ui-148.css` (correcciones de integración y
selector de lectura); desde la 1.49: `room-149.css` (lectura sobre el libro pintado, `BedPages.jsx`). Desde la 1.51:
`room-151.css` (controles compactos y correcciones generales) y desde la 1.52 `room-152.css` (contenido del libro
pintado y luz del libro de noche) y desde la 1.53 `diary-153.css` («Mi diario» del libro: Reseña, Notas,
Historial) y desde la 1.54 `imports-154.css` (importación de Goodreads, `src/features/imports/`). Desde la 1.55
`epub-155.css` (vinculación y lector EPUB, `src/features/epub/`: el archivo vive solo en IndexedDB del dispositivo, por
cuenta; la posición del archivo y el progreso registrado son cosas distintas, §54; paginado en `epubLayout.js` y
subrayados en `epubHighlights.js`, §55) y desde la 1.58 `social-visit.css` (visita a un rincón compartido, todo bajo
`.reader-visit`; lógica en `src/features/social/visit.js` y `visitScene.js`, §56) y desde la 1.58.1 `hotfix-1581.css`
(correcciones de la auditoría del vídeo, §57: cabecera de las reseñas) y desde la 1.59 `perf-159.css` (biblioteca grande:
filas virtuales, portadas 2:3 estables, figuras del perfil, visita sin pantalla oscura, registro con teclado, §59) y desde
la 1.60 `social-160.css` (comunidad en el cuaderno: perfil, Mi rincón, Entre lectores) y `room-160.css` (libro de la cama, §60) y desde la 1.61 `social-161.css` (habitación de llegada y «Los libros de X» de la
visita, §61; la vista de libros abiertos usa `select: 'libros'` y `'libros/clave'`) y desde la 1.62 `social-162.css` (comunidad en tres pestañas, sillones con tarjeta anclada y fachada de la visita; el volver de la visita es `.reader-visit__leave`, porque `.reader-visit__back` ya era de «Sus libros») y `radio-162.css` (la radio del rincón: objeto del salón, panel y control compacto del EPUB; reproductor único en `src/features/radio/radioPlayer.js`, §62) y `club-162.css` (dentro de un club: pestañas, conversación y redactor, §62.4). La edición visual
`kindle` está retirada: dibujar siempre con `visualEdition(book)`, nunca con `book.editionType` directamente. **Día y noche son la misma habitación** (decisión de Francisco, §50). **Ojo**: `fix-138.css` aún da `top`/`left` con el área segura a `.lib-hero__back`; en un móvil real
eso desplaza el botón (en emulación el área segura es 0). Las hojas antiguas siguen cargadas: antes de crear una clase nueva,
buscar si ya existe con otro uso.

**Recursos**: los originales de diseño están en `material-diseno/`, `art-inbox/` y `assets-source/` (**no están en
git**; solo existen en el ordenador de Francisco). La app usa derivados optimizados en `public/`. Correspondencias:
`docs/design/ordenador-recursos.md`, `docs/design/materiales-controles.md`, `docs/design/asset-manifest.md`.
Maquetas de referencia: `docs/design/references/`.

## 4. Particularidades de este Windows

- Muchos archivos tienen finales de línea **CRLF**. Un reemplazo hecho con un script que busca texto con `\n` falla
  en silencio: usar la herramienta Edit, o normalizar a `\n`, reemplazar y devolver el CRLF.
- En Git Bash, los heredocs y la escritura directa pueden estropear secuencias con barra invertida (`\n`, `\u…`):
  para parches grandes, escribir un script `.cjs` en la carpeta temporal y ejecutarlo con `node`.
- Un `cat > archivo` sin heredoc se queda esperando la entrada y bloquea la orden: no hacerlo.
- Capturas: Playwright con `isMobile`, `deviceScaleFactor: 2`, y esperar a que las imágenes estén `complete`.
  La app guarda el estado con retraso: para sembrar datos de prueba usar `page.addInitScript` antes de recargar.
- Área segura en Chromium: `Emulation.setSafeAreaInsetsOverride` por CDP (p. ej. `top: 45`, como el móvil de
  Francisco). El CDP **no** emula `display-mode`: para ver la app instalada, activar a mano las reglas de
  `@media (display-mode: …)` (así se reprodujo la franja de la biblioteca, §57.3).
- Atajos `border` y `font` de las hojas antiguas reinician `border-image` y las cifras: por eso algunas reglas de
  `craft-144.css` llevan `!important`.
- Desde la 1.58.2 la única prueba que falla es `e2e/v149` en WebKit (Windows no dibuja bien `matrix3d`, ver
  `docs/ESTADO.md`). Si aparece otra, investigar antes de tocarla: no ocultarlas cambiando
  la prueba sin investigar.
