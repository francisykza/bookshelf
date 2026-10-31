# Estado del proyecto y bitácora de sesiones

Documento compartido entre las cuentas que trabajan en BookShelf. **Al empezar**, leerlo entero. **Al terminar**
cada sesión (o cada bloque), actualizar «Estado actual» si cambia y añadir una entrada arriba del todo en la
bitácora. Es lo que permite a la siguiente sesión retomar sin repetir trabajo ni deshacer decisiones.

## Estado actual

- **Versión publicada**: 1.61.0 (2026-10-31), en https://bookshelf-wine-iota.vercel.app
- **Árbol de trabajo**: **1.62.0, bloques 1 a 3 de 4 en un commit local de `main` sin subir** del paquete «salón social y radio» (§62): comunidad
  con tres pestañas y «Lectores» nuevo; sillones del salón y visita con fachada; radio del rincón. Publicada sigue la 1.61.0. Falta el bloque 4 (clubes); Francisco quiere ver
  capturas de cada bloque antes de seguir. Fuera de git quedan las carpetas de recursos: `material-diseno/`, `art-inbox/`
  (incluye `maqueta-146/`), `assets-source/` y `BookShelf-fotogramas-QA/`.
- **Supabase**: aplicadas en producción las migraciones de `supabase/migrations/` hasta
  `20261025150000_huellas_rincon.sql`. **Pendiente de aplicar (1.60)**: `20261031120000_avatares_nuevos.sql` (amplía la
  lista de avatares admitidos; sin ella, el servidor rechaza un perfil con uno de los seis nuevos). **Preparada (1.62,
  no aplicar aún sin decidirlo con Francisco)**: `20261031200000_radio_sintonia.sql` (`profiles.radio_station` para
  «Mostrar mi sintonía», opción que la app todavía no enseña).

### Últimos bloques (detalle en `SPEC.md`)

| Versión | Qué | SPEC |
| --- | --- | --- |
| 1.62.0 (sin commit, bloques 1–3 de 4) | Comunidad: tres pestañas, lo tuyo desde el avatar, buscador, opiniones compactas con ficha pública y pendientes por la obra; sillones con elección y tarjeta anclada, pestaña «Salón» y visita con fachada, «Entrar», «Saltar» y vuelta al origen; radio del rincón (un reproductor, temporizador, EPUB) | §62 |
| 1.61.0 | Visita: un acceso por cosa en la habitación de llegada, etiqueta «Libros compartidos ›» en la estantería, lectura actual como libro en la mesita y «Los libros de X» como biblioteca frontal con buscador | §61 |
| 1.60.0 | Comunidad en el cuaderno de cuero según las maquetas (perfil, Mi rincón con «Ambiente y recuerdos», Entre lectores), seis avatares nuevos (migración pendiente) y libro de la cama más asentado | §60 |
| 1.59.0 | Biblioteca grande en el móvil: nada montado con la biblioteca cerrada, filas y lomos virtuales, portadas 2:3 con una descarga por URL, figuras del perfil en WebKit, nube con comprobación de fecha, visita sin pantalla oscura, aviso con caducidad real, registro con teclado, perfil social sin solapes | §59 |
| 1.58.2 | Flecha del salón que saltaba al pulsar (con movimiento reducido no navegaba) y pruebas antiguas al día | §58 |
| 1.58.1 | Hotfix de la auditoría del vídeo: figuras SVG retiradas, visita a pantalla completa sin opciones de animación, libros en las baldas, franja de la biblioteca instalada, alias en reseñas, simular sellos solo en desarrollo | §57 |
| 1.58.0 | Visita a un rincón compartido: casa, entrada en vídeo bajo demanda, habitación con los libros que comparte, pendientes y vuelta paso a paso | §56 |
| 1.57.0 | Lector EPUB: estructura sin desbordes, paneles con «Volver a la lectura» y Atrás, lectura página a página con paso entre secciones, subrayados persistentes | §55 |
| 1.56.0 | Vincular un EPUB a tu ejemplar con confirmación, posición anclada (local y sincronizada), notas con comentario, «Una pausa junto al mar» y lector con la identidad de BookShelf | §54 |
| 1.55.0 | Leer EPUB en la app: archivo solo en el dispositivo, posición y notas con la cuenta, lector diferido y límites | §53 |
| 1.54.0 | Sin edición visual ebook, baldas de la habitación con toda la biblioteca e importación de Goodreads por CSV | §52 |
| 1.53.0 | «Mi diario» del libro en tres secciones (Reseña con guardado explícito y borrador, Notas, Historial) y noche con su fondo pintado | §51 |
| 1.52.0 | Una sola habitación de día y de noche (se retira la escena nocturna de la 1.51) y libro con el contenido integrado | §50 |
| 1.51.0 | Habitación nocturna de la maqueta con su propio mapa, libro con la lectura real y controles compactos | §49 |
| 1.50.0 | Texto del libro sin cizalla, botón integrado en la página, «Mi biblioteca» en la perspectiva del mueble y «Social» más suave | §48 |
| 1.49.0 | Lectura sobre el libro pintado (sin libro superpuesto), cascos en el encuadre, «Mi biblioteca» en la balda inferior e indicadores anclados | §47 |
| 1.48.0 | Cabecera de biblioteca sin solapes, cinco filtros sin scroll, material de libros, habitación sin título, cascos visibles, carteles orientados y selector de lectura | §46 |
| 1.47.0 | Estado «Abandonado», biblioteca compacta con fila textil y herramientas en un icono, pulido de habitación, registro y Ambiente | §43–45 |
| 1.46.1 | Ventana del calendario del portátil centrada en la zona visible | §42 |
| 1.46.0 | Buscador por ISBN y elección de edición (§40), acabado físico de libros por edición (§39) y libro abierto grande en la cama con la lectura actual, «Ambiente» y «Guías» de papel, accesos «Mi biblioteca», «Mi diario» y «Rincón social», registro enfocado con «Deshacer» | §38–40 |
| 1.45.0 | Cuatro posiciones de figuras en las baldas de la habitación, detalle de figura, dos figuras nuevas («El Guardián de los Clavos», «El Maestro y el Superviviente») y pantalla del portátil | §37 |
| 1.44.0 | Materiales artesanales (terracota, lino salvia, papel crema) en biblioteca y ficha; libro con volumen 3D | §36 |
| 1.43.0 | Biblioteca de tres libros por fila, libro físico, rincón del lector y mapa sonoro | §35 |
| 1.42.0 | Ordenador como escritorio digital con seis apps e iconos de sección ilustrados | §34 |
| 1.41.x | Reflejos de la habitación sin guías; ajustes de Mi diario | §32–33 |

