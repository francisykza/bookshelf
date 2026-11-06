// La miniatura guardada tiene que ser la del dibujo de verdad. Si cambias `hotelArt.js`, se rehace con:
//   UPDATE_HOTEL_MINI=1 npx vitest run src/features/pisoLab/__tests__/hotelMiniature.test.js
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderHotel } from '../../edificio/hotel/hotelArt';
import { HOTEL_MINI } from '../hotelMini';
import { MINI_TALL, shrinkHotel } from '../hotelMiniature';

const encode = (cells) => Buffer.from(cells).toString('base64');

describe('la miniatura del Gran Hotel', () => {
  const mini = shrinkHotel(renderHotel());

  if (process.env.UPDATE_HOTEL_MINI) {
    const file = fileURLToPath(new URL('../hotelMini.js', import.meta.url));
    writeFileSync(file, `// Generado desde el dibujo de \`hotelArt.js\`: no se edita a mano (ver __tests__/hotelMiniature.test.js).\nexport const HOTEL_MINI = { W: ${mini.W}, H: ${mini.H}, tip: ${mini.tip}, data: '${encode(mini.cells)}' };\n`);
  }

  it.skipIf(process.env.UPDATE_HOTEL_MINI)('coincide con el dibujo de hotelArt.js', () => {
    expect([HOTEL_MINI.W, HOTEL_MINI.H, HOTEL_MINI.tip]).toEqual([mini.W, mini.H, mini.tip]);
    expect(HOTEL_MINI.data).toBe(encode(mini.cells));
  });

  it('conserva la silueta: aguja fina arriba y cuerpo más ancho abajo', () => {
    const widthAt = (y) => {
      let n = 0;
      for (let x = 0; x < mini.W; x += 1) if (mini.cells[(y * mini.W + x) * 4 + 3]) n += 1;
      return n;
    };
    expect(mini.H).toBe(MINI_TALL);
    expect(widthAt(2)).toBeLessThanOrEqual(3);
    expect(widthAt(2)).toBeGreaterThan(0);
    expect(widthAt(Math.round(mini.H * 0.3))).toBeGreaterThan(widthAt(2));
    expect(widthAt(mini.H - 3)).toBeGreaterThan(widthAt(Math.round(mini.H * 0.3)));
  });
});
