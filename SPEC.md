# BookShelf — "Mediterranean Cozy Reading Sanctuary"

> SPEC 1.19.0 · 2026-10-21 · Aplicación hermana de GameShelf dedicada a libros y lectura.

BookShelf es un gestor de lectura personal que vive **dentro de una ilustración**: una habitación
costera mediterránea con estantería de roble, cama soleada, portátil, té helado y un gato dormido.
No hay barras de navegación ni paneles negros: cada función es un objeto de la habitación
(interfaz diegética "Zero-UI").

## 1. Stack y estructura

| Pieza | Elección |
| --- | --- |
| Framework | React 19 + Vite 8 (JavaScript/JSX) |
| Estilos | Tailwind CSS 4 (`@tailwindcss/vite`) + CSS propio por capa en `src/styles/` |
| Iconos | `lucide-react` |
| Tipografías | Cormorant Garamond (títulos), Lora (texto e interfaz), Caveat (a mano), Courier Prime (sellos y cifras) — Google Fonts, ver §1bis |
| Persistencia | `localStorage` (`bookshelf:v1`), sin backend ni cuentas |
| Audio | Web Audio API sintetizada en tiempo real (sin archivos de sonido) |
| Datos de libros | Google Books (sin API key) con respaldo automático en Open Library |

```
public/cozy-book-room.jpg        Ilustración base (984 × 1599, JPEG; hasta 1.16 se llamaba .png)
src/
  main.jsx · App.jsx · index.css
  scene/sceneMap.js              Coordenadas de cada objeto de la ilustración (px de la imagen)
  domain/                        Reglas puras: books.js, missions.js, dates.js, pets.js
  data/sampleBooks.js            Colección inicial
  state/useLibrary.js            Reducer + persistencia + acciones
  services/bookApi.js            Google Books → Open Library
  audio/ambientAudio.js          Motor de sonido ambiental y efectos
  hooks/                         useReducedMotion, useNow
  components/
    room/                        CozyRoom, SceneLayers, RoomAtmosphereCanvas, TimeOfDayLayers,
                                 RoomHotspots, RoomShelfBooks, TimeDial (astrolabio)
    shelf/                       ShelfView, BookItem, AddBookCard, PetBasket
    book/                        BookDetailModal
    panels/                      PanelShell, LaptopPanel, PomodoroTray, Drinks
    figures/                     figureCatalog, FiguresVaultModal, FigureArt, FigureShelfItem, RoomFigureShelves
  styles/                        room.css, shelf.css, book.css, panels.css, figures.css, …
```

## 1bis. Tipografía editorial artesanal (1.11.0)
Cuatro familias de Google Fonts con todos los acentos del español (`index.html`), como tokens en
`index.css` y aplicadas en `styles/typography.css` (cargada la última):

| Token | Fuente | Uso |
|---|---|---|
| `--font-display` | **Cormorant Garamond** 500/600/700 + cursiva | Títulos de libros, cabeceras de paneles y modales, el letrero *«La biblioteca junto al mar»*, tarjetas de cita y números grandes |
| `--font-sans` | **Lora** 400–700 + cursiva | Cuerpo de texto, sinopsis, listas de sesiones, botones e interfaz |
| `--font-hand` | **Caveat** 500/600/700 | Lo escrito a mano: ex-libris, citas subrayadas, *Mis pensamientos*, post-its y notas de la estanterías |
| `--font-mono` | **Courier Prime** 400/700 | Sellos de biblioteca (*Leído*), fechas de fichaje, `Pág. X de Y`, números de página y el reloj del temporizador |

- Cifras elzevirianas (`font-variant-numeric: oldstyle-nums`) en los textos literarios; cifras tabulares
  en relojes y contadores.
- Etiquetas en versalitas reales (`font-variant-caps: all-small-caps`) con tracking `0.09em` en lugar de
  mayúsculas forzadas.
- Contraste cálido: tinta sepia `#2C1E14` sobre papel crema `#FBF6EC`; nunca negro puro sobre blanco puro.

## 1ter. Alta papelería en los menús (1.12.0, `styles/stationery.css`)
- **Grano de papel de algodón** (`--cotton-grain`: `feTurbulence` con opacidad efectiva ≈ 0,035, más
  fibras alargadas) en las páginas del libro abierto, la ventana del portátil, la carta del temporizador,
  el sobre del día y las citas.
- **Borde de papel prensado** `box-shadow: inset 0 0 35px rgba(139,94,52,0.12)`.
- **Latón envejecido `#C59B27`**: clips de latón sujetando esquinas (bandeja, ventana del portátil, libro
  abierto) y **trozos de cinta washi** translúcida con borde rasgado.
- **Temporizador cozy = carta de cafetería mediterránea sobre madera de olivo:** bandeja con veta de olivo
  (turbulencia tileable), ticket de papel con el reloj y la *Carta · Café del Puerto* con cada bebida
  ilustrada, su descripción y frío/caliente; la elegida va rodeada a mano con tinta («tu elección»).
  Bebidas (`Drinks.jsx`): vaso de cristal con refracción, **hielo translúcido que mengua** con la sesión,
  rodaja de limón, cerezas, pajita y **gotas de condensación** que resbalan; tazas de cerámica esmaltada
  con plato (arte latte en el café, espuma en el matcha, nubes de azúcar en el chocolate) y **vapor real**
  difuminado (`feGaussianBlur`) que sube y se deshace.
- **Reto anual:** la mitad inferior la ocupan la torre física de libros leídos (lomos reales apilados) y
  la gráfica mensual (§6).

## 2. Escenario vivo

### 2.1 Encaje de la ilustración
- La ilustración es vertical (984 × 1599). El **escenario** (`.stage`) mantiene esa proporción y se
  ajusta en modo *contain* a la ventana (`width: min(100vw, 100dvh × 984/1599)`).
- Detrás, una copia muy desenfocada y oscurecida de la misma imagen rellena los laterales: en
  escritorio la habitación "se derrama" por los lados en vez de dejar bandas negras.
- Todas las capas internas se posicionan en **porcentaje de la imagen** a partir de
  `scene/sceneMap.js` (px de la imagen original → `%`), por lo que encajan a cualquier tamaño.
- Las capas SVG usan `viewBox="0 0 984 1599"` y dibujan recortes de la propia imagen
  (`<image href>` + `clipPath`), de modo que cualquier efecto se aplica sobre los píxeles pintados.

### 2.2 Motor ambiental (`RoomAtmosphereCanvas` + filtros SVG)
| Efecto | Técnica |
| --- | --- |
| Olas lentas en la bahía | Recorte del mar con `feTurbulence` + `feDisplacementMap` (escala 3–4) y `baseFrequency` animada con SMIL |
| Destellos solares (*sun glints*) | Canvas: chispas en forma de estrella de 4 puntas dentro del polígono del mar, más densas cerca de la franja de sol; titilan con fase propia |
| Gaviotas | Canvas: 3 gaviotas en "M" con aleteo sinusoidal cruzando el cielo a distinta altura y velocidad |
| Hiedra y flores de la pérgola | Recortes con `feDisplacementMap` cuya `scale` oscila (el campo de ruido es fijo, así los píxeles se mecen adelante y atrás como con brisa, sin "hervir") |
| Carillón de cristal | Recorte con máscara difuminada que pendulea desde su punto de anclaje (±1,4°) |
| Komorebi | Haces diagonales `radial/linear-gradient` ámbar con `mix-blend-mode: overlay` que respiran + sombras de hojas a la deriva |
| Polen y polvo dorado | Canvas: motas que flotan solo dentro de los haces de luz |
| Crestas y velero (1.1.0) | Canvas: trazos claros que avanzan del horizonte a la orilla; un velero que cruza la bahía en 140 s balanceándose |
| Nubes y cortina (1.1.0) | Recortes con desplazamiento lento: las nubes se hinchan, la cortina de gasa se mece con la hiedra |
| Pétalos, mariposas y vapor (1.1.0) | Canvas: pétalos que la brisa arranca de la pérgola y mariposas en el balcón; SVG: vapor de las tazas; las velas tienen llama también de día |
| Plantas, lámpara y objetos (1.2.0) | Brisa en la planta de la estantería, las flores del escritorio y del balcón, el ramo del jarrón y la monstera; la lámpara colgante se balancea; un reflejo cruza la tapa del portátil; burbujas en el té helado; la página del libro aletea y a veces se levanta del todo |
| Cámara viva (1.1.0, suavizada en 1.2.0) | La habitación respira (0,7 % en 18 s) y se desplaza unos píxeles con el ratón; **se queda quieta mientras señalas un objeto**, para que no se escape del cursor |

El canvas corre a 60 fps con `requestAnimationFrame`, limita el DPR a 2, se pausa con la pestaña
oculta y con `prefers-reduced-motion` pinta un solo fotograma (los SVG y CSS se detienen).

### 2.3 Hora del día
Tres atmósferas (`morning` · `sunset` · `night`). **Desde 1.5.0 la app las elige por el reloj** (mañana
7–18 h, atardecer 18–21 h, noche el resto) al abrirse y se actualiza cada minuto, hasta que la cambias a
mano en esa visita. Se cambian tocando el **carillón de cristal** (que suena). Desde 1.13.0 el sol (o la
luna) abre el **Atlas de Sagas** (§6bis).
- **Mañana soleada:** imagen original, haces komorebi y destellos dorados/blancos.
- **Atardecer dorado:** velo ámbar/rosado (`soft-light` + `color` sobre el cielo), sol bajo,
  destellos ámbar y primeras luces del pueblo.
- **Noche de lectura:** velo azul `multiply` con huecos alrededor de las luces; el exterior se
  oscurece con una **llave de azules** (filtro `feColorMatrix` que convierte el "azul" de la imagen
  en alfa, así solo se tiñe cielo y mar), estrellas enmascaradas al cielo, luna con reflejo
  plateado, ventanas del pueblo encendidas, y luz naranja parpadeante en la **lámpara colgante** de
  la estantería y en la **vela/farol de la mesita** junto al sillón (más la vela del escritorio).

## 3. Interfaz diegética y cámara

### 3.1 Estados de cámara
`view ∈ { ROOM_VIEW, SHELF_VIEW }`. La cámara es un `transform` sobre el escenario
(`perspective` en el padre) con transición `700ms cubic-bezier(0.22, 1, 0.36, 1)`:
- `ROOM_VIEW`: identidad.
- `SHELF_VIEW`: *zoom & pan* hacia la estantería izquierda (`scale` + `translate` + ligero
  `rotateY`), desenfocando la habitación. La librería de roble entra con un retardo corto.
