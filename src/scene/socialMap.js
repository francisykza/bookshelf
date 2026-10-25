// Objetos interactivos del Salón Social (SPEC §25.9), en píxeles de `images/cozy-social-room.jpg` (900 × 1600),
// medidos sobre una rejilla de la propia imagen. No se añade mobiliario: tablet de la mesita, cuadro de
// «Recomendación de la semana» (el salón no tiene atril: el club vive en el cuadro) y los dos sillones.
export const SOCIAL_SPOTS = {
  tablet: { id: 'tablet', shape: [[409, 1155], [585, 1175], [592, 1290], [372, 1305]] },
  board: { id: 'board', shape: [[578, 205], [852, 205], [852, 705], [578, 705]] },
  seats: [
    // `medallion`: centro del medallón sobre el respaldo; `armrest`: el Guardián, sobre el reposabrazos
    { id: 'sillon-izquierdo', shape: [[150, 780], [430, 780], [430, 1080], [110, 1080]], medallion: [312, 858], armrest: [138, 858] },
    { id: 'sillon-derecho', shape: [[610, 800], [850, 800], [850, 1130], [480, 1130]], medallion: [722, 884], armrest: [800, 922] },
  ],
  // «+N lectores», entre los dos sillones (sobre la mesita del jarrón)
  more: [462, 905],
};