### Pendiente (por orden de prioridad aproximada)

000. **Paquete «salón social y radio» (1.62, §62), a medias y sin commit.** Hechos los bloques 1–3; falta el **bloque 4,
   clubes**. Encargo completo en `material-diseno/social-radio/BookShelf-social-radio/` (fuera de git, en este
   ordenador): `PROMPT-CLAUDE.md` apartado 5 y la maqueta `maquetas/04-comunidad.png` (columna derecha). Resumen:
   dentro de un club, pestañas Lectura / Conversación / Miembros conservando lo que ya hay (`ClubTab.jsx`,
   en `src/features/social/components/`); administrar y archivar en un menú del propietario con confirmación (no entre mensajes); redactor
   accesible por encima del teclado con «Contiene spoilers» y mensajes con spoiler plegados; paginar mensajes; nada de
   adjuntos ni chat privado; no prometer bloqueo por capítulo. Autorizaciones en el servidor (RLS), no solo ocultas.
   Forma de trabajo (CLAUDE.md): enseñar capturas a Francisco al terminar el bloque. Al acabar: §62.4 en SPEC, entrada
   en la bitácora y, solo si lo pide, commit. Quedan además: Francisco debe escuchar la pista piloto de la radio y
   decidir si se queda; la migración de la sintonía está preparada, sin aplicar.

00. **Noche de la misma habitación (§50–51)**: el fondo nocturno ya está (1.53). Falta, si se quiere, la lámpara y
   la vela pintadas apagadas o sus luces por separado (`docs/design/recursos-noche-misma-habitacion.md`): hoy, de
   noche, apagarlas no las apaga en la ilustración. Las capas recortadas de día (hiedras, cortina) se tiñen por CSS.
0. **Encargo de la 1.46 terminado** (portátil, §42, publicado en la 1.46.1). Figuras revisadas (§41): sin el
   fondo de baldas anchas (punto 1) no pueden igualar el tamaño de la maqueta; faltan recortes con transparencia de
   la Dama, la Jinete y las tres figuras SVG. El escaneo de códigos no existe en el proyecto.
   En calendario y ficha el formulario de registro conserva su fila de guardado fija (lo exige `e2e/v123`): decidir
   con Francisco si se quita también ahí. Pruebas `e2e/ia1.spec.js` de recomendaciones fallan en 844×390 ya en 1.45.
1. **Fondo con baldas más anchas y frontales** para las figuras: con las baldas actuales del fondo (≈ 195 px de la
   ilustración por balda y en perspectiva) se ven más pequeñas que en `docs/design/references/habitacion-figuras-maqueta.png`.
   Hace falta que Francisco entregue ese recurso; no improvisarlo.
2. **`e2e/v149` en `webkit-390x844`**: falla por una limitación del entorno (el WebKit de Playwright en Windows no
   dibuja bien `matrix3d`; las baldas de la habitación salen inclinadas). Confirmar en un iPhone real que las baldas
   se ven rectas. Las demás pruebas antiguas (panorama 9, entrega2, v123 pulsación…) se resolvieron en la 1.58.2 (§58).
