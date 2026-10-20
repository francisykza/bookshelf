// Sobre lacrado del día (SPEC §6, 1.13.0): tarjetas de citas célebres y hojas doradas para las Cajas Sorpresa.
// Reglas puras, sin React. (El estado sigue en `progress.companion` para no perder datos guardados.)

/** Citas célebres de autores clásicos (dominio público) para la colección de tarjetas. */
export const QUOTE_CARDS = [
  { id: 'quijote', text: 'El que lee mucho y anda mucho, ve mucho y sabe mucho.', author: 'Miguel de Cervantes', work: 'Don Quijote de la Mancha' },
  { id: 'ciceron', text: 'Si tienes un jardín y una biblioteca, tienes todo lo que necesitas.', author: 'Cicerón', work: 'Cartas a Varrón' },
  { id: 'machado', text: 'Caminante, no hay camino, se hace camino al andar.', author: 'Antonio Machado', work: 'Campos de Castilla' },
  { id: 'becquer', text: '¿Qué es poesía?, dices mientras clavas en mi pupila tu pupila azul.', author: 'Gustavo Adolfo Bécquer', work: 'Rimas' },
  { id: 'austen', text: 'Al final, no hay placer comparable al de la lectura.', author: 'Jane Austen', work: 'Orgullo y prejuicio' },
  { id: 'carroll', text: '¿Y de qué sirve un libro sin dibujos ni diálogos?', author: 'Lewis Carroll', work: 'Alicia en el país de las maravillas' },
  { id: 'dickinson', text: 'No hay fragata como un libro para llevarnos a tierras lejanas.', author: 'Emily Dickinson', work: 'Poemas' },
  { id: 'thoreau', text: 'Cuántos hombres han fechado una nueva era de su vida a partir de la lectura de un libro.', author: 'Henry David Thoreau', work: 'Walden' },
  { id: 'montaigne', text: 'Los libros son la mejor provisión que he encontrado para este humano viaje.', author: 'Michel de Montaigne', work: 'Ensayos' },
  { id: 'shakespeare', text: 'Estamos hechos de la misma materia que los sueños.', author: 'William Shakespeare', work: 'La tempestad' },
  { id: 'quevedo', text: 'Vivo en conversación con los difuntos, y escucho con mis ojos a los muertos.', author: 'Francisco de Quevedo', work: 'Desde la Torre' },
  { id: 'teresa', text: 'Nada te turbe, nada te espante; todo se pasa.', author: 'Teresa de Jesús', work: 'Poesías' },
  { id: 'bronte', text: 'No soy un pájaro, y ninguna red me atrapa.', author: 'Charlotte Brontë', work: 'Jane Eyre' },
  { id: 'dario', text: 'Juventud, divino tesoro, ¡ya te vas para no volver!', author: 'Rubén Darío', work: 'Cantos de vida y esperanza' },
  { id: 'alcott', text: 'No tengo miedo a las tormentas, porque estoy aprendiendo a gobernar mi barco.', author: 'Louisa May Alcott', work: 'Mujercitas' },
  { id: 'stevenson', text: 'Viajo no para ir a ninguna parte, sino por ir.', author: 'Robert Louis Stevenson', work: 'Viajes con una burra' },
];

export const cardById = (id) => QUOTE_CARDS.find((c) => c.id === id);

/** Hojas doradas que hacen falta para una Caja Sorpresa. */
export const LEAVES_PER_PIECE = 5;

export const EMPTY_COMPANION = { caricias: 0, treasures: 0, lastTreasure: null, leaves: 0, cards: [], pendingCard: null, wearing: [] };

export const treasureReady = (c, today) => c?.lastTreasure !== today;

/**
 * Tesoro del día: una tarjeta que aún no tengas y hojas doradas (doble si hoy ya has leído).
 * Cada `LEAVES_PER_PIECE` hojas se convierten en una Caja Sorpresa.
 */
export function treasureFor(companion, todayPages, rand = Math.random) {
  const owned = new Set([...(companion?.cards ?? []), companion?.pendingCard].filter(Boolean));
  const pool = QUOTE_CARDS.filter((c) => !owned.has(c.id));
  const card = (pool.length ? pool : QUOTE_CARDS)[Math.floor(rand() * (pool.length || QUOTE_CARDS.length))];
  return { cardId: card.id, leaves: todayPages > 0 ? 2 : 1 };
}

/** Aplica un sobre al progreso: hojas doradas (cada 5, una Caja Sorpresa) y la tarjeta por guardar. */
export function applyTreasure(progressState, { date, cardId, leaves }) {
  const c = { ...EMPTY_COMPANION, ...progressState.companion };
  if (c.lastTreasure === date) return progressState;
  const total = c.leaves + leaves;
  const boxes = Math.floor(total / LEAVES_PER_PIECE);
  const figures = progressState.figures ? { ...progressState.figures, boxes: progressState.figures.boxes + boxes } : progressState.figures;
  return {
    ...progressState,
    figures,
    companion: { ...c, lastTreasure: date, treasures: c.treasures + 1, leaves: total % LEAVES_PER_PIECE, lastLeaves: leaves, pendingCard: cardId, lastPieceUp: boxes > 0 },
  };
}
