# Borrar la versión antigua de la app (la habitación ilustrada) y guardarla aparte

Francisco, 26-11-2026: «quiero que se borre la versión antigua de la aplicación porque sigue saliendo cuando la gente se mete en
la web para instalar la app». Investigado el 27-11-2026 (capturas en `qa-report/version-antigua/`) y decidido el mismo día:
«Bórrala, pero déjala aparte en otra carpeta aquí por si acaso la necesitamos en el futuro para algo».

**Estado**: confirmada por Francisco el 27-11-2026 («Sí, adelante»). **Bloques 1 y 2 hechos en la 1.157.0** (sin commit; SPEC §157; el 2, las pruebas e2e, §157.6 a §157.9):
la app sin la habitación y todo guardado en `archivo/habitacion-ilustrada/`. Ajustes sobre la lista: `images/cozy-book-room.jpg`
(fondo de Mi biblioteca), `room-refresh/pantalla-bahia.webp` (lector EPUB) y `assets/room/boton-terracota-cosido.webp`
(registro) se quedan porque los usa la app; las hojas recortadas siguen en su sitio de la cascada en vez de juntarse en una
nueva. Quedan los bloques 2 (pruebas) y 3 (publicar).

## 1. Qué es y cómo sale hoy

La habitación ilustrada de la 1.86: la ventana al mar, la estantería, la cama con su libro, el portátil, el salón social de al
lado (sillones, radio y tablet) y la guía de Libo «Descubrir mi habitación». Sale con «Volver a la experiencia anterior», que está
en la pantalla de quien entra sin cuenta y en el Menú del piso, y la elección se queda guardada en el dispositivo
(`bookshelf:inicio = anterior`).

## 2. Dónde se guarda

En **`archivo/habitacion-ilustrada/`**, en la raíz del repositorio, con las mismas rutas que tenía (`src/…`, `public/…`,
`e2e/…`) y un `LEEME.md` que explica qué es y cómo volver a enchufarla. Queda en git, pero **fuera de la app**: Vite no la compila
ni la publica, Vitest y Playwright no la ejecutan y Tailwind no la lee (`@source not`).

## 3. Lo que se mueve al archivo

### Código (39 archivos que solo usa la habitación, unas 4.100 líneas)

- `src/components/room/`: `PanoramicRoom`, `CozyRoom`, `RoomCorner`, `SocialRoom`, `BaldaPanel`, `SceneBase`, `SceneStage`,
  `SceneDebug`, `RoomHotspots`, `RoomSigns`, `RoomSurfaces`, `RoomReflections`, `RoomRefresh`, `RoomLiveData`, `RoomBookcase`,
  `RoomShelfBooks`, `BedBook`, `BedPages`, `AmbientLife`, `BaySailboats`, `SeaRipple`, `TeaDrain`, `TimeOfDayLayers`,
  `bookcaseLayout.js` y `DecorBoundary` (ya sin uso).
- La guía antigua: `src/components/onboarding/OnboardingGuide.jsx`, `src/hooks/useOnboarding.js`, `src/domain/onboarding.js`.
- La escena: `src/scene/panorama.js`, `guidePlacement.js`, `homography.js`, `sea.js`, `socialMap.js`, `stageFit.js`;
  `src/hooks/useSceneArt.js`, `useSvgIds.js`, `useToday.js`; `src/domain/spineArt.js`.
- Los sillones del salón: `src/features/social/components/SocialSeats.jsx` y `SeatCard.jsx`.
- `src/scene/sceneMap.js` se queda, pero solo con lo que siguen usando la biblioteca, las figuras y los avatares.

### Estilos

- Enteras: `room-151.css`, `room-160.css`, `rincon-01.css`, `room-signs-137.css`, `room-152.css` y `room-149.css` (de la
  habitación; sus pocas reglas que aún usa otra cosa se pasan a una hoja nueva).
- `room.css` (94 KB, solo el 16 % sigue en uso), `room-146.css` y `room-147.css`: se archivan y lo que sigue en uso (registro,
  cabeceras, accesos) pasa a una hoja nueva y pequeña.
- Las demás hojas no se tocan.

### Imágenes (unos 7 MB menos en la app)

- `public/images/room-refresh/` (6,3 MB), `public/images/cozy-book-room.jpg`, `public/images/cozy-social-room.jpg`,
  `public/cozy-book-room.jpg`, `public/assets/room/` y `public/images/laptop-foreground.png`, si nada más los usa. También sus
  entradas en la precarga del service worker.

### Pruebas

- `e2e/` (25 pruebas que son de la propia habitación): `anexos`, `diegetic`, `gouache`, `panorama`, `rincon-01-*`, `ia1`,
  `hotfix1581`, `v123` a `v159`, `v162-radio`, `v185-resena-imagen` y `v1136-libotown`. Se archivan las que prueban la
  habitación; las que prueban la biblioteca, la ficha o el registro pasando por ella se adaptan.
- Las pruebas unitarias de lo archivado (`src/**/__tests__`), al archivo.

## 4. Lo que cambia en la app

- **El inicio es siempre tu piso.** Sin «Volver a la experiencia anterior» (ni en la pantalla sin cuenta ni en el Menú del
  piso). A quien la tenga elegida en su móvil (`bookshelf:inicio = anterior`), la app le abre su piso; esa preferencia se
  ignora, sin borrar nada.
- **Sin cuenta**: queda la pantalla de entrada («Abrir «Tu cuenta»» y «Abrir Mi biblioteca»); Mi biblioteca sigue funcionando
  en el dispositivo como hasta ahora. **Antes, sin cuenta se podía usar toda la habitación ilustrada; después, solo la
  biblioteca y entrar con la cuenta.**
- Lo que solo estaba en la habitación y ya tiene sitio en el piso: el registro de lectura (el libro de la cama), el temporizador
  (la bandeja), la radio, el atlas, la cuenta y el ordenador. **Lo que se pierde**: el salón social ilustrado con sus sillones
  («quién lee ahora» sentado en el salón; la comunidad sigue en el ordenador) y la guía «Descubrir mi habitación» (Libo sigue
  guiando en el piso).
- **Ningún dato de nadie se borra**: libros, lecturas, diario, reseñas, decoración y ajustes siguen igual.

## 5. Las pruebas que hay que adaptar

76 pruebas de `e2e-community/` entran en el edificio pasando por la habitación ilustrada (69 por la tablet del salón). Se cambian
por una entrada común nueva (un solo ayudante) que entra desde tu piso, y se vuelven a pasar.

## 6. Por bloques, con evidencias

1. **El archivo y la app sin la habitación** (1.157.0): mover al archivo, `App.jsx` sin la habitación, estilos, imágenes,
   service worker y build. Capturas de quien llega nuevo desde la web, con y sin cuenta, y de alguien que la tenía elegida.
2. **Las pruebas**: la entrada común y las 76 de `e2e-community`; las de `e2e/`, archivadas o adaptadas.
3. SPEC, ESTADO y evidencias; publicar solo con el visto bueno de Francisco.
