// Catálogo de la radio del rincón (1.62, SPEC §62.3). Sale de `catalogo-radio.json` (paquete social-radio); cada pista
// declara título, autor, fuente y créditos. Solo se ofrecen sintonías con pistas reproducibles: nada de categorías vacías
// que parezcan disponibles. Añadir música = añadir pistas con sus condiciones documentadas (sin YouTube ni Spotify).
import data from './catalogo-radio.json';

const SAFE_SRC = /^\/media\/social-radio\/[a-z0-9-]+\.(mp3|m4a|ogg)$/;

/** Sintonías válidas: id, título y al menos una pista con fuente local, título, autor y créditos. */
export function playableStations(raw) {
  return (raw?.stations ?? [])
    .map((s) => ({
      id: String(s.id ?? ''),
      title: String(s.title ?? ''),
      tracks: (s.tracks ?? []).filter((t) => t?.id && t.title && t.artist && t.credits && SAFE_SRC.test(t.src ?? '')),
    }))
    .filter((s) => s.id && s.title && s.tracks.length);
}

export const STATIONS = playableStations(data);
export const stationById = (id) => STATIONS.find((s) => s.id === id) ?? STATIONS[0] ?? null;
