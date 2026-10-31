# Análisis de qa-report/qa-telemetry.json

- Generado: 2026-10-31T16:05:46.728Z
- Ejecuciones: 81 · estados auditados: 24
- Nota del informe: WebKit automatizado no equivale a Safari en un iPhone real. La geometría comprueba consistencia, no que las coordenadas coincidan con lo pintado.

## Estados auditados

| Apartado | Estados con hallazgos | Hallazgos (total) |
| --- | ---: | ---: |
| `overflowElements` | 0 de 24 | 0 |
| `backgroundCheck` | 0 de 24 | 0 |
| `overlappingInteractive` | 3 de 24 | 24 |
| `brokenOrUncroppedAssets` | 0 de 24 | 0 |
| `consoleErrors` | 0 de 24 | 0 |

### `overlappingInteractive`

- button.room-spine ← button.hotspot — 14 vez/veces (chromium-390x844 · v159-aviso-lectura)
- button.spine ← button.scroll-chevron.scroll-chevron--right — 7 vez/veces (chromium-1440x900 · v159-lomos-1500, chromium-390x844 · v159-lomos-1500)
- button.spine ← button.scroll-chevron.scroll-chevron--left — 2 vez/veces (chromium-390x844 · v159-lomos-1500)
- button.hotspot ← button.hotspot — 1 vez/veces (chromium-390x844 · v159-aviso-lectura)

## Estados por proyecto

- chromium-1440x900: v159-perfil-figuras, v159-biblioteca-1500, v159-biblioteca-final, v159-portadas-estables, v159-lomos-1500
- chromium-320x640: v159-visita-habitacion, v159-perfil-desde-visita
- chromium-390x844: v159-perfil-figuras, v159-visita-habitacion, v159-perfil-desde-visita, v159-biblioteca-1500, v159-biblioteca-final, v159-portadas-estables, v159-aviso-lectura, v159-registro-teclado, v159-lomos-1500
- chromium-390x844-reduced: v159-biblioteca-1500, v159-biblioteca-final, v159-portadas-estables
- chromium-430x932: v159-visita-habitacion, v159-perfil-desde-visita
- webkit-390x844: v159-perfil-figuras, v159-visita-habitacion, v159-perfil-desde-visita

## Errores de página y de consola de toda la QA

- Errores de página: 0
- Errores de consola: 0
