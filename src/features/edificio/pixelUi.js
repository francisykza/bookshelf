// Los controles del piso, en el mismo pixel art que la habitación (SPEC §64): marcos de papel, madera y salvia con las
// esquinas escalonadas, e iconos dibujados píxel a píxel. Cada píxel del dibujo mide PX × PX píxeles de CSS, como los
// de la habitación en un móvil, y las imágenes se generan ya a ese tamaño para que se vean nítidas en cualquier
// navegador (sin depender de cómo escale cada uno un `border-image`).
const PX = 3;

const INK = {
  o: '#3b2618', // contorno: madera oscura
  w: '#8a5a38',
  l: '#c8946a',
  W: '#6b4329',
  p: '#fbf3df', // papel
  h: '#fffaf0',
  s: '#e3cfa6',
  g: '#5c6a48', // salvia
  G: '#83946a',
  D: '#46523a',
  r: '#b4644d', // terracota
  R: '#d98b6a',
  y: '#c98a1c', // latón
  Y: '#f0c35a',
  c: '#fbf3df',
};

// Marcos de 7 × 7: esquinas de 2 píxeles (escalonadas), el centro se estira
const FRAMES = {
  paper: ['.ooooo.', 'ohhhhpo', 'ohpppso', 'ohpppso', 'ohpppso', 'opsssso', '.ooooo.'],
  pressed: ['.ooooo.', 'osssspo', 'osppppo', 'osppppo', 'osppppo', 'opppppo', '.ooooo.'],
  sage: ['.ooooo.', 'oGGGGgo', 'oGgggDo', 'oGgggDo', 'oGgggDo', 'ogDDDDo', '.ooooo.'],
  wood: ['.ooooo.', 'olllllo', 'olwwwWo', 'olwwwWo', 'olwwwWo', 'oWWWWWo', '.ooooo.'],
  tag: ['.ooooo.', 'ohhhhpo', 'ohppppo', 'ohpppso', 'ohpppso', 'opsssso', '.ooooo.'],
  // 1.67: cartas de la tienda, con el canto del color de su rareza (poco común, salvia; raro, latón)
  rimSage: ['.ooooo.', 'oGGGGGo', 'oGpppgo', 'oGpppgo', 'oGpppgo', 'ogggggo', '.ooooo.'],
  rimGold: ['.ooooo.', 'oYYYYYo', 'oYpppyo', 'oYpppyo', 'oYpppyo', 'oyyyyyo', '.ooooo.'],
};