4. **Sonidos**: todos sintetizados (mapa en SPEC §35.4). Faltan grabaciones reales de papel, cubierta, madera y
   sobre, con licencia registrada; descargar algo requiere permiso de Francisco.
5. **Bloques registrados y no hechos** (SPEC §32.3): las demás pantallas según sus maquetas (Perfil y Avatar,
   Lectores y actividad, Mi rincón…); salón y club con **capítulos y encuentros** (migraciones de Supabase con RLS
   y pruebas PGlite, más la interfaz); el icono `encuentros` espera a esa función.
6. Iconos de sección sin ubicación todavía: biblioteca, comunidad, reseñas y notas (no se añaden donde la maqueta no
   los pone).
7. Figuras antiguas (Dama de la Ceniza y Jinete de Dragones) no tienen imágenes con transparencia para exponerse en la
   habitación: siguen en el Ático. Las tres en SVG se retiraron en la 1.58.1 (§57).
7b. **Rendimiento en el iPhone real (1.59, §59)**: todo lo medido es emulación (Chromium y WebKit de Playwright). Grabar
   otra vez en el iPhone con más de 1.000 libros: desplazamiento rápido de la biblioteca (sin bloques marrones), lomos,
   «Libros compartidos», figuras del perfil, entrada a una visita y registro con el teclado abierto.
7c. **Nube por libro (propuesta, §59.5)**: la biblioteca sigue siendo un documento por cuenta (cada cambio sube el
   documento entero, con control de versión). Pasar a una fila por libro exige migración y RLS: decidir con Francisco.
8. **EPUB de otra obra** (§57.3): «The Ballad of Songbirds and Snakes» tiene vinculado «El árbol de la ciencia» en el
   móvil de Francisco. Sin defecto de código; confirmar con él si fue a propósito. No tocar sus datos.

### Decisiones vigentes que no deben deshacerse

- (1.52, decisión de Francisco) Día y noche son **la misma habitación**: la composición de día manda y de la noche solo
  se toma la luz. No usar otra ilustración para la noche. El libro es el pintado del día. Las pruebas e2e corren con el
  reloj a mediodía (`playwright.config.js`).
- (1.49, decisión de Francisco) La lectura se escribe sobre el libro **pintado** de la cama en coordenadas de la escena;
  no volver a poner un libro superpuesto en píxeles de pantalla. Encuadre vertical `x: 0.29` para ver los cascos (§47).
- (1.48) Los cinco filtros siempre a la vista sin desplazamiento horizontal (dos filas 3 + 2 si no caben); la
  habitación no muestra «Mi rincón» ni su subtítulo; los carteles se orientan según su superficie (§46).
- Biblioteca (1.47, sustituye a lo anterior): buscador y cinco filtros textiles siempre visibles; el resto de
  herramientas en un icono; sin título grande, sin hueco «Añadir libro» en las baldas; los libros no se agrandan (§44).
- «Abandonado» es un estado real y reversible; nunca automático por inactividad (§43).
- «Tu cuenta y copias» tiene acceso propio en la esquina, fuera de Ambiente (§45).
- Las placas de navegación de la habitación son iconos y nombres con Guías y reflejos sin Guías (§31, §33).
- Ordenador sin cuero, anillas ni pestañas de tela; Mi diario con pestañas digitales (§34).
- Biblioteca sin etiquetas de título bajo las portadas; tres libros por fila en móvil (§35).
- Materiales artesanales en biblioteca y ficha (§36) y, desde la 1.46 por petición de Francisco, en la esquina,
  los accesos y el libro de la habitación y en la vista de registro (§38). No en el resto.
- El libro abierto grande de la cama sustituye a la tarjeta de lectura flotante; nunca duplicar sus datos (§38).
- En la habitación solo se exponen figuras obtenidas con imágenes con transparencia; las cajas fotografiadas y los
  personajes planos no (§37).

## Bitácora

Formato de cada entrada (la más reciente arriba):

```
### AAAA-MM-DD · cuenta (nombre corto) · versión
- Qué se hizo y por qué.
- Commits (hash) y si se subió a producción.
- Qué quedó a medias o sin verificar.
- Decisiones nuevas de Francisco que haya que respetar.
```

### 2026-10-31 · cuenta principal · 1.62.0, bloques 1–3 (commit local, sin subir)
- A petición de Francisco, commit local en `main` con los bloques 1, 2 y 3 tal como estaban (descritos abajo), **sin
  push**: producción sigue en la 1.61.0. Fuera del commit, las carpetas de recursos que no están en git. Siguiente: bloque 4
  (clubes), también sin commit hasta que lo pida.

