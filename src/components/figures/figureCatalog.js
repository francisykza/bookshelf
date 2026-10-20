// Catálogo de figuras (SPEC §7.1, 1.14.0): `public/figures/catalog.json` se lee en tiempo de ejecución, así
// que una figura nueva es solo una imagen y un objeto JSON, sin tocar React.
import { useEffect, useState } from 'react';
import { RARITY, fold } from '../../domain/figures';

const BASE = '/figures/';
const url = (src) => (/^(https?:)?\//.test(src) ? src : BASE + src);

function normalize(entry, imageSize) {
  const img = entry.imageSize ?? imageSize ?? { w: 1024, h: 1536 };
  return {
    id: entry.id,
    name: entry.name ?? entry.id,
    sagaTitle: entry.sagaTitle ?? '',
    matchKeywords: entry.matchKeywords ?? [],
    rarity: RARITY[entry.rarity] ? entry.rarity : 'rare',
    starter: Boolean(entry.starter),
    img,
    boxImage: url(entry.boxImage),
    unboxedImage: url(entry.unboxedImage ?? entry.boxImage),
    // Sin recorte propio, la imagen «fuera de caja» se usa entera
    unboxedCrop: entry.unboxedCrop ?? { x: 0, y: 0, ...img },
    // Recortes reales (1.15.0): contorno de la caja, silueta de la figura, ventana de plástico y cabeza
    boxOutline: entry.boxOutline ?? null,
    boxWindow: entry.boxWindow ?? null,
    unboxedSilhouette: entry.unboxedSilhouette ?? null,
    pinCrop: entry.pinCrop ?? entry.unboxedCrop ?? { x: 0, y: 0, ...img },
    particles: entry.particles ?? 'gold',
    accent: entry.accent ?? '#e8c46a',
    loreSeals: (entry.loreSeals ?? []).slice(0, 5),
    parts: (entry.blisterParts ?? []).map((p) => (typeof p === 'string' ? { name: p, kind: 'relic', crop: null } : { name: p.name, kind: p.kind ?? 'relic', crop: p.crop ?? null })),
  };
}

let cache = null;
let pending = null;
const listeners = new Set();

export function loadFigureCatalog() {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = fetch(`${BASE}catalog.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : { figures: [] }))
      .catch(() => ({ figures: [] }))
      .then((json) => {
        cache = (json.figures ?? []).filter((f) => f?.id && f.boxImage).map((f) => normalize(f, json.imageSize));
        listeners.forEach((fn) => fn(cache));
        return cache;
      });
  }
  return pending;
}

/** Todas las figuras del catálogo (vacío mientras carga). */
export function useFigureCatalog() {
  const [list, setList] = useState(cache ?? []);
  useEffect(() => {
    if (cache) return undefined;
    listeners.add(setList);
    loadFigureCatalog();
    return () => listeners.delete(setList);
  }, []);
  return list;
}

/** Primera figura del catálogo cuya saga encaja con el título de un libro. */
export function figureForBook(catalog, book) {
  const title = fold(book.title);
  return catalog.find((f) => f.matchKeywords.some((k) => k && title.includes(fold(k)))) ?? null;
}

/** Datos mínimos para las reglas puras de las Cajas Sorpresa. */
export const forRules = (catalog) => catalog.map((f) => ({ id: f.id, rarity: f.rarity, parts: f.parts }));
