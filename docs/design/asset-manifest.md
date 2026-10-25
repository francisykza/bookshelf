# Manifiesto de recursos de diseño (SPEC §28.1)

Generado a partir de `material-diseno/` (los originales se conservan allí, sin mover ni modificar) con
`npm run art:design` (`scripts/organize-design-assets.mjs`). Las comprobaciones automáticas están en
`docs/design/asset-check.json` (formato real, dimensiones, alfa, md5, derivados). Las rutas de la app usan
`/assets/...` (sin `/public`).

Comprobaciones hechas en cada imagen:
- **Formato real** con sharp (todas son PNG de verdad; ninguna extensión engañosa).
- **Alfa**: solo el farol trae transparencia real (canal alfa casi binario: 82 % transparente, 0,4 % de borde
  suave). Compuesto sobre papel `#F8F1E1` no deja halo ni cuadrícula pintada.
- **Duplicados exactos**: `BookShelf_ tres pantallas del salón literario (1).png` es idéntico (md5 6334fad1…)
  a `BookShelf_ tres pantallas del salón literario.png`; se copia una sola vez.
- **Alineación de variantes** del rincón (correlación de bordes a 192 px contra el de día): lluvia 0,972,
  noche 0,803 (más baja por la oscuridad; ventana, nichos y mesa coinciden al superponerlas con rejilla).
- **Repetición de texturas**: ninguna imagen nueva es una textura repetible; las texturas de interfaz siguen
  siendo las de `/art/library-refresh/` (1.34.0), cuya continuidad ya se comprobó.

## Maquetas (referencias, no fondos de la app)

| Original (`material-diseno/`) | Destino | Tipo | Pantalla | Estado |
|---|---|---|---|---|
| Biblioteca mediterránea en madera y gouache.png (851×1848) | docs/design/references/biblioteca-mediterranea-maqueta.png | maqueta | Librería (`ShelfView`) | listo |
| Placas de latón suspendidas en biblioteca-1.png (851×1848) | docs/design/references/habitacion-senales-maqueta.png | maqueta | Habitación: señales (`RoomSigns`) | listo |
| Diario de lectura entre páginas.png (862×1825) | docs/design/references/diario-general-hoy-maqueta.png | maqueta | Diario general, vista Hoy | listo |
| Tríptico de diario y voces lectoras.png (1536×1024) | docs/design/references/ficha-diario-resena-lectores-maqueta.png | maqueta | Ficha: Diario, Mi reseña, Lectores | listo |
| BookShelf_ tres pantallas del salón literario.png (1536×1024) | docs/design/references/salon-rincon-voces-maqueta.png | maqueta | Salón, rincón de perfil, voces | listo |
| BookShelf_ tres pantallas del salón literario (1).png | — (duplicado exacto del anterior) | maqueta | — | duplicado, no copiado |
| Alba y las huellas botánicas-2.png (1536×1024) | docs/design/references/perfil-rincon-huellas-maqueta.png | maqueta | Perfil + distinciones | listo |
| Huellas de lector_ tres retratos botánicos.png (1983×793) | docs/design/references/huellas-adornos-avatar-maqueta.png | maqueta | Adornos de avatar | listo |

Las maquetas no se recortan para producción (textos, botones, portadas y retratos son ilustrativos).

## Escena del rincón personal

| Original | Destino | Tipo | Uso | Estado |
|---|---|---|---|---|
| Rincón mediterráneo junto al mar.png (1536×1024, sin alfa) | public/assets/profile/rincon-dia.png + `-1536.webp` (123 KB) + `-768.webp` (40 KB) | escena | `CornerScene` (perfil) | listo |
| Rincón mediterráneo bajo la lluvia.png (1536×1024) | public/assets/profile/rincon-lluvia.png + `-1536.webp` (111 KB) + `-768.webp` (38 KB) | escena | `CornerScene`, variante lluvia | listo |
| Rincón de lectura ante la bahía nocturna.png (1536×1024) | public/assets/profile/rincon-noche.png + `-1536.webp` (113 KB) + `-768.webp` (39 KB) | escena | `CornerScene`, variante noche | listo |

Calibración sobre la imagen de 1536×1024 (px de la imagen, medidos con rejilla de 25 px):
- Balda superior del nicho: superficie en y = 302, interior x = 893–1472, fondo del hueco en y ≈ 100.
- Nicho en arco: suelo en y = 652, interior x = 945–1410, arco en y ≈ 395.
- Mesa: canto trasero y ≈ 740, canto delantero y ≈ 935; los recuerdos apoyan en y ≈ 890.

## Recuerdos de la mesa

| Original | Destino | Tipo | Uso | Estado |
|---|---|---|---|---|
| Farol artesanal de latón envejecido.png (1254×1254, alfa real) | public/assets/memories/farol.png + `farol-256.webp` (256×498 recortado, 45 KB) | objeto | `MemoryObject` «farol» | listo |
| — | public/assets/memories/barquito.* | objeto | `MemoryObject` «barquito» | pendiente (SVG provisional) |
| — | public/assets/memories/planta.* | objeto | `MemoryObject` «planta» | pendiente (SVG provisional) |
| — | public/assets/memories/tintero.* | objeto | `MemoryObject` «tintero» | pendiente (SVG provisional) |
| — | public/assets/memories/mapa.* | objeto | `MemoryObject` «mapa» | pendiente (SVG provisional) |

## Interfaz y adornos

| Destino | Estado |
|---|---|
| public/assets/ui/ | sin recursos nuevos: madera, papel y carta reutilizan `/art/library-refresh/` (1.34.0); anillas, placas, cintas, clips y sellos son SVG/CSS |
| public/assets/adornments/ | sin recursos aislados: los adornos solo existen dentro de las maquetas (no se recortan). Se dibujan en SVG (`ReaderAdornment`) hasta tener piezas propias |
| docs/design/pending/ | ninguna imagen ambigua; `pending/README.md` lista los recursos que faltan |
