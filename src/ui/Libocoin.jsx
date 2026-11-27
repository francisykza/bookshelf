// La moneda de los Libocoins (docs/qa/libocoins.md): el dibujo de Francisco, recortado por `scripts/libocoin.mjs` en
// `public/assets/libo/libocoin-{24,48,96,192}.webp`. Es solo adorno: la cifra y la palabra «Libocoins» van siempre en texto.
const TAMANOS = [24, 48, 96, 192];
const justo = (px) => TAMANOS.find((n) => n >= px) ?? TAMANOS.at(-1);
const url = (n) => `/assets/libo/libocoin-${n}.webp`;

export function Libocoin({ size = 24, className = '' }) {
  return (
    <img
      className={`libocoin ${className}`.trim()}
      src={url(justo(size))}
      srcSet={`${url(justo(size))} 1x, ${url(justo(size * 2))} 2x, ${url(justo(size * 3))} 3x`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable="false"
      decoding="async"
    />
  );
}
