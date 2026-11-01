// «La librería del puerto» (prototipo, solo desarrollo): ranking semanal y mensual y quién recibe la distinción.
// Lógica pura: sin DOM ni red. En la app de verdad, los resultados los valida y los guarda el servidor (repitiendo los
// movimientos sobre el nivel de la semana) y las distinciones las concede el servidor; aquí solo se ordena.
//
// - Semana: cuenta el mejor resultado de cada persona en el nivel de esa semana. Menos movimientos primero; a igualdad,
//   quien lo consiguió antes.
// - Mes: suma las semanas cuyo jueves cae en ese mes (`monthOfWeek`). Primero quien ha completado más semanas; luego,
//   menos movimientos de más (movimientos − mínimo) en total; a igualdad, quien terminó antes su última semana.
// - Distinción: los tres primeros de cada semana y de cada mes.
import { monthOfWeek } from './weekly';

export const PODIUM = 3;

/** Distinciones del ranking, con la misma forma que las del perfil (`DISTINCTIONS` de huellas.js). */
export const RANKING_DISTINCTIONS = {
  'libreria-semana': { name: 'Podio de la semana', meaning: 'Entre los tres primeros del nivel de la semana de La librería del puerto.' },
  'libreria-mes': { name: 'Podio del mes', meaning: 'Entre los tres primeros del mes de La librería del puerto.' },
};

/** Mejor resultado de cada persona en una semana. `results`: [{ user, nombre, week, moves, min, at }]. */
function bestByUser(results) {
  const best = new Map();
  for (const r of results) {
    const prev = best.get(r.user);
    if (!prev || r.moves < prev.moves || (r.moves === prev.moves && r.at < prev.at)) best.set(r.user, r);
  }
  return [...best.values()];
}

const withPlaces = (rows) => rows.map((r, i) => ({ ...r, puesto: i + 1 }));

/** Ranking de una semana: [{ user, nombre, moves, min, at, puesto }]. */
export function weeklyRanking(results, week) {
  const rows = bestByUser(results.filter((r) => r.week === week));
  rows.sort((a, b) => a.moves - b.moves || a.at - b.at);
  return withPlaces(rows);
}

/** Ranking de un mes: [{ user, nombre, semanas, extra, at, puesto }]. */
export function monthlyRanking(results, month) {
  const weeks = [...new Set(results.filter((r) => monthOfWeek(r.week) === month).map((r) => r.week))];
  const byUser = new Map();
  for (const week of weeks) {
    for (const r of weeklyRanking(results, week)) {
      const acc = byUser.get(r.user) ?? { user: r.user, nombre: r.nombre, semanas: 0, extra: 0, at: 0 };
      acc.semanas += 1;
      acc.extra += r.moves - r.min;
      acc.at = Math.max(acc.at, r.at);
      byUser.set(r.user, acc);
    }
  }
  const rows = [...byUser.values()];
  rows.sort((a, b) => b.semanas - a.semanas || a.extra - b.extra || a.at - b.at);
  return withPlaces(rows);
}

/** Distinciones que tocan al cerrar un periodo: los tres primeros, con su puesto en la nota. */
export function podiumDistinctions(ranking, kind, periodo) {
  return ranking.slice(0, PODIUM).map((r) => ({ user: r.user, kind, note: `${r.puesto}.º · ${periodo}` }));
}

// ── Datos de demostración (inventados, rotulados «Demo»; nunca salen de esta página) ──

const DEMO_READERS = ['Lectora del faro', 'Marinero de agua dulce', 'Gaviota lectora', 'Capitana Brisa', 'Farero nocturno', 'La de la lonja', 'Remo y tinta', 'Puerto Lectura', 'Señora Bajamar', 'Viejo lobo de libros', 'Sirena con gafas', 'Grumete lector', 'Ancla y marcapáginas', 'Cartógrafa de estanterías'];

function demoRand(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * Resultados inventados de lectores de demostración para unas semanas (`weeks`: [{ week, min, start }], con `start`
 * el lunes en milisegundos). Reproducibles: la misma semana da los mismos resultados.
 */
export function demoResults(weeks) {
  const out = [];
  for (const { week, min, start } of weeks) {
    const rand = demoRand(week);
    DEMO_READERS.forEach((nombre, i) => {
      if (rand() < 0.2) return; // no todo el mundo juega todas las semanas
      const extra = [0, 0, 0, 1, 2, 2, 3, 4, 6][Math.floor(rand() * 9)];
      out.push({ user: `demo-${i}`, nombre, week, moves: min + extra, min, at: start + Math.floor(rand() * 6 * 86400000) });
    });
  }
  return out;
}
