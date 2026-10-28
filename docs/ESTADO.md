# Estado del proyecto y bitácora de sesiones

Documento compartido entre las cuentas que trabajan en BookShelf. **Al empezar**, leerlo entero. **Al terminar**
cada sesión (o cada bloque), actualizar «Estado actual» si cambia y añadir una entrada arriba del todo en la
bitácora. Es lo que permite a la siguiente sesión retomar sin repetir trabajo ni deshacer decisiones.

## Estado actual

- **Versión publicada**: 1.47.0 (2026-10-28), en https://bookshelf-wine-iota.vercel.app
- **Árbol de trabajo**: sin cambios pendientes de código tras publicar la 1.47.0. Fuera de git
  solo quedan las carpetas de recursos: `material-diseno/`, `art-inbox/` (incluye `maqueta-146/`), `assets-source/`.
- **Supabase**: aplicadas en producción las migraciones de `supabase/migrations/` hasta
  `20261025150000_huellas_rincon.sql`. No hay ninguna migración pendiente de aplicar.

### Últimos bloques (detalle en `SPEC.md`)

| Versión | Qué | SPEC |
| --- | --- | --- |
| 1.47.0 | Estado «Abandonado», biblioteca compacta con fila textil y herramientas en un icono, pulido de habitación, registro y Ambiente | §43–45 |
| 1.46.1 | Ventana del calendario del portátil centrada en la zona visible | §42 |
| 1.46.0 | Buscador por ISBN y elección de edición (§40), acabado físico de libros por edición (§39) y libro abierto grande en la cama con la lectura actual, «Ambiente» y «Guías» de papel, accesos «Mi biblioteca», «Mi diario» y «Rincón social», registro enfocado con «Deshacer» | §38–40 |
| 1.45.0 | Cuatro posiciones de figuras en las baldas de la habitación, detalle de figura, dos figuras nuevas («El Guardián de los Clavos», «El Maestro y el Superviviente») y pantalla del portátil | §37 |
| 1.44.0 | Materiales artesanales (terracota, lino salvia, papel crema) en biblioteca y ficha; libro con volumen 3D | §36 |
| 1.43.0 | Biblioteca de tres libros por fila, libro físico, rincón del lector y mapa sonoro | §35 |
| 1.42.0 | Ordenador como escritorio digital con seis apps e iconos de sección ilustrados | §34 |
| 1.41.x | Reflejos de la habitación sin guías; ajustes de Mi diario | §32–33 |

### Pendiente (por orden de prioridad aproximada)

0. **Encargo de la 1.46 terminado** (portátil, §42, publicado en la 1.46.1). Figuras revisadas (§41): sin el
   fondo de baldas anchas (punto 1) no pueden igualar el tamaño de la maqueta; faltan recortes con transparencia de
   la Dama, la Jinete y las tres figuras SVG. El escaneo de códigos no existe en el proyecto.
   En calendario y ficha el formulario de registro conserva su fila de guardado fija (lo exige `e2e/v123`): decidir
   con Francisco si se quita también ahí. Pruebas `e2e/ia1.spec.js` de recomendaciones fallan en 844×390 ya en 1.45.
1. **Fondo con baldas más anchas y frontales** para las figuras: con las baldas actuales del fondo (≈ 195 px de la
   ilustración por balda y en perspectiva) se ven más pequeñas que en `docs/design/references/habitacion-figuras-maqueta.png`.
   Hace falta que Francisco entregue ese recurso; no improvisarlo.
2. **Prueba que falla desde antes de la 1.45**: `e2e/panorama.spec.js` «9 · un panel abierto bloquea el panorama y
   Cerrar devuelve el foco» en `chromium-1440x900` (tras arrastrar con el portátil abierto, Escape no cierra el
   panel). Ya fallaba en la 1.44 publicada. Sin investigar.
3. **Prueba intermitente**: `e2e/v123.spec.js` «pulsación…» en `chromium-1440x900` falla a veces, también en
   versiones anteriores.
4. **Sonidos**: todos sintetizados (mapa en SPEC §35.4). Faltan grabaciones reales de papel, cubierta, madera y
   sobre, con licencia registrada; descargar algo requiere permiso de Francisco.
5. **Bloques registrados y no hechos** (SPEC §32.3): las demás pantallas según sus maquetas (Perfil y Avatar,
   Lectores y actividad, Mi rincón…); salón y club con **capítulos y encuentros** (migraciones de Supabase con RLS
   y pruebas PGlite, más la interfaz); el icono `encuentros` espera a esa función.
6. Iconos de sección sin ubicación todavía: biblioteca, comunidad, reseñas y notas (no se añaden donde la maqueta no
   los pone).
7. Figuras antiguas (Dama de la Ceniza, Jinete de Dragones y las tres en SVG) no tienen imágenes con transparencia
   para exponerse en la habitación: siguen en el Ático.

### Decisiones vigentes que no deben deshacerse

- Biblioteca (1.47, sustituye a lo anterior): buscador y cinco filtros textiles siempre visibles; el resto de
  herramientas en un icono; sin título grande, sin hueco «Añadir libro» en las baldas; los libros no se agrandan (§44).