### 2026-10-31 · cuenta principal · 1.62.0, bloque 3 (sin commit)
- Hecho el bloque 3 (§62.3): `src/features/radio/` (nuevo: `catalog.js`, `catalogo-radio.json`, `radioPlayer.js`,
  `RadioControls.jsx`, `RadioPanel.jsx`, `RadioMini.jsx`), `radio-162.css` (nueva, importada al final),
  `ambientAudio.js` (`setAmbienceVolume`), `SocialSeats.jsx` y `socialMap.js` (la radio en la mesa), `RoomCorner.jsx`
  («Música» en Ambiente), `EpubReader.jsx` (hoja y control compacto), `App.jsx` (panel `radio`). Recursos en
  `public/media/social-radio/`.
- **Migración preparada, sin aplicar**: `supabase/migrations/20261031200000_radio_sintonia.sql` (para «Mostrar mi
  sintonía», que no se enseña hasta aplicarla). `entrega2.rls.test.js` ya espera la columna `radio_station`.
- QA: `v162-radio`, `v147`, `v152`, `v156`, `v157` en 360/390/430/1440/WebKit 390 pasan; `v162` y `entrega3` de
  comunidad en 320 y 390 pasan; Vitest 280/280; build y oxlint correctos. `v156` falló una vez en 1440 con la máquina
  cargada y pasó al repetirlo solo. Sin iPhone real (volumen y segundo plano sin comprobar allí).
- En escritorio la mesa del salón queda fuera del encuadre: a la radio se llega desde «Ambiente».
- **Sin commit**. Siguiente: bloque 4 (clubes), tras enseñar capturas a Francisco. Él tiene que escuchar la pista piloto.

### 2026-10-31 · cuenta principal · 1.62.0, bloque 2 (sin commit)
- Hecho el bloque 2 (§62.2): `SocialSeats.jsx` (etiqueta «Sentarme», tarjetas ancladas), `SeatCard.jsx` y
  `SeatChoice.jsx` (nuevos), `SocialTabs.jsx` (pestaña «Salón» nueva), `usePresence.js` (sentarse/levantarse
  devuelven si salió bien), `ReaderVisit.jsx` (fachada, «Entrar al rincón», ventana, «Salir»/«Saltar», ahorro de datos),
  `navigation.js` (campo `from` de la visita), `App.jsx`, `SocialRoom.jsx` y `social-162.css`.
- Ojo: `.reader-visit__back` ya existía en `social-161.css` (cabecera de «Sus libros»); el botón de volver de la
  visita usa `.reader-visit__leave`.
- QA: `v162`, `v158`, `v159`, `v161` y `entrega3` en 320/390/430/1440/WebKit 390: 77 pasan (las omitidas son
  por tamaño); comunidad completa en Chromium y WebKit 390: 71 pasan y 1 falló por tiempo con la máquina cargada (le
  di más margen y pasa en la tanda posterior); Vitest 278/278; build y oxlint correctos. Sin iPhone real.
- **Sin commit**. Siguiente: bloque 3 (radio y control en el EPUB), tras enseñar capturas a Francisco.

### 2026-10-31 · cuenta principal · 1.62.0, bloque 1 (sin commit)
- Encargo: paquete `material-diseno/social-radio/BookShelf-social-radio/` (salón, visita, radio, clubes). Francisco
  decidió: seguir el paquete en la visita (fachada, «Entrar», «Saltar») y en las tres pestañas, y hacerlo **por
  bloques** enseñando capturas. Reglas actualizadas en `CLAUDE.md`.
- Hecho el bloque 1 (§62.1): `SocialHub.jsx`, `ReadersSection.jsx` (nuevo), `SocialTabs.jsx`, `AddToPending.jsx`,
  `huellas.js` (duplicados por obra), `services/community.js` (`searchProfiles`), `services/connections.js`
  (`fetchMoreActivity`), `App.jsx` (pestaña en la ubicación), `social-162.css`. Simulador: `ilike` y `lt`.
- QA: `v162` en 320/390/430/1440/WebKit 390 (8 pasan); comunidad completa en Chromium y WebKit 390: 64 pasan;
  Vitest 274/274; build correcto. Sin iPhone real.
- **Sin commit**: el encargo dice no hacer commit sin petición explícita. Siguiente: bloque 2 (asientos y visita).

### 2026-10-31 · cuenta principal · 1.61.0 (publicada)
- Encargo «Pulir la visita social ya implementada» con maqueta (`docs/design/references/visita-rincon-libros-maqueta.png`).
  Detalle en §61. Tocados: `ReaderVisit.jsx`, `VisitBookSheet.jsx` (nueva `SharedLibrary`), `visitScene.js`,
  `navigation.js` (`libros/clave`), `social-161.css` (nueva, importada al final). Pruebas: nueva
  `e2e-community/v161.spec.js`; `v158` y `v159` al día; `visit.domain.test.js` con la vuelta nueva.
- QA: Vitest 274/274; `v158` + `v159` + `v161` de la comunidad en 320, 390, 430, 1440 y WebKit 390: 29 pasan (las
  omitidas son por tamaño). Build y oxlint correctos. Sin iPhone real.
