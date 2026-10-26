# Mapa de recursos (SPEC §31.1)

Equivalencias de carpetas: los originales siguen en `material-diseno/` (hace de `material-diseno/originales/`, sin
modificar); las maquetas aprobadas en `docs/design/references/` (equivale a `docs/design/mockups/`); las capturas
previas, en `material-diseno/Imagen de ChatGPT …` y `qa-report/capturas-*`; los derivados de uso en
`public/assets/bookshelf/…` (este documento), `public/assets/library/`, `public/assets/ui/`, `public/assets/profile/`
y `public/art/library-refresh/` (inventariados en `asset-manifest.md`). Se generan con `npm run art:pieces`; medidas
completas en `public/assets/bookshelf/manifest.json`. Todas las piezas tienen alfa real y no muestran halo sobre
fondo claro ni oscuro (hoja de control revisada).

| Nombre original | Ruta final | Dimensiones (derivado) | Alfa | Uso | Maqueta | Estado |
|---|---|---|---|---|---|---|
| Sobre salvia con papel marfil-1.png (1254x1254) | /assets/bookshelf/notebook/envelope-sage-open.webp | 720×707 | sí | Sobre del día (DailyQuote) | carta-del-dia | integrado |
| Nicho arqueado de madera vacío-4.png (1536x1024) | /assets/bookshelf/reading-corner/guardian-niche-empty.webp | 720×462 | sí | Misiones y Guardián (LaptopPanel) | misiones-y-guardian | integrado |
| Pequeño libro abierto en gouache mediterráneo-3.png (1536x1024) | /assets/bookshelf/notebook/open-book-decoration.webp | 360×157 | sí | Estadísticas, «Cada página cuenta» | estadisticas | integrado |
| Pila de tres libros antiguos-2.png (1254x1254) | /assets/bookshelf/notebook/book-stack-decoration.webp | 320×236 | sí | Reto anual, junto al anillo | mi-ano-entre-libros | integrado |
| Ramita botánica mediterránea en gouache-5.png (1024x1536) | /assets/bookshelf/notebook/botanical-sprig.webp | 160×249 | sí | Títulos del cuaderno (Mi diario de lectura, Mi reseña) | cuaderno-libro-tres-vistas | integrado |
| Clip bulldog de latón envejecido-6.png (1254x1254) | /assets/bookshelf/notebook/brass-paper-clip.webp | 160×128 | sí | Pinza de Mi reseña | cuaderno-libro-tres-vistas | integrado |
| Marcapáginas de lino salvia-7.png (1024x1536) | /assets/bookshelf/notebook/textile-tab-sage.webp | 120×338 | sí | Marcapáginas bajo el cuaderno del libro | cuaderno-libro-tres-vistas | integrado |
| Velero artesanal de madera-1.png (1254x1254) | /assets/bookshelf/reading-corner/memory-sailboat.webp | 256×296 | sí | Recuerdo «barquito» (CornerScene, MemorySheet) | perfil-rincon-huellas-2 | integrado |
| Maceta terracota con hojas de salvia-2.png (1254x1254) | /assets/bookshelf/reading-corner/memory-potted-plant.webp | 256×274 | sí | Recuerdo «planta» | perfil-rincon-huellas-2 | integrado |
| Tintero azul con pluma crema-3.png (1254x1254) | /assets/bookshelf/reading-corner/memory-inkwell-feather.webp | 256×376 | sí | Recuerdo «tintero» | perfil-rincon-huellas-2 | integrado |
| Mapa imaginario enrollado con cinta salvia-4.png (1254x1254) | /assets/bookshelf/reading-corner/memory-rolled-map.webp | 320×194 | sí | Recuerdo «mapa» | perfil-rincon-huellas-2 | integrado |
| Adorno azul con luna y estrellas-5.png (1536x1024) | /assets/bookshelf/profile/adornments/avatar-adornment-constellations.webp | 480×183 | sí | ReaderAdornment constelaciones | huellas-adornos-avatar | integrado |
| Arco de hiedra y llave antigua-6.png (1536x1024) | /assets/bookshelf/profile/adornments/avatar-adornment-dark-academia.webp | 480×217 | sí | ReaderAdornment dark-academia | huellas-adornos-avatar | integrado |
| Arco botánico con flores y lazo-7.png (1536x1024) | /assets/bookshelf/profile/adornments/avatar-adornment-letter-garden.webp | 480×237 | sí | ReaderAdornment jardin-cartas | huellas-adornos-avatar | integrado |
| Arco floral de cerezos y salvia-8.png (1536x1024) | /assets/bookshelf/profile/adornments/avatar-adornment-cherry.webp | 480×202 | sí | ReaderAdornment cerezo | huellas-adornos-avatar | integrado |
| Arco de helechos con setas y polilla-9.png (1536x1024) | /assets/bookshelf/profile/adornments/avatar-adornment-ink-forest.webp | 480×208 | sí | ReaderAdornment bosque-tinta | huellas-adornos-avatar | integrado |
| Libro abierto, cinta azul y media luna-10.png (1254x1254) | /assets/bookshelf/profile/badges/badge-monthly-book-moon.webp | 128×105 | sí | Distinción mensual | perfil-rincon-huellas-2 | integrado (solo si se asigna) |
| Linterna literaria de salvia y ámbar-11.png (1254x1254) | /assets/bookshelf/profile/badges/badge-moderator-lantern.webp | 128×238 | sí | Rol Moderación (tabla moderators) | perfil-rincon-huellas-2 | integrado |
| Lazo terracota con estrella de latón-12.png (1254x1254) | /assets/bookshelf/profile/badges/badge-weekly-star.webp | 128×106 | sí | Distinción semanal | perfil-rincon-huellas-2 | integrado (solo si se asigna en distinctions) |
| Llave antigua sobre lazo de terciopelo-13.png (1254x1254) | /assets/bookshelf/profile/badges/badge-creator-key.webp | 128×88 | sí | Rol Creadora | perfil-rincon-huellas-2 | integrado (solo si se asigna) |
| Casita de papel con pluma dorada-14.png (1254x1254) | /assets/bookshelf/profile/badges/badge-team-house-nib.webp | 128×198 | sí | Rol Equipo | perfil-rincon-huellas-2 | integrado (solo si se asigna) |
| Sobre con sello de libro abierto-15.png (1254x1254) | /assets/bookshelf/profile/badges/badge-founder-letter.webp | 128×106 | sí | Comunidad fundadora | perfil-rincon-huellas-2 | integrado (solo si se asigna) |

## Pendientes

- Máscaras de los reflejos suaves de cada objeto de la habitación (guías desactivadas): se prepararán sobre el fondo
  original actual (`public/images/cozy-book-room.jpg`). Hasta entonces se mantiene el halo de silueta al pasar.
- Las placas ilustradas de la habitación (`/assets/ui/plaque-*.webp`, `bookmark-olive.webp`) dejan de usarse en la
  habitación; siguen disponibles y `plaque-chains` se usa en las baldas de la biblioteca.
