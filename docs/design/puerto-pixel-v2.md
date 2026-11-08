# Puerto Pixel v2 · primera fase: ordenador y registro

Paquete `BookShelf-Pixel-v2.zip` (8-11-2026). Esta fase cubre solo lo que el paquete pide antes de extender: ordenador y registro, de día y de noche. Sin commit, en revisión.

## Dónde está

| Pieza | Archivo |
| --- | --- |
| Tokens, marcos y estilos (capa aparte, prefijo `pp-`) | `src/theme/puerto-pixel.css` |
| Objetos del atlas y controles de 24 px | `src/ui/PixelIcon.jsx` |
| Escritorio | `src/features/pisoLab/PisoDesktop.jsx`, `src/components/computer/ComputerShell.jsx` |
| Registro | `src/components/panels/ReadingLogSheet.jsx`, `ReadingEntryForm.jsx` (`source="room"`) |
| Recursos adaptados | `public/assets/puerto/` |

## Recursos

Procedencia según el paquete: atlas y fondos generados con IA para este proyecto; SVG, fuente y CSS creados para el paquete.

| Original | En la app | Peso |
| --- | --- | --- |
| `atlas-objetos.png`, 1448 × 1086, 1,62 MB | WebP con alfa, celda 288 px | 342 KB |
| `fondo-puerto.png`, 887 × 1774, 1,32 MB | WebP, 780 px de ancho | 44 KB |
| `fondo-puerto-noche.png`, 1,23 MB | WebP, 780 px de ancho | 29 KB |
| SVG y `puerto-pixel.ttf` | Sin cambios | 18 KB la fuente |

Las imágenes se piden al abrir el ordenador, no al cargar la app. El audio del paquete no se ha integrado: corresponde a la fase de Sonido.

## Diferencias con la lámina y motivos

