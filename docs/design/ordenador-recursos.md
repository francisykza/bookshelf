# Ordenador e iconos de sección: recursos y referencias (1.42.0)

## Maqueta objetivo

| Pantalla | Referencia |
| --- | --- |
| Las seis apps del ordenador (Diario, Datos, Sesiones, Reto, Misiones, Citas) | `docs/design/references/ordenador-seis-apps-maqueta.png` (copia de `material-diseno/Seis ventanas de lectura mediterránea objetivo.png`) |

Sustituye a las maquetas en cuaderno de cuero de 1.40–1.41 (`diario-general-hoy-2-maqueta.png`,
`calendario-detalle-dia-maqueta.png` y las láminas de `material-diseno` con anillas, pestañas de tela o marco de
cuaderno), que quedan como versiones antiguas. Las demás secciones (biblioteca, fichas, reseñas, comunidad, club)
siguen guiándose por sus maquetas aprobadas; de ellas solo cambian los iconos de sección.

## Fondos e ilustraciones

| Uso | Original (`material-diseno/ordenador/ilustraciones/`) | Recurso de la app |
| --- | --- | --- |
| Fondo del escritorio | `fondo-escritorio.png` (Pueblo mediterráneo sobre una bahía tranquila-1) | `public/assets/computer/wallpaper.webp` |
| Acento de Estadísticas | `libros-olivo.png` (Libros antiguos y ramita de olivo-2) | `public/assets/computer/olive-books.webp` |

## Iconos de sección

Originales en `material-diseno/ordenador/iconos/<id>.png` (copias con nombre claro; los archivos de origen siguen en
`material-diseno/`). La app usa `public/assets/icons/sections/<id>.webp`: margen transparente recortado al borde de
la baldosa marfil y lienzo cuadrado con el mismo aire (4 %) para que todas midan lo mismo; 160 × 160, sin
recolorear ni filtros. Se cargan siempre con el componente `SectionIcon`.

| id | Dibujo | Origen | Dónde se usa |
| --- | --- | --- | --- |
| `diario` | Libro terracota con marcador | Diario terracota con cinta salvia-2 | Dock y cabecera de Mi diario |
| `datos` | Tres barras de colores | Icono de datos con barras ascendentes-1 | Dock y cabecera de Estadísticas |
| `sesiones` | Reloj azul | Reloj mediterráneo de sesiones-3 | Dock y cabecera de Sesiones |
| `reto` | Montañas | Icono de cumbres mediterráneas-5 | Dock y cabecera de Reto anual |
| `misiones` | Brújula terracota | Medallón de brújula mediterránea-4 | Dock y cabecera de Misiones |
| `citas` | Hoja de olivo | Hoja de olivo sobre marfil-6 | Dock y cabecera de Citas |
| `coleccion` | Estrella sobre pedestal | Estrella terracota sobre pedestal ocre-2 | Botón «Vitrina de Figuras» de la biblioteca (sustituye al trofeo, sin la baldosa de madera) |
| `sagas` | Libros con luna | Libros de sagas bajo la luna-3 | Cabecera del Atlas de Sagas (sustituye a la rosa de los vientos) |
| `club` | Libro abierto con bocadillo | Libro abierto con burbuja de diálogo-4 | Fila de club en la actividad de Lectores, como en la maqueta «Entre lectores» |
| `biblioteca` | Tres libros | Biblioteca de tres libros-1 | Sin ubicación todavía: ningún acceso a la biblioteca llevaba icono de sección (la cabecera es el cartel colgante; Escaparate y Lomos son controles de vista) |
| `comunidad` | Grupo de personas | Tres siluetas en tonos cálidos-6 | Sin ubicación todavía: la cabecera «Comunidad» y sus pestañas no llevaban icono, ni lo lleva su maqueta |
| `encuentros` | Calendario con estrella | Calendario de encuentros-7 | Pendiente: la función de encuentros del club aún no existe (SPEC §32.3). Nunca para el calendario de lectura |
| `resenas` | Bocadillo con estrella | Bocadillo de reseñas con estrella dorada-5 | Sin ubicación todavía: «Voces de lectores» y la reseña no llevaban icono de sección |
| `notas` | Hoja con lápiz | Notas con lápiz terracota-8 | Sin ubicación todavía: la pestaña Notas del diario es textual, como en la maqueta |

Las estrellas de valoración siguen siendo controles propios; el icono `coleccion` no las sustituye. Los controles
(buscar, cerrar, volver, editar, borrar, añadir, compartir, desplegar, más opciones) siguen siendo iconos lineales.

La habitación no cambia: sus guías (iconos y nombres) y reflejos aprobados se conservan tal cual.
