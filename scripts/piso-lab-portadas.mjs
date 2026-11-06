// Portadas de prueba del piloto: doce PNG pequeños y propios, para contar descargas sin depender de terceros. Tienen algo
// de grano para pesar como una miniatura real. Siempre salen iguales. Uso: node scripts/piso-lab-portadas.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const W = 120;
const H = 180;
const OUT = 'public/lab/covers';
const COLORS = [[122, 47, 42], [37, 73, 107], [63, 96, 72], [138, 106, 47], [85, 58, 107], [46, 90, 90], [148, 80, 46], [58, 58, 74], [160, 120, 60], [90, 40, 70], [40, 80, 60], [110, 110, 130]];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

function png(index) {
  const [r, g, b] = COLORS[index];
  const raw = Buffer.alloc((W * 3 + 1) * H);
  let seed = 1234 + index * 977;
  const noise = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    return (seed >>> 16) & 15;
  };
  for (let y = 0; y < H; y += 1) {
    const row = y * (W * 3 + 1);
    for (let x = 0; x < W; x += 1) {
      // Un marco y una franja, para que se distinga como una cubierta
      const frame = x < 6 || x >= W - 6 || y < 6 || y >= H - 6;
      const band = y > 40 + index * 3 && y < 70 + index * 3;
      const light = frame ? 40 : band ? 70 : 0;
      const n = noise();
      const at = row + 1 + x * 3;
      raw[at] = Math.min(255, r + light + n);
      raw[at + 1] = Math.min(255, g + light + n);
      raw[at + 2] = Math.min(255, b + light + n);
    }
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(W, 0);
  head.writeUInt32BE(H, 4);
  head[8] = 8;
  head[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync(OUT, { recursive: true });
let total = 0;
COLORS.forEach((_, i) => {
  const file = png(i);
  total += file.length;
  writeFileSync(`${OUT}/c${i}.png`, file);
});
console.log(`${COLORS.length} portadas, ${Math.round(total / COLORS.length / 1024)} KB de media, en ${OUT}`);
