# Correcciones de fidelidad visual (1.35.1)

Pasada de corrección visual y responsive sobre la 1.35.0 (SPEC §28.14). No cambia funciones, datos ni permisos.

**Referencias objetivo** (maquetas aprobadas): `docs/design/references/`.
**Capturas «antes»** (app real en móvil, aportadas por el usuario el 2026-10-25, NO son referencias):
`material-diseno/Imagen de ChatGPT 25 oct 2026, 17_33_19.jpg` (perfil propio), `…17_33_34.jpg` (ficha),
`…17_33_47.jpg` (comunidad · Lectores), `…17_33_53.jpg` (habitación), `…17_34_00.jpg` (librería),
`…17_34_07.jpg` (perfil de otra persona).
**Capturas «después»** (render real con Playwright/Chromium, no versionadas): `qa-report/capturas-fidelidad/`
(`local/` para librería, ficha y habitación a 360/390/430/1440; `chromium-*/` para perfil y comunidad a
320/390/430/1440 con el simulador de Supabase, nombres y títulos largos).

Clasificación: **A** fallo de composición o CSS · **B** recurso existente sin conectar · **C** recurso ausente.

## Perfil (objetivo: `perfil-rincon-huellas-maqueta.png`, `salon-rincon-voces-maqueta.png`)

| Diferencia observada | Tipo | Corrección | Resultado |
|---|---|---|---|
| Rama del adorno ≈ 490 px, separada del avatar y empujando el nombre | A + C | El SVG provisional ya no se pinta. La preferencia se conserva (`data-adornment`) y el hueco queda preparado: 120 % del avatar, solape de 12 px y altura reservada | Avatar de 96 px con el nombre al lado, sin empujes; los adornos ilustrados siguen pendientes (C) |
| Nombre desplazado | A | Rejilla `96px · 1fr`: el nombre se parte en varias líneas sin moverse | Nombres largos ocupan 2–3 líneas en 320 px, alineados |
| Mucho espacio vacío entre escena, identidad y libros | A | Separación de 12 px entre bloques, sin margen extra bajo la escena | Bloques seguidos |
| «Actual» sin portada | A | El rincón solo publica `current_title`. En el propio perfil se completa con tu libro local; en el de otra persona, `Cover` pinta la cubierta tipográfica (título y autor) | Tres huecos 2:3 idénticos con bases alineadas y título debajo (2 líneas como mucho) |
| «Dejar de seguir» y «Bloquear» con demasiado protagonismo | A | «Seguir / Siguiendo» compacto; bloquear dentro de «Más opciones» (menú accesible, Escape cierra) | Acción principal sola. No se añade «Denunciar perfil»: el servidor solo admite denuncias de reseñas y mensajes de club |
| 4,25 se veía como cuatro estrellas | A | `visualFill`: relleno perceptual (el 25 % del ancho de una estrella solo cubría la punta de un brazo) | Se ve el cuarto de la quinta estrella; el valor y su nombre accesible no cambian |
| Cabecera de carta apretada a 320 px | A | Las estrellas bajan bajo el nombre | Nombre legible |

Recursos renderizados en el perfil: `/assets/profile/rincon-{dia,lluvia,noche}-768.webp` (`srcset` con `-1536`),
768 × 512 al 100 % del ancho del panel con `object-fit: contain` (definitivo); `/assets/memories/farol-256.webp`
(256 × 498, `MemoryObject`, definitivo); barquito, planta, tintero y mapa en SVG provisional (C).

## Librería (objetivo: `biblioteca-mediterranea-maqueta.png`)

| Diferencia observada | Tipo | Corrección | Resultado |
|---|---|---|---|
| Madera muy fotográfica y contrastada | A | Se mantiene la textura gouache suministrada (`/art/library-refresh/panel.webp`, 1024², la de `art-inbox/library-refresh/shelf-back-panel.png`) y se le pone una veladura cálida uniforme (`rgb(122 86 54 / .34)`) | Madera más mate; portadas y texto por encima, sin lavar |
| «Herramientas» fuera del ancho a 390 | A | Sin anchuras mínimas en la fila: los botones pueden encoger, sin flecha a ≤ 430 px y con texto recortado con elipsis si hiciera falta | Cabe a 360, 390 y 430 |
| Recuerdos: tres bloques grandes antes de los libros | A | Una fila con la nota del último libro y la postal de la cita (dos líneas; al tocarla se lee entera) y «Ver más · N» en la barra | ≈ 120 px; se puede plegar como antes |
| Primer encuadre sin balda completa | A | Lo anterior más cabecera con 8 px entre filas y placa más pequeña | A 390 × 844 se ven la primera balda completa, su canto y su placa |
| Placas grandes | A | Placa de 24 px con letra de 12,5 px; las anillas nacen del canto (la placa sube 4 px sobre él) | Placas discretas que no tapan libros |

