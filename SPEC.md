# BookShelf — "Mediterranean Cozy Reading Sanctuary"

> SPEC 1.40.0 · 2026-10-26 · Aplicación hermana de GameShelf dedicada a libros y lectura.

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

## 14. Portátil limpio, cuartos de estrella y progreso por páginas o porcentaje (1.20.0)

### 14.1 Estado encontrado

- **Marca del portátil.** `LaptopPanel` pintaba dos pegatinas (`.sticker--flower` ✿ y `.sticker--cat`
  ᓚᘏᗢ, la «marca manuscrita») dentro de `.laptop__base`, subidas 40 px con `top: -40px`. Quedaban sobre la
  esquina inferior derecha de la pantalla, justo donde cae el último icono del dock (la carta, «Sobre del
  día»). Se retiran el JSX y sus estilos exclusivos; `.laptop__base::after` (la muesca de la bisagra) se
  queda porque no sale de la base.
- **Reflejo de la tapa.** `lid-sheen` usaba un `linearGradient` en unidades de caja (`x2=1, y2=0.35`) sobre un
  rectángulo de 120 × 290 px. Con ese vector diagonal, la esquina inferior izquierda del rectángulo cae en el
  31 % del gradiente (opacidad ≈ 0,24) y la superior derecha en el 89 % (≈ 0,08): el borde vertical del
  rectángulo era visible dentro de la tapa como una franja de corte limpio. No había fondo opaco ni IDs
  repetidos (`useSvgIds`), y el recorte (`clip-lid`, `userSpaceOnUse`) ya estaba en un grupo estático.
- **Valoraciones.** Enteras de 1 a 5 con `0` = sin valorar; las estrellas se pintaban con `'★'.repeat()`.
- **Lecturas.** `readingLog` guardaba una sola fila por día y libro (`{date, bookId, pages}`) que se
  acumulaba; el calendario calculaba «va por el X %» con la página de **hoy**, y borrar una lectura
  eliminaba todas las del libro en ese día. No había forma de registrar porcentaje ni libros sin total.
- **Supabase.** La tabla `libraries` guarda el estado completo en `data jsonb`: valoraciones y sesiones son
  números de JSON, no columnas. **No hace falta migración SQL**; `version` (integer) pasa a 6.

### 14.2 Portátil

- Sin decoraciones sobre la pantalla ni sobre el dock. El nombre «☕ BookShelf» de la barra superior se queda.
- Cada botón del dock mide al menos 44 × 44 px (en móvil, icono de 38 px dentro de un área de 44 px), el
  dock tiene `flex-shrink: 0` y deja 10 px hasta el borde inferior de la pantalla. Si no cabe, se reduce el
  hueco entre iconos antes que el área táctil.
- Comprobación: `elementFromPoint()` en el centro y en los cuatro bordes (a 2 px) del botón de la carta
  devuelve el botón o un hijo suyo.

### 14.3 Reflejo de la tapa

- Grupo exterior con `clip-path` estático al polígono `LAPTOP_LID` (`clipPathUnits="userSpaceOnUse"`, en
  píxeles de escena); grupo interior que solo se desplaza; dentro, un paralelogramo sin fondo ni trazo.
- Gradiente horizontal: 0 % y 35 % transparentes, 50 % `#FFF1D2` a opacidad 0,10, 65 % y 100 % transparentes.
  Los dos lados del paralelogramo caen en tramos de opacidad 0, así que no hay borde visible.
- Ciclo de 14 s: la pasada visible dura ≈ 3 s (del 78 % al 100 %); el resto del ciclo la banda espera fuera
  de la tapa (a la izquierda), y al reiniciar salta de fuera-derecha a fuera-izquierda sin verse.
  `mix-blend-mode: normal`, sin filtros animados ni `backdrop-filter`.
- Con movimiento reducido (`prefers-reduced-motion` o `html[data-motion='reduced']`) no se pinta.
- Se mueve con la capa de primer plano y con la cámara porque vive en el mismo SVG que el recorte.

### 14.4 Valoraciones en cuartos de estrella

- Contrato: `rating` es `0` (sin valorar, la convención existente) o un número de 0,25 a 5 en pasos de 0,25.
- `normalizeRating(v)`: no finito, vacío o ≤ 0 → `0`; > 5 → 5; el resto se lleva al cuarto más cercano con
  mínimo 0,25. Nunca `parseInt`, `Math.floor` ni redondeo a enteros. Las enteras no cambian.
- Datos antiguos fuera de contrato (p. ej. 3,3 o 7): se normalizan al cargar y el valor original se conserva
  en `ratingOriginal` para no perderlo en silencio.
- Interfaz (`RatingInput`): cinco estrellas (cada una es un botón que da esa nota entera), valor visible
  «3,75 / 5», control de rango `step="0.25"` con nombre «Valoración» y texto «3,75 de 5 estrellas», botones
  −0,25 / +0,25 de 44 × 44 px y «Quitar valoración». Las estrellas decorativas no se anuncian.
- Representación (`RatingStars`): contorno `#B89C64`, relleno `#C59B27`, papel suave vacío; la estrella `i`
  rellena `clamp(rating − i, 0, 1)` de su ancho con un recorte horizontal (SVG apilados, sin caracteres
  Unicode ni IDs). Se usa en la ficha, el Muro de recuerdos, el Atlas de sagas y la media de Estadísticas
  (con dos decimales como máximo).

### 14.5 Modelo de progreso

- `pageCount`: entero positivo o `null` (total desconocido). Un `0` o un valor no válido de datos antiguos
  pasa a `null`.
- `trackBy`: `'pages'` o `'percent'`. Sin total, siempre `'percent'`. El formato Kindle no lo decide: un
  ebook con páginas puede seguirse por páginas y cualquier libro con total puede pasar a porcentaje.
- Fuente de verdad según la unidad: `currentPage` (páginas) o `currentPercent` (0–100, un decimal). El otro
  campo es derivado y se reescribe siempre a la vez (con total conocido); sin total, `currentPage` es 0 y
  nunca se muestra «página X de Y».
- Cambiar de unidad convierte la posición actual con el total (`page = round(total × % / 100)`, o
  `% = página / total × 100` a un decimal). El historial conserva la unidad de cada registro.
- Sin total: no hay horas restantes por páginas/hora ni páginas ficticias.
- Entrada: páginas enteras ≥ 0 y ≤ total; porcentaje finito de 0 a 100 con un decimal como máximo; se acepta
  coma o punto decimal; vacío, separadores de miles, signos o letras se rechazan con un mensaje junto al campo.

### 14.6 Registro de lecturas (`progress.readingLog`)

Cada registro es independiente:

| Campo | Significado |
| --- | --- |
| `id` | Identificador estable |
| `bookId`, `date` | Libro y día local de lectura (`YYYY-MM-DD`) |
| `createdAt` | Momento en que se apuntó |
| `kind` | `'read'` (lectura) o `'correction'` (corrección de posición) |
| `unit` | `'pages'` o `'percent'` |
| `mode` | `'added'` (he leído N), `'page'` (voy por la página), `'percent'` (voy por el %) |
| `from`, `to` | Posición anterior conocida y posición final (`null` si no se conocen) |
| `pages` | Páginas leídas que cuentan para estadísticas y misiones (0 en porcentaje y correcciones) |
| `delta` | Avance en su unidad (páginas o puntos porcentuales), `null` si no se conoce |
| `total` | Total de páginas usado al registrar (`null` si no había) |
| `active` | Cuenta como día de lectura (racha y sello) |
| `source` | `'form'`, `'quick'` (botones ±), `'timer'` o `'legacy'` |
| `entered` | Valor tecleado cuando se convirtió de unidad (p. ej. `{percent: 47.6}`) |

- **Posición anterior.** Si no hay registros posteriores del libro, es la posición actual del libro (si es
  mayor que 0 o ya hay historial con posición). Si el registro es retrospectivo, es la última posición
  conocida anterior a esa fecha en la misma unidad. Sin posición fiable, `from = null` y no se atribuye
  avance: el primer «42,5 %» de un ebook es solo una posición.
- **Retrospectivo.** Un registro de un día anterior nunca baja la posición actual; solo la sube si es el más
  reciente del libro. Si choca con un registro posterior (posición mayor que la de un día siguiente), la
  vista previa lo avisa; no se reajusta el historial.
- **Retroceso.** Una posición menor que la anterior se ofrece como corrección («Guardar corrección»). Una
  corrección no suma páginas, no cuenta para racha, sellos, cajas ni misiones.
- **Botones rápidos** (±1, ±10 de la ficha, +5 de la cama): se agrupan en un único registro `quick` por
  libro y día mientras sea el último del libro; deshacer hasta la posición de partida lo elimina.
- **Edición y borrado** por `id`. Editar recalcula `pages`/`delta` del registro, no concede sellos y, si es
  el registro más reciente del libro, actualiza la posición actual. Borrar quita solo ese registro.
- **Idempotencia.** Guardar repite el mismo `id` hasta que termina: un doble toque no duplica. Los sellos
  siguen limitados a uno al día (`grantSeal`) y solo los concede un registro nuevo y `active` de hoy.
- **Persistencia.** El guardado es local y síncrono; tras guardar se escribe al momento en `localStorage`
  y, si falla, el formulario conserva sus datos y permite reintentar con el mismo `id`. La nube se
  sincroniza aparte (si no hay red queda pendiente y se reintenta como hasta ahora).

### 14.7 Migración v6 (aditiva)

- Libros: `pageCount` normalizado, `trackBy` (`'pages'` si hay total), `currentPercent` derivado,
  `rating` normalizado (§14.4). IDs, fechas, estado, citas e inventario no cambian.
- Registros antiguos: conservan `date`, `bookId` y `pages`; reciben `id` determinista
  (`legacy-<fecha>-<libro>`), `kind: 'read'`, `unit: 'pages'`, `source: 'legacy'`, `from/to: null`,
  `delta = pages` y `active = pages > 0`. Se muestran como «22 páginas registradas», sin inventar posición.
- No se recalculan sellos, cajas, pity ni misiones reclamadas. La migración es idempotente.

### 14.8 Formulario «Guardar lectura»

- Selector de modalidad (solo una activa): «He leído» (páginas añadidas, solo con seguimiento por páginas),
  «Voy por la página» (muestra el total) y «Voy por el porcentaje». Cada una cambia etiqueta, ayuda y
  validación. Por defecto: porcentaje si el libro se sigue por porcentaje; si no, la última modalidad usada
  con ese libro o «He leído».
- En un libro por páginas, el porcentaje se convierte a página y se muestra antes de guardar
  («= página 200 de 420 · 47,6 %»).
- Vista previa con posición final y avance por separado: «Página 200 de 420 · +15 páginas»,
  «42,5 % leído · +7,5 puntos porcentuales» o solo «42,5 % leído» si no hay posición anterior. Cuando el
  avance no se conoce aparece la casilla «Este día leí (cuenta para la racha)».
- Botón «Guardar lectura» (44 px), deshabilitado mientras guarda. Una columna en pantallas estrechas,
  entradas de 16 px, Lora para el texto, JetBrains Mono para las cifras, tinta `#2C1E14`, papel `#FAF5E8`,
  borde `1px solid rgba(146,112,61,.30)`, radio 10 px.
- El mismo componente (`ReadingEntryForm`) se usa en el calendario, en Sesiones, en la ficha de los libros
  por porcentaje («Actualizar %» de la cama abre esa ficha) y en el temporizador para libros por porcentaje.

### 14.9 Estadísticas, rachas y calendario

- Páginas y porcentajes nunca se suman: «22 páginas · avance registrado en 1 ebook».
- Puntos porcentuales: `+7,5 pp` en espacio reducido y «puntos porcentuales» en el detalle; un avance
  positivo menor de 0,1 se muestra «<0,1 pp», nunca «+0 %».
- Racha, sello del día y misiones usan `active` y `pages`; las misiones de páginas no cuentan porcentajes.
- Mapa de calor: escala por páginas; un día con solo porcentaje usa el estado «lectura por %» (papel con
  trama azul pizarra), con su entrada en la leyenda.
- Ficha y cama de un libro sin páginas: «42,5 % leído», sin «pág. X de Y»; el botón «+5 págs» pasa a
  «Actualizar %».

### 14.10 Portadas del calendario

- Variante `.cal-cover` (no afecta a la estantería): proporción 2/3 dentro de la zona `inset: 20px 4px 22px`,
  `object-fit: contain`, sombra `0 3px 5px rgba(44,30,20,.22), 0 1px 1px rgba(44,30,20,.16)`, lomo de 2 px,
  canto de páginas crema de 1 px y giro determinista de −2° a 2° según el ID del libro.
- Ebooks (`kindle`): marco E-Ink `#514B42`, `padding: 2px`, radio 4 px, con un punto de botón; sin lomo.
- Celdas móviles de `clamp(88px, 23vw, 108px)`, hueco de 3 px. Abajo: «15 págs.» (o «15» con etiqueta
  accesible) o «42,5 %» (la posición de ese día). Máximo dos portadas y `+N`.
- Pestaña de papel crema (opacidad 0,65, `pointer-events: none`) que no cubre fecha ni dato.

### 14.11 Criterios de aceptación (1.20.0)

- [ ] El botón de la carta es visible y pulsable en todo su contorno; no hay pegatinas sobre la pantalla.
- [ ] El reflejo de la tapa no muestra rectángulos, cortes ni parpadeos, con la cámara centrada y desplazada.
- [ ] 0,25 · 0,5 · 0,75 · 3,25 · 3,5 · 3,75 · 5 se guardan, sobreviven a recargar y se pintan igual en ficha,
      recuerdos y atlas; «Quitar valoración» vuelve a «sin valorar».
- [ ] 185 → 200 de 420 = +15 páginas; 35 % → 42,5 % = +7,5 pp; el primer 42,5 % no inventa avance.
- [ ] Una corrección 42,5 % → 40 % no da sellos ni cuenta para la racha.
- [ ] Un registro retrospectivo no baja la posición actual; el historial no cambia al avanzar el libro.
- [ ] Varias sesiones del mismo libro en un día se ven y se borran por separado.
- [ ] Doble toque en Guardar crea un solo registro.
- [ ] Sin desbordamiento horizontal en 360 × 800, 390 × 844, 412 × 915, 844 × 390 y 1440 × 900.

## 15. Fase 1 — Doble habitación panorámica y recalibración de MAIN_ROOM (1.21.0)

### 15.1 Diagnóstico

- **Activos oficiales.** Llegaron como `public/MAIN ROOM.jpeg` (941 × 1672, JPEG, 3 canales) y
  `public/SOCIAL ROOM.jpeg` (900 × 1600), no como `public/images/*.png`. Se publican, con los mismos bytes, en
  `public/images/cozy-book-room.jpg` y `public/images/cozy-social-room.jpg` (con extensión `.png`, Vercel
  serviría un JPEG como `image/png`, el problema ya documentado en 1.17.0). Las dos decodifican bien.
- **La ilustración nueva es otra habitación:** sin gato, sin carillón, sin cortina pintada sobre las baldas; el
  mueble está vacío y tiene cuatro baldas útiles en perspectiva; el portátil mira de frente sobre una mesita
  redonda con el té helado, una vela y fruta; la lámpara de latón cuelga del hueco izquierdo del mueble.
- **Capas heredadas.** `SceneLayers` (mar, nubes, plantas, cortina, gato, carillón), `FrontLayer` (cama
  recortada, gato, reflejo de la tapa), `RoomAtmosphereCanvas` (bahía, pueblo, velero), `RoomOcclusion`
  (hiedra) y los haces de `TimeOfDayLayers` recortaban o dibujaban sobre coordenadas de la ilustración
  anterior: sobre la nueva habrían pintado trozos de otra habitación. Se retiran en esta fase (§15.7).
- **Cámara anterior.** `scene/camera.js` hacía cover en móvil y contain en escritorio, con arrastre del
  encuadre, parallax de tres capas, respiración y zoom con `rotateY` al abrir la librería. Se sustituye por un
  escenario cover con una sola transformación; el arrastre horizontal pasa a ser el gesto entre habitaciones.

### 15.2 Estados

| Estado | Dónde | Notas |
| --- | --- | --- |
| `activeRoom`: `MAIN_ROOM` \| `SOCIAL_ROOM` | `PanoramicRoom` (estado de interfaz) | Inicial `MAIN_ROOM`; no se persiste ni migra |
| Vista de librería (`room` / `enteringShelf` / `shelf` / `leavingShelf`) | `useShelfTransition` | Sin cambios; ahora siempre con el fundido corto |
| Panel abierto | historial (`useAppNavigation`) | Sin cambios |

- Cambiar de habitación no recrea `LibraryProvider` ni `CloudProvider`, no reinicia el temporizador
  (`useReadingTimer` vive en `Sanctuary`) ni el audio, no escribe en la biblioteca y no concede nada.
- El panorama no cambia de habitación con un panel abierto ni con la librería delante (`locked`); la
  navegación lateral se oculta.
- Cerrar un panel devuelve el foco al control que lo abrió: se guarda al abrir (al volverse inerte la
  habitación, el navegador le quita el foco) y se restaura cuando ya no hay `inert`.

### 15.3 Estructura

```
PanoramicRoom (.panorama-viewport: fixed, 100dvh, overflow clip)
  .panorama-track (200 %, translateX(0 | -50 %))
    .panorama-panel[MAIN_ROOM]   → CozyRoom   → SceneStage → .scene-world (941 × 1672, una transformación)
    .panorama-panel[SOCIAL_ROOM] → SocialRoom → SceneStage → .scene-world (900 × 1600)
  .panorama-nav (fuera del track)
  RoomCorner (fuera del track)
Librería y modales: fuera del panorama (#modal-root)
```

- `translateX(-50%)` sobre el track del 200 % desplaza exactamente una pantalla.
- `overflow: clip` en viewport y paneles: ni el foco ni un arrastre con selección pueden desplazarlos.
- Sin padding de área segura en la escena; solo en controles. `viewport-fit=cover` se mantiene sin bloquear el
  zoom del usuario.

### 15.4 Una transformación (`scene/stageFit.js`)

- `scale = max(panelW / imgW, panelH / imgH)`; `offset = (panel − img × scale) × encuadre`, con el encuadre por
  relación de aspecto en `ROOMS[room].framing` (única fuente). `toScreen`, `toImage`, `stageTransform` y
  `visibleFraction` son puras.
- `SceneStage` mide su panel con `ResizeObserver` (no con `innerHeight` leído una vez; durante un pinch-zoom no
  reencuadra) y aplica `translate(x, y) scale(s)` al lienzo, que contiene imagen, overlays y hotspots.
- Encuadres de MAIN_ROOM: vertical (≤ 0,62) recorte lateral 62 % / 38 %; hasta 1:1, y = 0,62; hasta 1,8, la
  franja de la mesita (y = 0,79); más ancho, y = 0,75 (que la esquina de controles no tape el portátil).
- **Compromiso del cover.** Cubrir sin bandas recorta. Medido en QA: en 1440 × 900 quedan fuera la vitrina y
  la lámpara; en 844 × 390, la vitrina, la librería, la lámpara y casi todo el libro; en 360–412 de ancho
  vertical, la lámpara. Esos objetos siguen accesibles en un único control discreto, «Fuera de vista (n)», que
  solo aparece cuando hay algo fuera (≥ 75 % del objeto recortado). No se simula que se vean.

### 15.5 Capas y estabilidad

- Dentro de la escena: ilustración 0, atmósfera 10, objetos 20, hotspots 30, etiquetas 40. Fuera del track:
  navegación 15, esquina 16, librería 20, modales 1000.
- Fondo: `<img>` real, `display: block`, `draggable=false`, sin eventos, filtros, mezclas ni perspectiva.
- Track: solo traslación 2D, sin perspectiva, desenfoque ni `preserve-3d`.
- MAIN_ROOM carga con prioridad; SOCIAL_ROOM se decodifica en segundo plano y el control «Salón Social» está
  deshabilitado mientras carga. Si falla: aviso con «Reintentar» en el salón y el regreso sigue disponible.
- El panel inactivo lleva `inert` y `aria-hidden`; si el foco estaba dentro, pasa al control de regreso.

### 15.6 Gesto y accesibilidad

- Un controlador en el viewport: puntero primario, un contacto; swipe si |dx| ≥ 50 px y |dx| > |dy| × 1,3;
  izquierda desde MAIN, derecha desde SOCIAL, sin bucle. Un segundo contacto, `pointercancel` o la pérdida de
  captura lo anulan. Mientras el track se anima no se aceptan más cambios (el bloqueo solo existe si la
  transición dura ≥ 50 ms, así que con movimiento reducido no hay espera).