- `Escape` o `"← Volver a la cama"` regresan a la habitación.

### 3.2 `ROOM_VIEW`
- **Libros integrados en las baldas pintadas** (`RoomShelfBooks`): los lomos del usuario se colocan
  en tres baldas de la pared izquierda con `perspective: 1100px; transform: rotateY(28deg) skewY(-6deg)`
  (ajuste fino por balda), sombreado de contacto y la luz de la escena multiplicada encima.
- **Protagonismo orgánico de la librería (1.3.0):** la luz de la lámpara baña las baldas y respira; motas
  doradas flotan delante de los lomos; cada 2,6 s un libro del usuario asoma un poco, como rozado; y al
  señalar la estantería los lomos despiertan en una ola de izquierda a derecha.
- **Capa de oclusión frontal** (`z-30`, `pointer-events: none`):
  1. **Llave de verdes**: la propia imagen recortada a la zona de la estantería con un filtro que
     convierte el verde de las hojas en alfa → la hiedra pintada vuelve a quedar *delante* de los
     libros del usuario.
  2. Ramas de hiedra SVG adicionales que se mecen.
  3. Foco de luz cálida de la lámpara y sombras de hojas al sol.
- **Objetos interactivos** (botones accesibles con forma propia, pulso cálido y etiqueta de papel
  flotante al pasar el ratón, enfocar o tocar). Desde 1.1.0 tienen protagonismo propio:
  insignia redonda con icono que flota siempre sobre cada objeto; un **halo de luz cálida difuminado**
  (sin recortes ni recuadros: 1.3.0 retiró el objeto "levantado") y destellos ✦ al pasar el ratón; y un
  **recorrido de pistas** que cada 3,2 s aviva el halo del siguiente objeto mientras no señales ninguno:

| Objeto | Acción |
| --- | --- |
| Libro abierto sobre la colcha | Muestra título, autor y `Pág. X de Y` del libro "Leyendo ahora"; esquina de página que se levanta con la brisa. Abre `BookDetailModal` |
| Estantería de madera | `SHELF_VIEW` (también la etiqueta discreta "Ver mi Librería") |
| Portátil con pegatinas | `LaptopPanel`: estadísticas, reto anual, misiones (dan Cajas Sorpresa) y sobre del día |
| Mueble izquierdo, baldas altas | Vitrina de figuras desbloqueadas → `FIGURES_VAULT_VIEW` (El Ático del Coleccionista) |
| Auriculares blancos | Activa/desactiva el sonido ambiental |
| Bandeja de té helado y cerezas | `PomodoroTray`: temporizador de lectura con bebida |
| Carillón de cristal | Cambia la hora del día |
| Sol / luna con astrolabio dorado | Abre el Atlas de Sagas (`SagaMapModal`) |
| Iconos de la esquina superior derecha | Pantalla completa · sonidos táctiles · ✨ Guías |

### 3.3 `SHELF_VIEW`
- Mueble de roble a pantalla completa con la **textura de madera de la propia ilustración**
  (`background-image` del recorte del escritorio y del costado del mueble), postales y polaroids
  recortadas de la imagen clavadas con chinchetas, macetas y enredaderas SVG, y el mar desenfocado
  visible a la derecha.
- Luz (1.8.0): sombra interior bajo cada tablón (`inset 0 22px 28px -10px rgba(15,8,0,0.75)`) y un haz de sol
  dorado diagonal con sombras de hojas de hiedra entrando desde el balcón (derecha).
- Baldas: **Leyendo ahora**, **Pendientes** y **Leídos**: solo libros y, junto a su libro, las figuras colocadas (§7). Botón de latón **🏆 Vitrina de Figuras** en el copete.
  Hueco final con ficha de biblioteca "+ Añadir libro".
- **Filtro de baldas (1.5.0):** cuatro cintas marcapáginas de tela cuelgan del copete (Todas, Leyendo,
  Pendientes, Leídos); también se filtra tocando la placa de latón de cada balda. Con una sola balda los
  libros se ven un 30 % más grandes.
- **Libro al azar (1.6.0, ruleta en 1.7.0):** un dado de madera con halo apoyado en el copete ("¿Al azar?").
  Al tirarlo, un foco salta de libro en libro cada vez más despacio hasta detenerse en un pendiente, que
  brilla y salta en su balda; una nota de papel ofrece *Abrirlo* / *Tirar otra vez*.
- **Mover libros (1.7.0):** arrastra un libro para reordenarlo o llevarlo a otra balda (una marca dorada
  indica dónde caerá). Cambiar de balda aplica el estado: a *Leídos* lo da por terminado, a *Leyendo* lo
  empieza, a *Pendientes* lo deja sin empezar. El orden se guarda (`shelfOrder`).
- Barra de herramientas integrada como placas de latón del mueble: vista *Escaparate / Lomos* y
  `"← Volver a la cama"`.

## 3bis. Habitación viva con datos reales ("Live Diegetic Room", 1.8.0)

### 3bis.1 Hotspots diegéticos, sin botones encima
- Se eliminan las insignias redondas permanentes. Cada objeto es un **hotspot diegético vivo**: al pasar el
  ratón, enfocar o tocar, el propio objeto pintado (recortado con su **silueta exacta**, `SILHOUETTES` en
  `sceneMap.js`, vía `clip-path: path()`) se aviva con un `drop-shadow` dorado en los bordes y crece un 5 %
  (`scale(1.05)`). La estantería y el carillón, sin silueta suelta, usan un halo cálido difuminado.
- Un único botón discreto arriba a la derecha, **«✨ Mostrar guías»** (`settings.showGuides`), enseña las
  insignias con icono y activa el recorrido que aviva un objeto tras otro.

### 3bis.2 Datos vivos dentro de la habitación
| Objeto | Qué muestra |
| --- | --- |
| Libro abierto de la cama | Impreso sobre el papel real de la página derecha (`BOOK_PAGE`, `matrix3d`), **sin tarjeta blanca** (1.13.0): tinta sepia `#2C1E14` mezclada con `multiply`, fondo cálido casi transparente, mini-portada con borde envejecido, título, línea de progreso, `% · Pág. X/Y` y el sello de tinta **+5 págs** (con una hoja que pasa y roce de papel). Tocar el resto del libro abre el modal 3D |
| Mueble: baldas altas | **Vitrina de figuras** (1.14.0, §7.2): solo las desbloqueadas, en caja o en peana según elijas |
| Mueble: balda de la vela | **Lomos reales** de lo que lees y tus favoritos, nunca portadas de frente (§7.2) |
| Portátil | Post-it amarillo inclinado en la esquina de la tapa: `🔥 N días · X págs hoy` (racha real del registro) |
| Vaso de té | Con el temporizador activo, la cuenta atrás flota como bruma cálida sobre el vaso, que se vacía |
| Auriculares | Con el sonido encendido, notas doradas y ondas suaves suben desde ellos |

### 3bis.3 Parallax de tres capas y sin bandas negras
- **Lejos** (mar, nubes, gaviotas, estrellas: `.layer-far` dentro del SVG), **medio** (la habitación) y
  **cerca** (`.layer-front`: la cama con libro, portátil, auriculares, bandeja, monstera y Miel, recortada con
  borde difuminado). Con el ratón o el giroscopio se mueven a 3 velocidades (≈3, 9 y 17 px en la imagen) y
  la escena se amplía un 2,5 % para que nunca asome un hueco. Se congela mientras señalas un objeto.
- Las bandas laterales pasan a un fondo ambiental cálido y desenfocado con destellos de luz, y la escena se
  enmarca con un **ventanal de madera**.

## 4. Sin mascotas (1.13.0)
Para aliviar la pantalla se retira todo el sistema de mascotas: ni la mascota de la librería (Miel, Rana
Peregrina, Michi Juez) ni la gata interactiva de la cama con su menú y sus accesorios. **Miel queda solo
como parte tranquila de la ilustración** (respira despacio, sin nada superpuesto). La cita del día pasa a
un sobre lacrado del portátil (§6).

## 4ter. Carta de algodón y lacre (`ElegantQuoteCard`, 1.12.0)
Presentación de las citas tanto en el sobre del día del portátil como al tocar la pluma de una cita en el diario del
libro abierto:
- Papel de algodón grueso marfil `#FAF5E8` con **bordes rasgados a mano** (polígono irregular propio de
  cada cita), fibra de papel, **ramita de olivo prensada** sujeta con washi translúcida y **sello de lacre**
  en relieve con las iniciales del autor en dorado.
- **Comillas capitulares en pan de oro** `#C59B27`; el texto en *Cormorant Garamond Italic* grande aparece
  **palabra a palabra como tinta húmeda** que se seca.
- Línea divisoria dorada con rombo; autor y obra en versalitas con `letter-spacing: 0.18em`.
- Acciones discretas: **Guardar en mi Diario** (colección de tarjetas del sobre del día), **Dejar clavada en la
  estantería** (`settings.pinnedQuote`: aparece con chincheta en lo alto del tablón de recuerdos) y
  **Compartir tarjeta** (`navigator.share` o, si no existe, copia el texto al portapapeles).

## 5. Libros

### 5.1 Modelo
```js
Book = {
  id, title, author, cover, synopsis, publishedDate, categories: [], pageCount, isbn,
  currentPage, status: 'reading' | 'want' | 'read',
  rating: 0..5, favorite,
  editionType: 'hardcover' | 'paperback' | 'sprayed_edges' | 'leatherbound' | 'clothbound'
             | 'annotated' | 'kindle' | 'audiobook',
  sprayedEdgeStyle: 'constellations' | 'botanical' | 'dragon_fire' | 'watercolor',
  audioHours?,   // audiolibros; si falta, ≈ 1,9 min por página
  quotes: [{ id, text, page, color: 'pink' | 'yellow' | 'blue' | 'gold', createdAt }],
  review, reviewedAt, addedAt, startedAt, finishedAt, source: 'sample' | 'google' | 'openlibrary' | 'manual'
}
Settings = { owner, pagesPerHour, timeOfDay, sound, viewMode: 'cover' | 'spine', pet, yearGoal,
             drink, focusMinutes, breakMinutes, currentBookId, pinnedQuote, customSagas }
Progress = { readingLog: [{ date, bookId, pages }], pomodoros: [{ date, minutes, drink }],
             pieces: 1..5, claimed: { [weekKey]: missionId[] }, companion: { … } }   // §4bis
```

### 5.2 Búsqueda (`services/bookApi.js`)
1. Google Books `GET /books/v1/volumes?q=…&maxResults=20&printType=books` (sin clave).
2. Si falla (red, 429, 5xx) o no hay resultados → Open Library `search.json` y, al elegir, la ficha
   de la obra (`/works/{id}.json`) para la sinopsis.
