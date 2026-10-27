# Estado del proyecto y bitácora de sesiones

Documento compartido entre las cuentas que trabajan en BookShelf. **Al empezar**, leerlo entero. **Al terminar**
cada sesión (o cada bloque), actualizar «Estado actual» si cambia y añadir una entrada arriba del todo en la
bitácora. Es lo que permite a la siguiente sesión retomar sin repetir trabajo ni deshacer decisiones.

## Estado actual

- **Versión publicada**: 1.45.0 (commit `eff8031`, 2026-10-27), en https://bookshelf-wine-iota.vercel.app
- **Árbol de trabajo**: sin cambios pendientes de código al cerrar la 1.45.0 (solo las carpetas de recursos sin
  versionar: `material-diseno/`, `art-inbox/`, `assets-source/`).
- **Supabase**: aplicadas en producción las migraciones de `supabase/migrations/` hasta
  `20261025150000_huellas_rincon.sql`. No hay ninguna migración pendiente de aplicar.

### Últimos bloques (detalle en `SPEC.md`)

| Versión | Qué | SPEC |
| --- | --- | --- |
| 1.45.0 | Cuatro posiciones de figuras en las baldas de la habitación, detalle de figura, dos figuras nuevas («El Guardián de los Clavos», «El Maestro y el Superviviente») y pantalla del portátil | §37 |
| 1.44.0 | Materiales artesanales (terracota, lino salvia, papel crema) en biblioteca y ficha; libro con volumen 3D | §36 |
| 1.43.0 | Biblioteca de tres libros por fila, libro físico, rincón del lector y mapa sonoro | §35 |
| 1.42.0 | Ordenador como escritorio digital con seis apps e iconos de sección ilustrados | §34 |
| 1.41.x | Reflejos de la habitación sin guías; ajustes de Mi diario | §32–33 |

### Pendiente (por orden de prioridad aproximada)

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

- Las placas de navegación de la habitación son iconos y nombres con Guías y reflejos sin Guías (§31, §33).
- Ordenador sin cuero, anillas ni pestañas de tela; Mi diario con pestañas digitales (§34).
- Biblioteca sin etiquetas de título bajo las portadas; tres libros por fila en móvil (§35).
- Materiales artesanales solo en biblioteca y ficha, no en el resto (§36).
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

### 2026-10-27 · cuenta principal · 1.45.0 (documentación)
- Protocolo de traspaso automático en el apartado 0 de `CLAUDE.md`: leer este documento y git al empezar, anotar
  aquí en cada commit y escribir las reglas nuevas en `CLAUDE.md`. Puntero en `Claude/CLAUDE.md` (fuera de git).
- Las dos cuentas trabajan solo en este ordenador; `docs/TRASPASO.md` simplificado.

### 2026-10-27 · cuenta principal · 1.45.0
- Preparado el traspaso entre cuentas: `CLAUDE.md` (reglas y mapa), este documento y `docs/TRASPASO.md`.
- Publicadas 1.42.0 a 1.45.0 (último commit `eff8031`). Todo subido; nada a medias.
