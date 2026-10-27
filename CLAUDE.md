# BookShelf · guía para trabajar en el proyecto

Este archivo lo lee Claude Code al empezar cada sesión en esta carpeta. Lo comparten todas las cuentas que trabajen
aquí: si una regla cambia, se cambia aquí (y se anota en `docs/ESTADO.md`).

**Antes de nada, lee `docs/ESTADO.md`**: versión actual, lo pendiente y la bitácora de las últimas sesiones.
La especificación completa está en `SPEC.md` (una sección por versión; la cabecera dice la versión vigente).

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
- **Pruebas acotadas** a lo que se cambia: build + pruebas relevantes. **Nada de `npm run qa:full`** ni auditorías
  globales salvo que lo pida.
- **No afirmar pruebas en iPhone o Safari reales**: aquí solo hay emulación (Chromium y WebKit de Playwright).
- **Fidelidad con maquetas**: comparar capturas al mismo tamaño (390 px; revisar 360, 430 y escritorio) y declarar
  las diferencias que queden. No usar una maqueta como fondo ni recortar botones con texto de ella. Si falta un
  recurso imprescindible, decirlo y pedirlo en vez de improvisarlo.
- **Al terminar un bloque**: subir la versión en `src/diag.js`, `package.json`, `public/sw.js` (constante `VERSION`)
  y la cabecera de `SPEC.md`; añadir su sección a `SPEC.md`; y **anotar la sesión en `docs/ESTADO.md`**.

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
`computer.css` (ordenador, todo bajo `.pc`). Las hojas antiguas siguen cargadas: antes de crear una clase nueva,
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
- Atajos `border` y `font` de las hojas antiguas reinician `border-image` y las cifras: por eso algunas reglas de
  `craft-144.css` llevan `!important`.
- Dos pruebas fallan a ratos o siempre **desde antes de la 1.45** (ver `docs/ESTADO.md`): no ocultarlas cambiando
  la prueba sin investigar.