- Excluidos: campos, deslizadores, `[data-no-room-swipe]`, paneles, diálogos y los propios controles.
- Si el gesto se reconoce, se suprime solo el clic derivado (no abre el libro ni el portátil).
- `touch-action: pan-y pinch-zoom` en el viewport; sin `preventDefault` sobre `document`.
- Controles «Salón Social →» y «← Mi Habitación»: 44 × 44 px mínimos, Lora, tinta `#2C1E14`, papel `#E8D8B9`,
  latón `#B08D57`, foco visible y área segura; en el centro del borde en vertical y al pie en horizontal (en el
  centro taparían la mesita). Flechas ← → solo con el foco en el panorama y nunca en un campo.
- Movimiento reducido: el cambio es instantáneo.

### 15.7 MAIN_ROOM recalibrada (`scene/sceneMap.js`)

Medidas sobre una rejilla de la propia ilustración (941 × 1672):

| Objeto | Medida |
| --- | --- |
| Libro abierto | contorno de 13 vértices (225–875 × 1338–1662); marcapáginas en la página derecha `[[585,1402],[800,1432],[818,1560],[565,1532]]` |
| Portátil | hotspot de 8 vértices; pantalla frontal `[[757,990],[906,1013],[893,1134],[722,1116]]` (el post-it de la racha va en ella) |
| Auriculares | 11 vértices (22–248 × 1280–1428) |
| Té helado | vaso 818–895 × 1090–1222; líquido 824–889 × 1112–1208 (sin vapor caliente por defecto) |
| Vela | 762–834 × 1158–1242; llama en (798, 1166) |
| Lámpara de latón | 0–128 × 470–597; bombilla y ancla de la luz en (75, 578) |
| Vitrina (2 baldas altas del hueco derecho) | `top` y `middle`: cuadriláteros de 205 px en perspectiva |
| Libros (2 baldas bajas) | `cabinet` y `cabinet2` |
| Librería general | resto del mueble, por debajo de libros, vitrina y lámpara |
| Astro (Atlas de Sagas) | sobre el cielo de la puerta-ventana: mañana (800, 345), atardecer (836, 470), noche (790, 352) |
| Exterior nocturno | polígono de la puerta-ventana (655–941 × 218–965) |

- IDs semánticos conservados (`book`, `laptop`, `tray`, `headphones`, `figures`, `shelf`, `lamp`; la vela
  conserva el id histórico `lantern`).
- El carillón no existe en la ilustración: su hotspot se elimina y el cambio de hora pasa a un control de
  ambiente de la esquina (sol, atardecer o luna).
- Figuras de la vitrina: desprecintadas cuando hay recurso con transparencia; si no, la caja recortada por su
  contorno (no un rectángulo).
- Sin parallax ni respiración: imagen, objetos y zonas táctiles se mueven juntos. La librería entra con el
  fundido corto, sin el zoom/`rotateY` anterior.
- Retiradas en esta fase: haces y sombras de hojas, mar con destellos, nubes, velero, plantas mecidas,
  hiedra delante de las baldas, cortina, gato y carillón. Se rehacen sobre la ilustración nueva en fases
  posteriores; la noche queda como tinte general + exterior más oscuro + halos de lámpara y vela.

### 15.8 Rendimiento y caché

- Con la habitación fuera de pantalla, tras un modal, con la pestaña oculta o con movimiento reducido se
  pausan las animaciones SVG y los intervalos decorativos (pistas, libro que asoma); el temporizador sigue.
- Sin canvas en esta fase (el lienzo de partículas usaba la geometría anterior).
- Service worker `bookshelf-v1.21.0`: precarga las dos ilustraciones nuevas y las trata como imágenes
  estables; `/cozy-book-room.jpg` sigue publicado para una sesión abierta con la versión anterior, pero ya no
  se precarga. Mismo mecanismo de versiones; sin tocar localStorage ni IndexedDB.

### 15.9 Diagnóstico (`?sceneDebug=1`, solo `npm run dev`)

Rejilla de coordenadas, polígonos y anclas de hotspots, baldas, dimensiones, escala, desplazamientos,
rectángulo visible y coordenada de imagen bajo el puntero. No escribe datos y no entra en el build.

### 15.10 QA (`npm run qa:full`)

`vitest run` + Playwright con servidor propio. Matriz: Chromium 360 × 800, 390 × 844, 412 × 915, 844 × 390 y
1440 × 900; WebKit 390 × 844 y 844 × 390; Chromium 390 × 844 con movimiento reducido. Pruebas: habitación
inicial decodificada, swipe ida y vuelta, controles y teclado, 49 px, gesto vertical, `pointercancel`, swipe
sobre un objeto, panel que bloquea y devuelve el foco, Tab sin escapar a la escena inactiva, librería, acciones
de los objetos, temporizador, redimensionado, idas y vueltas sin duplicados, iluminación y capturas de
diagnóstico. Geometría: viewport, track (dos paneles), desplazamiento de un panel (±1 px), imagen que cubre
sin deformar, anclas (±2 px), overflow del documento y prueba de impacto en puntos interiores reales de cada
polígono. Telemetría y capturas en `qa-report/` (no se versiona). WebKit automatizado no equivale a Safari en
un iPhone real; la geometría comprueba consistencia, no que las coordenadas coincidan con lo pintado (eso se
revisa en las capturas de diagnóstico).

### 15.11 Criterios de aceptación (Fase 1)

- [x] Las dos ilustraciones oficiales se muestran (con los nombres y el formato descritos en §15.1).
- [x] La escena ocupa 100dvh sin bandas; el panel visible cubre sus cuatro bordes.
- [x] MAIN_ROOM ↔ SOCIAL_ROOM con swipe, controles accesibles y teclado; movimiento reducido instantáneo.
- [x] MAIN_ROOM usa coordenadas medidas en la ilustración nueva; los objetos conservan sus acciones.
- [x] Ningún recorte de la ilustración anterior se pinta sobre la nueva.
- [x] Los objetos que el encuadre recorta siguen accesibles en «Fuera de vista».
- [ ] Safari en un iPhone real (no probado aquí).
- [ ] Atmósfera rehecha sobre la ilustración nueva (mar, plantas, haces, noche completa): fases posteriores.

## 16. Anexos A y B — Veleros de la bahía y guía diegética (1.22.0, Fase 1)

Estados: **PENDIENTE** (descrito, sin código), **IMPLEMENTADO** (código en el repositorio), **VERIFICADO**
(implementado y comprobado por pruebas ejecutadas en esta entrega, §16.6). El proyecto sigue en JSX:
`BaySailboats.jsx` y `OnboardingGuide.jsx` (sin migrar a TypeScript).

### 16.1 Anexo A — Veleros ambientales

| Req. | Estado | Implementación |
| --- | --- | --- |
| A1 · componente reutilizable (habitación, geometría, activo, movimiento reducido, cita, callback) | VERIFICADO | `components/room/BaySailboats.jsx`; props `roomId`, `sea`, `active`, `reducedMotion`, `quote`, `onOpenQuote`, `count` |
| A1 · 2 veleros por habitación (máx. 3) | VERIFICADO | `count = 2`, acotado a 1–3 |
| A1 · dirección artística | IMPLEMENTADO | Velas `#F4EBDD`, sombra `#CDBD9D`, casco `#8B6B49`, estela `#FFF8E8` a 0,22; SVG propio sin contorno negro |
| A1 · tamaño 12–22 CSS px a 390 px | IMPLEMENTADO (ajustado) | Tras inspección, 14 y 18 px de imagen (≈ 7–9 CSS px a 390): con 24–44 px de imagen duplicaban a los veleros pintados y rompían la perspectiva. Ajustable en `sea.lanes[].size` |
| A2 · polígono de agua, exclusiones, carriles, tamaño, ancla interactiva | VERIFICADO | `ROOMS[*].sea` en `scene/sceneMap.js`, medidos en cada ilustración (MAIN: dos bahías a ambos lados del pueblo; SOCIAL: bahía del ventanal) |
| A2 · recorte real (no solo `overflow`) | VERIFICADO | `clip-path: path()` con las regiones de agua en px del lienzo; pueblo, montes, cipreses, hiedra y carpintería quedan fuera |
| A2 · sin coordenadas de la habitación antigua ni % del viewport | VERIFICADO | Mismo lienzo y transformación que la imagen (`SceneStage`) |
| A2 · sobre el agua, sin saltos al redimensionar | VERIFICADO | `boatInWater` en 21 puntos de cada carril (unitarias) y casco/vela sobre el agua en el navegador |
| A2 · no tapar veleros pintados | VERIFICADO | Carriles a ≥ 14 px de los pintados (MAIN (775, 792), (805, 820); SOCIAL (94, 688), (162, 754)); la prueba detectó y corrigió un carril a 12,8 px |
| A2 · pasar por detrás de los marcos | IMPLEMENTADO | Los carriles no cruzan carpintería (las regiones de agua están dentro del cristal); la máscara lo garantizaría si un carril la cruzase |
| A3 · desplazamiento y cabeceo en nodos distintos | VERIFICADO | `.sailboat` (`sailAcross 110s linear infinite alternate`) y `.sailboat__body` (`rotateZ ±1,5°`, 7 s, `ease-in-out`, alterna) |
| A3 · desfases deterministas | VERIFICADO | `boatPhase(room, índice)` (hash); `animation-delay` negativo |
| A3 · estela sin partículas, canvas ni blur | IMPLEMENTADO | Un trazo SVG bajo el casco |
| A3 · pausa fuera de pantalla, pestaña oculta y modal | VERIFICADO | `data-running` solo con la habitación activa, sin panel ni librería y `visibilityState = visible` |
| A3 · movimiento reducido: barcos quietos | VERIFICADO | `animation: none` y posición estática determinista |
| A4 · contrato de cita navegante | IMPLEMENTADO | Props `quote`/`onOpenQuote` y `sea.interactive`; sin cita no hay pulso, botón ni foco (`aria-hidden`) |
| A4 · velero interactivo, resplandor `#D6AA57`, pulso 4,8 s, botón 44 × 44, nota de papel, «✨ Guardar cita», «⛵ Lanzar una cita mía al mar», guardado idempotente, formulario de publicación y moderación | PENDIENTE (Fase 2) | Requiere la fase social (contenido autorizado, atribución, visibilidad) |

### 16.2 Anexo B — Guía diegética

| Req. | Estado | Implementación |
| --- | --- | --- |
| B1 · máquina explícita `idle → welcome → reading → habits → social → gift → completed` + «Saltar guía» | VERIFICADO | `domain/onboarding.js` (`next`, `back`, `route(fase)`), `hooks/useOnboarding.js` |
| B1 · activación con `!localStorage.getItem('bookshelf_onboarding_done')`, con excepciones y respaldo en memoria | VERIFICADO | `createDoneStore`; con `Storage` bloqueado la app abre y la guía funciona en la sesión |
| B1 · arranque solo con MAIN_ROOM decodificada y medida, quieta y sin modal prioritario | VERIFICADO | `ready` (ilustración `ok`), `blocked` (panel, librería o habitación distinta de MAIN quieta) |
| B1 · sin duplicados en StrictMode | VERIFICADO | Guarda `started` en una referencia; una sola tarjeta en todas las pruebas |
| B1 · completar y saltar marcan la clave | VERIFICADO | `markDone()` en ambos casos |
| B1 · clave local, no sincronizada | IMPLEMENTADO | Documentado aquí; no viaja a Supabase |
| B1 · repetir desde «Guías» | VERIFICADO | El botón existente inicia la guía; si las insignias de guía estaban visibles, primero las oculta |
| B2 · carta de bienvenida (texto, acciones, papel `#F6EAD2`, tinta, lacre `#8F352D`, Cormorant/Lora/Caveat, sin overlay oscuro) | VERIFICADO | Anclada al libro abierto; dentro del viewport seguro |
| B3 · una luciérnaga (núcleo 6 px `#FFF2C6`, halo 24 px `#E2B85E`, sin eventos, 700 ms `cubic-bezier(0.22, 1, 0.36, 1)`) | IMPLEMENTADO | `.firefly`; con el ancla fuera de pantalla espera en el borde más cercano |
| B3 · una tarjeta por parada; resaltado secundario discreto | VERIFICADO | Parada 1: libro + baldas (librería y vitrina); parada 2: portátil + té |
| B3 · parada 3 (Salón Social) | PENDIENTE (Fase 2) | Registrada en `STOPS.social`, fuera de la ruta de la Fase 1 |
| B3 · parada 4 (regalo) | PENDIENTE (Fase 3) | Registrada en `STOPS.gift`, fuera de la ruta |
| B4 · Fase 1: estructura, bienvenida, paradas 1 y 2, final tras ellas, sin mencionar lo social | VERIFICADO | «Terminar» en la parada 2 |
| B4 · fases 2 y 3 sin reiniciar la guía a quien la terminó | IMPLEMENTADO | `route(fase)` añade paradas; la clave de finalización no cambia |
| B5 · regalo único `welcome_onboarding_v1` (atómico, idempotente, elegibilidad verificada, servidor si es autoritativo) | PENDIENTE (Fase 3) | No se concede nada en esta fase; saltar la guía no concede ni impide nada |
| B6 · ancho `min(320px, calc(100vw - 32px))`, botones ≥ 44 px, áreas seguras, sin salir del viewport | VERIFICADO | `placeCard` (unitarias) y comprobación en los 8 navegadores |
| B6 · teclado, Escape, foco | VERIFICADO | Foco en la acción principal de cada parada; Escape salta; el foco vuelve a «Guías» si se abrió desde ahí |
| B6 · anuncio de título y explicación, no de la luciérnaga | IMPLEMENTADO | `role="dialog"` no modal con `aria-labelledby`/`aria-describedby`; luciérnaga `aria-hidden` |
| B6 · movimiento reducido | VERIFICADO | Cambio directo de ancla, sin vuelo ni pulso |
| B6 · transiciones del panorama | IMPLEMENTADO | La guía bloquea el panorama; si se pide desde el salón, vuelve a MAIN con la API del panorama y la tarjeta espera a que la habitación esté quieta (`onSettled`) |
| B6 · sin temporizadores que avancen solos | VERIFICADO | Solo «Continuar», «Atrás», «Terminar» y «Saltar guía» |

### 16.3 Convivencia con lo existente

- Las pruebas de la habitación (§15.10) marcan la guía como vista para no mezclarse con ella.
- «Guías» conserva el resaltado de objetos: con las insignias activas, el botón las apaga.
- Mientras la guía está abierta no se muestra «Fuera de vista» (sus objetos tienen su propia parada).

### 16.4 Reservado para fases siguientes

- Fase 2: cita navegante (A4), parada del Salón Social (B3) y su demostración gestual («Desliza hacia el Salón
  Social», contenido hacia la izquierda).
- Fase 3: parada del regalo y concesión única `welcome_onboarding_v1` (B5), con verificación de
  elegibilidad («sin figuras» solo con el inventario cargado; nunca «desconocido» = «sin figuras») y registro
  atómico; alcance local documentado en modo invitado y sin duplicar al vincular una cuenta.

### 16.5 Pruebas añadidas

- Unitarias: `sea.test.js` (carriles sobre el agua, distancia a los veleros pintados, desfases),
  `onboarding.test.js` (máquina por fases, almacenamiento bloqueado, colocación en el viewport seguro).
- E2E (`e2e/anexos.spec.js`): veleros sobre el agua y recortados, en pausa fuera de pantalla, swipe sobre un
  barco, movimiento reducido; guía en primera visita, visita posterior, saltar, repetir desde «Guías»,
  `localStorage` bloqueado, panel prioritario, redimensionado y giro, teclado.

### 16.6 Evidencias (2026-10-24)

- `npm run build`: compila sin errores. `npm run lint`: 30 avisos, ninguno nuevo.
- `npm run qa:full`: Vitest **77/77**; Playwright **165 superadas, 3 omitidas** (capturas de diagnóstico, solo
  en tres encuadres), 0 fallidas, en los 8 proyectos (Chromium 360 × 800, 390 × 844, 412 × 915, 844 × 390,
  1440 × 900; WebKit 390 × 844 y 844 × 390; Chromium 390 × 844 con movimiento reducido).
- Veleros: 32/32 medidos con casco y vela sobre el agua (2 por habitación × 8 proyectos); ancho real de
  7–10 CSS px en móviles verticales y 13–17 en horizontal; el swipe que empieza encima de un barco cambia de
  habitación (en horizontal la bahía queda fuera del encuadre y el gesto se prueba desde el centro).
- Guía: primera visita, visita posterior sin guía, saltar, repetir desde «Guías» (el foco vuelve al botón),
  `localStorage` bloqueado sin errores de página, panel prioritario que la retrasa, giro y teclado: en verde en
  los 8 proyectos.
- Iteraciones de esta entrega: la primera pasada falló en 14 casos; causas corregidas: la prueba antigua de
  «Guías» (que ahora abre la guía), el gesto desde un barco fuera de encuadre, el foco de vuelta en WebKit (no
  enfoca botones al pulsar: ahora se pasa el control que abre la guía), la tarjeta demasiado alta en WebKit
  apaisado (diseño compacto en ventanas bajas) y la telemetría que dos procesos sobrescribían.
- **Limitación del entorno:** el WebKit de Playwright en Windows no aplica la división proyectiva de
  `matrix3d` ni de `perspective()` (comprobado con una página mínima sin código de la app:
  `perspective(300px) rotateY(40deg)` mide 107 px de ancho frente a 153 en Chromium). Por eso en sus capturas
  las baldas, el marcapáginas y el post-it proyectados se ven deformados. No se considera un fallo de la app
  ni una verificación en Safari: hay que comprobarlo en un iPhone real.

## 17. Selector de lecturas, guardado estable en iPhone, colores con significado, sonidos y pulsación (1.23.0)

### 17.1 Estado encontrado

- **Selector del calendario.** Mostraba todos los libros no terminados (pendientes incluidos) más el actual.
- **Salto de scroll en iPhone.** En móvil, el formulario del día vivía en tres zonas de scroll vertical
  anidadas: el velo del modal (`.panel-veil`, `overflow-y: auto`), la ventana del portátil (`.window__body`) y
  el propio panel del día (`.cal__daypanel .cal-pop`, `max-height: 60dvh; overflow-y: auto;
  overscroll-behavior-y: contain`). Con el teclado abierto, iOS desplaza los contenedores para mostrar el campo
  enfocado; el gesto hacia «Guardar» empezaba dentro del scroll interior, que al llegar a su final no
  encadenaba (contain) y al cerrar el teclado iOS restauraba los desplazamientos que había hecho: el salto hacia
  arriba. «Guardar» quedaba al fondo de un scroll interior cuya altura dependía de `dvh`. Revisadas y
  descartadas: no hay `key` dependiente del valor, el foco inicial del modal se ejecuta una vez por apertura, la
  trampa de foco solo actúa con Tab, el efecto que acerca el día depende solo del día abierto, el borrador es
  estado local (el reloj del temporizador re-renderiza sin tocarlo), la habitación queda `inert` detrás y no hay
  listeners de `touchmove` ni `touch-action: none` en la cadena.
  **Verificado en emulación (Chromium y WebKit de Playwright), no en un iPhone real.**
- **Colores de anotación.** Las citas ya guardan un ID estable (`pink`, `yellow`, `blue`, `gold`); los
  significados eran fijos en código (`QUOTE_COLORS`). No había filtro por color.
- **Sonido.** Casi todas las interacciones usaban `pageRustle` (el mismo roce de papel), sin control de volumen
  de efectos ni límite de repeticiones.

### 17.2 Selector del calendario

- Opciones iniciales: solo libros en `reading` (primero el actual si está leyéndose; después el resto en el orden
  en que estaban al abrir el formulario, que no cambia mientras está abierto; las lecturas nuevas se añaden al
  final) y «Otros…». Con títulos repetidos se añade el autor.
- Sin lecturas activas: «Selecciona un libro» + «Otros…»; nada se elige solo y «Guardar lectura» espera.
- «Otros…» es una acción de interfaz (`__other__`), nunca un `bookId`: abre un buscador dentro del mismo
  formulario («Buscar en mi biblioteca»), solo sobre la biblioteca del usuario, por título y autor, sin
  mayúsculas, acentos ni espacios repetidos; consulta vacía → indicación; hasta 8 resultados y «Mostrar más»;
  sin resultados → «No hay libros que coincidan en tu biblioteca». Cada resultado: portada, título, autor y
  estado. El número de resultados se anuncia en una región `aria-live` discreta.
- Al elegir un resultado se guarda su ID real, se cierra la lista y el formulario muestra el libro con
  «Cambiar libro». Elegirlo no cambia su estado (las reglas de progreso de §14 deciden lo que pase al guardar).
- La selección no cambia por sincronizaciones ni por actualizaciones de progreso; si el libro desaparece, el
  formulario lo dice y pide elegir otro.

### 17.3 Guardado estable (iPhone)

- Una sola zona de scroll en el portátil (`.window__body`); el panel del día ya no tiene scroll propio ni
  `max-height` en `dvh`; el velo del portátil no se desplaza.