- Límite del fondo real: en la mesita solo cabe un libro pequeño en el extremo izquierdo; la etiqueta cuelga del canto
  (no cabe en otra parte sin tapar planta, taza o mueble).
- Primero sin commit por indicación de Francisco; después commit en `main` y subida a producción a petición suya
  («hazlo y súbelo»). Sin comprobar aún en su móvil real.

### 2026-10-31 · cuenta principal · 1.60.0 (publicada)
- Encargo: secciones de la comunidad como en las maquetas, avatares nuevos de `material-diseno`, «Entre lectores» y
  seguir ajustando el libro de la cama (§60).
- Decisiones de Francisco: cuaderno con anillas para las tres pestañas (no la tarjeta lisa); la Hechicera de Eea de la
  maqueta sigue retirada; se conservan «En la sala», «Club» y «Visitar rincón».
- Migración nueva **pendiente de aplicar por Francisco**: `supabase/migrations/20261031120000_avatares_nuevos.sql`.
- QA: Vitest 273/273 (incluida RLS con el avatar nuevo); comunidad completa en verde tras corregir un segundo scroll de
  las pestañas; libro de la cama y biblioteca (diegetic, gouache, v147–v152, v159) en 360/390/430 y WebKit: todo en verde
  salvo `v149` en WebKit (fallo conocido; comprobado que falla igual sin el cambio). Build correcto.
- Sin verificar en el móvil real. Commit en `main` y subido a producción por petición de Francisco («Commit y súbelo»);
  la migración de avatares sigue pendiente de aplicar.

### 2026-10-31 · cuenta principal · 1.59.0 (publicada)
- Encargo «Rendimiento y errores visuales en iPhone con más de 1.000 libros» (§59). Vídeo inspeccionado
  (`Descargas/WhatsApp Video 2026-10-31 at 15.03.57.mp4`, 231,665 s, 384 × 832). Causas, mediciones antes/después y
  criterios en `docs/qa/iphone-large-library.md`; capturas en `docs/qa/iphone-large-library/`.
- Medición: `scripts/perf-large-library.mjs` (100/1.000/1.500 libros sintéticos, CPU ×4) y `src/perf/PerfProfiler.jsx`
  (solo en desarrollo). Telemetría: `scripts/analyze-telemetry.py` sobre los estados que audita `e2e/audit159.js`.
- Pruebas nuevas: `e2e/v159.spec.js` y `e2e-community/v159.spec.js`. Ajustadas: `v135` (tapa en espera de la portada).
- QA: `qa:full` **parado a petición de Francisco**. Resultados hasta ahí: Vitest 273/273 y 666 de Playwright.
  - Falló solo `v128` «busca con o sin tildes», por la búsqueda diferida; prueba ajustada con `expect.poll`.
  - Afectadas en los proyectos que faltaban: 72/72.
  - Comunidad: 104 pasan y 21 omitidas.
  - Build correcto.
  - Telemetría: 0 desbordes, 0 fondos sin pintar, 0 imágenes rotas y 0 errores de consola o de página. Solo hay
    solapes intencionados anteriores.
- Sin verificar en el iPhone real (pendiente 7b). Commit en `main` y subido a producción por petición de Francisco
  («Commit y súbelo»).

### 2026-10-31 · cuenta principal · 1.58.2 (publicada)
- «Haz lo que falte» tras la 1.58.1: dejar las pruebas en verde (§58). Fallo real corregido: la flecha «Abrir rincón
  social» perdía su centrado al pulsar (`room-146.css`) y con movimiento reducido no navegaba. Actualizadas las pruebas
  desfasadas (v123 colores, formulario y pulsación; v128 librería y reseña; panorama 9 y 14; v135, entrega2, entrega3).
- Verificación por partes: los 8 de movimiento reducido, cada prueba corregida en todos sus proyectos (intermitentes con
  repetición) y toda la comunidad en verde; build correcto. `qa:full` final **parado** a petición de Francisco (vuelve
  a valer `CLAUDE.md`: pruebas acotadas). Queda `v149` en WebKit (limitación de `matrix3d` en el WebKit de Windows).
- Rama `qa/fallos-previos` fusionada en `main` y subida por petición de Francisco («paralo y súbelo»).

### 2026-10-31 · cuenta principal · 1.58.1 (publicada)
- Encargo «Hotfix SDD de la auditoría del vídeo» (`BookShelf-fotogramas-QA/`, §57). Detalle, causas y aceptación en
  `docs/qa/video-hotfix.md`; capturas en `docs/qa/video-hotfix/`.
- Hecho: figuras SVG retiradas con compatibilidad para cuentas antiguas; visita social a pantalla completa, sin opciones
  de animación y con escena única; un lomo por libro compartido; franja de la biblioteca instalada (relleno superior
  duplicado en `src/index.css`); alias completo en reseñas; simular sellos solo en desarrollo. EPUB de otra obra: sin
  defecto de código (pendiente de confirmar con Francisco).