// Iconos de 11 × 11 (contorno oscuro y algún color)
const ICONS = {
  girar: ['...ooooo...', '..o.....o..', '.o.......o.', 'o.......ooo', 'o........o.', 'o..........', 'o.........o', '.o.......o.', '..o.....o..', '...ooooo...', '...........'],
  color: ['.....o.....', '.....o.....', '....ooo....', '....oRo....', '...oRrro...', '..oRrrrro..', '..oRrrrro..', '..orrrrro..', '...orrro...', '....ooo....', '...........'],
  guardar: ['...........', 'ooooooooooo', 'owwwwwwwwwo', 'ooooooooooo', '.olllllllo.', '.ollooollo.', '.olllllllo.', '.olllllllo.', '.olllllllo.', '.ooooooooo.', '...........'],
  listo: ['...........', '...........', '.........oo', '........oo.', '.......oo..', 'oo....oo...', '.oo..oo....', '..oooo.....', '...oo......', '...........', '...........'],
  decorar: ['.........oo', '........oWo', '.......oWo.', '......oWo..', '.....oWo...', '....oyo....', '...oYo.....', '..oRo......', '.oRro......', 'oRro.......', 'oo.........'],
  sol: ['.....y.....', '.y...y...y.', '..y.....y..', '....yyy....', '...yYYYy...', 'yy.yYYYy.yy', '...yYYYy...', '....yyy....', '..y.....y..', '.y...y...y.', '.....y.....'],
  lista: ['...........', '.ll.ooooooo', '.ll........', '...........', '.ll.ooooooo', '.ll........', '...........', '.ll.ooooooo', '.ll........', '...........', '...........'],
  dentro: ['ooo.....ooo', 'o.........o', 'o.........o', '...........', '...........', '...........', '...........', '...........', 'o.........o', 'o.........o', 'ooo.....ooo'],
  ficha: ['.ooooooooo.', '.opppppppo.', '.opooooopo.', '.opppppppo.', '.opooooopo.', '.opppppppo.', '.opooooppo.', '.opppppppo.', '.opppppppo.', '.ooooooooo.', '...........'],
  // Misiones del día (§70): una hoja con dos marcas
  hoy: ['...oyyyo...', '.ooooooooo.', '.opppppppo.', '.opgpooopo.', '.oggpppppo.', '.opppppppo.', '.opgpooopo.', '.oggpppppo.', '.opppppppo.', '.ooooooooo.', '...........'],
  // «Me gusta» de un mueble (§71)
  corazon: ['...........', '..ooo.ooo..', '.orrrorrro.', 'orRrrrrrrro', 'orrrrrrrrro', 'orrrrrrrrro', '.orrrrrrro.', '..orrrrro..', '...orrro...', '....oro....', '.....o.....'],
  luna: ['...........', '....yyy....', '..yyYy.....', '.yYYy......', '.yYy.......', '.yYy.......', '.yYYy......', '..yYYyy..y.', '...yyYYYy..', '....yyyy...', '...........'],
  // 1.67: el ticket (con muescas y su línea troquelada) y el sobre lacrado de la tienda
  ticket: ['...........', '...........', 'ooooooooooo', 'oYYYYYyYYYo', 'oYyyYYyYYYo', '.oYYYYyYYo.', 'oYyyYYyYYYo', 'oYYYYYyYYYo', 'ooooooooooo', '...........', '...........'],
  sobre: ['...........', '...........', 'ooooooooooo', 'oopppppppoo', 'opopppppopo', 'oppopppoppo', 'opppoRopppo', 'opppppppppo', 'ossssssssso', 'ooooooooooo', '...........'],
};

function paint(rows, scale = PX) {
  const h = rows.length;
  const w = rows[0].length;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x += 1) {
      const ch = row[x];
      if (!ch || ch === '.') continue;
      ctx.fillStyle = INK[ch];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  });
  return canvas.toDataURL();
}

let cache = null;

/** Variables CSS con los marcos (`--px-paper`…) e iconos (`--px-i-girar`…). Se ponen en la raíz del piso. */
export function pixelVars() {
  if (cache) return cache;
  cache = {};
  for (const [name, rows] of Object.entries(FRAMES)) cache[`--px-${name}`] = `url(${paint(rows)})`;
  for (const [name, rows] of Object.entries(ICONS)) cache[`--px-i-${name}`] = `url(${paint(rows)})`;
  return cache;
}

/** Deja las variables del kit en la raíz del documento, para el resto del edificio (sellos, buzón). */
export function installPixelVars() {
  const style = document.documentElement.style;
  if (style.getPropertyValue('--px-paper')) return;
  for (const [k, v] of Object.entries(pixelVars())) style.setProperty(k, v);
}

/** La imagen de un icono (para usarla desde React). */
export const pixelIconSrc = (name) => pixelVars()[`--px-i-${name}`].slice(4, -1);

/** Un icono como imagen decorativa (el nombre lo lleva el botón). */
export function pixelIcon(name) {
  const img = document.createElement('img');
  img.className = 'px-icon';
  img.alt = '';
  img.width = 11 * PX;
  img.height = 11 * PX;
  img.src = pixelVars()[`--px-i-${name}`].slice(4, -1);
  return img;
}

/** Muestra de paredes y suelo: arriba el color de la pared, abajo el suelo (para la pestaña «Paredes y suelo»). */
export function houseSwatch(wall, floor) {
  const size = 11;
  const canvas = document.createElement('canvas');
  canvas.width = size * PX;
  canvas.height = size * PX;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const edge = x === 0 || y === 0 || x === size - 1 || y === size - 1;
      let c;
      if (edge) c = INK.o;
      else if (y < 6) c = `rgb(${wall.join(' ')})`;
      else if (y === 6) c = INK.W;
      else c = floor(x, y);
      ctx.fillStyle = c;
      ctx.fillRect(x * PX, y * PX, PX, PX);
    }
  }
  return canvas.toDataURL();
}

export const PIXEL = PX;
