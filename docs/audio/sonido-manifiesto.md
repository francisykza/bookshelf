# Manifiesto de sonido · «Escritorio del puerto» (1.90)

Todo es original, generado para BookShelf. Son **muestras para aprobar la dirección**, no música final de estudio. Mar y lluvia son **ruido sintetizado**, no grabaciones. Nada procede de YouTube, Spotify ni juegos.

Generación reproducible con semilla fija: `FFMPEG_PATH=… node scripts/audio/generate-port-audio.cjs`. Cifras medidas en `docs/audio/medidas-audio.json` y, en la salida real de la app, en `qa-report/v190/evidencias/medidas-escucha.json`.

## Bucles (`public/media/sonido/`, se piden solo tras activar o elegir)

| Archivo | Procedencia y licencia | Duración | Tamaño | Canales | Pico del original | Uso |
| --- | --- | --- | --- | --- | --- | --- |
| `tarde-en-el-puerto.mp3` | Síntesis offline propia (FM suave, semilla 19032026), propiedad del proyecto | 32 s de bucle (34 s en archivo) | 544 600 B | 2 | −5,0 dBFS | Música, panel Sonido |
| `luz-de-escritorio.mp3` | Síntesis offline propia (colchón y notas sueltas, semilla 7112026), propiedad del proyecto | 32 s (34 s) | 476 525 B | 2 | −6,0 dBFS | Música, panel Sonido |
| `mar.mp3` (retirado por ahora: no se ofrece ni se descarga) | Ruido filtrado propio con oleaje lento, sin gaviotas (semilla 48151623) | 32 s (34 s) | 408 451 B | 2 | −11,1 dBFS | Ambiente, panel Sonido |
| `lluvia.mp3` | Ruido y gotas sintéticas uniformes, sin truenos (semilla 27182818) | 32 s (34 s) | 408 451 B | 2 | −9,4 dBFS | Ambiente, panel Sonido |

Cada archivo pesa menos de 1 MB. Lleva 1 s repetido a cada lado y el reproductor hace el bucle entre 0,5 s y 32,5 s, para que no dependa del retardo del decodificador MP3.

## Efectos (`src/audio/uiSounds.js`, 0 KB descargados: síntesis en tiempo real, sin azar relevante)

Pico medido en la salida de la app con efectos 25 % y master 70 %.

| Evento | Duración | Diseño | Pico | Uso |
| --- | --- | --- | --- | --- |
| `ui-press` | 35 ms | Ruido filtrado 1,4 kHz | −31,3 dBFS | Mes y día del calendario |
| `panel-open` | 100 ms | Ruido de 900 a 2400 Hz | −30,9 dBFS | Abrir menú, Sonido, registro, función |
| `panel-close` | 70 ms | El mismo, más corto y bajo | −33,1 dBFS | Cerrar hojas y volver |
| `computer-open` | 165 ms en total | Mi5 y Sol5, senos | −29,2 dBFS | Abrir el ordenador |
| `save-success` | 220 ms | Do5, Mi5, Sol5 | −29,6 dBFS | Lectura guardada y confirmada |
| `save-error` | 130 ms | Dos pulsos La3 | −29,7 dBFS | Guardado fallido |

Ganancia de cada voz ≤ 0,08 antes de los buses, ataque ≥ 3 ms y caída ≥ 20 ms. Compensación de canal medida para que los valores de fábrica se oigan: tonos ×2,5, ruido ×7,5, ambiente ×1,8, música ×2,4.

La mezcla de fábrica (música 12, ambiente 15, efectos 25, master 70) da −15,7 dBFS de pico y −30,2 dBFS RMS. No hay recorte en ninguna sección medida. **El equilibrio al oído está sin validar: lo decide la escucha.**
