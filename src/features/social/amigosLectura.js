// 1.153 · La app «Amigos» (docs/qa/amigos-vecinos.md, bloque 3): lo que tu app manda a tus amigos de tu lectura y cómo se
// casa un «Leemos el mismo» con tus libros. Solo títulos, autores, el día en que terminaste y el porcentaje de la lectura a la
// vez: nunca notas, reseñas, citas ni páginas por día. Sin nada pesado (lo usa el arranque).
import { percentRead } from '../../domain/books';

/** Las frases cerradas de una recomendación (sin texto libre). */
export const FRASES = {
  te_gustara: 'Creo que te gustará',
  me_acorde: 'Me acordé de ti al leerlo',
  no_pude_soltarlo: 'No pude soltarlo',
  para_leer_juntos: 'Para leerlo a la vez',
};
export const FRASES_IDS = Object.keys(FRASES);

/** Un título para comparar: sin mayúsculas, tildes ni signos. */
export const tituloClave = (t) =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const reciente = (campo) => (a, b) => String(b[campo] ?? '').localeCompare(String(a[campo] ?? ''));

/** Lo que ven tus amigos: hasta 3 que lees ahora y los 5 últimos terminados (el servidor guarda solo lo que tengas encendido). */
export function lecturaParaAmigos(books) {
  const leyendo = books
    .filter((b) => b.status === 'reading')
    .sort(reciente('updatedAt'))
    .slice(0, 3)
    .map((b) => ({ titulo: b.title, autor: b.author ?? '' }));
  const terminados = books
    .filter((b) => b.status === 'read' && b.finishedAt)
    .sort(reciente('finishedAt'))
    .slice(0, 5)
    .map((b) => ({ titulo: b.title, autor: b.author ?? '', fecha: String(b.finishedAt).slice(0, 10) }));
  return { leyendo, terminados };
}

/** Tu libro con ese título, si lo tienes (el que más has leído si hay dos). */
export function libroDe(books, titulo) {
  const clave = tituloClave(titulo);
  if (!clave) return null;
  const mismos = books.filter((b) => b.status !== 'abandoned' && tituloClave(b.title) === clave);
  return mismos.sort((a, b) => percentRead(b) - percentRead(a))[0] ?? null;
}

/** Tu avance en cada «Leemos el mismo» activo: un libro terminado es el 100 %; uno que no tienes, no cuenta. */
export function avancesJuntos(books, juntos) {
  return (juntos ?? [])
    .filter((j) => j.estado === 'activa')
    .map((j) => {
      const libro = libroDe(books, j.titulo);
      if (!libro) return null;
      return { id: j.id, pct: libro.status === 'read' ? 100 : Math.round(percentRead(libro)) };
    })
    .filter(Boolean);
}

/** Lo que se mandaría ahora, para no repetir un envío igual. */
export const firmaLectura = (payload) => JSON.stringify(payload);

// ── Lo que recuerda este aparato ───────────────────────────────────────────────────────────────────────────────────────
// Que has abierto Amigos alguna vez (desde entonces, tu app manda tu lectura al cambiar), tus lecturas a la vez y lo último
// que se mandó. Todo por cuenta.
const clave = (uid, que) => `bookshelf:amigos:${que}:${uid}`;
const leer = (k, def) => {
  try {
    const v = localStorage.getItem(k);
    return v == null ? def : JSON.parse(v);
  } catch {
    return def;
  }
};
const guardar = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // Sin almacenamiento: se manda al abrir Amigos
  }
};

export const amigosActivo = (uid) => Boolean(uid && leer(clave(uid, 'activo'), false));
export const activarAmigos = (uid) => uid && guardar(clave(uid, 'activo'), true);
export const juntosGuardados = (uid) => leer(clave(uid, 'juntos'), []);
export const guardarJuntos = (uid, juntos) =>
  guardar(
    clave(uid, 'juntos'),
    (juntos ?? []).filter((j) => j.estado === 'activa').map((j) => ({ id: j.id, titulo: j.titulo, estado: j.estado })),
  );
export const firmaEnviada = (uid) => leer(clave(uid, 'enviado'), null);
export const guardarFirma = (uid, firma) => guardar(clave(uid, 'enviado'), firma);

/** Una fecha corta, «20 nov». */
export const diaCorto = (fecha) => {
  const d = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
};

/** Lo que espera en el buzón: llaves, propuestas para leer a la vez y recomendaciones sin ver. */
export const pendientesBuzon = (d) => (d ? d.llaves.length + d.juntos.filter((j) => j.estado === 'invitada' && !j.propuse).length + d.recomendaciones.filter((r) => !r.vista).length : 0);