## Ficha y cuaderno (objetivo: `ficha-diario-resena-lectores-maqueta.png`)

| Diferencia observada | Tipo | Corrección | Resultado |
|---|---|---|---|
| Ex-libris y cabecera grandes | A | Sello de 40 px, portada de 64–88 px y título de 22–30 px con 3 líneas como mucho | Cabecera ≈ 30 % más baja |
| «Leído» solo en otra línea | A | Estado en una rejilla de tres columnas; el texto se parte dentro de su botón | Las tres opciones siempre en una fila |
| «+10» solo en otra línea | A | «Página N de T» en su línea; −10 · −1 · +1 · +10 en una rejilla de cuatro | Fila equilibrada de 44 px |
| Encuadernación como «barra con puntos» | A | Tapa de cuero con costura de hilo crema (pespunte) | Costura discreta; centro de papel limpio |
| Desborde de 5 px a 360 al abrir los detalles | A | La rejilla del velo no crece con el contenido; los detalles parten línea | Sin scroll horizontal |

## Habitación (objetivo: `habitacion-senales-maqueta.png`)

| Diferencia observada | Tipo | Corrección | Resultado |
|---|---|---|---|
| Anillas de «Mis sagas» flotando | A | Cadena en V desde un único punto del aro del astrolabio (sigue al astro) | Sujeción visible |
| Grandes polígonos blancos («Calendario», «Ambiente», «Tiempo de lectura») | A | Papel cálido y tela; letra de 11 px; una línea (dos en la etiqueta de infusión) | Sin blancos ni tres líneas |
| «Calendario» sin apoyo | A | Pestaña en el canto frontal de la base del portátil | Apoyada |
| «Tiempo de lectura» sin relación con el vaso | A | Etiqueta de infusión con cordel desde el borde del vaso; no pisa la pestaña ni a 360 | Ligada al vaso |
| «Ambiente» | A | Etiqueta de tela cosida junto a la diadema | Junto a los auriculares |
| «Mi lectura» | A | Cinta de tela que nace del canto de la página izquierda, sin girar el texto | Sale del libro |
| Placas de librería y colección | A | Latón mate (menos brillo y saturación), escala contenida | Discretas |

Las señales siguen sin eventos de puntero: el área táctil es el objeto entero (≥ 44 × 44 px). Con un panel
abierto no se montan.

## Comunidad (objetivo: `salon-rincon-voces-maqueta.png`)

| Diferencia observada | Tipo | Corrección | Resultado |
|---|---|---|---|
| «Club Club Prueba» | A | La palabra «Club» estaba fija delante del nombre del usuario. Ahora el tipo («Club de lectura») va en su propia línea y el nombre no se toca | «CLUB DE LECTURA · Club Prueba» |
| Actividad como párrafos genéricos | A + B | Carta pequeña con portada (la de tu ejemplar si es la misma obra; si no, la cubierta tipográfica de `Cover`), obra y autor, quién la escribió con su avatar, estrellas y un extracto de dos líneas; abre su rincón | Jerarquía obra → persona → opinión |
| Filas de lectores | A | Avatar + nombre con elipsis + «Ver su rincón» (oculto a ≤ 430 px) + flecha | Compactas, sin desbordar a 320 |

No se ha inventado actividad, colecciones ni información pública. Los clubes no se dan por terminados.

## Recursos

- **Renderizados y definitivos**: `panel.webp`, `plank.webp`, `ivy.webp`, `journal.webp`, `letter.webp`
  (`/art/library-refresh/`), `rincon-*-768/1536.webp`, `farol-256.webp`.
- **Provisionales (C, ausentes)**: barquito, planta, tintero, mapa; los cinco adornos de avatar; las seis
  distinciones (`docs/design/pending/README.md`). Se buscó en `material-diseno/` y en el inventario: los adornos
  solo existen dentro de las maquetas `huellas-adornos-avatar-maqueta.png` y `perfil-rincon-huellas-maqueta.png`,
  que no se recortan para producción.
- **Costura de la encuadernación**: no hay un recurso de costura aislado; se hace en CSS (pespunte).

## Limitaciones de verificación

- Capturas con Playwright (Chromium) y pruebas también en WebKit; no se ha probado en un iPhone real.
- Las portadas externas (Open Library y Google) no siempre cargan en el entorno de pruebas: en algunas capturas se
  ve el hueco o la cubierta tipográfica.
- No se afirma igualdad con las maquetas: la composición y la jerarquía se acercan, pero faltan los recursos C.
