// Misiones semanales (SPEC §7): cada una se reclama una vez por semana y da +1 Caja Sorpresa.
import { isInWeek, weekKey } from './dates';

const weekPages = (state, week) =>
  state.progress.readingLog.filter((e) => weekKey(new Date(`${e.date}T12:00:00`)) === week).reduce((s, e) => s + e.pages, 0);

export const MISSIONS = [
  {
    id: 'pages',
    title: 'Lee 150 páginas esta semana',
    target: 150,
    value: (state, week) => weekPages(state, week),
  },
  {
    id: 'quotes',
    title: 'Subraya 2 citas',
    target: 2,
    value: (state, week) => state.books.reduce((s, b) => s + b.quotes.filter((q) => isInWeek(q.createdAt, week)).length, 0),
  },
  {
    id: 'pomodoro',
    title: 'Completa 2 sesiones de lectura cozy',
    target: 2,
    value: (state, week) => state.progress.pomodoros.filter((p) => isInWeek(p.at, week)).length,
  },
  {
    id: 'finish',
    title: 'Termina un libro',
    target: 1,
    value: (state, week) => state.books.filter((b) => b.status === 'read' && isInWeek(b.finishedAt, week)).length,
  },
  {
    id: 'review',
    title: 'Escribe una reseña',
    target: 1,
    value: (state, week) => state.books.filter((b) => b.review?.trim() && isInWeek(b.reviewedAt, week)).length,
  },
];

export function missionStatus(state, now = new Date()) {
  const week = weekKey(now);
  const claimed = state.progress.claimed[week] ?? [];
  return MISSIONS.map((m) => {
    const value = Math.min(m.target, m.value(state, week));
    return { ...m, value, done: value >= m.target, claimed: claimed.includes(m.id) };
  });
}