3. Normalización común: título, autor, portada HTTPS en alta resolución, sinopsis sin HTML, fecha,
   categorías, `pageCount` (Google `pageCount` · OL `number_of_pages_median`), ISBN.
4. Búsqueda con *debounce* de 400 ms y `AbortController`; alta manual si no aparece.

### 5.3 Anatomía física (`BookItem`)
- **Escaparate:** libro 3D (portada, lomo y bloque de páginas) que se inclina hacia el cursor. Anatomía de
  tapa dura (1.8.0): surco de la bisagra a 8 px del borde izquierdo (sombra + brillo), textura de lino y
  sombra proyectada profunda `0 14px 24px rgba(20,10,0,0.65)` sobre la pared del mueble.
- **Lomos:** grosor **proporcional a las páginas reales** (`páginas × 0,07 px`, mínimo 10 px): un libro
  de 900 páginas es 5 veces más ancho que uno de 180. Alto variable por edición.
- **Ediciones de coleccionista (1.10.0)** — ver §5.5: cada edición cambia el objeto en la balda.
- **Post-its:** una pestañita por cita guardada (máx. 6), del color de su marcador.
- **Cinta marcapáginas** de tela que cuelga sobre la balda en los libros "Leyendo ahora".
- Portada ausente o rota → cubierta tipográfica ilustrada generada con el color del libro.

### 5.4 Apertura 3D (`BookDetailModal`)
La cubierta gira 180° y revela dos páginas de papel crema (textura de ruido SVG, sombra del lomo):
- **Izquierda:** sello **Ex-Libris** *"De la biblioteca junto al mar de {owner}"*, página actual /
  total (± y deslizador), `% leído`, horas restantes según `pagesPerHour`, estrellas doradas,
  estado, edición (con el sub-selector de cantos o la duración del audiolibro), favorito y sinopsis.
- **Derecha:** diario de lectura: citas con página y marcador (Rosa Emoción, Amarillo Idea,
  Azul Tristeza, Dorado Épico), y reseña manuscrita sobre papel pautado.
- Si el libro está en *Leyendo ahora* y lees varios, arriba aparecen todos como lomos con su %: tocar
  otro lo abre y lo deja como el libro de la cama (1.5.0).
- En móvil una sola página con cintas marcapáginas para alternar Ficha / Diario.
- Avanzar páginas registra la lectura del día (estadísticas y misiones); llegar al final marca el
  libro como leído.

### 5.5 Ediciones de coleccionista (1.10.0, `editionType`)
Se eligen en el libro abierto (selector *Edición*), al dar de alta un libro y desde un **menú rápido en la
estantería** (clic derecho, pulsación larga o tecla de menú sobre un libro; flechas para recorrerlo y
Escape para cerrarlo sin salir de la librería). Cada edición es un objeto físico distinto:

| Edición | Escaparate (3D) | Lomos | Libro abierto |
|---|---|---|---|
| `hardcover` · Tapa dura con sobrecubierta | Tapas que sobresalen 3 px del bloque de hojas, surco de bisagra, brillo satinado que barre al pasar el ratón | Lomo base con filetes dorados | Tapas de tela |
| `paperback` · Edición de bolsillo | 6 % más bajo, mate, hojas crema tostado, sin vuelo de tapas | Más bajo y fino, con líneas de lectura en el lomo | Papel tostado |
| `sprayed_edges` · Cantos Pintados | Bloque de hojas y corte superior pintados con el diseño elegido; foil fino en la cubierta; gira un poco más para lucir el canto | Franja superior con el diseño | Cantos del diseño alrededor de las páginas |
| `leatherbound` · Grimorio en Cuero y Oro | Marco de piel envejecida con filete dorado, **2 cantoneras triangulares de latón** (arriba y abajo a la derecha), **4 nervios** asomando por el borde izquierdo, corte en pan de oro | 4 nervios en relieve y filetes dorados arriba y abajo, como los tomos que flanquean el Booknook | Tapas de cuero con 4 cantoneras de latón y cantos dorados |
| `clothbound` · Clásico en Tela Estampada | Lino tejido marcado, marco ornamental de foil que se enciende al pasar el ratón, cantos dorados, **cinta de seda dorada** | Tela con sello ornamental dorado | Tela verde con filete dorado |
| `annotated` · Edición Anotada | 5–7 post-its de colores escalonados por el corte derecho y el superior + faja *«Edición Anotada»* | Post-its asomando arriba y faja | — |
| `kindle` · E-Reader Tinta Electrónica | Dispositivo de 4 px de grosor con marco biselado negro o salvia mate, pantalla de tinta electrónica con la portada en grises y micro-barra de batería y `%` leído | Perfil metálico ultrafino con botón | Marco biselado con luz frontal cálida y barra `Pág. X de Y · %` |
| `audiobook` · Audiolibro | Estuche acrílico translúcido con reflejos, franja con ondas de voz doradas (se mueven al pasar el ratón), cascos y duración en horas | Lomo de cristal con ondas y horas | Estuche acrílico alrededor del cuaderno |

**Cantos pintados** (`sprayedEdgeStyle`): `constellations` (noche estrellada y oro), `botanical`
(enredaderas y flores), `dragon_fire` (brasas y escamas ámbar) y `watercolor` (acuarela mediterránea). El
cuero y la tela llevan corte en pan de oro (`#D4AF37 → #FFF3B0 → #AA820A`).

**Migración (v3):** el antiguo `format` pasa a `editionType` (`special` → `sprayed_edges`). Los libros de
ejemplo estrenan edición: *Alas de Sangre* (nuevo, cantos de brasas), *El Castillo Ambulante* (cantos
botánicos), *El Nombre del Viento* y *Circe* (cuero y oro), *El Principito* (tela estampada),
*Proyecto Hail Mary* (e-reader), *La Sombra del Viento* (anotada) y *Kafka en la orilla* (audiolibro).

## 6. Paneles diegéticos
- **Portátil (`LaptopPanel`, 1.4.0):** un escritorio de ordenador acogedor: tapa con cámara, fondo de
  pantalla con la bahía de la ilustración, barra de menú (BookShelf, app activa, wifi, batería, fecha y
  hora), post-it con las páginas de hoy, ventana con semáforos (el rojo cierra), botón **X** para salir del
  ordenador y **dock** de apps:
  - **Calendario:** mes con las portadas de lo leído cada día (dos apiladas y "+N"), páginas del día,
    color de intensidad, mes anterior/siguiente y resumen (páginas, días leyendo, libros, mejor día).
    Al tocar un día: libros, páginas y **% avanzado** de cada uno; borrar o apuntar una lectura
    (acción `addSession`, que suma las páginas al libro y al día elegido).
  - **Estadísticas:** páginas por día de los últimos 14 días, racha, totales, valoración media, géneros.
  - **Sesiones:** registro cronológico por día con portada, páginas y %, editable.
  - **Reto anual** (anillo de progreso, objetivo editable, ritmo) con, debajo (1.8.0), la **Torre física de
    libros leídos este año** —tumbados uno sobre otro con su lomo de color, grosor según sus páginas
    (~0,067 mm/pág + tapas), regla en cm y metas divertidas (taza de té, gata sentada…)— y las **páginas
    por mes** del año en barras finas.
  - **Misiones**: cada misión semanal cumplida da **+1 Caja Sorpresa** para el Ático (§7).
  - **Sobre del día** (1.13.0, `DailyQuote`): una vez al día llega un sobre con lacre (punto rojo en su
    icono del dock); al romperlo revela una cita literaria célebre como carta de algodón y lacre (§4ter) y
    da **hojas doradas** (1, o 2 si hoy ya has leído; cada 5, una **Caja Sorpresa**). Las cartas se guardan
    en *Tu Diario de citas*.
- **Bandeja (`PomodoroTray`):** bebida acompañante (Té helado con cerezas, Café con leche humeante,
  Matcha, Chocolate caliente) que **se va vaciando** con el tiempo; duraciones 25/5, 50/10 o
  personalizada; sigue contando aunque cierres la bandeja (indicador sobre el vaso); al terminar
  el **vaso de té de la ilustración se vacía** a la vez que el temporizador (y se rellena en el descanso;
  1.6.0). Al terminar suena una campanita y pregunta **por qué página vas** (con una estimación según tu velocidad y el libro
  elegible); después resume lo avanzado (páginas, +% y % total, páginas de hoy) y ofrece *Ver en el
  calendario*. Las páginas se apuntan en el día y las sesiones cozy salen como tacita en el calendario.

## 6bis. Atlas Cartográfico de Sagas (1.13.0, `SagaMapModal`)
- **Acceso:** el sol que brilla sobre la bahía (o la luna de noche) lleva un **astrolabio dorado** de
  anillos graduados que gira despacio y se aviva al pasar; tocarlo abre el atlas.
- **Estética:** pergamino náutico con cuadrícula de meridianos, costa a plumilla, manchas de edad, rosa de
  los vientos y marco de latón.
- **Sagas preconfiguradas** (`domain/sagas.js`): *Nacidos de la Bruma (Mistborn)*, *Saga Empíreo (Alas de
  Sangre)*, *El Cementerio de los Libros Olvidados*, *Crónica del Asesino de Reyes* y *El Señor de los
  Anillos* (con *El Hobbit* como precuela). Cada libro se empareja con tu estantería por su título en
  español o inglés, sin acentos. **Nueva saga:** nombre, autor y libros en orden (uno por línea), guardada en
  `settings.customSagas` y borrable.
- **Regla visual estricta:**
  - **Leídos** (`status === 'read'`): `grayscale(100%)` y opacidad 0,75, sello **✔ LEÍDO** y estrellas.
  - **Leer ahora** (el que estás leyendo de la saga o, si no, el primero sin terminar): **a todo color**,
    más grande, con halo dorado, **brújula dorada animada** y banderola **🧭 LEER AHORA**.
  - **Siguientes:** también en color, unidos por una **ruta de puntos dorados** (`#1 ➔ #2 ➔ #3`), con
    **+ Añadir a mi librería** si aún no están en la estantería (se añade a Pendientes con su portada).
  - Tocar un libro que ya tienes lo abre en 3D. En móvil la ruta se dibuja en vertical.

## 7. Figuras de Coleccionista · Edición Blíster de Lujo (1.14.0)
Sustituyen por completo a los Booknooks (retirados con sus imágenes y su motor). Cada figura es un *art toy*
chibi en caja negra con grabados dorados, ventana de plástico y un **blíster** con expresiones y reliquias.

