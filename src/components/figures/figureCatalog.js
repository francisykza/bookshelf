// Catálogo de figuras (SPEC §7.1 y §11.7): `public/figures/catalog.json` se lee en tiempo de ejecución, así
// que una figura nueva es solo una imagen y un objeto JSON, sin tocar React. Las reglas viven en
// `domain/figureCatalog.js`; aquí solo la carga compartida y el hook. Un fallo de red no deja el catálogo
// vacío para siempre: se reintenta al recuperar la conexión o al volver a montar.
import { useEffect, useState } from 'react';
import { createCatalogLoader, figureForBook as matchFigure, forRules } from '../../domain/figureCatalog';
import { asset } from '../../scene/sceneMap';

const loader = createCatalogLoader({ url: asset('figures/catalog.json'), base: asset('figures/') });
const listeners = new Set();

export function loadFigureCatalog() {
  return loader.load().then((list) => {
    if (list) listeners.forEach((fn) => fn(list));
    return list ?? [];
  });
}

/** Todas las figuras del catálogo (vacío mientras carga o si aún no se ha podido cargar). */
export function useFigureCatalog() {
  const [list, setList] = useState(() => loader.get() ?? []);
  useEffect(() => {
    if (loader.get()) return undefined;
    listeners.add(setList);
    loadFigureCatalog();
    const retry = () => loadFigureCatalog();
    window.addEventListener('online', retry);
    return () => {
      listeners.delete(setList);
      window.removeEventListener('online', retry);
    };
  }, []);
  return list;
}

export { forRules };
export const figureForBook = matchFigure;
