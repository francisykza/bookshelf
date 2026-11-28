# BookShelf — "Mediterranean Cozy Reading Sanctuary"

> SPEC 1.163.0 · 2026-11-28 · Aplicación hermana de GameShelf dedicada a libros y lectura.

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

Ajuste posterior (1.41.1): «Volver» va en su propia línea, sobre el título; el cuaderno y su página reducen márgenes para que
la cuadrícula del calendario use casi todo el ancho (≈ 324 px a 390). Las filas del calendario sin lecturas son bajas
y las que tienen portada crecen; la tipografía de Hoy y del calendario se acerca a la de las maquetas sin bajar de
12 px en textos de lectura.

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

## 33. Reflejos suaves de la habitación sin guías (1.41.0)

Paquete `material-diseno/bookshelf-reflejos` (manifiesto y seis máscaras SVG de 941 × 1672, lienzo completo), copiado a
`public/images/room-refresh/reflejos/`. `RoomReflections` pinta cada máscara como máscara alfa de una capa color crema
dentro del mismo mundo escalado que el fondo (mismo rectángulo, escala, recorte y cámara; comprobado a 360, 390, 430 y
escritorio). Solo con Guías desactivadas; con Guías, los siete iconos y nombres de §31.

- Reposo 0,24; el objeto bajo el puntero o el foco, 0,5 (un lomo aviva la librería; una figura, la colección). Una
  única subida y bajada de 1200 ms por sesión; nada con movimiento reducido.
- Orden: encima de la ilustración y su vegetación, debajo de lomos, pantalla, páginas y figuras, que los tapan. El del
  vaso va sobre el primer plano del portátil, donde está redibujado el vaso.
- Sin eventos de puntero: los hotspots siguen siendo las zonas pulsables; un toque abre la sección directamente.
- Mis sagas no tiene máscara: un aro tenue en el borde del astro real, más visible con hover o foco.
- Pendiente: sobre superficies claras (páginas, auriculares) el reflejo en reposo apenas se distingue.

## 34. Ordenador: escritorio digital mediterráneo (1.42.0)

Referencia: `docs/design/references/ordenador-seis-apps-maqueta.png`. Recursos y su uso:
`docs/design/ordenador-recursos.md`. Sustituye al cuaderno de cuero de §32 dentro del ordenador (anillas, cuero,
pestañas de tela, clips y lacres como estructura) y a los iconos genéricos de sus apps. Estilos: `styles/computer.css`,
todo bajo `.pc` y con tokens propios (ventana #F8F3E8, tinta #352C23 / #706457, salvia #879477, terracota #B65F40,
azul bruma #8DA7AD, bordes #D9CFBC).

### 34.1 Estructura común

Fondo de la bahía, marco fino, barra superior (Salir · BookShelf · hora), ventana marfil con icono, título y ✕, cuerpo
con scroll propio y dock de seis apps (Diario · Datos · Sesiones · Reto · Misiones · Citas; icono de 32 px, rótulo de
11 px, botones de 48 × 56 como mínimo, activo con fondo salvia tenue e indicador). Una app a la vez, sin ventanas
arrastrables ni botones de minimizar o maximizar. ✕ cierra la app y deja el escritorio con el dock; «Salir» vuelve a
la habitación. Las apps se conservan ocultas al cambiar de una a otra (un formulario a medias no se pierde) y salir
con algo escrito en un formulario abierto pide confirmación. Atrás del navegador sigue cerrando el ordenador.

### 34.2 Apps

- Mi diario: pestañas Hoy · Calendario · Notas como control segmentado; sin marco de cuaderno. El calendario muestra
  una portada por día con contador «+n» si hay más lecturas, y el detalle del día va siempre bajo la cuadrícula.
- Estadísticas: cuatro indicadores 2 × 2 (páginas de los últimos 7 días, racha, total, valoración media), gráfico de
  los últimos 14 días con eje, géneros y más números; las fórmulas son las de siempre. Los libros con olivo, como
  acento pequeño junto a los géneros (se omiten por debajo de 375 px).
- Sesiones: «Registrar lectura» arriba, resumen, historial por días (Hoy / Ayer) con totales, y filas con portada,
  título, autor, registros, hora si existe, editar y borrar. Las correcciones siguen sin sumar páginas.
- Reto anual: anillo salvia «X de Y libros», mensaje según el ritmo, «Editar objetivo», torre real de leídos,
  libros completados (portada, autor, estrellas, fecha) y páginas por mes.
- Misiones y Guardián: la figura real del Guardián contenida, cajas por abrir, estrellas, sellos, «Abrir el Ático» y
  misiones con progreso y «Reclamar».
- Citas: la cita real con autor y obra, el sobre como ilustración pequeña encima, Guardar · Fijar · Compartir, hojas
  doradas y acceso al diario de citas.

### 34.3 Iconos de sección fuera del ordenador

Solo donde ya había uno: «Vitrina de Figuras» de la biblioteca (colección), cabecera del Atlas de Sagas (sagas) y la
fila de club de la actividad de Lectores (club, como en su maqueta). Biblioteca, comunidad, reseñas y notas no tenían
icono de sección y no se les añade; encuentros espera a su función (§32.3). La habitación (guías y reflejos) no cambia.

### 34.4 Diferencias conocidas con la maqueta

La barra de ventana y la cabecera de la app van en una sola fila (sin semáforos decorativos). Sin «…» de opciones, sin
selector de periodo en Estadísticas ni de año en el Reto, sin filtros Todas / En curso / Completadas en Misiones y sin
colecciones de citas inventadas: no existen esas funciones. Los géneros se muestran con su recuento, no en %.

## 35. Biblioteca, libro físico, rincón del lector y mapa sonoro (1.43.0)

Referencias: `docs/design/references/biblioteca-maqueta.png` (la última, sin títulos bajo las portadas) y
`rincon-lector-maqueta.png` (jerarquía y distribución; la escena, el avatar y los objetos son los reales). Estilos:
`styles/library-143.css`.

### 35.1 Biblioteca

Cabecera baja: «Volver al rincón» en su propia línea, «Mi biblioteca» sin placa colgante y el subtítulo; el paisaje
del recurso, sin deformar. Barra crema: buscador, «Añadir libro», «Vista y herramientas» (panel plegable con
Escaparate / Lomos, Libro al azar, Pedir una recomendación y Vitrina de Figuras; Escape lo cierra) y los filtros
Todos · Leyendo · Pendientes · Leídos con un único estado seleccionado. En el escaparate, cada grupo lleva un
encabezado ligero con su cantidad real («Leyendo · 3»; pulsarlo deja solo esa balda) y sus libros van de tres en tres
en móvil (de 4 a 7 en pantallas anchas) en filas verticales, cada fila en su compartimento de madera
(`shelf-module.webp`); sin carrusel, sin cuarto libro cortado y sin etiquetas de título o autor bajo los libros (el
nombre completo sigue en el nombre accesible y en la ficha). El tablón de recuerdos pasa al final. La vista de lomos
conserva su balda horizontal.

### 35.2 Libro físico

`PhysicalBook` (en `BookItem.jsx`): la portada real, completa y sin estirar, como cara principal; lomo estrecho del
color de la cubierta y sin letras; bloque de páginas en marfil asomando por el corte (o con sus cantos pintados);
sombra de contacto; pequeñas diferencias estables de tamaño según la edición. Solo los acabados propios de cada
edición: cantoneras en cuero, post-its en la anotada, marco mate en el e-reader y una marca pequeña de cascos en el
audiolibro. Sin cinta, barra de progreso ni post-its de citas sobre la portada (eso está en la ficha); la mini-figura
de saga, pequeña y sin brillo, en el canto de la balda. Variante «corner», más contenida, en el rincón. Las
miniaturas del calendario y las listas siguen con su portada plana.

### 35.3 Rincón del lector

`ReaderProfileView` carga los datos y `ReaderProfileContent` los presenta (sin consultas propias: lo que no llega
filtrado por su visibilidad no se pinta). Escena ilustrada sin la placa «Recuerdos de lectura» sobre la mesa; avatar
de 96 px con su adorno junto al alias; «Está leyendo» destacada en horizontal y, debajo, «Última lectura» y «Próxima
lectura» como dos piezas secundarias con títulos en varias líneas; «Recuerdos que se quedan» compactos (objeto, frase
y libro; cada uno abre su historia); figuras expuestas con su ilustración pequeña.

### 35.4 Sonidos

Un evento por acción en `audio/uiSounds.js` (sintetizados con Web Audio; respetan «Sonidos táctiles», el volumen y
la puerta de repeticiones y voces; un fallo de audio no bloquea nada):

| Acción | Evento | Carácter |
| --- | --- | --- |
| Abrir un libro o su ficha | `bookOpen` | golpe blando de cubierta y cuatro hojas que pasan (predomina el papel) |
| Cambiar de pestaña en la ficha o en Mi diario | `diaryTab` | una hoja breve |
| Cerrar un libro | `bookClose` | cubierta suave, más baja |
| Cerrar otro panel | `close` | papel amortiguado |
| Encender el ordenador | `computerOn` | clic pequeño y tres notas suaves ascendentes |
| Cambiar de app del ordenador | `appSwitch` | solo el clic |
| Entrar en la biblioteca | `libraryOpen` | libro que se desliza sobre madera y se asienta |
| Guardar una nota | `noteSave` | dos trazos de lápiz |
| Guardar una lectura u otro dato | `save` | sello sobre papel |
| Rincón de lector y comunidad | `visit` | llamada cálida de dos notas |
| Abrir el sobre de la cita | `envelope` | solapa de papel grueso y la hoja que sale |
| Entrar en la colección | `atticOpen` | pieza de cerámica sobre madera |
| Recompensas reales | `chime` (al revelar una figura) y la campana del fin de sesión | se conservan |

Pendiente: grabaciones reales de papel, cubierta, madera y sobre (con licencia registrada) para sustituir la síntesis.

## 36. Materiales artesanales en biblioteca y ficha (1.44.0)

Referencias: `docs/design/references/biblioteca-materiales-maqueta.png` y `ficha-libro-maqueta.png`; recursos y
uso, en `docs/design/materiales-controles.md`. Estilos: `styles/craft-144.css` (solo biblioteca y ficha).

- Controles `.craft` con tres bases vacías escaladas por nueve zonas: terracota (acciones principales), lino salvia
  (lo seleccionado, siguiendo el estado real) y papel crema (buscador, herramientas, filtros y estados sin
  seleccionar, pasos de página). Serif editorial (Cormorant Garamond) a 16,5–19 px con cifras modernas, marfil sobre
  terracota y salvia, sepia sobre crema; foco visible, pulsación de 1 px (sin ella con movimiento reducido).
- Biblioteca: la cabecera ilustrada termina en su balda; la barra es un panel de papel encajado en un compartimento
  del mueble; los filtros toman el ancho de su palabra. Se conservan los encabezados «Leyendo · N», las tres portadas
  por fila sin etiquetas y todas las herramientas.
- Libro físico en CSS 3D (perspectiva moderada): cubierta real, lomo estrecho y canto superior con el bloque de
  páginas marfil algo separado de la tapa; grosor según las páginas; sombra detrás y de contacto. El e-reader y el
  estuche del audiolibro no tienen cantos de papel. La portada de la ficha usa el mismo libro con menos giro.
- Ficha: estados en lino / papel; «Otras lecturas abiertas · Ver» despliega el selector de siempre (sin otras
  lecturas, no aparece); progreso integrado bajo «Tu lugar en esta historia» con página editable, total real, pasos,
  barra, porcentaje y «Te quedan N páginas» (terminado: «¡Terminado!»; sin paginación, solo el porcentaje); la
  cinta cuelga entera bajo el cuaderno.

## 37. Figuras expuestas en la habitación y pantalla del portátil (1.45.0)

Referencias: `docs/design/references/habitacion-figuras-maqueta.png` (distribución y presencia),
`habitacion-portatil-maqueta.png` (solo la pantalla del portátil) y `figura-detalle-maqueta.png` (detalle).
Estilos: `styles/figures-145.css`.

### 37.1 Recursos

Dos figuras nuevas en el catálogo, al final (la Dama sigue siendo la de los libros de su saga): «El Guardián de los
Clavos» (épica) y «El Maestro y el Superviviente» (legendaria), de Nacidos de la Bruma, con 5 sellos y 5 piezas
recortadas de su caja. Originales en `material-diseno/figuras/`; en la app, `public/figures/*-caja.webp` y
`*-figura.webp`, recortados solo de su margen transparente. Campo nuevo del catálogo: `boxAlpha` (la caja ya es su
propio recorte en tres cuartos: se pinta tal cual, sin contorno ni cantos). Entran en el reparto de las Cajas
Sorpresa con las reglas, pesos y pity de siempre.

### 37.2 Baldas

Las dos baldas superiores tienen cuatro posiciones (dos por balda) en `progress.figures.shelf`: `{ id, display }`
por posición (`display`: «box» o «unboxed»), o `null` (vacía). Sin elección guardada (`shelf: null`), se exponen
automáticamente las figuras que tienes con recurso para la habitación, el Guardián primero. Solo se exponen figuras
obtenidas con caja recortada o figura suelta con transparencia: las cajas fotografiadas antiguas y los personajes
planos (SVG) ya no se pintan en la habitación (siguen en el Ático). Sin el roble oscuro de antes: los objetos se
apoyan en la madera del fondo, en px de la ilustración (mismo mundo que el fondo), con su proporción, un reparto del
ancho según su forma, el canto delante de su base (recorte por la línea del canto), una inclinación suave (la mitad
de la pendiente de la balda) y sombra hacia el fondo. Tocar un objeto abre su detalle; la madera de alrededor sigue
abriendo el Ático.

### 37.3 Detalle

Panel de papel crema: nombre, imagen completa, «Figura / Caja» (solo previsualiza; «Exponer…» lo aplica), piezas con
su estado real, «Cambiar de balda» (posición libre, o intercambiar / sustituir si está ocupada: la otra vuelve al
Ático) y «Guardar en el ático». En el Ático, «Exponer en la habitación» abre el mismo detalle.

### 37.4 Portátil

La ventana del calendario ocupa la parte derecha del escritorio y deja ver la bahía; marfil cálido, contraste
moderado, reflejo tenue y borde en sombra. Datos reales; la planta y el vaso siguen delante.

### 37.5 Pendiente

La maqueta muestra una estantería más ancha y frontal: con las baldas actuales del fondo (≈ 195 px de la
ilustración por balda y en perspectiva) los objetos se ven más pequeños. Hace falta un fondo con esas baldas.

## 38. Habitación con el libro abierto en primer plano y registro enfocado (1.46.0)

Referencia: `docs/design/references/habitacion-libro-abierto-maqueta.png` (sustituye a las versiones con tarjeta de
lectura flotante). Recursos entregados (originales en `art-inbox/maqueta-146/`, fuera de git): libro abierto en
blanco con cinta verde, botón terracota cosido, placa de papel marfil con ramita y un fondo de habitación para móvil.
Derivados en `public/assets/room/` (`libro-abierto.webp` 1200 × 595, `boton-terracota-cosido.webp`,
`placa-papel-ramita.webp`): recorte del margen transparente y WebP; nada se redibuja.

### 38.1 Composición
- Se conserva la ilustración de la habitación (941 × 1672) con todas sus capas, figuras, té, vela y lámpara. El
  fondo para móvil entregado **no** se ha adoptado: no tiene vaso de té, vela ni lámpara completa (funciones del
  temporizador y la iluminación) y obligaría a recalibrar hotspots, baldas de figuras, agua y pantalla. Queda en
  `art-inbox/maqueta-146/habitacion-fondo-movil.webp` por si se decide migrar.
- Cabecera «Mi rincón» / «La biblioteca junto al mar» (texto HTML, sin placa, dentro del área segura superior).

### 38.2 «Ambiente» y «Guías»
- Las cinco pestañas de madera y latón se sustituyen por dos botones de papel marfil (`.craft--paper`).
- «Ambiente» agrupa: hora del día (Mañana, Atardecer, Noche y «Seguir el reloj» = `timeAuto`), iluminación
  (lámpara y vela, con sus sonidos) y sonido (ambiente del mar y sonidos al tocar). Al final, «Tu cuenta y copias»
  (con el estado de la nube) y «Pantalla completa», para no perder funciones. Mismas preferencias de siempre.
- «Guías» mantiene su menú (repetir guía, insignias, «Fuera de vista»).

### 38.3 Accesos y libro de la cama
- «Mi biblioteca» (anclado a la balda), «Mi diario» (canto de la mesa; abre el portátil) y «Rincón social» (el
  control del panorama, ahora placa legible a la derecha) son botones reales siempre visibles, con o sin guías.
  Las anclas viven en `HOTSPOTS.shelf.plaque` y `HOTSPOTS.laptop.plaque` y se acotan al panel.
- `BedBook` (en la capa de pantalla del escenario, paneles de ≥ 520 px de alto): página izquierda «Tu lectura
  actual», título (hasta 4–5 líneas, mínimo 13 px) y autoría, y abre la ficha; página derecha «Por donde vas»,
  página y total, porcentaje con barra (`progressbar`), páginas restantes y «Registrar lectura» (terracota cosido,
  área táctil ≥ 44 px). Estados: sin total (sin porcentaje ni restantes), por porcentaje, terminada (la última
  lectura elegida pasada a leída: «Elegir otra lectura») y sin lectura («Elegir un libro» → biblioteca).
- Con el libro grande, el libro pintado de la escena no repite los datos. En horizontal bajo (< 520 px) sigue el de
  la escena (§21.2). Lo transparente del recurso no intercepta toques (los auriculares siguen accesibles).

### 38.4 Registrar lectura
- Panel `log` (`ReadingLogSheet`): portada compacta, título, autoría y «Ahora: …», fecha (hasta hoy) y el mismo
  `ReadingEntryForm` (modos «He leído», «Voy por la página» y «Porcentaje», un solo campo, vista previa con
  posición final y avance, validación, correcciones hacia atrás y guardado idempotente). En esta vista las acciones
  van en el flujo, no fijas sobre los campos; el campo enfocado se recoloca al cambiar el visor (teclado).
- Al guardar: sonido de hojas (`pageLeaves`), se cierra y aparece «Lectura registrada · +N páginas · Deshacer»
  durante 8 s. «Deshacer» usa `revertLog` (registro, posición del libro y sellos) y guarda. Si el registro termina
  el libro, se abre su reseña como en la ficha (sin aviso de deshacer).
- El modelo de registro no tiene nota por sesión: no se ha añadido.

### 38.5 Otros
- Buscador: se quita «(respaldo automático)»; queda la atribución «Resultados de …».
- Sonidos: abrir el registro reutiliza `monthTurn` (paso de página); confirmar usa `pageLeaves` (nuevo, sintetizado).

## 39. Acabado físico de los libros calibrado con una portada real (1.46.0)

Calibrado con *The Ballad of Songbirds and Snakes* (portada original entregada por Francisco; en la app, la misma
ilustración de Open Library `b/id/14421833`, la que devuelve el buscador). La portada de Open Library **por ISBN**
(9781338635171) es un escaneo de biblioteca con pegatina: no sirve como referencia ni debería preferirse.

- Un solo componente, `PhysicalBook` (biblioteca, ficha y rincón): portada original sin redibujar ni recortar y,
  encima, `.pbook__finish` (luz rasante, bordes algo apagados y grano de papel muy tenue en `soft-light`).
- Giro 3D reducido (`rotateY` 17° → 10°, `rotateX` −7° → −4°; ficha y rincón 8° / −3°): volumen visible sin acortar
  ni deformar el título.
- `data-binding` según la edición guardada (sin datos nuevos): `hard` si el grosor de tapa de `EDITIONS` es
  ≥ 0,4 cm (tapa dura, cantos pintados, cuero, tela) → cartón visible, bisagra marcada, lomo con nervios, canto con
  las dos tapas y +3 px de grosor; `soft` (bolsillo, anotada) → cubierta fina sin bisagra y 85 % del grosor;
  `device` (lector) → lámina de 5 px con reflejo mate; `case` (audiolibro) → estuche de acrílico translúcido con el
  indicador en la esquina, fuera de la portada.
- Cantoneras doradas solo en «Cuero y oro», como antes; ningún borde dorado general.
- El lomo toma el color de la portada (`useCoverColor`, ya existente); mientras se analiza, el determinista.
- Prueba: `e2e/v146.spec.js`.

## 40. Buscador por título, autor o ISBN y elección de edición (1.46.0)

Proveedores reales del proyecto, sin clave: Google Books y, si no responde (p. ej. 429 por cuota) o no encuentra
nada, Open Library. Reglas puras en `src/domain/bookSearch.js` (pruebas en `__tests__/bookSearch.test.js`).

- **ISBN**: un ISBN-10 o -13 válido (guiones y espacios permitidos, dígito de control comprobado) se busca como tal
  (`isbn:` en Google; `search.json?isbn=` y `/isbn/X.json` en Open Library, que da la edición exacta) y su
  coincidencia va la primera con la etiqueta «Coincide el ISBN». Un número cualquiera no se trata como ISBN.
- **Texto**: mayúsculas, tildes y puntuación no cuentan (`normalizeText`) para ordenar, detectar duplicados ni para
  la memoria de consultas (30 últimas: repetir una búsqueda no vuelve a pedirla).
- **Orden** estable sin quitar nada: ISBN exacto, título que coincide (exacto, empieza o contiene) e idioma del
  navegador del usuario. Ya no se agrupa por «título|autor» (ocultaba ediciones): solo se quitan duplicados reales
  (mismo ISBN o misma obra). Las obras de Open Library que el propio catálogo tiene repetidas no se fusionan
  (no hay identificador fiable que lo permita).
- **Edición**: un resultado de Google ya es una edición. Una obra de Open Library abre «Elige tu edición»
  (`/works/…/editions.json`, hasta 60, las del idioma del usuario primero): cada fila con su portada, editorial,
  fecha, idioma, páginas, formato e ISBN. Nada se completa con otra edición; la obra solo aporta autoría, sinopsis,
  temas y año de primera publicación. «No sé cuál es» sigue solo con los datos de la obra (sin páginas).
- **Fechas**: `publishedDate` del libro es la de la edición; `firstPublished`, la de la obra. Se guardan también
  `publisher`, `language` y, si existe, `editionRef` (Open Library).
- **Ya en la biblioteca**: mismo ISBN → «Ya está en tu biblioteca» (no se puede volver a añadir esa edición);
  mismo título y autoría → «Ya tienes este título» (se permite: puede ser otra edición).
- **Confirmación**: portada compacta, resumen de la edición elegida, campos en dos columnas (título, autoría,
  páginas o «Sin total», editorial, fecha de la edición, idioma, ISBN, balda y formato) y sinopsis desplegable.
  Las páginas ya no se inventan (antes 300 por defecto): hay que escribirlas o marcar «Sin total». El formato del
  proveedor solo fija la edición física si es inequívoco (Hardcover → tapa dura…).
- **Estados**: «Buscando…», número de resultados, error con «Reintentar» y «No hay resultados para…»; las
  respuestas de consultas anteriores se cancelan o se descartan. Atribución: «Datos de Google Books / Open Library».
- **Escaneo de códigos**: no existe en el proyecto y no se ha añadido.
- Pruebas e2e con los proveedores simulados en `e2e/v146.spec.js`.

## 41. Figuras de dos por balda: revisión y límites (1.46.0)

Revisión del sistema de la 1.45 (§37) contra el encargo; se mantiene y se corrige lo que fallaba.

- **Corregido**: el acceso «Mi biblioteca» (§38.3) tapaba la balda central de figuras. Ahora va en el hueco libre
  bajo la balda de los libros (`HOTSPOTS.shelf.plaque` y = 700). El anillo de foco del botón de cerrar del detalle
  ya no sale cortado por el borde del panel.
- **Comprobado** (prueba `e2e/v146.spec.js`, pantallas verticales): cada pieza conserva la proporción de su recurso
  (la caja doble del Maestro sale ≈ 1,8 veces más ancha que la del Guardián, sin comprimirse); los recursos ya vienen
  recortados a su silueta visible; ningún acceso tapa una figura; previsualizar «Figura» no cambia la habitación
  hasta «Exponer…»; cambiar a una posición ocupada intercambia sin perder la otra; «Guardar en el ático» vacía la
  posición y conserva figura y piezas; posición y variante persisten al recargar.
- **Perspectiva y sombra**: las cajas son recortes en tres cuartos sin sombra propia; en la habitación llevan solo la
  mitad de la pendiente de la balda y una sombra de contacto: no se dobla ninguna de las dos.
- **Recursos**: solo «El Guardián de los Clavos» y «El Maestro y el Superviviente» tienen caja y figura recortadas.
  La Dama de la Ceniza y la Jinete de Dragones (cajas fotografiadas en JPG) y las tres figuras en SVG plano no se
  exponen: faltan sus recortes con transparencia de caja y de figura.
- **Límite del fondo**: con las baldas actuales (≈ 182 px útiles de la ilustración por balda y en perspectiva) las
  dos piezas de una balda caben a ≈ 45–60 px de pantalla a 390 px; en `habitacion-figuras-maqueta.png` se ven unas
  2,5 veces mayores porque esa estantería es más ancha y frontal. **Para igualarla hace falta un fondo con baldas
  superiores más anchas**; no se deforman las figuras para disimularlo. En horizontal y escritorio el encuadre no
  muestra estas baldas (la vitrina se ofrece en «Guías › Fuera de vista»).

## 42. Pantalla del portátil centrada en la zona visible (1.46.1)

- La ventana del calendario de la escena ocupaba la parte derecha e inferior de la pantalla, justo detrás del
  primer plano pintado (la planta tapa x ≥ 250 del lienzo 300 × 248; el vaso, x ≥ 180 con y ≥ 165): se veían
  cortadas las últimas filas y la línea de hoy. Ahora va arriba y centrada en la parte visible (x 14–244,
  y 12–164), algo más compacta; debajo se ve la bahía del fondo de escritorio.
- Se mantiene todo lo demás: proyección en las cuatro esquinas interiores del monitor, bisel pintado y primer plano
  por encima, reflejo y viñeta tenues, brillo moderado (de noche toma el tono de la habitación), datos reales del
  mismo calendario del panel y el diseño de apps del interior. Sonidos: `computerOn` al abrir (también desde
  «Mi diario») y `appSwitch` al cambiar de app.
- A 360–390 px el encuadre deja fuera el borde derecho de la pantalla, como en la maqueta; con la ventana a la
  izquierda, el mes queda casi entero a la vista.
- Prueba: `e2e/v146.spec.js` («portátil…»).

## 43. Estado «Abandonado» (1.47.0)

- Nuevo estado `abandoned` («Abandonado») en `STATUS` y `LIBRARY_STATUSES`; no existía ninguno equivalente.
  Aditivo: misma clave `bookshelf:v1`, sin migración (los libros existentes no cambian); la nube guarda el estado
  completo en JSON, sin restricciones de valores. Campo nuevo `abandonedAt` (cuándo se dejó; vuelve a `null` al
  salir de ese estado).
- Abandonar conserva página o porcentaje, sesiones, notas, reseña y valoración; no pone el 100 %, no fija
  `finishedAt`, no cuenta como leído en estadísticas, misiones ni reto anual y no concede recompensas de terminar.
- Se retoma desde la ficha («Leyendo ahora») con su progreso intacto. Nunca se abandona solo por inactividad.
- Las lecturas activas (selectores del registro) son solo las de «Leyendo», así que un abandonado sale de ellas.
- Si era el libro elegido para la cama, el libro grande dice «Lectura abandonada», muestra dónde se dejó y ofrece
  «Elegir otra lectura» (biblioteca) sin escoger otro por su cuenta.
- Biblioteca: balda «Abandonados» (en «Todos» solo si tiene libros) y su etiqueta en la fila de filtros.

## 44. Biblioteca compacta (1.47.0)

Referencia: `docs/design/references/biblioteca-compacta-maqueta.png` (las portadas de la maqueta son ilustrativas).
Sustituye a las instrucciones anteriores que ocultaban el buscador y los filtros. Estilos: `styles/library-147.css`.

- Cabecera: franja baja de la ilustración (recortada por encuadre) con «Volver al rincón» y un icono de
  herramientas; debajo el buscador siempre visible («Buscar título o autor…», etiqueta accesible propia, botón de
  limpiar, filtra solo la biblioteca personal y se combina con el filtro); después la fila textil y las baldas. Sin
  título grande ni subtítulo visibles: queda un `h1` accesible. El teclado no se abre al entrar.
- Fila textil: Todos (lino marfil, ramita), Leyendo (terracota, libro abierto), Pendientes (crema, reloj de arena),
  Leídos (salvia, completado) y Abandonados (malva #967F88, libro cerrado). Bases en
  `public/assets/ui/textile/etiqueta-*.webp`, derivadas del lino salvia existente recoloreando solo la tela (trama
  y costuras intactas). Texto e iconos en HTML. La elegida lleva además una cinta cosida debajo. En móvil, si no
  caben, la fila se desplaza en horizontal (con sombra de pista al borde) sin desplazar la página, y la elegida se
  trae a la vista.
- Herramientas (icono, cerradas por defecto): «Añadir libro», Escaparate / Lomos, libro al azar, recomendación y
  Vitrina de Figuras. No hay ordenación en el proyecto: no se ha añadido. El desplegable empuja las baldas.
- Sin hueco «Añadir un libro» dentro de las baldas. Los libros conservan su tamaño: el espacio ganado deja ver más
  estantería (a 390 px la primera balda empieza ≈ 200 px más arriba que en la 1.46).

## 45. Habitación, registro y Ambiente pulidos (1.47.0)

Estilos: `styles/room-147.css`.

- Encabezado: «Mi rincón» algo menor; si no cabe a la izquierda de la esquina, baja a una segunda fila (se mide con
  la anchura real de la esquina, también con texto ampliado). Accesos ≈ 12 % menores a la vista (papel dibujado
  4 px dentro del botón, que sigue midiendo 44 px); «Rincón social» algo más arriba, junto al ventanal.
- Cuenta y copias: icono propio en la esquina (con punto de estado de la sincronización); ya no está en Ambiente.
- Libro de la cama: títulos sin guiones automáticos (solo se parte una palabra que no quepa), botón con más margen
  interior, pista de progreso completa en tono tenue y relleno exacto, y algo más de separación del borde inferior.
- Registro: modos en papel marfil y el elegido en lino salvia; campos de papel liso; sin el marco interior; portada
  y fecha compactas; «×» de cierre; «Guardar lectura» y «Cancelar». Placeholder «Ej. 20» (el campo empieza vacío).
  Vista previa con `previewLines` (dominio): «Registrarás 20 páginas», «Pasarás de la página 25 a la 45», «8,5 %
  leído»; una corrección hacia atrás se anuncia como tal. Cerrar con algo escrito (×, Cancelar, Escape o fuera)
  pide «Seguir editando» o «Descartar».
- Ambiente: título y «×», horas «Mañana / Atardecer / Noche» con icono; la hora que se ve está siempre marcada y una
  línea dice si sigue el reloj o si se eligió a mano (elegir una hora desactiva «Seguir el reloj»); alto limitado
  con desplazamiento; alineado al borde derecho de la esquina en todos los anchos. El aviso de bienvenida se oculta
  mientras hay un menú de la esquina abierto (lo tapaba).
- Pruebas: `e2e/v147.spec.js` y `src/domain/__tests__/v147.test.js`.

## 46. Integración visual y selector de lectura (1.48.0)

Corrige lo que mostraban las capturas de un móvil real. Sustituye las instrucciones anteriores que permitían
desplazar los filtros en horizontal y mantenían el título de la habitación. Estilos: `styles/ui-148.css`.

- **Cabecera de la biblioteca**: `fix-138.css` daba a «Volver» `top: env(safe-area-inset-top)`; con
  `position: relative` (1.47) lo bajaba tanto como el área segura del móvil (0 en emulación) y lo metía en el
  buscador. Ahora la cabecera es un layout real sin desplazamientos: fila (volver | herramientas), buscador en su
  fila y filtros. Franja ilustrada más baja por encuadre. Herramientas: solo el icono sobre un círculo translúcido
  pequeño (46 px de superficie), sin placa.
- **Filtros**: los cinco a la vista sin desplazamiento horizontal: una fila de cinco desde 540 px; por debajo, dos
  filas de tres y dos (rejilla de seis columnas), con su nombre entero. La elegida se marca con un ribete interior
  cosido (ya no con una línea de guiones debajo).
- **Libros**: canto de páginas marfil apagado con líneas finas (no blanco); lomo con el borde izquierdo de la propia
  portada oscurecido (continúa la cubierta y no depende de leer sus píxeles); sombra en la bisagra; sombra de contacto
  más corta y densa. Calibrado con tapa dura, tapa blanda y lector (*Songbirds and Snakes*) y con *Guerra y paz*.
- **Habitación**: «Mi rincón» y el subtítulo ya no se ven (siguen como nombre accesible). Libro de la cama al ≈ 90 %
  del ancho, anclado a la derecha y apoyado en el edredón: los cascos pintados quedan a la vista (≤ 25 % de su forma
  bajo el libro). La ilustración del libro va en su propia capa con temperatura y luz moderadas y una sombra de
  contacto localizada (sin halo). Con libro estrecho (< 360 px), el botón sin «+» y con menos relleno.
- **Carteles**: cada uno colgado de su superficie y con su ángulo (`HOTSPOTS.*.plaque`): «Mi biblioteca» del frente
  de la balda de los libros (8,4°), «Mi diario» del borde de la mesa junto al portátil (12°). «Social ›» compacto
  (nombre accesible «Abrir rincón social»), junto al lateral derecho del ventanal, por encima de la vista al mar.
- **Indicadores**: en la habitación no hay ningún indicador del apartado social. El punto verde es el de la cuenta
  (copia en la nube al día) y el dorado, el de «Guías» (objetos fuera de vista); ambos van dentro de su botón, en su
  esquina, y la cuenta describe su estado (`aria-description`). No se ha inventado indicador social.
- **Registro**: selector «Lectura» al principio (portada, título, progreso y flecha). Lista con las lecturas en curso
  primero (marcada la elegida), buscador si hay más de seis, y «Elegir otro libro» para pendientes y abandonados.
  Empieza en el libro de la cama o en «Elige una lectura». Cada libro visitado mantiene su formulario y su borrador
  mientras la vista está abierta; cambiar la fecha no los recrea. El guardado usa el libro de su formulario; el
  selector se bloquea mientras se guarda. Elegir aquí no cambia el libro de la cama ni su estado.
- Pruebas: `e2e/v148.spec.js`.

## 47. Pantalla principal integrada en la escena (1.49.0)

Decisión de Francisco: escribir la lectura sobre el libro pintado del fondo. Estilos: `styles/room-149.css`.

### 47.1 Diagnóstico
- **Pintado en el fondo** (`fondo-limpio.webp` / `cozy-book-room.jpg`, 941 × 1672): estantería, libro abierto sobre la
  cama, cascos, mesa con portátil, vaso de té, vela, ventana y mar. **Imágenes aparte**: hiedra y cortina (capas
  de la escena), primer plano del portátil, lomos y figuras de las baldas, y (1.46–1.48) el libro `libro-abierto.webp`.
- **Escalado y recorte**: `SceneStage` escala el fondo para cubrir el panel (cover) y lo recorta según `framing`.
  A 390 × 844 se ven 773 de los 941 px de ancho; con `x: 0.62` se recortaban 104 px por la izquierda y con ellos
  parte de los cascos (x 22–248): **el recorte venía del encuadre, no del recurso** (que los tiene enteros).
- **Anclajes**: hotspots, lomos, figuras, pantalla y páginas del libro van en coordenadas de la escena (mismo
  lienzo escalado). El libro grande de la 1.46–1.48 y los carteles iban en píxeles de pantalla sobre la capa de
  interfaz; el libro, además, con una perspectiva casi cenital ajena a la cama y encima del libro pintado (silueta
  duplicada). **El recurso `libro-abierto.webp` no es compatible con la perspectiva de la cama.**
- **Indicador verde**: era el estado de la copia en la nube de la cuenta (no hay indicador social). El dorado de
  «Guías» indica objetos fuera de vista.

### 47.2 Cambios
- **Libro**: se retira el libro superpuesto. La lectura se proyecta con la homografía del escenario sobre las zonas
  útiles de las páginas pintadas (`BOOK_LEFT_PAGE` y `BOOK_RIGHT_PAGE`, ya separadas del pliegue y los bordes), con
  un lienzo de las proporciones de cada zona (perspectiva del papel sin aplastar el texto) y tinta en `multiply`; la
  luz del día y la noche la tiñen como al resto. Izquierda: «Tu lectura», título (hasta 4 líneas, letra mínima
  ≈ 12 px de pantalla a 390), autor. Derecha: «Por donde vas», página, total y porcentaje, barra exacta y un botón
  terracota pequeño; el toque lo recoge un botón real en la capa de objetos (≥ 44 px de pantalla), encima del
  hotspot del libro, que sigue abriendo la ficha. Estados: lectura, sin total, terminada, abandonada y sin lectura.
- **Encuadre vertical**: `framing` `x: 0.62 → 0.29`. Cascos ≥ 85 % visibles de 360 a 430 px; el portátil se
  recorta más por la derecha y el vaso de té queda fuera (su acción sigue en «Guías › Fuera de vista»).
- **«Mi biblioteca»**: fijado al frente plano de la balda inferior (y ≈ 805), sin giro, bajo la última fila de
  libros (no tapa lomos) y dentro del mueble; papel bajo (≈ 26 px) con superficie de 44 px. Si el encuadre deja esa balda
  fuera (escritorio, horizontal), pasa al frente de la balda siguiente (`plaqueAlt`), sin flotar. «Mi diario» sigue en el
  borde de la mesa (12°) y «Social ›», junto al marco derecho de la ventana.
- **Indicadores**: el de la cuenta solo aparece con un estado real de sincronización, en la esquina exterior del
  botón con un aro del color del papel (sin pisar el icono) y con el estado en el nombre accesible. El de «Guías»,
  igual, fuera del texto.

### 47.3 Recursos
- Si se quisiera el libro de la maqueta (más grande que el pintado) sobre esta habitación, harían falta: el fondo
  actual **sin** el libro pintado (mismo encuadre y luz) y un libro abierto dibujado **en la perspectiva del
  edredón** (girado ≈ 14° y visto en oblicuo como el pintado), con fondo transparente y sombra propia aparte.
- Para ver a la vez los cascos enteros y el portátil completo a 390 px haría falta un fondo vertical con esos
  objetos más juntos (como el fondo para móvil entregado, que no tiene té, vela ni lámpara).
- Pruebas: `e2e/v149.spec.js`; adaptadas `diegetic`, `gouache`, `panorama`, `v147` y `v148`.

## 48. Ajustes del libro, del cartel de la biblioteca y de «Social» (1.50.0)

- **Texto de las páginas**: sin la cizalla de la homografía (que inclinaba las letras). Cada página es un rectángulo
  centrado en su zona útil y girado con la orientación media de sus bordes superior e inferior (izquierda ≈ 17°,
  derecha ≈ 4°): las letras van derechas sobre su línea y siguen la orientación del papel. Títulos medianos en tres
  líneas y largos en cuatro, sin cortes a mitad de línea.
- **«Registrar lectura»**: más pequeño, dentro de la página y lejos de su borde; la base terracota se funde con el
  papel pintado (`multiply`) y el texto queda nítido encima. El botón real sigue centrado en el dibujado (≥ 44 px).
- **«Mi biblioteca»**: dentro de la escena, sobre el frente de la balda inferior medido como trapecio
  (112, 803)–(338, 800)–(338, 843)–(112, 858) (punto de fuga de las baldas ≈ (983, 788)). Se aplica una transformación
  plana al paralelogramo medio de ese trapecio (borde superior y caída media de los lados): sigue la inclinación del
  mueble y se dibuja igual en todos los motores (el WebKit de Windows de Playwright no pinta bien `matrix3d`; la
  pantalla del portátil, que lo usa desde antes, también sale mal solo en ese emulador). Área de pulsación ≥ 44 px.
- **«Social ›»**: más suave (solo el papel interior es algo translúcido; tinta y sombra más tenues, letra menor).
  Sin `opacity` ni `filter` en el propio botón: creaban una capa que en WebKit y a 430 px dejaba que la escena se
  quedara el toque.

## 49. Habitación nocturna de la maqueta (1.51.0)

Referencia: `docs/design/references/habitacion-noche-maqueta.png`. Recursos entregados por Francisco (originales en
`material-diseno/`): «Dormitorio nocturno bajo la luna-1» (851 × 1848, la composición de la maqueta sin libro, sin
carteles ni controles y con la pantalla apagada) y «Libro abierto de cuero con cinta botánica-2» (con
transparencia). Derivados: `public/images/room-night/dormitorio-noche.webp` y `libro-abierto-noche.webp` (recorte
del margen transparente, 1697 × 768). No llegaron las versiones de día y atardecer del mismo cuadro.

- **Escena propia**: con la hora «Noche» (por reloj de 21 a 7 h o elegida en «Ambiente») la habitación es
  `NightRoom.jsx` con su mapa `scene/nightMap.js` (otra ilustración, otras coordenadas). Mañana y atardecer siguen con
  la escena de siempre. Durante la guía de primera visita se ve el cuarto de día (sus anclas son de ese mapa).
- **Capas** (todas con la cámara de la escena): fondo; luz apagada localizada (lámpara y vela, solo alrededor de su
  objeto); pantalla del portátil con el calendario real proyectado en sus cuatro esquinas, brillo de noche; zonas
  tocables de los objetos pintados (librería, figuras → Ático, lámpara, portátil, vela, cascos); libro (recurso aparte,
  escala uniforme 0,515 y giro 5°, sin estirar, con sombra de contacto bajo la cubierta); carteles.
- **Libro**: zonas útiles por página en px del recurso, lejos del pliegue, la cinta y los ramitos pintados; texto
  real que acompaña moderadamente la página (6° y 4,5°). Izquierda: «Estás leyendo», título (hasta tres o cuatro
  líneas, sin cortes) y autor. Derecha: «Página X», «de Y · Z %», barra con el porcentaje real y «Registrar lectura»
  (terracota cosido; zona táctil ≥ 44 px). El resto del libro abre la ficha. Estados de siempre (sin total,
  terminado, abandonado y sin lectura).
- **Carteles**: «Mi biblioteca» en el frente plano de la balda bajo los libros y «Mi diario» en el frente de la mesa
  (12°), dentro de la escena con transformación plana; «Social ›» junto al ventanal (posición calculada por la
  escena; si el encuadre deja fuera el ventanal, en el borde derecho). Los dos de la escena ya reciben el toque
  (también de día: heredaban `pointer-events: none` y lo recogía la estantería).
- **Controles superiores** (de día y de noche): papel de ≈ 30 px como en la maqueta, zona de toque de 44 px; la fila
  ya no se parte. Sin título visible (queda el nombre accesible). El punto de «Guías» solo avisa de objetos que
  existen y el encuadre recorta: el té no está pintado de noche y se ofrece en «Guías» sin punto.
- **Pruebas**: `playwright.config.js` fija el reloj del navegador a mediodía del mismo día de Madrid (las escenas
  dependen de la hora); `e2e/v151.spec.js` elige la noche en «Ambiente».

### Diferencias con la maqueta
- Baldas: los libros y las cajas de figuras están pintados en el fondo; no son tus libros ni tus figuras (de noche no
  se pintan lomos ni figuras reales). Para eso haría falta el fondo con las baldas vacías.
- Libro: el recurso entregado es algo más oblicuo que el de la maqueta; con escala uniforme queda ≈ 10 px (a 390)
  más arriba y con el canto inferior menos inclinado.
- Escritorio y horizontal: la ilustración es vertical; en pantallas anchas se ve ampliada la parte inferior (libro,
  cascos y mesa). Falta una versión ancha del mismo cuadro.
- Día y atardecer siguen siendo la otra ilustración: al cambiar de hora cambia la composición.

## 50. Una sola habitación de día y de noche y libro integrado (1.52.0)

Decisión de Francisco: la composición de día es la definitiva y la noche es la misma habitación con otra luz. Se
retira la escena nocturna de la 1.51 (§49: `NightRoom`, `nightMap.js`, su fondo y su libro) porque cambiaba los muebles.
Recurso pendiente: `docs/design/recursos-noche-misma-habitacion.md`.

- **Continuidad**: a cualquier hora, el mismo fondo, encuadre, baldas con tus libros y figuras, libro pintado,
  carteles y zonas. De noche, de momento, el velo azul de siempre (las manchas de sol siguen pintadas: **la luz
  nocturna aprobada no está resuelta**) con más luz sobre el libro (el velo se aclara sobre él y una luz cálida
  suave), para que se lea. Lámpara y vela siguen sus controles.
- **Preparado para el fondo nocturno equivalente**: `SCENE_REFRESH.night` (hoy `null`). Con una ruta, de noche se pinta
  encima del de día con la misma geometría y se quita el velo (`data-night-base`).
- **Libro** (`BedPages.jsx`, estilos en `room-152.css`, que sustituyen a los de `room-149.css`): página izquierda
  centrada con «Estás leyendo», título en una caja fija de tres líneas (34 / 26 / 24 px de la ilustración según la
  longitud, sin guiones ni cortes de palabra; los muy largos acaban en «…» y el completo está en la ficha y en el nombre
  accesible) y el autor siempre en el mismo sitio. Página derecha sin «Por donde vas»: «Página X» como dato principal,
  «de Y · Z %», barra real y «Registrar lectura» (terracota apagado con costura, texto crema de 22 px ≈ 11 px de
  pantalla, sombra pequeña, separado del progreso y del borde; zona táctil ≥ 44 px de pantalla). Todo en el sistema
  de coordenadas de cada página, girado con su papel; la perspectiva es la del dibujo.
- Se conservan de la 1.51 las correcciones generales (`room-151.css`): controles compactos, «Guías» sin
  desplazamientos, carteles que reciben el toque, puntos de estado en su esquina.

## 51. «Mi diario» del libro en tres secciones y noche con su fondo pintado (1.53.0)

Referencia: `docs/design/references/diario-resena-maqueta.webp` (cuaderno artesanal, sección «Reseña»). Se añade a
§50; no lo sustituye.

- **Estructura**: la ficha conserva Ficha · Diario · Lectores · Cerrar. «Diario» muestra «Mi diario», la privacidad
  («Solo para ti»; si la reseña está publicada, «Solo para ti, salvo tu reseña publicada») y una fila de tres
  pestañas —Reseña, Notas, Historial— con contenido independiente, pegada arriba al desplazarse (con fondo de papel,
  no transparenta). Entrar al diario abre «Reseña»; los accesos del ordenador abren su sección (`tab` «notes» desde
  una nota, «history» desde una sesión). Las tres secciones siguen montadas: cambiar no pierde borradores. Flechas
  izquierda/derecha entre pestañas.
- **Reseña** (`MyReview` en `BookDetailModal.jsx`): «Mi reseña», «Lo que esta historia te está dejando.», «Puedes
  escribirla mientras lees.» y una hoja de borde doble terracota con «Tu valoración» (cinco estrellas, el valor
  —«3,75 de 5»— o «Sin valorar» y «Ajustar puntuación», que abre el ajuste en cuartos y «Quitar valoración»), el
  campo («¿Qué te está haciendo sentir este libro?», 17 px, crece con el texto: un solo desplazamiento, el de la hoja)
  y la firma con el nombre del ex-libris (`settings.owner`; el valor de fábrica «Lectora» no firma) y la ramita, debajo
  del campo. Después, el estado de privacidad real, «Guardar reseña» (cuero terracota con costura fina), los controles
  de publicación de siempre y «Volver a la ficha». Se puede escribir sin haber terminado el libro.
- **Valoración**: la misma de la Ficha y de Lectores (`book.rating`), con cuartos; se guarda al tocarla, como en la
  Ficha. `RatingInput variant="sheet"`: tocar una estrella no despliega el ajuste fino.
- **Guardado**: ya no hay guardado automático de la reseña. «Guardar reseña» escribe en el dispositivo
  (`useConfirmedSave` + `persistNow`) y solo entonces dice «Reseña guardada en este dispositivo»; mientras, «Guardando…»
  y el botón bloqueado (no hay envíos dobles). Si falla, «No se ha podido guardar… Tu texto sigue aquí» con
  «Reintentar». Sin cambios, pulsar solo confirma que lo guardado está escrito. Guardar nunca publica; «Publicar en mi
  rincón» publica lo guardado, así que con un borrador pendiente pide guardarlo antes.
- **Borrador** por libro en `sessionStorage` (`bookshelf:review-draft:<id>`): sobrevive a cambiar de sección, cerrar la
  ficha y recargar; se descarta al confirmar el guardado. Si la reseña guardada cambia por otra vía y el campo no se ha
  tocado, se adopta; si hay borrador, se respeta (no se sustituye por un campo vacío).
- **Notas**: las anotaciones con sus filtros, colores personalizados, edición, borrado y borrador de siempre (`Journal
  mode="notes"`), sin sesiones.
- **Historial**: solo las sesiones del registro, agrupadas por día, recientes primero, de 20 en 20 días («Ver registros
  anteriores · N días»). La «reseña al terminar» deja de aparecer en la cronología: la reseña vive solo en «Reseña».
- **Teclado del móvil**: mientras la ficha está abierta, si el visor visual encoge (teclado), la hoja se ajusta a la
  parte visible (`--sheet-vv-h`, `--sheet-vv-top`) y el campo enfocado se mantiene a la vista. En «Diario» el cuaderno
  ocupa todo el alto disponible y no cambia de tamaño entre secciones. Comprobado solo en emulación.
- **Estilos** en `diary-153.css` (clases `diary-head`, `diary-sections`, `diary-panel`, `my-review-page`, `diary-sheet`,
  `review-save`), con los recursos aprobados: marco de cuero con anillas (`notebook-frame.webp`, nueve zonas),
  `control-lino-salvia.webp` (pestaña elegida), `control-papel-crema.webp` (inactivas), `control-terracota.webp`
  (botón) y `botanical-sprig.webp`.
- **Noche (§50)**: Francisco entregó el fondo nocturno con la misma geometría (941 × 1672, comprobado superponiendo
  bordes): `SCENE_REFRESH.night = fondo-limpio-noche.webp`. De noche se pinta sobre el de día y se quita el velo; las
  capas recortadas de día (hiedras, enredadera, cortina) se tiñen (`filter`) y el disco de la luna de la app no se pinta
  (queda el astrolabio, ahora sobre la luna del fondo). El fondo trae la lámpara y la vela pintadas encendidas: apagarlas
  no las apaga en la ilustración.

## 52. Sin edición visual ebook, baldas con toda la biblioteca e importación de Goodreads (1.54.0)

### 52.1 Retirada de la edición visual «Kindle / E-Reader»

- La edición visual `kindle` (la única de dispositivo de tinta electrónica en el repositorio) se retira de los selectores
  (ficha, alta de libro y menú de edición de la librería): `SELECTABLE_EDITION_IDS`. El audiolibro no cambia.
- Resolución visual compartida `visualEdition(book)` (`domain/books.js`): `kindle` → `paperback`; edición conocida →
  la suya; desconocida → `paperback` (el fallback de siempre). La usan el libro físico y los lomos de la librería, las
  baldas de la habitación, el calendario y el ordenador. Nada se dibuja ya como lector: sin marco, botón ni batería.
- Los datos no se tocan: `editionType: 'kindle'` sigue siendo un valor legible (no se reescriben los registros), el
  libro conserva su seguimiento por porcentaje, sus páginas desconocidas, progreso, sesiones, reseñas y fechas.
  `isDigital(book)` mantiene el sentido de formato digital («ebook» en los resúmenes). Si el usuario elige otra edición
  para un libro antiguo, se guarda con la operación normal. Los libros nuevos no pueden elegir `kindle`; un formato de
  proveedor «ebook» ya no deduce edición (queda la predeterminada).

### 52.2 Baldas de la habitación con toda la biblioteca

- `RoomShelfBooks` toma los lomos de **toda** la biblioteca (Leyendo, Pendientes, Leídos y Abandonados, incluidos los
  importados), no solo de las lecturas. Selección estable: primero el libro abierto sobre la cama; después se alternan
  los estados (leyendo, leído, pendiente, abandonado) en el orden de cada balda de la librería (`shelfSort`), con el id
  como clave. Se llenan las dos baldas bajas (`cabinet`, `cabinet2`) con la geometría y el grosor físico de siempre
  (nunca se encogen); lo que no cabe no se dibuja, y la librería completa sigue a un toque, abierta en «Todos».
  Pocos libros: solo los que hay. Las baldas de arriba siguen siendo de las figuras.
- No cambian el selector del calendario (lecturas activas) ni el libro de la cama (`currentBook`).

### 52.3 Importar de Goodreads (CSV)

- **Entrada**: «Importar biblioteca» en el menú de herramientas de la librería. Panel «Traer mis libros de Goodreads»
  (`features/imports/GoodreadsImportPanel.jsx`, estilos `imports-154.css`) en cinco pasos: conseguir el archivo
  (instrucciones y enlace a https://www.goodreads.com/review/import), elegir CSV (selector del dispositivo; arrastrar es
  un extra), revisar, importar y resultado. Copia única: no se sincroniza después. Nunca se pide contraseña, cookies ni
  acceso a la cuenta; nada de scraping ni APIs privadas.
- **Lectura** (`goodreadsParser.js`): local, con PapaParse cargado bajo demanda (no al iniciar la habitación). UTF-8 con
  o sin BOM, CRLF/LF, comillas, comillas escapadas, reseñas multilínea, columnas extra y celdas vacías; delimitador
  detectado (`,`, `;` o tabulador) solo si la cabecera reconoce columnas de Goodreads. Límites: 20 MiB y 10.000 filas;
  si se superan, se explica antes de guardar. Un archivo ilegible o sin columnas de Goodreads da un error comprensible,
  nunca una importación vacía. El CSV no se sube a ninguna parte.
- **Mapeo**: `Exclusive Shelf` to-read → Pendiente, currently-reading → Leyendo, read → Leído; cualquier otro → «Estado
  por revisar» (se elige en la revisión). Estanterías como `dnf`/`abandoned` sugieren «Abandonado», sin aplicarlo
  solas. ISBN como texto (quita `="…"`, guiones y espacios; valida longitud y dígito de control; el inválido se guarda en
  la procedencia y no sirve para unir). `My Rating` 0 → sin valorar; 1–5 → valoración (nunca `Average Rating`).
  `Number of Pages` entero positivo o desconocido (seguimiento por porcentaje). Fechas `AAAA/MM/DD`, `AAAA-MM-DD` y
  `AAAA/MM` como fecha de calendario (sin desplazar por zona horaria); formatos ambiguos (`03/04/2020`) no se adivinan
  y se avisa. `Date Read` → terminado; `Date Added` → solo procedencia (no es inicio de lectura). Reseña privada como
  texto (las etiquetas HTML de Goodreads `<br>` pasan a saltos de línea; nada se ejecuta ni se publica). Estanterías
  personalizadas y `Read Count` se guardan en la procedencia (`book.importRef`); no son filtros activos ni generan
  sesiones. Leyendo sin progreso en el archivo: empieza sin posición registrada (se avisa).
- **Revisión** (`importPlanner.js`): se analiza todo el archivo antes de escribir. Coincidencias por orden: referencia de
  Goodreads ya importada (fiable → omitir), ISBN válido igual (fiable → omitir), título y autor normalizados (dudosa →
  pendiente de decisión; nunca se fusiona sola) y duplicados dentro del propio archivo (la segunda fila, omitir).
  Recuentos reales (nuevos, ya presentes, posibles coincidencias, por revisar, no válidas), lista paginada de 25 con
  título, autor, estado, puntuación, coincidencia y acción (Añadir · Omitir · Completar datos vacíos, que enseña qué
  campos cambian y nunca toca valores no vacíos, reseñas ni puntuaciones existentes). Se confirman las filas resueltas
  aunque queden dudosas.
- **Guardado** (`importService.js` + acciones `importStart`, `importBatch`, `importCancel`, `importUndo`): no reemplaza la
  biblioteca; cada fila es una operación con clave idempotente `importId:fila` y se aplica por lotes de 50, de uno en
  uno (el estado local es secuencial), confirmando cada lote con la escritura en el dispositivo (`persistNow`). El
  registro de la importación (`state.imports`: id, propietario, huella SHA-256 del archivo, estado, progreso, resultado
  por operación y referencias creadas/completadas) viaja con la biblioteca privada del usuario (la tabla de siempre, RLS
  del propietario): **no hace falta migración**. La nube sube el cambio como cualquier otro (cola persistente existente:
  `bookshelf:sync` con `dirty`); por eso se puede confirmar sin conexión. Reintentar aplica solo lo pendiente o fallido;
  repetir un lote ya aplicado no duplica (clave y referencia de Goodreads). Cancelar detiene los lotes siguientes y
  dice qué se guardó, sin fingir un rollback. Si cambia la cuenta, la revisión se invalida.
- **Recompensas**: importar no crea registros de lectura, sellos, rachas, pity, figuras ni reseñas al terminar; los
  libros leídos con fecha cuentan en las estadísticas históricas que ya usan `finishedAt`. Procedencia en
  `book.source = 'goodreads'` e `importRef`.
- **Portadas**: el CSV no trae portada; los libros importados usan la portada de Open Library por ISBN (la del proveedor
  ya integrado, cargada por la imagen solo cuando se pinta y cacheada por el navegador) y, si no hay, la portada
  tipográfica con título y autor. No se bloquea nada por la portada ni se tocan metadatos elegidos. Edición visual: la
  predeterminada (bolsillo), sin deducir materiales.
- **Resultado y deshacer**: añadidos, omitidos, completados y no importados con su motivo; «Ver mis libros» y «Revisar
  incidencias». «Deshacer importación» quita solo los libros creados por ese lote que siguen exactamente como se
  importaron (sin cambios, notas, sesiones ni reseña nueva) y devuelve los campos completados que conservan el valor
  escrito; lo demás se conserva y se informa. Es idempotente.

## 53. Leer EPUB en la app (1.55.0)

Encargo: EPUB local, sin subir el contenido; progreso y notas sincronizados con la cuenta; lector cargado solo al pulsar
«Leer»; límites para archivos muy grandes y libros con muchas imágenes.

- **Dónde**: en la Ficha del libro, «Libro digital»: «Añadir EPUB» (selector del dispositivo), y con el archivo en este
  dispositivo, «Leer» y «Quitar de este dispositivo». Si el libro tiene un EPUB guardado en otro dispositivo, se dice y se
  pide el mismo archivo (se reconoce por su huella SHA-256).
- **Local**: el archivo se guarda solo en este dispositivo (IndexedDB `bookshelf-files`, almacén `epubs`, por libro).
  Con la cuenta viajan únicamente sus metadatos (`book.epub`: nombre, tamaño, huella, capítulos y fecha) y la posición
  de lectura; el contenido nunca se sube.
- **Carga diferida**: JSZip y el lector (`features/epub/EpubReader.jsx`) se cargan al pulsar «Leer» (y JSZip también al
  elegir un archivo, para comprobarlo); nada al abrir la habitación ni la librería.
- **Lector propio** (sin dependencias antiguas): lee `container.xml`, el OPF y el orden de lectura (`spine`); cada
  capítulo se pinta en un `iframe` con `sandbox` sin scripts (el EPUB no puede ejecutar nada), con estilos de lectura de
  la app (Lora, papel crema, 18 px, tamaño ajustable), imágenes como `blob:` y enlaces externos desactivados. Capítulo
  anterior/siguiente, índice de capítulos y desplazamiento vertical (el iframe mide su capítulo y se desplaza su
  contenedor). Los enlaces internos no llevan `href` (nunca navegan solos); saltar con un toque funciona donde el navegador
  deja escuchar dentro del iframe (no en WebKit), y la selección se sondea cada 400 ms.
- **Límites**: archivo de hasta 60 MiB; contenido descomprimido de hasta 250 MiB (protege de archivos «bomba»); capítulo
  de hasta 4 MiB de texto. Con muchas imágenes (más de 300 o más de 40 MiB en imágenes) el libro se abre en «modo
  ligero»: cada capítulo carga como mucho 30 imágenes y las demás se sustituyen por su texto alternativo; se avisa.
  Un EPUB con DRM (contenido cifrado en `encryption.xml`, salvo la ofuscación de fuentes) no se abre: se explica. Fuera
  de los límites se explica el motivo y no se guarda nada.
- **Progreso**: posición = capítulo + fracción desplazada; porcentaje ponderado por el tamaño de cada capítulo. Se guarda
  en `book.epubPosition` (sincronizado) al pasar de capítulo, al cerrar y como mucho cada 5 s al desplazarse, sin tocar el
  registro de lectura. Al cerrar, si el porcentaje supera el progreso del libro, se ofrece «Registrar hasta el N %»:
  usa la operación normal (`setPage`, origen «epub»), así que las reglas de sesiones y sellos no cambian. Al reabrir, se
  vuelve a la posición guardada (también en otro dispositivo con el mismo archivo).
- **Notas**: seleccionar texto y «Guardar como nota» crea una anotación normal del libro (`addQuote`, con su color) con
  su posición (`epub: { chapter, href, frac }`): aparece en «Mi diario» → Notas y viaja con la cuenta. Desde el lector,
  la lista de notas del libro permite ir a cada una.

## 54. Vincular un EPUB a tu ejemplar y lector con la identidad de BookShelf (1.56.0)

Referencia visual: `docs/design/references/epub-vincular-leer-maqueta.webp` (dirección de arte, no
datos: ni su portada, ni sus páginas, ni sus porcentajes, ni su texto aparecen en la app). Se conserva el motor de la 1.55
(JSZip + iframe sin scripts); no se añade otra biblioteca de lectura.

### 54.1 Inspección (cómo estaba en la 1.55)

Vinculación implícita: elegir un archivo lo guardaba y lo enlazaba en el acto (`book.epub`, IndexedDB por id de libro).
Huella SHA-256 del contenido. Posición `book.epubPosition` = capítulo + fracción de desplazamiento, sincronizada al pasar
de capítulo y como mucho cada 5 s. Notas = anotaciones normales con `epub: { chapter, href, frac }`, sin archivo de
origen. Registro por `setPage` (operación normal). Datos locales: el archivo; sincronizados: la biblioteca entera (RLS del
propietario). Temporizador y sonido viven en `App` (uno solo de cada).

### 54.2 Modelo

- **Ejemplar** (el libro de siempre): id, título, autor, portada, edición, páginas, estado, progreso confirmado, diario.
  Vincular un EPUB nunca los cambia ni crea otro libro, ni reintroduce la apariencia de e-reader.
- **Archivo** (`book.epub`, sincronizado sin contenido): `hash`, `name`, `size`, `title` y `author` extraídos, `chapters`,
  `lite`, `anchors: 2` (versión de anclajes), `linkedAt`. Un archivo activo por ejemplar. Disponibilidad local: IndexedDB
  `bookshelf-files/epubs`, clave `usuario:libro` (las claves antiguas, solo por libro, se leen y se trasladan).
- **Posición** (`book.epubPosition`, sincronizada): `{ v: 2, hash, href, chapter, block, offset, frac, percent, rev, at }`.
  Ancla estructural: índice del bloque de texto visible arriba (párrafo, encabezado, elemento de lista…) y fracción dentro
  de él, más la fracción del capítulo como respaldo (las posiciones de la 1.55, sin `block`, siguen valiendo). Resiste
  cambios de letra, interlineado, márgenes, orientación y ancho. Pertenece a un archivo (`hash`): nunca se aplica a otro.
- **Notas**: anotación normal del libro con `id` estable (se crea al abrir la hoja: reintentar no duplica), `text`,
  `comment` opcional, color/categoría del usuario y `epub: { v: 2, hash, name, href, chapter, block, frac }`.
- **Porcentaje del archivo**: proporcional a los caracteres de texto legible de cada documento del orden de lectura
  (`linear="no"` excluido), no al número de documentos ni a sus bytes; independiente de letra y pantalla. Es una
  ubicación aproximada, no una prueba de lectura.

### 54.3 Vincular desde la ficha («Leer aquí»)

- Sin archivo: «Vincula un EPUB a este ejemplar.», «Elegir EPUB» (icono de documento) y «Tu portada y edición se
  conservarán.». Con archivo: «Continuar lectura» y un menú discreto («Cambiar archivo», «Quitar de este dispositivo»).
  Con el archivo en otro dispositivo: «Selecciona el mismo EPUB para continuar en este dispositivo.».
- Elegir un archivo solo lo analiza y abre la confirmación: Tu ejemplar (portada real, título, autor, edición y páginas
  si existen); Archivo seleccionado (nombre y título/autor extraídos, o que faltan); «El avance del EPUB se registrará por
  porcentaje. Tu portada y edición no cambian.» y «El archivo se guarda en este dispositivo.». Acciones: «Vincular y
  leer», «Elegir otro libro» (buscar otro ejemplar de la biblioteca por título o autor) y «Cancelar». Cancelar no toca
  nada; la vinculación se guarda solo al confirmar y el archivo anterior se sustituye en la misma transacción (si falla,
  queda el anterior y un error recuperable).
- Coincidencias (`domain/bookMatch.js`, sin red ni IA): título y autor normalizados (mayúsculas, espacios, diacríticos,
  puntuación superficial; los números de volumen se conservan) e ISBN como evidencia. Mensajes: «El título y el autor
  parecen coincidir.», «¿Este archivo corresponde a este libro?» (datos insuficientes) y «El archivo parece corresponder
  a otro libro. Revisa la vinculación.» (discrepancia: la acción pasa a «Vincular de todos modos»). Un ISBN distinto no
  impide vincular otra edición («Puedes leer otra edición conservando tu ejemplar.» si el título coincide).
- Cambiar a un archivo distinto pide confirmación; la posición del anterior no se aplica al nuevo (empieza en el índice);
  las notas antiguas se conservan con su procedencia.

### 54.4 Posición automática y progreso confirmado

- Posición: se guarda en el dispositivo 750 ms después de moverse (`localStorage`, clave por usuario y libro), en el
  libro sincronizado como mucho cada 60 s mientras haya cambios, al salir por la app y al ocultarse la pestaña
  (oportunista). No crea sesiones, recompensas ni cambios de estado. `rev` sube en cada escritura sincronizada; si al
  abrir hay una posición de este dispositivo y otra distinta de otro dispositivo hecha desde la misma `rev`, se pregunta
  dónde seguir (nunca se elige «la más avanzada» sin preguntar).
- Progreso confirmado: solo con el registro de siempre. Al cerrar, si la posición supera lo registrado, hoja «Una pausa
  junto al mar»: portada y título reales, «Registrado: X %» (si hay base fiable), «Has llegado al: Y %», la diferencia en
  puntos, «Corregir progreso» (0–100, sin vacíos ni NaN; no mueve el lector), el estado real de la posición («Posición
  guardada en este dispositivo», «Pendiente de sincronizar» o «Posición sincronizada», según la cola de la cuenta),
  «Registrar en el calendario» y «Volver sin registrar». Registrar usa `setPage` con origen «epub»: un intento bloqueado
  mientras se guarda y que no se repite; si lo confirmado ya llega a ese punto (otro dispositivo) no suma nada y se dice.
  Un libro por páginas pasa a porcentaje (`setTracking`) avisando de que sus sesiones anteriores no cambian; nunca se
  convierten porcentajes en páginas. Llegar al 100 % al registrar usa el flujo de terminado (reseña con cuartos de
  estrella, que se puede omitir); navegar al final no termina nada. Un libro leído no cambia de estado al leerlo.

### 54.5 Lector

- Rejilla `auto minmax(0, 1fr) auto` en `100dvh` (con `100vh` de respaldo) y áreas seguras; un único propietario del
  desplazamiento (el contenedor del capítulo; el iframe mide lo que su contenido). Cabecera de 56 px: volver, título,
  «Aa». Pie: Índice, Ambiente, Diario y «Posición en el archivo · N %»; «Sección anterior» / «Siguiente sección».
  «Ocultar herramientas» deja un botón discreto «Mostrar herramientas».
- «Aa»: letra 16–28 px (pasos de 1), interlineado 1,45/1,65/1,85, márgenes 16/24/32 px y tema claro o nocturno
  (`#211D19` / `#EADFCB`, solo el lector). Preferencias del dispositivo; cambiarlas no pierde la posición.
- Papel `#FAF5E8`, tinta `#2C1E14`, Lora 18/1,65, ancho máximo 68ch, alineación izquierda; se respetan cursivas, poesía,
  listas, notas al pie e imágenes. Cinta marcador decorativa de 12 × 48 px en el margen. Nada de transformaciones,
  filtros ni mezclas sobre el texto.
- Índice y Diario: hoja a todo el ancho en móvil y panel lateral de 360 px en escritorio, con cabecera, cierre, foco
  controlado y lo de detrás inerte.
- Enlaces: los de un mismo documento funcionan tal cual (notas al pie, con «Volver al texto»); los que llevan a otro
  documento se reescriben como `#bs-go-N-fragmento` y el lector, al ver ese fragmento, salta allí. Externos, sin enlace.
- Por qué hay sondeo: WebKit no ejecuta los escuchadores de la app dentro de un iframe con `allow-same-origin` y sin
  `allow-scripts` (comprobado en la 1.55: los eventos registrados desde la app no se disparan), y permitir scripts
  rompería el aislamiento. Mientras el lector está visible consulta cada 400 ms la selección, el fragmento y el alto del
  iframe; sin red; se detiene al ocultarse la pestaña o cerrar. En Chromium los eventos llegan antes y el sondeo solo
  confirma.
- Modo ligero: las imágenes diferidas muestran su descripción y «Cargar imagen» (enlace `#bs-img-N`) y se cargan bajo
  demanda sin perder la posición; una imagen que excede los límites lo explica sin bloquear el lector.

### 54.6 Notas, ambiente y habitación

- Seleccionar y «Guardar en mi diario» abre una hoja (papel, borde `rgba(114,91,70,.22)`, sombra suave, radio 16 px) con
  el fragmento, un comentario opcional y los colores y nombres personales del usuario; «Guardar nota» / «Cancelar». Sin
  selección: «Nota de esta sección» (sin fragmento inventado). Las notas no se publican. En «Mi diario» las notas de EPUB
  muestran su procedencia; si su archivo no está o es otro, se explica por qué no se puede abrir el fragmento.
- Ambiente: el mismo sonido de la habitación (el control de siempre) y el mismo temporizador de `App` (consultar, empezar
  o pausar; no pertenece a ningún libro, así que no hay conflicto). No se muestran duraciones que no se hayan medido.
- Libro de la habitación: su ficha muestra «Leer aquí» justo bajo el progreso, con «Continuar lectura» si hay archivo (o
  la petición del archivo). «Registrar lectura» manual sigue igual. La escena no cambia.

### 54.7 Criterios de aceptación

Vincular otra edición no cambia id, portada, páginas ni edición; cancelar conserva el archivo anterior; una discrepancia
exige «Vincular de todos modos»; la posición vuelve tras cambiar letra u orientación; el mismo archivo en otro
dispositivo recupera la posición; otro archivo no recibe anclajes; las notas sobreviven a quitar o cambiar el archivo y
usan las categorías personales; registrar porcentaje no inventa páginas; doble clic y reintento no duplican sesiones;
volver sin registrar no añade lectura; terminar abre la reseña; sin conexión o al cambiar de cuenta no se mezclan datos
(archivos y posiciones por usuario; el lector se cierra si cambia la cuenta); índice, enlaces, selección y guardado
funcionan en Chromium y en el WebKit de Playwright; el teclado no oculta «Guardar nota»; lector y parser no se cargan con
la habitación; ninguna petición transmite el archivo. Sin iPhone real: WebKit automatizado no equivale a Safari iOS.

## 55. Lector EPUB: estructura responsive, paneles con vuelta, lectura paginada y subrayados (1.57.0)

### 55.1 Inspección y causa del desbordamiento

- Estado en la 1.56: lectura solo por desplazamiento (el iframe mide lo que su documento y se desplaza el contenedor);
  cambio de sección por documento; paneles como capas `absolute` sin vuelta propia; posición anclada a un bloque de
  texto; notas con `epub: { hash, href, block, frac }`, sin rango ni marca en el texto.
- Reproducción (Chromium y WebKit de Playwright, 320 y 390 px, EPUB con URL y palabras larguísimas, tabla de 900 px,
  `pre`, imagen y SVG de ancho fijo y versos): el lector cabe; solo la tabla se desplaza dentro de su caja. **No se
  reproduce** el desbordamiento de las capturas en estos motores.
- Debilidades estructurales que lo explican y se corrigen: (1) el iframe tenía `width: 100%` sin tope; Safari de iOS
  dimensiona los iframes según el ancho de su contenido (comportamiento propio de iOS que el WebKit de escritorio no
  imita), así que un elemento ancho del EPUB ensancha el iframe y la capa de lectura lo recorta; se fija con
  `width: 1px; min-width: 100%; max-width: 100%` y todo lo ancho del documento se contiene (imágenes, SVG, tablas en su
  caja desplazable, `pre` y cadenas largas que se cortan). (2) La rejilla del lector no tenía columna explícita: un hijo
  ancho podía ensancharla y sacar flechas y cierres de la pantalla; ahora `grid-template-columns: minmax(0, 1fr)`,
  `min-width: 0` en cada nivel y `box-sizing: border-box`. Sin `overflow-x: hidden` como único remedio.
- Cabecera `44px minmax(0, 1fr) auto` (52 px de alto útil); pie con `44px minmax(0, 1fr) 44px` y una fila de
  herramientas de 46 px. Solo se truncan los metadatos de la cabecera, nunca el texto del libro.

### 55.2 Paneles

- Un único panel activo: ninguno (lectura), Índice, Ambiente, Diario o Ajustes. Cada uno con cabecera propia, título y
  «Volver a la lectura» (flecha visible con ese nombre); tocar otra vez su herramienta lo cierra; cerrar devuelve el foco
  a la herramienta y el texto queda exactamente donde estaba (el panel es una capa encima: no se recarga nada).
- Ambiente es una hoja compacta (abrirla no toca el temporizador ni el sonido; cerrarla tampoco). Diario e Índice usan
  el alto disponible con desplazamiento interno. Con un panel abierto, la lectura y sus flechas quedan inertes.
- Orden de vuelta (Escape y el botón Atrás del sistema): editor de nota o menú de subrayado → panel → salir del lector
  con el flujo de siempre. Una nota en edición que se cierra con Atrás conserva su borrador («Seguir con la nota»);
  «Cancelar» la descarta. Historial: al abrir la primera capa se añade **una** entrada (copia de la actual, para que la
  app no cambie de pantalla); cerrar la última capa por la interfaz la consume. Nada se apila por desplazamiento o página.

### 55.3 Forma de leer

- En «Aa», «Forma de leer»: «Desplazamiento continuo» (por defecto) o «Página a página»; se guarda en las preferencias
  del lector. Cambiar de forma (o de letra, interlineado, márgenes, orientación o herramientas) captura el ancla visible
  y la restaura; nunca registra progreso.
- Continuo: como en la 1.56 (un solo contenedor con desplazamiento vertical); «Sección anterior/siguiente».
- Página a página (`features/epub/epubLayout.js`): el iframe ocupa el área de lectura con los márgenes fuera de él (se
  aplican una sola vez) y su documento usa columnas CSS: `column-width` = ancho útil medido del iframe, `column-gap: 0`,
  `column-fill: auto`, alto = alto medido. Se pasa de página desplazando exactamente un ancho de iframe (sin escalar).
  El documento se desplaza en horizontal con `scroll-snap` nativo: deslizar el dedo pasa página sin capas encima del
  texto, sin `touch-action: none` y sin romper la selección ni los enlaces; botones «Página anterior/siguiente» y flechas
  del teclado (fuera de campos y paneles) hacen lo mismo. Al principio y al final de cada sección hay una página de
  paso («Sección anterior/siguiente: título»): llegar a ella abre la sección contigua (la siguiente por su primera página,
  la anterior por la última), así la lectura sigue sin saltos de capítulo. Contador: «Página 3 de 12 · esta sección»
  (páginas de pantalla, no de la edición física; el porcentaje global sigue aparte). Recalculado con 120 ms de espera
  tras cambios de tamaño, fuentes o imágenes; sin páginas vacías por redondeo. Libros RTL (`page-progression-direction`)
  se paginan en su sentido.
- Por qué el gesto es nativo: WebKit no ejecuta los escuchadores de la app dentro del iframe sin scripts, y permitir
  scripts rompería el aislamiento; el desplazamiento con `scroll-snap` funciona igual en todos los motores y el sondeo de
  la 1.56 (300–400 ms, solo con el lector visible) lee la página actual.

### 55.4 Subrayados

- Una nota con fragmento es un subrayado: el mismo registro (sin duplicarlo) gana un ancla de rango
  `epub.range = { v: 3, start: { block, offset }, end: { block, offset }, prefix, suffix }` (desplazamientos sobre el
  texto canónico de cada bloque, que las marcas no alteran) además de `hash`, `href`, `text` y color. Se pinta al cargar
  cada sección, al cambiar de página o de forma de leer, y al reabrir; refleja cambios de color o borrado hechos desde el
  diario. Las notas sin fragmento siguen sin marca.
- Resolución: primero el rango estructural (verificando que el texto coincide); si no, el fragmento con su contexto en
  la sección; si hay varias coincidencias posibles no se marca ninguna y la nota indica «Ubicación por recuperar».
  Notas de la 1.56 (sin rango): se buscan dentro de su bloque y solo se marcan si la coincidencia es única. Cambiar de
  archivo no traslada subrayados (cada uno lleva la huella de su EPUB).
- Pintado: CSS Custom Highlight API cuando el documento la ofrece (detección de capacidad); si no, `<mark>` creados con
  rangos del DOM (sin cadenas HTML, uno por nodo de texto, sin anidar al repetir, conservando enlaces y cursivas). Color
  de la categoría del usuario, translúcido (más opaco de noche), sin cambiar color, grosor, tamaño ni interlineado.
- Al tocar un subrayado (o desde su nota en el panel Diario): menú con su categoría, «Ver nota», «Cambiar color» y
  «Eliminar subrayado». Eliminar quita la marca y deja la nota en el diario; «Borrar también la nota» pide confirmación
  y avisa si se pierde un comentario escrito.

### 55.5 Aspecto

Cabecera de 52 px (volver, título, sección en segunda línea solo si cabe, «Aa»), pie compacto (anterior · posición ·
siguiente y herramientas de 46 px con estado activo por línea fina), paneles en papel `#FAF5E8` con borde
`rgba(114,91,70,.22)`, sombra `0 8px 24px rgba(44,30,20,.12)` y radio 16 px. Cuerpo 18/1,65; márgenes 24 px (20 px en
pantallas estrechas); escritorio en 68ch; capítulo `clamp(26px, 6vw, 36px)` sin grandes huecos antes. Ambiente sin
texto técnico («Tu ambiente te acompaña mientras lees.»). «Leer aquí» muestra el título y autor que trae el archivo.

### 55.6 Criterios

Todo cabe a 320, 390 y escritorio sin desplazamiento horizontal de la página; anterior/siguiente en las dos formas;
el modo paginado recorre todo el contenido y pasa de sección sin perder texto (y vuelve a la última página de la
anterior); los paneles siempre se cierran y devuelven el ancla; deslizar no impide seleccionar ni usar enlaces; tamaño,
orientación y forma mantienen la ubicación; un subrayado que cruza líneas y cursivas persiste al reabrir y refleja color y
borrado; un fragmento repetido no se ancla al azar; paginar y subrayar no crean sesiones ni recompensas; cerrar y abrir
no acumula marcas ni tareas. Sin iPhone real: WebKit automatizado no es Safari de iOS.

## 56. Visita a un rincón compartido (1.58.0)

### 56.1 Recorrido

- En «Social → Lectores», junto a cada lector que sigues (con perfil visible), el botón «Visitar rincón». El perfil de
  siempre sigue abriéndose al tocar la fila.
- Casa ilustrada (`casa-v1.webp`) con el alias y la ventana inferior derecha como único acceso. Al tocarla se reproduce
  una vez `entrada-v1.mp4` y se llega a la habitación (`habitacion-v1.webp`). «Saltar», «Entrar sin animación» y
  «Ver perfil» siempre a mano; casilla «Entrar siempre sin animación» (`localStorage` `bookshelf:visit-skip`).
- Habitación: hasta tres lomos destacados sobre la balda (SVG decorativo), botón de la balda «Libros · N» y pie con
  «Está leyendo «título»» (solo el título y solo si lo enseña), «Libros compartidos» y «Ver perfil». Sin libros: baldas
  vacías y un aviso. Sin figuras en este fondo.
- «Libros compartidos por X»: nota «no es su biblioteca completa», rejilla de tres con `PhysicalBook` y sus reseñas
  con `ReviewCard` (spoilers plegados). Ficha de cada libro con sus orígenes, la frase si la tiene, «Añadir a
  pendientes» explícito (`AddToPending`, extraído del perfil) y las reseñas de esa obra.

### 56.2 Datos (sin ampliar la visibilidad, sin tablas ni migraciones)

- `src/features/social/visit.js`: `sharedBooks` compone destacados (máx. 3, en su orden), los que le representan,
  última y próxima lectura y recuerdos si el rincón es visible, más las colecciones visibles. Claves
  `propietario:id`; sin id no se fusiona por título. Cada libro guarda sus orígenes, frase y `work_id`.
- Reseñas solo por `work_id` (`reviewsFor`), nunca por título. Nunca se lee la biblioteca sincronizada de otra persona.
- `useReaderCorner(userId)`: carga con número de secuencia y clave `espectador:usuario`; una respuesta tardía de otra
  persona se descarta y nunca se pintan los datos de la anterior. Lo usa también `ReaderProfileView` (antes podía
  enseñar un instante el perfil anterior). Un bloqueo en cualquier sentido oculta perfil, rincón y colecciones (RLS
  `is_blocked_pair`); el simulador de comunidad ahora lo imita.

### 56.3 Vídeo, historial y encuadre

- Estados casa → preparando → entrando → habitación, y error. El `<video>` no existe ni tiene `src` hasta tocar la
  ventana; `preload="none"`, `muted`, `playsInline`, sin bucle. Se ve solo con su primer fotograma. Si falla, si
  `play()` se rechaza o si tarda más de 6 s, se entra en la habitación con un aviso. Al ocultar la pestaña se pausa.
  Al entrar o desmontar se libera (`removeAttribute('src')` + `load()`). Movimiento reducido o la preferencia: se
  entra sin vídeo.
- Panel `{ type: 'visit', id, section: 'habitacion', select }`. Atrás: ficha/lista → habitación → casa → «Lectores».
  Al recargar en la habitación no se repite la entrada (`safeParent` reconstruye la vuelta sin historial).
- Marco 9:16 común a los tres recursos (720 × 1280), contenido y centrado; el sobrante es superficie de la paleta.
  Zonas en coordenadas normalizadas (`visitScene.js`: `HOUSE_WINDOW`, `ROOM_SHELF`, `shelfSpines`).
- Service worker: `/media/` y toda petición con `Range` quedan fuera (ni caché ni 206 guardados); sin precarga.
  Recursos en `public/media/social-visit/`; inventario e integridad en `docs/design/visita-social-*`.

### 56.4 Pruebas

- Vitest: `src/features/social/__tests__/visit.domain.test.js` (composición, claves, visibilidad, reseñas, escena,
  vuelta sin historial).
- `e2e-community/v158.spec.js` (Chromium y WebKit 390): recorrido completo con pendientes y Atrás paso a paso; cero
  peticiones del MP4 antes de tocar la ventana; recarga en la habitación; «Saltar»; cambio de persona durante la carga;
  lector bloqueado; lectura actual oculta; movimiento reducido y preferencia; encuadre a 360, 430 y 1440.
- Límites: el Chromium de Playwright no decodifica H.264 (allí se prueba el camino de error); WebKit sí reproduce el
  vídeo pero no expone su descarga al registro de peticiones. Sin iPhone ni Safari reales.

## 57. Hotfix de la auditoría del vídeo (1.58.1)

Detalle, causas comprobadas y aceptación en `docs/qa/video-hotfix.md`; capturas en `docs/qa/video-hotfix/`.

### 57.1 Figuras SVG provisionales retiradas (decisión de Francisco)

- `viajero_asteroide`, `bardo_viento` y `hechicera_eea` ya no existen como coleccionables: fuera del catálogo, de
  premios, sorteos, unboxing, detalle, exposición y rincones. Sus SVG se han borrado. No se redibujan ni se sustituyen.
- Cuentas antiguas: `owned` se conserva tal cual; `withoutRetired` (en `hydrate`) quita las retiradas de Guardián,
  Senda, baldas, sinergias, último premio y unboxing pendiente. Nada se convierte en otro premio.
- `boxHasPrize`: sin premio posible la caja no se abre ni se gasta («Caja guardada» y un aviso). Pesos, rarezas y
  pity sin cambios.
- «Simular lectura diaria (+1 Sello)» solo en desarrollo (botón y acción).

### 57.2 Visita social (sustituye en parte a §56.1 y §56.3)

- Sin opciones de animación: fuera «Entrar sin animación», «Entrar siempre sin animación» (`bookshelf:visit-skip`),
  «Saltar» y tocar la ventana. La entrada empieza sola al abrir la visita; después, la habitación. Una flecha discreta
  para volver. Error, `play()` rechazado, 6 s sin empezar o 4 s parado: habitación. Movimiento reducido: habitación sin
  vídeo.
- Pantalla completa: escena a sangre (cubre en vertical con recorte lateral 10/90; en pantallas anchas, recorte vertical
  ≤ 11 % y después contenida sobre la escena desenfocada); escena en `100lvh`; área segura solo en los controles
  flotantes. Casa, vídeo y habitación en una sola escena sin desmontar; fundido de 220 ms del último fotograma.
- Historial: la entrada sustituye su paso (`switchPanel`); Atrás desde la habitación vuelve a «Lectores».
- Un lomo por libro compartido en cuatro baldas (`SHELF_ROWS`, hasta `SHELF_CAPACITY` = 24).

### 57.3 Otros

- Biblioteca instalada como app: sin relleno superior en `.library` (la franja de la cabecera ya aplica el área segura).
- Reseñas: cabecera en rejilla; alias completo y fecha en una línea (`hotfix-1581.css`).
- EPUB: sin defecto de código; la vinculación de las capturas queda como discrepancia de datos pendiente de confirmar.

## 58. Pruebas al día y flecha del salón al pulsar (1.58.2)

- **Fallo real corregido**: la flecha «Abrir rincón social» se centra con `translateY(-50%)`, pero su estado pulsado
  (`room-146.css`) lo sustituía por `translateY(1px)`: al pulsar saltaba ≈ 23 px y el dedo se soltaba sobre la escena.
  Con movimiento reducido (sin transición) no llegaba a navegar nunca; ahora `translateY(calc(-50% + 1px))`.
- **Pruebas desfasadas actualizadas** (sin cambiar lo que comprueban): «Mi diario» por secciones (1.53) en
  `v123 colores`; «Sus lecturas» (1.43) en `v135` y `entrega3`; «Tu cuenta y copias» (1.46) en `entrega2`; la hoja
  «Vista y herramientas» se cierra antes de usar los filtros en apaisado (`v128`); el aviso de carteles se da por visto en
  `entrega3`.
- **Comprobaciones más precisas**: `v123 formulario` distingue un desplazamiento forzado del recorte natural del
  navegador cuando el formulario encoge al fondo; `panorama 9` cierra de dentro afuera (lista nativa del selector,
  desplegable, panel); esperas por estado en lugar de tiempos fijos en `v123 pulsación`, `v128 reseña` y `panorama 14`.
- **Limitación del entorno**: `v149` en `webkit-390x844` falla porque el WebKit de Playwright en Windows no dibuja bien
  `matrix3d` (las baldas salen inclinadas). Ya documentado en `BedBook.jsx`; no se desactiva la comprobación.

## 59. Biblioteca grande en el móvil y errores visuales del vídeo del iPhone (1.59.0)

Origen: grabación `VID-20261031-WA0014` (iPhone, 384 × 832, 231,7 s) con más de 1.000 libros. Causas, mediciones y
criterios en `docs/qa/iphone-large-library.md`; script de medición `scripts/perf-large-library.mjs`.

1. **Medir** (§59.1): `src/perf/PerfProfiler.jsx` (React Profiler solo en desarrollo, `window.__bsPerf`) y el script de
   medición con 100, 1.000 y 1.500 libros sintéticos (con portada, sin portada y con URL rota), Chromium 390 × 844, CPU
   ×4, mismas condiciones antes y después.
2. **Biblioteca** (§59.2): con la biblioteca cerrada no se monta ningún libro (antes, los 1.500 y sus portadas desde el
   arranque). Escaparate con **filas virtuales** (`CoverShelves`, desde 25 filas por balda): se montan las filas a 1,25
   pantallas de la vista y las dos primeras de cada balda (miden la fila con encabezado y una normal); las demás son la
   misma balda pintada, vacía y con su alto exacto (`.lib-shelf--ghost`). El hueco de cada libro es 2:3 de su columna:
   el alto de una fila no depende de las imágenes. Lomos con **ventana horizontal** (`useSpineWindow`, desde 120 lomos):
   anchos deterministas (`spineW`) y dos huecos con su ancho exacto. Búsqueda con `useDeferredValue`. Posición al volver
   de una ficha y al volver a entrar desde la habitación. El dado lleva a la vista un libro aún no montado.
3. **Portadas** (§59.3): una sola descarga por URL en la sesión (`watchCover`, fuera del ciclo de vida de los
   componentes): una URL que falla no se vuelve a pedir y una que llegó se pinta al momento al remontarse. Mientras
   llega, la tapa lisa del color del lomo (`.cover-img--wait`) con la geometría de la portada; si tarda más de 6 s o
   falla, la cubierta tipográfica. La portada ocupa siempre 2:3 (`contain`: completa, sin estirar). El lomo repite la
   portada solo cuando ya llegó (antes, cada lomo la pedía como fondo CSS, sin carga diferida). El color del lomo a
   partir de la portada (otra descarga con CORS) solo en la vista de lomos.
4. **Figuras** (§59.4): en el perfil de otra persona, la caja de cada figura tiene ancho y alto definidos; en WebKit
   quedaba con ancho 0 (nombre sin imagen). Una imagen de figura que no carga muestra su silueta de papel.
5. **Nube** (§59.5): la biblioteca es un documento por cuenta (sin paginación posible ni límite de filas); se pide antes
   solo `updated_at` y el documento entero únicamente si cambió; una copia sin lista de libros se rechaza; un cambio local
   hecho mientras se descargaba cuenta como pendiente (nunca se pisa en silencio).
6. **Visita** (§59.6): hasta que su primera imagen está decodificada, la visita no tapa la escena anterior (velo y fondo
   transparentes, escena a opacidad 0; como mucho 1,5 s); el vídeo lleva la casa como póster y se muestra con su primer
   fotograma presentado (`requestVideoFrameCallback`). «Visitar rincón» adelanta el código y la casa al tocarlo.
7. **Aviso de lectura** (§59.7): «Deshacer» caduca 8 s después del registro (`at`), aunque un panel lo oculte.
8. **Registro con teclado** (§59.8): el velo del registro sigue a `visualViewport` (`--vv-top`, `--vv-h`); el campo se
   coloca desplazando el panel por dentro, no la página.
9. **Perfil social** (§59.9): «Libros · N» en mitad del mueble (no bajo «Está leyendo…»); los nombres de quien sigues
   llegan sin esperar a la actividad y, mientras, un trazo de papel (no «Lector»); el rincón cargado en la visita se
   reutiliza un minuto en el perfil (sin repetir sus siete consultas) y la visita adelanta su escena y su avatar.

## 60. Comunidad en el cuaderno, avatares nuevos y libro de la cama (1.60.0)

Maquetas de Francisco: «Tu perfil lector», «Comunidad · Mi rincón», «Ambiente y recuerdos» y «Entre lectores».

1. **Marco** (decisión de Francisco): el panel de la comunidad va en el cuaderno de cuero con anillas (`NotebookShell`, el
   mismo recurso que la ficha del libro), con pestañas de papel (la elegida, clara y subrayada en latón) y un título por
   hoja: «Tu perfil lector», «Comunidad» (Mi rincón, En la sala, Club) y «Entre lectores». Se conservan las cinco
   pestañas y «Visitar rincón» (decisión de Francisco: no se quitan funciones). Estilos en `social-160.css`.
2. **Tu perfil lector**: avatar grande con el alias y «Solo compartes lo que tú eliges. Tu correo nunca se muestra»;
   alias; «Elige tu avatar» en tres columnas con la marca verde del elegido; «Participar en la comunidad»; «Guardar
   perfil» terracota entre dos ramitas; personas bloqueadas debajo.
3. **Avatares**: seis nuevos de `material-diseno` (Guardiana del farol, Lectora botánica, Encuadernador de bruma, Lectora
   de mapas, Zorro lector, Lectora marina), en `public/avatars` (webp 256 y png 462). El servidor solo admite los del
   catálogo: **migración `20261031120000_avatares_nuevos.sql`** (la aplica Francisco; hasta entonces, guardar un perfil
   con un avatar nuevo lo rechaza el servidor).
4. **Mi rincón** (`CornerEditor.jsx`, un solo formulario y un solo «Guardar mi rincón» para lo que antes eran dos):
   hoja principal con la escena de muestra (lo elegido, aunque no esté guardado), «Libros destacados · n/3» con portadas,
   «Cambiar libros» con buscador, «Figuras expuestas · n/3» con su caja, «Guardián expuesto» con miniatura y
   «Personalizar ambiente y recuerdos →»; hoja «Ambiente y recuerdos» con la escena, la luz (Día, Lluvia, Noche), la
   lectura actual, última y próxima, libros que te representan, recuerdos en tarjetas (hasta 3, cada uno con su libro
   y dedicatoria) y el adorno. Las colecciones siguen debajo de la hoja principal. La Hechicera de Eea de la maqueta
   **no** vuelve (sigue retirada, §57; confirmado por Francisco).
5. **Entre lectores**: «Lectores que sigo» en tarjetas (avatar, nombre y flecha; «Visitar rincón» bajo el nombre); «Lo
   que comparten» (antes «Actividad») con cada opinión sujeta por su clip de latón, portada, obra, autoría, quién y su
   valoración, el extracto y «…» (ver su rincón o denunciar con confirmación); los clubes en tarjeta salvia con «Entrar»,
   que abre ese club en su pestaña.
6. **Libro de la cama** (`room-160.css`): el progreso queda centrado en el hueco libre sobre el botón y «Registrar
   lectura» va a lo ancho de su texto, alineado con la columna, sin sombra flotante y con la luz rasante de la página.

## 61. Visita: habitación de llegada y «Los libros de X» (1.61.0)

Referencia: `docs/design/references/visita-rincon-libros-maqueta.png` (distribución y controles; el fondo de llegada y
las portadas son los reales). Estilos en `social-161.css`. Sustituye en parte a §56.1 y §57.2 (lo demás sigue igual:
entrada sin opciones de animación, fallos del vídeo, vídeo solo al abrir la visita).

### 61.1 Habitación de llegada (un acceso por cosa)

- Cabecera: la flecha para volver y un único acceso al perfil (avatar, alias y `›`). Fuera el icono de perfil aparte,
  la botonera inferior «Libros compartidos / Ver perfil» y el cartel grande «Está leyendo…».
- Estantería: los lomos de lo compartido siguen anclados a las baldas (`shelfSpines`, mismo tope de 24 y los destacados
  primero). La etiqueta de papel «Libros compartidos ›» (`SHELF_TAG`) cuelga del borde del mueble y va **dentro** del
  mismo botón que la zona (un solo control). Con Guías, además el contorno de la zona.
- Mesita: si la persona enseña su lectura actual, un libro pequeño de pie con cubierta tipográfica neutra (solo el
  título publicado) y la etiqueta «Está leyendo» (`TABLE_BOOK`, `TABLE_TAG`). Límite del fondo real: el único hueco
  libre es el extremo izquierdo del tablero (x ≈ 171–198, 26 × 39 px); la etiqueta cuelga del canto delantero, como en
  la maqueta, porque no cabe en otra parte sin tapar la planta, la taza o el mueble. Zona táctil ≥ 44 px invisible.
  Abre una ficha con el título y «Está leyendo»; sin reseña (no hay obra inequívoca).
- Al pie solo quedan estados honestos (cargando, error, rincón privado, sin libros).
- Lo interactivo aparece con un fundido de 240 ms al llegar; inmediato con movimiento reducido.

### 61.2 «Los libros de X»

- Vista frontal con las baldas de la biblioteca (`.lib-shelf`) y `PhysicalBook`: cabecera con «Volver al rincón»,
  avatar, «Los libros de X», número real («N libros compartidos»: todo lo compartido llega en una consulta, sin
  paginar) y buscador por título y autor sin tildes ni signos. Tres por fila en móvil (cinco en anchos). Sin títulos
  bajo las portadas, sin añadir ni herramientas. Estados vacío y sin resultados. Reseñas publicadas al final.
- Colecciones grandes: desde 12 filas solo se montan las cercanas a la vista; las demás son la balda vacía con su alto.
- Navegación: `select: 'libros'` y, al abrir un libro, `'libros/clave'`; la vista sigue montada bajo la ficha, así que
  al cerrarla vuelven la búsqueda, la posición y el foco. `safeParent`: libro → «Sus libros» → habitación → «Lectores».

### 61.3 Pruebas

`e2e-community/v161.spec.js` (320, 390, 430, 1440 y WebKit 390): accesos únicos y zonas táctiles, etiqueta y libro de
la mesita, búsqueda, posición y foco al cerrar la ficha, pendientes sin duplicar, reseña solo con obra inequívoca,
colección de 360 libros sin montarlos todos, sin lectura, rincón privado, cambio de persona, vídeo no pedido al
arrancar y roto, y el camino «Social» → tableta → «Lectores» → visita. `v158` y `v159` al día con los accesos nuevos.

## 62. Salón social y radio (1.62.0, por bloques)

Paquete `material-diseno/social-radio/BookShelf-social-radio/` (LEEME, PROMPT-CLAUDE, ESPECIFICACION, cuatro maquetas,
radio en gouache y pista piloto). Decisiones de Francisco: se sigue el paquete aunque cambie dos reglas anteriores
(visita con fachada, «Entrar» y «Saltar»; tres pestañas en la comunidad) y se trabaja por bloques, enseñando capturas
al terminar cada uno. Estilos en `social-162.css`.

### 62.1 Bloque 1 · Comunidad y tarjetas públicas (hecho)

- Tres pestañas principales: Lectores / Salón / Clubes (ids `lectores`, `sala`, `club`), que reparten el ancho y caben
  a 320 px sin desplazamiento. «Tu perfil lector» y «Mi rincón» (ids `perfil`, `rincon`) se abren desde tu avatar en la
  cabecera (menú pequeño; Escape lo cierra sin cerrar el panel) y tienen «← Entre lectores». La pestaña vive en la
  ubicación: cambiar de pestaña sustituye la entrada; abrir lo tuyo la apila (Atrás vuelve a la pestaña).
- Lectores (`ReadersSection.jsx`): buscador de la comunidad por alias (servicio `searchProfiles`: a partir de dos
  letras, máximo 20, la RLS solo deja ver perfiles públicos sin bloqueo); «A quienes sigues» con avatar (abre su perfil
  como panel `reader`) y «Visitar rincón»; «Lo que comparten»: opiniones compactas (quién, obra, valoración, extracto),
  con spoilers como franja «Contiene spoilers». La portada y «Leer reseña» abren la ficha pública del libro en lugar de
  la lista (la reseña entera con su protección de spoilers y «Añadir a pendientes»), nunca la ficha de un libro propio;
  al cerrarla vuelven la posición y el foco. Opiniones por páginas («Ver más opiniones», `fetchMoreActivity`).
- «Añadir a pendientes» detecta duplicados por la obra de la comunidad (`work_id` frente a `workId`) y, si no hay, por
  título y autor exactos; el libro nuevo guarda su `workId`.
- Pruebas: `e2e-community/v162.spec.js` (320, 390, 430, 1440 y WebKit 390); `entrega2` y `v159` al día.

### 62.2 Bloque 2 · Sillones del salón y visita con fachada (hecho)

- Sillón libre (`SocialSeats.jsx`): una etiqueta «Sentarme» sobre el cojín (pintada, no es un control: el toque pasa al
  sillón) y, al tocarlo, la elección aquí mismo en una tarjeta anclada (`SeatCard.jsx`) con `SeatChoice.jsx`: «Mi alias y
  mi lectura actual» (selector visible de tus libros en curso, la actual primero; el `<select>` nativo cubre la tarjeta con
  la portada) o «Solo mi alias» (el título no sale del dispositivo); «Sentarme a leer» y «Sentarte no registra páginas».
  Sin comunidad activa o ya sentado/a, el sillón libre abre la pestaña «Salón», que lo explica.
- Avatar sentado: tarjeta anclada junto al asiento con avatar, alias, su lectura solo si la comparte, tiempo, «Ver
  perfil» y «Visitar su rincón». La tuya lleva «Levantarme». La tarjeta va fuera de la escena (portal, encima de todo):
  arriba del asiento si cabe, si no debajo y, si tampoco, pegada al borde con su propio scroll (`placeCard`, probada);
  se recoloca si cambia su contenido. Escape, tocar fuera o la X la cierran y el foco vuelve al asiento. Se deja de
  enseñar si esa persona se levanta o caduca, si el salón sale de la vista o si cambia la cuenta.
- Solo presencia real con su caducidad de servidor (3 min sin renovar); sentarse no es estar conectado. Con más lectores
  que sillones, «+N lectores» abre la pestaña «Salón», que los lista a todos (sin amontonar retratos). El cuadro sigue
  abriendo los clubes.
- Pestaña «Salón» (maqueta 04, centro): «Tu lugar en el salón» con la misma elección (o, sentado/a, cómo te ven y
  «Levantarme») y «Leyendo en compañía» con todos los demás, su lectura si la comparten y «Ver rincón».
- Visita (`ReaderVisit.jsx`, regla de Francisco en CLAUDE.md): ya no arranca sola. Fachada con «El rincón de X» (avatar y
  alias) y «Puedes saltar la animación»; se entra tocando la ventana inferior derecha (`HOUSE_WINDOW`, atajo de puntero)
  o «Entrar al rincón» (el control accesible, deshabilitado mientras el rincón carga). Durante el vídeo, «Salir» (arriba)
  y «Saltar» (abajo, lleva a la habitación sin esperar); al terminar no se repite. Movimiento reducido o ahorro de datos
  (`navigator.connection.saveData`): directo a la habitación; un error del vídeo, también. El vídeo no se monta ni se pide
  hasta decidir entrar.
- Origen: la visita guarda `from` en la ubicación (`salon` desde la escena o la pestaña «Salón»; `lectores` desde
  Lectores). El botón dice «Volver al salón» o «Volver a lectores» y Atrás/Escape llevan allí; `safeParent` conserva el
  origen en la habitación y, sin padre (recarga), vuelve al salón o a «Lectores».
- Pruebas: `v162.spec.js` (sentarse con la lectura elegida, tarjetas, visita desde el salón y vuelta, pestaña «Salón»,
  más lectores que sillones; 320, 390, 430, 1440 y WebKit 390), `v158`/`v159`/`v161`/`entrega3` al día (fachada,
  «Entrar», «Salir», «Saltar», ventana) y Vitest `seats162.domain.test.js` y `navigation.test.js`.
- Diferencias con la maqueta 01 que quedan: el tiempo sentado sigue bajo el alias en la escena (la maqueta solo pone el
  nombre) y la ilustración de sillones de la pestaña «Salón» no se ha añadido (no hay recurso).

### 62.3 Bloque 3 · La radio del rincón (hecho)

- Recursos: `public/media/social-radio/brisa-de-papel-demo.mp3` (pista técnica de demostración del paquete) y
  `radio-v1.webp` (la radio en gouache recortada a 360 × 221, 32 kB). El catálogo es
  `src/features/radio/catalogo-radio.json`; `catalog.js` solo ofrece sintonías con pistas de fuente local, título,
  autoría y créditos (hoy, «Sintonía de prueba»): las sintonías de la maqueta sin audio no aparecen. El service worker ya
  deja `/media/` y las peticiones con rango a la red (nada de precachear el catálogo).
- Un solo reproductor para toda la app (`radioPlayer.js`, fuera de los componentes): un único `Audio`, creado con el
  primer «Reproducir»; nada suena ni se descarga antes. La interfaz enseña el estado real (cargando, sonando, en pausa,
  error) a partir de los eventos y de la promesa de `play()`. Cerrar el panel, ir al lector o al diario no lo para. La
  música pasa por una ganancia de Web Audio (iOS no deja cambiar el volumen del elemento). Volumen del ambiente aparte
  (`setAmbienceVolume` en `ambientAudio.js`). Sintonía y volúmenes en `bookshelf:radio` (sin historial); al recargar,
  en pausa. Temporizador 15/30/60/No por hora límite, comprobado también al volver del segundo plano: pausa la música y
  deja el ambiente como esté. MediaSession solo si existe (no se promete reproducción en segundo plano).
- Salón: la radio está en el único hueco libre de la mesa (`SOCIAL_SPOTS.radio`), delante a la izquierda, sin tapar la
  tableta, las tazas, la tetera ni las hojas; sombra de contacto CSS bajo las patas y zona táctil ampliada. Abre el panel
  `radio` (hoja de papel inferior en el móvil): sintonías, pista y autoría, reproducir/pausar (anterior y siguiente solo
  con más de una pista), Música y Ambiente, «Apagar la música en» y créditos. En pantallas anchas el encuadre deja la
  mesa fuera de la vista (también la tableta): por eso «Ambiente» (arriba) tiene «Música: la radio del rincón».
- Lector EPUB: «Ambiente» lleva a la hoja «La radio del rincón» (los mismos controles con los colores del tema del
  lector) y, si ya has puesto música, un control compacto en el pie de herramientas (pista, estado, pausa y abrir la
  radio): nunca sobre el texto ni en los gestos de página; abrir y cerrar la radio no mueve la lectura.
- «Mostrar mi sintonía»: el servidor no tenía el campo. Migración preparada, **sin aplicar**:
  `20261031200000_radio_sintonia.sql` (`profiles.radio_station`, solo el id público). La opción no se enseña hasta que
  esté aplicada; la prueba de RLS ya cuenta con la columna.
- Pruebas: `e2e/v162-radio.spec.js` (un solo reproductor, nada antes de pulsar, sigue al cerrar, recarga en pausa,
  volúmenes recordados, temporizador al volver del segundo plano, error dicho, EPUB) en 360, 390, 430, 1440 y WebKit 390;
  Vitest `radio/__tests__/catalog.test.js`. Sin iPhone real: ni volumen ni reproducción en segundo plano comprobados
  allí.
- Pendiente de Francisco: escuchar la pista piloto y decidir si se queda; las sintonías de la maqueta no tienen música.

### 62.4 Bloque 4 · Clubes (hecho)

Encargo: apartado 5 de `PROMPT-CLAUDE.md` y columna derecha de `maquetas/04-comunidad.png`. Código en
`src/features/social/components/ClubTab.jsx` (reescrito `ClubView` y `Message`; la lista de clubes, igual) y
`src/styles/club-162.css` (nueva, importada al final).

- **Dentro del club**: «‹ Mis clubes», el nombre con su «…» y tres pestañas (`role="tablist"`), fijas arriba al leer:
  **Lectura** (obra, descripción y punto de debate), **Conversación** (se abre por defecto y por el final) y
  **Miembros** (avatar, nombre, «Propietario» o «Tú»; el propietario puede retirar a alguien, con confirmación). El club
  ya no lleva un segundo cuaderno dentro del de la comunidad.
- **Menú del propietario** («Opciones del propietario del club»): «Administrar el club» (punto de debate e invitaciones
  revocables, con «Volver al club») y «Archivar el club», con confirmación y el foco en «Cancelar». Quien no es
  propietario solo ve «Salir del club», también con confirmación. Nada de esto va entre los mensajes.
- **Conversación**: contexto «Debate: …» y «Los mensajes con spoilers se ocultan hasta que decides verlos». El punto de
  debate es una guía, **no** un bloqueo por capítulo (no hay datos para prometerlo). Mensajes de 20 en 20 (paginación por
  cursor del servidor) en **orden de lectura**: «Ver mensajes anteriores» arriba, lo último abajo. Cada mensaje: avatar,
  nombre, fecha y su bocadillo; con spoilers, plegado al recibirlo (ojo tachado y texto, no solo color) hasta que quien
  lee lo abre. Sus acciones (editar, borrar; retirar si eres propietario; denunciar, bloquear) van en su «…».
- **Redactor**: fijo al pie de la hoja, con el campo, el envío terracota («Publicar») y «Contiene spoilers»; sin adjuntos
  ni mensajes privados (la maqueta dibuja un icono de imagen: no se añade). Por encima del teclado: el velo de la
  comunidad sigue a `visualViewport` (`--vv-top`, `--vv-h`, como el registro de la 1.59; `PanelShell` lo activa
  también para `social`).
- **Autorización en el servidor**: sin cambios de esquema; la RLS de la entrega 3 ya limita editar, archivar, invitar y
  retirar al propietario, y leer y escribir a los miembros (nunca en un club archivado). `entrega3.rls.test.js` comprueba
  además que un miembro no puede archivar aunque lo intente sin la interfaz.
- Pruebas: `e2e-community/v162-clubes.spec.js` (propietaria, miembro y teclado simulado) en 320, 390, 430, 1440 y
  WebKit 390; `entrega3` al día. El simulador entiende ahora el `or` de la paginación por cursor (antes repetía la
  primera página). Sin iPhone real: el teclado se ha simulado.
- No se ha usado la acuarela de la cabecera de la maqueta (no hay recurso): no se improvisa.

## 63. «El edificio del puerto» en la app (1.63.0)

Idea de Francisco (1-11-2026), a partir del devblog de un juego de pixel art en el que se decora una casa: tu piso
cozy en un edificio con vecinos que se visitan. Del vídeo se toma el género, nunca su arte. **No sustituye** al rincón
ilustrado ni a su visita. Código en `src/features/edificio/`; usa el rasterizador y el audio de
`src/features/minigames/libreria-puerto/`. Plan y capturas del prototipo: `docs/qa/edificio-puerto.md`.

- **Entrada**: la tablet del Salón Social pregunta, en una tarjeta «La tablet», entre «Comunidad» (lo de siempre) y
  «El edificio del puerto». Mientras la migración no esté aplicada (o sin sesión, o sin comunidad activada) la tablet
  hace lo de antes: abrir la comunidad (`edificioAvailable()` prueba la tabla `pisos` y solo recuerda un «sí» o un «no»
  claros).
- **Panel** (`EdificioPanel.jsx`, cargado bajo demanda, `PanelShell` con `variant="edificio"`: hoja inferior en el
  móvil y tarjeta centrada desde 700 px). Paneles `{ type: 'edificio' }` (portal) y `{ type: 'edificio', id }` (un piso);
  Atrás del sistema vuelve del piso al portal y del portal al salón (`safeParent`).
  - **Portal**: seis puertas (3.º B … 1.º A) con la miniatura de cada piso a la luz de tarde, «Tu piso» resaltado,
    «Puerta libre» en las vacías y «Tu buzón» con los sellos recibidos.
  - **Tu piso**: «Decorar» con catálogo, girar, color, quitar, arrastrar o tocar para mover y teclado; se guarda solo
    (900 ms después del último cambio, «Guardando…» / «Guardado.», y al salir si quedaba algo). La primera vez se crea
    con unos pocos muebles y se guarda. Escape suelta el mueble elegido sin cerrar el panel (`data-escape-local`).
  - **Piso de un vecino**: solo mirar, «Luz de tarde» y cuatro sellos de frase cerrada (sin texto libre); tocar el
    mismo otra vez lo quita.
  - Sin comunidad activada: lo explica y lleva a «Activar la comunidad en mi perfil».
- **Reglas del piso**: cuadrícula 9 × 9, capas alfombra / suelo / encima / pared, máximo 40 muebles, catálogo gratis de
  24 (no toca recompensas, cajas ni pity).
- **Servidor** (`supabase/migrations/20261101120000_edificio_puerto.sql`, aplicada en producción el 1-11-2026):
  - `piso_catalogo` y `piso_valido(layout)`: la misma validación que `validateRoom` (un fuzz de 300 pisos en
    `edificio.rls.test.js` comprueba que coinciden).
  - `edificios` y `edificio_vecinos` (sin acceso directo). `asignar_edificio()` reparte **al azar** (decisión de
    Francisco): solo perfiles con la comunidad activada, primero edificios con hueco (hasta seis), puerta libre al
    azar, con un candado para que dos altas a la vez no choquen; si ya tienes puerta, la devuelve.
  - `pisos`: escribe solo el dueño, y solo un piso válido (disparador); lo leen los vecinos del mismo edificio con la
    comunidad activada y sin bloqueo entre ambos.
  - `piso_sellos`: uno por pareja, solo entre vecinos, a tu nombre; lo ven quien lo da y quien lo recibe.
  - `edificio_portal()`: tu edificio en una consulta. Quien te bloquea, a quien bloqueas o quien desactivó la comunidad
    no sale (su puerta se ve como cualquier puerta libre: no se delata un bloqueo).
- Pruebas: `src/features/edificio/__tests__/` (reglas y RLS con PGlite), `e2e/edificio-puerto.spec.js` (página de
  desarrollo) y `e2e-community/v163-edificio.spec.js` (tablet, portal, guardado, visita con sello, Atrás y sin
  comunidad) en 390 Chromium y WebKit y en 1440. Sin iPhone real.
- Pendiente de decidir: qué pasa con la puerta de quien deja la app; ilustraciones de muebles si las cajas no bastan e
  icono del edificio; el directo (presencia) más adelante.

## 64. «El edificio del puerto» con más personalidad (1.64.0, por bloques)

Encargo de Francisco (1-11-2026), en tres bloques con capturas entre uno y otro. Reglas en CLAUDE.md (edificio).

- **Fachada** (`facade.js`, `facadeView.js`, `windowView.js`): el edificio en pixel art con el mismo motor, en el estilo
  de una foto de referencia de Francisco (se toma el estilo, no se copia): estuco mostaza, pilastras, un cuerpo de dos
  ventanas por piso con recerco del color de su pared y balconcitos de hierro, escalera central, cornisa, torreones,
  planta baja con librería, portal y café. En la azotea, el cartel **«AQUÍ NO HAY QUIEN LEA»** con letra propia en
  píxeles (guiño a «Aquí no hay quien viva»; nunca su logotipo). Por cada ventana se ven, de frente, las piezas más
  reconocibles del piso (siluetas); las puertas libres tienen la persiana bajada. Al tocar una ventana la vista se
  acerca y entras; al volver se aleja desde ella (sin animación con movimiento reducido).
- **Piso integrado** (`piso.js`, `pixelUi.js`, `render.js`): todo lo que rodea a la habitación usa el mismo pixel art
  (marcos de papel, madera y salvia; iconos propios a 3 px por píxel). La habitación ocupa el ancho, con «Decorar» y la
  luz en las esquinas y las herramientas del mueble elegido flotando junto a él. El catálogo es una **balda** de madera
  abajo, con pestañas que llevan el dibujo de un mueble; un mueble se arrastra de la balda al piso (se ve colocado bajo
  el dedo y cae donde se suelta; fuera de la habitación vuelve) o se toca para ponerlo en el centro. «Paredes y suelo»
  y «En el piso» son pestañas de la balda.
- **Vista «dentro de la habitación»** (por defecto en la app): el panel ocupa la pantalla, la habitación es tan grande
  como quepa sobre un telón tramado (`backdropImage`), la balda ya abierta abajo en tu piso y los sellos abajo en el de
  un vecino. «Ver como ficha» / «Entrar en la habitación» cambia de vista y se recuerda en el dispositivo
  (`bookshelf:edificio:vista`).
- **Sets de sagas**: pestaña «Sagas» en la balda con una fila de sets; cada set lleva **nombre propio** y el guiño
  «Para quien leyó …» debajo de sus muebles. Son objetos corrientes que evocan cada saga, sin portadas, logos, emblemas
  ni diseños oficiales (`SETS` y `cat: 'sagas'` en `catalog.js`, formas en `furniture.js`):
  - *Nido de jinetes* (Alas de sangre): brasero, silla de montar, huevo de dragón, dagas en la pared.
  - *Bruma y ceniza* (Mistborn): farol de bruma, viales de metal, monedas, ventana de ceniza.
  - *La posada del camino* (El nombre del viento): barra de posada, barril, laúd, espada en la pared.
  - *Corte de rosas y estrellas* (Una corte de rosas y espinas): rosal, arco de rosas, máscara, ventana de estrellas.
  - *Luz de tormenta* (El archivo de las tormentas): esferas de gemas, lámpara de gemas, atril, cuadro de tormenta.
  - El catálogo pasa de 24 a 44 muebles, todos gratis (no toca recompensas, cajas ni pity).
- **Servidor**: `supabase/migrations/20261102120000_edificio_sagas.sql` (aditiva y re-ejecutable) añade los veinte a
  `piso_catalogo`. **Sin aplicarla, guardar un piso con un mueble de sagas lo rechaza `piso_valido`**. La prueba de
  paridad de `edificio.rls.test.js` carga todas las migraciones.
- **Peso**: el panel se carga al abrirlo, 70 KB de JS (26,6 KB comprimido) y 15,3 KB de CSS (3,9 KB).
- Pruebas: `e2e/edificio-puerto.spec.js` (con «la balda» y «sagas») y `e2e-community/v163-edificio.spec.js` (vista
  «dentro» y cambio a ficha), en Chromium 360/390/1440, WebKit 390 y movimiento reducido. Sin iPhone real.

## 65. Portal del edificio con más vida y balda corregida (1.65.0)

- **Portal** (`.ed-portal` en `EdificioPanel.jsx`): el panel toma el cielo del dibujo arriba y el agua del puerto abajo;
  el título va sobre el cielo y la fachada llega de borde a borde (en pantallas anchas sus lados se funden con el fondo).
- **Llegada** (`facadeView.js`): al abrir el portal, la vista sube desde el muelle (1,1 s) y las placas aparecen al
  final. Al volver de un piso sigue alejándose desde su ventana, como en la 1.64.
- **Vida** (capa `.ed-ambient`, solo CSS sobre el dibujo, sin sonido): las estrellas ya pintadas titilan; los cristales
  de los pisos ocupados (`panes` de `facade.js`) tienen una luz que respira; destellos de píxel corren por el agua bajo
  la orilla (`shore`); una gaviota de píxeles cruza el cielo cada ~19 s. Con movimiento reducido no hay nada de esto.
- **Balda**: los textos para lector de pantalla de las pestañas (`.px-sr`, absolutos) se salían de su fila y dejaban
  desplazar la balda entera 160 px más allá de los muebles; ahora `.ep-chip` y `.ep-set` los contienen y `.ep-shelf`
  recorta de lado (`overflow-x: clip`).
- **«En el piso»**: cada mueble de tu piso, de pie en la balda con su dibujo y su color, como el catálogo
  (`.ep-inroom__item`); se recorre de lado y el elegido se levanta con su nombre en papel. Tocarlo lo elige como antes.
- Pruebas: `e2e/edificio-puerto` y `e2e-community/v163-edificio` (la captura del portal espera al final de la llegada).

## 66. Inventario de muebles del edificio (1.66.0, fase 1 de la economía de muebles)

Plan completo y decisiones de Francisco (1-11-2026, «Sí a todo») en `docs/qa/economia-muebles.md`. Esta fase solo
añade copias: no hay tickets, tienda ni sorteo todavía, y nada toca figuras, Cajas Sorpresa ni pity.

- **Servidor** (`supabase/migrations/20261103120000_edificio_inventario.sql`, aplicada en producción el 1-11-2026):
  - `piso_catalogo` gana `rareza` (todo `comun` hasta la fase 3) y `saga`.
  - `piso_inventario` (copias por mueble) y `piso_cuentas` (si ya eligió los de inicio), sin acceso directo desde la app.
  - La primera vez que se pide o se guarda, `piso_inventario_asegurar` da una copia por cada mueble colocado en el piso
    guardado (las que haya) y, como mínimo, los diez del piso inicial (`starterRoom`). Nadie pierde nada.
  - `piso_mi_inventario()` devuelve `{ inicio_elegido, copias }`; `piso_elegir_inicio(muebles)` da seis comunes, una
    sola vez (se pueden repetir).
  - Al guardar un piso (`pisos_validate`), además de `piso_valido`, no puede haber más copias colocadas que las tuyas
    (`piso_falta_copia`). Los muebles de sagas no cuentan: siguen libres hasta la fase 5.
- **App** (`inventory.js`, `StarterPicker.jsx`, `piso.js`, `EdificioPanel.jsx`, `service.js`):
  - La balda solo enseña lo que tienes, con una etiqueta «×N» de copias libres; lo agotado se queda apagado, no se
    arrastra y al tocarlo explica que ya está en tu piso (guardarlo lo libera). Una categoría sin nada lo dice.
  - Mientras no hayas elegido, «Elige tus 6 muebles» en la barra abre «Tu mudanza»: una caja de seis huecos y los
    comunes por tipo; se quitan desde la caja; «Llevármelos» los pide al servidor y llegan a la balda. «Más tarde» la
    cierra.
  - Sin la migración aplicada (la función no existe), la app sigue como en la 1.65: todo libre.
- Pruebas: `src/features/edificio/__tests__/inventario.rls.test.js` (PGlite; monta la base sin la migración, guarda
  pisos «de antes» y la aplica), `e2e-community/v166-inventario.spec.js` (320, 390, 1440 y WebKit 390) y el simulador
  (`mockSupabase.js`, solo con `db.piso_cuentas`).
- Pendiente: los sonidos propios del edificio (§6 del plan) no están en esta fase.

## 67. La tienda del bajo, sus sobres y misiones que pagan en tickets (1.67.0, fases 2 y 4 de la economía de muebles)

Encargo de Francisco (1-11-2026): «vamos con la siguiente fase» y, además, un sistema de sobres «tipo gacha» con
animaciones propias en el mismo estilo, que ocupe el lugar de las figuras («retirar por ahora el tema de las figuras»).
Respuestas suyas: **ocultar las figuras sin borrar nada** y **sobres de 1 y de 5** (el de 5 con algo mejor asegurado).
Límites que se mantienen: las probabilidades se ven, hay pity, no hay falsos «casi», cuentas atrás ni prisas, y los
tickets solo se ganan leyendo (nunca con dinero).

- **Servidor** (`supabase/migrations/20261104120000_edificio_tienda.sql`, **aplicada en producción el 1-11-2026**; aditiva):
  - Rarezas: poco común sofá, cama, estufa, radio, reloj y guirnalda; raro el gato dormido. Lo demás, común.
  - `piso_cuentas` gana `tickets` (30 de bienvenida) y `sin_raro` (para el pity). `piso_reclamos`: una fila por
    misión y semana, sin acceso directo.
  - `piso_mi_inventario()` devuelve también `tickets`, `sin_raro` y `reclamadas` (claves `mision:<id>:<lunes>`).
  - `piso_reclamar_mision(mision, semana)`: 12 tickets, una vez por misión y semana, solo misiones conocidas y el
    lunes de esta semana o de la anterior. La app sigue calculando si está cumplida (como siempre).
  - `piso_comprar(mueble)`: común 20, poco común 40; lo raro y lo de sagas no se vende.
  - **Sobres por tipo y temporada** (segunda vuelta del mismo día, ver abajo). `piso_sobre(id)` define cada sobre y
    tiene su copia exacta en `SOBRES` de `economy.js` (la prueba de paridad lo exige). Temporada 1, «Otoño en el
    puerto»:

    | Sobre | Muebles | De 1 / de 5 | Raro / poco común |
    | --- | --- | --- | --- |
    | Sala de estar (`salon`) | asientos, mesas, estantería y cama | 10 / 45 | 6 % / 24 % |
    | Luces del puerto (`luces`) | lámparas, estufa, ventana, cuadro, reloj y guirnalda | 10 / 45 | 6 % / 24 % |
    | Balcón y detalles (`balcon`) | plantas, libros, radio, tetera, gato y alfombras | 10 / 45 | 6 % / 24 % |
    | Edición coleccionista (`coleccion`) | todo el catálogo | 25 / 110 | 15 % / 35 % |

  - `piso_abrir_sobre(sobre, 1 | 5)`: dentro de cada rareza, todos los muebles del sobre igual; si el sobre no trae
    nada de esa rareza (p. ej. el gato solo está en el balcón), ese mueble sale de todo el catálogo y la tienda lo dice
    («de fuera del sobre»). Pity: el 15.º seguido sin nada raro es raro, en cualquier sobre. En el de 5, si los cuatro
    primeros son comunes, el quinto es poco común. Devuelve `{ premios: [{ mueble, rareza, nuevo }], inventario }`. El
    sorteo es del servidor; un sobre que no existe se rechaza.
  - `piso_reciclar(mueble)`: una copia que no está colocada en tu piso guardado, por 3, 8 o 20 tickets.
- **App**:
  - Fachada: el café de la planta baja es ahora «la tienda del bajo» (escaparate con muebles, toldo y un cartel con un
    sobre lacrado); su placa enseña el saldo y al tocarla la vista se asoma, como en las ventanas. Ruta:
    `{ type: 'edificio', id: 'tienda' }` (Atrás vuelve al portal). Sin la migración, el escaparate es solo dibujo.
  - **Por dentro, el antiguo videoclub** (`shopScene.js`, encargo de Francisco con una captura de una tienda de sobres
    de un juego de cartas y el videoclub de «Aquí no hay quien viva»: se toma el género y la idea, nunca su arte, sus
    logos ni sus personajes). Perspectiva de un punto: tubos fluorescentes, suelo de baldosas en damero, estanterías de
    cintas, un cartel «VIDEOCLUB» tachado con un papel que dice «MUEBLES», y la **pared de sobres** colgados de sus
    ganchos. Detrás del mostrador, **la dependienta** (personaje propio: moño, gafas redondas y rebeca mostaza) con
    caja registradora y timbre; parpadea a ratos y mueve la boca al decir algo nuevo.
  - `Tienda.jsx`: saldo; los sobres de la pared son botones encima de su hueco (el elegido se descuelga y lo marcan
    cuatro esquinas de latón); debajo, el bocadillo: barra granate con el nombre y los precios y un papel donde la
    dependienta dice qué trae ese sobre, lo que falta si no llega, y los avisos de compra, reciclado o error (letra a
    letra; con movimiento reducido, de golpe; se anuncia entero una vez). Pestañas Sobres / Muebles / Reciclar,
    «Abrir 1» y «Abrir 5» del sobre elegido, contador del pity, probabilidades de ese sobre (desplegable) y
    confirmación antes de gastar («Te faltan N» si no llega).
  - Sobres con aspecto de sobre de cartas (`packArt` en `shopArt.js`): metalizados del color de su tipo, dientes
    plateados arriba y abajo, banda con un ancla y el «1» de la temporada, ventana con rayos y el mueble de portada; el
    de coleccionista, dorado y con destellos.
  - `GachaReveal.jsx`: el sobre elegido tiembla a ratos con un halo del color de lo mejor que trae (lo único que se
    adelanta, y es verdad); se toca para rasgarlo: la tira de arriba sale volando, salen rayos en escalones y el sobre
    se apaga; las cartas se
    reparten boca abajo y se dan la vuelta tocándolas o con «Revelar todo»; poco común con rayos de salvia y raro con
    latón, salto y aro. «Nuevo» si no tenías ninguna. Con movimiento reducido, directo al resultado.
  - Sonidos (`shopAudio.js`, sintetizados, solo tras tocar y con el sonido de la app): papel, rasgado, carta, una nota
    por rareza (más notas cuanto más rara), compra y reciclado.
  - Dibujos en el mismo pixel art (`shopArt.js`, iconos `ticket` y `sobre` y marcos con canto de rareza en
    `pixelUi.js`). Estilos en `tienda.css`.
  - **Misiones del ordenador**: cada misión cumplida se cobra en 12 tickets (`useMissionTickets.js`); sin comunidad o
    sin la migración lo explica y no se cobra (la misión no se gasta). La misión cobrada se apunta también en la
    biblioteca, como antes.
- **Figuras ocultas** (`FIGURES_ENABLED = false` en `src/domain/figures.js`): sin vitrina en la habitación ni en
  su recorrido, sin figuras en las baldas ni mini-figuras en la biblioteca, sin Ático, detalle ni Guardián (una URL
  antigua no abre nada), sin Guardián en los sillones del salón y sin figuras en el rincón ni en el perfil. No se borra
  nada: inventario, Cajas, sellos y pity siguen guardados, y lo elegido en «Mi rincón» se conserva al guardar.
- Pruebas: `src/features/edificio/__tests__/tienda.rls.test.js` (PGlite: paridad de números con `economy.js`,
  tickets, tienda, sobres por tipo con lo que trae cada uno, pity, «nuevo», reciclar y permisos),
  `e2e-community/v167-tienda.spec.js` (pared, dependienta, coleccionista; 320, 390,
  1440 y WebKit 390; el simulador sortea lo que la prueba pone en `db.piso_sorteo`). Las pruebas antiguas de figuras se
  saltan con `FIGURES_ENABLED` (y dicen por qué); `v166` elige comunes porque el sofá ya no lo es.

## 68. La tienda por dentro, con el motor de los pisos y las secciones en la escena (1.68.0, maquetas de Francisco)

- **Encargo**: dos imágenes de referencia de Francisco (una tienda acogedora ilustrada y un primer plano del mostrador
  con la dependienta). Se toman solo el género y las ideas, nunca su arte. Tras una primera ronda en 2D («muy plano»),
  pidió que se pareciera a las habitaciones, con más detalle y profundidad, y que Sobres/Muebles/Reciclar estuvieran
  integrados de forma orgánica, sin quitarle protagonismo a la tienda.
- **El local** (`src/features/edificio/shopRoom.js`, `renderShopRoom()`): se dibuja con el mismo motor que los pisos
  (`raster.js`, damero de `floorColor`, sombras, oclusión, bordes y luz de tarde con las lámparas). Es un antiguo
  videoclub con:
  - estanterías y el cartel «VIDEOCLUB» con letra propia de píxeles (guiño, nunca un logotipo);
  - un ventanal al puerto de noche con hiedra, guirnalda, cuadro y baldas con tarros;
  - la dependienta (personaje propio, de vóxeles) en su mostrador con caja, timbre y planta;
  - lámparas colgadas.
- **Las secciones son objetos de la tienda**:
  - el expositor con los sobres de pie (Sobres);
  - el rincón del sillón con alfombra, lámpara y mesilla (Muebles);
  - la caja de reciclaje (Reciclar).

  Cada uno lleva un letrero de papel con muesca (`role=tab`, el elegido en salvia). También se puede tocar el objeto:
  `hit()` mira el búfer de ids del dibujo, con 2 px de margen. El contorno de la sección elegida se enciende en dorado
  (`outlines`, un latido suave que se para con movimiento reducido). Ya no hay fila de pestañas grandes.
- **Sobres**: los cuatro de la temporada van en fila bajo la escena (en el expositor serían demasiado pequeños para el
  dedo), con precio y esquinas de latón en el elegido. Después vienen la ficha, «Abrir 1 / Abrir 5», la nota (con
  «Ver misiones» si faltan tickets) y «Probabilidades y garantías».
- **Abrir un sobre** (`renderShopCounter(mood)`): el mismo local visto de cerca y casi de frente (yaw 0,2, S 44), sin la
  lamparita del mostrador ni lo que taparía el encuadre. Al terminar, la dependienta sonríe (`happy`). El sobre, las
  cartas y el papel de abajo se colocan sobre el tablero. Durante la apertura, el «Volver» del panel dice «Volver a la
  tienda» y cierra el sobre.
- `shopCozy.js` (los dibujos 2D de la primera ronda) se ha borrado. `dev/tienda-dibujos.html` enseña los dos dibujos
  grandes (solo en desarrollo).
- **Pruebas**: `e2e-community/v167-tienda.spec.js` cubre la fila de sobres, los letreros como pestañas y la caja de
  reciclaje tocada en el dibujo. También comprueba que, sin tickets, se ofrece ir a las misiones, y que «Mostrar todos»
  salta la animación. Se ejecuta en Chromium 320, 390 y 1440 y en WebKit 390. Vitest de `edificio`.

## 69. Más muebles y tu personaje en el piso (1.69, encargo de Francisco «más vida en el edificio»)

- **Encargo** (1-11-2026): más muebles, un personaje propio que se mueve por las habitaciones y se personaliza,
  misiones diarias ligadas a la habitación (§70) y un cambio en lo que se puede hacer con los vecinos (bloque 4,
  pendiente). Se hace por bloques, con capturas entre uno y otro.
- **Bloque 1, muebles** (`catalog.js`, «Tanda 2»): diecisiete muebles nuevos (puf, mecedora, escritorio, cómoda, baúl,
  velas, farol, cactus, monstera, pecera, globo, tocadiscos, taza, estante de pared, espejo, mapa y alfombra de rayas),
  con su forma en `furniture.js` y sus filas en `piso_catalogo` y en los sobres
  (`20261105120000_edificio_muebles_tanda2.sql`, la aplica Francisco). La pecera es rara; no cambian precios,
  probabilidades ni el pity.
- **Arreglo del sobre abierto**: en el móvil de Francisco el papel de abajo se cortaba y no se veía «Colocar en mi piso».
  `.gacha` ya no tiene `aspect-ratio` y el papel va en el flujo normal (WebKit no deja crecer una caja con proporción y
  desbordamiento recortado).
- **Bloque 2, el personaje** (`actor.js`): de cajas, como los muebles, dibujado por el mismo motor (`render.js`,
  `ACTOR_ID`). Aspecto: piel, peinado (6), color del pelo, jersey, pantalón, gafas y complemento, de listas cerradas.
  - **Andar**: tocar el suelo lo lleva andando (camino por celdas que rodea los muebles de suelo, sin cortar
    esquinas). Al tocar un mueble va hasta él; en silla, sillón, sofá, banco, puf y mecedora se sienta mirando hacia
    donde mira el asiento, y en la cama se tumba. Si no se le toca, pasea solo cada 6-14 s. Con movimiento reducido no
    hay animación: aparece donde iba y no pasea. Se redibuja a unos 14 fotogramas por segundo solo mientras anda.
  - Si un mueble ocupa su celda o se quita su asiento, se aparta a la celda libre más cercana.
  - **Armario**: tocarlo (o la pestaña «Tu personaje» de la balda) abre una fila por cosa que se cambia; cada muestra es
    el personaje dibujado con esa opción (`renderActorThumb`, encuadrado en cabeza, torso o piernas).
  - **Se guarda** en `pisos.personaje` (`20261105130000_edificio_personaje.sql`, la aplica Francisco), con la misma
    validación en el cliente y en el servidor, y el portal lo devuelve con cada vecino. Sin la migración se recuerda en
    el dispositivo («Guardado en este dispositivo»).
  - **En el piso de un vecino** se ve su personaje paseando, pero no se le manda: tocarlo dice «Vive aquí.».
- **Pruebas**: `actor.test.js`, `personaje.rls.test.js` (PGlite) y `e2e-community/v169-personaje.spec.js` (armario,
  guardado, sentarse, levantarse, el piso de un vecino y sin la migración), en Chromium 390 y 1440 y WebKit 390.

## 70. Misiones del día en tu piso (1.70.0)

- **Qué son** (`dailyMissions.js`): cada día, tres cosas pequeñas de entre siete (sentarse, mover un mueble, cambiar
  un color, encender la luz de tarde, dar un paseo, poner algo de la balda y cambiar la ropa del personaje). Son las
  mismas para todos y salen de la fecha; el servidor las calcula igual (`piso_diarias_del_dia`, una prueba compara
  ochocientos días).
- **Premio**: hechas las tres, la siguiente prenda de una lista fija (`PRENDAS`: bufanda, jersey verde bosque, gorro de
  lana, pantalón teja, pelo rosa pastel…, trece en total). **Nunca tickets**: los tickets se ganan solo leyendo.
- **En el piso**: una nota pequeña «Hoy» encima de su botón, junto a la luz (`ep-today`), con las tres casillas en
  textos cortos y la prenda que llega; no tapa la habitación (Francisco: la primera versión «le quitaba protagonismo»). Cada misión se marca sola al hacerla (`onEvent` de `piso.js`). Al ganar una prenda, la hoja se abre y la
  enseña con su muestra. En el armario, lo que aún no tienes se ve apagado, con candado, y no se pone.
- **Servidor** (`20261105140000_edificio_misiones_diarias.sql`, la aplica Francisco): `piso_prendas` y `piso_diarias`
  (solo lectura de lo propio; se escriben con `piso_mision_diaria`, una vez por misión y día, para hoy, ayer o mañana
  por las zonas horarias) y un trigger que impide guardar un personaje con una prenda que no tienes. Como las
  misiones semanales, la app dice qué se ha hecho y el servidor lo cuenta; el premio es solo de aspecto.
- Sin la migración no hay hoja ni prendas por ganar; el armario enseña solo lo de siempre.
- **Pruebas**: `diarias.rls.test.js` (PGlite) y `e2e-community/v170-diarias.spec.js` (hoja, las tres de hoy sean las
  que sean, prenda ganada, armario con candados y sin la migración), en Chromium 390 y 1440 y WebKit 390.

## 71. Vecinos: «me gusta», libro de visitas y regalos (1.71.0)

Bloque 4 de «más vida en el edificio». Sin texto libre en ningún caso. Visitar con tu personaje queda fuera por ahora.

- **«Me gusta» por mueble**: en el piso de un vecino, al tocar un mueble sale «Me gusta» (botón de píxel con corazón y
  la cuenta); se quita tocándolo otra vez. En tu piso, al tocar un mueble el aviso dice «Sofá · 2 me gusta». El
  «me gusta» es del mueble concreto (`uid`) y del tipo que era: si el vecino lo cambia o lo guarda, deja de contar.
- **Mesa del vecino** (`VecinoMesa.jsx`): la franja de abajo, que antes solo tenía los sellos, tiene tres pestañas de
  papel: «Buzón» (los sellos de siempre), «Libro de visitas» (una frase cerrada de seis, `FIRMAS` en `catalog.js`,
  una firma por día que se puede cambiar; enseña las dos últimas de otros) y «Regalar».
- **Regalar**: solo copias libres (no puestas en tu piso) de muebles que no son de sagas; se elige y se confirma
  («Regalar puf a Bruno»). La copia pasa de tu balda a la suya. Como mucho cinco regalos al día.
- **Tu buzón del portal**: además de los sellos, «X te regaló: puf.» y «X firmó en tu libro de visitas: «…»».
- **Servidor** (`20261105150000_edificio_vecinos.sql`, la aplica Francisco): `piso_regalos`, `piso_visitas` y
  `piso_megusta` con RLS y sin acceso directo; todo pasa por `piso_regalar`, `piso_firmar`, `piso_megusta` y
  `piso_social`, que comprueban que el otro es un vecino visible de tu edificio (comunidad activa, sin bloqueo).
  `piso_social` solo enseña firmas de autores visibles y los regalos solo a quien los recibe.
- Sin la migración, el piso del vecino se queda como en la 1.70 (solo sellos) y no sale «Me gusta».
- **Pruebas**: `vecinos.rls.test.js` (PGlite, 8) y `e2e-community/v171-vecinos.spec.js` («me gusta», libro, regalo,
  buzón del portal, tu piso y sin la migración) en Chromium 320, 390 y 1440 y WebKit 390.

## 72. Místicos en tu piso y el legendario que te acompaña (1.72.0)

Bloque 2 de los místicos (`docs/qa/misticos.md`; decisiones de Francisco del 2-11-2026: una rareza por encima de
«raro», de diseño espectacular, con guiños a sagas, muy poco probable, y los más raros te siguen a todas partes).

- **Catálogo**: cinco seres originales (`catalog.js`, categoría «Místicos»), dibujados y animados con el pintor de
  pixelfx (`misticos.js`, MIT, en `src/vendor/pixelfx`). Rareza `mistico` (se colocan): farol de llama azul y rosa
  bajo la lluvia de estrellas. Rareza `legendario` (te acompañan, no se colocan): dragoncillo de escamas rojas, zorro
  de bruma y ceniza y cinta de luz de tormenta. Cada uno con su «Para quien leyó…».
- **En el piso**: el místico se pone sobre una peana de piedra con filo dorado (`furniture.js`) y encima se mueve
  solo. `render.js` los mezcla con la habitación respetando la profundidad (lo que está delante los tapa) y suma su
  luz; sus píxeles llevan el uid del mueble, así que se tocan y se mueven como cualquier otro.
- **El compañero**: en el armario de tu personaje, la fila «Te acompaña» (solo si tienes algún legendario) con
  «Nadie» y los tuyos. Va detrás de tu personaje, un poco a un lado, y llega con retraso (`createCompanion`); los
  vecinos lo ven al visitarte. La pestaña «Místicos» de la balda solo sale si tienes alguno que se coloque.
- **Movimiento**: un bucle propio a unos 30 fotogramas por segundo, solo mientras hay místicos a la vista; con
  movimiento reducido, quietos (el compañero aparece ya a tu lado). Sin sonido.
- **No son moneda**: no se compran, no se reciclan ni se regalan (ni en la tienda ni en la mesa del vecino). Aún no
  salen en ningún sobre: eso es el bloque 3 (1 % en «Edición coleccionista», 1 de cada 4 legendario, sin pity
  propio; cifras aprobadas por Francisco), con su animación al salir.
- **Servidor** (`20261106120000_edificio_misticos.sql`, la aplica Francisco): las rarezas nuevas y las cinco filas
  del catálogo, `pisos.companero` y un trigger que rechaza colocar un legendario y llevar uno que no tienes;
  `piso_reciclar` y `piso_regalar` rechazan los místicos; `edificio_portal` devuelve el compañero.
- Sin la migración no hay místicos de nadie (sin inventario, ninguno cuenta como tuyo) y la app se queda como en la 1.71.
- **Pruebas**: `misticos.rls.test.js` (PGlite, 7) y `e2e-community/v172-misticos.spec.js` (colocar, elegir
  compañero y guardarlo, la visita y sin místicos). Página de desarrollo: `dev/misticos.html`.

## 73. Místicos en los sobres, la melodía del edificio y el edificio a pantalla completa (1.73.0)

Encargo de Francisco del 2-11-2026 («continúa», la melodía que no se oía y «que la app ocupe toda la pantalla sin
dejar un borde encima»).

### 73.1 Místicos en los sobres (bloque 3 de `docs/qa/misticos.md`)

- **Cifras aprobadas** («Sí, esas cifras»): solo en «Edición coleccionista», **1 %** por mueble es un místico y, de
  esos, **1 de cada 4 legendario**. Ese 1 % se resta de lo raro (del 15 % al 14 %); lo poco común, lo común y el pity
  no cambian. **Sin pity propio**: el pity sigue asegurando un raro, nunca un místico, y un místico cuenta como algo
  raro (lo reinicia). Los demás sobres no los dan nunca.
- **Tienda**: «Probabilidades y garantías» enseña «Místico · 0,75 %» y «Místico legendario · 0,25 %» con cada ser
  (lo muy poco probable, con dos decimales para no redondear hacia arriba) y explica que no tienen garantía ni se
  compran, reciclan o regalan.
- **Al salir** (`GachaReveal.jsx`): el sobre cerrado brilla azul (místico) o rosa (legendario) solo si lo trae de
  verdad; la carta es una noche con marco dorado, el ser se mueve dentro (`misticoThumb` a unos 12 fotogramas por
  segundo), con rayos y destellos de píxel; nota propia (`shopAudio.js`: `reveal-mistico`, `reveal-legendario`).
  El papel dice dónde ponerlo: el legendario, en el armario de tu personaje; el místico, en la pestaña «Místicos».
  Con movimiento reducido: directo al resultado, el ser quieto.
- **Servidor**: `20261107120000_edificio_misticos_sobres.sql` (redefine `piso_sobre` y `piso_abrir_sobre`; la
  aplica Francisco). Sin ella, la tienda enseñaría el 14 % y el 1 % pero el servidor seguiría sorteando como antes
  (15 % raro, sin místicos).

### 73.2 La melodía «Dos balcones» (`edificio/music.js`)

Con las instrucciones de Francisco del 2-11-2026:

- La pista (`public/media/edificio/dos-balcones.mp3`, 45 s, la suya) se carga al entrar en el edificio y, con el
  sonido de la app activado, empieza desde el mismo toque de la tablet que abre el portal.
- **Un único bucle** por Web Audio (no un `<audio>`, que en Safari deja un hueco al repetir), sin el silencio del
  codificador al principio y al final. Ir a un piso, decorar o entrar en la tienda no la corta ni la reinicia; entrar
  dos veces no la duplica.
- En los pisos baja suavemente (×0,55); en la fachada y la tienda, a su volumen. Por debajo de la radio y con su
  volumen de música; si suena la radio, la melodía calla y espera en su punto. Al salir del edificio se desvanece.
- **Sin probar en un iPhone real** (el bucle sin huecos y que no se superpongan dos, en Safari): el WebKit de
  Playwright en Windows no trae Web Audio. En Chromium, `e2e-community/v173-musica.spec.js`.

### 73.3 El edificio a pantalla completa

En el móvil (menos de 700 px) el edificio (portal, piso y tienda) ya no es una hoja del 94 % de alto con la
habitación asomando por encima: llena la pantalla y su color sube bajo la barra de estado (la barra de botones guarda
el área segura). En pantallas anchas sigue siendo la tarjeta centrada.

### 73.4 El portal sin carteles y el buzón en la fachada

- Francisco (2-11-2026): fuera el título «El edificio del puerto» y «Tu puerta: 2.º B. Toca una puerta para entrar»
  (quedan en un encabezado solo para lectores de pantalla) y fuera la tarjeta «Tu buzón».
- En su lugar, un **buzón rojo** dibujado en la pared entre la librería y el portal (`facade.js`). Si hay sellos,
  regalos o firmas, asoma una carta con el número que se mece de vez en cuando (quieta con movimiento reducido); al
  tocarlo, una nota de papel encima dice qué hay (`facadeView.js`, opción `mail`). Se cierra tocándolo otra vez o
  fuera. Sin correo, el buzón dice que aún no hay nada.

### 73.5 La cuenta del fundador

`supabase/scripts/cuenta_fundador.sql` (no es una migración; lo ejecuta Francisco a mano): a su cuenta, 10.000
tickets (o los que tenga, si son más) y una copia de los cinco místicos. Probado en PGlite: solo toca esa cuenta y
repetirlo no cambia nada.

- **Pruebas**: `misticos.rls.test.js` (PGlite, 8: cifras, que los otros sobres no los den, el reparto de
  legendarios y el pity), `tienda.rls.test.js` con la paridad de las cifras nuevas,
  `e2e-community/v173-misticos-sobre.spec.js` y `v173-musica.spec.js`.

## 74. Los menús de debajo de las habitaciones, la cabina del armario y la limusina al Gran Hotel (1.74.0)

Encargo de Francisco del 2-11-2026: «mejorar la interfaz de cómo se ven los menús que están debajo de las
habitaciones»; para el armario, «una cabina, que se vea tu personaje en grande y que puedas ir cambiando los tipos de
accesorios, más organizado».

### 74.1 La balda

- Cada pestaña lleva, bajo su dibujo, su **nombre corto a la vista** (Asientos, Mesas, Luz… Armario, Paredes, En el
  piso); el nombre completo sigue siendo el nombre accesible. La fila se recorre de lado con imán y se **difumina por
  la derecha** donde sigue.
- Fuera la línea de título (ya lo dice la pestaña): ese sitio es para los muebles. La pista va en cursiva, más discreta.

### 74.2 La cabina del armario (`piso.js`, `fillWardrobe`)

- A la izquierda, **la cabina**: marco dorado, cortinas de terciopelo, un espejo de luz cálida y una alfombrilla; dentro,
  **tu personaje de cuerpo entero en grande** (96 px) y, si tienes uno, quien te acompaña flotando a su lado (quieto con
  movimiento reducido). Se redibuja con cada cambio.
- A la derecha, **una pestaña por clase de cosa** (Te acompaña, Piel, Pelo, Color, Jersey, Pantalón, Gafas, Extras;
  `role="tablist"`, flechas para pasar), que se reparten en filas sin cortarse; debajo, **las muestras de esa clase en
  cuadrícula** (bajan, no se cortan a los lados). La pestaña elegida se recuerda mientras estés en el piso; la primera
  vez, «Te acompaña» si tienes un legendario, si no «Piel».
- Las reglas no cambian: lo que se gana con las misiones sale apagado hasta ganarlo.

### 74.3 La mesita del vecino

- En la vista «dentro», el mismo mueble de madera que la balda, con sus pestañas de papel (la elegida, verde y
  levantada).
- Las frases del buzón y del libro de visitas, en **dos columnas que se leen enteras** (antes, una fila que se cortaba
  a los lados); lo de regalar, en cuadrícula de muestras de tamaño fijo.

### 74.4 La limusina negra al Gran Hotel (bloque 1 de `docs/qa/gran-hotel.md`)

Francisco: «para llegar al gran hotel, tengas que coger una limusina lujosa negra»; dónde se coge, aprobado con
«Sí, a la limusina».

- **La limusina** (`edificio/limo.js`, dibujo propio con el rasterizador de las fachadas): larga y negra, con filo
  cromado, brillo de charol arriba, cristales tintados, tapacubos, pilotos rojos, faros encendidos y su chófer de gorra
  esperando detrás. Está **aparcada en el muelle, delante de la tienda**, y es un botón de la fachada («Coger la
  limusina al Gran Hotel», placa negra «Al Gran Hotel»).
- **El viaje** (`hotel/ride.js`; Francisco: «el camino se ve muy simple y plano»): la calle del puerto de noche, dibujada
  con el mismo rasterizador: casas de colores con ventanas encendidas y tiendas con toldo, farolas en la acera, la
  calzada con su raya dorada, el paseo con bolardos y cadenas, y el agua con el reflejo de cada farola. La limusina la
  recorre (3,4 s, con los faros alumbrando la calzada) y la cámara la sigue, ampliada en píxeles; al llegar se funde con
  el hotel. Se salta tocándolo. Con movimiento reducido no hay viaje.
- **El Gran Hotel**: la fachada viva del concepto (`hotel/hotelArt.js` y `hotel/hotelView.js`, antes en `dev/`), con
  la limusina esperando ante la alfombra roja. Francisco: «tiene demasiados menús y se empequeñece»: **sin fila de
  botones** y **a todo lo que da la pantalla** (en el móvil llena el alto y recorta un poco los lados). Cada planta se
  toca en el dibujo y una nota pequeña de papel arriba dice qué habrá, con el sello «Abre pronto» (se cierra con la ×,
  tocando fuera o con Escape): aún no se entra en ninguna sala. Para el teclado, cada planta tiene un botón sobre el
  dibujo que solo se ve al enfocarlo. Con movimiento reducido, el dibujo queda quieto.
- Se abre como un «piso» más del portal (`panel.id = 'hotel'`): **«Volver en limusina»** y Atrás vuelven al portal.

- **Pruebas**: `e2e-community/v174-limusina.spec.js` (portal → viaje → hotel → planta → vuelta; y con movimiento
  reducido, sin viaje y quieto), `v169-personaje`, `v170-diarias` (eligen la pestaña antes de cada clase), `v172-misticos`,
  `v171-vecinos`, `v163-edificio`, `v166-inventario` y `e2e/edificio-puerto.spec.js` (las pestañas de la balda se
  buscan por `data-cat`).

## 75. El vestíbulo del Gran Hotel por dentro, con el ascensor de latón (1.75.0)

Francisco pidió para el hotel la zona de intercambio de muebles, la habitación de la semana, un casino con su moneda y
«otras salas en las que podamos intercalar otras funciones de la app para que todo esté bien relacionado y orgánico».
El plan está en `docs/qa/gran-hotel.md` §9 y sus decisiones en §9.7 («Las 21 páginas», casino sin apostar y tras
leer, suite de la semana en dos pasos y voluntaria). Se empieza por el paso A: el vestíbulo con el ascensor.

### 75.1 Se entra tocando el vestíbulo

- En la fachada del hotel, tocar el vestíbulo (o su botón para el teclado) **entra en él**; el resto de plantas siguen
  con su nota y «Abre pronto».
- Dentro, el «Volver» de la barra dice **«A la calle»** y vuelve a la fachada, igual que Escape (que ya no cierra el
  hotel). Desde la fachada, «Volver en limusina» vuelve al portal. Al salir del hotel se olvida la sala.

### 75.2 El dibujo

`hotel/lobbyArt.js`, con el mismo motor isométrico que la tienda y los pisos (reutiliza `evening`, `toDataURL` y
`outlineOf` de `shopRoom.js`), de noche y art déco: suelo de mármol crema y verde en damero con filete dorado, estuco
crema con pilastras doradas y zócalo de nogal, apliques, la lámpara de araña sobre el diván redondo con su palmera,
palmeras en macetas de latón, el carrito de equipajes, una huésped esperando el ascensor y la alfombra roja hasta él.
Página de desarrollo: `dev/vestibulo.html` (`?ol=ascensor` enseña un contorno).

### 75.3 Lo que se toca (`hotel/Vestibulo.jsx`)

Como en la tienda: cada cosa tiene su letrero de papel colgado encima y, al elegirla, su contorno dorado; lo que dice
va en un papel debajo del dibujo.

- **Recepción** (de entrada): el conserje (uniforme granate, gorra con galón y bigote) y su casillero de llaves dan los
  **encargos de la semana**, que son las misiones de siempre con su progreso. Se cobran en tickets como en el ordenador
  (`useMissionTickets`, una vez por misión y semana, lo decide el servidor) y quedan apuntadas en la biblioteca.
- **Ascensor**: la **botonera de latón** es la navegación del hotel (sin menús), con un botón redondo por planta, de
  arriba abajo por columnas: C mirador, Á suite de la semana, T terraza, B salón de baile, 3 suites de los clubes,
  1 café-biblioteca, E La Lonja, **V vestíbulo** (encendido, `aria-current="location"`), S casino del sótano y P la
  plaza. Una planta que aún no abre dice qué habrá, con «Abre pronto»; la «P» sale a la plaza. La galería de vitrinas
  no está en la botonera mientras las figuras sigan ocultas.
  Francisco: «me gusta mucho la habitación, no me gusta cómo se ve esto» (la primera botonera, una placa con degradado):
  ahora va en el pixel art de la habitación, con la placa de latón con marco de píxel (`--px-brass`), la esfera de
  plantas dibujada en píxeles cuya aguja gira hasta la planta pulsada (de golpe con movimiento reducido), la placa
  grabada con su nombre y botones redondos de píxel (`boton` y `botonLuz` en `pixelUi.js`).
- **Tablón «Busco quien lea…»** y **guardarropa**: dicen qué habrá y «Abre pronto».

- **Pruebas**: `e2e-community/v175-vestibulo.spec.js` (entrar, encargos, botonera, la «P», teclado y Escape, «A la
  calle» y vuelta al portal) en Chromium 320/390/1440 y WebKit 390; `v174-limusina.spec.js` sigue pasando.

## 76. La apertura de sobres sobre el mostrador (1.76.0)

Francisco pasó dos documentos y una maqueta de tres pantallas (la tienda con el selector, el sobre cerrado en el
mostrador y la apertura de cinco con «1 de 5 reveladas»), y después varias rondas de correcciones sobre capturas a
360 × 800. Se toma de la maqueta la composición; el dibujo es el de la app (`raster.js`, la tendera, los muebles, los
colores y los marcos de `pixelUi.js`).

### 76.1 Un solo sobre por colección

`shopArt.js` define **un sobre por colección** que se usa en los tres sitios: el expositor de la tienda (muestreado
píxel a píxel), el selector y el primer plano del mostrador. El cuerpo verde de la casa; la faja crema alta con el
mueble de portada en su proporción y con margen; la tira de arriba del color de la colección, con la **línea de rasgado
discontinua**; la **pestaña roja** de una sola pieza con la tira, que asoma por encima; los **sellados de arriba y abajo
en crema con estrías**; y la casita del edificio abajo. En el primer plano, además, **tres pliegues** en el verde, la
costura de la faja y la sombra de la pestaña. El reverso de las cartas lleva el color de la colección, un **filete
dorado** y la casita en crema. El selector enseña los sobres grandes y sin precio debajo (el precio va en «Abrir 1 · 10»
y «Abrir 5 · 45»). La portada de «Luces del puerto» pasa a ser la lámpara de mesa.

### 76.2 El sobre en el mostrador

`counterPack` (`shopRoom.js`) dibuja el sobre con la misma cámara que el mostrador de cerca, **de frente** y con la base
apoyada en la madera: **un tercio del ancho de la imagen** y un alto visible de **1,4 veces el ancho**. La inclinación
se despeja de la proyección (alto por unidad a lo largo del sobre: 0,5·cos θ + 0,866·sen θ), así la faja enseña el
mueble sin aplastarlo. Se abomba por el centro (nada en los bordes ni en los sellados) y la luz, del fondo a la
izquierda, lo modela; la pestaña está levantada y en la madera deja una sombra en cuña que crece con la altura. La tira
(con la pestaña) y el cuerpo son dos capas transparentes del tamaño de la escena. Lo que se toca es su recuadro
proyectado. Cerrado, da un saltito de vez en cuando (más a menudo cuanto mejor es lo de dentro, que es verdad).

El encuadre de cerca baja la cámara (ANCHOR_Y 0,344, tablero hasta 8,05): la cara de la dependienta queda libre y hay
madera detrás de la primera fila de cartas y delante de la segunda.

### 76.3 Tres gestos breves

1. Al tocarlo, **la tira se desprende entera** y queda en la madera justo encima del sobre, algo girada.
2. El sobre de cinco **se desliza a la izquierda** y la primera carta **asoma boca arriba por su boca**, girada, con el
   nombre por encima del sobre (la rareza queda dentro); las otras cuatro se reparten **boca abajo en 2 × 2 a la
   derecha**. Es la composición «1 de 5 reveladas», con «Revelar todas» en el pie (`layout.peek` de `counterLayout`).
   En el de una carta, el sobre se queda en el centro y la carta sigue sola.
3. **Al continuar** (tocar un dorso, «Revelar todas» o la carta que asoma), las cartas van a su **sitio definitivo,
   3 + 2** (`layout.cards`), el mismo para revelarlas, elegirlas y tocarlas; «Revelar todas» las gira en su sitio. El
   sobre vacío y la tira se deslizan a la izquierda hasta quedar **fuera del encuadre**: cuánto, se mide con sus píxeles
   dibujados (sombra y giro de la tira incluidos), así no asoman ni a 360 px. Al terminar ya no se montan: sobre la
   madera solo quedan las cinco recompensas.

El pie tiene desde el principio el alto que tendrá al final, así el tablero no salta. Con movimiento reducido se va
directo a la composición final, sin sobre ni tira.

### 76.4 Elegir y colocar

Las cartas llevan la rareza con su nombre y un filo fino de su color, y «Nuevo» en terracota. Tocar una carta revelada
la **elige**: solo ella lleva un ✓ pequeño dentro, arriba a la izquierda, y la acción dice **«Colocar [nombre]»** (sin
elegir, «Colocar en mi piso»). Abre tu piso decorando con ese mueble ya puesto y elegido (`placeId` en `mountPiso`);
«Guardar» lo devuelve al inventario y el piso queda como estaba. Son las recompensas que ya confirmó la compra: nada se
vuelve a cobrar ni a sortear. Un legendario no se coloca (te acompaña).

- **Pruebas**: `e2e-community/v176-sobre-mostrador.spec.js` (silueta del sobre cerrado, «1 de 5», posiciones contra el
  reparto calculado, salida del encuadre píxel a píxel, elección del gato y el editor con esa pieza, movimiento
  reducido) y `v176-rasgado.spec.js` (graba los tres gestos a 360), con `sobreShop.js` común; v167 y v173 ajustadas.
  Pasan en Chromium 360/390/1440 y WebKit 390 (emulación; nada probado en un iPhone real).

## 77. La fachada del Gran Hotel con su Directorio y el armario con «Compañía» (1.77.0)

Francisco pasó una maqueta de dos paneles con dos textos: a la izquierda, la fachada del hotel con la planta
«Café-biblioteca» elegida; a la derecha, el armario de «Tu piso» con la pestaña «Compañía» y el dragón rojo. Se toma de
la maqueta la composición; el dibujo es el de la app (`raster.js`, `pixelUi.js`, los místicos de pixelfx).

### 77.1 La fachada del hotel

- **Barra compacta**: «← Al puerto» (antes «Volver en limusina»; vuelve al portal) y, a la derecha, «Directorio».
- **El hotel entero** se centra y cabe de alto entre la barra y una **cartela crema al pie**: la aguja, el letrero
  «Gran Hotel del Puerto», la marquesina y la limusina se ven a la vez. `hotelArt.js` devuelve `entryY` (hasta dónde
  baja la entrada, limusina incluida) y `GranHotel.jsx` mide el alto disponible y el de la cartela (`--gh-h`,
  `--gh-foot`, `--gh-entry`). La limusina lleva un filo de luz en su perfil (`bodyId` de `drawLimo`) para leerse sobre
  el empedrado de noche, y la gente que la tapaba se ha apartado.
- **La planta elegida**: un filete fino de latón por fuera de su banda y un rombo de latón unido a su izquierda por una
  raya, dibujados en el propio lienzo (`brass` en `hotelView.js`), así van con la planta a cualquier tamaño de pantalla.
  Con movimiento reducido, la elección se entiende por el filete, el rombo y la cartela.
- **La cartela** sustituye a la nota flotante: el nombre corto de la planta, «Próxima apertura» (o «Abierto») entre dos
  filetes y su lema; sin elegir, «Toca una planta». Con una planta elegida, Escape la deja sin elegir y no cierra el
  hotel.
- **Directorio**: una lista HTML (un diálogo no modal) con las siete plantas de arriba abajo y su estado; elegir una ahí
  es exactamente lo mismo que tocarla (mismos píxeles, misma cartela), el vestíbulo se entra (es la única abierta) y
  Escape lo cierra.
- La animación solo corre mientras la fachada se ve (IntersectionObserver y `visibilitychange`).

### 77.2 El armario, un modo propio del piso

- Ya no va dentro de la balda: **se abre tocando a tu personaje** o la pestaña «Armario» de la balda. La barra del panel
  dice **«← Al piso»** y **«Armario»**; la cabecera del piso se oculta.
- **Arriba, tu piso de verdad** (con sus muebles y su profundidad: lo que está delante tapa), encuadrado en tu personaje
  con sitio a su derecha para quien te acompaña (`frameDressing`). Si junto a él no cabe, el personaje se pone en el
  hueco libre más cercano. Quien te acompaña se posa a su lado, mirándolo.
- **Abajo, tres pestañas**: **Ropa** (jersey, pantalón, gafas y complemento), **Aspecto** (piel, pelo y color del pelo)
  y **Compañía**: dos tarjetas por fila, cada una con el ser en grande y su nombre entero debajo (sin partir palabras),
  «Sin compañía» la primera; la elegida, con **borde verde oliva y una marca en la esquina**. Si hay más, se desplaza.
  «Listo», a todo lo ancho al pie.
- **Vista previa**: lo que se toca se ve al momento en el piso, pero **solo se guarda con «Listo»** (por el flujo de
  siempre: `onAvatarChange`, `onCompanionChange`; la misión «armario» cuenta al darle). «← Al piso» o Escape lo dejan
  todo como estaba. Al cerrar, el piso vuelve a como estaba (decorando o no). El armario se abre siempre en «Ropa».
- **El dragón, posado** (`perch` en `drawDragon`): en el suelo, le llega a la cintura al personaje, con cabeza, alas y
  cola reconocibles; alas a medio abrir y, cada 3,4 s, un batido corto. El zorro mueve la cola como siempre. Con
  movimiento reducido, quietos en una postura expresiva.
- Se retira la cabina de la 1.74.

- **Pruebas**: `e2e-community/v177-hotel-directorio.spec.js` (360 y 390: todo el hotel sobre la cartela; tocar y elegir
  en el Directorio dan los mismos píxeles; Escape; el vestíbulo se entra) y `v177-armario.spec.js` (390: el dragón
  marcado y a tu lado, dragón → zorro → «Sin compañía» → volver deja lo de antes, Escape, el zorro con «Listo» se guarda y
  sigue al volver a entrar; 360 con movimiento reducido: tarjetas legibles, «Listo» a mano y el dibujo quieto); v169,
  v170, v172, v174 y v175 ajustadas. Pasan en Chromium (emulación; WebKit no se pasó en este bloque y nada se ha probado
  en un iPhone real).

## 78. El encargo del 3-11-2026: arreglos, sobres con más impacto, tanda 3, paseo, mover con cuidado y tu habitación primero (1.78.0)

Francisco pidió varias cosas antes de seguir con el plan del rascacielos (CLAUDE.md, «Encargo del 3-11-2026»). Se
hizo en seis bloques, con capturas entre uno y otro. **Dos migraciones nuevas, las aplica Francisco**:
`20261108120000_edificio_regalos_diarios.sql` y `20261108130000_edificio_tanda3.sql`.

### 78.1 Arreglos

- **La revelación del sobre en el iPhone** ya no se corta: se ajusta al alto disponible (`--gacha-max`), con el ajuste
  aplicado en `requestAnimationFrame` y solo si cambia (sin avisos de ResizeObserver).
- **Fuera «dejarle una frase»** (los sellos al vecino): sobraba junto al libro de visitas. En su piso quedan dos
  pestañas, «Libro de visitas» y «Regalar». No se borran datos.
- **El correo**: la carta del buzón cuenta solo lo no leído y se va al abrir la nota; lo leído se recuerda en el
  dispositivo (`bookshelf:edificio:correo-leido:<uid>`) y no vuelve al salir y entrar de una habitación.
- **Regalos**: uno al día, solo de rareza común, poco común o raro, y solo si tienes más de una copia (y alguna sin
  colocar). Lo comprueba el servidor (`piso_regalar` en `20261108120000_edificio_regalos_diarios.sql`) y la app lo
  dice antes («Ya has hecho tu regalo de hoy; mañana, otro.»).

### 78.2 Vestíbulo discreto y sobres con más impacto

- **Vestíbulo**: al entrar no hay nada abierto, solo el dibujo con plaquitas pequeñas y una pista; al tocar algo sale
  su papel, compacto y con «×». Escape cierra el papel y, otra vez, sale a la plaza.
- **Sobres**: cada carta lleva el color de su rareza (fondo, cinta y rayos desde poco común); lo raro o mejor tiñe la
  escena un instante y suelta confeti de píxel; el sobre cerrado lleva un brillo igual en todos (no adelanta nada); al
  final, un recuento por rarezas. Con movimiento reducido, colores y recuento, sin brillo, destello ni confeti.

### 78.3 Tanda 3: muebles, ropa y efectos en el edificio

- **Nueve muebles**: perchero, cesto de mantas y jarrón (comunes); chimenea con lumbre, piano y tapiz (poco comunes);
  telescopio y **el perrito**, la mascota (raros; en su cojín, se mueve solo); y el **búho de las constelaciones**
  (místico, solo en «Edición coleccionista»). Van en los sobres de su tipo; con cuatro raros en el balcón, cada uno
  sale con el 1,5 % (el 6 % de raro no cambia).
- **Ropa**: tres jerseys, dos pantalones y tres complementos más, que se ganan con las misiones del día después de lo
  de antes. **Conjunto «Noche estrellada»** (jersey, pantalón y capa): estrellitas en el jersey, polvo de estrellas con
  la capa (con estela al andar) y, con el conjunto entero, más motas y un halo.
- **Fachada**: una segunda gaviota lejana, una estrella fugaz de vez en cuando y luciérnagas en la orilla.
- `20261108130000_edificio_tanda3.sql`: filas del catálogo, sobres, aspecto válido y orden de las prendas.

### 78.4 Tu personaje va andando

- Al tocar **la tienda** o **la limusina** en la fachada, tu personaje (con su ropa) sale del portal, cruza el muelle y
  entra; luego, lo de siempre. Si te acompaña un legendario, va detrás, a su manera. La limusina y su chófer, en una
  capa aparte, lo tapan cuando pasa por detrás. Tocar otra vez lo salta; con movimiento reducido, directo. Sin aspecto
  guardado, usa el de siempre.

### 78.5 Más difícil mover un mueble sin querer

- Decorando, un mueble se levanta solo si se **mantiene pulsado** (320 ms) sin mover el dedo; entonces se ve en la
  mano y se arrastra. Un toque lo elige; un deslizamiento rápido no lo mueve y lo explica. **Tocar un hueco ya no lo
  lleva allí**: lo suelta.

### 78.6 Tu habitación, la protagonista

- Tu piso se abre **sin decorar**: la habitación a pantalla completa, sin la balda, con el nombre pequeño. Abajo, una
  fila de iconos con su nombre: **Luz**, **Hoy**, **Armario** (icono nuevo) y **Decorar**. Decorando, vuelven a las
  esquinas. Se abre decorando al venir de la tienda a poner un mueble o tras elegir «Tu mudanza».

- **Pruebas**: nuevas `e2e-community/v178-sobre-impacto`, `v178-tanda3`, `v178-paseo` y `v178-mover`; ajustadas v163,
  v166, v167, v169, v170, v171, v172, v175 y `e2e/edificio-puerto`; RLS de vecinos (regalos), personaje e inventario.
  Pasan Vitest del edificio (68) y las e2e del edificio en Chromium 320, 360, 390 y escritorio (emulación). WebKit no se
  pasó en este cierre y nada se ha probado en un iPhone real.

## 79. Misiones con el armario completo, la cartela del hotel y la suite de la semana (1.79.0)

Francisco pidió seguir con el plan del Gran Hotel y dos cambios pequeños. **Dos migraciones nuevas, las aplica
Francisco**: `20261109120000_edificio_diarias_tickets.sql` y `20261109130000_hotel_suite_semana.sql`.

### 79.1 Misiones del día con toda la ropa

- Cuando ya tienes **toda la ropa** que se gana con las misiones del día, las tres de un día dan **5 tickets**
  (`DIARIA_TICKETS`) en lugar de una prenda. Lo cuenta el servidor (`piso_mision_diaria`, que devuelve `tickets`), una
  vez al día. Es la segunda excepción a «los tickets solo se ganan leyendo», anotada en CLAUDE.md.
- La hoja «Hoy» dice el premio («5 tickets») y, hechas las tres, «Hecho: +5 tickets». Se abre sola al ganarlos, como con
  una prenda, y el saldo se suma sin recargar.

### 79.2 La cartela del hotel, más pequeña

- Sin planta elegida, la cartela del pie de la fachada solo dice «Gran Hotel del Puerto» y «Toca una planta» (la pista
  del Directorio queda para el lector de pantalla), así que el hotel se ve más grande.
- Al elegir una planta crece con su lema. El hotel se ajusta con una transición corta, sin ella con movimiento reducido.

### 79.3 La suite de la semana, decorada entre todos

- **Decisión de Francisco del 3-11-2026**: el hotel es lo social y el edificio lo personal, para amigos y conocidos.
  Ningún piso se enseña fuera de su edificio y no se vota. Sustituye a la propuesta de candidatos y votación de
  `docs/qa/gran-hotel.md` §9.3.
- **El ático** es una zona nueva de la fachada, el bloque estrecho de encima de la terraza. Está abierta en el
  Directorio y con la «Á» del ascensor del vestíbulo (`hotel/SuiteSemana.jsx`).
- **Cómo funciona**:
  - Es una habitación común que **empieza vacía cada lunes**, con una pared y un suelo distintos cada semana.
  - Cada persona de la comunidad lleva **un mueble suyo** a la semana y **no lo pierde**: es una copia de exposición.
    Vale lo corriente de suelo, alfombra o pared; no valen sagas, místicos, premios ni cosas de «encima».
  - Lo puede poner en otro sitio, cambiarlo por otro o retirarlo. Tiene que caber como en un piso: lo comprueba
    `piso_valido` en el servidor.
  - Se ve quién trajo cada cosa (el alias, nunca su piso), y lo de quien tiene un bloqueo contigo no se enseña.
- **Premio**: con **4 semanas distintas** aportando llega, una sola vez, la **«Placa de la suite»**. Es un mueble de
  pared de la rareza nueva `especial`: no se compra, ni sale en sobres, ni se regala, ni se recicla (`piso_reciclar` lo
  rechaza). Ni tickets ni fichas.
- `20261109130000_hotel_suite_semana.sql`:
  - tablas `piso_suite_semanas`, `piso_suite_aportes` y `piso_suite_placas`, solo accesibles desde funciones;
  - funciones `piso_suite()`, `piso_suite_llevar(item)` y `piso_suite_retirar()`;
  - la placa en el catálogo y `piso_reciclar` rehecha.

### 79.4 Pruebas

- PGlite: `diarias.rls.test.js` (5 tickets con el armario completo) y `suite.rls.test.js` (10). Se ajustaron
  `inventario` y `tienda`, porque la placa no sale en sobres.
- e2e (en emulación):
  - `v170-diarias` (390 y escritorio);
  - `v174-limusina` y `v177-hotel-directorio` (con nueve plantas);
  - `v175-vestibulo`;
  - `v179-suite` (320, 390, escritorio y WebKit 390).

## 80. El casino del sótano: «Las 21 páginas», la mesa para dos y la caja (1.80.0)

Paso C del plan del Gran Hotel (`docs/qa/gran-hotel.md` §9.4). **Una migración nueva, la aplica Francisco**:
`20261110120000_hotel_casino.sql`. Sin ella, la planta del casino dice que abre pronto.

### 80.1 La sala y «Las 21 páginas»

- Se baja desde el Directorio o con la «S» del ascensor del vestíbulo. La puerta de neón rosa está a la derecha de la
  marquesina. **Solo abre el día que has registrado lectura** (páginas o una sesión); si no, la puerta está apagada.
- La sala se dibuja con el motor isométrico (`hotel/casinoArt.js`): moqueta roja, mesa de tapete, crupier con visera,
  neón «21» y la ventanilla de la caja. El crupier habla en un bocadillo con frases cerradas y nunca empuja a jugar.
- Hay **tres manos al día sin apostar**: nunca se pierde nada. Las fichas son:

  | Resultado | Fichas |
  | --- | --- |
  | Veintiuna servida | 12 |
  | Ganar | 8 |
  | Empate | 4 |
  | Perder | 2 |

  El tope es de 150 fichas a la semana. El mazo vive en el servidor, que solo enseña la primera carta del crupier; el
  crupier pide hasta 17.
- Aspecto de videojuego: un tapete verde de cerca con marco de latón y un marcador oscuro (fichas en cifras de píxel que
  suben, la barra de la semana y las tres manos). Las cartas entran deslizándose; hay placas con los totales, el cartel
  del resultado y botones gruesos («Pedir carta», «Plantarse»). Los sonidos son breves y solo suenan con el sonido de la
  app. Con movimiento reducido no hay animaciones.
- Funciones: `piso_casino(dia)`, `piso_casino_repartir(dia)` y `piso_casino_jugar(dia, accion)`.

### 80.2 La mesa para dos

- **Decisión de Francisco del 3-11-2026**: «Fichas y garbanzos», «Os seguís los dos», «En diferido». La regla está en
  CLAUDE.md.
- Se juega con un **amigo**, es decir, con **seguimiento mutuo**, en la comunidad y sin bloqueo. Los dos juegan contra
  el mismo mazo y el mismo crupier, cada uno cuando quiere.
- Las manos de la mesa cuentan entre las tres del día y dan **+2 fichas de compañía**, dentro del tope semanal.
- Entre los dos se puede apostar (es la única excepción a «sin apostar»):
  - hasta **10 fichas**, una vez al día por pareja;
  - hasta **50 garbanzos**, una moneda imaginaria sin ningún valor: empiezas con 100 y ganas +20 cada día que lees.
- Lo apostado se aparta al aceptar. Gana quien acaba más cerca de 21 sin pasarse; con empate, o si se pasan los dos, se
  devuelve. El bote no cuenta para el tope.
- Las cartas del amigo se ven boca abajo hasta que se resuelve. Una invitación de hace más de un día se retira sola, y
  una partida a medias se resuelve plantando a quien faltaba.
- Funciones: `piso_casino_invitar`, `piso_casino_aceptar`, `piso_casino_rechazar` y `piso_casino_mesa_jugar`.
- En el cliente hay pestañas «A solas» / «Con un amigo» / «La caja», con un aviso cuando una mesa te espera
  (`hotel/MesaParaDos.jsx`). Las cantidades son fijas: 0, 2, 5 o 10 fichas y 0, 10, 25 o 50 garbanzos.

### 80.3 La caja

- **Decisión de Francisco del 3-11-2026**: «muy atractiva con recompensas muy llamativas», con sus precios.
- La caja se abre con la tercera pestaña o tocando la ventanilla de la sala (`hotel/CajaCasino.jsx`):

  | Artículo | Fichas |
  | --- | --- |
  | Visera verde de crupier | 60 |
  | Pantalón de raya diplomática | 80 |
  | Chaleco de crupier | 100 |
  | Sobre del casino | 120 |
  | Fedora de ala corta | 140 |
  | Vestido de lentejuelas, con destellos | 200 |
  | Rótulo de neón «21» | 250 |
  | Mesa de tapete verde, animada | 300 |
  | Gramola, con luces y notas | 400 |
  | **Conejo de la chistera**, compañero legendario | 1500 |

- **El sobre del casino** es una tirada del «Edición coleccionista» con sus mismas probabilidades y su pity, y no toca los
  tickets. Lo demás se tiene una sola vez.
- **Los muebles y el conejo son exclusivos**: no salen en sobres, no se compran con tickets, no se reciclan ni se
  regalan.
- La ropa del casino no entra en las misiones del día, así que la regla de «toda la ropa → 5 tickets» sigue igual.
- Presentación:
  - El conejo va arriba, vivo, con rayos dorados, la cinta «Legendario · con efectos» y la barra de lo que falta.
  - Cada artículo tiene su tarjeta con el dibujo de verdad, el precio y «Cambiar» o «Faltan N». Se confirma en el
    propio sitio y lo que ya es tuyo lleva el sello «Ya es tuyo».
  - Al cambiar aparece «¡Es tuyo!» o «¡Sobre abierto!», con lo que trae y dónde encontrarlo.
  - No hay cuentas atrás ni ofertas. Con movimiento reducido, todo está quieto.
- Funciones: `piso_casino_canjear(dia, articulo)` y `piso_casino` devuelve `caja`.

### 80.4 Pruebas

- PGlite: `casino.rls.test.js` (10), `casino-mesa.rls.test.js` (11) y `casino-caja.rls.test.js` (7).
- e2e en emulación: `v180-casino.spec.js` (8) en 320, 390, escritorio y WebKit 390.
- Regresión: v170, v172, v173, v175, v177 y v179, y `v178-tanda3`.

## 81. Cambios tras probar el casino: abierto todos los días, avisos en el edificio, mover muebles y sin la suite (1.81.0)

Francisco pidió cuatro cambios el 4-11-2026, tras usar la 1.80. **Una migración nueva, la aplica Francisco**:
`20261111120000_hotel_casino_arreglos.sql`. Sustituye a lo que dicen §79.3 y §80.1 sobre la suite y la lectura.

### 81.1 El casino abre todos los días

- **Decisión de Francisco**: ya no hace falta haber leído para jugar, porque «da mucho conflicto con las lecturas». Se
  quitan la comprobación de lectura y el cartel de la puerta apagada.
- Las tres manos al día y el tope de 150 fichas a la semana no cambian.
- Efecto a tener en cuenta: se pueden conseguir tickets sin leer (fichas, sobre del casino y reciclar lo que salga).

### 81.2 La mesa para dos avisa en todo el edificio

- Las mesas que te esperan (una invitación o tu turno) salen en una nota de papel en el portal, tu piso, la tienda y el
  hotel, con «Ir al casino» y una cruz para dejarla para luego. El botón lleva a la mesa sin el viaje en limusina.
- El buzón también las recoge, y dice cuándo ha terminado una mesa.
- El edificio mira cada 45 s y al volver a la app. Dentro del casino, cada 15 s mientras haya una mesa en marcha.
- Si te espera una mesa, el casino se abre en «Con un amigo» y el crupier te lo dice.

### 81.3 Arreglos del servidor

- **Tope semanal**: `piso_casino_semana` sumaba las fichas de siempre y el tope no se reiniciaba el lunes. Ya cuenta
  solo las de la semana.
- **Quien invita guarda una mano** para esa mesa, para que su amigo siempre pueda aceptar. Retirar la invitación la
  devuelve.
- **Una invitación de ayer aceptada hoy** cuenta entre las manos de hoy.

### 81.4 Mover muebles

- El seguro contra moverlos sin querer es elegirlos: con un toque queda elegido y se arrastra sin esperar.
- Sin elegir, basta una pulsación de 200 ms (antes 320) con 14 px de margen (antes 10).
- Deslizar por encima de un mueble sin elegir sigue sin moverlo.

### 81.5 Sin la suite de la semana

- **Decisión de Francisco**: la sala de exposición de muebles no le convencía. Sale de la fachada, el Directorio y el
  ascensor, y su bloque cuenta como parte del mirador.
- No se borra ningún dato: sus tablas y funciones siguen en la base de datos, y quien tiene la «Placa de la suite» la
  conserva.

### 81.6 Pruebas

- PGlite: `casino.rls.test.js` (11), `casino-mesa.rls.test.js` (13) y `suite.rls.test.js`; 110 en edificio.
- e2e en emulación:
  - `v180-casino` y `v178-mover` (320, 390, escritorio y WebKit 390, según la prueba);
  - `v174-limusina`, `v175-vestibulo`, `v177-hotel-directorio` y `v178-paseo` (390).
- Se retira `v179-suite`.

## 82. Los garbanzos del casino y los avisos al momento (1.82.0)

Francisco pidió estos cambios el 4-11-2026, tras usar la 1.81. **Una migración nueva, la aplica Francisco**:
`20261112120000_hotel_casino_garbanzos.sql`. Las cifras de §82.2 a §82.4 las propuso Claude y Francisco las dio por buenas
al pedir el cierre.

### 82.1 Avisos al momento

- Cada jugada que afecta a tu amigo le manda un toque sin datos por Realtime Broadcast, al canal `casino-<uid>`. Al
  recibirlo, su app vuelve a pedir el casino: lo que hay en la mesa lo sigue diciendo el servidor.
- Si el toque falla, queda la consulta periódica: cada 20 s en el edificio y cada 15 s en el casino.
- Arreglo: dentro del casino, sin una mesa en marcha, una invitación nueva no llegaba. Ahora el casino mira siempre, y
  también al volver a la app.

### 82.2 Mesas de garbanzos

- El formulario de invitar desaparecía tras la mesa del día con ese amigo o sin manos, y por eso no se podía apostar.
- Ahora, en esos casos, se abre una **mesa de garbanzos**: solo se apuestan garbanzos (10, 25 o 50), no gasta las tres
  manos del día y no da fichas.
- Hasta 6 al día por persona y una abierta por pareja. La mesa del día sigue siendo una por pareja.

### 82.3 La lata de los garbanzos

- Plegada al pie de la caja, para no cambiar su distribución.
- Tres premios humildes, con las reglas de los de la caja: tarro de garbanzos (150), baraja de naipes (300) y taburete de
  barra (600).

### 82.4 El cambio de garbanzos y tickets

- 50 garbanzos por 5 tickets y 5 tickets por 25 garbanzos, hasta 10 tickets a la semana en cada sentido. El tope lo cuenta
  el servidor con su propia fecha. Ida y vuelta siempre se pierde.
- **Decisión de Francisco**: es la tercera excepción a «los tickets solo se ganan leyendo». Los garbanzos dejan de ser una
  moneda sin ningún valor, pero nunca se compran. Las fichas siguen sin convertirse en tickets.

### 82.5 Pruebas

- PGlite: `casino-garbanzos.rls.test.js`; 123 en edificio.
- e2e en emulación: `v180-casino` en 320, 390, escritorio y WebKit 390, según la prueba.
- El toque se comprobó en el proyecto real con la clave pública, entre dos canales de prueba. **Sin probar entre dos
  cuentas reales.**

## 83. La sala de lectura del Gran Hotel (1.83.0)

Paso D de `docs/qa/gran-hotel.md` §9.6, primera mitad. Francisco la pidió «con sentido» el 4-11-2026 y eligió «Librería y
compañía». **Una migración nueva, la aplica Francisco**: `20261113120000_hotel_sala_lectura.sql`. Sin ella la sala funciona,
pero sin librería ni saludo, y a quien no es vecino se le ve con el personaje de base.

### 83.1 La sala

- Planta 1 del hotel, abierta desde el Directorio y el ascensor: biblioteca de noche con seis sillones.
- Es el temporizador de la app y la presencia del salón (`reading_presence`), con la misma elección de qué compartir. Al
  acabar, las páginas se apuntan ahí mismo con el formulario de la bandeja.
- Quien lee se dibuja dentro de la escena, sentado y con un libro, con su personaje; su compañero legendario, en el suelo a su
  lado. `sala_lectura_personajes` da solo ese aspecto y solo de quien se ve ya leyendo.

### 83.2 La librería común

- Quien termina un libro sentado en la sala puede dejar su lomo, con su nombre, a la vista de todo el hotel. Se pregunta cada
  vez y se puede retirar. Hasta 3 al día y cada título una vez por persona. La balda enseña los 40 últimos.
- El lomo lleva el título tal como está en tu biblioteca. No hay forma de denunciar un lomo: quien bloquea a alguien deja de
  ver los suyos.

### 83.3 La compañía

- Saludo cerrado, sin texto, entre dos personas sentadas a la vez: uno cada media hora por pareja. Se mira cada 15 s mientras
  estás sentado.
- Al acabar, «Has leído con…»: quien has visto en la sala mientras seguías sentado. Lo cuenta el dispositivo.
- No da tickets ni recompensas.

### 83.4 Pruebas

- PGlite: `sala-lectura.rls.test.js` (14). e2e en emulación: `v183-sala-lectura` en 320, 390, escritorio y WebKit 390, según la
  prueba. **Sin probar entre dos cuentas reales.**
- La presencia solo se renueva con la app visible: con el móvil bloqueado, a los 3 minutos no se te ve ni llegan saludos.

## 84. La Lonja del Gran Hotel y la pesada de Remedios (1.84.0)

La fase 7 de `docs/qa/economia-muebles.md` y el §9.2 de `docs/qa/gran-hotel.md`, con los cambios que pidió Francisco el 4-11-2026.
**Una migración nueva, la aplica Francisco**: `20261114120000_hotel_lonja.sql`. Sin ella, la sala dice que está cerrada.

### 84.1 La sala, entera y en corte

- Entresuelo del hotel, abierta desde el Directorio y el ascensor (botón E). Es la primera **sala de dos plantas**: un solo dibujo
  (`hotel/lonjaArt.js`), sin transiciones. Abajo, la nave: cada puesto es una persona con su personaje y sus muebles en el
  mostrador, Remedios (la lonjera) y un gato. Arriba, el altillo: tu puesto, el almacén, la pizarra y el libro de cuentas.
- Hasta cinco puestos por pasillo. Con más, se pasa de pasillo desde el panel.

### 84.2 El panel

Tiene la soltura del casino, pero cara propia de mercado (clases `lj-`): un toldo con tres faldones (Los puestos, Tu puesto, La
pesada), la pizarra de las cuentas y etiquetas de papel de estraza sobre ladrillo. Tocar la escena lleva al modo que corresponde.

- **Los puestos**: todas las ofertas del pasillo a la vez, con quién las pone, y el filtro «Lo que puedo pagar». Lo que no se puede
  hacer se dice en su etiqueta. Cambiar pide confirmar.
- **Tu puesto**: los huecos, el libro de cuentas y las reglas. Se puede pedir un precio en tickets, un mueble concreto o «lo que
  sea» de una rareza; en este último caso, quien compra elige con qué paga.

### 84.3 La economía

Lo comprueba el servidor. **La Lonja no crea ningún ticket.**

| Regla | Cifra |
| --- | --- |
| Precio por rareza, en tickets | común 5-20, poco común 10-40, raro 20-60 |
| Comisión, que se queda en la Lonja | 10 %, redondeada hacia arriba |
| Cobrar | hasta 100 tickets netos en 7 días; cambiar por muebles sigue abierto |
| Ofertas por puesto | 3 (4 con el hueco extra), durante 7 días |
| Cambios al día, para quien acepta | 3 |
| Lo recibido aquí | 3 días sin poder ofrecerlo ni pagar con ello; sí colocarlo o reciclarlo |
| Las mismas dos personas | un cambio cada 7 días, en cualquier sentido |
| Trueques | rareza igual o contigua |
| Cuentas de menos de 3 días | solo miran |

Fuera de la Lonja: **mascotas**, místicos, sagas y premios. Se respetan los bloqueos. Lo ofrecido sale del inventario hasta que se
cambia, se retira o caduca, y el cambio se hace de una vez.

### 84.4 La pesada de Remedios

Minijuego de lógica en la mesa de Remedios, dibujada aparte (`hotel/pesadaArt.js`). Tres encargos al día, y en cada uno una caja
pesa distinto. La guarda el servidor hasta resolver.

| Encargo | Cajas | Pesadas justas (máximo) | Sellos |
| --- | --- | --- | --- |
| Sardinas | 6, sabiendo si pesa de más o de menos | 2 (3) | 1 |
| Naranjas | 9, sabiendo si pesa de más o de menos | 2 (3) | 2 |
| Libros | 8, sin saberlo | 3 (4) | 3 |

- Con una pesada de más, el encargo vale uno menos, y al menos uno. Fallar acaba el día y no quita nada; quien no había ganado
  nada se lleva un sello por jugar.
- Remedios tacha con tiza lo que la balanza ya ha descartado. Lo calcula el dispositivo con lo que la balanza ha dicho.
- Con movimiento reducido, todo va directo a su sitio y el gato se queda quieto. Sonidos propios, solo después de tocar algo.
- **Los sellos nunca son tickets ni muebles.** Se canjean por una venta sin comisión (10; hasta 2 guardadas), un hueco más durante
  7 días (14) y cuatro toldos para tu puesto (18), que ve todo el mundo.

### 84.5 Pruebas

- PGlite: `lonja.rls.test.js` (30). e2e en emulación: `v184-lonja` en 320, 390, escritorio y WebKit 390, según la prueba, con
  movimiento reducido; con las animaciones reales, solo una pasada a 390 en Chromium. **Sin probar entre dos cuentas reales ni en
  un iPhone**, y los sonidos nuevos no se han escuchado.

## 85. La reseña como imagen (en la 1.86.0)

Encargo de Francisco del 4-11-2026, para enseñar reseñas en un TikTok de libros. Se cierra junto con la 1.86: no hubo una 1.85 aparte.

- Desde la ficha del libro, «Crear imagen de la reseña» la dibuja en un lienzo (`src/features/reviews/reviewCard.js`), sin pasar por una captura de pantalla.
- Dos formatos, 1080 × 1920 y 1080 × 1350, y tres papeles. Una reseña larga se reparte en varias imágenes, sin dejar una casi vacía.
- Se comparte con la hoja del sistema si el dispositivo la tiene; si no, se descarga. La pantalla está en `ReviewExport.jsx`.
- La portada llega por `api/portada.js`, una función de Vercel que solo sirve imágenes de los orígenes permitidos: sin ella, el lienzo quedaría bloqueado por CORS y no se podría exportar.

## 86. La identidad de los muebles y La estiba (1.86.0)

Respuesta a dos pegas de Francisco del 4-11-2026: nadie compraría en la Lonja un sofá que la tienda vende igual, y la pesada de Remedios no resultaba intuitiva ni dejaba ver sus premios.
**Tres migraciones nuevas, las aplica Francisco y en este orden**: `20261115120000_edificio_acabados.sql`, `20261116120000_hotel_estiba.sql` y `20261117120000_edificio_talleres.sql`. Hay que aplicarlas antes de publicar.

### 86.1 Acabados

- Cuatro acabados (`acabados.js`): Salitre, Sol de tarde, Lacado de puerto y Nácar, con pesos 45, 30, 20 y 5. Cambian los colores y añaden destellos discretos sobre el mismo dibujo.
- Solo comunes, poco comunes y raros; nunca místicos, mascotas, sagas ni premios. En los sobres, 1 de cada 20 copias: primero se sortea el mueble, como siempre, y después el acabado. No cambian rarezas ni pity, y la probabilidad se ve en el sobre.
- El sobre que trae uno se abre con otro brillo y su carta se distingue; el que no lo trae, no. La tienda vende siempre liso y lo ya poseído sigue liso.
- La copia conserva el acabado al colocarla, regalarla o cambiarla. En la Lonja tiene una horquilla de precio más alta (`piso_acabados`, `piso_libres`).

### 86.2 La estiba

- Sustituye a la pesada. Una bodega de 8 × 5 al día, la misma para todo el mundo, partida por el servidor en bultos de modo que siempre existe una carga perfecta (`piso_estiba_bodega`).
- Se juega en una escena dibujada (`hotel/estibaArt.js`): arrastrar del muelle, o tocar el bulto y el sitio. Tocar el bulto en la mano lo gira. Con teclado: flechas, R, Intro y Escape. Lo colocado se recuerda ese día en el dispositivo.
- La carga y lo que da cada nivel se ven mientras se coloca: menos de la mitad, 1 sello; media bodega, 2; llena (80 %), 4; perfecta, 7. Solo se zarpa una vez al día y, si queda hueco, se pregunta antes.
- `piso_estiba_zarpar` comprueba cada bulto. Los sellos no caducan y nunca son tickets. Con movimiento reducido, el resultado sale directo.
- La pesada se cierra sin borrar datos: se revocan sus funciones y `piso_lonja()` sigue devolviendo `juego` para la versión anterior.

### 86.3 La pared de premios

Siempre a la vista bajo el juego, nunca plegada (`hotel/LonjaPared.jsx`), y sin ofertas ni cuentas atrás.

| Premio | Sellos |
| --- | --- |
| Venta sin comisión / un hueco más / toldo | 10 / 14 / 18 |
| Gorro de estibador / mahón de faena / jersey de rayas | 24 / 28 / 36 |
| Acabado a elección sobre una copia lisa: Salitre / Sol de tarde / Lacado / Nácar | 40 / 50 / 70 / 100 |
| Gaviota del puerto (legendaria, te acompaña, no sale en sobres) | 120 |

La copia para el acabado tiene que poder venderse: ni colocada ni recién llegada.

### 86.4 Talleres y «Se busca»

- Seis talleres inventados (`talleres.js`, igual que `piso_talleres`) reúnen todos los muebles que se pueden cambiar en la Lonja. Tener una copia de todo lo de un taller da su placa para la pared y 30 sellos, una sola vez, aunque luego se venda algo. Los raros no están en la tienda, así que el Vivero y la Almoneda piden sobres o Lonja.
- El tablón es el cuarto faldón del toldo (`hotel/LonjaTablon.jsx`). Cada cual marca hasta tres muebles, sin texto libre; la marca caduca a los 30 días y los bloqueos se respetan. Se ve quién busca qué y, con copia libre, «Ofrecer» abre tu puesto con ese mueble.
- Las ofertas de los puestos llevan «Lo buscas» o «Te falta · taller».

### 86.5 Sin verificar

Arrastrar con el dedo en un móvil real, los sonidos nuevos, regalar y poner en la Lonja una copia con acabado desde la pantalla (el servidor sí está probado), colgar una placa y vestir la ropa nueva en el armario. La tienda aún no dice de qué taller es cada mueble, y el buzón no dice el acabado de un regalo.

## 87. La habitación en primera persona como inicio (1.87.0)

Integración del piloto «Del portal al sillón» (rama `experimento/piso-primera-persona`, detalle y medidas en
`docs/qa/piso-primera-persona.md`). Francisco lo comprobó en Android y en Safari de iPhone con la preview antes de
publicarlo (7-11-2026, «Si funciona»).

### 87.1 Inicio y edificio

- La app arranca en **tu habitación en primera persona** (`PisoLabPanel` con el piso `lab-1A`; `src/features/pisoLab/inicio.js`).
- Su puerta, el botón «Al edificio» y «Ir al edificio» del menú abren **el edificio del puerto** (§63), el de siempre, con las cuentas reales. Desde el edificio, atrás vuelve a la habitación. Escape no cierra la habitación.
- Por defecto en todo lo que compila Vercel (`__PISO_INICIO__` en `vite.config.js`). En local y en las pruebas sigue la habitación ilustrada, salvo con `PISO_INICIO=1`.

### 87.2 Volver a la experiencia anterior (temporal)

- En el menú del piso, **«Volver a la experiencia anterior»** abre la habitación ilustrada de siempre. Desde «Ambiente», **«Ir a la habitación nueva»** vuelve.
- La elección se guarda solo en el dispositivo (`bookshelf:inicio`), fuera de la biblioteca: no reinicia ni sustituye libros, lecturas, decoración ni la copia de la nube. `?inicio=habitacion|anterior` la fija desde la dirección.
- La habitación ilustrada se publica **como en la 1.86**. Rincón 01 (§ en `docs/ESTADO.md`, 5-11-2026) va en el código pero apagado (`RINCON_01` en `bookcaseLayout.js`) hasta que Francisco lo apruebe.

### 87.3 Registro, final del libro y relectura

- En la ficha, al guardar se cierra el formulario con «Lectura registrada» y **Deshacer** (8 s, como en la habitación). Guardar y Cancelar van tras el resumen y no tapan el campo con el teclado abierto.
- En la última página y aún en «Leyendo», la ficha ofrece **«Marcar como terminado»**: no lo termina sola.
- Un libro leído no se reabre al registrar ni al mover la página. La **relectura** se empieza con «Empezar relectura»: la lectura anterior pasa a `book.pastReads` (inicio y fin), se vuelve a la página 0 y las sesiones del registro se conservan. Campo nuevo dentro de la biblioteca guardada, sin migración.

### 87.4 Datos de demostración

- Las bibliotecas de demostración (`?piloto=piso&biblioteca=N`) nunca se siembran en producción. En producción `?piloto=piso` no abre nada: su portal de prueba lleva una vecina inventada.
- Si un navegador tiene una biblioteca de demostración, la nube se apaga (`demoLibraryActive`, `cloudSync.jsx`) y la habitación lo avisa con un enlace para volver a la tuya.

### 87.5 Rendimiento

- Guardar con 5.000 libros: solo se reconstruye el libro modificado (`serializeState` con caché por objeto), pero se sigue escribiendo la biblioteca entera. Guardados medidos por Francisco: 53 y 43 ms.
- Más detalle (desplazamiento, reposo y medidor `&medir=1`) en `docs/qa/piso-primera-persona.md`.

## 88. La habitación de inicio es tu piso; cada libro, con su portada (1.88.0)

Corrección de dos fallos de la 1.87 publicada (encargo de Francisco del 7-11-2026). Rama `1.88-habitacion-real`.

### 88.1 Tu piso real

- La habitación de inicio (`HOME_PISO = 'mio'`) es **tu piso del edificio**: el de tu cuenta, leído con `loadEdificio` y
  guardado con `savePiso`, con los permisos de siempre (solo se escribe el tuyo y el servidor lo valida). Primera persona,
  vista de siempre, Decorar y el edificio leen y modifican el mismo piso (`src/features/edificio/myPiso.js`,
  `src/features/pisoLab/useMyPiso.js`).
- Lo último que la pestaña sabe de tu piso se recuerda **en memoria, por usuario** (`myPisoCache.js`), para que pasar de
  una vista a otra no enseñe una versión anterior mientras llega la del servidor. Se olvida al cambiar de cuenta o cerrar
  sesión (`CommunityProvider`). Nada de esto va a `localStorage`.
- Mientras se resuelve la sesión o llega el piso: «Abriendo tu piso…». Sin cuenta, sin comunidad o con un error, un aviso
  con lo que falta, «Mi biblioteca» y la experiencia anterior. **Nunca un piso de prueba como tuyo.**
- **Sin reparaciones:** el piso se dibuja como está guardado. La puerta de salida y el ordenador (piezas del piloto que el
  servidor no admite) se añaden solo al dibujo en primera persona, donde caben sin mover nada, y nunca se guardan. Si un
  piso no tiene estantería, mesa o sillón, el interior funciona igual.
- La primera vez sin piso, el de partida del edificio (`starterRoom`), como siempre.
- Los pisos del piloto (`labStore.js`) solo con `?piloto=piso`. Una entrada del historial de la 1.87 (`lab-1A`) lleva a tu
  piso, o se cierra con la experiencia anterior.

### 88.2 Cada ejemplar, con su portada real

Encargos de Francisco del mismo día («prioridad visual» y los ajustes antes de cerrar la muestra): los libros de la
estantería tienen el mismo tratamiento que el de la mesa, y **un mismo ejemplar se ve igual en la mesa y en la balda**.

- **Un solo diseño por ejemplar.** Mesa y balda leen los mismos datos (`copyData`), las mismas medidas (`bookDims`:
  alto, ancho y grosor según páginas y formato; el grosor va de 0,08 a 0,18) y la misma cara (`bookFace`: portada y
  lomo). El modelo es `pixelBook` en los dos sitios (tapas que sobresalen, hojas, cantos, lomo). Solo cambian la
  orientación (tumbado en la mesa, de pie en la balda) y la luz de cada sitio.
- **Portada**: la real de su edición en la tapa, sin recortarla, pasarla a paleta ni sustituirla por colores; el libro
  toma la proporción de su portada (el ancho, sin pasar del fondo de la balda). Sin portada, o si no se puede leer, la
  tela con su título, como en la mesa. **La portada nunca se estira sobre el lomo para simular un lomo auténtico.**
- **Lomo**: si el libro trae la imagen de su lomo (`book.spine`), se usa esa (auténtico). Si no (hoy, ningún libro), es
  una **reconstrucción**: colores sacados del borde izquierdo de su portada (`spinePalette`) sobre uno de cinco diseños
  (cabeza y pie con banda; bloque arriba con raya; dos filetes a lo largo; pie de otro color; filetes dobles y marca cuadrada), elegido por el ejemplar, con el título y el apellido en
  píxel. El de la mesa usa el mismo lomo que el de la balda. La tarjeta del libro elegido lo dice: «Portada de su
  edición · lomo reconstruido» (o «lomo de su edición»), y `debug().shelf.spines` cuenta los auténticos.
- **Composición** (`composeRow` en `shelfLayout.js`): giros pequeños y fijos por libro, y nadie pisa al vecino (se
  mide la huella girada); en las baldas de abajo y del medio, el último ejemplar se gira (0,8 rad) para enseñar su
  portada. El ancho de cada balda se reparte según el grosor real y, si no caben todos, se aprieta un poco el relleno
  antes de dejar ninguno fuera (`shelfRows`). Lo que no cabe se cuenta y no se dibuja. No cambia qué libros hay, su
  orden ni la distribución guardada de la habitación.
- **Al elegir uno**, sale recto de la balda (perpendicular al canto, aunque esté girado, para no meterse en el sitio
  del vecino), hasta quedar entero por delante; luego gira hasta enseñar su portada y se desliza para que la portada
  quede delante de su hueco y, en los extremos, dentro de la fila (420 ms; al soltarlo, al revés). Uno nuevo espera a que
  el anterior haya vuelto. Con movimiento reducido, directo a su sitio final, sin animación. `sweep()` comprueba en
  reposo y en cada postura de la salida y el giro que ningún libro atraviesa a otro.
- **Cámara del acercamiento** (`rowView`): encuadra la balda elegida por sus libros (`rowBoxes`: de dónde a dónde llegan
  y su altura), no por el mueble, con margen para la barra de arriba y la de abajo; así se recorta techo y suelo vacíos.
- Solo se piden las portadas de los ejemplares representados, **en miniatura** (`-M` de Open Library, `w200-h300` de
  Google Books, reducidas a 150 px), cuatro a la vez y con una caché de 64 (`spineLooks.js`). Las portadas grandes
  (mesa y portada de frente) se recuerdan como mucho 6. Sigue el límite de 30 libros visibles: una biblioteca de miles
  no crea más modelos ni pide más portadas.
- La escena se vuelve a pintar si cambia la portada, el lomo, la edición, el color, el título o el autor, aunque el id
  sea el mismo (`sceneKey`).

### 88.3 Comprobado

Todo en emulación (Chromium y WebKit de Playwright a 390 × 844); nada en un iPhone, en Safari ni en Android reales.

- `e2e-community/v188-habitacion-real.spec.js` con dos cuentas simuladas (entrada, Decorar, edificio, regreso, recarga,
  cambio de cuenta, visita sin poder decorar); `e2e/piso-lomos.spec.js` con 1000 libros (y la selección con movimiento
  reducido); pruebas de `shelfLayout`, `bookLayout` y `spineLooks`.
- `e2e/piso-muestra.spec.js` (ediciones reales de Open Library por ISBN; necesita red, sin red se salta):
  - **cinco ediciones**: la habitación, cada balda de cerca y cada ejemplar elegido, frente a esa misma edición como libro
    de la mesa, a la misma hora;
  - **28 ediciones** distintas (27 representadas; filas de 10, 9 y 8): ningún cruce en reposo ni al salir y girar
    (`sweep(32)`), y cada libro se elige con un toque en el centro de su sitio, comprobando que bajo el dedo está ese
    libro y no un vecino (sitios de 16 a 71 px de ancho).
  - Hojas comparativas en `qa-report/piso-muestra/hoja-webkit.png` y `hoja-chromium.png` (no van a git).
- **Encuadre distinto entre Chromium y WebKit** (lo que se vio en las capturas anteriores): recorriendo la interfaz como
  una persona (mirar a la estantería, tocar la balda) y esperando a que acabe el vuelo, los dos motores dan exactamente
  la misma cámara (fila 1: posición [0,736, 1,687, 2,1], mira a [0,472, 1,58, 0,9]; fila 2: [1,54, 2,728, 2,15] →
  [1,265, 2,661, 0,9]; lienzo 390 × 780, 80,83° de campo). La causa **probable** de la diferencia anterior es la prueba,
  no la app: llamaba al acercamiento directamente, sin pasar por el panel, y capturaba a un tiempo fijo mientras el
  vuelo de 680 ms seguía en marcha (Chromium dibuja por software y va más lento). No se ha reproducido la prueba antigua
  para confirmarlo.
- **Franja oscura arriba en Chromium** (vista antes con la tarjeta del libro elegido): **no se reproduce** con el código
  actual y **su causa no está confirmada**. Comparación hecha: el lienzo leído con `toDataURL` en la misma tarea que su
  dibujo frente a la captura de pantalla de esa zona, fila a fila, en la habitación, la balda de cerca y el libro
  elegido con la tarjeta visible y oculta, en Chromium y en WebKit. En los ocho casos, ninguna banda de 4 px o más sale
  en pantalla 25 niveles más oscura que el lienzo (la diferencia media es de 2 a 4 niveles; 17 con la tarjeta, que es la
  propia tarjeta). Lo observado entonces: coincidía con la tarjeta reflejada en vertical y desaparecía al ocultarla, y
  WebKit no la tenía. Sin una captura del fallo junto a su lienzo no se puede decir si era del dibujo, de la composición
  de la página o de la emulación.
- **Fallos intermitentes** en las tandas de pruebas del piso (Chromium y WebKit a 390 px: piso-lab, piso-lomos, piso-inicio,
  piso-usabilidad, piso-esenciales, piso-ficha-visita y piso-muestra):
  - `e2e/piso-lab.spec.js` «el libro: tocarlo abre el registro de ese ejemplar y al cancelar vuelves al mismo encuadre»
    (WebKit): falló una vez un `toContainText` en una tanda anterior. Solo: 8 de 8. No falló en la tanda final.
  - `e2e/piso-esenciales.spec.js` «el menú cabe en la pantalla, encima de los controles» (Chromium): falló una vez en esa
    misma tanda. Solo: 8 de 8. No falló en la tanda final.
  - El detalle del error de esos dos no se guardó (la salida se recortó) y no se ha vuelto a ver: **causa sin
    identificar**. En la tanda siguiente fallaron otras dos que tampoco son de este cambio:
    - `e2e/piso-esenciales.spec.js` «el decorador los identifica…» (WebKit): `screenOfItem` del edificio devuelve `null`
      justo después de cambiar el color del escritorio (no encuentra sus píxeles en el dibujo). Sola, **falla 2 de 6**: es
      intermitente de verdad, en el decorador del edificio, que esta rama no toca. Causa sin identificar.
    - `e2e/piso-lab.spec.js` «si el registro termina el libro…» (WebKit): se agotaron los 90 s esperando el campo de
      páginas del registro. Sola, pasa.
  - Durante esa tanda el servidor anotó seis «Error creating WebGL context» (pruebas en paralelo con varios lienzos
    WebGL). Es una pista de que la carga influye, **no una causa demostrada**.
- **Tanda final** (con todo lo de arriba): 144 pasan, 1 se salta y 1 falla, «el decorador los identifica…» en WebKit.
- **Fallo real encontrado y corregido**: con la cámara del acercamiento más cerca de la balda, en el recorrido hacia la
  balda de abajo y la del medio se veía el final de las capas del paisaje de la ventana (la lejana por la derecha y por
  arriba, la media por la derecha; `exteriorMargins` daba hasta −1,29 m). Las capas son ahora más anchas (lejana 6 celdas,
  media 4,6) y la lejana más alta (hasta 4,4), con el cielo por encima de donde empezaba de su color más alto, así que
  desde el sillón la ventana se ve igual. Margen mínimo ahora: 0,24 m.

### 88.4 1.88.1: la fachada al volver de un piso

Encargo de Francisco del 7-11-2026 tras probar en Android: la fachada del edificio aparecía recortada y desplazada, con
placas de pisos fuera del dibujo, y en otros momentos del vídeo se veía bien. Rama `1.88.1-fachada`.

- **Causa, reproducida**: al volver de un piso (el tuyo, también después de Decorar, o el de un vecino), `mountFacade`
  hace el alejamiento desde la ventana por la que entraste: el escenario (dibujo y placas, que comparten la misma
  transformación) empieza ampliado ×3,4 alrededor de esa ventana y vuelve a ×1 en 520 ms. A diferencia de la llegada por
  el muelle y del asomarse, durante ese alejamiento **las placas no se ocultaban**: se veían placas de otros pisos fuera
  del dibujo. Además, el buzón (fuera del escenario, no se amplía) quedaba a la vista sobre otra parte del dibujo, y se
  podía tocar a mitad de animación.
- **Por qué no salía en las pruebas**: solo pasa con el build de producción. En desarrollo, StrictMode monta la fachada
  dos veces; el primer montaje se quedaba con la ventana de la que volvías (`lastPeek`) y el segundo hacía la llegada por
  el muelle, en la que las placas sí se ocultan.
- **Corrección** (`facadeView.js`, `edificio.css`): mientras se aleja, la fachada lleva `is-returning`, que oculta placas,
  insignias, buzón y su nota, y no admite toques hasta que acaba (como al llegar y al asomarse). La ventana de la que
  vuelves se olvida al terminar el alejamiento, no al montar: así un segundo montaje seguido (StrictMode, o datos que
  llegan justo después) se aleja igual, y desarrollo y producción hacen lo mismo. Sin cambios en el dibujo, en las
  placas ni en dónde se toca.
- **Comprobado** (`e2e-community/v1881-fachada.spec.js`, emulación, no un Android real): se graba cada fotograma de la
  fachada en cuatro recorridos (desde la habitación, tras Decorar en tu piso, tras el piso de un vecino y cambiando el
  alto de la pantalla como las barras del móvil). Con el código anterior y el build de producción, falla: varios
  fotogramas seguidos con las placas de 3.º A, 2.º A, 1.º A, 1.º B y «Al Gran Hotel» fuera del dibujo, 7 placas a la
  vista con el dibujo ampliado y el buzón visible. Con la corrección, ningún fotograma así, y al acabar el dibujo llena
  la fachada sin transformación con cada ventana dentro. Comparación en `qa-report/fachada-antes-despues/` (no va a git).
  Con las barras (alto de 700 a 844 px) la fachada ya se recolocaba bien antes: no era la causa.
- **Decorar y primera persona** (misma prueba): mover y girar la estantería, «Listo» y «Terminar» se guarda en el piso,
  se ve así en primera persona (`debug().shelfAt`) y sigue tras recargar; los objetos sin modelo en primera persona
  siguen en el piso guardado.
- Sin cambios en las portadas ni en el tratamiento de los libros.

### 88.5 1.88.2: los objetos que faltaban en primera persona y la misma habitación en las tres vistas

Encargo de Francisco del 7-11-2026, sobre la misma rama `1.88.1-fachada` («No mezcles con main todavía»): completar la
integración entre el piso real, la primera persona y el decorador isométrico, con el estilo pixel de siempre.

- **Qué faltaba** (lo que avisaba «Aún sin esta vista»): todo el catálogo ya tenía forma en primera persona salvo lo que en
  el isométrico es un dibujo vivo encima del mueble: los **místicos** (farol de llama azul, rosa bajo la lluvia de
  estrellas, búho de las constelaciones: solo se veía la peana), la **mascota** (perrito: solo el cojín), los **muebles
  vivos** (gramola y mesa de tapete: sin su animación) y las **copias con acabado** (salitre, sol de tarde, lacado de
  puerto, nácar: salían lisas y sin destellos).
- **Cómo se dibujan ahora** (`interior3d.js`):
  - Acabados: la misma pieza con su piel; cada color de sus cajas pasa por `tintar` como en `render.js` (también la
    tela del sillón, la lámpara de pie y las mesas pixeladas). La geometría compartida lleva el acabado en su clave.
  - Seres: el mismo dibujo de `misticos.js` (pixelfx), en un lienzo de 72 px de pie frente a la cámara, a la escala del
    isométrico (18 px por celda), en el centro de su mueble y a la altura de lo que lo sostiene (`heightOf`) más su peana
    (0,22) o su cojín (0,2), igual que `beingsNow` de `piso.js`; la mascota y lo vivo miran hacia donde está girado el
    mueble. Los destellos del acabado, sobre su mueble y del color del acabado. La mascota y lo vivo reciben la luz de la
    hora; los místicos y los destellos, no (dan la suya).
  - Se mueven a 5 fotogramas por segundo solo si alguno está a la vista y con las condiciones del agua de la ventana
    (nada en segundo plano, tapado o con movimiento reducido: entonces, quietos en la postura de su miniatura). No se
    pueden tocar (no tapan la estantería ni la mesa).
  - `misticoSprite(id).paint(t, opciones)` pasa ahora al dibujo el resto de opciones (tono, acabado, ancho), como el
    isométrico; las llamadas de antes no cambian.
- **«Aún sin esta vista»** solo sale para lo que no tenga forma en el catálogo (hoy, nada).
- **Una sola fuente de datos**: la primera persona, la vista de siempre, Decorar y la visita leen el mismo piso guardado
  (`useMyPiso`/`pisos.layout`); no hay una distribución aparte para la vista 3D ni se guarda nada al dibujarla.
- **Accesos esenciales sin muebles**: sin estantería, escritorio ni ordenador, la biblioteca, el registro y el ordenador
  siguen en los botones y el menú HTML («Toda la biblioteca», «Registrar lectura…», «Ordenador»). No se añade, mueve ni
  guarda ningún mueble por su cuenta; darles un sitio fijo en el piso sería otro cambio, con sus reglas.
- `debug()` del piso en primera persona: `beings` (qué seres, dónde y cuántos fotogramas) y `placed` (cada pieza
  dibujada con su posición), para comparar con el piso guardado.
- **«Ver la balda» sin estantería**: antes llevaba a una vista de balda vacía; ahora ese botón es «Biblioteca» y abre la
  biblioteca entera. Con estantería, igual que antes.

### 88.6 Comprobado y pendiente (1.88.2)

Todo en emulación (Chromium y WebKit de Playwright a 390 × 844); nada en un iPhone, en Safari ni en Android reales.

- `e2e-community/v1882-objetos.spec.js`, con dos cuentas simuladas:
  - Piso de Ana con una mesa y una lámpara de mesa con acabado encima, una tetera en lo alto de la estantería, un farol
    azul y un perrito. Recorrido: entrar → Decorar → mover la mesa (la lámpara va con ella), girar la lámpara, girar el
    perrito y cambiarle el tono, guardar la tetera → Terminar → primera persona → recargar → Bruno visita el piso de Ana.
  - En cada paso, lo dibujado en primera persona (`debug().placed` y `debug().beings`) coincide con el piso guardado:
    sitio, giro, altura del soporte (lámpara a 1,25 sobre la mesa) y seres sobre su peana o su cojín.
  - Lo guardado es exactamente lo que dejó el decorador. Bruno ve los mismos objetos, sin «Decorar», y ni su piso ni el
    de Ana cambian con la visita.
  - Sin estantería, escritorio ni ordenador: el ordenador (menú), la biblioteca (menú y «Biblioteca») y el registro
    siguen a mano, y el piso guardado no cambia.
- `e2e-community/v1882-comparativas.spec.js`: el mismo piso con los tres místicos, el perrito, la gramola, la mesa de
  tapete (con naipes y una lámpara con acabado encima), un jarrón de nácar en lo alto de la estantería y un sofá lacado.
  Cada ser, en su sitio y a su altura; lo de encima, a la altura de su mueble; se animan. Capturas en isométrico y en
  primera persona (tres giros) en `qa-report/v1882/hoja.png` (no va a git).
- Siguen pasando `v1881-fachada`, `v188-habitacion-real` y las e2e del piso (`piso-lab`, `piso-esenciales`, `piso-inicio`,
  `piso-usabilidad`, `piso-rendimiento`, `piso-ficha-visita`, `piso-lomos`): 144 de 148 en la tanda, con fallos solo en
  WebKit que solos pasan, salvo el ya conocido (abajo). Vitest de edificio y pisoLab: 268.
- **Fallos intermitentes de WebKit** (trazas guardadas en `qa-report/trazas/`, no van a git):
  - `piso-esenciales` «el decorador los identifica…»: `screenOfItem` nulo justo tras cambiar el color del escritorio en el
    decorador isométrico. Solo, falla 2 de 3 (ya visto en la 1.88: 2 de 6). Esta rama no toca ese decorador; causa sin
    identificar.
  - `piso-lab` «tocar el libro… la estantería acerca la balda» (una vez, en la habitación antigua) y «el libro: tocarlo
    abre el registro…», y `piso-usabilidad` «en el decorador…»: una vez cada uno en tandas de 2 hilos; solos pasan 4 de 4
    y 3 de 3.
  - La captura oscura al volver a la primera persona tras «Terminar» era de la prueba: se tomaba antes del primer
    fotograma (la traza muestra que dibuja a los 200 ms). Las pruebas esperan ahora al primer dibujado.
- **Pendiente**:
  - Los seres son dibujos planos de pie frente a la cámara (como en el isométrico, un solo lado): de cerca se ven grandes
    y pixelados, y al girar la mirada no cambian de cara.
  - El compañero legendario que te sigue y tu personaje no salen en primera persona (en el isométrico sí).
  - Un legendario colocado como mueble se ve como en el isométrico: solo su peana.
  - En la biblioteca abierta sin estantería, el botón de volver sigue diciendo «Volver a la balda» y los libros
    «En la estantería».
  - Dar un sitio fijo en el piso a estantería, escritorio y ordenador queda para un cambio aparte (formato y reglas del
    piso).
  - `goodreads.test.js` «BOM y saltos de línea de Windows…» falla en este ordenador; es del lector CSV, que este cambio no
    toca (no se ha comprobado con el commit anterior).

## 89. Rincón coherente: retirados, Esenciales y visita en primera persona (1.89.0)

En la rama `1.89-rincon-esenciales`, con preview; **no publicada**. Migración: `20261118120000_edificio_esenciales.sql`.

### 89.1 Objetos retirados temporalmente (`edificio/retirados.js`)

- Retirados enteros: `farol-azul`, `rosa-estrellas`, `buho-estrellas` y `perrito` (sprites planos con partículas).
- Solo se apaga el efecto: destellos de los acabados (`chispas-acabado`; queda el tinte) y la animación de encima de `gramola` y
  `mesa-tapete`, que siguen como muebles modelados (la mesa es un soporte). Lámparas y luz ambiental, sin tocar.
- No se dibujan en ninguna vista, no entran en la balda ni en la tienda, y no queda animación ni temporizador por ellos.
  El compañero legendario y los efectos de ropa no son objetos colocados: siguen igual.
- En memoria, `room.items` (visible) y `room.ocultos`. Lo oculto no bloquea selección ni colocación y conserva uid y sitio.
- Al guardar (`empaquetar`, único punto): vuelve a `layout.items` si cabe en su sitio; si no, se aparca en `layout.ocultos`.
- **Restaurar**: quitar el id de `RETIRADOS`. Vuelve a su sitio exacto solo si está libre; si no, se queda en `ocultos` y
  Decorar avisa «esperan sitio». Nunca se recoloca en otra parte ni se solapa.
- Limitación: una copia aparcada no cuenta como colocada; si se recicla mientras tanto, habrá que decidir qué hacer al restaurarla.

### 89.2 Esenciales (`edificio/esenciales.js`)

- Primera pestaña de Decorar: Ordenador, Estantería y Sillón, con su estado, Colocar o Elegir/Sustituir.
- Son muebles normales: **Ordenador = escritorio con ordenador** (conjunto explícito: se deduce en el primer escritorio con
  una celda libre, se elige y mueve con él y no se guarda); Estantería; Sillón (o sofá o mecedora).
- Básicos sin compra: una copia lisa de sillón, estantería y escritorio siempre disponible (cliente `conBasicos`, servidor
  `piso_falta_copia`). La tienda, sobres y reciclaje no cambian.
- El último de cada tipo no se guarda (solo se mueve, gira o sustituye). A un piso antiguo no se le añade ni reorganiza nada: se
  indica «Falta» y sus funciones siguen por los controles de siempre.
- Cámara: `asientoDe` (sillón, sofá o mecedora); la posición es proporcional al mueble. `debug().camera` informa de ella.

### 89.3 Pasada artística del rincón

Geometría fija y texturas pintadas una vez; sin render continuo. Rodapié con remate y cornisa en las cuatro paredes (se corta en la
puerta), enlucido mate de poco contraste, tapajuntas de ventana, zócalo y moldura de la estantería, faldón de las mesas de patas y
bastidor del sillón. Suelo, libros, colores y acabados del usuario, sin cambios.

### 89.4 Visita en primera persona (`pisoLab/VisitaPiso.jsx`)

Desde la vista de un vecino, «Entrar en primera persona» (la isométrica sigue, con «Ver en isométrica»). Mismo `Interior` con el
piso del propietario. Libros: solo `sharedBooks` de su rincón y colecciones visibles, con sus permisos; sin compartidos, estantería
vacía. Sin Registrar, Decorar ni guardado; conserva `VecinoMesa`; la puerta y «Volver al portal» salen al edificio.

### 89.5 Comprobado (emulación, nunca móviles físicos)

Vitest de `src/features/pisoLab` y `src/features/edificio`, RLS en PGlite, oxlint, build y `e2e-community/v189-rincon.spec.js` en
Chromium y WebKit a 390 px. Medido con `v189-medidas.spec.js`, mismo piso y encuadre (`qa-report/v189`), reposo 3D 5 s: Chromium 36 → 12
pasadas, WebKit 34 → 11; isométrica 5 s: 150 → 0 y 78 → 0 pintadas; llamadas 66 → 54; texturas 87 → 83. Giro sin cambio apreciable
(60 fps Chromium; ~10 fps WebKit, por software). La parte de los retirados y la de la pasada artística se miden juntas.

### 89.6 Arranque, noche, cámara del sillón y puesto del ordenador (1.89.1)

- **Arranque.** `App.jsx` monta siempre la habitación ilustrada y el piso 3D llega después, diferido; ese hueco era el destello. Con la habitación 3D como destino, la ilustrada sigue montada pero oculta (`data-home-3d`) y solo se ve «Abriendo tu piso…», con el aire de la carga del piso.
- **Noche.** La calidez sale solo de las lámparas colocadas (`nightWarmth`, según su cercanía al asiento; sin lámparas, 0 y la luz de luna de siempre). Sube su alcance e intensidad, baja el relleno frío y calienta paredes, tela y madera. Sin partículas ni fuentes nuevas.
- **Cámara del sillón.** Altura de ojos sin cambios (`EYE`). La mirada inicial busca la mesa y el libro, y la estantería si caben juntas; de cara a una pared cercana sin nada a mano, gira hacia el centro. Campo vertical con tope 66°, que se abre si la estantería está cerca. No se mueve ningún mueble. Los pisos `lab-` conservan su encuadre.
- **Ordenador.** En Esenciales, miniatura compuesta y «Ordenador y escritorio · colocado»; si el escritorio no tiene celda libre, lo dice. El menú «Ordenador» acerca la cámara como al tocarlo.
- **Comprobado** (emulación): Vitest de piso y edificio, e2e `piso-usabilidad`, `piso-esenciales`, `v189`, `v188` y `v1891-comparativas`. Las capturas de WebKit en Windows pueden entregar el fotograma anterior tras cambiar la hora (también antes de este cambio): la luz se compara en Chromium.

### 89.7 Cámara del sillón y arquitectura del rincón (1.89.2)

- **Cámara.** Ojos en el centro del asiento y por delante del respaldo (`SEAT`), a la misma altura. La mirada inicial es siempre el frente del sillón; solo baja si la mesa de lectura está delante y cerca (`TABLE_AHEAD`). Si no, se gira a mano o se usa «Registrar lectura». Un sillón de cara a una pared cercana ve esa pared.
- **Ventana.** Hoja interior, moldura escalonada, ménsulas, uniones marcadas, bisagras de hierro y falleba de latón.
- **Paredes y techo.** Enlucido irregular sin repetición, sombras tramadas en rodapié, cornisa, esquinas y marco, cornisa escalonada y viguetas, todo derivado del color elegido.
- **Mesas.** Canto en dos planos, faldón, clavijas y regatones; escritorio con cuarterones y tiradores con volumen.
- **Noche.** El calor queda cerca de las lámparas; lo demás, más frío y neutro.
- **Sin cambios** de medidas de colocación, posiciones guardadas, suelo, libros ni animación. Mismas llamadas de dibujo, geometrías y texturas.
- **Comprobado** (emulación): `v1892-camara-sillon`, `v1893-arte-rincon`, `v189`, `v188`, `piso-usabilidad`, `piso-esenciales`, Vitest de piso y edificio y build.

### 89.8 Coherencia de visitas, estantería, zona del libro y acceso 3D (1.89.3)

- **Acabado común.** Los muebles sin dibujo propio llevan la misma piel (mapa de tramado, filetes de canto y luz pintada) y el tinte de la hora que los dibujados, en el piso propio y en las visitas. Colores, muebles y distribución siguen siendo los de cada persona.
- **Cámara.** Sentado no se dibuja el propio asiento (sí al mirar una balda de cerca, y si el libro está en el sillón). Sin asiento, se entra por el punto libre más cercano al de siempre.
- **Estantería.** Más separación y menos giro entre libros, fondo casi liso, sombras sin tramado y lomos promediados al verse pequeños. Mismos libros y portadas reales.
- **Zona del libro.** `zonaLibro`: la celda de la mesa más cercana al asiento. `GUARDIA` rechaza objetos en ella (`libro`) y al soltar se ofrece el sitio válido más cercano. Regla de cliente: un piso antiguo sigue siendo válido; su libro usa otra celda libre sin guardar nada, y Decorar ofrece «Dejar sitio al libro», sin borrar nada y solo si se pide.
- **Visita.** «Entrar en 3D» bajo la etiqueta del piso, a la vista sin desplazar; dentro, «Ver en isométrica» bajo la vista, con «Volver al portal» y los permisos de visitante.
- **Comprobado** (emulación): `v1894-comprobaciones`, `v1894-evidencias`, `v1892`, `v1893`, `v189`, `v188`, `piso-usabilidad`, `piso-esenciales`, Vitest de piso y edificio y build.

## 90. Puerto Pixel: ordenador, registro, menú, sonido y pantallas de lectura (1.90.0)

Aprobada por Francisco el 8-11-2026 tras revisar vídeos y capturas. Sin migraciones. Detalle, recursos y diferencias con las láminas en `docs/design/puerto-pixel-v2.md`; inventario de funciones en `docs/qa/tabla-funciones-1.90.md`; sonido en `docs/audio/`.

- **Capa visual** en `src/theme/puerto-pixel.css` (prefijo `pp-`; `px-` ya es de `edificio.css`) y objetos del atlas en `src/ui/PixelIcon.jsx`. Recursos en `public/assets/puerto/`.
- **Ordenador:** carcasa de monitor, cielo continuo sobre el puerto, seis objetos, «Leyendo ahora» y cajón «Aplicaciones» con el resto de funciones.
- **Registro de lectura:** cuaderno con portadas estables (`Cover steady`, `SteadyImage`).
- **Menú de la habitación:** organizador de madera («Tu rincón»); suma «Decorar».
- **Calendario:** agenda de anillas con cuadrícula real y detalle del día (`PortCalendar`).
- **Sonido:** radio con interruptor, tres canales con volumen y silencio propios, ambientes y música, con un único controlador compartido (`src/audio/audioController.js`). Silencio hasta que se activa. El mar está retirado por ahora; su archivo se conserva.
- **Diario, estadísticas y pantallas secundarias:** variables `--pc-*` con la paleta Puerto Pixel; diario y estadísticas como cuaderno.
- **Biblioteca:** cabecera petróleo, filtros y libros en baldas; misma virtualización. **Decorar:** escena isométrica intacta.
- **Sin reestilizar:** ficha de libro y Ajustes.
- **Pruebas:** `e2e/pixel-v3.spec.js` y `e2e-community/pixel-v4.spec.js`, `pixel-v5-capturas.spec.js`, `pixel-final.spec.js`, `v190-*`. En emulación; no probado en móviles físicos ni con cuentas reales.

## 91. Correcciones de la Fase 1, caché persistente de portadas y «Tu mes en libros» (1.91.0)

- **Fase 1:** el cuerpo de cada ventana del ordenador es el único con scroll; el edificio ya no arranca música propia («Dos balcones» se conserva sin sonar); mar y lluvia regenerados más suaves, con el mar fuera de Sonido; las visitas enseñan «Está leyendo» y la biblioteca compartida en grupos de 30; tinte de tarde de las paredes ajustado en `materials.js`.
- **Caché de portadas (`public/sw.js`):** Cache API `bookshelf-portadas-v1`, sin versión de app, más índice en IndexedDB. 40 MiB y 300 portadas, con desalojo por uso. Clave estable por recurso, descargas agrupadas y 6 a la vez, sin guardar errores. Las portadas sin CORS (Google Books) se guardan opacas y cuentan 256 KiB. No es un modo sin conexión completo. Medición: `scripts/perf-portadas.mjs`.
- **«Tu mes en libros»:** se abre desde el calendario. Toda cifra sale de `monthSummary` (`src/domain/monthSummary.js`). Favorito y frase se guardan en `progress.monthNotes['AAAA-MM']`, sin migración.
- **Tarjetas:** 1080 × 1920 en lienzo (`monthCard.js`), máximo 12 portadas por tarjeta y páginas numeradas si hay más. Si una portada no se puede usar, va una cubierta con el título. Nada se sube.
- **Límites:** los libros leídos sin fecha se listan aparte porque no existe edición de fecha; el histórico solo cuenta lo que tiene fecha o sesiones.
- **Pruebas:** `monthSummary.test.js`, `e2e-community/fase2-mes.spec.js`, `fase1-audio`, `fase1-scroll` y `fase1-visitas`.

### 91.1 Ajustes del resumen, calendario y biblioteca (1.91.1)

- **Resumen:** el favorito se elige tocando la portada en la balda y se destaca en su propia balda; cifras como composición editorial; frase sobre papel rayado.
- **Navegación:** la flecha de la cabecera del ordenador es la única para volver; cambiar de mes usa ángulos (`PixelChevron`), también en el calendario.
- **Portadas:** `warmCovers` (`BookItem.jsx`) prepara las del mes y las de los vecinos, y el mes cambia cuando se pueden pintar (espera máxima 350 ms). Medición manual: `e2e-community/medir-mes.spec.js`.
- **Tarjeta:** las portadas toman el sitio libre; con favorito o frase, la primera tarjeta lleva como máximo 8 portadas y las demás 12.
- **Calendario:** cada día con lectura indica sus páginas o su porcentaje.
- **Biblioteca:** cada filtro con color e icono propios y «Añadir libro» siempre a la vista.

## 92. Biblioteca, ficha y resumen del mes con acabado literario (1.92.0)

Aprobada por Francisco el 8-11-2026 tras revisar capturas, PNG y vídeos. Sin migraciones.

- **Biblioteca:** vista de portadas y lista virtualizadas, filtros de color, buscador, orden y regreso con posición. Marco de ventana, baldas de lado a lado y pie «Tu biblioteca, a tu ritmo».
- **Ficha:** cabecera con portada, progreso, registro, «Expuesto en tu habitación», pestañas y recorrido de lectura.
- **Tu mes en libros:** tres favoritos ordenados por mes en `progress.monthNotes['AAAA-MM'].favorites`; el `favorite` antiguo se lee como puesto 1. Podio de peanas, cifras, «También me acompañaron», recuerdo y exportación con estados y límites.
- **PNG 1080 × 1920:** reutiliza las piezas reales de la pantalla, sin controles, nombre ni correo.
- **Estilos y recursos:** `src/theme/literario.css` y `public/assets/puerto/acabado/`. Los adornos pixel son originales; las maquetas no se usan como fondo ni se instalan sus portadas de ejemplo.
- **Diferencias aceptadas con la maqueta:** portadas reales sin lomo 3D, filtros de color (Fase 3), peanas separadas, contador en «También me acompañaron», sin × en la biblioteca y sin logotipo en la cabecera del mes.

## 93. Ficha y registro unificados, Favoritos y Recuerdo, y Diario como cuaderno (1.93.0)

Solo interfaz: sin migraciones y sin cambios en cálculos ni persistencia.

- **Ficha y registro de lectura:** campos, botones, desplegables y selección comparten acabado en `src/theme/literario.css`. En «Mi lectura», el recorrido y las sesiones van primero (5 días y «Ver registros anteriores»); Ajustar posición, EPUB, Sobre el libro y Datos de la edición quedan plegados.
- **Tu mes en libros:** «Favoritos» pasa a tarjetas con medalla CSS y mandos con nombre; «Recuerdo», a página de cuaderno con estado de guardado visible.
- **Diario del ordenador:** `DiaryNotebook` (`DiaryApp.jsx`) con pestañas Hoy, «Notas y citas» y Reseñas. Notas y citas son un único tipo de anotación (`book.quotes`), en una pestaña conjunta, por decisión de Francisco. El editor usa `AnnotationForm` dentro de la misma app. Las reseñas se leen de `book.review` y se abren en la ficha.
- **Volver:** al cerrar el editor o la ficha abierta desde el Diario se conservan pestaña, filtros y posición de desplazamiento; la ficha regresa al ordenador. Calendario, estadísticas, habitación y wrap-up no cambian.
- **Pruebas:** `e2e-community/diario-cuaderno.spec.js` y `e2e-community/ficha-acabado.spec.js`. Solo emulación (Chromium y WebKit de Playwright).

## 94. «Visitar» abre el piso y portadas estables al filtrar (1.94.0)

- **Visitar:** desde Comunidad y el salón se abre directamente el piso actual del lector (`VisitaLector`, que usa `VisitaPiso`), con una barra que identifica a su dueño, da acceso a su perfil y vuelve al origen. Retirados la escena del rincón heredado, su vídeo, sus imágenes y su precarga. Desde el edificio sigue la puerta con «Entrar en 3D».
- **Permisos:** `piso_visita` (migración `20261119120000_piso_visita.sql`, la aplica Francisco) entrega el piso de los vecinos y de quien sigues, con comunidad activa y sin bloqueo; nunca su biblioteca. Sin la migración se visita solo a los vecinos y a los demás se les avisa.
- **Portadas:** en la biblioteca actual (`PisoLibrary`), una portada ya mostrada no pasa por el hueco de espera. `BookItem.jsx` guarda hasta 300 ya decodificadas y recoloca el mismo elemento `<img>` al volver a montarse (prop `reuse`). Filtros, orden y datos no cambian.
- **Biblioteca antigua:** «Abrir Mi biblioteca» desde tu piso lleva a la actual. La antigua queda para la experiencia anterior y si el piso no se puede cargar.
- **Pruebas:** `e2e-community/visita-directa.spec.js`, `e2e-community/portadas-filtros.spec.js` y `pisoVisita.rls.test.js`. Solo emulación.

## 95. Tablón libre (1.95.0)

- **Mueble:** «Tablón», especial y gratis, de dos casillas de pared (1,9 × 1,42 m). Se pinta con la composición en una textura estática de 1536 × 1152 (`drawBoard.js`), una vez por revisión.
- **Acceso:** tocar el mueble, o «Tablón» en el Menú del piso si está colocado. El ordenador no lo abre. Sin mueble no hay entrada, y los datos se conservan.
- **Mirar y diseñar:** `select: 'tablon'` abre la vista enmarcada en 4:3, solo lectura; tocar una nota la abre en grande. El botón discreto «Diseñar» lleva a `'tablon:diseno'` y el editor es `'tablon:diseno:editar'`. Quien visita ve la misma vista con la copia pública.
- **Notas:** `formatOf` da el objeto de cada tarjeta: nota adhesiva, hoja rayada o ficha (variación fija por id), cita a máquina, libro con marco blanco y correo con ribete. Cuatro papeles, tres chinchetas, adorno opcional e hilos unidos a las chinchetas.
- **Lienzo:** libre en `src/features/tablon/`, con deshacer, conexiones, lista, varias composiciones, borrador local y control de revisiones; un conflicto nunca sobrescribe.
- **Público y post-its:** lo público es una copia aparte, publicada con vista previa y sin referencias privadas. Post-its de hasta 200 caracteres, uno al día por remitente y destinatario (UTC), atómicos e idempotentes; exponer uno exige permiso de quien lo escribió, que también puede retirarlo. El libro de visitas queda como archivo privado.
- **Migración:** `20261120120000_tablon.sql`, aplicada por Francisco el 2026-11-09. Las tablas solo se usan mediante funciones.
- **Pruebas:** `e2e-community/tablon.spec.js` (Chromium y WebKit a 390 px) y `tablon.rls.test.js`. Solo emulación.

## 96. Tablón en el escritorio, dibujos y biblioteca del visitante (1.96.0)

- **El tablón va montado en el escritorio** que tiene el ordenador, por encima del monitor, y se mueve y gira con él. Deja de ser un mueble que se coloca aparte: un tablón suelto ya guardado se ignora, sin borrar datos. Sin ese escritorio no hay tablón. Monitor y tablón se pulsan por separado.
- **Relieve y nitidez:** marco con grosor, corcho hundido, remate, repisa y esquinas de latón. El contenido se superpone en el DOM a alta resolución (`.plab-board-sharp`, con `matrix3d`); si algo lo tapa se ve la textura de la escena.
- **Bandeja de diseño** encuadrada a 360 y 390 px; Alejar y Acercar pasan a ser solo iconos.
- **Biblioteca del visitante** en solo lectura: lo expuesto en la estantería y lo que se comparte (rincón y colecciones visibles). Lo expuesto se publica como copia aparte (`piso_expuestos`, migración `20261121120000_piso_expuestos.sql`), sin la lectura actual, y se lee con las reglas de la visita.
- **Dibujos** (`dibujo.js`, `Dibujar.jsx`, migración `20261122120000_tablon_dibujos.sql`): quien visita deja un dibujo en vez de un post-it, con el mismo cupo diario, y el dueño puede dibujar desde Añadir. Se guardan como trazos validados en el servidor (cinco colores, coordenadas enteras de 0 a 120, hasta 150 trazos y 4000 puntos), nunca como imagen. Se deja la hoja o la forma recortada: elige quien dibuja y el dueño puede cambiarlo. Mismas reglas que un post-it para privacidad, permiso público, retirada, denuncia y bloqueo.
- **Límites:** solo emulación. La capa nítida se descuadra en WebKit para Windows; falta comprobarla en un iPhone real. No hay moderación automática de los dibujos.

## 97. Reestructuración de muebles (1.97.0)

Encargo de Francisco del 9-11-2026, «que cada mueble se sienta bien», por bloques con capturas.
- **Retirados sin borrar:** todas las piezas de saga y 39 muebles hechos de cajas (`EN_REFORMA` en `retirados.js`) no se dibujan ni se ofrecen en la balda, la tienda, la mudanza ni la Lonja. Quien los tiene los conserva, el piso guardado no cambia y vuelven cuando se rehagan al nivel de la casa. Quedan 14 a la venta: sillón, lámpara de pie, estantería, mesa, mesa baja, escritorio, ventana y lo de pared con dibujo. Sin pestaña «Sagas».
- **Sobres cerrados por reforma** (decisión de Francisco): la tienda lo dice sin botones de abrir ni probabilidades; en la caja y la lata del casino, el sobre y los muebles retirados llevan «En reforma». Lo hace cumplir el servidor (migración `20261123120000_muebles_reforma.sql`, la aplica Francisco): `piso_abrir_sobre` cerrado, y `piso_comprar`, `piso_casino_canjear`, `piso_casino_lata_canjear`, `piso_regalar` y `piso_lonja_poner` rechazan lo retirado. `piso_retirados()` coincide con `RETIRADOS` (prueba de paridad).
- **Muebles por zona de la casa** (`ZONAS`, `zonaOf` en `catalog.js`): rincón de lectura, salón, dormitorio y estudio, y «Paredes y suelo» con lo de pared, las alfombras, los colores y el suelo. Sin pestañas vacías (hoy no sale Dormitorio). `cat` sigue siendo el tipo, para los sobres y el servidor.
- **Las cuatro paredes del 3D, del mismo color:** la de enfrente lleva ya la misma lámina con el color elegido y la luz de las lámparas.
- **Pendiente de decidir:** los talleres piden muebles retirados; los puestos de la Lonja ya puestos con algo retirado y pedir un mueble retirado; el reciclaje sigue enseñando copias retiradas.

## 98. La recepción del Gran Hotel en 3D (1.98.0)

Encargo de Francisco del 9-11-2026 («ahora me gustaría que empezáramos con el rascacielos»), por bloques con capturas entre uno y otro.
- **Se entra en 3D:** al tocar el vestíbulo en la fachada del Gran Hotel se abre la recepción en primera persona (`recepcion3d.js`, Three.js con el mismo método que la habitación: arte a 320 px, luz pintada y texturas de píxel). Se está de pie en la entrada, en la esquina de la puerta, y se mira girando (arrastrar o flechas) del carrito, a la derecha, al guardarropa, a la izquierda. Los muebles y las personas salen del mismo plano que el dibujo isométrico (`lobbyLayout.js`): el conserje con el casillero de llaves hueco, el mostrador de nogal y mármol, la huésped con su maleta, el tablón, el guardarropa, el diván con la palmera, la araña y el ascensor con su esfera.
- **Lo que se toca:** letreros de latón sobre la recepción, el ascensor, el tablón y el guardarropa, que siguen a la vista. Tocar una cosa (en la escena, en su letrero o en la barra de nogal de abajo, con «Encargos de la semana» en terciopelo y tres iconos de píxel) acerca la cámara y abre su papel crema con marco de latón; lo enfocado queda en el hueco que deja el papel. Son los mismos papeles del plano: los encargos del conserje y «Abre pronto» en el tablón y el guardarropa. «Volver», tocar fuera o Escape vuelven a la entrada; otro Escape sale a la plaza.
- **El ascensor por dentro** (petición de Francisco: «que se abra y entres, que sea todo muy lujoso y veas las opciones como los botones de él»): las puertas de latón se abren, se entra en la cabina y se gira hacia la botonera. La cabina tiene nogal con marquetería, espejos biselados, friso déco, un sol de marquetería, banco de terciopelo, pasamanos y suelo de mármol con estrella. Los botones de las plantas son la botonera de siempre, puesta encima de la placa de latón de la pared (`plateRect()`). Al pulsar una planta abierta, la aguja va hasta ella («Bajando al casino del sótano…») y se llega; las demás dicen qué habrá en una placa de nogal. «Salir del ascensor» o Escape: se sale de espaldas y se cierran las puertas. Con movimiento reducido, todo directo.
- **«Plano»:** cambia al vestíbulo isométrico de siempre, y el dispositivo lo recuerda (`bookshelf:vestibulo-vista`); su placa «Entrar en la recepción» vuelve al 3D. Sin WebGL, o si se pierde la GPU, se abre el plano y no se recuerda (la próxima vez se vuelve a intentar).
- **Detalles técnicos:** `RecepcionVista.jsx` (no `Recepcion3D.jsx`: Windows no distingue mayúsculas y lo confundía con `recepcion3d.js`). `preserveDrawingBuffer` está activado porque el WebKit de Playwright en Windows no presentaba los fotogramas nuevos. En escritorio, el alto llega al pie del panel.
- **Pruebas:** `e2e-community/v198-recepcion3d.spec.js` (360, 390, 430 y escritorio en Chromium, y WebKit a 390; casino desde la cabina; sin WebGL), `recepcion3d-capturas.spec.js` y `v175-vestibulo.spec.js` (prueba el plano y lo elige al empezar). Solo emulación.

## 99. El Almacén del Puerto: la Lonja en 3D (1.99.0)

Encargo de Francisco del 9-11-2026: la Lonja pasa a ser un gran almacén de muebles en 3D, con el mismo lenguaje que la recepción (§98).
- **El almacén** (`almacen3d.js`, plano en `almacenLayout.js`): nave de 18 × 26 con cerchas, lámparas colgantes, suelo con camino y flechas, muro de ladrillo y cal, puerta de cristal con el ancla y el portón verde del muelle. Tres pasillos de expositores por zonas de la casa (rincón de lectura, salón y estudio, paredes), ambientes montados en la pared de la izquierda, estanterías de paquetes al fondo, el directorio y la caja con su cajero. Cada expositor es el modelo del catálogo sobre una tarima con su etiqueta de precio. Se anda tocando el suelo (por una red de pasillos con ruta más corta), se mira arrastrando y con flechas; un toque no es un arrastre (8 px). La escena se monta por zonas (cerca de la cámara) y se dibuja solo cuando cambia algo.
- **Ficha**: al tocar un mueble la cámara se acerca y sale su papel con precio, medidas, «Ya tienes N» y los tonos, que se ven en el mismo mueble; arrastrar lo gira. «Volver» devuelve a donde estabas.
- **Carrito y caja**: la carretilla de abajo muestra los paquetes; en «Carrito» se cambian cantidades (1–10) y se quita. Se guarda en el dispositivo. La caja enmarca al cajero y cobra en el servidor: `piso_almacen_comprar` (migración `20261124120000_hotel_almacen.sql`, la aplica Francisco) bloquea la cuenta, valida líneas, precios del catálogo y saldo, y es idempotente con una clave de compra que el cliente conserva mientras el carrito no cambia. Doble toque, reintento tras un fallo de red o dos compras a la vez no cobran dos veces; si falla, el carrito se queda. Lo comprado va al inventario de siempre (Decorar).
- **«Sella el albarán»**: opcional, uno al día por cuenta (día de Madrid, lo decide el servidor), 0/3/6/10 % de descuento para una compra de ese día. Rápido (unos 13 s) o «Sin prisa» (el plano avanza a saltos de un segundo; por defecto con movimiento reducido). El servidor guarda la hora de inicio y solo acepta sellos dentro de su ventana; recargar o salir no repone el intento y el resultado se guarda hasta el final del día. Fallar no encarece nada. Se dice cuándo vuelve.
- **Con un amigo** (seguimiento mutuo, `piso_casino_amigo`): se invita desde «Con un amigo»; el aviso llega estés donde estés del edificio («Ir al almacén»). Os veis con vuestro personaje y su carretilla, con un pulso por segundo (posición, zona, qué mira y su albarán, nunca tickets ni carrito). «Mira esto» le ofrece al otro ir a ver un mueble; en la caja se ve el albarán del otro. Si uno se va, el otro sigue.
- **El mercadillo de antes** (puestos, «Se busca», «La estiba» y su pared de premios) sigue entero: «Mercadillo» en la barra o el letrero del muelle; «Volver al almacén» regresa.
- **El minijuego, más vivo** (Francisco: «que sea más divertido e interactivo»): los planos pasan por una cinta transportadora con el dibujo de los muebles del carrito; un sello de goma cuelga sobre la marca y baja al sellar (botón, tocar la cinta o barra espaciadora). La tinta cae donde estaba el plano en ese instante y se dice lo que ha pasado («¡Clavado!», «¡Sellado!», «Fuera de la casilla», «Se fue sin sellar»), sin falsos «casi». El albarán de abajo se llena con los planos sellados, al cerrar se estampa el descuento y la caja guarda la hoja sellada del día. Sonidos propios sintetizados (`albaranSfx.js`), solo con el sonido activado. Mientras se juega, la caja enseña solo el mostrador. Los tiempos y lo que comprueba el servidor no cambian.
- **El albarán, en el propio mostrador** (Francisco: «que la cámara se acercase a la caja y ahí sucediese el juego, sin abrir nada externo»): con el almacén en 3D, al empezar la cámara baja a la cinta del mostrador y el juego pasa en la escena: los planos (con el dibujo de los muebles del carrito) corren por la cinta, el sello de latón cuelga de su riel sobre la raya roja de la marca y baja al sellar, y la tinta queda en el plano. Encima solo queda el letrero de lo que pasa, los tres planos del albarán y el botón «¡Sellar!»; también se sella tocando la escena o con la barra espaciadora. Al cerrarse se estampa el descuento y la cámara vuelve a la caja. El acierto se calcula con el reloj en el instante de tocar, no con el último fotograma dibujado (en un móvil lento sería injusto). Sin 3D, y para mirar el albarán de un amigo, sigue la versión dibujada de antes.
- **Interfaz** (retoque pedido por Francisco): papeles de estraza con rótulo verde (como un albarán), ticket de caja a máquina con sello «Pagado», albarán en papel carbón azul con los premios a la vista, barra como balda metálica con la caja en el centro y letreros de escena como etiquetas colgantes y señales. Esquinas de píxel, sin redondeos.
- **Límite conocido**: si un plano se acierta lo dice el cliente; el servidor solo comprueba el tiempo y calcula el porcentaje.
- **Pruebas**: `almacen.rls.test.js` (13, PGlite) y `e2e-community/v199-almacen.spec.js` (capturas a 360/390/430/escritorio; recorrido, sin saldo, doble toque, fallo de red, albarán, visita con dos cuentas y aviso, en Chromium y WebKit a 390). `v184-lonja`, `v186-estiba` y `v186-tablon` entran ahora por el almacén. Solo emulación.

## 100. Ofertas del almacén, el carro delante y el albarán en resguardo (1.100.0)

Ampliación pedida por Francisco el 9-11-2026 (CLAUDE.md, «La Lonja»), por bloques con capturas.

- **El carro delante de ti**: mientras se anda por el almacén se lleva un carro de plataforma (pegado a la cámara, en su propia capa: siempre se dibuja encima, nunca se mete en un mueble). Un paquete de cartón por unidad del carrito (hasta 8, en dos pilas) y la pegatina con el dibujo del mueble en el de arriba. Tocarlo abre el carrito. No se ve al mirar de cerca, en la caja ni en el mostrador. La carretilla de la esquina solo queda sin 3D; el botón Carrito de la barra dice cuántos artículos llevas.
- **El albarán de la caja, en resguardo**: una tira azul grapada al ticket con una línea («Sella el albarán · Hasta −10 % en una compra de hoy») y «Jugar»; debajo, «Sin prisa» y «¿Cómo va?» plegado con las reglas. Después de jugar, el mismo resguardo con los planos sellados y el descuento estampado.
- **Ofertas** (cifras de Francisco): cada día (de Madrid) 4 muebles al azar con −20 % y cada semana (lunes a domingo) 1 con −50 %, que no repite como oferta del día. Las elige el servidor, igual para todos, con un hash del día o de la semana entre lo que el almacén vende (`piso_almacen_ofertas_de`, migración `20261125120000_almacen_ofertas.sql`, la aplica Francisco). Solo en el almacén: la tienda y los demás precios no cambian. Precio de oferta por unidad con el descuento redondeado a la baja (`hotel/ofertas.js`, igual que el servidor); el albarán se aplica después al total (como mucho −50 % y −10 %: un 55 %, por debajo del 60 % acordado). Si el día cambia entre ver y pagar, el total no cuadra y no se cobra (aviso de siempre).
- **Dónde se ven**: en la escena, la etiqueta del mueble con «−20 %» y el precio tachado (la de la semana en rojo); en la ficha, el precio tachado y «Oferta del día · −20 %»; en el directorio, un tablón «Ofertas» arriba; en el carrito y en el ticket de la caja, «oferta −20 %» con el precio tachado; en el recibo, «Ofertas: ahorras N tickets».
- **Sin la migración**: el almacén vende sin ofertas (el estado no las trae).
- **Pruebas**: `almacen.rls.test.js` (17: las de antes, sin ofertas, y 4 nuevas: reparto y forma, mismas para todos y la de la semana fija de lunes a domingo, el estado, y la compra con oferta y albarán), `ofertas.test.js` (precio y lectura) y `v199-almacen.spec.js` (ofertas en directorio, ficha, etiqueta, caja y recibo; el carro en la captura 8b).

## 101. Las habitaciones del almacén y la colección de superhéroes (1.101.0)

Ampliación pedida por Francisco el 9-11-2026 (CLAUDE.md, «La Lonja»), bloque 3: colecciones por zonas temáticas como en una tienda de muebles con habitaciones montadas; la primera, de superhéroes, con su rincón especial, y un par de habitaciones normales alrededor. Decisión de Francisco: muebles nuevos a la venta, con modelo 3D a la altura de la casa.

- **La colección «Capa y Antifaz»** (taller nuevo, `talleres.js`, con su placa `placa-heroes` y los 30 sellos de siempre al completarla): seis muebles originales del género, sin personajes, emblemas ni logos (capas, antifaces, viñetas, un foco y un rayo de neón):
  - **Sillón de la capa** (poco común, 2 × 2, asiento): el sillón tapizado de la casa con una capa echada sobre el respaldo, su broche y un cojín con antifaz. En el piso 3D es el sillón de la casa (`upholsteredArmchair`) más la capa encima (`SILLON_CAPA_BASE`, `interior3d.js`).
  - **Expositor de cómics** (común, 2 × 1): tres repisas con nueve tapas de cara y un montón de números atrasados encima.
  - **Foco de la señal** (poco común, 1 × 1, da luz): foco de teatro sobre trípode con la lente encendida.
  - **Maniquí con capa** (poco común, 1 × 1): busto con traje, cinturón, capa y antifaz.
  - **Lámina de viñetas** (común, pared, 2): tres viñetas, una figura con capa en vuelo, una explosión de onomatopeya y la ciudad de noche con su bocadillo.
  - **Neón del rayo** (poco común, pared, 1, da luz): un rayo en zigzag de tubo de neón.
  Sus tonos cambian el color del traje o del mueble; la capa va a juego (roja con lo azul, lo verde y lo oscuro; dorada con lo rojo). Precio de siempre por rareza (común 20, poco común 40), en la tienda del bajo y en el almacén, y entran en las ofertas. Zonas de la casa: el sillón y el expositor, rincón de lectura; lo de pared, «Paredes y suelo»; el resto, salón.
- **No entran en los sobres** (marcados `coleccion: 'heroes'`; `economy.js` los deja fuera de `SOBRES` y de la tabla de probabilidades): los sobres siguen cerrados por la reforma y sus sorteos no cambian. **Al reabrir los sobres**, `piso_abrir_sobre` tendrá que dejarlos fuera también en el servidor (el sobre de coleccionista sortea «todo el catálogo» por rareza).
- **Migración** `20261126120000_almacen_heroes.sql` (la aplica Francisco, después de `20261125120000_almacen_ofertas.sql`): las siete filas de `piso_catalogo` y `piso_talleres()` con el taller nuevo. Sin ella, el servidor no conoce estos muebles: no se pueden comprar (`almacen:no_se_vende`) ni completar la colección.
- **Las habitaciones** (`almacenLayout.js`: `HAB`, `PASO`, `HABITACIONES`, `RINCON`): una sala contigua a la nave, a la derecha del cruce del fondo, a la que se entra por un paso con marco de acero en la pared derecha. El pasillo 4 la recorre (nudos `hab` y `hf`); al tocar el suelo, a cada lado de la pared solo cuentan sus pasillos, y lo de un lado no se rotula ni se toca desde el otro. Enfrente del paso, un letrero verde con tres dibujos (sillón, escritorio y capa). Habitaciones abiertas al pasillo, con tabiques de friso de roble y papel, postes y dintel, y su lámpara:
  - **Capa y Antifaz**: azul noche con franja roja y dorada, suelo de puntos de trama de cómic con filo dorado, carril con dos focos; el sillón, el expositor, la lámina y el neón. **Su rincón especial**: un escenario redondo granate con filo de latón y escalón, con el maniquí y el foco, que apunta al mural de la ciudad de noche con la señal (un rayo en un círculo de luz) en la pared del fondo.
  - **Estudio con vistas** (tarima, estantería, escritorio, lámpara, mapa y reloj) y **Salita de tarde** (alfombra, sillón, mesa baja, lámpara, cuadro y ventana): muebles de la casa en otros tonos, como los ambientes montados (sección `habitaciones`, que como `ambientes` no sale en el directorio ni es el expositor principal de nadie: `DE_PASO`).
- **Directorio**: sección «Capa y Antifaz · superhéroes», con el número 4 («Pasillo 4, las habitaciones»); desde ahí se va andando hasta la habitación y se abre la ficha.
- **Pruebas**: `talleres.rls.test.js`, `zonas.test.js` y la paridad del catálogo con la migración nueva; `tienda.rls.test.js` e `inventario.rls.test.js` dejan fuera las colecciones, como los sobres; `e2e-community/v1101-habitaciones.spec.js` (capturas de la sala a 360, 390, 430 y escritorio; directorio, ficha y compra del sillón de la capa en Chromium y WebKit a 390; vídeo con `ALMACEN_VIDEO=1`); `reforma-tienda.spec.js` cuenta 20 muebles en la tienda (14 + 6). Los ayudantes del almacén están en `e2e-community/almacenHelpers.js`.

## 102. El probador del almacén (1.102.0)

Ampliación pedida por Francisco el 9-11-2026 (CLAUDE.md, «La Lonja»), bloque 4: «algo para la ropa». Decisión de Francisco: **un probador con espejo para cambiarte la ropa que ya tienes**; no vende ropa ni toca misiones ni casino.

- **Dónde** (`PROBADOR` en `almacenLayout.js`): en la entrada de las habitaciones, contra la pared del norte, a la izquierda según se cruza el paso. Un **espejo grande de pie** con marco de latón, copete con óvalo granate y dos apliques, la alfombra redonda y un puf delante; y **dos cabinas** de roble con cuarterones, la cortina (granate y verde) corrida a medias, su barra, un banco y una percha con una prenda dentro, y encima un letrero de esmalte con una percha. Dentro del marco todo es azogue (lados, techo y el suelo reflejado), para que se lea como el otro lado del espejo.
- **Cómo se usa**: el letrero «Probador» (o tocar el espejo o las cabinas) lleva andando hasta el espejo; la cámara se pone delante y **tu personaje sale reflejado** detrás del cristal (`probador(on, { avatar, top })` y `vestir(avatar)` en `almacen3d.js`; el cristal es un velo con dos brillos). Abajo, el papel «El probador» con cuatro pestañas (Jersey, Pantalón, Gafas, Extras) y una fila de perchas que se desliza, cada una con su muestra. **Lo que tocas se ve al momento en el espejo**; «Como iba» lo deshace; **«Listo, me lo quedo»** lo guarda (`savePersonaje`, como el armario del piso: el servidor y el dispositivo) y «Volver» o Escape lo dejan como estaba. Sin 3D, la muestra del personaje va en el papel.
- **Solo lo tuyo**: la ropa de serie, lo ganado (`loadArmario`: misiones del día, caja del casino y pared de la estiba) y lo que ya llevas puesto. Lo que no tienes no sale (no hay candados ni precios). El papel dice cuántas prendas especiales tienes y de dónde sale la nueva. El pelo y la piel siguen en el armario de tu piso.
- **Quién eres**: `loadMiPersonaje()` (`service.js`) toma el personaje del servidor; sin él, el del dispositivo; y si no, el de serie.
- **No cambia nada más**: no cuenta la misión «Cámbiate de ropa», no da ni cobra tickets, fichas ni sellos, y no hay migración.
- **Los rótulos y toques de los sitios**, como los de los expositores desde la 1.101: solo los de este lado de la pared derecha (el probador, en las habitaciones; caja, directorio y muelle, en la nave).
- **Pruebas**: `e2e-community/v1102-probador.spec.js` (capturas 40–43 del probador, el espejo y la ropa a 360, 390, 430 y escritorio; solo la ropa tuya y «Volver» sin guardar, en Chromium y WebKit a 390; vídeo con `ALMACEN_VIDEO=1`), y `v1101-habitaciones` y `v199-almacen` siguen en verde.

## 103. Las escaleras mecánicas y la planta de abajo (1.103.0)

Segunda ampliación del almacén, pedida por Francisco el 10-11-2026 (CLAUDE.md, «La Lonja»), bloque 1: «que cuando entres al almacén haya unas escaleras mecánicas que lleven a una planta de abajo y se vea el recorrido», y «si la gente ya tenía muebles comprados en la anterior planta deben pasar por caja primero».

- **Dónde** (`ESCALERA` y `BAJO` en `almacenLayout.js`): nada más entrar, a la derecha, junto a la pared derecha de la nave. Dos escaleras mecánicas en paralelo: la de **bajada** (hacia el fondo) y la de **subida** (hacia la entrada), en un hueco de la losa de 2 × 9,3 casillas con barandilla de cristal y pasamanos de acero. Cada una con peldaños de acero con filo amarillo **que se mueven**, faldones, cristal con pasamanos de goma negra, peines de aluminio arriba y abajo y la armadura verde de la casa con la panza de acero, que se ve desde abajo. Encima de las cabezas, un cartel verde con una flecha por escalera; abajo, otro sobre el pie de la de subida.
- **La planta de abajo** (planta −1, la de ropa; la ropa llega en el bloque 2): debajo de la nave, 4,2 de alto, suelo de tarima de roble clara con los pasillos en baldosa de piedra y filete verde, techo de placas con plafones y las paredes de la casa (ladrillo, franja verde y encalado). Su red de pasillos: el pie de las escaleras, el cruce de delante de ellas, el pasillo central (x = 11,5), el izquierdo (x = 5) y los cruces del fondo y de delante. Un cartel colgado, «Planta −1 · Moda».
- **El recorrido**: la red de pasillos sabe de alturas (`NODOS` con z; `onNet(x, y, z)` y `route` devuelven [x, y, z, mec]); las escaleras son tramos de un solo sentido donde no se para nadie (`zEscalera`, `plantaDe`). Ir de una planta a otra va andando hasta la escalera y **se ve el viaje entero**: se sube al peine, la escalera te baja (o sube) a su paso, la mirada se inclina un poco hacia donde va y el carro se esconde mientras dura. Durante el viaje no se cambia de camino: lo que se pida entonces se hace al llegar. Tocar el suelo anda por la planta en la que estás; lo de la otra planta (rótulos, precios y toques) no se ve ni se toca.
- **Cómo se va**: el letrero de la escalera («↓ Planta −1 · Moda» arriba, «↑ Planta 0 · Muebles y caja» abajo) o tocar la escalera; en el directorio, «Bajar a la planta de ropa» o «Subir a muebles». Ir a la caja, a un mueble o al probador desde abajo sube por la escalera de subida. Al entrar, la vista mira ya un poco hacia las escaleras (`INICIO`).
- **Pasa por caja primero**: con muebles en el carrito no se baja. Se va hasta lo alto de la escalera y sale el aviso «Antes de bajar, pasa por caja: llevas muebles en el carrito», con «Ir a caja» (`puedeBajar` y `onBloqueo` en `mountAlmacen`). Al pagar (el carrito vacío) se puede bajar.
- **Sin migración.** Con un amigo, quien esté abajo se le ve aún en la nave a su altura de planta (el pulso guarda x e y): se arregla con la migración del bloque 3.
- **Pruebas**: `src/features/edificio/hotel/__tests__/almacenLayout.test.js` (la red con dos plantas: sentidos de las escaleras, no pararse en ellas, `dentro` y `zEscalera`), `e2e-community/v1103-escaleras.spec.js` (capturas 50–59 a 360, 390, 430 y escritorio; «pasa por caja» en Chromium y WebKit a 390 y escritorio; vídeo con `ALMACEN_VIDEO=1`); `v199-almacen`, `v1101-habitaciones` y `v1102-probador` siguen en verde.

## 104. La planta de ropa: zonas, cesta y probadores (1.104.0)

Segunda ampliación del almacén (CLAUDE.md, «La Lonja»), bloque 2: «abajo estaría la zona de ropa, y la ropa se vería como en una tienda de ropa», «dividida por zonas», «llevar la ropa que te gusta en un carrito o cesta y probártela en un probador como los de la planta de arriba (que habría que mover)».

- **El plano de la ropa** (`hotel/plantaRopa.js`, sin dibujo): cuatro zonas con su moqueta y su letrero colgado, que es el botón: **Jerséis** (pared izquierda, con brazos de cara, baldas de doblados y una mesa), **Pantalones** (isla de la izquierda, tres burras y una mesa), **Gafas y complementos** (al fondo, en una vitrina con bustos) y **Fiesta y faena** (junto a las escaleras: la ropa del casino y de la estiba en burras, un perchero de sombreros y dos placas). Delante, **el escaparate** con cuatro maniquíes vestidos con conjuntos que se ganan, mirando hacia dentro. Al fondo, **los probadores**: tres cabinas con cortina y el espejo grande.
- **Los probadores bajan** (`PROBADOR` en `almacenLayout.js`, con `z`): los de arriba se quitan del paso de las habitaciones. Se va andando (por la escalera si estás arriba) y todo lo demás es como en la 1.102.
- **Las zonas**: tocar el letrero anda hasta la zona y abre su papel con todas sus prendas, cada una con su muestra y de dónde sale: «De serie: ya es tuya», «Ya es tuya» o cómo se gana (misiones del día, fichas del casino, sellos de la estiba). **Todavía no se vende ninguna prenda**: la ropa propia de la planta, a la venta con tickets, es el bloque 3.
- **La cesta**: «A la cesta» o «Quitar» en cada prenda, hasta 8 (`CESTA_MAX`). Abajo, la barra cambia el Carrito por la **Cesta** (con su número) y delante de ti se ve una cesta de mimbre con lo que llevas doblado dentro (`api.cesta(lista)`); arriba vuelve el carro. Se guarda en el dispositivo (`bookshelf:almacen-cesta`). Desde la cesta o desde una zona, «Al probador».
- **El probador con la cesta**: además de tu ropa, trae lo de la cesta. Lo que aún no es tuyo sale **marcado** (rayado, borde rojo) y te lo puedes poner para verte en el espejo, pero «Listo» dice «Aún no es tuyo» y no lo guarda, con cómo se gana. Lo tuyo se guarda como siempre.
- **Sin migración.** Pruebas: `e2e-community/v1104-planta-ropa.spec.js` (capturas 60–68: la planta desde las escaleras, cada zona, el escaparate, los probadores, el papel de una zona, la cesta delante y el probador con una prenda prestada; la cesta, de la zona al probador, en Chromium y WebKit a 390 y escritorio); `v1102-probador` busca el probador abajo; `v1103-escaleras`, `v1101-habitaciones` y `v199-almacen` siguen en verde.

## 105. La ropa propia de la planta, con tickets (1.105.0)

Segunda ampliación del almacén (CLAUDE.md, «La Lonja»), bloque 3. Decisión de Francisco del 10-11-2026: **ropa nueva propia de la planta, a la venta con tickets**; la de misiones, casino y estiba se ve colgada pero **sigue sin venderse**.

- **La colección** (`ROPA_TIENDA` en `actor.js`, con su precio en tickets; los dibujos en `tiendaTop` y `extra`): cuatro jerséis, **Punto de trenzas** (30), **Cuadros de leñador** (30), **Cárdigan de botones** (26) y **Rombos** (30); tres pantalones, **Pana mostaza** (22), **Blanco roto** (20) y **Verde botella** (20); y tres complementos, **Pañuelo de lunares** (14), **Gorro de pompón** (16) y **Bolso bandolera** (18). Diseños propios, sin marcas. Cuelgan en su zona (la pared de jerséis y la vitrina reparten el sitio según cuántas prendas haya) y en el armario del piso dicen «se compra con tickets en la planta de ropa del almacén».
- **En la zona**: lo de la planta va primero, con su precio en una etiqueta y el fondo dorado; lo que ya es tuyo no lleva precio.
- **Se paga desde la cesta**: «Pagar N tickets» paga de una vez la ropa de la planta que aún no es tuya (lo de misiones, casino y estiba de la cesta no entra). **Sin rebajas**: ni ofertas ni albarán. Todo o nada, con la clave de compra del cliente (un reintento tras un fallo de red no cobra dos veces) y el total que se enseñó. Si no llegan los tickets, el botón lo dice y no deja pagar. Al pagar, «Pagado: …» y ya es tuyo: en el probador sale sin marcar y se guarda. La cesta pide el saldo al abrirse.
- **Migración `20261128120000_almacen_ropa.sql`** (la aplica Francisco, después de `20261127120000_almacen_pulso_habitaciones.sql`): `piso_almacen_ropa()` (precios), `piso_almacen_ropa_comprar(compra, prendas, esperado)` (a `piso_prendas`, en la tabla de compras del almacén), `piso_personaje_valido` y `pisos_personaje_prendas` con la ropa nueva (solo se lleva si se tiene) y `piso_almacen_pulso` con la zona `'ropa'`. **Sin ella**, la ropa nueva se ve y se prueba, pero el pago falla con un aviso y no cobra nada.
- **La visita con un amigo sabe de plantas**: quien está abajo manda la zona `'ropa'` y al otro se le ve en la planta de ropa, no en la nave (pendiente del bloque 1).
- **Pruebas**: `src/features/edificio/__tests__/almacenRopa.rls.test.js` (Postgres real: precios iguales que el cliente, todo o nada, clave repetida, lo que no se vende, saldo, solo llevar lo tuyo y la zona del pulso), `plantaRopa.test.js` (la ropa nueva en su zona y con precio); `e2e-community/v1105-ropa-tickets.spec.js` (capturas 70–76: precios en la zona, la cesta con el pago, pagado, el probador con la ropa nueva, el reintento sin cobrar dos veces y una amiga abajo).

## 106. Las habitaciones, más grandes, con el ala nueva cerrada; los muebles especiales al doble y sin rebajas (1.106.0)

Segunda ampliación del almacén (CLAUDE.md, «La Lonja»), bloque 4. Encargo de Francisco del 10-11-2026: la zona de habitaciones, **más grande**, con más habitaciones **cerradas por ahora** hasta que lleguen muebles. Decisión del mismo día: los muebles de las **habitaciones especiales** (hoy «Capa y Antifaz») cuestan **el doble** (común 40, poco común 80), en el almacén y en la tienda del bajo, y **nunca se rebajan**: ni ofertas del día o de la semana ni descuento del albarán. Durante el bloque pidió además que lo cerrado fuera **algo más bonito y menos industrial que una persiana metálica**, que **no fuera solo un pasillo plano** y que **las habitaciones con muebles estuvieran antes**.

- **La sala llega hasta la pared de delante** (`HAB.y1` 25,2; el pasillo 4 sigue hasta `hf`, y = 23,8). Por orden, desde el paso: las tres habitaciones con muebles (estudio, salita y Capa y Antifaz), **una placita** y, pasado su arco, **el ala nueva**.
- **La placita** (`PLAZA` en `almacenLayout.js`, `buildPlaza` en `almacen3d.js`): baldosa hidráulica de terracota y crema con su orla, dos bancos de madera contra las paredes, cuatro macetas con planta y una lámpara de araña de latón que alumbra el cruce. Al fondo, **el arco de madera** del ala nueva con una tablilla colgada y el letrero «Ala nueva · próximamente».
- **El ala nueva**: cuatro habitaciones cerradas (`cerrada: true`, `hab-pronto-1` a `-4`), dos a cada lado. Cada una con **una cortina de terciopelo corrida** de su color (granate, verde, mostaza y ciruela), pliegues con luz y sombra, fleco dorado, barra de latón bajo una galería de roble y, delante, **un caballete con una pizarra**. Dentro no se ve nada ni se entra.
- **El suelo de la sala, fuera de las habitaciones**: tarima en espiga y, por todo el pasillo 4, una alfombra larga verde con cenefa dorada (ya no el hormigón con flechas de la nave).
- **Muebles de habitación especial** (`HABITACIONES_ESPECIALES` e `isDeHabitacionEspecial` en `economy.js`; hoy el taller `heroes`): `precioDe` da el doble (en la tienda y en el almacén); `mapaOfertas` ignora una oferta suya si llegara; en la ficha, «De habitación especial · nunca se rebaja»; en la caja, «sin rebajas» en su línea y el albarán **solo sobre lo demás** («Lo de las habitaciones especiales no se rebaja: el albarán va sobre lo demás»).
- **Migración `20261129120000_almacen_especiales.sql`** (la aplica Francisco, después de `20261128120000_almacen_ropa.sql`): `piso_de_habitacion_especial(mueble)` (los del taller `heroes` de `piso_talleres()`), `piso_precio_mueble(mueble)` (el de la rareza, el doble si es especial), `piso_comprar` (la tienda) con ese precio, `piso_almacen_ofertas_de` sin los especiales y `piso_almacen_comprar` con los especiales a su precio, sin oferta y fuera del albarán. Solo funciones: no cambia ningún dato. **Sin ella**, el cliente enseña el precio doble y el servidor cobra el de siempre: la compra no cuadra («El total ha cambiado…») y no se cobra nada.
- **Permisos**: `20261130120000_almacen_ropa_permisos.sql` quita a todos el permiso directo sobre `piso_almacen_ropa()` (la lista de precios de la ropa, que la migración del bloque 3 dejaba llamable sin sesión); solo la usan funciones del servidor.
- **Corrección de paso**: los letreros ocultos se quedaban fuera de la pantalla y la capa del almacén se podía desplazar en horizontal si algo la movía (se vio al bajar por la caja); ahora la capa de letreros recorta (`overflow: hidden`). Y las texturas de pared se redondean a píxeles enteros (la sala nueva mide 24,35 de hondo).
- **Pruebas**: `src/features/edificio/__tests__/almacenEspeciales.rls.test.js` (Postgres real: misma lista y precios que el cliente, nunca en ofertas en 60 días, la tienda al doble y la compra con oferta y albarán), `tienda.rls.test.js` compara con `piso_precio_mueble`; el arnés de PGlite crea `piso_retirado` (todo «no») cuando se carga sin la reforma. `e2e-community/v1106-habitaciones-cerradas.spec.js` (capturas 80–86: el pasillo desde el paso, la placita y el arco, el ala nueva, desde el fondo, la ficha especial, la caja sin rebaja y pagado; vídeo con `ALMACEN_VIDEO=1`); `v1101-habitaciones` pasa a 80 tickets el sillón de la capa.

## 107. El casino del sótano en 3D: la sala (1.107.0)

Encargo de Francisco del 10-11-2026 (CLAUDE.md, «El casino en 3D»; plan en `docs/qa/casino-3d.md`), bloque a de cinco: la sala, más grande e impactante, con el motor del almacén y la recepción (three.js a 320 px de ancho, ampliado sin suavizar, luz pintada en las texturas y un dibujo solo cuando algo cambia). Los juegos siguen como estaban: este bloque monta la sala y lleva hasta ellos.

- **El plano** (`hotel/casinoLayout.js`): sala de 16 × 22 × 6,6. Se entra por **un rellano a media altura** y se baja por **una escalera de mármol** de doce peldaños con alfombra y barandillas (`zDe` da la altura del suelo). Al fondo, **la ruleta de premios** en su tarima; a la izquierda, **la mesa de «Las 21 páginas»** (media luna, crupier detrás, tres taburetes) y **la ventanilla de la caja** con su reja y la cajera; a la derecha, **«Las tres chisteras»** y **la vitrina de premios** (tres armarios de cristal); al fondo a la izquierda, **la barra**. Cuatro columnas y tres arañas que no tapan la ruleta. Se anda por una red de pasillos (`NODOS`, `TRAMOS`, `route` con Dijkstra) y se toca el suelo para ir (`dentro`).
- **La escena** (`hotel/casino3d.js`, `mountCasino`): moqueta granate con rombos dorados, zócalo de nogal y papel verde con abanicos, techo de casetones, neones con letra propia de píxel y contorno oscuro («LA RULETA», «21», «LAS TRES CHISTERAS», «CAJA», «VITRINA DE PREMIOS», «BAR»), la rueda de ocho casillas con su aro de nogal y veinte bombillas (preparada para el bloque c), crupier y cajera. Se arrastra para mirar; la cámara inclina según la altura.
- **Los sitios** (`SITIOS`): cada uno con su placa de latón encima (`.cs3-tag`) y, en el «Plano» de la esquina, la lista de los cinco. Tocar uno anda hasta él. **La mesa**: el crupier habla en un bocadillo («¿Repartimos? Hoy tienes tres manos.») y un aviso lleva al panel de juego de siempre, justo debajo. **La caja**: abre la caja. **La ruleta, las chisteras y la vitrina**, marcadas «pronto», dicen qué serán. Quien te espera en la mesa para dos se anuncia al llegar.
- **Sin WebGL**, la escena isométrica de antes. Con movimiento reducido, se llega directo y los avisos no se animan.
- **Sin migración.** No cambia ningún premio, límite ni regla.
- **Pruebas**: `hotel/__tests__/casinoLayout.test.js` (la escalera sin saltos, se llega a cada sitio, los pasillos no rozan las columnas y los nudos se pueden tocar); `e2e-community/v1107-casino3d.spec.js` (capturas 01–07 en `qa-report/casino/` a 360, 390, 430, escritorio y WebKit 390; vídeo con `CASINO_VIDEO=1`); `v180-casino` pasa al bocadillo y los avisos nuevos.

## 108. «Las 21 páginas» en la mesa 3D (1.108.0)

El casino en 3D (CLAUDE.md, «El casino en 3D»; plan en `docs/qa/casino-3d.md`), bloque b. La partida a solas ya no se juega en el tapete HTML de debajo: **se juega sentado a la mesa de la sala**. Reparte y puntúa el servidor como siempre (`piso_casino_repartir`, `piso_casino_jugar`); no cambia ninguna regla, premio ni límite. Sin migración.

- **Sentarse**: tocar la mesa (su placa, el «Plano» o «Sentarse a la mesa» del panel) anda hasta ella y la cámara baja al taburete del medio, mirando el paño y al crupier (`sentarse` en `casino3d.js`; 0,7 s, directo con movimiento reducido). Sentado no se anda ni se gira; «Levantarse» vuelve a la sala. Ir a la caja (por el plano o la pestaña) también levanta.
- **Las cartas en el paño**: cartas-página de 20 × 28 px pintadas en píxeles (papel crema, el signo en la esquina y del revés en la de abajo, el palo de 9 × 9 en el centro y un marco dorado en las figuras; el dorso, granate con rombos dorados). Salen del sabot y se deslizan hasta su sitio, una tras otra; la tapada del crupier se da la vuelta al destaparse. Un filete dorado pintado en el paño marca dónde caen las del crupier y las tuyas. Lo hace `mano({ id, crupier, tapada, tuyas, suyas, fichas, amigo })`.
- **Las fichas de hoy**, apiladas a tu lado en la mesa (una ficha de la pila por cada dos ganadas, hasta 30).
- **Encima de la escena**: «Levantarse» arriba a la izquierda; el marcador (crupier y tú, en placas de latón con cifras de píxel) arriba a la derecha; el bocadillo del crupier sobre su cabeza; el cartel del resultado entre tus cartas y los botones; abajo, «Repartir la mano N de 3», «Pedir carta» y «Plantarse», los botones gruesos de siempre. Al acabar, el resultado y ya: sin «otra más». Para los lectores de pantalla, las cartas de cada uno en listas con su nombre.
- **La mesa para dos**: la mesa abierta en «Con un amigo» se ve en el paño (`onVista` de `MesaParaDos.jsx`): tus cartas, las del crupier y las del amigo, boca abajo hasta que se resuelve, con **el amigo sentado en un taburete en la punta de la media luna con su personaje** (`salaPersonajes`; sin él, el de serie). La cámara se abre en diagonal para verle. Las jugadas de la mesa para dos siguen en su panel, debajo («Jugar la mano» baja a él).
- **El panel de debajo** conserva el marcador de fichas, garbanzos, semana y manos, las pestañas, la caja y «Cómo se juega». Sin WebGL, el tapete HTML de antes, igual que siempre.
- **Pruebas**: `v1107-casino3d` (capturas 02 sentado, 02b reparto, 02c resultado y 02d la mesa para dos, y el vídeo con la mano entera); `v180-casino` se sienta antes de repartir y se levanta antes del plano.

## 109. La ruleta de premios del casino, una vez por semana (1.109.0)

El casino en 3D (CLAUDE.md, «El casino en 3D»; plan en `docs/qa/casino-3d.md`), bloque c. **Migración nueva**:
`supabase/migrations/20261201120000_casino_ruleta.sql` (la aplica Francisco). Sin ella, la ruleta se ve y se puede ir
hasta ella, pero dice «La ruleta aún no gira: falta prepararla en el servidor» y no hay botón de girar.

- **Un giro por semana** (de lunes a domingo, la semana de las fichas), solo a solas: al ir a la ruleta, el panel pasa a
  «A solas». **Decide el servidor** (`piso_casino_ruleta_girar`): sortea la casilla con sus pesos, da el premio en la misma
  transacción y guarda el giro (`piso_casino_ruleta`, uno por cuenta y semana, RLS y sin acceso directo). La app solo enseña lo
  decidido: la rueda gira hasta esa casilla.
- **Las nueve casillas** (`RULETA` en `hotel/ruleta.js`, iguales que `piso_casino_ruleta_casillas`; una prueba lo comprueba):
  20 fichas (28 %), el esmoquin de terciopelo (7 %), 40 fichas (20 %), la lámpara de flecos (6 %), 100 garbanzos (20 %), la
  ruleta de sobremesa (5 %), 80 fichas (9 %), el reloj de pie art déco (3 %) y, la casilla más rara y dorada, **el mapache
  crupier** (2 %, un compañero legendario que te acompaña; ver abajo). Lo que ya tienes y
  vuelve a salir se cambia por 40 fichas (el giro no se pierde). Las fichas de la ruleta no cuentan en el tope de 150 (no son
  manos). Sin tickets ni sobres.
- **Delante de la rueda**: tocar la ruleta (su letrero o el plano) anda hasta ella y la cámara se pone de frente
  (`anteRuleta` en `casino3d.js`). Encima: «Volver a la sala»; abajo, el **cartel de latón con lo que puede tocar y su
  probabilidad**, siempre a la vista mientras se está delante, con «✓» en lo que ya es tuyo, y el botón «Girar la ruleta».
- **La rueda**: cada casilla lleva su premio pintado en píxeles y de cara hacia fuera (la ficha con su cifra, los garbanzos,
  la pajarita del esmoquin, la lámpara, la ruletita, el reloj y la cara del mapache); la que queda bajo la flecha se lee derecha. **El giro es
  honesto**: cinco vueltas y una frenada que solo frena (la velocidad baja sin parar hasta cero, sin pausas ni acelerones), se
  para dentro de su casilla y lejos de la raya, sin cuentas atrás y sin «otra». 5,2 s; con movimiento reducido, directa.
  Al parar: el cartel «¡Te toca!» (o «Ya lo tenías: … 40 fichas») y, abajo, «Es tuyo: ya está en tu inventario. La ruleta
  vuelve a girar el lunes.», dicho una vez. Al volver otra vez esa semana, la rueda está parada donde quedó.
- **Los premios nuevos**: tres muebles de premio (rareza 'especial', `casino` y `ruleta: true` en `catalog.js`, con su fila en
  `piso_catalogo`), hechos con el mismo modelo de cajas que los de la casa (`furniture.js`): la lámpara de flecos (pie de
  latón, pantalla de terciopelo en tres escalones con flecos dorados, encendida), la ruleta de sobremesa (velador de nogal con
  la ruletita encima; sin girar: los efectos siguen apagados por la reforma) y el reloj de pie art déco (caja alta de nogal,
  ventana del péndulo, esfera crema y remate escalonado). Y el **esmoquin de terciopelo** (jersey 22, `ROPA_RULETA`): verde
  botella con solapas de raso, camisa y pajarita dorada; solo se lleva si te ha tocado (lo comprueba el servidor) y en la
  planta de ropa cuelga con «Puede tocar en la ruleta del casino».
- **El mapache crupier** (decisión de Francisco del 10-11-2026: los premios raros, «mucho más apetecibles»; el último, «una
  mascota que pueda ir contigo, como las de antes, pero de casino», y **«modelo 3D de verdad»**): un mapache gris original con su
  antifaz, la cola de anillos, visera verde de crupier, pajarita roja y ligas doradas. Legendario (`compania: true` en
  `catalog.js`, fila 'legendario' en `piso_catalogo`, y en `piso_casino_exclusivos`: nunca sale en sobres), no se compra, no
  se recicla, no se regala ni va a la Lonja; se elige en el armario de tu piso como el conejo y la gaviota, y el servidor
  comprueba que lo tienes. **En 3D**: es el primer compañero con modelo de volúmenes de verdad, hecho con cajas como el personaje
  y el crupier (`mapache3d.js`: solo datos y pose; cada motor lo pinta con su luz). **En el casino te sigue**
  (`casino3d.js`, `setCompanero`; Casino.jsx lee tu compañero con `salaPersonajes`): mientras andas, a tu lado y un poco por
  detrás, sin cruzarse delante de la vista; al pararte, se adelanta al trote hasta un hueco libre que se vea bien en pantalla
  (sin meterse en mesas, columnas, caja, vitrina ni tarima), se vuelve hacia ti y hace malabares con tres fichas (y guiña);
  desde el rellano te espera escalera abajo; pegado a una mesa sin hueco a la vista, se queda a tu lado, fuera de cuadro.
  Con movimiento reducido, quieto, con una ficha en la mano y sin malabares. **En el piso en primera persona** (`interior3d.js`,
  `setCompanero`; `PisoLabPanel.jsx` lee el compañero de quien vive en el piso, así que **quien te visita también lo ve**): como
  ahí se está sentado en el sillón, se queda contigo en el suelo, delante y mirándote, en el primer hueco libre que se vea
  entero desde el sillón (con la cámara de verdad y sin que un mueble se interponga; si la mesa baja tapa el suelo de delante,
  de medio cuerpo arriba), con la piel y la luz de la hora de los muebles; malabares a unos 12 fotogramas por segundo, solo si
  está a la vista y nada tapa el piso. En el armario y en el piso isométrico sigue saliendo su dibujo de píxeles
  (`misticos.js`), como los demás compañeros.
- **Pruebas**: `casino-ruleta.rls.test.js` (PGlite: casillas y pesos iguales a la app, un giro por semana, cada casilla da lo
  suyo con el sorteo forzado, lo repetido da fichas, fuera del tope, el esmoquin, el mapache como compañero y fuera de los
  sobres, sin sesión y sin acceso a lo interno), `mapache3d.test.js` (cajas, tamaño, malabares por fuera de la cara y la pose
  con movimiento reducido), `v1109-mapache` (capturas 13 en el rellano y 14 en la sala del casino, 15 en tu piso y 16 de visita; vídeos siguiéndote
  por el casino y en tu piso con malabares; con movimiento reducido, quieto),
  `hotel/__tests__/ruleta.test.js` (se para en su casilla y lejos de la raya, la frenada solo frena, la semana empieza el
  lunes), `v1109-ruleta` (capturas 09 delante de la rueda, 10 lo que tocó, 11 repetido, 12 el esmoquin en el probador; vídeo
  con la rueda girando de verdad) y `v1107-casino3d` (sin la migración, lo dice y no gira).

## 110. «Las tres chisteras», el tercer juego del casino (1.110.0)

El casino en 3D (CLAUDE.md, «El casino en 3D»; plan en `docs/qa/casino-3d.md`), bloque d; Francisco eligió el juego («Sí,
las chisteras», 10-11-2026). **Migración nueva**: `supabase/migrations/20261202120000_casino_chisteras.sql` (la aplica
Francisco). Sin ella, la mesa se ve y se puede ir hasta ella, pero dice «Las chisteras aún no se juegan: falta prepararlas en
el servidor».

- **El juego** (de habilidad, a solas, una partida al día): el conejo blanco salta de su sitio, al otro lado de la mesa, a
  debajo de una chistera levantada; la chistera baja y las tres se cruzan, una por delante y otra por detrás, sin chocar con
  la del medio. Tres rondas con 3, 5 y 7 cambios, cada una más deprisa (640, 470 y 340 ms por cambio). Al acabar los cambios
  se elige **tocando la chistera** o con los botones «Izquierda», «En medio» y «Derecha». Mientras se mueven no se puede
  elegir ni salir.
- **Honesto**: si aciertas, se levanta la chistera y el conejo da un salto; si no, se levanta la elegida, vacía, y después la
  de verdad, y se dice «Esta vez, no. Estaba en la del medio.», sin rodeos ni falsos «casi». Sin cuentas atrás y sin «otra».
- **Baraja y comprueba el servidor** (`piso_casino_chisteras_ver` y `piso_casino_chisteras_elegir`): cada vez que se mira una
  ronda la vuelve a sortear (dónde empieza el conejo y los cambios), así que salir y volver no ayuda: la ronda a medio mirar se
  baraja de nuevo; la elección se comprueba con lo último que se enseñó y vale una vez por ronda. Lo que está por elegir no se
  puede leer de otro modo (tabla `piso_casino_chisteras`, RLS y sin acceso directo).
- **Premios**: según cuántas rondas aciertas, 1, 3, 6 o 10 fichas (`CHISTERAS_JUEGO` en `hotel/chisteras.js`, iguales que
  `piso_casino_chisteras_reglas`), **dentro** del tope de 150 a la semana: `piso_casino_semana` suma ahora las manos del 21 y
  las chisteras (la ruleta sigue fuera). Nunca se pierde nada. Sin tickets ni sobres. Las **partidas perfectas** (tres de
  tres) se cuentan y se dicen («Partidas perfectas: 1»): son para los premios de la vitrina del bloque e.
- **Delante de la mesa** (`anteChisteras` en `casino3d.js`): la cámara, de pie y un poco por encima, con las tres chisteras,
  el conejo y la lámpara a la vista. Arriba, «Volver a la sala» y el marcador («Ronda 2 de 3» y tres fichas: dorada si
  acertaste, apagada si no); antes de empezar, las reglas en una línea; abajo, «Empezar» o «Ronda n de 3», el cartel de cada
  ronda y, al acabar, «2 de 3 +6» y «Hoy: 2 de 3, +6 fichas. Mañana, más chisteras.». Al volver a la sala la mesa se recoge.
  Las chisteras y el conejo son piezas aparte (`kitChistera`, `kitConejo`) que se mueven con una lista de pasos.
- **Movimiento reducido**: sin saltos ni botes; el conejo aparece bajo la chistera y cada cambio va despacio (1,1 s) y uno a
  uno, con pausa entre ellos. Para quien no ve la mesa, cada cambio se dice («Cambian la de la izquierda y la del medio.») y
  después dónde estaba el conejo.
- **Pruebas**: `casino-chisteras.rls.test.js` (PGlite: reglas y cuenta del conejo iguales a la app; antes de mirar no se sabe
  nada y cada vez que se mira se baraja de nuevo; una elección por ronda y más cambios cada ronda; perfecta y sin aciertos;
  dentro del tope de la semana; chistera fuera de la mesa, otro día, sin comunidad y sin sesión), `v1110-chisteras`
  (capturas 17 delante de la mesa, 18 eligiendo, 19 acierto, 20 fallo, 21 la partida acabada; con movimiento reducido, los
  cambios dichos; hoy ya jugadas; vídeo de una partida entera) y `v1107-casino3d` (sin la migración, lo dice y no se juega).

## 111. La vitrina de premios del casino (1.111.0)

El casino en 3D (CLAUDE.md, «El casino en 3D»; plan en `docs/qa/casino-3d.md`, bloque e y §4), primera parte; Francisco: «Sí,
la vitrina». **Migración nueva**: `supabase/migrations/20261203120000_casino_vitrina.sql` (la aplica Francisco, después de la
de las chisteras). Sin ella, la vitrina se ve con todo tapado y dice «La vitrina aún no está lista: falta prepararla en el
servidor».

- **Qué enseña** (`ARMARIOS` en `hotel/vitrina.js`): los tres armarios de cristal de la pared derecha, con tres baldas cada uno.
  El de **la caja** (sus nueve premios: neón «21», mesa de tapete, gramola, chaleco, fedora, vestido de lentejuelas, visera,
  pantalón de raya y el conejo de la chistera); el de **la ruleta y la lata** (el esmoquin, el reloj de pie, el mapache, la
  lámpara de flecos, la ruleta de sobremesa, el tarro, la baraja y el taburete, y las **pilas** de tus fichas y tus garbanzos,
  que crecen con lo que tienes); y el de **las copas**: doce hitos, cuatro por juego (`HITOS`), en bronce, plata, oro y oro con
  gema: copas para «Las 21 páginas», medallas con la rueda para la ruleta y chisteras de oro para las chisteras. Los hitos
  son **solo de adorno**: no dan nada.
- **Lo ganado, expuesto; lo que falta, tapado**: cada premio que tienes está en su balda en 3D, más encendido (los muebles con
  su modelo de `furniture.js`, la ropa puesta en una figurita, el conejo sentado en su chistera, el mapache con su ficha); lo
  que no, bajo un **paño de terciopelo** granate con flecos dorados y su plaquita, del tamaño de lo que tapa. Arriba, la
  cuenta: «Tu vitrina · 17 de 29» (sin contar las pilas).
- **Delante de la vitrina** (`anteVitrina` y `armario` en `casino3d.js`): la cámara, de pie frente a un armario; las
  pestañas «La caja», «Ruleta y lata» y «Las copas» la deslizan de uno a otro. **Tocar un premio** lo adelanta, lo agranda y lo
  hace girar despacio en su balda (con movimiento reducido, sin girar), y abajo sale su ficha: el nombre y «Es tuyo: expuesto
  aquí y en tu inventario», «Logrado: solo de adorno» o «Aún no.» con **cómo se gana** (precio en la caja o la lata, la
  probabilidad en la ruleta o lo que pide el hito). Para lectores de pantalla, una lista de los premios del armario.
- **Lo ganado se usa y además se expone** (decisión de Francisco del 10-11-2026, «Las dos cosas»): la vitrina mira tu
  inventario y tu armario; no guarda nada aparte.
- **La de un amigo** (os seguís los dos): «Ver la de …» (hasta tres de tus amigos del casino) enseña su vitrina, solo para
  mirar («La vitrina de Bea lectora · 4 de 29», «Lo tiene Bea lectora.»); «Volver a la mía».
- **El servidor** (`piso_casino_vitrina(otro)`): lo que tienes de los premios del casino (la lista sale de los precios de la
  caja y la lata y de las casillas de la ruleta, `piso_casino_vitrina_premios`), tus fichas y garbanzos, y los hitos logrados,
  calculados con lo que ya guarda (manos, giros, partidas); sin tabla nueva. La de otro, solo si `piso_casino_amigo`.
- **Queda para la 1.112**: los seis premios nuevos del catálogo aprobado (§4 del plan): el reloj de bolsillo dorado y la
  alfombra de rombos de la caja, y la chistera de mago, el baúl de mago, el acabado «Polvo de estrellas» y la varita, que se
  ganan con las partidas perfectas de las chisteras. Necesitan modelo, ropa, precio y una migración.
- **Pruebas**: `casino-vitrina.rls.test.js` (PGlite: premios e hitos iguales a la app; al empezar, nada; lo que tienes y solo lo
  del casino; cada hito en su número; la de un amigo sí y la de quien no os seguís, no) y `v1111-vitrina` (capturas 22 el
  armario de la caja, 23 un premio tapado, 24 la ruleta y la lata, 25 las copas, 26 la de un amigo; sin la migración, todo
  tapado; vídeo).

## 112. Los premios nuevos de la vitrina (1.112.0)

El casino en 3D, bloque e, segunda parte (plan en `docs/qa/casino-3d.md` §4, aprobado por Francisco el 10-11-2026 con «3-4 más»);
Francisco: «Sí, la 1.112». **Migración nueva**: `supabase/migrations/20261204120000_casino_premios_nuevos.sql` (la aplica
Francisco, después de la de la vitrina). Sin ella, los premios nuevos se ven tapados en la vitrina, la caja no los ofrece y en las
chisteras no sale el botón de los sellos.

- **De la caja, con fichas**: el **reloj de bolsillo dorado** (complemento, 180 fichas: dorado en el bolsillo del pecho, con su
  cadena; luce sobre el chaleco de crupier) y la **alfombra de rombos dorados** (mueble de suelo 3 × 2, 350 fichas: granate, ribete
  y tres rombos dorados, con flecos). Rareza «especial», como los demás premios: no se compran en la tienda, no salen en sobres y no
  se regalan ni se reciclan.
- **De las chisteras, con sellos** (`PREMIOS_CHISTERAS` en `hotel/chisteras.js`): **cada partida perfecta (tres de tres) es un
  sello**. Se cambian delante de la mesa de las chisteras («Premios · N sellos»), cada premio una vez: la **chistera de mago**
  (2 sellos; añil, con cinta morada y estrellas que se encienden de tarde), la **varita de mago** (4; de ébano con punta de marfil,
  en alto en la mano derecha), el **baúl de mago** (6; mueble de suelo 2 × 1, añil con flejes de latón y una luna pintada, se le
  pueden poner cosas encima) y el acabado **«Polvo de estrellas»** (10; añil y dorado, se pone en una copia lisa tuya que eliges, como
  los acabados de la pared de la Lonja). **Nunca con dinero ni tickets.** Los sellos los cuenta el servidor (partidas perfectas
  menos lo ya cambiado). Cifras aprobadas por Francisco el 11-11-2026.
- **«Polvo de estrellas» no sale en los sobres** (el sorteo de acabados no cambia) ni se canjea en la Lonja; la copia lo conserva
  al venderla o regalarla, como los demás. En la app, `ACABADO_CHISTERAS` en `acabados.js` (fuera de `ACABADOS`, la lista del
  sorteo).
- **La vitrina** pasa de 29 a 35 premios: en el armario de la caja, el reloj y la alfombra (enrollada a medias, con su rombo a la
  vista); el tercer armario se llama **«Chisteras y copas»**: abajo los cuatro premios de las chisteras (la chistera en su figurita,
  la varita y el reloj en un cojín de terciopelo, el baúl y un frasco de polvo de estrellas), y encima las copas (las de las
  chisteras y la ruleta en una balda y las del 21 en otra).
- **Ropa**: las tres prendas nuevas son complementos (se lleva uno a la vez); el armario dice de dónde salen («se cambia por sellos
  de las chisteras del casino») y la planta de ropa las enseña colgadas, sin venderlas.
- **Pruebas**: `casino-premios.rls.test.js` (PGlite: caja, premios, ropa, catálogo y vitrina iguales a la app; sin perfectas no hay
  sellos y la de dos aciertos no cuenta; cada premio una vez, gasta sus sellos y solo se lleva lo que se tiene; el acabado solo en
  una copia lisa de un mueble que lo admita; sellos de cada uno, nada por tickets) y `v1112-premios` (capturas 27 los sellos, 28 la
  varita cambiada, 29 el acabado puesto, 30 la caja con el reloj y la alfombra, 31 el armario de las chisteras, 32 a 34 la ropa
  nueva en el probador; vídeo). Galería del piso 3D: `muebles-galeria.spec.js` con `MUEBLE=alfombra-rombos` y `baul-mago`.

## 113. El portal del edificio en 3D: la calle desde el muelle (1.113.0)

«Exteriores en 3D», bloque 1 (Francisco, 11-11-2026: «descuadra demasiado cuando sales a ellos y entras en los entornos 3D,
como podríamos hacer para darles más peso, y, forma»; eligió «Exteriores en 3D» y, con las capturas, «Sí, móntalo»). El portal del
edificio deja de ser la fachada isométrica y pasa a ser **la calle en 3D**, con el mismo motor que el piso y la recepción.

- **El mismo edificio, sin dibujarlo dos veces**: las cajas de la fachada salen a `drawFacadeBody(r, flats)` (`facade.js`). El 2D
  las pinta como siempre (el dibujo sale idéntico: misma huella) y `calle3d.js` las **graba** con un rasterizador de mentira y
  pinta cada cara visible en un atlas, con las mismas rampas, tramado y detalles, lo que se ve por las ventanas de cada piso
  (`windowPictures`), las letras del cartel a doble tamaño (`signGlyphs`) y la luz de la tarde con lo que alumbran ventanas y
  faroles. Todo en una malla (unas 1.760 caras, atlas de 2048 × 587). Lo pintado se guarda y se reutiliza si el portal se vuelve a
  montar con los mismos pisos.
- **La vista**: de pie en el muelle, a 8,6 del portal, ojos a 1,6, mirando un poco hacia arriba para que el cartel entre por
  arriba. Arrastrar gira ±0,5 rad a los lados y baja la vista hasta 0,3 rad; también las flechas. En apaisado, campo vertical de 74°.
  Al llegar, la vista sube desde el muelle hasta el cartel.
- **Solo en 3D**: el cartel va 0,8 más alto (desde abajo lo tapaba el antepecho), dos vecinos más a los lados, farolas en el
  bordillo, adoquines más menudos, charcos y hojas de otoño.
- **Los toques** (`calleView.js`, mismas opciones y nombres que `mountFacade`): un botón por piso con su placa, la tienda, el buzón
  con su nota y la limusina, colocados sobre la vista y movidos con ella. Arrastrar encima de ellos también gira (y no cuenta como
  toque). Al tocar un piso o la tienda, la vista se acerca y entras; al volver, se aleja desde allí y con el giro que tenías. Lo que
  queda fuera de la vista no se ve ni se toca, pero sigue para el teclado y los lectores de pantalla: al llegar a ello, la vista
  gira hasta ello. Sin WebGL (o si se pierde), la fachada 2D de siempre.
- **Lo que se queda fuera, de momento**: el paseo de tu personaje hasta la tienda o la limusina (1.78), las gaviotas y los
  destellos del agua del 2D. El paseo vuelve con el bloque 2 (salir del piso a la calle sin corte).
- **Pruebas**: `e2e-community/calle3d.spec.js` (la calle en la página de desarrollo `dev/calle3d.html` y el portal de la app: girar
  sobre un botón sin entrar, entrar en tu piso y volver, el buzón, la limusina fuera de la vista y el teclado; capturas y vídeos en
  `qa-report/calle3d/`). `v1881-fachada` cuenta solo las placas a la vista. Las tres del paseo de `v178-paseo` se saltan.

## 114. Salir a pie: del piso a la calle sin corte (1.114.0)

«Exteriores en 3D», bloque 2 (Francisco, 11-11-2026: «Sí, bloque 2»). Salir de tu piso, ir a la limusina o a la tienda deja de
ser un corte: la cámara anda.

- **En tu piso** (`PisoLabPanel.jsx`, `interior3d.js`): «Al edificio» y tocar la puerta llevan la cámara andando hasta la
  puerta, mirándola (`walkToDoor`, ~0,95 s), y después se abre el edificio. Solo en tu habitación de inicio; con movimiento
  reducido, directo.
- **En la calle** (`calle3d.js`): la cámara ya no está clavada en el muelle. Hay sitios por donde se anda (`SPOTS`: la vista de
  siempre, el umbral del portal, unos pasos fuera, delante de la limusina y delante del escaparate) y `walk(keys)` recorre
  posiciones y giros con un arranque y una parada suaves; cada tramo dura lo que mide. Las caras se pintan si se ven desde
  cualquiera de esos sitios. Más allá del muelle, el agua del puerto (una lámina que se repite) hasta el horizonte.
- **La llegada desde el piso** (`salida.js`, `calleView.js`): el piso marca que sales por la puerta y el portal empieza en el
  umbral, mirando al muelle; das unos pasos, te vuelves y acabas en la vista de siempre (3,4 s; a la limusina o a la tienda, 1,7 s). Si el portal se vuelve a montar a
  medio camino (llega el correo), sigue desde donde iba. Desde el salón se llega como antes, por el muelle.
- **A la limusina y a la tienda, andando** (sustituye al paseo 2D de la 1.78): tocar la limusina te lleva delante de ella antes de
  ir al Gran Hotel; tocar la tienda, delante del escaparate (por encima de la limusina aparcada) y después te asomas. Mientras se
  anda, placas, buzón y botones se esconden y no se pulsan; arrastrar y las flechas no giran.
- **Corregido**: en el móvil, el portal 3D llega hasta abajo (antes ocupaba el 94 % del alto y dejaba ver lo de debajo).
- **Pruebas**: `calle3d.spec.js` suma «salir a pie: de tu piso a la calle» (la app: de tu habitación al umbral, la vuelta y la
  tienda) y «después: salir del portal a pie» (la página de desarrollo, a cámara lenta, con la limusina y la tienda). Capturas en
  `qa-report/calle3d/3-salida-*.png` y `4-app-*.png`.

## 115. El Gran Hotel en 3D, desde la plaza (1.115.0)

«Exteriores en 3D», bloque 3 (Francisco, 11-11-2026: «Sí, bloque 3»; al ver las primeras capturas, «Me gustaría que se viese
más espectacular y que la gente no parezcan palos»; aprobado para la app con «Sí, móntalo»). La fachada del Gran Hotel deja de
ser un dibujo plano: es la plaza del muelle en 3D, de noche, a la altura de una persona.

- **El motor compartido** (`exterior3d.js`): lo que tenían la calle del edificio y ahora el hotel (grabar las cajas del dibujo
  2D, pintar cada cara que se ve, una sola malla, la cámara que mira y anda entre sitios fijos). La calle sale idéntica (misma
  huella de capturas). Suma dos opciones: `bloom` (el resplandor de lo que brilla, a la misma resolución baja que todo) y
  `tick` (animar a unos 30 fotogramas por segundo; con movimiento reducido no se anima). `setView` corta un giro en marcha.
- **La plaza** (`hotel/hotel3d.js`): la torre sale de las mismas cajas que el 2D (`drawHotelBody` en `hotelArt.js`; el 2D
  sigue idéntico, misma huella SHA-256 de `renderHotel`), con la plaza más honda, el rótulo «GRAN HOTEL / DEL PUERTO» en neón
  con la letra del 2D, la luna, la ciudad al fondo y la luz de cada ventana sobre la fachada. **Gente con cuerpo**
  (`person3d`): zapatos, piernas o falda, abrigo con mangas y manos, bolso, pelo, sombrero; el botones con su uniforme y su
  gorra. **Más espectáculo**: resplandor en ventanas, neón, farolas y aguja; los dos focos de la corona barren el cielo; una
  baliza roja late en lo alto de la aguja; la plaza está mojada, con estelas de las luces y charcos (pintadas en el suelo).
- **En la app** (`hotel/hotelView3d.js`, `GranHotel.jsx`): la misma cartela, el mismo Directorio y las mismas plantas, con la
  misma forma que la fachada 2D (`mountHotel`). Las plantas se tocan en la torre: gana la primera caja de `ZONE_BOXES`
  (`hotelArt.js`, compartidas con el 2D) que contiene el punto; la elegida se rodea con un filete de latón y un rombo que
  siguen a la vista. Arrastrar o las flechas miran alrededor (y arriba, hasta la corona); elegir una planta que no se ve, o
  enfocar su botón con el teclado, gira la vista hasta ella. El panel tiene alto fijo, como el portal en 3D.
- **La llegada**: ya no hay viaje 2D por la calle; bajas de la limusina junto a la marquesina, mirando la torre de abajo arriba,
  y andas hasta la plaza (3,2 s). **Entrar** en una planta abierta (vestíbulo, café-biblioteca, almacén, casino) es andar
  hasta la puerta rodeando la limusina por detrás (2,4 s). Al salir de una sala se vuelve a la plaza mirando hacia donde
  mirabas, sin repetir la llegada. Con movimiento reducido: sin llegada ni paseo, y la vista quieta.
- **Sin WebGL** (o si se pierde): la fachada 2D y el viaje en limusina de siempre (`hotelView.js`, `ride.js`).
- **Pruebas**: nueva `e2e-community/v1115-hotel3d.spec.js` (llegada, tocar plantas, arrastrar, Directorio, teclado, entrar
  andando y volver; con movimiento reducido; vídeo) a 390 en Chromium y WebKit y en escritorio; `hotel3d.spec.js` (la página de
  desarrollo `dev/hotel3d.html`, con capturas y vídeo). `v174-limusina` y `v177-hotel-directorio` se adaptan al 3D (sin viaje;
  el latón es el filete SVG). Capturas y vídeos en `qa-report/hotel3d/` y `qa-report/hotel3d-app/`.

## 116. La sala de lectura en 3D: a solas, tu sillón con tu libro (1.116.0)

Encargo de Francisco del 11-11-2026 («darle un sentido y utilidad real… para tener un motivo para ir hasta allí solo o
acompañado, y hacer su recreación en 3D»; plan en `docs/qa/sala-lectura-3d.md`). Bloque a de tres: la sala en 3D y lo que
se hace en ella a solas. Sus respuestas: «el sillón y el libro» a solas; la cita de lectura con un amigo, el sofá y los
gestos quedan para los bloques b (1.117) y c (1.118).

- **La sala** (`hotel/sala3d.js`, plano en `hotel/salaLayout.js`): una biblioteca de doble altura, de noche, con el motor y
  el lenguaje de píxel del casino (texturas pintadas una vez con la luz ya puesta, 320 px de ancho, render a demanda). El
  ventanal al puerto con su faro y lluvia, la galería alta con barandilla y escalera de caracol, la chimenea con fuego y el
  sofá para dos delante, el reloj de pie, la mesa larga con lámparas verdes, el techo artesonado con la araña, el gato dormido
  en la galería y la librería común junto a la entrada. Se anda por pasillos (tocar el suelo o un letrero; «Plano» lleva a
  cada sitio). Con movimiento reducido no se anima nada (fuego, lluvia, péndulo) y no hay paseos.
- **Profundidad y espectáculo** (Francisco, al ver las primeras capturas: «que se vea con más profundidad la biblioteca»):
  las librerías de pared tienen relieve (cantos de balda, pilastras, zócalo y cornisa salen de la pared); lo lejano se pierde
  en una penumbra azulada (niebla); lo que brilla tiene resplandor (lámparas, araña, fuego, esfera del reloj), a la misma
  resolución baja que todo; y de los tres ventanucos altos bajan **haces de luna** hasta el suelo, con su mancha de luz y
  motas de polvo que flotan (quietas con movimiento reducido). Corregido: el suelo estaba pintado al revés en lo hondo (la
  alfombra azul del ventanal salía en la entrada).
- **Una gran biblioteca mágica, más acogedora** (Francisco, al ver la segunda entrega: «luces más cozy», «la parte de arriba
  con más sensación de magnificencia, como si entrases a una gran biblioteca mágica», las tiras de la librería «deslumbran» y
  «lo de las lecturas ocupa la mitad de la pantalla»): la sala es de **triple altura** (10,6) con una **segunda galería** por las
  cuatro paredes y sus farolillos; el techo es una **bóveda celeste** pintada en los artesones dorados, con estrellas y un rosetón
  de oro; una **araña grande** de dos coronas caladas de velas con lágrimas de cristal; **un corro de libros abiertos que vuela
  despacio** bajo la bóveda y **chispas doradas** que suben (quietos con movimiento reducido). La luz es ámbar cerca de las
  lámparas y, de lejos, un malva cálido; el resplandor y la niebla, más suaves y cálidos; las tiras de la librería común, tenues.
  La cámara mira un poco hacia arriba. **La sala ocupa casi toda la pantalla** (80 % del alto) y, sentado, la sesión es una
  franja baja (reloj a la izquierda, Pausar y Levantarte a la derecha) en vez de media pantalla.
- **Más detalle en los muebles y letreros discretos** (Francisco: «algo más de detalle a los muebles» y «que los rótulos sean
  más discretos»): sillones con capitoné en rombo, cojín de cabeza, brazos enrollados, tachuelas doradas y patas torneadas con
  rueda de latón; lámparas de pantalla plisada con pie escalonado; mesitas de trípode con galería de latón; la mesa larga con
  taraceas, cajones, patas torneadas y travesaños, tintero con pluma, una pila de libros y un globo terráqueo; sillas de respaldo
  de barrotes con remates; el sofá con capitoné, tachuelas y borlas; el reloj con frontón partido, columnillas y remates; y un
  globo de pie junto al ventanal. Los letreros son plaquitas oscuras y translúcidas con letra dorada pequeña.
- **La sesión, más pequeña, y su duración la eliges tú** (Francisco: «que el apartado de sesión de lectura sea más pequeño» y
  «que puedas elegir tú el tiempo de sesión»): en 3D, la sesión del panel de debajo es la misma franja baja que sentado (reloj y
  libro a la izquierda, el botón a la derecha). Antes de empezar, una fila discreta elige la duración: 15, 25, 45 o 60 minutos,
  o de 5 en 5 con − y + (de 5 a 120). Es el mismo ajuste que el Pomodoro de la app (`settings.focusMinutes`), así que vale en
  todas partes y se recuerda.
- **Tu sillón** (seis, cada uno con su lámpara de pie y su mesita): te sientas en el que elijas y la sala lo recuerda en el
  dispositivo (`bookshelf:sala-sillon:<cuenta>`); si está ocupado, se te ofrece uno libre. **Tu libro** está en la mesita, con
  su portada (o una tela del color de su lomo) y, sentado, lo tienes abierto en las manos. Sentado, el reloj, Pausar y
  Levantarte van en una tarjeta de nogal al pie de la escena. Al volver con la sesión en marcha, la sala te sienta en tu sillón.
- **Quien lee** se ve en su sillón con su personaje, su libro y su compañero (el mapache crupier en 3D; los demás
  legendarios, como figura de píxel). El saludo cerrado de siempre sale en un bocadillo sobre quien saluda y, si estás
  sentado, también en tu tarjeta.
- **El reloj de pie es el reloj del Pomodoro**: la esfera enseña lo que queda de la sesión y el péndulo va mientras corre;
  tocarlo dice cuánto queda.
- **La librería común** tiene sus lomos de verdad en las baldas (el mismo color y alto que en el panel, `lomoDe`), forrada de
  terciopelo verde y alumbrada bajo cada balda; se llena desde el centro. Tocar un lomo lo saca un poco y dice de quién es; el
  tuyo se puede retirar desde ahí.
- **El sofá para dos** se ve con su letrero «pronto»: es la cita de lectura del bloque b.
- **Sin WebGL** (o si se pierde), la sala isométrica de siempre. El panel de debajo (quién lee, saludar, la librería) no
  cambia; en 3D, «Sentarte a leer» pasa a «Ir a tu sillón» o «Ir a un sillón libre».
- Sin migraciones, sin tickets ni recompensas nuevas.
- **Pruebas**: `salaLayout.test.js` (rutas, reparto de sillones, lomos); nueva `e2e-community/v1116-sala3d.spec.js`
  (entrada, sentarse, tu libro, la librería y sus lomos, el reloj, el sofá, andar tocando el suelo; volver con la sesión en
  marcha; sin WebGL; vídeo) a 360, 390, 430 y escritorio en Chromium y a 390 en WebKit; `v183-sala-lectura` sigue probando la
  sala de siempre, sin WebGL. Capturas y vídeos en `qa-report/sala3d/`.

## 117. La cita de lectura: el sofá para dos (1.117.0)

Bloque b del plan de la sala de lectura (`docs/qa/sala-lectura-3d.md`). Francisco: «cita de lectura con un amigo, haz lo que
veas mejor» y, tras revisar el bloque a, «Sí, al bloque b». Un motivo para ir acompañado: quedar con un amigo a leer a la vez.

- **Invitar** (panel «Leer con un amigo», debajo de la sesión): a un amigo (seguimiento mutuo, sin bloqueo, como la mesa
  para dos del casino), «Ahora», «En 15 min» o «En 30 min», y 15, 25 o 45 minutos. Con un solo amigo, ya va elegido. Una cita
  abierta a la vez: invitar de nuevo cierra la anterior.
- **Lo que llega**: la invitación avisa estés donde estés del edificio, menos dentro de la sala (como la mesa del casino y la
  visita del almacén): «X te invita a leer juntos en la sala de lectura ahora (25 min)» con «Ir a la sala». En la sala, en
  su panel, «Aceptar» o «Ahora no». Caduca a los 10 min sin respuesta; decir que no y no contestar se ven igual para quien
  invitó: «X no ha podido venir». Sin texto libre en ningún punto.
- **El sofá para dos** deja de ser «pronto» (su letrero dice «con X» cuando hay cita). Con la cita aceptada, «Ir al sofá»
  (o tocarlo) te sienta en tu plaza (la 6 quien invitó, la 7 quien vino). La vista va por detrás del sofá: os veis los dos
  sentados junto a la chimenea; tu amigo aparece a tu lado cuando está en el sofá (y deja libre su sillón).
- **Un reloj para los dos**: lo pone el servidor. Si la cita es para más tarde, en el sofá ves la cuenta atrás; al llegar la
  hora empieza la sesión con lo que queda de la cita (`timer.startFor`) y acaba a la vez para los dos aunque uno llegue
  tarde. Una cita «ahora» aceptada tarde empieza al aceptarla.
- **«Habéis leído juntos»**: mientras estás en el sofá con la app a la vista, un latido cada 30 s (uno por minuto cuenta);
  los minutos juntos son los minutos en que latisteis los dos. Se dice así en el panel («cuentan mientras estáis los dos en el
  sofá con la app a la vista»): con el móvil bloqueado no cuenta. Al acabar (o al «Dejar la cita» ya empezada) la sala dice
  «Habéis leído juntos N minutos, X y tú», también encima del formulario de páginas.
- **Migración** `20261206120000_sala_citas.sql`: `sala_citas` y `sala_latidos` con RLS cerrada (sin permisos directos) y
  funciones `security definer` `volatile` (ninguna `stable`, ninguna llama a `piso_yo()`): `sala_citas()`,
  `sala_cita_invitar(amigo, en_min, minutos)`, `sala_cita_responder(cita, acepta)`, `sala_cita_latido(cita)` y
  `sala_cita_dejar(cita)`; la comprobación de amigo es `piso_casino_amigo`. Sin la migración aplicada, la sala sigue como en
  la 1.116 (sofá «pronto», sin panel ni aviso).
- Sin tickets, sin recompensas, sin rachas.
- **Código**: `hotel/useCitaSala.js` (lo que dice el servidor, consulta cada 15 s y al volver a la app), `hotel/CitaSala.jsx`
  (el panel), `SalaLectura.jsx` (el sofá, el reloj común, el latido, quién va en cada sillón), `salaLayout.js` (`PLAZAS_SOFA`,
  `plazaDe`), `sala3d.js` (sentarse en el sofá y su vista), `EdificioPanel.jsx` (el aviso) y `service.js` (`salaCitas`,
  `salaCitaInvitar`, `salaCitaResponder`, `salaCitaLatido`, `salaCitaDejar`).
- **Pruebas**: `sala-citas.rls.test.js` (PGlite con todas las migraciones: solo amigos, opciones cerradas, nadie de fuera ve
  ni toca, una cita a la vez, caducidad, rechazar = no venir, reloj del servidor, latido único por minuto y solo dentro del
  reloj, «juntos», dejarla, bloqueo); `rpc-solo-lectura` sigue en verde. e2e nueva `v1117-sala-cita.spec.js` con Supabase
  simulado (invitar, «no ha podido venir», aceptar, esperar en el sofá, el reloj de los dos, tu amiga a tu lado, «habéis
  leído juntos»; el aviso del edificio; sin la migración) a 360, 390 y escritorio en Chromium y a 390 en WebKit, con vídeo.
  Capturas y vídeos en `qa-report/sala-cita/`. Nada probado entre dos cuentas reales ni en móviles reales.

## 118. La placa del sofá y los gestos cerrados (1.118.0)

Bloque c del plan de la sala de lectura (`docs/qa/sala-lectura-3d.md`). Francisco: «la placa del sofá sin rachas» y «una
selección de gestos para poder comunicarte con la otra persona»; tras publicar el bloque b, «Sí, al bloque c».

- **La placa del sofá, una por pareja de amigos**: los minutos que habéis leído juntos en el sofá (los mismos de «habéis
  leído juntos», sumados de todas vuestras citas) y los libros que habéis terminado leyendo juntos. **Sin rachas, sin cuentas
  atrás, sin nada que se pierda**: las horas solo suben y los hitos (1, 5, 10, 25, 50 y 100 h) solo cambian el metal: latón,
  plata desde 10 h y oro desde 50 h. Solo la ven los dos (con un bloqueo desaparece para ambos). Es un adorno de la sala: no
  da tickets ni recompensas.
- **Dónde se ve**: en «Leer con un amigo», «Vuestras placas del sofá» (una línea por amigo, de más a menos horas: «Bea
  lectora y tú · 1 h 10 min juntos», «Placa de latón · 1 hora · un libro terminado juntos: «…»», con su chapa de metal); y en
  la escena, **una placa de metal atornillada al dorso del respaldo del sofá**, con su letrero («Bea lectora y tú · 1 h 10 min
  juntos · 1 libro»). En tu cita, la placa es la vuestra; sin cita, la de más horas. Al tocar el sofá sin cita, si tienes
  placa, la vista mira al respaldo (no a la chimenea) y el aviso lo dice: «En el respaldo, tu placa con X».
- **Apuntar un libro**: si terminas un libro en una cita en la que habéis leído juntos, después del formulario de páginas la
  sala pregunta «Has terminado X leyendo con Y. ¿Lo apuntáis en la placa del sofá? Lo verá Y.» con «Apuntarlo en la placa» o
  «Ahora no»; después sigue lo de siempre (dejar su lomo en la librería, si estabas sentado en un sillón). El servidor solo lo
  deja en una cita tuya aceptada, hasta 3 horas después de acabar y con al menos un minuto juntos en ella; título de 1 a 120
  caracteres, sin repetir, y como mucho 3 al día.
- **Los gestos, una lista cerrada** (sin texto libre): ¡Hola!, Alzar la taza, ¿Qué tal va? (enseñas tu libro), ¡Qué bueno!,
  Un capítulo más, Momento intenso y Buenas noches (`hotel/gestos.js`: botón, bocadillo y frase; la misma lista en el
  servidor). Se hacen a quien lee contigo en la sala (en «Leyendo ahora», «Saludar» como siempre y, al lado, «Gestos») y a tu
  amigo en la cita (en el panel de la cita y, en el sofá, con «Gestos» en la franja). **Cupo**: uno cada 30 min a la misma
  persona en la sala; en una cita, uno por minuto. Si no sale, se dice sin insistir («Ya le has hecho un gesto hace muy poco»).
- **Lo que llega**: un bocadillo sobre la cabeza de quien lo hace (también sobre su plaza del sofá) y su frase en la franja y
  en el panel («Bea lectora te da las buenas noches.»), durante 10 s. Se mira cada 15 s y al volver a la app.
- **Migración** `20261207120000_sala_parejas.sql`: `sala_saludos.gesto` (lista cerrada, el saludo de antes es «hola»),
  `sala_pareja_libros` con RLS cerrada y sin permisos directos, y funciones `security definer` `volatile`: `sala_gesto(quien,
  gesto)`, `sala_gestos_nuevos()`, `sala_placas()` y `sala_placa_libro(cita, titulo)`; `sala_en_cita` y
  `sala_pareja_minutos` son internas (sin permiso para nadie). Sin la migración aplicada: sin placas y solo «¡Hola!» (el
  saludo de la 1.83, como antes).
- **Código**: `hotel/gestos.js`, `hotel/CitaSala.jsx` (`FilaGestos` y las placas), `hotel/useCitaSala.js` (`placas`,
  `apuntarLibro`), `SalaLectura.jsx` (los gestos que llegan y se hacen, la placa en la escena, apuntar el libro),
  `sala3d.js` (la placa en el respaldo con su metal, `placa()` y `verPlaca()`, el sitio `placa` y los bocadillos sobre las
  plazas 6 y 7), `sala3d.css` y `service.js` (`salaGesto`, `salaGestosNuevos`, `salaPlacas`, `salaPlacaLibro`).
- **Pruebas**: `sala-parejas.rls.test.js` (PGlite con todas las migraciones: lista cerrada, solo entre quienes leen a la vez
  o en la cita, los cupos, el saludo antiguo llega como «hola», las placas solo con minutos juntos y solo para los dos, los
  hitos y los metales, apuntar un libro con sus límites, el bloqueo, y que las tablas y funciones internas no se tocan);
  `gestos.test.js` (la lista de la app es la del servidor); `rpc-solo-lectura`, `sala-citas` y `sala-lectura` siguen en
  verde. e2e nueva `v1118-sala-placa.spec.js` con Supabase simulado (las placas en el panel y en el respaldo, los gestos en
  la lista y en el sofá con su cupo, el gesto que te llega, apuntar el libro al acabar la cita, sin la migración) a 360, 390
  y escritorio en Chromium y a 390 en WebKit, con vídeo. Capturas y vídeos en `qa-report/sala-placa/`. Nada probado entre
  dos cuentas reales ni en móviles reales.

## 119. El café-librería del bajo, bloque 1: el local vacío en 3D (1.119.0)

Bloque 1 del plan del café-librería (`docs/qa/cafe-libreria.md`, aprobado por Francisco el 11-11-2026: «Sí, las
recomendadas»). La tienda del bajo deja de vender: se retira su vista y en su lugar está el antiguo videoclub vacío, en
traspaso, en 3D con el motor y el estilo de las salas del hotel.

- **Fuera la tienda**: desde la calle, la puerta del bajo es «Café-librería» con la placa «Se traspasa» y abre «El
  café-librería del bajo». Ya no hay sobres, muebles a la venta ni reciclaje a la vista. **No se borra nada**: tickets,
  inventario, sobres y datos siguen igual en el servidor (la prueba lo comprueba). Las misiones del ordenador ahora mandan
  los tickets al almacén del Gran Hotel.
- **El local, de noche**: suelo de damero rojo y crema gastado (con la huella del expositor), yeso con los huecos claros de
  lo que colgaba, vigas, la bombilla desnuda y la lamparita verde del mostrador; el escaparate y la puerta dan a la calle
  mojada del muelle con su farola y el faro, con lluvia. Cajas de mudanza, sábanas sobre bultos, una escalera de pintor y una
  estantería vieja vacía. **Al fondo, una cortina de terciopelo con su caballete** (nada industrial) tapa la parte del local
  que se abrirá al subir de nivel. En la puerta, el cartel de cartón «SE TRASPASA».
- **Pilar** (la dependienta, que se queda de camarera) detrás del mostrador: saluda («¡Pasa, pasa! Cuidado con las cajas.»)
  y, con «Hablar con Pilar», la vista va al mostrador y cuenta en cuatro frases que se jubila y te deja las llaves.
- **Se recorre** arrastrando para mirar y tocando el suelo para andar, sin atravesar el mostrador ni los bultos; letreros
  discretos (Pilar, El resto del local, El escaparate) y la franja baja de madera con lo que dice Pilar. A pantalla completa,
  con «Volver al portal» encima. Con movimiento reducido, sin paseo de cámara (directo); lo vivo (lluvia, polvo) quieto.
  **Sin WebGL**, el dibujo isométrico del local vacío (`renderShopRoom({ vacio: true })`) con Pilar igual.
- **Código**: `edificio/cafe/` (`cafeLayout.js` plano y colisiones, `cafe3d.js` escena, `Cafe.jsx`, `cafe.css`),
  `EdificioPanel.jsx` (el bajo monta `<Cafe />`), `shopRoom.js` (variante vacía), `calleView.js`, `facadeView.js`,
  `ComputerApps.jsx`. Sin migraciones.
- **Queda para otros bloques**: el dibujo de la fachada aún enseña el escaparate de la tienda (se rehace en el bloque 4).
  Decorar y el nivel 1 son el bloque 2.
- **Pruebas**: e2e nueva `v1119-cafe.spec.js` (recorrido con Pilar, cortina y escaparate; sin tienda; tickets e inventario
  iguales; andar sin atravesar el mostrador; movimiento reducido; sin WebGL) a 360, 390, 430 y escritorio en Chromium y a 390
  en WebKit, con vídeo; `calle3d`, `v178-paseo` y `v167-tienda` actualizadas y en verde; el recorrido de la tienda de
  `reforma-tienda` queda saltado (ya no existe). Capturas y vídeos en `qa-report/cafe/`. Sin probar en móviles reales.

## 120. El café-librería del bajo, bloque 2: las llaves, el nivel 1 y Decorar (1.120.0)

Bloque 2 del plan del café-librería (`docs/qa/cafe-libreria.md`; Francisco: «Sí, al bloque 2» tras ver el bloque 1).

- **Las llaves**: con la migración aplicada, la última frase de Pilar cambia a «Ya está vacío. Si lo quieres, aquí tienes las
  llaves: solo falta ponerle nombre.» con «Quedarme con las llaves» o «Ahora no». El nombre se elige de **una lista cerrada
  de 12** (sin texto libre: «La Última Página», «El Marcapáginas», «Café del Muelle», «Taza y Lomo»…); «Inaugurar el café»
  solo se activa con uno elegido. Se inaugura una vez.
- **El rincón (nivel 1)**: al inaugurar se van las cajas, las sábanas y la escalera; en la puerta, «ABIERTO» en lugar de «SE
  TRASPASA»; en la pared de detrás de la barra, un rótulo con el nombre del café; arriba a la izquierda, una placa discreta con el
  nombre y «Nivel 1 · Rincón». Llegan gratis y colocados los muebles del rincón: dos mesas redondas de mármol, cuatro sillas de
  bistró, dos taburetes de barra, una estantería baja y una lámpara de cristal (modelos propios, `cafe/cafeMuebles.js`). Pilar
  sigue en la barra («Pronto vendrán clientes a pedirte libros…»). Se entra mirando en diagonal a todo el rincón.
- **Tus libros en las estanterías**: los lomos de la estantería baja (de la balda de arriba hacia abajo) son tus libros leídos;
  lo que no cabe pasa a la estantería vieja de la pared. Con menos de 3 leídos, el café presta los de «Leyendo» y «Quiero leer».
  Cada lomo tiene un color según su título (no se piden portadas en el café).
- **Decorar**: la vista sube por encima del escaparate y mira el local desde arriba, con una rejilla ámbar de 6 × 6 casillas
  delante de la cortina. Se toca un mueble para elegirlo (marco ámbar en el suelo) y se arrastra o se toca una casilla libre
  para llevarlo; «Girar» (a cuartos de vuelta, si cabe), «Guardar en la balda» y «Soltar». Sin elegir nada, la balda de madera
  enseña «Del café» (los muebles del café con sus copias libres) y «De tu casa» (los muebles de casa que pueden ir: de suelo,
  sin saga, sin místicos ni retirados y no los esenciales del piso; con las copias que no están en tu piso ni ya en el café).
  Al tocar uno, se pone en el hueco libre más cercano al centro. «Listo» guarda; «Cancelar» lo deja como estaba. Nada se
  coloca encima de otra cosa ni fuera de la rejilla. Los granos se ven (0 por ahora): llegan con los clientes en el bloque 3.
- **Una copia, un sitio**: un mueble de casa puesto en el café cuenta como usado también para el piso (y al revés).
- **Migración** `20261210120000_cafe_local.sql` (la aplica Francisco): `cafe_catalogo` (los cinco muebles del café, medidas,
  precio en granos y nivel), `cafe_locales` (nombre, nivel, reputación, granos con tope, plano e inauguración) y
  `cafe_inventario`, con RLS y sin permisos directos; funciones `security definer` y `volatile`: `cafe_mio()`,
  `cafe_inaugurar(nombre)`, `cafe_guardar(plano)` y `cafe_comprar(mueble)` (con granos, para el bloque 3), y las internas
  `cafe_nombres`, `cafe_plano_inicial`, `cafe_de_casa`, `cafe_plano_valido` (hasta 24 cosas, uid único, dentro de la
  cuadrícula, giro a cuartos y sin solapes), `cafe_falta_de_casa` y `cafe_json`. **Redefine `piso_falta_copia`** (la misma
  de la 1.95) para sumar los muebles de casa que están en el café. No toca tickets, sobres, pity ni el inventario existente.
  **Sin la migración**, el bajo sigue como en la 1.119 (en traspaso, sin llaves ni Decorar).
- **Sin WebGL**: el dibujo isométrico del local y la placa con el nombre; Decorar no se ofrece.
- **Código**: `cafe/cafeCatalogo.js` (muebles, nombres, plano inicial y reglas del plano, iguales que en el servidor),
  `cafe/cafeMuebles.js` (modelos), `cafe/cafeService.js`, `cafe/cafeLayout.js` (la rejilla en el mundo y los muebles como
  obstáculos al andar), `cafe/cafe3d.js` (`setLocal`, `decorar`, el rótulo y la rejilla), `cafe/Cafe.jsx` y `cafe.css`;
  `EdificioPanel.jsx` le pasa al café tu inventario y tu piso.
- **Pruebas**: `cafe.rls.test.js` (PGlite con todas las migraciones: listas iguales a las de la app, el local nace en
  traspaso, sin comunidad no hay café, las tablas no se tocan, una sola inauguración con nombre de la lista, el plano y sus
  reglas, copias del café y de casa con el piso, el piso no puede usar una copia que está en el café, comprar sin bajar de
  cero); `inventario`, `esenciales`, `acabados`, `edificio`, `reforma` y `rpc-solo-lectura`, en verde con la función
  redefinida. e2e nueva `v1120-cafe-decorar.spec.js` con el servidor del café simulado (`e2e-community/cafeMock.js`, mismas
  reglas): las llaves y el nombre, el rincón, la estantería con tus libros, Decorar (elegir, llevar, girar, guardar en la balda,
  traer la mesa baja de casa), guardar, salir y volver a entrar; arrastrar sin pisar otra pieza; sin WebGL. A 360, 390, 430 y
  escritorio en Chromium y a 390 en WebKit, con vídeo. `v1119-cafe` sigue en verde sin la migración. Capturas y vídeos en
  `qa-report/cafe-decorar/`. Sin probar en móviles reales ni con el servidor de verdad (la migración está sin aplicar).

### 120.1 La interfaz del café, más de videojuego (1.120.1)

Francisco: «Cambia como se ve la interfaz para que se vea un poco más cercana al estilo videojuego y más atractiva». Solo
cambia el aspecto; las reglas, el servidor y la migración del bloque 2 siguen igual.

- **Cuadro de diálogo de RPG**: la franja de abajo es un cuadro oscuro con marco doble (crema y madera), el **retrato de
  píxel de Pilar** a la izquierda y una **pestaña con su nombre** sobre el borde. Mientras cuenta su historia, un «▼» de píxel
  parpadea al final de la frase (quieto con movimiento reducido). Los avisos (guardado, cortina, escaparate…) llevan una
  taza en lugar del retrato y no llevan pestaña. Los botones van debajo del texto, junto al retrato (a la derecha si el café
  mide 700 px o más de ancho; se mide el café, no la ventana).
- **Botones de píxel con relieve**: contorno oscuro, luz arriba y sombra abajo; se hunden al pulsarlos. Ámbar para la acción
  normal, madera para la secundaria y **verde para confirmar** («Quedarme con las llaves», «Inaugurar el café», «Listo»).
- **Letra de píxel** (PuertoPixel, la de la app; nunca la de pixelfx) en botones, letreros de la escena, pestañas, nombres y
  el HUD. Lo que se lee largo (lo que dice Pilar, nombres de muebles) sigue en Lora.
- **HUD arriba**: una placa con la **insignia del nivel** («NV 1»), el nombre del café, el nombre del nivel y la **barra de
  reputación** hacia el siguiente (0 / 300 en el Rincón, cifras del plan §6, `CAFE_NIVELES` y `progresoNivel` en
  `cafeCatalogo.js`); a la derecha, el **monedero de granos** con su grano dibujado. Se ve también en Decorar.
- **Nombre del café**: las 12 opciones son placas de madera; la elegida se enciende en ámbar con una flecha de píxel.
- **Decorar como inventario**: casillas cuadradas con el **icono de píxel de cada mueble** (los cinco del café, la mesa baja y
  la lámpara de pie; el resto de lo de casa, una caja), el **número de copias libres en una esquina** y el nombre debajo; las
  agotadas, en gris. Pestañas «Del café» / «De tu casa» como solapas. Con un mueble elegido, su icono junto al nombre. La
  balda es más baja para no tapar la rejilla (el título y «Cancelar / Listo» en una fila; la línea de los granos pasa al HUD).
- **Código**: `cafe/cafeIconos.js` (los dibujos, cuadrículas de letras con su paleta, propios), `cafe/PixelArt.jsx` (los
  dibuja como SVG de bordes duros), `Cafe.jsx` y `cafe.css` (capa «1.120.1» al final).
- **Pruebas**: `v1119-cafe` y `v1120-cafe-decorar` sin cambios, en verde a 360, 390, 430 y escritorio en Chromium y a 390 en
  WebKit; capturas y vídeo nuevos en `qa-report/cafe-decorar/` y `qa-report/cafe/` (sustituyen a las de la 1.120.0).

## 121. El café-librería del bajo, bloque 3: clientes, barra y granos (1.121.0)

Bloque 3 del plan del café-librería (`docs/qa/cafe-libreria.md` §3, §5 y §6; Francisco: «Seguir al bloque 3» tras aprobar la
1.120.1), **rehecho tras su revisión del 12-11-2026**: el café pesa más que el libro, cada bebida se prepara en una barra 3D
artesanal según lo que pide el cliente y se le lleva a su mesa; el libro pasa a ser un extra, elegido entre pocas fichas; los
fallos se puntúan con estrellas, y llega un cliente excéntrico al día. Sin subidas de nivel ni tickets: llegan en el bloque 4.

- **Clientes del día**: cada día (de Madrid) llegan los que da tu nivel (**3 en el Rincón**; 4 en el 2 y 5 del 3 en adelante;
  el último, el excéntrico), los fija el servidor y **esperan todo el día**: no se van, no se enfadan y no se acumulan. Se ven
  **sentados** en las sillas y taburetes del plano (si faltan asientos, de pie junto al escaparate), con aspecto propio sacado
  de su semilla y ropa de la corriente (nunca prendas que se ganan). Los que esperan llevan encima un **bocadillo «!»** que
  salta (quieto con movimiento reducido; si dos caen juntos, se apilan); tocarlo, o «Atender» en el cuadro de Pilar, empieza.
- **La receta** (nivel 1, cuatro elecciones; el bloque 4 desbloqueará más): **bebida** (café o té), **grano u hoja** (suave o
  intenso), **leche** (sin, entera o avena) y **toque** (nada, canela o miel): 36 recetas. Cada cliente pide la suya, sacada
  de su semilla; un habitual pide siempre «lo de siempre». La comanda se lee en una nota de papel arriba («Un café intenso
  con leche de avena y canela.»).
- **Atender** (en el cuadro de diálogo, con el retrato de píxel del cliente):
  1. **Pide**: su saludo y la comanda. «A la barra» o «Luego».
  2. **En la barra**: la cámara pasa a una vista de la barra desde arriba, con **piezas 3D artesanales** (cafetera de palanca de
     cobre, tetera de hierro, tarros de grano y de hoja, jarras de leche, lata de canela, tarro de miel y la taza en su
     platillo). **Se toca en la barra lo que lleva** (lo elegido se enmarca en ámbar) o se cambia en las cuatro casillas del
     cuadro («Bebida: Café. Cambiar»); la leche y el toque se quitan al volver a tocarlos. *(Desde §121.1, la barra va por
     etapas y cada paso tiene su gesto y su objeto; lo que sigue en este punto queda sustituido.)* **Mantener pulsado «Servir»**
     vierte: la taza se llena con su color, la espuma, la canela o la miel y el chorro (un segundo y medio; lo llenado no se
     pierde al soltar, sin medir reflejos; «Sigue pulsando · 40 %»). Cambiar la receta con la taza empezada empieza otra.
     **Con movimiento reducido, un toque.**
  3. **Llevársela**: sales de la barra con **la taza en la mano** (se ve abajo a la derecha) y vas andando hasta el cliente
     (tocándolo o con «Llevársela»), a un paso de él y de frente; con movimiento reducido, directo.
  4. **El libro, un extra**: tres **fichas** con portada de color, título, autoría y pistas (género, páginas, año, «Favorito»,
     «Lo último que leíste»), **una que encaja** si tu estantería puede, en otro sitio cada vez; o «Solo el café».
  5. **Las estrellas**: puntos = aciertos de la receta (0 a 4) + 1 si el libro encaja; **5 → 3 estrellas, 3 o 4 → 2, menos → 1**.
     Se ve qué se acertó y qué no («✓ Café», «✗ Entera · pidió de avena», «✓ El libro», «· Sin libro») y lo ganado. **Nunca es
     cero ni quita nada.**
- **Lo que deja** (granos / reputación, lo cuenta el servidor):

  | | 1 ★ | 2 ★ | 3 ★ |
  | --- | --- | --- | --- |
  | Cliente | 2 / 6 | 4 / 10 | 5 / 14 |
  | Habitual | 3 / 8 | 5 / 12 | 6 / 15 |
  | Excéntrico | 5 / 14 | 10 / 26 | **15 / 40** |

- **El excéntrico del día**: el último cliente de cada día es uno de seis personajes propios (la Condesa de los Marcapáginas,
  el Señor Tictac, Madame Niebla, el Capitán Tinta, Doña Orquídea y el Profesor Lupa). **Se distingue a la vista**: tocado
  propio en 3D (turbante, bombín, velo, tricornio, flores o birrete; cajas propias, nunca prendas), aura de su color en el suelo
  y chispas, letrero con estrella de su color, franja y retrato con estrella. **Pide en acertijos**, una línea por elección
  («Algo que se muela, no que se deje en remojo.», «Con la nube de una vaca contenta.»). Con 3 estrellas paga **el triple** y
  deja **una reseña dorada** en la pizarra con su firma («★ Madame Niebla»); con menos, paga según la tabla y sin reseña.
  Pilar avisa: «Tienes 3 clientes esperando, y uno es muy peculiar».
- **Habituales** (12 personajes propios con nombre y aspecto fijos: Tomás, Lucía, Anselmo, Marga, Iker, Valentina, Paco,
  Nuria, Héctor, Carmela, Bruno e Inés): **cada sesión de lectura de hoy trae uno, como mucho 2 al día**. Cuenta cada
  sesión de lectura cozy de 15 minutos o más, y haber registrado lectura hoy (el registro no guarda minutos: cuenta como
  una). Si terminaste un libro ayer u hoy, el habitual pregunta por él. Al irse **deja una reseña cerrada en la pizarra**
  (12 frases propias), con las estrellas que sean.
- **La pizarra**: un botón con su dibujo en el HUD, bajo los granos (con el número de reseñas); se abre de tiza sobre verde
  con las últimas 6 y quién las firmó; las doradas, en oro.
- **Fin del día**: «Hoy ya está todo el mundo atendido. Si lees un rato, vendrá algún habitual.» (o «El local es tuyo para
  decorar.» si ya vinieron los dos). Sin cuentas atrás. Al volver a entrar, los atendidos siguen leyendo.
- **Migración** `20261211120000_cafe_clientes.sql` (la aplica Francisco; requiere la del bloque 2): `cafe_dias` (clientes
  fijados por el nivel del servidor y habituales, por cuenta y día), `cafe_servicios` (uno por cliente y día: receta,
  aciertos, si encajó, estrellas, granos y reputación) y `cafe_resenas` (de habitual o dorada), con RLS y sin permisos
  directos; funciones `security definer` y `volatile`: `cafe_dia(dia)`, `cafe_habitual(dia)` y `cafe_servir(dia, cliente,
  receta, encaja)`, y las internas `cafe_hoy`, `cafe_dia_valido` (solo hoy o ayer de Madrid), `cafe_clientes_nivel`,
  `cafe_receta`, `cafe_pide`, `cafe_estrellas`, `cafe_premio`, `cafe_semilla`, `cafe_quien`, `cafe_abrir_dia` y
  `cafe_dia_json`. **La receta pedida, los aciertos, las estrellas y las cifras las pone el servidor**; la app solo dice si
  el libro encajó (no tiene la biblioteca), y eso vale como mucho 1 de 5 puntos. Todo tiene techo diario (nivel 1: 3 clientes,
  el último el excéntrico, y 2 habituales: 37 granos y 98 de reputación como mucho). **Sin la migración**, el café abierto sigue como
  en la 1.120 (sin clientes).
- **Código**: `cafe/cafeClientes.js` (recetas, comandas y acertijos, estrellas, premios, excéntricos, habituales, reseñas,
  pedidos y las fichas de `librosParaRecomendar`, iguales que en el servidor), `cafe/Atender.jsx` (pide → barra → llevar →
  libro → gracias), `cafe/cafe3d.js` (`BARRA_COSAS`, `barraKit`, la taza en la mano, `adornoExcentrico`, y en la API `barra`,
  `setReceta`, `llevar`, `irACliente`, `barraEnPantalla`, `enBarra`), `cafe/cafeService.js`, `Cafe.jsx` y `cafe.css` (capas
  «1.121»).
- **Pruebas**: `cafe-clientes.rls.test.js` (PGlite con todas las migraciones: recetas, estrellas, premios y excéntricos
  iguales que en la app; el último cliente es el excéntrico; receta válida; 3 estrellas y 1 estrella; un habitual con 2
  estrellas deja su reseña; el excéntrico con 3 paga 15/40 y deja la dorada, con 2 no; tablas y funciones internas cerradas);
  `cafeClientes.test.js` (36 recetas distintas, comandas, aspectos de los excéntricos sin prendas, estrellas y premios, tres
  fichas con una que encaja en sitios distintos, pedidos y habituales); `cafe.rls` y `rpc-solo-lectura` siguen en verde. e2e
  `v1121-cafe-clientes.spec.js` con el servidor simulado (`cafeMock.js`, mismas reglas): un día entero (uno perfecto
  eligiendo en la barra 3D con libro, 3 estrellas; uno con la leche mal y sin libro, 2 estrellas; el excéntrico tras «Luego»,
  perfecto, con reseña dorada; el habitual con un libro que no encaja; la pizarra; «todo el mundo atendido»; volver a entrar)
  a 360, 390, 430 y escritorio en Chromium y a 390 en WebKit, con vídeo; y con movimiento reducido (servir con un toque, sin
  andar). `v1119-cafe` y `v1120-cafe-decorar` siguen en verde. Capturas y vídeos en `qa-report/cafe-clientes/`. Sin probar en
  móviles reales ni con el servidor de verdad (las dos migraciones del café están sin aplicar).

### 121.1 Preparar el café: un gesto y un objeto por paso (1.121.0, sin publicar)

Encargo de Francisco del 12-11-2026, literal: «quiero que el proceso de hacer el cafe sea divertido y adictivo, y que cada
paso se sienta unico, tanto por los movimientos que haga el usuario como por los objetos que tenga que ver». Sustituye al
«Mantener pulsado Servir» del punto 2 de §121. **No cambia la economía, las recetas ni el servidor**: las cuatro elecciones son
las mismas, `cafe_servir` recibe lo mismo y **los gestos no cambian las estrellas** (solo cuenta la receta).

- **Cinco etapas**, en una fila del cuadro (Bebida · Grano u Hoja · Extraer o Reposar · Leche · Toque; ✓ las hechas). En cada
  una la cámara se acerca a su objeto (de lado y desde arriba, con el objeto en la parte alta de la pantalla) y el cuadro dice
  la orden y cómo hacerla; una pista dibujada sobre el objeto enseña el movimiento.
- **Cada paso, su gesto y su objeto** (con el dedo o el ratón, a 390 px; las medidas se escalan con la pantalla):

  | Etapa | Objeto | Gesto | Sonido |
  | --- | --- | --- | --- |
  | Bebida | cafetera de palanca o tetera de hierro | tocarla (o su botón) | soplo de vapor y cobre / hierro y tapa |
  | Grano (café) | tarro y **molinillo de manivela** | **girar** dos vueltas, hacia cualquier lado; la tolva baja y el cajón se llena | crujido cada octavo de vuelta |
  | Hoja (té) | tarro y **cuchara de latón** | **arrastrar** la cucharada del tarro al colador | roce de hojas |
  | Extraer (café) | portafiltro y **prensador**; **palanca** | **deslizar hacia abajo** con firmeza; después **bajar la palanca y mantener** (el manómetro se enciende y cae el café) | golpe y clac; el café que cae |
  | Reposar (té) | **tetera**; **colador** | **subir y mantener** (la tetera se inclina y vierte); **subir y bajar** el colador cinco veces (el té coge color) | agua; un plop por inmersión |
  | Leche (si lleva) | jarra bajo la **lanza de vapor**; la jarra sobre la taza | **inclinar a un lado y mantener** hasta que se crea la espuma; **un trazo hacia abajo**: recto sale un corazón, ondulado (3 ondas o más) una hoja, que va apareciendo mientras se sirve | vapor (más grave al crearse); una nota por onda |
  | Toque (si lleva) | bote de canela o cazo de miel | **agitar de lado a lado** sobre la taza; **dibujar** el hilo de miel por encima, como se quiera | sacudidas; el hilo que se estira |

  Tras extraer o reposar, la taza sale del grupo a la madera para la leche y el toque.
- **Reglas**: ningún gesto falla ni tiene tiempo límite; lo mantenido se suma y **soltar no pierde nada**; sin falsos «casi» ni
  presión. Un respiro breve y «¡Hecho!» al acabar cada gesto; tres notas al terminar la taza. Un medidor (`progressbar`) dice
  cuánto falta. «Cambiar» vuelve a elegir antes de empezar el gesto; «De nuevo» tira lo preparado y empieza otra taza; «Luego»
  deja al cliente esperando. El dibujo de la leche es un piropo en las gracias, sin efecto en las estrellas.
- **Movimiento reducido o teclado**: cada gesto se hace de una vez con un toque, con Intro o con su botón («Moler», «Apisonar»,
  «Extraer», «Echar las hojas», «Verter el agua», «Infusionar», «Cremar la leche», «Servir la leche», «Espolvorear», «Echar la
  miel»); la cámara salta sin moverse.
- **Sonido**: propio, sintetizado con Web Audio, breve y bajito, uno por acción y material; va por el bus de efectos de la app
  (respeta «Sonidos táctiles» y su volumen) y solo con el sonido del edificio activado; nada suena antes de tocar; los que duran
  mientras se mantiene se apagan al soltar.
- **Código**: `cafe/cafeGestos.js` (etapas, gestos por receta, reconocedores puros de cada gesto y `vistaTaza`),
  `cafe/cafeSfx.js` (los sonidos), `audio/uiSounds.js` (`uiSfxBus`), `cafe/Atender.jsx` (las etapas y la zona del gesto),
  `cafe/cafe3d.js` (la barra con sus partes que se mueven, `ENFOQUES` de cámara por gesto, la taza con su dibujo, y en la API
  `setBarra`, `barraMarca`) y `cafe.css` (capa de los gestos).
- **Pruebas**: `cafeGestos.test.js` (12: etapas y gestos por receta, cada reconocedor, que soltar no pierde nada, el corazón y
  la hoja, `completar`, `vistaTaza`); `cafeClientes`, `cafe-clientes.rls`, `cafe.rls` y `rpc-solo-lectura` siguen en verde. e2e
  `v1121-cafe-clientes.spec.js` reescrita: cada gesto se hace con el ratón sobre su objeto (manivela en círculos, trazos,
  mantener, vaivenes, el hilo en espiral), un día entero con té, café con leche mal, el excéntrico y el habitual (con miel en vez
  de canela: 2 estrellas y el repaso «✗ Miel · pidió canela»), con capturas de cada paso; y con movimiento reducido (Cambiar,
  «De nuevo» y cada gesto con su botón). Capturas y vídeos en `qa-report/cafe-clientes/` (las de la versión anterior, en
  `antes-1121/`). Sin probar en móviles reales: solo emulación de Chromium y WebKit.
- **La canela, desde encima** (Francisco, 12-11-2026): el bote gira sobre su centro y queda boca abajo justo encima de la
  taza, se balancea con el dedo y el polvo cae en vertical dentro.

### 121.2 La «!» de ayuda sobre lo siguiente que hay que tocar (1.121.0, sin publicar)

Francisco, 12-11-2026: «para que la gente no se lie a causa del pixel art que las cosas que tienen que tocar resalten con una
exclamación al menos para los primeros niveles». Eligió «solo lo siguiente».

- Una **«!» de píxel ámbar** (cuadrito con borde oscuro y piquito hacia la cosa) que salta despacio (quieta con movimiento
  reducido) sobre **lo siguiente que hay que tocar**:
  - al elegir una parte, sobre **cada cosa que se puede elegir** de esa parte (la cafetera y la tetera; los dos tarros; las
    dos jarritas; la canela y la miel): **nunca delata cuál es la buena**;
  - en un gesto, sobre su objeto, encima de la pista del dedo; se va en cuanto empieza el gesto;
  - los clientes que esperan ya llevaban su «!» (§121).
- **Cuándo**: en los **niveles 1 y 2**, siempre; desde el 3, solo si alguien lleva **6 segundos** sin avanzar en ese punto.
  Regla en `cafeGestos.js` (`verAyuda`, `AYUDA_NIVELES`, `AYUDA_PARADO_MS`).
- **Ajuste** en «Tu cuenta», apartado «Ayudas visuales»: «Al empezar (niveles 1 y 2) y si me quedo parado» (por defecto),
  «Siempre» o «Nunca» (`settings.ayudasCafe`). No suena ni cambia nada del juego.
- **Código**: `cafe/Atender.jsx` (las marcas, en la zona del gesto), `cafe/cafe3d.js` (`barraEnPantalla(id, { cima })`),
  `cafe/Cafe.jsx` (pasa el ajuste y el nivel), `cafe.css` (`.cf3-ayuda`) y `components/panels/AccountPanel.jsx`.
- **Pruebas**: `cafeGestos.test.js` comprueba la regla (13 pruebas); la e2e `v1121-cafe-clientes` comprueba las dos «!» al
  elegir cada parte y la del gesto antes de empezarlo, con capturas `*-ayuda-manivela`, `*-ayuda-tetera` y `*-ayuda-vapor`.

### 121.3 Libros en cajas: la distribuidora, la caja de reparto y la balda (1.121.0, sin publicar)

Idea de Francisco tomada del género de Tiny Bookshop (solo la mecánica, nunca su arte); eligió «cajas por género» y «caja de
bienvenida y Solo el café», y aprobó las cifras el 12-11-2026 («Sí, esas cifras»; `docs/qa/cafe-libreria.md` §11).

- **Lo leído desbloquea el título** en la distribuidora (los de `librosDelCafe`: tus leídos; con menos de 3, también Leyendo
  y Quiero leer). Cada título lleva su **género** (`generoDe`, por las categorías del libro; si no se sabe, «Novela»), de una
  lista cerrada de 10 (`GENEROS`, igual que `cafe_generos()`).
- **Cajas con granos** (nunca con dinero): de un **género**, **5 ejemplares por 10 granos**, al azar entre tus títulos de ese
  género (el azar lo pone el servidor); de un **título concreto**, **3 por 9**. Antes de pagar se ve qué puede traer (los
  títulos de ese género). Sin granos suficientes, el botón no se pulsa y el servidor lo rechaza.
- **Caja de bienvenida**: **8 ejemplares gratis, una sola vez**, repartidos entre géneros, al entrar con el café abierto. La
  vista se vuelve hacia la caja y Pilar lo cuenta.
- **La caja llega al café**: una caja de cartón con su cinta y lomos asomando, en el suelo al final del mostrador, con un
  letrero ámbar «! Caja de libros · n» mientras quedan ejemplares por colocar; en el HUD, un botón de lomos con el número.
- **Colocar**: al tocar la caja se abre el cuadro «Tus libros»: la caja abre sus solapas y los lomos saltan (directo con
  movimiento reducido); se **arrastran a la balda** (o se tocan: van al primer hueco) y se devuelven tocándolos en la balda.
  «Colocarlos todos» / «Llenar la balda (n)». **12 huecos en el nivel 1** (`huecosDelNivel`). Nada se pierde.
- **Solo se recomienda lo que está en la balda**: las tres fichas salen de sus ejemplares; las estanterías del café enseñan
  la balda (vacías si no hay ninguno; sin la migración, tus leídos como en la 1.120). Si el libro **encaja**, el cliente **se
  lo lleva** (sale de la balda) y paga **2 granos más**; si no encaja, vuelve a la balda. Un libro que no está en la balda no
  cuenta. **Sin ejemplares, solo el café** (cobra el café; solo se pierde el punto del libro).
- **Servidor** (en `20261211120000_cafe_clientes.sql`, sin aplicar: la aplica Francisco): tabla `cafe_libros` (clave,
  título, género, caja y balda por cuenta; RLS sin acceso directo), `cafe_locales.libros_bienvenida`; funciones
  `cafe_bienvenida(titulos)`, `cafe_comprar_caja(genero, clave, titulos)` y `cafe_colocar(poner, quitar)`;
  `cafe_servir` gana el 5.º parámetro `libro`; `cafe_dia`, `cafe_habitual` y `cafe_servir` devuelven `libros`. Los
  títulos los manda la app (el servidor no tiene la biblioteca); el servidor cobra, sortea y cuenta cajas y baldas.
- **Código**: `cafe/LibrosCafe.jsx` (la caja, la balda y la distribuidora), `cafe/Cafe.jsx`, `cafe/Atender.jsx` (fichas de
  la balda, «Se lleva …» y «2 por el libro»), `cafe/cafeClientes.js` (cifras y reglas), `cafe/cafeService.js`,
  `cafe/cafe3d.js` (la caja de reparto, su letrero y las estanterías vacías), `cafe/cafeLayout.js` (`CAJA_LIBROS` y su sitio),
  `cafe/cafeMuebles.js`, `cafe/cafeIconos.js` (`LIBROS`) y `cafe.css`.
- **Pruebas**: `cafe-clientes.rls.test.js` (PGlite) comprueba cifras iguales a la app, bienvenida una vez, cajas de género y
  de título, granos, el tope de 12, servir con y sin el libro en la balda y que `cafe_libros` no se toca; la e2e
  `v1121-cafe-clientes` tiene una prueba nueva (bienvenida, arrastrar, tocar, colocar todos, devolver, comprar las dos cajas,
  balda llena, estanterías) y el día y el reducido adaptados (el cliente se lleva el libro; balda vacía, solo el café).
- **Más cozy** (Francisco, 12-11-2026: «me gusta pero quiero un toque más cozy y acogedor con los libros»), sin tocar reglas:
  cada título tiene su lomo propio y siempre el mismo (tela con bandas doradas, piel con nervios o rústica lisa con el sello de
  la editorial; alto y grosor propios, `aireDe` en `LibrosCafe.jsx`); en la balda los libros van **juntos, uno al lado de
  otro**, y los huecos libres a la derecha como siluetas tenues; la balda tiene luz de lámpara, vetas y una **guirnalda de
  bombillas** (quieta con movimiento reducido); el que acaba de llegar **se asienta** con un pequeño balanceo; la caja trae
  **papel de seda** y la etiqueta «Distribuidora del Puerto · Frágil · son libros ♥»; con libros esperando, la caja se abre
  delante de ti al tocarla; **Pilar comenta** (frases cerradas: «¡Huele a libro nuevo!…», «¡Qué bonita ha quedado la
  balda!…») en lugar del texto de ayuda; y **sonidos propios** bajitos (`cafeSfx.js`: `cajaAbre`, `libroPon`,
  `libroQuita`, `baldaLlena`, `campanilla` al comprar), solo con el sonido activado y siempre tras un toque.
- **La caja, de cartón de verdad** (la anterior, plana, no le convencía a Francisco): vista de frente y un poco desde arriba,
  con la pared del fondo oscura, los libros dentro asomando por encima de la cara delantera (que no recoge toques), el papel
  de seda arrugado en el borde, la cinta y la etiqueta en la cara delantera, y las solapas abiertas hacia fuera y la del fondo
  de pie. Cerrada, la tapa con su precinto; al abrirse, la tapa se levanta y las solapas se despliegan (directo con
  movimiento reducido). Clases `.cf3-carton__*`.
- **La caja, en 3D** (Francisco, 12-11-2026: «La quiero más 3d»): caja expositora de cartón con el frente recortado, de caras
  reales en perspectiva (CSS 3D, `.cf3-carton__solido`): fondo, suelo y laterales que bajan en rampa hasta el frente, la
  solapa trasera de pie y la sombra en el suelo. Los libros siguen siendo HTML normal entre el fondo y la cara delantera (se
  tocan y se arrastran igual). Cerrada, la solapa delantera tapa la boca con su precinto y la trasera se tumba encima; al
  abrirse giran sobre sus bisagras (directo con movimiento reducido).
- **Con volumen y títulos parejos** (Francisco, 12-11-2026: «se ven demasiado planos como imágenes pegadas y los títulos de los
  libros salen desparejos»): los títulos salían desparejos por una regla antigua de `.cf3-lomo` que se colaba (rejilla de dos
  columnas, esquinas recortadas); se anula para los lomos de libro (`.cf3-lomo[data-forma]`). Ahora todos los títulos usan la
  misma letra, empiezan a la misma altura, se leen de arriba abajo y llevan palabras enteras que caben en el lomo
  (`tituloLomo`: sin el artículo si hace falta, y «…» si no cabe entero; el nombre completo sigue en la etiqueta accesible).
  Cada libro tiene cabeza con el canto de las hojas, lomo redondeado y sombra propia, y alto de 64 a 72 px. El cartón lleva
  textura de canal, el canto grueso de la cara delantera, la luz de un lado y la sombra en las esquinas del fondo.

## 122. El café-librería del bajo, bloque 4a: subir de nivel, hitos y la carta (1.122.0)

Bloque 4a del plan del café-librería (`docs/qa/cafe-libreria.md` §12; Francisco, 12-11-2026: «continua con los siguientes
bloques», y eligió partir el bloque 4 en 4a y 4b, una receta nueva por nivel, hitos «mueble, carta, granos» y huecos
12/18/30/36/42). Migración nueva, **sin aplicar**: `20261212120000_cafe_niveles.sql` (requiere las dos del café anteriores).

- **Niveles por reputación** (0 / 300 / 1.000 / 2.500 / 5.000, ya aprobados). Al subir, los **tickets del nivel**
  (10 / 20 / 40 / 60 / 100; el del nivel 1 se cobra con el primer cliente) una vez por nivel, en la misma transacción que el
  servicio. **Tickets del día**: tantos como el nivel (tope 5), una vez al día, con el primer cliente. Lo cuenta el servidor
  (`cafe_progreso`, solo desde `cafe_servir`) y lo devuelve en `progreso`.
- **Tres hitos por nivel**, a un cuarto, a la mitad y a tres cuartos de la barra (así ninguno coincide con la subida):
  1.º un mueble nuevo del café a la venta (nivel 1 maceta, 2 perchero, 3 reloj de pared), 2.º lo nuevo de la carta (nivel 2
  el chocolate, nivel 3 la nata) y 3.º 15 granos. Una vez cada uno (`cafe_hitos`). En la barra del nivel, tres marcas.
- **El cartel de lo conseguido** (`LogroCafe.jsx`), al despedir al cliente: la subida (el número grande, sus tickets y lo
  que se abre, con frases cerradas), los hitos y los tickets del día. Solo lo que ha dado el servidor; sin cuentas atrás ni
  presión. Suena una vez (arpegio al subir, «ding» en un hito); con movimiento reducido, sin animación.
- **Al cerrar el cartel de una subida, se abre el local**: hasta entonces la escena sigue en el nivel de antes. Nivel 2: se
  recogen la cortina y el caballete, queda una viga de roble y al fondo **un ventanal al puerto** (cielo de tarde, faro,
  velas y el brillo del sol en el agua; alféizar con geranios). Nivel 3: **estanterías hasta el techo** con su escalera de
  biblioteca y **la chimenea encendida** (brasa, llamas, candelabros y su resplandor en el suelo). La cámara hace **un
  recorrido** por lo nuevo y vuelve a tu vista (`recorrido(nivel)` en `cafe3d.js`); con movimiento reducido, no hay
  recorrido. Desde el nivel 2 se puede andar hasta el fondo.
- **La cuadrícula crece hacia el fondo**: desde el nivel 2, tres filas más (−3 a −1, detrás de donde estaba la cortina); las
  casillas de antes no cambian de número. `filasDe(nivel)` en `cafeCatalogo.js`; en el servidor, `cafe_plano_valido(plano,
  nivel)` y `cafe_guardar` con el nivel del café. Lo nuevo que añades en Decorar va primero al fondo.
- **La tienda del café**, en Decorar (tercera pestaña, «Tienda»): todos los muebles del café con su precio en granos; los de
  otro nivel dicen en cuál se abren y los de un hito, cuánta reputación falta. Nueve muebles nuevos con modelo 3D e icono:
  maceta (35, hito 1 del nivel 1), banco corrido (70), vitrina de tartas (90), planta grande (45), perchero (40, hito), estantería
  alta (140, 96 libros), sillón orejero (120), mesita con quinqué (80) y reloj de pared (160, hito). Al comprar, el aviso sale
  en la cabecera de la balda (el cuadro de Pilar no se ve mientras decoras).
- **Huecos de la balda por nivel**: 12 / 18 / 30 / 36 / 42 (`HUECOS`, también en el servidor).
- **La carta, por días**: el servidor fija la carta del día al abrirlo (lo que piden los clientes no cambia a media jornada);
  los habituales piden siempre «lo de siempre». La receta se cuenta con base mixta (`recetaDe(r, carta)`): con la carta vacía,
  igual que antes.
- **El chocolate caliente** (nivel 2, bebida), con sus objetos: el hornillo de hierro con **el cazo de cobre** (detrás de la
  tetera) y **el molinillo de madera**. El cacao se elige en su tarro (claro, con leche; oscuro, negro); después, **remover**
  con el molinillo en círculos amplios dentro del cazo (tres vueltas: se espesa y deja remolinos) e **inclinar el cazo** sobre
  la taza (deslizar a la izquierda y mantener mientras cae).
- **La nata montada** (nivel 3, toque): **el bol de loza con las varillas** (junto a la miel). **Batir girando**: vueltas
  pequeñas y seguidas (cinco) hasta que salen picos; la nata se posa en la taza como una nube.
- Los gestos nuevos cumplen las reglas de siempre (`cafeGestos.js`): ninguno falla ni tiene tiempo límite, soltar no pierde lo
  hecho, no cambian las estrellas y con movimiento reducido o teclado se hacen de un toque. Sonidos propios sintetizados:
  el cazo al elegirlo, el molinillo que se arrastra, el tintineo de las varillas y el chocolate que cae (`cafeSfx.js`). La
  pregunta de la barra nombra lo nuevo solo si está en la carta, y lo que no está abierto no se puede elegir aunque se toque.
- **Pruebas**: `cafe-niveles.rls.test.js` (7, PGlite: cifras iguales a la app, tickets del nivel y del día una vez, hitos una
  vez con sus 15 granos, el mueble de hito no se vende antes, la carta del día y el chocolate rechazado antes de abrirlo, la
  cuadrícula del fondo solo desde el nivel 2, tablas y funciones internas cerradas); `cafeGestos.test.js` (molinillo, cazo y
  varillas); e2e `v1122-cafe-niveles.spec.js` (subir al nivel 2 con el cartel, el recorrido, la tienda, comprar y colocar al
  fondo; el nivel 3 con la chimenea y un chocolate con nata hecho con los gestos).
- **Queda para el bloque 4b**: el altillo (nivel 4), la terraza y el escaparate en la fachada (nivel 5), sus muebles y su carta
  (vainilla y bebidas con hielo).

## 123. El café-librería del bajo, bloque 4b: el ala lateral, la terraza y el escaparate (1.123.0)

Bloque 4b del plan del café-librería (`docs/qa/cafe-libreria.md` §13; cifras aprobadas por Francisco el 12-11-2026, «Sí, esas
cifras»). Es el final de la planta de la calle (niveles 1 a 5, §12.1). Migración nueva, **sin aplicar**:
`20261213120000_cafe_ampliacion.sql` (va después de las del café y de `20261212120000_cafe_niveles.sql`).

- **Nivel 4, «Ala lateral»** (antes «Altillo»): se abre **la pared de la izquierda** (la barra está a la derecha) y el local
  gana un ala de 3,4 unidades: suelo de damero, techo con vigas, su pared de fondo, una ventanita a la calle, dos pilares de
  ladrillo en los extremos, una viga de roble donde estaba la pared y tres campanas de latón que la alumbran. La pared de la
  izquierda, con su estantería de siempre y las estanterías altas del nivel 3, pasa al fondo del ala. La cuadrícula de
  Decorar pasa a **9 × 9** (columnas −3 a 5, filas −3 a 5; las casillas de antes no cambian de número). En Decorar, los
  pilares y la viga se esconden para que no tapen la cuadrícula.
- **Nivel 5, «Terraza y escaparate»**: la puerta queda abierta y el cristal del escaparate se ve a través; fuera, la acera
  mojada con **tres filas de terraza** (filas 7 a 9, columnas 0 a 5, con su propia cuadrícula en Decorar), **el toldo a
  rayas granate y crema con su guirnalda de farolillos**, la fachada de estuco mostaza con zócalo de piedra, **la placa con
  el nombre del café** sobre el escaparate y, enfrente, el muelle de noche con el faro. En la terraza no llueve. Se puede
  salir a la acera andando.
- **El escaparate**: desde el nivel 5, al tocar el escaparate, Pilar pide **hasta tres de tus leídos** (nunca los prestados de
  «Leyendo» o «Quiero leer»); se ven de pie, de cara a la calle, en una peana con su lamparita (el del centro, más alto).
  Lo guarda el servidor (`cafe_poner_escaparate`, solo desde el nivel 5 y como mucho tres títulos).
- **Desde la calle**: el portal pide tu café con `cafe_fachada` (solo tu cuenta; no crea nada). Desde el nivel 5, en la fachada
  del edificio se ven **tus tres libros en el escaparate** y la guirnalda bajo el toldo, y dos mesitas de terraza en la acera
. **La limusina y su chófer pasan a la izquierda del portal**, delante de la librería (Francisco, 12-11-2026: que no
  tape el café ni su terraza). Pegada al borde del edificio y con **el chófer delante del coche, del lado del muelle**
  (`chauffeurAt: 'side'` en `drawLimo`; el hotel lo sigue teniendo junto a la trasera), se ven los dos en la vista
  inicial del portal sin girar, de 360 px a escritorio (solo la punta del parachoques trasero toca el borde); el bolardo
  del muelle se va a la derecha, y el camino a pie y el sitio desde el que se mira
  la limusina en la calle 3D se mueven con ella. La placa del bajo dice el nombre del café en vez de «Se traspasa» en cuanto se inaugura.
  Lo pintado de la calle se vuelve a hacer solo si cambia lo que se ve.
- **Clientes por asientos**: en el nivel 4 pueden venir **6** al día y en el 5, **7**, pero solo con al menos tantos asientos
  colocados (silla, taburete, orejero y silla de terraza, 1; banco y sofá, 2; también los de casa); si faltan, vienen menos,
  **nunca menos de 5** (los de los niveles 1 a 3, sin cambios). El servidor lo fija al abrir el día (`cafe_clientes_dia` y
  `cafe_asientos`). Pilar lo avisa **una vez al día al entrar** y, después, cuando no hay nadie esperando, sin agobiar. El tope
  diario de reputación sube solo, con los clientes. En la escena, el banco y el sofá sientan a dos.
- **Hasta 32 cosas** en el plano desde el nivel 4 (24 antes), en la app y en el servidor.
- **La vainilla** (nivel 4, toque, 2.º hito): en la barra, **la tabla con la vaina y un cuchillo pequeño**. Gesto: **rascar
  la vaina de arriba abajo, tres trazos**, levantando el dedo entre uno y otro; las semillas negras caen en la taza.
- **El café con hielo** (nivel 5, bebida, 2.º hito): **la cubitera de latón** para elegirlo y **la coctelera de acero**. Se
  muele y se extrae como el café y después se **agita la coctelera de lado a lado** con vaivenes amplios (se escarcha y el
  hielo suena); la leche va **fría, solo servirla** (sin vapor), sin dibujo ni crema y sin humo. En la taza, los cubitos.
- **Ocho muebles nuevos** con modelo 3D e icono: nivel 4, mesa larga compartida (150), biombo de librería con tus lomos
  (180), lámpara de bankers (120) y, de hito, piano vertical (200); nivel 5, mesa de hierro (150), silla de terraza (150),
  macetero largo (180) y, de hito, farol de forja (250). Tickets, huecos de la balda e hitos, sin cambios.
- **Pruebas**: `cafe-ampliacion.rls.test.js` (6, PGlite: carta y recetas iguales a la app, asientos y clientes del día, el
  plano de 9 × 9 y la terraza iguales a `casillaValida`, el tope de 32, el escaparate y la fachada, funciones internas
  cerradas); `cafeGestos.test.js` (rascar y coctelera); e2e `v1123-cafe-ampliacion.spec.js` (el ala y su cuadrícula con un
  café con vainilla; la terraza, el escaparate con tres leídos, el aviso de los asientos y un café con hielo; la fachada desde
  la calle en la página de desarrollo `dev/calle3d.html?cafe=1`).

## 124. Los carteles de la fachada: placas de madera, esmalte y latón (1.124.0)

Encargo de Francisco del 12-11-2026, con una maqueta del portal como referencia de composición y carácter (no como textura:
no se recorta nada de ella). Solo cambian los carteles que se tocan en la fachada; la fachada, el cartel de la azotea, las
cámaras, la limusina, los menús, la navegación, la ocupación y los datos de las viviendas siguen igual.

- **Un solo constructor** (`src/features/edificio/placas.js`) para la calle 3D (`calleView.js`) y la fachada 2D sin WebGL
  (`facadeView.js`), con sus estilos en `placas.css` (se carga con él). Los botones, su sitio (los rectángulos del mundo
  proyectados en cada fotograma), sus etiquetas accesibles y sus acciones no cambian.
- **Placas de vivienda**: silueta rectangular con esquinas escalonadas (el contorno de nogal son cuatro sombras sin
  difuminar, una por lado), borde interior de latón mate, sombra dura de 2 px y dos remaches cuadrados. A la izquierda,
  el número en un compartimento de nogal con dos vetas; a la derecha, el texto real. **Libre**: esmalte marfil y texto
  marrón oscuro. **Tu piso**: esmalte verde, texto crema y una llavecita. **Un vecino**: esmalte de pergamino con su
  nombre real. Los nombres largos se cortan con puntos suspensivos y siguen enteros en la etiqueta accesible.
- **El café-librería**: rótulo de nogal con marco fino de latón, texto crema y dos sujeciones de latón de las que cuelga,
  arriba del escaparate. En traspaso, debajo, una tablilla de papel con «Se traspasa»; inaugurado, el rótulo dice el nombre
  del café y no hay aviso.
- **Al Gran Hotel**: placa de esmalte azul noche con borde de latón, texto crema, una flecha a la izquierda y una
  campanilla, bajo la limusina.
- **Iconos** (llave, flecha y campanilla): SVG de 16 × 16 en cuadrícula de píxel, con `shape-rendering: crispEdges`.
- **Colores**: los de la maqueta, el latón algo más apagado para la luz de tarde (latón #A98446, luz #CDB27A, marfil
  #ECDCB6). Sin degradados brillantes, resplandores ni desenfoque: no parecen emitir luz.
- **Letra**: Lora en negrita (la de la app), de 13 a 15 px según el ancho (`clamp` con unidades del contenedor; 14 px a
  390 px y 13 px a 360 px, donde se quita relleno antes que letra); el aviso de papel, 12 a 13 px. El ancho de cada placa
  depende de la pantalla (como mucho un 38 % del ancho), no del hueco que se toca, que cambia mientras la vista se mueve.
- **Al tocar**: lo que se toca es el balcón, el escaparate o la limusina enteros (más de 44 px de alto); al pulsar, 1 px
  abajo y menos sombra, sin rebotes. El foco del teclado se ve en el balcón y en la placa.
- **Pruebas**: e2e `v1124-placas.spec.js` (libre, tuya y un vecino con nombre largo; el café en traspaso y abierto; el
  hotel; la fachada 2D; tamaños de letra, que nada se pisa ni se sale, alto de lo que se toca, y entrar en tu piso, en el
  café y en el Gran Hotel).

## 125. El café-librería del bajo, bloque 6a: la trampilla y la bodega (1.125.0)

Cifras aprobadas por Francisco el 13-11-2026 («Sí, esas cifras»; `docs/qa/cafe-libreria.md` §14). Primer bloque del sótano:
el nivel 6, «La bodega». Los niveles 1 a 5 y sus hitos no cambian.

- **El nivel 6** empieza en 10.000 de reputación; al subir, **80 tickets** (el tope de 5 al día no cambia). Huecos de la balda,
  **48**. Hasta **8 clientes al día**, si tienen dónde sentarse (los asientos de la bodega cuentan; si faltan, vienen menos,
  sin castigo). Su tramo, como último nivel por ahora, mide 5.000 (`TRAMO_FINAL`). Hitos: 1.º el candil de pared a la venta,
  2.º sin nada nuevo de la carta (el nivel ya abre la bodega), 3.º **20 granos**.
- **La trampilla**, detrás de la barra, a la derecha de Pilar: se ve desde el nivel 6, con su anilla y la escalera alumbrada
  desde abajo. Al tocarla, la cámara anda hasta ella, se asoma y baja a lo alto de la escalera de la bodega; al subir, lo
  mismo al revés. Pilar avisa: «Cuidado con el escalón, que el tercero cruje.». Mientras se baja o se sube, la pantalla no
  responde. En la bodega, un botón de píxel «Subir al café» (escalera con flecha) arriba a la derecha, porque al llegar la
  escalera queda a la espalda.
- **La bodega**: bóveda de ladrillo con dos arcos, suelo de losas, barricas tumbadas y un botellero al fondo, dos faroles
  colgados y un ventanuco. Cuadrícula de **5 × 5**, con sus asientos y sus clientes (se les lleva el café bajando la
  escalera; preparar se hace siempre en la barra de arriba). Con movimiento reducido, se cambia de planta directo.
- **Decorar en dos plantas**: desde el nivel 6, arriba en el centro, «El café» y «La bodega» eligen la cuadrícula; al empezar,
  la de la planta en la que estás. Lo nuevo se coloca en la planta elegida; para bajar o subir algo, se cambia de planta y se
  toca una casilla. Máximo de cosas colocadas, **40** desde el nivel 6 (32 hasta el 5).
- **Muebles nuevos** (tienda del café): mesa de barrica (220 granos), banco de bodega (2 × 1, dos asientos, 260) y candil de
  pared (300, hito 1). Modelos 3D propios con su luz cálida.
- **Servidor**: migración `20261214120000_cafe_sotano.sql` (la aplica Francisco; va después de la del bloque 4b): amplía a
  nivel 8 y 10 clientes las comprobaciones, añade los tres muebles, el nivel 6 en `cafe_nivel_desde`/`cafe_nivel_de`,
  tickets, huecos, umbral de hitos y `cafe_granos_hito`, el banco de dos asientos, hasta 8 clientes y las casillas del
  sótano en `cafe_casilla_valida`/`cafe_plano_valido` (40 cosas).
- **Pruebas**: Vitest `cafe-sotano.rls.test.js` (4) y la suite del café; e2e `v1125-cafe-bodega.spec.js` (bajar, clientes de
  abajo, Decorar en la bodega, llevar un café abajo y subir; y subir al nivel 6 con su recorrido).

## 126. El café-librería del bajo: su música, un sonido por acción y la barra más ligera (1.126.0)

Tras probar la 1.125 en producción (Francisco, 13-11-2026, «esta genial»), por orden de importancia. Sin cambios de economía,
recetas ni servidor (no hay migración).

- **La música del café** (`cafe/cafeMusica.js`): propia, original y sintetizada con Web Audio, sin archivos. Un jazz lento de
  café a 72 pulsos con swing, en fa mayor: piano eléctrico cálido con trémolo, contrabajo, escobillas y bombo blando, a ratos
  una celesta, y alguna taza a lo lejos. Sin vinilo ni murmullo de fondo (Francisco: «se escucha como una lluvia de fondo que
  la empaña»), y las escobillas, cortas y suaves. Cada vuelta de ocho
  compases varía un poco. Mientras estás en el café **suena en vez de la música de Sonido** (`setMusicBlocked('cafe')`) y,
  al salir, vuelve la de siempre. Va por una salida nueva del controlador, `sceneMusicOut()`, que sigue el volumen de música,
  «Sin música», el silencio y la radio. Nunca suena antes de un gesto (si aún no se puede, lo intenta en el siguiente toque),
  entra en 2,5 s y sale en 0,9 s; mientras atiendes a un cliente baja un poco. Su nivel está igualado al de «Luz de
  escritorio» (RMS 0,083 frente a 0,085).
- **Un sonido por acción** (`cafeSfx.js`, por el bus de efectos: respeta «Sonidos táctiles», su volumen y el sonido del
  edificio). Pasos según lo andado: madera en el café (alguna tabla cruje), piedra en la bodega y losa en la acera de la
  terraza; la trampilla (bisagra y tapa) y los peldaños al bajar o subir, el tercero cruje. Pilar murmura tres sílabas (sin
  voz) al hablarle y al pasar de frase. Del cliente: la comanda (un tintineo raro si es el excéntrico), coger la taza, dejarla
  en la mesa, el libro que se desliza, una nota por estrella, los granos que caen en el tarro, la reseña dorada y la silla y
  la campanilla al despedirse. Decorar: coger, arrastrar (un roce por casilla), soltar, girar, guardar en la balda, «no
  cabe» (sin reproche), comprar (la caja registradora) y Listo. También la pizarra (tiza), los paneles (papel), el
  escaparate (cristal) y la inauguración (llaves). Los de la barra, los libros y los logros siguen como estaban.
- **La barra, más ligera** (Francisco: «las indicaciones ocupan mucho»): en la barra, el cuadro de abajo pasa a ser una
  franja (`.cf3-franja--barra`) sin retrato ni nombre, con una línea (la orden del gesto o la pregunta, con el «toca…» más
  suave), las cinco etapas en fichitas (solo la de ahora con nombre), un medidor fino y botones pequeños: de ~190 a ~125 px
  de alto a 390. El cómo de cada gesto va en una **notita de papel junto al objeto**, a un lado de la pista (o debajo si no
  cabe), que se va al empezar el gesto y no recoge toques. La comanda, más pequeña mientras preparas. Con movimiento
  reducido no hay notita («Un toque basta.» en la franja). Los lectores de pantalla siguen oyendo la ayuda entera.
- **Portadas reales** (Francisco: «Sí, haz las portadas en las fichas y el escaparate»). En las **fichas de recomendar**, la
  portada del libro (la misma imagen de tu biblioteca) centrada en la tapa y el título debajo; si no tiene o no carga (o Open
  Library devuelve un píxel vacío), la tapa de color de siempre. En el **escaparate** (nivel 5), cada portada se reduce a una
  imagen de 36 × 54 píxeles con los colores escalonados y se pinta sin suavizar sobre la cubierta del libro, en el pixel art
  de la escena (`cafe/cafePortadas.js`, una vez por URL). La primera versión, una rejilla de 10 × 15 dibujada con cubitos,
  dejaba una portada real en manchas (Francisco: «mejóralas un poco»); para leer sus píxeles pasa por Open Library directo o por `/api/portada`, como la
  imagen de las reseñas, y si no se puede, la cubierta de color. Solo en tu café: desde la fachada y para los vecinos sigue la
  cubierta de color (haría falta guardar la portada en el servidor, con migración). En las baldas, los lomos, como siempre.
- **Jornadas de prueba** (Francisco: «Quiero que mi cuenta pueda jugar todo lo que quiera para probar yo todas las funciones
  del juego y ver cosas cambiar o no»). **Migración nueva**: `20261215120000_cafe_probador.sql` (la aplica Francisco) y, a mano,
  `supabase/scripts/cafe_probador.sql` con el correo de su cuenta. Quien está en `cafe_probadores` (nadie puede añadirse desde
  la app) juega un día de prueba propio, desde el 1-1-3000 (`cafe_jornada`); con todos atendidos, Pilar lo dice y el botón
  **«Otra jornada»** (`cafe_nueva_jornada`) abre la siguiente, con sus clientes, su excéntrico y sus habituales (los de tu
  lectura de hoy también llegan). No se borra nada y lo ganado cuenta igual: granos, reputación, niveles, hitos y sus tickets;
  los tickets del día salen por jornada (como mucho 5), solo en esa cuenta. Para el resto de cuentas no cambia nada: el día
  sigue siendo hoy o ayer, sin botón. Sin la migración, el café de siempre.
- **Sin hablar de lo de antes**: Pilar ya no menciona los sobres, la reforma ni el almacén del hotel (la app la usan, por
  ahora, Francisco y su pareja).
- **Pruebas**: e2e `v1126-cafe-sonido.spec.js` (música propia y bloqueo de la de Sonido, pasos, Pilar, cada momento del
  cliente, Decorar, la franja de la barra y la notita sin tapar el objeto ni salirse; 360, 390, 430, escritorio y WebKit 390)
  y `v1119-cafe.spec.js` (las frases de Pilar); en el mismo spec, las fichas con portada y el escaparate con tres portadas en
  píxeles desde la acera (portadas de prueba servidas por la propia prueba). En WebKit de Playwright para Windows no hay Web
  Audio: ahí se comprueba qué suena, no que se oiga. Con `PORTADAS_REALES=1`, el mismo spec usa tres portadas reales de Open
  Library (de la red) y guarda las capturas con `-reales`. Jornadas: `cafe-probador.rls.test.js` (PGlite: solo la lista,
  nadie se añade, el resto sigue con hoy o ayer, otra jornada solo con todos atendidos y sin borrar nada) y, en el spec, «Otra
  jornada» con todos atendidos y su ausencia en una cuenta normal. Muestras renderizadas fuera de la app en `qa-report/v1126/`
  (`cafe-musica-1126.wav`, 75 s, y `cafe-sonidos-1126.wav`). Solo emulación: no se ha escuchado en un iPhone ni en Safari.

## 127. El café-librería del bajo, bloque 6b: el tostadero (1.127.0)

Cifras aprobadas por Francisco el 13-11-2026 («Sí, esas cifras»; `docs/qa/cafe-libreria.md` §14) y encargo del mismo día
(«Sí, el tostadero»). Segundo bloque del sótano: el nivel 7, «El tostadero». Los niveles 1 a 6 y sus hitos no cambian.

- **El nivel 7** empieza en 15.000 de reputación; al subir, **90 tickets** (el tope de 5 al día no cambia). Huecos de la
  balda, **54**. Hasta **9 clientes al día**, si tienen dónde sentarse (los de abajo cuentan). Su barra llega hasta los 21.000
  aprobados del nivel 8 (6.000), así sus hitos (16.500, 18.000 y 19.500) no se moverán cuando se abra la sala de catas. Hitos:
  1.º la estantería de latas a la venta, 2.º **el tueste de la casa** en la carta, 3.º **20 granos**.
- **La bodega crece** por la izquierda: dos columnas más de cuadrícula (**7 × 5**, columnas −2 a 4), las barricas al fondo de
  esa pared y, delante, **el tostador**: el tambor de hierro con su cara redonda, la placa de latón y la mirilla, la trampilla
  con su asa, la tolva, la chimenea hasta la bóveda, la boca del hogar encendida, la rampa y el enfriador redondo con su brazo.
  Un farol más y el resplandor del hogar. Siguen cabiendo 40 cosas.
- **El saco del día**: con el tueste en la carta, cada día hay un saco en el tambor (la mirilla se enciende y el letrero dice
  «El tostador · saco listo»; Pilar lo avisa una vez al día). Se recoge cuando quieras, sin plazo; si no lo recoges, no se
  junta más de uno. Al tocar el tostador, la cámara se pone delante de la trampilla y el gesto es **tirar del asa hacia ti
  (hacia abajo) y mantener** mientras los granos caen por la rampa al enfriador; luego el brazo los remueve solo y Pilar los
  embolsa: **5 tazas** de «tueste de la casa». Las que te quedan no caducan (como mucho 99; si no caben, el saco espera). Con
  movimiento reducido o con el teclado, un toque. Antes del 2.º hito, el tostador está frío y Pilar dice cuándo llega el primer
  saco. Sonidos propios: el tostador al acercarse, la trampilla, los granos que caen (mientras se mantiene), el enfriador, el
  saco y el tueste cobrado. La «!» sobre el asa, con las reglas de siempre (en el nivel 7, si te quedas parado 6 s).
- **El tueste de la casa en la barra**: el saco de arpillera, junto a los tarros, más o menos lleno según las tazas. Es un
  grano más del café y del café con hielo (con té o chocolate no se pide: sale intenso); se elige tocando el saco o su botón
  («Tueste de la casa · 5 tazas») y luego se muele como siempre. Sin tazas no se puede elegir. Algunos clientes lo piden
  («de tueste de la casa»; el excéntrico, «del grano que tuestas tú, abajo, en el tambor»). Servírselo a quien lo pidió gasta
  una taza y paga **+3 granos y +4 de reputación** además de lo de siempre («3 y 4 por el tueste»); a quien no, gasta la taza
  y el grano cuenta como fallo.
- **Muebles nuevos** (tienda del café): saco de arpillera (250 granos, un asiento) y estantería de latas (2 × 1, 350, hito 1).
  Modelos e iconos propios.
- **La subida al 7**: el cartel («El tostadero», 90 tickets, lo que se abre) y un recorrido que baja a la bodega y se acerca al
  tostador.
- **Arreglo**: el día que llegaba del servidor descartaba los clientes con número mayor que 7, así que con 8 en el nivel 6 se
  perdía el excéntrico (el último). Ahora admite hasta 10.
- **Servidor**: migración `20261216120000_cafe_tostadero.sql` (la aplica Francisco; va después de la del probador): los dos
  muebles; las columnas `tazas` (0 a 99) y `saco_dia` de `cafe_locales`; el nivel 7 en `cafe_nivel_desde`/`cafe_nivel_de`,
  tickets, huecos y `cafe_hito_umbral` (tramo 6.000); el tueste en `cafe_carta` (al final, para no cambiar las recetas de
  antes) y en las recetas (`cafe_granos_carta`, `cafe_receta_carta`); el saco en `cafe_asientos`; hasta 9 clientes; el sótano
  de 7 × 5 en `cafe_casilla_valida`; `tostadero` en `cafe_json`; la nueva `cafe_recoger_saco(dia)` (un saco por día; los de las
  jornadas de prueba no tapan los días de verdad) y `cafe_servir` con el tueste (sin tazas, `cafe:tueste`).
- **Pruebas**: Vitest `cafe-tostadero.rls.test.js` (8, PGlite: cifras, cuadrícula, asientos y 9 clientes, recetas iguales en la
  app y en el servidor, un saco al día, el probador, servir con tueste y su bono, y el anónimo sin permiso),
  `cafe-sotano.rls.test.js` (ajustada: el 6 ya no es el último nivel) y el gesto del tambor en `cafeGestos.test.js`; e2e
  `v1127-cafe-tostadero.spec.js` (el aviso, la bodega ancha, recoger el saco con el gesto, no hay otro el mismo día, Decorar
  y la tienda abajo, servir el tueste tocando el saco de la barra; y subir al 7 con su recorrido y el tostador frío). Solo
  emulación: no se ha probado en un iPhone ni en Safari.

## 128. El café-librería del bajo: lo nuevo en rojo, sonido más suave y la barra despejada (1.128.0)

Lista de Francisco del 13-11-2026, tras el tostadero («Sí, empieza»). Sin cambios de economía, recetas ni servidor; sin
migración.

- **128.1 La «!» roja de lo nuevo** («que aparezcan exclamaciones rojas en aquellas cosas que has desbloqueado, que desaparezca
  cuando las pulses o veas»). Distinta de la «!» ámbar de las ayudas (lo siguiente que hay que tocar): la roja dice «esto es
  nuevo». Sale en el botón **Decorar** y en la pestaña **Tienda** mientras haya un mueble nuevo a la venta; en **cada mueble
  nuevo** de la tienda (a la izquierda: a la derecha va cuántos tienes); en las **opciones nuevas de la barra** (el chocolate, la
  nata, la vainilla, el café con hielo, el tueste de la casa…); y en los **letreros de los sitios nuevos** (el escaparate, la
  trampilla y el tostador). Se va al abrir la tienda (las tarjetas la conservan hasta salir de Decorar), al elegir en ese paso
  de la barra o al tocar el sitio. Lo visto se recuerda en el dispositivo (`bookshelf:cafe-visto`, `cafeNuevo.js`); **la primera
  vez se da por visto todo lo que ya tenías**, así que solo sale para lo que se abra a partir de ahora. El lector de pantalla
  dice «nuevo». Se mueve como las ayudas (salto de dos pasos) y queda quieta con movimiento reducido.
- **128.2 La música, sin petardeo**. Menos ganancia antes del compresor (1,35 en lugar de 1,9), compresor más suave (umbral
  −18 dB, rodilla 10) y un margen de 0,82 después. Las notas que llegarían tarde (el móvil atrasa el temporizador con el 3D
  cargado) no se tocan, en vez de sonar de golpe con chasquido; si el retraso pasa de un compás, se salta lo que ya pasó; se
  programa con 2 s de margen; y cada nota se suelta al acabar (antes se quedaban enganchadas y, con el rato, saturaban el móvil).
- **128.3 Los sonidos, igualados**. Medidos uno a uno sin altavoz (`medirSonidos` en `cafeSfx.js`), la mayoría queda hacia
  −40 dB de volumen medio y sobresalían el golpe del apisonador (−24,5), la cafetera, el tostador, la jarra y la tetera (hacia
  −30) y los pasos. Cada uno lleva su ganancia y todos quedan en −34 dB o menos (mediana −40,3) sin cambiar cómo suenan. Los
  bucles, más bajos: la palanca, la tetera, los granos que caen y, sobre todo, el siseo del vapor.
- **128.4 La barra despejada** («la palanca se sigue tapando con las instrucciones; con los excéntricos tapan mucho más»).
  Durante un gesto, la comanda se pliega a su título; con el excéntrico, en «pide» se ven sus cuatro acertijos y en la barra
  solo el del paso que toca. El encuadre de la palanca deja la cafetera en el hueco libre, con la nota al lado. La e2e comprueba
  en cada gesto que ni la comanda, ni el HUD, ni la franja, ni la nota pisan el centro del objeto.
- **128.5 La cámara va hacia el cliente** («que cuando te salga el cliente al que vas a atender la cámara vaya a por él»): al
  atender, vas andando hasta él mientras te dice lo que quiere (con movimiento reducido, directo). Arreglo de paso: salir de la
  barra sin estar en ella (lo hace el panel al abrirse) o repintar el local cortaba cualquier paseo en curso.
- **128.6 Portadas que faltaban** («a mi pareja le salen así los libros»). Los libros importados de Goodreads piden la portada
  a Open Library por su ISBN y, si allí no está, se quedaban en la tapa de color. Ahora, si esa falla, se busca **la portada de
  la misma edición (el mismo ISBN, nunca otra)** en Google Books, como hace el buscador al añadir un libro, en las fichas y en
  el escaparate. Solo para enseñarla en el café: no se guarda en el libro ni cambia la biblioteca. Lo encontrado (y que no hay)
  se recuerda en el dispositivo (`bookshelf:cafe-portadas`, una semana si no hay, un mes si hay). La causa es probable, no
  comprobada con los datos de su pareja.
- **Arreglo**: el tope de clientes de la 1.127 se leía fuera de la tabla con el nivel 8 (`TOPE_CLIENTES`).
- **Pruebas**: Vitest `cafe-nuevo.test.js` (4: lo desbloqueado por reputación, la primera vez como visto, marcar y sin
  almacenamiento) y las del café (77); e2e `v1128-cafe-ajustes.spec.js` (la barra con la comanda plegada, el excéntrico con un
  acertijo y nada tapando la palanca, en cada gesto; la «!» roja en Decorar, la tienda y la barra y que se va; la cámara hacia
  el cliente; la portada de Google Books en la ficha cuando Open Library no la tiene). Solo emulación: no se ha probado en un
  iPhone ni en Safari, y el sonido se ha medido, no escuchado en un móvil.

## 129. El café-librería del bajo, bloque 6c: la sala de catas (1.129.0)

Cifras aprobadas por Francisco el 13-11-2026 («Sí, esas cifras»; `docs/qa/cafe-libreria.md` §14) y encargo del mismo día
(«Vale, ahora sigue con la sala de catas»). Tercer y último bloque del sótano: el nivel 8, «La sala de catas». Los niveles 1 a 7
y sus hitos no cambian.

- **El nivel 8** empieza en 21.000 de reputación; al subir, **100 tickets** (el tope de 5 al día no cambia). Huecos de la
  balda, **60**. Hasta **10 clientes al día**, si tienen dónde sentarse (los de abajo cuentan). Su barra mide 8.000: los hitos
  caen en **23.000, 25.000 y 27.000** («hitos hasta 27.000»). Hitos: 1.º el mapa de cafés a la venta, 2.º **el chai con
  especias y el café brûlée** en la carta, a la vez, 3.º **25 granos**.
- **La bodega crece** por la derecha y hacia delante: la cuadrícula pasa a **9 × 6** (columnas −2 a 6, filas 20 a 25). La
  escalera, que estaba donde van las columnas nuevas, **se corre a la pared nueva** (se baja y se sube por ella; el letrero
  «Subir al café» y la llegada van con ella). Al fondo de las columnas nuevas, **el mostrador de catas**: tabla de roble, dos
  baldas con tarros de cada tueste, las tazas de cata boca abajo y una balanza de latón. Un farol más y la luz del café cae por
  la escalera nueva. El tostador sigue en su sitio. Siguen cabiendo 40 cosas.
- **El chai con especias** (bebida): se elige tocando el **mortero de piedra**, al principio de la barra. Luego el té (hoja
  verde, «Chai · suave», o negra, «Chai · intenso»; nunca el tueste de la casa) y el gesto propio: **machacar las especias,
  cuatro golpes secos** (cada toque, un golpe de la mano del mortero; las especias pasan de enteras a polvo cobrizo). Después,
  la tetera y el colador como el té, y la taza toma un color cobrizo.
- **El café brûlée** (toque): se elige tocando el **azucarero**, al final de la barra, junto al soplete. El gesto: **el
  soplete en zigzag sobre la taza, sin soltar, hasta que el azúcar se dora** (seis pasadas; soltar no pierde lo hecho, y sin
  apretar la llama se apaga y no dora). La costra pasa de blanca a dorada, con puntos tostados.
- Ningún gesto falla ni tiene tiempo límite; con movimiento reducido o con el teclado, un toque. Pistas propias («golpes» y
  «zigzag»), la «!» con las reglas de siempre y sonidos propios: el mortero al elegirlo, cada golpe, el azucarero, la chispa del
  soplete y su llama mientras se aprieta. La comanda («Un chai suave…», «…y costra brûlée») y los acertijos del excéntrico.
- **Muebles nuevos** (tienda del café): butaca de cuero (300 granos, un asiento), mesa de catas (2 × 1, 360) y mapa de cafés
  (400, hito 1). Modelos e iconos propios.
- **La subida al 8**: el cartel («La sala de catas», 100 tickets, lo que se abre) y un recorrido que baja por la escalera nueva
  y se acerca al mostrador de catas.
- **Servidor**: migración `20261217120000_cafe_catas.sql` (la aplica Francisco; va después de la del tostadero): los tres
  muebles; el nivel 8 en `cafe_nivel_desde`/`cafe_nivel_de`, tickets, huecos, `cafe_hito_umbral` (tramo 8.000) y
  `cafe_granos_hito` (25); el chai y el brûlée en `cafe_carta`, `cafe_bebidas_carta` y `cafe_toques_carta` (al final, para no
  cambiar las recetas de antes); la butaca en `cafe_asientos`; hasta 10 clientes; el sótano de 9 × 6 en `cafe_casilla_valida`.
  `cafe_servir` y `cafe_receta_carta` no cambian (ya leen las listas de la carta).
- **La barra**: el mortero va al principio, antes de la caja registradora del mostrador (encima de ella la tapaba); con el
  chai en la carta, la cámara de «¿qué bebida?» se abre del mortero a la cubitera.
- **Pruebas**: `cafe-catas.rls.test.js` (7: paridad de cifras y catálogo, la cuadrícula de 9 × 6, la butaca y los 10
  clientes, las recetas con el chai, la subida al 8 con sus 100 tickets, el chai y el brûlée solo desde su hito, y los
  permisos del anónimo) y los gestos del mortero y del soplete en `cafeGestos.test.js`; `cafe-tostadero.rls.test.js` ya
  no da el 7 por último nivel. E2E `e2e-community/v1129-cafe-catas.spec.js` (la sala, la escalera nueva, Decorar en 9 × 6,
  la tienda y un chai con brûlée en la barra, en 390, 360, 430, 1440 y WebKit 390; la subida al 8, en 390 y WebKit 390),
  con la regresión de v1125, v1127 y v1128 en 390. Solo emulación: sin probar en móviles reales.

## 130. El café-librería del bajo: Pilar prepara lo que dominas y los libros, igual de importantes que el café (1.130.0)

Encargo de Francisco del 14-11-2026, tras usar más el café («que añadirias para que no se haga repetitivo el tema de preparar
todo el rato los cafés, y como integrarías mejor el tema de los libros»). Aprobado por partes: «Vale lo de pilar», «Si pero
cambia tambien como piden los clientes los libros y las categorias» y «Si, me parece bien», con un encargo expreso para el
libro: «que quiero que le pongas especial mimo de detalle, sonido, atractivo visual y mecanicas para que sea lo más divertido,
cozy y cuidado posible asi como hiciste con la preparación del café pero hasta con más esmero». Se hace todo junto («lo hacemos
en conjunto cuando este todo»). Plan, cifras e interpretaciones en `docs/qa/cafe-libreria.md` §15. Descartado (no hacer):
pedidos de grupo, «lo de siempre», clientes sin bebida, días distintos, arte latte, habituales con ficha, pistas, maridaje,
la lectura actual y la tertulia.

### 130.1 Pilar prepara lo que ya dominas

- **Dominar una bebida**: 12 servidas de 2 estrellas o más de esa bebida (café, té, chocolate, café con hielo o chai; y, para
  lo de la carta con gesto propio, el tueste de la casa, la nata, la vainilla y el brûlée). Lo cuenta el servidor (`dominio`
  en `cafe_json`); la app solo lo lee (`domina`, `pilarPuede` y `DOMINIO = 12` en `cafeLibreria.js`).
- **Tú lees la comanda y eliges la receta**, parte por parte, como siempre. Con la bebida dominada, en la barra, el bocadillo de
  Pilar (su retrato: «Esto ya lo bordas; si quieres, te lo preparo yo») con **«Que lo prepare Pilar»** y **«Lo hago yo»**. Con
  Pilar, cada gesto de la etapa lo hace ella en 3D, con los objetos de siempre moviéndose solos y sus sonidos (`cafePilar.js`:
  la postura de cada objeto en cada momento del gesto y lo que suena; la taza de café con leche y canela, unos 3 s). Con
  movimiento reducido, de una vez.
- **Siempre se puede hacer a mano**: un botón de la franja cambia entre «Prepara Pilar» y «A mano» (también a mitad, y se
  sigue a mano desde donde va). El dispositivo recuerda lo último elegido por bebida (`cafe-pilar-prepara`). **A mano
  siempre**: el excéntrico y lo recién desbloqueado de la carta, hasta dominarlo (si la taza lo lleva, Pilar hace el resto y
  esa etapa es tuya; `pilarHaceEtapa`).
- **Paga lo mismo**: lo que prepara Pilar cuenta como hecho a mano (con la receta bien, los cuatro aciertos de la bebida).
  Mientras Pilar trabaja, la barra no recoge toques.
- Al servir la que hace que domines una bebida, en el agradecimiento, la nota de Pilar («Esto ya lo bordas. La próxima vez, si
  quieres, te lo preparo yo.») con su destello y su sonido.

### 130.2 Los libros: lo que piden

- **Una sola lista de categorías**: los diez géneros de la distribuidora. **Los clientes solo piden lo que hay en la balda en
  ese momento** (`pedidosLibro(dia, balda)` en `cafeLibreria.js`): el **género** de una sección con ejemplares, una
  **extensión** que exista en ella (**corto**, hasta 300 páginas, o **largo**; un libro sin páginas vale para las dos) y **cómo
  se lo lleva** (para regalar, para leerlo aquí o para llevar). Fuera «tu favorito», «el autor que más lees», «el último que
  terminaste» y «clásico» por año. Con la balda vacía, nadie pide libro: «Solo el café», como antes.
- El pedido se fija al empezar a atender (aunque la balda cambie mientras). La comanda lleva la línea del libro con su librito
  de píxel («Misterio · corto · para regalar»); la del excéntrico, siete acertijos (cuatro de la bebida y tres del libro) y, en
  la librería, solo el del paso.

### 130.3 Los libros: buscarlo y prepararlo (la librería)

Si pide libro y hay en la balda, al terminar la taza («Llevársela») la vista va **a la estantería de la pared** (la taza espera
en la bandeja de la tabla) y el libro se hace en ella, paso a paso, siempre por el jugador (`Libreria.jsx`, `useLibreria`):

1. **La estantería por secciones**: un bloque centrado en la pared, con hasta tres secciones por balda, cada una en su hueco,
   entre dos sujetalibros y con su **placa de latón** con el nombre grabado (`estanteLibreria`). Encima, la placa que se toca,
   con dos tornillos y su entrada escalonada; solo las secciones con ejemplares. Si no cabe todo en las cuatro baldas, el bloque
   se ensancha.
2. **La sección**: la cámara se acerca. **Pasar el dedo por los lomos sin soltar**: cada uno asoma bajo el dedo, suena a madera
   y dice su título y sus páginas en una etiqueta de papel («320 págs. · largo»). **Tirar hacia abajo** del que quieras: sale de
   la balda.
3. **La tabla**: sale de la estantería una tabla con su tirador de latón y la lamparita; el libro se posa en ella con su
   **portada real** (pixelada en la escena; la ficha, con la imagen, el título, el autor, las páginas y la extensión; si la
   portada no carga, la de su ISBN en Google Books, como las fichas de la 1.128, y si tampoco, la tapa de color). «Este» u
   «Devolverlo» (vuelve a su sitio).
4. **Cómo se lo lleva**: tres objetos de la tabla con su etiqueta de estraza colgada: **el papel y el cordel** (para regalar),
   **el tarro de los marcapáginas** (para leerlo aquí) y **las bolsas** (para llevar). La cámara se corre hacia el tarro y las
   bolsas para que, en un móvil en vertical, se vean los tres.
5. **Sus gestos**, cada uno con su objeto, su pista propia, su sonido y su paso en la escena: para regalar, **desenrollar el
   papel** (y se rasga), **doblar las dos solapas** sin soltar, **el cordel, vuelta y media** alrededor del libro (y el lazo);
   para leerlo aquí, **abrir la tapa** hacia la izquierda y **meter el marcapáginas** entre las hojas; para llevar, **abrir una
   bolsa** de un toque, **meter el libro** y **doblar el borde**. Y siempre, **el sello del café**: apretar y mantener hasta que
   queda marcado. Ninguno falla ni tiene tiempo; con movimiento reducido o con el teclado, un toque por paso.
6. **A la bandeja**, con la taza («Llevárselo»): la camarera lleva las dos cosas a su mesa. «Solo el café» está en todos los
   pasos.

### 130.4 Las estrellas, el ejemplar y el agradecimiento

- **Estrellas de siete**: hasta 4 aciertos de la bebida y 3 del libro (el género, la extensión y la forma); **3 estrellas con
  los 7, 2 con 4 a 6, 1 con menos** (nunca cero; `estrellasTotal`). Los premios por estrellas no cambian. Sin libro, cuando lo
  pedía, solo cuentan los de la bebida; si no pedía libro (balda vacía), también.
- **El ejemplar**: si aciertas el género, se lo lleva y paga **+4 granos** (antes, 2); si no, vuelve a su sección.
- **El repaso** del agradecimiento, por partes: el género («✓ Fantasía» o «✗ Amor · pidió misterio»), la extensión («✓ Corto
  (120 págs.)»), la forma («✓ Para regalar») y el ejemplar («✓ Se lleva «…»» o «· «…» vuelve a su sección»); sin libro, «· Sin
  libro» o «· Hoy, solo el café».

### 130.5 El reparto de la mañana

- Al abrir un día nuevo llega sola una caja que **repone lo vendido** desde el último reparto: los mismos títulos, **hasta 10
  ejemplares, a 2 granos** cada uno, solo lo que se pueda pagar (**nunca a deber**; lo que no llega no se acumula). Lo vendido
  antes de esta versión no guardaba el título: no se repone.
- El aviso de Pilar, una vez por día y dispositivo («Ha pasado el reparto de la mañana: N libros para reponer lo que se
  llevaron, a 2 granos cada uno (X en total). Te he dejado la caja junto al mostrador.»), con su sonido; la vista se vuelve a la
  caja y su etiqueta la abre.
- **Colocar, un solo gesto**: **empujar la caja hacia arriba** y cada lomo vuela a su sección de la balda (separadas con un
  filete de latón), con un sonido por sección y el de la balda llena. Arrastrar de uno en uno y «Colocarlos todos» siguen.

### 130.6 Servidor y app

- **Migración** `20261218120000_cafe_libreria.sql` (la aplica Francisco; va después de la de la sala de catas): el libro, sus
  aciertos y si se repuso en `cafe_servicios`; el reparto en `cafe_dias`; `cafe_estrellas_total`, `cafe_reparto` (en
  `cafe_abrir_dia`), `cafe_dia_json` con el reparto y `cafe_json` con el dominio; y **`cafe_entregar(dia, cliente, receta,
  libro, libro_ok)`** (las estrellas de siete y el ejemplar, +4). `cafe_servir` no cambia, para las apps sin actualizar. Todo
  por funciones `security definer`, sin permisos directos; el anónimo no puede entregar.
- **Sin la migración**, la app sirve con `cafe_servir` como en la 1.129 (y sin reparto ni Pilar).
- **Sonidos nuevos** (sintetizados, con las reglas de siempre): la placa, cada lomo al asomar, sacarlo, la tabla, el libro en
  la tabla, devolverlo, el papel de estraza, el rasgado, cada pliegue, el cordel y el lazo, las páginas, el marcapáginas, la
  tapa al cerrarse, la bolsa, meterlo, el sello (bajar y marcar), el reparto, los lomos al ir a sus secciones y «lo bordas».
- **Pruebas**: `cafeLibreria.test.js` (7: la balda como libros, la extensión, pedidos solo de la balda, los aciertos y las
  estrellas de siete, la estantería por secciones sin salirse ni pisarse, cada placa en su hueco y Pilar), `cafe-libreria.rls.test.js` (7: paridad de
  cifras, entregar con el libro, un libro fuera de la balda, el reparto una vez y nunca a deber, el dominio y los permisos) y
  pistas únicas para los gestos nuevos en `cafeGestos.test.js`. E2E `e2e-community/v1130-cafe-libreria.spec.js` (Pilar y los
  tres clientes con las tres formas, el reparto empujando la caja y, con movimiento reducido, Pilar de una vez y el libro con
  toques) con el ayudante `cafeLibro.js`, y los specs del café de la 1.121 a la 1.129 adaptados al paso de la librería (la
  1.121, rehecha con las cifras nuevas). `v1120` esperaba tres frases de Pilar antes de las llaves y son dos desde la 1.126:
  corregido. Solo emulación: sin probar en móviles reales.

## 131. El café-librería del bajo: el libro, más cerca y más cozy, y Pilar, a mano (1.131.0)

Encargo de Francisco del 14-11-2026, tras jugar la 1.130: «quiero seguír mejorando las mecanicas de preparación de libros, me
gustan como están pero querría que la camara esté un poco más cerca y que los sonidos sean más cozy. Además quiero que cuando
pilar prepara el café ella se haga más organico y no tan robotico». Sin cambios de economía, recetas ni servidor: ni
migraciones ni cifras nuevas.

### 131.1 La cámara del libro, más cerca

- **La sección de la estantería** (`vistaLib` en `cafe3d.js`): la sección elegida ocupa el ancho de la pantalla con un margen
  más pequeño (distancia mínima 0,6 en vez de 0,75) y mira más de frente, con los lomos más grandes y en el centro del hueco
  que deja la franja de abajo.
- **La tabla**: en los gestos (papel, cordel, abrir, marcapáginas, sello…), a 0,78 de la tabla en vez de unos 1,13 (todo se
  ve alrededor de 1,5 veces más grande), desde un poco más arriba. Al elegir la forma y al abrir la bolsa, algo más lejos (1,0),
  para que el papel, el tarro y las bolsas sigan cabiendo a 390 y a 360 px; al terminar (0,86), con la bandeja y la taza
  enteras. **Meter el libro en la bolsa**: la bolsa abierta, de pie, es alta; la cámara sube con ella (0,3 más arriba) para que
  el libro que baja siga en la pantalla.

### 131.2 Los sonidos del libro, más cozy

- **Una sala propia** (`calido` en `cafeSfx.js`): todo lo de la librería suena a través de un filtro cálido (paso bajo a
  3 kHz, suave) y una sala de madera corta (eco de 0,9 s que se apaga deprisa y se oscurece), mezclada bajo el sonido seco.
  Se calcula una vez por salida de audio. El resto del café no cambia.
- **Madera y notas suaves** en lugar de chasquidos y ruido brillante: cada lomo al asomar, una nota de una escala pentatónica
  (sol, la, do, re, mi, sol, la) con un roce de papel; el cordel sube nota a nota cada vuelta y el lazo resuelve en do-mi-sol;
  el sello cae como un golpe de madera con dos notas (do y sol); la placa, la tabla, sacar y devolver el libro, el papel de
  estraza, el rasgado, los pliegues, las páginas, el marcapáginas, la tapa, la bolsa y meterlo, rehechos con el mismo
  carácter. El paso de la librería tiene su propio sonido de etapa (`libroEtapa`, dos golpes de madera).
- **Medido** (`medirSonidos` y la secuencia del libro entera, renderizada sin conexión): el centro espectral baja de unos
  840 Hz a unos 365 Hz y la energía por encima de 3 kHz, del 3,5 % al 0,1 %; los picos, iguales o más bajos (cada sonido
  entre −21 y −38 dB). Ganancias retocadas para igualarlos: bolsa 0,85, placa 0,75, papel 0,7, lomo 1,15, cordel 1,3,
  marcapáginas 1,3 y páginas 1,2. Muestras en `qa-report/v1131/sonidos-libro-antes-1130.wav` y `…-despues-1131.wav`.

### 131.3 Pilar, a mano y no a máquina

- **El ritmo de una mano** (`cafePilar.js`): el tiempo de cada gesto ya no avanza a velocidad constante. Empieza despacio, se
  suelta y acaba con suavidad (`tiempoPilar`), con un pequeño pulso distinto en cada taza; siempre hacia delante.
- **Nunca dos tazas iguales**: cada taza tiene su semilla; la duración de cada gesto varía entre −10 % y +12 %
  (`duracionPilar`) y el respiro entre uno y otro, entre unos 105 y 225 ms (`respiroPilar`).
- **Cada gesto, con su carácter**:
  - el prensador baja, se pasa un poco y vuelve;
  - la palanca se mantiene con un temblor de pulso y rebota al soltarla;
  - el colador y la canela cambian de hondura y de fuerza en cada sacudida;
  - el hilo de miel no traza un círculo perfecto;
  - la vainilla, a trazos con su pausa;
  - el mortero, arriba y golpe;
  - el soplete, con su vaivén.
  Al acabar, cada objeto queda en la misma postura que a mano (lo comprueba la prueba).
- **El sonido va con la mano**: los clics de la manivela, los golpes del mortero, las sacudidas y los plops suenan cuando la
  mano pasa por ese punto del movimiento, no a intervalos fijos; el bucle del vapor o de la tetera, solo mientras la mano
  está en ello. Suenan los mismos, ni más ni menos que antes.
- **Sus manos** (`manoPilar` en `cafe3d.js`): el puño de Pilar agarra el mango de lo que se mueve (molinillo, prensador,
  palanca, cuchara, tetera, colador, jarra, canela, miel, cazo, molinillo del chocolate, varillas, cuchillo de la vainilla,
  coctelera, maza y soplete), con la piel y el jersey mostaza de su figura (`PILAR_ASPECTO`). De la muñeca sale solo un palmo
  de manga que apunta hacia su lado de la barra y se inclina con el movimiento. **Un brazo entero cruzaba la pantalla y tapaba
  la barra**, con la cámara tan cerca, así que se descartó.
- **La cámara sigue sus manos**: mientras prepara Pilar, la cámara va gesto a gesto como a mano, en vez de quedarse en el
  enfoque de la etapa. En la etapa se quedaban fuera de plano:
  - el vapor y el vertido (se veía la balda de las jarras);
  - la canela sobre la taza, al borde;
  - la coctelera, el mortero y el soplete, del todo.
  Antes de cada gesto, **Pilar espera a que la cámara llegue** (`vistaCerca` de la escena, hasta 420 ms, `PILAR_MIRA_MS`),
  como quien alarga la mano hasta la siguiente herramienta. Si sigue en el mismo sitio, no espera. Con movimiento reducido,
  todo de una vez, como antes.

### 131.4 Pruebas

- `src/features/edificio/__tests__/cafe-pilar.test.js` (5): comprueba que el tiempo de la mano empieza en 0, acaba en 1 y
  nunca va hacia atrás; que no es lineal y cada taza es distinta; que la postura final es la de hacerlo a mano; que suenan los
  mismos sonidos que antes, sin repetirse; y que el golpe del mortero suena cuando cae la maza.
- E2E `e2e-community/v1131-cafe-pilar-manos.spec.js` (Chromium 390, evidencias): Pilar prepara un café y un té, con cada
  gesto fotografiado a media marcha, y después el libro de cada cliente, de cerca. Vídeo y capturas en `qa-report/v1131/`;
  las de la 1.130, para comparar, en `qa-report/v1131/antes/`.
- `e2e-community/v1130-cafe-libreria.spec.js`, de nuevo en Chromium 390 y 360 y en WebKit 390, con la cámara nueva. Solo
  emulación: sin probar en móviles reales.

## 132. El café-librería del bajo: fuera la pizarra y el influencer de cada nivel (1.132.0)

Encargo de Francisco del 14-11-2026, tras la 1.131 (plan en `docs/qa/cafe-libreria.md` §16, bloque 1; «Sí, empieza»), con
sus decisiones del mismo día: un influencer fijo y diseñado para cada subida, que llega al llenar la barra; el nivel sube al
despedirle, salga como salga; siempre a mano y paga como el excéntrico; el límite de tiempo es un reloj de arena de latón
(unos 2 min 30 s, sin números ni alarmas; con movimiento reducido, quieto; lo mide el servidor con margen); a tiempo y con 3★,
«el vídeo se hace viral» (3 clientes más al día siguiente y una foto firmada en la pared). Y la pizarra, fuera del todo. Lo
empezó una cuenta y lo terminó la otra (bitácora de `docs/ESTADO.md`). Migración nueva: `20261219120000_cafe_influencer.sql`.

### 132.1 Fuera la pizarra

- Sin botón ni panel en el café (`Cafe.jsx`), ni sus estilos (`cafe.css`; `.cf3-pizarra-btn` se queda: es la clase de los
  botones del HUD). La nota del habitual y la reseña dorada del excéntrico se ven en su bocadillo al despedirse; Pilar ya no
  la menciona.
- El servidor sigue guardando las reseñas (`cafe_resenas`), pero `cafe_dia_json` ya no las manda. No se borra nada.

### 132.2 El influencer de cada nivel (servidor)

- **La subida espera**: con la barra llena, la reputación de más se aparta en `cafe_locales.reputacion_espera`
  (`cafe_techo`, `cafe_apartar`, al principio de `cafe_progreso`): el nivel solo llega hasta donde lo deja el primer
  influencer sin despedir. Al despedirle, lo apartado vuelve y el café sube. Nunca se pierde nada.
- **`cafe_influencer_de`**: como mucho uno al día. El que ya se despidió ese día (`servido`); si no, el de la subida pendiente
  (`sube`); si no, en las cuentas que ya pasaron niveles, el más antiguo sin despedir (sin frenar nada).
- **`cafe_influencer_empezar(dia, nivel)`**: al ir a la barra, da la vuelta al reloj (`empezado = now()`; repetirlo no
  castiga). **`cafe_influencer_entregar(dia, nivel, receta, libro, libro_ok)`**: como `cafe_entregar`, con su receta fija. A
  tiempo si no pasan 150 + 10 segundos: paga como el excéntrico; si no, como un cliente normal. A tiempo y con 3★, viral. Le
  despide y, si era el de la subida, el café sube. Sus números son 300 + nivel.
- **Los virales**: el siguiente día que se abre después de uno viral, 3 clientes más (201 a 203) que piden de la carta y
  pagan como un cliente (`virales`, `virales_de`). Una vez por influencer.
- **El JSON**: `cafe_json` da `espera` y `fotos` (los niveles que se hicieron virales); `cafe_dia_json`, `virales`,
  `virales_de` e `influencer`. `cafe_nueva_jornada` cuenta también a virales e influencer.

### 132.3 Los siete personajes

- `cafeInfluencers.js`: del 2 al 8, cada uno con nombre, accesorio, color, aspecto, receta fija (de la carta del nivel
  anterior), libro (extensión y forma fijas; el género, de tu balda), saludo y lo que publica. Originales, sin parecerse a
  influencers reales. Las recetas del 7 (café intenso sin nada) y el 8 (café con hielo, entera y vainilla) cambian respecto a
  la tabla provisional del plan: el tueste de la casa gasta tazas y el chai y el brûlée se abren en el propio nivel 8.

### 132.4 En el café (la app)

- **Llega**: el primero de la fila, en su mesa con un aro redondo de píxeles en su color, un piloto «REC» rojo sobre la cabeza
  mientras espera y lo suyo en la cabeza y en la mano (`adornoInfluencer` en `cafe3d.js`: gorra y palo de selfi; gorro y aro de
  luz; boina y libreta roja; gorra plana y cámara; diadema de auriculares y micro; sombrerito y cuenco de cata; sombrero ancho y
  libro). Su etiqueta lleva «REC» y su color; suena `directo` (un disparo de cámara y dos notas).
- **El HUD**: con la barra llena o el influencer de la subida sin despedir, la placa dice «¡A punto de subir!» con la barra en
  oro. Pilar: «Tienes N clientes esperando, y la Bloguera del Muelle viene a grabar tu café. Cuando le despidas, el café subirá
  de nivel.»
- **Pide**: su saludo, su comanda «en directo» con «REC», su nombre y su color, y el libro que quiere. Pilar no se ofrece
  (`pilarPuede` con `excentrico`).
- **El reloj de arena** (`RelojArena.jsx`, dibujo en `cafeArena.js`): «A la barra» llama a `cafe_influencer_empezar` y, al
  confirmarlo, suena `arena` y el reloj de latón aparece arriba a la derecha (bajo el botón de los libros) con un giro. La arena
  baja por un embudo hasta un montón, con un hilo de granos por el centro; sin números ni alarmas. Se ve en la barra, en la
  librería, de camino y al servir; se va al despedirse. Para lectores de pantalla, `arenaTexto` (cinco frases sin cifras). Con
  movimiento reducido, una barra quieta de latón que se vacía (se repinta cada 2 s). El servidor mide de verdad, con su margen.
- **Al servir**: la despedida según cómo salió (viral, a tiempo o «¡Se me acabó el directo!»), una ficha de lo que publica
  con «REC» y, si fue viral, «Mañana vendrán 3 clientes por su vídeo» y «Foto firmada para tu pared» (suena `viral`). El
  cartel de la subida (`LogroCafe.jsx`) dice «La Bloguera del Muelle ha publicado «…», y se está haciendo viral.».
- **Los virales**: saludan con «¡Hola! Vengo por el vídeo de la Bloguera del Muelle. ¿Me pones esto?» más su libro.
- **Las fotos firmadas**: en la pared de la derecha, en el hueco del cartel viejo, 4 arriba y 3 abajo (una por nivel): marco de
  nogal, paspartú, la foto en su color con su cara y su pelo, y una firma; donde falta una, solo el clavo (`setFotos`).

### 132.5 Pruebas

- `cafeInfluencers.test.js` (7): fichas únicas y válidas, recetas posibles con la carta anterior, pedido del libro, orden de
  la fila, textos y el dibujo del reloj (la arena no se pierde y cae por el centro).
- `cafe-influencer.rls.test.js` (10, PGlite) y las ayudas de las pruebas de servidor del café.
- `e2e-community/cafeMock.js`: sin pizarra; con `clientes.influencer`, el tope, el influencer del día, el reloj, los virales y
  las fotos con las reglas de la migración.
- `e2e-community/v1132-cafe-influencer.spec.js`: la Bloguera viral (360 y 390), la arena acabada con movimiento reducido (360
  y 390) y los virales del día siguiente (390). Capturas y vídeos en `qa-report/v1132/`.

## 133. El café-librería del bajo: el taller de la trastienda, primera tanda (1.133.0)

Encargo de Francisco del 14-11-2026 (plan en `docs/qa/cafe-libreria.md` §16.3, bloque 2 de §16.6; «Sí, empieza»), con las
cifras aprobadas el mismo día («Sí, esas cifras del taller»): desde el nivel 3, una puerta detrás de la barra lleva al taller de
la trastienda, el banco de don Celestino. Como mucho un encargo de un cliente al día, sin caducar ni reloj; cada daño con su
gesto, su objeto y su sonido; al final, el ex libris y la ficha «antes / después». Paga 6 / 9 / 12 granos y 15 / 22 / 30 de
reputación (1★ / 2★ / 3★), aparte del tope diario y sin tickets. Pilar no restaura. Lo empezó una cuenta y lo terminó la otra
(bitácora de `docs/ESTADO.md`). Migración nueva: `20261220120000_cafe_taller.sql` (la aplica Francisco).

### 133.1 El servidor

- Tabla `cafe_encargos` (RLS sin permisos directos): el número del encargo de cada cuenta, el día que llegó, el libro (0 a 15)
  y quién lo trae (0 a 11) de las listas cerradas, sus daños, y al terminar el día, las estrellas, el mimo de cada daño y lo
  pagado.
- **`cafe_taller(dia)`**: desde el nivel 3 (`cafe:taller` si no). Devuelve el encargo pendiente; si no hay ninguno y ese día no
  ha llegado ni se ha terminado otro, llega uno nuevo. El primero de cada cuenta es siempre el Quijote con polvo, pliegue y
  título borrado (`PRIMER_ENCARGO`); los demás, libro, cliente y daños al azar (2 o 3 en los niveles 3 y 4, 3 o 4 en el 5 y el
  6, 4 o 5 desde el 7). También dice cuántos van hechos y el terminado ese día (`hoy`).
- **`cafe_restaurar(dia, n, mimo)`**: la app dice cómo quedó cada daño, en su orden (2, bien; 1, se podía mejorar). El servidor
  pone las estrellas (3 con todos bien, 2 con al menos la mitad, 1 si no; nunca cero), paga granos y reputación por
  `cafe_progreso` (con su techo del influencer y sus hitos) y devuelve el café, el día, los libros, el taller y el progreso.
  Errores: `cafe:encargo` (ya terminado o de otro) y `cafe:mimo` (mal formado).

### 133.2 La trastienda en 3D (`cafe3d.js`, `cafeLayout.js`)

- **La puerta**: baja, en la pared de la derecha detrás de la barra, con su letrero «El taller» desde el nivel 3 (y «· un
  encargo» si hay uno esperando; sin la migración, sin letrero). Al tocarla se anda hasta delante, la cámara pasa por encima de
  la barra, la puerta se abre (suena `tallerPuerta`) y se entra; al salir, al revés. Con movimiento reducido, directo.
- **El cuarto**: estrecho y bajo, aparte en el mundo como la bodega. El banco con tapete verde, la prensa de husillo, la lámpara
  de brazo con lupa, papeles jaspeados colgados, hilos, el cazo de la cola con su vaho, el hornillo del hierro de dorar, el
  ventanuco con lluvia y el polvo que flota en la luz. Don Celestino, de pie junto a su taburete, hecho a mano (§133.5).
- **El libro en el banco**: la tapa (con su tela, su adorno y el título en letra de píxel) gira sobre el lomo y deja ver la
  guarda jaspeada y la portadilla; lo pintado sale de `cafeTallerPintura.js` (polvo y moho, manchas, migas, pliegue, cola, oro
  y el ex libris). Para prensar, el libro sube, va y entra en la prensa; la platina baja con el husillo.
- **La API**: `taller(on, est)`, `setTaller(est)` (la cámara va a la vista de cada gesto: tapa, título, lomo, pliego, una
  página, prensa o ficha), `tallerPunto` (el dedo, en `u` y `v` de la tapa o de las dos páginas), `tallerMarca` y `enTaller`.

### 133.3 En la app (`Taller.jsx`)

- **Don Celestino** (retrato `DON_CELESTINO` en `cafeIconos.js`) se presenta la primera vez con dos frases y enseña el primer
  encargo; después solo comenta. Su voz (un «mm-hm» de garganta, sin palabras) suena cada vez que dice algo.
- **El encargo**: quién lo ha traído y lo que cuenta en un papelito, el libro y sus daños en fichitas. «Empezar» o «Luego».
- **Los gestos** (`cafeTallerGestos.js`), uno detrás de otro en el orden del banco, cada uno con su herramienta en la mano, su
  pista, su notita de cómo, su bucle y sus sonidos:
  - polvo y moho, la brocha: pasadas largas y suaves (el moho pide más; levanta polvo a contraluz);
  - manchas y lápiz, la goma de miga: círculos pequeños sobre cada mancha; después, barrer las migas con el canto de la mano;
  - página arrugada, la plegadera: apretar y deslizar a lo largo del pliegue, ida y vuelta;
  - lomo despegado: pincelar el lomo con cola caliente y girar el husillo de la prensa hasta el tope;
  - título borrado: apretar y mantener el hierro caliente sobre cada letra, que se enciende en oro;
  - y, al final, apretar y mantener el sello del ex libris en la guarda.
- **El mimo**: cada daño queda «bien» o «se podía mejorar» (brocha brusca, frotar fuera de la mancha, la plegadera lejos del
  pliegue, cola de más, el hierro descentrado). Al arreglar uno, su sello («¡Perfecto!» en dorado o «¡Hecho!») y lo que dice
  don Celestino: su elogio o, si se podía mejorar, «Bien hecho.» con el consejo.
- **La ficha**: el libro se cierra, suena la cartulina y, sobre el banco, la ficha «antes / después» con las dos tapas y el
  sello del ex libris; abajo, las estrellas, cómo quedó cada daño (el consejo en ámbar, nunca como fallo), lo ganado y lo que
  dice don Celestino según las estrellas. Al volver al café, «Por hoy no hay más encargos» con lo restaurado hoy.
- **Sin prisas**: «Luego» deja el encargo en el banco y lo hecho se recuerda mientras la app sigue abierta (el gesto empezado se
  repite). Nunca caduca.
- **Ayudas**: la «!» sobre lo siguiente (la mancha que queda, la letra que falta) solo si te quedas parado o con «Ayudas
  visuales: siempre» (el taller es del nivel 3 en adelante). Con movimiento reducido, un toque o el botón del atajo hace cada
  gesto de una vez y queda bien; con el teclado, Intro sobre el libro.
- **La música del taller** (`cafeTallerMusica.js`): mientras estás dentro suena en vez de la del café, con su volumen, «Sin
  música», el silencio y la radio. Guitarra de nailon lenta, bajo pulsado, violonchelo con arco, la lluvia en el cristal y las
  brasas del hornillo (§133.5); sin reloj.
- **El cartel de lo conseguido** (un hito alcanzado con la reputación del taller) espera a que vuelvas al café.

### 133.4 Pruebas

- `cafeTaller.test.js` (14): reglas, gestos, pintura y paridad con la migración.
- `cafe-taller.rls.test.js` (PGlite): permisos, el primer encargo, uno al día que no caduca, el pago y sus errores.
- `e2e-community/cafeMock.js`: con `taller`, las reglas de la migración.
- `e2e-community/v1133-cafe-taller.spec.js`: el primer encargo con don Celestino (360 y 390, vídeo con sonido a 390), otro
  día con manchas y lomo y la cola de más (390, vídeo con sonido), movimiento reducido con «Luego» a medias y el teclado (390),
  la música del taller aparte (suena sin saturar ni quedarse en un susurro; `musica-taller.wav`) y sin letrero por debajo del
  nivel 3. Capturas, vídeos y la música en `qa-report/v1133/`.

### 133.5 Tras verlo Francisco (14-11-2026)

«me gusta pero algunas acciones tardan demasiado, como quitar el polvo y me gustaría que esto tambien tuviese sus propios
sonidos y que don celestino se vea mucho más unico y que el menu del taller tenga un poco más de alma comparado con la
cafeteria normal, además de tener su propia musica como la cafeteria». Sigue siendo la 1.133.0, sin publicar. No cambian el
servidor, la migración, las cifras ni la economía.

- **Gestos más cortos** (`MEDIDAS_TALLER` en `cafeTallerGestos.js`):
  - la brocha limpia más ancho y más de una vez: unas cuatro pasadas en vez de diez o doce;
  - el moho, al 60 % de lo que limpia la brocha;
  - casi limpia la tapa, lo que queda se va con el último soplo;
  - la goma borra casi el doble en cada vuelta;
  - el hierro, 0,45 s por letra (antes 0,65), y el sello del ex libris, 0,65 s (antes 0,9).
  La brocha es ahora una paletina ancha, como la de verdad.
- **Don Celestino, hecho a mano** (`celestinoKit` en `cafe3d.js`; ya no es la figura de los clientes con un mandil):
  - calvo, con la herradura de canas y la visera verde de encuadernador;
  - cejas pobladas, gafas de media luna por las que mira por encima, nariz colorada y bigote de morsa;
  - camisa remangada con ligas negras, pajarita granate y chaleco verde botella con la cadena del reloj;
  - mandil de cuero con remaches y un bolsillo con la plegadera y un lápiz;
  - pana con el bajo vuelto y zapatos color sangre de toro;
  - un lápiz detrás de la oreja y la espalda algo cargada.
  Su retrato (`DON_CELESTINO`), a juego.
- **El menú del taller, un libro encuadernado** (`.cf3-franja--taller` en `cafe.css`), en media piel con puntas: tela verde con
  su trama, el lomo de cuero con nervios dorados a la izquierda, las puntas de cuero y un filete de oro.
  - El nombre, en un tejuelo rojo con letras doradas; el retrato, en un marco de latón con remaches.
  - Los botones: de piel con filete de oro («Empezar», «Seguir»), de latón (los de hablar) y de papel de estraza («Luego»).
  - Los daños, en etiquetas de estraza con su agujero; la cita del cliente, clavada con un alfiler.
  - La etapa de ahora lleva su cinta de registro roja, y el medidor es pan de oro sobre piel.
  En la barra, lo mismo pero más fino. Todo de píxel, sin brillos ni desenfoques.
- **Sus propios sonidos** (`cafeSfx.js`): todo lo del taller, también los bucles de la brocha, la goma, la plegadera y la cola,
  suena en **la trastienda**. Es una sala propia, más pequeña, corta y oscura que la del café y la de la librería, con el rebote
  de la pared del banco. Además:
  - don Celestino tiene voz de garganta (un «mm-hm», sin palabras) y le cruje el taburete;
  - cada cuarto de tapa limpia suena un soplo de polvo con una nota de madera que sube (`polvoClaro`, con los eventos
    `claro:1` a `claro:3` del gesto).
- **Su propia música, con más alma** (`cafeTallerMusica.js`). Ya sonaba en vez de la del café desde la 1.133, pero los vídeos de
  Playwright no tienen sonido. A la guitarra de nailon se le añade:
  - desde la segunda vuelta, un violonchelo con arco, en dos vueltas de cada tres: notas largas que van de acorde en acorde por
    el camino más corto;
  - debajo, el rumor de la lluvia en el cristal del ventanuco;
  - las brasas del hornillo, que crepitan;
  - y la cola caliente, que hace «blup».
- **Evidencias con sonido**: las pruebas con vídeo graban lo que suena en la página y lo mezclan con el vídeo usando el ffmpeg
  de Playwright. Una grabadora escucha la salida de audio sin cambiar nada. La música del taller, además, se guarda aparte
  (`musica-taller.wav`, 48 s).

### 133.6 Arreglos tras jugar la 1.133 (1.133.1, 15-11-2026; «lo que ya hay hecho subelo»)

Francisco, 15-11-2026: «La musica de la sala de don celestino se escucha con mucho ruido de fondo y en la sala principal la
musica todavia petardea. […] Tambien me gustaría que si pulsas un sitio de la sala puedas ir a el, ahora mismo no siempre hace
esa función». Sin migración ni cambios de economía, recetas o servidor.

- **La música del taller, sin ruido** (`cafeTallerMusica.js`). Fuera el rumor de la lluvia (ruido continuo entre 700 Hz y
  4 kHz, con su vaivén) y las brasas del hornillo (chasquidos de ruido). Las gotas son solo su nota de agua, sin soplo, más
  suaves y más de tarde en tarde. El arco del violonchelo, con el filtro algo más cerrado (raspaba). Ahora todo lo que suena
  tiene tono.
- **La música del café, más ligera** (`cafeMusica.js`, `ambientAudio.js`):
  - cada nota del piano, dos voces en vez de tres (fuera el brillo de campana de 2 ms);
  - el charles es un roce más bajito y aparece menos a contratiempo;
  - el pulso del contrabajo, más blando;
  - la sala dura 1,1 s en vez de 1,7, es oscura (madera, no ruido blanco), se calcula una vez por contexto y la comparte con la
    del taller;
  - el contexto de audio de la app se crea con `latencyHint: 'balanced'`, que da más colchón cuando el 3D va cargado, y con el
    de siempre si el navegador no lo admite.

  Medido en 40 s renderizados sin conexión: los saltos bruscos entre muestras pasan de 11–14 a 0. El cálculo cuesta un 15 % menos
  en el café y un 20 % menos en el taller. El pico y el volumen se quedan igual. El petardeo en un móvil de verdad no se puede
  medir aquí.
- **Tocar un sitio de la sala y llegar andando** (`cafeLayout.js`: `ruta`, `cercaLibre`, `libreEntre`; `cafe3d.js`: `walkTo`,
  `sueloBajo`):
  - El toque va a lo primero que se ve bajo el dedo: el suelo, un mueble, una mesa o la pared. No cuentan las cajas invisibles de
    lo que se toca ni los brillos. El techo no lleva a ninguna parte.
  - El camino rodea las mesas, las sillas, el mostrador y lo colocado. Es una búsqueda A* en una rejilla de 25 cm, tensada para
    ir en línea recta donde se puede.
  - Si en el sitio tocado no se puede estar, se llega al hueco libre más cercano por el lado de quien anda, y se mira hacia allí.
  - Si está cerrado (mesas y sillas sin hueco), se llega lo más cerca posible.
  - Antes se andaba en línea recta y se paraba en lo primero que había.
  - El margen para que un toque no cuente como arrastre pasa de 8 a 12 px.
  - Los paseos de la escena hasta la trampilla, el taller o la caja también usan el camino.
- **Pruebas**:
  - `src/features/edificio/__tests__/cafeRuta.test.js`: 7 casos (línea recta, rodear, mueble, sitio cerrado, fuera del local,
    tiempo de cálculo).
  - `e2e-community/v1133-1-cafe-andar.spec.js` a 360 y 390. Rodea un mueble real del plano inicial hasta el suelo de detrás, llega
    junto a una mesa tocada encima y no se mueve al tocar el techo.
  - Ganchos de prueba nuevos, solo en desarrollo: `pasos()`, `toqueEn()` y `punto()`.
- **Pendiente**: preguntar a Francisco qué mecánicas no están claras y qué se glitchea («Las mecanicas de algunas cosas no
  terminan de estar claras y algunas cosas se glitchean»).

### 133.7 El taller, lo que no se entendía y lo que se glitcheaba (1.133.2, 15-11-2026)

Francisco, 15-11-2026: «por ejemplo la de arrugar las paginas, el sello necesito que sea mas impactante y al pasar de quitar al
polvo a arrugar las paginas se glitchea la pagina». Sin migración ni cambios de economía o de servidor.

- **La página que parpadeaba al abrir el libro** (`cafe3d.js`, `libroTallerKit`). El bloque de hojas acababa justo a la altura
  de la primera página (`LIBRO_Z.pagina`). Con la tapa cerrada no se ve; al abrirla para el pliegue, la página y la cara de
  arriba del bloque se tapaban a trozos y, con la cámara moviéndose, la hoja parpadeaba (en la captura de la 1.133,
  `taller-08-plegadera`, el tercio de abajo de la página salía en un color liso). El bloque acaba ahora 3 mm por debajo.
  - La herramienta se coge al terminar de abrir (o cerrar) el libro, no mientras gira la tapa (`Taller.jsx`, `irAPaso`).
  - Los lienzos del libro se repintan solo cuando cambia lo que se pinta (`firmaVistas`), no en cada cuadro de una animación.
- **Alisar el pliegue, sin explicarlo** (`cafeTallerGestos.js`, `cafe3d.js`, `cafeTallerPintura.js`):
  - El pliegue se ve: la primera página es una malla de 60 × 84 con relieve. Sin alisar, el pliegue levanta una cresta de
    6,5 mm (y otra más baja a su lado) con su luz y su sombra, porque la lámpara está a la izquierda (`alturaPliegue`). La cresta
    se levanta al abrir la tapa; cerrada, la aplasta.
  - La plegadera es una hoja plana de hueso, tumbada a lo largo del pliegue, que va por encima de la cresta.
  - El pliegue va en ocho tramos. Cada pasada, de ida o de vuelta y aunque se levante el dedo, baja a la mitad los tramos que
    toca; con dos, quedan planos. Antes contaba la ida y vuelta entera de punta a punta y, al soltar, se empezaba otra vez.
  - Cada tramo que cede suena (`aplana`, un crujido suave) y cada tramo que queda liso da una nota que sube (`liso`).
  - La nota dice ahora «Desliza la plegadera por encima del pliegue hasta que quede plano».
  - El mimo no cambia: pegada al pliegue, bien; si se aparta, «se podía mejorar».
- **El ex libris, con golpe**:
  - Lleva el nombre del café (`cafeTallerPintura.js`, `pintarExlibris`). Es un recuadro de doble filete, con «EX LIBRIS», un
    filete de puntos con su rombo, una taza humeante sobre un libro abierto y el nombre del café, en uno a tres renglones. Sin
    nombre, «El taller». La letra de 5 px de alto tiene ya todo el alfabeto, con tildes y eñe. Mide 58 px de ancho y de 43 a 59
    de alto (antes, 31 × 35 con una prensa pequeña).
  - El sello es del tamaño de la marca (`selloTallerKit`): la goma entintada, la plancha de nogal con su cerco de latón, el taco
    y el pomo. Al apretar se aplasta.
  - Al sellar:
    - suena un golpe hondo (un bombo grave que cae, la madera y el papel) y, detrás, un acorde que se abre (`exlibris`);
    - la vista se sacude un instante (`tallerGolpe`);
    - salta un polvillo de debajo de la plancha, con un cerco claro que sale del borde;
    - el ex libris sale en grande sobre la escena, con el nombre del café, y cae con su onda (`.cf3-gesto__sellado`);
    - don Celestino dice «¡Eso es! Ya lleva la marca de la casa.».
  - El sello se queda un instante apretado, se despega ladeándose (`selloLevanta`) y deja la tinta fresca brillando un momento.
  - Al apoyarlo suena la goma sobre el papel (`selloApoya`).
  - Con movimiento reducido no hay sacudida, polvillo ni animación; el ex libris en grande sale igual.
- **Pruebas**:
  - `cafeTaller.test.js`: los tramos del pliegue, soltar sin perder nada, el relieve, el emblema y los renglones del nombre.
  - `e2e-community/v1133-cafe-taller.spec.js`, un caso nuevo a 360 y 390, con vídeo y sonido a 390:
    - la tapa al abrirse, cuadro a cuadro;
    - el pliegue con su cresta, a medias y liso;
    - el sello encima, apretando, el golpe, al levantarse y la marca fresca;
    - el ex libris pintado con varios nombres;
    - el volumen de los sonidos nuevos (`medirSonidos`).

## 134. El almacén en el ordenador, bloque 1: ofertas, lo nuevo y al almacén delante del mueble (1.134.0)

Encargo de Francisco del 15-11-2026 (plan en `docs/qa/almacen-ordenador.md`; «Sí, las recomendadas»): «querría añadir al
ordenador un apartado del almacen de muebles que avise si hay descuentos, los muebles nuevos, y que permita seguir descuentos en
muebles deseados y que de darle te lleve directamente al almacen y al mueble en cuestión». **Bloque 1 de 2, sin migración**: usa
lo que el servidor del almacén ya dice (las ofertas de `piso_almacen_estado`). Seguir muebles deseados y su descuento, «Lo que
sigues» y la «!» sobre el monitor del piso van en el bloque 2 (1.135.0), con su migración.

### 134.1 Qué es nuevo y qué avisa (`almacenAvisos.js`, reglas puras)

- Cada artículo del almacén es «de siempre» (`DE_SIEMPRE`, los 14 de la casa) o tiene fecha de llegada (`LLEGADAS`: los seis de
  «Capa y Antifaz», el 10-11-2026). Una prueba exige que ninguno se quede sin una de las dos: un mueble que entre en el almacén
  necesita su fecha.
- **Nuevo** = llegó hace 30 días o menos (`DIAS_NUEVO`), contando con el día que dice el servidor, nunca con el reloj del móvil.
  El más reciente, primero.
- Lo visto se recuerda en el dispositivo (`bookshelf:almacen-visto`), como la «!» del café (§128.1). La primera vez, lo que ya era
  nuevo cuenta como visto: nadie se estrena con un montón de avisos.
- **Las ofertas**, las de hoy del servidor (4 del día con −20 % y 1 de la semana con −50 %), la de la semana primero. Nunca las de
  mañana. Los de las habitaciones especiales no se rebajan nunca y no salen como oferta.
- `resumenAlmacen(estado, vistos)`: las ofertas, lo nuevo (con lo que está sin ver), todo con su precio de hoy y lo de la
  tarjeta: primero lo nuevo sin ver y después las ofertas, como mucho tres.

### 134.2 La tarjeta «En el almacén» del escritorio

- En el escritorio del ordenador del piso, bajo la lectura: «En el almacén», con la «!» roja si hay algo nuevo sin ver, y hasta
  tres muebles con su miniatura, su nombre, el motivo («Nuevo», «De la semana», «Del día») y su etiqueta de precio (roja, con el
  de siempre tachado; la de la semana, con borde de latón; sin oferta, de estraza). Debajo, «Ver el almacén».
- Sin nada nuevo ni ofertas, sin la migración del almacén o sin conexión, no sale: el escritorio se queda como antes y sin
  errores.
- En «Aplicaciones», un grupo «El edificio» con «Almacén» (icono de etiqueta con su cordel, `etiqueta` en `PortIcon.jsx`) y, si
  hay, «N muebles nuevos».
- Sin sonidos de aviso, notificaciones ni cuentas atrás.

### 134.3 La pantalla «Almacén» (`AlmacenOrdenador.jsx`, `almacenOrdenador.css`)

- Una ventana más del ordenador del piso (`almacen`; el dock de la experiencia anterior no cambia), que se carga aparte.
- Cabecera con el poste del directorio del almacén: «El Almacén del Puerto» y los tickets que tienes.
- **Ofertas de hoy** («Oferta de la semana · −50 % · hasta el domingo», «Oferta del día · −20 % · hasta medianoche»), **Nuevo en
  el almacén** («Nuevo · llegó el 10 de noviembre», con la «!» en lo que no habías visto) y **Todo el almacén**, por las
  secciones del directorio (cada mueble en la de su expositor principal; «No se rebaja nunca» en los de habitación especial).
  Vacíos: «Hoy no hay ofertas.» y «Nada nuevo en el último mes.».
- Al abrirla, lo nuevo pasa a visto: la «!» se ve esa vez y ya no vuelve, tampoco en la tarjeta.
- Chapas de sección dibujadas en píxel («%», estrella y etiqueta), Puerto Pixel, marcos duros, sin redondeos ni brillos. El
  número y su «%» van con un espacio sin corte (a 360 px se partía), también en el almacén: la ficha, la etiqueta del expositor,
  el directorio y el carrito.
- Mientras carga, «Mirando el almacén…»; si falla, «Reintentar». El estado del almacén se guarda 5 minutos y se vuelve a pedir
  al pasar la medianoche del servidor (`vuelve`).

### 134.4 Al almacén, delante del mueble

- Tocar un mueble (en la tarjeta o en la pantalla) abre el Gran Hotel directamente en el almacén, sin limusina, fachada ni
  paseo: la escena 3D aparece delante de su expositor, mirándolo, con su ficha abierta (`destino` en `GranHotel` y `Almacen`;
  sin 3D, la ficha directamente).
- El botón de volver dice «Al ordenador» y vuelve a donde se estaba (el escritorio o la pantalla «Almacén»), con la History API
  (`section: 'lonja'`, `select`, `from: 'ordenador'`).
- Dentro, el almacén es el de siempre: se compra, se pasea o se va a otro expositor.

### 134.5 Pruebas

- `almacenAvisos.test.js` (11): la fecha de cada artículo, la ventana de 30 días, las fechas cortas, el «hasta…», el orden y el
  precio de las ofertas (sin especiales ni desconocidos), la tarjeta, la base de lo visto y sin `localStorage`.
- `e2e-community/mockSupabase.js`: `db.almacen.hoy` fija el día del servidor.
- `e2e-community/v1134-almacen-ordenador.spec.js` (390 y 360, con vídeo):
  - el recorrido: la tarjeta y su «!», «Aplicaciones», la pantalla y sus tres secciones, el almacén delante del Reloj (oferta de
    la semana) y del Sillón de la capa, «Al ordenador», la «!» que se va y la Mesa desde la tarjeta;
  - la primera vez, sin avisos;
  - sin la migración, ni tarjeta ni errores.
  Capturas y vídeos en `qa-report/v1134/`.
- Regresión: `e2e-community/v199-almacen.spec.js` a 390 (el almacén de siempre, llegando por el hotel), en verde.
- Limitaciones: emulación de Chromium con Supabase simulado; sin probar con la cuenta real ni en móviles reales.

## 135. El almacén en el ordenador, bloque 2: seguir el precio de un mueble y la «!» del monitor (1.135.0)

Segunda y última parte del encargo de §134 («Sí, sigue al bloque 2», 15-11-2026): «que permita seguir descuentos en muebles
deseados». **Con migración** (`20261221120000_almacen_deseados.sql`, **la aplica Francisco**). Sin ella, todo funciona como en
la 1.134 (más la «!» del monitor por lo nuevo) y no se puede seguir nada: no salen el marcapáginas, «Lo que sigues» ni «Seguir
su precio».

### 135.1 El servidor (`20261221120000_almacen_deseados.sql`)

- Tabla `piso_almacen_deseados` (cuenta, mueble y cuándo), **privada**: con RLS y sin permisos para `anon` ni `authenticated`;
  solo se toca con las funciones. Nadie ve lo que sigue otra cuenta. Aparte de «Se busca» (pública, de tres y para el
  mercadillo): no la cambia.
- `piso_almacen_desear(mueble, quiere)`: seguir (`true`) o dejar de seguir (`false`) y devuelve la lista entera, la más antigua
  primero. Seguir dos veces no duplica. Solo se sigue lo que se vende en el almacén: está en el catálogo, no es de saga, tiene
  precio, no está retirado y **no es de una habitación especial** (nunca se rebajan). Si no, `almacen:deseo`. **Como mucho
  40** (`almacen:deseos`), con la fila de la cuenta bloqueada para que dos toques a la vez no se pasen.
- `piso_almacen_estado()` devuelve además `deseados` (el resto, igual que en la 1.125).

### 135.2 Las reglas (`almacenAvisos.js`, `almacenHoy.js`)

- `sePuedeSeguir(id)`, igual que el servidor (una prueba compara los dos con todo el catálogo), y `TOPE_DESEADOS = 40`.
- El resumen añade lo que sigues: primero lo rebajado hoy y después el resto, y cada fila sabe si la sigues.
- **La «!» de lo que sigues rebajado avisa una vez por oferta**: la clave es el mueble y su periodo (el día, o el lunes de la
  semana para la de −50 %). Vista esa oferta, no vuelve; si al día siguiente (o la semana que viene) lo rebajan otra vez, vuelve
  a avisar. Lo visto sigue en el dispositivo (`bookshelf:almacen-visto`, que ahora guarda lo nuevo, las ofertas y lo que ya avisó
  el monitor; lee también lo de la 1.134).
- La tarjeta del escritorio enseña primero lo que sigues rebajado («Lo sigues»), después lo nuevo sin ver y después las ofertas,
  como mucho tres. En «Aplicaciones»: «1 que sigues, rebajado» / «N que sigues, rebajados».
- El estado del almacén es uno para todo (`almacenHoy.js`): la tarjeta, la pantalla, la ficha del almacén y el monitor se
  enteran a la vez de lo que se ve o se sigue. Seguir se ve al momento y, si el servidor dice que no, vuelve como estaba con su
  mensaje.

### 135.3 Seguir: el marcapáginas

- Un marcapáginas de píxel (`Marcapaginas.jsx`): vacío, sin seguir; rojo, lo sigues. En la pantalla «Almacén», a la derecha de
  cada mueble (44 px de ancho, separado con una raya discontinua del resto de la fila, que lleva al almacén). Lo de las
  habitaciones especiales no lleva marcapáginas.
- Sección **«Lo que sigues»**, la primera: lo rebajado con su oferta y su «!»; lo demás, «Sin oferta hoy». Vacía, explica qué
  hacer: «Toca el marcapáginas de un mueble para seguir su precio: cuando lo rebajen, te avisará aquí y en el escritorio.».
- Al tocarlo, una nota pegada abajo: «Sigues el precio de X: si lo rebajan, te avisará.» / «Ya no sigues X.» o el error («Ya
  sigues 40 muebles: deja de seguir alguno para seguir este.», «Este mueble no se puede seguir.», «No se ha podido guardar.
  Inténtalo otra vez.»).
- **En el almacén**: la ficha del mueble lleva «Seguir su precio» / «Sigues su precio» junto a «Añadir al carrito», y el
  directorio marca lo que sigues con el marcapáginas y «Lo sigues» (en las ofertas, « · lo sigues»). Al abrir la ficha de algo
  que sigues rebajado, su «!» se da por vista.

### 135.4 La «!» sobre el monitor del piso

- En tu piso (con cuenta; nunca en el de un vecino ni sin cuenta), una «!» roja de píxel pequeña sobre la esquina de arriba del
  monitor (`deskAnchor` en `interior3d.js`, que proyecta esa esquina en cada fotograma: se mueve con la cámara y con el
  escritorio). Solo por lo tuyo: algo nuevo sin ver o algo que sigues rebajado.
- Se va al abrir el ordenador y no vuelve hasta que haya algo distinto (otra oferta de lo que sigues u otro mueble nuevo). No sale
  con el ordenador u otro panel abiertos ni con la cámara de cerca. Sin sonidos, notificaciones ni cuentas atrás; con movimiento
  reducido, quieta (sin la onda).
- Para lectores de pantalla: «Hay algo para ti en el almacén: míralo en el ordenador».

### 135.5 Pruebas

- `almacenDeseados.rls.test.js` (6, PGlite con todas las migraciones): sin permisos sobre la tabla ni las funciones internas;
  `sePuedeSeguir` igual en el servidor y en la app con todo el catálogo; seguir, dejar de seguir, orden y sin duplicados; lo
  especial, de saga, retirado, inexistente o nulo, rechazado; cada cuenta ve solo lo suyo; el tope de 40. Las del almacén de
  antes siguen en verde.
- `almacenAvisos.test.js` (19): además de las de §134.5, lo de la 1.134 se sigue leyendo, marcar sin haber abierto el ordenador,
  el tope y lo especial, el lunes de la semana, sin la migración, la «!» una vez por oferta y la semana siguiente, el orden de
  la tarjeta y el monitor.
- `e2e-community/mockSupabase.js`: `db.almacen.deseados` (`{ [cuenta]: [ids] }`) y `piso_almacen_desear` como la migración; sin
  `deseados`, responde como sin la migración.
- `e2e-community/v1135-almacen-deseados.spec.js`:
  - el recorrido (390 y 360, con vídeo): la «!» del monitor, la tarjeta con lo que sigues, «Aplicaciones», «Lo que sigues»,
    seguir el espejo, dejar de seguir el mapa, lo especial sin marcapáginas, «Seguir su precio» en la ficha del reloj, la marca
    del directorio, «Al ordenador» sin «!» y el piso sin la «!»;
  - una oferta avisa una vez y al día siguiente vuelve a avisar (390);
  - el tope de 40 y sin la migración de los deseados (390).
  Capturas y vídeos en `qa-report/v1135/`.
- Regresión: `v1134-almacen-ordenador.spec.js` (390 y 360) y `v199-almacen.spec.js` (390).
- Limitaciones: emulación de Chromium con Supabase simulado; sin la migración aplicada en el proyecto real; sin probar con la
  cuenta real ni en móviles reales. A 360 px, los nombres largos de «Lo que sigues» se cortan con puntos suspensivos («Mapa del
  p…»), como los de las ofertas a 390 desde la 1.134; enteros en la etiqueta accesible.

## 136. Libotown, el nombre de verdad (1.136.0 y 1.136.1)

Encargo del 15-11-2026: «BookShelf» era un nombre provisional y el definitivo es **Libotown**, con dominio propio y un logo
que pasa Francisco. Cambia la identidad visible sin perder datos de nadie. Decisiones de Francisco (15-11-2026): se escribe
«Libotown», **sin subtítulo**; la dirección actual y el dominio nuevo funcionan **a la vez** y la antigua **redirige** cuando él
y su pareja se hayan pasado; versión **1.136.0** (la 1.134 y la 1.135 son del almacén). Por bloques con capturas: 1) nombre y
textos, 2) logo e iconos, 3) dominio, 4) redirección.

### 136.1 Lo que se ve (bloque 1)

- Pestaña y app instalada (`index.html`): `<title>Libotown</title>`, `apple-mobile-web-app-title` y la descripción
  («Libotown: tu santuario de lectura mediterráneo…»). En el manifest, `name` y `short_name` son «Libotown».
- Al compartir el enlace: `og:type`, `og:site_name`, `og:title`, `og:description`, `og:locale` y `twitter:card` (`summary`).
  La imagen ya está (`libotown-compartir.jpg`, §136.5); `og:image` y `og:url` se enlazan con el dominio (bloque 3), porque
  necesitan la dirección completa.
- Textos de la app:
  - la barra del ordenador (`LaptopPanel.jsx`);
  - «Libotown está en silencio…» (`SoundPanel.jsx`);
  - la copia en archivo: se descarga como `libotown-copia-AAAA-MM-DD.json` y, si el archivo no vale, «Ese archivo no es una
    copia de Libotown.». Las copias de antes (`bookshelf-copia-…`) se siguen importando: cuenta el contenido, no el nombre;
  - «Una cita de Libotown» al compartir una cita, y el aviso de instalar (`RoomCorner.jsx`);
  - la firma de las imágenes del mes (`monthCard.js`) y de la reseña (`reviewCard.js`);
  - la radio en la pantalla de bloqueo (`radioPlayer.js`) y el autor de su música (`catalogo-radio.json`);
  - las insignias Creadora y Equipo (`huellas.js`), el error al importar un estado (`useLibrary.jsx`) y el título para
    lectores de pantalla (`App.jsx`).
- No cambian los comentarios, las páginas de `dev/` ni los documentos.

### 136.2 Lo interno se queda como está

Renombrarlo perdería datos o la sesión: no se toca sin una migración pensada y aprobada por Francisco.

- `bookshelf:v1` (la biblioteca), el resto de claves `bookshelf:*` y `bookshelf_onboarding_done`.
- `bookshelf:auth`, la sesión de Supabase: cambiarla cerraría la sesión de todos.
- El IndexedDB `bookshelf-files` (los EPUB) y `bookshelf-portadas`, y las cachés `bookshelf-` del service worker.
- La clave `bookshelf` del historial, el tipo `application/x-bookshelf` al arrastrar libros y las rutas `assets/bookshelf/`.
- `package.json`, el repositorio y los proyectos de Vercel y de Supabase.

### 136.3 El dominio (bloques 3 y 4)

- Lo guardado en el navegador es de cada dirección: en el dominio nuevo la app arranca como en un móvil estrenado.
  - Hay que entrar con la cuenta. En «Hay dos versiones distintas», elegir **«Usar estos» (En tu cuenta)**: «Subir estos»
    pisaría la biblioteca de la nube con la del móvil nuevo.
  - Vuelve lo del servidor: biblioteca, piso, café, inventario y comunidad.
  - Se quedan en la dirección antigua los EPUB (se vuelven a vincular) y su posición, los ajustes de sonido, radio y lector, los
    borradores y las portadas guardadas.
- `PRODUCTION_HOST` (`sampleLibrary.js`) solo conocía `bookshelf-wine-iota.vercel.app`. Desde el bloque 3 (§136.6) cuentan las
  tres direcciones de producción, para que `?piloto=piso` nunca cargue datos de demostración en ellas.
- `signUp` manda el correo de confirmación a `window.location.origin`: el dominio nuevo tiene que estar en las Redirect URLs de
  Supabase.

### 136.4 Pruebas

- `e2e/v1136-libotown.spec.js`, a 360 y 390:
  - la pestaña, las meta y el manifest;
  - que no aparezca ninguna clave nueva en localStorage ni «BookShelf» en la página;
  - la barra del ordenador;
  - el aviso del sonido, solo el texto (sin cuenta, el aviso del piso para iniciar sesión queda por encima);
  - la copia: se descarga con el nombre nuevo, la de antes se importa y un archivo que no vale da el mensaje nuevo;
  - la imagen de la reseña, a 390.
- `npm run build` bien; lint sin errores nuevos (los de `src/vendor/pixelfx` ya estaban).
- Sin probar en un móvil real.

### 136.5 El logo y los iconos (bloque 2)

Material de Francisco (15-11-2026, en la conversación de la tostadora; los originales están en `libotown-marca/`, fuera de git):
la cabeza del gato con su libro (fondo transparente), el logo con el nombre y la mascota de cuerpo entero (sin usar todavía).
No se dibuja nada nuevo: `scripts/libotown-iconos.mjs` lo deriva todo (`node scripts/libotown-iconos.mjs ../libotown-marca`).

- **El marrón de la marca, `#351c0e`**, el fondo del logo con nombre. Lo usan los iconos, `theme-color`, `background_color` y
  `theme_color` del manifest, la pantalla de carga y el fondo de `.sanctuary[data-home-3d]`.
- **El gato limpio**: la cabeza del original con el alfa en dos valores (umbral 110, para que no salgan halos al reducir) y
  recortada (665 × 593).
- Iconos (`public/icons/`), en PNG de paleta (el de 512 pesa 40 KB):
  - `libotown-192.png` y `libotown-512.png` («any»): el gato al 70 % sobre el marrón, a sangre;
  - `libotown-maskable-192.png` y `libotown-maskable-512.png`: al 58 %, dentro de la zona segura del recorte de Android;
  - `libotown-apple-180.png`: al 72 %, opaco (las esquinas las pone iOS);
  - `libotown.svg` (64 × 64, con el PNG de 128 dentro) y `public/favicon.ico` (16, 32 y 48), transparentes, para la pestaña.
- **La pantalla de carga**:
  - desde el primer instante, antes de que llegue la app: `index.html` trae dentro de `#root` el logo con nombre
    (`libotown-logo.webp`, 840 px, 20 KB) centrado sobre el marrón, a `min(80vw, 420px)`. React lo sustituye al arrancar;
  - «Abriendo tu piso…» (`.home-boot`, `index.css`) pone el mismo logo en el mismo sitio, con el aviso debajo de las letras:
    no hay salto entre una pantalla y otra;
  - el service worker precarga el logo y los iconos (`CORE`).
- **La imagen para compartir**: `libotown-compartir.jpg`, 1200 × 630, el logo a toda la altura sobre el marrón. Se enlaza en el
  bloque 3, porque `og:image` necesita la dirección completa.
- Fuera: `favicon.svg` (el rayo de Vite), `icon-192.png`, `icon-512.png` y `apple-touch-icon.png`. Nada más los usaba.
- **Quien ya la tiene instalada**: en el iPhone el icono no cambia solo (hay que quitar la app de la pantalla de inicio y volver a
  añadirla; los datos siguen, son de la dirección). En Android, Chrome revisa el manifest de vez en cuando y puede tardar o
  preguntar antes de cambiarlo.
- Pruebas, en el mismo `e2e/v1136-libotown.spec.js`, a 360 y 390:
  - los iconos: tamaño, «maskable», esquina opaca del marrón, el favicon y el ICO con sus tres tamaños (medidos desde Node con
    sharp: un `fetch` desde la página se cortaba al arrancar la app);
  - la pantalla de carga sin la app (se corta `src/main.jsx`): el logo centrado y del ancho previsto;
  - «Abriendo tu piso…» con el piso retenido: el aviso justo debajo de las letras del logo;
  - simulaciones rotuladas del icono instalado (Android con el recorte circular, iPhone con sus esquinas) y de la pestaña, clara
    y oscura, con el favicon real. Son dibujos de la prueba con los iconos de verdad, no capturas de un móvil.
  - 17 pasan y 1 se salta a propósito (la imagen de la reseña va solo a 390). `npm run build` bien; lint sin errores nuevos.
- Sin probar en un móvil real.

### 136.6 El dominio, libotown.es (bloque 3)

Francisco, 15-11-2026: «El dominio es libotown.es, en minúsculas. Lo he registrado en IONOS». Preguntado si el nombre también
va en minúsculas: «Libotown» (las minúsculas son del dominio y del logo; los textos no cambian). La dirección principal es
`libotown.es`; `www.libotown.es` redirige a ella (lo hace Vercel). La de antes sigue funcionando hasta el bloque 4.

- **Las direcciones, en un solo sitio**: `src/domain/direcciones.js` (`DOMINIO`, `HOST_ANTIGUO`, `HOSTS_PRODUCCION`,
  `esProduccion` y `esDireccionAntigua`). `PRODUCTION_HOST` (`sampleLibrary.js`) pasa a ser `libotown.es`, y
  `seedPilotLibrary` y el piloto de `App.jsx` usan `esProduccion`: en ninguna de las tres direcciones de producción se
  cargan datos de demostración con `?piloto=piso`.
- **Al compartir el enlace** (`index.html`): `<link rel="canonical">` y `og:url` a `https://libotown.es/`; `og:image`
  absoluta (`https://libotown.es/icons/libotown-compartir.jpg`, 1200 × 630, con su tipo, tamaño y texto alternativo) y
  `twitter:card` `summary_large_image`. Desde la dirección de antes, la vista previa también lleva a libotown.es.
- **El aviso de la mudanza** (`src/features/direccion/AvisoDireccion.jsx`), solo en `bookshelf-wine-iota.vercel.app` y solo en
  la habitación:
  - una etiqueta pequeña, «Nos mudamos a libotown.es», con el marco de papel en píxel del piso: arriba a la derecha en el piso
    3D (a la altura de «Al edificio»), y en la habitación ilustrada debajo de Cuenta, Ambiente y Guías, sin taparlos;
  - al tocarla, una nota con los pasos: abrir libotown.es (y, con la app instalada, añadirla a la pantalla de inicio desde
    allí, para que el icono nuevo tenga sus propios datos), entrar con la misma cuenta, elegir **«Usar estos»** en «En tu
    cuenta» (no «Subir estos») y volver a vincular los EPUB;
  - «Ir a libotown.es» la abre en el navegador; «Ahora no» la esconde tres días en este dispositivo
    (`bookshelf:aviso-direccion`).
- **Lo que hace Francisco** (no se puede desde aquí; nada de contraseñas):
  1. **Vercel**, proyecto de producción: Settings → Domains → añadir `libotown.es` y, cuando lo proponga, también
     `www.libotown.es` con redirección a `libotown.es`. Vercel enseña los registros DNS que necesita.
  2. **IONOS**: Dominios y SSL → `libotown.es` → DNS. Para el host `@`, el registro A con el valor que dé Vercel (cambiando
     el que trae IONOS) y fuera el AAAA de `@` si lo hay (Vercel no usa IPv6). Para `www`, un CNAME con el valor que dé
     Vercel. Los MX y TXT del correo, si los usa, no se tocan. Si hubiera un registro CAA, tiene que permitir
     `letsencrypt.org`.
  3. Esperar a que Vercel marque los dos dominios como válidos (suele tardar minutos; hasta 48 h). Vercel pone el
     certificado solo.
  4. **Supabase**, Authentication → URL Configuration: en Redirect URLs, añadir `https://libotown.es/**` y
     `https://www.libotown.es/**` sin quitar `https://bookshelf-wine-iota.vercel.app/**`; la Site URL, `https://libotown.es`.
     Si alguna plantilla de correo lleva la dirección de antes escrita, cambiarla.
  5. Después de publicar la 1.136, pasarse los dos con los pasos del aviso. Antes de publicarla, libotown.es sirve la versión
     de producción que haya, que aún no la conoce como producción: no abrir `?piloto=` en ella.
- Pruebas, en `e2e/v1136-libotown.spec.js` a 360 y 390. Playwright sirve la app local como si fuera cada dirección, sin salir a
  internet ni tocar la dirección de verdad:
  - la dirección de antes: la etiqueta y la nota, sin salirse de la pantalla ni tapar ningún botón; el enlace; y que «Ahora
    no» la esconde también al recargar;
  - el piso 3D: la etiqueta a la altura del botón de arriba;
  - libotown.es: sin aviso y sin sembrar `?piloto=piso&biblioteca=50` (en el ordenador, la misma dirección sí siembra);
  - las etiquetas para compartir y la imagen de 1200 × 630;
  - Vitest: `direcciones.test.js` y la prueba de `seedPilotLibrary` con las tres direcciones.
  - 25 pasan y 1 se salta a propósito. `npm run build` bien; lint sin avisos en lo nuevo.
- Sin probar en un móvil real ni con el dominio de verdad, que aún no apunta a Vercel.

### 136.7 La dirección de antes redirige a libotown.es (bloque 4, 1.136.1)

Francisco, 15-11-2026, con la 1.136.0 ya publicada y el dominio conectado en Vercel, IONOS y Supabase: «Hazlo ya» (sin esperar
a que él y su pareja se pasen; se le había dicho que, a partir de ahí, el icono instalado de la dirección de antes deja de servir).

- **`vercel.json`**: una redirección permanente (308) de `bookshelf-wine-iota.vercel.app` a `https://libotown.es/` con la misma
  ruta, solo para esa dirección (`has` con su host: las previews y libotown.es no cambian). Todo menos `/sw.js`, para que el
  service worker instalado allí pueda actualizarse.
- **El service worker en la dirección de antes** (`public/sw.js`, `DIRECCION_ANTIGUA`): entra sin esperar y sin guardar nada, se
  hace con las pestañas abiertas, borra sus cachés (`bookshelf-…`), las recarga (que acaban en libotown.es) y se da de baja. No
  responde a ninguna petición: todo va a la red, que redirige. **No toca localStorage ni IndexedDB**: los EPUB y lo demás se
  quedan guardados en el móvil, en esa dirección, aunque la app ya no los abra. En libotown.es el service worker es el de siempre.
- Aun antes de actualizarse, el service worker de la 1.136.0 ya deja pasar la redirección: la navegación va primero a la red.
  Sin conexión, la dirección de antes enseña lo último guardado (con el aviso de la mudanza) hasta que se actualiza.
- El icono instalado desde la dirección de antes abre libotown.es (en Android, dentro de esa ventana con la barra de la dirección).
  Para la app de Libotown con su icono, se instala desde libotown.es.
- Pruebas: `src/domain/__tests__/redireccion.test.js` (6): la regla de `vercel.json` (solo esa dirección, permanente, todas las
  rutas menos `/sw.js`, la ruta pasa entera) y el service worker cargado en un entorno simulado en cada dirección (en la de antes:
  sin esperar, borra solo sus cachés, recarga las pestañas y se da de baja, sin responder a nada; en libotown.es, igual que
  antes). `direcciones.test.js` sigue en verde, `npm run build` bien. La redirección de verdad solo se puede comprobar en Vercel,
  después de publicar.

## 137. El almacén en el ordenador sale con Libotown (1.137.0)

Francisco aprobó el bloque 2 del almacén («vale», 15-11-2026) cuando Libotown ya estaba publicada (1.136.0 y 1.136.1). La 1.134 y
la 1.135 no llegaron a salir con ese número: el almacén en el ordenador (§134 y §135) se junta con `main` y sale como **1.137.0**,
por encima de la 1.136.1.

- **Nada cambia** respecto a lo aprobado en §134 y §135, ni en Libotown (§136): el nombre, los iconos, la pantalla de carga, la
  redirección de la dirección de antes y la despedida de su service worker siguen igual (`public/sw.js` solo cambia su versión).
- Lo único que se junta a mano es la versión (`package.json`, `src/diag.js`, `public/sw.js` y la cabecera de este documento) y
  los documentos. `App.jsx` y `LaptopPanel.jsx` se juntan solos: la tarjeta y la pantalla del almacén van con el nombre nuevo.
- La migración de los deseados (`20261221120000_almacen_deseados.sql`) está aplicada en producción (15-11-2026). Sin ella, todo
  iría como en la 1.134 (más la «!» del monitor para lo nuevo).
- Pruebas, otra vez sobre la versión juntada: `almacenAvisos.test.js`, `almacenDeseados.rls.test.js`, `redireccion.test.js` y
  `direcciones.test.js`; `v1134-almacen-ordenador.spec.js` y `v1135-almacen-deseados.spec.js` a 390 y 360, y
  `v199-almacen.spec.js` a 390. Capturas y vídeos en `qa-report/v1137/`.

## 138. Las pantallas de carga, todas con la escena de Libotown (1.138.0)

Francisco, 15-11-2026: «cambia las pantallas de carga de la app para que utilicen la nueva escena de libotown y que como mucho
cambie el mensaje de adonde te redirijen». Regla nueva en `CLAUDE.md` (§1, «Pantallas de carga, siempre la escena de Libotown»).

- **Una sola pantalla de carga** (`src/ui/PantallaCarga.jsx`, estilos con `.home-boot` en `src/index.css`): la de §136.5, el
  logo de Libotown sobre el marrón `#351c0e`, centrado a `min(80vw, 420px)` como en `index.html`, y el mensaje en Lora cursiva
  debajo de las letras. Va a `document.body` y por encima de todo (`z-index: 10000`): toda la pantalla, también las barras de la
  sala que se está cargando. Lo único que cambia es el mensaje, que dice adónde vas.
- **Dónde**, con su mensaje (los de antes, salvo los que no decían adónde):
  - al abrir la app y mientras llega tu piso (el panel, tus datos y el piso 3D): «Abriendo tu piso…» (antes, el piso 3D decía
    «Entrando…» sobre fondo oscuro);
  - el edificio (el panel, la comunidad y el portal): «Abriendo el portal…» (antes, «Abriendo el portal…» y «Buscando tu
    puerta…» en una nota); si vas directo al café, «Abriendo el bajo…», y al almacén, «Abriendo el portón del almacén…»
    (`src/features/edificio/llegada.js`); al hotel, «Llegando al Gran Hotel…»;
  - el café: «Abriendo el bajo…»; la recepción del hotel: «Abriendo la puerta giratoria…»; el casino: «Bajando la escalera
    del sótano…»; la sala de lectura: «Entrando en la sala de lectura…»; el almacén: «Abriendo el portón del almacén…» (antes,
    texto dorado sobre la sala a oscuras, con sus barras encima);
  - el piso de un vecino, desde el portal o desde Comunidad: «Entrando en el piso de Bruno…» (con su nombre), y mientras no se
    sabe de quién es, «Abriendo su piso…» (antes, «Entrando…» o una nota en la hoja).
- **El fondo de arranque** (`.home-boot`, detrás de los paneles cuando la app empieza en tu piso) no repite su mensaje mientras
  hay una pantalla de carga delante (`useHayPantallaCarga`): una sola voz para los lectores de pantalla.
- **No cambian** (no son un viaje, sino algo dentro de la misma pantalla): el ascensor del hotel («Subiendo al casino…», es su
  animación), la entrada al taller (un paseo de cámara), los «Cargando…» de listas, la radio o la comunidad, el probador y
  «Abriendo el libro…» del lector EPUB.
- Se quitan los estilos de las cargas de antes (`.cf3-loading`, `.cs3-loading`, `.alm-loading`, `.sl3-loading`,
  `.rcp-loading` y `.plab-loading`).
- **Pruebas**: `e2e-community/v1138-pantallas-carga.spec.js`, seis recorridos a 390 y 360 que retienen lo que se carga (el
  módulo 3D de cada sala, el panel de la visita o los datos del portal) y miden la pantalla: una sola, el marrón, el logo, su
  tamaño y su sitio, la letra, toda la pantalla, por encima de todo (en el centro, en las esquinas y donde van las barras) y el
  mensaje debajo de las letras sin salirse. Con `ANTES=1`, las mismas fotos de la versión anterior (1.137.0) para comparar.
  `e2e/v1136-libotown.spec.js` mide «Abriendo tu piso…» en `.home-boot` o en la pantalla común; `visita-directa`, `v198` y
  `v1134` siguen en verde. `v188-habitacion-real` falla en dos casos, igual en la 1.137.0. Capturas y vídeos en
  `qa-report/v1138/`.
- Limitaciones: emulación de Chromium con Supabase simulado; sin probar en móviles reales. Si una sala no llegara a cargar
  nunca, la pantalla de carga taparía su botón de volver (como la del arranque); en Android, el botón «atrás» sigue sirviendo.

## 139. El café: la manivela bajo el dedo y de dónde salen los libros (1.139.0)

Francisco, 16-11-2026: «La parte de mecanicas de libros me gusta bastante, como sacas los libros y prepararlos es divertido, lo
que no me convence es el tema de comprar libros y que dependan exclusivamente de tu biblioteca, porque la gente que lea poco no
tendrá muchas opciones y si no tienes dinero pierdes esa parte del juego. Además la mecanica del café de mover la manivela está
dando algunos fallos ahora». Decisiones del mismo día: «Catálogo del café + los tuyos», «Reparto diario gratis» y, con las
cifras de `docs/qa/cafe-libreria.md` §17, «Sí, esas cifras». Lo de sacar y preparar el libro no cambia.

### 139.1 La manivela del molinillo, bajo el dedo

- **El fallo** («giro y no avanza», «se mueve mal»): el ángulo del giro se medía alrededor de un centro en la pantalla que
  salía de la pista de la «!», y la pista no está (o está en el sitio de antes) si tocas antes de que la cámara termine de
  acercarse. Con el centro equivocado, el giro no sumaba vueltas o el puño iba a saltos.
- **Ahora** el ángulo se mide sobre la propia pieza 3D: `manivelaBajo(x, y)` de `cafe3d.js` lanza el rayo del dedo contra el
  plano del puño, con la cámara de ese momento, y da el ángulo y la distancia al eje. `crearGesto` lo recibe como `bajoDedo`
  (solo la manivela): el puño salta bajo el dedo al tocar y sigue al dedo; tocar muy cerca del eje no cuenta. El resto de giros
  (molinillo del chocolate, batir, cordel) no cambian.
- **Pruebas**: tres nuevas en `cafeGestos.test.js` (con un centro equivocado avanza; sin `bajoDedo`, el fallo de antes; el puño
  bajo el dedo y el eje). `v1121` a 390 en verde y la captura del excéntrico, con el puño hacia el dedo.

### 139.2 El catálogo del café

- **80 libros reales**, 8 por cada uno de los 10 géneros, iguales para todos (`CATALOGO_LIBROS` en
  `src/features/edificio/cafe/cafeCatalogoLibros.js`, con clave `cat:…`, título, autoría, páginas, año, ISBN y portada de Open
  Library cuando la hay). Solo título, autoría y género de obras ajenas: nada de su texto ni de sus portadas en el código (la
  portada se pide a Open Library, como las de tu biblioteca).
- En el servidor, el mismo catálogo (`cafe_catalogo()`); la prueba de paridad lo vigila libro a libro.

### 139.3 Tus leídos, con el sello «Leído por ti»

- El café ya **no presta** los de «Leyendo» ni «Quiero leer»: tus libros son solo los leídos.
- La app manda tus leídos al entrar (`cafe_mis_titulos`, hasta 200; antes de abrir el día) para que el reparto pueda traer
  alguno; quedan en `cafe_tuyos`. Una clave `cat:` nunca pasa por tuya.
- **El sello**: en la balda y la caja del cuadro de libros, una cinta granate en la cabeza del lomo (con «leído por ti» en su
  etiqueta accesible); en la estantería 3D, la misma cinta en el lomo; en la distribuidora, la etiqueta de papel «Leído por ti»;
  y en la ficha del libro al atender.
- **Paga más**: el ejemplar tuyo que se lleva el cliente, +6 granos; el del catálogo, +4 (también con el influencer). El
  repaso dice «Se lleva «…», que lo recomiendas tú» y «6 por tu libro».

### 139.4 El reparto de la mañana, gratis

- Cada día nuevo: **6 libros en los niveles 1 y 2, 8 del 3 al 5 y 10 del 6 en adelante**, nunca más que los huecos libres
  (balda más cajas); sin hueco, no llega nada y no se acumula.
- Primero repone lo vendido desde el último reparto (lo que no cabe queda repuesto igual); después, del catálogo, procurando al
  menos 3 géneros entre la balda y la caja; si tienes leídos, **uno de cada tres** es tuyo.
- Sustituye al de la 1.130 (2 granos por ejemplar, hasta 10). Pilar lo cuenta: «Ha pasado el reparto de la mañana: N libros de
  regalo de la distribuidora. …reponen lo que se llevaron ayer. Hay … de los que has leído.»
- **La bienvenida y las cajas con granos** (de un género, 5 por 10; de un título, 3 por 9) traen del catálogo y de tus leídos;
  la bienvenida llega aunque no hayas leído nada. La distribuidora enseña los diez géneros con sus títulos (los tuyos primero).
- Lo que ya hay en la balda y en las cajas se queda.

### 139.5 Servidor

- Migración nueva **`20261222120000_cafe_catalogo.sql`** (la aplica Francisco): `cafe_catalogo`, `cafe_tuyos` (RLS, sin
  acceso directo), `cafe_mis_titulos`, `cafe_titulos_y_catalogo`, `cafe_reparto_cupo` y las redefiniciones de `cafe_reparto`,
  `cafe_comprar_caja`, `cafe_bienvenida`, `cafe_entregar` y `cafe_influencer_entregar` (copiadas de sus migraciones, solo con
  esos cambios). **Sin ella**, la app sigue como en la 1.138 salvo que ya no presta «Leyendo» ni «Quiero leer» (el reparto
  antiguo, si llega, se cuenta con su precio) y, si no tienes leídos, no pide la caja de bienvenida (llegaría vacía y se gastaría: la pide cuando la migración esté).

### 139.6 Pruebas y limitaciones

- Vitest: `cafe-catalogo.rls.test.js` (nuevo: el catálogo de la app, la paridad, sin leídos, tus leídos, +4 / +6 y permisos),
  y adaptadas `cafe-libreria`, `cafe-clientes` y `cafe-influencer` (la bienvenida mezcla el catálogo; el tuyo paga 6). Todo el
  café en verde.
- E2E: `e2e-community/v1139-cafe-catalogo.spec.js` (sin leídos y con leídos) y `v1130` adaptada (el reparto gratis, +6).
  El Supabase simulado imita la migración (sin azar: el catálogo en orden); solo con `clientes.reparto` trae reparto.
- Limitaciones: emulación de Chromium y WebKit con Supabase simulado; sin probar en móviles reales ni con la migración aplicada.

## 140. El café: la estantería, llena y apetecible (1.140, publicada con la 1.141.0)

Francisco, 16-11-2026, con una captura del móvil: «mira asi se ve en movil la estanteria, sigue viendose algo vacía. Algun
cambio le haría para que sea divertido ir a la estanteria ver todos los libros, y sacarlos para prepararlos». Decisión del
mismo día: «Repartir y vestir».

- **El fallo**: la estantería de la pared mide 3,6 m y tiene 4 baldas, pero las secciones iban en un bloque recogido en el
  centro (§130); con 12 libros, dos montoncitos en medio de un mueble enorme.
- **Repartir**: la pared es una cuadrícula de 4 filas × 3 casillas. Cada sección (un género) va en su casilla, de la columna
  del centro hacia fuera y de la fila del pecho a las de arriba y abajo (la del suelo, la última); una sección más ancha que una
  casilla toma las de al lado. Si alguna no cabe así, como antes (`colocarSecciones`). `estanteLibreria` en `cafeLibreria.js`.
- **Vestir** (`atrezzoEstante`, siempre igual para la misma balda; `atrezzoKit` en `cafe3d.js`):
  - junto a cada sección, **su libro de cara** sobre un atril, con **la portada real** en píxeles (`destacadosDe`: el primero
    con portada; se cargan con `usePortadasBalda`, como el escaparate; sin portada, su tapa de color con el título en bandas);
  - en la fila del suelo, **las cajas que esperan** (una por cada 5 ejemplares, hasta 3);
  - en el resto, **pilas tumbadas** (a veces con una taza o un reloj de arena encima), **plantas** (de hojas altas, matas con
    flores y, en las filas de arriba, potos que cuelgan por el canto), **tarros** con granos o lápices y **marcos** con
    láminas del puerto; nunca dos iguales seguidos y con aire entre una cosa y otra.
- Al atender no cambia nada: la estantería, la sección y el libro se eligen igual; la cámara encuadra las secciones.
- **Pruebas**: `cafeLibreria.test.js` (el orden de las casillas; nada se pisa ni se sale de la pared; de cara, junto a su
  sección; cajas abajo). E2E `e2e-community/v1140-cafe-estanteria.spec.js` (pocos libros, como el café de Francisco, y
  atender; muchos libros en el nivel 5). Capturas en `qa-report/cafe-estanteria/`.

## 141. Los cafés de los demás: visitas y ranking (1.141.0)

Francisco, 16-11-2026: «me gustaría que nos pusiseramos ahora con poder ver las cafeterias de los demás y poder tener un
ranking de las cafeterias que más nivel tienen y más monedas acumulan según el edificio, y más cosas que se te ocurran».
Decisiones del mismo día: «Edificio y a quien sigues», «Nivel, granos ganados y semana» y «Pasear y mirar».

### 141.1 El ranking

- **La copa** del café (debajo de los libros, a la derecha) abre «Los cafés del barrio» en la franja de abajo: dos pestañas,
  **Tu edificio** y **A quien sigues** (tú siempre sales, marcado y sin «Visitar»), y tres tablas: **Nivel** (y reputación),
  **Granos ganados** (en total, sin restar lo gastado) y **Esta semana** (la reputación desde el lunes, UTC). Los empates
  comparten puesto; los tres primeros, en latón, plata y cobre. Sin vecinos con café, lo dice.
- Solo cafés inaugurados, con la comunidad activa y sin bloqueo (como las visitas a los pisos). Los granos siguen sin pasar
  de una cuenta a otra: aquí solo se cuentan.

### 141.2 La visita

- **«Visitar»** abre el café de esa persona en 3D (`VisitaCafe.jsx`, la misma escena en solo lectura): su decoración, su nivel
  y sus plantas, el escaparate (nivel 5), las fotos de sus influencers y su estantería. Se pasea tocando el suelo y se baja a
  la bodega; nada se toca, compra ni atiende. La placa dice el café, el nivel y de quién es; «A tu café» vuelve al tuyo.
- **Privacidad**: de sus leídos en la balda solo llega el género y cuántos (lomos sin título, con la cinta); los del catálogo
  del café, enteros (con su portada de cara). El escaparate sí se ve con sus títulos: lo elige el dueño para que se vea
  desde la calle.

### 141.3 Servidor

- Migración nueva **`20261223120000_cafe_social.sql`** (la aplica Francisco): columnas `granos_ganados`, `rep_semana` y
  `semana` en `cafe_locales`, con un disparador que suma cada subida de granos o reputación (la cuente quien la cuente) y
  empieza la semana de cero cada lunes; `cafe_puedo_ver` (interna), `cafe_ranking(ambito)` y `cafe_visita(lector)`.
  **Los granos ganados cuentan desde que se aplica**: lo de antes no está guardado. Las jornadas de prueba de las cuentas de
  `cafe_probadores` también suman (no hay forma de distinguirlas sin tocar cada función).
- **Sin ella**, el ranking dice «llegará muy pronto» y el café sigue igual.

### 141.4 Pruebas y limitaciones

- Vitest: `cafe-social.rls.test.js` (el ranking de cada ámbito, ganados y semana, bloqueo y comunidad; la visita sin los
  títulos de los leídos; permisos) y `cafeSocial.test.js` (el orden y los empates; la balda de una visita).
- E2E: `e2e-community/v1141-cafe-social.spec.js` (ranking, tablas, la visita y volver; sin la migración). Capturas y vídeo en
  `qa-report/cafe-social/`.
- Limitaciones: Supabase simulado en las e2e; sin probar con cuentas reales, con la migración aplicada ni en móviles reales.

## 142. El café: solo libros de verdad, la reputación legible y el cuaderno de Pilar (1.142.0)

Francisco, 16-11-2026, tras ver la 1.141: «la estanteria solo muestra tres secciones con libros en el medio y luego a los lados
libros que no se pueden pulsar y pueden confundir. Además en los ranking no se ve bien la reputación. Tambien me gustaría añadir
la posibilidad de añadirle tareas a pilar a cambio de monedas para que pueda facilitar tareas o añadir funciones que recompensen
al jugador a la larga». Decisiones del mismo día: «Solo libros de verdad», «Mejoras para siempre», las tareas «Colocar la caja,
La hucha de propinas, La pizarra de la acera» y «Sí, esas cifras». Tras verlo, el mismo día: «que los beneficios de los encargos sean mucho más
atractivos para que la gente se sienta mucho más motivados para tenerlo como objetivos a la larga y que su interfaz sea un poco
más atractiva»; cifras «Generosos».

### 142.1 La estantería, solo con libros de verdad

- **Fuera las pilas** de libros tumbados del adorno (§140): parecían libros y no se podían tocar.
- **El libro de cara**, con su portada, va **dentro de su sección**: es un ejemplar más (el último, de pie en su atril y con la
  portada al local) y **se toca y se saca como un lomo**. Ocupa su sitio en la casilla (`estanteLibreria`, `cara: true`). Solo
  en el reparto por casillas; si no caben y se vuelve a `colocarSecciones`, todos de lomo.
- **Los huecos**, con cosas que no son libros (`ADORNOS`): plantas, tarros, marcos, **tazas en su plato, velas encendidas, un
  globo terráqueo y un molinillo de manivela**. Las cajas que esperan, abajo, como antes.

### 142.2 El ranking: la reputación, en su línea

- En cada fila, la cifra grande y debajo, en claro, de qué es: **«Nv 3» y «2.400 rep.»**; «granos»; «de rep.». Los miles con
  punto (`miles`, también con cuatro cifras). La línea del alias ya no lleva la reputación (se cortaba).

### 142.3 El cuaderno de Pilar

- **El cuaderno** del HUD (debajo de la copa) abre «El cuaderno de Pilar» en la franja de abajo: tres tareas que se le
  encargan con granos, **para siempre** (se pagan una vez, con grados, nunca caducan; 8 grados en total).
- **Cómo se ve**: Pilar en la cabecera con la barra de lo encargado («4 / 8»). Cada tarea, una hoja de libreta con su dibujo
  (la caja, la hucha de latón, la pizarra), **la escalera de grados en chapitas** (hechos en verde, el siguiente en latón y los
  de luego con el nivel que piden), lo que hace ahora y lo del grado siguiente, **«Te ha dado…»** (granos de propinas, libros
  colocados y pedidos, clientes de más) y, en la hucha, **en cuántos días se paga sola**. Al encargar, un sello de
  «¡Apuntado!» cae sobre la hoja (sin animación con movimiento reducido). Las hojas completas, con margen verde; con todo
  encargado, Pilar lo celebra.
- **Colocar la caja** (nivel 1; 60 granos): al encargarla, Pilar sube a la balda lo que espera en las cajas; y cada mañana, tras
  el reparto, también (hasta llenar los huecos; lo que no cabe se queda en la caja). 2.º grado, **«Pilar pide a la
  distribuidora»** (nivel 4; 300 granos): **3 libros más en cada reparto** (sin pasar de los huecos libres). Pilar lo cuenta en
  el aviso del reparto.
- **La hucha de propinas** (desde el nivel 2; 120 / 250 / 450 granos): **8 / 15 / 25 granos por cada día entero**, guardando
  como mucho 7 días. **Se recoge al entrar** en el café y Pilar lo dice. Al subir de grado, lo guardado se cobra al precio de
  antes.
- **La pizarra de la acera** (150 / 350 granos desde el nivel 3; 700 desde el nivel 5): **1 / 2 / 3 clientes más al día**,
  **desde el día siguiente** (el excéntrico sigue siendo el último). La reputación del día no tiene otro tope que los clientes,
  así que sube en proporción. Con ella, hasta 13 clientes al día.
- Lo cuenta y lo cobra el servidor; **nada toca los tickets**. Sin la migración, el cuaderno no sale.

### 142.4 Servidor

- Migración nueva **`20261224120000_cafe_pilar.sql`** (la aplica Francisco): columnas `pilar_caja`, `hucha`, `hucha_desde`,
  `pizarra` y lo que ha dado cada tarea (`hucha_total`, `pilar_colocados`, `pizarra_clientes`, `pilar_pedidos`) en
  `cafe_locales`; los límites de clientes, a 13; `cafe_pilar_mejorar(mejora)` y `cafe_hucha()` (para la app) y
  `cafe_pilar_coloca`, `cafe_hucha_cobrar` y las cifras (internas). Se redefinen `cafe_abrir_dia` (los clientes de la pizarra y
  Pilar colocando tras el reparto), `cafe_reparto` (lo que pide Pilar, `pilar` en el reparto) y `cafe_json` (con `pilar`). Errores nuevos: `cafe:cuaderno` y `cafe:cuaderno_nivel`.

### 142.5 Pruebas y limitaciones

- Vitest: `cafeLibreria.test.js` (el de cara, dentro de su sección y el último; ningún libro de adorno) y
  `cafe-pilar.rls.test.js` (precios, niveles y grados; la caja colocada al encargarla y al abrir el día, y los 3 libros que
  pide; la hucha, por días enteros y con su tope; la pizarra desde el día siguiente; lo que ha dado cada una; permisos).
- E2E: `v1140-cafe-estanteria.spec.js` (el de cara, entre los lomos que se tocan), `v1141-cafe-social.spec.js` (la reputación
  en su línea) y `v1142-cafe-cuaderno.spec.js` (la hucha al entrar, encargar y mejorar, la escalera de grados y lo que ha dado; la
  pizarra y el reparto pedido y colocado; todo encargado; sin la migración). Capturas en `qa-report/cafe-estanteria/`, `qa-report/cafe-social/` y `qa-report/cafe-cuaderno/`.
- Limitaciones: Supabase simulado en las e2e; sin probar con la migración aplicada, con cuentas reales ni en móviles reales.

## 143. El obrador: el horno de la tahona, el recetario y la vitrina (1.143.0)

Francisco, 17-11-2026: «una nueva mecanica que se desbloquearía a un nivel que tu consideres necesario. Vender comida, algo como
starbucks pero super cozy que de pie a mejora y tenga mecanicas adictivas y que inciten a seguir jugando». De la cadena del
ejemplo, solo el género. Plan en `docs/qa/cafe-libreria.md` §18, aprobado el mismo día (las cuatro recomendadas: nivel 4, las
cifras de la tabla, el mostrador como la hucha y solo el favorito). Esta versión es el bloque 1 de 3 (§18.12). Tras ver la
primera entrega, el mismo día, **máximo dos cosas por cliente** (§143.4).

### 143.1 El obrador del ala

- **Desde el nivel 4**, al fondo del ala lateral, un tabique de yeso con su arco de ladrillo y el letrero **«¿Y esta pared?»**.
  Al tocarlo vas hasta él y Pilar lo abre (`cafe_obrador_abrir`, una sola vez): el horno de leña de la tahona de doña Amparo
  (bóveda y dovelas de ladrillo, boca con hollín, umbral de piedra, placa de latón, campana de yeso con su chimenea), la mesa de
  mármol con su balda, el saco de harina y la leña, la pala, la campanilla y el recetario. Pilar lo cuenta en dos frases y **la
  primera hornada de la casa** (6 magdalenas) ya está en la vitrina.
- En el nivel 3, una vez en el dispositivo, Pilar lo anticipa: «Detrás de esa pared huele a pan de otro tiempo…». Solo cuando no
  tiene otra cosa que decir y tras unos segundos de calma (sin cliente, panel ni cartel abiertos): nunca pisa el reparto de la
  mañana, la hucha, el saco ni la subida. El cartel de
  la subida al 4 lo dice («El obrador: el horno de la antigua tahona y su recetario») y el letrero lleva la «!» roja de lo nuevo.
- El obrador queda fuera de la cuadrícula: no se pisa ni se decora encima.

### 143.2 El recetario

- En la franja de abajo, **un cuaderno con tapas de hule a cuadros**: una etiqueta de papel con cómo va el horno (en palabras,
  sin números) y lo que hay en la vitrina («En la vitrina: 6 de 12»), y **seis fichas de papel** con renglones, manchas de harina
  y su pinza de madera, que **se pasan de lado** (con su sonido de papel) o con las flechas.
- Cada ficha: dulce o salado, el nombre, la nota de doña Amparo, cuántas salen, el precio, sus dos gestos y si es «un ratito» o
  «un rato largo» de horno. **Se hornean ya**: magdalenas de limón (dulce; 4 a 6; 2 granos) y empanada de bonito (salada; 4 a 6
  raciones; 3 granos). Las otras cuatro dicen **en qué nivel se abren** (galletas 5, pan 6, bizcocho 7, tortilla 8; llegan en la
  1.145).

### 143.3 Los gestos, la pala y el horno

- **Magdalenas**: **rallar** el limón por el rallador de latón, en pasadas largas de arriba abajo (bien con 8 pasadas o menos), y
  **colmar** los seis moldes de papel rizado con la cuchara, una pasada de ida y otra de vuelta (bien si ninguno rebosa).
- **Empanada**: **el rodillo**, arriba y abajo de punta a punta de la masa (bien con 5 pasadas o menos), y **el repulgo**, una
  vuelta al borde de la fuente de barro con el dedo (bien con el 70 % del recorrido pegado al borde; por el centro no cuenta).
- Cada gesto, con su objeto en 3D y su cámara de cerca, su pista, su nota y la «!» como en la barra, y su sonido (el raspado, la
  masa que cae, el molde colmado o rebosado, el rodillo y su vuelta, los pellizcos que suben de tono). **Nunca falla**: Pilar dice
  cómo ha quedado («¡Bien!» o «Hecho» con el consejo). Las estrellas, las del taller (3 con los dos bien, 2 con uno, 1 si no), y
  las piezas, 6 / 5 / 4.
- **La pala**: empujarla hacia el fondo la mete en el horno (`cafe_hornear`). **Sin números ni cuenta atrás**: la hornada se
  dora poco a poco y Pilar lo dice («Ya huele…», «Se está dorando.», «Sube despacio.»). Se puede salir; **nunca se quema**. **La
  campanilla** avisa, también desde fuera (su sonido y el letrero «El obrador · ¡listo!»), y al entrar con la hornada lista se va
  directo a sacarla. **Tirar de la pala hacia ti** la saca (`cafe_sacar_hornada`) y Pilar lo lleva a la vitrina; **lo que no cabe
  espera en la bandeja**, calentito, hasta que haya sitio.
- Con movimiento reducido o con el teclado, cada gesto de un toque, y queda bien.

### 143.4 La vitrina y quien viene a por algo de comer

- En la punta de la barra, **una campana de cristal** sobre su pie de madera con un expositor de latón de dos pisos y las piezas
  (12 a la vista), en su propio material transparente.
- **Máximo dos cosas por cliente** (Francisco, 17-11-2026, tras ver la primera entrega: «se volvería muy pesado el proceso, el
  maximo lo pondría en dos»; eligió «Dos máx., 1 de cada 3»). Con el obrador abierto, **uno de cada tres** clientes viene a por
  **café y algo dulce o salado, sin libro**; los demás, a por café y un libro, como hasta ahora. Lo decide el servidor con la
  semilla del día (`cafe_pide_comida`); nunca el excéntrico ni el influencer. Lo dice al pedir («Y algo dulce para acompañar, si
  tienes.») y la comanda lleva su línea, con una magdalena de píxel: «Algo dulce para acompañar».
- **En el mismo viaje que la taza**: con la taza lista, **«A la vitrina»** en lugar de «Llevársela»; si hay más de una receta de
  lo que pide, cuál; **las pinzas de latón** cogen la pieza y la bajan al plato; y con **la taza y el plato en la bandeja**, a su
  mesa. Las pinzas son siempre del jugador: **Pilar no sirve la comida** (Francisco: «perdería la gracia»). Al servirle, la
  bebida con `cafe_entregar` y la pieza con `cafe_servir_comida` (su precio en granos). El plato se queda junto a él, en una
  mesita de pie de hierro del lado de quien sirve, y al darte las gracias la mirada gira y baja hasta él para que se vea por
  encima del cuadro (`mirarPlato`). «Solo el café» sale de la vitrina con la taza sola; sin pieza de lo que pide, la taza va directa y
  dice «¡Qué buena pinta! ¿No te queda nada dulce? No te preocupes, otro día será.»; **no pasa nada**.
- **Sus estrellas salen solo de la bebida**: 4 aciertos, 3★; 2 o 3, 2★; si no, 1★ (`cafe_estrellas_bebida`; la comida no suma
  ni resta). En las gracias, lo que dice de la pieza («Como las de mi abuela.»), su línea en el repaso («✓ Magdalenas de
  limón») y su ficha de granos («2 por la magdalena»).
- **La comida solo da granos**: nunca reputación ni tickets.

### 143.5 Servidor

- Migración nueva **`20261225120000_cafe_obrador.sql`** (la aplica Francisco): tablas `cafe_obrador`, `cafe_obrador_horno`,
  `cafe_obrador_vitrina`, `cafe_obrador_hornadas` y `cafe_obrador_ventas` (RLS, sin acceso directo). Para la app:
  `cafe_obrador(dia)` (el obrador y quién pide algo ese día), `cafe_obrador_abrir()`, `cafe_hornear(receta, mimo)`,
  `cafe_sacar_hornada(bandeja)` y `cafe_servir_comida(dia, cliente, receta)`. Internas: las cifras (`cafe_obrador_nivel`,
  `cafe_obrador_receta`, `cafe_obrador_bandejas`, `cafe_obrador_cabe`, `cafe_obrador_tope`), `cafe_estrellas_bebida`,
  `cafe_pide_comida` (uno de cada tres) y `cafe_obrador_json`. **Redefine `cafe_entregar`**, igual que en la 1.139 salvo para
  quien pide comida: sus estrellas salen de `cafe_estrellas_bebida`, un libro que llegara no cuenta ni sale de la balda, y el
  resultado dice qué pidió (`dado.comida`). `cafe_json` no cambia. Hasta 30 hornadas al día. Sacar, con 5 s de margen sobre el
  tiempo de la receta. Errores nuevos: `cafe:obrador`, `cafe:receta`, `cafe:mimo`, `cafe:hornadas`,
  `cafe:horno`, `cafe:bandeja`, `cafe:pronto`, `cafe:vitrina`, `cafe:agotado`, `cafe:comida` y `cafe:servido`.
- Sin la migración, no sale el letrero y el café va como en la 1.142.

### 143.6 Pruebas y limitaciones

- Vitest: `cafeObrador.test.js` (las cifras, el horno sin números, las piezas y lo que cabe en la vitrina, y los gestos: rallar,
  colmar, rodillo, repulgo, la pala y las pinzas; y quien pide comida: sus estrellas, su pedido y sus frases) y
  `cafe-obrador.rls.test.js` (PGlite: abrir una vez, hornear con una bandeja libre y hasta 30 al día, sacar con su margen, lo que
  no cabe se queda en la bandeja, servir comida solo a quien la pidió y una vez, **máximo dos** (sus estrellas, solo de la
  bebida; un libro que llegara no cuenta ni toca la balda; quien no pide comida sigue con su libro) y nada de acceso directo a
  las tablas).
- E2E con Supabase simulado: `e2e-community/v1143-cafe-obrador.spec.js` a 360 y 390 (el tabique, el recetario, la empanada y las
  magdalenas de principio a fin, la campanilla desde fuera, quien pide café y algo dulce: la barra, la vitrina, las pinzas y la
  bandeja con la taza y el plato hasta su mesa, y lo que no cabe en la bandeja); a 390, quien viene a por un libro no pasa por la
  vitrina, y con movimiento reducido, cada gesto de un toque. El vídeo de 390 lleva el sonido de la página
  (`e2e-community/cafeSonido.js`, la grabadora de la 1.133 sacada a un archivo para usarla en las demás pruebas).
- Regresión a 390 de lo que pasa por atender (`v1121`, `v1123`, `v1130`, `v1132`, `v1139` y `v1142`) y `npm run build`.
  `cafe-libreria.rls.test.js` › «el reparto (1.139)» falla desde la 1.142, sin relación con el obrador: `cafe_reparto` devuelve
  también `pilar` y la prueba no lo espera.
- Evidencias en `qa-report/v1143/`.
- **Sin probar** con la migración aplicada (el servidor, solo con PGlite y el simulado), con cuentas reales ni en móviles reales.

## 144. El obrador crece: las mejoras, el mostrador, la especialidad y la maestría (1.144.0)

Francisco, 19-11-2026: «Sigue con el bloque 2». Es el bloque 2 de 3 del obrador (`docs/qa/cafe-libreria.md` §18.12), con las
cifras de §18.6 y §18.9 aprobadas el 17-11-2026 y la venta del mostrador «como la hucha, guardando 7 días».

### 144.1 La caja del mostrador

- Mientras no estás, **Pilar vende de la vitrina** a la gente de la calle: por cada día entero, como mucho su cupo según el grado
  de la vitrina (4 / 6 / 9 / 12), **primero la especialidad del día** y después lo que más haya, a precio base (+1 la
  especialidad). Guarda **como mucho 7 días**, como la hucha. Las jornadas de prueba cuentan como un día más cada una.
- Al volver al café, cuando no hay otra cosa que decir, vas **delante de la caja registradora de latón** de la barra: «Mientras
  no estabas he ido vendiendo en el mostrador. Tira del cajón de la caja.» **Se tira del cajón hacia ti** (con su pista, su «!»
  y su medidor). Suenan el trinquete, el muelle y una campanita, y después **los granos tintinean** en los compartimentos. Dentro
  se ven en montoncitos. Pilar dice lo que se llevaron, en letra: «Mientras no estabas se llevaron tres magdalenas y cinco
  raciones de empanada.», y debajo, «8 piezas en 2 días: +26 granos». La vitrina queda con lo que no se vendió.
- «Luego» lo deja para otro rato, sin perder nada. Con movimiento reducido o con el teclado, un toque («Abrir el cajón»).
- Con la vitrina vacía, Pilar no pudo vender nada: se apuntan los días sin decir nada. Sin la escena en 3D, Pilar lo cobra y lo
  cuenta en su bocadillo.
- Antes de cambiar el grado de la vitrina, el servidor cobra lo que ya vendió con el grado de antes.

### 144.2 Las mejoras del obrador

- **La última página del recetario, «El obrador»**: «Mejoras de la tahona», con tus granos arriba. Una fila por mejora, con su
  dibujito (la bóveda de ladrillo con la boca encendida; la vitrina de madera y cristal), el grado que tienes con sus cuadritos,
  lo que da y el siguiente. El botón dice lo que pasa: «Mejorar · 250 granos», «Faltan 40 granos» o «En el nivel 6». Se pagan
  **una vez**, con granos, y **nunca caducan** (`cafe_obrador_mejorar`). Al comprar, un sonido de madera y un acorde cálido, y
  Pilar lo comenta («¡Qué bien suena la puerta nueva! Ahora caben más bandejas.», «Mira cuánto sitio…»).
- **El horno**: 1, restaurado (con sus grietas y una bandeja); 2, **la puerta de hierro** (250 granos, desde el nivel 4: marco
  remachado, la hoja abierta contra la pared con su ventanuco y su tirador de latón, y **dos bandejas**: dos hornadas a la vez);
  3, **los azulejos** (600, desde el 6: una franja de azulejos de flor azul bajo la boca y **tres bandejas**). Las bandejas se ven
  apiladas en la boca y la pala sube a la que toca.
- **La vitrina**, sobre la punta de la barra (sin quitar paso a nadie): 1, la campana de cristal (12 piezas); 2, **la vitrina de
  madera** (150, nivel 4: nogal, cuatro postes, balda de cristal y copete; 20 piezas); 3, **el mostrador** (350, nivel 5:
  escalonado en tres alturas con cantos de latón, de cara a los clientes y con el cristal inclinado; 30 piezas); 4, **la de dos
  alturas** (700, nivel 7: el mostrador con un segundo cuerpo encima; 40 piezas). El cristal va en su material transparente, en
  láminas finas para que no se vuelva lechoso. A la vista caben 12, 20, 18 y 28: en el mostrador, seis por balda, para que se
  distinga cada pieza; lo que no se ve también está. La cámara de las pinzas se aleja un poco con las vitrinas grandes.
- **Las vitrinas de tartas** (el mueble del nivel 2) que tengas colocadas en el café suman **6 huecos** cada una, hasta dos. La
  página lo dice («Cada vitrina de tartas que pongas en el café (en Decorar) suma 6 huecos, hasta 2.»).
- **Lo que te ha dado**, en etiquetas: cuánto cabe en la vitrina, cuánto vende Pilar al día, lo que ha vendido en el mostrador y
  por cuántos granos, las hornadas a la vez gracias al horno y las hornadas de Pilar.
- Sin la migración 2 en el servidor, la página no sale y el recetario sigue con sus seis fichas.

### 144.3 La especialidad del día

- Cada día el servidor elige **una de tus recetas abiertas** (con su semilla). Paga **+1 grano por pieza**, en la mesa y en el
  mostrador, y **más clientes la piden**: de quienes piden comida, dos de cada tres quieren su tipo (dulce o salado).
- Se ve en **una pizarrita de tiza junto a la vitrina**, con el dibujito del color de la pieza. En el recetario, su ficha lleva el
  canto dorado y la tablilla «Especialidad de hoy». Al servir, va la primera entre lo que hay y su botón dice «· de hoy».

### 144.4 La maestría y «Que lo hornee Pilar»

- Cada receta, con sus hornadas de 2★ o más: **★ con 3** (una pieza más por bandeja), **★★ con 10** (un grano más por pieza
  servida en la mesa) y **★★★ con 25** («Que lo hornee Pilar»). En la ficha, tres estrellas de horno y lo que falta: «6 hornadas
  buenas más: un grano más por pieza servida en la mesa.». Con ★★★, «Pilar la hace de memoria.» y **la ficha se dora**. Lo que
  sale y lo que paga en la ficha ya cuenta la maestría y la especialidad.
- **«Que lo hornee Pilar»** (con ★★★, junto a «Hornear»): Pilar dice «Déjamelo a mí, que esta me la sé de memoria.» y **sus manos
  hacen los gestos en 3D** (`cafe_hornear_pilar`): el mismo reconocedor que a mano, con un trazo de mano (`trazoPilar`), así que
  suenan y se ven igual; nunca dos iguales. Rallar, colmar (o el rodillo y el repulgo) y la pala, en unos 3 s, con la cámara
  siguiendo cada objeto. La hornada sale como una de 3★. Sacarla sigue siendo tuyo. Con movimiento reducido, de una vez. Siempre
  se puede hornear a mano.

### 144.5 Servidor

- Migración nueva **`20261226120000_cafe_obrador_mejoras.sql`** (la aplica Francisco). Columnas nuevas en `cafe_obrador` (desde
  cuándo cuenta el mostrador, la jornada de prueba y lo que ha dado) y en `cafe_obrador_hornadas` (la bandeja y si la horneó
  Pilar). Para la app: `cafe_obrador_mejorar(mejora, dia)`, `cafe_mostrador(dia)` y `cafe_hornear_pilar(receta)`. Internas: las
  cifras (`cafe_obrador_precio`, `cafe_obrador_mejora_nivel`, `cafe_obrador_cupo`, `cafe_obrador_tartas`,
  `cafe_obrador_tarta_huecos`, `cafe_obrador_maestria`, `cafe_obrador_recetario`), y además `cafe_obrador_buenas`,
  `cafe_obrador_capacidad`, `cafe_obrador_especialidad`, `cafe_mostrador_dias`, `cafe_mostrador_cobrar` y `cafe_hornear_de`.
  **Redefine** `cafe_pide_comida` (el sesgo de la especialidad), `cafe_obrador_json` (cabe con las tartas, cupo, mostrador,
  recetas con su maestría y lo que ha dado), `cafe_obrador` (la especialidad), `cafe_hornear` (la pieza de más con ★),
  `cafe_sacar_hornada` (lo que cabe con las tartas) y `cafe_servir_comida` (+1 especialidad, +1 con ★★). Errores nuevos:
  `cafe:obrador_mejora`, `cafe:obrador_nivel` y `cafe:maestria`. La comida sigue dando **solo granos**.
- Sin la migración, el obrador va como en la 1.143.

### 144.6 Pruebas y limitaciones

- Vitest: `cafeObrador.test.js` (las mejoras, las tartas, la maestría, la especialidad, la frase del mostrador y **el trazo de
  Pilar**, que acaba cada gesto bien hecho a 360, 390 y 430 y con las medidas de la escena) y `cafe-obrador-mejoras.rls.test.js`
  (PGlite: cifras iguales que en la app, el horno, la vitrina, las tartas, el mostrador con su orden y su tope de 7 días, las
  jornadas de prueba, la especialidad y su sesgo, la maestría y los permisos). `cafe-obrador.rls.test.js`, al día con la
  especialidad.
- E2E con Supabase simulado: `e2e-community/v1144-cafe-obrador-mejoras.spec.js` a 360 y 390 (la caja y el cajón, las fichas con la
  maestría y la especialidad, las dos mejoras compradas, Pilar rallando y colmando y la vitrina de madera; la vitrina y el horno
  grado a grado) y, a 390, con movimiento reducido (el cajón y Pilar de un toque). El vídeo de 390 lleva el sonido de la página.
  `v1143-cafe-obrador.spec.js` sigue pasando a 360 y 390 (cuenta solo las fichas de receta).
- `cafe-libreria.rls.test.js` › «el reparto (1.139)» sigue fallando desde la 1.142, sin relación.
- Evidencias en `qa-report/v1144/`.
- **Sin probar** con la migración aplicada (solo PGlite y el simulado), con cuentas reales ni en móviles reales.

## 145. El recetario crece: galletas, pan, bizcocho y tortilla, los hitos, el favorito y el acertijo (1.145.0)

Francisco, 22-11-2026: «Termina el obrador 1.145». Es el bloque 3 de 3 del obrador (`docs/qa/cafe-libreria.md` §18.12), con
las cifras de §18.6 y §18.9 aprobadas el 17-11-2026. Lo empezó la otra cuenta el 19-11 (ver la bitácora); aquí se termina, se
prueba y se le pone versión. La 1.145.0 lleva también, porque comparten el árbol y los archivos del café, Libo, el gato guía
(bloques 1 a 4; `docs/qa/libo.md`) y el bloque 2 de la Play Store (borrar la cuenta, 16 años y páginas legales en borrador;
`docs/qa/play-store.md`), con sus propios documentos y pendientes del visto bueno de Francisco.

### 145.1 Las cuatro recetas nuevas

- Las seis páginas del recetario ya se hornean, cada una desde su nivel: **las galletas del puerto** (nivel 5; dulce, 2 granos,
  de 6 a 8 por hornada, un ratito), **el pan de la bodega** (6; salado, 4 granos, de 6 a 8), **el bizcocho del tostadero** (7;
  dulce, 4 granos, un rato largo) y **la tortilla de patatas** (8; salada, 5 granos, al fogón). Cada una con **dos gestos
  propios**, su objeto en la mesa y sus sonidos sintetizados (`cafeSfx.js`, con las reglas de efectos de siempre):
  - galletas: **los cortapastas de hojalata** (cuatro cortes en la hoja de masa: un ancla, un barco, una estrella de mar y el faro)
    y **la manga de glasa** (seguir la raya de puntos en ola, sin despegarse);
  - pan: **amasar** sobre el mármol enharinado (cuatro empujones con la palma, todos iguales) y **greñar** con la cuchilla (un solo
    tajo curvo, de punta a punta);
  - bizcocho: **envolver la masa** con la espátula en el bol de loza (tres trazos en jota) y **espolvorear el azúcar** con el tamiz
    sobre la plantilla del ancla (de lado a lado, hasta cubrirla);
  - tortilla: **cascar los tres huevos** (un toque en el borde del bol y abrirlo hacia un lado) y **darle la vuelta** con el plato
    (media vuelta alrededor de la sartén de hierro, decidida y sin parar).
- **El pan duerme una noche en la bodega**: «Amasar» (no hace falta horno libre) deja la masa en su cesto de mimbre con su paño
  («Al cesto de mimbre, con su paño, y a la bodega fresca. Mañana habrá subido.»). Su ficha dice «La masa duerme en la bodega.
  Mañana se greña.» y el botón, apagado, «Durmiendo en la bodega». Al día siguiente (o en la jornada de prueba siguiente), «La masa
  ha subido bajo su paño: ya se greña.» y «Greñar y hornear»: el greñado y la pala. Las estrellas del pan cuentan el amasado de
  ayer y el greñado de hoy. Con ★★★, «Que lo amase Pilar» y después «Que lo hornee Pilar».
- **La tortilla, al fogón** de hierro (desde el nivel 8), en el rincón entre la pared y el horno: se desliza del plato a la sartén
  («A la sartén», empujando el plato), cuaja con su chisporroteo y se saca tirando de la sartén. Ocupa una bandeja como cualquier
  hornada. La cámara mira el fogón desde arriba (por delante lo tapa el costado de las estanterías altas).

### 145.2 Los hitos del obrador

- Por **piezas vendidas en total** (en la mesa y en el mostrador): **25, 100, 250, 500 y 1000**. Cada hito da **20 granos** (nunca
  reputación ni tickets) y **un adorno fijo** en el obrador: los cazos de cobre sobre la mesa, la ristra de moldes en la cara del
  horno, el letrero pintado en la campana, **la campanilla del mostrador** (desde ahí suena al vender) y el retrato de doña Amparo.
- Al llegar, suena `hitoObrador` y Pilar lo dice en su bocadillo («Veinticinco vendidas: he colgado los cazos de cobre de la
  tahona…»). En la última página del recetario, la lista de los cinco con su adorno, sus granos, los hechos marcados y «Vendidas:
  N · faltan X para el siguiente».
- Las visitas ven el obrador del café que visitan con su horno, su vitrina y sus adornos (solo mirar).

### 145.3 El favorito de los habituales y el acertijo del excéntrico

- **Cada habitual tiene su favorito** (una receta; `FAVORITOS`, igual en la app y en el servidor). Cuando pide comida y está abierta,
  pide esa: «Y… ¿te queda empanada?»; en la comanda, «Empanada de bonito (su favorito)»; en la vitrina va la primera, con «· su
  favorito». Servírsela paga **+2 granos** («5 por su favorito»); otra del mismo tipo, a precio normal.
- **El excéntrico pide de comer la mitad de los días**, con **un acertijo** («Algo con un ancla, un barco y una estrella, que
  cruja.»), en su comanda debajo de los acertijos de la bebida. En la vitrina se ve todo lo que hay; si eliges otra cosa, suena
  `noEs`, esa se apaga y Pilar da **una pista**, y eliges otra vez (nunca se le sirve algo equivocado). Lo suyo paga **el doble**
  («4 por las galletas, el doble»). Sin lo suyo en la vitrina, solo el café.

### 145.4 Servidor

- Migración nueva **`20261227120000_cafe_obrador_recetario.sql`** (la aplica Francisco). Tabla `cafe_obrador_masa` (la masa de cada
  uno: amasado, cuándo se puso y si fue en una jornada de prueba) y columna `cafe_obrador.hitos`. Las cuatro recetas en
  `cafe_obrador_receta`; `cafe_obrador_favorito`, `cafe_obrador_hitos_cifras`, `cafe_obrador_hito_granos`; para la app,
  `cafe_masa_reposar(amasado)`. **Redefine** `cafe_pide_comida`, `cafe_obrador_json` (hitos, vendidas en total y la masa),
  `cafe_obrador` (lo que quiere cada uno), `cafe_hornear_de` (el pan necesita la masa subida y cuenta su amasado),
  `cafe_servir_comida` (el excéntrico solo con lo suyo y al doble; el favorito +2; los hitos), `cafe_mostrador_cobrar` (los
  hitos) y `cafe_visita` (el obrador, desde el nivel 4). Errores nuevos: `cafe:masa`.
- Sin la migración, el obrador va como en la 1.144 (las cuatro recetas nuevas, sin abrir).

### 145.5 Correcciones al probar

- **El fogón no se veía**: estaba metido en parte en el costado de las estanterías altas y su cámara caía dentro de ellas (la vuelta,
  «A la sartén» y sacarla salían sobre un fondo liso). El fogón se ajusta a su rincón, su chimenea pasa a la esquina de atrás y la
  cámara lo mira desde arriba.
- **La comanda del excéntrico no decía qué quería comer**: solo listaba los acertijos de la bebida. Ahora lleva también el de la
  comida y, en la vitrina, se queda solo ese.
- **La frase del hito al cobrar la caja se podía perder**: el aviso de Pilar se borra solo a los 6 s y, con la caja abierta, no se
  ve. Ahora la campanilla del hito suena al cobrar y Pilar lo dice al cerrar la caja.

### 145.6 Pruebas y limitaciones

- Vitest: `cafeObrador.test.js` (las cifras de las cuatro, los hitos, los favoritos, el excéntrico, los ocho gestos nuevos bien y
  mejor hechos, y el trazo de Pilar a 360, 390, 430 y 600) y `cafe-obrador-recetario.rls.test.js` (PGlite: paridad de recetas,
  favoritos e hitos con la app; niveles; el pan con su masa de un día para otro y en la jornada de prueba; Pilar; los hitos por el
  mostrador; el excéntrico solo con lo suyo y al doble; el favorito +2; la visita; el anónimo, 42501).
- E2E con Supabase simulado: `e2e-community/v1145-cafe-obrador-recetario.spec.js` a 360 y 390 (las cuatro recetas con sus ocho
  gestos hechos con el ratón como el dedo, el fogón, la masa a la bodega, la página de los hitos; al día siguiente, la caja que da
  el primer hito y el pan greñado; el favorito y el acertijo en la vitrina) y, a 390, con movimiento reducido (cada gesto nuevo de
  un toque). Los vídeos de 390 llevan el sonido de la página. `v1143` y `v1144` siguen pasando; con las dos resoluciones a la vez,
  un recorrido de cada una falló una vez por tiempos (el «¡Bien!» de Pilar dura 1,3 s y la prueba llegó tarde; Pilar pasó de
  gesto antes de que la prueba mirara) y, repetidos solos, pasan.
- `cafe-libreria.rls.test.js` › «el reparto (1.139)» sigue fallando desde la 1.142, sin relación.
- Evidencias en `qa-report/v1145/`.
- **Sin probar** con la migración aplicada (solo PGlite y el simulado), con cuentas reales ni en móviles reales.

**Por qué no se puede explotar**: igual que en la 1.143 y la 1.144, la app solo dice el mimo de los gestos; el pan no se puede
amasar dos veces (una masa por cuenta) ni greñar sin que haya pasado la noche (lo dice el servidor); el favorito y el acertijo los
fija el servidor para cada cliente del día; los hitos se cuentan una vez cada uno. La reputación y los tickets no se mueven.

### 145.7 El aviso del horno (1.145.1)

Francisco, 25-11-2026, al dar el visto bueno a la 1.145 («Si, pero un cambio antes»): «quiero que cuando tengas cosas haciéndose
en el horno te salga una notificación cuando se terminen, o un indicador visual claro». Antes solo sonaba la campanilla, cambiaba
el letrero del obrador (que no se ve si no miras al ala) y la puerta del horno se entreabría. Se hacen las dos cosas:

- **El horno del HUD**: mientras hay algo dentro, un botón de píxel con el horno de ladrillo en la columna de la derecha (encima de
  los libros), en todo el café menos en el obrador y en Decorar. **Horneando**, la lumbre respira y sube un poco de vaho, sin
  números ni cuentas atrás (el horno sigue sin números). **Listo**, se enciende en ámbar con la campanilla y su «!» saltando en la
  esquina y, en la sala, «¡Listo!» a su lado. Se toca para ir al horno (directo a sacar la hornada con la pala). Con otra cosa
  entre manos (un cliente en la barra, el taller, la caja, los libros…) no te saca de ahí: la nota dice «Te espera en el horno
  cuando acabes.»; horneando, dice lo que hay dentro («Aún se está haciendo; ya sonará la campanilla.»).
- **La nota de la campanilla**: al terminar una hornada, estés donde estés del café, suena `campanillaHorno` una vez y baja una
  nota de papel bajo la placa, «¡Ding! Ya están las magdalenas.» («Ya ha cuajado la tortilla.», o «Ya están las galletas y el
  pan.» con varias a la vez; `yaEsta` en `cafeObrador.js`). Se va sola a los 5,5 s, no se toca y, con un cliente delante, va
  justo debajo de su comanda (nunca la tapa ni tapa la franja). Lo que terminó mientras no estabas, al entrar en el café. Dentro
  del obrador, con otra receta entre manos, también suena la campanilla.
- **El letrero del obrador**, en ámbar mientras hay algo listo.
- Movimiento reducido: todo quieto (la nota aparece sin deslizarse). Lectores de pantalla: la nota es `role="status"` y el botón
  dice lo que hay dentro o que ya está.
- Fuera del café (el piso, el edificio) no hay aviso: el estado del horno solo se carga en el café. Sin notificaciones del
  sistema.
- Pruebas: `cafeObrador.test.js` (las frases) y la e2e `e2e-community/v1145-1-cafe-horno-aviso.spec.js` a 360 y 390 (en la
  sala, en la barra con un cliente y, a 390, con movimiento reducido y una hornada terminada mientras no estabas). Evidencias en
  `qa-report/v1145-1/`. Sin servidor nuevo ni migración.

## 146. La web de Libotown en la raíz (1.146.0)

Francisco, 26-11-2026: «he pensado que podríamos hacer ya la pagina web de la app, y que podriamos inspirarnos en la sección de
libotown de mi portfolio»; eligió «En la raíz». Después: «quiero que sea mucho más interactiva y con más espectacularidad» y «quiero
que se sienta más cozy aun, el inicio eso si creo que es perfecto»; con «Me gusta, sigue», el visto bueno a la web y el paso al
bloque 2. Regla en `CLAUDE.md` («La web de Libotown»).

### 146.1 La web (`public/web/`)

- Páginas estáticas sin librerías (`index.html`, `web.css`, `web.js`, `img/`), con rutas absolutas (`/web/…`): igual sirven en
  `/web/` que en la raíz. Las capturas son de perfiles de prueba.
- La portada se acerca a la puerta del Gran Hotel al bajar; las historias de tu piso y del café cambian la pantalla del móvil fijo
  paso a paso; la fachada tiene seis «!» que se tocan; dos minijuegos (prepara un café: moler, apisonar y extraer, de 1 a 3
  estrellas; las tres chisteras, sin apostar nada); una balda que se llena; las cartas del hotel en abanico con visor; y Libo en la
  esquina, con un bocadillo por sección, que se echa la siesta si no pasa nada.
- Cozy: títulos en Fraunces y notas a mano en Caveat (Google Fonts), luz de lámpara y grano de papel, motas en la luz, guirnaldas
  que se apagan y encienden al tocarlas, hojas con cinta, juegos enmarcados en madera y latón, una vela y una maceta.
- Sonido sintetizado y ambiente de lluvia y chimenea, **apagados hasta tocar el altavoz**; el ambiente se calla al cambiar de
  pestaña. Movimiento reducido: sin zoom de la portada ni animaciones, con los juegos funcionando.
- «Entrar» lleva a `/?entrar`.

### 146.2 El reparto en la raíz (`index.html`)

En Vercel, `/` es el `index.html` de la app (un archivo que existe gana a cualquier `rewrite`), y la app no se muda: su origen
guarda la biblioteca sin cuenta, los EPUB y la app instalada. Por eso el reparto lo hace **un script en línea en el `<head>` de la
app**, antes de cargar nada:

- Solo en `libotown.es` y solo en `/` (o `/index.html`). En localhost, las previews de Vercel y las pruebas, nada cambia.
- **Va a la app** si en este navegador hay algo de Libotown guardado (una clave de `localStorage` que empieza por `bookshelf`
  o `sb-`), si la app está instalada (`display-mode` standalone, fullscreen o minimal-ui, `navigator.standalone` o la referencia
  `android-app://` de la TWA), si la dirección trae parámetros (`?code=` del correo de Supabase, cualquier otro salvo los de
  campaña `utm_*`, `fbclid` y `gclid`) o un `#` con `=` (`#access_token=`, `#error=`), o si no se puede leer el almacenamiento.
- **`?entrar`** (el botón de la web) guarda `bookshelf:entrar` y quita el parámetro de la dirección: desde entonces, ese navegador
  entra directo aunque no cree cuenta.
- Si no, `location.replace('/web/?raiz' + hash)`, y la web devuelve la dirección a `/` (con su ancla) con `history.replaceState`.
  Al recargar se repite el mismo camino. Entrando a `/web/` a mano, la dirección no cambia (así la ve también quien ya usa la app).

### 146.3 El service worker

`/web/` va siempre a la red, como `/legal/`: si la web pasara por la rama de navegación, se guardaría como `/index.html` y la app
abriría la web sin conexión. Versión `bookshelf-v1.146.0`.

### 146.4 Pruebas

`qa-report/web/`: recorridos de la web a 390 y 1440 y páginas enteras con movimiento reducido a 360, 390, 430 y 1440 (sin errores
ni desplazamiento lateral), y el reparto contra `dist/` servido como Vercel con `libotown.es` apuntando a local
(`--host-resolver-rules`), 17 casos en `reparto-resultados.json`: nuevo → web en la raíz; «Entrar» → app sin `?entrar`; al
volver, app; `/web/` a mano con la app usada; con `bookshelf:v1`, `bookshelf:auth` o `sb-…` → app; instalada y TWA (simuladas:
Chromium no emula `display-mode` y descarta el Referer `android-app://`); `?code=`, `#access_token=`, `#error=` y `?libro=` → app;
`#cafe` y `?utm_source=` → web; localhost → app; y el service worker no guarda nada de `/web/` y su `/index.html` sigue siendo la
app. Sin probar en móviles reales ni en Safari.

## 147. Las poses de Libo (1.147.0)

Francisco, 26-11-2026, con una hoja de 15 poses de Libo dibujadas por él: «Mira te paso a libo en diferentes poses, añadelas a lo
largo de la app, para que parezca que libo esta vivo y le de más alegría». Cumple lo que `docs/qa/libo.md` §5 dejaba para más
adelante («las poses vendrán después, de su material»).

### 147.1 Las imágenes

- La hoja original está fuera del repositorio (`libotown-marca/libo-poses.webp`, como la mascota). `scripts/libo-poses.mjs` la
  recorta: quita el fondo negro unido a los bordes (el gatito negro y los ojos se quedan), junta cada pose con sus adornos («!»,
  «?», corazones, «zZ», el polvo al correr) e iguala la escala de las filas (la 2.ª y la 3.ª están dibujadas más pequeñas).
- Salen 15 WebP en `public/assets/libo/poses/` (unos 242 KB en total), **todas en el mismo lienzo de 420 × 400, apoyadas abajo**:
  al cambiar de pose Libo no cambia de tamaño ni salta. De pie ocupa 365 de alto, así que en su esquina mide lo mismo que antes.
- Poses: de pie, saluda, lee, camina, celebra, duerme, duda, cariño, enfado, sorpresa, abraza, corre, gatito (con un gatito negro),
  asoma y de espaldas. «Asoma» queda sin usar de momento.

### 147.2 Qué pose toca (`src/features/libo/poses.js`, reglas puras con pruebas)

En su esquina (`LiboRincon.jsx`):
- **Llega corriendo** la primera vez de la sesión en cada sitio (0,8 s) y se queda **de pie**.
- **Al hablar**, la pose va con lo que cuenta: avisos de otros sitios, **sorpresa**; una reseña por escribir, **abraza**; un libro
  parado o una idea que le pides, **duda**; ir a ver un sitio, **camina**; lo demás, **saluda**.
- **Sin tocar nada**: a los 30 s se sienta a **leer** (a veces, uno de cada cinco, con **el gatito**) y a los 90 s se **duerme**.
  Cualquier toque, tecla o desplazamiento le despierta. Con «Solo cuando le llamo» lee desde el principio.
- **Lo que lees**: un registro nuevo lo **celebra** (3 s); un libro terminado, lo **abraza** (3,8 s). Solo si cambian uno o dos de
  golpe (más es la nube trayendo tu biblioteca) y nunca en los 4 primeros segundos de la app. Lo recuerda fuera del componente: al
  apuntar una lectura la hoja le tapa y se desmonta, y al volver lo celebra.
- **Muchos toques seguidos** (4 en 2 s): se **enfada** un momento (1,5 s) y enseguida hace **cariño**; no abre ni cierra nada más.
- **«Ahora no»** a una sugerencia: se da **la vuelta** un momento, sin insistir.
- Al cambiar de pose da un saltito pequeño (`scale`, 260 ms); dormido respira más despacio. La imagen se dibuja un poco más alta
  que su botón (para que de pie mida lo mismo) y 9 px hacia dentro, porque las poses anchas se cortaban en el borde derecho.
- Las 15 imágenes se piden una vez, cuando el navegador está libre, para que cambiar de pose no deje un hueco.
- **Movimiento reducido**: no llega corriendo, no se sienta ni se duerme solo, sin saltito ni respiración; solo responde a lo que
  haces (al hablar, los toques, la lectura).

Fuera de la esquina:
- **La guía de Libo**: saluda en «Hola, soy Libo», te acompaña andando y de pie y celebra el último paso (`poseDelPaso`).
- **La guía de la habitación ilustrada** (`OnboardingGuide.jsx`): saluda en la carta, camina en los pasos y celebra el final.
- **La biblioteca vacía**: Libo abraza su libro.
- **«Tu cuenta»**: el dibujo de su apartado dice cómo se porta (saluda / lee / duerme).

### 147.3 Pruebas

`src/features/libo/__tests__/poses.test.js` (las reglas y que cada pose tiene su imagen) y `e2e-community/libo-poses.spec.js`
(a 360 y 390 con vídeo y `page.clock` para el rato sin tocar nada: de pie y del mismo tamaño que antes, habla, lee, duerme, se
despierta, enfado y cariño, celebra un registro; la guía, la biblioteca vacía, «Tu cuenta» y movimiento reducido). Las e2e de Libo
de antes siguen pasando. Sin probar en móviles reales ni en WebKit.

## 148. Libo, vivo también en calma, y la web con sus poses (1.148.0)

Francisco, 26-11-2026, tras la 1.147: «Pon también las poses de Libo en la web y añade unos cuantos cambios. Quiero que libo tenga
un ligero movimiento incluso cuando no estes tocandolo, y que en la web la sección que cuando bajas se mueven las imágenes para
enseñarte más funciones sea más intuitiva».

### 148.1 Libo, vivo aunque no le toques (app y web)

- **Se mece** despacio sobre los pies (`libo-mece`, ±1,5–1,8°, 7,5 s), además de respirar.
- **En calma** (de pie o leyendo, sin hablar ni reaccionar), cada 7 a 14 s hace **un gesto pequeño**: un saltito (de pie) o
  **mirar un momento hacia el otro lado** (de pie o leyendo; la imagen se da la vuelta 2,4 s). Reglas en `gestoEnCalma`
  (`src/features/libo/poses.js`); dormido, con el gatito o a mitad de otra pose, nada. Nunca suena ni pide nada.
- En la app, el rato sin tocar nada lo cortan los toques, las teclas y la rueda del ratón, **ya no cualquier desplazamiento**
  (una lista o la escena que se desplaza sola lo despertaba).
- **Movimiento reducido**: ni se mece ni hace gestos.

### 148.2 Libo en la web (`public/web/`)

- Las mismas poses que en la app (`/assets/libo/poses/`), pedidas cuando el navegador está libre.
- **El Libo de la esquina**: habla con la pose de cada sección (`data-libo-pose`: tu piso, saluda; el edificio, sorpresa; el café,
  celebra; el hotel, duda; «nada se compra con dinero», abraza; el final, camina). Si no pasa nada, a los 6 s se sienta a **leer** y
  a los 14 s se **duerme** (la pose trae sus «zZ»; las de antes se quitan). Al ganar algo (sale confeti: la balda llena, el café de 3
  estrellas, el conejo…) lo **celebra**. Con muchos toques, **enfado** y **cariño**. Se mece y hace los gestos de §148.1.
- **El de la balda** está sentado leyendo; con cada libro levanta la vista (**sorpresa**), al tocarle hace **cariño** y con la
  balda llena lo **celebra**.
- **El del final** lee junto a la vela.
- La ilustración grande de «Libo te enseña la ciudad» se queda (es la mascota, no una pose).
- Con movimiento reducido, Libo no cambia solo de pose ni se mueve.

### 148.3 Las historias del teléfono, más claras

Las dos secciones en las que el teléfono se queda quieto y cambia de pantalla al bajar (tu piso y el café):
- El número de cada paso dice cuántos hay: **«02 / 04»**.
- Cada paso termina con **«↓ Baja para ver: …»** y el nombre de la siguiente pantalla (en el último, «Después: Llena la balda» o
  «Prepara un café»); la flecha se mueve un poco (quieta con movimiento reducido).
- Bajo el teléfono, en lugar de los puntos, **una barra por paso que se llena al bajar** y **dos flechas**. Tocar una flecha o un
  tramo baja (o sube) hasta ese paso; las flechas se apagan en los extremos. Todo de 44 px.
- El paso activo se decide con la mitad de la pantalla al bajar (antes, una franja de 1 % que a veces se saltaba un paso al bajar
  deprisa).
- En el móvil, la nota bajo el teléfono mide siempre lo que la más larga, para que no empuje los pasos ni dé saltos; y los pasos
  invisibles ya no tapan el teléfono (tocar la captura para verla en grande vuelve a funcionar en el móvil).
- En el móvil, el último paso mide como los demás (antes era muy corto y, al llegar a él, el teléfono ya se había ido por arriba).

### 148.4 Pruebas

`poses.test.js` (los gestos en calma) y `e2e-community/libo-poses.spec.js` (se mece y hace un gesto; con movimiento reducido,
ninguno). La web, con un recorrido de Playwright a 360, 390 y 1440 (flechas y tramos, pasos, poses y sin desbordar). Sin probar en
móviles reales ni en Safari.

## 149. Las colecciones del ala nueva del almacén y la colección premium (1.149.0)

Encargo del 26-11-2026, que llega a través de la otra sesión de Francisco: sets de muebles nuevos, lo más acogedores y atractivos
posible, en 3D con el estilo de la casa, y una colección extra premium con el modelo menos agresivo. La ve todo el mundo, cuesta
muchos tickets y saldrá mucho más barata con la futura suscripción, que aún no existe. Un solo punto dice si alguien es
suscriptor: hoy siempre «no», y se podrá enchufar después sin tocar el catálogo. **Las cifras de §149.3 las aprobó Francisco el
26-11-2026** (aceptó la tabla propuesta).

### 149.1 Las cuatro habitaciones del ala nueva

Las cuatro habitaciones cerradas del ala nueva (§106) se abren, cada una con su set de cinco muebles nuevos, su taller, su placa y su
ambiente: suelo, papel con friso, luz cálida y un remate propio (`alaNueva` en `almacen3d.js`).

| Habitación (taller) | Muebles | Ambiente |
| --- | --- | --- |
| **Lumbre y Lana** (`lumbre`) | Chimenea de ladrillo (fuego encendido, velas, guirnalda y calcetines), butacón orejero con manta escocesa, leñero de forja, alfombra de cuadros, lámina de la cabaña nevada | Espiga de roble, papel granate con flor de lis, viga y farol de forja |
| **Cristal y Helecho** (`invernadero`) | Banco de forja con cojines y regadera, escalera de macetas, limonero, farol de jaula, ventanal del invernadero con hiedra | Baldosa hidráulica, papel de celosía, cerchas blancas de cristal y helecho colgado |
| **Buhardilla de Octubre** (`octubre`) | Nido de lectura con dosel y lucecitas, escalera de mantas, caja de calabazas, lámpara de seta, guirnalda de hojas | Tarima de pino con hojas, papel de hojas, vigas inclinadas y tragaluz con estrellas |
| **Medianoche** · premium (`medianoche`) | Chéster de terciopelo capitoné, biblioteca con escalera, candelabro de pie, globo celeste, vidriera de la luna | Parqué oscuro con alfombra ciruela y oro, papel de estrellas doradas, araña de latón y cortina recogida |

- Los modelos están en `furnitureColecciones.js` (`SHAPES_COLECCIONES`) y valen en el piso isométrico, en el piso en primera
  persona y en el almacén. Los cuatro asientos tienen su sitio para sentarse (`SEATS` en `actor.js`).
- Las cuatro son **habitaciones especiales**, como «Capa y Antifaz»: lo común cuesta 40 y lo poco común 80 (en el almacén y en la
  tienda) y nunca se rebajan.
- Los muebles salen en el Directorio, en «Nuevo» del ordenador (llegan el día que se publique: `LLEGADAS` en `almacenAvisos.js`
  lleva hoy 2026-11-26) y por zonas de la casa. La escalera de mantas y la lámpara de seta estrenan el dormitorio.
- Cada habitación pone su medio tabique de su lado y con su papel (antes, entre dos contiguas no quedaba ninguno). Los precios de
  lo que hay en la de al lado no se ven a través del tabique.
- El letrero del arco dice «Ala nueva · colecciones» y cada habitación tiene el suyo.

### 149.2 La suscripción: un solo punto

- **En la app**: `src/domain/suscripcion.js` (`esSuscriptor()`, hoy siempre `false`; `fijarSuscripcion()` para cuando exista).
- **En el servidor**: `public.piso_es_suscriptor()`, hoy `select false`. Cuando exista la suscripción, solo cambian estas dos
  funciones. El catálogo, los precios y las compras no se tocan.

### 149.3 La colección premium (cifras aprobadas)

| Mueble | Precio | Con la suscripción |
| --- | --- | --- |
| Chéster de terciopelo | 600 | 240 |
| Biblioteca con escalera | 550 | 220 |
| Globo celeste | 350 | 140 |
| Vidriera de la luna | 400 | 160 |
| Candelabro de pie | 300 | 120 |
| **Toda la colección** | **2.200** | **880 (−60 %)** |

- Las cifras están en un solo sitio por lado: `PREMIUM` en `economy.js` y `piso_premium()` en el servidor. Una prueba comprueba
  que coinciden.
- Lo premium tiene rareza `raro`, se compra con tickets como cualquier mueble (almacén y tienda) y **nunca se rebaja** (ni
  ofertas ni albarán). **No sale en sobres**: `piso_al_azar` deja fuera lo de las habitaciones especiales, como ya hacía la app.
- En la ficha: «Colección premium · nunca se rebaja». Si no se es suscriptor, una fila tranquila: «Suscripción: 240 tickets con
  la suscripción de Libotown, cuando llegue». Sin botones, cuentas atrás ni avisos.

### 149.4 Migración

`supabase/migrations/20261229120000_almacen_colecciones.sql` (la aplica Francisco, después de `20261228120000_cuenta_borrar.sql`).
Hace lo siguiente:
- añade los 20 muebles y 4 placas a `piso_catalogo`;
- rehace `piso_talleres()` (once talleres) y `piso_de_habitacion_especial`, con las cinco habitaciones especiales;
- crea `piso_es_suscriptor()` y `piso_premium()`;
- hace que `piso_precio_mueble` cobre lo premium a su precio (el de suscriptor, si lo es);
- deja fuera de los sobres lo de las habitaciones especiales.

No borra ni cambia datos. Sin ella, el almacén enseña las habitaciones, pero el servidor no vende sus muebles.

### 149.5 Pruebas

- **Vitest**:
  - `almacenEspeciales.rls` (26 especiales, precios premium iguales en los dos lados, nadie es suscriptor y la tienda cobra 300 por el candelabro);
  - `tienda.rls`, `talleres.rls`, `edificio.rls`, `almacen.rls`, `casino*.rls`;
  - `almacenAvisos` (los veinte nuevos, que no se siguen) y `zonas` (el dormitorio).
- **E2E con Supabase simulado**:
  - `v1149-colecciones.spec.js` (las cuatro habitaciones a 360, 390 y 1440; las fichas; la caja con 600 tickets; vídeos con `ALMACEN_VIDEO=1`);
  - `v1106` (el letrero del arco), `v1134` (40 en «Todo el almacén»), `v199` y `v1101`.

Sin probar en móviles reales ni en WebKit.

## 150. Olmo, el búho librero: el personaje de suscriptor del café (1.150.0)

Encargo de Francisco del 26-11-2026: «Empieza con el personaje de suscriptor que sustituye a Pilar, y más allá de las funciones,
haz mucho hincapié en que sea muy característico y atractivo para el público, y que en la cafetería también tenga una especie de
guía como Libo en los menús y botones». Decisiones del mismo día (las cuatro recomendadas):

- **Olmo**, un búho librero, sustituye a Pilar con la suscripción y hace todo lo que hace ella;
- una **guía del café** en menús y botones para todo el mundo: Olmo con la suscripción y Pilar sin ella (bloque 2, aparte);
- **vista previa** para las cuentas de `cafe_probadores`: ven a Olmo como si fueran suscriptoras, sin precios de suscriptor;
- **lo diseña Claude en 3D**, con las cajas de la casa, como el mapache del casino; su retrato y sus poses salen del mismo
  modelo, y no se parece a búhos de otras obras.

Va por bloques con evidencias. Este es el bloque 1: Olmo en el café.

### 150.1 Quién es Olmo

- Un búho grande y redondo, con dos penachos de pluma y gafas redondas de alambre de bronce sobre unos ojos ámbar.
- Lleva un chaleco de punto mostaza, con canalé y tres botones de madera, y una bufanda escocesa (roja, con franjas verdes y un
  hilo amarillo) con un lápiz metido en el nudo. Tiene alas en vez de manos.
- Es sabio y tranquilo: habla despacio, huele los libros, mide las cosas en páginas y suspira «hu-hum» cuando algo le gusta.
- No lleva pajarita, ni birrete, ni monóculo: así no se parece a ningún búho de otra obra.
- En la barra está de pie en un taburete bajo, para que el chaleco asome por encima del mostrador.

### 150.2 El modelo y su retrato (`cafe/olmo3d.js`)

- **Solo datos**, como `mapache3d.js`: cuerpo y cabeza redondos (rodajas de elipse), la cabeza con su pivote en el cuello, los
  párpados, las dos alas con el pivote en el hombro, un ala levantada (para la guía) y un libro abierto.
- **`poseOlmo(t)`**, cuando está quieto:
  - respira;
  - parpadea despacio, a veces dos veces;
  - cada 15 s gira la cabeza a un lado y al otro, como los búhos, la ladea con curiosidad y se ahueca las plumas.
- Cuando prepara un café, mueve las alas al trabajar. Con movimiento reducido no se mueve nada.
- **`retratoOlmo(pose)`** saca el retrato de píxel (24 × 24, el formato de `PixelArt`) del propio modelo:
  - se ve de frente;
  - cada píxel toma la caja que está más delante, y las cajas finas ocupan al menos un píxel, así que las gafas se ven;
  - lleva un contorno oscuro.
- Las poses del retrato son `normal`, `contento` (ojos cerrados que sonríen), `apunta` (el ala levantada) y `lee` (con el
  libro). Así el retrato y la figura de la barra son siempre el mismo Olmo.

### 150.3 Quién atiende (`cafe/cafePersonaje.js` y `src/domain/suscripcion.js`)

- **`conOlmo()`** devuelve `esSuscriptor() || vistaPrevia`, y **`anfitrion()`** da Olmo o Pilar con sus datos:
  - el nombre, el pronombre y quién es;
  - el sonido;
  - el retrato;
  - su voz en los momentos de siempre (`dice`) y, solo Olmo, sus frases sueltas.
- **La vista previa no necesita migración.** El servidor ya dice quién es probador: `cafe_jornada()` devuelve la jornada de
  prueba solo a las cuentas de `cafe_probadores`. Al cargarla, el café llama a `fijarVistaPrevia(Boolean(jornada))`.
- La vista previa solo cambia quién atiende: `esSuscriptor()` sigue en «no» y los precios no cambian.
- **`conQuien(texto)`** pasa a Olmo los textos de los datos que nombran a Pilar (el cuaderno, las mejoras del obrador, la
  reseña de un habitual…). Cambia el nombre y pasa a masculino («ella sola» → «él solo»).

### 150.4 Olmo en el café

- **En 3D** (`cafe3d.js`, `setAnfitrion('olmo' | 'pilar')`):
  - Olmo está en el sitio de Pilar y solo se ve uno de los dos;
  - las piezas que se mueven se animan en el mismo bucle que la lluvia (`moverOlmo` dentro de `pintaVivo`);
  - cuando prepara, hornea o tuesta, lo que agarra los mangos es la punta de su ala: plumas claras, el ala parda en vez de la
    manga (el chaleco no tiene mangas) y dos primarias oscuras;
  - el lienzo dice «toca… a Olmo… para hablar con él».
- **En la franja**: su nombre, su retrato y «Olmo, en el mostrador». Si le tocas, se acerca y dice una de sus doce frases (una
  distinta cada vez, en orden), con el retrato leyendo. Por ejemplo:
  - «Este libro huele a lluvia… te va a gustar.» (la de Francisco);
  - «Un café se enfría; un buen libro, nunca.»;
  - «Mis gafas no son para leer. Son para leer despacio.».
- **Su voz en los momentos de siempre:**

  | Momento | Pilar | Olmo |
  | --- | --- | --- |
  | Al entrar | «¡Qué bien huele hoy…!» | «Hu-hum… hoy «…» huele a café y a papel viejo, mi olor favorito.» |
  | Clientes esperando | «Tienes 3 clientes esperando…» | «Hu-hum. Tienes 3 clientes esperando…» |
  | Todos atendidos | «El local es tuyo para decorar.» | «Este silencio de después es como cerrar un buen libro…» |
  | Prepara él o ella | «Deja, que esto lo bordo yo.» | «Deja, deja: esto lo tengo bajo el ala.» |
  | Se ofrece | «Esto ya lo bordas; si quieres, te lo preparo yo.» | «Esto ya lo dominas. Si quieres, lo preparo yo y tú charlas con el cliente.» |

- **En el resto del café**, Olmo sustituye a Pilar en:
  - Atender: el retrato, «Que lo prepare Olmo» y la nota de quien ya lo borda;
  - la caja del mostrador;
  - el cuaderno («El cuaderno de Olmo», con el retrato leyendo);
  - los libros;
  - el obrador («Que lo hornee Olmo», «Olmo vende 4 al día»…);
  - el tostadero;
  - los avisos del servidor.
- **Libo** habla de Olmo cuando atiende él: en el capítulo del café, en el saludo del café y en las propinas de la hucha.
- **Su sonido**: un «hu-húu» de búho, bajo y redondo (`olmo` en `cafeSfx.js`).
- **El traspaso** (antes de abrir el café) sigue siendo de Pilar: es ella quien deja el local. La vista previa se sabe al
  cargar el día del café abierto.

### 150.5 Pruebas

- **Vitest** `cafe-olmo.test.js` (10 pruebas):
  - quién atiende con y sin suscripción, y con la vista previa (que no cambia el precio premium);
  - `conQuien`;
  - la voz completa, distinta de la de Pilar;
  - las frases, sin repetirse;
  - las cajas del modelo, su altura y su centro;
  - los cuatro retratos;
  - la pose: parpadea, gira, ladea, se ahueca, se queda quieto con movimiento reducido y mueve las alas al preparar.
- **e2e** `v1150-cafe-olmo` a 360, 390 y 1440:
  - la cuenta de pruebas ve a Olmo en 3D, con su letrero, la franja, su retrato y dos frases seguidas;
  - prepara una taza con las alas («Que lo prepare Olmo»);
  - una cuenta normal sigue con Pilar;
  - con `OLMO_VIDEO=1`, el vídeo de un ciclo entero suyo.
- Capturas en `qa-report/v1150/`.

### 150.6 Bloque 2: la guía del café en sus menús y botones (1.150.1)

La da quien atiende, con su retrato y su voz: **Olmo** con la suscripción (o en vista previa) y **Pilar** sin ella. Libo
presenta el café y se aparta; esto es lo que viene después. Como la guía de Libo: un velo suave con un hueco sobre el botón
del paso y una tarjeta al lado, aquí con el cuadro de diálogo del café, el nombre en su pestaña y el retrato de quien atiende.

- **Las reglas** (`cafe/cafeGuia.js`, sin React). Cada sitio del café es un capítulo:
  - **el local** (con el café abierto): el retrato, Atender, Charlar, Decorar, los libros, los cafés del barrio, el cuaderno, el
    horno, Volver arriba y los letreros de los sitios en 3D (escaparate, trampilla, tostador, obrador y taller), con saludo y
    despedida;
  - **Decorar** (mover un mueble, las pestañas, las dos plantas y Listo);
  - **la balda de libros**, **el ranking** y **el cuaderno**, un paso cada uno, la primera vez que se abren.
- **Solo lo que se ve**: cada paso señala un control (`ancla`) y sale solo si está en pantalla. Lo que aún no se ha abierto en
  tu café (el horno, la bodega, el obrador…) no sale hasta que aparece.
- **Lo visto, paso a paso** (`capitulo:paso`), en los ajustes de la biblioteca (`settings.guiaCafe`, viaja con la cuenta sin
  migración) y en este dispositivo (`bookshelf:guia-cafe`, por si los ajustes aún no han llegado). Cuando el café crece y aparece
  un botón nuevo, la guía enseña **solo ese**, sin saludo ni despedida. El saludo y la despedida solo van con dos pasos o más y
  la primera vez.
- **Se abre sola** con el café quieto (la escena y los letreros asentados), sin Libo hablando, **después de que Libo haya
  presentado el café** y **solo si Libo «sugiere cosas»** (Ajustes). Se marca todo al abrirla: si la cierras («Ahora no»,
  «Saltar» o Escape), no vuelve sola.
- **A petición**: el retrato de la franja es un botón con una «?» pequeña; tocarlo repasa todo lo que se ve, con su sonido.
- **Se cierra** al cambiar de sitio (atender, abrir un menú, Decorar…). Escape cierra la guía, no el café.
- **Las dos voces**, escritas a mano en cada paso; Olmo con las suyas («Hu-hum», los libros, el marcapáginas) y con la pose de su
  retrato en cada paso (apunta con el ala, lee, contento). Botones: «Enséñame» / «Ahora no», «Siguiente», «Atrás», «Saltar» y
  «Gracias, Olmo» (o «Gracias, Pilar»); un paso suelto, «Entendido». La cuenta «2 de 5» no cuenta el saludo ni la despedida.
- **Accesible**: la tarjeta es un diálogo con título y descripción; el foco va al botón principal; nombre de quien habla para
  lectores de pantalla; con movimiento reducido, sin el latido del recuadro.
- **Las pruebas con cuenta simulada** dan la guía por vista (`bookshelf:guia-cafe` con `capitulo:*` en `mockSupabase.js`),
  como a Libo, para que no tape las demás pruebas; las de la guía lo quitan.

### 150.7 Pruebas del bloque 2

- **Vitest** `cafe-guia.test.js` (6): cada paso con título, ancla única, pose y las dos voces (la mitad, al menos, distintas);
  la primera vez con saludo y despedida; lo visto no vuelve y un botón nuevo sale solo; el repaso; nada que enseñar; ajustes
  rotos.
- **e2e** `v1150-cafe-guia`:
  - a 360, 390 y 1440, Olmo la abre solo la primera vez, señala cada botón hasta la despedida (con Atrás por el camino), queda
    apuntada y no vuelve; el retrato la repasa y Escape la cierra sin cerrar el café;
  - a 390 y 1440, sin suscripción la da Pilar con su retrato y sus frases;
  - a 360 y 390, Decorar y la balda de libros tienen su capítulo la primera vez;
  - con `GUIA_VIDEO=1`, el vídeo.
- Capturas `10` a `19` y `video/1150-guia.webm` en `qa-report/v1150/`.

## 151. El edificio de tus amigos: la llave y el telefonillo (1.151.0)

Encargo de Francisco del 26-11-2026: «Cada edificio debería tener como vecinos únicamente a tus amigos, y que cada grupo de
amigos tenga como su propia comunidad de vecinos, ahora mismo cada persona que entra en la app (he hecho la prueba con una
compañera), se acopla al edificio disponible», y «que fuera del edificio tengas como un telefonillo con funciones así». Plan y
decisiones (las cuatro recomendadas) en `docs/qa/amigos-vecinos.md` y en CLAUDE.md. Sustituye al reparto al azar de la 1.63.
Este es el bloque 1 de 5: el servidor, el telefonillo y el enlace de la llave.

### 151.1 El servidor (migración `20261230120000_edificio_amigos.sql`, la aplica Francisco)

- **Cada cuenta, su edificio**: `asignar_edificio()` da a quien aún no tiene puerta un edificio nuevo solo para él, con una
  puerta al azar de las seis. Nadie entra en un edificio ajeno sin llave.
- **La llave** (`edificio_llaves`, cerrada a los clientes; todo va por funciones):
  - código de 8 caracteres sin letras que se confundan (sin I, O, 0 ni 1), sacado de `gen_random_uuid()`;
  - **un solo uso, 7 días**; como mucho **3 sin usar** por persona y 10 al día; la puede dar **cualquier vecino** con la
    comunidad activada;
  - `edificio_dar_llave()`, `edificio_mis_llaves()`, `edificio_retirar_llave(cod)`;
  - `edificio_ver_llave(cod)`: de quién es, cuántos vecinos hay y, si no abre, por qué (`no_sirve`, `lleno`, `ya_vives`,
    `tuya`, `comunidad`, `sesion`). Una llave caducada, usada, retirada, inexistente o de alguien con quien hay un bloqueo
    dice lo mismo, «ya no abre», para no delatar nada;
  - el código se escribe como se quiera (minúsculas, espacios, guiones): el servidor lo limpia.
- **Mudarse** (`edificio_mudarse(cod)`): con la comunidad activada, sin bloqueo con **nadie** del edificio y con hueco. Tu fila
  de vecino cambia de edificio con una puerta libre; **tu piso y tus muebles van contigo** (son tuyos, no del edificio). Gastar la
  llave y mudarse van en la misma operación, con el candado del reparto. Si el edificio que dejas se queda vacío, se quita (solo
  la fila del edificio: no hay nada más suyo).
- **Irse** (`edificio_irse()`): a un edificio nuevo solo para ti, **con la misma puerta**; tus llaves sin usar dejan de abrir.
  Si vives sola o solo, no hace nada.
- **El portal** (`edificio_portal()`) dice además `plantas` (3 por ahora; crecerán en el bloque 2) y `libres`.
- **El reparto de una vez, al aplicarla** (`edificio_repartir_por_amigos`, con su marca en `edificio_reparto_amigos` para no
  repetirse): en cada edificio se agrupa a los vecinos por amistad (os seguís los dos, con la comunidad y sin bloqueo; también
  amigos de amigos). **Se queda el grupo más grande** (en empate, el de quien llegó antes) y **cada uno de los demás grupos se
  muda junto a un edificio nuevo**, cada cual con su puerta de antes. Quien no tiene ningún amigo dentro queda solo en el suyo.
  **No se borra nada**: pisos, muebles, café y todo lo demás siguen siendo de cada cuenta. *Interpretación*: «se queda quien
  tenga allí a algún amigo» se lee como «se queda el grupo de amigos más grande»; si en un edificio hay dos parejas de amigos que
  no se conocen, la segunda se va junta a otro edificio en vez de quedarse.
- **Ojo antes de aplicarla**: Francisco y su pareja siguen juntos solo si se siguen los dos. Si no, se vuelven a juntar con una
  llave.

### 151.2 El telefonillo del portal

- **En la fachada**: una placa de latón a la derecha del portal, con la rejilla del altavoz arriba y dos columnas de botones,
  en el mismo dibujo de píxeles (`facade.js`, compartido por la fachada 2D y la calle 3D). Se toca como las ventanas
  (`calleView.js` y `facadeView.js`, con su caja de toque más grande que el dibujo) y **brilla** hasta que lo abres por primera
  vez en el dispositivo (`bookshelf:telefonillo`; con movimiento reducido, sin parpadeo).
- **El panel** (`Telefonillo.jsx`): la placa de latón grande, con la rejilla y el título en la letra del puerto.
  - **Inicio**: un botón por puerta, como en la fachada (arriba la 3.ª planta, la A a la izquierda): el tuyo, en verde; el de un
    vecino, **lo llama** (entras en su piso, como al tocar su ventana); el libre, apagado. Debajo, «Dar una llave», «Tengo una
    llave» y, si vives con alguien, «Irme del edificio». Sola o solo: «Dale una llave a quien quieras de vecino».
  - **Dar una llave**: «Hacer una llave» da un llavero de cartón con el código («ABCD-EFGH») y hasta cuándo abre; «Compartir la
    llave» abre la hoja de compartir del móvil con el enlace (o lo copia, donde no la hay). Debajo, tus llaves sin usar, con
    Compartir y Retirar. Con el edificio lleno, no se hacen llaves.
  - **Tengo una llave**: se escribe el código, «Mirar la llave» dice de quién es y cuántos vecinos tiene, y «Mudarme» / «Ahora
    no». Al mudarte, una nota («Ya vives en el edificio de Bruno.») y el portal ya con tus vecinos nuevos.
  - **Irme**: lo que pasa, dicho antes («tu piso, tus muebles y la misma puerta»; tus llaves dejan de abrir) e «Irme» / «Me
    quedo».
  - Abajo, «Colgar» o «Atrás». Escape y Atrás del móvil (`useAtras`) cierran la vista abierta.
- **Las reglas de la llave en el cliente** (`llave.js`, sin nada pesado: también la usa el arranque): `llaveBonita`,
  `llaveLimpia`, `enlaceLlave`, `llaveDeHash`, los motivos dichos para quien tiene la llave en la mano y la llave guardada.

### 151.3 El enlace de la llave

- `https://libotown.es/#llave=ABCDEFGH`: el código va en el fragmento, que no llega al servidor (como `#club=`); el reparto de la
  raíz (§146) ya manda a la app todo fragmento con «=».
- `LlaveHandler.jsx`, en el arranque, junto a las invitaciones a clubes: lee el código, **lo quita de la barra de direcciones** y
  lo guarda en el dispositivo 7 días (`bookshelf:llave`).
  - Con cuenta y comunidad: una nota de papel abajo, «Te han dado una llave», de quién es y cuántos viven, con «Mudarme» /
    «Ahora no». Al mudarte, «Ya vives en el edificio de X.» con «Ir al edificio».
  - Sin cuenta o sin comunidad: dice qué falta y que **la llave se queda guardada**; cuando ya se puede, la nota sale sola al
    abrir la app (quien llega sin cuenta, primero la crea).
  - Si la llave ya no abre, ya vives allí, es tuya o el edificio está lleno, lo dice y la olvida. Sin la migración o sin red, no
    dice nada y la guarda para otra vez.

### 151.4 Pruebas

- **Vitest**:
  - `edificioAmigos.rls.test.js` (10, Postgres con todas las migraciones): las llaves (formato, 7 días, 3 vivas, retirar,
    comunidad, tablas cerradas, limpiar el código), mudarse (piso intacto, llave gastada, edificio vacío fuera, portal con
    `plantas` y `libres`), cualquiera da llaves, la tuya y donde ya vives no abren, bloqueo, lleno a seis, irse y el reparto de
    una vez (amigos que se quedan, grupos que se van juntos, quien se queda solo, puertas de antes, nada borrado, su marca);
  - `llave.test.js` (3): cómo se escribe, el enlace y la llave guardada 7 días;
  - las pruebas de servidor que daban por hecho el reparto al azar se juntan como antes con `juntarComoAntes`
    (`supabaseHarness.js`), y `edificio.rls.test.js` comprueba ahora que cada cuenta estrena su edificio.
- **e2e** `v1151-telefonillo` (simulador con `db.edificio_llaves`): a 360, 390 y 1440, el telefonillo de principio a fin (dar
  y compartir una llave, usar la de Bruno escrita a mano, mudarse, ver a los vecinos nuevos e irse) y el enlace (la nota, mudarse
  e ir al edificio); a 390, el enlace sin comunidad. Con `TEL_VIDEO=1`, el vídeo.
- Capturas `01` a `09` y `video/1151-telefonillo.webm` en `qa-report/v1151/`.

## 152. El edificio crece por plantas (1.152.0)

Bloque 2 de 5 de `docs/qa/amigos-vecinos.md`. Francisco eligió «Crece con plantas»: el edificio de un grupo de amigos empieza
con 3 plantas (6 puertas) y, cuando se llenan, estrena otra, hasta **5 plantas y 10 vecinos**.

### 152.1 El servidor (migración `20261231120000_edificio_plantas.sql`, la aplica Francisco **después** de la de §151)

- **Las puertas** van de la `1A` a la `5B` (la regla `edificio_vecinos_puerta_check` pasa a `^[1-5][AB]$`).
- **Las plantas no se guardan: se cuentan.** `edificio_plantas(ed)` = la planta ocupada más alta, y nunca menos de 3. Si se va
  quien vivía arriba del todo y esa planta se queda vacía, el edificio vuelve a tener una planta menos.
- **La puerta libre** (`edificio_puerta_libre`): primero una al azar de las plantas que ya hay y, solo si están llenas, una de la
  planta siguiente (hasta la 5.ª). Lo usan mudarse con una llave y el reparto por amigos.
- **Lleno a 10**: `edificio_ver_llave` dice `lleno` con 10 vecinos y da también `plantas`; `edificio_portal` da `plantas` y
  `libres` (10 menos los vecinos).
- **Orden**: aplicarla después de `20261230120000_edificio_amigos.sql`. Volver a ejecutar la de §151 después devolvería la
  puerta libre de seis puertas.

### 152.2 El dibujo

- `facade.js`: `alturas(plantas)` da la azotea y el cartel de cada altura (suben lo mismo por planta); `puertasDe(plantas)`, las
  puertas de arriba abajo y la A antes que la B; `FLATS` tiene las 10 (las seis de antes, en su sitio y con su cristal). La
  fachada, las impostas y la escalera se dibujan hasta la planta de arriba, y el marco y el cartel suben con ella.
- `calle3d.js`: la calle 3D se construye con las plantas que tenga el edificio (están en la clave de su caché). La vista de
  inicio no sube más de lo necesario para que, con 5 plantas, se vean a la vez el cartel y la acera; con 3, la vista es la de
  siempre (comparada píxel a píxel con la de antes).
- `facadeView.js` y `calleView.js` (la fachada 2D y las placas de la calle) usan las mismas puertas y alturas.

### 152.3 El telefonillo y el cliente

- `service.js`: `plantasDe(vecinos, plantas)` (las del servidor y, sin ellas, las del vecino más alto; entre 3 y 5) y
  `doorsOf(vecinos, plantas)`. `loadEdificio` devuelve `plantas`.
- `Telefonillo.jsx`: un botón por puerta de cada planta (de 6 a 10); el subtítulo dice «7 vecinos en 4 plantas · 3 puertas
  libres» o «· edificio lleno». Al dar una llave con las plantas llenas, avisa: «Tus 3 plantas están llenas: quien entre con
  esta llave estrenará la 4.ª planta, y el edificio crecerá.»

### 152.4 Pruebas

- **Vitest**: `edificioPlantas.rls.test.js` (5, Postgres con todas las migraciones): empieza con 3, llena las 3 y luego la 4.ª y
  la 5.ª, lleno a 10, encoge al vaciarse la de arriba y la regla de las puertas; `plantas.test.js` (3): plantas, orden de las
  puertas y alturas. `edificioAmigos.rls.test.js` se ejecuta sin esta migración (prueba las reglas de seis puertas de §151).
- **e2e** (Supabase simulado: `mockSupabase.js` hace crecer las plantas igual): `v1152-plantas.spec.js` a 360, 390 y 1440 (el
  aviso de que crecerá, Ana se muda y estrena la 4.ª planta, un edificio de 5 plantas lleno) y `v1151-telefonillo` con el
  subtítulo nuevo. Capturas en `qa-report/v1152/` y vídeo `qa-report/v1152/video/1152-plantas.webm` (con `PLANTAS_VIDEO=1`).
- Sin probar en móviles reales ni en WebKit.

## 153. La app «Amigos» del ordenador (1.153.0)

Bloque 3 de 5 de `docs/qa/amigos-vecinos.md`. Encargo de Francisco del 26-11-2026: «que en el ordenador haya una sección social
muy atractiva que deje buscar a amigos y tener funciones relacionadas con la lectura». Decisión 4: lo que ven tus amigos de tu
lectura lo eliges tú (por defecto, qué lees ahora y lo que terminas; nunca notas, reseñas privadas ni páginas por día; solo
amigos). Amigos son, como en el casino, la sala y el edificio, quienes os seguís los dos, con la comunidad y sin bloqueo.

### 153.1 El servidor (migración `20270101120000_amigos.sql`, la aplica Francisco **después** de las de §151 y §152)

- **Tu código de amigo** (`amigos_codigos`, `amigos_mi_codigo`, `amigos_buscar_codigo`): 8 caracteres sin I, O, 0 ni 1, el
  mismo siempre. Con él te encuentran sin buscar tu alias; el tuyo, un código que no existe o el de alguien con quien hay un
  bloqueo no encuentran a nadie.
- **Lo que compartes** (`amigos_lectura`, `amigos_publicar`, `amigos_ajustes`): hasta 3 títulos que lees y los 5 últimos
  terminados con su día, y tu avance en «Leemos el mismo». Solo título y autor (limpios y cortados a 300). Lo apagado no se
  guarda y **se borra al apagarlo**.
- **Recomendar un libro** (`amigos_recomendaciones`, `amigos_recomendar`, `amigos_recomendaciones_vistas`): solo a amigos, con
  una de cuatro frases cerradas («Creo que te gustará», «Me acordé de ti al leerlo», «No pude soltarlo», «Para leerlo a la
  vez»), una vez por libro y amigo, como mucho 5 al día.
- **Leemos el mismo** (`amigos_juntos`, `_proponer`, `_responder`, `_dejar`): propones un libro a un amigo; si acepta, cada uno
  ve el avance del otro en porcentaje (si lo comparte). Como mucho 3 abiertas por persona; rechazar o dejarla la retira.
- **La llave, para un amigo** (`amigos_dar_llave`, columna nueva `edificio_llaves.para`): una llave del bloque 1 (mismas
  reglas) que le llega a su agenda. No si ya vivís juntos ni si ya tiene una tuya sin usar.
- `amigos_panel()` lo junta todo: código, ajustes, amigos (con lo que comparte cada uno y si vive en tu edificio), quién te
  sigue y tú aún no, a quién sigues y aún no te sigue, recomendaciones, lecturas a la vez, llaves recibidas y a quién has dado
  una. Las tablas están cerradas a los clientes; todo va por funciones.

### 153.2 La app

- **Dónde**: una tarjeta «Amigos» en el escritorio del ordenador del piso (quién lee qué, lo nuevo y «Abrir Amigos») y una
  entrada «Amigos» en Aplicaciones. La pantalla (`social/amigos/AmigosApp.jsx`) se carga solo al abrirla.
- **Aspecto**: una agenda de cuero cosido con cuatro pestañas de cartulina de colores (la cifra de lo nuevo en una esquina) y
  una hoja de papel con renglones y margen rojo; cada amigo es una ficha con su foto sujeta por esquinas (`amigos.css`).
- **Amigos**: «Leemos a la vez» con dos cintas de avance (tú y tu amigo) y las propuestas que esperan; las fichas con «Leyendo» y
  «Terminó» (o «No lo comparte») y sus botones: Visitar su piso, Recomendar un libro, Leer el mismo, Leer juntos en la sala (la
  cita de 25 minutos de §117, ahora, y te lleva a la sala) y Darle la llave. Sin amigos, cómo conseguirlos y tu código.
- **Buscar**: tu código en un carné, con «Compartir mi código»; buscar por alias o por código (se escribe como se quiera);
  «Te siguen», con «Seguir también», y «Esperando a que te sigan».
- **Buzón**: llaves (con «Mudarme» y su confirmación), propuestas para leer a la vez (si no tienes el libro, «Añadirlo y leerlo
  a la vez» lo pone en Quiero leer) y recomendaciones con su frase y «Añadir a Quiero leer». Al abrirlo, las recomendaciones
  quedan vistas.
- **Lo que ven**: tres interruptores (qué leo ahora, qué termino, mi avance cuando leemos a la vez). *Interpretación*: el plan
  decía «en Ajustes»; están en la propia agenda, donde se ve lo que comparten los demás.
- **Mandar tu lectura** (`AmigosSync.jsx`, en `App.jsx`, y `amigosLectura.js`): desde que abres Amigos por primera vez en un
  aparato, cuando cambia tu biblioteca la app manda lo que lees, lo terminado y tu avance en cada lectura a la vez, unos
  segundos después y solo si ha cambiado. Al abrir la agenda, siempre. Un «Leemos el mismo» se casa con tu libro por el título
  (sin mayúsculas, tildes ni signos); terminado cuenta 100 %. *Interpretación*: antes de abrir Amigos no se manda nada.
- «Visitar su piso» y «Leer juntos en la sala» dejan el ordenador en Amigos: Atrás vuelve a la agenda.

### 153.3 Pruebas

- **Vitest**: `amigos.rls.test.js` (7, Postgres con todas las migraciones): el código, el panel (amigos, solicitudes,
  esperando; tablas cerradas), lo que compartes y lo apagado, recomendar, Leemos el mismo con su privacidad, la llave para un
  amigo y un bloqueo que lo corta todo; `amigosLectura.test.js` (3).
- **e2e** (Supabase simulado: `mockSupabase.js` simula las funciones solo con `db.amigos`; sin él, como un servidor sin la
  migración): `v1153-amigos.spec.js` a 360, 390 y 1440 (la tarjeta y las fichas, recomendar y dar la llave, buscar por código
  y seguir también, el buzón y la mudanza, lo que ven, sin la migración) y `v1134-almacen-ordenador` sin cambios. Capturas en
  `qa-report/v1153/` y vídeo `qa-report/v1153/video/1153-amigos.webm` (con `AMIGOS_VIDEO=1`).
- Sin probar en móviles reales ni en WebKit.

## 154. Libo y los amigos (1.154.0)

Bloque 4 de 5 de `docs/qa/amigos-vecinos.md`. Encargo de Francisco del 26-11-2026: «que fuera del edificio tengas como un
telefonillo con funciones así, que Libo también esté relacionado». Sin migración nueva: Libo usa lo que ya da `amigos_panel()`
(§153.1).

### 154.1 Dos capítulos nuevos de la guía (`libo.js`)

- **El telefonillo** (capítulo 8, `TELEFONILLO`): la primera vez que abres el telefonillo del portal. Cinco pasos: qué es (tu
  edificio, solo para amigos: nadie entra sin llave), los botones de las puertas (el tuyo en verde, llamar a un vecino, las
  libres apagadas), «Dar una llave» (una vez, 7 días, quien la usa se muda con su piso), «Tengo una llave» (te dice de quién es
  antes de mudarte) y que el edificio crece por plantas hasta 5 (§152). Solo la vista de inicio, con sus botones de verdad.
  Libo se sienta arriba a la izquierda, por encima del velo del telefonillo (a la derecha está la ✕ del edificio), y al tocarle
  ofrece «Repasar el telefonillo».
- **La agenda de Amigos** (capítulo 9, `AMIGOS`): la primera vez que abres Amigos en el ordenador. Cinco pasos: quiénes son tus
  amigos (os seguís los dos) y las cuatro pestañas (Amigos, Buscar, Buzón y Lo que ven), cada una señalada. Libo se queda junto a
  las pestañas, con «Repasar la agenda».
- La guía del edificio gana un paso, **el telefonillo**, antes del café, y el paso de los vecinos ya no puede señalar el
  telefonillo como si fuera una ventana.

### 154.2 Sugerencias de tus amigos (`sugerencias.js`, `sugerenciasDeAmigos`)

Con las reglas de siempre de Libo (§ Libo, bloque 3): solo cosas de verdad, una al día como mucho, sin rachas ni prisas, y cada
una se calla un mes al contestarla. En tu piso, después de las reseñas y antes de los libros parados:

- **Una llave que te han dado** y aún no has usado: «X te ha dado la llave de su edificio. Si os apetece ser vecinos, la tienes
  en tu agenda de Amigos.» Con «Abrir Amigos» y «Ahora no».
- **Un libro que te han recomendado** y aún no has visto: «X te ha recomendado *título*. ¿Le echas un vistazo?», con «Ver la
  recomendación».
- **Un amigo ha terminado un libro que tienes en «Quiero leer»** (en los últimos 14 días, casado por el título como en §153.2):
  «X ha terminado *título*, que tienes en «Quiero leer». Por si te anima a empezarlo.», con «Ver su ficha» y «Abrir Amigos».

Tu agenda la pide `useAmigosLibo` (`useAvisosLibo.js`) con la misma consulta que la app Amigos, como mucho cada cinco minutos y
solo en tu piso; sin la migración o sin red, Libo no habla de amigos. «Abrir Amigos» lleva al ordenador, a la agenda
(`ordenador:amigos`).

### 154.3 Pruebas

- **Vitest**: `sugerencias.test.js` («Libo · lo de tus amigos», 2: las tres sugerencias y sus límites) y `libo.test.js` con los
  capítulos nuevos; 48 en total con las de amigos.
- **e2e** (Supabase simulado): `v1154-libo-amigos.spec.js` a 360, 390 y 1440: el capítulo del telefonillo paso a paso (cada
  tarjeta dentro de la pantalla, su hueco sobre el control y sin taparlo; Libo sin tapar la ✕ y su repaso), el de la agenda, y
  la sugerencia del día con la llave de Bruno que lleva al buzón y se calla al contestarla. Sin cambios en `v1151`, `v1152`,
  `v1153` ni en las siete de Libo (a 390). Capturas en `qa-report/v1154/` y vídeo `qa-report/v1154/video/1154-libo-amigos.webm`
  (con `LIBO_AMIGOS_VIDEO=1`). El simulador da por vistos también `telefonillo` y `amigos` (`bookshelf:libo`).
- Sin probar en móviles reales ni en WebKit.

## 155. Fuera las vistas isométricas, parte A (1.155.0)

Bloque 5 de 5 de `docs/qa/amigos-vecinos.md`. Francisco, 26-11-2026: «borra las vistas isometricas, ya no creo que las usemos
más». Se le enseñó la lista antes de borrar y confirmó la parte A («Sí, borra la A»); **la parte B se queda** hasta que haya 3D:
Decorar, tu piso desde la fachada (personaje, misiones, armario y el capítulo «tu-piso» de Libo), el respaldo de la habitación sin
3D y el mercadillo de la Lonja. Sin migración. No se borra ningún dato de usuarios.

### 155.1 La visita a un vecino, siempre en 3D

- Al llamar a la puerta de un vecino se entra directamente en su piso en 3D (`VisitaPiso`), sin la vista isométrica previa ni
  los botones «Entrar en 3D» y «Ver en isométrica». La etiqueta «Piso de X · puerta» queda arriba y la escena (con su tarjeta
  «Está leyendo») empieza debajo, sin taparse.
- Francisco eligió «Quitarla igualmente» sabiendo lo que se pierde, solo en la visita: **el personaje del vecino, su compañero
  legendario y los «me gusta» por mueble** (solo existían en la isométrica). Lo que ya está guardado no se borra (`piso_megusta`
  sigue ahí; en tu piso se siguen viendo los «me gusta» que te dieron). El libro de visitas y los regalos (`VecinoMesa`) siguen.
- Sin 3D en el móvil, la visita no se dibuja: un papel de píxel «Sin 3D en este móvil · No puede dibujar el piso de X, pero todo
  lo demás funciona igual» (`SinTresD.jsx`).

### 155.2 Sin «Plano» en el vestíbulo, y sin dibujos de respaldo

- El vestíbulo del hotel es siempre la recepción 3D; el botón «Plano» y su vista isométrica (`lobbyArt.js`) se van. Sin 3D, el
  vestíbulo enseña el papel de `SinTresD` y cuatro botones (Recepción, Ascensor, Tablón y Guardarropa) que abren los mismos
  papeles de siempre: los encargos, la botonera del ascensor (la «P» sale a la plaza), el tablón y el guardarropa. Escape cierra
  primero el papel y luego sale a la plaza.
- El casino (`casinoArt.js`), la sala de lectura (`salaArt.js`) y el café (el local vacío de `shopRoom.js`) ya no tienen dibujo de
  respaldo: sin 3D, el mismo papel y el juego, los sillones o Pilar funcionan igual. El «Plano» del casino y de la sala es el
  mapa 3D, no la isométrica: se queda.
- `SinTresD` (`edificio.css`, `.ed-sin3d`): papel de píxel, título en la letra de píxel, tinta oscura (también en el hotel, donde
  no hay `--ep-ink`).

### 155.3 Archivos retirados

`Tienda.jsx`, `tienda.css`, `GachaReveal.jsx` y `shopRoom.js` (la tienda isométrica del bajo, sustituida por el café 3D);
`hotel/lobbyArt.js`, `hotel/casinoArt.js` y `hotel/salaArt.js`; las páginas de desarrollo `dev/edificio-puerto.html`,
`dev/edificio-puerto-app.html`, `dev/tienda-dibujos.html`, `dev/vestibulo.html` y `devPage.js`; las pruebas `e2e/edificio-puerto` y
`v175-vestibulo` (sustituida por `v1155`). Los ayudantes de luz `GLOW`, `LIT`, `evening`, `toDataURL` y `outlineOf` se mudan a
`luzPixel.js` (los usa la Lonja). Se quedan `render.js`, `furniture.js`, `catalog.js`, `lobbyLayout.js`, `estibaArt.js` y
`demo.js`, que usa también el 3D.

### 155.4 Pruebas

- **e2e** (Supabase simulado): `v1155-sin-isometricas.spec.js` a 360, 390 y 1440 (12): la visita entra en 3D sin la isométrica y
  la etiqueta no tapa la tarjeta; sin 3D, el aviso de la visita debajo de la etiqueta; el vestíbulo sin 3D (botones legibles,
  encargos, botonera, «P» y Escape); el casino sin 3D. Ajustadas a la visita en 3D: `fase1-visitas`, `tablon`, `v1109-mapache`,
  `v1138`, `visita-directa`, `v189-rincon`, `v188`, `v163`, `v171`, `v1881`, `v1882-objetos`, `v1894-comprobaciones` y
  `v1894-evidencias`; a los respaldos sin 3D: `v1116`, `v1119`, `v1120` y `v198`; sin «Plano»: `recepcion3d-capturas`. Retiradas,
  con una nota: «en el piso de un vecino se ve su personaje» (`v169`) y «de visita: el compañero detrás» (`v172`).
- Fallan igual que antes, ajenas a este bloque (anotadas en ESTADO): `v163` «la tablet pregunta» (el chip «Plantas»), `v171` «en
  tu piso…» (`screenOfItem` nulo), `v188` (2: los muebles al abrir Decorar y «Cuenta y copias») y `v189` «un piso antiguo sin
  esenciales» (dos botones «Decorar»).
- Vitest de `edificio` y `pisoLab` en verde salvo lo ya anotado (`cafe-libreria.rls` › «el reparto», desde la 1.142; los de PGlite
  que se pasan de tiempo con todo a la vez pasan solos). Build en verde.
- Capturas en `qa-report/v1155/`. Sin probar en móviles reales ni en WebKit.

## 156. Las poses de Olmo y el Olmo 3D de su hoja (1.156.0)

Francisco, 26-11-2026: «Para después añade a olmo con las animaciones que te paso igual que a libo», con su hoja de poses
(`../libotown-marca/olmo-poses.png`, fuera de git). Preguntado cómo encajarlas con el modelo 3D, eligió el 27-11-2026 «Igualar el 3D
al dibujo»: las poses sustituyen al retrato de píxel en todos los sitios donde salía y el modelo 3D pasa a ser el mismo Olmo que el
de la hoja. Sin migración ni cambios en el servidor; solo se ve con la suscripción o con la vista previa de `cafe_probadores`.

### 156.1 Las 22 poses, recortadas de su hoja

- `scripts/olmo-poses.mjs` (como `scripts/libo-poses.mjs`): la hoja ya trae el fondo transparente, así que cada pose es la pieza
  opaca grande de su sitio (por filas de 6, 5, 5 y 6, de izquierda a derecha) y sus adornos sueltos («!», «?», corazones, «zZ», el
  polvo, el gatito…) van con el cuerpo más cercano. La hoja tiene **22** poses (no 24).
- Todas en un lienzo igual de **311 × 257**, apoyadas abajo y centradas, a la misma escala: al cambiar de pose Olmo no cambia de
  tamaño ni salta. WebP con alfa en `public/assets/olmo/poses/` (476 KB las 22); se piden una vez, en cuanto Olmo atiende.
- Nombres: libro, saluda, lee, camina, cafe, celebra, duerme, duda, carino, enfado, sorpresa, lee-feliz, corre, gatito, asoma,
  espaldas, mareado, estudia, descansa, llora, resopla y estrella.

### 156.2 Qué pose en cada momento (`cafe/olmoPoses.js`, reglas puras)

- **La franja del café**: de pie con su libro. Al tocarle, cada frase de `FRASES_OLMO` con su gesto (lee contento, la taza, duda,
  estudia, sorpresa, cariño, el gatito, descansa, la estrella…). **Cuatro toques en 2 s**: se marea 1,6 s y vuelve a lo suyo.
  **Sin tocar nada**: a los 30 s se sienta a leer y a los 90 s se duerme; cualquier toque, tecla o desplazamiento le despierta
  (`useReposoOlmo.js`, como Libo). Con movimiento reducido no cambia solo.
- **El cuadro de diálogo**: con su libro. **La guía del café**: saluda en el primer paso, camina y lee por el camino (cariño en los
  pasos contentos) y celebra el último.
- **La barra**: se ofrece saludando; mientras prepara, con la taza; «esto ya lo dominas», la estrella. **La caja del mostrador**:
  con la taza, y celebra al terminar. **El obrador**: caminando. **El tostadero**: resoplando el humo. **Su cuaderno**: estudiando.
- `PixelArt` dibuja también estas imágenes (`{ src, pose }` → `<img class="cf3-px cf3-px--pose" data-pose>`), recortadas en el
  marco del retrato desde abajo (`object-fit: cover`), sin pixelar. Pilar no cambia.

### 156.3 El Olmo 3D, el de la hoja

- `cafe/olmo3d.js`: plumaje pardo rojizo, cara y tripa crema, **gafas naranjas gruesas**, ojos claros con pupila oscura y
  **bufanda a rayas roja y verde** (sin el hilo amarillo). **Sin el chaleco mostaza**, ni su escote ni sus botones: el pecho es del
  mismo plumaje, con plumas más oscuras en uve. Los gestos del 3D (respirar, parpadear, mirar, preparar con las alas) no cambian.
- El retrato de píxel sacado del 3D (`retratoOlmo`, 1.150) se quita: ya no lo usa nadie.

### 156.4 Pruebas

- `cafe-olmo.test.js`: el 3D sin mostaza y con los colores de la hoja; las 22 poses existen y miden 311 × 257; momentos, guía,
  reposo y frases.
- `e2e-community/v1150-cafe-olmo.spec.js` (360, 390 y escritorio): la franja con sus poses (habla, mareo), el reposo con el reloj
  acelerado (lee, duerme y despierta), nada solo con movimiento reducido, y la oferta y la preparación con su pose; capturas del 3D
  de frente y de lado en `qa-report/v1156/`. `v1150-cafe-guia.spec.js`: saluda al empezar, camina por el camino y celebra al final.

## 157. Fuera la habitación ilustrada, guardada en el archivo (1.157.0)

Francisco, 26-11-2026: «quiero que se borre la versión antigua de la aplicación porque sigue saliendo cuando la gente se mete en
la web para instalar la app». Investigado el 27-11-2026 (era la habitación ilustrada de la 1.86, a la que se llegaba con «Volver
a la experiencia anterior»), decidió «Bórrala, pero déjala aparte en otra carpeta aquí por si acaso la necesitamos en el futuro» y
confirmó la lista de `docs/qa/borrar-habitacion-ilustrada.md` («Sí, adelante»). Sin migración ni cambios en el servidor; **ningún
dato de nadie se borra**. Esto sustituye a todo lo que en este SPEC describe la habitación ilustrada como parte de la app (§1 a
§86 y sus retoques posteriores): desde aquí es historia, guardada en `archivo/habitacion-ilustrada/`.

### 157.1 El inicio es siempre tu piso

- `src/features/pisoLab/inicio.js` queda solo con `HOME_PISO`. Ya no hay `__PISO_INICIO__` (`vite.config.js`), ni `?inicio=`,
  ni «Volver a la experiencia anterior» (ni en la pantalla sin cuenta ni en el Menú del piso, `PisoLabPanel.jsx`).
- `App.jsx` ya no monta el panorama (`PanoramicRoom` con `CozyRoom` y `SocialRoom`), ni `RoomCorner`, ni la guía
  `useOnboarding`, ni el panel `balda`. Sin panel delante, la app abre tu piso (`{ type: 'pisoLab', id: 'mio' }`); en el piloto
  (`?piloto=piso`, fuera de producción), su portal de prueba. Mi biblioteca, la ficha, el registro, el ordenador, el edificio y
  todos los paneles no cambian.
- **Sin cuenta**: la pantalla de entrada con «Abrir «Tu cuenta»» y «Abrir Mi biblioteca»; Mi biblioteca sigue funcionando en el
  dispositivo y Atrás vuelve a la entrada. **Con cuenta**: tu piso.
- Quien tenía elegida la experiencia anterior en su móvil (`bookshelf:inicio = anterior`) entra en su piso; esa preferencia se
  ignora y **no se borra**. El aviso de la mudanza a libotown.es (`AvisoDireccion`) sale solo en tu piso.
- Lo que solo estaba en la habitación y ya tiene sitio en el piso: el registro (el libro de la cama), el temporizador (la
  bandeja), la radio, el atlas, la cuenta y el ordenador. **Se pierden** el salón social ilustrado con sus sillones (la comunidad
  sigue en el ordenador) y la guía «Descubrir mi habitación» (Libo sigue guiando en el piso).

### 157.2 Qué se guarda en `archivo/habitacion-ilustrada/` (fuera de la app)

- Con su misma ruta y un `LEEME.md` que explica qué es y cómo volver a enchufarla: 40 módulos (`src/components/room/` entero, la
  guía antigua, `src/scene/` salvo `sceneMap.js` y `renderMode.js`, `useSceneArt`, `useSvgIds`, `useToday`, `spineArt`, los
  sillones `SocialSeats` y `SeatCard`), `sceneMap.js` completo, sus pruebas unitarias (`onboarding`, `sea`, `stageFit`, `v127` y
  las partes de `v128` y `seats162` que eran suyas) y sus imágenes (unos 7 MB).
- Vite no la compila (nada de `src/` la importa), Vitest y Playwright no la ejecutan y Tailwind no lee sus clases
  (`@source not '../archivo'`, al final de `src/index.css`).
- `src/scene/sceneMap.js` queda con `asset` y la medida del fondo de Mi biblioteca (`SCENE_SRC`, 941 × 1672).

### 157.3 Estilos e imágenes

- `room-151.css`, `room-152.css`, `room-160.css` y `room-signs-137.css`, enteras al archivo (y fuera de `src/index.css`).
- `room.css` (de 94 a 5 KB), `room-146.css`, `room-147.css`, `room-149.css` y `rincon-01.css`: la hoja completa al archivo y en
  la app solo las reglas que aún pinta algo vivo (el registro de lectura, el aviso de deshacer, la cabecera de la biblioteca, el
  modo ligero de móvil…), **en su mismo sitio**, para no cambiar el orden de la cascada. La poda es por selector: se queda el que
  solo usa clases que aparecen en el código vivo, y las `@keyframes` que alguien sigue usando.
- Imágenes al archivo: `cozy-social-room.jpg`, `laptop-foreground.png`, la copia antigua `/cozy-book-room.jpg`, `room-refresh/`
  (salvo `pantalla-bahia.webp`, del lector EPUB), `assets/room/libro-abierto.webp` y `placa-papel-ramita.webp` y tres placas de
  `assets/ui/`. Se quedan `images/cozy-book-room.jpg` (fondo de Mi biblioteca, precargado) y `boton-terracota-cosido.webp`.
- `public/sw.js`: la precarga (`CORE`) ya no pide la ilustración del salón ni el portátil.

### 157.4 Atrás con una capa cerrándose (WebKit)

- Visto al comprobar este bloque, y ya pasaba antes: en WebKit, «Abrir Mi biblioteca» abría la biblioteca y la volvía a cerrar.
  Al tocar el botón, el `pointerdown` cierra el bocadillo de Libo; su capa sale del historial con `history.go(-1)`
  (`hooks/useAtras.js`), que es asíncrono, y el click navegaba antes de que llegara su `popstate`: la biblioteca caía en la
  entrada que se estaba quitando y el `popstate` la deshacía.
- `domain/navigation.js`: `retirandoCapas()`, que `useAtras` llama justo antes de su `go(-n)`. Hasta que llega ese `popstate`, el
  navegador guarda lo que se le pide (ir, reemplazar, volver) y lo aplica después, en orden; si no llegara en 600 ms, lo aplica
  igual. Afecta a cualquier botón que cierre una capa al tocarlo y navegue a la vez, no solo a este.

### 157.5 Pruebas

- `e2e-community/v1157-sin-habitacion.spec.js` (390 en Chromium y WebKit, y 1440): sin cuenta desde la web (la entrada, Mi
  biblioteca y Atrás); con cuenta (tu piso y su menú, sin la experiencia anterior); con `bookshelf:inicio = anterior` y
  `?inicio=anterior`, tu piso y la preferencia intacta; y sin cuenta con esa preferencia, la entrada. En ninguna, nada de la
  habitación. Capturas en `qa-report/v1157/`, comparadas con las de antes del cambio.
- `navigation.test.js`: la carrera de la capa con un `go` asíncrono.
- Las de `e2e/` y `e2e-community/` que entraban por la habitación, en el bloque 2 (§157.6).

### 157.6 Las pruebas, sin la habitación (bloque 2)

- **Entrada común** (`e2e-community/entrada.js`, y `e2e/entrada.js` la reexporta): al edificio se baja con «Al edificio»
  (`alEdificio`), no por la tablet del salón. Lo que se abría tocando la habitación se abre con la navegación de la app,
  con el mismo panel de siempre: la cuenta, Mi biblioteca, la ficha y el registro del libro que lees, el ordenador y la
  bandeja (`abrir`, `abrirCuenta`, `abrirBiblioteca`, `abrirLibroActual`, `abrirRegistro`, `abrirOrdenador`,
  `abrirBandeja`). `esperarInicio` espera a tu piso (o a la entrada), o al panel o la biblioteca con que arranca la prueba;
  `enInicio` sustituye a «ningún panel abierto», porque tu piso también es un panel.
- **Adaptadas**: unas 80 pruebas de `e2e/` y `e2e-community/` (las del registro ya no dependen de la pantalla vertical).
  `e2e/piso-inicio.spec.js`, reescrita: el inicio es siempre tu piso, sin botón a la experiencia anterior; la elección
  antigua del dispositivo y `?inicio=` llevan a tu piso sin borrar nada; y una entrada antigua del historial abre tu piso.
- **Archivadas** en `archivo/habitacion-ilustrada/e2e/` y `e2e-community/` las que solo probaban la habitación: nueve
  archivos enteros (anexos, diegetic, gouache, panorama, rincon-01-estanteria y -capturas, v149, v152, libo-ventana) y
  partes de otros (`*-habitacion.spec.js`: ia1, v128, v135, v146, v147, v148, v154, v162-radio, entrega3, v162), con una
  nota de dónde está cada original (`git show 2948485:…`).
- **Un fallo de la app que destaparon** (§157.7).

### 157.7 La nota de la llave y la de la invitación, otra vez tocables

`<main>` es `inert` con un panel abierto, y tu piso, el inicio, siempre lo es: la nota de una llave de edificio
(`#llave=…`) y la de una invitación a un club (`#club=…`) se veían encima de tu piso pero no se podían tocar. En local
no se notaba porque se empezaba en la habitación ilustrada, sin panel. Desde la 1.157 las dos notas (`LlaveHandler`,
`InviteHandler`) se pintan en la capa de los paneles (`modalRoot`), como el aviso de «Deshacer».

### 157.8 Mi biblioteca, encima de tu piso

Desde tu piso (y desde la pantalla de entrada sin cuenta), «Abrir Mi biblioteca» sustituía la entrada del historial en vez de
añadir una: Atrás del móvil salía de la app en vez de volver a tu piso (las pruebas de WebKit lo pillaban cuando a la vez se
cerraba un bocadillo de Libo). Ahora se abre encima (`nav.go`) y Atrás vuelve a tu piso; desde el ordenador sigue sustituyendo
al ordenador, como antes.

### 157.9 Lo que no se arregla aquí

Fallan igual en la 1.156.0 (comprobado pasándolas en una copia de `2948485`), así que no son de este cambio y se quedan
anotadas en `docs/ESTADO.md`: en `e2e/`, `v123` (tres del calendario y los sonidos), `v128` (el calendario), `v147` y `v148`
(el registro, que espera los textos del formulario de antes de la 1.90); en `e2e-community/`, ocho del café (`v1121`,
`v1122`, `v1123`, `v1125`, `v1126`, `v1130`, `v1131`, `v1140`), `v162` (dos), `v163`, `v170` (dos), `v171`, `v178` y
`v186` (dos). Otras cuatro del café (`v1127`, `v1132`, `v1133`, `v1143`) solo fallan con muchas pruebas a la vez: solas pasan.

## 158. «Lo de hoy»: el menú de Libo en tu piso (1.158.0)

Francisco, 26-11-2026: «que el menú de libo sea mas gracioso y limpio, y que te diga de manera limpia y atractiva que cosas
puedes hacer en el dia». Dos propuestas (27-11-2026): de la primera, «Sí, que pregunte» (Libo puede preguntar al servidor) y
«darle más identidad pixel pero sin saturar y que los iconos sean más originales»; de la segunda, «Sí, constrúyelo». Todo el
detalle, en `docs/qa/libo-lo-de-hoy.md`. Sin migración: usa las RPC que ya existen.

### 158.1 La tarjeta

- En tu piso de inicio, el bocadillo de Libo (`LiboRincon.jsx`, `LoDeHoy`) es una tarjeta de papel con marco de madera de
  esquinas escalonadas, pestaña «Lo de hoy», botón de cerrar de 44 px, un saludo que cuenta lo que hay («Hoy tienes **seis
  cosas** por aquí. Ninguna corre prisa.»), filas tocables enteras (icono, dato en letra de píxel, frase con gracia, flecha o
  número) y, al pie, la sugerencia del día («Idea de Libo»). Como mucho cinco filas; «ver todo» enseña el resto. Lo hecho hoy
  va al final, en verde y sin botón; con todo hecho, Libo se duerme en su esquina y dice «Mañana: vuelvo a asomarme».
- Fuera de tu piso el bocadillo de Libo no cambia. Sustituye a la lista de tiras de §2.4 de `docs/qa/libo.md` (bloque 3): los
  avisos y la sugerencia son los mismos, con el dato en corto (`icono`, `titulo`, `gracia` en `avisosDeLibo`).

### 158.2 Lo que pregunta al servidor

- Al **abrir** la tarjeta (no al llegar: el corazón y el asomo de una vez al día no cambian), `cargarHoyLibo`
  (`useAvisosLibo.js`) pide `loadCasino`, `loadRuleta` y `loadArmario` del día, con caché de un minuto. `hoyDeLibo`
  (`sugerencias.js`) saca las filas: las mesas para dos que te esperan, las manos del casino que quedan, las misiones del día
  (de las tres de `missionsOf`) y la ruleta de la semana sin girar. Lo que falle llega como null y no se dice.

### 158.3 Los iconos

- `src/features/libo/iconos.js`: ocho iconos propios de 11 × 11 dibujados a mano con la tinta de `pixelUi.js` (casino,
  buzón, rebaja, nuevo, café, misiones, ruleta, hecho), pintados como SVG nítido. Nunca de una librería.

### 158.4 Adónde lleva cada fila

- Las de siempre (buzón, almacén, café) y, nuevas: `casino` (`{ type: 'edificio', id: 'hotel', section: 'casino' }`: el hotel
  abre directamente en el casino y Atrás o «A tu piso» vuelven a tu piso, como el almacén al ordenador) y `misiones` (tu piso
  del edificio, con el botón «Hoy»).

### 158.5 Comprobación

- Unitarias: `src/features/libo/__tests__/loDeHoy.test.js`. e2e con Supabase simulado: `v1158-libo-lo-de-hoy.spec.js`
  (nueva) y `libo-avisos.spec.js` (adaptada); capturas en `qa-report/v1158-lo-de-hoy/`. Emulación: no equivale a un iPhone.

## 159. La red de seguridad: el ordenador en negro en un iPhone (1.159.0)

Aviso de Francisco (27-11-2026): a una compañera, en un iPhone, el ordenador del piso se le queda en negro. Detalle en
`docs/qa/ordenador-negro.md`. Sin migración.

### 159.1 La causa más probable

- La app no tenía red de seguridad: un fallo al pintar desmontaba todo y quedaba el fondo `#351c0e`. Con la app abierta
  días en el iPhone y una versión nueva publicada, el trozo de código del escritorio de la versión vieja da 404 al abrir el
  ordenador («Importing a module script failed.»). Reproducido en WebKit; no confirmado en su iPhone.

### 159.2 La red de seguridad

- `src/ui/RedDeSeguridad.jsx` envuelve la app (`main.jsx`). Con un trozo perdido (`esTrozoPerdido`, `src/ui/recarga.js`)
  recarga una vez («Poniendo Libotown al día…»; como mucho una cada 30 s, `bookshelf:recarga-version` en `sessionStorage`).
  Si no, la escena de Libotown con un aviso de papel bajo las letras: «Algo no se ha abierto bien.», Recargar, Ir al inicio
  (vacía el historial) y «Detalles del fallo». Estilos en `index.css`. `vite:preloadError` hace la misma recarga única.

### 159.3 Comprobación

- Unitarias: `src/ui/__tests__/redDeSeguridad.test.js`. e2e: `e2e-community/v1159-red-seguridad.spec.js` (Chromium y
  WebKit a 390); capturas en `qa-report/v1159-red-seguridad/`. Emulación: no equivale a un iPhone.

## 160. Los Libocoins, bloque 1: el nombre y la moneda (1.160.0)

Encargo de Francisco (27-11-2026): los tickets, una moneda con identidad, «libocoins o algo por el estilo», con la cara de Libo.
Plan aprobado («Sí, así») en `docs/qa/libocoins.md`: tres bloques; este es el primero. Sin migración.

### 160.1 El nombre

- Todo lo visible dice **Libocoins** (singular «Libocoin»), también la web: precios, saldos, la caja, la ropa, la Lonja, la lata
  del casino, las misiones del ordenador y del vestíbulo, las diarias del piso y los logros del café. `MONEDA`, `libocoinsText`
  y `conLibocoins` en `src/domain/libocoins.js` (sin dependencias); `ticketsText` de `economy.js` es `libocoinsText`.
- **Por dentro siguen siendo `tickets`** (servidor, Supabase, código y claves). Los mensajes del servidor que dicen «tickets» se
  leen con el nombre nuevo en `fail()` (`src/features/social/services/community.js`, `conLibocoins`).

### 160.2 La moneda

- El dibujo de Francisco (`../libotown-marca/libocoin.webp`, fuera de git) se recorta al borde de la moneda con
  `scripts/libocoin.mjs` en `public/assets/libo/libocoin-{24,48,96,192}.webp`; nunca se redibuja. `src/ui/Libocoin.jsx` la
  pinta con su `srcSet` (solo adorno: la cifra y la palabra van en texto).
- Sustituye a la tira roja de ticket en el cartel del café (`.cf3-logro__ticket`) y al icono de ticket en las misiones del
  ordenador (saldo y «Cobrar»); en el casillero del vestíbulo va delante del saldo.

### 160.3 Comprobación

- Unitaria `src/domain/__tests__/libocoins.test.js`. Las e2e que esperaban «tickets» esperan «Libocoins» (las comprobaciones,
  no los selectores ni los datos internos). Emulación: no equivale a un móvil real.

## 161. Los Libocoins, bloque 2: el saldo junto a Libo (1.161.0)

Segundo bloque del plan aprobado en `docs/qa/libocoins.md` («Sí, así»; Francisco, «Sí, el bloque 2»). Sin migración.

### 161.1 La moneda a su pata

- Donde está Libo (tu piso, el portal, tu piso del edificio, el café, el vestíbulo del hotel…), **su moneda con tu saldo**:
  pegada a su pata y un poco por delante de él, como si la sujetara, con la cifra en la letra de píxel de la casa
  (contorno de un píxel y sombra dura, sin caja). Francisco vio una primera versión en una placa de papel encima de su
  cabeza y pidió algo «más natural»; eligió «Junto a su pata». Respira con Libo; con movimiento reducido, quieta.
- Se toca en 44 px. **No sale** donde Libo se aparta (la barra y lo demás del café, las salas del hotel, el armario), en la
  cabecera de los cuadernos (comunidad, amigos) ni en el telefonillo; tampoco sin sesión o sin la comunidad activa.
- En tu piso del edificio, a su izquierda están Decorar y el armario: ahí la moneda entra un poco más en Libo (a 360 px el
  hueco es justo).

### 161.2 La nota de papel

- Tocar la moneda abre una nota en el sitio del bocadillo de Libo: «Tienes N Libocoins», cómo se ganan (misiones de la
  semana, las tres del día con toda la ropa, subir de nivel el café y su extra diario, la lata del casino y la Lonja) y dónde
  se gastan (el almacén, con su planta de ropa, y la Lonja). Sin botones de compra ni nada que meta prisa.
- Se cierra tocando fuera, con su cruz, con Escape o con Atrás del móvil (`useAtras`); nunca a la vez que el bocadillo de Libo.

### 161.3 De dónde sale el saldo

- Un solo dato para toda la app, `src/features/edificio/saldo.js` (sin React ni servidor). Lo publica cada respuesta del
  servidor que ya trae el saldo: el inventario (`inventario()` en `service.js`: cargar, cobrar misiones, comprar, el carrito
  del almacén…), la Lonja y la caja del almacén. Se olvida al cambiar de cuenta o cerrar sesión (`useCommunity`).
- `useSaldoLibo` (`src/features/libo/`) lo lee y, al llegar a una escena, si lo último tiene más de 10 s, pregunta una vez por
  el inventario (la misma consulta que tu piso). Si falla (sin red, sin la migración), la moneda no sale.

### 161.4 Comprobación

- e2e `e2e-community/v1161-libocoins-saldo.spec.js` (Chromium 360 y 390, WebKit 390): la moneda en tu piso, el portal, tu piso
  del edificio y el café, pegada a Libo y sin tapar los controles; la nota, dentro de la pantalla y con botones de 44 px;
  Atrás, la cruz y Libo la cierran; lo ganado en otro sitio llega al cambiar de escena; en el armario no está. Emulación.

## 162. Los Libocoins, bloque 3: Libo lo celebra (1.162.0)

Tercer y último bloque del plan aprobado en `docs/qa/libocoins.md` («Sí, así»; Francisco, «Sí, el bloque 3»). Sin migración.

### 162.1 La fiesta

- Cuando el saldo sube, **las monedas saltan a la de Libo**: de 3 a 5 (una por cada 10 ganados, como mínimo 3), una detrás de
  otra, desde arriba a la izquierda (en el café, donde Libo está arriba, desde abajo). La suya da un botecito con cada una.
- **Libo pone su pose «celebra»** (la de su hoja, `poses.js`), sale **«+N»** en la letra de píxel, en ámbar, sobre su moneda,
  y **la cifra sube** de lo que tenías a lo nuevo cuando cae la primera. Dura unos 3 s y se acaba sola; no se repite.
- **Un tintineo** por moneda, cada una un poco más aguda, al ritmo en que caen (`src/features/libo/tintineo.js`). Sintetizado,
  corto y suave, por el bus de «Sonidos táctiles»: respeta el silencio y su volumen y solo suena si el audio ya existe (tras un
  toque). Cuando se haga lo de los sonidos de lumina-sfx, su `coin-pickup-chime` puede sustituirlo.
- **Con movimiento reducido**, solo cambia la cifra (y un tintineo); ni monedas, ni bote, ni pose.
- Para los lectores de pantalla, «Has ganado N Libocoins» (`role="status"`).

### 162.2 Cuándo se celebra

- **Solo con la moneda a la vista**: la página delante y lo primero bajo la moneda es ella (no la tapa una hoja, el ordenador
  ni la guía). Si lo ganas donde Libo no está (el ordenador encima, el casino, la Lonja, la barra del café), lo ganado espera y
  Libo lo celebra **al volver a verle**, sumado.
- Vale para todo lo que sube el saldo, porque sale del mismo dato (`saldo.js`): misiones, las tres del día con toda la ropa,
  el café, la lata del casino, la Lonja… Lo que llega al cambiar de escena (la consulta del inventario de §161.3) también.
- **La primera cifra de una sesión nunca cuenta como ganada** (es lo que ya tenías), ni al cambiar de cuenta. Si gastas antes de
  verle, se celebra como mucho tu saldo. Las reglas de cuándo se ganan no cambian.

### 162.3 Por dentro

- `saldo.js` apunta lo ganado (`ganado`) cuando una cifra nueva es mayor que la anterior; `tomarGanado()` lo devuelve y lo deja
  a cero. `useSaldoLibo` devuelve `{ tickets, ganado }`. La fiesta vive en `Monedero` (`LiboRincon.jsx`), que mira cada
  700 ms si la moneda ya se ve; estilos al final de `libo.css`.

### 162.4 Comprobación

- e2e `e2e-community/v1162-libocoins-fiesta.spec.js` (Chromium 360 y 390, WebKit 390): cobras una misión en el ordenador
  (60 → 72) y, con el ordenador encima, no hay fiesta; al volver a tu piso, 3 monedas, «+12», la pose «celebra», el aviso para
  lectores de pantalla y la cifra que llega a 72; se acaba sola y no se repite. Con movimiento reducido (390), solo la cifra.
- `v1161-libocoins-saldo` espera a que acabe la fiesta del portal (75) antes de medir. Emulación.

### 162.5 El pie de «Lo de hoy», siempre entero (1.162.1)

- Pendiente desde la 1.158: con muchas filas (a 360 px, tras «ver todo»), los botones de la idea de Libo y los enlaces del pie
  («Repasar la bienvenida», «Ajustes de Libo») quedaban cortados o fuera de la tarjeta hasta que bajabas. Francisco eligió
  arreglarlo («Pie de «Lo de hoy»»).
- Ahora la cabecera, la idea y el pie no se encogen y **solo se desplaza el medio** (el saludo, las filas y «ver todo»,
  `.libo-hoy__cuerpo`). Si queda algo por ver arriba o abajo, en ese borde sale una raya de píxel con una sombra suave; al
  llegar al final, el papel la tapa. Sin cambios en lo que dice ni en lo que hace.
- e2e `v1158-libo-lo-de-hoy` (Chromium 360 y 390, WebKit 390): tras «ver todo», sin bajar, los botones de la idea están enteros
  dentro de la tarjeta, y la última fila queda por encima de la idea al llevarla a la vista. Emulación.

### 162.6 Lo del iPhone de su compañera: la versión vieja, el 3D que vuelve y la carga de la comunidad (1.162.2)

Francisco, 28-11-2026, con dos capturas: el café «a veces» con el dibujo isométrico y, al tocar Comunidad en el ordenador, la
pantalla marrón. Plan de lo demás del encargo en `docs/qa/comunidad-visita.md`.

- **La versión nueva llega de verdad** (`src/ui/versionNueva.js`, `main.jsx`). Su café era el isométrico que se quitó en la
  1.155: el iPhone seguía días con el código de antes en memoria, porque la versión nueva se ponía al pasar a segundo plano
  pero sin recargar (§11.6). Ahora, si mientras estabas fuera se ha puesto una versión nueva, al volver se recarga (vuelves a
  donde estabas: la ubicación está en el historial). Nunca con un campo de texto con el foco (se espera a la vuelta siguiente)
  ni en la primera instalación. Cada vuelta, como mucho cada 15 minutos, pregunta si hay otra (`reg.update()`). Sustituye al
  «sin recargar» de §11.6.
- **El 3D que se pierde y vuelve** (`src/features/edificio/contexto3d.js`): la fachada, el café, la recepción, el almacén, el
  casino y la sala de lectura se rendían en cuanto el móvil les quitaba el WebGL (al ir a otra app) y salía «Sin 3D en este
  móvil». Ahora, como tu piso, esperan con la página delante 3 s a que vuelva; en segundo plano no cuenta. Y al salir de cada
  una se suelta su contexto (`forceContextLoss`): en el iPhone hay pocos.
- **Abrir la comunidad**: mientras se descarga, la pantalla de carga de Libotown con «Abriendo la comunidad…» (antes, nada: el
  fondo marrón) y, en el perfil de un lector, «Abriendo su perfil…». El aviso «Abriendo tu piso…» del fondo solo se escribe
  bajo tu piso.
- Comprobación: e2e `e2e-community/v11622-3d-vuelve.spec.js` (Chromium 360 y 390, WebKit 390): el café pierde el contexto y lo
  recupera sin aviso y vuelve a dibujar; si no lo recupera, el aviso a los pocos segundos; Comunidad con la descarga retrasada
  enseña «Abriendo la comunidad…» y nunca «Abriendo tu piso…». Unitarias `src/ui/__tests__/versionNueva.test.js` (8).
  Emulación: no se ha probado en su iPhone.

## 163. El telefonillo, que se vea que se toca (1.163.0)

Francisco, 28-11-2026: «el telefonillo debería tener un indicador visual de que es clicable». Bloque 1 del plan de
`docs/qa/comunidad-visita.md` (aprobado «Sí, en ese orden»). Hasta ahora era una plaquita de latón junto al portal, sin nada
que dijera que se toca.

- **Su luz**: un cuadrado de píxel ámbar con su filo oscuro, encendido sobre la rejilla del telefonillo. Respira despacio
  (sin apagarse nunca) y, mientras no lo has abierto nunca en este dispositivo (`is-nuevo`, la marca de la 1.151), parpadea
  como una llamada; sustituye al marco que parpadeaba alrededor. Con movimiento reducido, quieta. Sin «!»: esas son para
  avisos de verdad.
- **Su plaquita**: latón claro con el contorno de nogal de las placas de la fachada (§124) y solo el auricular de píxel, en la
  pared al pie del telefonillo. Con «Telefonillo» escrito, en la acera, Francisco la vio y dijo que «ocupa demasiado»; el
  nombre lo dice la etiqueta accesible del botón. Es parte del botón: tocarla abre el telefonillo. Se mueve con la vista.
- Código: `adornarTelefonillo()` en `src/features/edificio/placas.js`, que usan la calle 3D (`calleView.js`) y la fachada 2D
  (`facadeView.js`); estilos en `placas.css`.
- Comprobación: e2e `e2e-community/v1163-telefonillo-se-toca.spec.js` (Chromium 360 y 390, WebKit 390): luz y plaquita visibles
  (solo el auricular, menos de 40 px de ancho), entera en pantalla y sin tapar la del hotel, la luz llama la primera vez y respira después, y tocar la placa abre
  el telefonillo. Siguen pasando `v1151-telefonillo` y `v1154-libo-amigos`. Emulación.