### 7.1 Catálogo sin tocar código (`public/figures/catalog.json`)
Se lee en tiempo de ejecución (`components/figures/figureCatalog.js`). Cada figura:
```json
{
  "id": "dama_ceniza", "name": "La Dama de la Ceniza", "sagaTitle": "Nacidos de la Bruma",
  "matchKeywords": ["mistborn", "bruma", "imperio final"],   // emparejan con tus libros (sin acentos)
  "rarity": "legendary",                                     // legendary · epic · rare
  "starter": true,                                           // desbloqueada desde el principio
  "boxImage": "dama-ceniza-box.jpg",                         // foto o SVG de la caja (1024 × 1536)
  "unboxedImage": "dama-ceniza-box.jpg",                     // imagen de la figura fuera de caja…
  "unboxedCrop": { "x": 225, "y": 370, "w": 520, "h": 800 }, // …y su recorte (opcional)
  "particles": "mist",                                       // mist · embers · stardust · wind · gold
  "loreSeals": ["BRUMA", "ACERO", "LIBERTAD", "SECRETOS", "CENIZA"],
  "blisterParts": [ { "name": "Rostro Determinado", "kind": "face", "crop": { "x": 795, "y": 375, "w": 160, "h": 140 } }, "…" ]
}
```
Recortes reales (1.15.0), todos en px de la imagen:
- `boxOutline`: los vértices exteriores de la caja en perspectiva (6 en las fotos: canto lateral, frente y
  base). Se aplican como `clip-path: polygon(...)`, que elimina la mesa de madera y las estanterías del fondo.
- `unboxedSilhouette`: el contorno de la figura con su peana, usado como máscara SVG con bordes difuminados
  para quitar el fondo de libros y mesa al exponerla fuera de caja (las cajas ilustradas usan directamente
  una figura SVG con fondo transparente, `*-figure.svg`).
- `pinCrop`: el recorte de la cabeza para la mini-figura bajo el libro (§7.4).

`blisterParts` acepta también texto simple (`"Rostro Sonriente"`): sin `crop` se dibuja con un icono según
`kind` (`face`, `weapon`, `effect`, `relic`). Para añadir una figura: copia su imagen a `public/figures/` y
añade su objeto; aparece en el Ático y puede salir en las Cajas Sorpresa.

Incluidas: **La Dama de la Ceniza** (*Nacidos de la Bruma*, legendaria, foto real), **La Jinete de
Dragones** (*Saga Empíreo*, legendaria, foto real), **El Pequeño Viajero del Asteroide** (*El Principito*,
rara), **El Bardo del Viento** (*Crónica del Asesino de Reyes*, épica) y **La Hechicera de Eea** (*Circe*,
épica); estas tres con caja ilustrada en SVG del mismo formato. La figura «fuera de caja» se recorta de la
foto con su silueta recortada (no había foto aparte de la figura en peana).

### 7.2 Doble integración en el mueble izquierdo de `ROOM_VIEW` (1.15.0)
- **Las dos baldas superiores (la alta y la del cuadro del gato, sobre las postales) son solo para tus
  figuras.** Un panel integrado de roble en penumbra cálida, con luz lateral del balcón, **tapa los libros y el
  cuadro pintados**; encima, repartidas en las dos baldas (hasta 3 por balda), las figuras desbloqueadas
  recortadas sin su mesa ni su fondo, encajadas por homografía sobre los cuadriláteros medidos de esas baldas
  (equivale a `rotateY(24deg) skewY(-10deg)` ajustado a la ilustración), con sombra de contacto sobre la
  madera, la sombra interior del tablón `inset 0 14px 18px rgba(25,12,2,0.75)`, el sol en su lado derecho y
  la hiedra pasando por delante (`z-30`). Con rango ★★★ o más, partículas vivas encima. **Clic en cualquier
  punto de esas dos baldas → El Ático.**
- **Baldas inferiores (los lomos junto a la vela y los libros apilados de la repisa):** lomos reales de lo
  que lees y tus favoritos con su textura de edición, la luz de la vela y la sombra del estante de la cámara.
  **Clic en cualquier punto de esos libros → `SHELF_VIEW`**, con cursor de mano y la etiqueta «Ver mi
  librería» encendida al pasar.
- Bordes limpios: el contenedor raíz recorta cualquier desbordamiento, los botones de la esquina (pantalla
  completa, sonidos táctiles, ✨ Guías) quedan a 16 px de los bordes seguros, y las etiquetas cercanas al
  borde superior se abren hacia abajo para no quedar cortadas.

### 7.3 `FIGURES_VAULT_VIEW` · El Ático del Coleccionista (`FiguresVaultModal`)
Se abre desde la vitrina de la habitación o con **🏆 Vitrina de Figuras** en la librería.
1. **Inspección 3D:** la figura en grande se inclina con el cursor o el dedo (`rotateX/rotateY`), con reflejo
   especular sobre la ventana de plástico y brillo metálico en los grabados dorados. Selector **📦 Exponer en
   Caja de Coleccionista** / **✨ Exponer Fuera de Caja (En Peana)**, que se refleja en todas las baldas.
2. **Guardián de Lectura Activo y sus 5 Sellos Dorados de Lore:** cada día con páginas registradas o una
   sesión del temporizador **enciende 1 sello** (máximo uno al día); el 5.º otorga una **Caja Sorpresa** y los
   sellos vuelven a empezar. Botón de prueba **Simular lectura diaria (+1 Sello)**.
3. **Blíster de Reliquias y Expresiones:** los huecos del blíster de cada figura (recortes reales de la caja)
   se completan con las piezas que salen en las cajas; el **rango** sube de ★ a ★★★★★ según las piezas.
4. **Cámara de Unboxing:** Cajas Sorpresa ganadas leyendo (sin pagos). **Pity garantizado:** reliquia
   asegurada cada 3 cajas sin pieza y **nueva figura épica o legendaria** asegurada a las 10 cajas sin figura.
   **Senda Deseada:** la figura/saga que priorizan los pity. Rasga el precinto dorado deslizando (o tocando
   tres veces); la caja tiembla, salta una lluvia de chispas y se revela la figura o la pieza.
   Probabilidades por caja: 10 % figura nueva (si quedan), 55 % pieza que te falte; si no, **fragmento de
   sello** (+1 sello para tu Guardián).

### 7.4 Mini-figura de saga bajo su libro (`SHELF_VIEW`, 1.15.0)
Las baldas de la librería muestran **solo libros**. Bajo cada libro que pertenece a la saga de una figura del
catálogo (por sus `matchKeywords`), engarzada en el listón frontal de madera, aparece su **mini-figura de
34 × 34 px**: un pin coleccionable con la cabeza de la figura y **halo dorado** si ya la tienes, o en
**silueta apagada** con candado si aún no. Al pasar o tocar: *«Guardián de esta saga: La Dama de la Ceniza
(Sinergia x2 Pity)»*; al hacer clic abre esa figura en el Ático. La **sinergia** es automática: leer un libro
de la saga de una figura que tienes deja una carga y la siguiente Caja Sorpresa suma **el doble** a los dos
contadores de pity.

### 7.5 El Ático, más físico (1.15.0, misma paleta espresso, cuero oscuro y oro)
- **Hornacinas iluminadas:** cada casilla de la colección tiene una base de madera y latón y un haz de luz
  cenital cálido; las «Por descubrir» muestran la silueta chibi en penumbra con un contorno tenue y un
  candado de filigrana dorada.
- **Tubos de pity de cristal y latón:** dos barras ornamentales engarzadas en oro con un segmento por caja
  (3 y 10) que se encienden al llenarse.
- **Altar de Cajas Sorpresa:** pedestal de terciopelo y madera con la caja misteriosa en 3D (cerrada si no
  tienes cajas) rodeada en arco por los **5 medallones** de tu Guardián, encendidos según los sellos, y el
  botón **Reclamar mi sello de hoy** (si hoy has leído y aún no se ha encendido el sello del día).
- **Inspección:** la caja se recorta por sus vértices reales, con cantos 3D oscuros, sombra flotante
  `drop-shadow(0 28px 32px rgba(0,0,0,0.85))` y un reflejo diagonal que solo cruza el plástico de la
  ventana; fuera de caja, solo la figura sobre su peana circular con bruma animada detrás.
- **Rendimiento:** todas las imágenes de figuras son `<img loading="lazy" decoding="async">` recortadas por
  CSS (sin imágenes de fondo), así que una colección grande solo descarga lo que se ve.

**Estado** (`progress.figures`): `owned { [id]: { display, parts[], obtainedAt } }`, `guardian`, `seals`,
`lastSealDay`, `boxes`, `pity { relic, figure }`, `path`, `placements` (libros de la saga de cada figura,
sincronizados con el catálogo), `synergy`, `lastReward`. Migración
v5: Dama y Jinete desbloqueadas (con su primera expresión), Dama como Guardián y **1 Caja Sorpresa de
bienvenida**; las piezas del Booknook se canjean por cajas (una por cada pieza por encima de 3).

**Misiones semanales** (se reinician cada lunes; cada una se reclama una vez por semana y da **+1 Caja
Sorpresa**): leer 150 páginas · subrayar 2 citas · completar 2 sesiones cozy · terminar un libro · escribir
una reseña.

## 7bis. Vida reactiva de la habitación (1.9.0)
- **Bebida viva:** el vaso de té de la bandeja (y el del temporizador) baja de nivel con la sesión, los
  cubitos flotan en la superficie y se van haciendo pequeños, y si la bebida elegida es caliente
  (café con leche, matcha, chocolate) sube una columna de vapor sobre la bandeja.
- **Nubes de verano:** cada 35 s la sombra difusa de una nube cruza en diagonal la habitación y atenúa el
  sol unos 6 s; a la vez una ráfaga de brisa arrastra más pétalos desde la pérgola. Solo de día y al
  atardecer.
- **Interruptores físicos:** la lámpara colgante (clic) y el farolillo con vela de la mesita (cerilla /
  soplo) se encienden y apagan tocándolos (`settings.lampOn`, `settings.candleOn`). Encendidos dan un halo
  ámbar sobre los libros cercanos y abren su hueco de luz en la noche; apagados oscurecen la bombilla y la
  llama pintadas.
- **Muro de recuerdos:** un tablón de madera junto al mueble con polaroids clavadas de los libros leídos
  (portada, fecha y estrellas); en pantallas estrechas pasa a ser una tira bajo las baldas. Tocar una abre
  el libro.
- **Sonidos táctiles ASMR** (`settings.sfx`, icono de altavoz en la esquina superior derecha): roce de papel al abrir un
  libro, trazo de rotulador al subrayar una cita, clic de la lámpara,
  cerilla de la vela y notas del carillón.

