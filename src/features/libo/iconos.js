// 1.158 · Los iconos de «Lo de hoy», la tarjeta de Libo (docs/qa/libo-lo-de-hoy.md). Dibujados aquí a mano, píxel a píxel
// (Francisco, 27-11-2026: «que los iconos sean más originales»; nunca de una librería), en una rejilla de 11 × 11 con la
// tinta del kit de píxel del edificio (pixelUi.js): madera, papel, salvia, terracota y latón. Cada fila es una cadena: un
// carácter por píxel y «.» para el hueco.

/** La tinta: la misma paleta que INK en pixelUi.js, más un marrón casi negro para el dorso de los naipes. */
export const TINTA = {
  o: '#3b2618',
  w: '#8a5a38',
  l: '#c8946a',
  W: '#6b4329',
  p: '#fbf3df',
  h: '#fffaf0',
  s: '#e3cfa6',
  g: '#5c6a48',
  G: '#83946a',
  D: '#46523a',
  r: '#b4644d',
  R: '#d98b6a',
  y: '#c98a1c',
  Y: '#f0c35a',
  a: '#ffb43c',
  A: '#ffe9a0',
};

export const ICONOS = {
  // El casino: un naipe con la huella del mapache crupier, delante de otro boca abajo
  casino: ['oooooo.....', 'owlwlo.....', 'olwooooooo.', 'owlohrhrho.', 'olworhhhro.', 'owlohhhhho.', 'olwohrrrho.', 'owlohrrrho.', 'oooohhhhho.', '...ohhhhho.', '...ooooooo.'],
  // El buzón verde del portal con una carta lacrada asomando
  buzon: ['...oooooo..', '..ophhhpo..', '..oprRrpo..', '.oooooooooo', 'oGGGGGGGGGo', 'oGggggggggo', 'oGgDDDDDggo', 'oGggggggggo', 'oDDDDDDDDDo', 'ooooooooooo', '....oWo....'],
  // Lo que sigues, de oferta: el sillón con su etiqueta de precio colgando
  rebaja: ['.......oo..', '......oYo..', '.ooooooyo..', 'orRRRRoYYo.', 'orrrrroyyyo', 'orrrrrooooo', 'oooooooooo.', 'oRRRRRRRRo.', 'orrrrrrrro.', 'oooooooooo.', '.oW....oW..'],
  // Lo nuevo del almacén: la caja de madera con un destello
  nuevo: ['........A..', '.......AaA.', '........A..', 'oooooooo...', 'olllllllo..', 'oooooooooo.', 'owwlwwwlwo.', 'owwlwwwlwo.', 'oooooooooo.', 'owwlwwwlwo.', 'oooooooooo.'],
  // El café: la taza con su vapor
  cafe: ['...l..l....', '..l..l.....', '...l..l....', '...........', 'ooooooooo..', 'oWWWWWWWooo', 'ohhhhhhho.o', 'opppppppo.o', '.oppppsoooo', '..ooooo....', '.ooooooooo.'],
  // Las misiones del día: la libreta de pinza con una hecha (en verde) y dos por hacer
  misiones: ['...ooooo...', '.oooyYyooo.', '.ohhhhhhho.', '.ohGhgggho.', '.ohhhhhhho.', '.ohohsssho.', '.ohhhhhhho.', '.ohohsssho.', '.ohhhhhhho.', '.ohhhhhhpo.', '.ooooooooo.'],
  // La ruleta de la semana
  ruleta: ['...ooooo...', '..orYrYro..', '.oYrYrYrYo.', 'orYrYrYrYro', 'oYrYrorYrYo', 'orYroYorYro', 'oYrYrorYrYo', 'orYrYrYrYro', '.oYrYrYrYo.', '..orYrYro..', '...ooooo...'],
  // Lo hecho: una marca de visto
  hecho: ['...........', '.........oo', '........oGo', '.......oGo.', 'oo....oGo..', 'oGo..oGo...', '.oGooGo....', '..oGGo.....', '...oo......', '...........', '...........'],
};

/** Un icono como trazos de SVG, uno por color: [{ color, d }] (cada píxel, un cuadrado de 1 × 1). */
export function trazos(nombre) {
  const filas = ICONOS[nombre];
  if (!filas) return [];
  const porColor = new Map();
  filas.forEach((fila, y) => {
    [...fila].forEach((c, x) => {
      if (c === '.' || !TINTA[c]) return;
      porColor.set(c, `${porColor.get(c) ?? ''}M${x} ${y}h1v1h-1z`);
    });
  });
  return [...porColor].map(([c, d]) => ({ color: TINTA[c], d }));
}
