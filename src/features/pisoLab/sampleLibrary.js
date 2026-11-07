// Bibliotecas de prueba del piloto: siempre las mismas para el mismo tamaño, sin azar ni libros reales. Se piden con
// `/?piloto=piso&biblioteca=N`. Cada navegador guarda la suya, y nunca se siembra en el host de producción. La biblioteca
// que hubiera se copia aparte la primera vez y vuelve con `&biblioteca=propia`.
export const SAMPLE_SIZES = [0, 50, 1000, 5000];
export const PRODUCTION_HOST = 'bookshelf-wine-iota.vercel.app';
const STORAGE_KEY = 'bookshelf:v1';
export const MARK_KEY = 'bookshelf:lab:biblioteca';
export const COPY_KEY = 'bookshelf:lab:biblioteca-propia';

/** ¿Hay una biblioteca de demostración en este navegador? Entonces la nube no se usa: nunca sube a una cuenta real. */
export function demoLibraryActive(store = globalThis.localStorage) {
  try {
    return store?.getItem(MARK_KEY) != null;
  } catch {
    return false;
  }
}
const COVERS = 12;

const OPENINGS = ['El jardín', 'La casa', 'El último viaje', 'La isla', 'El cuaderno', 'La memoria', 'El faro', 'La biblioteca', 'El invierno', 'La cartógrafa', 'El relojero', 'La orilla', 'El camino', 'La noche', 'El río', 'La ciudad'];
const ENDINGS = ['de las sombras', 'del norte', 'sin nombre', 'de sal', 'de los días', 'junto al mar', 'de ceniza', 'de papel', 'del silencio', 'de la niebla', 'de cristal', 'bajo la lluvia', 'de otoño', 'de mañana', 'de las campanas', 'del puerto'];
const NAMES = ['Inés', 'Tomás', 'Lucía', 'Andrés', 'Marta', 'Óscar', 'Nuria', 'Hugo', 'Elena', 'Rubén', 'Clara', 'Iván'];
const SURNAMES = ['Arrieta', 'Bermejo', 'Castaño', 'Dueñas', 'Escudero', 'Falcón', 'Gallardo', 'Herrán', 'Ibarra', 'Jurado', 'Lozano', 'Montero', 'Núñez', 'Ortuño'];
const COLORS = ['#7a2f2a', '#25496b', '#3f6048', '#8a6a2f', '#553a6b', '#2e5a5a', '#94502e', '#3a3a4a'];
const START = Date.UTC(2023, 0, 1);
const DAY = 86400000;

/** Un número fijo para cada libro y cada uso. */
const mix = (i, salt) => {
  let h = Math.imul(i + 1, 2654435761) ^ Math.imul(salt + 1, 40503);
  h = Math.imul(h ^ (h >>> 13), 1597334677);
  return (h ^ (h >>> 16)) >>> 0;
};
const pick = (list, i, salt) => list[mix(i, salt) % list.length];
const stateOf = (i) => {
  if (i < 3) return 'reading';
  const n = mix(i, 1) % 100;
  return n < 55 ? 'read' : n < 90 ? 'want' : 'abandoned';
};
/** El 60 % con portada; el 25 % sin ella; el 15 % con una dirección que falla, como pasa en una biblioteca real. */
const coverOf = (i) => {
  if (i < 3) return `/lab/covers/c${i}.png?n=${i}`;
  const n = mix(i, 2) % 100;
  if (n < 60) return `/lab/covers/c${n % COVERS}.png?n=${i}`;
  return n < 85 ? '' : `/lab/covers/no-existe.png?n=${i}`;
};

export function sampleBooks(n) {
  return Array.from({ length: n }, (_, i) => {
    const status = stateOf(i);
    const pageCount = 120 + (mix(i, 3) % 680);
    const added = new Date(START + i * (DAY / 4)).toISOString();
    return {
      id: `lab-${i}`,
      title: `${pick(OPENINGS, i, 4)} ${pick(ENDINGS, i, 5)}, n.º ${i + 1}`,
      author: `${pick(NAMES, i, 6)} ${pick(SURNAMES, i, 7)}`,
      status,
      pageCount,
      currentPage: status === 'reading' ? 40 + i * 10 : status === 'read' ? pageCount : status === 'abandoned' ? Math.floor(pageCount / 3) : 0,
      cover: coverOf(i),
      spineColor: pick(COLORS, i, 8),
      addedAt: added,
      updatedAt: added,
      finishedAt: status === 'read' ? new Date(START + i * (DAY / 4) + 20 * DAY).toISOString() : null,
      source: 'sample-lab',
      quotes: [],
    };
  });
}

export function sampleState(n) {
  const has = (i) => (n > i ? `lab-${i}` : null);
  return {
    version: 6,
    books: sampleBooks(n),
    settings: { sound: false, viewMode: 'cover', owner: 'Prueba', currentBookId: has(0), roomFeaturedId: has(10), roomExhibit: [has(20), has(30)].filter(Boolean) },
  };
}

/** Prepara la biblioteca pedida en la dirección, antes de que la app lea el almacenamiento. */
export function seedPilotLibrary(place, store) {
  const params = new URLSearchParams(place.search);
  const asked = params.get('biblioteca');
  if (params.get('piloto') !== 'piso' || asked == null || place.hostname === PRODUCTION_HOST) return false;
  if (asked === 'propia') {
    const copy = store.getItem(COPY_KEY);
    if (store.getItem(MARK_KEY) == null) return false;
    if (copy == null) store.removeItem(STORAGE_KEY);
    else store.setItem(STORAGE_KEY, copy);
    store.removeItem(COPY_KEY);
    store.removeItem(MARK_KEY);
    return true;
  }
  const n = Number(asked);
  if (!SAMPLE_SIZES.includes(n) || store.getItem(MARK_KEY) === asked) return false;
  try {
    // Lo que hubiera no se pierde; si no cabe la copia, no se siembra
    if (store.getItem(MARK_KEY) == null && store.getItem(STORAGE_KEY) != null) store.setItem(COPY_KEY, store.getItem(STORAGE_KEY));
    store.setItem(STORAGE_KEY, JSON.stringify(sampleState(n)));
    store.setItem(MARK_KEY, asked);
    store.setItem('bookshelf_onboarding_done', 'true');
    store.setItem('bookshelf:signs-hint-done', 'true');
    return true;
  } catch (error) {
    console.warn('Piloto: no se ha podido preparar la biblioteca de prueba', error);
    return false;
  }
}