## 8. Sonido (`audio/ambientAudio.js`)
Todo sintetizado: **olas** (1.3.0: murmullo de bahía al 50 % de volumen, rumor muy grave y olas lentas cada
8–13 s que apenas se oyen crecer y retirarse), **brisa entre hojas** (ruido
rosa en banda con ráfagas aleatorias), **roce de páginas** (ráfagas cortas de ruido filtrado cada
15–40 s). **De noche (1.6.0)** cantan grillos de campo naturales: tres cercanos con su propio compás (cri-cri de
2–5 sílabas de ~18 ms que caen ligeramente de tono, con un armónico tenue) y un coro lejano al azar, todo
con reverberación de campo abierto. El mar baja a un tercio y la brisa a la mitad para que manden los
grillos. Efectos: notas del carillón, maullido (sierra con glissando y formante), ronroneo (ruido
modulado a 26 Hz) y campanita del temporizador. **Atardecer (1.7.0):** chicharras que zumban a ratos (ruido en banda pulsado que crece y se apaga),
gaviotas lejanas cada 12–30 s y, cada minuto o so, tres campanadas lejanas del pueblo, con reverberación.

**Sonido activado por defecto (1.6.0):** como el navegador no deja sonar sin un gesto, el ambiente arranca
con el primer toque o tecla en la página; los auriculares lo silencian.

## 9. Accesibilidad y rendimiento
- Todos los objetos son `<button>` con `aria-label`; foco visible cálido; `Escape` cierra capas.
- `prefers-reduced-motion`: sin cámara animada, sin balanceos ni partículas.
- Imágenes de portada `loading="lazy"`; animaciones con `transform`/`opacity`; canvas pausado
  en segundo plano.

## 9bis. PWA a pantalla completa en el móvil (1.13.0)
- `public/manifest.webmanifest`: `display: fullscreen` (con `standalone` de respaldo), orientación vertical,
  colores `#2a1d14` e iconos 192/512 px (`public/icons/`, sol sobre la bahía y libro abierto) más
  `apple-touch-icon` de 180 px. Metaetiquetas de app web para iOS y Android en `index.html`.
- `public/sw.js` (solo en la versión compilada): la app abre sin conexión. Páginas con la red primero;
  recursos propios con caché primero; portadas en caché que se refrescan por detrás; `catalog.json` con la
  red primero para recibir figuras nuevas (`public/figures/catalog.json`).
- Móvil: sin rebote ni zoom por doble toque, sin resaltado al tocar, la escena no se selecciona como texto
  y se respetan la muesca y la barra de gestos. Botón **pantalla completa** en la esquina (Android y
  escritorio).
- **Escena ligera en móviles** (1.16.1, `scene/renderMode.js`): con puntero táctil o `deviceMemory` ≤ 4 la
  brisa de hiedra, cortinas, flores, plantas, nubes y mar (filtros SVG animados sobre la ilustración entera)
  queda quieta, y la noche y el atardecer tiñen la imagen fija en vez de duplicar la escena animada con
  `<use>`. En la GPU de un teléfono esas capas agotaban la memoria y dejaban bloques sin pintar. Siguen
  vivos la lámpara, el carillón, el vapor, las estrellas, las gaviotas, las partículas y los datos.
  Se fuerza con `?escena=ligera` o `?escena=completa`.
  En modo ligero el mundo tampoco lleva `will-change` ni la sombra de 120 px, y la librería no desenfoca la
  habitación: así el navegador no reserva superficies del tamaño de la ilustración a densidad de pantalla.
  Los tintes de noche y atardecer y la máscara del cielo limitan su región al área que cubren (1.16.2).
  Tampoco hay `backdrop-filter` en modo ligero (1.16.3): sobre los paneles largos con scroll el móvil dejaba
  bloques sin pintar; el velo de los paneles es un degradado cálido más opaco.
  La librería cerrada queda `visibility: hidden` (antes solo transparente, y seguía ocupando memoria
  gráfica) y, en modo ligero, la habitación deja de pintarse mientras la librería está abierta (1.16.4).
- **Diagnóstico** (1.16.2): con `?diag` en la dirección aparece una ficha con la versión, el modo de escena,
  pantalla y DPR, memoria, tamaño máximo de textura y modelo de GPU, si la ilustración cargó y si hay
  service worker, para capturarla desde el teléfono.
