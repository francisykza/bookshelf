# Recurso pendiente: la noche de la MISMA habitación (1.52)

Fecha: 2026-10-29. Decisión de Francisco: día y noche son **la misma habitación**. La composición de día
(`public/images/room-refresh/escena/fondo-limpio.webp`, 941 × 1672) es la definitiva; de la captura nocturna de la
1.51 solo se toma la **iluminación**. El fondo nocturno de la 1.51 (otra habitación) se ha retirado.

## Por qué hace falta un recurso

La luz de noche aprobada (sin manchas de sol, exterior azul, luna, pueblo iluminado, lámpara y vela cálidas, luz
fría junto al ventanal) no se puede obtener oscureciendo el dibujo de día: las manchas de sol y las sombras de
mediodía están pintadas en él. Hasta que llegue el recurso, la noche es el velo azul de siempre sobre el día (con más
luz sobre el libro para que se lea), y **la continuidad de iluminación no está resuelta**.

## Recurso 1 (imprescindible): fondo nocturno equivalente

| Propiedad | Valor |
| --- | --- |
| Archivo | PNG o JPG, se derivará a `public/images/room-refresh/escena/fondo-limpio-noche.webp` |
| Tamaño | **941 × 1672 exactos** (o el doble, 1882 × 3344, con la misma proporción) |
| Geometría | **Idéntica píxel a píxel** a `fondo-limpio.webp`: mismas baldas, cama, almohadas, cascos, cortina, plantas, sillón, ventana, mesa, portátil, vela y libro abierto, en el mismo sitio y con la misma perspectiva. Comprobable superponiéndolos al 50 % |
| Contenido | Lo mismo que el de día: **baldas vacías** (la app pone tus libros y figuras), **páginas del libro en blanco**, **pantalla del portátil apagada**, sin carteles ni texto |
| Luz | Noche como la captura nocturna aprobada: exterior azul profundo, luna, luces cálidas del pueblo y reflejos discretos en el mar, luz fría suave junto al ventanal, sombras naturales, sin manchas de sol. Gouache mate, sin halos ni neón |
| Lámpara y vela | Pintadas **apagadas** (sin halo propio): la app añade su luz cuando están encendidas |

## Recurso 2 (recomendado): luces separables

Para que lámpara y vela encendidas den luz pintada, no solo un halo de color:

| Archivo | Tamaño | Contenido |
| --- | --- | --- |
| `luz-lampara-noche.png` | 941 × 1672, transparente | Solo la luz de la lámpara de latón encendida (bombilla, cono y luz sobre la estantería y la pared), en su sitio |
| `luz-vela-noche.png` | 941 × 1672, transparente | Solo la llama y la luz de la vela sobre la mesa y el portátil, en su sitio |

## Recurso 3 (si se quieren con la misma luz)

Las capas que hoy se pintan encima del fondo de día, en versión nocturna y con su mismo recorte: `hiedra-izquierda`,
`hiedra-derecha`, `enredadera-poste`, `cortina-alta`, `cortina-caida` y `portatil-primer-plano`
(`public/images/room-refresh/escena/`). Si no llegan, se tiñen con la luz de la escena como ahora.

## Qué hace la app cuando llegue el recurso 1

En `src/scene/sceneMap.js`, `SCENE_REFRESH.night` pasa de `null` a la ruta del recurso. Entonces, de noche, se pinta
encima del fondo de día (misma geometría) y se quita el velo oscuro; el libro, su contenido, los carteles, las baldas,
la pantalla y las zonas tocables no cambian de sitio.

## Estado (1.53.0)

Entregado e integrado `fondo-limpio-noche.webp` (941 × 1672, misma geometría comprobada superponiendo bordes). Trae
la lámpara y la vela encendidas: siguen pendientes, si se quieren, sus versiones apagadas o las luces por separado.