- «Abandonado» es un estado real y reversible; nunca automático por inactividad (§43).
- «Tu cuenta y copias» tiene acceso propio en la esquina, fuera de Ambiente (§45).
- Las placas de navegación de la habitación son iconos y nombres con Guías y reflejos sin Guías (§31, §33).
- Ordenador sin cuero, anillas ni pestañas de tela; Mi diario con pestañas digitales (§34).
- Biblioteca sin etiquetas de título bajo las portadas; tres libros por fila en móvil (§35).
- Materiales artesanales en biblioteca y ficha (§36) y, desde la 1.46 por petición de Francisco, en la esquina,
  los accesos y el libro de la habitación y en la vista de registro (§38). No en el resto.
- El libro abierto grande de la cama sustituye a la tarjeta de lectura flotante; nunca duplicar sus datos (§38).
- En la habitación solo se exponen figuras obtenidas con imágenes con transparencia; las cajas fotografiadas y los
  personajes planos no (§37).

## Bitácora

Formato de cada entrada (la más reciente arriba):

```
### AAAA-MM-DD · cuenta (nombre corto) · versión
- Qué se hizo y por qué.
- Commits (hash) y si se subió a producción.
- Qué quedó a medias o sin verificar.
- Decisiones nuevas de Francisco que haya que respetar.
```

### 2026-10-28 · cuenta principal · 1.47.0 (publicada)
- Encargo «Pulido de habitación y biblioteca compacta» (maqueta `biblioteca-compacta-maqueta.png`): estado
  «Abandonado» (§43), biblioteca compacta (§44) y pulido de habitación, registro y Ambiente (§45).
- Recursos nuevos: `public/assets/ui/textile/etiqueta-{marfil,terracota,crema,salvia,malva}.webp` (derivados del lino
  salvia; no hay bases textiles específicas entregadas).
- Pruebas: build; Vitest 227/227; `e2e/v147.spec.js` y suites de habitación y biblioteca en Chromium 360/390/430/
  844×390/1440 y WebKit 390. Adaptadas a lo pedido: cinco filtros (`v134`), placeholder con «…» (`v128`), cuenta
  fuera de Ambiente (`ia1`), hora en Ambiente (`panorama` 16), «Añadir libro» en herramientas (`v146`).
  Sigue fallando la prueba 9 de `panorama` en 1440 (anterior a la 1.45).
- Commit y subida a producción pedidos por Francisco.

### 2026-10-27 · cuenta principal · 1.46.0 (publicada)
- Encargo largo de Francisco (maqueta de habitación con libro abierto). Hecho: puntos 2, 3, 7 (vista enfocada,
  fecha, «Deshacer»), parte del 8 (sin «respaldo automático») y del 9 (sonidos de hojas y página). Detalle en §38.
- Recursos nuevos en `art-inbox/maqueta-146/` (fuera de git) y derivados en `public/assets/room/`; maqueta en
  `docs/design/references/habitacion-libro-abierto-maqueta.png`.
- Se mantiene la ilustración de la habitación actual: el fondo móvil entregado no tiene té, vela ni lámpara.
- Pruebas: build, oxlint (sin errores), Vitest 210/210; e2e de habitación (diegetic, panorama, gouache, v134,
  v135, anexos, v123, ia1) en Chromium 360/390/430/844×390/1440 y WebKit 390. Se adaptaron pruebas a lo pedido
  (nombre «Porcentaje», «Rincón social» legible, libro grande, hora en «Ambiente», cuenta dentro de «Ambiente»).
- Después, punto 6: acabado físico de los libros (§39), calibrado con la portada de *Songbirds and Snakes*.
  Ojo: la portada de Open Library por ISBN de ese libro es un escaneo con pegatina. Prueba nueva `e2e/v146.spec.js`.
- Después, punto 8: buscador por ISBN y elección de edición (§40). Google Books devolvía 429 (cuota sin clave)
  durante las pruebas: la app pasa a Open Library. Pruebas con proveedores simulados en `e2e/v146.spec.js`.
- Commit de la 1.46.0 pedido por Francisco y después subido a producción a petición suya.
- 2026-10-28 · 1.46.1, punto 5 (§42), con commit y subida a petición de Francisco: ventana del calendario de la pantalla del portátil centrada en la zona
  que no tapan la planta y el vaso pintados. Prueba en `e2e/v146.spec.js`. Queda el resto del encargo
  (ver «Pendiente» 0): figuras (punto 4) y ordenador (punto 5).
- Después, punto 4 (§41), en su propio commit, también publicado: placa «Mi biblioteca» bajada (tapaba la balda central de
  figuras), foco del cierre del detalle y pruebas de figuras en `e2e/v146.spec.js`. El resto ya cumplía desde 1.45.

### 2026-10-27 · cuenta principal · 1.45.0 (documentación)
- Protocolo de traspaso automático en el apartado 0 de `CLAUDE.md`: leer este documento y git al empezar, anotar
  aquí en cada commit y escribir las reglas nuevas en `CLAUDE.md`. Puntero en `Claude/CLAUDE.md` (fuera de git).
- Las dos cuentas trabajan solo en este ordenador; `docs/TRASPASO.md` simplificado.

### 2026-10-27 · cuenta principal · 1.45.0
- Preparado el traspaso entre cuentas: `CLAUDE.md` (reglas y mapa), este documento y `docs/TRASPASO.md`.
- Publicadas 1.42.0 a 1.45.0 (último commit `eff8031`). Todo subido; nada a medias.