- **Título en mayúsculas:** la fuente PuertoPixel no tiene minúsculas propias. La lámina las muestra.
- **Fondo del registro:** detrás está la habitación real, no la ilustrada, como pide el encargo.
- **Sin aspa en «Leyendo ahora»:** en la lámina no corresponde a ninguna acción existente.
- **Sin «Cada página cuenta»:** texto decorativo de la ilustración.
- **«Más funciones» en la barra:** no está en la lámina. Lleva a las funciones que no caben en los seis objetos.
- **Selector y fecha:** tocar el libro abre el selector de lectura y tocar la fecha abre el calendario, para no perder esas funciones.
- **Foco:** el cian del CSS de ejemplo no llega a 3:1 sobre papel; se usa petróleo de día, cian de noche y amarillo sobre el fondo.
- **`image-rendering: pixelated`:** retirado en los objetos, porque se dibujan reducidos y ese modo los dentaría.
- **Fondo petróleo:** ajustado al color superior de cada imagen (#114e56 y #042734) para que no se vea el corte.

Los textos del resumen, del selector y de los errores salen de los datos reales.

## Ajuste v3 (8-11-2026): lo que cambia sobre lo anterior

| Tema | Antes (v2) | Ahora |
| --- | --- | --- |
| Envoltorio | Ventana de papel | Carcasa marfil de 10–12 px, borde oscuro, esquinas escalonadas y LED |
| Sistema | Papel | Barra de título de 48 px, barra de tareas de 46 px y ventana en gris salvia |
| Fondo | Petróleo liso | Cielo continuo sobre el mismo puerto (`cielo-puerto.webp`, `cielo-puerto-noche.webp`) |
| Otras funciones | Bajo «Más funciones» | Cajón «Aplicaciones» con «Volver al escritorio» |
| «Leyendo ahora» | Tarjeta de papel | Ventana compacta, unos 136 px |
| Registro de noche | Gris azulado | Papel #C6B18A, tinta #30251F y marco atenuado |
| Registro | Portada de 96 × 144 | Portada de 82 × 124 y menos hueco bajo la fecha |

Se conservan los seis iconos del atlas, el cuaderno, la lógica del registro y el resto de funciones.

### Fondo

El cielo se genera por píxeles a partir de los fondos v2: solo cambian los tonos petróleo por encima del horizonte, con un degradado por bandas. Casas, flores, mar y faro no se tocan. No se usa la lámina como fondo.

### Portadas: qué se observó y qué se hizo

- **Cambio de libro:** si el libro nuevo aún no se había pedido, `Cover` usaba el estado del anterior y podía pintar una imagen a medio cargar. Corregido para todas las portadas.
- **Portada parcial u oscura:** cada `<img>` nuevo podía volver a pedirse y pintarse a trozos, aunque la precarga hubiese terminado. Se vio en capturas y vídeo; no se ha aislado la causa exacta en el navegador.
- **Solución en ordenador y registro:** `SteadyImage` carga la imagen, la decodifica y la copia entera a un lienzo. Mientras tanto se ve la cubierta con el título. Las 6 últimas se guardan en memoria, sin descargas de toda la biblioteca ni base64.
- **Biblioteca y estanterías:** siguen como estaban, salvo que la precarga ahora avisa ya decodificada.

### Diferencias con la lámina v3

- Sin reloj: es opcional, y la hora real no siempre coincidiría con la hora elegida en el piso.
- Títulos cortos en PuertoPixel, en mayúsculas.
- «184 / 420» sin la palabra páginas, como en la lámina.
- Sin la X de «Leyendo ahora», como pide el encargo.

## Menú, calendario y radio (8-11-2026)

Sin commit, en revisión. Los datos, rutas y acciones son los de 1.90.

- **Menú:** organizador de madera con seis objetos del atlas y placa. «Decorar» ya existía en la barra y ahora también está aquí. Calendario y Mi diario, en una balda pequeña. «Registrar lectura» queda fijo al pie si hay que desplazar.
- **Calendario:** agenda dentro del monitor, con anillas, lomo burdeos, cuadrícula real y marca de libro (`marca-lectura.svg`, dibujada para esto) en los días con lectura. Se conservan editar y borrar registros.
- **Radio:** interruptor general, tres deslizadores HTML, silencio por canal (nuevo: guarda el volumen y lo devuelve al quitarlo, solo durante la sesión), ambientes y casetes con los radios de siempre.

### Audio del paquete: no integrado

Las cuatro pistas del paquete son distintas y más cortas que los bucles de 1.90 (mar y lluvia, 193 KB frente a 408 KB). El paquete pide probar uniones y clics antes de publicar, y los bucles de 1.90 ya tienen esa medición (`docs/audio/`), así que siguen ellos. Los `.wav` de efectos tampoco se integran: los efectos siguen sintetizados.

### Diferencias con las láminas 02 y 03

- **Sin play/pausa ni «Silenciar» grande:** la app no tiene pausa, y silenciar ya es el interruptor. No se añaden controles solo porque salgan en la lámina.
- **Sin escena ilustrada encima del menú ni del calendario:** detrás está la habitación real o el monitor. La lámina no se usa como fondo.
- **Sin barra Balda/Decorar/Menú bajo el organizador:** es la barra real de la habitación, y queda tapada por la hoja.
- **«Mi biblioteca»** conserva su nombre; la lámina dice «Biblioteca».
- **Calendario y Mi diario, «Volver a la experiencia anterior» y el canal por pista** no salen en la lámina; están para no perder funciones.
- **Radio a 144 px** (la lámina es casi a todo el ancho), para dejar los controles a la vista.
- **Casillas:** 48 px de alto en todos los tamaños; a 320 de ancho miden unos 40 px, porque siete columnas no caben más anchas.
- **En horizontal,** menú y radio se desplazan por dentro; no se ha hecho un montaje específico.

### Mar suavizado (8-11-2026)

Francisco lo oyó «demasiado agresivo». Se regenera con el mismo generador y semilla: oleaje con menos recorrido (LRA de 7,6 a 2,6 LU), espuma más apagada y ganancia de la app de ×1,6 a ×0,75. Con la ganancia incluida, unos 5,7 LU menos y 8,5 dB menos de pico. Las otras tres pistas no cambian (mismo MD5). El vídeo de esa entrega se grabó con el mar anterior, aunque suena solo unos segundos.

**Mar retirado por ahora** (decisión de Francisco, 8-11-2026). No se ofrece; al activar el sonido no suena ningún ambiente, y quien lo tenía elegido pasa a «Sin ambiente». El archivo y el generador se conservan.

## Diario, estadísticas, biblioteca y decorar (8-11-2026)

Sin commit, en revisión. Es una capa de aspecto: datos, gráficos reales, búsquedas, filtros, virtualización y acciones no cambian.

- **Ordenador:** las variables `--pc-*` pasan a la paleta Puerto Pixel, de modo que Reto anual, Misiones, Sesiones y demás pantallas secundarias comparten papel, tinta, verde y esquinas rectas.
- **Diario y estadísticas:** cuaderno con lomo y anillas; las estadísticas llevan el objeto del atlas como remate.
- **Biblioteca:** cabecera petróleo, filtros burdeos (el activo, en verde y con ✓) y cada libro en su balda.
- **Decorar:** escena isométrica intacta; solo papel, tinta y botones de 48 px en el panel.

### Diferencias con la lámina 04 y 05

- **Sin pestañas Notas/Citas/Reseñas:** Notas y Citas se abren desde Aplicaciones, y las reseñas viven en la ficha de cada libro. La lámina propone una estructura que hoy no existe.
- **Sin «Una lectura para recordar» ni fichas de fecha:** el diario conserva Hoy, reflexión, semana y anotaciones reales.
- **Biblioteca en filas, no en cuadrícula de portadas:** la cuadrícula perdería autor, estado y «Exponer», y obligaría a rehacer la virtualización.
- **Estadísticas:** cuatro datos reales y sus gráficos, no los tres de la lámina ni «Tu ritmo de lectura».
- **Decorar:** escena isométrica real y categorías con icono, como pide la especificación.
- **Ficha de libro y Ajustes:** no se han reestilizado en esta fase.

## Revisión final (8-11-2026)

Con `e2e-community/pixel-final.spec.js` (Chromium emulado, 320 y 390, Supabase simulado). Evidencias en `qa-report/pixel-final/`.

| Caso | Resultado |
| --- | --- |
| Título y autor larguísimos, sin portadas | Sin desbordes; se recorta con puntos suspensivos o pasa de línea; cubierta con título |
| Biblioteca vacía | Sin errores; las pantallas lo dicen |
| Sin red | Menú, calendario y radio responden; la música avisa sin bloquear |
| Visita a otro piso | Solo «Ver de noche» y «Salir al portal»; ni ordenador, ni decorar, ni ajustes, ni sonido |

Corregido en esta revisión: controles sin color de respaldo si su marco no había llegado (quedaban ilegibles sin red), y desborde de la balda pequeña a 320 px.

**Limitaciones:**

- Sin red y en una primera visita, los iconos y marcos que aún no estén descargados no se ven; los controles conservan su texto o su nombre accesible, pero la X de cerrar queda en blanco.
- En el caso vacío solo se vació la lista de libros, así que Estadísticas sigue mostrando la actividad sembrada.
- No probado: móviles físicos, cuentas reales ni Safari real. Dos cuentas se cubren con las pruebas simuladas de `v1882-objetos`.
- Rendimiento: no medido en esta fase; no se afirma ninguna mejora.
- Equivalencia visual con las láminas: aproximada, no exacta (`qa-report/pixel-final/comparativa-laminas.png`).