- La fila de acciones del formulario es `position: sticky; bottom: 0` dentro de esa zona: papel `#FAF5E8`,
  borde superior `1px solid rgba(146,112,61,.20)`, `padding: 12px`, botón de 44 px; el formulario reserva su
  espacio para que no tape el último campo (`scroll-padding-bottom` en la zona de scroll, que también respeta el
  desplazamiento de iOS al enfocar un campo). Sin botones `fixed` ligados al viewport. En ventanas bajas
  (≤ 480 px de alto, móvil apaisado) la zona de scroll mide ~150 px y la fila pegada taparía la mitad del
  formulario: ahí vuelve al flujo normal y se alcanza desplazándose.
- Cada modalidad conserva su propio valor (ir de página a porcentaje y volver no borra lo escrito) y la vista
  previa reserva su hueco: cambiar de modalidad ya no encoge el formulario (antes perdía 74 px y, al final del
  scroll, el navegador recortaba la posición: otro salto hacia arriba).
- El formulario es una instancia estable por día editado (nunca por el valor); el borrador (libro, modalidad,
  valor, búsqueda) sobrevive al cambio entre búsqueda y formulario, a los re-renders del temporizador y a las
  actualizaciones externas. Sin `autoFocus` al cambiar de modalidad; sin `scrollTo` ni temporizadores de scroll.
- Entradas de 16 px en móvil, `inputMode="numeric"` (páginas) o `"decimal"` (porcentaje), coma o punto.
- Al guardar: valida, guarda, confirma la escritura y solo entonces muestra «✓ Guardado» (≈ 1200 ms, sin cambiar
  el ancho del botón, `aria-live="polite"`) y suena el sello. Si falla, conserva libro, modalidad y valor.

### 17.4 Significados de los colores

- Contrato: `settings.quoteMeanings = { [colorId]: { label, description } }` (solo los cambiados). IDs fijos de
  `QUOTE_COLORS`; el color visual nunca cambia. Resolución: significado del usuario → texto original. Un color
  desconocido (dato antiguo) se muestra como «Color sin significado» con un tono neutro, sin tocar la cita.
- Editor («Personalizar colores» junto a la leyenda): muestra de 24 × 24 px, significado actual, campo, descripción
  opcional, «Restaurar valores originales», Guardar y Cancelar. Texto: «Estos significados se aplican a tus
  anotaciones de todos los libros». Validación: etiqueta obligatoria (recortada), ≤ 32 caracteres; descripción
  ≤ 120; sin etiquetas duplicadas (normalizadas); mensajes junto al campo; texto plano (React lo escapa).
- Cambiar un significado actualiza leyenda, etiquetas y filtro; el texto de las citas no cambia. El filtro del
  diario conserva su selección por ID. Restaurar cambia solo los significados; Cancelar descarta el borrador.
- Persistencia: se guarda el objeto completo de significados con `setSettings({ quoteMeanings })` (fusión de
  primer nivel: no toca sonido, lectura ni otros ajustes) y viaja con la sincronización como el resto de ajustes
  compartidos. Si no se puede escribir en el dispositivo, el editor conserva el borrador y lo dice.

### 17.5 Sonidos de interfaz

- `playUiSound(evento)` (`src/audio/uiSounds.js`) es la única entrada; reutiliza el `AudioContext` del ambiente
  con un bus propio de efectos y volumen independiente (`settings.uiVolume`, 25 % por defecto, preferencia del
  dispositivo). Sonidos **procedurales** (sintetizados con Web Audio, sin grabaciones ni archivos externos),
  agrupados por familias de material con rampas de entrada y salida:

| Evento | Material | Duración |
| --- | --- | --- |
| `libraryOpen` | Roce de madera y libro | ≈ 180 ms |
| `bookOpen` | Cubierta y papel | ≈ 200 ms |
| `diaryTab` | Hoja de algodón | ≈ 95 ms |
| `monthTurn` | Paso de página breve | ≈ 90 ms |
| `select` | Toque suave de madera | ≈ 60 ms |
| `pencil` | Contacto de lápiz | ≈ 55 ms |
| `save` | Sello sobre papel | ≈ 130 ms |
| `close` | Papel amortiguado | ≈ 95 ms |
| `timer` | Cerámica suave | ≈ 120 ms |
| `sessionEnd` | Campanilla cálida existente | ≈ 600 ms |
| `atticOpen` | Pestillo de latón | ≈ 160 ms |
| `figureSelect` | Contacto sobre madera | ≈ 70 ms |

- El unboxing conserva su secuencia (no se superponen genéricos). Sin sonido al escribir, hacer scroll, hover,
  foco, re-render, hidratar, sincronizar o validar. Las estrellas suenan al confirmar (botón de estrella o ±),
  no al arrastrar el control de rango.
- Concurrencia: máximo 3 sonidos breves a la vez y 80 ms entre repeticiones del mismo evento; una acción, un
  evento. «Sonidos táctiles» desactivado silencia todos los efectos; la prueba de volumen solo suena al pulsar
  «Probar». Un fallo de audio nunca bloquea la acción.

### 17.6 Pulsación y confirmación

- Botones de madera y latón: `translate: 0 1px; scale: .985` (propiedades individuales: no pisan `transform` ni
  las perspectivas 3D), 70 ms al pulsar y 120 ms `ease-out` al soltar, sombra reducida durante la presión.
  Papel y pestañas: capa sepia ≤ 0,04 y 1 px. Solo con `:active` (se limpia solo tras scroll o cancelación).
- Selección visible: color con contorno y marca ✓; libro elegido con borde cálido y `aria-pressed`/texto.
- Movimiento reducido: sin desplazamiento ni escala; quedan color, contorno y texto.

### 17.7 Criterios de aceptación (1.23.0)

- [x] El selector muestra solo lecturas activas y «Otros…»; con cero lecturas no elige nada.
- [x] «Otros…» busca en la biblioteca, nunca se guarda como libro y elegir un pendiente o terminado no cambia su estado.
- [x] El formulario conserva el borrador con el temporizador corriendo y «Guardar» queda accesible en una sola zona de scroll (sticky salvo en ventanas bajas).
- [x] Renombrar un color actualiza leyenda y filtro, sobrevive a recargar y no toca el texto de las citas.
- [x] Cada evento tiene su sonido; el guardado suena una sola vez y solo tras el éxito; con efectos desactivados no suena nada.
- [x] Sin cambios de layout al pulsar; sin `transform` en la presión; sin desbordes en los cinco tamaños de pantalla.
- [ ] Safari en un iPhone real: pendiente (todo lo anterior es emulación).

### 17.8 Evidencias (2026-10-24)

- `npm run build` sin errores; `npm run lint` 30 avisos, ninguno nuevo.
- `npm run qa:full`: Vitest **91/91** (14 nuevas en `v123.test.js`: lecturas activas, orden estable, títulos
  repetidos, búsqueda con acentos, `«Otros…»` nunca como id, significados por ID, hexadecimal antiguo,
  validación, restaurar, puerta de sonidos) y Playwright **221 superadas, 3 omitidas** (capturas de
  diagnóstico) en los 8 proyectos. `e2e/v123.spec.js`: selector y «Otros…», cero lecturas, borrador con el
  temporizador en marcha, zonas de scroll, valor por modalidad, sonido de guardado único tras el éxito,
  silencio con efectos desactivados, sonidos distintos por acción, colores (renombrar, filtrar, duplicados,
  recargar, restaurar, sin tocar citas ni ajustes) y pulsación sin cambio de layout.
- Iteraciones: la matriz completa sacó a la luz dos fallos reales más, ya corregidos: la fila pegada tapaba
  los botones en móvil apaisado (zona de scroll de ~150 px) y cambiar de modalidad encogía el formulario 74 px
  (recorte del scroll al final). Y uno de especificidad: el `:active` antiguo de los sellos (`panels.css`)
  movía con `transform` y anulaba el movimiento reducido.
- Limitaciones del entorno: el WebKit de Playwright en Windows con emulación táctil no activa `:active` con el
  ratón (no se pudo medir la presión ahí) y no crea `AudioContext` sin cabeza (se mide la emisión del evento,
  no el audio). Ninguna prueba sustituye a Safari en un iPhone: el teclado virtual de iOS no se puede emular.

## 18. Fase IA-1 — Motor local y preparación para OpenRouter (1.24.0)

Estados: **PENDIENTE** (solo descrito), **IMPLEMENTADO** (código en el repositorio), **VERIFICADO** (con pruebas
ejecutadas en esta entrega, §18.10). En esta fase **no hay ninguna llamada a proveedores de IA**, ni claves, ni
endpoints que simulen respuestas.

### 18.1 Punto de partida

- Los lomos tomaban su color de una paleta interna (`spineColor`) y su tamaño de la edición (`spineWidth`,
  `spineHeight`); las ediciones (`editionType`) son elección del usuario. No había material ni pan de oro como
  dato, ni color de portada.
- El ambiente es la hora del día (mañana, atardecer, noche) más lámpara y vela; **no existe render de clima**
  (lluvia, niebla, nieve, estrellas) ni sonidos por libro.
- No había recomendaciones; solo el dado «¿Al azar?» de la librería. Existen la doble habitación, la guía y los
  veleros (§15–16), que esta fase no toca.

### 18.2 Motor físico — `src/utils/vibeEngine.js` · `calculateBookPhysics(book)` · VERIFICADO

Pura, determinista, sin red, DOM ni almacenamiento; no modifica el libro; acepta datos incompletos; resultados finitos.

| Campo | Regla |
| --- | --- |
| `thickness` (0,5–1,8) | Páginas válidas (> 0): `0,5 + clamp((páginas − 80)/920, 0, 1) × 1,3`. Audiolibro sin páginas: minutos (`durationMinutes`, o `audioHours × 60`) con `0,5 + clamp((min − 120)/2280, 0, 1) × 1,3`. Ausente, cero, negativo, NaN o unidad desconocida (`duration`) → 0,9 |
| `height` (0,95–1,08) | `0,95 + hash × 0,13`; hash FNV-1a entero de `id` → título normalizado → `'unknown-book'` |
| `material` | Personalización válida (`appearance.material`) > edición (`leatherbound`→leather, `clothbound`/`hardcover`→cloth, `paperback`/`annotated`→paper) > géneros (clásico→leather, poesía→cloth, ciencia ficción→metallic) > paper |
| `goldFoil` | Personalización (`appearance.goldFoil`) > la edición si la define (cuero y tela sí, el resto no) > inferido para fantasía o clásicos. Es un recurso visual, no una característica comercial |
| `spineColor` | Paleta estable de 8 tonos por hash: `#6B4438 #536753 #405B70 #8A7048 #66516B #A27356 #485C60 #77644F` |

Integración: `spineColor(book)` (dominio) devuelve el color elegido por el usuario o el del motor; los lomos y
libros 3D de la librería llevan `data-material` y `data-foil`. El grosor y la altura del motor quedan como datos:
el tamaño visible sigue saliendo de la edición elegida (una inferencia no cambia una edición del usuario).

### 18.3 Preajustes ambientales — `getDeterministicVibe(book)` · VERIFICADO (render parcial)

Devuelve `{ presetId, lightColor, secondaryColor, weather, ambientSound }`. Etiquetas (`tags` y `categories`)
normalizadas (minúsculas, sin acentos ni guiones, espacios colapsados) y comparadas **enteras** con un
diccionario explícito en español e inglés. Prioridad estable (el orden de las etiquetas no influye):
`mystery > science_fiction > winter > fantasy > romance > default`.

| Preajuste | Luz | Secundario | Clima | Sonido |
| --- | --- | --- | --- | --- |
| fantasy | `#E7BD79` | `#68788F` | starlight | fireplace |
| mystery | `#AAB8C6` | `#697384` | fog | rain_window |
| romance | `#F0CAA8` | `#B58A91` | clear | library_silence |
| science_fiction | `#A3C9D5` | `#777DA8` | starlight | night_crickets |
| winter | `#DCE6EA` | `#97ADBE` | snow | fireplace |
| default | `#E8C99B` | `#92A99B` | clear | library_silence |

- Integración (IMPLEMENTADO, VERIFICADO): la habitación toma el tono del **libro actual** (el que eliges o la
  lectura automática de siempre), nunca al pasar sobre otro libro: un velo muy leve y la luz de la lámpara y la
  vela con `lightColor`/`secondaryColor`, con transición de 1,6 s (sin destellos; instantáneo con movimiento
  reducido). Preferencia manual «Teñir la luz de la habitación con el tono del libro que leo» (`settings.bookVibe`,
  activada por defecto) en «Tu cuenta»: si se desactiva, no hay tono. La hora del día no se toca.
- `weather`: PENDIENTE de render (no hay clima en la escena); se devuelve el dato y la luz del preajuste es la
  alternativa visible. `ambientSound`: contrato de datos; no reproduce nada ni cambia el audio actual.

### 18.4 Color de portada — `src/utils/coverColor.js` · `extractCoverColor(url, options)` · VERIFICADO

- Contrato: `{ color: '#RRGGBB', source: 'cover' | 'fallback' }`; opciones `fallbackColor`, `signal`,
  `timeoutMs` (3000).
- El libro se pinta al momento con su color determinista; la portada se analiza en segundo plano solo si está
  visible o a 200 px (`IntersectionObserver`) y no hay color elegido por el usuario; el resultado se oscurece un
  22 % hacia la tinta para funcionar como tela de lomo. Si falla, se queda el color inicial.
- Carga: `crossOrigin = 'anonymous'` antes de `src`; errores de descarga, decodificación, `SecurityError` del
  canvas y tiempo agotado → color inicial. Sin proxy en Vercel y sin reintentos (los fallos también se
  recuerdan). El service worker deja pasar a la red las peticiones CORS de portadas (una copia opaca de su
  caché no serviría para leer píxeles) y sigue sirviendo de caché las de las `<img>`.
- Extracción: lienzo compartido de 32 × 32 (uno para toda la app), píxeles transparentes fuera, cuantización
  de 4 bits por canal; si hay suficiente contenido con color (≥ 15 %), blancos, negros y grises no compiten;
  imagen monocromática → sin color (se queda el inicial). Es un **color dominante aproximado**.
- Recursos: caché LRU en memoria de 200 entradas, una tarea por URL, máximo 2 análisis a la vez; no se crean
  `ImageBitmap` ni object URLs; nada se guarda en `localStorage`.
- React (`useCoverColor`): un resultado de una portada anterior se ignora; al desmontar no se actualiza nada;
  cancelar un consumidor no cancela la tarea compartida.
- Alcance: lomos y libros 3D de la librería. Los lomos pequeños de la habitación usan el color determinista.

### 18.5 Bibliotecario local — `src/utils/localLibrarian.js` · `recommendLocally({ userMood, catalog })` · VERIFICADO

- Salida: `{ recommendedIds (≤ 2, siempre del catálogo), librarianWhisper (español, ≤ 20 palabras),
  suggestedWeather (clear | rain | fog | starlight) }`. Sin red. **Es un sistema de reglas**: no entiende
  cualquier petición y lo dice.
- Límites: petición ≤ 500 caracteres; catálogo ≤ 5000; etiquetas ≤ 20 por libro; IDs deduplicados (gana el
  primero); entradas inválidas ignoradas.
- Intenciones (diccionario explícito): tranquilo/relajante/acogedor, misterio/intriga, aventura/épico,
  romántico/amor, corto/breve, largo/extenso; géneros por nombre (fantasía, ciencia ficción, clásico, juvenil,
  mitología, terror, histórica, literaria, poesía). Negaciones simples cercanas («sin», «nada de», «no quiero»,
  «no me apetece», «evitar», «ni»): alcanzan como mucho tres palabras y no cruzan comas, puntos, «y» ni «pero».
- Puntuación: intención +5, género +4, corta (1–250 páginas) +3, larga (≥ 500) +3, pendiente +1 (solo si ya
  encaja), etiqueta rechazada −8. Empates por ID (nunca por el orden del catálogo).
- Casos: catálogo vacío → mensaje útil; petición no reconocida → invita a probar algo sencillo, sin libros;
  reconocida sin coincidencias → «sugerencia neutra» identificada como tal (un pendiente no rechazado); sin
  páginas no se dice que sea breve; sin etiquetas no se atribuye tono.
- El clima propuesto no se aplica solo.

### 18.6 Interfaz · VERIFICADO

- Botón «Pedir una recomendación» en las herramientas de la librería (junto al dado), con nombre accesible.
  Panel con el sistema de modales: «¿Qué te apetece leer?», «Buscar en mi biblioteca» (Enter envía), hasta dos
  libros con portada, autor y estado (abren la ficha), la frase del bibliotecario y la nota «Recomendación local
  por reglas · sin IA». Resultado en una región `aria-live`. Sin velas, saldo, botones de IA ni cargas falsas.

### 18.7 OpenRouter (fase siguiente) · PENDIENTE

- Contrato del cliente: `{ action: 'ASK_LIBRARIAN', payload: { userMood, catalog } }`.
- Respuesta: `{ data: { recommendedIds, librarianWhisper, suggestedWeather }, candlesRemaining: number | null,
  fallback: boolean }`, más un campo de origen (`source: 'local' | 'remote'`) para distinguir resultado local y
  remoto sin fingir una llamada. El panel de esta fase ya marca su resultado como local.
- Otras dos acciones: **PENDIENTES DE ESPECIFICACIÓN** (sin nombres, prompts ni esquemas inventados).
- Requisitos: clave solo en servidor (nunca `VITE_*`); modelo configurable en servidor, elegido tras comprobar
  disponibilidad, precio y salida estructurada; validación de la respuesta (IDs del catálogo, tamaños, tipos)
  antes de usarla; límites de entrada y salida; tiempo máximo y cancelación; bibliotecario local como
  alternativa ante cualquier fallo; ninguna consulta al navegar, renderizar o cambiar de habitación; sin cambio
  automático de proveedor. El runtime (Edge o Node) se decidirá con mediciones reales de compatibilidad y
  latencia.

### 18.8 Velas y presupuesto (fase remota) · PENDIENTE

- Presupuesto previsto: 5 € de crédito en OpenRouter. No se traduce a tokens ni a consultas sin precios
  vigentes, moneda de facturación y tamaños medidos.
- Se distinguen: saldo en el proveedor; presupuesto máximo autorizado por BookShelf; límite diario global; y
  tres consultas diarias por usuario. El presupuesto no se renueva solo y no hay recarga automática.
- Necesitará: usuario autenticado para gastar crédito compartido; contador autoritativo compartido (una cookie
  firmada no lo sustituye); reserva atómica de vela y presupuesto antes de consultar; una consulta activa por
  usuario; idempotencia por id de petición; registro del consumo confirmado; tratamiento conservador de costes
  inciertos; corte global al agotarse; alternativa local si no se puede autorizar.
- Fallos: la vela se puede devolver según la política acordada, pero no se borra un coste ya facturado; un
  tiempo agotado local no demuestra que el proveedor no haya procesado la petición.
- Las consultas locales no consumen velas. No se crean tablas ni migraciones en esta fase.

### 18.9 Archivos

Nuevos: `src/utils/vibeEngine.js`, `src/utils/coverColor.js`, `src/utils/localLibrarian.js`,
`src/hooks/useCoverColor.js`, `src/components/panels/LibrarianPanel.jsx`, `src/domain/__tests__/ia1.test.js`,
`e2e/ia1.spec.js`. Modificados: `domain/books.js` (color inicial del motor), `shelf/BookItem.jsx`,
`shelf/ShelfView.jsx`, `room/CozyRoom.jsx`, `room/TimeOfDayLayers.jsx`, `panels/AccountPanel.jsx`, `App.jsx`,
`state/useLibrary.jsx` (`bookVibe`), `public/sw.js`, estilos.

### 18.10 Evidencias (2026-10-24)

- `npm run build` sin errores; `npm run lint` 30 avisos, ninguno nuevo.
- `npm run qa:full`: Vitest **117/117** (26 nuevas en `ia1.test.js`: grosor con páginas ausentes, negativas,
  NaN y extremas; minutos y horas de audio sin mezclar; límites y determinismo de altura y color; prioridad
  personalización > edición > géneros; objetos congelados sin mutación; alias, acentos, varios géneros,
  orden de etiquetas y datos incompletos en el ambiente; color de portada válida, CORS, tiempo agotado,
  monocromática, caché LRU, deduplicación, 2 análisis a la vez y cancelación sin romper la tarea compartida;
  bibliotecario con catálogo vacío, IDs repetidos, sin coincidencias, negaciones, datos insuficientes, máximo
  dos resultados, IDs del catálogo y frases de ≤ 20 palabras). Playwright **253 superadas, 3 omitidas**
  (capturas de diagnóstico) en los 8 proyectos; `e2e/ia1.spec.js`: estantería visible con colores
  deterministas mientras las portadas tardan 4 s, recomendación con la red desconectada y **sin ninguna
  petición fetch/XHR/websocket** del motor, **0 peticiones a OpenRouter, Groq u otros proveedores de IA** en
  toda la suite, apertura de la ficha desde el resultado, sin pérdida de libros ni registros, panel usable en
  móvil (campo de 16 px, botón de 44 px, sin desbordes) y ambiente del libro con su preferencia manual.