- `qa:full`: no llega a 0 fallos. 15 fallos anteriores comprobados contra `main` (lista en el documento), 2
  intermitentes; corregidas la prueba desfasada `v123 colores` y las del hotfix. Build correcto.
- Hecho en la rama `hotfix/auditoria-video` y fusionado en `main` con permiso expreso de Francisco; sin PR (no hay
  `gh` en este equipo). Pendiente: investigar los fallos del proyecto `chromium-390x844-reduced`.

### 2026-10-30 · cuenta principal · 1.58.0 (publicada)
- Encargo `material-diseno/visita-social/PROMPT-CLAUDE.md` (§56). Recursos copiados a `public/media/social-visit/`
  (4 918 851 B en total; huellas SHA-256 comprobadas) y su inventario a `docs/design/visita-social-*`.
- Nuevos: `src/features/social/visit.js`, `visitScene.js`, `hooks/useReaderCorner.js`, `components/ReaderVisit.jsx`,
  `VisitBookSheet.jsx`, `AddToPending.jsx`, `src/styles/social-visit.css`. Tocados: `App.jsx` (panel `visit`),
  `navigation.js` (`safeParent`), `SocialHub`/`SocialTabs` (botón «Visitar rincón»), `ReaderProfile.jsx` (usa el hook
  nuevo), `public/sw.js` (excluye `/media/` y `Range`), `e2e-community/mockSupabase.js` (bloqueos y bibliotecas como la RLS).
- Pruebas ejecutadas: vitest de la visita y navegación, `e2e-community/v158` en chromium-390x844 y webkit-390x844,
  `oxlint` y `npm run build`. Chromium de Playwright no reproduce H.264; WebKit sí. Sin iPhone real.
- `e2e-community/v135` (chromium-390x844): 1 en verde y 2 fallos **previos a esta versión**: buscan `.huella-trio`, que
  desde la 1.43 se llama `.huella-readings` («Sus lecturas» sí sale con los tres libros). Sin corregir la prueba.
- Commit y subida a producción pedidos por Francisco. Sin comprobar aún en su móvil real.

### 2026-10-29 · cuenta principal · 1.57.0 (publicada)
- Encargo «El lector EPUB desborda…» (§55). Nuevos `src/features/epub/epubLayout.js` (paginado) y `epubHighlights.js`
  (subrayados); `EpubReader.jsx` y `epub-155.css` rehechos; `updateQuote` ya solo aplica los campos que llegan (antes un
  parche de solo color dejaba el texto en `undefined`). Pruebas: `e2e/v157.spec.js` (320, 390, 1440 y WebKit 390) y
  `e2e/v156` ajustada (nombres de paneles, espera de guardado).
- Desbordamiento de las capturas: **no reproducido** en Chromium ni en WebKit de Playwright con contenido ancho. Causa
  probable: Safari de iOS ensancha los iframes con su contenido y la rejilla no tenía columna explícita; ambas cosas
  corregidas en origen. Falta confirmarlo en el iPhone de Francisco.
- Página a página: el gesto es el desplazamiento nativo con `scroll-snap` (WebKit no deja escuchar dentro del iframe sin
  scripts); umbrales del gesto = los del sistema, no los 48 px del encargo. Sin probar con el dedo en un iPhone real.
- Commit y subida a producción pedidos por Francisco. Sin comprobar aún en su móvil real.

### 2026-10-29 · cuenta principal · 1.56.0 (publicada)
- Encargo «Vinculación explícita del EPUB e interfaz del lector según la maqueta» (§54). Se conserva el motor de la 1.55.
  Nuevos: `src/domain/bookMatch.js`, `src/features/epub/epubPosition.js`; rehechos `EpubSection.jsx` y `EpubReader.jsx`;
  `epubStore` guarda por cuenta (`usuario:libro`, traslada las claves de la 1.55); `epub-155.css` reescrita.
  `e2e/v155.spec.js` se sustituye por `e2e/v156.spec.js` (360, 390, 320, 1440 y WebKit 390).
- Hallazgo: en un iframe `srcdoc`, un enlace `#x` se resolvía contra la dirección de la app y el iframe cargaba la app
  (sin scripts). Se fija con `<base href="about:srcdoc">`; la prueba comprueba que el iframe no sale de su capítulo.
- Sin probar: iPhone real; cambio de cuenta de extremo a extremo (necesita Supabase simulado; cubierto por pruebas de
  dominio y por el cierre del lector al cambiar de usuario); EPUB comerciales o de dominio público reales (no había
  ninguno en el equipo y descargarlo requiere permiso: la prueba usa uno sintético representativo).
- Commit y subida a producción pedidos por Francisco. Sin comprobar aún en su móvil real.