- **Probar en el teléfono** (misma wifi): `npm run movil:app` compila y sirve la app en
  `http://<IP-del-ordenador>:5191`. En Android, el botón de pantalla completa funciona directamente; para
  *instalarla* como app Chrome exige HTTPS (o, en pruebas, `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
  con esa dirección). En iPhone: Safari → Compartir → *Añadir a pantalla de inicio*. `npm run movil` sirve
  la versión de desarrollo en la red (sin service worker).

## 9ter. Despliegue y cuenta con sincronización (1.16.0)
Objetivo: usar BookShelf en el móvil sin perder el progreso y dejar la base lista para abrirla a más
gente en el futuro (cada persona con sus datos aislados).

**Hosting.** Vercel sirve la compilación (`npm run build` → `dist/`) con HTTPS, que la PWA necesita para
instalarse. `vercel.json`: `sw.js` e `index.html` sin caché (las versiones nuevas llegan al momento) y
`/assets/*` inmutables (llevan hash). El código vive en un repositorio de GitHub; cada `git push` a `main`
despliega.

**Configuración.** `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (variables de Vercel y, en local,
`.env.local`, que no se sube; plantilla en `.env.example`). La clave *anon* es pública por diseño: la
seguridad la da RLS. Sin estas variables la app funciona igual que antes, solo en el dispositivo.

**Base de datos** (`supabase/schema.sql`, se pega una vez en el SQL Editor de Supabase): tabla
`libraries` con una fila por usuario (`user_id` = `auth.uid()`, `data jsonb` con el estado completo,
`version`, `updated_at` puesto por el servidor con un trigger). RLS: cada usuario solo puede leer y
escribir su propia fila.

**Inicio de sesión con correo y contraseña** (`signUp` / `signInWithPassword`). Crear la cuenta manda un
único correo de confirmación con la plantilla por defecto de Supabase (un enlace); después se entra con la
contraseña desde cualquier dispositivo, también desde la app instalada en iPhone (que no comparte
almacenamiento con Safari, por eso no se usa enlace mágico). El servidor de correo gratuito de Supabase no
deja editar plantillas ni enviar más de unos pocos correos por hora: bastan para confirmar cuentas. La
recuperación de contraseña queda para cuando la app se abra al público (requiere SMTP propio). El cliente
de Supabase se carga bajo demanda (import dinámico), solo si la nube está configurada.

**Sincronización** (`state/cloudSync.jsx`, `CloudProvider`):
- El `localStorage` sigue siendo la fuente inmediata: la app abre y funciona sin conexión.
- Ajustes propios de cada dispositivo que no se sincronizan: hora del día y su modo automático, sonido,
  sonidos táctiles, guías, lámpara y vela.
- Al entrar: si la cuenta no tiene datos, se suben los del dispositivo. Si los tiene y este dispositivo
  nunca se sincronizó con esa cuenta, se pregunta: *usar lo guardado en tu cuenta* o *subir lo de este
  dispositivo* (con un resumen de cada lado: libros, figuras, última actualización). Lo que se descarta
  se guarda en `bookshelf:backup` por si acaso.
- Cada cambio marca el estado como pendiente y se sube 3 s después. La subida es condicional
  (`updated_at` debe seguir siendo el último visto): si otro dispositivo escribió entretanto, no se pisa
  y se vuelve a preguntar.
- Se baja lo nuevo al volver a la app (`visibilitychange`) y al recuperar la conexión (`online`), que
  también envía lo pendiente.
- Metadatos en `bookshelf:sync`: usuario, último `updated_at` visto y si hay cambios pendientes.

**Panel «Tu cuenta»** (botón de nube en la esquina, con un punto de estado): entrar con el correo,
estado (sincronizado, guardando, sin conexión, error), *Sincronizar ahora*, *Cerrar sesión* (los datos
se quedan en el dispositivo), el aviso de elección cuando hay dos versiones, y **Copias**:
*Exportar copia* (`bookshelf-copia-AAAA-MM-DD.json`) e *Importar copia* (pide confirmación y pasa por
las mismas migraciones que al cargar). La app pide al navegador almacenamiento persistente
(`navigator.storage.persist()`) para que no borre los datos.

**Futuro (fuera de esta versión):** inicio con Google, tiendas de apps empaquetando la PWA, y sustituir
las fotos de cajas descargadas por imágenes propias o con licencia antes de publicarla para todos.

## 10. Verificación
`npm test` (Vitest) y `npm run build` deben pasar sin errores. No hay `TODO` en el código.

## 11. Estabilidad móvil, capas y catálogo (1.17.0)

### 11.1 Incidencias observadas y estado de sus causas
| Incidencia (capturas del teléfono) | Estado |
| --- | --- |
| La ilustración base desaparece y flotan los objetos interactivos | **Hipótesis principal**: la base se dibujaba solo dentro de un SVG con filtros animados y duplicados (`<use href="#scene-live">`) sobre una superficie de 984×1599 a DPR ≈ 2,6, y el teléfono dejaba teselas sin pintar. Mejoró al quitar filtros (1.16.x). Falta confirmar la 1.17.0 en dispositivo físico. |
| Bloques sin pintar en paneles largos y en la librería | **Hipótesis**: `backdrop-filter` sobre contenedores con scroll y la librería invisible (opacidad 0) ocupando memoria gráfica. Mitigado en 1.16.3–1.16.4. |
| Franja del primer plano sobre el calendario | **Pendiente**: el modal vivía dentro de `#root` junto a capas con `perspective`, `translate3d` y máscaras. Desde 1.17.0 los modales van en `#modal-root` (portal) y se comprueba con `elementFromPoint`. |
| Portadas del calendario aplastadas | **Confirmada en código**: celdas cuadradas estrechas con `18px + 14px` reservados dejaban la portada en una línea. |
| `cozy-book-room.png` | **Confirmado**: el archivo es JPEG y Vercel lo servía como `image/png` (200, 460 766 B, sin HTML de respaldo; las rutas inexistentes dan 404). Se renombra a `cozy-book-room.jpg` para que el tipo coincida. Vite no usa `base`: despliegue en raíz. |
| Vercel / Supabase | **Sin evidencia** de que causen los fallos visuales: la sesión y la sincronización no desmontan la habitación ni cambian claves de React; no hay URLs firmadas ni buckets. |

**Comparación controlada (franja sobre el calendario).** En emulación (Chromium de escritorio con
viewport de móvil) no se reproduce: `elementFromPoint` sobre las celdas del calendario devuelve siempre
nodos de `#modal-root`, con y sin `backdrop-filter`, recorte de `FrontLayer`, filtros animados o
perspectiva. Queda pendiente en el teléfono: `?escena=completa` activa las cuatro condiciones a la vez y
`?escena=ligera` las quita (sin `backdrop-filter`, sin la cama recortada, sin filtros animados y sin
perspectiva), y `?diag` muestra la versión cargada.

### 11.2 Arquitectura de capas
Global (hermanos en `body`): `#root` (fondo extendido `z 0`, habitación `z 10`, librería `z 20`) y
`#modal-root` (modales, `z 1000`). Ningún ancestro de `#modal-root` tiene `transform`, `filter`,
`perspective` ni `contain: paint`. La pantalla completa se pide sobre `document.documentElement`, que
contiene a ambos.

Local, dentro de `.world` (la habitación tiene `isolation: isolate`): imagen base `0` · efectos SVG `1` ·
libros y figuras `3` · oclusión y primer plano `4` · iluminación `5` · canvas `6` · hotspots y
etiquetas `7–9`. Estas cifras no compiten con el portal.

- **Imagen base**: un único `<img class="scene-base">` HTML (984×1599, `eager`, `fetchPriority="high"`),
  independiente de filtros, máscaras, sesión, libros, catálogo, audio o canvas. Si el recurso falla de
  verdad, una ficha de papel crema ofrece «Reintentar» (sin bucles automáticos). Los SVG ya no repiten la
  base opaca: `#scene-live` contiene solo los recortes animados, y los tintes de hora se aplican sobre la
  ilustración recortada a su región.
- **Modales**: `PanelShell` se renderiza con `createPortal` en `#modal-root` (mismo árbol React y mismo
  `LibraryProvider`), igual que el visor de citas y el menú de ediciones. Con un modal abierto, la
  aplicación de fondo queda `inert`, las animaciones decorativas se suspenden (el temporizador sigue) y la
  imagen base sigue visible. Se conservan Escape, cierre por fondo, foco atrapado y devuelto; el diálogo
  acepta foco (`tabIndex={-1}`) si no tiene controles.
- **Identificadores SVG** únicos por instancia (`useId`), con unidades explícitas en máscaras y recortes.

### 11.3 Perfil móvil de renderizado
Se activa con `(max-width: 760px) and (pointer: coarse)` y, además, con puntero táctil o
`deviceMemory ≤ 4` (incluye tabletas, donde también pueden aparecer los fallos); se fuerza con
`?escena=ligera` o `?escena=completa`. En él:
- Sin parallax (no se registran `pointermove` ni `deviceorientation`), capas con `transform: none`, sin
  respiración de cámara y con `perspective: none` en `ROOM_VIEW`; la transición a la librería es un zoom 2D.
- `FrontLayer` no redibuja la cama (ya está en la base): solo la esquina de página, el reflejo y Miel.
- Sin brisa SVG animada ni `backdrop-filter` (velo `rgba(44, 30, 20, 0.48)`).
- Canvas a `min(devicePixelRatio, 1.5)`, buffer según el tamaño mostrado, un solo
  `requestAnimationFrame`, pausado con la pestaña oculta, un modal abierto o la librería.

### 11.4 Viewport, escala y bandas
`<meta viewport … viewport-fit=cover>` sin bloquear el zoom. La escena se mide con `ResizeObserver`
sobre `.sanctuary` (`100vh` de respaldo, `100dvh` preferente) y `k = min(ancho / 984, alto / 1599)`,
agrupado en `requestAnimationFrame`; con `visualViewport.scale ≠ 1` (pinch-zoom) no se reescala.

Hasta 1.17 se mantenía `contain` (sustituido en móvil por §12.2): en pantallas más altas que la ilustración quedan bandas, rellenas con la
ilustración extendida (`.backdrop`, más clara en móvil) y sin el marco de madera en móvil. No se puede
llenar cualquier proporción sin cortar objetos o deformar la escena, y `cover` cortaría las baldas, el
sol, el libro o los auriculares.

### 11.5 Calendario y portátil en móvil
- Celdas de `clamp(76px, 21vw, 96px)` de alto (no cuadradas), con la portada en `inset: 20px 3px 21px`
  y `object-fit: contain`, el número arriba a la izquierda y las páginas abajo a la derecha.
- Cabecera sin `min-width` y flechas de 44×44.
- El portátil cabe en el alto útil (menos áreas seguras y 12 px por lado), en columna flexible.
  `.window__body` es la única zona de scroll (`overscroll-behavior-y: contain`) y el detalle de un día se
  abre como panel interno dentro de la ventana.
- Nunca se reduce con `scale()`.

### 11.6 Caché y service worker
- Versión `bookshelf-v1.17.0`. Al activarse solo borra las cachés que empiezan por `bookshelf-`.
- Assets con hash (`/assets/`): caché primero.
- Imágenes con nombre estable (ilustración, figuras, iconos): caché y refresco por detrás.
- Navegación y `catalog.json`: red primero; el catálogo solo sustituye la copia guardada si es JSON
  válido con `figures`.
- Nunca guarda respuestas fallidas ni nada de Supabase u otros orígenes (salvo las portadas).
- Una imagen solo se guarda si llega con `Content-Type: image/*` y un asset con hash si no es HTML: un
  servidor con respaldo de SPA (como `vite preview`) responde 200 con HTML a rutas inexistentes.
- Sin `skipWaiting()` inmediato: la versión nueva espera y se activa cuando la app pasa a segundo plano,
  sin recargar la página, así no se pierden formularios ni sesiones.

### 11.7 Contrato del catálogo de figuras (`public/figures/catalog.json`)
La raíz es `{ version, imageSize, figures: [...] }`, no un array.

- **Campos canónicos por figura**: `id`, `name`, `sagaTitle`, `subtitle`, `matchKeywords`, `rarity`,
  `unlockedByDefault`, `accentColor`, `secondaryColor`, `boxImage`, `unboxedImage`, `particlePreset`,
  `loreSeals`, `blisterParts`.
- **Opcionales**: `sagaId` (saga de `domain/sagas.js`), `authors` (para desambiguar), `boxSize`,
  `unboxedSize`, `boxOutline`, `boxWindow`, `pinCrop`, `pinImage` y `since` (versión del catálogo en que
  se añadió).

**Compatibilidad.** La normalización vive en un único punto, `domain/figureCatalog.js`:
- `unlockedByDefault ?? starter ?? false`
- `accentColor ?? accent ?? '#E8C46A'`
- `particlePreset ?? particles ?? 'gold'`
- `secondaryColor ?? '#C59B27'`
- `subtitle ?? ''`

Los alias internos `starter`, `accent` y `particles` se mantienen para los consumidores actuales.

**Validación.**
- IDs únicos (gana la primera entrada).
- Rareza `legendary | epic | rare`; partículas `mist | embers | stardust | wind | gold`; colores
  `#RGB` o `#RRGGBB`.
- `matchKeywords` como strings no vacíos y recortes dentro de la imagen.
- Las entradas con `since ≥ 2` deben traer 5 sellos y 5 piezas; las antiguas conservan las suyas (no se
  recorta ningún inventario).
- Una entrada inválida se descarta con un aviso en consola sin romper el resto.
- Un fallo de carga no se guarda como catálogo vacío: se reintenta al recuperar la conexión o al volver
  a montar.

**Figura desprecintada.** Hay dos rutas explícitas:
- *Asset con alfa*: un `unboxedImage` propio (PNG, WebP o SVG transparente) que se muestra entero con
  sus dimensiones reales (`unboxedSize`), con `object-fit: contain` y sombra, sin máscara.
- *Legacy*: si no hay asset propio, la opción «Desprecintada» aparece como no disponible con una
  explicación breve y se muestra la caja, sin borrar la preferencia guardada.

Faltan los recortes con transparencia real de La Dama de la Ceniza y La Jinete de Dragones.

**Vinculación con libros** (`figureForBook`):
1. El texto se normaliza (mayúsculas, acentos, espacios y puntuación).
2. Primero cuenta la saga explícita (`sagaId` y los títulos de esa saga).
3. Después, `matchKeywords` como palabras completas del título.
4. El autor solo desambigua: si la figura declara `authors` y el libro tiene otro autor, no se vincula.

Nunca se vincula un libro solo por su autor.

### 11.8 Ático y controles
- Misma paleta: espresso, madera oscura y oro champán.
- El Ático cabe en el viewport útil con scroll vertical propio.
- Los botones de exposición envuelven (`flex: 1 1 220px`) y el texto de sinergia parte las palabras
  largas.
- Los controles superiores son pestañas de madera y latón integradas en el marco.
- El portátil se cierra con una pestaña de latón de 44×44 dentro de su marco.

### 11.9 Criterios de aceptación (1.17.0)
- La ilustración principal sigue visible en:
  - carga fría y recarga con service worker;
  - cambio de pestaña y rotación;
  - día, atardecer y noche, con guías activas o no;
  - red lenta y offline después de una carga.
- La cama nunca tapa un modal: `elementFromPoint` sobre el calendario devuelve un nodo del modal.
- Las portadas del calendario conservan altura visible; la última semana, la leyenda y el dock se
  alcanzan con scroll, y no hay scroll horizontal involuntario.
- Hotspots y objetos pintados alineados; ningún control del Ático cortado.
- No se pierden libros, progreso, inventario, pity, sellos ni rachas.
- Los alias antiguos del catálogo siguen funcionando y las entradas canónicas se interpretan.
- Viewports revisados en emulación: 360×800, 390×844, 412×915, 768×1024, 1440×900 y 915×412. La
  validación en Android físico la hace el usuario.
- Pruebas (`npm test`):
  - normalización de campos antiguos y canónicos;
  - vinculación por título o saga sin falsos positivos por autor;
  - conservación de IDs e inventario;
  - recuperación tras un fallo de carga.

## 12. Móvil a sangre, transiciones estables y ambiente vivo (1.18.0)

### 12.1 Qué es cada franja
| Franja | Origen | Tratamiento |
| --- | --- | --- |
| A | Hueco del ajuste `contain` de la ilustración | Se elimina con el encuadre *cover* en móvil (§12.2). |
| B | Fondo o padding del contenedor | Se elimina: `.sanctuary` es `position: fixed; inset: 0` a `100dvh`, sin padding. |
| C | Área segura (muesca, barra de gestos) | La escena llega a los bordes; solo los controles y paneles se separan (`env(safe-area-inset-*) + 12px`). |
| D | Barras del navegador o del sistema | Fuera del alcance de CSS. Se usa la pantalla completa real (§12.3); si el sistema reserva una franja fuera del área concedida a la página, no se puede ocultar. No se manipulan los indicadores de privacidad del sistema. |

La 1.18.0 sustituye la decisión de §11.4 de conservar siempre `contain` en móvil.

### 12.2 Encuadre móvil (cover) con cámara desplazable
- Coordenadas lógicas intactas (984 × 1599). Hasta 760 px de ancho: `scale = max(vw / 984, vh / 1599)`.
  En el resto, `min(...)` (el encuadre aprobado de escritorio).
- Una sola cámara para todo (imagen base, SVG, canvas, figuras, lomos, post-it, sol/luna, hotspots):
  `.world` con `transform-origin: 0 0` y `transform: translate(x, y) scale(s)` (`scene/camera.js`).
  Escritorio en `SHELF_VIEW`: `translate(centro) scale(s·1.75) rotateY(7deg) translate(-foco)`, equivalente
  al zoom anterior.
- *Cover* recorta sin deformar. Para llegar a lo recortado, en `ROOM_VIEW` se arrastra el escenario:
  - el desplazamiento queda acotado (`vw − anchoRenderizado ≤ x ≤ 0` y lo mismo en vertical);
  - si el arrastre supera 8 px CSS, al soltar no se activa el objeto;
  - dos dedos nunca activan objetos, y el pinch-zoom del navegador se conserva (`touch-action: pinch-zoom`);
  - `pointercancel` y la captura del puntero se gestionan; no hay inercia ni rebote.
- Con el teclado, un objeto enfocado fuera del encuadre se trae a la vista con 16 px de margen.
- Al rotar o cambiar las barras se conserva el centro lógico observado y se recalculan los límites. El
  cambio de escala se aplica sin transición, también al aparecer el teclado.
- En móvil no hay marco de madera ni rectángulos o degradados que tapen franjas.

### 12.3 Pantalla completa y PWA
- Manifiesto: `display: "fullscreen"` con `display_override: ["fullscreen", "standalone"]`; se mantienen
  `id`/`start_url`/`scope` e iconos. La orientación vertical ya existía y no se usa para esconder fallos.
- Pestaña de pantalla completa en el marco: solo con un toque explícito, si hay `document.fullscreenEnabled`
  y `requestFullscreen`, sobre `document.documentElement` (incluye `#modal-root`) con
  `{ navigationUI: "hide" }`. Los rechazos se capturan. Se sale con `exitFullscreen()`, el estado se
  sincroniza con `fullscreenchange` y nunca se vuelve a entrar solo.
- Modos distintos: pantalla completa por API (`document.fullscreenElement`), app instalada a pantalla
  completa (`display-mode: fullscreen`, sin pestaña) y app instalada `standalone` (la pestaña se ofrece si la
  API existe).
- Sin API (Safari en iPhone): la pestaña explica, solo al tocarla, que la app instalada desde «Añadir a
  pantalla de inicio» se abre sin barras.

### 12.4 Estados de transición
`room → enteringShelf → shelf → leavingShelf → room`, en una sola máquina de estados en `App.jsx`:
- **Durante `enteringShelf`** la habitación sigue entera debajo y la librería (opaca, z 20) entra por
  opacidad.
- **En `shelf`** la habitación queda `visibility: hidden`, `pointer-events: none`, `inert` y con los
  efectos pausados (sigue montada y la imagen decodificada).
- **En `leavingShelf`** la habitación se hace visible antes de retirar la librería, que sale por opacidad
  sobre ella. Nunca se desvanecen ambas a la vez.
- **Móvil**: 180 ms, `cubic-bezier(0.2, 0, 0, 1)`, solo opacidad y sin el zoom 3D. **Escritorio**: el zoom
  de cámara aprobado.
- **Cierre**: con `transitionend` (filtrado por `target` y `propertyName: opacity`) y un respaldo
  cancelable de 240 ms en móvil.
- **Atajos**: los toques rápidos invierten el estado sin atascarse; con la pestaña oculta o movimiento
  reducido el cambio es directo.
- **Modales** en móvil: se abren por opacidad en 140 ms, sin escala, desenfoque ni perspectiva. El fondo
  queda inmóvil y el portal sigue fuera del árbol transformado.

### 12.5 Jerarquía y superficies
- **Global**: habitación `z 10`, librería `z 20` y modales `z 1000`. Cada vista con `inset: 0`,
  `isolation: isolate` y `mix-blend-mode: normal`.
- **Librería**: tiene su propia superficie continua de roble, opaca, con la textura y los colores
  actuales, para que la habitación no se vea entre las baldas.
- **Rectángulo violáceo (hipótesis, sin reproducir en emulación)**: coincide con el color de la capa
  nocturna, un `div` de 984×1599 con `multiply` sobre capas compuestas. Si el navegador del teléfono pierde
  una tesela del fondo, la mezcla pinta ese violeta liso.
- **En el perfil ligero**, las capas de noche y atardecer de toda la escena usan mezcla normal con alfa.
  Las mezclas quedan reservadas a capas pequeñas: `multiply` para las sombras de hojas y `screen` para la
  luz.

### 12.6 Ambiente (la ilustración base sigue estática)
| Efecto | Equilibrado | Ligero | Detalles |
| --- | --- | --- | --- |
| Ondas del mar (dentro de `SEA`) | 12 | 6 | 12–38 px, ±3–8 px horizontal, ≤ 2 px vertical, 4–7 s, opacidad 0,08–0,22 de día y 0,04–0,12 de noche, sin apariciones bruscas |
| Reflejos en el agua | 10 | 5 | 3,5–6 s, fases deterministas, `#FFF1C4` de día y `#DCE8F4` bajo la luna |
| Sombras de hojas | 2 | 2 | `multiply`, `#2C1E14`, opacidad 0,025–0,055, ≤ 4 px, ≤ 0,35°, 18–26 s, manchas ya suavizadas (sin blur animado) |
| Rayos de luz | 2 | 2 | `screen`, `#FFE6AB`, opacidad 0,025–0,065, respiración de 14–20 s, solo opacidad, apagados de noche |
| Polvo en la luz | 14 | 6 | 0,5–1,2 px, 2–5 px/s, opacidad ≤ 0,18, solo dentro de los haces |
| Vela y farolillo | — | — | halo 0,12–0,17 y escala ≤ 1,015 con periodos superpuestos de 2,8 s y 4,7 s |
| Vapor de bebida caliente | 3 | 2 | 6–9 s, ≤ 18 px de subida, según bebida y temporizador |
| Vegetación | filtros del escritorio | sin animación | en móvil la planta pintada queda quieta y se mueven sus sombras (no hay recortes transparentes fiables) |

Se mantienen, más discretos, el velero, las luces del pueblo de noche, las luciérnagas y las burbujas del
té. Se retiran los pétalos, las mariposas y las motas repartidas por la estantería, que daban aspecto de
purpurina.

### 12.7 Presupuesto y perfiles de movimiento
- `balanced`: 60 fps, DPR ≤ 1,5. `light`: 30 fps, DPR ≤ 1. `reduced`: un único fotograma estático.
- **Cadena de dibujo**: una sola cadena `requestAnimationFrame`, movimiento por tiempo con el delta
  limitado a 50 ms y un acumulador para el límite de fps. Al reanudar se reinicia la marca de tiempo y
  se conservan las fases, sin resembrar.
- **Sin coste por fotograma**: nada de `setState` ni de arrays u objetos nuevos; los reflejos, el polvo y
  las luces son sprites pre-renderizados.
- **Limpieza del lienzo**: se borra con la transformación identidad y se restablece la lógica. El tamaño
  del lienzo solo cambia si cambian la escala o el perfil.
- **Perfil adaptativo**:
  - Móvil empieza en ligero y escritorio en equilibrado.
  - Si la mediana del intervalo de fotograma supera 24 ms durante 3 s en equilibrado, baja a ligero.
  - Si en ligero supera 40 ms, se dibujan la mitad de polvo y reflejos.
  - Se sube a equilibrado tras 15 s con la mediana ≤ 18 ms, y no se reconsidera antes de 15 s desde el
    último cambio.
  - Las muestras excluyen la pestaña oculta y las transiciones.
- **Pausa**: con la pestaña oculta, la librería abierta, un modal abierto o `prefers-reduced-motion`.
  El temporizador, el audio y el registro de lectura no se tocan.
- El perfil activo queda en `html[data-motion]` y en `canvas.dataset.profile`, para el CSS y las
  mediciones.

### 12.8 Criterios de aceptación (1.18.0)
- **Habitación**: sin bandas internas a 360×800, 390×844, 412×915 y 915×412; imagen sin deformar; las
  baldas, el sol/luna, el portátil, el té, el libro y los auriculares se alcanzan arrastrando; arrastrar no
  activa objetos; al rotar no aparecen huecos.
- **Pantalla completa**: disponible, rechazada y abandonada, con PWA y navegador comprobados por separado.
- **Librería**: sin «Ver mi librería» ni la habitación detrás, y sin rectángulo violáceo.
- **Estabilidad**:
  - 20 ciclos habitación ↔ librería, y 10 aperturas de calendario, libro y temporizador;
  - cambios rápidos durante las transiciones y vuelta desde segundo plano;
  - movimiento reducido;
  - cinco minutos sin crecimiento de listeners, RAF ni lienzos;
  - sin pérdida de datos ni sesiones duplicadas.
- **Parpadeos**: se comprueban con una secuencia de fotogramas (opacidad y visibilidad de cada plano por
  fotograma), no con una captura final.

## 13. Noche legible, Atrás real, baldas en iPhone y nueva Cámara de Unboxing (1.19.0)

### 13.1 Estado encontrado
| Tema | Hallazgo |
| --- | --- |
| Navegación | No había router ni History API: vista y panel vivían en `useState`, así que el gesto Atrás abandonaba BookShelf. |
| Baldas en iPhone | **Demostrado en el código**: `.shelf-row__scroller` tenía `pointer-events: none` (truco de 1.15 para las insignias), con solo el contenido interior activo. WebKit no desplaza un contenedor excluido del hit-testing; Chromium sí. Además, los scrollers se solapaban con márgenes de −58 px y −30 px, de modo que un dedo en la parte baja de una balda podía mover la siguiente. No hay `touchmove` globales ni `preventDefault` en esa ruta. Los libros llevan `draggable`, que en iOS solo actúa con pulsación larga. |
| Noche | Se activaban a la vez: el tinte SVG `f-night` del exterior; el velo `.tod__night` de 984×1599 (`rgb(24 30 74 / 0.72)` en `multiply`) con una máscara de huecos para las luces; los halos cálidos en `screen`; y `.tod__glow--shelf`, con `filter` animado. Un `multiply` azul oscuro sobre una ilustración cálida da una dominante marrón, y la máscara, si falla, deja un rectángulo opaco (hipótesis; no reproducido en emulación). |
| Unboxing | La caja se consumía y el premio se sorteaba en un `setTimeout` de 900 ms sin identificador de intento; un doble toque o un remontaje podían abrir otra. El estado se guardaba con 250 ms de retraso, así que una recarga inmediata podía perder el resultado. |
| Backend | La sincronización con Supabase sube el estado completo del dispositivo; no hay un servidor autoritativo de recompensas. |

### 13.2 Contrato visual de la noche
1. Ilustración base (`opacity 1`, `filter none`, `mix-blend-mode normal`).
2. Tinte nocturno general (`.tod__night`): `linear-gradient(180deg, rgba(19,31,64,.38) 0%, rgba(24,35,59,.22) 55%, rgba(16,24,42,.30) 100%)`, en mezcla normal y sin máscara. No hay ningún otro velo marrón de pantalla completa.
3. Cielo y mar: tinte `f-night` acotado a la región `EXTERIOR` de `sceneMap.js`, hacia `#152444` con brillos `#AFC9E8`, conservando nubes y horizonte. No hay desplazamiento sobre la foto.
4. Luces: halos radiales en `screen` limitados a su objeto. Lámpara `rgba(255,204,132,.20)` y vela `rgba(255,184,94,.16)`, que respetan el encendido y el apagado.
5. Ambiente (canvas).
6. Objetos interactivos y datos, fuera de cualquier oscurecimiento.

El cambio de hora es una transición de opacidad de 450 ms, sin animar `filter`. La última selección sustituye a la anterior aunque se pulse rápido, y con movimiento reducido el cambio es directo. El modo manual y el automático usan las mismas capas.

### 13.3 Navegación y Atrás
- **Estado de cada ubicación**: serializable, `{ view: 'room' | 'shelf', panel: null | { type, id?, tab?, section? } }`, sin objetos completos ni datos sensibles. Lo gestionan `domain/navigation.js` (lógica pura) y `hooks/useAppNavigation.js`.
- **Historial**:
  - La ubicación inicial se registra con `replaceState`.
  - Cada destino interno abierto por una acción explícita añade una entrada.
  - En `popstate` se restaura sin volver a hacer `pushState`.
  - Hay un único listener, y los re-renders, la sincronización o el reloj no añaden entradas.
- **Orden de vuelta**: libro → librería; calendario → habitación; Ático → librería; Cámara de Unboxing → vitrina; librería → habitación. En la habitación raíz, Atrás tiene el comportamiento normal del navegador; no hay trampa.
- **Botones Volver y Cerrar**: usan la misma navegación.
  - Si la entrada tiene un padre interno, se retrocede con `history.back()`.
  - Si se abrió sin padre (recarga en un panel, URL directa), se reemplaza por el destino seguro. Nunca hay un `back()` a ciegas desde la entrada inicial.
  - Ir al destino que ya es el padre de la entrada actual equivale a Atrás.
- **Recarga**: restaura la vista y el panel guardados en el historial. Un libro o figura que ya no existe cae al destino seguro.
- **Se conservan** el scroll de la librería, el encuadre de la habitación, la devolución del foco y `inert`.

### 13.4 Gestos y scroll
- **Bordes**: el gesto nativo es del navegador. El arrastre de la cámara ignora los toques que empiezan a menos de 24 px de los bordes.
- **Librería**:
  - Usa scroll nativo: un scroller horizontal por balda, con `touch-action: pan-x pan-y pinch-zoom`, `overscroll-behavior-x: auto` y `scroll-padding-inline: 16px`.
  - Sin snap, para poder llegar siempre a los extremos.
  - Los libros son `flex: 0 0 auto` y los scrollers no se solapan entre baldas.
  - Cada balda reserva el libro, las sombras, los post-its y la insignia de 34 px con 12 px por debajo.
  - El contenedor vertical conserva `overflow-y: auto` y `min-height: 0`.
- **Flechas de desplazamiento**: un chevron de latón `#C59B27` (trazo de 1,5 px, 14×22 visibles y 44×44 táctiles) sin círculo, con `drop-shadow(0 1px 2px rgba(44,30,20,.65))`.
  - Opacidad 0,35, que sube a 0,8 al pasar por encima o con foco; el foco lleva un contorno de latón de 2 px a 3 px.
  - Solo aparecen donde hay contenido fuera; con tolerancia de 2 px y fuera del orden de foco cuando no hay desplazamiento.
  - Etiquetas «Ver más a la izquierda» y «Ver más a la derecha».
  - Un único desplazamiento de descubrimiento de 3 px en 900 ms, dos ciclos como máximo, y nada con movimiento reducido.
  - **Habitación** (cover): las flechas van ancladas al viewport, al 52 % de altura y a `env(safe-area-inset-*) + 24px` del borde; cada toque desplaza el 55 % del ancho.
  - **Baldas**: las flechas van en los extremos del listón y avanzan el 70 % del ancho de la balda, actualizadas con el scroll y `ResizeObserver` en un solo RAF. Tocarlas nunca abre un libro.

### 13.5 Secuencia de unboxing
**Estados**: `idle → requesting → charging (450 ms) → unlocking (500 ms) → opening (650 ms) → revealing (700 ms) → result`, más `error`. Unos 2,3 s en total sin contar la solicitud.
- **requesting**: con un intento identificado se confirma la recompensa en el estado (y se guarda al momento) antes de empezar la ceremonia.
- **charging**: la luz converge y la caja escala de 1 a 1,025, con un reflejo decorativo en los sellos que no cambia los conseguidos.
- **unlocking**: el medallón gira a −12° y vuelve, con halo ≤ 0,24 y sonido metálico solo si los efectos están activos.
- **opening**: la tapa independiente de la caja CSS gira de 0° a −105° (`transform-origin: 50% 0`).
- **revealing**: el premio sube de 24 px a 0, de opacidad 0 a 1 y de escala 0,94 a 1. La rareza aparece 120 ms antes que el nombre.
- **result**: premio estable con nombre, saga, rareza y resultado real, «Ver en mi colección» y «Abrir otra» (solo si quedan cajas). No desaparece solo.

**Durante la ceremonia**:
- «Saltar animación» lleva a `result` sin pedir otra recompensa ni consumir otra caja.
- Con movimiento reducido se muestra el resultado con un fundido de 120 ms.
- Con la pestaña oculta salta al resultado.
- Al desmontar se cancelan los temporizadores.

**Escenario**: perspectiva local de 900 px y caja en reposo a `rotateX(-5deg) rotateY(-14deg)`, sobre pedestal con sombra `0 18px 28px rgba(0,0,0,.45)`. Lleva foco cenital y fondo radial cálido dentro del escenario. Se mantiene la paleta del Ático, sin flashes, sacudidas ni confeti.

**Rareza**:
| Rareza | Efecto | Partículas (equilibrado / ligero) |
| --- | --- | --- |
| Rara | halo champán | 8 / 4 |
| Épica | doble arco dorado | 14 / 7 |
| Legendaria | foco más amplio | 20 / 10 |

**Responsive**:
- Modal de `min(960px, calc(100% - 24px))` de ancho y alto útil, con un cuerpo con scroll propio.
- Dos columnas desde 900 px. Por debajo de 600 px de alto, el escenario se compacta a `clamp(220px, 38dvh, 420px)`.
- El premio ocupa como máximo el 82 % × 88 %. Botones de al menos 44 px, sellos de al menos 28 px en fila y tubos de pity siempre visibles.

**Accesibilidad**: el resultado se anuncia una sola vez en `aria-live="polite"`.

### 13.6 Recompensas: persistencia e idempotencia
- **Operación única**: `openBoxAttempt(fs, figuras, azar, idDelIntento)` en `domain/figures.js` consume la caja y concede el premio, con las reglas, probabilidades y pity de siempre. Guarda `fs.unbox = { id, reward, at, seen }` con el rango anterior y el nuevo cuando es una pieza.
- **Mismo intento, mismo resultado**: repetir un identificador devuelve el resultado ya confirmado sin consumir otra caja. Un bloqueo síncrono (`ref`) impide el doble toque.
- **Recuperación**: al volver a la cámara tras cerrar, retroceder o recargar, se muestra el resultado confirmado que aún no se ha visto.
- **Guardado al momento**: el cambio de `fs.unbox` se escribe de inmediato en `localStorage`, y `pagehide` vuelca cualquier escritura pendiente.
- **Limitación**: el sistema es local. La protección vale para este dispositivo y esta pestaña; con dos dispositivos abriendo a la vez, la sincronización conserva la última versión guardada y pregunta si hay conflicto. No hay garantía transaccional entre dispositivos.
- **Duplicados**: el sistema no da figuras repetidas. Si no quedan piezas, el premio es un fragmento de sello (+1 sello), y así se explica en el resultado.

### 13.7 Criterios de aceptación (1.19.0)
- **Noche**: se reconocen la cama, la estantería, el libro, el portátil y el té. Sin fotogramas marrones ni rectángulos. Diez cambios rápidos de hora terminan en el estado correcto, con la lámpara y la vela encendidas y apagadas.
- **Navegación**: habitación → librería → libro → Atrás → librería → Atrás → habitación; habitación → calendario → Atrás; librería → Ático → unboxing → Atrás. El botón interno y el gesto llegan al mismo destino, y desde la raíz no hay bucle.
- **Scroll**:
  - horizontal sobre portadas, huecos e insignias, y vertical entre baldas;
  - flechas correctas al inicio, en medio y al final;
  - ningún clic tras arrastrar.
  - Safari real lo comprueba el usuario.
- **Unboxing**:
  - doble toque, saltar, cerrar o Atrás en mitad de la ceremonia y recarga tras confirmar, sin duplicados ni pérdidas;
  - cero cajas;
  - figura, pieza y fragmento;
  - movimiento reducido;
  - diez aperturas sin acumular listeners, temporizadores ni RAF.
- **Viewports**: 360×800, 390×844, 412×915, 844×390 y 1440×900, sin controles inaccesibles.
- **Pruebas**: historial sin entradas duplicadas, restauración de vista y panel, idempotencia del intento, consumo único de caja, recuperación del resultado y transiciones interrumpidas.