- Iteraciones: las pruebas encontraron y se corrigieron una negación que cruzaba la coma («no quiero romance,
  algo largo» negaba «largo»), el botón nuevo sin nombre accesible en móvil (las etiquetas de la librería se
  ocultan ahí) y el panel sin papel de fondo.
- Limitaciones: la extracción de color depende de que el servidor de cada portada permita CORS (Open Library
  lo hace en la mayoría de casos; si no, queda el color determinista); no se ha medido en un iPhone real.

## 19. Integración diegética: calendario, libro actual, lomos y ambiente (1.25.0)

Estados: **PENDIENTE**, **IMPLEMENTADO**, **VERIFICADO** (con pruebas ejecutadas en esta entrega, §19.8). Nada
se marca verificado por lectura de código. Sin llamadas a IA ni cambios en sonidos, probabilidades o paleta del Ático.

### 19.1 Punto de partida

- La tapa del portátil llevaba un post-it amarillo con la racha (14 días como máximo) y la pantalla quedaba
  oscura; el libro de la cama tenía un marcapáginas con «+5» que dominaba la composición.
- Los lomos de las baldas eran rectángulos sobre un fondo oscuro, con bandas doradas en todos.
- Las flechas del panorama eran pastillas grandes; «Fuera de vista» era un bloque fijo sobre la escena.
- El ambiente apenas se percibía fuera de los veleros.

### 19.2 Pantalla del portátil con el calendario del mes · VERIFICADO

- Fuera el post-it. El interior de la pantalla (`LAPTOP_DISPLAY`, medido sobre la ilustración; la planta y el
  vaso quedan delante) se ilumina con un polígono de luz (`LAPTOP_GLOW`) y un calendario proyectado con
  `rectToQuad` (caja local 236 × 196): mes en Cormorant, cabecera L M X J V S D (**lunes primero**), hoy en
  `#A46C3F` con texto `#FFF7E8`, días con lectura real marcados en `#738269`, pie «N días seguidos · lo de hoy».
- Fechas solo locales (`dayKey`, `parseDay`; nunca `toISOString`). `useToday` refresca al cambiar de día (temporizador
  a medianoche) y al volver a la pestaña (`visibilitychange`).
- Una sola racha para toda la app: `readingStreak(log, today)` en `domain/reading.js` (sin tope de 14), usada por
  la pantalla y por el panel del portátil; `activeDays(log)` da las marcas.
- La pantalla es decorativa (`aria-hidden`); el hotspot del portátil la abre en la pestaña Calendario.
- El contenido cabe dentro del bisel en 360, 390, 430, 844 × 390 y 1440 (prueba de esquinas proyectadas).

### 19.3 Libro abierto con la lectura actual · VERIFICADO

- Dos superficies separadas (`BOOK_LEFT_PAGE`, `BOOK_RIGHT_PAGE`), cada una con su homografía y sin cruzar el
  pliegue. Página izquierda: lámina de portada al 45–60 % de ancho, `object-fit: contain`, sin marco (portada
  generada si falta). Página derecha: «Tu lectura», título (máx. 3 líneas), autoría, filete y progreso.
- `progressLine(book)`: «Página N de T · P %», «P % leído» por porcentaje; nunca NaN, «undefined» ni porcentaje
  sin total. Solo el texto usa `mix-blend-mode: multiply`.
- Sin lectura: «Tu próxima historia empieza aquí». Tocar el libro abre su ficha (el +5 vive en el panel).

### 19.4 Lomos físicos · VERIFICADO

- Ancho por edición y páginas, altura determinista por libro, base apoyada en la balda (±1 px), 2 px de
  separación sin solapes, sombra de contacto. Solo el último de una fila se inclina (1,2°) y solo si sobra sitio.
- Material del motor (`calculateBookPhysics`): cuero con nervios, tela con trama, papel mate; dorado solo con
  `goldFoil`. Color de la portada (`useCoverColor`) o el determinista.
- Título vertical solo si el lomo mide ≥ 11 × 48 px CSS en pantalla.
- El canto delantero de cada balda (`SHELF_LIPS`) se recorta de la propia ilustración y tapa la base.

### 19.5 Navegación discreta y «Fuera de vista» en Guías · VERIFICADO

- Chevrón SVG de 20 px en un círculo de 44 × 44 con borde latón; nombres accesibles «Ir al Salón Social» y
  «Volver a Mi Habitación»; etiqueta visible al pasar o enfocar en escritorio. El gesto de deslizar sigue igual.
- «Guías» es un menú (`aria-expanded`, Escape o toque fuera lo cierran): repetir la guía, resaltar objetos y,
  si el encuadre recorta alguno (≥ 75 %), la lista «Fuera de vista» con sus acciones. Un punto en el botón avisa.

### 19.6 Movimiento ambiental · VERIFICADO

- 10 destellos deterministas dentro de los polígonos del agua (misma máscara que los veleros), ciclos de 3–6 s,
  opacidad máx. 0,18. Los veleros siguen a 110 s.
- Llama de la vela anclada a la mecha (`CANDLE`), escala 0,97–1,03; sin llama ni resplandor con la vela apagada.
- Motas de polvo en la luz de la puerta-ventana: 12 en móvil, 16 en escritorio, nunca de noche.
- Sin vapor caliente en el té helado; nada de recortes rectangulares en movimiento. Solo `transform`/`opacity`.
- En pausa fuera de la habitación, con modal o con la pestaña oculta; quieto con movimiento reducido.

### 19.7 Archivos

`scene/sceneMap.js` (quads), `domain/reading.js`, `domain/roomSurfaces.js`, `hooks/useToday.js`,
`components/room/RoomSurfaces.jsx`, `AmbientLife.jsx`, `BaySailboats.jsx`, `RoomShelfBooks.jsx`,
`PanoramicRoom.jsx`, `RoomCorner.jsx`, `CozyRoom.jsx`, `RoomLiveData.jsx`, `panels/LaptopPanel.jsx`, `App.jsx`,
`styles/room.css`; pruebas `domain/__tests__/v125.test.js`, `e2e/diegetic.spec.js`, proyecto Playwright 430 × 932.

### 19.8 Verificación

- Vitest: cuadrícula del mes (lunes, bisiestos, domingo 1), `progressLine` con datos incompletos, racha.
- Playwright `e2e/diegetic.spec.js` en los 9 proyectos (Chromium 360/390/430/844 × 390/1440, movimiento
  reducido y WebKit): mes, lunes, hoy, marcas = registro, dentro del bisel, actualización al guardar, apertura
  en Calendario; libro actual, sin lectura, título largo, sin portada, sin total; lomos apoyados, sin cruces,
  deterministas; chevrón 44 × 44 y glifo 16–24 px; Guías con objetos recortados; destellos en el agua, pausa
  al cambiar de habitación, sin capas duplicadas al volver; grabación de 14 s en 390 y 1440.
- Fluidez: recuento de `requestAnimationFrame` durante 3 s en Chromium sin cabeza (informativo; no es una
  medida de iPhone ni una promesa de 60 FPS).
- Limitaciones: WebKit en Windows no aplica `matrix3d` proyectivo (la pantalla y las páginas se ven planas
  allí); no hay pruebas en iPhone ni Safari reales.

## 20. Corrección visual del portátil, el libro y los lomos (1.26.0)

Sustituye las decisiones visuales de §19.2–§19.4 para estos tres elementos; conserva datos, acciones y
utilidades. Estados: **PENDIENTE**, **IMPLEMENTADO**, **VERIFICADO** (pruebas ejecutadas en esta entrega, §20.6).

### 20.0 Diagnóstico (medido, no supuesto)

- **Portátil:** la 1.25.0 proyectaba sobre un área interior recortada (≈ 100 × 85 px de la ilustración) para
  esquivar la planta y el vaso; el interior real del bisel mide ≈ 143 × 118. Resultado: una cuadrícula diminuta.
- **Libro:** el área útil derecha empezaba ≈ 40 px por debajo del borde real del papel; la portada ocupaba el
  52 % de la página con un lienzo apaisado; título y autor se repetían bajo la portada.
- **Lomos:** grosor = `páginas × 0,026` (mín. 7 px) sin edición ni motor físico, y alto del 86 % del hueco: cada
  lomo era ≈ 11 veces más alto que ancho, con bandas doradas y nervios dorados casi en todos. No había escala
  aplicada dos veces (cada balda se proyecta una sola vez) ni contenedor mal dimensionado.

### 20.1 Pantalla: BookShelf abierto en Calendario · VERIFICADO

- Quad `LAPTOP_SCREEN` = esquinas interiores del bisel `(762,998) (905,1023) (872,1149) (732,1114)`, medidas en
  rejilla. Lienzo lógico 300 × 248 proyectado una vez con `rectToQuad`. La planta, el florero y el vaso se
  repintan delante con `images/laptop-foreground.png`, recortado de la propia ilustración (alfa por color frente
  al gris pizarra de la pantalla apagada); el contenido no se mueve para esquivarlos: ocupa la columna izquierda.
- Distribución 14 % cabecera («BookShelf» + pestaña «Calendario» subrayada; sin barra de direcciones) · 32 %
  hoy · 46 % mes · 8 % estado (racha). Colores: fondo `#EDE9DF`, cabecera `#38483E` / `#F5F0E5`, texto
  `#2E3932` / `#697267`, zona de hoy `#F8F3E8`, hoy `#B78847`; días leídos con fondo salvia suave. Fuente de
  sistema para la interfaz y Lora en marca y títulos; sin sombras, tarjetas anidadas, emoji ni blanco puro.
- Hoy: «HOY · 24 oct», «N páginas leídas» como dato principal, el libro con más páginas y «+N libros».
  `todayReading` usa `groupByDay` y `dayDatum`, los mismos datos que el panel del calendario: páginas de los
  registros de hoy, nunca `currentPage`; con solo libros por porcentaje, su posición. Sin actividad: «Tu próxima
  página te espera». No se muestra duración.
- Tocar el portátil abre el panel en Calendario con **hoy seleccionado** (`panel.select = 'today'`, campo
  admitido por la navegación). Las celdas proyectadas no son botones; el hotspot es el único objetivo.

### 20.2 Libro: doble página editorial · VERIFICADO

- Quads del área imprimible medidos de nuevo (márgenes hacia el pliegue y los bordes); el mismo lienzo lógico
  250 × 330 en las dos páginas (son del mismo tamaño físico; la perspectiva la pone el quad). Proyección plana,
  sin mallas ni librerías nuevas.
- Izquierda: la portada al 60–75 % del ancho útil y ≤ 72 % del alto útil, proporción intacta, centrada, sin
  marco, esquinas ni sombra, sin opacidad reducida, en su propia capa con una luz muy sutil encima. La portada
  generada solo se ve mientras la real carga o si falla. Sin portada: frontispicio tipográfico (inicial y florón).
- Derecha: «ENTRE TUS PÁGINAS», título en Cormorant (máx. 3 líneas; 38 / 32 / 27 px según la longitud, nunca
  más pequeño), autoría en Lora, filete, «Página N de T», «P % leído» secundario y un hilo de progreso.
  `progressParts`: sin total no hay porcentaje ni hilo. Tinta `#473324`, secundario `#79634D`, filete
  `rgba(104,77,43,.35)`, multiply solo en tinta. Fuera «toca para abrirlo»; el título no se repite.
- Sin lectura: «Tu próxima historia empieza aquí» y «Elige un libro en tu librería». El bloque se monta de
  nuevo al cambiar de libro (`key`), así que nunca mezcla datos de dos lecturas.

### 20.3 Lomos con cuerpo · VERIFICADO

- Escala física común: 1 cm = 130/28 px de la ilustración en las dos baldas. Grosor = `0,5 + 2,4 × thickness`
  del motor + tapas de la edición; alto = 21,5 cm × alto de la edición × variación del motor. Lo que no cabe pasa
  a la segunda balda y después se queda fuera (subconjunto estable; la librería completa sigue a un toque). Nunca
  se encoge para que quepan todos; no se inventan libros.
- Cara principal con luz transversal (sombra 18 % · base · luz ≤ 9 % · sombra 22 %), canto lateral oscuro
  estrecho, sombra de contacto que no llega a la balda inferior y texturas por material (tela con grano fino,
  cuero suave, papel mate, metálico con un reflejo moderado).
- Cuatro diseños deterministas por libro (sobrio, banda editorial, emblema, recuadro de rótulo); nervios solo en
  cuero y su filo dorado solo con pan de oro. Son representaciones de la app, no lomos oficiales. Tinta clara u
  oscura según la luminancia del color. Título real cuando se lee y autoría si hay sitio.
- En el móvil los lomos miden 2–12 px CSS: el título no es legible y se simplifica a color y diseño.

### 20.4 Franja negra superior · DOCUMENTADO

- Dentro de la página no hay franja: `.panorama-viewport` es `fixed`, `inset: 0`, `100dvh`; `fitCover` siempre
  cubre (desplazamiento vertical ≤ 0). La prueba `encuadre` comprueba en todos los perfiles que la imagen cubre
  el viewport entero.
- Causa probable, no confirmada: la barra de estado de iOS, que Safari tiñe con `theme-color` `#2a1d14`
  (o con `black-translucent` en modo app). Es interfaz del navegador o del dispositivo: no se cambia el
  layout. Pendiente comprobarlo en un iPhone real con la captura original.

### 20.5 Archivos

`scene/sceneMap.js`, `domain/roomSurfaces.js`, `domain/navigation.js`, `components/room/RoomSurfaces.jsx`,
`RoomShelfBooks.jsx`, `CozyRoom.jsx`, `panels/LaptopPanel.jsx`, `panels/ReadingCalendar.jsx`, `App.jsx`,
`styles/room.css`, `public/images/laptop-foreground.png`; pruebas `domain/__tests__/v126.test.js`,
`e2e/diegetic.spec.js`, `e2e/v123.spec.js`.

### 20.6 Verificación

- Vitest: `todayReading` (sin actividad, páginas de hoy y no `currentPage`, varias lecturas, porcentaje,
  correcciones) y `progressParts` (con y sin total).
- Playwright `e2e/diegetic.spec.js` en los 9 proyectos: cabecera y mes, lunes primero, hoy, marcas = registro,
  contenido dentro del bisel; hoy sin actividad → invitación; guardar 6 páginas → «6 páginas leídas»; dos
  lecturas → «42 páginas leídas» + «+1 libro»; abrir el portátil llega con hoy seleccionado; portada al 60–75 %
  del ancho útil y ≤ 72 % del alto, sin título repetido ni «toca para»; sin portada, título largo, sin total y
  sin lectura; lomos apoyados, sin cruces, deterministas, grosores y diseños variados; encuadre a pantalla completa.
- Revisión visual en capturas de la escena completa y recortes en 360, 390, 430 y 1440.
- Limitaciones: a 1440 × 900 el encuadre (§15) deja las baldas fuera de la vista. WebKit en Windows no aplica
  `matrix3d` proyectivo. No hay pruebas en iPhone ni Safari reales.

## 21. Coherencia gouache y corrección de elementos recortados (1.27.0)

Reemplaza las decisiones incompatibles anteriores: se retira la portada grande impresa sobre la página
(§20.2), la paleta verde propia de la pantalla del portátil (§20.1) y el posicionamiento de etiquetas que podía
salir del viewport. Conserva datos, acciones y motores locales. Estados: **PENDIENTE**, **IMPLEMENTADO**,
**VERIFICADO** (pruebas ejecutadas en esta entrega, §21.8). Las capturas citadas no llegaron adjuntas: el
diagnóstico se ha hecho reproduciendo cada caso en la app.

### 21.0 Diagnóstico (causas medidas)

1. **Portada como pegatina:** la lámina de §20.2 era una imagen opaca rectangular encima del papel pintado.
2. **Calendario exterior distinto:** la pantalla tenía su propio diseño (verde `#38483E`, fuente de sistema)
   en vez del calendario interior (`laptop.css`).
3. **Lomos geométricos:** rayados de 0,6–1,8 px (moiré al reducirse), bisel con `inset` y brillo blanco, y
   dorado inferido por género (`goldFoil` del motor) en casi todos.
4. **Tarjeta del temporizador cortada:** no era el panel (que ya va en `#modal-root`), sino la etiqueta
   informativa `RoomLabel` del vaso. Se pintaba DENTRO del lienzo escalado de la habitación con el ancla en
   x = 858 de 941 y `translate(-50%, -100%)`, sin límites, y el `overflow: clip` del panel panorámico la cortaba
   (z-index no lo evita). En móvil, el toque dejaba el botón enfocado y `onFocus` mantenía la tarjeta.
   Además, el escenario tenía `overflow: hidden`: enfocar un objeto recortado (el libro a 1440 × 900) lo
   desplazaba hasta 333 px y movía escena y anclas.
5. **Elementos que compiten:** la capa de objetos (`.room-objects`, z 20) quedaba por encima de la luz (`.tod`,
   z 5): pantalla, recorte de la planta, lomos y canto de las baldas no recibían la luz de la escena (con
   atardecer o noche el recorte de la planta se veía como un rectángulo).

### 21.1 Dos familias · VERIFICADO

- **A · Contenido integrado** (coordenadas de la imagen, misma escala, recorte y luz): pantalla del portátil,
  páginas del libro, lomos y canto de las baldas en `.room-surfaces` (z 2, debajo de `.tod`); luces y efectos
  ambientales.
- **B · Interfaz** (píxeles de pantalla, ajustada al viewport): etiquetas en la capa del panel (`overlay`),
  paneles en `#modal-root`, guía con `placeCard`, menú «Guías» en la esquina.
- El escenario usa `overflow: clip`: el foco ya no lo desplaza.

### 21.2 Libro: portadilla editorial · VERIFICADO

- Sin portada sobre el libro (la original sigue en la ficha). Contenido transparente sobre el papel pintado, sin
  tarjetas, fondos ni sombras de texto. Mismo lienzo lógico 250 × 330 por página y quads del área imprimible.
- Izquierda: «LECTURA ACTUAL», título en Cormorant 500 (40 / 33 / 28 px por longitud; después refluye, máx. 4
  líneas), autoría en Lora y un ornamento SVG local (ramita, estrella, ola o geométrico) elegido con el
  preajuste del motor (`getDeterministicVibe`) o el id; es un adorno de la app, no una ilustración de la obra.
- Derecha: «Por donde vas», «Página 61» y «de 496 · 12,3 %» (`progressParts`), con una línea fina de
  progreso; por porcentaje, «37,5 %» y «leído»; sin total, sin porcentaje. El título no se repite.
- Tinta `#493727`, secundaria `#79654F`, multiply en tinta y ornamento. Sin lectura: «Tu próxima historia
  empieza aquí» y «Elige un libro en tu librería». El libro entero abre la ficha.

### 21.3 Calendario: misma aplicación, vista compacta · VERIFICADO

- `CalendarApp variant="scene"`: barra de ventana con «Calendario», mes y año, cuadrícula L–D con las mismas
  clases (`.window__bar`, `.cal__head`, `.cal__grid`, `.cal__cell`, `.cal__num`), la misma intensidad por día
  (`heat`), el mismo anillo de hoy (`#c4623a`) y una sola línea: «Hoy · 24 páginas» o «Hoy · Sin lectura
  registrada» (`dayDatum` de los registros de hoy, nunca la posición del libro).
- Compartido, no duplicado: `groupByDay`, `heat`, `dayDatum` y `monthCells` (el panel completo también usa
  ya `monthCells`). Solo cambia el tamaño; las reglas móviles del panel que dependen del viewport (alto
  mínimo de celda) se neutralizan en la miniatura.
- Geometría: cuadrícula de calibración renderizada sobre `LAPTOP_SCREEN` (bordes, diagonales, centro y
  retícula del 10 %), comprobada contra el bisel antes de sustituirla. El calendario ocupa toda el área
  interior con padding uniforme; la planta y el vaso lo tapan en parte (se respeta la oclusión). Las celdas no
  son botones.

### 21.4 Lomos gouache · VERIFICADO

- Grosores, alturas y colores de §20.3 (sin escala duplicada). Una textura de grano local (SVG
  `feTurbulence` en una variable CSS, la misma imagen para todos, `soft-light`) en vez de rayados.
- Luz transversal suave (sombra 20–24 % en los cantos, centro +6 %), sin `inset` ni brillo blanco; variación
  tonal determinista de −8 % a +8 % por libro; sombra de contacto cálida `rgb(64 36 14 / .45)`.
- Latón mate `#AA8750` solo si la edición lo justifica (cuero, tela, cantos pintados) o el usuario lo eligió
  (`appearance.goldFoil`); nunca inferido por género. Bandas y emblemas tonales en el resto.
