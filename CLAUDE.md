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

- **Todo en español**: respuestas, resúmenes, botones, mensajes de commit y comentarios de código.
- **Commits y subidas, solo cuando se pidan** («haz el commit», «súbelo»). Subir `main` **despliega en producción**
  (Vercel). Nunca forzar el push ni reescribir historia publicada.
- **Sin líneas `Co-Authored-By`** ni firmas de IA en commits ni PR.
- **Supabase**: nunca exponer claves de servicio ni secretas; no desactivar RLS. Las migraciones nuevas van en
  `supabase/migrations/` y **las aplica Francisco** en el SQL Editor (se le entregan, no se ejecutan desde aquí).
- **No manejar contraseñas** ni iniciar sesión en cuentas.
- **No borrar datos del usuario.** Al probar en el navegador, usar perfiles de prueba (Playwright con su propio
  `localStorage`), no sus datos reales. Si algo no cuadra con lo esperado, puede ser que él esté usando la app:
  no «arreglar» sus datos.
- **No cambiar** la paleta del Ático ni las reglas de recompensas, piezas, cajas y pity.
- **Figuras SVG provisionales retiradas** (1.58.1, decisión de Francisco): el Pequeño Viajero, el Bardo del Viento y la
  Hechicera de Eea no deben volver como coleccionables ni sustituirse por otro marcador. Las cuentas antiguas conservan
  su inventario; se filtran con `RETIRED_FIGURES` (`src/domain/figures.js`).
- **Visita social sin opciones de animación** (1.58.1, decisión de Francisco): ni «Saltar», ni «Entrar sin animación»,
  ni preguntas previas; la entrada empieza sola, a pantalla completa y sin franjas; solo una flecha para volver.
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
filas virtuales, portadas 2:3 estables, figuras del perfil, visita sin pantalla oscura, registro con teclado, §59). La edición visual
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
