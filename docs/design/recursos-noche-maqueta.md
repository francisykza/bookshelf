# Recursos para la habitación nocturna de la maqueta (pendientes)

Referencia: `docs/design/references/habitacion-noche-maqueta.png` (851 × 1849, proporción 0,46, generada).
Fecha: 2026-10-28. Estado: **implementada en la 1.51 (SPEC §49)** con el recurso 1 y un libro aparte. Siguen
pendientes los recursos 2 y 3 y un fondo con las baldas vacías.

## Por qué no se puede hacer con lo que hay

- La maqueta es **otra ilustración**, no el fondo actual con otra luz: baldas llenas con libros, figuras en caja,
  marcos, globo y jarrón; lámpara y cortina en otra posición; ventanal, pueblo y mar distintos; guirnaldas de luces;
  libro y cascos más grandes y en otro sitio; proporción 0,46 frente a 0,56 de `fondo-limpio.webp` (941 × 1672).
- Ningún recurso existente coincide: `material-diseno/Rincón de lectura ante la bahía nocturna.png` es otra escena
  (ventana y hornacinas), y la noche actual es una capa oscura sobre el fondo de día, que el encargo descarta.
- La maqueta trae pintados el texto del libro, los carteles, los controles y la pantalla del portátil: no puede
  usarse como fondo (regla de `CLAUDE.md` y del propio encargo).

## Recursos necesarios

Todos en el mismo estilo gouache de la maqueta, sin texto, sin interfaz y **con la misma geometría entre ellos**.

| # | Recurso | Tamaño mínimo | Contenido | Transparencia |
| --- | --- | --- | --- | --- |
| 1 | Fondo nocturno limpio | 1080 × 2346 (0,46), ideal 1620 × 3519 | La maqueta entera **sin**: texto ni decoración en las páginas del libro (papel en blanco con su curvatura, cinta verde y sombra), carteles, controles superiores, contenido de la pantalla del portátil (pantalla apagada, gris azulado uniforme, con el bisel). **Con**: lámpara, vela, cascos, cortina, hiedra, guirnaldas, sillón, plantas, alfombra. Baldas con sus objetos fijos (marcos, globo, jarrón, plantas) pero **sin libros ni figuras** (los pone la app con los datos reales) | No (JPG/PNG opaco) |
| 2 | Variantes de día y atardecer del mismo cuadro | igual que 1 | Misma geometría píxel a píxel que 1, otra luz | No |
| 3 | Fondo horizontal / escritorio (opcional) | 2400 × 1500 | Mismo cuarto ampliado a los lados, misma luz | No |

Si solo llega el 1 (sin 2), la noche tendría su propio mapa de coordenadas y al cambiar de hora cambiaría la
composición entera (día = cuadro actual, noche = cuadro nuevo). Es viable, pero las dos habitaciones no coincidirían.

## Lo que haría la app sobre el fondo 1

- Medir en la nueva ilustración: páginas del libro (zona útil de cada una), pantalla del portátil (4 esquinas
  interiores), frentes de balda (para lomos, figuras y «Mi biblioteca»), borde de la mesa (para «Mi diario»), marco
  derecho del ventanal («Social»), cascos, vela y lámpara (hotspots).
- Pintar encima con datos reales: lomos de tus libros y figuras obtenidas en las baldas, texto del libro («ESTÁS
  LEYENDO», título, autor, «Página X», «de Y · Z %», barra y «Registrar lectura»), calendario en la pantalla y los
  tres carteles de papel marfil.
- Encuadre vertical a la proporción 0,46 (390 × 847): sin recortes en los teléfonos habituales.