### 2026-10-29 · cuenta principal · 1.55.0 (publicada)
- Encargo «EPUB local, progreso y notas con la cuenta, lector al pulsar Leer, límites» (§53). Nueva dependencia
  `jszip` (3.10.1); lector propio (`src/features/epub/`) en lugar de epub.js (sin versiones desde 2023). Pruebas:
  `src/features/epub/__tests__/epub.test.js` y `e2e/v155.spec.js` (390, 1440 y WebKit 390, EPUB sintéticos).
- Hallazgos de WebKit (Playwright en Windows): no guarda `Blob` en IndexedDB (se guarda `ArrayBuffer`) y no ejecuta
  escuchadores dentro de un iframe sin scripts (por eso se desplaza el contenedor, la selección se sondea y los enlaces
  internos no llevan `href`: el salto con un toque solo funciona donde el navegador lo permite; el índice siempre).
- `PanelShell` ya no atiende el teclado si queda inerte bajo otra capa (el lector).
- Sin probar en un iPhone real ni con EPUB comerciales (con DRM no se pueden abrir: no se intenta).
- Commit y subida a producción pedidos por Francisco. Sin comprobar aún en su móvil real.

### 2026-10-29 · cuenta principal · 1.54.0 (publicada)
- Encargo «Baldas con toda la biblioteca» + «Retirar ebook e importar de Goodreads» (§52). Nueva dependencia
  `papaparse` (5.5.3), cargada solo en el panel y su worker. Sin migraciones: el registro de importaciones viaja en
  la biblioteca privada (`state.imports`). Pruebas: `src/features/imports/__tests__/goodreads.test.js` (15 casos con
  fixtures sintéticos) y `e2e/v154.spec.js` (390 y 1440); ajustada `e2e/v146` (el e-reader ahora es bolsillo).
- Quedan en las hojas antiguas reglas CSS del e-reader sin uso (`.ereader__*`, `[data-device]`): inofensivas.
- Visto de paso, no corregido: con un libro terminado en la cama, «Lectura terminada» se corta en el libro pintado.
- Commit y subida a producción pedidos por Francisco. Sin comprobar aún en su móvil real.

### 2026-10-29 · cuenta principal · 1.53.0 (publicada)
- Encargo «11. Rediseñar el diario según la maqueta adjunta»: «Mi diario» con Reseña, Notas e Historial (§51).
  Desaparece el guardado automático de la reseña: ahora es «Guardar reseña» con confirmación real, error y reintento,
  y borrador por libro. Publicar en el rincón exige guardar antes. Pruebas: `e2e/v153.spec.js` (360, 390, 430, 1440
  y WebKit 390); ajustadas `v134`, `v135` y `e2e-community/entrega2` al nuevo diario.
- Con el encargo vino el fondo nocturno con la misma geometría (comprobado): integrado como `SCENE_REFRESH.night`.
- Teclado del móvil comprobado solo en emulación (visor más bajo); sin probar en un teléfono real.
- Commit y subida a producción pedidos por Francisco. Sin comprobar aún en su móvil real.

### 2026-10-29 · cuenta principal · 1.52.0 (publicada)
- Encargo «Continuidad entre día y noche e integración del libro»: se retira la escena nocturna de la 1.51 y se
  rehace el contenido del libro pintado (ver §50). Falta el fondo nocturno equivalente (recurso pedido).
- Commit y subida a producción pedidos por Francisco. Sin comprobar aún en su móvil real.

### 2026-10-28 · cuenta principal · 1.51.0 (publicada)
- Habitación nocturna de la maqueta con los dos recursos que entregó Francisco (fondo y libro). Ver §49 y
  `docs/design/recursos-noche-maqueta.md`.
- Commit y subida a producción pedidos por Francisco. Sin comprobar aún en su móvil real.

### 2026-10-28 · cuenta principal · 1.50.0 (publicada)
- Ajustes pedidos por Francisco sobre la 1.49: botón del libro que se salía, texto torcido en la página izquierda,
  «Mi biblioteca» sin la perspectiva de la estantería y «Social» demasiado marcado. Ver §48.
- Aviso: el WebKit de Playwright en Windows no pinta bien `matrix3d` (pantalla del portátil y lomos salen deformados
  en emulación, también en 1.49); en la captura del iPhone de Francisco se veían bien. Sin comprobar en Safari real.
- Commit y subida a producción pedidos por Francisco.

### 2026-10-28 · cuenta principal · 1.49.0 (publicada)
- Encargo «Corrige la integración visual de la pantalla principal»: diagnóstico y cambios en §47. Francisco eligió
  escribir sobre el libro pintado (frente a usar el fondo móvil o esperar recursos).
- El componente `BedBook` sigue en el código para `bedProgress`, `RoomHeader` y `RoomNavPlaques`; el libro
  superpuesto ya no se monta (`BedPages.jsx` lo sustituye).
