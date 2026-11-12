// 1.118 (§118) · Los gestos cerrados de la sala de lectura: sin texto libre, la misma lista en el servidor
// (`sala_gesto`). `boton` es lo que se toca, `bocadillo` lo que sale sobre la cabeza y `frase` lo que se lee en el panel.
export const GESTOS = [
  { id: 'hola', boton: '¡Hola!', bocadillo: '¡Hola!', frase: (n) => `${n} levanta la vista y te saluda.` },
  { id: 'taza', boton: 'Alzar la taza', bocadillo: '¡Salud!', frase: (n) => `${n} alza su taza de té hacia ti.` },
  { id: 'libro', boton: '¿Qué tal va?', bocadillo: '¿Qué tal va?', frase: (n) => `${n} te enseña su libro: «¿qué tal va el tuyo?».` },
  { id: 'bueno', boton: '¡Qué bueno!', bocadillo: '¡Qué bueno!', frase: (n) => `${n}: «¡qué bueno!».` },
  { id: 'capitulo', boton: 'Un capítulo más', bocadillo: 'Un capítulo más', frase: (n) => `${n}: «un capítulo más».` },
  { id: 'intenso', boton: 'Momento intenso', bocadillo: '¡Momento intenso!', frase: (n) => `${n} está en un momento intenso.` },
  { id: 'noches', boton: 'Buenas noches', bocadillo: 'Buenas noches', frase: (n) => `${n} te da las buenas noches.` },
];
export const gestoDe = (id) => GESTOS.find((g) => g.id === id) ?? GESTOS[0];

/** El tiempo leído juntos, para la placa: «45 min», «1 h», «3 h 20 min». */
export function tiempoJuntos(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
export const METALES = { laton: 'latón', plata: 'plata', oro: 'oro' };
