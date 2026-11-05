# Piloto «Del portal al sillón» (solo laboratorio)

Rama `experimento/piso-primera-persona`, carpeta `BookShelf-piso-lab`, ruta `/?piloto=piso`. Sin integrar, sin subir y sin
desplegar: pendiente de la decisión de Francisco. No se conecta a Supabase; los pisos se guardan en este navegador con la
clave `bookshelf:lab:piso-primera-persona:<id>`.

## Dónde está cada cosa en el edificio real

| Qué | Dónde | Campo |
| --- | --- | --- |
| Edificio | tabla `pisos`, asignado por el servidor | `edificio` |
| Planta y piso | puerta: 3B, 3A, 2B, 2A, 1B o 1A (`service.js`) | `puerta` (planta + letra) |
| Dueño, permiso | `editable={mine}` en `EdificioPanel`; RLS en el servidor | `user_id` |
| Mueble | `layout.items[]` (`room.js`) | `uid`, `id`, `tono`, `acabado` |
| Posición en el suelo | `layout.items[]` | `x`, `y`, en celdas de una habitación de 9 × 9 |
| Orientación | `layout.items[]` | `rot`, cuartos de vuelta (`toWorld` de `render.js`) |
| En la pared | `layout.items[]` | `pared` (`fondo` o `izq`), `a` |
| Paredes y suelo | `layout` | `pared`, `suelo` |
| Guardado | `savePiso(userId, room)` con `validateRoom` | `upsert` en `pisos` |
| Fachada | `mountFacade` (`facadeView.js`) | `flats[]` |
| Editor | `mountPiso` (`piso.js`) | `room`, `editable`, `onChange` |
| Registro de lectura | `ReadingLogSheet` en `App.jsx` | `bookId` |

**Cambio del piloto**: `labStore.js` sustituye a `savePiso` por `localStorage`, pero pasa por el mismo `validateRoom` y
`exportRoom`. Para integrar hace falta volver a `savePiso`; el formato del `layout` no cambia.

**Campos nuevos del piloto, que el edificio real no tiene**: planta → altura del horizonte (`PLANTAS`) y fachada → qué se ve
desde cada pared (`FACHADAS`). Hoy son una tabla de prueba; habría que decidir su lugar definitivo.

## Qué hay

- Dos pisos de prueba: `lab-1A` (tuyo, da al Gran Hotel) y `lab-2B` («Vecina de prueba», solo mirar, sin hotel).
- Interior en Three.js 0.170, cargado solo al cruzar la puerta. **Lee las cajas de `furniture.js`**, así que todo el catálogo
  con forma aparece, no solo sillón, lámpara y estantería.
- Decorar abre el editor isométrico de siempre sobre el mismo objeto; al volver, el interior muestra lo guardado.
- La silueta de la ventana sale de `renderHotel()` de `hotelArt.js`, de día y de noche.
- El libro y la estantería responden al toque y tienen botones HTML equivalentes.
- Sin GPU: mensaje en HTML con biblioteca, registro y vista de siempre.

## Pendiente y limitaciones

- **Sin vista propia** (se avisa y lleva a la vista de siempre): compañeros místicos con animación y copias con acabado.
- **Ventanas pintadas de los sets de sagas**: no se ha comprobado su hueco; la vista real solo sustituye a la `ventana` básica.
- **Lámpara de pie**: es simétrica; su giro se guarda y se comprueba en los datos, pero apenas se aprecia a la vista.
- **Portadas**: son HTML sobre el lienzo, solo en la balda. Los lomos de `furniture.js` son decorativos y no son tus libros.
- **Cámara**: sale del sillón real, sentada y mirando hacia donde mira el sillón. Un piso sin sillón usa una vista fija. Si el sillón queda de cara a una pared, se verá la pared.
- **Horizonte por planta**: valores de prueba, ajustados a la nueva altura de los ojos.
- **Materiales**: solo la lámpara de pie, las paredes y el sillón van dibujados en píxel; las mesas llevan veta y el suelo es el del decorador. Los demás muebles y la alfombra siguen siendo cajas con luz suave, y el brillo de la lámpara en la estantería también.
- **Cubierta**: se pide al tocar la puerta y el piso la espera hasta 2,2 s; si tarda más, aparece primero la tela con el título.
- **Hora**: se entra al atardecer, la hora fija de la fachada, también en el editor. La fachada no sigue el reloj, y el interior tampoco.
- **Portal**: la ruta se abre sobre el rincón, que se carga detrás. Si el portal pasara a ser la entrada, habría que evitarlo.
- **Multijugador**: fuera del piloto, como pide el encargo.

## Medidas

**Tomadas antes de refinar el encuadre**: el interior nuevo pide además la cubierta de la lectura y no se han repetido.

`node scripts/piso-lab-medir.mjs` (resultado completo en `qa-report/piso-lab/medidas.json`, no versionado).

**Son de emulación**: versión compilada servida en local, Chromium móvil a 390 × 844, CPU ×4 y WebGL por software
(SwiftShader). **Sin dispositivo físico.** Una sola pasada por caso, así que los tiempos son orientativos.

| Biblioteca de 1.200 libros | Rincón vigente (`/`) | Piloto (`/?piloto=piso`) |
| --- | --- | --- |
| Primera carga | 1.029 ms hasta la escena | 2.017 ms hasta el portal |
| Primer pintado con contenido | 684 ms | 760 ms |
| Bytes de la ruta (gzip) | 2.436 KB | 2.508 KB en el portal; 2.634 KB ya dentro |
| Hasta abrir el registro | 384 ms | 1.646 ms desde el portal (1.404 entrar + 242 registrar) |
| Giro | no aplica | 60 FPS, percentil 95 de 16,7 ms (301 fotogramas) |

Con la biblioteca de ejemplo: registro en 1.656 ms y giro igual. Su primera medida del rincón (1.978 ms) se hizo con el
servidor en frío y no sirve para comparar.

**Three.js no se pide en el portal** (`three: false`) y pesa unos 126 KB gzip al entrar.

**El giro no demuestra el objetivo de 30 FPS en un móvil**: la limitación de CPU no afecta al proceso de la GPU, que aquí es
el procesador de un ordenador de sobremesa. Lo mide de verdad un móvil físico: abrir el piso y ejecutar en la consola
`await window.__pisoLab().measureYaw(5000)`.

**Diez entradas y salidas en la versión compilada**: 10 contextos WebGL creados, uno por entrada, y 0 lienzos vivos al final;
memoria igual en la primera y la última visita de cada piso (13 geometrías y 3 texturas; 8 y 2). En desarrollo salen el doble
porque StrictMode monta dos veces, y por eso la prueba e2e admite hasta 22.

## Pruebas

- `e2e/piso-lab.spec.js`: 8 de 8 en `chromium-390x844` y en `webkit-390x844`. WebKit de Playwright en Windows no equivale a Safari.
- `e2e/piso-lab-video.spec.js`: recorrido continuo; deja el vídeo en `qa-report/test-results/`.
- `e2e/rincon-01-estanteria.spec.js`: sin regresiones en `chromium-390x844`.
- Vitest de `src/features/pisoLab` y `src/features/edificio`: 202 pasan.

**Sin probar**: iPhone, Safari y Android reales; pérdida real del contexto de la GPU (solo se ha simulado un navegador sin
WebGL).
