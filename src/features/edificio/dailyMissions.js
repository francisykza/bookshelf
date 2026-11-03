// Misiones del día en tu piso (1.70, SPEC §70; decisión de Francisco del 1-11-2026): tres cosas pequeñas que hacer
// en la habitación cada día. Hechas las tres, llega una prenda nueva para tu personaje. Desde la 1.79 (decisión de
// Francisco del 3-11-2026), con toda la ropa ya ganada, las tres dan `DIARIA_TICKETS` tickets en su lugar. Las tres del
// día son las mismas para todo el mundo y salen de la fecha; el servidor las calcula igual (`piso_diarias_del_dia`) y
// solo cuenta esas, una vez cada una.

/** Los tickets de las tres del día cuando ya tienes todo el armario (los mismos que en `piso_mision_diaria`). */
export const DIARIA_TICKETS = 5;

export const DAILY = [
  { id: 'sentarse', texto: 'Siéntate un rato' },
  { id: 'mover', texto: 'Mueve un mueble' },
  { id: 'color', texto: 'Cambia un color' },
  { id: 'tarde', texto: 'Luz de tarde' },
  { id: 'pasear', texto: 'Da un paseo' },
  { id: 'nuevo', texto: 'Estrena un mueble' },
  { id: 'armario', texto: 'Cámbiate de ropa' },
];

const EPOCH = Date.UTC(2026, 0, 1);

/** El día de hoy en el dispositivo, como «AAAA-MM-DD». */
export function todayKey(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Las tres misiones de un día: tres de la lista, de dos en dos desde el número del día (nunca se repiten). */
export function missionsOf(day) {
  const [y, m, d] = day.split('-').map(Number);
  const n = Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000);
  const len = DAILY.length;
  return [0, 2, 4].map((k) => DAILY[(((n + k) % len) + len) % len]);
}