- Ahora reciben la luz de la escena (están bajo `.tod`). Título real solo cuando se lee.

### 21.5 Temporizador, etiquetas y guía siempre visibles · VERIFICADO

- Etiqueta (tooltip): en la capa del panel, con el ancla convertida una vez (`toScreen`) y colocada con
  `placeLabel`: encima o debajo, limitada a 12 px + áreas seguras, `max-width: min(17em, 100% − 24px)`. Se
  recoloca al cambiar encuadre, contenido o su propio tamaño (`ResizeObserver`: el primer render medía antes de
  cargar las fuentes). Se oculta durante el cambio de habitación, con la guía o con un panel abierto.
- En móvil el toque abre la función y no deja tarjeta (el foco del toque no la muestra); teclado y ratón sí.
- Panel del temporizador: portal fuera del track; en ≤ 640 px de ancho o ≤ 560 px de alto cabe en el viewport,
  la cabecera con «Cerrar» y el reloj quedan fijos y solo se desplaza el resto.
- Guía: una sola tarjeta con `placeCard` (§16), oculta durante el cambio de habitación.

### 21.6 Elementos sueltos · VERIFICADO

- Puntos y marcas identificados: el punto del botón «Guías» (indicador funcional de objetos fuera de vista),
  motas de polvo (≤ 0,28 de opacidad, sin eventos), insignias de objetos (solo si se activan) y el diagnóstico
  de escena (solo en desarrollo con `?sceneDebug=1`). Ninguno intercepta toques: prueba de `elementFromPoint`
  en el centro de cada objeto y `pointer-events: none` en todas las capas decorativas.

### 21.7 Archivos

`components/panels/ReadingCalendar.jsx`, `components/room/RoomSurfaces.jsx`, `RoomHotspots.jsx`,
`RoomShelfBooks.jsx`, `CozyRoom.jsx`, `domain/roomSurfaces.js`, `scene/guidePlacement.js`, `styles/room.css`,
`styles/panels.css`, `styles/figures.css`; pruebas `domain/__tests__/v127.test.js`, `v126.test.js`,
`v125.test.js`, `e2e/gouache.spec.js`, `e2e/diegetic.spec.js`, `e2e/v123.spec.js`.

### 21.8 Verificación

- Vitest: `placeLabel` (centrada, borde derecho, cambio de lado, áreas seguras, ancla fuera, sin espacio) y
  `progressParts`.
- Playwright `e2e/gouache.spec.js` y `e2e/diegetic.spec.js` en los 9 proyectos: todas las etiquetas visibles
  dentro del viewport y fuera del lienzo escalado; toque sin tarjeta; temporizador en portal, dentro del
  viewport, con «Cerrar» y reloj visibles tras desplazar; calendario exterior = interior en mes, hoy,
  intensidad por día, tipografías, colores de celda e intensidad y barra; portadilla (sin imagen, Cormorant
  500, tinta `#493727`, multiply, sin sombra; ejemplo «Página 61 / de 496 · 12,3 %»); título largo, sin total y
  sin lectura; lomos sin halo, latón solo en ediciones doradas, una sola textura; ninguna capa invisible
  intercepta toques y no quedan etiquetas al cambiar de habitación.
- Capturas: habitación, portátil, calendario abierto, libro, lomos, temporizador y etiqueta junto al borde
  (`gouache-*`); guía cerca del borde derecho (`guia-rituales`, `e2e/anexos.spec.js`).
- Limitaciones: a 1440 × 900 las baldas quedan fuera del encuadre (§15); la planta tapa las columnas S–D de
  la miniatura (oclusión real del asset); el resalte de un objeto al enfocarlo (`hotspot-lift`, de versiones
  anteriores) no recibe la luz de la escena; WebKit en Windows no aplica `matrix3d` proyectivo; no hay pruebas
  en iPhone ni Safari reales ni con teclado virtual real.

## 22. Biblioteca completa, buscador, calendario con lecturas activas, reseña al terminar y brisa (1.28.0)

Mejora incremental sobre el código actual (no se restaura nada del ZIP 1.15.0). Sin búsqueda externa, ISBN por
escáner, ediciones, comunidad ni cambios en figuras. Estados: **IMPLEMENTADO** y **VERIFICADO** (pruebas de
esta entrega, §22.10).

### 22.1 Inspección y contrato de datos

| Responsabilidad | Componente actual |
| --- | --- |
| Habitación, cámara, coordenadas | `SceneStage` (`fitCover`, `toScreen`), `scene/sceneMap.js`, `CozyRoom.jsx` |
| Temporizador y su indicador | `hooks/useReadingTimer` (estado único), `PomodoroTray.jsx`, `RoomLiveData.jsx · TeaMist` |
| Vegetación y ambiente | Ilustración única (`cozy-book-room.jpg`, sin capas de hojas), `AmbientLife.jsx`, `TimeOfDayLayers.jsx` |
| Librería, filtros, tarjetas | `shelf/ShelfView.jsx`, `BookItem.jsx`, selectores nuevos `domain/library.js` |
| Calendario, selector, registro | `panels/ReadingCalendar.jsx`, `ReadingEntryForm.jsx`, `domain/bookPicker.js`, `domain/reading.js` |
| Diario, reseña, puntuación | `book/BookDetailModal.jsx`, `book/Rating.jsx`, nuevo `panels/ReviewSheet.jsx` (mismos campos) |
| Persistencia y nube | `state/useLibrary.jsx` (`localStorage`, `persistNow`), `state/cloudSync.jsx` + `services/cloud.js` |

- **Datos:** la biblioteca entera vive en el dispositivo y se copia a Supabase como UN documento por usuario
  (tabla `libraries`, RLS por usuario). No hay consultas paginadas: filtros y búsqueda recorren siempre todos
  los libros guardados. Progreso, sesión y finalización se escriben juntos en una sola escritura del estado
  (`persistNow`), así que no pueden quedar a medias; la nube sube después el documento completo.
- **Biblioteca completa** (`libraryBooks`): todo lo guardado (lo borrado sale del array). **Lecturas activas**
  (`activeReadings`): solo `status: 'reading'`. Pendientes (`want`) y terminados (`read`). Sin estados nuevos.

### 22.2 Indicador del temporizador junto al borde · VERIFICADO

- Causa del recorte: `TeaMist` se pintaba DENTRO del lienzo escalado, centrado con `translate(-50%, -100%)` en
  el vaso (x ≈ 856 de 941) y sin límites: el `overflow: clip` del panel cortaba la mitad derecha.
- Ahora es una anotación en `.room-annotations` (capa del panel, `pointer-events: none`), con el ancla del vaso
  proyectada una vez con la cámara (`toScreen`) y `placeAnnotation`: x = clamp(ancla − ancho/2,
  izquierda, ancho − derecha − ancho); y = clamp(ancla − alto − 12, arriba, alto − abajo − alto), con
  márgenes `max(12px, safe-area)`. `ResizeObserver` (fuentes, cifras) y el ciclo de encuadre de `SceneStage`
  (tamaño, orientación, cámara); ningún bucle nuevo. Solo lee el estado del temporizador único.
- JetBrains Mono `clamp(18px, 4.8vw, 28px)`, cifras tabulares, `#FAF5E8` con sombra
  `0 1px 3px rgba(44,30,20,.72)`; subtítulo Lora 12 px / 1,3. Sin panel, fondo ni desenfoque.
- Si el vaso queda totalmente fuera del encuadre, no se pinta (la bandeja sigue funcionando).

### 22.3 Brisa por la ventana · VERIFICADO

- La vegetación está pintada en la ilustración: no se recorta ni se mueve. Se AÑADEN 4 grupos de hojas SVG
  junto a la hiedra del arco (`BreezeLeaves`), cada uno sujeto por su tallo. Es vegetación adicional; las hojas
  originales no se han separado.
- Colores medidos en la imagen (sombra `#483f22`, hoja `#596037`, luz `#949671`) y ajustados con la base
  propuesta: **`#4A4A2C`, `#626A3F`, `#9C9C6C`**. Hojas ≈ 16 × 20 px de la imagen, como la hiedra pintada.
- Ráfaga de 14 s: sube, oscila y vuelve; reposo ≈ 65 %. Máx. 3 px / 1,5 px y −1,2° … 1,6°, sin escala;
  desfases 0 / −2,4 / −5,1 / −7,3 s; `ease-in-out`. Solo `transform` (y `will-change` en esos 4 grupos), bajo
  las capas de luz, sin filtros ni mezclas. En pausa fuera de la habitación, con un panel o con la pestaña
  oculta; estática con movimiento reducido. Sin canvas, vídeo ni estado React por fotograma.

### 22.4 Librería: toda la biblioteca · VERIFICADO

- Ya partía de `state.books`; ahora con selectores explícitos y, al abrir desde la habitación, «Todas» y sin
  búsqueda previa. Las tres baldas (leyendo, pendientes, terminados) juntas; las cintas y las placas filtran.
- En pantallas ≤ 1100 px el muro de recuerdos (z 9) tapaba las cintas de filtro (solo asomaba la punta): el
  copete pasa por encima. Los botones Escaparate / Lomos tienen nombre accesible también en móvil.
- Ediciones físicas y mini-insignias de saga sin cambios; ningún libro cambia de estado.

### 22.5 Buscador de la biblioteca personal · VERIFICADO

- Ficha de papel `#FAF5E8` junto a los controles (borde `rgba(110,78,46,.28)`, radio 8, sombra suave), Lora,
  input de 16 px, 44 px de alto, foco `2px solid #C59B27`. «Buscar en mi biblioteca», «Título o autor…»,
  «Limpiar búsqueda».
- `filterLibrary`: título, autor e ISBN guardado; sin mayúsculas, tildes ni espacios sobrantes; filtro y búsqueda
  a la vez sobre toda la biblioteca (selector memoizado: los datos están cargados). Nada de Google Books ni Open
  Library, sin autoenfoque ni `scrollIntoView` al escribir; el input no se desmonta y se conserva al alternar
  vistas.
- Estados vacíos: «Tu estantería espera su primera historia», «Todavía no tienes libros en este apartado», «No
  encontramos ese libro en tu biblioteca»; ninguno mientras la cuenta trae la biblioteca («Abriendo tu
  biblioteca…»).

### 22.6 Calendario: solo lecturas activas para registrar · VERIFICADO

- Sustituye «Otros…» (§17.2): el desplegable de un registro NUEVO muestra solo lecturas activas. Sin ninguna:
  «No tienes ninguna lectura en curso», registro deshabilitado y «Elegir un libro de mi biblioteca» (abre la
  librería; no cambia estados).
- El historial del calendario conserva los libros terminados; editar un registro conserva su libro original.
- Si el libro elegido deja de estar activo, la selección pasa a otra lectura activa después de guardar, nunca
  durante el guardado. Claves estables, sin remontar ni reenfocar (correcciones de iPhone intactas).

### 22.7 Terminar desde el calendario abre la reseña · VERIFICADO

- `completesReading(book, position)`: transición real de < 100 % a 100 %. Con páginas, la página alcanzada igual
  al total válido (419/420 no termina); sin páginas, el porcentaje exacto 100 (sin inventar total).
- Orden: validar → guardar progreso, sesión y estado en una sola escritura → confirmar el guardado → abrir la
  reseña de ese libro (`onComplete`, solo desde el calendario) → el selector retira el libro.
- No es un efecto sobre el estado global: nunca se abre al recargar, sincronizar o cambiar de dispositivo (una
  reseña restaurada del historial vuelve al calendario). Id estable por operación: el doble toque no duplica
  sesión, finalización ni sellos. No se conceden recompensas, sellos ni pity al abrir, guardar o cerrar la reseña.
- Si falla el guardado: se conserva lo escrito, se muestra el error, el registro se deshace en memoria
  (`revertLog`: el libro no queda terminado) y no se abre la reseña; reintentar usa el mismo id. No hay cola
  offline persistente (la nube sincroniza el documento cuando puede).

### 22.8 Reseña sin bloquear el calendario · VERIFICADO

- `ReviewSheet` edita los mismos campos de la ficha (`review`, `rating`; una reseña por libro, sin relecturas) con
  el mismo `RatingInput`. Portada y título, «Una historia terminada», puntuación, reseña, «Guardar reseña» y
  «Ahora no» (cierra y el libro sigue terminado). Privada: no hay opción de publicar.
- Puntuación en cuartos (3,25 / 3,5 / 3,75). **Sin valorar es `null` explícito** (antes `0`, que se migra al
  cargar); el cero nunca es una nota.
- Un único panel: sustituye al calendario y, al cerrar, vuelve al mismo día con el foco en el panel. Cuerpo
  desplazable y acciones fijas (`100dvh`), también con el teclado abierto. Papel `#FAF5E8`, tinta `#2C1E14`,
  título Cormorant, cuerpo Lora, nota Caveat, estrellas de latón `#C59B27`.

### 22.9 Archivos

`domain/library.js` (nuevo), `domain/bookPicker.js`, `domain/books.js`, `scene/guidePlacement.js`,
`state/useLibrary.jsx`, `components/room/RoomLiveData.jsx`, `AmbientLife.jsx`, `CozyRoom.jsx`,
`components/shelf/ShelfView.jsx`, `components/panels/ReadingEntryForm.jsx`, `ReadingCalendar.jsx`,
`LaptopPanel.jsx`, `ReviewSheet.jsx` (nuevo), `components/book/Rating.jsx`, `App.jsx`, `styles/room.css`,
`styles/shelf.css`, `styles/panels.css`, `styles/typography.css`; pruebas `domain/__tests__/v128.test.js`,
`v123.test.js`, `reading.test.js`, `e2e/v128.spec.js`, `e2e/v123.spec.js`.

### 22.10 Verificación

- Vitest (`v128.test.js`): biblioteca con todos los estados; búsqueda con filtro, tildes e ISBN; estados vacíos;
  selector de nuevos registros solo con lecturas activas; historial con terminados; 419/420 no termina y 420/420
  sí; ebook de 99 a 100 sin páginas ficticias; doble toque sin duplicar sesión, finalización ni sellos; fallo →
  `revertLog`; hidratar no crea orden de reseña; 3,75 se conserva al guardar y cargar; sin valorar = null;
  márgenes del indicador.
- Playwright (`e2e/v128.spec.js`, 9 proyectos): librería completa en Escaparate y Lomos con búsqueda conservada,
  filtro + búsqueda y estados vacíos; calendario 419 → sin reseña, 420 con doble toque → una reseña, un panel,
  un registro; «Ahora no» → mismo día, libro terminado, fuera del selector y en el historial; recargar → sin
  reseña; 3,75 guardado sin cambiar sellos; fallo de almacenamiento → error, sin reseña ni finalización,
  reintento → reseña; indicador del temporizador dentro del área visible, JetBrains Mono, fuera del lienzo y
  estable tras mover la cámara; brisa con 3–5 grupos, en pausa con panel u otra habitación y quieta con
  movimiento reducido. `e2e/v123.spec.js`: selector sin «Otros…» y sin lecturas activas.
- Entornos: Chromium y WebKit de Playwright en Windows (320 no es un proyecto de la suite; se comprueba 360,
  390, 430, 844 × 390 y 1440). No hay Safari de iPhone real ni teclado virtual real: no se declaran.

## 23. Integración de los recursos ilustrados de la habitación (1.29.0)

Sobre la 1.28.0, sin reconstruir la habitación ni el calendario ni tocar cuenta, sincronización, datos de lectura o
mecánicas gacha. Estados: **IMPLEMENTADO**, **VERIFICADO** (pruebas de esta entrega, §23.7) y **BLOQUEADO**
(recurso que no se integra porque su resultado no es limpio; se conserva la representación anterior).

### 23.1 Recursos y correspondencia

Originales intactos en `assets-source/room-refresh/` (copiados de Descargas; nombres reales):

| Referencia | Archivo real | Medida | Uso |
| --- | --- | --- | --- |
| 156986 · fondo limpio | Dormitorio costero con ventana arqueada.png | 941 × 1672 (no 864 × 1536) | Solo como fuente; **no** sustituye la base (§23.2) |
| 156987 · 12 lomos | Colección de doce lomos en gouache-1.png | 1024 × 1536, alfa limpio | Lomos ilustrados (§23.3) |
| 156989 · vegetación superior | Enredaderas colgantes sobre la ventana.png | 941 × 1672 | BLOQUEADO (§23.2) |
| 156993 · enredadera lateral | Enredadera mural junto a la ventana.png | 941 × 1672 | BLOQUEADO |
| 156992 · cortina | Cortina de lino crema con sujeción.png | 941 × 1672 | BLOQUEADO |
| 156990 · paisaje | Bahía mediterránea al anochecer-1.png | 1586 × 992 | Fondo de la pantalla (§23.4) |

De las dos láminas de lomos se elige «gouache-1» (alturas de 620 a 670 px y nervios en relieve) frente a «Doce
lomos de libros en cuadrícula-2» (alturas iguales). Inspeccionada sobre fondos claro y oscuro: 12 piezas
separadas, sin halo ni fondo de color; lo semitransparente es el antialias del contorno y una sombra de
contacto leve en la base. Derivados en `public/images/room-refresh/` (nombres sin espacios ni tildes; las capas en
PNG sin pérdida, verificadas píxel a píxel).

### 23.2 Montaje estático · BLOQUEADO (se conserva la ilustración original)

- El fondo limpio coincide en geometría con la ilustración vigente (desplazamiento 0; diferencias de repintado
  pequeñas en vaso, vela y mar), pero no trae la hiedra ni la cortina pintadas.
- Las tres capas no encajan con esta habitación: la enredadera lateral baja hasta y = 1669 (cruza la cama, los
  auriculares y el libro; la hiedra original del pilar termina en y ≈ 1060); la cortina mide 233 × 1173 px con
  el recogido al 60 % de su altura (la original, ≈ 100 px de ancho con el recogido al ≈ 80 %), y tapa el sillón
  y las macetas. Ningún escalado uniforme las alinea; estirarlas está prohibido.
- Alternativa probada: separar la hiedra ORIGINAL por diferencia con el fondo limpio y moverla sobre parches de
  pared limpia. Dos iteraciones dejaron parches con escalones y manchas (la pared limpia tiene otro tono de
  pintura) y hojas incompletas o trozos de viga: no es un recorte limpio y no se integra.
- Resultado: la base sigue siendo `images/cozy-book-room.jpg`. No cambia ninguna coordenada (`ROOM_SHELVES`,
  `SHELF_LIPS`, `LAPTOP_SCREEN`, `LAPTOP_FOREGROUND`, máscaras de agua y hotspots siguen siendo válidos y se
  comprueban con `?sceneDebug=1`). La cortina pintada queda estática.

### 23.3 Lomos ilustrados · VERIFICADO

- `RoomSpine` usa las 12 texturas (`lomos/web/lomo-NN.webp`, 360 px de alto, 136 KB en total), elegidas por
  `stableHash('spine:' + id) % 12`, sin aleatoriedad. Datos, interacción, proyección `rectToQuad`, tamaños por
  libro y edición (`spineSize`), libros mostrados y baldas de figuras sin cambios.
- `spineArtSize` (`domain/spineArt.js`): la textura se estira como mucho ×1,35; si el lomo es más fino o más
  grueso, se recorta centrada (nunca deformación extrema).
- Fuera los degradados, grano, bandas, emblemas y nervios en CSS (ya están pintados); solo una sombra de contacto
  cálida `rgb(64 36 14 / .32)`. Título en Lora con tinta según la luminancia medida de la textura: `#2C1E14` en
  las claras (02, 05, 09, 10, 12) y `#F6EFE2` en las demás, con los umbrales de legibilidad de siempre.
- E-readers y audiolibros conservan su aspecto de objeto (sin textura de libro). Si una textura no carga, queda
  el color determinista del motor. El color de portada ya no tiñe el lomo.

### 23.4 Pantalla del ordenador · VERIFICADO

- `pantalla-bahia.webp` (640 × 400, 11 KB) como fondo de escritorio dentro de `.laptop-screen` (con
  `overflow: hidden`: se recorta en el monitor antes de la única proyección). La ventana de `CalendarApp
  variant="scene"` queda encima con un margen de 10 px y su papel opaco: el calendario y sus datos no cambian.
- Movimiento tenue solo del paisaje (desplazamiento de 7 px en 48 s, ida y vuelta), en pausa fuera de la
  habitación, con un panel abierto o con movimiento reducido. Sin perspectiva extra ni `backdrop-filter`.

### 23.5 Movimiento ambiental

- **Hojas · BLOQUEADO:** sin vegetación ilustrada separable con limpieza (§23.2), se mantiene `BreezeLeaves`
  (§22.3) como única representación; no conviven dos sistemas.
- **Cortina · estática:** la pintada en la ilustración; la capa nueva no encaja y no hay deformación convincente.
- **Mar:** `BaySailboats` y sus máscaras sin cambios (la base no ha cambiado).
- **Pantalla:** el paisaje (§23.4). Pausas: documento oculto, habitación fuera de vista, panel abierto y
  `prefers-reduced-motion`; sin estado React por fotograma.

