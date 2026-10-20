// Fechas locales en formato `YYYY-MM-DD` (los registros de lectura se agrupan por día del lector).

const pad = (n) => String(n).padStart(2, '0');

export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Lunes de la semana de `date` como clave: las misiones se reinician cada lunes. */
export function weekKey(date = new Date()) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  return dayKey(monday);
}

export function isInWeek(iso, week) {
  if (!iso) return false;
  return weekKey(new Date(iso)) === week;
}

export function lastDays(count, today = new Date()) {
  return Array.from({ length: count }, (_, i) => dayKey(addDays(today, i - count + 1)));
}

export function monthsSince(iso, now = new Date()) {
  if (!iso) return 0;
  const then = new Date(iso);
  return Math.max(0, (now.getFullYear() - then.getFullYear()) * 12 + now.getMonth() - then.getMonth());
}

export function daysLeftInYear(now = new Date()) {
  const end = new Date(now.getFullYear(), 11, 31);
  return Math.max(0, Math.round((end - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000));
}

const DAY_NAMES = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
export const shortDay = (key) => DAY_NAMES[parseDay(key).getDay()];

/** Hora del día de la escena según el reloj: mañana 7–18 h, atardecer 18–21 h, noche el resto. */
export function timeOfDayByClock(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 7 && h < 18) return 'morning';
  if (h >= 18 && h < 21) return 'sunset';
  return 'night';
}
