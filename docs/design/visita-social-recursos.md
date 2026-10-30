# Recursos de la visita social · revisión sobre 1.57.0

## Procedencia y preparación

Derivados del vídeo aportado por el usuario: Generar_transición_vertical_con_…_ac249550_1080p.mp4. No se ha generado otro vídeo. Conversión H.264, yuv420p, 720×1280, 24 fps, sin audio, faststart, CRF 23. Velocidad original. Los fondos WebP se extraen del primer y del último fotograma decodificado de ESTE MP4 final, con calidad 88.

| Archivo relativo a public/ | Bytes | Uso |
|---|---:|---|
| media/social-visit/entrada-v1.mp4 | 4424855 | Entrada compartida, aproximadamente 7,92 s |
| media/social-visit/casa-v1.webp | 286840 | Imagen inicial |
| media/social-visit/habitacion-v1.webp | 207156 | Fondo de llegada |

Total recursos: 4.918.851 bytes (~4,92 MB decimales). Descarga inicial de la app: no debe incluir el vídeo. La velocidad original permite valorar primero el movimiento; no duplicar archivos para velocidades distintas.

## Coordenadas iniciales (normalizadas, origen arriba a la izquierda)

Estas zonas se basan en inspección de fotogramas; son puntos de partida, NO calibración final verificada en la app.
- Ventana inferior derecha de la casa: x≈0,48–0,73; y≈0,46–0,64. Única ventana recorrida por el vídeo.
- Estantería final: x≈0–0,23; y≈0–0,83. No ocupa una zona frontal ancha.
- Hueco útil de balda superior para lomos: polígono aproximado (0,02;0,18), (0,20;0,24), (0,20;0,34), (0,02;0,29). Calibrar sobre el fondo a resolución nativa. La base es inclinada, no una línea horizontal de pantalla.
- Mantener libre el sillón central derecho, la mesa y el paisaje. El nombre del lector debe ser DOM, no texto pintado en la imagen.

Usar un contenedor común para fondo y hotspots; aplicar la misma escala y desplazamiento si se decide recortar. Se recomienda contain 9:16 para esta primera versión.

## Límites conocidos

La transición tiene pequeñas variaciones generativas en objetos entre exterior e interior. El final conserva algo de movimiento antes de detenerse. No hay estantería dinámica dentro del MP4. No representa las escenas día/lluvia/noche guardadas en el perfil actual. Mantener acceso al perfil existente y presentar esta escena como espacio común de visita.

No se entregan portadas falsas, avatares, figuras ni sonidos. Usar recursos y datos autorizados del proyecto. Las baldas vacías son intencionales. La variante completa para escritorio y las trayectorias a otras ventanas quedan fuera de esta entrega.

## Verificado aquí

Se revisaron los puntos de integración de código y se generaron/decodificaron los recursos. No se modificó el código de BookShelf, no se ejecutaron build, pruebas de la aplicación, consultas a Supabase ni despliegues. El prompt pide esas comprobaciones al implementar.