### 23.6 Archivos

`src/components/room/RoomShelfBooks.jsx`, `RoomSurfaces.jsx`, `CozyRoom.jsx`, `src/domain/spineArt.js` (nuevo),
`src/styles/room.css`, `public/images/room-refresh/` (derivados), `assets-source/room-refresh/` (originales);
pruebas `e2e/gouache.spec.js`, `e2e/diegetic.spec.js`, `src/domain/__tests__/v128.test.js`.

### 23.7 Verificación

- Vitest: `spineArtSize` (cubre siempre el lomo y no deforma más de ×1,35).
- Playwright: texturas cargadas, deterministas tras recargar, sin adornos CSS ni sombra alrededor, tinta y Lora
  según la textura, dispositivos sin textura; pantalla dentro del bisel con el calendario legible; suite completa
  en los 9 proyectos (Chromium y WebKit en Windows). `?sceneDebug=1` en desarrollo: geometría sin cambios.
- No se afirma 60 fps ni pruebas en un iPhone físico.

## 24. Escena recompuesta sobre el fondo limpio (1.30.0)

Cambio de criterio respecto a §23.2: las capas generadas son piezas para recomponer la escena, no recortes
registrados píxel a píxel. Se permiten recorte de márgenes (con desplazamiento registrado), escala proporcional,
posición, giro leve y división por separaciones naturales; no se estira, no se cortan hojas ni tela con bordes
rectos visibles, no se mueve pared ni madera y no se deja vegetación ni cortina duplicadas. No se vuelve a extraer
nada de la ilustración original. Se conservan los lomos y la pantalla de §23. Medidas verificadas en los
archivos locales (fondo limpio 941 × 1672; capas 941 × 1672 con alfa; lámina de lomos con alfa limpio).

### 24.1 Arquitectura del fondo limpio · VERIFICADO

- Comparado con la original sobre rejilla y con los polígonos dibujados encima: interior de la pantalla, vaso,
  mecha de la vela, máscaras del agua, baldas y libro caen en el mismo sitio (desplazamiento 0). No hay
  coordenadas que recalibrar: `ROOM_SHELVES`, `SHELF_LIPS`, `LAPTOP_SCREEN`, `TEA_LIQUID`, `CANDLE`, el agua de
  `BaySailboats` y los hotspots se mantienen (comprobado con `?sceneDebug=1` en 390 y 1440).
- `LAPTOP_FOREGROUND` sí cambia de origen: el recorte de la planta y el vaso se rehace a partir del fondo limpio
  (`escena/portatil-primer-plano.webp`, misma caja 216 × 172 en (725, 990)); el anterior era de la otra pintura.

### 24.2 Montaje · VERIFICADO

Todo en coordenadas de la imagen dentro del lienzo de `SceneStage` (una sola transformación), en
`public/images/room-refresh/escena/` con su colocación en `escena.json`:

| Pieza | Origen (recorte, escala) | Destino (x, y, ancho × alto) | Movimiento |
| --- | --- | --- | --- |
| `cortina-alta` | Cortina de lino… (448, 0, 234 × 1174), ×0,68 | (476, 0) 159 × 495 | fija |
| `cortina-caida` | la misma, bajo el recogido (62 %) | (476, 495) 159 × 303 | solo la tela libre |
| `enredadera-poste` | Enredadera mural… (183, 19, 322 × 1651), ×0,40 | (340, 80) 129 × 660 | fija (poste rígido) |
| `hiedra-izquierda` | Enredaderas colgantes… mancha izquierda | (0, 0) 443 × 358 | giro y desplazamiento mínimos |
| `hiedra-derecha` | la misma, mancha derecha | (437, 0) 504 × 476 | giro y desplazamiento mínimos |

- **Cortina:** reducida ×0,68 junto al marco izquierdo del ventanal; cuelga desde fuera del encuadre (sin borde
  superior visible), con el recogido en y ≈ 495 y el bajo en y ≈ 798, justo encima del respaldo del sillón
  (y ≈ 810). Conflicto ancho/largo: a esta escala no llega al suelo; se prioriza no invadir el sillón (con más
  escala lo taparía). El corte en el recogido queda oculto por el nudo.
- **Enredadera lateral:** ×0,40 junto a la ventana, a la izquierda de la cortina, desde y = 80 hasta y = 740
  (encima de las macetas): no cruza la cama, el libro ni los auriculares. Su poste rígido no se mueve.
- **Vegetación superior:** dos grupos por su separación natural (manchas conectadas), sin cortes; la izquierda
  sobre la viga y la estantería, la derecha colgando del arco. Las hojas pintadas que conserva el fondo limpio
  están al otro lado del cristal; las capas quedan por dentro.
- Orden: fondo original (alternativa) → fondo limpio → veleros → cortina → enredadera → guirnaldas → objetos y
  luz (las capas reciben la misma iluminación que la escena). Decorativas: `aria-hidden` y sin eventos.
- **Carga:** `useSceneArtLoader` precarga y decodifica el fondo limpio, el primer plano y las cinco capas; solo
  entonces se muestra la escena recompuesta. Mientras tanto, o si algo falla, sigue la ilustración original con
  sus hojas SVG (§22.3). Los recortes que copian la escena (resalte de objetos, canto de baldas, vaso, primer plano
  de la pantalla) usan la pintura activa (`SceneArtContext`), nunca una mezcla de las dos.

### 24.3 Movimiento · VERIFICADO

- Validado primero el montaje estático (capturas en 390, 844 × 390 y 1440 con movimiento reducido).
- Guirnaldas: giro de 0,2° sobre su anclaje (≈ 2 px en la punta más lejana, dentro de ±0,8° y 2 px) y 1 px de
  desplazamiento; 17 s con ≈ 62 % de reposo y desfases 0 y −5,1 s. Dos grupos independientes, no un bloque.
- Cortina: solo `cortina-caida`, inclinada desde su borde superior (bajo el nudo, que no se mueve) ≈ 3 px en el
  bajo; 19 s con ≈ 60 % de reposo. No gira la cortina entera ni hay malla.
- Sustituyen a `BreezeLeaves` cuando la escena recompuesta está activa. Pausas de siempre (documento oculto,
  habitación fuera de vista, panel abierto, movimiento reducido); solo `transform` en CSS, sin estado por fotograma.
- Comprobado con las animaciones congeladas en su pico: sin cortes en el nudo ni separación en los anclajes.

### 24.4 Limitaciones

- La cortina no llega al suelo (§24.2). Banda recta del velo nocturno en los paneles altos del arco: ya existía
  con la ilustración original (polígono `EXTERIOR`) y no cambia. Los derivados no usados de §23 siguen en
  `public/images/room-refresh/`. Sin pruebas en iPhone físico ni medición de fps.

### 24.5 Archivos y verificación

`src/scene/sceneMap.js` (`SCENE_REFRESH`), `src/hooks/useSceneArt.js` (nuevo), `src/components/room/RoomRefresh.jsx`
(nuevo), `CozyRoom.jsx`, `RoomHotspots.jsx`, `RoomShelfBooks.jsx`, `TeaDrain.jsx`, `RoomSurfaces.jsx`,
`src/styles/room.css`, `public/images/room-refresh/escena/`; pruebas en `e2e/v128.spec.js` (capas, orden,
decorativas, movimiento solo en las validadas, recortes de la pintura activa, pausas, movimiento reducido y
alternativa si falla un recurso) y la suite completa en los 9 proyectos.

## 25. Comunidad: identidad, opiniones y rincones compartidos (entregas 2 y 3)

Alcance: conectar identidad, reseñas y sala social reutilizando los seis avatares Gouache, en dos entregas
verificables y sin comprometer la biblioteca privada. Estados: **IMPLEMENTADO**, **VERIFICADO** (pruebas de esta
entrega), **PENDIENTE DE DESPLIEGUE** (código y migración listos; falta aplicarlos en el proyecto de Supabase) y
**BLOQUEADO** (con la causa exacta).

### 25.0 Inspección y decisiones de partida

- No existían `SocialHubModal`, Tablet interactiva, «Mi Perfil & Avatar», componente de avatar, reseñas públicas ni
  tablas sociales. La sala social (`SocialRoom`) solo pinta su ilustración y los veleros. La nube es un único
  documento privado por usuario (`libraries`, RLS por usuario, §9ter); no hay migraciones previas aparte de
  `supabase/schema.sql`.
- Avatares: los seis retratos ya separados de «Retratos acogedores de fantasía y lectura.png» en
  `public/avatars/` (PNG nativo y WebP de 256 px), con identificadores estables. No se vuelven a recortar.
- El proyecto es JavaScript (JSX): los módulos nuevos van en JS, en `src/features/social/`,
  `src/features/reviews/` y `src/components/avatars/`. Migraciones en `supabase/migrations/`, aditivas.
- Entorno: sin CLI de Supabase, Docker ni `psql`, y sin `.env.local` (la nube está desactivada en local). Las
  migraciones y sus políticas se ejecutan y prueban en un Postgres 17 real embebido (`@electric-sql/pglite`,
  dependencia de desarrollo) con `auth.uid()` simulado y los roles `anon` y `authenticated`: así se prueban las
  peticiones directas a la API cuenta contra cuenta. Aplicarlas en el proyecto remoto es un paso manual (SQL
  Editor); hasta entonces, la comunidad se muestra como no disponible y la biblioteca sigue igual.
- «Público» = visible para otros miembros autenticados que han activado la comunidad; nada es indexable ni
  accesible sin sesión. Los perfiles empiezan con la comunidad desactivada; el alias lo elige la persona (nunca
  el correo ni el nombre de Google).
- Orden: entrega 2 (identidad, avatares, opiniones y estadísticas) → sus pruebas y `npm run build` → entrega 3
  (seguir, rincones, sillones, club y tropos) → sus pruebas y `npm run build`.

### 25.1 Entrega 2 · identidad y avatares · VERIFICADO

- `public/avatars/catalog.json` (`id`, `label`, `image`, `alt`) = `src/domain/avatars.js` = restricción `avatar_id`
  de `profiles` (una prueba comprueba que coinciden). El perfil guarda solo el `id`.
- «Mi Perfil & Avatar» (`features/social/components/SocialHub.jsx`), abierto desde «Tu cuenta»; es el único perfil
  y el único selector (la tablet de la sala social lo reutilizará). Alias de 2–40 caracteres elegido por la
  persona (vacío al empezar, nunca el correo); «Participar en la comunidad» desactivado por defecto.
- `components/avatars/ReaderAvatar.jsx`: un solo componente (reseñas 40 px, listados 48, perfil 96, sillones
  44–64), círculo con `object-fit: cover`, sombra suave y sin borde extra (los retratos traen marco). Sin avatar,
  medallón de papel con la inicial.
- `features/social/hooks/useCommunity.jsx`: estado único del perfil, cargado bajo demanda (no al abrir la
  habitación) y reiniciado con la caché social al cambiar de cuenta o cerrar sesión.

### 25.2 Identidad de obra · VERIFICADO

- `works`: obra externa solo con referencia verificada de Open Library (`/works/OL…W`, guardada al añadir un
  libro desde Open Library como `book.workRef`) o local con identificador propio. Nunca se fusiona por título; los
  ejemplares conservan sus ids. Al publicar, el libro guarda `workId`.

- 1.31.1 (corrección tras la prueba con dos cuentas): un libro sin referencia de Open Library pero con ISBN pregunta
  una vez a Open Library a qué obra pertenece ese ISBN (`workKeyForIsbn`, `useWorkIdentity`; guarda `workRef` y
  `workRefIsbn`), así dos ejemplares del mismo libro añadidos de forma distinta comparten opiniones. Antes cada
  cuenta creaba una obra local propia y B no veía la reseña de A. Una opinión publicada en una obra local se mueve
  a la compartida con «Actualizar publicación» (se retira de la local). Con un panel abierto se ocultan las flechas
  de las baldas y del panorama, que asomaban por encima del velo en iPhone.

- 1.31.2: bloquear y denunciar piden confirmación en la propia tarjeta; «Mi Perfil & Avatar» lista las personas
  bloqueadas (función `my_blocked_profiles`, migración `20261025110000_entrega2_lista_bloqueos.sql`, porque las
  políticas ocultan el perfil de quien está bloqueado) y permite desbloquear, también con confirmación. Sin esa
  migración aplicada la lista muestra «Lector bloqueado» y desbloquear funciona igual.

### 25.3 Reseñas privadas y publicación explícita · VERIFICADO

- La ficha conserva «Ficha» y «Diario» y añade «Lectores» (hoja plana aparte, cargada bajo demanda).
  `features/reviews/PublishControls.jsx`: «Contiene spoilers», «Publicar en mi rincón» con previsualización de lo
  que se verá, «Actualizar publicación» si cambia el borrador y «Retirar publicación» (la reseña privada queda).
- Copia pública explícita (`publicCopy`): cuartos 1–20 o null, texto ≤ 5.000, spoilers e impresiones 1–5 o null.
  `publicReview.userId` liga la publicación a la cuenta que la hizo. Texto siempre como texto.

### 25.4 Voces de lectores · VERIFICADO

- `features/reviews/ReadersPanel.jsx` con `work_review_stats` (vista del servidor, `security_invoker`): media
  con un decimal, «Primeras valoraciones: N lectores» (< 5), «Todavía nadie la ha puntuado», «Esta historia
  todavía espera su primera opinión», desglose bajo demanda con intervalos `(0,1]…(4,5]` sobre cuartos,
  impresiones con su propio recuento, 20 reseñas por página en orden estable (fecha, id), filtros «Todas» y
  «Lectores que sigo» (activo con la entrega 3), denunciar y bloquear.

### 25.5 Autorización (migración `20261025090000_entrega2_identidad_opiniones.sql`) · VERIFICADO · APLICADA

- RLS por operación en `profiles`, `works`, `public_reviews`, `blocks`, `reports`, `moderators`; `anon` sin
  permisos; perfiles y opiniones visibles solo para miembros autenticados con la comunidad activa y sin bloqueo en
  ningún sentido; una opinión por persona y obra; el autor no cambia autor ni obra ni marca «moderada»;
  `moderate_review` solo para `moderators` (que solo se asignan desde el SQL Editor); denuncias visibles solo para
  quien denuncia y moderación; límite de escritura por trigger en el servidor; funciones `security definer` con
  `search_path` vacío y `execute` restringido.
- Aplicada en el proyecto de producción por el usuario el 2026-10-25 (comprobadas las seis tablas).

### 25.6 Verificación de la entrega 2

- Autorización (`src/features/social/__tests__/entrega2.rls.test.js`, 14 pruebas): la migración ejecutada tal cual
  en Postgres 17 (PGlite) con dos cuentas y `anon`, con peticiones directas.
- Dominio (`entrega2.domain.test.js`): catálogo, cuartos (3,75), copia pública, alias, obra, estadísticas.
- Interfaz (`e2e-community/entrega2.spec.js`, `playwright.community.config.js`, simulador de Supabase): perfil
  persistente sin correo, publicar con previsualización, Lectores con spoiler plegado, retirar, avatar actualizado
  en reseñas, servidor sin migración y cambio de cuenta; en 320, 390, 430, 1440 y WebKit.
- `npm run qa:full` (suite existente) y `npm run build` en verde. Pendiente: prueba con dos cuentas reales en la
  versión desplegada (requiere crear las cuentas el usuario).

### 25.7 Entrega 3 · conexiones y rincones compartidos (1.32.0) · VERIFICADO · MIGRACIÓN APLICADA

Migración `20261025120000_entrega3_conexiones_clubes.sql` (aditiva; añade columnas opcionales a `public_reviews`),
aplicada en producción por el usuario el 2026-10-25 junto con `20261025110000_entrega2_lista_bloqueos.sql`.
Servicio `features/social/services/connections.js`; reglas puras en `features/social/connections.js`.

- **Seguir** (`follows`): relación única por pareja, nunca a uno mismo, idempotente; solo entre miembros sin
  bloqueo; bloquear corta el seguimiento en ambos sentidos (trigger). Seguir no abre ningún dato privado. Se sigue
  desde el perfil autorizado de un lector (`ReaderProfile`), que se abre con el nombre del autor de una reseña o
  con su medallón en el salón. «Lectores que sigo» en Voces de lectores ya funciona.
- **Actividad** (pestaña «Lectores»): solo reseñas publicadas por personas seguidas (las 20 más recientes) y
  novedades de mis clubes; nada de sesiones, horarios ni avances; sin feed infinito.
- **Rincón compartido** (`corners`, pestaña «Mi rincón»): selección voluntaria —hasta 3 libros (solo id, título,
  autor y portada), hasta 3 figuras desbloqueadas, Guardián y lectura actual solo con la opción activada—. El
  servidor comprueba contra la biblioteca de su dueño que los libros existen y que las figuras están en
  `progress.figures.owned`. Ocultarlo revoca la exposición. Visitar un rincón es de solo lectura: no toca la
  biblioteca del visitante ni permite acciones sobre la cuenta visitada.
- **Salón Social** (`scene/socialMap.js`, `SocialSeats.jsx`): botones con la forma de los objetos pintados —tablet
  (Lectores), cuadro «Recomendación de la semana» (Club; el salón no tiene atril y no se añaden muebles) y los dos
  sillones—. Medallones anclados al mapa con la cámara (44–64 px en pantalla dividiendo por `--k`), con alias,
  libro solo si se compartió y tiempo de la sesión; sillones vacíos, vacíos; «+N lectores» si no caben. El
  Guardián expuesto va aparte, sobre el reposabrazos, y abre su ficha informativa (`GuardianCard`).
- **Leer en compañía** (`reading_presence`, pestaña «En la sala», `hooks/usePresence.js`): «Sentarme a leer» con
  «Compartir el libro actual» o «Mostrar solo mi avatar y mi alias». La hora la pone el servidor; se renueva cada
  minuto con la app visible y caduca a los 3 minutos (suspensión, desconexión); se reconcilia al volver. No
  registra páginas ni concede sellos; con el temporizador en marcha muestra su estado (no crea otra cuenta). Sin
  Realtime: se consulta cada 45 s solo mientras alguien mira el salón o la pestaña.
- **Club** (`clubs`, `club_members`, `club_invites`, `club_messages`, pestaña «Club»): crear, obra por título (no
  entra en la biblioteca ni cambia estados), punto de debate textual, invitación por enlace `/#club=<token>` (64
  hex aleatorios, 14 días, revocable, aceptada en el servidor; antes de aceptar no se ve nada del club), miembros,
  mensajes ≤ 2.000 de 20 en 20 con spoilers plegados, editar y borrar los propios, el propietario solo retira,
  denunciar y bloquear, salir, retirar miembros y archivar. Privado: solo miembros.
- **Tropos** (`public_reviews.tropes`, `tropes_none`, vista `work_trope_stats`): catálogo curado de 6 con marca de
  spoiler (los de romance); `null` = no respondió, `{}` con «ninguna encaja» y la selección. Porcentaje =
  seleccionaron / respondieron × 100, siempre con «N de M lectores» y sin porcentaje antes de 5 respuestas; los
  sensibles, ocultos hasta pedirlos.

### 25.8 Verificación de la entrega 3

- Autorización (`entrega3.rls.test.js`, 11 pruebas en Postgres real): seguir sin duplicar ni seguirse, bloqueo que
  corta, rincón solo con libros propios y figuras desbloqueadas y sin campos privados, lectura actual solo con la
  opción, ocultar revoca, presencia con hora del servidor y caducidad, club privado, invitación revocada inútil,
  propietario que solo retira, mensajes ≤ 2.000, archivado sin mensajes, tropos con catálogo y denominadores.
- Dominio (`entrega3.domain.test.js`): tropos, sillones (vacíos, «+N», caducidad), tiempo, rincón y enlaces.
- Interfaz (`e2e-community/entrega3.spec.js`, 320/390/430/1440/WebKit): sillones con 0, 1 y varios participantes;
  sentarse y levantarse sin premios; seguir y dejar de seguir; rincón y su ocultación; tropos; club con enlace,
  revocación y spoilers plegados.
- Requieren dispositivo o servidor real: suspensión y reapertura en Safari de iPhone (la caducidad está probada en
  el servidor y la reconciliación al volver, en código), teclado móvil abierto y la prueba con dos cuentas en el
  proyecto de Supabase tras aplicar la migración.

## 26. Brisa visible y mar vivo (1.33.0)

Solo animaciones: fondo, recursos, colocación, lomos y funciones sin cambios. Estados: **VERIFICADO** (medido en
movimiento en esta entrega) o con su limitación.

### 26.1 Brisa · VERIFICADO