- Commit y subida a producción pedidos por Francisco. Sin comprobar aún en su móvil real.

### 2026-10-28 · cuenta principal · 1.48.0 (publicada)
- Encargo «Corrección de integración visual y selector de lectura» con capturas de su móvil: ver §46. Causa del
  solape de «Volver» en el móvil: `fix-138.css` (top con el área segura), invisible en emulación.
- Pendiente de recursos: si se quiere el libro de la cama tan ancho como en la maqueta sin tapar los cascos, haría
  falta un recorte de los cascos con transparencia (o un fondo con los cascos más a la izquierda).
- Commit y subida a producción pedidos por Francisco. Sin comprobar aún en su móvil real.

### 2026-10-28 · cuenta principal · 1.47.0 (publicada)
- Encargo «Pulido de habitación y biblioteca compacta» (maqueta `biblioteca-compacta-maqueta.png`): estado
  «Abandonado» (§43), biblioteca compacta (§44) y pulido de habitación, registro y Ambiente (§45).
- Recursos nuevos: `public/assets/ui/textile/etiqueta-{marfil,terracota,crema,salvia,malva}.webp` (derivados del lino
  salvia; no hay bases textiles específicas entregadas).
- Pruebas: build; Vitest 227/227; `e2e/v147.spec.js` y suites de habitación y biblioteca en Chromium 360/390/430/
  844×390/1440 y WebKit 390. Adaptadas a lo pedido: cinco filtros (`v134`), placeholder con «…» (`v128`), cuenta
  fuera de Ambiente (`ia1`), hora en Ambiente (`panorama` 16), «Añadir libro» en herramientas (`v146`).
  Sigue fallando la prueba 9 de `panorama` en 1440 (anterior a la 1.45).
- Commit y subida a producción pedidos por Francisco.

### 2026-10-27 · cuenta principal · 1.46.0 (publicada)
- Encargo largo de Francisco (maqueta de habitación con libro abierto). Hecho: puntos 2, 3, 7 (vista enfocada,
  fecha, «Deshacer»), parte del 8 (sin «respaldo automático») y del 9 (sonidos de hojas y página). Detalle en §38.
- Recursos nuevos en `art-inbox/maqueta-146/` (fuera de git) y derivados en `public/assets/room/`; maqueta en
  `docs/design/references/habitacion-libro-abierto-maqueta.png`.
- Se mantiene la ilustración de la habitación actual: el fondo móvil entregado no tiene té, vela ni lámpara.
- Pruebas: build, oxlint (sin errores), Vitest 210/210; e2e de habitación (diegetic, panorama, gouache, v134,
  v135, anexos, v123, ia1) en Chromium 360/390/430/844×390/1440 y WebKit 390. Se adaptaron pruebas a lo pedido
  (nombre «Porcentaje», «Rincón social» legible, libro grande, hora en «Ambiente», cuenta dentro de «Ambiente»).
- Después, punto 6: acabado físico de los libros (§39), calibrado con la portada de *Songbirds and Snakes*.
  Ojo: la portada de Open Library por ISBN de ese libro es un escaneo con pegatina. Prueba nueva `e2e/v146.spec.js`.
- Después, punto 8: buscador por ISBN y elección de edición (§40). Google Books devolvía 429 (cuota sin clave)
  durante las pruebas: la app pasa a Open Library. Pruebas con proveedores simulados en `e2e/v146.spec.js`.
- Commit de la 1.46.0 pedido por Francisco y después subido a producción a petición suya.
- 2026-10-28 · 1.46.1, punto 5 (§42), con commit y subida a petición de Francisco: ventana del calendario de la pantalla del portátil centrada en la zona
  que no tapan la planta y el vaso pintados. Prueba en `e2e/v146.spec.js`. Queda el resto del encargo
  (ver «Pendiente» 0): figuras (punto 4) y ordenador (punto 5).
- Después, punto 4 (§41), en su propio commit, también publicado: placa «Mi biblioteca» bajada (tapaba la balda central de
  figuras), foco del cierre del detalle y pruebas de figuras en `e2e/v146.spec.js`. El resto ya cumplía desde 1.45.

### 2026-10-27 · cuenta principal · 1.45.0 (documentación)
- Protocolo de traspaso automático en el apartado 0 de `CLAUDE.md`: leer este documento y git al empezar, anotar
  aquí en cada commit y escribir las reglas nuevas en `CLAUDE.md`. Puntero en `Claude/CLAUDE.md` (fuera de git).
- Las dos cuentas trabajan solo en este ordenador; `docs/TRASPASO.md` simplificado.

### 2026-10-27 · cuenta principal · 1.45.0
- Preparado el traspaso entre cuentas: `CLAUDE.md` (reglas y mapa), este documento y `docs/TRASPASO.md`.
- Publicadas 1.42.0 a 1.45.0 (último commit `eff8031`). Todo subido; nada a medias.
