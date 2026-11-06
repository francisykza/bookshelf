# El piso como entrada a BookShelf: funciones y elementos esenciales

Inventario de lo que se puede hacer hoy en la app (versión de comparación) y dónde queda en el piloto. El acceso actual se ha
sacado del código: `CozyRoom.jsx`, `RoomCorner`, `SocialRoom`, `ShelfView`, `LaptopPanel`, `BookDetailModal` y `App.jsx`.

## Los cuatro elementos esenciales

| Elemento | Piso 1.º A (tuyo) | Piso 2.º B (visita) | Paso que se reserva | Al tocarlo |
| --- | --- | --- | --- | --- |
| Estantería principal | Junto a la pared del fondo, esquina izquierda | Pared izquierda, al fondo | Delante de la estantería | Se acerca a la balda; desde ahí, toda la biblioteca |
| Mesa de lectura | Delante del sillón | Junto al sillón | Entre la mesa y el sillón (el sillón sí puede estar). Encima no se puede poner nada: es el sitio del ejemplar | El libro abre el registro |
| Escritorio con ordenador | Pared del fondo, a la derecha de la ventana | Pared del fondo | Delante del escritorio | Abre el escritorio de herramientas (en la visita no hace nada) |
| Puerta de salida | Pared del fondo, a la derecha | Pared izquierda | Delante de la puerta | Sale al portal |

Reglas en `src/features/pisoLab/essentials.js`. Se puede cambiar su color; no se pueden mover, girar ni guardar. Si falta alguno
al cargar una distribución antigua, se añade; lo que estorba va al sitio libre más cercano y lo que no cabe queda apartado sin
borrarse, para volver a intentarlo en la siguiente carga. Antes de la primera reparación se conserva una copia de la
distribución (`…:antes`). «Restablecer la habitación» vuelve a la distribución de partida, que ya los trae.

## Funciones, acceso actual y destino en el piso

| Función | Acceso actual en la app | Destino en el piso | Atajo en el menú |
| --- | --- | --- | --- |
| Biblioteca completa y búsqueda | Salón → «Mi librería» (`ShelfView`) | Estantería → Buscar; Ordenador → Mis libros | Toda la biblioteca |
| Libros expuestos | Baldas de la habitación y `BaldaPanel` | Estantería (hasta 30 ejemplares; se eligen en la biblioteca) | |
| Ficha del libro, reseña, notas, historial, lectores | Tocar un libro (`BookDetailModal`) | Desde la balda o la biblioteca | |
| Ejemplar que estás leyendo | Libro abierto de la cama | Mesa de lectura (y su sitio en la estantería) | |
| Registrar lectura | Libro de la cama → registro (`log`) | Tocar el libro de la mesa | Registrar lectura de… |
| Hoy, en Mi diario | Portátil → Mi diario | Ordenador → Mi lectura | Mi diario |
| Calendario | Portátil → Mi diario → Calendario | Ordenador → Mi lectura | Calendario |
| Notas | Portátil → Mi diario → Notas | Ordenador → Mi lectura | |
| Sesiones | Portátil → Sesiones | Ordenador → Mi lectura | |
| Temporizador | Bandeja «Té helado» (`PomodoroTray`) | Ordenador → Mi lectura | |
| Estadísticas | Portátil → Estadísticas | Ordenador → Mi progreso | |
| Reto anual | Portátil → Reto | Ordenador → Mi progreso | |
| Misiones | Portátil → Misiones | Ordenador → Mi progreso | |
| Citas | Portátil → Citas | Ordenador → Mi progreso | |
| Añadir un libro | Biblioteca → Añadir (`AddBookCard`) | Ordenador → Mis libros | |
| Importar de Goodreads | Biblioteca → Importar | Ordenador → Mis libros | |
| Bibliotecaria (recomendación) | Biblioteca → Bibliotecaria | Ordenador → Mis libros | |
| Mapa de sagas | Dial de la hora → Atlas | Ordenador → Mis libros | |
| Radio | Rincón y salón | Ordenador → Fuera del piso | |
| Comunidad | Tablet del salón | Ordenador → Fuera del piso (sin nube en el piloto) | |
| Cuenta y copias | Rincón → Cuenta | Ordenador → Fuera del piso (sin nube en el piloto) | |
| Hora del día | Ambiente | Menú | Ver de noche / de día |
| Decorar | Piso del edificio | Botón Decorar | |
| Salir | Atrás | Puerta | Salir al portal |

## Funciones sin destino en el piloto, a propósito

| Función | Motivo |
| --- | --- |
| Figuras, Ático, Cajas, Guardián | Ocultas desde la 1.67 (`FIGURES_ENABLED = false`) |
| Lector EPUB | Se sigue abriendo desde la ficha; el archivo vive en cada dispositivo |
| Tienda, hotel y vecinos reales | Necesitan la nube, apagada en el piloto |
| Ambiente, guías y sonido del rincón | Se quedan en la app; el piloto solo cambia la hora |
| Dado y recuerdos de la biblioteca | Siguen en `ShelfView`; pendiente de decidir si pasan al piso |