- La amplitud se fija en px CSS de la punta más lejana (`motion.tip` en `SCENE_REFRESH`) y se convierte a ángulo
  con la distancia al anclaje (`motion.reach`) y la escala de la escena (`--k`): el mismo recorrido visible en
  todas las pantallas. Guirnaldas 5 y 5,5 px (≈ 1,1° en un móvil de 390 px; 0,36° en escritorio); son los dos
  únicos grupos separables (no hay grupos pequeños de hojas sueltas). Ráfaga de 10 s: sube, oscila amortiguada y
  reposa ~3 s; la derecha va 0,8 s detrás. Empieza y acaba en 0 (sin saltos). Anclajes fijos.
- Cortina: solo la tela bajo el recogido, inclinada desde su borde superior; el bajo recorre ≈ 6 px CSS, 8,5 s,
  1,4 s después de la vegetación. La parte superior y el nudo no se mueven.

### 26.2 Mar vivo · VERIFICADO

- `SeaRipple` (canvas 2D dentro de `.bay`, en ambas habitaciones): redibuja el agua de la ilustración activa
  (`art.src` / salón) con desplazamiento horizontal de 1–2,5 px CSS (menos al fondo, más en primer término), dos
  ondas de 6,4 s y 10,8 s, muestreo bilineal. Reemplaza el agua dentro de la máscara (no es una copia encima).
- El peso de la deformación es 0 fuera del agua, crece en los 7 px de escena junto al borde y se anula alrededor
  de los veleros pintados (`sea.paintedBoats`): costa, pueblo, montes, marcos y veleros pintados no se mueven.
- Textura y máscara se preparan una vez por resolución (DPR máx. 1,5); cada fotograma solo recorre los píxeles de
  agua a ~30 fps, sin estado de React. En pausa con la pestaña oculta, fuera de la habitación o con un panel; sin
  canvas con movimiento reducido; si algo falla, no se pinta (queda la ilustración). Sin eventos.
- Máscaras de MAIN_ROOM algo ampliadas siguiendo el agua visible (arriba y a la derecha), sin invadir tierra.

### 26.3 Reflejos pintados · VERIFICADO

- Los destellos pasan a ser 7 reflejos alargados de borde suave (elipses con degradado, sin filtros) que aparecen,
  derivan 5 px y se desvanecen en 7–11 s. Color según la hora: `#D9E5DC` (día), `#E8C88E` (atardecer) y
  `#A7BDC7` (noche, con menos opacidad para que el agua no parezca luminosa). Un único sistema de veleros y reflejos.

### 26.4 Verificación

- Medido en movimiento (fotogramas separados 1,7 s): en el agua cambia (diferencia media 3,7–5,7 en 390 Chromium
  y WebKit) y en el pueblo y el velero pintado de la habitación, 0; en el salón, el entorno del velero pintado se
  queda en 0,25–0,30 (borde de la zona protegida y reflejos que pasan). Prueba `mar vivo` en `e2e/v128.spec.js`:
  el canvas cambia mientras anima, no cambia con un panel, no existe con movimiento reducido y no intercepta toques.
  Brisa: duración, ángulo y pausa con panel u otra habitación (prueba de la escena recompuesta).
- Grabaciones de ~15 s en `qa-report/videos-movimiento/` (390 Chromium y WebKit, 1440).
- Limitaciones: con el encuadre actual (que no se ha tocado) la bahía no se ve en escritorio a 1440 × 900 en
  ninguna de las dos habitaciones; no hay medición de fps ni prueba en iPhone físico.

## 27. Librería, ficha, diario y reseñas con texturas gouache (1.34.0)

Solo presentación: no cambian esquemas de Supabase, ids, estados, valoraciones, fechas ni progreso; no hay
importación de Goodreads ni EPUB. La habitación, el salón, la cámara, el mar, las cortinas y el Ático no se tocan.

### 27.1 Texturas

- Originales en `art-inbox/library-refresh/` (no se modifican, no se publican ni se precargan). Derivados WebP en
  `public/art/library-refresh/` con `npm run art:library` (`scripts/prepare-library-art.mjs`, sharp como
  dependencia de desarrollo), que escribe también `manifest.json` (archivo, tamaño original, recorte, tamaño final,
  escala, alfa, bytes y medidas de la balda y de la carta). Nunca se amplía.
- `panel.webp` 1024² (fondo de madera; las costuras no son continuas, así que se usa un tramo por balda, sin
  repetir, con la transición tapada por la balda), `plank.webp` 1536 × 142 (recortada; superficie superior hasta la
  línea de luz en y = 52, base de los libros en y ≈ 34, tres cortes con remates de 44 px), `ivy.webp` 336 × 512,
  `journal.webp` 768² (casi continua: se repite) y `letter.webp` 820 × 1024 (bordes de barba; nueve cortes de
  40 px). El cuerpo con alfa 224–254 se vuelve opaco; los bordes conservan su alfa. Total ≈ 192 KB.
- Se cargan solo con la librería o la ficha abiertas (fondos CSS), y el service worker las guarda al pedirlas, no
  al instalar. Si falta una, queda el color de respaldo del token.

### 27.2 Tokens

`--lib-paper #FAF5E8`, `--lib-paper-2 #F8F1E1`, `--lib-ink #2C1E14`, `--lib-ink-soft #6A5847`, `--lib-brass
#C59B27`, `--lib-terracotta #B86343`, `--lib-sage #69764F`, `--lib-wood #79583D`, `--lib-wood-dark #59432F`.
Cormorant (títulos), Lora (texto, 16 px / 1,55), Caveat (solo notas breves), JetBrains Mono (contadores). Campos
≥ 16 px; títulos de panel `clamp(26px, 6vw, 36px)`. Sombras mates, sin marcos apilados, sin filtros sobre
portadas, sin texto girado. Capas decorativas con `pointer-events: none` y `aria-hidden`.

### 27.3 Cabecera compacta

Filas: «Volver» + nombre de la biblioteca / buscador («Título o autor…», sin autofocus) + «Añadir libro» /
pestañas de papel Todos · Leyendo · Pendientes · Terminados (texto horizontal) / Escaparate–Lomos + «Herramientas»
(menú con «Libro al azar», «Pedir una recomendación» y «Vitrina de Figuras»). Separación 8 px, margen 12 px en
móvil, controles ≥ 44 px, sin altura fija (≈ 190–220 px a 390 px; en 320 px el buscador y el botón pueden ir en
dos filas). En escritorio las filas se agrupan en dos. Los filtros nunca quedan encima de los recuerdos. Sin cita
genérica en la cabecera.

### 27.4 Estantería modular

Cada balda es un módulo con su tramo de panel de madera (sombra interior `inset 0 12px 22px rgb(44 30 20 / .2)`)
y su tabla (`border-image` en tres cortes, 30 px de grosor en móvil, sombra `0 5px 10px rgb(44 30 20 / .2)`);
los libros apoyan en la superficie superior. Las baldas crecen con su contenido; no hay una textura estirada.
Libros: las 8 ediciones y las portadas originales, menos adornos repetidos; `perspective: 1000px` y como mucho
`rotateY(-5deg)` en Escaparate; portada de `clamp(96px, 28vw, 140px)` de ancho en móvil, separación ≥ 16 px,
alineados abajo; sombra de contacto ≤ 0,24; scroll horizontal nativo; mini-figuras de 34 × 34 en el canto.

### 27.5 Recuerdos y hiedra

Tras la primera balda, un único recuerdo destacado: el último libro terminado con fecha fiable, su valoración y la
cita solo si el usuario la clavó; «Ver más recuerdos» despliega los demás. Sin libros terminados ni cita, no se
muestra nada (nada inventado ni bloques vacíos). Hiedra como mucho dos veces (88–120 px), nunca sobre controles;
balanceo ≤ 0,8° y ≤ 2 px en 16 s desde el tallo, solo cuando la librería está abierta y visible; sin movimiento
con movimiento reducido.

### 27.6 Ficha del libro

Orden: ex-libris compacto (sello de 48 px, nombre editable) → portada 72–96 px + título y autor → estado →
progreso → «Registrar lectura» (el mismo `ReadingEntryForm`; si termina el libro, abre la misma reseña de
terminar, que al cerrar vuelve a la ficha) → valoración y favorito. «Detalles de mi edición» (plegado): total de
páginas, total desconocido, seguir por páginas o porcentaje, velocidad y edición. Valoración: estrellas + número,
cuartos, ajuste fino al activarlo, teclado de 0,25 en 0,25. Papel `journal.webp` con sombra
`0 10px 28px rgb(44 30 20 / .24)`, sin marcos apilados.

### 27.7 Diario

Cuaderno de entradas fechadas construido con lo que ya existe: sesiones del registro de lectura, citas subrayadas
y la reseña al terminar. Fechas en Caveat 20 px, texto Lora 16 px / 1,6, 20 px entre entradas, separadores de
1 px. Las citas conservan su id de color, muestran el significado del usuario y una marca lateral (nunca solo
color), en un papel algo distinto, seleccionables, con página solo si existe. Vacío: «¿Qué te gustaría recordar
de esta historia?» con «Escribir mi primera anotación».

### 27.8 Reseñas como cartas

Cabecera «Voces de lectores» con la media a un decimal y estrella; con una sola valoración, «Una primera voz para
esta historia». Desglose e impresiones dentro de «Cómo se ha sentido esta lectura» (nombre, valor, extremos de la
escala y número de respuestas). Cada reseña es una carta con `letter.webp` en nueve cortes (sin
`background-size: 100% 100%`), 18 px de relleno en móvil y 24 px en escritorio, sombra `0 3px 10px rgb(44 30 20 /
.12)`, sin giro, altura natural.

### 27.9 Paneles

Con cualquier panel abierto las flechas de habitación no se montan (estado central `panel`) y las de las baldas se
ocultan. Botón de cierre en pestaña de papel ≥ 44 × 44 dentro de las zonas seguras, nombre «Cerrar». Panel de
100dvh como máximo con zonas seguras, un único scroll y sin scroll horizontal.

## 28. Biblioteca mediterránea artesanal: profundidad, cuaderno, diario, señales y huellas (1.35.0)

Dirección visual de las maquetas de `docs/design/references/` (gouache editorial 2D mate, madera cálida, papel
crema, cintas de tela, latón envejecido). Jerarquía: requisitos del encargo → maquetas → capturas actuales (funciones
que conservar) → código histórico (perspectiva). Las maquetas traen datos ilustrativos: no se copian sus cifras,
textos, portadas ni retratos. El ZIP 1.15.0 es solo referencia histórica; no sustituye código.

### 28.0 Estado verificado antes de empezar

- Git limpio en `a1468a5` (1.34.0 desplegada); sin versionar: `art-inbox/`, `assets-source/`, `material-diseno/`.
  No existe `AGENTS.md`; las reglas viven en este SPEC y en la memoria del proyecto.
- Puntos de entrada del ZIP y su equivalente actual: `ShelfView.jsx`, `BookItem.jsx`, `AddBookCard.jsx` (mismos
  archivos en `src/components/shelf/`), `BookDetailModal.jsx` (`src/components/book/`, raíz `.book-sheet`),
  `ReadingCalendar.jsx` (`src/components/panels/`, `CalendarApp` dentro del portátil), `RoomHotspots.jsx`
  (`src/components/room/`, montado por `CozyRoom.jsx`), `useLibrary.jsx` (`src/state/`), `shelf.css`, `book.css`,
  `stationery.css`, `typography.css` (`src/styles/`, sobrescritos al final por `library-refresh.css` y
  `library-sheet.css`).
- Persistencia real: `localStorage` `bookshelf:v1` (estado versionado en `useLibrary.jsx`) + copia en Supabase
  (`libraries`) con `state/cloudSync.jsx`. Comunidad real en Supabase (migraciones de §25: `profiles`, `works`,
  `public_reviews`, `blocks`, `reports`, `moderators`, `follows`, `corners`, `reading_presence`, `clubs`…), con RLS
  probada con PGlite (`src/features/social/__tests__/`). No hay roles de equipo ni premios en el servidor: el único
  rol con permisos es `moderators` (asignado desde el SQL Editor).
- Geometría anterior a 1.34.0 (commit `1004f10`, `shelf.css` y `editions.css`): `.book3d { perspective: 900px;
  perspective-origin: 50% 30% }`, `.book3d__body { rotateY(-24deg) rotateX(6deg) }`, al pasar
  `rotateY(-8deg) rotateX(4deg) translateY(-8px) translateZ(14px)`; cantos pintados `rotateY(-36deg) rotateX(6deg)`
  (al pasar `-44deg / 4deg`); e-reader y audiolibro usan la misma caja con sus propias caras; sombra interior de
  la tabla de arriba `inset 0 22px 28px -10px rgb(15 8 0 / .75)`; tabla de 26 px con luz superior y sombra
  `0 12px 16px -6px rgb(0 0 0 / .65)`. La 1.34.0 lo aplanó a `perspective: 1000px` y `rotateY(-5deg)`.

### 28.1 Recursos

`npm run art:design` (`scripts/organize-design-assets.mjs`) copia de `material-diseno/` sin mover ni sobrescribir,
comprueba formato real, dimensiones, alfa y duplicados (md5), mide la alineación de las variantes del rincón y genera
WebP de producción. Inventario y estados en `docs/design/asset-manifest.md`; faltantes en
`docs/design/pending/README.md`. Rutas de la app: `/assets/profile/rincon-{dia,lluvia,noche}-{768,1536}.webp`,
`/assets/memories/farol-256.webp`. Los PNG originales se conservan junto a sus derivados.

### 28.2 Matriz de funciones (ninguna desaparece)

| Función | Antes (1.34.0) | Después (1.35.0) |
| --- | --- | --- |
| Volver a la habitación | Cabecera, «Volver» | Igual |
| Nombre de la biblioteca y propietario | «La biblioteca junto al mar · de X» | «Mi biblioteca · de X» |
| Buscar y Añadir libro | Fila de búsqueda | Igual |
| Filtrar por estado | Pestañas Todos/Leyendo/Pendientes/Terminados | Cintas de tela Todos/Leyendo/Pendientes/Leídos |
| Escaparate / Lomos | Interruptor | Igual |
| Libro al azar, recomendación, Vitrina | «Herramientas» | Igual |
| Ordenar arrastrando, menú de edición (clic derecho) | Baldas | Igual |
| Placa de balda (filtrar por esa balda) | Rótulo de papel | Placa de latón colgada de dos anillas, con contador |
| Recuerdos (último terminado, cita clavada, más) | Banda crema tras la 1.ª balda | Tablón dentro del mueble, plegable |
| Mini-figuras de saga | Canto de la tabla | Igual |
| Ficha: progreso, registrar, valoración, favorito, edición, sinopsis, quitar | `.book-sheet` | Igual, dentro de `NotebookShell` |
| Diario del libro: sesiones, citas, reseña al terminar | Pestaña Diario | Igual + editar/borrar con confirmación, menú de opciones y borrador |
| Personalizar colores de cita | `QuoteMeaningsEditor` | Igual |
| Mi reseña y publicar/retirar | Diario + `PublishControls` | Hoja de carta con clip, firma y estado |
| Voces de lectores, filtros, spoilers, denunciar, bloquear | Pestaña Lectores | Igual |
| Calendario, sesiones, estadísticas, reto, cita del día, misiones | Portátil | Igual; «Calendario» pasa a «Mi diario» (Hoy · Calendario · Notas) |
| Acceso a cada objeto de la habitación | Hotspots + «Mostrar guías» | Igual + señales físicas permanentes |
| Perfil de otro lector | `ReaderProfile` (lista) | Rincón ilustrado + lecturas + destacados + colecciones |

### 28.3 Sistema visual compartido

Tokens en `library-refresh.css` (`--paper #F8F1E1`, `--paper-shade #E8D8B9`, `--ink #2C1E14`, `--ink-muted
#6B5948`, `--terracotta #A84F34`, `--sage #78866B`, `--bay #6F8793`, `--brass #B69758`, `--wood #B78049`,
`--wood-deep #49301F`); los `--lib-*` de 1.34.0 pasan a ser alias para no duplicar sistemas. Contraste medido en
§28.12. Primitivas reutilizables (`src/components/primitives/`): `PaperSurface`, `NotebookShell`, `FabricTab`,
`HangingPlaque`, `WaxSeal`, `AnnotationCard`, `ReviewLetter`, `ReaderAdornment`. Textos, fechas, cifras, estrellas e
iniciales en HTML/SVG. Movimiento: placas `transform-origin: 50% 0` con balanceo 0 → −2° → 1° → 0 en 420 ms al
interactuar; botones `translateY(1px)` 120 ms; notas `opacity 0→1, translateY(4px→0)` 180 ms; nada continuo;
`prefers-reduced-motion` lo anula. Cinta en V con `clip-path: polygon(0 0,100% 0,100% 100%,50% 88%,0 100%)` solo en
la capa visual.

### 28.4 Librería con profundidad

Cámara frontal (sin `rotateX/rotateY` del mueble). Se recupera la geometría de §28.0 en cada libro (perspectiva
900 px, origen 50 % 30 %, −24°/6°, cantos −36°; e-reader y audiolibro conservan su caja) y la profundidad del hueco:
fondo más oscuro, laterales interiores, sombra de la tabla superior, superficie superior de la tabla donde apoyan las
bases, canto frontal pintado (`plank.webp`) y sombra de contacto. Cabecera compacta con cintas de tela; recuerdos en
un tablón dentro del mueble (nota, postal, «Ver más recuerdos»), plegable y recordado por dispositivo; placas de
latón mate colgadas de dos anillas en el canto, con espacio reservado bajo la tabla para no tapar libros ni la balda
siguiente.

### 28.5 Cuaderno y ficha

`NotebookShell`: una página en móvil, encuadernación discreta a la izquierda, cantos de hojas a la derecha, papel
limpio en el centro (sin marcos por párrafo). Pestañas Ficha · Diario · Lectores. La ficha mantiene todo lo de
§27.6.

### 28.6 Diario general (Hoy · Calendario · Notas)

En el portátil, la app «Calendario» pasa a «Mi diario». Hoy: fecha editorial, selector si hay varias lecturas
activas, portada pequeña, progreso y «Registrar lectura» (el mismo `ReadingEntryForm`), «Lo que me llevo de estas
páginas» (se guarda como anotación del libro, sin sumar páginas), «Mi semana entre páginas» (días con registros
reales) y últimas anotaciones. Calendario: el `CalendarApp` existente. Notas: todas las anotaciones (las citas de
los libros) con búsqueda, filtro por libro y por color/categoría, abrir en su ficha (pestaña Diario), editar y
borrar con confirmación. Una sola fuente de datos (`readingLog` y `book.quotes`).

### 28.7 Anotaciones

Cronología por fecha; registros compactos; anotaciones como recortes con marca de color + etiqueta del usuario;
página, categoría, editar y menú (ver como carta, borrar con confirmación). Nueva anotación: texto, página (sin
límite por el progreso y sin sumar páginas), colores con etiqueta e indicador de selección, «Personalizar
colores», «Guardar anotación». Borrador por libro en `sessionStorage`; «Guardado» solo tras confirmar que el estado
incluye la nota; si falla, se conserva el texto y se ofrece reintentar.

### 28.8 Mi reseña y lectores

Hoja de carta con clip pequeño, valoración, texto, firma (nombre del ex-libris), «Contiene spoilers» y estado
inequívoco: «Privada», «Cambios sin publicar» o «Publicada». Sello animado solo tras un guardado o publicación
confirmados. Lectores: como §27.8; con pocas valoraciones «Primeras valoraciones».

### 28.9 Señales de la habitación

Placas permanentes (HTML sobre la escena, ancladas a coordenadas de la imagen): «Mi biblioteca», «Colección»,
«Mi lectura», «Calendario», «Tiempo de lectura», «Ambiente», «Mis sagas». Son `aria-hidden` y sin eventos de
puntero: el control es el objeto (hotspot) entero, que queda debajo y recibe el toque. No tapan libros ni figuras. «Lectores» no se añade: el salón social no
tiene objeto en esta habitación. Ayuda inicial breve, descartable, recuperable desde «Guías», que destaca solo la
biblioteca.

### 28.10 Perfil social, recuerdos, colecciones y distinciones

Migración aditiva `20261025150000_huellas_rincon.sql`: `corners` gana `memories` (≤ 3 expuestos, objeto del
catálogo, libro y dedicatoria), `last_book`, `next_book` (elegida explícitamente) y `signature_books` (≤ 5 con
frase opcional); `profiles` gana `adornment_id` (preferencia estética, lista cerrada, sin permisos); tablas
`collections` (individuales; lectura de comunidad solo si `visible`; escritura del dueño) y `distinctions`
(premios y roles visibles; SIN políticas de escritura: solo desde el SQL Editor; lectura de comunidad). Moderación
se muestra a partir de `moderators` mediante una función de solo lectura. No hay umbrales de antigüedad, ganadores
ni desafíos: ningún premio aparece hasta que se asigne de verdad. Guardar una colección no añade sus libros a
pendientes; «Añadir a pendientes» es por libro y guarda en privado la procedencia (`book.savedFrom`). Sin feeds,
avisos, postales ni mensajes automáticos.

### 28.11 Criterios de aceptación y pruebas

- Capturas reales a 360 × 800, 390 × 844, 430 × 932 y 1440 × 900 de librería, ficha, diario, habitación y perfil.
- Libros apoyados y sin recortes, placas sin solapes, nada fuera de pantalla, sin scroll horizontal.
- Registrar lectura una sola vez; notas crear/editar/filtrar/borrar; valoración y favoritos; publicar/editar/
  retirar; spoilers, bloquear, denunciar; permisos de perfil entre dos cuentas y anónimo (PGlite); recarga sin
  pérdida ni duplicados; teclado, foco y movimiento reducido; WebKit de Playwright (no iPhone real).
- `npm run lint`, `npm run build`, `npm test`, Playwright (local y comunidad).

### 28.12 Contraste medido (WCAG 2.x)

| Combinación | Ratio | Uso permitido |
| --- | --- | --- |
| `--ink` sobre `--paper` / `--paper-shade` | 14,32 / 11,48 | texto |
| `--ink-muted` sobre `--paper` / `--paper-shade` | 5,93 / 4,75 | texto secundario |
| `--paper` sobre `--terracotta` | 4,87 | texto de botón primario (≥ 4,5) |
| `--paper` sobre `--wood-deep` | 10,81 | texto sobre madera oscura |
| `--ink` sobre `--brass` | 5,80 | texto de placa de latón |
| `--ink` sobre `--wood` | 4,76 | solo texto ≥ 18 px |
| `--sage`, `--bay`, `--wood`, `--brass` sobre papel | 3,44 / 3,35 / 3,01 / 2,47 | decorativos; nunca texto |
| `--sage-ink #4F5A43` / `--brass-ink #6E5524` sobre papel | 6,49 / 6,25 | variantes de texto de esos tonos |

### 28.13 Estado de la entrega 1.35.0

Terminado y probado:
- Recursos organizados (§28.1) con manifiesto y comprobaciones; derivados WebP (≈ 524 KB en total, solo se piden
  al abrir un perfil) y el service worker los guarda al pedirlos.
- Tokens y primitivas (§28.3): `PaperSurface`, `NotebookShell`, `FabricTab`, `HangingPlaque`, `WaxSeal`,
  `AnnotationCard`, `ReviewLetter`, `ReaderAdornment` en `components/primitives/` + `styles/primitives.css`.
- Librería (§28.4) en `styles/library-depth.css`: geometría de §28.0 recuperada en cada edición, laterales,
  sombra de la tabla superior, superficie y canto, placas de latón con dos anillas bajo la tabla (espacio
  reservado), cintas Todos · Leyendo · Pendientes · Leídos, tablón de recuerdos plegable (recordado por dispositivo
  en `bookshelf:memories-folded`).
- Ficha como cuaderno (§28.5), estimación y velocidad dentro de «Detalles de mi edición».
- Anotaciones (§28.7) en `book/Annotations.jsx`: editar (`updateQuote`), menú, borrar con confirmación, borrador en
  `sessionStorage` (`bookshelf:note-draft:<id>`), «Guardado en este dispositivo» solo tras `persistNow()`, reintento
  que no duplica.
- Mi reseña como carta (§28.8) con clip, firma y estado («Privada», «Publicada · con cambios sin publicar»,
  «Publicada en tu rincón»).
- «Mi diario» (§28.6) en `panels/DiaryApp.jsx` (`domain/diary.js`).
- Señales de la habitación (§28.9) en `room/RoomSigns.jsx`, con desplazamiento automático para no quedar fuera del
  encuadre y ayuda inicial (`bookshelf:signs-hint-done`, vuelve a aparecer al terminar «Guías»).
- Perfil (§28.10): `CornerScene`, `ReaderProfile` reordenado, `HuellasEditor` y `CollectionsEditor`; servicio
  tolerante a la falta de migración (`services/huellas.js`); lógica pura en `features/social/huellas.js`.

Migración: `20261025150000_huellas_rincon.sql` probada con PGlite y aplicada en producción por el usuario
(SQL Editor, 2026-10-25).

Pendiente o fuera de alcance (declarado, no simulado):
- Ilustraciones de barquito, planta, tintero y mapa, de los cinco adornos y de las seis distinciones: hoy son SVG
  provisionales (ver `docs/design/pending/README.md`). No se declara fidelidad visual final con ellos.
- Roles «Creadora» y «Equipo» y premios semanal/mensual: sin reglas ni umbrales en el servidor; se asignan a mano
  en `distinctions` desde el SQL Editor. Ningún premio se muestra hasta asignarlo.
- «Mes de lectura» del perfil: no hay un resumen mensual público en el servidor; no se muestra.
- Doble página del cuaderno en escritorio: se mantiene una página (no mejora la lectura con el contenido actual).
- Pruebas en WebKit de Playwright; no en un iPhone real.

### 28.14 Corrección de fidelidad visual (1.35.1)

Pasada solo visual y responsive sobre la 1.35.0, sin cambios en funciones, datos ni permisos. Detalle por pantalla
(referencia, diferencia, corrección y resultado) en `docs/design/visual-corrections.md`.
- Perfil: avatar de 96 px con nombre y «Seguir/Siguiendo» compacto al lado; bloquear dentro de «Más opciones». El
  adorno no se pinta hasta tener su ilustración: el hueco ya está preparado (120 % del avatar, solape de 12 px,
  altura reservada). Última/actual/próxima con tres huecos de portada 2:3 idénticos (`Cover`, cubierta tipográfica
  de respaldo; en el perfil propio, la lectura actual sale del libro local).
- Estrellas: relleno perceptual (`visualFill`) para que un cuarto se vea como un cuarto.
- Librería: veladura mate sobre `panel.webp`, cabecera sin desbordes, recuerdos en una fila compacta (nota + postal,
  «Ver más · N»), placas más pequeñas.
- Ficha: ex-libris y cabecera compactos, estado en tres columnas, «Página N de T» y −10 · −1 · +1 · +10 en filas
  separadas, costura de hilo en la encuadernación.
- Habitación: señales sujetas a su objeto (cadena del astrolabio, pestaña en el portátil, etiqueta de infusión con
  cordel, tela junto a los auriculares, cinta desde el libro), papel cálido, sin tres líneas. No se montan con un
  panel abierto.
- Comunidad: tipo «Club de lectura» separado del nombre del club; actividad en cartas con portada, obra, autor,
  persona, estrellas y extracto; filas de lectores compactas.

## 29. Recursos mediterráneos: cabecera, cuaderno de cuero y módulo de balda (1.36.0)

Solo presentación: no cambian datos, permisos ni lógica. Referencias: las maquetas de `docs/design/references/`.
Las láminas 157099/157115/157118/157124 citadas en el encargo NO estaban en el disco ni adjuntas: la biblioteca
sigue la descripción escrita del encargo; el diario general, `diario-general-hoy-maqueta.png`; el cuaderno del
libro, `ficha-diario-resena-lectores-maqueta.png`; del club no hay referencia.

### 29.1 Recursos

`npm run art:mediterranean` (`scripts/prepare-mediterranean-art.mjs`) genera desde `material-diseno/`:
- `/assets/library/header-{800,1600}.webp` (2021 × 778, 2,6:1, sin recortes) de «Rincón mediterráneo entre libros
  y mar».
- `/assets/ui/notebook-frame.webp` (838 × 224) de «Marco de cuero con página en blanco»: alfa saneada (halo rojo
  eliminado), recorte a su caja y recomposición tira superior (30) + un periodo de anilla (106) + tira inferior (88),
  para pintarlo en nueve regiones (`30 60 88 96 fill`, vertical `round`): esquinas intactas, anillas enteras.
- `/assets/library/shelf-module.webp` (1612 × 884) de «Compartimento de madera mediterránea vacío»: sin el
  travesaño superior ni el resto de la balda inferior, para apilar módulos sin duplicar travesaños;
  `shelf-crossbar.webp` (solo sobre el primero) y `wood-light.webp` (canto, para la franja de herramientas).
  Medidas en `public/assets/library/manifest.json`.

### 29.2 Biblioteca

Cabecera ilustrada (proporción del recurso, `max-height: 300px`) con el cartel de latón «Mi biblioteca» colgado
sobre la pared, subtítulo «La biblioteca de …» y «Volver al rincón» arriba a la izquierda. Franja de madera clara
con vista (Escaparate/Lomos) y Herramientas como iconos con nombre accesible, «Añadir libro» en terracota, el
buscador y las cintas de filtro. Recuerdos en un módulo poco profundo: etiqueta, papel con la cita clavada y sello
(o el último libro), fotografía con la portada del último terminado. Baldas: módulo en nueve regiones (laterales y
fondo del recurso), libros sobre su superficie con sombra de contacto, etiqueta de papel con el título en el canto,
cartel de sección colgando del frente y «Añadir un libro» como tarjeta de papel.

### 29.3–29.6 Cuaderno compartido

`NotebookShell` pinta el marco de cuero (§29.1) y las capas de la 1.35 dejan de dibujarse. Se usa en la ficha del
libro (Ficha · Diario · Lectores), en «Mi diario» del portátil (cabecera «Mi diario», subtítulo, «Volver», pestañas
de tela Hoy/Calendario/Notas, fecha con apunte a tinta, lectura de hoy, «Lo que me llevo de estas páginas» con la
última nota real y «Escribir una nota», semana, últimas anotaciones, separadores con ramita, sello de lacre) y en la
vista de un club. Anotaciones con clip de latón; cartas de lectores con clip y «Denunciar / Bloquear» dentro del
menú de opciones (cerrado hasta que se pide).

Club: el modelo de datos actual NO tiene capítulos, encuentros ni avance por capítulo (tablas `clubs`,
`club_members`, `club_invites`, `club_messages`). Las pestañas Conversación/Capítulos/Encuentros, el aviso del
próximo encuentro y la protección por capítulo de la lámina 157124 no se implementan: no se inventan datos.

## 30. Fidelidad con las maquetas aprobadas (1.37.0)

Referencias definitivas (copias en `docs/design/references/`): `biblioteca-junto-al-mar-maqueta.png`,
`habitacion-senales-2-maqueta.png`, `cuaderno-libro-tres-vistas-maqueta.png`, `diario-general-hoy-2-maqueta.png`,
`perfil-rincon-huellas-2-maqueta.png`, `salon-rincon-voces-2-maqueta.png` y `cuaderno-club-maqueta.png`.
Solo presentación; los datos, permisos y la lógica no cambian.

### 30.1 Recursos

`npm run art:mediterranean` genera además (de `material-diseno/`): `plaque-chains.webp` (placa con cadenas cortas,
tres cortes de 92 px), `plaque-hanging.webp` (placa ornamentada con cadenas largas), `plaque-brackets.webp` (placa con
escuadras, cortes de 86 px), `plaque-strap.webp` (placa con correas de cuero) y `bookmark-olive.webp`
(marcapáginas de cuero oliva y latón), en `/assets/ui/`.

### 30.2 Biblioteca

Cartel de papel con marco de latón y ramitas, subtítulo «La biblioteca junto al mar» con ola, «Volver al rincón»
como texto. Herramientas como baldosas de icono (Escaparate, Lomos, Libro al azar, Pedir una recomendación,
Vitrina de Figuras; nombres accesibles), «Añadir libro» terracota, buscador a todo el ancho, filtros como etiquetas
rectas con icono y color (Leyendo terracota, Leídos salvia). Recuerdos: etiqueta con chincheta y «Ver más · N»,
papel con la cita y sello, polaroid con la fecha a mano. Libros casi frontales (−12°, cantos pintados −18°).
Placas de sección con el latón de cadenas y ramitas; la balda de pendientes se titula «Tus próximas historias».

### 30.3 Habitación

Colección y Mi biblioteca: placa con cadenas; Mis sagas: placa ornamentada colgada del astrolabio; Mi diario (antes
«Calendario»): placa con escuadras en el portátil; Tiempo de lectura: etiqueta de latón con cordel; Ambiente: placa
con correas sobre la diadema; Mi lectura: marcapáginas de cuero que sale del libro.

### 30.4 Cuaderno del libro

«Mi diario de lectura» con ramita, filtros en píldora, fecha con filete, anotaciones con banda de color y clip.
Mi reseña: pinza de latón, doble filete, estrellas (el valor queda para lectores de pantalla), firma con pluma y
tira final «Tu reseña, con tu propia voz.» con sello. Lectores: media y titular en línea, «Cómo se ha sentido esta
lectura» como fila con flecha, cartas con clip a la derecha, estrellas junto al nombre, franja de spoilers.

### 30.5 Perfil

Avatar solapado con la escena, placa «Recuerdos de lectura» en la mesa, trío con separadores y la tarjeta «Una
historia que se quedó» con el primer recuerdo real.

### 30.6 Club

Conversación como mensajes (autor, hora y burbuja; los propios en salvia) y compositor redondeado. Capítulos,
Encuentros, aviso de encuentro, avance por capítulo, reacciones y «mensajes nuevos» siguen sin datos en el servidor:
no se muestran.

### 30.7 Corrección visual acotada (1.38.0, `styles/fix-138.css`)

- Habitación: el texto de cada placa ilustrada va en un contenedor común con la imagen, centrado en la superficie
  útil medida sobre la silueta visible (colgante 54–90 % del alto; correas 15–85 % del ancho; marcapáginas 12–61 %
  del alto, en vertical). Las placas ya no se desplazan para caber: siguen ancladas en px de la ilustración (que
  escala y recorta con el escenario). «Mi lectura» sale del canto de la página izquierda.
- Biblioteca: «Volver al rincón» en su propia fila y el cartel debajo; filtros compactos (sin icono ≤ 400 px); el alto
  de balda en móvil se calcula para que quepan tres libros con sus etiquetas en el hueco útil del módulo.
- Ficha: el carrusel «Leyendo ahora» deja de estar posicionado sobre la antigua doble página (`position: absolute`
  + `translateX(-50%)` de la 1.2x): ocupa el ancho del contenido y se desplaza dentro de sí mismo.
- Mi diario: menos relleno en la ventana y marco más fino; «Volver» en su fila; mes en una línea con controles de
  44 px; calendario de siete columnas `minmax(0, 1fr)` con celdas 4:5; reserva inferior para el dock.

### 30.8 Diario sin desbordes y placas legibles (1.38.1)

- Diario: en Safari/WebKit el `<select>` de la lectura con un título largo y las palabras sin espacios ensanchaban el
  cuaderno y el portátil (906 px a 390). El desplegable ocupa el ancho disponible, el texto se parte y los
  contenedores permiten encoger; el título del libro en Notas parte línea. Verificado en WebKit y Chromium (Hoy,
  Calendario y Notas a 360/390/430, sin elementos más anchos que la pantalla).
- Placas: «Mi lectura» centrada en la zona lisa del latón (16–59 % del alto) y a lo largo del marcapáginas. Las
  placas que el recorte deja en el borde se deslizan hacia dentro lo justo para leerse y pulsarse (8 px de margen),
  sobre la parte visible de su objeto; se recalcula al mover la cámara.

## 31. Piezas sueltas, nombres de la habitación y recursos del perfil (1.39.0)

Ampliación del prompt maestro de recursos (`BookShelf-ampliacion-prompt-maestro-recursos`), sobre lo ya hecho.
Inventario y referencias: `docs/design/asset-map.md` (y `asset-manifest.md` para lo anterior).

### 31.1 Recursos

`npm run art:pieces` (`scripts/prepare-bookshelf-pieces.mjs`) recorta a la silueta visible (alfa < 10 → 0, margen 2 px)
y escribe WebP en `public/assets/bookshelf/{notebook,reading-corner,profile/adornments,profile/badges}/` con
`manifest.json`. Siete piezas nuevas, cuatro recuerdos, cinco adornos y seis distinciones; los originales no se tocan.

### 31.2 Habitación: nombres con «Guías» (decisión posterior que prevalece sobre el documento)

Las placas de navegación de la habitación se sustituyen por un icono y un nombre en una etiqueta de papel que solo
aparecen con «Guías» activadas (y reemplazan a las insignias de icono de las guías). Con las guías desactivadas la
escena queda limpia; los reflejos suaves sobre cada objeto están PENDIENTES de sus máscaras, que se prepararán sobre
el fondo original actual. Los nombres son `aria-hidden` y sin eventos de puntero; se deslizan hacia dentro si el
encuadre los corta. Las placas siguen en otras secciones (rótulos de balda de la biblioteca).

### 31.3 Perfil

Los recuerdos barquito, planta, tintero y mapa usan sus ilustraciones (límite de tres y vínculos sin cambios). El
adorno (`ReaderAdornment`) es la ilustración elegida, al 125 % del avatar, solapando 12 px su borde y con altura
reservada. Las distinciones se muestran con su ilustración a 28 px y nombre accesible; solo las asignadas en el
servidor (`distinctions`, `moderators`), nunca seleccionables.

### 31.4 Piezas decorativas

Sobre salvia en el Sobre del día (la cita real encima de la hoja), hornacina de madera en Misiones y Guardián (la
figura real apoyada en su base), pila de libros en el Reto anual, libro abierto con «Cada página cuenta.» en
Estadísticas, ramita botánica en los títulos del cuaderno, pinza de latón en Mi reseña y pestaña textil salvia bajo
el cuaderno del libro. Ninguna intercepta toques ni fija valores.

### 31.5 Pendiente

Máscaras de reflejos de la habitación; las diez pantallas recientes del portátil y del perfil (calendario con detalle,
sesiones, perfil y avatar, lectores, Mi rincón) solo reciben las piezas decorativas, no una recomposición completa;
salón; capítulos y encuentros del club (sin datos en el servidor).

## 32. Mi diario según sus maquetas: Hoy y Calendario (1.40.0)

Referencias: `docs/design/references/diario-general-hoy-2-maqueta.png` (Hoy) y `calendario-detalle-dia-maqueta.png`
(Calendario con el detalle del día; copia de la lámina aprobada). Estilos en `styles/diary-notebook.css`.

### 32.1 Armazón (móvil ≤ 760 px)

Con la app «Mi diario» abierta, el portátil no se pinta (barra de menú, ventana, base): el cuaderno de cuero ocupa la
pantalla sobre la madera de la estantería, con la página como única zona de scroll, y la navegación entre apps es una
fila de seis pestañas de papel bajo el cuaderno (Calendario, Estadísticas, Sesiones, Reto, Misiones, Citas; el nombre
completo queda como nombre accesible). Escritorio conserva el portátil.

Ambigüedad documentada: la cabecera de las dos maquetas no coincide (Hoy: «Volver» + «Mi diario» + subtítulo +
pestañas; Calendario: «BookShelf» + ✕ + pestañas + «Mi diario»). Se usa una sola cabecera (la de Hoy) en las tres
vistas para que las pestañas no cambien de sitio; «Volver» cierra el portátil.

### 32.2 Hoy y Calendario

Hoy: fecha grande con apunte a tinta, lectura de hoy (portada, título, autor, «Leyendo», página, barra, «Registrar
lectura»), «Lo que me llevo de estas páginas» (última nota real o vacío + «Escribir una nota», que abre el formulario),
semana con el lema «Cada momento de lectura cuenta.» (el recuento va en el nombre accesible), últimas anotaciones en
una línea (el libro, en el nombre accesible) y sello al final.

Calendario: mes en una línea con flechas sin marco, días de la semana abreviados (Lun…Dom), días del mes anterior en
gris, celdas de papel con número, portada y páginas con llama, hoy en terracota; el resumen del mes, en una línea bajo
la cuadrícula; la leyenda de calor no se pinta. Detalle del día como ficha de papel con pinza de latón, portada a la
izquierda, filas de registro con editar y borrar, y «Apuntar otra lectura» con borde discontinuo.

### 32.3 Siguientes bloques (registrados, no hechos)

1. Las otras ocho pantallas recientes según sus maquetas: Estadísticas, Sesiones, Reto anual, Misiones y Guardián,
   Sobre del día (Citas), Mi Perfil y Avatar, Lectores y actividad, y Mi rincón (privacidad, libros y figuras;
   ambiente, lecturas, libros representativos y recuerdos), con la misma fila de pestañas de papel donde corresponda.
2. Salón y club. Capítulos y encuentros requieren preparar migraciones aditivas de Supabase (tablas de capítulos,
   avance por miembro, encuentros y su confirmación, con RLS: miembros leen, dueño gestiona, cada miembro su avance) y
   sus pruebas PGlite, además de la interfaz (Conversación / Capítulos / Encuentros, aviso de encuentro, protección
   frente a spoilers por capítulo). No se descartan por no existir aún las tablas.
3. Máscaras de los reflejos de la habitación sobre el fondo original
   (`public/images/room-refresh/escena/fondo-limpio.webp`, 941 × 1672).
